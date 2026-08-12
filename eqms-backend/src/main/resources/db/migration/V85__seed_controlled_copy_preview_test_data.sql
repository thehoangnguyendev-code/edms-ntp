DO $$
DECLARE
    v_admin_id uuid;
    v_author_id uuid;
BEGIN
    SELECT id INTO v_admin_id
    FROM app_users
    WHERE username = 'admin'
    ORDER BY created_at
    LIMIT 1;

    SELECT id INTO v_author_id
    FROM app_users
    WHERE username = 'test.author1'
    ORDER BY created_at
    LIMIT 1;

    IF v_admin_id IS NULL OR v_author_id IS NULL THEN
        RETURN;
    END IF;

    WITH effective_revisions AS (
        SELECT
            r.id AS revision_id,
            r.document_id,
            r.document_number,
            d.document_name,
            r.revision_number,
            bu.name AS business_unit_name,
            dep.name AS department_name,
            COALESCE(r.effective_date, d.effective_date, CURRENT_DATE) AS effective_date,
            COALESCE(r.valid_until, d.valid_until, CURRENT_DATE + INTERVAL '1 year')::date AS valid_until,
            ROW_NUMBER() OVER (ORDER BY r.created_at DESC, r.id) AS rn
        FROM document_revisions r
        JOIN documents d ON d.id = r.document_id
        LEFT JOIN business_units bu ON bu.id = d.business_unit_id
        LEFT JOIN departments dep ON dep.id = d.department_id
        WHERE r.status_code = 'EFFECTIVE'
    ),
    seed_rows AS (
        SELECT
            gen_random_uuid() AS id,
            er.document_id,
            er.revision_id,
            CASE er.rn
                WHEN 1 THEN 'CC.PREVIEW.001'
                ELSE 'CC.PREVIEW.002'
            END AS controlled_copy_number,
            1 AS copy_number,
            1 AS total_copies,
            er.document_number,
            er.document_name AS document_title,
            er.revision_number,
            er.business_unit_name,
            er.department_name,
            er.document_name AS distribution_list,
            'individual' AS distribution_scope,
            'QA Preview' AS location,
            'PREVIEW-001' AS location_code,
            'Seeded controlled copy preview test data' AS request_reason,
            'Distributed' AS status,
            'Distributed' AS current_stage,
            v_admin_id AS requested_by_user_id,
            NOW() - INTERVAL '2 days' AS requested_at,
            v_admin_id AS approved_by_user_id,
            NOW() - INTERVAL '2 days' AS approved_at,
            v_admin_id AS printed_by_user_id,
            NOW() - INTERVAL '2 days' AS printed_at,
            v_admin_id AS distributed_by_user_id,
            NOW() - INTERVAL '2 days' AS distributed_at,
            CASE WHEN er.rn = 1 THEN 'admin' ELSE 'test.author1' END AS recipient_name,
            'Seed preview distribution comment' AS distribution_comment,
            CASE WHEN er.rn = 1 THEN 'admin' ELSE 'test.author1' END AS recipient_signature,
            CURRENT_DATE - 1 AS recipient_date,
            NULL::uuid AS recalled_by_user_id,
            NULL::timestamptz AS recalled_at,
            NULL::text AS recall_reason,
            NULL::uuid AS destroyed_by_user_id,
            NULL::timestamptz AS destroyed_at,
            NULL::text AS destroy_reason,
            NULL::text AS destruction_method,
            NULL::text AS destruction_type,
            NULL::text AS witnessed_by,
            NULL::uuid AS cancelled_by_user_id,
            NULL::timestamptz AS cancelled_at,
            er.valid_until,
            er.effective_date,
            CASE WHEN er.rn = 1 THEN v_admin_id ELSE v_author_id END AS recipient_user_id,
            CASE WHEN er.rn = 1 THEN 'preview-token-001' ELSE 'preview-token-002' END AS access_token,
            NOW() - INTERVAL '2 days' AS access_token_issued_at
        FROM effective_revisions er
        WHERE er.rn IN (1, 2)
    )
    INSERT INTO controlled_copies (
        id,
        document_id,
        revision_id,
        controlled_copy_number,
        copy_number,
        total_copies,
        document_number,
        document_title,
        revision_number,
        business_unit_name,
        department_name,
        distribution_list,
        distribution_scope,
        location,
        location_code,
        request_reason,
        status,
        current_stage,
        requested_by_user_id,
        requested_at,
        approved_by_user_id,
        approved_at,
        printed_by_user_id,
        printed_at,
        distributed_by_user_id,
        distributed_at,
        recipient_name,
        distribution_comment,
        recipient_signature,
        recipient_date,
        recalled_by_user_id,
        recalled_at,
        recall_reason,
        destroyed_by_user_id,
        destroyed_at,
        destroy_reason,
        destruction_method,
        destruction_type,
        witnessed_by,
        cancelled_by_user_id,
        cancelled_at,
        valid_until,
        effective_date,
        recipient_user_id,
        access_token,
        access_token_issued_at,
        created_at,
        updated_at
    )
    SELECT
        id,
        document_id,
        revision_id,
        controlled_copy_number,
        copy_number,
        total_copies,
        document_number,
        document_title,
        revision_number,
        business_unit_name,
        department_name,
        distribution_list,
        distribution_scope,
        location,
        location_code,
        request_reason,
        status,
        current_stage,
        requested_by_user_id,
        requested_at,
        approved_by_user_id,
        approved_at,
        printed_by_user_id,
        printed_at,
        distributed_by_user_id,
        distributed_at,
        recipient_name,
        distribution_comment,
        recipient_signature,
        recipient_date,
        recalled_by_user_id,
        recalled_at,
        recall_reason,
        destroyed_by_user_id,
        destroyed_at,
        destroy_reason,
        destruction_method,
        destruction_type,
        witnessed_by,
        cancelled_by_user_id,
        cancelled_at,
        valid_until,
        effective_date,
        recipient_user_id,
        access_token,
        access_token_issued_at,
        NOW(),
        NOW()
    FROM seed_rows
    ON CONFLICT (controlled_copy_number) DO NOTHING;
END $$;
