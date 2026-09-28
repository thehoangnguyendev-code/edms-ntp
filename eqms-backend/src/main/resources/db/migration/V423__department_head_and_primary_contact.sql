-- Department Head (a real user) + Primary Contact phone number, shown to the right of Business
-- Unit on the Departments dictionary screen. Primary Contact is auto-filled from the selected
-- Department Head's phone on the client (so the admin doesn't have to retype a number already on
-- file for that user) but stays a plain editable column here, not a live join, so it can be
-- overridden to a different contact number if needed.
ALTER TABLE departments
    ADD COLUMN department_head_id UUID NULL REFERENCES app_users(id),
    ADD COLUMN primary_contact_phone VARCHAR(20) NULL;
