-- V822: Object Access Rules for every module, not only Document Control (owner decisions 2026-11-19: Training Management, Reports and Security Reviews first; a module with no rule keeps today's
-- behaviour, open).
--
-- A rule now names the module and the object type it applies to. Every row that exists is a Document Control rule (module_key default), so nothing changes for them. For another module the rule is read
-- by the Hybrid engine (ModuleObjectRuleService) as one more step of the decision about an action: the rule narrows WHO may do WHICH action on WHICH records, by record (ANY_RECORD), by the status of
-- the record (OBJECT_STATUS) or, for Training, by its department (DEPARTMENT).

ALTER TABLE object_access_rules ADD COLUMN IF NOT EXISTS module_key VARCHAR(40) NOT NULL DEFAULT 'DOCUMENT_CONTROL';
ALTER TABLE object_access_rules ADD COLUMN IF NOT EXISTS object_type VARCHAR(80);

ALTER TABLE object_access_rules DROP CONSTRAINT IF EXISTS chk_oar_resource_type;
ALTER TABLE object_access_rules ADD CONSTRAINT chk_oar_resource_type CHECK (resource_type IN
    ('DOCUMENT_CATEGORY', 'DOCUMENT_TYPE', 'DOCUMENT_STATUS', 'DEPARTMENT', 'BUSINESS_UNIT', 'DOCUMENT', 'ANY_RECORD', 'OBJECT_STATUS'));

-- a rule of another module always names its object type
ALTER TABLE object_access_rules DROP CONSTRAINT IF EXISTS chk_oar_module_object_type;
ALTER TABLE object_access_rules ADD CONSTRAINT chk_oar_module_object_type CHECK (module_key = 'DOCUMENT_CONTROL' OR object_type IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_oar_module ON object_access_rules (module_key, active);
