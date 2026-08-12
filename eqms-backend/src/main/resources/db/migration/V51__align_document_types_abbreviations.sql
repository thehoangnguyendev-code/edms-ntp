-- 1. Rename existing short codes to match new standard abbreviations and avoid unique constraints conflicts
UPDATE document_types SET short_code = 'FRM', name = 'Forms' WHERE short_code = 'FORM';
UPDATE document_types SET short_code = 'QMA', name = 'Quality Manual' WHERE short_code = 'QM';
UPDATE document_types SET short_code = 'SPC', name = 'Specification', is_active = TRUE WHERE short_code = 'SPEC';

-- 2. Insert new standard document types
INSERT INTO document_types (id, short_code, name, current_sequence, description, is_active, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111106', 'GUI', 'Guideline', 0, 'Guideline documents', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111107', 'INS', 'Instruction (Working Instruction, Drafting Instruction)', 0, 'Instructions and work instructions', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111108', 'SMF', 'Site Master File', 0, 'Site master files', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111109', 'APD', 'Addendum / Annex / Appendix', 0, 'Addenda, annexes, and appendices', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111110', 'URS', 'User Requirement Specification', 0, 'User requirement specifications', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111111', 'DQPR', 'Design Qualification Protocol and report', 0, 'Design qualification protocols and reports', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111112', 'FATPR/SATPR', 'Factory Acceptance Testing /Site Acceptance testing protocol and report', 0, 'FAT/SAT protocols and reports', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111113', 'IQPR', 'Installation Qualification Protocol and Report', 0, 'Installation qualification protocols and reports', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111114', 'OQPR', 'Operational Qualification Protocol and Report', 0, 'Operational qualification protocols and reports', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111115', 'PQPR', 'Performance Qualification Protocol and Report', 0, 'Performance qualification protocols and reports', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111116', 'PVPR', 'Process Validation Protocol and Report', 0, 'Process validation protocols and reports', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111117', 'CVPR', 'Cleaning Validation Protocol and Report', 0, 'Cleaning validation protocols and reports', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111118', 'REC', 'Record', 0, 'Record templates and sheets', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111119', 'CCS', 'Contamination Control Strategy', 0, 'Contamination control strategies', TRUE, NOW(), NOW()),
('11111111-1111-1111-1111-111111111120', 'QRM', 'Cross Contamination Risk Management Program', 0, 'QRM risk management program documents', TRUE, NOW(), NOW())
ON CONFLICT (short_code) DO NOTHING;
