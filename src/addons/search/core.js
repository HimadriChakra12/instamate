// ---------------------------------------------------------------------------
    // Search (opt -- see src/core/settings.js IM_OPTS)
    //
    // Instagram's own search box is genuinely limited -- no unified view
    // across people and messages, no keyboard-first flow. This adds a
    // Discord-style command-palette overlay (Ctrl/Cmd+K) with live results
    // as you type, combining a People section and a Messages section in
    // one place.
    //
    // People search calls Instagram's own long-stable web endpoint
    // (GET /web/search/topsearch/?query=...&context=blended) -- the exact
    // same request Instagram's own search box makes, just driven from our
    // own UI instead of theirs. Uses the browser's existing session, same
    // as everything else in this project; no different in kind from any
    // other fetch() call already made throughout this codebase.
    //
    // Message search hits Instagram's own in-thread search endpoint
    // (confirmed via a captured HAR of their real search-within-DM
    // feature) -- see api.js for the endpoint and how the internal
    // numeric thread id it needs gets resolved passively.
    //
    // Structured like Float/Security/InstaSnap: this file defines the
    // shared `IMSearch` object; the other files attach methods to it;
    // launch.js kicks it off behind the opt's isEnabled() check.
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

            // Block Instagram's own single-key shortcuts (n, j, l, etc.) while our
            // overlay is open. Registered here at document-start -- like the
            // Ctrl+K listener above -- rather than only when the overlay opens,
            // and on `window` rather than the shadow host. Capture-phase listeners
            // run outer-to-inner (window -> document -> ... -> host), so a
            // listener scoped to the host would only ever run *after* Instagram's
            // own document/window-level capture listeners had already fired. A
            // listener on window that was registered before Instagram's own code
            // loaded wins that race and can stop the event before Instagram's
            // handler ever sees it.
            window.addEventListener('keydown', (event) => {
                if (!this.overlayOpen) return;
                const { key, ctrlKey, metaKey, altKey } = event;
                if (ctrlKey || metaKey || altKey) return;         // browser/our shortcuts
                if (key === 'Escape') return;                     // let our Esc handler run
                if (key === 'Tab' || key.startsWith('Arrow')) return; // navigation
                event.stopPropagation();
                event.stopImmediatePropagation();
            }, true);
        },
    };
