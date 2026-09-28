-- Legacy Import and Legacy Batch Import were merged into a single flow/UI (a single revision is
-- just a batch of one -- see RevisionService#createLegacyImportRevisionsBatch), so the separate
-- documents.legacy_import.batch permission (V463) is retired; documents.legacy_import.manage now
-- covers both. V463 already backfilled every Permission Set holding .manage with .batch too, so no
-- reassignment is needed here -- every current .batch holder already holds .manage.
-- Cascades away the now-orphaned permission_set_items rows for .batch (ON DELETE CASCADE), same
-- pattern as V404 (settings.configuration.edit -> .manage merge).
DELETE FROM permissions WHERE code = 'documents.legacy_import.batch';
