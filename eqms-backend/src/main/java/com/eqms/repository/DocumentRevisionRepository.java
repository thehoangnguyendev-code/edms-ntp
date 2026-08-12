package com.eqms.repository;

import com.eqms.entity.DocumentRevisionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;

public interface DocumentRevisionRepository extends JpaRepository<DocumentRevisionRecord, UUID>, JpaSpecificationExecutor<DocumentRevisionRecord> {
    List<DocumentRevisionRecord> findAllByDocument_IdOrderByCreatedAtDesc(UUID documentId);
    List<DocumentRevisionRecord> findAllByDocument_IdOrderByCreatedAtAsc(UUID documentId);
    Optional<DocumentRevisionRecord> findByIdAndDocument_Id(UUID id, UUID documentId);
    Optional<DocumentRevisionRecord> findFirstByDocument_IdOrderByCreatedAtDesc(UUID documentId);
    Optional<DocumentRevisionRecord> findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(UUID documentId, String statusCode);
    List<DocumentRevisionRecord> findAllByDocument_IdAndStatus_Code(UUID documentId, String statusCode);
    boolean existsByDocument_Id(UUID documentId);
    boolean existsByDocumentType_Id(UUID documentTypeId);
    boolean existsByBusinessUnit_Id(UUID businessUnitId);
    boolean existsByDepartment_Id(UUID departmentId);

    Optional<DocumentRevisionRecord> findFirstByDocument_IdAndStatus_CodeInOrderByCreatedAtDesc(UUID documentId, Collection<String> statusCodes);
    boolean existsByDocument_IdAndStatus_CodeIn(UUID documentId, Collection<String> statusCodes);
    boolean existsByDocument_IdAndStatus_CodeInAndIdNot(UUID documentId, Collection<String> statusCodes, UUID id);
    long countByDocument_Id(UUID documentId);
    long countByStatus_Code(String statusCode);
    List<DocumentRevisionRecord> findAllByDocument_IdInAndStatus_CodeInOrderByDocument_IdAscCreatedAtDesc(
            Collection<UUID> documentIds,
            Collection<String> statusCodes
    );

    @Query("""
            SELECT r FROM DocumentRevisionRecord r
            WHERE r.status.code IN :statusCodes
            AND EXISTS (
                SELECT p FROM DocumentWorkflowParticipant p
                WHERE p.document.id = r.document.id
                AND p.user.id = :userId
                AND p.participantType IN :participantTypes
            )
            ORDER BY r.createdAt DESC
            """)
    List<DocumentRevisionRecord> findMyPendingTasks(
            @Param("userId") UUID userId,
            @Param("statusCodes") Collection<String> statusCodes,
            @Param("participantTypes") Collection<String> participantTypes
    );
}
