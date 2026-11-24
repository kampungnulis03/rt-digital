// File: assets/js/views/manajemen-administrasi.js
import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const ADMINISTRASI_CARDS = [
    {
        id: "rapat",
        title: "Rapat",
        route: "#/manajemen/administrasi/rapat",
        description: "Kelola agenda, notulensi, peserta & jadwal rapat RT",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`
    },
    {
        id: "qr",
        title: "Code QR",
        route: "#/manajemen/administrasi/code",
        description: "Buat Kode QR Absensi dari tanggal & kategori rapat",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm11 0h2v2h-2v-2zm4 0h1v4h-4v-1h3v-3zm-5 3h2v3h-2v-3z"/></svg>`
    },
    {
        id: "kehadiran",
        title: "Kehadiran",
        route: "#/manajemen/administrasi/kehadiran",
        description: "Lihat hasil absensi & input manual warga tanpa HP",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`
    },
    {
        id: "pesan",
        title: "Pesan",
        route: "#/manajemen/administrasi/pesan",
        description: "Kelola pesan masuk, surat pengantar & informasi warga RT",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`
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

export function renderManajemenAdministrasi() {
    const cardsHtml = ADMINISTRASI_CARDS.map((card) => `
        <button
            type="button"
            data-mad-open="${card.id}"
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
            <span id="mad-count-${card.id}" class="mt-3 px-2.5 py-0.5 text-[11px] font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                ${card.id === "qr" ? "0 Rapat" : "0 Data"}
            </span>
        </button>
    `).join("");

    return `
        <div class="space-y-5">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Manajemen Administrasi
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Pilih menu di bawah ini untuk membuka halaman Rapat, Code QR, Kehadiran, atau Pesan.
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

            <div id="mad-cards-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                ${cardsHtml}
            </div>
        </div>
    `;
}

export function initManajemenAdministrasiHandler() {
    let isDestroyed = false;

    const onCardClick = (e) => {
        const btn = e.target.closest("[data-mad-open]");
        if (!btn) return;
        const route = btn.getAttribute("data-route");
        if (route) navigateToRoute(route);
    };

    document.addEventListener("click", onCardClick);

    (async () => {
        try {
            const [rapatSnap, hadirSnap, pesanSnap] = await Promise.allSettled([
                getDocs(collection(db, "rapat_rt")),
                getDocs(collection(db, "absensi")),
                getDocs(collection(db, "pesan_rt"))
            ]);

            if (isDestroyed) return;

            const rapatCount = rapatSnap.status === "fulfilled" ? rapatSnap.value.size : 0;
            const hadirCount = hadirSnap.status === "fulfilled" ? hadirSnap.value.size : 0;
            const pesanCount = pesanSnap.status === "fulfilled" ? pesanSnap.value.size : 0;

            const cRapat = document.getElementById("mad-count-rapat");
            const cQr = document.getElementById("mad-count-qr");
            const cHadir = document.getElementById("mad-count-kehadiran");
            const cPesan = document.getElementById("mad-count-pesan");

            if (cRapat) cRapat.textContent = `${rapatCount} Data`;
            if (cQr) cQr.textContent = `${rapatCount} Rapat`;
            if (cHadir) cHadir.textContent = `${hadirCount} Data`;
            if (cPesan) cPesan.textContent = `${pesanCount} Data`;
        } catch (err) {
            console.warn("Gagal memuat ringkasan jumlah kartu administrasi:", err);
        }
    })();

    return () => {
        isDestroyed = true;
        document.removeEventListener("click", onCardClick);
    };
}