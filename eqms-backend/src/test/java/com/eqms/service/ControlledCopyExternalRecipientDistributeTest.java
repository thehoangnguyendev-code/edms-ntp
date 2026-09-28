package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Regression: distribute() used to resolve the "distributedTo" string against internal user
 * accounts (by username/full name/e-mail) even for EXTERNAL distributions. If an external
 * recipient's e-mail happened to match an unrelated internal account (e.g. a shared test
 * mailbox), the copy's recipientUser/recipientName got silently hijacked to that internal
 * account -- so notification e-mails (subject/greeting/preview link) went to the wrong inbox
 * instead of the actual external recipient. isExternalDistribution() must recognize every shape
 * an external copy can take so distribute()/distributeControlledCopyBatch() skip that lookup.
 */
class ControlledCopyExternalRecipientDistributeTest {

    private final ControlledCopyService service = org.mockito.Mockito.mock(ControlledCopyService.class);

    private boolean isExternal(ControlledCopyRecord copy) {
        return ReflectionTestUtils.invokeMethod(service, "isExternalDistribution", copy);
    }

    @Test
    void detectsExternalRecipientsField() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setExternalRecipients("someone@example.com");
        assertTrue(isExternal(copy));
    }

    @Test
    void detectsExternalDistributionScope() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setDistributionScope("external");
        assertTrue(isExternal(copy));
    }

    @Test
    void detectsExternalDistributionMode() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setDistributionMode("EXTERNAL");
        assertTrue(isExternal(copy));
    }

    @Test
    void internalCopyIsNotFlaggedExternal() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setDistributionScope("business-unit");
        copy.setDistributionMode("INTERNAL");
        assertFalse(isExternal(copy));
    }

    @Test
    void nullCopyIsNotExternal() {
        assertFalse(isExternal(null));
    }
}
