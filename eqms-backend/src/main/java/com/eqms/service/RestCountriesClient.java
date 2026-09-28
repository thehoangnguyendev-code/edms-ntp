package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Server-side client for REST Countries v5 (https://restcountries.com/docs/countries). The API
 * key (Bearer token) is read from server config only -- it must never reach the browser, so all
 * reads for the Countries screen go through this backend proxy/cache, never directly from the FE.
 *
 * Countries data changes essentially never, and the paid v5 tier still has a request budget, so
 * the full list (~250 countries, one call with limit=500) is cached in memory and refreshed on a
 * TTL rather than re-fetched per request/per page/per keystroke.
 */
@Component
public class RestCountriesClient {

    private static final Logger log = LoggerFactory.getLogger(RestCountriesClient.class);

    private static final String BASE_URL = "https://api.restcountries.com/countries/v5";
    private static final Duration CACHE_TTL = Duration.ofHours(12);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final ReentrantLock refreshLock = new ReentrantLock();

    private volatile List<RestCountry> cached = List.of();
    private volatile Instant cachedAt = Instant.EPOCH;

    public RestCountriesClient(ObjectMapper objectMapper, @Value("${restcountries.api.key:}") String apiKey) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /** Proactively warms the cache once the app is up, off the request thread, so the first real
     *  user to open the Countries screen never pays the cold multi-second external-fetch cost --
     *  that was the root cause of "loading forever / No countries found" on a fresh deploy. Also
     *  re-warms on its own every {@link #CACHE_TTL}, so a normal request should never need to
     *  block on an external call at all. */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void warmCacheOnStartup() {
        try {
            fetchAllCountries();
            log.info("REST Countries cache warmed at startup ({} countries)", cached.size());
        } catch (Exception ex) {
            // Non-fatal: the app still starts, and the first real request will retry (and, once
            // any successful fetch has ever happened, fall back to stale data on future failures).
            log.warn("REST Countries cache warm-up failed at startup -- will retry on first request", ex);
        }
    }

    /** All countries, from cache when fresh (TTL {@link #CACHE_TTL}), otherwise re-fetched. If the
     *  refresh itself fails (REST Countries down/slow/rate-limited) but a previous successful
     *  fetch exists, the stale snapshot is served rather than surfacing an error -- country data
     *  changes essentially never, so serving slightly-stale data beats an empty "No countries
     *  found" screen every time the upstream API has a bad moment. */
    public List<RestCountry> fetchAllCountries() {
        List<RestCountry> snapshot = cached;
        if (!snapshot.isEmpty() && Duration.between(cachedAt, Instant.now()).compareTo(CACHE_TTL) < 0) {
            return snapshot;
        }
        refreshLock.lock();
        try {
            // Another thread may have refreshed while we waited for the lock.
            if (!cached.isEmpty() && Duration.between(cachedAt, Instant.now()).compareTo(CACHE_TTL) < 0) {
                return cached;
            }
            try {
                List<RestCountry> fetched = fetchAllPages();
                cached = fetched;
                cachedAt = Instant.now();
                return fetched;
            } catch (RuntimeException ex) {
                if (!cached.isEmpty()) {
                    log.warn("REST Countries refresh failed; serving last known-good snapshot ({} countries) instead", cached.size(), ex);
                    return cached;
                }
                throw ex;
            }
        } finally {
            refreshLock.unlock();
        }
    }

    /** Forces the next {@link #fetchAllCountries()} call to hit the API again. */
    public void invalidateCache() {
        cachedAt = Instant.EPOCH;
    }

    /** REST Countries caps `limit` at 100 per request on the plan this app's key is on (up to 500
     *  is paid-only -- confirmed live: a limit=500 request 403s with code "limitPaidPlanOnly").
     *  The first page's `data.meta.total` tells us exactly how many more pages are needed, so the
     *  rest are fetched concurrently instead of one-by-one -- a cold fetch of the full ~250-country
     *  list previously meant 3 sequential round trips (~2s each from this container, so ~6s+
     *  end-to-end); fetching pages 2+ in parallel cuts that to roughly one round trip's worth. */
    private static final int PAGE_LIMIT = 100;
    private static final int MAX_PAGES = 10; // 10 x 100 = 1000, comfortably above the ~250 real countries

    private List<RestCountry> fetchAllPages() {
        PageResult first = fetchFromApi(null, PAGE_LIMIT, 0);
        List<RestCountry> all = new ArrayList<>(first.countries());
        if (!first.more()) {
            return all;
        }
        int totalPages = first.total() > 0
                ? Math.min(MAX_PAGES, (int) Math.ceil(first.total() / (double) PAGE_LIMIT))
                : MAX_PAGES;

        List<CompletableFuture<PageResult>> pending = new ArrayList<>();
        for (int page = 1; page < totalPages; page++) {
            int offset = page * PAGE_LIMIT;
            pending.add(CompletableFuture.supplyAsync(() -> fetchFromApi(null, PAGE_LIMIT, offset)));
        }
        for (CompletableFuture<PageResult> future : pending) {
            all.addAll(future.join().countries());
        }
        return all;
    }

    private record PageResult(List<RestCountry> countries, boolean more, int total) {}

    private PageResult fetchFromApi(String query, int limit, int offset) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "REST Countries API key is not configured (RESTCOUNTRIES_API_KEY)");
        }
        StringBuilder url = new StringBuilder(BASE_URL).append("?limit=").append(limit).append("&offset=").append(offset);
        if (query != null && !query.isBlank()) {
            url.append("&q=").append(URLEncoder.encode(query, StandardCharsets.UTF_8));
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(url.toString()))
                .timeout(Duration.ofSeconds(10))
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "REST Countries returned HTTP " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode objects = root.path("data").path("objects");
            if (!objects.isArray()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "REST Countries returned an invalid country list");
            }

            List<RestCountry> countries = new ArrayList<>();
            for (JsonNode record : objects) {
                String name = text(record.path("names").path("common"));
                String iso2 = text(record.path("codes").path("alpha_2"));
                if (name == null || iso2 == null || iso2.length() != 2) {
                    continue;
                }
                countries.add(new RestCountry(
                        name,
                        iso2.toUpperCase(),
                        text(record.path("codes").path("alpha_3")),
                        text(record.path("names").path("official")),
                        text(record.path("region")),
                        text(record.path("subregion")),
                        firstCapitalName(record.path("capitals")),
                        flagUrl(record.path("flag")),
                        firstText(record.path("calling_codes")),
                        firstText(record.path("continents")),
                        firstText(record.path("tlds")),
                        record.path("population").isNumber() ? record.path("population").asLong() : null,
                        record.path("area").path("kilometers").isNumber() ? record.path("area").path("kilometers").asDouble() : null
                ));
            }
            JsonNode meta = root.path("data").path("meta");
            boolean more = meta.path("more").asBoolean(false);
            int total = meta.path("total").asInt(0);
            return new PageResult(countries, more, total);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Unable to read the REST Countries response", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "REST Countries request was interrupted", ex);
        }
    }

    private String flagUrl(JsonNode flag) {
        String svg = text(flag.path("url_svg"));
        return svg != null ? svg : text(flag.path("url_png"));
    }

    /** `capitals` is an array of objects ({@code {name, coordinates, attributes}}), unlike the
     *  other array fields here which are plain strings -- prefer the entry marked `primary`, else
     *  just the first one. */
    private String firstCapitalName(JsonNode capitals) {
        if (!capitals.isArray() || capitals.isEmpty()) return null;
        for (JsonNode capital : capitals) {
            if (capital.path("attributes").path("primary").asBoolean(false)) {
                return text(capital.path("name"));
            }
        }
        return text(capitals.get(0).path("name"));
    }

    private String firstText(JsonNode values) {
        return values.isArray() && !values.isEmpty() ? text(values.get(0)) : null;
    }

    private String text(JsonNode value) {
        if (value == null || value.isNull()) return null;
        String text = value.asText().trim();
        return text.isEmpty() ? null : text;
    }

    public record RestCountry(String name, String iso2, String iso3, String officialName, String region,
                              String subregion, String capital, String flagUrl, String dialCode,
                              String continent, String ianaSuffix, Long population, Double area) {
    }
}
