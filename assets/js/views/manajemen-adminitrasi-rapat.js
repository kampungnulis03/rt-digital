// File: assets/js/views/manajemen-adminitrasi-rapat.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_RAPAT = "rapat_rt";
const COLLECTION_KATEGORI = "kategori_rapat_rt";
const DEFAULT_KATEGORI = [
    "Rapat Rutin RT",
    "Rapat Koordinasi Pengurus",
    "Rapat Kerja Bakti & Lingkungan",
    "Rapat Keamanan / Ronda"
];
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

function getRapatKategori(item = {}) {
    return String(item.kategori || item.kategoriRapat || item.jenis || "Rapat Rutin RT").trim() || "Rapat Rutin RT";
}

export function renderManajemenAdministrasiRapat() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const katOptions = DEFAULT_KATEGORI
        .map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`)
        .join("");

    return `
        <div class="space-y-5">
            <div
                id="mar-feedback"
                role="status"
                aria-live="polite"
                class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-md transition-opacity duration-300"
            ></div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Administrasi • Rapat RT
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Kelola agenda, kategori rapat, jadwal, lokasi, dan notulensi rapat RT.
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        id="mar-toggle-form-btn"
                        class="hidden inline-flex items-center justify-center gap-2 px-4 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <span>+ Tambah Rapat</span>
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
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Rapat</div>
                    <div id="mar-sum-total" class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0 Agenda</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Rapat Terjadwal</div>
                    <div id="mar-sum-jadwal" class="text-base md:text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">0 Agenda</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Rapat Selesai</div>
                    <div id="mar-sum-selesai" class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0 Agenda</div>
                </div>
            </div>

            <div id="mar-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="mar-form" class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h2 id="mar-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            TAMBAH DATA RAPAT
                        </h2>
                        <button type="button" id="mar-cancel-btn" class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer">
                            Tutup Form
                        </button>
                    </div>

                    <input type="hidden" id="mar-edit-id" value="">

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label for="mar-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Tanggal</label>
                            <input type="date" id="mar-tanggal" value="${escapeHtml(todayIso)}" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mar-kategori" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Kategori Rapat <span class="text-rose-500">*</span></label>
                            <select id="mar-kategori" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                ${katOptions}
                            </select>
                        </div>
                        <div>
                            <label for="mar-agenda" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Agenda / Topik Rapat <span class="text-rose-500">*</span></label>
                            <input type="text" id="mar-agenda" required placeholder="Contoh: Evaluasi kegiatan & ronda warga" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mar-status" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Status</label>
                            <select id="mar-status" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                <option value="Terjadwal">Terjadwal</option>
                                <option value="Selesai">Selesai</option>
                                <option value="Dibatalkan">Dibatalkan</option>
                            </select>
                        </div>
                        <div>
                            <label for="mar-waktu" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Waktu</label>
                            <input type="text" id="mar-waktu" placeholder="Contoh: 19.30 WIB" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mar-lokasi" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Lokasi / Tempat</label>
                            <input type="text" id="mar-lokasi" placeholder="Contoh: Balai RT 05" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div class="md:col-span-2">
                            <label for="mar-notulensi" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Notulensi / Catatan</label>
                            <input type="text" id="mar-notulensi" placeholder="Ringkasan hasil rapat atau keputusan" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <button type="button" id="mar-reset-btn" class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer">
                            Bersihkan
                        </button>
                        <button type="submit" class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">
                            Simpan Rapat
                        </button>
                    </div>
                </form>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <select id="mar-filter-status" class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        <option value="">Semua Status Rapat</option>
                        <option value="Terjadwal">Terjadwal</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Dibatalkan">Dibatalkan</option>
                    </select>
                    <span id="mar-total-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Data
                    </span>
                </div>
                <div class="w-full sm:w-72">
                    <input type="text" id="mar-search" placeholder="Cari kategori, agenda, lokasi, atau isi..." class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                </div>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead id="mar-thead" class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300"></thead>
                    <tbody id="mar-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr><td colspan="4" class="p-8 text-center text-stone-500 dark:text-stone-400">Memuat data rapat...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenAdministrasiRapatHandler() {
    let rows = [];
    let isDestroyed = false;
    let feedbackTimer = null;
    const isAdmin = getCurrentUserRole() === "administrator";
    const todayIso = new Date().toISOString().slice(0, 10);

    const feedbackEl = document.getElementById("mar-feedback");
    const toggleBtn = document.getElementById("mar-toggle-form-btn");
    const formPanel = document.getElementById("mar-form-panel");
    const formEl = document.getElementById("mar-form");
    const formTitleEl = document.getElementById("mar-form-title");
    const cancelBtn = document.getElementById("mar-cancel-btn");
    const resetBtn = document.getElementById("mar-reset-btn");
    const editIdEl = document.getElementById("mar-edit-id");
    const filterStatusEl = document.getElementById("mar-filter-status");
    const searchEl = document.getElementById("mar-search");
    const totalBadgeEl = document.getElementById("mar-total-badge");
    const theadEl = document.getElementById("mar-thead");
    const tbodyEl = document.getElementById("mar-tbody");

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
        if (val === "selesai") return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
        if (val === "dibatalkan") return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
        return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }

    function fillForm(item = null) {
        editIdEl.value = item?.id || "";
        formTitleEl.textContent = item ? "EDIT DATA RAPAT" : "TAMBAH DATA RAPAT";
        document.getElementById("mar-tanggal").value = item?.tanggal || todayIso;
        document.getElementById("mar-kategori").value = getRapatKategori(item || {});
        document.getElementById("mar-agenda").value = item?.agenda || "";
        document.getElementById("mar-status").value = item?.status || "Terjadwal";
        document.getElementById("mar-waktu").value = item?.waktu || "";
        document.getElementById("mar-lokasi").value = item?.lokasi || "";
        document.getElementById("mar-notulensi").value = item?.notulensi || "";
    }

    function openForm(item = null) {
        if (!isAdmin) return;
        formPanel?.classList.remove("hidden");
        fillForm(item);
        document.getElementById("mar-agenda")?.focus();
    }

    function closeForm() {
        formPanel?.classList.add("hidden");
        editIdEl.value = "";
    }

    function render() {
        if (isDestroyed || !theadEl || !tbodyEl) return;

        const terjadwal = rows.filter((r) => String(r.status || "Terjadwal").toLowerCase() === "terjadwal").length;
        const selesai = rows.filter((r) => String(r.status || "").toLowerCase() === "selesai").length;
        document.getElementById("mar-sum-total").textContent = `${rows.length} Agenda`;
        document.getElementById("mar-sum-jadwal").textContent = `${terjadwal} Agenda`;
        document.getElementById("mar-sum-selesai").textContent = `${selesai} Agenda`;

        const statusFilter = String(filterStatusEl?.value || "").trim().toLowerCase();
        const kw = String(searchEl?.value || "").trim().toLowerCase();
        const filtered = rows.filter((r) => {
            if (statusFilter && String(r.status || "").toLowerCase() !== statusFilter) return false;
            if (kw && !Object.values(r).join(" ").toLowerCase().includes(kw)) return false;
            return true;
        });

        if (totalBadgeEl) totalBadgeEl.textContent = `${filtered.length} Data`;

        theadEl.innerHTML = `
            <tr>
                <th class="px-4 py-3">Tanggal &amp; Waktu</th>
                <th class="px-4 py-3">Kategori, Agenda, Lokasi &amp; Notulensi</th>
                <th class="px-4 py-3">Status</th>
                ${isAdmin ? `<th class="px-4 py-3 text-right">Aksi</th>` : ""}
            </tr>
        `;

        if (!filtered.length) {
            tbodyEl.innerHTML = `<tr><td colspan="${isAdmin ? 4 : 3}" class="p-8 text-center text-stone-500 dark:text-stone-400">Belum ada data rapat.</td></tr>`;
            return;
        }

        tbodyEl.innerHTML = filtered
            .map((r) => {
                const kat = getRapatKategori(r);
                const st = r.status || "Terjadwal";
                return `
                    <tr>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <div class="font-semibold">${escapeHtml(formatTanggalDisplay(r.tanggal))}</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400">${escapeHtml(r.waktu || "-")}</div>
                        </td>
                        <td class="px-4 py-3">
                            <div class="font-semibold">${escapeHtml(r.agenda || kat)}</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400">
                                Kategori: ${escapeHtml(kat)}
                                ${r.lokasi ? ` • ${escapeHtml(r.lokasi)}` : ""}
                                ${r.notulensi ? ` • ${escapeHtml(r.notulensi)}` : ""}
                            </div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${getStatusBadgeClass(st)}">${escapeHtml(st)}</span>
                        </td>
                        ${
                            isAdmin
                                ? `<td class="px-4 py-3 text-right whitespace-nowrap">
                                    <div class="inline-flex items-center gap-1.5">
                                        <button type="button" data-mar-edit="${escapeHtml(r.id)}" class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer">Edit</button>
                                        <button type="button" data-mar-del="${escapeHtml(r.id)}" class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
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
            const [rapatSnap, katSnap] = await Promise.allSettled([
                getDocs(collection(db, COLLECTION_RAPAT)),
                getDocs(collection(db, COLLECTION_KATEGORI))
            ]);
            if (isDestroyed) return;

            const list = [];
            if (rapatSnap.status === "fulfilled") {
                rapatSnap.value.forEach((d) => list.push({ id: d.id, ...d.data() }));
            }
            rows = list.sort((a, b) => String(b.tanggal || b.createdAt || "").localeCompare(String(a.tanggal || a.createdAt || "")));

            const katSelect = document.getElementById("mar-kategori");
            const names = [...DEFAULT_KATEGORI];
            if (katSnap.status === "fulfilled") {
                katSnap.value.forEach((d) => {
                    const nm = String(d.data()?.nama || d.data()?.kategori || "").trim();
                    if (nm && !names.some((x) => x.toLowerCase() === nm.toLowerCase())) names.push(nm);
                });
            }
            if (katSelect) {
                const cur = katSelect.value;
                katSelect.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
                if (names.includes(cur)) katSelect.value = cur;
            }

            render();
        } catch (err) {
            console.error("Gagal memuat rapat:", err);
            showFeedback("Gagal memuat data rapat.", "error");
        }
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!isAdmin) return;
        const kategori = document.getElementById("mar-kategori")?.value.trim() || "Rapat Rutin RT";
        const agenda = document.getElementById("mar-agenda")?.value.trim() || "";
        if (!agenda) {
            showFeedback("Agenda rapat wajib diisi.", "error");
            return;
        }
        const payload = {
            tanggal: document.getElementById("mar-tanggal")?.value || todayIso,
            kategori,
            agenda,
            status: document.getElementById("mar-status")?.value || "Terjadwal",
            waktu: document.getElementById("mar-waktu")?.value.trim() || "",
            lokasi: document.getElementById("mar-lokasi")?.value.trim() || "",
            notulensi: document.getElementById("mar-notulensi")?.value.trim() || "",
            updatedAt: new Date().toISOString()
        };

        try {
            const editId = editIdEl.value.trim();
            if (editId) {
                await updateDoc(doc(db, COLLECTION_RAPAT, editId), payload);
                showFeedback("Data rapat berhasil diperbarui.");
            } else {
                await addDoc(collection(db, COLLECTION_RAPAT), { ...payload, createdAt: new Date().toISOString() });
                showFeedback("Data rapat berhasil ditambahkan.");
            }
            closeForm();
            await loadData();
        } catch (err) {
            console.error("Gagal simpan rapat:", err);
            showFeedback("Gagal menyimpan data rapat.", "error");
        }
    }

    const onClick = async (e) => {
        const editBtn = e.target.closest("[data-mar-edit]");
        if (editBtn && isAdmin) {
            const found = rows.find((r) => r.id === editBtn.getAttribute("data-mar-edit"));
            if (found) openForm(found);
            return;
        }
        const delBtn = e.target.closest("[data-mar-del]");
        if (delBtn && isAdmin) {
            const id = delBtn.getAttribute("data-mar-del");
            if (!id || !window.confirm("Hapus data rapat ini?")) return;
            try {
                await deleteDoc(doc(db, COLLECTION_RAPAT, id));
                if (editIdEl.value === id) closeForm();
                showFeedback("Data rapat berhasil dihapus.");
                await loadData();
            } catch (err) {
                console.error("Gagal hapus rapat:", err);
                showFeedback("Gagal menghapus data rapat.", "error");
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