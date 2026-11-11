# Security reporting and review

No public production service is operated by this repository at foundation stage.
Before accepting customers, the responsible owner must configure a private
security reporting contact and response ownership. Do not post credentials,
private keys, tokens or customer traffic in public issues.

Every module requires unit, integration and negative tests plus a threat-model
review. Scanner findings are blocking until fixed or explicitly risk-accepted
with scope, expiry, owner and compensating controls. An unavailable scanner is
missing evidence. See ../docs/QUALITY_GATES.md for production requirements.
