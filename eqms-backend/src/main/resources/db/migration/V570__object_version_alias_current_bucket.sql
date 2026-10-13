-- Object version aliases (SDS-BR-001 section 11.4.2, WP3.1 slice 4): a copy made by a test restore lives in a throw-away bucket, so an
-- alias must name the bucket of its copy as well as the copy's version id. Null means the same bucket as the original.
ALTER TABLE object_version_alias ADD COLUMN IF NOT EXISTS current_bucket VARCHAR(255);
