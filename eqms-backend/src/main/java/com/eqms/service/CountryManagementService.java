package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dictionary.CountryDictionaryResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.UserAccount;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Application Settings Countries boundary -- live-sourced from REST Countries v5
 * (https://restcountries.com), never from a local DB table. RestCountriesClient holds the
 * server-side API key and an in-memory cache; this service does search/filter/sort/pagination
 * over that cached snapshot so the Countries screen keeps the same page/search/filter contract
 * as every other dictionary, without a DB round trip or a per-keystroke external API call.
 */
@Service
public class CountryManagementService {
    private static final String VIEW_PERMISSION = "settings.country.view";
    private static final String MANAGE_PERMISSION = "settings.country.manage";

    private final RestCountriesClient client;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public CountryManagementService(
            RestCountriesClient client,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.client = client;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    public List<CountryDictionaryResponse> listCountries() {
        requireView();
        return client.fetchAllCountries().stream()
                .map(CountryManagementService::toResponse)
                .sorted(Comparator.comparing(CountryDictionaryResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public PageResponse<CountryDictionaryResponse> listCountriesPage(
            String search, String region, int page, int limit, String sortBy, String sortDirection
    ) {
        requireView();
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<CountryDictionaryResponse> filtered = client.fetchAllCountries().stream()
                .map(CountryManagementService::toResponse)
                .filter(c -> region == null || region.isBlank() || "All".equalsIgnoreCase(region) || region.equalsIgnoreCase(c.region()))
                .filter(c -> q.isEmpty()
                        || containsIgnoreCase(c.name(), q) || containsIgnoreCase(c.officialName(), q)
                        || containsIgnoreCase(c.capital(), q) || containsIgnoreCase(c.iso2Code(), q)
                        || containsIgnoreCase(c.iso3Code(), q) || containsIgnoreCase(c.region(), q)
                        || containsIgnoreCase(c.subregion(), q))
                .sorted(buildComparator(sortBy, sortDirection))
                .toList();

        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(limit, 1);
        int totalItems = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalItems / (double) safeLimit));
        int fromIndex = Math.min((safePage - 1) * safeLimit, totalItems);
        int toIndex = Math.min(fromIndex + safeLimit, totalItems);

        return new PageResponse<>(
                filtered.subList(fromIndex, toIndex),
                new PaginationResponse(safePage, safeLimit, totalItems, totalPages)
        );
    }

    public Map<String, List<String>> listFilterOptions() {
        requireView();
        List<String> regions = client.fetchAllCountries().stream()
                .map(RestCountriesClient.RestCountry::region)
                .filter(r -> r != null && !r.isBlank())
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
        return Map.of("regions", regions);
    }

    /** Manual cache-bust for an admin who wants to pull the latest REST Countries data before the
     *  12h TTL expires -- there is nothing else left to "sync" now that this screen has no local
     *  copy of its own. */
    public void refreshCache() {
        requireManage();
        client.invalidateCache();
        client.fetchAllCountries();
    }

    private static boolean containsIgnoreCase(String value, String needleLower) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needleLower);
    }

    private Comparator<CountryDictionaryResponse> buildComparator(String sortBy, String sortDirection) {
        Comparator<CountryDictionaryResponse> comparator = switch (sortBy == null ? "name" : sortBy) {
            case "iso2Code" -> Comparator.comparing(CountryDictionaryResponse::iso2Code, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "iso3Code" -> Comparator.comparing(CountryDictionaryResponse::iso3Code, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "region" -> Comparator.comparing(CountryDictionaryResponse::region, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "capital" -> Comparator.comparing(CountryDictionaryResponse::capital, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "population" -> Comparator.comparing(CountryDictionaryResponse::population, Comparator.nullsLast(Comparator.naturalOrder()));
            case "area" -> Comparator.comparing(CountryDictionaryResponse::area, Comparator.nullsLast(Comparator.naturalOrder()));
            case "dialCode" -> Comparator.comparing(CountryDictionaryResponse::dialCode, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "ianaSuffix" -> Comparator.comparing(CountryDictionaryResponse::ianaSuffix, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "continent" -> Comparator.comparing(CountryDictionaryResponse::continent, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            default -> Comparator.comparing(CountryDictionaryResponse::name, String.CASE_INSENSITIVE_ORDER);
        };
        if ("desc".equalsIgnoreCase(sortDirection)) {
            comparator = comparator.reversed();
        }
        return comparator;
    }

    private static CountryDictionaryResponse toResponse(RestCountriesClient.RestCountry c) {
        return new CountryDictionaryResponse(
                c.iso2(), c.name(), c.officialName(), c.iso3(), c.region(), c.subregion(), c.capital(),
                c.flagUrl(), c.dialCode(), c.continent(), c.ianaSuffix(), c.population(), c.area()
        );
    }

    private void requireView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("View permission required");
        }
    }

    private void requireManage() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(actor, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Management permission required");
        }
    }
}
