-- DEC-TRAINING-2026-11-27-01 (A2): Quality Assurance marks which rows of the matrix are the GMP training a trainer must have had (SOP.0003 5.1). Nothing is marked by
-- the migration: while no row of an effective matrix is marked, the earlier rule (a topic whose name contains "GMP") is still used, so that no trainer is blocked by the upgrade.
ALTER TABLE training_matrix_rows ADD COLUMN IF NOT EXISTS is_gmp boolean NOT NULL DEFAULT false;
