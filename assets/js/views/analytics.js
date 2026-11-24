// File: assets/js/views/analytics.js
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function safeCollectionCount(collectionName) {
    try {
        const snap = await getDocs(collection(db, collectionName));
        return snap.size;
    } catch {
        return null;
    }
}

export function renderAnalytics() {
    return `
        <div class="space-y-6">
            <!-- Header Halaman -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 px-6 py-5 rounded-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-stone-900 dark:text-stone-100">Analytics</h1>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-1">
                        Ringkasan statistik, kunjungan, dan metrik penggunaan aplikasi BUMKal Sinar Mitra Desa.
                    </p>
                </div>
                <button
                    type="button"
                    id="btn-refresh-analytics"
                    class="px-4 py-2 bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white text-xs font-semibold transition flex items-center justify-center gap-2 self-start sm:self-auto rounded-none cursor-pointer"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Muat Ulang Metrik
                </button>
            </div>

            <!-- Grid Kartu Ringkasan -->
            <div id="analytics-summary-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 rounded-none">
                    <p class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Pengguna</p>
                    <p id="stat-users-count" class="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-2">-</p>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-1">Akun terdaftar di Firestore</p>
                </div>

                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 rounded-none">
                    <p class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Unit Usaha / Produk</p>
                    <p id="stat-produk-count" class="text-2xl font-bold text-[#4b5a3f] dark:text-emerald-400 mt-2">-</p>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-1">Data katalog &amp; unit aktif</p>
                </div>

                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 rounded-none">
                    <p class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Berita &amp; Galeri</p>
                    <p id="stat-konten-count" class="text-2xl font-bold text-[#c87d32] dark:text-amber-400 mt-2">-</p>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-1">Publikasi &amp; dokumentasi</p>
                </div>

                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 rounded-none">
                    <p class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Status Sesi Lokal</p>
                    <p id="stat-session-role" class="text-lg font-bold text-stone-900 dark:text-stone-100 mt-2.5 truncate">-</p>
                    <p id="stat-session-email" class="text-xs text-stone-600 dark:text-stone-400 mt-1 truncate">Memeriksa sesi...</p>
                </div>
            </div>

            <!-- Panel Informasi & Catatan Metrik -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 rounded-none space-y-2">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h2 class="text-sm font-bold text-stone-900 dark:text-stone-100">Status Pemantauan Data</h2>
                    <span id="analytics-last-sync" class="text-[11px] font-semibold px-2.5 py-1 bg-[#fcf7e8] dark:bg-amber-950/60 text-[#9a5518] dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 self-start sm:self-auto">
                        Menunggu sinkronisasi...
                    </span>
                </div>
                <p id="analytics-status-note" class="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    Menghitung ringkasan dokumen koleksi utama. Untuk analisis lalu lintas kunjungan detail, gunakan dasbor analitik yang terhubung.
                </p>
            </div>
        </div>
    `;
}

export function initAnalyticsHandler() {
    let isDestroyed = false;

    const syncLocalSessionCard = () => {
        const roleEl = document.getElementById('stat-session-role');
        const emailEl = document.getElementById('stat-session-email');
        const role = String(localStorage.getItem('user_role') || 'Tamu').trim() || 'Tamu';
        const email = String(localStorage.getItem('user_email') || 'Belum masuk').trim() || 'Belum masuk';

        if (roleEl) roleEl.textContent = role;
        if (emailEl) emailEl.textContent = email;
    };

    const loadAnalyticsSummary = async () => {
        if (isDestroyed) return;
        syncLocalSessionCard();

        const usersEl = document.getElementById('stat-users-count');
        const produkEl = document.getElementById('stat-produk-count');
        const kontenEl = document.getElementById('stat-konten-count');
        const syncBadge = document.getElementById('analytics-last-sync');
        const noteEl = document.getElementById('analytics-status-note');

        if (syncBadge) syncBadge.textContent = 'Memperbarui...';

        const [usersCount, produkCount, beritaCount, galeriCount] = await Promise.all([
            safeCollectionCount('users'),
            safeCollectionCount('produk'),
            safeCollectionCount('berita'),
            safeCollectionCount('galeri')
        ]);

        if (isDestroyed) return;

        if (usersEl) {
            usersEl.textContent = usersCount !== null ? String(usersCount) : 'N/A';
        }

        if (produkEl) {
            produkEl.textContent = produkCount !== null ? String(produkCount) : 'N/A';
        }

        if (kontenEl) {
            const hasBerita = beritaCount !== null;
            const hasGaleri = galeriCount !== null;
            if (hasBerita || hasGaleri) {
                kontenEl.textContent = String((beritaCount || 0) + (galeriCount || 0));
            } else {
                kontenEl.textContent = 'N/A';
            }
        }

        const nowLabel = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        if (syncBadge) {
            syncBadge.textContent = `Sinkron: ${escapeHtml(nowLabel)}`;
        }

        if (noteEl) {
            const parts = [];
            if (beritaCount !== null) parts.push(`Berita: ${beritaCount}`);
            if (galeriCount !== null) parts.push(`Galeri: ${galeriCount}`);
            const detailText = parts.length > 0 ? ` (${parts.join(' · ')})` : '';
            noteEl.textContent = `Ringkasan koleksi diperbarui${detailText}. Jika ada koleksi yang bernilai N/A, pastikan nama koleksi atau aturan akses Firestore sesuai.`;
        }
    };

    const refreshBtn = document.getElementById('btn-refresh-analytics');
    const onRefreshClick = () => {
        loadAnalyticsSummary();
    };
    refreshBtn?.addEventListener('click', onRefreshClick);

    loadAnalyticsSummary();

    return () => {
        isDestroyed = true;
        refreshBtn?.removeEventListener('click', onRefreshClick);
    };
}