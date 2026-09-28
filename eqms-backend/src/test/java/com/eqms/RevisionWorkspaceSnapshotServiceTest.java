package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.RevisionWorkspaceSnapshotResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionWorkspaceSnapshot;
import com.eqms.entity.UserAccount;
import com.eqms.repository.RevisionWorkspaceSnapshotRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.RevisionService;
import com.eqms.service.RevisionWorkspaceSnapshotService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevisionWorkspaceSnapshotServiceTest {

    @Mock RevisionWorkspaceSnapshotRepository snapshotRepository;
    @Mock RevisionService revisionService;
    @Mock CurrentUserService currentUserService;
    @Mock DocumentAuthorizationService documentAuthorizationService;

    @Test
    void getSnapshot_returnsWorkspaceStateAndStatusInTheirDeclaredFields() {
        UUID revisionId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        DocumentRecord document = new DocumentRecord();
        document.setId(documentId);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        revision.setDocument(document);

        RevisionWorkspaceSnapshot snapshot = new RevisionWorkspaceSnapshot();
        snapshot.setId(UUID.randomUUID());
        snapshot.setWorkspaceKey(revisionId + ":multi");
        snapshot.setSourceRevision(revision);
        snapshot.setSourceDocument(document);
        snapshot.setWorkspaceMode("multi");
        snapshot.setStatus("DRAFT");
        snapshot.setPayloadJson("{\"activeTab\":\"general\"}");
        snapshot.setCreatedAt(Instant.parse("2026-08-20T00:00:00Z"));
        snapshot.setUpdatedAt(Instant.parse("2026-08-20T00:01:00Z"));

        when(currentUserService.requireCurrentUser()).thenReturn(new UserAccount());
        when(revisionService.requireRevisionForSnapshot(revisionId)).thenReturn(revision);
        when(snapshotRepository.findBySourceRevision_IdAndWorkspaceMode(revisionId, "multi"))
                .thenReturn(Optional.of(snapshot));

        RevisionWorkspaceSnapshotService service = new RevisionWorkspaceSnapshotService(
                snapshotRepository,
                revisionService,
                new ObjectMapper(),
                currentUserService,
                documentAuthorizationService
        );

        RevisionWorkspaceSnapshotResponse response = service.getSnapshot(revisionId, "multi");

        assertThat(response.parentDocumentId()).isEqualTo(documentId);
        assertThat(response.sourceDocumentId()).isEqualTo(documentId);
        assertThat(response.workspaceState()).isEqualTo("{\"activeTab\":\"general\"}");
        assertThat(response.status()).isEqualTo("DRAFT");
        assertThat(response.payloadJson()).isEqualTo("{\"activeTab\":\"general\"}");
        verify(documentAuthorizationService).requireCanViewRevision(org.mockito.ArgumentMatchers.any(UserAccount.class), eq(revision));
    }
}
