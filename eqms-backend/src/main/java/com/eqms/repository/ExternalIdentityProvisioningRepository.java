package com.eqms.repository;

import com.eqms.entity.ExternalIdentityProvisioning;
import java.util.Optional;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExternalIdentityProvisioningRepository extends JpaRepository<ExternalIdentityProvisioning, UUID> {
    Optional<ExternalIdentityProvisioning> findByUser_Id(UUID userId);
    List<ExternalIdentityProvisioning> findAllByUser_IdIn(Collection<UUID> userIds);
    List<ExternalIdentityProvisioning> findAllByStatus(String status);
    List<ExternalIdentityProvisioning> findAllByPendingOperationIsNotNull();

    /** Load only relationship keys when reconciliation compares the local directory to Entra. */
    @Query("select e.user.id from ExternalIdentityProvisioning e")
    List<UUID> findAllLinkedUserIds();

    Optional<ExternalIdentityProvisioning> findByProviderAndEmailNormalized(String provider, String emailNormalized);
}
