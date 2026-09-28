-- A stamp with four lines covered the header (page / code) of real templates. The defaults are now a compact stamp (title and copy
-- number) that fits the top margin; the recipient and expiry are already on the watermark. Applies to the policy row as it stands
-- (the stamp settings were introduced only in V480 and had not been customised).
ALTER TABLE controlled_copy_policy_settings
    ALTER COLUMN stamp_size SET DEFAULT 'SMALL',
    ALTER COLUMN stamp_show_recipient SET DEFAULT FALSE,
    ALTER COLUMN stamp_show_expiry_date SET DEFAULT FALSE;

UPDATE controlled_copy_policy_settings
SET stamp_size = 'SMALL', stamp_show_recipient = FALSE, stamp_show_expiry_date = FALSE
WHERE stamp_size = 'MEDIUM' AND stamp_show_recipient = TRUE AND stamp_show_expiry_date = TRUE
  AND stamp_text = 'CONTROLLED COPY' AND stamp_position = 'TOP_RIGHT';
