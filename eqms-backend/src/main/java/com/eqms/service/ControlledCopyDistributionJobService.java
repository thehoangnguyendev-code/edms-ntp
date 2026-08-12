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
}
