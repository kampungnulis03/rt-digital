// File: assets/js/app.js
import { initRouter } from './router.js';

// 1. Pastikan fungsi global toggleSidebar tersedia (tanpa menimpa versi di index.html)
if (typeof window.toggleSidebar !== 'function') {
    window.toggleSidebar = function () {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (!sidebar) return;

        if (window.innerWidth < 768) {
            const isOpen = !sidebar.classList.contains('-translate-x-full');
            if (isOpen) {
                sidebar.classList.add('-translate-x-full');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                sidebar.classList.remove('-translate-x-full');
                if (backdrop) backdrop.classList.remove('hidden');
            }
        } else {
            if (sidebar.style.display === 'none') {
                sidebar.style.display = 'flex';
                sidebar.classList.remove('-translate-x-full');
            } else {
                sidebar.style.display = 'none';
            }
        }

        if (typeof window.syncRunningTextPosition === 'function') {
            setTimeout(() => window.syncRunningTextPosition(false), 150);
        }
    };
}

// 1.4. Normalisasi tautan Kas & Layanan agar mengarah ke #/kas-layanan
function syncKasLayananLinks() {
    document.querySelectorAll('a[href="#/unit-usaha"], a[data-route="unit-usaha"]').forEach(el => {
        if (el.getAttribute('href') === '#/unit-usaha') {
            el.setAttribute('href', '#/kas-layanan');
        }
        if (el.getAttribute('data-route') === 'unit-usaha') {
            el.setAttribute('data-route', 'kas-layanan');
        }
    });
}

// 1.5. Inisialisasi Mode Gelap & Cerah Berdasarkan LocalStorage
function initAppTheme() {
    const htmlEl = document.documentElement;
    const savedTheme = localStorage.getItem('app_theme');

    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlEl.classList.add('dark');
    } else {
        htmlEl.classList.remove('dark');
    }

    if (typeof window.syncThemeToggleLabels === 'function') {
        window.syncThemeToggleLabels();
    }
}
initAppTheme();

// 1.6. Sinkronisasi Posisi Bottom Running Text (bottom-0 saat di halaman login, bottom-16 saat di menu utama HP)
// Menggunakan nama terpisah agar tidak menimpa window.syncRunningTextPosition(shouldReload) di index.html
window.syncLoginRunningTextBottom = function (forceLoginState = null) {
    const runningContainer = document.getElementById('global-running-text-container');
    const appContainer = document.getElementById('app');
    if (!runningContainer) return;

    let isLoginPage = false;

    if (typeof forceLoginState === 'boolean') {
        isLoginPage = forceLoginState;
    } else {
        const hash = (window.location.hash || '').toLowerCase();
        const hasLoginEl = appContainer ? Boolean(appContainer.querySelector('[data-login-page], #btn-google')) : false;
        isLoginPage = hash.includes('login') || hasLoginEl;
    }

    if (isLoginPage) {
        runningContainer.classList.remove('bottom-16');
        runningContainer.classList.add('bottom-0');
        if (appContainer) {
            appContainer.classList.remove('pb-28');
            appContainer.classList.add('pb-12');
        }
    } else {
        runningContainer.classList.remove('bottom-0');
        runningContainer.classList.add('bottom-16');
        if (appContainer) {
            appContainer.classList.remove('pb-12');
            appContainer.classList.add('pb-28');
        }
    }
};

// 1.7. Sinkronisasi Indikator Navigasi Aktif
window.syncActiveNav = function () {
    syncKasLayananLinks();

    const rawHash = (window.location.hash || '#/').slice(1).toLowerCase();
    const knownRoutes = ['kas-layanan', 'galeri', 'berita', 'kontak', 'tamu', 'staf', 'analytics', 'manajemen', 'database'];
    const cleanRoute = rawHash.replace(/^\/+/, '').split('?')[0];
    const activeRoute = knownRoutes.includes(cleanRoute) ? cleanRoute : 'home';

    document.querySelectorAll('[data-link][data-route]').forEach(el => {
        const route = el.getAttribute('data-route');
        const isActive = route === activeRoute;

        if (el.closest('#bottom-nav')) {
            el.classList.toggle('text-indigo-600', isActive);
            el.classList.toggle('dark:text-indigo-400', isActive);
            el.classList.toggle('font-bold', isActive);
            el.classList.toggle('text-slate-600', !isActive);
            el.classList.toggle('dark:text-slate-400', !isActive);
        } else {
            el.classList.toggle('bg-indigo-50', isActive);
            el.classList.toggle('dark:bg-indigo-950/60', isActive);
            el.classList.toggle('text-indigo-700', isActive);
            el.classList.toggle('dark:text-indigo-300', isActive);
            el.classList.toggle('font-semibold', isActive);
        }
    });
};

// 2. Fungsi Helper Mutlak untuk Memulihkan Profil / User UI dari LocalStorage secara Instan
window.restoreUserProfile = function () {
    const savedName = localStorage.getItem('user_name');
    const savedEmail = localStorage.getItem('user_email');
    const savedRole = localStorage.getItem('user_role');
    const savedInitial = localStorage.getItem('user_initial');
    const savedAvatar = localStorage.getItem('user_avatar');

    const elName = document.getElementById('user-name');
    const elMobName = document.getElementById('mobile-dropdown-name');
    const elEmail = document.getElementById('user-email');
    const elMobEmail = document.getElementById('mobile-dropdown-email');
    const elInit = document.getElementById('user-initial');
    const elMobAvatar = document.getElementById('mobile-user-avatar-img');

    if (savedName) {
        if (elName) elName.textContent = savedName;
        if (elMobName) elMobName.textContent = savedName;
    }
    if (savedEmail) {
        if (elEmail) elEmail.textContent = savedEmail;
        if (elMobEmail) elMobEmail.textContent = savedEmail;
    }
    if (savedRole) {
        document.querySelectorAll('#user-role').forEach(el => {
            el.textContent = savedRole;
        });
    }
    if (savedInitial) {
        if (elInit) elInit.textContent = savedInitial;
    }
    if (savedAvatar && savedAvatar !== 'null' && savedAvatar !== '' && elMobAvatar) {
        if (elMobAvatar.getAttribute('src') !== savedAvatar) {
            elMobAvatar.src = savedAvatar;
        }
        elMobAvatar.classList.remove('hidden');
    }

    if (typeof window.applyRoleMenuVisibility === 'function') {
        window.applyRoleMenuVisibility(savedRole);
    }
    if (typeof window.syncGlobalPublicUserAvatar === 'function') {
        window.syncGlobalPublicUserAvatar();
    }
};

function syncAllUiState() {
    syncKasLayananLinks();
    window.restoreUserProfile();
    window.syncLoginRunningTextBottom();
    window.syncActiveNav();
    if (typeof window.syncRunningTextPosition === 'function') {
        window.syncRunningTextPosition(false);
    }
    if (typeof window.syncThemeToggleLabels === 'function') {
        window.syncThemeToggleLabels();
    }
}

// Eksekusi pemulihan profil, sinkronisasi navigasi & posisi segera saat skrip dimuat
syncAllUiState();

window.addEventListener('hashchange', syncAllUiState);
window.addEventListener('DOMContentLoaded', syncAllUiState);

// 3. Jalankan Router SPA
initRouter();

// 4. Daftarkan Service Worker untuk PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker berhasil didaftarkan:', reg.scope))
            .catch(err => console.error('Pendaftaran Service Worker gagal:', err));
    });
}