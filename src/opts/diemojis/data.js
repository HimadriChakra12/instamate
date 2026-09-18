    // ---------------------------------------------------------------------
    // Instamate diemojis: emoji data sourcing + persistent cache
    //
    // Three tiers, in priority order (a higher tier's data, once captured,
    // is never overwritten by a lower one):
    //
    //   3. instagram -- passively sniffed out of Instagram's own network
    //      traffic. Best-effort / UNCONFIRMED: Instagram's own emoji
    //      picker has a keyword search, so its data almost certainly ships
    //      as a JSON blob somewhere in the app's own requests, but we
    //      don't have a captured HAR pinning down the exact endpoint --
    //      so this just watches every response for the iamcal/emoji-mart
    //      style shape most emoji datasets share (Meta included,
    //      historically) and adopts it if seen. If it never fires, tier 2
    //      quietly carries the whole feature -- nothing else depends on
    //      this succeeding.
    //   2. thirdparty -- a well-known public emoji dataset (emoji.json,
    //      mirrored on jsDelivr, which serves it with permissive CORS --
    //      no GM_xmlhttpRequest/@connect needed, a plain fetch works).
    //   1. builtin -- ~40 emoji bundled directly in this file. Used
    //      instantly on first-ever run before either fetch above has had
    //      a chance to land, and as the last-resort floor if the user has
    //      no network access to either source.
    //
    // Fetching only ever happens once per page load (IMEmoji.init(), called
    // from launch.js at startup, gated by IM.isEnabled('diemojis') there --
    // this file itself defines things unconditionally since a function
    // declaration has no side effects on its own). The popup always reads
    // whatever is already sitting in IMEmoji.list; a background refresh
    // just updates that array (and the persisted cache) in place for next
    // time -- never mid-typing.
    // ---------------------------------------------------------------------

    const IM_EMOJI_CACHE_KEY = 'instamate.diemojis.cache.v1';
    const IM_EMOJI_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // re-check weekly
    const IM_EMOJI_TIER_RANK = { builtin: 1, thirdparty: 2, instagram: 3 };

    // codepoint(s) rather than literal glyphs, so this stays plain ASCII
    // source -- easier to diff/edit than raw emoji bytes.
    const IM_EMOJI_BUILTIN_RAW = [
        ['smile', [0x1F604]], ['laughing', [0x1F606]], ['joy', [0x1F602]],
        ['rofl', [0x1F923]], ['wink', [0x1F609]], ['heart_eyes', [0x1F60D]],
        ['thinking', [0x1F914]], ['cry', [0x1F622]], ['sob', [0x1F62D]],
        ['angry', [0x1F620]], ['scream', [0x1F631]], ['sleeping', [0x1F634]],
        ['confused', [0x1F615]], ['neutral_face', [0x1F610]], ['smirk', [0x1F60F]],
        ['grin', [0x1F601]], ['kiss', [0x1F618]], ['sunglasses', [0x1F60E]],
        ['sweat_smile', [0x1F605]], ['thumbsup', [0x1F44D]], ['thumbsdown', [0x1F44E]],
        ['clap', [0x1F44F]], ['pray', [0x1F64F]], ['wave', [0x1F44B]],
        ['ok_hand', [0x1F44C]], ['muscle', [0x1F4AA]], ['raised_hands', [0x1F64C]],
        ['fire', [0x1F525]], ['100', [0x1F4AF]], ['eyes', [0x1F440]],
        ['tada', [0x1F389]], ['heart', [0x2764]], ['broken_heart', [0x1F494]],
        ['poop', [0x1F4A9]], ['skull', [0x1F480]], ['ghost', [0x1F47B]],
        ['alien', [0x1F47D]], ['robot', [0x1F916]], ['rocket', [0x1F680]],
        ['star', [0x2B50]], ['sparkles', [0x2728]], ['rainbow', [0x1F308]],
        ['sun', [0x2600]], ['moon', [0x1F319]], ['zzz', [0x1F4A4]],
        ['check_mark', [0x2705]], ['x', [0x274C]], ['question', [0x2753]],
        ['exclamation', [0x2757]], ['warning', [0x26A0]], ['gear', [0x2699]],
    ];

    function im_codepointsToChar(codepoints) {
        return String.fromCodePoint(...codepoints);
    }

    const IM_EMOJI_BUILTIN = IM_EMOJI_BUILTIN_RAW.map(([shortcode, codepoints]) => ({
        shortcode,
        char: im_codepointsToChar(codepoints),
    }));

    const IMEmoji = {
        list: IM_EMOJI_BUILTIN, // always something to match against, even pre-cache
        source: 'builtin',
        ready: false,
    };

    function im_readEmojiCache() {
        try {
            const raw = (typeof GM_getValue === 'function')
                ? GM_getValue(IM_EMOJI_CACHE_KEY, null)
                : localStorage.getItem(IM_EMOJI_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.entries)) return null;
            return parsed;
        } catch {
            return null;
        }
    }

    function im_writeEmojiCache(source, entries) {
        const payload = JSON.stringify({ source, ts: Date.now(), entries });
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(IM_EMOJI_CACHE_KEY, payload);
            } else {
                localStorage.setItem(IM_EMOJI_CACHE_KEY, payload);
            }
        } catch {
            /* storage unavailable -- this run still has it in memory via im_adoptEmojiData */
        }
    }

    // Only ever moves *up* in priority (or refreshes same-tier data);
    // tier 2 finishing after tier 3 already landed must not clobber it.
    function im_adoptEmojiData(source, entries, opts) {
        const persist = !opts || opts.persist !== false;
        if (!entries || entries.length === 0) return false;
        const incomingRank = IM_EMOJI_TIER_RANK[source] || 0;
        const currentRank = IM_EMOJI_TIER_RANK[IMEmoji.source] || 0;
        if (IMEmoji.ready && incomingRank < currentRank) return false;

        IMEmoji.list = entries;
        IMEmoji.source = source;
        IMEmoji.ready = true;
        if (persist) im_writeEmojiCache(source, entries);
        return true;
    }

    // ---- tier 2: thirdparty ------------------------------------------------

    async function im_fetchThirdPartyEmoji() {
        try {
            // emoji.json (github.com/amio/emoji.json), served via jsDelivr's
            // npm mirror -- CORS-open by default, so no GM_xmlhttpRequest /
            // @connect entry needed for this one.
            const response = await fetch('https://cdn.jsdelivr.net/npm/emoji.json@15.0.0/emoji.json');
            if (!response.ok) return null;
            const data = await response.json();
            if (!Array.isArray(data)) return null;

            const entries = data
                .filter((e) => e && e.char && e.name)
                .map((e) => ({
                    shortcode: String(e.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
                    char: e.char,
                }))
                .filter((e) => e.shortcode);

            return entries.length > 0 ? entries : null;
        } catch {
            return null; // offline, CDN unreachable, blocked -- tier 1/builtin still cover us
        }
    }

    // ---- tier 3: instagram (best-effort, unconfirmed) ----------------------
    //
    // Watches responses Instagram's own page already makes (same
    // passive-capture pattern as the search addon's thread-id sniffing) for
    // a JSON shape matching the iamcal/emoji-mart dataset convention:
    // objects carrying `unified` (hex codepoint string) plus a
    // `short_name`/`short_names` field. That shape is what Meta's own
    // properties have shipped historically for emoji pickers, but this has
    // not been confirmed against a live captured request -- if it never
    // matches, tier 2 already has the feature fully covered.
    let im_instagramEmojiSniffDone = false;

    function im_tryParseInstagramEmojiShape(text) {
        if (im_instagramEmojiSniffDone) return;
        if (text.length < 200 || text.indexOf('short_name') === -1) return;
        im_instagramEmojiSniffDone = true; // one honest attempt is enough either way

        try {
            const data = JSON.parse(text);
            const pool = Array.isArray(data) ? data : Object.values(data || {});
            const entries = [];

            for (const item of pool) {
                if (!item || typeof item !== 'object') continue;
                const unified = item.unified;
                const name = item.short_name || (Array.isArray(item.short_names) && item.short_names[0]);
                if (!unified || !name) continue;
                try {
                    const codepoints = String(unified).split('-').map((h) => parseInt(h, 16));
                    entries.push({ shortcode: String(name).toLowerCase(), char: im_codepointsToChar(codepoints) });
                } catch {
                    /* malformed entry -- skip just this one */
                }
            }

            if (entries.length > 20) im_adoptEmojiData('instagram', entries);
        } catch {
            /* not actually JSON, or not this shape -- fine, this was a guess */
        }
    }

    function im_watchForInstagramEmojiData() {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
            const response = await originalFetch(input, init);
            if (!im_instagramEmojiSniffDone) {
                response.clone().text().then(im_tryParseInstagramEmojiShape).catch(() => {});
            }
            return response;
        };
    }

    // ---- boot ---------------------------------------------------------------
    //
    // Called once from launch.js, itself gated on IM.isEnabled('diemojis')
    // -- nothing in this file runs any work just from being defined.

    IMEmoji.init = function init() {
        const cached = im_readEmojiCache();
        if (cached) {
            im_adoptEmojiData(cached.source, cached.entries, { persist: false });
        }

        const stale = !cached || (Date.now() - cached.ts) > IM_EMOJI_CACHE_MAX_AGE_MS;
        if (stale) {
            // Fire-and-forget, once, at load -- never re-triggered by typing.
            im_fetchThirdPartyEmoji().then((entries) => { if (entries) im_adoptEmojiData('thirdparty', entries); });
        }

        im_watchForInstagramEmojiData();
    };

    IMEmoji.match = function match(query, limit) {
        const cap = limit || 50;
        const q = query.toLowerCase();
        if (!q) return [];
        const starts = [];
        const includes = [];
        for (const entry of IMEmoji.list) {
            if (entry.shortcode === q) starts.unshift(entry);
            else if (entry.shortcode.startsWith(q)) starts.push(entry);
            else if (entry.shortcode.includes(q)) includes.push(entry);
            if (starts.length + includes.length > cap * 3) break; // don't scan a huge list forever
        }
        return starts.concat(includes).slice(0, cap);
    };

    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.__instamateDiemojis__ = IMEmoji;
    }
