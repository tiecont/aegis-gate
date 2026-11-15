/* Isolated feasibility binding: unchanged llhttp owns every framing boundary. */
#include <node_api.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "llhttp.h"

#define MAX_FEED 16384u
#define MAX_WIRE (32u * 1024u * 1024u)
#define MAX_BODY (8u * 1024u * 1024u)
#define MAX_META 16384u
#define MAX_TARGET 2048u
#define MAX_FIELDS 128u
#define MAX_MESSAGES 256u

typedef struct { size_t name, name_len, value, value_len; } field;
typedef struct {
  llhttp_t parser;
  llhttp_settings_t settings;
  uint64_t wire;
  size_t body, meta, target_len, fields, initial_fields;
  char metadata[MAX_META], target[MAX_TARGET];
  field headers[MAX_FIELDS];
  unsigned messages, calls;
  bool complete, headers_ready, paused, terminal, response, head;
} state;
static unsigned live;

static int limit(llhttp_t *p) {
  llhttp_set_error_reason(p, "bounded ingress limit"); return HPE_USER;
}
static int begin(llhttp_t *p) {
  state *s = p->data;
  s->body = s->meta = s->target_len = s->fields = s->initial_fields = 0;
  s->headers_ready = false;
  memset(&s->headers[0], 0, sizeof(field));
  return s->messages >= MAX_MESSAGES ? limit(p) : 0;
}
static int target(llhttp_t *p, const char *at, size_t n) {
  state *s = p->data;
  if (n > MAX_TARGET - s->target_len) return limit(p);
  memcpy(s->target + s->target_len, at, n); s->target_len += n; return 0;
}
static int field_name(llhttp_t *p, const char *at, size_t n) {
  state *s = p->data;
  if (s->fields >= MAX_FIELDS || n > MAX_META - s->meta) return limit(p);
  field *f = &s->headers[s->fields];
  if (!f->name_len) f->name = s->meta;
  memcpy(s->metadata + s->meta, at, n); s->meta += n; f->name_len += n; return 0;
}
static int field_value(llhttp_t *p, const char *at, size_t n) {
  state *s = p->data;
  if (s->fields >= MAX_FIELDS || n > MAX_META - s->meta) return limit(p);
  field *f = &s->headers[s->fields];
  if (!f->value_len) f->value = s->meta;
  memcpy(s->metadata + s->meta, at, n); s->meta += n; f->value_len += n; return 0;
}
static int field_done(llhttp_t *p) {
  state *s = p->data;
  if (s->fields >= MAX_FIELDS) return limit(p);
  s->fields++;
  if (s->fields < MAX_FIELDS) memset(&s->headers[s->fields], 0, sizeof(field));
  return 0;
}
static int headers_done(llhttp_t *p) {
  state *s = p->data;
  s->initial_fields = s->fields;
  if (s->response) return s->head ? 1 : 0;
  s->headers_ready = true; return HPE_PAUSED;
}
static int body(llhttp_t *p, const char *at, size_t n) {
  (void) at; state *s = p->data;
  if (n > MAX_BODY - s->body) return limit(p);
  s->body += n; return 0;
}
static int complete(llhttp_t *p) {
  state *s = p->data; s->complete = true; s->messages++; return HPE_PAUSED;
}
static napi_value num(napi_env e, double n) { napi_value v; napi_create_double(e, n, &v); return v; }
static napi_value str(napi_env e, const char *s, size_t n) {
  napi_value v; napi_create_string_latin1(e, s ? s : "", s ? n : 0, &v); return v;
}
static napi_value boolean(napi_env e, bool b) { napi_value v; napi_get_boolean(e, b, &v); return v; }
static void set(napi_env e, napi_value o, const char *k, napi_value v) { napi_set_named_property(e, o, k, v); }
static napi_value fields(napi_env e, state *s, size_t first, size_t end) {
  napi_value a; napi_create_array_with_length(e, end - first, &a);
  for (size_t i = first; i < end; i++) {
    field *f = &s->headers[i]; napi_value pair; napi_create_array_with_length(e, 2, &pair);
    napi_set_element(e, pair, 0, str(e, s->metadata + f->name, f->name_len));
    napi_set_element(e, pair, 1, str(e, s->metadata + f->value, f->value_len));
    napi_set_element(e, a, i - first, pair);
  }
  return a;
}
static napi_value result(napi_env e, state *s, llhttp_errno_t error, size_t consumed) {
  napi_value o; napi_create_object(e, &o);
  const char *name = llhttp_errno_name(error), *reason = llhttp_get_error_reason(&s->parser);
  set(e, o, "error", str(e, name, strlen(name)));
  set(e, o, "reason", str(e, reason, reason ? strlen(reason) : 0));
  set(e, o, "consumed", num(e, consumed)); set(e, o, "totalConsumed", num(e, (double)s->wire));
  set(e, o, "complete", boolean(e, s->complete));
  set(e, o, "headersReady", boolean(e, s->headers_ready));
  set(e, o, "bodyBytes", num(e, s->body));
  set(e, o, "messages", num(e, s->messages));
  set(e, o, "keepAlive", boolean(e, llhttp_should_keep_alive(&s->parser)));
  if (s->headers_ready && !s->response) {
    const char *method = llhttp_method_name(llhttp_get_method(&s->parser));
    set(e, o, "method", str(e, method, strlen(method)));
    set(e, o, "target", str(e, s->target, s->target_len));
    set(e, o, "major", num(e, llhttp_get_http_major(&s->parser)));
    set(e, o, "minor", num(e, llhttp_get_http_minor(&s->parser)));
    set(e, o, "chunked", boolean(e, (s->parser.flags & F_CHUNKED) != 0));
    set(e, o, "upgrade", boolean(e, llhttp_get_upgrade(&s->parser)));
    set(e, o, "contentLength", num(e, (double)s->parser.content_length));
    set(e, o, "headers", fields(e, s, 0, s->initial_fields));
  }
  if (s->complete) {
    set(e, o, "trailers", fields(e, s, s->initial_fields, s->fields));
    set(e, o, "status", num(e, llhttp_get_status_code(&s->parser)));
  }
  return o;
}
static state *get(napi_env e, napi_callback_info info, size_t *argc, napi_value *argv) {
  napi_value self; state *s = NULL; napi_get_cb_info(e, info, argc, argv, &self, NULL);
  if (napi_unwrap(e, self, (void **)&s) != napi_ok || !s) napi_throw_error(e, NULL, "closed parser");
  return s;
}
static napi_value feed(napi_env e, napi_callback_info info) {
  size_t argc = 1; napi_value argv[1]; state *s = get(e, info, &argc, argv); if (!s) return NULL;
  bool buffer = false; if (argc) napi_is_buffer(e, argv[0], &buffer);
  if (!buffer || s->terminal) { napi_throw_error(e, NULL, "invalid feed"); return NULL; }
  void *data; size_t n; napi_get_buffer_info(e, argv[0], &data, &n);
  if (n > MAX_FEED) { napi_throw_range_error(e, NULL, "feed limit"); return NULL; }
  if (n > MAX_WIRE - s->wire || ++s->calls > MAX_WIRE + 1024u) {
    s->terminal = true; limit(&s->parser); return result(e, s, HPE_USER, 0);
  }
  if (s->paused) { llhttp_resume(&s->parser); s->paused = false; }
  s->complete = false; s->headers_ready = false;
  llhttp_errno_t error = llhttp_execute(&s->parser, data, n);
  size_t used = n;
  if (error != HPE_OK) {
    const char *at = llhttp_get_error_pos(&s->parser);
    if (!at || at < (char *)data || at > (char *)data + n) {
      s->terminal = true; napi_throw_error(e, NULL, "invalid llhttp position"); return NULL;
    }
    used = (size_t)(at - (char *)data);
    if (error == HPE_PAUSED && (s->complete || s->headers_ready)) s->paused = true;
    else s->terminal = true;
  }
  s->wire += used; return result(e, s, error, used);
}
static napi_value finish(napi_env e, napi_callback_info info) {
  size_t argc = 0; state *s = get(e, info, &argc, NULL); if (!s) return NULL;
  if (s->terminal) { napi_throw_error(e, NULL, "terminal parser"); return NULL; }
  if (s->paused) {
    llhttp_resume(&s->parser); s->paused = false;
    llhttp_errno_t r = llhttp_execute(&s->parser, "", 0);
    if (r != HPE_OK) { s->terminal = true; return result(e, s, r, 0); }
  }
  s->complete = s->headers_ready = false; s->terminal = true;
  return result(e, s, llhttp_finish(&s->parser), 0);
}
static void finalize(napi_env e, void *data, void *hint) { (void)e; (void)hint; live--; free(data); }
static napi_value close_parser(napi_env e, napi_callback_info info) {
  size_t argc = 0; napi_value self; state *s = NULL;
  napi_get_cb_info(e, info, &argc, NULL, &self, NULL);
  if (napi_remove_wrap(e, self, (void **)&s) == napi_ok && s) { live--; free(s); }
  napi_value v; napi_get_undefined(e, &v); return v;
}
static napi_value create(napi_env e, napi_callback_info info) {
  size_t argc = 1; napi_value argv[1]; void *response;
  napi_get_cb_info(e, info, &argc, argv, NULL, &response);
  state *s = calloc(1, sizeof(*s));
  if (!s) { napi_throw_error(e, NULL, "allocation failed"); return NULL; }
  s->response = response != NULL;
  if (s->response && argc) napi_get_value_bool(e, argv[0], &s->head);
  llhttp_settings_init(&s->settings);
  s->settings.on_message_begin = begin; s->settings.on_url = target;
  s->settings.on_header_field = field_name; s->settings.on_header_value = field_value;
  s->settings.on_header_value_complete = field_done; s->settings.on_headers_complete = headers_done;
  s->settings.on_body = body; s->settings.on_message_complete = complete;
  llhttp_init(&s->parser, s->response ? HTTP_RESPONSE : HTTP_REQUEST, &s->settings); s->parser.data = s;
  napi_value o; napi_create_object(e, &o);
  if (napi_wrap(e, o, s, finalize, NULL, NULL) != napi_ok) {
    free(s); napi_throw_error(e, NULL, "wrap failed"); return NULL;
  }
  live++;
  napi_property_descriptor methods[] = {
    {"feed", NULL, feed, NULL, NULL, NULL, napi_default, NULL},
    {"finish", NULL, finish, NULL, NULL, NULL, napi_default, NULL},
    {"close", NULL, close_parser, NULL, NULL, NULL, napi_default, NULL}
  };
  napi_define_properties(e, o, 3, methods); return o;
}
static napi_value count_live(napi_env e, napi_callback_info info) { (void)info; return num(e, live); }
NAPI_MODULE_INIT() {
  napi_value fn;
  napi_create_function(env, "createParser", NAPI_AUTO_LENGTH, create, NULL, &fn); set(env, exports, "createParser", fn);
  napi_create_function(env, "createResponseParser", NAPI_AUTO_LENGTH, create, (void *)1, &fn); set(env, exports, "createResponseParser", fn);
  napi_create_function(env, "liveParsers", NAPI_AUTO_LENGTH, count_live, NULL, &fn); set(env, exports, "liveParsers", fn);
  set(env, exports, "stateBytes", num(env, sizeof(state)));
  set(env, exports, "maxFeedBytes", num(env, MAX_FEED));
  set(env, exports, "maxWireBytes", num(env, MAX_WIRE));
  set(env, exports, "llhttpVersionMajor", num(env, LLHTTP_VERSION_MAJOR));
  set(env, exports, "llhttpVersionMinor", num(env, LLHTTP_VERSION_MINOR));
  set(env, exports, "llhttpVersionPatch", num(env, LLHTTP_VERSION_PATCH)); return exports;
}
