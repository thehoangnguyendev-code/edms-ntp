package com.eqms.repository;

import com.eqms.entity.RevisionOfficeWorkspaceAccess;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevisionOfficeWorkspaceAccessRepository extends JpaRepository<RevisionOfficeWorkspaceAccess, UUID> {
    List<RevisionOfficeWorkspaceAccess> findAllByRevision_IdAndGrantStatus(UUID revisionId, String grantStatus);
    Optional<RevisionOfficeWorkspaceAccess> findByRevision_IdAndUser_IdAndAccessRole(UUID revisionId, UUID userId, String accessRole);
}
