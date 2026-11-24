// File: assets/js/views/manajemen-detail-unit.js
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const UNIT_USAHA_COLLECTION = "unit_usaha";
const DETAIL_UNIT_COLLECTION = "detail_unit";
const DEFAULT_DETAIL_IMAGE = "assets/icons/Logo.png";

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeStatus(data = {}) {
    if (typeof data.aktif === "boolean") {
        return data.aktif ? "Aktif" : "Nonaktif";
    }
    const raw = String(data.status || "").trim();
    const lower = raw.toLowerCase();
    if (lower === "aktif" || lower === "active" || lower === "true") return "Aktif";
    if (lower === "nonaktif" || lower === "inactive" || lower === "false") return "Nonaktif";
    return raw || "Aktif";
}

function compressImageFile(file, maxWidth = 900, quality = 0.72) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            reject(new Error("File harus berupa gambar."));
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = () => reject(new Error("Gagal memproses gambar."));
            img.src = event.target.result;
        };
        reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
        reader.readAsDataURL(file);
    });
}

export function renderManajemenDetailUnit() {
    return `
        <div class="w-full space-y-5">
            <!-- Header Halaman -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2">
                        <a
                            href="#/manajemen"
                            data-link
                            data-route="manajemen"
                            class="px-2.5 py-1 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-none transition"
                        >
                            ← Kembali
                        </a>
                        <h1 class="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug">
                            Manajemen Detail Unit
                        </h1>
                    </div>
                    <p id="mdu-summary" class="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        Kelola informasi profil &amp; konten detail untuk masing-masing unit usaha.
                    </p>
                </div>

                <button
                    type="button"
                    id="btn-mdu-reset-item"
                    class="px-3.5 py-2 text-xs font-semibold bg-indigo-900 hover:bg-indigo-800 text-white border border-indigo-950 rounded-none transition cursor-pointer flex-shrink-0"
                >
                    + Item Detail Baru
                </button>
            </div>

            <!-- Panel 1: Edit Profil / Keterangan Utama Unit Usaha -->
            <section class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none p-4 sm:p-6 shadow-sm space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Profil &amp; Keterangan Utama Unit Usaha
                        </h2>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">
                            Perbarui keterangan lengkap, penanggung jawab, foto utama, dan status unit usaha.
                        </p>
                    </div>
                    <div class="w-full sm:w-64">
                        <label for="mdu-target-unit" class="sr-only">Pilih Unit Usaha</label>
                        <select
                            id="mdu-target-unit"
                            class="w-full px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                        >
                            <option value="">-- Memuat Unit Usaha --</option>
                        </select>
                    </div>
                </div>

                <form id="form-mdu-profil-unit" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div>
                            <label for="mdu-unit-nama" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                Nama Unit Usaha *
                            </label>
                            <input
                                type="text"
                                id="mdu-unit-nama"
                                required
                                class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                            >
                        </div>

                        <div>
                            <label for="mdu-unit-pj" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                Penanggung Jawab
                            </label>
                            <input
                                type="text"
                                id="mdu-unit-pj"
                                placeholder="Nama penanggung jawab"
                                class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                            >
                        </div>

                        <div>
                            <label for="mdu-unit-status" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                Status Unit
                            </label>
                            <select
                                id="mdu-unit-status"
                                class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                            >
                                <option value="Aktif">Aktif</option>
                                <option value="Nonaktif">Nonaktif</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label for="mdu-unit-keterangan" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                            Keterangan / Deskripsi Lengkap Unit
                        </label>
                        <textarea
                            id="mdu-unit-keterangan"
                            rows="4"
                            placeholder="Tulis profil, kegiatan, layanan, atau keterangan lengkap unit usaha..."
                            class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600 leading-relaxed"
                        ></textarea>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <div class="md:col-span-2 space-y-3">
                            <div>
                                <label for="mdu-unit-file" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                    Upload Foto Utama Unit
                                </label>
                                <input
                                    type="file"
                                    id="mdu-unit-file"
                                    accept="image/*"
                                    class="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-none file:border file:border-slate-300 dark:file:border-slate-700 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-700 cursor-pointer"
                                >
                            </div>

                            <div>
                                <label for="mdu-unit-img-url" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                    Atau URL / Data Foto Unit
                                </label>
                                <input
                                    type="text"
                                    id="mdu-unit-img-url"
                                    placeholder="https://... atau biarkan kosong"
                                    class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                                >
                            </div>
                        </div>

                        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-none p-2.5 flex flex-col items-center justify-center">
                            <div class="w-full h-32 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center">
                                <img
                                    id="mdu-unit-preview"
                                    src="${DEFAULT_DETAIL_IMAGE}"
                                    alt="Preview Unit"
                                    class="w-full h-full object-cover"
                                    onerror="this.onerror=null;this.src='${DEFAULT_DETAIL_IMAGE}';"
                                >
                            </div>
                            <span class="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                                Preview Foto Utama Unit
                            </span>
                        </div>
                    </div>

                    <div id="mdu-unit-feedback" class="hidden text-xs px-3 py-2 border rounded-none font-medium"></div>

                    <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <a
                            id="mdu-lihat-halaman-detail"
                            href="#/unit-usaha-detail"
                            data-link
                            class="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-none transition"
                        >
                            Lihat Halaman Detail →
                        </a>

                        <button
                            type="submit"
                            id="btn-mdu-simpan-unit"
                            class="px-5 py-2 text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white border border-indigo-950 rounded-none transition cursor-pointer"
                        >
                            Simpan Profil Unit
                        </button>
                    </div>
                </form>
            </section>

            <!-- Panel 2: Input / Edit Item Detail Unit (Fasilitas / Layanan / Catatan) -->
            <section class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none p-4 sm:p-6 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                        <h2 id="mdu-item-heading" class="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Tambah Item Detail Unit
                        </h2>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">
                            Tambahkan poin layanan, fasilitas, paket, atau dokumentasi pendukung untuk unit terpilih.
                        </p>
                    </div>
                    <span id="mdu-item-edit-badge" class="hidden px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-none">
                        Mode Edit
                    </span>
                </div>

                <form id="form-mdu-item" class="space-y-4">
                    <input type="hidden" id="mdu-item-edit-id" value="">

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div class="md:col-span-2">
                            <label for="mdu-item-judul" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                Judul / Nama Item *
                            </label>
                            <input
                                type="text"
                                id="mdu-item-judul"
                                required
                                placeholder="Contoh: Paket Edukasi Kebun Pisang"
                                class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                            >
                        </div>

                        <div>
                            <label for="mdu-item-kategori" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                                Kategori Item
                            </label>
                            <input
                                type="text"
                                id="mdu-item-kategori"
                                placeholder="Contoh: Layanan, Fasilitas, Produk"
                                class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600"
                            >
                        </div>
                    </div>

                    <div>
                        <label for="mdu-item-deskripsi" class="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                            Deskripsi Item *
                        </label>
                        <textarea
                            id="mdu-item-deskripsi"
                            rows="3"
                            required
                            placeholder="Jelaskan detail item untuk unit usaha ini..."
                            class="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-600 leading-relaxed"
                        ></textarea>
                    </div>

                    <div id="mdu-item-feedback" class="hidden text-xs px-3 py-2 border rounded-none font-medium"></div>

                    <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            id="btn-mdu-batal-item"
                            class="hidden px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-none transition cursor-pointer"
                        >
                            Batal Edit
                        </button>
                        <button
                            type="submit"
                            id="btn-mdu-simpan-item"
                            class="px-5 py-2 text-xs font-bold bg-indigo-900 hover:bg-indigo-800 text-white border border-indigo-950 rounded-none transition cursor-pointer"
                        >
                            Simpan Item Detail
                        </button>
                    </div>
                </form>

                <!-- Daftar Item Detail Unit Terpilih -->
                <div id="mdu-item-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div class="col-span-full text-center text-xs text-slate-500 dark:text-slate-400 py-4">
                        Memuat item detail unit...
                    </div>
                </div>
            </section>
        </div>
    `;
}

export async function initManajemenDetailUnitHandler() {
    let isDestroyed = false;
    let units = [];
    let detailItems = [];
    let selectedUnitId = "";
    let currentUnitImageData = "";

    const summaryEl = document.getElementById("mdu-summary");
    const targetUnitSelect = document.getElementById("mdu-target-unit");
    const lihatDetailLink = document.getElementById("mdu-lihat-halaman-detail");

    const unitFormEl = document.getElementById("form-mdu-profil-unit");
    const unitNamaInput = document.getElementById("mdu-unit-nama");
    const unitPjInput = document.getElementById("mdu-unit-pj");
    const unitStatusSelect = document.getElementById("mdu-unit-status");
    const unitKetTextarea = document.getElementById("mdu-unit-keterangan");
    const unitFileInput = document.getElementById("mdu-unit-file");
    const unitUrlInput = document.getElementById("mdu-unit-img-url");
    const unitPreviewImg = document.getElementById("mdu-unit-preview");
    const unitFeedbackEl = document.getElementById("mdu-unit-feedback");
    const unitSubmitBtn = document.getElementById("btn-mdu-simpan-unit");

    const itemFormEl = document.getElementById("form-mdu-item");
    const itemEditIdInput = document.getElementById("mdu-item-edit-id");
    const itemHeadingEl = document.getElementById("mdu-item-heading");
    const itemEditBadgeEl = document.getElementById("mdu-item-edit-badge");
    const itemJudulInput = document.getElementById("mdu-item-judul");
    const itemKategoriInput = document.getElementById("mdu-item-kategori");
    const itemDescTextarea = document.getElementById("mdu-item-deskripsi");
    const itemFeedbackEl = document.getElementById("mdu-item-feedback");
    const itemSubmitBtn = document.getElementById("btn-mdu-simpan-item");
    const itemCancelBtn = document.getElementById("btn-mdu-batal-item");
    const itemResetBtn = document.getElementById("btn-mdu-reset-item");
    const itemListEl = document.getElementById("mdu-item-list");

    if (typeof window.syncRunningTextPosition === "function") {
        window.syncRunningTextPosition(false);
    }

    function showBoxFeedback(el, message, type = "info") {
        if (!el) return;
        const styles = {
            info: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700",
            success: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
            error: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
        };
        el.className = `text-xs px-3 py-2 border rounded-none font-medium ${styles[type] || styles.info}`;
        el.textContent = message;
        el.classList.remove("hidden");
    }

    function hideBoxFeedback(el) {
        if (el) {
            el.classList.add("hidden");
            el.textContent = "";
        }
    }

    function updateUnitPreview(src = "") {
        if (!unitPreviewImg) return;
        unitPreviewImg.src = String(src || "").trim() || DEFAULT_DETAIL_IMAGE;
    }

    function resetItemForm() {
        if (itemEditIdInput) itemEditIdInput.value = "";
        if (itemHeadingEl) itemHeadingEl.textContent = "Tambah Item Detail Unit";
        if (itemEditBadgeEl) itemEditBadgeEl.classList.add("hidden");
        if (itemCancelBtn) itemCancelBtn.classList.add("hidden");
        if (itemSubmitBtn) itemSubmitBtn.textContent = "Simpan Item Detail";
        if (itemJudulInput) itemJudulInput.value = "";
        if (itemKategoriInput) itemKategoriInput.value = "";
        if (itemDescTextarea) itemDescTextarea.value = "";
        hideBoxFeedback(itemFeedbackEl);
    }

    function fillItemFormForEdit(item) {
        if (!item) return;
        if (itemEditIdInput) itemEditIdInput.value = item.id;
        if (itemHeadingEl) itemHeadingEl.textContent = `Edit Item: ${item.judul || ""}`;
        if (itemEditBadgeEl) itemEditBadgeEl.classList.remove("hidden");
        if (itemCancelBtn) itemCancelBtn.classList.remove("hidden");
        if (itemSubmitBtn) itemSubmitBtn.textContent = "Perbarui Item Detail";
        if (itemJudulInput) itemJudulInput.value = item.judul || "";
        if (itemKategoriInput) itemKategoriInput.value = item.kategori || "";
        if (itemDescTextarea) itemDescTextarea.value = item.deskripsi || "";
        hideBoxFeedback(itemFeedbackEl);
        itemFormEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function populateUnitForm(unitObj) {
        if (!unitObj) return;
        selectedUnitId = unitObj.id;
        localStorage.setItem("selected_unit_usaha_id", selectedUnitId);

        if (lihatDetailLink) {
            lihatDetailLink.href = `#/unit-usaha-detail?id=${encodeURIComponent(selectedUnitId)}`;
        }

        if (unitNamaInput) unitNamaInput.value = unitObj.nama || "";
        if (unitPjInput) unitPjInput.value = unitObj.penanggungJawab || unitObj.penanggung_jawab || "";
        if (unitStatusSelect) unitStatusSelect.value = normalizeStatus(unitObj);
        if (unitKetTextarea) unitKetTextarea.value = unitObj.keterangan || unitObj.deskripsi || "";

        const imgVal = String(unitObj.fotoProfil || unitObj.foto_profil || unitObj.gambar || unitObj.foto || "").trim();
        currentUnitImageData = imgVal.startsWith("data:image/") ? imgVal : "";
        if (unitUrlInput) unitUrlInput.value = imgVal.startsWith("data:image/") ? "" : imgVal;
        if (unitFileInput) unitFileInput.value = "";
        updateUnitPreview(imgVal);

        if (summaryEl) {
            summaryEl.textContent = `Mengelola detail unit: ${unitObj.nama || selectedUnitId}`;
        }
    }

    function renderItemsForSelectedUnit() {
        if (!itemListEl || isDestroyed) return;

        const filteredItems = detailItems.filter((it) => String(it.unitId || "") === String(selectedUnitId || ""));
        if (!filteredItems.length) {
            itemListEl.innerHTML = `
                <div class="col-span-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-none p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Belum ada item detail untuk unit ini.
                </div>
            `;
            return;
        }

        itemListEl.innerHTML = filteredItems.map((it) => {
            const judulSafe = escapeHtml(it.judul || "Item Detail");
            const katSafe = escapeHtml(it.kategori || "Umum");
            const descSafe = escapeHtml(it.deskripsi || "-");
            const idSafe = escapeHtml(it.id);

            return `
                <article class="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-none p-3.5 flex flex-col justify-between gap-3">
                    <div class="space-y-1.5">
                        <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-none inline-block">
                            ${katSafe}
                        </span>
                        <h3 class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                            ${judulSafe}
                        </h3>
                        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            ${descSafe}
                        </p>
                    </div>

                    <div class="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            data-item-action="edit"
                            data-item-id="${idSafe}"
                            class="px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-none transition cursor-pointer"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            data-item-action="delete"
                            data-item-id="${idSafe}"
                            class="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-none transition cursor-pointer"
                        >
                            Hapus
                        </button>
                    </div>
                </article>
            `;
        }).join("");
    }

    async function loadAllData() {
        try {
            const [unitSnap, itemSnap] = await Promise.all([
                getDocs(collection(db, UNIT_USAHA_COLLECTION)),
                getDocs(collection(db, DETAIL_UNIT_COLLECTION))
            ]);
            if (isDestroyed) return;

            const unitList = [];
            unitSnap.forEach((docSnap) => {
                unitList.push({ id: docSnap.id, ...(docSnap.data() || {}) });
            });
            unitList.sort((a, b) => String(a.nama || "").localeCompare(String(b.nama || "")));
            units = unitList;

            const itemList = [];
            itemSnap.forEach((docSnap) => {
                itemList.push({ id: docSnap.id, ...(docSnap.data() || {}) });
            });
            itemList.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
            detailItems = itemList;

            if (targetUnitSelect) {
                targetUnitSelect.innerHTML = units.length
                    ? units.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.nama || u.id)}</option>`).join("")
                    : `<option value="">-- Belum ada unit usaha --</option>`;
            }

            if (units.length > 0) {
                const storedId = String(localStorage.getItem("selected_unit_usaha_id") || "").trim();
                const initialUnit = units.find((u) => u.id === storedId) || units[0];
                if (targetUnitSelect) targetUnitSelect.value = initialUnit.id;
                populateUnitForm(initialUnit);
            } else {
                if (summaryEl) summaryEl.textContent = "Belum ada data unit usaha di koleksi unit_usaha.";
            }

            renderItemsForSelectedUnit();
        } catch (err) {
            console.error("Gagal memuat manajemen detail unit:", err);
            if (!isDestroyed && itemListEl) {
                itemListEl.innerHTML = `
                    <div class="col-span-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-none p-6 text-center text-xs font-semibold text-rose-700 dark:text-rose-300">
                        Gagal memuat data dari database.
                    </div>
                `;
            }
        }
    }

    const onTargetUnitChange = () => {
        const chosenId = String(targetUnitSelect?.value || "").trim();
        const found = units.find((u) => u.id === chosenId);
        if (found) {
            hideBoxFeedback(unitFeedbackEl);
            resetItemForm();
            populateUnitForm(found);
            renderItemsForSelectedUnit();
        }
    };

    const onUnitFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImageFile(file);
            currentUnitImageData = compressed;
            if (unitUrlInput) unitUrlInput.value = "";
            updateUnitPreview(compressed);
            hideBoxFeedback(unitFeedbackEl);
        } catch (err) {
            showBoxFeedback(unitFeedbackEl, err.message || "Gagal memproses foto.", "error");
        }
    };

    const onUnitUrlChange = () => {
        const rawUrl = String(unitUrlInput?.value || "").trim();
        if (rawUrl) {
            currentUnitImageData = "";
            if (unitFileInput) unitFileInput.value = "";
            updateUnitPreview(rawUrl);
        } else if (!currentUnitImageData) {
            updateUnitPreview("");
        }
    };

    const onUnitFormSubmit = async (e) => {
        e.preventDefault();
        hideBoxFeedback(unitFeedbackEl);

        if (!selectedUnitId) {
            showBoxFeedback(unitFeedbackEl, "Pilih unit usaha terlebih dahulu.", "error");
            return;
        }

        const nama = String(unitNamaInput?.value || "").trim();
        const pj = String(unitPjInput?.value || "").trim();
        const status = unitStatusSelect?.value === "Nonaktif" ? "Nonaktif" : "Aktif";
        const keterangan = String(unitKetTextarea?.value || "").trim();
        const urlVal = String(unitUrlInput?.value || "").trim();
        const fotoFinal = currentUnitImageData || urlVal || "";

        if (!nama) {
            showBoxFeedback(unitFeedbackEl, "Nama unit usaha wajib diisi.", "error");
            return;
        }

        if (unitSubmitBtn) {
            unitSubmitBtn.disabled = true;
            unitSubmitBtn.textContent = "Menyimpan...";
        }

        const nowIso = new Date().toISOString();
        const updatePayload = {
            nama,
            penanggungJawab: pj,
            status,
            aktif: status === "Aktif",
            keterangan,
            fotoProfil: fotoFinal,
            updatedAt: nowIso
        };

        try {
            await updateDoc(doc(db, UNIT_USAHA_COLLECTION, selectedUnitId), updatePayload);
            units = units.map((u) => (u.id === selectedUnitId ? { ...u, ...updatePayload } : u));
            if (targetUnitSelect) {
                const currentSel = targetUnitSelect.value;
                targetUnitSelect.innerHTML = units.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.nama || u.id)}</option>`).join("");
                targetUnitSelect.value = currentSel;
            }
            if (summaryEl) summaryEl.textContent = `Mengelola detail unit: ${nama}`;
            showBoxFeedback(unitFeedbackEl, "Profil & keterangan unit usaha berhasil diperbarui.", "success");
        } catch (err) {
            console.error("Gagal memperbarui profil unit:", err);
            showBoxFeedback(unitFeedbackEl, "Gagal menyimpan perubahan profil unit.", "error");
        } finally {
            if (unitSubmitBtn) {
                unitSubmitBtn.disabled = false;
                unitSubmitBtn.textContent = "Simpan Profil Unit";
            }
        }
    };

    const onItemFormSubmit = async (e) => {
        e.preventDefault();
        hideBoxFeedback(itemFeedbackEl);

        if (!selectedUnitId) {
            showBoxFeedback(itemFeedbackEl, "Pilih unit usaha terlebih dahulu.", "error");
            return;
        }

        const judul = String(itemJudulInput?.value || "").trim();
        const kategori = String(itemKategoriInput?.value || "").trim() || "Umum";
        const deskripsi = String(itemDescTextarea?.value || "").trim();
        const editId = String(itemEditIdInput?.value || "").trim();

        if (!judul || !deskripsi) {
            showBoxFeedback(itemFeedbackEl, "Judul dan deskripsi item wajib diisi.", "error");
            return;
        }

        const selectedUnitObj = units.find((u) => u.id === selectedUnitId);
        const unitNama = selectedUnitObj?.nama || "";
        const nowIso = new Date().toISOString();

        const payload = {
            unitId: selectedUnitId,
            unitNama,
            judul,
            kategori,
            deskripsi,
            updatedAt: nowIso
        };

        if (itemSubmitBtn) {
            itemSubmitBtn.disabled = true;
            itemSubmitBtn.textContent = "Menyimpan...";
        }

        try {
            if (editId) {
                await updateDoc(doc(db, DETAIL_UNIT_COLLECTION, editId), payload);
                detailItems = detailItems.map((it) => (it.id === editId ? { ...it, ...payload } : it));
                resetItemForm();
                renderItemsForSelectedUnit();
                showBoxFeedback(itemFeedbackEl, "Item detail unit berhasil diperbarui.", "success");
            } else {
                payload.createdAt = nowIso;
                const docRef = await addDoc(collection(db, DETAIL_UNIT_COLLECTION), payload);
                detailItems.unshift({ id: docRef.id, ...payload });
                resetItemForm();
                renderItemsForSelectedUnit();
                showBoxFeedback(itemFeedbackEl, "Item detail unit berhasil ditambahkan.", "success");
            }
        } catch (err) {
            console.error("Gagal menyimpan item detail unit:", err);
            showBoxFeedback(itemFeedbackEl, "Gagal menyimpan item detail unit.", "error");
        } finally {
            if (itemSubmitBtn) {
                itemSubmitBtn.disabled = false;
                itemSubmitBtn.textContent = itemEditIdInput?.value ? "Perbarui Item Detail" : "Simpan Item Detail";
            }
        }
    };

    const onItemListClick = async (e) => {
        const btn = e.target.closest("button[data-item-action][data-item-id]");
        if (!btn) return;

        const action = btn.getAttribute("data-item-action");
        const id = btn.getAttribute("data-item-id");
        const found = detailItems.find((it) => String(it.id) === String(id));
        if (!found) return;

        if (action === "edit") {
            fillItemFormForEdit(found);
            return;
        }

        if (action === "delete") {
            const yakin = window.confirm(`Hapus item "${found.judul || "ini"}"?`);
            if (!yakin) return;

            try {
                await deleteDoc(doc(db, DETAIL_UNIT_COLLECTION, id));
                detailItems = detailItems.filter((it) => String(it.id) !== String(id));
                if (itemEditIdInput?.value === id) {
                    resetItemForm();
                }
                renderItemsForSelectedUnit();
                showBoxFeedback(itemFeedbackEl, "Item detail unit berhasil dihapus.", "success");
            } catch (err) {
                console.error("Gagal menghapus item detail:", err);
                showBoxFeedback(itemFeedbackEl, "Gagal menghapus item detail.", "error");
            }
        }
    };

    targetUnitSelect?.addEventListener("change", onTargetUnitChange);
    unitFileInput?.addEventListener("change", onUnitFileChange);
    unitUrlInput?.addEventListener("input", onUnitUrlChange);
    unitFormEl?.addEventListener("submit", onUnitFormSubmit);

    itemFormEl?.addEventListener("submit", onItemFormSubmit);
    itemCancelBtn?.addEventListener("click", resetItemForm);
    itemResetBtn?.addEventListener("click", resetItemForm);
    itemListEl?.addEventListener("click", onItemListClick);

    await loadAllData();

    return () => {
        isDestroyed = true;
        targetUnitSelect?.removeEventListener("change", onTargetUnitChange);
        unitFileInput?.removeEventListener("change", onUnitFileChange);
        unitUrlInput?.removeEventListener("input", onUnitUrlChange);
        unitFormEl?.removeEventListener("submit", onUnitFormSubmit);

        itemFormEl?.removeEventListener("submit", onItemFormSubmit);
        itemCancelBtn?.removeEventListener("click", resetItemForm);
        itemResetBtn?.removeEventListener("click", resetItemForm);
        itemListEl?.removeEventListener("click", onItemListClick);
    };
}