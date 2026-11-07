package com.eqms.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** A user who opened a link: what gives that user the folder or document of the link while the link is usable. */
@Entity
@Table(name = "knowledge_share_link_redemptions")
public class KnowledgeShareLinkRedemption {
    @Embeddable
    public static class Key implements Serializable {
        @Column(name = "link_id")
        private UUID linkId;
        @Column(name = "user_id")
        private UUID userId;

        public Key() {
        }

        public Key(UUID linkId, UUID userId) {
            this.linkId = linkId;
            this.userId = userId;
        }

        public UUID getLinkId() { return linkId; }
        public UUID getUserId() { return userId; }

        @Override
        public boolean equals(Object other) {
            return other instanceof Key k && Objects.equals(linkId, k.linkId) && Objects.equals(userId, k.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(linkId, userId);
        }
    }

    @EmbeddedId
    private Key id;

    @Column(name = "first_opened_at", nullable = false)
    private Instant firstOpenedAt = Instant.now();

    @Column(name = "last_opened_at", nullable = false)
    private Instant lastOpenedAt = Instant.now();

    @Column(name = "open_count", nullable = false)
    private int openCount = 1;

    public KnowledgeShareLinkRedemption() {
    }

    public KnowledgeShareLinkRedemption(UUID linkId, UUID userId) {
        this.id = new Key(linkId, userId);
    }

    public Key getId() { return id; }
    public Instant getFirstOpenedAt() { return firstOpenedAt; }
    public Instant getLastOpenedAt() { return lastOpenedAt; }
    public int getOpenCount() { return openCount; }

    public void opened() {
        lastOpenedAt = Instant.now();
        openCount++;
    }
}
