package com.eqms.dto.notification;

/**
 * One placeholder: the token to copy, what it stands for, an example of what it becomes and the module whose senders fill it in
 * (null where the module is not known).
 */
public record NotificationVariableResponse(String name, String token, String label, String sample, String module) {

    public NotificationVariableResponse(String name, String token, String label, String sample) {
        this(name, token, label, sample, null);
    }
}
