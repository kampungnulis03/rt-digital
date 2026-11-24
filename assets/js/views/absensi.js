// File: assets/js/views/absensi.js
import { collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { db, auth } from "../firebase-init.js";

const DEFAULT_BRAND_NAME = "RTKu Digital";
const PROFILE_CACHE_KEY = "rtku_profil_cache_v1";
const LOCAL_ABSENSI_CACHE_KEY = "rtku_absensi_local_v1";

function escapeHtml(value = "") {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getTodayIsoDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatJamSekarang() {
    return new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function readCachedBrandName() {
    try {
        const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
        if (!raw) return DEFAULT_BRAND_NAME;
        const parsed = JSON.parse(raw);
        return String(parsed?.nama || DEFAULT_BRAND_NAME).trim() || DEFAULT_BRAND_NAME;
    } catch {
        return DEFAULT_BRAND_NAME;
    }
}

function writeLocalAbsensi(entry) {
    try {
        const raw = sessionStorage.getItem(LOCAL_ABSENSI_CACHE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const next = Array.isArray(list) ? [entry, ...list] : [entry];
        sessionStorage.setItem(LOCAL_ABSENSI_CACHE_KEY, JSON.stringify(next));
    } catch {
        // Abaikan jika storage penuh atau dibatasi
    }
}

function getActiveLoginEmail() {
    const fromAuth = String(auth.currentUser?.email || "").trim().toLowerCase();
    if (fromAuth) return fromAuth;
    return String(localStorage.getItem("user_email") || "").trim().toLowerCase();
}

function getFallbackUserMeta(email = "") {
    const cleanEmail = String(email || "").trim();
    const prefix = cleanEmail.includes("@") ? cleanEmail.split("@")[0] : cleanEmail;
    const storedName = String(localStorage.getItem("user_name") || "").trim();
    const nama = storedName || (prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : "");
    return { kode: "", nama, email: cleanEmail };
}

function mapWargaDoc(docId, data = {}) {
    const nama = String(
        data.nama ||
        data.namaWarga ||
        data.nama_warga ||
        data.nama_lengkap ||
        data.namaLengkap ||
        ""
    ).trim();
    const kode = String(
        data.kode ||
        data.kodeWarga ||
        data.kode_warga ||
        data.idWarga ||
        data.nik ||
        docId ||
        ""
    ).trim();
    const email = String(data.email || "").trim().toLowerCase();
    return { id: docId, kode, nama, email };
}

function parseQrPayload(rawCode = "") {
    const clean = String(rawCode || "").trim();
    if (!clean) return { kodeWarga: "", namaWarga: "" };

    if (clean.startsWith("{") && clean.endsWith("}")) {
        try {
            const obj = JSON.parse(clean);
            const kodeWarga = String(obj.kode || obj.kodeWarga || obj.id || obj.nik || "").trim();
            const namaWarga = String(obj.nama || obj.namaWarga || obj.name || "").trim();
            return {
                kodeWarga: kodeWarga || namaWarga || clean,
                namaWarga: namaWarga || kodeWarga || clean
            };
        } catch {
            // Lanjut ke format teks biasa
        }
    }

    if (clean.includes("|")) {
        const parts = clean.split("|").map((s) => s.trim());
        return {
            kodeWarga: parts[0] || clean,
            namaWarga: parts[1] || parts[0] || clean
        };
    }

    return {
        kodeWarga: clean,
        namaWarga: clean
    };
}

export function renderAbsensi() {
    const brandName = escapeHtml(readCachedBrandName());

    return `
        <div class="max-w-xl w-full mx-auto px-4 py-6 text-stone-800 dark:text-stone-100">
            <div class="bg-[#faf8f3] dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none p-4 sm:p-5 space-y-4">
                <div class="border-b border-stone-200 dark:border-stone-800 pb-3">
                    <div class="text-[11px] font-bold uppercase tracking-wider text-[#5c6d4e] dark:text-emerald-400">
                        ${brandName}
                    </div>
                    <h1 class="text-lg font-extrabold text-stone-900 dark:text-stone-100 mt-0.5">
                        Absensi Warga
                    </h1>
                    <p id="absensi-subjudul" class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        Arahkan kamera ke QR Code warga untuk mencatat kehadiran.
                    </p>
                </div>

                <!-- Pilihan Status -->
                <div class="flex items-center justify-between gap-3">
                    <label for="absensi-qr-status" class="text-xs font-bold text-stone-700 dark:text-stone-200">
                        Status Kehadiran
                    </label>
                    <select
                        id="absensi-qr-status"
                        class="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                    >
                        <option value="Hadir">Hadir</option>
                        <option value="Izin">Izin</option>
                        <option value="Sakit">Sakit</option>
                    </select>
                </div>

                <!-- MODE HADIR: Area Kamera QR -->
                <div id="absensi-scan-section" class="space-y-4">
                    <div class="relative w-full h-72 sm:h-80 bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none overflow-hidden flex items-center justify-center">
                        <video
                            id="absensi-qr-video"
                            class="w-full h-full object-cover hidden"
                            playsinline
                            muted
                        ></video>

                        <div id="absensi-qr-placeholder" class="text-center px-4 space-y-1.5">
                            <div class="text-xs font-semibold text-stone-200">Kamera QR Code belum aktif</div>
                            <div class="text-[11px] text-stone-400">
                                Tekan <strong>Mulai Scan QR</strong> atau pilih gambar QR Code.
                            </div>
                        </div>

                        <div id="absensi-qr-reticle" class="hidden pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div class="w-48 h-48 border-2 border-[#c87d32] bg-black/10"></div>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                id="absensi-start-scan-btn"
                                class="px-4 py-2 text-xs font-semibold bg-[#5c6d4e] hover:bg-[#4b5a3f] text-white rounded-none transition cursor-pointer"
                            >
                                Mulai Scan QR
                            </button>
                            <button
                                type="button"
                                id="absensi-stop-scan-btn"
                                class="hidden px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-none transition cursor-pointer"
                            >
                                Stop Kamera
                            </button>
                        </div>

                        <label
                            for="absensi-qr-file-input"
                            class="px-3.5 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-[#f6f3ec] dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#c87d32] rounded-none transition cursor-pointer"
                        >
                            Pilih Gambar QR
                        </label>
                        <input id="absensi-qr-file-input" type="file" accept="image/*" class="hidden">
                    </div>
                </div>

                <!-- MODE IZIN / SAKIT: Kolom Keterangan Menggantikan Kamera Scan -->
                <form id="absensi-keterangan-section" class="hidden space-y-3 bg-[#f6f3ec] dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800 rounded-none p-3.5">
                    <div>
                        <label for="absensi-ket-nama" class="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-1">
                            Nama Warga
                        </label>
                        <input
                            id="absensi-ket-nama"
                            type="text"
                            list="absensi-warga-list"
                            placeholder="Ketik nama warga"
                            required
                            class="w-full px-3 py-2 text-xs bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                        <datalist id="absensi-warga-list"></datalist>
                    </div>

                    <div>
                        <label for="absensi-ket-kode" class="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-1">
                            Kode / ID Warga (Opsional)
                        </label>
                        <input
                            id="absensi-ket-kode"
                            type="text"
                            placeholder="Contoh: W001 (opsional)"
                            class="w-full px-3 py-2 text-xs bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        >
                    </div>

                    <div>
                        <label id="absensi-ket-label" for="absensi-ket-isi" class="block text-[11px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300 mb-1">
                            Kolom Keterangan
                        </label>
                        <textarea
                            id="absensi-ket-isi"
                            rows="4"
                            required
                            placeholder="Tuliskan keterangan izin atau sakit..."
                            class="w-full px-3 py-2 text-xs bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-none text-stone-900 dark:text-stone-100 focus:outline-none focus:border-[#c87d32]"
                        ></textarea>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            id="absensi-ket-cancel-btn"
                            class="px-4 py-2 text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-none transition cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            id="absensi-ket-submit-btn"
                            class="px-4 py-2 text-xs font-semibold bg-[#c87d32] hover:bg-[#b06b26] text-white rounded-none transition cursor-pointer"
                        >
                            Kirim Keterangan
                        </button>
                    </div>
                </form>

                <!-- Hasil / Status Pesan -->
                <div id="absensi-qr-result" class="text-xs px-3 py-2.5 bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-none text-stone-700 dark:text-stone-200">
                    Menunggu pemindaian QR Code...
                </div>
            </div>
        </div>
    `;
}

export function initAbsensiHandler() {
    let isDestroyed = false;
    let mediaStream = null;
    let scanRafId = null;
    let barcodeDetector = null;
    let isScanning = false;
    let isSaving = false;
    let lastCode = "";
    let lastTime = 0;
    let wargaList = [];
    let matchedCurrentWarga = null;

    const subjudulEl = document.getElementById("absensi-subjudul");
    const statusSelect = document.getElementById("absensi-qr-status");

    const scanSectionEl = document.getElementById("absensi-scan-section");
    const videoEl = document.getElementById("absensi-qr-video");
    const placeholderEl = document.getElementById("absensi-qr-placeholder");
    const reticleEl = document.getElementById("absensi-qr-reticle");
    const startBtn = document.getElementById("absensi-start-scan-btn");
    const stopBtn = document.getElementById("absensi-stop-scan-btn");
    const fileInput = document.getElementById("absensi-qr-file-input");

    const ketFormEl = document.getElementById("absensi-keterangan-section");
    const ketNamaInput = document.getElementById("absensi-ket-nama");
    const ketKodeInput = document.getElementById("absensi-ket-kode");
    const ketLabelEl = document.getElementById("absensi-ket-label");
    const ketIsiInput = document.getElementById("absensi-ket-isi");
    const ketCancelBtn = document.getElementById("absensi-ket-cancel-btn");
    const ketSubmitBtn = document.getElementById("absensi-ket-submit-btn");
    const wargaDatalistEl = document.getElementById("absensi-warga-list");

    const resultEl = document.getElementById("absensi-qr-result");

    function setResultBox(msg, tone = "neutral") {
        if (!resultEl || isDestroyed) return;
        resultEl.textContent = msg;
        if (tone === "success") {
            resultEl.className = "text-xs px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-none text-emerald-900 dark:text-emerald-200 font-semibold";
        } else if (tone === "error") {
            resultEl.className = "text-xs px-3 py-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-none text-rose-800 dark:text-rose-200 font-medium";
        } else {
            resultEl.className = "text-xs px-3 py-2.5 bg-[#f6f3ec] dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-none text-stone-700 dark:text-stone-200";
        }
    }

    function stopCamera() {
        isScanning = false;
        if (scanRafId !== null) {
            cancelAnimationFrame(scanRafId);
            scanRafId = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach((track) => track.stop());
            mediaStream = null;
        }
        if (videoEl) {
            videoEl.pause();
            videoEl.srcObject = null;
            videoEl.classList.add("hidden");
        }
        placeholderEl?.classList.remove("hidden");
        reticleEl?.classList.add("hidden");
        startBtn?.classList.remove("hidden");
        stopBtn?.classList.add("hidden");
    }

    function autofillExcuseIdentity({ force = false } = {}) {
        if (isDestroyed) return;
        const email = getActiveLoginEmail();
        const byEmail = email
            ? wargaList.find((w) => String(w.email || "").trim().toLowerCase() === email)
            : null;
        matchedCurrentWarga = byEmail || null;

        const fallback = getFallbackUserMeta(email);
        const resolvedNama = String(byEmail?.nama || fallback.nama || "").trim();
        const resolvedKode = String(byEmail?.kode || fallback.kode || "").trim();

        if (ketNamaInput && (force || !String(ketNamaInput.value || "").trim()) && resolvedNama) {
            ketNamaInput.value = resolvedNama;
        }
        if (ketKodeInput && (force || !String(ketKodeInput.value || "").trim()) && resolvedKode) {
            ketKodeInput.value = resolvedKode;
        }
    }

    function syncModeByStatus() {
        const status = String(statusSelect?.value || "Hadir").trim();
        const isExcuseMode = status === "Izin" || status === "Sakit";

        if (isExcuseMode) {
            stopCamera();
            scanSectionEl?.classList.add("hidden");
            ketFormEl?.classList.remove("hidden");
            autofillExcuseIdentity({ force: false });

            if (subjudulEl) {
                subjudulEl.textContent = `Isi kolom keterangan untuk mencatat status ${status}.`;
            }
            if (ketLabelEl) {
                ketLabelEl.textContent = `Keterangan ${status}`;
            }
            if (ketIsiInput) {
                ketIsiInput.placeholder = status === "Sakit"
                    ? "Tuliskan keterangan sakit..."
                    : "Tuliskan keterangan izin...";
            }

            const emailNow = getActiveLoginEmail();
            if (matchedCurrentWarga?.nama) {
                setResultBox(
                    `Data warga terisi otomatis (${matchedCurrentWarga.nama}${matchedCurrentWarga.kode ? ` • ${matchedCurrentWarga.kode}` : ""}). Silakan isi keterangan ${status.toLowerCase()}.`,
                    "neutral"
                );
            } else if (emailNow) {
                setResultBox(
                    `Email login (${emailNow}) belum cocok di data warga. Nama awal diisi otomatis; silakan lengkapi bila perlu.`,
                    "neutral"
                );
            } else {
                setResultBox(`Mode ${status}: silakan isi nama dan kolom keterangan.`, "neutral");
            }

            ketIsiInput?.focus();
        } else {
            ketFormEl?.classList.add("hidden");
            scanSectionEl?.classList.remove("hidden");

            if (subjudulEl) {
                subjudulEl.textContent = "Arahkan kamera ke QR Code warga untuk mencatat kehadiran.";
            }
            setResultBox("Menunggu pemindaian QR Code...", "neutral");
        }
    }

    function handleKeteranganCancel() {
        if (ketIsiInput) ketIsiInput.value = "";
        if (statusSelect) {
            statusSelect.value = "Hadir";
        }
        syncModeByStatus();
    }

    function resolveWarga(parsed) {
        const qCode = String(parsed.kodeWarga || "").trim().toLowerCase();
        const qName = String(parsed.namaWarga || "").trim().toLowerCase();
        const matched = wargaList.find((w) => {
            const k = String(w.kode || "").trim().toLowerCase();
            const n = String(w.nama || "").trim().toLowerCase();
            return (qCode && k === qCode) || (qName && n === qName) || (qCode && k.includes(qCode));
        });

        return {
            kodeWarga: matched?.kode || parsed.kodeWarga || parsed.namaWarga,
            namaWarga: matched?.nama || parsed.namaWarga || parsed.kodeWarga,
            emailWarga: matched?.email || getActiveLoginEmail()
        };
    }

    async function handleQrDetected(rawValue = "") {
        const clean = String(rawValue || "").trim();
        if (!clean || isSaving || isDestroyed) return;

        const now = Date.now();
        if (clean === lastCode && now - lastTime < 3000) return;
        lastCode = clean;
        lastTime = now;

        isSaving = true;
        stopCamera();

        const parsed = resolveWarga(parseQrPayload(clean));
        const status = String(statusSelect?.value || "Hadir").trim() || "Hadir";
        const tanggal = getTodayIsoDate();
        const waktu = formatJamSekarang();

        const record = {
            tanggal,
            waktu,
            kodeWarga: parsed.kodeWarga,
            namaWarga: parsed.namaWarga,
            emailWarga: parsed.emailWarga,
            status,
            keterangan: "",
            metode: "Scan QR",
            recordedByEmail: getActiveLoginEmail(),
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "absensi"), record);
            setResultBox(
                `Absensi tercatat: ${parsed.namaWarga} (${parsed.kodeWarga}) • ${status} • ${waktu}`,
                "success"
            );
        } catch (err) {
            console.warn("Gagal simpan ke Firestore, disimpan ke cache sesi:", err?.message || err);
            writeLocalAbsensi(record);
            setResultBox(
                `Absensi tercatat di sesi: ${parsed.namaWarga} (${parsed.kodeWarga}) • ${status} • ${waktu}`,
                "success"
            );
        } finally {
            isSaving = false;
        }
    }

    async function handleKeteranganSubmit(e) {
        e.preventDefault();
        if (isSaving || isDestroyed) return;

        const status = String(statusSelect?.value || "Izin").trim();
        const namaRaw = String(ketNamaInput?.value || "").trim();
        const kodeRaw = String(ketKodeInput?.value || "").trim();
        const keterangan = String(ketIsiInput?.value || "").trim();

        if (!namaRaw || !keterangan) {
            setResultBox(`Lengkapi nama warga dan kolom keterangan ${status.toLowerCase()}.`, "error");
            return;
        }

        isSaving = true;
        if (ketSubmitBtn) {
            ketSubmitBtn.disabled = true;
            ketSubmitBtn.textContent = "Menyimpan...";
        }

        const matched = resolveWarga({ kodeWarga: kodeRaw, namaWarga: namaRaw });
        const namaWarga = matched.namaWarga || namaRaw;
        const kodeWarga = kodeRaw || matched.kodeWarga || "-";
        const tanggal = getTodayIsoDate();
        const waktu = formatJamSekarang();

        const record = {
            tanggal,
            waktu,
            kodeWarga,
            namaWarga,
            emailWarga: matched.emailWarga || getActiveLoginEmail(),
            status,
            keterangan,
            metode: `Keterangan (${status})`,
            recordedByEmail: getActiveLoginEmail(),
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "absensi"), record);
            setResultBox(
                `Keterangan ${status} tercatat untuk ${namaWarga} (${waktu}).`,
                "success"
            );
        } catch (err) {
            console.warn("Gagal simpan ke Firestore, disimpan ke cache sesi:", err?.message || err);
            writeLocalAbsensi(record);
            setResultBox(
                `Keterangan ${status} tercatat di sesi untuk ${namaWarga} (${waktu}).`,
                "success"
            );
        } finally {
            isSaving = false;
            if (ketSubmitBtn) {
                ketSubmitBtn.disabled = false;
                ketSubmitBtn.textContent = "Kirim Keterangan";
            }
        }

        if (ketIsiInput) ketIsiInput.value = "";
        autofillExcuseIdentity({ force: true });
        ketIsiInput?.focus();
    }

    async function scanLoop() {
        if (!isScanning || isDestroyed || !videoEl || !barcodeDetector) return;

        if (videoEl.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            try {
                const codes = await barcodeDetector.detect(videoEl);
                if (Array.isArray(codes) && codes.length > 0 && codes[0]?.rawValue) {
                    await handleQrDetected(String(codes[0].rawValue));
                    return;
                }
            } catch {
                // Lanjut ke frame berikutnya
            }
        }

        scanRafId = requestAnimationFrame(scanLoop);
    }

    async function startCamera() {
        if (isDestroyed) return;

        if (typeof window.BarcodeDetector !== "function") {
            setResultBox("Kamera QR otomatis tidak didukung di browser ini. Gunakan Pilih Gambar QR.", "error");
            return;
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
            setResultBox("Kamera tidak dapat diakses. Pastikan memakai HTTPS atau localhost.", "error");
            return;
        }

        try {
            stopCamera();
            if (!barcodeDetector) {
                barcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
            }

            setResultBox("Membuka kamera...", "neutral");
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: "environment" } },
                audio: false
            });

            if (isDestroyed || !videoEl) {
                stopCamera();
                return;
            }

            videoEl.srcObject = mediaStream;
            videoEl.classList.remove("hidden");
            placeholderEl?.classList.add("hidden");
            reticleEl?.classList.remove("hidden");
            startBtn?.classList.add("hidden");
            stopBtn?.classList.remove("hidden");

            await videoEl.play();
            isScanning = true;
            setResultBox("Kamera aktif. Arahkan ke QR Code warga...", "neutral");
            scanRafId = requestAnimationFrame(scanLoop);
        } catch (err) {
            stopCamera();
            setResultBox(`Gagal membuka kamera: ${err?.message || "Izin kamera ditolak"}.`, "error");
        }
    }

    async function handleFileChange(e) {
        const file = e.target?.files?.[0];
        if (!file) return;

        if (typeof window.BarcodeDetector !== "function") {
            setResultBox("Pembacaan gambar QR tidak didukung di browser ini.", "error");
            e.target.value = "";
            return;
        }

        try {
            const detector = barcodeDetector || new window.BarcodeDetector({ formats: ["qr_code"] });
            const bitmap = await createImageBitmap(file);
            const codes = await detector.detect(bitmap);
            if (typeof bitmap.close === "function") bitmap.close();

            if (Array.isArray(codes) && codes.length > 0 && codes[0]?.rawValue) {
                await handleQrDetected(String(codes[0].rawValue));
            } else {
                setResultBox("QR Code tidak terbaca pada gambar tersebut.", "error");
            }
        } catch (err) {
            setResultBox(`Gagal membaca gambar QR: ${err?.message || "Format tidak didukung"}.`, "error");
        } finally {
            e.target.value = "";
        }
    }

    async function loadWargaByLoginEmail() {
        const email = getActiveLoginEmail();
        const list = [];
        const seenIds = new Set();

        const appendDocs = (snap) => {
            snap.forEach((d) => {
                if (seenIds.has(d.id)) return;
                seenIds.add(d.id);
                const mapped = mapWargaDoc(d.id, d.data() || {});
                if (mapped.nama || mapped.kode || mapped.email) {
                    list.push(mapped);
                }
            });
        };

        try {
            if (email) {
                const qSnap = await getDocs(query(collection(db, "warga"), where("email", "==", email)));
                appendDocs(qSnap);
            }
            if (list.length === 0) {
                const allSnap = await getDocs(collection(db, "warga"));
                appendDocs(allSnap);
            }
        } catch {
            try {
                const allSnap = await getDocs(collection(db, "warga"));
                appendDocs(allSnap);
            } catch {
                // Abaikan jika koleksi warga tidak dapat diakses
            }
        }

        if (isDestroyed) return;
        wargaList = list;

        if (wargaDatalistEl) {
            wargaDatalistEl.innerHTML = list
                .filter((w) => w.nama)
                .map((w) => `<option value="${escapeHtml(w.nama)}">${escapeHtml(w.kode ? `${w.nama} (${w.kode})` : w.nama)}</option>`)
                .join("");
        }

        autofillExcuseIdentity({ force: true });

        const currentStatus = String(statusSelect?.value || "Hadir").trim();
        if (currentStatus === "Izin" || currentStatus === "Sakit") {
            syncModeByStatus();
        }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, () => {
        if (!isDestroyed) {
            loadWargaByLoginEmail();
        }
    });

    statusSelect?.addEventListener("change", syncModeByStatus);
    startBtn?.addEventListener("click", startCamera);
    stopBtn?.addEventListener("click", stopCamera);
    fileInput?.addEventListener("change", handleFileChange);
    ketCancelBtn?.addEventListener("click", handleKeteranganCancel);
    ketFormEl?.addEventListener("submit", handleKeteranganSubmit);

    autofillExcuseIdentity({ force: true });
    syncModeByStatus();
    loadWargaByLoginEmail();

    return () => {
        isDestroyed = true;
        stopCamera();
        if (typeof unsubscribeAuth === "function") unsubscribeAuth();
        statusSelect?.removeEventListener("change", syncModeByStatus);
        startBtn?.removeEventListener("click", startCamera);
        stopBtn?.removeEventListener("click", stopCamera);
        fileInput?.removeEventListener("change", handleFileChange);
        ketCancelBtn?.removeEventListener("click", handleKeteranganCancel);
        ketFormEl?.removeEventListener("submit", handleKeteranganSubmit);
    };
}

export default renderAbsensi;