package com.eqms.repository;

import com.eqms.entity.PublishingTemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PublishingTemplateVersionRepository extends JpaRepository<PublishingTemplateVersion, UUID> {
    List<PublishingTemplateVersion> findByTemplate_IdOrderByVersionNumberDesc(UUID templateId);
    Optional<PublishingTemplateVersion> findTopByTemplate_IdOrderByVersionNumberDesc(UUID templateId);
    Optional<PublishingTemplateVersion> findByIdAndTemplate_Id(UUID id, UUID templateId);
}
