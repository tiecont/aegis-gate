# AGENT 10 — Infrastructure, Deploy, GitOps and Runbooks

**Dependency:** 04..09 major interfaces. **Gate:** `M4-OPS`.

## Tasks

1. Build minimal, non-root OCI images for Go/Rust/dashboard; immutable digest, read-only root FS where possible, user/group scoping and signal-aware shutdown.
2. Create Helm/Kustomize manifests: edge Deployment/DaemonSet (justify choice), control API, worker, dashboard, NetworkPolicy, PodSecurity, RBAC, HPA, PDB, probes and resource requests/limits.
3. Separate admin ingress from customer ingress; public tenant traffic enters through L4/managed provider path, preserving TLS termination ownership documented in ADR.
4. Configure cert/secrets integration, per-service permissions, distinct config signing keys, KMS policy and staged key rotation.
5. Deploy isolated Postgres with durable backup/PITR, JetStream durable queue, Redis suitable to global quota contract, OTel collector. Prefer managed services if operator burden justifies cost.
6. Add GitOps pipeline (Argo CD optional) with environment overlays, nonprod and prod approval gates, canary/rolling, auto-safety rollback for binary but explicit config revision rules.
7. Set resource limits and capacity budget so node loss doesn't immediately overload remaining edges; document HPA versus long-lived connections.
8. Configure central alerts, SLO dashboards, secret expiry alerts, config status, egress/cost budget and pager integration.
9. Exercise backup restore, one-edge crash, partial zone failure, Redis timeout, NATS outage, Go admin unavailable, telemetry outage.
10. Document deployment, rollbacks, disaster recovery, certificate emergency reissue, customer notice workflow and operator break-glass permissions.

## Acceptance

- Terraform/infra manifests reproducible in staging with no hardcoded credentials.
- Public listener and management API have verified network isolation.
- Service can continue existing routing during control plane downtime; new policy rollout appropriately fails and alerts.
- Restore from backup produces correct test tenant data and valid config revision; cert secrets recovered through separate process.
- Graceful rolling upgrade preserves availability for declared connection/client mix.

## Security focus

No wildcard cluster-admin privileges for app pods, no hostPath/privileged container without reviewed exception, no public database/Redis/NATS. Gate production changes behind explicit human authorization.

## Deliverables

Helm/Kustomize/infra, staging CI/CD, observability alerts, validated operational runbooks.
