package com.eqms.repository;

import com.eqms.entity.MfaTrustedDevice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MfaTrustedDeviceRepository extends JpaRepository<MfaTrustedDevice, UUID> {
    Optional<MfaTrustedDevice> findByTokenHash(String tokenHash);
    List<MfaTrustedDevice> findAllByUser_Id(UUID userId);
}
