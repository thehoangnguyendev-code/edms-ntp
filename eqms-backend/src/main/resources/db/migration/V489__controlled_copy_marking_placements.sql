-- Per-page placement rules for the issue-time stamp and watermark (see MarkingPlacementRule): where on which pages (cover page,
-- page 2 onwards, or listed pages) they are drawn, as fractions of the page. Empty / null = the ordinary corner and centre setting.
-- The rules for withdrawn / cancelled copies live inside status_marking.
ALTER TABLE controlled_copy_policy_settings ADD COLUMN IF NOT EXISTS marking_placements jsonb;
