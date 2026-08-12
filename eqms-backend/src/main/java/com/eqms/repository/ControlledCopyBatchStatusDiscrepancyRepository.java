package com.eqms.repository;

import com.eqms.entity.ControlledCopyBatchStatusDiscrepancy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ControlledCopyBatchStatusDiscrepancyRepository extends JpaRepository<ControlledCopyBatchStatusDiscrepancy, UUID> {
    Optional<ControlledCopyBatchStatusDiscrepancy> findByBatch_IdAndStatus(UUID batchId, String status);
    Page<ControlledCopyBatchStatusDiscrepancy> findAllByStatusOrderByDetectedAtDesc(String status, Pageable pageable);
}
