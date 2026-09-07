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
    // Message search is a placeholder for now -- see api.js for exactly
    // why and what's needed to wire it up for real, rather than guessing
    // at an endpoint that might silently misbehave.
    //
    // Structured like Float/Security/InstaSnap: this file defines the
    // shared `IMSearch` object; the other files attach methods to it;
    // launch.js kicks it off behind the opt's isEnabled() check.
    const IMSearch = {
        overlayOpen: false,
        debounceTimer: null,
        debounceMs: 250, // avoid hammering Instagram's endpoint on every keystroke

        init() {
            // Firefox binds Ctrl+K to focusing its own toolbar search bar
            // by default -- but that's a page-overridable binding, not a
            // hard-reserved one (Ctrl+T/Ctrl+W/Ctrl+N and a handful of
            // others aren't overridable by any web page; this one is,
            // which is exactly how Spotify/Slack/Notion/GitHub all
            // successfully claim Ctrl+K in Firefox too). Winning that race
            // means: listen on `window` (broadest target), in the capture
            // phase (`true` -- runs top-down, before any bubble-phase
            // listener anywhere else on the page gets a chance), and call
            // preventDefault + stopPropagation synchronously and
            // immediately, before doing anything else. Registered at
            // document-start (as early in the page's life as a userscript
            // can run) so nothing else has a chance to grab the key first.
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
