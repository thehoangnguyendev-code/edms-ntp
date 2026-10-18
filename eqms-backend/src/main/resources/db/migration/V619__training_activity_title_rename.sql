-- Training Management: the title of a training activity is its Training Title (PLAN-TR-001, naming). The column training_activities.title becomes training_title, so the name
-- says what the text is and no other title (a material, a topic, a notification) is mistaken for it. Forward-only and idempotent: nothing happens when it was already renamed.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'training_activities' AND column_name = 'title')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'training_activities' AND column_name = 'training_title') THEN
        ALTER TABLE training_activities RENAME COLUMN title TO training_title;
    END IF;
END $$;
