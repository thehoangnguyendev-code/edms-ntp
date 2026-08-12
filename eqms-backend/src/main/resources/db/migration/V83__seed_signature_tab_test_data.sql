-- V83: Seed signature tab test data for documents and revisions.
-- This migration backfills workflow signature fields and audit logs so the
-- signatures tabs have deterministic data in dev/test databases.

DO $$
DECLARE
    v_author_id uuid;
    v_reviewer1_id uuid;
    v_approver1_id uuid;
    v_admin_id uuid;
    v_doc2_id uuid := 'f0000001-0000-0000-0000-000000000002'::uuid;
    v_doc5_id uuid := 'f0000001-0000-0000-0000-000000000005'::uuid;
    v_doc7_id uuid := 'f0000001-0000-0000-0000-000000000007'::uuid;
    v_doc8_id uuid := 'f0000001-0000-0000-0000-000000000008'::uuid;
    v_rev2_id uuid := 'f0000001-0000-0000-0000-000000000012'::uuid;
    v_rev3_id uuid := 'f0000001-0000-0000-0000-000000000013'::uuid;
    v_rev5_id uuid := 'f0000001-0000-0000-0000-000000000015'::uuid;
    v_rev7_id uuid := 'f0000001-0000-0000-0000-000000000017'::uuid;
    v_rev8_id uuid := 'f0000001-0000-0000-0000-000000000018'::uuid;
BEGIN
    SELECT id INTO v_admin_id FROM app_users WHERE username = 'admin' ORDER BY created_at LIMIT 1;
    SELECT id INTO v_author_id FROM app_users WHERE username = 'test.author1' ORDER BY created_at LIMIT 1;
    SELECT id INTO v_reviewer1_id FROM app_users WHERE username = 'test.reviewer1' ORDER BY created_at LIMIT 1;
    SELECT id INTO v_approver1_id FROM app_users WHERE username = 'test.approver1' ORDER BY created_at LIMIT 1;

    IF v_author_id IS NULL OR v_admin_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE document_revisions dr
    SET
        submitted_by_user_id = COALESCE(seed.submitted_by_user_id, dr.submitted_by_user_id),
        submitted_on = COALESCE(seed.submitted_on, dr.submitted_on),
        rejected_by_user_id = COALESCE(seed.rejected_by_user_id, dr.rejected_by_user_id),
        rejected_at = COALESCE(seed.rejected_at, dr.rejected_at),
        published_by_user_id = COALESCE(seed.published_by_user_id, dr.published_by_user_id),
        published_at = COALESCE(seed.published_at, dr.published_at),
        obsoleted_by_user_id = COALESCE(seed.obsoleted_by_user_id, dr.obsoleted_by_user_id),
        obsoleted_at = COALESCE(seed.obsoleted_at, dr.obsoleted_at),
        cancelled_by_user_id = COALESCE(seed.cancelled_by_user_id, dr.cancelled_by_user_id),
        cancelled_at = COALESCE(seed.cancelled_at, dr.cancelled_at),
        updated_at = NOW()
    FROM (
        VALUES
            (v_rev2_id, v_author_id, NOW() - INTERVAL '10 days', v_reviewer1_id, NOW() - INTERVAL '9 days', NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz),
            (v_rev3_id, v_author_id, NOW() - INTERVAL '9 days', NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz),
            (v_rev5_id, v_author_id, NOW() - INTERVAL '8 days', NULL::uuid, NULL::timestamptz, v_approver1_id, NOW() - INTERVAL '7 days', NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz),
            (v_rev7_id, v_author_id, NOW() - INTERVAL '7 days', NULL::uuid, NULL::timestamptz, v_approver1_id, NOW() - INTERVAL '6 days', v_admin_id, NOW() - INTERVAL '5 days', NULL::uuid, NULL::timestamptz),
            (v_rev8_id, v_author_id, NOW() - INTERVAL '6 days', NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz, NULL::uuid, NULL::timestamptz, v_admin_id, NOW() - INTERVAL '5 days')
    ) AS seed(id, submitted_by_user_id, submitted_on, rejected_by_user_id, rejected_at, published_by_user_id, published_at, obsoleted_by_user_id, obsoleted_at, cancelled_by_user_id, cancelled_at)
    WHERE dr.id = seed.id;

    INSERT INTO audit_logs (
        id,
        entity_type,
        entity_id,
        entity_name,
        event_time,
        user_id,
        username,
        user_full_name,
        employee_code,
        role_name,
        position_name,
        department_name,
        action_type,
        from_status,
        to_status,
        comment,
        entity_code,
        document_number,
        revision_number,
        entity_status,
        acted_by_user_id,
        created_at,
        updated_at
    )
    SELECT *
    FROM (
        VALUES
            (gen_random_uuid(), 'DOCUMENT', v_doc2_id, 'Pending Review Test Document', NOW() - INTERVAL '10 days', v_author_id, 'test.author1', 'Test Author 1', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'SUBMIT_FOR_REVIEW', 'DRAFT', 'PENDING_REVIEW', 'Seeded document submission for signature tab testing', 'SOP-TEST-002', 'SOP-TEST-002', NULL::varchar, 'PENDING_REVIEW', v_author_id, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
            (gen_random_uuid(), 'DOCUMENT', v_doc2_id, 'Pending Review Test Document', NOW() - INTERVAL '9 days', v_reviewer1_id, 'test.reviewer1', 'Test Reviewer 1', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'REVIEW_REJECT', 'PENDING_REVIEW', 'DRAFT', 'Seeded review rejection for signature tab testing', 'SOP-TEST-002', 'SOP-TEST-002', NULL::varchar, 'DRAFT', v_reviewer1_id, NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
            (gen_random_uuid(), 'DOCUMENT', v_doc5_id, 'Ready for Publishing Test Document', NOW() - INTERVAL '8 days', v_author_id, 'test.author1', 'Test Author 1', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'SUBMIT_FOR_REVIEW', 'DRAFT', 'PENDING_REVIEW', 'Seeded document submission for signature tab testing', 'SOP-TEST-005', 'SOP-TEST-005', NULL::varchar, 'PENDING_REVIEW', v_author_id, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
            (gen_random_uuid(), 'DOCUMENT', v_doc5_id, 'Ready for Publishing Test Document', NOW() - INTERVAL '7 days', v_reviewer1_id, 'test.reviewer1', 'Test Reviewer 1', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'REVIEW_COMPLETE', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'Seeded review completion for signature tab testing', 'SOP-TEST-005', 'SOP-TEST-005', NULL::varchar, 'PENDING_APPROVAL', v_reviewer1_id, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
            (gen_random_uuid(), 'DOCUMENT', v_doc5_id, 'Ready for Publishing Test Document', NOW() - INTERVAL '6 days', v_approver1_id, 'test.approver1', 'Test Approver 1', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'APPROVE_COMPLETE', 'PENDING_APPROVAL', 'APPROVED', 'Seeded approval completion for signature tab testing', 'SOP-TEST-005', 'SOP-TEST-005', NULL::varchar, 'APPROVED', v_approver1_id, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
            (gen_random_uuid(), 'DOCUMENT', v_doc5_id, 'Ready for Publishing Test Document', NOW() - INTERVAL '5 days', v_admin_id, 'admin', 'Admin User', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'PUBLISH', 'APPROVED', 'ACTIVE', 'Seeded publish event for signature tab testing', 'SOP-TEST-005', 'SOP-TEST-005', NULL::varchar, 'ACTIVE', v_admin_id, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
            (gen_random_uuid(), 'DOCUMENT', v_doc7_id, 'Obsoleted Test Document', NOW() - INTERVAL '4 days', v_admin_id, 'admin', 'Admin User', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'OBSOLETE', 'ACTIVE', 'OBSOLETED', 'Seeded obsoleted event for signature tab testing', 'SOP-TEST-007', 'SOP-TEST-007', NULL::varchar, 'OBSOLETED', v_admin_id, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
            (gen_random_uuid(), 'DOCUMENT', v_doc8_id, 'Cancelled Test Document', NOW() - INTERVAL '3 days', v_admin_id, 'admin', 'Admin User', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'CANCEL', 'DRAFT', 'CLOSED_CANCELLED', 'Seeded cancel event for signature tab testing', 'SOP-TEST-008', 'SOP-TEST-008', NULL::varchar, 'CLOSED_CANCELLED', v_admin_id, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
    ) AS seeded(
        id,
        entity_type,
        entity_id,
        entity_name,
        event_time,
        user_id,
        username,
        user_full_name,
        employee_code,
        role_name,
        position_name,
        department_name,
        action_type,
        from_status,
        to_status,
        comment,
        entity_code,
        document_number,
        revision_number,
        entity_status,
        acted_by_user_id,
        created_at,
        updated_at
    )
    WHERE NOT EXISTS (
        SELECT 1
        FROM audit_logs existing
        WHERE existing.entity_type = seeded.entity_type
          AND existing.entity_id = seeded.entity_id
          AND existing.action_type = seeded.action_type
          AND existing.event_time = seeded.event_time
    );
END $$;
