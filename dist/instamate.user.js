// ==UserScript==
// @name         Instamate
// @namespace    https://github.com/HimadriChakra12/Instamate
// @version      1.0.03
// @description  A combination of multiple instagram userscripts
// @match        https://*.instagram.com/*
// @grant        unsafeWindow
// @grant        GM_download
// @anonstoryview https://update.greasyfork.org/scripts/468385/Instagram%20Anonymous%20Story%20Viewer.user.js
// @reelsramsaver https://update.greasyfork.org/scripts/562931/Instagram%20Reels%20RAM%20Saver.user.js
// @pipinstavideocall https://update.greasyfork.org/scripts/486404/pip%20insta%20video%20call.user.js
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

// ---- pipinstavideocall/script.js ----
// Function to update video attributes
function updateVideoAttributes() {
    const videos = document.querySelectorAll('video');

    videos.forEach(video => {
        video.removeAttribute('disablepictureinpicture');
        video.setAttribute('disablepictureinpicturee', '');
    });
}

// Wait for 10 seconds before running the script
setTimeout(function() {
    // Create a button
    const button = document.createElement('button');
    button.innerHTML = 'PIP';
    button.style.cssText = 'position: absolute; right: 40%; bottom: 1.5%; transform: translateY(-50%); background: gray; border-radius: 50%; padding: 8px; cursor: pointer; margin-right: 0;';
    document.body.appendChild(button);

    // Show alert and wait for user confirmation
    const confirmation = confirm("PIP mode will be enabled after 20 seconds. Do you want to proceed?");

    if (confirmation) {
        // Automatically click the button after 10 seconds
        setTimeout(function() {
            button.click();
            console.log("PIP enabled in insta video call");
        }, 20000);
    } else {
        alert("PIP activation canceled.");
    }

    // Add event listener to the button
    button.addEventListener('click', function() {
        updateVideoAttributes();
    });
}, 10000);

// ---- end.js ----
})();

