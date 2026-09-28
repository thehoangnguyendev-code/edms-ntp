# Module Authorization Inventory

This is the scope authority for the Authorization Platform program. A feature is not allowed to add permission, workflow-policy or generic-participant implementation until it is classified **Live** and has an approved Action Catalog row.

| Classification | Module / resource | Persistence and mutation status | Authorization delivery status | Rule |
|---|---|---|---|---|
| Live | Documents / `DOCUMENT_REVISION` | Persistent workflow and mutations | Integrated through revision evaluator, capability API, scope guard, participant eligibility and e-signature contract | Continue action-by-action migration under feature flags. |
| Live | Documents / `CONTROLLED_COPY`, `CONTROLLED_COPY_BATCH` | Persistent lifecycle and mutations | Integrated through controlled-copy evaluator, capability API and source-document scope guard | Treat as independent lifecycle; never reuse revision policy rows. |
| Live | Security & Authorization | Persistent administration | Access Profile, policy, scope, SoD and e-signature administration are in scope | Use aggregate configuration API; no view permission may mutate. |
| Live | Work Management / `WORK_PROJECT` | Persistent project membership and issue mutations | Module entitlement plus project-membership capability adapter | Project roles remain record membership, never Access Profiles. |
| Cross-cutting | Audit Trail, Notifications, Navigation, My Tasks | Consumers | Must consume backend decisions/audit data; cannot create policy or permission semantics | My Tasks remains deferred from integration until a persistent work-item API exists. |
| Deferred | Standalone Training | Not part of current Documents workflow | No authorization platform implementation | Reassess only with a persistent controller and Action Catalog. |
| Deferred | CAPA, Change Control, Complaints, Deviations, Equipment, Product, Regulatory, Risk, Supplier, Report | Mock-only or no persistent controller | No authorization platform implementation | A module must complete its Module Authorization Contract before its first write action. |

## Entry criteria for a Deferred module

1. Persistent business record and mutation controller exist.
2. BA/QA/Compliance approve every action in the Global Action Catalog.
3. The module supplies state, owner/participant and scope facts through an adapter.
4. The module has endpoint enforcement and regression tests before its UI consumes capabilities.

