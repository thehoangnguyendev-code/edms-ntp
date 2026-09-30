package com.eqms.repository;

import com.eqms.entity.UncontrolledCopyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface UncontrolledCopyRepository extends JpaRepository<UncontrolledCopyRecord, UUID>, JpaSpecificationExecutor<UncontrolledCopyRecord> {
    List<UncontrolledCopyRecord> findAllByDocument_IdOrderByCreatedAtDesc(UUID documentId);
    List<UncontrolledCopyRecord> findAllByStatusOrderByCreatedAtDesc(String status);
    List<UncontrolledCopyRecord> findAllByRequestedBy_IdOrderByCreatedAtDesc(UUID requestedByUserId);

    long countByDocument_Id(UUID documentId);

    boolean existsByUncontrolledCopyNumber(String uncontrolledCopyNumber);

    List<UncontrolledCopyRecord> findTop200ByStatusCodeAndValidUntilBeforeOrderByValidUntilAsc(String statusCode, Instant cutoff);

    /**
     * Atomically records one download. When {@code downloadOnce} is true (policy disallows re-download) the
     * row is only updated if it has never been downloaded, so two concurrent first downloads cannot both pass.
     */
    @Modifying
    @Query("update UncontrolledCopyRecord c set c.downloadCount = c.downloadCount + 1, c.lastDownloadedAt = :now "
            + "where c.id = :id and (:downloadOnce = false or c.downloadCount = 0)")
    int consumeDownload(@Param("id") UUID id, @Param("now") Instant now, @Param("downloadOnce") boolean downloadOnce);
}
