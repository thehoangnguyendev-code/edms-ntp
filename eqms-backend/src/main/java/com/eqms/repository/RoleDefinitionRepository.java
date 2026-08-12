package com.eqms.repository;

import com.eqms.entity.RoleDefinition;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface RoleDefinitionRepository extends JpaRepository<RoleDefinition, UUID>, JpaSpecificationExecutor<RoleDefinition> {
    Optional<RoleDefinition> findByName(String name);
    Optional<RoleDefinition> findByNameIgnoreCase(String name);
    Optional<RoleDefinition> findByCode(String code);
    Optional<RoleDefinition> findByCodeIgnoreCase(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RoleDefinition r where r.id = :id")
    Optional<RoleDefinition> findByIdForUpdate(@Param("id") UUID id);
}
