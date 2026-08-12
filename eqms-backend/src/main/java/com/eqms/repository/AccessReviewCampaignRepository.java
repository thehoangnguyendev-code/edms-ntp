package com.eqms.repository;

import com.eqms.entity.AccessReviewCampaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface AccessReviewCampaignRepository extends JpaRepository<AccessReviewCampaign, UUID> {
    List<AccessReviewCampaign> findAllByOrderByCreatedAtDesc();

    /** Used by {@code AccessReviewNotificationScheduler} to find campaigns due on a specific
     * calendar date -- matching on the exact reminder date (not a range) keeps the daily cron
     * naturally idempotent without needing a separate "already notified" flag. */
    List<AccessReviewCampaign> findAllByStatusAndReviewPeriodEnd(String status, LocalDate reviewPeriodEnd);
}
