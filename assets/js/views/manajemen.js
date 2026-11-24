// File: assets/js/views/manajemen.js

const MANAGEMENT_ITEMS = [
    {
        id: 'kependudukan',
        title: 'Manajemen Kependudukan',
        description: 'Kelola data warga, KK & mutasi penduduk RT',
        href: '#/manajemen-kependudukan',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`
    },
    {
        id: 'keuangan',
        title: 'Manajemen Keuangan',
        description: 'Kelola kas RT, iuran, pengeluaran & laporan keuangan',
        href: '#/manajemen-keuangan',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    },
    {
        id: 'administrasi',
        title: 'Manajemen Administrasi',
        description: 'Kelola surat menyurat, arsip & administrasi RT',
        href: '#/manajemen-administrasi',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`
    },
    {
        id: 'berita',
        title: 'Berita & Agenda',
        description: 'Kelola berita, agenda kegiatan, dan informasi warga',
        href: '#/manajemen-berita',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>`
    },
    {
        id: 'galeri',
        title: 'Manajemen Galeri',
        description: 'Tambah dan atur galeri foto kegiatan',
        href: '#/manajemen-galeri',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`
    },
    {
        id: 'text',
        title: 'Manajemen Text',
        description: 'Kelola pengumuman & running text',
        href: '#/text',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6h16M4 12h16M4 18h10"/></svg>`
    },
    {
        id: 'pengaturan',
        title: 'Manajemen Pengaturan',
        description: 'Kelola parameter dan profil sistem',
        href: '#/manajemen-pengaturan',
        icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>`
    }
];

export function renderManajemen() {
    const cardsHtml = MANAGEMENT_ITEMS.map(item => `
        <a
            href="${item.href}"
            data-link
            data-management-card="${item.id}"
            class="group bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-[#c87d32] dark:hover:border-[#c87d32] rounded-none px-6 py-8 flex flex-col items-center justify-center text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#c87d32]"
        >
            <div class="w-11 h-11 rounded-none bg-[#f6f3ec] dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-[#4a5a3f] dark:text-stone-300 group-hover:bg-[#5c6d4e] dark:group-hover:bg-[#5c6d4e] group-hover:border-[#4b5a3f] dark:group-hover:border-[#4b5a3f] group-hover:text-white dark:group-hover:text-white flex items-center justify-center mb-4 transition-colors">
                ${item.icon}
            </div>
            <h3 class="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#c87d32] dark:group-hover:text-[#d47a2a] leading-snug transition-colors">
                ${item.title}
            </h3>
            <p class="text-xs text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                ${item.description}
            </p>
        </a>
    `).join('');

    return `
        <div class="space-y-5">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Pengaturan &amp; Manajemen
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Pilih menu di bawah ini untuk membuka halaman pengelolaan.
                    </p>
                </div>
                <a
                    href="#/"
                    data-link
                    class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition flex-shrink-0"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    <span>Kembali</span>
                </a>
            </div>

            <div id="manajemen-cards-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                ${cardsHtml}
            </div>
        </div>
    `;
}

export function initManajemenHandler() {
    const gridEl = document.getElementById('manajemen-cards-grid');

    const handleCardClick = (e) => {
        const card = e.target.closest('[data-management-card]');
        if (!card) return;
        const href = card.getAttribute('href');
        if (href && href.startsWith('#/')) {
            e.preventDefault();
            e.stopPropagation();
            if (location.hash.toLowerCase() !== href.toLowerCase()) {
                location.hash = href;
            } else {
                window.dispatchEvent(new HashChangeEvent('hashchange'));
            }
        }
    };

    gridEl?.addEventListener('click', handleCardClick);

    return () => {
        gridEl?.removeEventListener('click', handleCardClick);
    };
}