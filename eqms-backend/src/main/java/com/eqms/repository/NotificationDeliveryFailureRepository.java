package com.eqms.repository;

import com.eqms.entity.NotificationDeliveryFailure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.UUID;

public interface NotificationDeliveryFailureRepository extends JpaRepository<NotificationDeliveryFailure, UUID>, JpaSpecificationExecutor<NotificationDeliveryFailure> {
    Page<NotificationDeliveryFailure> findAllByOrderByLastAttemptAtDesc(Pageable pageable);

    @Query("select distinct f.eventDomain from NotificationDeliveryFailure f where f.eventDomain is not null order by f.eventDomain")
    List<String> findDistinctEventDomains();
}
