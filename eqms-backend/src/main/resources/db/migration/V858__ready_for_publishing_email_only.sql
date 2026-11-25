-- DEC-NOTIFICATION-2026-11-26-1: Document Ready for Publishing goes to Document Control by e-mail only; the in-app notice of that moment is Revision Training Completed (new event, in-app) and,
-- after the publication, Document Published. A policy an administrator saved (updated_by set) is not touched.
update notification_policies set enabled_channels = 'EMAIL', updated_at = now()
 where updated_by is null and enabled_channels = 'IN_APP,EMAIL' and event_code = 'document.ready_for_publishing';
