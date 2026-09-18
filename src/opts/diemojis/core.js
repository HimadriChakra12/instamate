// ---------------------------------------------------------------------
    // Instamate diemojis: trigger detection + insertion.
    //
    // COMPOSE_SELECTOR -- confirmed against a live DM compose box:
    // role="textbox" plus the aria-placeholder Instagram sets ("Message...")
    // rather than any of its churn-prone generated class names, so this
    // should keep working across Instagram's frequent markup changes as
    // long as that placeholder text doesn't change (e.g. per-locale --
    // worth rechecking if this addon ever stops firing for non-English
    // accounts).
    // ---------------------------------------------------------------------

    const IM_DIEMOJIS_COMPOSE_SELECTOR = 'div[role="textbox"][aria-placeholder="Message..."]';

    // Colon-prefixed word at the caret, only when it starts a word (not
    // mid-token like a timestamp "12:30") -- same trigger shape Discord
    // uses. Requires at least TWO characters after the colon, so typing a
    // lone ":" or ":a" doesn't pop the list open before there's anything
    // meaningful to narrow down.
    const IM_DIEMOJIS_TRIGGER = /(?:^|\s)(:[a-z0-9_+-]{2,40})$/i;

    let im_diemojisActiveEl = null;
    let im_diemojisTriggerRange = null;
    let im_diemojisLastQuery = null; // last query the popup was opened/updated for -- skip no-op re-renders

    function im_getTextBeforeCaret(el) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return '';
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer)) return '';
        const preRange = range.cloneRange();
        preRange.selectNodeContents(el);
        preRange.setEnd(range.startContainer, range.startOffset);
        return preRange.toString();
    }

    // Builds the Range covering just the ":query" text so it can be
    // selected and replaced on insertion. Only handles the common case
    // where the trigger text lives in a single text node (true for
    // ordinary typing in a contenteditable) -- if it spans multiple nodes
    // (e.g. after an undo/paste that split things oddly) this returns
    // null and insertion falls back to appending without deleting the
    // typed ":query", rather than risking deleting the wrong text.
    function im_buildTriggerRange(triggerLength) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        const caret = sel.getRangeAt(0);
        const node = caret.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return null;
        const start = caret.startOffset - triggerLength;
        if (start < 0) return null;

        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, caret.startOffset);
        return range;
    }

    function im_insertEmoji(el, triggerRange, emojiChar) {
        el.focus();
        const sel = window.getSelection();

        if (triggerRange) {
            sel.removeAllRanges();
            sel.addRange(triggerRange);
        }

        // execCommand is deprecated, but for a React/Draft.js/Lexical
        // -controlled contenteditable it's still the one reliable way to
        // insert text that the framework's own input handlers pick up --
        // directly mutating the DOM and dispatching a synthetic InputEvent
        // is the fallback, not the default, because controlled editors
        // often silently discard DOM edits they didn't originate.
        const inserted = document.execCommand && document.execCommand('insertText', false, emojiChar + ' ');
        if (!inserted) {
            const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
            if (range) {
                range.deleteContents();
                range.insertNode(document.createTextNode(emojiChar + ' '));
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: emojiChar + ' ' }));
        }
    }

    function im_closeDiemojis() {
        IMEmojiList.close();
        im_diemojisActiveEl = null;
        im_diemojisTriggerRange = null;
        im_diemojisLastQuery = null;
    }

    // The actual "did the trigger text change, update the popup" logic --
    // shared by both sync paths below (see im_attachDiemojis for why there
    // are two). Safe to call redundantly; it no-ops when the query hasn't
    // actually changed since the last call.
    function im_recomputeDiemojis(el) {
        const before = im_getTextBeforeCaret(el);
        const match = before.match(IM_DIEMOJIS_TRIGGER);
        if (!match) {
            if (IMEmojiList.isOpen()) im_closeDiemojis();
            return;
        }

        const trigger = match[1]; // includes the leading ":"
        const query = trigger.slice(1);
        if (query === im_diemojisLastQuery && IMEmojiList.isOpen()) return; // nothing actually changed

        const matches = IMEmoji.match(query);

        im_diemojisActiveEl = el;
        im_diemojisTriggerRange = im_buildTriggerRange(trigger.length);
        im_diemojisLastQuery = query;

        IMEmojiList.open(matches, el, query, (item) => {
            im_insertEmoji(el, im_diemojisTriggerRange, item.char);
            im_diemojisActiveEl = null;
            im_diemojisTriggerRange = null;
            im_diemojisLastQuery = null;
        });
    }

    // Instagram's DM box runs on Lexical (Meta's own rich-text editor
    // framework), which doesn't always dispatch a plain native `input`
    // event per keystroke the way an ordinary contenteditable does --
    // confirmed live: rapid backspacing left the popup showing a stale,
    // already-deleted query for a beat before it caught up. A
    // MutationObserver watches the DOM Lexical actually renders (whatever
    // its internal event model is, the visible text has to land in the
    // DOM eventually), so it's a reliable second path that catches
    // whatever the `input` listener below occasionally misses. Both call
    // the same idempotent im_recomputeDiemojis, so having both wired up
    // just means the faster one wins on any given keystroke.
    const im_diemojisObservedEls = new WeakSet();

    function im_ensureObserved(el) {
        if (im_diemojisObservedEls.has(el)) return;
        im_diemojisObservedEls.add(el);

        const observer = new MutationObserver(() => im_recomputeDiemojis(el));
        observer.observe(el, { characterData: true, childList: true, subtree: true });
    }

    function im_handleComposeInput(e) {
        const el = e.target;
        if (!el.matches || !el.matches(IM_DIEMOJIS_COMPOSE_SELECTOR)) {
            if (IMEmojiList.isOpen()) im_closeDiemojis();
            return;
        }
        im_ensureObserved(el);
        im_recomputeDiemojis(el);
    }

    function im_handleComposeKeydown(e) {
        if (!IMEmojiList.isOpen()) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                IMEmojiList.moveSelection(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                IMEmojiList.moveSelection(-1);
                break;
            case 'Enter':
            case 'Tab':
                // Swallow the keystroke instead of letting it send the
                // message (Enter) or leave the compose box (Tab).
                e.preventDefault();
                e.stopPropagation();
                IMEmojiList.selectActive();
                break;
            case 'Escape':
                e.preventDefault();
                im_closeDiemojis();
                break;
            default:
                break;
        }
    }

    function im_attachDiemojis() {
        // Delegated on document so this keeps working across Instagram's
        // SPA re-renders swapping the compose box for a new node, same
        // reasoning as the sidebar-icon re-mount logic in core/ui.js. Also
        // attaches the MutationObserver fallback (see above) the first
        // time we see a given compose box.
        document.addEventListener('input', im_handleComposeInput, true);
        // Capture phase + stopPropagation on the keys we swallow above is
        // what keeps Instagram's own Enter-to-send handler from also
        // firing on the same keystroke.
        document.addEventListener('keydown', im_handleComposeKeydown, true);
        // focusin covers clicking into a compose box that already has text
        // in it (no 'input' event fires just from focusing), so the
        // MutationObserver is armed before the user's first keystroke.
        document.addEventListener('focusin', (e) => {
            const el = e.target;
            if (el.matches && el.matches(IM_DIEMOJIS_COMPOSE_SELECTOR)) im_ensureObserved(el);
        }, true);
        document.addEventListener('blur', (e) => {
            if (e.target === im_diemojisActiveEl) im_closeDiemojis();
        }, true);
    }
