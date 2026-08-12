package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "prompt_specifications")
public class PromptSpecification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "module_name", nullable = false, length = 120)
    private String moduleName;

    @Column(name = "prompt_title", nullable = false, length = 200)
    private String promptTitle;

    @Column(name = "prompt_text", nullable = false, columnDefinition = "text")
    private String promptText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "spec_payload", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> specPayload = new LinkedHashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PromptSpecificationStatus status = PromptSpecificationStatus.DRAFT;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "promptSpecification")
    private List<PromptGenerationRun> generationRuns = new ArrayList<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (status == null) {
            status = PromptSpecificationStatus.DRAFT;
        }
        if (specPayload == null) {
            specPayload = new LinkedHashMap<>();
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

    public String getModuleName() {
        return moduleName;
    }

    public void setModuleName(String moduleName) {
        this.moduleName = moduleName;
    }

    public String getPromptTitle() {
        return promptTitle;
    }

    public void setPromptTitle(String promptTitle) {
        this.promptTitle = promptTitle;
    }

    public String getPromptText() {
        return promptText;
    }

    public void setPromptText(String promptText) {
        this.promptText = promptText;
    }

    public Map<String, Object> getSpecPayload() {
        return specPayload;
    }

    public void setSpecPayload(Map<String, Object> specPayload) {
        this.specPayload = specPayload;
    }

    public PromptSpecificationStatus getStatus() {
        return status;
    }

    public void setStatus(PromptSpecificationStatus status) {
        this.status = status;
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

    public List<PromptGenerationRun> getGenerationRuns() {
        return generationRuns;
    }

    public void setGenerationRuns(List<PromptGenerationRun> generationRuns) {
        this.generationRuns = generationRuns;
    }
}
