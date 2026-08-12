package com.eqms.repository;

import com.eqms.entity.NotificationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NotificationPolicyRepository extends JpaRepository<NotificationPolicy, java.util.UUID> {

    Optional<NotificationPolicy> findByEventCode(String eventCode);

    boolean existsByEventCode(String eventCode);
}
