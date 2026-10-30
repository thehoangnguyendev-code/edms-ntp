-- Training Management: what a training is about (function of V680) when its sessions have no topic yet: the document of the training, else the line of the training requirement that opened it
-- (a topic of the catalog, or a document), else the item of the personnel review that opened it.
CREATE OR REPLACE FUNCTION training_activity_topics(p_activity_id uuid) RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT string_agg(DISTINCT st.topic_text, '; ' ORDER BY st.topic_text)
           FROM training_sessions s JOIN training_session_topics st ON st.session_id = s.id
          WHERE s.activity_id = p_activity_id AND st.topic_text IS NOT NULL AND btrim(st.topic_text) <> ''),
        (SELECT NULLIF(btrim(concat_ws(' ', a.document_number, a.document_name)), '') FROM training_activities a WHERE a.id = p_activity_id),
        (SELECT COALESCE(t.code || ' - ' || t.name, NULLIF(btrim(concat_ws(' ', d.document_number, d.document_name)), ''))
           FROM training_requirement_lines l LEFT JOIN training_topics t ON t.id = l.topic_id LEFT JOIN documents d ON d.id = l.document_id
          WHERE l.activity_id = p_activity_id LIMIT 1),
        (SELECT initcap(replace(i.item_code, '_', ' ')) FROM training_personnel_review_items i WHERE i.activity_id = p_activity_id LIMIT 1),
        '')
$$;
