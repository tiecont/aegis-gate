# AGENTS.md — AegisGate

All engineering agents must follow `prompts/AGENT_OPERATING_RULES.md`. For project orchestration read `prompts/ORCHESTRATOR_PROMPT.md`. The single source of implementation sequencing is `MASTER_AGENT_PLAN.md`; security invariants are in `docs/THREAT_MODEL.md`, and release requirements are in `docs/QUALITY_GATES.md`.

Never run load/abuse/security tests against public third-party endpoints. Never expose credentials/private keys in logs, git or config messages. Never weaken authorization/TLS to get tests passing. All tests and capability claims must be backed by actual evidence.
