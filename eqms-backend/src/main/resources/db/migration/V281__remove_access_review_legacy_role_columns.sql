-- Access reviews snapshot Access Profiles and effective permissions only.
-- The retired role-name and fallback indicators must not reintroduce an
-- alternative entitlement source in review evidence or APIs.
ALTER TABLE access_review_items
    DROP COLUMN IF EXISTS role_name,
    DROP COLUMN IF EXISTS legacy_fallback;
