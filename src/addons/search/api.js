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
    // ---------------------------------------------------------------------

    const IM_THREAD_ID_CACHE = new Map(); // url thread-key -> resolved numeric thread id

    function im_currentThreadKey() {
        const match = location.pathname.match(/\/direct\/t\/([^/]+)/);
        return match ? match[1] : null;
    }

    function im_captureThreadIdFromText(text) {
        const key = im_currentThreadKey();
        if (!key || IM_THREAD_ID_CACHE.has(key)) return;
        const match = text.match(/"thread_id"\s*:\s*"(\d{10,})"/) || text.match(/"thread_igid"\s*:\s*"(\d{10,})"/);
        if (match) IM_THREAD_ID_CACHE.set(key, match[1]);
    }

    IMSearch.watchForThreadId = function watchForThreadId() {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
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
