package com.eqms.service;

import com.eqms.entity.EmailTemplate;
import com.eqms.entity.SystemConfiguration;
import com.eqms.dto.user.SmtpConnectionTestRequest;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    private final SystemConfigurationService systemConfigurationService;
    private final EmailTemplateService emailTemplateService;

    /**
     * {@link #sendTemplateEmail}/{@link #sendRenderedEmail} used to build a brand-new {@link
     * JavaMailSenderImpl} (and therefore open a fresh SMTP connection) on every single send --
     * fine for one-off admin actions, but a real bottleneck for a burst (ALL_USERS notification,
     * batch controlled-copy distribution). Caching by a hash of the *current* SMTP config means
     * a config change (admin saves new host/port/creds) is picked up automatically on the very
     * next send -- no separate cache-invalidation hook needed.
     */
    private final AtomicReference<CachedSender> cachedSender = new AtomicReference<>();

    private record CachedSender(String configHash, JavaMailSenderImpl sender) {}

    public EmailService(
            SystemConfigurationService systemConfigurationService,
            EmailTemplateService emailTemplateService
    ) {
        this.systemConfigurationService = systemConfigurationService;
        this.emailTemplateService = emailTemplateService;
    }

    /**
     * Build (or reuse a cached) JavaMailSender based on current configurations stored in the
     * system_configurations table. The underlying JavaMail {@code Session} is reused across
     * sends via {@code mail.smtp.connectionpoolsize}, so repeated sends against the same SMTP
     * config avoid a fresh TCP+TLS handshake each time.
     */
    private JavaMailSender getMailSender(JsonNode emailConfig) {
        String hash = configHash(emailConfig);
        CachedSender current = cachedSender.get();
        if (current != null && current.configHash().equals(hash)) {
            return current.sender();
        }
        JavaMailSenderImpl mailSender = buildMailSender(emailConfig);
        cachedSender.set(new CachedSender(hash, mailSender));
        return mailSender;
    }

    private String configHash(JsonNode emailConfig) {
        return emailConfig.path("smtpHost").asText("") + '|'
                + emailConfig.path("smtpPort").asInt(0) + '|'
                + emailConfig.path("smtpUsername").asText("") + '|'
                + emailConfig.path("smtpPassword").asText("") + '|'
                + emailConfig.path("useSSL").asBoolean(true);
    }

    private JavaMailSenderImpl buildMailSender(JsonNode emailConfig) {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(emailConfig.path("smtpHost").asText("smtp.gmail.com"));
        mailSender.setPort(emailConfig.path("smtpPort").asInt(587));
        mailSender.setUsername(emailConfig.path("smtpUsername").asText(""));
        mailSender.setPassword(emailConfig.path("smtpPassword").asText(""));

        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        // AUTH must not be forced when no credentials are configured -- a blank
        // username/password against a relay that doesn't implement authentication at all (e.g.
        // MailHog, many internal relays) makes JavaMail send AUTH anyway and get rejected, which
        // looks identical to a real credentials error in the logs (found while live-verifying
        // Phase 3 against a local MailHog catcher).
        props.put("mail.smtp.auth", StringUtils.hasText(emailConfig.path("smtpUsername").asText("")) ? "true" : "false");
        props.put("mail.smtp.connectionpoolsize", "5");
        props.put("mail.smtp.connectiontimeout", "10000");
        props.put("mail.smtp.timeout", "10000");
        props.put("mail.smtp.writetimeout", "10000");

        boolean useSSL = emailConfig.path("useSSL").asBoolean(true);
        if (useSSL) {
            if (mailSender.getPort() == 465) {
                props.put("mail.smtp.ssl.enable", "true");
                props.put("mail.smtp.socketFactory.port", "465");
                props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
                props.put("mail.smtp.socketFactory.fallback", "false");
            } else {
                props.put("mail.smtp.starttls.enable", "true");
                props.put("mail.smtp.starttls.required", "true");
            }
        }
        return mailSender;
    }

    /**
     * Send email using a database-managed template.
     */
    public void sendEmail(String to, String templateName, Map<String, String> variables) {
        try {
            // Fetch template
            EmailTemplate template = emailTemplateService.getTemplateEntityByName(templateName);
            sendTemplateEmail(to, template, variables, true, false);

        } catch (Exception e) {
            logger.error("Failed to send email template '{}' to {}: {}", templateName, to, e.getMessage(), e);
        }
    }

    public boolean sendTemplateEmail(String to, EmailTemplate template, Map<String, String> variables, boolean countUsage, boolean allowInactive) throws Exception {
        SystemConfiguration config = systemConfigurationService.requireConfiguration();
        JsonNode notifications = config.getNotificationsConfig();
        if (notifications == null || !notifications.path("enableEmailNotifications").asBoolean(false)) {
            logger.info("Email notifications are disabled. Skipping dispatch of '{}' to {}", template.getName(), to);
            return false;
        }

        JsonNode emailConfig = notifications.path("emailConfig");
        if (emailConfig.isMissingNode() || emailConfig.path("smtpHost").asText("").isBlank()) {
            logger.warn("SMTP host is not configured. Skipping dispatch of '{}' to {}", template.getName(), to);
            return false;
        }

        if (!allowInactive && !"Active".equalsIgnoreCase(template.getStatus())) {
            logger.warn("Email template '{}' is inactive. Skipping dispatch to {}", template.getName(), to);
            return false;
        }

        String populatedSubject = emailTemplateService.renderTemplateText(template.getSubject(), variables);
        String populatedBody = emailTemplateService.renderTemplateContent(template, variables);

        JavaMailSender mailSender = getMailSender(emailConfig);

        String senderEmail = emailConfig.path("senderEmail").asText("noreply@example.com");
        String senderName = emailConfig.path("senderName").asText("EQMS Notification");

        if (("admin@eqms.com".equalsIgnoreCase(to) || "admin@example.com".equalsIgnoreCase(to))
                && !"noreply@example.com".equalsIgnoreCase(senderEmail) && !senderEmail.isBlank()) {
            to = senderEmail;
        }

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setTo(to);
        helper.setSubject(populatedSubject);
        helper.setText(populatedBody, true);
        helper.setFrom(senderEmail, senderName);

        mailSender.send(message);

        if (countUsage) {
            emailTemplateService.incrementUsage(template);
        }

        logger.info("Email '{}' successfully sent to {}", template.getName(), to);
        return true;
    }

    /**
     * Sends an already-rendered subject/body pair with no {@link EmailTemplate} dependency --
     * used by {@link NotificationDispatcher} for policy-driven EMAIL-channel sends, where the
     * content comes from a {@code NotificationTemplateVersion} row, not the legacy Email
     * Templates feature. Shares the same SMTP-config/enabled checks as {@link
     * #sendTemplateEmail}.
     */
    public boolean sendRenderedEmail(String to, String subject, String htmlBody) throws Exception {
        SystemConfiguration config = systemConfigurationService.requireConfiguration();
        JsonNode notifications = config.getNotificationsConfig();
        if (notifications == null || !notifications.path("enableEmailNotifications").asBoolean(false)) {
            logger.info("Email notifications are disabled. Skipping policy-driven send to {}", to);
            return false;
        }

        JsonNode emailConfig = notifications.path("emailConfig");
        if (emailConfig.isMissingNode() || emailConfig.path("smtpHost").asText("").isBlank()) {
            logger.warn("SMTP host is not configured. Skipping policy-driven send to {}", to);
            return false;
        }

        JavaMailSender mailSender = getMailSender(emailConfig);
        String senderEmail = emailConfig.path("senderEmail").asText("noreply@example.com");
        String senderName = emailConfig.path("senderName").asText("EQMS Notification");

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        helper.setFrom(senderEmail, senderName);
        mailSender.send(message);

        logger.info("Policy-driven email successfully sent to {}", to);
        return true;
    }

    /**
     * Same as {@link #sendTemplateEmail} but with a single binary attachment (e.g. a ZIP of
     * controlled copy PDFs for the DCO-redirected batch delivery flow).
     */
    public boolean sendTemplateEmailWithAttachment(String to, EmailTemplate template, Map<String, String> variables, String attachmentFileName, byte[] attachmentBytes) throws Exception {
        SystemConfiguration config = systemConfigurationService.requireConfiguration();
        JsonNode notifications = config.getNotificationsConfig();
        if (notifications == null || !notifications.path("enableEmailNotifications").asBoolean(false)) {
            logger.info("Email notifications are disabled. Skipping dispatch of '{}' to {}", template.getName(), to);
            return false;
        }

        JsonNode emailConfig = notifications.path("emailConfig");
        if (emailConfig.isMissingNode() || emailConfig.path("smtpHost").asText("").isBlank()) {
            logger.warn("SMTP host is not configured. Skipping dispatch of '{}' to {}", template.getName(), to);
            return false;
        }

        String populatedSubject = emailTemplateService.renderTemplateText(template.getSubject(), variables);
        String populatedBody = emailTemplateService.renderTemplateContent(template, variables);

        JavaMailSender mailSender = getMailSender(emailConfig);
        String senderEmail = emailConfig.path("senderEmail").asText("noreply@example.com");
        String senderName = emailConfig.path("senderName").asText("EQMS Notification");

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(to);
        helper.setSubject(populatedSubject);
        helper.setText(populatedBody, true);
        helper.setFrom(senderEmail, senderName);
        if (attachmentBytes != null && attachmentBytes.length > 0 && StringUtils.hasText(attachmentFileName)) {
            helper.addAttachment(attachmentFileName, new org.springframework.core.io.ByteArrayResource(attachmentBytes));
        }
        mailSender.send(message);

        emailTemplateService.incrementUsage(template);
        logger.info("Email '{}' with attachment successfully sent to {}", template.getName(), to);
        return true;
    }

    /**
     * Test the SMTP connection using custom settings (for config testing).
     */
    public void testConnection(SmtpConnectionTestRequest request) throws Exception {
        JsonNode emailConfig = new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode()
                .put("smtpHost", request.smtpHost())
                .put("smtpPort", request.smtpPort())
                .put("smtpUsername", request.smtpUsername())
                .put("smtpPassword", request.smtpPassword())
                .put("senderEmail", request.senderEmail())
                .put("senderName", request.senderName())
                .put("useSSL", request.useSSL());

        // Bypass the send cache -- an ad-hoc test config must never evict/pollute the cached
        // sender built from the actually-saved SMTP config.
        JavaMailSender mailSender = buildMailSender(emailConfig);
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setTo(request.senderEmail());
        helper.setSubject("EQMS SMTP Test Connection");
        helper.setText("<h3>SMTP Connection Test Successful</h3><p>This is a test email sent from EQMS System Configuration.</p>", true);
        helper.setFrom(request.senderEmail(), request.senderName());

        mailSender.send(message);
    }
}
