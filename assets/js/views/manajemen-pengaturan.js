// File: assets/js/views/manajemen-pengaturan.js
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const PROFILE_DOC_REF = doc(db, "pengaturan", "profil_perusahaan");
const JABATAN_RT_DOC_REF = doc(db, "pengaturan", "jabatan_rt");
const MAP_DOC_REF = doc(db, "pengaturan", "peta_wilayah");
const PENGURUS_RT_COLLECTION = "pengurus_rt";
const DEFAULT_BRAND_NAME = "RTKu Digital";
const DEFAULT_PENGURUS_PHOTO = "assets/icons/Logo.png";
const DEFAULT_BANNER_PHOTO = "assets/icons/Logo.png";
const FEEDBACK_AUTO_HIDE_MS = 3500;

const DEFAULT_JABATAN_RT = [
    "Ketua RT",
    "Wakil Ketua RT",
    "Sekretaris RT",
    "Bendahara RT",
    "Seksi Keamanan & Ronda",
    "Seksi Sosial & Kemasyarakatan",
    "Seksi Humas & Informasi"
];

const DEFAULT_PROFILE = {
    nama: "",
    tagline: "",
    alamat: "",
    rt: "",
    rw: "",
    desa_kelurahan: "",
    kecamatan: "",
    kabupaten_kota: "",
    kode_pos: "",
    provinsi: "",
    telepon: "",
    email: "",
    website: "",
    jamOperasional: "",
    deskripsi: "",
    iconUrl: "",
    bannerUrl: ""
};

const DEFAULT_MAP_SETTINGS = {
    judulPeta: "Peta wilayah NULIS RT 03",
    subjudulPeta: "Nulis RT 03 / 000 Tamantirto Kasihan Bantul Yogyakarta 55184",
    judulLokasi: "Lokasi NULIS RT 03",
    alamatLokasi: "Nulis RT 03 / 000 Tamantirto Kasihan Bantul Yogyakarta 55184",
    center: [-7.8266, 110.3368],
    zoom: 17,
    batasWilayah: [
        [-7.8257, 110.3358],
        [-7.8256, 110.3378],
        [-7.8276, 110.3379],
        [-7.8277, 110.3357]
    ]
};

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

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

function parseLatLngPair(item) {
    if (!item) return null;
    if (Array.isArray(item) && item.length >= 2) {
        const lat = Number(item[0]);
        const lng = Number(item[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }
    if (typeof item === "object") {
        const lat = Number(item.lat ?? item.latitude);
        const lng = Number(item.lng ?? item.lon ?? item.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }
    if (typeof item === "string") {
        const parts = item.split(",").map((s) => Number(s.trim()));
        if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            return [parts[0], parts[1]];
        }
    }
    return null;
}

function parsePolygonInput(rawPoly) {
    if (Array.isArray(rawPoly)) {
        return rawPoly.map(parseLatLngPair).filter(Boolean);
    }
    if (typeof rawPoly === "string" && rawPoly.trim()) {
        const parsed = JSON.parse(rawPoly.trim());
        if (!Array.isArray(parsed)) {
            throw new Error("Format batas wilayah harus berupa array koordinat [[lat, lng], ...].");
        }
        return parsed.map(parseLatLngPair).filter(Boolean);
    }
    return [];
}

function ensureLeafletLoaded() {
    return new Promise((resolve, reject) => {
        if (typeof window !== "undefined" && window.L && typeof window.L.map === "function") {
            resolve(window.L);
            return;
        }

        const existingScript = document.querySelector('script[data-rtku-leaflet="true"]');
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(window.L), { once: true });
            existingScript.addEventListener("error", () => reject(new Error("Gagal memuat Leaflet JS")), { once: true });
            return;
        }

        if (!document.querySelector('link[data-rtku-leaflet-css="true"]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
            link.setAttribute("data-rtku-leaflet-css", "true");
            document.head.appendChild(link);
        }

        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        script.setAttribute("data-rtku-leaflet", "true");
        script.onload = () => {
            if (window.L) resolve(window.L);
            else reject(new Error("Leaflet tidak tersedia setelah dimuat"));
        };
        script.onerror = () => reject(new Error("Gagal memuat pustaka peta Leaflet"));
        document.head.appendChild(script);
    });
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
        reader.readAsDataURL(file);
    });
}

async function compressImageFile(file, maxWidth = 1024, maxHeight = 600, quality = 0.78) {
    const rawDataUrl = await readFileAsDataUrl(file);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            const scale = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
            width = Math.max(1, Math.round(width * scale));
            height = Math.max(1, Math.round(height * scale));

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
    });
}

export function renderManajemenPengaturan() {
    const initialJabatanOptions = DEFAULT_JABATAN_RT
        .map((jab) => `<option value="${escapeHtml(jab)}">${escapeHtml(jab)}</option>`)
        .join("");

    return `
        <div class="space-y-5">
            <!-- Header Halaman -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Manajemen Pengaturan — ${DEFAULT_BRAND_NAME}
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Kelola identitas profil lingkungan RT, gambar banner beranda, pengurus RT, serta peta wilayah.
                    </p>
                </div>
                <a
                    href="#/manajemen"
                    data-link
                    class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition flex-shrink-0"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    <span>Kembali ke Manajemen</span>
                </a>
            </div>

            <!-- Navigasi Tab Utama -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none">
                <div class="flex flex-wrap border-b border-stone-200 dark:border-stone-800" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        data-mp-tab="profil"
                        aria-selected="true"
                        class="px-5 py-3.5 text-xs md:text-sm font-bold border-b-2 border-[#c87d32] text-[#5c6d4e] dark:text-emerald-400 bg-[#f6f3ec] dark:bg-stone-950/60 transition cursor-pointer"
                    >
1. Profil
                    </button>
                    <button
                        type="button"
                        role="tab"
                        data-mp-tab="pengurus-rt"
                        aria-selected="false"
                        class="px-5 py-3.5 text-xs md:text-sm font-semibold border-b-2 border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-[#f6f3ec]/60 dark:hover:bg-stone-800/40 transition cursor-pointer"
                    >
2. Pengurus RT
                    </button>
                    <button
                        type="button"
                        role="tab"
                        data-mp-tab="peta-wilayah"
                        aria-selected="false"
                        class="px-5 py-3.5 text-xs md:text-sm font-semibold border-b-2 border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-[#f6f3ec]/60 dark:hover:bg-stone-800/40 transition cursor-pointer"
                    >
3. Peta Wilayah
                    </button>
                </div>

                <!-- Toast Notifikasi Pojok Kanan Atas -->
                <div id="mp-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200"></div>

                <!-- TAB 1: PROFIL & 1 GAMBAR BANNER -->
                <div id="mp-panel-profil" data-mp-panel="profil" class="p-6">
                    <form id="mp-profil-form" class="space-y-6">
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <!-- Kolom Logo / Icon -->
                            <div class="bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-none p-5 flex flex-col items-center justify-between text-center">
                                <div class="w-full">
                                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-3">
                                        Logo / Icon Profil
                                    </div>
                                    <div class="w-28 h-28 mx-auto bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-none flex items-center justify-center overflow-hidden">
                                        <img
                                            id="mp-logo-preview"
                                            src="assets/icons/icon-192.png"
                                            alt="Preview Logo"
                                            class="w-full h-full object-contain"
                                        >
                                    </div>
                                </div>

                                <div class="w-full mt-4 space-y-2.5 text-left">
                                    <label class="block text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                                        URL Logo / Icon
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-icon-url"
                                        name="iconUrl"
                                        placeholder="https://... atau assets/icons/Logo.png"
                                        class="w-full px-3 py-2 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >

                                    <label class="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 pt-1">
                                        Upload File Gambar
                                    </label>
                                    <input
                                        type="file"
                                        id="mp-icon-file"
                                        accept="image/*"
                                        class="w-full text-[11px] text-stone-600 dark:text-stone-300 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-none file:border file:border-stone-300 dark:file:border-stone-700 file:text-[11px] file:font-semibold file:bg-[#faf8f3] dark:file:bg-stone-800 file:text-stone-700 dark:file:text-stone-200 hover:file:border-[#c87d32] cursor-pointer"
                                    >
                                </div>
                            </div>

                            <!-- Kolom Data Profil -->
                            <div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="sm:col-span-2">
                                    <label for="mp-nama" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Nama Lingkungan / Aplikasi <span class="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-nama"
                                        name="nama"
                                        required
                                        placeholder="Contoh: RTKu Digital — RT 05"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div class="sm:col-span-2">
                                    <label for="mp-tagline" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Tagline / Slogan
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-tagline"
                                        name="tagline"
                                        placeholder="Contoh: Guyub Rukun, Transparan, dan Peduli Warga"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div>
                                    <label for="mp-telepon" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Telepon / WhatsApp Pengurus
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-telepon"
                                        name="telepon"
                                        placeholder="Contoh: 0812-3456-7890"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div>
                                    <label for="mp-email" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Email Resmi
                                    </label>
                                    <input
                                        type="email"
                                        id="mp-email"
                                        name="email"
                                        placeholder="rt05@domain.id"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div>
                                    <label for="mp-website" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Website / Tautan Portal
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-website"
                                        name="website"
                                        placeholder="https://..."
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div>
                                    <label for="mp-jam" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Jam Pelayanan / Ronda
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-jam"
                                        name="jamOperasional"
                                        placeholder="Senin - Minggu, 08.00 - 21.00 WIB"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div class="sm:col-span-2">
                                    <label for="mp-alamat" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Alamat Lengkap Lingkungan RT
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-alamat"
                                        name="alamat"
                                        placeholder="Alamat sekretariat / wilayah RT, Padukuhan, Kalurahan"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <!-- Rincian Wilayah Administratif -->
                                <div class="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div>
                                        <label for="mp-rt" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            RT
                                        </label>
                                        <input
                                            type="text"
                                            id="mp-rt"
                                            name="rt"
                                            maxlength="5"
                                            placeholder="Contoh: 05"
                                            class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>

                                    <div>
                                        <label for="mp-rw" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            RW
                                        </label>
                                        <input
                                            type="text"
                                            id="mp-rw"
                                            name="rw"
                                            maxlength="5"
                                            placeholder="Contoh: 01"
                                            class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>

                                    <div class="col-span-2">
                                        <label for="mp-desa-kelurahan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            DESA/KELURAHAN
                                        </label>
                                        <input
                                            type="text"
                                            id="mp-desa-kelurahan"
                                            name="desa_kelurahan"
                                            placeholder="Contoh: Srihardono"
                                            class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>
                                </div>

                                <div class="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label for="mp-kecamatan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            KECAMATAN
                                        </label>
                                        <input
                                            type="text"
                                            id="mp-kecamatan"
                                            name="kecamatan"
                                            placeholder="Contoh: Pundong"
                                            class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>

                                    <div>
                                        <label for="mp-kabupaten-kota" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            KABUPATEN/KOTA
                                        </label>
                                        <input
                                            type="text"
                                            id="mp-kabupaten-kota"
                                            name="kabupaten_kota"
                                            placeholder="Contoh: Bantul"
                                            class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>

                                    <div>
                                        <label for="mp-kode-pos" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            KODE POS
                                        </label>
                                        <input
                                            type="text"
                                            id="mp-kode-pos"
                                            name="kode_pos"
                                            maxlength="10"
                                            inputmode="numeric"
                                            placeholder="Contoh: 55771"
                                            class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>
                                </div>

                                <div class="sm:col-span-2">
                                    <label for="mp-provinsi" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        PROVINSI
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-provinsi"
                                        name="provinsi"
                                        placeholder="Contoh: Daerah Istimewa Yogyakarta"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div class="sm:col-span-2">
                                    <label for="mp-deskripsi" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Deskripsi Singkat
                                    </label>
                                    <textarea
                                        id="mp-deskripsi"
                                        name="deskripsi"
                                        rows="3"
                                        placeholder="Ringkasan profil lingkungan, pelayanan warga, dan kegiatan RT..."
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- Bagian 1 Gambar Banner -->
                        <div class="bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-none p-5 space-y-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h2 class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                                        GAMBAR BANNER BERANDA
                                    </h2>
                                    <p class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                        Satu gambar utama yang tampil di bagian banner halaman beranda.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    id="mp-banner-reset"
                                    class="px-3 py-1 text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 border border-stone-300 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-900 rounded-none transition cursor-pointer"
                                >
                                    Reset Banner
                                </button>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                <div class="md:col-span-5 h-36 bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-none overflow-hidden flex items-center justify-center">
                                    <img
                                        id="mp-banner-preview"
                                        src="${DEFAULT_BANNER_PHOTO}"
                                        alt="Preview Banner"
                                        class="w-full h-full object-cover"
                                    >
                                </div>

                                <div class="md:col-span-7 space-y-2.5">
                                    <label for="mp-banner-url" class="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                                        URL Gambar Banner
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-banner-url"
                                        name="bannerUrl"
                                        placeholder="https://... atau assets/images/banner.jpg"
                                        class="w-full px-3 py-2 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >

                                    <label for="mp-banner-file" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 pt-1">
                                        Upload File Gambar Banner
                                    </label>
                                    <input
                                        type="file"
                                        id="mp-banner-file"
                                        accept="image/*"
                                        class="w-full text-[11px] text-stone-600 dark:text-stone-300 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-none file:border file:border-stone-300 dark:file:border-stone-700 file:text-[11px] file:font-semibold file:bg-[#faf8f3] dark:file:bg-stone-800 file:text-stone-700 dark:file:text-stone-200 hover:file:border-[#c87d32] cursor-pointer"
                                    >
                                </div>
                            </div>
                        </div>

                        <div class="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                id="mp-profil-reload"
                                class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                            >
                                Muat Ulang
                            </button>
                            <button
                                type="submit"
                                id="mp-profil-save"
                                class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                            >
                                Simpan Profil
                            </button>
                        </div>
                    </form>
                </div>

                <!-- TAB 2: INPUT PENGURUS RT -->
                <div id="mp-panel-pengurus-rt" data-mp-panel="pengurus-rt" class="hidden p-6 space-y-6">
                    <!-- Form Tambah / Edit Pengurus RT -->
                    <form id="mp-pengurus-form" class="bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-none p-4 md:p-5 space-y-4">
                        <div class="flex items-center justify-between">
                            <h2 id="mp-pengurus-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                                INPUT PENGURUS RT
                            </h2>
                            <button
                                type="button"
                                id="mp-pengurus-cancel-edit"
                                class="hidden text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                            >
                                Batal Edit
                            </button>
                        </div>

                        <input type="hidden" id="mp-pengurus-id" value="">

                        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                            <!-- Foto Profil Pengurus RT -->
                            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-3.5 flex flex-col items-center text-center">
                                <span class="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2.5">
                                    Foto Pengurus RT
                                </span>
                                <div class="w-24 h-24 bg-[#f6f3ec] dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none flex items-center justify-center overflow-hidden mb-3">
                                    <img
                                        id="mp-pengurus-foto-preview"
                                        src="${DEFAULT_PENGURUS_PHOTO}"
                                        alt="Preview Foto Pengurus RT"
                                        class="w-full h-full object-cover"
                                    >
                                </div>
                                <div class="w-full space-y-2 text-left">
                                    <input
                                        type="file"
                                        id="mp-pengurus-foto-file"
                                        accept="image/*"
                                        class="w-full text-[11px] text-stone-600 dark:text-stone-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-none file:border file:border-stone-300 dark:file:border-stone-700 file:text-[11px] file:font-semibold file:bg-[#f6f3ec] dark:file:bg-stone-800 file:text-stone-700 dark:file:text-stone-200 hover:file:border-[#c87d32] cursor-pointer"
                                    >
                                    <input
                                        type="text"
                                        id="mp-pengurus-foto-url"
                                        placeholder="Atau masukkan URL foto..."
                                        class="w-full px-2.5 py-1.5 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                    <button
                                        type="button"
                                        id="mp-pengurus-foto-reset"
                                        class="w-full py-1 text-[11px] font-semibold text-stone-600 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 border border-stone-200 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-900 rounded-none transition cursor-pointer"
                                    >
                                        Reset Foto
                                    </button>
                                </div>
                            </div>

                            <!-- Input Detail Pengurus RT -->
                            <div class="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label for="mp-pengurus-nama" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Nama Lengkap Pengurus <span class="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-pengurus-nama"
                                        required
                                        placeholder="Contoh: Budi Santoso"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div>
                                    <div class="flex items-center justify-between gap-2 mb-1">
                                        <label for="mp-pengurus-jabatan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                                            Jabatan RT <span class="text-rose-500">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            id="mp-jabatan-hapus-btn"
                                            title="Hapus jabatan terpilih dari daftar"
                                            class="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                    <select
                                        id="mp-pengurus-jabatan"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                        ${initialJabatanOptions}
                                    </select>
                                    <div class="mt-1.5 flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            id="mp-jabatan-baru-input"
                                            placeholder="Tambah jabatan RT baru..."
                                            class="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                        <button
                                            type="button"
                                            id="mp-jabatan-tambah-btn"
                                            class="px-3 py-1.5 text-xs font-semibold bg-[#c87d32] hover:bg-[#b06d29] text-white rounded-none transition cursor-pointer flex-shrink-0"
                                        >
                                            + Tambah
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label for="mp-pengurus-status" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Status
                                    </label>
                                    <select
                                        id="mp-pengurus-status"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                        <option value="Aktif">Aktif</option>
                                        <option value="Nonaktif">Nonaktif</option>
                                    </select>
                                </div>

                                <div>
                                    <label for="mp-pengurus-wa" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        No. WhatsApp / Telepon
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-pengurus-wa"
                                        placeholder="Contoh: 0812-3456-7890"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div class="md:col-span-2">
                                    <label for="mp-pengurus-keterangan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Keterangan / Masa Bhakti / Blok
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-pengurus-keterangan"
                                        placeholder="Contoh: Periode 2025–2030 • Blok A / Koordinator Layanan Surat"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div class="md:col-span-3 flex justify-end pt-1">
                                    <button
                                        type="submit"
                                        id="mp-pengurus-submit"
                                        class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                                    >
                                        Simpan Pengurus RT
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>

                    <!-- Tabel Daftar Pengurus RT -->
                    <div class="overflow-x-auto border border-stone-200 dark:border-stone-800 rounded-none">
                        <table class="w-full text-left border-collapse text-xs md:text-sm">
                            <thead class="bg-[#f6f3ec] dark:bg-stone-950/60 text-stone-700 dark:text-stone-200 text-[11px] uppercase tracking-wider">
                                <tr>
                                    <th class="px-4 py-3 border-b border-stone-200 dark:border-stone-700 w-12">NO</th>
                                    <th class="px-4 py-3 border-b border-stone-200 dark:border-stone-700 w-16">FOTO</th>
                                    <th class="px-4 py-3 border-b border-stone-200 dark:border-stone-700">NAMA PENGURUS</th>
                                    <th class="px-4 py-3 border-b border-stone-200 dark:border-stone-700">JABATAN RT</th>
                                    <th class="px-4 py-3 border-b border-stone-200 dark:border-stone-700">NO. WA</th>
                                    <th class="px-4 py-3 border-b border-stone-200 dark:border-stone-700">KETERANGAN</th>
                                    <th class="px-4 py-3 border-b border-stone-200 dark:border-stone-700">STATUS</th>
                                    <th class="px-4 py-3 border-b border-stone-200 dark:border-stone-700 text-right w-32">AKSI</th>
                                </tr>
                            </thead>
                            <tbody id="mp-pengurus-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 bg-[#faf8f3] dark:bg-stone-900 text-stone-800 dark:text-stone-200">
                                <tr>
                                    <td colspan="8" class="px-4 py-6 text-center text-xs text-stone-500 dark:text-stone-400">
                                        Belum ada data pengurus RT.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- TAB 3: PETA WILAYAH -->
                <div id="mp-panel-peta-wilayah" data-mp-panel="peta-wilayah" class="hidden p-6">
                    <form id="mp-peta-form" class="space-y-5">
                        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            <!-- Kolom Form Alamat & Koordinat -->
                            <div class="lg:col-span-5 space-y-4 bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 p-4 md:p-5">
                                <div class="flex items-center justify-between gap-2">
                                    <h2 class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                                        PENGATURAN PETA WILAYAH
                                    </h2>
                                    <button
                                        type="button"
                                        id="mp-peta-cari-btn"
                                        class="px-3 py-1.5 text-[11px] font-semibold bg-[#c87d32] hover:bg-[#b06d29] text-white rounded-none transition cursor-pointer"
                                    >
                                        Cari Koordinat
                                    </button>
                                </div>

                                <div>
                                    <label for="mp-peta-judul" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Judul Peta
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-peta-judul"
                                        placeholder="Contoh: Peta wilayah NULIS RT 03"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div>
                                    <label for="mp-peta-subjudul" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Subjudul / Alamat Singkat
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-peta-subjudul"
                                        placeholder="Contoh: Nulis RT 03 / 000 Tamantirto Kasihan Bantul Yogyakarta 55184"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div>
                                    <label for="mp-peta-lokasi-judul" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Judul Lokasi (Bawah Peta)
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-peta-lokasi-judul"
                                        placeholder="Contoh: Lokasi NULIS RT 03"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div>
                                    <label for="mp-peta-lokasi-alamat" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Alamat Lokasi (Bawah Peta)
                                    </label>
                                    <input
                                        type="text"
                                        id="mp-peta-lokasi-alamat"
                                        placeholder="Contoh: Nulis RT 03 / 000 Tamantirto Kasihan Bantul Yogyakarta 55184"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                </div>

                                <div class="grid grid-cols-3 gap-2.5">
                                    <div>
                                        <label for="mp-peta-lat" class="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            Latitude
                                        </label>
                                        <input
                                            type="text"
                                            id="mp-peta-lat"
                                            placeholder="-7.8266"
                                            class="w-full px-2.5 py-2 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>
                                    <div>
                                        <label for="mp-peta-lng" class="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            Longitude
                                        </label>
                                        <input
                                            type="text"
                                            id="mp-peta-lng"
                                            placeholder="110.3368"
                                            class="w-full px-2.5 py-2 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>
                                    <div>
                                        <label for="mp-peta-zoom" class="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                            Zoom (5–19)
                                        </label>
                                        <input
                                            type="number"
                                            id="mp-peta-zoom"
                                            min="5"
                                            max="19"
                                            placeholder="17"
                                            class="w-full px-2.5 py-2 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                        >
                                    </div>
                                </div>

                                <div>
                                    <div class="flex items-center justify-between gap-2 mb-1">
                                        <label for="mp-peta-polygon" class="block text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                                            Titik Batas Wilayah / Polygon (JSON)
                                        </label>
                                        <button
                                            type="button"
                                            id="mp-peta-clear-poly"
                                            class="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                                        >
                                            Reset Titik
                                        </button>
                                    </div>
                                    <textarea
                                        id="mp-peta-polygon"
                                        rows="4"
                                        placeholder="[[-7.8257, 110.3358], [-7.8256, 110.3378], [-7.8276, 110.3379], [-7.8277, 110.3357]]"
                                        class="w-full px-3 py-2 text-xs font-mono bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    ></textarea>
                                    <p class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                                        Tips: Klik pada peta preview untuk menambah titik sudut batas wilayah secara berurutan.
                                    </p>
                                </div>
                            </div>

                            <!-- Kolom Preview Peta -->
                            <div class="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 space-y-3">
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-200">
                                        Preview Peta Wilayah
                                    </span>
                                    <button
                                        type="button"
                                        id="mp-peta-preview-btn"
                                        class="px-3 py-1 text-[11px] font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                                    >
                                        Terapkan ke Preview
                                    </button>
                                </div>

                                <div class="relative w-full h-[340px] border border-slate-200 dark:border-stone-800 bg-slate-100 dark:bg-stone-950 overflow-hidden">
                                    <div id="mp-peta-preview-canvas" class="w-full h-full z-[1]"></div>
                                </div>
                            </div>
                        </div>

                        <div class="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                id="mp-peta-reload"
                                class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                            >
                                Muat Ulang
                            </button>
                            <button
                                type="submit"
                                id="mp-peta-save"
                                class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                            >
                                Simpan Peta Wilayah
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

export function initManajemenPengaturanHandler() {
    let activeTab = "profil";
    let pengurusRtList = [];
    let jabatanRtList = [...DEFAULT_JABATAN_RT];
    let isDestroyed = false;
    let feedbackTimerId = null;
    let previewMap = null;
    let previewCenterMarker = null;
    let previewPolygonLayer = null;

    const feedbackEl = document.getElementById("mp-feedback");
    const profilForm = document.getElementById("mp-profil-form");
    const reloadProfilBtn = document.getElementById("mp-profil-reload");
    const iconUrlInput = document.getElementById("mp-icon-url");
    const iconFileInput = document.getElementById("mp-icon-file");
    const logoPreviewImg = document.getElementById("mp-logo-preview");

    const rtInput = document.getElementById("mp-rt");
    const rwInput = document.getElementById("mp-rw");
    const desaKelurahanInput = document.getElementById("mp-desa-kelurahan");
    const kecamatanInput = document.getElementById("mp-kecamatan");
    const kabupatenKotaInput = document.getElementById("mp-kabupaten-kota");
    const kodePosInput = document.getElementById("mp-kode-pos");
    const provinsiInput = document.getElementById("mp-provinsi");

    const bannerUrlInput = document.getElementById("mp-banner-url");
    const bannerFileInput = document.getElementById("mp-banner-file");
    const bannerPreviewImg = document.getElementById("mp-banner-preview");
    const bannerResetBtn = document.getElementById("mp-banner-reset");

    const pengurusForm = document.getElementById("mp-pengurus-form");
    const pengurusFormTitle = document.getElementById("mp-pengurus-form-title");
    const pengurusCancelEditBtn = document.getElementById("mp-pengurus-cancel-edit");
    const pengurusIdInput = document.getElementById("mp-pengurus-id");
    const pengurusNamaInput = document.getElementById("mp-pengurus-nama");
    const pengurusJabatanInput = document.getElementById("mp-pengurus-jabatan");
    const jabatanBaruInput = document.getElementById("mp-jabatan-baru-input");
    const jabatanTambahBtn = document.getElementById("mp-jabatan-tambah-btn");
    const jabatanHapusBtn = document.getElementById("mp-jabatan-hapus-btn");
    const pengurusStatusInput = document.getElementById("mp-pengurus-status");
    const pengurusWaInput = document.getElementById("mp-pengurus-wa");
    const pengurusKeteranganInput = document.getElementById("mp-pengurus-keterangan");
    const pengurusFotoFileInput = document.getElementById("mp-pengurus-foto-file");
    const pengurusFotoUrlInput = document.getElementById("mp-pengurus-foto-url");
    const pengurusFotoPreviewImg = document.getElementById("mp-pengurus-foto-preview");
    const pengurusFotoResetBtn = document.getElementById("mp-pengurus-foto-reset");
    const pengurusTbody = document.getElementById("mp-pengurus-tbody");

    const petaForm = document.getElementById("mp-peta-form");
    const petaJudulInput = document.getElementById("mp-peta-judul");
    const petaSubjudulInput = document.getElementById("mp-peta-subjudul");
    const petaLokasiJudulInput = document.getElementById("mp-peta-lokasi-judul");
    const petaLokasiAlamatInput = document.getElementById("mp-peta-lokasi-alamat");
    const petaLatInput = document.getElementById("mp-peta-lat");
    const petaLngInput = document.getElementById("mp-peta-lng");
    const petaZoomInput = document.getElementById("mp-peta-zoom");
    const petaPolygonInput = document.getElementById("mp-peta-polygon");
    const petaCariBtn = document.getElementById("mp-peta-cari-btn");
    const petaClearPolyBtn = document.getElementById("mp-peta-clear-poly");
    const petaPreviewBtn = document.getElementById("mp-peta-preview-btn");
    const petaReloadBtn = document.getElementById("mp-peta-reload");

    function showFeedback(message, type = "success", durationMs = FEEDBACK_AUTO_HIDE_MS) {
        if (!feedbackEl || isDestroyed) return;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }

        feedbackEl.className =
            type === "error"
                ? "fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200 bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200 bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
        feedbackEl.textContent = message;
        feedbackEl.classList.remove("hidden");

        if (durationMs > 0) {
            feedbackTimerId = window.setTimeout(() => {
                feedbackTimerId = null;
                feedbackEl?.classList.add("hidden");
            }, durationMs);
        }
    }

    function hideFeedback() {
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        if (!feedbackEl) return;
        feedbackEl.classList.add("hidden");
    }

    function destroyPreviewMap() {
        if (previewMap) {
            previewMap.remove();
            previewMap = null;
            previewCenterMarker = null;
            previewPolygonLayer = null;
        }
    }

    function getMapValuesFromForm() {
        const lat = Number(petaLatInput?.value);
        const lng = Number(petaLngInput?.value);
        const center = Number.isFinite(lat) && Number.isFinite(lng)
            ? [lat, lng]
            : DEFAULT_MAP_SETTINGS.center;

        const zoomRaw = Number(petaZoomInput?.value);
        const zoom = Number.isFinite(zoomRaw) && zoomRaw >= 5 && zoomRaw <= 19
            ? zoomRaw
            : DEFAULT_MAP_SETTINGS.zoom;

        let polygon = [];
        try {
            polygon = parsePolygonInput(petaPolygonInput?.value || "");
        } catch (err) {
            throw err;
        }

        return {
            judulPeta: String(petaJudulInput?.value || "").trim() || DEFAULT_MAP_SETTINGS.judulPeta,
            subjudulPeta: String(petaSubjudulInput?.value || "").trim() || DEFAULT_MAP_SETTINGS.subjudulPeta,
            judulLokasi: String(petaLokasiJudulInput?.value || "").trim() || DEFAULT_MAP_SETTINGS.judulLokasi,
            alamatLokasi: String(petaLokasiAlamatInput?.value || "").trim() || DEFAULT_MAP_SETTINGS.alamatLokasi,
            center,
            zoom,
            batasWilayah: polygon
        };
    }

    async function syncMapPreview() {
        if (isDestroyed || activeTab !== "peta-wilayah") return;
        const canvasEl = document.getElementById("mp-peta-preview-canvas");
        if (!canvasEl) return;

        let cfg;
        try {
            cfg = getMapValuesFromForm();
        } catch (err) {
            showFeedback(err.message || "Format koordinat polygon tidak valid.", "error");
            return;
        }

        try {
            const L = await ensureLeafletLoaded();
            if (isDestroyed || activeTab !== "peta-wilayah" || !canvasEl.isConnected) return;

            if (!previewMap) {
                previewMap = L.map(canvasEl, { scrollWheelZoom: false }).setView(cfg.center, cfg.zoom);
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(previewMap);

                previewMap.on("click", (ev) => {
                    const nextLat = Number(ev.latlng.lat.toFixed(6));
                    const nextLng = Number(ev.latlng.lng.toFixed(6));
                    let currentPoly = [];
                    try {
                        currentPoly = parsePolygonInput(petaPolygonInput?.value || "");
                    } catch {
                        currentPoly = [];
                    }
                    currentPoly.push([nextLat, nextLng]);
                    if (petaPolygonInput) {
                        petaPolygonInput.value = JSON.stringify(currentPoly);
                    }
                    syncMapPreview();
                });
            } else {
                previewMap.setView(cfg.center, cfg.zoom);
            }

            if (previewCenterMarker) {
                previewMap.removeLayer(previewCenterMarker);
                previewCenterMarker = null;
            }
            previewCenterMarker = L.circleMarker(cfg.center, {
                radius: 6,
                color: "#0f766e",
                weight: 2,
                fillColor: "#14b8a6",
                fillOpacity: 0.9
            }).addTo(previewMap);

            if (previewPolygonLayer) {
                previewMap.removeLayer(previewPolygonLayer);
                previewPolygonLayer = null;
            }
            if (cfg.batasWilayah.length >= 3) {
                previewPolygonLayer = L.polygon(cfg.batasWilayah, {
                    color: "#dc2626",
                    weight: 2.5,
                    dashArray: "7 6",
                    fillColor: "#ef4444",
                    fillOpacity: 0.12
                }).addTo(previewMap);
            }

            window.setTimeout(() => {
                if (!isDestroyed && previewMap) {
                    previewMap.invalidateSize();
                }
            }, 120);
        } catch (err) {
            console.warn("Gagal memuat preview peta:", err);
        }
    }

    async function loadPetaWilayah() {
        try {
            const [mapSnap, profSnap] = await Promise.all([
                getDoc(MAP_DOC_REF),
                getDoc(PROFILE_DOC_REF)
            ]);
            if (isDestroyed) return;

            const mapData = mapSnap.exists() ? mapSnap.data() || {} : {};
            const profData = profSnap.exists() ? profSnap.data() || {} : {};
            const alamatCadangan = String(profData.alamat || "").trim() || DEFAULT_MAP_SETTINGS.alamatLokasi;
            const namaCadangan = String(profData.nama || "").trim();

            const center =
                parseLatLngPair(mapData.petaCenter) ||
                parseLatLngPair(mapData.center) ||
                DEFAULT_MAP_SETTINGS.center;

            let poly = DEFAULT_MAP_SETTINGS.batasWilayah;
            try {
                const parsed = parsePolygonInput(mapData.batasWilayah ?? mapData.polygon);
                if (parsed.length >= 3) poly = parsed;
            } catch {
                poly = DEFAULT_MAP_SETTINGS.batasWilayah;
            }

            if (petaJudulInput) {
                petaJudulInput.value = mapData.judulPeta || (namaCadangan ? `Peta wilayah ${namaCadangan}` : DEFAULT_MAP_SETTINGS.judulPeta);
            }
            if (petaSubjudulInput) {
                petaSubjudulInput.value = mapData.subjudulPeta || alamatCadangan;
            }
            if (petaLokasiJudulInput) {
                petaLokasiJudulInput.value = mapData.judulLokasi || (namaCadangan ? `Lokasi ${namaCadangan}` : DEFAULT_MAP_SETTINGS.judulLokasi);
            }
            if (petaLokasiAlamatInput) {
                petaLokasiAlamatInput.value = mapData.alamatLokasi || alamatCadangan;
            }
            if (petaLatInput) petaLatInput.value = String(center[0]);
            if (petaLngInput) petaLngInput.value = String(center[1]);
            if (petaZoomInput) petaZoomInput.value = String(Number(mapData.petaZoom ?? mapData.zoom ?? DEFAULT_MAP_SETTINGS.zoom));
            if (petaPolygonInput) petaPolygonInput.value = JSON.stringify(poly);

            if (activeTab === "peta-wilayah") {
                await syncMapPreview();
            }
        } catch (err) {
            console.error("Gagal memuat pengaturan peta wilayah:", err);
            showFeedback("Gagal memuat pengaturan peta wilayah.", "error");
        }
    }

    async function handleCariKoordinat() {
        hideFeedback();
        const queryText = String(
            petaLokasiAlamatInput?.value ||
            petaSubjudulInput?.value ||
            petaJudulInput?.value ||
            ""
        ).trim();

        if (!queryText) {
            showFeedback("Isi alamat atau nama wilayah terlebih dahulu untuk mencari koordinat.", "error");
            return;
        }

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryText)}`;
            const res = await fetch(url, {
                headers: { Accept: "application/json" }
            });
            if (!res.ok) throw new Error("Layanan pencarian koordinat sedang sibuk.");
            const results = await res.json();
            if (!Array.isArray(results) || results.length === 0) {
                showFeedback("Koordinat tidak ditemukan. Silakan klik langsung pada peta atau isi manual.", "error");
                return;
            }

            const lat = Number(Number(results[0].lat).toFixed(6));
            const lng = Number(Number(results[0].lon).toFixed(6));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                showFeedback("Format koordinat dari hasil pencarian tidak valid.", "error");
                return;
            }

            if (petaLatInput) petaLatInput.value = String(lat);
            if (petaLngInput) petaLngInput.value = String(lng);

            const autoPoly = [
                [Number((lat + 0.0009).toFixed(6)), Number((lng - 0.0011).toFixed(6))],
                [Number((lat + 0.0010).toFixed(6)), Number((lng + 0.0011).toFixed(6))],
                [Number((lat - 0.0010).toFixed(6)), Number((lng + 0.0012).toFixed(6))],
                [Number((lat - 0.0011).toFixed(6)), Number((lng - 0.0012).toFixed(6))]
            ];
            if (petaPolygonInput) {
                petaPolygonInput.value = JSON.stringify(autoPoly);
            }

            await syncMapPreview();
            showFeedback(`Koordinat ditemukan (${lat}, ${lng}).`);
        } catch (err) {
            console.error("Gagal mencari koordinat:", err);
            showFeedback("Gagal mencari koordinat otomatis. Coba lagi atau isi manual.", "error");
        }
    }

    async function handleSavePetaWilayah(e) {
        e.preventDefault();
        hideFeedback();

        let cfg;
        try {
            cfg = getMapValuesFromForm();
        } catch (err) {
            showFeedback(err.message || "Format titik batas wilayah tidak valid.", "error");
            return;
        }

        if (cfg.batasWilayah.length < 3) {
            showFeedback("Minimal diperlukan 3 titik koordinat untuk membentuk batas wilayah (polygon).", "error");
            return;
        }

        try {
            await setDoc(MAP_DOC_REF, {
                judulPeta: cfg.judulPeta,
                subjudulPeta: cfg.subjudulPeta,
                judulLokasi: cfg.judulLokasi,
                alamatLokasi: cfg.alamatLokasi,
                petaCenter: cfg.center,
                petaZoom: cfg.zoom,
                batasWilayah: cfg.batasWilayah,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            await setDoc(PROFILE_DOC_REF, {
                alamat: cfg.alamatLokasi,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            if (typeof window.reloadCompanyProfile === "function") {
                await window.reloadCompanyProfile();
            }

            await syncMapPreview();
            showFeedback("Pengaturan peta wilayah berhasil disimpan.");
        } catch (err) {
            console.error("Gagal menyimpan peta wilayah:", err);
            showFeedback("Gagal menyimpan pengaturan peta wilayah ke database.", "error");
        }
    }

    function syncBannerPreview(urlValue = "") {
        if (!bannerPreviewImg) return;
        const clean = String(urlValue || "").trim();
        bannerPreviewImg.src = isSafeImageSrc(clean) ? clean : DEFAULT_BANNER_PHOTO;
    }

    function renderJabatanOptions(selectedValue = "") {
        if (!pengurusJabatanInput || isDestroyed) return;
        const currentVal = selectedValue || pengurusJabatanInput.value || jabatanRtList[0] || "";
        const mergedList = [...jabatanRtList];
        if (currentVal && !mergedList.includes(currentVal)) {
            mergedList.unshift(currentVal);
        }

        pengurusJabatanInput.innerHTML = mergedList
            .map((jab) => `<option value="${escapeHtml(jab)}">${escapeHtml(jab)}</option>`)
            .join("");

        if (currentVal) {
            pengurusJabatanInput.value = currentVal;
        }
    }

    async function persistJabatanRtList(nextList) {
        await setDoc(JABATAN_RT_DOC_REF, {
            items: nextList,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    async function loadJabatanRt() {
        try {
            const snap = await getDoc(JABATAN_RT_DOC_REF);
            if (snap.exists() && Array.isArray(snap.data()?.items)) {
                const cleaned = snap.data().items
                    .map((item) => String(item || "").trim())
                    .filter(Boolean);
                if (cleaned.length > 0) {
                    jabatanRtList = Array.from(new Set(cleaned));
                }
            }
        } catch (err) {
            console.warn("Gagal memuat daftar jabatan RT, menggunakan bawaan:", err);
        }
        renderJabatanOptions();
    }

    async function handleTambahJabatan() {
        hideFeedback();
        const baru = String(jabatanBaruInput?.value || "").trim();
        if (!baru) {
            showFeedback("Masukkan nama jabatan RT baru terlebih dahulu.", "error");
            jabatanBaruInput?.focus();
            return;
        }

        const exists = jabatanRtList.some((item) => item.toLowerCase() === baru.toLowerCase());
        const matched = jabatanRtList.find((item) => item.toLowerCase() === baru.toLowerCase());
        if (exists && matched) {
            renderJabatanOptions(matched);
            if (jabatanBaruInput) jabatanBaruInput.value = "";
            showFeedback(`Jabatan "${matched}" sudah ada dan telah dipilih.`);
            return;
        }

        const nextList = [...jabatanRtList, baru];
        try {
            await persistJabatanRtList(nextList);
            jabatanRtList = nextList;
            renderJabatanOptions(baru);
            if (jabatanBaruInput) jabatanBaruInput.value = "";
            showFeedback(`Jabatan "${baru}" berhasil ditambahkan.`);
        } catch (err) {
            console.error("Gagal menambah jabatan RT:", err);
            showFeedback("Gagal menyimpan jabatan RT baru.", "error");
        }
    }

    async function handleHapusJabatan() {
        hideFeedback();
        const target = String(pengurusJabatanInput?.value || "").trim();
        if (!target) {
            showFeedback("Pilih jabatan RT yang ingin dihapus.", "error");
            return;
        }

        if (jabatanRtList.length <= 1) {
            showFeedback("Minimal harus ada 1 pilihan jabatan RT.", "error");
            return;
        }

        if (!window.confirm(`Hapus jabatan "${target}" dari pilihan Jabatan RT?`)) {
            return;
        }

        const nextList = jabatanRtList.filter((item) => item !== target);
        try {
            await persistJabatanRtList(nextList);
            jabatanRtList = nextList;
            renderJabatanOptions(nextList[0] || "");
            showFeedback(`Jabatan "${target}" berhasil dihapus dari pilihan.`);
        } catch (err) {
            console.error("Gagal menghapus jabatan RT:", err);
            showFeedback("Gagal menghapus jabatan RT.", "error");
        }
    }

    function switchTab(tabName) {
        if (tabName === "pengurus-rt") activeTab = "pengurus-rt";
        else if (tabName === "peta-wilayah") activeTab = "peta-wilayah";
        else activeTab = "profil";

        hideFeedback();

        document.querySelectorAll("[data-mp-tab]").forEach((btn) => {
            const isSelected = btn.getAttribute("data-mp-tab") === activeTab;
            btn.setAttribute("aria-selected", String(isSelected));
            btn.className = isSelected
                ? "px-5 py-3.5 text-xs md:text-sm font-bold border-b-2 border-[#c87d32] text-[#5c6d4e] dark:text-emerald-400 bg-[#f6f3ec] dark:bg-stone-950/60 transition cursor-pointer"
                : "px-5 py-3.5 text-xs md:text-sm font-semibold border-b-2 border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-[#f6f3ec]/60 dark:hover:bg-stone-800/40 transition cursor-pointer";
        });

        document.querySelectorAll("[data-mp-panel]").forEach((panel) => {
            const matches = panel.getAttribute("data-mp-panel") === activeTab;
            panel.classList.toggle("hidden", !matches);
        });

        if (activeTab === "pengurus-rt") {
            destroyPreviewMap();
            loadJabatanRt();
            loadPengurusRt();
        } else if (activeTab === "peta-wilayah") {
            loadPetaWilayah();
        } else {
            destroyPreviewMap();
        }
    }

    async function loadProfil() {
        try {
            const snap = await getDoc(PROFILE_DOC_REF);
            const data = snap.exists() ? { ...DEFAULT_PROFILE, ...snap.data() } : { ...DEFAULT_PROFILE };
            const resolvedLogo = data.iconUrl || data.logo || "assets/icons/icon-192.png";
            const resolvedBanner = data.bannerUrl || data.banner || "";

            if (isDestroyed) return;
            document.getElementById("mp-nama").value = data.nama || "";
            document.getElementById("mp-tagline").value = data.tagline || "";
            document.getElementById("mp-telepon").value = data.telepon || "";
            document.getElementById("mp-email").value = data.email || "";
            document.getElementById("mp-website").value = data.website || "";
            document.getElementById("mp-jam").value = data.jamOperasional || "";
            document.getElementById("mp-alamat").value = data.alamat || "";
            if (rtInput) rtInput.value = data.rt || "";
            if (rwInput) rwInput.value = data.rw || "";
            if (desaKelurahanInput) desaKelurahanInput.value = data.desa_kelurahan || data.desaKelurahan || "";
            if (kecamatanInput) kecamatanInput.value = data.kecamatan || "";
            if (kabupatenKotaInput) kabupatenKotaInput.value = data.kabupaten_kota || data.kabupatenKota || "";
            if (kodePosInput) kodePosInput.value = data.kode_pos || data.kodePos || "";
            if (provinsiInput) provinsiInput.value = data.provinsi || "";
            document.getElementById("mp-deskripsi").value = data.deskripsi || "";
            iconUrlInput.value = data.iconUrl || data.logo || "";
            if (logoPreviewImg) {
                logoPreviewImg.src = isSafeImageSrc(resolvedLogo) ? resolvedLogo : "assets/icons/icon-192.png";
            }
            if (bannerUrlInput) {
                bannerUrlInput.value = resolvedBanner;
            }
            syncBannerPreview(resolvedBanner);
        } catch (err) {
            console.error("Gagal memuat profil:", err);
            showFeedback("Gagal memuat data profil dari database.", "error");
        }
    }

    async function handleSaveProfil(e) {
        e.preventDefault();
        hideFeedback();

        const nama = document.getElementById("mp-nama").value.trim();
        if (!nama) {
            showFeedback("Nama lingkungan / aplikasi wajib diisi.", "error");
            return;
        }

        const bannerVal = bannerUrlInput ? bannerUrlInput.value.trim() : "";

        const payload = {
            nama,
            tagline: document.getElementById("mp-tagline").value.trim(),
            telepon: document.getElementById("mp-telepon").value.trim(),
            email: document.getElementById("mp-email").value.trim(),
            website: document.getElementById("mp-website").value.trim(),
            jamOperasional: document.getElementById("mp-jam").value.trim(),
            alamat: document.getElementById("mp-alamat").value.trim(),
            rt: rtInput ? rtInput.value.trim() : "",
            rw: rwInput ? rwInput.value.trim() : "",
            desa_kelurahan: desaKelurahanInput ? desaKelurahanInput.value.trim() : "",
            kecamatan: kecamatanInput ? kecamatanInput.value.trim() : "",
            kabupaten_kota: kabupatenKotaInput ? kabupatenKotaInput.value.trim() : "",
            kode_pos: kodePosInput ? kodePosInput.value.trim() : "",
            provinsi: provinsiInput ? provinsiInput.value.trim() : "",
            deskripsi: document.getElementById("mp-deskripsi").value.trim(),
            iconUrl: iconUrlInput.value.trim(),
            bannerUrl: bannerVal,
            updatedAt: new Date().toISOString()
        };

        try {
            await setDoc(PROFILE_DOC_REF, payload, { merge: true });
            if (typeof window.reloadCompanyProfile === "function") {
                await window.reloadCompanyProfile();
            }
            showFeedback("Profil dan gambar banner berhasil disimpan.");
        } catch (err) {
            console.error("Gagal menyimpan profil:", err);
            showFeedback("Gagal menyimpan profil ke database.", "error");
        }
    }

    function syncPengurusFotoPreview(urlValue = "") {
        if (!pengurusFotoPreviewImg) return;
        const clean = String(urlValue || "").trim();
        pengurusFotoPreviewImg.src = isSafeImageSrc(clean) ? clean : DEFAULT_PENGURUS_PHOTO;
    }

    function resetPengurusForm() {
        pengurusIdInput.value = "";
        pengurusNamaInput.value = "";
        renderJabatanOptions(jabatanRtList[0] || "Ketua RT");
        pengurusStatusInput.value = "Aktif";
        pengurusWaInput.value = "";
        pengurusKeteranganInput.value = "";
        pengurusFotoUrlInput.value = "";
        if (jabatanBaruInput) jabatanBaruInput.value = "";
        if (pengurusFotoFileInput) pengurusFotoFileInput.value = "";
        syncPengurusFotoPreview("");
        pengurusFormTitle.textContent = "INPUT PENGURUS RT";
        pengurusCancelEditBtn.classList.add("hidden");
    }

    function renderPengurusTable() {
        if (!pengurusTbody || isDestroyed) return;

        if (!pengurusRtList.length) {
            pengurusTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="px-4 py-6 text-center text-xs text-stone-500 dark:text-stone-400">
                        Belum ada data pengurus RT.
                    </td>
                </tr>
            `;
            return;
        }

        pengurusTbody.innerHTML = pengurusRtList
            .map((item, idx) => {
                const isAktif = String(item.status || "Aktif").toLowerCase() === "aktif";
                const badgeClass = isAktif
                    ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : "bg-[#f6f3ec] dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-300 dark:border-stone-700";

                const rawFoto = item.fotoProfil || item.foto || DEFAULT_PENGURUS_PHOTO;
                const fotoSrc = escapeHtml(isSafeImageSrc(rawFoto) ? rawFoto : DEFAULT_PENGURUS_PHOTO);
                const namaSafe = escapeHtml(item.nama || "");

                return `
                    <tr class="hover:bg-[#f6f3ec]/70 dark:hover:bg-stone-800/40 transition">
                        <td class="px-4 py-3 text-stone-500 dark:text-stone-400 font-medium">${idx + 1}</td>
                        <td class="px-4 py-3">
                            <div class="w-10 h-10 bg-[#f6f3ec] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-none overflow-hidden flex items-center justify-center">
                                <img
                                    src="${fotoSrc}"
                                    alt="${namaSafe}"
                                    class="w-full h-full object-cover"
                                    onerror="this.onerror=null;this.src='${DEFAULT_PENGURUS_PHOTO}';"
                                >
                            </div>
                        </td>
                        <td class="px-4 py-3 font-semibold text-stone-900 dark:text-stone-100">${namaSafe}</td>
                        <td class="px-4 py-3 text-stone-700 dark:text-stone-200 font-medium">${escapeHtml(item.jabatan || "-")}</td>
                        <td class="px-4 py-3 text-stone-600 dark:text-stone-300">${escapeHtml(item.noWa || item.telepon || "-")}</td>
                        <td class="px-4 py-3 text-stone-600 dark:text-stone-300">${escapeHtml(item.keterangan || "-")}</td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${badgeClass}">
                                ${escapeHtml(item.status || "Aktif")}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                                type="button"
                                data-pengurus-edit="${escapeHtml(item.id)}"
                                class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] rounded-none transition cursor-pointer"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                data-pengurus-delete="${escapeHtml(item.id)}"
                                class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none transition cursor-pointer"
                            >
                                Hapus
                            </button>
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    async function loadPengurusRt() {
        try {
            const snap = await getDocs(collection(db, PENGURUS_RT_COLLECTION));
            const items = [];
            snap.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            items.sort((a, b) => String(a.nama || "").localeCompare(String(b.nama || ""), "id"));
            pengurusRtList = items;
            renderPengurusTable();
        } catch (err) {
            console.error("Gagal memuat pengurus RT:", err);
            showFeedback("Gagal memuat daftar pengurus RT.", "error");
        }
    }

    async function handleSavePengurus(e) {
        e.preventDefault();
        hideFeedback();

        const nama = pengurusNamaInput.value.trim();
        if (!nama) {
            showFeedback("Nama lengkap pengurus RT wajib diisi.", "error");
            return;
        }

        const editId = pengurusIdInput.value.trim();
        const fotoInputVal = pengurusFotoUrlInput.value.trim();
        const fotoProfil = isSafeImageSrc(fotoInputVal) ? fotoInputVal : DEFAULT_PENGURUS_PHOTO;

        const payload = {
            nama,
            jabatan: pengurusJabatanInput.value || jabatanRtList[0] || "Ketua RT",
            fotoProfil,
            noWa: pengurusWaInput.value.trim(),
            status: pengurusStatusInput.value || "Aktif",
            keterangan: pengurusKeteranganInput.value.trim(),
            updatedAt: new Date().toISOString()
        };

        try {
            if (editId) {
                await updateDoc(doc(db, PENGURUS_RT_COLLECTION, editId), payload);
                showFeedback("Data pengurus RT berhasil diperbarui.");
            } else {
                await addDoc(collection(db, PENGURUS_RT_COLLECTION), {
                    ...payload,
                    createdAt: new Date().toISOString()
                });
                showFeedback("Data pengurus RT berhasil ditambahkan.");
            }
            resetPengurusForm();
            await loadPengurusRt();
        } catch (err) {
            console.error("Gagal menyimpan pengurus RT:", err);
            showFeedback("Gagal menyimpan data pengurus RT.", "error");
        }
    }

    const onClickDelegate = async (e) => {
        const tabBtn = e.target.closest("[data-mp-tab]");
        if (tabBtn) {
            switchTab(tabBtn.getAttribute("data-mp-tab"));
            return;
        }

        const editBtn = e.target.closest("[data-pengurus-edit]");
        if (editBtn) {
            const targetId = editBtn.getAttribute("data-pengurus-edit");
            const found = pengurusRtList.find((u) => u.id === targetId);
            if (found) {
                const existingFoto = found.fotoProfil || found.foto || "";
                pengurusIdInput.value = found.id;
                pengurusNamaInput.value = found.nama || "";
                renderJabatanOptions(found.jabatan || jabatanRtList[0] || "Ketua RT");
                pengurusStatusInput.value = found.status || "Aktif";
                pengurusWaInput.value = found.noWa || found.telepon || "";
                pengurusKeteranganInput.value = found.keterangan || "";
                pengurusFotoUrlInput.value = existingFoto;
                if (pengurusFotoFileInput) pengurusFotoFileInput.value = "";
                syncPengurusFotoPreview(existingFoto);
                pengurusFormTitle.textContent = "EDIT PENGURUS RT";
                pengurusCancelEditBtn.classList.remove("hidden");
                pengurusNamaInput.focus();
            }
            return;
        }

        const deleteBtn = e.target.closest("[data-pengurus-delete]");
        if (deleteBtn) {
            const targetId = deleteBtn.getAttribute("data-pengurus-delete");
            if (!targetId) return;
            if (!window.confirm("Hapus data pengurus RT ini?")) return;

            try {
                await deleteDoc(doc(db, PENGURUS_RT_COLLECTION, targetId));
                if (pengurusIdInput.value === targetId) {
                    resetPengurusForm();
                }
                showFeedback("Data pengurus RT berhasil dihapus.");
                await loadPengurusRt();
            } catch (err) {
                console.error("Gagal menghapus pengurus RT:", err);
                showFeedback("Gagal menghapus data pengurus RT.", "error");
            }
        }
    };

    const onJabatanBaruKeydown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleTambahJabatan();
        }
    };

    const onIconUrlInput = () => {
        if (logoPreviewImg) {
            const val = iconUrlInput.value.trim();
            logoPreviewImg.src = isSafeImageSrc(val) ? val : "assets/icons/icon-192.png";
        }
    };

    const onIconFileChange = async () => {
        const file = iconFileInput.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await compressImageFile(file, 512, 512, 0.8);
            iconUrlInput.value = dataUrl;
            if (logoPreviewImg) {
                logoPreviewImg.src = dataUrl;
            }
        } catch (err) {
            console.error(err);
            showFeedback("Gagal membaca file gambar.", "error");
        }
    };

    const onBannerUrlInput = () => {
        syncBannerPreview(bannerUrlInput?.value || "");
    };

    const onBannerFileChange = async () => {
        const file = bannerFileInput?.files?.[0];
        if (!file) return;
        try {
            const compressedDataUrl = await compressImageFile(file, 1024, 600, 0.76);
            if (bannerUrlInput) bannerUrlInput.value = compressedDataUrl;
            syncBannerPreview(compressedDataUrl);
        } catch (err) {
            console.error(err);
            showFeedback("Gagal memproses gambar banner.", "error");
        }
    };

    const onBannerReset = () => {
        if (bannerUrlInput) bannerUrlInput.value = "";
        if (bannerFileInput) bannerFileInput.value = "";
        syncBannerPreview("");
    };

    const onPengurusFotoUrlInput = () => {
        syncPengurusFotoPreview(pengurusFotoUrlInput.value);
    };

    const onPengurusFotoFileChange = async () => {
        const file = pengurusFotoFileInput?.files?.[0];
        if (!file) return;
        try {
            const compressedDataUrl = await compressImageFile(file, 600, 600, 0.78);
            pengurusFotoUrlInput.value = compressedDataUrl;
            syncPengurusFotoPreview(compressedDataUrl);
        } catch (err) {
            console.error(err);
            showFeedback("Gagal memproses foto pengurus RT.", "error");
        }
    };

    const onPengurusFotoReset = () => {
        pengurusFotoUrlInput.value = "";
        if (pengurusFotoFileInput) pengurusFotoFileInput.value = "";
        syncPengurusFotoPreview("");
    };

    const onClearPolygonClick = () => {
        if (petaPolygonInput) petaPolygonInput.value = "[]";
        syncMapPreview();
    };

    document.addEventListener("click", onClickDelegate);
    profilForm?.addEventListener("submit", handleSaveProfil);
    reloadProfilBtn?.addEventListener("click", loadProfil);
    iconUrlInput?.addEventListener("input", onIconUrlInput);
    iconFileInput?.addEventListener("change", onIconFileChange);

    bannerUrlInput?.addEventListener("input", onBannerUrlInput);
    bannerFileInput?.addEventListener("change", onBannerFileChange);
    bannerResetBtn?.addEventListener("click", onBannerReset);

    pengurusForm?.addEventListener("submit", handleSavePengurus);
    pengurusCancelEditBtn?.addEventListener("click", resetPengurusForm);
    jabatanTambahBtn?.addEventListener("click", handleTambahJabatan);
    jabatanHapusBtn?.addEventListener("click", handleHapusJabatan);
    jabatanBaruInput?.addEventListener("keydown", onJabatanBaruKeydown);
    pengurusFotoUrlInput?.addEventListener("input", onPengurusFotoUrlInput);
    pengurusFotoFileInput?.addEventListener("change", onPengurusFotoFileChange);
    pengurusFotoResetBtn?.addEventListener("click", onPengurusFotoReset);

    petaForm?.addEventListener("submit", handleSavePetaWilayah);
    petaCariBtn?.addEventListener("click", handleCariKoordinat);
    petaClearPolyBtn?.addEventListener("click", onClearPolygonClick);
    petaPreviewBtn?.addEventListener("click", syncMapPreview);
    petaReloadBtn?.addEventListener("click", loadPetaWilayah);

    loadProfil();
    loadJabatanRt();

    return () => {
        isDestroyed = true;
        destroyPreviewMap();
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        document.removeEventListener("click", onClickDelegate);
        profilForm?.removeEventListener("submit", handleSaveProfil);
        reloadProfilBtn?.removeEventListener("click", loadProfil);
        iconUrlInput?.removeEventListener("input", onIconUrlInput);
        iconFileInput?.removeEventListener("change", onIconFileChange);

        bannerUrlInput?.removeEventListener("input", onBannerUrlInput);
        bannerFileInput?.removeEventListener("change", onBannerFileChange);
        bannerResetBtn?.removeEventListener("click", onBannerReset);

        pengurusForm?.removeEventListener("submit", handleSavePengurus);
        pengurusCancelEditBtn?.removeEventListener("click", resetPengurusForm);
        jabatanTambahBtn?.removeEventListener("click", handleTambahJabatan);
        jabatanHapusBtn?.removeEventListener("click", handleHapusJabatan);
        jabatanBaruInput?.removeEventListener("keydown", onJabatanBaruKeydown);
        pengurusFotoUrlInput?.removeEventListener("input", onPengurusFotoUrlInput);
        pengurusFotoFileInput?.removeEventListener("change", onPengurusFotoFileChange);
        pengurusFotoResetBtn?.removeEventListener("click", onPengurusFotoReset);

        petaForm?.removeEventListener("submit", handleSavePetaWilayah);
        petaCariBtn?.removeEventListener("click", handleCariKoordinat);
        petaClearPolyBtn?.removeEventListener("click", onClearPolygonClick);
        petaPreviewBtn?.removeEventListener("click", syncMapPreview);
        petaReloadBtn?.removeEventListener("click", loadPetaWilayah);
    };
}

export default renderManajemenPengaturan;