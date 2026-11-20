-- Wrong passwords when signing are counted apart from the wrong passwords at sign-in (own count, own limit: Maximum Signature Attempts).
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS failed_signature_count INTEGER NOT NULL DEFAULT 0;
