package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentWorkflowSetting;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentWorkflowSettingRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.DocumentParticipantEligibilityService;
import com.eqms.service.ObjectAccessEvaluationService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

/**
 * Regression coverage for the eligible-participants information-disclosure fix:
 * the endpoint must require an authenticated current user AND that user must be
 * allowed to view the target revision before any candidate names/departments
 * are returned.
 */
@ExtendWith(MockitoExtension.class)
class DocumentParticipantEligibilityServiceTest {

    @Mock private DocumentRevisionRepository revisions;
    @Mock private UserAccountRepository users;
    @Mock private PermissionEvaluationService permissions;
    @Mock private ObjectAccessEvaluationService objectAccess;
    @Mock private RevisionWorkflowParticipantRepository revisionParticipants;
    @Mock private DocumentWorkflowSettingRepository settings;
    @Mock private CurrentUserService currentUserService;
    @Mock private DocumentAuthorizationService documentAuthorizationService;

    @InjectMocks
    private DocumentParticipantEligibilityService service;

    private UUID revisionId;
    private DocumentRevisionRecord revision;
    private UserAccount caller;

    @BeforeEach
    void setUp() {
        revisionId = UUID.randomUUID();
        revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(new DocumentRecord());

        caller = new UserAccount();
        caller.setId(UUID.randomUUID());
    }

    @Test
    void eligible_throwsWhenNoAuthenticatedUser() {
        when(currentUserService.requireCurrentUser())
                .thenThrow(new com.eqms.auth.UnauthorizedException("No current user"));

        assertThatThrownBy(() -> service.eligible(revisionId, "REVIEWER", null, 1, 20))
                .isInstanceOf(com.eqms.auth.UnauthorizedException.class);
    }

    @Test
    void eligible_deniesWhenCallerCannotViewRevision() {
        when(currentUserService.requireCurrentUser()).thenReturn(caller);
        when(revisions.findById(revisionId)).thenReturn(Optional.of(revision));
        doThrow(new AccessDeniedException("Revision access denied"))
                .when(documentAuthorizationService).requireCanViewRevision(caller, revision);

        assertThatThrownBy(() -> service.eligible(revisionId, "REVIEWER", null, 1, 20))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void eligible_returnsCandidatesWhenCallerCanViewRevision() {
        when(currentUserService.requireCurrentUser()).thenReturn(caller);
        when(revisions.findById(revisionId)).thenReturn(Optional.of(revision));
        when(settings.findFirstByOrderByIdAsc()).thenReturn(Optional.of(new DocumentWorkflowSetting()));
        when(revisionParticipants.findAllByRevision_IdOrderByParticipantTypeAscSequenceOrderAsc(revisionId))
                .thenReturn(List.of());
        when(revisionParticipants.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, "REVIEWER"))
                .thenReturn(List.of());
        when(users.findParticipantCandidates(eq(UserStatus.Active), isNull(), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        var result = service.eligible(revisionId, "REVIEWER", null, 1, 20);

        assertThat(result.data()).isEmpty();
    }
}
