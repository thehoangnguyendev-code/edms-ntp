package com.eqms.service;

import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRelation;
import com.eqms.repository.DocumentRelationRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Footer of a related document (owner decision PUBLISHING-PARENT-FOOTER-2026-10-07): the document that lists this one as a RELATED
 * document is its parent; only its document number (no revision number) and name are printed, and a document without a parent
 * prints nothing, so one template footer serves every document type.
 */
class ParentDocumentFooterTest {

    private final DocumentRelationRepository repository = mock(DocumentRelationRepository.class);
    private final ParentDocumentResolver resolver = new ParentDocumentResolver(repository);
    private final PublishingTemplatePlaceholderMapperService mapper = new PublishingTemplatePlaceholderMapperService(resolver);

    private static DocumentRecord document(String number, String name) {
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setDocumentNumber(number);
        document.setDocumentName(name);
        return document;
    }

    private static DocumentRelation relation(DocumentRecord source) {
        DocumentRelation relation = new DocumentRelation();
        relation.setSourceDocument(source);
        relation.setRelationType("RELATED");
        return relation;
    }

    private RevisionDetailResponse revisionOf(UUID documentId) {
        RevisionDetailResponse revision = mock(RevisionDetailResponse.class);
        when(revision.documentId()).thenReturn(documentId.toString());
        return revision;
    }

    private String value(String placeholder, RevisionDetailResponse revision) {
        return mapper.mapPlaceholders(List.of(placeholder), revision).get(0).sampleValue();
    }

    @Test
    void the_parent_is_the_document_that_lists_this_one_as_related_and_only_its_number_and_name_are_used() {
        UUID formId = UUID.randomUUID();
        when(repository.findAllByTargetDocument_IdAndRelationType(eq(formId), eq("RELATED")))
                .thenReturn(List.of(relation(document("SOP.0007", "Computerized system validation"))));
        RevisionDetailResponse form = revisionOf(formId);

        assertThat(value("{{parentDocumentNumber}}", form)).isEqualTo("SOP.0007");
        assertThat(value("{{parentDocumentName}}", form)).isEqualTo("Computerized system validation");
        assertThat(value("{{parentDocumentLine}}", form))
                .isEqualTo("Issue and append to the document “Computerized system validation”/ code : SOP.0007");
        assertThat(value("{{parent_document_number}}", form)).isEqualTo("SOP.0007");
    }

    @Test
    void a_document_without_a_parent_prints_nothing_so_one_footer_fits_every_document() {
        UUID sopId = UUID.randomUUID();
        when(repository.findAllByTargetDocument_IdAndRelationType(any(), any())).thenReturn(List.of());
        RevisionDetailResponse sop = revisionOf(sopId);

        assertThat(value("{{parentDocumentLine}}", sop)).isEmpty();
        assertThat(value("{{parentDocumentName}}", sop)).isEmpty();
        assertThat(value("{{parentDocumentNumber}}", sop)).isEmpty();
    }

    @Test
    void only_related_documents_are_asked_for_never_correlated_ones() {
        UUID formId = UUID.randomUUID();
        resolver.parentOf(formId.toString());

        org.mockito.Mockito.verify(repository).findAllByTargetDocument_IdAndRelationType(formId, "RELATED");
        org.mockito.Mockito.verify(repository, org.mockito.Mockito.never()).findAllByTargetDocument_IdAndRelationType(any(), eq("CORRELATED"));
    }

    @Test
    void should_there_ever_be_several_parents_the_lowest_number_is_always_chosen() {
        UUID formId = UUID.randomUUID();
        when(repository.findAllByTargetDocument_IdAndRelationType(formId, "RELATED")).thenReturn(List.of(
                relation(document("SOP.0037", "Second")), relation(document("SOP.0002", "First"))));

        Optional<ParentDocumentResolver.Parent> parent = resolver.parentOf(formId.toString());

        assertThat(parent).map(ParentDocumentResolver.Parent::documentNumber).contains("SOP.0002");
    }

    @Test
    void a_missing_or_malformed_document_id_has_no_parent() {
        assertThat(resolver.parentOf(null)).isEmpty();
        assertThat(resolver.parentOf("not-a-uuid")).isEmpty();
        assertThat(mapper.mapPlaceholders(List.of("{{parentDocumentLine}}"), null).get(0).sampleValue()).isEmpty();
    }
}
