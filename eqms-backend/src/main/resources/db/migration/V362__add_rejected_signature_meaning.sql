-- The Review-Reject and Approval-Reject workflow actions were incorrectly recording their
-- e-signature under the "CANCELLED" meaning (no "Rejected" meaning existed at the time), which
-- made the Revision Signatures tab show the reviewer/approver who rejected the revision under
-- "Cancelled By" instead of "Rejected By". Add the missing meaning; RevisionService is updated in
-- the same deploy to record rejections under this code going forward.
INSERT INTO electronic_signature_meanings (id, code, display_name, description, requires_reason, requires_comment, active, sort_order)
VALUES
    ('00000000-0000-0000-0000-000000362001', 'REJECTED', 'Rejected', 'User confirms the revision was rejected and returned to Draft.', TRUE, FALSE, TRUE, 25)
ON CONFLICT (code) DO NOTHING;
