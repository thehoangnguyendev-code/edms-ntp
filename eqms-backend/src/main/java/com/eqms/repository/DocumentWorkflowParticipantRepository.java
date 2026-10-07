package com.eqms.repository;

import com.eqms.entity.DocumentWorkflowParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DocumentWorkflowParticipantRepository extends JpaRepository<DocumentWorkflowParticipant, UUID> {
    void deleteAllByDocument_Id(UUID documentId);
    void deleteAllByDocument_IdAndParticipantType(UUID documentId, String participantType);
    List<DocumentWorkflowParticipant> findAllByDocument_IdOrderBySequenceOrderAsc(UUID documentId);
    List<DocumentWorkflowParticipant> findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(UUID documentId, String participantType);
    long countByDocument_IdAndParticipantType(UUID documentId, String participantType);

    /** The participants of many documents in one query (the Documents list shows them for a whole page), in workflow order. */
    @Query("select p from DocumentWorkflowParticipant p join fetch p.user where p.document.id in :documentIds order by p.sequenceOrder")
    List<DocumentWorkflowParticipant> findAllWithUserByDocumentIds(@Param("documentIds") Collection<UUID> documentIds);
}
