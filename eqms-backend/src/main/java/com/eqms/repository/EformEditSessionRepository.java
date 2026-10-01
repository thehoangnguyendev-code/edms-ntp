package com.eqms.repository;

import com.eqms.entity.EformEditSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface EformEditSessionRepository extends JpaRepository<EformEditSession, UUID> {
}
