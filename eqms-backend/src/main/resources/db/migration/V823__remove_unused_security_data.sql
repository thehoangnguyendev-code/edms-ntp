-- V823: removal of data that nothing reads any more (owner decision 2026-11-19: "bảng shadow 348 nghìn dòng, hãy xoá đi"; make the Security & Authorization module simpler).
--
-- 1. The rows of the shadow evaluation (the engine against the old check) that were written between 2026-08-07 and 2026-08-11. Not one of them was a difference of allow/deny (policy_allowed = legacy_allowed in
--    all 348,491 rows: they differ only in the wording of the reason). Nothing has been written since 2026-08-11, and the Engine Health tab, its three read endpoints and the counters endpoint were removed.
--    The table stays: ShadowGuard still writes a row if the engine and the old check of Document, Controlled Copy or Controlled Copy Batch ever disagree.
-- 2. security_legacy_role_mapping_exceptions: created by V222 to record users whose legacy role could not be mapped to an access profile. It has no rows and no code reads it.

DELETE FROM authorization_shadow_evaluation_events;

DROP TABLE IF EXISTS security_legacy_role_mapping_exceptions;
