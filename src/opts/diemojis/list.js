    // ---------------------------------------------------------------------
    // Instamate diemojis: the popup itself.
    //
    // NOTE ON THE FILE NAME: this project already has a core/ui.js (the
    // settings panel) and a search/ui.js (the Ctrl/Cmd+K overlay). This
    // file plays the same "UI" role for diemojis but is deliberately named
    // list.js instead, so any path or conversation reference to "ui.js" is
    // never ambiguous about which one is meant.
    // ---------------------------------------------------------------------

    const IMEmojiList = (() => {
        let host = null;
        let root = null;
        let popup = null;
        let listEl = null;
        let headerEl = null;
        let items = [];
        let activeIndex = -1;
        let onSelectCallback = null;

        function ensureMounted() {
            if (root) return;
            if (!document.body) return;

            host = document.createElement('div');
            host.id = 'instamate-diemojis-host';
            document.body.appendChild(host);
            root = host.attachShadow({ mode: 'open' });

            const style = document.createElement('style');
            style.textContent = IM_DIEMOJIS_CSS;
            root.append(style);

            popup = document.createElement('div');
            popup.className = 'imej-popup imej-hidden';

            headerEl = document.createElement('div');
            headerEl.className = 'imej-header';

            listEl = document.createElement('div');
            listEl.className = 'imej-list';

            popup.append(headerEl, listEl);
            root.append(popup);

            // mousedown, not click -- fires before the compose box loses
            // focus/selection, so the caret position we need for insertion
            // (captured back in core.js) is still the one the user left it
            // at, not wherever focus lands after a click-triggered blur.
            listEl.addEventListener('mousedown', (e) => {
                const row = e.target.closest('.imej-row');
                if (!row) return;
                e.preventDefault();
                const index = Number(row.dataset.index);
                if (Number.isInteger(index)) selectIndex(index);
            });
        }

        function renderRows() {
            listEl.innerHTML = '';
            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'imej-empty';
                empty.textContent = 'No matching emoji';
                listEl.append(empty);
                return;
            }

            items.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'imej-row' + (index === activeIndex ? ' imej-active' : '');
                row.dataset.index = String(index);

                const glyph = document.createElement('span');
                glyph.className = 'imej-row-glyph';
                glyph.textContent = item.char;

                const code = document.createElement('span');
                code.className = 'imej-row-code';
                code.textContent = ':' + item.shortcode + ':';

                row.append(glyph, code);

                // Only the (unconfirmed, best-effort) Instagram-sourced tier
                // carries anything worth labeling -- the third-party/builtin
                // tiers are plain Unicode emoji with no "origin" to show.
                if (IMEmoji.source === 'instagram') {
                    const src = document.createElement('span');
                    src.className = 'imej-row-source';
                    src.textContent = 'Instagram';
                    row.append(src);
                }

                listEl.append(row);
            });
        }

        function position(anchorRect) {
            const width = Math.max(280, Math.min(anchorRect.width, 480));
            popup.style.width = width + 'px';
            popup.style.left = Math.round(anchorRect.left) + 'px';
            // Anchored above the compose box, same placement as the
            // reference this was modeled on -- flip below it only if
            // there's genuinely no room above (e.g. a very short viewport).
            const desiredBottom = anchorRect.top - 8;
            if (desiredBottom > 160) {
                popup.style.bottom = (window.innerHeight - anchorRect.top + 8) + 'px';
                popup.style.top = 'auto';
                popup.style.maxHeight = Math.min(320, anchorRect.top - 16) + 'px';
            } else {
                popup.style.top = (anchorRect.bottom + 8) + 'px';
                popup.style.bottom = 'auto';
                popup.style.maxHeight = Math.min(320, window.innerHeight - anchorRect.bottom - 16) + 'px';
            }
        }

        function open(matches, anchorEl, query, onSelect) {
            ensureMounted();
            if (!root) return; // document.body not ready yet -- exceedingly rare at this run-at timing

            items = matches;
            activeIndex = matches.length > 0 ? 0 : -1;
            onSelectCallback = onSelect;
            headerEl.textContent = 'Emoji matching :' + query;
            renderRows();
            position(anchorEl.getBoundingClientRect());
            popup.classList.remove('imej-hidden');
        }

        function close() {
            if (popup) popup.classList.add('imej-hidden');
            items = [];
            activeIndex = -1;
            onSelectCallback = null;
        }

        function isOpen() {
            return !!(popup && !popup.classList.contains('imej-hidden'));
        }

        function moveSelection(delta) {
            if (items.length === 0) return;
            activeIndex = (activeIndex + delta + items.length) % items.length;
            renderRows();
            const activeRow = listEl.querySelector('.imej-active');
            if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
        }

        function selectIndex(index) {
            const item = items[index];
            if (!item || !onSelectCallback) return;
            const callback = onSelectCallback;
            close();
            callback(item);
        }

        function selectActive() {
            if (activeIndex >= 0) selectIndex(activeIndex);
        }

        return { open, close, isOpen, moveSelection, selectActive };
    })();
