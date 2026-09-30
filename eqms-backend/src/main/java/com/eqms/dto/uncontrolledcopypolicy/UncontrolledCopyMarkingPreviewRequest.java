package com.eqms.dto.uncontrolledcopypolicy;

import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;

/**
 * What an administrator is looking at on the Uncontrolled Copies Policy's PDF Markings tab: the DRAFT marking being edited
 * (not yet saved, including drag-and-drop placements), drawn by the server on a page of the chosen Publishing Template.
 * The response is {@link com.eqms.dto.controlledcopypolicy.ControlledCopyMarkingPreviewResponse} (same shape as Controlled Copy).
 */
public record UncontrolledCopyMarkingPreviewRequest(
        /** Publishing Template to take the page from; blank = the first active template. */
        String templateId,
        /** portrait | landscape */
        String layout,
        /** COVER (page 1) | BODY (page 2 onwards) */
        String pageKind,
        /** Draft watermark/stamp config; null fields fall back to the stored policy. */
        ControlledCopyStatusMarking marking
) {
}
