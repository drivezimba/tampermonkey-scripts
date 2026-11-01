# Auto Record & Download Playing Media (Tampermonkey Userscript)

Skrip Tampermonkey ini berfungsi untuk merekam dan mengunduh secara otomatis media (Audio/Video) yang sedang diputar di browser. Skrip ini sangat berguna untuk menangkap media yang menggunakan sistem *streaming* (seperti `blob:`, `.m3u8`, atau HLS) di mana URL file langsung (seperti `.mp3` atau `.mp4`) tidak tersedia.

## ✨ Fitur Utama

- **Dukungan Stream:** Menggunakan `captureStream()` dan `MediaRecorder` API untuk merekam keluaran suara/video secara langsung dari peramban.
- **Otomatis Mengunduh:** File rekaman akan otomatis diunduh saat pemutaran media selesai (ended) atau saat Anda menekan tombol jeda (pause).
- **Berlaku Global:** Secara bawaan (*default*), skrip ini berjalan di semua situs web.

## ⚙️ Cara Kerja

1. Saat Anda menekan **Play** pada sebuah audio atau video di situs web, skrip akan mendeteksinya dan mulai merekam aliran datanya (*stream*).
2. Perekaman berjalan secara **waktu nyata (real-time)**. Artinya, jika audio berdurasi 5 menit, Anda harus memutarnya selama 5 menit.
3. Saat Anda menekan **Pause** (jeda) atau audio selesai berputar, skrip akan langsung membungkus hasil rekaman dan mengunduhnya ke perangkat Anda.

> **⚠️ PERHATIAN MENGENAI PAUSE:** 
> Jika Anda memutar audio berdurasi 5 menit dan menekan *pause* di menit ke-2, maka file yang terunduh hanya berisi rekaman dari menit 0 hingga menit 2. Jika Anda menekan *play* lagi setelahnya, skrip akan membuat sesi rekaman **baru**.

## 🛠️ Cara Instalasi

1. Pastikan Anda sudah menginstal ekstensi [Tampermonkey](https://www.tampermonkey.net/) di browser Anda (Chrome, Firefox, Edge, dll).
2. Buka *dashboard* Tampermonkey dan klik **Create a new script...** (Buat skrip baru).
3. Hapus semua teks bawaan di dalam editor.
4. Salin (copy) kode di bawah ini dan tempelkan (paste) ke editor tersebut.
5. Simpan skrip dengan menekan `Ctrl + S` atau pilih menu **File > Save**.

## 📝 Kode Skrip (Userscript)

```javascript
// ==UserScript==
// @name         Auto Record Playing Media (Stream Support)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Merekam audio/video (termasuk stream) yang sedang diputar lalu mengunduhnya saat dijeda/selesai
// @author       Anda
// @match        *://*/*
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    document.addEventListener('play', function(event) {
        const media = event.target;

        if ((media.tagName === 'AUDIO' || media.tagName === 'VIDEO') && media.dataset.isRecording !== 'true') {

            try {
                const stream = media.captureStream ? media.captureStream() : (media.mozCaptureStream ? media.mozCaptureStream() : null);

                if (!stream) {
                    console.warn('[AutoRecord] Peramban tidak mendukung captureStream pada elemen ini.');
                    return;
                }

                media.dataset.isRecording = 'true';

                const isAudioOnly = media.tagName === 'AUDIO' || stream.getVideoTracks().length === 0;
                const mimeType = isAudioOnly ? 'audio/webm' : 'video/webm';
                const fileExt = isAudioOnly ? '.webm' : '.webm';

                const recorder = new MediaRecorder(stream);
                const chunks = [];

                recorder.ondataavailable = function(e) {
                    if (e.data && e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                recorder.onstop = function() {
                    media.dataset.isRecording = 'false';

                    if (chunks.length === 0) return;

                    const blob = new Blob(chunks, { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const filename = `Rekaman_${isAudioOnly ? 'Audio' : 'Video'}_${Date.now()}${fileExt}`;

                    console.log('[AutoRecord] Menyimpan rekaman:', filename);

                    GM_download({
                        url: url,
                        name: filename,
                        onload: () => URL.revokeObjectURL(url),
                        onerror: (err) => {
                            console.error('[AutoRecord] Gagal mengunduh:', err);
                            URL.revokeObjectURL(url);
                        }
                    });
                };

                recorder.start();
                console.log('[AutoRecord] Mulai merekam media...');

                const stopRecording = function() {
                    if (recorder.state !== 'inactive') {
                        recorder.stop();
                    }
                    media.removeEventListener('pause', stopRecording);
                    media.removeEventListener('ended', stopRecording);
                };

                media.addEventListener('pause', stopRecording);
                media.addEventListener('ended', stopRecording);

            } catch (err) {
                console.error('[AutoRecord] Gagal merekam media (kemungkinan kendala CORS):', err);
                media.dataset.isRecording = 'false';
            }
        }
    }, true);
})();
```

## 📌 Catatan Tambahan (Batasan)

- **Format Output:** Peramban pada umumnya akan menyimpan file ini dalam format `.webm` atau `.ogg`. Anda bisa memutar file tersebut menggunakan [VLC Media Player](https://www.videolan.org/) atau langsung dengan menyeretnya ke dalam browser Anda. Anda mungkin perlu menggunakan alat *converter* pihak ketiga jika membutuhkan format `.mp3`.
- **Keamanan CORS (Cross-Origin):** Skrip ini mungkin gagal (error) pada beberapa situs (seperti YouTube, Netflix, atau Spotify) karena server dari situs tersebut menggunakan proteksi tingkat tinggi yang mencegah eksekusi `captureStream()` demi melindungi hak cipta konten. Anda bisa mengecek error pada *Console* (F12) jika fitur tidak berfungsi.
