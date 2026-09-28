package com.eqms.controller;

import com.eqms.dto.dictionary.CountryDictionaryResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.CountryManagementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Canonical Application Settings API for Countries; not part of Dictionaries. Live-sourced from
 *  REST Countries v5 (https://restcountries.com) -- read-only, no local create/update/delete: see
 *  CountryManagementService/RestCountriesClient. */
@RestController
@RequestMapping("/settings/countries")
public class SettingsCountriesController {
    private final CountryManagementService service;

    public SettingsCountriesController(CountryManagementService service) { this.service = service; }

    @GetMapping public ResponseEntity<List<CountryDictionaryResponse>> list() { return ResponseEntity.ok(service.listCountries()); }

    @GetMapping("/page")
    public ResponseEntity<PageResponse<CountryDictionaryResponse>> page(
            @RequestParam(required = false) String search, @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy, @RequestParam(defaultValue = "asc") String sortDirection) {
        return ResponseEntity.ok(service.listCountriesPage(search, region, page, limit, sortBy, sortDirection));
    }

    @GetMapping("/filter-options") public ResponseEntity<java.util.Map<String, List<String>>> filterOptions() { return ResponseEntity.ok(service.listFilterOptions()); }

    /** Manual cache-bust (settings.country.manage) -- pulls the latest REST Countries data before
     *  the in-memory cache's 12h TTL expires on its own. */
    @PostMapping("/refresh")
    public ResponseEntity<Void> refresh() {
        service.refreshCache();
        return ResponseEntity.noContent().build();
    }
}
