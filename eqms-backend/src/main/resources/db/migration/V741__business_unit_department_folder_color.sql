-- The colour of the folder of a Business Unit and of a Department in the Knowledge Base explorer (#rrggbb); empty means an automatic colour.
-- No effect on any record: it is only how the folder is drawn.
ALTER TABLE business_units ADD COLUMN IF NOT EXISTS icon_color VARCHAR(7);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS icon_color VARCHAR(7);
