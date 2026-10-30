package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.security.AdministrativeNetworkPolicy;
import com.eqms.security.NetworkCidr;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Persists policy with transactional audit. Does not by itself enforce requests. */
@Service
public class AdministrativeNetworkPolicyService {
    public record Settings(boolean enabled, List<String> allowedNetworks, List<String> trustedProxies, UUID emergencyUserId) {}
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final UserAccountRepository users;
    private final PermissionEvaluationService permissions;
    private final AuditTrailService audit;

    public AdministrativeNetworkPolicyService(JdbcTemplate jdbc, ObjectMapper mapper, UserAccountRepository users,
                                               PermissionEvaluationService permissions, AuditTrailService audit) {
        this.jdbc = jdbc; this.mapper = mapper; this.users = users; this.permissions = permissions; this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Settings get() { return read(false); }

    private Settings read(boolean lock) {
        return jdbc.queryForObject("SELECT enabled,allowed_networks::text,trusted_proxies::text,emergency_user_id FROM administrative_network_policy WHERE id=true" + (lock ? " FOR UPDATE" : ""),
                (rs, row) -> new Settings(rs.getBoolean(1), parse(rs.getString(2)), parse(rs.getString(3)), rs.getObject(4, UUID.class)));
    }

    /** The caller must have settings.configuration.manage and must authenticate the actor. */
    @Transactional
    public Settings save(UserAccount actor, Settings value, String remoteAddress, String forwardedFor) {
        if (actor == null || !permissions.hasPermission(actor, "settings.configuration.manage"))
            throw new org.springframework.security.access.AccessDeniedException("Permission required");
        if (value == null || value.allowedNetworks() == null || value.trustedProxies() == null
                || value.allowedNetworks().size() > 100 || value.trustedProxies().size() > 100)
            throw new IllegalArgumentException("Invalid network policy");
        List<NetworkCidr> allowed = value.allowedNetworks().stream().map(NetworkCidr::parse).toList();
        List<NetworkCidr> trusted = value.trustedProxies().stream().map(NetworkCidr::parse).toList();
        var policy = new AdministrativeNetworkPolicy(value.enabled(), allowed, trusted, value.emergencyUserId());
        if (value.enabled()) {
            UserAccount emergency = users.findById(value.emergencyUserId()).orElseThrow(() -> new IllegalArgumentException("Emergency account not found"));
            if (emergency.getStatus() != UserStatus.Active || !permissions.hasPermission(emergency, "settings.configuration.manage"))
                throw new IllegalArgumentException("Emergency account must be active and permitted to manage configuration");
            if (policy.evaluate(true, actor.getId(), true, remoteAddress, forwardedFor) == AdministrativeNetworkPolicy.Decision.DENIED)
                throw new IllegalArgumentException("Current administrator would be blocked by this policy");
        }
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(4994858482022699590)", Object.class);
        Settings before = read(true);
        if (before.equals(value)) return before;
        jdbc.update("UPDATE administrative_network_policy SET enabled=?,allowed_networks=CAST(? AS jsonb),trusted_proxies=CAST(? AS jsonb),emergency_user_id=?,updated_by=?,updated_at=now() WHERE id=true",
                value.enabled(), json(value.allowedNetworks()), json(value.trustedProxies()), value.emergencyUserId(), actor.getId());
        audit.logAs(actor, "ADMINISTRATIVE_NETWORK_POLICY", "Administrative network policy", null,
                "ADMINISTRATIVE_NETWORK_POLICY_UPDATED", null, null, "Administrative network policy updated",
                List.of(new AuditTrailChangeResponse("Policy", before.toString(), value.toString())));
        return value;
    }

    /** Nothing is saved: the address of the caller as the given trusted proxies resolve it, and whether the given networks contain it. */
    public com.eqms.controller.AdministrativeNetworkPolicyController.ClientAddress checkAddress(Settings value, String remoteAddress, String forwardedFor, boolean recoveryDisabled) {
        if (value == null || value.allowedNetworks() == null || value.trustedProxies() == null
                || value.allowedNetworks().size() > 100 || value.trustedProxies().size() > 100)
            throw new IllegalArgumentException("Invalid network policy");
        List<NetworkCidr> allowed = value.allowedNetworks().stream().map(NetworkCidr::parse).toList();
        List<NetworkCidr> trusted = value.trustedProxies().stream().map(NetworkCidr::parse).toList();
        String client = com.eqms.security.NetworkClientAddress.resolve(remoteAddress, forwardedFor, trusted);
        return new com.eqms.controller.AdministrativeNetworkPolicyController.ClientAddress(client, allowed.stream().anyMatch(n -> n.contains(client)), recoveryDisabled);
    }

    private List<String> parse(String json) {
        try { return mapper.readValue(json, new TypeReference<List<String>>() {}); }
        catch (Exception ex) { throw new IllegalStateException("Invalid stored network policy", ex); }
    }
    private String json(List<String> value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception ex) { throw new IllegalArgumentException("Invalid network list", ex); }
    }
}
