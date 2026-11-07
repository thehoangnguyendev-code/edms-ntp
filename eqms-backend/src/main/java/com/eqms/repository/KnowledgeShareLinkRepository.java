package com.eqms.repository;

import com.eqms.entity.KnowledgeShareLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeShareLinkRepository extends JpaRepository<KnowledgeShareLink, UUID> {
    Optional<KnowledgeShareLink> findByTokenHash(String tokenHash);

    List<KnowledgeShareLink> findAllByOwnerDepartment_IdOrderByCreatedAtDesc(UUID departmentId);

    List<KnowledgeShareLink> findAllByOwnerBusinessUnit_IdOrderByCreatedAtDesc(UUID businessUnitId);

    List<KnowledgeShareLink> findAllByOrderByCreatedAtDesc();

    /** The links a user opened that are still usable: what gives that user folders and documents. */
    @Query("""
            SELECT l FROM KnowledgeShareLink l
            WHERE l.revokedAt IS NULL AND (l.expiresAt IS NULL OR l.expiresAt > :now)
              AND EXISTS (SELECT 1 FROM KnowledgeShareLinkRedemption r WHERE r.id.linkId = l.id AND r.id.userId = :userId)
            """)
    List<KnowledgeShareLink> findUsableOpenedBy(@Param("userId") UUID userId, @Param("now") Instant now);
}
