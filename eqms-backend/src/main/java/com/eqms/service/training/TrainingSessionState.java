package com.eqms.service.training;

import java.util.Map;

/**
 * A session has no "held" state. It is planned, postponed or cancelled; it has started when it has the day it was conducted ({@code held_on}), set by its first action in the
 * workspace. Every rule that asks "did the training start" reads the day.
 */
public final class TrainingSessionState {

    private TrainingSessionState() {
    }

    /** The row of {@code training_sessions} has started (its first action was done). */
    public static boolean started(Map<String, Object> session) {
        return "PLANNED".equals(session.get("status")) && session.get("held_on") != null;
    }

    /** The row of {@code training_sessions} is planned and nothing was done in it yet. */
    public static boolean notStarted(Map<String, Object> session) {
        return "PLANNED".equals(session.get("status")) && session.get("held_on") == null;
    }
}
