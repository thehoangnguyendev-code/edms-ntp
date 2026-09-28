package com.eqms.repository;

import com.eqms.entity.TimeLimitedUserGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface TimeLimitedUserGrantRepository extends JpaRepository<TimeLimitedUserGrant, UUID>, JpaSpecificationExecutor<TimeLimitedUserGrant> {

    /** Read-only ID lists for the nightly scheduler -- one item per transaction downstream. */
    List<TimeLimitedUserGrant> findByStatusAndEndAtLessThan(String status, Instant instant);

    List<TimeLimitedUserGrant> findByStatus(String status);

    /** A user can have historical grants, but only one grant currently being enforced. */
    boolean existsByUser_IdAndStatus(UUID userId, String status);
}
