-- EmbedPDF's Insert tab is opt-in. Existing administrator policy remains unchanged.
UPDATE system_configurations
SET documents_config = jsonb_set(
    documents_config,
    '{pdfPreview}',
    (documents_config -> 'pdfPreview') || jsonb_build_object('showInsertTools', false),
    true
)
WHERE jsonb_typeof(documents_config -> 'pdfPreview') = 'object'
  AND NOT (documents_config -> 'pdfPreview') ? 'showInsertTools';
