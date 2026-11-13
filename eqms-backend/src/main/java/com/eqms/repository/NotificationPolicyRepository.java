package com.eqms.repository;

import com.eqms.entity.NotificationPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NotificationPolicyRepository extends JpaRepository<NotificationPolicy, java.util.UUID> {

    Optional<NotificationPolicy> findByEventCode(String eventCode);

    /** The policy with its row locked until the transaction ends: two administrators saving the same notification are served one after the other, and the second sees the first. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from NotificationPolicy p where p.eventCode = :eventCode")
    Optional<NotificationPolicy> lockByEventCode(@org.springframework.data.repository.query.Param("eventCode") String eventCode);

    boolean existsByEventCode(String eventCode);
}
