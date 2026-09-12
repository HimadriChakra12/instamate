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
        .im-back { display: flex; align-items: center; gap: 6px; padding: 12px 18px; cursor: pointer; font-size: 13px; font-weight: 600; color: #8e8e8e; border-bottom: 1px solid #3a3a3a; }
        .im-back:hover { color: #f5f5f5; }
        .im-transcript { padding: 8px 0; }
        .im-tmsg { display: flex; gap: 10px; padding: 6px 18px; }
        .im-tmsg .im-avatar { width: 26px; height: 26px; margin-top: 2px; }
        .im-tmsg .im-name { font-size: 13px; }
        .im-tmsg .im-text { font-size: 13px; color: #d8d8d8; margin-top: 1px; }
        .im-tmsg.matched { background: rgba(255,204,0,.1); border-left: 3px solid #ffcc00; padding-left: 15px; }
        .im-tmsg.matched .im-text { color: #f5f5f5; font-weight: 600; }
        .im-tmsg .im-time { font-size: 11px; color: #6a6a6a; margin-left: 6px; }
    `;

    // Navigates like an in-app click would, instead of a full page
    // reload: pushState changes the URL without reloading, and dispatching
    // a synthetic popstate event is what makes React Router's history
    // implementation (which listens for popstate to sync its own route
    // state) actually notice the change and re-render -- pushState alone
    // doesn't fire that event on its own.
    function im_navigateSpa(url) {
        history.pushState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }

    function im_searchRow({ avatar, name, sub, onClick }) {
        const row = document.createElement('div');
        row.className = 'im-row';
        if (avatar !== undefined) {
            const img = document.createElement('img');
            img.className = 'im-avatar';
            if (avatar) img.src = avatar;
            row.append(img);
        }
        const text = document.createElement('div');
        text.innerHTML = `<div class="im-name">${name}</div>${sub ? `<div class="im-sub">${sub}</div>` : ''}`;
        row.append(text);
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
        input.placeholder = 'Search\u2026  @accounts  #groups  !dms';

        const results = document.createElement('div');
        results.className = 'im-results';

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

        let lastQuery = '';

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
            lastQuery = query;
            if (!query) {
                this.renderRecentConversations(results, shut);
                return;
            }
            results.innerHTML = '<div class="im-empty">Searching\u2026</div>';
            this.debounceTimer = setTimeout(() => this.runSearch(query, results, shut), this.debounceMs);
        });

        // Restores the results list -- used by the "Back to results" row
        // in the message-context transcript view.
        this._rerunLastSearch = () => {
            if (lastQuery) this.runSearch(lastQuery, results, shut);
            else this.renderRecentConversations(results, shut);
        };

        this.renderRecentConversations(results, shut);
        input.focus();
    };

    IMSearch.closeOverlay = function closeOverlay() {
        this._closeFn?.();
    };

    // Default view when the overlay opens with nothing typed yet -- your
    // 5 most recently used conversations, same idea as Discord/Slack's
    // quick-switcher showing recent channels before you type anything.
    IMSearch.renderRecentConversations = function renderRecentConversations(results, closeOverlay) {
        const recent = this.getRecentConversations(5);
        results.innerHTML = '';

        if (recent.length === 0) {
            results.innerHTML = '<div class="im-empty">Start typing to search \u2014 or try @accounts, #groups, !dms</div>';
            return;
        }

        const label = document.createElement('div');
        label.className = 'im-section-label';
        label.textContent = 'Recent';
        results.append(label);

        recent.forEach((conversation) => {
            results.append(im_searchRow({
                avatar: conversation.avatar,
                name: conversation.title,
                sub: conversation.isGroup ? 'Group' : 'Direct message',
                onClick: () => {
                    im_navigateSpa(`https://www.instagram.com${conversation.href}`);
                    closeOverlay();
                },
            }));
        });
    };

    // Bangs pick the search scope, Discord-style: @ accounts (everyone on
    // Instagram), # groups (your group chats), ! dms (your 1:1s), no bang
    // = accounts you follow (plus messages in the currently open chat,
    // same as the original combined view).
    function im_parseBang(raw) {
        if (raw.startsWith('@')) return { mode: 'accounts', text: raw.slice(1).trim() };
        if (raw.startsWith('#')) return { mode: 'groups', text: raw.slice(1).trim() };
        if (raw.startsWith('!')) return { mode: 'dms', text: raw.slice(1).trim() };
        return { mode: 'following', text: raw };
    }

    function im_renderPeopleSection(results, people, closeOverlay, label = 'People') {
        if (people.length === 0) {
            results.innerHTML = `<div class="im-empty">No matching accounts.</div>`;
            return;
        }
        const heading = document.createElement('div');
        heading.className = 'im-section-label';
        heading.textContent = label;
        results.append(heading);
        people.slice(0, 8).forEach((person) => {
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

    function im_renderConversationsSection(results, conversations, closeOverlay, label) {
        if (conversations.length === 0) {
            results.innerHTML = `<div class="im-empty">No matching ${label.toLowerCase()}.</div>`;
            return;
        }
        const heading = document.createElement('div');
        heading.className = 'im-section-label';
        heading.textContent = label;
        results.append(heading);
        conversations.forEach((conversation) => {
            results.append(im_searchRow({
                avatar: conversation.avatar,
                name: conversation.title,
                sub: conversation.isGroup ? 'Group' : 'Direct message',
                onClick: () => {
                    im_navigateSpa(`https://www.instagram.com${conversation.href}`);
                    closeOverlay();
                },
            }));
        });
    }

    IMSearch.runSearch = async function runSearch(raw, results, closeOverlay) {
        const { mode, text } = im_parseBang(raw);
        results.innerHTML = '';

        if (mode === 'accounts') {
            const people = await this.searchPeople(text);
            im_renderPeopleSection(results, people, closeOverlay, 'Accounts');
            return;
        }

        if (mode === 'groups') {
            const groups = this.searchConversations(text, { groupOnly: true });
            im_renderConversationsSection(results, groups, closeOverlay, 'Groups');
            return;
        }

        if (mode === 'dms') {
            const dms = this.searchConversations(text, { dmOnly: true });
            im_renderConversationsSection(results, dms, closeOverlay, 'DMs');
            return;
        }

        // Default (no bang): accounts you follow, plus messages in the
        // currently open chat -- the original combined view.
        const [following, messages] = await Promise.all([
            this.searchFollowing(text),
            this.searchMessages(text),
        ]);

        if (following.length > 0) im_renderPeopleSection(results, following, closeOverlay, 'Following');

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
                    onClick: () => this.showMessageContext(message, results),
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

    // Shown when a message result is clicked: a self-contained transcript
    // view built entirely from our own fetched data (fetchMessageContext
    // in api.js) -- the matched message plus what was said around it, no
    // dependency on Instagram's own UI at all.
    IMSearch.showMessageContext = async function showMessageContext(message, results) {
        results.innerHTML = '';
        const back = document.createElement('div');
        back.className = 'im-back';
        back.textContent = '\u2190 Back to results';
        back.addEventListener('click', () => this._rerunLastSearch?.());
        results.append(back);

        const loading = document.createElement('div');
        loading.className = 'im-empty';
        loading.textContent = 'Loading context\u2026';
        results.append(loading);

        const context = await this.fetchMessageContext(message.mid);
        loading.remove();

        if (context.pending) {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Still picking up this chat\u2019s details \u2014 try again in a moment.';
            results.append(note);
            return;
        }
        if (context.error) {
            const note = document.createElement('div');
            note.className = 'im-empty';
            note.textContent = 'Couldn\u2019t load context for this message.';
            results.append(note);
            return;
        }

        const transcript = document.createElement('div');
        transcript.className = 'im-transcript';
        results.append(transcript);

        const renderMsg = (m, matched) => {
            const when = new Date(m.timestamp).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            });
            const row = document.createElement('div');
            row.className = matched ? 'im-tmsg matched' : 'im-tmsg';
            const avatar = document.createElement('img');
            avatar.className = 'im-avatar';
            if (m.senderAvatar) avatar.src = m.senderAvatar;
            const body = document.createElement('div');
            body.innerHTML = `<span class="im-name">${m.sender}</span><span class="im-time">${when}</span><div class="im-text">${m.text}</div>`;
            row.append(avatar, body);
            transcript.append(row);
        };

        context.before.forEach((m) => renderMsg(m, false));
        renderMsg({ text: message.text, sender: message.sender, timestamp: message.timestamp, senderAvatar: '' }, true);
        context.after.forEach((m) => renderMsg(m, false));
    };
