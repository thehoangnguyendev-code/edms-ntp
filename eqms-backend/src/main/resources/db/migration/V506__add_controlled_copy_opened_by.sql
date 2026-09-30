-- The "Opened By" column shown on the Controlled Copies list/tab was previously fabricated from
-- requestedBy (see ControlledCopyService's DTO mapping) -- controlled_copies never had a real
-- "who last opened this copy" column at all. This adds the real tracking column, matching the
-- opened_by_user_id pattern already used on documents (V6) and document_revisions (V9).
ALTER TABLE controlled_copies ADD COLUMN opened_by_user_id UUID REFERENCES app_users(id);
