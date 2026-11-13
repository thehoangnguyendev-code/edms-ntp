package com.eqms.repository;

import com.eqms.entity.EmailDesign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface EmailDesignRepository extends JpaRepository<EmailDesign, UUID> {
}
