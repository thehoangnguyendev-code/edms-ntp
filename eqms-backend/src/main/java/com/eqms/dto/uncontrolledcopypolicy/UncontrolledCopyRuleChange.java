package com.eqms.dto.uncontrolledcopypolicy;

import java.time.Instant;
import java.util.UUID;

/** null id creates a rule; existing changes require the timestamp read by the editor. */
public record UncontrolledCopyRuleChange(UUID id, Instant expectedUpdatedAt, boolean delete,
        UUID documentTypeId, boolean allowed, boolean active) {}
