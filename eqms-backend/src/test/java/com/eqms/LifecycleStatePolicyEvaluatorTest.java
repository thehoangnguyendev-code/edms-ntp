package com.eqms;

import com.eqms.entity.LifecycleStatePolicy;
import com.eqms.entity.UserAccount;
import com.eqms.enums.LifecycleCapability;
import com.eqms.repository.LifecycleStatePolicyRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.service.LifecycleStatePolicyEvaluator;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Golden parity test: the evaluator loaded with the V169 system seeds must reproduce
 * the Phase A hardcoded strict-visibility rule exactly.
 */
@ExtendWith(MockitoExtension.class)
class LifecycleStatePolicyEvaluatorTest {

    @Mock LifecycleStatePolicyRepository policyRepository;
    @Mock RevisionWorkflowParticipantRepository participantRepository;
    @Mock PermissionEvaluationService permissionEvaluationService;

    @InjectMocks LifecycleStatePolicyEvaluator evaluator;

    private UserAccount user;
    private UUID userId;
    private UUID revisionId;

    private static LifecycleStatePolicy policy(String capability, String status, String scope, String permission) {
        LifecycleStatePolicy p = new LifecycleStatePolicy();
        p.setCapabilityCode(capability);
        p.setStatusCode(status);
        p.setActorScope(scope);
        p.setRequiredPermissionCode(permission);
        p.setActive(true);
        return p;
    }

    /** The V169 seed set, mirrored in-memory. */
    private static List<LifecycleStatePolicy> seeds(String capability) {
        List<LifecycleStatePolicy> all = new ArrayList<>();
        all.add(policy("VIEW", "EFFECTIVE", "ANY", "documents.document.view"));
        all.add(policy("VIEW", "OBSOLETED", "ANY", "documents.document.view"));
        all.add(policy("VIEW", null, "AUTHOR", null));
        all.add(policy("VIEW", null, "PARTICIPANT", null));
        for (String s : List.of("PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING")) {
            all.add(policy("PREVIEW", s, "PARTICIPANT", "documents.revision.preview"));
            all.add(policy("PREVIEW", s, "AUTHOR", "documents.revision.preview"));
        }
        return all.stream().filter(p -> p.getCapabilityCode().equals(capability)).toList();
    }

    @BeforeEach
    void setup() {
        userId = UUID.randomUUID();
        revisionId = UUID.randomUUID();
        user = new UserAccount();
        user.setId(userId);
        lenient().when(policyRepository
                .findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                        eq("documents"), eq("DOCUMENT_REVISION"), eq("VIEW")))
                .thenReturn(seeds("VIEW"));
        lenient().when(policyRepository
                .findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                        eq("documents"), eq("DOCUMENT_REVISION"), eq("PREVIEW")))
                .thenReturn(seeds("PREVIEW"));
        lenient().when(permissionEvaluationService.hasPermission(any(), anyString())).thenReturn(false);
        lenient().when(participantRepository.countByRevision_IdAndUser_Id(any(), any())).thenReturn(0L);
    }

    // ── VIEW parity ───────────────────────────────────────────────────────────

    @Test
    void view_effective_allowedForViewPermissionHolder() {
        when(permissionEvaluationService.hasPermission(user, "documents.document.view")).thenReturn(true);
        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "EFFECTIVE", null, revisionId, null)).isTrue();
        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "OBSOLETED", null, revisionId, null)).isTrue();
    }

    @Test
    void view_effective_deniedWithoutViewPermission() {
        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "EFFECTIVE", null, revisionId, null)).isFalse();
    }

    @Test
    void view_draft_deniedForNonParticipantEvenWithViewPermission() {
        lenient().when(permissionEvaluationService.hasPermission(user, "documents.document.view")).thenReturn(true);
        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "DRAFT", null, revisionId, null)).isFalse();
        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "PENDING_REVIEW", null, revisionId, null)).isFalse();
    }

    @Test
    void view_anyStatus_allowedForAuthor() {
        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "DRAFT", null, revisionId, userId)).isTrue();
    }

    @Test
    void view_anyStatus_allowedForParticipant() {
        when(participantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(1L);
        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "PENDING_APPROVAL", null, revisionId, null)).isTrue();
    }

    // ── PREVIEW parity ────────────────────────────────────────────────────────

    @Test
    void preview_pendingReview_allowedForParticipantWithPreviewPermission() {
        when(participantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(1L);
        when(permissionEvaluationService.hasPermission(user, "documents.revision.preview")).thenReturn(true);
        assertThat(evaluator.canPerform(user, LifecycleCapability.PREVIEW, "PENDING_REVIEW", null, revisionId, null)).isTrue();
    }

    @Test
    void preview_pendingReview_deniedForNonParticipant() {
        lenient().when(permissionEvaluationService.hasPermission(user, "documents.revision.preview")).thenReturn(true);
        assertThat(evaluator.canPerform(user, LifecycleCapability.PREVIEW, "PENDING_REVIEW", null, revisionId, null)).isFalse();
    }

    @Test
    void preview_participantWithoutPreviewPermission_denied() {
        when(participantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(1L);
        assertThat(evaluator.canPerform(user, LifecycleCapability.PREVIEW, "PENDING_REVIEW", null, revisionId, null)).isFalse();
    }

    @Test
    void preview_author_allowedWithPreviewPermission() {
        when(permissionEvaluationService.hasPermission(user, "documents.revision.preview")).thenReturn(true);
        assertThat(evaluator.canPerform(user, LifecycleCapability.PREVIEW, "PENDING_APPROVAL", null, revisionId, userId)).isTrue();
    }

    @Test
    void preview_draftStatus_noMatchingPolicy_denied() {
        lenient().when(permissionEvaluationService.hasPermission(user, "documents.revision.preview")).thenReturn(true);
        lenient().when(participantRepository.countByRevision_IdAndUser_Id(revisionId, userId)).thenReturn(1L);
        assertThat(evaluator.canPerform(user, LifecycleCapability.PREVIEW, "DRAFT", null, revisionId, userId)).isFalse();
    }

    // ── document-type scoping ─────────────────────────────────────────────────

    @Test
    void documentTypeScopedPolicy_onlyMatchesThatType() {
        UUID sopTypeId = UUID.randomUUID();
        LifecycleStatePolicy scoped = policy("VIEW", "DRAFT", "ANY", null);
        scoped.setDocumentTypeId(sopTypeId);
        when(policyRepository
                .findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
                        eq("documents"), eq("DOCUMENT_REVISION"), eq("VIEW")))
                .thenReturn(List.of(scoped));

        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "DRAFT", sopTypeId, revisionId, null)).isTrue();
        assertThat(evaluator.canPerform(user, LifecycleCapability.VIEW, "DRAFT", UUID.randomUUID(), revisionId, null)).isFalse();
    }
}
