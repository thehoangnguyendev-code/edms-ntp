package com.eqms.repository;

import com.eqms.entity.DocumentWorkflowPoolMember;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentWorkflowPoolMemberRepository extends JpaRepository<DocumentWorkflowPoolMember, UUID> {
    @EntityGraph(attributePaths = "user")
    List<DocumentWorkflowPoolMember> findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc(String poolType);
    List<DocumentWorkflowPoolMember> findAllByPoolType(String poolType);
    void deleteAllByPoolType(String poolType);
    void deleteAllByPoolTypeAndUser_IdIn(String poolType, List<UUID> userIds);
}
