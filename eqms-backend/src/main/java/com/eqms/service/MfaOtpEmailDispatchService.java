package com.eqms.service;

import com.eqms.event.MfaOtpEmailRequestedEvent;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Delivers MFA codes outside the authentication request, after the OTP is valid in the database.
 */
@Service
public class MfaOtpEmailDispatchService {

    private final EmailService emailService;

    public MfaOtpEmailDispatchService(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async("mfaEmailExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void dispatch(MfaOtpEmailRequestedEvent event) {
        emailService.sendEmail(event.recipientEmail(), "MFA OTP Login Code", event.variables());
    }
}
