package com.eqms.repository;

import com.eqms.entity.ControlledCopyRecallBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

public interface ControlledCopyRecallBatchRepository
        extends JpaRepository<ControlledCopyRecallBatch, UUID>, JpaSpecificationExecutor<ControlledCopyRecallBatch> {

    /** Open drafts started by one user, newest first, so an interrupted review can be resumed. */
    java.util.List<ControlledCopyRecallBatch> findAllByCreatedBy_IdAndStatusOrderByCreatedAtDesc(UUID userId, String status);

    /** Next value of the batch number sequence (RCB-yyyy-NNNNN). */
    @Query(value = "select nextval('controlled_copy_recall_batch_seq')", nativeQuery = true)
    long nextBatchSequence();
}
