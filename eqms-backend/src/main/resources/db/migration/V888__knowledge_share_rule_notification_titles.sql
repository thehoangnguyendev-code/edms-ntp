-- The notifications already sent for the event now carry its new display name (owner decision 2026-11-27). Only the title changes: the message and the data the notification
-- was made from (the action comment is the text written in the Audit Trail) stay as they were.
UPDATE user_notifications SET title = 'Knowledge Base Share Rule Changed' WHERE title = 'Object Access Rule Changed';
