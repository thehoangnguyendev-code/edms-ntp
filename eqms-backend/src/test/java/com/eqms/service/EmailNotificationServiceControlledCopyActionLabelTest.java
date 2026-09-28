package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.EmailTemplateRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Regression: the {{workflowAction}} placeholder is rendered directly into the
 * controlled-copy-notification email subject ("Controlled Copy CC-0001 - {{workflowAction}}") and
 * body -- a raw internal action code (e.g. REPLACE_LOST_DAMAGED, REPORT_DAMAGED) must never reach a
 * recipient's inbox verbatim.
 */
@ExtendWith(MockitoExtension.class)
class EmailNotificationServiceControlledCopyActionLabelTest {

    @Mock private ObjectProvider<EmailService> emailServiceProvider;
    @Mock private EmailTemplateRepository templateRepository;
    @Mock private ObjectProvider<SystemConfigurationService> systemConfigurationServiceProvider;
    @Mock private NotificationService notificationService;
    @Mock private UserAccountRepository userAccountRepository;
    @Mock private ObjectMapper objectMapper;

    private EmailNotificationService newService() {
        return new EmailNotificationService(
                emailServiceProvider, templateRepository, systemConfigurationServiceProvider,
                notificationService, userAccountRepository, objectMapper);
    }

    private ControlledCopyRecord copy() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setControlledCopyNumber("CC-0001");
        return copy;
    }

    @Test
    void workflowAction_knownCodes_areHumanized() {
        EmailNotificationService service = newService();
        UserAccount recipient = new UserAccount();

        assertEquals("Replacement Issued",
                service.buildControlledCopyVariables(copy(), null, recipient, "REPLACE_LOST_DAMAGED", null, Map.of()).get("workflowAction"));
        assertEquals("Reported Damaged",
                service.buildControlledCopyVariables(copy(), null, recipient, "REPORT_DAMAGED", null, Map.of()).get("workflowAction"));
        assertEquals("Reported Lost",
                service.buildControlledCopyVariables(copy(), null, recipient, "REPORT_LOST", null, Map.of()).get("workflowAction"));
        assertEquals("Destroyed",
                service.buildControlledCopyVariables(copy(), null, recipient, "DESTROY", null, Map.of()).get("workflowAction"));
        assertEquals("Printed",
                service.buildControlledCopyVariables(copy(), null, recipient, "PRINT", null, Map.of()).get("workflowAction"));
        assertEquals("Distributed",
                service.buildControlledCopyVariables(copy(), null, recipient, "DISTRIBUTE", null, Map.of()).get("workflowAction"));
    }

    @Test
    void workflowAction_unknownCode_fallsBackToTitleCaseInsteadOfRawCode() {
        EmailNotificationService service = newService();
        UserAccount recipient = new UserAccount();

        assertEquals("Some New Action",
                service.buildControlledCopyVariables(copy(), null, recipient, "SOME_NEW_ACTION", null, Map.of()).get("workflowAction"));
    }

    @Test
    void workflowAction_blank_isEmptyNotNull() {
        EmailNotificationService service = newService();
        UserAccount recipient = new UserAccount();

        assertEquals("",
                service.buildControlledCopyVariables(copy(), null, recipient, null, null, Map.of()).get("workflowAction"));
    }
}
