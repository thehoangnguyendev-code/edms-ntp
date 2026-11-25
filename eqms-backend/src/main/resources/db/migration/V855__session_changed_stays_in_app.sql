-- DEC-TRAINING-2026-11-25: Training Session Updated is only the short in-app result for the person who runs the training; the people concerned are told by e-mail by the events of
-- the change (postponed, session cancelled, trainer assigned, trainer removed). V854 turned its e-mail on with the other in-app events by mistake: back to in-app only
-- (the e-mail wording stays, an administrator can turn it on). A policy an administrator saved is not touched.
update notification_policies set enabled_channels = 'IN_APP', updated_at = now()
 where event_code = 'training.session_changed' and updated_by is null and enabled_channels = 'IN_APP,EMAIL';
