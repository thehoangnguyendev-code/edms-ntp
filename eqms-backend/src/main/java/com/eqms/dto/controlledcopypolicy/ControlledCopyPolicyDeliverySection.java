package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyDeliverySection(
        Boolean redirectDeliveryToDco,
        String dcoRecipientUserId,
        String dcoRecipientName,
        String dcoRecipientEmail,
        // False when redirectDeliveryToDco is on but the assigned user no longer holds the
        // required permission (revoked after this policy was saved, account deactivated, etc.) --
        // lets the FE warn the admin proactively instead of only finding out when a distribute
        // silently falls back to normal delivery.
        Boolean dcoRecipientEligible
) {}
