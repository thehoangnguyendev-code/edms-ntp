package com.eqms.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;
import org.junit.jupiter.api.Test;

/** The callback must act before V799 and at no other moment, so that databases that already passed V799 are never touched. */
class PermissionSetNameDedupCallbackTest {

    private final PermissionSetNameDedupCallback callback = new PermissionSetNameDedupCallback();

    private static Context before(String version) {
        MigrationInfo info = mock(MigrationInfo.class);
        when(info.getVersion()).thenReturn(MigrationVersion.fromVersion(version));
        Context context = mock(Context.class);
        when(context.getMigrationInfo()).thenReturn(info);
        return context;
    }

    @Test
    void actsOnlyBeforeV799() {
        assertTrue(callback.supports(Event.BEFORE_EACH_MIGRATE, before("799")));
        assertFalse(callback.supports(Event.BEFORE_EACH_MIGRATE, before("798")));
        assertFalse(callback.supports(Event.BEFORE_EACH_MIGRATE, before("800")));
        assertFalse(callback.supports(Event.AFTER_EACH_MIGRATE, before("799")));
    }

    @Test
    void doesNothingWhenFlywayGivesNoMigration() {
        Context context = mock(Context.class);
        assertFalse(callback.supports(Event.BEFORE_EACH_MIGRATE, context));
    }
}
