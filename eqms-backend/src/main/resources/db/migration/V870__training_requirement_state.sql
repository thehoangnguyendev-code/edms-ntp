-- DEC-TRAINING-2026-11-27-01 (A1, D1) and -02: the one rule that says where a person stands on a training requirement. Every screen asks this function, so the gap list,
-- the matrix completion, the job assignment and the proposed participants cannot disagree.
--
-- MISSING        no valid record: the person must learn it, whatever the Requires Training tick of the revisions says (the matrix row is the requirement, SOP.0003 5.3.1, 5.3.8)
-- UPDATE_NEEDED  trained, but on a revision older than the latest revision that was marked Requires Training (an editorial revision does not ask for training again)
-- DUE            the periodic training is due: the review cycle of the document, 12 months when it has none or the requirement is not a document (SOP.0003 5.3.2)
-- OK             trained

-- "1.0.0", "02" and "2.1" compare as versions, not as text; anything else is only ever equal to itself.
CREATE OR REPLACE FUNCTION training_revision_key(p text) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN btrim(coalesce(p, '')) ~ '^[0-9]{1,6}(\.[0-9]{1,6}){0,5}$' THEN (string_to_array(btrim(p), '.')::int[] || ARRAY[0, 0, 0])[1:3] END
$$;

CREATE OR REPLACE FUNCTION training_requirement_state(p_person uuid, p_document_number text, p_topic text, p_annual boolean)
RETURNS TABLE (status text, last_done date, last_revision text, required_revision text, period_months int)
LANGUAGE sql STABLE AS $$
    WITH doc AS (
        SELECT d.id, d.periodic_review_cycle FROM documents d WHERE p_document_number IS NOT NULL AND d.document_number = p_document_number LIMIT 1),
    required AS (
        SELECT dr.revision_number FROM document_revisions dr JOIN doc ON dr.document_id = doc.id
         WHERE dr.status_code IN ('EFFECTIVE', 'OBSOLETED') AND dr.requires_training
           AND EXISTS (SELECT 1 FROM document_revisions e WHERE e.document_id = doc.id AND e.status_code = 'EFFECTIVE')
         ORDER BY training_revision_key(dr.revision_number) DESC NULLS LAST, dr.effective_date DESC NULLS LAST LIMIT 1),
    records AS (
        SELECT r.completed_on, r.document_revision, r.record_no FROM training_records r
         WHERE r.person_user_id = p_person
           AND NOT EXISTS (SELECT 1 FROM training_record_voids v WHERE v.record_id = r.id)
           AND ((p_document_number IS NOT NULL AND r.document_number = p_document_number)
                OR (p_topic IS NOT NULL AND training_topic_key(r.topic_text) = training_topic_key(p_topic)))),
    latest AS (
        SELECT completed_on, document_revision FROM records ORDER BY completed_on DESC, record_no DESC LIMIT 1),
    period AS (
        SELECT coalesce((SELECT periodic_review_cycle FROM doc WHERE periodic_review_cycle > 0), 12) AS months),
    covered AS (
        -- a record without a revision (a topic, or old evidence) counts; so does training on a later revision, which happens before that revision is Effective
        SELECT EXISTS (SELECT 1 FROM records x, required q
                        WHERE x.document_revision IS NULL OR x.document_revision = q.revision_number
                           OR training_revision_key(x.document_revision) >= training_revision_key(q.revision_number)) AS yes)
    SELECT CASE
             WHEN (SELECT completed_on FROM latest) IS NULL THEN 'MISSING'
             WHEN EXISTS (SELECT 1 FROM required) AND NOT (SELECT yes FROM covered) THEN 'UPDATE_NEEDED'
             WHEN coalesce(p_annual, false) AND (SELECT completed_on FROM latest) < (current_date - make_interval(months => (SELECT months FROM period))) THEN 'DUE'
             ELSE 'OK'
           END,
           (SELECT completed_on FROM latest),
           (SELECT document_revision FROM latest)::text,
           (SELECT revision_number FROM required)::text,
           (SELECT months FROM period)
$$;
