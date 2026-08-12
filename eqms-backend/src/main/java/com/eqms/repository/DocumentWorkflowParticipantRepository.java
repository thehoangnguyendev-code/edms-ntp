package com.eqms.repository;

import com.eqms.entity.DocumentWorkflowParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentWorkflowParticipantRepository extends JpaRepository<DocumentWorkflowParticipant, UUID> {
    void deleteAllByDocument_Id(UUID documentId);
    void deleteAllByDocument_IdAndParticipantType(UUID documentId, String participantType);
    List<DocumentWorkflowParticipant> findAllByDocument_IdOrderBySequenceOrderAsc(UUID documentId);
    List<DocumentWorkflowParticipant> findAllByDocument_IdAndParticipantTypeOrderBySequenceOrderAsc(UUID documentId, String participantType);
}
