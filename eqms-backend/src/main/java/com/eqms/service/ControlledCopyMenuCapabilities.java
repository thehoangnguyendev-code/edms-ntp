package com.eqms.service;

import com.eqms.dto.document.ControlledCopyDistributionBatchSummaryResponse;
import com.eqms.dto.document.ControlledCopyListItemResponse;
import com.eqms.dto.security.ControlledCopyActionCapabilitiesResponse;
import com.eqms.dto.user.PageResponse;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.security.access.AccessDeniedException;

/** Decorates only an already-authorized HTTP page; exports/detail responses stay unchanged. */
public final class ControlledCopyMenuCapabilities {
    private ControlledCopyMenuCapabilities() { }

    public static PageResponse<ControlledCopyListItemResponse> copies(
            PageResponse<ControlledCopyListItemResponse> page, ControlledCopyAuthorizationService authorization) {
        return new PageResponse<>(page.data().stream().map(row -> row.withCapabilities(
                decision(() -> authorization.getCopyCapabilities(UUID.fromString(row.id()))))).toList(), page.pagination());
    }

    public static PageResponse<ControlledCopyDistributionBatchSummaryResponse> batches(
            PageResponse<ControlledCopyDistributionBatchSummaryResponse> page, ControlledCopyAuthorizationService authorization) {
        return new PageResponse<>(page.data().stream().map(row -> row.withCapabilities(decision(() -> {
            // The UI represents a singleton batch as its child copy, never as a batch action.
            if (row.quantity() != null && row.quantity() > 1) return authorization.getBatchCapabilities(UUID.fromString(row.id()));
            if (row.primaryControlledCopyId() == null) return null;
            return authorization.getCopyCapabilities(UUID.fromString(row.primaryControlledCopyId()));
        }))).toList(), page.pagination());
    }

    private static ControlledCopyActionCapabilitiesResponse decision(Supplier<ControlledCopyActionCapabilitiesResponse> query) {
        try { return query.get(); }
        // A stale/deleted/legacy row may remain visible as metadata but never gains an action.
        catch (AccessDeniedException | IllegalArgumentException unavailable) { return null; }
    }
}
