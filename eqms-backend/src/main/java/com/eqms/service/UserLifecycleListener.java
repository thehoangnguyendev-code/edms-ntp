package com.eqms.service;

import java.util.UUID;

/**
 * A module that has to know when the record of a person changes in a way that matters to it (a new account, a suspension, a reinstatement, a move to another department or position,
 * a start date). It is called after the change is committed, and a failure of a listener never undoes or hides the change.
 */
public interface UserLifecycleListener {
    /** @param change CREATED, SUSPENDED, REINSTATED, DEPARTMENT_CHANGED, POSITION_CHANGED or START_DATE_CHANGED */
    void userChanged(UUID userId, String change);
}
