-- Performance/concurrency hardening for 500-concurrent-user scale: Document, DocumentRevision and
-- ControlledCopy had no protection against two concurrent requests silently overwriting each
-- other's changes (last-write-wins). Adds Hibernate-managed optimistic locking (@Version) --
-- a concurrent conflicting write now gets a clear 409 Conflict instead of silently clobbering the
-- other user's change. This does not change any business/workflow logic, only adds a version
-- counter Hibernate increments automatically on every UPDATE.
--
-- Safe as a single statement: adding a NOT NULL column WITH a constant DEFAULT is a metadata-only
-- change on PostgreSQL 11+ (no full-table rewrite/lock), consistent with this table's existing
-- V17-alpine target. No backfill migration needed.
-- Named lock_version, not version -- "documents" already has an unrelated "version" column (the
-- document's own semantic version string, e.g. "1.0").
ALTER TABLE documents ADD COLUMN lock_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE document_revisions ADD COLUMN lock_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE controlled_copies ADD COLUMN lock_version BIGINT NOT NULL DEFAULT 0;
