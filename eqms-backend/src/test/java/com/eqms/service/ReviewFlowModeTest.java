package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class ReviewFlowModeTest {

    @Test
    void frozenModeDecidesSequenceForReviewers() {
        assertEquals(Boolean.TRUE, ReviewFlowMode.sequenceEnforcedOrNull("REVIEWER", ReviewFlowMode.SEQUENTIAL));
        assertEquals(Boolean.FALSE, ReviewFlowMode.sequenceEnforcedOrNull("REVIEWER", ReviewFlowMode.PARALLEL));
    }

    @Test
    void fallsBackToLiveConfigWhenNothingIsFrozenOrNotReviewer() {
        assertNull(ReviewFlowMode.sequenceEnforcedOrNull("REVIEWER", null));
        assertNull(ReviewFlowMode.sequenceEnforcedOrNull("REVIEWER", " "));
        assertNull(ReviewFlowMode.sequenceEnforcedOrNull("APPROVER", ReviewFlowMode.PARALLEL));
    }

    @Test
    void ofMapsConfigFlag() {
        assertEquals(ReviewFlowMode.PARALLEL, ReviewFlowMode.of(true));
        assertEquals(ReviewFlowMode.SEQUENTIAL, ReviewFlowMode.of(false));
    }
}
