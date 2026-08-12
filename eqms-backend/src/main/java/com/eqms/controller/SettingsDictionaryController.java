package com.eqms.controller;

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
import com.eqms.dto.user.PageResponse;
import com.eqms.service.DictionaryManagementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/settings/dictionaries")
public class SettingsDictionaryController {

    private final DictionaryManagementService service;

    public SettingsDictionaryController(DictionaryManagementService service) {
        this.service = service;
    }

    @GetMapping("/business-units")
    public ResponseEntity<List<BusinessUnitDictionaryResponse>> listBusinessUnits() {
        return ResponseEntity.ok(service.listBusinessUnits());
    }

    @GetMapping("/business-units/page")
    public ResponseEntity<PageResponse<BusinessUnitDictionaryResponse>> listBusinessUnitsPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listBusinessUnitsPage(search, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/business-units")
    public ResponseEntity<BusinessUnitDictionaryResponse> createBusinessUnit(@Valid @RequestBody BusinessUnitDictionaryRequest request) {
        return ResponseEntity.ok(service.createBusinessUnit(request));
    }

    @PutMapping("/business-units/{id}")
    public ResponseEntity<BusinessUnitDictionaryResponse> updateBusinessUnit(@PathVariable UUID id, @Valid @RequestBody BusinessUnitDictionaryRequest request) {
        return ResponseEntity.ok(service.updateBusinessUnit(id, request));
    }

    @DeleteMapping("/business-units/{id}")
    public ResponseEntity<Void> deleteBusinessUnit(@PathVariable UUID id) {
        service.deleteBusinessUnit(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/departments")
    public ResponseEntity<List<DepartmentDictionaryResponse>> listDepartments() {
        return ResponseEntity.ok(service.listDepartments());
    }

    @GetMapping("/departments/page")
    public ResponseEntity<PageResponse<DepartmentDictionaryResponse>> listDepartmentsPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String businessUnit,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listDepartmentsPage(search, businessUnit, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/departments")
    public ResponseEntity<DepartmentDictionaryResponse> createDepartment(@Valid @RequestBody DepartmentDictionaryRequest request) {
        return ResponseEntity.ok(service.createDepartment(request));
    }

    @PutMapping("/departments/{id}")
    public ResponseEntity<DepartmentDictionaryResponse> updateDepartment(@PathVariable UUID id, @Valid @RequestBody DepartmentDictionaryRequest request) {
        return ResponseEntity.ok(service.updateDepartment(id, request));
    }

    @DeleteMapping("/departments/{id}")
    public ResponseEntity<Void> deleteDepartment(@PathVariable UUID id) {
        service.deleteDepartment(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/positions")
    public ResponseEntity<List<PositionDictionaryResponse>> listPositions() {
        return ResponseEntity.ok(service.listPositions());
    }

    @GetMapping("/positions/page")
    public ResponseEntity<PageResponse<PositionDictionaryResponse>> listPositionsPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String businessUnit,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listPositionsPage(search, businessUnit, department, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/positions")
    public ResponseEntity<PositionDictionaryResponse> createPosition(@Valid @RequestBody PositionDictionaryRequest request) {
        return ResponseEntity.ok(service.createPosition(request));
    }

    @PutMapping("/positions/{id}")
    public ResponseEntity<PositionDictionaryResponse> updatePosition(@PathVariable UUID id, @Valid @RequestBody PositionDictionaryRequest request) {
        return ResponseEntity.ok(service.updatePosition(id, request));
    }

    @DeleteMapping("/positions/{id}")
    public ResponseEntity<Void> deletePosition(@PathVariable UUID id) {
        service.deletePosition(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/document-types")
    public ResponseEntity<List<DocumentTypeDictionaryResponse>> listDocumentTypes() {
        return ResponseEntity.ok(service.listDocumentTypes());
    }

    @GetMapping("/document-types/page")
    public ResponseEntity<PageResponse<DocumentTypeDictionaryResponse>> listDocumentTypesPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listDocumentTypesPage(search, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/document-types")
    public ResponseEntity<DocumentTypeDictionaryResponse> createDocumentType(@Valid @RequestBody DocumentTypeDictionaryRequest request) {
        return ResponseEntity.ok(service.createDocumentType(request));
    }

    @PutMapping("/document-types/{id}")
    public ResponseEntity<DocumentTypeDictionaryResponse> updateDocumentType(@PathVariable UUID id, @Valid @RequestBody DocumentTypeDictionaryRequest request) {
        return ResponseEntity.ok(service.updateDocumentType(id, request));
    }

    @DeleteMapping("/document-types/{id}")
    public ResponseEntity<Void> deleteDocumentType(@PathVariable UUID id) {
        service.deleteDocumentType(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sub-types")
    public ResponseEntity<List<DocumentSubTypeDictionaryResponse>> listDocumentSubTypes() {
        return ResponseEntity.ok(service.listDocumentSubTypes());
    }

    @GetMapping("/sub-types/page")
    public ResponseEntity<PageResponse<DocumentSubTypeDictionaryResponse>> listDocumentSubTypesPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listDocumentSubTypesPage(search, documentType, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/sub-types")
    public ResponseEntity<DocumentSubTypeDictionaryResponse> createDocumentSubType(@Valid @RequestBody DocumentSubTypeDictionaryRequest request) {
        return ResponseEntity.ok(service.createDocumentSubType(request));
    }

    @PutMapping("/sub-types/{id}")
    public ResponseEntity<DocumentSubTypeDictionaryResponse> updateDocumentSubType(@PathVariable UUID id, @Valid @RequestBody DocumentSubTypeDictionaryRequest request) {
        return ResponseEntity.ok(service.updateDocumentSubType(id, request));
    }

    @DeleteMapping("/sub-types/{id}")
    public ResponseEntity<Void> deleteDocumentSubType(@PathVariable UUID id) {
        service.deleteDocumentSubType(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/storage-locations")
    public ResponseEntity<List<StorageLocationDictionaryResponse>> listStorageLocations() {
        return ResponseEntity.ok(service.listStorageLocations());
    }

    @GetMapping("/storage-locations/page")
    public ResponseEntity<PageResponse<StorageLocationDictionaryResponse>> listStorageLocationsPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listStorageLocationsPage(search, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/storage-locations")
    public ResponseEntity<StorageLocationDictionaryResponse> createStorageLocation(@Valid @RequestBody StorageLocationDictionaryRequest request) {
        return ResponseEntity.ok(service.createStorageLocation(request));
    }

    @PutMapping("/storage-locations/{id}")
    public ResponseEntity<StorageLocationDictionaryResponse> updateStorageLocation(@PathVariable UUID id, @Valid @RequestBody StorageLocationDictionaryRequest request) {
        return ResponseEntity.ok(service.updateStorageLocation(id, request));
    }

    @DeleteMapping("/storage-locations/{id}")
    public ResponseEntity<Void> deleteStorageLocation(@PathVariable UUID id) {
        service.deleteStorageLocation(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/retention-policies")
    public ResponseEntity<List<RetentionPolicyDictionaryResponse>> listRetentionPolicies() {
        return ResponseEntity.ok(service.listRetentionPolicies());
    }

    @GetMapping("/languages")
    public ResponseEntity<List<LookupItemResponse>> listLanguages() {
        return ResponseEntity.ok(service.listLanguages());
    }

    @GetMapping("/retention-policies/page")
    public ResponseEntity<PageResponse<RetentionPolicyDictionaryResponse>> listRetentionPoliciesPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listRetentionPoliciesPage(search, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/retention-policies")
    public ResponseEntity<RetentionPolicyDictionaryResponse> createRetentionPolicy(@Valid @RequestBody RetentionPolicyDictionaryRequest request) {
        return ResponseEntity.ok(service.createRetentionPolicy(request));
    }

    @PutMapping("/retention-policies/{id}")
    public ResponseEntity<RetentionPolicyDictionaryResponse> updateRetentionPolicy(@PathVariable UUID id, @Valid @RequestBody RetentionPolicyDictionaryRequest request) {
        return ResponseEntity.ok(service.updateRetentionPolicy(id, request));
    }

    @DeleteMapping("/retention-policies/{id}")
    public ResponseEntity<Void> deleteRetentionPolicy(@PathVariable UUID id) {
        service.deleteRetentionPolicy(id);
        return ResponseEntity.noContent().build();
    }
}
