package com.eqms.repository;

import com.eqms.entity.ControlledCopyPolicySetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ControlledCopyPolicySettingRepository extends JpaRepository<ControlledCopyPolicySetting, UUID> {
}
