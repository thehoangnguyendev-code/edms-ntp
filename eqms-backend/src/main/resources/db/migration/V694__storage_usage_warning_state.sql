-- Whether the administrators were already told that the measured usage reached the warning threshold: they are told once for each time it is reached,
-- and the notice is armed again when a later successful measurement is back under the threshold (or no budget is set).
ALTER TABLE storage_usage_scan_state ADD COLUMN warning_notified boolean NOT NULL DEFAULT false;
