-- Preserve the current visible EmbedPDF menu actions for existing installations while making
-- each action an explicit, auditable global PDF-preview policy.
UPDATE system_configurations
SET documents_config = jsonb_set(
    documents_config,
    '{pdfPreview}',
    jsonb_build_object(
        'showOpenDocumentAction', true,
        'showCloseDocumentAction', true,
        'showSecurityAction', true,
        'showScreenshotAction', true
    ) || (documents_config -> 'pdfPreview'),
    true
)
WHERE jsonb_typeof(documents_config -> 'pdfPreview') = 'object'
  AND NOT (documents_config -> 'pdfPreview') ?& ARRAY[
      'showOpenDocumentAction',
      'showCloseDocumentAction',
      'showSecurityAction',
      'showScreenshotAction'
  ];
