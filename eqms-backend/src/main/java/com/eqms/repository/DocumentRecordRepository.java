package com.eqms.repository;

import com.eqms.entity.DocumentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface DocumentRecordRepository extends JpaRepository<DocumentRecord, UUID>, JpaSpecificationExecutor<DocumentRecord> {
    boolean existsByDocumentNumber(String documentNumber);
    Optional<DocumentRecord> findByDocumentNumber(String documentNumber);
    List<DocumentRecord> findAllByDocumentType_Id(UUID documentTypeId);
    boolean existsByDocumentType_Id(UUID documentTypeId);
    boolean existsByBusinessUnit_Id(UUID businessUnitId);
    boolean existsByDepartment_Id(UUID departmentId);
    boolean existsByDocumentType_IdAndSubTypeIgnoreCase(UUID documentTypeId, String subType);
    long countByAuthor_Id(UUID authorId);
    long countByOwner_Id(UUID ownerId);
    List<DocumentRecord> findAllByStatus_CodeOrderByDepartment_CodeAscDocumentNameAsc(String statusCode);
    long countByStatus_Code(String statusCode);

    /**
     * Returns the highest issued numeric suffix for a document-number prefix.
     * The lookup deliberately uses the persisted number rather than the assigned
     * Document Type: historical records can have an incorrect type assignment,
     * but their number must remain reserved and must never be re-issued.
     */
    @Query(value = """
            SELECT COALESCE(MAX(CAST(SPLIT_PART(document_number, '.', 2) AS INTEGER)), 0)
            FROM documents
            WHERE UPPER(SPLIT_PART(document_number, '.', 1)) = UPPER(:prefix)
              AND document_number ~ '^[^.]+\\.[0-9]{1,4}$'
            """, nativeQuery = true)
    int findMaxDocumentSequenceByPrefix(@Param("prefix") String prefix);

    @Query(value = """
            SELECT UPPER(SPLIT_PART(document_number, '.', 1)) AS prefix,
                   MAX(CAST(SPLIT_PART(document_number, '.', 2) AS INTEGER)) AS sequence
            FROM documents
            WHERE document_number ~ '^[^.]+\\.[0-9]{1,4}$'
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
