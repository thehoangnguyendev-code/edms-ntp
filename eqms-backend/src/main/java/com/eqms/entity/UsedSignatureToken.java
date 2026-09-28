package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Records a signature JWT's unique "sid" claim the first time it is successfully consumed, so it
 * can never be replayed for a second action. See V393__create_used_signature_tokens.sql.
 */
@Entity
@Table(name = "used_signature_tokens")
public class UsedSignatureToken {

    @Id
    @Column(name = "token_id")
    private UUID tokenId;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "used_at", nullable = false)
    private Instant usedAt;

    public UsedSignatureToken() {
    }

    public UsedSignatureToken(UUID tokenId, UserAccount user, Instant usedAt) {
        this.tokenId = tokenId;
        this.user = user;
        this.usedAt = usedAt;
    }

    public UUID getTokenId() {
        return tokenId;
    }

    public void setTokenId(UUID tokenId) {
        this.tokenId = tokenId;
    }

    public UserAccount getUser() {
        return user;
    }

    public void setUser(UserAccount user) {
        this.user = user;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public void setUsedAt(Instant usedAt) {
        this.usedAt = usedAt;
    }
}
