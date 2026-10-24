-- PLAN-TR-002: a training activity needs Training Materials and an Assessment form unless the rules free it (a training from a document, an external training, a visitor, a
-- supplementary training) or the organizer exempts it with a reason, which stays on the record. The exemption can be set only before the content is reviewed.
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS materials_exempt BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS materials_exempt_reason TEXT;
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_exempt BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS assessment_exempt_reason TEXT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_training_activities_exempt_reason') THEN
        ALTER TABLE training_activities ADD CONSTRAINT ck_training_activities_exempt_reason CHECK (
            (NOT materials_exempt OR coalesce(btrim(materials_exempt_reason), '') <> '')
            AND (NOT assessment_exempt OR coalesce(btrim(assessment_exempt_reason), '') <> ''));
    END IF;
END $$;
