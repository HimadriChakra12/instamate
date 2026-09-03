#define BUILD_OUTPUT_FILE "dist/instamate.user.js"
#include "build.h"

#define NAME        "Instamate"
#define NAMESPACE   "https://github.com/HimadriChakra12/Instamate"
#define DESCRIPTION "A combination of multiple instagram userscripts"

listout(MATCH,
    "https://*.instagram.com/*",
    "https://*.instagram.com/direct/t/*",
    );

listout(GRANT,
    "unsafeWindow",
    "GM_download",
    "GM_getValue",
    "GM_setValue"
    );

/* Custom @tag lines that don't have a fixed build_meta_t field. */
listtags(EXTRA,
    { "anonstoryview",   "https://update.greasyfork.org/scripts/468385/Instagram%20Anonymous%20Story%20Viewer.user.js" },
    { "reelsramsaver",   "https://update.greasyfork.org/scripts/562931/Instagram%20Reels%20RAM%20Saver.user.js" },
//    { "pipinstavideocall",   "https://update.greasyfork.org/scripts/486404/pip%20insta%20video%20call.user.js" },
//    { "storyviewersearch",   "https://update.greasyfork.org/scripts/590249/Instagram%20Plus%20%28Web%29.user.js" },
    { "msgname",   "Generated" },
    );

/* Dependency order matters: namespace first, then core (settings before ui,
 * since ui reads the opt/addon manifests settings.js defines), then opts,
 * then addons, then end.js last. */
listout(ORDER,
    "src/start.js",
    "src/core/settings.js",
    "src/core/ui.js",
    "src/opts/anonstoryview/script.js",
    "src/opts/reelsramsaver/script.js",
    "src/opts/msgname/script.js",
    "src/addons/shared-media/script.js",
//    "src/pipinstavideocall/script.js",
//    "src/storyviewersearch/script.js",
    "src/end.js",
    );

declaremeta(META,
    .name = NAME,
    .namespace_ = NAMESPACE,
    .description = DESCRIPTION,
    .match = MATCH, .match_count = MATCH_COUNT,
    .grant = GRANT, .grant_count = GRANT_COUNT,
    .run_at = "document-start",
    .extra = EXTRA, .extra_count = EXTRA_COUNT,
);

int main(void) {
    build_t b;
    build_init(&b, NULL, "__HLS_SAVER_VERSION__"); /* NULL -> tools/VERSION */
    build_userscript_header(&b, &META);
    build_add_all(&b, ORDER, ORDER_COUNT, "src/");
    build_finish(&b, NULL); /* NULL -> BUILD_OUTPUT_FILE */
    return 0;
}
