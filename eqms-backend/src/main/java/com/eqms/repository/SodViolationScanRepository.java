package com.eqms.repository;

import com.eqms.entity.SodViolationScan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SodViolationScanRepository extends JpaRepository<SodViolationScan, UUID> {
    Page<SodViolationScan> findAllByOrderByScannedAtDesc(Pageable pageable);
}
