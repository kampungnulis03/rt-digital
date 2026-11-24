// File: assets/js/views/manajemen-kependudukan-log.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const WARGA_LOG_COLLECTION = "warga_log";
const FEEDBACK_AUTO_HIDE_MS = 3500;

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function toDateInputValue(value = "") {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);

    const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, "0");
        const month = dmyMatch[2].padStart(2, "0");
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, "0");
        const d = String(parsed.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    return "";
}

function formatTimestampIndonesian(isoStr = "") {
    const raw = String(isoStr || "").trim();
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function getLogSortMs(entry = {}) {
    const iso = entry.logAt || entry.updatedAt || entry.createdAt || "";
    const ms = new Date(iso).getTime();
    if (!Number.isNaN(ms) && ms > 0) return ms;
    const eff = toDateInputValue(entry.tanggalBerlakuPerubahan || entry.tanggalDikeluarkan);
    if (eff) {
        const effMs = new Date(`${eff}T12:00:00.000Z`).getTime();
        if (!Number.isNaN(effMs)) return effMs;
    }
    return 0;
}

function getAksiBadgeClass(aksi = "") {
    const upper = String(aksi || "").toUpperCase();
    if (upper === "TAMBAH") {
        return "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
    }
    if (upper === "HAPUS") {
        return "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300";
    }
    return "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300";
}

export function renderManajemenKependudukanLog() {
    return `
        <div id="mkl-root" class="space-y-4">
            <!-- Header Sub-Halaman Manajemen Log -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Manajemen Kependudukan • Manajemen Log Perubahan Warga
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Riwayat jejak tambah, ubah, dan hapus data warga beserta tanggal berlaku perubahan, keterangan perubahan, dan snapshot data.
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <a
                        href="#/manajemen-kependudukan"
                        data-link
                        class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition"
                    >
                        <span>← Kembali</span>
                    </a>
                </div>
            </div>

            <!-- Notifikasi Pojok Kanan Atas -->
            <div id="mkl-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg"></div>

            <!-- Ringkasan Statistik Log -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Log</div>
                    <div id="mkl-stat-total" class="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Log Tambah</div>
                    <div id="mkl-stat-tambah" class="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Log Edit</div>
                    <div id="mkl-stat-edit" class="text-lg font-bold text-amber-700 dark:text-amber-400 mt-1">0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Log Hapus</div>
                    <div id="mkl-stat-hapus" class="text-lg font-bold text-rose-700 dark:text-rose-400 mt-1">0</div>
                </div>
            </div>

            <!-- Filter & Pencarian Log -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <select
                            id="mkl-filter-aksi"
                            class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                            <option value="">Semua Aksi</option>
                            <option value="TAMBAH">TAMBAH</option>
                            <option value="EDIT">EDIT</option>
                            <option value="HAPUS">HAPUS</option>
                        </select>

                        <div class="inline-flex items-center gap-1.5">
                            <label for="mkl-filter-tgl-berlaku" class="text-xs font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                Tgl Berlaku
                            </label>
                            <input
                                type="date"
                                id="mkl-filter-tgl-berlaku"
                                class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                            <button
                                type="button"
                                id="mkl-reset-tgl-btn"
                                class="px-2.5 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                            >
                                Reset
                            </button>
                        </div>

                        <span id="mkl-total-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                            0 Log
                        </span>
                    </div>

                    <div class="w-full lg:w-80">
                        <input
                            type="text"
                            id="mkl-search-input"
                            placeholder="Cari nama, NIK, No. KK, keterangan perubahan, atau aktor..."
                            class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                    </div>
                </div>
            </div>

            <!-- Tabel Riwayat Log -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        <tr>
                            <th class="px-4 py-3">Waktu Log &amp; Aksi</th>
                            <th class="px-4 py-3">Warga (NIK / No. KK)</th>
                            <th class="px-4 py-3">Tgl Berlaku &amp; Tgl KK</th>
                            <th class="px-4 py-3">Keterangan Perubahan</th>
                            <th class="px-4 py-3">Petugas / Aktor</th>
                            <th class="px-4 py-3 text-right">Detail</th>
                        </tr>
                    </thead>
                    <tbody id="mkl-table-body" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr>
                            <td colspan="6" class="p-8 text-center text-stone-500 dark:text-stone-400">
                                Memuat riwayat log warga...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Modal Detail Snapshot Log -->
            <div id="mkl-detail-modal" class="hidden fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none w-full max-w-2xl max-h-[85vh] flex flex-col">
                    <div class="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                        <h2 id="mkl-modal-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                            DETAIL SNAPSHOT LOG
                        </h2>
                        <button
                            type="button"
                            id="mkl-close-modal-btn"
                            class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none cursor-pointer"
                        >
                            Tutup
                        </button>
                    </div>
                    <div id="mkl-modal-body" class="p-5 overflow-y-auto text-xs space-y-2 text-stone-800 dark:text-stone-200"></div>
                </div>
            </div>
        </div>
    `;
}

export function initManajemenKependudukanLogHandler() {
    let logList = [];
    let isDestroyed = false;
    let feedbackTimerId = null;

    const rootEl = document.getElementById("mkl-root");
    const feedbackEl = document.getElementById("mkl-feedback");

    const statTotalEl = document.getElementById("mkl-stat-total");
    const statTambahEl = document.getElementById("mkl-stat-tambah");
    const statEditEl = document.getElementById("mkl-stat-edit");
    const statHapusEl = document.getElementById("mkl-stat-hapus");

    const filterAksiSelect = document.getElementById("mkl-filter-aksi");
    const filterTglBerlakuInput = document.getElementById("mkl-filter-tgl-berlaku");
    const resetTglBtn = document.getElementById("mkl-reset-tgl-btn");
    const searchInput = document.getElementById("mkl-search-input");
    const totalBadgeEl = document.getElementById("mkl-total-badge");
    const tableBodyEl = document.getElementById("mkl-table-body");

    const detailModalEl = document.getElementById("mkl-detail-modal");
    const modalTitleEl = document.getElementById("mkl-modal-title");
    const modalBodyEl = document.getElementById("mkl-modal-body");
    const closeModalBtn = document.getElementById("mkl-close-modal-btn");

    function showFeedback(message, type = "success") {
        if (!feedbackEl || isDestroyed) return;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        feedbackEl.className =
            type === "error"
                ? "fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
        feedbackEl.textContent = message;
        feedbackEl.classList.remove("hidden");

        feedbackTimerId = window.setTimeout(() => {
            feedbackTimerId = null;
            feedbackEl?.classList.add("hidden");
        }, FEEDBACK_AUTO_HIDE_MS);
    }

    function updateStats(rows = logList) {
        const total = rows.length;
        const tambah = rows.filter((r) => String(r.aksiLog || "").toUpperCase() === "TAMBAH").length;
        const edit = rows.filter((r) => String(r.aksiLog || "").toUpperCase() === "EDIT").length;
        const hapus = rows.filter((r) => String(r.aksiLog || "").toUpperCase() === "HAPUS").length;

        if (statTotalEl) statTotalEl.textContent = String(total);
        if (statTambahEl) statTambahEl.textContent = String(tambah);
        if (statEditEl) statEditEl.textContent = String(edit);
        if (statHapusEl) statHapusEl.textContent = String(hapus);
    }

    function getFilteredLogs() {
        const aksiFilter = String(filterAksiSelect?.value || "").trim().toUpperCase();
        const tglFilter = toDateInputValue(filterTglBerlakuInput?.value || "");
        const keyword = String(searchInput?.value || "").trim().toLowerCase();

        return logList.filter((row) => {
            const aksi = String(row.aksiLog || "EDIT").toUpperCase();
            const tglBerlaku = toDateInputValue(row.tanggalBerlakuPerubahan || row.tanggalDikeluarkan);

            if (aksiFilter && aksi !== aksiFilter) return false;
            if (tglFilter && tglBerlaku !== tglFilter) return false;

            if (keyword) {
                const hay = [
                    aksi,
                    row.nama,
                    row.nik,
                    row.noKk,
                    row.kepalaKeluarga,
                    row.statusPerkawinan,
                    row.hubunganKeluarga,
                    row.statusWarga,
                    row.keteranganPerubahan,
                    row.actorEmail,
                    row.actorRole,
                    tglBerlaku,
                    toDateInputValue(row.tanggalDikeluarkan)
                ]
                    .join(" ")
                    .toLowerCase();
                if (!hay.includes(keyword)) return false;
            }
            return true;
        });
    }

    function openDetailModal(logId) {
        const entry = logList.find((item) => item.id === logId);
        if (!entry || !detailModalEl || !modalBodyEl) return;

        const aksi = String(entry.aksiLog || "EDIT").toUpperCase();
        if (modalTitleEl) {
            modalTitleEl.textContent = `DETAIL LOG • ${aksi} — ${entry.nama || "-"}`;
        }

        const fields = [
            ["Aksi Log", aksi],
            ["Waktu Log", formatTimestampIndonesian(entry.logAt || entry.updatedAt || entry.createdAt)],
            ["Tanggal Berlaku Perubahan", toDateInputValue(entry.tanggalBerlakuPerubahan) || "-"],
            ["Tanggal Dikeluarkan (KK)", toDateInputValue(entry.tanggalDikeluarkan) || "-"],
            ["Keterangan Perubahan", entry.keteranganPerubahan || "-"],
            ["Nama Lengkap", entry.nama || "-"],
            ["NIK / NIKS", entry.nik || "-"],
            ["No. KK", entry.noKk || "-"],
            ["Kepala Keluarga", entry.kepalaKeluarga || "-"],
            ["Jenis Kelamin", entry.jenisKelamin || "-"],
            ["Tempat / Tgl Lahir", [entry.tempatLahir, toDateInputValue(entry.tanggalLahir)].filter(Boolean).join(", ") || "-"],
            ["Agama / Pendidikan / Kerja", [entry.agama, entry.pendidikan, entry.pekerjaan].filter(Boolean).join(" • ") || "-"],
            ["Status Perkawinan", entry.statusPerkawinan || "-"],
            ["Hubungan Keluarga", entry.hubunganKeluarga || "-"],
            ["Status Tinggal", entry.statusWarga || "-"],
            ["Alamat Wilayah", [entry.alamat, entry.rtRw ? `RT/RW ${entry.rtRw}` : "", entry.desaKelurahan, entry.kecamatan, entry.kabupatenKota].filter(Boolean).join(" • ") || "-"],
            ["Petugas / Aktor", [entry.actorEmail, entry.actorRole].filter(Boolean).join(" • ") || "-"]
        ];

        modalBodyEl.innerHTML = `
            <div class="divide-y divide-stone-200/80 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-none">
                ${fields
                    .map(
                        ([label, val]) => `
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-1 px-3.5 py-2.5">
                        <div class="font-semibold text-stone-600 dark:text-stone-400">${escapeHtml(label)}</div>
                        <div class="sm:col-span-2 font-medium text-stone-900 dark:text-stone-100 break-words">${escapeHtml(val)}</div>
                    </div>
                `
                    )
                    .join("")}
            </div>
        `;

        detailModalEl.classList.remove("hidden");
    }

    function closeDetailModal() {
        detailModalEl?.classList.add("hidden");
    }

    function renderTable() {
        if (!tableBodyEl || isDestroyed) return;
        const rows = getFilteredLogs();
        updateStats(rows);

        if (totalBadgeEl) {
            totalBadgeEl.textContent = `${rows.length} Log`;
        }

        if (!rows.length) {
            tableBodyEl.innerHTML = `
                <tr>
                    <td colspan="6" class="p-8 text-center text-stone-500 dark:text-stone-400">
                        Belum ada catatan log perubahan yang sesuai dengan filter.
                    </td>
                </tr>
            `;
            return;
        }

        tableBodyEl.innerHTML = rows
            .map((row) => {
                const aksi = String(row.aksiLog || "EDIT").toUpperCase();
                const badgeClass = getAksiBadgeClass(aksi);
                const tglBerlaku = toDateInputValue(row.tanggalBerlakuPerubahan) || "-";
                const tglKk = toDateInputValue(row.tanggalDikeluarkan) || "-";
                const ket = String(row.keteranganPerubahan || "").trim();

                return `
                    <tr>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase border rounded-none ${badgeClass}">
                                ${escapeHtml(aksi)}
                            </span>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                                ${escapeHtml(formatTimestampIndonesian(row.logAt || row.updatedAt || row.createdAt))}
                            </div>
                        </td>
                        <td class="px-4 py-3">
                            <div class="font-semibold text-stone-900 dark:text-stone-100">${escapeHtml(row.nama || "-")}</div>
                            <div class="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                                NIK: ${escapeHtml(row.nik || "-")} • KK: ${escapeHtml(row.noKk || "-")}
                            </div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400">
                                Status Kawin: ${escapeHtml(row.statusPerkawinan || "-")} • ${escapeHtml(row.hubunganKeluarga || "-")}
                            </div>
                        </td>
                        <td class="px-4 py-3 text-[11px] whitespace-nowrap">
                            <div>Berlaku: <strong class="text-stone-900 dark:text-stone-100">${escapeHtml(tglBerlaku)}</strong></div>
                            <div class="text-stone-500 dark:text-stone-400">Tgl KK: ${escapeHtml(tglKk)}</div>
                        </td>
                        <td class="px-4 py-3 text-[11px]">
                            ${ket
                                ? `<span class="text-stone-800 dark:text-stone-200">${escapeHtml(ket)}</span>`
                                : `<span class="italic text-stone-400">Tidak ada keterangan</span>`
                            }
                        </td>
                        <td class="px-4 py-3 text-[11px]">
                            <div>${escapeHtml(row.actorEmail || "-")}</div>
                            <div class="text-stone-400 uppercase">${escapeHtml(row.actorRole || "-")}</div>
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <button
                                type="button"
                                data-mkl-detail="${escapeHtml(row.id)}"
                                class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer"
                            >
                                Detail
                            </button>
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    async function loadLogs() {
        try {
            const snap = await getDocs(collection(db, WARGA_LOG_COLLECTION));
            const items = [];
            snap.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            items.sort((a, b) => getLogSortMs(b) - getLogSortMs(a));

            if (isDestroyed) return;
            logList = items;
            renderTable();
        } catch (err) {
            console.error("Gagal memuat log kependudukan:", err);
            showFeedback("Gagal memuat riwayat log dari database.", "error");
        }
    }

    const onClickDelegate = (e) => {
        if (rootEl && !rootEl.contains(e.target)) return;

        const detailBtn = e.target.closest("[data-mkl-detail]");
        if (detailBtn) {
            const id = detailBtn.getAttribute("data-mkl-detail");
            if (id) openDetailModal(id);
        }
    };

    const onResetTgl = () => {
        if (filterTglBerlakuInput) filterTglBerlakuInput.value = "";
        renderTable();
    };

    filterAksiSelect?.addEventListener("change", renderTable);
    filterTglBerlakuInput?.addEventListener("change", renderTable);
    resetTglBtn?.addEventListener("click", onResetTgl);
    searchInput?.addEventListener("input", renderTable);
    closeModalBtn?.addEventListener("click", closeDetailModal);
    document.addEventListener("click", onClickDelegate);

    loadLogs();

    return () => {
        isDestroyed = true;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        filterAksiSelect?.removeEventListener("change", renderTable);
        filterTglBerlakuInput?.removeEventListener("change", renderTable);
        resetTglBtn?.removeEventListener("click", onResetTgl);
        searchInput?.removeEventListener("input", renderTable);
        closeModalBtn?.removeEventListener("click", closeDetailModal);
        document.removeEventListener("click", onClickDelegate);
    };
}

export default renderManajemenKependudukanLog;