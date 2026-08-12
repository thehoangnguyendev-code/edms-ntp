package com.eqms.repository;
import com.eqms.entity.ControlledCopyDistributionJobItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
public interface ControlledCopyDistributionJobItemRepository extends JpaRepository<ControlledCopyDistributionJobItem, UUID> {
    List<ControlledCopyDistributionJobItem> findAllByJob_IdOrderByIdAsc(UUID jobId);
    List<ControlledCopyDistributionJobItem> findTop10ByStatusOrderByProcessingStartedAtAsc(String status);
    List<ControlledCopyDistributionJobItem> findAllByJob_IdAndStatusOrderByIdAsc(UUID jobId, String status);
}
