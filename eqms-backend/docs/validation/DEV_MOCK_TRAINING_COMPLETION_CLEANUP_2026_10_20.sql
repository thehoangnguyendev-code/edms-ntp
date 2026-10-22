-- DEV ONLY: removes everything DEV_MOCK_TRAINING_COMPLETION_2026_10_20.sql added. Never run on TEST or PROD.
-- Training records and the rows of an effective matrix are immutable by design (database triggers), so the removal switches the triggers off for this one
-- transaction with session_replication_role = replica (needs the DEV superuser). That is acceptable only because the data removed is mock data.
BEGIN;
SET LOCAL session_replication_role = replica;

DELETE FROM training_records WHERE training_number = 'TRN/MOCK/26-001';
DELETE FROM training_participants WHERE session_id = '875077f5-17d3-42a0-b536-3f2babe03d0f'
  AND person_user_id IN (SELECT person_user_id FROM training_person_positions WHERE valid_from = DATE '2026-10-20' AND department_id = '23111111-1111-1111-1111-111111111112');
DELETE FROM training_session_topics WHERE session_id = '875077f5-17d3-42a0-b536-3f2babe03d0f' AND topic_text IN ('Fire safety (mock)')
  OR (session_id = '875077f5-17d3-42a0-b536-3f2babe03d0f' AND document_number = 'SOP.0016' AND revision_number IS NULL AND topic_text IN (SELECT document_name FROM documents WHERE document_number = 'SOP.0016'));

DELETE FROM training_matrix_cells WHERE row_id IN (SELECT r.id FROM training_matrix_rows r JOIN training_matrix_versions v ON v.id = r.version_id JOIN training_matrices m ON m.id = v.matrix_id WHERE m.code = 'TM-MOCK-QC');
DELETE FROM training_matrix_rows WHERE version_id IN (SELECT v.id FROM training_matrix_versions v JOIN training_matrices m ON m.id = v.matrix_id WHERE m.code = 'TM-MOCK-QC');
UPDATE training_matrices SET current_version_id = NULL WHERE code = 'TM-MOCK-QC';
DELETE FROM training_matrix_versions WHERE matrix_id IN (SELECT id FROM training_matrices WHERE code = 'TM-MOCK-QC');
DELETE FROM training_matrices WHERE code = 'TM-MOCK-QC';

DELETE FROM training_person_positions WHERE valid_from = DATE '2026-10-20' AND department_id = '23111111-1111-1111-1111-111111111112' AND source = 'ADMIN' AND created_by IS NULL;
DELETE FROM training_topics WHERE code LIKE 'MOCK-%';
DELETE FROM positions WHERE code LIKE 'MOCK-%';
COMMIT;
