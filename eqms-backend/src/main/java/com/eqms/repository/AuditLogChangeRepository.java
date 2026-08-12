package com.eqms.repository;

import com.eqms.entity.AuditLogChange;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditLogChangeRepository extends JpaRepository<AuditLogChange, UUID> {
    List<AuditLogChange> findAllByAuditLogIdOrderByChangeOrderAscCreatedAtAsc(UUID auditLogId);
}
