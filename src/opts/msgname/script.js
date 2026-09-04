    if (IM.isEnabled('msgname')) {
        // Username span
        const USERNAME_SELECTOR =
            'div.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x9f619.xjbqb8w.x78zum5.x15mokao.x1ga7v0g.x16uus16.xbiv7yw.x1xmf6yo.x1uhb9sk.x1plvlek.xryxfnj.x1c4vz4f.x2lah0s.xdt5ytf.xqjyukv.x1qjc9v5.x1oa3qoh.x1nhvcw1 span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft';
    
        // Nickname
        const NICKNAME_SELECTOR = 'h2 span[title]';
    
        const COUNT_PREFIX = /^\((\d+)\)\s*/;
    
        let lastTitle = '';
    
        function getUsername() {
            const elements = document.querySelectorAll(USERNAME_SELECTOR);
    
            for (const element of elements) {
                const text = element.textContent.trim();
    
                if (text) {
                    return text;
                }
            }
    
            return null;
        }
    
        function getNickname() {
            const element = document.querySelector(NICKNAME_SELECTOR);
    
            if (!element) {
                return null;
            }
    
            return (
                element.getAttribute('title')?.trim() ||
                element.textContent.trim() ||
                null
            );
        }
    
        function getCurrentCount() {
            const match = document.title.match(COUNT_PREFIX);
            return match ? match[1] : null;
        }
    
        function updateTitle() {
            if (!location.pathname.startsWith('/direct/t/')) {
                return;
            }
    
            const nickname = getNickname();
            const username = getUsername();
    
            if (!nickname) {
                return;
            }
    
            let base;
    
            if (username) {
                // Normal DM
                base = `${nickname} - ${username}`;
            } else if (nickname === 'Instagram User') {
                // Deleted/deactivated/etc. account, NOT a group
                base = nickname;
            } else {
                // No username = group
                base = `${nickname} - Group`;
            }
    
            // Read whatever count Instagram currently has on the tab title
            // (whether it just set it, or it's sitting on a title we wrote
            // last time) and fold it back in, instead of dropping it.
            const count = getCurrentCount();
            const newTitle = count ? `(${count}) ${base}` : base;
    
            if (newTitle !== lastTitle) {
                lastTitle = newTitle;
                document.title = newTitle;
            } else if (document.title !== lastTitle) {
                // Instagram overwrote our title with something other than a
                // count-prefix update -- put ours back.
                document.title = lastTitle;
            }
        }
    
        // Watch for Instagram's dynamically generated DOM
        function startObserver() {
            if (!document.documentElement) {
                requestAnimationFrame(startObserver);
                return;
            }
    
            const observer = new MutationObserver(updateTitle);
    
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['title']
            });
    
            updateTitle();
        }
    
        startObserver();
    
        // Handle Instagram SPA navigation
        let lastURL = location.href;
    
        setInterval(() => {
            if (location.href !== lastURL) {
                lastURL = location.href;
                lastTitle = '';
            }
    
            updateTitle();
        }, 250);
    }
