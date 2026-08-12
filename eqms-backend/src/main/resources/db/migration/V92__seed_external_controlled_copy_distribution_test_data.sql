DO $$
DECLARE
    v_admin_id uuid;
    v_revision record;
    v_batch_id uuid;
    v_copy_id uuid;
    v_doc_code text;
    v_existing_max integer;
BEGIN
    SELECT id INTO v_admin_id
    FROM app_users
    WHERE username = 'admin'
    ORDER BY created_at
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        r.id AS revision_id,
        r.document_id,
        r.document_number,
        d.document_name,
        r.revision_number,
        COALESCE(r.valid_until, d.valid_until, CURRENT_DATE + INTERVAL '1 year')::date AS valid_until
    INTO v_revision
    FROM document_revisions r
    JOIN documents d ON d.id = r.document_id
    WHERE r.status_code = 'EFFECTIVE'
    ORDER BY r.created_at DESC, r.id
    LIMIT 1;

    IF v_revision.revision_id IS NULL THEN
        RETURN;
    END IF;

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
        distribution_mode,
        distribution_scope,
        location,
        location_code,
        external_recipients,
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
        'DB.EXT.' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
        v_revision.document_id,
        v_revision.revision_id,
        v_revision.document_number,
        v_revision.document_name,
        v_revision.revision_number,
        2,
        'Distributed',
        'DISTRIBUTED',
        'external.one@example.com, external.two@example.com',
        'EXTERNAL',
        'external',
        'External Recipients',
        'EXT',
        'external.one@example.com, external.two@example.com',
        'Seeded external controlled copy distribution test data',
        v_admin_id,
        NOW() - INTERVAL '1 day',
        v_admin_id,
        NOW() - INTERVAL '1 day',
        'Seeded external controlled copy distribution test data',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day'
    );

    FOR i IN 1..2 LOOP
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
            distribution_mode,
            distribution_scope,
            location,
            location_code,
            request_reason,
            external_recipients,
            status,
            status_code,
            current_stage,
            requested_by_user_id,
            requested_at,
            distributed_by_user_id,
            distributed_at,
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
            'CC.' || v_doc_code || '.' || LPAD((v_existing_max + i)::text, 3, '0'),
            v_existing_max + i,
            2,
            v_revision.document_number,
            v_revision.document_name,
            v_revision.revision_number,
            NULL,
            NULL,
            'external.one@example.com, external.two@example.com',
            'EXTERNAL',
            'external',
            'External Recipients',
            'EXT',
            'Seeded external controlled copy distribution test data',
            'external.one@example.com, external.two@example.com',
            'Distributed',
            'DISTRIBUTED',
            'Distributed',
            v_admin_id,
            NOW() - INTERVAL '1 day',
            v_admin_id,
            NOW() - INTERVAL '1 day',
            CASE WHEN i = 1 THEN 'external.one@example.com' ELSE 'external.two@example.com' END,
            CASE WHEN i = 1 THEN 'external.one@example.com' ELSE 'external.two@example.com' END,
            CURRENT_DATE - i,
            'Seeded external controlled copy distribution test data',
            v_revision.valid_until,
            CURRENT_DATE - 2,
            'seed-ext-' || replace(gen_random_uuid()::text, '-', ''),
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '1 day',
            NOW() - INTERVAL '1 day'
        );
    END LOOP;
END $$;
