# Capture correction

The initial cleanup collector inspected all local containers and retained full
configuration. Four inspection streams from attempts01/02 were removed because
they included unrelated environment fields. Original byte counts and SHA256
remain in command records for audit; these streams are intentionally unavailable
and those commands are ineligible evidence. No values are reproduced here.
All original protocol results and raw failure streams are retained unchanged.

The local, unpushed receipt commit containing attempt01 was replaced to remove
this material from reachable history. Attempt02 names that retired receipt
commit as its collection head; its implementation source is unchanged from
1626bf4249554dfc6a6721aa3a3702630a1ca50b, and per-source hashes remain recorded.
Neither attempt is the final eligible handoff proof. The collector is corrected
to enumerate only candidate names and request only mount fields, then collect
a fresh exact-source attempt. No public publication or remote push occurred.

Only this agent's abandoned commit objects and sensitive inspection blob were
removed from the shared local object store after reachability checks. Existing
referenced objects and other worktrees' histories were preserved. The verifier
checks that the inspection blob is unavailable. Attempts01/02 retain explicit
withheld-stream records; their SHA256 inventories cover only retained files.
