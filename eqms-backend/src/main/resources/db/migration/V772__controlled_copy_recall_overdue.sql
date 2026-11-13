-- NOTIFICATION-ADMIN-2026-11-12: a printed controlled copy that was recalled must be returned and destroyed. recall_overdue_notified_at says when the holder and the
-- Document Control were last reminded that it is overdue (notification event controlled_copy.recall_overdue), so the reminder is sent once a week, not every pass.
ALTER TABLE controlled_copies ADD COLUMN IF NOT EXISTS recall_overdue_notified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_controlled_copies_recall_overdue ON controlled_copies(recalled_at)
    WHERE recalled_at IS NOT NULL AND destroyed_at IS NULL AND print_count > 0;
