package com.eqms.repository;

import com.eqms.entity.WorkflowParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Generic (objectType, objectId) participant lookups — Phase -1 of
 * docs/SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md. Only consulted when
 * {@code app.security.generic-workflow-participants-enabled=true}.
 */
public interface WorkflowParticipantRepository extends JpaRepository<WorkflowParticipant, UUID> {

    Optional<WorkflowParticipant> findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id(
            String objectType, UUID objectId, String participantType, UUID userId);

    /** F-06: sequence-order lookup mirroring RevisionService's write-model
     * nextPendingParticipant(), so the authorization/capability read path and the mutation
     * write path never disagree about whose turn it is to act. */
    List<WorkflowParticipant> findAllByObjectTypeAndObjectIdAndParticipantTypeOrderBySequenceOrderAsc(
            String objectType, UUID objectId, String participantType);
}
