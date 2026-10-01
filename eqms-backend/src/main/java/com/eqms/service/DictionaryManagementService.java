package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.dto.dictionary.BusinessUnitDictionaryRequest;
import com.eqms.dto.dictionary.BusinessUnitDictionaryResponse;
import com.eqms.dto.dictionary.DepartmentDictionaryRequest;
import com.eqms.dto.dictionary.DepartmentDictionaryResponse;
import com.eqms.dto.dictionary.PositionDictionaryRequest;
import com.eqms.dto.dictionary.PositionDictionaryResponse;
import com.eqms.dto.dictionary.RetentionPolicyDictionaryRequest;
import com.eqms.dto.dictionary.RetentionPolicyDictionaryResponse;
import com.eqms.dto.dictionary.StorageLocationDictionaryRequest;
import com.eqms.dto.dictionary.StorageLocationDictionaryResponse;
import com.eqms.dto.user.LookupItemResponse;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.Position;
import com.eqms.entity.RetentionPolicy;
import com.eqms.entity.StorageLocation;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.ControlledCopyExpiryLimitRepository;
import com.eqms.repository.PositionRepository;
import com.eqms.repository.RetentionPolicyRepository;
import com.eqms.repository.StorageLocationRepository;
import com.eqms.repository.UserLanguageRepository;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import org.springframework.util.StringUtils;
import com.eqms.util.DateTimeFormatUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DictionaryManagementService {

    private static final String ACTION_BUSINESS_UNIT_CREATED = "BUSINESS_UNIT_CREATED";
    private static final String ACTION_BUSINESS_UNIT_UPDATED = "BUSINESS_UNIT_UPDATED";
    private static final String ACTION_BUSINESS_UNIT_DELETED = "BUSINESS_UNIT_DELETED";
    private static final String ACTION_DEPARTMENT_CREATED = "DEPARTMENT_CREATED";
    private static final String ACTION_DEPARTMENT_UPDATED = "DEPARTMENT_UPDATED";
    private static final String ACTION_DEPARTMENT_DELETED = "DEPARTMENT_DELETED";
    private static final String ACTION_POSITION_CREATED = "POSITION_CREATED";
    private static final String ACTION_POSITION_UPDATED = "POSITION_UPDATED";
    private static final String ACTION_POSITION_DELETED = "POSITION_DELETED";
    // Document Type / Sub-Type audit action constants moved to DocumentTypeAdminService.
    private static final String ACTION_STORAGE_LOCATION_CREATED = "STORAGE_LOCATION_CREATED";
    private static final String ACTION_STORAGE_LOCATION_UPDATED = "STORAGE_LOCATION_UPDATED";
    private static final String ACTION_STORAGE_LOCATION_DELETED = "STORAGE_LOCATION_DELETED";
    private static final String ACTION_RETENTION_POLICY_CREATED = "RETENTION_POLICY_CREATED";
    private static final String ACTION_RETENTION_POLICY_UPDATED = "RETENTION_POLICY_UPDATED";
    private static final String ACTION_RETENTION_POLICY_DELETED = "RETENTION_POLICY_DELETED";
    // Education (Degree Levels, Schools) audit action constants moved to EducationManagementService.

    // F-17: dictionary master data (Document Type, Business Unit, Department, Storage Location,
    // Retention Policy...) drives the authorization model itself — Document Type is the key
    // workflow_action_policies.document_type_id is keyed on, and Business Unit/Department feed
    // ObjectAccessEvaluationService's scope matching. This was previously reachable by any
    // authenticated user with no permission check at either the controller or service layer.
    private static final String BUSINESS_UNIT_VIEW = "settings.business_unit.view";
    private static final String BUSINESS_UNIT_MANAGE = "settings.business_unit.manage";
    private static final String DEPARTMENT_VIEW = "settings.department.view";
    private static final String DEPARTMENT_MANAGE = "settings.department.manage";
    private static final String POSITION_VIEW = "settings.position.view";
    private static final String POSITION_MANAGE = "settings.position.manage";
    private static final String STORAGE_LOCATION_VIEW = "settings.storage_location.view";
    private static final String STORAGE_LOCATION_MANAGE = "settings.storage_location.manage";
    private static final String RETENTION_POLICY_VIEW = "settings.retention_policy.view";
    private static final String RETENTION_POLICY_MANAGE = "settings.retention_policy.manage";
    // Education permission constants moved to EducationManagementService.

    private final BusinessUnitRepository businessUnitRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final ControlledCopyExpiryLimitRepository controlledCopyExpiryLimitRepository;
    private final StorageLocationRepository storageLocationRepository;
    private final RetentionPolicyRepository retentionPolicyRepository;
    private final UserLanguageRepository userLanguageRepository;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    // Field-injected -- same pattern used in DocumentService, to avoid churning this class's
    // already-large constructor.
    @org.springframework.beans.factory.annotation.Autowired
    private com.eqms.repository.UserAccountRepository userAccountRepository;
    // EducationDegreeLevelRepository/SchoolRepository moved to EducationManagementService.
    // DocumentTypeRepository/DocumentSubTypeRepository/DocumentNameFormatRepository/
    // DocumentComponentResolver moved to DocumentTypeAdminService.

    public DictionaryManagementService(
            BusinessUnitRepository businessUnitRepository,
            DepartmentRepository departmentRepository,
            PositionRepository positionRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            ControlledCopyExpiryLimitRepository controlledCopyExpiryLimitRepository,
            StorageLocationRepository storageLocationRepository,
            RetentionPolicyRepository retentionPolicyRepository,
            UserLanguageRepository userLanguageRepository,
            AuditTrailService auditTrailService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.businessUnitRepository = businessUnitRepository;
        this.departmentRepository = departmentRepository;
        this.positionRepository = positionRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.controlledCopyExpiryLimitRepository = controlledCopyExpiryLimitRepository;
        this.storageLocationRepository = storageLocationRepository;
        this.retentionPolicyRepository = retentionPolicyRepository;
        this.userLanguageRepository = userLanguageRepository;
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

    // Document Types / Sub-Types admin permission gate moved to DocumentTypeAdminService.

    // Deliberately no permission gate: this unpaginated "give me the full active list" form is
    // read-only reference data consumed to populate ordinary dropdowns across unrelated modules
    // (document creation, user creation, controlled copies policy, ...) -- it is not the
    // Settings admin screen (that's the *Page() variant below, which requires its own
    // function-specific view/manage permission). Requiring a Settings-module permission just to
    // read a Business Unit name for a form field was blocking ordinary users (e.g. DCO) from
    // ever loading these dropdowns.
    @Transactional(readOnly = true)
    public List<BusinessUnitDictionaryResponse> listBusinessUnits() {
        return businessUnitRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toBusinessUnitResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<BusinessUnitDictionaryResponse> listBusinessUnitsPage(
            String search,
            String status,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView(BUSINESS_UNIT_VIEW, BUSINESS_UNIT_MANAGE);
        Page<BusinessUnit> result = businessUnitRepository.findAll(
                buildBusinessUnitSpecification(search, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toBusinessUnitResponse);
    }

    @Transactional
    public BusinessUnitDictionaryResponse createBusinessUnit(BusinessUnitDictionaryRequest request) {
        requireManage(BUSINESS_UNIT_MANAGE);
        validateUniqueBusinessUnit(null, request.name(), request.abbreviation());
        BusinessUnit businessUnit = new BusinessUnit();
        applyBusinessUnit(businessUnit, request);
        businessUnitRepository.save(businessUnit);
        auditTrailService.logSafely("SETTINGS", businessUnit.getName(), businessUnit.getId(), ACTION_BUSINESS_UNIT_CREATED, null, null,
                buildCreateComment("Business Unit", businessUnit.getName(), businessUnit.getCode()));
        return toBusinessUnitResponse(businessUnit);
    }

    @Transactional
    public BusinessUnitDictionaryResponse updateBusinessUnit(UUID id, BusinessUnitDictionaryRequest request) {
        requireManage(BUSINESS_UNIT_MANAGE);
        BusinessUnit businessUnit = requireBusinessUnit(id);
        String before = describeBusinessUnit(businessUnit);
        validateUniqueBusinessUnit(id, request.name(), request.abbreviation());
        applyBusinessUnit(businessUnit, request);
        auditTrailService.logSafely("SETTINGS", businessUnit.getName(), businessUnit.getId(), ACTION_BUSINESS_UNIT_UPDATED, null, null,
                buildUpdateComment("Business Unit", before, describeBusinessUnit(businessUnit)));
        return toBusinessUnitResponse(businessUnit);
    }

    @Transactional
    public void deleteBusinessUnit(UUID id) {
        requireManage(BUSINESS_UNIT_MANAGE);
        BusinessUnit businessUnit = requireBusinessUnit(id);
        if (departmentRepository.countByBusinessUnit_Id(id) > 0
                || positionRepository.countByBusinessUnit_Id(id) > 0
                || documentRecordRepository.existsByBusinessUnit_Id(id)
                || documentRevisionRepository.existsByBusinessUnit_Id(id)) {
            throw dictionaryInUse("Business Unit", businessUnit.getName());
        }
        auditTrailService.logSafely("SETTINGS", businessUnit.getName(), businessUnit.getId(), ACTION_BUSINESS_UNIT_DELETED, null, null,
                buildDeleteComment("Business Unit", describeBusinessUnit(businessUnit)));
        businessUnitRepository.delete(businessUnit);
    }

    // Cached -- same rationale as listBusinessUnits() above. Also evicted (not just its own
    // mutations) whenever a Business Unit changes, since each Department response embeds its
    // parent Business Unit's name.
    @Transactional(readOnly = true)
    public List<DepartmentDictionaryResponse> listDepartments() {
        return departmentRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toDepartmentResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DepartmentDictionaryResponse> listDepartmentsPage(
            String search,
            String businessUnit,
            String status,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView(DEPARTMENT_VIEW, DEPARTMENT_MANAGE);
        Page<Department> result = departmentRepository.findAll(
                buildDepartmentSpecification(search, businessUnit, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toDepartmentResponse);
    }

    @Transactional
    public DepartmentDictionaryResponse createDepartment(DepartmentDictionaryRequest request) {
        requireManage(DEPARTMENT_MANAGE);
        BusinessUnit businessUnit = requireBusinessUnitByName(request.businessUnit());
        validateUniqueDepartment(null, request.name(), request.abbreviation());
        Department department = new Department();
        applyDepartment(department, request, businessUnit);
        departmentRepository.save(department);
        auditTrailService.logSafely("SETTINGS", department.getName(), department.getId(), ACTION_DEPARTMENT_CREATED, null, null,
                buildCreateComment("Department", department.getName(), department.getCode(), department.getBusinessUnit().getName()));
        return toDepartmentResponse(department);
    }

    @Transactional
    public DepartmentDictionaryResponse updateDepartment(UUID id, DepartmentDictionaryRequest request) {
        requireManage(DEPARTMENT_MANAGE);
        Department department = requireDepartment(id);
        String before = describeDepartment(department);
        BusinessUnit businessUnit = requireBusinessUnitByName(request.businessUnit());
        validateUniqueDepartment(id, request.name(), request.abbreviation());
        applyDepartment(department, request, businessUnit);
        auditTrailService.logSafely("SETTINGS", department.getName(), department.getId(), ACTION_DEPARTMENT_UPDATED, null, null,
                buildUpdateComment("Department", before, describeDepartment(department)));
        return toDepartmentResponse(department);
    }

    @Transactional
    public void deleteDepartment(UUID id) {
        requireManage(DEPARTMENT_MANAGE);
        Department department = requireDepartment(id);
        if (positionRepository.countByDepartment_Id(id) > 0
                || documentRecordRepository.existsByDepartment_Id(id)
                || documentRevisionRepository.existsByDepartment_Id(id)
                || controlledCopyExpiryLimitRepository.existsByDepartment_Id(id)) {
            throw dictionaryInUse("Department", department.getName());
        }
        auditTrailService.logSafely("SETTINGS", department.getName(), department.getId(), ACTION_DEPARTMENT_DELETED, null, null,
                buildDeleteComment("Department", describeDepartment(department)));
        departmentRepository.delete(department);
    }

    @Transactional(readOnly = true)
    public List<PositionDictionaryResponse> listPositions() {
        return positionRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toPositionResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<PositionDictionaryResponse> listPositionsPage(
            String search,
            String businessUnit,
            String department,
            String status,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView(POSITION_VIEW, POSITION_MANAGE);
        Page<Position> result = positionRepository.findAll(
                buildPositionSpecification(search, businessUnit, department, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toPositionResponse);
    }

    @Transactional
    public PositionDictionaryResponse createPosition(PositionDictionaryRequest request) {
        requireManage(POSITION_MANAGE);
        BusinessUnit businessUnit = requireBusinessUnitByName(request.businessUnit());
        Department department = requireDepartmentByName(request.department());
        validateDepartmentMatchesBusinessUnit(department, businessUnit);
        validateUniquePosition(null, request.name());
        Position position = new Position();
        applyPosition(position, request, businessUnit, department);
        positionRepository.save(position);
        auditTrailService.logSafely("SETTINGS", position.getName(), position.getId(), ACTION_POSITION_CREATED, null, null,
                buildCreateComment("Position", position.getName(), position.getCode(), position.getBusinessUnit().getName(), position.getDepartment().getName()));
        return toPositionResponse(position);
    }

    @Transactional
    public PositionDictionaryResponse updatePosition(UUID id, PositionDictionaryRequest request) {
        requireManage(POSITION_MANAGE);
        Position position = requirePosition(id);
        String before = describePosition(position);
        BusinessUnit businessUnit = requireBusinessUnitByName(request.businessUnit());
        Department department = requireDepartmentByName(request.department());
        validateDepartmentMatchesBusinessUnit(department, businessUnit);
        validateUniquePosition(id, request.name());
        applyPosition(position, request, businessUnit, department);
        auditTrailService.logSafely("SETTINGS", position.getName(), position.getId(), ACTION_POSITION_UPDATED, null, null,
                buildUpdateComment("Position", before, describePosition(position)));
        return toPositionResponse(position);
    }

    @Transactional
    public void deletePosition(UUID id) {
        requireManage(POSITION_MANAGE);
        Position position = requirePosition(id);
        auditTrailService.logSafely("SETTINGS", position.getName(), position.getId(), ACTION_POSITION_DELETED, null, null,
                buildDeleteComment("Position", describePosition(position)));
        positionRepository.delete(position);
    }

    // Document Types / Sub-Types moved to DocumentTypeAdminService -- see that class (part of the
    // Document Control module's "Document Administration" area, not Settings > Dictionaries).

    @Transactional(readOnly = true)
    public List<StorageLocationDictionaryResponse> listStorageLocations() {
        requireView(STORAGE_LOCATION_VIEW, STORAGE_LOCATION_MANAGE);
        return storageLocationRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toStorageLocationResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<StorageLocationDictionaryResponse> listStorageLocationsPage(
            String search,
            String status,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView(STORAGE_LOCATION_VIEW, STORAGE_LOCATION_MANAGE);
        Page<StorageLocation> result = storageLocationRepository.findAll(
                buildStorageLocationSpecification(search, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toStorageLocationResponse);
    }

    @Transactional
    public StorageLocationDictionaryResponse createStorageLocation(StorageLocationDictionaryRequest request) {
        requireManage(STORAGE_LOCATION_MANAGE);
        validateUniqueStorageLocation(null, request.name());
        StorageLocation storageLocation = new StorageLocation();
        applyStorageLocation(storageLocation, request);
        storageLocationRepository.save(storageLocation);
        auditTrailService.logSafely("SETTINGS", storageLocation.getName(), storageLocation.getId(), ACTION_STORAGE_LOCATION_CREATED, null, null,
                buildCreateComment("Storage Location", storageLocation.getName()));
        return toStorageLocationResponse(storageLocation);
    }

    @Transactional
    public StorageLocationDictionaryResponse updateStorageLocation(UUID id, StorageLocationDictionaryRequest request) {
        requireManage(STORAGE_LOCATION_MANAGE);
        StorageLocation storageLocation = requireStorageLocation(id);
        String before = describeStorageLocation(storageLocation);
        validateUniqueStorageLocation(id, request.name());
        applyStorageLocation(storageLocation, request);
        auditTrailService.logSafely("SETTINGS", storageLocation.getName(), storageLocation.getId(), ACTION_STORAGE_LOCATION_UPDATED, null, null,
                buildUpdateComment("Storage Location", before, describeStorageLocation(storageLocation)));
        return toStorageLocationResponse(storageLocation);
    }

    @Transactional
    public void deleteStorageLocation(UUID id) {
        requireManage(STORAGE_LOCATION_MANAGE);
        StorageLocation storageLocation = requireStorageLocation(id);
        auditTrailService.logSafely("SETTINGS", storageLocation.getName(), storageLocation.getId(), ACTION_STORAGE_LOCATION_DELETED, null, null,
                buildDeleteComment("Storage Location", describeStorageLocation(storageLocation)));
        storageLocationRepository.delete(storageLocation);
    }

    // Education (Degree Levels, Schools) moved to EducationManagementService -- see that class.

    @Transactional(readOnly = true)
    public List<RetentionPolicyDictionaryResponse> listRetentionPolicies() {
        return retentionPolicyRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toRetentionPolicyResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LookupItemResponse> listLanguages() {
        return userLanguageRepository.findAllByActiveTrueOrderBySortOrderAscNameAsc()
                .stream()
                .map(language -> new LookupItemResponse(
                        language.getId() == null ? null : language.getId().toString(),
                        language.getName(),
                        language.getCode(),
                        language.getName(),
                        language.getName()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<RetentionPolicyDictionaryResponse> listRetentionPoliciesPage(
            String search,
            String status,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView(RETENTION_POLICY_VIEW, RETENTION_POLICY_MANAGE);
        Page<RetentionPolicy> result = retentionPolicyRepository.findAll(
                buildRetentionPolicySpecification(search, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toRetentionPolicyResponse);
    }

    @Transactional
    public RetentionPolicyDictionaryResponse createRetentionPolicy(RetentionPolicyDictionaryRequest request) {
        requireManage(RETENTION_POLICY_MANAGE);
        validateUniqueRetentionPolicy(null, request.name());
        RetentionPolicy retentionPolicy = new RetentionPolicy();
        applyRetentionPolicy(retentionPolicy, request);
        retentionPolicyRepository.save(retentionPolicy);
        auditTrailService.logSafely("SETTINGS", retentionPolicy.getName(), retentionPolicy.getId(), ACTION_RETENTION_POLICY_CREATED, null, null,
                buildCreateComment("Retention Policy", retentionPolicy.getName()));
        return toRetentionPolicyResponse(retentionPolicy);
    }

    @Transactional
    public RetentionPolicyDictionaryResponse updateRetentionPolicy(UUID id, RetentionPolicyDictionaryRequest request) {
        requireManage(RETENTION_POLICY_MANAGE);
        RetentionPolicy retentionPolicy = requireRetentionPolicy(id);
        String before = describeRetentionPolicy(retentionPolicy);
        validateUniqueRetentionPolicy(id, request.name());
        applyRetentionPolicy(retentionPolicy, request);
        auditTrailService.logSafely("SETTINGS", retentionPolicy.getName(), retentionPolicy.getId(), ACTION_RETENTION_POLICY_UPDATED, null, null,
                buildUpdateComment("Retention Policy", before, describeRetentionPolicy(retentionPolicy)));
        return toRetentionPolicyResponse(retentionPolicy);
    }

    @Transactional
    public void deleteRetentionPolicy(UUID id) {
        requireManage(RETENTION_POLICY_MANAGE);
        RetentionPolicy retentionPolicy = requireRetentionPolicy(id);
        auditTrailService.logSafely("SETTINGS", retentionPolicy.getName(), retentionPolicy.getId(), ACTION_RETENTION_POLICY_DELETED, null, null,
                buildDeleteComment("Retention Policy", describeRetentionPolicy(retentionPolicy)));
        retentionPolicyRepository.delete(retentionPolicy);
    }

    private String buildCreateComment(String entityLabel, String... parts) {
        return entityLabel + " created" + formatParts(parts);
    }

    private String buildUpdateComment(String entityLabel, String before, String after) {
        return entityLabel + " updated" + formatBeforeAfter(before, after);
    }

    private String buildDeleteComment(String entityLabel, String details) {
        return entityLabel + " deleted" + (StringUtils.hasText(details) ? ": " + details : "");
    }

    private String formatBeforeAfter(String before, String after) {
        StringBuilder builder = new StringBuilder();
        if (StringUtils.hasText(before)) {
            builder.append(" | before: ").append(before);
        }
        if (StringUtils.hasText(after)) {
            builder.append(" | after: ").append(after);
        }
        return builder.toString();
    }

    private String formatParts(String... parts) {
        if (parts == null || parts.length == 0) {
            return "";
        }
        StringBuilder builder = new StringBuilder(": ");
        boolean first = true;
        for (String part : parts) {
            if (!StringUtils.hasText(part)) {
                continue;
            }
            if (!first) {
                builder.append(", ");
            }
            builder.append(part.trim());
            first = false;
        }
        return first ? "" : builder.toString();
    }

    private String describeBusinessUnit(BusinessUnit businessUnit) {
        return businessUnit == null ? null : businessUnit.getName() + " (" + safeText(businessUnit.getCode()) + ")";
    }

    private String describeDepartment(Department department) {
        if (department == null) {
            return null;
        }
        return department.getName() + " (" + safeText(department.getCode()) + ") / " + safeText(department.getBusinessUnit() == null ? null : department.getBusinessUnit().getName());
    }

    private String describePosition(Position position) {
        if (position == null) {
            return null;
        }
        return position.getName() + " (" + safeText(position.getCode()) + ") / "
                + safeText(position.getBusinessUnit() == null ? null : position.getBusinessUnit().getName())
                + " / " + safeText(position.getDepartment() == null ? null : position.getDepartment().getName());
    }

    private String describeStorageLocation(StorageLocation storageLocation) {
        return storageLocation == null ? null : storageLocation.getName();
    }

    private String describeRetentionPolicy(RetentionPolicy retentionPolicy) {
        return retentionPolicy == null ? null : retentionPolicy.getName();
    }

    private String safeText(String value) {
        return StringUtils.hasText(value) ? value.trim() : "-";
    }

    private void applyBusinessUnit(BusinessUnit businessUnit, BusinessUnitDictionaryRequest request) {
        businessUnit.setName(request.name().trim());
        businessUnit.setCode(normalizeCode(request.abbreviation()));
        businessUnit.setDescription(trimToNull(request.description()));
        businessUnit.setActive(request.isActive() == null || request.isActive());
    }

    private void applyDepartment(Department department, DepartmentDictionaryRequest request, BusinessUnit businessUnit) {
        department.setName(request.name().trim());
        department.setCode(normalizeCode(request.abbreviation()));
        department.setBusinessUnit(businessUnit);
        department.setDescription(trimToNull(request.description()));
        department.setActive(request.isActive() == null || request.isActive());
        department.setDepartmentHead(request.departmentHeadId() == null ? null
                : userAccountRepository.findById(request.departmentHeadId())
                        .orElseThrow(() -> new EntityNotFoundException("Selected Department Head user not found")));
        department.setPrimaryContactPhone(trimToNull(request.primaryContactPhone()));
    }

    private void applyPosition(Position position, PositionDictionaryRequest request, BusinessUnit businessUnit, Department department) {
        String previousName = position.getName();
        String trimmedName = request.name().trim();
        position.setName(trimmedName);
        // Abbreviation is not a user-facing concept for Position (only Business Unit/Department
        // still expose it) -- the `code` column is still NOT NULL + UNIQUE at the DB level (it
        // feeds audit-trail descriptions), so it's auto-derived from the name instead of asked
        // for. Only regenerate on an actual name change so an edit that leaves the name alone
        // never causes the code to silently drift.
        if (position.getCode() == null || !trimmedName.equalsIgnoreCase(previousName)) {
            position.setCode(generateUniquePositionCode(trimmedName, position.getId()));
        }
        position.setBusinessUnit(businessUnit);
        position.setDepartment(department);
        position.setDescription(trimToNull(request.description()));
        position.setActive(request.isActive() == null || request.isActive());
    }

    private String generateUniquePositionCode(String name, UUID excludeId) {
        String initials = java.util.Arrays.stream(name.replaceAll("[^A-Za-z0-9 ]", " ").trim().split("\\s+"))
                .filter(StringUtils::hasText)
                .map(word -> word.substring(0, 1).toUpperCase())
                .reduce("", String::concat);
        String candidateBase = initials.isEmpty() ? "POS" : initials.length() > 10 ? initials.substring(0, 10) : initials;
        String candidate = candidateBase;
        int suffix = 1;
        while (true) {
            String finalCandidate = candidate;
            boolean taken = positionRepository.findByCodeIgnoreCase(finalCandidate)
                    .filter(found -> excludeId == null || !found.getId().equals(excludeId))
                    .isPresent();
            if (!taken) {
                return candidate;
            }
            suffix++;
            candidate = candidateBase + suffix;
        }
    }

    private void applyStorageLocation(StorageLocation storageLocation, StorageLocationDictionaryRequest request) {
        storageLocation.setName(request.name().trim());
        storageLocation.setDescription(trimToNull(request.description()));
        storageLocation.setActive(request.isActive() == null || request.isActive());
    }

    private void applyRetentionPolicy(RetentionPolicy retentionPolicy, RetentionPolicyDictionaryRequest request) {
        retentionPolicy.setName(request.name().trim());
        retentionPolicy.setDescription(trimToNull(request.description()));
        retentionPolicy.setRetentionDays(request.retentionDays());
        retentionPolicy.setActive(request.isActive() == null || request.isActive());
    }

    private BusinessUnitDictionaryResponse toBusinessUnitResponse(BusinessUnit businessUnit) {
        return new BusinessUnitDictionaryResponse(
                businessUnit.getId(),
                businessUnit.getName(),
                businessUnit.getCode(),
                businessUnit.getDescription(),
                businessUnit.isActive(),
                formatDateTime(businessUnit.getCreatedAt()),
                formatDateTime(businessUnit.getUpdatedAt()),
                departmentRepository.countByBusinessUnit_Id(businessUnit.getId())
        );
    }

    private DepartmentDictionaryResponse toDepartmentResponse(Department department) {
        return new DepartmentDictionaryResponse(
                department.getId(),
                department.getName(),
                department.getCode(),
                department.getBusinessUnit() == null ? null : department.getBusinessUnit().getName(),
                department.getDescription(),
                department.isActive(),
                formatDateTime(department.getCreatedAt()),
                formatDateTime(department.getUpdatedAt()),
                positionRepository.countByDepartment_Id(department.getId()),
                department.getDepartmentHead() == null ? null : department.getDepartmentHead().getId(),
                department.getDepartmentHead() == null ? null : department.getDepartmentHead().getFullName(),
                department.getPrimaryContactPhone()
        );
    }

    private PositionDictionaryResponse toPositionResponse(Position position) {
        return new PositionDictionaryResponse(
                position.getId(),
                position.getName(),
                position.getBusinessUnit() == null ? null : position.getBusinessUnit().getName(),
                position.getDepartment() == null ? null : position.getDepartment().getName(),
                position.getDescription(),
                position.isActive(),
                formatDateTime(position.getCreatedAt()),
                formatDateTime(position.getUpdatedAt())
        );
    }

    private ResponseStatusException dictionaryInUse(String dictionaryLabel, String dictionaryName) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                "%s '%s' is in use and cannot be deleted. Deactivate it instead to preserve regulated history."
                        .formatted(dictionaryLabel, dictionaryName)
        );
    }

    private StorageLocationDictionaryResponse toStorageLocationResponse(StorageLocation storageLocation) {
        return new StorageLocationDictionaryResponse(
                storageLocation.getId(),
                storageLocation.getName(),
                storageLocation.getDescription(),
                storageLocation.isActive(),
                formatDateTime(storageLocation.getCreatedAt()),
                formatDateTime(storageLocation.getUpdatedAt())
        );
    }

    private RetentionPolicyDictionaryResponse toRetentionPolicyResponse(RetentionPolicy retentionPolicy) {
        return new RetentionPolicyDictionaryResponse(
                retentionPolicy.getId(),
                retentionPolicy.getName(),
                retentionPolicy.getDescription(),
                retentionPolicy.getRetentionDays(),
                retentionPolicy.isActive(),
                formatDateTime(retentionPolicy.getCreatedAt()),
                formatDateTime(retentionPolicy.getUpdatedAt())
        );
    }

    private void validateUniqueBusinessUnit(UUID currentId, String name, String abbreviation) {
        String normalizedName = normalizeName(name);
        String normalizedCode = normalizeCode(abbreviation);
        businessUnitRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Business unit name already exists");
            }
        });
        businessUnitRepository.findByCodeIgnoreCase(normalizedCode).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Business unit abbreviation already exists");
            }
        });
    }

    private void validateUniqueDepartment(UUID currentId, String name, String abbreviation) {
        String normalizedName = normalizeName(name);
        String normalizedCode = normalizeCode(abbreviation);
        departmentRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Department name already exists");
            }
        });
        departmentRepository.findByCodeIgnoreCase(normalizedCode).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Department abbreviation already exists");
            }
        });
    }

    private void validateUniquePosition(UUID currentId, String name) {
        String normalizedName = normalizeName(name);
        positionRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Position name already exists");
            }
        });
        // No separate code-uniqueness check here: the code is auto-derived from the name
        // (generateUniquePositionCode), which already guarantees uniqueness itself.
    }

    private void validateUniqueStorageLocation(UUID currentId, String name) {
        String normalizedName = normalizeName(name);
        storageLocationRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Storage location name already exists");
            }
        });
    }

    private void validateUniqueRetentionPolicy(UUID currentId, String name) {
        String normalizedName = normalizeName(name);
        retentionPolicyRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Retention policy name already exists");
            }
        });
    }

    private void validateDepartmentMatchesBusinessUnit(Department department, BusinessUnit businessUnit) {
        if (department.getBusinessUnit() != null && !department.getBusinessUnit().getId().equals(businessUnit.getId())) {
            throw new IllegalArgumentException("Department does not belong to selected business unit");
        }
    }

    private BusinessUnit requireBusinessUnit(UUID id) {
        return businessUnitRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Business unit not found"));
    }

    private Department requireDepartment(UUID id) {
        return departmentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Department not found"));
    }

    private Position requirePosition(UUID id) {
        return positionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Position not found"));
    }

    private StorageLocation requireStorageLocation(UUID id) {
        return storageLocationRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Storage location not found"));
    }

    private RetentionPolicy requireRetentionPolicy(UUID id) {
        return retentionPolicyRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Retention policy not found"));
    }

    private BusinessUnit requireBusinessUnitByName(String name) {
        String normalizedName = normalizeName(name);
        return businessUnitRepository.findByNameIgnoreCase(normalizedName)
                .orElseThrow(() -> new EntityNotFoundException("Business unit not found"));
    }

    private Department requireDepartmentByName(String name) {
        String normalizedName = normalizeName(name);
        return departmentRepository.findByNameIgnoreCase(normalizedName)
                .orElseThrow(() -> new EntityNotFoundException("Department not found"));
    }

    private String normalizeName(String value) {
        return value == null ? null : value.trim();
    }

    private String normalizeCode(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String formatDateTime(Instant instant) {
        return DateTimeFormatUtils.formatDateTime(instant);
    }

    private <T, R> PageResponse<R> toPageResponse(Page<T> page, Function<T, R> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                new PaginationResponse(
                        page.getNumber() + 1,
                        page.getSize(),
                        page.getTotalElements(),
                        page.getTotalPages()
                )
        );
    }

    private Pageable buildPageable(int page, int limit, String sortBy, String sortDirection, String defaultSortKey, String modifiedDateSortKey) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        String resolvedSortBy = resolveSortField(sortBy, defaultSortKey, modifiedDateSortKey);
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        return PageRequest.of(safePage - 1, safeLimit, Sort.by(direction, resolvedSortBy));
    }

    private String resolveSortField(String sortBy, String defaultSortKey, String modifiedDateSortKey) {
        if (sortBy == null || sortBy.isBlank()) {
            return defaultSortKey;
        }
        String normalized = sortBy.trim();
        if ("modifiedDate".equalsIgnoreCase(normalized)) {
            return modifiedDateSortKey;
        }
        if ("businessUnit".equalsIgnoreCase(normalized)) {
            return "businessUnit.name";
        }
        if ("department".equalsIgnoreCase(normalized)) {
            return "department.name";
        }
        if ("documentType".equalsIgnoreCase(normalized)) {
            return "documentType.name";
        }
        // departmentHeadName is deliberately NOT sortable here: departmentHead is nullable and a
        // nested-property Sort on a to-one association makes Spring Data JPA emit an inner join,
        // which would silently drop every department with no Department Head from the sorted
        // page. Only primaryContactPhone (a plain column) is sortable below.
        return switch (normalized) {
            case "name", "abbreviation", "shortCode", "currentSequence", "description", "isActive", "primaryContactPhone", "displayOrder" -> normalized;
            default -> defaultSortKey;
        };
    }

    // buildPageable(..., Map<String,String> allowedSortFields) overload was Education-only;
    // moved to DictionaryQuerySupport.buildPageable alongside EducationManagementService.

    private Specification<BusinessUnit> buildBusinessUnitSpecification(String search, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new java.util.ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("code"), root.get("description"));
            addStatusPredicate(predicates, cb, root.get("active"), status);
            addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<Department> buildDepartmentSpecification(String search, String businessUnit, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            query.distinct(true);
            Join<Department, BusinessUnit> unitJoin = root.join("businessUnit", JoinType.LEFT);
            List<Predicate> predicates = new java.util.ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("code"), root.get("description"), unitJoin.get("name"));
            addExactTextPredicate(predicates, cb, unitJoin.get("name"), businessUnit);
            addStatusPredicate(predicates, cb, root.get("active"), status);
            addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<Position> buildPositionSpecification(String search, String businessUnit, String department, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            query.distinct(true);
            Join<Position, BusinessUnit> unitJoin = root.join("businessUnit", JoinType.LEFT);
            Join<Position, Department> departmentJoin = root.join("department", JoinType.LEFT);
            List<Predicate> predicates = new java.util.ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("code"), root.get("description"), unitJoin.get("name"), departmentJoin.get("name"));
            addExactTextPredicate(predicates, cb, unitJoin.get("name"), businessUnit);
            addExactTextPredicate(predicates, cb, departmentJoin.get("name"), department);
            addStatusPredicate(predicates, cb, root.get("active"), status);
            addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    // Document Type / Sub-Type specification builders moved to DocumentTypeAdminService.

    private Specification<StorageLocation> buildStorageLocationSpecification(String search, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new java.util.ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("description"));
            addStatusPredicate(predicates, cb, root.get("active"), status);
            addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<RetentionPolicy> buildRetentionPolicySpecification(String search, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new java.util.ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("description"));
            addStatusPredicate(predicates, cb, root.get("active"), status);
            addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private void addSearchPredicate(List<Predicate> predicates, jakarta.persistence.criteria.CriteriaBuilder cb, String search, jakarta.persistence.criteria.Path<String>... fields) {
        String normalizedSearch = normalizeSearch(search);
        if (normalizedSearch == null || fields == null || fields.length == 0) {
            return;
        }
        List<Predicate> orPredicates = new java.util.ArrayList<>();
        for (jakarta.persistence.criteria.Path<String> field : fields) {
            orPredicates.add(cb.like(cb.lower(field), "%" + normalizedSearch + "%"));
        }
        predicates.add(cb.or(orPredicates.toArray(new Predicate[0])));
    }

    private void addExactTextPredicate(List<Predicate> predicates, jakarta.persistence.criteria.CriteriaBuilder cb, jakarta.persistence.criteria.Path<String> field, String value) {
        String normalizedValue = normalizeSearch(value);
        if (normalizedValue == null) {
            return;
        }
        predicates.add(cb.equal(cb.lower(field), normalizedValue));
    }

    private void addStatusPredicate(List<Predicate> predicates, jakarta.persistence.criteria.CriteriaBuilder cb, jakarta.persistence.criteria.Path<Boolean> activeField, String status) {
        if (status == null || status.isBlank() || "All".equalsIgnoreCase(status)) {
            return;
        }
        boolean active = "Active".equalsIgnoreCase(status);
        predicates.add(cb.equal(activeField, active));
    }

    private void addUpdatedAtRangePredicate(List<Predicate> predicates, jakarta.persistence.criteria.CriteriaBuilder cb, jakarta.persistence.criteria.Path<Instant> field, String modifiedFrom, String modifiedTo) {
        Instant start = parseDateStart(modifiedFrom);
        Instant end = parseDateEnd(modifiedTo);
        if (start != null) {
            predicates.add(cb.greaterThanOrEqualTo(field, start));
        }
        if (end != null) {
            predicates.add(cb.lessThanOrEqualTo(field, end));
        }
    }

    private Instant parseDateStart(String value) {
        LocalDate date = parseDate(value);
        return date == null ? null : date.atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    private Instant parseDateEnd(String value) {
        LocalDate date = parseDate(value);
        return date == null ? null : date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().minusNanos(1);
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            String normalized = value.trim();
            return normalized.matches("\\d{4}-\\d{2}-\\d{2}")
                    ? LocalDate.parse(normalized, DateTimeFormatter.ISO_LOCAL_DATE)
                    : LocalDate.parse(normalized, DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ENGLISH));
        } catch (Exception ex) {
            return null;
        }
    }

    private String normalizeSearch(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }

    // Document Sub-Type mapping/validation/predicate helpers moved to DocumentTypeAdminService.
}
