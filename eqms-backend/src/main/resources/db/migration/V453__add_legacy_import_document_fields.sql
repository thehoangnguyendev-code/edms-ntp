-- Additive-only groundwork for the "Legacy Import" feature (Phase 1 of 2). No existing column,
-- constraint, workflow transition or numbering path is touched -- ordinary document creation
-- behaves exactly as before. Phase 2 (the actual import screen and the Draft -> Effective
-- bypass logic) builds on these columns in a later change.

ALTER TABLE documents
    -- True only for a document created through the Legacy Import screen (its document number and
    -- initial revision number were typed in by the importer instead of auto-generated).
    ADD COLUMN is_legacy_import BOOLEAN NOT NULL DEFAULT FALSE,
    -- Who performed the import (the "Opened by" of that action) -- kept distinct from the
    -- document's Author, who may be a different, real-world person named on the paper original.
    ADD COLUMN legacy_imported_by UUID REFERENCES app_users(id),
    ADD COLUMN legacy_imported_at TIMESTAMPTZ,
    -- The date the paper original actually became effective, as opposed to the date its EQMS
    -- record was created -- kept only for display/audit, never used in lifecycle logic.
    ADD COLUMN original_effective_date DATE,
    ADD COLUMN legacy_justification TEXT;

-- Registers the e-signature meaning so an administrator can rename its display label from
-- Settings > Electronic Signature (same pattern as V382). The signature itself is recorded by
-- Phase 2's submit action; this row only needs to exist ahead of that.
INSERT INTO electronic_signature_meanings (id, code, display_name)
VALUES (gen_random_uuid(), 'LEGACY_DOCUMENT_IMPORT', 'Legacy Document Import')
ON CONFLICT (code) DO NOTHING;
