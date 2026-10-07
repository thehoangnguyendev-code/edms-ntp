package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRelation;
import com.eqms.repository.DocumentRelationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.Optional;
import java.util.UUID;

/**
 * The parent of a related document (owner decision PUBLISHING-PARENT-FOOTER-2026-10-07). A SOP lists its forms and appendices as
 * Related Documents, so the parent of a form is the document that lists it with relation type RELATED (never CORRELATED). The
 * owner expects at most one parent; should there be several the one with the lowest document number is used, so the answer never
 * depends on the order the database returns rows in.
 */
@Service
public class ParentDocumentResolver {

    static final String RELATION_RELATED = "RELATED";

    /** The parent's own document number (for example SOP.0007, never with a revision number) and name. */
    public record Parent(String documentNumber, String documentName) {
        /** The sentence printed in the footer of a related document. */
        public String footerLine() {
            return "Issue and append to the document \u201C" + documentName + "\u201D/ code : " + documentNumber;
        }
    }

    private final DocumentRelationRepository relationRepository;

    public ParentDocumentResolver(DocumentRelationRepository relationRepository) {
        this.relationRepository = relationRepository;
    }

    @Transactional(readOnly = true)
    public Optional<Parent> parentOf(String documentId) {
        if (!StringUtils.hasText(documentId)) {
            return Optional.empty();
        }
        UUID id;
        try {
            id = UUID.fromString(documentId);
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
        return relationRepository.findAllByTargetDocument_IdAndRelationType(id, RELATION_RELATED).stream()
                .map(DocumentRelation::getSourceDocument)
                .filter(parent -> parent != null && StringUtils.hasText(parent.getDocumentNumber()))
                .min(Comparator.comparing(DocumentRecord::getDocumentNumber, String.CASE_INSENSITIVE_ORDER))
                .map(parent -> new Parent(parent.getDocumentNumber().trim(),
                        StringUtils.hasText(parent.getDocumentName()) ? parent.getDocumentName().trim() : ""));
    }
}
