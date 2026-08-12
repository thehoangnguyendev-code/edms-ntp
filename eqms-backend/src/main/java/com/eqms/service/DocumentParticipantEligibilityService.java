package com.eqms.service;

import com.eqms.dto.security.EligibleParticipantResponse;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentWorkflowSetting;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentWorkflowSettingRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.auth.CurrentUserService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Candidate query used by the document participant picker.  This is deliberately
 * server-side: the UI must not infer eligibility from a role name or a cached
 * permission list.  Assignment mutations retain their existing validation as
 * the final concurrency-safe enforcement point.
 */
@Service
public class DocumentParticipantEligibilityService {
    private final DocumentRevisionRepository revisions;
    private final UserAccountRepository users;
    private final PermissionEvaluationService permissions;
    private final ObjectAccessEvaluationService objectAccess;
    private final RevisionWorkflowParticipantRepository revisionParticipants;
    private final DocumentWorkflowSettingRepository settings;
    private final CurrentUserService currentUserService;
    private final DocumentAuthorizationService documentAuthorizationService;

    public DocumentParticipantEligibilityService(
            DocumentRevisionRepository revisions,
            UserAccountRepository users,
            PermissionEvaluationService permissions,
            ObjectAccessEvaluationService objectAccess,
            RevisionWorkflowParticipantRepository revisionParticipants,
            DocumentWorkflowSettingRepository settings,
            CurrentUserService currentUserService,
            DocumentAuthorizationService documentAuthorizationService
    ) {
        this.revisions = revisions;
        this.users = users;
        this.permissions = permissions;
        this.objectAccess = objectAccess;
        this.revisionParticipants = revisionParticipants;
        this.settings = settings;
        this.currentUserService = currentUserService;
        this.documentAuthorizationService = documentAuthorizationService;
    }

    @Transactional(readOnly = true)
    public PageResponse<EligibleParticipantResponse> eligible(
            UUID revisionId, String participantType, String search, int page, int limit
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord revision = revisions.findById(revisionId)
                .orElseThrow(() -> new IllegalArgumentException("Revision not found"));
        documentAuthorizationService.requireCanViewRevision(currentUser, revision);
        String type = participantType.trim().toUpperCase(Locale.ROOT);
        String requiredPermission = switch (type) {
            case "REVIEWER" -> "documents.revision.review";
            case "APPROVER" -> "documents.revision.approve";
            default -> throw new IllegalArgumentException("Unsupported participant type: " + participantType);
        };
        String normalizedSearch = (search != null && !search.isBlank()) ? search.trim().toLowerCase(Locale.ROOT) : null;

        DocumentWorkflowSetting setting = settings.findFirstByOrderByIdAsc()
                .orElse(new DocumentWorkflowSetting());
        Set<UUID> excluded = excludedUserIds(revision, type, setting);
        Set<String> reviewerDepartments = reviewerDepartments(revisionId);

        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        Page<UserAccount> candidatePage = users.findParticipantCandidates(
                UserStatus.Active,
                normalizedSearch,
                PageRequest.of(safePage - 1, safeLimit, Sort.by(Sort.Order.asc("fullName"), Sort.Order.asc("id")))
        );

        List<EligibleParticipantResponse> items = candidatePage.getContent().stream()
                .filter(user -> !excluded.contains(user.getId()))
                .filter(user -> !("APPROVER".equals(type)
                        && setting.isReviewerAndApproverDifferentDepartments()
                        && user.getDepartment() != null
                        && reviewerDepartments.contains(user.getDepartment().trim().toUpperCase(Locale.ROOT))))
                .filter(user -> permissions.hasPermission(user, requiredPermission))
                .filter(user -> objectAccess.canAccessRevision(user, revision, "VIEW"))
                .map(user -> new EligibleParticipantResponse(user.getId(), user.getFullName(), user.getEmployeeCode(), user.getDepartment(), type))
                .toList();
        return new PageResponse<>(items, new PaginationResponse(
                candidatePage.getNumber() + 1,
                candidatePage.getSize(),
                candidatePage.getTotalElements(),
                candidatePage.getTotalPages()
        ));
    }

    private Set<UUID> excludedUserIds(
            DocumentRevisionRecord revision,
            String type,
            DocumentWorkflowSetting setting
    ) {
        Set<UUID> excluded = new HashSet<>();
        boolean selectingApprover = "APPROVER".equalsIgnoreCase(type);
        boolean selectingReviewer = "REVIEWER".equalsIgnoreCase(type);

        // Approval is always independent from authoring. Reviewer overlap is a
        // configured SoD policy and must match the mutation validators exactly.
        if (revision.getAuthor() != null && (selectingApprover
                || (selectingReviewer && setting.isAuthorCannotBeReviewerOrApprover()))) {
            excluded.add(revision.getAuthor().getId());
        }
        if (setting.isWorkflowCoordinatorCannotBeReviewerOrApprover()) {
            excluded.addAll(workflowCoordinatorUserIds());
        }

        for (RevisionWorkflowParticipant participant : revisionParticipants
                .findAllByRevision_IdOrderByParticipantTypeAscSequenceOrderAsc(revision.getId())) {
            if (participant.getUser() == null || type.equalsIgnoreCase(participant.getParticipantType())) {
                continue;
            }
            if ("CO_AUTHOR".equalsIgnoreCase(participant.getParticipantType())
                    && (selectingApprover
                    || (selectingReviewer && setting.isCoAuthorCannotBeReviewerOrApprover()))) {
                excluded.add(participant.getUser().getId());
                continue;
            }
            if (setting.isSameUserCannotHoldMultipleWorkflowRoles()
                    || ("APPROVER".equals(type) && setting.isReviewerNoApprove())) {
                excluded.add(participant.getUser().getId());
            }
        }
        return excluded;
    }

    private Set<String> reviewerDepartments(UUID revisionId) {
        return revisionParticipants.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revisionId, "REVIEWER")
                .stream()
                .map(RevisionWorkflowParticipant::getUser)
                .filter(user -> user != null && user.getDepartment() != null)
                .map(user -> user.getDepartment().trim().toUpperCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
    }

    private Set<UUID> workflowCoordinatorUserIds() {
        // DCO is an operational capability, not an inferred role-name or a
        // document-workflow-pool membership.  The explicit workspace permission
        // is the single RBAC entitlement that identifies users who may operate
        // document-control actions.  This keeps the eligibility rule aligned
        // with the workflow authorization service and prevents stale pool rows
        // from affecting participant selection.
        return users.findAllByStatus(UserStatus.Active).stream()
                .filter(user -> permissions.hasPermission(user, "documents.workspace.manage"))
                .map(UserAccount::getId)
                .filter(id -> id != null)
                .collect(java.util.stream.Collectors.toSet());
    }
}
