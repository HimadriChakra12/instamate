#include "build.h"

#define NAME        ""
#define NAMESPACE   ""
#define DESCRIPTION ""

listout(MATCH,
    ""
    );

listout(GRANT,
    "unsafeWindow",
    "GM_download"
    );

listout(ORDER,
    "src/namespace.js"
    );

int main(void) {
    build_t b;
    build_init(&b, NULL, "__HLS_SAVER_VERSION__"); /* NULL -> tools/VERSION */

    build_meta_t meta = {
        .name = NAME,
        .namespace_ = NAMESPACE,
        .description = DESCRIPTION,
        .match = MATCH, .match_count = MATCH_COUNT,
        .grant = GRANT, .grant_count = GRANT_COUNT,
        .run_at = "document-start",
    };
    build_userscript_header(&b, &meta);

    build_add_all(&b, ORDER, ORDER_COUNT, "src/");
    build_finish(&b, ""); //OUTPUT
    return 0;
}
