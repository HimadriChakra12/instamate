        getConversation() {
            const url =
                location.href;
            if (
                !url.includes(
                    '/direct/'
                )
            ) {
                return null;
            }
            const parsed =
                new URL(url);
            parsed.searchParams.delete(
                'float'
            );
            return {
                url: parsed.href,
                id: this.getConversationId(parsed)
            };
        },

        getConversationId(url) {
            const match =
                url.pathname.match(
                    /\/direct\/t\/([^/]+)/
                );
            if (match)
                return match[1];
            return url.href;
        },
