package com.eqms.repository;

import com.eqms.entity.PromptSpecification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PromptSpecificationRepository extends JpaRepository<PromptSpecification, UUID> {

    @EntityGraph(attributePaths = {"generationRuns"})
    List<PromptSpecification> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"generationRuns", "generationRuns.artifacts"})
    Optional<PromptSpecification> findById(UUID id);
}
