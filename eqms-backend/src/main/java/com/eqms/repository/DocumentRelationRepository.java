package com.eqms.repository;

import com.eqms.entity.DocumentRelation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentRelationRepository extends JpaRepository<DocumentRelation, UUID> {
    void deleteAllBySourceDocument_IdAndRelationType(UUID sourceDocumentId, String relationType);
    List<DocumentRelation> findAllBySourceDocument_IdAndRelationType(UUID sourceDocumentId, String relationType);
    /** The documents that list the given one as a related document (its parents). */
    List<DocumentRelation> findAllByTargetDocument_IdAndRelationType(UUID targetDocumentId, String relationType);
}
