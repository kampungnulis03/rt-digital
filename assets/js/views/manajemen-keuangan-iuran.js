// File: assets/js/views/manajemen-keuangan-iuran.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_IURAN = "iuran_warga";
const COLLECTION_WARGA = "warga";
const ANNUAL_SETTING_DOC_REF = () => doc(db, "pengaturan", "iuran_tahunan");
const FEEDBACK_AUTO_HIDE_MS = 3000;
const TAGIHAN_PAGE_SIZE = 10;

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatRupiah(num = 0) {
    const val = Number(num) || 0;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val);
}

function formatRibuanInput(rawValue = "") {
    const digitsOnly = String(rawValue ?? "").replace(/\D+/g, "");
    if (!digitsOnly) return "";
    const normalized = digitsOnly.replace(/^0+(?=\d)/, "");
    return new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 0
    }).format(Number(normalized));
}

function parseAngkaInput(formattedValue = "") {
    const digitsOnly = String(formattedValue ?? "").replace(/\D+/g, "");
    if (!digitsOnly) return NaN;
    return Number(digitsOnly);
}

function formatTanggalDisplay(dateStr = "") {
    if (!dateStr) return "-";
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return String(dateStr);
    return parsed.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getCurrentUserRole() {
    return String(localStorage.getItem("user_role") || "").trim().toLowerCase();
}

function normalizeText(value = "") {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function stripParentheticalLabel(value = "") {
    return normalizeText(String(value ?? "").replace(/\s*\([^)]*\)\s*/g, " "));
}

function normalizeWaPhone(rawPhone = "") {
    let digits = String(rawPhone ?? "").replace(/\D+/g, "");
    if (!digits) return "";
    if (digits.startsWith("0")) {
        digits = `62${digits.slice(1)}`;
    } else if (digits.startsWith("8")) {
        digits = `62${digits}`;
    }
    return digits.length >= 9 ? digits : "";
}

function extractPhoneFromWarga(warga = {}, fallbackPayment = {}) {
    const candidates = [
        warga.noWa,
        warga.wa,
        warga.noHp,
        warga.hp,
        warga.telepon,
        warga.noTelepon,
        warga.phone,
        fallbackPayment.noWa,
        fallbackPayment.noHp
    ];
    for (const c of candidates) {
        const clean = normalizeWaPhone(c);
        if (clean) return clean;
    }
    const blokText = String(warga.alamat || warga.blok || fallbackPayment.blok || "");
    const phoneMatch = blokText.match(/(?:\+62|62|0)8\d{7,12}/);
    return phoneMatch ? normalizeWaPhone(phoneMatch[0]) : "";
}

function extractYearFromPeriode(periodeStr = "") {
    const str = String(periodeStr || "").trim();
    if (!str) return "";
    const leadingMatch = str.match(/(\d{4})/);
    return leadingMatch ? leadingMatch[1] : "";
}

function extractYearFromRecord(record = {}) {
    const fromPeriode = extractYearFromPeriode(record.periode);
    if (fromPeriode) return fromPeriode;
    const dateVal = String(record.tanggal || record.createdAt || "").trim();
    const isoMatch = dateVal.match(/^(\d{4})[-/]/);
    if (isoMatch) return isoMatch[1];
    const dmyMatch = dateVal.match(/[-/](\d{4})(?:\b|T|\s)/);
    if (dmyMatch) return dmyMatch[1];
    const anyYear = dateVal.match(/\b(20\d{2}|19\d{2})\b/);
    return anyYear ? anyYear[1] : "";
}

function hasIuranWajibRt(wargaItem = {}) {
    if (!Array.isArray(wargaItem.statusSosial)) return false;
    return wargaItem.statusSosial.some(
        (st) => String(st ?? "").trim().toLowerCase() === "iuran wajib rt"
    );
}

function buildBlokLabel(wargaItem = {}) {
    const parts = [
        wargaItem.alamat,
        wargaItem.rtRw ? `RT/RW ${wargaItem.rtRw}` : "",
        wargaItem.noKk ? `KK: ${wargaItem.noKk}` : ""
    ].filter(Boolean);
    return parts.join(" • ");
}

function matchPaymentToWarga(pay = {}, warga = {}) {
    const namaClean = stripParentheticalLabel(warga.nama);
    const nikStr = normalizeText(warga.nik);
    const kkStr = normalizeText(warga.noKk);
    const payNameClean = stripParentheticalLabel(pay.namaWarga);
    const payBlok = normalizeText(pay.blok);

    if (!payNameClean && !payBlok) return false;
    if (namaClean && payNameClean === namaClean) return true;
    if (namaClean && payNameClean.startsWith(`${namaClean} `)) return true;
    if (nikStr && (payNameClean.includes(nikStr) || payBlok.includes(nikStr))) return true;
    if (kkStr && (payNameClean.includes(kkStr) || payBlok.includes(kkStr))) return true;
    return false;
}

function comparePaymentChronologically(a, b) {
    const keyA = String(a.tanggal || a.createdAt || "");
    const keyB = String(b.tanggal || b.createdAt || "");
    const dateCmp = keyA.localeCompare(keyB);
    if (dateCmp !== 0) return dateCmp;

    const createdA = String(a.createdAt || "");
    const createdB = String(b.createdAt || "");
    const createdCmp = createdA.localeCompare(createdB);
    if (createdCmp !== 0) return createdCmp;

    return String(a.id || "").localeCompare(String(b.id || ""));
}

export function renderManajemenKeuanganIuran() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultPeriode = todayIso.slice(0, 7);
    const defaultYear = todayIso.slice(0, 4);
    const isAdminRender = getCurrentUserRole() === "administrator";
    const colCountRender = isAdminRender ? 7 : 6;

    return `
        <div class="space-y-5">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Keuangan • Iuran Keuangan
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Kelola info tagihan, sisa tagihan warga "Iuran Wajib RT" &amp; setting iuran tahunan RT.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        id="mki-open-annual-btn"
                        class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] hover:border-[#c87d32] hover:text-[#c87d32] dark:bg-stone-800 text-stone-800 dark:text-stone-200 transition cursor-pointer"
                    >
                        <span>Setting Iuran Tahunan</span>
                    </button>
                    <button
                        type="button"
                        id="mki-toggle-form-btn"
                        class="hidden inline-flex items-center justify-center gap-2 px-4 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <span>+ Tambah Iuran</span>
                    </button>
                    <a
                        href="#/manajemen-keuangan"
                        data-link
                        class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                        <span>Kembali</span>
                    </a>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Iuran Terkumpul</div>
                    <div id="mki-sum-lunas" class="text-base md:text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">Rp 0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Terbayar Akumulasi</div>
                    <div id="mki-sum-sisa-wajib" class="text-base md:text-lg font-bold text-amber-700 dark:text-amber-400 mt-1">Rp 0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Sisa Saldo</div>
                    <div id="mki-sum-belum" class="text-base md:text-lg font-bold text-rose-700 dark:text-rose-400 mt-1">Rp 0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Warga Lunas</div>
                    <div id="mki-sum-count" class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0 / 0 Data</div>
                </div>
            </div>

            <!-- Notifikasi Toast Pojok Kanan Atas -->
            <div
                id="mki-feedback"
                role="status"
                aria-live="polite"
                class="hidden fixed top-5 right-5 z-[60] max-w-sm w-auto px-4 py-3 text-xs font-semibold border rounded-none shadow-xl flex items-center justify-between gap-3"
            >
                <span id="mki-feedback-text"></span>
                <button
                    type="button"
                    id="mki-close-feedback-btn"
                    class="font-bold text-sm leading-none opacity-75 hover:opacity-100 cursor-pointer"
                    title="Tutup notifikasi"
                >
                    &times;
                </button>
            </div>

            <!-- POP / Modal Form Tambah / Edit Iuran Keuangan -->
            <div id="mki-form-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-stone-950/60 p-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                    <div class="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-[#f6f3ec] dark:bg-stone-950 flex items-center justify-between gap-3 sticky top-0 z-10">
                        <div>
                            <h2 id="mki-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                                TAMBAH DATA IURAN KEUANGAN
                            </h2>
                            <p class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                Status pembayaran ditentukan otomatis dari perbandingan nominal bayar terhadap sisa pembayaran.
                            </p>
                        </div>
                        <button type="button" id="mki-close-form-btn" class="px-2 py-1 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 font-bold text-base leading-none cursor-pointer" title="Tutup">
                            &times;
                        </button>
                    </div>

                    <form id="mki-form" class="p-5 space-y-4 text-xs">
                        <div id="mki-form-feedback" class="hidden px-3.5 py-2 text-xs font-semibold border rounded-none"></div>

                        <input type="hidden" id="mki-edit-id" value="">

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="mki-nama" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Nama Warga / KK <span class="text-rose-500">*</span></label>
                                <select id="mki-nama" required class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                                    <option value="">-- Pilih Warga (Iuran Wajib RT) --</option>
                                </select>
                            </div>
                            <div>
                                <label for="mki-blok" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Blok / No. Rumah</label>
                                <input type="text" id="mki-blok" placeholder="Contoh: Blok A No. 05" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            </div>
                            <div>
                                <label for="mki-periode" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Periode Bulan</label>
                                <input type="month" id="mki-periode" value="${escapeHtml(defaultPeriode)}" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            </div>
                            <div>
                                <label for="mki-nominal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Nominal (Rp) <span class="text-rose-500">*</span></label>
                                <input type="text" inputmode="numeric" id="mki-nominal" required placeholder="0" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            </div>
                            <div>
                                <label for="mki-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Tanggal Bayar</label>
                                <input type="date" id="mki-tanggal" value="${escapeHtml(todayIso)}" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            </div>
                            <div>
                                <label for="mki-keterangan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Keterangan</label>
                                <input type="text" id="mki-keterangan" placeholder="Catatan iuran keamanan, sampah, atau kas RT" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            </div>
                        </div>

                        <!-- Info Sisa Pembayaran & Status Otomatis -->
                        <div id="mki-form-sisa-box" class="bg-[#f6f3ec] dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 p-3.5 rounded-none space-y-2.5">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <span class="text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                                    Info Sisa Pembayaran (<span id="mki-form-tahun-label">${escapeHtml(defaultYear)}</span>)
                                </span>
                                <span id="mki-form-auto-status" class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700">
                                    Status Otomatis: -
                                </span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <div class="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Tagihan Tahunan</div>
                                    <div id="mki-form-tagihan-val" class="text-xs md:text-sm font-bold text-stone-900 dark:text-stone-100 mt-0.5">Rp 0</div>
                                </div>
                                <div>
                                    <div class="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Sisa Pembayaran Saat Ini</div>
                                    <div id="mki-form-sisa-saat-ini" class="text-xs md:text-sm font-bold text-rose-700 dark:text-rose-400 mt-0.5">Rp 0</div>
                                </div>
                                <div>
                                    <div class="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Sisa Setelah Pembayaran Ini</div>
                                    <div id="mki-form-sisa-setelah" class="text-xs md:text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">Rp 0</div>
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                            <button type="button" id="mki-cancel-btn" class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer">
                                Tutup
                            </button>
                            <button type="button" id="mki-reset-btn" class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer">
                                Bersihkan
                            </button>
                            <button type="submit" class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">
                                Simpan Iuran
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- Daftar Info Tagihan & Sisa Tagihan Warga (Status Sosial: Iuran Wajib RT) -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-hidden">
                <div class="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-[#f6f3ec] dark:bg-stone-950/60 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <h2 class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                                DAFTAR INFO TAGIHAN &amp; SISA TAGIHAN (IURAN WAJIB RT)
                            </h2>
                            <span id="mki-active-year-pill" class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-[#5c6d4e]/15 text-[#4b5a3f] dark:text-emerald-300 border-[#5c6d4e]/40">
                                Tahun Aktif: ${escapeHtml(defaultYear)}
                            </span>
                        </div>
                        <p id="mki-tagihan-subtitle" class="text-[11px] text-stone-600 dark:text-stone-400 mt-0.5">
                            Tarif tahunan dari pengaturan/iuran_tahunan • Warga berstatus sosial "Iuran Wajib RT"
                        </p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <label for="mki-tagihan-tahun" class="text-xs font-semibold text-stone-700 dark:text-stone-300">Tahun:</label>
                        <select id="mki-tagihan-tahun" class="px-3 py-1.5 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            <option value="${escapeHtml(defaultYear)}">${escapeHtml(defaultYear)}</option>
                        </select>
                        <select id="mki-tagihan-filter" class="px-3 py-1.5 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            <option value="">Semua Tagihan</option>
                            <option value="sisa">Masih Ada Sisa</option>
                            <option value="lunas">Sudah Lunas</option>
                        </select>
                        <input type="text" id="mki-tagihan-search" placeholder="Cari warga / NIK / KK / alamat..." class="px-3 py-1.5 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32] w-48 sm:w-56">
                        <span id="mki-tagihan-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#faf8f3] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                            0 Warga
                        </span>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-[#f6f3ec] dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                            <tr>
                                <th class="px-3 py-2.5 text-center w-12">No</th>
                                <th class="px-4 py-2.5">Warga / Identitas</th>
                                <th class="px-4 py-2.5 text-right">Info Tagihan</th>
                                <th class="px-4 py-2.5 text-right">Terbayar</th>
                                <th class="px-4 py-2.5 text-right">Sisa Tagihan</th>
                                <th class="px-4 py-2.5">Status</th>
                                ${isAdminRender ? `<th class="px-4 py-2.5 text-right">Aksi</th>` : ""}
                            </tr>
                        </thead>
                        <tbody id="mki-tagihan-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                            <tr><td colspan="${colCountRender}" class="p-6 text-center text-stone-500 dark:text-stone-400">Memuat daftar tagihan warga...</td></tr>
                        </tbody>
                    </table>
                </div>

                <div id="mki-tagihan-pagination" class="px-5 py-3 border-t border-stone-200 dark:border-stone-800 bg-[#f6f3ec] dark:bg-stone-950/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-stone-700 dark:text-stone-300">
                    <span id="mki-tagihan-page-info">Menampilkan 0 dari 0 warga</span>
                    <div class="flex items-center gap-1.5">
                        <button type="button" id="mki-tagihan-prev-btn" class="px-3 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-900 hover:border-[#c87d32] disabled:opacity-40 disabled:pointer-events-none rounded-none cursor-pointer transition">
                            Sebelumnya
                        </button>
                        <span id="mki-tagihan-page-num" class="px-2.5 py-1 text-xs font-bold border border-stone-200 dark:border-stone-800 bg-[#faf8f3] dark:bg-stone-800 rounded-none">
                            Hal 1 / 1
                        </span>
                        <button type="button" id="mki-tagihan-next-btn" class="px-3 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-900 hover:border-[#c87d32] disabled:opacity-40 disabled:pointer-events-none rounded-none cursor-pointer transition">
                            Berikutnya
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal Histori Pembayaran Warga -->
            <div id="mki-history-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-stone-950/60 p-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none shadow-2xl w-full max-w-4xl overflow-hidden">
                    <div class="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-[#f6f3ec] dark:bg-stone-950 flex items-center justify-between gap-3">
                        <div>
                            <h2 id="mki-history-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                                HISTORI PEMBAYARAN WARGA
                            </h2>
                            <p id="mki-history-subtitle" class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                Rincian transaksi pembayaran iuran warga &amp; sisa tagihan pada saat transaksi
                            </p>
                        </div>
                        <button type="button" id="mki-close-history-btn" class="px-2 py-1 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 font-bold text-base leading-none cursor-pointer" title="Tutup">
                            &times;
                        </button>
                    </div>

                    <div class="p-5 space-y-4 text-xs">
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#f6f3ec] dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 p-3.5 rounded-none">
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Info Tagihan Tahun</div>
                                <div id="mki-history-target" class="text-sm font-bold text-stone-900 dark:text-stone-100 mt-0.5">Rp 0</div>
                            </div>
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Terbayar</div>
                                <div id="mki-history-paid" class="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">Rp 0</div>
                            </div>
                            <div>
                                <div class="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Sisa Tagihan Terkini</div>
                                <div id="mki-history-remaining" class="text-sm font-bold text-rose-700 dark:text-rose-400 mt-0.5">Rp 0</div>
                            </div>
                        </div>

                        <div class="border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto max-h-72 overflow-y-auto">
                            <table class="w-full text-left border-collapse">
                                <thead class="bg-[#f6f3ec] dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 sticky top-0">
                                    <tr>
                                        <th class="px-3 py-2 text-center w-10">No</th>
                                        <th class="px-4 py-2">Tanggal / Periode</th>
                                        <th class="px-4 py-2">Keterangan</th>
                                        <th class="px-4 py-2">Status</th>
                                        <th class="px-4 py-2 text-right">Nominal &amp; Sisa Saat Transaksi</th>
                                        ${isAdminRender ? `<th class="px-4 py-2 text-right">Aksi</th>` : ""}
                                    </tr>
                                </thead>
                                <tbody id="mki-history-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                                    <tr><td colspan="${isAdminRender ? 6 : 5}" class="p-6 text-center text-stone-500 dark:text-stone-400">Belum ada histori pembayaran.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- POP / Modal Setting Iuran Tahunan -->
            <div id="mki-annual-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-stone-950/60 p-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none shadow-2xl w-full max-w-2xl overflow-hidden">
                    <div class="px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-[#f6f3ec] dark:bg-stone-950 flex items-center justify-between gap-3">
                        <div>
                            <h2 class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                                SETTING IURAN TAHUNAN
                            </h2>
                            <p class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                Atur nilai iuran berdasarkan tahun, tentukan tahun aktif &amp; simpan ke tabel pengaturan tahunan.
                            </p>
                        </div>
                        <button type="button" id="mki-close-annual-btn" class="px-2 py-1 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 font-bold text-base leading-none cursor-pointer" title="Tutup">
                            &times;
                        </button>
                    </div>

                    <div class="p-5 space-y-5 text-xs">
                        <div class="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[#f6f3ec] dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-none">
                            <span class="text-stone-600 dark:text-stone-400">Tahun Iuran Aktif Saat Ini:</span>
                            <strong id="mki-annual-active-display" class="text-xs font-bold text-[#5c6d4e] dark:text-emerald-400">${escapeHtml(defaultYear)}</strong>
                        </div>

                        <div id="mki-annual-feedback" class="hidden px-3 py-2 text-xs font-semibold border rounded-none"></div>

                        <form id="mki-annual-form" class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <div>
                                <label for="mki-annual-tahun" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Tahun <span class="text-rose-500">*</span></label>
                                <input type="number" id="mki-annual-tahun" min="2000" max="2100" step="1" value="${escapeHtml(defaultYear)}" required placeholder="2026" class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            </div>
                            <div>
                                <label for="mki-annual-nilai" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Nilai (Rp) <span class="text-rose-500">*</span></label>
                                <input type="text" inputmode="numeric" id="mki-annual-nilai" required placeholder="Contoh: 500.000" class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="submit" id="mki-annual-save-btn" class="flex-1 px-4 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">
                                    Simpan ke Tabel
                                </button>
                                <button type="button" id="mki-annual-clear-btn" class="px-3 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer">
                                    Reset
                                </button>
                            </div>
                        </form>

                        <div class="border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto max-h-64 overflow-y-auto">
                            <table class="w-full text-left border-collapse">
                                <thead class="bg-[#f6f3ec] dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-2.5">Tahun</th>
                                        <th class="px-4 py-2.5 text-right">Nilai</th>
                                        <th class="px-4 py-2.5 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="mki-annual-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                                    <tr><td colspan="3" class="p-6 text-center text-stone-500 dark:text-stone-400">Memuat setting iuran tahunan...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function initManajemenKeuanganIuranHandler() {
    let rows = [];
    let wargaWajibList = [];
    let annualSettings = [];
    let activeYear = "";
    let hasExplicitActiveYear = false;
    let tagihanPage = 1;
    let currentHistoryContext = null;
    let isDestroyed = false;
    let feedbackTimer = null;
    let formFeedbackTimer = null;
    let annualFeedbackTimer = null;
    const isAdmin = getCurrentUserRole() === "administrator";
    const colCount = isAdmin ? 7 : 6;
    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultYear = todayIso.slice(0, 4);

    const openAnnualBtn = document.getElementById("mki-open-annual-btn");
    const annualModal = document.getElementById("mki-annual-modal");
    const closeAnnualBtn = document.getElementById("mki-close-annual-btn");
    const annualActiveDisplayEl = document.getElementById("mki-annual-active-display");
    const activeYearPillEl = document.getElementById("mki-active-year-pill");
    const annualFeedbackEl = document.getElementById("mki-annual-feedback");
    const annualForm = document.getElementById("mki-annual-form");
    const annualTahunInput = document.getElementById("mki-annual-tahun");
    const annualNilaiInput = document.getElementById("mki-annual-nilai");
    const annualSaveBtn = document.getElementById("mki-annual-save-btn");
    const annualClearBtn = document.getElementById("mki-annual-clear-btn");
    const annualTbody = document.getElementById("mki-annual-tbody");

    const historyModal = document.getElementById("mki-history-modal");
    const closeHistoryBtn = document.getElementById("mki-close-history-btn");
    const historyTitleEl = document.getElementById("mki-history-title");
    const historySubtitleEl = document.getElementById("mki-history-subtitle");
    const historyTargetEl = document.getElementById("mki-history-target");
    const historyPaidEl = document.getElementById("mki-history-paid");
    const historyRemainingEl = document.getElementById("mki-history-remaining");
    const historyTbodyEl = document.getElementById("mki-history-tbody");

    const toggleBtn = document.getElementById("mki-toggle-form-btn");
    const feedbackEl = document.getElementById("mki-feedback");
    const feedbackTextEl = document.getElementById("mki-feedback-text");
    const closeFeedbackBtn = document.getElementById("mki-close-feedback-btn");
    const formModal = document.getElementById("mki-form-modal");
    const closeFormBtn = document.getElementById("mki-close-form-btn");
    const formFeedbackEl = document.getElementById("mki-form-feedback");
    const formEl = document.getElementById("mki-form");
    const formTitleEl = document.getElementById("mki-form-title");
    const cancelBtn = document.getElementById("mki-cancel-btn");
    const resetBtn = document.getElementById("mki-reset-btn");
    const editIdEl = document.getElementById("mki-edit-id");
    const namaSelectEl = document.getElementById("mki-nama");
    const blokInputEl = document.getElementById("mki-blok");
    const periodeInput = document.getElementById("mki-periode");
    const nominalInput = document.getElementById("mki-nominal");
    const tanggalInputEl = document.getElementById("mki-tanggal");
    const keteranganInputEl = document.getElementById("mki-keterangan");
    const formTahunLabelEl = document.getElementById("mki-form-tahun-label");
    const formAutoStatusEl = document.getElementById("mki-form-auto-status");
    const formTagihanValEl = document.getElementById("mki-form-tagihan-val");
    const formSisaSaatIniEl = document.getElementById("mki-form-sisa-saat-ini");
    const formSisaSetelahEl = document.getElementById("mki-form-sisa-setelah");

    const tagihanTahunEl = document.getElementById("mki-tagihan-tahun");
    const tagihanFilterEl = document.getElementById("mki-tagihan-filter");
    const tagihanSearchEl = document.getElementById("mki-tagihan-search");
    const tagihanBadgeEl = document.getElementById("mki-tagihan-badge");
    const tagihanSubtitleEl = document.getElementById("mki-tagihan-subtitle");
    const tagihanTbodyEl = document.getElementById("mki-tagihan-tbody");
    const tagihanPageInfoEl = document.getElementById("mki-tagihan-page-info");
    const tagihanPageNumEl = document.getElementById("mki-tagihan-page-num");
    const tagihanPrevBtn = document.getElementById("mki-tagihan-prev-btn");
    const tagihanNextBtn = document.getElementById("mki-tagihan-next-btn");

    function getEffectiveActiveYear() {
        if (/^\d{4}$/.test(String(activeYear || ""))) {
            return String(activeYear);
        }
        return defaultYear;
    }

    function syncActiveYearBadges() {
        const currentActive = getEffectiveActiveYear();
        if (annualActiveDisplayEl) {
            annualActiveDisplayEl.textContent = currentActive;
        }
        if (activeYearPillEl) {
            activeYearPillEl.textContent = `Tahun Aktif: ${currentActive}`;
        }
    }

    function hideFeedback() {
        if (feedbackTimer) {
            clearTimeout(feedbackTimer);
            feedbackTimer = null;
        }
        feedbackEl?.classList.add("hidden");
    }

    function showFeedback(msg, type = "success") {
        if (!feedbackEl || isDestroyed) return;
        if (feedbackTimer) {
            clearTimeout(feedbackTimer);
            feedbackTimer = null;
        }
        feedbackEl.className =
            type === "error"
                ? "fixed top-5 right-5 z-[60] max-w-sm w-auto px-4 py-3 text-xs font-semibold border rounded-none shadow-xl flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/95 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "fixed top-5 right-5 z-[60] max-w-sm w-auto px-4 py-3 text-xs font-semibold border rounded-none shadow-xl flex items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
        if (feedbackTextEl) {
            feedbackTextEl.textContent = msg;
        } else {
            feedbackEl.textContent = msg;
        }
        feedbackEl.classList.remove("hidden");
        feedbackTimer = setTimeout(() => {
            if (!isDestroyed) feedbackEl.classList.add("hidden");
            feedbackTimer = null;
        }, FEEDBACK_AUTO_HIDE_MS);
    }

    function hideFormFeedback() {
        if (formFeedbackTimer) {
            clearTimeout(formFeedbackTimer);
            formFeedbackTimer = null;
        }
        formFeedbackEl?.classList.add("hidden");
    }

    function showFormFeedback(msg, type = "error") {
        if (!formFeedbackEl || isDestroyed) return;
        if (formFeedbackTimer) {
            clearTimeout(formFeedbackTimer);
            formFeedbackTimer = null;
        }
        formFeedbackEl.className =
            type === "error"
                ? "px-3.5 py-2 text-xs font-semibold border rounded-none bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "px-3.5 py-2 text-xs font-semibold border rounded-none bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
        formFeedbackEl.textContent = msg;
        formFeedbackEl.classList.remove("hidden");
        formFeedbackTimer = setTimeout(() => {
            if (!isDestroyed) formFeedbackEl.classList.add("hidden");
            formFeedbackTimer = null;
        }, FEEDBACK_AUTO_HIDE_MS);
    }

    function hideAnnualFeedback() {
        if (annualFeedbackTimer) {
            clearTimeout(annualFeedbackTimer);
            annualFeedbackTimer = null;
        }
        annualFeedbackEl?.classList.add("hidden");
    }

    function showAnnualFeedback(msg, type = "success") {
        if (!annualFeedbackEl || isDestroyed) return;
        if (annualFeedbackTimer) {
            clearTimeout(annualFeedbackTimer);
            annualFeedbackTimer = null;
        }
        annualFeedbackEl.className =
            type === "error"
                ? "px-3 py-2 text-xs font-semibold border rounded-none bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "px-3 py-2 text-xs font-semibold border rounded-none bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
        annualFeedbackEl.textContent = msg;
        annualFeedbackEl.classList.remove("hidden");
        annualFeedbackTimer = setTimeout(() => {
            if (!isDestroyed) annualFeedbackEl.classList.add("hidden");
            annualFeedbackTimer = null;
        }, FEEDBACK_AUTO_HIDE_MS);
    }

    function getAnnualRateForYear(yearStr) {
        const cleanYear = String(yearStr || "").trim();
        if (!cleanYear) return 0;
        const found = annualSettings.find((item) => String(item.tahun) === cleanYear);
        if (!found) return 0;
        const num = Number(found.nilai);
        return Number.isFinite(num) && num > 0 ? num : 0;
    }

    function sumPaymentsForWargaInYear(warga, yearStr, excludeId = "") {
        if (!warga) return 0;
        return rows
            .filter((r) => {
                if (excludeId && r.id === excludeId) return false;
                if (extractYearFromRecord(r) !== String(yearStr)) return false;
                return matchPaymentToWarga(r, warga);
            })
            .reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
    }

    function getChronologicalPaymentsWithSnapshot(warga, selectedYear) {
        const targetTagihan = getAnnualRateForYear(selectedYear);
        const matching = rows
            .filter(
                (r) =>
                    extractYearFromRecord(r) === String(selectedYear) &&
                    (!warga || matchPaymentToWarga(r, warga))
            )
            .sort(comparePaymentChronologically);

        let runningPaid = 0;
        return matching.map((item) => {
            const nominal = Number(item.nominal) || 0;
            const sisaSebelum = Math.max(0, targetTagihan - runningPaid);
            runningPaid += nominal;
            const sisaSaatTransaksi = Math.max(0, targetTagihan - runningPaid);
            const isLunasSaatTransaksi = targetTagihan > 0 && sisaSaatTransaksi === 0;

            return {
                ...item,
                nominal,
                sisaSebelum,
                sisaSaatTransaksi,
                totalTerbayarSaatTransaksi: runningPaid,
                isLunasSaatTransaksi
            };
        });
    }

    function computeFormPaymentSummary() {
        const currentActive = getEffectiveActiveYear();
        const yearStr =
            extractYearFromPeriode(periodeInput?.value || "") ||
            String(tagihanTahunEl?.value || currentActive).trim();
        const targetTagihan = getAnnualRateForYear(yearStr);
        const chosenName = String(namaSelectEl?.value || "").trim();
        const blokVal = String(blokInputEl?.value || "").trim();
        const editId = String(editIdEl?.value || "").trim();
        const rawNominal = parseAngkaInput(nominalInput?.value);
        const nominalBayar = Number.isFinite(rawNominal) && rawNominal > 0 ? rawNominal : 0;

        const wargaObj = wargaWajibList.find(
            (w) => stripParentheticalLabel(w.nama) === stripParentheticalLabel(chosenName)
        );

        const pseudoWarga = wargaObj || {
            nama: chosenName,
            blok: blokVal,
            alamat: blokVal
        };

        const otherPaid = chosenName
            ? sumPaymentsForWargaInYear(pseudoWarga, yearStr, editId)
            : 0;

        const sisaSaatIni = Math.max(0, targetTagihan - otherPaid);
        const totalSetelahBayar = otherPaid + nominalBayar;
        const sisaSetelahBayar = Math.max(0, targetTagihan - totalSetelahBayar);

        let computedStatus = "Belum Lunas";
        if (!chosenName) {
            computedStatus = "-";
        } else if (targetTagihan > 0 && sisaSetelahBayar === 0) {
            computedStatus = "Lunas";
        }

        return {
            yearStr,
            targetTagihan,
            sisaSaatIni,
            nominalBayar,
            sisaSetelahBayar,
            computedStatus
        };
    }

    function updateFormSisaInfo() {
        if (isDestroyed) return;
        const summary = computeFormPaymentSummary();

        if (formTahunLabelEl) formTahunLabelEl.textContent = summary.yearStr;
        if (formTagihanValEl) formTagihanValEl.textContent = formatRupiah(summary.targetTagihan);
        if (formSisaSaatIniEl) {
            formSisaSaatIniEl.textContent = formatRupiah(summary.sisaSaatIni);
            formSisaSaatIniEl.className =
                summary.sisaSaatIni > 0
                    ? "text-xs md:text-sm font-bold text-rose-700 dark:text-rose-400 mt-0.5"
                    : "text-xs md:text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5";
        }
        if (formSisaSetelahEl) {
            formSisaSetelahEl.textContent = formatRupiah(summary.sisaSetelahBayar);
            formSisaSetelahEl.className =
                summary.sisaSetelahBayar > 0
                    ? "text-xs md:text-sm font-bold text-amber-700 dark:text-amber-400 mt-0.5"
                    : "text-xs md:text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5";
        }
        if (formAutoStatusEl) {
            if (summary.computedStatus === "Lunas") {
                formAutoStatusEl.textContent = "Status Otomatis: Lunas";
                formAutoStatusEl.className =
                    "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
            } else if (summary.computedStatus === "Belum Lunas") {
                formAutoStatusEl.textContent = "Status Otomatis: Belum Lunas";
                formAutoStatusEl.className =
                    "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
            } else {
                formAutoStatusEl.textContent = "Status Otomatis: -";
                formAutoStatusEl.className =
                    "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700";
            }
        }
    }

    function populateWargaDropdown(selectedName = "") {
        if (!namaSelectEl) return;
        const currentVal = selectedName || namaSelectEl.value || "";
        const options = [`<option value="">-- Pilih Warga (Iuran Wajib RT) --</option>`];
        const existingNames = new Set();

        wargaWajibList.forEach((w) => {
            const nama = String(w.nama || "").trim();
            if (!nama) return;
            const infoParts = [
                w.rtRw ? `RT/RW ${w.rtRw}` : "",
                w.noKk ? `KK ${w.noKk}` : ""
            ].filter(Boolean);
            const label = infoParts.length ? `${nama} (${infoParts.join(" • ")})` : nama;
            options.push(`<option value="${escapeHtml(nama)}">${escapeHtml(label)}</option>`);
            existingNames.add(stripParentheticalLabel(nama));
        });

        if (currentVal && !existingNames.has(stripParentheticalLabel(currentVal))) {
            options.push(`<option value="${escapeHtml(currentVal)}">${escapeHtml(currentVal)} (Data Lama)</option>`);
        }

        namaSelectEl.innerHTML = options.join("");
        const matchedOpt = Array.from(namaSelectEl.options).find(
            (opt) => stripParentheticalLabel(opt.value) === stripParentheticalLabel(currentVal)
        );
        namaSelectEl.value = matchedOpt ? matchedOpt.value : currentVal;
    }

    function syncWargaSelectionDetails(forceAmount = false) {
        if (!namaSelectEl) return;
        const chosenClean = stripParentheticalLabel(namaSelectEl.value);
        if (!chosenClean) {
            updateFormSisaInfo();
            return;
        }

        const wargaObj = wargaWajibList.find(
            (w) => stripParentheticalLabel(w.nama) === chosenClean
        );
        if (!wargaObj) {
            updateFormSisaInfo();
            return;
        }

        const blokLabel = buildBlokLabel(wargaObj);
        if (blokInputEl && (forceAmount || !blokInputEl.value.trim()) && blokLabel) {
            blokInputEl.value = blokLabel;
        }

        if (nominalInput) {
            const currentNom = parseAngkaInput(nominalInput.value);
            if (forceAmount || !Number.isFinite(currentNom) || currentNom <= 0) {
                const currentActive = getEffectiveActiveYear();
                const yr = extractYearFromPeriode(periodeInput?.value || `${currentActive}-${todayIso.slice(5, 7)}`) || currentActive;
                const computedForYear = computeTagihanRows(yr);
                const matchTagihan = computedForYear.find((item) => item.id === wargaObj.id);
                const suggestedAmount =
                    matchTagihan && matchTagihan.sisaTagihan > 0
                        ? matchTagihan.sisaTagihan
                        : getAnnualRateForYear(yr);

                if (suggestedAmount > 0) {
                    nominalInput.value = formatRibuanInput(suggestedAmount);
                }
            }
        }

        updateFormSisaInfo();
    }

    function syncTagihanYearOptions(forceToActiveYear = false) {
        if (!tagihanTahunEl) return;
        const currentActive = getEffectiveActiveYear();
        const previousVal = forceToActiveYear
            ? currentActive
            : (tagihanTahunEl.value || currentActive);

        const yearsSet = new Set([defaultYear, currentActive]);

        annualSettings.forEach((item) => {
            if (/^\d{4}$/.test(String(item.tahun || ""))) {
                yearsSet.add(String(item.tahun));
            }
        });
        rows.forEach((r) => {
            const yr = extractYearFromRecord(r);
            if (/^\d{4}$/.test(yr)) {
                yearsSet.add(yr);
            }
        });

        const sortedYears = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
        tagihanTahunEl.innerHTML = sortedYears
            .map((yr) => `<option value="${escapeHtml(yr)}">${escapeHtml(yr)}</option>`)
            .join("");

        tagihanTahunEl.value = sortedYears.includes(previousVal) ? previousVal : currentActive;
    }

    function applyAnnualRateToNominalIfEmpty(periodeVal) {
        if (!nominalInput) return;
        const currentNom = parseAngkaInput(nominalInput.value);
        if (Number.isFinite(currentNom) && currentNom > 0) {
            updateFormSisaInfo();
            return;
        }
        const currentActive = getEffectiveActiveYear();
        const yr = extractYearFromPeriode(periodeVal || periodeInput?.value || `${currentActive}-${todayIso.slice(5, 7)}`);
        const rate = getAnnualRateForYear(yr);
        if (rate > 0) {
            nominalInput.value = formatRibuanInput(rate);
        }
        updateFormSisaInfo();
    }

    function renderAnnualTable() {
        if (isDestroyed || !annualTbody) return;
        syncActiveYearBadges();
        const currentActive = getEffectiveActiveYear();

        if (!annualSettings.length) {
            annualTbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-stone-500 dark:text-stone-400">Belum ada setting iuran tahunan.</td></tr>`;
            return;
        }

        annualTbody.innerHTML = annualSettings
            .map((item) => {
                const safeTahun = escapeHtml(item.tahun);
                const isRowActive = String(item.tahun) === currentActive;
                const activeBadge = isRowActive
                    ? `<span class="ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">Aktif</span>`
                    : "";

                return `
                    <tr class="${isRowActive ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}">
                        <td class="px-4 py-2.5 font-bold whitespace-nowrap">${safeTahun}${activeBadge}</td>
                        <td class="px-4 py-2.5 text-right font-bold whitespace-nowrap text-stone-900 dark:text-stone-100">${escapeHtml(formatRupiah(item.nilai))}</td>
                        <td class="px-4 py-2.5 text-right whitespace-nowrap">
                            ${
                                isAdmin
                                    ? `<div class="inline-flex items-center gap-1.5">
                                        ${
                                            isRowActive
                                                ? `<span class="px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Tahun Aktif</span>`
                                                : `<button type="button" data-annual-set-active="${safeTahun}" class="px-2.5 py-1 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none cursor-pointer transition">Set Aktif</button>`
                                        }
                                        <button type="button" data-annual-edit="${safeTahun}" class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer">Edit</button>
                                        <button type="button" data-annual-del="${safeTahun}" class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
                                    </div>`
                                    : `<span class="text-[11px] text-stone-400">Hanya baca</span>`
                            }
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    async function loadAnnualSettings() {
        try {
            const snap = await getDoc(ANNUAL_SETTING_DOC_REF());
            if (isDestroyed) return;
            const docData = snap.exists() ? (snap.data() || {}) : {};
            const rawItems = Array.isArray(docData.items) ? docData.items : [];
            const normalizedMap = new Map();
            rawItems.forEach((entry) => {
                const yr = String(entry?.tahun ?? "").trim();
                const val = Number(entry?.nilai);
                if (/^\d{4}$/.test(yr) && Number.isFinite(val) && val > 0) {
                    normalizedMap.set(yr, { tahun: yr, nilai: val });
                }
            });
            annualSettings = Array.from(normalizedMap.values()).sort((a, b) => Number(b.tahun) - Number(a.tahun));

            const rawActive = String(docData.tahunAktif ?? docData.activeYear ?? "").trim();
            if (/^\d{4}$/.test(rawActive)) {
                activeYear = rawActive;
                hasExplicitActiveYear = true;
            } else if (annualSettings.length) {
                activeYear = annualSettings.some((item) => item.tahun === defaultYear)
                    ? defaultYear
                    : annualSettings[0].tahun;
                hasExplicitActiveYear = false;
            } else {
                activeYear = defaultYear;
                hasExplicitActiveYear = false;
            }

            tagihanPage = 1;
            syncActiveYearBadges();
            renderAnnualTable();
            syncTagihanYearOptions(true);
            applyAnnualRateToNominalIfEmpty();
            renderSummaryAndTagihan();
        } catch (err) {
            console.warn("Gagal memuat setting iuran tahunan:", err);
            if (!isDestroyed && annualTbody) {
                annualTbody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-rose-500">Gagal memuat setting iuran tahunan.</td></tr>`;
            }
        }
    }

    async function loadWargaWajib() {
        try {
            const snap = await getDocs(collection(db, COLLECTION_WARGA));
            if (isDestroyed) return;
            const list = [];
            snap.forEach((d) => {
                const data = { id: d.id, ...d.data() };
                if (hasIuranWajibRt(data)) {
                    list.push(data);
                }
            });
            list.sort((a, b) =>
                String(a.nama || "").localeCompare(String(b.nama || ""), "id", { sensitivity: "base" })
            );
            wargaWajibList = list;
            populateWargaDropdown();
            tagihanPage = 1;
            renderSummaryAndTagihan();
        } catch (err) {
            console.warn("Gagal memuat data warga Iuran Wajib RT:", err);
            if (!isDestroyed && tagihanTbodyEl) {
                tagihanTbodyEl.innerHTML = `<tr><td colspan="${colCount}" class="p-6 text-center text-rose-500">Gagal memuat data warga berstatus Iuran Wajib RT.</td></tr>`;
            }
        }
    }

    async function persistAnnualSettings(nextItems, successMsg, nextActiveYear = null) {
        const sorted = [...nextItems].sort((a, b) => Number(b.tahun) - Number(a.tahun));
        const resolvedActiveYear = /^\d{4}$/.test(String(nextActiveYear || ""))
            ? String(nextActiveYear)
            : getEffectiveActiveYear();

        await setDoc(
            ANNUAL_SETTING_DOC_REF(),
            {
                items: sorted,
                tahunAktif: resolvedActiveYear,
                activeYear: resolvedActiveYear,
                updatedAt: new Date().toISOString()
            },
            { merge: true }
        );
        annualSettings = sorted;
        activeYear = resolvedActiveYear;
        hasExplicitActiveYear = true;
        if (nextActiveYear !== null) {
            tagihanPage = 1;
        }
        syncActiveYearBadges();
        renderAnnualTable();
        syncTagihanYearOptions(nextActiveYear !== null);
        renderSummaryAndTagihan();
        if (successMsg) showAnnualFeedback(successMsg);
    }

    function openAnnualModal() {
        hideAnnualFeedback();
        syncActiveYearBadges();
        if (annualTahunInput && !annualTahunInput.value) {
            annualTahunInput.value = getEffectiveActiveYear();
        }
        if (annualNilaiInput) annualNilaiInput.value = "";
        if (annualSaveBtn) annualSaveBtn.disabled = !isAdmin;
        if (annualClearBtn) annualClearBtn.disabled = !isAdmin;
        if (annualTahunInput) annualTahunInput.disabled = !isAdmin;
        if (annualNilaiInput) annualNilaiInput.disabled = !isAdmin;
        if (!isAdmin) {
            showAnnualFeedback("Hanya Administrator yang dapat mengubah setting iuran tahunan.", "error");
        }
        annualModal?.classList.remove("hidden");
        annualModal?.classList.add("flex");
        renderAnnualTable();
        if (isAdmin) annualTahunInput?.focus();
    }

    function closeAnnualModal() {
        annualModal?.classList.add("hidden");
        annualModal?.classList.remove("flex");
        hideAnnualFeedback();
    }

    async function onAnnualSubmit(e) {
        e.preventDefault();
        if (!isAdmin) {
            showAnnualFeedback("Hanya Administrator yang dapat menyimpan setting iuran tahunan.", "error");
            return;
        }
        hideAnnualFeedback();

        const tahunStr = String(annualTahunInput?.value || "").trim();
        const nilaiNum = parseAngkaInput(annualNilaiInput?.value);

        if (!/^\d{4}$/.test(tahunStr) || Number(tahunStr) < 2000 || Number(tahunStr) > 2100) {
            showAnnualFeedback("Masukkan tahun yang valid (contoh: 2026).", "error");
            return;
        }
        if (!Number.isFinite(nilaiNum) || nilaiNum <= 0) {
            showAnnualFeedback("Masukkan nilai iuran tahunan lebih dari 0.", "error");
            return;
        }

        const filtered = annualSettings.filter((item) => String(item.tahun) !== tahunStr);
        filtered.push({ tahun: tahunStr, nilai: nilaiNum });

        const targetActive = !hasExplicitActiveYear && annualSettings.length === 0
            ? tahunStr
            : getEffectiveActiveYear();

        try {
            await persistAnnualSettings(
                filtered,
                `Setting iuran tahun ${tahunStr} (${formatRupiah(nilaiNum)}) tersimpan ke tabel.`,
                targetActive
            );
            if (annualNilaiInput) annualNilaiInput.value = "";
            applyAnnualRateToNominalIfEmpty();
        } catch (err) {
            console.error("Gagal menyimpan setting iuran tahunan:", err);
            showAnnualFeedback("Gagal menyimpan setting iuran tahunan ke Firestore.", "error");
        }
    }

    function computeTagihanRows(selectedYear) {
        const targetTagihan = getAnnualRateForYear(selectedYear);

        return wargaWajibList.map((warga) => {
            const terbayar = sumPaymentsForWargaInYear(warga, selectedYear);
            const sisaTagihan = Math.max(0, targetTagihan - terbayar);
            const isLunas = targetTagihan > 0 ? sisaTagihan === 0 : terbayar > 0 && sisaTagihan === 0;

            return {
                id: warga.id,
                nama: warga.nama || "-",
                nik: warga.nik || "",
                noKk: warga.noKk || "",
                blokLabel: buildBlokLabel(warga),
                targetTagihan,
                terbayar,
                sisaTagihan,
                isLunas
            };
        });
    }

    function getHistoryPaymentsForWarga(warga, selectedYear) {
        if (!warga) return [];
        const chronoWithSnapshot = getChronologicalPaymentsWithSnapshot(warga, selectedYear);
        return chronoWithSnapshot.reverse();
    }

    function sendNotaViaWhatsApp(paymentItem, wargaObj, selectedYear) {
        if (!paymentItem) return;
        const targetTagihan = getAnnualRateForYear(selectedYear);
        const chronoList = wargaObj
            ? getChronologicalPaymentsWithSnapshot(wargaObj, selectedYear)
            : [];
        const matchedSnap = chronoList.find((item) => item.id === paymentItem.id);

        const sisaSaatTransaksi = matchedSnap
            ? matchedSnap.sisaSaatTransaksi
            : Math.max(0, targetTagihan - (Number(paymentItem.nominal) || 0));
        const totalTerbayarSaatTransaksi = matchedSnap
            ? matchedSnap.totalTerbayarSaatTransaksi
            : (Number(paymentItem.nominal) || 0);
        const totalTerbayarTerkini = wargaObj
            ? sumPaymentsForWargaInYear(wargaObj, selectedYear)
            : totalTerbayarSaatTransaksi;
        const sisaTerkini = Math.max(0, targetTagihan - totalTerbayarTerkini);

        const statusSaatTransaksi =
            targetTagihan > 0 && sisaSaatTransaksi === 0 ? "LUNAS" : "SISA TAGIHAN";

        const lines = [
            `*NOTA PEMBAYARAN IURAN WAJIB RT*`,
            `Tahun: *${selectedYear}*`,
            `Warga: *${wargaObj?.nama || paymentItem.namaWarga || "-"}*`,
            (wargaObj && buildBlokLabel(wargaObj)) || paymentItem.blok
                ? `Alamat/Info: ${(wargaObj && buildBlokLabel(wargaObj)) || paymentItem.blok}`
                : "",
            `---------------------------`,
            `Tanggal Bayar: ${formatTanggalDisplay(paymentItem.tanggal)}`,
            `Periode: ${paymentItem.periode || "-"}`,
            `Nominal Bayar: *${formatRupiah(paymentItem.nominal)}*`,
            `Keterangan: ${paymentItem.keterangan || "-"}`,
            `---------------------------`,
            `Info Tagihan Tahunan: ${formatRupiah(targetTagihan)}`,
            `Akumulasi Terbayar Saat Transaksi: ${formatRupiah(totalTerbayarSaatTransaksi)}`,
            `Sisa Saat Transaksi: *${formatRupiah(sisaSaatTransaksi)}*`,
            sisaTerkini !== sisaSaatTransaksi
                ? `Sisa Tagihan Terkini: ${formatRupiah(sisaTerkini)}`
                : "",
            `Status Saat Transaksi: *${statusSaatTransaksi}*`,
            ``,
            `Terima kasih atas pembayaran iuran RT.`
        ].filter((line) => line !== "");

        const phone = extractPhoneFromWarga(wargaObj || {}, paymentItem);
        const encodedText = encodeURIComponent(lines.join("\n"));
        const waUrl = phone
            ? `https://wa.me/${phone}?text=${encodedText}`
            : `https://wa.me/?text=${encodedText}`;

        window.open(waUrl, "_blank", "noopener,noreferrer");
        showFeedback(
            phone
                ? `Membuka WhatsApp untuk mengirim nota ke ${phone} (Sisa saat transaksi: ${formatRupiah(sisaSaatTransaksi)}).`
                : `Membuka WhatsApp—silakan pilih nomor tujuan (Sisa saat transaksi: ${formatRupiah(sisaSaatTransaksi)}).`
        );
    }

    function renderHistoryModal(wargaId, selectedYear) {
        if (isDestroyed || !historyModal || !historyTbodyEl) return;
        const wargaObj = wargaWajibList.find((w) => w.id === wargaId);
        if (!wargaObj) return;

        currentHistoryContext = { wargaId, selectedYear };

        const targetTagihan = getAnnualRateForYear(selectedYear);
        const historyList = getHistoryPaymentsForWarga(wargaObj, selectedYear);
        const totalTerbayar = historyList.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
        const sisaTagihan = Math.max(0, targetTagihan - totalTerbayar);

        if (historyTitleEl) {
            historyTitleEl.textContent = `HISTORI PEMBAYARAN • ${String(wargaObj.nama || "-").toUpperCase()}`;
        }
        if (historySubtitleEl) {
            const identParts = [
                `Tahun ${selectedYear}`,
                wargaObj.nik ? `NIK: ${wargaObj.nik}` : "",
                buildBlokLabel(wargaObj)
            ].filter(Boolean);
            historySubtitleEl.textContent = identParts.join(" • ");
        }
        if (historyTargetEl) historyTargetEl.textContent = formatRupiah(targetTagihan);
        if (historyPaidEl) historyPaidEl.textContent = formatRupiah(totalTerbayar);
        if (historyRemainingEl) historyRemainingEl.textContent = formatRupiah(sisaTagihan);

        const histColCount = isAdmin ? 6 : 5;
        if (!historyList.length) {
            historyTbodyEl.innerHTML = `<tr><td colspan="${histColCount}" class="p-6 text-center text-stone-500 dark:text-stone-400">Belum ada histori pembayaran untuk warga ini pada tahun ${escapeHtml(selectedYear)}.</td></tr>`;
            return;
        }

        historyTbodyEl.innerHTML = historyList
            .map((item, idx) => {
                const badgeClass = item.isLunasSaatTransaksi
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";

                const statusLabel = item.isLunasSaatTransaksi ? "Lunas" : "Belum Lunas";
                const sisaSaatTxClass =
                    item.sisaSaatTransaksi > 0
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-400";

                return `
                    <tr>
                        <td class="px-3 py-2 text-center font-semibold text-stone-500 dark:text-stone-400 whitespace-nowrap">${idx + 1}</td>
                        <td class="px-4 py-2 whitespace-nowrap">
                            <div class="font-semibold">${escapeHtml(formatTanggalDisplay(item.tanggal))}</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400">Periode: ${escapeHtml(item.periode || "-")}</div>
                        </td>
                        <td class="px-4 py-2">${escapeHtml(item.keterangan || "-")}</td>
                        <td class="px-4 py-2 whitespace-nowrap">
                            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${badgeClass}">${escapeHtml(statusLabel)}</span>
                        </td>
                        <td class="px-4 py-2 text-right whitespace-nowrap">
                            <div class="font-bold text-stone-900 dark:text-stone-100">${escapeHtml(formatRupiah(item.nominal))}</div>
                            <div class="text-[11px] font-semibold ${sisaSaatTxClass}">Sisa saat transaksi: ${escapeHtml(formatRupiah(item.sisaSaatTransaksi))}</div>
                        </td>
                        ${
                            isAdmin
                                ? `<td class="px-4 py-2 text-right whitespace-nowrap">
                                    <div class="inline-flex items-center gap-1">
                                        <button type="button" data-mki-hist-wa="${escapeHtml(item.id)}" class="px-2 py-1 text-[11px] font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none cursor-pointer transition" title="Kirim Nota via WA (Sisa Saat Transaksi)">Kirim Nota WA</button>
                                        <button type="button" data-mki-hist-edit="${escapeHtml(item.id)}" class="px-2 py-1 text-[11px] font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer">Edit</button>
                                        <button type="button" data-mki-hist-del="${escapeHtml(item.id)}" class="px-2 py-1 text-[11px] font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
                                    </div>
                                </td>`
                                : ""
                        }
                    </tr>
                `;
            })
            .join("");
    }

    function openHistoryModal(wargaId, selectedYear) {
        renderHistoryModal(wargaId, selectedYear);
        historyModal?.classList.remove("hidden");
        historyModal?.classList.add("flex");
    }

    function closeHistoryModal() {
        historyModal?.classList.add("hidden");
        historyModal?.classList.remove("flex");
        currentHistoryContext = null;
    }

    function updateTagihanPaginationUi(totalFiltered) {
        const totalPages = Math.max(1, Math.ceil(totalFiltered / TAGIHAN_PAGE_SIZE));
        if (tagihanPage > totalPages) tagihanPage = totalPages;
        if (tagihanPage < 1) tagihanPage = 1;

        const startIdx = totalFiltered === 0 ? 0 : (tagihanPage - 1) * TAGIHAN_PAGE_SIZE + 1;
        const endIdx = totalFiltered === 0 ? 0 : Math.min(totalFiltered, tagihanPage * TAGIHAN_PAGE_SIZE);

        if (tagihanPageInfoEl) {
            tagihanPageInfoEl.textContent =
                totalFiltered === 0
                    ? "Menampilkan 0 dari 0 warga"
                    : `Menampilkan ${startIdx}–${endIdx} dari ${totalFiltered} warga (maks. ${TAGIHAN_PAGE_SIZE}/hal)`;
        }
        if (tagihanPageNumEl) {
            tagihanPageNumEl.textContent = `Hal ${tagihanPage} / ${totalPages}`;
        }
        if (tagihanPrevBtn) {
            tagihanPrevBtn.disabled = totalFiltered === 0 || tagihanPage <= 1;
        }
        if (tagihanNextBtn) {
            tagihanNextBtn.disabled = totalFiltered === 0 || tagihanPage >= totalPages;
        }

        return { startIdx, endIdx, totalPages };
    }

    function renderSummaryAndTagihan() {
        if (isDestroyed) return;

        const currentActive = getEffectiveActiveYear();
        const selectedYear = String(tagihanTahunEl?.value || currentActive).trim();
        const targetTagihan = getAnnualRateForYear(selectedYear);
        const allComputed = computeTagihanRows(selectedYear);

        const totalTagihanSemuaWarga = allComputed.reduce((sum, item) => sum + item.targetTagihan, 0);
        const terbayarAkumulasiSemuaWarga = allComputed.reduce((sum, item) => sum + item.terbayar, 0);
        const sisaSaldoSemuaWarga = Math.max(0, totalTagihanSemuaWarga - terbayarAkumulasiSemuaWarga);
        const wargaLunasCount = allComputed.filter((item) => item.isLunas).length;

        const sumLunasEl = document.getElementById("mki-sum-lunas");
        const sumSisaWajibEl = document.getElementById("mki-sum-sisa-wajib");
        const sumBelumEl = document.getElementById("mki-sum-belum");
        const sumCountEl = document.getElementById("mki-sum-count");

        if (sumLunasEl) sumLunasEl.textContent = formatRupiah(totalTagihanSemuaWarga);
        if (sumSisaWajibEl) sumSisaWajibEl.textContent = formatRupiah(terbayarAkumulasiSemuaWarga);
        if (sumBelumEl) sumBelumEl.textContent = formatRupiah(sisaSaldoSemuaWarga);
        if (sumCountEl) sumCountEl.textContent = `${wargaLunasCount} / ${allComputed.length} Warga`;

        if (!tagihanTbodyEl) return;

        if (tagihanSubtitleEl) {
            const activeNote = selectedYear === currentActive ? " (Tahun Aktif)" : ` • Tahun Aktif: ${currentActive}`;
            tagihanSubtitleEl.textContent =
                targetTagihan > 0
                    ? `Tahun ${selectedYear}${activeNote}: Info Tagihan ${formatRupiah(targetTagihan)} per warga berstatus "Iuran Wajib RT" • Sisa Saldo: ${formatRupiah(sisaSaldoSemuaWarga)}`
                    : `Tahun ${selectedYear}${activeNote}: Belum ada tarif di pengaturan/iuran_tahunan • Klik "Setting Iuran Tahunan" untuk mengatur tarif`;
        }

        const filterMode = String(tagihanFilterEl?.value || "").trim().toLowerCase();
        const kw = String(tagihanSearchEl?.value || "").trim().toLowerCase();

        const filtered = allComputed.filter((item) => {
            if (filterMode === "sisa" && item.sisaTagihan <= 0) return false;
            if (filterMode === "lunas" && item.sisaTagihan > 0) return false;
            if (kw) {
                const hay = [item.nama, item.nik, item.noKk, item.blokLabel]
                    .join(" ")
                    .toLowerCase();
                if (!hay.includes(kw)) return false;
            }
            return true;
        });

        if (tagihanBadgeEl) {
            tagihanBadgeEl.textContent = `${filtered.length} / ${allComputed.length} Warga`;
        }

        const { startIdx } = updateTagihanPaginationUi(filtered.length);

        if (!filtered.length) {
            tagihanTbodyEl.innerHTML = `
                <tr>
                    <td colspan="${colCount}" class="p-6 text-center text-stone-500 dark:text-stone-400">
                        ${
                            wargaWajibList.length
                                ? "Tidak ada data tagihan warga yang cocok dengan filter."
                                : 'Belum ada warga dengan status sosial "Iuran Wajib RT".'
                        }
                    </td>
                </tr>
            `;
            return;
        }

        const sliceStart = (tagihanPage - 1) * TAGIHAN_PAGE_SIZE;
        const pageItems = filtered.slice(sliceStart, sliceStart + TAGIHAN_PAGE_SIZE);

        tagihanTbodyEl.innerHTML = pageItems
            .map((item, idx) => {
                const noUrut = startIdx + idx;
                const statusBadge =
                    item.sisaTagihan === 0 && item.targetTagihan > 0
                        ? `<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">Lunas</span>`
                        : `<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">Sisa Tagihan</span>`;

                const sisaClass =
                    item.sisaTagihan > 0
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-400";

                const historiBtn = `<button type="button" data-mki-hist-warga="${escapeHtml(item.id)}" data-mki-hist-tahun="${escapeHtml(selectedYear)}" class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 hover:border-[#c87d32] hover:text-[#c87d32] text-stone-800 dark:text-stone-200 rounded-none cursor-pointer transition">Histori Pembayaran</button>`;

                return `
                    <tr>
                        <td class="px-3 py-2.5 text-center font-semibold text-stone-600 dark:text-stone-400 whitespace-nowrap">${noUrut}</td>
                        <td class="px-4 py-2.5">
                            <div class="font-semibold">${escapeHtml(item.nama)}</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400">
                                ${item.nik ? `NIK: ${escapeHtml(item.nik)}` : ""}${item.blokLabel ? `${item.nik ? " • " : ""}${escapeHtml(item.blokLabel)}` : ""}
                            </div>
                        </td>
                        <td class="px-4 py-2.5 text-right font-semibold whitespace-nowrap">${escapeHtml(formatRupiah(item.targetTagihan))}</td>
                        <td class="px-4 py-2.5 text-right font-semibold whitespace-nowrap text-emerald-700 dark:text-emerald-400">${escapeHtml(formatRupiah(item.terbayar))}</td>
                        <td class="px-4 py-2.5 text-right font-bold whitespace-nowrap ${sisaClass}">${escapeHtml(formatRupiah(item.sisaTagihan))}</td>
                        <td class="px-4 py-2.5 whitespace-nowrap">${statusBadge}</td>
                        ${
                            isAdmin
                                ? `<td class="px-4 py-2.5 text-right whitespace-nowrap">
                                    <div class="inline-flex items-center gap-1.5">
                                        ${historiBtn}
                                        ${
                                            item.sisaTagihan > 0
                                                ? `<button type="button" data-mki-bayar-warga="${escapeHtml(item.id)}" data-mki-bayar-tahun="${escapeHtml(selectedYear)}" class="px-2.5 py-1 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none cursor-pointer transition">Bayar Sisa</button>`
                                                : `<span class="text-[11px] text-stone-400">Tuntas</span>`
                                        }
                                    </div>
                                </td>`
                                : ""
                        }
                    </tr>
                `;
            })
            .join("");

        if (currentHistoryContext) {
            renderHistoryModal(currentHistoryContext.wargaId, currentHistoryContext.selectedYear);
        }
        updateFormSisaInfo();
    }

    function fillForm(item = null) {
        const currentActive = getEffectiveActiveYear();
        const fallbackPeriode = `${currentActive}-${todayIso.slice(5, 7)}`;

        if (editIdEl) editIdEl.value = item?.id || "";
        if (formTitleEl) {
            formTitleEl.textContent = item ? "EDIT DATA IURAN KEUANGAN" : "TAMBAH DATA IURAN KEUANGAN";
        }
        populateWargaDropdown(item?.namaWarga || "");
        if (blokInputEl) blokInputEl.value = item?.blok || "";
        const periodeVal = item?.periode || fallbackPeriode;
        if (periodeInput) periodeInput.value = periodeVal;
        if (nominalInput) {
            if (item?.nominal != null) {
                nominalInput.value = formatRibuanInput(item.nominal);
            } else {
                nominalInput.value = "";
                applyAnnualRateToNominalIfEmpty(periodeVal);
            }
        }
        if (tanggalInputEl) tanggalInputEl.value = item?.tanggal || todayIso;
        if (keteranganInputEl) keteranganInputEl.value = item?.keterangan || "";
        updateFormSisaInfo();
    }

    function openForm(item = null, preset = null) {
        if (!isAdmin) return;
        hideFeedback();
        hideFormFeedback();
        fillForm(item);
        if (!item && preset) {
            if (preset.namaWarga) populateWargaDropdown(preset.namaWarga);
            if (blokInputEl && preset.blok != null) blokInputEl.value = preset.blok;
            if (periodeInput && preset.periode) periodeInput.value = preset.periode;
            if (nominalInput && preset.nominal != null) nominalInput.value = formatRibuanInput(preset.nominal);
            if (keteranganInputEl && preset.keterangan != null) keteranganInputEl.value = preset.keterangan;
            updateFormSisaInfo();
        }
        formModal?.classList.remove("hidden");
        formModal?.classList.add("flex");
        namaSelectEl?.focus();
    }

    function closeForm() {
        formModal?.classList.add("hidden");
        formModal?.classList.remove("flex");
        hideFormFeedback();
        if (editIdEl) editIdEl.value = "";
    }

    async function loadData() {
        try {
            const snap = await getDocs(collection(db, COLLECTION_IURAN));
            if (isDestroyed) return;
            const list = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
            rows = list.sort((a, b) => String(b.tanggal || b.createdAt || "").localeCompare(String(a.tanggal || a.createdAt || "")));
            syncTagihanYearOptions(false);
            renderSummaryAndTagihan();
        } catch (err) {
            console.error("Gagal memuat iuran:", err);
            showFeedback("Gagal memuat data iuran keuangan.", "error");
        }
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!isAdmin) return;
        hideFormFeedback();

        const namaWarga = namaSelectEl?.value.trim() || "";
        const nominal = parseAngkaInput(nominalInput?.value);
        if (!namaWarga || !Number.isFinite(nominal) || nominal <= 0) {
            showFormFeedback("Pilih warga dan isi nominal iuran dengan benar.", "error");
            return;
        }

        const currentActive = getEffectiveActiveYear();
        const fallbackPeriode = `${currentActive}-${todayIso.slice(5, 7)}`;
        const summary = computeFormPaymentSummary();
        const autoStatus = summary.computedStatus === "Lunas" ? "Lunas" : "Belum Lunas";

        const payload = {
            namaWarga,
            blok: blokInputEl?.value.trim() || "",
            periode: periodeInput?.value || fallbackPeriode,
            nominal,
            status: autoStatus,
            tanggal: tanggalInputEl?.value || todayIso,
            keterangan: keteranganInputEl?.value.trim() || "",
            updatedAt: new Date().toISOString()
        };

        try {
            const editId = editIdEl?.value.trim() || "";
            if (editId) {
                await updateDoc(doc(db, COLLECTION_IURAN, editId), payload);
                closeForm();
                await loadData();
                showFeedback(`Data iuran diperbarui (${autoStatus}).`);
            } else {
                await addDoc(collection(db, COLLECTION_IURAN), { ...payload, createdAt: new Date().toISOString() });
                closeForm();
                await loadData();
                showFeedback(`Data iuran ditambahkan (${autoStatus}).`);
            }
        } catch (err) {
            console.error("Gagal simpan iuran:", err);
            showFormFeedback("Gagal menyimpan data iuran keuangan.", "error");
        }
    }

    const onClick = async (e) => {
        const histWargaBtn = e.target.closest("[data-mki-hist-warga]");
        if (histWargaBtn) {
            const wargaId = histWargaBtn.getAttribute("data-mki-hist-warga");
            const yr = histWargaBtn.getAttribute("data-mki-hist-tahun") || tagihanTahunEl?.value || getEffectiveActiveYear();
            if (wargaId) openHistoryModal(wargaId, yr);
            return;
        }

        const histWaBtn = e.target.closest("[data-mki-hist-wa]");
        if (histWaBtn && isAdmin) {
            const payId = histWaBtn.getAttribute("data-mki-hist-wa");
            const foundPay = rows.find((r) => r.id === payId);
            if (foundPay) {
                const yr =
                    currentHistoryContext?.selectedYear ||
                    extractYearFromRecord(foundPay) ||
                    tagihanTahunEl?.value ||
                    getEffectiveActiveYear();
                const wargaObj =
                    wargaWajibList.find((w) => w.id === currentHistoryContext?.wargaId) ||
                    wargaWajibList.find((w) => matchPaymentToWarga(foundPay, w)) ||
                    null;
                sendNotaViaWhatsApp(foundPay, wargaObj, yr);
            }
            return;
        }

        const histEditBtn = e.target.closest("[data-mki-hist-edit]");
        if (histEditBtn && isAdmin) {
            const payId = histEditBtn.getAttribute("data-mki-hist-edit");
            const foundPay = rows.find((r) => r.id === payId);
            if (foundPay) {
                closeHistoryModal();
                openForm(foundPay);
            }
            return;
        }

        const histDelBtn = e.target.closest("[data-mki-hist-del]");
        if (histDelBtn && isAdmin) {
            const payId = histDelBtn.getAttribute("data-mki-hist-del");
            if (!payId || !window.confirm("Hapus transaksi pembayaran ini dari histori?")) return;
            try {
                await deleteDoc(doc(db, COLLECTION_IURAN, payId));
                if (editIdEl?.value === payId) closeForm();
                await loadData();
                showFeedback("Transaksi pembayaran berhasil dihapus.");
            } catch (err) {
                console.error("Gagal hapus transaksi histori:", err);
                showFeedback("Gagal menghapus transaksi pembayaran.", "error");
            }
            return;
        }

        const bayarWargaBtn = e.target.closest("[data-mki-bayar-warga]");
        if (bayarWargaBtn && isAdmin) {
            const wargaId = bayarWargaBtn.getAttribute("data-mki-bayar-warga");
            const yr = bayarWargaBtn.getAttribute("data-mki-bayar-tahun") || tagihanTahunEl?.value || getEffectiveActiveYear();
            const computedList = computeTagihanRows(yr);
            const target = computedList.find((item) => item.id === wargaId);
            if (target) {
                const periodePreset = `${yr}-${todayIso.slice(5, 7)}`;
                openForm(null, {
                    namaWarga: target.nama,
                    blok: target.blokLabel,
                    periode: periodePreset,
                    nominal: target.sisaTagihan > 0 ? target.sisaTagihan : target.targetTagihan,
                    keterangan: `Iuran Wajib RT ${yr}`
                });
            }
            return;
        }

        const setActiveBtn = e.target.closest("[data-annual-set-active]");
        if (setActiveBtn && isAdmin) {
            const yr = String(setActiveBtn.getAttribute("data-annual-set-active") || "").trim();
            if (!/^\d{4}$/.test(yr)) return;
            try {
                await persistAnnualSettings(
                    annualSettings,
                    `Tahun ${yr} ditetapkan sebagai Tahun Aktif.`,
                    yr
                );
            } catch (err) {
                console.error("Gagal menetapkan tahun aktif:", err);
                showAnnualFeedback("Gagal menetapkan tahun aktif ke Firestore.", "error");
            }
            return;
        }

        const annualEditBtn = e.target.closest("[data-annual-edit]");
        if (annualEditBtn && isAdmin) {
            const yr = annualEditBtn.getAttribute("data-annual-edit");
            const found = annualSettings.find((item) => String(item.tahun) === String(yr));
            if (found) {
                hideAnnualFeedback();
                if (annualTahunInput) annualTahunInput.value = found.tahun;
                if (annualNilaiInput) annualNilaiInput.value = formatRibuanInput(found.nilai);
                annualNilaiInput?.focus();
            }
            return;
        }

        const annualDelBtn = e.target.closest("[data-annual-del]");
        if (annualDelBtn && isAdmin) {
            const yr = annualDelBtn.getAttribute("data-annual-del");
            if (!yr || !window.confirm(`Hapus setting iuran tahun ${yr} dari tabel?`)) return;
            const remaining = annualSettings.filter((item) => String(item.tahun) !== String(yr));
            const nextActive = String(activeYear) === String(yr)
                ? (remaining[0]?.tahun || defaultYear)
                : getEffectiveActiveYear();
            try {
                await persistAnnualSettings(
                    remaining,
                    `Setting iuran tahun ${yr} dihapus dari tabel.`,
                    nextActive
                );
            } catch (err) {
                console.error("Gagal menghapus setting iuran tahunan:", err);
                showAnnualFeedback("Gagal menghapus setting iuran tahunan.", "error");
            }
        }
    };

    const onModalBackdropClick = (e) => {
        if (e.target === formModal) {
            closeForm();
        }
        if (e.target === annualModal) {
            closeAnnualModal();
        }
        if (e.target === historyModal) {
            closeHistoryModal();
        }
    };

    const onEscapeKey = (e) => {
        if (e.key === "Escape") {
            if (formModal && !formModal.classList.contains("hidden")) {
                closeForm();
                return;
            }
            if (historyModal && !historyModal.classList.contains("hidden")) {
                closeHistoryModal();
                return;
            }
            if (annualModal && !annualModal.classList.contains("hidden")) {
                closeAnnualModal();
            }
        }
    };

    const onNamaWargaChange = () => {
        const isEditingExisting = Boolean(editIdEl?.value.trim());
        syncWargaSelectionDetails(!isEditingExisting);
    };

    const onBlokInput = () => {
        updateFormSisaInfo();
    };

    const onPeriodeChange = () => {
        applyAnnualRateToNominalIfEmpty(periodeInput?.value || "");
    };

    const onAnnualNilaiInput = () => {
        if (!annualNilaiInput) return;
        annualNilaiInput.value = formatRibuanInput(annualNilaiInput.value);
    };

    const onNominalInput = () => {
        if (!nominalInput) return;
        nominalInput.value = formatRibuanInput(nominalInput.value);
        updateFormSisaInfo();
    };

    const onAnnualClearClick = () => {
        hideAnnualFeedback();
        if (annualTahunInput) annualTahunInput.value = getEffectiveActiveYear();
        if (annualNilaiInput) annualNilaiInput.value = "";
    };

    const onTagihanFilterChange = () => {
        tagihanPage = 1;
        renderSummaryAndTagihan();
    };

    const onTagihanPrevClick = () => {
        if (tagihanPage > 1) {
            tagihanPage -= 1;
            renderSummaryAndTagihan();
        }
    };

    const onTagihanNextClick = () => {
        tagihanPage += 1;
        renderSummaryAndTagihan();
    };

    if (isAdmin) toggleBtn?.classList.remove("hidden");
    closeFeedbackBtn?.addEventListener("click", hideFeedback);
    openAnnualBtn?.addEventListener("click", openAnnualModal);
    closeAnnualBtn?.addEventListener("click", closeAnnualModal);
    closeFormBtn?.addEventListener("click", closeForm);
    closeHistoryBtn?.addEventListener("click", closeHistoryModal);
    formModal?.addEventListener("click", onModalBackdropClick);
    annualModal?.addEventListener("click", onModalBackdropClick);
    historyModal?.addEventListener("click", onModalBackdropClick);
    annualForm?.addEventListener("submit", onAnnualSubmit);
    annualNilaiInput?.addEventListener("input", onAnnualNilaiInput);
    nominalInput?.addEventListener("input", onNominalInput);
    blokInputEl?.addEventListener("input", onBlokInput);
    annualClearBtn?.addEventListener("click", onAnnualClearClick);
    namaSelectEl?.addEventListener("change", onNamaWargaChange);
    periodeInput?.addEventListener("change", onPeriodeChange);
    toggleBtn?.addEventListener("click", () => openForm(null));
    cancelBtn?.addEventListener("click", closeForm);
    resetBtn?.addEventListener("click", () => fillForm(null));
    formEl?.addEventListener("submit", onSubmit);
    tagihanTahunEl?.addEventListener("change", onTagihanFilterChange);
    tagihanFilterEl?.addEventListener("change", onTagihanFilterChange);
    tagihanSearchEl?.addEventListener("input", onTagihanFilterChange);
    tagihanPrevBtn?.addEventListener("click", onTagihanPrevClick);
    tagihanNextBtn?.addEventListener("click", onTagihanNextClick);
    document.addEventListener("click", onClick);
    window.addEventListener("keydown", onEscapeKey);

    loadAnnualSettings();
    loadWargaWajib();
    loadData();

    return () => {
        isDestroyed = true;
        if (feedbackTimer) {
            clearTimeout(feedbackTimer);
            feedbackTimer = null;
        }
        if (formFeedbackTimer) {
            clearTimeout(formFeedbackTimer);
            formFeedbackTimer = null;
        }
        if (annualFeedbackTimer) {
            clearTimeout(annualFeedbackTimer);
            annualFeedbackTimer = null;
        }
        closeFeedbackBtn?.removeEventListener("click", hideFeedback);
        openAnnualBtn?.removeEventListener("click", openAnnualModal);
        closeAnnualBtn?.removeEventListener("click", closeAnnualModal);
        closeFormBtn?.removeEventListener("click", closeForm);
        closeHistoryBtn?.removeEventListener("click", closeHistoryModal);
        formModal?.removeEventListener("click", onModalBackdropClick);
        annualModal?.removeEventListener("click", onModalBackdropClick);
        historyModal?.removeEventListener("click", onModalBackdropClick);
        annualForm?.removeEventListener("submit", onAnnualSubmit);
        annualNilaiInput?.removeEventListener("input", onAnnualNilaiInput);
        nominalInput?.removeEventListener("input", onNominalInput);
        blokInputEl?.removeEventListener("input", onBlokInput);
        annualClearBtn?.removeEventListener("click", onAnnualClearClick);
        namaSelectEl?.removeEventListener("change", onNamaWargaChange);
        periodeInput?.removeEventListener("change", onPeriodeChange);
        formEl?.removeEventListener("submit", onSubmit);
        tagihanTahunEl?.removeEventListener("change", onTagihanFilterChange);
        tagihanFilterEl?.removeEventListener("change", onTagihanFilterChange);
        tagihanSearchEl?.removeEventListener("input", onTagihanFilterChange);
        tagihanPrevBtn?.removeEventListener("click", onTagihanPrevClick);
        tagihanNextBtn?.removeEventListener("click", onTagihanNextClick);
        document.removeEventListener("click", onClick);
        window.removeEventListener("keydown", onEscapeKey);
    };
}