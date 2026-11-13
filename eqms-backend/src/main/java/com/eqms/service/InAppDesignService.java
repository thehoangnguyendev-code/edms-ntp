package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.InAppDesign;
import com.eqms.entity.UserAccount;
import com.eqms.repository.InAppDesignRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * The shared look of every toast, set once in the Notifications Administration like the email design. Reading never fails: with no row the defaults are used.
 * Changing it is validated, refused when someone else saved first, and written to the Audit Trail with the value before and after.
 */
@Service
public class InAppDesignService {

    /** Machine values only; the screen owns the labels. */
    public static final Set<String> POSITIONS = Set.of("center", "top-center", "bottom-center", "top-right", "top-left", "bottom-right", "bottom-left");
    public static final String DEFAULT_POSITION = "top-right";
    public static final int DEFAULT_SECONDS = 5, MIN_SECONDS = 2, MAX_SECONDS = 60;
    /** A six-digit hex colour: it is put in a style attribute, so nothing else is accepted. */
    public static final String DEFAULT_COLOR = "#3B82F6";
    public static final int DEFAULT_SHADOW = 40, MAX_SHADOW = 100;
    private static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");

    public record Change(String toastPosition, int toastDurationSeconds, String toastColor, int toastShadow) {
    }

    private final InAppDesignRepository repository;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;

    public InAppDesignService(InAppDesignRepository repository, AuditTrailService auditTrailService, CurrentUserService currentUserService) {
        this.repository = repository;
        this.auditTrailService = auditTrailService;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public InAppDesign current() {
        return repository.findAll().stream().findFirst().orElseGet(InAppDesign::new);
    }

    @Transactional
    public InAppDesign update(Change change) {
        return update(change, null);
    }

    /** {@code expectedVersion} is the version of the design as the person saw it when they opened it; when another change was saved since, this one is refused. Empty skips the check. */
    @Transactional
    @CacheEvict(cacheNames = "public-branding", allEntries = true)
    public InAppDesign update(Change change, Integer expectedVersion) {
        UserAccount actor = currentUserService.requireCurrentUser();
        validate(change);
        InAppDesign design = repository.lockCurrent().orElseGet(() -> {
            InAppDesign created = new InAppDesign();
            created.setId(UUID.randomUUID());
            return created;
        });
        if (expectedVersion != null && expectedVersion != design.getVersion()) {
            throw new IllegalStateException("This was changed by someone else after you opened it. Reload it to see their change, then make yours again.");
        }
        String color = change.toastColor().toUpperCase();
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        diff(changes, "Toast colour", design.getToastColor(), color, !Objects.equals(design.getToastColor(), color));
        diff(changes, "Toast shadow", String.valueOf(design.getToastShadow()), String.valueOf(change.toastShadow()), design.getToastShadow() != change.toastShadow());
        diff(changes, "Toast position", design.getToastPosition(), change.toastPosition(), !Objects.equals(design.getToastPosition(), change.toastPosition()));
        diff(changes, "Toast display time (seconds)", String.valueOf(design.getToastDurationSeconds()), String.valueOf(change.toastDurationSeconds()), design.getToastDurationSeconds() != change.toastDurationSeconds());
        if (changes.isEmpty()) {
            return design;
        }
        design.setToastColor(color);
        design.setToastShadow(change.toastShadow());
        design.setToastPosition(change.toastPosition());
        design.setToastDurationSeconds(change.toastDurationSeconds());
        design.setVersion(design.getVersion() + 1);
        design.setUpdatedBy(actor.getUsername());
        design.setUpdatedAt(Instant.now());
        InAppDesign saved = repository.save(design);
        auditTrailService.logAs(actor, "IN_APP_DESIGN", "In-app notification design", saved.getId(), "UPDATE", null, null,
                "The in-app notification design was changed to version " + saved.getVersion(), changes);
        return saved;
    }

    public static void validate(Change change) {
        if (change == null) throw new IllegalArgumentException("The in-app notification design is required");
        if (change.toastPosition() == null || !POSITIONS.contains(change.toastPosition())) {
            throw new IllegalArgumentException("The toast position must be one of " + new java.util.TreeSet<>(POSITIONS));
        }
        if (change.toastDurationSeconds() < MIN_SECONDS || change.toastDurationSeconds() > MAX_SECONDS) {
            throw new IllegalArgumentException("The toast display time must be a whole number of seconds from " + MIN_SECONDS + " to " + MAX_SECONDS);
        }
        if (change.toastColor() == null || !HEX.matcher(change.toastColor()).matches()) {
            throw new IllegalArgumentException("The toast colour must be written as #RRGGBB");
        }
        if (change.toastShadow() < 0 || change.toastShadow() > MAX_SHADOW) {
            throw new IllegalArgumentException("The toast shadow must be a whole number from 0 to " + MAX_SHADOW);
        }
    }

    private static void diff(List<AuditTrailChangeResponse> out, String field, String before, String after, boolean changed) {
        if (changed) out.add(new AuditTrailChangeResponse(field, before, after));
    }
}
