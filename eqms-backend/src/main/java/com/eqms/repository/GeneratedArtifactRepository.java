package com.eqms.repository;

import com.eqms.entity.GeneratedArtifact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface GeneratedArtifactRepository extends JpaRepository<GeneratedArtifact, UUID> {
}
