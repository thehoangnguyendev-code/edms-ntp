-- Specimen signatures (FRM.0007, owner decision 2026-10-28, TRAINING-FRM-PAPER): the signed paper is the original and its scan is kept as a record; nobody confirms it any more.
-- A scan uploaded from now on is the current record of the person at once (status APPROVED is kept as the machine value, shown as "Current"; OBSOLETED as "Superseded").
-- A record that was confirmed under the earlier workflow keeps its confirmer and electronic signature. A scan that was still waiting for a confirmation (PENDING_CONFIRMATION) is left as it
-- is, shown as "Not confirmed (earlier workflow)"; its request for a confirmation is cancelled so that it leaves the work queue of the confirmer. Forward-only and idempotent.
UPDATE training_approval_assignments SET status = 'CANCELLED'
 WHERE object_type = 'TRAINING_SPECIMEN_SIGNATURE' AND step_code = 'SPECIMEN_CONFIRM' AND status = 'PENDING';
