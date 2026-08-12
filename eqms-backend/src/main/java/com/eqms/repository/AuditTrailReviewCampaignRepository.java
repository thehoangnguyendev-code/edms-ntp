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
    List<AuditTrailReviewCampaign> findAllByOrderByCreatedAtDesc();

    @Query("""
            SELECT campaign FROM AuditTrailReviewCampaign campaign
            LEFT JOIN campaign.reviewer reviewer
            WHERE (:search IS NULL
                    OR LOWER(campaign.name) LIKE LOWER(CONCAT('%', :search, '%'))
                    OR LOWER(COALESCE(campaign.description, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                    OR LOWER(COALESCE(reviewer.fullName, '')) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:status IS NULL OR campaign.status = :status)
            """)
    Page<AuditTrailReviewCampaign> search(
            @Param("search") String search,
            @Param("status") String status,
            Pageable pageable);
}
