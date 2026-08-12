package com.eqms.repository;

import com.eqms.entity.NotificationDispatchQueue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface NotificationDispatchQueueRepository extends JpaRepository<NotificationDispatchQueue, UUID> {
    List<NotificationDispatchQueue> findAllByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
            String status, Instant scheduledFor);
}
