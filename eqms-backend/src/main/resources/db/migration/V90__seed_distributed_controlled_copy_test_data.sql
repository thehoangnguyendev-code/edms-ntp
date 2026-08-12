DO $$
DECLARE
    v_admin_id uuid;
    v_recipient_id uuid;
    v_recipient_name text;
    v_batch_id uuid;
    v_copy_id uuid;
    v_revision record;
    v_doc_code text;
    v_existing_max integer;
    v_copy_index integer;
    v_base_time timestamptz := NOW() - INTERVAL '3 days';
BEGIN
    SELECT id INTO v_admin_id
    FROM app_users
    WHERE username = 'admin'
    ORDER BY created_at
    LIMIT 1;

    SELECT id, full_name INTO v_recipient_id, v_recipient_name
    FROM app_users
    WHERE username <> 'admin'
    ORDER BY created_at
    LIMIT 1;

    IF v_admin_id IS NULL OR v_recipient_id IS NULL THEN
        RETURN;
    END IF;

    FOR v_revision IN
        SELECT
            r.id AS revision_id,
            r.document_id,
            r.document_number,
            d.document_name,
            r.revision_number,
            COALESCE(r.valid_until, d.valid_until, CURRENT_DATE + INTERVAL '1 year')::date AS valid_until,
            ROW_NUMBER() OVER (ORDER BY r.created_at DESC, r.id) AS rn
        FROM document_revisions r
        JOIN documents d ON d.id = r.document_id
        WHERE r.status_code = 'EFFECTIVE'
        ORDER BY r.created_at DESC, r.id
        LIMIT 2
    LOOP
        v_doc_code := regexp_replace(COALESCE(v_revision.document_number, 'DOC'), '[^A-Za-z0-9]+', '.', 'g');

        SELECT COALESCE(MAX((substring(controlled_copy_number from '([0-9]{3})$'))::int), 0)
        INTO v_existing_max
        FROM controlled_copies
        WHERE controlled_copy_number LIKE 'CC.' || v_doc_code || '.%';

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
            distributed_by_user_id,
            distributed_at,
            distribution_comment,
            created_at,
            updated_at
        ) VALUES (
            v_batch_id,
            'DB.DIST.' || v_revision.rn || '.' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
            v_revision.document_id,
            v_revision.revision_id,
            v_revision.document_number,
            v_revision.document_name,
            v_revision.revision_number,
            3,
            'Distributed',
            'DISTRIBUTED',
            v_recipient_name,
            'Individual',
            'QA Distribution',
            'QA-DIST',
            'Seeded distributed controlled copies',
            v_admin_id,
            v_base_time,
            v_admin_id,
            v_base_time + INTERVAL '2 hours',
            'Seeded distributed controlled copies',
            v_base_time,
            v_base_time
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
                approved_by_user_id,
                approved_at,
                printed_by_user_id,
                printed_at,
                distributed_by_user_id,
                distributed_at,
                recipient_user_id,
                recipient_name,
                recipient_signature,
                recipient_date,
                distribution_comment,
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
                'CC.' || v_doc_code || '.' || LPAD((v_existing_max + v_copy_index)::text, 3, '0'),
                v_existing_max + v_copy_index,
                3,
                v_revision.document_number,
                v_revision.document_name,
                v_revision.revision_number,
                NULL,
                NULL,
                v_recipient_name,
                'Individual',
                'QA Distribution',
                'QA-DIST',
                'Seeded distributed controlled copies',
                'Distributed',
                'DISTRIBUTED',
                'Distributed',
                v_admin_id,
                v_base_time,
                v_admin_id,
                v_base_time + INTERVAL '30 minutes',
                v_admin_id,
                v_base_time + INTERVAL '45 minutes',
                v_admin_id,
                v_base_time + INTERVAL '2 hours',
                v_recipient_id,
                v_recipient_name,
                v_recipient_name,
                CURRENT_DATE - v_copy_index,
                'Seeded distributed controlled copies',
                v_revision.valid_until,
                CURRENT_DATE - 3,
                'seed-dist-' || replace(gen_random_uuid()::text, '-', ''),
                v_base_time,
                v_base_time,
                v_base_time
            );
        END LOOP;
    END LOOP;
END $$;
