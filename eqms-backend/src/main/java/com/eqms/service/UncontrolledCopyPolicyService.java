package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyPolicyRequest;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyPolicyResponse;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UncontrolledCopyPolicySetting;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UncontrolledCopyPolicySettingRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Single-row Uncontrolled Copy policy settings service, mirroring {@link ControlledCopyPolicyService}'s
 * loadOrDefault/savePolicy/signature+audit pattern, simplified per plan: no expiry-limits sub-table,
 * no DCO delivery redirection -- only eligibility default (approval required), watermark/stamp
 * marking config, and validity-hours default.
 */
@Service
public class UncontrolledCopyPolicyService {

    private final UncontrolledCopyPolicySettingRepository repository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final SecurityChangeSignatureService securityChangeSignatureService;
    private final AuditTrailService auditTrailService;
    private final ControlledCopyPolicyService controlledCopyPolicyService;
    private final UncontrolledCopyRuleDraftService ruleDraftService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public UncontrolledCopyPolicyService(
            UncontrolledCopyPolicySettingRepository repository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            SecurityChangeSignatureService securityChangeSignatureService,
            AuditTrailService auditTrailService,
            ControlledCopyPolicyService controlledCopyPolicyService,
            UncontrolledCopyRuleDraftService ruleDraftService
    ) {
        this.repository = repository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.securityChangeSignatureService = securityChangeSignatureService;
        this.auditTrailService = auditTrailService;
        this.controlledCopyPolicyService = controlledCopyPolicyService;
        this.ruleDraftService = ruleDraftService;
    }

    /**
     * An unsaved draft marking (the policy screen's current edits, including drag-and-drop placements) merged over the
     * stored config and validated with the same rules as a save. Used by the server-rendered preview; nothing is stored.
     */
    public ControlledCopyStatusMarking draftMarking(ControlledCopyStatusMarking requested) {
        ControlledCopyStatusMarking stored = markingFor(loadOrDefault());
        return validated(requested == null ? stored : requested.mergedOver(stored));
    }

    /** Same field/placement rules as the Controlled Copies Policy; the watermark is mandatory so it is always enabled. */
    private ControlledCopyStatusMarking validated(ControlledCopyStatusMarking merged) {
        ControlledCopyStatusMarking checked = controlledCopyPolicyService.validatedStatusMarking(merged);
        return new ControlledCopyStatusMarking(
                Boolean.TRUE, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null
        ).mergedOver(checked);
    }

    @Transactional(readOnly = true)
    public UncontrolledCopyPolicyResponse getPolicy() {
        return toResponse(loadOrDefault());
    }

    @Cacheable(cacheNames = "uncontrolled-copy-policy", key = "'current'")
    public UncontrolledCopyPolicySetting loadOrDefault() {
        return repository.findById(UncontrolledCopyPolicySetting.DEFAULT_ID)
                .orElseGet(() -> repository.save(new UncontrolledCopyPolicySetting()));
    }

    /** The mandatory (non-optional) watermark/stamp config, current stored values over the built-in defaults. */
    public ControlledCopyStatusMarking markingFor(UncontrolledCopyPolicySetting s) {
        var defaults = defaultMarking();
        var stored = s == null || s.getMarking() == null ? null
                : objectMapper.convertValue(s.getMarking(), ControlledCopyStatusMarking.class);
        return stored == null ? defaults : stored.mergedOver(defaults);
    }

    public static ControlledCopyStatusMarking defaultMarking() {
        return new ControlledCopyStatusMarking(
                true, "ABOVE", "UNCONTROLLED COPY — NOT VALID FOR PRODUCTION USE", "#C00000", 25, 35, "NOTO_SANS", true, "ALL",
                true, "UNCONTROLLED COPY", "#C00000", "TOP_RIGHT", 4, "SMALL", 90,
                true, "NOTO_SANS", "ALL", java.util.List.of(), true, true, true);
    }

    @Transactional
    @CacheEvict(cacheNames = "uncontrolled-copy-policy", allEntries = true)
    public UncontrolledCopyPolicyResponse savePolicy(UncontrolledCopyPolicyRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(currentUser,
                "documents.admin.uncontrolled_copies_policy.manage", "settings.configuration.manage");
        if (!allowed) {
            throw new AccessDeniedException("Current user is not allowed to manage the uncontrolled copy policy");
        }
        securityChangeSignatureService.requireValidToken(currentUser, request == null ? null : request.signatureToken());

        // Do not mutate the shared cached entity: a rejected draft must not leak into reads.
        UncontrolledCopyPolicySetting s = repository.findById(UncontrolledCopyPolicySetting.DEFAULT_ID)
                .orElseGet(UncontrolledCopyPolicySetting::new);
        Snapshot before = snapshot(s);
        applyRequest(s, request);
        repository.save(s);
        Snapshot after = snapshot(s);
        List<AuditTrailChangeResponse> changes = diff(before, after);
        changes.addAll(ruleDraftService.apply(request == null ? null : request.eligibilityRuleChanges(), currentUser));

        String reason = request == null ? null : request.reason();
        ElectronicSignature signature = securityChangeSignatureService.record(
                currentUser,
                request == null ? null : request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                "UNCONTROLLED_COPY_POLICY",
                s.getId(),
                "Uncontrolled Copies Policy",
                reason,
                null,
                null
        );
        auditTrailService.logAs(
                currentUser,
                "UNCONTROLLED_COPY_POLICY",
                "Uncontrolled Copies Policy",
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

    private record Snapshot(boolean approvalRequired, int validityHours, boolean allowRedownload, java.util.Map<String, String> marking) {}

    private Snapshot snapshot(UncontrolledCopyPolicySetting s) {
        var m = markingFor(s);
        java.util.Map<String, String> flat = new java.util.LinkedHashMap<>();
        flat.put("watermarkText", m.watermarkText());
        flat.put("watermarkColor", m.watermarkColor());
        flat.put("stampText", m.stampText());
        flat.put("stampColor", m.stampColor());
        flat.put("stampPosition", m.stampPosition());
        // Drag-and-drop placement rules (edited on the PDF Markings preview) are part of the audited change set.
        flat.put("placements", m.placements() == null || m.placements().isEmpty() ? null : objectMapper.valueToTree(m.placements()).toString());
        return new Snapshot(s.isApprovalRequired(), s.getValidityHours(), s.isAllowRedownload(), flat);
    }

    private List<AuditTrailChangeResponse> diff(Snapshot before, Snapshot after) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        if (before.approvalRequired() != after.approvalRequired()) {
            changes.add(new AuditTrailChangeResponse("approvalRequired",
                    before.approvalRequired() ? "Enabled" : "Disabled", after.approvalRequired() ? "Enabled" : "Disabled"));
        }
        if (before.validityHours() != after.validityHours()) {
            changes.add(new AuditTrailChangeResponse("validityHours", String.valueOf(before.validityHours()), String.valueOf(after.validityHours())));
        }
        if (before.allowRedownload() != after.allowRedownload()) {
            changes.add(new AuditTrailChangeResponse("allowRedownload",
                    before.allowRedownload() ? "Enabled" : "Disabled", after.allowRedownload() ? "Enabled" : "Disabled"));
        }
        after.marking().forEach((field, value) -> {
            String previous = before.marking().get(field);
            if (!Objects.equals(previous, value)) {
                changes.add(new AuditTrailChangeResponse(field, previous, value));
            }
        });
        return changes;
    }

    private void applyRequest(UncontrolledCopyPolicySetting s, UncontrolledCopyPolicyRequest req) {
        if (req == null) {
            return;
        }
        if (req.approvalRequired() != null) s.setApprovalRequired(req.approvalRequired());
        if (req.validityHours() != null) {
            if (req.validityHours() < 1 || req.validityHours() > 8760) {
                throw new IllegalArgumentException("Validity hours must be between 1 and 8760");
            }
            s.setValidityHours(req.validityHours());
        }
        if (req.allowRedownload() != null) s.setAllowRedownload(req.allowRedownload());
        if (req.marking() != null) {
            var merged = validated(req.marking().mergedOver(markingFor(s)));
            s.setMarking(objectMapper.valueToTree(merged));
        }
    }

    private UncontrolledCopyPolicyResponse toResponse(UncontrolledCopyPolicySetting s) {
        return new UncontrolledCopyPolicyResponse(s.isApprovalRequired(), s.getValidityHours(), s.isAllowRedownload(), markingFor(s));
    }
}
