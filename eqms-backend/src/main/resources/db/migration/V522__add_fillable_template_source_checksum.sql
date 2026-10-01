-- V522: tracks the checksum of the Revision's own source file (filePath) at the moment its
-- fillable template was last designed/committed -- lets EformEditSessionService detect when the
-- static content was edited (via the normal Edit button) AFTER fields were last designed, so it
-- can warn instead of silently resuming a field layout that may no longer line up with the text.

ALTER TABLE document_revisions ADD COLUMN fillable_template_source_checksum VARCHAR(128);
