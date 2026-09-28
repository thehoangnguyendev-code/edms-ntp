-- eSignature.*, versionControl.*, and defaultRetentionPeriodDays under documents_config were seeded
-- in V16 but were never rendered by DocumentPropertiesView.tsx and never read by any backend
-- consumer (confirmed by source grep: no getter, no reference outside this JSON blob). Remove
-- them so the stored config only reflects fields the UI/backend actually use.
UPDATE system_configurations
SET documents_config = documents_config - 'eSignature' - 'versionControl' - 'defaultRetentionPeriodDays';
