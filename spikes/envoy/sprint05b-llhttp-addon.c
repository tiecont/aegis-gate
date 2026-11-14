/* Test-only binding. Framing and field validation belong to released llhttp. */
#include <node_api.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include "llhttp.h"

#define STRINGIFY_INNER(value) #value
#define STRINGIFY(value) STRINGIFY_INNER(value)
#define RELEASE_VERSION STRINGIFY(LLHTTP_VERSION_MAJOR) "." \
  STRINGIFY(LLHTTP_VERSION_MINOR) "." STRINGIFY(LLHTTP_VERSION_PATCH)

#define MAX_FEED (32u * 1024u)
#define MAX_WIRE (16u * 1024u * 1024u)
#define MAX_BODY (8u * 1024u * 1024u)
#define MAX_METADATA (16u * 1024u)
#define MAX_TARGET 2048u
#define MAX_MESSAGES 1024u
#define MAX_CALLS 1000000u

typedef struct {
  llhttp_t parser;
  llhttp_settings_t settings;
  uint64_t consumed;
  uint32_t calls;
  uint32_t messages;
  size_t body_bytes, metadata_bytes, target_bytes;
  bool complete;
  bool paused;
  bool terminal;
  bool closed;
  int keep_alive;
} parser_state;

static uint32_t live_parsers;

static int count(llhttp_t *parser, size_t *value, size_t n, size_t max) {
  if (n > max - *value) {
    llhttp_set_error_reason(parser, "test-only parser byte limit");
    return HPE_USER;
  }
  *value += n;
  return 0;
}

static int begin(llhttp_t *parser) {
  parser_state *state = parser->data;
  state->body_bytes = state->metadata_bytes = state->target_bytes = 0;
  if (state->messages >= MAX_MESSAGES) {
    llhttp_set_error_reason(parser, "test-only parser message limit");
    return HPE_USER;
  }
  return 0;
}

static int body(llhttp_t *parser, const char *at, size_t n) {
  (void) at;
  return count(parser, &((parser_state *) parser->data)->body_bytes, n, MAX_BODY);
}

static int metadata(llhttp_t *parser, const char *at, size_t n) {
  (void) at;
  return count(parser, &((parser_state *) parser->data)->metadata_bytes, n, MAX_METADATA);
}

static int target(llhttp_t *parser, const char *at, size_t n) {
  (void) at;
  return count(parser, &((parser_state *) parser->data)->target_bytes, n, MAX_TARGET);
}

static int complete(llhttp_t *parser) {
  parser_state *state = parser->data;
  state->complete = true;
  state->messages++;
  state->keep_alive = llhttp_should_keep_alive(parser);
  return HPE_PAUSED;
}

static napi_value number(napi_env env, double value) {
  napi_value result;
  napi_create_double(env, value, &result);
  return result;
}

static void set(napi_env env, napi_value object, const char *name, napi_value value) {
  napi_set_named_property(env, object, name, value);
}

static napi_value boolean(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

static napi_value string(napi_env env, const char *value) {
  napi_value result;
  napi_create_string_utf8(env, value ? value : "", NAPI_AUTO_LENGTH, &result);
  return result;
}

static void release(parser_state *state) {
  if (!state->closed) {
    state->closed = true;
    live_parsers--;
  }
}

static void finalize(napi_env env, void *data, void *hint) {
  (void) env;
  (void) hint;
  parser_state *state = data;
  release(state);
  free(state);
}

static parser_state *get(napi_env env, napi_callback_info info, size_t *argc,
                         napi_value *argv) {
  napi_value self;
  parser_state *state = NULL;
  napi_get_cb_info(env, info, argc, argv, &self, NULL);
  if (napi_unwrap(env, self, (void **) &state) != napi_ok || !state) {
    napi_throw_type_error(env, NULL, "invalid parser receiver");
    return NULL;
  }
  return state;
}

static napi_value result(napi_env env, parser_state *state, llhttp_errno_t error,
                         size_t consumed) {
  napi_value object;
  napi_create_object(env, &object);
  set(env, object, "error", string(env, llhttp_errno_name(error)));
  set(env, object, "reason", string(env, llhttp_get_error_reason(&state->parser)));
  set(env, object, "consumed", number(env, consumed));
  set(env, object, "totalConsumed", number(env, (double) state->consumed));
  set(env, object, "feedCalls", number(env, state->calls));
  set(env, object, "messages", number(env, state->messages));
  set(env, object, "bodyBytes", number(env, state->body_bytes));
  set(env, object, "metadataBytes", number(env, state->metadata_bytes));
  set(env, object, "targetBytes", number(env, state->target_bytes));
  set(env, object, "complete", boolean(env, state->complete));
  set(env, object, "keepAlive", boolean(env, state->keep_alive != 0));
  return object;
}

static napi_value feed(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  parser_state *state = get(env, info, &argc, argv);
  if (!state) return NULL;
  if (state->closed || state->terminal) {
    napi_throw_error(env, NULL, "parser closed or terminal");
    return NULL;
  }
  bool is_buffer = false;
  if (argc) napi_is_buffer(env, argv[0], &is_buffer);
  if (!is_buffer) {
    napi_throw_type_error(env, NULL, "feed requires a Buffer");
    return NULL;
  }
  void *data;
  size_t length;
  napi_get_buffer_info(env, argv[0], &data, &length);
  if (length > MAX_FEED) {
    napi_throw_range_error(env, NULL, "feed exceeds 32 KiB");
    return NULL;
  }
  if (length > MAX_WIRE - state->consumed || state->calls >= MAX_CALLS) {
    state->terminal = true;
    llhttp_set_error_reason(&state->parser, "test-only parser lifetime limit");
    return result(env, state, HPE_USER, 0);
  }
  if (state->paused) {
    llhttp_resume(&state->parser);
    state->paused = false;
  }
  state->complete = false;
  state->calls++;
  llhttp_errno_t error = llhttp_execute(&state->parser, data, length);
  size_t consumed = length;
  if (error != HPE_OK) {
    const char *position = llhttp_get_error_pos(&state->parser);
    consumed = position ? (size_t) (position - (const char *) data) : 0;
    if (consumed > length) {
      napi_throw_error(env, NULL, "llhttp returned an invalid position");
      state->terminal = true;
      return NULL;
    }
    if (error == HPE_PAUSED && state->complete) state->paused = true;
    else state->terminal = true;
  }
  state->consumed += consumed;
  return result(env, state, error, consumed);
}

static napi_value finish(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  parser_state *state = get(env, info, &argc, NULL);
  if (!state) return NULL;
  if (state->closed || state->terminal) {
    napi_throw_error(env, NULL, "parser closed or terminal");
    return NULL;
  }
  if (state->paused) llhttp_resume(&state->parser);
  state->complete = false;
  llhttp_errno_t error = llhttp_finish(&state->parser);
  state->terminal = true;
  return result(env, state, error, 0);
}

static napi_value close_parser(napi_env env, napi_callback_info info) {
  size_t argc = 0;
  napi_value self;
  parser_state *state = NULL;
  napi_get_cb_info(env, info, &argc, NULL, &self, NULL);
  if (napi_remove_wrap(env, self, (void **) &state) == napi_ok && state) {
    release(state);
    free(state);
  }
  napi_value undefined;
  napi_get_undefined(env, &undefined);
  return undefined;
}

static napi_value create(napi_env env, napi_callback_info info) {
  (void) info;
  parser_state *state = calloc(1, sizeof(*state));
  if (!state) {
    napi_throw_error(env, NULL, "parser allocation failed");
    return NULL;
  }
  llhttp_settings_init(&state->settings);
  state->settings.on_message_begin = begin;
  state->settings.on_url = target;
  state->settings.on_header_field = metadata;
  state->settings.on_header_value = metadata;
  state->settings.on_body = body;
  state->settings.on_message_complete = complete;
  llhttp_init(&state->parser, HTTP_REQUEST, &state->settings);
  state->parser.data = state;
  llhttp_set_lenient_headers(&state->parser, 0);
  napi_value object;
  napi_create_object(env, &object);
  if (napi_wrap(env, object, state, finalize, NULL, NULL) != napi_ok) {
    free(state);
    napi_throw_error(env, NULL, "parser wrap failed");
    return NULL;
  }
  live_parsers++;
  napi_property_descriptor methods[] = {
    { "feed", NULL, feed, NULL, NULL, NULL, napi_default, NULL },
    { "finish", NULL, finish, NULL, NULL, NULL, napi_default, NULL },
    { "close", NULL, close_parser, NULL, NULL, NULL, napi_default, NULL }
  };
  napi_define_properties(env, object, 3, methods);
  return object;
}

static napi_value live(napi_env env, napi_callback_info info) {
  (void) info;
  return number(env, live_parsers);
}

NAPI_MODULE_INIT() {
  napi_value fn;
  napi_create_function(env, "createParser", NAPI_AUTO_LENGTH, create, NULL, &fn);
  set(env, exports, "createParser", fn);
  napi_create_function(env, "liveParsers", NAPI_AUTO_LENGTH, live, NULL, &fn);
  set(env, exports, "liveParsers", fn);
  set(env, exports, "maxFeedBytes", number(env, MAX_FEED));
  set(env, exports, "maxWireBytes", number(env, MAX_WIRE));
  set(env, exports, "maxBodyBytes", number(env, MAX_BODY));
  set(env, exports, "maxMetadataBytes", number(env, MAX_METADATA));
  set(env, exports, "maxTargetBytes", number(env, MAX_TARGET));
  set(env, exports, "maxMessages", number(env, MAX_MESSAGES));
  set(env, exports, "stateBytes", number(env, sizeof(parser_state)));
  set(env, exports, "llhttpVersion", string(env, RELEASE_VERSION));
  return exports;
}
