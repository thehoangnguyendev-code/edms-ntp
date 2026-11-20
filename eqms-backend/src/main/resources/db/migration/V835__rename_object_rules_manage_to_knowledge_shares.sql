-- V835: the display name of security.object_rules.manage (owner decision 2026-11-20, Object Access Rules removed).
--
-- The Object Access Rules screen and the administrator-created rules were removed (V829). The permission code stays (it is a machine value read by Knowledge Base sharing,
-- KnowledgeShareAuthorityService), but what it now governs is the revocation of ANY Knowledge Base share, not "object access rules". Only name and description change.
UPDATE permissions
SET name = 'Manage Knowledge Base Shares',
    description = 'Withdraw any share of a folder or document in the Knowledge Base, whoever made it. Changes nothing in Document Control.'
WHERE code = 'security.object_rules.manage';
