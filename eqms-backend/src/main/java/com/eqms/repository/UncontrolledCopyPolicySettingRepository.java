package com.eqms.repository;

import com.eqms.entity.UncontrolledCopyPolicySetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UncontrolledCopyPolicySettingRepository extends JpaRepository<UncontrolledCopyPolicySetting, UUID> {
}
