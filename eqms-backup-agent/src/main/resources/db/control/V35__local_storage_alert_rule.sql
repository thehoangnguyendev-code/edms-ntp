-- A file on the application's own disk has no backup (only the database and the document store are backed up): the agent tells it.
INSERT INTO backup_alert_rule (code, label, hint, notify_in_app, notify_email, sort_order) VALUES
    ('LOCAL_STORAGE_NOT_BACKED_UP', 'Files are on the application disk, outside the backup',
     'The application wrote files to its own storage folder instead of the document store. That folder is not backed up.', TRUE, TRUE, 150);
