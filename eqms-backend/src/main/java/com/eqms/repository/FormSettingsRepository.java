package com.eqms.repository;

import com.eqms.entity.FormSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FormSettingsRepository extends JpaRepository<FormSettings, UUID> {
    Optional<FormSettings> findByDocument_Id(UUID documentId);
}
