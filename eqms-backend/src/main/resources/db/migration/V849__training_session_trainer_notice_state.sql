-- Notices of a session (owner decision 2026-11-24): the trainer is told by e-mail when the training is notified, and again only when the trainer changed after that notice.
-- notified_trainer_id is the trainer the last notice reached (null: the trainer has not been told yet).
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS notified_trainer_id UUID NULL;

-- The four events below are e-mail only and have their own wording now. A policy nobody has edited is removed here and the notification catalogue creates it again at start
-- with the new channels and the new wording; one an administrator edited is left as it is.
DELETE FROM notification_template_versions
 WHERE policy_id IN (SELECT id FROM notification_policies
                      WHERE event_code IN ('training.postponed', 'training.session_cancelled', 'training.trainer_assigned', 'training.trainer_removed') AND updated_by IS NULL);
DELETE FROM notification_policies
 WHERE event_code IN ('training.postponed', 'training.session_cancelled', 'training.trainer_assigned', 'training.trainer_removed') AND updated_by IS NULL;
