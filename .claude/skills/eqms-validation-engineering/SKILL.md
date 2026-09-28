---
name: eqms-validation-engineering
description: Trace, change, or review EQMS regulated workflows when Document Control, access, e-signature, audit, storage, policies, or validation evidence are involved. Use for source-backed assurance work; not for ordinary cosmetic UI edits.
---

# Eqms Validation Engineering

Use this skill for changes or reviews that can affect the intended use, lifecycle, authorization, data integrity, electronic records/signatures, external files, or validation evidence of EQMS.

## Ground truth and boundaries

- Read `eqms-backend/docs/system/00_EVIDENCE_CONVENTIONS.md` before making a finding or requirement claim. Label conclusions as source-confirmed, runtime-confirmed, test-confirmed, suspected, or pending decision.
- Read the relevant entry in `eqms-backend/docs/system/` before modifying the corresponding area. The source defines **As-Is**; it does not approve **To-Be** GMP behavior.
- Read `eqms-backend/docs/governance/DECISION_LOG.md` and stop for a named owner decision if the implementation depends on an unapproved business rule (for example, parent/child terminal transition, signature meaning, retention, or data disclosure).
- Treat status/permission/reason codes as stable machine values. Never make server logic, API filtering, authorization, or storage paths depend on a translated display label.

## Workflow for code work

1. Use GitNexus query/context to trace the endpoint, service, worker/scheduler, repository/entity/migration, DTO, and frontend caller. Do not infer behavior from a name or comment alone.
2. For every function/class/method to edit, run upstream GitNexus impact analysis first. Report direct callers, affected processes, and risk; pause for the user if risk is HIGH/CRITICAL.
3. State the invariant affected: actor + permission/object scope + lifecycle + parent/child + artefact version + e-signature/audit + async generation when applicable.
4. Implement only after that invariant is explicit. Keep business transition and mandatory audit/signature in the same reliable transaction or an explicitly persisted/outbox workflow.
5. Add or update the narrowest meaningful negative, integration, concurrency, or failure-injection test. A happy-path test alone is not sufficient for a regulated state transition.
6. Before commit, run GitNexus `detect_changes` against `main`, then record evidence and unresolved risk in the traceability matrix/backlog when the change affects a regulated behavior.

## High-risk EQMS checks

- **Document Control:** never allow a Controlled Copy action merely because child status appears valid; evaluate parent Document/Revision validity at commit/worker time.
- **Async/external file work:** re-read current state/generation before committing worker results; reconcile objects written before a DB rollback/stale check, respecting WORM retention.
- **Graph/Office Online:** do not record edit access as revoked until remote revoke is confirmed. Model pending/failed revoke and protect downstream workflow accordingly.
- **Audit/e-signature:** do not silently downgrade mandatory evidence to best-effort logging. Signature tokens are single-use per transaction; do not introduce a replay path.
- **API/FE:** capability responses are UI hints, never authorization. Keep FE action keys/schema aligned with backend DTO output and preserve stable reason codes.

## References

Read [references/evidence-map.md](references/evidence-map.md) to select the source-backed docs and evidence required for the requested area.

For focused work, load the matching specialist project skill from `.claude/skills/`:
`eqms-source-navigation`, `eqms-lifecycle-assurance`, `eqms-authorization-assurance`,
`eqms-file-integration-assurance`, `eqms-async-resilience-assurance`,
`eqms-api-contract-assurance`, `eqms-operational-records-assurance`,
`eqms-configuration-continuity-assurance`, `eqms-test-evidence`, or
`eqms-release-readiness`. The routing table is maintained in
`eqms-backend/docs/validation/09_ASSURANCE_OPERATING_MODEL.md`.
