# EQMS evidence map

Read only the section that matches the task.

| Area | Read first | Then trace in source |
|---|---|---|
| Authentication, sessions, permission, object scope | `eqms-backend/docs/system/05_AUTHORIZATION_AND_SESSION_AS_IS.md` | `SecurityConfig`, `AuthTokenFilter`, controller/service/domain authorization path |
| Audit trail and e-signature | `eqms-backend/docs/system/06_AUDIT_AND_ELECTRONIC_SIGNATURE_AS_IS.md` | token issuance/consumption, service transaction, audit entities/migrations, API response disclosure |
| Document–Revision–Controlled Copy | `eqms-backend/docs/system/07_DOCUMENT_CONTROL_LIFECYCLE_ASSURANCE.md`; `eqms-backend/DOCUMENT_CONTROL_CROSS_FLOW_AUDIT_REPORT.md` | controller → service → worker → policy/authorization → entity/repository/migration → FE caller |
| MinIO, Graph, PDF/DOCX publishing | `eqms-backend/docs/system/08_STORAGE_GRAPH_AND_FILE_ASSURANCE_AS_IS.md` | storage/Graph service, transactional caller, file validator/composer, retention/object-version data |
| Async jobs and schedulers | `eqms-backend/docs/system/09_ASYNC_AND_SCHEDULER_ASSURANCE_AS_IS.md` | event producer, AFTER_COMMIT handler, retry/resume, optimistic lock, job/item persistence |
| FE–BE contract | `eqms-backend/docs/system/10_FE_BE_API_CONTRACT_ASSURANCE_AS_IS.md` | controller/DTO versus API adapter/types/component/cache invalidation |
| Requirements, risk, test, release evidence | `eqms-backend/docs/validation/01_INTENDED_USE_DRAFT.md`, `02_TRACEABILITY_MATRIX.md`, `04_TEST_STRATEGY_AND_EVIDENCE_MODEL.md`, `05_RISK_REGISTER_DRAFT.md` | relevant tests, migrations, runtime environment and release evidence |

For an unapproved business choice, consult `eqms-backend/docs/governance/DECISION_LOG.md`; do not infer it from current code.
