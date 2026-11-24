// File: assets/js/views/kontak.js
import { doc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

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

function normalizeWaDigits(rawPhone = "") {
    let digits = String(rawPhone || "").replace(/\D/g, "");
    if (!digits) digits = DEFAULT_WA_NUMBER;
    if (digits.startsWith("0")) {
        digits = "62" + digits.slice(1);
    }
    return digits;
}

function formatWhatsAppUrl(rawPhone = "", brandName = "BUMKal Sinar Mitra Desa", customText = "") {
    const digits = normalizeWaDigits(rawPhone);
    const msg = encodeURIComponent(
        customText || `Halo ${brandName}, saya ingin menghubungi admin terkait informasi dan layanan.`
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
    const kAddr = document.getElementById("kontak-alamat");
    const kPhone = document.getElementById("kontak-telepon");
    const kEmail = document.getElementById("kontak-email");
    const fPhone = document.getElementById("global-footer-phone") || document.getElementById("footer-phone");
    const fEmail = document.getElementById("global-footer-email") || document.getElementById("footer-email");
    const fAddr = document.getElementById("global-footer-address") || document.getElementById("footer-address");
    const fBrand = document.getElementById("global-footer-brand") || document.getElementById("footer-brand");
    const waDirectBtn = document.getElementById("btn-kontak-wa-langsung");

    if (pubBrand && pubBrand.textContent !== nama) pubBrand.textContent = nama;
    if (pubLogo && profile.iconUrl) setSmoothImageSrc(pubLogo, profile.iconUrl, DEFAULT_IMG);
    if (kAddr) kAddr.textContent = profile.alamat;
    if (kPhone) kPhone.textContent = profile.telp;
    if (kEmail) kEmail.textContent = profile.email;
    if (fPhone && fPhone.textContent !== profile.telp) fPhone.textContent = profile.telp;
    if (fEmail && fEmail.textContent !== profile.email) fEmail.textContent = profile.email;
    if (fAddr && fAddr.textContent !== profile.alamat) fAddr.textContent = profile.alamat;
    if (fBrand && fBrand.textContent !== nama) fBrand.textContent = nama;

    const bookingHref = formatWhatsAppUrl(
        profile.telp,
        nama,
        `Halo ${nama}, saya ingin bertanya terkait booking paket wisata.`
    );
    const directWaHref = formatWhatsAppUrl(profile.telp, nama);
    if (pubBooking) pubBooking.href = bookingHref;
    if (waDirectBtn) waDirectBtn.href = directWaHref;

    if (typeof window.syncGlobalPublicUserAvatar === "function") {
        window.syncGlobalPublicUserAvatar();
    }
}

export function renderKontak() {
    return `
        <div class="kontak-landing-root bg-[#f6f3ec] dark:bg-stone-950 text-stone-800 dark:text-stone-100 min-h-full">
            <!-- KONTEN UTAMA -->
            <div class="max-w-6xl w-full mx-auto px-4 md:px-6 py-5">
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    <!-- Informasi Kontak -->
                    <section class="lg:col-span-5 bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-5 space-y-4">
                        <div>
                            <h1 class="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">Hubungi Kami</h1>
                            <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                Informasi sekretariat, layanan wisata, dan kanal komunikasi resmi.
                            </p>
                        </div>

                        <div class="space-y-3 text-xs">
                            <div class="p-3 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                                <div class="text-[11px] font-semibold text-stone-500 dark:text-stone-400">Alamat</div>
                                <div id="kontak-alamat" class="font-medium text-stone-800 dark:text-stone-100 mt-0.5">
                                    Srihardono, Pundong, Bantul, Indonesia
                                </div>
                            </div>

                            <div class="p-3 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                                <div class="text-[11px] font-semibold text-stone-500 dark:text-stone-400">Telepon / WhatsApp</div>
                                <div id="kontak-telepon" class="font-semibold text-stone-800 dark:text-stone-100 mt-0.5">
                                    089602510491
                                </div>
                            </div>

                            <div class="p-3 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                                <div class="text-[11px] font-semibold text-stone-500 dark:text-stone-400">Email</div>
                                <div id="kontak-email" class="font-medium text-stone-800 dark:text-stone-100 mt-0.5">
                                    bumkalsri@gmail.com
                                </div>
                            </div>
                        </div>

                        <a
                            id="btn-kontak-wa-langsung"
                            href="https://wa.me/6289602510491?text=Halo%20BUMKal%20Sinar%20Mitra%20Desa%2C%20saya%20ingin%20menghubungi%20admin%20terkait%20informasi%20dan%20layanan."
                            target="_blank"
                            rel="noopener noreferrer"
                            class="w-full inline-flex items-center justify-center gap-2 bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white text-xs font-semibold py-2.5 px-4 rounded-none transition"
                        >
                            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                            </svg>
                            <span>Chat WhatsApp Langsung</span>
                        </a>
                    </section>

                    <!-- Form Pesan -->
                    <section class="lg:col-span-7 bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-5 space-y-4">
                        <div>
                            <h2 class="text-base font-bold text-stone-900 dark:text-stone-100">Kirim Pesan</h2>
                            <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                Sampaikan pertanyaan, reservasi kunjungan, atau saran Anda.
                            </p>
                        </div>

                        <div id="kontak-feedback" class="hidden p-3 text-xs border rounded-none"></div>

                        <form id="kontak-form" class="space-y-3 text-xs">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label for="kontak-nama" class="block font-semibold text-stone-700 dark:text-stone-200 mb-1">Nama Lengkap</label>
                                    <input
                                        id="kontak-nama"
                                        type="text"
                                        required
                                        placeholder="Masukkan nama Anda"
                                        class="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>
                                <div>
                                    <label for="kontak-hp" class="block font-semibold text-stone-700 dark:text-stone-200 mb-1">No. HP / WhatsApp</label>
                                    <input
                                        id="kontak-hp"
                                        type="text"
                                        placeholder="08xxxxxxxxxx"
                                        class="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>
                            </div>

                            <div>
                                <label for="kontak-subjek" class="block font-semibold text-stone-700 dark:text-stone-200 mb-1">Subjek</label>
                                <input
                                    id="kontak-subjek"
                                    type="text"
                                    placeholder="Contoh: Informasi Paket Wisata / Unit Usaha"
                                    class="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="kontak-pesan" class="block font-semibold text-stone-700 dark:text-stone-200 mb-1">Pesan</label>
                                <textarea
                                    id="kontak-pesan"
                                    rows="4"
                                    required
                                    placeholder="Tuliskan pesan Anda di sini..."
                                    class="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                ></textarea>
                            </div>

                            <button
                                id="btn-kirim-kontak"
                                type="submit"
                                class="bg-[#d47a2a] hover:bg-[#bc681e] text-white font-semibold px-5 py-2.5 rounded-none transition cursor-pointer"
                            >
                                Kirim Pesan
                            </button>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    `;
}

export async function initKontakHandler() {
    let isDestroyed = false;
    let currentBrand = "BUMKal Sinar Mitra Desa";
    let currentPhone = DEFAULT_WA_NUMBER;

    const sidebarEl = document.getElementById("sidebar");
    const prevSidebarDisplay = sidebarEl ? sidebarEl.style.display : "";
    if (sidebarEl) {
        sidebarEl.style.display = "none";
    }

    const cached = readCachedProfile();
    if (cached) {
        currentBrand = cached.nama;
        currentPhone = cached.telp;
        applyProfileToDom(cached);
    } else if (typeof window.syncGlobalPublicUserAvatar === "function") {
        window.syncGlobalPublicUserAvatar();
    }

    if (typeof window.syncRunningTextPosition === "function") {
        window.syncRunningTextPosition(true);
    }

    const formEl = document.getElementById("kontak-form");
    const feedbackEl = document.getElementById("kontak-feedback");
    const submitBtn = document.getElementById("btn-kirim-kontak");

    const showFeedback = (message, isError = false) => {
        if (!feedbackEl) return;
        feedbackEl.className = isError
            ? "p-3 text-xs border rounded-none bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
            : "p-3 text-xs border rounded-none bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
        feedbackEl.innerHTML = escapeHtml(message);
        feedbackEl.classList.remove("hidden");
    };

    const onFormSubmit = async (e) => {
        e.preventDefault();
        if (isDestroyed) return;

        const nama = String(document.getElementById("kontak-nama")?.value || "").trim();
        const hp = String(document.getElementById("kontak-hp")?.value || "").trim();
        const subjek = String(document.getElementById("kontak-subjek")?.value || "").trim();
        const pesan = String(document.getElementById("kontak-pesan")?.value || "").trim();

        if (!nama || !pesan) {
            showFeedback("Nama lengkap dan pesan wajib diisi.", true);
            return;
        }

        if (submitBtn) submitBtn.disabled = true;
        if (feedbackEl) feedbackEl.classList.add("hidden");

        try {
            await addDoc(collection(db, "pesan_kontak"), {
                nama,
                hp,
                subjek: subjek || "Pesan Website",
                pesan,
                status: "Baru",
                createdAt: new Date().toISOString()
            });

            if (!isDestroyed) {
                formEl?.reset();
                showFeedback("Pesan berhasil dikirim. Terima kasih telah menghubungi kami.", false);
            }
        } catch (err) {
            console.warn("Gagal menyimpan pesan ke Firestore, membuka WhatsApp sebagai alternatif:", err?.message || err);
            const waText = `Halo ${currentBrand}, saya ${nama}${hp ? ` (${hp})` : ""}.${subjek ? ` Subjek: ${subjek}.` : ""} ${pesan}`;
            window.open(formatWhatsAppUrl(currentPhone, currentBrand, waText), "_blank", "noopener,noreferrer");
            if (!isDestroyed) {
                showFeedback("Pesan diarahkan ke WhatsApp agar tetap terkirim ke admin.", false);
            }
        } finally {
            if (submitBtn && !isDestroyed) submitBtn.disabled = false;
        }
    };

    formEl?.addEventListener("submit", onFormSubmit);

    try {
        const profSnap = await getDoc(doc(db, "pengaturan", "profil_perusahaan"));
        if (!isDestroyed && profSnap.exists()) {
            const normalized = normalizeProfileData(profSnap.data() || {});
            currentBrand = normalized.nama;
            currentPhone = normalized.telp;
            writeCachedProfile(normalized);
            applyProfileToDom(normalized);
        }
    } catch (err) {
        console.warn("Gagal memuat profil perusahaan di kontak:", err?.message || err);
    }

    return () => {
        isDestroyed = true;
        if (sidebarEl) {
            sidebarEl.style.display = prevSidebarDisplay;
        }
        formEl?.removeEventListener("submit", onFormSubmit);
    };
}