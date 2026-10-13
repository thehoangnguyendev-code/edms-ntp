-- The restore drill interval (SDS 14.1): how many days may pass between restore drills before the overview warns that one is overdue.
-- Owner's decision (2026-10-13): 365 days. The range 30 to 730 days is proposed; the owner may change it through the signed rule change.
INSERT INTO restore_rule (code, int_value, min_value, max_value, description) VALUES
    ('RESTORE_DRILL_INTERVAL_DAYS', 365, 30, 730,
     'How many days may pass between restore drills before the overview warns that the next one is overdue (SDS 14.1).');
