// Opens (or focuses, if already open) a real browser window for the
    // current conversation -- a genuine popup with Instagram's own URL,
    // not an iframe.
    Float.openFloat = function openFloat() {
        const conversation = this.getConversation();
        if (!conversation) return;

        const { id, url } = conversation;

        // Already floating? Just focus it instead of opening a duplicate.
        const existing = this.windows.get(id);
        if (existing && !existing.closed) {
            existing.focus();
            return;
        }

        // window.name (not a URL param) survives Instagram's SPA
        // navigation, so this is how the float window recognizes itself
        // in initFloatWindow.
        const windowName = this.windowPrefix + id;
        const features = 'popup=yes,width=720,height=820,resizable=yes,scrollbars=yes';
        const popup = window.open(url, windowName, features);
        if (!popup) return;

        this.windows.set(id, popup);

        const cleanup = setInterval(() => {
            if (popup.closed) {
                clearInterval(cleanup);
                this.windows.delete(id);
            }
        }, 1000);

        popup.focus();
    };

    // Float window: strip down the layout and keep re-applying it/the tab
    // title, since Instagram's SPA can re-render large portions of the
    // page (including replacing our <style> target nodes) at any time.
    Float.initFloatWindow = function initFloatWindow() {
        document.documentElement.dataset.floatWindow = 'true';
        this.installFloatStyles();

        const start = () => {
            new MutationObserver(() => this.applyFloatLayout())
                .observe(document.documentElement, { childList: true, subtree: true });
            this.applyFloatLayout();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        } else {
            start();
        }

        setInterval(() => {
            this.applyFloatLayout();
            this.updateFloatTitle();
        }, 1000);
    };
