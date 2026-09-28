package com.eqms.service;

import com.eqms.entity.*;
import com.eqms.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class ControlledCopyDistributionJobService {
    public static final String PENDING = "PENDING";
    private final ControlledCopyDistributionJobRepository jobs;
    private final ControlledCopyDistributionJobItemRepository items;

    public ControlledCopyDistributionJobService(ControlledCopyDistributionJobRepository jobs, ControlledCopyDistributionJobItemRepository items) {
        this.jobs = jobs; this.items = items;
    }

    /** Creates exactly one durable item per copy; quantity is derived, never hard-coded. */
    @Transactional
    public ControlledCopyDistributionJob create(ControlledCopyDistributionBatch batch, UserAccount requestedBy, List<ControlledCopyRecord> copies) {
        return create(batch, requestedBy, copies, "DISTRIBUTE");
    }

    @Transactional
    public ControlledCopyDistributionJob create(ControlledCopyDistributionBatch batch, UserAccount requestedBy, List<ControlledCopyRecord> copies, String actionType) {
        ControlledCopyDistributionJob job = new ControlledCopyDistributionJob();
        job.setBatch(batch); job.setRequestedBy(requestedBy); job.setStatus(PENDING);
        job.setActionType(actionType == null ? "DISTRIBUTE" : actionType);
        job.setTotalItems(copies == null ? 0 : copies.size());
        job = jobs.save(job);
        if (copies != null) for (ControlledCopyRecord copy : copies) {
            ControlledCopyDistributionJobItem item = new ControlledCopyDistributionJobItem();
            item.setJob(job); item.setControlledCopy(copy); item.setStatus(PENDING); item.setAttempts(0);
            items.save(item);
        }
        return job;
    }
    public UUID idOf(ControlledCopyDistributionJob job) { return job == null ? null : job.getId(); }

    /** The copies a batch's most recent DISTRIBUTE run actually succeeded on, from the durable job/item
     *  records -- so a DCO batch ZIP can be rebuilt later (e.g. for the download link in the DCO's
     *  email) without depending on the in-memory list from the moment the batch first finished. */
    @Transactional(readOnly = true)
    public List<UUID> succeededDistributeCopyIds(UUID batchId) {
        if (batchId == null) {
            return List.of();
        }
        List<ControlledCopyDistributionJob> runs = jobs.findByBatch_IdAndActionTypeOrderByCreatedAtDesc(batchId, "DISTRIBUTE");
        if (runs.isEmpty()) {
            return List.of();
        }
        return items.findAllByJob_IdAndStatusOrderByIdAsc(runs.get(0).getId(), "SUCCESS").stream()
                .map(item -> item.getControlledCopy().getId())
                .toList();
    }
}
