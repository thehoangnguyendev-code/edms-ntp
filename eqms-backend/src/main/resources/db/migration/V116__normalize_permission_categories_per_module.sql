-- Normalize category to module display name so each module forms a single card
-- in the permission catalog (grouping is now done by module_key, not group_key).
UPDATE permissions SET category = 'Document Control'    WHERE module_key = 'documents';
UPDATE permissions SET category = 'Training Management' WHERE module_key = 'training';
