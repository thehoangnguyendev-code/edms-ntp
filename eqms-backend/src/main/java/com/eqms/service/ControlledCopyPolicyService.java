package com.eqms.service;

import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyDeliverySection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyDistributionSecuritySection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRecallSection;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyResponse;
import com.eqms.auth.CurrentUserService;
import com.eqms.entity.ControlledCopyPolicySetting;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyPolicySettingRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

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

    public ControlledCopyPolicyService(
            ControlledCopyPolicySettingRepository repository,
            UserAccountRepository userAccountRepository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            SecurityChangeSignatureService securityChangeSignatureService
    ) {
        this.repository = repository;
        this.userAccountRepository = userAccountRepository;
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
                + ", allowReportLostDamaged=" + s.isAllowReportLostDamaged()
                + ", allowReplacementForLostDamaged=" + s.isAllowReplacementForLostDamaged()
                + ", redirectDeliveryToDco=" + s.isRedirectDeliveryToDco()
                + ", dcoRecipientUserId=" + s.getDcoRecipientUserId();
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

    private ControlledCopyPolicyResponse toResponse(ControlledCopyPolicySetting s) {
        UserAccount dco = s.getDcoRecipientUserId() == null ? null : userAccountRepository.findById(s.getDcoRecipientUserId()).orElse(null);
        return new ControlledCopyPolicyResponse(
                new ControlledCopyPolicyDistributionSecuritySection(
                        s.isAllowEmailDistribution(), s.isAllowPortalView(), s.isAllowDownload(), s.isAllowPrint(), s.isDownloadOnce(), s.isPrintOnce(),
                        s.isWatermarkEnabled(), s.isWatermarkCopyNumber(),
                        s.isWatermarkRecipient(), s.isWatermarkDistributedDate(), s.isWatermarkExpiryDate()
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
                )
        );
    }
}
