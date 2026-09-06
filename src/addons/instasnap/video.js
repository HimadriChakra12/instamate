// Reduces upfront buffering cost for every video Instagram renders
    // (feed, not Reels specifically -- see src/opts/reelsramsaver for that),
    // and pauses whichever ones scroll out of the viewport or whenever the
    // tab itself is hidden. Doesn't touch video src/loading beyond that --
    // no risk of content disappearing, since this never touches layout.
    InstaSnap.optimizeVideos = function optimizeVideos() {
        const offscreenObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting && !entry.target.paused) {
                    entry.target.pause();
                    InstaSnap.pausedVideoCount++;
                }
            });
        }, { threshold: 0 });

        function prepareVideo(video) {
            if (video.dataset.instamateSnapReady) return;
            video.dataset.instamateSnapReady = '1';
            video.preload = 'metadata';
            offscreenObserver.observe(video);
        }

        document.querySelectorAll('video').forEach(prepareVideo);

        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;
                    if (node.tagName === 'VIDEO') prepareVideo(node);
                    node.querySelectorAll?.('video').forEach(prepareVideo);
                });
            });
        }).observe(document.documentElement, { childList: true, subtree: true });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) return;
            document.querySelectorAll('video').forEach((video) => {
                if (!video.paused) {
                    video.pause();
                    InstaSnap.pausedVideoCount++;
                }
            });
        });
    };
