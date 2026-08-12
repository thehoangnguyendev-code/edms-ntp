-- Add email field to electronic signature records
ALTER TABLE electronic_signatures
    ADD COLUMN email VARCHAR(255);

-- Add show_email toggle to signature settings
ALTER TABLE electronic_signature_settings
    ADD COLUMN show_email BOOLEAN NOT NULL DEFAULT FALSE;
