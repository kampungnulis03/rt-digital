// File: assets/js/views/berita.js
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const BERITA_COLLECTION = "berita";
const AGENDA_COLLECTION = "agenda_warga";
const DEFAULT_BERITA_IMAGE = "assets/icons/Logo.png";
const DEFAULT_WA_NUMBER = "6289602510491";
const PROFILE_CACHE_KEY = "rtku_profil_cache_v1";

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

function formatWhatsAppUrl(rawPhone = "", brandName = "RTKu Digital") {
    let digits = String(rawPhone || "").replace(/\D/g, "");
    if (!digits) digits = DEFAULT_WA_NUMBER;
    if (digits.startsWith("0")) {
        digits = "62" + digits.slice(1);
    }
    const msg = encodeURIComponent(`Halo ${brandName}, saya ingin bertanya terkait informasi berita, agenda, dan layanan warga.`);
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
    const alamat = String(p.alamat || p.alamat_lengkap || "-").trim() || "-";
    const telp = String(p.telepon || p.telp || p.no_hp || p.wa || DEFAULT_WA_NUMBER).trim() || DEFAULT_WA_NUMBER;
    const email = String(p.email || "-").trim() || "-";
    const rawIcon = String(p.iconUrl || p.logo || "").trim();
    const iconUrl = isSafeImageSrc(rawIcon) ? rawIcon : DEFAULT_BERITA_IMAGE;

    return { nama, alamat, telp, email, iconUrl };
}

function setSmoothImageSrc(imgEl, targetSrc, fallbackSrc = DEFAULT_BERITA_IMAGE) {
    if (!imgEl) return;
    const validSrc = isSafeImageSrc(targetSrc) ? targetSrc : fallbackSrc;
    if (!validSrc) return;

    const currentAttrSrc = imgEl.getAttribute("src") || "";
    if (currentAttrSrc === validSrc && imgEl.complete && imgEl.naturalWidth > 0) {
        imgEl.classList.remove("opacity-0");
        imgEl.classList.add("opacity-100");
        return;
    }

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
    if (pubLogo && profile.iconUrl) setSmoothImageSrc(pubLogo, profile.iconUrl, DEFAULT_BERITA_IMAGE);
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

function formatParagraphs(value = "") {
    const safe = escapeHtml(value);
    const blocks = safe
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (!blocks.length) {
        return `<p class="text-xs text-stone-500 dark:text-stone-400">-</p>`;
    }

    return blocks
        .map((block) => `<p class="text-xs sm:text-sm text-stone-700 dark:text-stone-200 leading-relaxed">${block.replace(/\n/g, "<br>")}</p>`)
        .join("");
}

function isItemPublished(data = {}) {
    if (typeof data.aktif === "boolean") return data.aktif;
    const statusStr = String(data.status || "").trim().toLowerCase();
    if (!statusStr) return true;
    if (statusStr === "aktif" || statusStr === "active" || statusStr === "published" || statusStr === "true") return true;
    if (statusStr === "nonaktif" || statusStr === "inactive" || statusStr === "draft" || statusStr === "false") return false;
    return true;
}

function detectItemTab(data = {}, fromAgendaCollection = false) {
    if (fromAgendaCollection) return "agenda";
    const tabField = String(data.tab || "").trim().toLowerCase();
    if (tabField === "agenda" || tabField === "berita") return tabField;

    const jenisVal = String(data.jenis || data.kategori || data.tipe || "").trim().toLowerCase();
    if (jenisVal.includes("agenda") || jenisVal.includes("kegiatan") || jenisVal.includes("jadwal")) {
        return "agenda";
    }
    return "berita";
}

export function renderBerita() {
    return `
        <div class="berita-landing-root bg-[#f6f3ec] dark:bg-stone-950 text-stone-800 dark:text-stone-100 min-h-full">
            <!-- KONTEN UTAMA -->
            <div class="max-w-6xl w-full mx-auto px-4 md:px-6 py-5 space-y-5">
                <!-- Header, Tab Berita & Agenda, serta Filter -->
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 sm:p-5 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <h1 id="berita-page-title" class="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
                                Berita &amp; Agenda
                            </h1>
                            <p id="berita-summary" class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                Memuat data...
                            </p>
                        </div>
                    </div>

                    <!-- 2 Tab: Tab Berita & Tab Agenda -->
                    <div role="tablist" aria-label="Kategori Berita dan Agenda" class="grid grid-cols-2 border border-stone-200 dark:border-stone-800 bg-[#f6f3ec] dark:bg-stone-950">
                        <button
                            type="button"
                            role="tab"
                            id="tab-btn-berita"
                            data-tab-target="berita"
                            aria-selected="true"
                            class="px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 border-[#c87d32] bg-[#faf8f3] dark:bg-stone-900 text-[#c87d32] transition cursor-pointer"
                        >
                            <span>Berita</span>
                            <span id="tab-count-berita" class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-none">
                                0
                            </span>
                        </button>

                        <button
                            type="button"
                            role="tab"
                            id="tab-btn-agenda"
                            data-tab-target="agenda"
                            aria-selected="false"
                            class="px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 border-transparent text-stone-600 dark:text-stone-300 hover:text-[#c87d32] transition cursor-pointer"
                        >
                            <span>Agenda</span>
                            <span id="tab-count-agenda" class="px-1.5 py-0.5 text-[10px] font-bold bg-stone-200/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-none">
                                0
                            </span>
                        </button>
                    </div>

                    <!-- Filter Pencarian, Cakupan & Unit -->
                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div class="sm:col-span-2">
                            <label for="berita-search" class="sr-only">Cari berita atau agenda</label>
                            <input
                                type="text"
                                id="berita-search"
                                placeholder="Cari judul, ringkasan, lokasi, isi, atau unit..."
                                class="w-full px-3 py-2 text-xs bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-[#c87d32]"
                            >
                        </div>

                        <div>
                            <label for="berita-cakupan-filter" class="sr-only">Filter cakupan</label>
                            <select
                                id="berita-cakupan-filter"
                                class="w-full px-3 py-2 text-xs bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                                <option value="all">Semua Cakupan</option>
                                <option value="general">General (Umum)</option>
                                <option value="unit">Unit / Layanan</option>
                            </select>
                        </div>

                        <div>
                            <label for="berita-unit-filter" class="sr-only">Filter unit</label>
                            <select
                                id="berita-unit-filter"
                                class="w-full px-3 py-2 text-xs bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                                <option value="all">Semua Unit</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Grid Daftar Berita / Agenda -->
                <section
                    id="berita-grid"
                    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-2"
                >
                    <div class="col-span-full bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                        Memuat data dari database...
                    </div>
                </section>
            </div>
        </div>

        <!-- Modal Baca Detail Berita / Agenda -->
        <div id="berita-detail-modal" class="hidden fixed inset-0 z-50 bg-stone-950/75 p-4 flex items-center justify-center">
            <div id="berita-detail-box" class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                <div class="px-4 sm:px-6 py-3.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3 flex-shrink-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <span id="berita-modal-badge" class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#5c6d4e] text-white rounded-none flex-shrink-0">
                            General (Umum)
                        </span>
                        <span id="berita-modal-meta" class="text-[11px] text-stone-500 dark:text-stone-400 truncate"></span>
                    </div>

                    <button
                        type="button"
                        id="berita-modal-close"
                        aria-label="Tutup"
                        class="px-2.5 py-1 text-xs font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-stone-700 rounded-none cursor-pointer flex-shrink-0"
                    >
                        ✕
                    </button>
                </div>

                <div class="overflow-y-auto p-4 sm:p-6 space-y-4">
                    <div class="w-full h-52 sm:h-64 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-800 overflow-hidden">
                        <img
                            id="berita-modal-img"
                            src="${DEFAULT_BERITA_IMAGE}"
                            alt="Gambar Detail"
                            class="w-full h-full object-cover"
                            onerror="this.onerror=null;this.src='${DEFAULT_BERITA_IMAGE}';"
                        >
                    </div>

                    <h2 id="berita-modal-title" class="text-base sm:text-xl font-bold text-stone-800 dark:text-stone-100 leading-snug">
                        Judul
                    </h2>

                    <div id="berita-modal-schedule" class="hidden flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-stone-300 bg-[#f6f3ec] dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 px-3 py-2"></div>

                    <div id="berita-modal-body" class="space-y-3 pt-1 border-t border-stone-200/70 dark:border-stone-800"></div>
                </div>
            </div>
        </div>
    `;
}

export async function initBeritaHandler() {
    let isDestroyed = false;
    let allItems = [];
    let activeTab = "berita";

    const sidebarEl = document.getElementById("sidebar");
    const prevSidebarDisplay = sidebarEl ? sidebarEl.style.display : "";
    if (sidebarEl) {
        sidebarEl.style.display = "none";
    }

    const cached = readCachedProfile();
    if (cached) {
        applyProfileToDom(cached);
    } else if (typeof window.syncGlobalPublicUserAvatar === "function") {
        window.syncGlobalPublicUserAvatar();
    }

    const pageTitleEl = document.getElementById("berita-page-title");
    const tabBtnBerita = document.getElementById("tab-btn-berita");
    const tabBtnAgenda = document.getElementById("tab-btn-agenda");
    const tabCountBerita = document.getElementById("tab-count-berita");
    const tabCountAgenda = document.getElementById("tab-count-agenda");

    const gridEl = document.getElementById("berita-grid");
    const summaryEl = document.getElementById("berita-summary");
    const searchInput = document.getElementById("berita-search");
    const cakupanSelect = document.getElementById("berita-cakupan-filter");
    const unitSelect = document.getElementById("berita-unit-filter");

    const modalEl = document.getElementById("berita-detail-modal");
    const modalBox = document.getElementById("berita-detail-box");
    const modalCloseBtn = document.getElementById("berita-modal-close");
    const modalBadge = document.getElementById("berita-modal-badge");
    const modalMeta = document.getElementById("berita-modal-meta");
    const modalImg = document.getElementById("berita-modal-img");
    const modalTitle = document.getElementById("berita-modal-title");
    const modalSchedule = document.getElementById("berita-modal-schedule");
    const modalBody = document.getElementById("berita-modal-body");

    if (typeof window.syncRunningTextPosition === "function") {
        window.syncRunningTextPosition(true);
    }

    function getItemCakupan(item) {
        const raw = String(item.cakupan || (item.unitId ? "unit" : "general")).trim().toLowerCase();
        return raw === "unit" ? "unit" : "general";
    }

    function getItemUnitLabel(item) {
        return getItemCakupan(item) === "unit"
            ? (String(item.unitNama || item.unit_nama || "Unit / Layanan").trim() || "Unit / Layanan")
            : "General (Umum)";
    }

    function getTabItems(tabName = activeTab) {
        return allItems.filter((item) => item._tab === tabName);
    }

    function syncTabUi() {
        const isBerita = activeTab === "berita";

        if (pageTitleEl) {
            pageTitleEl.textContent = isBerita ? "Berita" : "Agenda";
        }
        if (searchInput) {
            searchInput.placeholder = isBerita
                ? "Cari judul, ringkasan, isi berita, atau unit..."
                : "Cari judul agenda, lokasi, waktu, atau keterangan...";
        }

        if (tabBtnBerita) {
            tabBtnBerita.setAttribute("aria-selected", String(isBerita));
            tabBtnBerita.className = isBerita
                ? "px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 border-[#c87d32] bg-[#faf8f3] dark:bg-stone-900 text-[#c87d32] transition cursor-pointer"
                : "px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 border-transparent text-stone-600 dark:text-stone-300 hover:text-[#c87d32] transition cursor-pointer";
        }

        if (tabBtnAgenda) {
            tabBtnAgenda.setAttribute("aria-selected", String(!isBerita));
            tabBtnAgenda.className = !isBerita
                ? "px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-b-2 border-[#c87d32] bg-[#faf8f3] dark:bg-stone-900 text-[#c87d32] transition cursor-pointer"
                : "px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 border-transparent text-stone-600 dark:text-stone-300 hover:text-[#c87d32] transition cursor-pointer";
        }

        const beritaTotal = getTabItems("berita").length;
        const agendaTotal = getTabItems("agenda").length;
        if (tabCountBerita) tabCountBerita.textContent = String(beritaTotal);
        if (tabCountAgenda) tabCountAgenda.textContent = String(agendaTotal);
    }

    function openDetailModal(item) {
        if (!modalEl || !item) return;

        const cakupan = getItemCakupan(item);
        const unitLabel = getItemUnitLabel(item);
        const tanggal = item.tanggal || item.tanggalKegiatan || item.tgl || "-";
        const penulis = item.penulis || "Admin";
        const judul = item.judul || item.nama || "Tanpa Judul";
        const lokasi = String(item.lokasi || item.tempat || "").trim();
        const waktu = String(item.waktu || item.jam || "").trim();
        const isiLengkap = item.isi || item.konten || item.deskripsi || item.ringkasan || "-";
        const rawImg = String(item.gambar || item.foto || item.url || "").trim();
        const imgSrc = isSafeImageSrc(rawImg) ? rawImg : DEFAULT_BERITA_IMAGE;

        if (modalBadge) {
            modalBadge.textContent = unitLabel;
            modalBadge.className = cakupan === "unit"
                ? "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#5c6d4e] text-white rounded-none flex-shrink-0"
                : "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-none flex-shrink-0";
        }
        if (modalMeta) modalMeta.textContent = `${tanggal} • Oleh ${penulis}`;
        if (modalImg) {
            modalImg.src = imgSrc;
            modalImg.alt = judul;
        }
        if (modalTitle) modalTitle.textContent = judul;

        if (modalSchedule) {
            const chunks = [
                tanggal && tanggal !== "-" ? `<span>📅 ${escapeHtml(tanggal)}</span>` : "",
                waktu ? `<span>🕒 ${escapeHtml(waktu)}</span>` : "",
                lokasi ? `<span>📍 ${escapeHtml(lokasi)}</span>` : ""
            ].filter(Boolean);
            if (chunks.length > 0) {
                modalSchedule.innerHTML = chunks.join("");
                modalSchedule.classList.remove("hidden");
            } else {
                modalSchedule.innerHTML = "";
                modalSchedule.classList.add("hidden");
            }
        }

        if (modalBody) modalBody.innerHTML = formatParagraphs(isiLengkap);

        modalEl.classList.remove("hidden");
    }

    function closeDetailModal() {
        if (modalEl) {
            modalEl.classList.add("hidden");
        }
    }

    function populateUnitOptions(items) {
        if (!unitSelect) return;
        const prevVal = unitSelect.value || "all";

        const unitMap = new Map();
        items.forEach((item) => {
            if (getItemCakupan(item) === "unit") {
                const label = getItemUnitLabel(item);
                const key = String(item.unitId || label).trim();
                if (key && !unitMap.has(key)) {
                    unitMap.set(key, label);
                }
            }
        });

        const sortedUnits = Array.from(unitMap.entries()).sort((a, b) => a[1].localeCompare(b[1], "id"));
        unitSelect.innerHTML = `<option value="all">Semua Unit</option>` + sortedUnits
            .map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`)
            .join("");

        const exists = Array.from(unitSelect.options).some((opt) => opt.value === prevVal);
        unitSelect.value = exists ? prevVal : "all";
    }

    function renderItemCard(item) {
        const cakupan = getItemCakupan(item);
        const unitLabelSafe = escapeHtml(getItemUnitLabel(item));
        const judulSafe = escapeHtml(item.judul || item.nama || "Tanpa Judul");
        const ringkasanSafe = escapeHtml(item.ringkasan || item.isi || item.konten || item.deskripsi || "-");
        const tanggalSafe = escapeHtml(item.tanggal || item.tanggalKegiatan || item.tgl || "-");
        const penulisSafe = escapeHtml(item.penulis || "");
        const lokasiSafe = escapeHtml(String(item.lokasi || item.tempat || "").trim());
        const waktuSafe = escapeHtml(String(item.waktu || item.jam || "").trim());
        const rawImg = String(item.gambar || item.foto || item.url || "").trim();
        const imgSrc = escapeHtml(isSafeImageSrc(rawImg) ? rawImg : DEFAULT_BERITA_IMAGE);
        const idSafe = escapeHtml(item.id || "");
        const actionLabel = item._tab === "agenda" ? "Lihat Detail Agenda" : "Baca Selengkapnya";

        const badgeClass = cakupan === "unit"
            ? "bg-[#5c6d4e] text-white border-[#4b5a3f]"
            : "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";

        const scheduleLine = [
            waktuSafe ? `🕒 ${waktuSafe}` : "",
            lokasiSafe ? `📍 ${lokasiSafe}` : ""
        ].filter(Boolean).join(" • ");

        return `
            <article class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-hidden flex flex-col justify-between hover:border-[#c87d32] transition">
                <div>
                    <div class="relative w-full h-44 bg-stone-100 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-800 overflow-hidden">
                        <img
                            src="${imgSrc}"
                            alt="${judulSafe}"
                            class="w-full h-full object-cover"
                            onerror="this.onerror=null;this.src='${DEFAULT_BERITA_IMAGE}';"
                        >
                        <span class="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${badgeClass}">
                            ${unitLabelSafe}
                        </span>
                    </div>

                    <div class="p-4 space-y-2">
                        <div class="flex items-center justify-between gap-2 text-[10px] text-stone-400 dark:text-stone-500">
                            <span>${tanggalSafe}</span>
                            ${penulisSafe ? `<span class="truncate">${penulisSafe}</span>` : ""}
                        </div>

                        <h2 class="text-sm font-bold text-stone-800 dark:text-stone-100 leading-snug line-clamp-2">
                            ${judulSafe}
                        </h2>

                        <p class="text-xs text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-3">
                            ${ringkasanSafe}
                        </p>

                        ${scheduleLine ? `<p class="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1 pt-0.5">${scheduleLine}</p>` : ""}
                    </div>
                </div>

                <div class="px-4 py-3 border-t border-stone-200/70 dark:border-stone-800 bg-stone-100/60 dark:bg-stone-950/50 flex items-center justify-end">
                    <button
                        type="button"
                        data-item-id="${idSafe}"
                        class="px-3 py-1.5 text-[11px] font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                    >
                        ${actionLabel}
                    </button>
                </div>
            </article>
        `;
    }

    function applyFilterAndRender() {
        if (!gridEl || isDestroyed) return;

        syncTabUi();

        const tabItems = getTabItems(activeTab);
        const tabLabel = activeTab === "agenda" ? "agenda" : "berita";
        const keyword = String(searchInput?.value || "").trim().toLowerCase();
        const cakupanFilter = String(cakupanSelect?.value || "all").trim().toLowerCase();
        const unitFilter = String(unitSelect?.value || "all").trim();

        const filtered = tabItems.filter((item) => {
            const itemCakupan = getItemCakupan(item);
            if (cakupanFilter !== "all" && itemCakupan !== cakupanFilter) {
                return false;
            }

            if (unitFilter !== "all") {
                if (itemCakupan !== "unit") return false;
                const itemKey = String(item.unitId || getItemUnitLabel(item)).trim();
                if (itemKey !== unitFilter) return false;
            }

            if (!keyword) return true;

            const haystack = [
                item.judul,
                item.nama,
                item.ringkasan,
                item.isi,
                item.konten,
                item.deskripsi,
                item.lokasi,
                item.tempat,
                item.waktu,
                item.jam,
                getItemUnitLabel(item),
                item.penulis,
                item.tanggal
            ]
                .map((v) => String(v || "").toLowerCase())
                .join(" ");

            return haystack.includes(keyword);
        });

        if (summaryEl) {
            summaryEl.textContent = `Menampilkan ${filtered.length} dari ${tabItems.length} ${tabLabel} aktif`;
        }

        if (!filtered.length) {
            gridEl.innerHTML = `
                <div class="col-span-full bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-8 text-center">
                    <img src="${DEFAULT_BERITA_IMAGE}" alt="Kosong" class="h-12 w-12 object-contain mx-auto mb-2.5 opacity-80">
                    <p class="text-xs font-semibold text-stone-600 dark:text-stone-300">
                        Tidak ada ${tabLabel} yang sesuai dengan filter.
                    </p>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = filtered.map(renderItemCard).join("");
    }

    const onTabClick = (e) => {
        const btn = e.target.closest("[data-tab-target]");
        if (!btn) return;
        const nextTab = btn.getAttribute("data-tab-target");
        if (nextTab === "berita" || nextTab === "agenda") {
            activeTab = nextTab;
            applyFilterAndRender();
        }
    };

    const onFilterChange = () => applyFilterAndRender();

    const onGridClick = (e) => {
        const trigger = e.target.closest("[data-item-id]");
        if (!trigger) return;
        const id = trigger.getAttribute("data-item-id");
        const found = allItems.find((item) => String(item.id) === String(id));
        if (found) {
            openDetailModal(found);
        }
    };

    const onBackdropClick = (e) => {
        if (modalBox && !modalBox.contains(e.target)) {
            closeDetailModal();
        }
    };

    const onKeyDown = (e) => {
        if (e.key === "Escape") {
            closeDetailModal();
        }
    };

    tabBtnBerita?.addEventListener("click", onTabClick);
    tabBtnAgenda?.addEventListener("click", onTabClick);
    searchInput?.addEventListener("input", onFilterChange);
    cakupanSelect?.addEventListener("change", onFilterChange);
    unitSelect?.addEventListener("change", onFilterChange);
    gridEl?.addEventListener("click", onGridClick);
    modalCloseBtn?.addEventListener("click", closeDetailModal);
    modalEl?.addEventListener("click", onBackdropClick);
    document.addEventListener("keydown", onKeyDown);

    const [profResult, beritaResult, agendaResult] = await Promise.allSettled([
        getDoc(doc(db, "pengaturan", "profil_perusahaan")),
        getDocs(collection(db, BERITA_COLLECTION)),
        getDocs(collection(db, AGENDA_COLLECTION))
    ]);

    if (isDestroyed) return;

    if (profResult.status === "fulfilled" && profResult.value.exists()) {
        const normalized = normalizeProfileData(profResult.value.data() || {});
        writeCachedProfile(normalized);
        applyProfileToDom(normalized);
    }

    const items = [];
    const seenIds = new Set();

    if (beritaResult.status === "fulfilled") {
        beritaResult.value.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (isItemPublished(data)) {
                const id = docSnap.id;
                seenIds.add(id);
                items.push({
                    id,
                    ...data,
                    _tab: detectItemTab(data, false)
                });
            }
        });
    }

    if (agendaResult.status === "fulfilled") {
        agendaResult.value.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (isItemPublished(data)) {
                const id = `agenda_${docSnap.id}`;
                if (!seenIds.has(docSnap.id) && !seenIds.has(id)) {
                    seenIds.add(id);
                    items.push({
                        id,
                        ...data,
                        _tab: detectItemTab(data, true)
                    });
                }
            }
        });
    }

    if (beritaResult.status === "rejected" && agendaResult.status === "rejected") {
        console.error("Gagal memuat data berita & agenda:", beritaResult.reason, agendaResult.reason);
        if (summaryEl) summaryEl.textContent = "Gagal memuat berita & agenda";
        if (gridEl) {
            gridEl.innerHTML = `
                <div class="col-span-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-none p-6 text-center text-xs font-semibold text-rose-700 dark:text-rose-300">
                    Gagal memuat data berita dan agenda dari database.
                </div>
            `;
        }
        return;
    }

    items.sort((a, b) => {
        const dateA = String(a.tanggal || a.tanggalKegiatan || a.tgl || a.createdAt || "");
        const dateB = String(b.tanggal || b.tanggalKegiatan || b.tgl || b.createdAt || "");
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

    allItems = items;
    populateUnitOptions(allItems);
    applyFilterAndRender();

    return () => {
        isDestroyed = true;
        if (sidebarEl) {
            sidebarEl.style.display = prevSidebarDisplay;
        }
        tabBtnBerita?.removeEventListener("click", onTabClick);
        tabBtnAgenda?.removeEventListener("click", onTabClick);
        searchInput?.removeEventListener("input", onFilterChange);
        cakupanSelect?.removeEventListener("change", onFilterChange);
        unitSelect?.removeEventListener("change", onFilterChange);
        gridEl?.removeEventListener("click", onGridClick);
        modalCloseBtn?.removeEventListener("click", closeDetailModal);
        modalEl?.removeEventListener("click", onBackdropClick);
        document.removeEventListener("keydown", onKeyDown);
    };
}

export default renderBerita;