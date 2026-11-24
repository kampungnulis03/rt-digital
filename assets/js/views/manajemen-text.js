// File: assets/js/views/manajemen-text.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const TEXT_COLLECTION = "running_text";
const FEEDBACK_AUTO_HIDE_MS = 3500;

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getCurrentUserRole() {
    return String(localStorage.getItem("user_role") || "").trim().toLowerCase();
}

export function renderManajemenText() {
    return `
        <div class="space-y-5">
            <!-- Header Halaman -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Manajemen Text
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Kelola pengumuman &amp; running text, urutan tampil, serta status publikasi.
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        id="mtx-toggle-form-btn"
                        class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <span>+ Tambah Text</span>
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

            <!-- Pratinjau Running Text Aktif -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-hidden">
                <div class="px-4 py-2 bg-[#5c6d4e] text-white flex items-center justify-between gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wider">PRATINJAU RUNNING TEXT AKTIF</span>
                    <span id="mtx-active-count" class="text-[10px] font-semibold text-stone-100">0 Teks Aktif</span>
                </div>
                <div class="px-4 py-2.5 bg-[#f6f3ec] dark:bg-stone-950/60 overflow-hidden">
                    <marquee
                        id="mtx-live-marquee"
                        behavior="scroll"
                        direction="left"
                        scrollamount="4"
                        class="text-xs font-semibold text-stone-900 dark:text-stone-100 block"
                    >
                        Belum ada running text aktif.
                    </marquee>
                </div>
            </div>

            <!-- Toast Notifikasi Pojok Kanan Atas -->
            <div id="mtx-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200"></div>

            <!-- Form Tambah / Edit Running Text -->
            <div id="mtx-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="mtx-text-form" class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h2 id="mtx-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            TAMBAH RUNNING TEXT
                        </h2>
                        <button
                            type="button"
                            id="mtx-cancel-form-btn"
                            class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                        >
                            Tutup Form
                        </button>
                    </div>

                    <input type="hidden" id="mtx-edit-id" value="">

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="md:col-span-2">
                            <label for="mtx-judul" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Label / Judul Pengumuman
                            </label>
                            <input
                                type="text"
                                id="mtx-judul"
                                placeholder="Contoh: Informasi Operasional & Layanan"
                                class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                        </div>

                        <div>
                            <label for="mtx-urutan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Urutan Tampil
                            </label>
                            <input
                                type="number"
                                id="mtx-urutan"
                                min="1"
                                value="1"
                                class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                        </div>

                        <div>
                            <label for="mtx-status" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Status
                            </label>
                            <select
                                id="mtx-status"
                                class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                                <option value="Aktif">Aktif</option>
                                <option value="Nonaktif">Nonaktif</option>
                            </select>
                        </div>

                        <div class="md:col-span-4">
                            <label for="mtx-teks" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Isi Running Text / Pengumuman <span class="text-rose-500">*</span>
                            </label>
                            <textarea
                                id="mtx-teks"
                                rows="3"
                                required
                                placeholder="Masukkan teks pengumuman yang akan berjalan di halaman utama..."
                                class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            ></textarea>
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            id="mtx-reset-form-btn"
                            class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                        >
                            Bersihkan
                        </button>
                        <button
                            type="submit"
                            id="mtx-submit-btn"
                            class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                        >
                            Simpan Text
                        </button>
                    </div>
                </form>
            </div>

            <!-- Filter & Pencarian -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <select
                        id="mtx-filter-status"
                        class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                        <option value="">Semua Status</option>
                        <option value="Aktif">Aktif</option>
                        <option value="Nonaktif">Nonaktif</option>
                    </select>
                    <span id="mtx-total-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Text
                    </span>
                </div>

                <div class="w-full sm:w-72">
                    <input
                        type="text"
                        id="mtx-search-input"
                        placeholder="Cari judul atau isi running text..."
                        class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                </div>
            </div>

            <!-- Tabel / Daftar Running Text -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                            <th class="px-4 py-3 w-16 text-center">No</th>
                            <th class="px-4 py-3 w-20 text-center">Urutan</th>
                            <th class="px-4 py-3">Judul &amp; Isi Running Text</th>
                            <th class="px-4 py-3 w-28 text-center">Status</th>
                            <th class="px-4 py-3 w-44 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="mtx-table-body" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr>
                            <td colspan="5" class="px-4 py-8 text-center text-stone-500 dark:text-stone-400">
                                Memuat data running text...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenTextHandler() {
    let textList = [];
    let isDestroyed = false;
    let feedbackTimerId = null;

    const isAdmin = getCurrentUserRole() === "administrator";

    const feedbackEl = document.getElementById("mtx-feedback");
    const toggleFormBtn = document.getElementById("mtx-toggle-form-btn");
    const formPanel = document.getElementById("mtx-form-panel");
    const cancelFormBtn = document.getElementById("mtx-cancel-form-btn");
    const resetFormBtn = document.getElementById("mtx-reset-form-btn");
    const textForm = document.getElementById("mtx-text-form");
    const formTitleEl = document.getElementById("mtx-form-title");

    const editIdInput = document.getElementById("mtx-edit-id");
    const judulInput = document.getElementById("mtx-judul");
    const urutanInput = document.getElementById("mtx-urutan");
    const statusInput = document.getElementById("mtx-status");
    const teksInput = document.getElementById("mtx-teks");

    const filterStatusSelect = document.getElementById("mtx-filter-status");
    const searchInput = document.getElementById("mtx-search-input");
    const totalBadgeEl = document.getElementById("mtx-total-badge");
    const activeCountEl = document.getElementById("mtx-active-count");
    const liveMarqueeEl = document.getElementById("mtx-live-marquee");
    const tableBodyEl = document.getElementById("mtx-table-body");

    if (!isAdmin && toggleFormBtn) {
        toggleFormBtn.classList.add("hidden");
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

    function hideFeedback() {
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        feedbackEl?.classList.add("hidden");
    }

    function getNextOrderNumber() {
        if (!textList.length) return 1;
        const maxOrder = Math.max(...textList.map((t) => Number(t.urutan) || 0));
        return maxOrder + 1;
    }

    function resetTextForm() {
        editIdInput.value = "";
        judulInput.value = "";
        urutanInput.value = String(getNextOrderNumber());
        statusInput.value = "Aktif";
        teksInput.value = "";
        formTitleEl.textContent = "TAMBAH RUNNING TEXT";
    }

    function openFormPanel(item = null) {
        if (!isAdmin) return;
        hideFeedback();
        formPanel?.classList.remove("hidden");

        if (item) {
            editIdInput.value = item.id || "";
            judulInput.value = item.judul || "";
            urutanInput.value = String(Number(item.urutan) || 1);
            statusInput.value = item.status || "Aktif";
            teksInput.value = item.teks || item.isi || item.text || "";
            formTitleEl.textContent = "EDIT RUNNING TEXT";
        } else {
            resetTextForm();
        }

        teksInput?.focus();
    }

    function closeFormPanel() {
        formPanel?.classList.add("hidden");
        resetTextForm();
    }

    function syncLivePreview() {
        if (!liveMarqueeEl || !activeCountEl || isDestroyed) return;
        const aktifItems = textList.filter(
            (item) => String(item.status || "Aktif").trim().toLowerCase() === "aktif"
        );
        activeCountEl.textContent = `${aktifItems.length} Teks Aktif`;

        if (!aktifItems.length) {
            liveMarqueeEl.textContent = "Belum ada running text aktif.";
            return;
        }

        liveMarqueeEl.textContent = aktifItems
            .map((item) => item.teks || item.isi || item.text || "")
            .filter(Boolean)
            .join("   •   ");

        if (typeof window.syncRunningTextPosition === "function") {
            window.syncRunningTextPosition();
        }
    }

    function getFilteredText() {
        const selectedStatus = String(filterStatusSelect?.value || "").trim().toLowerCase();
        const keyword = String(searchInput?.value || "").trim().toLowerCase();

        return textList.filter((item) => {
            const itemStatus = String(item.status || "Aktif").trim().toLowerCase();
            if (!isAdmin && itemStatus !== "aktif") {
                return false;
            }
            if (selectedStatus && itemStatus !== selectedStatus) {
                return false;
            }
            if (keyword) {
                const haystack = `${item.judul || ""} ${item.teks || ""} ${item.isi || ""} ${item.text || ""}`.toLowerCase();
                if (!haystack.includes(keyword)) return false;
            }
            return true;
        });
    }

    function renderTextTable() {
        if (!tableBodyEl || isDestroyed) return;

        syncLivePreview();

        const filtered = getFilteredText();
        if (totalBadgeEl) {
            totalBadgeEl.textContent = `${filtered.length} Text`;
        }

        if (!filtered.length) {
            tableBodyEl.innerHTML = `
                <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-stone-500 dark:text-stone-400">
                        Tidak ada data running text yang ditampilkan.
                    </td>
                </tr>
            `;
            return;
        }

        tableBodyEl.innerHTML = filtered
            .map((item, idx) => {
                const judulVal = String(item.judul || "").trim();
                const teksVal = String(item.teks || item.isi || item.text || "").trim();
                const orderNum = Number(item.urutan) || 1;
                const statusVal = String(item.status || "Aktif");
                const isAktif = statusVal.toLowerCase() === "aktif";

                const statusBadge = isAktif
                    ? `<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">Aktif</span>`
                    : `<span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none bg-[#f6f3ec] dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-300 dark:border-stone-700">Nonaktif</span>`;

                const actionCell = isAdmin
                    ? `
                        <div class="inline-flex items-center justify-end gap-1.5">
                            <button
                                type="button"
                                data-text-toggle="${escapeHtml(item.id)}"
                                class="px-2 py-1 text-[11px] font-semibold border border-stone-300 dark:border-stone-700 text-[#4a5a3f] dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] rounded-none transition cursor-pointer"
                            >
                                ${isAktif ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button
                                type="button"
                                data-text-edit="${escapeHtml(item.id)}"
                                class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] rounded-none transition cursor-pointer"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                data-text-delete="${escapeHtml(item.id)}"
                                class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none transition cursor-pointer"
                            >
                                Hapus
                            </button>
                        </div>
                    `
                    : `<span class="text-[11px] text-stone-400">-</span>`;

                return `
                    <tr class="hover:bg-[#f6f3ec]/70 dark:hover:bg-stone-800/40 transition">
                        <td class="px-4 py-3 text-center text-stone-500 dark:text-stone-400 font-semibold">${idx + 1}</td>
                        <td class="px-4 py-3 text-center font-bold text-[#5c6d4e] dark:text-emerald-400">#${orderNum}</td>
                        <td class="px-4 py-3">
                            ${judulVal ? `<div class="font-bold text-stone-900 dark:text-stone-100 mb-0.5">${escapeHtml(judulVal)}</div>` : ""}
                            <div class="text-stone-600 dark:text-stone-300 leading-relaxed">${escapeHtml(teksVal || "-")}</div>
                        </td>
                        <td class="px-4 py-3 text-center">${statusBadge}</td>
                        <td class="px-4 py-3 text-right">${actionCell}</td>
                    </tr>
                `;
            })
            .join("");
    }

    async function loadText() {
        try {
            const snap = await getDocs(collection(db, TEXT_COLLECTION));
            const items = [];
            snap.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            items.sort((a, b) => {
                const orderA = Number(a.urutan) || 999;
                const orderB = Number(b.urutan) || 999;
                if (orderA !== orderB) return orderA - orderB;
                return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
            });
            textList = items;
            renderTextTable();
        } catch (err) {
            console.error("Gagal memuat running text:", err);
            showFeedback("Gagal memuat data running text dari database.", "error");
        }
    }

    async function handleSubmitText(e) {
        e.preventDefault();
        if (!isAdmin) return;
        hideFeedback();

        const teks = teksInput.value.trim();
        if (!teks) {
            showFeedback("Isi running text wajib diisi.", "error");
            return;
        }

        const editId = editIdInput.value.trim();
        const payload = {
            judul: judulInput.value.trim(),
            urutan: Math.max(1, Number(urutanInput.value) || 1),
            status: statusInput.value || "Aktif",
            teks,
            updatedAt: new Date().toISOString()
        };

        try {
            if (editId) {
                await updateDoc(doc(db, TEXT_COLLECTION, editId), payload);
                showFeedback("Running text berhasil diperbarui.");
            } else {
                await addDoc(collection(db, TEXT_COLLECTION), {
                    ...payload,
                    createdAt: new Date().toISOString()
                });
                showFeedback("Running text berhasil ditambahkan.");
            }
            closeFormPanel();
            await loadText();
        } catch (err) {
            console.error("Gagal menyimpan running text:", err);
            showFeedback("Gagal menyimpan running text ke database.", "error");
        }
    }

    const onClickDelegate = async (e) => {
        if (!isAdmin) return;

        const toggleBtn = e.target.closest("[data-text-toggle]");
        if (toggleBtn) {
            const id = toggleBtn.getAttribute("data-text-toggle");
            const found = textList.find((t) => t.id === id);
            if (!found) return;
            const nextStatus = String(found.status || "Aktif").toLowerCase() === "aktif" ? "Nonaktif" : "Aktif";
            try {
                await updateDoc(doc(db, TEXT_COLLECTION, id), {
                    status: nextStatus,
                    updatedAt: new Date().toISOString()
                });
                showFeedback(`Status running text diubah menjadi ${nextStatus}.`);
                await loadText();
            } catch (err) {
                console.error("Gagal mengubah status running text:", err);
                showFeedback("Gagal mengubah status running text.", "error");
            }
            return;
        }

        const editBtn = e.target.closest("[data-text-edit]");
        if (editBtn) {
            const id = editBtn.getAttribute("data-text-edit");
            const found = textList.find((t) => t.id === id);
            if (found) openFormPanel(found);
            return;
        }

        const deleteBtn = e.target.closest("[data-text-delete]");
        if (deleteBtn) {
            const id = deleteBtn.getAttribute("data-text-delete");
            if (!id) return;
            if (!window.confirm("Hapus running text ini?")) return;

            try {
                await deleteDoc(doc(db, TEXT_COLLECTION, id));
                if (editIdInput.value === id) {
                    closeFormPanel();
                }
                showFeedback("Running text berhasil dihapus.");
                await loadText();
            } catch (err) {
                console.error("Gagal menghapus running text:", err);
                showFeedback("Gagal menghapus running text.", "error");
            }
        }
    };

    urutanInput.value = "1";

    toggleFormBtn?.addEventListener("click", () => {
        if (formPanel?.classList.contains("hidden")) {
            openFormPanel(null);
        } else {
            closeFormPanel();
        }
    });
    cancelFormBtn?.addEventListener("click", closeFormPanel);
    resetFormBtn?.addEventListener("click", resetTextForm);
    textForm?.addEventListener("submit", handleSubmitText);
    filterStatusSelect?.addEventListener("change", renderTextTable);
    searchInput?.addEventListener("input", renderTextTable);
    document.addEventListener("click", onClickDelegate);

    loadText();

    return () => {
        isDestroyed = true;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        cancelFormBtn?.removeEventListener("click", closeFormPanel);
        resetFormBtn?.removeEventListener("click", resetTextForm);
        textForm?.removeEventListener("submit", handleSubmitText);
        filterStatusSelect?.removeEventListener("change", renderTextTable);
        searchInput?.removeEventListener("input", renderTextTable);
        document.removeEventListener("click", onClickDelegate);
    };
}

export default renderManajemenText;