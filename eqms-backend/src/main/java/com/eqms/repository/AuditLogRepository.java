package com.eqms.repository;

import com.eqms.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {
    List<AuditLog> findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, UUID entityId);

    @Query("""
            select auditLog
            from AuditLog auditLog
            where replace(upper(auditLog.entityType), ' ', '_') = replace(upper(:entityType), ' ', '_')
              and auditLog.entityId = :entityId
            order by auditLog.createdAt desc
            """)
    List<AuditLog> findAllByNormalizedEntityTypeAndEntityId(
            @Param("entityType") String entityType,
            @Param("entityId") UUID entityId
    );

    List<AuditLog> findAllByUsernameIgnoreCase(String username);

    List<AuditLog> findAllByCreatedAtBetweenOrderByCreatedAtAsc(java.time.Instant start, java.time.Instant end);

    @Query("""
            SELECT a FROM AuditLog a
            WHERE a.entityType IN ('DOCUMENT', 'DOCUMENT_REVISION', 'CONTROLLED_COPY')
            ORDER BY a.eventTime DESC
            LIMIT 20
            """)
    List<AuditLog> findRecentSystemActivity();

    @Query(value = """
            SELECT COUNT(*) FROM audit_logs
            WHERE event_time >= NOW() - INTERVAL '30 days'
            """, nativeQuery = true)
    long countEventsLast30Days();

    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC('day', event_time AT TIME ZONE 'UTC'), 'DD Mon') AS label,
                   COUNT(*) AS value
            FROM audit_logs
            WHERE event_time >= NOW() - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('day', event_time AT TIME ZONE 'UTC')
            ORDER BY DATE_TRUNC('day', event_time AT TIME ZONE 'UTC')
            """, nativeQuery = true)
    List<Object[]> countAuditEventsGroupedByDay();
}
