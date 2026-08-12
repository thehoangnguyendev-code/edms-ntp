package com.eqms.repository;

import com.eqms.entity.DocumentSubType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentSubTypeRepository extends JpaRepository<DocumentSubType, UUID>, JpaSpecificationExecutor<DocumentSubType> {
    List<DocumentSubType> findAllByOrderByNameAsc();
    List<DocumentSubType> findAllByDocumentType_IdOrderByNameAsc(UUID documentTypeId);
    List<DocumentSubType> findAllByDocumentType_IdAndActiveTrueOrderByNameAsc(UUID documentTypeId);
    Optional<DocumentSubType> findByDocumentType_IdAndNameIgnoreCase(UUID documentTypeId, String name);
    Optional<DocumentSubType> findByDocumentType_IdAndNameIgnoreCaseAndIdNot(UUID documentTypeId, String name, UUID id);
}
