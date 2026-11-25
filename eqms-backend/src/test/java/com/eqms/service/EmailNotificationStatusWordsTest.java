package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

/** An e-mail shows the words of a status and of an action (Ready for Publishing, Review Completed), never the code (READY_FOR_PUBLISHING, REVIEW_COMPLETE). */
class EmailNotificationStatusWordsTest {

    private static String call(String name, Class<?>[] types, Object... args) throws Exception {
        Method method = EmailNotificationService.class.getDeclaredMethod(name, types);
        method.setAccessible(true);
        return (String) method.invoke(null, args);
    }

    private static String status(String label, String code) throws Exception {
        return call("statusWords", new Class<?>[]{String.class, String.class}, label, code);
    }

    private static String copyStatus(String stored) throws Exception {
        return call("controlledCopyStatusWords", new Class<?>[]{String.class}, stored);
    }

    private static String action(String code) throws Exception {
        return call("humanizeWorkflowAction", new Class<?>[]{String.class}, code);
    }

    @Test
    void aStatusIsShownWithItsLabelAndTheCodeBecomesWordsOnlyAsALastResort() throws Exception {
        assertEquals("Ready for Publishing", status("Ready for Publishing", "READY_FOR_PUBLISHING"));
        assertEquals("Pending Review", status(null, "PENDING_REVIEW"));
        assertEquals("Pending Approval", status(" ", "PENDING_APPROVAL"));
        assertEquals("", status(null, null));
    }

    @Test
    void theStatusOfAControlledCopyIsAlwaysALabelEvenForTheOlderRowsThatStoreTheCode() throws Exception {
        assertEquals("Closed - Cancelled", copyStatus("CLOSED_CANCELLED"));
        assertEquals("Closed - Cancelled", copyStatus("Closed - Cancelled"));
        assertEquals("Obsoleted", copyStatus("OBSOLETED"));
        assertEquals("Ready for Distribution", copyStatus("READY_FOR_DISTRIBUTION"));
        assertEquals("Distributed", copyStatus("Distributed"));
        assertEquals("", copyStatus(null));
    }

    @Test
    void theActionOfADocumentWorkflowIsWordsAndAnActionThatIsAlreadyWordsIsNotChanged() throws Exception {
        assertEquals("Review Completed", action("REVIEW_COMPLETE"));
        assertEquals("Approval Completed", action("APPROVE_COMPLETE"));
        assertEquals("Submitted for Review", action("SUBMIT_FOR_REVIEW"));
        assertEquals("Training Completed", action("TRAINING_COMPLETE"));
        assertEquals("Edit Online", action("Edit Online"));
        assertEquals("Some New Action", action("SOME_NEW_ACTION"));
    }
}
