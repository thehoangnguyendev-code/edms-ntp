-- Decision BACKUP-POLICY-SIGNER-2026-11-11: backup and restore are administrator-only, so the person who proposed a
-- policy version may activate it with their own electronic signature. The signature reference stays mandatory.
ALTER TABLE backup_policy DROP CONSTRAINT IF EXISTS backup_policy_two_people;
