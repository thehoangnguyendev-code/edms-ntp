-- There is no cancellation of a restore request (SDS 11.3, decision of 2026-10-09): a request is approved or rejected by the assigned
-- approver. New rows may no longer take the status CANCELLED. Rows already written with CANCELLED are kept unchanged: the event
-- history of a request is evidence, and restore_request_event is append-only. NOT VALID checks new and updated rows only.
ALTER TABLE restore_request DROP CONSTRAINT IF EXISTS restore_request_status_check;
ALTER TABLE restore_request ADD CONSTRAINT restore_request_status_check
    CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')) NOT VALID;
