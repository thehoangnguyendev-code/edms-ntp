package com.eqms.bootstrap;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.repository.UserNotificationRepository;
import com.eqms.service.NotificationService;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@Order(5)
public class NotificationBootstrap implements ApplicationRunner {

    private final UserNotificationRepository notificationRepository;
    private final UserAccountRepository userAccountRepository;
    private final NotificationService notificationService;

    public NotificationBootstrap(
            UserNotificationRepository notificationRepository,
            UserAccountRepository userAccountRepository,
            NotificationService notificationService
    ) {
        this.notificationRepository = notificationRepository;
        this.userAccountRepository = userAccountRepository;
        this.notificationService = notificationService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (notificationRepository.count() > 0) {
            return;
        }

        Optional<UserAccount> admin = userAccountRepository.findByUsername("admin");
        Optional<UserAccount> reviewer1 = userAccountRepository.findByUsername("reviewer.lead1");
        Optional<UserAccount> reviewer2 = userAccountRepository.findByUsername("reviewer.lead2");
        Optional<UserAccount> dco = userAccountRepository.findByUsername("dco.lead1");

        List<UserAccount> users = List.of(admin.orElse(null), reviewer1.orElse(null), reviewer2.orElse(null), dco.orElse(null))
                .stream()
                .filter(java.util.Objects::nonNull)
                .toList();

        for (UserAccount user : users) {
            notificationService.seedIfEmpty(
                    user,
                    admin.orElse(null),
                    "Welcome to Notifications",
                    "Your personal notification inbox is now available. This is a sample notification seeded for the notifications module.",
                    "System",
                    "system",
                    "system"
            );
        }

        reviewer1.ifPresent(user -> notificationService.recordNotification(
                user,
                admin.orElse(null),
                "personal",
                "Document",
                "document-review",
                "Document Review Request",
                "SOP.0007 is waiting for your review.",
                "/documents/" + "SAMPLE-REV-1" + "/review",
                "revision",
                null,
                "SOP.0007",
                "Quality Assurance Procedure",
                "high",
                JsonNodeFactory.instance.objectNode().put("sample", true)
        ));

        reviewer2.ifPresent(user -> notificationService.recordNotification(
                user,
                admin.orElse(null),
                "personal",
                "Controlled Copy",
                "controlled-copy-distribution-notification",
                "Controlled Copy Available",
                "A controlled copy is ready for distribution.",
                "/documents/controlled-copies",
                "controlled-copy",
                null,
                "CC.SOP.0007",
                "Controlled Copy Batch",
                "medium",
                JsonNodeFactory.instance.objectNode().put("sample", true)
        ));

        dco.ifPresent(user -> notificationService.recordNotification(
                user,
                admin.orElse(null),
                "system",
                "System",
                "preference-notification",
                "System Configuration Updated",
                "Notification preferences and storage configuration were updated successfully.",
                "/settings/configuration",
                "system",
                null,
                null,
                "System configuration",
                "low",
                JsonNodeFactory.instance.objectNode().put("sample", true)
        ));
    }
}
