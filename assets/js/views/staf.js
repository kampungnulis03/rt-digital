// File: assets/js/views/staf.js
import { getDocs, collection, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-init.js";

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

export function renderStaf() {
    return `
        <div class="space-y-6">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 px-6 py-5 rounded-none flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="text-xl font-bold text-stone-900 dark:text-stone-100">Daftar Staf / Administrator</h1>
                    <p class="text-xs text-stone-600 dark:text-stone-400 mt-0.5" id="staf-info-count">Memuat informasi jumlah...</p>
                </div>
                <button
                    type="button"
                    id="btn-refresh-staf"
                    class="px-4 py-2 bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white text-xs font-semibold transition flex items-center justify-center gap-2 self-start sm:self-auto rounded-none cursor-pointer"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    Muat Ulang Data
                </button>
            </div>

            <!-- CONTAINER UTAMA (Card untuk HP, Tabel untuk Desktop) -->
            <div id="staf-container">
                <div class="p-6 text-center text-xs text-stone-500 dark:text-stone-400 bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none">
                    Memuat data staf...
                </div>
            </div>
        </div>
    `;
}

export function initStafHandler() {
    let isDestroyed = false;

    const loadStaf = async () => {
        const container = document.getElementById('staf-container');
        const infoCountEl = document.getElementById('staf-info-count');
        if (!container || isDestroyed) return;

        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            if (isDestroyed) return;

            let stafList = [];
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const role = String(data.role || '').trim().toLowerCase();

                if (role === 'admin' || role === 'administrator' || role === 'monitoring' || role === 'kantor') {
                    stafList.push({ id: docSnap.id, ...data });
                }
            });

            if (stafList.length === 0) {
                container.innerHTML = `<div class="p-6 text-center text-xs text-stone-600 dark:text-stone-400 bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none">Tidak ada pengguna dengan role Administrator, Monitoring, atau Kantor.</div>`;
                if (infoCountEl) infoCountEl.textContent = `Total: 0 Staf`;
                return;
            }

            if (infoCountEl) {
                infoCountEl.textContent = `Total: ${stafList.length} Staf / Administrator aktif.`;
            }

            // --- 1. TAMPILAN CARD KHUSUS HP ---
            let cardsHTML = `<div class="grid grid-cols-1 gap-3 sm:hidden">`;

            // --- 2. TAMPILAN TABEL UNTUK DESKTOP / TABLET ---
            let tableRowsHTML = `
                <div class="hidden sm:block bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden rounded-none">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-[#f6f3ec] dark:bg-stone-800/80 border-b border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-bold uppercase tracking-wider">
                                    <th class="p-3.5 w-12 text-center">No</th>
                                    <th class="p-3.5">Pengguna</th>
                                    <th class="p-3.5">Email</th>
                                    <th class="p-3.5">Role / Akses</th>
                                    <th class="p-3.5 text-center">Aksi / Ubah Role</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-stone-200/70 dark:divide-stone-800 text-xs text-stone-700 dark:text-stone-300">
            `;

            stafList.forEach((data, index) => {
                const rawName = String(data.nama || data.name || 'Tanpa Nama').trim() || 'Tanpa Nama';
                const name = escapeHtml(rawName);
                const email = escapeHtml(data.email || '-');
                const uid = String(data.id || '');
                const uidSafe = escapeHtml(uid);
                const photoURL = String(data.photoURL || '').trim();
                const currentRole = String(data.role || 'Administrator');
                const currentRoleSafe = escapeHtml(currentRole);
                const roleLower = currentRole.toLowerCase();

                const initials = escapeHtml(rawName.substring(0, 2).toUpperCase());
                const fallbackAvatar = `<div class="w-10 h-10 sm:w-8 sm:h-8 bg-[#5c6d4e] text-white font-bold flex items-center justify-center text-xs flex-shrink-0 rounded-full">${initials}</div>`;

                const avatarHTML = isSafeImageSrc(photoURL)
                    ? `<img src="${escapeHtml(photoURL)}" class="w-10 h-10 sm:w-8 sm:h-8 object-cover flex-shrink-0 rounded-full border border-stone-200 dark:border-stone-700" alt="Avatar" onerror="this.onerror=null; this.replaceWith(Object.assign(document.createElement('div'), { className: 'w-10 h-10 sm:w-8 sm:h-8 bg-[#5c6d4e] text-white font-bold flex items-center justify-center text-xs flex-shrink-0 rounded-full', textContent: '${initials}' }));">`
                    : fallbackAvatar;

                const renderRoleOptions = () => `
                    <option value="Administrator" ${roleLower === 'admin' || roleLower === 'administrator' ? 'selected' : ''}>Administrator</option>
                    <option value="Monitoring" ${roleLower === 'monitoring' ? 'selected' : ''}>Monitoring</option>
                    <option value="Kantor" ${roleLower === 'kantor' ? 'selected' : ''}>Kantor</option>
                    <option value="Tamu" ${roleLower === 'tamu' ? 'selected' : ''}>Tamu</option>
                `;

                // Render Card (HP)
                cardsHTML += `
                    <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-none flex flex-col gap-3">
                        <div class="flex items-center gap-3">
                            ${avatarHTML}
                            <div class="overflow-hidden">
                                <h3 class="font-bold text-sm text-stone-900 dark:text-stone-100 truncate">${name}</h3>
                                <p class="text-xs text-stone-600 dark:text-stone-400 truncate">${email}</p>
                                <span class="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 bg-[#fcf7e8] dark:bg-amber-950/60 text-[#9a5518] dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">Role: ${currentRoleSafe}</span>
                            </div>
                        </div>
                        <div class="space-y-2 pt-2 border-t border-stone-200/70 dark:border-stone-800">
                            <div class="flex items-center gap-1.5">
                                <select id="role-select-staf-card-${uidSafe}" class="w-full p-2 text-xs border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32] rounded-none">
                                    ${renderRoleOptions()}
                                </select>
                                <button type="button" data-action="save-role" data-uid="${uidSafe}" data-select-id="role-select-staf-card-${uidSafe}" class="px-3 py-2 bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white font-semibold text-xs transition cursor-pointer rounded-none">
                                    Simpan
                                </button>
                            </div>
                            <button type="button" data-action="delete-user" data-uid="${uidSafe}" class="w-full py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-semibold text-xs border border-rose-200 dark:border-rose-800 transition cursor-pointer rounded-none text-center">
                                Hapus Pengguna
                            </button>
                        </div>
                    </div>
                `;

                // Render Baris Tabel (Desktop)
                tableRowsHTML += `
                    <tr class="hover:bg-[#f6f3ec]/80 dark:hover:bg-stone-800/50 transition">
                        <td class="p-3.5 text-center text-stone-500 dark:text-stone-400 font-medium">${index + 1}</td>
                        <td class="p-3.5">
                            <div class="flex items-center gap-3">
                                ${avatarHTML}
                                <span class="font-semibold text-stone-900 dark:text-stone-100">${name}</span>
                            </div>
                        </td>
                        <td class="p-3.5 text-stone-600 dark:text-stone-300">${email}</td>
                        <td class="p-3.5">
                            <span class="text-[11px] font-semibold px-2.5 py-1 bg-[#fcf7e8] dark:bg-amber-950/60 text-[#9a5518] dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">${currentRoleSafe}</span>
                        </td>
                        <td class="p-3.5 text-center">
                            <div class="inline-flex items-center gap-2">
                                <select id="role-select-staf-table-${uidSafe}" class="p-1.5 text-xs border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 text-stone-800 dark:text-stone-100 focus:outline-none focus:border-[#c87d32] rounded-none">
                                    ${renderRoleOptions()}
                                </select>
                                <button type="button" data-action="save-role" data-uid="${uidSafe}" data-select-id="role-select-staf-table-${uidSafe}" class="px-3 py-1.5 bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white font-semibold text-[11px] transition cursor-pointer rounded-none">
                                    Simpan Role
                                </button>
                                <button type="button" data-action="delete-user" data-uid="${uidSafe}" class="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-semibold text-[11px] border border-rose-200 dark:border-rose-800 transition cursor-pointer rounded-none">
                                    Hapus
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            cardsHTML += `</div>`;
            tableRowsHTML += `</tbody></table></div></div>`;

            container.innerHTML = cardsHTML + tableRowsHTML;
        } catch (error) {
            console.error("Gagal memuat data staf:", error);
            if (!isDestroyed) {
                container.innerHTML = `<div class="p-6 text-center text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-none">Gagal memuat data dari database. Pastikan koneksi internet stabil.</div>`;
                if (infoCountEl) infoCountEl.textContent = `Gagal memuat data.`;
            }
        }
    };

    const handleUpdateStafRole = async (uid, newRole) => {
        if (!uid || !newRole) return;
        if (!confirm(`Apakah Anda yakin ingin mengubah role pengguna ini menjadi "${newRole}"?`)) return;
        try {
            const userDocRef = doc(db, "users", uid);
            await updateDoc(userDocRef, { role: newRole });
            alert(`Role pengguna berhasil diubah menjadi ${newRole}!`);
            if (!isDestroyed) await loadStaf();
        } catch (err) {
            console.error("Gagal memperbarui role:", err);
            alert("Gagal memperbarui role pengguna.");
        }
    };

    const handleDeleteStafUser = async (uid) => {
        if (!uid) return;
        if (!confirm("Apakah Anda yakin ingin menghapus pengguna ini dari database?")) return;
        try {
            const userDocRef = doc(db, "users", uid);
            await deleteDoc(userDocRef);
            alert("Pengguna berhasil dihapus dari database!");
            if (!isDestroyed) await loadStaf();
        } catch (err) {
            console.error("Gagal menghapus pengguna:", err);
            alert("Gagal menghapus pengguna dari database.");
        }
    };

    const containerEl = document.getElementById('staf-container');
    const onContainerClick = async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const uid = btn.getAttribute('data-uid');

        if (action === 'save-role') {
            const selectId = btn.getAttribute('data-select-id');
            const selectEl = selectId ? document.getElementById(selectId) : null;
            const newRole = selectEl?.value;
            await handleUpdateStafRole(uid, newRole);
        } else if (action === 'delete-user') {
            await handleDeleteStafUser(uid);
        }
    };
    containerEl?.addEventListener('click', onContainerClick);

    const refreshBtn = document.getElementById('btn-refresh-staf');
    const onRefreshClick = () => {
        const container = document.getElementById('staf-container');
        if (container) {
            container.innerHTML = `<div class="p-6 text-center text-xs text-stone-500 dark:text-stone-400 bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none">Memuat ulang data...</div>`;
        }
        loadStaf();
    };
    refreshBtn?.addEventListener('click', onRefreshClick);

    loadStaf();

    return () => {
        isDestroyed = true;
        containerEl?.removeEventListener('click', onContainerClick);
        refreshBtn?.removeEventListener('click', onRefreshClick);
    };
}