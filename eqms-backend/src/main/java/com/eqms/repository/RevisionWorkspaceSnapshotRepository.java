package com.eqms.repository;

import com.eqms.entity.RevisionWorkspaceSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RevisionWorkspaceSnapshotRepository extends JpaRepository<RevisionWorkspaceSnapshot, UUID> {
    Optional<RevisionWorkspaceSnapshot> findByWorkspaceKey(String workspaceKey);
    Optional<RevisionWorkspaceSnapshot> findBySourceRevision_IdAndWorkspaceMode(UUID sourceRevisionId, String workspaceMode);
}

