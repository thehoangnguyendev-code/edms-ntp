package com.eqms.repository;

import com.eqms.entity.UserLocalizationPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserLocalizationPreferenceRepository extends JpaRepository<UserLocalizationPreference, UUID> {
}
