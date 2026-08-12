package com.eqms.repository;

import com.eqms.entity.AuthorizationRelationDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuthorizationRelationDefinitionRepository extends JpaRepository<AuthorizationRelationDefinition, UUID> {
    List<AuthorizationRelationDefinition> findAllByOrderByResourceTypeAscCodeAsc();
    List<AuthorizationRelationDefinition> findAllByResourceTypeAndActiveTrueOrderByCodeAsc(String resourceType);
    Optional<AuthorizationRelationDefinition> findByCodeAndResourceType(String code, String resourceType);
}
