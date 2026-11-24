// File: assets/js/views/kas-layanan.js
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth } from "../firebase-init.js";

const IURAN_COLLECTION = "iuran_warga";
const WARGA_COLLECTION = "warga";
const DEFAULT_IMG = "assets/icons/Logo.png";
const DEFAULT_WA_NUMBER = "6289602510491";
const PROFILE_CACHE_KEY = "bumkal_profil_cache_v1";

function isSafeImageSrc(src = "") {
    const val = String(src || "").trim();
    if (!val || val === "null" || val === "undefined") return false;
    return (
        val.startsWith("https://") ||
        val.startsWith("http://") ||
        val.startsWith("assets/") ||
        val.startsWith("./") ||
        val.startsWith("/") ||
        val.startsWith("data:image/")
    );
}

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function parseAmount(rawVal) {
    if (typeof rawVal === "number") {
        return Number.isFinite(rawVal) ? rawVal : 0;
    }
    if (typeof rawVal === "string") {
        const cleaned = rawVal.replace(/[^\d.-]/g, "");
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : 0;
    }
    return 0;
}

function formatRupiah(amount = 0) {
    const num = parseAmount(amount);
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

function normalizeWaDigits(rawPhone = "") {
    let digits = String(rawPhone || "").replace(/\D/g, "");
    if (!digits) digits = DEFAULT_WA_NUMBER;
    if (digits.startsWith("0")) {
        digits = "62" + digits.slice(1);
    }
    return digits;
}

function formatWhatsAppUrl(rawPhone = "", brandName = "RTKu Digital", customMessage = "") {
    const digits = normalizeWaDigits(rawPhone);
    const msg = encodeURIComponent(
        customMessage || `Halo ${brandName}, saya ingin menanyakan informasi kas dan layanan RT.`
    );
    return `https://wa.me/${digits}?text=${msg}`;
}

function readCachedProfile() {
    try {
        const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

function writeCachedProfile(profileData) {
    try {
        sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileData));
    } catch {
        // Abaikan jika storage tidak tersedia
    }
}

function normalizeProfileData(p = {}) {
    const nama = String(p.nama || "RTKu Digital").trim() || "RTKu Digital";
    const alamat = String(p.alamat || p.alamat_lengkap || "Santan-Tulung, Srihardono, Pundong, Bantul, Indonesia").trim() || "Santan-Tulung, Srihardono, Pundong, Bantul, Indonesia";
    const telp = String(p.telepon || p.telp || p.no_hp || p.wa || "089602510491").trim() || "089602510491";
    const email = String(p.email || "bumkalsri@gmail.com").trim() || "bumkalsri@gmail.com";
    const rawIcon = String(p.iconUrl || p.logo || "").trim();
    const iconUrl = isSafeImageSrc(rawIcon) ? rawIcon : DEFAULT_IMG;

    return { nama, alamat, telp, email, iconUrl };
}

function setSmoothImageSrc(imgEl, targetSrc, fallbackSrc = DEFAULT_IMG) {
    if (!imgEl) return;
    const validSrc = isSafeImageSrc(targetSrc) ? targetSrc : fallbackSrc;
    if (!validSrc) return;

    const currentAttrSrc = imgEl.getAttribute("src") || "";
    if (currentAttrSrc === validSrc && imgEl.complete && imgEl.naturalWidth > 0) {
        imgEl.classList.remove("opacity-0");
        imgEl.classList.add("opacity-100");
        return;
    }

    imgEl.classList.remove("opacity-100");
    imgEl.classList.add("opacity-0");

    const reveal = () => {
        imgEl.classList.remove("opacity-0");
        imgEl.classList.add("opacity-100");
    };

    imgEl.onload = reveal;
    imgEl.onerror = () => {
        if (validSrc !== fallbackSrc && fallbackSrc) {
            imgEl.onerror = reveal;
            imgEl.src = fallbackSrc;
        } else {
            reveal();
        }
    };
    imgEl.src = validSrc;
    if (imgEl.complete && imgEl.naturalWidth > 0) {
        reveal();
    }
}

function applyProfileToDom(profile) {
    const nama = profile.nama || "RTKu Digital";
    const pubBrand = document.getElementById("global-public-brand");
    const pubLogo = document.getElementById("global-public-logo");
    const pubBooking = document.getElementById("global-public-booking-btn");
    const fPhone = document.getElementById("global-footer-phone") || document.getElementById("footer-phone");
    const fEmail = document.getElementById("global-footer-email") || document.getElementById("footer-email");
    const fAddr = document.getElementById("global-footer-address") || document.getElementById("footer-address");
    const fBrand = document.getElementById("global-footer-brand") || document.getElementById("footer-brand");

    if (pubBrand && pubBrand.textContent !== nama) pubBrand.textContent = nama;
    if (pubLogo && profile.iconUrl) setSmoothImageSrc(pubLogo, profile.iconUrl, DEFAULT_IMG);
    if (pubBooking) {
        pubBooking.href = formatWhatsAppUrl(profile.telp, nama);
    }
    if (fPhone && fPhone.textContent !== profile.telp) fPhone.textContent = profile.telp;
    if (fEmail && fEmail.textContent !== profile.email) fEmail.textContent = profile.email;
    if (fAddr && fAddr.textContent !== profile.alamat) fAddr.textContent = profile.alamat;
    if (fBrand && fBrand.textContent !== nama) fBrand.textContent = nama;

    if (typeof window.syncGlobalPublicUserAvatar === "function") {
        window.syncGlobalPublicUserAvatar();
    }
}

function isLunas(status = "") {
    const s = String(status || "").trim().toLowerCase();
    return s === "lunas" || s === "paid" || s === "terbayar";
}

function hasIuranWajibRt(warga = {}) {
    const list = Array.isArray(warga.statusSosial) ? warga.statusSosial : [];
    return list.some((st) => String(st || "").trim().toLowerCase() === "iuran wajib rt");
}

function extractEntryDateTimeValue(rawVal) {
    if (!rawVal) return "";
    if (typeof rawVal === "object" && typeof rawVal.toDate === "function") {
        const dt = rawVal.toDate();
        return Number.isNaN(dt.getTime()) ? "" : dt.toISOString();
    }
    if (typeof rawVal === "object" && typeof rawVal.seconds === "number") {
        const dt = new Date(rawVal.seconds * 1000);
        return Number.isNaN(dt.getTime()) ? "" : dt.toISOString();
    }
    return String(rawVal || "").trim();
}

function getEntrySortKey(item = {}) {
    const createdAt = extractEntryDateTimeValue(item.createdAt);
    const tanggal = extractEntryDateTimeValue(item.tanggal);

    if (createdAt) {
        const parsedCreated = new Date(createdAt);
        if (!Number.isNaN(parsedCreated.getTime())) {
            return parsedCreated.toISOString();
        }
        return createdAt;
    }

    if (tanggal) {
        const parsedDate = new Date(tanggal);
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
        }
        return tanggal;
    }

    return String(item.periode || "");
}

function formatEntryDateTimeDisplay(item = {}) {
    const createdAt = extractEntryDateTimeValue(item.createdAt);
    const tanggal = extractEntryDateTimeValue(item.tanggal);

    if (createdAt) {
        const parsed = new Date(createdAt);
        if (!Number.isNaN(parsed.getTime())) {
            const hasTimePart = /T\d{2}:\d{2}|\d{1,2}:\d{2}/.test(createdAt);
            const tglStr = createdAt.slice(0, 10);
            if (hasTimePart) {
                const jamStr = parsed.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                });
                return `${tglStr} ${jamStr}`;
            }
            return tglStr;
        }
    }

    if (tanggal) {
        return tanggal.slice(0, 10);
    }

    return "-";
}

function compareHistoryAsc(a, b) {
    const keyA = getEntrySortKey(a).toLowerCase();
    const keyB = getEntrySortKey(b).toLowerCase();
    if (keyA !== keyB) {
        return keyA.localeCompare(keyB, "id", { sensitivity: "base" });
    }
    const perA = String(a.periode || "").toLowerCase();
    const perB = String(b.periode || "").toLowerCase();
    if (perA !== perB) {
        return perA.localeCompare(perB, "id", { sensitivity: "base" });
    }
    const ketA = String(a.keterangan || "").toLowerCase();
    const ketB = String(b.keterangan || "").toLowerCase();
    return ketA.localeCompare(ketB, "id", { sensitivity: "base" });
}

function getLoggedInAccountInfo() {
    const currentUser = auth.currentUser;
    const email = String(
        currentUser?.email ||
        localStorage.getItem("user_email") ||
        ""
    ).trim().toLowerCase();

    const nama = String(
        localStorage.getItem("user_name") ||
        currentUser?.displayName ||
        (email ? email.split("@")[0] : "") ||
        ""
    ).trim();

    const uid = String(currentUser?.uid || localStorage.getItem("user_uid") || "").trim();

    return { email, nama, uid };
}

function extractWargaEmail(warga = {}) {
    return String(
        warga.email ||
        warga.alamatEmail ||
        warga.emailWarga ||
        warga.email_warga ||
        ""
    ).trim().toLowerCase();
}

function extractWargaNama(warga = {}) {
    return String(
        warga.nama ||
        warga.namaLengkap ||
        warga.nama_lengkap ||
        warga.namaWarga ||
        ""
    ).trim().toLowerCase();
}

function matchItemToLoggedInAccount(item = {}, account = {}, matchedWargaNames = new Set()) {
    const accEmail = String(account.email || "").trim().toLowerCase();
    const accNama = String(account.nama || "").trim().toLowerCase();
    const accUid = String(account.uid || "").trim();

    if (!accEmail && !accNama && !accUid) return false;

    const itemEmail = String(item.email || "").trim().toLowerCase();
    if (accEmail && itemEmail && itemEmail === accEmail) {
        return true;
    }

    const itemUid = String(item.uid || "").trim();
    if (accUid && itemUid && itemUid === accUid) {
        return true;
    }

    const itemNama = String(item.namaWarga || item.nama || "").trim().toLowerCase();
    if (!itemNama) return false;

    if (matchedWargaNames.size > 0 && matchedWargaNames.has(itemNama)) {
        return true;
    }

    if (accNama && itemNama === accNama) {
        return true;
    }

    return false;
}

const LAYANAN_WARGA_ITEMS = [
    {
        kode: "SURAT-PENGANTAR",
        kategori: "Administrasi",
        judul: "Surat Pengantar RT",
        deskripsi: "Pengantar domisili, SKCK, nikah, keterangan usaha, atau keperluan administrasi kelurahan.",
        syarat: "KK/KTP warga setempat & keperluan surat",
        templateWa: "Permohonan Surat Pengantar RT"
    },
    {
        kode: "PENDUDUKAN",
        kategori: "Kependudukan",
        judul: "Lapor Warga / Mutasi KK",
        deskripsi: "Pelaporan warga baru, pindah domisili, penambahan anggota keluarga, kelahiran, atau kematian.",
        syarat: "Data diri lengkap & dokumen pendukung",
        templateWa: "Laporan Mutasi / Kependudukan Warga"
    },
    {
        kode: "TAMU-KEGIATAN",
        kategori: "Keamanan & Lingkungan",
        judul: "Lapor Tamu & Izin Kegiatan",
        deskripsi: "Pemberitahuan tamu menginap, hajatan, kerja bakti, atau penggunaan fasilitas/jalan lingkungan.",
        syarat: "Waktu pelaksanaan & penanggung jawab",
        templateWa: "Laporan Tamu / Pemberitahuan Kegiatan RT"
    },
    {
        kode: "PENGADUAN-LINGKUNGAN",
        kategori: "Fasilitas",
        judul: "Pengaduan Lingkungan",
        deskripsi: "Pelaporan lampu jalan, saluran air, kebersihan, atau keamanan lingkungan untuk ditindaklanjuti.",
        syarat: "Lokasi titik & uraian kendala",
        templateWa: "Pengaduan Fasilitas / Lingkungan RT"
    }
];

export function renderKasLayanan() {
    return `
        <div class="kas-layanan-root bg-[#f6f3ec] dark:bg-stone-950 text-stone-800 dark:text-stone-100 min-h-full">
            <div class="max-w-6xl w-full mx-auto px-4 md:px-6 py-5 space-y-5">
                <!-- Header & Navigasi 2 Tab -->
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 sm:p-5 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <h1 class="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
                                Kas &amp; Layanan RT
                            </h1>
                            <p id="kas-header-subtitle" class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                Transparansi kas iuran warga dan layanan administrasi/lingkungan RT.
                            </p>
                        </div>
                        <div id="kas-tarif-badge" class="text-xs font-semibold px-3 py-1.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 self-start sm:self-auto">
                            Tarif Tahunan: Memuat...
                        </div>
                    </div>

                    <div class="flex items-center border-b border-stone-200 dark:border-stone-800 gap-1" role="tablist" aria-label="Tab Kas dan Layanan">
                        <button
                            type="button"
                            id="tab-btn-kas"
                            role="tab"
                            aria-selected="true"
                            aria-controls="tab-panel-kas"
                            data-tab-target="kas"
                            class="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-[#c87d32] text-[#c87d32] bg-white dark:bg-stone-950/60 transition cursor-pointer"
                        >
                            1. Kas
                        </button>
                        <button
                            type="button"
                            id="tab-btn-layanan"
                            role="tab"
                            aria-selected="false"
                            aria-controls="tab-panel-layanan"
                            data-tab-target="layanan"
                            class="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition cursor-pointer"
                        >
                            2. Layanan
                        </button>
                    </div>
                </div>

                <!-- TAB 1: KAS -->
                <div id="tab-panel-kas" role="tabpanel" aria-labelledby="tab-btn-kas" class="space-y-5">
                    <!-- Ringkasan Kas -->
                    <section class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                            <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                TOTAL IURAN TERKUMPUL
                            </div>
                            <div id="stat-total-iuran-terkumpul" class="text-lg font-extrabold text-emerald-800 dark:text-emerald-400 mt-1">
                                Rp 0
                            </div>
                        </div>

                        <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                            <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                TERBAYAR AKUMULASI
                            </div>
                            <div id="stat-terbayar-akumulasi" class="text-lg font-extrabold text-[#c87d32] mt-1">
                                Rp 0
                            </div>
                        </div>

                        <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                            <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                SISA SALDO
                            </div>
                            <div id="stat-sisa-saldo" class="text-lg font-extrabold text-rose-800 dark:text-rose-400 mt-1">
                                Rp 0
                            </div>
                        </div>
                    </section>

                    <!-- Info Riwayat Pembayaran Sesuai Akun Login -->
                    <section class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 sm:p-5 space-y-3.5">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
                            <div>
                                <h2 class="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                                    Riwayat Pembayaran Akun Login
                                </h2>
                                <p id="riwayat-akun-info" class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                    Memeriksa akun login dan riwayat pembayaran iuran...
                                </p>
                            </div>
                            <div id="riwayat-akun-ringkasan" class="text-[11px] font-semibold text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 px-3 py-1.5 self-start sm:self-auto">
                                0 Transaksi
                            </div>
                        </div>

                        <div id="riwayat-akun-list" class="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950/50">
                            <div class="p-4 text-xs text-stone-500 dark:text-stone-400 text-center">
                                Memuat riwayat pembayaran sesuai akun login...
                            </div>
                        </div>
                    </section>
                </div>

                <!-- TAB 2: LAYANAN -->
                <div id="tab-panel-layanan" role="tabpanel" aria-labelledby="tab-btn-layanan" class="hidden space-y-5">
                    <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 sm:p-5 space-y-1">
                        <h2 class="text-sm font-bold text-stone-900 dark:text-stone-100">
                            Layanan Warga RT
                        </h2>
                        <p class="text-xs text-stone-600 dark:text-stone-300">
                            Pilih layanan yang dibutuhkan warga untuk terhubung langsung dengan pengurus RT atau menuju formulir layanan terkait.
                        </p>
                    </div>

                    <div id="layanan-cards-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${LAYANAN_WARGA_ITEMS.map((srv) => `
                            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col justify-between gap-4">
                                <div class="space-y-2">
                                    <div class="flex items-center justify-between gap-2">
                                        <span class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-[#c87d32]">
                                            ${escapeHtml(srv.kategori)}
                                        </span>
                                        <span class="text-[11px] text-stone-500 dark:text-stone-400">${escapeHtml(srv.kode)}</span>
                                    </div>
                                    <h3 class="text-sm font-bold text-stone-900 dark:text-stone-100">${escapeHtml(srv.judul)}</h3>
                                    <p class="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">${escapeHtml(srv.deskripsi)}</p>
                                    <div class="text-[11px] text-stone-500 dark:text-stone-400 pt-1 border-t border-stone-200/80 dark:border-stone-800">
                                        <span class="font-semibold text-stone-700 dark:text-stone-200">Syarat / Info:</span> ${escapeHtml(srv.syarat)}
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                                    <a
                                        href="#/kontak"
                                        data-link
                                        class="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition"
                                    >
                                        Info &amp; Kontak
                                    </a>
                                    <a
                                        href="#"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-layanan-wa="${escapeHtml(srv.templateWa)}"
                                        class="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4a5a3f] text-white transition"
                                    >
                                        Ajukan via WhatsApp
                                    </a>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function initKasLayananHandler() {
    let isDestroyed = false;
    let allIuran = [];
    let allWarga = [];
    let iuranTahunanMap = new Map();
    let wajibRtCount = 0;
    let activeProfile = readCachedProfile() || normalizeProfileData({});
    let activeTab = "kas";

    const sidebarEl = document.getElementById("sidebar");
    const prevSidebarDisplay = sidebarEl ? sidebarEl.style.display : "";
    if (sidebarEl) {
        sidebarEl.style.display = "none";
    }

    const tabKasBtn = document.getElementById("tab-btn-kas");
    const tabLayananBtn = document.getElementById("tab-btn-layanan");
    const tabKasPanel = document.getElementById("tab-panel-kas");
    const tabLayananPanel = document.getElementById("tab-panel-layanan");

    const tarifBadgeEl = document.getElementById("kas-tarif-badge");
    const statTotalIuranTerkumpulEl = document.getElementById("stat-total-iuran-terkumpul");
    const statTerbayarAkumulasiEl = document.getElementById("stat-terbayar-akumulasi");
    const statSisaSaldoEl = document.getElementById("stat-sisa-saldo");

    const riwayatAkunInfoEl = document.getElementById("riwayat-akun-info");
    const riwayatAkunRingkasanEl = document.getElementById("riwayat-akun-ringkasan");
    const riwayatAkunListEl = document.getElementById("riwayat-akun-list");

    if (typeof window.syncRunningTextPosition === "function") {
        window.syncRunningTextPosition(true);
    }

    function syncLayananWaLinks() {
        const brandName = activeProfile?.nama || "RTKu Digital";
        const phone = activeProfile?.telp || DEFAULT_WA_NUMBER;
        document.querySelectorAll("[data-layanan-wa]").forEach((el) => {
            const topik = el.getAttribute("data-layanan-wa") || "Layanan Warga RT";
            const pesan = `Halo ${brandName}, saya ingin mengajukan: ${topik}.`;
            el.setAttribute("href", formatWhatsAppUrl(phone, brandName, pesan));
        });
    }

    function updateTarifBadge() {
        if (!tarifBadgeEl) return;
        if (iuranTahunanMap.size > 0) {
            const entries = Array.from(iuranTahunanMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
            const [latestYear, latestVal] = entries[0];
            tarifBadgeEl.textContent = `Tarif Tahunan (${latestYear}): ${formatRupiah(latestVal)}`;
            return;
        }
        tarifBadgeEl.textContent = "Tarif Tahunan: Belum diatur";
    }

    function renderKasSummaryCards() {
        if (isDestroyed) return;

        let totalNominalTercatat = 0;
        for (const it of allIuran) {
            totalNominalTercatat += parseAmount(it.nominal);
        }

        const latestTarif = iuranTahunanMap.size > 0
            ? Array.from(iuranTahunanMap.entries()).sort((a, b) => b[0].localeCompare(a[0]))[0][1]
            : 0;

        const targetWajibTerkumpul = wajibRtCount > 0 && latestTarif > 0
            ? wajibRtCount * latestTarif
            : totalNominalTercatat;

        const terbayarAkumulasi = totalNominalTercatat;
        const sisaSaldo = Math.max(0, targetWajibTerkumpul - terbayarAkumulasi);

        if (statTotalIuranTerkumpulEl) {
            statTotalIuranTerkumpulEl.textContent = formatRupiah(targetWajibTerkumpul);
        }
        if (statTerbayarAkumulasiEl) {
            statTerbayarAkumulasiEl.textContent = formatRupiah(terbayarAkumulasi);
        }
        if (statSisaSaldoEl) {
            statSisaSaldoEl.textContent = formatRupiah(sisaSaldo);
        }
    }

    function renderAccountPaymentHistory() {
        if (!riwayatAkunInfoEl || !riwayatAkunRingkasanEl || !riwayatAkunListEl || isDestroyed) return;

        const account = getLoggedInAccountInfo();
        const labelAkun = account.email
            ? `${account.nama ? `${account.nama} ` : ""}(${account.email})`
            : (account.nama || "Akun belum terdeteksi");

        if (!account.email && !account.nama && !account.uid) {
            riwayatAkunInfoEl.textContent = "Silakan login terlebih dahulu untuk melihat riwayat pembayaran sesuai akun Anda.";
            riwayatAkunRingkasanEl.textContent = "0 Transaksi";
            riwayatAkunListEl.innerHTML = `
                <div class="p-4 text-xs text-stone-500 dark:text-stone-400 text-center">
                    Belum ada informasi akun yang sedang login.
                </div>
            `;
            return;
        }

        const matchedWargaNames = new Set();
        allWarga.forEach((w) => {
            const wEmail = extractWargaEmail(w);
            const wNama = extractWargaNama(w);
            if ((account.email && wEmail && wEmail === account.email) || (account.nama && wNama && wNama === account.nama)) {
                if (wNama) matchedWargaNames.add(wNama);
            }
        });

        const userHistory = allIuran
            .filter((it) => matchItemToLoggedInAccount(it, account, matchedWargaNames))
            .sort(compareHistoryAsc);

        let totalAkumulasiAkun = 0;
        let totalBelumLunas = 0;
        userHistory.forEach((it) => {
            const amt = parseAmount(it.nominal);
            totalAkumulasiAkun += amt;
            if (!isLunas(it.status)) {
                totalBelumLunas += amt;
            }
        });

        riwayatAkunInfoEl.textContent = `Akun login: ${labelAkun} • Urut tanggal & jam masuk (a-z)`;
        riwayatAkunRingkasanEl.textContent = `${userHistory.length} Transaksi • Akumulasi ${formatRupiah(totalAkumulasiAkun)} • Belum Lunas ${formatRupiah(totalBelumLunas)}`;

        if (!userHistory.length) {
            riwayatAkunListEl.innerHTML = `
                <div class="p-4 text-xs text-stone-500 dark:text-stone-400 text-center">
                    Belum ada riwayat pembayaran atau tagihan iuran yang cocok dengan akun <span class="font-semibold text-stone-700 dark:text-stone-200">${escapeHtml(labelAkun)}</span>.
                </div>
            `;
            return;
        }

        riwayatAkunListEl.innerHTML = userHistory.map((item, idx) => {
            const noUrut = idx + 1;
            const namaWarga = escapeHtml(item.namaWarga || item.nama || account.nama || "Warga");
            const periode = escapeHtml(item.periode || "-");
            const waktuMasuk = escapeHtml(formatEntryDateTimeDisplay(item));
            const keterangan = escapeHtml(item.keterangan || "Iuran Wajib RT");
            const nominalFormatted = escapeHtml(formatRupiah(item.nominal));
            const lunas = isLunas(item.status);
            const statusText = escapeHtml(item.status || (lunas ? "Lunas" : "Belum Lunas"));
            const statusClass = lunas
                ? "bg-emerald-900/15 text-emerald-800 dark:text-emerald-300 border-emerald-700/30"
                : "bg-[#c87d32]/15 text-[#9a5b1c] dark:text-[#e59b50] border-[#c87d32]/40";

            return `
                <div class="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:bg-[#faf8f3]/80 dark:hover:bg-stone-900/60 transition">
                    <div class="flex items-start gap-3 min-w-0">
                        <span class="inline-flex items-center justify-center w-6 h-6 text-[11px] font-bold bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 shrink-0 mt-0.5">
                            ${noUrut}
                        </span>
                        <div class="space-y-0.5 min-w-0">
                            <div class="flex flex-wrap items-center gap-2 text-xs">
                                <span class="font-bold text-stone-900 dark:text-stone-100">${namaWarga}</span>
                                <span class="text-stone-400">•</span>
                                <span class="font-semibold text-stone-700 dark:text-stone-300">Periode ${periode}</span>
                                <span class="text-stone-400">•</span>
                                <span class="text-stone-500 dark:text-stone-400">${waktuMasuk}</span>
                            </div>
                            <div class="text-xs text-stone-600 dark:text-stone-300 truncate">
                                ${keterangan}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-9 sm:pl-0">
                        <span class="text-xs font-bold text-stone-900 dark:text-stone-100">${nominalFormatted}</span>
                        <span class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                </div>
            `;
        }).join("");
    }

    function setActiveTab(nextTab = "kas") {
        activeTab = nextTab === "layanan" ? "layanan" : "kas";
        const isKas = activeTab === "kas";

        if (tabKasBtn) {
            tabKasBtn.setAttribute("aria-selected", String(isKas));
            tabKasBtn.className = isKas
                ? "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-[#c87d32] text-[#c87d32] bg-white dark:bg-stone-950/60 transition cursor-pointer"
                : "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition cursor-pointer";
        }

        if (tabLayananBtn) {
            tabLayananBtn.setAttribute("aria-selected", String(!isKas));
            tabLayananBtn.className = !isKas
                ? "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-[#c87d32] text-[#c87d32] bg-white dark:bg-stone-950/60 transition cursor-pointer"
                : "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition cursor-pointer";
        }

        tabKasPanel?.classList.toggle("hidden", !isKas);
        tabLayananPanel?.classList.toggle("hidden", isKas);
    }

    const onTabKasClick = () => setActiveTab("kas");
    const onTabLayananClick = () => setActiveTab("layanan");

    tabKasBtn?.addEventListener("click", onTabKasClick);
    tabLayananBtn?.addEventListener("click", onTabLayananClick);

    if (readCachedProfile()) {
        applyProfileToDom(activeProfile);
    } else if (typeof window.syncGlobalPublicUserAvatar === "function") {
        window.syncGlobalPublicUserAvatar();
    }
    syncLayananWaLinks();
    updateTarifBadge();
    renderKasSummaryCards();
    renderAccountPaymentHistory();

    const unsubscribeAuth = onAuthStateChanged(auth, () => {
        if (!isDestroyed) {
            renderAccountPaymentHistory();
        }
    });

    const [profResult, tarifResult, iuranResult, wargaResult] = await Promise.allSettled([
        getDoc(doc(db, "pengaturan", "profil_perusahaan")),
        getDoc(doc(db, "pengaturan", "iuran_tahunan")),
        getDocs(collection(db, IURAN_COLLECTION)),
        getDocs(collection(db, WARGA_COLLECTION))
    ]);

    if (isDestroyed) return;

    if (profResult.status === "fulfilled" && profResult.value.exists()) {
        const normalized = normalizeProfileData(profResult.value.data() || {});
        activeProfile = normalized;
        writeCachedProfile(normalized);
        applyProfileToDom(normalized);
        syncLayananWaLinks();
    }

    if (tarifResult.status === "fulfilled" && tarifResult.value.exists()) {
        const tarifData = tarifResult.value.data() || {};
        const items = Array.isArray(tarifData.items) ? tarifData.items : [];
        const map = new Map();
        for (const entry of items) {
            const yr = String(entry?.tahun || "").trim();
            const val = parseAmount(entry?.nilai);
            if (yr && Number.isFinite(val)) {
                map.set(yr, val);
            }
        }
        iuranTahunanMap = map;
    }

    if (wargaResult.status === "fulfilled") {
        let count = 0;
        const wargaRows = [];
        wargaResult.value.forEach((docSnap) => {
            const wData = docSnap.data() || {};
            wargaRows.push(wData);
            if (hasIuranWajibRt(wData)) {
                count += 1;
            }
        });
        allWarga = wargaRows;
        wajibRtCount = count;
    }

    if (iuranResult.status === "fulfilled") {
        const rows = [];
        iuranResult.value.forEach((docSnap) => {
            rows.push({ id: docSnap.id, ...(docSnap.data() || {}) });
        });
        rows.sort(compareHistoryAsc);
        allIuran = rows;
    } else {
        console.warn("Gagal memuat data iuran_warga:", iuranResult.reason);
    }

    updateTarifBadge();
    renderKasSummaryCards();
    renderAccountPaymentHistory();

    return () => {
        isDestroyed = true;
        if (sidebarEl) {
            sidebarEl.style.display = prevSidebarDisplay;
        }
        unsubscribeAuth?.();
        tabKasBtn?.removeEventListener("click", onTabKasClick);
        tabLayananBtn?.removeEventListener("click", onTabLayananClick);
    };
}

export default renderKasLayanan;