package com.eqms.repository;

import com.eqms.entity.UncontrolledCopyDistributionJobItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UncontrolledCopyDistributionJobItemRepository extends JpaRepository<UncontrolledCopyDistributionJobItem, UUID> {
    List<UncontrolledCopyDistributionJobItem> findAllByJob_IdOrderByIdAsc(UUID jobId);
    List<UncontrolledCopyDistributionJobItem> findTop10ByStatusOrderByProcessingStartedAtAsc(String status);
}
