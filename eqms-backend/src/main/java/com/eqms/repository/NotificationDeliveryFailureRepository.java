package com.eqms.repository;

import com.eqms.entity.NotificationDeliveryFailure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.UUID;

public interface NotificationDeliveryFailureRepository extends JpaRepository<NotificationDeliveryFailure, UUID> {
    Page<NotificationDeliveryFailure> findAllByOrderByLastAttemptAtDesc(Pageable pageable);
}
