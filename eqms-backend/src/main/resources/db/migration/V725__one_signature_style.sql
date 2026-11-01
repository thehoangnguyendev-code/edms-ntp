-- A signed electronic signature is written in a document in one way only: the Standard frame (name, "Electronically" and the meaning, date and time). The Training Annex no longer
-- chooses a style for each signature slot, so the table that kept those choices is not used any more. A choice that was ever made is history: if the table holds rows it is kept under
-- another name (the Audit Trail has the changes); an empty table is dropped.
DO $$
BEGIN
    IF to_regclass('public.training_annex_slot_styles') IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM training_annex_slot_styles) THEN
            ALTER TABLE training_annex_slot_styles RENAME TO training_annex_slot_styles_retired;
        ELSE
            DROP TABLE training_annex_slot_styles;
        END IF;
    END IF;
END $$;
