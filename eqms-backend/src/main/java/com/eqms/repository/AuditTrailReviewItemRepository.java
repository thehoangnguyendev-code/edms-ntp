package com.eqms.repository;

import com.eqms.entity.AuditTrailReviewItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditTrailReviewItemRepository extends JpaRepository<AuditTrailReviewItem, UUID> {
    List<AuditTrailReviewItem> findByCampaign_IdOrderByAuditLog_CreatedAtAsc(UUID campaignId);
    long countByCampaign_IdAndDecision(UUID campaignId, String decision);

    @Query("""
            SELECT item FROM AuditTrailReviewItem item
            JOIN item.auditLog auditLog
            WHERE item.campaign.id = :campaignId
              AND (:search IS NULL
                    OR LOWER(COALESCE(auditLog.userFullName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                    OR LOWER(COALESCE(auditLog.employeeCode, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                    OR LOWER(COALESCE(auditLog.entityType, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                    OR LOWER(COALESCE(auditLog.action, auditLog.actionType, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                    OR LOWER(COALESCE(auditLog.entityName, '')) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:decision IS NULL OR item.decision = :decision)
            """)
    Page<AuditTrailReviewItem> search(
            @Param("campaignId") UUID campaignId,
            @Param("search") String search,
            @Param("decision") String decision,
            Pageable pageable);
}
