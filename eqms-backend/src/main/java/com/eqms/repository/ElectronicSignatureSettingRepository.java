package com.eqms.repository;

import com.eqms.entity.ElectronicSignatureSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ElectronicSignatureSettingRepository extends JpaRepository<ElectronicSignatureSetting, UUID> {
}
