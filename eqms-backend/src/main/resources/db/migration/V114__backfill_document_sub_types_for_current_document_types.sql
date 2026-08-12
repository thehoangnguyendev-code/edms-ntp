INSERT INTO document_sub_types (id, document_type_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), dt.id, 'Guideline', 'Guideline sub-type', TRUE, NOW(), NOW()
FROM document_types dt
WHERE UPPER(dt.name) IN ('POLICY', 'GUIDELINE')
ON CONFLICT (document_type_id, name) DO NOTHING;

INSERT INTO document_sub_types (id, document_type_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), dt.id, 'Manual', 'Quality manual sub-type', TRUE, NOW(), NOW()
FROM document_types dt
WHERE UPPER(dt.name) = 'QUALITY MANUAL'
ON CONFLICT (document_type_id, name) DO NOTHING;

INSERT INTO document_sub_types (id, document_type_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), dt.id, 'Procedure', 'Standard operating procedure sub-type', TRUE, NOW(), NOW()
FROM document_types dt
WHERE UPPER(dt.short_code) = 'SOP'
ON CONFLICT (document_type_id, name) DO NOTHING;

INSERT INTO document_sub_types (id, document_type_id, name, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), dt.id, 'Work Instruction', 'Work instruction sub-type', TRUE, NOW(), NOW()
FROM document_types dt
WHERE UPPER(dt.name) IN ('WORKING INSTRUCTION', 'DRAFTING INSTRUCTION', 'INSTRUCTION', 'INSTRUCTION (WORKING INSTRUCTION, DRAFTING INSTRUCTION)')
ON CONFLICT (document_type_id, name) DO NOTHING;
