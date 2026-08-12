package com.eqms.repository;

import com.eqms.entity.RevisionWorkingNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevisionWorkingNoteRepository extends JpaRepository<RevisionWorkingNote, UUID> {

    List<RevisionWorkingNote> findAllByRevision_IdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID revisionId);

    Optional<RevisionWorkingNote> findByIdAndRevision_IdAndDeletedAtIsNull(UUID id, UUID revisionId);
}
