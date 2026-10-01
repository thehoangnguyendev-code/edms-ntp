package com.eqms.repository;

import com.eqms.entity.CalendarEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.*;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, UUID> {
    Optional<CalendarEvent> findByIdAndOwner_IdAndDeletedAtIsNull(UUID id, UUID ownerId);
    @Query("select e from CalendarEvent e where e.owner.id = :owner and e.deletedAt is null and e.startsAt < :end and e.endsAt > :start order by e.startsAt, e.id")
    List<CalendarEvent> findInRange(@Param("owner") UUID owner, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
}
