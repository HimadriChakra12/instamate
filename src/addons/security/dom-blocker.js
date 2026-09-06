// fetch/XHR patching (network.js) only catches requests JavaScript
    // makes itself -- it does nothing for a <script src="..."> or
    // <img src="..."> tag inserted straight into the DOM, since the
    // browser fetches those through its own resource loader, bypassing
    // page JS entirely. This closes that gap for the same blocklist
    // (im_isBlockedTelemetryUrl, defined in network.js) by intercepting
    // the `src` property itself on script/img elements, so a blocked URL
    // never has a chance to actually start loading.
    Security.blockTrackerElements = function blockTrackerElements() {
        [HTMLScriptElement, HTMLImageElement].forEach((ElementClass) => {
            const descriptor = Object.getOwnPropertyDescriptor(ElementClass.prototype, 'src')
                || Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src');
            if (!descriptor?.set) return;

            Object.defineProperty(ElementClass.prototype, 'src', {
                configurable: true,
                enumerable: descriptor.enumerable,
                get: descriptor.get,
                set(value) {
                    if (im_isBlockedTelemetryUrl(value)) {
                        Security.blockedElementCount++;
                        return; // never assigned -- the element never loads
                    }
                    descriptor.set.call(this, value);
                },
            });
        });

        // setAttribute('src', ...) bypasses the property setter above
        // entirely, so it needs its own check.
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function setAttribute(name, value) {
            if (name === 'src' && (this instanceof HTMLScriptElement || this instanceof HTMLImageElement) && im_isBlockedTelemetryUrl(value)) {
                Security.blockedElementCount++;
                return;
            }
            return originalSetAttribute.call(this, name, value);
        };
    };
