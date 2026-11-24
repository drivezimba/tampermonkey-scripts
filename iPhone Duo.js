// ==UserScript==
// @name         Apple iPhone Duo (Foldable) - Ultimate Edition
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Simulator Apple iPhone Duo dengan animasi lipat 3D, transisi kamera/Dynamic Island, rotasi tombol fisik akurat, sinkronisasi URL, blacklist, dan shortcut keyboard
// @author       You
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 1. Cegah skrip berjalan di dalam iframe
    if (window.self !== window.top) return;

    // 2. Cek mode bypass (keluar sementara untuk tab ini) atau parameter ?noduo=1
    const BYPASS_KEY = '__iphone_duo_bypass__';
    if (sessionStorage.getItem(BYPASS_KEY) === '1' || new URLSearchParams(window.location.search).has('noduo')) {
        return;
    }

    // 3. Daftar situs yang otomatis dilewati (sering memblokir iframe atau tidak cocok dibingkai)
    const EXCLUDED_DOMAINS = [
        'accounts.google.com',
        'mail.google.com',
        'drive.google.com',
        'github.com',
        'youtube.com',
        'instagram.com',
        'facebook.com',
        'x.com',
        'twitter.com',
        'web.whatsapp.com',
        'web.telegram.org'
    ];

    const hostname = window.location.hostname.toLowerCase();
    if (EXCLUDED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
        return;
    }

    // 4. Pengaturan Awal
    const START_UNFOLDED = true;       // true = 7,6" (890x626) | false = 5,4" (466x678)
    const DEFAULT_COLOR = 'night-sky'; // 'night-sky' atau 'star-white'

    const currentUrl = window.location.href;
    window.stop();

    const THEMES = {
        'night-sky': {
            name: 'Night Sky Titanium',
            frame: '#1d2738',
            frameRim: '#485d7d',
            antenna: 'rgba(130, 155, 195, 0.28)',
            hinge: 'linear-gradient(90deg, #121824, #3d506e 45%, #566f94 52%, #182130)',
            hingeVert: 'linear-gradient(180deg, #121824, #3d506e 45%, #566f94 52%, #182130)',
            btn: 'linear-gradient(180deg, #475d7d, #1f2a3d)',
            bg: '#0c1017',
            dot: '#1f2838'
        },
        'star-white': {
            name: 'Star White Titanium',
            frame: '#d6d9df',
            frameRim: '#f7f8fa',
            antenna: 'rgba(120, 125, 135, 0.35)',
            hinge: 'linear-gradient(90deg, #aeb3bc, #f2f4f7 45%, #ffffff 52%, #b5bac4)',
            hingeVert: 'linear-gradient(180deg, #aeb3bc, #f2f4f7 45%, #ffffff 52%, #b5bac4)',
            btn: 'linear-gradient(180deg, #f2f4f7, #b8bec8)',
            bg: '#121316',
            dot: '#282b33'
        }
    };

    const VIEWPORTS = {
        folded: {
            width: 466,
            height: 678,
            bezelRadius: '48px',
            screenRadius: '38px',
            padding: '12px'
        },
        unfolded: {
            width: 890,
            height: 626,
            bezelRadius: '36px',
            screenRadius: '26px',
            padding: '10px'
        }
    };

    // Pulihkan state terakhir di tab ini jika ada
    let isUnfolded = sessionStorage.getItem('__duo_unfolded__') !== null
        ? sessionStorage.getItem('__duo_unfolded__') === '1'
        : START_UNFOLDED;
    let isRotated = sessionStorage.getItem('__duo_rotated__') === '1';
    let activeColor = sessionStorage.getItem('__duo_color__') || DEFAULT_COLOR;
    if (!THEMES[activeColor]) activeColor = DEFAULT_COLOR;

    let currentScale = 1;
    let manualZoom = false;
    let foldTimer = null;
    let toastTimer = null;

    function buildSimulator() {
        const root = document.documentElement;
        while (root.firstChild) root.removeChild(root.firstChild);

        const head = document.createElement('head');
        const metaCharset = document.createElement('meta');
        metaCharset.setAttribute('charset', 'utf-8');

        const metaViewport = document.createElement('meta');
        metaViewport.name = 'viewport';
        metaViewport.content = 'width=device-width, initial-scale=1';

        const title = document.createElement('title');
        title.textContent = `iPhone Duo - ${hostname}`;

        const style = document.createElement('style');
        style.textContent = `
            :root {
                --frame: ${THEMES[activeColor].frame};
                --frame-rim: ${THEMES[activeColor].frameRim};
                --antenna: ${THEMES[activeColor].antenna};
                --hinge: ${THEMES[activeColor].hinge};
                --hinge-vert: ${THEMES[activeColor].hingeVert};
                --btn: ${THEMES[activeColor].btn};
                --bg: ${THEMES[activeColor].bg};
                --dot: ${THEMES[activeColor].dot};
                --ease-spring: cubic-bezier(0.22, 1, 0.36, 1);
            }

            * { box-sizing: border-box; margin: 0; padding: 0; }

            html, body {
                background-color: var(--bg);
                background-image: radial-gradient(var(--dot) 1px, transparent 1px);
                background-size: 20px 20px;
                height: 100vh;
                width: 100vw;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
                perspective: 1800px;
                transition: background-color 0.4s ease;
                user-select: none;
            }

            #duo-wrapper {
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                transform-style: preserve-3d;
                transition: transform 0.38s var(--ease-spring);
            }

            /* Rangka Titanium iPhone Duo */
            #duo-body {
                position: relative;
                background: #06070a;
                padding: 12px;
                border: 4.5px solid var(--frame);
                box-shadow:
                    0 0 0 1px var(--frame-rim),
                    0 32px 75px rgba(0, 0, 0, 0.82),
                    0 10px 25px rgba(0, 0, 0, 0.55),
                    inset 0 0 4px 1px rgba(255, 255, 255, 0.16);
                display: flex;
                align-items: center;
                justify-content: center;
                transform-style: preserve-3d;
                transition:
                    border-radius 0.55s var(--ease-spring),
                    padding 0.55s var(--ease-spring),
                    border-color 0.4s ease,
                    box-shadow 0.45s ease,
                    transform 0.55s var(--ease-spring);
            }

            /* Animasi Lipat 3D (Efek tekukan engsel & bayangan dinamis) */
            #duo-body.anim-folding {
                transform: rotateY(-14deg) scaleX(0.94);
                box-shadow:
                    0 0 0 1px var(--frame-rim),
                    -20px 36px 85px rgba(0, 0, 0, 0.9),
                    inset 0 0 8px 2px rgba(255, 255, 255, 0.22);
            }
            #duo-body.anim-unfolding {
                transform: rotateY(10deg) scaleX(1.02);
                box-shadow:
                    0 0 0 1px var(--frame-rim),
                    14px 36px 85px rgba(0, 0, 0, 0.85),
                    inset 0 0 8px 2px rgba(255, 255, 255, 0.2);
            }
            #duo-body.rotated.anim-folding {
                transform: rotateX(14deg) scaleY(0.94);
            }
            #duo-body.rotated.anim-unfolding {
                transform: rotateX(-10deg) scaleY(1.02);
            }

            /* Garis Antena Titanium */
            .antenna {
                position: absolute;
                background: var(--antenna);
                pointer-events: none;
                z-index: 2;
            }
            .ant-tl { top: 64px; left: -5px; width: 5px; height: 4px; }
            .ant-tr { top: 64px; right: -5px; width: 5px; height: 4px; }
            .ant-bl { bottom: 64px; left: -5px; width: 5px; height: 4px; }
            .ant-br { bottom: 64px; right: -5px; width: 5px; height: 4px; }

            /* Punggung Engsel Titanium (Mode Terlipat) */
            #duo-spine {
                position: absolute;
                left: -11px;
                top: 28px;
                bottom: 28px;
                width: 8px;
                background: var(--hinge);
                border-radius: 7px 0 0 7px;
                box-shadow: -3px 0 10px rgba(0, 0, 0, 0.55);
                cursor: pointer;
                transition: all 0.45s var(--ease-spring);
            }
            #duo-body.rotated:not(.unfolded) #duo-spine {
                left: 28px;
                right: 28px;
                top: -11px;
                bottom: auto;
                width: auto;
                height: 8px;
                background: var(--hinge-vert);
                border-radius: 7px 7px 0 0;
                box-shadow: 0 -3px 10px rgba(0, 0, 0, 0.55);
            }

            /* Penutup Engsel Atas & Bawah (Mode Terbuka) */
            .hinge-cap {
                position: absolute;
                left: 50%;
                transform: translateX(-50%);
                width: 28px;
                height: 5px;
                background: var(--hinge);
                border-radius: 3px;
                cursor: pointer;
                opacity: 0;
                pointer-events: none;
                transition: all 0.45s var(--ease-spring);
            }
            #hinge-top { top: -7px; }
            #hinge-bottom { bottom: -7px; }

            #duo-body.unfolded #duo-spine {
                opacity: 0;
                transform: scaleY(0.7);
                pointer-events: none;
            }
            #duo-body.unfolded .hinge-cap {
                opacity: 1;
                pointer-events: auto;
            }
            #duo-body.unfolded.rotated #hinge-top {
                top: 50%; left: -7px; transform: translateY(-50%);
                width: 5px; height: 28px;
                background: var(--hinge-vert);
            }
            #duo-body.unfolded.rotated #hinge-bottom {
                bottom: auto; top: 50%; left: auto; right: -7px; transform: translateY(-50%);
                width: 5px; height: 28px;
                background: var(--hinge-vert);
            }

            /* Layar Super Retina XDR */
            #duo-screen {
                position: relative;
                background: #ffffff;
                overflow: hidden;
                transition:
                    width 0.55s var(--ease-spring),
                    height 0.55s var(--ease-spring),
                    border-radius 0.55s var(--ease-spring);
            }

            #duo-frame {
                width: 100%;
                height: 100%;
                border: none;
                display: block;
                background: #ffffff;
            }

            /* Efek Lipatan Nano-Texture & Kilau Kaca saat Transisi Lipat */
            #duo-crease {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 18px;
                background: linear-gradient(
                    90deg,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, 0.055) 42%,
                    rgba(255, 255, 255, 0.08) 54%,
                    rgba(0, 0, 0, 0) 100%
                );
                pointer-events: none;
                z-index: 9;
                opacity: 0;
                transition: opacity 0.45s ease, width 0.45s ease;
            }
            #duo-body.unfolded #duo-crease { opacity: 1; }
            #duo-body.anim-folding #duo-crease,
            #duo-body.anim-unfolding #duo-crease {
                opacity: 1;
                width: 48px;
                background: linear-gradient(
                    90deg,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, 0.28) 45%,
                    rgba(255, 255, 255, 0.22) 55%,
                    rgba(0, 0, 0, 0) 100%
                );
            }
            #duo-body.unfolded.rotated #duo-crease {
                top: 50%; left: 0; right: 0; bottom: auto;
                width: 100%; height: 18px;
                transform: translateY(-50%);
                background: linear-gradient(
                    180deg,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, 0.055) 42%,
                    rgba(255, 255, 255, 0.08) 54%,
                    rgba(0, 0, 0, 0) 100%
                );
            }
            #duo-body.rotated.anim-folding #duo-crease,
            #duo-body.rotated.anim-unfolding #duo-crease {
                height: 48px;
                width: 100%;
                background: linear-gradient(
                    180deg,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, 0.28) 45%,
                    rgba(255, 255, 255, 0.22) 55%,
                    rgba(0, 0, 0, 0) 100%
                );
            }

            /* Kilau Kaca Refleksi saat Membuka/Melipat */
            #duo-glare {
                position: absolute;
                inset: 0;
                background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.16) 50%, transparent 70%);
                transform: translateX(-120%);
                pointer-events: none;
                z-index: 11;
            }
            #duo-body.anim-folding #duo-glare,
            #duo-body.anim-unfolding #duo-glare {
                animation: glareSweep 0.55s var(--ease-spring);
            }
            @keyframes glareSweep {
                from { transform: translateX(-120%); }
                to   { transform: translateX(120%); }
            }

            /* Dynamic Island & Kamera (Animasi Morphing antara Layar Luar & Layar Dalam) */
            #duo-island {
                position: absolute;
                top: 12px;
                left: 50%;
                transform: translateX(-50%);
                width: 96px;
                height: 27px;
                background: #000000;
                border-radius: 14px;
                z-index: 10;
                pointer-events: none;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 9px;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
                transition:
                    width 0.5s var(--ease-spring),
                    height 0.5s var(--ease-spring),
                    top 0.5s var(--ease-spring),
                    left 0.5s var(--ease-spring),
                    opacity 0.45s ease,
                    transform 0.5s var(--ease-spring);
            }
            #duo-sensor {
                width: 14px;
                height: 7px;
                border-radius: 4px;
                background: #0b0d14;
                transition: opacity 0.4s ease, transform 0.4s ease;
            }
            #duo-lens {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: radial-gradient(circle at 35% 35%, #375180 0%, #101829 50%, #000 100%);
                border: 1px solid #1e222b;
                box-shadow: inset 0 0 2px rgba(120, 170, 255, 0.45);
                transition: transform 0.45s var(--ease-spring), opacity 0.4s ease;
            }

            /* Saat Terbuka: Dynamic Island mengecil & kamera bawah layar lebih samar */
            #duo-body.unfolded #duo-island {
                width: 72px;
                height: 21px;
                top: 10px;
                opacity: 0.78;
            }
            #duo-body.unfolded #duo-sensor {
                opacity: 0.25;
                transform: scale(0.7);
            }
            #duo-body.unfolded #duo-lens {
                transform: scale(0.82);
                opacity: 0.75;
            }

            /* Saat Rotasi Lanskap (Terlipat): Dynamic Island pindah ke sisi kiri tengah */
            #duo-body.rotated:not(.unfolded) #duo-island {
                top: 50%;
                left: 12px;
                transform: translateY(-50%);
                width: 27px;
                height: 96px;
                flex-direction: column;
                padding: 9px 0;
            }

            /* Home Indicator iOS */
            #duo-home-bar {
                position: absolute;
                bottom: 8px;
                left: 50%;
                transform: translateX(-50%);
                width: 148px;
                height: 5px;
                background: rgba(120, 120, 128, 0.48);
                border-radius: 3px;
                z-index: 10;
                pointer-events: none;
                transition: width 0.5s var(--ease-spring);
            }
            #duo-body.unfolded #duo-home-bar { width: 230px; }
            #duo-body.rotated:not(.unfolded) #duo-home-bar { width: 210px; }

            /* Tombol Fisik Titanium */
            .hw-btn {
                position: absolute;
                background: var(--btn);
                cursor: pointer;
                transition: filter 0.15s, transform 0.12s, all 0.45s var(--ease-spring);
                z-index: 3;
            }
            .hw-btn:hover { filter: brightness(1.4); }
            .hw-btn:active { filter: brightness(0.85); }

            /* Posisi Default (Potret / Unfolded Normal) */
            #btn-vol-up   { top: -8px; right: 112px; width: 46px; height: 4.5px; border-radius: 3px 3px 0 0; }
            #btn-vol-down { top: -8px; right: 56px;  width: 46px; height: 4.5px; border-radius: 3px 3px 0 0; }
            #btn-touchid  { right: -8px; top: 145px; width: 4.5px; height: 74px; border-radius: 0 3px 3px 0; }
            #btn-camera   { right: -7px; bottom: 125px; width: 3.5px; height: 58px; border-radius: 0 2px 2px 0; opacity: 0.88; }

            /* Posisi Tombol Fisik saat Rotasi (Ikut berputar 90 derajat secara akurat) */
            #duo-body.rotated #btn-vol-up {
                top: auto; right: -8px; bottom: 112px;
                width: 4.5px; height: 46px; border-radius: 0 3px 3px 0;
            }
            #duo-body.rotated #btn-vol-down {
                top: auto; right: -8px; bottom: 56px;
                width: 4.5px; height: 46px; border-radius: 0 3px 3px 0;
            }
            #duo-body.rotated #btn-touchid {
                top: auto; right: auto; bottom: -8px; left: 145px;
                width: 74px; height: 4.5px; border-radius: 0 0 3px 3px;
            }
            #duo-body.rotated #btn-camera {
                top: auto; right: 125px; bottom: -7px; left: auto;
                width: 58px; height: 3.5px; border-radius: 0 0 2px 2px;
            }

            /* Notifikasi Pill Halus (Hanya muncul sebentar saat tombol/shortcut ditekan) */
            #duo-toast {
                position: fixed;
                bottom: 22px;
                left: 50%;
                transform: translateX(-50%) translateY(14px);
                background: rgba(18, 22, 30, 0.88);
                color: #f1f5f9;
                border: 1px solid rgba(255, 255, 255, 0.14);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                padding: 7px 16px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 500;
                letter-spacing: 0.2px;
                opacity: 0;
                pointer-events: none;
                z-index: 9999;
                transition: opacity 0.25s ease, transform 0.3s var(--ease-spring);
            }
            #duo-toast.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        `;

        head.append(metaCharset, metaViewport, title, style);

        const body = document.createElement('body');
        const wrapper = document.createElement('div');
        wrapper.id = 'duo-wrapper';

        const bodyFrame = document.createElement('div');
        bodyFrame.id = 'duo-body';

        const makeEl = (id, className, tip) => {
            const el = document.createElement('div');
            if (id) el.id = id;
            if (className) el.className = className;
            if (tip) el.title = tip;
            return el;
        };

        // Garis antena titanium
        ['ant-tl', 'ant-tr', 'ant-bl', 'ant-br'].forEach(cls => {
            bodyFrame.appendChild(makeEl('', `antenna ${cls}`));
        });

        // Engsel titanium (klik untuk refresh)
        const spine = makeEl('duo-spine', '', 'Engsel Titanium: Refresh halaman');
        const hingeTop = makeEl('hinge-top', 'hinge-cap', 'Engsel Titanium: Refresh halaman');
        const hingeBottom = makeEl('hinge-bottom', 'hinge-cap', 'Engsel Titanium: Refresh halaman');

        // 4 Tombol fisik
        const btnVolUp = makeEl('btn-vol-up', 'hw-btn', 'Volume + : Perbesar (Alt + =)');
        const btnVolDown = makeEl('btn-vol-down', 'hw-btn', 'Volume - : Perkecil (Alt + -)');
        const btnTouchId = makeEl('btn-touchid', 'hw-btn', 'Touch ID : Buka / Lipat (Alt + F)');
        const btnCamera = makeEl('btn-camera', 'hw-btn', 'Camera Control : Putar Layar (Alt + R)');

        const screen = makeEl('duo-screen');
        const island = makeEl('duo-island');
        island.append(makeEl('duo-sensor'), makeEl('duo-lens'));

        const crease = makeEl('duo-crease');
        const glare = makeEl('duo-glare');

        const iframe = document.createElement('iframe');
        iframe.id = 'duo-frame';
        iframe.src = currentUrl;

        const homeBar = makeEl('duo-home-bar');
        const toast = makeEl('duo-toast');

        screen.append(island, crease, glare, iframe, homeBar);
        bodyFrame.append(
            spine, hingeTop, hingeBottom,
            btnVolUp, btnVolDown, btnTouchId, btnCamera,
            screen
        );
        wrapper.appendChild(bodyFrame);
        body.append(wrapper, toast);
        root.append(head, body);

        function showToast(msg) {
            toast.textContent = msg;
            toast.classList.add('show');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => toast.classList.remove('show'), 1700);
        }

        function applyTheme(colorKey) {
            const t = THEMES[colorKey];
            const s = document.documentElement.style;
            s.setProperty('--frame', t.frame);
            s.setProperty('--frame-rim', t.frameRim);
            s.setProperty('--antenna', t.antenna);
            s.setProperty('--hinge', t.hinge);
            s.setProperty('--hinge-vert', t.hingeVert);
            s.setProperty('--btn', t.btn);
            s.setProperty('--bg', t.bg);
            s.setProperty('--dot', t.dot);
            sessionStorage.setItem('__duo_color__', colorKey);
        }

        function autoFitScale(w, h) {
            const vp = isUnfolded ? VIEWPORTS.unfolded : VIEWPORTS.folded;
            const curW = w || (isRotated ? vp.height : vp.width);
            const curH = h || (isRotated ? vp.width : vp.height);
            const scaleX = window.innerWidth / (curW + 64);
            const scaleY = window.innerHeight / (curH + 64);
            currentScale = Math.min(scaleX, scaleY, 1);
            wrapper.style.transform = `scale(${currentScale})`;
        }

        function applyLayout(animateFold = false) {
            const vp = isUnfolded ? VIEWPORTS.unfolded : VIEWPORTS.folded;
            const w = isRotated ? vp.height : vp.width;
            const h = isRotated ? vp.width : vp.height;

            if (animateFold) {
                bodyFrame.classList.remove('anim-folding', 'anim-unfolding');
                void bodyFrame.offsetWidth; // trigger reflow animasi
                bodyFrame.classList.add(isUnfolded ? 'anim-unfolding' : 'anim-folding');
                clearTimeout(foldTimer);
                foldTimer = setTimeout(() => {
                    bodyFrame.classList.remove('anim-folding', 'anim-unfolding');
                }, 560);
            }

            bodyFrame.classList.toggle('unfolded', isUnfolded);
            bodyFrame.classList.toggle('rotated', isRotated);
            bodyFrame.style.borderRadius = vp.bezelRadius;
            bodyFrame.style.padding = vp.padding;

            screen.style.width = `${w}px`;
            screen.style.height = `${h}px`;
            screen.style.borderRadius = vp.screenRadius;

            sessionStorage.setItem('__duo_unfolded__', isUnfolded ? '1' : '0');
            sessionStorage.setItem('__duo_rotated__', isRotated ? '1' : '0');

            if (!manualZoom) autoFitScale(w, h);
        }

        // Sinkronisasi Judul & URL Address Bar saat navigasi di dalam iframe (same-origin)
        iframe.addEventListener('load', () => {
            try {
                const win = iframe.contentWindow;
                const doc = iframe.contentDocument;
                if (doc && doc.title) {
                    document.title = doc.title;
                }
                if (win && win.location && win.location.href && win.location.href !== 'about:blank') {
                    if (win.location.href !== window.location.href) {
                        window.history.replaceState(null, '', win.location.href);
                    }
                }
            } catch (_) {
                // Cross-origin: abaikan dengan aman
            }
        });

        // Aksi-aksi utama
        function toggleFold() {
            isUnfolded = !isUnfolded;
            isRotated = false;
            manualZoom = false;
            applyLayout(true);
            showToast(isUnfolded ? 'Layar Dalam 7,6″ (Terbuka)' : 'Layar Luar 5,4″ (Terlipat)');
        }

        function toggleRotate() {
            isRotated = !isRotated;
            manualZoom = false;
            applyLayout(false);
            showToast(isRotated ? 'Orientasi Diputar' : 'Orientasi Normal');
        }

        function zoomBy(delta) {
            manualZoom = true;
            currentScale = Math.min(Math.max(currentScale + delta, 0.4), 1.6);
            wrapper.style.transform = `scale(${currentScale})`;
            showToast(`Zoom ${Math.round(currentScale * 100)}%`);
        }

        function resetZoom() {
            manualZoom = false;
            autoFitScale();
            showToast('Zoom Auto-Fit');
        }

        function toggleTheme() {
            activeColor = activeColor === 'night-sky' ? 'star-white' : 'night-sky';
            applyTheme(activeColor);
            showToast(`Warna: ${THEMES[activeColor].name}`);
        }

        function exitToNormalWeb() {
            sessionStorage.setItem(BYPASS_KEY, '1');
            window.location.reload();
        }

        function refreshFrame() {
            try {
                iframe.contentWindow.location.reload();
            } catch (_) {
                iframe.src = iframe.src;
            }
            showToast('Memuat ulang halaman…');
        }

        // Inisialisasi
        applyTheme(activeColor);
        applyLayout(false);

        window.addEventListener('resize', () => {
            if (!manualZoom) autoFitScale();
        });

        // Binding tombol fisik
        btnTouchId.onclick = toggleFold;
        btnCamera.onclick = toggleRotate;
        btnVolUp.onclick = () => zoomBy(0.1);
        btnVolDown.onclick = () => zoomBy(-0.1);
        spine.onclick = refreshFrame;
        hingeTop.onclick = refreshFrame;
        hingeBottom.onclick = refreshFrame;

        // Klik ganda di area latar gelap di luar HP = keluar cepat ke mode web normal
        body.addEventListener('dblclick', (e) => {
            if (e.target === body) exitToNormalWeb();
        });

        // Shortcut Keyboard
        window.addEventListener('keydown', (e) => {
            if (!e.altKey) return;
            const key = e.key.toLowerCase();
            if (key === 'f') { e.preventDefault(); toggleFold(); }
            else if (key === 'r') { e.preventDefault(); toggleRotate(); }
            else if (key === 't') { e.preventDefault(); toggleTheme(); }
            else if (key === '=' || key === '+') { e.preventDefault(); zoomBy(0.1); }
            else if (key === '-') { e.preventDefault(); zoomBy(-0.1); }
            else if (key === '0') { e.preventDefault(); resetZoom(); }
            else if (key === 'x') { e.preventDefault(); exitToNormalWeb(); }
        });
    }

    if (document.documentElement) {
        buildSimulator();
    } else {
        document.addEventListener('DOMContentLoaded', buildSimulator, { once: true });
    }
})();
