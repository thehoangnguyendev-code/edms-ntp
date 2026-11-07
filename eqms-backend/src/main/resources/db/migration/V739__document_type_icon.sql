-- The icon a Document Type has in the Knowledge Base explorer: the text on its band (the Short Code when empty) and the colour (a
-- colour from the palette when empty). Set by the person who manages Document Types; no effect on numbering or any record.
ALTER TABLE document_types ADD COLUMN IF NOT EXISTS icon_label VARCHAR(6);
ALTER TABLE document_types ADD COLUMN IF NOT EXISTS icon_color VARCHAR(7);
