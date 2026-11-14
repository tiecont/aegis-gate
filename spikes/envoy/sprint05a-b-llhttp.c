/* Test-only driver: all HTTP framing and field validation is upstream llhttp. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "llhttp.h"

static const char *base;
static char url[8192];
static size_t url_len;
static unsigned completed;
static int first_event = 1;
static int keep_alive[128];

static void hex(const char *p, size_t n) {
  putchar('"');
  for (size_t i = 0; i < n; i++) printf("%02x", (unsigned char) p[i]);
  putchar('"');
}
static void event(const char *kind, llhttp_t *p, const char *at, size_t n) {
  if (!first_event) putchar(',');
  first_event = 0;
  printf("{\"kind\":\"%s\",\"trailer\":%s,\"offset\":%zu,\"hex\":", kind,
         p->flags & F_TRAILING ? "true" : "false", (size_t) (at - base));
  hex(at, n); putchar('}');
}
static int begin(llhttp_t *p) { (void) p; url_len = 0; return 0; }
static int target(llhttp_t *p, const char *at, size_t n) {
  (void) p;
  if (url_len + n > sizeof(url)) return HPE_USER;
  memcpy(url + url_len, at, n); url_len += n; return 0;
}
static int field(llhttp_t *p, const char *at, size_t n) { event("field", p, at, n); return 0; }
static int value(llhttp_t *p, const char *at, size_t n) { event("value", p, at, n); return 0; }
static int headers(llhttp_t *p) { (void) p; return 0; }
static int complete(llhttp_t *p) {
  if (completed == 128) return HPE_USER;
  keep_alive[completed] = llhttp_should_keep_alive(p);
  completed++; return HPE_PAUSED;
}

int main(int argc, char **argv) {
  char input[65537];
  size_t n = fread(input, 1, sizeof(input), stdin);
  if (n == sizeof(input) || ferror(stdin)) return 2;
  base = input;
  size_t step = argc > 1 ? (size_t) strtoul(argv[1], NULL, 10) : n;
  if (!step) step = n ? n : 1;
  llhttp_settings_t settings;
  llhttp_settings_init(&settings);
  settings.on_message_begin = begin; settings.on_url = target;
  settings.on_header_field = field; settings.on_header_value = value;
  settings.on_headers_complete = headers; settings.on_message_complete = complete;
  llhttp_t parser;
  llhttp_init(&parser, HTTP_REQUEST, &settings);
  llhttp_set_lenient_headers(&parser, 0);
  if (argc > 2 && strcmp(argv[2], "relaxed") == 0)
    llhttp_set_lenient_header_value_relaxed(&parser, 1);
  printf("{\"version\":\"%d.%d.%d\",\"events\":[", LLHTTP_VERSION_MAJOR,
         LLHTTP_VERSION_MINOR, LLHTTP_VERSION_PATCH);
  size_t pos = 0;
  size_t ends[128], lengths[128];
  char urls[128][8192];
  llhttp_errno_t err = HPE_OK;
  while (pos < n && completed < 128) {
    size_t count = n - pos < step ? n - pos : step;
    err = llhttp_execute(&parser, input + pos, count);
    if (err == HPE_PAUSED) {
      size_t next = (size_t) (llhttp_get_error_pos(&parser) - base);
      ends[completed - 1] = next; lengths[completed - 1] = url_len;
      memcpy(urls[completed - 1], url, url_len);
      pos = next; llhttp_resume(&parser); err = HPE_OK;
    } else if (err != HPE_OK) {
      pos = (size_t) (llhttp_get_error_pos(&parser) - base); break;
    } else pos += count;
  }
  printf("],\"messages\":[");
  for (unsigned i = 0; i < completed; i++) {
    if (i) putchar(',');
    printf("{\"end\":%zu,\"keep_alive\":%s,\"target_hex\":", ends[i], keep_alive[i] ? "true" : "false");
    hex(urls[i], lengths[i]); putchar('}');
  }
  printf("],\"consumed\":%zu,\"input_bytes\":%zu,\"error\":\"%s\",\"reason_hex\":",
         pos, n, llhttp_errno_name(err));
  const char *reason = llhttp_get_error_reason(&parser);
  hex(reason ? reason : "", reason ? strlen(reason) : 0);
  printf(",\"lenient_flags\":%u,\"complete_count\":%u}\n", parser.lenient_flags, completed);
  return 0;
}
