// File: assets/js/views/reset-data.js
import { collection, getDocs, doc, getDoc, writeBatch, query, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const DEFAULT_RESET_COLLECTIONS = [
    { key: "jurnal_umum", label: "Jurnal Umum (jurnal_umum)", desc: "Data transaksi jurnal keuangan & rincian debet/kredit.", defaultChecked: false },
    { key: "saldo_awal", label: "Saldo Awal (saldo_awal)", desc: "Data saldo awal akun neraca per periode dan unit/kas.", defaultChecked: false },
    { key: "tutup_bulan", label: "Tutup Bulan (tutup_bulan)", desc: "Catatan penutupan buku dan rekapan bulanan.", defaultChecked: false },
    { key: "pagu_anggaran", label: "Pagu Anggaran (pagu_anggaran)", desc: "Data pagu anggaran belanja / pengeluaran RTKu Digital.", defaultChecked: false },
    { key: "kas_warga", label: "Kas Warga (kas_warga)", desc: "Data iuran, kas, dan mutasi keuangan warga.", defaultChecked: false },
    { key: "nota_aset", label: "Nota Aset (nota_aset)", desc: "Data pencatatan dan nota aset RTKu Digital.", defaultChecked: false },
    { key: "rapat_rt", label: "Rapat RT (rapat_rt)", desc: "Data agenda, jadwal, dan notulensi rapat RT.", defaultChecked: false },
    { key: "pesan_rt", label: "Pesan RT (pesan_rt)", desc: "Data pesan masuk, keperluan, dan informasi warga RT.", defaultChecked: false },
    { key: "berita", label: "Berita (berita)", desc: "Data berita dan informasi publikasi.", defaultChecked: false },
    { key: "pengurus_rt", label: "Pengurus RT (pengurus_rt)", desc: "Data pengurus RT dan struktur organisasi.", defaultChecked: false },
    { key: "products", label: "Produk & Layanan (products)", desc: "Data katalog produk / layanan lingkungan.", defaultChecked: false },
    { key: "paket_wisata", label: "Paket & Layanan (paket_wisata)", desc: "Data item paket atau layanan unggulan.", defaultChecked: false },
    { key: "events", label: "Events / Agenda (events)", desc: "Data berita dan agenda kegiatan yang dipublikasikan.", defaultChecked: false },
    { key: "galeri", label: "Galeri (galeri)", desc: "Data foto dan dokumentasi kegiatan warga.", defaultChecked: false },
    { key: "banners", label: "Banners (banners)", desc: "Data banner tampilan halaman.", defaultChecked: false },
    { key: "running_text", label: "Running Text (running_text)", desc: "Data teks berjalan / pengumuman warga.", defaultChecked: false },
    { key: "kontak", label: "Kontak (kontak)", desc: "Data kontak pengurus RT / relasi.", defaultChecked: false },
    { key: "unit_usaha", label: "Unit & Layanan (unit_usaha)", desc: "Data master unit / kas & layanan RTKu Digital.", defaultChecked: false },
    { key: "coa", label: "Chart of Accounts (coa)", desc: "Master bagan akun perkiraan akuntansi.", defaultChecked: false },
    { key: "pengaturan", label: "Pengaturan (pengaturan)", desc: "Data pengaturan umum aplikasi RTKu Digital.", defaultChecked: false },
    { key: "pengaturan_sistem", label: "Pengaturan Sistem (pengaturan_sistem)", desc: "Konfigurasi periode awal dan pengaturan sistem.", defaultChecked: false },
    { key: "users", label: "Pengguna / Akun (users)", desc: "Data akun pengguna dan hak akses sistem.", defaultChecked: false }
];

const EXTRA_DETECT_COLLECTIONS = [
    "berita",
    "pengurus_rt",
    "warga",
    "iuran",
    "kas",
    "keuangan",
    "aset",
    "agenda",
    "pengumuman",
    "notulensi",
    "rapat",
    "pesan"
];

const DISMISSED_CACHE_KEY = "rtku_reset_dismissed_collections_v1";
const RELATED_SESSION_CACHE_KEYS = [
    "rtku_firestore_size_estimate_v1",
    "rtku_profil_cache_v1",
    "rtku_running_text_cache_v1"
];

function escapeHtml(val) {
    return String(val ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function readDismissedKeys() {
    try {
        const raw = sessionStorage.getItem(DISMISSED_CACHE_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? new Set(arr.filter((k) => typeof k === "string" && k.trim())) : new Set();
    } catch (_) {
        return new Set();
    }
}

function writeDismissedKeys(keySet) {
    try {
        sessionStorage.setItem(DISMISSED_CACHE_KEY, JSON.stringify(Array.from(keySet)));
    } catch (_) {
        // Abaikan jika storage dibatasi
    }
}

function clearRelatedSessionCache() {
    RELATED_SESSION_CACHE_KEYS.forEach((key) => {
        try {
            sessionStorage.removeItem(key);
        } catch (_) {
            // Abaikan jika storage dibatasi
        }
    });
}

function formatCollectionLabel(key) {
    const clean = String(key || "").trim();
    const title = clean.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
    return `${title} (${clean})`;
}

function formatDocCountLabel(count) {
    if (typeof count !== "number" || Number.isNaN(count)) return "Cek...";
    return `${count} dok.`;
}

function buildDesktopItemHtml(item, isChecked, isNew, docCount = null) {
    const safeKey = escapeHtml(item.key);
    const baseSurface = isChecked
        ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-500"
        : isNew
            ? "bg-sky-50/70 dark:bg-sky-950/25 border-sky-300 dark:border-sky-800"
            : "bg-slate-50/80 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800";

    return `
        <div data-item-key="${safeKey}" class="reset-desktop-item flex items-start gap-3 p-3.5 ${baseSurface} hover:bg-slate-100/80 dark:hover:bg-slate-900 border rounded-none transition select-none">
            <input type="checkbox" name="reset-collection-item" value="${safeKey}" ${isChecked ? "checked" : ""}
                class="chk-reset-item mt-0.5 w-4 h-4 accent-rose-600 border-slate-300 rounded-none cursor-pointer flex-shrink-0">
            <label class="min-w-0 flex-1 cursor-pointer">
                <div class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center flex-wrap gap-1.5">
                    <span>${escapeHtml(item.label)}</span>
                    <span data-doc-count="${safeKey}" class="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">${escapeHtml(formatDocCountLabel(docCount))}</span>
                    ${isNew ? `<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-sky-600 text-white">Baru</span>` : ""}
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(item.desc)}</div>
            </label>
            <button type="button" data-remove-reset-key="${safeKey}" title="Hapus dari daftar ceklist (bisa dideteksi ulang)"
                class="btn-remove-reset-item px-1.5 py-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-sm leading-none rounded-none transition cursor-pointer flex-shrink-0"
                aria-label="Hapus ${safeKey} dari daftar">&times;</button>
        </div>
    `;
}

function buildMobileCardHtml(item, isChecked, isNew, docCount = null) {
    const safeKey = escapeHtml(item.key);
    return `
        <div data-card-key="${safeKey}" class="reset-mobile-card flex items-start gap-3 p-3.5 ${isNew ? "bg-sky-50/50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800" : "bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800"} border rounded-none transition select-none active:bg-slate-100 dark:active:bg-slate-900">
            <input type="checkbox" value="${safeKey}" ${isChecked ? "checked" : ""}
                class="chk-reset-mobile mt-1 w-5 h-5 accent-rose-600 border-slate-300 rounded-none cursor-pointer flex-shrink-0">
            <label class="min-w-0 flex-1 space-y-1 cursor-pointer">
                <div class="flex items-start justify-between gap-2">
                    <span class="text-xs font-bold text-slate-800 dark:text-slate-100 break-all inline-flex items-center flex-wrap gap-1.5">
                        <span>${escapeHtml(item.label)}</span>
                        <span data-doc-count="${safeKey}" class="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">${escapeHtml(formatDocCountLabel(docCount))}</span>
                        ${isNew ? `<span class="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-sky-600 text-white">Baru</span>` : ""}
                    </span>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <span class="badge-reset-status px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Belum</span>
                        <button type="button" data-remove-reset-key="${safeKey}" title="Hapus dari daftar ceklist"
                            class="btn-remove-reset-item px-1.5 py-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-sm leading-none rounded-none transition cursor-pointer"
                            aria-label="Hapus ${safeKey} dari daftar">&times;</button>
                    </div>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">${escapeHtml(item.desc)}</p>
            </label>
        </div>
    `;
}

export function renderResetData() {
    const dismissedKeys = readDismissedKeys();
    const initialCollections = DEFAULT_RESET_COLLECTIONS.filter((item) => !dismissedKeys.has(item.key));

    const desktopItemsHtml = initialCollections.map((item) =>
        buildDesktopItemHtml(item, item.defaultChecked, false, null)
    ).join("");

    const mobileCardsHtml = initialCollections.map((item) =>
        buildMobileCardHtml(item, item.defaultChecked, false, null)
    ).join("");

    return `
        <div class="space-y-6 pb-10 max-w-7xl mx-auto animate-fade-in">
            <!-- Header Halaman -->
            <div class="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-none border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div class="flex items-center gap-3">
                    <a href="#/database" data-link title="Kembali ke Database" class="w-9 h-9 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center rounded-none transition flex-shrink-0">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                        </svg>
                    </a>
                    <div>
                        <h1 class="text-base font-bold text-slate-800 dark:text-slate-100">Reset Data Sistem — RTKu Digital</h1>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola daftar koleksi ceklist (Hapus Pilihan) atau reset data dokumen Firestore pada koleksi terpilih.</p>
                    </div>
                </div>
            </div>

            <!-- Panel Checklist Reset Data -->
            <div class="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-none border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <p class="text-xs text-rose-600 dark:text-rose-400 font-semibold">Peringatan: "Hapus Pilihan" menghapus item dari daftar ceklist saja; "Eksekusi Reset Data" menghapus isi dokumen di Firestore.</p>
                        <p id="reset-selected-count" class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">0 dari ${initialCollections.length} koleksi dipilih</p>
                    </div>
                    <div class="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
                        <button type="button" id="btn-deteksi-koleksi-reset" class="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold border border-sky-700 rounded-none transition cursor-pointer text-center">
                            Deteksi Koleksi
                        </button>
                        <button type="button" id="btn-pilih-semua-reset" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-none transition cursor-pointer text-center">
                            Pilih Semua
                        </button>
                        <button type="button" id="btn-hapus-pilihan-reset" title="Keluarkan item yang dicentang dari daftar ceklist" class="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold border border-amber-600 rounded-none transition cursor-pointer text-center">
                            Hapus Pilihan
                        </button>
                        <button type="button" id="btn-batal-reset" class="px-3.5 py-2 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-none transition cursor-pointer text-center">
                            Batal
                        </button>
                    </div>
                </div>

                <!-- Tampilan HP / Mobile (Card View) -->
                <div id="reset-card-container" class="block md:hidden space-y-2.5">
                    ${mobileCardsHtml}
                </div>

                <!-- Tampilan Desktop / Tablet (Grid Checklist) -->
                <div id="reset-checklist-container" class="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-3">
                    ${desktopItemsHtml}
                </div>

                <!-- Progres & Tombol Eksekusi -->
                <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <span id="reset-progress-status" class="text-xs text-slate-500 dark:text-slate-400">Siap mengeksekusi reset data.</span>
                    <button type="button" id="btn-eksekusi-reset" class="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-5 py-2.5 rounded-none transition cursor-pointer shadow-sm text-center">
                        Eksekusi Reset Data
                    </button>
                </div>
            </div>

            <!-- Modal Konfirmasi Smooth (Kotak Siku) -->
            <div id="modal-konfirmasi-reset" class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/0 backdrop-blur-[1px] p-4 opacity-0 transition-opacity duration-200 ease-out">
                <div id="modal-konfirmasi-reset-card" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-none w-full max-w-md overflow-hidden transform scale-95 opacity-0 transition-all duration-200 ease-out">
                    <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5">
                            <span class="w-7 h-7 bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>
                            </span>
                            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Konfirmasi Reset Data</h2>
                        </div>
                        <button type="button" id="btn-tutup-konfirmasi-reset" class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 transition cursor-pointer" title="Tutup">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <div class="p-5 space-y-4 text-xs">
                        <p id="konfirmasi-reset-pesan" class="text-slate-600 dark:text-slate-300 leading-relaxed">Apakah Anda yakin ingin menghapus data pada koleksi terpilih?</p>
                        <div id="konfirmasi-reset-daftar" class="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-1 font-semibold text-slate-700 dark:text-slate-200"></div>
                        <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button type="button" id="btn-batal-konfirmasi-reset" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-none transition cursor-pointer">Batal</button>
                            <button type="button" id="btn-ya-konfirmasi-reset" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-none transition cursor-pointer shadow-sm">Ya, Reset Sekarang</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toast Notifikasi Smooth (Kotak Siku) -->
            <div id="toast-reset-data" class="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 transform translate-y-6 opacity-0 transition-all duration-250 ease-out pointer-events-none">
                <div class="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3 rounded-none shadow-xl border border-slate-700 dark:border-slate-200 flex items-center gap-3 text-xs font-semibold">
                    <svg id="toast-reset-icon" class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span id="toast-reset-message">Pesan notifikasi</span>
                </div>
            </div>
        </div>
    `;
}

let resetDataCleanup = null;
let resetToastTimer = null;

export function initResetDataHandler() {
    if (typeof resetDataCleanup === "function") {
        resetDataCleanup();
        resetDataCleanup = null;
    }

    const desktopContainer = document.getElementById('reset-checklist-container');
    const mobileContainer = document.getElementById('reset-card-container');

    const btnDeteksi = document.getElementById('btn-deteksi-koleksi-reset');
    const btnPilihSemua = document.getElementById('btn-pilih-semua-reset');
    const btnHapusPilihan = document.getElementById('btn-hapus-pilihan-reset');
    const btnBatal = document.getElementById('btn-batal-reset');
    const btnEksekusi = document.getElementById('btn-eksekusi-reset');
    const selectedCountEl = document.getElementById('reset-selected-count');
    const progressStatusEl = document.getElementById('reset-progress-status');

    const modalKonfirmasi = document.getElementById('modal-konfirmasi-reset');
    const modalCard = document.getElementById('modal-konfirmasi-reset-card');
    const konfirmasiPesan = document.getElementById('konfirmasi-reset-pesan');
    const konfirmasiDaftar = document.getElementById('konfirmasi-reset-daftar');
    const btnTutupModal = document.getElementById('btn-tutup-konfirmasi-reset');
    const btnBatalModal = document.getElementById('btn-batal-konfirmasi-reset');
    const btnYaModal = document.getElementById('btn-ya-konfirmasi-reset');

    const dismissedKeysSet = readDismissedKeys();
    const defaultByKey = new Map(DEFAULT_RESET_COLLECTIONS.map((c) => [c.key, c]));

    let isDestroyed = false;
    let confirmResolver = null;
    let confirmCloseTimer = null;
    let resetCollections = DEFAULT_RESET_COLLECTIONS.filter((item) => !dismissedKeysSet.has(item.key));
    let docCountsMap = new Map();
    let newlyDetectedSet = new Set();
    let selectedKeysSet = new Set();
    let isBusy = false;

    function showToast(message, isError = false) {
        if (isDestroyed) return;
        const toast = document.getElementById('toast-reset-data');
        const msgEl = document.getElementById('toast-reset-message');
        const iconEl = document.getElementById('toast-reset-icon');
        if (!toast || !msgEl) return;

        if (resetToastTimer) clearTimeout(resetToastTimer);

        msgEl.textContent = message;
        if (iconEl) {
            iconEl.setAttribute('class', isError ? 'w-4 h-4 text-rose-500 flex-shrink-0' : 'w-4 h-4 text-emerald-400 flex-shrink-0');
            iconEl.innerHTML = isError
                ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`
                : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`;
        }

        toast.classList.remove('translate-y-6', 'opacity-0', 'pointer-events-none');
        toast.classList.add('translate-y-0', 'opacity-100');

        resetToastTimer = setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-6', 'opacity-0', 'pointer-events-none');
        }, 3000);
    }

    function getSelectedCollections() {
        return resetCollections.filter((item) => selectedKeysSet.has(item.key));
    }

    function updateDocCountBadges() {
        document.querySelectorAll('[data-doc-count]').forEach((badge) => {
            const key = badge.getAttribute('data-doc-count');
            if (!key) return;
            const count = docCountsMap.get(key);
            badge.textContent = formatDocCountLabel(count);
        });
    }

    async function refreshCollectionCounts() {
        const currentItems = [...resetCollections];
        for (const item of currentItems) {
            if (isDestroyed) return;
            try {
                const snap = await getDocs(collection(db, item.key));
                docCountsMap.set(item.key, snap.size);
            } catch (_) {
                docCountsMap.set(item.key, 0);
            }
            if (!isDestroyed) {
                updateDocCountBadges();
            }
        }
    }

    function syncVisualStates() {
        const desktopCheckboxes = Array.from(document.querySelectorAll('.chk-reset-item'));
        const desktopItems = Array.from(document.querySelectorAll('.reset-desktop-item'));
        const mobileCheckboxes = Array.from(document.querySelectorAll('.chk-reset-mobile'));
        const mobileCards = Array.from(document.querySelectorAll('.reset-mobile-card'));
        const removeButtons = Array.from(document.querySelectorAll('.btn-remove-reset-item'));

        desktopCheckboxes.forEach((chk) => {
            chk.checked = selectedKeysSet.has(chk.value);
            chk.disabled = isBusy;
        });

        desktopItems.forEach((itemEl) => {
            const key = itemEl.getAttribute('data-item-key') || "";
            const isChecked = selectedKeysSet.has(key);
            itemEl.classList.toggle('border-rose-500', isChecked);
            itemEl.classList.toggle('bg-rose-50/40', isChecked);
            itemEl.classList.toggle('dark:bg-rose-950/20', isChecked);
            itemEl.classList.toggle('border-slate-200', !isChecked);
            itemEl.classList.toggle('dark:border-slate-800', !isChecked);
        });

        mobileCheckboxes.forEach((chk) => {
            chk.checked = selectedKeysSet.has(chk.value);
            chk.disabled = isBusy;
        });

        removeButtons.forEach((btn) => {
            btn.disabled = isBusy;
        });

        mobileCards.forEach((card) => {
            const key = card.getAttribute('data-card-key') || "";
            const isChecked = selectedKeysSet.has(key);
            const badge = card.querySelector('.badge-reset-status');

            card.classList.toggle('border-rose-500', isChecked);
            card.classList.toggle('bg-rose-50/40', isChecked);
            card.classList.toggle('dark:bg-rose-950/20', isChecked);
            card.classList.toggle('border-slate-200', !isChecked);
            card.classList.toggle('dark:border-slate-800', !isChecked);

            if (badge) {
                badge.textContent = isChecked ? "Dipilih" : "Belum";
                badge.className = isChecked
                    ? "badge-reset-status px-2 py-0.5 text-[10px] font-bold uppercase bg-rose-600 text-white border border-rose-600 flex-shrink-0"
                    : "badge-reset-status px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex-shrink-0";
            }
        });

        if (selectedCountEl) {
            selectedCountEl.textContent = `${selectedKeysSet.size} dari ${resetCollections.length} koleksi dipilih`;
        }
    }

    function renderChecklistContainers() {
        if (resetCollections.length === 0) {
            const emptyHtml = `
                <div class="col-span-full p-6 text-center bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <div>Semua item koleksi telah dihapus dari daftar ceklist saat ini.</div>
                    <div class="text-[11px] text-slate-400">Klik <strong>Deteksi Koleksi</strong> untuk memindai dan memunculkan kembali koleksi aktif secara otomatis.</div>
                </div>
            `;
            if (desktopContainer) desktopContainer.innerHTML = emptyHtml;
            if (mobileContainer) mobileContainer.innerHTML = emptyHtml;
            syncVisualStates();
            return;
        }

        if (desktopContainer) {
            desktopContainer.innerHTML = resetCollections
                .map((item) => buildDesktopItemHtml(item, selectedKeysSet.has(item.key), newlyDetectedSet.has(item.key), docCountsMap.get(item.key)))
                .join("");
        }
        if (mobileContainer) {
            mobileContainer.innerHTML = resetCollections
                .map((item) => buildMobileCardHtml(item, selectedKeysSet.has(item.key), newlyDetectedSet.has(item.key), docCountsMap.get(item.key)))
                .join("");
        }
        syncVisualStates();
    }

    function setControlsDisabledState(disabled) {
        isBusy = disabled;
        if (btnDeteksi) btnDeteksi.disabled = disabled;
        if (btnPilihSemua) btnPilihSemua.disabled = disabled;
        if (btnHapusPilihan) btnHapusPilihan.disabled = disabled;
        if (btnBatal) btnBatal.disabled = disabled;
        syncVisualStates();
    }

    function removeCollectionFromChecklist(key) {
        if (isBusy || !key) return;
        const targetItem = resetCollections.find((item) => item.key === key);
        if (!targetItem) return;

        resetCollections = resetCollections.filter((item) => item.key !== key);
        selectedKeysSet.delete(key);
        newlyDetectedSet.delete(key);
        dismissedKeysSet.add(key);
        writeDismissedKeys(dismissedKeysSet);

        renderChecklistContainers();
        if (progressStatusEl) {
            progressStatusEl.textContent = `Koleksi "${key}" dihapus dari daftar ceklist. Klik Deteksi Koleksi untuk mendeteksi ulang.`;
        }
        showToast(`"${targetItem.label}" dihapus dari ceklist (bisa dideteksi ulang).`);
    }

    function onHapusPilihanClick() {
        if (isBusy) return;
        const selectedList = getSelectedCollections();
        if (selectedList.length === 0) {
            showToast("Centang minimal satu item yang ingin dihapus dari ceklist.", true);
            return;
        }

        const keysToRemove = new Set(selectedList.map((item) => item.key));
        resetCollections = resetCollections.filter((item) => !keysToRemove.has(item.key));
        keysToRemove.forEach((key) => {
            selectedKeysSet.delete(key);
            newlyDetectedSet.delete(key);
            dismissedKeysSet.add(key);
        });
        writeDismissedKeys(dismissedKeysSet);

        renderChecklistContainers();
        if (progressStatusEl) {
            progressStatusEl.textContent = `${selectedList.length} item pilihan dihapus dari daftar ceklist (tidak menyentuh data Firestore).`;
        }
        showToast(`${selectedList.length} item pilihan dihapus dari ceklist.`);
    }

    async function deteksiKoleksiBaru() {
        if (isBusy) return;
        setControlsDisabledState(true);
        if (btnDeteksi) btnDeteksi.textContent = "Mendeteksi...";
        if (progressStatusEl) progressStatusEl.textContent = "Memindai koleksi database Firestore...";

        const existingKeys = new Set(resetCollections.map((c) => c.key));
        const candidateKeys = new Set([
            ...DEFAULT_RESET_COLLECTIONS.map((c) => c.key),
            ...EXTRA_DETECT_COLLECTIONS,
            ...resetCollections.map((c) => c.key),
            ...Array.from(dismissedKeysSet)
        ]);

        try {
            const monCfgSnap = await getDoc(doc(db, "pengaturan", "monitoring_config"));
            if (monCfgSnap.exists() && Array.isArray(monCfgSnap.data()?.collections)) {
                monCfgSnap.data().collections.forEach((k) => {
                    if (typeof k === "string" && k.trim()) candidateKeys.add(k.trim());
                });
            }
        } catch (_) {
            // Abaikan jika tidak tersedia
        }

        try {
            const sysCfgSnap = await getDoc(doc(db, "pengaturan_sistem", "app_config"));
            if (sysCfgSnap.exists() && Array.isArray(sysCfgSnap.data()?.collections)) {
                sysCfgSnap.data().collections.forEach((k) => {
                    if (typeof k === "string" && k.trim()) candidateKeys.add(k.trim());
                });
            }
        } catch (_) {
            // Abaikan jika tidak tersedia
        }

        const addedKeys = [];
        for (const key of Array.from(candidateKeys)) {
            if (existingKeys.has(key)) continue;
            try {
                const snap = await getDocs(query(collection(db, key), limit(1)));
                if (!snap.empty) {
                    const knownItem = defaultByKey.get(key);
                    resetCollections.push(knownItem || {
                        key,
                        label: formatCollectionLabel(key),
                        desc: "Koleksi baru terdeteksi otomatis dari database Firestore.",
                        defaultChecked: false
                    });
                    existingKeys.add(key);
                    dismissedKeysSet.delete(key);
                    newlyDetectedSet.add(key);
                    addedKeys.push(key);
                }
            } catch (_) {
                // Lewati koleksi yang tidak dapat dibaca
            }
        }

        writeDismissedKeys(dismissedKeysSet);

        if (addedKeys.length > 0) {
            renderChecklistContainers();
            if (progressStatusEl) {
                progressStatusEl.textContent = `Terdeteksi ${addedKeys.length} koleksi: ${addedKeys.join(", ")}.`;
            }
            showToast(`Terdeteksi ulang: ${addedKeys.length} koleksi ditambahkan.`);
        } else {
            if (progressStatusEl) {
                progressStatusEl.textContent = "Deteksi selesai: tidak ada koleksi aktif baru ditemukan.";
            }
            showToast("Tidak ada koleksi baru ditemukan.");
        }

        await refreshCollectionCounts();

        if (btnDeteksi) btnDeteksi.textContent = "Deteksi Koleksi";
        setControlsDisabledState(false);
    }

    function finishConfirm(result) {
        if (!modalKonfirmasi || !modalCard) {
            if (confirmResolver) {
                const resolve = confirmResolver;
                confirmResolver = null;
                resolve(result);
            }
            return;
        }

        if (confirmCloseTimer) clearTimeout(confirmCloseTimer);

        modalKonfirmasi.classList.remove('bg-slate-950/60', 'opacity-100');
        modalKonfirmasi.classList.add('bg-slate-950/0', 'opacity-0');
        modalCard.classList.remove('scale-100', 'opacity-100');
        modalCard.classList.add('scale-95', 'opacity-0');

        const resolve = confirmResolver;
        confirmResolver = null;

        confirmCloseTimer = setTimeout(() => {
            modalKonfirmasi.classList.add('hidden');
            modalKonfirmasi.classList.remove('flex');
            if (resolve) resolve(result);
        }, 200);
    }

    function openConfirmModal(selectedList) {
        if (!modalKonfirmasi || !modalCard) return Promise.resolve(false);

        if (confirmResolver) {
            const prevResolve = confirmResolver;
            confirmResolver = null;
            prevResolve(false);
        }

        if (confirmCloseTimer) clearTimeout(confirmCloseTimer);

        const totalSelectedDocs = selectedList.reduce((acc, c) => {
            const n = docCountsMap.get(c.key);
            return acc + (typeof n === "number" ? n : 0);
        }, 0);

        if (konfirmasiPesan) {
            konfirmasiPesan.textContent = `Tindakan ini akan menghapus seluruh dokumen (${totalSelectedDocs} dok.) pada ${selectedList.length} koleksi berikut secara permanen:`;
        }
        if (konfirmasiDaftar) {
            konfirmasiDaftar.innerHTML = selectedList
                .map((c) => {
                    const count = docCountsMap.get(c.key);
                    const countSuffix = typeof count === "number" ? ` (${count} dok.)` : "";
                    return `<div>&bull; ${escapeHtml(c.label)}${escapeHtml(countSuffix)}</div>`;
                })
                .join("");
        }

        modalKonfirmasi.classList.remove('hidden');
        modalKonfirmasi.classList.add('flex');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modalKonfirmasi.classList.remove('bg-slate-950/0', 'opacity-0');
                modalKonfirmasi.classList.add('bg-slate-950/60', 'opacity-100');
                modalCard.classList.remove('scale-95', 'opacity-0');
                modalCard.classList.add('scale-100', 'opacity-100');
            });
        });

        return new Promise((resolve) => {
            confirmResolver = resolve;
        });
    }

    async function deleteCollectionDocuments(colName) {
        const snap = await getDocs(collection(db, colName));
        const docRefs = snap.docs.map((d) => doc(db, colName, d.id));
        const chunkSize = 450;

        for (let i = 0; i < docRefs.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = docRefs.slice(i, i + chunkSize);
            chunk.forEach((ref) => batch.delete(ref));
            await batch.commit();
        }

        return docRefs.length;
    }

    const onContainerChange = (e) => {
        const target = e.target;
        if (!target || !(target instanceof HTMLInputElement)) return;
        if (!target.classList.contains('chk-reset-item') && !target.classList.contains('chk-reset-mobile')) return;

        if (target.checked) selectedKeysSet.add(target.value);
        else selectedKeysSet.delete(target.value);
        syncVisualStates();
    };

    const onContainerClick = (e) => {
        const removeBtn = e.target.closest('[data-remove-reset-key]');
        if (!removeBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const key = removeBtn.getAttribute('data-remove-reset-key');
        removeCollectionFromChecklist(key);
    };

    const onPilihSemuaClick = () => {
        selectedKeysSet = new Set(resetCollections.map((item) => item.key));
        syncVisualStates();
        if (progressStatusEl) {
            progressStatusEl.textContent = `${selectedKeysSet.size} item dipilih. Klik "Hapus Pilihan" untuk menghapus dari ceklist atau "Eksekusi Reset Data" untuk reset dokumen.`;
        }
    };

    const onBatalClick = () => {
        selectedKeysSet.clear();
        syncVisualStates();
        if (progressStatusEl) {
            progressStatusEl.textContent = "Pilihan ceklist dibatalkan (dikosongkan).";
        }
        showToast("Pilihan ceklist dibatalkan.");
    };

    const onEksekusiClick = async () => {
        if (isBusy) return;
        const selectedList = getSelectedCollections();
        if (selectedList.length === 0) {
            showToast("Pilih minimal satu koleksi pada ceklist terlebih dahulu.", true);
            return;
        }

        const yakin = await openConfirmModal(selectedList);
        if (!yakin) return;

        const originalBtnText = btnEksekusi ? btnEksekusi.textContent : "Eksekusi Reset Data";
        if (btnEksekusi) {
            btnEksekusi.disabled = true;
            btnEksekusi.textContent = "Mereset Data...";
        }
        setControlsDisabledState(true);

        let totalDeletedDocs = 0;
        const deletedKeys = new Set();

        try {
            for (let i = 0; i < selectedList.length; i++) {
                const colItem = selectedList[i];
                if (progressStatusEl) {
                    progressStatusEl.textContent = `Menghapus koleksi ${colItem.key} (${i + 1}/${selectedList.length})...`;
                }
                const count = await deleteCollectionDocuments(colItem.key);
                totalDeletedDocs += count;
                deletedKeys.add(colItem.key);
                docCountsMap.set(colItem.key, 0);
                updateDocCountBadges();
            }

            clearRelatedSessionCache();
            if ((deletedKeys.has("pengaturan") || deletedKeys.has("running_text")) && typeof window.reloadGlobalRunningText === "function") {
                window.reloadGlobalRunningText();
            }
            if (deletedKeys.has("pengaturan") && typeof window.reloadCompanyProfile === "function") {
                window.reloadCompanyProfile();
            }

            selectedKeysSet.clear();
            syncVisualStates();

            if (progressStatusEl) {
                progressStatusEl.textContent = `Selesai: ${totalDeletedDocs} dokumen dihapus dari ${selectedList.length} koleksi.`;
            }
            showToast(`Reset selesai: ${totalDeletedDocs} dokumen dihapus.`);
        } catch (err) {
            console.error("Gagal mengeksekusi reset data:", err);
            const errDetail = err?.code ? ` (${err.code})` : "";
            if (progressStatusEl) {
                progressStatusEl.textContent = `Gagal mereset data${errDetail}: ${err?.message || "Periksa izin/koneksi Firestore."}`;
            }
            showToast(`Gagal mereset data${errDetail}. Periksa izin Firestore.`, true);
        } finally {
            if (btnEksekusi) {
                btnEksekusi.disabled = false;
                btnEksekusi.textContent = originalBtnText;
            }
            setControlsDisabledState(false);
        }
    };

    const onModalBackdropClick = (e) => {
        if (e.target === modalKonfirmasi) {
            finishConfirm(false);
        }
    };

    const onEscapeKey = (e) => {
        if (e.key === "Escape" && confirmResolver) {
            finishConfirm(false);
        }
    };

    document.querySelectorAll('.chk-reset-item, .chk-reset-mobile').forEach((chk) => {
        if (chk.checked) selectedKeysSet.add(chk.value);
    });

    desktopContainer?.addEventListener('change', onContainerChange);
    mobileContainer?.addEventListener('change', onContainerChange);
    desktopContainer?.addEventListener('click', onContainerClick);
    mobileContainer?.addEventListener('click', onContainerClick);

    if (btnDeteksi) btnDeteksi.addEventListener('click', deteksiKoleksiBaru);
    if (btnPilihSemua) btnPilihSemua.addEventListener('click', onPilihSemuaClick);
    if (btnHapusPilihan) btnHapusPilihan.addEventListener('click', onHapusPilihanClick);
    if (btnBatal) btnBatal.addEventListener('click', onBatalClick);
    if (btnEksekusi) btnEksekusi.addEventListener('click', onEksekusiClick);

    if (btnYaModal) btnYaModal.onclick = () => finishConfirm(true);
    if (btnBatalModal) btnBatalModal.onclick = () => finishConfirm(false);
    if (btnTutupModal) btnTutupModal.onclick = () => finishConfirm(false);
    if (modalKonfirmasi) modalKonfirmasi.addEventListener('click', onModalBackdropClick);
    window.addEventListener('keydown', onEscapeKey);

    syncVisualStates();
    refreshCollectionCounts();

    const cleanup = () => {
        isDestroyed = true;
        if (confirmResolver) {
            const resolve = confirmResolver;
            confirmResolver = null;
            resolve(false);
        }
        if (confirmCloseTimer) {
            clearTimeout(confirmCloseTimer);
            confirmCloseTimer = null;
        }
        if (resetToastTimer) {
            clearTimeout(resetToastTimer);
            resetToastTimer = null;
        }
        desktopContainer?.removeEventListener('change', onContainerChange);
        mobileContainer?.removeEventListener('change', onContainerChange);
        desktopContainer?.removeEventListener('click', onContainerClick);
        mobileContainer?.removeEventListener('click', onContainerClick);
        if (btnDeteksi) btnDeteksi.removeEventListener('click', deteksiKoleksiBaru);
        if (btnPilihSemua) btnPilihSemua.removeEventListener('click', onPilihSemuaClick);
        if (btnHapusPilihan) btnHapusPilihan.removeEventListener('click', onHapusPilihanClick);
        if (btnBatal) btnBatal.removeEventListener('click', onBatalClick);
        if (btnEksekusi) btnEksekusi.removeEventListener('click', onEksekusiClick);
        if (modalKonfirmasi) modalKonfirmasi.removeEventListener('click', onModalBackdropClick);
        window.removeEventListener('keydown', onEscapeKey);
        window.removeEventListener('hashchange', cleanup);
        resetDataCleanup = null;
    };

    window.addEventListener('hashchange', cleanup);
    resetDataCleanup = cleanup;

    return cleanup;
}

export const renderDatabaseResetData = renderResetData;
export const initDatabaseResetDataHandler = initResetDataHandler;