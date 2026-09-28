package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Permanent, never-deleted record of every user who was ever assigned as Author/Co-Author/
 * Reviewer/Approver on a Document Master -- see V458__add_document_stakeholder_history.sql.
 * Always written regardless of the "Retain visibility for removed participants" system setting;
 * only {@link com.eqms.service.DocumentAuthorizationService#isDirectStakeholder} reading from it is
 * gated by that toggle.
 */
@Entity
@Table(name = "document_stakeholder_history")
public class DocumentStakeholderHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "participant_type", nullable = false, length = 20)
    private String participantType;

    @Column(name = "first_assigned_at", nullable = false, updatable = false)
    private Instant firstAssignedAt;

    @PrePersist
    void onCreate() {
        if (firstAssignedAt == null) {
            firstAssignedAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public DocumentRecord getDocument() {
        return document;
    }

    public void setDocument(DocumentRecord document) {
        this.document = document;
    }

    public UserAccount getUser() {
        return user;
    }

    public void setUser(UserAccount user) {
        this.user = user;
    }

    public String getParticipantType() {
        return participantType;
    }

    public void setParticipantType(String participantType) {
        this.participantType = participantType;
    }

    public Instant getFirstAssignedAt() {
        return firstAssignedAt;
    }

    public void setFirstAssignedAt(Instant firstAssignedAt) {
        this.firstAssignedAt = firstAssignedAt;
    }
}
