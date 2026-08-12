package com.eqms;

import com.eqms.service.ClamAvScanService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Exercises the real ClamAV INSTREAM protocol implementation in {@link ClamAvScanService} against
 * a live daemon (the docker-compose 'clamav' service, reachable on localhost while its port is
 * published for local development/testing). Requires that container to be running and healthy;
 * this is a manual verification test, not part of the default CI-safe suite, since most
 * environments running `mvn test` do not have ClamAV started.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "app.security.virus-scan.enabled=true",
        "app.security.virus-scan.host=localhost",
        "app.security.virus-scan.port=3310"
})
public class ClamAvScanServiceIntegrationTest {

    // Standard, universally-recognized antivirus test signature — not a real virus.
    private static final String EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

    @Autowired
    private ClamAvScanService clamAvScanService;

    @BeforeEach
    void skipIfClamAvNotReachable() {
        boolean reachable;
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("localhost", 3310), 1000);
            reachable = true;
        } catch (IOException ex) {
            reachable = false;
        }
        assumeTrue(reachable, "ClamAV is not running on localhost:3310 — skipping (start it with "
                + "`docker compose up -d clamav` to run this test)");
    }

    @Test
    void scan_flagsTheEicarTestSignatureAsInfected() {
        ClamAvScanService.ScanResult result = clamAvScanService.scan(EICAR.getBytes(StandardCharsets.US_ASCII));
        assertFalse(result.clean(), "The EICAR test file must be detected as infected");
        assertTrue(result.signatureName() != null && result.signatureName().toLowerCase().contains("eicar"),
                "Signature name should mention EICAR, was: " + result.signatureName());
    }

    @Test
    void scan_allowsAnOrdinaryCleanFile() {
        byte[] harmless = "this is an ordinary evidence file, not a virus".getBytes(StandardCharsets.UTF_8);
        ClamAvScanService.ScanResult result = clamAvScanService.scan(harmless);
        assertTrue(result.clean(), "An ordinary file must be reported clean");
    }
}
