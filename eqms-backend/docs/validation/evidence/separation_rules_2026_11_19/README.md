# Evidence: Separation Rules, review-campaign rules, Object Access Rules for every module (DEV, 2026-11-19)

Run against the DEV stack (backend http://localhost:5000/api, Postgres container `eqms-postgres`). The password goes through the environment variable `DEVPW` only; it is never stored.

| Script | What it proves | Result on 2026-11-19 |
|---|---|---|
| `phase1.py` | Access Review and Audit Trail Review: with the rule OFF today's behaviour is kept; ON, deciding an item about oneself / an own audit entry and completing one's own campaign are refused with `SEPARATION_OF_DUTIES`, nothing changes, and a different person can act | 16/16 |
| `phase2.py` | Separation Rules list, server-side filters, permission and validation negatives, switch ON/OFF with behaviour, audit entry with reason and signature, two rules of one policy independent | 22/22 |
| `phase2_batch.py` | One save of several rules: one signature, one audit entry per policy, a token cannot be used twice, all-or-nothing, no-change writes no audit, refusals change nothing | 15/15 |
| `phase2_training.py` | The Training list of people who can be chosen as approver follows the rule switch | 3/3 |
| `phase3.py` | Object Access Rules for other modules: options, 12 validation refusals, create/enforce (`OUT_OF_SCOPE`), status rule, Document Control unaffected, audit with signature | 30/30 |
| `regress_relations.py` | Replacing required/forbidden relations of a policy works (a defect found while testing: rows were re-persisted, so a rule could never be switched off) | 8/8 |

Unit tests (backend): `UserManagementServiceDocumentRulesSignatureTest`, `SeparationRuleServiceTest`, `SeparationRuleSwitchTest`, `ModuleObjectRuleServiceTest`. Frontend: `SeparationRulesPanel.test.tsx`, `TransitionPolicyDetailView.test.tsx`.

Not covered live: the DEPARTMENT dimension for Training (unit-tested only), Reports and Training objects with a real rule (no suitable records on DEV), concurrency of two administrators saving at once (the policy row is locked `for update`, not exercised under load).
