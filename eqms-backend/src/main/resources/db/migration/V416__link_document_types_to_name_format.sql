-- Phase 2 of the Document Name Formats feature: link each Document Type to the Document Name
-- Format used to generate its document numbers. Nullable FK, defaulted to the "Standard" format
-- seeded in V415 (Document Type + "." + Serial Number, e.g. "SOP.0007") so this migration changes
-- ZERO existing/future generation behavior on its own -- see DocumentComponentResolver's
-- "document-number-safe" validation for why every Document Type is deliberately kept on that same
-- legacy 2-component shape for now (the sequence-reconciliation safety net in
-- DocumentRecordRepository is hard-coded to that exact "<prefix>.<1-4 digits>" shape; a richer
-- shape, e.g. a Department prefix or a different separator, needs that reconciliation query fixed
-- first -- a separate, later phase).
ALTER TABLE document_types ADD COLUMN name_format_id UUID REFERENCES document_name_formats(id);

UPDATE document_types SET name_format_id = '00000000-0000-0000-0000-000000000101';
