package com.eqms.repository;

import com.eqms.entity.UserEducation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserEducationRepository extends JpaRepository<UserEducation, UUID> {
    List<UserEducation> findAllByUserIdOrderByCreatedAtDesc(UUID userId);
    void deleteAllByUserId(UUID userId);
}
