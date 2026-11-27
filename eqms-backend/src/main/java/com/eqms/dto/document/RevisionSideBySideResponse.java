package com.eqms.dto.document;

import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.UUID;

/** The two read-only viewers of the side-by-side comparison. {@code sourceChecksum} lets the screen notice that a file was saved again. */
public record RevisionSideBySideResponse(Pane baseline, Pane current) {
    public record Pane(UUID revisionId, String revisionNumber, String statusCode, String sourceChecksum, ObjectNode config) {
    }
}
