package com.eqms.repository;

import com.eqms.entity.DocumentRevisionTemplateLineage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DocumentRevisionTemplateLineageRepository extends JpaRepository<DocumentRevisionTemplateLineage, UUID> {
    Optional<DocumentRevisionTemplateLineage> findByTargetRevision_Id(UUID targetRevisionId);
}
