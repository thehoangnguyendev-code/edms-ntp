package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.publishing.PublishingWorkspaceRequest;
import com.eqms.entity.PublishingWorkspaceJob;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UsedSignatureTokenRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Durable command accepted with a single-use signature; worker result and completion share one transaction. */
@Service
public class PublishingCommandService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final PublishingWorkspaceJobService jobs;
    private final SignatureTokenConsumptionService signatures;
    private final UsedSignatureTokenRepository consumedTokens;
    private final CurrentUserService users;
    private final PermissionEvaluationService permissions;
    private final RevisionService revisions;
    private final PublishingWorkspaceService workspace;
    private final EntityManager entities;
    private final PublishingCommandStore store;
    private final AuditTrailService audit;

    public PublishingCommandService(JdbcTemplate jdbc, ObjectMapper mapper, PublishingWorkspaceJobService jobs,
            SignatureTokenConsumptionService signatures, UsedSignatureTokenRepository consumedTokens,
            CurrentUserService users, PermissionEvaluationService permissions, RevisionService revisions,
            PublishingWorkspaceService workspace, EntityManager entities, AuditTrailService audit) {
        this.jdbc=jdbc; this.mapper=mapper; this.jobs=jobs; this.signatures=signatures;
        this.consumedTokens=consumedTokens; this.users=users; this.permissions=permissions;
        this.revisions=revisions; this.workspace=workspace; this.entities=entities;
        this.store=new PublishingCommandStore(jdbc,mapper,entities);
        this.audit=audit;
    }

    @Transactional
    public PublishingWorkspaceJob acceptPublish(UUID revisionId, UUID userId, PublishingWorkspaceRequest request) {
        UserAccount actor = requireActor(userId);
        if (request == null || !org.springframework.util.StringUtils.hasText(
                org.springframework.util.StringUtils.hasText(request.changeSummary()) ? request.changeSummary() : request.reason())) {
            throw new IllegalArgumentException("Signing reason is required");
        }
        var bundle = store.publishBundle(revisions.capturePublishConfirmationBundle(revisionId, actor, Boolean.TRUE.equals(request.forcePublishRelated())));
        String binding = store.contentBinding(revisionId);
        UUID confirmationId = signatures.requireAndConsume(request.signatureToken(), actor);
        consumedTokens.flush(); // Materialize the nonce before the command FK is inserted through JDBC.
        PublishingWorkspaceJob job = jobs.createPublishJob(revisionId, userId, request);
        entities.flush();
        ObjectNode payload = store.sanitized(request);
        jdbc.update("""
                insert into publishing_job_commands(job_id,command_type,payload,bundle,content_binding,confirmation_id,confirmed_at,confirmation_context)
                values(?,'PUBLISH',?::jsonb,?::jsonb,?,?,now(),?::jsonb)
                """, job.getId(), store.json(payload), store.json(bundle), binding, confirmationId, store.json(confirmationContext(actor)));
        audit.logAs(actor,"REVISION","Publishing workspace",revisionId,"PUBLISH_CONFIRMATION_RECORDED",
                "READY_FOR_PUBLISHING","READY_FOR_PUBLISHING","Accepted a signed Publish command; publication is pending.",java.util.List.of(
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Publishing Job",null,job.getId().toString()),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Signing Confirmation",null,confirmationId.toString()),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Confirmed Content SHA-256",null,binding)));
        return job;
    }

    public boolean exists(UUID jobId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from publishing_job_commands where job_id=?)", Boolean.class, jobId));
    }

    @Transactional
    public boolean failIfQueued(UUID jobId, String message) {
        return jdbc.update("""
                with candidate as (select id from publishing_workspace_jobs where id=? and status='QUEUED' for update skip locked)
                update publishing_workspace_jobs j set status='FAILED',message='Publishing failed',error_message=?,
                  completed_at=now(),updated_at=now() from candidate where j.id=candidate.id
                """, jobId, message) == 1;
    }

    /** SKIP LOCKED makes HTTP dispatch and recovery use the same canonical execution boundary. */
    @Transactional
    public boolean execute(UUID jobId, UUID userId) {
        var rows = jdbc.queryForList("""
                select j.revision_id, j.requested_by_user_id, c.command_type, c.payload::text, c.bundle::text,
                       c.content_binding, c.confirmation_id, c.confirmed_at, c.confirmation_context::text
                from publishing_workspace_jobs j join publishing_job_commands c on c.job_id=j.id
                where j.id=? and j.status='QUEUED' for update of j skip locked
                """, jobId);
        if (rows.isEmpty()) return false;
        var row = rows.getFirst();
        if (!userId.equals(row.get("requested_by_user_id"))) throw new org.springframework.security.access.AccessDeniedException("Job actor mismatch");
        UserAccount actor = requireActor(userId);
        UUID revisionId = (UUID)row.get("revision_id");
        try {
            if ("PREVIEW".equals(row.get("command_type"))) {
                var bundle=store.previewBundle(revisionId);
                if (!mapper.readTree(row.get("bundle").toString()).equals(mapper.readTree(store.json(bundle)))
                        || !row.get("content_binding").equals(store.contentBinding(revisionId))) {
                    throw new IllegalStateException("PUBLISHING_PREVIEW_COMMAND_STALE: reopen the workspace");
                }
                var request=mapper.readValue(row.get("payload").toString(),PublishingWorkspaceRequest.class);
                jobs.markProcessing(jobId,"Generating publishing workspace preview.");
                workspace.generatePreview(revisionId,request,actor);
                jobs.markCompleted(jobId,"Publishing workspace preview generated successfully.");
                return true;
            }
            var request = mapper.readValue(row.get("payload").toString(), PublishingWorkspaceRequest.class);
            boolean forceRelated = Boolean.TRUE.equals(request.forcePublishRelated());
            var bundle = store.publishBundle(revisions.capturePublishConfirmationBundle(revisionId, actor, forceRelated));
            if (!mapper.readTree(row.get("bundle").toString()).equals(mapper.readTree(store.json(bundle)))
                    || !row.get("content_binding").equals(store.contentBinding(revisionId))) {
                throw new IllegalStateException("PUBLISH_CONFIRMATION_STALE: content changed; confirm and sign again");
            }
            Instant confirmedAt = ((java.sql.Timestamp)row.get("confirmed_at")).toInstant();
            Map<String,String> context=mapper.readValue(row.get("confirmation_context").toString(),
                    mapper.getTypeFactory().constructMapType(Map.class,String.class,String.class));
            var confirmation = new ConfirmedPublishAuthorization((UUID)row.get("confirmation_id"), userId, confirmedAt, bundle.keySet(),context,forceRelated);
            jobs.markProcessing(jobId, "Executing confirmed publishing command");
            workspace.completeConfirmedPublish(revisionId, request, userId, confirmation);
            jobs.markCompleted(jobId, "Publishing completed successfully.");
            return true;
        } catch (com.fasterxml.jackson.core.JsonProcessingException invalidPayload) {
            throw new IllegalStateException("Invalid stored publishing command", invalidPayload);
        }
    }

    private UserAccount requireActor(UUID userId) {
        var actor = users.requireCurrentUser(userId);
        if (actor.getStatus() != com.eqms.entity.UserStatus.Active
                || !permissions.hasPermission(actor, "documents.revision.publish")) {
            throw new org.springframework.security.access.AccessDeniedException("Current user cannot publish revisions");
        }
        return actor;
    }

    private Map<String,String> confirmationContext(UserAccount actor) {
        Map<String,String> snapshot=new LinkedHashMap<>();
        snapshot.put("username",java.util.Objects.toString(actor.getUsername(),""));
        snapshot.put("fullName",java.util.Objects.toString(actor.getFullName(),""));
        snapshot.put("position",java.util.Objects.toString(actor.getPosition(),""));
        snapshot.put("department",java.util.Objects.toString(actor.getDepartment(),""));
        snapshot.put("email",java.util.Objects.toString(actor.getEmail(),""));
        var attributes=org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if(attributes instanceof org.springframework.web.context.request.ServletRequestAttributes servlet) {
            snapshot.put("ipAddress",java.util.Objects.toString(servlet.getRequest().getRemoteAddr(),""));
            snapshot.put("userAgent",java.util.Objects.toString(servlet.getRequest().getHeader("User-Agent"),""));
        }
        return snapshot;
    }

}
