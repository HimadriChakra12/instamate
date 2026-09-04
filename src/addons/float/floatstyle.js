        installFloatStyles() {

            if (
                document.getElementById(
                    'float-addon-style'
                )
            ) {
                return;
            }

            const style =
                document.createElement(
                    'style'
                );

            style.id =
                'float-addon-style';

            style.textContent = `
                html[data-float-window="true"] {
                    overflow: hidden !important;
                }
                html[data-float-window="true"]
                nav {
                    display: none !important;
                }
                html[data-float-window="true"]
                textarea[placeholder="Message..."] {
                    display: none !important;
                }
                html[data-float-window="true"]
                textarea[placeholder="Message..."]
                {
                    display: none !important;
                }
                html[data-float-window="true"]
                textarea[placeholder="Message..."]
                {
                    display: none !important;
                }
                html[data-float-window="true"]
                body {
                    min-width: 0 !important;
                }

            `;

            document.head.appendChild(
                style
            );
        },


        /*
         * =========================================================
         * APPLY FLOAT LAYOUT
         * =========================================================
         */

        applyFloatLayout() {

            if (!this.isFloatWindow)
                return;

            /*
             * Hide navigation.
             */

            document
                .querySelectorAll('nav')
                .forEach(nav => {

                    nav.style.setProperty(
                        'display',
                        'none',
                        'important'
                    );

                });

            /*
             * Hide the message composer by
             * walking up from the textarea.
             */

            const textarea =
                document.querySelector(
                    'textarea[placeholder="Message..."]'
                );

            if (textarea) {

                textarea.style.setProperty(
                    'display',
                    'none',
                    'important'
                );

                /*
                 * Walk upward to hide the composer
                 * container without touching the
                 * conversation itself.
                 */

                let parent =
                    textarea.parentElement;

                for (
                    let i = 0;
                    i < 6 && parent;
                    i++
                ) {

                    /*
                     * Stop if the parent becomes huge.
                     * We don't want to accidentally hide
                     * the whole conversation.
                     */

                    const rect =
                        parent.getBoundingClientRect();

                    if (
                        rect.height > 150
                    ) {
                        break;
                    }

                    parent.style.setProperty(
                        'display',
                        'none',
                        'important'
                    );

                    parent =
                        parent.parentElement;
                }
            }

            /*
             * Make the chat consume the available window.
             *
             * We intentionally DON'T globally modify Instagram's
             * main layout because this code only runs inside a
             * window whose name starts with "float:".
             */
        },
