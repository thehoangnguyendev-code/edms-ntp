-- V64: Fix opened_by_user_id for seeded documents and revisions to track test.author1 as the opening user
DO $$
DECLARE
    v_author_id uuid;
BEGIN
    SELECT id INTO v_author_id FROM app_users WHERE username = 'test.author1';
    IF v_author_id IS NULL THEN
        RETURN;
    END IF;

    IF v_author_id IS NOT NULL THEN
        -- Update documents
        UPDATE documents
        SET opened_by_user_id = v_author_id
        WHERE document_number IN ('SOP.1001', 'SOP.1002', 'SOP.1003', 'SOP.1004', 'SOP.1005', 'SOP.1006', 'SOP.1007', 'SOP.1008');

        -- Update document_revisions
        UPDATE document_revisions
        SET opened_by_user_id = v_author_id
        WHERE document_number IN ('SOP.1001', 'SOP.1002', 'SOP.1003', 'SOP.1004', 'SOP.1005', 'SOP.1006', 'SOP.1007', 'SOP.1008');
    END IF;
END $$;
