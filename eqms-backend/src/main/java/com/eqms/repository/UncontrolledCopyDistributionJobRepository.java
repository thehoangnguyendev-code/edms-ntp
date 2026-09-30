package com.eqms.repository;

import com.eqms.entity.UncontrolledCopyDistributionJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface UncontrolledCopyDistributionJobRepository extends JpaRepository<UncontrolledCopyDistributionJob, UUID> {
    @Modifying
    @Query("update UncontrolledCopyDistributionJob j set j.status = 'PROCESSING', j.startedAt = CURRENT_TIMESTAMP where j.id = :id and j.status = 'PENDING'")
    int claimPendingJob(@Param("id") UUID id);
    List<UncontrolledCopyDistributionJob> findTop10ByStatusOrderByCreatedAtAsc(String status);
    List<UncontrolledCopyDistributionJob> findByUncontrolledCopy_IdOrderByCreatedAtDesc(UUID uncontrolledCopyId);
}
