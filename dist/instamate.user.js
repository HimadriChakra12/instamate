// ==UserScript==
// @name         Instamate
// @namespace    https://github.com/HimadriChakra12/Instamate
// @version      2.07.08
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
// @selectionbugfix https://greasyfork.org/pt-BR/scripts/470382-instagram-close-fix
// @shared-media Generated
// @msgname      Generated
// @float        Generated
// @run-at       document-start
// ==/UserScript==

// ---- start.js ----
(() => {
  'use strict';

// ---- core/settings.js ----
// ---------------------------------------------------------------------------
    // Instamate core: settings + registry
    //
    // Everything below concatenates into one IIFE, so this `IM` object is just
    // shared across every later file in the build via closure -- no imports
    // needed. Two kinds of feature live in src/:
    //
    //   opts/    toggleable features. Wrap your logic in
    //            `if (IM.isEnabled('yourkey')) { ... }` and add a matching
    //            entry to IM_OPTS below so it shows up in the popup.
    //   addons/  permanent features. They always run; list them in IM_ADDONS
    //            purely so the popup can show the user what's active.
    // ---------------------------------------------------------------------------

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
            /* storage unavailable -- toggle just won't persist across reloads */
        }
    }

    // Manifest of every toggleable opt. Add an entry here whenever a new opt
    // module is wired into tools/build.c's ORDER list, using the same key you
    // guard its code with via IM.isEnabled(key).
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

    // Manifest of addons -- permanent changes, always on once built in. Shown
    // in the popup for visibility only; there is no toggle for these.
    const IM_ADDONS = [
        {
            key: 'sharedmedia',
            label: 'Shared Media',
            description: 'Adds a grid of this chat\u2019s photos/videos to the settings popup \u2014 the gallery view web is missing versus the mobile app.',
        },
        {
            key: 'reelsramsaver',
            label: 'Reels RAM Saver',
            description: 'Unloads off-screen Reels videos so long scrolling sessions stay light on memory.',
        },
        {
            key: 'selectionbugfix',
            label: 'Instagram Close Fix',
            description: 'work around, for the instagram bug to select elements when closing the post',
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
// ---------------------------------------------------------------------------
    // Instamate core: settings popup
    //
    // Injects an Instagram-styled popup for switching opts on/off. The only
    // entry point on-page is Instagram's own sidebar icon, repurposed to open
    // it (see the "Sidebar icon takeover" section below); GM_registerMenuCommand
    // is a guaranteed fallback via the userscript manager's own menu. Runs
    // inside its own shadow root so Instagram's own CSS can't bleed into it
    // (and vice versa). Toggling an opt takes effect on next reload, since
    // opt code already ran at document-start by the time you'd ever see this
    // popup.
    // ---------------------------------------------------------------------------

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

    // ---- Sidebar icon takeover --------------------------------------------
    //
    // Instagram's own logo/home icon at the top of the left sidebar is just
    // an <a href="/">. Rather than adding a new item next to it (which never
    // quite matches Instagram's spacing/sizing and ends up looking bolted
    // on), we take that exact element over: same icon, same spot, but its
    // click now opens Instamate's settings instead of navigating home.

    function im_findInstagramHomeIcon() {
        // The Instagram *logo* link (top of the sidebar) and the *Home* nav
        // item are both `<a href="/">`, so matching on href alone grabs
        // whichever comes first in the DOM -- which is the Home item, not
        // the logo. Disambiguate by finding the anchor that wraps the
        // "Instagram" logo svg specifically.
        const logoSvg = document.querySelector('a[href="/"] svg[aria-label="Instagram" i]');
        if (logoSvg) return logoSvg.closest('a[href="/"]');

        // Fallback for markup variants where the svg has a <title> instead
        // of an aria-label.
        const byTitle = [...document.querySelectorAll('a[href="/"]')].find((a) =>
            a.querySelector('svg title')?.textContent?.trim().toLowerCase() === 'instagram'
        );
        if (byTitle) return byTitle;

        return (
            document.querySelector('a[aria-label="Instagram" i][href="/"]') ||
            document.querySelector('a[href="/"]')
        );
    }

    // Instagram's SPA re-renders the sidebar on navigation, swapping in a
    // brand-new <a> node with none of our hijack markers or listener. A
    // one-shot "mounted" flag would miss that entirely and never recover --
    // so this checks the *current* node's own dataset every call instead of
    // a global flag, and it's meant to be called repeatedly for the life of
    // the page (see the observer below), not just until the first success.
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
        // Instagram's own brand red, full-width to read as part of the
        // native settings surface rather than a bolted-on extension button.
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

        // Cache persists across reloads (see im_clearMediaCacheForCurrentThread
        // in the addon) -- this is the only way to reset it for the
        // currently open chat.
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
    // Store a reference to the original send method of XMLHttpRequest
    var originalXMLSend = XMLHttpRequest.prototype.send;
    // Override the send method
    XMLHttpRequest.prototype.send = function() {
        // Check if the request URL contains the "viewSeenAt" string
        if (typeof arguments[0] === "string" && arguments[0].includes("viewSeenAt")) {
            // Block the request by doing nothing
            // This prevents the "viewSeenAt" field from being sent
        } else {
            // If the request URL does not contain "viewSeenAt",
            // call the original send method to proceed with the request
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
        // Username span
        const USERNAME_SELECTOR =
            'div.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.x1xmf6yo.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft';
    
        // Nickname
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
                // Normal DM
                base = `${nickname} - ${username}`;
            } else if (nickname === 'Instagram User') {
                // Deleted/deactivated/etc. account, NOT a group
                base = nickname;
            } else {
                // No username = group
                base = `${nickname} - Group`;
            }
    
            // Read whatever count Instagram currently has on the tab title
            // (whether it just set it, or it's sitting on a title we wrote
            // last time) and fold it back in, instead of dropping it.
            const count = getCurrentCount();
            const newTitle = count ? `(${count}) ${base}` : base;
    
            if (newTitle !== lastTitle) {
                lastTitle = newTitle;
                document.title = newTitle;
            } else if (document.title !== lastTitle) {
                // Instagram overwrote our title with something other than a
                // count-prefix update -- put ours back.
                document.title = lastTitle;
            }
        }
    
        // Watch for Instagram's dynamically generated DOM
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
    
        // Handle Instagram SPA navigation
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
// ---------------------------------------------------------------------------
    // Shared Media (addon, permanent -- see src/core/settings.js IM_ADDONS)
    //
    // Instagram web has no equivalent of the mobile app's "shared media"
    // gallery for a chat, so this rebuilds a rough one client-side: scan the
    // photos/videos currently rendered in the *open* thread and hand them
    // back as a de-duplicated list. src/core/ui.js renders that list as a
    // grid inside the settings popup.
    //
    // Scope: only the currently-open conversation, not the whole page.
    // A naive `document.querySelectorAll('img')` also picks up thumbnails
    // from the conversation list on the left (every other DM's preview
    // avatar/last-shared-image), which has nothing to do with "this chat".
    // We find that conversation-list container -- it's identifiable by
    // holding several `a[href^="/direct/t/"]` links, one per conversation --
    // and exclude everything inside it before scanning for media.
    //
    // Filtering: only actual photo/video message attachments should show up
    // here -- not avatars/profile pictures, not shared posts/reels (those
    // are attachments *of* a post, not something someone actually sent as a
    // photo/video), not link-preview thumbnails, not stickers/emoji. We
    // filter by:
    //   - size (avatars/stickers/emoji are small)
    //   - shape (profile pictures render circular; real photo/video
    //     attachments never do -- checked via computed border-radius rather
    //     than alt text, which Instagram doesn't always set consistently)
    //   - alt text, as a second signal alongside the shape check
    //   - ancestry: an instagram.com/p/, /reel/, /reels/, or /tv/ link means
    //     it's a shared post/reel, not a raw attachment; an off-instagram
    //     link wrapping a single image alongside title text is a
    //     link-preview card
    //
    // Caveat, unavoidable from a userscript: Instagram only renders messages
    // that have scrolled into view, loading older history lazily as you
    // scroll up. This only ever sees what's currently loaded -- scroll to
    // the top of the chat first for a fuller list, then reopen the popup.
    // ---------------------------------------------------------------------------

    // Confirmed from real markup: Instagram's own profile-picture <img>
    // uses alt="user-profile-picture" (hyphenated, not "Profile picture for
    // <name>" as originally guessed) -- and its host was
    // scontent.<code>.fna.fbcdn.net, i.e. a *scontent* host, same family as
    // real photo/video attachments. So hostname alone can't tell a profile
    // picture apart from a sent photo; "scontent" only rules out the
    // generic sticker/static CDN hosts, it doesn't confirm "this is a real
    // attachment". Alt text and shape are the checks that actually catch
    // profile pictures, so they always run -- hostname is a fast path for
    // excluding stickers only, never a shortcut to skip the other checks.
    const IM_PROFILE_PIC_HINTS = /profile[\s-]?picture|avatar|story ring/i;
    const IM_POST_REEL_HREF = /instagram\.com\/(p|reel|reels|tv)\//i;

    // The left-hand conversation list is made of several `a[href^="/direct/t/"]`
    // (one per conversation, each pointing at a *different* thread id) sitting
    // in a shared container -- that container is the thing to exclude.
    // Re-derived on each call rather than cached, since Instagram may
    // remount it between renders.
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

    // Instagram serves different image categories off visibly different
    // CDN hostnames:
    //   - actual sent photos/videos:  scontent*.cdninstagram.com / scontent*.fbcdn.net
    //   - profile pictures/avatars:   instagram.<code>.fna.fbcdn.net (no "scontent")
    //   - stickers/emoji/UI assets:   generic cdn hosts, e.g. static.cdninstagram.com
    // This is a much more reliable signal than shape/alt-text guessing, so
    // it's checked first; the older heuristics stay on as a fallback for
    // any URL pattern that doesn't clearly match one of these.
    function im_hostnameCategory(src) {
        let host = '';
        try {
            host = new URL(src, location.href).hostname;
        } catch {
            return 'unknown';
        }
        // Generic/static CDN hosts (not scontent-prefixed) are reliably
        // stickers/emoji/UI chrome, not user-sent media or profile
        // pictures -- this direction is safe to trust outright.
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

    // Second, independent signal for "this is a conversation-list preview
    // row, not the open thread" -- catches cases where
    // im_findThreadListContainer can't find a shared container (e.g. only
    // one other conversation is loaded, so its "2+ thread links share a
    // parent" heuristic never fires). Conversation-list rows have a
    // recognizable text fingerprint regardless of container structure:
    // a relative timestamp like "2d" via <abbr aria-label="... ago">, often
    // paired with a "reacted ... to your message" / "sent you a message" /
    // "Pinned" style preview line. Real message-thread content doesn't look
    // like this.
    // A post shared *into* a chat (forwarded from someone's profile) isn't
    // wrapped in an /p/ or /reel/ permalink like a normal post link would
    // be -- the big image sits inside a plain `div[role="button"]`, not an
    // anchor at all. What it does always have nearby is a link to the
    // original poster's bare profile (e.g. href="/emusabbir01/") plus a
    // repeated "<username> <caption>" text line below the image. That
    // combination -- not any single element -- is the reliable signal.
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

    // Reels shared into a chat use the same role="button" + bare-profile-
    // link card structure as shared posts, but always carry one extra,
    // very specific tell: an overlay svg labeled "Clip" (Instagram's own
    // internal name for a Reel) on top of the thumbnail. Checking for that
    // directly is more reliable than leaning on im_isSharedPostCard alone,
    // since a reel share doesn't always have caption text below it the way
    // a post share does.
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
                // Off-instagram link-preview card: single thumbnail plus a
                // title/description block as a sibling.
                const hasCardText = link.querySelector('div,span')?.textContent?.trim().length > 0 &&
                    link.querySelectorAll('img').length === 1 &&
                    link.parentElement?.textContent?.trim().length > (link.textContent?.trim().length || 0);
                if (hasCardText) return false;
            }
        }

        if (img.closest('[aria-label*="sticker" i], [aria-label*="reaction" i]')) return false;

        return true;
    }

    // ---- Persistent per-thread cache ---------------------------------------
    //
    // Instagram virtualizes the message list -- once a message scrolls far
    // enough out of view, its DOM node (and any image inside it) gets
    // unmounted entirely, not just hidden. A plain re-scan of the live DOM
    // would "lose" media that was found a moment ago just because the
    // person scrolled past it. This cache accumulates everything ever found
    // for a given thread instead, so items only ever get added, never
    // dropped by scrolling.
    //
    // It's purely passive: there's no button that drives Instagram's own
    // scroll container to force-load history (that turned out unreliable
    // in practice -- Instagram's lazy-load didn't respond to programmatic
    // scrolling here). Instead, the cache just keeps whatever's rendered
    // each time this runs, growing naturally as the person scrolls the
    // chat themselves in the course of normal use, and persists across
    // page reloads via GM storage so it isn't lost either. A "Clear cache"
    // button (src/core/ui.js) resets it for the current thread.
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
                /* corrupt/missing stored value -- start fresh */
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
            /* storage unavailable/full -- cache still works for this session, just won't persist */
        }
    }

    function im_clearMediaCacheForCurrentThread() {
        IM_MEDIA_CACHE.set(location.pathname, new Map());
        if (im_gmAvailable()) {
            try {
                GM_setValue(im_mediaCacheKeyForCurrentThread(), '[]');
            } catch {
                /* ignore */
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

    // ---- Settings-popup section --------------------------------------------
    //
    // Registers this addon's own UI (media grid + Clear cache button) with
    // the core settings popup instead of src/core/ui.js hardcoding it --
    // see im_registerPanelSection there. Means this addon's UI lives
    // entirely in this file: removing this addon (deleting this file from
    // the build) removes its section from the popup automatically, no
    // edits needed in ui.js.
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
                // Instagram's own brand red, full-width to read as part of
                // the native settings surface rather than a bolted-on
                // extension button.
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

                // Cache persists across reloads (im_clearMediaCacheForCurrentThread
                // above) -- this is the only way to reset it for the
                // currently open chat.
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

// ---- addons/selectionbugfix/script.js ----
	const events = ['pointerdown', 'pointerup'];
	events.forEach((event) => addEvent(event));

	function addEvent(event) {
		document.addEventListener(event, (e) => {
			if (!e.target.closest('.x1qjc9v5.x9f619.x78zum5.xdt5ytf.x1iyjqo2.xl56j7k')) return;
			e.preventDefault();
			e.stopPropagation();
			document.querySelector('[role="button"]:has([points="20.643 3.357 12 12 3.353 20.647"])').click();
		});
	}

// ---- addons/float/init.js ----
    const Float = {
        isFloatWindow:
            window.name.startsWith('float:'),
        button: null,
        windows: new Map(),
        windowPrefix: 'float:',

        init() {
            if (this.isFloatWindow) {
                this.initFloatWindow();
                return;
            }
            this.initMainWindow();
        },


// ---- addons/float/mainwindow.js ----

        initMainWindow() {
            const observer =
                new MutationObserver(() => {
                    this.injectButton();
                });
            const start = () => {
                observer.observe(
                    document.documentElement,
                    {
                        childList: true,
                        subtree: true
                    }
                );
                this.injectButton();
            };
            if (
                document.readyState ===
                'loading'
            ) {
                document.addEventListener(
                    'DOMContentLoaded',
                    start,
                    { once: true }
                );
            } else {
                start();
            }
        },

// ---- addons/float/convo.js ----
        getConversation() {
            const url =
                location.href;
            if (
                !url.includes(
                    '/direct/'
                )
            ) {
                return null;
            }
            const parsed =
                new URL(url);
            parsed.searchParams.delete(
                'float'
            );
            return {
                url: parsed.href,
                id: this.getConversationId(parsed)
            };
        },

        getConversationId(url) {
            const match =
                url.pathname.match(
                    /\/direct\/t\/([^/]+)/
                );
            if (match)
                return match[1];
            return url.href;
        },

// ---- addons/float/button.js ----
        injectButton() {
            if (this.isFloatWindow)
                return;
            const infoIcon =
                document.querySelector(
                    'svg[aria-label="Conversation information"]'
                );
            if (!infoIcon)
                return;
            const infoButton =
                infoIcon.closest(
                    '[role="button"]'
                );
            if (!infoButton)
                return;
            const container =
                infoButton.parentElement;
            if (!container)
                return;
            if (
                container.querySelector(
                    '[data-float-button="true"]'
                )
            ) {
                return;
            }
            const audioButton =
                container.querySelector(
                    'svg[aria-label="Audio call"]'
                )?.closest(
                    '[role="button"]'
                );
            if (!audioButton)
                return;
            const button =
                infoButton.cloneNode(true);
            button.dataset.floatButton =
                'true';
            button.setAttribute(
                'aria-label',
                'Float conversation'
            );
            button.setAttribute(
                'title',
                'Float conversation'
            );

            const svg =
                button.querySelector(
                    'svg'
                );
            if (!svg)
                return;
            svg.setAttribute(
                'aria-label',
                'Float conversation'
            );
            svg.innerHTML = `
                <title>Float conversation</title>
                <path
                    d="M14 5h5v5"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                />
                <path
                    d="M19 5l-7 7"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                />
                <path
                    d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                />
            `;

            button.removeAttribute(
                'data-testid'
            );
            button.addEventListener(
                'click',
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    this.openFloat();

                },
                true
            );
            container.insertBefore(
                button,
                audioButton
            );

            this.button = button;

            console.log(
                '[Float] button injected'
            );
        },

// ---- addons/float/window.js ----
        openFloat() {

            const conversation =
                this.getConversation();

            if (!conversation)
                return;

            const id =
                conversation.id;

            /*
             * If this conversation is already floating,
             * just focus it.
             */

            const existing =
                this.windows.get(id);

            if (
                existing &&
                !existing.closed
            ) {
                existing.focus();
                return;
            }

            /*
             * Give every float window its own name.
             *
             * window.name survives SPA navigation.
             */

            const windowName =
                this.windowPrefix +
                id;

            /*
             * Keep the actual Instagram URL.
             *
             * No iframe.
             * No fake window.
             * This is a genuine browser window.
             */

            const features = [
                'popup=yes',
                'width=720',
                'height=820',
                'resizable=yes',
                'scrollbars=yes'
            ].join(',');

            const popup =
                window.open(
                    conversation.url,
                    windowName,
                    features
                );

            if (!popup)
                return;

            /*
             * Store it so repeated clicks don't create
             * another window for the same conversation.
             */

            this.windows.set(
                id,
                popup
            );

            /*
             * Cleanup when it closes.
             */

            const cleanup =
                setInterval(() => {

                    if (popup.closed) {

                        clearInterval(
                            cleanup
                        );

                        this.windows.delete(
                            id
                        );
                    }

                }, 1000);

            /*
             * Focus immediately.
             */

            popup.focus();
        },


        /*
         * =========================================================
         * FLOAT WINDOW
         * =========================================================
         */

        initFloatWindow() {

            console.log(
                '[Float] floating window'
            );

            /*
             * Set the marker explicitly.
             *
             * This remains true even when Instagram
             * changes routes internally.
             */

            document.documentElement
                .dataset.floatWindow =
                'true';

            this.installFloatStyles();

            /*
             * Instagram is a SPA, so the actual UI can
             * appear well after document-start.
             */

            const observer =
                new MutationObserver(() => {

                    this.applyFloatLayout();

                });

            const start = () => {

                observer.observe(
                    document.documentElement,
                    {
                        childList: true,
                        subtree: true
                    }
                );

                this.applyFloatLayout();

            };

            if (
                document.readyState ===
                'loading'
            ) {
                document.addEventListener(
                    'DOMContentLoaded',
                    start,
                    { once: true }
                );
            } else {
                start();
            }

            /*
             * React can replace large portions of the
             * page without changing our <style>.
             *
             * Keep the title updated too.
             */

            setInterval(() => {

                this.applyFloatLayout();

                this.updateFloatTitle();

            }, 1000);
        },

// ---- addons/float/style.js ----
        installFloatStyles() {

            if (
                document.getElementById(
                    'float-addon-style'
                )
            ) {
                return;
            }

            const style =
                document.createElement(
                    'style'
                );

            style.id =
                'float-addon-style';

            style.textContent = `
	                div[class="x9f619 x2lah0s x1nhvcw1 x1qjc9v5 xozqiw3 x1q0g3np x78zum5 x1iyjqo2 x5yr21d x1t2pt76 x1n2onr6 x1ja2u2z x1k6qp8s"]
	                {
	                	height: 100vh !important
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
	                div[class="html-div xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x9f619 xjbqb8w x78zum5 x15mokao x1ga7v0g x16uus16 xbiv7yw xixxii4 x1ey2m1c x1plvlek xryxfnj x1c4vz4f x2lah0s xdt5ytf xqjyukv x1qjc9v5 x1oa3qoh x1nhvcw1 xg7h5cd xh8yej3 xhtitgo x6w1myc x1jeouym"]
	                {
	                	display: none
	                }
            `;

            document.head.appendChild(
                style
            );
        },


        /*
         * =========================================================
         * APPLY FLOAT LAYOUT
         * =========================================================
         */

        applyFloatLayout() {

            if (!this.isFloatWindow)
                return;

            /*
             * Hide navigation.
             */

            document
                .querySelectorAll('nav')
                .forEach(nav => {

                    nav.style.setProperty(
                        'display',
                        'none',
                        'important'
                    );

                });

            /*
             * Hide the message composer by
             * walking up from the textarea.
             */

            const textarea =
                document.querySelector(
                    'textarea[placeholder="Message..."]'
                );

            if (textarea) {

                textarea.style.setProperty(
                    'display',
                    'none',
                    'important'
                );

                /*
                 * Walk upward to hide the composer
                 * container without touching the
                 * conversation itself.
                 */

                let parent =
                    textarea.parentElement;

                for (
                    let i = 0;
                    i < 6 && parent;
                    i++
                ) {

                    /*
                     * Stop if the parent becomes huge.
                     * We don't want to accidentally hide
                     * the whole conversation.
                     */

                    const rect =
                        parent.getBoundingClientRect();

                    if (
                        rect.height > 150
                    ) {
                        break;
                    }

                    parent.style.setProperty(
                        'display',
                        'none',
                        'important'
                    );

                    parent =
                        parent.parentElement;
                }
            }

        },

// ---- addons/float/title.js ----
        updateFloatTitle() {

            if (!this.isFloatWindow)
                return;

            const name =
                this.getChatName();

            if (!name)
                return;

            document.title =
                'Float — ' + name;
        },


        getChatName() {


            const infoIcon =
                document.querySelector(
                    'svg[aria-label="Conversation information"]'
                );

            if (!infoIcon)
                return null;

            let node =
                infoIcon.parentElement;

            for (
                let i = 0;
                i < 8 && node;
                i++
            ) {

                const text =
                    node.innerText
                        ?.trim();

                if (
                    text &&
                    text.length > 0 &&
                    text.length < 150
                ) {

                    const lines =
                        text
                            .split('\n')
                            .map(
                                x => x.trim()
                            )
                            .filter(Boolean);

                    if (lines.length)
                        return lines[0];
                }

                node =
                    node.parentElement;
            }

            return null;
        }
    };


// ---- addons/float/start.js ----
if (IM.isEnabled('float')) {
    Float.init();
}

// ---- end.js ----
})();

