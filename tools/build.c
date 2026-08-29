#define BUILD_OUTPUT_FILE "dist/instamate.user.js"
#include "build.h"

#define NAME        "Instamate"
#define NAMESPACE   "https://github.com/HimadriChakra12/Instamate"
#define DESCRIPTION "A combination of multiple instagram userscripts"

listout(MATCH,
    "https://*.instagram.com/*",
    );

listout(GRANT,
    "unsafeWindow",
    "GM_download"
    );

/* Custom @tag lines that don't have a fixed build_meta_t field. */
listtags(EXTRA,
    { "anonstoryview",   "https://update.greasyfork.org/scripts/468385/Instagram%20Anonymous%20Story%20Viewer.user.js" },
    { "reelsramsaver",   "https://update.greasyfork.org/scripts/562931/Instagram%20Reels%20RAM%20Saver.user.js" }
    );

/* Dependency order matters: namespace first, then core utilities before
 * anything that calls them, then ui, then entry.js last since it invokes
 * everything above. */
listout(ORDER,
    "src/anonstoryview/script.js",
    "src/reelsramsaver/script.js",
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
