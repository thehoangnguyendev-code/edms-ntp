-- Training Management, hybrid assessment: a file uploaded as evidence of an attendance sheet or an assessment may say which form and version was used (for example APD.0009 2.0.0).
-- The field is free text and optional: the trainer chooses the form where the company keeps it, and the system only records the statement. Forward-only and idempotent.

ALTER TABLE training_paper_evidence ADD COLUMN IF NOT EXISTS form_used VARCHAR(80);
