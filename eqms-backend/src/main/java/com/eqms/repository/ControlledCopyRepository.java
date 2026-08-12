package com.eqms.repository;

import com.eqms.entity.ControlledCopyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;

public interface ControlledCopyRepository extends JpaRepository<ControlledCopyRecord, UUID>, JpaSpecificationExecutor<ControlledCopyRecord> {
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ControlledCopyRecord c set c.downloadCount = c.downloadCount + 1, c.lastDownloadedAt = :now where c.id = :id and (:once = false or c.downloadCount < 1)")
    int consumeDownload(@Param("id") UUID id, @Param("now") Instant now, @Param("once") boolean once);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update ControlledCopyRecord c set c.printCount = c.printCount + 1 where c.id = :id and (:once = false or c.printCount < 1)")
    int consumePrint(@Param("id") UUID id, @Param("once") boolean once);
    List<ControlledCopyRecord> findAllByRevision_IdOrderByCopyNumberAsc(UUID revisionId);
    List<ControlledCopyRecord> findAllByRevision_Document_IdOrderByCreatedAtDesc(UUID documentId);
    List<ControlledCopyRecord> findAllByDistributionBatch_IdOrderByCopyNumberAsc(UUID distributionBatchId);
    Page<ControlledCopyRecord> findAllByDistributionBatch_Id(UUID distributionBatchId, Pageable pageable);
    long countByDistributionBatch_Id(UUID distributionBatchId);
    long countByDistributionBatch_IdAndStatusCode(UUID distributionBatchId, String statusCode);
    Optional<ControlledCopyRecord> findTopByDistributionBatch_IdOrderByCopyNumberAsc(UUID distributionBatchId);
    List<ControlledCopyRecord> findAllByStatusCodeAndHasExpiryDateTrueAndExpiryDateLessThanEqual(String statusCode, Instant expiryDate);
    List<ControlledCopyRecord> findAllByStatusCodeAndHasExpiryDateTrueAndExpiryReminderSentAtIsNullAndExpiryDateBetween(String statusCode, Instant from, Instant to);
    long countByDocument_Id(UUID documentId);
    Optional<ControlledCopyRecord> findByControlledCopyNumber(String controlledCopyNumber);
    Optional<ControlledCopyRecord> findTopByOrderByCreatedAtDesc();
    Optional<ControlledCopyRecord> findTopByDocument_IdOrderByCopyNumberDesc(UUID documentId);
    long countByCreatedAtIsNotNull();
    Optional<ControlledCopyRecord> findTopByReplacedControlledCopy_IdOrderByRequestedAtDesc(UUID replacedControlledCopyId);
}
