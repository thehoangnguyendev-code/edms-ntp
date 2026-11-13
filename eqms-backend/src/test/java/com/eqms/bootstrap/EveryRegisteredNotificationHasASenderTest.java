package com.eqms.bootstrap;

import com.eqms.service.AuditNotificationEvents;
import com.eqms.service.LegacyMessageEvents;
import com.eqms.service.OperationalNotificationEvents;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NOTIFICATION-ADMIN-2026-11-12: a notification an administrator can configure must be one the system sends. An event that is registered and that no code raises is a
 * promise nothing keeps (8 were found on 2026-11-12 and removed or wired). The senders are: the Training notifier (the code it raises), the audit-driven events, the
 * messages of the older senders, the operational events (named by a constant), and every other event by its code written in the source.
 */
class EveryRegisteredNotificationHasASenderTest {

    @Test
    void everyEventTheSystemRegistersIsRaisedByCode() throws IOException {
        Set<String> registered = new NotificationEventCatalogBootstrap(null, null, null, new ObjectMapper(), null).seededCodes();
        List<String> sources = new ArrayList<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/java"))) {
            for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                String name = file.getFileName().toString();
                if (name.equals("NotificationEventCatalogBootstrap.java") || name.equals("NotificationDefaultChannels.java")) continue;
                sources.add(name + "\n" + Files.readString(file));
            }
        }
        Set<String> viaTable = Stream.of(
                        AuditNotificationEvents.all().stream().map(AuditNotificationEvents.Event::code),
                        LegacyMessageEvents.all().stream().map(LegacyMessageEvents.Event::code),
                        com.eqms.service.training.TrainingNotificationEvents.all().stream().map(com.eqms.service.training.TrainingNotificationEvents.Event::registryCode))
                .flatMap(s -> s).collect(Collectors.toSet());
        List<String> raised = new ArrayList<>();
        List<String> unraised = new ArrayList<>();
        for (String code : registered) {
            boolean fromATable = viaTable.contains(code);
            boolean written = sources.stream().anyMatch(text -> !text.startsWith("AuditNotificationEvents.java") && !text.startsWith("LegacyMessageEvents.java") && text.contains("\"" + code + "\""));
            // an operational event is named by a constant that a sender uses
            boolean byConstant = OperationalNotificationEvents.all().stream().anyMatch(e -> e.code().equals(code))
                    && sources.stream().anyMatch(text -> !text.startsWith("OperationalNotificationEvents.java") && text.contains("OperationalNotificationEvents."));
            (fromATable || written || byConstant ? raised : unraised).add(code);
        }
        assertThat(unraised).as("registered events that nothing raises: wire them or remove them (and add a migration that deletes the rows)").isEmpty();
        assertThat(raised).hasSizeGreaterThan(100);
    }
}
