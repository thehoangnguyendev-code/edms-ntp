DO $$
DECLARE
    v_admin_user_id uuid;
    v_sop_type_id uuid;
    v_pol_type_id uuid;
    v_quality_bu_id uuid;
    v_operations_bu_id uuid;
    v_qa_dept_id uuid;
    v_prod_dept_id uuid;
    v_active_doc_status_code varchar(50);
    v_draft_rev_status_code varchar(50);
BEGIN
    SELECT id INTO v_admin_user_id
    FROM app_users
    WHERE username = 'admin'
       OR role_name = 'SuperAdmin'
    ORDER BY CASE WHEN username = 'admin' THEN 0 ELSE 1 END, created_at
    LIMIT 1;

    SELECT id INTO v_sop_type_id
    FROM document_types
    WHERE short_code = 'SOP'
    LIMIT 1;

    SELECT id INTO v_pol_type_id
    FROM document_types
    WHERE short_code = 'POL'
    LIMIT 1;

    SELECT id INTO v_quality_bu_id
    FROM business_units
    WHERE code IN ('QUAL', 'QUALITY')
    ORDER BY CASE WHEN code = 'QUAL' THEN 0 ELSE 1 END
    LIMIT 1;

    SELECT id INTO v_operations_bu_id
    FROM business_units
    WHERE code IN ('OPER', 'OPS')
    ORDER BY CASE WHEN code = 'OPER' THEN 0 ELSE 1 END
    LIMIT 1;

    SELECT id INTO v_qa_dept_id
    FROM departments
    WHERE code IN ('QA', 'QUALITY_ASSURANCE')
    ORDER BY CASE WHEN code = 'QA' THEN 0 ELSE 1 END
    LIMIT 1;

    SELECT id INTO v_prod_dept_id
    FROM departments
    WHERE code IN ('PROD', 'PRODUCTION')
    ORDER BY CASE WHEN code = 'PROD' THEN 0 ELSE 1 END
    LIMIT 1;

    SELECT code INTO v_active_doc_status_code
    FROM document_statuses
    WHERE code = 'ACTIVE'
    LIMIT 1;

    SELECT code INTO v_draft_rev_status_code
    FROM revision_statuses
    WHERE code = 'DRAFT'
    LIMIT 1;

    IF v_admin_user_id IS NULL THEN
        -- Skip seed migration if admin user doesn't exist (e.g. on a fresh database)
        RETURN;
    END IF;
    IF v_sop_type_id IS NULL OR v_pol_type_id IS NULL THEN
        RETURN;
    END IF;
    IF v_quality_bu_id IS NULL OR v_operations_bu_id IS NULL THEN
        RETURN;
    END IF;
    IF v_qa_dept_id IS NULL OR v_prod_dept_id IS NULL THEN
        RETURN;
    END IF;
    IF v_active_doc_status_code IS NULL OR v_draft_rev_status_code IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO documents (
        id,
        document_number,
        document_name,
        title_local_language,
        version,
        status_code,
        document_type_id,
        business_unit_id,
        department_id,
        author_user_id,
        owner_user_id,
        opened_by_user_id,
        last_modified_by_user_id,
        description,
        knowledge_base,
        is_template,
        has_related_documents,
        has_correlated_documents,
        effective_date,
        valid_until,
        created_at,
        updated_at
    )
    VALUES
        (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
            'SOP.9901',
            'Validation Test',
            NULL,
            '1.0.0',
            v_active_doc_status_code,
            v_sop_type_id,
            v_quality_bu_id,
            v_qa_dept_id,
            v_admin_user_id,
            v_admin_user_id,
            v_admin_user_id,
            v_admin_user_id,
            'Validation Test description',
            'Validation Test KB',
            FALSE,
            TRUE,
            TRUE,
            DATE '2026-06-01',
            DATE '2027-06-01',
            NOW(),
            NOW()
        ),
        (
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
            'SOP.9900',
            'Validation Test Reference',
            NULL,
            '1.0.0',
            v_active_doc_status_code,
            v_sop_type_id,
            v_quality_bu_id,
            v_qa_dept_id,
            v_admin_user_id,
            v_admin_user_id,
            v_admin_user_id,
            v_admin_user_id,
            'Validation Test Reference description',
            'Validation Test Reference KB',
            FALSE,
            FALSE,
            FALSE,
            DATE '2026-05-01',
            DATE '2027-05-01',
            NOW(),
            NOW()
        ),
        (
            'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
            'POL.9901',
            'Validation Test Correlated',
            NULL,
            '1.0.0',
            v_active_doc_status_code,
            v_pol_type_id,
            v_operations_bu_id,
            v_prod_dept_id,
            v_admin_user_id,
            v_admin_user_id,
            v_admin_user_id,
            v_admin_user_id,
            'Validation Test Correlated description',
            'Validation Test Correlated KB',
            FALSE,
            FALSE,
            FALSE,
            DATE '2026-04-01',
            DATE '2027-04-01',
            NOW(),
            NOW()
        )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO document_revisions (
        id,
        document_id,
        parent_revision_id,
        document_number,
        document_name,
        title_local_language,
        revision_name,
        revision_number,
        status_code,
        document_type_id,
        business_unit_id,
        department_id,
        author_user_id,
        owner_user_id,
        opened_by_user_id,
        last_modified_by_user_id,
        description,
        knowledge_base,
        is_template,
        has_related_documents,
        has_correlated_documents,
        effective_date,
        valid_until,
        created_at,
        updated_at
    )
    VALUES (
        'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        NULL,
        'SOP.9901',
        'SOP.9901 - Validation Test',
        NULL,
        'Validation Test_0.0.1',
        '0.0.1',
        v_draft_rev_status_code,
        v_sop_type_id,
        v_quality_bu_id,
        v_qa_dept_id,
        v_admin_user_id,
        v_admin_user_id,
        v_admin_user_id,
        v_admin_user_id,
        'Validation Test revision description',
        'Validation Test KB',
        FALSE,
        TRUE,
        TRUE,
        DATE '2026-06-01',
        DATE '2027-06-01',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO document_relations (
        id,
        source_document_id,
        target_document_id,
        relation_type,
        created_at,
        updated_at
    )
    VALUES
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'RELATED', NOW(), NOW()),
        ('ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'CORRELATED', NOW(), NOW())
    ON CONFLICT (source_document_id, target_document_id, relation_type) DO NOTHING;
END $$;
