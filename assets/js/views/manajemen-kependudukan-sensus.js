// File: assets/js/views/manajemen-kependudukan-sensus.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTION_NAME = "sensus_penduduk";
const WARGA_COLLECTION = "warga";
const FEEDBACK_AUTO_HIDE_MS = 3500;

const SENSUS_CARDS = [
    {
        id: "pekerjaan",
        label: "Sensus Pekerjaan",
        title: "Sensus Pekerjaan",
        description: "Pendataan jenis pekerjaan, profesi, tempat/bidang usaha & status kerja warga",
        fieldLabel: "Data / Bidang Pekerjaan",
        fieldPlaceholder: "Contoh: Wiraswasta / Pedagang kelontong di rumah",
        detailLabel: "Status Kerja / Lokasi Usaha",
        detailPlaceholder: "Contoh: Bekerja mandiri / Sekitar RT 05",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`
    },
    {
        id: "pendidikan",
        label: "Sensus Pendidikan",
        title: "Sensus Pendidikan",
        description: "Pendataan jenjang pendidikan terakhir, status bersekolah & lembaga/jurusan",
        fieldLabel: "Jenjang / Status Pendidikan",
        fieldPlaceholder: "Contoh: SMA/SMK atau Sedang kuliah semester 4",
        detailLabel: "Sekolah / Kampus / Keterangan",
        detailPlaceholder: "Contoh: Masih aktif sekolah / Lulusan tahun 2022",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"/></svg>`
    },
    {
        id: "sosial",
        label: "Sensus Sosial",
        title: "Sensus Sosial",
        description: "Pendataan kondisi sosial, tanggungan keluarga, kerentanan & catatan lapangan",
        fieldLabel: "Kondisi Sosial / Status",
        fieldPlaceholder: "Contoh: Keluarga tanggungan / Lansia / Penerima bantuan",
        detailLabel: "Catatan Sosial / Hunian",
        detailPlaceholder: "Contoh: Rumah milik sendiri, perlu perhatian posyandu/lansia",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
    }
];

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

function normalizeKategori(val = "") {
    const clean = String(val || "").trim().toLowerCase();
    if (clean === "pekerjaan" || clean === "sensus pekerjaan") return "pekerjaan";
    if (clean === "pendidikan" || clean === "sensus pendidikan") return "pendidikan";
    if (clean === "sosial" || clean === "sensus sosial") return "sosial";
    return "sosial";
}

function getCardConfig(kategoriId = "") {
    const norm = normalizeKategori(kategoriId);
    return SENSUS_CARDS.find((c) => c.id === norm) || SENSUS_CARDS[0];
}

export function renderManajemenKependudukanSensus() {
    const cardsHtml = SENSUS_CARDS.map((card) => `
        <button
            type="button"
            data-mk-sensus-card="${escapeHtml(card.id)}"
            class="group bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-[#c87d32] dark:hover:border-[#c87d32] rounded-none px-6 py-7 flex flex-col items-center justify-center text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#c87d32] cursor-pointer"
        >
            <div class="w-11 h-11 rounded-none bg-[#f6f3ec] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[#4a5a3f] dark:text-stone-300 group-hover:bg-[#5c6d4e] dark:group-hover:bg-[#5c6d4e] group-hover:border-[#4b5a3f] dark:group-hover:border-[#4b5a3f] group-hover:text-white flex items-center justify-center mb-3.5 transition-colors">
                ${card.icon}
            </div>
            <h3 class="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#c87d32] dark:group-hover:text-[#d47a2a] leading-snug transition-colors">
                ${escapeHtml(card.title)}
            </h3>
            <p class="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                ${escapeHtml(card.description)}
            </p>
            <span id="mk-sensus-count-${escapeHtml(card.id)}" class="mt-3 px-2.5 py-0.5 text-[11px] font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                0 Data
            </span>
        </button>
    `).join("");

    return `
        <div id="mk-sensus-wrapper" class="space-y-4">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100">
                        Sensus Penduduk
                    </h2>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                        Pilih kategori sensus untuk melakukan pendataan lapangan berdasarkan data warga RT.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <span class="px-2.5 py-1 text-[11px] font-mono font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                        Tabel: ${escapeHtml(COLLECTION_NAME)}
                    </span>
                    <a
                        href="#/manajemen-kependudukan"
                        data-link
                        class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition"
                    >
                        <span>← Kembali</span>
                    </a>
                </div>
            </div>

            <div id="mk-sensus-feedback" role="status" aria-live="polite" class="hidden fixed top-4 right-4 z-50 max-w-sm px-4 py-3 text-xs font-semibold border rounded-none shadow-lg transition-all duration-200"></div>

            <div id="mk-sensus-cards-grid" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${cardsHtml}
            </div>

            <div id="mk-sensus-detail-panel" class="hidden space-y-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 id="mk-sensus-active-title" class="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                            SENSUS PEKERJAAN
                        </h3>
                        <p id="mk-sensus-active-desc" class="text-xs text-stone-600 dark:text-stone-400 mt-0.5"></p>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            id="mk-sensus-toggle-btn"
                            class="hidden inline-flex items-center justify-center px-3.5 py-2 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                        >
                            + Input Sensus
                        </button>
                        <button
                            type="button"
                            id="mk-sensus-back-cards-btn"
                            class="inline-flex items-center justify-center px-3 py-2 rounded-none text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition cursor-pointer"
                        >
                            ← Daftar Sensus
                        </button>
                    </div>
                </div>

                <div id="mk-sensus-form-panel" class="hidden bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                    <form id="mk-sensus-form" class="space-y-4">
                        <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                            <h4 id="mk-sensus-form-title" class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                                INPUT DATA SENSUS
                            </h4>
                            <button
                                type="button"
                                id="mk-sensus-cancel-btn"
                                class="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 cursor-pointer"
                            >
                                Tutup Form
                            </button>
                        </div>

                        <input type="hidden" id="mk-sensus-edit-id" value="">

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label for="mk-sensus-warga-select" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Pilih Warga (Data Warga) <span class="text-rose-500">*</span>
                                </label>
                                <select
                                    id="mk-sensus-warga-select"
                                    required
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                                    <option value="">-- Pilih Warga --</option>
                                </select>
                            </div>
                            <div>
                                <label for="mk-sensus-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Tanggal Sensus
                                </label>
                                <input
                                    type="date"
                                    id="mk-sensus-tanggal"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>
                            <div>
                                <label for="mk-sensus-nik" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    NIK / No. KK
                                </label>
                                <input
                                    type="text"
                                    id="mk-sensus-nik"
                                    placeholder="Otomatis dari data warga"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>
                            <div>
                                <label id="mk-sensus-field-label" for="mk-sensus-nilai" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Data Sensus <span class="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="mk-sensus-nilai"
                                    required
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>
                            <div class="md:col-span-2">
                                <label id="mk-sensus-detail-label" for="mk-sensus-keterangan" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Keterangan Tambahan
                                </label>
                                <input
                                    type="text"
                                    id="mk-sensus-keterangan"
                                    class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                                >
                            </div>
                        </div>

                        <p id="mk-sensus-warga-info" class="hidden text-[11px] text-[#5c6d4e] dark:text-emerald-400"></p>

                        <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                            <button
                                type="button"
                                id="mk-sensus-reset-btn"
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
                    <div class="flex items-center gap-2">
                        <span id="mk-sensus-total" class="px-2.5 py-1.5 text-xs font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                            0 Data
                        </span>
                    </div>
                    <div class="w-full sm:w-72">
                        <input
                            type="text"
                            id="mk-sensus-search"
                            placeholder="Cari nama, NIK, atau hasil sensus..."
                            class="w-full px-3 py-2 text-xs bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                    </div>
                </div>

                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-[#f6f3ec] dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                            <tr>
                                <th class="px-4 py-3">Warga / NIK</th>
                                <th class="px-4 py-3">Tanggal</th>
                                <th id="mk-sensus-col-hasil" class="px-4 py-3">Hasil Sensus</th>
                                <th class="px-4 py-3">Keterangan</th>
                                <th id="mk-sensus-aksi-th" class="hidden px-4 py-3 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="mk-sensus-tbody" class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-800 dark:text-stone-200">
                            <tr>
                                <td colspan="5" class="p-8 text-center text-stone-500 dark:text-stone-400">
                                    Memuat data sensus...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

export function initManajemenKependudukanSensusHandler() {
    let items = [];
    let wargaList = [];
    let activeKategori = null;
    let isDestroyed = false;
    let feedbackTimerId = null;
    const isAdmin = getCurrentUserRole() === "administrator";
    const todayIso = getTodayDateString();

    const wrapperEl = document.getElementById("mk-sensus-wrapper");
    const feedbackEl = document.getElementById("mk-sensus-feedback");
    const cardsGridEl = document.getElementById("mk-sensus-cards-grid");
    const detailPanelEl = document.getElementById("mk-sensus-detail-panel");
    const activeTitleEl = document.getElementById("mk-sensus-active-title");
    const activeDescEl = document.getElementById("mk-sensus-active-desc");
    const toggleBtn = document.getElementById("mk-sensus-toggle-btn");
    const backCardsBtn = document.getElementById("mk-sensus-back-cards-btn");
    const formPanel = document.getElementById("mk-sensus-form-panel");
    const formEl = document.getElementById("mk-sensus-form");
    const formTitleEl = document.getElementById("mk-sensus-form-title");
    const editIdInput = document.getElementById("mk-sensus-edit-id");
    const wargaSelectEl = document.getElementById("mk-sensus-warga-select");
    const tanggalInputEl = document.getElementById("mk-sensus-tanggal");
    const nikInputEl = document.getElementById("mk-sensus-nik");
    const fieldLabelEl = document.getElementById("mk-sensus-field-label");
    const nilaiInputEl = document.getElementById("mk-sensus-nilai");
    const detailLabelEl = document.getElementById("mk-sensus-detail-label");
    const ketInputEl = document.getElementById("mk-sensus-keterangan");
    const wargaInfoEl = document.getElementById("mk-sensus-warga-info");
    const cancelBtn = document.getElementById("mk-sensus-cancel-btn");
    const resetBtn = document.getElementById("mk-sensus-reset-btn");
    const searchEl = document.getElementById("mk-sensus-search");
    const totalEl = document.getElementById("mk-sensus-total");
    const colHasilEl = document.getElementById("mk-sensus-col-hasil");
    const aksiThEl = document.getElementById("mk-sensus-aksi-th");
    const tbodyEl = document.getElementById("mk-sensus-tbody");

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

    function syncCardCounts() {
        SENSUS_CARDS.forEach((card) => {
            const countEl = document.getElementById(`mk-sensus-count-${card.id}`);
            if (countEl) {
                const count = items.filter((r) => normalizeKategori(r.kategoriSensus) === card.id).length;
                countEl.textContent = `${count} Data`;
            }
        });
    }

    function renderWargaSelectOptions(selectedWargaId = "") {
        if (!wargaSelectEl) return;
        const sorted = [...wargaList].sort((a, b) =>
            String(a.nama || "").localeCompare(String(b.nama || ""), "id")
        );
        const targetId = String(selectedWargaId ?? wargaSelectEl.value ?? "").trim();

        const html = [`<option value="">-- Pilih Warga --</option>`];
        sorted.forEach((w) => {
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

    function findWargaById(wargaId = "") {
        const id = String(wargaId || "").trim();
        if (!id) return null;
        return wargaList.find((w) => String(w.id || "").trim() === id) || null;
    }

    function onWargaSelectionChange(prefillKategoriValue = true) {
        const selectedId = String(wargaSelectEl?.value || "").trim();
        const found = findWargaById(selectedId);
        if (!found) {
            setWargaInfo("");
            return;
        }

        if (nikInputEl && !nikInputEl.value.trim()) {
            nikInputEl.value = String(found.nik || found.noKk || "").trim();
        }

        if (prefillKategoriValue && nilaiInputEl && !nilaiInputEl.value.trim()) {
            if (activeKategori === "pekerjaan" && found.pekerjaan) {
                nilaiInputEl.value = String(found.pekerjaan).trim();
            } else if (activeKategori === "pendidikan" && found.pendidikan) {
                nilaiInputEl.value = String(found.pendidikan).trim();
            }
        }

        const meta = [
            found.nik ? `NIK: ${found.nik}` : "",
            found.noKk ? `KK: ${found.noKk}` : "",
            found.pekerjaan ? `Kerja: ${found.pekerjaan}` : "",
            found.pendidikan ? `Pend: ${found.pendidikan}` : ""
        ]
            .filter(Boolean)
            .join(" • ");
        setWargaInfo(meta ? `Data warga: ${found.nama || "-"} (${meta})` : `Data warga: ${found.nama || "-"}`);
    }

    function applyKategoriLabels(cfg) {
        if (activeTitleEl) activeTitleEl.textContent = cfg.title.toUpperCase();
        if (activeDescEl) activeDescEl.textContent = cfg.description;
        if (colHasilEl) colHasilEl.textContent = cfg.fieldLabel;
        if (fieldLabelEl) {
            fieldLabelEl.innerHTML = `${escapeHtml(cfg.fieldLabel)} <span class="text-rose-500">*</span>`;
        }
        if (nilaiInputEl) nilaiInputEl.placeholder = cfg.fieldPlaceholder;
        if (detailLabelEl) detailLabelEl.textContent = cfg.detailLabel;
        if (ketInputEl) ketInputEl.placeholder = cfg.detailPlaceholder;
    }

    function fillForm(item = null) {
        const cfg = getCardConfig(activeKategori);
        if (editIdInput) editIdInput.value = item?.id || "";
        if (formTitleEl) {
            formTitleEl.textContent = item ? `EDIT ${cfg.title.toUpperCase()}` : `INPUT ${cfg.title.toUpperCase()}`;
        }
        setWargaInfo("");

        const selectedWargaId = String(item?.wargaId || "").trim();
        renderWargaSelectOptions(selectedWargaId);

        if (tanggalInputEl) tanggalInputEl.value = toDateInputValue(item?.tanggal) || todayIso;
        if (nikInputEl) nikInputEl.value = item?.nik || item?.noKk || "";
        if (nilaiInputEl) nilaiInputEl.value = item?.nilaiSensus || item?.pekerjaan || item?.pendidikan || item?.kondisiSosial || "";
        if (ketInputEl) ketInputEl.value = item?.keterangan || "";

        if (selectedWargaId) {
            onWargaSelectionChange(false);
            if (nikInputEl && (item?.nik || item?.noKk)) {
                nikInputEl.value = item.nik || item.noKk;
            }
        }
    }

    function openForm(item = null) {
        if (!isAdmin || !activeKategori) return;
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

    function openKategori(kategoriId) {
        const cfg = getCardConfig(kategoriId);
        activeKategori = cfg.id;
        applyKategoriLabels(cfg);
        closeForm();
        if (searchEl) searchEl.value = "";
        cardsGridEl?.classList.add("hidden");
        detailPanelEl?.classList.remove("hidden");
        renderRows();
    }

    function backToCards() {
        activeKategori = null;
        closeForm();
        detailPanelEl?.classList.add("hidden");
        cardsGridEl?.classList.remove("hidden");
        syncCardCounts();
    }

    function getFilteredRows() {
        if (!activeKategori) return [];
        const keyword = String(searchEl?.value || "").trim().toLowerCase();
        return items
            .filter((row) => normalizeKategori(row.kategoriSensus) === activeKategori)
            .filter((row) => {
                if (!keyword) return true;
                const hay = [
                    row.nama,
                    row.nik,
                    row.noKk,
                    row.nilaiSensus,
                    row.keterangan
                ]
                    .join(" ")
                    .toLowerCase();
                return hay.includes(keyword);
            });
    }

    function renderRows() {
        if (!tbodyEl || isDestroyed || !activeKategori) return;
        const cfg = getCardConfig(activeKategori);
        const rows = getFilteredRows();
        const colSpan = isAdmin ? 5 : 4;
        if (totalEl) totalEl.textContent = `${rows.length} Data`;

        if (!rows.length) {
            tbodyEl.innerHTML = `
                <tr>
                    <td colspan="${colSpan}" class="p-8 text-center text-stone-500 dark:text-stone-400">
                        Belum ada data pada ${escapeHtml(cfg.title)}.
                    </td>
                </tr>
            `;
            return;
        }

        tbodyEl.innerHTML = rows
            .map((row) => {
                const subNik = [row.nik ? `NIK: ${row.nik}` : "", row.noKk ? `KK: ${row.noKk}` : ""]
                    .filter(Boolean)
                    .join(" • ");
                const hasilText =
                    row.nilaiSensus || row.pekerjaan || row.pendidikan || row.kondisiSosial || "-";

                const actionTd = isAdmin
                    ? `
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1.5">
                                <button type="button" data-mk-sensus-edit="${escapeHtml(row.id)}" class="px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-stone-700 hover:border-[#c87d32] rounded-none cursor-pointer">Edit</button>
                                <button type="button" data-mk-sensus-delete="${escapeHtml(row.id)}" class="px-2.5 py-1 text-xs font-semibold border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-none cursor-pointer">Hapus</button>
                            </div>
                        </td>
                    `
                    : "";

                return `
                    <tr>
                        <td class="px-4 py-3">
                            <div class="font-semibold">${escapeHtml(row.nama || "-")}</div>
                            ${subNik ? `<div class="text-[11px] font-mono text-stone-500 dark:text-stone-400">${escapeHtml(subNik)}</div>` : ""}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(formatTanggalDisplay(row.tanggal))}</td>
                        <td class="px-4 py-3 font-semibold">${escapeHtml(hasilText)}</td>
                        <td class="px-4 py-3">${escapeHtml(row.keterangan || "-")}</td>
                        ${actionTd}
                    </tr>
                `;
            })
            .join("");
    }

    async function loadData() {
        try {
            const [sensusSnap, wargaSnap] = await Promise.all([
                getDocs(collection(db, COLLECTION_NAME)),
                getDocs(collection(db, WARGA_COLLECTION)).catch((err) => {
                    console.warn("Gagal memuat koleksi warga untuk sensus:", err);
                    return null;
                })
            ]);

            if (isDestroyed) return;

            const list = [];
            sensusSnap.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
            list.sort((a, b) =>
                String(b.tanggal || b.createdAt || "").localeCompare(String(a.tanggal || a.createdAt || ""))
            );

            const wList = [];
            if (wargaSnap) {
                wargaSnap.forEach((docSnap) => wList.push({ id: docSnap.id, ...docSnap.data() }));
            }

            items = list;
            wargaList = wList;

            syncCardCounts();
            renderWargaSelectOptions(wargaSelectEl?.value || "");
            if (activeKategori) renderRows();
        } catch (err) {
            console.error(`Gagal memuat koleksi ${COLLECTION_NAME}:`, err);
            showFeedback(`Gagal memuat data dari tabel ${COLLECTION_NAME}.`, "error");
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!isAdmin || !activeKategori) return;
        hideFeedback();

        const selectedWargaId = String(wargaSelectEl?.value || "").trim();
        const selectedWarga = findWargaById(selectedWargaId);
        const nama = String(selectedWarga?.nama || "").trim();
        const nilaiSensus = String(nilaiInputEl?.value || "").trim();

        if (!selectedWargaId || !nama) {
            showFeedback("Pilih warga dari Data Warga terlebih dahulu.", "error");
            return;
        }
        if (!nilaiSensus) {
            showFeedback("Isi data hasil sensus terlebih dahulu.", "error");
            return;
        }

        const nowIso = new Date().toISOString();
        const rawNikOrKk = String(nikInputEl?.value || "").trim();
        const nik = String(selectedWarga?.nik || (rawNikOrKk.length === 16 ? rawNikOrKk : "")).trim();
        const noKk = String(selectedWarga?.noKk || "").trim();

        const payload = {
            kategoriSensus: activeKategori,
            wargaId: selectedWargaId,
            nama,
            nik,
            noKk,
            tanggal: toDateInputValue(tanggalInputEl?.value) || todayIso,
            nilaiSensus,
            keterangan: String(ketInputEl?.value || "").trim(),
            updatedAt: nowIso
        };

        const editId = editIdInput?.value.trim() || "";
        try {
            if (editId) {
                await updateDoc(doc(db, COLLECTION_NAME, editId), payload);
                showFeedback("Data sensus berhasil diperbarui.");
            } else {
                await addDoc(collection(db, COLLECTION_NAME), {
                    ...payload,
                    createdAt: nowIso
                });
                showFeedback("Data sensus berhasil disimpan.");
            }
            closeForm();
            await loadData();
        } catch (err) {
            console.error(`Gagal menyimpan data ${COLLECTION_NAME}:`, err);
            showFeedback("Gagal menyimpan data sensus.", "error");
        }
    }

    const onDelegateClick = async (e) => {
        if (wrapperEl && !wrapperEl.contains(e.target)) return;

        const cardBtn = e.target.closest("[data-mk-sensus-card]");
        if (cardBtn) {
            const katId = cardBtn.getAttribute("data-mk-sensus-card");
            if (katId) openKategori(katId);
            return;
        }

        if (!isAdmin) return;

        const editBtn = e.target.closest("[data-mk-sensus-edit]");
        if (editBtn) {
            const id = editBtn.getAttribute("data-mk-sensus-edit");
            const found = items.find((r) => r.id === id);
            if (found) openForm(found);
            return;
        }

        const deleteBtn = e.target.closest("[data-mk-sensus-delete]");
        if (deleteBtn) {
            const id = deleteBtn.getAttribute("data-mk-sensus-delete");
            if (!id || !window.confirm("Hapus data sensus ini?")) return;
            try {
                await deleteDoc(doc(db, COLLECTION_NAME, id));
                if (editIdInput?.value === id) closeForm();
                showFeedback("Data sensus berhasil dihapus.");
                await loadData();
            } catch (err) {
                console.error(`Gagal menghapus data ${COLLECTION_NAME}:`, err);
                showFeedback("Gagal menghapus data sensus.", "error");
            }
        }
    };

    toggleBtn?.addEventListener("click", () => {
        if (formPanel?.classList.contains("hidden")) openForm(null);
        else closeForm();
    });
    backCardsBtn?.addEventListener("click", backToCards);
    cancelBtn?.addEventListener("click", closeForm);
    resetBtn?.addEventListener("click", () => {
        const editingId = editIdInput?.value.trim() || "";
        const editingItem = editingId ? items.find((r) => r.id === editingId) || null : null;
        fillForm(editingItem);
    });
    wargaSelectEl?.addEventListener("change", () => {
        if (nikInputEl) nikInputEl.value = "";
        if (nilaiInputEl) nilaiInputEl.value = "";
        onWargaSelectionChange(true);
    });
    formEl?.addEventListener("submit", handleSubmit);
    searchEl?.addEventListener("input", renderRows);
    document.addEventListener("click", onDelegateClick);

    loadData();

    return () => {
        isDestroyed = true;
        if (feedbackTimerId !== null) {
            window.clearTimeout(feedbackTimerId);
            feedbackTimerId = null;
        }
        backCardsBtn?.removeEventListener("click", backToCards);
        cancelBtn?.removeEventListener("click", closeForm);
        formEl?.removeEventListener("submit", handleSubmit);
        searchEl?.removeEventListener("input", renderRows);
        document.removeEventListener("click", onDelegateClick);
    };
}

export default renderManajemenKependudukanSensus;