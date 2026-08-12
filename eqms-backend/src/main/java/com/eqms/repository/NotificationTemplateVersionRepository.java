package com.eqms.repository;

import com.eqms.entity.NotificationTemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationTemplateVersionRepository extends JpaRepository<NotificationTemplateVersion, UUID> {

    Optional<NotificationTemplateVersion> findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
            UUID policyId, String channel, String status);

    List<NotificationTemplateVersion> findAllByPolicy_IdOrderByChannelAscVersionNumberDesc(UUID policyId);

    List<NotificationTemplateVersion> findAllByPolicy_IdAndChannelOrderByVersionNumberDesc(UUID policyId, String channel);

    int countByPolicy_IdAndChannel(UUID policyId, String channel);
}
