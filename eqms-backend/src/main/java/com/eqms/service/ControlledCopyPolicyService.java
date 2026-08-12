package com.eqms.service;

import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyDistributionSecuritySection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRecallSection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyResponse;
import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyPolicySettingRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ControlledCopyPolicyService {

    private final ControlledCopyPolicySettingRepository repository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final SecurityChangeSignatureService securityChangeSignatureService;

    public ControlledCopyPolicyService(
            ControlledCopyPolicySettingRepository repository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            SecurityChangeSignatureService securityChangeSignatureService
    ) {
        this.repository = repository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.securityChangeSignatureService = securityChangeSignatureService;
    }

    @Transactional(readOnly = true)
    public ControlledCopyPolicyResponse getPolicy() {
        ControlledCopyPolicySetting s = loadOrDefault();
        return toResponse(s);
    }

    @Transactional
    public ControlledCopyPolicyResponse savePolicy(ControlledCopyPolicyRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(currentUser, "settings.controlled_copy_policy.manage")
                || permissionEvaluationService.isSuperAdmin(currentUser);
        if (!allowed) {
            throw new AccessDeniedException("Current user is not allowed to manage the controlled copy policy");
        }
        securityChangeSignatureService.requireValidToken(currentUser, request == null ? null : request.signatureToken());

        ControlledCopyPolicySetting s = loadOrDefault();
        String previousSummary = summarize(s);
        applyRequest(s, request);
        repository.save(s);

        securityChangeSignatureService.record(
                currentUser,
                request == null ? null : request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                "CONTROLLED_COPY_POLICY",
                s.getId(),
                "Controlled Copies Policy",
                request == null ? null : request.reason(),
                previousSummary,
                summarize(s)
        );
        return toResponse(s);
    }

    private String summarize(ControlledCopyPolicySetting s) {
        return "allowEmailDistribution=" + s.isAllowEmailDistribution()
                + ", allowPortalView=" + s.isAllowPortalView()
                + ", allowDownload=" + s.isAllowDownload()
                + ", allowPrint=" + s.isAllowPrint()
                + ", downloadOnce=" + s.isDownloadOnce()
                + ", printOnce=" + s.isPrintOnce()
                + ", watermarkEnabled=" + s.isWatermarkEnabled()
                + ", watermarkCopyNumber=" + s.isWatermarkCopyNumber()
                + ", watermarkRecipient=" + s.isWatermarkRecipient()
                + ", watermarkDistributedDate=" + s.isWatermarkDistributedDate()
                + ", watermarkExpiryDate=" + s.isWatermarkExpiryDate()
                + ", allowManualRecall=" + s.isAllowManualRecall()
                + ", allowReportLost=" + s.isAllowReportLost()
                + ", allowReportDamaged=" + s.isAllowReportDamaged()
                + ", allowReplacementForLostDamaged=" + s.isAllowReplacementForLostDamaged();
    }

    public ControlledCopyPolicySetting loadOrDefault() {
        return repository.findById(ControlledCopyPolicySetting.DEFAULT_ID)
                .orElseGet(() -> repository.save(new ControlledCopyPolicySetting()));
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
            if (ds.watermarkEnabled() != null) s.setWatermarkEnabled(ds.watermarkEnabled());
            if (ds.watermarkCopyNumber() != null) s.setWatermarkCopyNumber(ds.watermarkCopyNumber());
            if (ds.watermarkRecipient() != null) s.setWatermarkRecipient(ds.watermarkRecipient());
            if (ds.watermarkDistributedDate() != null) s.setWatermarkDistributedDate(ds.watermarkDistributedDate());
            if (ds.watermarkExpiryDate() != null) s.setWatermarkExpiryDate(ds.watermarkExpiryDate());
        }
        if (req.recallLostDamaged() != null) {
            var r = req.recallLostDamaged();
            if (r.allowManualRecall() != null) s.setAllowManualRecall(r.allowManualRecall());
            if (r.allowReportLost() != null) s.setAllowReportLost(r.allowReportLost());
            if (r.allowReportDamaged() != null) s.setAllowReportDamaged(r.allowReportDamaged());
            if (r.allowReplacementForLostDamaged() != null) s.setAllowReplacementForLostDamaged(r.allowReplacementForLostDamaged());
        }
    }

    private ControlledCopyPolicyResponse toResponse(ControlledCopyPolicySetting s) {
        return new ControlledCopyPolicyResponse(
                new ControlledCopyPolicyDistributionSecuritySection(
                        s.isAllowEmailDistribution(), s.isAllowPortalView(), s.isAllowDownload(), s.isAllowPrint(), s.isDownloadOnce(), s.isPrintOnce(),
                        s.isWatermarkEnabled(), s.isWatermarkCopyNumber(),
                        s.isWatermarkRecipient(), s.isWatermarkDistributedDate(), s.isWatermarkExpiryDate()
                ),
                new ControlledCopyPolicyRecallSection(
                        s.isAllowManualRecall(), s.isAllowReportLost(), s.isAllowReportDamaged(),
                        s.isAllowReplacementForLostDamaged()
                )
        );
    }
}
