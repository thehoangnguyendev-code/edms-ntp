package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.StorageUsageSnapshotService;
import com.eqms.service.StorageUsagePolicyService;
import com.eqms.entity.UserAccount;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.List;
import java.math.BigInteger;

@RestController
@RequestMapping("/settings/storage-usage")
public class StorageUsageController {
    private final StorageUsageSnapshotService service;
    private final CurrentUserService current;
    private final PermissionEvaluationService permissions;
    private final StorageUsagePolicyService policies;

    public StorageUsageController(StorageUsageSnapshotService service, CurrentUserService current, PermissionEvaluationService permissions, StorageUsagePolicyService policies) {
        this.service = service;
        this.current = current;
        this.permissions = permissions;
        this.policies = policies;
    }

    private UserAccount requireManager() {
        var user = current.requireCurrentUser();
        if (!permissions.hasPermission(user, "settings.configuration.manage")) throw new AccessDeniedException("Permission required");
        return user;
    }

    @GetMapping
    public List<StorageUsageSnapshotService.Snapshot> history() {
        requireManager();
        return service.history();
    }

    @GetMapping("/policy")
    public StorageUsagePolicyService.Policy policy() {
        requireManager();
        return policies.get();
    }

    @PutMapping("/policy")
    public StorageUsagePolicyService.Policy savePolicy(@RequestBody StorageUsagePolicyService.Policy policy) {
        return policies.save(requireManager(), policy);
    }

    public record Status(StorageUsagePolicyService.Policy policy, StorageUsageSnapshotService.Snapshot latest,
                         Boolean warning, StorageUsageSnapshotService.ScanState scanState) {}

    @GetMapping("/status")
    public Status status() {
        requireManager();
        var policy = policies.get();
        var latest = service.history().stream().findFirst().orElse(null);
        Boolean warning = policy.budgetBytes() == null || latest == null ? null
                : com.eqms.service.StorageUsageAlertService.reached(latest.totalBytes(), policy.budgetBytes(), policy.warningPercent());
        return new Status(policy, latest, warning, service.scanState());
    }
}
