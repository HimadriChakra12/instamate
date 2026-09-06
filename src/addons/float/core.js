// ---------------------------------------------------------------------------
    // Float (opt -- see src/core/settings.js IM_OPTS)
    //
    // Pops a DM conversation out into its own real browser window (not an
    // iframe) so you can keep chatting while browsing the rest of
    // Instagram. Two modes share this one `Float` object:
    //   - Main window: injects a "Float conversation" button next to the
    //     info/call icons in an open DM, which opens the float window.
    //   - Float window: the popped-out window itself, identified by its
    //     window.name starting with "float:" (survives Instagram's SPA
    //     navigation, unlike a URL param would). It strips down to just
    //     the conversation view -- no sidebar, no composer chrome beyond
    //     what's needed -- and keeps its own tab title in sync.
    //
    // Files in this folder, each attaching methods to this same object:
    //   core.js (this file)  - skeleton + init/initMainWindow
    //   conversation.js      - reading which conversation is open
    //   button.js            - injecting the float button in the main window
    //   window.js            - opening/tracking float popup windows
    //   style.js             - float window's stripped-down layout
    //   title.js             - float window's tab title
    //   launch.js            - kicks off Float.init() behind the opt toggle
    const Float = {
        isFloatWindow: window.name.startsWith('float:'),
        windowPrefix: 'float:',
        button: null,
        windows: new Map(),

        init() {
            if (this.isFloatWindow) {
                this.initFloatWindow();
            } else {
                this.initMainWindow();
            }
        },

        // Main window: watch for DOM changes and (re-)inject the float
        // button whenever Instagram re-renders the conversation header.
        initMainWindow() {
            const start = () => {
                new MutationObserver(() => this.injectButton())
                    .observe(document.documentElement, { childList: true, subtree: true });
                this.injectButton();
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', start, { once: true });
            } else {
                start();
            }
        },
    };
