package com.eqms.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PublishingCommandRecovery {
    private final JdbcTemplate jdbc;
    private final TaskExecutor executor;
    private final PublishingWorkspaceJobProcessorService processor;
    private final Set<UUID> dispatched = ConcurrentHashMap.newKeySet();

    public PublishingCommandRecovery(JdbcTemplate jdbc,
            @Qualifier("publishingCommandExecutor") TaskExecutor executor,
            PublishingWorkspaceJobProcessorService processor) {
        this.jdbc=jdbc; this.executor=executor; this.processor=processor;
    }

    @Scheduled(fixedDelayString="${app.publishing.command-delay-ms:1500}")
    public void dispatch() {
        var candidates = jdbc.queryForList("""
                select j.id, j.revision_id, j.requested_by_user_id from publishing_workspace_jobs j
                join publishing_job_commands c on c.job_id=j.id
                where j.status='QUEUED' order by j.created_at limit 10
                """);
        for (var row : candidates) {
            UUID id = (UUID)row.get("id");
            if (!dispatched.add(id)) continue;
            try {
                executor.execute(() -> {
                    try {
                        processor.processPublishCommand(id, (UUID)row.get("revision_id"), null,
                                (UUID)row.get("requested_by_user_id"));
                    } finally { dispatched.remove(id); }
                });
            } catch (org.springframework.core.task.TaskRejectedException busy) {
                dispatched.remove(id);
                break; // DB remains QUEUED; next tick retries, no unbounded executor queue.
            }
        }
    }
}
