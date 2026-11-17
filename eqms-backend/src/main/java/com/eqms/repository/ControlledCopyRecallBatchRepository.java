package com.eqms.repository;

import com.eqms.entity.ControlledCopyRecallBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

public interface ControlledCopyRecallBatchRepository
        extends JpaRepository<ControlledCopyRecallBatch, UUID>, JpaSpecificationExecutor<ControlledCopyRecallBatch> {

    /** Open drafts started by one user, newest first, so an interrupted review can be resumed. */
    java.util.List<ControlledCopyRecallBatch> findAllByCreatedBy_IdAndStatusOrderByCreatedAtDesc(UUID userId, String status);
}
