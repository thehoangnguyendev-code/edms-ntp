package com.eqms.repository;

import com.eqms.entity.PublishingWorkspaceJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PublishingWorkspaceJobRepository extends JpaRepository<PublishingWorkspaceJob, UUID> {
    Optional<PublishingWorkspaceJob> findTopByRevisionIdOrderByCreatedAtDesc(UUID revisionId);
    Optional<PublishingWorkspaceJob> findByIdAndRevisionId(UUID id, UUID revisionId);
}
