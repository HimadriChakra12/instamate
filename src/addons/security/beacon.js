// navigator.sendBeacon exists specifically for "send this and don't
    // wait for a response, even if the page is about to unload" -- that's
    // exactly the shape of analytics/telemetry reporting and never
    // something real app functionality depends on getting a reply from.
    // Instagram fires it constantly (page-leave events, engagement pings,
    // performance samples). Stubbing it to a no-op that reports success
    // (so calling code doesn't retry via a fallback path) silently drops
    // all of it.
    Security.blockBeacons = function blockBeacons() {
        if (!navigator.sendBeacon) return;

        const original = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url, data) => {
            Security.blockedBeaconCount++;
            // Uncomment for debugging which endpoints get hit:
            // console.log('[Instamate Security] blocked beacon:', url);
            void original; // kept for reference, intentionally never called
            return true; // report success so callers don't fall back to fetch/XHR instead
        };
    };
