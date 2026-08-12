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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "documents")
public class DocumentRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_number", nullable = false, unique = true, length = 80)
    private String documentNumber;

    @Column(name = "document_name", nullable = false, length = 255)
    private String documentName;

    @Column(name = "title_local_language", length = 255)
    private String titleLocalLanguage;

    @Column(nullable = false, length = 40)
    private String version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "status_code", referencedColumnName = "code", nullable = false)
    private DocumentStatusDefinition status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_type_id", nullable = false)
    private DocumentType documentType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_unit_id", nullable = false)
    private BusinessUnit businessUnit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_user_id", nullable = false)
    private UserAccount author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private UserAccount owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opened_by_user_id")
    private UserAccount openedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_modified_by_user_id")
    private UserAccount lastModifiedBy;

    @Column(length = 1024)
    private String description;

    @Column(name = "knowledge_base", length = 255)
    private String knowledgeBase;

    @Column(name = "is_template", nullable = false)
    private boolean template;

    @Column(name = "has_related_documents", nullable = false)
    private boolean hasRelatedDocuments;

    @Column(name = "has_correlated_documents", nullable = false)
    private boolean hasCorrelatedDocuments;

    @Column(name = "effective_date")
    private LocalDate effectiveDate;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Column(name = "review_date")
    private LocalDate reviewDate;

    @Column(name = "periodic_review_cycle")
    private Integer periodicReviewCycle;

    @Column(name = "periodic_review_notification")
    private Integer periodicReviewNotification;

    @Column(name = "sub_type", length = 255)
    private String subType;

    @Column(length = 100)
    private String language;

    @Column(name = "requires_training", nullable = false)
    private boolean requiresTraining;

    @Column(name = "training_period_days")
    private Integer trainingPeriodDays;

    @Column(name = "reason_for_skipping_training", length = 1024)
    private String reasonForSkippingTraining;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "obsoleted_by_user_id")
    private UserAccount obsoletedBy;

    @Column(name = "obsoleted_at")
    private Instant obsoletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by_user_id")
    private UserAccount cancelledBy;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
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

    public String getDocumentNumber() {
        return documentNumber;
    }

    public void setDocumentNumber(String documentNumber) {
        this.documentNumber = documentNumber;
    }

    public String getDocumentName() {
        return documentName;
    }

    public void setDocumentName(String documentName) {
        this.documentName = documentName;
    }

    public String getTitleLocalLanguage() {
        return titleLocalLanguage;
    }

    public void setTitleLocalLanguage(String titleLocalLanguage) {
        this.titleLocalLanguage = titleLocalLanguage;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public DocumentStatusDefinition getStatus() {
        return status;
    }

    public void setStatus(DocumentStatusDefinition status) {
        this.status = status;
    }

    public DocumentType getDocumentType() {
        return documentType;
    }

    public void setDocumentType(DocumentType documentType) {
        this.documentType = documentType;
    }

    public BusinessUnit getBusinessUnit() {
        return businessUnit;
    }

    public void setBusinessUnit(BusinessUnit businessUnit) {
        this.businessUnit = businessUnit;
    }

    public Department getDepartment() {
        return department;
    }

    public void setDepartment(Department department) {
        this.department = department;
    }

    public UserAccount getAuthor() {
        return author;
    }

    public void setAuthor(UserAccount author) {
        this.author = author;
    }

    public UserAccount getOwner() {
        return owner;
    }

    public void setOwner(UserAccount owner) {
        this.owner = owner;
    }

    public UserAccount getOpenedBy() {
        return openedBy;
    }

    public void setOpenedBy(UserAccount openedBy) {
        this.openedBy = openedBy;
    }

    public UserAccount getLastModifiedBy() {
        return lastModifiedBy;
    }

    public void setLastModifiedBy(UserAccount lastModifiedBy) {
        this.lastModifiedBy = lastModifiedBy;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getKnowledgeBase() {
        return knowledgeBase;
    }

    public void setKnowledgeBase(String knowledgeBase) {
        this.knowledgeBase = knowledgeBase;
    }

    public boolean isTemplate() {
        return template;
    }

    public void setTemplate(boolean template) {
        this.template = template;
    }

    public boolean isHasRelatedDocuments() {
        return hasRelatedDocuments;
    }

    public void setHasRelatedDocuments(boolean hasRelatedDocuments) {
        this.hasRelatedDocuments = hasRelatedDocuments;
    }

    public boolean isHasCorrelatedDocuments() {
        return hasCorrelatedDocuments;
    }

    public void setHasCorrelatedDocuments(boolean hasCorrelatedDocuments) {
        this.hasCorrelatedDocuments = hasCorrelatedDocuments;
    }

    public LocalDate getEffectiveDate() {
        return effectiveDate;
    }

    public void setEffectiveDate(LocalDate effectiveDate) {
        this.effectiveDate = effectiveDate;
    }

    public LocalDate getValidUntil() {
        return validUntil;
    }

    public void setValidUntil(LocalDate validUntil) {
        this.validUntil = validUntil;
    }

    public LocalDate getReviewDate() {
        return reviewDate;
    }

    public void setReviewDate(LocalDate reviewDate) {
        this.reviewDate = reviewDate;
    }

    public Integer getPeriodicReviewCycle() {
        return periodicReviewCycle;
    }

    public void setPeriodicReviewCycle(Integer periodicReviewCycle) {
        this.periodicReviewCycle = periodicReviewCycle;
    }

    public Integer getPeriodicReviewNotification() {
        return periodicReviewNotification;
    }

    public void setPeriodicReviewNotification(Integer periodicReviewNotification) {
        this.periodicReviewNotification = periodicReviewNotification;
    }

    public String getSubType() {
        return subType;
    }

    public void setSubType(String subType) {
        this.subType = subType;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public boolean isRequiresTraining() {
        return requiresTraining;
    }

    public void setRequiresTraining(boolean requiresTraining) {
        this.requiresTraining = requiresTraining;
    }

    public Integer getTrainingPeriodDays() {
        return trainingPeriodDays;
    }

    public void setTrainingPeriodDays(Integer trainingPeriodDays) {
        this.trainingPeriodDays = trainingPeriodDays;
    }

    public String getReasonForSkippingTraining() {
        return reasonForSkippingTraining;
    }

    public void setReasonForSkippingTraining(String reasonForSkippingTraining) {
        this.reasonForSkippingTraining = reasonForSkippingTraining;
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

    public UserAccount getObsoletedBy() {
        return obsoletedBy;
    }

    public void setObsoletedBy(UserAccount obsoletedBy) {
        this.obsoletedBy = obsoletedBy;
    }

    public Instant getObsoletedAt() {
        return obsoletedAt;
    }

    public void setObsoletedAt(Instant obsoletedAt) {
        this.obsoletedAt = obsoletedAt;
    }

    public UserAccount getCancelledBy() {
        return cancelledBy;
    }

    public void setCancelledBy(UserAccount cancelledBy) {
        this.cancelledBy = cancelledBy;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(Instant cancelledAt) {
        this.cancelledAt = cancelledAt;
    }

}
