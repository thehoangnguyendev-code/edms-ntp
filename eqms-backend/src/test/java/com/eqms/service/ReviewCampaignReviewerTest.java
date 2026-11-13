package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailReviewDtos;
import com.eqms.dto.user.AccessReviewDtos;
import com.eqms.entity.AccessReviewCampaign;
import com.eqms.entity.AuditTrailReviewCampaign;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.AccessReviewCampaignRepository;
import com.eqms.repository.AccessReviewItemRepository;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.AuditTrailReviewCampaignRepository;
import com.eqms.repository.AuditTrailReviewItemRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION-ADMIN-2026-11-12 (owner chose "add a reviewer field"): a campaign of Access Review or Audit Trail Review is given to the reviewer the creator names, so that the
 * notification "you were assigned" has a person to tell. Without a name the creator reviews, as before; a person who cannot act on the campaign is refused.
 */
class ReviewCampaignReviewerTest {

    private static UserAccount user(String name, UserStatus status) {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setFullName(name);
        u.setStatus(status);
        return u;
    }

    private final UserAccount creator = user("Creator", UserStatus.Active);
    private final UserAccount reviewer = user("Reviewer", UserStatus.Active);
    private final UserAccount outsider = user("Outsider", UserStatus.Active);
    private final UserAccount gone = user("Gone", UserStatus.Suspended);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);

    @BeforeEach
    void setUp() {
        when(current.requireCurrentUser()).thenReturn(creator);
        when(users.findById(reviewer.getId())).thenReturn(Optional.of(reviewer));
        when(users.findById(outsider.getId())).thenReturn(Optional.of(outsider));
        when(users.findById(gone.getId())).thenReturn(Optional.of(gone));
        for (String code : List.of("security.access_review.manage", "audit.review.manage")) {
            when(permissions.hasPermission(creator, code)).thenReturn(true);
            when(permissions.hasPermission(reviewer, code)).thenReturn(true);
            when(permissions.hasPermission(gone, code)).thenReturn(true);
            when(permissions.hasPermission(outsider, code)).thenReturn(false);
        }
        when(users.findAllByStatus(UserStatus.Active)).thenReturn(List.of(outsider, reviewer, creator));
    }

    // ------------------------------------------------------------------ access review

    private AccessReviewService accessReview(AccessReviewCampaignRepository campaigns) {
        when(campaigns.save(any(AccessReviewCampaign.class))).thenAnswer(inv -> inv.getArgument(0));
        return new AccessReviewService(campaigns, mock(AccessReviewItemRepository.class), users, mock(UserAccessProfileRepository.class),
                mock(com.eqms.service.EffectivePermissionService.class), permissions, current, audit, mock(SecurityChangeSignatureService.class),
                mock(ElectronicSignatureService.class));
    }

    @Test
    void aCampaignOfAccessReviewIsGivenToTheReviewerTheCreatorNamesAndTheAuditNamesThem() {
        var campaigns = mock(AccessReviewCampaignRepository.class);
        var service = accessReview(campaigns);
        try {
            service.createCampaign(new AccessReviewDtos.CampaignCreateRequest("Q4", null, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), reviewer.getId()));
        } catch (RuntimeException afterTheSave) {
            // the campaign is read back with mocks that know nothing of it; what matters is what was saved
        }
        ArgumentCaptor<AccessReviewCampaign> saved = ArgumentCaptor.forClass(AccessReviewCampaign.class);
        verify(campaigns).save(saved.capture());
        assertThat(saved.getValue().getReviewer()).isSameAs(reviewer);
        assertThat(saved.getValue().getCreatedBy()).isSameAs(creator);
    }

    @Test
    void withoutANameTheCreatorReviewsAsBefore() {
        var campaigns = mock(AccessReviewCampaignRepository.class);
        var service = accessReview(campaigns);
        try {
            service.createCampaign(new AccessReviewDtos.CampaignCreateRequest("Q4", null, null, null));
        } catch (RuntimeException afterTheSave) {
            // see above
        }
        ArgumentCaptor<AccessReviewCampaign> saved = ArgumentCaptor.forClass(AccessReviewCampaign.class);
        verify(campaigns).save(saved.capture());
        assertThat(saved.getValue().getReviewer()).isSameAs(creator);
    }

    @Test
    void aReviewerWhoCannotActOnTheCampaignIsRefusedAndNothingIsSaved() {
        var campaigns = mock(AccessReviewCampaignRepository.class);
        var service = accessReview(campaigns);
        for (UUID bad : List.of(outsider.getId(), gone.getId(), UUID.randomUUID())) {
            assertThatThrownBy(() -> service.createCampaign(new AccessReviewDtos.CampaignCreateRequest("Q4", null, null, null, bad)))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("reviewer");
        }
        verify(campaigns, never()).save(any());
    }

    @Test
    void theListOfPeopleWhoMayReviewHoldsOnlyActiveUsersWhoMayManageReviewsInNameOrder() {
        var service = accessReview(mock(AccessReviewCampaignRepository.class));
        assertThat(service.reviewers()).extracting(AccessReviewDtos.ReviewerOption::name).containsExactly("Creator", "Reviewer");
    }

    // ------------------------------------------------------------------ audit trail review

    private AuditTrailReviewService auditReview(AuditTrailReviewCampaignRepository campaigns) {
        when(campaigns.save(any(AuditTrailReviewCampaign.class))).thenAnswer(inv -> inv.getArgument(0));
        return new AuditTrailReviewService(users, campaigns, mock(AuditTrailReviewItemRepository.class), mock(AuditLogRepository.class), permissions, current, audit,
                mock(SecurityChangeSignatureService.class), mock(ElectronicSignatureService.class));
    }

    @Test
    void aCampaignOfAuditTrailReviewIsGivenToTheReviewerTheCreatorNames() {
        var campaigns = mock(AuditTrailReviewCampaignRepository.class);
        var service = auditReview(campaigns);
        try {
            service.createCampaign(new AuditTrailReviewDtos.CampaignCreateRequest("Nov", null, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), reviewer.getId()));
        } catch (RuntimeException afterTheSave) {
            // see above
        }
        ArgumentCaptor<AuditTrailReviewCampaign> saved = ArgumentCaptor.forClass(AuditTrailReviewCampaign.class);
        verify(campaigns).save(saved.capture());
        assertThat(saved.getValue().getReviewer()).isSameAs(reviewer);
    }

    @Test
    void anAuditTrailReviewerWhoCannotActOnTheCampaignIsRefused() {
        var campaigns = mock(AuditTrailReviewCampaignRepository.class);
        var service = auditReview(campaigns);
        assertThatThrownBy(() -> service.createCampaign(new AuditTrailReviewDtos.CampaignCreateRequest("Nov", null, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), outsider.getId())))
                .hasMessageContaining("reviewer");
        verify(campaigns, never()).save(any());
        assertThat(service.reviewers()).extracting(AuditTrailReviewDtos.ReviewerOption::name).containsExactly("Creator", "Reviewer");
    }
}
