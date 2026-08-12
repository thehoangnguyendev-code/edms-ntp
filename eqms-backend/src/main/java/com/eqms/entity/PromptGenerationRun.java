package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "prompt_generation_runs")
public class PromptGenerationRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prompt_specification_id", nullable = false)
    private PromptSpecification promptSpecification;

    @Column(name = "target_frontend_path", length = 255)
    private String targetFrontendPath;

    @Column(name = "target_backend_path", length = 255)
    private String targetBackendPath;

    @Column(name = "target_database_path", length = 255)
    private String targetDatabasePath;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "generationRun")
    private List<GeneratedArtifact> artifacts = new ArrayList<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (generatedAt == null) {
            generatedAt = now;
        }
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (status == null || status.isBlank()) {
            status = PromptGenerationRunStatus.QUEUED.name();
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public PromptSpecification getPromptSpecification() {
        return promptSpecification;
    }

    public void setPromptSpecification(PromptSpecification promptSpecification) {
        this.promptSpecification = promptSpecification;
    }

    public String getTargetFrontendPath() {
        return targetFrontendPath;
    }

    public void setTargetFrontendPath(String targetFrontendPath) {
        this.targetFrontendPath = targetFrontendPath;
    }

    public String getTargetBackendPath() {
        return targetBackendPath;
    }

    public void setTargetBackendPath(String targetBackendPath) {
        this.targetBackendPath = targetBackendPath;
    }

    public String getTargetDatabasePath() {
        return targetDatabasePath;
    }

    public void setTargetDatabasePath(String targetDatabasePath) {
        this.targetDatabasePath = targetDatabasePath;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(Instant generatedAt) {
        this.generatedAt = generatedAt;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<GeneratedArtifact> getArtifacts() {
        return artifacts;
    }

    public void setArtifacts(List<GeneratedArtifact> artifacts) {
        this.artifacts = artifacts;
    }
}
