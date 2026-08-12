package com.eqms.repository;

import com.eqms.entity.AccessReviewItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AccessReviewItemRepository extends JpaRepository<AccessReviewItem, UUID> {
    List<AccessReviewItem> findByCampaign_IdOrderByUsernameAsc(UUID campaignId);
    long countByCampaign_IdAndDecision(UUID campaignId, String decision);
}
