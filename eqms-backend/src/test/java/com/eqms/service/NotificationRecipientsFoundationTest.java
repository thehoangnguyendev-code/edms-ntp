package com.eqms.service;

import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.NotificationEventDefinitionRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION-ADMIN-2026-11-12, the foundation of the recipients: one list of the kinds of recipient, checked when a policy is saved and resolved
 * by the dispatcher (the context kinds are the people the sender names; the audience kinds are found by the dispatcher itself).
 */
class NotificationRecipientsFoundationTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static ArrayNode rules(String... typeAndValue) {
        ArrayNode rules = JSON.createArrayNode();
        for (int i = 0; i < typeAndValue.length; i += 2) {
            var rule = rules.addObject().put("type", typeAndValue[i]);
            if (typeAndValue[i + 1] != null) rule.put("value", typeAndValue[i + 1]);
        }
        return rules;
    }

    private static UserAccount user(String name, String role, String department, UserStatus status) {
        UserAccount u = mock(UserAccount.class);
        when(u.getId()).thenReturn(UUID.nameUUIDFromBytes(name.getBytes()));
        when(u.getFullName()).thenReturn(name);
        when(u.getRoleName()).thenReturn(role);
        when(u.getDepartment()).thenReturn(department);
        when(u.getStatus()).thenReturn(status);
        return u;
    }

    // ------------------------------------------------------------------ the list of the kinds

    @Test
    void everyKindHasAWordingAndIsEitherAContextOrAnAudience() {
        assertThat(NotificationRecipientRules.all()).extracting(NotificationRecipientRules.Rule::type)
                .containsExactly("OWNER", "AUTHOR", "ASSIGNEE", "REVIEWER", "APPROVER", "RECIPIENT", "ACTOR", "AFFECTED_USERS", "ALL_USERS", "PERMISSION", "ROLE", "DEPARTMENT");
        assertThat(NotificationRecipientRules.all()).allSatisfy(rule -> {
            assertThat(rule.label()).isNotBlank();
            assertThat(rule.description()).isNotBlank();
            assertThat(rule.kind()).isIn(NotificationRecipientRules.CONTEXT, NotificationRecipientRules.AUDIENCE);
            assertThat(rule.needsValue()).isEqualTo(rule.valueLabel() != null);
        });
        assertThat(NotificationRecipientRules.isContext("reviewer")).isTrue();
        assertThat(NotificationRecipientRules.isContext("ALL_USERS")).isFalse();
        assertThat(NotificationRecipientRules.isContext("nonsense")).isFalse();
    }

    // ------------------------------------------------------------------ what a policy may be given

    @Test
    void theRulesOfAPolicyMustBeKnownCompleteAndNotRepeated() {
        NotificationRecipientRules.validate(rules("AUTHOR", null, "reviewer", null, "PERMISSION", "documents.document.view_all", "ROLE", "QA Manager", "DEPARTMENT", "Quality Assurance"));
        assertThatThrownBy(() -> NotificationRecipientRules.validate(rules("EVERYONE", null))).hasMessageContaining("Unknown recipient rule");
        assertThatThrownBy(() -> NotificationRecipientRules.validate(rules("ROLE", " "))).hasMessageContaining("needs a value: role name");
        assertThatThrownBy(() -> NotificationRecipientRules.validate(rules("DEPARTMENT", null))).hasMessageContaining("needs a value: department");
        assertThatThrownBy(() -> NotificationRecipientRules.validate(rules("AUTHOR", null, "author", null))).hasMessageContaining("listed twice");
        assertThatThrownBy(() -> NotificationRecipientRules.validate(rules("ROLE", "QA", "ROLE", "qa"))).hasMessageContaining("listed twice");
        NotificationRecipientRules.validate(rules("ROLE", "QA", "ROLE", "Production"));
        assertThatThrownBy(() -> NotificationRecipientRules.validate(null)).hasMessageContaining("list of rules");
        assertThatThrownBy(() -> NotificationRecipientRules.validate(JSON.createObjectNode())).hasMessageContaining("list of rules");
    }

    // ------------------------------------------------------------------ what the dispatcher finds

    private NotificationDispatcher dispatcherWith(UserAccountRepository users) {
        return new NotificationDispatcher(mock(NotificationEventDefinitionRepository.class), mock(NotificationPolicyRepository.class),
                mock(NotificationTemplateVersionRepository.class), mock(NotificationService.class), users, mock(PermissionEvaluationService.class),
                JSON, mock(NotificationEmailOutbox.class), mock(com.eqms.repository.NotificationDispatchQueueRepository.class));
    }

    @Test
    void anAudienceOfARoleOrADepartmentIsFoundByTheDispatcherAmongTheActiveUsersAndDeduplicated() {
        UserAccount qa = user("Qa One", "QA Manager", "Quality Assurance", UserStatus.Active);
        UserAccount operator = user("Operator", "Operator", "Production", UserStatus.Active);
        UserAccount qaLeft = user("Qa Left", "QA Manager", "Quality Assurance", UserStatus.Inactive);
        UserAccount bothRules = user("Both", "QA Manager", "Production", UserStatus.Active);
        UserAccountRepository users = mock(UserAccountRepository.class);
        // the repository answers with active users only, as findAllByStatus(Active) does
        when(users.findAllByStatus(UserStatus.Active)).thenReturn(List.of(qa, operator, bothRules));
        NotificationDispatcher dispatcher = dispatcherWith(users);

        assertThat(dispatcher.resolveRecipients(rules("ROLE", "qa manager"), List.of()))
                .extracting(UserAccount::getFullName).containsExactly("Qa One", "Both");
        assertThat(dispatcher.resolveRecipients(rules("DEPARTMENT", "PRODUCTION"), List.of()))
                .extracting(UserAccount::getFullName).containsExactly("Operator", "Both");
        assertThat(dispatcher.resolveRecipients(rules("ROLE", "QA Manager", "DEPARTMENT", "Production"), List.of()))
                .extracting(UserAccount::getFullName).containsExactly("Qa One", "Operator", "Both"); // one notification each, in the order found
        assertThat(dispatcher.resolveRecipients(rules("ROLE", "Nobody"), List.of())).isEmpty();
        assertThat(dispatcher.resolveRecipients(rules("ROLE", " "), List.of())).isEmpty();
        assertThat(qaLeft.getStatus()).isEqualTo(UserStatus.Inactive);
    }

    @Test
    void aContextRuleTakesThePeopleTheSenderNamedAndAnAudienceAddsToThem() {
        UserAccount author = user("Author", "Author", "QA", UserStatus.Active);
        UserAccount gone = user("Gone", "Author", "QA", UserStatus.Inactive);
        UserAccount qa = user("Qa One", "QA Manager", "Quality Assurance", UserStatus.Active);
        UserAccountRepository users = mock(UserAccountRepository.class);
        when(users.findAllByStatus(UserStatus.Active)).thenReturn(List.of(qa));
        NotificationDispatcher dispatcher = dispatcherWith(users);

        assertThat(dispatcher.resolveRecipients(rules("AUTHOR", null, "ROLE", "QA Manager"), List.of(author, gone)))
                .extracting(UserAccount::getFullName).containsExactly("Author", "Qa One");
        // a rule that needs the sender's people finds none when the sender named none
        assertThat(dispatcher.resolveRecipients(rules("AUTHOR", null), List.of())).isEmpty();
    }

    // ------------------------------------------------------------------ the policy refuses a rule it cannot resolve

    @Test
    void aPolicyIsNotSavedWithARuleTheDispatcherCannotResolve() {
        NotificationPolicyRepository policies = mock(NotificationPolicyRepository.class);
        NotificationEventDefinitionRepository events = mock(NotificationEventDefinitionRepository.class);
        var users = mock(com.eqms.auth.CurrentUserService.class);
        when(users.requireCurrentUser()).thenReturn(new UserAccount());
        var event = new com.eqms.entity.NotificationEventDefinition();
        event.setCode("x.y");
        event.setName("X");
        var policy = new NotificationPolicy();
        policy.setId(UUID.randomUUID());
        policy.setStatus("DRAFT");
        policy.setEnabledChannels("IN_APP");
        when(events.findByCode("x.y")).thenReturn(java.util.Optional.of(event));
        when(policies.findByEventCode("x.y")).thenReturn(java.util.Optional.of(policy));
        when(policies.lockByEventCode("x.y")).thenReturn(java.util.Optional.of(policy));
        var service = new NotificationPolicyService(events, policies, mock(NotificationTemplateVersionRepository.class), users,
                mock(AuditTrailService.class), JSON);
        var request = new com.eqms.dto.notification.UpdateNotificationPolicyRequest(null, rules("EVERYONE", null), null, null, null, null, null, null);
        assertThatThrownBy(() -> service.updatePolicy("x.y", request)).hasMessageContaining("Unknown recipient rule");
        var noValue = new com.eqms.dto.notification.UpdateNotificationPolicyRequest(null, rules("ROLE", null), null, null, null, null, null, null);
        assertThatThrownBy(() -> service.updatePolicy("x.y", noValue)).hasMessageContaining("needs a value");
    }

    // ------------------------------------------------------------------ the modules

    @Test
    void aModuleWrittenAnyWayIsReadAsOneOfTheFixedList() {
        assertThat(NotificationModule.of("Document Control")).isEqualTo(NotificationModule.DOCUMENT_CONTROL);
        assertThat(NotificationModule.of("controlled-copies")).isEqualTo(NotificationModule.CONTROLLED_COPIES);
        assertThat(NotificationModule.of(" SECURITY ")).isEqualTo(NotificationModule.SECURITY);
        assertThat(NotificationModule.of("Backup & Restore")).isEqualTo(NotificationModule.BACKUP_RESTORE);
        assertThat(NotificationModule.of("training")).isEqualTo(NotificationModule.TRAINING);
        assertThat(NotificationModule.of("nonsense")).isNull();
        assertThat(NotificationModule.of(null)).isNull();
        assertThat(NotificationModule.DOCUMENT_CONTROL.label()).isEqualTo("Document Control");
    }
}
