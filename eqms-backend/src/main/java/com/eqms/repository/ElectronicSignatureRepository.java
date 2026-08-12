package com.eqms.repository;

import com.eqms.entity.ElectronicSignature;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ElectronicSignatureRepository extends JpaRepository<ElectronicSignature, UUID> {
    List<ElectronicSignature> findByRevision_IdOrderBySignedAtAsc(UUID revisionId);
    List<ElectronicSignature> findByDocument_IdOrderBySignedAtAsc(UUID documentId);
    List<ElectronicSignature> findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc(String entityType, UUID entityId);
    Optional<ElectronicSignature> findFirstByRevision_IdAndMeaningIgnoreCaseAndStatusOrderBySignedAtDesc(UUID revisionId, String meaning, String status);
    Optional<ElectronicSignature> findFirstByEntityTypeIgnoreCaseAndEntityIdAndMeaningIgnoreCaseAndStatusOrderBySignedAtDesc(String entityType, UUID entityId, String meaning, String status);

    @Query(value = "select nextval('electronic_signature_sequence')", nativeQuery = true)
    Long nextSignatureSequence();
}
