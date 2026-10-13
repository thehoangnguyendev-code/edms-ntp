package com.eqms.controller;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * The audit trail stores every record against an entity id, and that column is not nullable. Backup objects that have no row id of their
 * own (an alert, a recipient, a drill, a rebuild-kit item) get a stable id derived from their kind and key, so that their history groups
 * together and the record is never dropped for a missing id.
 */
final class BackupAuditIds {

    private BackupAuditIds() {
    }

    static UUID of(String kind, String key) {
        return UUID.nameUUIDFromBytes((kind + ":" + key).getBytes(StandardCharsets.UTF_8));
    }
}
