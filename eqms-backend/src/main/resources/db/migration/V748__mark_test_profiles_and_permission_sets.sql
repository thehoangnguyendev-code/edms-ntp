-- Owner request 2026-11-09: make DEV/UAT/test Access Profiles and Permission Sets recognisable on screen.
-- test_data is a plain flag shown as a "Test" badge; it never changes what a profile or set grants.
-- Only rows whose code clearly names a test (UAT, DCV, *_TEST, *_DEV_TEST, QA_REASON_TEST_*) are flagged;
-- real profiles that merely have no users yet (for example TRN_*) are left alone.
ALTER TABLE roles ADD COLUMN IF NOT EXISTS test_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE permission_sets ADD COLUMN IF NOT EXISTS test_data BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE roles SET test_data = TRUE
 WHERE is_system = FALSE
   AND (code LIKE 'AP\_UAT\_%' ESCAPE '\' OR code LIKE 'DCV\_%' ESCAPE '\' OR code LIKE '%\_TEST' ESCAPE '\'
        OR code LIKE 'TEST\_%' ESCAPE '\' OR code LIKE '%\_DEV\_TEST' ESCAPE '\');

UPDATE permission_sets SET test_data = TRUE
 WHERE system = FALSE
   AND (code LIKE 'PS\_UAT\_%' ESCAPE '\' OR code LIKE 'PS\_DCV\_%' ESCAPE '\' OR code LIKE '%\_TEST' ESCAPE '\'
        OR code LIKE 'QA\_REASON\_TEST\_%' ESCAPE '\' OR code LIKE '%\_DEV\_TEST' ESCAPE '\' OR code = 'ROLE_TEST_SUBMIT_ONLY');
