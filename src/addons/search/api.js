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
    // Message search is NOT wired up yet. Instagram's DM search-within-
    // conversation almost certainly runs through a GraphQL call keyed by a
    // numeric `doc_id` (a persisted-query identifier) rather than a plain
    // REST path -- those ids aren't derivable from the endpoint shape, they
    // have to be read off a real request. Guessing one wrong doesn't just
    // fail cleanly, it can send a malformed query to Instagram's backend.
    //
    // To wire this up for real: open DevTools -> Network -> XHR, use
    // Instagram's own message-search (the magnifying glass in a DM's
    // header searches within that conversation), and send over:
    //   1. the full request URL
    //   2. the request payload/variables (if it's a POST/GraphQL call)
    //   3. a sample of the response JSON shape
    // Same approach that nailed down the CDN hostname patterns and the
    // shared-post-card structure earlier in this project -- once we have
    // one real example, this gets filled in precisely instead of guessed.
    // ---------------------------------------------------------------------
    IMSearch.searchMessages = async function searchMessages(query) {
        void query;
        return { pending: true };
    };
