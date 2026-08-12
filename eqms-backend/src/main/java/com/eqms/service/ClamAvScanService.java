package com.eqms.service;

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

    @Value("${app.security.virus-scan.timeout-ms:15000}")
    private int timeoutMs;

    public boolean isEnabled() {
        return enabled;
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
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMs);
            socket.setSoTimeout(timeoutMs);
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
                return interpretResponse(response);
            }
        } catch (IOException ex) {
            log.warn("ClamAV scan failed (daemon at {}:{} unreachable or timed out): {}", host, port, ex.getMessage());
            throw new VirusScanUnavailableException("Virus scan service is unavailable. Please try again shortly.", ex);
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
        log.warn("Unrecognized ClamAV response, treating as scan failure: {}", response);
        throw new VirusScanUnavailableException("Virus scan returned an unexpected result. Please try again shortly.", null);
    }

    public static class VirusScanUnavailableException extends RuntimeException {
        public VirusScanUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
