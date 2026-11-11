# SINGLE MODULE PROMPT (replace `<MODULE_PATH>`)

Read `README.md`, `MASTER_AGENT_PLAN.md`, `prompts/AGENT_OPERATING_RULES.md` and all documents required by `<MODULE_PATH>`. Inspect the actual repository and existing implementations. Execute `<MODULE_PATH>` end to end: plan, implement, tests (positive, negative, tenant-isolation where relevant), documentation, migration and exact command results.

Respect all dependencies and stop conditions. Do not fake completed features or describe code as production-ready without proving release gates. Avoid unauthorized public networks, cloud cost and production DNS. At completion provide the Agent Completion Report exactly as defined in `prompts/AGENT_OPERATING_RULES.md` and indicate the next unblocked module.
