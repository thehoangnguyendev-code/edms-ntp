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
                    OR cast(function('eqms_fold', COALESCE(auditLog.userFullName, '')) as string) like cast(function('eqms_fold', CONCAT('%', CAST(:search AS string), '%')) as string)
                    OR cast(function('eqms_fold', COALESCE(auditLog.employeeCode, '')) as string) like cast(function('eqms_fold', CONCAT('%', CAST(:search AS string), '%')) as string)
                    OR cast(function('eqms_fold', COALESCE(auditLog.entityType, '')) as string) like cast(function('eqms_fold', CONCAT('%', CAST(:search AS string), '%')) as string)
                    OR cast(function('eqms_fold', COALESCE(auditLog.action, auditLog.actionType, '')) as string) like cast(function('eqms_fold', CONCAT('%', CAST(:search AS string), '%')) as string)
                    OR cast(function('eqms_fold', COALESCE(auditLog.entityName, '')) as string) like cast(function('eqms_fold', CONCAT('%', CAST(:search AS string), '%')) as string))
              AND (:decision IS NULL OR item.decision = :decision)
              AND (:anyModule = true OR auditLog.entityType IN :entityTypes)
              AND (:action = '' OR COALESCE(auditLog.action, auditLog.actionType, '') = :action)
              AND (:signed = 'ALL'
                    OR (:signed = 'YES' AND auditLog.electronicSignatureApplied = true)
                    OR (:signed = 'NO' AND auditLog.electronicSignatureApplied = false))
              AND auditLog.createdAt >= :from AND auditLog.createdAt < :to
            """)
    Page<AuditTrailReviewItem> search(
            @Param("campaignId") UUID campaignId,
            @Param("search") String search,
            @Param("decision") String decision,
            @Param("anyModule") boolean anyModule,
            @Param("entityTypes") java.util.Collection<String> entityTypes,
            @Param("action") String action,
            @Param("signed") String signed,
            @Param("from") java.time.Instant from,
            @Param("to") java.time.Instant to,
            Pageable pageable);

    /** The modules that appear in a campaign, for the Module filter. */
    @Query("""
            SELECT DISTINCT auditLog.entityType FROM AuditTrailReviewItem item JOIN item.auditLog auditLog
            WHERE item.campaign.id = :campaignId AND auditLog.entityType IS NOT NULL
            ORDER BY auditLog.entityType
            """)
    List<String> distinctModules(@Param("campaignId") UUID campaignId);

    /** The actions that appear in a campaign, for the Action filter. */
    @Query("""
            SELECT DISTINCT COALESCE(auditLog.action, auditLog.actionType) FROM AuditTrailReviewItem item JOIN item.auditLog auditLog
            WHERE item.campaign.id = :campaignId AND COALESCE(auditLog.action, auditLog.actionType) IS NOT NULL
            ORDER BY COALESCE(auditLog.action, auditLog.actionType)
            """)
    List<String> distinctActions(@Param("campaignId") UUID campaignId);
}
