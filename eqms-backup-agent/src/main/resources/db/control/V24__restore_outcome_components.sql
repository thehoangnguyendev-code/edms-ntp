-- What a restore covered: DATABASE, OBJECT_STORE (the files), or both. A restore of the files alone changes no database name, so it is
-- recorded as FINALIZED at once (nothing is swapped and there is nothing to roll back).
ALTER TABLE restore_outcome ADD COLUMN components VARCHAR(80);
