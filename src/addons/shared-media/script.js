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

    // ---- Persistent per-thread cache ---------------------------------------
    //
    // Instagram virtualizes the message list -- once a message scrolls far
    // enough out of view, its DOM node (and any image inside it) gets
    // unmounted entirely, not just hidden. A plain re-scan of the live DOM
    // would "lose" media that was found a moment ago just because the
    // person scrolled past it. This cache accumulates everything ever found
    // for a given thread instead, so items only ever get added, never
    // dropped by scrolling.
    //
    // It's purely passive: there's no button that drives Instagram's own
    // scroll container to force-load history (that turned out unreliable
    // in practice -- Instagram's lazy-load didn't respond to programmatic
    // scrolling here). Instead, the cache just keeps whatever's rendered
    // each time this runs, growing naturally as the person scrolls the
    // chat themselves in the course of normal use, and persists across
    // page reloads via GM storage so it isn't lost either. A "Clear cache"
    // button (src/core/ui.js) resets it for the current thread.
    const IM_MEDIA_CACHE_PREFIX = 'instamate.sharedmedia.';
    const IM_MEDIA_CACHE = new Map(); // threadPath -> Map(src -> item), in-memory mirror of GM storage for this session

    function im_mediaCacheKeyForCurrentThread() {
        return IM_MEDIA_CACHE_PREFIX + location.pathname;
    }

    function im_mediaCacheForCurrentThread() {
        const pathKey = location.pathname;
        if (IM_MEDIA_CACHE.has(pathKey)) return IM_MEDIA_CACHE.get(pathKey);

        const map = new Map();
        if (im_gmAvailable()) {
            try {
                const stored = JSON.parse(GM_getValue(im_mediaCacheKeyForCurrentThread(), '[]'));
                stored.forEach((item) => map.set(item.src || item.poster, item));
            } catch {
                /* corrupt/missing stored value -- start fresh */
            }
        }
        IM_MEDIA_CACHE.set(pathKey, map);
        return map;
    }

    function im_persistMediaCache(cache) {
        if (!im_gmAvailable()) return;
        try {
            GM_setValue(im_mediaCacheKeyForCurrentThread(), JSON.stringify([...cache.values()]));
        } catch {
            /* storage unavailable/full -- cache still works for this session, just won't persist */
        }
    }

    function im_clearMediaCacheForCurrentThread() {
        IM_MEDIA_CACHE.set(location.pathname, new Map());
        if (im_gmAvailable()) {
            try {
                GM_setValue(im_mediaCacheKeyForCurrentThread(), '[]');
            } catch {
                /* ignore */
            }
        }
    }

    function im_collectSharedMedia() {
        if (!location.pathname.startsWith('/direct/t/')) return [];

        const cache = im_mediaCacheForCurrentThread();
        const threadListContainer = im_findThreadListContainer();
        const sizeBefore = cache.size;

        document.querySelectorAll('img').forEach((img) => {
            if (!im_isLikelyAttachment(img, threadListContainer)) return;
            const src = img.currentSrc || img.src;
            if (!src || cache.has(src)) return;
            cache.set(src, { type: 'image', src });
        });

        document.querySelectorAll('video').forEach((video) => {
            if (threadListContainer && threadListContainer.contains(video)) return;
            if (IM_POST_REEL_HREF.test(video.closest('a[href]')?.href || '')) return;

            const src = video.currentSrc || video.src || video.querySelector('source')?.src || '';
            const poster = video.poster || '';
            const key = src || poster;
            if (!key || cache.has(key)) return;
            if (im_hostnameCategory(key) === 'sticker') return;
            cache.set(key, { type: 'video', src, poster });
        });

        if (cache.size !== sizeBefore) im_persistMediaCache(cache);

        return [...cache.values()];
    }

    // ---- Settings-popup section --------------------------------------------
    //
    // Registers this addon's own UI (media grid + Clear cache button) with
    // the core settings popup instead of src/core/ui.js hardcoding it --
    // see im_registerPanelSection there. Means this addon's UI lives
    // entirely in this file: removing this addon (deleting this file from
    // the build) removes its section from the popup automatically, no
    // edits needed in ui.js.
    if (typeof im_registerPanelSection === 'function') {
        im_registerPanelSection({
            mount(panel) {
                const title = document.createElement('div');
                title.className = 'im-section-title';
                title.textContent = 'Shared Media \u2014 this chat';
                const note = document.createElement('div');
                note.className = 'im-row-desc';
                note.style.padding = '0 18px 10px';
                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:0 18px 10px;';
                // Instagram's own brand red, full-width to read as part of
                // the native settings surface rather than a bolted-on
                // extension button.
                const clearCacheBtn = document.createElement('button');
                clearCacheBtn.textContent = 'Clear cache';
                clearCacheBtn.style.cssText = 'display:block;width:100%;margin:0 0 14px;padding:10px 18px;border:none;background:#ED4956;color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
                panel.append(title, note, grid, clearCacheBtn);

                function renderItems() {
                    const items = im_collectSharedMedia();
                    grid.innerHTML = '';
                    note.textContent = items.length === 0
                        ? 'Nothing cached yet -- media appears here as you scroll through the chat.'
                        : `${items.length} item${items.length === 1 ? '' : 's'} cached.`;
                    items.forEach((item) => {
                        const thumb = document.createElement('a');
                        thumb.href = item.src || item.poster;
                        thumb.target = '_blank';
                        thumb.rel = 'noopener noreferrer';
                        thumb.style.cssText = 'display:block;aspect-ratio:1;border-radius:6px;overflow:hidden;background:rgba(0,0,0,.15);';
                        const img = document.createElement('img');
                        img.src = item.type === 'video' ? (item.poster || item.src) : item.src;
                        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
                        thumb.append(img);
                        grid.append(thumb);
                    });
                }

                // Cache persists across reloads (im_clearMediaCacheForCurrentThread
                // above) -- this is the only way to reset it for the
                // currently open chat.
                clearCacheBtn.addEventListener('click', () => {
                    im_clearMediaCacheForCurrentThread();
                    renderItems();
                });

                return function refresh() {
                    const inThread = location.pathname.startsWith('/direct/t/');
                    title.classList.toggle('im-hidden', !inThread);
                    note.classList.toggle('im-hidden', !inThread);
                    grid.classList.toggle('im-hidden', !inThread);
                    clearCacheBtn.classList.toggle('im-hidden', !inThread);
                    if (!inThread) return;
                    renderItems();
                };
            },
        });
    }
