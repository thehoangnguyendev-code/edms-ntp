package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** The Education > Schools dictionary -- universities, colleges, academies, vocational secondary
 *  schools, and trade schools in Vietnam. {@code type} is one of {@link SchoolType}. */
@Entity
@Table(name = "schools")
public class School {

    public enum SchoolType {
        UNIVERSITY, COLLEGE, ACADEMY, VOCATIONAL_SECONDARY, TRADE_SCHOOL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String name;

    @Column(length = 40)
    private String abbreviation;

    @Column(nullable = false, length = 40)
    private String type;

    /** PUBLIC / PRIVATE / FOREIGN_INVESTED, or null when unspecified in the source data. */
    @Column(length = 40)
    private String ownership;

    @Column(name = "catalog_id", unique = true, length = 80)
    private String catalogId;
    @Column(length = 255)
    private String slug;
    @Column(name = "entity_kind", length = 80)
    private String entityKind;
    @Column(name = "is_independent_institution")
    private Boolean independentInstitution;
    @Column(name = "institution_type", length = 80)
    private String institutionType;
    @Column(name = "institution_type_label", length = 120)
    private String institutionTypeLabel;
    @Column(name = "presence_type", length = 100)
    private String presenceType;
    @Column(name = "operational_status", length = 100)
    private String operationalStatus;
    @Column(name = "verified_as_of")
    private LocalDate verifiedAsOf;
    @Column(name = "verification_status", length = 120)
    private String verificationStatus;
    @Column(name = "governing_body", length = 255)
    private String governingBody;
    @Column(name = "governing_body_type", length = 100)
    private String governingBodyType;
    @Column(name = "governing_body_verification_status", length = 120)
    private String governingBodyVerificationStatus;
    @Column(name = "national_education_regulator", length = 255)
    private String nationalEducationRegulator;
    @Column(name = "governance_model", length = 60)
    private String governanceModel;
    @Column(name = "direct_governing_ministry", length = 255)
    private String directGoverningMinistry;
    @Column(name = "country_of_origin_name", length = 120)
    private String countryOfOriginName;
    @Column(name = "country_of_origin_iso2", length = 2)
    private String countryOfOriginIso2;
    @Column(name = "host_in_vietnam", length = 255)
    private String hostInVietnam;
    @Column(name = "parent_or_partner", length = 500)
    private String parentOrPartner;
    @Column(name = "supervising_authority", length = 255)
    private String supervisingAuthority;
    @Column(name = "ultimate_governing_body", length = 255)
    private String ultimateGoverningBody;
    @Column(name = "ownership_verification_status", length = 120)
    private String ownershipVerificationStatus;
    @Column(name = "status_note", length = 1000)
    private String statusNote;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "governing_body_source_urls", columnDefinition = "jsonb")
    private List<String> governingBodySourceUrls;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAbbreviation() {
        return abbreviation;
    }

    public void setAbbreviation(String abbreviation) {
        this.abbreviation = abbreviation;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getOwnership() {
        return ownership;
    }

    public void setOwnership(String ownership) {
        this.ownership = ownership;
    }

    public String getCatalogId() { return catalogId; }
    public void setCatalogId(String catalogId) { this.catalogId = catalogId; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getEntityKind() { return entityKind; }
    public void setEntityKind(String entityKind) { this.entityKind = entityKind; }
    public Boolean getIndependentInstitution() { return independentInstitution; }
    public void setIndependentInstitution(Boolean independentInstitution) { this.independentInstitution = independentInstitution; }
    public String getInstitutionType() { return institutionType; }
    public void setInstitutionType(String institutionType) { this.institutionType = institutionType; }
    public String getInstitutionTypeLabel() { return institutionTypeLabel; }
    public void setInstitutionTypeLabel(String institutionTypeLabel) { this.institutionTypeLabel = institutionTypeLabel; }
    public String getPresenceType() { return presenceType; }
    public void setPresenceType(String presenceType) { this.presenceType = presenceType; }
    public String getOperationalStatus() { return operationalStatus; }
    public void setOperationalStatus(String operationalStatus) { this.operationalStatus = operationalStatus; }
    public LocalDate getVerifiedAsOf() { return verifiedAsOf; }
    public void setVerifiedAsOf(LocalDate verifiedAsOf) { this.verifiedAsOf = verifiedAsOf; }
    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }
    public String getGoverningBody() { return governingBody; }
    public void setGoverningBody(String governingBody) { this.governingBody = governingBody; }
    public String getGoverningBodyType() { return governingBodyType; }
    public void setGoverningBodyType(String governingBodyType) { this.governingBodyType = governingBodyType; }
    public String getGoverningBodyVerificationStatus() { return governingBodyVerificationStatus; }
    public void setGoverningBodyVerificationStatus(String value) { this.governingBodyVerificationStatus = value; }
    public String getNationalEducationRegulator() { return nationalEducationRegulator; }
    public void setNationalEducationRegulator(String value) { this.nationalEducationRegulator = value; }
    public String getGovernanceModel() { return governanceModel; }
    public void setGovernanceModel(String governanceModel) { this.governanceModel = governanceModel; }
    public String getDirectGoverningMinistry() { return directGoverningMinistry; }
    public void setDirectGoverningMinistry(String value) { this.directGoverningMinistry = value; }
    public String getCountryOfOriginName() { return countryOfOriginName; }
    public void setCountryOfOriginName(String value) { this.countryOfOriginName = value; }
    public String getCountryOfOriginIso2() { return countryOfOriginIso2; }
    public void setCountryOfOriginIso2(String value) { this.countryOfOriginIso2 = value; }
    public String getHostInVietnam() { return hostInVietnam; }
    public void setHostInVietnam(String value) { this.hostInVietnam = value; }
    public String getParentOrPartner() { return parentOrPartner; }
    public void setParentOrPartner(String value) { this.parentOrPartner = value; }
    public String getSupervisingAuthority() { return supervisingAuthority; }
    public void setSupervisingAuthority(String value) { this.supervisingAuthority = value; }
    public String getUltimateGoverningBody() { return ultimateGoverningBody; }
    public void setUltimateGoverningBody(String value) { this.ultimateGoverningBody = value; }
    public String getOwnershipVerificationStatus() { return ownershipVerificationStatus; }
    public void setOwnershipVerificationStatus(String value) { this.ownershipVerificationStatus = value; }
    public String getStatusNote() { return statusNote; }
    public void setStatusNote(String value) { this.statusNote = value; }
    public List<String> getGoverningBodySourceUrls() { return governingBodySourceUrls; }
    public void setGoverningBodySourceUrls(List<String> value) { this.governingBodySourceUrls = value; }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
