-- Migration V282: Remove PDF comments/replies tables and add READY_FOR_PUBLISHING status

-- 1. Destructive cleanup of PDF comment tables
DROP TABLE IF EXISTS revision_review_comment_attachments CASCADE;
DROP TABLE IF EXISTS revision_review_comment_replies CASCADE;
DROP TABLE IF EXISTS revision_review_comments CASCADE;

-- 2. Add READY_FOR_PUBLISHING status to revision_statuses
INSERT INTO revision_statuses (code, label, sort_order, is_terminal, created_at, updated_at)
VALUES ('READY_FOR_PUBLISHING', 'Ready for Publishing', 45, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO UPDATE 
SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, updated_at = CURRENT_TIMESTAMP;

-- 3. Cleanup unused comment permissions from permissions table
DELETE FROM permissions WHERE code LIKE '%review_comment%' OR code LIKE '%pdf_comment%';
