package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPlaceholderFieldRequest;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPlaceholderFieldResponse;
import com.eqms.entity.ControlledCopyPlaceholderField;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyPlaceholderFieldRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Admin-managed placeholder fields (key/label/active) that DCO fills in free-text when
 * distributing a Controlled Copy — see ControlledCopyPlaceholderField for the full picture.
 * Keys MAY match a built-in placeholder already resolved elsewhere
 * (PublishingTemplatePlaceholderMapperService's static switch-case, plus copyNo/distributionList
 * which ControlledCopyService already fills directly) — registering one is how the admin opts a
 * built-in placeholder into "DCO's entered value overrides the automatic value for that copy".
 */
@Service
public class ControlledCopyPlaceholderFieldService {

    private static final Pattern KEY_PATTERN = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_]*$");

    private final ControlledCopyPlaceholderFieldRepository repository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;

    public ControlledCopyPlaceholderFieldService(
            ControlledCopyPlaceholderFieldRepository repository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService
    ) {
        this.repository = repository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
    }

    // Deliberately no permission gate: field label/key/description is non-sensitive reference
    // metadata read by the ordinary "Print Controlled Copy" flow (any user with print rights)
    // to render its placeholder-value form, not just the Settings admin screen. Gating it behind
    // settings.controlled_copy_policy.view silently broke that print flow for every user never
    // separately granted Settings access -- the FE swallows the failure and shows an empty form.
    @Transactional(readOnly = true)
    public List<ControlledCopyPlaceholderFieldResponse> list() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public ControlledCopyPlaceholderFieldResponse create(ControlledCopyPlaceholderFieldRequest request) {
        requireManageAccess();
        ControlledCopyPlaceholderField field = new ControlledCopyPlaceholderField();
        applyRequest(field, request);
        ControlledCopyPlaceholderField saved = repository.save(field);
        auditTrailService.logSafely("SETTINGS", saved.getLabel(), saved.getId(), "CONTROLLED_COPY_PLACEHOLDER_FIELD_CREATED", null, null,
                "Controlled Copy placeholder field created: " + saved.getLabel() + " (" + saved.getFieldKey() + ")");
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id, ControlledCopyPlaceholderFieldRequest request) {
        requireManageAccess();
        ControlledCopyPlaceholderField field = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Placeholder field not found"));
        repository.delete(field);
        auditTrailService.logSafely("SETTINGS", field.getLabel(), field.getId(), "CONTROLLED_COPY_PLACEHOLDER_FIELD_DELETED", null, null,
                "Controlled Copy placeholder field deleted: " + field.getLabel() + " (" + field.getFieldKey() + ")");
    }

    private void applyRequest(ControlledCopyPlaceholderField field, ControlledCopyPlaceholderFieldRequest request) {
        if (!StringUtils.hasText(request.label())) {
            throw new IllegalArgumentException("Label is required");
        }
        String key = request.fieldKey() == null ? "" : request.fieldKey().trim();
        if (!KEY_PATTERN.matcher(key).matches()) {
            throw new IllegalArgumentException("Key must start with a letter and contain only letters, numbers, or underscores");
        }
        if (repository.findByFieldKeyIgnoreCase(key).isPresent()) {
            throw new IllegalArgumentException("A placeholder field with this key already exists");
        }
        if (ControlledCopyPlaceholderValueBuilder.isReserved(key)) {
            throw new IllegalArgumentException("\"" + key + "\" is filled in automatically by the system for every Controlled Copy and cannot be used as a custom field");
        }
        if (key.length() > 60) {
            throw new IllegalArgumentException("Key must be at most 60 characters");
        }
        if (request.label().trim().length() > 120) {
            throw new IllegalArgumentException("Label must be at most 120 characters");
        }
        if (request.description() != null && request.description().length() > 255) {
            throw new IllegalArgumentException("Description must be at most 255 characters");
        }
        field.setFieldKey(key);
        field.setLabel(request.label().trim());
        field.setDescription(request.description());
        field.setActive(request.active() == null || request.active());
    }

    private ControlledCopyPlaceholderFieldResponse toResponse(ControlledCopyPlaceholderField field) {
        return new ControlledCopyPlaceholderFieldResponse(
                field.getId().toString(), field.getFieldKey(), field.getLabel(), field.getDescription(), field.isActive());
    }

    private UserAccount requireManageAccess() {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasAnyPermission(user,
                "documents.admin.controlled_copies_policy.manage", "settings.configuration.manage");
        if (!allowed) {
            throw new AccessDeniedException("Access denied");
        }
        return user;
    }
}
