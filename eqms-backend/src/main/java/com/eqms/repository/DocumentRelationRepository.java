package com.eqms.repository;

import com.eqms.entity.DocumentRelation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentRelationRepository extends JpaRepository<DocumentRelation, UUID> {
    void deleteAllBySourceDocument_IdAndRelationType(UUID sourceDocumentId, String relationType);
    List<DocumentRelation> findAllBySourceDocument_IdAndRelationType(UUID sourceDocumentId, String relationType);
}
