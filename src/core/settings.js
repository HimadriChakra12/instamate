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

    // Runs at document-start, where document.head may not exist yet (the
    // parser hasn't reached the <head> tag). A raw document.head.appendChild
    // would throw in that case -- and since every file here shares one
    // top-level IIFE with no try/catch, that exception could kill every
    // other feature's initialization for the rest of that page load, not
    // just the style injection. Falls back to documentElement (created
    // earlier than head in virtually every case), and as a last resort
    // waits via MutationObserver for the earliest possible moment either
    // exists -- so this stays just as fast in the normal case while never
    // being able to crash the rest of the script in the rare one.
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
            description: 'Discord-style search overlay for people, with a Messages section pending a wired-up endpoint.',
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
