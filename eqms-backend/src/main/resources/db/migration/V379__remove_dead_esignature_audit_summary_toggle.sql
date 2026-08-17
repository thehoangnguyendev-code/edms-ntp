-- "Show audit trail summary beside signature display records" was stored and echoed back by the
-- API, but never actually read anywhere (backend or frontend) to conditionally show/hide
-- anything. Audit Trail entries and ElectronicSignature records are always created unconditionally
-- for every signed action -- this toggle never controlled whether that happens, only implied a
-- configurability that never existed. Removing it entirely, same as V378.
ALTER TABLE electronic_signature_settings DROP COLUMN show_audit_trail_summary;
