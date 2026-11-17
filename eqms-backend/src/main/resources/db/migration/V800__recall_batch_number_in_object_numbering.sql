-- The Recall Batch Number (RCB-yyyy-NNNNN, Recall by Scan) moves into System Administration > Object Numbering like the other numbers of records.
-- The default format is the one in use until now, so nothing a person sees changes: prefix RCB, separator '-', the year, 5 digits.
-- One difference to know: the counter is now kept per year (as for the other kinds), where the old sequence never went back to 1.
-- The counter of each year is seeded from the batches that already exist, so the next number follows the last one and no number is given twice.
-- Numbers already given never change. Forward-only, idempotent. The old sequence controlled_copy_recall_batch_seq is left in place, no longer used.
INSERT INTO object_number_formats (kind, module_name, label, prefix, separator, include_year, digits) VALUES
    ('RECALL_BATCH', 'Document Control', 'Recall Batch Number', 'RCB', '-', TRUE, 5)
ON CONFLICT (kind) DO NOTHING;

INSERT INTO object_number_counters (kind, period, last_value)
SELECT 'RECALL_BATCH', substring(batch_number from '^RCB-(\d{4})-\d+$'), max(substring(batch_number from '-(\d+)$')::bigint)
FROM controlled_copy_recall_batches
WHERE batch_number ~ '^RCB-\d{4}-\d+$'
GROUP BY 1, 2
ON CONFLICT (kind, period) DO NOTHING;
