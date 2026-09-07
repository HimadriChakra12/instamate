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

        if (people.length === 0 && messages.pending) {
            results.innerHTML = '<div class="im-empty">No people found. Message search isn\u2019t wired up yet.</div>';
            return;
        }

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
                        location.href = `https://www.instagram.com/${person.username}/`;
                        closeOverlay();
                    },
                }));
            });
        }

        if (messages.pending) {
            const label = document.createElement('div');
            label.className = 'im-section-label';
            label.textContent = 'Messages';
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Message search isn\u2019t wired up yet \u2014 see api.js for what\u2019s needed.';
            results.append(label, note);
        }

        if (people.length === 0 && !messages.pending) {
            results.innerHTML = '<div class="im-empty">No results.</div>';
        }
    };
