package com.eqms.repository;

import com.eqms.entity.PromptGenerationRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PromptGenerationRunRepository extends JpaRepository<PromptGenerationRun, UUID> {
}
