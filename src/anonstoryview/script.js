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
