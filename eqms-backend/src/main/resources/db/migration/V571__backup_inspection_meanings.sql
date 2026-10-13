-- Backup Inspection (SDS 7.2): approving and rejecting an inspection carry an electronic signature, each with its own meaning.
-- The permissions are the restore ones (backup.restore.request to ask, backup.restore.approve to decide), so no permission is added here.
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES
    (gen_random_uuid(), 'BACKUP_INSPECTION_APPROVAL', 'Backup Inspection Approval'),
    (gen_random_uuid(), 'BACKUP_INSPECTION_REJECTION', 'Backup Inspection Rejection')
ON CONFLICT (code) DO NOTHING;
