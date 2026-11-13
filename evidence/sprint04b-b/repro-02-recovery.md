# Repro02 Startup Failure And Recovery

Retain `repro-02/` unchanged. Its direct verified TLS relay byte control observed
exactly76/76 bytes. The asynchronous `docker run` startup exceeded the8s
readiness deadline. Cleanup's first `docker stop --timeout1` returned exit1
(`No such container`), then the container appeared, started at
2026-11-13T17:09:12.180494663Z. The script still held the shared fixture lock
and awaited the attached Docker CLI; it had not removed PKI or released lock.

Operator-agent recovery used `docker ps --filter name=aegis-sprint04b-b
--no-trunc`, `docker inspect aegis-sprint04b-b-455390 --format '{{json .State}}'`
and `ps -p455848 -o pid,stat,wchan,etimes,args` to identify the exact owned
container/process. Then `docker stop --timeout1 aegis-sprint04b-b-455390`
returned exit0 and that exact name. The attached CLI exited0. Original script
completed its absence check (exit0), removed its key directory and released lock
at2026-11-13T17:10:52.519Z. Cleanup receipt records116476ms; the intended90s
bound was exceeded during recovery, so this is a failed lifecycle attempt,
not a successful bounded experiment. No traffic probe ran through Envoy.

Correction in the next committed source: complete `docker create` before
`docker start --attach`, retain the container name through cleanup and allow30s
readiness. This makes the owned container known before async startup and removes
the demonstrated delayed-create/early-stop race. No unrelated fixture or
container was stopped; no existing failure was discarded.
