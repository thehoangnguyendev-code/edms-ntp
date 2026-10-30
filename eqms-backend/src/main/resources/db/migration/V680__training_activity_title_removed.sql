-- Training Management: the free-text Training Title of an activity is removed. SOP.0003 and its forms identify a training by its Training Number and its training topics (a topic of the
-- catalog, or an SOP with its revision); nothing in the SOP asks for a title, and no check or rule used it. What a training is about is read from its session topics, or from the
-- document of the training when the sessions have no topic yet. The function gives that text so that lists, notifications and records show the same words everywhere.
CREATE OR REPLACE FUNCTION training_activity_topics(p_activity_id uuid) RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT string_agg(DISTINCT st.topic_text, '; ' ORDER BY st.topic_text)
           FROM training_sessions s JOIN training_session_topics st ON st.session_id = s.id
          WHERE s.activity_id = p_activity_id AND st.topic_text IS NOT NULL AND btrim(st.topic_text) <> ''),
        (SELECT NULLIF(btrim(concat_ws(' ', a.document_number, a.document_name)), '') FROM training_activities a WHERE a.id = p_activity_id),
        '')
$$;

ALTER TABLE training_activities DROP COLUMN IF EXISTS training_title;
