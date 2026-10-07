package com.eqms.repository;

import com.eqms.entity.UserTablePreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserTablePreferenceRepository extends JpaRepository<UserTablePreference, UUID> {
    Optional<UserTablePreference> findByUserIdAndTableKey(UUID userId, String tableKey);
}
