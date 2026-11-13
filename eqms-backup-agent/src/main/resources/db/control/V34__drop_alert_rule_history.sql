-- The record of changes to the alert rules is the eQMS audit trail (and the ledger of this agent); the separate table was never read once the
-- history tab was removed.
DROP TABLE IF EXISTS backup_alert_rule_history;
