    // ---------------------------------------------------------------------------
    // Story Viewer Search — extracted module
    // Requires: a shadow-root `state.root` (for the modal) already set up by the
    // host script, plus the small state fields listed below. Adjust the
    // `state.*` references to match whatever state object your host script uses.
    // ---------------------------------------------------------------------------
    
    // Expected on your shared `state` object:
    //   state.root              -> ShadowRoot to append modal/backdrop into
    //   state.rootHost           -> host element containing state.root (used for click-outside checks elsewhere)
    //   state.settings.viewerSearch -> boolean toggle
    //   state.storySession       -> session object (managed internally, init to null)
    //   state.focusedIGPInput    -> currently focused custom input (used by shortcut isolation elsewhere)
    
    const UI_FONT = 'Constantia, Cambria, "Times New Roman", serif';
    
    function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    
    function escapeHTML(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }
    
    function isVisible(el) {
      if (!(el instanceof Element)) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    }
    
    function normalizeUsername(value) {
      return String(value || '').trim().replace(/^@/, '').toLocaleLowerCase();
    }
    
    function getProfileUsernameFromHref(href) {
      try {
        const u = new URL(href, location.origin);
        if (u.origin !== location.origin) return null;
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length !== 1) return null;
        const blocked = new Set([
          'accounts', 'direct', 'explore', 'reels', 'stories', 'about-us', 'legal',
          'help', 'web', 'docs', 'api', 'graphql', 'developer', 'privacy', 'terms'
        ]);
        return blocked.has(parts[0].toLowerCase()) ? null : parts[0];
      } catch {
        return null;
      }
    }
    
    // ---------------------------------------------------------------------------
    // Generic Instagram person-row extraction (used to scrape the viewer list)
    // ---------------------------------------------------------------------------
    function scorePersonRow(element, dialog) {
      if (!(element instanceof Element) || !element.parentElement || element === dialog) return -1e9;
      const r = element.getBoundingClientRect();
      const dr = dialog.getBoundingClientRect();
      if (r.height < 34 || r.height > 150 || r.width < Math.min(170, dr.width * .42)) return -1e9;
      const profileAnchors = [...element.querySelectorAll('a[href]')].filter(a => getProfileUsernameFromHref(a.href));
      if (profileAnchors.length < 1 || profileAnchors.length > 4) return -1e9;
      const imgCount = element.querySelectorAll('img').length;
      let score = 0;
      if (r.height >= 42 && r.height <= 112) score += 5;
      if (profileAnchors.length <= 2) score += 4;
      if (imgCount >= 1) score += 4;
      if (r.width >= dr.width * .62) score += 2;
      if (element.matches('li,[role="button"],[role="link"]')) score += 1;
    
      const siblings = [...element.parentElement.children].filter(isVisible);
      const peers = siblings.filter(sibling =>
        [...sibling.querySelectorAll('a[href]')].some(a => getProfileUsernameFromHref(a.href))
      ).length;
      if (peers >= 2) score += 7;
      return score;
    }
    
    function findPersonRow(anchor, dialog) {
      let element = anchor;
      let best = null;
      let bestScore = -1e9;
      for (let depth = 0; depth < 11 && element && element !== dialog; depth++, element = element.parentElement) {
        const score = scorePersonRow(element, dialog);
        if (score > bestScore) {
          bestScore = score;
          best = element;
        }
      }
      return bestScore >= 6 ? best : (anchor.closest('li,[role="button"],[role="link"]') || anchor.parentElement);
    }
    
    function extractPerson(anchor, dialog, { detectLiked = false } = {}) {
      const username = getProfileUsernameFromHref(anchor.href);
      if (!username) return null;
      const row = findPersonRow(anchor, dialog);
      if (!row) return null;
    
      const normalized = normalizeUsername(username);
      const lines = [...new Set((row.innerText || '').split(/\n+/).map(line => line.trim()).filter(Boolean))];
      const ignored = new Set([
        'follow', 'following', 'remove', 'message', 'requested', 'follow back',
        'liked your story', 'liked your photo', 'liked your reel'
      ]);
      const displayName = lines.find(line => {
        const lower = line.toLocaleLowerCase();
        return normalizeUsername(line) !== normalized && !ignored.has(lower) && line.length <= 120;
      }) || '';
    
      const image = row.querySelector('img');
      const avatar = image?.currentSrc || image?.src || '';
      const href = new URL(anchor.href, location.origin).pathname;
    
      let liked = false;
      if (detectLiked) {
        const text = (row.innerText || '').toLocaleLowerCase();
        liked = /liked\s+(your\s+)?story/.test(text)
          || !!row.querySelector('[aria-label*="liked" i],[aria-label="like" i],[title*="liked" i]');
      }
    
      return {
        key: normalized,
        username,
        displayName,
        avatar,
        href,
        liked,
        search: `${username} ${displayName}`.toLocaleLowerCase(),
      };
    }
    
    function collectPeopleBatch(dialog, map, options = {}) {
      const anchors = [...dialog.querySelectorAll('a[href]')].filter(anchor => getProfileUsernameFromHref(anchor.href));
      for (const anchor of anchors) {
        const person = extractPerson(anchor, dialog, options);
        if (!person) continue;
        const existing = map.get(person.key);
        if (!existing) {
          map.set(person.key, { ...person, order: map.size });
        } else {
          if (!existing.avatar && person.avatar) existing.avatar = person.avatar;
          if (!existing.displayName && person.displayName) existing.displayName = person.displayName;
          if (person.liked) existing.liked = true;
        }
      }
      return map.size;
    }
    
    function findBestScroller(dialog) {
      const candidates = [dialog, ...dialog.querySelectorAll('div,ul')].filter(element => {
        if (!(element instanceof HTMLElement)) return false;
        const style = getComputedStyle(element);
        return element.clientHeight >= 100
          && element.scrollHeight > element.clientHeight + 35
          && /(auto|scroll)/.test(style.overflowY);
      });
      let best = null;
      let bestScore = -1;
      for (const element of candidates) {
        const profileCount = [...element.querySelectorAll('a[href]')].filter(a => getProfileUsernameFromHref(a.href)).length;
        const score = profileCount * 1000 + Math.min(100000, element.scrollHeight - element.clientHeight);
        if (score > bestScore) {
          bestScore = score;
          best = element;
        }
      }
      return best;
    }
    
    async function walkInstagramList(dialog, map, {
      target = null,
      detectLiked = false,
      onProgress = null,
      maxPasses = 4,
    } = {}) {
      collectPeopleBatch(dialog, map, { detectLiked });
      let scroller = findBestScroller(dialog);
    
      if (!scroller) {
        for (let i = 0; i < 20 && dialog.isConnected; i++) {
          await sleep(120);
          collectPeopleBatch(dialog, map, { detectLiked });
          scroller = findBestScroller(dialog);
          if (scroller) break;
        }
      }
    
      if (!scroller) {
        onProgress?.(map.size, target);
        return;
      }
    
      for (let pass = 0; pass < maxPasses && dialog.isConnected; pass++) {
        scroller.scrollTop = 0;
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        await sleep(170);
        collectPeopleBatch(dialog, map, { detectLiked });
    
        let stable = 0;
        let bottomStable = 0;
        let lastCount = map.size;
    
        for (let round = 0; round < 260 && dialog.isConnected; round++) {
          collectPeopleBatch(dialog, map, { detectLiked });
          onProgress?.(map.size, target);
          if (target && map.size >= target) return;
    
          if (!scroller.isConnected) {
            scroller = findBestScroller(dialog);
            if (!scroller) {
              await sleep(140);
              continue;
            }
          }
    
          const oldHeight = scroller.scrollHeight;
          const oldTop = scroller.scrollTop;
          const step = Math.max(150, Math.floor(scroller.clientHeight * .42));
          const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          scroller.scrollTop = Math.min(maxTop, oldTop + step);
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
          await sleep(120);
    
          collectPeopleBatch(dialog, map, { detectLiked });
          onProgress?.(map.size, target);
          const count = map.size;
          if (count === lastCount) stable += 1; else stable = 0;
          lastCount = count;
    
          const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8;
          if (atBottom) {
            await sleep(190);
            collectPeopleBatch(dialog, map, { detectLiked });
            onProgress?.(map.size, target);
            const grew = scroller.scrollHeight > oldHeight + 3 || map.size > count;
            bottomStable = grew ? 0 : bottomStable + 1;
          } else {
            bottomStable = 0;
          }
    
          if (!target && bottomStable >= 8 && stable >= 8) return;
          if (target && bottomStable >= 10 && stable >= 10) break;
        }
    
        if (target && map.size >= target) return;
      }
    }
    
    // ---------------------------------------------------------------------------
    // Reusable modal shell + people list renderer (needed by the search popup)
    // ---------------------------------------------------------------------------
    function removeModal(state, id) {
      state.root?.getElementById(id)?.remove();
    }
    
    function createModalShell(state, id, title, { closeLabel = '×', onClose = null } = {}) {
      removeModal(state, id);
      const backdrop = document.createElement('div');
      backdrop.id = id;
      backdrop.className = 'igp-modal-backdrop';
      backdrop.innerHTML = `
        <section class="igp-modal" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}">
          <div class="igp-modal-head">
            <span></span>
            <div class="igp-modal-title">${escapeHTML(title)}</div>
            <button class="igp-icon-btn" type="button" aria-label="Close">${escapeHTML(closeLabel)}</button>
          </div>
          <div class="igp-modal-body"></div>
        </section>`;
      state.root.appendChild(backdrop);
      const close = () => {
        backdrop.remove();
        if (typeof onClose === 'function') onClose();
      };
      backdrop.querySelector('.igp-icon-btn').addEventListener('click', close);
      backdrop.addEventListener('pointerdown', event => {
        if (event.target === backdrop) close();
      });
      return { backdrop, body: backdrop.querySelector('.igp-modal-body'), close };
    }
    
    function renderPeopleList(container, people, { showLiked = false } = {}) {
      if (!people.length) {
        container.innerHTML = `<div class="igp-empty">No accounts found</div>`;
        return;
      }
      container.innerHTML = people.map(person => `
        <a class="igp-person" href="${escapeHTML(person.href || `/${person.username}/`)}">
          ${person.avatar
            ? `<img class="igp-avatar" src="${escapeHTML(person.avatar)}" alt="" loading="lazy">`
            : `<span class="igp-avatar"></span>`}
          <span class="igp-person-text">
            <span class="igp-username">${escapeHTML(person.username)}</span>
            ${person.displayName ? `<span class="igp-name">${escapeHTML(person.displayName)}</span>` : ''}
          </span>
          ${showLiked && person.liked ? `<span class="igp-heart" aria-label="Liked your Story">♥</span>` : '<span></span>'}
        </a>`).join('');
    }
    
    function bindIGPInput(state, input, onInput) {
      input.addEventListener('focus', () => { state.focusedIGPInput = input; });
      input.addEventListener('blur', () => {
        if (state.focusedIGPInput === input) state.focusedIGPInput = null;
      });
      input.addEventListener('input', onInput);
      input.addEventListener('search', onInput);
    }
    
    // ---------------------------------------------------------------------------
    // Story viewer indexing + search modal
    // ---------------------------------------------------------------------------
    function isStoryRoute() {
      return location.pathname.startsWith('/stories/');
    }
    
    function storyRouteKey() {
      return isStoryRoute() ? `${location.pathname}${location.search}` : null;
    }
    
    function parseSeenByTarget(dialog = null) {
      const texts = [];
      if (dialog) texts.push(dialog.innerText || '');
      if (document.body) texts.push(document.body.innerText || '');
      const patterns = [
        /seen by\s+([\d,.]+)/i,
        /([\d,.]+)\s+(?:viewers|views)\b/i,
        /(?:viewers|views)\s*[·:\-]?\s*([\d,.]+)/i,
      ];
      for (const text of texts) {
        for (const re of patterns) {
          const m = text.match(re);
          if (!m) continue;
          const n = Number(m[1].replace(/,/g, ''));
          if (Number.isFinite(n) && n > 0 && n < 10000000) return n;
        }
      }
      return null;
    }
    
    function isStoryViewerDialog(dialog) {
      if (!(dialog instanceof Element) || !isVisible(dialog) || !isStoryRoute()) return false;
      const profileLinks = [...dialog.querySelectorAll('a[href]')].filter(a => getProfileUsernameFromHref(a.href));
      if (!profileLinks.length) return false;
      const text = (dialog.innerText || '').slice(0, 1800).toLocaleLowerCase();
      return /seen by|viewers|views|likes/.test(text) || profileLinks.length >= 3;
    }
    
    function clearStorySession(state, { preserveNativeDialog = false } = {}) {
      const session = state.storySession;
      if (!session) return;
      session.cancelled = true;
      state.focusedIGPInput = null;
      removeModal(state, 'igp-story-viewer-modal');
      session.buttonHost?.remove();
      if (session.dialog?.isConnected && !preserveNativeDialog) {
        session.dialog.style.removeProperty('visibility');
        session.dialog.style.removeProperty('pointer-events');
      }
      state.storySession = null;
    }
    
    function makeViewerButton(session) {
      const host = document.createElement('div');
      host.dataset.igpViewerButtonHost = '1';
      host.style.cssText = 'display:block;padding:8px 12px;flex:none;position:relative;z-index:20;';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>
        :host{color-scheme:light dark;--bg:#efefef;--fg:#111;--bd:rgba(0,0,0,.10);font-family:${UI_FONT}}
        @media(prefers-color-scheme:dark){:host{--bg:#262626;--fg:#f5f5f5;--bd:rgba(255,255,255,.12)}}
        button{width:100%;height:38px;border:1px solid var(--bd);border-radius:11px;background:var(--bg);color:var(--fg);cursor:pointer;font:700 14px ${UI_FONT};transition:opacity .15s ease,transform .15s ease}
        button:not(:disabled):hover{transform:translateY(-1px)}button:disabled{cursor:progress;opacity:.72}
      </style><button type="button" disabled>Indexing viewers…</button>`;
      session.buttonHost = host;
      session.button = shadow.querySelector('button');
      session.button.addEventListener('click', () => openStoryViewerModal(session));
      return host;
    }
    
    function placeViewerButton(session) {
      if (!session.dialog?.isConnected || !session.buttonHost) return;
      if (session.buttonHost.isConnected && session.buttonHost.closest('[role="dialog"]') === session.dialog) return;
      const candidates = [...session.dialog.children];
      const scrollable = findBestScroller(session.dialog);
      if (scrollable?.parentElement) {
        scrollable.parentElement.insertBefore(session.buttonHost, scrollable);
        return;
      }
      const first = candidates.find(isVisible);
      if (first) session.dialog.insertBefore(session.buttonHost, first);
      else session.dialog.prepend(session.buttonHost);
    }
    
    function updateViewerButton(session) {
      if (!session.button) return;
      const loaded = session.entries.size;
      if (session.loading) {
        session.button.disabled = true;
        session.button.textContent = session.target ? `Indexing ${loaded}/${session.target}` : `Indexing ${loaded}`;
        return;
      }
      const complete = session.target ? loaded >= session.target : loaded > 0;
      session.button.disabled = !complete;
      session.button.textContent = complete ? `Search ${loaded} viewers` : `Indexing ${loaded}/${session.target || '?'}`;
    }
    
    async function startStoryViewerSession(state, dialog) {
      clearStorySession(state);
      const session = {
        routeKey: storyRouteKey(),
        dialog,
        entries: new Map(),
        target: parseSeenByTarget(dialog),
        loading: true,
        cancelled: false,
        buttonHost: null,
        button: null,
      };
      state.storySession = session;
      makeViewerButton(session);
      placeViewerButton(session);
      updateViewerButton(session);
    
      await walkInstagramList(dialog, session.entries, {
        target: session.target,
        detectLiked: true,
        maxPasses: 5,
        onProgress: () => {
          if (!session.cancelled) {
            if (!session.target) session.target = parseSeenByTarget(dialog);
            updateViewerButton(session);
            placeViewerButton(session);
          }
        },
      });
    
      if (session.cancelled || state.storySession !== session || !dialog.isConnected) return;
      session.loading = false;
      if (!session.target) session.target = parseSeenByTarget(dialog);
      updateViewerButton(session);
      placeViewerButton(session);
    }
    
    function openStoryViewerModal(state, session) {
      if (!session || session.loading || !session.entries.size) return;
      const people = [...session.entries.values()].sort((a, b) => a.order - b.order);
      if (session.dialog?.isConnected) {
        session.dialog.style.setProperty('visibility', 'hidden', 'important');
        session.dialog.style.setProperty('pointer-events', 'none', 'important');
      }
    
      const modal = createModalShell(state, 'igp-story-viewer-modal', 'Viewers', {
        onClose: () => {
          state.focusedIGPInput = null;
          if (session.dialog?.isConnected) {
            session.dialog.style.removeProperty('visibility');
            session.dialog.style.removeProperty('pointer-events');
          }
        },
      });
      modal.body.innerHTML = `
        <div class="igp-search-wrap"><input class="igp-search" type="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Search ${people.length} viewers"></div>
        <div class="igp-results"></div>`;
      const input = modal.body.querySelector('.igp-search');
      const results = modal.body.querySelector('.igp-results');
    
      const render = () => {
        const q = input.value.trim().toLocaleLowerCase();
        const filtered = q ? people.filter(person => person.search.includes(q)) : people;
        renderPeopleList(results, filtered, { showLiked: true });
      };
      bindIGPInput(state, input, render);
      render();
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }
    
    // Call this from your scan/tick loop. Requires state.settings.viewerSearch.
    function enhanceStoryViewerSearch(state) {
      if (!state.settings.viewerSearch) { console.log('[SVS] viewerSearch setting is off'); return; }
      if (!isStoryRoute()) {
        if (state.storySession) clearStorySession(state);
        return;
      }
      console.log('[SVS] on a story route, looking for viewer dialog…');
    
      const allDialogs = [...document.querySelectorAll('[role="dialog"]')];
      console.log('[SVS] dialogs on page:', allDialogs.length);
      const dialogs = allDialogs.filter(isStoryViewerDialog);
      console.log('[SVS] dialogs matching isStoryViewerDialog:', dialogs.length);
      const dialog = dialogs.at(-1);
      if (!dialog) return;
      console.log('[SVS] found viewer dialog, starting session');
    
      const session = state.storySession;
      if (!session || session.dialog !== dialog || session.routeKey !== storyRouteKey()) {
        startStoryViewerSession(state, dialog);
      } else {
        placeViewerButton(session);
        updateViewerButton(session);
      }
    }
    
    // ---------------------------------------------------------------------------
    // CSS needed for the modal/button (merge into your host stylesheet)
    // ---------------------------------------------------------------------------
    const STORY_VIEWER_SEARCH_CSS = `
      .igp-modal-backdrop {
        position: fixed; inset: 0; z-index: 2147483647;
        display: grid; place-items: center; padding: 18px;
        pointer-events: auto; background: rgba(0,0,0,.48);
        backdrop-filter: blur(7px); animation: igpFade .16s ease both;
      }
      .igp-modal {
        width: min(470px, 100%); max-height: min(720px, calc(100vh - 36px));
        display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid var(--bd); border-radius: 22px;
        background: var(--bg); color: var(--fg); box-shadow: var(--shadow);
        transform-origin: 50% 55%; animation: igpPop .22s cubic-bezier(.22,1,.36,1) both;
      }
      .igp-modal-head {
        flex: none; display: grid; grid-template-columns: 36px 1fr 36px;
        align-items: center; min-height: 58px; padding: 8px 12px;
        border-bottom: 1px solid var(--bd);
      }
      .igp-modal-title { text-align:center; font:700 18px/1.2 ${UI_FONT}; letter-spacing:-.015em; }
      .igp-icon-btn {
        width: 34px; height: 34px; display:grid; place-items:center;
        border:0; border-radius:999px; background:transparent; color:var(--fg);
        cursor:pointer; font:400 24px/1 ${UI_FONT};
      }
      .igp-icon-btn:hover { background:var(--soft); }
      .igp-search-wrap { flex:none; padding:11px 13px; border-bottom:1px solid var(--bd); }
      .igp-search {
        width:100%; height:39px; border:0; outline:0; border-radius:11px;
        background:var(--soft); color:var(--fg); padding:0 13px;
        font:400 14px/39px ${UI_FONT};
      }
      .igp-search::placeholder { color:var(--muted); }
      .igp-results { min-height:120px; overflow:auto; overscroll-behavior:contain; padding:4px 0; }
      .igp-person {
        display:grid; grid-template-columns:48px minmax(0,1fr) 28px;
        gap:11px; align-items:center; padding:9px 14px; color:var(--fg); text-decoration:none;
      }
      .igp-person:hover { background:var(--soft); }
      .igp-avatar { width:46px; height:46px; border-radius:50%; object-fit:cover; background:var(--soft2); border:1px solid var(--bd); }
      .igp-person-text { min-width:0; }
      .igp-username { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:700 14px/1.2 ${UI_FONT}; }
      .igp-name { margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); font:400 13px/1.2 ${UI_FONT}; }
      .igp-heart { text-align:center; font:700 17px/1 ${UI_FONT}; }
      .igp-empty { padding:36px 18px; text-align:center; color:var(--muted); font:400 14px/1.4 ${UI_FONT}; }
      @keyframes igpFade { from { opacity:0; } to { opacity:1; } }
      @keyframes igpPop { from { opacity:0; transform:scale(.965) translateY(7px); } to { opacity:1; transform:none; } }
    `;
