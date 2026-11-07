package com.eqms.repository;

import com.eqms.entity.KnowledgeShareLinkRedemption;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KnowledgeShareLinkRedemptionRepository extends JpaRepository<KnowledgeShareLinkRedemption, KnowledgeShareLinkRedemption.Key> {
    long countById_LinkId(java.util.UUID linkId);
}
