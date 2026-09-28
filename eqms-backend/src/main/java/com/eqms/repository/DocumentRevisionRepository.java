package com.eqms.repository;

import com.eqms.entity.DocumentRevisionRecord;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;

public interface DocumentRevisionRepository extends JpaRepository<DocumentRevisionRecord, UUID>, JpaSpecificationExecutor<DocumentRevisionRecord> {
    List<DocumentRevisionRecord> findAllByDocument_IdOrderByCreatedAtDesc(UUID documentId);
    List<DocumentRevisionRecord> findAllByDocument_IdOrderByCreatedAtAsc(UUID documentId);

    /** Candidates for {@code RevisionSnapshotRetryScheduler}: generation failed and retry budget remains. */
    List<DocumentRevisionRecord> findAllBySnapshotStatusAndSnapshotRetryCountLessThan(String snapshotStatus, int maxRetryCount);
    Optional<DocumentRevisionRecord> findByIdAndDocument_Id(UUID id, UUID documentId);

    /** Row-locked lookup for the narrow window where "Complete Editing" (locks the source +
     *  revokes Office Online edit access) races a concurrent "grant me Office Online edit access"
     *  call for a different Co-Author -- both otherwise read/decide on an unlocked snapshot of
     *  the same row via plain findById. Deliberately NOT used for requireRevision()'s many other
     *  read call sites, which have no such race and would only pay unnecessary lock contention. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from DocumentRevisionRecord r where r.id = :id")
    Optional<DocumentRevisionRecord> findByIdForUpdate(@Param("id") UUID id);
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

    /**
     * The async snapshot workers must not write through a stale managed entity: the multi-second
     * conversion overlaps with workflow actions that bump the revision's lock version, and a plain
     * save() then failed with an optimistic-lock error that the async handler swallowed, leaving the
     * snapshot GENERATING forever. Guarded by request id + source checksum so a superseded task is a no-op.
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("""
            update DocumentRevisionRecord r
               set r.previewFilePath = :path, r.storagePdfUrl = :path, r.snapshotStatus = 'READY',
                   r.snapshotSourceChecksum = :checksum, r.snapshotError = null, r.lockVersion = r.lockVersion + 1
             where r.id = :id and r.snapshotRequestId = :requestId
               and r.sourceFileChecksum = :checksum and r.snapshotStatus = 'GENERATING'
            """)
    int markReviewSnapshotReady(@Param("id") UUID id, @Param("requestId") UUID requestId,
                                @Param("checksum") String checksum, @Param("path") String path);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("""
            update DocumentRevisionRecord r
               set r.snapshotStatus = 'FAILED', r.snapshotError = :error, r.lockVersion = r.lockVersion + 1
             where r.id = :id and r.snapshotRequestId = :requestId and r.snapshotStatus = 'GENERATING'
            """)
    int markReviewSnapshotFailed(@Param("id") UUID id, @Param("requestId") UUID requestId, @Param("error") String error);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("""
            update DocumentRevisionRecord r
               set r.previewFilePath = :path, r.storagePdfUrl = :path, r.lockVersion = r.lockVersion + 1
             where r.id = :id
            """)
    int updatePreviewPath(@Param("id") UUID id, @Param("path") String path);
}
