package com.eqms.repository;

import com.eqms.entity.EmailTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, UUID>, JpaSpecificationExecutor<EmailTemplate> {
    Optional<EmailTemplate> findByName(String name);
    Optional<EmailTemplate> findTopByTypeIgnoreCaseAndStatusIgnoreCaseOrderByUpdatedDateDesc(String type, String status);
}
