// File: assets/js/views/manajemen-kependudukan-kelahiran.js
import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_NAME = "kelahiran";
const WARGA_COLLECTION = "warga";
const WARGA_LOG_COLLECTION = "warga_log";
const PROFIL_DOC_REF = doc(db, "pengaturan", "profil_perusahaan");
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

function buildRtRwFromProfile(data = {}) {
    const combined = String(data.rt_rw || data.rtRw || "").trim();
    if (combined) return combined;

    const rt = String(data.rt ?? "").trim();
    const rw = String(data.rw ?? "").trim();
    if (!rt && !rw) return "";
    return `${rt || "00"} / ${rw || "00"}`;
}

async function writeWargaAuditLog({ wargaId, aksiLog, snapshotData, keteranganPerubahan = "" }) {
    const actorEmail = String(localStorage.getItem("user_email") || "").trim();
    const actorRole = String(localStorage.getItem("user_role") || "").trim();
    const nowIso = new Date().toISOString();

    const { id, _timeMs, _fromBaseline, ...cleanSnapshot } = snapshotData || {};
    const tanggalBerlakuPerubahan =
        toDateInputValue(cleanSnapshot.tanggalBerlakuPerubahan) ||
        toDateInputValue(cleanSnapshot.tanggalLahir) ||
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

export function renderManajemenKependudukanKelahiran() {
    return `
        <div id="mk-kelahiran-wrapper" class="space-y-4">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100">
                        Data Kelahiran
                    </h2>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                        Catat dan kelola data kelahiran bayi, tanggal lahir, serta orang tua dan sinkronkan ke Data Warga &amp; Log.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <span class="px-2.5 py-1 text-[11px] font-mono font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        Tabel: ${escapeHtml(COLLECTION_NAME)}
                    </span>
                    <button
                        type="button"
                        id="mk-kelahiran-toggle-btn"
                        class="hidden inline-flex items-center justify-center px-3.5 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        + Tambah Kelahiran
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

            <div id="mk-kelahiran-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200"></div>

            <div id="mk-kelahiran-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <form id="mk-kelahiran-form" class="space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                        <h3 id="mk-kelahiran-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                            TAMBAH DATA KELAHIRAN
                        </h3>
                        <button
                            type="button"
                            id="mk-kelahiran-cancel-btn"
                            class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                        >
                            Tutup Form
                        </button>
                    </div>

                    <input type="hidden" id="mk-kelahiran-edit-id" value="">
                    <input type="hidden" id="mk-kelahiran-warga-id" value="">

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label for="mk-kelahiran-nama" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Nama Bayi / Anak <span class="text-rose-500">*</span>
                            </label>
                            <input type="text" id="mk-kelahiran-nama" required placeholder="Nama lengkap bayi" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>
                        <div>
                            <label for="mk-kelahiran-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Tanggal Lahir / Berlaku
                            </label>
                            <input type="date" id="mk-kelahiran-tanggal" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>
                        <div>
                            <label for="mk-kelahiran-jk" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Jenis Kelamin
                            </label>
                            <select id="mk-kelahiran-jk" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                                <option value="Laki-laki">Laki-laki</option>
                                <option value="Perempuan">Perempuan</option>
                            </select>
                        </div>

                        <div>
                            <label for="mk-kelahiran-no-kk" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                No. KK Orang Tua
                            </label>
                            <input
                                type="text"
                                id="mk-kelahiran-no-kk"
                                list="mk-kelahiran-kk-list"
                                autocomplete="off"
                                placeholder="Ketik / pilih No. KK atau Kepala KK..."
                                class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                            >
                            <datalist id="mk-kelahiran-kk-list"></datalist>
                        </div>

                        <div>
                            <label for="mk-kelahiran-nik" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                NIK / NIKS Bayi (Opsional)
                            </label>
                            <input type="text" id="mk-kelahiran-nik" maxlength="20" placeholder="16 digit NIK / NIKS (jika sudah ada)" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>

                        <div>
                            <label for="mk-kelahiran-tempat-lahir" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Tempat Lahir
                            </label>
                            <input type="text" id="mk-kelahiran-tempat-lahir" placeholder="Kota / Kabupaten lahir" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>

                        <div>
                            <label for="mk-kelahiran-ayah" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Nama Ayah (Otomatis dari KK)
                            </label>
                            <input type="text" id="mk-kelahiran-ayah" placeholder="Otomatis terisi saat pilih No. KK" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>

                        <div>
                            <label for="mk-kelahiran-ibu" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Nama Ibu (Otomatis dari KK)
                            </label>
                            <input type="text" id="mk-kelahiran-ibu" placeholder="Otomatis terisi saat pilih No. KK" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>

                        <div>
                            <label for="mk-kelahiran-keterangan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Keterangan Kelahiran
                            </label>
                            <input type="text" id="mk-kelahiran-keterangan" placeholder="Catatan kelahiran (bidan/RS/dll)" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]">
                        </div>
                    </div>

                    <p id="mk-kelahiran-kk-info" class="hidden text-[11px] text-[#5c6d4e] dark:text-emerald-400"></p>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                        <button
                            type="button"
                            id="mk-kelahiran-reset-btn"
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
                        id="mk-kelahiran-filter-jk"
                        class="px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                        <option value="">Semua Jenis Kelamin</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                    </select>
                    <span id="mk-kelahiran-total" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        0 Data
                    </span>
                </div>
                <div class="w-full sm:w-72">
                    <input
                        type="text"
                        id="mk-kelahiran-search"
                        placeholder="Cari nama bayi, No. KK, orang tua, atau keterangan..."
                        class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                </div>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        <tr>
                            <th class="px-4 py-3">Nama Bayi</th>
                            <th class="px-4 py-3">Tanggal Lahir</th>
                            <th class="px-4 py-3">No. KK &amp; Orang Tua</th>
                            <th class="px-4 py-3">Keterangan</th>
                            <th id="mk-kelahiran-aksi-th" class="hidden px-4 py-3 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody id="mk-kelahiran-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                        <tr>
                            <td colspan="5" class="p-8 text-center text-stone-500 dark:text-stone-400">
                                Memuat data kelahiran...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

export function initManajemenKependudukanKelahiranHandler() {
    let items = [];
    let wargaList = [];
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
    const isAdmin = getCurrentUserRole() === "administrator";
    const todayIso = getTodayDateString();

    const wrapperEl = document.getElementById("mk-kelahiran-wrapper");
    const toggleBtn = document.getElementById("mk-kelahiran-toggle-btn");
    const feedbackEl = document.getElementById("mk-kelahiran-feedback");
    const formPanel = document.getElementById("mk-kelahiran-form-panel");
    const formEl = document.getElementById("mk-kelahiran-form");
    const formTitleEl = document.getElementById("mk-kelahiran-form-title");
    const editIdInput = document.getElementById("mk-kelahiran-edit-id");
    const wargaIdInput = document.getElementById("mk-kelahiran-warga-id");
    const cancelBtn = document.getElementById("mk-kelahiran-cancel-btn");
    const resetBtn = document.getElementById("mk-kelahiran-reset-btn");
    const noKkInput = document.getElementById("mk-kelahiran-no-kk");
    const kkDatalistEl = document.getElementById("mk-kelahiran-kk-list");
    const kkInfoEl = document.getElementById("mk-kelahiran-kk-info");
    const filterJkEl = document.getElementById("mk-kelahiran-filter-jk");
    const searchEl = document.getElementById("mk-kelahiran-search");
    const totalEl = document.getElementById("mk-kelahiran-total");
    const aksiThEl = document.getElementById("mk-kelahiran-aksi-th");
    const tbodyEl = document.getElementById("mk-kelahiran-tbody");

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

    function setKkInfo(text = "") {
        if (!kkInfoEl) return;
        if (text) {
            kkInfoEl.textContent = text;
            kkInfoEl.classList.remove("hidden");
        } else {
            kkInfoEl.textContent = "";
            kkInfoEl.classList.add("hidden");
        }
    }

    function getKkOptionsList() {
        const kkMap = new Map();

        wargaList.forEach((row) => {
            const kk = String(row.noKk || "").trim();
            if (!kk) return;

            const isKepala = String(row.hubunganKeluarga || "").trim().toLowerCase() === "kepala keluarga";
            const current = kkMap.get(kk) || {
                noKk: kk,
                kepalaKeluarga: "",
                anggotaNames: []
            };

            if (row.nama) {
                current.anggotaNames.push(String(row.nama).trim());
            }
            if (isKepala && row.nama) {
                current.kepalaKeluarga = String(row.nama).trim();
            } else if (!current.kepalaKeluarga && row.kepalaKeluarga) {
                current.kepalaKeluarga = String(row.kepalaKeluarga).trim();
            }

            kkMap.set(kk, current);
        });

        return Array.from(kkMap.values()).sort((a, b) => a.noKk.localeCompare(b.noKk, "id"));
    }

    function renderKkDatalist() {
        if (!kkDatalistEl) return;
        const allKk = getKkOptionsList();

        kkDatalistEl.innerHTML = allKk
            .map((item) => {
                const label = item.kepalaKeluarga
                    ? `KK: ${item.kepalaKeluarga}${item.anggotaNames.length ? ` (${item.anggotaNames.join(", ")})` : ""}`
                    : item.anggotaNames.join(", ");
                return `<option value="${escapeHtml(item.noKk)}" label="${escapeHtml(label)}"></option>`;
            })
            .join("");
    }

    function extractCleanKkValue(rawValue = "") {
        const text = String(rawValue || "").trim();
        if (!text) return "";
        if (text.includes("—")) {
            return text.split("—")[0].trim();
        }
        const digitMatch = text.match(/^\d{10,20}/);
        if (digitMatch) return digitMatch[0];
        return text;
    }

    function findKkMembers(noKkValue = "") {
        const targetKk = extractCleanKkValue(noKkValue);
        if (!targetKk) return [];
        return wargaList.filter((row) => String(row.noKk || "").trim() === targetKk);
    }

    function findKkReference(noKkValue = "") {
        const members = findKkMembers(noKkValue);
        if (!members.length) return null;
        return (
            members.find((row) => String(row.hubunganKeluarga || "").trim().toLowerCase() === "kepala keluarga") ||
            members[0]
        );
    }

    function resolveParentsFromKk(noKkValue = "") {
        const members = findKkMembers(noKkValue);
        if (!members.length) {
            return { ayah: "", ibu: "", kepalaKeluarga: "" };
        }

        const kepalaDoc = members.find(
            (row) => String(row.hubunganKeluarga || "").trim().toLowerCase() === "kepala keluarga"
        );
        const istriDoc = members.find(
            (row) => String(row.hubunganKeluarga || "").trim().toLowerCase() === "istri"
        );

        let ayah = "";
        if (kepalaDoc && String(kepalaDoc.jenisKelamin || "").trim().toLowerCase() !== "perempuan") {
            ayah = String(kepalaDoc.nama || "").trim();
        }
        if (!ayah) {
            const priaDoc = members.find(
                (row) => String(row.jenisKelamin || "").trim().toLowerCase() === "laki-laki" && row.nama
            );
            if (priaDoc) ayah = String(priaDoc.nama || "").trim();
        }
        if (!ayah) {
            const fromField = members.find((row) => String(row.namaAyah || "").trim());
            if (fromField) ayah = String(fromField.namaAyah || "").trim();
        }

        let ibu = "";
        if (istriDoc && istriDoc.nama) {
            ibu = String(istriDoc.nama || "").trim();
        } else if (kepalaDoc && String(kepalaDoc.jenisKelamin || "").trim().toLowerCase() === "perempuan" && kepalaDoc.nama) {
            ibu = String(kepalaDoc.nama || "").trim();
        }
        if (!ibu) {
            const wanitaDoc = members.find(
                (row) =>
                    String(row.jenisKelamin || "").trim().toLowerCase() === "perempuan" &&
                    row.id !== kepalaDoc?.id &&
                    row.nama
            );
            if (wanitaDoc) ibu = String(wanitaDoc.nama || "").trim();
        }
        if (!ibu) {
            const fromField = members.find((row) => String(row.namaIbu || "").trim());
            if (fromField) ibu = String(fromField.namaIbu || "").trim();
        }

        const kepalaKeluarga = String(kepalaDoc?.nama || kepalaDoc?.kepalaKeluarga || members[0]?.kepalaKeluarga || "").trim();
        return { ayah, ibu, kepalaKeluarga };
    }

    function applyKkAutofill(rawKkValue = "", forceOverwriteParents = true) {
        const targetKk = extractCleanKkValue(rawKkValue);
        if (noKkInput && targetKk && noKkInput.value !== targetKk && findKkReference(targetKk)) {
            noKkInput.value = targetKk;
        }

        const refDoc = findKkReference(targetKk);
        if (!refDoc) {
            setKkInfo("");
            return;
        }

        const ayahInput = document.getElementById("mk-kelahiran-ayah");
        const ibuInput = document.getElementById("mk-kelahiran-ibu");
        const { ayah, ibu, kepalaKeluarga } = resolveParentsFromKk(targetKk);

        if (ayahInput && (forceOverwriteParents || !ayahInput.value)) {
            ayahInput.value = ayah;
        }
        if (ibuInput && (forceOverwriteParents || !ibuInput.value)) {
            ibuInput.value = ibu;
        }

        setKkInfo(
            `KK ${targetKk} (${kepalaKeluarga || "-"}): Ayah "${ayah || "-"}" & Ibu "${ibu || "-"}" otomatis terisi dari data warga.`
        );
    }

    async function loadDefaultWilayah() {
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
        } catch (err) {
            console.warn("Gagal memuat profil wilayah:", err);
        }
    }

    function fillForm(item = null) {
        if (editIdInput) editIdInput.value = item?.id || "";
        if (wargaIdInput) wargaIdInput.value = item?.wargaId || "";
        if (formTitleEl) {
            formTitleEl.textContent = item ? "EDIT DATA KELAHIRAN" : "TAMBAH DATA KELAHIRAN";
        }
        setKkInfo("");

        const namaInput = document.getElementById("mk-kelahiran-nama");
        const tanggalInput = document.getElementById("mk-kelahiran-tanggal");
        const jkInput = document.getElementById("mk-kelahiran-jk");
        const nikInput = document.getElementById("mk-kelahiran-nik");
        const tempatInput = document.getElementById("mk-kelahiran-tempat-lahir");
        const ayahInput = document.getElementById("mk-kelahiran-ayah");
        const ibuInput = document.getElementById("mk-kelahiran-ibu");
        const ketInput = document.getElementById("mk-kelahiran-keterangan");

        const selectedKk = String(item?.noKk || "").trim();
        renderKkDatalist();

        if (namaInput) namaInput.value = item?.nama || "";
        if (tanggalInput) tanggalInput.value = toDateInputValue(item?.tanggal) || todayIso;
        if (jkInput) jkInput.value = item?.jenisKelamin || "Laki-laki";
        if (noKkInput) noKkInput.value = selectedKk;
        if (nikInput) nikInput.value = item?.nik || "";
        if (tempatInput) tempatInput.value = item?.tempatLahir || defaultWilayah.kabupatenKota || "";
        if (ketInput) ketInput.value = item?.keterangan || "";

        if (selectedKk) {
            const parents = resolveParentsFromKk(selectedKk);
            if (ayahInput) ayahInput.value = item?.namaAyah || parents.ayah || "";
            if (ibuInput) ibuInput.value = item?.namaIbu || parents.ibu || "";
            applyKkAutofill(selectedKk, false);
        } else {
            if (ayahInput) ayahInput.value = item?.namaAyah || "";
            if (ibuInput) ibuInput.value = item?.namaIbu || "";
        }
    }

    async function openForm(item = null) {
        if (!isAdmin) return;
        hideFeedback();
        await loadDefaultWilayah();
        formPanel?.classList.remove("hidden");
        fillForm(item);
        document.getElementById("mk-kelahiran-nama")?.focus();
    }

    function closeForm() {
        formPanel?.classList.add("hidden");
        if (editIdInput) editIdInput.value = "";
        if (wargaIdInput) wargaIdInput.value = "";
        setKkInfo("");
    }

    function getFilteredRows() {
        const jkFilter = String(filterJkEl?.value || "").trim().toLowerCase();
        const keyword = String(searchEl?.value || "").trim().toLowerCase();

        return items.filter((row) => {
            if (jkFilter && String(row.jenisKelamin || "").toLowerCase() !== jkFilter) {
                return false;
            }
            if (keyword) {
                const hay = [
                    row.nama,
                    row.nik,
                    row.noKk,
                    row.tempatLahir,
                    row.namaAyah,
                    row.namaIbu,
                    row.keterangan,
                    row.jenisKelamin
                ]
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
                        Belum ada data kelahiran yang ditampilkan.
                    </td>
                </tr>
            `;
            return;
        }

        tbodyEl.innerHTML = rows
            .map((row) => {
                const ortu = [row.namaAyah, row.namaIbu].filter(Boolean).join(" & ") || "-";
                const actionTd = isAdmin
                    ? `
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1.5">
                                <button type="button" data-mk-kelahiran-edit="${escapeHtml(row.id)}" class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer">Edit</button>
                                <button type="button" data-mk-kelahiran-delete="${escapeHtml(row.id)}" class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
                            </div>
                        </td>
                    `
                    : "";

                return `
                    <tr>
                        <td class="px-4 py-3 font-semibold">
                            ${escapeHtml(row.nama || "-")}
                            <div class="text-[11px] font-normal text-stone-500 dark:text-stone-400">
                                ${escapeHtml(row.jenisKelamin || "-")}${row.nik ? ` • NIK: ${escapeHtml(row.nik)}` : ""}
                            </div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            ${escapeHtml(formatTanggalDisplay(row.tanggal))}
                            ${row.tempatLahir ? `<div class="text-[11px] text-stone-500 dark:text-stone-400">${escapeHtml(row.tempatLahir)}</div>` : ""}
                        </td>
                        <td class="px-4 py-3">
                            <div>${escapeHtml(ortu)}</div>
                            ${row.noKk ? `<div class="text-[11px] font-mono text-stone-500 dark:text-stone-400">KK: ${escapeHtml(row.noKk)}</div>` : ""}
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
            const [kelahiranSnap, wargaSnap] = await Promise.all([
                getDocs(collection(db, COLLECTION_NAME)),
                getDocs(collection(db, WARGA_COLLECTION)).catch((err) => {
                    console.warn("Gagal memuat koleksi warga untuk sinkronisasi:", err);
                    return null;
                })
            ]);

            if (isDestroyed) return;

            const list = [];
            kelahiranSnap.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
            list.sort((a, b) =>
                String(b.tanggal || b.createdAt || "").localeCompare(String(a.tanggal || a.createdAt || ""))
            );

            const wList = [];
            if (wargaSnap) {
                wargaSnap.forEach((docSnap) => wList.push({ id: docSnap.id, ...docSnap.data() }));
            }

            items = list;
            wargaList = wList;
            renderKkDatalist();
            renderRows();
        } catch (err) {
            console.error(`Gagal memuat koleksi ${COLLECTION_NAME}:`, err);
            showFeedback(`Gagal memuat data dari tabel ${COLLECTION_NAME}.`, "error");
        }
    }

    function buildWargaPayloadFromKelahiran(data, existingWarga = null) {
        const refKk = findKkReference(data.noKk);
        const parents = resolveParentsFromKk(data.noKk);
        const tanggalLahir = toDateInputValue(data.tanggal) || todayIso;
        const nowIso = new Date().toISOString();

        return {
            noKk: data.noKk || existingWarga?.noKk || "",
            kepalaKeluarga:
                refKk?.kepalaKeluarga ||
                refKk?.nama ||
                parents.kepalaKeluarga ||
                existingWarga?.kepalaKeluarga ||
                data.namaAyah ||
                "",
            alamat: refKk?.alamat ?? existingWarga?.alamat ?? defaultWilayah.alamat,
            rtRw: refKk?.rtRw ?? existingWarga?.rtRw ?? defaultWilayah.rtRw,
            desaKelurahan: refKk?.desaKelurahan ?? existingWarga?.desaKelurahan ?? defaultWilayah.desaKelurahan,
            kecamatan: refKk?.kecamatan ?? existingWarga?.kecamatan ?? defaultWilayah.kecamatan,
            kabupatenKota: refKk?.kabupatenKota ?? existingWarga?.kabupatenKota ?? defaultWilayah.kabupatenKota,
            kodePos: refKk?.kodePos ?? existingWarga?.kodePos ?? defaultWilayah.kodePos,
            propinsi: refKk?.propinsi ?? existingWarga?.propinsi ?? defaultWilayah.propinsi,
            statusWarga: refKk?.statusWarga || existingWarga?.statusWarga || "Tetap",
            jenisInput: existingWarga?.jenisInput || "KK Baru",
            nama: data.nama,
            nik: data.nik || existingWarga?.nik || "",
            jenisKelamin: data.jenisKelamin === "Perempuan" ? "Perempuan" : "Laki-laki",
            tempatLahir: data.tempatLahir || refKk?.kabupatenKota || defaultWilayah.kabupatenKota || "",
            tanggalLahir,
            agama: existingWarga?.agama || refKk?.agama || "Islam",
            pendidikan: existingWarga?.pendidikan || "Belum / Tidak Sekolah",
            pekerjaan: existingWarga?.pekerjaan || "Belum / Tidak Bekerja",
            statusPerkawinan: "Belum Kawin",
            hubunganKeluarga: "Anak",
            kewarganegaraan: existingWarga?.kewarganegaraan || "WNI",
            noPaspor: existingWarga?.noPaspor || "-",
            noKitas: existingWarga?.noKitas || "-",
            namaAyah: data.namaAyah || parents.ayah || "",
            namaIbu: data.namaIbu || parents.ibu || "",
            tanggalDikeluarkan: existingWarga?.tanggalDikeluarkan || refKk?.tanggalDikeluarkan || "",
            tanggalBerlakuPerubahan: tanggalLahir,
            email: existingWarga?.email || "",
            sumberKelahiran: true,
            updatedAt: nowIso
        };
    }

    function findLinkedWarga(kelahiranItem = null) {
        if (!kelahiranItem) return null;
        if (kelahiranItem.wargaId) {
            const byId = wargaList.find((w) => w.id === kelahiranItem.wargaId);
            if (byId) return byId;
        }
        if (kelahiranItem.nik) {
            const byNik = wargaList.find((w) => String(w.nik || "").trim() === String(kelahiranItem.nik).trim());
            if (byNik) return byNik;
        }
        return (
            wargaList.find(
                (w) =>
                    String(w.nama || "").trim().toLowerCase() === String(kelahiranItem.nama || "").trim().toLowerCase() &&
                    toDateInputValue(w.tanggalLahir) === toDateInputValue(kelahiranItem.tanggal)
            ) || null
        );
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!isAdmin) return;
        hideFeedback();

        const nama = document.getElementById("mk-kelahiran-nama")?.value.trim() || "";
        if (!nama) {
            showFeedback("Nama bayi / anak wajib diisi.", "error");
            return;
        }

        const editId = editIdInput?.value.trim() || "";
        const existingKelahiran = editId ? items.find((r) => r.id === editId) : null;
        const tanggal = toDateInputValue(document.getElementById("mk-kelahiran-tanggal")?.value) || todayIso;
        const jenisKelamin = document.getElementById("mk-kelahiran-jk")?.value || "Laki-laki";
        const noKk = extractCleanKkValue(noKkInput?.value || "");
        const nik = document.getElementById("mk-kelahiran-nik")?.value.trim() || "";
        const tempatLahir = document.getElementById("mk-kelahiran-tempat-lahir")?.value.trim() || "";
        const namaAyah = document.getElementById("mk-kelahiran-ayah")?.value.trim() || "";
        const namaIbu = document.getElementById("mk-kelahiran-ibu")?.value.trim() || "";
        const keterangan = document.getElementById("mk-kelahiran-keterangan")?.value.trim() || "";
        const nowIso = new Date().toISOString();

        const basePayload = {
            nama,
            tanggal,
            jenisKelamin,
            noKk,
            nik,
            tempatLahir,
            namaAyah,
            namaIbu,
            keterangan,
            updatedAt: nowIso
        };

        try {
            if (editId) {
                const linkedWarga = findLinkedWarga(existingKelahiran || { ...basePayload, wargaId: wargaIdInput?.value?.trim() });
                let resolvedWargaId = linkedWarga?.id || "";

                if (linkedWarga) {
                    const wargaPayload = buildWargaPayloadFromKelahiran(basePayload, linkedWarga);
                    await updateDoc(doc(db, WARGA_COLLECTION, linkedWarga.id), wargaPayload);
                    await writeWargaAuditLog({
                        wargaId: linkedWarga.id,
                        aksiLog: "EDIT",
                        snapshotData: { ...linkedWarga, ...wargaPayload },
                        keteranganPerubahan: keterangan || "Perubahan data kelahiran"
                    });
                } else {
                    const wargaPayload = buildWargaPayloadFromKelahiran(basePayload, null);
                    const addedWargaRef = await addDoc(collection(db, WARGA_COLLECTION), {
                        ...wargaPayload,
                        createdAt: nowIso
                    });
                    resolvedWargaId = addedWargaRef.id;
                    await writeWargaAuditLog({
                        wargaId: addedWargaRef.id,
                        aksiLog: "TAMBAH",
                        snapshotData: { ...wargaPayload, createdAt: nowIso },
                        keteranganPerubahan: keterangan || "Kelahiran bayi (sinkronisasi edit)"
                    });
                }

                await updateDoc(doc(db, COLLECTION_NAME, editId), {
                    ...basePayload,
                    wargaId: resolvedWargaId
                });
                showFeedback("Data kelahiran diperbarui & disinkronkan ke Warga & Log.");
            } else {
                const wargaPayload = buildWargaPayloadFromKelahiran(basePayload, null);
                const addedWargaRef = await addDoc(collection(db, WARGA_COLLECTION), {
                    ...wargaPayload,
                    createdAt: nowIso
                });
                await writeWargaAuditLog({
                    wargaId: addedWargaRef.id,
                    aksiLog: "TAMBAH",
                    snapshotData: { ...wargaPayload, createdAt: nowIso },
                    keteranganPerubahan: keterangan || "Kelahiran bayi"
                });

                await addDoc(collection(db, COLLECTION_NAME), {
                    ...basePayload,
                    wargaId: addedWargaRef.id,
                    createdAt: nowIso
                });
                showFeedback("Data kelahiran tersimpan & tersinkron ke Warga & Log.");
            }

            closeForm();
            await loadData();
        } catch (err) {
            console.error(`Gagal menyimpan data ${COLLECTION_NAME}:`, err);
            showFeedback("Gagal menyimpan dan menyinkronkan data kelahiran.", "error");
        }
    }

    const onDelegateClick = async (e) => {
        if (wrapperEl && !wrapperEl.contains(e.target)) return;
        if (!isAdmin) return;

        const editBtn = e.target.closest("[data-mk-kelahiran-edit]");
        if (editBtn) {
            const id = editBtn.getAttribute("data-mk-kelahiran-edit");
            const found = items.find((r) => r.id === id);
            if (found) await openForm(found);
            return;
        }

        const deleteBtn = e.target.closest("[data-mk-kelahiran-delete]");
        if (deleteBtn) {
            const id = deleteBtn.getAttribute("data-mk-kelahiran-delete");
            if (!id) return;
            const targetRow = items.find((r) => r.id === id);
            if (!targetRow || !window.confirm("Hapus data kelahiran ini beserta data warga & log terkait?")) return;

            try {
                const linkedWarga = findLinkedWarga(targetRow);
                await deleteDoc(doc(db, COLLECTION_NAME, id));

                if (linkedWarga) {
                    await deleteDoc(doc(db, WARGA_COLLECTION, linkedWarga.id));
                    await writeWargaAuditLog({
                        wargaId: linkedWarga.id,
                        aksiLog: "HAPUS",
                        snapshotData: {
                            ...linkedWarga,
                            tanggalBerlakuPerubahan: toDateInputValue(targetRow.tanggal) || getTodayDateString()
                        },
                        keteranganPerubahan: "Data kelahiran dihapus"
                    });
                }

                if (editIdInput?.value === id) closeForm();
                showFeedback("Data kelahiran dihapus & disinkronkan ke Warga & Log.");
                await loadData();
            } catch (err) {
                console.error(`Gagal menghapus data ${COLLECTION_NAME}:`, err);
                showFeedback("Gagal menghapus data kelahiran.", "error");
            }
        }
    };

    const onNoKkChange = () => {
        applyKkAutofill(noKkInput?.value || "", true);
    };

    toggleBtn?.addEventListener("click", async () => {
        if (formPanel?.classList.contains("hidden")) await openForm(null);
        else closeForm();
    });
    cancelBtn?.addEventListener("click", closeForm);
    resetBtn?.addEventListener("click", () => fillForm(null));
    noKkInput?.addEventListener("input", onNoKkChange);
    noKkInput?.addEventListener("change", onNoKkChange);
    formEl?.addEventListener("submit", handleSubmit);
    filterJkEl?.addEventListener("change", renderRows);
    searchEl?.addEventListener("input", renderRows);
    document.addEventListener("click", onDelegateClick);

    loadDefaultWilayah();
    loadData();

    return () => {
        isDestroyed = true;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        cancelBtn?.removeEventListener("click", closeForm);
        noKkInput?.removeEventListener("input", onNoKkChange);
        noKkInput?.removeEventListener("change", onNoKkChange);
        formEl?.removeEventListener("submit", handleSubmit);
        filterJkEl?.removeEventListener("change", renderRows);
        searchEl?.removeEventListener("input", renderRows);
        document.removeEventListener("click", onDelegateClick);
    };
}

export default renderManajemenKependudukanKelahiran;