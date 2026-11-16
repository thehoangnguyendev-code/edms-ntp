package com.eqms.service;

import com.eqms.entity.UserAccount;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Turns an audited action into a notification (see {@link AuditNotificationEvents}). It listens for the action after the transaction that wrote it has
 * committed, so nobody is told about a change that was rolled back, and a failure to notify never reaches the business change.
 */
@Component
public class AuditNotificationBridge {
    private static final Logger log = LoggerFactory.getLogger(AuditNotificationBridge.class);

    /** An action the Audit Trail recorded; {@code actor} is the person who did it. */
    public record AuditedAction(UserAccount actor, String entityType, String entityName, UUID entityId, String actionType, String comment) {
    }

    private final NotificationDispatcher dispatcher;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final com.eqms.repository.UserAccountRepository users;

    public AuditNotificationBridge(NotificationDispatcher dispatcher, org.springframework.jdbc.core.JdbcTemplate jdbc, com.eqms.repository.UserAccountRepository users) {
        this.dispatcher = dispatcher;
        this.jdbc = jdbc;
        this.users = users;
    }

    /** The people the audited record names (the requester of a copy), without the person who acted. */
    private List<UserAccount> recordPeople(AuditNotificationEvents.Event event, AuditedAction action) {
        if (event.contextSql() == null || action.entityId() == null || jdbc == null || users == null) return List.of();
        try {
            // a query names the record once or more: the id is given for each place
            long places = event.contextSql().chars().filter(c -> c == '?').count();
            Object[] arguments = java.util.Collections.nCopies((int) places, action.entityId()).toArray();
            List<UUID> ids = jdbc.queryForList(event.contextSql(), UUID.class, arguments);
            UUID actorId = action.actor() == null ? null : action.actor().getId();
            return users.findAllById(ids.stream().filter(java.util.Objects::nonNull).filter(id -> !id.equals(actorId)).toList());
        } catch (RuntimeException failure) {
            log.debug("The people of the record {} could not be read: {}", action.entityId(), failure.getMessage());
            return List.of();
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAuditedAction(AuditedAction action) {
        try {
            for (AuditNotificationEvents.Event event : AuditNotificationEvents.forAction(action.entityType(), action.actionType())) {
                try {
                    notify(event, action);
                } catch (RuntimeException failure) {
                    log.warn("The notification {} of the action {} could not be sent: {}", event.code(), action.actionType(), failure.getMessage());
                }
            }
        } catch (RuntimeException failure) {
            log.warn("The notification of the action {} could not be sent: {}", action.actionType(), failure.getMessage());
        }
    }

    /** The action in words ("REPORT_TEMPLATE_DISABLED" as "Report template disabled"), so that the title says what happened; the name of the event when there is none. */
    static String titleOf(String actionType, String fallback) {
        if (!StringUtils.hasText(actionType)) return fallback;
        String words = actionType.trim().toLowerCase(java.util.Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(words.charAt(0)) + words.substring(1);
    }

    private void notify(AuditNotificationEvents.Event event, AuditedAction action) {
        String actor = action.actor() == null ? "The system" : StringUtils.hasText(action.actor().getFullName()) ? action.actor().getFullName() : String.valueOf(action.actor().getUsername());
        String what = StringUtils.hasText(action.entityName()) ? action.entityName() : "";
        // the Audit Trail keeps the number of the signature at the end of the comment as evidence; the person told needs the reason only
        String comment = StringUtils.hasText(action.comment()) ? action.comment().replaceAll("\\s*\\[signature [^\\]]*\\]\\s*$", "").trim() : "";
        String message = actor + (what.isEmpty() ? "" : " - " + what) + (comment.isEmpty() ? "" : ": " + comment);
        String actionName = titleOf(action.actionType(), event.name());
        Map<String, String> variables = NotificationDispatcher.noticeVariables(actionName, message.length() > 480 ? message.substring(0, 477) + "..." : message, event.actionUrl());
        variables.put("actorName", actor);
        variables.put("entityName", what);
        // the wording of these events is stored with the placeholders below (the in-app message holds 500 characters), so a long comment is cut here
        variables.put("actionName", actionName);
        variables.put("actionComment", comment.length() > 300 ? comment.substring(0, 297) + "..." : comment);
        // the person who acted is the one the rule ACTOR names (the person whose session it was, for a possible theft); the audiences are found by the dispatcher
        java.util.LinkedHashMap<UUID, UserAccount> context = new java.util.LinkedHashMap<>();
        // an event that names the people of the record (the requester) tells them, not the person who acted; the others tell the person who acted too (the rule ACTOR)
        if (event.contextSql() == null && action.actor() != null && action.actor().getId() != null) context.put(action.actor().getId(), action.actor());
        recordPeople(event, action).forEach(person -> context.putIfAbsent(person.getId(), person));
        dispatcher.dispatchIndependently(event.code(), new java.util.ArrayList<>(context.values()), variables);
    }
}
