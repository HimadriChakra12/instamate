// ---------------------------------------------------------------------------
    // InstaSnap (addon -- see src/core/settings.js IM_ADDONS)
    //
    // A few genuinely safe snappiness wins, adapted from a well-known
    // "Instagram Lite" userscript pattern -- but deliberately NOT porting
    // its most aggressive trick. That script applies CSS
    // `content-visibility: auto` with a flat `contain-intrinsic-size: 1000px`
    // guess to every `main article, main section` on the page. Real feed
    // posts vary enormously in actual height (carousels, long captions,
    // video vs. image), so the browser's placeholder math goes wrong and
    // content that should be visible gets skipped entirely -- confirmed via
    // screen recording: the feed intermittently renders completely blank
    // mid-scroll. The selector is also too broad and matches structure that
    // has nothing to do with individual posts. That's why that script
    // "works for DMs but breaks the feed" -- DM markup doesn't even use
    // article/section tags, so the risky rule never applies there, while it
    // hits the feed hard.
    //
    // What's kept here instead are the parts of that approach that don't
    // touch layout/rendering at all -- disabling animations, trimming video
    // preload, and pausing offscreen/hidden video -- which give a real,
    // noticeable snappiness improvement without any risk of blanking out
    // content.
    //
    // Structured like Float/Security: this file defines the shared
    // `InstaSnap` object; the other files in this folder attach methods
    // to it; launch.js kicks it off behind the opt's isEnabled() check.
    const InstaSnap = {
        hiddenAdCount: 0,
        pausedVideoCount: 0,

        init() {
            this.disableAnimations();
            this.optimizeVideos();
            this.hideSponsoredPosts();
        },
    };
