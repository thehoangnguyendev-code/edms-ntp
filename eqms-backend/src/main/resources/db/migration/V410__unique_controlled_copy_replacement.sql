-- ControlledCopyService#replaceLostDamaged() checks "has this original already been replaced"
-- with a plain SELECT before inserting the replacement -- that closes the common case (a second
-- click after the first request already committed) but not a true concurrent double-submit, where
-- both requests can read "no replacement yet" before either commits. A partial unique index makes
-- the invariant "at most one replacement per lost/damaged original" hold at the database level
-- regardless of timing, turning a genuine race into a clean constraint-violation error on the loser
-- instead of a second, uncontrolled copy loose in the field.
CREATE UNIQUE INDEX ux_controlled_copies_replaced_controlled_copy_id
    ON controlled_copies (replaced_controlled_copy_id)
    WHERE replaced_controlled_copy_id IS NOT NULL;
