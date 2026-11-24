// File: assets/js/views/home.js
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth } from "../firebase-init.js";

const DEFAULT_IMG = "assets/icons/Logo.png";
const DEFAULT_WA_NUMBER = "6289602510491";
const DEFAULT_BRAND_NAME = "RTKu Digital";
const PROFILE_CACHE_KEY = "rtku_profil_cache_v1";
const RUNNING_TEXT_CACHE_KEY = "rtku_running_text_cache_v1";
const MOBILE_INITIAL_LIMIT = 4;
const DESKTOP_INITIAL_LIMIT = 6;
const AGENDA_INITIAL_LIMIT = 4;

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

function normalizeWaNumber(phone = "", fallback = DEFAULT_WA_NUMBER) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (!digits) digits = String(fallback || DEFAULT_WA_NUMBER).replace(/\D/g, "");
    if (digits.startsWith("0")) digits = "62" + digits.slice(1);
    return digits || DEFAULT_WA_NUMBER;
}

function stripBasicMarkdown(text = "") {
    return String(text || "").replace(/\*\*/g, "").trim();
}

function formatTanggalIndo(rawDate = "") {
    const str = String(rawDate || "").trim();
    if (!str) return "";
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return str;
    return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(parsed);
}

function formatAngkaIndo(val = 0) {
    const num = Number(val);
    return new Intl.NumberFormat("id-ID").format(Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0);
}

function hitungUsiaDariLahir(rawBirth) {
    if (!rawBirth) return null;
    const str = String(rawBirth).trim();
    if (!str) return null;

    if (/^\d{1,3}$/.test(str)) {
        const n = Number(str);
        return n >= 0 && n <= 130 ? n : null;
    }

    const birthDate = new Date(str);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 && age <= 130 ? age : null;
}

function classifyAgeGroup(age) {
    if (age === null || age === undefined || Number.isNaN(Number(age))) return "tidak_diketahui";
    const num = Number(age);
    if (num <= 12) return "anak";
    if (num <= 17) return "remaja";
    if (num <= 59) return "dewasa";
    return "lansia";
}

function parseGenderValue(raw = {}) {
    const val = String(
        raw.jenisKelamin ||
        raw.jenis_kelamin ||
        raw.gender ||
        raw.jk ||
        raw.kelamin ||
        ""
    )
        .trim()
        .toLowerCase();

    if (["l", "lk", "laki-laki", "laki", "male", "pria", "m"].includes(val)) return "L";
    if (["p", "pr", "perempuan", "female", "wanita", "w", "f"].includes(val)) return "P";
    return "";
}

function aggregateWargaStatistics(wargaDocs = [], kkDocs = [], summaryData = null) {
    const stats = {
        totalWarga: 0,
        lakiLaki: 0,
        perempuan: 0,
        kepalaKeluarga: 0,
        usia: {
            anak: 0,
            remaja: 0,
            dewasa: 0,
            lansia: 0,
            tidak_diketahui: 0
        }
    };

    if (wargaDocs.length > 0) {
        stats.totalWarga = wargaDocs.length;
        const kkSet = new Set();

        wargaDocs.forEach((w) => {
            const gender = parseGenderValue(w);
            if (gender === "L") stats.lakiLaki++;
            else if (gender === "P") stats.perempuan++;

            const relasi = String(
                w.statusHubungan ||
                w.status_hubungan ||
                w.hubungan ||
                w.hubunganKeluarga ||
                w.hubungan_keluarga ||
                w.peran ||
                ""
            )
                .trim()
                .toLowerCase();
            const noKk = String(w.noKk || w.no_kk || w.kk || w.nomorKk || w.nomor_kk || "").trim();

            if (
                relasi.includes("kepala keluarga") ||
                relasi === "kk" ||
                w.isKepalaKeluarga === true ||
                w.kepalaKeluarga === true
            ) {
                stats.kepalaKeluarga++;
            } else if (noKk) {
                kkSet.add(noKk);
            }

            const rawAge =
                w.usia ??
                w.umur ??
                w.tanggalLahir ??
                w.tanggal_lahir ??
                w.tglLahir ??
                w.tgl_lahir ??
                w.lahir;
            const age = hitungUsiaDariLahir(rawAge);
            const group = classifyAgeGroup(age);
            stats.usia[group] = (stats.usia[group] || 0) + 1;
        });

        if (kkDocs.length > 0) {
            stats.kepalaKeluarga = kkDocs.length;
        } else if (stats.kepalaKeluarga === 0 && kkSet.size > 0) {
            stats.kepalaKeluarga = kkSet.size;
        }

        return stats;
    }

    if (kkDocs.length > 0) {
        stats.kepalaKeluarga = kkDocs.length;
    }

    if (summaryData && typeof summaryData === "object") {
        const s = summaryData;
        const l = Number(s.lakiLaki ?? s.laki_laki ?? s.pria ?? s.male ?? 0) || 0;
        const p = Number(s.perempuan ?? s.wanita ?? s.female ?? 0) || 0;
        const total = Number(s.totalWarga ?? s.total_warga ?? s.jumlahWarga ?? s.jumlah_warga ?? (l + p)) || 0;
        const kk = Number(s.kepalaKeluarga ?? s.kepala_keluarga ?? s.jumlahKk ?? s.jumlah_kk ?? stats.kepalaKeluarga) || stats.kepalaKeluarga;

        stats.lakiLaki = l;
        stats.perempuan = p;
        stats.totalWarga = Math.max(total, l + p);
        stats.kepalaKeluarga = kk;

        const ageObj = s.usia || s.kelompokUsia || s.kelompok_usia || s;
        stats.usia.anak = Number(ageObj.anak ?? ageObj["0_12"] ?? ageObj["0-12"] ?? 0) || 0;
        stats.usia.remaja = Number(ageObj.remaja ?? ageObj["13_17"] ?? ageObj["13-17"] ?? 0) || 0;
        stats.usia.dewasa = Number(ageObj.dewasa ?? ageObj["18_59"] ?? ageObj["18-59"] ?? 0) || 0;
        stats.usia.lansia = Number(ageObj.lansia ?? ageObj["60_plus"] ?? ageObj["60+"] ?? 0) || 0;
    }

    return stats;
}

function isMobileViewport() {
    return typeof window !== "undefined" && window.innerWidth < 768;
}

function buildHeroTitle(brandName = DEFAULT_BRAND_NAME) {
    const clean = String(brandName || "").trim() || DEFAULT_BRAND_NAME;
    return `Guyub Rukun & Informasi Warga di ${clean}`;
}

function syncKasLayananLinksInDom() {
    document.querySelectorAll('a[href="#/unit-usaha"], a[data-route="unit-usaha"]').forEach((el) => {
        if (el.getAttribute("href") === "#/unit-usaha") {
            el.setAttribute("href", "#/kas-layanan");
        }
        if (el.getAttribute("data-route") === "unit-usaha") {
            el.setAttribute("data-route", "kas-layanan");
        }
    });
}

function syncGlobalPublicNavbarData(profile = {}) {
    syncKasLayananLinksInDom();

    const nama = profile.nama || DEFAULT_BRAND_NAME;
    const pubBrand = document.getElementById("global-public-brand");
    const pubLogo = document.getElementById("global-public-logo");
    const pubBooking = document.getElementById("global-public-booking-btn");

    if (pubBrand && nama) {
        pubBrand.textContent = nama;
    }
    if (pubLogo && profile.iconUrl && isSafeImageSrc(profile.iconUrl)) {
        pubLogo.src = profile.iconUrl;
    }
    if (pubBooking) {
        const digits = normalizeWaNumber(profile.telp);
        const msg = encodeURIComponent(`Halo ${nama}, saya ingin bertanya terkait layanan dan informasi warga.`);
        pubBooking.href = `https://wa.me/${digits}?text=${msg}`;
    }
    if (typeof window.syncGlobalPublicUserAvatar === "function") {
        window.syncGlobalPublicUserAvatar();
    }
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
        // Abaikan jika storage penuh atau dibatasi
    }
}

function readCachedRunningText() {
    try {
        return String(sessionStorage.getItem(RUNNING_TEXT_CACHE_KEY) || "").trim();
    } catch {
        return "";
    }
}

function writeCachedRunningText(text) {
    try {
        sessionStorage.setItem(RUNNING_TEXT_CACHE_KEY, String(text || "").trim());
    } catch {
        // Abaikan jika storage penuh atau dibatasi
    }
}

function getFallbackDomRunningText() {
    const globalEl = document.getElementById("global-running-text-container");
    if (!globalEl) return "";
    const marqueeOrSpan =
        globalEl.querySelector("#global-running-text") ||
        globalEl.querySelector("marquee") ||
        globalEl.querySelector("[data-running-text]");
    const raw = (marqueeOrSpan ? marqueeOrSpan.textContent : globalEl.textContent) || "";
    return raw.replace(/^📢\s*INFO:\s*/i, "").replace(/\s+/g, " ").trim();
}

function normalizeProfileData(p = {}) {
    const nama = String(p.nama || DEFAULT_BRAND_NAME).trim() || DEFAULT_BRAND_NAME;
    const tagline = String(p.tagline || p.subjudul || "").trim();
    const deskripsi = stripBasicMarkdown(p.deskripsi || p.tentang || p.profil || "");
    const alamat = String(p.alamat || p.alamat_lengkap || "-").trim() || "-";
    const telp = String(p.telepon || p.telp || p.no_hp || p.wa || "-").trim() || "-";
    const email = String(p.email || "-").trim() || "-";
    const bannerUrl = String(p.bannerUrl || p.banner || "").trim();
    const rawIcon = String(p.iconUrl || p.logo || "").trim();
    const iconUrl = isSafeImageSrc(rawIcon) ? rawIcon : DEFAULT_IMG;

    return {
        nama,
        tagline,
        deskripsi,
        alamat,
        telp,
        email,
        bannerUrl: isSafeImageSrc(bannerUrl) ? bannerUrl : "",
        iconUrl
    };
}

function setSmoothImageSrc(imgEl, targetSrc, fallbackSrc = DEFAULT_IMG, instantIfAlreadyShown = false) {
    if (!imgEl) return;
    const validSrc = isSafeImageSrc(targetSrc) ? targetSrc : fallbackSrc;
    if (!validSrc) return;

    const currentAttrSrc = imgEl.getAttribute("src") || "";
    if (currentAttrSrc === validSrc && imgEl.complete && imgEl.naturalWidth > 0) {
        imgEl.classList.remove("opacity-0");
        imgEl.classList.add("opacity-100");
        return;
    }

    if (!instantIfAlreadyShown) {
        imgEl.classList.remove("opacity-100");
        imgEl.classList.add("opacity-0");
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

function applyRunningTextToDom(text) {
    const barEl = document.getElementById("home-running-text-bar");
    const trackEl = document.getElementById("home-running-text-track");
    const clean = String(text || "").trim();
    if (!barEl || !trackEl) return;

    if (!clean) {
        barEl.classList.add("hidden");
        return;
    }

    barEl.classList.remove("hidden");
    const safeHtml = escapeHtml(clean);
    trackEl.innerHTML = `<span>${safeHtml}</span><span class="mx-12 opacity-40">•</span><span>${safeHtml}</span>`;
}

function applyProfileToDom(profile) {
    const nama = profile.nama || DEFAULT_BRAND_NAME;
    const heroImg = document.getElementById("hero-banner-img");
    const heroTitle = document.getElementById("hero-title");
    const heroSub = document.getElementById("hero-subtitle");
    const aboutEl = document.getElementById("about-description");
    const fPhone = document.getElementById("global-footer-phone") || document.getElementById("footer-phone");
    const fEmail = document.getElementById("global-footer-email") || document.getElementById("footer-email");
    const fAddr = document.getElementById("global-footer-address") || document.getElementById("footer-address");
    const fBrand = document.getElementById("global-footer-brand") || document.getElementById("footer-brand");

    if (profile.bannerUrl) {
        setSmoothImageSrc(heroImg, profile.bannerUrl, "", true);
    }

    const nextHeroTitle = buildHeroTitle(nama);
    if (heroTitle && heroTitle.textContent !== nextHeroTitle) {
        heroTitle.textContent = nextHeroTitle;
    }
    if (heroSub && profile.tagline && heroSub.textContent !== profile.tagline) {
        heroSub.textContent = profile.tagline;
    }
    if (aboutEl && profile.deskripsi && aboutEl.textContent !== profile.deskripsi) {
        aboutEl.textContent = profile.deskripsi;
    }
    if (fPhone && fPhone.textContent !== profile.telp) fPhone.textContent = profile.telp;
    if (fEmail && fEmail.textContent !== profile.email) fEmail.textContent = profile.email;
    if (fAddr && fAddr.textContent !== profile.alamat) fAddr.textContent = profile.alamat;
    if (fBrand && fBrand.textContent !== nama) fBrand.textContent = nama;

    syncGlobalPublicNavbarData(profile);
}

function dismissLoginOverlaySmoothly() {
    const overlay = document.getElementById("login-home-transition");
    if (!overlay) return;
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";
    setTimeout(() => {
        overlay.remove();
    }, 350);
}

function normalizeAgendaEntry(docId, raw = {}, fallbackJenis = "Pengumuman") {
    const judul = String(raw.judul || raw.nama || raw.title || raw.topik || "").trim();
    const isi = stripBasicMarkdown(
        raw.isi || raw.deskripsi || raw.keterangan || raw.konten || raw.pesan || ""
    );
    const jenisRaw = String(raw.jenis || raw.kategori || raw.tipe || fallbackJenis).trim();
    const jenis = jenisRaw.toLowerCase().includes("agenda") || jenisRaw.toLowerCase().includes("kegiatan")
        ? "Agenda"
        : (jenisRaw || "Pengumuman");
    const rawTanggal = raw.tanggal || raw.tanggalKegiatan || raw.tgl || raw.jadwal || raw.createdAt || "";
    const tanggalLabel = formatTanggalIndo(rawTanggal);
    const lokasi = String(raw.lokasi || raw.tempat || "").trim();
    const waktu = String(raw.waktu || raw.jam || "").trim();
    const rawFoto = raw.gambar || raw.foto || raw.fotoUrl || raw.url || "";
    const foto = isSafeImageSrc(rawFoto) ? rawFoto : "";

    return {
        id: docId,
        judul: judul || "Info Warga",
        isi: isi || "Belum ada rincian tambahan untuk informasi ini.",
        jenis,
        tanggalLabel,
        rawTanggal: String(rawTanggal || ""),
        lokasi,
        waktu,
        foto
    };
}

export function renderHome() {
    const cached = readCachedProfile();
    const cachedRunningText = readCachedRunningText() || getFallbackDomRunningText();
    const brandText = escapeHtml(cached?.nama || DEFAULT_BRAND_NAME);
    const bannerSrc = escapeHtml(cached?.bannerUrl || "");
    const heroTitleText = escapeHtml(buildHeroTitle(brandText));
    const heroSubtitleText = escapeHtml(
        cached?.tagline ||
        "Informasi kas terbuka, agenda kegiatan, dan layanan administrasi warga yang transparan."
    );
    const aboutText = escapeHtml(
        cached?.deskripsi ||
        "Portal digital lingkungan RT untuk berbagi pengumuman, rekap kas, agenda warga, serta dokumentasi kegiatan bersama."
    );
    const safeRunningText = escapeHtml(cachedRunningText);

    return `
        <style>
            html,
            body,
            .home-landing-root,
            .home-no-scrollbar {
                scrollbar-width: none;
                -ms-overflow-style: none;
            }
            html::-webkit-scrollbar,
            body::-webkit-scrollbar,
            .home-landing-root::-webkit-scrollbar,
            .home-no-scrollbar::-webkit-scrollbar {
                display: none;
                width: 0;
                height: 0;
            }
            .home-landing-root {
                width: 100%;
                min-height: 100%;
                display: flex;
                flex-direction: column;
            }
            @keyframes homeMarqueeScroll {
                0% { transform: translateX(0%); }
                100% { transform: translateX(-50%); }
            }
            .home-marquee-track {
                display: inline-flex;
                align-items: center;
                white-space: nowrap;
                min-width: 200%;
                animation: homeMarqueeScroll 26s linear infinite;
            }
            .home-marquee-wrap:hover .home-marquee-track {
                animation-play-state: paused;
            }
        </style>
        <div class="home-landing-root bg-[#f6f3ec] dark:bg-stone-950 text-stone-800 dark:text-stone-100">
            <!-- HERO BANNER -->
            <section class="relative w-full h-[210px] sm:h-[245px] lg:h-[265px] overflow-hidden bg-stone-800 shrink-0">
                <img
                    id="hero-banner-img"
                    src="${bannerSrc}"
                    alt="Banner Utama ${brandText}"
                    class="absolute inset-0 z-0 w-full h-full object-cover object-center ${bannerSrc ? "opacity-100" : "opacity-0"} transition-opacity duration-200"
                />
                <div class="absolute inset-0 z-10 bg-gradient-to-r from-black/80 via-black/45 to-transparent"></div>

                <div class="relative z-20 max-w-6xl mx-auto h-full px-4 md:px-6 flex flex-col justify-center text-white">
                    <h1 id="hero-title" class="text-xl sm:text-2xl lg:text-4xl font-extrabold leading-tight max-w-2xl drop-shadow-sm">
                        ${heroTitleText}
                    </h1>
                    <p id="hero-subtitle" class="mt-2 text-xs sm:text-sm text-stone-100 max-w-xl leading-snug line-clamp-2 drop-shadow-sm">
                        ${heroSubtitleText}
                    </p>
                    <div class="mt-4 flex flex-wrap items-center gap-2.5">
                        <a href="#/kas-layanan" data-link class="bg-[#d47a2a] hover:bg-[#bc681e] text-white text-xs font-semibold px-4 py-2 rounded-full transition">
                            Lihat Kas &amp; Layanan
                        </a>
                        <a href="#/kontak" data-link class="border border-white/80 hover:bg-white/15 text-white text-xs font-semibold px-4 py-2 rounded-full transition">
                            Hubungi Kami
                        </a>
                    </div>
                </div>
            </section>

            <!-- RUNNING TEXT (FULL WIDTH UJUNG KANAN-KIRI DI BAWAH HERO BANNER) -->
            <div id="home-running-text-bar" class="${safeRunningText ? "" : "hidden"} w-full bg-[#fcf7e8] dark:bg-stone-900 border-b border-amber-200/80 dark:border-stone-800 shrink-0 overflow-hidden">
                <div class="max-w-6xl mx-auto px-4 md:px-6 h-8 flex items-center gap-2.5 text-xs">
                    <span class="inline-flex items-center gap-1 font-bold text-[#9a5518] dark:text-amber-400 shrink-0">
                        <span aria-hidden="true">📢</span>
                        <span>INFO:</span>
                    </span>
                    <div class="home-marquee-wrap flex-1 min-w-0 overflow-hidden relative">
                        <div id="home-running-text-track" class="home-marquee-track text-[#7c4514] dark:text-amber-200 font-medium">
                            <span>${safeRunningText}</span><span class="mx-12 opacity-40">•</span><span>${safeRunningText}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TENTANG KAMI, PENGURUS RT, STATISTIK WARGA & AGENDA / PENGUMUMAN WARGA -->
            <main class="max-w-6xl w-full mx-auto px-4 md:px-6 py-4 space-y-6 flex-1 min-h-0">
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <section class="lg:col-span-4 space-y-2">
                        <h2 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100">Tentang Kami</h2>
                        <p id="about-description" class="text-xs text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-5">
                            ${aboutText}
                        </p>
                    </section>

                    <section class="lg:col-span-8 space-y-2.5">
                        <div class="flex items-center justify-between">
                            <h2 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100">Pengurus RT</h2>
                            <button
                                type="button"
                                id="home-lihat-semua-btn"
                                class="text-xs font-semibold text-[#c87d32] hover:underline cursor-pointer bg-transparent border-0 p-0"
                            >
                                Lihat Semua →
                            </button>
                        </div>
                        <div id="home-featured-grid" class="grid grid-cols-2 md:grid-cols-3 gap-3 transition-all duration-300">
                            <div class="col-span-full text-xs text-stone-500 py-2">Memuat data pengurus RT...</div>
                        </div>
                    </section>
                </div>

                <!-- STATISTIK WARGA & PERBANDINGAN USIA -->
                <section class="border-t border-stone-200 dark:border-stone-800 pt-5 space-y-3.5">
                    <div class="flex items-center justify-between gap-2">
                        <div>
                            <h2 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100">Statistik Kependudukan RT</h2>
                            <p class="text-xs text-stone-500 dark:text-stone-400">Ringkasan data warga, jenis kelamin, kepala keluarga, dan perbandingan kelompok usia.</p>
                        </div>
                        <span id="home-stats-status" class="text-[11px] font-semibold text-stone-500 dark:text-stone-400 shrink-0">
                            Memuat statistik...
                        </span>
                    </div>

                    <!-- 4 Kartu Ringkasan Utama -->
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-3.5">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Warga</div>
                            <div id="stat-total-warga" class="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 mt-1">0</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">Terdata di lingkungan RT</div>
                        </div>

                        <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-3.5">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Laki-Laki</div>
                            <div class="flex items-baseline justify-between gap-2 mt-1">
                                <span id="stat-laki-laki" class="text-xl sm:text-2xl font-extrabold text-[#5c6d4e] dark:text-emerald-400">0</span>
                                <span id="stat-laki-pct" class="text-[11px] font-bold text-stone-500 dark:text-stone-400">0%</span>
                            </div>
                            <div class="w-full h-1.5 bg-stone-200 dark:bg-stone-800 mt-2 overflow-hidden">
                                <div id="stat-laki-bar" class="h-full bg-[#5c6d4e] transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>

                        <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-3.5">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Perempuan</div>
                            <div class="flex items-baseline justify-between gap-2 mt-1">
                                <span id="stat-perempuan" class="text-xl sm:text-2xl font-extrabold text-[#c87d32]">0</span>
                                <span id="stat-perempuan-pct" class="text-[11px] font-bold text-stone-500 dark:text-stone-400">0%</span>
                            </div>
                            <div class="w-full h-1.5 bg-stone-200 dark:bg-stone-800 mt-2 overflow-hidden">
                                <div id="stat-perempuan-bar" class="h-full bg-[#c87d32] transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>

                        <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-3.5">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Kepala Keluarga</div>
                            <div id="stat-kepala-keluarga" class="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-stone-100 mt-1">0</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">Jumlah KK aktif</div>
                        </div>
                    </div>

                    <!-- Panel Perbandingan Berdasarkan Usia -->
                    <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 space-y-3">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-stone-200 dark:border-stone-800 pb-2.5">
                            <h3 class="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                                Perbandingan Berdasarkan Kelompok Usia
                            </h3>
                            <span id="stat-usia-unknown" class="text-[11px] text-stone-500 dark:text-stone-400"></span>
                        </div>

                        <div id="home-age-comparison" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div class="space-y-1.5 bg-[#f6f3ec] dark:bg-stone-950/50 border border-stone-200/80 dark:border-stone-800 p-3">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="font-bold text-stone-800 dark:text-stone-100">Anak (0–12 th)</span>
                                    <span id="age-anak-label" class="font-semibold text-stone-600 dark:text-stone-300">0 (0%)</span>
                                </div>
                                <div class="w-full h-2 bg-stone-200 dark:bg-stone-800 overflow-hidden">
                                    <div id="age-anak-bar" class="h-full bg-[#5c6d4e] transition-all duration-300" style="width: 0%"></div>
                                </div>
                            </div>

                            <div class="space-y-1.5 bg-[#f6f3ec] dark:bg-stone-950/50 border border-stone-200/80 dark:border-stone-800 p-3">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="font-bold text-stone-800 dark:text-stone-100">Remaja (13–17 th)</span>
                                    <span id="age-remaja-label" class="font-semibold text-stone-600 dark:text-stone-300">0 (0%)</span>
                                </div>
                                <div class="w-full h-2 bg-stone-200 dark:bg-stone-800 overflow-hidden">
                                    <div id="age-remaja-bar" class="h-full bg-[#8a9a5b] transition-all duration-300" style="width: 0%"></div>
                                </div>
                            </div>

                            <div class="space-y-1.5 bg-[#f6f3ec] dark:bg-stone-950/50 border border-stone-200/80 dark:border-stone-800 p-3">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="font-bold text-stone-800 dark:text-stone-100">Dewasa (18–59 th)</span>
                                    <span id="age-dewasa-label" class="font-semibold text-stone-600 dark:text-stone-300">0 (0%)</span>
                                </div>
                                <div class="w-full h-2 bg-stone-200 dark:bg-stone-800 overflow-hidden">
                                    <div id="age-dewasa-bar" class="h-full bg-[#c87d32] transition-all duration-300" style="width: 0%"></div>
                                </div>
                            </div>

                            <div class="space-y-1.5 bg-[#f6f3ec] dark:bg-stone-950/50 border border-stone-200/80 dark:border-stone-800 p-3">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="font-bold text-stone-800 dark:text-stone-100">Lansia (60+ th)</span>
                                    <span id="age-lansia-label" class="font-semibold text-stone-600 dark:text-stone-300">0 (0%)</span>
                                </div>
                                <div class="w-full h-2 bg-stone-200 dark:bg-stone-800 overflow-hidden">
                                    <div id="age-lansia-bar" class="h-full bg-[#9a5518] transition-all duration-300" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- AGENDA & PENGUMUMAN WARGA -->
                <section class="border-t border-stone-200 dark:border-stone-800 pt-5 space-y-3">
                    <div class="flex items-center justify-between gap-2">
                        <div>
                            <h2 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100">Agenda &amp; Pengumuman Warga</h2>
                            <p class="text-xs text-stone-500 dark:text-stone-400">Jadwal kegiatan lingkungan dan informasi penting untuk warga.</p>
                        </div>
                        <div class="flex items-center gap-3 shrink-0">
                            <button
                                type="button"
                                id="home-agenda-toggle-btn"
                                class="hidden text-xs font-semibold text-[#c87d32] hover:underline cursor-pointer bg-transparent border-0 p-0"
                            >
                                Lihat Semua →
                            </button>
                            <a
                                href="#/berita"
                                data-link
                                class="text-xs font-semibold text-[#5c6d4e] dark:text-emerald-400 hover:underline"
                            >
                                Selengkapnya →
                            </a>
                        </div>
                    </div>

                    <div id="home-agenda-list" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="col-span-full text-xs text-stone-500 py-2">Memuat agenda &amp; pengumuman warga...</div>
                    </div>
                </section>
            </main>

            <!-- MODAL DETAIL PENGURUS RT -->
            <div id="home-paket-modal" class="hidden fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="home-paket-modal-title">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-none max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                    <div class="px-5 py-3.5 bg-[#5c6d4e] text-white flex items-center justify-between shrink-0">
                        <span id="home-paket-modal-badge" class="text-[11px] font-bold uppercase tracking-wider">DETAIL PENGURUS RT</span>
                        <button
                            type="button"
                            id="home-paket-modal-close"
                            class="text-white/85 hover:text-white text-sm font-bold px-2 py-0.5 cursor-pointer"
                            aria-label="Tutup detail"
                        >
                            ✕
                        </button>
                    </div>

                    <div class="home-no-scrollbar p-5 overflow-y-auto space-y-4">
                        <div class="bg-stone-100 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-none overflow-hidden flex items-center justify-center p-3">
                            <img
                                id="home-paket-modal-img"
                                src="${DEFAULT_IMG}"
                                alt="Foto Pengurus RT"
                                class="w-full max-h-[50vh] object-contain"
                            >
                        </div>

                        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
                            <div>
                                <h3 id="home-paket-modal-title" class="text-lg md:text-xl font-extrabold text-stone-900 dark:text-stone-100"></h3>
                                <p id="home-paket-modal-durasi" class="text-xs text-stone-500 dark:text-stone-400 mt-1"></p>
                            </div>
                            <div id="home-paket-modal-harga" class="text-sm md:text-base font-extrabold text-[#c87d32] shrink-0"></div>
                        </div>

                        <div id="home-paket-modal-fasilitas-wrap" class="hidden space-y-1">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                Kontak WhatsApp
                            </div>
                            <p id="home-paket-modal-fasilitas" class="text-xs md:text-sm font-medium text-stone-800 dark:text-stone-200"></p>
                        </div>

                        <div class="space-y-1">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                Keterangan / Masa Bhakti
                            </div>
                            <p id="home-paket-modal-desc" class="text-xs md:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line"></p>
                        </div>

                        <div class="pt-2 flex flex-wrap items-center justify-end gap-2.5 border-t border-stone-200 dark:border-stone-800">
                            <a
                                id="home-paket-modal-wa"
                                href="https://wa.me/${DEFAULT_WA_NUMBER}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4a5a3f] text-white rounded-none transition"
                            >
                                Hubungi via WhatsApp
                            </a>
                            <button
                                type="button"
                                id="home-paket-modal-close-btn"
                                class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-none transition cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL DETAIL AGENDA & PENGUMUMAN WARGA -->
            <div id="home-agenda-modal" class="hidden fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="home-agenda-modal-title">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-none max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                    <div class="px-5 py-3.5 bg-[#c87d32] text-white flex items-center justify-between shrink-0">
                        <span id="home-agenda-modal-badge" class="text-[11px] font-bold uppercase tracking-wider">AGENDA &amp; PENGUMUMAN</span>
                        <button
                            type="button"
                            id="home-agenda-modal-close"
                            class="text-white/85 hover:text-white text-sm font-bold px-2 py-0.5 cursor-pointer"
                            aria-label="Tutup detail agenda"
                        >
                            ✕
                        </button>
                    </div>

                    <div class="home-no-scrollbar p-5 overflow-y-auto space-y-4">
                        <div id="home-agenda-modal-img-wrap" class="hidden bg-stone-100 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 overflow-hidden flex items-center justify-center p-2">
                            <img
                                id="home-agenda-modal-img"
                                src="${DEFAULT_IMG}"
                                alt="Foto Agenda"
                                class="w-full max-h-64 object-contain"
                            >
                        </div>

                        <div class="space-y-1 border-b border-stone-200 dark:border-stone-800 pb-3">
                            <h3 id="home-agenda-modal-title" class="text-lg font-extrabold text-stone-900 dark:text-stone-100"></h3>
                            <div id="home-agenda-modal-meta" class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400"></div>
                        </div>

                        <div class="space-y-1">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                Rincian Informasi
                            </div>
                            <p id="home-agenda-modal-desc" class="text-xs md:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line"></p>
                        </div>

                        <div class="pt-2 flex justify-end border-t border-stone-200 dark:border-stone-800">
                            <button
                                type="button"
                                id="home-agenda-modal-close-btn"
                                class="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-none transition cursor-pointer"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function initHomeHandler() {
    let isDestroyed = false;
    let activeProfile = readCachedProfile() || { nama: DEFAULT_BRAND_NAME, telp: DEFAULT_WA_NUMBER };
    let pengurusItems = [];
    let agendaItems = [];
    let isExpanded = false;
    let isAgendaExpanded = false;

    dismissLoginOverlaySmoothly();
    syncKasLayananLinksInDom();

    if (readCachedProfile()) {
        applyProfileToDom(activeProfile);
    } else if (typeof window.syncGlobalPublicUserAvatar === "function") {
        window.syncGlobalPublicUserAvatar();
    }

    const initialRunningText = readCachedRunningText() || getFallbackDomRunningText();
    if (initialRunningText) {
        applyRunningTextToDom(initialRunningText);
    }

    const modalEl = document.getElementById("home-paket-modal");
    const modalCloseTopBtn = document.getElementById("home-paket-modal-close");
    const modalCloseBottomBtn = document.getElementById("home-paket-modal-close-btn");
    const gridEl = document.getElementById("home-featured-grid");
    const lihatSemuaBtn = document.getElementById("home-lihat-semua-btn");

    const agendaModalEl = document.getElementById("home-agenda-modal");
    const agendaCloseTopBtn = document.getElementById("home-agenda-modal-close");
    const agendaCloseBottomBtn = document.getElementById("home-agenda-modal-close-btn");
    const agendaListEl = document.getElementById("home-agenda-list");
    const agendaToggleBtn = document.getElementById("home-agenda-toggle-btn");

    const statsStatusEl = document.getElementById("home-stats-status");
    const totalWargaEl = document.getElementById("stat-total-warga");
    const lakiLakiEl = document.getElementById("stat-laki-laki");
    const lakiPctEl = document.getElementById("stat-laki-pct");
    const lakiBarEl = document.getElementById("stat-laki-bar");
    const perempuanEl = document.getElementById("stat-perempuan");
    const perempuanPctEl = document.getElementById("stat-perempuan-pct");
    const perempuanBarEl = document.getElementById("stat-perempuan-bar");
    const kepalaKeluargaEl = document.getElementById("stat-kepala-keluarga");
    const usiaUnknownEl = document.getElementById("stat-usia-unknown");

    function renderWargaStatistics(stats, sourceLabel = "") {
        if (isDestroyed) return;

        const total = Math.max(0, Number(stats?.totalWarga || 0));
        const laki = Math.max(0, Number(stats?.lakiLaki || 0));
        const perempuan = Math.max(0, Number(stats?.perempuan || 0));
        const kk = Math.max(0, Number(stats?.kepalaKeluarga || 0));
        const genderBase = laki + perempuan > 0 ? laki + perempuan : total;

        const lakiPct = genderBase > 0 ? Math.round((laki / genderBase) * 100) : 0;
        const perempuanPct = genderBase > 0 ? Math.round((perempuan / genderBase) * 100) : 0;

        if (totalWargaEl) totalWargaEl.textContent = formatAngkaIndo(total);
        if (lakiLakiEl) lakiLakiEl.textContent = formatAngkaIndo(laki);
        if (lakiPctEl) lakiPctEl.textContent = `${lakiPct}%`;
        if (lakiBarEl) lakiBarEl.style.width = `${Math.min(100, Math.max(0, lakiPct))}%`;

        if (perempuanEl) perempuanEl.textContent = formatAngkaIndo(perempuan);
        if (perempuanPctEl) perempuanPctEl.textContent = `${perempuanPct}%`;
        if (perempuanBarEl) perempuanBarEl.style.width = `${Math.min(100, Math.max(0, perempuanPct))}%`;

        if (kepalaKeluargaEl) kepalaKeluargaEl.textContent = formatAngkaIndo(kk);

        const usia = stats?.usia || {};
        const ageGroups = [
            { key: "anak", count: Number(usia.anak || 0) },
            { key: "remaja", count: Number(usia.remaja || 0) },
            { key: "dewasa", count: Number(usia.dewasa || 0) },
            { key: "lansia", count: Number(usia.lansia || 0) }
        ];
        const unknownAge = Number(usia.tidak_diketahui || 0);
        const ageBase = ageGroups.reduce((acc, g) => acc + g.count, 0);

        ageGroups.forEach((g) => {
            const pct = ageBase > 0 ? Math.round((g.count / ageBase) * 100) : 0;
            const labelEl = document.getElementById(`age-${g.key}-label`);
            const barEl = document.getElementById(`age-${g.key}-bar`);
            if (labelEl) labelEl.textContent = `${formatAngkaIndo(g.count)} (${pct}%)`;
            if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        });

        if (usiaUnknownEl) {
            usiaUnknownEl.textContent = unknownAge > 0
                ? `Usia belum terisi: ${formatAngkaIndo(unknownAge)} warga`
                : `Total terklasifikasi usia: ${formatAngkaIndo(ageBase)} warga`;
        }

        if (statsStatusEl) {
            statsStatusEl.textContent = total > 0
                ? (sourceLabel || "Data terkini")
                : "Belum ada data warga";
        }
    }

    function syncLihatSemuaButton() {
        if (!lihatSemuaBtn) return;
        const initialLimit = isMobileViewport() ? MOBILE_INITIAL_LIMIT : DESKTOP_INITIAL_LIMIT;
        if (pengurusItems.length <= initialLimit) {
            lihatSemuaBtn.classList.add("hidden");
            return;
        }
        lihatSemuaBtn.classList.remove("hidden");
        lihatSemuaBtn.textContent = isExpanded ? "Sembunyikan ↑" : "Lihat Semua →";
        lihatSemuaBtn.setAttribute("aria-expanded", String(isExpanded));
    }

    function syncAgendaToggleButton() {
        if (!agendaToggleBtn) return;
        if (agendaItems.length <= AGENDA_INITIAL_LIMIT) {
            agendaToggleBtn.classList.add("hidden");
            return;
        }
        agendaToggleBtn.classList.remove("hidden");
        agendaToggleBtn.textContent = isAgendaExpanded ? "Sembunyikan ↑" : `Lihat Semua (${agendaItems.length}) →`;
        agendaToggleBtn.setAttribute("aria-expanded", String(isAgendaExpanded));
    }

    function renderPengurusGrid() {
        if (!gridEl || isDestroyed) return;

        syncLihatSemuaButton();

        if (!pengurusItems.length) {
            gridEl.innerHTML = `<div class="col-span-full text-xs text-stone-500 py-2">Belum ada data pengurus RT aktif.</div>`;
            return;
        }

        const initialLimit = isMobileViewport() ? MOBILE_INITIAL_LIMIT : DESKTOP_INITIAL_LIMIT;
        const visibleItems = isExpanded ? pengurusItems : pengurusItems.slice(0, initialLimit);

        gridEl.innerHTML = visibleItems.map((p) => {
            const rawFoto = p.fotoProfil || p.foto || p.gambar || p.url || DEFAULT_IMG;
            const fotoSrc = escapeHtml(isSafeImageSrc(rawFoto) ? rawFoto : DEFAULT_IMG);
            const namaPengurus = escapeHtml(p.nama || "Pengurus RT");
            const jabatanText = escapeHtml(p.jabatan || "Pengurus RT");

            return `
                <button
                    type="button"
                    data-paket-id="${escapeHtml(p.id)}"
                    class="group text-left w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden hover:border-[#c87d32] transition flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#c87d32]"
                >
                    <div class="w-full h-36 sm:h-40 bg-stone-100 dark:bg-stone-800/70 p-2 flex items-center justify-center overflow-hidden border-b border-stone-100 dark:border-stone-800">
                        <img
                            src="${fotoSrc}"
                            alt="${namaPengurus}"
                            class="w-full h-full object-contain group-hover:scale-[1.03] transition duration-300"
                            onerror="this.onerror=null;this.src='${DEFAULT_IMG}';"
                        >
                    </div>
                    <div class="p-2.5 flex-1 flex flex-col justify-center">
                        <div class="text-xs font-bold text-stone-800 dark:text-stone-100 line-clamp-1">${namaPengurus}</div>
                        <div class="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">${jabatanText}</div>
                    </div>
                </button>
            `;
        }).join("");
    }

    function renderAgendaList() {
        if (!agendaListEl || isDestroyed) return;

        syncAgendaToggleButton();

        if (!agendaItems.length) {
            agendaListEl.innerHTML = `
                <div class="col-span-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3.5 text-xs text-stone-500 dark:text-stone-400">
                    Belum ada agenda atau pengumuman warga terbaru.
                </div>
            `;
            return;
        }

        const visibleItems = isAgendaExpanded ? agendaItems : agendaItems.slice(0, AGENDA_INITIAL_LIMIT);

        agendaListEl.innerHTML = visibleItems.map((item) => {
            const isAgenda = item.jenis === "Agenda";
            const badgeClass = isAgenda
                ? "bg-amber-100 text-[#9a5518] dark:bg-amber-950/70 dark:text-amber-300"
                : "bg-emerald-100 text-[#435636] dark:bg-emerald-950/70 dark:text-emerald-300";
            const metaParts = [
                item.tanggalLabel ? `📅 ${escapeHtml(item.tanggalLabel)}` : "",
                item.waktu ? `🕒 ${escapeHtml(item.waktu)}` : "",
                item.lokasi ? `📍 ${escapeHtml(item.lokasi)}` : ""
            ].filter(Boolean).join(" • ");

            return `
                <button
                    type="button"
                    data-agenda-id="${escapeHtml(item.id)}"
                    class="text-left w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-[#c87d32] p-3.5 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#c87d32] space-y-1.5"
                >
                    <div class="flex items-center justify-between gap-2">
                        <span class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}">
                            ${escapeHtml(item.jenis)}
                        </span>
                        ${item.tanggalLabel ? `<span class="text-[11px] text-stone-500 dark:text-stone-400 shrink-0">${escapeHtml(item.tanggalLabel)}</span>` : ""}
                    </div>
                    <div class="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 line-clamp-1">
                        ${escapeHtml(item.judul)}
                    </div>
                    <p class="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">
                        ${escapeHtml(item.isi)}
                    </p>
                    ${metaParts ? `<div class="text-[11px] text-stone-500 dark:text-stone-400 pt-0.5 line-clamp-1">${metaParts}</div>` : ""}
                </button>
            `;
        }).join("");
    }

    function closePaketModal() {
        modalEl?.classList.add("hidden");
    }

    function closeAgendaModal() {
        agendaModalEl?.classList.add("hidden");
    }

    function openAgendaModal(item) {
        if (!item || !agendaModalEl) return;

        const badgeEl = document.getElementById("home-agenda-modal-badge");
        const imgWrapEl = document.getElementById("home-agenda-modal-img-wrap");
        const imgEl = document.getElementById("home-agenda-modal-img");
        const titleEl = document.getElementById("home-agenda-modal-title");
        const metaEl = document.getElementById("home-agenda-modal-meta");
        const descEl = document.getElementById("home-agenda-modal-desc");

        if (badgeEl) badgeEl.textContent = item.jenis.toUpperCase();
        if (imgWrapEl && imgEl) {
            if (item.foto && isSafeImageSrc(item.foto)) {
                imgEl.onerror = () => {
                    imgWrapEl.classList.add("hidden");
                };
                imgEl.src = item.foto;
                imgEl.alt = item.judul;
                imgWrapEl.classList.remove("hidden");
            } else {
                imgWrapEl.classList.add("hidden");
            }
        }
        if (titleEl) titleEl.textContent = item.judul;
        if (metaEl) {
            const chunks = [
                item.tanggalLabel ? `<span>📅 ${escapeHtml(item.tanggalLabel)}</span>` : "",
                item.waktu ? `<span>🕒 ${escapeHtml(item.waktu)}</span>` : "",
                item.lokasi ? `<span>📍 ${escapeHtml(item.lokasi)}</span>` : ""
            ].filter(Boolean);
            metaEl.innerHTML = chunks.join("");
            metaEl.classList.toggle("hidden", chunks.length === 0);
        }
        if (descEl) descEl.textContent = item.isi;

        agendaModalEl.classList.remove("hidden");
    }

    function openPaketModal(pengurus) {
        if (!pengurus || !modalEl) return;

        const nama = pengurus.nama || "Pengurus RT";
        const jabatan = String(pengurus.jabatan || "Pengurus RT").trim();
        const noWa = String(pengurus.noWa || pengurus.telepon || "").trim();
        const keterangan = String(pengurus.keterangan || "").trim();
        const rawFoto = pengurus.fotoProfil || pengurus.foto || pengurus.gambar || pengurus.url || DEFAULT_IMG;
        const fotoSrc = isSafeImageSrc(rawFoto) ? rawFoto : DEFAULT_IMG;

        const badgeEl = document.getElementById("home-paket-modal-badge");
        const imgEl = document.getElementById("home-paket-modal-img");
        const titleEl = document.getElementById("home-paket-modal-title");
        const durasiEl = document.getElementById("home-paket-modal-durasi");
        const hargaEl = document.getElementById("home-paket-modal-harga");
        const fasilitasWrapEl = document.getElementById("home-paket-modal-fasilitas-wrap");
        const fasilitasEl = document.getElementById("home-paket-modal-fasilitas");
        const descEl = document.getElementById("home-paket-modal-desc");
        const waEl = document.getElementById("home-paket-modal-wa");

        if (badgeEl) badgeEl.textContent = `DETAIL PENGURUS RT • ${jabatan.toUpperCase()}`;
        if (imgEl) {
            imgEl.onerror = () => {
                imgEl.onerror = null;
                imgEl.src = DEFAULT_IMG;
            };
            imgEl.src = fotoSrc;
            imgEl.alt = nama;
        }
        if (titleEl) titleEl.textContent = nama;
        if (durasiEl) {
            durasiEl.textContent = jabatan ? `Jabatan: ${jabatan}` : "";
            durasiEl.classList.toggle("hidden", !jabatan);
        }
        if (hargaEl) {
            hargaEl.textContent = jabatan;
        }
        if (fasilitasWrapEl && fasilitasEl) {
            if (noWa) {
                fasilitasEl.textContent = noWa;
                fasilitasWrapEl.classList.remove("hidden");
            } else {
                fasilitasWrapEl.classList.add("hidden");
            }
        }
        if (descEl) {
            descEl.textContent = keterangan && keterangan !== "-"
                ? keterangan
                : "Pengurus aktif lingkungan RT.";
        }

        if (waEl) {
            const waNumber = normalizeWaNumber(noWa || activeProfile?.telp);
            const brandName = activeProfile?.nama || DEFAULT_BRAND_NAME;
            const textWa = `Halo ${nama} (${jabatan} ${brandName}), saya ingin menghubungi terkait informasi warga.`;
            waEl.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(textWa)}`;
        }

        modalEl.classList.remove("hidden");
    }

    const handleGridClick = (e) => {
        const cardBtn = e.target.closest("[data-paket-id]");
        if (!cardBtn) return;
        e.preventDefault();
        const id = cardBtn.getAttribute("data-paket-id");
        const found = pengurusItems.find((p) => String(p.id) === String(id));
        if (found) openPaketModal(found);
    };

    const handleAgendaListClick = (e) => {
        const cardBtn = e.target.closest("[data-agenda-id]");
        if (!cardBtn) return;
        e.preventDefault();
        const id = cardBtn.getAttribute("data-agenda-id");
        const found = agendaItems.find((item) => String(item.id) === String(id));
        if (found) openAgendaModal(found);
    };

    const handleAgendaToggleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isAgendaExpanded = !isAgendaExpanded;
        renderAgendaList();
    };

    const handleLihatSemuaClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isExpanded = !isExpanded;
        renderPengurusGrid();
    };

    let lastViewportMobile = isMobileViewport();
    const handleViewportResize = () => {
        if (isDestroyed) return;
        const currentMobile = isMobileViewport();
        if (currentMobile !== lastViewportMobile) {
            lastViewportMobile = currentMobile;
            if (!isExpanded && pengurusItems.length > 0) {
                renderPengurusGrid();
            } else {
                syncLihatSemuaButton();
            }
        }
    };

    const handleModalBackdropClick = (e) => {
        if (e.target === modalEl) {
            closePaketModal();
        }
        if (e.target === agendaModalEl) {
            closeAgendaModal();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            if (modalEl && !modalEl.classList.contains("hidden")) {
                closePaketModal();
            }
            if (agendaModalEl && !agendaModalEl.classList.contains("hidden")) {
                closeAgendaModal();
            }
        }
    };

    gridEl?.addEventListener("click", handleGridClick);
    lihatSemuaBtn?.addEventListener("click", handleLihatSemuaClick);
    agendaListEl?.addEventListener("click", handleAgendaListClick);
    agendaToggleBtn?.addEventListener("click", handleAgendaToggleClick);
    window.addEventListener("resize", handleViewportResize);
    modalCloseTopBtn?.addEventListener("click", closePaketModal);
    modalCloseBottomBtn?.addEventListener("click", closePaketModal);
    agendaCloseTopBtn?.addEventListener("click", closeAgendaModal);
    agendaCloseBottomBtn?.addEventListener("click", closeAgendaModal);
    modalEl?.addEventListener("click", handleModalBackdropClick);
    agendaModalEl?.addEventListener("click", handleModalBackdropClick);
    document.addEventListener("keydown", handleKeyDown);

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (isDestroyed) return;
        if (user?.photoURL && isSafeImageSrc(user.photoURL)) {
            localStorage.setItem("user_avatar", user.photoURL);
        }
        if (user?.displayName) {
            const formattedName = user.displayName.charAt(0).toUpperCase() + user.displayName.slice(1);
            if (!localStorage.getItem("user_name")) {
                localStorage.setItem("user_name", formattedName);
            }
        }
        if (typeof window.syncGlobalPublicUserAvatar === "function") {
            window.syncGlobalPublicUserAvatar();
        }
    });

    (async () => {
        const [
            profResult,
            pengurusResult,
            runningTextResult,
            beritaResult,
            wargaResult,
            dataWargaResult,
            kkResult,
            statsDocResult
        ] = await Promise.allSettled([
            getDoc(doc(db, "pengaturan", "profil_perusahaan")),
            getDocs(collection(db, "pengurus_rt")),
            getDocs(collection(db, "running_text")),
            getDocs(collection(db, "berita")),
            getDocs(collection(db, "warga")),
            getDocs(collection(db, "data_warga")),
            getDocs(collection(db, "kk")),
            getDoc(doc(db, "pengaturan", "statistik_warga"))
        ]);

        if (isDestroyed) return;

        let profileRunningText = "";
        if (profResult.status === "fulfilled" && profResult.value.exists()) {
            const rawProf = profResult.value.data() || {};
            profileRunningText = String(rawProf.runningText || rawProf.running_text || rawProf.pengumuman || "").trim();
            const normalized = normalizeProfileData(rawProf);
            activeProfile = normalized;
            writeCachedProfile(normalized);
            applyProfileToDom(normalized);
        } else if (profResult.status === "rejected") {
            console.warn("Profil RTKu Digital belum dapat dimuat:", profResult.reason?.message || profResult.reason);
        }

        const wargaDocs = [];
        if (wargaResult.status === "fulfilled") {
            wargaResult.value.forEach((d) => wargaDocs.push(d.data() || {}));
        }
        if (!wargaDocs.length && dataWargaResult.status === "fulfilled") {
            dataWargaResult.value.forEach((d) => wargaDocs.push(d.data() || {}));
        }

        const kkDocs = [];
        if (kkResult.status === "fulfilled") {
            kkResult.value.forEach((d) => kkDocs.push(d.data() || {}));
        }

        const summaryData = statsDocResult.status === "fulfilled" && statsDocResult.value.exists()
            ? statsDocResult.value.data()
            : null;

        const computedStats = aggregateWargaStatistics(wargaDocs, kkDocs, summaryData);
        const statsSourceLabel = wargaDocs.length > 0
            ? `Dari ${formatAngkaIndo(wargaDocs.length)} data warga`
            : (summaryData ? "Ringkasan statistik" : "");
        renderWargaStatistics(computedStats, statsSourceLabel);

        let resolvedRunningText = "";
        if (runningTextResult.status === "fulfilled") {
            const activeTexts = [];
            runningTextResult.value.forEach((tDoc) => {
                const d = tDoc.data() || {};
                const statusStr = String(d.status || "Aktif").trim().toLowerCase();
                const isActive = typeof d.aktif === "boolean"
                    ? d.aktif
                    : (statusStr === "aktif" || statusStr === "active" || statusStr === "true" || statusStr === "");
                const isi = String(d.teks || d.text || d.isi || d.pesan || d.judul || "").trim();
                if (isActive && isi) {
                    activeTexts.push({
                        isi,
                        urutan: Number(d.urutan ?? 999),
                        createdAt: String(d.createdAt || "")
                    });
                }
            });
            activeTexts.sort((a, b) => a.urutan - b.urutan || b.createdAt.localeCompare(a.createdAt));
            if (activeTexts.length) {
                resolvedRunningText = activeTexts.map((item) => item.isi).join("   •   ");
            }
        }

        if (!resolvedRunningText) {
            resolvedRunningText = profileRunningText || getFallbackDomRunningText() || readCachedRunningText();
        }
        writeCachedRunningText(resolvedRunningText);
        applyRunningTextToDom(resolvedRunningText);

        if (gridEl && !isDestroyed) {
            if (pengurusResult.status === "fulfilled") {
                const daftarPengurus = [];
                pengurusResult.value.forEach((pDoc) => {
                    const p = pDoc.data() || {};
                    const status = String(p.status || "Aktif").trim().toLowerCase();
                    if (status === "aktif" || status === "") {
                        daftarPengurus.push({ id: pDoc.id, ...p });
                    }
                });
                daftarPengurus.sort((a, b) => {
                    const jabA = String(a.jabatan || "").toLowerCase();
                    const jabB = String(b.jabatan || "").toLowerCase();
                    const isKetuaA = jabA.includes("ketua rt") && !jabA.includes("wakil");
                    const isKetuaB = jabB.includes("ketua rt") && !jabB.includes("wakil");
                    if (isKetuaA && !isKetuaB) return -1;
                    if (!isKetuaA && isKetuaB) return 1;
                    return String(a.nama || "").localeCompare(String(b.nama || ""), "id");
                });
                pengurusItems = daftarPengurus;
                isExpanded = false;
                renderPengurusGrid();
            } else {
                console.warn("Data pengurus RT belum dapat dimuat:", pengurusResult.reason?.message || pengurusResult.reason);
                gridEl.innerHTML = `<div class="col-span-full text-xs text-stone-500 py-2">Data pengurus RT belum tersedia.</div>`;
            }
        }

        if (agendaListEl && !isDestroyed) {
            const collectedAgenda = [];

            if (beritaResult.status === "fulfilled") {
                beritaResult.value.forEach((bDoc) => {
                    const d = bDoc.data() || {};
                    const status = String(d.status || "Aktif").trim().toLowerCase();
                    const isActive = typeof d.aktif === "boolean"
                        ? d.aktif
                        : (status === "aktif" || status === "published" || status === "publish" || status === "");
                    if (isActive) {
                        collectedAgenda.push(normalizeAgendaEntry(bDoc.id, d, "Pengumuman"));
                    }
                });
            }

            if (!collectedAgenda.length) {
                const [agendaSnap, pengumumanSnap] = await Promise.allSettled([
                    getDocs(collection(db, "agenda_warga")),
                    getDocs(collection(db, "pengumuman"))
                ]);

                if (agendaSnap.status === "fulfilled") {
                    agendaSnap.value.forEach((aDoc) => {
                        const d = aDoc.data() || {};
                        const status = String(d.status || "Aktif").trim().toLowerCase();
                        if (status === "aktif" || status === "") {
                            collectedAgenda.push(normalizeAgendaEntry(`agenda_${aDoc.id}`, d, "Agenda"));
                        }
                    });
                }

                if (pengumumanSnap.status === "fulfilled") {
                    pengumumanSnap.value.forEach((pDoc) => {
                        const d = pDoc.data() || {};
                        const status = String(d.status || "Aktif").trim().toLowerCase();
                        if (status === "aktif" || status === "") {
                            collectedAgenda.push(normalizeAgendaEntry(`pengumuman_${pDoc.id}`, d, "Pengumuman"));
                        }
                    });
                }
            }

            collectedAgenda.sort((a, b) => String(b.rawTanggal || "").localeCompare(String(a.rawTanggal || "")));
            agendaItems = collectedAgenda;
            isAgendaExpanded = false;
            renderAgendaList();
        }
    })();

    return () => {
        isDestroyed = true;
        gridEl?.removeEventListener("click", handleGridClick);
        lihatSemuaBtn?.removeEventListener("click", handleLihatSemuaClick);
        agendaListEl?.removeEventListener("click", handleAgendaListClick);
        agendaToggleBtn?.removeEventListener("click", handleAgendaToggleClick);
        window.removeEventListener("resize", handleViewportResize);
        modalCloseTopBtn?.removeEventListener("click", closePaketModal);
        modalCloseBottomBtn?.removeEventListener("click", closePaketModal);
        agendaCloseTopBtn?.removeEventListener("click", closeAgendaModal);
        agendaCloseBottomBtn?.removeEventListener("click", closeAgendaModal);
        modalEl?.removeEventListener("click", handleModalBackdropClick);
        agendaModalEl?.removeEventListener("click", handleModalBackdropClick);
        document.removeEventListener("keydown", handleKeyDown);
        unsubscribeAuth?.();
    };
}

export default renderHome;