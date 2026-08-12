package com.eqms.repository;
import com.eqms.entity.ControlledCopyDistributionJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.UUID;
import java.util.List;
public interface ControlledCopyDistributionJobRepository extends JpaRepository<ControlledCopyDistributionJob, UUID> {
    @Modifying
    @Query("update ControlledCopyDistributionJob j set j.status = 'PROCESSING', j.startedAt = CURRENT_TIMESTAMP where j.id = :id and j.status = 'PENDING'")
    int claimPendingJob(@Param("id") UUID id);
    List<ControlledCopyDistributionJob> findTop10ByStatusOrderByCreatedAtAsc(String status);
    List<ControlledCopyDistributionJob> findByBatch_IdOrderByCreatedAtDesc(UUID batchId);
    List<ControlledCopyDistributionJob> findByBatch_IdAndActionTypeOrderByCreatedAtDesc(UUID batchId, String actionType);
}
