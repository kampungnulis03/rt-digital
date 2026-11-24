// File: assets/js/views/manajemen-kependudukan-statistik.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_NAME = "statistik_penduduk";
const WARGA_COLLECTION_NAME = "warga";
const WARGA_LOG_COLLECTION_NAME = "warga_log";
const KELAHIRAN_COLLECTION_NAME = "kelahiran";
const KEMATIAN_COLLECTION_NAME = "kematian";
const MUTASI_COLLECTION_NAME = "mutasi_penduduk";
const SENSUS_COLLECTION_NAME = "sensus_penduduk";
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

function getEffectiveDateString(item = {}) {
    return (
        toDateInputValue(item.tanggalBerlakuPerubahan) ||
        toDateInputValue(item.tanggalMeninggal) ||
        toDateInputValue(item.tanggalDikeluarkan) ||
        toDateInputValue(item.tanggal) ||
        toDateInputValue(item.updatedAt) ||
        toDateInputValue(item.createdAt) ||
        toDateInputValue(item.logAt) ||
        getTodayDateString()
    );
}

function getLogSortKey(log = {}) {
    const effDate = getEffectiveDateString(log);
    const tsRaw = log.logAt || log.updatedAt || log.createdAt || "";
    const tsMs = Date.parse(tsRaw);
    const timePart = Number.isNaN(tsMs) ? String(tsRaw) : String(tsMs).padStart(16, "0");
    return `${effDate}__${timePart}`;
}

function buildWargaSnapshotAsOfDate(wargaList = [], logList = [], asOfDateStr = getTodayDateString()) {
    const targetDate = toDateInputValue(asOfDateStr) || getTodayDateString();
    const todayDate = getTodayDateString();

    if (targetDate >= todayDate && !logList.length) {
        return wargaList.map((w) => ({ ...w }));
    }

    const sortedLogs = [...logList].sort((a, b) =>
        getLogSortKey(a).localeCompare(getLogSortKey(b))
    );

    const eligibleLogs = sortedLogs.filter((log) => getEffectiveDateString(log) <= targetDate);
    const hasAnyLog = eligibleLogs.length > 0;

    if (!hasAnyLog) {
        return wargaList
            .filter((w) => getEffectiveDateString(w) <= targetDate)
            .map((w) => ({ ...w }));
    }

    const mapByKey = new Map();

    wargaList.forEach((w) => {
        const key = String(w.wargaId || w.id || w.nik || "").trim();
        if (!key) return;
        const eff = getEffectiveDateString(w);
        if (eff <= targetDate) {
            mapByKey.set(key, { ...w, id: w.id || key });
        }
    });

    eligibleLogs.forEach((log) => {
        const key = String(log.wargaId || log.id || log.nik || "").trim();
        if (!key) return;
        const aksi = String(log.aksiLog || "EDIT").toUpperCase();
        const {
            wargaId,
            aksiLog,
            logAt,
            actorEmail,
            actorRole,
            keteranganPerubahan,
            ...cleanData
        } = log;

        if (aksi === "HAPUS") {
            mapByKey.delete(key);
        } else {
            const existing = mapByKey.get(key) || {};
            mapByKey.set(key, {
                ...existing,
                ...cleanData,
                id: existing.id || wargaId || key
            });
        }
    });

    return Array.from(mapByKey.values());
}

function hitungUsiaTahun(birthDateStr = "", refDateStr = getTodayDateString()) {
    const birthNorm = toDateInputValue(birthDateStr);
    const refNorm = toDateInputValue(refDateStr) || getTodayDateString();
    if (!birthNorm) return null;

    const birth = new Date(`${birthNorm}T00:00:00`);
    const ref = new Date(`${refNorm}T00:00:00`);
    if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) return null;
    if (ref < birth) return 0;

    let years = ref.getFullYear() - birth.getFullYear();
    const mDiff = ref.getMonth() - birth.getMonth();
    if (mDiff < 0 || (mDiff === 0 && ref.getDate() < birth.getDate())) {
        years -= 1;
    }
    return Math.max(0, years);
}

function getKategoriUsiaUtama(warga = {}, refDateStr = getTodayDateString()) {
    const age = hitungUsiaTahun(warga.tanggalLahir, refDateStr);
    if (age === null) return "Belum Tercatat";
    if (age <= 11) return "Anak (0–11 thn)";
    if (age <= 17) return "Remaja (12–17 thn)";
    if (age <= 59) return "Dewasa (18–59 thn)";
    return "Lansia (60+ thn)";
}

function buildAgeComparison(wargaList = [], refDateStr = getTodayDateString()) {
    const groups = [
        { key: "Anak (0–11 thn)", label: "Anak", range: "0–11 thn", count: 0 },
        { key: "Remaja (12–17 thn)", label: "Remaja", range: "12–17 thn", count: 0 },
        { key: "Dewasa (18–59 thn)", label: "Dewasa", range: "18–59 thn", count: 0 },
        { key: "Lansia (60+ thn)", label: "Lansia", range: "60+ thn", count: 0 }
    ];
    let belumTercatat = 0;

    wargaList.forEach((w) => {
        const kat = getKategoriUsiaUtama(w, refDateStr);
        const found = groups.find((g) => g.key === kat);
        if (found) {
            found.count += 1;
        } else {
            belumTercatat += 1;
        }
    });

    const total = wargaList.length;
    const items = groups.map((g) => ({
        ...g,
        persen: total > 0 ? ((g.count / total) * 100).toFixed(1) : "0.0"
    }));

    return {
        items,
        belumTercatat,
        belumPersen: total > 0 ? ((belumTercatat / total) * 100).toFixed(1) : "0.0"
    };
}

function normalizeLabel(val = "", fallback = "Belum Tercatat") {
    const clean = String(val ?? "").trim();
    return clean || fallback;
}

function buildBreakdown(wargaList = [], mode = "jenisKelamin", refDateStr = getTodayDateString()) {
    const counts = new Map();

    wargaList.forEach((w) => {
        let key = "Belum Tercatat";
        if (mode === "jenisKelamin") {
            key = normalizeLabel(w.jenisKelamin, "Belum Tercatat");
        } else if (mode === "kelompokUsia") {
            key = getKategoriUsiaUtama(w, refDateStr);
        } else if (mode === "pendidikan") {
            key = normalizeLabel(w.pendidikan, "Belum Tercatat");
        } else if (mode === "pekerjaan") {
            key = normalizeLabel(w.pekerjaan, "Belum Tercatat");
        } else if (mode === "statusPerkawinan") {
            key = normalizeLabel(w.statusPerkawinan, "Belum Tercatat");
        } else if (mode === "agama") {
            key = normalizeLabel(w.agama, "Belum Tercatat");
        } else if (mode === "hubunganKeluarga") {
            key = normalizeLabel(w.hubunganKeluarga, "Belum Tercatat");
        }

        counts.set(key, (counts.get(key) || 0) + 1);
    });

    const total = wargaList.length;
    const rows = Array.from(counts.entries()).map(([label, jumlah]) => ({
        label,
        jumlah,
        persen: total > 0 ? ((jumlah / total) * 100).toFixed(1) : "0.0"
    }));

    if (mode === "kelompokUsia") {
        const order = [
            "Anak (0–11 thn)",
            "Remaja (12–17 thn)",
            "Dewasa (18–59 thn)",
            "Lansia (60+ thn)",
            "Belum Tercatat"
        ];
        rows.sort((a, b) => {
            const ia = order.indexOf(a.label);
            const ib = order.indexOf(b.label);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return b.jumlah - a.jumlah;
        });
    } else {
        rows.sort((a, b) => b.jumlah - a.jumlah || a.label.localeCompare(b.label, "id"));
    }

    return rows;
}

export function renderManajemenKependudukanStatistik() {
    const todayIso = getTodayDateString();
    return `
        <div id="mk-statistik-wrapper" class="space-y-4">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100">
                        Data Statistik Kependudukan
                    </h2>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                        Rekapitulasi demografi warga RT berdasarkan tanggal terakhir, usia, jenis kelamin, pendidikan &amp; pekerjaan.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <span class="px-2.5 py-1 text-[11px] font-mono font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        Sumber: ${escapeHtml(WARGA_COLLECTION_NAME)} + ${escapeHtml(WARGA_LOG_COLLECTION_NAME)}
                    </span>
                    <button
                        type="button"
                        id="mk-statistik-refresh-btn"
                        class="inline-flex items-center justify-center px-3 py-2 rounded-none text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition cursor-pointer"
                    >
                        Muat Ulang
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

            <div id="mk-statistik-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200"></div>

            <!-- Filter Tanggal Terakhir -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2.5">
                    <label for="mk-statistik-tanggal-akhir" class="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        Tanggal Terakhir Data:
                    </label>
                    <input
                        type="date"
                        id="mk-statistik-tanggal-akhir"
                        value="${escapeHtml(todayIso)}"
                        class="px-3 py-1.5 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                    <button
                        type="button"
                        id="mk-statistik-reset-tgl-btn"
                        class="px-2.5 py-1.5 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                    >
                        Hari Ini
                    </button>
                </div>
                <div id="mk-statistik-info-tanggal" class="text-[11px] text-stone-600 dark:text-stone-400">
                    Posisi data per: ${escapeHtml(formatTanggalDisplay(todayIso))}
                </div>
            </div>

            <!-- Ringkasan Angka Utama -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Total Warga
                    </div>
                    <div id="mk-stat-total-warga" class="text-xl font-bold text-stone-900 dark:text-stone-100 mt-1">
                        0
                    </div>
                    <div id="mk-stat-sub-kk" class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                        0 No. KK
                    </div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Laki-laki
                    </div>
                    <div id="mk-stat-laki" class="text-xl font-bold text-stone-900 dark:text-stone-100 mt-1">
                        0
                    </div>
                    <div id="mk-stat-laki-pct" class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                        0.0% dari warga
                    </div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Perempuan
                    </div>
                    <div id="mk-stat-perempuan" class="text-xl font-bold text-stone-900 dark:text-stone-100 mt-1">
                        0
                    </div>
                    <div id="mk-stat-perempuan-pct" class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                        0.0% dari warga
                    </div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Catatan Peristiwa &amp; Sensus
                    </div>
                    <div id="mk-stat-peristiwa-total" class="text-xl font-bold text-stone-900 dark:text-stone-100 mt-1">
                        0
                    </div>
                    <div id="mk-stat-peristiwa-detail" class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                        Lahir: 0 • Wafat: 0 • Mutasi: 0 • Sensus: 0
                    </div>
                </div>
            </div>

            <!-- Perbandingan Berdasarkan Usia (Anak, Remaja, Dewasa, Lansia) -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-stone-200 dark:border-stone-800">
                    <div>
                        <h3 class="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            Perbandingan Kelompok Usia (Anak • Remaja • Dewasa • Lansia)
                        </h3>
                        <p id="mk-stat-usia-catatan" class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                            Dihitung otomatis dari tanggal lahir terhadap tanggal terakhir yang dipilih.
                        </p>
                    </div>
                </div>
                <div id="mk-stat-usia-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"></div>
            </div>

            <!-- Filter Kategori & Pencarian -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <select
                        id="mk-statistik-kategori"
                        class="px-3 py-2 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                        <option value="jenisKelamin">Rekap Jenis Kelamin</option>
                        <option value="kelompokUsia">Rekap Usia (Anak, Remaja, Dewasa, Lansia)</option>
                        <option value="pendidikan">Rekap Pendidikan</option>
                        <option value="pekerjaan">Rekap Pekerjaan</option>
                        <option value="statusPerkawinan">Rekap Status Perkawinan</option>
                        <option value="agama">Rekap Agama</option>
                        <option value="hubunganKeluarga">Rekap Hubungan Keluarga</option>
                    </select>
                    <span id="mk-statistik-total-baris" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Kategori
                    </span>
                </div>
                <div class="w-full sm:w-72">
                    <input
                        type="text"
                        id="mk-statistik-search"
                        placeholder="Cari kategori statistik..."
                        class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                </div>
            </div>

            <!-- Tabel Rekapitulasi -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        <tr>
                            <th id="mk-statistik-col-label" class="px-4 py-3">Kategori</th>
                            <th class="px-4 py-3 text-right">Jumlah Warga</th>
                            <th class="px-4 py-3 text-right">Persentase</th>
                            <th class="px-4 py-3 w-48">Proporsi</th>
                        </tr>
                    </thead>
                    <tbody id="mk-statistik-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr>
                            <td colspan="4" class="p-8 text-center text-stone-500 dark:text-stone-400">
                                Memuat data statistik kependudukan...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenKependudukanStatistikHandler() {
    let rawWargaItems = [];
    let rawLogItems = [];
    let rawEvents = {
        statistik: [],
        kelahiran: [],
        kematian: [],
        mutasi: [],
        sensus: []
    };
    let isDestroyed = false;
    let feedbackTimerId = null;

    const refreshBtn = document.getElementById("mk-statistik-refresh-btn");
    const feedbackEl = document.getElementById("mk-statistik-feedback");
    const tanggalAkhirEl = document.getElementById("mk-statistik-tanggal-akhir");
    const resetTglBtn = document.getElementById("mk-statistik-reset-tgl-btn");
    const infoTanggalEl = document.getElementById("mk-statistik-info-tanggal");
    const totalWargaEl = document.getElementById("mk-stat-total-warga");
    const subKkEl = document.getElementById("mk-stat-sub-kk");
    const lakiEl = document.getElementById("mk-stat-laki");
    const lakiPctEl = document.getElementById("mk-stat-laki-pct");
    const perempuanEl = document.getElementById("mk-stat-perempuan");
    const perempuanPctEl = document.getElementById("mk-stat-perempuan-pct");
    const peristiwaTotalEl = document.getElementById("mk-stat-peristiwa-total");
    const peristiwaDetailEl = document.getElementById("mk-stat-peristiwa-detail");
    const usiaGridEl = document.getElementById("mk-stat-usia-grid");
    const usiaCatatanEl = document.getElementById("mk-stat-usia-catatan");
    const kategoriSelectEl = document.getElementById("mk-statistik-kategori");
    const totalBarisEl = document.getElementById("mk-statistik-total-baris");
    const searchEl = document.getElementById("mk-statistik-search");
    const colLabelEl = document.getElementById("mk-statistik-col-label");
    const tbodyEl = document.getElementById("mk-statistik-tbody");

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

    function getActiveTanggalAkhir() {
        return toDateInputValue(tanggalAkhirEl?.value) || getTodayDateString();
    }

    function getFilteredWargaAsOfDate() {
        const refDate = getActiveTanggalAkhir();
        return buildWargaSnapshotAsOfDate(rawWargaItems, rawLogItems, refDate);
    }

    function renderSummary(wargaAsOfDate) {
        const refDate = getActiveTanggalAkhir();
        if (infoTanggalEl) {
            infoTanggalEl.textContent = `Posisi data per: ${formatTanggalDisplay(refDate)}`;
        }

        const total = wargaAsOfDate.length;
        const kkSet = new Set(
            wargaAsOfDate.map((w) => String(w.noKk || "").trim()).filter(Boolean)
        );
        const laki = wargaAsOfDate.filter((w) =>
            String(w.jenisKelamin || "").trim().toLowerCase().startsWith("laki")
        ).length;
        const perempuan = wargaAsOfDate.filter((w) =>
            String(w.jenisKelamin || "").trim().toLowerCase().startsWith("perempuan")
        ).length;

        if (totalWargaEl) totalWargaEl.textContent = String(total);
        if (subKkEl) subKkEl.textContent = `${kkSet.size} No. KK`;

        if (lakiEl) lakiEl.textContent = String(laki);
        if (lakiPctEl) {
            const pctL = total > 0 ? ((laki / total) * 100).toFixed(1) : "0.0";
            lakiPctEl.textContent = `${pctL}% dari warga`;
        }

        if (perempuanEl) perempuanEl.textContent = String(perempuan);
        if (perempuanPctEl) {
            const pctP = total > 0 ? ((perempuan / total) * 100).toFixed(1) : "0.0";
            perempuanPctEl.textContent = `${pctP}% dari warga`;
        }

        const lahirCount = rawEvents.kelahiran.filter((r) => getEffectiveDateString(r) <= refDate).length;
        const matiCount = rawEvents.kematian.filter((r) => getEffectiveDateString(r) <= refDate).length;
        const mutasiCount = rawEvents.mutasi.filter((r) => getEffectiveDateString(r) <= refDate).length;
        const sensusCount = rawEvents.sensus.filter((r) => getEffectiveDateString(r) <= refDate).length;

        const totalEvents = lahirCount + matiCount + mutasiCount + sensusCount;
        if (peristiwaTotalEl) peristiwaTotalEl.textContent = String(totalEvents);
        if (peristiwaDetailEl) {
            peristiwaDetailEl.textContent = `Lahir: ${lahirCount} • Wafat: ${matiCount} • Mutasi: ${mutasiCount} • Sensus: ${sensusCount}`;
        }
    }

    function renderAgeComparison(wargaAsOfDate) {
        if (!usiaGridEl || isDestroyed) return;
        const refDate = getActiveTanggalAkhir();
        const ageComp = buildAgeComparison(wargaAsOfDate, refDate);

        if (usiaCatatanEl) {
            const extra =
                ageComp.belumTercatat > 0
                    ? ` • ${ageComp.belumTercatat} warga (${ageComp.belumPersen}%) belum tercatat tanggal lahir.`
                    : "";
            usiaCatatanEl.textContent = `Usia dihitung per ${formatTanggalDisplay(refDate)} (Anak: 0–11 thn, Remaja: 12–17 thn, Dewasa: 18–59 thn, Lansia: 60+ thn)${extra}`;
        }

        usiaGridEl.innerHTML = ageComp.items
            .map((item) => {
                const pctNum = Math.min(100, Math.max(0, Number(item.persen) || 0));
                return `
                    <div class="bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-none p-3.5 space-y-2">
                        <div class="flex items-baseline justify-between gap-2">
                            <div>
                                <div class="text-xs font-bold text-stone-900 dark:text-stone-100">${escapeHtml(item.label)}</div>
                                <div class="text-[11px] font-mono text-stone-500 dark:text-stone-400">${escapeHtml(item.range)}</div>
                            </div>
                            <div class="text-right">
                                <span class="text-base font-bold text-stone-900 dark:text-stone-100">${escapeHtml(String(item.count))}</span>
                                <span class="text-[11px] font-mono text-stone-500 dark:text-stone-400 ml-1">(${escapeHtml(item.persen)}%)</span>
                            </div>
                        </div>
                        <div class="w-full h-2 bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-none overflow-hidden">
                            <div class="h-full bg-[#5c6d4e]" style="width: ${pctNum}%"></div>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    function renderBreakdownTable(wargaAsOfDate) {
        if (!tbodyEl || isDestroyed) return;
        const refDate = getActiveTanggalAkhir();
        const mode = String(kategoriSelectEl?.value || "jenisKelamin");
        const selectedOptionText =
            kategoriSelectEl?.selectedOptions?.[0]?.textContent?.replace(/^Rekap\s+/i, "") || "Kategori";
        if (colLabelEl) colLabelEl.textContent = selectedOptionText;

        const keyword = String(searchEl?.value || "").trim().toLowerCase();
        const allRows = buildBreakdown(wargaAsOfDate, mode, refDate);
        const rows = keyword
            ? allRows.filter((r) => String(r.label || "").toLowerCase().includes(keyword))
            : allRows;

        if (totalBarisEl) totalBarisEl.textContent = `${rows.length} Kategori`;

        if (!rows.length) {
            tbodyEl.innerHTML = `
                <tr>
                    <td colspan="4" class="p-8 text-center text-stone-500 dark:text-stone-400">
                        Belum ada data warga untuk direkapitulasi pada tanggal ini.
                    </td>
                </tr>
            `;
            return;
        }

        tbodyEl.innerHTML = rows
            .map((row) => {
                const pctNum = Math.min(100, Math.max(0, Number(row.persen) || 0));
                return `
                    <tr>
                        <td class="px-4 py-3 font-semibold">${escapeHtml(row.label)}</td>
                        <td class="px-4 py-3 text-right font-mono">${escapeHtml(String(row.jumlah))}</td>
                        <td class="px-4 py-3 text-right font-mono">${escapeHtml(row.persen)}%</td>
                        <td class="px-4 py-3">
                            <div class="w-full h-2.5 bg-[#f6f3ec] dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-none overflow-hidden">
                                <div class="h-full bg-[#5c6d4e]" style="width: ${pctNum}%"></div>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    function refreshAllViews() {
        const wargaAsOfDate = getFilteredWargaAsOfDate();
        renderSummary(wargaAsOfDate);
        renderAgeComparison(wargaAsOfDate);
        renderBreakdownTable(wargaAsOfDate);
    }

    async function loadData(showToast = false) {
        try {
            const [wargaSnap, logSnap, statSnap, lahirSnap, matiSnap, mutasiSnap, sensusSnap] = await Promise.all([
                getDocs(collection(db, WARGA_COLLECTION_NAME)),
                getDocs(collection(db, WARGA_LOG_COLLECTION_NAME)).catch(() => null),
                getDocs(collection(db, COLLECTION_NAME)).catch(() => null),
                getDocs(collection(db, KELAHIRAN_COLLECTION_NAME)).catch(() => null),
                getDocs(collection(db, KEMATIAN_COLLECTION_NAME)).catch(() => null),
                getDocs(collection(db, MUTASI_COLLECTION_NAME)).catch(() => null),
                getDocs(collection(db, SENSUS_COLLECTION_NAME)).catch(() => null)
            ]);

            if (isDestroyed) return;

            const wList = [];
            wargaSnap.forEach((docSnap) => wList.push({ id: docSnap.id, ...docSnap.data() }));
            rawWargaItems = wList;

            const lList = [];
            if (logSnap) {
                logSnap.forEach((docSnap) => lList.push({ id: docSnap.id, ...docSnap.data() }));
            }
            rawLogItems = lList;

            const readDocs = (snap) => {
                const arr = [];
                if (snap) snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
                return arr;
            };

            rawEvents = {
                statistik: readDocs(statSnap),
                kelahiran: readDocs(lahirSnap),
                kematian: readDocs(matiSnap),
                mutasi: readDocs(mutasiSnap),
                sensus: readDocs(sensusSnap)
            };

            refreshAllViews();
            if (showToast) showFeedback("Data statistik berhasil diperbarui.");
        } catch (err) {
            console.error("Gagal memuat data statistik kependudukan:", err);
            showFeedback("Gagal memuat data statistik kependudukan.", "error");
        }
    }

    const onRefresh = () => loadData(true);
    const onResetTanggal = () => {
        if (tanggalAkhirEl) tanggalAkhirEl.value = getTodayDateString();
        refreshAllViews();
    };

    refreshBtn?.addEventListener("click", onRefresh);
    tanggalAkhirEl?.addEventListener("change", refreshAllViews);
    resetTglBtn?.addEventListener("click", onResetTanggal);
    kategoriSelectEl?.addEventListener("change", refreshAllViews);
    searchEl?.addEventListener("input", refreshAllViews);

    refreshAllViews();
    loadData(false);

    return () => {
        isDestroyed = true;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        refreshBtn?.removeEventListener("click", onRefresh);
        tanggalAkhirEl?.removeEventListener("change", refreshAllViews);
        resetTglBtn?.removeEventListener("click", onResetTanggal);
        kategoriSelectEl?.removeEventListener("change", refreshAllViews);
        searchEl?.removeEventListener("input", refreshAllViews);
    };
}

export default renderManajemenKependudukanStatistik;