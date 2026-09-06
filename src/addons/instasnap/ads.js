// Hides posts explicitly labeled "Sponsored" -- doesn't touch layout
    // for anything else, so there's no content-visibility-style risk of
    // real posts going blank. Only ever acts on a post that's already
    // confirmed to say "Sponsored" verbatim.
    InstaSnap.hideSponsoredPosts = function hideSponsoredPosts() {
        function checkPost(post) {
            if (post.dataset.instamateSnapChecked) return;
            post.dataset.instamateSnapChecked = '1';

            const isSponsored = [...post.querySelectorAll('span, div')]
                .some((node) => node.textContent?.trim() === 'Sponsored');
            if (isSponsored) {
                post.style.display = 'none';
                InstaSnap.hiddenAdCount++;
            }
        }

        document.querySelectorAll('article').forEach(checkPost);

        new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;
                    if (node.tagName === 'ARTICLE') checkPost(node);
                    node.querySelectorAll?.('article').forEach(checkPost);
                });
            });
        }).observe(document.documentElement, { childList: true, subtree: true });
    };
