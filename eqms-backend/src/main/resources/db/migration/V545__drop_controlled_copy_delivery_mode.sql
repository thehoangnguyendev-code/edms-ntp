-- V545: Controlled Copies no longer have a delivery mode (owner decision 2026-10-07). It only existed to tell electronic-form copies
-- from paper ones; electronic forms are retired and every copy is paper (all 3017 existing rows hold PAPER). The QR code is now
-- printed on every issued copy and the recall by scan no longer looks at it.
--
-- The guard that rejected any value other than PAPER goes with the column. The other retirement guards stay (paper-only capture
-- method on Executed Records, read-only archived eForm history).
DROP TRIGGER IF EXISTS controlled_copy_paper_only ON controlled_copies;
DROP FUNCTION IF EXISTS require_paper_controlled_copy();
ALTER TABLE controlled_copies DROP COLUMN IF EXISTS delivery_mode;
