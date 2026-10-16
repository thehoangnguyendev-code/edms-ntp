package com.eqms.service;

import com.eqms.entity.DocumentRecord;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * When a Document counts as expired. Owner decision DOCUMENT-EXPIRY-2026-10-16: the expiry instant
 * is the start of the document's Valid Until day, in the server zone (the same convention controlled
 * copy expiry already uses). A document without a Valid Until date never expires here.
 */
public final class DocumentExpiryRules {

    private DocumentExpiryRules() {
    }

    public static boolean isExpired(DocumentRecord document, Instant now) {
        if (document == null || now == null) {
            return false;
        }
        LocalDate validUntil = document.getValidUntil();
        if (validUntil == null) {
            return false;
        }
        return !now.isBefore(expiryInstant(validUntil));
    }

    public static Instant expiryInstant(LocalDate validUntil) {
        return validUntil.atStartOfDay(ZoneId.systemDefault()).toInstant();
    }
}
