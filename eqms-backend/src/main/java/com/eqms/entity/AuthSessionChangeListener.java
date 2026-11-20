package com.eqms.entity;

import com.eqms.service.UserSessionBroadcaster;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostUpdate;

/**
 * Announces (after commit, to the people who may see "Logged in Users") when a session starts, ends, is locked or is
 * unlocked. A save that only moves the time of the last activity (every token refresh) is not announced: the rows
 * on screen would not change, and the "Online" flag, which depends on the clock, is refreshed by the screen's own timer.
 */
public class AuthSessionChangeListener {

    @PostLoad
    public void remember(AuthSession session) {
        session.rememberStateForChangeDetection();
    }

    @PostPersist
    public void onCreate(AuthSession session) {
        session.rememberStateForChangeDetection();
        UserSessionBroadcaster.changed(session.getId());
    }

    @PostUpdate
    public void onUpdate(AuthSession session) {
        boolean changed = session.stateChangedSinceRemembered();
        session.rememberStateForChangeDetection();
        if (changed) UserSessionBroadcaster.changed(session.getId());
    }
}
