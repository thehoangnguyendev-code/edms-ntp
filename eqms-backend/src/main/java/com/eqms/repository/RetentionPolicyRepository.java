package com.eqms.repository;

import com.eqms.entity.RetentionPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RetentionPolicyRepository extends JpaRepository<RetentionPolicy, UUID>, JpaSpecificationExecutor<RetentionPolicy> {
    Optional<RetentionPolicy> findByName(String name);
    Optional<RetentionPolicy> findByNameIgnoreCase(String name);
    List<RetentionPolicy> findAllByOrderByNameAsc();
}
