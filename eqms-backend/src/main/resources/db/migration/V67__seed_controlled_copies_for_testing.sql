DO $$
DECLARE
    v_user_id uuid;
    v_effective_count integer;
BEGIN
    SELECT id INTO v_user_id
    FROM app_users
    ORDER BY CASE WHEN username = 'admin' THEN 0 ELSE 1 END, created_at
    LIMIT 1;

    SELECT COUNT(*) INTO v_effective_count
    FROM document_revisions
    WHERE status_code = 'EFFECTIVE';

    IF v_user_id IS NULL OR v_effective_count = 0 THEN
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
            'CC-TEST-' || LPAD(er.rn::text, 3, '0') AS controlled_copy_number,
            er.rn AS copy_number,
            5 AS total_copies,
            er.document_number,
            er.document_name AS document_title,
            er.revision_number,
            er.business_unit_name,
            er.department_name,
            CASE er.rn
                WHEN 1 THEN 'QA Distribution'
                WHEN 2 THEN 'Manufacturing Floor'
                WHEN 3 THEN 'Warehouse'
                WHEN 4 THEN 'Training Room'
                ELSE 'Archive'
            END AS distribution_list,
            CASE WHEN er.rn % 2 = 0 THEN 'Department' ELSE 'Site' END AS distribution_scope,
            CASE er.rn
                WHEN 1 THEN 'QA Office'
                WHEN 2 THEN 'Production Line A'
                WHEN 3 THEN 'Warehouse WH-01'
                WHEN 4 THEN 'Training Room TR-02'
                ELSE 'Document Control Archive'
            END AS location,
            'LOC-' || LPAD(er.rn::text, 3, '0') AS location_code,
            'Seed data for controlled copy workflow testing' AS request_reason,
            CASE er.rn
                WHEN 1 THEN 'Ready for Distribution'
                WHEN 2 THEN 'Distributed'
                WHEN 3 THEN 'Obsolete'
                WHEN 4 THEN 'Obsolete'
                ELSE 'Closed - Cancelled'
            END AS status,
            CASE er.rn
                WHEN 1 THEN 'Ready for Distribution'
                WHEN 2 THEN 'Distributed'
                WHEN 3 THEN 'Recalled'
                WHEN 4 THEN 'Destroyed'
                ELSE 'Cancelled'
            END AS current_stage,
            v_user_id AS requested_by_user_id,
            NOW() - (er.rn || ' days')::interval AS requested_at,
            CASE WHEN er.rn IN (1,2,3,4) THEN v_user_id ELSE NULL END AS approved_by_user_id,
            CASE WHEN er.rn IN (1,2,3,4) THEN NOW() - ((er.rn - 1) || ' days')::interval ELSE NULL END AS approved_at,
            CASE WHEN er.rn IN (2,3,4) THEN v_user_id ELSE NULL END AS printed_by_user_id,
            CASE WHEN er.rn IN (2,3,4) THEN NOW() - ((er.rn - 1) || ' days')::interval ELSE NULL END AS printed_at,
            CASE WHEN er.rn IN (2,3,4) THEN v_user_id ELSE NULL END AS distributed_by_user_id,
            CASE WHEN er.rn IN (2,3,4) THEN NOW() - ((er.rn - 1) || ' days')::interval ELSE NULL END AS distributed_at,
            CASE WHEN er.rn IN (2,3,4) THEN 'Test Recipient ' || er.rn ELSE NULL END AS recipient_name,
            CASE WHEN er.rn IN (2,3,4) THEN 'Seed distribution comment' ELSE NULL END AS distribution_comment,
            CASE WHEN er.rn IN (2,3,4) THEN 'Test Recipient ' || er.rn ELSE NULL END AS recipient_signature,
            CASE WHEN er.rn IN (2,3,4) THEN CURRENT_DATE - er.rn::integer ELSE NULL END AS recipient_date,
            CASE WHEN er.rn = 3 THEN v_user_id ELSE NULL END AS recalled_by_user_id,
            CASE WHEN er.rn = 3 THEN NOW() - INTERVAL '12 hours' ELSE NULL END AS recalled_at,
            CASE WHEN er.rn = 3 THEN 'Seed recall reason' ELSE NULL END AS recall_reason,
            CASE WHEN er.rn = 4 THEN v_user_id ELSE NULL END AS destroyed_by_user_id,
            CASE WHEN er.rn = 4 THEN NOW() - INTERVAL '6 hours' ELSE NULL END AS destroyed_at,
            CASE WHEN er.rn = 4 THEN 'Seed destruction reason' ELSE NULL END AS destroy_reason,
            CASE WHEN er.rn = 4 THEN 'Shredded' ELSE NULL END AS destruction_method,
            CASE WHEN er.rn = 4 THEN 'Physical' ELSE NULL END AS destruction_type,
            CASE WHEN er.rn = 4 THEN 'QA Witness' ELSE NULL END AS witnessed_by,
            CASE WHEN er.rn = 5 THEN v_user_id ELSE NULL END AS cancelled_by_user_id,
            CASE WHEN er.rn = 5 THEN NOW() - INTERVAL '3 hours' ELSE NULL END AS cancelled_at,
            er.valid_until,
            er.effective_date
        FROM effective_revisions er
        WHERE er.rn <= 5
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
        NOW(),
        NOW()
    FROM seed_rows
    ON CONFLICT (controlled_copy_number) DO NOTHING;
END $$;
