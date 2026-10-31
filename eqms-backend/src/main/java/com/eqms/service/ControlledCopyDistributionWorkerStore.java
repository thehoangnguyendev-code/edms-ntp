package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Short claims and per-copy transactions. The job row fences both success and failure writers. */
@Service
public class ControlledCopyDistributionWorkerStore {
    private final JdbcTemplate jdbc;
    private final ControlledCopyRepository copies;
    private final UserAccountRepository users;
    private final ControlledCopyAuthorizationService authorization;
    private final ControlledCopyService processing;
    private final AuditTrailService audit;

    public ControlledCopyDistributionWorkerStore(JdbcTemplate jdbc,ControlledCopyRepository copies,
            UserAccountRepository users,ControlledCopyAuthorizationService authorization,
            ControlledCopyService processing,AuditTrailService audit) {
        this.jdbc=jdbc;this.copies=copies;this.users=users;this.authorization=authorization;
        this.processing=processing;this.audit=audit;
    }

    public record Claim(UUID jobId,UUID token,UUID batchId,UUID actorId,boolean notifyZip) { }
    public record Recovery(UUID jobId,UUID batchId,UUID actorId) { }
    public record Progress(int total,int processed,int failed,boolean errors) { }
    public record Completion(Progress progress,List<UUID> succeededCopies) { }
    public static final class LostClaim extends IllegalStateException {
        public LostClaim(){super("CONTROLLED_COPY_WORKER_CLAIM_LOST");}
    }

    @Transactional
    public Claim claim(UUID jobId,UUID actorId,boolean retry) {
        UUID token=UUID.randomUUID();
        String eligible=retry
                ? "j.status in ('FAILED','COMPLETED_WITH_ERRORS') and exists(select 1 from controlled_copy_distribution_job_items i where i.job_id=j.id and i.status='FAILED')"
                : "(j.status='PENDING' or (j.status='PROCESSING' and j.execution_protocol='FENCED_V1' and j.worker_lease_until<clock_timestamp()))";
        var rows=jdbc.queryForList("""
                with candidate as (select j.id from controlled_copy_distribution_jobs j
                  where j.id=? and j.action_type='DISTRIBUTE' and %s for update skip locked)
                update controlled_copy_distribution_jobs j set status='PROCESSING',execution_protocol='FENCED_V1',
                  worker_token=?,worker_lease_until=clock_timestamp()+interval '2 minutes',
                  execution_actor_id=case when ? then ?::uuid when j.status='PENDING' then coalesce(?::uuid,j.requested_by_user_id)
                    else coalesce(j.execution_actor_id,j.requested_by_user_id) end,
                  worker_notify_zip=case when ? then false when j.status='PENDING' then true else j.worker_notify_zip end,
                  started_at=coalesce(j.started_at,clock_timestamp()),completed_at=null
                from candidate where j.id=candidate.id
                returning j.id,j.batch_id,j.execution_actor_id,j.worker_notify_zip
                """.formatted(eligible),jobId,token,retry,actorId,actorId,retry);
        if(rows.isEmpty())return null;
        if(retry)jdbc.update("update controlled_copy_distribution_job_items set status='PENDING',last_error_code=null,last_error_message=null,completed_at=null where job_id=? and status='FAILED'",jobId);
        var row=rows.getFirst();
        return new Claim(jobId,token,(UUID)row.get("batch_id"),(UUID)row.get("execution_actor_id"),Boolean.TRUE.equals(row.get("worker_notify_zip")));
    }

    public List<Recovery> recoverable() {
        return jdbc.query("""
                select id,batch_id,coalesce(execution_actor_id,requested_by_user_id) as actor
                from controlled_copy_distribution_jobs where action_type='DISTRIBUTE' and
                  (status='PENDING' or (status='PROCESSING' and execution_protocol='FENCED_V1' and worker_lease_until<clock_timestamp()))
                order by created_at limit 10
                """,(rs,n)->new Recovery(rs.getObject("id",UUID.class),rs.getObject("batch_id",UUID.class),rs.getObject("actor",UUID.class)));
    }

    public UUID latestDistributionJob(UUID batchId) {
        var ids=jdbc.queryForList("select id from controlled_copy_distribution_jobs where batch_id=? and action_type='DISTRIBUTE' order by created_at desc,id desc limit 1",UUID.class,batchId);
        return ids.isEmpty()?null:ids.getFirst();
    }

    @Transactional
    public UUID nextItem(Claim claim) {
        lockJob(claim);
        var ids=jdbc.queryForList("select id from controlled_copy_distribution_job_items where job_id=? and status in ('PENDING','PROCESSING') order by id limit 1",UUID.class,claim.jobId());
        if(ids.isEmpty())return null;
        UUID id=ids.getFirst();
        jdbc.update("update controlled_copy_distribution_job_items set attempts=attempts+case when status='PENDING' then 1 else 0 end,status='PROCESSING',processing_started_at=clock_timestamp() where id=? and job_id=?",id,claim.jobId());
        renew(claim);
        return id;
    }

    @Transactional
    public ControlledCopyFinalizationOutcome processItem(Claim claim,UUID itemId) {
        lockJob(claim);
        var item=lockItem(claim,itemId);
        UUID copyId=(UUID)item.get("controlled_copy_id");
        if(!"PROCESSING".equals(item.get("status")))throw new LostClaim();
        var copy=lockCopy(copyId);
        if(terminal(copy)||!validParent(copy)) {
            finishItem(itemId,"SKIPPED","PARENT_OR_COPY_TERMINAL","The copy or its parent is no longer distributable.");
            renew(claim);
            return ControlledCopyFinalizationOutcome.SKIPPED_TERMINAL;
        }
        UserAccount actor=requireActor(claim,copy);
        ControlledCopyFinalizationOutcome outcome;
        try(var delivery=ControlledCopyDeliveryScope.enter()) {
            outcome=processing.finalizeDistributedCopy(copyId,actor.getId());
        }
        if(outcome==ControlledCopyFinalizationOutcome.FAILED)throw new IllegalStateException("FILE_PROCESSING_FAILED");
        finishItem(itemId,outcome==ControlledCopyFinalizationOutcome.SUCCESS?"SUCCESS":"SKIPPED",null,null);
        renew(claim);
        return outcome;
    }

    @Transactional
    public void failItem(Claim claim,UUID itemId,String message) {
        lockJob(claim);
        var item=lockItem(claim,itemId);
        if(!"PROCESSING".equals(item.get("status")))throw new LostClaim();
        var copy=lockCopy((UUID)item.get("controlled_copy_id"));
        if(terminal(copy)||!validParent(copy)) {
            finishItem(itemId,"SKIPPED","PARENT_OR_COPY_TERMINAL","The copy or its parent is no longer distributable.");
        } else {
            String code="FILE_PROCESSING_FAILED";
            try {
                var actor=requireActor(claim,copy);
                // Never roll back a copy whose credentials were already committed by a successful finalizer.
                if(!StringUtils.hasText(copy.getPreviewPasswordHash())) processing.markDistributedCopyProcessingFailed(copy.getId(),actor.getId(),message);
            } catch(AccessDeniedException denied) {
                code="DISTRIBUTION_AUTHORIZATION_CHANGED";
            }
            finishItem(itemId,"FAILED",code,message);
            var actor=users.findById(claim.actorId()).orElse(null);
            audit.logAs(actor,"CONTROLLED_COPY_DISTRIBUTION_JOB","Controlled copy distribution",claim.jobId(),
                    "DISTRIBUTION_JOB_ITEM_FAILED","PROCESSING","FAILED",message);
        }
        renew(claim);
    }

    public Progress progress(Claim claim) {
        var row=jdbc.queryForMap("""
                select count(*) as total,count(*) filter(where status in ('SUCCESS','FAILED','SKIPPED')) as processed,
                  count(*) filter(where status='FAILED') as failed,count(*) filter(where status in ('FAILED','SKIPPED')) as errors
                from controlled_copy_distribution_job_items where job_id=?
                """,claim.jobId());
        return new Progress(number(row,"total"),number(row,"processed"),number(row,"failed"),number(row,"errors")>0);
    }

    @Transactional
    public Completion complete(Claim claim) {
        lockJob(claim);
        var progress=progress(claim);
        if(progress.processed()!=progress.total())throw new IllegalStateException("Distribution items are not complete");
        jdbc.update("update controlled_copy_distribution_jobs set status=?,succeeded_items=(select count(*) from controlled_copy_distribution_job_items where job_id=? and status='SUCCESS'),failed_items=?,completed_at=clock_timestamp(),worker_token=null,worker_lease_until=null where id=? and worker_token=?",
                progress.errors()?"COMPLETED_WITH_ERRORS":"COMPLETED",claim.jobId(),progress.failed(),claim.jobId(),claim.token());
        var succeeded=claim.notifyZip()?jdbc.queryForList("select controlled_copy_id from controlled_copy_distribution_job_items where job_id=? and status='SUCCESS' order by id",UUID.class,claim.jobId()):List.<UUID>of();
        return new Completion(progress,succeeded);
    }

    private void lockJob(Claim claim) {
        var rows=jdbc.queryForList("select id from controlled_copy_distribution_jobs where id=? and worker_token=? and status='PROCESSING' and execution_protocol='FENCED_V1' and worker_lease_until>clock_timestamp() for update",claim.jobId(),claim.token());
        if(rows.isEmpty())throw new LostClaim();
    }
    private Map<String,Object> lockItem(Claim claim,UUID id) {
        return jdbc.queryForMap("select controlled_copy_id,status from controlled_copy_distribution_job_items where id=? and job_id=? for update",id,claim.jobId());
    }
    private ControlledCopyRecord lockCopy(UUID id) {
        var reference=jdbc.queryForMap("select document_id,revision_id from controlled_copies where id=?",id);
        jdbc.queryForList("select id from documents where id=? for share",reference.get("document_id"));
        jdbc.queryForList("select id from document_revisions where id=? for share",reference.get("revision_id"));
        jdbc.queryForList("select id from controlled_copies where id=? for update",id);
        var copy=copies.findById(id).orElseThrow(()->new IllegalStateException("Controlled copy not found"));
        if(!copy.getDocument().getId().equals(reference.get("document_id"))||!copy.getRevision().getId().equals(reference.get("revision_id")))throw new IllegalStateException("Controlled copy parent changed");
        return copy;
    }
    private UserAccount requireActor(Claim claim,ControlledCopyRecord copy) {
        var actor=users.findById(claim.actorId()).orElseThrow(()->new AccessDeniedException("Distribution actor no longer exists"));
        if(actor.getStatus()!=UserStatus.Active)throw new AccessDeniedException("Distribution actor is not active");
        if(copy.getDistributionBatch()==null||!claim.batchId().equals(copy.getDistributionBatch().getId()))throw new AccessDeniedException("Distribution item is outside this batch");
        authorization.requireRetryControlledCopyBatchAction(actor,copy.getDistributionBatch(),ControlledCopyWorkflowAction.DISTRIBUTE_BATCH);
        return actor;
    }
    private boolean terminal(ControlledCopyRecord copy) {
        return java.util.Set.of("OBSOLETED","CLOSED_CANCELLED","CANCELLED").contains(java.util.Objects.toString(copy.getStatusCode(),"").toUpperCase(java.util.Locale.ROOT));
    }
    private boolean validParent(ControlledCopyRecord copy) {
        return copy.getDocument().getStatus()!=null&&"ACTIVE".equals(copy.getDocument().getStatus().getCode())
                &&copy.getRevision().getStatus()!=null&&"EFFECTIVE".equals(copy.getRevision().getStatus().getCode());
    }
    private void finishItem(UUID id,String status,String code,String message) {
        jdbc.update("update controlled_copy_distribution_job_items set status=?,last_error_code=?,last_error_message=?,completed_at=clock_timestamp() where id=?",status,code,message,id);
    }
    private void renew(Claim claim) {
        jdbc.update("update controlled_copy_distribution_jobs set worker_lease_until=clock_timestamp()+interval '2 minutes' where id=? and worker_token=?",claim.jobId(),claim.token());
    }
    private static int number(Map<String,Object> row,String key){return ((Number)row.get(key)).intValue();}
}
