package com.eqms.repository;

import com.eqms.entity.MfaFactor;
import com.eqms.entity.MfaMethod;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MfaFactorRepository extends JpaRepository<MfaFactor, UUID> {
    List<MfaFactor> findAllByUserIdAndEnabledTrue(UUID userId);
    Optional<MfaFactor> findByUserIdAndMethod(UUID userId, MfaMethod method);
    List<MfaFactor> findAllByUserId(UUID userId);
}
