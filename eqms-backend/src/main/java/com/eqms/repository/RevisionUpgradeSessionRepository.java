package com.eqms.repository;

import com.eqms.entity.RevisionUpgradeSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RevisionUpgradeSessionRepository extends JpaRepository<RevisionUpgradeSession, UUID> {
    Optional<RevisionUpgradeSession> findBySessionKey(String sessionKey);
    Optional<RevisionUpgradeSession> findByIdAndSourceDocument_Id(UUID id, UUID sourceDocumentId);
    Optional<RevisionUpgradeSession> findBySourceDocument_IdAndWorkspaceMode(UUID sourceDocumentId, String workspaceMode);
}
