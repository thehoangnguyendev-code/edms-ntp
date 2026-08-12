package com.eqms.service;

import com.eqms.dto.document.RevisionWorkspaceSnapshotRequest;
import com.eqms.dto.document.RevisionWorkspaceSnapshotResponse;
import com.eqms.auth.CurrentUserService;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionWorkspaceSnapshot;
import com.eqms.entity.UserAccount;
import com.eqms.repository.RevisionWorkspaceSnapshotRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class RevisionWorkspaceSnapshotService {

    private final RevisionWorkspaceSnapshotRepository snapshotRepository;
    private final RevisionService revisionService;
    private final ObjectMapper objectMapper;
    private final CurrentUserService currentUserService;
    private final DocumentAuthorizationService documentAuthorizationService;

    public RevisionWorkspaceSnapshotService(
            RevisionWorkspaceSnapshotRepository snapshotRepository,
            RevisionService revisionService,
            ObjectMapper objectMapper,
            CurrentUserService currentUserService,
            DocumentAuthorizationService documentAuthorizationService
    ) {
        this.snapshotRepository = snapshotRepository;
        this.revisionService = revisionService;
        this.objectMapper = objectMapper;
        this.currentUserService = currentUserService;
        this.documentAuthorizationService = documentAuthorizationService;
    }

    @Transactional(readOnly = true)
    public RevisionWorkspaceSnapshotResponse getSnapshot(UUID sourceRevisionId, String workspaceMode) {
        String normalizedMode = normalizeMode(workspaceMode);
        RevisionWorkspaceSnapshot snapshot = snapshotRepository
                .findBySourceRevision_IdAndWorkspaceMode(sourceRevisionId, normalizedMode)
                .orElseThrow(() -> new IllegalArgumentException("Revision workspace snapshot not found"));
        return toResponse(snapshot);
    }

    @Transactional
    public RevisionWorkspaceSnapshotResponse saveSnapshot(RevisionWorkspaceSnapshotRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRevisionRecord sourceRevision = revisionService.requireRevisionForSnapshot(request.sourceRevisionId());
        // Previously had no authorization check at all beyond being logged in — any
        // authenticated user could save another user's workspace. Author/Co-Author only,
        // per explicit product decision (matches canEditDraftRevision's existing semantics).
        documentAuthorizationService.requireCanEditDraftRevision(currentUser, sourceRevision);
        DocumentRecord sourceDocument = sourceRevision.getDocument();
        String normalizedMode = normalizeMode(request.workspaceMode());
        String workspaceKey = buildWorkspaceKey(sourceRevision.getId(), normalizedMode);
        String workspaceStateJson = resolveWorkspaceStateJson(request);

        RevisionWorkspaceSnapshot snapshot = snapshotRepository.findByWorkspaceKey(workspaceKey)
                .orElseGet(RevisionWorkspaceSnapshot::new);

        Instant now = Instant.now();
        boolean isNew = snapshot.getId() == null;
        if (isNew) {
            snapshot.setId(UUID.randomUUID());
            snapshot.setCreatedAt(now);
            snapshot.setCreatedBy(currentUser);
        }

        snapshot.setWorkspaceKey(workspaceKey);
        snapshot.setSourceRevision(sourceRevision);
        snapshot.setSourceDocument(sourceDocument);
        snapshot.setWorkspaceMode(normalizedMode);
        snapshot.setStatus(StringUtils.hasText(request.status()) ? request.status().trim().toUpperCase(Locale.ROOT) : "DRAFT");
        snapshot.setPayloadJson(workspaceStateJson);
        snapshot.setUpdatedBy(currentUser);
        snapshot.setUpdatedAt(now);
        snapshotRepository.save(snapshot);

        return toResponse(snapshot);
    }

    private String buildWorkspaceKey(UUID sourceRevisionId, String workspaceMode) {
        return sourceRevisionId + ":" + normalizeMode(workspaceMode);
    }

    private String normalizeMode(String workspaceMode) {
        if (!StringUtils.hasText(workspaceMode)) {
            return "multi";
        }
        String normalized = workspaceMode.trim().toLowerCase(Locale.ROOT);
        return "standalone".equals(normalized) ? "standalone" : "multi";
    }

    private RevisionWorkspaceSnapshotResponse toResponse(RevisionWorkspaceSnapshot snapshot) {
        String workspaceStateJson = snapshot.getPayloadJson();
        return new RevisionWorkspaceSnapshotResponse(
                snapshot.getId(),
                snapshot.getWorkspaceKey(),
                snapshot.getSourceRevision() == null ? null : snapshot.getSourceRevision().getId(),
                snapshot.getSourceDocument() == null ? null : snapshot.getSourceDocument().getId(),
                snapshot.getSourceDocument() == null ? null : snapshot.getSourceDocument().getId(),
                snapshot.getWorkspaceMode(),
                snapshot.getStatus(),
                workspaceStateJson,
                workspaceStateJson,
                snapshot.getCreatedAt(),
                snapshot.getUpdatedAt()
        );
    }

    private String resolveWorkspaceStateJson(RevisionWorkspaceSnapshotRequest request) {
        if (request == null) {
            return "{}";
        }
        if (StringUtils.hasText(request.workspaceState())) {
            return request.workspaceState();
        }
        if (StringUtils.hasText(request.payloadJson())) {
            return request.payloadJson();
        }
        return "{}";
    }
}
