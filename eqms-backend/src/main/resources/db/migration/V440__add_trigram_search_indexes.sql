-- Performance: server-side search across Settings/Document tables uses
-- `LOWER(column) LIKE lower('%term%')` (see DictionaryQuerySupport.addSearchPredicate and the
-- equivalent hand-written Specification predicates in UserManagementService etc.) -- already
-- case-insensitive (functionally identical to ILIKE '%term%'), but a plain btree index cannot
-- serve a leading-wildcard LIKE pattern, so every such search falls back to a sequential scan.
-- pg_trgm's GIN trigram indexes are what actually make `%term%` search fast at scale -- but the
-- index expression must match the query expression exactly for Postgres to use it: since the
-- generated SQL wraps the column in `lower(...)`, the index is built on `lower(column)`, not the
-- raw column (an index on the raw column only helps a direct `column ILIKE '%term%'` query, which
-- is not what Hibernate emits here).
--
-- Scope: the text columns actually wired to a search box today (Settings dictionaries, User
-- Management, Document Control). Status/foreign-key columns used for exact-match filters already
-- have ordinary btree indexes from earlier migrations and are untouched here.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_app_users_full_name_trgm ON app_users USING gin (lower(full_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_app_users_email_trgm ON app_users USING gin (lower(email) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_app_users_username_trgm ON app_users USING gin (lower(username) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_documents_name_trgm ON documents USING gin (lower(document_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_document_number_trgm ON documents USING gin (lower(document_number) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_business_units_name_trgm ON business_units USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_departments_name_trgm ON departments USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_positions_name_trgm ON positions USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_types_name_trgm ON document_types USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_document_sub_types_name_trgm ON document_sub_types USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_storage_locations_name_trgm ON storage_locations USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_retention_policies_name_trgm ON retention_policies USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_education_degree_levels_name_trgm ON education_degree_levels USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_schools_name_trgm ON schools USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_roles_name_trgm ON roles USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_permission_sets_name_trgm ON permission_sets USING gin (lower(name) gin_trgm_ops);

-- Everything else that runs the same `LOWER(x) LIKE '%term%'` pattern (email/publishing
-- templates, notification policy, controlled copies, audit trail review, document name formats,
-- time-limited grants, ...) follows the identical recipe -- add
-- `CREATE INDEX ... USING gin (lower(<column>) gin_trgm_ops)` for whichever specific column
-- starts showing up as a slow sequential scan (see EXPLAIN ANALYZE) once real data volume
-- warrants it.
