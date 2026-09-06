// ---------------------------------------------------------------------------
    // Security / Anti-Telemetry (opt -- see src/core/settings.js IM_OPTS)
    //
    // Instagram reports an enormous amount of client-side telemetry: event
    // batches, experiment/feature-flag exposure logging, performance and
    // error reporting, and tracking pixels -- most of it fired via
    // navigator.sendBeacon or background fetch/XHR calls that don't affect
    // anything you see on screen. This addon cuts that down without
    // touching the actual app functionality (messaging, feed, GraphQL
    // calls that the page needs a real response from all still work
    // normally).
    //
    // Structured like the Float addon: this file (core.js) defines the
    // shared `Security` object; the other files in this folder each attach
    // one method to it; launch.js kicks it off behind the opt's
    // isEnabled() check.
    //
    // Deliberately conservative: only sendBeacon (which by definition is
    // "fire and forget" reporting, never something the page waits on) and a
    // specific, named list of known telemetry/analytics URL patterns are
    // blocked. Nothing that looks like a real GraphQL/API call the app
    // might depend on gets touched. If something breaks, turn this opt off
    // in the settings popup -- it takes effect after a reload.
    const Security = {
        blockedBeaconCount: 0,
        blockedRequestCount: 0,

        init() {
            this.blockBeacons();
            this.blockTelemetryRequests();
            this.stripTrackingParams();
        },
    };
