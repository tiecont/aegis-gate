#!/bin/sh
# Local official-entrypoint compatibility: preserve argv, drop uid/gid, exec.
set -eu
exec /sbin/su-exec "$@"
