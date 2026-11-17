-- E-Sign Config lists one row per signing action so an administrator can set the meaning the signer sees. Six actions already sign in the code
-- (and five of them already have signatures on record) but had no row, so the screen could not show or change their meaning:
--   SUBMITTED_FOR_REVIEW (Revision Create, "Submit for Review"), TIME_LIMITED_USER_GRANT (grant / cancel time-limited access),
--   UNCONTROLLED_COPY_REQUESTED / _DISTRIBUTED / _CANCELLED, RECORD_LOGGED (executed record).
-- Only rows are added; no existing row, signature or code path changes. The wording is the one the screens already show the signer.
INSERT INTO electronic_signature_meanings (id, code, display_name, action_name)
VALUES
    (gen_random_uuid(), 'SUBMITTED_FOR_REVIEW', 'Submitted for Review', 'Submit Revision for Review'),
    (gen_random_uuid(), 'TIME_LIMITED_USER_GRANT', 'Time-Limited User Grant', 'Grant or Cancel Time-Limited Access'),
    (gen_random_uuid(), 'UNCONTROLLED_COPY_REQUESTED', 'Uncontrolled Copy Requested', 'Request Uncontrolled Copy'),
    (gen_random_uuid(), 'UNCONTROLLED_COPY_DISTRIBUTED', 'Uncontrolled Copy Distributed', 'Distribute Uncontrolled Copy'),
    (gen_random_uuid(), 'UNCONTROLLED_COPY_CANCELLED', 'Uncontrolled Copy Cancelled', 'Cancel Uncontrolled Copy'),
    (gen_random_uuid(), 'RECORD_LOGGED', 'Executed Record Logged', 'Log Executed Record')
ON CONFLICT (code) DO NOTHING;
