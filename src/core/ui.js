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

    let im_sidebarMounted = false;

    function im_tryMountSidebarItem(onClick) {
        if (im_sidebarMounted) return true;

        const el = im_findInstagramHomeIcon();
        if (!el) return false;
        if (el.dataset.instamateHijacked) {
            im_sidebarMounted = true;
            return true;
        }

        el.dataset.instamateHijacked = '1';
        el.setAttribute('aria-label', 'Instamate settings');
        el.title = 'Instamate settings';

        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }, { capture: true });

        im_sidebarMounted = true;
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
        mediaNote.textContent = 'Only shows what\u2019s currently loaded. Scroll to the top of the chat for more, then reopen this.';
        const mediaGrid = document.createElement('div');
        mediaGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0 18px 14px;';
        panel.append(mediaTitle, mediaNote, mediaGrid);

        function refreshMedia() {
            const inThread = location.pathname.startsWith('/direct/t/');
            mediaTitle.classList.toggle('im-hidden', !inThread);
            mediaNote.classList.toggle('im-hidden', !inThread);
            mediaGrid.classList.toggle('im-hidden', !inThread);
            if (!inThread) return;

            const items = typeof im_collectSharedMedia === 'function' ? im_collectSharedMedia() : [];
            mediaGrid.innerHTML = '';
            if (items.length === 0) {
                mediaNote.textContent = 'Nothing loaded yet -- scroll up in the chat, then reopen this.';
                return;
            }
            mediaNote.textContent = 'Only shows what\u2019s currently loaded. Scroll to the top of the chat for more, then reopen this.';
            items.slice(0, 24).forEach((item) => {
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

    // Sidebar renders after Instagram's own app has hydrated, so keep
    // retrying to take over its icon for a while. The Tampermonkey menu
    // command below always works regardless, as a guaranteed fallback.
    im_mountUI();
    const im_sidebarRetry = setInterval(() => {
        im_mountUI();
        if (im_sidebarMounted) clearInterval(im_sidebarRetry);
    }, 1000);
    setTimeout(() => clearInterval(im_sidebarRetry), 30000);

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('\u2699\ufe0f Settings', () => {
            if (!im_openSettings) im_mountUI();
            if (im_openSettings) im_openSettings();
        });
    }
