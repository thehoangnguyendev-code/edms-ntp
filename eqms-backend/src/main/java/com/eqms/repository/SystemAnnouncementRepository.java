package com.eqms.repository;

import com.eqms.entity.SystemAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** The administration list is queried with {@link SystemAnnouncementSpecifications}; this adds only what users are shown. */
public interface SystemAnnouncementRepository extends JpaRepository<SystemAnnouncement, UUID>, JpaSpecificationExecutor<SystemAnnouncement> {

    @Query("select a from SystemAnnouncement a where a.enabled = true and a.startsAt <= :now and a.endsAt > :now order by a.startsAt desc")
    List<SystemAnnouncement> findActive(@Param("now") Instant now);
}
