package com.eqms.auth;

import com.eqms.entity.UserAccount;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class TokenService {

    private final ObjectMapper objectMapper;
    private final String issuer;
    private final String secret;
    private final long accessTokenTtlMinutes;
    private final long refreshTokenTtlDays;
    private final long signatureTokenTtlMinutes;
    private final SecretKey secretKey;

    public TokenService(
            ObjectMapper objectMapper,
            @Value("${app.auth.issuer}") String issuer,
            @Value("${app.auth.jwt-secret}") String secret,
            @Value("${app.auth.access-token-ttl-minutes}") long accessTokenTtlMinutes,
            @Value("${app.auth.refresh-token-ttl-days}") long refreshTokenTtlDays,
            @Value("${app.auth.signature-token-ttl-minutes}") long signatureTokenTtlMinutes
    ) {
        this.objectMapper = objectMapper;
        this.issuer = issuer;
        this.secret = secret;
        this.accessTokenTtlMinutes = accessTokenTtlMinutes;
        this.refreshTokenTtlDays = refreshTokenTtlDays;
        this.signatureTokenTtlMinutes = signatureTokenTtlMinutes;
        this.secretKey = io.jsonwebtoken.security.Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(UserAccount user, UUID sessionId) {
        Instant now = Instant.now();
        long exp = now.plusSeconds(accessTokenTtlMinutes * 60).getEpochSecond();
        AccessTokenClaims claims = new AccessTokenClaims(
                issuer,
                "access",
                user.getId().toString(),
                user.getUsername(),
                user.getRoleName(),
                sessionId.toString(),
                exp,
                now.getEpochSecond()
        );
        return sign(claims);
    }

    public String createSignatureToken(UserAccount user) {
        Instant now = Instant.now();
        long exp = now.plusSeconds(signatureTokenTtlMinutes * 60).getEpochSecond();
        AccessTokenClaims claims = new AccessTokenClaims(
                issuer,
                "signature",
                user.getId().toString(),
                user.getUsername(),
                user.getRoleName(),
                UUID.randomUUID().toString(),
                exp,
                now.getEpochSecond()
        );
        return sign(claims);
    }

    public Optional<ParsedAccessToken> parseAccessToken(String token) {
        return parseToken(token, "access").map(parsed -> new ParsedAccessToken(parsed.tokenType(), parsed.principal()));
    }

    /**
     * Identifies the locked session/user from an access token even if its {@code exp} claim has
     * already passed. A user can remain idle-locked well past the access-token TTL (e.g. stepping
     * away for hours), and the password re-check in the reauthenticate flow — not token freshness —
     * is what actually authorizes unlocking. Signature/type validation is unchanged; only expiry is
     * tolerated.
     */
    public Optional<ParsedAccessToken> parseAccessTokenAllowExpired(String token) {
        try {
            var claims = io.jsonwebtoken.Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return toAccessToken(claims);
        } catch (io.jsonwebtoken.ExpiredJwtException ex) {
            return toAccessToken(ex.getClaims());
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    private Optional<ParsedAccessToken> toAccessToken(io.jsonwebtoken.Claims claims) {
        if (!"access".equals(claims.get("typ", String.class))) {
            return Optional.empty();
        }
        try {
            return Optional.of(new ParsedAccessToken("access", new AuthenticatedUser(
                    UUID.fromString(claims.getSubject()),
                    UUID.fromString(claims.get("sid", String.class)),
                    claims.get("usr", String.class),
                    claims.get("rol", String.class),
                    java.util.Set.of()
            )));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    public Optional<ParsedAccessToken> parseSignatureToken(String token) {
        return parseToken(token, "signature").map(parsed -> new ParsedAccessToken(parsed.tokenType(), parsed.principal()));
    }

    private Optional<ParsedToken> parseToken(String token, String expectedType) {
        try {
            var claims = io.jsonwebtoken.Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String tokenType = claims.get("typ", String.class);
            if (!expectedType.equals(tokenType)) {
                return Optional.empty();
            }

            String userId = claims.getSubject();
            String username = claims.get("usr", String.class);
                String role = claims.get("rol", String.class);
                String sessionId = claims.get("sid", String.class);

            return Optional.of(new ParsedToken(tokenType, new AuthenticatedUser(
                    UUID.fromString(userId),
                    UUID.fromString(sessionId),
                    username,
                    role,
                    java.util.Set.of()
            )));
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    public String createRefreshToken() {
        return UUID.randomUUID().toString() + UUID.randomUUID().toString().replace("-", "");
    }

    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash token", ex);
        }
    }

    public long getRefreshTokenTtlDays() {
        return refreshTokenTtlDays;
    }

    public String getIssuer() {
        return issuer;
    }

    public List<SimpleGrantedAuthority> toAuthorities(Set<String> permissions) {
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        permissions.forEach(permission -> authorities.add(new SimpleGrantedAuthority("ROLE_" + permission)));
        return authorities;
    }

    private String sign(AccessTokenClaims claims) {
        try {
            return io.jsonwebtoken.Jwts.builder()
                    .header()
                        .add("typ", "JWT")
                        .and()
                    .subject(claims.sub())
                    .issuer(claims.iss())
                    .expiration(java.util.Date.from(Instant.ofEpochSecond(claims.exp())))
                    .issuedAt(java.util.Date.from(Instant.ofEpochSecond(claims.iat())))
                    .claim("typ", claims.typ())
                    .claim("usr", claims.usr())
                    .claim("rol", claims.rol())
                    .claim("sid", claims.sid())
                    .signWith(secretKey)
                    .compact();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to create token", ex);
        }
    }

    public record ParsedAccessToken(String tokenType, AuthenticatedUser principal) {
    }

    private record ParsedToken(String tokenType, AuthenticatedUser principal) {
    }

    private record AccessTokenClaims(
            String iss,
            String typ,
            String sub,
            String usr,
            String rol,
            String sid,
            long exp,
            long iat
    ) {
    }
}
