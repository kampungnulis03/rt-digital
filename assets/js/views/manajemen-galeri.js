// File: assets/js/views/manajemen-galeri.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const GALERI_COLLECTION = "galeri";
const DEFAULT_GALLERY_IMAGE = "assets/icons/Logo.png";
const FEEDBACK_AUTO_HIDE_MS = 3500;
const ITEMS_PER_PAGE = 5;
const RT_GALLERY_CATEGORIES = [
    "Kegiatan Warga",
    "Kerja Bakti",
    "Rapat & Musyawarah",
    "Ronda & Keamanan",
    "Umum"
];

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeRtCategory(cat = "") {
    const raw = String(cat || "").trim();
    if (!raw) return "Kegiatan Warga";
    const lower = raw.toLowerCase();
    if (lower === "kegiatan" || lower === "kegiatan warga") return "Kegiatan Warga";
    if (lower.includes("kerja bakti") || lower.includes("gotong royong")) return "Kerja Bakti";
    if (lower.includes("rapat") || lower.includes("musyawarah")) return "Rapat & Musyawarah";
    if (lower.includes("ronda") || lower.includes("keamanan") || lower.includes("fasilitas")) return "Ronda & Keamanan";
    if (lower === "umum" || lower === "unit usaha") return "Umum";
    return raw;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
        reader.readAsDataURL(file);
    });
}

async function compressGalleryImage(file, maxSize = 720, quality = 0.78) {
    const rawDataUrl = await readFileAsDataUrl(file);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxSize || height > maxSize) {
                if (width >= height) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                } else {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
            }
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
    });
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

export function renderManajemenGaleri() {
    const formCategoryOptions = RT_GALLERY_CATEGORIES
        .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
        .join("");

    const filterCategoryOptions = RT_GALLERY_CATEGORIES
        .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
        .join("");

    return `
        <div class="space-y-5">
            <!-- Header Halaman -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Manajemen Galeri
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Tambah dan atur dokumentasi foto kegiatan, kerja bakti, rapat, dan ronda warga RT.
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        id="mg-toggle-form-btn"
                        class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <span>+ Tambah Foto</span>
                    </button>
                    <a
                        href="#/manajemen"
                        data-link
                        class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition"
                    >
                        <span>← Kembali</span>
                    </a>
                </div>
            </div>

            <!-- Toast Notifikasi Pojok Kanan Atas -->
            <div id="mg-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200"></div>

            <!-- Form Tambah / Edit Foto Galeri -->
            <div id="mg-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="mg-galeri-form" class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h2 id="mg-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            TAMBAH FOTO GALERI
                        </h2>
                        <button
                            type="button"
                            id="mg-cancel-form-btn"
                            class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                        >
                            Tutup Form
                        </button>
                    </div>

                    <input type="hidden" id="mg-edit-id" value="">

                    <div class="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
                        <!-- Pratinjau Foto -->
                        <div class="bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-none p-3.5 flex flex-col items-center text-center">
                            <span class="text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-2.5">
                                Foto Kegiatan
                            </span>
                            <div class="w-full h-36 bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-none overflow-hidden flex items-center justify-center mb-3">
                                <img
                                    id="mg-foto-preview"
                                    src="${DEFAULT_GALLERY_IMAGE}"
                                    alt="Preview Foto Galeri"
                                    class="w-full h-full object-cover rounded-none"
                                >
                            </div>
                            <div class="w-full space-y-2 text-left">
                                <input
                                    type="file"
                                    id="mg-foto-file"
                                    accept="image/*"
                                    class="w-full text-[11px] text-stone-600 dark:text-stone-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-none file:border file:border-stone-300 dark:file:border-stone-700 file:text-[11px] file:font-semibold file:bg-[#faf8f3] dark:file:bg-stone-800 file:text-stone-700 dark:file:text-stone-200 hover:file:border-[#c87d32] cursor-pointer"
                                >
                                <input
                                    type="text"
                                    id="mg-foto-url"
                                    placeholder="Atau masukkan URL foto..."
                                    class="w-full px-2.5 py-1.5 text-xs bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                <button
                                    type="button"
                                    id="mg-foto-reset"
                                    class="w-full py-1 text-[11px] font-semibold text-stone-600 dark:text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 border border-stone-200 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-900 rounded-none transition cursor-pointer"
                                >
                                    Reset Foto
                                </button>
                            </div>
                        </div>

                        <!-- Detail Foto Kegiatan -->
                        <div class="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="md:col-span-2">
                                <label for="mg-judul" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Judul / Nama Kegiatan <span class="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="mg-judul"
                                    required
                                    placeholder="Contoh: Kerja Bakti Bersih Saluran Air RT"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mg-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Tanggal Kegiatan
                                </label>
                                <input
                                    type="date"
                                    id="mg-tanggal"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mg-kategori" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Kategori
                                </label>
                                <select
                                    id="mg-kategori"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    ${formCategoryOptions}
                                </select>
                            </div>

                            <div class="md:col-span-2">
                                <label for="mg-lokasi" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Lokasi / Tempat
                                </label>
                                <input
                                    type="text"
                                    id="mg-lokasi"
                                    placeholder="Contoh: Balai Warga / Pos Ronda RT"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div class="md:col-span-3">
                                <label for="mg-deskripsi" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Keterangan / Deskripsi
                                </label>
                                <textarea
                                    id="mg-deskripsi"
                                    rows="3"
                                    placeholder="Catatan singkat dokumentasi kegiatan warga..."
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                ></textarea>
                            </div>

                            <div class="md:col-span-3 flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    id="mg-reset-form-btn"
                                    class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                                >
                                    Bersihkan
                                </button>
                                <button
                                    type="submit"
                                    id="mg-submit-btn"
                                    class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                                >
                                    Simpan Galeri
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Filter, Aksi Massal & Pencarian -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <select
                        id="mg-filter-kategori"
                        class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                        <option value="">Semua Kategori</option>
                        ${filterCategoryOptions}
                    </select>
                    <span id="mg-total-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Foto
                    </span>
                    <button
                        type="button"
                        id="mg-bulk-delete-btn"
                        class="hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/70 rounded-none transition cursor-pointer"
                    >
                        <span>Hapus Terpilih</span>
                        <span id="mg-selected-count" class="px-1.5 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-none">0</span>
                    </button>
                </div>

                <div class="w-full sm:w-72">
                    <input
                        type="text"
                        id="mg-search-input"
                        placeholder="Cari judul, lokasi, atau keterangan..."
                        class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                </div>
            </div>

            <!-- Tabel Galeri -->
            <div id="mg-list-container" class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                            <tr>
                                <th class="px-4 py-3 w-11 text-center">
                                    <input
                                        type="checkbox"
                                        id="mg-select-all"
                                        class="w-4 h-4 rounded-none border-stone-300 dark:border-stone-700 cursor-pointer align-middle"
                                    >
                                </th>
                                <th class="px-4 py-3 w-28">Foto Galeri</th>
                                <th class="px-4 py-3">Judul &amp; Detail</th>
                                <th class="px-4 py-3">Deskripsi</th>
                                <th id="mg-th-aksi" class="px-4 py-3 text-right w-36">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="mg-table-body" class="divide-y divide-stone-200 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                            <tr>
                                <td colspan="5" class="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                                    Memuat data galeri...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Footer Paginasi -->
                <div id="mg-pagination-bar" class="px-4 py-3 border-t border-stone-200 dark:border-stone-800 bg-[#faf8f3] dark:bg-stone-900 flex items-center justify-end gap-2 text-xs">
                    <button
                        type="button"
                        id="mg-prev-page"
                        class="px-2.5 py-1 border border-transparent hover:border-stone-300 dark:hover:border-stone-700 rounded-none text-stone-600 dark:text-stone-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                        &lt; Previous
                    </button>
                    <span
                        id="mg-page-indicator"
                        class="px-2.5 py-1 border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 font-semibold text-stone-900 dark:text-stone-100 rounded-none"
                    >
                        1
                    </span>
                    <button
                        type="button"
                        id="mg-next-page"
                        class="px-2.5 py-1 border border-transparent hover:border-stone-300 dark:hover:border-stone-700 rounded-none text-stone-600 dark:text-stone-300 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                        Next &gt;
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal Pratinjau Foto -->
        <div id="mg-preview-modal" class="hidden fixed inset-0 z-50 bg-stone-950/75 flex items-center justify-center p-4">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-none max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                <div class="px-5 py-3.5 bg-[#5c6d4e] text-white flex items-center justify-between flex-shrink-0">
                    <span id="mg-modal-category" class="text-[11px] font-bold uppercase tracking-wider">PRATINJAU GALERI</span>
                    <button
                        type="button"
                        id="mg-close-modal-btn"
                        class="text-stone-100 hover:text-white text-sm font-bold px-2 py-0.5 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
                <div class="p-5 overflow-y-auto space-y-4">
                    <div class="bg-[#f6f3ec] dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-none overflow-hidden flex items-center justify-center">
                        <img
                            id="mg-modal-image"
                            src="${DEFAULT_GALLERY_IMAGE}"
                            alt="Pratinjau Foto"
                            class="w-full max-h-[55vh] object-contain rounded-none"
                        >
                    </div>
                    <div>
                        <h3 id="mg-modal-title" class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100"></h3>
                        <p id="mg-modal-meta" class="text-xs text-stone-500 dark:text-stone-400 mt-1"></p>
                    </div>
                    <p id="mg-modal-desc" class="text-xs md:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line"></p>
                </div>
            </div>
        </div>
    `;
}

export function initManajemenGaleriHandler() {
    let galeriList = [];
    const selectedIds = new Set();
    let currentPage = 1;
    let isDestroyed = false;
    let feedbackTimerId = null;

    const isAdmin = getCurrentUserRole() === "administrator";
    const todayIso = new Date().toISOString().slice(0, 10);

    const feedbackEl = document.getElementById("mg-feedback");
    const toggleFormBtn = document.getElementById("mg-toggle-form-btn");
    const formPanel = document.getElementById("mg-form-panel");
    const cancelFormBtn = document.getElementById("mg-cancel-form-btn");
    const resetFormBtn = document.getElementById("mg-reset-form-btn");
    const galeriForm = document.getElementById("mg-galeri-form");
    const formTitleEl = document.getElementById("mg-form-title");

    const editIdInput = document.getElementById("mg-edit-id");
    const judulInput = document.getElementById("mg-judul");
    const tanggalInput = document.getElementById("mg-tanggal");
    const kategoriInput = document.getElementById("mg-kategori");
    const lokasiInput = document.getElementById("mg-lokasi");
    const deskripsiInput = document.getElementById("mg-deskripsi");

    const fotoFileInput = document.getElementById("mg-foto-file");
    const fotoUrlInput = document.getElementById("mg-foto-url");
    const fotoPreviewImg = document.getElementById("mg-foto-preview");
    const fotoResetBtn = document.getElementById("mg-foto-reset");

    const filterKategoriSelect = document.getElementById("mg-filter-kategori");
    const searchInput = document.getElementById("mg-search-input");
    const totalBadgeEl = document.getElementById("mg-total-badge");
    const bulkDeleteBtn = document.getElementById("mg-bulk-delete-btn");
    const selectedCountEl = document.getElementById("mg-selected-count");
    const selectAllCheckbox = document.getElementById("mg-select-all");
    const aksiThEl = document.getElementById("mg-th-aksi");
    const tableBodyEl = document.getElementById("mg-table-body");
    const prevPageBtn = document.getElementById("mg-prev-page");
    const nextPageBtn = document.getElementById("mg-next-page");
    const pageIndicatorEl = document.getElementById("mg-page-indicator");

    const previewModalEl = document.getElementById("mg-preview-modal");
    const closeModalBtn = document.getElementById("mg-close-modal-btn");

    if (!isAdmin) {
        toggleFormBtn?.classList.add("hidden");
        aksiThEl?.classList.add("hidden");
        bulkDeleteBtn?.classList.add("hidden");
    }

    function hideFeedback() {
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        feedbackEl?.classList.add("hidden");
    }

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

    function syncBulkDeleteUI(pageItems = []) {
        const count = selectedIds.size;
        if (selectedCountEl) {
            selectedCountEl.textContent = `${count}`;
        }
        if (bulkDeleteBtn) {
            bulkDeleteBtn.classList.toggle("hidden", !isAdmin || count === 0);
        }
        if (selectAllCheckbox) {
            selectAllCheckbox.checked =
                pageItems.length > 0 && pageItems.every((item) => selectedIds.has(item.id));
        }
    }

    function syncFotoPreview(url = "") {
        if (!fotoPreviewImg) return;
        fotoPreviewImg.src = String(url || "").trim() || DEFAULT_GALLERY_IMAGE;
    }

    function resetGaleriForm() {
        editIdInput.value = "";
        judulInput.value = "";
        tanggalInput.value = todayIso;
        kategoriInput.value = "Kegiatan Warga";
        lokasiInput.value = "";
        deskripsiInput.value = "";
        fotoUrlInput.value = "";
        if (fotoFileInput) fotoFileInput.value = "";
        syncFotoPreview("");
        formTitleEl.textContent = "TAMBAH FOTO GALERI";
    }

    function openFormPanel(item = null) {
        if (!isAdmin) return;
        hideFeedback();
        formPanel?.classList.remove("hidden");

        if (item) {
            editIdInput.value = item.id || "";
            judulInput.value = item.judul || "";
            tanggalInput.value = item.tanggal || todayIso;
            kategoriInput.value = normalizeRtCategory(item.kategori);
            lokasiInput.value = item.lokasi || "";
            deskripsiInput.value = item.deskripsi || "";
            const existingFoto = item.foto || item.gambar || item.url || "";
            fotoUrlInput.value = existingFoto;
            if (fotoFileInput) fotoFileInput.value = "";
            syncFotoPreview(existingFoto);
            formTitleEl.textContent = "EDIT FOTO GALERI";
        } else {
            resetGaleriForm();
        }

        judulInput?.focus();
    }

    function closeFormPanel() {
        formPanel?.classList.add("hidden");
        resetGaleriForm();
    }

    function getFilteredGaleri() {
        const selectedCat = String(filterKategoriSelect?.value || "").trim().toLowerCase();
        const keyword = String(searchInput?.value || "").trim().toLowerCase();

        return galeriList.filter((item) => {
            const itemCat = normalizeRtCategory(item.kategori).toLowerCase();
            if (selectedCat && itemCat !== selectedCat) {
                return false;
            }
            if (keyword) {
                const haystack = `${item.judul || ""} ${itemCat} ${item.lokasi || ""} ${item.deskripsi || ""}`.toLowerCase();
                if (!haystack.includes(keyword)) return false;
            }
            return true;
        });
    }

    function renderGaleriTable() {
        if (!tableBodyEl || isDestroyed) return;

        const filtered = getFilteredGaleri();
        const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
        const colSpan = isAdmin ? 5 : 4;

        if (totalBadgeEl) {
            totalBadgeEl.textContent = `${filtered.length} Foto`;
        }

        if (pageIndicatorEl) {
            pageIndicatorEl.textContent = `${currentPage}`;
            pageIndicatorEl.title = `Halaman ${currentPage} dari ${totalPages}`;
        }
        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1;
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage >= totalPages;
        }

        if (!pageItems.length) {
            tableBodyEl.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" class="p-8 text-center text-xs text-stone-500 dark:text-stone-400">
                        Tidak ada foto galeri yang ditampilkan.
                    </td>
                </tr>
            `;
            syncBulkDeleteUI([]);
            return;
        }

        tableBodyEl.innerHTML = pageItems
            .map((item) => {
                const imgSrc = escapeHtml(item.foto || item.gambar || item.url || DEFAULT_GALLERY_IMAGE);
                const judulSafe = escapeHtml(item.judul || "Dokumentasi Kegiatan");
                const kategoriSafe = escapeHtml(normalizeRtCategory(item.kategori));
                const tanggalSafe = escapeHtml(formatTanggalDisplay(item.tanggal));
                const lokasiSafe = escapeHtml(item.lokasi || "");
                const deskripsiSafe = escapeHtml(item.deskripsi || "-");
                const checkedAttr = selectedIds.has(item.id) ? "checked" : "";

                const adminTd = isAdmin
                    ? `
                        <td class="px-4 py-3 align-middle text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1.5">
                                <button
                                    type="button"
                                    data-galeri-edit="${escapeHtml(item.id)}"
                                    class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] rounded-none transition cursor-pointer"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    data-galeri-delete="${escapeHtml(item.id)}"
                                    class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none transition cursor-pointer"
                                >
                                    Hapus
                                </button>
                            </div>
                        </td>
                    `
                    : "";

                return `
                    <tr class="hover:bg-[#f6f3ec]/60 dark:hover:bg-stone-800/40 transition">
                        <td class="px-4 py-3 align-middle text-center">
                            <input
                                type="checkbox"
                                data-galeri-check="${escapeHtml(item.id)}"
                                ${checkedAttr}
                                class="w-4 h-4 rounded-none border-stone-300 dark:border-stone-700 cursor-pointer align-middle"
                            >
                        </td>
                        <td class="px-4 py-3 align-middle">
                            <button
                                type="button"
                                data-galeri-preview="${escapeHtml(item.id)}"
                                class="block w-24 h-12 bg-[#f6f3ec] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-none overflow-hidden cursor-pointer focus:outline-none"
                                title="Lihat foto"
                            >
                                <img
                                    src="${imgSrc}"
                                    alt="${judulSafe}"
                                    class="w-full h-full object-cover rounded-none"
                                    onerror="this.onerror=null;this.src='${DEFAULT_GALLERY_IMAGE}';"
                                >
                            </button>
                        </td>
                        <td class="px-4 py-3 align-middle">
                            <div class="font-bold text-stone-900 dark:text-stone-100 leading-snug">
                                ${judulSafe}
                            </div>
                            <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-stone-500 dark:text-stone-400">
                                <span class="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-[#f6f3ec] dark:bg-stone-800 text-[#4a5a3f] dark:text-stone-300 border-stone-300 dark:border-stone-700">
                                    ${kategoriSafe}
                                </span>
                                <span>${tanggalSafe}</span>
                                ${lokasiSafe ? `<span>• ${lokasiSafe}</span>` : ""}
                            </div>
                        </td>
                        <td class="px-4 py-3 align-middle text-stone-700 dark:text-stone-300 max-w-md">
                            <p class="line-clamp-2 leading-relaxed">${deskripsiSafe}</p>
                        </td>
                        ${adminTd}
                    </tr>
                `;
            })
            .join("");

        syncBulkDeleteUI(pageItems);
    }

    async function loadGaleri() {
        try {
            const snap = await getDocs(collection(db, GALERI_COLLECTION));
            const items = [];
            snap.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            items.sort((a, b) => {
                const dateA = String(a.tanggal || a.createdAt || "");
                const dateB = String(b.tanggal || b.createdAt || "");
                return dateB.localeCompare(dateA);
            });
            galeriList = items;

            const validIds = new Set(items.map((item) => item.id));
            [...selectedIds].forEach((id) => {
                if (!validIds.has(id)) selectedIds.delete(id);
            });

            renderGaleriTable();
        } catch (err) {
            console.error("Gagal memuat galeri:", err);
            showFeedback("Gagal memuat data galeri dari database.", "error");
        }
    }

    async function handleSubmitGaleri(e) {
        e.preventDefault();
        if (!isAdmin) return;
        hideFeedback();

        const judul = judulInput.value.trim();
        const foto = fotoUrlInput.value.trim() || DEFAULT_GALLERY_IMAGE;

        if (!judul) {
            showFeedback("Judul / nama kegiatan wajib diisi.", "error");
            return;
        }

        const editId = editIdInput.value.trim();
        const payload = {
            judul,
            tanggal: tanggalInput.value || todayIso,
            kategori: normalizeRtCategory(kategoriInput.value),
            lokasi: lokasiInput.value.trim(),
            deskripsi: deskripsiInput.value.trim(),
            foto,
            updatedAt: new Date().toISOString()
        };

        try {
            if (editId) {
                await updateDoc(doc(db, GALERI_COLLECTION, editId), payload);
                showFeedback("Data galeri berhasil diperbarui.");
            } else {
                await addDoc(collection(db, GALERI_COLLECTION), {
                    ...payload,
                    createdAt: new Date().toISOString()
                });
                showFeedback("Foto galeri berhasil ditambahkan.");
            }
            closeFormPanel();
            await loadGaleri();
        } catch (err) {
            console.error("Gagal menyimpan galeri:", err);
            showFeedback("Gagal menyimpan data galeri ke database.", "error");
        }
    }

    async function handleBulkDelete() {
        if (!isAdmin || selectedIds.size === 0) return;
        const idsToDelete = [...selectedIds];
        if (!window.confirm(`Hapus ${idsToDelete.length} foto galeri terpilih?`)) return;

        const results = await Promise.allSettled(
            idsToDelete.map((id) => deleteDoc(doc(db, GALERI_COLLECTION, id)))
        );

        let successCount = 0;
        results.forEach((res, idx) => {
            const id = idsToDelete[idx];
            if (res.status === "fulfilled") {
                successCount += 1;
                selectedIds.delete(id);
                if (editIdInput.value === id) {
                    closeFormPanel();
                }
            } else {
                console.error(`Gagal menghapus galeri ${id}:`, res.reason);
            }
        });

        if (successCount > 0 && successCount === idsToDelete.length) {
            showFeedback(`${successCount} foto galeri terpilih berhasil dihapus.`);
        } else if (successCount > 0) {
            showFeedback(`${successCount} dari ${idsToDelete.length} foto berhasil dihapus.`, "error");
        } else {
            showFeedback("Gagal menghapus foto galeri terpilih.", "error");
        }

        await loadGaleri();
    }

    function openPreviewModal(item) {
        if (!item || !previewModalEl) return;
        document.getElementById("mg-modal-category").textContent = normalizeRtCategory(item.kategori).toUpperCase();
        document.getElementById("mg-modal-image").src = item.foto || item.gambar || item.url || DEFAULT_GALLERY_IMAGE;
        document.getElementById("mg-modal-title").textContent = item.judul || "Dokumentasi Kegiatan";
        const lokasiPart = item.lokasi ? ` • 📍 ${item.lokasi}` : "";
        document.getElementById("mg-modal-meta").textContent = `${formatTanggalDisplay(item.tanggal)}${lokasiPart}`;
        document.getElementById("mg-modal-desc").textContent = item.deskripsi || "-";
        previewModalEl.classList.remove("hidden");
    }

    function closePreviewModal() {
        previewModalEl?.classList.add("hidden");
    }

    const onClickDelegate = async (e) => {
        const previewBtn = e.target.closest("[data-galeri-preview]");
        if (previewBtn) {
            const id = previewBtn.getAttribute("data-galeri-preview");
            const found = galeriList.find((g) => g.id === id);
            if (found) openPreviewModal(found);
            return;
        }

        if (!isAdmin) return;

        const editBtn = e.target.closest("[data-galeri-edit]");
        if (editBtn) {
            const id = editBtn.getAttribute("data-galeri-edit");
            const found = galeriList.find((g) => g.id === id);
            if (found) openFormPanel(found);
            return;
        }

        const deleteBtn = e.target.closest("[data-galeri-delete]");
        if (deleteBtn) {
            const id = deleteBtn.getAttribute("data-galeri-delete");
            if (!id) return;
            if (!window.confirm("Hapus foto galeri ini?")) return;

            try {
                await deleteDoc(doc(db, GALERI_COLLECTION, id));
                selectedIds.delete(id);
                if (editIdInput.value === id) {
                    closeFormPanel();
                }
                showFeedback("Foto galeri berhasil dihapus.");
                await loadGaleri();
            } catch (err) {
                console.error("Gagal menghapus galeri:", err);
                showFeedback("Gagal menghapus foto galeri.", "error");
            }
        }
    };

    const onTableChangeDelegate = (e) => {
        const rowCheck = e.target.closest("[data-galeri-check]");
        if (!rowCheck) return;
        const id = rowCheck.getAttribute("data-galeri-check");
        if (!id) return;

        if (rowCheck.checked) {
            selectedIds.add(id);
        } else {
            selectedIds.delete(id);
        }

        const filtered = getFilteredGaleri();
        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);
        syncBulkDeleteUI(pageItems);
    };

    const onToggleFormClick = () => {
        if (formPanel?.classList.contains("hidden")) {
            openFormPanel(null);
        } else {
            closeFormPanel();
        }
    };

    const onFilterOrSearchChange = () => {
        currentPage = 1;
        renderGaleriTable();
    };

    const onPrevPageClick = () => {
        if (currentPage > 1) {
            currentPage -= 1;
            renderGaleriTable();
        }
    };

    const onNextPageClick = () => {
        const totalPages = Math.max(1, Math.ceil(getFilteredGaleri().length / ITEMS_PER_PAGE));
        if (currentPage < totalPages) {
            currentPage += 1;
            renderGaleriTable();
        }
    };

    const onSelectAllChange = () => {
        const checked = Boolean(selectAllCheckbox?.checked);
        const filtered = getFilteredGaleri();
        const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
        const pageItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

        pageItems.forEach((item) => {
            if (checked) {
                selectedIds.add(item.id);
            } else {
                selectedIds.delete(item.id);
            }
        });

        tableBodyEl?.querySelectorAll("[data-galeri-check]").forEach((cb) => {
            cb.checked = checked;
        });

        syncBulkDeleteUI(pageItems);
    };

    const onFotoFileChange = async () => {
        const file = fotoFileInput?.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressGalleryImage(file, 720, 0.78);
            fotoUrlInput.value = compressed;
            syncFotoPreview(compressed);
        } catch (err) {
            console.error(err);
            showFeedback("Gagal memproses file foto.", "error");
        }
    };

    const onFotoUrlInput = () => {
        syncFotoPreview(fotoUrlInput.value);
    };

    const onFotoReset = () => {
        fotoUrlInput.value = "";
        if (fotoFileInput) fotoFileInput.value = "";
        syncFotoPreview("");
    };

    const onModalBackdropClick = (e) => {
        if (e.target === previewModalEl) {
            closePreviewModal();
        }
    };

    tanggalInput.value = todayIso;

    toggleFormBtn?.addEventListener("click", onToggleFormClick);
    cancelFormBtn?.addEventListener("click", closeFormPanel);
    resetFormBtn?.addEventListener("click", resetGaleriForm);
    galeriForm?.addEventListener("submit", handleSubmitGaleri);
    fotoFileInput?.addEventListener("change", onFotoFileChange);
    fotoUrlInput?.addEventListener("input", onFotoUrlInput);
    fotoResetBtn?.addEventListener("click", onFotoReset);
    filterKategoriSelect?.addEventListener("change", onFilterOrSearchChange);
    searchInput?.addEventListener("input", onFilterOrSearchChange);
    bulkDeleteBtn?.addEventListener("click", handleBulkDelete);
    selectAllCheckbox?.addEventListener("change", onSelectAllChange);
    tableBodyEl?.addEventListener("change", onTableChangeDelegate);
    prevPageBtn?.addEventListener("click", onPrevPageClick);
    nextPageBtn?.addEventListener("click", onNextPageClick);
    closeModalBtn?.addEventListener("click", closePreviewModal);
    previewModalEl?.addEventListener("click", onModalBackdropClick);
    document.addEventListener("click", onClickDelegate);

    loadGaleri();

    return () => {
        isDestroyed = true;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        toggleFormBtn?.removeEventListener("click", onToggleFormClick);
        cancelFormBtn?.removeEventListener("click", closeFormPanel);
        resetFormBtn?.removeEventListener("click", resetGaleriForm);
        galeriForm?.removeEventListener("submit", handleSubmitGaleri);
        fotoFileInput?.removeEventListener("change", onFotoFileChange);
        fotoUrlInput?.removeEventListener("input", onFotoUrlInput);
        fotoResetBtn?.removeEventListener("click", onFotoReset);
        filterKategoriSelect?.removeEventListener("change", onFilterOrSearchChange);
        searchInput?.removeEventListener("input", onFilterOrSearchChange);
        bulkDeleteBtn?.removeEventListener("click", handleBulkDelete);
        selectAllCheckbox?.removeEventListener("change", onSelectAllChange);
        tableBodyEl?.removeEventListener("change", onTableChangeDelegate);
        prevPageBtn?.removeEventListener("click", onPrevPageClick);
        nextPageBtn?.removeEventListener("click", onNextPageClick);
        closeModalBtn?.removeEventListener("click", closePreviewModal);
        previewModalEl?.removeEventListener("click", onModalBackdropClick);
        document.removeEventListener("click", onClickDelegate);
    };
}

export default renderManajemenGaleri;