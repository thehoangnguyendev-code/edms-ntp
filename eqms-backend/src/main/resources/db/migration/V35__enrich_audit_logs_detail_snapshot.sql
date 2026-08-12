ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS user_full_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS employee_code VARCHAR(80),
    ADD COLUMN IF NOT EXISTS role_name VARCHAR(80),
    ADD COLUMN IF NOT EXISTS position_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS department_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS entity_code VARCHAR(255),
    ADD COLUMN IF NOT EXISTS document_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS revision_number VARCHAR(40),
    ADD COLUMN IF NOT EXISTS entity_status VARCHAR(80);

UPDATE audit_logs a
SET user_full_name = COALESCE(a.user_full_name, u.full_name),
    employee_code = COALESCE(a.employee_code, u.employee_code),
    role_name = COALESCE(a.role_name, u.role_name),
    position_name = COALESCE(a.position_name, u.position),
    department_name = COALESCE(a.department_name, u.department)
FROM app_users u
WHERE u.id = COALESCE(a.user_id, a.acted_by_user_id)
  AND (
      a.user_full_name IS NULL
      OR a.employee_code IS NULL
      OR a.role_name IS NULL
      OR a.position_name IS NULL
      OR a.department_name IS NULL
  );

UPDATE audit_logs a
SET entity_name = COALESCE(a.entity_name, d.document_name),
    entity_code = COALESCE(a.entity_code, d.document_number),
    document_number = COALESCE(a.document_number, d.document_number),
    entity_status = COALESCE(a.entity_status, d.status_code)
FROM documents d
WHERE UPPER(a.entity_type) = 'DOCUMENT'
  AND a.entity_id = d.id
  AND (
      a.entity_name IS NULL
      OR a.entity_code IS NULL
      OR a.document_number IS NULL
      OR a.entity_status IS NULL
  );

UPDATE audit_logs a
SET entity_name = COALESCE(a.entity_name, r.revision_name),
    entity_code = COALESCE(a.entity_code, CONCAT(r.document_number, ' Rev.', r.revision_number)),
    document_number = COALESCE(a.document_number, r.document_number),
    revision_number = COALESCE(a.revision_number, r.revision_number),
    entity_status = COALESCE(a.entity_status, r.status_code)
FROM document_revisions r
WHERE UPPER(a.entity_type) = 'REVISION'
  AND a.entity_id = r.id
  AND (
      a.entity_name IS NULL
      OR a.entity_code IS NULL
      OR a.document_number IS NULL
      OR a.revision_number IS NULL
      OR a.entity_status IS NULL
  );

UPDATE audit_logs a
SET entity_name = COALESCE(a.entity_name, u.full_name),
    entity_code = COALESCE(a.entity_code, COALESCE(u.employee_code, u.username)),
    entity_status = COALESCE(a.entity_status, CAST(u.status AS VARCHAR(80)))
FROM app_users u
WHERE UPPER(a.entity_type) IN ('USER', 'USER_ACCOUNT')
  AND a.entity_id = u.id
  AND (
      a.entity_name IS NULL
      OR a.entity_code IS NULL
      OR a.entity_status IS NULL
  );
