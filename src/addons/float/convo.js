Float.getConversation = function getConversation() {
        if (!location.href.includes('/direct/')) return null;

        const parsed = new URL(location.href);
        parsed.searchParams.delete('float');

        return { url: parsed.href, id: this.getConversationId(parsed) };
    };

    Float.getConversationId = function getConversationId(url) {
        const match = url.pathname.match(/\/direct\/t\/([^/]+)/);
        return match ? match[1] : url.href;
    };
