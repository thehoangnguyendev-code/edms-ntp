package com.eqms.service;

import com.eqms.event.AsyncEmailRequestedEvent;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Delivers auth emails (password reset links, MFA setup verification codes) outside the
 * originating request, after the relevant DB row (token/OTP) is committed. Mirrors {@link
 * MfaOtpEmailDispatchService} — kept as a separate listener so it can be reused by any caller
 * without depending on the MFA-login-specific event shape.
 */
@Service
public class AsyncEmailDispatchService {

    private final EmailService emailService;

    public AsyncEmailDispatchService(EmailService emailService) {
        this.emailService = emailService;
    }

    @Async("mfaEmailExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void dispatch(AsyncEmailRequestedEvent event) {
        emailService.sendEmail(event.recipientEmail(), event.subject(), event.variables());
    }
}
