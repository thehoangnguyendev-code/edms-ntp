package com.eqms.service.report;

import com.eqms.repository.UserAccountRepository;
import com.eqms.service.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.UUID;

/** Atomic publication, fenced by worker attempt. Unpublished files remain journalled. */
@Service
public class ReportArtifactPublisher {
    private final JdbcTemplate jdbc;
    private final ReportTemplateService templates;
    private final UserAccountRepository users;
    public ReportArtifactPublisher(JdbcTemplate jdbc, ReportTemplateService templates, UserAccountRepository users) {
        this.jdbc=jdbc; this.templates=templates; this.users=users;
    }
    @Transactional
    public void publish(UUID runId, int attempt, UUID artifactId, String code, JsonNode snapshot, String format,
                        String filename, FileStorageService.StorageWriteResult stored, String mime, long size, String hash, Instant expiry) {
        var run = jdbc.queryForMap("select requester_user_id,status,attempt_count,lease_until > now() as leased from report_runs where id=? for update", runId);
        if (!"PROCESSING".equals(run.get("status")) || ((Number)run.get("attempt_count")).intValue()!=attempt || !Boolean.TRUE.equals(run.get("leased")))
            throw new IllegalStateException("REPORT_WORKER_LEASE_LOST");
        if ("METADATA_V1".equals(snapshot.path("protocol").asText())) {
            var actor = users.findById(UUID.fromString(run.get("requester_user_id").toString())).orElseThrow();
            templates.reauthorize(actor,code,snapshot);
        }
        jdbc.update("insert into report_artifacts(id,run_id,format,generated_filename,provider,bucket,object_key,object_version,mime_type,byte_size,sha256,expires_at) values(?,?,?,?,?,?,?,?,?,?,?,?)",
                artifactId,runId,format,filename,stored.provider(),stored.bucket(),stored.storedPath(),stored.versionId(),mime,size,hash,expiry==null?null:java.sql.Timestamp.from(expiry));
        jdbc.update("update report_runs set authorization_snapshot=cast(? as jsonb),as_of_at=coalesce(cast(? as timestamptz),started_at,as_of_at),status='COMPLETED',progress=100,completed_at=now(),lease_until=null,reason_code=null,error_message=null where id=?",snapshot.toString(),snapshot.path("asOfAt").isTextual()?snapshot.path("asOfAt").asText():null,runId);
        jdbc.update("insert into report_run_events(run_id,event_type,detail) values(?,'COMPLETED',jsonb_build_object('artifactId',cast(? as text),'sha256',cast(? as text)))",runId,artifactId.toString(),hash);
        jdbc.update("update report_artifact_publication_journal set status='PUBLISHED',published_at=now() where artifact_id=?",artifactId);
    }

    @Transactional
    public void fail(UUID runId,int attempt,Exception failure) {
        var run=jdbc.queryForMap("select status,attempt_count,lease_until>now() as leased from report_runs where id=? for update",runId);
        if (!"PROCESSING".equals(run.get("status")) || ((Number)run.get("attempt_count")).intValue()!=attempt || !Boolean.TRUE.equals(run.get("leased"))) return;
        boolean denied=failure instanceof SecurityException;
        boolean invalid=failure instanceof IllegalArgumentException || failure instanceof org.springframework.web.server.ResponseStatusException;
        boolean retry=!denied&&!invalid&&attempt<3;
        String reason=denied?"REPORT_AUTHORIZATION_CHANGED":invalid?"REPORT_INVALID_CRITERIA":"REPORT_GENERATION_FAILED";
        String message=denied?"Current metadata authorization no longer permits this report.":invalid?"Report criteria or template policy is no longer valid. Start a new report request.":"Report generation failed. Check service availability.";
        long delay=Math.min(300L,15L*(1L<<Math.max(0,attempt-1)));
        jdbc.update("update report_runs set status=?,reason_code=?,error_message=?,next_attempt_at=now()+(?*interval '1 second'),lease_until=null where id=?",retry?"RETRY_SCHEDULED":"FAILED",reason,message,delay,runId);
        jdbc.update("insert into report_run_events(run_id,event_type,reason_code,detail) values(?,?,?,jsonb_build_object('attempt',cast(? as integer),'delaySeconds',cast(? as bigint)))",runId,retry?"RETRY_SCHEDULED":"DEAD_LETTERED",reason,attempt,delay);
    }
}
