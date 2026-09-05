// ---------------------------------------------------------------------------
    // Shared Media (addon, permanent -- see src/core/settings.js IM_ADDONS)
    //
    // Instagram web has no equivalent of the mobile app's "shared media"
    // gallery for a chat, so this rebuilds a rough one client-side: scan the
    // photos/videos currently rendered in the *open* thread and hand them
    // back as a de-duplicated list. src/core/ui.js renders that list as a
    // grid inside the settings popup.
    //
    // Scope: only the currently-open conversation, not the whole page.
    // A naive `document.querySelectorAll('img')` also picks up thumbnails
    // from the conversation list on the left (every other DM's preview
    // avatar/last-shared-image), which has nothing to do with "this chat".
    // We find that conversation-list container -- it's identifiable by
    // holding several `a[href^="/direct/t/"]` links, one per conversation --
    // and exclude everything inside it before scanning for media.
    //
    // Filtering: only actual photo/video message attachments should show up
    // here -- not avatars/profile pictures, not shared posts/reels (those
    // are attachments *of* a post, not something someone actually sent as a
    // photo/video), not link-preview thumbnails, not stickers/emoji. We
    // filter by:
    //   - size (avatars/stickers/emoji are small)
    //   - shape (profile pictures render circular; real photo/video
    //     attachments never do -- checked via computed border-radius rather
    //     than alt text, which Instagram doesn't always set consistently)
    //   - alt text, as a second signal alongside the shape check
    //   - ancestry: an instagram.com/p/, /reel/, /reels/, or /tv/ link means
    //     it's a shared post/reel, not a raw attachment; an off-instagram
    //     link wrapping a single image alongside title text is a
    //     link-preview card
    //
    // Caveat, unavoidable from a userscript: Instagram only renders messages
    // that have scrolled into view, loading older history lazily as you
    // scroll up. This only ever sees what's currently loaded -- scroll to
    // the top of the chat first for a fuller list, then reopen the popup.
    // ---------------------------------------------------------------------------

    // Confirmed from real markup: Instagram's own profile-picture <img>
    // uses alt="user-profile-picture" (hyphenated, not "Profile picture for
    // <name>" as originally guessed) -- and its host was
    // scontent.<code>.fna.fbcdn.net, i.e. a *scontent* host, same family as
    // real photo/video attachments. So hostname alone can't tell a profile
    // picture apart from a sent photo; "scontent" only rules out the
    // generic sticker/static CDN hosts, it doesn't confirm "this is a real
    // attachment". Alt text and shape are the checks that actually catch
    // profile pictures, so they always run -- hostname is a fast path for
    // excluding stickers only, never a shortcut to skip the other checks.
    const IM_PROFILE_PIC_HINTS = /profile[\s-]?picture|avatar|story ring/i;
    const IM_POST_REEL_HREF = /instagram\.com\/(p|reel|reels|tv)\//i;

    // The left-hand conversation list is made of several `a[href^="/direct/t/"]`
    // (one per conversation, each pointing at a *different* thread id) sitting
    // in a shared container -- that container is the thing to exclude.
    // Re-derived on each call rather than cached, since Instagram may
    // remount it between renders.
    function im_findThreadListContainer() {
        const threadLinks = [...document.querySelectorAll('a[href^="/direct/t/"]')];
        if (threadLinks.length < 2) return null;

        const hits = new Map();
        threadLinks.forEach((link) => {
            let node = link.parentElement;
            for (let i = 0; i < 6 && node; i++) {
                hits.set(node, (hits.get(node) || 0) + 1);
                node = node.parentElement;
            }
        });

        let best = null;
        let bestCount = 1;
        for (const [node, count] of hits) {
            if (count > bestCount) {
                bestCount = count;
                best = node;
            }
        }
        return best;
    }

    // Instagram serves different image categories off visibly different
    // CDN hostnames:
    //   - actual sent photos/videos:  scontent*.cdninstagram.com / scontent*.fbcdn.net
    //   - profile pictures/avatars:   instagram.<code>.fna.fbcdn.net (no "scontent")
    //   - stickers/emoji/UI assets:   generic cdn hosts, e.g. static.cdninstagram.com
    // This is a much more reliable signal than shape/alt-text guessing, so
    // it's checked first; the older heuristics stay on as a fallback for
    // any URL pattern that doesn't clearly match one of these.
    function im_hostnameCategory(src) {
        let host = '';
        try {
            host = new URL(src, location.href).hostname;
        } catch {
            return 'unknown';
        }
        // Generic/static CDN hosts (not scontent-prefixed) are reliably
        // stickers/emoji/UI chrome, not user-sent media or profile
        // pictures -- this direction is safe to trust outright.
        if (/(^|\.)cdninstagram\.com$/i.test(host) || /^cdn\./i.test(host) || /static\./i.test(host)) return 'sticker';
        return 'unknown'; // scontent/fbcdn hosts serve both photos AND profile pictures -- can't tell from hostname alone
    }

    function im_isCircularAvatar(img) {
        const radius = getComputedStyle(img).borderRadius || '';
        if (radius.includes('%')) {
            return parseFloat(radius) >= 40;
        }
        if (radius.endsWith('px')) {
            const px = parseFloat(radius);
            const w = img.naturalWidth || img.width || 0;
            return w > 0 && px >= w / 2 - 2;
        }
        return false;
    }

    // Second, independent signal for "this is a conversation-list preview
    // row, not the open thread" -- catches cases where
    // im_findThreadListContainer can't find a shared container (e.g. only
    // one other conversation is loaded, so its "2+ thread links share a
    // parent" heuristic never fires). Conversation-list rows have a
    // recognizable text fingerprint regardless of container structure:
    // a relative timestamp like "2d" via <abbr aria-label="... ago">, often
    // paired with a "reacted ... to your message" / "sent you a message" /
    // "Pinned" style preview line. Real message-thread content doesn't look
    // like this.
    // A post shared *into* a chat (forwarded from someone's profile) isn't
    // wrapped in an /p/ or /reel/ permalink like a normal post link would
    // be -- the big image sits inside a plain `div[role="button"]`, not an
    // anchor at all. What it does always have nearby is a link to the
    // original poster's bare profile (e.g. href="/emusabbir01/") plus a
    // repeated "<username> <caption>" text line below the image. That
    // combination -- not any single element -- is the reliable signal.
    const IM_BARE_USERNAME_PATH = /^\/[A-Za-z0-9_.]{1,30}\/?$/;

    function im_isSharedPostCard(img) {
        if (!img.closest('div[role="button"]')) return false; // real sent photos aren't wrapped this way

        let node = img.closest('div');
        for (let i = 0; i < 8 && node; i++) {
            const profileLink = [...node.querySelectorAll('a[href]')].find((a) => {
                try {
                    const path = new URL(a.getAttribute('href'), location.origin).pathname;
                    return IM_BARE_USERNAME_PATH.test(path) && !path.startsWith('/direct') && path !== '/';
                } catch {
                    return false;
                }
            });
            if (profileLink) return true;
            node = node.parentElement;
        }
        return false;
    }

    // Reels shared into a chat use the same role="button" + bare-profile-
    // link card structure as shared posts, but always carry one extra,
    // very specific tell: an overlay svg labeled "Clip" (Instagram's own
    // internal name for a Reel) on top of the thumbnail. Checking for that
    // directly is more reliable than leaning on im_isSharedPostCard alone,
    // since a reel share doesn't always have caption text below it the way
    // a post share does.
    function im_isReelShareCard(img) {
        let node = img.closest('div');
        for (let i = 0; i < 4 && node; i++) {
            if (node.querySelector('svg[aria-label="Clip" i]')) return true;
            node = node.parentElement;
        }
        return false;
    }

    function im_isChatListPreviewRow(img) {
        let node = img.closest('div');
        for (let i = 0; i < 6 && node; i++) {
            if (node.querySelector('abbr[aria-label$="ago" i]')) return true;
            const text = node.textContent || '';
            if (/reacted .* to your message|sent you a message|you sent/i.test(text)) return true;
            node = node.parentElement;
        }
        return false;
    }

    function im_isLikelyAttachment(img, threadListContainer) {
        if (threadListContainer && threadListContainer.contains(img)) return false; // other conversations' previews
        if (im_isChatListPreviewRow(img)) return false; // conversation-list row that slipped past the container check
        if (im_isSharedPostCard(img)) return false; // forwarded post/reel card, not a raw sent photo
        if (im_isReelShareCard(img)) return false; // shared reel (has the "Clip" overlay icon)

        const src = img.currentSrc || img.src;
        if (im_hostnameCategory(src) === 'sticker') return false;

        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w < 80 || h < 80) return false; // avatars/emoji/small icons

        if (IM_PROFILE_PIC_HINTS.test(img.alt || '')) return false;
        if (im_isCircularAvatar(img)) return false; // profile pictures render circular; real attachments don't

        const link = img.closest('a[href]');
        if (link) {
            if (IM_POST_REEL_HREF.test(link.href)) return false; // shared post/reel, not a raw sent photo/video

            if (!link.href.includes('instagram.com')) {
                // Off-instagram link-preview card: single thumbnail plus a
                // title/description block as a sibling.
                const hasCardText = link.querySelector('div,span')?.textContent?.trim().length > 0 &&
                    link.querySelectorAll('img').length === 1 &&
                    link.parentElement?.textContent?.trim().length > (link.textContent?.trim().length || 0);
                if (hasCardText) return false;
            }
        }

        if (img.closest('[aria-label*="sticker" i], [aria-label*="reaction" i]')) return false;

        return true;
    }

    // ---- Auto-scroll history loader ----------------------------------------
    //
    // Instagram only renders messages that have scrolled into view and
    // lazy-loads older ones as you scroll up -- normally that means the
    // gallery only ever sees whatever the person happened to have scrolled
    // through already. Since manually scrolling isn't always practical,
    // this drives the *real* message thread's own scroll container to the
    // top repeatedly, letting Instagram's own lazy-load kick in each time,
    // until either the content stops growing (reached the start of the
    // conversation) or a round cap sized for roughly 200 messages is hit --
    // whichever comes first.

    // The message thread's scroll container is whichever scrollable element
    // holds real content and isn't the conversation-list sidebar (that one
    // is also scrollable, but it's a different container -- see
    // im_findThreadListContainer above).
    function im_findMessageScrollContainer() {
        const threadList = im_findThreadListContainer();
        const candidates = [...document.querySelectorAll('div')].filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') return false;
            return el.scrollHeight > el.clientHeight + 40; // actually has more content than fits
        }).filter((el) => !(threadList && (threadList === el || threadList.contains(el) || el.contains(threadList))));

        if (candidates.length === 0) return null;
        // The message thread is virtually always the tallest/scrolliest
        // candidate left once the sidebar is excluded.
        candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
        return candidates[0];
    }

    let im_autoLoadRunning = false;

    // Rounds are sized generously for ~200 messages: Instagram typically
    // renders a batch of a dozen-plus messages per lazy-load trigger, so 40
    // rounds comfortably covers that range even on a slow-loading chat --
    // but the plateau check below almost always stops it well before that,
    // once there's nothing older left to load.
    async function im_autoLoadHistory({ maxRounds = 40, onProgress } = {}) {
        if (im_autoLoadRunning) return;
        const container = im_findMessageScrollContainer();
        if (!container) return;

        im_autoLoadRunning = true;
        let lastHeight = -1;
        let stableRounds = 0;

        try {
            for (let i = 0; i < maxRounds; i++) {
                container.scrollTop = 0;
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve) => setTimeout(resolve, 500));

                if (container.scrollHeight === lastHeight) {
                    stableRounds++;
                    if (stableRounds >= 2) break; // two flat rounds in a row -- nothing older left to load
                } else {
                    stableRounds = 0;
                }
                lastHeight = container.scrollHeight;
                onProgress?.(i + 1, maxRounds);
            }
        } finally {
            im_autoLoadRunning = false;
        }
    }

    function im_collectSharedMedia() {
        if (!location.pathname.startsWith('/direct/t/')) return [];

        const threadListContainer = im_findThreadListContainer();
        const seen = new Set();
        const items = [];

        document.querySelectorAll('img').forEach((img) => {
            if (!im_isLikelyAttachment(img, threadListContainer)) return;
            const src = img.currentSrc || img.src;
            if (!src || seen.has(src)) return;
            seen.add(src);
            items.push({ type: 'image', src });
        });

        document.querySelectorAll('video').forEach((video) => {
            if (threadListContainer && threadListContainer.contains(video)) return;
            if (IM_POST_REEL_HREF.test(video.closest('a[href]')?.href || '')) return;

            const src = video.currentSrc || video.src || video.querySelector('source')?.src || '';
            const poster = video.poster || '';
            const key = src || poster;
            if (!key || seen.has(key)) return;
            if (im_hostnameCategory(key) === 'sticker') return;
            seen.add(key);
            items.push({ type: 'video', src, poster });
        });

        return items;
    }
