package com.eqms.repository;

import com.eqms.entity.RevisionSnapshotHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevisionSnapshotHistoryRepository extends JpaRepository<RevisionSnapshotHistory, UUID> {

    List<RevisionSnapshotHistory> findAllByRevision_IdOrderByGeneratedAtDesc(UUID revisionId);

    Optional<RevisionSnapshotHistory> findFirstByRevision_IdAndReviewRoundOrderByGeneratedAtDesc(UUID revisionId, int reviewRound);

    Optional<RevisionSnapshotHistory> findByIdAndRevision_Id(UUID id, UUID revisionId);
}
