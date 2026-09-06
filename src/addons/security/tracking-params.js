// Click-id style tracking params (fbclid, igshid, etc.) exist purely so
    // Meta can attribute where a visit came from -- they don't affect
    // anything the page does. Stripped via history.replaceState so it
    // doesn't trigger a navigation/reload, just cleans up the address bar
    // and stops the value from sitting in browser history.
    const IM_TRACKING_PARAMS = ['fbclid', 'igshid', 'igsh', 'mibextid'];

    Security.stripTrackingParams = function stripTrackingParams() {
        const strip = () => {
            const url = new URL(location.href);
            let changed = false;
            IM_TRACKING_PARAMS.forEach((param) => {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    changed = true;
                }
            });
            if (changed) history.replaceState(history.state, '', url.toString());
        };

        strip();
        // Instagram is an SPA -- re-check after navigation events rather
        // than only once on initial load.
        window.addEventListener('popstate', strip);
        const originalPushState = history.pushState.bind(history);
        history.pushState = (...args) => {
            originalPushState(...args);
            strip();
        };
    };
