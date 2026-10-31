-- The system footer was one text (general_config.systemFooter). It is now a left and a right text with a switch for desktop/tablet and one for mobile,
-- all inside the existing general_config JSON. The text that was set becomes the left footer; the right footer starts empty. The two switches are not written:
-- absent means desktop/tablet on and mobile off, which is how the footer behaved before. Running it again changes nothing.
UPDATE system_configurations
SET general_config = (general_config - 'systemFooter')
        || CASE
               WHEN general_config ? 'systemFooterLeft' OR NOT (general_config ? 'systemFooter') THEN '{}'::jsonb
               ELSE jsonb_build_object('systemFooterLeft', general_config -> 'systemFooter')
           END
WHERE general_config ? 'systemFooter';
