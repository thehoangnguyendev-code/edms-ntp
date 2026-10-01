package com.eqms.dto.executedrecord;

/** {@code kind} is "DESIGN" or "FILL". {@code roleName} applies to FILL only -- which OnlyOffice
 *  Form Role this session is being started for (null if the Form has no roles configured).
 *  {@code acknowledgeStaleContent} applies to DESIGN only -- confirms overwriting a field layout
 *  that predates a later content edit (see EformEditSessionService#startDesignSession). */
public record StartEformSessionRequest(String kind, String roleName, boolean acknowledgeStaleContent) {
}
