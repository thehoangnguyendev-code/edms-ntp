package com.eqms.dto.dashboard;

import java.util.UUID;

/** Number of Documents in one lifecycle status for one Document Type, as used by the dashboard breakdowns. */
public record DashboardDocumentTypeCountResponse(
        UUID typeId,
        String shortCode,
        String name,
        long documents
) {
}
