package com.eqms.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

/** Early rejection before signatures, session revocation or notification delivery. */
@Service
public class EmergencyAccountChangeGuard {
    private final JdbcTemplate jdbc;
    public EmergencyAccountChangeGuard(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireMayDeactivate(UUID userId) {
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(4994858482022699590)", Object.class);
        Boolean protectedAccount = jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM administrative_network_policy WHERE id=true AND enabled=true AND emergency_user_id=?)",
                Boolean.class, userId);
        if (Boolean.TRUE.equals(protectedAccount))
            throw new AccessDeniedException("Assign another active emergency account or disable the network policy before deactivating this account");
    }
}
