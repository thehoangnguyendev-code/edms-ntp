package com.eqms.repository;

import com.eqms.entity.RevisionWorkflowParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevisionWorkflowParticipantRepository extends JpaRepository<RevisionWorkflowParticipant, UUID> {
    List<RevisionWorkflowParticipant> findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(UUID revisionId, String participantType);
    List<RevisionWorkflowParticipant> findAllByRevision_IdOrderByParticipantTypeAscSequenceOrderAsc(UUID revisionId);
    java.util.Optional<RevisionWorkflowParticipant> findByRevision_IdAndParticipantTypeAndUser_Id(UUID revisionId, String participantType, UUID userId);
    void deleteAllByRevision_Id(UUID revisionId);
    long countByRevision_IdAndParticipantTypeAndUser_Id(UUID revisionId, String participantType, UUID userId);
    long countByRevision_Document_IdAndUser_Id(UUID documentId, UUID userId);
    long countByRevision_IdAndUser_Id(UUID revisionId, UUID userId);
    long countByRevision_Status_CodeAndParticipantTypeAndUser_Id(String statusCode, String participantType, UUID userId);
    long countByRevision_IdAndParticipantTypeAndActionStatus(UUID revisionId, String participantType, String actionStatus);
}
