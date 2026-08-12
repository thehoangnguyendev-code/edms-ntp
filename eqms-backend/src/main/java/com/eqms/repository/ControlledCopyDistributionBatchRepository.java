package com.eqms.repository;

import com.eqms.entity.ControlledCopyDistributionBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ControlledCopyDistributionBatchRepository extends JpaRepository<ControlledCopyDistributionBatch, UUID>, JpaSpecificationExecutor<ControlledCopyDistributionBatch> {
    Optional<ControlledCopyDistributionBatch> findByBatchNumber(String batchNumber);
    List<ControlledCopyDistributionBatch> findAllByStatusCodeOrderByRequestedAtDesc(String statusCode);
    List<ControlledCopyDistributionBatch> findAllByDocument_Id(UUID documentId);
    List<ControlledCopyDistributionBatch> findAllByBatchNumberStartingWith(String prefix);
    List<ControlledCopyDistributionBatch> findAllByStatusCodeNotIn(List<String> statusCodes);
    Page<ControlledCopyDistributionBatch> findAllByStatusCodeNotIn(List<String> statusCodes, Pageable pageable);
}
