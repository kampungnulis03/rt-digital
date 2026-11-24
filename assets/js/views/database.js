// File: assets/js/views/database.js

const DATABASE_MENU_ITEMS = [
    {
        id: 'control-size',
        viewFile: 'database-control-size.js',
        badge: 'KAPASITAS',
        badgeClass: 'bg-[#fcf7e8] dark:bg-amber-950/60 text-[#9a5518] dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
        iconBoxClass: 'bg-[#f6f3ec] dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-[#4b5a3f] dark:text-emerald-400',
        title: 'Control Size',
        description: 'Pantau pemakaian penyimpanan dari batas 1 GB dan rincian ukuran tiap koleksi.',
        actionText: 'Buka Control Size →',
        actionClass: 'text-[#4b5a3f] dark:text-emerald-400 hover:text-[#c87d32] dark:hover:text-amber-300',
        href: '#/database-control-size',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`
    },
    {
        id: 'reset-data',
        viewFile: 'reset-data.js',
        badge: 'RESET',
        badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        iconBoxClass: 'bg-[#f6f3ec] dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-[#c87d32] dark:text-amber-400',
        title: 'Reset Data',
        description: 'Bersihkan atau reset data pada koleksi database tertentu dengan konfirmasi aman.',
        actionText: 'Buka Reset Data →',
        actionClass: 'text-[#c87d32] dark:text-amber-400 hover:text-rose-700 dark:hover:text-rose-300',
        href: '#/reset-data',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`
    }
];

export function renderDatabase() {
    const cardsHtml = DATABASE_MENU_ITEMS.map(item => `
        <a
            href="${item.href}"
            data-link
            data-db-card="${item.id}"
            data-view="${item.viewFile}"
            class="group bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-[#c87d32] dark:hover:border-[#c87d32] rounded-none p-6 flex flex-col justify-between transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#c87d32]"
        >
            <div>
                <div class="flex items-start justify-between gap-3 mb-5">
                    <div class="w-11 h-11 rounded-none border flex items-center justify-center flex-shrink-0 ${item.iconBoxClass}">
                        ${item.icon}
                    </div>
                    <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-none ${item.badgeClass}">
                        ${item.badge}
                    </span>
                </div>

                <h3 class="text-base font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#c87d32] dark:group-hover:text-[#d47a2a] transition-colors">
                    ${item.title}
                </h3>
                <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                    ${item.description}
                </p>
            </div>

            <div class="mt-6 pt-3.5 border-t border-stone-200/70 dark:border-stone-800 flex items-center justify-between text-xs font-semibold ${item.actionClass}">
                <span>${item.actionText}</span>
            </div>
        </a>
    `).join('');

    return `
        <div class="space-y-5">
            <!-- Header Halaman -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Database &amp; Utilitas Penyimpanan
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Kelola pemantauan ukuran penyimpanan (1 GB) serta pembersihan/reset data koleksi database aplikasi.
                    </p>
                </div>

                <div class="flex flex-wrap items-center gap-2.5 flex-shrink-0">
                    <a
                        href="https://analytics.google.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-none text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white transition cursor-pointer"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        <span>Buka Google Analytics Console</span>
                    </a>
                </div>
            </div>

            <!-- Panel Menu Pilihan Database -->
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-5">
                    <h2 class="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-200">
                        MENU PILIHAN DATABASE
                    </h2>
                    <span class="text-xs text-stone-500 dark:text-stone-400">
                        Klik menu untuk membuka
                    </span>
                </div>

                <div id="database-cards-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    ${cardsHtml}
                </div>
            </div>
        </div>
    `;
}

export function initDatabaseHandler() {
    const gridEl = document.getElementById('database-cards-grid');

    const handleCardClick = (e) => {
        const card = e.target.closest('[data-db-card]');
        if (!card) return;
        const href = card.getAttribute('href');
        if (href && href.startsWith('#/')) {
            e.preventDefault();
            e.stopPropagation();
            if (location.hash === href) {
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            } else {
                location.hash = href;
            }
        }
    };

    gridEl?.addEventListener('click', handleCardClick);

    return () => {
        gridEl?.removeEventListener('click', handleCardClick);
    };
}