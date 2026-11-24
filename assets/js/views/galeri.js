// File: assets/js/views/galeri.js
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const GALERI_COLLECTION = "galeri";
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

function formatWhatsAppUrl(rawPhone = "", brandName = "BUMKal Sinar Mitra Desa") {
    let digits = String(rawPhone || "").replace(/\D/g, "");
    if (!digits) digits = DEFAULT_WA_NUMBER;
    if (digits.startsWith("0")) {
        digits = "62" + digits.slice(1);
    }
    const msg = encodeURIComponent(`Halo ${brandName}, saya ingin bertanya terkait paket wisata dan galeri kegiatan.`);
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
    const nama = String(p.nama || "BUMKal Sinar Mitra Desa").trim() || "BUMKal Sinar Mitra Desa";
    const alamat = String(p.alamat || p.alamat_lengkap || "Srihardono, Pundong, Bantul, Indonesia").trim() || "Srihardono, Pundong, Bantul, Indonesia";
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
    const nama = profile.nama || "BUMKal Sinar Mitra Desa";
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

export function renderGaleri() {
    return `
        <div class="galeri-landing-root bg-[#f6f3ec] dark:bg-stone-950 text-stone-800 dark:text-stone-100 min-h-full">
            <!-- KONTEN UTAMA -->
            <div class="max-w-6xl w-full mx-auto px-4 md:px-6 py-5 space-y-5">
                <!-- Header & Filter -->
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 sm:p-5 space-y-3.5">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                            <h1 class="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug">
                                Galeri Kegiatan &amp; Potensi Desa
                            </h1>
                            <p id="galeri-summary" class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                Memuat dokumentasi galeri...
                            </p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="sm:col-span-2">
                            <label for="galeri-search" class="sr-only">Cari galeri</label>
                            <input
                                type="text"
                                id="galeri-search"
                                placeholder="Cari judul foto, kategori, atau deskripsi kegiatan..."
                                class="w-full px-3 py-2 text-xs bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:border-[#c87d32]"
                            >
                        </div>

                        <div>
                            <label for="galeri-kategori-filter" class="sr-only">Filter kategori</label>
                            <select
                                id="galeri-kategori-filter"
                                class="w-full px-3 py-2 text-xs bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                                <option value="all">Semua Kategori</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Grid Galeri -->
                <section
                    id="galeri-grid"
                    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-2"
                >
                    <div class="col-span-full bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                        Memuat data galeri dari database...
                    </div>
                </section>
            </div>
        </div>

        <!-- LIGHTBOX MODAL -->
        <div id="galeri-lightbox" class="hidden fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 max-w-2xl w-full overflow-hidden shadow-2xl">
                <div class="flex items-center justify-between px-4 py-3 border-b border-stone-200 dark:border-stone-800">
                    <h2 id="lightbox-title" class="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">Detail Foto</h2>
                    <button id="btn-close-lightbox" type="button" class="text-xs font-semibold px-2.5 py-1 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-100 hover:bg-stone-300 transition cursor-pointer">
                        Tutup ✕
                    </button>
                </div>
                <div class="bg-stone-900 flex items-center justify-center max-h-[65vh] overflow-hidden">
                    <img id="lightbox-img" src="" alt="" class="w-full max-h-[65vh] object-contain">
                </div>
                <div class="p-4 space-y-1">
                    <div id="lightbox-category" class="text-[11px] font-semibold uppercase tracking-wider text-[#c87d32]"></div>
                    <p id="lightbox-desc" class="text-xs text-stone-600 dark:text-stone-300 leading-relaxed"></p>
                </div>
            </div>
        </div>
    `;
}

export async function initGaleriHandler() {
    let isDestroyed = false;
    let allItems = [];

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

    const gridEl = document.getElementById("galeri-grid");
    const summaryEl = document.getElementById("galeri-summary");
    const searchInput = document.getElementById("galeri-search");
    const categorySelect = document.getElementById("galeri-kategori-filter");
    const lightboxEl = document.getElementById("galeri-lightbox");
    const btnCloseLightbox = document.getElementById("btn-close-lightbox");

    if (typeof window.syncRunningTextPosition === "function") {
        window.syncRunningTextPosition(true);
    }

    function populateCategories(items) {
        if (!categorySelect) return;
        const currentVal = categorySelect.value || "all";
        const categories = Array.from(
            new Set(
                items
                    .map((it) => String(it.kategori || it.category || "").trim())
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b, "id"));

        categorySelect.innerHTML = `<option value="all">Semua Kategori</option>` + categories
            .map((cat) => `<option value="${escapeHtml(cat.toLowerCase())}">${escapeHtml(cat)}</option>`)
            .join("");

        if (Array.from(categorySelect.options).some((opt) => opt.value === currentVal)) {
            categorySelect.value = currentVal;
        }
    }

    function renderGaleriCard(item, idx) {
        const judul = escapeHtml(item.judul || item.nama || item.title || "Dokumentasi Kegiatan");
        const deskripsi = escapeHtml(item.deskripsi || item.keterangan || item.caption || "-");
        const kategori = escapeHtml(item.kategori || item.category || "Umum");
        const rawImg = item.foto || item.gambar || item.imageUrl || item.url || DEFAULT_IMG;
        const imgSrc = escapeHtml(isSafeImageSrc(rawImg) ? rawImg : DEFAULT_IMG);

        return `
            <article
                data-galeri-index="${idx}"
                class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-hidden flex flex-col justify-between hover:border-[#c87d32] transition cursor-pointer group"
            >
                <div>
                    <div class="relative w-full h-44 bg-stone-100 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-800 overflow-hidden">
                        <img
                            src="${imgSrc}"
                            alt="${judul}"
                            class="w-full h-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            onerror="this.onerror=null;this.src='${DEFAULT_IMG}';"
                        >
                        <span class="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-stone-900/75 text-white border border-white/20 rounded-none">
                            ${kategori}
                        </span>
                    </div>
                    <div class="p-4 space-y-1">
                        <h2 class="text-sm font-bold text-stone-900 dark:text-stone-100 line-clamp-1">${judul}</h2>
                        <p class="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">${deskripsi}</p>
                    </div>
                </div>
            </article>
        `;
    }

    function applyFilterAndRender() {
        if (!gridEl || isDestroyed) return;

        const keyword = String(searchInput?.value || "").trim().toLowerCase();
        const selectedCategory = String(categorySelect?.value || "all").trim().toLowerCase();

        const filtered = allItems.filter((item) => {
            const itemCat = String(item.kategori || item.category || "umum").trim().toLowerCase();
            if (selectedCategory !== "all" && itemCat !== selectedCategory) {
                return false;
            }
            if (!keyword) return true;
            const haystack = [
                item.judul,
                item.nama,
                item.title,
                item.deskripsi,
                item.keterangan,
                item.caption,
                item.kategori,
                item.category
            ]
                .map((v) => String(v || "").toLowerCase())
                .join(" ");
            return haystack.includes(keyword);
        });

        if (summaryEl) {
            summaryEl.textContent = `Menampilkan ${filtered.length} dari ${allItems.length} foto galeri`;
        }

        if (!filtered.length) {
            gridEl.innerHTML = `
                <div class="col-span-full bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-8 text-center">
                    <img src="${DEFAULT_IMG}" alt="Kosong" class="h-12 w-12 object-contain mx-auto mb-2.5 opacity-80">
                    <p class="text-xs font-semibold text-stone-600 dark:text-stone-300">
                        Belum ada foto galeri yang sesuai.
                    </p>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = filtered.map((it, i) => renderGaleriCard(it, i)).join("");
        gridEl._filteredItems = filtered;
    }

    const closeLightbox = () => {
        lightboxEl?.classList.add("hidden");
    };

    const onGridClick = (e) => {
        const card = e.target.closest("[data-galeri-index]");
        if (!card || !lightboxEl) return;
        const idx = Number(card.getAttribute("data-galeri-index"));
        const list = gridEl?._filteredItems || allItems;
        const item = list[idx];
        if (!item) return;

        const rawImg = item.foto || item.gambar || item.imageUrl || item.url || DEFAULT_IMG;
        const imgEl = document.getElementById("lightbox-img");
        const titleEl = document.getElementById("lightbox-title");
        const catEl = document.getElementById("lightbox-category");
        const descEl = document.getElementById("lightbox-desc");

        if (imgEl) {
            imgEl.onerror = () => {
                imgEl.onerror = null;
                imgEl.src = DEFAULT_IMG;
            };
            imgEl.src = isSafeImageSrc(rawImg) ? rawImg : DEFAULT_IMG;
        }
        if (titleEl) titleEl.textContent = item.judul || item.nama || item.title || "Dokumentasi Kegiatan";
        if (catEl) catEl.textContent = item.kategori || item.category || "Umum";
        if (descEl) descEl.textContent = item.deskripsi || item.keterangan || item.caption || "-";

        lightboxEl.classList.remove("hidden");
    };

    const onBackdropClick = (e) => {
        if (e.target === lightboxEl) closeLightbox();
    };

    const onKeyDown = (e) => {
        if (e.key === "Escape") closeLightbox();
    };

    const onFilterChange = () => applyFilterAndRender();

    searchInput?.addEventListener("input", onFilterChange);
    categorySelect?.addEventListener("change", onFilterChange);
    gridEl?.addEventListener("click", onGridClick);
    btnCloseLightbox?.addEventListener("click", closeLightbox);
    lightboxEl?.addEventListener("click", onBackdropClick);
    document.addEventListener("keydown", onKeyDown);

    const [profResult, galeriResult] = await Promise.allSettled([
        getDoc(doc(db, "pengaturan", "profil_perusahaan")),
        getDocs(collection(db, GALERI_COLLECTION))
    ]);

    if (isDestroyed) return;

    if (profResult.status === "fulfilled" && profResult.value.exists()) {
        const normalized = normalizeProfileData(profResult.value.data() || {});
        writeCachedProfile(normalized);
        applyProfileToDom(normalized);
    }

    if (galeriResult.status === "fulfilled") {
        const items = [];
        galeriResult.value.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...(docSnap.data() || {}) });
        });
        items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        allItems = items;
        populateCategories(allItems);
        applyFilterAndRender();
    } else {
        console.warn("Gagal memuat data galeri:", galeriResult.reason);
        if (summaryEl) summaryEl.textContent = "Data galeri belum tersedia";
        if (gridEl) {
            gridEl.innerHTML = `
                <div class="col-span-full bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-8 text-center text-xs text-stone-500">
                    Belum ada foto galeri yang dapat ditampilkan.
                </div>
            `;
        }
    }

    return () => {
        isDestroyed = true;
        if (sidebarEl) {
            sidebarEl.style.display = prevSidebarDisplay;
        }
        searchInput?.removeEventListener("input", onFilterChange);
        categorySelect?.removeEventListener("change", onFilterChange);
        gridEl?.removeEventListener("click", onGridClick);
        btnCloseLightbox?.removeEventListener("click", closeLightbox);
        lightboxEl?.removeEventListener("click", onBackdropClick);
        document.removeEventListener("keydown", onKeyDown);
    };
}