-- UCC-STATUS-2026-11-14 (owner decision): an Uncontrolled Copy has the three statuses of the system -- Ready for Distribution, Distributed, Closed - Cancelled -- and no other.
-- How far a copy that is Ready for Distribution has got (waiting for approval, approved, generated) is told by the time stamps it keeps (approved_at, generated_at).
-- Why a copy is Closed - Cancelled (rejected, cancelled, expired) is a reason kept apart from the status (close_reason_code).
-- Forward-only, idempotent: a second run finds nothing to move.
ALTER TABLE uncontrolled_copies ADD COLUMN IF NOT EXISTS close_reason_code VARCHAR(40);

-- a copy that was Approved or Generated keeps the time of that step, so that the step is still known from the time stamps
UPDATE uncontrolled_copies SET approved_at = COALESCE(approved_at, requested_at, created_at) WHERE status_code IN ('APPROVED', 'GENERATED');
UPDATE uncontrolled_copies SET generated_at = COALESCE(generated_at, approved_at, created_at) WHERE status_code = 'GENERATED';

UPDATE uncontrolled_copies SET close_reason_code = 'REJECTED' WHERE status_code = 'REJECTED';
UPDATE uncontrolled_copies SET close_reason_code = 'CANCELLED' WHERE status_code = 'CANCELLED';
UPDATE uncontrolled_copies SET close_reason_code = 'EXPIRED' WHERE status_code = 'EXPIRED';

UPDATE uncontrolled_copies SET status_code = 'READY_FOR_DISTRIBUTION', status = 'Ready for Distribution' WHERE status_code IN ('REQUESTED', 'APPROVED', 'GENERATED');
UPDATE uncontrolled_copies SET status_code = 'CLOSED_CANCELLED', status = 'Closed - Cancelled' WHERE status_code IN ('REJECTED', 'CANCELLED', 'EXPIRED');
UPDATE uncontrolled_copies SET status = 'Distributed' WHERE status_code = 'DISTRIBUTED' AND status <> 'Distributed';

-- the history of the Audit Trail names the statuses the copy had; the new ones are written from now on, what was written stays as it was
CREATE INDEX IF NOT EXISTS idx_uncontrolled_copies_status_code ON uncontrolled_copies (status_code);
