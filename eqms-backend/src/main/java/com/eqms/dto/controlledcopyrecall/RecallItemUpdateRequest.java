package com.eqms.dto.controlledcopyrecall;

/**
 * Review-step change to one scan: leave it out of the recall ({@code excluded}), or identify the copy by number when the
 * QR code could not be read ({@code copyNumber}, with {@code pageNumber} for a single loose page: which page of that copy it is); {@code clearMatch} removes a match made by hand. Null fields change nothing.
 */
public record RecallItemUpdateRequest(
        Boolean excluded,
        String copyNumber,
        Boolean clearMatch,
        Integer pageNumber
) {

    public RecallItemUpdateRequest(Boolean excluded, String copyNumber, Boolean clearMatch) {
        this(excluded, copyNumber, clearMatch, null);
    }
}
