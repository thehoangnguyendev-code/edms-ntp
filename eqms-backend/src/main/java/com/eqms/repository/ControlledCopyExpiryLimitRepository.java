package com.eqms.repository;

import com.eqms.entity.ControlledCopyExpiryLimit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ControlledCopyExpiryLimitRepository extends JpaRepository<ControlledCopyExpiryLimit, UUID> {
    List<ControlledCopyExpiryLimit> findAllByActiveTrue();
    List<ControlledCopyExpiryLimit> findAllByOrderByCreatedAtDesc();
    boolean existsByDocumentType_Id(UUID documentTypeId);
    boolean existsByDepartment_Id(UUID departmentId);
}
