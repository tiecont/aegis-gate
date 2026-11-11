# Read-only preparation evidence

Foundation implementation evidence is now also stored here. See
`00-final-evidence.md` for the accepted gate commands, hashes and review links.
The Pingora metadata below remains research only, not a module01 Go decision.

Collected on 2026-11-11 from the primary-source URLs embedded in each JSON file using Python urllib; no scanner or traffic generation was performed. These metadata files do **not** open or pass module 01.

- GitHub release API and crates.io agree on Pingora 0.9.1 as current stable.
- The release fixes a Tokio >=1.54 connection panic and requires patched zstd dependencies.
- Published Pingora advisories include request smuggling, HTTP/2 Host/:authority confusion, unbounded HTTP/2 resource defaults and Connection-nominated header forwarding. Their patched-version details are preserved verbatim in the advisory API result.
- Upstream release notes mention ignored transitive RustSec advisories. Such upstream exceptions are not automatically accepted by this project; module 01 must inspect the actually enabled feature tree and module 00/11 scan policy must not silently suppress them.

Sources: [Pingora 0.9.1](https://github.com/cloudflare/pingora/releases/tag/0.9.1), [published security advisories](https://github.com/cloudflare/pingora/security/advisories), [crate registry API](https://crates.io/api/v1/crates/pingora).
