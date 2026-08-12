package com.eqms.repository;

import com.eqms.entity.RevisionWorkflowHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevisionWorkflowHistoryRepository extends JpaRepository<RevisionWorkflowHistory, UUID> {
    List<RevisionWorkflowHistory> findAllByRevision_IdOrderByCreatedAtAsc(UUID revisionId);
}
