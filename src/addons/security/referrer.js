// Clicking a link out to an external site normally sends that site
    // your current Instagram page URL as the Referer header -- which post
    // you were viewing, whose profile, etc. Only applies to genuinely
    // external links (bio links, shared URLs in DMs); Instagram's own
    // internal navigation is untouched since it isn't a real cross-origin
    // request in the first place.
    Security.hardenOutboundReferrers = function hardenOutboundReferrers() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest?.('a[href]');
            if (!link) return;

            let isExternal = false;
            try {
                isExternal = new URL(link.href, location.href).hostname !== location.hostname;
            } catch {
                return;
            }
            if (!isExternal) return;

            const rel = new Set((link.rel || '').split(/\s+/).filter(Boolean));
            rel.add('noreferrer');
            rel.add('noopener');
            link.rel = [...rel].join(' ');
        }, true);
    };
