package com.eqms.repository;

import com.eqms.entity.UncontrolledCopyEligibilityRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UncontrolledCopyEligibilityRuleRepository extends JpaRepository<UncontrolledCopyEligibilityRule, UUID> {
    List<UncontrolledCopyEligibilityRule> findAllByActiveTrue();

    boolean existsByDocumentType_Id(UUID documentTypeId);
}
