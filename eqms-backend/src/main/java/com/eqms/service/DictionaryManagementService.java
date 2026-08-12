package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.dto.dictionary.BusinessUnitDictionaryRequest;
import com.eqms.dto.dictionary.BusinessUnitDictionaryResponse;
import com.eqms.dto.dictionary.DepartmentDictionaryRequest;
import com.eqms.dto.dictionary.DepartmentDictionaryResponse;
import com.eqms.dto.dictionary.DocumentTypeDictionaryRequest;
import com.eqms.dto.dictionary.DocumentTypeDictionaryResponse;
import com.eqms.dto.dictionary.DocumentSubTypeDictionaryRequest;
import com.eqms.dto.dictionary.DocumentSubTypeDictionaryResponse;
import com.eqms.dto.dictionary.PositionDictionaryRequest;
import com.eqms.dto.dictionary.PositionDictionaryResponse;
import com.eqms.dto.dictionary.RetentionPolicyDictionaryRequest;
import com.eqms.dto.dictionary.RetentionPolicyDictionaryResponse;
import com.eqms.dto.dictionary.StorageLocationDictionaryRequest;
import com.eqms.dto.dictionary.StorageLocationDictionaryResponse;
import com.eqms.dto.user.LookupItemResponse;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentType;
import com.eqms.entity.DocumentSubType;
import com.eqms.entity.ReviewRequirement;
import com.eqms.entity.Position;
import com.eqms.entity.RetentionPolicy;
import com.eqms.entity.StorageLocation;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.DocumentSubTypeRepository;
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
import java.util.Map;
import java.util.HashMap;
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
    private static final String ACTION_DOCUMENT_TYPE_CREATED = "DOCUMENT_TYPE_CREATED";
    private static final String ACTION_DOCUMENT_TYPE_UPDATED = "DOCUMENT_TYPE_UPDATED";
    private static final String ACTION_DOCUMENT_TYPE_DELETED = "DOCUMENT_TYPE_DELETED";
    private static final String ACTION_DOCUMENT_SUB_TYPE_CREATED = "DOCUMENT_SUB_TYPE_CREATED";
    private static final String ACTION_DOCUMENT_SUB_TYPE_UPDATED = "DOCUMENT_SUB_TYPE_UPDATED";
    private static final String ACTION_DOCUMENT_SUB_TYPE_DELETED = "DOCUMENT_SUB_TYPE_DELETED";
    private static final String ACTION_STORAGE_LOCATION_CREATED = "STORAGE_LOCATION_CREATED";
    private static final String ACTION_STORAGE_LOCATION_UPDATED = "STORAGE_LOCATION_UPDATED";
    private static final String ACTION_STORAGE_LOCATION_DELETED = "STORAGE_LOCATION_DELETED";
    private static final String ACTION_RETENTION_POLICY_CREATED = "RETENTION_POLICY_CREATED";
    private static final String ACTION_RETENTION_POLICY_UPDATED = "RETENTION_POLICY_UPDATED";
    private static final String ACTION_RETENTION_POLICY_DELETED = "RETENTION_POLICY_DELETED";

    // F-17: dictionary master data (Document Type, Business Unit, Department, Storage Location,
    // Retention Policy...) drives the authorization model itself — Document Type is the key
    // workflow_action_policies.document_type_id is keyed on, and Business Unit/Department feed
    // ObjectAccessEvaluationService's scope matching. This was previously reachable by any
    // authenticated user with no permission check at either the controller or service layer.
    private static final String VIEW_PERMISSION = "settings.dictionary.view";
    private static final String MANAGE_PERMISSION = "settings.dictionary.manage";

    private final BusinessUnitRepository businessUnitRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final ControlledCopyExpiryLimitRepository controlledCopyExpiryLimitRepository;
    private final DocumentSubTypeRepository documentSubTypeRepository;
    private final StorageLocationRepository storageLocationRepository;
    private final RetentionPolicyRepository retentionPolicyRepository;
    private final UserLanguageRepository userLanguageRepository;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public DictionaryManagementService(
            BusinessUnitRepository businessUnitRepository,
            DepartmentRepository departmentRepository,
            PositionRepository positionRepository,
            DocumentTypeRepository documentTypeRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            ControlledCopyExpiryLimitRepository controlledCopyExpiryLimitRepository,
            DocumentSubTypeRepository documentSubTypeRepository,
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
        this.documentTypeRepository = documentTypeRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.controlledCopyExpiryLimitRepository = controlledCopyExpiryLimitRepository;
        this.documentSubTypeRepository = documentSubTypeRepository;
        this.storageLocationRepository = storageLocationRepository;
        this.retentionPolicyRepository = retentionPolicyRepository;
        this.userLanguageRepository = userLanguageRepository;
        this.auditTrailService = auditTrailService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    private void requireView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Dictionary view permission required");
        }
    }

    private void requireManage() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(actor, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Dictionary management permission required");
        }
    }

    @Transactional(readOnly = true)
    public List<BusinessUnitDictionaryResponse> listBusinessUnits() {
        requireView();
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
        requireView();
        Page<BusinessUnit> result = businessUnitRepository.findAll(
                buildBusinessUnitSpecification(search, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toBusinessUnitResponse);
    }

    @Transactional
    public BusinessUnitDictionaryResponse createBusinessUnit(BusinessUnitDictionaryRequest request) {
        requireManage();
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
        requireManage();
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
        requireManage();
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

    @Transactional(readOnly = true)
    public List<DepartmentDictionaryResponse> listDepartments() {
        requireView();
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
        requireView();
        Page<Department> result = departmentRepository.findAll(
                buildDepartmentSpecification(search, businessUnit, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toDepartmentResponse);
    }

    @Transactional
    public DepartmentDictionaryResponse createDepartment(DepartmentDictionaryRequest request) {
        requireManage();
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
        requireManage();
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
        requireManage();
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
        requireView();
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
        requireView();
        Page<Position> result = positionRepository.findAll(
                buildPositionSpecification(search, businessUnit, department, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toPositionResponse);
    }

    @Transactional
    public PositionDictionaryResponse createPosition(PositionDictionaryRequest request) {
        requireManage();
        BusinessUnit businessUnit = requireBusinessUnitByName(request.businessUnit());
        Department department = requireDepartmentByName(request.department());
        validateDepartmentMatchesBusinessUnit(department, businessUnit);
        validateUniquePosition(null, request.name(), request.abbreviation());
        Position position = new Position();
        applyPosition(position, request, businessUnit, department);
        positionRepository.save(position);
        auditTrailService.logSafely("SETTINGS", position.getName(), position.getId(), ACTION_POSITION_CREATED, null, null,
                buildCreateComment("Position", position.getName(), position.getCode(), position.getBusinessUnit().getName(), position.getDepartment().getName()));
        return toPositionResponse(position);
    }

    @Transactional
    public PositionDictionaryResponse updatePosition(UUID id, PositionDictionaryRequest request) {
        requireManage();
        Position position = requirePosition(id);
        String before = describePosition(position);
        BusinessUnit businessUnit = requireBusinessUnitByName(request.businessUnit());
        Department department = requireDepartmentByName(request.department());
        validateDepartmentMatchesBusinessUnit(department, businessUnit);
        validateUniquePosition(id, request.name(), request.abbreviation());
        applyPosition(position, request, businessUnit, department);
        auditTrailService.logSafely("SETTINGS", position.getName(), position.getId(), ACTION_POSITION_UPDATED, null, null,
                buildUpdateComment("Position", before, describePosition(position)));
        return toPositionResponse(position);
    }

    @Transactional
    public void deletePosition(UUID id) {
        requireManage();
        Position position = requirePosition(id);
        auditTrailService.logSafely("SETTINGS", position.getName(), position.getId(), ACTION_POSITION_DELETED, null, null,
                buildDeleteComment("Position", describePosition(position)));
        positionRepository.delete(position);
    }

    @Transactional(readOnly = true)
    public List<DocumentTypeDictionaryResponse> listDocumentTypes() {
        requireView();
        Map<String, Integer> issuedSequences = loadIssuedDocumentSequences();
        return documentTypeRepository.findAllByOrderByNameAsc()
                .stream()
                .map(documentType -> toDocumentTypeResponse(documentType, issuedSequences))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentTypeDictionaryResponse> listDocumentTypesPage(
            String search,
            String status,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView();
        Page<DocumentType> result = documentTypeRepository.findAll(
                buildDocumentTypeSpecification(search, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        Map<String, Integer> issuedSequences = loadIssuedDocumentSequences();
        return toPageResponse(result, documentType -> toDocumentTypeResponse(documentType, issuedSequences));
    }

    @Transactional
    public DocumentTypeDictionaryResponse createDocumentType(DocumentTypeDictionaryRequest request) {
        requireManage();
        validateUniqueDocumentType(null, request.name(), request.shortCode());
        DocumentType documentType = new DocumentType();
        applyDocumentType(documentType, request, true);
        documentTypeRepository.save(documentType);
        auditTrailService.logSafely("SETTINGS", documentType.getName(), documentType.getId(), ACTION_DOCUMENT_TYPE_CREATED, null, null,
                buildCreateComment("Document Type", documentType.getName(), documentType.getShortCode()));
        return toDocumentTypeResponse(documentType);
    }

    @Transactional
    public DocumentTypeDictionaryResponse updateDocumentType(UUID id, DocumentTypeDictionaryRequest request) {
        requireManage();
        DocumentType documentType = requireDocumentType(id);
        String before = describeDocumentType(documentType);
        validateUniqueDocumentType(id, request.name(), request.shortCode());
        applyDocumentType(documentType, request, false);
        auditTrailService.logSafely("SETTINGS", documentType.getName(), documentType.getId(), ACTION_DOCUMENT_TYPE_UPDATED, null, null,
                buildUpdateComment("Document Type", before, describeDocumentType(documentType)));
        return toDocumentTypeResponse(documentType);
    }

    @Transactional
    public void deleteDocumentType(UUID id) {
        requireManage();
        DocumentType documentType = requireDocumentType(id);
        if (!documentSubTypeRepository.findAllByDocumentType_IdOrderByNameAsc(id).isEmpty()
                || documentRecordRepository.existsByDocumentType_Id(id)
                || documentRevisionRepository.existsByDocumentType_Id(id)
                || controlledCopyExpiryLimitRepository.existsByDocumentType_Id(id)) {
            throw dictionaryInUse("Document Type", documentType.getName());
        }
        auditTrailService.logSafely("SETTINGS", documentType.getName(), documentType.getId(), ACTION_DOCUMENT_TYPE_DELETED, null, null,
                buildDeleteComment("Document Type", describeDocumentType(documentType)));
        documentTypeRepository.delete(documentType);
    }

    @Transactional(readOnly = true)
    public List<DocumentSubTypeDictionaryResponse> listDocumentSubTypes() {
        requireView();
        return documentSubTypeRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toDocumentSubTypeResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentSubTypeDictionaryResponse> listDocumentSubTypesPage(
            String search,
            String documentType,
            String status,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView();
        Page<DocumentSubType> result = documentSubTypeRepository.findAll(
                buildDocumentSubTypeSpecification(search, documentType, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "updatedAt")
        );
        return toPageResponse(result, this::toDocumentSubTypeResponse);
    }

    @Transactional
    public DocumentSubTypeDictionaryResponse createDocumentSubType(DocumentSubTypeDictionaryRequest request) {
        requireManage();
        DocumentType documentType = requireDocumentTypeById(request.documentTypeId());
        validateUniqueDocumentSubType(null, documentType.getId(), request.name());
        DocumentSubType subType = new DocumentSubType();
        applyDocumentSubType(subType, request, documentType);
        documentSubTypeRepository.save(subType);
        auditTrailService.logSafely("SETTINGS", subType.getName(), subType.getId(), ACTION_DOCUMENT_SUB_TYPE_CREATED, null, null,
                buildCreateComment("Document Sub-Type", subType.getName(), documentType.getName()));
        return toDocumentSubTypeResponse(subType);
    }

    @Transactional
    public DocumentSubTypeDictionaryResponse updateDocumentSubType(UUID id, DocumentSubTypeDictionaryRequest request) {
        requireManage();
        DocumentSubType subType = requireDocumentSubType(id);
        String before = describeDocumentSubType(subType);
        DocumentType documentType = requireDocumentTypeById(request.documentTypeId());
        validateUniqueDocumentSubType(id, documentType.getId(), request.name());
        applyDocumentSubType(subType, request, documentType);
        auditTrailService.logSafely("SETTINGS", subType.getName(), subType.getId(), ACTION_DOCUMENT_SUB_TYPE_UPDATED, null, null,
                buildUpdateComment("Document Sub-Type", before, describeDocumentSubType(subType)));
        return toDocumentSubTypeResponse(subType);
    }

    @Transactional
    public void deleteDocumentSubType(UUID id) {
        requireManage();
        DocumentSubType subType = requireDocumentSubType(id);
        if (subType.getDocumentType() != null
                && documentRecordRepository.existsByDocumentType_IdAndSubTypeIgnoreCase(
                        subType.getDocumentType().getId(), subType.getName())) {
            throw dictionaryInUse("Document Sub-Type", subType.getName());
        }
        auditTrailService.logSafely("SETTINGS", subType.getName(), subType.getId(), ACTION_DOCUMENT_SUB_TYPE_DELETED, null, null,
                buildDeleteComment("Document Sub-Type", describeDocumentSubType(subType)));
        documentSubTypeRepository.delete(subType);
    }

    @Transactional(readOnly = true)
    public List<StorageLocationDictionaryResponse> listStorageLocations() {
        requireView();
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
        requireView();
        Page<StorageLocation> result = storageLocationRepository.findAll(
                buildStorageLocationSpecification(search, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toStorageLocationResponse);
    }

    @Transactional
    public StorageLocationDictionaryResponse createStorageLocation(StorageLocationDictionaryRequest request) {
        requireManage();
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
        requireManage();
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
        requireManage();
        StorageLocation storageLocation = requireStorageLocation(id);
        auditTrailService.logSafely("SETTINGS", storageLocation.getName(), storageLocation.getId(), ACTION_STORAGE_LOCATION_DELETED, null, null,
                buildDeleteComment("Storage Location", describeStorageLocation(storageLocation)));
        storageLocationRepository.delete(storageLocation);
    }

    @Transactional(readOnly = true)
    public List<RetentionPolicyDictionaryResponse> listRetentionPolicies() {
        requireView();
        return retentionPolicyRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toRetentionPolicyResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LookupItemResponse> listLanguages() {
        requireView();
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
        requireView();
        Page<RetentionPolicy> result = retentionPolicyRepository.findAll(
                buildRetentionPolicySpecification(search, status, modifiedFrom, modifiedTo),
                buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate")
        );
        return toPageResponse(result, this::toRetentionPolicyResponse);
    }

    @Transactional
    public RetentionPolicyDictionaryResponse createRetentionPolicy(RetentionPolicyDictionaryRequest request) {
        requireManage();
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
        requireManage();
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
        requireManage();
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

    private String describeDocumentType(DocumentType documentType) {
        if (documentType == null) {
            return null;
        }
        return documentType.getName() + " (" + safeText(documentType.getShortCode()) + ")";
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
    }

    private void applyPosition(Position position, PositionDictionaryRequest request, BusinessUnit businessUnit, Department department) {
        position.setName(request.name().trim());
        position.setCode(normalizeCode(request.abbreviation()));
        position.setBusinessUnit(businessUnit);
        position.setDepartment(department);
        position.setDescription(trimToNull(request.description()));
        position.setActive(request.isActive() == null || request.isActive());
    }

    private void applyDocumentType(DocumentType documentType, DocumentTypeDictionaryRequest request, boolean isNew) {
        String normalizedShortCode = normalizeCode(request.shortCode());
        if (!isNew) {
            int issuedSequence = documentRecordRepository.findMaxDocumentSequenceByPrefix(documentType.getShortCode());
            int effectiveCurrentSequence = Math.max(documentType.getCurrentSequence(), issuedSequence);
            if (request.currentSequence() != null && request.currentSequence() != effectiveCurrentSequence) {
                throw new IllegalArgumentException("Current Sequence is system-managed and cannot be changed manually");
            }
            if (!normalizedShortCode.equals(documentType.getShortCode())
                    && documentRecordRepository.existsByDocumentType_Id(documentType.getId())) {
                throw new IllegalArgumentException("Short Code cannot be changed after a document number has been issued for this Document Type");
            }
            // Heal an old cache value during a normal, audited dictionary update.
            documentType.setCurrentSequence(effectiveCurrentSequence);
        }
        documentType.setName(request.name().trim());
        documentType.setShortCode(normalizedShortCode);
        if (isNew) {
            documentType.setCurrentSequence(request.currentSequence() == null ? 0 : request.currentSequence());
        }
        documentType.setDescription(trimToNull(request.description()));
        documentType.setActive(request.isActive() == null || request.isActive());
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
                positionRepository.countByDepartment_Id(department.getId())
        );
    }

    private PositionDictionaryResponse toPositionResponse(Position position) {
        return new PositionDictionaryResponse(
                position.getId(),
                position.getName(),
                position.getCode(),
                position.getBusinessUnit() == null ? null : position.getBusinessUnit().getName(),
                position.getDepartment() == null ? null : position.getDepartment().getName(),
                position.getDescription(),
                position.isActive(),
                formatDateTime(position.getCreatedAt()),
                formatDateTime(position.getUpdatedAt())
        );
    }

    private DocumentTypeDictionaryResponse toDocumentTypeResponse(DocumentType documentType) {
        return toDocumentTypeResponse(documentType, loadIssuedDocumentSequences());
    }

    private DocumentTypeDictionaryResponse toDocumentTypeResponse(
            DocumentType documentType,
            Map<String, Integer> issuedSequences
    ) {
        int sequenceFromIssuedNumbers = issuedSequences.getOrDefault(normalizeCode(documentType.getShortCode()), 0);
        int effectiveCurrentSequence = Math.max(documentType.getCurrentSequence(), sequenceFromIssuedNumbers);
        return new DocumentTypeDictionaryResponse(
                documentType.getId(),
                documentType.getName(),
                documentType.getShortCode(),
                effectiveCurrentSequence,
                documentType.getDescription(),
                documentType.isActive(),
                formatDateTime(documentType.getCreatedAt()),
                formatDateTime(documentType.getUpdatedAt()),
                effectiveCurrentSequence == 0 ? null : formatDocumentNumber(documentType.getShortCode(), effectiveCurrentSequence),
                formatDocumentNumber(documentType.getShortCode(), effectiveCurrentSequence + 1)
        );
    }

    private String formatDocumentNumber(String shortCode, int sequence) {
        return "%s.%04d".formatted(normalizeCode(shortCode), Math.max(sequence, 1));
    }

    private Map<String, Integer> loadIssuedDocumentSequences() {
        Map<String, Integer> sequences = new HashMap<>();
        for (Object[] row : documentRecordRepository.findMaxDocumentSequencesByPrefix()) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            sequences.put(row[0].toString().trim().toUpperCase(Locale.ROOT), ((Number) row[1]).intValue());
        }
        return sequences;
    }

    private ResponseStatusException dictionaryInUse(String dictionaryLabel, String dictionaryName) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                "%s '%s' is in use and cannot be deleted. Deactivate it instead to preserve regulated history."
                        .formatted(dictionaryLabel, dictionaryName)
        );
    }

    private DocumentSubTypeDictionaryResponse toDocumentSubTypeResponse(DocumentSubType documentSubType) {
        return new DocumentSubTypeDictionaryResponse(
                documentSubType.getId(),
                documentSubType.getName(),
                documentSubType.getDocumentType() == null ? null : documentSubType.getDocumentType().getId(),
                documentSubType.getDocumentType() == null ? null : documentSubType.getDocumentType().getName(),
                documentSubType.getDescription(),
                documentSubType.getReviewRequirement().name(),
                documentSubType.isActive(),
                formatDateTime(documentSubType.getCreatedAt()),
                formatDateTime(documentSubType.getUpdatedAt())
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

    private void validateUniquePosition(UUID currentId, String name, String abbreviation) {
        String normalizedName = normalizeName(name);
        String normalizedCode = normalizeCode(abbreviation);
        positionRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Position name already exists");
            }
        });
        positionRepository.findByCodeIgnoreCase(normalizedCode).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Position abbreviation already exists");
            }
        });
    }

    private void validateUniqueDocumentType(UUID currentId, String name, String shortCode) {
        String normalizedName = normalizeName(name);
        String normalizedCode = normalizeCode(shortCode);
        documentTypeRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Document type name already exists");
            }
        });
        documentTypeRepository.findByShortCodeIgnoreCase(normalizedCode).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Document type short code already exists");
            }
        });
    }

    private void validateUniqueDocumentSubType(UUID currentId, UUID documentTypeId, String name) {
        String normalizedName = normalizeName(name);
        documentSubTypeRepository.findByDocumentType_IdAndNameIgnoreCase(documentTypeId, normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Sub-type name already exists for the selected document type");
            }
        });
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

    private DocumentType requireDocumentType(UUID id) {
        return documentTypeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Document type not found"));
    }

    private DocumentType requireDocumentTypeById(String documentTypeId) {
        UUID id = parseUuid(documentTypeId, "Document type not found");
        return requireDocumentType(id);
    }

    private DocumentSubType requireDocumentSubType(UUID id) {
        return documentSubTypeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Document sub-type not found"));
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

    private UUID parseUuid(String value, String message) {
        try {
            return UUID.fromString(normalizeName(value));
        } catch (Exception ex) {
            throw new EntityNotFoundException(message);
        }
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
        int safeLimit = Math.max(limit, 1);
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
        return switch (normalized) {
            case "name", "abbreviation", "shortCode", "currentSequence", "description", "isActive" -> normalized;
            default -> defaultSortKey;
        };
    }

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

    private Specification<DocumentType> buildDocumentTypeSpecification(String search, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new java.util.ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("shortCode"), root.get("description"));
            addStatusPredicate(predicates, cb, root.get("active"), status);
            addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<DocumentSubType> buildDocumentSubTypeSpecification(String search, String documentType, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            query.distinct(true);
            Join<DocumentSubType, DocumentType> documentTypeJoin = root.join("documentType", JoinType.LEFT);
            List<Predicate> predicates = new java.util.ArrayList<>();
            addSearchPredicate(predicates, cb, search, root.get("name"), root.get("description"), documentTypeJoin.get("name"), documentTypeJoin.get("shortCode"));
            addStatusPredicate(predicates, cb, root.get("active"), status);
            addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            addDocumentTypePredicate(predicates, cb, documentTypeJoin, documentType);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

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
            return LocalDate.parse(value.trim(), DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ENGLISH));
        } catch (Exception ex) {
            return null;
        }
    }

    private String normalizeSearch(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }

    private void applyDocumentSubType(DocumentSubType subType, DocumentSubTypeDictionaryRequest request, DocumentType documentType) {
        subType.setName(request.name().trim());
        subType.setDocumentType(documentType);
        subType.setDescription(trimToNull(request.description()));
        // PATCH-style updates omit untouched fields; keep the immutable
        // configuration value rather than silently resetting it to SINGLE.
        if (StringUtils.hasText(request.reviewRequirement()) || subType.getReviewRequirement() == null) {
            subType.setReviewRequirement(parseReviewRequirement(request.reviewRequirement()));
        }
        subType.setActive(request.isActive() == null || request.isActive());
    }

    private ReviewRequirement parseReviewRequirement(String value) {
        if (!StringUtils.hasText(value)) {
            return ReviewRequirement.SINGLE;
        }
        try {
            return ReviewRequirement.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Review requirement must be NONE, SINGLE, or MULTIPLE");
        }
    }

    private String describeDocumentSubType(DocumentSubType subType) {
        return subType.getName()
                + " | Document Type: " + (subType.getDocumentType() == null ? "-" : subType.getDocumentType().getName())
                + " | Review Requirement: " + subType.getReviewRequirement().name()
                + " | Status: " + (subType.isActive() ? "Active" : "Inactive")
                + (StringUtils.hasText(subType.getDescription()) ? " | Description: " + subType.getDescription() : "");
    }

    private void addDocumentTypePredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            Join<DocumentSubType, DocumentType> documentTypeJoin,
            String documentTypeValue
    ) {
        String normalized = normalizeSearch(documentTypeValue);
        if (normalized == null || "all".equalsIgnoreCase(normalized)) {
            return;
        }
        try {
            predicates.add(cb.equal(documentTypeJoin.get("id"), UUID.fromString(documentTypeValue.trim())));
        } catch (Exception ex) {
            predicates.add(cb.or(
                    cb.equal(cb.lower(documentTypeJoin.get("name")), normalized),
                    cb.equal(cb.lower(documentTypeJoin.get("shortCode")), normalized)
            ));
        }
    }
}
