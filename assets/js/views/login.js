// File: assets/js/views/login.js
import { GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDoc, setDoc, doc, updateDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "../firebase-init.js";

const NOT_REGISTERED_MESSAGE = "Maaf email anda tidak terdaftar, silahkan hubungi bagian Admin";
const LOGIN_ERROR_STORAGE_KEY = "rtku_login_error_message";
const DEFAULT_APP_NAME = "This Application";
const DEFAULT_APP_ICON = "assets/icons/logo.png";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function isSafeImageSrc(src = "") {
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

function renderErrorMessage(errorBox, message = "") {
    const msg = String(message || "").trim();
    if (!msg) return;
    sessionStorage.setItem(LOGIN_ERROR_STORAGE_KEY, msg);
    sessionStorage.setItem("login_error_message", msg);
    const targetBox = errorBox || document.getElementById("error-msg");
    if (targetBox) {
        targetBox.textContent = msg;
        targetBox.classList.remove("hidden");
        targetBox.style.display = "block";
    }
}

function clearErrorMessage(errorBox) {
    sessionStorage.removeItem(LOGIN_ERROR_STORAGE_KEY);
    sessionStorage.removeItem("login_error_message");
    const targetBox = errorBox || document.getElementById("error-msg");
    if (targetBox) {
        targetBox.textContent = "";
        targetBox.classList.add("hidden");
        targetBox.style.display = "";
    }
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

async function fetchProfilPerusahaan() {
    try {
        const directRef = doc(db, "pengaturan", "profil_perusahaan");
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
            return directSnap.data() || {};
        }

        const colSnap = await getDocs(collection(db, "pengaturan"));
        const foundDoc = colSnap.docs.find(d => d.id === "profil_perusahaan") || colSnap.docs[0];
        return foundDoc ? (foundDoc.data() || {}) : {};
    } catch (err) {
        console.warn("Gagal membaca pengaturan/profil_perusahaan:", err);
        return {};
    }
}

function applyAppBranding(profil = {}) {
    const appName = String(profil?.nama || "").trim() || DEFAULT_APP_NAME;
    const rawIcon = String(profil?.iconUrl || "").trim();
    const iconSrc = isSafeImageSrc(rawIcon) ? rawIcon : DEFAULT_APP_ICON;

    const titleEl = document.getElementById("login-app-name");
    if (titleEl) {
        titleEl.textContent = appName;
    }

    const logoEl = document.getElementById("login-app-logo");
    if (logoEl) {
        logoEl.alt = `Logo ${appName}`;
        logoEl.src = iconSrc;
    }

    return { appName, iconSrc };
}

function showHomeTransitionOverlay(userName = "", roleName = "", branding = {}) {
    const existing = document.getElementById("login-home-transition");
    if (existing) existing.remove();

    const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const safeName = String(userName || "").trim();
    const safeRole = String(roleName || "").trim();
    const appName = String(branding?.appName || "").trim() || DEFAULT_APP_NAME;
    const iconSrc = isSafeImageSrc(branding?.iconSrc) ? String(branding.iconSrc).trim() : DEFAULT_APP_ICON;

    const overlay = document.createElement("div");
    overlay.id = "login-home-transition";
    overlay.setAttribute("aria-live", "polite");
    overlay.style.cssText = [
        "position: fixed",
        "inset: 0",
        "z-index: 9999",
        "display: flex",
        "align-items: center",
        "justify-content: center",
        "background: linear-gradient(135deg, #f6f3ec 0%, #ede7da 55%, #e3e8dc 100%)",
        "color: #292524",
        "opacity: 0",
        `transition: opacity ${prefersReduced ? "120ms" : "420ms"} cubic-bezier(0.22, 1, 0.36, 1)`,
        "pointer-events: all"
    ].join(";");

    overlay.innerHTML = `
        <style>
            @keyframes homeEnterPulse {
                0% { transform: scale(0.94) translateY(8px); opacity: 0; }
                100% { transform: scale(1) translateY(0); opacity: 1; }
            }
            @keyframes homeProgressSweep {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(0%); }
            }
            #login-home-transition .home-transition-card {
                animation: homeEnterPulse ${prefersReduced ? "120ms" : "480ms"} cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            #login-home-transition .home-transition-bar-fill {
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, #5c6d4e, #c87d32);
                transform-origin: left center;
                animation: homeProgressSweep ${prefersReduced ? "150ms" : "650ms"} cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
        </style>
        <div class="home-transition-card flex flex-col items-center text-center px-6 max-w-sm w-full space-y-3">
            <div class="w-16 h-16 rounded-full bg-white/95 border border-stone-200 shadow-md flex items-center justify-center p-2.5 overflow-hidden">
                <img src="${escapeHtml(iconSrc)}" alt="Logo ${escapeHtml(appName)}" class="w-full h-full object-contain" onerror="this.onerror=null;this.src='${escapeHtml(DEFAULT_APP_ICON)}';">
            </div>
            <div class="space-y-1">
                <p class="text-xs uppercase tracking-widest font-semibold text-[#5c6d4e]">Menyiapkan Beranda</p>
                <h2 class="text-lg font-bold text-stone-800">
                    ${safeName ? `Selamat datang, ${escapeHtml(safeName)}` : escapeHtml(appName)}
                </h2>
                ${safeRole ? `<p class="text-xs text-stone-500">Akses: ${escapeHtml(safeRole)}</p>` : ""}
            </div>
            <div class="w-44 h-1 bg-stone-300/70 overflow-hidden mt-1">
                <div class="home-transition-bar-fill"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.style.opacity = "1";
        });
    });

    return overlay;
}

export function renderLogin() {
    return `
        <div data-login-page class="fixed inset-0 z-20 w-full h-full flex items-center justify-center p-4 overflow-hidden">
            <!-- Wallpaper Full Layar menggunakan wallpaper.png -->
            <img src="assets/icons/wallpaper.png" alt="Wallpaper Login" class="absolute inset-0 w-full h-full object-cover z-0">

            <!-- Efek Overlay Gelap Tipis -->
            <div class="absolute inset-0 bg-slate-950/45 z-0"></div>

            <!-- Card Kotak Login Melebar / Full -->
            <div class="relative z-10 w-full max-w-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-none border border-white/50 dark:border-slate-700/70 p-8 sm:p-10 shadow-2xl text-center space-y-6">
                <!-- Logo & Judul -->
                <div class="space-y-2">
                    <div class="inline-flex border border-slate-200 dark:border-slate-700 rounded-none p-3 bg-white/95 dark:bg-slate-900 shadow-xs mb-2">
                        <img id="login-app-logo" src="${DEFAULT_APP_ICON}" alt="Logo ${DEFAULT_APP_NAME}" class="h-12 w-12 object-contain" onerror="this.onerror=null;this.src='${DEFAULT_APP_ICON}';">
                    </div>
                    <h1 id="login-app-name" class="text-2xl font-bold text-slate-800 dark:text-slate-100">${DEFAULT_APP_NAME}</h1>
                    <p class="text-sm text-slate-600 dark:text-slate-300 font-medium">Silakan masuk menggunakan akun Google Anda.</p>
                </div>

                <!-- Error Box -->
                <div id="error-msg" role="alert" class="hidden p-3 bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs rounded-none text-left font-medium"></div>

                <!-- Tombol Google Login -->
                <div class="pt-2">
                    <button id="btn-google" type="button" class="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-none border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-100 font-medium text-base shadow-sm focus:outline-none cursor-pointer">
                        <svg class="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        Masuk dengan Google
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function findWargaByEmail(email) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return null;

    try {
        const wargaCol = collection(db, "warga");
        const exactSnap = await getDocs(query(wargaCol, where("email", "==", normalizedEmail)));
        if (!exactSnap.empty) {
            const docSnap = exactSnap.docs[0];
            return { id: docSnap.id, ...docSnap.data() };
        }

        const allWargaSnap = await getDocs(wargaCol);
        for (const docSnap of allWargaSnap.docs) {
            const data = docSnap.data() || {};
            if (extractWargaEmail(data) === normalizedEmail) {
                return { id: docSnap.id, ...data };
            }
        }
    } catch (err) {
        console.warn("Gagal memeriksa koleksi warga:", err);
    }

    return null;
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
        console.warn("Gagal memeriksa koleksi users:", err);
        return { isFirstLogin: false, hasOtherAdmin: false };
    }
}

export function initLoginHandler() {
    const btnGoogle = document.getElementById('btn-google');
    const errorBox = document.getElementById('error-msg');
    let currentBranding = { appName: DEFAULT_APP_NAME, iconSrc: DEFAULT_APP_ICON };

    if (typeof window.syncRunningTextPosition === 'function') {
        window.syncRunningTextPosition(true);
    }

    fetchProfilPerusahaan().then((profil) => {
        currentBranding = applyAppBranding(profil);
    });

    const pendingErr =
        sessionStorage.getItem(LOGIN_ERROR_STORAGE_KEY) ||
        sessionStorage.getItem("login_error_message");
    if (pendingErr) {
        renderErrorMessage(errorBox, pendingErr);
        sessionStorage.removeItem(LOGIN_ERROR_STORAGE_KEY);
        sessionStorage.removeItem("login_error_message");
    }

    if (btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            clearErrorMessage(errorBox);

            try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                const userEmail = String(user.email || "").trim();

                const userDocRef = doc(db, "users", user.uid);
                let existingUserData = null;
                try {
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        existingUserData = userDocSnap.data();
                    }
                } catch (err) {
                    console.warn("Gagal membaca dokumen user saat login:", err);
                }

                const isExistingAdmin =
                    String(existingUserData?.role || "").trim().toLowerCase() === "administrator";
                const { isFirstLogin, hasOtherAdmin } = await inspectUsersBootstrap(user.uid);
                const canBootstrapAsAdmin = isFirstLogin || (!hasOtherAdmin && (!existingUserData || isExistingAdmin));

                const wargaMatch = canBootstrapAsAdmin ? null : await findWargaByEmail(userEmail);

                // Jika bukan login pertama / belum ada Administrator dan email tidak ada di koleksi warga,
                // jangan tulis/buat dokumen di koleksi users dan langsung logout.
                if (!canBootstrapAsAdmin && !wargaMatch && !isExistingAdmin) {
                    localStorage.clear();
                    sessionStorage.clear();
                    renderErrorMessage(errorBox, NOT_REGISTERED_MESSAGE);
                    await signOut(auth).catch(() => {});
                    requestAnimationFrame(() => {
                        renderErrorMessage(document.getElementById("error-msg"), NOT_REGISTERED_MESSAGE);
                    });
                    return;
                }

                localStorage.clear();
                sessionStorage.clear();

                const assignedRole = canBootstrapAsAdmin
                    ? "Administrator"
                    : (existingUserData?.role || "Tamu");

                let userData;
                const currentPhoto = user.photoURL || "";
                const wargaNama = String(wargaMatch?.nama || wargaMatch?.namaLengkap || "").trim();
                let currentName = wargaNama || user.displayName || (userEmail ? userEmail.split('@')[0] : assignedRole);

                if (!existingUserData) {
                    currentName = currentName.charAt(0).toUpperCase() + currentName.slice(1);

                    userData = {
                        uid: user.uid,
                        email: userEmail,
                        nama: currentName,
                        photoURL: currentPhoto,
                        role: assignedRole,
                        createdAt: new Date().toISOString()
                    };

                    await setDoc(userDocRef, userData);
                } else {
                    const resolvedName = wargaNama || existingUserData.nama || currentName;

                    await updateDoc(userDocRef, {
                        email: userEmail,
                        photoURL: currentPhoto,
                        nama: resolvedName,
                        role: assignedRole
                    });

                    userData = {
                        ...existingUserData,
                        email: userEmail,
                        nama: resolvedName,
                        photoURL: currentPhoto,
                        role: assignedRole
                    };
                }

                const finalName = userData.nama || currentName;
                const finalRole = userData.role || assignedRole;

                localStorage.setItem('user_name', finalName);
                localStorage.setItem('user_email', userEmail);
                localStorage.setItem('user_role', finalRole);
                localStorage.setItem('user_avatar', userData.photoURL);

                const nameParts = String(finalName).trim().split(/\s+/);
                const initials = nameParts.length > 1
                    ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                    : nameParts[0].substring(0, 2).toUpperCase();
                localStorage.setItem('user_initial', initials);

                btnGoogle.disabled = true;
                showHomeTransitionOverlay(finalName, finalRole, currentBranding);
                await sleep(520);

                location.hash = '#/';
                location.reload();
            } catch (error) {
                const transitionEl = document.getElementById("login-home-transition");
                if (transitionEl) transitionEl.remove();
                if (btnGoogle) btnGoogle.disabled = false;

                console.error("Gagal Login Google:", error);
                renderErrorMessage(errorBox, `Gagal Login Google: ${error.message}`);
            }
        });
    }
}