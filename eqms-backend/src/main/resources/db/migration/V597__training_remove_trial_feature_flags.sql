-- Training Management: the trial screens (courses, materials, compliance tracking, records & archive) are replaced by the real module, so their five
-- sub-switches are removed from the feature configuration. The module switch feat-tms stays. Forward-only and idempotent.
UPDATE system_configurations
   SET features_config = COALESCE((SELECT jsonb_agg(f) FROM jsonb_array_elements(features_config) f WHERE (f->>'id') NOT LIKE 'feat-tms-%'), '[]'::jsonb)
 WHERE features_config IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(features_config) f WHERE (f->>'id') LIKE 'feat-tms-%');
