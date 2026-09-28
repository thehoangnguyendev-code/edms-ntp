package com.eqms.repository;

import com.eqms.entity.UsedSignatureToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UsedSignatureTokenRepository extends JpaRepository<UsedSignatureToken, UUID> {
}
