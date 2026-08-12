package com.eqms.repository;

import com.eqms.entity.RevisionWorkspaceItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevisionWorkspaceItemRepository extends JpaRepository<RevisionWorkspaceItem, UUID> {
    List<RevisionWorkspaceItem> findAllByWorkspaceKeyOrderByItemOrderAsc(String workspaceKey);
    Optional<RevisionWorkspaceItem> findByWorkspaceKeyAndDocument_Id(String workspaceKey, UUID documentId);
    void deleteAllByWorkspaceKey(String workspaceKey);
}
