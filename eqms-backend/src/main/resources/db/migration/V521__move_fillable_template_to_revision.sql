-- V521: Form / eForm Phase 2c -- the fillable-template (.docxf with fields) now belongs to ONE
-- specific Revision, not the Form in general, so Design can happen during Draft (like authoring
-- any other Document content) and locks permanently once that Revision is Effective -- the exact
-- same Draft-only edit window every Document already has (RevisionService.uploadRevisionFile's
-- requireRevisionStatus(DRAFT) + requireRevisionNotCompletedEditing guard, reused for this write).

ALTER TABLE document_revisions ADD COLUMN fillable_template_file_name VARCHAR(255);
ALTER TABLE document_revisions ADD COLUMN fillable_template_storage_provider VARCHAR(60);
ALTER TABLE document_revisions ADD COLUMN fillable_template_storage_bucket VARCHAR(255);
ALTER TABLE document_revisions ADD COLUMN fillable_template_storage_object_key VARCHAR(1024);
ALTER TABLE document_revisions ADD COLUMN fillable_template_storage_version_id VARCHAR(255);
ALTER TABLE document_revisions ADD COLUMN fillable_template_checksum VARCHAR(128);

ALTER TABLE form_settings DROP COLUMN IF EXISTS fillable_template_file_name;
ALTER TABLE form_settings DROP COLUMN IF EXISTS fillable_template_storage_provider;
ALTER TABLE form_settings DROP COLUMN IF EXISTS fillable_template_storage_bucket;
ALTER TABLE form_settings DROP COLUMN IF EXISTS fillable_template_storage_object_key;
ALTER TABLE form_settings DROP COLUMN IF EXISTS fillable_template_storage_version_id;
ALTER TABLE form_settings DROP COLUMN IF EXISTS fillable_template_checksum;
ALTER TABLE form_settings DROP COLUMN IF EXISTS fillable_template_revision_id;
