-- Preserve Employee ID as part of the access-review snapshot and backfill existing campaigns.
ALTER TABLE access_review_items
    ADD COLUMN IF NOT EXISTS employee_code VARCHAR(80);

UPDATE access_review_items item
SET employee_code = user_account.employee_code
FROM app_users user_account
WHERE item.user_id = user_account.id
  AND item.employee_code IS NULL;
