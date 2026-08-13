package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.email.EmailTemplatePreviewResponse;
import com.eqms.dto.email.EmailTemplatePreviewDraftRequest;
import com.eqms.dto.email.EmailTemplatePublishRequest;
import com.eqms.dto.email.EmailTemplateRequest;
import com.eqms.dto.email.EmailTemplateResponse;
import com.eqms.dto.email.EmailTemplateRestoreVersionRequest;
import com.eqms.dto.email.EmailTemplateTestSendResponse;
import com.eqms.dto.email.EmailTemplateVersionResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.EmailTemplate;
import com.eqms.entity.EmailTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.repository.EmailTemplateRepository;
import com.eqms.repository.EmailTemplateVersionRepository;
import com.eqms.util.EmailTemplateTypeUtils;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.criteria.Predicate;
import org.jsoup.Jsoup;
import org.jsoup.safety.Safelist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.context.i18n.LocaleContextHolder;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.MissingResourceException;
import java.util.ResourceBundle;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EmailTemplateService {

    private static final String ACTION_EMAIL_TEMPLATE_CREATED = "EMAIL_TEMPLATE_CREATED";
    private static final String ACTION_EMAIL_TEMPLATE_UPDATED = "EMAIL_TEMPLATE_UPDATED";
    private static final String ACTION_EMAIL_TEMPLATE_DELETED = "EMAIL_TEMPLATE_DELETED";
    private static final String ACTION_EMAIL_TEMPLATE_DUPLICATED = "EMAIL_TEMPLATE_DUPLICATED";
    private static final String ACTION_EMAIL_TEMPLATE_STATUS_TOGGLED = "EMAIL_TEMPLATE_STATUS_TOGGLED";
    private static final String ACTION_EMAIL_TEMPLATE_TEST_SENT = "EMAIL_TEMPLATE_TEST_SENT";
    private static final String ACTION_EMAIL_TEMPLATE_PUBLISHED = "EMAIL_TEMPLATE_PUBLISHED";
    private static final String ACTION_EMAIL_TEMPLATE_VERSION_RESTORED = "EMAIL_TEMPLATE_VERSION_RESTORED";

    private static final ZoneId SYSTEM_ZONE = ZoneId.systemDefault();
    private static final DateTimeFormatter DMY_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final EmailTemplateRepository repository;
    private final EmailTemplateVersionRepository versionRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;

    public EmailTemplateService(
            EmailTemplateRepository repository,
            EmailTemplateVersionRepository versionRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService
    ) {
        this.repository = repository;
        this.versionRepository = versionRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
    }

    @Transactional(readOnly = true)
    public PageResponse<EmailTemplateResponse> listTemplates(
            String search,
            String type,
            String status,
            String createdFrom,
            String createdTo,
            String updatedFrom,
            String updatedTo,
            String sortBy,
            String sortDirection,
            int page,
            int limit
    ) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        String sortProperty = resolveSortProperty(sortBy);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;

        Page<EmailTemplate> result = repository.findAll(
                buildSpecification(search, type, status, createdFrom, createdTo, updatedFrom, updatedTo),
                PageRequest.of(safePage - 1, safeLimit, Sort.by(direction, sortProperty))
        );

        return new PageResponse<>(
                result.getContent().stream().map(this::toResponse).collect(Collectors.toList()),
                new PaginationResponse(
                        safePage,
                        safeLimit,
                        result.getTotalElements(),
                        result.getTotalPages()
                )
        );
    }

    @Transactional(readOnly = true)
    public List<EmailTemplateResponse> exportTemplates(
            String search,
            String type,
            String status,
            String createdFrom,
            String createdTo,
            String updatedFrom,
            String updatedTo,
            String sortBy,
            String sortDirection
    ) {
        String sortProperty = resolveSortProperty(sortBy);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;

        return repository.findAll(
                        buildSpecification(search, type, status, createdFrom, createdTo, updatedFrom, updatedTo),
                        Sort.by(direction, sortProperty)
                ).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EmailTemplateResponse getTemplateById(UUID id) {
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));
        return toResponse(template);
    }

    @Transactional(readOnly = true)
    public EmailTemplate getTemplateEntityById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));
    }

    @Transactional(readOnly = true)
    public EmailTemplate getTemplateEntityByName(String name) {
        return repository.findByName(name)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + name));
    }

    @Transactional
    public EmailTemplateResponse createTemplate(EmailTemplateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = new EmailTemplate();
        template.setName(request.name());
        template.setType(normalizeTemplateType(request.type()));
        template.setSubject(request.subject());
        template.setContent(request.content());
        template.setStatus(request.status());
        template.setDescription(request.description());
        template.setLogoUrl(normalizeOptional(request.logoUrl()));
        template.setLogoFileName(normalizeOptional(request.logoFileName()));
        template.setCopyright(normalizeOptional(request.copyright()));
        template.setContactEmail(normalizeOptional(request.contactEmail()));
        template.setPrimaryColor(normalizeOptional(request.primaryColor()));
        template.setVariablesList(resolveVariables(request.variables(), request.subject(), request.content()));
        template.setCreatedBy(currentUser.getFullName());
        template.setUpdatedBy(currentUser.getFullName());

        EmailTemplate saved = repository.save(template);
        createVersionSnapshot(saved, "Created template", currentUser, null, null);
        String reason = request.reason();
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                saved.getName(),
                saved.getId(),
                ACTION_EMAIL_TEMPLATE_CREATED,
                null,
                saved.getStatus(),
                (reason != null && !reason.isBlank())
                        ? "Created email template: " + reason
                        : "Created email template"
        );
        return toResponse(saved);
    }

    @Transactional
    public EmailTemplateResponse updateTemplate(UUID id, EmailTemplateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));

        String previousStatus = template.getStatus();
        template.setName(request.name());
        template.setType(normalizeTemplateType(request.type()));
        template.setSubject(request.subject());
        template.setContent(request.content());
        template.setStatus(request.status());
        template.setDescription(request.description());
        template.setLogoUrl(normalizeOptional(request.logoUrl()));
        template.setLogoFileName(normalizeOptional(request.logoFileName()));
        template.setCopyright(normalizeOptional(request.copyright()));
        template.setContactEmail(normalizeOptional(request.contactEmail()));
        template.setPrimaryColor(normalizeOptional(request.primaryColor()));
        template.setVariablesList(resolveVariables(request.variables(), request.subject(), request.content()));
        template.setUpdatedBy(currentUser.getFullName());

        EmailTemplate saved = repository.save(template);
        createVersionSnapshot(saved, "Updated template", currentUser, null, null);
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                saved.getName(),
                saved.getId(),
                ACTION_EMAIL_TEMPLATE_UPDATED,
                previousStatus,
                saved.getStatus(),
                "Updated email template"
        );
        return toResponse(saved);
    }

    @Transactional
    public void deleteTemplate(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));
        repository.delete(template);
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                template.getName(),
                template.getId(),
                ACTION_EMAIL_TEMPLATE_DELETED,
                template.getStatus(),
                null,
                "Deleted email template"
        );
    }

    @Transactional
    public EmailTemplateResponse duplicateTemplate(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));

        EmailTemplate duplicate = new EmailTemplate();
        duplicate.setName(template.getName() + " (Copy)");
        duplicate.setType(template.getType());
        duplicate.setSubject(template.getSubject());
        duplicate.setContent(template.getContent());
        duplicate.setStatus("Draft");
        duplicate.setDescription(template.getDescription());
        duplicate.setLogoUrl(template.getLogoUrl());
        duplicate.setLogoFileName(template.getLogoFileName());
        duplicate.setCopyright(template.getCopyright());
        duplicate.setContactEmail(template.getContactEmail());
        duplicate.setPrimaryColor(template.getPrimaryColor());
        duplicate.setVariables(template.getVariables());
        duplicate.setCreatedBy(currentUser.getFullName());
        duplicate.setUpdatedBy(currentUser.getFullName());

        EmailTemplate saved = repository.save(duplicate);
        createVersionSnapshot(saved, "Duplicated from template: " + template.getName(), currentUser, null, null);
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                saved.getName(),
                saved.getId(),
                ACTION_EMAIL_TEMPLATE_DUPLICATED,
                template.getStatus(),
                saved.getStatus(),
                "Duplicated from template: " + template.getName()
        );
        return toResponse(saved);
    }

    @Transactional
    public EmailTemplateResponse toggleStatus(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));

        String previousStatus = template.getStatus();
        String newStatus = "Active".equalsIgnoreCase(template.getStatus()) ? "Inactive" : "Active";
        template.setStatus(newStatus);
        template.setUpdatedBy(currentUser.getFullName());

        EmailTemplate saved = repository.save(template);
        createVersionSnapshot(saved, "Status changed to " + newStatus, currentUser, null, null);
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                saved.getName(),
                saved.getId(),
                ACTION_EMAIL_TEMPLATE_STATUS_TOGGLED,
                previousStatus,
                newStatus,
                "Template status toggled"
        );
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public EmailTemplatePreviewResponse previewTemplate(UUID id, Map<String, String> variables) {
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));
        return previewTemplate(template, variables);
    }

    @Transactional(readOnly = true)
    public EmailTemplatePreviewResponse previewDraft(EmailTemplatePreviewDraftRequest request) {
        EmailTemplate template = new EmailTemplate();
        template.setName(request.name());
        template.setType(request.type());
        template.setSubject(request.subject());
        template.setContent(request.content());
        template.setStatus(request.status());
        template.setDescription(request.description());
        template.setLogoUrl(normalizeOptional(request.logoUrl()));
        template.setLogoFileName(normalizeOptional(request.logoFileName()));
        template.setCopyright(normalizeOptional(request.copyright()));
        template.setContactEmail(normalizeOptional(request.contactEmail()));
        template.setPrimaryColor(normalizeOptional(request.primaryColor()));
        template.setVariablesList(resolveVariables(request.variables(), request.subject(), request.content()));
        return previewTemplate(template, request.sampleVariables() == null ? Map.of() : request.sampleVariables());
    }

    @Transactional(readOnly = true)
    public EmailTemplatePreviewResponse previewTemplate(EmailTemplate template, Map<String, String> variables) {
        return new EmailTemplatePreviewResponse(
                template.getId(),
                template.getName(),
                template.getType(),
                renderTemplateText(template.getSubject(), variables),
                renderTemplateContent(template, variables),
                template.getStatus(),
                template.getVariablesList(),
                template.getDescription(),
                template.getLogoUrl(),
                template.getLogoFileName(),
                template.getCopyright(),
                template.getContactEmail(),
                template.getPrimaryColor(),
                template.getUsageCount(),
                template.getLastUsed() != null ? template.getLastUsed().toString() : null,
                template.getCreatedDate() != null ? template.getCreatedDate().toString() : null,
                template.getUpdatedDate() != null ? template.getUpdatedDate().toString() : null,
                template.getCreatedBy(),
                template.getUpdatedBy(),
                versionRepository.findTopByTemplateIdOrderByVersionNumberDesc(template.getId())
                        .map(EmailTemplateVersion::getVersionNumber)
                        .orElse(0)
        );
    }

    @Transactional
    public EmailTemplateTestSendResponse recordTestSend(UUID id, String to) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                template.getName(),
                template.getId(),
                ACTION_EMAIL_TEMPLATE_TEST_SENT,
                template.getStatus(),
                template.getStatus(),
                "Test email sent to " + to
        );
        return new EmailTemplateTestSendResponse(true, localizedMessage("email_template.test_send_success"), template.getId(), template.getName(), to, Instant.now());
    }

    @Transactional(readOnly = true)
    public List<EmailTemplateVersionResponse> getVersionHistory(UUID templateId) {
        return versionRepository.findByTemplateIdOrderByVersionNumberDesc(templateId).stream()
                .map(this::toVersionResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public EmailTemplateResponse publishTemplate(UUID id, EmailTemplatePublishRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + id));
        String previousStatus = template.getStatus();
        template.setStatus("Active");
        template.setUpdatedBy(currentUser.getFullName());
        EmailTemplate saved = repository.save(template);
        String publishSummary = request != null && normalizeOptional(request.changeSummary()) != null
                ? request.changeSummary()
                : "Published template";
        createVersionSnapshot(saved, publishSummary, currentUser, Instant.now(), currentUser.getFullName());
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                saved.getName(),
                saved.getId(),
                ACTION_EMAIL_TEMPLATE_PUBLISHED,
                previousStatus,
                saved.getStatus(),
                "Published email template"
        );
        return toResponse(saved);
    }

    @Transactional
    public EmailTemplateResponse restoreVersion(UUID templateId, UUID versionId, EmailTemplateRestoreVersionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(templateId)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + templateId));
        EmailTemplateVersion version = versionRepository.findByIdAndTemplateId(versionId, templateId)
                .orElseThrow(() -> new EntityNotFoundException("Email template version not found: " + versionId));

        String previousStatus = template.getStatus();
        template.setName(version.getName());
        template.setType(version.getType());
        template.setSubject(version.getSubject());
        template.setContent(version.getContent());
        template.setStatus("Draft");
        template.setDescription(version.getDescription());
        template.setLogoUrl(version.getLogoUrl());
        template.setLogoFileName(version.getLogoFileName());
        template.setCopyright(version.getCopyright());
        template.setContactEmail(version.getContactEmail());
        template.setPrimaryColor(version.getPrimaryColor());
        template.setVariables(version.getVariables());
        template.setUpdatedBy(currentUser.getFullName());

        EmailTemplate saved = repository.save(template);
        String restoreSummary = request != null && normalizeOptional(request.changeSummary()) != null
                ? request.changeSummary()
                : "Restored version " + version.getVersionNumber();
        createVersionSnapshot(saved, restoreSummary, currentUser, null, null);
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                saved.getName(),
                saved.getId(),
                ACTION_EMAIL_TEMPLATE_VERSION_RESTORED,
                previousStatus,
                saved.getStatus(),
                "Restored email template version " + version.getVersionNumber()
        );
        return toResponse(saved);
    }

    @Transactional
    public void incrementUsage(EmailTemplate template) {
        template.setUsageCount(template.getUsageCount() + 1);
        template.setLastUsed(Instant.now());
        repository.save(template);
    }

    private Specification<EmailTemplate> buildSpecification(
            String search,
            String type,
            String status,
            String createdFrom,
            String createdTo,
            String updatedFrom,
            String updatedTo
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(search)) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("subject")), like),
                        cb.like(cb.lower(root.get("description")), like),
                        cb.like(cb.lower(root.get("createdBy")), like),
                        cb.like(cb.lower(root.get("updatedBy")), like)
                ));
            }

            if (StringUtils.hasText(type) && !"All".equalsIgnoreCase(type)) {
                predicates.add(cb.equal(cb.lower(root.get("type")), type.trim().toLowerCase()));
            }

            if (StringUtils.hasText(status) && !"All".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.trim().toLowerCase()));
            }

            addDateRangePredicate(predicates, cb, root.get("createdDate"), createdFrom, createdTo);
            addDateRangePredicate(predicates, cb, root.get("updatedDate"), updatedFrom, updatedTo);

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public String renderTemplateText(String content, Map<String, String> variables) {
        if (content == null || content.isBlank() || variables == null || variables.isEmpty()) {
            return content;
        }
        String result = content;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            String value = entry.getValue() != null ? entry.getValue() : "";
            result = result.replace("{{" + entry.getKey() + "}}", value);
            result = result.replace("{" + entry.getKey() + "}", value);
        }
        return result.replaceAll("\\{\\{\\s*[a-zA-Z0-9_]+\\s*\\}\\}", "");
    }

    public String renderTemplateContent(EmailTemplate template, Map<String, String> variables) {
        String renderedContent = renderTemplateText(template.getContent(), variables);
        renderedContent = sanitizeRenderedHtml(renderedContent);

        String brandColor = (template.getPrimaryColor() != null && !template.getPrimaryColor().isBlank())
                ? template.getPrimaryColor()
                : "#059669";

        String copyright = template.getCopyright() != null ? template.getCopyright().trim() : "";
        String contactEmail = template.getContactEmail() != null ? template.getContactEmail().trim() : "";
        String currentYear = String.valueOf(Year.now().getValue());

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>")
          .append("<html lang=\"en\"><head>")
          .append("<meta charset=\"UTF-8\" />")
          .append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />")
          .append("<style>")
          .append("body{margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,'Segoe UI',Arial,sans-serif;}")
          .append("a{color:").append(brandColor).append(";}")
          .append("h1,h2,h3{color:#111827;margin-top:0;}")
          .append("p{margin:0 0 14px;}")
          .append("ul,ol{padding-left:20px;margin:0 0 14px;}")
          .append("table{border-collapse:collapse;}")
          .append("@media only screen and (max-width:620px){")
          .append(".email-container{width:100%!important;border-radius:0!important;}")
          .append(".email-content{padding:20px!important;}")
          .append("}")
          .append("</style>")
          .append("</head><body style=\"margin:0;padding:0;background:#f4f5f7;\">")
          // Outer wrapper
          .append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#f4f5f7;padding:32px 16px;\">")
          .append("<tr><td align=\"center\">")
          // Container card
          .append("<table class=\"email-container\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);\">")
          // Header band
          .append("<tr><td style=\"background-color:").append(brandColor).append(";padding:24px 32px;text-align:center;\">");

        if (template.getLogoUrl() != null && !template.getLogoUrl().isBlank()) {
            sb.append("<img src=\"").append(escapeHtmlAttr(template.getLogoUrl()))
              .append("\" alt=\"Logo\" style=\"max-height:56px;max-width:200px;height:auto;width:auto;object-fit:contain;display:block;margin:0 auto;\" />");
        } else {
            sb.append("<span style=\"color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;\">EQMS System</span>");
        }

        sb.append("</td></tr>")
          // Content area
          .append("<tr><td class=\"email-content\" style=\"padding:32px 40px;font-size:15px;line-height:1.7;color:#374151;\">")
          .append(renderedContent)
          .append("</td></tr>")
          // Footer
          .append("<tr><td style=\"background:#f8fafc;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;line-height:1.8;\">");

        if (!copyright.isBlank()) {
            sb.append("<div>").append(escapeHtml(copyright)).append("</div>");
        } else {
            sb.append("<div>&copy; ").append(currentYear).append(" EQMS System. All rights reserved.</div>");
        }

        if (!contactEmail.isBlank()) {
            sb.append("<div style=\"margin-top:4px;\">Questions? Contact <a href=\"mailto:")
              .append(escapeHtmlAttr(contactEmail)).append("\" style=\"color:").append(brandColor)
              .append(";text-decoration:none;font-weight:600;\">").append(escapeHtml(contactEmail)).append("</a></div>");
        }

        sb.append("<div style=\"margin-top:8px;color:#9ca3af;font-size:11px;\">This email was sent automatically by the EQMS System. Please do not reply.</div>")
          .append("</td></tr>")
          .append("</table>")
          .append("</td></tr></table>")
          .append("</body></html>");

        return sb.toString();
    }

    public EmailTemplateResponse toResponse(EmailTemplate template) {
        return new EmailTemplateResponse(
                template.getId(),
                template.getName(),
                template.getType(),
                template.getSubject(),
                template.getContent(),
                template.getStatus(),
                template.getVariablesList(),
                template.getDescription(),
                template.getLogoUrl(),
                template.getLogoFileName(),
                template.getCopyright(),
                template.getContactEmail(),
                template.getPrimaryColor(),
                template.getUsageCount(),
                template.getLastUsed() != null ? template.getLastUsed().toString() : null,
                template.getCreatedDate() != null ? template.getCreatedDate().toString() : null,
                template.getUpdatedDate() != null ? template.getUpdatedDate().toString() : null,
                template.getCreatedBy(),
                template.getUpdatedBy(),
                versionRepository.findTopByTemplateIdOrderByVersionNumberDesc(template.getId())
                        .map(EmailTemplateVersion::getVersionNumber)
                        .orElse(0)
        );
    }

    public EmailTemplateVersionResponse toVersionResponse(EmailTemplateVersion version) {
        return new EmailTemplateVersionResponse(
                version.getId(),
                version.getTemplate() != null ? version.getTemplate().getId() : null,
                version.getVersionNumber(),
                version.getName(),
                version.getType(),
                version.getSubject(),
                version.getContent(),
                version.getStatus(),
                version.getVariablesList(),
                version.getDescription(),
                version.getLogoUrl(),
                version.getLogoFileName(),
                version.getCopyright(),
                version.getContactEmail(),
                version.getChangeSummary(),
                version.getCreatedBy(),
                version.getCreatedAt(),
                version.getPublishedBy(),
                version.getPublishedAt()
        );
    }

    private EmailTemplateVersion createVersionSnapshot(
            EmailTemplate template,
            String changeSummary,
            UserAccount actor,
            Instant publishedAt,
            String publishedBy
    ) {
        int nextVersion = versionRepository.findTopByTemplateIdOrderByVersionNumberDesc(template.getId())
                .map(EmailTemplateVersion::getVersionNumber)
                .orElse(0) + 1;

        EmailTemplateVersion version = new EmailTemplateVersion();
        version.setTemplate(template);
        version.setVersionNumber(nextVersion);
        version.setName(template.getName());
        version.setType(template.getType());
        version.setSubject(template.getSubject());
        version.setContent(template.getContent());
        version.setStatus(template.getStatus());
        version.setDescription(template.getDescription());
        version.setLogoUrl(template.getLogoUrl());
        version.setLogoFileName(template.getLogoFileName());
        version.setCopyright(template.getCopyright());
        version.setContactEmail(template.getContactEmail());
        version.setPrimaryColor(template.getPrimaryColor());
        version.setVariables(template.getVariables());
        version.setChangeSummary(normalizeOptional(changeSummary));
        version.setCreatedBy(actor != null ? actor.getFullName() : template.getUpdatedBy());
        version.setPublishedAt(publishedAt);
        version.setPublishedBy(publishedBy);
        return versionRepository.save(version);
    }

    private static String normalizeOptional(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private List<String> resolveVariables(List<String> requestedVariables, String subject, String content) {
        List<String> resolved = new ArrayList<>();
        if (requestedVariables != null) {
            requestedVariables.stream()
                    .filter(StringUtils::hasText)
                    .map(String::trim)
                    .forEach(value -> {
                        if (!resolved.contains(value)) {
                            resolved.add(value);
                        }
                    });
        }

        addDetectedVariables(resolved, subject);
        addDetectedVariables(resolved, content);
        return resolved;
    }

    private void addDetectedVariables(List<String> resolved, String source) {
        if (!StringUtils.hasText(source)) {
            return;
        }
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}").matcher(source);
        while (matcher.find()) {
            String variable = matcher.group(1);
            if (!resolved.contains(variable)) {
                resolved.add(variable);
            }
        }
    }

    private void addDateRangePredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            jakarta.persistence.criteria.Path<Instant> path,
            String from,
            String to
    ) {
        Instant fromInstant = parseStartOfDay(from);
        Instant toInstant = parseEndOfDay(to);
        if (fromInstant != null) {
            predicates.add(cb.greaterThanOrEqualTo(path, fromInstant));
        }
        if (toInstant != null) {
            predicates.add(cb.lessThanOrEqualTo(path, toInstant));
        }
    }

    private Instant parseStartOfDay(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            LocalDate date = LocalDate.parse(value.trim(), DMY_DATE);
            return date.atStartOfDay(SYSTEM_ZONE).toInstant();
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private Instant parseEndOfDay(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            LocalDate date = LocalDate.parse(value.trim(), DMY_DATE);
            return date.plusDays(1).atStartOfDay(SYSTEM_ZONE).minusNanos(1).toInstant();
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private String resolveSortProperty(String sortBy) {
        if (!StringUtils.hasText(sortBy)) {
            return "createdDate";
        }
        return switch (sortBy.trim()) {
            case "name", "type", "subject", "status", "description", "usageCount", "lastUsed", "createdDate", "updatedDate", "createdBy", "updatedBy" -> sortBy.trim();
            default -> "createdDate";
        };
    }

    private String normalizeTemplateType(String type) {
        String normalized = EmailTemplateTypeUtils.normalize(type);
        if (!EmailTemplateTypeUtils.isAllowed(normalized)) {
            throw new IllegalArgumentException("Unsupported email template type: " + type);
        }
        return normalized;
    }

    private static String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private static String localizedMessage(String key) {
        Locale requested = LocaleContextHolder.getLocale();
        Locale supported = "vi".equalsIgnoreCase(requested.getLanguage())
                ? Locale.forLanguageTag("vi")
                : Locale.ENGLISH;
        try {
            return ResourceBundle.getBundle("messages", supported).getString(key);
        } catch (MissingResourceException ignored) {
            return "Test email sent successfully.";
        }
    }

    private static String escapeHtmlAttr(String value) {
        return escapeHtml(value).replace("'", "&#39;");
    }

    private static String sanitizeRenderedHtml(String html) {
        if (html == null || html.isBlank()) {
            return html;
        }
        Safelist safelist = Safelist.relaxed()
                .addTags("div", "span", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col")
                .addAttributes("div", "style", "class")
                .addAttributes("span", "style", "class")
                .addAttributes("table", "style", "class", "border", "cellpadding", "cellspacing", "width")
                .addAttributes("thead", "style", "class")
                .addAttributes("tbody", "style", "class")
                .addAttributes("tfoot", "style", "class")
                .addAttributes("tr", "style", "class")
                .addAttributes("th", "style", "class", "colspan", "rowspan", "align", "valign")
                .addAttributes("td", "style", "class", "colspan", "rowspan", "align", "valign")
                .addAttributes("col", "style", "class", "span", "width")
                .addAttributes("img", "src", "alt", "title", "width", "height", "style", "class")
                .addAttributes("a", "href", "title", "target", "rel", "style", "class");
        return Jsoup.clean(html, safelist);
    }
}
