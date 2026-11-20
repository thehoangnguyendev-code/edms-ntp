-- V832: the shadow comparison of the Hybrid engine is removed (Decision SECURITY-AUTHORIZATION-SHADOW-REMOVAL-2026-11-20).
--
-- Every step of every module that went through the gate is decided by the engine alone, always on and fail-closed (Document and Controlled Copy had been
-- before: DocumentMasterWorkflowAuthorizationService and ControlledCopyAuthorizationService call the engine and no other code path; the one Document
-- action that still compared the engine with a permission check, UPDATE_METADATA, is engine-only now). Nothing writes or reads the table of mismatches any
-- more; it held no row on DEV since V823 (348,491 rows, none with a different allow/deny between the engine and the service, were deleted on 2026-11-20).
DROP TABLE IF EXISTS authorization_shadow_evaluation_events;
