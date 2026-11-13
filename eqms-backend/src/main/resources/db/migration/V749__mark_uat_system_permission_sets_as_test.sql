-- V748 skipped the UAT permission sets that were created with the system flag; their code (PS_UAT_*) names them as test data.
UPDATE permission_sets SET test_data = TRUE WHERE code LIKE 'PS\_UAT\_%' ESCAPE '\';
