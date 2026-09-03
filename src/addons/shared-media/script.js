    // ---------------------------------------------------------------------------
    // Shared Media (addon, permanent -- see src/core/settings.js IM_ADDONS)
    //
    // Instagram web has no equivalent of the mobile app's "shared media"
    // gallery for a chat, so this rebuilds a rough one client-side: scan the
    // photos/videos currently rendered in the open thread and hand them back
    // as a de-duplicated list. src/core/ui.js renders that list as a grid
    // inside the settings popup.
    //
    // Caveat, unavoidable from a userscript: Instagram only renders messages
    // that have scrolled into view, loading older history lazily as you
    // scroll up. This only ever sees what's currently loaded -- scroll to the
    // top of the chat first for a fuller list, then reopen the popup.
    // ---------------------------------------------------------------------------

    function im_collectSharedMedia() {
        if (!location.pathname.startsWith('/direct/t/')) return [];

        const seen = new Set();
        const items = [];
        const MIN_SIZE = 80; // skip avatars/emoji/icons, keep actual shared photos

        document.querySelectorAll('img').forEach((img) => {
            const src = img.currentSrc || img.src;
            if (!src || seen.has(src)) return;
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            if (w < MIN_SIZE || h < MIN_SIZE) return;
            seen.add(src);
            items.push({ type: 'image', src });
        });

        document.querySelectorAll('video').forEach((video) => {
            const src = video.currentSrc || video.src || video.querySelector('source')?.src || '';
            const poster = video.poster || '';
            const key = src || poster;
            if (!key || seen.has(key)) return;
            seen.add(key);
            items.push({ type: 'video', src, poster });
        });

        return items;
    }
