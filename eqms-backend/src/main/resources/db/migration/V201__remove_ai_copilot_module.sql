-- V201: Remove the AI Copilot module, permissions, and storage tables.
--
-- This migration is intentionally destructive for the AI feature because the
-- product owner requested a full rollback: no AI UI, no AI API, no model
-- services, and no AI data in the application database.

DELETE FROM access_profile_permission_sets
WHERE permission_set_id IN (
    SELECT id FROM permission_sets WHERE code IN ('AI_COPILOT_USER', 'AI_COPILOT_ADMIN')
);

DELETE FROM permission_set_items
WHERE permission_set_id IN (
    SELECT id FROM permission_sets WHERE code IN ('AI_COPILOT_USER', 'AI_COPILOT_ADMIN')
);

DELETE FROM permission_sets
WHERE code IN ('AI_COPILOT_USER', 'AI_COPILOT_ADMIN');

DELETE FROM permissions
WHERE code IN ('ai.copilot.use', 'ai.copilot.manage');

DROP TABLE IF EXISTS ai_copilot_citations CASCADE;
DROP TABLE IF EXISTS ai_copilot_messages CASCADE;
DROP TABLE IF EXISTS ai_copilot_conversations CASCADE;
DROP TABLE IF EXISTS ai_copilot_index_jobs CASCADE;
