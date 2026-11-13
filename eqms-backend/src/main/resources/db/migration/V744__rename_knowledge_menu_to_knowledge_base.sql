-- The Self-Service menu is named "Knowledge Base". Only the display name and description change;
-- the permission code (self_service.knowledge.view) and every grant stay as they are.
UPDATE permissions
   SET name = 'View Knowledge Base',
       description = 'View the Knowledge Base portal under Self-Service (browse/search published documents, feedback, subscriptions).'
 WHERE code = 'self_service.knowledge.view';
