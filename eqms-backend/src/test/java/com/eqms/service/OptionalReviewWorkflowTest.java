package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.dto.document.RevisionWorkflowActionRequest;
import com.eqms.entity.*;
import com.eqms.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.lang.reflect.Modifier;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class OptionalReviewWorkflowTest {
    private <T> T service(Class<T> type) throws Exception {
        T service = mock(type, CALLS_REAL_METHODS);
        for (var field : type.getDeclaredFields()) {
            if (!Modifier.isStatic(field.getModifiers()) && field.getType().getName().startsWith("com.eqms.")) {
                ReflectionTestUtils.setField(service, field.getName(), mock(field.getType()));
            }
        }
        return service;
    }
    private <T> T dependency(Object service, String field, Class<T> type) {
        return type.cast(ReflectionTestUtils.getField(service, field));
    }
    @Test void optionalUploadStillRequiresApproverAndLeavesLegacyReviewGate() throws Exception {
        RevisionService service = service(RevisionService.class);
        var repository = dependency(service, "documentWorkflowParticipantRepository", DocumentWorkflowParticipantRepository.class);
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setReviewRequirement(ReviewRequirement.OPTIONAL);
        assertTrue(service.describeWhyDocumentWorkflowParticipantsAreMissing(document).startsWith("APPROVER_REQUIRED"));
        when(repository.findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(document.getId(), "APPROVER"))
                .thenReturn(List.of(new DocumentWorkflowParticipant()));
        assertNull(service.describeWhyDocumentWorkflowParticipantsAreMissing(document));
        document.setReviewRequirement(ReviewRequirement.REQUIRED);
        assertTrue(service.describeWhyDocumentWorkflowParticipantsAreMissing(document).startsWith("REVIEWER_REQUIRED"));
    }
    @Test void optionalReviewerValidationAllowsZeroButLegacyStillRejectsIt() throws Exception {
        RevisionService service = service(RevisionService.class);
        assertDoesNotThrow(() -> ReflectionTestUtils.invokeMethod(service, "validateReviewerIdsForRequirement", ReviewRequirement.OPTIONAL, 0));
        assertDoesNotThrow(() -> ReflectionTestUtils.invokeMethod(service, "validateReviewerIdsForRequirement", ReviewRequirement.OPTIONAL, 2));
        assertThrows(IllegalArgumentException.class, () -> ReflectionTestUtils.invokeMethod(service, "validateReviewerIdsForRequirement", ReviewRequirement.REQUIRED, 0));
        assertThrows(IllegalArgumentException.class, () -> ReflectionTestUtils.invokeMethod(service, "validateReviewerIdsForRequirement", ReviewRequirement.NONE, 1));
    }
    @Test void optionalReviewDoesNotBypassRoleIndependenceOrApproverRequirement() throws Exception {
        RevisionService service = service(RevisionService.class);
        DocumentWorkflowSetting setting = new DocumentWorkflowSetting();
        setting.setAuthorCannotBeReviewerOrApprover(true);
        when(dependency(service, "documentWorkflowSettingRepository", DocumentWorkflowSettingRepository.class).findFirstByOrderByIdAsc()).thenReturn(Optional.of(setting));
        UserAccount author = new UserAccount();
        author.setId(UUID.randomUUID());
        assertThrows(IllegalArgumentException.class, () -> ReflectionTestUtils.invokeMethod(service, "validateSoD", ReviewRequirement.OPTIONAL, author, List.of(), List.of(author.getId().toString()), List.of(UUID.randomUUID().toString())));
        assertThrows(IllegalArgumentException.class, () -> ReflectionTestUtils.invokeMethod(service, "validateSoD", ReviewRequirement.OPTIONAL, author, List.of(), List.of(), List.of()));
    }
    @Test void blankReviewerSignatureCellsOnlyForNewOptionalDocuments() throws Exception {
        ElectronicSignatureService service = service(ElectronicSignatureService.class);
        RevisionDetailResponse revision = mock(RevisionDetailResponse.class);
        UUID id = UUID.randomUUID();
        when(revision.id()).thenReturn(id.toString());
        when(revision.reviewRequirement()).thenReturn("OPTIONAL");
        List<String> keys = List.of("{{REVIEWED_SIGNATURE}}", "{{reviewerSignature1}}", "{{reviewerSignatures}}");
        Map<String, String> values = service.signaturePlaceholderValues(revision, keys);
        assertEquals(3, values.size());
        assertTrue(values.values().stream().allMatch(String::isEmpty));
        when(revision.reviewRequirement()).thenReturn("NONE");
        assertTrue(service.signaturePlaceholderValues(revision, keys).values().stream().noneMatch(String::isEmpty));
    }

    @Test void upgradeSnapshotRetainsDocumentPolicyForNewAndLegacyDocuments() throws Exception {
        RevisionService service = service(RevisionService.class);
        RevisionStatusDefinition draft = new RevisionStatusDefinition();
        draft.setCode("DRAFT");
        when(dependency(service, "revisionStatusRepository", RevisionStatusDefinitionRepository.class).findById("DRAFT"))
                .thenReturn(Optional.of(draft));
        DocumentRecord document = new DocumentRecord();
        document.setDocumentName("Form");
        UserAccount actor = new UserAccount();
        for (ReviewRequirement policy : ReviewRequirement.values()) {
            document.setReviewRequirement(policy);
            DocumentRevisionRecord upgraded = new DocumentRevisionRecord();
            ReflectionTestUtils.invokeMethod(service, "applyRevisionSnapshot", upgraded, document, actor,
                    new DocumentRevisionRecord(), "Upgrade", "2.0.0");
            assertEquals(policy, upgraded.getReviewRequirement());
            assertEquals("DRAFT", upgraded.getStatus().getCode());
        }
    }

    @Test void subtypeCannotBeConfiguredWithNewDocumentOnlyPolicy() throws Exception {
        DocumentTypeAdminService service = service(DocumentTypeAdminService.class);
        DocumentType type = new DocumentType();
        type.setActive(true);
        for (String policy : List.of("NONE", "REQUIRED", "OPTIONAL")) {
            assertThrows(IllegalArgumentException.class,
                    () -> ReflectionTestUtils.invokeMethod(service, "applyDocumentSubType", new DocumentSubType(),
                            new com.eqms.dto.dictionary.DocumentSubTypeDictionaryRequest("Type", UUID.randomUUID().toString(), null, policy, true), type, true));
        }
    }

    @Test void optionalDocumentsHaveAccurateKnowledgeLabel() {
        DocumentRecord document = new DocumentRecord();
        document.setReviewRequirement(ReviewRequirement.OPTIONAL);
        assertEquals("Review optional", com.eqms.enums.KnowledgeField.REVIEW_REQUIREMENT.valueOf(document).label());
    }

    @Test void editingSubtypeWithoutRemovedReviewFieldPreservesLegacyPolicy() throws Exception {
        DocumentTypeAdminService service = service(DocumentTypeAdminService.class);
        DocumentType type = new DocumentType();
        type.setActive(true);
        for (ReviewRequirement legacy : List.of(ReviewRequirement.NONE, ReviewRequirement.REQUIRED)) {
            DocumentSubType subtype = new DocumentSubType();
            subtype.setReviewRequirement(legacy);
            ReflectionTestUtils.invokeMethod(service, "applyDocumentSubType", subtype,
                    new com.eqms.dto.dictionary.DocumentSubTypeDictionaryRequest("Updated", UUID.randomUUID().toString(), null, null, true),
                    type, false);
            assertEquals(legacy, subtype.getReviewRequirement());
        }
    }

    @Test void choosingOrClearingSubtypeNeverChangesDocumentReviewPolicy() throws Exception {
        DocumentService service = service(DocumentService.class);
        DocumentType type = new DocumentType();
        type.setId(UUID.randomUUID());
        DocumentStatusDefinition draft = new DocumentStatusDefinition();
        draft.setCode("DRAFT");
        when(dependency(service, "statusRepository", DocumentStatusDefinitionRepository.class).findById("DRAFT"))
                .thenReturn(Optional.of(draft));
        DocumentSubType subtype = new DocumentSubType();
        subtype.setId(UUID.randomUUID());
        subtype.setName("Classification");
        subtype.setActive(true);
        subtype.setReviewRequirement(ReviewRequirement.NONE);
        when(dependency(service, "documentSubTypeRepository", DocumentSubTypeRepository.class)
                .findByDocumentType_IdAndNameIgnoreCase(type.getId(), subtype.getName()))
                .thenReturn(Optional.of(subtype));
        for (ReviewRequirement policy : ReviewRequirement.values()) {
            DocumentRecord document = new DocumentRecord();
            document.setId(UUID.randomUUID());
            document.setDocumentType(type);
            document.setTemplate(true);
            document.setReviewRequirement(policy);
            var request = mock(com.eqms.dto.document.DocumentDraftCreateRequest.class);
            when(request.subType()).thenReturn(subtype.getName());
            when(request.reasonForSkippingTraining()).thenReturn("Not required for this test document");
            ReflectionTestUtils.invokeMethod(service, "applyDraftFields", document, request, new UserAccount(), false);
            assertEquals(policy, document.getReviewRequirement());
            assertEquals(subtype.getId(), document.getSubTypeId());
            when(request.subType()).thenReturn("");
            ReflectionTestUtils.invokeMethod(service, "applyDraftFields", document, request, new UserAccount(), false);
            assertEquals(policy, document.getReviewRequirement());
            assertNull(document.getSubTypeId());
        }
    }

    @Test void submitRoutesByAssignedReviewersAndPersistsTransitionEvidence() throws Exception {
        for (boolean withReviewer : List.of(false, true)) {
            RevisionService service = service(RevisionService.class);
            var revisions = dependency(service, "revisionRepository", DocumentRevisionRepository.class);
            var participants = dependency(service, "revisionWorkflowParticipantRepository", RevisionWorkflowParticipantRepository.class);
            var signatures = dependency(service, "electronicSignatureService", ElectronicSignatureService.class);
            DocumentWorkflowSetting setting = new DocumentWorkflowSetting();
            setting.setAuthorCannotBeReviewerOrApprover(true);
            when(dependency(service, "documentWorkflowSettingRepository", DocumentWorkflowSettingRepository.class).findFirstByOrderByIdAsc())
                    .thenReturn(Optional.of(setting));
            UserAccount actor = new UserAccount();
            actor.setId(UUID.randomUUID());
            DocumentRecord document = new DocumentRecord();
            document.setId(UUID.randomUUID());
            document.setDocumentName("Optional review form");
            document.setReviewRequirement(ReviewRequirement.OPTIONAL);
            document.setAuthor(actor);
            DocumentRevisionRecord revision = new DocumentRevisionRecord();
            revision.setId(UUID.randomUUID());
            revision.setDocument(document);
            revision.setReviewRequirement(ReviewRequirement.OPTIONAL);
            revision.setRevisionNumber("1.0.0");
            revision.setSourceFileChecksum("unchanged-checksum");
            String target = withReviewer ? "PENDING_REVIEW" : "PENDING_APPROVAL";
            for (String code : List.of("DRAFT", target)) {
                RevisionStatusDefinition status = new RevisionStatusDefinition();
                status.setCode(code);
                status.setLabel(code);
                when(dependency(service, "revisionStatusRepository", RevisionStatusDefinitionRepository.class).findById(code))
                        .thenReturn(Optional.of(status));
                if (code.equals("DRAFT")) revision.setStatus(status);
            }
            UserAccount approver = new UserAccount();
            approver.setId(UUID.randomUUID());
            RevisionWorkflowParticipant approval = new RevisionWorkflowParticipant();
            approval.setId(UUID.randomUUID());
            approval.setUser(approver);
            when(participants.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "APPROVER"))
                    .thenReturn(List.of(approval));
            if (withReviewer) {
                UserAccount reviewer = new UserAccount();
                reviewer.setId(UUID.randomUUID());
                RevisionWorkflowParticipant review = new RevisionWorkflowParticipant();
                review.setId(UUID.randomUUID());
                review.setUser(reviewer);
                when(participants.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), "REVIEWER"))
                        .thenReturn(List.of(review));
            }
            when(revisions.findByIdForUpdate(revision.getId())).thenReturn(Optional.of(revision));
            when(dependency(service, "currentUserService", CurrentUserService.class).requireCurrentUser()).thenReturn(actor);
            when(signatures.hasRevisionSignatureMeaning(revision, "PREPARED")).thenReturn(true);
            when(dependency(service, "revisionWorkflowAuthorizationService", RevisionWorkflowAuthorizationService.class)
                    .check(any(), any(), any(), any()))
                    .thenReturn(mock(com.eqms.dto.security.WorkflowAuthorizationDecision.class));
            var request = new RevisionWorkflowActionRequest("Submit", "Ready", "test-signature-token");
            var response = service.submitForReview(revision.getId(), request);
            assertEquals(target, revision.getStatus().getCode());
            assertEquals("OPTIONAL", response.reviewRequirement());
            assertEquals("unchanged-checksum", revision.getSourceFileChecksum());
            verify(dependency(service, "signatureTokenConsumptionService", SignatureTokenConsumptionService.class))
                    .requireAndConsume(request.signatureToken(), actor);
            verify(dependency(service, "revisionWorkflowHistoryRepository", RevisionWorkflowHistoryRepository.class))
                    .save(argThat(history -> "DRAFT".equals(history.getFromStatus()) && target.equals(history.getToStatus())));
        }
    }
}
