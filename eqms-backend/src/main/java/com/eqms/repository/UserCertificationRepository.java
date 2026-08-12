package com.eqms.repository;

import com.eqms.entity.UserCertification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserCertificationRepository extends JpaRepository<UserCertification, UUID> {
    List<UserCertification> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    void deleteAllByUserId(UUID userId);
}
