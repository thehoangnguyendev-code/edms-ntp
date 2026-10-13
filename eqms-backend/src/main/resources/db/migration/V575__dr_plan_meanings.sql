-- Disaster Recovery Plan (SDS 15.2): changing a recovery target and changing who may declare a disaster are approvals by electronic
-- signature, each with its own meaning. Verifying a rebuild-kit item needs no signature: it is a record of a check by a person.
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES
    (gen_random_uuid(), 'BACKUP_DR_TARGET_CHANGE', 'Disaster Recovery Target Change'),
    (gen_random_uuid(), 'BACKUP_DR_AUTHORITY_CHANGE', 'Disaster Declaration Authority Change')
ON CONFLICT (code) DO NOTHING;
