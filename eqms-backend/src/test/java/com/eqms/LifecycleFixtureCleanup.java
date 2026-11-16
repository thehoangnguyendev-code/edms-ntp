package com.eqms;

import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.RevisionStatusDefinitionRepository;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Collection;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

/**
 * Puts away what a test made, along the lifecycle (STATUS-CONSISTENCY-2026-11-14). A test cannot delete a Document or a Revision (the database refuses), and it must not write a
 * status the product cannot lead to: it used to set every Revision and Document to Closed - Cancelled, whatever it was, which left Effective revisions and Controlled Copies
 * that had been handed over under cancelled records (and the server now refuses it). What was Effective is Obsoleted, what never was is cancelled, and the copies that are still
 * alive are Obsoleted with the reason of the record they belong to.
 */
final class LifecycleFixtureCleanup {
    private LifecycleFixtureCleanup() {}

    static void putAway(TransactionTemplate tx, DocumentRecordRepository documents, DocumentRevisionRepository revisions, DocumentStatusDefinitionRepository documentStatuses,
                        RevisionStatusDefinitionRepository revisionStatuses, ControlledCopyRepository copies, Collection<UUID> documentIds) {
        DocumentStatusDefinition obsoletedDocument = documentStatuses.findById("OBSOLETED").orElseThrow();
        DocumentStatusDefinition cancelledDocument = documentStatuses.findById("CLOSED_CANCELLED").orElseThrow();
        RevisionStatusDefinition obsoletedRevision = revisionStatuses.findById("OBSOLETED").orElseThrow();
        RevisionStatusDefinition cancelledRevision = revisionStatuses.findById("CLOSED_CANCELLED").orElseThrow();
        List<UUID> reachedEffectiveButStillDraft = new ArrayList<>();
        tx.executeWithoutResult(status -> {
            for (UUID documentId : documentIds) {
                revisions.findAllByDocument_IdOrderByCreatedAtDesc(documentId).forEach(r -> {
                    String code = r.getStatus() == null ? "" : r.getStatus().getCode();
                    if ("EFFECTIVE".equals(code)) r.setStatus(obsoletedRevision);
                    else if (!"OBSOLETED".equals(code) && !"CLOSED_CANCELLED".equals(code)) r.setStatus(cancelledRevision);
                    else return;
                    revisions.save(r);
                });
                documents.findById(documentId).ifPresent(d -> {
                    String code = d.getStatus() == null ? "" : d.getStatus().getCode();
                    boolean everEffective = revisions.findAllByDocument_IdOrderByCreatedAtDesc(documentId).stream()
                            .anyMatch(r -> r.getStatus() != null && "OBSOLETED".equals(r.getStatus().getCode()));
                    if ("ACTIVE".equals(code)) d.setStatus(obsoletedDocument);
                    else if ("DRAFT".equals(code) && !everEffective) d.setStatus(cancelledDocument);
                    else if ("DRAFT".equals(code)) { reachedEffectiveButStillDraft.add(documentId); return; }
                    else return;
                    documents.save(d);
                });
            }
            HashSet<UUID> created = new HashSet<>(documentIds);
            copies.findAll().stream()
                    .filter(c -> c.getRevision() != null && c.getRevision().getDocument() != null && created.contains(c.getRevision().getDocument().getId()))
                    .filter(c -> "DISTRIBUTED".equals(c.getStatusCode()) || "READY_FOR_DISTRIBUTION".equals(c.getStatusCode()))
                    .forEach(c -> {
                        c.setStatus("Obsoleted");
                        c.setStatusCode("OBSOLETED");
                        c.setCurrentStage("Obsoleted");
                        c.setObsoleteReason("DOCUMENT_OBSOLETED");
                        copies.save(c);
                    });
        });
        // A Document that had an Effective revision but was left Draft by the test goes the way the product goes: Active, then Obsoleted (two saves, two transactions).
        DocumentStatusDefinition active = documentStatuses.findById("ACTIVE").orElseThrow();
        for (UUID documentId : reachedEffectiveButStillDraft) {
            tx.executeWithoutResult(status -> documents.findById(documentId).ifPresent(d -> { d.setStatus(active); documents.save(d); }));
            tx.executeWithoutResult(status -> documents.findById(documentId).ifPresent(d -> { d.setStatus(obsoletedDocument); documents.save(d); }));
        }
    }
}
