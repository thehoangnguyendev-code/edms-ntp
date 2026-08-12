package com.eqms.repository;

import com.eqms.entity.PublishingTemplateComponent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PublishingTemplateComponentRepository extends JpaRepository<PublishingTemplateComponent, UUID> {
    List<PublishingTemplateComponent> findByTemplate_IdOrderByComponentTypeAscLayoutAsc(UUID templateId);
    Optional<PublishingTemplateComponent> findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(UUID templateId, String componentType, String layout);
}
