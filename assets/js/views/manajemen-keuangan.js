// File: assets/js/views/manajemen-keuangan.js
import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const KEUANGAN_CARDS = [
    {
        id: "iuran",
        title: "Iuran Keuangan",
        route: "#/manajemen-keuangan/iuran",
        description: "Kelola tagihan, status pembayaran & rekap iuran warga RT",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`
    },
    {
        id: "laporan",
        title: "Laporan Keuangan",
        route: "#/manajemen-keuangan/laporan",
        description: "Kelola kas masuk, kas keluar & rekap saldo laporan keuangan RT",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`
    }
];

function navigateToRoute(route) {
    if (!route) return;
    if (typeof window.__rtNavigate === "function") {
        window.__rtNavigate(route);
        return;
    }
    window.location.hash = route;
}

export function renderManajemenKeuangan() {
    const cardsHtml = KEUANGAN_CARDS.map((card) => `
        <button
            type="button"
            data-mkw-open="${card.id}"
            data-route="${card.route}"
            class="group bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-[#c87d32] dark:hover:border-[#c87d32] rounded-none px-6 py-8 flex flex-col items-center justify-center text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#c87d32] cursor-pointer"
        >
            <div class="w-11 h-11 rounded-none bg-[#f6f3ec] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[#4a5a3f] dark:text-stone-300 group-hover:bg-[#5c6d4e] dark:group-hover:bg-[#5c6d4e] group-hover:border-[#4b5a3f] dark:group-hover:border-[#4b5a3f] group-hover:text-white flex items-center justify-center mb-4 transition-colors">
                ${card.icon}
            </div>
            <h3 class="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#c87d32] dark:group-hover:text-[#d47a2a] leading-snug transition-colors">
                ${card.title}
            </h3>
            <p class="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                ${card.description}
            </p>
            <span id="mkw-count-${card.id}" class="mt-3 px-2.5 py-0.5 text-[11px] font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                0 Data
            </span>
        </button>
    `).join("");

    return `
        <div class="space-y-5">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Manajemen Keuangan
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Pilih menu di bawah ini untuk membuka halaman Iuran Keuangan atau Laporan Keuangan.
                    </p>
                </div>
                <a
                    href="#/manajemen"
                    data-link
                    class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition flex-shrink-0"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    <span>Kembali</span>
                </a>
            </div>

            <div id="mkw-cards-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                ${cardsHtml}
            </div>
        </div>
    `;
}

export function initManajemenKeuanganHandler() {
    let isDestroyed = false;

    const onCardClick = (e) => {
        const btn = e.target.closest("[data-mkw-open]");
        if (!btn) return;
        const route = btn.getAttribute("data-route");
        if (route) navigateToRoute(route);
    };

    document.addEventListener("click", onCardClick);

    (async () => {
        try {
            const [iuranSnap, laporanSnap] = await Promise.allSettled([
                getDocs(collection(db, "iuran_warga")),
                getDocs(collection(db, "keuangan_rt"))
            ]);

            if (isDestroyed) return;

            const iuranCount = iuranSnap.status === "fulfilled" ? iuranSnap.value.size : 0;
            const laporanCount = laporanSnap.status === "fulfilled" ? laporanSnap.value.size : 0;

            const cIuran = document.getElementById("mkw-count-iuran");
            const cLaporan = document.getElementById("mkw-count-laporan");

            if (cIuran) cIuran.textContent = `${iuranCount} Data`;
            if (cLaporan) cLaporan.textContent = `${laporanCount} Data`;
        } catch (err) {
            console.warn("Gagal memuat ringkasan jumlah kartu keuangan:", err);
        }
    })();

    return () => {
        isDestroyed = true;
        document.removeEventListener("click", onCardClick);
    };
}