        updateFloatTitle() {

            if (!this.isFloatWindow)
                return;

            const name =
                this.getChatName();

            if (!name)
                return;

            document.title =
                'Float — ' + name;
        },


        getChatName() {


            const infoIcon =
                document.querySelector(
                    'svg[aria-label="Conversation information"]'
                );

            if (!infoIcon)
                return null;

            let node =
                infoIcon.parentElement;

            for (
                let i = 0;
                i < 8 && node;
                i++
            ) {

                const text =
                    node.innerText
                        ?.trim();

                if (
                    text &&
                    text.length > 0 &&
                    text.length < 150
                ) {

                    const lines =
                        text
                            .split('\n')
                            .map(
                                x => x.trim()
                            )
                            .filter(Boolean);

                    if (lines.length)
                        return lines[0];
                }

                node =
                    node.parentElement;
            }

            return null;
        }
    };

