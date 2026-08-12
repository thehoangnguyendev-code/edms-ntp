package com.eqms.repository;

import com.eqms.entity.PublishingTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PublishingTemplateRepository extends JpaRepository<PublishingTemplate, UUID>, JpaSpecificationExecutor<PublishingTemplate> {
    Optional<PublishingTemplate> findByTemplateNameIgnoreCase(String templateName);
    List<PublishingTemplate> findByStatusOrderByTemplateNameAsc(String status);
}
