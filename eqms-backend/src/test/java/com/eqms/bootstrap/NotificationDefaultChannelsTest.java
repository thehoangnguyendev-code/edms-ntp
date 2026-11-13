package com.eqms.bootstrap;

import com.eqms.service.NotificationDefaultChannels;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** NOTIFICATION-ADMIN-2026-11-12: the channels a notification starts with are one list, and the list names only events that exist. */
class NotificationDefaultChannelsTest {

    @Test
    void everyEventTheListNamesIsSeededSoAnEventCannotKeepAStaleName() {
        var seeded = new NotificationEventCatalogBootstrap(null, null, null, new ObjectMapper(), null).seededCodes();
        assertThat(seeded).hasSizeGreaterThan(100);
        // four events are created by migrations (V370 account suspended and terminated and access review due, V523 e-form signer turn), not by this seed
        var known = new java.util.TreeSet<>(seeded);
        known.addAll(java.util.List.of("user.account_suspended", "user.account_terminated", "access_review.campaign_due", "eform.signer_turn"));
        assertThat(NotificationDefaultChannels.alsoByEmail()).as("codes of the list that no event has").isSubsetOf(known);
    }

    @Test
    void inAppIsAlwaysThereAndEmailOnlyWhereTheListSaysSoAndTheEventCanSendIt() {
        assertThat(NotificationDefaultChannels.of("training.step_assigned", "IN_APP,EMAIL")).isEqualTo("IN_APP,EMAIL");
        assertThat(NotificationDefaultChannels.of("training.recorded", "IN_APP,EMAIL")).isEqualTo("IN_APP");              // for information
        assertThat(NotificationDefaultChannels.of("security.refresh_token_reuse", "IN_APP,EMAIL")).isEqualTo("IN_APP,EMAIL");
        assertThat(NotificationDefaultChannels.of("backup.maintenance_drained", "IN_APP")).isEqualTo("IN_APP");            // no e-mail during maintenance
        assertThat(NotificationDefaultChannels.of("training.step_assigned", "IN_APP")).isEqualTo("IN_APP");               // the event cannot send e-mail
        assertThat(NotificationDefaultChannels.of("some.unknown_event", "IN_APP,EMAIL")).isEqualTo("IN_APP");
        assertThat(NotificationDefaultChannels.of("system.configuration_changed", "IN_APP,EMAIL")).isEqualTo("IN_APP");  // noisy
    }
}
