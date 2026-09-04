
        initMainWindow() {
            const observer =
                new MutationObserver(() => {
                    this.injectButton();
                });
            const start = () => {
                observer.observe(
                    document.documentElement,
                    {
                        childList: true,
                        subtree: true
                    }
                );
                this.injectButton();
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
        },
