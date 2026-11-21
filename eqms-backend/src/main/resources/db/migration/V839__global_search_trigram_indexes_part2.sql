-- More trigram indexes for the global search of the top bar (Ctrl+K), for the lists added after V838: the codes and names that Training Requirements, Training
-- Matrices, the Assessment Library, the Report Library and the notifications of a person are searched by. Each index is on exactly the expression the list uses
-- (lower(column) where the list lowers it, the bare column where it uses ILIKE), so the planner can use it. Nothing here changes a value, a constraint or a result.
--
-- Plain CREATE INDEX (not CONCURRENTLY): Flyway runs a migration in one transaction. On a very large production table, build these in a quiet period.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_training_requirements_request_no_trgm ON training_requirements USING gin (lower(request_no) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_training_matrices_code_trgm ON training_matrices USING gin (lower(code) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_training_assessment_defs_code_trgm ON training_assessment_defs USING gin (lower(code) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_training_assessment_defs_name_trgm ON training_assessment_defs USING gin (lower(name) gin_trgm_ops);

-- the Report Library searches with ILIKE
CREATE INDEX IF NOT EXISTS idx_report_definitions_code_trgm ON report_definitions USING gin (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_report_definitions_display_name_trgm ON report_definitions USING gin (display_name gin_trgm_ops);

-- the notifications of a person: the number of the record they are about, and the title
CREATE INDEX IF NOT EXISTS idx_user_notifications_related_number_trgm ON user_notifications USING gin (lower(related_entity_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_notifications_title_trgm ON user_notifications USING gin (lower(title) gin_trgm_ops);
