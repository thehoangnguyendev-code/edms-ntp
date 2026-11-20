package com.eqms.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * Scans uploaded evidence files (Report Lost/Damaged screenshots/photos) against a ClamAV daemon
 * before they are stored, using ClamAV's INSTREAM protocol directly over TCP — no external client
 * library required, the protocol is a handful of length-prefixed chunks.
 * <p>
 * Fails closed: if scanning is enabled and the daemon cannot be reached, the upload is rejected
 * rather than silently allowed through — a security control that is unreachable must not be
 * treated as equivalent to "clean". Set {@code app.security.virus-scan.enabled=false} for local
 * development environments that do not run a ClamAV container.
 */
@Service
public class ClamAvScanService {

    private static final Logger log = LoggerFactory.getLogger(ClamAvScanService.class);
    private static final int CHUNK_SIZE = 8192;

    @Value("${app.security.virus-scan.enabled:false}")
    private boolean enabled;

    @Value("${app.security.virus-scan.host:clamav}")
    private String host;

    @Value("${app.security.virus-scan.port:3310}")
    private int port;

    /** Time allowed to connect, and the least time allowed to wait for the answer. */
    @Value("${app.security.virus-scan.timeout-ms:15000}")
    private int timeoutMs;

    /** The daemon answers only after it has scanned the whole file, so a big file needs longer than a small one: this is added to the wait for each MB sent. */
    @Value("${app.security.virus-scan.timeout-per-mb-ms:4000}")
    private int timeoutPerMbMs;

    /** The most the wait for one answer can grow to, however big the file. */
    @Value("${app.security.virus-scan.max-read-timeout-ms:120000}")
    private int maxReadTimeoutMs;

    /** A connection that fails, is cut or times out is tried again (a daemon that is reloading its signatures or busy with another file answers a moment later). */
    @Value("${app.security.virus-scan.max-attempts:3}")
    private int maxAttempts;

    @Value("${app.security.virus-scan.retry-delay-ms:1000}")
    private int retryDelayMs;

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * #11: RevisionUploadFileValidator/ControlledCopyService/PublishingTemplateService/
     * UserManagementService all check {@link #isEnabled()} and silently skip scanning when it is
     * false -- correct behavior for local development, but if this flips to false in a live
     * environment (misconfiguration, an env var dropped during a deploy) every subsequent upload
     * across the whole application goes unscanned with nothing surfacing that fact anywhere.
     * Alarm loudly at startup so an operator sees it in logs/monitoring, mirroring the MinIO
     * default-credential warning this session already added for the same class of "silently
     * running in a weaker posture than intended" gap.
     */
    @PostConstruct
    private void alarmIfDisabled() {
        if (!enabled) {
            log.warn("Malware scanning is DISABLED (app.security.virus-scan.enabled=false) -- "
                    + "revision source files, Controlled Copy evidence, Publishing Template assets, and "
                    + "user certification uploads are all being stored WITHOUT a virus scan. This is fine "
                    + "for local development only; it MUST be enabled before this environment stores real data.");
        }
    }

    public record ScanResult(boolean clean, String signatureName) {
        public static ScanResult ofClean() {
            return new ScanResult(true, null);
        }
        public static ScanResult ofInfected(String signatureName) {
            return new ScanResult(false, signatureName);
        }
    }

    /**
     * @throws VirusScanUnavailableException when scanning is enabled but the daemon could not be
     *                                        reached or returned an unrecognized response — the
     *                                        caller must treat this as "cannot confirm clean", not
     *                                        as "clean".
     */
    public ScanResult scan(byte[] content) {
        if (!enabled) {
            return ScanResult.ofClean();
        }
        int attempts = Math.max(1, maxAttempts);
        IOException last = null;
        for (int attempt = 1; attempt <= attempts; attempt++) {
            try {
                return scanOnce(content, attempt);
            } catch (IOException ex) {
                last = ex;
                log.warn("ClamAV scan attempt {}/{} failed (daemon at {}:{} unreachable, cut or timed out): {}", attempt, attempts, host, port, ex.getMessage());
                if (attempt < attempts && !pause((long) retryDelayMs * attempt)) {
                    break;
                }
            }
        }
        throw new VirusScanUnavailableException("Virus scan service is unavailable. Please try again shortly.", last);
    }

    /** How long to wait for the answer for a file of this size: the base time plus a share for each MB, never more than the cap; each new attempt waits longer. */
    int readTimeoutMs(int contentBytes, int attempt) {
        long wanted = timeoutMs + (long) timeoutPerMbMs * ((contentBytes + 1_048_575L) / 1_048_576L);
        long cap = Math.max(timeoutMs, maxReadTimeoutMs);
        return (int) Math.min(cap, wanted * Math.max(1, attempt));
    }

    private boolean pause(long millis) {
        try {
            Thread.sleep(millis);
            return true;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private ScanResult scanOnce(byte[] content, int attempt) throws IOException {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMs);
            socket.setSoTimeout(readTimeoutMs(content.length, attempt));
            try (DataOutputStream out = new DataOutputStream(socket.getOutputStream());
                 InputStream in = socket.getInputStream()) {
                out.write("zINSTREAM\0".getBytes(StandardCharsets.US_ASCII));
                out.flush();

                try (ByteArrayInputStream contentStream = new ByteArrayInputStream(content)) {
                    byte[] buffer = new byte[CHUNK_SIZE];
                    int read;
                    while ((read = contentStream.read(buffer)) > 0) {
                        out.writeInt(read);
                        out.write(buffer, 0, read);
                    }
                }
                out.writeInt(0);
                out.flush();

                String response = readResponse(in);
                if (response.isEmpty()) {
                    throw new IOException("the daemon closed the connection without an answer");
                }
                return interpretResponse(response);
            }
        }
    }

    /** Whether the daemon answers: ClamAV replies PONG to PING. A short question, never a file; it is what the "service not available" warning uses. */
    public boolean ping() {
        if (!enabled) {
            return true;
        }
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), Math.min(timeoutMs, 3000));
            socket.setSoTimeout(Math.min(timeoutMs, 3000));
            socket.getOutputStream().write("zPING\0".getBytes(StandardCharsets.US_ASCII));
            socket.getOutputStream().flush();
            return "PONG".equals(readResponse(socket.getInputStream()));
        } catch (IOException ex) {
            return false;
        }
    }

    private String readResponse(InputStream in) throws IOException {
        java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
        int b;
        while ((b = in.read()) != -1 && b != 0) {
            buffer.write(b);
        }
        return buffer.toString(StandardCharsets.US_ASCII).trim();
    }

    private ScanResult interpretResponse(String response) {
        if (response.endsWith("OK")) {
            return ScanResult.ofClean();
        }
        if (response.contains("FOUND")) {
            String signature = response.replace("stream:", "").replace("FOUND", "").trim();
            log.warn("ClamAV flagged an uploaded file as infected: {}", signature);
            return ScanResult.ofInfected(signature);
        }
        if (response.toLowerCase().contains("size limit exceeded")) {
            // not a passing fault: trying again cannot help, the daemon must be allowed to take bigger files (StreamMaxLength)
            log.warn("ClamAV refused a file for its size ({}): raise StreamMaxLength of the daemon", response);
            throw new VirusScanUnavailableException("The file is larger than the virus scanner accepts. Split it into smaller files.", null);
        }
        log.warn("Unrecognized ClamAV response, treating as scan failure: {}", response);
        throw new VirusScanUnavailableException("Virus scan returned an unexpected result. Please try again shortly.", null);
    }

    public static class VirusScanUnavailableException extends RuntimeException {
        public VirusScanUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
