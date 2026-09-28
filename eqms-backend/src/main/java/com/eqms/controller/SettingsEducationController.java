package com.eqms.controller;

import com.eqms.dto.dictionary.*;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.EducationManagementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Canonical Application Settings API for Education; not part of Dictionaries. */
@RestController
@RequestMapping("/settings/education")
public class SettingsEducationController {
    private final EducationManagementService service;
    public SettingsEducationController(EducationManagementService service) { this.service = service; }

    @GetMapping("/degree-levels") public ResponseEntity<List<EducationDegreeLevelDictionaryResponse>> listDegreeLevels() { return ResponseEntity.ok(service.listDegreeLevels()); }
    @GetMapping("/degree-levels/lookup") public ResponseEntity<List<EducationDegreeLevelDictionaryResponse>> degreeLevelLookup() { return ResponseEntity.ok(service.listDegreeLevelsForLookup()); }
    @GetMapping("/degree-levels/page") public ResponseEntity<PageResponse<EducationDegreeLevelDictionaryResponse>> degreeLevelPage(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String modifiedFrom, @RequestParam(required = false) String modifiedTo, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit, @RequestParam(defaultValue = "displayOrder") String sortBy, @RequestParam(defaultValue = "asc") String sortDirection) { return ResponseEntity.ok(service.listDegreeLevelsPage(search, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection)); }
    @PostMapping("/degree-levels") public ResponseEntity<EducationDegreeLevelDictionaryResponse> createDegreeLevel(@Valid @RequestBody EducationDegreeLevelDictionaryRequest request) { return ResponseEntity.ok(service.createDegreeLevel(request)); }
    @PutMapping("/degree-levels/{id}") public ResponseEntity<EducationDegreeLevelDictionaryResponse> updateDegreeLevel(@PathVariable UUID id, @Valid @RequestBody EducationDegreeLevelDictionaryRequest request) { return ResponseEntity.ok(service.updateDegreeLevel(id, request)); }
    @DeleteMapping("/degree-levels/{id}") public ResponseEntity<Void> deleteDegreeLevel(@PathVariable UUID id) { service.deleteDegreeLevel(id); return ResponseEntity.noContent().build(); }

    @GetMapping("/schools") public ResponseEntity<List<SchoolDictionaryResponse>> listSchools() { return ResponseEntity.ok(service.listSchools()); }
    @GetMapping("/schools/lookup") public ResponseEntity<List<SchoolDictionaryResponse>> schoolLookup() { return ResponseEntity.ok(service.listSchoolsForLookup()); }
    @GetMapping("/schools/{id}") public ResponseEntity<SchoolDictionaryResponse> getSchool(@PathVariable UUID id) { return ResponseEntity.ok(service.getSchool(id)); }
    @GetMapping("/schools/filter-options") public ResponseEntity<Map<String, List<String>>> schoolFilterOptions() { return ResponseEntity.ok(service.listSchoolFilterOptions()); }
    @GetMapping("/schools/page") public ResponseEntity<PageResponse<SchoolDictionaryResponse>> schoolPage(@RequestParam(required = false) String search, @RequestParam(required = false) String type, @RequestParam(required = false) String ownership, @RequestParam(required = false) String governingBody, @RequestParam(required = false) String countryOfOriginName, @RequestParam(required = false) Boolean independentInstitution, @RequestParam(required = false) String status, @RequestParam(required = false) String modifiedFrom, @RequestParam(required = false) String modifiedTo, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit, @RequestParam(defaultValue = "name") String sortBy, @RequestParam(defaultValue = "asc") String sortDirection) { return ResponseEntity.ok(service.listSchoolsPage(search, type, ownership, governingBody, countryOfOriginName, independentInstitution, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection)); }
    @PostMapping("/schools") public ResponseEntity<SchoolDictionaryResponse> createSchool(@Valid @RequestBody SchoolDictionaryRequest request) { return ResponseEntity.ok(service.createSchool(request)); }
    @PutMapping("/schools/{id}") public ResponseEntity<SchoolDictionaryResponse> updateSchool(@PathVariable UUID id, @Valid @RequestBody SchoolDictionaryRequest request) { return ResponseEntity.ok(service.updateSchool(id, request)); }
    @DeleteMapping("/schools/{id}") public ResponseEntity<Void> deleteSchool(@PathVariable UUID id) { service.deleteSchool(id); return ResponseEntity.noContent().build(); }
}
