-- DEV ONLY (2026-10-20): mock data so that Training Compliance > Matrix completion shows many results. Never run on TEST or PROD.
-- It adds, for the department Quality Control (which has no matrix):
--   * three positions (QC Analyst exists; QC Supervisor and QC Technician are added with the code prefix MOCK-);
--   * an EFFECTIVE training matrix TM-MOCK-QC with 10 rows in the three groups of APD.0011;
--   * 15 existing active DEV users placed in those positions (valid_from 2026-10-20, source ADMIN), 6 / 5 / 4 per position;
--   * personal training records that give every state: Qualified, Update needed (older SOP revision), Annual due, Required (no record) and, through
--     participants added to the open activity TRN/QA/26-055, In progress.
-- The records are inserted the way the DEV test script does (linked to an existing COMPLETED activity, training number TRN/MOCK/26-001); nothing here is
-- a real person's training. Idempotent. Undo with DEV_MOCK_TRAINING_COMPLETION_CLEANUP_2026_10_20.sql. Restart is not needed.
BEGIN;

INSERT INTO positions (id, department_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), '23111111-1111-1111-1111-111111111112', v.code, v.name, TRUE, now(), now()
FROM (VALUES ('MOCK-QCSUP', 'QC Supervisor (mock)'), ('MOCK-QCTECH', 'QC Technician (mock)')) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM positions p WHERE p.code = v.code);

INSERT INTO training_topics (id, code, name, scope, department_id, active)
SELECT gen_random_uuid(), v.code, v.name, v.scope, CASE WHEN v.scope = 'DEPARTMENT_GENERAL' THEN '23111111-1111-1111-1111-111111111112'::uuid END, TRUE
FROM (VALUES
  ('MOCK-FAC-GMP',  'GMP overview (mock)',          'FACTORY_GENERAL'),
  ('MOCK-FAC-HSE',  'Occupational safety (mock)',   'FACTORY_GENERAL'),
  ('MOCK-FAC-FIRE', 'Fire safety (mock)',           'FACTORY_GENERAL'),
  ('MOCK-FAC-DI',   'Data integrity (mock)',        'FACTORY_GENERAL'),
  ('MOCK-QC-LAB',   'Laboratory practice (mock)',   'DEPARTMENT_GENERAL'),
  ('MOCK-QC-OOS',   'OOS handling (mock)',          'DEPARTMENT_GENERAL')
) AS v(code, name, scope)
WHERE NOT EXISTS (SELECT 1 FROM training_topics t WHERE t.code = v.code);

-- The people: 15 active users with an employee code who hold no position yet.
INSERT INTO training_person_positions (id, person_user_id, position_id, department_id, valid_from, source)
SELECT gen_random_uuid(), x.uid,
       (SELECT id FROM positions WHERE code = CASE WHEN x.rn <= 6 THEN 'QCANALYST' WHEN x.rn <= 11 THEN 'MOCK-QCSUP' ELSE 'MOCK-QCTECH' END),
       '23111111-1111-1111-1111-111111111112', DATE '2026-10-20', 'ADMIN'
FROM (SELECT u.id AS uid, row_number() OVER (ORDER BY u.employee_code, u.id) AS rn FROM app_users u
       WHERE u.status = 'Active' AND u.employee_code IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM training_person_positions tp WHERE tp.person_user_id = u.id AND tp.valid_to IS NULL)) x
WHERE x.rn <= 15
  AND NOT EXISTS (SELECT 1 FROM training_matrices m WHERE m.code = 'TM-MOCK-QC');

-- The matrix: built as a draft, then made effective, because the rows of an effective version cannot be changed.
INSERT INTO training_matrices (id, department_id, code)
SELECT gen_random_uuid(), '23111111-1111-1111-1111-111111111112', 'TM-MOCK-QC'
WHERE NOT EXISTS (SELECT 1 FROM training_matrices m WHERE m.code = 'TM-MOCK-QC' OR m.department_id = '23111111-1111-1111-1111-111111111112');

INSERT INTO training_matrix_versions (id, matrix_id, version_no, status, change_reason)
SELECT gen_random_uuid(), m.id, 1, 'DRAFT', 'DEV mock data'
FROM training_matrices m WHERE m.code = 'TM-MOCK-QC'
  AND NOT EXISTS (SELECT 1 FROM training_matrix_versions v WHERE v.matrix_id = m.id);

INSERT INTO training_matrix_rows (id, version_id, row_no, row_group, topic_id, document_id, annual_required)
SELECT gen_random_uuid(), v.id, r.no, r.grp, t.id, d.id, r.annual
FROM training_matrices m JOIN training_matrix_versions v ON v.matrix_id = m.id AND v.status = 'DRAFT'
JOIN (VALUES
  (1,  'FACTORY_GENERAL',    'MOCK-FAC-GMP',  NULL,        TRUE),
  (2,  'FACTORY_GENERAL',    'MOCK-FAC-HSE',  NULL,        TRUE),
  (3,  'FACTORY_GENERAL',    'MOCK-FAC-FIRE', NULL,        FALSE),
  (4,  'FACTORY_GENERAL',    'MOCK-FAC-DI',   NULL,        TRUE),
  (5,  'DEPARTMENT_GENERAL', 'MOCK-QC-LAB',   NULL,        TRUE),
  (6,  'DEPARTMENT_GENERAL', 'MOCK-QC-OOS',   NULL,        FALSE),
  (7,  'SOP',                NULL,            'SOP.0016',  FALSE),
  (8,  'SOP',                NULL,            'SOP.0019',  FALSE),
  (9,  'SOP',                NULL,            'SOP.10109', TRUE),
  (10, 'SOP',                NULL,            'SOP.0020',  FALSE)
) AS r(no, grp, topic_code, doc_no, annual) ON TRUE
LEFT JOIN training_topics t ON t.code = r.topic_code
LEFT JOIN documents d ON d.document_number = r.doc_no
WHERE m.code = 'TM-MOCK-QC' AND (t.id IS NOT NULL OR d.id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM training_matrix_rows x WHERE x.version_id = v.id AND x.row_no = r.no);

INSERT INTO training_matrix_cells (row_id, position_id)
SELECT r.id, p.id
FROM training_matrices m JOIN training_matrix_versions v ON v.matrix_id = m.id AND v.status = 'DRAFT'
JOIN training_matrix_rows r ON r.version_id = v.id
JOIN (VALUES
  (1,'QCANALYST'),(1,'MOCK-QCSUP'),(1,'MOCK-QCTECH'), (2,'QCANALYST'),(2,'MOCK-QCSUP'),(2,'MOCK-QCTECH'),
  (3,'QCANALYST'),(3,'MOCK-QCSUP'),(3,'MOCK-QCTECH'), (4,'QCANALYST'),(4,'MOCK-QCSUP'),
  (5,'QCANALYST'),(5,'MOCK-QCSUP'),(5,'MOCK-QCTECH'), (6,'QCANALYST'),(6,'MOCK-QCSUP'),
  (7,'QCANALYST'),(7,'MOCK-QCSUP'), (8,'MOCK-QCSUP'), (9,'QCANALYST'),(9,'MOCK-QCSUP'),(9,'MOCK-QCTECH'), (10,'QCANALYST')
) AS c(no, pcode) ON c.no = r.row_no
JOIN positions p ON p.code = c.pcode
WHERE m.code = 'TM-MOCK-QC'
  AND NOT EXISTS (SELECT 1 FROM training_matrix_cells x WHERE x.row_id = r.id AND x.position_id = p.id);

UPDATE training_matrix_versions v SET status = 'EFFECTIVE', effective_at = now(), approved_at = now(), updated_at = now()
FROM training_matrices m WHERE m.id = v.matrix_id AND m.code = 'TM-MOCK-QC' AND v.status = 'DRAFT';
UPDATE training_matrices m SET current_version_id = (SELECT v.id FROM training_matrix_versions v WHERE v.matrix_id = m.id AND v.version_no = 1)
WHERE m.code = 'TM-MOCK-QC' AND m.current_version_id IS NULL;

-- Personal training records. A bucket 0..99 per person and row is taken from a hash, so the spread is similar on every run (row ids are random, so the exact cells differ):
--   topics: < 62 trained recently, < 70 trained long ago (Annual due when the row is annual), otherwise no record (Required);
--   SOP:    < 55 trained on the effective revision, < 68 only on an older one (Update needed), < 75 no record, otherwise the effective revision.
-- The 1st and 7th person are trained on everything (ready for a work assignment). People 3, 6, 9, 12, 15 get no record on rows 3 and 7: they are on the
-- open activity below (In progress).
INSERT INTO training_records (id, person_user_id, activity_id, training_number, topic_text, document_number, document_revision, completed_on, method, result,
                              employee_code, full_name, department, position, content_sha256)
SELECT gen_random_uuid(), g.uid, 'a9282006-675f-4348-9b60-0899e73cd69d', 'TRN/MOCK/26-001', g.topic_text, g.doc_no, g.revision, g.done_on, 'CLASSROOM', 'PASSED',
       g.employee_code, g.full_name, 'Quality Control', g.position, md5(g.uid::text || g.row_id::text) || md5(g.row_id::text || g.uid::text)
FROM (
  SELECT pe.uid, pe.rn, pe.employee_code, pe.full_name, pe.position, r.id AS row_id, r.row_no, r.annual_required,
         COALESCE(t.name, d.document_name) AS topic_text, d.document_number AS doc_no,
         (SELECT dr.revision_number FROM document_revisions dr WHERE dr.document_id = d.id AND dr.status_code = 'EFFECTIVE' ORDER BY dr.effective_date DESC NULLS LAST LIMIT 1) AS eff_rev,
         CASE WHEN pe.rn IN (1, 7) THEN 0 ELSE abs(('x' || substr(md5(pe.uid::text || r.id::text), 1, 7))::bit(28)::int) % 100 END AS bucket
  FROM (SELECT u.id AS uid, u.employee_code, u.full_name, p.name AS position, tp.position_id,
               row_number() OVER (ORDER BY tp.position_id <> (SELECT id FROM positions WHERE code = 'QCANALYST'), tp.position_id, u.employee_code, u.id) AS rn
          FROM training_person_positions tp JOIN app_users u ON u.id = tp.person_user_id JOIN positions p ON p.id = tp.position_id
         WHERE tp.valid_from = DATE '2026-10-20' AND tp.valid_to IS NULL AND tp.department_id = '23111111-1111-1111-1111-111111111112') pe
  JOIN training_matrices m ON m.code = 'TM-MOCK-QC'
  JOIN training_matrix_versions v ON v.matrix_id = m.id AND v.status = 'EFFECTIVE'
  JOIN training_matrix_rows r ON r.version_id = v.id
  JOIN training_matrix_cells c ON c.row_id = r.id AND c.position_id = pe.position_id
  LEFT JOIN training_topics t ON t.id = r.topic_id
  LEFT JOIN documents d ON d.id = r.document_id
) x
CROSS JOIN LATERAL (
  SELECT x.uid, x.row_id, x.employee_code, x.full_name, x.position, x.topic_text, x.doc_no,
         CASE WHEN x.doc_no IS NULL THEN NULL
              WHEN x.bucket >= 55 AND x.bucket < 68 THEN '0.9.0' ELSE x.eff_rev END AS revision,
         CASE WHEN x.doc_no IS NULL AND x.bucket >= 62 AND x.bucket < 70 THEN current_date - 420
              ELSE current_date - (10 + x.bucket * 2) END AS done_on
) g
WHERE NOT EXISTS (SELECT 1 FROM training_records e WHERE e.training_number = 'TRN/MOCK/26-001' AND e.person_user_id = x.uid AND e.topic_text = x.topic_text)
  AND NOT (x.rn IN (3, 6, 9, 12, 15) AND x.row_no IN (3, 7))
  AND ( (x.doc_no IS NULL AND (x.bucket < 70))
     OR (x.doc_no IS NOT NULL AND (x.bucket < 68 OR x.bucket >= 75)) );

-- In progress: five people are invited to the open activity TRN/QA/26-055, which gets two topics of the mock matrix.
INSERT INTO training_session_topics (id, session_id, topic_text, document_id, document_number, revision_number)
SELECT gen_random_uuid(), '875077f5-17d3-42a0-b536-3f2babe03d0f', v.topic_text, v.document_id, v.document_number, v.revision_number
FROM (
  SELECT 'Fire safety (mock)' AS topic_text, NULL::uuid AS document_id, NULL::varchar AS document_number, NULL::varchar AS revision_number
  UNION ALL
  SELECT d.document_name, d.id, d.document_number, NULL FROM documents d WHERE d.document_number = 'SOP.0016'
) v
WHERE EXISTS (SELECT 1 FROM training_activities a WHERE a.id = '3ae72892-a3ab-4406-b265-6e455736648f')
  AND NOT EXISTS (SELECT 1 FROM training_session_topics x WHERE x.session_id = '875077f5-17d3-42a0-b536-3f2babe03d0f' AND x.topic_text = v.topic_text);

INSERT INTO training_participants (id, activity_id, session_id, person_user_id, employee_code, full_name, department, position, state, result, sign_mode, version)
SELECT gen_random_uuid(), '3ae72892-a3ab-4406-b265-6e455736648f', '875077f5-17d3-42a0-b536-3f2babe03d0f', pe.uid, pe.employee_code, pe.full_name, 'Quality Control', pe.position, 'INVITED', 'PENDING', 'NONE', 1
FROM (SELECT u.id AS uid, u.employee_code, u.full_name, p.name AS position,
             row_number() OVER (ORDER BY tp.position_id <> (SELECT id FROM positions WHERE code = 'QCANALYST'), tp.position_id, u.employee_code, u.id) AS rn
        FROM training_person_positions tp JOIN app_users u ON u.id = tp.person_user_id JOIN positions p ON p.id = tp.position_id
       WHERE tp.valid_from = DATE '2026-10-20' AND tp.valid_to IS NULL AND tp.department_id = '23111111-1111-1111-1111-111111111112') pe
WHERE pe.rn IN (3, 6, 9, 12, 15)
  AND NOT EXISTS (SELECT 1 FROM training_participants x WHERE x.session_id = '875077f5-17d3-42a0-b536-3f2babe03d0f' AND x.person_user_id = pe.uid);

COMMIT;
