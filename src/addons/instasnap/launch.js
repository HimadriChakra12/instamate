    InstaSnap.init();
    if (typeof unsafeWindow !== 'undefined') {
        unsafeWindow.__instamate_instasnap__ = InstaSnap;
    }
