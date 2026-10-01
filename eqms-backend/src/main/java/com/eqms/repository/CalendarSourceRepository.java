package com.eqms.repository;

import com.eqms.entity.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import java.time.*;
import java.util.*;

/** Date-bounded source reads. Object authorization is still applied by CalendarService before disclosure. */
@Repository
public class CalendarSourceRepository {
    private final EntityManager entityManager;
    public CalendarSourceRepository(EntityManager entityManager) { this.entityManager = entityManager; }

    public List<DocumentRecord> documents(LocalDate start, LocalDate end) {
        return entityManager.createQuery("""
                select d from DocumentRecord d where
                (d.reviewDate >= :start and d.reviewDate < :end) or
                (d.effectiveDate >= :start and d.effectiveDate < :end) or
                (d.validUntil >= :start and d.validUntil < :end)
                """, DocumentRecord.class).setParameter("start", start).setParameter("end", end).getResultList();
    }
    public List<DocumentRevisionRecord> revisions(LocalDate start, LocalDate end) {
        return entityManager.createQuery("""
                select r from DocumentRevisionRecord r join fetch r.document where
                (r.effectiveDate >= :start and r.effectiveDate < :end) or
                (r.validUntil >= :start and r.validUntil < :end) or
                (r.trainingPlannedDate >= :start and r.trainingPlannedDate < :end) or
                (r.trainingPeriodEndDate >= :start and r.trainingPeriodEndDate < :end) or
                (r.trainingCompletionDate >= :start and r.trainingCompletionDate < :end)
                """, DocumentRevisionRecord.class).setParameter("start", start).setParameter("end", end).getResultList();
    }
    public List<UserNotification> notifications(UUID owner, Instant start, Instant end) {
        return entityManager.createQuery("""
                select n from UserNotification n where n.recipientUser.id = :owner and n.deletedAt is null
                and n.createdAt >= :start and n.createdAt < :end order by n.createdAt, n.id
                """, UserNotification.class).setParameter("owner", owner).setParameter("start", start)
                .setParameter("end", end).getResultList();
    }
}
