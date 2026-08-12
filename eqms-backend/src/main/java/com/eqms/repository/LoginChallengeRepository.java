package com.eqms.repository;

import com.eqms.entity.LoginChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface LoginChallengeRepository extends JpaRepository<LoginChallenge, UUID> {
    Optional<LoginChallenge> findByMfaTokenHash(String mfaTokenHash);
}
