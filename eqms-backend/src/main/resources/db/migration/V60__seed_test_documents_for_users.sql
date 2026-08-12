-- Seed test documents for specific users
DO $$
DECLARE
    -- User IDs
    v_dco_id uuid;
    v_author_id uuid;
    v_coauthor_id uuid;
    v_reviewer1_id uuid;
    v_reviewer2_id uuid;
    v_approver1_id uuid;
    v_approver2_id uuid;

    -- Document/Dept/BU metadata
    v_sop_type_id uuid;
    v_quality_bu_id uuid;
    v_qa_dept_id uuid;

    -- Document IDs
    v_doc1_id uuid := 'f0000001-0000-0000-0000-000000000001'::uuid;
    v_doc2_id uuid := 'f0000001-0000-0000-0000-000000000002'::uuid;
    v_doc3_id uuid := 'f0000001-0000-0000-0000-000000000003'::uuid;
    v_doc4_id uuid := 'f0000001-0000-0000-0000-000000000004'::uuid;
    v_doc5_id uuid := 'f0000001-0000-0000-0000-000000000005'::uuid;
    v_doc6_id uuid := 'f0000001-0000-0000-0000-000000000006'::uuid;
    v_doc7_id uuid := 'f0000001-0000-0000-0000-000000000007'::uuid;
    v_doc8_id uuid := 'f0000001-0000-0000-0000-000000000008'::uuid;

    -- Revision IDs
    v_rev1_id uuid := 'f0000001-0000-0000-0000-000000000011'::uuid;
    v_rev2_id uuid := 'f0000001-0000-0000-0000-000000000012'::uuid;
    v_rev3_id uuid := 'f0000001-0000-0000-0000-000000000013'::uuid;
    v_rev4_id uuid := 'f0000001-0000-0000-0000-000000000014'::uuid;
    v_rev5_id uuid := 'f0000001-0000-0000-0000-000000000015'::uuid;
    v_rev6_id uuid := 'f0000001-0000-0000-0000-000000000016'::uuid;
    v_rev7_id uuid := 'f0000001-0000-0000-0000-000000000017'::uuid;
    v_rev8_id uuid := 'f0000001-0000-0000-0000-000000000018'::uuid;
BEGIN
    -- Resolve User IDs
    SELECT id INTO v_dco_id FROM app_users WHERE username = 'test.dco1';
    SELECT id INTO v_author_id FROM app_users WHERE username = 'test.author1';
    SELECT id INTO v_coauthor_id FROM app_users WHERE username = 'test.coauthor1';
    SELECT id INTO v_reviewer1_id FROM app_users WHERE username = 'test.reviewer1';
    SELECT id INTO v_reviewer2_id FROM app_users WHERE username = 'test.reviewer2';
    SELECT id INTO v_approver1_id FROM app_users WHERE username = 'test.approver1';
    SELECT id INTO v_approver2_id FROM app_users WHERE username = 'test.approver2';

    -- Resolve Metadata IDs
    SELECT id INTO v_sop_type_id FROM document_types WHERE short_code = 'SOP' LIMIT 1;
    SELECT id INTO v_quality_bu_id FROM business_units WHERE code IN ('QUAL', 'QUALITY') ORDER BY CASE WHEN code = 'QUAL' THEN 0 ELSE 1 END LIMIT 1;
    SELECT id INTO v_qa_dept_id FROM departments WHERE code IN ('QA', 'QUALITY_ASSURANCE') ORDER BY CASE WHEN code = 'QA' THEN 0 ELSE 1 END LIMIT 1;

    -- Ensure we resolved the necessary users and metadata
    IF v_author_id IS NULL THEN
        RETURN;
    END IF;
    IF v_sop_type_id IS NULL THEN
        RETURN;
    END IF;

    -- Seed Pool Members
    IF v_dco_id IS NOT NULL THEN
        INSERT INTO document_workflow_pool_members (id, pool_type, user_id, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'DCO', v_dco_id, true, NOW(), NOW())
        ON CONFLICT (pool_type, user_id) DO NOTHING;
    END IF;

    IF v_reviewer1_id IS NOT NULL THEN
        INSERT INTO document_workflow_pool_members (id, pool_type, user_id, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'REVIEWER', v_reviewer1_id, true, NOW(), NOW())
        ON CONFLICT (pool_type, user_id) DO NOTHING;
    END IF;

    IF v_reviewer2_id IS NOT NULL THEN
        INSERT INTO document_workflow_pool_members (id, pool_type, user_id, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'REVIEWER', v_reviewer2_id, true, NOW(), NOW())
        ON CONFLICT (pool_type, user_id) DO NOTHING;
    END IF;

    IF v_approver1_id IS NOT NULL THEN
        INSERT INTO document_workflow_pool_members (id, pool_type, user_id, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'APPROVER', v_approver1_id, true, NOW(), NOW())
        ON CONFLICT (pool_type, user_id) DO NOTHING;
    END IF;

    IF v_approver2_id IS NOT NULL THEN
        INSERT INTO document_workflow_pool_members (id, pool_type, user_id, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), 'APPROVER', v_approver2_id, true, NOW(), NOW())
        ON CONFLICT (pool_type, user_id) DO NOTHING;
    END IF;

    -- Seed Documents
    INSERT INTO documents (
        id, document_number, document_name, title_local_language, version, status_code,
        document_type_id, business_unit_id, department_id, author_user_id, owner_user_id,
        opened_by_user_id, last_modified_by_user_id, description, is_template,
        has_related_documents, has_correlated_documents, requires_training, created_at, updated_at
    ) VALUES
        -- DOC 1: DRAFT / DRAFT
        (v_doc1_id, 'SOP-TEST-001', 'Draft Test Document', NULL, '0.0.1', 'DRAFT', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Draft', false, false, false, false, NOW(), NOW()),
        -- DOC 2: DRAFT / PENDING_REVIEW
        (v_doc2_id, 'SOP-TEST-002', 'Pending Review Test Document', NULL, '0.0.1', 'DRAFT', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Pending Review', false, false, false, false, NOW(), NOW()),
        -- DOC 3: DRAFT / PENDING_APPROVAL
        (v_doc3_id, 'SOP-TEST-003', 'Pending Approval Test Document', NULL, '0.0.1', 'DRAFT', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Pending Approval', false, false, false, false, NOW(), NOW()),
        -- DOC 4: DRAFT / PENDING_TRAINING
        (v_doc4_id, 'SOP-TEST-004', 'Pending Training Test Document', NULL, '0.0.1', 'DRAFT', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Pending Training', false, false, false, true, NOW(), NOW()),
        -- DOC 5: DRAFT / READY_FOR_PUBLISHING
        (v_doc5_id, 'SOP-TEST-005', 'Ready for Publishing Test Document', NULL, '0.0.1', 'DRAFT', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Ready for Publishing', false, false, false, false, NOW(), NOW()),
        -- DOC 6: ACTIVE / EFFECTIVE
        (v_doc6_id, 'SOP-TEST-006', 'Effective Test Document', NULL, '1.0.0', 'ACTIVE', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Effective', false, false, false, false, NOW(), NOW()),
        -- DOC 7: OBSOLETED / OBSOLETED
        (v_doc7_id, 'SOP-TEST-007', 'Obsoleted Test Document', NULL, '1.0.0', 'OBSOLETED', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Obsoleted', false, false, false, false, NOW(), NOW()),
        -- DOC 8: CLOSED_CANCELLED / CLOSED_CANCELLED
        (v_doc8_id, 'SOP-TEST-008', 'Cancelled Test Document', NULL, '0.0.1', 'CLOSED_CANCELLED', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Cancelled', false, false, false, false, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Seed Document Revisions
    INSERT INTO document_revisions (
        id, document_id, parent_revision_id, document_number, revision_name, revision_number,
        status_code, document_type_id, business_unit_id, department_id, author_user_id, owner_user_id,
        opened_by_user_id, last_modified_by_user_id, description, is_template,
        has_related_documents, has_correlated_documents, document_name, requires_training, created_at, updated_at
    ) VALUES
        -- REV 1: DRAFT
        (v_rev1_id, v_doc1_id, NULL, 'SOP-TEST-001', 'Draft Test Document_0.0.1', '0.0.1', 'DRAFT', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Draft Revision', false, false, false, 'Draft Test Document', false, NOW(), NOW()),
        -- REV 2: PENDING_REVIEW
        (v_rev2_id, v_doc2_id, NULL, 'SOP-TEST-002', 'Pending Review Test Document_0.0.1', '0.0.1', 'PENDING_REVIEW', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Pending Review Revision', false, false, false, 'Pending Review Test Document', false, NOW(), NOW()),
        -- REV 3: PENDING_APPROVAL
        (v_rev3_id, v_doc3_id, NULL, 'SOP-TEST-003', 'Pending Approval Test Document_0.0.1', '0.0.1', 'PENDING_APPROVAL', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Pending Approval Revision', false, false, false, 'Pending Approval Test Document', false, NOW(), NOW()),
        -- REV 4: PENDING_TRAINING
        (v_rev4_id, v_doc4_id, NULL, 'SOP-TEST-004', 'Pending Training Test Document_0.0.1', '0.0.1', 'PENDING_TRAINING', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Pending Training Revision', false, false, false, 'Pending Training Test Document', true, NOW(), NOW()),
        -- REV 5: READY_FOR_PUBLISHING
        (v_rev5_id, v_doc5_id, NULL, 'SOP-TEST-005', 'Ready for Publishing Test Document_0.0.1', '0.0.1', 'READY_FOR_PUBLISHING', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Ready for Publishing Revision', false, false, false, 'Ready for Publishing Test Document', false, NOW(), NOW()),
        -- REV 6: EFFECTIVE
        (v_rev6_id, v_doc6_id, NULL, 'SOP-TEST-006', 'Effective Test Document_1.0.0', '1.0.0', 'EFFECTIVE', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Effective Revision', false, false, false, 'Effective Test Document', false, NOW(), NOW()),
        -- REV 7: OBSOLETED
        (v_rev7_id, v_doc7_id, NULL, 'SOP-TEST-007', 'Obsoleted Test Document_1.0.0', '1.0.0', 'OBSOLETED', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Obsoleted Revision', false, false, false, 'Obsoleted Test Document', false, NOW(), NOW()),
        -- REV 8: CLOSED_CANCELLED
        (v_rev8_id, v_doc8_id, NULL, 'SOP-TEST-008', 'Cancelled Test Document_0.0.1', '0.0.1', 'CLOSED_CANCELLED', v_sop_type_id, v_quality_bu_id, v_qa_dept_id, v_author_id, v_author_id, NULL, v_author_id, 'Test Cancelled Revision', false, false, false, 'Cancelled Test Document', false, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Helper to seed participants for each document & revision
    -- Doc 1
    IF v_coauthor_id IS NOT NULL THEN
        INSERT INTO document_workflow_participants (id, document_id, participant_type, user_id, sequence_order, created_at, updated_at)
        VALUES (gen_random_uuid(), v_doc1_id, 'CO_AUTHOR', v_coauthor_id, 0, NOW(), NOW()) ON CONFLICT (document_id, participant_type, user_id) DO NOTHING;
        INSERT INTO revision_workflow_participants (id, revision_id, participant_type, user_id, sequence_order, created_at, updated_at)
        VALUES (gen_random_uuid(), v_rev1_id, 'CO_AUTHOR', v_coauthor_id, 0, NOW(), NOW()) ON CONFLICT (revision_id, participant_type, user_id) DO NOTHING;
    END IF;

    -- Reviewers and Approvers and DCO for all documents
    FOR i IN 1..8 LOOP
        DECLARE
            v_curr_doc_id uuid;
            v_curr_rev_id uuid;
        BEGIN
            IF i = 1 THEN v_curr_doc_id := v_doc1_id; v_curr_rev_id := v_rev1_id; END IF;
            IF i = 2 THEN v_curr_doc_id := v_doc2_id; v_curr_rev_id := v_rev2_id; END IF;
            IF i = 3 THEN v_curr_doc_id := v_doc3_id; v_curr_rev_id := v_rev3_id; END IF;
            IF i = 4 THEN v_curr_doc_id := v_doc4_id; v_curr_rev_id := v_rev4_id; END IF;
            IF i = 5 THEN v_curr_doc_id := v_doc5_id; v_curr_rev_id := v_rev5_id; END IF;
            IF i = 6 THEN v_curr_doc_id := v_doc6_id; v_curr_rev_id := v_rev6_id; END IF;
            IF i = 7 THEN v_curr_doc_id := v_doc7_id; v_curr_rev_id := v_rev7_id; END IF;
            IF i = 8 THEN v_curr_doc_id := v_doc8_id; v_curr_rev_id := v_rev8_id; END IF;

            -- CO_AUTHOR
            IF v_coauthor_id IS NOT NULL THEN
                INSERT INTO document_workflow_participants (id, document_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_doc_id, 'CO_AUTHOR', v_coauthor_id, 0, NOW(), NOW()) ON CONFLICT (document_id, participant_type, user_id) DO NOTHING;
                INSERT INTO revision_workflow_participants (id, revision_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_rev_id, 'CO_AUTHOR', v_coauthor_id, 0, NOW(), NOW()) ON CONFLICT (revision_id, participant_type, user_id) DO NOTHING;
            END IF;

            -- DCO
            IF v_dco_id IS NOT NULL THEN
                INSERT INTO document_workflow_participants (id, document_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_doc_id, 'DCO', v_dco_id, 0, NOW(), NOW()) ON CONFLICT (document_id, participant_type, user_id) DO NOTHING;
                INSERT INTO revision_workflow_participants (id, revision_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_rev_id, 'DCO', v_dco_id, 0, NOW(), NOW()) ON CONFLICT (revision_id, participant_type, user_id) DO NOTHING;
            END IF;

            -- REVIEWER 1
            IF v_reviewer1_id IS NOT NULL THEN
                INSERT INTO document_workflow_participants (id, document_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_doc_id, 'REVIEWER', v_reviewer1_id, 1, NOW(), NOW()) ON CONFLICT (document_id, participant_type, user_id) DO NOTHING;
                INSERT INTO revision_workflow_participants (id, revision_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_rev_id, 'REVIEWER', v_reviewer1_id, 1, NOW(), NOW()) ON CONFLICT (revision_id, participant_type, user_id) DO NOTHING;
            END IF;

            -- REVIEWER 2
            IF v_reviewer2_id IS NOT NULL THEN
                INSERT INTO document_workflow_participants (id, document_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_doc_id, 'REVIEWER', v_reviewer2_id, 2, NOW(), NOW()) ON CONFLICT (document_id, participant_type, user_id) DO NOTHING;
                INSERT INTO revision_workflow_participants (id, revision_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_rev_id, 'REVIEWER', v_reviewer2_id, 2, NOW(), NOW()) ON CONFLICT (revision_id, participant_type, user_id) DO NOTHING;
            END IF;

            -- APPROVER 1
            IF v_approver1_id IS NOT NULL THEN
                INSERT INTO document_workflow_participants (id, document_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_doc_id, 'APPROVER', v_approver1_id, 1, NOW(), NOW()) ON CONFLICT (document_id, participant_type, user_id) DO NOTHING;
                INSERT INTO revision_workflow_participants (id, revision_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_rev_id, 'APPROVER', v_approver1_id, 1, NOW(), NOW()) ON CONFLICT (revision_id, participant_type, user_id) DO NOTHING;
            END IF;

            -- APPROVER 2
            IF v_approver2_id IS NOT NULL THEN
                INSERT INTO document_workflow_participants (id, document_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_doc_id, 'APPROVER', v_approver2_id, 2, NOW(), NOW()) ON CONFLICT (document_id, participant_type, user_id) DO NOTHING;
                INSERT INTO revision_workflow_participants (id, revision_id, participant_type, user_id, sequence_order, created_at, updated_at)
                VALUES (gen_random_uuid(), v_curr_rev_id, 'APPROVER', v_approver2_id, 2, NOW(), NOW()) ON CONFLICT (revision_id, participant_type, user_id) DO NOTHING;
            END IF;
        END;
    END LOOP;
END $$;
