package com.eqms.repository;

import com.eqms.entity.AuthAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AuthAuditLogRepository extends JpaRepository<AuthAuditLog, UUID> {
    long countByEventTypeAndCreatedAtAfter(String eventType, java.time.Instant since);
}
