// File: assets/js/views/manajemen-adminitrasi-kehadiran.js
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_ABSENSI = "absensi";
const COLLECTION_KATEGORI = "kategori_rapat_rt";
const DEFAULT_KATEGORI = [
    "Rapat Rutin RT",
    "Rapat Koordinasi Pengurus",
    "Rapat Kerja Bakti & Lingkungan",
    "Rapat Keamanan / Ronda"
];
const LOCAL_ABSENSI_CACHE_KEY = "rtku_absensi_local_v1";
const FEEDBACK_AUTO_HIDE_MS = 3500;

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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

function isKepalaKeluarga(data = {}) {
    const candidates = [
        data.statusHubungan,
        data.status_hubungan,
        data.statusKeluarga,
        data.status_keluarga,
        data.statusDalamKeluarga,
        data.status_dalam_keluarga,
        data.hubungan,
        data.hubunganKeluarga,
        data.hubungan_keluarga,
        data.shdk,
        data.status
    ];

    return candidates.some((val) => {
        const clean = String(val || "").trim().toLowerCase();
        return clean === "kepala keluarga" || clean === "kk";
    });
}

function getCurrentWaktuJamMenit() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function readLocalCache() {
    try {
        const raw = sessionStorage.getItem(LOCAL_ABSENSI_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function appendLocalCache(entry) {
    try {
        const cur = readLocalCache();
        cur.unshift(entry);
        sessionStorage.setItem(LOCAL_ABSENSI_CACHE_KEY, JSON.stringify(cur.slice(0, 200)));
    } catch {
        // Abaikan error cache
    }
}

function removeLocalCacheById(id) {
    try {
        const cur = readLocalCache().filter((r) => r.id !== id);
        sessionStorage.setItem(LOCAL_ABSENSI_CACHE_KEY, JSON.stringify(cur));
    } catch {
        // Abaikan error cache
    }
}

function parseQrPayloadParts(rawPayload = "", fallbackTanggal = "", fallbackAcara = "") {
    const clean = String(rawPayload || "").trim();
    const parts = clean ? clean.split("|").map((p) => p.trim()) : [];
    const tanggal = (parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0]) ? parts[0] : "") || String(fallbackTanggal || "").trim();
    const acara = (parts[2] || parts[1] || "").trim() || String(fallbackAcara || "").trim() || "Rapat Rutin RT";
    const qrPayload = clean || `${tanggal || new Date().toISOString().slice(0, 10)}|${acara}`;
    return { tanggal, acara, qrPayload };
}

function extractAbsensiAcaraInfo(row = {}) {
    const rawQr = String(
        row.qrPayload || row.qr_payload || row.kodeQr || row.kode_qr || row.qrText || row.qr_text || row.rawQr || row.payload || ""
    ).trim();

    const explicitAcara = String(
        row.acara || row.namaAcara || row.nama_acara || row.kategoriRapat || row.kategori_rapat || row.kategori || row.kegiatan || row.namaKegiatan || row.nama_kegiatan || row.agenda || ""
    ).trim();

    const parsed = parseQrPayloadParts(rawQr, row.tanggal || "", explicitAcara);
    const acara = explicitAcara || parsed.acara || "Rapat Rutin RT";
    const qrPayload = rawQr || (row.tanggal ? `${String(row.tanggal).trim()}|${acara}` : "");
    return { acara, qrPayload };
}

function normalizeTextKey(val = "") {
    return String(val ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildAbsensiDuplicateKey(row = {}) {
    const { acara, qrPayload } = extractAbsensiAcaraInfo(row);
    const tanggalKey = normalizeTextKey(row.tanggal || new Date().toISOString().slice(0, 10));
    const acaraKey = normalizeTextKey(qrPayload || acara || "rapat rutin rt");
    const namaKey = normalizeTextKey(row.namaWarga || row.nama_warga || row.nama || row.nama_lengkap || "");
    const kodeKey = normalizeTextKey(row.kodeWarga || row.kode_warga || row.kode || row.nik || row.noKk || row.no_kk || row.wargaId || row.warga_id || "");
    const identitasKey = kodeKey && namaKey ? `${kodeKey}::${namaKey}` : (kodeKey || namaKey);
    if (!identitasKey) return "";
    return `${tanggalKey}|${acaraKey}|${identitasKey}`;
}

export function isDuplicateAbsensiRecord(candidate = {}, existingRows = [], ignoreId = "") {
    const candKey = buildAbsensiDuplicateKey(candidate);
    if (!candKey) return false;
    const cleanIgnore = String(ignoreId || "").trim();
    return (existingRows || []).some((row) => {
        if (!row) return false;
        if (cleanIgnore && String(row.id || "").trim() === cleanIgnore) return false;
        return buildAbsensiDuplicateKey(row) === candKey;
    });
}

function dedupeAbsensiRows(rows = []) {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
        if (!r) continue;
        const key = buildAbsensiDuplicateKey(r);
        if (key) {
            if (seen.has(key)) continue;
            seen.add(key);
        }
        out.push(r);
    }
    return out;
}

export function renderManajemenAdministrasiKehadiran() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const katOptions = DEFAULT_KATEGORI
        .map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`)
        .join("");

    return `
        <div class="space-y-5">
            <div
                id="mah-feedback"
                role="status"
                aria-live="polite"
                class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-md transition-opacity duration-300"
            ></div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Administrasi • Kehadiran Warga
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Lihat hasil absensi rapat &amp; input manual kepala keluarga tanpa HP (cegah input ganda &amp; scan ganda).
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        id="mah-toggle-form-btn"
                        class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <span>+ Input Manual</span>
                    </button>
                    <a
                        href="#/manajemen/administrasi"
                        data-link
                        class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                        <span>Kembali</span>
                    </a>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Absensi</div>
                    <div id="mah-sum-total" class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0 Tercatat</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Hadir</div>
                    <div id="mah-sum-hadir" class="text-base md:text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">0 Warga</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Izin / Sakit</div>
                    <div id="mah-sum-izin" class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0 Warga</div>
                </div>
            </div>

            <div id="mah-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="mah-form" class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h2 class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            INPUT ABSENSI MANUAL KEPALA KELUARGA (TANPA HP)
                        </h2>
                        <button type="button" id="mah-cancel-btn" class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer">
                            Tutup Form
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="md:col-span-2">
                            <label for="mah-warga-picker" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Pilih Kepala Keluarga Terdaftar (Warga Tanpa HP)
                            </label>
                            <select id="mah-warga-picker" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                <option value="">-- Pilih Kepala Keluarga atau ketik manual --</option>
                            </select>
                        </div>
                        <div>
                            <label for="mah-kode" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Kode / NIK / No. KK</label>
                            <input type="text" id="mah-kode" placeholder="Contoh: 1234567890123400" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mah-nama" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Nama Kepala Keluarga <span class="text-rose-500">*</span></label>
                            <input type="text" id="mah-nama" required placeholder="Nama kepala keluarga" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mah-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Tanggal</label>
                            <input type="date" id="mah-tanggal" value="${escapeHtml(todayIso)}" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mah-waktu" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Waktu</label>
                            <input type="text" id="mah-waktu" value="${escapeHtml(getCurrentWaktuJamMenit())}" placeholder="Contoh: 19:30" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mah-acara" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Acara / Kategori Rapat</label>
                            <select id="mah-acara" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                ${katOptions}
                            </select>
                        </div>
                        <div>
                            <label for="mah-status" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Status Kehadiran</label>
                            <select id="mah-status" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                <option value="Hadir">Hadir</option>
                                <option value="Izin">Izin</option>
                                <option value="Sakit">Sakit</option>
                            </select>
                        </div>
                        <div class="md:col-span-4">
                            <label for="mah-keterangan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Keterangan</label>
                            <input type="text" id="mah-keterangan" value="Input manual petugas (tanpa HP)" placeholder="Catatan tambahan kehadiran" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <button type="button" id="mah-reset-btn" class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer">
                            Bersihkan
                        </button>
                        <button type="submit" class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">
                            Simpan Absensi
                        </button>
                    </div>
                </form>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <input type="date" id="mah-filter-tanggal" class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                    <select id="mah-filter-status" class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        <option value="">Semua Status Kehadiran</option>
                        <option value="Hadir">Hadir</option>
                        <option value="Izin">Izin</option>
                        <option value="Sakit">Sakit</option>
                    </select>
                    <span id="mah-total-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Data
                    </span>
                </div>
                <div class="w-full sm:w-72">
                    <input type="text" id="mah-search" placeholder="Cari nama, acara, kode QR, atau keterangan..." class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                </div>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead id="mah-thead" class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300"></thead>
                    <tbody id="mah-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr><td colspan="4" class="p-8 text-center text-stone-500 dark:text-stone-400">Memuat data kehadiran...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenAdministrasiKehadiranHandler() {
    let rows = [];
    let wargaMaster = [];
    let isDestroyed = false;
    let feedbackTimer = null;
    const isAdmin = getCurrentUserRole() === "administrator";
    const todayIso = new Date().toISOString().slice(0, 10);

    const feedbackEl = document.getElementById("mah-feedback");
    const toggleBtn = document.getElementById("mah-toggle-form-btn");
    const formPanel = document.getElementById("mah-form-panel");
    const formEl = document.getElementById("mah-form");
    const cancelBtn = document.getElementById("mah-cancel-btn");
    const resetBtn = document.getElementById("mah-reset-btn");
    const pickerEl = document.getElementById("mah-warga-picker");
    const filterTanggalEl = document.getElementById("mah-filter-tanggal");
    const filterStatusEl = document.getElementById("mah-filter-status");
    const searchEl = document.getElementById("mah-search");
    const totalBadgeEl = document.getElementById("mah-total-badge");
    const theadEl = document.getElementById("mah-thead");
    const tbodyEl = document.getElementById("mah-tbody");

    function clearFeedbackTimer() {
        if (feedbackTimer !== null) {
            window.clearTimeout(feedbackTimer);
            feedbackTimer = null;
        }
    }

    function showFeedback(msg, type = "success") {
        if (!feedbackEl || isDestroyed) return;
        clearFeedbackTimer();
        feedbackEl.className =
            type === "error"
                ? "fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-md transition-opacity duration-300 opacity-100 bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                : "fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-md transition-opacity duration-300 opacity-100 bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200";
        feedbackEl.textContent = msg;
        feedbackEl.classList.remove("hidden");
        feedbackTimer = window.setTimeout(() => {
            if (!isDestroyed && feedbackEl) feedbackEl.classList.add("hidden");
        }, FEEDBACK_AUTO_HIDE_MS);
    }

    function getStatusBadgeClass(status = "") {
        const val = String(status).toLowerCase();
        if (val === "hadir") return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
        if (val === "sakit") return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
        return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }

    function resetForm() {
        if (pickerEl) pickerEl.value = "";
        document.getElementById("mah-kode").value = "";
        document.getElementById("mah-nama").value = "";
        document.getElementById("mah-tanggal").value = todayIso;
        document.getElementById("mah-waktu").value = getCurrentWaktuJamMenit();
        document.getElementById("mah-status").value = "Hadir";
        document.getElementById("mah-keterangan").value = "Input manual petugas (tanpa HP)";
    }

    function render() {
        if (isDestroyed || !theadEl || !tbodyEl) return;

        const hadir = rows.filter((a) => String(a.status || "Hadir").toLowerCase() === "hadir").length;
        const izinSakit = rows.filter((a) => {
            const st = String(a.status || "").toLowerCase();
            return st === "izin" || st === "sakit";
        }).length;
        document.getElementById("mah-sum-total").textContent = `${rows.length} Tercatat`;
        document.getElementById("mah-sum-hadir").textContent = `${hadir} Warga`;
        document.getElementById("mah-sum-izin").textContent = `${izinSakit} Warga`;

        const tglFilter = String(filterTanggalEl?.value || "").trim();
        const stFilter = String(filterStatusEl?.value || "").trim().toLowerCase();
        const kw = String(searchEl?.value || "").trim().toLowerCase();

        const filtered = rows.filter((r) => {
            if (tglFilter && String(r.tanggal || "").trim() !== tglFilter) return false;
            if (stFilter && String(r.status || "").toLowerCase() !== stFilter) return false;
            if (kw) {
                const { acara, qrPayload } = extractAbsensiAcaraInfo(r);
                const text = `${Object.values(r).join(" ")} ${acara} ${qrPayload}`.toLowerCase();
                if (!text.includes(kw)) return false;
            }
            return true;
        });

        if (totalBadgeEl) totalBadgeEl.textContent = `${filtered.length} Data`;

        theadEl.innerHTML = `
            <tr>
                <th class="px-4 py-3">Tanggal &amp; Waktu</th>
                <th class="px-4 py-3">Kepala Keluarga, Acara &amp; Keterangan</th>
                <th class="px-4 py-3">Status &amp; Metode</th>
                ${isAdmin ? `<th class="px-4 py-3 text-right">Aksi</th>` : ""}
            </tr>
        `;

        if (!filtered.length) {
            tbodyEl.innerHTML = `<tr><td colspan="${isAdmin ? 4 : 3}" class="p-8 text-center text-stone-500 dark:text-stone-400">Belum ada data kehadiran.</td></tr>`;
            return;
        }

        tbodyEl.innerHTML = filtered
            .map((r) => {
                const namaWarga = r.namaWarga || r.nama_warga || r.nama || r.kodeWarga || "-";
                const kodeWarga = r.kodeWarga || r.kode_warga || r.kode || "";
                const { acara, qrPayload } = extractAbsensiAcaraInfo(r);
                const ket = r.keterangan || r.catatan || "";
                const metode = r.metode || "Scan QR";
                const st = r.status || "Hadir";

                return `
                    <tr>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <div class="font-semibold">${escapeHtml(formatTanggalDisplay(r.tanggal))}</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400">${escapeHtml(r.waktu || "-")}</div>
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="font-semibold">${escapeHtml(namaWarga)}</span>
                                <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#f6f3ec] dark:bg-stone-800 text-[#4a5a3f] dark:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-none">
                                    Acara: ${escapeHtml(acara)}
                                </span>
                            </div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                ${kodeWarga ? `Kode: ${escapeHtml(kodeWarga)}` : ""}
                                ${qrPayload ? `${kodeWarga ? " • " : ""}QR: <span class="font-mono">${escapeHtml(qrPayload)}</span>` : ""}
                                ${ket ? `${kodeWarga || qrPayload ? " • " : ""}Ket: ${escapeHtml(ket)}` : ""}
                            </div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${getStatusBadgeClass(st)}">${escapeHtml(st)}</span>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">${escapeHtml(metode)}</div>
                        </td>
                        ${
                            isAdmin
                                ? `<td class="px-4 py-3 text-right whitespace-nowrap">
                                    <button type="button" data-mah-del="${escapeHtml(r.id)}" class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
                                </td>`
                                : ""
                        }
                    </tr>
                `;
            })
            .join("");
    }

    async function loadData() {
        try {
            const [hadirSnap, katSnap, wargaSnap] = await Promise.allSettled([
                getDocs(collection(db, COLLECTION_ABSENSI)),
                getDocs(collection(db, COLLECTION_KATEGORI)),
                getDocs(collection(db, "warga"))
            ]);
            if (isDestroyed) return;

            const hadirMap = new Map();
            if (hadirSnap.status === "fulfilled") {
                hadirSnap.value.forEach((d) => hadirMap.set(d.id, { id: d.id, ...d.data() }));
            }
            readLocalCache().forEach((r, idx) => {
                const key = r.id || `local_${idx}`;
                if (!hadirMap.has(key)) hadirMap.set(key, { id: key, ...r });
            });

            const sorted = Array.from(hadirMap.values()).sort((a, b) =>
                String(b.createdAt || `${b.tanggal || ""}T${b.waktu || ""}`).localeCompare(
                    String(a.createdAt || `${a.tanggal || ""}T${a.waktu || ""}`)
                )
            );
            rows = dedupeAbsensiRows(sorted);

            if (wargaSnap.status === "fulfilled") {
                const kk = [];
                wargaSnap.value.forEach((d) => {
                    const data = d.data() || {};
                    if (!isKepalaKeluarga(data)) return;
                    const nama = String(data.nama || data.namaWarga || data.nama_warga || data.nama_lengkap || "").trim();
                    const kode = String(data.kode || data.kodeWarga || data.kode_warga || data.nik || d.id || "").trim();
                    if (nama || kode) kk.push({ id: d.id, kode: kode || d.id, nama: nama || kode });
                });
                wargaMaster = kk;
                if (pickerEl) {
                    const opts = wargaMaster.map((w, i) => `<option value="${i}">${escapeHtml(`${w.kode} - ${w.nama}`)}</option>`);
                    pickerEl.innerHTML = `<option value="">-- Pilih Kepala Keluarga atau ketik manual --</option>${opts.join("")}`;
                }
            }

            const acaraSelect = document.getElementById("mah-acara");
            const names = [...DEFAULT_KATEGORI];
            if (katSnap.status === "fulfilled") {
                katSnap.value.forEach((d) => {
                    const nm = String(d.data()?.nama || d.data()?.kategori || "").trim();
                    if (nm && !names.some((x) => x.toLowerCase() === nm.toLowerCase())) names.push(nm);
                });
            }
            if (acaraSelect) {
                const cur = acaraSelect.value;
                acaraSelect.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
                if (names.includes(cur)) acaraSelect.value = cur;
            }

            render();
        } catch (err) {
            console.error("Gagal memuat kehadiran:", err);
            showFeedback("Gagal memuat data kehadiran.", "error");
        }
    }

    async function onSubmit(e) {
        e.preventDefault();
        const namaWarga = document.getElementById("mah-nama")?.value.trim() || "";
        if (!namaWarga) {
            showFeedback("Nama kepala keluarga wajib diisi.", "error");
            return;
        }

        const kodeWarga = document.getElementById("mah-kode")?.value.trim() || "";
        const tanggal = document.getElementById("mah-tanggal")?.value || todayIso;
        const waktu = document.getElementById("mah-waktu")?.value.trim() || getCurrentWaktuJamMenit();
        const acara = document.getElementById("mah-acara")?.value.trim() || "Rapat Rutin RT";
        const status = document.getElementById("mah-status")?.value || "Hadir";
        const keterangan = document.getElementById("mah-keterangan")?.value.trim() || "Input manual petugas (tanpa HP)";
        const qrPayload = `${tanggal}|${acara}`;

        const payload = {
            kodeWarga,
            namaWarga,
            statusKeluarga: "Kepala Keluarga",
            tanggal,
            waktu,
            acara,
            kategoriRapat: acara,
            qrPayload,
            status,
            keterangan,
            metode: "Input Manual Petugas",
            updatedAt: new Date().toISOString()
        };

        if (isDuplicateAbsensiRecord(payload, rows)) {
            showFeedback(`${namaWarga} sudah tercatat absen untuk acara "${acara}" pada ${formatTanggalDisplay(tanggal)}.`, "error");
            return;
        }

        try {
            await addDoc(collection(db, COLLECTION_ABSENSI), { ...payload, createdAt: new Date().toISOString() });
            showFeedback(`Absensi manual ${namaWarga} (${acara}) berhasil dicatat.`);
            formPanel?.classList.add("hidden");
            resetForm();
            await loadData();
        } catch {
            const localEntry = { id: `local_${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
            appendLocalCache(localEntry);
            rows = dedupeAbsensiRows([localEntry, ...rows]);
            formPanel?.classList.add("hidden");
            resetForm();
            render();
            showFeedback(`Absensi manual ${namaWarga} (${acara}) tersimpan di sesi lokal.`);
        }
    }

    pickerEl?.addEventListener("change", () => {
        const idx = Number(pickerEl.value);
        if (Number.isInteger(idx) && idx >= 0 && wargaMaster[idx]) {
            document.getElementById("mah-nama").value = wargaMaster[idx].nama;
            document.getElementById("mah-kode").value = wargaMaster[idx].kode;
        }
    });

    const onClick = async (e) => {
        const delBtn = e.target.closest("[data-mah-del]");
        if (delBtn && isAdmin) {
            const id = delBtn.getAttribute("data-mah-del");
            if (!id || !window.confirm("Hapus data kehadiran ini?")) return;
            try {
                if (String(id).startsWith("local_")) removeLocalCacheById(id);
                else await deleteDoc(doc(db, COLLECTION_ABSENSI, id));
                showFeedback("Data kehadiran berhasil dihapus.");
                await loadData();
            } catch (err) {
                console.error("Gagal hapus kehadiran:", err);
                showFeedback("Gagal menghapus data kehadiran.", "error");
            }
        }
    };

    toggleBtn?.addEventListener("click", () => {
        formPanel?.classList.toggle("hidden");
        if (!formPanel?.classList.contains("hidden")) {
            resetForm();
            document.getElementById("mah-nama")?.focus();
        }
    });
    cancelBtn?.addEventListener("click", () => formPanel?.classList.add("hidden"));
    resetBtn?.addEventListener("click", resetForm);
    formEl?.addEventListener("submit", onSubmit);
    filterTanggalEl?.addEventListener("change", render);
    filterStatusEl?.addEventListener("change", render);
    searchEl?.addEventListener("input", render);
    document.addEventListener("click", onClick);

    loadData();

    return () => {
        isDestroyed = true;
        clearFeedbackTimer();
        formEl?.removeEventListener("submit", onSubmit);
        filterTanggalEl?.removeEventListener("change", render);
        filterStatusEl?.removeEventListener("change", render);
        searchEl?.removeEventListener("input", render);
        document.removeEventListener("click", onClick);
    };
}