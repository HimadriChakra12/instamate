// ==UserScript==
// @name         Instamate
// @namespace    https://github.com/HimadriChakra12/Instamate
// @version      4.11.10
// @description  A combination of multiple instagram userscripts
// @match        https://*.instagram.com/*
// @match        https://*.instagram.com/direct/t/*
// @grant        unsafeWindow
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @anonstoryview https://update.greasyfork.org/scripts/468385/Instagram%20Anonymous%20Story%20Viewer.user.js
// @reelsramsaver https://update.greasyfork.org/scripts/562931/Instagram%20Reels%20RAM%20Saver.user.js
// @shared-media Generated
// @msgname      Generated
// @float        Generated
// @run-at       document-start
// ==/UserScript==

// ---- start.js ----
(() => {
  'use strict';

// ---- core/settings.js ----

    function im_injectStyleAsap(id, css) {
        function inject() {
            if (document.getElementById(id)) return;
            const style = document.createElement('style');
            style.id = id;
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        }

        if (document.head || document.documentElement) {
            inject();
            return;
        }

        const observer = new MutationObserver(() => {
            if (document.head || document.documentElement) {
                observer.disconnect();
                inject();
            }
        });
        observer.observe(document, { childList: true, subtree: true });
    }

    const IM_STORAGE_PREFIX = 'instamate.opt.';

    function im_gmAvailable() {
        return typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
    }

    function im_readEnabled(key) {
        try {
            if (im_gmAvailable()) {
                return GM_getValue(IM_STORAGE_PREFIX + key, true) !== false;
            }
            const raw = localStorage.getItem(IM_STORAGE_PREFIX + key);
            return raw === null ? true : raw === 'true';
        } catch {
            return true;
        }
    }

    function im_writeEnabled(key, value) {
        try {
            if (im_gmAvailable()) {
                GM_setValue(IM_STORAGE_PREFIX + key, !!value);
            } else {
                localStorage.setItem(IM_STORAGE_PREFIX + key, value ? 'true' : 'false');
            }
        } catch {
        }
    }

    const IM_OPTS = [
        {
            key: 'anonstoryview',
            label: 'Anonymous Story Viewer',
            description: "Stops Instagram from recording that you viewed someone's story.",
        },
        {
            key: 'msgname',
            label: 'DM Tab Title',
            description: "Shows who you're messaging in the browser tab title instead of just \"Instagram\".",
        },
        {
            key: 'float',
            label: 'Float',
            description: 'Get floating windowed chats',
        },
    ];

    const IM_ADDONS = [
        {
            key: 'reelsramsaver',
            label: 'Reels RAM Saver',
            description: 'Unloads off-screen Reels videos so long scrolling sessions stay light on memory.',
        },
        {
            key: 'instasnap',
            label: 'InstaSnap',
            description: 'Disables animations, trims video preload, pauses offscreen video, and hides sponsored posts \u2014 without the layout-breaking risk of CSS content-visibility tricks.',
        },
        {
            key: 'search',
            label: 'Search (Ctrl/Cmd+K)',
            description: 'Discord-style search overlay (Ctrl/Cmd+K) with bangs: @accounts, #groups, !dms, or bare for following + messages in the open chat.',
        },
        {
            key: 'security',
            label: 'Security / Anti-Telemetry',
            description: 'Blocks Instagram\u2019s telemetry beacons, known analytics/tracking endpoints, and strips click-id tracking params from the URL.',
        },
    ];

    const IM = {
        opts: IM_OPTS,
        addons: IM_ADDONS,

        isEnabled(key) {
            return im_readEnabled(key);
        },

        setEnabled(key, value) {
            im_writeEnabled(key, value);
        },
    };

    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.__instamate__ = IM;
    }

// ---- core/ui.js ----

    const IM_UI_CSS = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

        .im-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,.65);
            z-index: 2147483001;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .im-hidden { display: none !important; }

        .im-panel {
            width: 360px;
            max-width: 92vw;
            max-height: 82vh;
            overflow-y: auto;
            background: #fff;
            color: #262626;
            border-radius: 14px;
            box-shadow: 0 8px 40px rgba(0,0,0,.45);
        }
        @media (prefers-color-scheme: dark) {
            .im-panel { background: #262626; color: #f5f5f5; }
            .im-row-desc { color: #a8a8a8 !important; }
            .im-section-title { color: #a8a8a8 !important; }
            .im-header, .im-row, .im-footer { border-color: #363636 !important; }
            .im-badge { background: #3a3a3a !important; color: #d0d0d0 !important; }
        }

        .im-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 18px;
            border-bottom: 1px solid #dbdbdb;
        }
        .im-title { font-size: 16px; font-weight: 700; }
        .im-subtitle { font-size: 12px; color: #8e8e8e; margin-top: 2px; }
        .im-close {
            border: none; background: transparent; cursor: pointer;
            font-size: 20px; line-height: 1; color: inherit; opacity: .6; padding: 4px;
        }
        .im-close:hover { opacity: 1; }

        .im-section-title {
            font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
            color: #8e8e8e; padding: 14px 18px 6px;
        }

        .im-row {
            display: flex; align-items: center; gap: 12px;
            padding: 10px 18px;
            border-top: 1px solid #efefef;
        }
        .im-row-text { flex: 1; min-width: 0; }
        .im-row-label { font-size: 14px; font-weight: 600; }
        .im-row-desc { font-size: 12px; color: #737373; margin-top: 2px; line-height: 1.35; }

        .im-badge {
            font-size: 11px; font-weight: 600; color: #00a400; background: #e7f7e7;
            padding: 4px 8px; border-radius: 10px; white-space: nowrap;
        }

        .im-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
        .im-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .im-slider {
            position: absolute; inset: 0; background: #ccc; border-radius: 22px; cursor: pointer;
            transition: background .15s ease;
        }
        .im-slider::before {
            content: ""; position: absolute; width: 18px; height: 18px; left: 2px; top: 2px;
            background: #fff; border-radius: 50%; transition: transform .15s ease;
        }
        .im-switch input:checked + .im-slider { background: #0095F6; }
        .im-switch input:checked + .im-slider::before { transform: translateX(18px); }

        .im-footer {
            padding: 12px 18px 16px;
            border-top: 1px solid #dbdbdb;
            display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .im-footer-note { font-size: 11px; color: #8e8e8e; }
        .im-reload-btn {
            border: none; background: #0095F6; color: #fff; font-size: 13px; font-weight: 600;
            padding: 8px 14px; border-radius: 8px; cursor: pointer; white-space: nowrap;
        }
        .im-reload-btn:hover { background: #1877c9; }
    `;

    function im_row(item, { toggleable }) {
        const row = document.createElement('div');
        row.className = 'im-row';

        const text = document.createElement('div');
        text.className = 'im-row-text';
        const label = document.createElement('div');
        label.className = 'im-row-label';
        label.textContent = item.label;
        const desc = document.createElement('div');
        desc.className = 'im-row-desc';
        desc.textContent = item.description;
        text.append(label, desc);
        row.append(text);

        if (toggleable) {
            const wrap = document.createElement('label');
            wrap.className = 'im-switch';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = IM.isEnabled(item.key);
            const slider = document.createElement('span');
            slider.className = 'im-slider';
            wrap.append(input, slider);
            row.append(wrap);

            input.addEventListener('change', () => {
                IM.setEnabled(item.key, input.checked);
                im_showReloadPrompt();
            });
        } else {
            const badge = document.createElement('span');
            badge.className = 'im-badge';
            badge.textContent = 'Always on';
            row.append(badge);
        }

        return row;
    }

    let im_reloadBtn = null;

    function im_showReloadPrompt() {
        if (im_reloadBtn) im_reloadBtn.classList.remove('im-hidden');
    }


    function im_findInstagramHomeIcon() {
        const logoSvg = document.querySelector('a[href="/"] svg[aria-label="Instagram" i]');
        if (logoSvg) return logoSvg.closest('a[href="/"]');

        const byTitle = [...document.querySelectorAll('a[href="/"]')].find((a) =>
            a.querySelector('svg title')?.textContent?.trim().toLowerCase() === 'instagram'
        );
        if (byTitle) return byTitle;

        return (
            document.querySelector('a[aria-label="Instagram" i][href="/"]') ||
            document.querySelector('a[href="/"]')
        );
    }

    function im_tryMountSidebarItem(onClick) {
        const el = im_findInstagramHomeIcon();
        if (!el) return false;
        if (el.dataset.instamateHijacked) return true;

        el.dataset.instamateHijacked = '1';
        el.setAttribute('aria-label', 'Instamate settings');
        el.title = 'Instamate settings';

        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }, { capture: true });

        return true;
    }

    function im_buildPanel() {
        const panel = document.createElement('div');
        panel.className = 'im-panel';

        const header = document.createElement('div');
        header.className = 'im-header';
        header.innerHTML = `
            <div>
                <div class="im-title">Instamate</div>
                <div class="im-subtitle">Settings</div>
            </div>
        `;
        const close = document.createElement('button');
        close.className = 'im-close';
        close.textContent = '\u00d7';
        close.setAttribute('aria-label', 'Close');
        header.append(close);
        panel.append(header);

        const optsTitle = document.createElement('div');
        optsTitle.className = 'im-section-title';
        optsTitle.textContent = 'Opts \u2014 toggle on or off';
        panel.append(optsTitle);
        IM.opts.forEach((opt) => panel.append(im_row(opt, { toggleable: true })));

        const addonsTitle = document.createElement('div');
        addonsTitle.className = 'im-section-title';
        addonsTitle.textContent = 'Addons \u2014 permanent';
        panel.append(addonsTitle);
        IM.addons.forEach((addon) => panel.append(im_row(addon, { toggleable: false })));

        const mediaTitle = document.createElement('div');
        mediaTitle.className = 'im-section-title';
        mediaTitle.textContent = 'Shared Media \u2014 this chat';
        const mediaNote = document.createElement('div');
        mediaNote.className = 'im-row-desc';
        mediaNote.style.padding = '0 18px 10px';
        const mediaGrid = document.createElement('div');
        mediaGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0 18px 10px;';
        const mediaClearCache = document.createElement('button');
        mediaClearCache.textContent = 'Clear cache';
        mediaClearCache.style.cssText = 'display:block;width:100%;margin:0 0 14px;padding:10px 18px;border:none;background:#ED4956;color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
        panel.append(mediaTitle, mediaNote, mediaGrid, mediaClearCache);

        function renderMediaItems() {
            const items = typeof im_collectSharedMedia === 'function' ? im_collectSharedMedia() : [];
            mediaGrid.innerHTML = '';
            mediaNote.textContent = items.length === 0
                ? 'Nothing cached yet -- media appears here as you scroll through the chat.'
                : `${items.length} item${items.length === 1 ? '' : 's'} cached.`;
            items.forEach((item) => {
                const thumb = document.createElement('a');
                thumb.href = item.src || item.poster;
                thumb.target = '_blank';
                thumb.rel = 'noopener noreferrer';
                thumb.style.cssText = 'display:block;aspect-ratio:1;border-radius:6px;overflow:hidden;background:rgba(0,0,0,.15);';
                const img = document.createElement('img');
                img.src = item.type === 'video' ? (item.poster || item.src) : item.src;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                thumb.append(img);
                mediaGrid.append(thumb);
            });
        }

        function refreshMedia() {
            const inThread = location.pathname.startsWith('/direct/t/');
            mediaTitle.classList.toggle('im-hidden', !inThread);
            mediaNote.classList.toggle('im-hidden', !inThread);
            mediaGrid.classList.toggle('im-hidden', !inThread);
            mediaClearCache.classList.toggle('im-hidden', !inThread);
            if (!inThread) return;
            renderMediaItems();
        }

        mediaClearCache.addEventListener('click', () => {
            if (typeof im_clearMediaCacheForCurrentThread === 'function') im_clearMediaCacheForCurrentThread();
            renderMediaItems();
        });


        const footer = document.createElement('div');
        footer.className = 'im-footer';
        const note = document.createElement('div');
        note.className = 'im-footer-note';
        note.textContent = 'Opt changes apply after a reload.';
        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'im-reload-btn im-hidden';
        reloadBtn.textContent = 'Reload now';
        reloadBtn.addEventListener('click', () => location.reload());
        im_reloadBtn = reloadBtn;
        footer.append(note, reloadBtn);
        panel.append(footer);

        return { panel, close, refreshMedia };
    }

    let im_openSettings = null;

    function im_mountUI() {
        if (!document.body) {
            requestAnimationFrame(im_mountUI);
            return;
        }

        let root = document.getElementById('instamate-ui-host')?.shadowRoot;

        if (!root) {
            const host = document.createElement('div');
            host.id = 'instamate-ui-host';
            document.body.appendChild(host);
            root = host.attachShadow({ mode: 'open' });

            const style = document.createElement('style');
            style.textContent = IM_UI_CSS;
            root.append(style);

            const backdrop = document.createElement('div');
            backdrop.className = 'im-backdrop im-hidden';
            root.append(backdrop);

            const { panel, close, refreshMedia } = im_buildPanel();
            backdrop.append(panel);

            const open = () => {
                refreshMedia();
                backdrop.classList.remove('im-hidden');
            };
            const shut = () => backdrop.classList.add('im-hidden');

            close.addEventListener('click', shut);
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) shut();
            });

            im_openSettings = open;
        }

        im_tryMountSidebarItem(() => im_openSettings && im_openSettings());
    }

    im_mountUI();
    const im_sidebarObserver = new MutationObserver(() => im_mountUI());
    im_sidebarObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('\u2699\ufe0f Settings', () => {
            if (!im_openSettings) im_mountUI();
            if (im_openSettings) im_openSettings();
        });
    }

// ---- opts/anonstoryview/script.js ----
    if (IM.isEnabled('anonstoryview')) {
    var originalXMLSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
        if (typeof arguments[0] === "string" && arguments[0].includes("viewSeenAt")) {
        } else {
            originalXMLSend.apply(this, arguments);
        }
    };
    }

// ---- opts/reelsramsaver/script.js ----
    if (IM.isEnabled('reelsramsaver')) {
    const CHECK_INTERVAL = 1500;
    const DISTANCE_THRESHOLD = 1000;
    
    function cleanUpReels() {
        if (!window.location.href.includes('/reels/')) {
            return;
        }
    
        const videos = document.querySelectorAll('video');
    
        videos.forEach(video => {
            const rect = video.getBoundingClientRect();
    
            if (rect.bottom < -DISTANCE_THRESHOLD) {
    
                if (video.src || video.querySelector('source')) {
    
                    console.log('Reels RAM Saver: Usuwanie starego Reelsa z pamięci...');
    
                    video.pause();
    
                    video.removeAttribute('src');
                    video.querySelectorAll('source').forEach(source => source.remove());
    
                    video.load();
    
                }
            }
        });
    }
    
    setInterval(cleanUpReels, CHECK_INTERVAL);
    }

// ---- opts/msgname/script.js ----
    if (IM.isEnabled('msgname')) {
        const USERNAME_SELECTOR =
            'div.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.x1xmf6yo.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft';
    
        const NICKNAME_SELECTOR = 'h2 span[title]';
    
        const COUNT_PREFIX = /^\((\d+)\)\s*/;
    
        let lastTitle = '';
    
        function getUsername() {
            const elements = document.querySelectorAll(USERNAME_SELECTOR);
    
            for (const element of elements) {
                const text = element.textContent.trim();
    
                if (text) {
                    return text;
                }
            }
    
            return null;
        }
    
        function getNickname() {
            const element = document.querySelector(NICKNAME_SELECTOR);
    
            if (!element) {
                return null;
            }
    
            return (
                element.getAttribute('title')?.trim() ||
                element.textContent.trim() ||
                null
            );
        }
    
        function getCurrentCount() {
            const match = document.title.match(COUNT_PREFIX);
            return match ? match[1] : null;
        }
    
        function updateTitle() {
            if (!location.pathname.startsWith('/direct/t/')) {
                return;
            }
    
            const nickname = getNickname();
            const username = getUsername();
    
            if (!nickname) {
                return;
            }
    
            let base;
    
            if (username) {
                base = `${nickname} - ${username}`;
            } else if (nickname === 'Instagram User') {
                base = nickname;
            } else {
                base = `${nickname} - Group`;
            }
    
            const count = getCurrentCount();
            const newTitle = count ? `(${count}) ${base}` : base;
    
            if (newTitle !== lastTitle) {
                lastTitle = newTitle;
                document.title = newTitle;
            } else if (document.title !== lastTitle) {
                document.title = lastTitle;
            }
        }
    
        function startObserver() {
            if (!document.documentElement) {
                requestAnimationFrame(startObserver);
                return;
            }
    
            const observer = new MutationObserver(updateTitle);
    
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['title']
            });
    
            updateTitle();
        }
    
        startObserver();
    
        let lastURL = location.href;
    
        setInterval(() => {
            if (location.href !== lastURL) {
                lastURL = location.href;
                lastTitle = '';
            }
    
            updateTitle();
        }, 250);
    }

// ---- addons/shared-media/script.js ----

    const IM_PROFILE_PIC_HINTS = /profile[\s-]?picture|avatar|story ring/i;
    const IM_POST_REEL_HREF = /instagram\.com\/(p|reel|reels|tv)\//i;

    function im_findThreadListContainer() {
        const threadLinks = [...document.querySelectorAll('a[href^="/direct/t/"]')];
        if (threadLinks.length < 2) return null;

        const hits = new Map();
        threadLinks.forEach((link) => {
            let node = link.parentElement;
            for (let i = 0; i < 6 && node; i++) {
                hits.set(node, (hits.get(node) || 0) + 1);
                node = node.parentElement;
            }
        });

        let best = null;
        let bestCount = 1;
        for (const [node, count] of hits) {
            if (count > bestCount) {
                bestCount = count;
                best = node;
            }
        }
        return best;
    }

    function im_hostnameCategory(src) {
        let host = '';
        try {
            host = new URL(src, location.href).hostname;
        } catch {
            return 'unknown';
        }
        if (/(^|\.)cdninstagram\.com$/i.test(host) || /^cdn\./i.test(host) || /static\./i.test(host)) return 'sticker';
        return 'unknown'; // scontent/fbcdn hosts serve both photos AND profile pictures -- can't tell from hostname alone
    }

    function im_isCircularAvatar(img) {
        const radius = getComputedStyle(img).borderRadius || '';
        if (radius.includes('%')) {
            return parseFloat(radius) >= 40;
        }
        if (radius.endsWith('px')) {
            const px = parseFloat(radius);
            const w = img.naturalWidth || img.width || 0;
            return w > 0 && px >= w / 2 - 2;
        }
        return false;
    }

    const IM_BARE_USERNAME_PATH = /^\/[A-Za-z0-9_.]{1,30}\/?$/;

    function im_isSharedPostCard(img) {
        if (!img.closest('div[role="button"]')) return false; // real sent photos aren't wrapped this way

        let node = img.closest('div');
        for (let i = 0; i < 8 && node; i++) {
            const profileLink = [...node.querySelectorAll('a[href]')].find((a) => {
                try {
                    const path = new URL(a.getAttribute('href'), location.origin).pathname;
                    return IM_BARE_USERNAME_PATH.test(path) && !path.startsWith('/direct') && path !== '/';
                } catch {
                    return false;
                }
            });
            if (profileLink) return true;
            node = node.parentElement;
        }
        return false;
    }

    function im_isReelShareCard(img) {
        let node = img.closest('div');
        for (let i = 0; i < 4 && node; i++) {
            if (node.querySelector('svg[aria-label="Clip" i]')) return true;
            node = node.parentElement;
        }
        return false;
    }

    function im_isChatListPreviewRow(img) {
        let node = img.closest('div');
        for (let i = 0; i < 6 && node; i++) {
            if (node.querySelector('abbr[aria-label$="ago" i]')) return true;
            const text = node.textContent || '';
            if (/reacted .* to your message|sent you a message|you sent/i.test(text)) return true;
            node = node.parentElement;
        }
        return false;
    }

    function im_isLikelyAttachment(img, threadListContainer) {
        if (threadListContainer && threadListContainer.contains(img)) return false; // other conversations' previews
        if (im_isChatListPreviewRow(img)) return false; // conversation-list row that slipped past the container check
        if (im_isSharedPostCard(img)) return false; // forwarded post/reel card, not a raw sent photo
        if (im_isReelShareCard(img)) return false; // shared reel (has the "Clip" overlay icon)

        const src = img.currentSrc || img.src;
        if (im_hostnameCategory(src) === 'sticker') return false;

        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w < 80 || h < 80) return false; // avatars/emoji/small icons

        if (IM_PROFILE_PIC_HINTS.test(img.alt || '')) return false;
        if (im_isCircularAvatar(img)) return false; // profile pictures render circular; real attachments don't

        const link = img.closest('a[href]');
        if (link) {
            if (IM_POST_REEL_HREF.test(link.href)) return false; // shared post/reel, not a raw sent photo/video

            if (!link.href.includes('instagram.com')) {
                const hasCardText = link.querySelector('div,span')?.textContent?.trim().length > 0 &&
                    link.querySelectorAll('img').length === 1 &&
                    link.parentElement?.textContent?.trim().length > (link.textContent?.trim().length || 0);
                if (hasCardText) return false;
            }
        }

        if (img.closest('[aria-label*="sticker" i], [aria-label*="reaction" i]')) return false;

        return true;
    }

    const IM_MEDIA_CACHE_PREFIX = 'instamate.sharedmedia.';
    const IM_MEDIA_CACHE = new Map(); // threadPath -> Map(src -> item), in-memory mirror of GM storage for this session

    function im_mediaCacheKeyForCurrentThread() {
        return IM_MEDIA_CACHE_PREFIX + location.pathname;
    }

    function im_mediaCacheForCurrentThread() {
        const pathKey = location.pathname;
        if (IM_MEDIA_CACHE.has(pathKey)) return IM_MEDIA_CACHE.get(pathKey);

        const map = new Map();
        if (im_gmAvailable()) {
            try {
                const stored = JSON.parse(GM_getValue(im_mediaCacheKeyForCurrentThread(), '[]'));
                stored.forEach((item) => map.set(item.src || item.poster, item));
            } catch {
            }
        }
        IM_MEDIA_CACHE.set(pathKey, map);
        return map;
    }

    function im_persistMediaCache(cache) {
        if (!im_gmAvailable()) return;
        try {
            GM_setValue(im_mediaCacheKeyForCurrentThread(), JSON.stringify([...cache.values()]));
        } catch {
        }
    }

    function im_clearMediaCacheForCurrentThread() {
        IM_MEDIA_CACHE.set(location.pathname, new Map());
        if (im_gmAvailable()) {
            try {
                GM_setValue(im_mediaCacheKeyForCurrentThread(), '[]');
            } catch {
            }
        }
    }

    function im_collectSharedMedia() {
        if (!location.pathname.startsWith('/direct/t/')) return [];

        const cache = im_mediaCacheForCurrentThread();
        const threadListContainer = im_findThreadListContainer();
        const sizeBefore = cache.size;

        document.querySelectorAll('img').forEach((img) => {
            if (!im_isLikelyAttachment(img, threadListContainer)) return;
            const src = img.currentSrc || img.src;
            if (!src || cache.has(src)) return;
            cache.set(src, { type: 'image', src });
        });

        document.querySelectorAll('video').forEach((video) => {
            if (threadListContainer && threadListContainer.contains(video)) return;
            if (IM_POST_REEL_HREF.test(video.closest('a[href]')?.href || '')) return;

            const src = video.currentSrc || video.src || video.querySelector('source')?.src || '';
            const poster = video.poster || '';
            const key = src || poster;
            if (!key || cache.has(key)) return;
            if (im_hostnameCategory(key) === 'sticker') return;
            cache.set(key, { type: 'video', src, poster });
        });

        if (cache.size !== sizeBefore) im_persistMediaCache(cache);

        return [...cache.values()];
    }

    if (typeof im_registerPanelSection === 'function') {
        im_registerPanelSection({
            mount(panel) {
                const title = document.createElement('div');
                title.className = 'im-section-title';
                title.textContent = 'Shared Media \u2014 this chat';
                const note = document.createElement('div');
                note.className = 'im-row-desc';
                note.style.padding = '0 18px 10px';
                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0 18px 10px;';
                const clearCacheBtn = document.createElement('button');
                clearCacheBtn.textContent = 'Clear cache';
                clearCacheBtn.style.cssText = 'display:block;width:100%;margin:0 0 14px;padding:10px 18px;border:none;background:#ED4956;color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
                panel.append(title, note, grid, clearCacheBtn);

                function renderItems() {
                    const items = im_collectSharedMedia();
                    grid.innerHTML = '';
                    note.textContent = items.length === 0
                        ? 'Nothing cached yet -- media appears here as you scroll through the chat.'
                        : `${items.length} item${items.length === 1 ? '' : 's'} cached.`;
                    items.forEach((item) => {
                        const thumb = document.createElement('a');
                        thumb.href = item.src || item.poster;
                        thumb.target = '_blank';
                        thumb.rel = 'noopener noreferrer';
                        thumb.style.cssText = 'display:block;aspect-ratio:1;border-radius:6px;overflow:hidden;background:rgba(0,0,0,.15);';
                        const img = document.createElement('img');
                        img.src = item.type === 'video' ? (item.poster || item.src) : item.src;
                        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                        thumb.append(img);
                        grid.append(thumb);
                    });
                }

                clearCacheBtn.addEventListener('click', () => {
                    im_clearMediaCacheForCurrentThread();
                    renderItems();
                });

                return function refresh() {
                    const inThread = location.pathname.startsWith('/direct/t/');
                    title.classList.toggle('im-hidden', !inThread);
                    note.classList.toggle('im-hidden', !inThread);
                    grid.classList.toggle('im-hidden', !inThread);
                    clearCacheBtn.classList.toggle('im-hidden', !inThread);
                    if (!inThread) return;
                    renderItems();
                };
            },
        });
    }

// ---- addons/security/core.js ----
    const Security = {
        blockedBeaconCount: 0,
        blockedRequestCount: 0,
        blockedElementCount: 0,

        init() {
            this.blockBeacons();
            this.blockTelemetryRequests();
            this.blockTrackerElements();
            this.stripTrackingParams();
            this.hardenOutboundReferrers();

            if (typeof unsafeWindow !== 'undefined') {
                unsafeWindow.__instamate_security__ = this;
            }
        },
    };

// ---- addons/security/beacon.js ----
    Security.blockBeacons = function blockBeacons() {
        if (!navigator.sendBeacon) return;

        const original = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url, data) => {
            Security.blockedBeaconCount++;
            void original; // kept for reference, intentionally never called
            return true; // report success so callers don't fall back to fetch/XHR instead
        };
    };

// ---- addons/security/network.js ----
    const IM_SECURITY_BLOCKED_PATTERNS = [
        /\/ajax\/bz/i, // Meta's batched client-event logging endpoint
        /\/logging_client_events/i,
        /\/api\/v1\/qe\/expose/i, // experiment/feature-flag exposure logging
        /\/quality_data/i,
        /\/api\/v1\/qpl/i, // Meta's QuickPerformanceLogging endpoint
        /connect\.facebook\.net\/.+\/fbevents\.js/i, // Meta Pixel script
        /facebook\.com\/tr\b/i, // Meta Pixel tracking-pixel endpoint
        /facebook\.com\/instagram\/sync/i, // cross-app FB/IG identity sync (ad targeting linkage)
        /\/api\/v1\/wearable_devices\/data_export/i,
    ];

    function im_isBlockedTelemetryUrl(url) {
        const str = typeof url === 'string' ? url : url?.toString?.() || '';
        return IM_SECURITY_BLOCKED_PATTERNS.some((pattern) => pattern.test(str));
    }

    Security.blockTelemetryRequests = function blockTelemetryRequests() {
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
            const url = typeof input === 'string' ? input : input?.url;
            if (im_isBlockedTelemetryUrl(url)) {
                Security.blockedRequestCount++;
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            return originalFetch(input, init);
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
            if (im_isBlockedTelemetryUrl(url)) {
                Security.blockedRequestCount++;
                this.im_blocked = true;
            }
            return originalOpen.call(this, method, url, ...rest);
        };

        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function send(...args) {
            if (this.im_blocked) return undefined; // never actually dispatched
            return originalSend.apply(this, args);
        };
    };

// ---- addons/security/dom-blocker.js ----
    Security.blockTrackerElements = function blockTrackerElements() {
        [HTMLScriptElement, HTMLImageElement].forEach((ElementClass) => {
            const descriptor = Object.getOwnPropertyDescriptor(ElementClass.prototype, 'src')
                || Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src');
            if (!descriptor?.set) return;

            Object.defineProperty(ElementClass.prototype, 'src', {
                configurable: true,
                enumerable: descriptor.enumerable,
                get: descriptor.get,
                set(value) {
                    if (im_isBlockedTelemetryUrl(value)) {
                        Security.blockedElementCount++;
                        return; // never assigned -- the element never loads
                    }
                    descriptor.set.call(this, value);
                },
            });
        });

        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function setAttribute(name, value) {
            if (name === 'src' && (this instanceof HTMLScriptElement || this instanceof HTMLImageElement) && im_isBlockedTelemetryUrl(value)) {
                Security.blockedElementCount++;
                return;
            }
            return originalSetAttribute.call(this, name, value);
        };
    };

// ---- addons/security/tracking-params.js ----
    const IM_TRACKING_PARAMS = ['fbclid', 'igshid', 'igsh', 'mibextid'];

    Security.stripTrackingParams = function stripTrackingParams() {
        const strip = () => {
            const url = new URL(location.href);
            let changed = false;
            IM_TRACKING_PARAMS.forEach((param) => {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    changed = true;
                }
            });
            if (changed) history.replaceState(history.state, '', url.toString());
        };

        strip();
        window.addEventListener('popstate', strip);
        const originalPushState = history.pushState.bind(history);
        history.pushState = (...args) => {
            originalPushState(...args);
            strip();
        };
    };

// ---- addons/security/referrer.js ----
    Security.hardenOutboundReferrers = function hardenOutboundReferrers() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest?.('a[href]');
            if (!link) return;

            let isExternal = false;
            try {
                isExternal = new URL(link.href, location.href).hostname !== location.hostname;
            } catch {
                return;
            }
            if (!isExternal) return;

            const rel = new Set((link.rel || '').split(/\s+/).filter(Boolean));
            rel.add('noreferrer');
            rel.add('noopener');
            link.rel = [...rel].join(' ');
        }, true);
    };

// ---- addons/security/launch.js ----
    Security.init();

// ---- addons/instasnap/core.js ----
    const InstaSnap = {
        hiddenAdCount: 0,
        pausedVideoCount: 0,

        init() {
            this.disableAnimations();
            this.optimizeVideos();
            this.hideSponsoredPosts();
        },
    };

// ---- addons/instasnap/animations.js ----
    InstaSnap.disableAnimations = function disableAnimations() {
        const style = document.createElement('style');
        style.id = 'instamate-instasnap-style';
        style.textContent = `
            *, *::before, *::after {
                animation: none !important
                transition-duration: none !important
                scroll-behavior: auto !important;
            }
        `;
        document.head.appendChild(style);
    };

// ---- addons/instasnap/video.js ----
    InstaSnap.optimizeVideos = function optimizeVideos() {
        const offscreenObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting && !entry.target.paused) {
                    entry.target.pause();
                    InstaSnap.pausedVideoCount++;
                }
            });
        }, { threshold: 0 });

        function prepareVideo(video) {
            if (video.dataset.instamateSnapReady) return;
            video.dataset.instamateSnapReady = '1';
            video.preload = 'metadata';
            offscreenObserver.observe(video);
        }

        document.querySelectorAll('video').forEach(prepareVideo);

        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;
                    if (node.tagName === 'VIDEO') prepareVideo(node);
                    node.querySelectorAll?.('video').forEach(prepareVideo);
                });
            });
        }).observe(document.documentElement, { childList: true, subtree: true });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) return;
            document.querySelectorAll('video').forEach((video) => {
                if (!video.paused) {
                    video.pause();
                    InstaSnap.pausedVideoCount++;
                }
            });
        });
    };

// ---- addons/instasnap/ads.js ----
    InstaSnap.hideSponsoredPosts = function hideSponsoredPosts() {
        function checkPost(post) {
            if (post.dataset.instamateSnapChecked) return;
            post.dataset.instamateSnapChecked = '1';

            const isSponsored = [...post.querySelectorAll('span, div')]
                .some((node) => node.textContent?.trim() === 'Sponsored');
            if (isSponsored) {
                post.style.display = 'none';
                InstaSnap.hiddenAdCount++;
            }
        }

        document.querySelectorAll('article').forEach(checkPost);

        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;
                    if (node.tagName === 'ARTICLE') checkPost(node);
                    node.querySelectorAll?.('article').forEach(checkPost);
                });
            });
        }).observe(document.documentElement, { childList: true, subtree: true });
    };

// ---- addons/instasnap/launch.js ----
    InstaSnap.init();
    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.__instamate_instasnap__ = InstaSnap;
    }

// ---- addons/search/core.js ----
    const IMSearch = {
        overlayOpen: false,
        debounceTimer: null,
        debounceMs: 250, // avoid hammering Instagram's endpoint on every keystroke

        init() {
            this.watchForThreadId();

            window.addEventListener('keydown', (event) => {
                const isShortcut = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey
                    && event.key.toLowerCase() === 'k';
                if (!isShortcut) return;

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                this.toggleOverlay();
            }, true);
        },
    };

// ---- addons/search/api.js ----
    IMSearch.searchPeople = async function searchPeople(query) {
        if (!query) return [];
        try {
            const url = `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(query)}&context=blended`;
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) return [];
            const data = await response.json();
            return (data.users || []).map((entry) => ({
                username: entry.user.username,
                fullName: entry.user.full_name,
                avatar: entry.user.profile_pic_url,
                isPrivate: entry.user.is_private,
            }));
        } catch {
            return [];
        }
    };


    const IM_THREAD_ID_CACHE = new Map(); // url thread-key -> resolved big numeric thread id (for in_thread_message_search)
    const IM_THREAD_FBID_CACHE = new Map(); // url thread-key -> resolved thread_fbid (for the GraphQL anchor calls)
    const IM_AUTH_TOKENS = { fbDtsg: null, lsd: null, jazoest: null, actorId: null };

    function im_currentThreadKey() {
        const match = location.pathname.match(/\/direct\/t\/([^/]+)/);
        return match ? match[1] : null;
    }

    function im_captureThreadIdFromText(text) {
        const key = im_currentThreadKey();
        if (key) {
            if (!IM_THREAD_ID_CACHE.has(key)) {
                const match = text.match(/"thread_id"\s*:\s*"(\d{10,})"/) || text.match(/"thread_igid"\s*:\s*"(\d{10,})"/);
                if (match) IM_THREAD_ID_CACHE.set(key, match[1]);
            }
            if (!IM_THREAD_FBID_CACHE.has(key)) {
                const match = text.match(/"thread_fbid"\s*:\s*"(\d{10,})"/);
                if (match) IM_THREAD_FBID_CACHE.set(key, match[1]);
            }
        }
        if (!IM_AUTH_TOKENS.actorId) {
            const match = text.match(/"actorID"\s*:\s*"(\d{10,})"/);
            if (match) IM_AUTH_TOKENS.actorId = match[1];
        }
    }

    function im_captureAuthTokensFromBody(body) {
        if (typeof body !== 'string') return;
        const dtsgMatch = body.match(/(?:^|&)fb_dtsg=([^&]+)/);
        const lsdMatch = body.match(/(?:^|&)lsd=([^&]+)/);
        const jazoestMatch = body.match(/(?:^|&)jazoest=([^&]+)/);
        if (dtsgMatch) IM_AUTH_TOKENS.fbDtsg = decodeURIComponent(dtsgMatch[1]);
        if (lsdMatch) IM_AUTH_TOKENS.lsd = decodeURIComponent(lsdMatch[1]);
        if (jazoestMatch) IM_AUTH_TOKENS.jazoest = decodeURIComponent(jazoestMatch[1]);
    }

    IMSearch.watchForThreadId = function watchForThreadId() {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            if (init?.body) im_captureAuthTokensFromBody(init.body);
            const response = await originalFetch(input, init);
            response.clone().text().then(im_captureThreadIdFromText).catch(() => {
            });
            return response;
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function open(...args) {
            this.addEventListener('load', () => {
                try {
                    if (typeof this.responseText === 'string') im_captureThreadIdFromText(this.responseText);
                } catch {
                }
            });
            return originalOpen.apply(this, args);
        };

        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function send(body) {
            im_captureAuthTokensFromBody(body);
            return originalSend.call(this, body);
        };
    };

    function im_getCookie(name) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : '';
    }

    IMSearch.searchMessages = async function searchMessages(query) {
        const key = im_currentThreadKey();
        if (!query || !key) return { items: [], pending: false, error: false };

        const threadId = IM_THREAD_ID_CACHE.get(key);
        if (!threadId) {
            return { items: [], pending: true, error: false };
        }

        try {
            const url = `https://www.instagram.com/api/v1/direct_v2/in_thread_message_search/?id=${threadId}&offset=0&query=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': im_getCookie('csrftoken'),
                    'X-IG-App-ID': '936619743392459',
                },
            });
            if (!response.ok) return { items: [], pending: false, error: true };

            const data = await response.json();
            const usersById = new Map((data.thread?.users || []).map((u) => [u.id, u]));

            const items = (data.in_thread_content_results || []).map((result) => ({
                id: result.item_id,
                text: result.message_text,
                timestamp: result.timestamp,
                sender: usersById.get(result.sender_id)?.username || 'Unknown',
                mid: result.mid,
            }));

            return { items, pending: false, error: false };
        } catch {
            return { items: [], pending: false, error: true };
        }
    };


    async function im_graphqlAnchorQuery(docId, friendlyName, variables) {
        if (!IM_AUTH_TOKENS.fbDtsg || !IM_AUTH_TOKENS.lsd || !IM_AUTH_TOKENS.actorId) return null;

        const body = new URLSearchParams({
            av: IM_AUTH_TOKENS.actorId,
            __d: 'www',
            __user: '0',
            __a: '1',
            fb_dtsg: IM_AUTH_TOKENS.fbDtsg,
            jazoest: IM_AUTH_TOKENS.jazoest || '',
            lsd: IM_AUTH_TOKENS.lsd,
            fb_api_caller_class: 'RelayModern',
            fb_api_req_friendly_name: friendlyName,
            server_timestamps: 'true',
            variables: JSON.stringify(variables),
            doc_id: docId,
        });

        try {
            const response = await fetch('https://www.instagram.com/api/graphql', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': im_getCookie('csrftoken'),
                    'X-FB-Friendly-Name': friendlyName,
                    'X-FB-LSD': IM_AUTH_TOKENS.lsd,
                    'X-IG-App-ID': '936619743392459',
                },
                body: body.toString(),
            });
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }

    function im_slideMessageToPlain(node) {
        return {
            id: node.message_id,
            text: node.text_body || node.content?.text_body || '',
            sender: node.sender?.user_dict?.username || node.sender?.name || 'Unknown',
            senderAvatar: node.sender?.user_dict?.profile_pic_url || '',
            timestamp: Number(node.timestamp_ms),
        };
    }

    IMSearch.fetchMessageContext = async function fetchMessageContext(mid) {
        const key = im_currentThreadKey();
        const threadFbid = key && IM_THREAD_FBID_CACHE.get(key);
        if (!threadFbid) return { before: [], after: [], error: false, pending: true };

        const [beforeData, afterData] = await Promise.all([
            im_graphqlAnchorQuery(27698093573152499, 'IGDMessageListAnchorMessageRangeBeforeOffMsysQuery', {
                after: null, before: null, first: null,
                include_edge_message: true, is_anchor_message: true, last: 20,
                newer_than_message_id: mid, older_than_message_id: null,
                id: threadFbid,
            }),
            im_graphqlAnchorQuery(27614839121471969, 'IGDMessageListAnchorMessageRangeAfterOffMsysQuery', {
                after: null, before: null, first: 20,
                include_edge_message: null, is_anchor_message: true, last: null,
                newer_than_message_id: null, older_than_message_id: mid,
                id: threadFbid,
            }),
        ]);

        if (!beforeData && !afterData) return { before: [], after: [], error: true, pending: false };

        const beforeEdges = beforeData?.data?.fetch__SlideThread?.as_ig_direct_thread?.slide_messages_before?.edges || [];
        const afterEdges = afterData?.data?.fetch__SlideThread?.as_ig_direct_thread?.slide_messages_after?.edges || [];

        return {
            before: beforeEdges.map((e) => im_slideMessageToPlain(e.node)).reverse(),
            after: afterEdges.map((e) => im_slideMessageToPlain(e.node)),
            error: false,
            pending: false,
        };
    };


    IMSearch.scrapeConversationList = function scrapeConversationList() {
        const links = [...document.querySelectorAll('a[href^="/direct/t/"]')];
        const seen = new Set();
        const conversations = [];

        links.forEach((link) => {
            const href = link.getAttribute('href');
            if (seen.has(href)) return;

            const row = link.closest('div[role="button"]') || link.parentElement;
            if (!row) return;

            const avatars = [...row.querySelectorAll('img')].filter((img) => {
                const w = img.naturalWidth || img.width || 0;
                return w > 0 && w < 100; // avatar-sized, excludes any larger preview thumbnails
            });
            if (avatars.length === 0) return;

            const textNodes = [...row.querySelectorAll('span')]
                .map((s) => s.textContent.trim())
                .filter(Boolean);
            const title = textNodes[0] || avatars[0].alt || 'Conversation';

            seen.add(href);
            conversations.push({
                href,
                title,
                avatar: avatars[0].currentSrc || avatars[0].src || '',
                isGroup: avatars.length > 1,
            });
        });

        return conversations;
    };

    IMSearch.searchConversations = function searchConversations(query, { groupOnly = false, dmOnly = false } = {}) {
        const all = this.scrapeConversationList();
        const filtered = all.filter((c) => {
            if (groupOnly && !c.isGroup) return false;
            if (dmOnly && c.isGroup) return false;
            return !query || c.title.toLowerCase().includes(query.toLowerCase());
        });
        return filtered.slice(0, 10);
    };

    IMSearch.getRecentConversations = function getRecentConversations(limit = 5) {
        return this.scrapeConversationList().slice(0, limit);
    };


    IMSearch.searchFollowing = async function searchFollowing(query) {
        if (!IM_AUTH_TOKENS.actorId) return [];
        try {
            const url = `https://www.instagram.com/api/v1/friendships/${IM_AUTH_TOKENS.actorId}/following/?query=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': im_getCookie('csrftoken'),
                    'X-IG-App-ID': '936619743392459',
                },
            });
            if (!response.ok) return [];
            const data = await response.json();
            return (data.users || []).map((user) => ({
                username: user.username,
                fullName: user.full_name,
                avatar: user.profile_pic_url,
                isPrivate: user.is_private,
            }));
        } catch {
            return [];
        }
    };

// ---- addons/search/ui.js ----
const IM_SEARCH_CSS = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .im-backdrop {
            position: fixed; inset: 0; background: rgba(0,0,0,.65);
            z-index: 2147483003; display: flex; align-items: flex-start; justify-content: center;
            padding-top: 12vh;
        }
        .im-panel {
            width: 520px; max-width: 92vw; max-height: 70vh; overflow: hidden;
            background: #262626; color: #f5f5f5; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,.55);
            display: flex; flex-direction: column;
        }
        .im-input {
            width: 100%; padding: 16px 18px; font-size: 16px; border: none; border-bottom: 1px solid #3a3a3a;
            background: transparent; color: #f5f5f5; outline: none;
        }
        .im-input::placeholder { color: #8e8e8e; }
        .im-results { overflow-y: auto; padding: 8px 0; }
        .im-section-label { padding: 10px 18px 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em; color: #8e8e8e; text-transform: uppercase; }
        .im-row { display: flex; align-items: center; gap: 12px; padding: 8px 18px; cursor: pointer; }
        .im-row:hover { background: rgba(255,255,255,.06); }
        .im-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #3a3a3a; flex-shrink: 0; }
        .im-name { font-size: 14px; font-weight: 600; }
        .im-sub { font-size: 12px; color: #8e8e8e; }
        .im-empty { padding: 24px 18px; text-align: center; color: #8e8e8e; font-size: 13px; }
        .im-hint { padding: 10px 18px; border-top: 1px solid #3a3a3a; font-size: 11px; color: #8e8e8e; }
        .im-back { display: flex; align-items: center; gap: 6px; padding: 12px 18px; cursor: pointer; font-size: 13px; font-weight: 600; color: #8e8e8e; border-bottom: 1px solid #3a3a3a; }
        .im-back:hover { color: #f5f5f5; }
        .im-transcript { padding: 8px 0; }
        .im-tmsg { display: flex; gap: 10px; padding: 6px 18px; }
        .im-tmsg .im-avatar { width: 26px; height: 26px; margin-top: 2px; }
        .im-tmsg .im-name { font-size: 13px; }
        .im-tmsg .im-text { font-size: 13px; color: #d8d8d8; margin-top: 1px; }
        .im-tmsg.matched { background: rgba(255,204,0,.1); border-left: 3px solid #ffcc00; padding-left: 15px; }
        .im-tmsg.matched .im-text { color: #f5f5f5; font-weight: 600; }
        .im-tmsg .im-time { font-size: 11px; color: #6a6a6a; margin-left: 6px; }
    `;

    function im_navigateSpa(url) {
        history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }

    function im_searchRow({ avatar, name, sub, onClick }) {
        const row = document.createElement('div');
        row.className = 'im-row';
        if (avatar !== undefined) {
            const img = document.createElement('img');
            img.className = 'im-avatar';
            if (avatar) img.src = avatar;
            row.append(img);
        }
        const text = document.createElement('div');
        text.innerHTML = `<div class="im-name">${name}</div>${sub ? `<div class="im-sub">${sub}</div>` : ''}`;
        row.append(text);
        if (onClick) row.addEventListener('click', onClick);
        return row;
    }

    IMSearch.toggleOverlay = function toggleOverlay() {
        if (this.overlayOpen) {
            this.closeOverlay();
        } else {
            this.openOverlay();
        }
    };

    IMSearch.openOverlay = function openOverlay() {
        let host = document.getElementById('instamate-search-host');
        let root = host?.shadowRoot;
        if (!host) {
            host = document.createElement('div');
            host.id = 'instamate-search-host';
            document.body.append(host);
            root = host.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = IM_SEARCH_CSS;
            root.append(style);
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'im-backdrop';
        const panel = document.createElement('div');
        panel.className = 'im-panel';

        const input = document.createElement('input');
        input.className = 'im-input';
        input.placeholder = 'Search\u2026  @accounts  #groups  !dms';

        const results = document.createElement('div');
        results.className = 'im-results';

        const hint = document.createElement('div');
        hint.className = 'im-hint';
        hint.textContent = 'Esc to close \u00b7 Ctrl/Cmd+K to toggle';

        panel.append(input, results, hint);
        backdrop.append(panel);
        root.append(backdrop);

        this.overlayOpen = true;

        const shut = () => {
            backdrop.remove();
            this.overlayOpen = false;
        };
        this._closeFn = shut;

        let lastQuery = '';

        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) shut();
        });
        document.addEventListener('keydown', function onEsc(event) {
            if (event.key === 'Escape') {
                shut();
                document.removeEventListener('keydown', onEsc);
            }
        });

        input.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            const query = input.value.trim();
            lastQuery = query;
            if (!query) {
                this.renderRecentConversations(results, shut);
                return;
            }
            results.innerHTML = '<div class="im-empty">Searching\u2026</div>';
            this.debounceTimer = setTimeout(() => this.runSearch(query, results, shut), this.debounceMs);
        });

        this._rerunLastSearch = () => {
            if (lastQuery) this.runSearch(lastQuery, results, shut);
            else this.renderRecentConversations(results, shut);
        };

        this.renderRecentConversations(results, shut);
        input.focus();
    };

    IMSearch.closeOverlay = function closeOverlay() {
        this._closeFn?.();
    };

    IMSearch.renderRecentConversations = function renderRecentConversations(results, closeOverlay) {
        const recent = this.getRecentConversations(5);
        results.innerHTML = '';

        if (recent.length === 0) {
            results.innerHTML = '<div class="im-empty">Start typing to search \u2014 or try @accounts, #groups, !dms</div>';
            return;
        }

        const label = document.createElement('div');
        label.className = 'im-section-label';
        label.textContent = 'Recent';
        results.append(label);

        recent.forEach((conversation) => {
            results.append(im_searchRow({
                avatar: conversation.avatar,
                name: conversation.title,
                sub: conversation.isGroup ? 'Group' : 'Direct message',
                onClick: () => {
                    im_navigateSpa(`https://www.instagram.com${conversation.href}`);
                    closeOverlay();
                },
            }));
        });
    };

    function im_parseBang(raw) {
        if (raw.startsWith('@')) return { mode: 'accounts', text: raw.slice(1).trim() };
        if (raw.startsWith('#')) return { mode: 'groups', text: raw.slice(1).trim() };
        if (raw.startsWith('!')) return { mode: 'dms', text: raw.slice(1).trim() };
        return { mode: 'following', text: raw };
    }

    function im_renderPeopleSection(results, people, closeOverlay, label = 'People') {
        if (people.length === 0) {
            results.innerHTML = `<div class="im-empty">No matching accounts.</div>`;
            return;
        }
        const heading = document.createElement('div');
        heading.className = 'im-section-label';
        heading.textContent = label;
        results.append(heading);
        people.slice(0, 8).forEach((person) => {
            results.append(im_searchRow({
                avatar: person.avatar,
                name: person.fullName || person.username,
                sub: '@' + person.username + (person.isPrivate ? ' \u00b7 Private' : ''),
                onClick: () => {
                    im_navigateSpa(`https://www.instagram.com/${person.username}/`);
                    closeOverlay();
                },
            }));
        });
    }

    function im_renderConversationsSection(results, conversations, closeOverlay, label) {
        if (conversations.length === 0) {
            results.innerHTML = `<div class="im-empty">No matching ${label.toLowerCase()}.</div>`;
            return;
        }
        const heading = document.createElement('div');
        heading.className = 'im-section-label';
        heading.textContent = label;
        results.append(heading);
        conversations.forEach((conversation) => {
            results.append(im_searchRow({
                avatar: conversation.avatar,
                name: conversation.title,
                sub: conversation.isGroup ? 'Group' : 'Direct message',
                onClick: () => {
                    im_navigateSpa(`https://www.instagram.com${conversation.href}`);
                    closeOverlay();
                },
            }));
        });
    }

    IMSearch.runSearch = async function runSearch(raw, results, closeOverlay) {
        const { mode, text } = im_parseBang(raw);
        results.innerHTML = '';

        if (mode === 'accounts') {
            const people = await this.searchPeople(text);
            im_renderPeopleSection(results, people, closeOverlay, 'Accounts');
            return;
        }

        if (mode === 'groups') {
            const groups = this.searchConversations(text, { groupOnly: true });
            im_renderConversationsSection(results, groups, closeOverlay, 'Groups');
            return;
        }

        if (mode === 'dms') {
            const dms = this.searchConversations(text, { dmOnly: true });
            im_renderConversationsSection(results, dms, closeOverlay, 'DMs');
            return;
        }

        const [following, messages] = await Promise.all([
            this.searchFollowing(text),
            this.searchMessages(text),
        ]);

        if (following.length > 0) im_renderPeopleSection(results, following, closeOverlay, 'Following');

        const messagesLabel = document.createElement('div');
        messagesLabel.className = 'im-section-label';
        messagesLabel.textContent = 'Messages in this chat';

        if (messages.items.length > 0) {
            results.append(messagesLabel);
            messages.items.slice(0, 8).forEach((message) => {
                const when = new Date(message.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                results.append(im_searchRow({
                    name: message.text,
                    sub: `${message.sender} \u00b7 ${when}`,
                    onClick: () => this.showMessageContext(message, results),
                }));
            });
        } else if (messages.pending) {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Still picking up this chat\u2019s details \u2014 try again in a moment.';
            results.append(messagesLabel, note);
        } else if (messages.error) {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Message search failed \u2014 Instagram may have rejected the request.';
            results.append(messagesLabel, note);
        } else {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'No matching messages.';
            results.append(messagesLabel, note);
        }
    };

    IMSearch.showMessageContext = async function showMessageContext(message, results) {
        results.innerHTML = '';
        const back = document.createElement('div');
        back.className = 'im-back';
        back.textContent = '\u2190 Back to results';
        back.addEventListener('click', () => this._rerunLastSearch?.());
        results.append(back);

        const loading = document.createElement('div');
        loading.className = 'im-empty';
        loading.textContent = 'Loading context\u2026';
        results.append(loading);

        const context = await this.fetchMessageContext(message.mid);
        loading.remove();

        if (context.pending) {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Still picking up this chat\u2019s details \u2014 try again in a moment.';
            results.append(note);
            return;
        }
        if (context.error) {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Couldn\u2019t load context for this message.';
            results.append(note);
            return;
        }

        const transcript = document.createElement('div');
        transcript.className = 'im-transcript';
        results.append(transcript);

        const renderMsg = (m, matched) => {
            const when = new Date(m.timestamp).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            });
            const row = document.createElement('div');
            row.className = matched ? 'im-tmsg matched' : 'im-tmsg';
            const avatar = document.createElement('img');
            avatar.className = 'im-avatar';
            if (m.senderAvatar) avatar.src = m.senderAvatar;
            const body = document.createElement('div');
            body.innerHTML = `<span class="im-name">${m.sender}</span><span class="im-time">${when}</span><div class="im-text">${m.text}</div>`;
            row.append(avatar, body);
            transcript.append(row);
        };

        context.before.forEach((m) => renderMsg(m, false));
        renderMsg({ text: message.text, sender: message.sender, timestamp: message.timestamp, senderAvatar: '' }, true);
        context.after.forEach((m) => renderMsg(m, false));
    };

// ---- addons/search/launch.js ----
    IMSearch.init();

// ---- addons/float/core.js ----
    const Float = {
        isFloatWindow: window.name.startsWith('float:'),
        windowPrefix: 'float:',
        button: null,
        windows: new Map(),

        init() {
            if (this.isFloatWindow) {
                this.initFloatWindow();
            } else {
                this.initMainWindow();
            }
        },

        initMainWindow() {
            const start = () => {
                new MutationObserver(() => this.injectButton())
                    .observe(document.documentElement, { childList: true, subtree: true });
                this.injectButton();
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', start, { once: true });
            } else {
                start();
            }
        },
    };

// ---- addons/float/convo.js ----
Float.getConversation = function getConversation() {
        if (!location.href.includes('/direct/')) return null;

        const parsed = new URL(location.href);
        parsed.searchParams.delete('float');

        return { url: parsed.href, id: this.getConversationId(parsed) };
    };

    Float.getConversationId = function getConversationId(url) {
        const match = url.pathname.match(/\/direct\/t\/([^/]+)/);
        return match ? match[1] : url.href;
    };

// ---- addons/float/button.js ----
Float.injectButton = function injectButton() {
        if (this.isFloatWindow) return;

        const infoIcon = document.querySelector('svg[aria-label="Conversation information"]');
        const infoButton = infoIcon?.closest('[role="button"]');
        const container = infoButton?.parentElement;
        if (!container || container.querySelector('[data-float-button="true"]')) return;

        const audioButton = container.querySelector('svg[aria-label="Audio call"]')?.closest('[role="button"]');
        if (!audioButton) return;

        const button = infoButton.cloneNode(true);
        button.dataset.floatButton = 'true';
        button.removeAttribute('data-testid');
        button.setAttribute('aria-label', 'Float conversation');
        button.setAttribute('title', 'Float conversation');

        const svg = button.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('aria-label', 'Float conversation');
        svg.innerHTML = `
            <title>Float conversation</title>
            <path d="M14 5h5v5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
            <path d="M19 5l-7 7" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
            <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
        `;

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.openFloat();
        }, true);

        container.insertBefore(button, audioButton);
        this.button = button;
    };

// ---- addons/float/window.js ----
    Float.openFloat = function openFloat() {
        const conversation = this.getConversation();
        if (!conversation) return;

        const { id, url } = conversation;

        const existing = this.windows.get(id);
        if (existing && !existing.closed) {
            existing.focus();
            return;
        }

        const windowName = this.windowPrefix + id;
        const features = 'popup=yes,width=720,height=820,resizable=yes,scrollbars=yes';
        const popup = window.open(url, windowName, features);
        if (!popup) return;

        this.windows.set(id, popup);

        const cleanup = setInterval(() => {
            if (popup.closed) {
                clearInterval(cleanup);
                this.windows.delete(id);
            }
        }, 1000);

        popup.focus();
    };

    Float.initFloatWindow = function initFloatWindow() {
        document.documentElement.dataset.floatWindow = 'true';
        this.installFloatStyles();

        const start = () => {
            new MutationObserver(() => this.applyFloatLayout())
                .observe(document.documentElement, { childList: true, subtree: true });
            this.applyFloatLayout();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }

        setInterval(() => {
            this.applyFloatLayout();
            this.updateFloatTitle();
        }, 1000);
    };

// ---- addons/float/style.js ----
    Float.installFloatStyles = function installFloatStyles() {
        im_injectStyleAsap('float-addon-style', `
            div[class="x9f619 x2lah0s x1nhvcw1 x1qjc9v5 xozqiw3 x1q0g3np x78zum5 x1iyjqo2 x5yr21d x1t2pt76 x1n2onr6 x1ja2u2z x1k6qp8s"] {
                height: 100vh !important;
            }
            .x132t2bv {
                padding-inline-start: 0 !important;
            }
            div[class="x1qjc9v5 x972fbf x10w94by x1qhh985 x14e42zd x9f619 x78zum5 xdt5ytf x1iyjqo2 x5wqa0o xln7xf2 xk390pu xdj266r x14z9mp xat24cr x1lziwak x65f84u x1vq45kp xexx8yu xyri2b x18d9i69 x1c1uobl x1n2onr6 x11njtxf"],
            div[class="_aasi _aask _at8n"],
            div[class="x78zum5 x1q0g3np x1gslohp xwib8y2 x1yrsyyn"],
            section[class="x1qjc9v5 x972fbf x10w94by x1qhh985 x14e42zd x9f619 x78zum5 xdt5ytf x1iyjqo2 x5wqa0o xln7xf2 xk390pu xdj266r x14z9mp xat24cr x1lziwak x65f84u x1vq45kp xexx8yu xyri2b x18d9i69 x1c1uobl x1n2onr6 x11njtxf"],
            section[class="x78zum5 x1q0g3np x1gslohp xwib8y2 x1yrsyyn"],
            div[class="x78zum5 xdt5ytf x1iyjqo2 xs83m0k x2lwn1j xw2csxc x1odjw0f x1n2onr6 x12nagc"],
            div[class="x1yztbdb"],
            .x1n327nk.xeq5yr9.x1dr59a3.x1nhvcw1.x1oa3qoh.x1qjc9v5.xqjyukv.xdt5ytf.x2lah0s.x1c4vz4f.xryxfnj.x1plvlek.x13vifvy.xixxii4.xbiv7yw.x16uus16.x1ga7v0g.x15mokao.x78zum5.xjbqb8w.x9f619,
            .xvbhtw8.xf7dkkf.xv54qhq.x11njtxf.x1n2onr6.x18d9i69.xexx8yu.x1h3rv7z.x1lziwak.xat24cr.x14z9mp.xdj266r.xk390pu.x2lah0s.xdt5ytf.x78zum5.x9f619.x1qjc9v5,
            div[class="x1n2onr6 x1ja2u2z x78zum5 xdt5ytf xuphzoz xt5vzds x17quhge x1wggrwl x1u1lrf5 xvbhtw8"],
            div[class="x1qjc9v5 x78zum5 x1q0g3np xl56j7k xh8yej3"],
            div[class="html-div xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x9f619 xjbqb8w x78zum5 x15mokao x1ga7v0g x16uus16 xbiv7yw xixxii4 x1ey2m1c x1plvlek xryxfnj x1c4vz4f x2lah0s xdt5ytf xqjyukv x1qjc9v5 x1oa3qoh x1nhvcw1 xg7h5cd xh8yej3 xhtitgo x6w1myc x1jeouym"] {
                display: none;
            }
        `);
    };

    Float.applyFloatLayout = function applyFloatLayout() {
        if (!this.isFloatWindow) return;

        document.querySelectorAll('nav').forEach((nav) => {
            nav.style.setProperty('display', 'none', 'important');
        });

        const textarea = document.querySelector('textarea[placeholder="Message..."]');
        if (!textarea) return;

        textarea.style.setProperty('display', 'none', 'important');

        let parent = textarea.parentElement;
        for (let i = 0; i < 6 && parent; i++) {
            if (parent.getBoundingClientRect().height > 150) break;
            parent.style.setProperty('display', 'none', 'important');
            parent = parent.parentElement;
        }
    };

// ---- addons/float/title.js ----
Float.updateFloatTitle = function updateFloatTitle() {
        if (!this.isFloatWindow) return;

        const name = this.getChatName();
        if (name) document.title = 'Float \u2014 ' + name;
    };

    Float.getChatName = function getChatName() {
        const infoIcon = document.querySelector('svg[aria-label="Conversation information"]');
        if (!infoIcon) return null;

        let node = infoIcon.parentElement;
        for (let i = 0; i < 8 && node; i++) {
            const text = node.innerText?.trim();
            if (text && text.length > 0 && text.length < 150) {
                const [firstLine] = text.split('\n').map((line) => line.trim()).filter(Boolean);
                if (firstLine) return firstLine;
            }
            node = node.parentElement;
        }
        return null;
    };

// ---- addons/float/launch.js ----
if (IM.isEnabled('float')) {
    Float.init();
}

// ---- end.js ----
})();

