package com.eqms.repository;

import com.eqms.entity.DocumentWorkflowSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DocumentWorkflowSettingRepository extends JpaRepository<DocumentWorkflowSetting, UUID> {
    Optional<DocumentWorkflowSetting> findFirstByOrderByIdAsc();
}
