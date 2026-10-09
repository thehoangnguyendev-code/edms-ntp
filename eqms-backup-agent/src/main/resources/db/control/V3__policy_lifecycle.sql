-- Policy lifecycle (SDS-BR-001 sections 6.1 and 24, BR-10): a version is proposed as DRAFT, activated by a different person with an
-- electronic signature, and either SUPERSEDED by a later one or DISCARDED while still a draft. Nothing is ever deleted.
ALTER TABLE backup_policy DROP CONSTRAINT backup_policy_status_check;
ALTER TABLE backup_policy ADD CONSTRAINT backup_policy_status_check CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUPERSEDED', 'DISCARDED'));
ALTER TABLE backup_policy ADD COLUMN policy_sha256 CHAR(64);
ALTER TABLE backup_policy ADD COLUMN activated_at TIMESTAMPTZ;
ALTER TABLE backup_policy ADD COLUMN gate_json JSONB;
ALTER TABLE backup_policy ADD COLUMN discarded_by VARCHAR(120);
ALTER TABLE backup_policy ADD COLUMN discard_reason TEXT;
-- only one open draft at a time, so two people cannot approve different drafts in parallel
CREATE UNIQUE INDEX backup_policy_one_draft ON backup_policy (status) WHERE status = 'DRAFT';
