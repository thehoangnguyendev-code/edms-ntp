-- A copy to a network share (T2) can fail while the share is off the network and succeed later. The failed attempt is evidence and the
-- table is append-only, so it cannot be changed into the success: each attempt is its own row. The key gains the time of the attempt.
ALTER TABLE backup_set_location DROP CONSTRAINT backup_set_location_pkey;
ALTER TABLE backup_set_location ADD PRIMARY KEY (run_id, target_code, written_at);
