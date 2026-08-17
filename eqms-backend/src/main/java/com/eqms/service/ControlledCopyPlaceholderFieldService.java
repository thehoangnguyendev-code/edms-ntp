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

    public ControlledCopyPlaceholderFieldService(
            ControlledCopyPlaceholderFieldRepository repository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService
    ) {
        this.repository = repository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public List<ControlledCopyPlaceholderFieldResponse> list() {
        requireViewAccess();
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public ControlledCopyPlaceholderFieldResponse create(ControlledCopyPlaceholderFieldRequest request) {
        requireManageAccess();
        ControlledCopyPlaceholderField field = new ControlledCopyPlaceholderField();
        applyRequest(field, request);
        ControlledCopyPlaceholderField saved = repository.save(field);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id, ControlledCopyPlaceholderFieldRequest request) {
        requireManageAccess();
        ControlledCopyPlaceholderField field = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Placeholder field not found"));
        repository.delete(field);
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
        field.setFieldKey(key);
        field.setLabel(request.label().trim());
        field.setDescription(request.description());
        field.setActive(request.active() == null || request.active());
    }

    private ControlledCopyPlaceholderFieldResponse toResponse(ControlledCopyPlaceholderField field) {
        return new ControlledCopyPlaceholderFieldResponse(
                field.getId().toString(), field.getFieldKey(), field.getLabel(), field.getDescription(), field.isActive());
    }

    private void requireViewAccess() {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.view")
                || permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.manage")
                || permissionEvaluationService.isSuperAdmin(user);
        if (!allowed) {
            throw new AccessDeniedException("Access denied");
        }
    }

    private UserAccount requireManageAccess() {
        UserAccount user = currentUserService.requireCurrentUser();
        boolean allowed = permissionEvaluationService.hasPermission(user, "settings.controlled_copy_policy.manage")
                || permissionEvaluationService.isSuperAdmin(user);
        if (!allowed) {
            throw new AccessDeniedException("Access denied");
        }
        return user;
    }
}
