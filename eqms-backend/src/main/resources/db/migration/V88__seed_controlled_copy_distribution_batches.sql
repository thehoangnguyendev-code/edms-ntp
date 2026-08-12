DO $$
DECLARE
    v_admin_id uuid;
    v_user_id uuid;
    v_batch_id uuid;
    v_copy_id uuid;
    v_backfill_batch_id uuid;
    v_revision record;
    v_copy record;
    v_copy_index integer;
    v_doc_code text;
    v_rev_code text;
BEGIN
    SELECT id INTO v_admin_id
    FROM app_users
    WHERE username = 'admin'
    ORDER BY created_at
    LIMIT 1;

    SELECT id INTO v_user_id
    FROM app_users
    ORDER BY CASE WHEN username = 'admin' THEN 0 ELSE 1 END, created_at
    LIMIT 1;

    IF v_admin_id IS NULL OR v_user_id IS NULL THEN
        RETURN;
    END IF;

    FOR v_revision IN
        SELECT
            r.id AS revision_id,
            r.document_id,
            r.document_number,
            d.document_name,
            r.revision_number,
            COALESCE(r.valid_until, d.valid_until, CURRENT_DATE + INTERVAL '1 year')::date AS valid_until
        FROM document_revisions r
        JOIN documents d ON d.id = r.document_id
        WHERE r.status_code = 'EFFECTIVE'
        ORDER BY r.created_at DESC, r.id
        LIMIT 2
    LOOP
        v_doc_code := regexp_replace(COALESCE(v_revision.document_number, 'DOC'), '[^A-Za-z0-9]+', '.', 'g');
        v_rev_code := regexp_replace(COALESCE(v_revision.revision_number, '1.0.0'), '[^A-Za-z0-9]+', '.', 'g');
        v_batch_id := gen_random_uuid();

        INSERT INTO controlled_copy_distribution_batches (
            id,
            batch_number,
            document_id,
            revision_id,
            document_number,
            document_title,
            revision_number,
            quantity,
            status,
            status_code,
            distribution_list,
            distribution_scope,
            location,
            location_code,
            request_reason,
            requested_by_user_id,
            requested_at,
            created_at,
            updated_at
        ) VALUES (
            v_batch_id,
            'DB.' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10)),
            v_revision.document_id,
            v_revision.revision_id,
            v_revision.document_number,
            v_revision.document_name,
            v_revision.revision_number,
            3,
            'Ready for Distribution',
            'READY_FOR_DISTRIBUTION',
            v_revision.document_name,
            'Individual',
            'QA Distribution',
            'QA-DIST',
            'Seeded distribution batch test data',
            v_admin_id,
            NOW(),
            NOW(),
            NOW()
        );

        FOR v_copy_index IN 1..3 LOOP
            v_copy_id := gen_random_uuid();
            INSERT INTO controlled_copies (
                id,
                document_id,
                revision_id,
                distribution_batch_id,
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
                status_code,
                current_stage,
                requested_by_user_id,
                requested_at,
                valid_until,
                effective_date,
                access_token,
                access_token_issued_at,
                created_at,
                updated_at
            ) VALUES (
                v_copy_id,
                v_revision.document_id,
                v_revision.revision_id,
                v_batch_id,
                'CC.' || v_doc_code || '.R' || v_rev_code || '.B' || LPAD(v_copy_index::text, 2, '0'),
                v_copy_index,
                3,
                v_revision.document_number,
                v_revision.document_name,
                v_revision.revision_number,
                NULL,
                NULL,
                v_revision.document_name,
                'Individual',
                'QA Distribution',
                'QA-DIST',
                'Seeded distribution batch test data',
                'Ready for Distribution',
                'READY_FOR_DISTRIBUTION',
                'Ready for Distribution',
                v_admin_id,
                NOW(),
                v_revision.valid_until,
                CURRENT_DATE,
                'batch-preview-' || replace(gen_random_uuid()::text, '-', ''),
                NOW(),
                NOW(),
                NOW()
            );
        END LOOP;
    END LOOP;

    FOR v_copy IN
        SELECT
            c.id,
            c.document_id,
            c.revision_id,
            c.document_number,
            c.document_title,
            c.revision_number,
            c.distribution_list,
            c.distribution_scope,
            c.location,
            c.location_code,
            c.request_reason,
            c.requested_by_user_id,
            c.requested_at
        FROM controlled_copies c
        WHERE c.status_code = 'READY_FOR_DISTRIBUTION'
          AND c.distribution_batch_id IS NULL
        ORDER BY c.requested_at NULLS LAST, c.created_at NULLS LAST
    LOOP
        v_backfill_batch_id := gen_random_uuid();

        INSERT INTO controlled_copy_distribution_batches (
            id,
            batch_number,
            document_id,
            revision_id,
            document_number,
            document_title,
            revision_number,
            quantity,
            status,
            status_code,
            distribution_list,
            distribution_scope,
            location,
            location_code,
            request_reason,
            requested_by_user_id,
            requested_at,
            created_at,
            updated_at
        ) VALUES (
            v_backfill_batch_id,
            'DB.' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10)),
            v_copy.document_id,
            v_copy.revision_id,
            v_copy.document_number,
            v_copy.document_title,
            v_copy.revision_number,
            1,
            'Ready for Distribution',
            'READY_FOR_DISTRIBUTION',
            v_copy.distribution_list,
            v_copy.distribution_scope,
            v_copy.location,
            v_copy.location_code,
            v_copy.request_reason,
            v_copy.requested_by_user_id,
            COALESCE(v_copy.requested_at, NOW()),
            NOW(),
            NOW()
        );

        UPDATE controlled_copies
        SET distribution_batch_id = v_backfill_batch_id,
            updated_at = NOW()
        WHERE id = v_copy.id;
    END LOOP;
END $$;
