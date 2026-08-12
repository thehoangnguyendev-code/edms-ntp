package com.eqms.repository;

import com.eqms.entity.RevisionPublishingMetadata;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RevisionPublishingMetadataRepository extends JpaRepository<RevisionPublishingMetadata, UUID> {
    Optional<RevisionPublishingMetadata> findByRevision_Id(UUID revisionId);
}
