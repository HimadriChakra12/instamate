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
            key: 'reelsramsaver',
            label: 'Reels RAM Saver',
            description: 'Unloads off-screen Reels videos so long scrolling sessions stay light on memory.',
        },
        {
            key: 'msgname',
            label: 'DM Tab Title',
            description: "Shows who you're messaging in the browser tab title instead of just \"Instagram\".",
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
            key: 'idviewer',
            label: 'Instagram ID Viewer',
            description: 'View ID of user instagram',
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
