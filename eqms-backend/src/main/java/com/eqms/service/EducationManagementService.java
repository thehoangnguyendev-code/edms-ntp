package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dictionary.EducationDegreeLevelDictionaryRequest;
import com.eqms.dto.dictionary.EducationDegreeLevelDictionaryResponse;
import com.eqms.dto.dictionary.SchoolDictionaryRequest;
import com.eqms.dto.dictionary.SchoolDictionaryResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.EducationDegreeLevel;
import com.eqms.entity.School;
import com.eqms.entity.UserAccount;
import com.eqms.repository.EducationDegreeLevelRepository;
import com.eqms.repository.SchoolRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Application Settings > Education boundary (Degree Levels, Schools). Not part of Dictionaries --
 * Education has its own top-level Settings menu entry and its own permission families
 * ({@code settings.education.degree_level.*} / {@code settings.education.school.*}), so it owns
 * its data access and validation directly rather than delegating into
 * {@link DictionaryManagementService}.
 */
@Service
public class EducationManagementService {

    private static final String EDUCATION_DEGREE_LEVEL_VIEW = "settings.education.degree_level.view";
    private static final String EDUCATION_DEGREE_LEVEL_MANAGE = "settings.education.degree_level.manage";
    private static final String EDUCATION_SCHOOL_VIEW = "settings.education.school.view";
    private static final String EDUCATION_SCHOOL_MANAGE = "settings.education.school.manage";

    private static final String ACTION_EDUCATION_DEGREE_LEVEL_CREATED = "EDUCATION_DEGREE_LEVEL_CREATED";
    private static final String ACTION_EDUCATION_DEGREE_LEVEL_UPDATED = "EDUCATION_DEGREE_LEVEL_UPDATED";
    private static final String ACTION_EDUCATION_DEGREE_LEVEL_DELETED = "EDUCATION_DEGREE_LEVEL_DELETED";
    private static final String ACTION_SCHOOL_CREATED = "SCHOOL_CREATED";
    private static final String ACTION_SCHOOL_UPDATED = "SCHOOL_UPDATED";
    private static final String ACTION_SCHOOL_DELETED = "SCHOOL_DELETED";

    private final EducationDegreeLevelRepository educationDegreeLevelRepository;
    private final SchoolRepository schoolRepository;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public EducationManagementService(
            EducationDegreeLevelRepository educationDegreeLevelRepository,
            SchoolRepository schoolRepository,
            AuditTrailService auditTrailService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.educationDegreeLevelRepository = educationDegreeLevelRepository;
        this.schoolRepository = schoolRepository;
        this.auditTrailService = auditTrailService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    private void requireView(String viewPermission, String managePermission) {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor, viewPermission, managePermission)) {
            throw new AccessDeniedException("View permission required");
        }
    }

    private void requireManage(String managePermission) {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(actor, managePermission)) {
            throw new AccessDeniedException("Management permission required");
        }
    }

    // ── Degree Levels ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<EducationDegreeLevelDictionaryResponse> listDegreeLevels() {
        requireView(EDUCATION_DEGREE_LEVEL_VIEW, EDUCATION_DEGREE_LEVEL_MANAGE);
        return educationDegreeLevelRepository.findAllByOrderByDisplayOrderAscNameAsc().stream()
                .map(this::toDegreeLevelResponse).toList();
    }

    /** Active-only lookup for ordinary user forms; intentionally not gated by dictionary permissions. */
    @Transactional(readOnly = true)
    public List<EducationDegreeLevelDictionaryResponse> listDegreeLevelsForLookup() {
        return educationDegreeLevelRepository.findAllByActiveTrueOrderByDisplayOrderAscNameAsc().stream()
                .map(this::toDegreeLevelResponse).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<EducationDegreeLevelDictionaryResponse> listDegreeLevelsPage(
            String search, String status, String modifiedFrom, String modifiedTo,
            int page, int limit, String sortBy, String sortDirection
    ) {
        requireView(EDUCATION_DEGREE_LEVEL_VIEW, EDUCATION_DEGREE_LEVEL_MANAGE);
        Page<EducationDegreeLevel> result = educationDegreeLevelRepository.findAll(
                buildDegreeLevelSpecification(search, status, modifiedFrom, modifiedTo),
                DictionaryQuerySupport.buildPageable(page, limit, sortBy, sortDirection, "displayOrder", "updatedAt", Map.of(
                        "name", "name",
                        "displayOrder", "displayOrder",
                        "isActive", "active"
                ))
        );
        return DictionaryQuerySupport.toPageResponse(result, this::toDegreeLevelResponse);
    }

    @Transactional
    public EducationDegreeLevelDictionaryResponse createDegreeLevel(EducationDegreeLevelDictionaryRequest request) {
        requireManage(EDUCATION_DEGREE_LEVEL_MANAGE);
        validateUniqueDegreeLevel(null, request.name());
        EducationDegreeLevel level = new EducationDegreeLevel();
        applyDegreeLevel(level, request);
        educationDegreeLevelRepository.save(level);
        auditTrailService.logSafely("SETTINGS", level.getName(), level.getId(), ACTION_EDUCATION_DEGREE_LEVEL_CREATED, null, null,
                DictionaryQuerySupport.buildCreateComment("Education Degree Level", level.getName()));
        return toDegreeLevelResponse(level);
    }

    @Transactional
    public EducationDegreeLevelDictionaryResponse updateDegreeLevel(UUID id, EducationDegreeLevelDictionaryRequest request) {
        requireManage(EDUCATION_DEGREE_LEVEL_MANAGE);
        EducationDegreeLevel level = requireDegreeLevel(id);
        String before = describeDegreeLevel(level);
        validateUniqueDegreeLevel(id, request.name());
        applyDegreeLevel(level, request);
        auditTrailService.logSafely("SETTINGS", level.getName(), level.getId(), ACTION_EDUCATION_DEGREE_LEVEL_UPDATED, null, null,
                DictionaryQuerySupport.buildUpdateComment("Education Degree Level", before, describeDegreeLevel(level)));
        return toDegreeLevelResponse(level);
    }

    @Transactional
    public void deleteDegreeLevel(UUID id) {
        requireManage(EDUCATION_DEGREE_LEVEL_MANAGE);
        EducationDegreeLevel level = requireDegreeLevel(id);
        auditTrailService.logSafely("SETTINGS", level.getName(), level.getId(), ACTION_EDUCATION_DEGREE_LEVEL_DELETED, null, null,
                DictionaryQuerySupport.buildDeleteComment("Education Degree Level", describeDegreeLevel(level)));
        educationDegreeLevelRepository.delete(level);
    }

    // ── Schools ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SchoolDictionaryResponse> listSchools() {
        requireView(EDUCATION_SCHOOL_VIEW, EDUCATION_SCHOOL_MANAGE);
        return schoolRepository.findAllByOrderByNameAsc().stream().map(this::toSchoolResponse).toList();
    }

    /** Active-only lookup for ordinary user forms; intentionally not gated by dictionary permissions. */
    @Transactional(readOnly = true)
    public List<SchoolDictionaryResponse> listSchoolsForLookup() {
        return schoolRepository.findAllByActiveTrueOrderByNameAsc().stream().map(this::toSchoolResponse).toList();
    }

    @Transactional(readOnly = true)
    public SchoolDictionaryResponse getSchool(UUID id) {
        requireView(EDUCATION_SCHOOL_VIEW, EDUCATION_SCHOOL_MANAGE);
        return toSchoolResponse(requireSchool(id));
    }

    @Transactional(readOnly = true)
    public Map<String, List<String>> listSchoolFilterOptions() {
        requireView(EDUCATION_SCHOOL_VIEW, EDUCATION_SCHOOL_MANAGE);
        return Map.of("governingBodies", schoolRepository.findDistinctGoverningBodies(),
                "origins", schoolRepository.findDistinctCountryOfOriginNames());
    }

    @Transactional(readOnly = true)
    public PageResponse<SchoolDictionaryResponse> listSchoolsPage(
            String search, String type, String ownership, String governingBody, String countryOfOriginName,
            Boolean independentInstitution, String status, String modifiedFrom, String modifiedTo,
            int page, int limit, String sortBy, String sortDirection
    ) {
        requireView(EDUCATION_SCHOOL_VIEW, EDUCATION_SCHOOL_MANAGE);
        Page<School> result = schoolRepository.findAll(
                buildSchoolSpecification(search, type, ownership, governingBody, countryOfOriginName,
                        independentInstitution, status, modifiedFrom, modifiedTo),
                DictionaryQuerySupport.buildPageable(page, limit, sortBy, sortDirection, "name", "updatedAt", Map.of(
                        "name", "name",
                        "abbreviation", "abbreviation",
                        "governingBody", "governingBody",
                        "countryOfOriginName", "countryOfOriginName",
                        "isActive", "active"
                ))
        );
        return DictionaryQuerySupport.toPageResponse(result, this::toSchoolResponse);
    }

    @Transactional
    public SchoolDictionaryResponse createSchool(SchoolDictionaryRequest request) {
        requireManage(EDUCATION_SCHOOL_MANAGE);
        validateUniqueSchool(null, request.name());
        School school = new School();
        applySchool(school, request);
        schoolRepository.save(school);
        auditTrailService.logSafely("SETTINGS", school.getName(), school.getId(), ACTION_SCHOOL_CREATED, null, null,
                DictionaryQuerySupport.buildCreateComment("School", school.getName()));
        return toSchoolResponse(school);
    }

    @Transactional
    public SchoolDictionaryResponse updateSchool(UUID id, SchoolDictionaryRequest request) {
        requireManage(EDUCATION_SCHOOL_MANAGE);
        School school = requireSchool(id);
        String before = describeSchool(school);
        validateUniqueSchool(id, request.name());
        applySchool(school, request);
        auditTrailService.logSafely("SETTINGS", school.getName(), school.getId(), ACTION_SCHOOL_UPDATED, null, null,
                DictionaryQuerySupport.buildUpdateComment("School", before, describeSchool(school)));
        return toSchoolResponse(school);
    }

    @Transactional
    public void deleteSchool(UUID id) {
        requireManage(EDUCATION_SCHOOL_MANAGE);
        School school = requireSchool(id);
        auditTrailService.logSafely("SETTINGS", school.getName(), school.getId(), ACTION_SCHOOL_DELETED, null, null,
                DictionaryQuerySupport.buildDeleteComment("School", describeSchool(school)));
        schoolRepository.delete(school);
    }

    // ── Mapping / validation / lookup helpers ───────────────────────────────────

    private void applyDegreeLevel(EducationDegreeLevel level, EducationDegreeLevelDictionaryRequest request) {
        level.setName(request.name().trim());
        level.setDisplayOrder(request.displayOrder() == null ? 0 : request.displayOrder());
        level.setActive(request.isActive() == null || request.isActive());
    }

    private void applySchool(School school, SchoolDictionaryRequest request) {
        school.setName(request.name().trim());
        school.setAbbreviation(DictionaryQuerySupport.trimToNull(request.abbreviation()));
        school.setType(request.type().trim().toUpperCase(Locale.ROOT));
        school.setOwnership(DictionaryQuerySupport.trimToNull(request.ownership()) == null ? null : request.ownership().trim().toUpperCase(Locale.ROOT));
        school.setActive(request.isActive() == null || request.isActive());
        if (request.entityKind() != null) school.setEntityKind(DictionaryQuerySupport.trimToNull(request.entityKind()));
        if (request.isIndependentInstitution() != null) school.setIndependentInstitution(request.isIndependentInstitution());
        if (request.institutionType() != null) school.setInstitutionType(DictionaryQuerySupport.trimToNull(request.institutionType()));
        if (request.institutionTypeLabel() != null) school.setInstitutionTypeLabel(DictionaryQuerySupport.trimToNull(request.institutionTypeLabel()));
        if (request.presenceType() != null) school.setPresenceType(DictionaryQuerySupport.trimToNull(request.presenceType()));
        if (request.operationalStatus() != null) school.setOperationalStatus(DictionaryQuerySupport.trimToNull(request.operationalStatus()));
        if (request.verifiedAsOf() != null) school.setVerifiedAsOf(DictionaryQuerySupport.parseDate(request.verifiedAsOf()));
        if (request.verificationStatus() != null) school.setVerificationStatus(DictionaryQuerySupport.trimToNull(request.verificationStatus()));
        if (request.governingBody() != null) school.setGoverningBody(DictionaryQuerySupport.trimToNull(request.governingBody()));
        if (request.governingBodyType() != null) school.setGoverningBodyType(DictionaryQuerySupport.trimToNull(request.governingBodyType()));
        if (request.governingBodyVerificationStatus() != null) school.setGoverningBodyVerificationStatus(DictionaryQuerySupport.trimToNull(request.governingBodyVerificationStatus()));
        if (request.nationalEducationRegulator() != null) school.setNationalEducationRegulator(DictionaryQuerySupport.trimToNull(request.nationalEducationRegulator()));
        if (request.governanceModel() != null) school.setGovernanceModel(DictionaryQuerySupport.trimToNull(request.governanceModel()));
        if (request.directGoverningMinistry() != null) school.setDirectGoverningMinistry(DictionaryQuerySupport.trimToNull(request.directGoverningMinistry()));
        if (request.countryOfOriginName() != null) school.setCountryOfOriginName(DictionaryQuerySupport.trimToNull(request.countryOfOriginName()));
        if (request.countryOfOriginIso2() != null) school.setCountryOfOriginIso2(DictionaryQuerySupport.trimToNull(request.countryOfOriginIso2()));
        if (request.hostInVietnam() != null) school.setHostInVietnam(DictionaryQuerySupport.trimToNull(request.hostInVietnam()));
        if (request.parentOrPartner() != null) school.setParentOrPartner(DictionaryQuerySupport.trimToNull(request.parentOrPartner()));
        if (request.supervisingAuthority() != null) school.setSupervisingAuthority(DictionaryQuerySupport.trimToNull(request.supervisingAuthority()));
        if (request.ultimateGoverningBody() != null) school.setUltimateGoverningBody(DictionaryQuerySupport.trimToNull(request.ultimateGoverningBody()));
        if (request.ownershipVerificationStatus() != null) school.setOwnershipVerificationStatus(DictionaryQuerySupport.trimToNull(request.ownershipVerificationStatus()));
        if (request.statusNote() != null) school.setStatusNote(DictionaryQuerySupport.trimToNull(request.statusNote()));
        if (request.governingBodySourceUrls() != null) school.setGoverningBodySourceUrls(request.governingBodySourceUrls());
    }

    private EducationDegreeLevelDictionaryResponse toDegreeLevelResponse(EducationDegreeLevel level) {
        return new EducationDegreeLevelDictionaryResponse(
                level.getId(),
                level.getName(),
                level.getDisplayOrder(),
                level.isActive(),
                DictionaryQuerySupport.formatDateTime(level.getCreatedAt()),
                DictionaryQuerySupport.formatDateTime(level.getUpdatedAt())
        );
    }

    private SchoolDictionaryResponse toSchoolResponse(School school) {
        return new SchoolDictionaryResponse(
                school.getId(),
                school.getName(),
                school.getAbbreviation(),
                school.getType(),
                school.getOwnership(),
                school.isActive(),
                DictionaryQuerySupport.formatDateTime(school.getCreatedAt()),
                DictionaryQuerySupport.formatDateTime(school.getUpdatedAt()),
                school.getCatalogId(), school.getSlug(), school.getEntityKind(), school.getIndependentInstitution(),
                school.getInstitutionType(), school.getInstitutionTypeLabel(), school.getPresenceType(),
                school.getOperationalStatus(), school.getVerifiedAsOf() == null ? null : school.getVerifiedAsOf().toString(),
                school.getVerificationStatus(), school.getGoverningBody(), school.getGoverningBodyType(),
                school.getGoverningBodyVerificationStatus(), school.getNationalEducationRegulator(), school.getGovernanceModel(),
                school.getDirectGoverningMinistry(), school.getCountryOfOriginName(), school.getCountryOfOriginIso2(),
                school.getHostInVietnam(), school.getParentOrPartner(), school.getSupervisingAuthority(),
                school.getUltimateGoverningBody(), school.getOwnershipVerificationStatus(), school.getStatusNote(),
                school.getGoverningBodySourceUrls()
        );
    }

    private void validateUniqueDegreeLevel(UUID currentId, String name) {
        String normalizedName = DictionaryQuerySupport.normalizeName(name);
        educationDegreeLevelRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Education degree level name already exists");
            }
        });
    }

    private void validateUniqueSchool(UUID currentId, String name) {
        String normalizedName = DictionaryQuerySupport.normalizeName(name);
        schoolRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("School name already exists");
            }
        });
    }

    private EducationDegreeLevel requireDegreeLevel(UUID id) {
        return educationDegreeLevelRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Education degree level not found"));
    }

    private School requireSchool(UUID id) {
        return schoolRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("School not found"));
    }

    private String describeDegreeLevel(EducationDegreeLevel level) {
        return level == null ? null : level.getName();
    }

    private String describeSchool(School school) {
        return school == null ? null : school.getName() + " (" + DictionaryQuerySupport.safeText(school.getAbbreviation()) + ") / " + DictionaryQuerySupport.safeText(school.getType());
    }

    private Specification<EducationDegreeLevel> buildDegreeLevelSpecification(String search, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            DictionaryQuerySupport.addSearchPredicate(predicates, cb, search, root.get("name"));
            DictionaryQuerySupport.addStatusPredicate(predicates, cb, root.get("active"), status);
            DictionaryQuerySupport.addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<School> buildSchoolSpecification(
            String search, String type, String ownership, String governingBody, String countryOfOriginName,
            Boolean independentInstitution, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            DictionaryQuerySupport.addSearchPredicate(predicates, cb, search, root.get("name"), root.get("abbreviation"),
                    root.get("governingBody"), root.get("countryOfOriginName"));
            if (StringUtils.hasText(type) && !"All".equalsIgnoreCase(type)) {
                predicates.add(cb.equal(root.get("type"), type.trim().toUpperCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(ownership) && !"All".equalsIgnoreCase(ownership)) {
                predicates.add(cb.equal(root.get("ownership"), ownership.trim().toUpperCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(governingBody) && !"All".equalsIgnoreCase(governingBody)) {
                predicates.add(cb.equal(root.get("governingBody"), governingBody.trim()));
            }
            if (StringUtils.hasText(countryOfOriginName) && !"All".equalsIgnoreCase(countryOfOriginName)) {
                predicates.add(cb.equal(root.get("countryOfOriginName"), countryOfOriginName.trim()));
            }
            if (independentInstitution != null) {
                predicates.add(cb.equal(root.get("independentInstitution"), independentInstitution));
            }
            DictionaryQuerySupport.addStatusPredicate(predicates, cb, root.get("active"), status);
            DictionaryQuerySupport.addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
