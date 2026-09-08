const IM_SEARCH_CSS = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .im-backdrop {
            position: fixed; inset: 0; background: rgba(0,0,0,.65);
            z-index: 2147483003; display: flex; align-items: flex-start; justify-content: center;
            padding-top: 12vh;
        }
        .im-panel {
            width: 520px; max-width: 92vw; max-height: 70vh; overflow: hidden;
            background: #262626; color: #f5f5f5; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,.55);
            display: flex; flex-direction: column;
        }
        .im-input {
            width: 100%; padding: 16px 18px; font-size: 16px; border: none; border-bottom: 1px solid #3a3a3a;
            background: transparent; color: #f5f5f5; outline: none;
        }
        .im-input::placeholder { color: #8e8e8e; }
        .im-results { overflow-y: auto; padding: 8px 0; }
        .im-section-label { padding: 10px 18px 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em; color: #8e8e8e; text-transform: uppercase; }
        .im-row { display: flex; align-items: center; gap: 12px; padding: 8px 18px; cursor: pointer; }
        .im-row:hover { background: rgba(255,255,255,.06); }
        .im-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #3a3a3a; flex-shrink: 0; }
        .im-name { font-size: 14px; font-weight: 600; }
        .im-sub { font-size: 12px; color: #8e8e8e; }
        .im-empty { padding: 24px 18px; text-align: center; color: #8e8e8e; font-size: 13px; }
        .im-hint { padding: 10px 18px; border-top: 1px solid #3a3a3a; font-size: 11px; color: #8e8e8e; }
    `;

    // Navigates like an in-app click would, instead of a full page
    // reload: pushState changes the URL without reloading, and dispatching
    // a synthetic popstate event is what makes React Router's history
    // implementation (which listens for popstate to sync its own route
    // state) actually notice the change and re-render -- pushState alone
    // doesn't fire that event on its own. Faster than a reload, and
    // (per testing) actually respects params like ?mid= that a full
    // server-rendered reload seems to ignore -- likely because that
    // "jump to X" logic only runs on in-app client-side transitions, not
    // on initial page hydration.
    function im_navigateSpa(url) {
        history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }

    function im_searchRow({ avatar, name, sub, onClick }) {
        const row = document.createElement('div');
        row.className = 'im-row';
        const img = document.createElement('img');
        img.className = 'im-avatar';
        if (avatar) img.src = avatar;
        const text = document.createElement('div');
        text.innerHTML = `<div class="im-name">${name}</div>${sub ? `<div class="im-sub">${sub}</div>` : ''}`;
        row.append(img, text);
        if (onClick) row.addEventListener('click', onClick);
        return row;
    }

    IMSearch.toggleOverlay = function toggleOverlay() {
        if (this.overlayOpen) {
            this.closeOverlay();
        } else {
            this.openOverlay();
        }
    };

    IMSearch.openOverlay = function openOverlay() {
        let host = document.getElementById('instamate-search-host');
        let root = host?.shadowRoot;
        if (!host) {
            host = document.createElement('div');
            host.id = 'instamate-search-host';
            document.body.append(host);
            root = host.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = IM_SEARCH_CSS;
            root.append(style);
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'im-backdrop';
        const panel = document.createElement('div');
        panel.className = 'im-panel';

        const input = document.createElement('input');
        input.className = 'im-input';
        input.placeholder = 'Search people or messages\u2026';

        const results = document.createElement('div');
        results.className = 'im-results';
        results.innerHTML = '<div class="im-empty">Start typing to search</div>';

        const hint = document.createElement('div');
        hint.className = 'im-hint';
        hint.textContent = 'Esc to close \u00b7 Ctrl/Cmd+K to toggle';

        panel.append(input, results, hint);
        backdrop.append(panel);
        root.append(backdrop);

        this.overlayOpen = true;

        const shut = () => {
            backdrop.remove();
            this.overlayOpen = false;
        };
        this._closeFn = shut;

        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) shut();
        });
        document.addEventListener('keydown', function onEsc(event) {
            if (event.key === 'Escape') {
                shut();
                document.removeEventListener('keydown', onEsc);
            }
        });

        input.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            const query = input.value.trim();
            if (!query) {
                results.innerHTML = '<div class="im-empty">Start typing to search</div>';
                return;
            }
            results.innerHTML = '<div class="im-empty">Searching\u2026</div>';
            this.debounceTimer = setTimeout(() => this.runSearch(query, results, shut), this.debounceMs);
        });

        input.focus();
    };

    IMSearch.closeOverlay = function closeOverlay() {
        this._closeFn?.();
    };

    IMSearch.runSearch = async function runSearch(query, results, closeOverlay) {
        const [people, messages] = await Promise.all([
            this.searchPeople(query),
            this.searchMessages(query),
        ]);

        results.innerHTML = '';

        if (people.length > 0) {
            const label = document.createElement('div');
            label.className = 'im-section-label';
            label.textContent = 'People';
            results.append(label);

            people.slice(0, 6).forEach((person) => {
                results.append(im_searchRow({
                    avatar: person.avatar,
                    name: person.fullName || person.username,
                    sub: '@' + person.username + (person.isPrivate ? ' \u00b7 Private' : ''),
                    onClick: () => {
                        im_navigateSpa(`https://www.instagram.com/${person.username}/`);
                        closeOverlay();
                    },
                }));
            });
        }

        const messagesLabel = document.createElement('div');
        messagesLabel.className = 'im-section-label';
        messagesLabel.textContent = 'Messages in this chat';

        if (messages.items.length > 0) {
            results.append(messagesLabel);
            messages.items.slice(0, 8).forEach((message) => {
                const when = new Date(message.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                results.append(im_searchRow({
                    name: message.text,
                    sub: `${message.sender} \u00b7 ${when}`,
                    onClick: () => {
                        if (!message.mid) return;
                        const url = new URL(location.href);
                        url.searchParams.set('mid', message.mid);
                        im_navigateSpa(url.toString());
                        closeOverlay();
                    },
                }));
            });
        } else if (messages.pending) {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Still picking up this chat\u2019s details \u2014 try again in a moment.';
            results.append(messagesLabel, note);
        } else if (messages.error) {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Message search failed \u2014 Instagram may have rejected the request.';
            results.append(messagesLabel, note);
        } else {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'No matching messages.';
            results.append(messagesLabel, note);
        }
    };
