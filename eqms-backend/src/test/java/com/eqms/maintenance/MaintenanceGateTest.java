package com.eqms.maintenance;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.auth.TokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The maintenance gate (SDS 11.5.3) and the Maintenance Pass (11.6). */
class MaintenanceGateTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef-test-only";

    @TempDir
    Path tmp;

    private final TokenService tokens = mock(TokenService.class);
    private final com.eqms.repository.UserAccountRepository users = mock(com.eqms.repository.UserAccountRepository.class);
    private final com.eqms.service.PermissionEvaluationService permissions = mock(com.eqms.service.PermissionEvaluationService.class);
    private final UUID adminId = UUID.randomUUID();
    private final UUID viewerId = UUID.randomUUID();

    private MaintenanceGateFilter gate(Path lock) {
        return new MaintenanceGateFilter(lock.toString(), tokens, users, permissions);
    }

    private void write(Path lock, String state) throws Exception {
        Files.writeString(lock, "{\"state\":\"" + state + "\",\"requestId\":\"RQ-1\"}");
    }

    private MockHttpServletResponse call(MaintenanceGateFilter filter, String method, String uri) throws Exception {
        return call(filter, method, uri, null);
    }

    private MockHttpServletResponse call(MaintenanceGateFilter filter, String method, String uri, String accessToken) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setContextPath("/api");
        request.setRequestURI("/api" + uri);
        if (accessToken != null) request.setCookies(new Cookie("accessToken", accessToken));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        return response;
    }

    @Test
    void anOpenSystemLetsEveryRequestThrough() throws Exception {
        MaintenanceGateFilter filter = gate(tmp.resolve("none.lock"));
        assertThat(call(filter, "POST", "/auth/login").getStatus()).isEqualTo(200);
        assertThat(filter.isLocked()).isFalse();
    }

    @Test
    void aNoticeDoesNotLockAnyone() throws Exception {
        Path lock = tmp.resolve("maintenance.lock");
        write(lock, "NOTICE");
        assertThat(gate(lock).isLocked()).isFalse();
    }

    @Test
    void aDrainedOrLockedSystemRefusesEveryoneExceptTheMaintenanceCalls() throws Exception {
        Path lock = tmp.resolve("maintenance.lock");
        for (String state : new String[] {"DRAINED", "LOCKED_RESTORING"}) {
            write(lock, state);
            MaintenanceGateFilter filter = gate(lock);
            assertThat(call(filter, "POST", "/auth/login").getStatus()).as("login passes the gate; the login service refuses everyone without the bypass").isEqualTo(200);
            assertThat(call(filter, "GET", "/backup-restore/backups").getStatus()).isEqualTo(503);
            assertThat(call(filter, "POST", "/backup-restore/backups").getStatus()).isEqualTo(503);
            assertThat(call(filter, "GET", "/documents").getStatus()).isEqualTo(503);
            MockHttpServletResponse refused = call(filter, "GET", "/documents");
            assertThat(refused.getHeader("Retry-After")).isEqualTo("60");
            assertThat(refused.getContentAsString()).contains("MAINTENANCE_MODE");

            assertThat(call(filter, "GET", "/system/maintenance-status").getStatus()).isEqualTo(200);
            assertThat(call(filter, "POST", "/system/maintenance/login").getStatus()).isEqualTo(200);
            assertThat(call(filter, "GET", "/health").getStatus()).isEqualTo(200);
            assertThat(call(filter, "OPTIONS", "/documents").getStatus()).isEqualTo(200);
        }
    }

    @Test
    void anUnreadableLockFileKeepsTheSystemLocked() throws Exception {
        Path lock = tmp.resolve("maintenance.lock");
        Files.writeString(lock, "not json at all {{{");
        MaintenanceGateFilter filter = gate(lock);
        assertThat(filter.isLocked()).as("an unreadable lock is treated as a lock").isTrue();
        assertThat(call(filter, "GET", "/documents").getStatus()).isEqualTo(503);
    }

    @Test
    void theLockFileAndTheGateAgreeAfterTheStateGoesBackToNormal() throws Exception {
        Path lock = tmp.resolve("maintenance.lock");
        write(lock, "LOCKED_RESTORING");
        MaintenanceGateFilter filter = gate(lock);
        assertThat(filter.isLocked()).isTrue();
        Files.delete(lock);
        assertThat(filter.isLocked()).isFalse();
        assertThat(call(filter, "GET", "/documents").getStatus()).isEqualTo(200);
    }

    @Test
    void aPersonWithTheBypassWorksWhileLockedAndAnyoneElseIsRefused() throws Exception {
        Path lock = tmp.resolve("maintenance.lock");
        write(lock, "LOCKED_RESTORING");
        MaintenanceGateFilter filter = gate(lock);
        com.eqms.entity.UserAccount admin = new com.eqms.entity.UserAccount();
        com.eqms.entity.UserAccount viewer = new com.eqms.entity.UserAccount();
        when(users.findById(adminId)).thenReturn(Optional.of(admin));
        when(users.findById(viewerId)).thenReturn(Optional.of(viewer));
        when(permissions.hasPermission(admin, MaintenanceGateFilter.BYPASS_PERMISSION)).thenReturn(true);
        when(permissions.hasPermission(viewer, MaintenanceGateFilter.BYPASS_PERMISSION)).thenReturn(false);
        when(tokens.parseAccessToken("admin-token")).thenReturn(Optional.of(new TokenService.ParsedAccessToken("access",
                new AuthenticatedUser(adminId, UUID.randomUUID(), "admin", "ADMIN", Set.of()))));
        when(tokens.parseAccessToken("viewer-token")).thenReturn(Optional.of(new TokenService.ParsedAccessToken("access",
                new AuthenticatedUser(viewerId, UUID.randomUUID(), "viewer", "USER", Set.of()))));

        assertThat(call(filter, "GET", "/backup-restore/restores", "admin-token").getStatus()).isEqualTo(200);
        assertThat(call(filter, "GET", "/backup-restore/restores", "viewer-token").getStatus()).isEqualTo(503);
        assertThat(call(filter, "GET", "/backup-restore/restores", "forged-token").getStatus()).as("a token that does not verify is no bypass").isEqualTo(503);
        assertThat(call(filter, "GET", "/backup-restore/restores", null).getStatus()).isEqualTo(503);
        assertThat(call(filter, "POST", "/auth/login", null).getStatus()).as("login is open so that the bypass can sign in").isEqualTo(200);
    }

    @Test
    void aMaintenancePassIsIssuedAndVerifiedAndExpires() {
        MaintenancePassService passes = new MaintenancePassService(SECRET, 30);
        MaintenancePassService.Issued issued = passes.issue("super.admin");
        assertThat(passes.verify(issued.token())).contains("super.admin");
        assertThat(passes.verify(issued.token() + "x")).isEmpty();
        assertThat(passes.verify("nodot")).isEmpty();
        assertThat(passes.verify(null)).isEmpty();

        MaintenancePassService other = new MaintenancePassService("ffffffffffffffffffffffffffffffff-other-key", 30);
        assertThat(other.verify(issued.token())).as("a pass from another key is refused").isEmpty();

        MaintenancePassService expired = new MaintenancePassService(SECRET, -1);
        assertThat(expired.verify(expired.issue("super.admin").token())).as("an expired pass is refused").isEmpty();
    }

    @Test
    void noPassIsIssuedWithoutAStrongSecret() {
        MaintenancePassService none = new MaintenancePassService("", 30);
        assertThat(none.configured()).isFalse();
        assertThat(none.verify(new MaintenancePassService(SECRET, 30).issue("x").token())).isEmpty();
    }
}
