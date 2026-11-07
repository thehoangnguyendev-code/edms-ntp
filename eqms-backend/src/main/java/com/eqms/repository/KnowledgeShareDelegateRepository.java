package com.eqms.repository;

import com.eqms.entity.KnowledgeShareDelegate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeShareDelegateRepository extends JpaRepository<KnowledgeShareDelegate, UUID> {
    List<KnowledgeShareDelegate> findAllByUser_Id(UUID userId);

    List<KnowledgeShareDelegate> findAllByDepartment_IdOrderByGrantedAtAsc(UUID departmentId);

    List<KnowledgeShareDelegate> findAllByBusinessUnit_IdOrderByGrantedAtAsc(UUID businessUnitId);

    Optional<KnowledgeShareDelegate> findByDepartment_IdAndUser_Id(UUID departmentId, UUID userId);

    Optional<KnowledgeShareDelegate> findByBusinessUnit_IdAndUser_Id(UUID businessUnitId, UUID userId);
}
