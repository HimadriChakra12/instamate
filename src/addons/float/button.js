        injectButton() {
            if (this.isFloatWindow)
                return;
            const infoIcon =
                document.querySelector(
                    'svg[aria-label="Conversation information"]'
                );
            if (!infoIcon)
                return;
            const infoButton =
                infoIcon.closest(
                    '[role="button"]'
                );
            if (!infoButton)
                return;
            const container =
                infoButton.parentElement;
            if (!container)
                return;
            if (
                container.querySelector(
                    '[data-float-button="true"]'
                )
            ) {
                return;
            }
            const audioButton =
                container.querySelector(
                    'svg[aria-label="Audio call"]'
                )?.closest(
                    '[role="button"]'
                );
            if (!audioButton)
                return;
            const button =
                infoButton.cloneNode(true);
            button.dataset.floatButton =
                'true';
            button.setAttribute(
                'aria-label',
                'Float conversation'
            );
            button.setAttribute(
                'title',
                'Float conversation'
            );

            const svg =
                button.querySelector(
                    'svg'
                );
            if (!svg)
                return;
            svg.setAttribute(
                'aria-label',
                'Float conversation'
            );
            svg.innerHTML = `
                <title>Float conversation</title>
                <path
                    d="M14 5h5v5"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                />
                <path
                    d="M19 5l-7 7"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                />
                <path
                    d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                />
            `;

            button.removeAttribute(
                'data-testid'
            );
            button.addEventListener(
                'click',
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    this.openFloat();

                },
                true
            );
            container.insertBefore(
                button,
                audioButton
            );

            this.button = button;

            console.log(
                '[Float] button injected'
            );
        },
