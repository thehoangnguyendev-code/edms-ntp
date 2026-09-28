package com.eqms.service;

import com.eqms.dto.controlledcopypolicy.ControlledCopyExpiryLimitInput;
import com.eqms.dto.controlledcopypolicy.ControlledCopyExpiryLimitResponse;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyDeliverySection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyDistributionSecuritySection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRecallSection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyResponse;
import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ControlledCopyExpiryLimit;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentType;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.repository.ControlledCopyExpiryLimitRepository;
import com.eqms.repository.ControlledCopyPolicySettingRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ControlledCopyPolicyService {

    /**
     * No hardcoded "DCO" role/access-profile name gates this feature (by explicit design
     * decision) -- any user holding this permission is eligible to be selected as the DCO
     * delivery recipient, regardless of what their access profile is named.
     */
    public static final String DCO_RECIPIENT_PERMISSION = "documents.controlled_copy.receive_as_dco";

    private final ControlledCopyPolicySettingRepository repository;
    private final UserAccountRepository userAccountRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final SecurityChangeSignatureService securityChangeSignatureService;
    private final AuditTrailService auditTrailService;
    private final ControlledCopyExpiryLimitRepository expiryLimitRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final DepartmentRepository departmentRepository;
    /** Only used to (de)serialise the plain status-marking records; nothing here needs Spring's configured mapper. */
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public ControlledCopyPolicyService(
            ControlledCopyPolicySettingRepository repository,
            UserAccountRepository userAccountRepository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            SecurityChangeSignatureService securityChangeSignatureService,
            AuditTrailService auditTrailService,
            ControlledCopyExpiryLimitRepository expiryLimitRepository,
            DocumentTypeRepository documentTypeRepository,
            DepartmentRepository departmentRepository
    ) {
        this.repository = repository;
        this.userAccountRepository = userAccountRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.securityChangeSignatureService = securityChangeSignatureService;
        this.auditTrailService = auditTrailService;
        this.expiryLimitRepository = expiryLimitRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.departmentRepository = departmentRepository;
    }

    @Transactional(readOnly = true)
    public ControlledCopyPolicyResponse getPolicy() {
        ControlledCopyPolicySetting s = loadOrDefault();
        return toResponse(s);
    }

    @Transactional
    @CacheEvict(cacheNames = "controlled-copy-policy", allEntries = true)
    public ControlledCopyPolicyResponse savePolicy(ControlledCopyPolicyRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(currentUser,
                "documents.admin.controlled_copies_policy.manage", "settings.configuration.manage");
        if (!allowed) {
            throw new AccessDeniedException("Current user is not allowed to manage the controlled copy policy");
        }
        securityChangeSignatureService.requireValidToken(currentUser, request == null ? null : request.signatureToken());

        ControlledCopyPolicySetting s = loadOrDefault();
        PolicySnapshot before = snapshot(s);
        applyRequest(s, request);
        repository.save(s);
        PolicySnapshot after = snapshot(s);
        List<AuditTrailChangeResponse> changes = new ArrayList<>(diff(before, after));
        // Saved under this SAME signature/audit entry, not the standalone /expiry-limits endpoints'
        // own per-row signature -- see ControlledCopyExpiryLimitInput's javadoc.
        changes.addAll(applyExpiryLimits(request == null ? null : request.expiryLimits()));

        // This service had NO audit trail entries at all before -- the change was only ever
        // visible via the (now-retired) generic "ENTITY_ELECTRONICALLY_SIGNED" companion row that
        // ElectronicSignatureService used to log for every signed action. Electronic signing is a
        // step that accompanies the real action, not a separate audit event of its own (see
        // ElectronicSignatureService#createEntitySignature) -- so this policy change needs its own
        // proper Audit Trail entry, carrying the signature's ID directly, same as every other
        // action in the app.
        String reason = request == null ? null : request.reason();
        ElectronicSignature signature = securityChangeSignatureService.record(
                currentUser,
                request == null ? null : request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                "CONTROLLED_COPY_POLICY",
                s.getId(),
                "Controlled Copies Policy",
                reason,
                null,
                null
        );
        // A prior version of this call dumped the ENTIRE policy (every field, changed or not) as
        // one giant "Policy" before/after string -- unreadable, and gave no indication of what
        // actually changed. Field Modifications must list only the fields that actually changed,
        // one row each, same as every other action in the app (see diff() below); fromStatus/
        // toStatus stay null -- audit_logs.from_status/to_status are varchar(40) and a full-policy
        // summary previously overflowed that column and failed the save outright.
        //
        // Action type is plain "UPDATED", not "CONTROLLED_COPY_POLICY_UPDATED" -- this is a
        // singleton settings record, so Target Module and Object Code already say "Controlled Copy
        // Policy" / "Controlled Copies Policy"; repeating that in the Action Type badge only added
        // noise, not information.
        auditTrailService.logAs(
                currentUser,
                "CONTROLLED_COPY_POLICY",
                "Controlled Copies Policy",
                s.getId(),
                "UPDATED",
                null,
                null,
                StringUtils.hasText(reason) ? "Reason: " + reason : null,
                changes,
                signature == null ? null : signature.getId()
        );
        return toResponse(s);
    }

    /** Immutable snapshot of every policy field, captured before and after applyRequest() so diff() can compare them field by field. */
    private record PolicySnapshot(
            boolean allowEmailDistribution, boolean allowPortalView, boolean allowDownload, boolean allowPrint,
            boolean downloadOnce, boolean printOnce, boolean watermarkEnabled, boolean watermarkCopyNumber,
            boolean watermarkRecipient, boolean watermarkDistributedDate, boolean watermarkExpiryDate,
            boolean allowManualRecall, boolean allowReportLostDamaged, boolean allowReplacementForLostDamaged,
            boolean redirectDeliveryToDco, String dcoRecipientLabel,
            java.util.Map<String, String> marking, int previewSessionMinutes
    ) {}

    private PolicySnapshot snapshot(ControlledCopyPolicySetting s) {
        UserAccount dco = s.getDcoRecipientUserId() == null ? null : userAccountRepository.findById(s.getDcoRecipientUserId()).orElse(null);
        String dcoLabel = dco != null ? dco.getFullName() : (s.getDcoRecipientUserId() == null ? null : "Unknown user");
        return new PolicySnapshot(
                s.isAllowEmailDistribution(), s.isAllowPortalView(), s.isAllowDownload(), s.isAllowPrint(),
                s.isDownloadOnce(), s.isPrintOnce(), s.isWatermarkEnabled(), s.isWatermarkCopyNumber(),
                s.isWatermarkRecipient(), s.isWatermarkDistributedDate(), s.isWatermarkExpiryDate(),
                s.isAllowManualRecall(), s.isAllowReportLostDamaged(), s.isAllowReplacementForLostDamaged(),
                s.isRedirectDeliveryToDco(), dcoLabel, markingSummary(s), s.getPreviewSessionMinutes()
        );
    }

    private java.util.Map<String, String> markingSummary(ControlledCopyPolicySetting s) {
        java.util.Map<String, String> m = new java.util.LinkedHashMap<>();
        m.put("stampEnabled", String.valueOf(s.isStampEnabled()));
        m.put("stampText", s.getStampText());
        m.put("stampColor", s.getStampColor());
        m.put("stampPosition", s.getStampPosition());
        m.put("stampMarginMm", String.valueOf(s.getStampMarginMm()));
        m.put("stampSize", s.getStampSize());
        m.put("stampOpacityPercent", String.valueOf(s.getStampOpacityPercent()));
        m.put("stampFontFamily", s.getStampFontFamily());
        m.put("placements", s.getMarkingPlacements() == null ? "" : s.getMarkingPlacements().toString());
        m.put("stampPages", s.getStampPages());
        m.put("stampShowCopyNumber", String.valueOf(s.isStampShowCopyNumber()));
        m.put("stampShowRecipient", String.valueOf(s.isStampShowRecipient()));
        m.put("stampShowDistributedDate", String.valueOf(s.isStampShowDistributedDate()));
        m.put("stampShowExpiryDate", String.valueOf(s.isStampShowExpiryDate()));
        m.put("watermarkText", s.getWatermarkText());
        m.put("watermarkColor", s.getWatermarkColor());
        m.put("watermarkOpacityPercent", String.valueOf(s.getWatermarkOpacityPercent()));
        m.put("watermarkAngleDegrees", String.valueOf(s.getWatermarkAngleDegrees()));
        m.put("watermarkPages", s.getWatermarkPages());
        m.put("watermarkLayer", s.getWatermarkLayer());
        m.put("watermarkFontFamily", s.getWatermarkFontFamily());
        STATUS_MARKING_KEYS.forEach(status -> {
            var cfg = statusMarkingFor(s, status);
            m.put(status + ".watermarkEnabled", String.valueOf(cfg.watermarkEnabled()));
            m.put(status + ".watermarkLayer", cfg.watermarkLayer());
            m.put(status + ".watermarkText", cfg.watermarkText());
            m.put(status + ".watermarkColor", cfg.watermarkColor());
            m.put(status + ".watermarkOpacityPercent", String.valueOf(cfg.watermarkOpacityPercent()));
            m.put(status + ".watermarkAngleDegrees", String.valueOf(cfg.watermarkAngleDegrees()));
            m.put(status + ".watermarkFontFamily", cfg.watermarkFontFamily());
            m.put(status + ".watermarkShowDate", String.valueOf(cfg.watermarkShowDate()));
            m.put(status + ".watermarkPages", cfg.watermarkPages());
            m.put(status + ".stampEnabled", String.valueOf(cfg.stampEnabled()));
            m.put(status + ".stampText", cfg.stampText());
            m.put(status + ".stampColor", cfg.stampColor());
            m.put(status + ".stampPosition", cfg.stampPosition());
            m.put(status + ".stampMarginMm", String.valueOf(cfg.stampMarginMm()));
            m.put(status + ".stampSize", cfg.stampSize());
            m.put(status + ".stampOpacityPercent", String.valueOf(cfg.stampOpacityPercent()));
            m.put(status + ".stampShowDate", String.valueOf(cfg.stampShowDate()));
            m.put(status + ".stampFontFamily", cfg.stampFontFamily());
            m.put(status + ".stampPages", cfg.stampPages());
            m.put(status + ".placements", cfg.placements() == null ? "" : cfg.placements().toString());
        });
        return m;
    }

    /** Only the fields that actually changed -- every other field is left out entirely, not just unchanged text. */
    private List<AuditTrailChangeResponse> diff(PolicySnapshot before, PolicySnapshot after) {
        List<AuditTrailChangeResponse> changes = new java.util.ArrayList<>();
        addIfChanged(changes, "allowEmailDistribution", before.allowEmailDistribution(), after.allowEmailDistribution());
        addIfChanged(changes, "allowPortalView", before.allowPortalView(), after.allowPortalView());
        addIfChanged(changes, "allowDownload", before.allowDownload(), after.allowDownload());
        addIfChanged(changes, "allowPrint", before.allowPrint(), after.allowPrint());
        addIfChanged(changes, "downloadOnce", before.downloadOnce(), after.downloadOnce());
        addIfChanged(changes, "printOnce", before.printOnce(), after.printOnce());
        if (before.previewSessionMinutes() != after.previewSessionMinutes()) {
            changes.add(new AuditTrailChangeResponse("externalViewerSessionMinutes",
                    String.valueOf(before.previewSessionMinutes()), String.valueOf(after.previewSessionMinutes())));
        }
        addIfChanged(changes, "watermarkEnabled", before.watermarkEnabled(), after.watermarkEnabled());
        addIfChanged(changes, "watermarkCopyNumber", before.watermarkCopyNumber(), after.watermarkCopyNumber());
        addIfChanged(changes, "watermarkRecipient", before.watermarkRecipient(), after.watermarkRecipient());
        addIfChanged(changes, "watermarkDistributedDate", before.watermarkDistributedDate(), after.watermarkDistributedDate());
        addIfChanged(changes, "watermarkExpiryDate", before.watermarkExpiryDate(), after.watermarkExpiryDate());
        addIfChanged(changes, "allowManualRecall", before.allowManualRecall(), after.allowManualRecall());
        addIfChanged(changes, "allowReportLostDamaged", before.allowReportLostDamaged(), after.allowReportLostDamaged());
        addIfChanged(changes, "allowReplacementForLostDamaged", before.allowReplacementForLostDamaged(), after.allowReplacementForLostDamaged());
        addIfChanged(changes, "redirectDeliveryToDco", before.redirectDeliveryToDco(), after.redirectDeliveryToDco());
        after.marking().forEach((field, value) -> {
            String previous = before.marking().get(field);
            if (!java.util.Objects.equals(previous, value)) {
                changes.add(new AuditTrailChangeResponse(field, previous, value));
            }
        });
        if (!java.util.Objects.equals(before.dcoRecipientLabel(), after.dcoRecipientLabel())) {
            changes.add(new AuditTrailChangeResponse("dcoRecipient", before.dcoRecipientLabel(), after.dcoRecipientLabel()));
        }
        return changes;
    }

    private void addIfChanged(List<AuditTrailChangeResponse> changes, String field, boolean before, boolean after) {
        if (before != after) {
            changes.add(new AuditTrailChangeResponse(field, before ? "Enabled" : "Disabled", after ? "Enabled" : "Disabled"));
        }
    }

    // This single global row is read on every Controlled Copy authorization/capability check --
    // for a page of N rows in the Controlled Copies list, that's up to N x (number of actions
    // checked) DB round trips for a value that almost never changes. Cached (Redis, 30s default
    // TTL per CacheConfig) and explicitly evicted by savePolicy() below so an admin's change is
    // never delayed beyond that TTL, let alone lost.
    @Cacheable(cacheNames = "controlled-copy-policy", key = "'current'")
    public ControlledCopyPolicySetting loadOrDefault() {
        return repository.findById(ControlledCopyPolicySetting.DEFAULT_ID)
                .orElseGet(() -> repository.save(new ControlledCopyPolicySetting()));
    }

    /**
     * The policy as it would be after saving {@code req}, without saving anything: a detached copy of the current settings with the
     * (validated) request applied. Used to preview marks while an administrator is still editing.
     */
    public ControlledCopyPolicySetting draftFrom(ControlledCopyPolicyRequest req) {
        ControlledCopyPolicySetting current = loadOrDefault();
        ControlledCopyPolicySetting draft = new ControlledCopyPolicySetting();
        org.springframework.beans.BeanUtils.copyProperties(current, draft, "id");
        applyRequest(draft, req);
        return draft;
    }

    private void applyRequest(ControlledCopyPolicySetting s, ControlledCopyPolicyRequest req) {
        if (req.distributionSecurity() != null) {
            var ds = req.distributionSecurity();
            if (ds.allowEmailDistribution() != null) s.setAllowEmailDistribution(ds.allowEmailDistribution());
            if (ds.allowPortalView() != null) s.setAllowPortalView(ds.allowPortalView());
            if (ds.allowDownload() != null) s.setAllowDownload(ds.allowDownload());
            if (ds.allowPrint() != null) s.setAllowPrint(ds.allowPrint());
            if (ds.downloadOnce() != null) s.setDownloadOnce(ds.downloadOnce());
            if (ds.printOnce() != null) s.setPrintOnce(ds.printOnce());
            if (ds.previewSessionMinutes() != null) {
                s.setPreviewSessionMinutes(requireRange(ds.previewSessionMinutes(), "External viewer session length", 5, 480));
            }
            if (ds.watermarkEnabled() != null) s.setWatermarkEnabled(ds.watermarkEnabled());
            if (ds.watermarkCopyNumber() != null) s.setWatermarkCopyNumber(ds.watermarkCopyNumber());
            if (ds.watermarkRecipient() != null) s.setWatermarkRecipient(ds.watermarkRecipient());
            if (ds.watermarkDistributedDate() != null) s.setWatermarkDistributedDate(ds.watermarkDistributedDate());
            if (ds.watermarkExpiryDate() != null) s.setWatermarkExpiryDate(ds.watermarkExpiryDate());
        }
        if (req.marking() != null) {
            applyMarking(s, req.marking());
        }
        if (req.statusMarking() != null) {
            applyStatusMarking(s, req.statusMarking());
        }
        if (req.recallLostDamaged() != null) {
            var r = req.recallLostDamaged();
            if (r.allowManualRecall() != null) s.setAllowManualRecall(r.allowManualRecall());
            if (r.allowReportLostDamaged() != null) s.setAllowReportLostDamaged(r.allowReportLostDamaged());
            if (r.allowReplacementForLostDamaged() != null) s.setAllowReplacementForLostDamaged(r.allowReplacementForLostDamaged());
        }
        if (req.delivery() != null) {
            var d = req.delivery();
            if (d.redirectDeliveryToDco() != null) s.setRedirectDeliveryToDco(d.redirectDeliveryToDco());
            if (d.dcoRecipientUserId() != null) {
                s.setDcoRecipientUserId(StringUtils.hasText(d.dcoRecipientUserId()) ? UUID.fromString(d.dcoRecipientUserId().trim()) : null);
            }
            if (s.isRedirectDeliveryToDco()) {
                if (s.getDcoRecipientUserId() == null) {
                    throw new IllegalArgumentException("Select a DCO recipient before enabling delivery redirection.");
                }
                UserAccount recipient = userAccountRepository.findById(s.getDcoRecipientUserId()).orElse(null);
                if (recipient == null) {
                    throw new IllegalArgumentException("The selected DCO recipient no longer exists. Select a different user.");
                }
                if (recipient.getStatus() != com.eqms.entity.UserStatus.Active) {
                    throw new IllegalArgumentException("The selected DCO recipient's account is not Active. Select a different user.");
                }
                if (!permissionEvaluationService.hasPermission(recipient, DCO_RECIPIENT_PERMISSION)) {
                    throw new IllegalArgumentException(
                            "\"" + recipient.getFullName() + "\" does not hold the \"Receive Controlled Copies as DCO\" permission. "
                                    + "Grant it via Access Profiles first, or select a different user.");
                }
            }
        }
    }

    /**
     * Users eligible to be selected as the DCO delivery recipient: Active accounts holding {@link
     * #DCO_RECIPIENT_PERMISSION}, regardless of role/access-profile name. Used to populate the
     * picker in Controlled Copies Policy so an ineligible user can never be selected in the first
     * place; may return an empty list if no one has been granted the permission yet.
     */
    @Transactional(readOnly = true)
    public List<UserAccount> listDcoEligibleUsers() {
        return userAccountRepository.findAllByStatus(com.eqms.entity.UserStatus.Active).stream()
                .filter(user -> permissionEvaluationService.hasPermission(user, DCO_RECIPIENT_PERMISSION))
                .sorted(Comparator.comparing(UserAccount::getFullName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    /** Whether the currently configured DCO recipient (if any) still holds the required permission. */
    @Transactional(readOnly = true)
    public boolean isCurrentDcoRecipientEligible(ControlledCopyPolicySetting s) {
        if (s.getDcoRecipientUserId() == null) {
            return false;
        }
        UserAccount recipient = userAccountRepository.findById(s.getDcoRecipientUserId()).orElse(null);
        return recipient != null
                && recipient.getStatus() == com.eqms.entity.UserStatus.Active
                && permissionEvaluationService.hasPermission(recipient, DCO_RECIPIENT_PERMISSION);
    }

    private static final java.util.List<String> STATUS_MARKING_KEYS = java.util.List.of(
            com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking.OBSOLETED,
            com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking.CLOSED_CANCELLED);

    /** The complete stamp/watermark configuration of a withdrawn or cancelled copy: stored values over the built-in defaults. */
    public com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking statusMarkingFor(ControlledCopyPolicySetting s, String status) {
        var defaults = com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking.defaults(status);
        var stored = s == null || s.getStatusMarking() == null || s.getStatusMarking().path(status).isMissingNode()
                ? null : objectMapper.convertValue(s.getStatusMarking().path(status),
                        com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking.class);
        return stored == null ? defaults : stored.mergedOver(defaults);
    }

    private java.util.Map<String, com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking> statusMarkingMap(ControlledCopyPolicySetting s) {
        java.util.Map<String, com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking> map = new java.util.LinkedHashMap<>();
        STATUS_MARKING_KEYS.forEach(key -> map.put(key, statusMarkingFor(s, key)));
        return map;
    }

    private void applyStatusMarking(ControlledCopyPolicySetting s,
                                    java.util.Map<String, com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking> requested) {
        for (String key : requested.keySet()) {
            if (!STATUS_MARKING_KEYS.contains(key)) {
                throw new IllegalArgumentException("Stamp/watermark can only be configured for: " + String.join(", ", STATUS_MARKING_KEYS));
            }
        }
        com.fasterxml.jackson.databind.node.ObjectNode all = s.getStatusMarking() != null && s.getStatusMarking().isObject()
                ? ((com.fasterxml.jackson.databind.node.ObjectNode) s.getStatusMarking()).deepCopy() : objectMapper.createObjectNode();
        for (var entry : requested.entrySet()) {
            var merged = validatedStatusMarking(entry.getValue() == null ? null : entry.getValue()
                    .mergedOver(statusMarkingFor(s, entry.getKey())));
            all.set(entry.getKey(), objectMapper.valueToTree(merged));
        }
        s.setStatusMarking(all);
    }

    /** Every field of a fully merged status marking is checked here, so a bad value can never be stored. */
    private com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking validatedStatusMarking(
            com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking m) {
        if (m == null) {
            throw new IllegalArgumentException("Status marking must be an object");
        }
        String watermarkText = m.watermarkText() == null || m.watermarkText().isBlank() ? "" : requireText(m.watermarkText(), "Watermark text");
        return new com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking(
                m.watermarkEnabled(), requireOneOf(m.watermarkLayer(), "Watermark layer", "BEHIND", "ABOVE"), watermarkText,
                requireColor(m.watermarkColor(), "Watermark color"),
                requireRange(m.watermarkOpacityPercent(), "Watermark opacity", 5, 60),
                requireRange(m.watermarkAngleDegrees(), "Watermark angle", -90, 90),
                requireOneOf(m.watermarkFontFamily(), "Watermark font", FONT_FAMILIES),
                m.watermarkShowDate(), requireOneOf(m.watermarkPages(), "Watermark pages", "ALL", "FIRST"),
                m.stampEnabled(), requireText(m.stampText(), "Stamp text"),
                requireColor(m.stampColor(), "Stamp color"),
                requireOneOf(m.stampPosition(), "Stamp position", "TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT"),
                requireRange(m.stampMarginMm(), "Stamp distance from the edge", 0, 40),
                requireOneOf(m.stampSize(), "Stamp size", "SMALL", "MEDIUM", "LARGE"),
                requireRange(m.stampOpacityPercent(), "Stamp opacity", 30, 100),
                m.stampShowDate(), requireOneOf(m.stampFontFamily(), "Stamp font", FONT_FAMILIES),
                requireOneOf(m.stampPages(), "Stamp pages", "ALL", "FIRST"),
                validatedPlacements(m.placements()));
    }

    /** Must match the families bundled by {@link ControlledCopyPdfMarkingService}. */
    private static final String[] FONT_FAMILIES = {"NOTO_SANS", "NOTO_SERIF", "ROBOTO_MONO", "OSWALD"};

    private static final java.util.regex.Pattern COLOR = java.util.regex.Pattern.compile("^#[0-9A-Fa-f]{6}$");
    /** Letters (any script), digits and a few separators; nothing that could be read as markup or a control code. */
    private static final java.util.regex.Pattern MARK_TEXT = java.util.regex.Pattern.compile("^[\\p{L}\\p{N} .,:;/()\\-]{1,40}$");

    private void applyMarking(ControlledCopyPolicySetting s, com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyMarkingSection m) {
        if (m.stampEnabled() != null) s.setStampEnabled(m.stampEnabled());
        if (m.stampText() != null) s.setStampText(requireText(m.stampText(), "Stamp text"));
        if (m.stampColor() != null) s.setStampColor(requireColor(m.stampColor(), "Stamp color"));
        if (m.stampPosition() != null) s.setStampPosition(requireOneOf(m.stampPosition(), "Stamp position", "TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_RIGHT"));
        if (m.stampMarginMm() != null) s.setStampMarginMm(requireRange(m.stampMarginMm(), "Stamp distance from the edge", 0, 40));
        if (m.stampSize() != null) s.setStampSize(requireOneOf(m.stampSize(), "Stamp size", "SMALL", "MEDIUM", "LARGE"));
        if (m.stampOpacityPercent() != null) s.setStampOpacityPercent(requireRange(m.stampOpacityPercent(), "Stamp opacity", 30, 100));
        if (m.stampPages() != null) s.setStampPages(requireOneOf(m.stampPages(), "Stamp pages", "ALL", "FIRST"));
        if (m.stampFontFamily() != null) s.setStampFontFamily(requireOneOf(m.stampFontFamily(), "Stamp font", FONT_FAMILIES));
        if (m.stampShowCopyNumber() != null) s.setStampShowCopyNumber(m.stampShowCopyNumber());
        if (m.stampShowRecipient() != null) s.setStampShowRecipient(m.stampShowRecipient());
        if (m.stampShowDistributedDate() != null) s.setStampShowDistributedDate(m.stampShowDistributedDate());
        if (m.stampShowExpiryDate() != null) s.setStampShowExpiryDate(m.stampShowExpiryDate());
        if (m.watermarkText() != null) s.setWatermarkText(requireText(m.watermarkText(), "Watermark text"));
        if (m.watermarkColor() != null) s.setWatermarkColor(requireColor(m.watermarkColor(), "Watermark color"));
        if (m.watermarkOpacityPercent() != null) s.setWatermarkOpacityPercent(requireRange(m.watermarkOpacityPercent(), "Watermark opacity", 5, 50));
        if (m.watermarkAngleDegrees() != null) s.setWatermarkAngleDegrees(requireRange(m.watermarkAngleDegrees(), "Watermark angle", -90, 90));
        if (m.watermarkLayer() != null) s.setWatermarkLayer(requireOneOf(m.watermarkLayer(), "Watermark layer", "BEHIND", "ABOVE"));
        if (m.watermarkPages() != null) s.setWatermarkPages(requireOneOf(m.watermarkPages(), "Watermark pages", "ALL", "FIRST"));
        if (m.watermarkFontFamily() != null) s.setWatermarkFontFamily(requireOneOf(m.watermarkFontFamily(), "Watermark font", FONT_FAMILIES));
        if (m.placements() != null) {
            s.setMarkingPlacements(objectMapper.valueToTree(validatedPlacements(m.placements())));
        }
    }

    private java.util.List<com.eqms.dto.controlledcopypolicy.MarkingPlacementRule> placementsOf(com.fasterxml.jackson.databind.JsonNode node) {
        if (node == null || !node.isArray()) {
            return java.util.List.of();
        }
        return objectMapper.convertValue(node, new com.fasterxml.jackson.core.type.TypeReference<java.util.List<com.eqms.dto.controlledcopypolicy.MarkingPlacementRule>>() { });
    }

    /** Checks and normalises per-page placement rules: known page selectors, positions inside the page, sensible sizes. */
    private java.util.List<com.eqms.dto.controlledcopypolicy.MarkingPlacementRule> validatedPlacements(
            java.util.List<com.eqms.dto.controlledcopypolicy.MarkingPlacementRule> rules) {
        if (rules == null) {
            return java.util.List.of();
        }
        if (rules.size() > 20) {
            throw new IllegalArgumentException("At most 20 placement rules can be defined");
        }
        java.util.List<com.eqms.dto.controlledcopypolicy.MarkingPlacementRule> out = new java.util.ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (var rule : rules) {
            if (rule == null || !com.eqms.dto.controlledcopypolicy.MarkingPlacementRule.validPages(rule.pages())) {
                throw new IllegalArgumentException("Placement pages must be ALL, FIRST, OTHERS or a list such as 3,5-7,LAST");
            }
            String pages = com.eqms.dto.controlledcopypolicy.MarkingPlacementRule.normalizePages(rule.pages());
            if (!seen.add(pages)) {
                throw new IllegalArgumentException("Pages \"" + pages + "\" have more than one placement rule");
            }
            if ((rule.stampX() == null) != (rule.stampY() == null)) {
                throw new IllegalArgumentException("A stamp position needs both X and Y");
            }
            if ((rule.watermarkX() == null) != (rule.watermarkY() == null)) {
                throw new IllegalArgumentException("A watermark position needs both X and Y");
            }
            out.add(new com.eqms.dto.controlledcopypolicy.MarkingPlacementRule(
                    pages,
                    fraction(rule.stampX(), "Stamp X"), fraction(rule.stampY(), "Stamp Y"),
                    rule.stampWidthPercent() == null ? null : requireRange(rule.stampWidthPercent(), "Stamp width", 5, 60),
                    fraction(rule.watermarkX(), "Watermark X"), fraction(rule.watermarkY(), "Watermark Y"),
                    rule.watermarkScalePercent() == null ? null : requireRange(rule.watermarkScalePercent(), "Watermark size", 20, 150),
                    rule.watermarkAngleDegrees() == null ? null : requireRange(rule.watermarkAngleDegrees(), "Watermark angle", -90, 90)));
        }
        return out;
    }

    private static Double fraction(Double value, String label) {
        if (value == null) {
            return null;
        }
        if (value.isNaN() || value < 0d || value > 1d) {
            throw new IllegalArgumentException(label + " must be between 0 and 1");
        }
        return Math.round(value * 10000d) / 10000d;
    }

    private static String requireText(String value, String label) {
        String text = value == null ? "" : value.trim();
        if (!MARK_TEXT.matcher(text).matches()) {
            throw new IllegalArgumentException(label + " must be 1-40 characters: letters, digits, spaces and . , : ; / ( ) -");
        }
        return text;
    }

    private static String requireColor(String value, String label) {
        String color = value == null ? "" : value.trim();
        if (!COLOR.matcher(color).matches()) {
            throw new IllegalArgumentException(label + " must be a hex color such as #C00000");
        }
        return color.toUpperCase(java.util.Locale.ROOT);
    }

    private static String requireOneOf(String value, String label, String... allowed) {
        String normalized = value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
        if (!java.util.List.of(allowed).contains(normalized)) {
            throw new IllegalArgumentException(label + " must be one of " + String.join(", ", allowed));
        }
        return normalized;
    }

    private static int requireRange(int value, String label, int min, int max) {
        if (value < min || value > max) {
            throw new IllegalArgumentException(label + " must be between " + min + " and " + max);
        }
        return value;
    }

    private ControlledCopyPolicyResponse toResponse(ControlledCopyPolicySetting s) {
        UserAccount dco = s.getDcoRecipientUserId() == null ? null : userAccountRepository.findById(s.getDcoRecipientUserId()).orElse(null);
        return new ControlledCopyPolicyResponse(
                new ControlledCopyPolicyDistributionSecuritySection(
                        s.isAllowEmailDistribution(), s.isAllowPortalView(), s.isAllowDownload(), s.isAllowPrint(), s.isDownloadOnce(), s.isPrintOnce(),
                        s.isWatermarkEnabled(), s.isWatermarkCopyNumber(),
                        s.isWatermarkRecipient(), s.isWatermarkDistributedDate(), s.isWatermarkExpiryDate(),
                        s.getPreviewSessionMinutes()
                ),
                new ControlledCopyPolicyRecallSection(
                        s.isAllowManualRecall(), s.isAllowReportLostDamaged(),
                        s.isAllowReplacementForLostDamaged()
                ),
                new ControlledCopyPolicyDeliverySection(
                        s.isRedirectDeliveryToDco(),
                        s.getDcoRecipientUserId() == null ? null : s.getDcoRecipientUserId().toString(),
                        dco == null ? null : dco.getFullName(),
                        dco == null ? null : dco.getEmail(),
                        !s.isRedirectDeliveryToDco() || isCurrentDcoRecipientEligible(s)
                ),
                new com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyMarkingSection(
                        s.isStampEnabled(), s.getStampText(), s.getStampColor(), s.getStampPosition(), s.getStampMarginMm(), s.getStampSize(),
                        s.getStampOpacityPercent(), s.getStampPages(), s.isStampShowCopyNumber(), s.isStampShowRecipient(),
                        s.isStampShowDistributedDate(), s.isStampShowExpiryDate(), s.getStampFontFamily(),
                        s.getWatermarkText(), s.getWatermarkColor(), s.getWatermarkOpacityPercent(),
                        s.getWatermarkAngleDegrees(), s.getWatermarkPages(), s.getWatermarkLayer(), s.getWatermarkFontFamily(),
                        placementsOf(s.getMarkingPlacements())
                ),
                statusMarkingMap(s),
                listExpiryLimitResponses()
        );
    }

    private List<ControlledCopyExpiryLimitResponse> listExpiryLimitResponses() {
        return expiryLimitRepository.findAllByOrderByCreatedAtDesc().stream()
                .sorted(Comparator.comparing(ControlledCopyExpiryLimit::isSystem).reversed())
                .map(this::toExpiryLimitResponse)
                .toList();
    }

    private ControlledCopyExpiryLimitResponse toExpiryLimitResponse(ControlledCopyExpiryLimit limit) {
        DocumentType documentType = limit.getDocumentType();
        Department department = limit.getDepartment();
        return new ControlledCopyExpiryLimitResponse(
                limit.getId().toString(),
                documentType == null ? null : documentType.getId().toString(),
                documentType == null ? null : documentType.getName(),
                department == null ? null : department.getId().toString(),
                department == null ? null : department.getName(),
                limit.getDurationValue(),
                limit.getDurationUnit(),
                limit.isActive(),
                limit.isSystem()
        );
    }

    /** Immutable snapshot of one expiry rule's fields, so a per-row diff can be appended to the same
     *  consolidated Audit Trail entry the rest of the policy save produces. */
    private record ExpiryRuleSnapshot(String documentType, String department, String duration, boolean active) {}

    private ExpiryRuleSnapshot expirySnapshot(ControlledCopyExpiryLimit limit) {
        return new ExpiryRuleSnapshot(
                limit.getDocumentType() == null ? "Any" : limit.getDocumentType().getName(),
                limit.getDepartment() == null ? "Any" : limit.getDepartment().getName(),
                limit.getDurationValue() + " " + limit.getDurationUnit(),
                limit.isActive()
        );
    }

    /** Human-identifiable scope of a rule ("SOP / Quality Assurance", "Global Default", ...), used to
     *  label its entry in the consolidated Field Modifications list -- computed here (not looked up
     *  afterwards) because on delete the row is already gone by the time it would otherwise be read. */
    private String describeExpiryScope(ControlledCopyExpiryLimit limit) {
        boolean hasType = limit.getDocumentType() != null;
        boolean hasDept = limit.getDepartment() != null;
        if (!hasType && !hasDept) return "Global Default";
        if (hasType && hasDept) return limit.getDocumentType().getName() + " / " + limit.getDepartment().getName();
        if (hasType) return limit.getDocumentType().getName() + " (Any Department)";
        return limit.getDepartment().getName() + " (Any Document Type)";
    }

    private static final Set<String> VALID_DURATION_UNITS = Set.of("HOURS", "DAYS", "WEEKS", "MONTHS");

    /**
     * Applies the desired end-state of the Expiry Duration Policy: creates rows with no {@code id},
     * updates rows with a matching {@code id}, and deletes any existing non-system row whose id is
     * missing from {@code inputs}. A {@code null} list leaves the whole policy untouched (the
     * frontend always sends the full list when it means to change anything here). Returns the
     * per-row changes to append to the one consolidated Audit Trail entry for this save.
     */
    private List<AuditTrailChangeResponse> applyExpiryLimits(List<ControlledCopyExpiryLimitInput> inputs) {
        if (inputs == null) {
            return List.of();
        }
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        List<ControlledCopyExpiryLimit> existing = expiryLimitRepository.findAllByOrderByCreatedAtDesc();
        Map<UUID, ControlledCopyExpiryLimit> existingById = existing.stream()
                .collect(Collectors.toMap(ControlledCopyExpiryLimit::getId, x -> x));
        Set<UUID> keptIds = new HashSet<>();

        for (ControlledCopyExpiryLimitInput input : inputs) {
            boolean isNew = !StringUtils.hasText(input.id());
            ControlledCopyExpiryLimit limit;
            ExpiryRuleSnapshot before;
            if (isNew) {
                limit = new ControlledCopyExpiryLimit();
                before = null;
            } else {
                UUID id = UUID.fromString(input.id().trim());
                limit = existingById.get(id);
                if (limit == null) {
                    throw new IllegalArgumentException("Expiry rule not found: " + input.id());
                }
                before = expirySnapshot(limit);
                keptIds.add(id);
            }
            applyExpiryLimitInput(limit, input, existing);
            limit = expiryLimitRepository.save(limit);
            keptIds.add(limit.getId());

            String scope = describeExpiryScope(limit);
            ExpiryRuleSnapshot after = expirySnapshot(limit);
            for (AuditTrailChangeResponse c : diffExpiryRule(before, after)) {
                changes.add(new AuditTrailChangeResponse("Expiry Rule (" + scope + ") " + c.field(), c.oldValue(), c.newValue()));
            }
        }

        for (ControlledCopyExpiryLimit limit : existing) {
            if (limit.isSystem() || keptIds.contains(limit.getId())) {
                continue;
            }
            changes.add(new AuditTrailChangeResponse("Expiry Rule (" + describeExpiryScope(limit) + ")", "Present", "Deleted"));
            expiryLimitRepository.delete(limit);
        }
        return changes;
    }

    private List<AuditTrailChangeResponse> diffExpiryRule(ExpiryRuleSnapshot before, ExpiryRuleSnapshot after) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addIfChanged(changes, "documentType", before == null ? null : before.documentType(), after.documentType());
        addIfChanged(changes, "department", before == null ? null : before.department(), after.department());
        addIfChanged(changes, "duration", before == null ? null : before.duration(), after.duration());
        Boolean beforeActive = before == null ? null : before.active();
        if (!Objects.equals(beforeActive, after.active())) {
            changes.add(new AuditTrailChangeResponse("active",
                    beforeActive == null ? null : (beforeActive ? "Enabled" : "Disabled"),
                    after.active() ? "Enabled" : "Disabled"));
        }
        return changes;
    }

    private void addIfChanged(List<AuditTrailChangeResponse> changes, String field, String before, String after) {
        if (!Objects.equals(before, after)) {
            changes.add(new AuditTrailChangeResponse(field, before, after));
        }
    }

    /** Same validation the standalone /expiry-limits endpoints enforce (duplicate active scope, positive
     *  duration bounded per unit, Global Default's scope fixed) -- kept in sync manually since this path
     *  intentionally bypasses that service's own per-row signature/audit (see applyExpiryLimits). */
    private void applyExpiryLimitInput(ControlledCopyExpiryLimit limit, ControlledCopyExpiryLimitInput input,
                                        List<ControlledCopyExpiryLimit> existing) {
        if (input.durationValue() == null || input.durationValue() <= 0) {
            throw new IllegalArgumentException("Duration must be a positive number");
        }
        String unit = StringUtils.hasText(input.durationUnit()) ? input.durationUnit().trim().toUpperCase(java.util.Locale.ROOT) : "DAYS";
        if (!VALID_DURATION_UNITS.contains(unit)) {
            throw new IllegalArgumentException("Duration unit must be one of HOURS, DAYS, WEEKS, MONTHS");
        }
        int maxDuration = switch (unit) {
            case "HOURS" -> 24 * 365;
            case "DAYS" -> 3650;
            case "WEEKS" -> 520;
            default -> 120;
        };
        if (input.durationValue() > maxDuration) {
            throw new IllegalArgumentException("Duration for " + unit + " must not exceed " + maxDuration);
        }
        if (limit.isSystem()) {
            limit.setDurationValue(input.durationValue());
            limit.setDurationUnit(unit);
            return;
        }
        DocumentType documentType = null;
        if (StringUtils.hasText(input.documentTypeId())) {
            documentType = documentTypeRepository.findById(UUID.fromString(input.documentTypeId().trim()))
                    .orElseThrow(() -> new IllegalArgumentException("Document type not found"));
        }
        Department department = null;
        if (StringUtils.hasText(input.departmentId())) {
            department = departmentRepository.findById(UUID.fromString(input.departmentId().trim()))
                    .orElseThrow(() -> new IllegalArgumentException("Department not found"));
        }
        UUID excludeId = limit.getId();
        UUID nextDocumentTypeId = documentType == null ? null : documentType.getId();
        UUID nextDepartmentId = department == null ? null : department.getId();
        boolean duplicate = existing.stream()
                .filter(other -> other.isActive() && !Objects.equals(other.getId(), excludeId))
                .anyMatch(other -> Objects.equals(other.getDocumentType() == null ? null : other.getDocumentType().getId(), nextDocumentTypeId)
                        && Objects.equals(other.getDepartment() == null ? null : other.getDepartment().getId(), nextDepartmentId));
        if (duplicate && (input.active() == null || input.active())) {
            throw new IllegalArgumentException("An active expiry limit already exists for this document type/department combination");
        }
        limit.setDocumentType(documentType);
        limit.setDepartment(department);
        limit.setDurationValue(input.durationValue());
        limit.setDurationUnit(unit);
        limit.setActive(input.active() == null || input.active());
    }
}
