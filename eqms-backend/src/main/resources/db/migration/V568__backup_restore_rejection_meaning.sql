-- Rejecting a restore request needs the rejecting person's electronic signature, with its own meaning (SDS 9.2).
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'BACKUP_RESTORE_REJECTION', 'Backup Restore Rejection')
ON CONFLICT (code) DO NOTHING;
