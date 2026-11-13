package com.eqms.bootstrap;

import com.eqms.service.NotificationPlaceholderCatalog;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NOTIFICATION-ADMIN-2026-11-12, the placeholder contract: a placeholder an event declares must be one the catalogue knows (module, label, example), so
 * a new placeholder is added to the catalogue where it is first used and never appears on a screen without a meaning.
 */
class NotificationPlaceholderContractTest {

    @Test
    void everyPlaceholderTheSeededEventsDeclareIsInTheCatalogue() {
        var bootstrap = new NotificationEventCatalogBootstrap(null, null, null, new ObjectMapper(), null);
        Set<String> declared = bootstrap.declaredPlaceholders();
        assertThat(declared).as("the seeded events declare placeholders").hasSizeGreaterThan(5);
        Set<String> unknown = declared.stream().filter(name -> NotificationPlaceholderCatalog.find(name) == null).collect(Collectors.toCollection(TreeSet::new));
        assertThat(unknown).as("placeholders the events declare but the catalogue does not know: add them to NotificationPlaceholderCatalog").isEmpty();
    }
}
