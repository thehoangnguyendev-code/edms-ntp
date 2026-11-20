-- V830: six permissions that no screen, no service and no policy reads are removed from the catalog (Security & Authorization clean-up, 2026-11-20).
-- Found by comparing the permission catalog with the source: no backend or frontend reference, no workflow action policy or lifecycle state policy
-- requires them. Granting them changed nothing, but they showed in the Access Profile and Permission Set screens as if they did.
--   settings.dictionary.view / settings.dictionary.manage   (the Dictionaries pages use the per-dictionary permissions)
--   documents.form.configure / .design_efield / .fill_eform  (the e-form designer was never built)
--   training.audit.view                                       (Training audit is read through the Audit Trail permissions)
-- Their rows in permission_set_items go with them. Nobody loses a working function.
DELETE FROM permission_set_items
WHERE permission_id IN (SELECT id FROM permissions WHERE code IN (
    'settings.dictionary.view', 'settings.dictionary.manage',
    'documents.form.configure', 'documents.form.design_efield', 'documents.form.fill_eform',
    'training.audit.view'));

DELETE FROM permissions WHERE code IN (
    'settings.dictionary.view', 'settings.dictionary.manage',
    'documents.form.configure', 'documents.form.design_efield', 'documents.form.fill_eform',
    'training.audit.view');
