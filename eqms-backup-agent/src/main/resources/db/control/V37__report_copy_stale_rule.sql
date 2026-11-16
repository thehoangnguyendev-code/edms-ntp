-- REPORT-BACKUP-RUNS-2026-11-15: the application copies the summary of each run for the Backup and Restore Runs report (see V36). When that copy is not refreshed for a long time the
-- backend tells the agent, and the agent raises this alert like any other (the recipients and channels of the alert rules apply).
INSERT INTO backup_alert_rule (code, label, hint, notify_in_app, notify_email, sort_order) VALUES
    ('REPORT_COPY_STALE', 'The report copy of backup runs is out of date',
     'The application has not been able to refresh its copy of the backup and restore runs for the Backup and Restore Runs report. The runs themselves are not affected; the report shows what was copied last.', TRUE, FALSE, 160)
ON CONFLICT (code) DO NOTHING;
