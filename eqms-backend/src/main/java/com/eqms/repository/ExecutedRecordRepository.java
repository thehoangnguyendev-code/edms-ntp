package com.eqms.repository;

import com.eqms.entity.ExecutedRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.UUID;

public interface ExecutedRecordRepository extends JpaRepository<ExecutedRecord, UUID>, JpaSpecificationExecutor<ExecutedRecord> {
    List<ExecutedRecord> findAllByFormDocument_IdOrderByCreatedAtDesc(UUID formDocumentId);

    long countByFormDocument_Id(UUID formDocumentId);

    boolean existsByRecordNumber(String recordNumber);

    boolean existsBySourceControlledCopy_IdAndStatusNot(UUID controlledCopyId, String excludedStatus);
}
