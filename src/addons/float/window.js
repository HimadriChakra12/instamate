        openFloat() {

            const conversation =
                this.getConversation();

            if (!conversation)
                return;

            const id =
                conversation.id;

            /*
             * If this conversation is already floating,
             * just focus it.
             */

            const existing =
                this.windows.get(id);

            if (
                existing &&
                !existing.closed
            ) {
                existing.focus();
                return;
            }

            /*
             * Give every float window its own name.
             *
             * window.name survives SPA navigation.
             */

            const windowName =
                this.windowPrefix +
                id;

            /*
             * Keep the actual Instagram URL.
             *
             * No iframe.
             * No fake window.
             * This is a genuine browser window.
             */

            const features = [
                'popup=yes',
                'width=720',
                'height=820',
                'resizable=yes',
                'scrollbars=yes'
            ].join(',');

            const popup =
                window.open(
                    conversation.url,
                    windowName,
                    features
                );

            if (!popup)
                return;

            /*
             * Store it so repeated clicks don't create
             * another window for the same conversation.
             */

            this.windows.set(
                id,
                popup
            );

            /*
             * Cleanup when it closes.
             */

            const cleanup =
                setInterval(() => {

                    if (popup.closed) {

                        clearInterval(
                            cleanup
                        );

                        this.windows.delete(
                            id
                        );
                    }

                }, 1000);

            /*
             * Focus immediately.
             */

            popup.focus();
        },


        /*
         * =========================================================
         * FLOAT WINDOW
         * =========================================================
         */

        initFloatWindow() {

            console.log(
                '[Float] floating window'
            );

            /*
             * Set the marker explicitly.
             *
             * This remains true even when Instagram
             * changes routes internally.
             */

            document.documentElement
                .dataset.floatWindow =
                'true';

            this.installFloatStyles();

            /*
             * Instagram is a SPA, so the actual UI can
             * appear well after document-start.
             */

            const observer =
                new MutationObserver(() => {

                    this.applyFloatLayout();

                });

            const start = () => {

                observer.observe(
                    document.documentElement,
                    {
                        childList: true,
                        subtree: true
                    }
                );

                this.applyFloatLayout();

            };

            if (
                document.readyState ===
                'loading'
            ) {
                document.addEventListener(
                    'DOMContentLoaded',
                    start,
                    { once: true }
                );
            } else {
                start();
            }

            /*
             * React can replace large portions of the
             * page without changing our <style>.
             *
             * Keep the title updated too.
             */

            setInterval(() => {

                this.applyFloatLayout();

                this.updateFloatTitle();

            }, 1000);
        },
