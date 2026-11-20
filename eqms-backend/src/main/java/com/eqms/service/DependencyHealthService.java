package com.eqms.service;

import com.eqms.dto.system.DependencyStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

/**
 * Whether the services the application leans on answer: the virus scanner, document storage, the Office document server and the chart renderer. The screens use it to warn a
 * person BEFORE an upload, a preview or a report fails for a reason they cannot see. It only asks each service a cheap "are you alive" question, never a real job, and it
 * keeps the answer for a few seconds so many open screens cost one round of questions, not one each. A service that is switched off in this installation is not listed.
 * It gives names and what stops working, never a host name or an address.
 */
@Service
public class DependencyHealthService {
    private static final Logger log = LoggerFactory.getLogger(DependencyHealthService.class);

    public static final String CLAMAV = "CLAMAV";
    public static final String MINIO = "MINIO";
    public static final String ONLYOFFICE = "ONLYOFFICE";
    public static final String CHART_RENDERER = "CHART_RENDERER";

    /** One service to ask about: {@code probe} is empty when the service is not used in this installation. */
    record Probe(String code, String name, String impact, java.util.function.Supplier<java.util.Optional<BooleanSupplier>> probe) {}

    private final List<Probe> probes;
    private final Clock clock;
    private final long cacheMillis;
    private final long timeoutMillis;
    private final ExecutorService pool = Executors.newFixedThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "dependency-health");
        thread.setDaemon(true);
        return thread;
    });
    private volatile Instant cachedAt = Instant.EPOCH;
    private volatile List<DependencyStatus> cached = List.of();

    @Autowired
    public DependencyHealthService(ClamAvScanService clamAv, MinioObjectStorageService minio, OnlyOfficeConfigurationService onlyOffice,
                                   @Value("${app.report.chart-renderer.url:http://chart-renderer:3100}") String chartRendererUrl,
                                   @Value("${app.health.dependencies.cache-ms:15000}") long cacheMillis,
                                   @Value("${app.health.dependencies.timeout-ms:3000}") long timeoutMillis) {
        this(List.of(
                new Probe(CLAMAV, "Virus scanner (ClamAV)", "Files cannot be uploaded until it is back: nothing may be stored without a scan.",
                        () -> clamAv.isEnabled() ? java.util.Optional.of(clamAv::ping) : java.util.Optional.empty()),
                new Probe(MINIO, "Document storage (MinIO)", "Documents, scans and records cannot be stored or opened.",
                        () -> minio.isEnabled() ? java.util.Optional.of(() -> httpOk(minio.healthUrl(), timeoutMillis, null)) : java.util.Optional.empty()),
                new Probe(ONLYOFFICE, "Office document server (OnlyOffice)", "Word, Excel and PowerPoint files cannot be previewed or edited.",
                        () -> {
                            OnlyOfficeConfigurationService.OnlyOfficeConfiguration config = onlyOffice.getEffectiveConfiguration();
                            return config != null && config.enabled() && config.documentServerUrl() != null && !config.documentServerUrl().isBlank()
                                    ? java.util.Optional.of(() -> httpOk(trimSlash(config.documentServerUrl()) + "/healthcheck", timeoutMillis, "true"))
                                    : java.util.Optional.empty();
                        }),
                new Probe(CHART_RENDERER, "Chart renderer (Chart.js)", "Reports cannot draw their charts.",
                        () -> java.util.Optional.of(() -> httpOk(trimSlash(chartRendererUrl) + "/health", timeoutMillis, null)))),
                Clock.systemUTC(), cacheMillis, timeoutMillis);
    }

    DependencyHealthService(List<Probe> probes, Clock clock, long cacheMillis, long timeoutMillis) {
        this.probes = probes;
        this.clock = clock;
        this.cacheMillis = cacheMillis;
        this.timeoutMillis = timeoutMillis;
    }

    /** The state of every service used here, from at most {@code cacheMillis} ago. */
    public List<DependencyStatus> check() {
        Instant now = clock.instant();
        if (Duration.between(cachedAt, now).toMillis() < cacheMillis && cachedAt.isAfter(Instant.EPOCH)) {
            return cached;
        }
        synchronized (this) {
            now = clock.instant();
            if (Duration.between(cachedAt, now).toMillis() < cacheMillis && cachedAt.isAfter(Instant.EPOCH)) {
                return cached;
            }
            List<DependencyStatus> fresh = ask(now);
            cached = fresh;
            cachedAt = now;
            return fresh;
        }
    }

    private List<DependencyStatus> ask(Instant now) {
        record Pending(Probe probe, CompletableFuture<Boolean> future) {}
        List<Pending> pending = new ArrayList<>();
        for (Probe probe : probes) {
            java.util.Optional<BooleanSupplier> question;
            try {
                question = probe.probe().get();
            } catch (RuntimeException ex) {
                log.warn("Could not prepare the health question for {}: {}", probe.code(), ex.getMessage());
                question = java.util.Optional.of(() -> false);
            }
            if (question.isEmpty()) continue; // not used in this installation
            BooleanSupplier ask = question.get();
            pending.add(new Pending(probe, CompletableFuture.supplyAsync(ask::getAsBoolean, pool).orTimeout(timeoutMillis + 1000, TimeUnit.MILLISECONDS)));
        }
        List<DependencyStatus> result = new ArrayList<>();
        for (Pending item : pending) {
            boolean up;
            try {
                up = item.future().join();
            } catch (RuntimeException ex) {
                up = false; // a question that fails or does not answer in time is a service that does not answer
            }
            if (!up) log.warn("Dependency {} does not answer", item.probe().code());
            result.add(new DependencyStatus(item.probe().code(), item.probe().name(), up ? "UP" : "DOWN", item.probe().impact(), now));
        }
        return List.copyOf(result);
    }

    private static String trimSlash(String url) {
        return url.replaceAll("/+$", "");
    }

    private static final HttpClient CLIENT = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    /** A 200 from the address (and, when {@code expectedBody} is given, that body) means the service is alive. Any failure means it is not. */
    static boolean httpOk(String url, long timeoutMillis, String expectedBody) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofMillis(timeoutMillis)).GET().build();
            HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return false;
            return expectedBody == null || response.body().trim().equalsIgnoreCase(expectedBody);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception ex) {
            return false;
        }
    }
}
