// File: assets/js/views/manajemen-kependudukan.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

const COLLECTIONS = {
    warga: "warga",
    kelahiran: "kelahiran",
    kematian: "kematian",
    mutasi: "mutasi_penduduk",
    sensus: "sensus_penduduk",
    statistik: "statistik_penduduk",
    log: "warga_log"
};

const KEPENDUDUKAN_CARDS = [
    {
        id: "warga",
        title: "Warga",
        description: "Kelola data warga, NIK, No. KK & status tinggal RT",
        href: "#/manajemen-kependudukan/warga",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`
    },
    {
        id: "kelahiran",
        title: "Kelahiran",
        description: "Catat data kelahiran bayi, tanggal & orang tua",
        href: "#/manajemen-kependudukan/kelahiran",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 4v16m8-8H4"/></svg>`
    },
    {
        id: "kematian",
        title: "Kematian",
        description: "Catat data warga meninggal, tanggal & keterangan",
        href: "#/manajemen-kependudukan/kematian",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`
    },
    {
        id: "mutasi",
        title: "Mutasi",
        description: "Catat pindah masuk, pindah keluar & perubahan data",
        href: "#/manajemen-kependudukan/mutasi",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>`
    },
    {
        id: "sensus",
        title: "Sensus Penduduk",
        description: "Pendataan berkala rumah tangga, hunian & kondisi warga",
        href: "#/manajemen-kependudukan/sensus",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`
    },
    {
        id: "statistik",
        title: "Data Statistik",
        description: "Rekapitulasi demografi, usia, pendidikan & pekerjaan",
        href: "#/manajemen-kependudukan/statistik",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`
    },
    {
        id: "log",
        title: "Manajemen Log",
        description: "Pantau histori perubahan data warga, tanggal berlaku & keterangan",
        href: "#/manajemen-kependudukan/log",
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
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

export function renderManajemenKependudukan() {
    const cardsHtml = KEPENDUDUKAN_CARDS.map((card) => `
        <button
            type="button"
            data-mk-card="${card.id}"
            data-mk-href="${card.href}"
            class="mk-menu-card group bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-[#c87d32] dark:hover:border-[#c87d32] rounded-none px-6 py-8 flex flex-col items-center justify-center text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#c87d32] cursor-pointer"
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
            <span id="mk-count-${card.id}" class="mt-3 px-2.5 py-0.5 text-[11px] font-semibold bg-[#f6f3ec] dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-none">
                0 Data
            </span>
        </button>
    `).join("");

    return `
        <div id="mk-root-wrapper" class="space-y-5">
            <!-- Header Halaman -->
            <div id="mk-main-header" class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 id="mk-page-title" class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Manajemen Kependudukan
                    </h1>
                    <p id="mk-page-subtitle" class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Pilih menu di bawah ini untuk mengelola data warga, kelahiran, kematian, mutasi, sensus penduduk, data statistik, dan log perubahan RT.
                    </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <a
                        href="#/manajemen"
                        data-link
                        id="mk-back-manajemen-link"
                        class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                        <span>Kembali</span>
                    </a>
                </div>
            </div>

            <!-- Grid Kartu Menu Kependudukan -->
            <div id="mk-cards-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                ${cardsHtml}
            </div>

            <!-- Container Modul Eksternal -->
            <div id="mk-external-view" class="hidden space-y-4"></div>
        </div>
    `;
}

export function initManajemenKependudukanHandler() {
    const stateData = {
        warga: [],
        kelahiran: [],
        kematian: [],
        mutasi: [],
        sensus: [],
        statistik: [],
        log: []
    };

    let activeMenu = null;
    let isDestroyed = false;
    let externalCleanup = null;

    const rootWrapperEl = document.getElementById("mk-root-wrapper");
    const mainHeaderEl = document.getElementById("mk-main-header");
    const cardsGridEl = document.getElementById("mk-cards-grid");
    const externalViewEl = document.getElementById("mk-external-view");

    function runExternalCleanup() {
        if (typeof externalCleanup === "function") {
            try {
                externalCleanup();
            } catch (_) {
                // Abaikan error cleanup modul eksternal
            }
            externalCleanup = null;
        }
        if (externalViewEl) {
            externalViewEl.innerHTML = "";
            externalViewEl.classList.add("hidden");
        }
        mainHeaderEl?.classList.remove("hidden");
    }

    function syncCardCounts() {
        KEPENDUDUKAN_CARDS.forEach((card) => {
            const countEl = document.getElementById(`mk-count-${card.id}`);
            if (countEl) {
                const suffix = card.id === "log" ? "Log" : "Data";
                countEl.textContent = `${stateData[card.id]?.length || 0} ${suffix}`;
            }
        });
    }

    function showCardsMenu() {
        activeMenu = null;
        runExternalCleanup();
        cardsGridEl?.classList.remove("hidden");
        syncCardCounts();
        loadAllKependudukan();
    }

    async function openExternalSubModule(config) {
        const {
            menuId,
            href,
            modulePath,
            label,
            renderCandidates,
            initCandidates,
            errorAlertText
        } = config;

        activeMenu = menuId;
        runExternalCleanup();

        if (href && window.location.hash !== href) {
            window.location.hash = href;
        }

        try {
            const mod = await import(modulePath);
            if (isDestroyed) return;

            const renderFn =
                renderCandidates.map((fnName) => mod[fnName]).find((fn) => typeof fn === "function") ||
                (typeof mod.default === "function" ? mod.default : null);
            const initFn =
                initCandidates.map((fnName) => mod[fnName]).find((fn) => typeof fn === "function") ||
                null;

            if (typeof renderFn !== "function") {
                throw new Error(`Fungsi render pada ${modulePath} tidak ditemukan.`);
            }

            const htmlOutput = await renderFn();
            if (isDestroyed || !externalViewEl) return;

            mainHeaderEl?.classList.add("hidden");
            cardsGridEl?.classList.add("hidden");

            const backBarHtml = `
                <div class="flex items-center justify-between bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-4 py-3">
                    <span class="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-200">
                        Manajemen Kependudukan • ${escapeHtml(label)}
                    </span>
                    <button
                        type="button"
                        id="mk-sub-back-btn"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] rounded-none transition cursor-pointer"
                    >
                        <span>← Menu Kependudukan</span>
                    </button>
                </div>
            `;

            externalViewEl.innerHTML = `${backBarHtml}<div id="mk-sub-module-container">${htmlOutput || ""}</div>`;
            externalViewEl.classList.remove("hidden");

            const subBackBtn = document.getElementById("mk-sub-back-btn");
            const onSubBack = () => showCardsMenu();
            subBackBtn?.addEventListener("click", onSubBack);

            const modCleanup = typeof initFn === "function" ? await initFn() : null;
            externalCleanup = () => {
                subBackBtn?.removeEventListener("click", onSubBack);
                if (typeof modCleanup === "function") modCleanup();
            };
        } catch (err) {
            console.error(`Gagal membuka ${modulePath}:`, err);
            mainHeaderEl?.classList.remove("hidden");
            cardsGridEl?.classList.remove("hidden");
            externalViewEl?.classList.add("hidden");
            window.alert(errorAlertText);
        }
    }

    function selectSubMenu(menuId, href = "") {
        if (!COLLECTIONS[menuId]) return;

        if (menuId === "warga") {
            openExternalSubModule({
                menuId: "warga",
                href: href || "#/manajemen-kependudukan/warga",
                modulePath: "./manajemen-kependudukan-warga.js",
                label: "Warga",
                renderCandidates: ["renderManajemenKependudukanWarga", "renderWarga"],
                initCandidates: ["initManajemenKependudukanWargaHandler", "initWargaHandler"],
                errorAlertText: "Modul manajemen-kependudukan-warga.js belum dapat dimuat."
            });
            return;
        }

        if (menuId === "kelahiran") {
            openExternalSubModule({
                menuId: "kelahiran",
                href: href || "#/manajemen-kependudukan/kelahiran",
                modulePath: "./manajemen-kependudukan-kelahiran.js",
                label: "Kelahiran",
                renderCandidates: ["renderManajemenKependudukanKelahiran", "renderKelahiran"],
                initCandidates: ["initManajemenKependudukanKelahiranHandler", "initKelahiranHandler"],
                errorAlertText: "Modul manajemen-kependudukan-kelahiran.js belum dapat dimuat."
            });
            return;
        }

        if (menuId === "kematian") {
            openExternalSubModule({
                menuId: "kematian",
                href: href || "#/manajemen-kependudukan/kematian",
                modulePath: "./manajemen-kependudukan-kematian.js",
                label: "Kematian",
                renderCandidates: ["renderManajemenKependudukanKematian", "renderKematian"],
                initCandidates: ["initManajemenKependudukanKematianHandler", "initKematianHandler"],
                errorAlertText: "Modul manajemen-kependudukan-kematian.js belum dapat dimuat."
            });
            return;
        }

        if (menuId === "mutasi") {
            openExternalSubModule({
                menuId: "mutasi",
                href: href || "#/manajemen-kependudukan/mutasi",
                modulePath: "./manajemen-kependudukan-mutasi.js",
                label: "Mutasi",
                renderCandidates: ["renderManajemenKependudukanMutasi", "renderMutasi"],
                initCandidates: ["initManajemenKependudukanMutasiHandler", "initMutasiHandler"],
                errorAlertText: "Modul manajemen-kependudukan-mutasi.js belum dapat dimuat."
            });
            return;
        }

        if (menuId === "sensus") {
            openExternalSubModule({
                menuId: "sensus",
                href: href || "#/manajemen-kependudukan/sensus",
                modulePath: "./manajemen-kependudukan-sensus.js",
                label: "Sensus Penduduk",
                renderCandidates: ["renderManajemenKependudukanSensus", "renderSensus"],
                initCandidates: ["initManajemenKependudukanSensusHandler", "initSensusHandler"],
                errorAlertText: "Modul manajemen-kependudukan-sensus.js belum dapat dimuat."
            });
            return;
        }

        if (menuId === "statistik") {
            openExternalSubModule({
                menuId: "statistik",
                href: href || "#/manajemen-kependudukan/statistik",
                modulePath: "./manajemen-kependudukan-statistik.js",
                label: "Data Statistik",
                renderCandidates: ["renderManajemenKependudukanStatistik", "renderStatistik"],
                initCandidates: ["initManajemenKependudukanStatistikHandler", "initStatistikHandler"],
                errorAlertText: "Modul manajemen-kependudukan-statistik.js belum dapat dimuat."
            });
            return;
        }

        if (menuId === "log") {
            openExternalSubModule({
                menuId: "log",
                href: href || "#/manajemen-kependudukan/log",
                modulePath: "./manajemen-kependudukan-log.js",
                label: "Manajemen Log",
                renderCandidates: ["renderManajemenKependudukanLog", "renderLog"],
                initCandidates: ["initManajemenKependudukanLogHandler", "initLogHandler"],
                errorAlertText: "Modul manajemen-kependudukan-log.js belum dapat dimuat."
            });
        }
    }

    async function loadAllKependudukan() {
        try {
            const entries = await Promise.all(
                Object.entries(COLLECTIONS).map(async ([key, colName]) => {
                    try {
                        const snap = await getDocs(collection(db, colName));
                        const items = [];
                        snap.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
                        return [key, items];
                    } catch (err) {
                        console.warn(`Gagal memuat koleksi ${colName}:`, err);
                        return [key, stateData[key] || []];
                    }
                })
            );
            if (isDestroyed) return;
            entries.forEach(([key, items]) => {
                stateData[key] = items;
            });
            syncCardCounts();
        } catch (err) {
            console.error("Gagal memuat ringkasan data kependudukan:", err);
        }
    }

    const onClickDelegate = (e) => {
        if (rootWrapperEl && !rootWrapperEl.contains(e.target)) return;

        const cardBtn = e.target.closest("[data-mk-card]");
        if (cardBtn) {
            const targetMenu = cardBtn.getAttribute("data-mk-card");
            const targetHref = cardBtn.getAttribute("data-mk-href") || "";
            if (targetMenu) selectSubMenu(targetMenu, targetHref);
        }
    };

    syncCardCounts();
    document.addEventListener("click", onClickDelegate);
    loadAllKependudukan();

    return () => {
        isDestroyed = true;
        runExternalCleanup();
        document.removeEventListener("click", onClickDelegate);
    };
}

export default renderManajemenKependudukan;