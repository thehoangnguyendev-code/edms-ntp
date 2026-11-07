-- V733: Publishing Templates have no versions and no publish step any more, and any number of them may be Active at once (the person publishing a
-- document chooses one). The unique index of V478 that allowed a single Active template is removed.
--
-- Rollback (if needed): retire all but one Active template, then
--   CREATE UNIQUE INDEX uq_publishing_templates_single_live ON publishing_templates ((1)) WHERE upper(status) IN ('ACTIVE', 'PUBLISHED');
DROP INDEX IF EXISTS uq_publishing_templates_single_live;
