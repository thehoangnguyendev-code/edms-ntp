-- The per-meaning Description/Require Reason/Comment Rule/Allowed Reasons/Active/Sort Order
-- controls never worked as advertised: Active never gated signing (validateSigningRules and
-- findByCodeIgnoreCase never filtered by it), and the per-meaning Require Reason/Comment Rule/
-- Allowed Reasons duplicated the global electronic_signature_settings fields in a confusing way.
-- Simplifying: a signature "meaning" is now a system-defined code (fixed by the app, never
-- created/deleted by an admin) with a single admin-editable field, its display label. Reason is
-- now always required and free-text; Comment is removed entirely from the signing flow.
ALTER TABLE electronic_signature_meanings DROP COLUMN description;
ALTER TABLE electronic_signature_meanings DROP COLUMN requires_reason;
ALTER TABLE electronic_signature_meanings DROP COLUMN comment_rule;
ALTER TABLE electronic_signature_meanings DROP COLUMN requires_comment;
ALTER TABLE electronic_signature_meanings DROP COLUMN allowed_reasons;
ALTER TABLE electronic_signature_meanings DROP COLUMN active;
ALTER TABLE electronic_signature_meanings DROP COLUMN sort_order;

ALTER TABLE electronic_signature_settings DROP COLUMN require_reason;
ALTER TABLE electronic_signature_settings DROP COLUMN comment_rule;
