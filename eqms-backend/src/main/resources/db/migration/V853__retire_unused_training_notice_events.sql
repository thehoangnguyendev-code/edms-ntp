-- Two Training notice events were seeded and nothing ever raised them: training.work_resumed (the suspension of work ends only when the person passes the retraining, there is no step
-- in which the head resumes it) and training.step_ready (no step sends it). They are removed so that Notifications Administration lists only events that can be sent.
-- Forward-only and idempotent.
DELETE FROM notification_template_versions WHERE policy_id IN (SELECT id FROM notification_policies WHERE event_code IN ('training.work_resumed', 'training.step_ready'));
DELETE FROM notification_policies WHERE event_code IN ('training.work_resumed', 'training.step_ready');
DELETE FROM notification_event_definitions WHERE code IN ('training.work_resumed', 'training.step_ready');
