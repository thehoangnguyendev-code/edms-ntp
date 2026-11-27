-- DEC-TRAINING-2026-11-27-01 (B): the checklist of a personnel training review takes its training lines from the training matrix and its other items from a
-- configurable template; a line is done only when the record exists.

ALTER TABLE training_personnel_review_items ALTER COLUMN item_code TYPE varchar(40);
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS check_type varchar(16);
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS title varchar(500);
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS title_vi varchar(500);
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS hint varchar(1000);
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS row_group varchar(24);
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS topic_text varchar(500);
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS document_number varchar(100);
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS annual boolean NOT NULL DEFAULT false;
ALTER TABLE training_personnel_review_items ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;
-- REMOVED: the matrix no longer asks for the line (an item is never deleted)
ALTER TABLE training_personnel_review_items DROP CONSTRAINT IF EXISTS training_personnel_review_items_status_check;
ALTER TABLE training_personnel_review_items ADD CONSTRAINT training_personnel_review_items_status_check CHECK (status IN ('PENDING', 'DONE', 'NOT_NEEDED', 'REMOVED'));

-- the Job Roles the review prepares the person for, and the person assigned to review the records in a department transfer (SOP.0003 5.3.11)
ALTER TABLE training_personnel_reviews ADD COLUMN IF NOT EXISTS job_role_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE training_personnel_reviews ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES app_users(id);

CREATE TABLE IF NOT EXISTS training_review_templates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind        varchar(20) NOT NULL CHECK (kind IN ('NEW_HIRE', 'ABSENCE_RETURN', 'DEPT_TRANSFER', 'LOCATION_TRANSFER')),
    item_code   varchar(40) NOT NULL,
    title       varchar(500) NOT NULL,
    title_vi    varchar(500),
    hint        varchar(1000),
    check_type  varchar(16) NOT NULL CHECK (check_type IN ('SPECIMEN', 'JOB_ASSIGNMENT', 'HANDOVER', 'MANUAL')),
    locked      boolean NOT NULL DEFAULT false,
    active      boolean NOT NULL DEFAULT true,
    sort_order  int NOT NULL DEFAULT 100,
    version     int NOT NULL DEFAULT 1,
    updated_by  uuid REFERENCES app_users(id),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (kind, item_code)
);

INSERT INTO training_review_templates (kind, item_code, title, title_vi, hint, check_type, locked, sort_order) VALUES
 ('NEW_HIRE', 'SPECIMEN', 'Specimen signature', 'Chữ ký mẫu', 'FRM.0007 is signed by hand on paper and by the Head of department; its scan is kept as the specimen signature record.', 'SPECIMEN', true, 10),
 ('NEW_HIRE', 'JOB_ASSIGNMENT', 'Job assignment', 'Bản giao việc', 'APD.0024: given after the training the matrix requires for the position is complete.', 'JOB_ASSIGNMENT', true, 20),
 ('ABSENCE_RETURN', 'REVIEW_RECORDS', 'Review the training record', 'Rà soát hồ sơ đào tạo', 'Choose what has to be trained again after the absence, or say why nothing has to.', 'MANUAL', true, 10),
 ('DEPT_TRANSFER', 'REVIEW_RECORDS', 'Review the current training record', 'Rà soát hồ sơ đào tạo hiện tại', 'The receiving head of department and the assigned employee find what additional training is needed (SOP.0003 5.3.11).', 'MANUAL', true, 10),
 ('DEPT_TRANSFER', 'JOB_ASSIGNMENT', 'Job assignment', 'Bản giao việc', 'APD.0024 for the new position.', 'JOB_ASSIGNMENT', true, 20),
 ('LOCATION_TRANSFER', 'HANDOVER', 'Hand over the training record', 'Bàn giao hồ sơ đào tạo', 'The head of the department at the previous site gives a copy of the record to the new department (SOP.0003 5.3.11).', 'HANDOVER', true, 10),
 ('LOCATION_TRANSFER', 'SPECIMEN', 'Specimen signature', 'Chữ ký mẫu', 'As for a new employee (SOP.0003 5.3.11).', 'SPECIMEN', true, 20),
 ('LOCATION_TRANSFER', 'JOB_ASSIGNMENT', 'Job assignment', 'Bản giao việc', 'APD.0024 for the new position.', 'JOB_ASSIGNMENT', true, 30)
ON CONFLICT (kind, item_code) DO NOTHING;

-- The Job Roles a review looks at: the ones chosen on the review, the ones the person holds, and the ones of a job assignment that is being signed.
CREATE OR REPLACE FUNCTION training_review_job_roles(p_review uuid) RETURNS SETOF uuid LANGUAGE sql STABLE AS $$
    SELECT unnest(r.job_role_ids) FROM training_personnel_reviews r WHERE r.id = p_review
    UNION
    SELECT tp.position_id FROM training_personnel_reviews r JOIN training_person_positions tp ON tp.person_user_id = r.person_user_id AND tp.valid_to IS NULL WHERE r.id = p_review
    UNION
    SELECT ar.job_role_id FROM training_personnel_reviews r JOIN training_job_assignments j ON j.person_user_id = r.person_user_id AND j.status IN ('DRAFT', 'PENDING_RECEIVER')
      JOIN training_job_assignment_roles ar ON ar.assignment_id = j.id WHERE r.id = p_review
$$;

-- Where a line of a review stands now. Every screen, filter and reminder asks this function, and closing a review writes its answer down.
CREATE OR REPLACE FUNCTION training_review_item_state(p_review uuid, p_item varchar) RETURNS text LANGUAGE sql STABLE AS $$
    SELECT CASE
        WHEN i.status IN ('NOT_NEEDED', 'REMOVED') OR r.status <> 'OPEN' THEN i.status
        WHEN i.check_type = 'TRAINING' THEN (
            -- a return after an absence and a move to another site ask for training after the event; a new employee and a transfer count what the person already has
            SELECT CASE WHEN s.status = 'OK' AND (r.kind IN ('NEW_HIRE', 'DEPT_TRANSFER') OR s.last_done >= r.event_date) THEN 'DONE' ELSE 'PENDING' END
              FROM training_requirement_state(r.person_user_id, i.document_number, i.topic_text, i.annual) s)
        WHEN i.check_type = 'SPECIMEN' THEN
            CASE WHEN EXISTS (SELECT 1 FROM training_specimen_signatures x WHERE x.person_user_id = r.person_user_id AND x.status = 'APPROVED') THEN 'DONE' ELSE 'PENDING' END
        WHEN i.check_type = 'JOB_ASSIGNMENT' THEN
            CASE WHEN EXISTS (SELECT 1 FROM training_job_assignments x WHERE x.person_user_id = r.person_user_id AND x.status = 'EFFECTIVE' AND x.effective_at::date >= r.event_date) THEN 'DONE' ELSE 'PENDING' END
        WHEN i.check_type = 'HANDOVER' THEN
            CASE WHEN EXISTS (SELECT 1 FROM training_record_exports x WHERE x.person_user_id = r.person_user_id AND x.status = 'APPROVED' AND x.generated_at::date >= r.event_date) THEN 'DONE' ELSE 'PENDING' END
        WHEN i.check_type = 'JOB_ROLE' THEN
            CASE WHEN EXISTS (SELECT 1 FROM training_review_job_roles(r.id)) THEN 'DONE' ELSE 'PENDING' END
        ELSE i.status
    END
    FROM training_personnel_review_items i JOIN training_personnel_reviews r ON r.id = i.review_id
    WHERE i.review_id = p_review AND i.item_code = p_item
$$;
