-- documents.legacy_import.manage is retired (owner decision 2026-11-17, Decision Log LEGACY-IMPORT-ONE-PERMISSION).
-- Importing a document that already exists outside the system now rides on the permission that governs creating any
-- document (documents.document.create, or documents.workspace.manage which already implies it) -- one permission fewer
-- to grant and audit. Same pattern as V411 (documents.template.manage) and V486 (documents.template.use).
--
-- Effect: nobody who could import before loses the ability. The import already required the create permission as well
-- (createDocumentDraft checks it), so every holder who could finish an import also holds the permission that now governs
-- it. A Permission Set that held only documents.legacy_import.manage never could finish an import, and gains nothing here.
-- New effect: every holder of the create permission (for example an Author) can now import. The department scope rule
-- of the import (own department unless the holder sees all documents) is unchanged.
DELETE FROM permission_set_items psi
USING permissions p
WHERE psi.permission_id = p.id
  AND p.code = 'documents.legacy_import.manage';

DELETE FROM permissions WHERE code = 'documents.legacy_import.manage';

UPDATE permissions
SET description = 'Create a new document shell with metadata and workflow configuration. Also covers Legacy Import: bringing in a document that already exists outside the system (e.g. a paper original), with its existing document number and its historical revision chain.'
WHERE code = 'documents.document.create';
