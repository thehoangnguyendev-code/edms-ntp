package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.util.EmailTemplateTypeUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tells a Department Head or a Head of Unit (e-mail and inbox, through the e-mail template of type knowledge-share-notification) that a person
 * who may share on his behalf shared, took a share away or made a link. The Audit Trail entry is written by the caller; a message that cannot
 * be sent never undoes the action it reports (it is logged, and the failure is recorded by the e-mail service).
 */
@Component
public class KnowledgeShareNotifier {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeShareNotifier.class);

    private final EmailNotificationService emailNotificationService;

    public KnowledgeShareNotifier(EmailNotificationService emailNotificationService) {
        this.emailNotificationService = emailNotificationService;
    }

    /**
     * @param heads      who is told (the Head of the Department, else the Head of Unit); empty = nobody is named, only the Audit Trail knows
     * @param actionTitle short subject text, for example "a delegate shared a document"
     * @param actionText the sentence after the actor's name, for example "shared a document with Position QC Staff"
     */
    public void tell(List<UserAccount> heads, UserAccount actor, String actionTitle, String actionText, String itemLabel, String scopeName, String detail) {
        List<UserAccount> recipients = heads.stream().filter(h -> h != null && (actor == null || !h.getId().equals(actor.getId()))).distinct().toList();
        if (recipients.isEmpty()) {
            log.warn("Knowledge Base sharing by {} on '{}' was not reported: no Department Head or Head of Unit is named for {}",
                    actor == null ? "?" : actor.getFullName(), itemLabel, scopeName);
            return;
        }
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("actionTitle", actionTitle);
        variables.put("actorName", actor == null || actor.getFullName() == null ? "" : actor.getFullName());
        variables.put("actionText", actionText);
        variables.put("itemLabel", itemLabel == null ? "" : itemLabel);
        variables.put("scopeName", scopeName == null ? "" : scopeName);
        variables.put("detail", detail == null || detail.isBlank() ? "-" : detail);
        variables.put("notificationMandatory", "true");
        try {
            emailNotificationService.sendByTypeToRecipients(EmailTemplateTypeUtils.KNOWLEDGE_SHARE_NOTIFICATION, recipients, variables);
        } catch (RuntimeException ex) {
            log.warn("Knowledge Base sharing notice could not be sent: {}", ex.getMessage(), ex);
        }
    }
}
