-- The checks a running verification has finished so far, as [{code, ok, detail}] in the order they ran. A screen lists them as they arrive.
ALTER TABLE backup_job ADD COLUMN steps_json JSONB;
