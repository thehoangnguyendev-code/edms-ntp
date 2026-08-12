-- Canonical organisational catalogue used by Document Control.
-- Legacy rows are retained but made inactive so historic documents, audit entries and
-- controlled-copy records continue to resolve their original organisational reference.

-- A number of existing deployments already contain the target display names under
-- legacy codes (for example QAU / OPU). Rename those rows first rather than deleting
-- or merging them: historic foreign-key references remain intact and the canonical
-- QUAL / OPER rows can then be standardised without violating the unique name index.
UPDATE business_units
SET name = name || ' (Legacy ' || code || ')',
    updated_at = now()
WHERE name = 'Quality Unit'
  AND code <> 'QUAL';

UPDATE business_units
SET name = name || ' (Legacy ' || code || ')',
    updated_at = now()
WHERE name = 'Operation Unit'
  AND code <> 'OPER';

UPDATE business_units
SET name = 'Quality Unit',
    description = 'Quality Unit',
    is_active = TRUE,
    updated_at = now()
WHERE code = 'QAU';

UPDATE business_units
SET name = 'Operation Unit',
    description = 'Operation Unit',
    is_active = TRUE,
    updated_at = now()
WHERE code = 'OPU';

-- Reuse the existing seeded records when there is no canonical-code collision.
UPDATE departments
SET code = 'ME',
    name = 'Mechanical and Electrical',
    updated_at = now()
WHERE code = 'PROD'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'ME');

-- Canonical Quality Unit departments.
INSERT INTO departments (id, business_unit_id, code, name, manager, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), bu.id, v.code, v.name, v.manager, v.description, TRUE, now(), now()
FROM business_units bu
CROSS JOIN (VALUES
    ('QA', 'Quality Assurance', 'Quality Assurance Manager', 'Quality assurance'),
    ('QC', 'Quality Control', 'Quality Control Manager', 'Quality control'),
    ('RA', 'Regulatory Affairs', 'Regulatory Affairs Manager', 'Regulatory affairs')
) AS v(code, name, manager, description)
WHERE bu.code = 'QAU'
ON CONFLICT (code) DO UPDATE
SET business_unit_id = EXCLUDED.business_unit_id,
    name = EXCLUDED.name,
    manager = EXCLUDED.manager,
    description = EXCLUDED.description,
    is_active = TRUE,
    updated_at = now();

-- Canonical Operation Unit departments.
INSERT INTO departments (id, business_unit_id, code, name, manager, description, is_active, created_at, updated_at)
SELECT gen_random_uuid(), bu.id, v.code, v.name, v.manager, v.description, TRUE, now(), now()
FROM business_units bu
CROSS JOIN (VALUES
    ('HRAD', 'Human Resources & Administrator', 'HR & Administration Manager', 'Human resources and administration'),
    ('IWS', 'Injection WS', 'Injection WS Manager', 'Injection workshop'),
    ('LOG', 'Logistics', 'Logistics Manager', 'Logistics'),
    ('ME', 'Mechanical and Electrical', 'Mechanical & Electrical Manager', 'Mechanical and electrical'),
    ('TS', 'Technology Service', 'Technology Service Manager', 'Technology service')
) AS v(code, name, manager, description)
WHERE bu.code = 'OPU'
ON CONFLICT (code) DO UPDATE
SET business_unit_id = EXCLUDED.business_unit_id,
    name = EXCLUDED.name,
    manager = EXCLUDED.manager,
    description = EXCLUDED.description,
    is_active = TRUE,
    updated_at = now();

-- Only the two canonical business units and their eight departments are selectable.
UPDATE business_units
SET is_active = FALSE,
    updated_at = now()
WHERE code NOT IN ('QAU', 'OPU');

UPDATE departments
SET is_active = FALSE,
    updated_at = now()
WHERE code NOT IN ('QA', 'QC', 'RA', 'HRAD', 'IWS', 'LOG', 'ME', 'TS');

-- Align existing account profile values with the selectable catalogue. This does not
-- change historical document ownership, which is stored by foreign key above.
UPDATE app_users
SET business_unit = CASE business_unit
        WHEN 'Quality' THEN 'Quality Unit'
        WHEN 'Operations' THEN 'Operation Unit'
        ELSE business_unit
    END,
    department = CASE department
        WHEN 'Quality' THEN 'Quality Assurance'
        WHEN 'Quality Management' THEN 'Quality Control'
        WHEN 'Production' THEN 'Mechanical and Electrical'
        ELSE department
    END,
    updated_at = now()
WHERE business_unit IN ('Quality', 'Operations')
   OR department IN ('Quality', 'Quality Management', 'Production');
