package com.eqms.repository;

import com.eqms.entity.ControlledCopyRecallItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ControlledCopyRecallItemRepository extends JpaRepository<ControlledCopyRecallItem, UUID> {

    List<ControlledCopyRecallItem> findAllByBatch_IdOrderByItemNoAsc(UUID batchId);

    Optional<ControlledCopyRecallItem> findByIdAndBatch_Id(UUID id, UUID batchId);

    long countByBatch_Id(UUID batchId);

    /** Items of OTHER draft batches that already claim these copies (a copy must not sit in two open drafts). */
    List<ControlledCopyRecallItem> findAllByControlledCopy_IdInAndBatch_StatusAndBatch_IdNot(
            Collection<UUID> copyIds, String batchStatus, UUID excludedBatchId);
}
