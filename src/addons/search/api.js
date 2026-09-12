// Instagram's own web client search box calls this exact endpoint --
    // publicly stable for years, unauthenticated-looking but actually
    // relies on the browser's existing session cookies same as every other
    // instagram.com request. `context=blended` is what returns a mix of
    // users/hashtags/places; we only surface the user results here.
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

    // ---------------------------------------------------------------------
    // Message search -- confirmed real via a captured HAR of Instagram's
    // own in-DM search feature:
    //
    //   GET /api/v1/direct_v2/in_thread_message_search/
    //       ?id=<numeric_thread_id>&offset=<n>&query=<text>
    //
    // A plain REST GET, not GraphQL -- no doc_id/fb_dtsg batch machinery
    // needed, just the standard IG headers already used elsewhere in this
    // addon's requests.
    //
    // The one wrinkle: the `id` it wants isn't the thread key from the URL
    // (/direct/t/<key>/) -- it's a different, much longer internal numeric
    // thread id that Instagram's own page embeds in various responses
    // (e.g. as "thread_id" or "thread_igid" in its GraphQL/nav calls).
    // Rather than firing an extra GraphQL request with a rotating doc_id
    // just to resolve that id, this passively captures it from responses
    // Instagram's own page already makes as a side effect of simply having
    // that DM open -- zero extra requests, and it self-heals if Instagram
    // changes how/where that id shows up as long as it's still present
    // *somewhere* in a response body as "thread_id"/"thread_igid".
    //
    // Note: jumping to a specific matched message is handled separately,
    // by driving Instagram's own native in-chat search UI (see
    // jumpToMessageInNativeUI in ui.js) rather than trying to replicate
    // their internal "jump" mechanism here -- that needs React state this
    // addon has no way to reach or fake convincingly.
    // ---------------------------------------------------------------------

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
        // Viewer's own fbid_v2/actorID -- session-wide, not per-thread, so
        // captured once and kept regardless of which conversation this
        // response happened to come from.
        if (!IM_AUTH_TOKENS.actorId) {
            const match = text.match(/"actorID"\s*:\s*"(\d{10,})"/);
            if (match) IM_AUTH_TOKENS.actorId = match[1];
        }
    }

    // fb_dtsg/lsd/jazoest are the anti-forgery tokens Instagram's own
    // GraphQL calls include as POST body params -- not in cookies, so
    // captured the same way as the thread id, just watching what
    // Instagram's own client *sends* instead of what it gets back.
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
                /* response body not text-readable (e.g. binary) -- ignore */
            });
            return response;
        };

        // Instagram's own internal request library uses XMLHttpRequest for
        // these calls (confirmed via DevTools showing them as Type: xhr),
        // not fetch -- the wrapper above alone never sees them at all.
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function open(...args) {
            this.addEventListener('load', () => {
                try {
                    if (typeof this.responseText === 'string') im_captureThreadIdFromText(this.responseText);
                } catch {
                    /* responseText inaccessible for this responseType (e.g. 'blob') -- ignore */
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
            // Not captured yet -- happens if the overlay is opened within
            // the first moment or two of loading a DM, before Instagram's
            // own requests have carried the id through. It resolves itself
            // shortly; nothing to retry manually.
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

    // ---------------------------------------------------------------------
    // Message context -- confirmed real via a captured HAR of clicking a
    // result in Instagram's own in-DM search: it fires two GraphQL calls
    // anchored on the clicked message's mid to fetch the surrounding
    // messages:
    //
    //   IGDMessageListAnchorMessageRangeBeforeOffMsysQuery  (doc_id 27698093573152499)
    //   IGDMessageListAnchorMessageRangeAfterOffMsysQuery   (doc_id 27614839121471969)
    //
    // This replicates those two calls and renders the result in our own
    // overlay -- fully self-contained, no dependency on finding/clicking
    // Instagram's own (fragile, unverified) search UI elements.
    //
    // Deliberately sends a minimal payload: just the fields that plausibly
    // matter for auth/operation (fb_dtsg/lsd/jazoest tokens, doc_id,
    // variables) rather than the huge pile of __dyn/__csr/__hsdp/__hblp
    // batch fields also present in the real request. Those are Meta's
    // client-side "which JS modules are loaded" bloom-filter hints used
    // for response-bundling on their end, not request authorization --
    // an educated guess, not a confirmed fact. If this call gets rejected,
    // that's the first thing to test adding back in.
    // ---------------------------------------------------------------------

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

    // ---------------------------------------------------------------------
    // Conversation list scraping -- backs the # (groups), ! (DMs), and the
    // default recent-conversations view. No confirmed API for "list my
    // conversations" that's simpler than scraping (the real one is a
    // paginated private endpoint we haven't captured), so this reads the
    // sidebar the same way other addons in this project scrape structural
    // DOM (member lists, shared media): find the links to each open
    // conversation and pull title/avatars from around them.
    //
    // Group vs DM is guessed by avatar count in the row (group previews
    // commonly show multiple stacked profile pictures, a 1:1 DM shows
    // one) -- a heuristic, not a certainty, same caveat as every other
    // DOM-scraped feature here.
    // ---------------------------------------------------------------------

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
        // Sidebar order is already most-recent-first in Instagram's own
        // UI, so this is just the first N scraped entries -- no separate
        // "recency" signal needed.
        return this.scrapeConversationList().slice(0, limit);
    };

    // ---------------------------------------------------------------------
    // Following-scoped account search (bare query, no bang) -- unlike @
    // (global topsearch, confirmed real endpoint), this is a best-effort
    // attempt at a private endpoint (GET /api/v1/friendships/<id>/following/
    // with a query param) that historically supported searching within
    // the people you follow. Unlike the other endpoints in this addon,
    // this one hasn't been confirmed against a real captured request --
    // if it 404s or comes back empty when it shouldn't, that's the first
    // thing to verify with an actual HAR capture.
    // ---------------------------------------------------------------------

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
