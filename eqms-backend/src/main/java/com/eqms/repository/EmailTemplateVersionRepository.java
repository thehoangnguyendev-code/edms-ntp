package com.eqms.repository;

import com.eqms.entity.EmailTemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmailTemplateVersionRepository extends JpaRepository<EmailTemplateVersion, UUID> {
    List<EmailTemplateVersion> findByTemplateIdOrderByVersionNumberDesc(UUID templateId);
    Optional<EmailTemplateVersion> findTopByTemplateIdOrderByVersionNumberDesc(UUID templateId);
    Optional<EmailTemplateVersion> findByIdAndTemplateId(UUID id, UUID templateId);
}
