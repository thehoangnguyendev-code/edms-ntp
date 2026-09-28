package com.eqms.repository;

import com.eqms.entity.DocumentNameFormat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentNameFormatRepository extends JpaRepository<DocumentNameFormat, UUID>, JpaSpecificationExecutor<DocumentNameFormat> {
    List<DocumentNameFormat> findAllByOrderByNameAsc();
    Optional<DocumentNameFormat> findByNameIgnoreCase(String name);
}
