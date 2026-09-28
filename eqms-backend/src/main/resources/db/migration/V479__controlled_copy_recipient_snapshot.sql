-- The recipient details printed on a Controlled Copy (name, e-mail, job title, department) are captured once when the
-- copy is distributed and kept on the copy, so a later change to the user's profile never alters what was printed.
ALTER TABLE controlled_copies
    ADD COLUMN IF NOT EXISTS recipient_snapshot jsonb;
