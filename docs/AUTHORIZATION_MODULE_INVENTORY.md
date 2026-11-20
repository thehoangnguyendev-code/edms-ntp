# Module Authorization Inventory

This is the scope authority for the Authorization Platform program. A feature is not allowed to add permission, workflow-policy or generic-participant implementation until it is classified **Live** and has an approved Action Catalog row.

| Classification | Module / resource | Persistence and mutation status | Authorization delivery status | Rule |
|---|---|---|---|---|
| Live | Documents / `DOCUMENT_REVISION` | Persistent workflow and mutations | Integrated through revision evaluator, capability API, record visibility by Access Profile level, participant eligibility and e-signature contract | Continue action-by-action migration under feature flags. |
| Live | Documents / `CONTROLLED_COPY`, `CONTROLLED_COPY_BATCH` | Persistent lifecycle and mutations | Integrated through controlled-copy evaluator, capability API and record visibility by the flow of the copy's revision | Treat as independent lifecycle; never reuse revision policy rows. |
| Live | Security & Authorization | Persistent administration | Access Profile (with its record-visibility levels), policy, SoD and e-signature administration are in scope | Use aggregate configuration API; no view permission may mutate. |
| Live | Work Management / `WORK_PROJECT` | Persistent project membership and issue mutations | Module entitlement plus project-membership capability adapter | Project roles remain record membership, never Access Profiles. |
| Cross-cutting | Audit Trail, Notifications, Navigation, My Tasks | Consumers | Must consume backend decisions/audit data; cannot create policy or permission semantics | My Tasks remains deferred from integration until a persistent work-item API exists. |
| Live (catalog pending approval) | Training (7 lifecycles: Requirement, Matrix, Activity, Assessment, Job assignment, Personnel review, Specimen) | Persistent controllers (237 routes) and mutations | Flat permissions plus `TrainingAccess` (no engine yet): approval steps in `TrainingApprovalService.STEPS` | Reclassified 2026-11-18. Catalog approved as is; all lifecycles have policies in Workflow Authorization (V810-V812). Old permission / scope checks deleted for 10 types; signature steps (approval assignments) keep their check after the engine; Record export, Export batch and Trainer exception only shadow/flag. |
| Live (catalog pending approval) | Report (template and revision, run and artifact, schedule, legal hold) | Persistent controllers (65 routes), revision lifecycle, e-signature | Local `require(...)` in the Report services (no engine yet): independent-approver check and GMP variant are in code | Template review on the engine behind a flag (OFF on DEV); schedule, run, file legal hold have policies (V807-V813) and shadow checks; schedule, run and file legal hold: old checks deleted, engine decides alone. As-Is Action Catalog: `docs/AUTHORIZATION_ACTION_CATALOG_REPORT_AS_IS_2026_11_18.md`. |
| Live | Documents / `UNCONTROLLED_COPY` (distribute, cancel) | Persistent lifecycle and mutations | Policies in Workflow Authorization (V815); old checks deleted, the engine decides alone | Added 2026-11-18 (owner directive: every module as it is in code). |
| Live | Access Review and Audit Trail Review campaigns (decide item, complete, cancel) | Persistent campaigns | Policies in Workflow Authorization (V814); old checks deleted, the engine decides alone | Added 2026-11-18. |
| Live, exception | Backup & Restore | Controllers proxy to the external backup agent | Flat permissions plus SoD "Propose vs Approve Backup Policy Change"; lifecycle state is not in this repository, so no adapter | Decided 2026-11-18: stays outside the engine unless the agent exposes its state. |
| Deferred | CAPA, Change Control, Complaints, Deviations, Equipment, Product, Regulatory, Risk, Supplier | Mock-only or no persistent controller | No authorization platform implementation | A module must complete its Module Authorization Contract before its first write action. |

## Entry criteria for a Deferred module

1. Persistent business record and mutation controller exist.
2. BA/QA/Compliance approve every action in the Global Action Catalog.
3. The module supplies state, owner/participant and scope facts through an adapter.
4. The module has endpoint enforcement and regression tests before its UI consumes capabilities.


> 2026-11-20: Modules without records, states or a department (Notifications, Self-Service, Audit Trail, Backup & Restore, Security & Authorization incl. Access Review, Application Settings, System Administration, Preferences, System Information) have no visibility levels: whoever holds the permission enters. Only Document Control, Training and Reports have levels.
