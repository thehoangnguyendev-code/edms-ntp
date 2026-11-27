-- "Object Access Rule Changed" is raised when a Knowledge Base share is created, changed or taken away (the table object_access_rules is still the store of the shares).
-- The shares are managed in Security & Authorization > Access Review (Knowledge shares), not in Access Profiles: V885 pointed these notifications to the wrong screen.
UPDATE user_notifications SET action_url = '/security/access-review'
WHERE action_url = '/security/access-profiles' AND title = 'Object Access Rule Changed';
