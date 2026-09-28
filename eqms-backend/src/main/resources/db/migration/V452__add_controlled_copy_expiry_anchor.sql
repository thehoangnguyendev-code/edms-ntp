-- Tracks whether a Controlled Copy's expiry date came from the Expiry Policy's duration (and must
-- therefore be recomputed as distributedAt + duration at Distribute time, so a copy waiting in
-- Ready for Distribution can never expire before it is distributed) versus an explicit date the
-- requester chose (a fixed deadline, never recomputed). Existing rows keep their already-fixed
-- expiry date unchanged: they default to false (not recomputed).
ALTER TABLE controlled_copies
    ADD COLUMN expiry_anchored_to_distribution BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE controlled_copy_distribution_batches
    ADD COLUMN expiry_anchored_to_distribution BOOLEAN NOT NULL DEFAULT FALSE;
