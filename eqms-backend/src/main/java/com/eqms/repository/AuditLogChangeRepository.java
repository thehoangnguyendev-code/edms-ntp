package com.eqms.repository;

import com.eqms.entity.AuditLogChange;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AuditLogChangeRepository extends JpaRepository<AuditLogChange, UUID> {
    List<AuditLogChange> findAllByAuditLogIdOrderByChangeOrderAscCreatedAtAsc(UUID auditLogId);

    /** Batch variant -- one query for a whole page of audit rows instead of one per row. */
    List<AuditLogChange> findAllByAuditLogIdInOrderByAuditLogIdAscChangeOrderAscCreatedAtAsc(Collection<UUID> auditLogIds);
}
