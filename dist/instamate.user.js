// ==UserScript==
// @name         Instamate
// @namespace    https://github.com/HimadriChakra12/Instamate
// @version      1.0.02
// @description  A combination of multiple instagram userscripts
// @match        https://*.instagram.com/*
// @grant        unsafeWindow
// @grant        GM_download
// @anonstoryview https://update.greasyfork.org/scripts/468385/Instagram%20Anonymous%20Story%20Viewer.user.js
// @reelsramsaver https://update.greasyfork.org/scripts/562931/Instagram%20Reels%20RAM%20Saver.user.js
// @run-at       document-start
// ==/UserScript==

// ---- start.js ----
(() => {
  'use strict';

// ---- anonstoryview/script.js ----
// Store a reference to the original send method of XMLHttpRequest
var originalXMLSend = XMLHttpRequest.prototype.send;
// Override the send method
XMLHttpRequest.prototype.send = function() {
    // Check if the request URL contains the "viewSeenAt" string
    if (typeof arguments[0] === "string" && arguments[0].includes("viewSeenAt")) {
        // Block the request by doing nothing
        // This prevents the "viewSeenAt" field from being sent
    } else {
        // If the request URL does not contain "viewSeenAt",
        // call the original send method to proceed with the request
        originalXMLSend.apply(this, arguments);
    }
};

// ---- reelsramsaver/script.js ----
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

// ---- end.js ----
})();

