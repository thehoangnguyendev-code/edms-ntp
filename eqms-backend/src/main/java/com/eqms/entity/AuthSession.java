package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "auth_sessions")
@jakarta.persistence.EntityListeners(AuthSessionChangeListener.class)
public class AuthSession {

    public enum SessionStatus {
        ACTIVE,
        LOCKED,
        EXPIRED,
        REVOKED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "refresh_token_hash", nullable = false, unique = true, length = 128)
    private String refreshTokenHash;

    @Column(name = "previous_refresh_token_hash", unique = true, length = 128)
    private String previousRefreshTokenHash;

    @Column(name = "device_name", length = 255)
    private String deviceName;

    @Column(name = "ip_address", length = 80)
    private String ipAddress;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "current_session", nullable = false)
    private boolean currentSession = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SessionStatus status = SessionStatus.ACTIVE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_activity_at", nullable = false)
    private Instant lastActivityAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    /** Why the session was revoked by the system; null for a sign-out, an admin force logout or a lock-out. See {@link #REVOKED_CONCURRENT_LIMIT}. */
    @Column(name = "revoked_reason", length = 40)
    private String revokedReason;

    /** The same account signed in on another device and the limit of sessions per account left no room for this one. */
    public static final String REVOKED_CONCURRENT_LIMIT = "CONCURRENT_LIMIT";

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "failed_reauth_count", nullable = false)
    private int failedReauthCount;

    /** What the "Logged in Users" screen shows that can change without a new session: its state, whether it is the current one, whether it was revoked. Not persisted. */
    @jakarta.persistence.Transient
    private String stateFingerprint;

    void rememberStateForChangeDetection() {
        this.stateFingerprint = status + "|" + currentSession + "|" + (revokedAt != null);
    }

    boolean stateChangedSinceRemembered() {
        return stateFingerprint == null || !stateFingerprint.equals(status + "|" + currentSession + "|" + (revokedAt != null));
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (lastActivityAt == null) {
            lastActivityAt = now;
        }
    }

    public boolean isActive() {
        return status == SessionStatus.ACTIVE && revokedAt == null && expiresAt.isAfter(Instant.now());
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UserAccount getUser() {
        return user;
    }

    public void setUser(UserAccount user) {
        this.user = user;
    }

    public String getRefreshTokenHash() {
        return refreshTokenHash;
    }

    public void setRefreshTokenHash(String refreshTokenHash) {
        this.refreshTokenHash = refreshTokenHash;
    }

    public String getPreviousRefreshTokenHash() {
        return previousRefreshTokenHash;
    }

    public void setPreviousRefreshTokenHash(String previousRefreshTokenHash) {
        this.previousRefreshTokenHash = previousRefreshTokenHash;
    }

    public String getDeviceName() {
        return deviceName;
    }

    public void setDeviceName(String deviceName) {
        this.deviceName = deviceName;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public boolean isCurrentSession() {
        return currentSession;
    }

    public void setCurrentSession(boolean currentSession) {
        this.currentSession = currentSession;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getLastActivityAt() {
        return lastActivityAt;
    }

    public void setLastActivityAt(Instant lastActivityAt) {
        this.lastActivityAt = lastActivityAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getRevokedReason() {
        return revokedReason;
    }

    public void setRevokedReason(String revokedReason) {
        this.revokedReason = revokedReason;
    }

    public Instant getLockedAt() {
        return lockedAt;
    }

    public void setLockedAt(Instant lockedAt) {
        this.lockedAt = lockedAt;
    }

    public int getFailedReauthCount() {
        return failedReauthCount;
    }

    public void setFailedReauthCount(int failedReauthCount) {
        this.failedReauthCount = failedReauthCount;
    }

    public SessionStatus getStatus() {
        return status;
    }

    public void setStatus(SessionStatus status) {
        this.status = status;
    }
}
