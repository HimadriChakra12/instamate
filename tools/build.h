#ifndef BUILD_H
#define BUILD_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifndef BUILD_MAX_FILE
#define BUILD_MAX_FILE (1024 * 1024)
#endif
#ifndef BUILD_MAX_OUTPUT
#define BUILD_MAX_OUTPUT (8 * 1024 * 1024)
#endif
#ifndef BUILD_MAX_HEADER
#define BUILD_MAX_HEADER 4096
#endif

#ifndef BUILD_VERSION_PATH
#define BUILD_VERSION_PATH "tools/VERSION"
#endif

typedef struct {
    char   *out;
    size_t  out_len;
    char   *version;
    char   *placeholder;
} build_t;

typedef struct {
    const char *key;
    const char *value;
} build_tag_t;

typedef struct {
    const char *name;
    const char *namespace_;
    const char *description;
    const char *const *match;
    size_t match_count;
    const char *const *grant;
    size_t grant_count;
    const char *run_at;
    const build_tag_t *extra;
    size_t extra_count;
} build_meta_t;

#define declaremeta(name, ...) \
    static build_meta_t name = { __VA_ARGS__ }

#define listout(name, ...) \
    static const char *name[] = { __VA_ARGS__ }; \
    enum { name##_COUNT = sizeof(name) / sizeof(name[0]) }

#define listtags(name, ...) \
    static const build_tag_t name[] = { __VA_ARGS__ }; \
    enum { name##_COUNT = sizeof(name) / sizeof(name[0]) }

static char *build__read_file(const char *path, long *out_len) {
    FILE *f = fopen(path, "rb");
    if (!f) {
        fprintf(stderr, "build: missing source file: %s\n", path);
        exit(1);
    }
    char *buf = malloc(BUILD_MAX_FILE);
    if (!buf) { perror("malloc"); exit(1); }
    long n = fread(buf, 1, BUILD_MAX_FILE - 1, f);
    fclose(f);
    buf[n] = '\0';
    if (out_len) *out_len = n;
    return buf;
}

static char *build__read_version(const char *path) {
    long n;
    char *v = build__read_file(path, &n);
    while (n > 0 && (v[n - 1] == '\n' || v[n - 1] == '\r' || v[n - 1] == ' ')) {
        v[--n] = '\0';
    }
    return v;
}

static size_t build__append_subst(char *dst, size_t dst_len, const char *src,
                                   const char *needle, const char *replacement) {
    size_t needle_len = strlen(needle);
    size_t repl_len = strlen(replacement);
    const char *p = src;

    while (*p) {
        const char *match = strstr(p, needle);
        if (!match) {
            size_t rest = strlen(p);
            memcpy(dst + dst_len, p, rest);
            dst_len += rest;
            break;
        }
        size_t chunk = (size_t)(match - p);
        memcpy(dst + dst_len, p, chunk);
        dst_len += chunk;
        memcpy(dst + dst_len, replacement, repl_len);
        dst_len += repl_len;
        p = match + needle_len;
    }
    return dst_len;
}

static void build_init(build_t *b, const char *version_path, const char *placeholder) {
    b->out = malloc(BUILD_MAX_OUTPUT);
    if (!b->out) { perror("malloc"); exit(1); }
    b->out_len = 0;

    if (!version_path) version_path = BUILD_VERSION_PATH;
    b->version = (version_path[0] == '\0') ? NULL : build__read_version(version_path);
    b->placeholder = (char *)placeholder;
}

static void build_write_header(build_t *b, const char *header_template) {
    char header[BUILD_MAX_HEADER];
    int hlen = snprintf(header, sizeof(header), header_template,
                         b->version ? b->version : "");
    if (hlen < 0 || (size_t)hlen >= sizeof(header)) {
        fprintf(stderr, "build: header template too long (raise BUILD_MAX_HEADER)\n");
        exit(1);
    }
    memcpy(b->out + b->out_len, header, (size_t)hlen);
    b->out_len += (size_t)hlen;
}

static void build_userscript_header(build_t *b, const build_meta_t *m) {
    char line[1024];
    int n;

#define BUILD__EMIT(fmt, ...) do { \
        n = snprintf(line, sizeof(line), fmt, __VA_ARGS__); \
        memcpy(b->out + b->out_len, line, (size_t)n); \
        b->out_len += (size_t)n; \
    } while (0)

    BUILD__EMIT("%s", "// ==UserScript==\n");
    if (m->name)         BUILD__EMIT("// @name         %s\n", m->name);
    if (m->namespace_)   BUILD__EMIT("// @namespace    %s\n", m->namespace_);
    BUILD__EMIT("// @version      %s\n", b->version ? b->version : "0.0.0");
    if (m->description)  BUILD__EMIT("// @description  %s\n", m->description);
    for (size_t i = 0; i < m->match_count; i++)
        BUILD__EMIT("// @match        %s\n", m->match[i]);
    for (size_t i = 0; i < m->grant_count; i++)
        BUILD__EMIT("// @grant        %s\n", m->grant[i]);
    for (size_t i = 0; i < m->extra_count; i++)
        BUILD__EMIT("// @%-12s %s\n", m->extra[i].key, m->extra[i].value);
    BUILD__EMIT("// @run-at       %s\n", m->run_at ? m->run_at : "document-start");
    BUILD__EMIT("%s", "// ==/UserScript==\n\n");

#undef BUILD__EMIT
}

static void build_raw(build_t *b, const char *text) {
    size_t len = strlen(text);
    memcpy(b->out + b->out_len, text, len);
    b->out_len += len;
}

static void build_add(build_t *b, const char *path, const char *strip_prefix) {
    long len;
    char *content = build__read_file(path, &len);

    const char *display = path;
    if (strip_prefix) {
        size_t plen = strlen(strip_prefix);
        if (strncmp(path, strip_prefix, plen) == 0) display = path + plen;
    }

    char marker[512];
    int mlen = snprintf(marker, sizeof(marker), "// ---- %s ----\n", display);
    memcpy(b->out + b->out_len, marker, (size_t)mlen);
    b->out_len += (size_t)mlen;

    if (b->placeholder) {
        b->out_len = build__append_subst(b->out, b->out_len, content,
                                          b->placeholder, b->version ? b->version : "");
    } else {
        size_t clen = strlen(content);
        memcpy(b->out + b->out_len, content, clen);
        b->out_len += clen;
    }
    b->out[b->out_len++] = '\n';

    free(content);
}

static void build_add_all(build_t *b, const char *const *paths, size_t count,
                           const char *strip_prefix) {
    for (size_t i = 0; i < count; i++) {
        build_add(b, paths[i], strip_prefix);
    }
}

static void build_finish(build_t *b, const char *out_path) {
#ifdef BUILD_OUTPUT_FILE
    if (!out_path) out_path = BUILD_OUTPUT_FILE;
#endif
    if (!out_path) {
        fprintf(stderr, "build: build_finish() needs an output path -- either "
                         "pass one, or #define BUILD_OUTPUT_FILE before #include \"build.h\"\n");
        exit(1);
    }

    char dir[1024];
    const char *slash = strrchr(out_path, '/');
    if (slash) {
        size_t dlen = (size_t)(slash - out_path);
        if (dlen >= sizeof(dir)) dlen = sizeof(dir) - 1;
        memcpy(dir, out_path, dlen);
        dir[dlen] = '\0';

        char cmd[1152];
        snprintf(cmd, sizeof(cmd), "mkdir -p '%s'", dir);
        if (system(cmd) != 0) {
            fprintf(stderr, "build: failed to create %s\n", dir);
            exit(1);
        }
    }

    FILE *f = fopen(out_path, "wb");
    if (!f) { perror("fopen"); exit(1); }
    fwrite(b->out, 1, b->out_len, f);
    fclose(f);

    printf("Built %s (%zu bytes%s%s)\n", out_path, b->out_len,
           b->version ? ", v" : "", b->version ? b->version : "");

    free(b->out);
    free(b->version);
    b->out = NULL;
    b->version = NULL;
}

#endif /* BUILD_H */
