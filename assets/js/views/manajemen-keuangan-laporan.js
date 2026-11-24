// File: assets/js/views/manajemen-keuangan-laporan.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_LAPORAN = "keuangan_rt";

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatRupiah(num = 0) {
    const val = Number(num) || 0;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val);
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

export function renderManajemenKeuanganLaporan() {
    const todayIso = new Date().toISOString().slice(0, 10);

    return `
        <div class="space-y-5">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Keuangan • Laporan Keuangan
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Kelola kas masuk, kas keluar &amp; rekap saldo laporan keuangan RT.
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        id="mkl-toggle-form-btn"
                        class="hidden inline-flex items-center justify-center gap-2 px-4 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <span>+ Tambah Transaksi</span>
                    </button>
                    <a
                        href="#/manajemen-keuangan"
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
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Pemasukan</div>
                    <div id="mkl-sum-masuk" class="text-base md:text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">Rp 0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Pengeluaran</div>
                    <div id="mkl-sum-keluar" class="text-base md:text-lg font-bold text-rose-700 dark:text-rose-400 mt-1">Rp 0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Saldo Kas Saat Ini</div>
                    <div id="mkl-sum-saldo" class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">Rp 0</div>
                </div>
            </div>

            <div id="mkl-feedback" class="hidden px-4 py-3 text-xs font-semibold border rounded-none"></div>

            <div id="mkl-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="mkl-form" class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h2 id="mkl-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            TAMBAH DATA LAPORAN KEUANGAN
                        </h2>
                        <button type="button" id="mkl-cancel-btn" class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer">
                            Tutup Form
                        </button>
                    </div>

                    <input type="hidden" id="mkl-edit-id" value="">

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label for="mkl-jenis" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Jenis Transaksi</label>
                            <select id="mkl-jenis" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                <option value="Pemasukan">Pemasukan</option>
                                <option value="Pengeluaran">Pengeluaran</option>
                            </select>
                        </div>
                        <div>
                            <label for="mkl-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Tanggal</label>
                            <input type="date" id="mkl-tanggal" value="${escapeHtml(todayIso)}" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mkl-kategori" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Kategori</label>
                            <input type="text" id="mkl-kategori" placeholder="Contoh: Iuran Warga, Kebersihan, Ronda" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div>
                            <label for="mkl-nominal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Nominal (Rp) <span class="text-rose-500">*</span></label>
                            <input type="number" id="mkl-nominal" min="1" step="any" required placeholder="0" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                        <div class="md:col-span-4">
                            <label for="mkl-uraian" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Uraian / Keterangan <span class="text-rose-500">*</span></label>
                            <input type="text" id="mkl-uraian" required placeholder="Contoh: Kas RT bulan November 2026" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <button type="button" id="mkl-reset-btn" class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer">
                            Bersihkan
                        </button>
                        <button type="submit" class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">
                            Simpan Transaksi
                        </button>
                    </div>
                </form>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <select id="mkl-filter-jenis" class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        <option value="">Semua Jenis Transaksi</option>
                        <option value="Pemasukan">Pemasukan</option>
                        <option value="Pengeluaran">Pengeluaran</option>
                    </select>
                    <span id="mkl-total-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Data
                    </span>
                </div>
                <div class="w-full sm:w-72">
                    <input type="text" id="mkl-search" placeholder="Cari kategori, uraian, atau nominal..." class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                </div>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead id="mkl-thead" class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300"></thead>
                    <tbody id="mkl-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr><td colspan="5" class="p-8 text-center text-stone-500 dark:text-stone-400">Memuat laporan keuangan...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenKeuanganLaporanHandler() {
    let rows = [];
    let isDestroyed = false;
    const isAdmin = getCurrentUserRole() === "administrator";
    const todayIso = new Date().toISOString().slice(0, 10);

    const toggleBtn = document.getElementById("mkl-toggle-form-btn");
    const feedbackEl = document.getElementById("mkl-feedback");
    const formPanel = document.getElementById("mkl-form-panel");
    const formEl = document.getElementById("mkl-form");
    const formTitleEl = document.getElementById("mkl-form-title");
    const cancelBtn = document.getElementById("mkl-cancel-btn");
    const resetBtn = document.getElementById("mkl-reset-btn");
    const editIdEl = document.getElementById("mkl-edit-id");
    const filterJenisEl = document.getElementById("mkl-filter-jenis");
    const searchEl = document.getElementById("mkl-search");
    const totalBadgeEl = document.getElementById("mkl-total-badge");
    const theadEl = document.getElementById("mkl-thead");
    const tbodyEl = document.getElementById("mkl-tbody");

    function showFeedback(msg, type = "success") {
        if (!feedbackEl || isDestroyed) return;
        feedbackEl.className =
            type === "error"
                ? "px-4 py-3 text-xs font-semibold border rounded-none bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "px-4 py-3 text-xs font-semibold border rounded-none bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
        feedbackEl.textContent = msg;
        feedbackEl.classList.remove("hidden");
    }

    function hideFeedback() {
        feedbackEl?.classList.add("hidden");
    }

    function fillForm(item = null) {
        editIdEl.value = item?.id || "";
        formTitleEl.textContent = item ? "EDIT DATA LAPORAN KEUANGAN" : "TAMBAH DATA LAPORAN KEUANGAN";
        document.getElementById("mkl-jenis").value = item?.jenis || "Pemasukan";
        document.getElementById("mkl-tanggal").value = item?.tanggal || todayIso;
        document.getElementById("mkl-kategori").value = item?.kategori || "";
        document.getElementById("mkl-nominal").value = item?.nominal != null ? String(item.nominal) : "";
        document.getElementById("mkl-uraian").value = item?.uraian || "";
    }

    function openForm(item = null) {
        if (!isAdmin) return;
        hideFeedback();
        formPanel?.classList.remove("hidden");
        fillForm(item);
        document.getElementById("mkl-uraian")?.focus();
    }

    function closeForm() {
        formPanel?.classList.add("hidden");
        editIdEl.value = "";
    }

    function render() {
        if (isDestroyed || !theadEl || !tbodyEl) return;

        let masuk = 0;
        let keluar = 0;
        rows.forEach((r) => {
            const nom = Number(r.nominal) || 0;
            if (String(r.jenis).toLowerCase() === "pengeluaran") keluar += nom;
            else masuk += nom;
        });

        document.getElementById("mkl-sum-masuk").textContent = formatRupiah(masuk);
        document.getElementById("mkl-sum-keluar").textContent = formatRupiah(keluar);
        document.getElementById("mkl-sum-saldo").textContent = formatRupiah(masuk - keluar);

        const jFilter = String(filterJenisEl?.value || "").trim().toLowerCase();
        const kw = String(searchEl?.value || "").trim().toLowerCase();
        const filtered = rows.filter((r) => {
            if (jFilter && String(r.jenis || "Pemasukan").toLowerCase() !== jFilter) return false;
            if (kw && !Object.values(r).join(" ").toLowerCase().includes(kw)) return false;
            return true;
        });

        if (totalBadgeEl) totalBadgeEl.textContent = `${filtered.length} Data`;

        theadEl.innerHTML = `
            <tr>
                <th class="px-4 py-3">Tanggal</th>
                <th class="px-4 py-3">Jenis</th>
                <th class="px-4 py-3">Kategori &amp; Uraian</th>
                <th class="px-4 py-3 text-right">Nominal</th>
                ${isAdmin ? `<th class="px-4 py-3 text-right">Aksi</th>` : ""}
            </tr>
        `;

        if (!filtered.length) {
            tbodyEl.innerHTML = `<tr><td colspan="${isAdmin ? 5 : 4}" class="p-8 text-center text-stone-500 dark:text-stone-400">Belum ada data laporan keuangan.</td></tr>`;
            return;
        }

        tbodyEl.innerHTML = filtered
            .map((r) => {
                const isKeluar = String(r.jenis || "").toLowerCase() === "pengeluaran";
                const badgeClass = isKeluar
                    ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                    : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";

                return `
                    <tr>
                        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(formatTanggalDisplay(r.tanggal))}</td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${badgeClass}">${escapeHtml(r.jenis || "Pemasukan")}</span>
                        </td>
                        <td class="px-4 py-3">
                            ${r.kategori ? `<div class="text-[11px] font-semibold text-stone-500 dark:text-stone-400">${escapeHtml(r.kategori)}</div>` : ""}
                            <div class="font-semibold">${escapeHtml(r.uraian || "-")}</div>
                        </td>
                        <td class="px-4 py-3 text-right font-bold whitespace-nowrap ${isKeluar ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}">
                            ${isKeluar ? "-" : "+"}${escapeHtml(formatRupiah(r.nominal))}
                        </td>
                        ${
                            isAdmin
                                ? `<td class="px-4 py-3 text-right whitespace-nowrap">
                                    <div class="inline-flex items-center gap-1.5">
                                        <button type="button" data-mkl-edit="${escapeHtml(r.id)}" class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer">Edit</button>
                                        <button type="button" data-mkl-del="${escapeHtml(r.id)}" class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
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
            const snap = await getDocs(collection(db, COLLECTION_LAPORAN));
            if (isDestroyed) return;
            const list = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
            rows = list.sort((a, b) => String(b.tanggal || b.createdAt || "").localeCompare(String(a.tanggal || a.createdAt || "")));
            render();
        } catch (err) {
            console.error("Gagal memuat laporan keuangan:", err);
            showFeedback("Gagal memuat data laporan keuangan.", "error");
        }
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (!isAdmin) return;
        hideFeedback();

        const uraian = document.getElementById("mkl-uraian")?.value.trim() || "";
        const nominal = Number(document.getElementById("mkl-nominal")?.value);
        if (!uraian || !Number.isFinite(nominal) || nominal <= 0) {
            showFeedback("Uraian dan nominal transaksi wajib diisi dengan benar.", "error");
            return;
        }

        const payload = {
            jenis: document.getElementById("mkl-jenis")?.value || "Pemasukan",
            tanggal: document.getElementById("mkl-tanggal")?.value || todayIso,
            kategori: document.getElementById("mkl-kategori")?.value.trim() || "",
            nominal,
            uraian,
            updatedAt: new Date().toISOString()
        };

        try {
            const editId = editIdEl.value.trim();
            if (editId) {
                await updateDoc(doc(db, COLLECTION_LAPORAN, editId), payload);
                showFeedback("Data laporan keuangan berhasil diperbarui.");
            } else {
                await addDoc(collection(db, COLLECTION_LAPORAN), { ...payload, createdAt: new Date().toISOString() });
                showFeedback("Data laporan keuangan berhasil ditambahkan.");
            }
            closeForm();
            await loadData();
        } catch (err) {
            console.error("Gagal simpan laporan keuangan:", err);
            showFeedback("Gagal menyimpan data laporan keuangan.", "error");
        }
    }

    const onClick = async (e) => {
        const editBtn = e.target.closest("[data-mkl-edit]");
        if (editBtn && isAdmin) {
            const found = rows.find((r) => r.id === editBtn.getAttribute("data-mkl-edit"));
            if (found) openForm(found);
            return;
        }
        const delBtn = e.target.closest("[data-mkl-del]");
        if (delBtn && isAdmin) {
            const id = delBtn.getAttribute("data-mkl-del");
            if (!id || !window.confirm("Hapus data laporan keuangan ini?")) return;
            try {
                await deleteDoc(doc(db, COLLECTION_LAPORAN, id));
                if (editIdEl.value === id) closeForm();
                showFeedback("Data laporan keuangan berhasil dihapus.");
                await loadData();
            } catch (err) {
                console.error("Gagal hapus laporan keuangan:", err);
                showFeedback("Gagal menghapus data laporan keuangan.", "error");
            }
        }
    };

    if (isAdmin) toggleBtn?.classList.remove("hidden");
    toggleBtn?.addEventListener("click", () => (formPanel?.classList.contains("hidden") ? openForm(null) : closeForm()));
    cancelBtn?.addEventListener("click", closeForm);
    resetBtn?.addEventListener("click", () => fillForm(null));
    formEl?.addEventListener("submit", onSubmit);
    filterJenisEl?.addEventListener("change", render);
    searchEl?.addEventListener("input", render);
    document.addEventListener("click", onClick);

    loadData();

    return () => {
        isDestroyed = true;
        formEl?.removeEventListener("submit", onSubmit);
        filterJenisEl?.removeEventListener("change", render);
        searchEl?.removeEventListener("input", render);
        document.removeEventListener("click", onClick);
    };
}