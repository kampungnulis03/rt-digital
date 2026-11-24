// File: assets/js/views/manajemen-kependudukan-mutasi.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_NAME = "mutasi_penduduk";
const WARGA_COLLECTION = "warga";
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

function toDateInputValue(dateStr = "") {
    const raw = String(dateStr ?? "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, "0");
        const d = String(parsed.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
    return "";
}

function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatTanggalDisplay(dateStr = "") {
    const norm = toDateInputValue(dateStr);
    if (!norm) return "-";
    const parsed = new Date(`${norm}T00:00:00`);
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

function stripTransientFields(source = {}) {
    const { id, _timeMs, _fromBaseline, _isDeceasedSnapshot, ...clean } = source || {};
    return clean;
}

async function writeWargaAuditLog({ wargaId, aksiLog, snapshotData, keteranganPerubahan = "" }) {
    const actorEmail = String(localStorage.getItem("user_email") || "").trim();
    const actorRole = String(localStorage.getItem("user_role") || "").trim();
    const nowIso = new Date().toISOString();

    const cleanSnapshot = stripTransientFields(snapshotData);
    const tanggalBerlakuPerubahan =
        toDateInputValue(cleanSnapshot.tanggalBerlakuPerubahan) ||
        toDateInputValue(cleanSnapshot.tanggalDikeluarkan) ||
        getTodayDateString();

    await addDoc(collection(db, WARGA_LOG_COLLECTION), {
        ...cleanSnapshot,
        tanggalBerlakuPerubahan,
        keteranganPerubahan: String(keteranganPerubahan ?? cleanSnapshot.keteranganPerubahan ?? "").trim(),
        wargaId: String(wargaId || ""),
        aksiLog: String(aksiLog || "EDIT").toUpperCase(),
        logAt: nowIso,
        actorEmail,
        actorRole
    });
}

export function renderManajemenKependudukanMutasi() {
    return `
        <div id="mk-mutasi-wrapper" class="space-y-4">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100">
                        Data Mutasi Penduduk
                    </h2>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                        Catat pindah keluar (termasuk keluar sementara) &amp; perubahan data, serta sinkronkan ke Data Warga &amp; Log.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <span class="px-2.5 py-1 text-[11px] font-mono font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        Tabel: ${escapeHtml(COLLECTION_NAME)}
                    </span>
                    <button
                        type="button"
                        id="mk-mutasi-toggle-btn"
                        class="hidden inline-flex items-center justify-center px-3.5 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        + Tambah Mutasi
                    </button>
                    <a
                        href="#/manajemen-kependudukan"
                        data-link
                        class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition"
                    >
                        <span>← Kembali</span>
                    </a>
                </div>
            </div>

            <div id="mk-mutasi-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200"></div>

            <div id="mk-mutasi-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="mk-mutasi-form" class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h3 id="mk-mutasi-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            TAMBAH DATA MUTASI
                        </h3>
                        <button
                            type="button"
                            id="mk-mutasi-cancel-btn"
                            class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                        >
                            Tutup Form
                        </button>
                    </div>

                    <input type="hidden" id="mk-mutasi-edit-id" value="">

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label for="mk-mutasi-jenis" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Jenis Mutasi
                            </label>
                            <select id="mk-mutasi-jenis" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                                <option value="Pindah Keluar">Pindah Keluar</option>
                                <option value="Perubahan Data">Perubahan Data</option>
                            </select>
                        </div>
                        <div>
                            <label for="mk-mutasi-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Tanggal Mutasi / Berlaku
                            </label>
                            <input type="date" id="mk-mutasi-tanggal" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>
                        <div>
                            <label for="mk-mutasi-warga-select" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Pilih Warga (Data Warga) <span class="text-rose-500">*</span>
                            </label>
                            <select
                                id="mk-mutasi-warga-select"
                                required
                                class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                                <option value="">-- Pilih Warga --</option>
                            </select>
                        </div>
                        <div>
                            <label for="mk-mutasi-nik" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                NIK
                            </label>
                            <input type="text" id="mk-mutasi-nik" maxlength="20" placeholder="Otomatis dari data warga" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>
                        <div>
                            <label for="mk-mutasi-no-kk" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                No. KK
                            </label>
                            <input type="text" id="mk-mutasi-no-kk" maxlength="20" placeholder="Otomatis dari data warga" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>
                        <div>
                            <label for="mk-mutasi-keterangan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Tujuan / Keterangan Mutasi
                            </label>
                            <input type="text" id="mk-mutasi-keterangan" placeholder="Contoh: Keluar sementara / Pindah ke..." class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>
                    </div>

                    <p id="mk-mutasi-warga-info" class="hidden text-[11px] text-[#5c6d4e] dark:text-emerald-400"></p>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <button
                            type="button"
                            id="mk-mutasi-reset-btn"
                            class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                        >
                            Bersihkan
                        </button>
                        <button
                            type="submit"
                            class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                        >
                            Simpan Data
                        </button>
                    </div>
                </form>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <select
                        id="mk-mutasi-filter-jenis"
                        class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                        <option value="">Semua Jenis Mutasi</option>
                        <option value="Pindah Keluar">Pindah Keluar</option>
                        <option value="Perubahan Data">Perubahan Data</option>
                    </select>
                    <span id="mk-mutasi-total" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Data
                    </span>
                </div>
                <div class="w-full sm:w-72">
                    <input
                        type="text"
                        id="mk-mutasi-search"
                        placeholder="Cari nama, NIK, No. KK, atau keterangan..."
                        class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                </div>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        <tr>
                            <th class="px-4 py-3">Jenis Mutasi</th>
                            <th class="px-4 py-3">Tanggal</th>
                            <th class="px-4 py-3">Nama / NIK</th>
                            <th class="px-4 py-3">Keterangan</th>
                            <th id="mk-mutasi-aksi-th" class="hidden px-4 py-3 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="mk-mutasi-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr>
                            <td colspan="5" class="p-8 text-center text-stone-500 dark:text-stone-400">
                                Memuat data mutasi...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenKependudukanMutasiHandler() {
    let items = [];
    let wargaList = [];
    let isDestroyed = false;
    let feedbackTimerId = null;
    const isAdmin = getCurrentUserRole() === "administrator";
    const todayIso = getTodayDateString();

    const wrapperEl = document.getElementById("mk-mutasi-wrapper");
    const toggleBtn = document.getElementById("mk-mutasi-toggle-btn");
    const feedbackEl = document.getElementById("mk-mutasi-feedback");
    const formPanel = document.getElementById("mk-mutasi-form-panel");
    const formEl = document.getElementById("mk-mutasi-form");
    const formTitleEl = document.getElementById("mk-mutasi-form-title");
    const editIdInput = document.getElementById("mk-mutasi-edit-id");
    const jenisSelectEl = document.getElementById("mk-mutasi-jenis");
    const tanggalInputEl = document.getElementById("mk-mutasi-tanggal");
    const wargaSelectEl = document.getElementById("mk-mutasi-warga-select");
    const nikInputEl = document.getElementById("mk-mutasi-nik");
    const noKkInputEl = document.getElementById("mk-mutasi-no-kk");
    const ketInputEl = document.getElementById("mk-mutasi-keterangan");
    const wargaInfoEl = document.getElementById("mk-mutasi-warga-info");
    const cancelBtn = document.getElementById("mk-mutasi-cancel-btn");
    const resetBtn = document.getElementById("mk-mutasi-reset-btn");
    const filterJenisEl = document.getElementById("mk-mutasi-filter-jenis");
    const searchEl = document.getElementById("mk-mutasi-search");
    const totalEl = document.getElementById("mk-mutasi-total");
    const aksiThEl = document.getElementById("mk-mutasi-aksi-th");
    const tbodyEl = document.getElementById("mk-mutasi-tbody");

    if (isAdmin) {
        toggleBtn?.classList.remove("hidden");
        aksiThEl?.classList.remove("hidden");
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

    function setWargaInfo(text = "") {
        if (!wargaInfoEl) return;
        if (text) {
            wargaInfoEl.textContent = text;
            wargaInfoEl.classList.remove("hidden");
        } else {
            wargaInfoEl.textContent = "";
            wargaInfoEl.classList.add("hidden");
        }
    }

    function getSelectableWargaList(editingMutasiItem = null) {
        const exitedWargaIds = new Set(
            items
                .filter(
                    (row) =>
                        row.id !== editingMutasiItem?.id &&
                        String(row.jenisMutasi || "").trim().toLowerCase() === "pindah keluar"
                )
                .map((row) => String(row.wargaId || "").trim())
                .filter(Boolean)
        );

        const activeWarga = wargaList.filter((w) => !exitedWargaIds.has(String(w.id || "").trim()));

        if (editingMutasiItem?.wargaSnapshot) {
            const snapId = String(editingMutasiItem.wargaId || editingMutasiItem.wargaSnapshot.id || "").trim();
            const existsInActive = activeWarga.some((w) => String(w.id || "").trim() === snapId);
            if (!existsInActive) {
                activeWarga.unshift({
                    ...editingMutasiItem.wargaSnapshot,
                    id: snapId || `snapshot-${editingMutasiItem.id}`
                });
            }
        }

        return activeWarga.sort((a, b) => String(a.nama || "").localeCompare(String(b.nama || ""), "id"));
    }

    function renderWargaSelectOptions(selectedWargaId = "", editingMutasiItem = null) {
        if (!wargaSelectEl) return;
        const optionsSource = getSelectableWargaList(editingMutasiItem);
        const targetId = String(selectedWargaId ?? wargaSelectEl.value ?? "").trim();

        const html = [`<option value="">-- Pilih Warga --</option>`];
        optionsSource.forEach((w) => {
            const id = String(w.id || "").trim();
            const nama = String(w.nama || "-").trim();
            const nik = String(w.nik || "").trim();
            const kk = String(w.noKk || "").trim();
            const meta = [nik ? `NIK: ${nik}` : "", kk ? `KK: ${kk}` : ""].filter(Boolean).join(" • ");
            const label = meta ? `${nama} (${meta})` : nama;
            const selected = targetId && id === targetId ? " selected" : "";
            html.push(`<option value="${escapeHtml(id)}"${selected}>${escapeHtml(label)}</option>`);
        });

        wargaSelectEl.innerHTML = html.join("");
        if (targetId) {
            wargaSelectEl.value = targetId;
        }
    }

    function findWargaById(wargaId = "", editingMutasiItem = null) {
        const id = String(wargaId || "").trim();
        if (!id) return null;
        const fromWarga = wargaList.find((w) => String(w.id || "").trim() === id);
        if (fromWarga) return fromWarga;
        if (
            editingMutasiItem?.wargaSnapshot &&
            String(editingMutasiItem.wargaId || editingMutasiItem.wargaSnapshot.id || "").trim() === id
        ) {
            return {
                ...editingMutasiItem.wargaSnapshot,
                id
            };
        }
        return null;
    }

    function onWargaSelectionChange(editingMutasiItem = null, syncFields = true) {
        const selectedId = String(wargaSelectEl?.value || "").trim();
        const found = findWargaById(selectedId, editingMutasiItem);

        if (!found) {
            setWargaInfo("");
            return;
        }

        if (syncFields) {
            if (nikInputEl) nikInputEl.value = String(found.nik || "").trim();
            if (noKkInputEl) noKkInputEl.value = String(found.noKk || "").trim();
        }

        const detail = [
            found.noKk ? `KK: ${found.noKk}` : "",
            found.hubunganKeluarga ? `Hub: ${found.hubunganKeluarga}` : "",
            found.rtRw ? `RT/RW: ${found.rtRw}` : ""
        ]
            .filter(Boolean)
            .join(" • ");
        setWargaInfo(detail ? `Warga terpilih: ${found.nama || "-"} (${detail})` : `Warga terpilih: ${found.nama || "-"}`);
    }

    function fillForm(item = null) {
        if (editIdInput) editIdInput.value = item?.id || "";
        if (formTitleEl) {
            formTitleEl.textContent = item ? "EDIT DATA MUTASI" : "TAMBAH DATA MUTASI";
        }
        setWargaInfo("");

        const rawJenis = String(item?.jenisMutasi || "Pindah Keluar").trim();
        const normalizedJenis = rawJenis === "Perubahan Data" ? "Perubahan Data" : "Pindah Keluar";

        let selectedWargaId = String(item?.wargaId || "").trim();
        if (!selectedWargaId && item) {
            const matched =
                (item.nik && wargaList.find((w) => String(w.nik || "").trim() === String(item.nik).trim())) ||
                wargaList.find((w) => String(w.nama || "").trim().toLowerCase() === String(item.nama || "").trim().toLowerCase());
            if (matched) selectedWargaId = String(matched.id || "").trim();
        }

        renderWargaSelectOptions(selectedWargaId, item);

        if (jenisSelectEl) jenisSelectEl.value = normalizedJenis;
        if (tanggalInputEl) tanggalInputEl.value = toDateInputValue(item?.tanggal) || todayIso;
        if (nikInputEl) nikInputEl.value = item?.nik || "";
        if (noKkInputEl) noKkInputEl.value = item?.noKk || "";
        if (ketInputEl) ketInputEl.value = item?.keterangan || "";

        if (selectedWargaId) {
            onWargaSelectionChange(item, !item?.nik && !item?.noKk);
        }
    }

    function openForm(item = null) {
        if (!isAdmin) return;
        hideFeedback();
        formPanel?.classList.remove("hidden");
        fillForm(item);
        wargaSelectEl?.focus();
    }

    function closeForm() {
        formPanel?.classList.add("hidden");
        if (editIdInput) editIdInput.value = "";
        setWargaInfo("");
    }

    function getFilteredRows() {
        const jenisFilter = String(filterJenisEl?.value || "").trim().toLowerCase();
        const keyword = String(searchEl?.value || "").trim().toLowerCase();

        return items.filter((row) => {
            if (jenisFilter && String(row.jenisMutasi || "").toLowerCase() !== jenisFilter) {
                return false;
            }
            if (keyword) {
                const hay = [row.jenisMutasi, row.nama, row.nik, row.noKk, row.keterangan]
                    .join(" ")
                    .toLowerCase();
                if (!hay.includes(keyword)) return false;
            }
            return true;
        });
    }

    function renderRows() {
        if (!tbodyEl || isDestroyed) return;
        const rows = getFilteredRows();
        const colSpan = isAdmin ? 5 : 4;
        if (totalEl) totalEl.textContent = `${rows.length} Data`;

        if (!rows.length) {
            tbodyEl.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" class="p-8 text-center text-stone-500 dark:text-stone-400">
                        Belum ada data mutasi yang ditampilkan.
                    </td>
                </tr>
            `;
            return;
        }

        tbodyEl.innerHTML = rows
            .map((row) => {
                const subMeta = [
                    row.nik ? `NIK: ${row.nik}` : "",
                    row.noKk ? `KK: ${row.noKk}` : ""
                ]
                    .filter(Boolean)
                    .join(" • ");

                const actionTd = isAdmin
                    ? `
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1.5">
                                <button type="button" data-mk-mutasi-edit="${escapeHtml(row.id)}" class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer">Edit</button>
                                <button type="button" data-mk-mutasi-delete="${escapeHtml(row.id)}" class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
                            </div>
                        </td>
                    `
                    : "";

                return `
                    <tr>
                        <td class="px-4 py-3 font-semibold">${escapeHtml(row.jenisMutasi || "-")}</td>
                        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(formatTanggalDisplay(row.tanggal))}</td>
                        <td class="px-4 py-3">
                            <div class="font-semibold">${escapeHtml(row.nama || "-")}</div>
                            ${subMeta ? `<div class="text-[11px] font-mono text-stone-500 dark:text-stone-400">${escapeHtml(subMeta)}</div>` : ""}
                        </td>
                        <td class="px-4 py-3">${escapeHtml(row.keterangan || "-")}</td>
                        ${actionTd}
                    </tr>
                `;
            })
            .join("");
    }

    async function loadData() {
        try {
            const [mutasiSnap, wargaSnap] = await Promise.all([
                getDocs(collection(db, COLLECTION_NAME)),
                getDocs(collection(db, WARGA_COLLECTION)).catch((err) => {
                    console.warn("Gagal memuat koleksi warga untuk sinkronisasi:", err);
                    return null;
                })
            ]);

            if (isDestroyed) return;

            const list = [];
            mutasiSnap.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
            list.sort((a, b) =>
                String(b.tanggal || b.createdAt || "").localeCompare(String(a.tanggal || a.createdAt || ""))
            );

            const wList = [];
            if (wargaSnap) {
                wargaSnap.forEach((docSnap) => wList.push({ id: docSnap.id, ...docSnap.data() }));
            }

            items = list;
            wargaList = wList;

            const editingId = editIdInput?.value?.trim() || "";
            const editingItem = editingId ? items.find((r) => r.id === editingId) || null : null;
            renderWargaSelectOptions(wargaSelectEl?.value || "", editingItem);
            renderRows();
        } catch (err) {
            console.error(`Gagal memuat koleksi ${COLLECTION_NAME}:`, err);
            showFeedback(`Gagal memuat data dari tabel ${COLLECTION_NAME}.`, "error");
        }
    }

    async function restoreWargaFromSnapshot(snapshotData, tanggalBerlaku, keterangan = "Pembatalan mutasi keluar") {
        if (!snapshotData || typeof snapshotData !== "object") return;
        const clean = stripTransientFields(snapshotData);
        const nowIso = new Date().toISOString();
        const restoredPayload = {
            ...clean,
            tanggalBerlakuPerubahan: toDateInputValue(tanggalBerlaku) || getTodayDateString(),
            updatedAt: nowIso
        };
        const addedRef = await addDoc(collection(db, WARGA_COLLECTION), {
            ...restoredPayload,
            createdAt: clean.createdAt || nowIso
        });
        await writeWargaAuditLog({
            wargaId: addedRef.id,
            aksiLog: "TAMBAH",
            snapshotData: restoredPayload,
            keteranganPerubahan: keterangan
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!isAdmin) return;
        hideFeedback();

        const jenisMutasi = String(jenisSelectEl?.value || "Pindah Keluar").trim();
        const selectedWargaId = String(wargaSelectEl?.value || "").trim();
        const editId = editIdInput?.value.trim() || "";
        const existingMutasi = editId ? items.find((r) => r.id === editId) || null : null;
        const selectedWarga = findWargaById(selectedWargaId, existingMutasi);

        const nama = String(selectedWarga?.nama || "").trim();
        if (!selectedWargaId || !nama) {
            showFeedback("Pilih warga dari Data Warga terlebih dahulu.", "error");
            return;
        }

        const tanggal = toDateInputValue(tanggalInputEl?.value) || todayIso;
        const nik = String(nikInputEl?.value || selectedWarga?.nik || "").trim();
        const noKk = String(noKkInputEl?.value || selectedWarga?.noKk || "").trim();
        const keterangan = String(ketInputEl?.value || "").trim();
        const nowIso = new Date().toISOString();

        const wargaSnapshot = stripTransientFields({
            ...selectedWarga,
            nik: nik || selectedWarga?.nik || "",
            noKk: noKk || selectedWarga?.noKk || ""
        });

        const basePayload = {
            jenisMutasi,
            tanggal,
            nama,
            nik,
            noKk,
            wargaId: selectedWargaId,
            wargaSnapshot,
            keterangan,
            updatedAt: nowIso
        };

        try {
            if (editId && existingMutasi) {
                const prevJenis = String(existingMutasi.jenisMutasi || "").trim();
                const prevWargaId = String(existingMutasi.wargaId || "").trim();

                if (prevJenis === "Pindah Keluar" && existingMutasi.wargaSnapshot) {
                    const shouldRestore = jenisMutasi !== "Pindah Keluar" || prevWargaId !== selectedWargaId;
                    if (shouldRestore) {
                        await restoreWargaFromSnapshot(
                            existingMutasi.wargaSnapshot,
                            toDateInputValue(existingMutasi.tanggal) || todayIso,
                            "Perubahan catatan pindah keluar"
                        );
                    }
                }

                if (jenisMutasi === "Pindah Keluar") {
                    const activeWargaDoc = wargaList.find((w) => String(w.id || "").trim() === selectedWargaId);
                    if (activeWargaDoc) {
                        await deleteDoc(doc(db, WARGA_COLLECTION, activeWargaDoc.id));
                    }
                    await writeWargaAuditLog({
                        wargaId: selectedWargaId,
                        aksiLog: "HAPUS",
                        snapshotData: {
                            ...wargaSnapshot,
                            tanggalBerlakuPerubahan: tanggal
                        },
                        keteranganPerubahan: keterangan || "Pindah keluar"
                    });
                } else {
                    const activeWargaDoc = wargaList.find((w) => String(w.id || "").trim() === selectedWargaId);
                    const updatedWargaFields = {
                        nik,
                        noKk,
                        tanggalBerlakuPerubahan: tanggal,
                        updatedAt: nowIso
                    };
                    if (activeWargaDoc) {
                        await updateDoc(doc(db, WARGA_COLLECTION, activeWargaDoc.id), updatedWargaFields);
                    }
                    await writeWargaAuditLog({
                        wargaId: selectedWargaId,
                        aksiLog: "EDIT",
                        snapshotData: {
                            ...wargaSnapshot,
                            ...updatedWargaFields
                        },
                        keteranganPerubahan: keterangan || "Perubahan data warga"
                    });
                }

                await updateDoc(doc(db, COLLECTION_NAME, editId), basePayload);
                showFeedback("Data mutasi diperbarui & disinkronkan ke Warga & Log.");
            } else {
                if (jenisMutasi === "Pindah Keluar") {
                    const activeWargaDoc = wargaList.find((w) => String(w.id || "").trim() === selectedWargaId);
                    if (activeWargaDoc) {
                        await deleteDoc(doc(db, WARGA_COLLECTION, activeWargaDoc.id));
                    }
                    await writeWargaAuditLog({
                        wargaId: selectedWargaId,
                        aksiLog: "HAPUS",
                        snapshotData: {
                            ...wargaSnapshot,
                            tanggalBerlakuPerubahan: tanggal
                        },
                        keteranganPerubahan: keterangan || "Pindah keluar"
                    });
                } else {
                    const activeWargaDoc = wargaList.find((w) => String(w.id || "").trim() === selectedWargaId);
                    const updatedWargaFields = {
                        nik,
                        noKk,
                        tanggalBerlakuPerubahan: tanggal,
                        updatedAt: nowIso
                    };
                    if (activeWargaDoc) {
                        await updateDoc(doc(db, WARGA_COLLECTION, activeWargaDoc.id), updatedWargaFields);
                    }
                    await writeWargaAuditLog({
                        wargaId: selectedWargaId,
                        aksiLog: "EDIT",
                        snapshotData: {
                            ...wargaSnapshot,
                            ...updatedWargaFields
                        },
                        keteranganPerubahan: keterangan || "Perubahan data warga"
                    });
                }

                await addDoc(collection(db, COLLECTION_NAME), {
                    ...basePayload,
                    createdAt: nowIso
                });
                showFeedback("Data mutasi tersimpan & tersinkron ke Warga & Log.");
            }

            closeForm();
            await loadData();
        } catch (err) {
            console.error(`Gagal menyimpan data ${COLLECTION_NAME}:`, err);
            showFeedback("Gagal menyimpan dan menyinkronkan data mutasi.", "error");
        }
    }

    const onDelegateClick = async (e) => {
        if (wrapperEl && !wrapperEl.contains(e.target)) return;
        if (!isAdmin) return;

        const editBtn = e.target.closest("[data-mk-mutasi-edit]");
        if (editBtn) {
            const id = editBtn.getAttribute("data-mk-mutasi-edit");
            const found = items.find((r) => r.id === id);
            if (found) openForm(found);
            return;
        }

        const deleteBtn = e.target.closest("[data-mk-mutasi-delete]");
        if (deleteBtn) {
            const id = deleteBtn.getAttribute("data-mk-mutasi-delete");
            if (!id) return;
            const targetRow = items.find((r) => r.id === id);
            if (!targetRow || !window.confirm("Hapus data mutasi ini dan sinkronkan ke Data Warga & Log?")) return;

            try {
                const jenis = String(targetRow.jenisMutasi || "").trim();
                await deleteDoc(doc(db, COLLECTION_NAME, id));

                if (jenis === "Pindah Keluar" && targetRow.wargaSnapshot) {
                    await restoreWargaFromSnapshot(
                        targetRow.wargaSnapshot,
                        toDateInputValue(targetRow.tanggal) || getTodayDateString(),
                        "Data pindah keluar dihapus (warga dipulihkan)"
                    );
                }

                if (editIdInput?.value === id) closeForm();
                showFeedback("Data mutasi dihapus & disinkronkan ke Warga & Log.");
                await loadData();
            } catch (err) {
                console.error(`Gagal menghapus data ${COLLECTION_NAME}:`, err);
                showFeedback("Gagal menghapus data mutasi.", "error");
            }
        }
    };

    const onWargaChange = () => {
        const editingId = editIdInput?.value?.trim() || "";
        const editingItem = editingId ? items.find((r) => r.id === editingId) || null : null;
        onWargaSelectionChange(editingItem, true);
    };

    toggleBtn?.addEventListener("click", () => {
        if (formPanel?.classList.contains("hidden")) openForm(null);
        else closeForm();
    });
    cancelBtn?.addEventListener("click", closeForm);
    resetBtn?.addEventListener("click", () => {
        const editingId = editIdInput?.value?.trim() || "";
        const editingItem = editingId ? items.find((r) => r.id === editingId) || null : null;
        fillForm(editingItem);
    });
    wargaSelectEl?.addEventListener("change", onWargaChange);
    formEl?.addEventListener("submit", handleSubmit);
    filterJenisEl?.addEventListener("change", renderRows);
    searchEl?.addEventListener("input", renderRows);
    document.addEventListener("click", onDelegateClick);

    loadData();

    return () => {
        isDestroyed = true;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        cancelBtn?.removeEventListener("click", closeForm);
        wargaSelectEl?.removeEventListener("change", onWargaChange);
        formEl?.removeEventListener("submit", handleSubmit);
        filterJenisEl?.removeEventListener("change", renderRows);
        searchEl?.removeEventListener("input", renderRows);
        document.removeEventListener("click", onDelegateClick);
    };
}

export default renderManajemenKependudukanMutasi;