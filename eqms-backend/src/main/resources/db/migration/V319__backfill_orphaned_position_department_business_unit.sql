-- Several app_users rows reference position/department/business_unit values that were never
-- seeded (or were removed) from the corresponding dictionary tables, causing any profile save
-- for these users to fail hierarchy validation ("Invalid position"/"Invalid department") even
-- for unrelated field edits. Backfill the missing dictionary rows so the existing user data
-- becomes valid again, instead of altering the users' actual job data.

-- Business Unit: "Corporate" (used by sys.admin2, trainee.one)
INSERT INTO business_units (id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'CORP', 'Corporate', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM business_units WHERE name = 'Corporate');

-- Department: "IT Department" under Corporate (used by sys.admin2, trainee.one)
INSERT INTO departments (id, business_unit_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), bu.id, 'ITDEPT', 'IT Department', true, now(), now()
FROM business_units bu
WHERE bu.name = 'Corporate'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE name = 'IT Department');

-- Department: "Document Control" under Quality Unit (used by workflow.dco1)
INSERT INTO departments (id, business_unit_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), bu.id, 'DCTRL', 'Document Control', true, now(), now()
FROM business_units bu
WHERE bu.name = 'Quality Unit'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Document Control');

-- Position: "System Administrator" already exists (code SYSADMIN) but has no Business Unit /
-- Department assigned, which fails the same hierarchy validation. Link it to Corporate / IT
-- Department rather than inserting a duplicate.
UPDATE positions p
SET business_unit_id = bu.id,
    department_id = d.id,
    updated_at = now()
FROM business_units bu, departments d
WHERE p.code = 'SYSADMIN'
  AND bu.name = 'Corporate'
  AND d.name = 'IT Department'
  AND (p.business_unit_id IS NULL OR p.department_id IS NULL);

-- Position: "Document Control Officer" under Quality Unit / Document Control (used by workflow.dco1)
INSERT INTO positions (id, business_unit_id, department_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), bu.id, d.id, 'DCOFFICER', 'Document Control Officer', true, now(), now()
FROM business_units bu
JOIN departments d ON d.name = 'Document Control' AND d.business_unit_id = bu.id
WHERE bu.name = 'Quality Unit'
  AND NOT EXISTS (SELECT 1 FROM positions WHERE name = 'Document Control Officer');

-- Position: "QA Specialist" under Quality Unit / Quality Assurance (used by user.a.test..user.f.test)
INSERT INTO positions (id, business_unit_id, department_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), bu.id, d.id, 'QASPEC', 'QA Specialist', true, now(), now()
FROM business_units bu
JOIN departments d ON d.name = 'Quality Assurance' AND d.business_unit_id = bu.id
WHERE bu.name = 'Quality Unit'
  AND NOT EXISTS (SELECT 1 FROM positions WHERE name = 'QA Specialist');

-- Position: "DCO Staff" under Quality Unit / Quality Assurance (used by linhttd)
INSERT INTO positions (id, business_unit_id, department_id, code, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), bu.id, d.id, 'DCOSTAFF', 'DCO Staff', true, now(), now()
FROM business_units bu
JOIN departments d ON d.name = 'Quality Assurance' AND d.business_unit_id = bu.id
WHERE bu.name = 'Quality Unit'
  AND NOT EXISTS (SELECT 1 FROM positions WHERE name = 'DCO Staff');
