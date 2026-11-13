package com.eqms.backup.agent.restore;

import java.util.Map;

/** The real R10 (swap) and rollback actions for {@link RestoreRunEngine}, built on {@link DatabaseSwap}. */
public final class RestoreSwapActions {

    private RestoreSwapActions() {
    }

    /** R10: the restored database takes the live name; the old live database is kept as live_pre_tag. */
    public static RestoreRunEngine.Action swap(DatabaseSwap swap, String live, String restored, String tag) {
        return () -> {
            swap.swapIn(live, restored, tag);
            return Map.of("live", live, "keptAs", DatabaseSwap.preName(live, tag));
        };
    }

    /** Rollback: the kept database becomes live again; the post-restore database is kept as live_post_tag. */
    public static RestoreRunEngine.Action rollback(DatabaseSwap swap, String live, String tag) {
        return () -> {
            // the swap renames both or none; if the old database was never set aside there is nothing to undo
            if (!swap.isSwapped(live, tag)) return Map.of("live", live, "note", "nothing was swapped");
            swap.rollBack(live, tag);
            return Map.of("live", live, "postRestoreKeptAs", DatabaseSwap.postName(live, tag));
        };
    }
}
