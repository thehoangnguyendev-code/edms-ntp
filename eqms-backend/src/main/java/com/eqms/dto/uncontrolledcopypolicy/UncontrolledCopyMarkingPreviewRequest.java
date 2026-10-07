package com.eqms.dto.uncontrolledcopypolicy;

import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;

/**
 * What an administrator is looking at on the Uncontrolled Copies Policy's PDF Markings tab: the DRAFT marking being edited
 * (not yet saved, including drag-and-drop placements), drawn by the server on a sample paper page.
 * The response is {@link com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewResponse} (same shape as Controlled Copy).
 */
public record UncontrolledCopyMarkingPreviewRequest(
        /** Draft watermark/stamp config; null fields fall back to the stored policy. */
        ControlledCopyStatusMarking marking
) {
}
