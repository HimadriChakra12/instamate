    if (IM.isEnabled('reelsramsaver')) {
    const CHECK_INTERVAL = 1500;
    const DISTANCE_THRESHOLD = 1000;
    
    function cleanUpReels() {
        if (!window.location.href.includes('/reels/')) {
            return;
        }
    
        const videos = document.querySelectorAll('video');
    
        videos.forEach(video => {
            const rect = video.getBoundingClientRect();
    
            if (rect.bottom < -DISTANCE_THRESHOLD) {
    
                if (video.src || video.querySelector('source')) {
    
                    console.log('Reels RAM Saver: Usuwanie starego Reelsa z pamięci...');
    
                    video.pause();
    
                    video.removeAttribute('src');
                    video.querySelectorAll('source').forEach(source => source.remove());
    
                    video.load();
    
                }
            }
        });
    }
    
    setInterval(cleanUpReels, CHECK_INTERVAL);
    }
