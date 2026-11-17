package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
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
import com.eqms.entity.ElectronicSignature;
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

import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EmailTemplateService {

    private static final String ACTION_EMAIL_TEMPLATE_UPDATED = "EMAIL_TEMPLATE_UPDATED";
    private static final String ACTION_EMAIL_TEMPLATE_STATUS_TOGGLED = "EMAIL_TEMPLATE_STATUS_TOGGLED";
    private static final String ACTION_EMAIL_TEMPLATE_TEST_SENT = "EMAIL_TEMPLATE_TEST_SENT";
    private static final String ACTION_EMAIL_TEMPLATE_PUBLISHED = "EMAIL_TEMPLATE_PUBLISHED";
    private static final String ACTION_EMAIL_TEMPLATE_VERSION_RESTORED = "EMAIL_TEMPLATE_VERSION_RESTORED";

    private static final ZoneId SYSTEM_ZONE = DateTimeFormatUtils.ZONE;
    private static final DateTimeFormatter DMY_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final EmailTemplateRepository repository;
    private final EmailTemplateVersionRepository versionRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;

    @org.springframework.beans.factory.annotation.Autowired
    private com.eqms.auth.TokenService tokenService;

    @org.springframework.beans.factory.annotation.Autowired
    private ElectronicSignatureService electronicSignatureService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EmailDesignService emailDesignService;

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
            String usage,
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
                buildSpecification(search, type, status, createdFrom, createdTo, updatedFrom, updatedTo, usage),
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
                        buildSpecification(search, type, status, createdFrom, createdTo, updatedFrom, updatedTo, null),
                        Sort.by(direction, sortProperty)
                ).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public EmailTemplateResponse getTemplateById(UUID id) {
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found"));
        return toResponse(template);
    }

    @Transactional(readOnly = true)
    public EmailTemplate getTemplateEntityById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found"));
    }

    @Transactional(readOnly = true)
    public EmailTemplate getTemplateEntityByName(String name) {
        return repository.findByName(name)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found: " + name));
    }

    /** A signature is not required to save an email template (the change is written to the Audit Trail); one that is sent must still be valid. */
    private void requireValidTemplateSignature(UserAccount currentUser, String signatureToken) {
        if (!StringUtils.hasText(signatureToken)) {
            return;
        }
        var parsedSignature = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Electronic signature is invalid or expired"));
        if (!parsedSignature.principal().userId().equals(currentUser.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Electronic signature must belong to the current user");
        }
    }

    @Transactional
    public EmailTemplateResponse updateTemplate(UUID id, EmailTemplateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requireValidTemplateSignature(currentUser, request.signatureToken());
        // the row is locked until the transaction ends: two administrators saving the same message are served one after the other, and the second sees the first
        EmailTemplate template = repository.lockById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found"));
        if (request.expectedUpdatedDate() != null && template.getUpdatedDate() != null
                && !request.expectedUpdatedDate().truncatedTo(java.time.temporal.ChronoUnit.MICROS).equals(template.getUpdatedDate().truncatedTo(java.time.temporal.ChronoUnit.MICROS))) {
            throw new IllegalStateException("This was changed by someone else after you opened it. Reload it to see their change, then make yours again.");
        }

        String previousStatus = template.getStatus();
        String previousName = template.getName();
        String previousSubject = template.getSubject();
        String previousContent = template.getContent();
        String previousDescription = template.getDescription();

        // The system finds a template by its type, so the name and the type are not editable; the look of the mail is the shared email design.
        template.setSubject(request.subject());
        template.setContent(request.content());
        template.setStatus(request.status());
        template.setDescription(request.description());
        template.setVariablesList(resolveVariables(request.variables(), request.subject(), request.content()));
        template.setUpdatedBy(currentUser.getFullName());

        EmailTemplate saved = repository.save(template);
        createVersionSnapshot(saved, "Updated template", currentUser, null, null);
        ElectronicSignature signature = StringUtils.hasText(request.signatureToken())
                ? electronicSignatureService.createEntitySignature("EmailTemplate", saved.getId(), saved.getName(), currentUser, request.signatureToken(), "EMAIL_TEMPLATE_UPDATED", request.reason(), null, previousStatus, saved.getStatus())
                : null;

        // Previously recorded only the status with an empty changes list -- an inspector could
        // see THAT a GxP-facing notification template was edited but never WHAT changed (subject
        // line, body content, name...), which matters most for exactly this entity: every
        // automated notification the system sends is rendered from this content.
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addTemplateChange(changes, "Name", previousName, saved.getName());
        addTemplateChange(changes, "Subject", previousSubject, saved.getSubject());
        addTemplateChange(changes, "Content", previousContent, saved.getContent());
        addTemplateChange(changes, "Description", previousDescription, saved.getDescription());
        addTemplateChange(changes, "Status", previousStatus, saved.getStatus());

        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                saved.getName(),
                saved.getId(),
                ACTION_EMAIL_TEMPLATE_UPDATED,
                previousStatus,
                saved.getStatus(),
                (request.reason() != null && !request.reason().isBlank())
                        ? "Updated email template: " + request.reason()
                        : "Updated email template",
                changes,
                signature == null ? null : signature.getId()
        );
        return toResponse(saved);
    }

    private void addTemplateChange(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!java.util.Objects.equals(oldValue, newValue)) {
            changes.add(new AuditTrailChangeResponse(field, oldValue, newValue));
        }
    }

    @Transactional
    public EmailTemplateResponse toggleStatus(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found"));

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
                .orElseThrow(() -> new EntityNotFoundException("Email template not found"));
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
                renderPreviewContent(template, variables),
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
                .orElseThrow(() -> new EntityNotFoundException("Email template not found"));
        auditTrailService.logAs(
                currentUser,
                "EMAIL_TEMPLATE",
                template.getName(),
                template.getId(),
                ACTION_EMAIL_TEMPLATE_TEST_SENT,
                template.getStatus(),
                template.getStatus(),
                "Test email sent to " + to,
                java.util.List.of(com.eqms.util.AuditChanges.of("Test Sent To",null,to)));
        return new EmailTemplateTestSendResponse(true, "Test email sent successfully.", template.getId(), template.getName(), to, Instant.now());
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
                .orElseThrow(() -> new EntityNotFoundException("Email template not found"));
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

    /** The types the messages have, for the Type filter. */
    @Transactional(readOnly = true)
    public List<String> listTypes() {
        return repository.findDistinctTypes();
    }

    @Transactional
    public EmailTemplateResponse restoreVersion(UUID templateId, UUID versionId, EmailTemplateRestoreVersionRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EmailTemplate template = repository.findById(templateId)
                .orElseThrow(() -> new EntityNotFoundException("Email template not found"));
        EmailTemplateVersion version = versionRepository.findByIdAndTemplateId(versionId, templateId)
                .orElseThrow(() -> new EntityNotFoundException("Email template version not found"));

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
                "Restored email template version " + version.getVersionNumber(),
                java.util.List.of(com.eqms.util.AuditChanges.of("Version Restored",null,version.getVersionNumber())));
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
            String updatedTo,
            String usage
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

            // SENT: the system has sent it at least once; NEVER_SENT: it has not
            if ("SENT".equalsIgnoreCase(usage)) {
                predicates.add(cb.greaterThan(root.<Integer>get("usageCount"), 0));
            } else if ("NEVER_SENT".equalsIgnoreCase(usage)) {
                predicates.add(cb.equal(root.<Integer>get("usageCount"), 0));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public String renderTemplateText(String content, Map<String, String> variables) {
        if (content == null || content.isBlank() || variables == null || variables.isEmpty()) {
            return content;
        }
        String result = content;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            String value = entry.getValue() != null ? DateTimeFormatUtils.normalizeText(entry.getValue()) : "";
            result = result.replace("{{" + entry.getKey() + "}}", value);
            result = result.replace("{" + entry.getKey() + "}", value);
        }
        return result.replaceAll("\\{\\{\\s*[a-zA-Z0-9_]+\\s*\\}\\}", "");
    }

    /**
     * The content of a template put in the one frame the whole system uses (owner decision D2, 2026-11-12). The logo, colour, font and footer
     * that each template used to carry are no longer read: they come from the shared email design.
     */
    /** The same mail as {@link #renderTemplateContent}, for a preview on a screen: the card alone, without the grey page around it. */
    public String renderPreviewContent(EmailTemplate template, Map<String, String> variables) {
        String renderedContent = sanitizeRenderedHtml(renderTemplateText(template.getContent(), variables));
        return emailDesignService == null
                ? com.eqms.util.EmailFrameRenderer.render(null, renderedContent, null, true)
                : emailDesignService.framePreview(renderedContent);
    }

    public String renderTemplateContent(EmailTemplate template, Map<String, String> variables) {
        String renderedContent = renderTemplateText(template.getContent(), variables);
        renderedContent = sanitizeRenderedHtml(renderedContent);
        return emailDesignService == null
                ? com.eqms.util.EmailFrameRenderer.render(null, renderedContent)
                : emailDesignService.frame(renderedContent);
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

    private static String escapeHtmlAttr(String value) {
        return escapeHtml(value).replace("'", "&#39;");
    }

    /** What a person may put in the wording of an email: the usual text formatting, lists, links and tables, nothing that runs. */
    public static String sanitizeRenderedHtml(String html) {
        if (html == null || html.isBlank()) {
            return html;
        }
        Safelist safelist = Safelist.relaxed()
                .addTags("div", "span", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "s", "mark", "hr")
                .addAttributes("p", "style")
                .addAttributes("h1", "style").addAttributes("h2", "style").addAttributes("h3", "style")
                .addAttributes("li", "style").addAttributes("mark", "style", "data-color")
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
