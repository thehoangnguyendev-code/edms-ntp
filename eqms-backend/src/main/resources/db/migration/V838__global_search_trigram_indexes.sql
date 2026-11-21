-- Trigram indexes for the global search of the top bar (Ctrl+K).
--
-- The search asks the list of each kind of record for `lower(column) like '%words%'`; without a trigram index every key typed reads the whole table. V440 already
-- covers users (name, e-mail, user name), documents (number, name) and the dictionaries; this adds the columns that the other lists search. Each index is
-- on exactly the expression the list uses (lower(column), or the bare column where the list uses ILIKE), so the planner can use it. Nothing here changes a
-- value, a constraint or a query result.
--
-- Plain CREATE INDEX (not CONCURRENTLY): Flyway runs a migration in one transaction. On a very large production table, build these in a quiet period.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- people: the employee code is searched with the name
CREATE INDEX IF NOT EXISTS idx_app_users_employee_code_trgm ON app_users USING gin (lower(employee_code) gin_trgm_ops);

-- document revisions
CREATE INDEX IF NOT EXISTS idx_document_revisions_document_number_trgm ON document_revisions USING gin (lower(document_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_revisions_document_name_trgm ON document_revisions USING gin (lower(document_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_revisions_revision_name_trgm ON document_revisions USING gin (lower(revision_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_revisions_training_number_trgm ON document_revisions USING gin (lower(training_number) gin_trgm_ops);

-- controlled and uncontrolled copies
CREATE INDEX IF NOT EXISTS idx_controlled_copies_number_trgm ON controlled_copies USING gin (lower(controlled_copy_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_controlled_copies_document_number_trgm ON controlled_copies USING gin (lower(document_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_controlled_copies_document_title_trgm ON controlled_copies USING gin (lower(document_title) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_uncontrolled_copies_number_trgm ON uncontrolled_copies USING gin (lower(uncontrolled_copy_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_uncontrolled_copies_document_number_trgm ON uncontrolled_copies USING gin (lower(document_number) gin_trgm_ops);

-- training activities
CREATE INDEX IF NOT EXISTS idx_training_activities_number_trgm ON training_activities USING gin (lower(training_number) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_training_activities_document_number_trgm ON training_activities USING gin (lower(document_number) gin_trgm_ops);

-- report runs: the list uses ILIKE, which a trigram index on the bare column serves
CREATE INDEX IF NOT EXISTS idx_report_runs_report_title_trgm ON report_runs USING gin (report_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_report_runs_definition_code_trgm ON report_runs USING gin (definition_code gin_trgm_ops);
