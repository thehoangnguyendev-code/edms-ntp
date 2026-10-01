-- Fail closed for existing installations; preserve all other preview policy keys.
UPDATE system_configurations
SET documents_config = jsonb_set(
    documents_config,
    '{pdfPreview}',
    COALESCE(documents_config -> 'pdfPreview', '{}'::jsonb)
        || jsonb_build_object('allowAnnotations', false),
    true
)
WHERE jsonb_typeof(documents_config) = 'object'
  AND (documents_config -> 'pdfPreview' IS NULL
       OR jsonb_typeof(documents_config -> 'pdfPreview') = 'object')
  AND NOT COALESCE(documents_config -> 'pdfPreview', '{}'::jsonb) ? 'allowAnnotations';
