package com.eqms.repository;

import com.eqms.entity.DocumentStakeholderHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.UUID;

public interface DocumentStakeholderHistoryRepository extends JpaRepository<DocumentStakeholderHistory, UUID> {

    /** Navigation: the user held one of the given roles on any Document (the "retain visibility" toggles). */
    boolean existsByUser_IdAndParticipantTypeIn(UUID userId, java.util.Collection<String> participantTypes);
    boolean existsByDocument_IdAndUser_IdAndParticipantType(UUID documentId, UUID userId, String participantType);
    /** Used by isDirectStakeholder: true only if the user held one of the CALLER-SUPPLIED roles --
     *  the per-role "Retain Visibility for Removed ..." toggles, not "any of the 4" unconditionally. */
    boolean existsByDocument_IdAndUser_IdAndParticipantTypeIn(UUID documentId, UUID userId, Collection<String> participantTypes);
}
