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
    /**
     * findById() leaves every @ManyToOne (distributionBatch, requestedBy, distributedBy,
     * destroyedBy, recalledBy, cancelledBy, approvedBy, printedBy, recipientUser) as an
     * uninitialized lazy proxy -- fine within a request's own session, but
     * ControlledCopyNotificationAsyncService.notifyControlledCopyStakeholders() reads the copy on
     * a fresh @Async thread with no surrounding transaction (deliberately, so a slow SMTP send
     * never holds a DB connection open -- see that class's javadoc), and that method touches
     * every one of these (building the stakeholder list, resolving the recipient) -- each one
     * throws LazyInitializationException ("no session") the moment it's actually read, silently
     * swallowed by the caller's try/catch, which was dropping the ENTIRE notification (not just
     * one field) the first time any of them was hit. All are single-valued (@ManyToOne), so
     * JOIN FETCHing every one of them together is still exactly one row, no result multiplication.
     */
    @Query("select c from ControlledCopyRecord c"
            + " left join fetch c.distributionBatch"
            + " left join fetch c.requestedBy"
            + " left join fetch c.distributedBy"
            + " left join fetch c.destroyedBy"
            + " left join fetch c.recalledBy"
            + " left join fetch c.cancelledBy"
            + " left join fetch c.approvedBy"
            + " left join fetch c.printedBy"
            + " left join fetch c.recipientUser"
            + " where c.id = :id")
    Optional<ControlledCopyRecord> findByIdWithDistributionBatch(@Param("id") UUID id);

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
