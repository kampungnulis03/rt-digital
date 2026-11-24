// File: assets/js/views/manajemen-kependudukan-warga.js
import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const WARGA_COLLECTION = "warga";
const WARGA_LOG_COLLECTION = "warga_log";
const PROFIL_DOC_REF = doc(db, "pengaturan", "profil_perusahaan");
const FEEDBACK_AUTO_HIDE_MS = 3500;
const MODAL_TRANSITION_MS = 180;
const XLSX_CDN_URL = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
const JENIS_INPUT_OPTIONS = ["Data awal", "KK Baru"];

const GOLONGAN_DARAH_OPTIONS = [
    "Tidak Tahu",
    "A",
    "B",
    "AB",
    "O",
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
    "O+",
    "O-"
];

const STATUS_SOSIAL_OPTIONS = [
    { value: "Ronda", label: "Ronda / Siskamling" },
    { value: "Bantuan Sosial", label: "Bantuan Sosial" },
    { value: "Rapat", label: "Rapat Warga" },
    { value: "Kerja Bakti", label: "Kerja Bakti" },
    { value: "PKK / Dasawisma", label: "PKK / Dasawisma" },
    { value: "Karang Taruna", label: "Karang Taruna" },
    { value: "Iuran Wajib RT", label: "Iuran Wajib RT" },
    { value: "Lansia / Prioritas", label: "Lansia / Prioritas" }
];

const EXCEL_TEMPLATE_COLUMNS = [
    { key: "jenisInput", header: "Jenis_Input", width: 14, note: "Isi: Data awal atau KK Baru (default: Data awal)" },
    { key: "tanggalDikeluarkan", header: "Tanggal_Dikeluarkan_KK", width: 22, note: "Format: YYYY-MM-DD (Contoh: 2024-05-15)" },
    { key: "tanggalBerlakuPerubahan", header: "Tanggal_Berlaku", width: 18, note: "Format: YYYY-MM-DD (Kosongkan jika sama dgn Tgl KK)" },
    { key: "noKk", header: "No_KK", width: 20, note: "16 digit Nomor Kartu Keluarga" },
    { key: "kepalaKeluarga", header: "Kepala_Keluarga", width: 24, note: "Nama Kepala Keluarga sesuai KK" },
    { key: "nik", header: "NIK", width: 20, note: "WAJIB DIISI. 16 digit NIK / NIKS (Kunci unik update)" },
    { key: "nama", header: "Nama_Lengkap", width: 26, note: "WAJIB DIISI. Nama lengkap warga sesuai KK" },
    { key: "jenisKelamin", header: "Jenis_Kelamin", width: 15, note: "Isi: Laki-laki atau Perempuan (bisa L / P)" },
    { key: "golonganDarah", header: "Golongan_Darah", width: 16, note: "Pilihan: Tidak Tahu, A, B, AB, O, A+, A-, B+, B-, AB+, AB-, O+, O-" },
    { key: "tempatLahir", header: "Tempat_Lahir", width: 18, note: "Kabupaten / Kota tempat lahir" },
    { key: "tanggalLahir", header: "Tanggal_Lahir", width: 16, note: "Format: YYYY-MM-DD (Contoh: 1985-11-27)" },
    { key: "agama", header: "Agama", width: 16, note: "Islam, Kristen, Katolik, Hindu, Buddha, Konghucu, Kepercayaan Terhadap Tuhan YME" },
    { key: "pendidikan", header: "Pendidikan", width: 22, note: "Contoh: SLTA / Sederajat, Diploma IV / Strata I" },
    { key: "pekerjaan", header: "Pekerjaan", width: 22, note: "Jenis pekerjaan sesuai KK" },
    { key: "statusPerkawinan", header: "Status_Perkawinan", width: 18, note: "Kawin, Belum Kawin, Cerai Hidup, Cerai Mati" },
    { key: "tanggalPerkawinan", header: "Tanggal_Perkawinan", width: 18, note: "Format: YYYY-MM-DD (Kosongkan jika Belum Kawin)" },
    { key: "hubunganKeluarga", header: "Hubungan_Keluarga", width: 20, note: "Kepala Keluarga, Istri, Anak, Orang Tua, Famili Lain, Lainnya" },
    { key: "kewarganegaraan", header: "Kewarganegaraan", width: 16, note: "WNI atau WNA (default: WNI)" },
    { key: "noPaspor", header: "No_Paspor", width: 15, note: "Isi - jika tidak ada" },
    { key: "noKitas", header: "No_KITAS_KITAP", width: 16, note: "Isi - jika tidak ada" },
    { key: "namaAyah", header: "Nama_Ayah", width: 22, note: "Nama lengkap ayah kandung" },
    { key: "namaIbu", header: "Nama_Ibu", width: 22, note: "Nama lengkap ibu kandung" },
    { key: "statusWarga", header: "Status_Tinggal", width: 16, note: "Tetap, Kontrak / Kost, atau Sementara (default: Tetap)" },
    { key: "alamat", header: "Alamat", width: 28, note: "Dusun / Blok / Jalan / No. Rumah" },
    { key: "rtRw", header: "RT_RW", width: 14, note: "Contoh: 005 / 000" },
    { key: "desaKelurahan", header: "Desa_Kelurahan", width: 20, note: "Nama Desa atau Kelurahan" },
    { key: "kecamatan", header: "Kecamatan", width: 20, note: "Nama Kecamatan" },
    { key: "kabupatenKota", header: "Kabupaten_Kota", width: 20, note: "Nama Kabupaten / Kota" },
    { key: "kodePos", header: "Kode_Pos", width: 12, note: "5 digit Kode Pos" },
    { key: "propinsi", header: "Propinsi", width: 20, note: "Nama Propinsi" },
    { key: "noHp", header: "No_HP_WA", width: 18, note: "Nomor HP / WhatsApp aktif" },
    { key: "email", header: "Email", width: 24, note: "Email individu untuk akses akun" },
    { key: "statusSosial", header: "Status_Sosial", width: 32, note: "Pisahkan dengan koma. Pilihan: Ronda, Bantuan Sosial, Rapat, Kerja Bakti, PKK / Dasawisma, Karang Taruna, Iuran Wajib RT, Lansia / Prioritas" },
    { key: "jenisBansos", header: "Jenis_Bansos", width: 20, note: "Isi jika Status_Sosial memuat Bantuan Sosial (Contoh: PKH, BPNT)" },
    { key: "catatanSosial", header: "Catatan_Sosial", width: 28, note: "Keterangan tambahan peran sosial warga" }
];

let xlsxLoaderPromise = null;

function ensureXlsxLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxLoaderPromise) return xlsxLoaderPromise;

    xlsxLoaderPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${XLSX_CDN_URL}"]`);
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(window.XLSX));
            existingScript.addEventListener("error", () => reject(new Error("Gagal memuat library Excel.")));
            return;
        }

        const script = document.createElement("script");
        script.src = XLSX_CDN_URL;
        script.async = true;
        script.onload = () => {
            if (window.XLSX) resolve(window.XLSX);
            else reject(new Error("Library Excel tidak tersedia setelah dimuat."));
        };
        script.onerror = () => {
            xlsxLoaderPromise = null;
            reject(new Error("Gagal memuat library SheetJS dari CDN."));
        };
        document.head.appendChild(script);
    });

    return xlsxLoaderPromise;
}

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

function normalizeJenisInput(value = "") {
    const val = String(value || "").trim().toLowerCase();
    if (val === "kk baru" || val === "tambah anggota" || val === "anggota masuk") {
        return "KK Baru";
    }
    return "Data awal";
}

function normalizeGolonganDarah(value = "") {
    const raw = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
    if (!raw || raw === "-" || raw === "TIDAKTAHU" || raw === "N/A") {
        return "Tidak Tahu";
    }
    const allowedSet = new Set(GOLONGAN_DARAH_OPTIONS.map((g) => g.toUpperCase()));
    return allowedSet.has(raw) ? raw : "Tidak Tahu";
}

function normalizeStatusSosialList(value) {
    const rawItems = Array.isArray(value)
        ? value
        : String(value ?? "")
            .split(/[,;|]+/)
            .map((v) => v.trim())
            .filter(Boolean);

    const allowedMap = new Map(
        STATUS_SOSIAL_OPTIONS.map((opt) => [opt.value.toLowerCase(), opt.value])
    );
    STATUS_SOSIAL_OPTIONS.forEach((opt) => {
        allowedMap.set(opt.label.toLowerCase(), opt.value);
    });

    const unique = [];
    rawItems.forEach((item) => {
        const clean = String(item ?? "").trim();
        const canonical = allowedMap.get(clean.toLowerCase());
        if (canonical && !unique.includes(canonical)) {
            unique.push(canonical);
        }
    });
    return unique;
}

function normalizeJenisKelamin(value = "") {
    const v = String(value ?? "").trim().toLowerCase();
    if (v === "p" || v === "perempuan" || v === "wanita" || v === "female") {
        return "Perempuan";
    }
    return "Laki-laki";
}

function normalizeStatusWarga(value = "") {
    const v = String(value ?? "").trim().toLowerCase();
    if (v.includes("kontrak") || v.includes("kost") || v.includes("kos")) {
        return "Kontrak / Kost";
    }
    if (v.includes("sementara")) {
        return "Sementara";
    }
    return "Tetap";
}

function normalizeAgama(value = "") {
    const v = String(value ?? "").trim().toLowerCase();
    if (!v) return "Islam";
    if (v.includes("kristen") && !v.includes("katolik")) return "Kristen";
    if (v.includes("katolik")) return "Katolik";
    if (v.includes("hindu")) return "Hindu";
    if (v.includes("buddha") || v.includes("budha")) return "Buddha";
    if (v.includes("konghucu") || v.includes("khonghucu")) return "Konghucu";
    if (v.includes("kepercayaan")) return "Kepercayaan Terhadap Tuhan YME";
    return "Islam";
}

function normalizeStatusPerkawinan(value = "") {
    const v = String(value ?? "").trim().toLowerCase();
    if (v.includes("belum")) return "Belum Kawin";
    if (v.includes("cerai hidup")) return "Cerai Hidup";
    if (v.includes("cerai mati")) return "Cerai Mati";
    return "Kawin";
}

function normalizeHubunganKeluarga(value = "") {
    const v = String(value ?? "").trim().toLowerCase();
    if (!v || v.includes("kepala")) return "Kepala Keluarga";
    if (v.includes("istri")) return "Istri";
    if (v.includes("anak")) return "Anak";
    if (v.includes("orang tua") || v.includes("ortu")) return "Orang Tua";
    if (v.includes("famili")) return "Famili Lain";
    return "Lainnya";
}

function normalizeKewarganegaraan(value = "") {
    const v = String(value ?? "").trim().toUpperCase();
    return v === "WNA" ? "WNA" : "WNI";
}

function cleanDigitIdentifier(value = "") {
    if (value === null || value === undefined) return "";
    let str = String(value).trim();
    if (!str) return "";
    if (/^'/.test(str)) str = str.slice(1).trim();
    if (/^\d+(\.\d+)?e\+\d+$/i.test(str)) {
        const num = Number(str);
        if (!Number.isNaN(num)) {
            str = num.toLocaleString("fullwide", { useGrouping: false });
        }
    }
    return str.replace(/\.0+$/, "").trim();
}

function toDateInputValue(value = "") {
    if (value === null || value === undefined || value === "") return "";

    if (typeof value === "number" && Number.isFinite(value) && value > 1000 && value < 100000) {
        const utcDays = Math.floor(value - 25569);
        const dateObj = new Date(utcDays * 86400 * 1000);
        if (!Number.isNaN(dateObj.getTime())) {
            const y = dateObj.getUTCFullYear();
            const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
            const d = String(dateObj.getUTCDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        }
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);

    const ymdSlash = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdSlash) {
        return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, "0")}-${ymdSlash[3].padStart(2, "0")}`;
    }

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

function getTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function getEffectiveDateString(item = {}) {
    return (
        toDateInputValue(item.tanggalBerlakuPerubahan) ||
        toDateInputValue(item.tanggalDikeluarkan) ||
        toDateInputValue(item.logAt) ||
        toDateInputValue(item.updatedAt) ||
        toDateInputValue(item.createdAt) ||
        ""
    );
}

function getEffectiveTimestampMs(item = {}) {
    const effDate = toDateInputValue(item.tanggalBerlakuPerubahan) || toDateInputValue(item.tanggalDikeluarkan);
    if (effDate) {
        const logIso = String(item.logAt || item.updatedAt || item.createdAt || "").trim();
        const timePart = logIso.includes("T") ? logIso.slice(11) : "12:00:00.000Z";
        const ms = new Date(`${effDate}T${timePart}`).getTime();
        if (!Number.isNaN(ms)) return ms;
        return new Date(`${effDate}T23:59:59.999`).getTime();
    }

    const fallbackIso = item.logAt || item.updatedAt || item.createdAt || "";
    const fallbackMs = new Date(fallbackIso).getTime();
    if (!Number.isNaN(fallbackMs) && fallbackMs > 0) return fallbackMs;

    return 0;
}

function buildRtRwFromProfile(data = {}) {
    const combined = String(data.rt_rw || data.rtRw || "").trim();
    if (combined) return combined;

    const rt = String(data.rt ?? "").trim();
    const rw = String(data.rw ?? "").trim();
    if (!rt && !rw) return "";
    return `${rt || "00"} / ${rw || "00"}`;
}

function formatDateIndonesian(dateStr = "") {
    const raw = toDateInputValue(dateStr) || String(dateStr || "").trim();
    if (!raw) return "-";
    const parts = raw.split("-");
    if (parts.length !== 3) return raw;
    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIdx < 0 || monthIdx > 11 || Number.isNaN(day)) return raw;
    return `${day} ${months[monthIdx]} ${year}`;
}

function formatTimestampShort(isoStr = "") {
    const raw = String(isoStr || "").trim();
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

async function writeWargaAuditLog({ wargaId, aksiLog, snapshotData, keteranganPerubahan = "" }) {
    const actorEmail = String(localStorage.getItem("user_email") || "").trim();
    const actorRole = String(localStorage.getItem("user_role") || "").trim();
    const nowIso = new Date().toISOString();

    const { id, _timeMs, _fromBaseline, ...cleanSnapshot } = snapshotData || {};
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

function reconstructWargaAtDate(allLogs = [], currentWargaList = [], targetDateStr = "") {
    const rawDate = toDateInputValue(targetDateStr);
    if (!rawDate) return [];

    const endOfDayMs = new Date(`${rawDate}T23:59:59.999`).getTime();
    if (Number.isNaN(endOfDayMs)) return [];

    const loggedWargaIds = new Set();
    allLogs.forEach((item) => {
        const wId = String(item.wargaId || "").trim();
        if (wId) loggedWargaIds.add(wId);
    });

    const combinedEntries = [...allLogs];
    currentWargaList.forEach((wargaItem) => {
        const wId = String(wargaItem.id || "").trim();
        if (!wId || loggedWargaIds.has(wId)) return;

        const baselineEffectiveDate =
            toDateInputValue(wargaItem.tanggalBerlakuPerubahan) ||
            toDateInputValue(wargaItem.tanggalDikeluarkan) ||
            toDateInputValue(wargaItem.createdAt) ||
            "1970-01-01";

        combinedEntries.push({
            ...wargaItem,
            wargaId: wId,
            tanggalBerlakuPerubahan: baselineEffectiveDate,
            aksiLog: "DATA_EKSISTING",
            logAt: wargaItem.createdAt || `${baselineEffectiveDate}T00:00:00.000Z`,
            _fromBaseline: true
        });
    });

    const latestByWarga = new Map();

    combinedEntries.forEach((entry) => {
        const entryTimeMs = getEffectiveTimestampMs(entry);
        if (entryTimeMs > endOfDayMs) return;

        const key = String(entry.wargaId || entry.nik || entry.id || "").trim();
        if (!key) return;

        const prev = latestByWarga.get(key);
        if (!prev || entryTimeMs >= prev._timeMs) {
            latestByWarga.set(key, {
                ...entry,
                id: String(entry.wargaId || entry.id || key),
                _timeMs: entryTimeMs
            });
        }
    });

    return Array.from(latestByWarga.values())
        .filter((item) => String(item.aksiLog || "").toUpperCase() !== "HAPUS")
        .sort((a, b) =>
            String(a.nama || "").localeCompare(String(b.nama || ""), "id", { sensitivity: "base" })
        );
}

export function renderManajemenKependudukanWarga() {
    const golonganDarahOptionsHtml = GOLONGAN_DARAH_OPTIONS.map(
        (gol) => `<option value="${escapeHtml(gol)}">${escapeHtml(gol)}</option>`
    ).join("");

    const filterGolonganDarahOptionsHtml = GOLONGAN_DARAH_OPTIONS.map(
        (gol) => `<option value="${escapeHtml(gol)}">${escapeHtml(gol)}</option>`
    ).join("");

    const statusSosialCheckboxesHtml = STATUS_SOSIAL_OPTIONS.map(
        (opt) => `
            <label class="flex items-center gap-2.5 px-3 py-2 bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none cursor-pointer hover:border-[#c87d32] transition select-none">
                <input
                    type="checkbox"
                    name="mkw-status-sosial"
                    value="${escapeHtml(opt.value)}"
                    class="w-4 h-4 accent-[#5c6d4e] rounded-none cursor-pointer"
                >
                <span class="text-xs font-medium text-stone-800 dark:text-stone-200">${escapeHtml(opt.label)}</span>
            </label>
        `
    ).join("");

    const filterStatusSosialOptionsHtml = STATUS_SOSIAL_OPTIONS.map(
        (opt) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`
    ).join("");

    return `
        <div id="mkw-root" class="space-y-4">
            <!-- Header Sub-Halaman Warga -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Manajemen Kependudukan • Data Warga (Format KK)
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Kelola data warga sesuai format Kartu Keluarga, golongan darah, tanggal perkawinan, status sosial lingkungan, impor/ekspor master Excel, dan riwayat log per tanggal.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        id="mkw-download-master-btn"
                        class="hidden inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition cursor-pointer"
                    >
                        <span>↓ Master Excel</span>
                    </button>
                    <button
                        type="button"
                        id="mkw-open-upload-btn"
                        class="hidden inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-none text-xs font-semibold border border-[#5c6d4e] bg-[#f6f3ec] dark:bg-stone-800 text-[#5c6d4e] dark:text-emerald-400 hover:bg-[#5c6d4e] hover:text-white transition cursor-pointer"
                    >
                        <span>↑ Upload Excel</span>
                    </button>
                    <button
                        type="button"
                        id="mkw-toggle-form-btn"
                        class="hidden inline-flex items-center justify-center gap-2 px-4 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <span>+ Tambah Warga</span>
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

            <!-- Notifikasi Pojok Kanan Atas (Auto-Hide) -->
            <div id="mkw-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200"></div>

            <!-- Modal Upload Excel Warga -->
            <div
                id="mkw-upload-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mkw-upload-title"
                class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55"
            >
                <div class="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#faf8f3] dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none shadow-2xl">
                    <div class="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                        <div>
                            <h2 id="mkw-upload-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                                UPLOAD DATA WARGA VIA EXCEL (.XLSX / .XLS / .CSV)
                            </h2>
                            <p class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                                Gunakan template Master Excel agar nama kolom terbaca otomatis. NIK yang sudah ada akan diperbarui (Update), NIK baru akan ditambahkan.
                            </p>
                        </div>
                        <button
                            type="button"
                            id="mkw-upload-close-btn"
                            aria-label="Tutup modal upload"
                            class="px-2.5 py-1 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 rounded-none transition cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    <div class="p-5 overflow-y-auto space-y-4 text-xs">
                        <div class="bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div class="space-y-1 flex-1">
                                <label for="mkw-excel-file-input" class="block font-bold text-stone-800 dark:text-stone-200">
                                    Pilih File Excel Data Warga
                                </label>
                                <input
                                    type="file"
                                    id="mkw-excel-file-input"
                                    accept=".xlsx,.xls,.csv"
                                    class="block w-full text-xs text-stone-700 dark:text-stone-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-none file:border file:border-stone-300 dark:file:border-stone-700 file:text-xs file:font-semibold file:bg-[#faf8f3] dark:file:bg-stone-800 file:text-stone-800 dark:file:text-stone-200 hover:file:border-[#c87d32] cursor-pointer"
                                >
                            </div>
                            <button
                                type="button"
                                id="mkw-modal-download-master-btn"
                                class="self-start sm:self-end px-3.5 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] rounded-none transition cursor-pointer whitespace-nowrap"
                            >
                                ↓ Unduh Template Master
                            </button>
                        </div>

                        <!-- Ringkasan Hasil Parsing Excel -->
                        <div id="mkw-upload-summary" class="hidden grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div class="bg-[#f6f3ec] dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-3 rounded-none">
                                <div class="text-[10px] font-bold uppercase text-stone-500">Total Baris Dibaca</div>
                                <div id="mkw-up-stat-total" class="text-base font-bold text-stone-900 dark:text-stone-100 mt-0.5">0</div>
                            </div>
                            <div class="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 rounded-none">
                                <div class="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Data Baru</div>
                                <div id="mkw-up-stat-new" class="text-base font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">0</div>
                            </div>
                            <div class="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-none">
                                <div class="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Update (NIK Sama)</div>
                                <div id="mkw-up-stat-update" class="text-base font-bold text-amber-800 dark:text-amber-300 mt-0.5">0</div>
                            </div>
                            <div class="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3 rounded-none">
                                <div class="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">Baris Tidak Valid</div>
                                <div id="mkw-up-stat-invalid" class="text-base font-bold text-rose-800 dark:text-rose-300 mt-0.5">0</div>
                            </div>
                        </div>

                        <!-- Tabel Pratinjau Data Excel -->
                        <div id="mkw-upload-preview-wrap" class="hidden border border-stone-200 dark:border-stone-800 overflow-x-auto max-h-72">
                            <table class="w-full text-left border-collapse">
                                <thead class="bg-[#f6f3ec] dark:bg-stone-950 border-b border-stone-200 dark:border-stone-800 text-[10px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 sticky top-0">
                                    <tr>
                                        <th class="px-3 py-2">Baris</th>
                                        <th class="px-3 py-2">Status</th>
                                        <th class="px-3 py-2">NIK</th>
                                        <th class="px-3 py-2">No. KK</th>
                                        <th class="px-3 py-2">Nama Lengkap</th>
                                        <th class="px-3 py-2">L/P &amp; Gol. Darah</th>
                                        <th class="px-3 py-2">Hubungan</th>
                                        <th class="px-3 py-2">Keterangan Validasi</th>
                                    </tr>
                                </thead>
                                <tbody id="mkw-upload-preview-body" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-[11px] text-stone-800 dark:text-stone-200">
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="px-5 py-3.5 bg-[#f6f3ec] dark:bg-stone-950/60 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
                        <div id="mkw-upload-progress-text" class="text-[11px] font-medium text-stone-600 dark:text-stone-400">
                            Pilih file Excel untuk melihat pratinjau data sebelum disimpan.
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                id="mkw-upload-cancel-btn"
                                class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                id="mkw-upload-import-btn"
                                disabled
                                class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Proses &amp; Simpan ke Database
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Konfirmasi Hapus Warga (Smooth) -->
            <div
                id="mkw-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mkw-confirm-title"
                class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/0 opacity-0 transition-opacity duration-200 ease-out"
            >
                <div
                    id="mkw-confirm-card"
                    class="w-full max-w-md bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none shadow-2xl transform scale-95 opacity-0 transition-all duration-200 ease-out"
                >
                    <div class="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                        <h2 id="mkw-confirm-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                            KONFIRMASI HAPUS DATA WARGA
                        </h2>
                        <button
                            type="button"
                            id="mkw-confirm-close-btn"
                            aria-label="Tutup konfirmasi"
                            class="px-2 py-1 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 rounded-none transition cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                    <div class="p-5 space-y-3 text-xs text-stone-700 dark:text-stone-300">
                        <p class="leading-relaxed">
                            Apakah Anda yakin ingin menghapus data warga berikut? Riwayat perubahan tetap tersimpan di log.
                        </p>
                        <div class="bg-[#f6f3ec] dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-none p-3 space-y-1">
                            <div id="mkw-confirm-nama" class="font-bold text-stone-900 dark:text-stone-100">-</div>
                            <div id="mkw-confirm-nik" class="font-mono text-[11px] text-stone-500 dark:text-stone-400">NIK: -</div>
                        </div>
                    </div>
                    <div class="px-5 py-3.5 bg-[#f6f3ec] dark:bg-stone-950/60 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            id="mkw-confirm-cancel-btn"
                            class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#faf8f3] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            id="mkw-confirm-ok-btn"
                            class="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-none transition cursor-pointer disabled:opacity-60"
                        >
                            Ya, Hapus
                        </button>
                    </div>
                </div>
            </div>

            <!-- Banner Mode Histori / Snapshot Tanggal -->
            <div id="mkw-snapshot-banner" class="hidden bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-none px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div class="text-amber-900 dark:text-amber-200">
                    <span class="font-bold uppercase tracking-wider">Mode Arsip / Log Histori:</span>
                    Menampilkan posisi data warga per tanggal berlaku <strong id="mkw-snapshot-date-label">-</strong>. Edit &amp; hapus dinonaktifkan selama melihat posisi masa lalu.
                </div>
                <button
                    type="button"
                    id="mkw-exit-snapshot-btn"
                    class="self-start sm:self-auto px-3 py-1.5 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-none transition cursor-pointer whitespace-nowrap"
                >
                    Kembali ke Data Saat Ini
                </button>
            </div>

            <!-- Ringkasan Statistik Warga -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Warga</div>
                    <div id="mkw-stat-total" class="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Warga Tetap</div>
                    <div id="mkw-stat-tetap" class="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Kontrak / Kost</div>
                    <div id="mkw-stat-kontrak" class="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0</div>
                </div>
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Sementara</div>
                    <div id="mkw-stat-sementara" class="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1">0</div>
                </div>
            </div>

            <!-- Form Tambah / Edit Warga (Format Kartu Keluarga) -->
            <div id="mkw-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="mkw-form" class="space-y-6">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h2 id="mkw-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            TAMBAH DATA WARGA
                        </h2>
                        <button
                            type="button"
                            id="mkw-cancel-form-btn"
                            class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                        >
                            Tutup Form
                        </button>
                    </div>

                    <input type="hidden" id="mkw-edit-id" value="">

                    <!-- Blok A: Awal Form — Jenis Input, Tanggal KK, Tanggal Berlaku, Kepala Keluarga & Wilayah -->
                    <div class="space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-[#5c6d4e] dark:text-emerald-400">
                                A. Jenis Input, Tanggal KK, Kepala Keluarga &amp; Wilayah
                            </div>
                            <span id="mkw-wilayah-source-hint" class="text-[11px] text-stone-500 dark:text-stone-400">
                                Wilayah otomatis terisi dari pengaturan profil atau No. KK eksisting
                            </span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="mkw-jenis-input" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Jenis Input
                                </label>
                                <select
                                    id="mkw-jenis-input"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    <option value="Data awal">Data awal</option>
                                    <option value="KK Baru">KK Baru</option>
                                </select>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label for="mkw-tanggal-dikeluarkan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Tanggal Dikeluarkan (KK)
                                    </label>
                                    <input
                                        type="date"
                                        id="mkw-tanggal-dikeluarkan"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                    <p id="mkw-tgl-dikeluarkan-hint" class="hidden text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                                        Tetap saat mode edit; acuan log memakai Tanggal Berlaku Perubahan.
                                    </p>
                                </div>

                                <div>
                                    <label for="mkw-tanggal-berlaku-perubahan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                        Tanggal Berlaku Perubahan
                                    </label>
                                    <input
                                        type="date"
                                        id="mkw-tanggal-berlaku-perubahan"
                                        class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                    >
                                    <p class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                                        Entri baru otomatis mengikuti Tanggal Dikeluarkan (atau kosong jika belum diisi); saat edit sesuaikan tgl perubahan.
                                    </p>
                                </div>
                            </div>

                            <div id="mkw-keterangan-perubahan-wrap" class="hidden md:col-span-2">
                                <label for="mkw-keterangan-perubahan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Keterangan Perubahan (Opsional)
                                </label>
                                <input
                                    type="text"
                                    id="mkw-keterangan-perubahan"
                                    placeholder="Contoh: Menikah, mutasi KK, pindah alamat, atau koreksi data"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                <p class="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                                    Dicatat ke log perubahan agar alasan pembaruan data mudah ditelusuri.
                                </p>
                            </div>

                            <div>
                                <label for="mkw-no-kk" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    No. KK
                                </label>
                                <input
                                    type="text"
                                    id="mkw-no-kk"
                                    list="mkw-existing-kk-list"
                                    maxlength="20"
                                    placeholder="16 digit No. KK (ketik/pilih KK lama untuk salin)"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                <datalist id="mkw-existing-kk-list"></datalist>
                                <p id="mkw-kk-autofill-info" class="hidden text-[11px] text-[#5c6d4e] dark:text-emerald-400 mt-1"></p>
                            </div>

                            <div>
                                <label for="mkw-kepala-keluarga" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Nama Kepala Keluarga
                                </label>
                                <input
                                    type="text"
                                    id="mkw-kepala-keluarga"
                                    placeholder="Nama kepala keluarga"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-kecamatan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Kecamatan
                                </label>
                                <input
                                    type="text"
                                    id="mkw-kecamatan"
                                    placeholder="Nama kecamatan"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-alamat" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Alamat
                                </label>
                                <input
                                    type="text"
                                    id="mkw-alamat"
                                    placeholder="Dusun / Blok / Jalan / No. Rumah"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-kabupaten-kota" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Kabupaten / Kota
                                </label>
                                <input
                                    type="text"
                                    id="mkw-kabupaten-kota"
                                    placeholder="Nama kabupaten atau kota"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-rt-rw" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    RT / RW
                                </label>
                                <input
                                    type="text"
                                    id="mkw-rt-rw"
                                    placeholder="Contoh: 005 / 000"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-kode-pos" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Kode Pos
                                </label>
                                <input
                                    type="text"
                                    id="mkw-kode-pos"
                                    maxlength="10"
                                    placeholder="Contoh: 55753"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-desa-kelurahan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Desa / Kelurahan
                                </label>
                                <input
                                    type="text"
                                    id="mkw-desa-kelurahan"
                                    placeholder="Contoh: Srihardono"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-propinsi" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Propinsi
                                </label>
                                <input
                                    type="text"
                                    id="mkw-propinsi"
                                    placeholder="Nama propinsi"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-status-warga" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Status Tinggal
                                </label>
                                <select
                                    id="mkw-status-warga"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    <option value="Tetap">Tetap</option>
                                    <option value="Kontrak / Kost">Kontrak / Kost</option>
                                    <option value="Sementara">Sementara</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Blok B: Biodata Individu (Kolom 2 - 9 Format KK & Golongan Darah) -->
                    <div class="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <div class="text-[11px] font-bold uppercase tracking-wider text-[#5c6d4e] dark:text-emerald-400">
                            B. Biodata Individu (Format KK Kolom 2 – 9 &amp; Golongan Darah)
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label for="mkw-nama" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Nama Lengkap <span class="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="mkw-nama"
                                    required
                                    placeholder="Nama lengkap sesuai KK"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-nik" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    NIK / NIKS <span class="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="mkw-nik"
                                    required
                                    maxlength="20"
                                    placeholder="16 digit NIK / NIKS"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-jk" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Jenis Kelamin
                                </label>
                                <select
                                    id="mkw-jk"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    <option value="Laki-laki">Laki-laki (L)</option>
                                    <option value="Perempuan">Perempuan (P)</option>
                                </select>
                            </div>

                            <div>
                                <label for="mkw-golongan-darah" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Golongan Darah
                                </label>
                                <select
                                    id="mkw-golongan-darah"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    ${golonganDarahOptionsHtml}
                                </select>
                            </div>

                            <div>
                                <label for="mkw-tempat-lahir" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Tempat Lahir
                                </label>
                                <input
                                    type="text"
                                    id="mkw-tempat-lahir"
                                    placeholder="Kabupaten / Kota lahir"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-tanggal-lahir" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Tanggal Lahir
                                </label>
                                <input
                                    type="date"
                                    id="mkw-tanggal-lahir"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-agama" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Agama
                                </label>
                                <select
                                    id="mkw-agama"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    <option value="Islam">Islam</option>
                                    <option value="Kristen">Kristen</option>
                                    <option value="Katolik">Katolik</option>
                                    <option value="Hindu">Hindu</option>
                                    <option value="Buddha">Buddha</option>
                                    <option value="Konghucu">Konghucu</option>
                                    <option value="Kepercayaan Terhadap Tuhan YME">Kepercayaan Terhadap Tuhan YME</option>
                                </select>
                            </div>

                            <div>
                                <label for="mkw-pendidikan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Pendidikan
                                </label>
                                <input
                                    type="text"
                                    id="mkw-pendidikan"
                                    placeholder="Contoh: SLTA / Sederajat"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-pekerjaan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Pekerjaan
                                </label>
                                <input
                                    type="text"
                                    id="mkw-pekerjaan"
                                    placeholder="Jenis pekerjaan"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>
                        </div>
                    </div>

                    <!-- Blok C: Status Keluarga, Perkawinan, Imigrasi, Orang Tua & Email Individu -->
                    <div class="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <div class="text-[11px] font-bold uppercase tracking-wider text-[#5c6d4e] dark:text-emerald-400">
                            C. Status Keluarga, Perkawinan, Imigrasi, Orang Tua &amp; Email Individu
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label for="mkw-status-perkawinan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Status Perkawinan
                                </label>
                                <select
                                    id="mkw-status-perkawinan"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    <option value="Kawin">Kawin</option>
                                    <option value="Belum Kawin">Belum Kawin</option>
                                    <option value="Cerai Hidup">Cerai Hidup</option>
                                    <option value="Cerai Mati">Cerai Mati</option>
                                </select>
                            </div>

                            <div>
                                <label for="mkw-tanggal-perkawinan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Tanggal Perkawinan
                                </label>
                                <input
                                    type="date"
                                    id="mkw-tanggal-perkawinan"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-hubungan-keluarga" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Status Hubungan Dalam Keluarga
                                </label>
                                <select
                                    id="mkw-hubungan-keluarga"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    <option value="Kepala Keluarga">Kepala Keluarga</option>
                                    <option value="Istri">Istri</option>
                                    <option value="Anak">Anak</option>
                                    <option value="Orang Tua">Orang Tua</option>
                                    <option value="Famili Lain">Famili Lain</option>
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>

                            <div>
                                <label for="mkw-kewarganegaraan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Kewarganegaraan
                                </label>
                                <select
                                    id="mkw-kewarganegaraan"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    <option value="WNI">WNI</option>
                                    <option value="WNA">WNA</option>
                                </select>
                            </div>

                            <div>
                                <label for="mkw-no-paspor" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    No. Paspor
                                </label>
                                <input
                                    type="text"
                                    id="mkw-no-paspor"
                                    placeholder="-"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-no-kitas" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    No. KITAS / KITAP
                                </label>
                                <input
                                    type="text"
                                    id="mkw-no-kitas"
                                    placeholder="-"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-nama-ayah" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Nama Ayah
                                </label>
                                <input
                                    type="text"
                                    id="mkw-nama-ayah"
                                    placeholder="Nama lengkap ayah kandung"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-nama-ibu" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Nama Ibu
                                </label>
                                <input
                                    type="text"
                                    id="mkw-nama-ibu"
                                    placeholder="Nama lengkap ibu kandung"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div>
                                <label for="mkw-email" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Email (Untuk Akses Akun Individu)
                                </label>
                                <input
                                    type="email"
                                    id="mkw-email"
                                    placeholder="Contoh: warga@domain.id"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>
                        </div>
                    </div>

                    <!-- Blok D: Status Sosial & Partisipasi Lingkungan -->
                    <div class="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-[#5c6d4e] dark:text-emerald-400">
                                D. Status Sosial &amp; Partisipasi Lingkungan
                            </div>
                            <span class="text-[11px] text-stone-500 dark:text-stone-400">
                                Pilih satu atau lebih peran/status sosial warga di lingkungan RT
                            </span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                            ${statusSosialCheckboxesHtml}
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                            <div>
                                <label for="mkw-no-hp" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    No. HP / WhatsApp
                                </label>
                                <input
                                    type="tel"
                                    id="mkw-no-hp"
                                    placeholder="Contoh: 081234567890"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div id="mkw-jenis-bansos-wrap" class="hidden">
                                <label for="mkw-jenis-bansos" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Jenis Bantuan Sosial
                                </label>
                                <input
                                    type="text"
                                    id="mkw-jenis-bansos"
                                    placeholder="Contoh: PKH, BPNT, BLT, Beras Bulog"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>

                            <div id="mkw-catatan-sosial-wrap" class="md:col-span-2">
                                <label for="mkw-catatan-sosial" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Keterangan Status Sosial (Opsional)
                                </label>
                                <input
                                    type="text"
                                    id="mkw-catatan-sosial"
                                    placeholder="Contoh: Regu Ronda Malam Minggu / Bebas ronda karena lansia"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                        <button
                            type="button"
                            id="mkw-cancel-submit-btn"
                            class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] rounded-none transition cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            id="mkw-reset-form-btn"
                            class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                        >
                            Bersihkan
                        </button>
                        <button
                            type="submit"
                            id="mkw-submit-btn"
                            class="px-5 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                        >
                            Simpan Data
                        </button>
                    </div>
                </form>
            </div>

            <!-- Filter, Pencarian & Time-Travel Log Tanggal -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 space-y-3">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <select
                            id="mkw-filter-status"
                            class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                            <option value="">Semua Status Warga</option>
                            <option value="Tetap">Tetap</option>
                            <option value="Kontrak / Kost">Kontrak / Kost</option>
                            <option value="Sementara">Sementara</option>
                        </select>
                        <select
                            id="mkw-filter-status-sosial"
                            class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                            <option value="">Semua Status Sosial</option>
                            ${filterStatusSosialOptionsHtml}
                        </select>
                        <select
                            id="mkw-filter-jenis-input"
                            class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                            <option value="">Semua Jenis Input</option>
                            <option value="Data awal">Data awal</option>
                            <option value="KK Baru">KK Baru</option>
                        </select>
                        <select
                            id="mkw-filter-jk"
                            class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                            <option value="">Semua Jenis Kelamin</option>
                            <option value="Laki-laki">Laki-laki</option>
                            <option value="Perempuan">Perempuan</option>
                        </select>
                        <select
                            id="mkw-filter-golongan-darah"
                            class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                            <option value="">Semua Golongan Darah</option>
                            ${filterGolonganDarahOptionsHtml}
                        </select>
                        <div class="inline-flex items-center gap-1.5">
                            <label for="mkw-filter-tgl-dikeluarkan" class="text-xs font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                Tgl Dikeluarkan ≤
                            </label>
                            <input
                                type="date"
                                id="mkw-filter-tgl-dikeluarkan"
                                title="Filter tanggal dikeluarkan kurang dari atau sama dengan"
                                class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                            <button
                                type="button"
                                id="mkw-clear-tgl-btn"
                                title="Reset filter tanggal dikeluarkan"
                                class="px-2.5 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                            >
                                Reset Tgl
                            </button>
                        </div>
                        <span id="mkw-total-badge" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                            0 Data
                        </span>
                    </div>

                    <div class="w-full lg:w-72">
                        <input
                            type="text"
                            id="mkw-search-input"
                            placeholder="Cari nama, NIK, No. KK, gol. darah, tgl kawin, status sosial, HP, atau alamat..."
                            class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                    </div>
                </div>

                <!-- Bar Posisi Data per Tanggal (Log Audit Snapshot) -->
                <div class="pt-3 border-t border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                        <label for="mkw-snapshot-date" class="text-xs font-semibold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                            Posisi Data per Tanggal Berlaku:
                        </label>
                        <input
                            type="date"
                            id="mkw-snapshot-date"
                            title="Pilih tanggal untuk melihat posisi data warga berdasarkan Tanggal Berlaku Perubahan"
                            class="px-3 py-1.5 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                        <button
                            type="button"
                            id="mkw-reset-snapshot-btn"
                            class="px-3 py-1.5 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                        >
                            Data Saat Ini
                        </button>
                    </div>
                    <div id="mkw-log-count-info" class="text-[11px] text-stone-500 dark:text-stone-400">
                        0 catatan log tersimpan
                    </div>
                </div>
            </div>

            <!-- Tabel Data Warga -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead id="mkw-table-head" class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    </thead>
                    <tbody id="mkw-table-body" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr>
                            <td colspan="8" class="p-8 text-center text-stone-500 dark:text-stone-400">
                                Memuat data warga...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenKependudukanWargaHandler() {
    let wargaList = [];
    let wargaLogs = [];
    let parsedExcelRows = [];
    let defaultWilayah = {
        alamat: "",
        rtRw: "",
        desaKelurahan: "",
        kecamatan: "",
        kabupatenKota: "",
        kodePos: "",
        propinsi: ""
    };
    let isDestroyed = false;
    let feedbackTimerId = null;
    let modalHideTimerId = null;
    let pendingDeleteRow = null;
    let isDeletingWarga = false;
    let isImportingExcel = false;
    let tanggalBerlakuManuallyChanged = false;
    const isAdmin = getCurrentUserRole() === "administrator";

    const rootEl = document.getElementById("mkw-root");
    const downloadMasterBtn = document.getElementById("mkw-download-master-btn");
    const openUploadBtn = document.getElementById("mkw-open-upload-btn");
    const toggleFormBtn = document.getElementById("mkw-toggle-form-btn");
    const feedbackEl = document.getElementById("mkw-feedback");

    // Elemen Modal Upload Excel
    const uploadModalEl = document.getElementById("mkw-upload-modal");
    const uploadCloseBtn = document.getElementById("mkw-upload-close-btn");
    const uploadCancelBtn = document.getElementById("mkw-upload-cancel-btn");
    const modalDownloadMasterBtn = document.getElementById("mkw-modal-download-master-btn");
    const excelFileInput = document.getElementById("mkw-excel-file-input");
    const uploadSummaryEl = document.getElementById("mkw-upload-summary");
    const upStatTotalEl = document.getElementById("mkw-up-stat-total");
    const upStatNewEl = document.getElementById("mkw-up-stat-new");
    const upStatUpdateEl = document.getElementById("mkw-up-stat-update");
    const upStatInvalidEl = document.getElementById("mkw-up-stat-invalid");
    const uploadPreviewWrapEl = document.getElementById("mkw-upload-preview-wrap");
    const uploadPreviewBodyEl = document.getElementById("mkw-upload-preview-body");
    const uploadProgressTextEl = document.getElementById("mkw-upload-progress-text");
    const uploadImportBtn = document.getElementById("mkw-upload-import-btn");

    // Elemen Modal Konfirmasi Hapus
    const confirmModalEl = document.getElementById("mkw-confirm-modal");
    const confirmCardEl = document.getElementById("mkw-confirm-card");
    const confirmNamaEl = document.getElementById("mkw-confirm-nama");
    const confirmNikEl = document.getElementById("mkw-confirm-nik");
    const confirmCloseBtn = document.getElementById("mkw-confirm-close-btn");
    const confirmCancelBtn = document.getElementById("mkw-confirm-cancel-btn");
    const confirmOkBtn = document.getElementById("mkw-confirm-ok-btn");

    const snapshotBannerEl = document.getElementById("mkw-snapshot-banner");
    const snapshotDateLabelEl = document.getElementById("mkw-snapshot-date-label");
    const exitSnapshotBtn = document.getElementById("mkw-exit-snapshot-btn");
    const snapshotDateInput = document.getElementById("mkw-snapshot-date");
    const resetSnapshotBtn = document.getElementById("mkw-reset-snapshot-btn");
    const logCountInfoEl = document.getElementById("mkw-log-count-info");

    const statTotalEl = document.getElementById("mkw-stat-total");
    const statTetapEl = document.getElementById("mkw-stat-tetap");
    const statKontrakEl = document.getElementById("mkw-stat-kontrak");
    const statSementaraEl = document.getElementById("mkw-stat-sementara");

    const formPanelEl = document.getElementById("mkw-form-panel");
    const formEl = document.getElementById("mkw-form");
    const formTitleEl = document.getElementById("mkw-form-title");
    const cancelFormBtn = document.getElementById("mkw-cancel-form-btn");
    const cancelSubmitBtn = document.getElementById("mkw-cancel-submit-btn");
    const resetFormBtn = document.getElementById("mkw-reset-form-btn");
    const submitBtn = document.getElementById("mkw-submit-btn");
    const editIdInput = document.getElementById("mkw-edit-id");

    // Blok A: Awal Form — Jenis Input, Tanggal KK, Tanggal Berlaku, Kepala KK & Wilayah
    const jenisInputSelect = document.getElementById("mkw-jenis-input");
    const tanggalDikeluarkanInput = document.getElementById("mkw-tanggal-dikeluarkan");
    const tglDikeluarkanHintEl = document.getElementById("mkw-tgl-dikeluarkan-hint");
    const tanggalBerlakuPerubahanInput = document.getElementById("mkw-tanggal-berlaku-perubahan");
    const keteranganPerubahanWrapEl = document.getElementById("mkw-keterangan-perubahan-wrap");
    const keteranganPerubahanInput = document.getElementById("mkw-keterangan-perubahan");
    const noKkInput = document.getElementById("mkw-no-kk");
    const existingKkListEl = document.getElementById("mkw-existing-kk-list");
    const kkAutofillInfoEl = document.getElementById("mkw-kk-autofill-info");
    const kepalaKeluargaInput = document.getElementById("mkw-kepala-keluarga");
    const kecamatanInput = document.getElementById("mkw-kecamatan");
    const alamatInput = document.getElementById("mkw-alamat");
    const kabupatenKotaInput = document.getElementById("mkw-kabupaten-kota");
    const rtRwInput = document.getElementById("mkw-rt-rw");
    const kodePosInput = document.getElementById("mkw-kode-pos");
    const desaKelurahanInput = document.getElementById("mkw-desa-kelurahan");
    const propinsiInput = document.getElementById("mkw-propinsi");
    const statusSelect = document.getElementById("mkw-status-warga");

    // Blok B: Biodata Individu
    const namaInput = document.getElementById("mkw-nama");
    const nikInput = document.getElementById("mkw-nik");
    const jkSelect = document.getElementById("mkw-jk");
    const golonganDarahSelect = document.getElementById("mkw-golongan-darah");
    const tempatLahirInput = document.getElementById("mkw-tempat-lahir");
    const tanggalLahirInput = document.getElementById("mkw-tanggal-lahir");
    const agamaSelect = document.getElementById("mkw-agama");
    const pendidikanInput = document.getElementById("mkw-pendidikan");
    const pekerjaanInput = document.getElementById("mkw-pekerjaan");

    // Blok C: Status Keluarga, Perkawinan, Imigrasi, Orang Tua & Email Individu
    const statusPerkawinanSelect = document.getElementById("mkw-status-perkawinan");
    const tanggalPerkawinanInput = document.getElementById("mkw-tanggal-perkawinan");
    const hubunganKeluargaSelect = document.getElementById("mkw-hubungan-keluarga");
    const kewarganegaraanSelect = document.getElementById("mkw-kewarganegaraan");
    const noPasporInput = document.getElementById("mkw-no-paspor");
    const noKitasInput = document.getElementById("mkw-no-kitas");
    const namaAyahInput = document.getElementById("mkw-nama-ayah");
    const namaIbuInput = document.getElementById("mkw-nama-ibu");
    const emailInput = document.getElementById("mkw-email");

    // Blok D: Status Sosial & Partisipasi Lingkungan
    const statusSosialCheckboxes = () =>
        Array.from(formEl?.querySelectorAll('input[name="mkw-status-sosial"]') || []);
    const noHpInput = document.getElementById("mkw-no-hp");
    const jenisBansosWrapEl = document.getElementById("mkw-jenis-bansos-wrap");
    const jenisBansosInput = document.getElementById("mkw-jenis-bansos");
    const catatanSosialWrapEl = document.getElementById("mkw-catatan-sosial-wrap");
    const catatanSosialInput = document.getElementById("mkw-catatan-sosial");

    const filterStatusSelect = document.getElementById("mkw-filter-status");
    const filterStatusSosialSelect = document.getElementById("mkw-filter-status-sosial");
    const filterJenisInputSelect = document.getElementById("mkw-filter-jenis-input");
    const filterJkSelect = document.getElementById("mkw-filter-jk");
    const filterGolonganDarahSelect = document.getElementById("mkw-filter-golongan-darah");
    const filterTglDikeluarkanInput = document.getElementById("mkw-filter-tgl-dikeluarkan");
    const clearTglBtn = document.getElementById("mkw-clear-tgl-btn");
    const searchInput = document.getElementById("mkw-search-input");
    const totalBadgeEl = document.getElementById("mkw-total-badge");
    const tableHeadEl = document.getElementById("mkw-table-head");
    const tableBodyEl = document.getElementById("mkw-table-body");

    if (isAdmin) {
        downloadMasterBtn?.classList.remove("hidden");
        openUploadBtn?.classList.remove("hidden");
        toggleFormBtn?.classList.remove("hidden");
    }

    function getSelectedStatusSosial() {
        return normalizeStatusSosialList(
            statusSosialCheckboxes()
                .filter((cb) => cb.checked)
                .map((cb) => cb.value)
        );
    }

    function setSelectedStatusSosial(values = []) {
        const selectedSet = new Set(normalizeStatusSosialList(values));
        statusSosialCheckboxes().forEach((cb) => {
            cb.checked = selectedSet.has(cb.value);
        });
        syncBansosFieldVisibility();
    }

    function syncBansosFieldVisibility() {
        const hasBansos = getSelectedStatusSosial().includes("Bantuan Sosial");
        if (jenisBansosWrapEl && catatanSosialWrapEl) {
            if (hasBansos) {
                jenisBansosWrapEl.classList.remove("hidden");
                catatanSosialWrapEl.classList.remove("md:col-span-2");
            } else {
                jenisBansosWrapEl.classList.add("hidden");
                catatanSosialWrapEl.classList.add("md:col-span-2");
            }
        }
    }

    function isSnapshotMode() {
        return Boolean(String(snapshotDateInput?.value || "").trim());
    }

    // =========================================================================
    // DOWNLOAD MASTER EXCEL (.XLSX)
    // =========================================================================
    async function handleDownloadMasterExcel() {
        try {
            const XLSX = await ensureXlsxLibrary();
            const wb = XLSX.utils.book_new();

            const headers = EXCEL_TEMPLATE_COLUMNS.map((c) => c.header);
            const sampleRow = [
                "Data awal",
                "2024-01-15",
                "2024-01-15",
                "3402010101010001",
                "BUDI SANTOSO (CONTOH - HAPUS BARIS INI)",
                "3402011505850001",
                "BUDI SANTOSO (CONTOH - HAPUS BARIS INI)",
                "Laki-laki",
                "O",
                "Bantul",
                "1985-05-15",
                "Islam",
                "SLTA / Sederajat",
                "Karyawan Swasta",
                "Kawin",
                "2010-08-20",
                "Kepala Keluarga",
                "WNI",
                "-",
                "-",
                "SUKARNO",
                "SITI AMINAH",
                "Tetap",
                defaultWilayah.alamat || "Dusun Pundong RT 005",
                defaultWilayah.rtRw || "005 / 000",
                defaultWilayah.desaKelurahan || "Srihardono",
                defaultWilayah.kecamatan || "Pundong",
                defaultWilayah.kabupatenKota || "Bantul",
                defaultWilayah.kodePos || "55771",
                defaultWilayah.propinsi || "DI Yogyakarta",
                "081234567890",
                "budi@contoh.id",
                "Ronda, Kerja Bakti, Iuran Wajib RT",
                "",
                "Regu Ronda Malam Minggu"
            ];

            const wsData = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
            wsData["!cols"] = EXCEL_TEMPLATE_COLUMNS.map((c) => ({ wch: c.width }));

            const textColIndices = [1, 2, 3, 5, 10, 15, 28, 30];
            for (let r = 1; r <= 200; r += 1) {
                textColIndices.forEach((cIdx) => {
                    const cellRef = XLSX.utils.encode_cell({ r, c: cIdx });
                    if (!wsData[cellRef]) {
                        wsData[cellRef] = { t: "s", v: "" };
                    }
                    wsData[cellRef].z = "@";
                });
            }

            XLSX.utils.book_append_sheet(wb, wsData, "Data_Warga");

            const guideRows = [
                ["Nama Kolom", "Wajib / Opsional", "Keterangan & Format Pengisian"],
                ...EXCEL_TEMPLATE_COLUMNS.map((col) => [
                    col.header,
                    col.key === "nik" || col.key === "nama" ? "WAJIB" : "Opsional",
                    col.note
                ]),
                [
                    "Catatan Penting",
                    "INFO",
                    "Baris contoh dengan teks '(CONTOH - HAPUS BARIS INI)' otomatis dilewati sistem saat upload. Jika NIK sudah terdaftar, data akan diperbarui otomatis."
                ]
            ];
            const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
            wsGuide["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 78 }];
            XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan_Pengisian");

            XLSX.writeFile(wb, "Master_Data_Warga_RT.xlsx");
            showFeedback("Template Master_Data_Warga_RT.xlsx berhasil diunduh.");
        } catch (err) {
            console.error("Gagal membuat Master Excel:", err);
            showFeedback("Gagal mengunduh template Master Excel.", "error");
        }
    }

    // =========================================================================
    // UPLOAD & PARSING EXCEL (.XLSX / .XLS / .CSV)
    // =========================================================================
    function resetUploadModalState() {
        parsedExcelRows = [];
        isImportingExcel = false;
        if (excelFileInput) excelFileInput.value = "";
        if (uploadSummaryEl) uploadSummaryEl.classList.add("hidden");
        if (uploadPreviewWrapEl) uploadPreviewWrapEl.classList.add("hidden");
        if (uploadPreviewBodyEl) uploadPreviewBodyEl.innerHTML = "";
        if (uploadProgressTextEl) {
            uploadProgressTextEl.textContent = "Pilih file Excel untuk melihat pratinjau data sebelum disimpan.";
        }
        if (uploadImportBtn) {
            uploadImportBtn.disabled = true;
            uploadImportBtn.textContent = "Proses & Simpan ke Database";
        }
    }

    function openUploadModal() {
        if (!isAdmin || isSnapshotMode() || !uploadModalEl) return;
        hideFeedback();
        resetUploadModalState();
        uploadModalEl.classList.remove("hidden");
    }

    function closeUploadModal() {
        if (isImportingExcel || !uploadModalEl) return;
        uploadModalEl.classList.add("hidden");
        resetUploadModalState();
    }

    function normalizeExcelHeaderKey(rawHeader = "") {
        const clean = String(rawHeader ?? "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        const aliasMap = {
            jenisinput: "jenisInput",
            tanggaldikeluarkankk: "tanggalDikeluarkan",
            tanggaldikeluarkan: "tanggalDikeluarkan",
            tanggalkk: "tanggalDikeluarkan",
            tglkk: "tanggalDikeluarkan",
            tanggalberlaku: "tanggalBerlakuPerubahan",
            tanggalberlakuperubahan: "tanggalBerlakuPerubahan",
            tglberlaku: "tanggalBerlakuPerubahan",
            nokk: "noKk",
            nomorkk: "noKk",
            kepalakeluarga: "kepalaKeluarga",
            namakepalakeluarga: "kepalaKeluarga",
            nik: "nik",
            nikniks: "nik",
            niks: "nik",
            namalengkap: "nama",
            nama: "nama",
            namawarga: "nama",
            jeniskelamin: "jenisKelamin",
            jk: "jenisKelamin",
            golongandarah: "golonganDarah",
            goldar: "golonganDarah",
            tempatlahir: "tempatLahir",
            tanggallahir: "tanggalLahir",
            tgllahir: "tanggalLahir",
            agama: "agama",
            pendidikan: "pendidikan",
            pekerjaan: "pekerjaan",
            statusperkawinan: "statusPerkawinan",
            statuskawin: "statusPerkawinan",
            tanggalperkawinan: "tanggalPerkawinan",
            tglperkawinan: "tanggalPerkawinan",
            tanggalmenikah: "tanggalPerkawinan",
            tglmenikah: "tanggalPerkawinan",
            hubungankeluarga: "hubunganKeluarga",
            statushubungandalamkeluarga: "hubunganKeluarga",
            shdk: "hubunganKeluarga",
            kewarganegaraan: "kewarganegaraan",
            wn: "kewarganegaraan",
            nopaspor: "noPaspor",
            nokitaskitap: "noKitas",
            nokitas: "noKitas",
            namaayah: "namaAyah",
            namaibu: "namaIbu",
            statustinggal: "statusWarga",
            statuswarga: "statusWarga",
            alamat: "alamat",
            rtrw: "rtRw",
            desakelurahan: "desaKelurahan",
            desa: "desaKelurahan",
            kelurahan: "desaKelurahan",
            kecamatan: "kecamatan",
            kabupatenkota: "kabupatenKota",
            kabupaten: "kabupatenKota",
            kota: "kabupatenKota",
            kodepos: "kodePos",
            propinsi: "propinsi",
            provinsi: "propinsi",
            nohpwa: "noHp",
            nohp: "noHp",
            nowa: "noHp",
            telepon: "noHp",
            email: "email",
            statussosial: "statusSosial",
            jenisbansos: "jenisBansos",
            jenisbantuansosial: "jenisBansos",
            catatansosial: "catatanSosial",
            keterangansosial: "catatanSosial"
        };

        return aliasMap[clean] || null;
    }

    async function handleExcelFileSelected(e) {
        const file = e.target?.files?.[0];
        if (!file) {
            resetUploadModalState();
            return;
        }

        try {
            if (uploadProgressTextEl) {
                uploadProgressTextEl.textContent = "Membaca dan memvalidasi file Excel...";
            }
            const XLSX = await ensureXlsxLibrary();
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

            const targetSheetName =
                workbook.SheetNames.find((s) => s.toLowerCase() === "data_warga") ||
                workbook.SheetNames[0];
            const worksheet = workbook.Sheets[targetSheetName];
            const rawObjects = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (!rawObjects.length) {
                resetUploadModalState();
                showFeedback("File Excel kosong atau tidak memiliki baris data.", "error");
                return;
            }

            const existingByNik = new Map();
            wargaList.forEach((item) => {
                const cleanNik = cleanDigitIdentifier(item.nik);
                if (cleanNik) existingByNik.set(cleanNik, item);
            });

            const seenNiksInFile = new Set();
            const parsedResults = [];

            rawObjects.forEach((rawRow, idx) => {
                const excelRowNum = idx + 2;
                const mapped = {};

                Object.entries(rawRow).forEach(([colHeader, cellVal]) => {
                    const canonicalKey = normalizeExcelHeaderKey(colHeader);
                    if (canonicalKey) {
                        mapped[canonicalKey] = cellVal;
                    }
                });

                const namaRaw = String(mapped.nama ?? "").trim();
                const nikRaw = cleanDigitIdentifier(mapped.nik);

                if (!namaRaw && !nikRaw) return;
                if (namaRaw.toUpperCase().includes("(CONTOH - HAPUS BARIS INI)")) return;

                const noKk = cleanDigitIdentifier(mapped.noKk);
                const tanggalDikeluarkan = toDateInputValue(mapped.tanggalDikeluarkan);
                const tanggalBerlakuPerubahan =
                    toDateInputValue(mapped.tanggalBerlakuPerubahan) || tanggalDikeluarkan;
                const statusSosial = normalizeStatusSosialList(mapped.statusSosial);
                const jenisBansos = statusSosial.includes("Bantuan Sosial")
                    ? String(mapped.jenisBansos ?? "").trim()
                    : "";

                const normalizedPayload = {
                    jenisInput: normalizeJenisInput(mapped.jenisInput),
                    tanggalDikeluarkan,
                    tanggalBerlakuPerubahan,
                    noKk,
                    kepalaKeluarga: String(mapped.kepalaKeluarga ?? "").trim(),
                    nik: nikRaw,
                    nama: namaRaw,
                    jenisKelamin: normalizeJenisKelamin(mapped.jenisKelamin),
                    golonganDarah: normalizeGolonganDarah(mapped.golonganDarah),
                    tempatLahir: String(mapped.tempatLahir ?? "").trim(),
                    tanggalLahir: toDateInputValue(mapped.tanggalLahir),
                    agama: normalizeAgama(mapped.agama),
                    pendidikan: String(mapped.pendidikan ?? "").trim(),
                    pekerjaan: String(mapped.pekerjaan ?? "").trim(),
                    statusPerkawinan: normalizeStatusPerkawinan(mapped.statusPerkawinan),
                    tanggalPerkawinan: toDateInputValue(mapped.tanggalPerkawinan),
                    hubunganKeluarga: normalizeHubunganKeluarga(mapped.hubunganKeluarga),
                    kewarganegaraan: normalizeKewarganegaraan(mapped.kewarganegaraan),
                    noPaspor: String(mapped.noPaspor ?? "").trim() || "-",
                    noKitas: String(mapped.noKitas ?? "").trim() || "-",
                    namaAyah: String(mapped.namaAyah ?? "").trim(),
                    namaIbu: String(mapped.namaIbu ?? "").trim(),
                    statusWarga: normalizeStatusWarga(mapped.statusWarga),
                    alamat: String(mapped.alamat ?? "").trim() || defaultWilayah.alamat,
                    rtRw: String(mapped.rtRw ?? "").trim() || defaultWilayah.rtRw,
                    desaKelurahan: String(mapped.desaKelurahan ?? "").trim() || defaultWilayah.desaKelurahan,
                    kecamatan: String(mapped.kecamatan ?? "").trim() || defaultWilayah.kecamatan,
                    kabupatenKota: String(mapped.kabupatenKota ?? "").trim() || defaultWilayah.kabupatenKota,
                    kodePos: cleanDigitIdentifier(mapped.kodePos) || defaultWilayah.kodePos,
                    propinsi: String(mapped.propinsi ?? "").trim() || defaultWilayah.propinsi,
                    noHp: cleanDigitIdentifier(mapped.noHp),
                    email: String(mapped.email ?? "").trim(),
                    statusSosial,
                    jenisBansos,
                    catatanSosial: String(mapped.catatanSosial ?? "").trim()
                };

                let isValid = true;
                let validationNote = "";
                let mode = "NEW";
                let existingDoc = null;

                if (!nikRaw || !namaRaw) {
                    isValid = false;
                    mode = "ERROR";
                    validationNote = "NIK dan Nama Lengkap wajib diisi.";
                } else if (seenNiksInFile.has(nikRaw)) {
                    isValid = false;
                    mode = "ERROR";
                    validationNote = "NIK duplikat di dalam file Excel ini.";
                } else {
                    seenNiksInFile.add(nikRaw);
                    existingDoc = existingByNik.get(nikRaw) || null;
                    if (existingDoc) {
                        mode = "UPDATE";
                        validationNote = `NIK ditemukan (akan memperbarui data "${existingDoc.nama || namaRaw}")`;
                    } else {
                        mode = "NEW";
                        validationNote = "Siap ditambahkan sebagai warga baru";
                    }
                }

                parsedResults.push({
                    excelRowNum,
                    isValid,
                    mode,
                    validationNote,
                    existingDoc,
                    payload: normalizedPayload
                });
            });

            parsedExcelRows = parsedResults;

            const totalCount = parsedResults.length;
            const newCount = parsedResults.filter((r) => r.isValid && r.mode === "NEW").length;
            const updateCount = parsedResults.filter((r) => r.isValid && r.mode === "UPDATE").length;
            const invalidCount = parsedResults.filter((r) => !r.isValid).length;
            const validCount = newCount + updateCount;

            if (upStatTotalEl) upStatTotalEl.textContent = String(totalCount);
            if (upStatNewEl) upStatNewEl.textContent = String(newCount);
            if (upStatUpdateEl) upStatUpdateEl.textContent = String(updateCount);
            if (upStatInvalidEl) upStatInvalidEl.textContent = String(invalidCount);
            uploadSummaryEl?.classList.remove("hidden");

            if (uploadPreviewBodyEl) {
                uploadPreviewBodyEl.innerHTML = parsedResults
                    .map((item) => {
                        const badgeHtml =
                            item.mode === "NEW"
                                ? `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">BARU</span>`
                                : item.mode === "UPDATE"
                                    ? `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">UPDATE</span>`
                                    : `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">ERROR</span>`;

                        return `
                            <tr class="${item.isValid ? "" : "bg-rose-50/50 dark:bg-rose-950/20"}">
                                <td class="px-3 py-2 font-mono text-stone-500">${item.excelRowNum}</td>
                                <td class="px-3 py-2">${badgeHtml}</td>
                                <td class="px-3 py-2 font-mono">${escapeHtml(item.payload.nik || "-")}</td>
                                <td class="px-3 py-2 font-mono">${escapeHtml(item.payload.noKk || "-")}</td>
                                <td class="px-3 py-2 font-semibold">${escapeHtml(item.payload.nama || "-")}</td>
                                <td class="px-3 py-2">${escapeHtml(item.payload.jenisKelamin)} (${escapeHtml(item.payload.golonganDarah)})</td>
                                <td class="px-3 py-2">${escapeHtml(item.payload.hubunganKeluarga)}</td>
                                <td class="px-3 py-2 text-stone-600 dark:text-stone-400">${escapeHtml(item.validationNote)}</td>
                            </tr>
                        `;
                    })
                    .join("");
            }
            uploadPreviewWrapEl?.classList.remove("hidden");

            if (uploadProgressTextEl) {
                uploadProgressTextEl.textContent =
                    validCount > 0
                        ? `${validCount} baris valid siap disimpan (${newCount} baru, ${updateCount} update).`
                        : "Tidak ada baris valid yang dapat disimpan.";
            }
            if (uploadImportBtn) {
                uploadImportBtn.disabled = validCount === 0;
            }
        } catch (err) {
            console.error("Gagal membaca file Excel:", err);
            resetUploadModalState();
            showFeedback("Gagal membaca file Excel. Pastikan format file benar.", "error");
        }
    }

    async function executeExcelImport() {
        if (!isAdmin || isImportingExcel || isDestroyed) return;
        const validItems = parsedExcelRows.filter((r) => r.isValid);
        if (!validItems.length) return;

        isImportingExcel = true;
        if (uploadImportBtn) {
            uploadImportBtn.disabled = true;
            uploadImportBtn.textContent = "Menyimpan data...";
        }

        const actorEmail = String(localStorage.getItem("user_email") || "").trim();
        const actorRole = String(localStorage.getItem("user_role") || "").trim();
        const nowIso = new Date().toISOString();
        const CHUNK_SIZE = 200;

        try {
            let processedCount = 0;

            for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
                const chunk = validItems.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);

                chunk.forEach((item) => {
                    const isUpdate = item.mode === "UPDATE" && item.existingDoc?.id;
                    const targetRef = isUpdate
                        ? doc(db, WARGA_COLLECTION, item.existingDoc.id)
                        : doc(collection(db, WARGA_COLLECTION));

                    const tanggalDikeluarkan = isUpdate
                        ? (toDateInputValue(item.existingDoc.tanggalDikeluarkan) || item.payload.tanggalDikeluarkan)
                        : item.payload.tanggalDikeluarkan;

                    const tanggalBerlakuPerubahan =
                        item.payload.tanggalBerlakuPerubahan ||
                        tanggalDikeluarkan ||
                        getTodayDateString();

                    const docData = {
                        ...(isUpdate ? item.existingDoc : {}),
                        ...item.payload,
                        tanggalDikeluarkan,
                        tanggalBerlakuPerubahan,
                        updatedAt: nowIso
                    };
                    delete docData.id;
                    if (!isUpdate) {
                        docData.createdAt = nowIso;
                    }

                    batch.set(targetRef, docData, { merge: true });

                    const logRef = doc(collection(db, WARGA_LOG_COLLECTION));
                    batch.set(logRef, {
                        ...docData,
                        tanggalBerlakuPerubahan,
                        keteranganPerubahan: isUpdate
                            ? "Pembaruan massal via Upload Excel"
                            : "Input awal massal via Upload Excel",
                        wargaId: targetRef.id,
                        aksiLog: isUpdate ? "EDIT" : "TAMBAH",
                        logAt: nowIso,
                        actorEmail,
                        actorRole
                    });
                });

                await batch.commit();
                processedCount += chunk.length;
                if (uploadProgressTextEl) {
                    uploadProgressTextEl.textContent = `Menyimpan ${processedCount} dari ${validItems.length} data warga...`;
                }
            }

            isImportingExcel = false;
            closeUploadModal();
            showFeedback(`Berhasil mengimpor ${validItems.length} data warga dari Excel.`);
            await loadWargaAndLogs();
        } catch (err) {
            console.error("Gagal mengimpor data Excel:", err);
            isImportingExcel = false;
            if (uploadImportBtn) {
                uploadImportBtn.disabled = false;
                uploadImportBtn.textContent = "Proses & Simpan ke Database";
            }
            showFeedback("Terjadi kesalahan saat menyimpan data Excel ke database.", "error");
        }
    }

    // =========================================================================
    // MODAL HAPUS & FEEDBACK
    // =========================================================================
    function openDeleteConfirmModal(row) {
        if (!row || !confirmModalEl || !confirmCardEl || isDestroyed) return;
        if (modalHideTimerId !== null) {
            window.clearTimeout(modalHideTimerId);
            modalHideTimerId = null;
        }

        pendingDeleteRow = row;
        if (confirmNamaEl) confirmNamaEl.textContent = row.nama || "-";
        if (confirmNikEl) confirmNikEl.textContent = `NIK: ${row.nik || "-"} • KK: ${row.noKk || "-"}`;
        if (confirmOkBtn) confirmOkBtn.disabled = false;

        confirmModalEl.classList.remove("hidden");
        requestAnimationFrame(() => {
            if (isDestroyed || !confirmModalEl || !confirmCardEl) return;
            confirmModalEl.classList.remove("bg-black/0", "opacity-0");
            confirmModalEl.classList.add("bg-black/50", "opacity-100");
            confirmCardEl.classList.remove("scale-95", "opacity-0");
            confirmCardEl.classList.add("scale-100", "opacity-100");
        });
    }

    function closeDeleteConfirmModal(forceImmediate = false) {
        if (isDeletingWarga && !forceImmediate) return;
        pendingDeleteRow = null;

        if (modalHideTimerId !== null) {
            window.clearTimeout(modalHideTimerId);
            modalHideTimerId = null;
        }

        if (!confirmModalEl || !confirmCardEl) return;

        if (forceImmediate) {
            confirmModalEl.classList.add("hidden");
            confirmModalEl.classList.remove("bg-black/50", "opacity-100");
            confirmModalEl.classList.add("bg-black/0", "opacity-0");
            confirmCardEl.classList.remove("scale-100", "opacity-100");
            confirmCardEl.classList.add("scale-95", "opacity-0");
            return;
        }

        confirmModalEl.classList.remove("bg-black/50", "opacity-100");
        confirmModalEl.classList.add("bg-black/0", "opacity-0");
        confirmCardEl.classList.remove("scale-100", "opacity-100");
        confirmCardEl.classList.add("scale-95", "opacity-0");

        modalHideTimerId = window.setTimeout(() => {
            modalHideTimerId = null;
            confirmModalEl?.classList.add("hidden");
        }, MODAL_TRANSITION_MS);
    }

    async function executeConfirmedDelete() {
        if (!pendingDeleteRow || isDeletingWarga || isDestroyed) return;
        const targetRow = pendingDeleteRow;
        isDeletingWarga = true;
        if (confirmOkBtn) confirmOkBtn.disabled = true;

        try {
            await deleteDoc(doc(db, WARGA_COLLECTION, targetRow.id));
            await writeWargaAuditLog({
                wargaId: targetRow.id,
                aksiLog: "HAPUS",
                snapshotData: {
                    ...targetRow,
                    tanggalBerlakuPerubahan: getTodayDateString()
                },
                keteranganPerubahan: "Data warga dihapus"
            });
            if (editIdInput?.value === targetRow.id) closeForm();
            isDeletingWarga = false;
            closeDeleteConfirmModal(false);
            showFeedback("Data warga dihapus & tercatat di log.");
            await loadWargaAndLogs();
        } catch (err) {
            console.error("Gagal menghapus data warga:", err);
            isDeletingWarga = false;
            if (confirmOkBtn) confirmOkBtn.disabled = false;
            showFeedback("Gagal menghapus data warga.", "error");
        }
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

    function setKkAutofillInfo(text = "") {
        if (!kkAutofillInfoEl) return;
        if (text) {
            kkAutofillInfoEl.textContent = text;
            kkAutofillInfoEl.classList.remove("hidden");
        } else {
            kkAutofillInfoEl.textContent = "";
            kkAutofillInfoEl.classList.add("hidden");
        }
    }

    function syncTanggalBerlakuWithTanggalDikeluarkan() {
        const isEditing = Boolean(String(editIdInput?.value || "").trim());
        if (isEditing || tanggalBerlakuManuallyChanged) return;
        if (tanggalBerlakuPerubahanInput) {
            tanggalBerlakuPerubahanInput.value = toDateInputValue(tanggalDikeluarkanInput?.value);
        }
    }

    function syncExistingKkDatalist() {
        if (!existingKkListEl) return;
        const kkMap = new Map();

        wargaList.forEach((row) => {
            const kk = String(row.noKk || "").trim();
            if (!kk) return;
            if (!kkMap.has(kk)) {
                kkMap.set(kk, row.kepalaKeluarga || "");
            } else if (!kkMap.get(kk) && row.kepalaKeluarga) {
                kkMap.set(kk, row.kepalaKeluarga);
            }
        });

        existingKkListEl.innerHTML = Array.from(kkMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0], "id"))
            .map(([kk, kkName]) => {
                const label = kkName ? `${kk} — KK: ${kkName}` : kk;
                return `<option value="${escapeHtml(kk)}" label="${escapeHtml(label)}"></option>`;
            })
            .join("");
    }

    function findExistingKkReference(noKkValue = "") {
        const targetKk = String(noKkValue || "").trim();
        if (!targetKk) return null;

        const matches = wargaList.filter((row) => String(row.noKk || "").trim() === targetKk);
        if (!matches.length) return null;

        const kepalaDoc = matches.find(
            (row) => String(row.hubunganKeluarga || "").trim().toLowerCase() === "kepala keluarga"
        );
        return kepalaDoc || matches[0];
    }

    function applyExistingKkToForm(noKkValue = "") {
        if (String(editIdInput?.value || "").trim()) return;

        const refDoc = findExistingKkReference(noKkValue);
        if (!refDoc) {
            setKkAutofillInfo("");
            return;
        }

        if (kepalaKeluargaInput) {
            kepalaKeluargaInput.value = refDoc.kepalaKeluarga || refDoc.nama || "";
        }
        if (alamatInput) alamatInput.value = refDoc.alamat ?? defaultWilayah.alamat;
        if (rtRwInput) rtRwInput.value = refDoc.rtRw ?? defaultWilayah.rtRw;
        if (desaKelurahanInput) desaKelurahanInput.value = refDoc.desaKelurahan ?? defaultWilayah.desaKelurahan;
        if (kecamatanInput) kecamatanInput.value = refDoc.kecamatan ?? defaultWilayah.kecamatan;
        if (kabupatenKotaInput) kabupatenKotaInput.value = refDoc.kabupatenKota ?? defaultWilayah.kabupatenKota;
        if (kodePosInput) kodePosInput.value = refDoc.kodePos ?? defaultWilayah.kodePos;
        if (propinsiInput) propinsiInput.value = refDoc.propinsi ?? defaultWilayah.propinsi;
        if (statusSelect && refDoc.statusWarga) statusSelect.value = refDoc.statusWarga;

        const kkLabel = refDoc.kepalaKeluarga || refDoc.nama || "-";
        setKkAutofillInfo(`No. KK ditemukan: Kepala KK "${kkLabel}" & wilayah otomatis disalin.`);
    }

    async function loadDefaultWilayahFromProfile() {
        try {
            const snap = await getDoc(PROFIL_DOC_REF);
            if (!snap.exists() || isDestroyed) return;

            const data = snap.data() || {};
            defaultWilayah = {
                alamat: String(data.alamat || data.alamat_lengkap || "").trim(),
                rtRw: buildRtRwFromProfile(data),
                desaKelurahan: String(data.desa_kelurahan || data.desaKelurahan || data.kelurahan || "").trim(),
                kecamatan: String(data.kecamatan || "").trim(),
                kabupatenKota: String(data.kabupaten_kota || data.kabupatenKota || data.kota || "").trim(),
                kodePos: String(data.kode_pos || data.kodePos || "").trim(),
                propinsi: String(data.provinsi || data.propinsi || "").trim()
            };

            if (!editIdInput?.value && formPanelEl && !formPanelEl.classList.contains("hidden")) {
                if (alamatInput && !alamatInput.value) alamatInput.value = defaultWilayah.alamat;
                if (rtRwInput && !rtRwInput.value) rtRwInput.value = defaultWilayah.rtRw;
                if (desaKelurahanInput && !desaKelurahanInput.value) desaKelurahanInput.value = defaultWilayah.desaKelurahan;
                if (kecamatanInput && !kecamatanInput.value) kecamatanInput.value = defaultWilayah.kecamatan;
                if (kabupatenKotaInput && !kabupatenKotaInput.value) kabupatenKotaInput.value = defaultWilayah.kabupatenKota;
                if (kodePosInput && !kodePosInput.value) kodePosInput.value = defaultWilayah.kodePos;
                if (propinsiInput && !propinsiInput.value) propinsiInput.value = defaultWilayah.propinsi;
            }
        } catch (err) {
            console.warn("Gagal memuat wilayah default dari profil_perusahaan:", err);
        }
    }

    function updateStats(rows = wargaList) {
        const total = rows.length;
        const tetap = rows.filter((w) => (w.statusWarga || "Tetap") === "Tetap").length;
        const kontrak = rows.filter((w) => w.statusWarga === "Kontrak / Kost").length;
        const sementara = rows.filter((w) => w.statusWarga === "Sementara").length;

        if (statTotalEl) statTotalEl.textContent = String(total);
        if (statTetapEl) statTetapEl.textContent = String(tetap);
        if (statKontrakEl) statKontrakEl.textContent = String(kontrak);
        if (statSementaraEl) statSementaraEl.textContent = String(sementara);
    }

    function populateForm(item = null) {
        const isEditing = Boolean(item);
        tanggalBerlakuManuallyChanged = false;
        setKkAutofillInfo("");

        if (editIdInput) editIdInput.value = item?.id || "";
        if (formTitleEl) {
            formTitleEl.textContent = isEditing ? "EDIT DATA WARGA (FORMAT KK)" : "TAMBAH DATA WARGA (FORMAT KK)";
        }

        if (keteranganPerubahanWrapEl) {
            if (isEditing) keteranganPerubahanWrapEl.classList.remove("hidden");
            else keteranganPerubahanWrapEl.classList.add("hidden");
        }
        if (keteranganPerubahanInput) {
            keteranganPerubahanInput.value = "";
        }

        const resolvedAlamat = isEditing ? (item?.alamat ?? "") : (item?.alamat || defaultWilayah.alamat);
        const resolvedRtRw = isEditing ? (item?.rtRw ?? "") : (item?.rtRw || defaultWilayah.rtRw);
        const resolvedDesa = isEditing ? (item?.desaKelurahan ?? "") : (item?.desaKelurahan || defaultWilayah.desaKelurahan);
        const resolvedKec = isEditing ? (item?.kecamatan ?? "") : (item?.kecamatan || defaultWilayah.kecamatan);
        const resolvedKab = isEditing ? (item?.kabupatenKota ?? "") : (item?.kabupatenKota || defaultWilayah.kabupatenKota);
        const resolvedKodePos = isEditing ? (item?.kodePos ?? "") : (item?.kodePos || defaultWilayah.kodePos);
        const resolvedPropinsi = isEditing ? (item?.propinsi ?? "") : (item?.propinsi || defaultWilayah.propinsi);

        if (jenisInputSelect) {
            jenisInputSelect.value = normalizeJenisInput(item?.jenisInput);
        }

        const normalizedTglDikeluarkan = toDateInputValue(item?.tanggalDikeluarkan);
        if (tanggalDikeluarkanInput) {
            tanggalDikeluarkanInput.value = normalizedTglDikeluarkan;
            tanggalDikeluarkanInput.readOnly = isEditing;
            tanggalDikeluarkanInput.classList.toggle("opacity-75", isEditing);
            tanggalDikeluarkanInput.classList.toggle("cursor-not-allowed", isEditing);
        }
        if (tglDikeluarkanHintEl) {
            if (isEditing) tglDikeluarkanHintEl.classList.remove("hidden");
            else tglDikeluarkanHintEl.classList.add("hidden");
        }
        if (tanggalBerlakuPerubahanInput) {
            tanggalBerlakuPerubahanInput.value = isEditing
                ? (toDateInputValue(item?.tanggalBerlakuPerubahan) || getTodayDateString())
                : normalizedTglDikeluarkan;
        }

        if (noKkInput) noKkInput.value = item?.noKk || "";
        if (kepalaKeluargaInput) kepalaKeluargaInput.value = item?.kepalaKeluarga || "";
        if (kecamatanInput) kecamatanInput.value = resolvedKec;
        if (alamatInput) alamatInput.value = resolvedAlamat;
        if (kabupatenKotaInput) kabupatenKotaInput.value = resolvedKab;
        if (rtRwInput) rtRwInput.value = resolvedRtRw;
        if (kodePosInput) kodePosInput.value = resolvedKodePos;
        if (desaKelurahanInput) desaKelurahanInput.value = resolvedDesa;
        if (propinsiInput) propinsiInput.value = resolvedPropinsi;
        if (statusSelect) statusSelect.value = item?.statusWarga || "Tetap";

        if (namaInput) namaInput.value = item?.nama || "";
        if (nikInput) nikInput.value = item?.nik || "";
        if (jkSelect) jkSelect.value = item?.jenisKelamin === "Perempuan" ? "Perempuan" : "Laki-laki";
        if (golonganDarahSelect) golonganDarahSelect.value = normalizeGolonganDarah(item?.golonganDarah);
        if (tempatLahirInput) tempatLahirInput.value = item?.tempatLahir || "";
        if (tanggalLahirInput) tanggalLahirInput.value = toDateInputValue(item?.tanggalLahir);
        if (agamaSelect) agamaSelect.value = item?.agama || "Islam";
        if (pendidikanInput) pendidikanInput.value = item?.pendidikan || "";
        if (pekerjaanInput) pekerjaanInput.value = item?.pekerjaan || "";

        if (statusPerkawinanSelect) statusPerkawinanSelect.value = item?.statusPerkawinan || "Kawin";
        if (tanggalPerkawinanInput) tanggalPerkawinanInput.value = toDateInputValue(item?.tanggalPerkawinan);
        if (hubunganKeluargaSelect) hubunganKeluargaSelect.value = item?.hubunganKeluarga || "Kepala Keluarga";
        if (kewarganegaraanSelect) kewarganegaraanSelect.value = item?.kewarganegaraan === "WNA" ? "WNA" : "WNI";
        if (noPasporInput) noPasporInput.value = item?.noPaspor || "-";
        if (noKitasInput) noKitasInput.value = item?.noKitas || "-";
        if (namaAyahInput) namaAyahInput.value = item?.namaAyah || "";
        if (namaIbuInput) namaIbuInput.value = item?.namaIbu || "";
        if (emailInput) emailInput.value = item?.email || "";

        setSelectedStatusSosial(item?.statusSosial || []);
        if (noHpInput) noHpInput.value = item?.noHp || "";
        if (jenisBansosInput) jenisBansosInput.value = item?.jenisBansos || "";
        if (catatanSosialInput) catatanSosialInput.value = item?.catatanSosial || "";
    }

    async function openForm(item = null) {
        if (!isAdmin || isSnapshotMode()) return;
        hideFeedback();
        formPanelEl?.classList.remove("hidden");
        if (!item) {
            await loadDefaultWilayahFromProfile();
        }
        populateForm(item);
        jenisInputSelect?.focus();
    }

    function closeForm() {
        formPanelEl?.classList.add("hidden");
        if (editIdInput) editIdInput.value = "";
        if (tanggalDikeluarkanInput) {
            tanggalDikeluarkanInput.readOnly = false;
            tanggalDikeluarkanInput.classList.remove("opacity-75", "cursor-not-allowed");
        }
        if (tglDikeluarkanHintEl) tglDikeluarkanHintEl.classList.add("hidden");
        if (keteranganPerubahanWrapEl) keteranganPerubahanWrapEl.classList.add("hidden");
        if (keteranganPerubahanInput) keteranganPerubahanInput.value = "";
        setKkAutofillInfo("");
    }

    function syncSnapshotModeUI() {
        const snapshotDate = toDateInputValue(snapshotDateInput?.value || "");
        const activeSnapshot = Boolean(snapshotDate);

        if (snapshotBannerEl) {
            if (activeSnapshot) {
                snapshotBannerEl.classList.remove("hidden");
                if (snapshotDateLabelEl) {
                    snapshotDateLabelEl.textContent = formatDateIndonesian(snapshotDate);
                }
            } else {
                snapshotBannerEl.classList.add("hidden");
            }
        }

        if (isAdmin) {
            if (activeSnapshot) {
                downloadMasterBtn?.classList.add("hidden");
                openUploadBtn?.classList.add("hidden");
                toggleFormBtn?.classList.add("hidden");
                closeForm();
            } else {
                downloadMasterBtn?.classList.remove("hidden");
                openUploadBtn?.classList.remove("hidden");
                toggleFormBtn?.classList.remove("hidden");
            }
        }
    }

    function getSourceRows() {
        const snapshotDate = toDateInputValue(snapshotDateInput?.value || "");
        if (!snapshotDate) return wargaList;
        return reconstructWargaAtDate(wargaLogs, wargaList, snapshotDate);
    }

    function getFilteredRows() {
        const statusFilter = String(filterStatusSelect?.value || "").trim().toLowerCase();
        const statusSosialFilter = String(filterStatusSosialSelect?.value || "").trim();
        const jenisInputFilter = String(filterJenisInputSelect?.value || "").trim().toLowerCase();
        const jkFilter = String(filterJkSelect?.value || "").trim().toLowerCase();
        const golDarahFilter = String(filterGolonganDarahSelect?.value || "").trim().toUpperCase();
        const maxTglDikeluarkan = toDateInputValue(filterTglDikeluarkanInput?.value || "");
        const keyword = String(searchInput?.value || "").trim().toLowerCase();

        const baseRows = getSourceRows();

        return baseRows.filter((row) => {
            const rowStatus = String(row.statusWarga || "Tetap").toLowerCase();
            const rowStatusSosialList = normalizeStatusSosialList(row.statusSosial);
            const rowJenisInput = normalizeJenisInput(row.jenisInput).toLowerCase();
            const rowJk = String(row.jenisKelamin || "Laki-laki").toLowerCase();
            const rowGolDarah = normalizeGolonganDarah(row.golonganDarah).toUpperCase();
            const rowTglKawin = toDateInputValue(row.tanggalPerkawinan);
            const rowTglDikeluarkan = toDateInputValue(row.tanggalDikeluarkan);
            const rowTglBerlaku = getEffectiveDateString(row);

            if (statusFilter && rowStatus !== statusFilter) return false;
            if (statusSosialFilter && !rowStatusSosialList.includes(statusSosialFilter)) return false;
            if (jenisInputFilter && rowJenisInput !== jenisInputFilter) return false;
            if (jkFilter && rowJk !== jkFilter) return false;
            if (golDarahFilter && rowGolDarah !== golDarahFilter) return false;
            if (maxTglDikeluarkan) {
                if (!rowTglDikeluarkan || rowTglDikeluarkan > maxTglDikeluarkan) return false;
            }

            if (keyword) {
                const hay = [
                    row.noKk,
                    row.kepalaKeluarga,
                    normalizeJenisInput(row.jenisInput),
                    row.nik,
                    row.nama,
                    row.jenisKelamin,
                    rowGolDarah,
                    row.tempatLahir,
                    row.tanggalLahir,
                    row.agama,
                    row.pendidikan,
                    row.pekerjaan,
                    row.statusPerkawinan,
                    rowTglKawin,
                    row.hubunganKeluarga,
                    row.kewarganegaraan,
                    row.noPaspor,
                    row.noKitas,
                    row.namaAyah,
                    row.namaIbu,
                    row.tanggalDikeluarkan,
                    rowTglBerlaku,
                    row.keteranganPerubahan,
                    row.email,
                    row.noHp,
                    rowStatusSosialList.join(" "),
                    row.jenisBansos,
                    row.catatanSosial,
                    row.statusWarga,
                    row.alamat,
                    row.rtRw,
                    row.desaKelurahan,
                    row.kecamatan,
                    row.kabupatenKota,
                    row.kodePos,
                    row.propinsi
                ]
                    .join(" ")
                    .toLowerCase();
                if (!hay.includes(keyword)) return false;
            }
            return true;
        });
    }

    function renderTable() {
        if (!tableHeadEl || !tableBodyEl || isDestroyed) return;
        syncSnapshotModeUI();

        const snapshotActive = isSnapshotMode();
        const showActions = isAdmin && !snapshotActive;
        const rows = getFilteredRows();

        updateStats(rows);

        if (totalBadgeEl) {
            totalBadgeEl.textContent = snapshotActive
                ? `${rows.length} Data (Arsip)`
                : `${rows.length} Data`;
        }

        const actionTh = showActions
            ? `<th class="px-4 py-3 text-right">Aksi</th>`
            : snapshotActive
                ? `<th class="px-4 py-3 text-right">Catatan Log</th>`
                : "";
        const colSpan = showActions || snapshotActive ? 8 : 7;

        tableHeadEl.innerHTML = `
            <tr>
                <th class="px-4 py-3">NIK / No. KK</th>
                <th class="px-4 py-3">Nama, Hubungan &amp; Kontak</th>
                <th class="px-4 py-3">L/P, Gol. Darah &amp; TTL</th>
                <th class="px-4 py-3">Agama, Pendidikan &amp; Kerja</th>
                <th class="px-4 py-3">Status Kawin, Tgl Kawin, Tgl KK &amp; Berlaku</th>
                <th class="px-4 py-3">Status Sosial Lingkungan</th>
                <th class="px-4 py-3">Jenis Input, Kepala KK, Alamat &amp; Orang Tua</th>
                ${actionTh}
            </tr>
        `;

        if (!rows.length) {
            tableBodyEl.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" class="p-8 text-center text-stone-500 dark:text-stone-400">
                        ${snapshotActive
                            ? "Tidak ada data warga yang tercatat pada tanggal tersebut."
                            : "Belum ada data warga yang ditampilkan."}
                    </td>
                </tr>
            `;
            return;
        }

        tableBodyEl.innerHTML = rows
            .map((row) => {
                const ketLog = String(row.keteranganPerubahan || "").trim();
                const actionTd = showActions
                    ? `
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1.5">
                                <button
                                    type="button"
                                    data-mkw-edit="${escapeHtml(row.id)}"
                                    class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    data-mkw-delete="${escapeHtml(row.id)}"
                                    class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer"
                                >
                                    Hapus
                                </button>
                            </div>
                        </td>
                    `
                    : snapshotActive
                        ? `
                            <td class="px-4 py-3 text-right text-[11px] text-stone-500 dark:text-stone-400 whitespace-nowrap">
                                <div class="font-semibold text-amber-800 dark:text-amber-300">
                                    ${escapeHtml(row._fromBaseline ? "Data Awal" : (row.aksiLog || "LOG"))}
                                </div>
                                <div>Berlaku: ${escapeHtml(getEffectiveDateString(row) || "-")}</div>
                                <div>${escapeHtml(formatTimestampShort(row.logAt || row.createdAt))}</div>
                                ${ketLog ? `<div class="mt-0.5 italic text-stone-600 dark:text-stone-300">"${escapeHtml(ketLog)}"</div>` : ""}
                            </td>
                        `
                        : "";

                const jenisInputLabel = normalizeJenisInput(row.jenisInput);
                const golDarahLabel = normalizeGolonganDarah(row.golonganDarah);
                const tglKawinFormatted = toDateInputValue(row.tanggalPerkawinan) || "-";
                const tglKkFormatted = toDateInputValue(row.tanggalDikeluarkan) || "-";
                const tglBerlakuFormatted = getEffectiveDateString(row) || "-";
                const ttlLine = [row.tempatLahir, toDateInputValue(row.tanggalLahir)].filter(Boolean).join(", ") || "-";
                const wilayahLine = [
                    row.alamat,
                    row.rtRw ? `RT/RW ${row.rtRw}` : "",
                    row.desaKelurahan,
                    row.kecamatan,
                    row.kabupatenKota,
                    row.kodePos,
                    row.propinsi
                ]
                    .filter(Boolean)
                    .join(" • ") || "-";
                const ortuLine = [
                    row.namaAyah ? `Ayah: ${row.namaAyah}` : "",
                    row.namaIbu ? `Ibu: ${row.namaIbu}` : ""
                ]
                    .filter(Boolean)
                    .join(" | ");

                const statusSosialList = normalizeStatusSosialList(row.statusSosial);
                const statusSosialBadges = statusSosialList.length
                    ? `<div class="flex flex-wrap gap-1">
                        ${statusSosialList
                            .map((st) => {
                                const isBansos = st === "Bantuan Sosial";
                                const badgeClass = isBansos
                                    ? "bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                    : "bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-300 dark:border-stone-700";
                                return `<span class="inline-block px-1.5 py-0.5 text-[10px] font-semibold border rounded-none ${badgeClass}">${escapeHtml(st)}</span>`;
                            })
                            .join("")}
                      </div>`
                    : `<span class="text-stone-400">-</span>`;

                const jenisBansosText = statusSosialList.includes("Bantuan Sosial") && row.jenisBansos
                    ? `<div class="mt-1 text-[10px] text-amber-700 dark:text-amber-300">Bansos: ${escapeHtml(row.jenisBansos)}</div>`
                    : "";
                const catatanSosialText = row.catatanSosial
                    ? `<div class="mt-0.5 text-[10px] text-stone-500 dark:text-stone-400">${escapeHtml(row.catatanSosial)}</div>`
                    : "";

                return `
                    <tr>
                        <td class="px-4 py-3 font-mono text-[11px]">
                            ${escapeHtml(row.nik || "-")}
                            <div class="text-stone-400">KK: ${escapeHtml(row.noKk || "-")}</div>
                        </td>
                        <td class="px-4 py-3">
                            <div class="font-semibold">${escapeHtml(row.nama || "-")}</div>
                            <div class="text-[11px] text-stone-500 dark:text-stone-400">
                                ${escapeHtml(row.hubunganKeluarga || "Kepala Keluarga")} • ${escapeHtml(row.statusWarga || "Tetap")}
                            </div>
                            ${row.noHp ? `<div class="text-[11px] text-stone-500 dark:text-stone-400">HP: ${escapeHtml(row.noHp)}</div>` : ""}
                            ${row.email ? `<div class="text-[11px] text-stone-500 dark:text-stone-400">${escapeHtml(row.email)}</div>` : ""}
                        </td>
                        <td class="px-4 py-3 text-[11px]">
                            <div>${escapeHtml(row.jenisKelamin || "-")} • Gol. Darah: <span class="font-bold">${escapeHtml(golDarahLabel)}</span></div>
                            <div class="text-stone-500 dark:text-stone-400">${escapeHtml(ttlLine)}</div>
                        </td>
                        <td class="px-4 py-3 text-[11px]">
                            <div>${escapeHtml(row.agama || "Islam")} • ${escapeHtml(row.pendidikan || "-")}</div>
                            <div class="text-stone-500 dark:text-stone-400">${escapeHtml(row.pekerjaan || "-")}</div>
                        </td>
                        <td class="px-4 py-3 text-[11px]">
                            <div>${escapeHtml(row.statusPerkawinan || "Kawin")} • ${escapeHtml(row.kewarganegaraan || "WNI")}</div>
                            <div class="text-stone-500 dark:text-stone-400">
                                Tgl Kawin: ${escapeHtml(tglKawinFormatted)}
                            </div>
                            <div class="text-stone-500 dark:text-stone-400">
                                Tgl KK: ${escapeHtml(tglKkFormatted)} • Berlaku: ${escapeHtml(tglBerlakuFormatted)}
                            </div>
                            <div class="text-stone-500 dark:text-stone-400">
                                Paspor: ${escapeHtml(row.noPaspor || "-")} | KITAS: ${escapeHtml(row.noKitas || "-")}
                            </div>
                        </td>
                        <td class="px-4 py-3 text-[11px] max-w-[220px]">
                            ${statusSosialBadges}
                            ${jenisBansosText}
                            ${catatanSosialText}
                        </td>
                        <td class="px-4 py-3 text-[11px]">
                            <div class="font-medium">
                                <span class="font-semibold text-[#5c6d4e] dark:text-emerald-400">[${escapeHtml(jenisInputLabel)}]</span>
                                KK: ${escapeHtml(row.kepalaKeluarga || "-")}
                            </div>
                            <div class="text-stone-500 dark:text-stone-400">${escapeHtml(wilayahLine)}</div>
                            ${ortuLine ? `<div class="text-stone-500 dark:text-stone-400">${escapeHtml(ortuLine)}</div>` : ""}
                        </td>
                        ${actionTd}
                    </tr>
                `;
            })
            .join("");
    }

    async function loadWargaAndLogs() {
        try {
            const [wargaSnap, logSnap] = await Promise.all([
                getDocs(collection(db, WARGA_COLLECTION)),
                getDocs(collection(db, WARGA_LOG_COLLECTION)).catch((err) => {
                    console.warn("Koleksi warga_log belum terbaca:", err);
                    return null;
                })
            ]);

            const items = [];
            wargaSnap.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });
            items.sort((a, b) =>
                String(a.nama || "").localeCompare(String(b.nama || ""), "id", { sensitivity: "base" })
            );

            const logs = [];
            if (logSnap) {
                logSnap.forEach((docSnap) => {
                    logs.push({ id: docSnap.id, ...docSnap.data() });
                });
            }

            if (isDestroyed) return;
            wargaList = items;
            wargaLogs = logs;

            if (logCountInfoEl) {
                logCountInfoEl.textContent = `${wargaLogs.length} catatan log tersimpan`;
            }

            syncExistingKkDatalist();
            renderTable();
        } catch (err) {
            console.error("Gagal memuat data warga:", err);
            showFeedback("Gagal memuat data warga dari database.", "error");
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!isAdmin || isSnapshotMode()) return;
        hideFeedback();

        const editId = String(editIdInput?.value || "").trim();
        const existingDoc = editId ? wargaList.find((r) => r.id === editId) : null;

        const jenisInput = normalizeJenisInput(jenisInputSelect?.value);
        const tanggalDikeluarkan = editId
            ? toDateInputValue(existingDoc?.tanggalDikeluarkan ?? tanggalDikeluarkanInput?.value)
            : toDateInputValue(tanggalDikeluarkanInput?.value);

        const rawTanggalBerlaku = toDateInputValue(tanggalBerlakuPerubahanInput?.value);
        const tanggalBerlakuPerubahan = editId
            ? (rawTanggalBerlaku || getTodayDateString())
            : (rawTanggalBerlaku || tanggalDikeluarkan);
        const keteranganPerubahan = editId
            ? String(keteranganPerubahanInput?.value || "").trim()
            : "";

        const noKk = String(noKkInput?.value || "").trim();
        const kepalaKeluarga = String(kepalaKeluargaInput?.value || "").trim();
        const kecamatan = String(kecamatanInput?.value || "").trim();
        const alamat = String(alamatInput?.value || "").trim();
        const kabupatenKota = String(kabupatenKotaInput?.value || "").trim();
        const rtRw = String(rtRwInput?.value || "").trim();
        const kodePos = String(kodePosInput?.value || "").trim();
        const desaKelurahan = String(desaKelurahanInput?.value || "").trim();
        const propinsi = String(propinsiInput?.value || "").trim();
        const statusWarga = statusSelect?.value || "Tetap";

        const nama = String(namaInput?.value || "").trim();
        const nik = String(nikInput?.value || "").trim();
        const jenisKelamin = jkSelect?.value === "Perempuan" ? "Perempuan" : "Laki-laki";
        const golonganDarah = normalizeGolonganDarah(golonganDarahSelect?.value);
        const tempatLahir = String(tempatLahirInput?.value || "").trim();
        const tanggalLahir = toDateInputValue(tanggalLahirInput?.value);
        const agama = agamaSelect?.value || "Islam";
        const pendidikan = String(pendidikanInput?.value || "").trim();
        const pekerjaan = String(pekerjaanInput?.value || "").trim();

        const statusPerkawinan = statusPerkawinanSelect?.value || "Kawin";
        const tanggalPerkawinan = toDateInputValue(tanggalPerkawinanInput?.value);
        const hubunganKeluarga = hubunganKeluargaSelect?.value || "Kepala Keluarga";
        const kewarganegaraan = kewarganegaraanSelect?.value === "WNA" ? "WNA" : "WNI";
        const noPaspor = String(noPasporInput?.value || "").trim() || "-";
        const noKitas = String(noKitasInput?.value || "").trim() || "-";
        const namaAyah = String(namaAyahInput?.value || "").trim();
        const namaIbu = String(namaIbuInput?.value || "").trim();
        const email = String(emailInput?.value || "").trim();

        const statusSosial = getSelectedStatusSosial();
        const noHp = String(noHpInput?.value || "").trim();
        const jenisBansos = statusSosial.includes("Bantuan Sosial")
            ? String(jenisBansosInput?.value || "").trim()
            : "";
        const catatanSosial = String(catatanSosialInput?.value || "").trim();

        if (!nik || !nama) {
            showFeedback("NIK / NIKS dan Nama Lengkap wajib diisi.", "error");
            return;
        }

        const nowIso = new Date().toISOString();
        const payload = {
            noKk,
            kepalaKeluarga,
            kecamatan,
            alamat,
            kabupatenKota,
            rtRw,
            kodePos,
            desaKelurahan,
            propinsi,
            statusWarga,
            jenisInput: JENIS_INPUT_OPTIONS.includes(jenisInput) ? jenisInput : "Data awal",
            nama,
            nik,
            jenisKelamin,
            golonganDarah,
            tempatLahir,
            tanggalLahir,
            agama,
            pendidikan,
            pekerjaan,
            statusPerkawinan,
            tanggalPerkawinan,
            hubunganKeluarga,
            kewarganegaraan,
            noPaspor,
            noKitas,
            namaAyah,
            namaIbu,
            tanggalDikeluarkan,
            tanggalBerlakuPerubahan,
            email,
            noHp,
            statusSosial,
            jenisBansos,
            catatanSosial,
            updatedAt: nowIso
        };

        if (submitBtn) submitBtn.disabled = true;

        try {
            if (editId) {
                const fullUpdatedData = {
                    ...(existingDoc || {}),
                    ...payload
                };
                await updateDoc(doc(db, WARGA_COLLECTION, editId), payload);
                await writeWargaAuditLog({
                    wargaId: editId,
                    aksiLog: "EDIT",
                    snapshotData: fullUpdatedData,
                    keteranganPerubahan
                });
                showFeedback("Data warga & log perubahan berhasil disimpan.");
            } else {
                const newDocData = {
                    ...payload,
                    createdAt: nowIso
                };
                const addedRef = await addDoc(collection(db, WARGA_COLLECTION), newDocData);
                await writeWargaAuditLog({
                    wargaId: addedRef.id,
                    aksiLog: "TAMBAH",
                    snapshotData: newDocData,
                    keteranganPerubahan: ""
                });
                showFeedback("Data warga baru & log awal berhasil disimpan.");
            }
            closeForm();
            await loadWargaAndLogs();
        } catch (err) {
            console.error("Gagal menyimpan data warga:", err);
            showFeedback("Gagal menyimpan data warga ke database.", "error");
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    const onClickDelegate = async (e) => {
        if (!isAdmin || isSnapshotMode() || (rootEl && !rootEl.contains(e.target))) return;

        const editBtn = e.target.closest("[data-mkw-edit]");
        if (editBtn) {
            const id = editBtn.getAttribute("data-mkw-edit");
            const found = wargaList.find((r) => r.id === id);
            if (found) await openForm(found);
            return;
        }

        const deleteBtn = e.target.closest("[data-mkw-delete]");
        if (deleteBtn) {
            const id = deleteBtn.getAttribute("data-mkw-delete");
            if (!id) return;
            const targetRow = wargaList.find((r) => r.id === id);
            if (targetRow) openDeleteConfirmModal(targetRow);
        }
    };

    const onModalBackdropClick = (e) => {
        if (e.target === confirmModalEl) {
            closeDeleteConfirmModal(false);
        } else if (e.target === uploadModalEl) {
            closeUploadModal();
        }
    };

    const onKeyDownEscape = (e) => {
        if (e.key !== "Escape") return;
        if (confirmModalEl && !confirmModalEl.classList.contains("hidden")) {
            closeDeleteConfirmModal(false);
        } else if (uploadModalEl && !uploadModalEl.classList.contains("hidden")) {
            closeUploadModal();
        }
    };

    const onToggleForm = async () => {
        if (formPanelEl?.classList.contains("hidden")) await openForm(null);
        else closeForm();
    };
    const onResetForm = () => populateForm(null);
    const onNoKkChange = () => applyExistingKkToForm(noKkInput?.value || "");
    const onTanggalDikeluarkanChange = () => {
        if (String(editIdInput?.value || "").trim()) return;
        syncTanggalBerlakuWithTanggalDikeluarkan();
    };
    const onTanggalBerlakuChange = () => {
        tanggalBerlakuManuallyChanged = true;
    };
    const onClearTgl = () => {
        if (filterTglDikeluarkanInput) {
            filterTglDikeluarkanInput.value = "";
        }
        renderTable();
    };
    const onResetSnapshot = () => {
        if (snapshotDateInput) {
            snapshotDateInput.value = "";
        }
        renderTable();
    };
    const onFormChange = (e) => {
        if (e.target && e.target.name === "mkw-status-sosial") {
            syncBansosFieldVisibility();
        }
    };

    downloadMasterBtn?.addEventListener("click", handleDownloadMasterExcel);
    modalDownloadMasterBtn?.addEventListener("click", handleDownloadMasterExcel);
    openUploadBtn?.addEventListener("click", openUploadModal);
    uploadCloseBtn?.addEventListener("click", closeUploadModal);
    uploadCancelBtn?.addEventListener("click", closeUploadModal);
    excelFileInput?.addEventListener("change", handleExcelFileSelected);
    uploadImportBtn?.addEventListener("click", executeExcelImport);

    toggleFormBtn?.addEventListener("click", onToggleForm);
    cancelFormBtn?.addEventListener("click", closeForm);
    cancelSubmitBtn?.addEventListener("click", closeForm);
    resetFormBtn?.addEventListener("click", onResetForm);
    noKkInput?.addEventListener("input", onNoKkChange);
    noKkInput?.addEventListener("change", onNoKkChange);
    tanggalDikeluarkanInput?.addEventListener("input", onTanggalDikeluarkanChange);
    tanggalDikeluarkanInput?.addEventListener("change", onTanggalDikeluarkanChange);
    tanggalBerlakuPerubahanInput?.addEventListener("input", onTanggalBerlakuChange);
    tanggalBerlakuPerubahanInput?.addEventListener("change", onTanggalBerlakuChange);
    formEl?.addEventListener("change", onFormChange);
    formEl?.addEventListener("submit", handleSubmit);
    filterStatusSelect?.addEventListener("change", renderTable);
    filterStatusSosialSelect?.addEventListener("change", renderTable);
    filterJenisInputSelect?.addEventListener("change", renderTable);
    filterJkSelect?.addEventListener("change", renderTable);
    filterGolonganDarahSelect?.addEventListener("change", renderTable);
    filterTglDikeluarkanInput?.addEventListener("change", renderTable);
    clearTglBtn?.addEventListener("click", onClearTgl);
    snapshotDateInput?.addEventListener("change", renderTable);
    resetSnapshotBtn?.addEventListener("click", onResetSnapshot);
    exitSnapshotBtn?.addEventListener("click", onResetSnapshot);
    searchInput?.addEventListener("input", renderTable);
    document.addEventListener("click", onClickDelegate);
    confirmModalEl?.addEventListener("click", onModalBackdropClick);
    uploadModalEl?.addEventListener("click", onModalBackdropClick);
    confirmCloseBtn?.addEventListener("click", () => closeDeleteConfirmModal(false));
    confirmCancelBtn?.addEventListener("click", () => closeDeleteConfirmModal(false));
    confirmOkBtn?.addEventListener("click", executeConfirmedDelete);
    document.addEventListener("keydown", onKeyDownEscape);

    loadDefaultWilayahFromProfile();
    loadWargaAndLogs();

    return () => {
        isDestroyed = true;
        closeDeleteConfirmModal(true);
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        if (modalHideTimerId !== null) {
            window.clearTimeout(modalHideTimerId);
            modalHideTimerId = null;
        }
        downloadMasterBtn?.removeEventListener("click", handleDownloadMasterExcel);
        modalDownloadMasterBtn?.removeEventListener("click", handleDownloadMasterExcel);
        openUploadBtn?.removeEventListener("click", openUploadModal);
        uploadCloseBtn?.removeEventListener("click", closeUploadModal);
        uploadCancelBtn?.removeEventListener("click", closeUploadModal);
        excelFileInput?.removeEventListener("change", handleExcelFileSelected);
        uploadImportBtn?.removeEventListener("click", executeExcelImport);

        toggleFormBtn?.removeEventListener("click", onToggleForm);
        cancelFormBtn?.removeEventListener("click", closeForm);
        cancelSubmitBtn?.removeEventListener("click", closeForm);
        resetFormBtn?.removeEventListener("click", onResetForm);
        noKkInput?.removeEventListener("input", onNoKkChange);
        noKkInput?.removeEventListener("change", onNoKkChange);
        tanggalDikeluarkanInput?.removeEventListener("input", onTanggalDikeluarkanChange);
        tanggalDikeluarkanInput?.removeEventListener("change", onTanggalDikeluarkanChange);
        tanggalBerlakuPerubahanInput?.removeEventListener("input", onTanggalBerlakuChange);
        tanggalBerlakuPerubahanInput?.removeEventListener("change", onTanggalBerlakuChange);
        formEl?.removeEventListener("change", onFormChange);
        formEl?.removeEventListener("submit", handleSubmit);
        filterStatusSelect?.removeEventListener("change", renderTable);
        filterStatusSosialSelect?.removeEventListener("change", renderTable);
        filterJenisInputSelect?.removeEventListener("change", renderTable);
        filterJkSelect?.removeEventListener("change", renderTable);
        filterGolonganDarahSelect?.removeEventListener("change", renderTable);
        filterTglDikeluarkanInput?.removeEventListener("change", renderTable);
        clearTglBtn?.removeEventListener("click", onClearTgl);
        snapshotDateInput?.removeEventListener("change", renderTable);
        resetSnapshotBtn?.removeEventListener("click", onResetSnapshot);
        exitSnapshotBtn?.removeEventListener("click", onResetSnapshot);
        searchInput?.removeEventListener("input", renderTable);
        document.removeEventListener("click", onClickDelegate);
        confirmModalEl?.removeEventListener("click", onModalBackdropClick);
        uploadModalEl?.removeEventListener("click", onModalBackdropClick);
        confirmCloseBtn?.removeEventListener("click", () => closeDeleteConfirmModal(false));
        confirmCancelBtn?.removeEventListener("click", () => closeDeleteConfirmModal(false));
        confirmOkBtn?.removeEventListener("click", executeConfirmedDelete);
        document.removeEventListener("keydown", onKeyDownEscape);
    };
}

export default renderManajemenKependudukanWarga;