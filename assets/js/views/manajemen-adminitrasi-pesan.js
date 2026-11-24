// File: assets/js/views/manajemen-adminitrasi-pesan.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_PESAN = "pesan_rt";
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

export function renderManajemenAdministrasiPesan() {
    const todayIso = new Date().toISOString().slice(0, 10);

    return `
        <div class="space-y-5">
            <div
                id="map-feedback"
                role="status"
                aria-live="polite"
                class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-md transition-opacity duration-300"
            ></div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Administrasi • Pesan RT
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Kelola pesan masuk, surat pengantar, dan informasi warga RT.
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        id="map-toggle-form-btn"
                        class="hidden inline-flex items-center justify-center gap-2 px-4 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <span>+ Tambah Pesan</span>
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
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Pesan</div>
                    <div id="map-sum-total" class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0 Pesan</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Belum Dibaca</div>
                    <div id="map-sum-belum" class="text-base md:text-lg font-bold text-amber-700 dark:text-amber-400 mt-1">0 Pesan</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Sudah Dibaca / Selesai</div>
                    <div id="map-sum-selesai" class="text-base md:text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">0 Pesan</div>
                </div>
            </div>

            <div id="map-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="map-form" class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h2 id="map-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            TAMBAH DATA PESAN
                        </h2>
                        <button type="button" id="map-cancel-btn" class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer">
                            Tutup Form
                        </button>
                    </div>

                    <input type="hidden" id="map-edit-id" value="">

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label for="map-pengirim" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Pengirim / Warga <span class="text-rose-500">*</span></label>
                            <input type="text" id="map-pengirim" required placeholder="Nama warga atau instansi" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="map-subjek" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Subjek / Keperluan <span class="text-rose-500">*</span></label>
                            <input type="text" id="map-subjek" required placeholder="Contoh: Pengantar domisili / Aspirasi" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="map-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Tanggal</label>
                            <input type="date" id="map-tanggal" value="${escapeHtml(todayIso)}" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="map-status" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Status</label>
                            <select id="map-status" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                <option value="Belum Dibaca">Belum Dibaca</option>
                                <option value="Dibaca">Dibaca</option>
                                <option value="Selesai">Selesai</option>
                            </select>
                        </div>
                        <div class="md:col-span-4">
                            <label for="map-isi" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Isi Pesan / Catatan</label>
                            <input type="text" id="map-isi" placeholder="Detail pesan atau tindak lanjut administrasi" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <button type="button" id="map-reset-btn" class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer">
                            Bersihkan
                        </button>
                        <button type="submit" class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">
                            Simpan Pesan
                        </button>
                    </div>
                </form>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <select id="map-filter-status" class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        <option value="">Semua Status Pesan</option>
                        <option value="Belum Dibaca">Belum Dibaca</option>
                        <option value="Dibaca">Dibaca</option>
                        <option value="Selesai">Selesai</option>
                    </select>
                    <span id="map-total-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Data
                    </span>
                </div>
                <div class="w-full sm:w-72">
                    <input type="text" id="map-search" placeholder="Cari pengirim, subjek, atau isi pesan..." class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                </div>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead id="map-thead" class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300"></thead>
                    <tbody id="map-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr><td colspan="4" class="p-8 text-center text-stone-500 dark:text-stone-400">Memuat data pesan...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenAdministrasiPesanHandler() {
    let rows = [];
    let isDestroyed = false;
    let feedbackTimer = null;
    const isAdmin = getCurrentUserRole() === "administrator";
    const todayIso = new Date().toISOString().slice(0, 10);

    const feedbackEl = document.getElementById("map-feedback");
    const toggleBtn = document.getElementById("map-toggle-form-btn");
    const formPanel = document.getElementById("map-form-panel");
    const formEl = document.getElementById("map-form");
    const formTitleEl = document.getElementById("map-form-title");
    const cancelBtn = document.getElementById("map-cancel-btn");
    const resetBtn = document.getElementById("map-reset-btn");
    const editIdEl = document.getElementById("map-edit-id");
    const filterStatusEl = document.getElementById("map-filter-status");
    const searchEl = document.getElementById("map-search");
    const totalBadgeEl = document.getElementById("map-total-badge");
    const theadEl = document.getElementById("map-thead");
    const tbodyEl = document.getElementById("map-tbody");

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
        if (val === "selesai" || val === "dibaca") return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
        return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }

    function fillForm(item = null) {
        editIdEl.value = item?.id || "";
        formTitleEl.textContent = item ? "EDIT DATA PESAN" : "TAMBAH DATA PESAN";
        document.getElementById("map-pengirim").value = item?.pengirim || "";
        document.getElementById("map-subjek").value = item?.subjek || "";
        document.getElementById("map-tanggal").value = item?.tanggal || todayIso;
        document.getElementById("map-status").value = item?.status || "Belum Dibaca";
        document.getElementById("map-isi").value = item?.isi || "";
    }

    function openForm(item = null) {
        if (!isAdmin) return;
        formPanel?.classList.remove("hidden");
        fillForm(item);
        document.getElementById("map-pengirim")?.focus();
    }

    function closeForm() {
        formPanel?.classList.add("hidden");
        editIdEl.value = "";
    }

    function render() {
        if (isDestroyed || !theadEl || !tbodyEl) return;

        const belum = rows.filter((p) => String(p.status || "Belum Dibaca").toLowerCase() === "belum dibaca").length;
        const selesai = rows.filter((p) => String(p.status || "").toLowerCase() !== "belum dibaca").length;
        document.getElementById("map-sum-total").textContent = `${rows.length} Pesan`;
        document.getElementById("map-sum-belum").textContent = `${belum} Pesan`;
        document.getElementById("map-sum-selesai").textContent = `${selesai} Pesan`;

        const stFilter = String(filterStatusEl?.value || "").trim().toLowerCase();
        const kw = String(searchEl?.value || "").trim().toLowerCase();
        const filtered = rows.filter((r) => {
            if (stFilter && String(r.status || "").toLowerCase() !== stFilter) return false;
            if (kw && !Object.values(r).join(" ").toLowerCase().includes(kw)) return false;
            return true;
        });

        if (totalBadgeEl) totalBadgeEl.textContent = `${filtered.length} Data`;

        theadEl.innerHTML = `
            <tr>
                <th class="px-4 py-3">Tanggal</th>
                <th class="px-4 py-3">Pengirim, Subjek &amp; Isi</th>
                <th class="px-4 py-3">Status</th>
                ${isAdmin ? `<th class="px-4 py-3 text-right">Aksi</th>` : ""}
            </tr>
        `;

        if (!filtered.length) {
            tbodyEl.innerHTML = `<tr><td colspan="${isAdmin ? 4 : 3}" class="p-8 text-center text-stone-500 dark:text-stone-400">Belum ada data pesan.</td></tr>`;
            return;
        }

        tbodyEl.innerHTML = filtered
            .map((r) => {
                const st = r.status || "Belum Dibaca";
                return `
                    <tr>
                        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(formatTanggalDisplay(r.tanggal))}</td>
                        <td class="px-4 py-3">
                            <div class="font-semibold">${escapeHtml(r.subjek || "-")}</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400">${escapeHtml(r.pengirim || "-")}${r.isi ? ` • ${escapeHtml(r.isi)}` : ""}</div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${getStatusBadgeClass(st)}">${escapeHtml(st)}</span>
                        </td>
                        ${
                            isAdmin
                                ? `<td class="px-4 py-3 text-right whitespace-nowrap">
                                    <div class="inline-flex items-center gap-1.5">
                                        <button type="button" data-map-edit="${escapeHtml(r.id)}" class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer">Edit</button>
                                        <button type="button" data-map-del="${escapeHtml(r.id)}" class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
                                    </div>
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
            const snap = await getDocs(collection(db, COLLECTION_PESAN));
            if (isDestroyed) return;
            const list = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
            rows = list.sort((a, b) => String(b.tanggal || b.createdAt || "").localeCompare(String(a.tanggal || a.createdAt || "")));
            render();
        } catch (err) {
            console.error("Gagal memuat pesan:", err);
            showFeedback("Gagal memuat data pesan.", "error");
        }
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!isAdmin) return;
        const pengirim = document.getElementById("map-pengirim")?.value.trim() || "";
        const subjek = document.getElementById("map-subjek")?.value.trim() || "";
        if (!pengirim || !subjek) {
            showFeedback("Pengirim dan subjek pesan wajib diisi.", "error");
            return;
        }

        const payload = {
            pengirim,
            subjek,
            tanggal: document.getElementById("map-tanggal")?.value || todayIso,
            status: document.getElementById("map-status")?.value || "Belum Dibaca",
            isi: document.getElementById("map-isi")?.value.trim() || "",
            updatedAt: new Date().toISOString()
        };

        try {
            const editId = editIdEl.value.trim();
            if (editId) {
                await updateDoc(doc(db, COLLECTION_PESAN, editId), payload);
                showFeedback("Data pesan berhasil diperbarui.");
            } else {
                await addDoc(collection(db, COLLECTION_PESAN), { ...payload, createdAt: new Date().toISOString() });
                showFeedback("Data pesan berhasil ditambahkan.");
            }
            closeForm();
            await loadData();
        } catch (err) {
            console.error("Gagal simpan pesan:", err);
            showFeedback("Gagal menyimpan data pesan.", "error");
        }
    }

    const onClick = async (e) => {
        const editBtn = e.target.closest("[data-map-edit]");
        if (editBtn && isAdmin) {
            const found = rows.find((r) => r.id === editBtn.getAttribute("data-map-edit"));
            if (found) openForm(found);
            return;
        }
        const delBtn = e.target.closest("[data-map-del]");
        if (delBtn && isAdmin) {
            const id = delBtn.getAttribute("data-map-del");
            if (!id || !window.confirm("Hapus data pesan ini?")) return;
            try {
                await deleteDoc(doc(db, COLLECTION_PESAN, id));
                if (editIdEl.value === id) closeForm();
                showFeedback("Data pesan berhasil dihapus.");
                await loadData();
            } catch (err) {
                console.error("Gagal hapus pesan:", err);
                showFeedback("Gagal menghapus data pesan.", "error");
            }
        }
    };

    if (isAdmin) toggleBtn?.classList.remove("hidden");
    toggleBtn?.addEventListener("click", () => (formPanel?.classList.contains("hidden") ? openForm(null) : closeForm()));
    cancelBtn?.addEventListener("click", closeForm);
    resetBtn?.addEventListener("click", () => fillForm(null));
    formEl?.addEventListener("submit", onSubmit);
    filterStatusEl?.addEventListener("change", render);
    searchEl?.addEventListener("input", render);
    document.addEventListener("click", onClick);

    loadData();

    return () => {
        isDestroyed = true;
        clearFeedbackTimer();
        formEl?.removeEventListener("submit", onSubmit);
        filterStatusEl?.removeEventListener("change", render);
        searchEl?.removeEventListener("input", render);
        document.removeEventListener("click", onClick);
    };
}