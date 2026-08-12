package com.eqms.repository;

import com.eqms.entity.NotificationEventDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface NotificationEventDefinitionRepository
        extends JpaRepository<NotificationEventDefinition, java.util.UUID>, JpaSpecificationExecutor<NotificationEventDefinition> {

    Optional<NotificationEventDefinition> findByCode(String code);

    boolean existsByCode(String code);
}
