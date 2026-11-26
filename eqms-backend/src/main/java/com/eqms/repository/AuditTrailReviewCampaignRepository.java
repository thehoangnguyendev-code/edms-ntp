package com.eqms.repository;

import com.eqms.entity.AuditTrailReviewCampaign;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditTrailReviewCampaignRepository extends JpaRepository<AuditTrailReviewCampaign, UUID> {
    long countByStatus(String status);

    List<AuditTrailReviewCampaign> findAllByOrderByCreatedAtDesc();

    @Query("""
            SELECT campaign FROM AuditTrailReviewCampaign campaign
            LEFT JOIN campaign.reviewer reviewer
            WHERE (:search IS NULL
                    OR LOWER(COALESCE(campaign.campaignNumber, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                    OR LOWER(campaign.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                    OR LOWER(COALESCE(campaign.description, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                    OR LOWER(COALESCE(reviewer.fullName, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
              AND (:status IS NULL OR campaign.status = :status)
              AND (:waiting = FALSE OR (reviewer.id = :reviewerId AND campaign.status = 'IN_PROGRESS'))
            """)
    Page<AuditTrailReviewCampaign> search(
            @Param("search") String search,
            @Param("status") String status,
            @Param("waiting") boolean waiting,
            @Param("reviewerId") UUID reviewerId,
            Pageable pageable);
}
