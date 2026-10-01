package com.eqms.dto.executedrecord;

import java.util.List;

/** Replaces this one electronic Controlled Copy's entire signer-assignment set -- configured by
 *  the DCO at the Ready for Distribution step, before clicking Distribute. {@code sequence} is
 *  the signing order; need not be contiguous, just distinct. */
public record UpdateEformSignerAssignmentsRequest(List<Item> assignments) {
    public record Item(String roleName, String assignedUserId, int sequence) {
    }
}
