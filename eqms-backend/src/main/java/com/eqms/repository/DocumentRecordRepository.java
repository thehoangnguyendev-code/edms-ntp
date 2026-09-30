package com.eqms.repository;

import com.eqms.entity.DocumentRecord;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface DocumentRecordRepository extends JpaRepository<DocumentRecord, UUID>, JpaSpecificationExecutor<DocumentRecord> {
    boolean existsByDocumentNumber(String documentNumber);

    /**
     * TBR-DOC-015 concurrency mechanism: a row-level lock on the Document Master, taken by
     * DocumentService.obsoleteDocument's final precondition re-check and by
     * RevisionService.upgradeRevision (the only revision mutation that can introduce a brand-new
     * in-progress Revision when Document Obsolete's initial check saw none). Both compete for the
     * same row lock, serializing the two operations without resorting to SERIALIZABLE isolation
     * or locking any other table. Held until the holder's transaction commits/rolls back.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DocumentRecord d where d.id = :id")
    Optional<DocumentRecord> findByIdForUpdate(@Param("id") UUID id);
    Optional<DocumentRecord> findByDocumentNumber(String documentNumber);
    List<DocumentRecord> findAllByDocumentType_Id(UUID documentTypeId);
    boolean existsByDocumentType_Id(UUID documentTypeId);
    boolean existsByBusinessUnit_Id(UUID businessUnitId);

    boolean existsByDepartment_Id(UUID departmentId);
    boolean existsByDocumentType_IdAndSubTypeIgnoreCase(UUID documentTypeId, String subType);
    boolean existsBySubTypeId(UUID subTypeId);

    /** Keeps the display copy of a Sub-Type's name on its Documents in step with a rename (subTypeId is the authoritative link). */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = false)
    @Query("update DocumentRecord d set d.subType = :name where d.subTypeId = :subTypeId and (d.subType is null or d.subType <> :name)")
    int updateSubTypeNameBySubTypeId(@Param("subTypeId") UUID subTypeId, @Param("name") String name);
    long countByAuthor_Id(UUID authorId);
    long countByOwner_Id(UUID ownerId);
    List<DocumentRecord> findAllByStatus_CodeOrderByDepartment_CodeAscDocumentNameAsc(String statusCode);
    long countByStatus_Code(String statusCode);

    /**
     * Returns the highest issued numeric suffix for a document-number prefix.
     * The lookup deliberately uses the persisted number rather than the assigned
     * Document Type: historical records can have an incorrect type assignment,
     * but their number must remain reserved and must never be re-issued.
     *
     * The suffix width is capped at 9 digits (not the historical 4) to match
     * SystemConfigurationService#getSerialNumberDigits' configurable range -- Document Properties
     * lets an admin widen the Serial Number's zero-padding, and this reconciliation query must
     * keep matching those wider numbers or it would silently under-count the true max sequence.
     * 9 digits is also the safe ceiling for CAST(...AS INTEGER) (max ~2.1 billion).
     */
    @Query(value = """
            SELECT COALESCE(MAX(CAST(SPLIT_PART(document_number, '.', 2) AS INTEGER)), 0)
            FROM documents
            WHERE UPPER(SPLIT_PART(document_number, '.', 1)) = UPPER(:prefix)
              AND document_number ~ '^[^.]+\\.[0-9]{1,9}$'
            """, nativeQuery = true)
    int findMaxDocumentSequenceByPrefix(@Param("prefix") String prefix);

    @Query(value = """
            SELECT UPPER(SPLIT_PART(document_number, '.', 1)) AS prefix,
                   MAX(CAST(SPLIT_PART(document_number, '.', 2) AS INTEGER)) AS sequence
            FROM documents
            WHERE document_number ~ '^[^.]+\\.[0-9]{1,9}$'
            GROUP BY UPPER(SPLIT_PART(document_number, '.', 1))
            """, nativeQuery = true)
    List<Object[]> findMaxDocumentSequencesByPrefix();

    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC('month', created_at AT TIME ZONE 'UTC'), 'Mon YYYY') AS label,
                   COUNT(*) AS value
            FROM documents
            WHERE created_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at AT TIME ZONE 'UTC')
            ORDER BY DATE_TRUNC('month', created_at AT TIME ZONE 'UTC')
            """, nativeQuery = true)
    List<Object[]> countDocumentsGroupedByMonth();

    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC('quarter', created_at AT TIME ZONE 'UTC'), 'Q YYYY') AS label,
                   COUNT(*) AS value
            FROM documents
            WHERE created_at >= NOW() - INTERVAL '4 quarters'
            GROUP BY DATE_TRUNC('quarter', created_at AT TIME ZONE 'UTC')
            ORDER BY DATE_TRUNC('quarter', created_at AT TIME ZONE 'UTC')
            """, nativeQuery = true)
    List<Object[]> countDocumentsGroupedByQuarter();

    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC('year', created_at AT TIME ZONE 'UTC'), 'YYYY') AS label,
                   COUNT(*) AS value
            FROM documents
            WHERE created_at >= NOW() - INTERVAL '5 years'
            GROUP BY DATE_TRUNC('year', created_at AT TIME ZONE 'UTC')
            ORDER BY DATE_TRUNC('year', created_at AT TIME ZONE 'UTC')
            """, nativeQuery = true)
    List<Object[]> countDocumentsGroupedByYear();
}
