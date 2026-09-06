Float.updateFloatTitle = function updateFloatTitle() {
        if (!this.isFloatWindow) return;

        const name = this.getChatName();
        if (name) document.title = 'Float \u2014 ' + name;
    };

    // Reads the chat name by walking up from the conversation-info icon
    // and taking the first short, non-empty text line found -- Instagram
    // doesn't expose a stable "chat name" element to read directly.
    Float.getChatName = function getChatName() {
        const infoIcon = document.querySelector('svg[aria-label="Conversation information"]');
        if (!infoIcon) return null;

        let node = infoIcon.parentElement;
        for (let i = 0; i < 8 && node; i++) {
            const text = node.innerText?.trim();
            if (text && text.length > 0 && text.length < 150) {
                const [firstLine] = text.split('\n').map((line) => line.trim()).filter(Boolean);
                if (firstLine) return firstLine;
            }
            node = node.parentElement;
        }
        return null;
    };
