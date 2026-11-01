-- Legacy Import: what the paper record says about the training (the Training Topic, the Trainer as written, the Mode), kept on the historical activity (kind LEGACY, V718).
-- A historical activity has no session, so the sessions cannot carry them. The columns are empty for every other kind.
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS paper_topic TEXT;
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS paper_trainer VARCHAR(255);
ALTER TABLE training_activities ADD COLUMN IF NOT EXISTS paper_method VARCHAR(20);
ALTER TABLE training_activities DROP CONSTRAINT IF EXISTS ck_training_activities_paper_method;
ALTER TABLE training_activities ADD CONSTRAINT ck_training_activities_paper_method
    CHECK (paper_method IS NULL OR paper_method IN ('SELF_READING', 'CLASSROOM', 'HYBRID', 'PRACTICAL'));

-- What a training is about (function of V686): the topics of its sessions, else the topic written on the paper record (a historical activity), else its document, ...
CREATE OR REPLACE FUNCTION training_activity_topics(p_activity_id uuid) RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT string_agg(DISTINCT st.topic_text, '; ' ORDER BY st.topic_text)
           FROM training_sessions s JOIN training_session_topics st ON st.session_id = s.id
          WHERE s.activity_id = p_activity_id AND st.topic_text IS NOT NULL AND btrim(st.topic_text) <> ''),
        (SELECT NULLIF(btrim(a.paper_topic), '') FROM training_activities a WHERE a.id = p_activity_id),
        (SELECT NULLIF(btrim(concat_ws(' ', a.document_number, a.document_name)), '') FROM training_activities a WHERE a.id = p_activity_id),
        (SELECT COALESCE(l.topic_text, NULLIF(btrim(concat_ws(' ', d.document_number, d.document_name)), ''))
           FROM training_requirement_lines l LEFT JOIN documents d ON d.id = l.document_id
          WHERE l.activity_id = p_activity_id LIMIT 1),
        (SELECT initcap(replace(i.item_code, '_', ' ')) FROM training_personnel_review_items i WHERE i.activity_id = p_activity_id LIMIT 1),
        '')
$$;
