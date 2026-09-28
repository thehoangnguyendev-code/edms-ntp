-- Where the watermark is drawn: BEHIND the page content (text stays crisp, but opaque table cells hide parts of it) or ABOVE it (always
-- fully visible). Issued copies default to BEHIND; the status marking of withdrawn / cancelled copies defaults to ABOVE (an alert that
-- must not be hidden). The status marking is JSON; the server fills a missing layer from its default.
ALTER TABLE controlled_copy_policy_settings
    ADD COLUMN IF NOT EXISTS watermark_layer VARCHAR(10) NOT NULL DEFAULT 'BEHIND';
