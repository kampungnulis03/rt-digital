// File: assets/js/router.js
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDoc, setDoc, doc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { renderHome, initHomeHandler } from './views/home.js';
import { renderManajemenDetailUnit, initManajemenDetailUnitHandler } from './views/manajemen-detail-unit.js';
import { renderBerita, initBeritaHandler } from './views/berita.js';
import { renderManajemenGaleri, initManajemenGaleriHandler } from './views/manajemen-galeri.js';
import { renderManajemenBerita, initManajemenBeritaHandler } from './views/manajemen-berita.js';
import { renderKontak, initKontakHandler } from './views/kontak.js';
import { renderTamu, initTamuHandler } from './views/tamu.js';
import { renderStaf, initStafHandler } from './views/staf.js';
import { renderAnalytics, initAnalyticsHandler } from './views/analytics.js';
import { renderDatabase, initDatabaseHandler } from './views/database.js';
import { renderLogin, initLoginHandler } from './views/login.js';
import { renderKasLayanan, initKasLayananHandler } from './views/kas-layanan.js';

const DEFAULT_USER_ROLE = 'Tamu';
const NOT_REGISTERED_MESSAGE = "Maaf email anda tidak terdaftar, silahkan hubungi bagian Admin";
const LOGIN_ERROR_STORAGE_KEY = "rtku_login_error_message";

function ensureGlobalScrollbarHiddenStyle() {
    if (typeof document === "undefined") return;
    if (document.getElementById("rtku-hide-scrollbar-style")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "rtku-hide-scrollbar-style";
    styleEl.textContent = `
        html,
        body,
        #app,
        .rtku-no-scrollbar {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar,
        #app::-webkit-scrollbar,
        .rtku-no-scrollbar::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            background: transparent !important;
        }
    `;
    (document.head || document.documentElement).appendChild(styleEl);
}

const PUBLIC_LANDING_ROUTES = ['/', '/absensi', '/galeri', '/kas-layanan', '/berita', '/kontak'];

function extractRoutePath() {
    const raw = String(location.hash || "").slice(1).split("?")[0].trim().toLowerCase();
    if (!raw) return "/";
    return raw.startsWith("/") ? raw : `/${raw}`;
}

function isSafeAvatarSrc(src = "") {
    const val = String(src || "").trim();
    if (!val || val === "null" || val === "undefined") return false;
    return (
        val.startsWith("https://") ||
        val.startsWith("http://") ||
        val.startsWith("assets/") ||
        val.startsWith("./") ||
        val.startsWith("/") ||
        val.startsWith("data:image/")
    );
}

function extractWargaEmail(data = {}) {
    return String(
        data.email ||
        data.alamatEmail ||
        data.emailWarga ||
        data.email_warga ||
        ""
    ).trim().toLowerCase();
}

async function isEmailRegisteredInWarga(email = "") {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return false;

    try {
        const wargaCol = collection(db, "warga");
        const exactSnap = await getDocs(query(wargaCol, where("email", "==", normalizedEmail)));
        if (!exactSnap.empty) return true;

        const allWargaSnap = await getDocs(wargaCol);
        return allWargaSnap.docs.some(
            docSnap => extractWargaEmail(docSnap.data() || {}) === normalizedEmail
        );
    } catch (err) {
        console.warn("Gagal memeriksa koleksi warga di router:", err);
        return false;
    }
}

async function inspectUsersBootstrap(currentUid) {
    try {
        const usersCol = collection(db, "users");
        const allUsersSnap = await getDocs(usersCol);
        const otherDocs = allUsersSnap.docs.filter(d => d.id !== currentUid);

        if (otherDocs.length === 0) {
            return { isFirstLogin: true, hasOtherAdmin: false };
        }

        const hasOtherAdmin = otherDocs.some(
            d => String(d.data()?.role || "").trim().toLowerCase() === "administrator"
        );

        return { isFirstLogin: false, hasOtherAdmin };
    } catch (err) {
        console.warn("Gagal memeriksa koleksi users di router:", err);
        return { isFirstLogin: false, hasOtherAdmin: false };
    }
}

function showLoginErrorNotice(message = NOT_REGISTERED_MESSAGE) {
    const cleanMsg = String(message || NOT_REGISTERED_MESSAGE).trim();
    sessionStorage.setItem(LOGIN_ERROR_STORAGE_KEY, cleanMsg);
    sessionStorage.setItem("login_error_message", cleanMsg);
    const errorBox = document.getElementById("error-msg");
    if (errorBox) {
        errorBox.textContent = cleanMsg;
        errorBox.classList.remove("hidden");
        errorBox.style.display = "block";
    }
}

async function loadOptionalView(modulePaths, renderExportNames, handlerExportNames, titleLabel) {
    const paths = Array.isArray(modulePaths) ? modulePaths : [modulePaths];
    const renderCandidates = Array.isArray(renderExportNames) ? renderExportNames : [renderExportNames];
    const handlerCandidates = Array.isArray(handlerExportNames) ? handlerExportNames : [handlerExportNames];

    for (const modulePath of paths) {
        try {
            const mod = await import(`${modulePath}?v=${Date.now()}`);
            const renderFn =
                renderCandidates.map(name => (name === 'default' ? mod.default : mod[name])).find(fn => typeof fn === 'function') ||
                null;
            const initFn =
                handlerCandidates.map(name => (name === 'default' ? mod.default : mod[name])).find(fn => typeof fn === 'function') ||
                (() => {});

            if (renderFn) {
                return { render: renderFn, init: initFn };
            }
        } catch (err) {
            console.warn(`Modul ${modulePath} belum tersedia:`, err?.message || err);
        }
    }

    const primaryPath = paths[0] || './views/unknown.js';
    return {
        render: () => `
            <div class="space-y-5">
                <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100">${titleLabel}</h1>
                        <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                            Pastikan file <code class="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded-none">${primaryPath}</code> sudah ada dan mengekspor fungsi render yang sesuai.
                        </p>
                    </div>
                    <a href="#/database" data-link class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition">
                        <span>← Kembali ke Database</span>
                    </a>
                </div>
            </div>
        `,
        init: () => {}
    };
}

const optionalSubRoutes = {
    '/absensi': {
        modulePath: './views/absensi.js',
        renderName: ['renderAbsensi', 'default'],
        handlerName: ['initAbsensiHandler', 'default'],
        label: 'Absensi Warga & Kegiatan RT'
    },
    '/manajemen': {
        modulePath: './views/manajemen.js',
        renderName: ['renderManajemen', 'renderMenuManajemen', 'default'],
        handlerName: ['initManajemenHandler', 'initMenuManajemenHandler'],
        label: 'Pengaturan & Manajemen RTKu Digital'
    },
    '/manajemen-administrasi': {
        modulePath: './views/manajemen-administrasi.js',
        renderName: ['renderManajemenAdministrasi', 'renderAdministrasi', 'default'],
        handlerName: ['initManajemenAdministrasiHandler', 'initAdministrasiHandler'],
        label: 'Manajemen Administrasi'
    },
    '/manajemen-administrasi/rapat': {
        modulePath: './views/manajemen-adminitrasi-rapat.js',
        renderName: ['renderManajemenAdministrasiRapat', 'renderRapat', 'default'],
        handlerName: ['initManajemenAdministrasiRapatHandler', 'initRapatHandler'],
        label: 'Administrasi • Rapat RT'
    },
    '/manajemen-administrasi/code': {
        modulePath: './views/manajemen-adminitrasi-code.js',
        renderName: ['renderManajemenAdministrasiCode', 'renderCodeQr', 'default'],
        handlerName: ['initManajemenAdministrasiCodeHandler', 'initCodeQrHandler'],
        label: 'Administrasi • Code QR Absensi'
    },
    '/manajemen-administrasi/kehadiran': {
        modulePath: './views/manajemen-adminitrasi-kehadiran.js',
        renderName: ['renderManajemenAdministrasiKehadiran', 'renderKehadiran', 'default'],
        handlerName: ['initManajemenAdministrasiKehadiranHandler', 'initKehadiranHandler'],
        label: 'Administrasi • Kehadiran Warga'
    },
    '/manajemen-administrasi/pesan': {
        modulePath: './views/manajemen-adminitrasi-pesan.js',
        renderName: ['renderManajemenAdministrasiPesan', 'renderPesan', 'default'],
        handlerName: ['initManajemenAdministrasiPesanHandler', 'initPesanHandler'],
        label: 'Administrasi • Pesan RT'
    },
    '/manajemen-keuangan': {
        modulePath: './views/manajemen-keuangan.js',
        renderName: ['renderManajemenKeuangan', 'renderKeuangan', 'default'],
        handlerName: ['initManajemenKeuanganHandler', 'initKeuanganHandler'],
        label: 'Manajemen Keuangan'
    },
    '/manajemen-keuangan/iuran': {
        modulePath: './views/manajemen-keuangan-iuran.js',
        renderName: ['renderManajemenKeuanganIuran', 'renderKeuanganIuran', 'default'],
        handlerName: ['initManajemenKeuanganIuranHandler', 'initKeuanganIuranHandler'],
        label: 'Keuangan • Iuran Keuangan'
    },
    '/manajemen-keuangan/laporan': {
        modulePath: './views/manajemen-keuangan-laporan.js',
        renderName: ['renderManajemenKeuanganLaporan', 'renderKeuanganLaporan', 'default'],
        handlerName: ['initManajemenKeuanganLaporanHandler', 'initKeuanganLaporanHandler'],
        label: 'Keuangan • Laporan Keuangan'
    },
    '/manajemen-kependudukan': {
        modulePath: './views/manajemen-kependudukan.js',
        renderName: ['renderManajemenKependudukan', 'renderKependudukan', 'default'],
        handlerName: ['initManajemenKependudukanHandler', 'initKependudukanHandler'],
        label: 'Manajemen Kependudukan'
    },
    '/manajemen-kependudukan/warga': {
        modulePath: './views/manajemen-kependudukan-warga.js',
        renderName: ['renderManajemenKependudukanWarga', 'renderWarga', 'default'],
        handlerName: ['initManajemenKependudukanWargaHandler', 'initWargaHandler'],
        label: 'Manajemen Kependudukan • Warga'
    },
    '/manajemen-kependudukan/kelahiran': {
        modulePath: './views/manajemen-kependudukan-kelahiran.js',
        renderName: ['renderManajemenKependudukanKelahiran', 'renderKelahiran', 'default'],
        handlerName: ['initManajemenKependudukanKelahiranHandler', 'initKelahiranHandler'],
        label: 'Manajemen Kependudukan • Kelahiran'
    },
    '/manajemen-kependudukan/kematian': {
        modulePath: './views/manajemen-kependudukan-kematian.js',
        renderName: ['renderManajemenKependudukanKematian', 'renderKematian', 'default'],
        handlerName: ['initManajemenKependudukanKematianHandler', 'initKematianHandler'],
        label: 'Manajemen Kependudukan • Kematian'
    },
    '/manajemen-kependudukan/mutasi': {
        modulePath: './views/manajemen-kependudukan-mutasi.js',
        renderName: ['renderManajemenKependudukanMutasi', 'renderMutasi', 'default'],
        handlerName: ['initManajemenKependudukanMutasiHandler', 'initMutasiHandler'],
        label: 'Manajemen Kependudukan • Mutasi'
    },
    '/manajemen-kependudukan/statistik': {
        modulePath: './views/manajemen-kependudukan-statistik.js',
        renderName: ['renderManajemenKependudukanStatistik', 'renderStatistik', 'default'],
        handlerName: ['initManajemenKependudukanStatistikHandler', 'initStatistikHandler'],
        label: 'Manajemen Kependudukan • Data Statistik'
    },
    '/manajemen-kependudukan/sensus': {
        modulePath: './views/manajemen-kependudukan-sensus.js',
        renderName: ['renderManajemenKependudukanSensus', 'renderSensus', 'default'],
        handlerName: ['initManajemenKependudukanSensusHandler', 'initSensusHandler'],
        label: 'Manajemen Kependudukan • Sensus Penduduk'
    },
    '/manajemen-kependudukan/log': {
        modulePath: './views/manajemen-kependudukan-log.js',
        renderName: ['renderManajemenKependudukanLog', 'renderLog', 'default'],
        handlerName: ['initManajemenKependudukanLogHandler', 'initLogHandler'],
        label: 'Manajemen Kependudukan • Manajemen Log'
    },
    '/galeri': {
        modulePath: './views/galeri.js',
        renderName: ['renderGaleri', 'renderManajemenGaleri'],
        handlerName: ['initGaleriHandler', 'initManajemenGaleriHandler'],
        label: 'Galeri Kegiatan Warga'
    },
    '/manajemen-pengaturan': {
        modulePath: './views/manajemen-pengaturan.js',
        renderName: ['renderManajemenPengaturan', 'renderPengaturan'],
        handlerName: ['initManajemenPengaturanHandler', 'initPengaturanHandler'],
        label: 'Manajemen Pengaturan'
    },
    '/manajemen-paket-wisata': {
        modulePath: './views/manajemen-paket-wisata.js',
        renderName: ['renderManajemenPaketWisata', 'renderPaketWisata'],
        handlerName: ['initManajemenPaketWisataHandler', 'initPaketWisataHandler'],
        label: 'Manajemen Kas & Layanan'
    },
    '/produk': {
        modulePath: './views/manajemen-produk.js',
        renderName: ['renderManajemenProduk', 'renderProduk'],
        handlerName: ['initManajemenProdukHandler', 'initProdukHandler'],
        label: 'Manajemen Produk / Layanan'
    },
    '/banner': {
        modulePath: './views/manajemen-banner.js',
        renderName: ['renderManajemenBanner', 'renderBanner'],
        handlerName: ['initManajemenBannerHandler', 'initBannerHandler'],
        label: 'Manajemen Banner'
    },
    '/text': {
        modulePath: './views/manajemen-text.js',
        renderName: ['renderManajemenText', 'renderText'],
        handlerName: ['initManajemenTextHandler', 'initTextHandler'],
        label: 'Manajemen Running Text'
    },
    '/lpj': {
        modulePath: './views/manajemen-lpj.js',
        renderName: ['renderManajemenLpj', 'renderLpj'],
        handlerName: ['initManajemenLpjHandler', 'initLpjHandler'],
        label: 'Manajemen Laporan Pertanggungjawaban'
    },
    '/database-control-size': {
        modulePath: ['./views/database-control-size.js', './views/control-size.js'],
        renderName: ['renderDatabaseControlSize', 'renderControlSize', 'default'],
        handlerName: ['initDatabaseControlSizeHandler', 'initControlSizeHandler', 'default'],
        label: 'Control Size'
    },
    '/reset-data': {
        modulePath: ['./views/database-reset-data.js', './views/reset-data.js'],
        renderName: ['renderDatabaseResetData', 'renderResetData', 'default'],
        handlerName: ['initDatabaseResetDataHandler', 'initResetDataHandler', 'default'],
        label: 'Reset Data'
    }
};

const routeAliases = {
    '/unit-usaha': '/kas-layanan',
    '/pengaturan': '/manajemen-pengaturan',
    '/paket-wisata': '/manajemen-paket-wisata',
    '/administrasi': '/manajemen-administrasi',
    '/administrasi/rapat': '/manajemen-administrasi/rapat',
    '/administrasi/code': '/manajemen-administrasi/code',
    '/administrasi/qr': '/manajemen-administrasi/code',
    '/administrasi/kehadiran': '/manajemen-administrasi/kehadiran',
    '/administrasi/pesan': '/manajemen-administrasi/pesan',
    '/manajemen/administrasi': '/manajemen-administrasi',
    '/manajemen/administrasi/rapat': '/manajemen-administrasi/rapat',
    '/manajemen/administrasi/code': '/manajemen-administrasi/code',
    '/manajemen/administrasi/qr': '/manajemen-administrasi/code',
    '/manajemen/administrasi/kehadiran': '/manajemen-administrasi/kehadiran',
    '/manajemen/administrasi/pesan': '/manajemen-administrasi/pesan',
    '/keuangan': '/manajemen-keuangan',
    '/keuangan/iuran': '/manajemen-keuangan/iuran',
    '/keuangan/laporan': '/manajemen-keuangan/laporan',
    '/kependudukan': '/manajemen-kependudukan',
    '/absensi-warga': '/absensi',
    '/kehadiran': '/absensi',
    '/berita-agenda': '/berita',
    '/event': '/manajemen-berita',
    '/unit-usaha/detail': '/manajemen-detail-unit',
    '/control-size': '/database-control-size'
};

const routes = {
    '/': renderHome,
    '/kas-layanan': renderKasLayanan,
    '/manajemen-detail-unit': renderManajemenDetailUnit,
    '/berita': renderBerita,
    '/manajemen-galeri': renderManajemenGaleri,
    '/manajemen-berita': renderManajemenBerita,
    '/kontak': renderKontak,
    '/tamu': renderTamu,
    '/staf': renderStaf,
    '/analytics': renderAnalytics,
    '/database': renderDatabase,
    '/login': renderLogin
};

const handlers = {
    '/': initHomeHandler,
    '/kas-layanan': initKasLayananHandler,
    '/manajemen-detail-unit': initManajemenDetailUnitHandler,
    '/berita': initBeritaHandler,
    '/manajemen-galeri': initManajemenGaleriHandler,
    '/manajemen-berita': initManajemenBeritaHandler,
    '/kontak': initKontakHandler,
    '/tamu': initTamuHandler,
    '/staf': initStafHandler,
    '/analytics': initAnalyticsHandler,
    '/database': initDatabaseHandler,
    '/login': initLoginHandler
};

const ADMIN_ONLY_ROUTES = [
    '/tamu',
    '/staf',
    '/analytics',
    '/manajemen',
    '/manajemen-administrasi',
    '/manajemen-administrasi/rapat',
    '/manajemen-administrasi/code',
    '/manajemen-administrasi/kehadiran',
    '/manajemen-administrasi/pesan',
    '/manajemen-keuangan',
    '/manajemen-keuangan/iuran',
    '/manajemen-keuangan/laporan',
    '/manajemen-kependudukan',
    '/manajemen-kependudukan/warga',
    '/manajemen-kependudukan/kelahiran',
    '/manajemen-kependudukan/kematian',
    '/manajemen-kependudukan/mutasi',
    '/manajemen-kependudukan/statistik',
    '/manajemen-kependudukan/sensus',
    '/manajemen-kependudukan/log',
    '/database',
    '/database-control-size',
    '/manajemen-pengaturan',
    '/manajemen-paket-wisata',
    '/manajemen-galeri',
    '/manajemen-berita',
    '/manajemen-detail-unit',
    '/produk',
    '/banner',
    '/text',
    '/lpj',
    '/control-size',
    '/reset-data'
];

function isCurrentUserAdmin() {
    const role = String(localStorage.getItem('user_role') || '').trim().toLowerCase();
    return role === 'administrator';
}

function setRunningTextVisibility(hide = false) {
    const runningTextEl = document.getElementById('global-running-text-container');
    if (runningTextEl) {
        runningTextEl.classList.toggle('hidden', Boolean(hide));
        runningTextEl.style.display = hide ? 'none' : '';
    }
    if (typeof window.syncLoginRunningTextBottom === 'function') {
        window.syncLoginRunningTextBottom(Boolean(hide));
    }
    if (!hide && typeof window.syncRunningTextPosition === 'function') {
        window.syncRunningTextPosition(false);
    }
}

function syncPublicNavbarActiveState(path) {
    const navRoot = document.getElementById('global-public-navbar') || document.getElementById('public-navbar');
    if (!navRoot) return;

    const normalizedPath = String(path || '/').toLowerCase();
    const links = navRoot.querySelectorAll('a[href], button[data-route], a[data-route]');

    links.forEach(el => {
        const rawHref = String(el.getAttribute('href') || '').trim().toLowerCase();
        const rawRouteAttr = String(el.getAttribute('data-route') || '').trim().toLowerCase();
        const targetRoute = rawRouteAttr
            ? (rawRouteAttr.startsWith('/') ? rawRouteAttr : `/${rawRouteAttr}`)
            : rawHref.startsWith('#')
                ? rawHref.slice(1).split('?')[0]
                : '';

        if (!targetRoute) return;

        const isMatch =
            targetRoute === normalizedPath ||
            (normalizedPath === '/kas-layanan' && (targetRoute === '/kas-layanan' || targetRoute === '/unit-usaha'));

        el.classList.toggle('is-active', isMatch);
        el.classList.toggle('active', isMatch);
        el.classList.remove('underline', 'underline-offset-8', 'decoration-2', 'decoration-[#c87d32]');
        if (isMatch) {
            el.setAttribute('aria-current', 'page');
        } else {
            el.removeAttribute('aria-current');
        }
    });
}

function syncGlobalPublicChrome(path, isPublicLanding) {
    document.querySelectorAll('a[href="#/unit-usaha"], a[data-route="unit-usaha"]').forEach(el => {
        if (el.getAttribute('href') === '#/unit-usaha') {
            el.setAttribute('href', '#/kas-layanan');
        }
        if (el.getAttribute('data-route') === 'unit-usaha') {
            el.setAttribute('data-route', 'kas-layanan');
        }
    });

    const publicNavbar = document.getElementById('global-public-navbar') || document.getElementById('public-navbar');
    const publicFooter = document.getElementById('global-public-footer') || document.getElementById('public-footer');

    if (publicNavbar) {
        publicNavbar.classList.toggle('hidden', !isPublicLanding);
        publicNavbar.style.display = isPublicLanding ? '' : 'none';
    }
    if (publicFooter) {
        publicFooter.style.display = '';
        if (isPublicLanding) {
            publicFooter.classList.remove('hidden');
            publicFooter.classList.add('hidden', 'md:block');
        } else {
            publicFooter.classList.remove('md:block');
            publicFooter.classList.add('hidden');
        }
    }

    if (typeof window.syncGlobalPublicNavbar === 'function') {
        window.syncGlobalPublicNavbar(isPublicLanding, path);
    }
    if (typeof window.syncGlobalPublicChrome === 'function') {
        window.syncGlobalPublicChrome({ path, isPublicLanding });
    }
    if (typeof window.applyPublicSettings === 'function') {
        window.applyPublicSettings({ path, isPublicLanding });
    }
    if (typeof window.syncGlobalPublicUserAvatar === 'function') {
        window.syncGlobalPublicUserAvatar();
    }

    syncPublicNavbarActiveState(path);

    document.dispatchEvent(new CustomEvent('rtku:route-change', {
        detail: { path, isPublicLanding }
    }));
}

function syncAdminMenuUI(path, isPublicLanding, hideRunningText = false) {
    if (typeof window.applyRoleMenuVisibility === 'function') {
        window.applyRoleMenuVisibility();
    }
    if (typeof window.syncActiveNav === 'function') {
        window.syncActiveNav();
    }
    syncGlobalPublicChrome(path, isPublicLanding);
    syncPublicNavbarActiveState(path);
    setRunningTextVisibility(hideRunningText);
    requestAnimationFrame(() => {
        syncPublicNavbarActiveState(path);
        setRunningTextVisibility(hideRunningText);
    });
}

let activeViewCleanup = null;
let renderSeq = 0;
let isLoggingOut = false;

function runActiveViewCleanup() {
    if (typeof activeViewCleanup === 'function') {
        try {
            activeViewCleanup();
        } catch (err) {
            console.warn("Cleanup view sebelumnya gagal:", err);
        }
        activeViewCleanup = null;
    }
}

window.handleLogout = () => {
    if (isLoggingOut) return;
    isLoggingOut = true;

    signOut(auth).then(() => {
        runActiveViewCleanup();
        localStorage.clear();
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.style.display = '';
        if (location.hash !== '#/login') {
            location.hash = '#/login';
        } else {
            router();
        }
    }).catch(error => {
        console.error("Gagal keluar:", error);
    }).finally(() => {
        isLoggingOut = false;
    });
};

function appContainerHasContent() {
    const appEl = document.getElementById('app');
    return Boolean(appEl && appEl.children.length > 0);
}

export async function router() {
    ensureGlobalScrollbarHiddenStyle();
    const currentSeq = ++renderSeq;
    let path = extractRoutePath();

    if (Object.prototype.hasOwnProperty.call(routeAliases, path)) {
        const queryIdx = String(location.hash || "").indexOf("?");
        const querySuffix = queryIdx !== -1 ? String(location.hash).slice(queryIdx) : "";
        path = routeAliases[path];
        const normalizedHash = `#${path}${querySuffix}`;
        if (location.hash.toLowerCase() !== normalizedHash.toLowerCase()) {
            location.hash = normalizedHash;
            return;
        }
    }

    const isKnownRoute =
        Object.prototype.hasOwnProperty.call(routes, path) ||
        Object.prototype.hasOwnProperty.call(optionalSubRoutes, path);

    if (!isKnownRoute) {
        path = '/';
    }

    const appContainer = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const headerEl = document.querySelector('header:not(#global-public-navbar):not(#public-navbar)');
    const bottomNav = document.getElementById('bottom-nav');

    const isLoggedIn = Boolean(localStorage.getItem('user_email') || auth.currentUser);
    if (!isLoggedIn && path !== '/login') {
        if (location.hash !== '#/login') {
            location.hash = '#/login';
            return;
        }
        path = '/login';
    }

    if (ADMIN_ONLY_ROUTES.includes(path) && !isCurrentUserAdmin()) {
        if (location.hash !== '#/') {
            location.hash = '#/';
            return;
        }
        path = '/';
    }

    runActiveViewCleanup();

    const isPublicLanding = PUBLIC_LANDING_ROUTES.includes(path);
    const shouldHideRunningText = path === '/login' || isPublicLanding;

    if (path === '/login') {
        if (sidebar) sidebar.style.display = 'none';
        if (headerEl) headerEl.classList.add('hidden');
        if (bottomNav) bottomNav.classList.add('hidden');
        setRunningTextVisibility(true);
        if (appContainer) {
            appContainer.style.height = "";
            appContainer.className = "rtku-no-scrollbar flex-1 flex flex-col min-h-screen overflow-y-auto p-0 m-0 bg-transparent";
        }
    } else if (isPublicLanding) {
        if (sidebar) sidebar.style.display = 'none';
        if (headerEl) headerEl.classList.add('hidden');
        if (bottomNav) bottomNav.classList.add('hidden');
        setRunningTextVisibility(true);
        if (appContainer) {
            appContainer.style.height = "";
            appContainer.className = "rtku-no-scrollbar flex-1 min-h-0 overflow-y-auto p-0 m-0 bg-[#f6f3ec] dark:bg-stone-950";
        }
    } else {
        if (sidebar) sidebar.style.display = '';
        if (headerEl) headerEl.classList.remove('hidden');
        if (bottomNav) bottomNav.classList.remove('hidden');
        setRunningTextVisibility(false);
        if (appContainer) {
            appContainer.style.height = "";
            appContainer.className = "rtku-no-scrollbar flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 pb-28 md:pb-12";
        }
    }

    if (appContainer) {
        let renderFunction = routes[path];
        let initHandler = handlers[path];

        if (!renderFunction && Object.prototype.hasOwnProperty.call(optionalSubRoutes, path)) {
            const subCfg = optionalSubRoutes[path];
            const loaded = await loadOptionalView(
                subCfg.modulePath,
                subCfg.renderName,
                subCfg.handlerName,
                subCfg.label
            );
            if (currentSeq !== renderSeq) return;
            renderFunction = loaded.render;
            initHandler = loaded.init;
        }

        if (!renderFunction) {
            renderFunction = renderHome;
            initHandler = initHomeHandler;
        }

        appContainer.innerHTML = await renderFunction();

        const cleanupResult = typeof initHandler === 'function' ? await initHandler() : null;
        if (typeof cleanupResult === 'function') {
            activeViewCleanup = cleanupResult;
        }
    }

    const activeSidebarPath =
        path === '/database-control-size' || path === '/reset-data'
            ? '/database'
            : path.startsWith('/manajemen-kependudukan/')
                ? '/manajemen-kependudukan'
                : path.startsWith('/manajemen-administrasi/')
                    ? '/manajemen-administrasi'
                    : path.startsWith('/manajemen-keuangan/')
                        ? '/manajemen-keuangan'
                        : path;

    const sidebarLinks = document.querySelectorAll('#sidebar-nav a');
    sidebarLinks.forEach(link => {
        const href = String(link.getAttribute('href') || '').toLowerCase();
        const routeAttr = String(link.getAttribute('data-route') || '').toLowerCase();
        const isActive = href === '#' + activeSidebarPath || (activeSidebarPath === '/' && routeAttr === 'home');
        if (isActive) {
            link.className = "flex items-center gap-3 px-3 py-2.5 rounded-none text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 font-semibold transition";
        } else {
            link.className = "flex items-center gap-3 px-3 py-2.5 rounded-none text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition";
        }
    });

    syncAdminMenuUI(path, isPublicLanding, shouldHideRunningText);
}

let isAuthListenerInitialized = false;
let isGlobalEventsInitialized = false;

export function initRouter() {
    ensureGlobalScrollbarHiddenStyle();
    if (!isAuthListenerInitialized) {
        isAuthListenerInitialized = true;
        onAuthStateChanged(auth, async (user) => {
            const hadSessionEmail = Boolean(localStorage.getItem('user_email'));
            let path = extractRoutePath();

            if (!user) {
                if (hadSessionEmail) {
                    runActiveViewCleanup();
                    localStorage.clear();
                }
                if (path !== '/login') {
                    if (location.hash !== '#/login') {
                        location.hash = '#/login';
                    } else {
                        router();
                    }
                } else {
                    syncAdminMenuUI('/login', false, true);
                }
                return;
            }

            let userRole = localStorage.getItem('user_role') || DEFAULT_USER_ROLE;
            const email = String(user.email || "").trim();
            let photoURL = user.photoURL || localStorage.getItem('user_avatar') || "";

            const fallbackPrefix = email.includes('@') ? email.split('@')[0] : (user.displayName || DEFAULT_USER_ROLE);
            let displayName = localStorage.getItem('user_name') || user.displayName || fallbackPrefix;
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

            let existingUserDoc = null;
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    existingUserDoc = userDocSnap.data();
                }
            } catch (err) {
                console.error("Gagal membaca dokumen users:", err);
            }

            const isExistingAdmin = String(existingUserDoc?.role || "").trim().toLowerCase() === "administrator";
            const { isFirstLogin, hasOtherAdmin } = await inspectUsersBootstrap(user.uid);
            const canBootstrapAsAdmin = isFirstLogin || (!hasOtherAdmin && (!existingUserDoc || isExistingAdmin));
            const isRegisteredWarga = canBootstrapAsAdmin || isExistingAdmin ? true : await isEmailRegisteredInWarga(email);

            if (!isRegisteredWarga) {
                runActiveViewCleanup();
                localStorage.clear();
                sessionStorage.clear();
                showLoginErrorNotice(NOT_REGISTERED_MESSAGE);
                await signOut(auth).catch(() => {});
                if (location.hash !== '#/login') {
                    location.hash = '#/login';
                } else {
                    router();
                }
                return;
            }

            const assignedRole = canBootstrapAsAdmin
                ? "Administrator"
                : (existingUserDoc?.role || DEFAULT_USER_ROLE);

            try {
                const userDocRef = doc(db, "users", user.uid);

                if (existingUserDoc) {
                    if (existingUserDoc.nama) displayName = existingUserDoc.nama;
                    userRole = assignedRole;
                    if (existingUserDoc.photoURL) photoURL = existingUserDoc.photoURL;
                } else {
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        email: email,
                        nama: displayName,
                        photoURL: photoURL,
                        role: assignedRole,
                        createdAt: new Date().toISOString()
                    });
                    userRole = assignedRole;
                }
            } catch (err) {
                console.error("Gagal memuat data pengguna di Firestore:", err);
            }

            if (!auth.currentUser) return;

            const nameParts = displayName.trim().split(/\s+/);
            const initials = nameParts.length > 1
                ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                : displayName.substring(0, 2).toUpperCase();

            localStorage.setItem('user_name', displayName);
            localStorage.setItem('user_email', email);
            localStorage.setItem('user_role', userRole);
            localStorage.setItem('user_initial', initials);
            if (isSafeAvatarSrc(photoURL)) {
                localStorage.setItem('user_avatar', photoURL);
            }

            const currentPathNow = extractRoutePath();
            const isLandingNow = PUBLIC_LANDING_ROUTES.includes(currentPathNow);
            syncAdminMenuUI(currentPathNow, isLandingNow, currentPathNow === '/login' || isLandingNow);

            const userNameEl = document.getElementById('user-name');
            const userEmailEl = document.getElementById('user-email');
            const userRoleEl = document.getElementById('user-role');
            const mobileNameEl = document.getElementById('mobile-dropdown-name');
            const mobileEmailEl = document.getElementById('mobile-dropdown-email');
            const mobileRoleEl = document.getElementById('mobile-user-role');

            if (userNameEl) userNameEl.textContent = displayName;
            if (userEmailEl) userEmailEl.textContent = email;
            if (userRoleEl) userRoleEl.textContent = userRole;
            if (mobileNameEl) mobileNameEl.textContent = displayName;
            if (mobileEmailEl) mobileEmailEl.textContent = email;
            if (mobileRoleEl) mobileRoleEl.textContent = userRole;

            const userInitialEl = document.getElementById('user-initial');
            if (userInitialEl) {
                if (isSafeAvatarSrc(photoURL)) {
                    const img = document.createElement('img');
                    img.src = photoURL;
                    img.alt = "Profile";
                    img.className = "w-full h-full object-cover rounded-none";
                    img.onerror = function() {
                        userInitialEl.textContent = initials;
                    };
                    userInitialEl.replaceChildren(img);
                } else {
                    userInitialEl.textContent = initials;
                }
            }

            const mobileAvatarImg = document.getElementById('mobile-user-avatar-img');
            if (mobileAvatarImg) {
                if (isSafeAvatarSrc(photoURL)) {
                    mobileAvatarImg.src = photoURL;
                    mobileAvatarImg.classList.remove('hidden');
                    mobileAvatarImg.style.display = 'block';
                } else {
                    mobileAvatarImg.classList.add('hidden');
                    mobileAvatarImg.style.display = 'none';
                }
            }

            path = extractRoutePath();

            if (path === '/login') {
                if (location.hash !== '#/') {
                    location.hash = '#/';
                } else {
                    router();
                }
            } else if (ADMIN_ONLY_ROUTES.includes(path) && !isCurrentUserAdmin()) {
                if (location.hash !== '#/') {
                    location.hash = '#/';
                } else {
                    router();
                }
            } else if (!appContainerHasContent()) {
                router();
            }
        });
    }

    if (!isGlobalEventsInitialized) {
        isGlobalEventsInitialized = true;
        window.addEventListener('hashchange', router);

        const handleLinkClick = e => {
            const linkEl = e.target.closest('[data-link]');
            if (!linkEl) return;
            const targetHash = linkEl.getAttribute('href');
            if (!targetHash || !targetHash.startsWith('#')) return;

            e.preventDefault();
            if (location.hash.toLowerCase() !== targetHash.toLowerCase()) {
                location.hash = targetHash;
            } else {
                router();
            }

            const popup = document.getElementById('mobile-more-popup');
            if (popup) popup.classList.add('hidden');

            if (window.innerWidth < 768) {
                const sidebar = document.getElementById('sidebar');
                const backdrop = document.getElementById('sidebar-backdrop');
                if (sidebar) sidebar.classList.add('-translate-x-full');
                if (backdrop) backdrop.classList.add('hidden');
            }
        };

        const bootRouter = () => {
            const initialPath = extractRoutePath();
            const isLanding = PUBLIC_LANDING_ROUTES.includes(initialPath);
            syncAdminMenuUI(initialPath, isLanding, initialPath === '/login' || isLanding);
            router();
            document.body.addEventListener('click', handleLinkClick);
        };

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', bootRouter, { once: true });
        } else {
            bootRouter();
        }
    }
}

export default router;