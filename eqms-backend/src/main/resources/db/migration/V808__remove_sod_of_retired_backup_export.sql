-- V808: Backup export was retired by V753 (its two permissions were deleted), but V802 still seeded the Segregation of Duties rule "Request vs Approve Backup Export" for them.
-- A rule over permissions that do not exist can never be broken and made PermissionReferentialIntegrityTest fail. It goes with the permissions it named.
DELETE FROM sod_constraints WHERE permission_code_a = 'backup.backup.export' AND permission_code_b = 'backup.backup.export.approve';
