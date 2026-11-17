package com.eqms.service.report;

import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
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
    /** What the system itself did to a run (made its file, failed, will try again) is part of the Audit Trail of the run (REPORT-RUN-AUDIT-2026-11-16). Absent only in a test that builds the publisher by hand. */
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private AuditTrailService audit;
    public ReportArtifactPublisher(JdbcTemplate jdbc, ReportTemplateService templates, UserAccountRepository users) {
        this.jdbc=jdbc; this.templates=templates; this.users=users;
    }
    /** What the Audit Trail calls a run: its own number (RUN-000176), never the code of its template, which every run of that template shares. */
    private String runCode(UUID runId, String fallback) {
        String number = jdbc.query("select run_number from report_runs where id=?", rs -> rs.next() ? com.eqms.service.ReportPlatformService.runLabel(rs.getObject(1)) : null, runId);
        return number == null || number.isEmpty() ? fallback : number;
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
        com.eqms.service.EntityChangeBroadcaster.changed("REPORT_RUN", runId, null);
        if (audit != null) audit.logSystem("REPORT_RUN", runCode(runId, code), runId, "REPORT_RUN_COMPLETED", "PROCESSING", "COMPLETED",
                "Report file made: " + filename + " (" + format + ", " + size + " bytes, SHA-256 " + hash + ")");
        jdbc.update("insert into report_run_events(run_id,event_type,detail) values(?,'COMPLETED',jsonb_build_object('artifactId',cast(? as text),'sha256',cast(? as text)))",runId,artifactId.toString(),hash);
        jdbc.update("update report_artifact_publication_journal set status='PUBLISHED',published_at=now() where artifact_id=?",artifactId);
    }

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(ReportArtifactPublisher.class);

    @Transactional
    public void fail(UUID runId,int attempt,Exception failure) {
        // The reason code stored with the run is deliberately general; the cause is kept in the service log, so a failed run can be explained (the stack is logged for failures that are not known conditions).
        boolean known = failure instanceof SecurityException || failure instanceof IllegalArgumentException || failure instanceof org.springframework.web.server.ResponseStatusException;
        if (known) LOG.info("Report run {} failed at attempt {}: {}", runId, attempt, failure.getMessage());
        else LOG.warn("Report run {} failed at attempt {}: {}", runId, attempt, failure.toString(), failure);
        var run=jdbc.queryForMap("select status,attempt_count,definition_code,lease_until>now() as leased from report_runs where id=? for update",runId);
        if (!"PROCESSING".equals(run.get("status")) || ((Number)run.get("attempt_count")).intValue()!=attempt || !Boolean.TRUE.equals(run.get("leased"))) return;
        boolean denied=failure instanceof SecurityException;
        boolean invalid=failure instanceof IllegalArgumentException || failure instanceof org.springframework.web.server.ResponseStatusException;
        boolean retry=!denied&&!invalid&&attempt<3;
        // A row limit is a known, correctable condition (decision-time limit of 10,000 rows, no silent truncation): it gets its own code and text.
        boolean rowLimit="REPORT_ROW_LIMIT_EXCEEDED".equals(failure.getMessage());
        boolean formatLimit="REPORT_FORMAT_ROW_LIMIT_EXCEEDED".equals(failure.getMessage());
        boolean obsolete="REPORT_REVISION_OBSOLETE".equals(failure.getMessage());
        boolean tooLarge="REPORT_TOO_LARGE".equals(failure.getMessage());
        String reason=denied?"REPORT_AUTHORIZATION_CHANGED":rowLimit?"REPORT_ROW_LIMIT_EXCEEDED":formatLimit?"REPORT_FORMAT_ROW_LIMIT_EXCEEDED":obsolete?"REPORT_REVISION_OBSOLETE":tooLarge?"REPORT_TOO_LARGE":invalid?"REPORT_INVALID_CRITERIA":"REPORT_GENERATION_FAILED";
        String message=denied?"Current metadata authorization no longer permits this report.":rowLimit?"The result has more rows than a report file may hold. Add a filter to narrow it and start a new request.":formatLimit?"The result is too large for a PDF or Word file. Choose CSV or XLSX, or add a filter, and start a new request.":obsolete?"The template revision this report was requested with is no longer effective. Start a new report request.":tooLarge?"The report is too large for the server to build. Add a filter to narrow it and start a new request.":invalid?"Report criteria or template policy is no longer valid. Start a new report request.":"Report generation failed. Check service availability.";
        long delay=Math.min(300L,15L*(1L<<Math.max(0,attempt-1)));
        jdbc.update("update report_runs set status=?,reason_code=?,error_message=?,next_attempt_at=now()+(?*interval '1 second'),lease_until=null where id=?",retry?"RETRY_SCHEDULED":"FAILED",reason,message,delay,runId);
        com.eqms.service.EntityChangeBroadcaster.changed("REPORT_RUN", runId, null);
        if (audit != null) audit.logSystem("REPORT_RUN", runCode(runId, String.valueOf(run.get("definition_code"))), runId, retry ? "REPORT_RUN_RETRY_SCHEDULED" : "REPORT_RUN_FAILED", "PROCESSING", retry ? "RETRY_SCHEDULED" : "FAILED",
                "Attempt " + attempt + " failed (" + reason + "): " + message + (retry ? " Next attempt in " + delay + " seconds." : " No further attempt will be made."));
        jdbc.update("insert into report_run_events(run_id,event_type,reason_code,detail) values(?,?,?,jsonb_build_object('attempt',cast(? as integer),'delaySeconds',cast(? as bigint)))",runId,retry?"RETRY_SCHEDULED":"DEAD_LETTERED",reason,attempt,delay);
    }
}
