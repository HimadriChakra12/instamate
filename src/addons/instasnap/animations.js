// Near-zero animation/transition durations make the whole UI feel
    // snappier (menus, likes, story transitions land instantly instead of
    // easing in) without touching layout or content rendering at all --
    // unlike content-visibility, this can't cause anything to go blank,
    // it just changes how fast existing CSS transitions finish.
    InstaSnap.disableAnimations = function disableAnimations() {
        const style = document.createElement('style');
        style.id = 'instamate-instasnap-style';
        style.textContent = `
            *, *::before, *::after {
                animation: none !important
                transition-duration: none !important
                scroll-behavior: auto !important;
            }
        `;
        document.head.appendChild(style);
    };
