package com.eqms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

/** Personal, floating local-time event. This is not a document/workflow record. */
@Entity
@Table(name = "calendar_events")
public class CalendarEvent {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "owner_user_id", nullable = false)
    private UserAccount owner;
    @Column(nullable = false, length = 200) private String title;
    @Column(length = 4000) private String description;
    @Column(name = "starts_at", nullable = false) private LocalDateTime startsAt;
    @Column(name = "ends_at", nullable = false) private LocalDateTime endsAt;
    @Column(name = "all_day", nullable = false) private boolean allDay;
    @Version private long version;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "deleted_at") private Instant deletedAt;
    @PrePersist void onCreate() { createdAt = Instant.now(); updatedAt = createdAt; }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
    public UUID getId() { return id; }
    public UserAccount getOwner() { return owner; }
    public void setOwner(UserAccount value) { owner = value; }
    public String getTitle() { return title; }
    public void setTitle(String value) { title = value; }
    public String getDescription() { return description; }
    public void setDescription(String value) { description = value; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDateTime value) { startsAt = value; }
    public LocalDateTime getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDateTime value) { endsAt = value; }
    public boolean isAllDay() { return allDay; }
    public void setAllDay(boolean value) { allDay = value; }
    public long getVersion() { return version; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant value) { deletedAt = value; }
}
