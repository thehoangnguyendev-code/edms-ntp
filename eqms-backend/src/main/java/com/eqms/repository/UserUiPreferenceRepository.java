package com.eqms.repository;

import com.eqms.entity.UserUiPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserUiPreferenceRepository extends JpaRepository<UserUiPreference, UUID> {
    Optional<UserUiPreference> findByUserIdAndPrefKey(UUID userId, String prefKey);
}
