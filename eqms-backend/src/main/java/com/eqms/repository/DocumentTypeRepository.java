package com.eqms.repository;

import com.eqms.entity.DocumentType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentTypeRepository extends JpaRepository<DocumentType, UUID>, JpaSpecificationExecutor<DocumentType> {
    Optional<DocumentType> findByName(String name);
    Optional<DocumentType> findByNameIgnoreCase(String name);
    Optional<DocumentType> findByShortCode(String shortCode);
    Optional<DocumentType> findByShortCodeIgnoreCase(String shortCode);
    List<DocumentType> findAllByOrderByNameAsc();
    List<DocumentType> findAllByActiveTrueOrderByNameAsc();

    /** Serializes number allocation for a single document-number prefix. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select documentType from DocumentType documentType where documentType.id = :id")
    Optional<DocumentType> findByIdForNumberAllocation(@Param("id") UUID id);
}
