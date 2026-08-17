-- New signature meanings for actions whose e-signature modal already collects a password
-- confirmation but never recorded a "meaning" server-side (Controlled Copy lifecycle, User
-- Management, Audit Export, Email Templates). Seeded here so the admin can rename their
-- display label, matching the simplified code+displayName-only model from V381.
-- AUDIT_TRAIL_REVIEW is also included here: AuditTrailReviewService already records signatures
-- under this code (via SecurityChangeSignatureService.MEANING_AUDIT_TRAIL_REVIEW) but it was
-- never seeded into this table, so the admin had no row to rename.
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES
    (gen_random_uuid(), 'AUDIT_TRAIL_REVIEW', 'Audit Trail Review'),
    (gen_random_uuid(), 'CONTROLLED_COPY_REQUESTED', 'Controlled Copy Requested'),
    (gen_random_uuid(), 'CONTROLLED_COPY_DISTRIBUTED', 'Controlled Copy Distributed'),
    (gen_random_uuid(), 'CONTROLLED_COPY_DISTRIBUTION_CANCELLED', 'Controlled Copy Distribution Cancelled'),
    (gen_random_uuid(), 'CONTROLLED_COPY_RECALLED', 'Controlled Copy Recalled'),
    (gen_random_uuid(), 'CONTROLLED_COPY_REISSUED', 'Controlled Copy Reissued'),
    (gen_random_uuid(), 'CONTROLLED_COPY_DESTROYED', 'Controlled Copy Destroyed'),
    (gen_random_uuid(), 'USER_TERMINATED', 'User Terminated'),
    (gen_random_uuid(), 'USER_SUSPENDED', 'User Suspended'),
    (gen_random_uuid(), 'USER_FORCE_LOGOUT', 'User Force Logout'),
    (gen_random_uuid(), 'AUDIT_RECORD_EXPORTED', 'Audit Record Exported'),
    (gen_random_uuid(), 'EMAIL_TEMPLATE_CREATED', 'Email Template Created'),
    (gen_random_uuid(), 'EMAIL_TEMPLATE_UPDATED', 'Email Template Updated')
ON CONFLICT (code) DO NOTHING;
