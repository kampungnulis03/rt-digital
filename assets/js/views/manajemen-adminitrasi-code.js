// File: assets/js/views/manajemen-adminitrasi-code.js
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import { db } from "../firebase-init.js";

const COLLECTION_RAPAT = "rapat_rt";
const COLLECTION_KATEGORI = "kategori_rapat_rt";
const DEFAULT_KATEGORI = [
    "Rapat Rutin RT",
    "Rapat Koordinasi Pengurus",
    "Rapat Kerja Bakti & Lingkungan",
    "Rapat Keamanan / Ronda"
];

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getRapatKategori(item = {}) {
    return String(item.kategori || item.kategoriRapat || item.jenis || item.agenda || "Rapat Rutin RT").trim() || "Rapat Rutin RT";
}

async function drawQrToCanvas(canvas, payloadText, labelText = "") {
    if (!canvas) return;
    const cleanPayload = String(payloadText || "Rapat Rutin RT").trim() || "Rapat Rutin RT";
    const qrSize = 320;
    const footerHeight = labelText ? 34 : 0;

    const qrTempCanvas = document.createElement("canvas");
    await QRCode.toCanvas(qrTempCanvas, cleanPayload, {
        width: qrSize,
        margin: 3,
        errorCorrectionLevel: "M",
        color: {
            dark: "#111827",
            light: "#ffffff"
        }
    });

    canvas.width = qrSize;
    canvas.height = qrSize + footerHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qrTempCanvas, 0, 0, qrSize, qrSize);

    if (labelText) {
        ctx.fillStyle = "#faf8f3";
        ctx.fillRect(0, qrSize, qrSize, footerHeight);
        ctx.strokeStyle = "#d6d3d1";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, qrSize);
        ctx.lineTo(qrSize, qrSize);
        ctx.stroke();

        ctx.fillStyle = "#111827";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(labelText).slice(0, 48), qrSize / 2, qrSize + footerHeight / 2);
    }
}

export function renderManajemenAdministrasiCode() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultKatOptions = DEFAULT_KATEGORI
        .map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`)
        .join("");

    return `
        <div class="space-y-5">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 leading-snug">
                        Administrasi • Code QR Absensi
                    </h1>
                    <p class="text-xs md:text-sm text-stone-600 dark:text-stone-400 mt-1">
                        Buat dan unduh Kode QR absensi dari tanggal dan kategori rapat.
                    </p>
                </div>
                <a
                    href="#/manajemen/administrasi"
                    data-link
                    class="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-none text-xs font-semibold border border-stone-200 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] hover:text-[#c87d32] transition flex-shrink-0"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                    <span>Kembali</span>
                </a>
            </div>

            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-6">
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div class="lg:col-span-7 space-y-4">
                        <div class="pb-3 border-b border-stone-200 dark:border-stone-800">
                            <h2 class="text-xs md:text-sm font-bold uppercase tracking-wider text-stone-800 dark:text-stone-100">
                                BUAT KODE QR ABSENSI RAPAT
                            </h2>
                            <p class="text-xs text-stone-600 dark:text-stone-400 mt-1">
                                Kode QR dibentuk langsung dari <strong>Tanggal</strong> dan <strong>Kategori Rapat</strong> serta ikut tercatat pada data absensi warga.
                            </p>
                        </div>

                        <div>
                            <label for="mac-rapat-select" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                Pilih Data Rapat (Opsional)
                            </label>
                            <select id="mac-rapat-select" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                <option value="">-- Pilih rapat tersimpan atau isi manual --</option>
                            </select>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label for="mac-tanggal" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Tanggal Rapat <span class="text-rose-500">*</span>
                                </label>
                                <input type="date" id="mac-tanggal" value="${escapeHtml(todayIso)}" class="w-full px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                            </div>
                            <div>
                                <label for="mac-kategori" class="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                                    Kategori Rapat <span class="text-rose-500">*</span>
                                </label>
                                <div class="flex items-stretch gap-1.5">
                                    <select id="mac-kategori" class="flex-1 min-w-0 px-3 py-2 text-xs md:text-sm bg-[#f6f3ec] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none">
                                        ${defaultKatOptions}
                                    </select>
                                    <button type="button" id="mac-toggle-kat-btn" title="Tambah Kategori Rapat" class="px-3 py-2 text-xs font-bold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">+</button>
                                    <button type="button" id="mac-delete-kat-btn" title="Hapus Kategori Rapat Terpilih" class="px-3 py-2 text-xs font-bold border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-none transition cursor-pointer">Hapus</button>
                                </div>
                            </div>
                        </div>

                        <div id="mac-kat-manager" class="hidden bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-300 dark:border-stone-700 rounded-none p-3 space-y-2.5">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                                Tambah Kategori Rapat Baru
                            </div>
                            <div class="flex items-center gap-2">
                                <input type="text" id="mac-new-kat-input" placeholder="Nama kategori rapat baru..." class="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none">
                                <button type="button" id="mac-save-kat-btn" class="px-3.5 py-1.5 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">Simpan Kategori</button>
                                <button type="button" id="mac-close-kat-btn" class="px-3 py-1.5 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 rounded-none transition cursor-pointer">Batal</button>
                            </div>
                            <div id="mac-kat-chips" class="flex flex-wrap gap-1.5 pt-1"></div>
                        </div>

                        <div id="mac-feedback" class="hidden px-3 py-2 text-xs font-semibold border rounded-none"></div>

                        <div class="flex flex-wrap items-center gap-2 pt-1">
                            <button type="button" id="mac-generate-btn" class="px-4 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer">
                                Buat Kode QR
                            </button>
                            <button type="button" id="mac-download-btn" class="px-4 py-2 text-xs font-semibold bg-[#c87d32] hover:bg-[#b06b26] text-white rounded-none transition cursor-pointer">
                                Unduh PNG
                            </button>
                        </div>

                        <div class="bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-none p-3">
                            <div class="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                Isi Kode QR (Tanggal | Kategori Rapat)
                            </div>
                            <div id="mac-payload-preview" class="text-xs font-mono text-stone-800 dark:text-stone-200 mt-1 break-all">
                                ${escapeHtml(todayIso)}|Rapat Rutin RT
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-5 flex flex-col items-center justify-center bg-[#f6f3ec] dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800 rounded-none p-5 space-y-3">
                        <div class="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                            Pratinjau Kode QR Absensi
                        </div>
                        <canvas id="mac-canvas" class="border border-stone-300 dark:border-stone-700 bg-white max-w-full h-auto"></canvas>
                        <p class="text-[11px] text-center text-stone-500 dark:text-stone-400">
                            Dipindai warga di halaman <strong>Absensi</strong> untuk mencatat kehadiran rapat.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function initManajemenAdministrasiCodeHandler() {
    let rapatList = [];
    let kategoriDocs = DEFAULT_KATEGORI.map((nama, idx) => ({ id: `default_${idx}`, nama }));
    let isDestroyed = false;
    const todayIso = new Date().toISOString().slice(0, 10);

    const rapatSelectEl = document.getElementById("mac-rapat-select");
    const tanggalEl = document.getElementById("mac-tanggal");
    const kategoriEl = document.getElementById("mac-kategori");
    const toggleKatBtn = document.getElementById("mac-toggle-kat-btn");
    const deleteKatBtn = document.getElementById("mac-delete-kat-btn");
    const katManagerEl = document.getElementById("mac-kat-manager");
    const newKatInput = document.getElementById("mac-new-kat-input");
    const saveKatBtn = document.getElementById("mac-save-kat-btn");
    const closeKatBtn = document.getElementById("mac-close-kat-btn");
    const katChipsEl = document.getElementById("mac-kat-chips");
    const feedbackEl = document.getElementById("mac-feedback");
    const generateBtn = document.getElementById("mac-generate-btn");
    const downloadBtn = document.getElementById("mac-download-btn");
    const previewEl = document.getElementById("mac-payload-preview");
    const canvasEl = document.getElementById("mac-canvas");

    function showFeedback(msg, type = "success") {
        if (!feedbackEl || isDestroyed) return;
        feedbackEl.className =
            type === "error"
                ? "px-3 py-2 text-xs font-semibold border rounded-none bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : "px-3 py-2 text-xs font-semibold border rounded-none bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300";
        feedbackEl.textContent = msg;
        feedbackEl.classList.remove("hidden");
    }

    function hideFeedback() {
        feedbackEl?.classList.add("hidden");
    }

    function getAllKategoriNames() {
        const names = kategoriDocs.map((k) => String(k.nama || "").trim()).filter(Boolean);
        return names.length > 0 ? names : [...DEFAULT_KATEGORI];
    }

    function renderChips() {
        if (!katChipsEl || isDestroyed) return;
        katChipsEl.innerHTML = kategoriDocs
            .map((k) => {
                const isDefault = String(k.id || "").startsWith("default_");
                return `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-none">
                        <span>${escapeHtml(k.nama)}</span>
                        ${!isDefault ? `<button type="button" data-mac-del-kat="${escapeHtml(k.id)}" class="text-rose-600 dark:text-rose-400 hover:font-bold cursor-pointer">×</button>` : ""}
                    </span>
                `;
            })
            .join("");
    }

    function syncKategoriSelect(preferred = "") {
        const names = getAllKategoriNames();
        const target = String(preferred || kategoriEl?.value || names[0] || "Rapat Rutin RT");
        if (kategoriEl) {
            kategoriEl.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
            kategoriEl.value = names.includes(target) ? target : names[0] || "";
        }
        renderChips();
    }

    async function refreshQr() {
        if (isDestroyed) return;
        const tgl = String(tanggalEl?.value || todayIso).trim() || todayIso;
        const kat = String(kategoriEl?.value || getAllKategoriNames()[0] || "Rapat Rutin RT").trim() || "Rapat Rutin RT";
        const payload = `${tgl}|${kat}`;
        if (previewEl) previewEl.textContent = payload;
        try {
            await drawQrToCanvas(canvasEl, payload, `${tgl} • ${kat}`);
        } catch (err) {
            console.error("Gagal menggambar QR:", err);
            showFeedback("Gagal membuat gambar Kode QR.", "error");
        }
    }

    async function handleAddKategori() {
        hideFeedback();
        const namaBaru = String(newKatInput?.value || "").trim();
        if (!namaBaru) {
            showFeedback("Masukkan nama kategori rapat terlebih dahulu.", "error");
            newKatInput?.focus();
            return;
        }
        const exists = kategoriDocs.some((k) => String(k.nama || "").trim().toLowerCase() === namaBaru.toLowerCase());
        if (exists) {
            syncKategoriSelect(namaBaru);
            await refreshQr();
            if (newKatInput) newKatInput.value = "";
            showFeedback(`Kategori "${namaBaru}" sudah tersedia.`);
            return;
        }

        try {
            const ref = await addDoc(collection(db, COLLECTION_KATEGORI), { nama: namaBaru, createdAt: new Date().toISOString() });
            kategoriDocs = [...kategoriDocs, { id: ref.id, nama: namaBaru }];
        } catch {
            kategoriDocs = [...kategoriDocs, { id: `local_${Date.now()}`, nama: namaBaru }];
        }

        if (newKatInput) newKatInput.value = "";
        syncKategoriSelect(namaBaru);
        await refreshQr();
        showFeedback(`Kategori "${namaBaru}" ditambahkan.`);
    }

    async function deleteKategoriById(katId) {
        hideFeedback();
        const target = kategoriDocs.find((k) => k.id === katId);
        if (!target) return;
        if (String(target.id || "").startsWith("default_")) {
            showFeedback("Kategori bawaan sistem tidak dapat dihapus.", "error");
            return;
        }
        if (!window.confirm(`Hapus kategori rapat "${target.nama}"?`)) return;

        if (!String(target.id || "").startsWith("local_")) {
            try {
                await deleteDoc(doc(db, COLLECTION_KATEGORI, target.id));
            } catch (err) {
                console.error("Gagal hapus kategori:", err);
                showFeedback("Gagal menghapus kategori di database.", "error");
                return;
            }
        }
        kategoriDocs = kategoriDocs.filter((k) => k.id !== katId);
        syncKategoriSelect();
        await refreshQr();
        showFeedback(`Kategori "${target.nama}" dihapus.`);
    }

    const onRapatChange = async () => {
        const idx = Number(rapatSelectEl?.value);
        if (Number.isInteger(idx) && idx >= 0 && rapatList[idx]) {
            const r = rapatList[idx];
            if (tanggalEl) tanggalEl.value = String(r.tanggal || todayIso).trim() || todayIso;
            syncKategoriSelect(getRapatKategori(r));
            await refreshQr();
        }
    };

    const onDownload = async () => {
        if (!canvasEl) return;
        await refreshQr();
        const tgl = String(tanggalEl?.value || todayIso).trim().replace(/[^0-9-]/g, "");
        const kat = String(kategoriEl?.value || "rapat").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
        const a = document.createElement("a");
        a.download = `qr-${tgl || todayIso}-${kat || "rapat"}.png`;
        a.href = canvasEl.toDataURL("image/png");
        a.click();
    };

    const onClick = async (e) => {
        const delBtn = e.target.closest("[data-mac-del-kat]");
        if (delBtn) await deleteKategoriById(delBtn.getAttribute("data-mac-del-kat"));
    };

    syncKategoriSelect();
    refreshQr();

    rapatSelectEl?.addEventListener("change", onRapatChange);
    tanggalEl?.addEventListener("change", refreshQr);
    kategoriEl?.addEventListener("change", refreshQr);
    toggleKatBtn?.addEventListener("click", () => {
        katManagerEl?.classList.toggle("hidden");
        newKatInput?.focus();
    });
    closeKatBtn?.addEventListener("click", () => {
        katManagerEl?.classList.add("hidden");
        hideFeedback();
    });
    saveKatBtn?.addEventListener("click", handleAddKategori);
    newKatInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddKategori();
        }
    });
    deleteKatBtn?.addEventListener("click", async () => {
        const sel = String(kategoriEl?.value || "").trim().toLowerCase();
        const found = kategoriDocs.find((k) => String(k.nama || "").trim().toLowerCase() === sel);
        if (found) await deleteKategoriById(found.id);
    });
    generateBtn?.addEventListener("click", refreshQr);
    downloadBtn?.addEventListener("click", onDownload);
    document.addEventListener("click", onClick);

    (async () => {
        try {
            const [rapatSnap, katSnap] = await Promise.allSettled([
                getDocs(collection(db, COLLECTION_RAPAT)),
                getDocs(collection(db, COLLECTION_KATEGORI))
            ]);
            if (isDestroyed) return;

            if (rapatSnap.status === "fulfilled") {
                const list = [];
                rapatSnap.value.forEach((d) => list.push({ id: d.id, ...d.data() }));
                rapatList = list.sort((a, b) => String(b.tanggal || b.createdAt || "").localeCompare(String(a.tanggal || a.createdAt || "")));
                if (rapatSelectEl) {
                    const opts = rapatList.map((r, i) => `<option value="${i}">${escapeHtml(`${r.tanggal || todayIso} • ${getRapatKategori(r)}`)}</option>`);
                    rapatSelectEl.innerHTML = `<option value="">-- Pilih rapat tersimpan atau isi manual --</option>${opts.join("")}`;
                }
            }

            if (katSnap.status === "fulfilled") {
                const merged = [...DEFAULT_KATEGORI.map((nama, idx) => ({ id: `default_${idx}`, nama }))];
                katSnap.value.forEach((d) => {
                    const nm = String(d.data()?.nama || d.data()?.kategori || "").trim();
                    if (nm && !merged.some((m) => m.nama.toLowerCase() === nm.toLowerCase())) {
                        merged.push({ id: d.id, nama: nm });
                    }
                });
                kategoriDocs = merged;
            }

            syncKategoriSelect();
            await refreshQr();
        } catch (err) {
            console.warn("Gagal memuat rapat/kategori QR:", err);
        }
    })();

    return () => {
        isDestroyed = true;
        rapatSelectEl?.removeEventListener("change", onRapatChange);
        tanggalEl?.removeEventListener("change", refreshQr);
        kategoriEl?.removeEventListener("change", refreshQr);
        saveKatBtn?.removeEventListener("click", handleAddKategori);
        downloadBtn?.removeEventListener("click", onDownload);
        document.removeEventListener("click", onClick);
    };
}