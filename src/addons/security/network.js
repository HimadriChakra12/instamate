// Named, specific telemetry/analytics URL patterns -- deliberately not
    // a broad "block anything with /graphql/ or /api/" rule, since
    // Instagram's actual functionality (messages, feed, everything) runs
    // over those same endpoints. Only patterns known to be pure logging/
    // experiment-exposure/error-reporting traffic are listed here.
    const IM_SECURITY_BLOCKED_PATTERNS = [
        /\/ajax\/bz/i, // Meta's batched client-event logging endpoint
        /\/logging_client_events/i,
        /\/api\/v1\/qe\/expose/i, // experiment/feature-flag exposure logging
        /\/quality_data/i,
        /\/api\/v1\/qpl/i, // Meta's QuickPerformanceLogging endpoint
        /connect\.facebook\.net\/.+\/fbevents\.js/i, // Meta Pixel script
        /facebook\.com\/tr\b/i, // Meta Pixel tracking-pixel endpoint
        /facebook\.com\/instagram\/sync/i, // cross-app FB/IG identity sync (ad targeting linkage)
        /\/api\/v1\/wearable_devices\/data_export/i,
    ];

    function im_isBlockedTelemetryUrl(url) {
        const str = typeof url === 'string' ? url : url?.toString?.() || '';
        return IM_SECURITY_BLOCKED_PATTERNS.some((pattern) => pattern.test(str));
    }

    Security.blockTelemetryRequests = function blockTelemetryRequests() {
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
            const url = typeof input === 'string' ? input : input?.url;
            if (im_isBlockedTelemetryUrl(url)) {
                Security.blockedRequestCount++;
                // Resolve with an empty, successful-looking response rather
                // than rejecting -- Instagram's own reporting code
                // generally no-ops on a 204 rather than treating it as an
                // error worth retrying or logging.
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            return originalFetch(input, init);
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
            if (im_isBlockedTelemetryUrl(url)) {
                Security.blockedRequestCount++;
                this.im_blocked = true;
            }
            return originalOpen.call(this, method, url, ...rest);
        };

        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function send(...args) {
            if (this.im_blocked) return undefined; // never actually dispatched
            return originalSend.apply(this, args);
        };
    };
