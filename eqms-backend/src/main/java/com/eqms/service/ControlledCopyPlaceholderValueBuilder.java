package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The placeholder values that are printed on a Controlled Copy and computed by the server from the copy's own record.
 * They identify the copy and its recipient, so they are reserved: a value typed in by a user (custom placeholder field)
 * can never replace or shadow one of them.
 *
 * <p>The recipient's details are captured once, when the copy is distributed, and stored on the copy
 * ({@code recipient_snapshot}). Later changes to the user's profile therefore never alter what was printed, and the
 * printed PDF can be reproduced from the record.</p>
 */
@Component
public class ControlledCopyPlaceholderValueBuilder {

    /** Marker put in the value map so the renderer knows a controlled copy (not a publication) is being composed. */
    public static final String CONTEXT_KEY = "__context";
    public static final String CONTEXT_CONTROLLED_COPY = "CONTROLLED_COPY";

    /** Lower-case keys the server owns. */
    public static final Set<String> RESERVED_KEYS = Set.of(
            "copyno", "copy_no", "totalcopies", "distributionlist", "distribution_list",
            "recipientname", "recipientemail", "recipientjobtitle", "recipientdepartment",
            "copyexpirydate", "distributedby", "distributiondate", "requestedby", "requestpurpose", "copylocation",
            CONTEXT_KEY);

    private final ObjectMapper objectMapper;

    public ControlledCopyPlaceholderValueBuilder(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public static boolean isReserved(String key) {
        return key != null && RESERVED_KEYS.contains(key.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * Returns the stored snapshot, capturing it first if this copy does not have one yet. An external recipient is
     * identified by the e-mail address only.
     */
    public JsonNode captureRecipientSnapshotIfAbsent(ControlledCopyRecord copy) {
        JsonNode existing = copy.getRecipientSnapshot();
        if (existing != null && !existing.isNull() && !existing.isEmpty()) {
            return existing;
        }
        ObjectNode snapshot = buildRecipientSnapshot(copy);
        copy.setRecipientSnapshot(snapshot);
        return snapshot;
    }

    /** The stored snapshot when there is one, otherwise what would be captured now -- without storing anything (previews). */
    public JsonNode recipientSnapshotForPreview(ControlledCopyRecord copy) {
        JsonNode existing = copy.getRecipientSnapshot();
        return existing != null && !existing.isNull() && !existing.isEmpty() ? existing : buildRecipientSnapshot(copy);
    }

    private ObjectNode buildRecipientSnapshot(ControlledCopyRecord copy) {
        ObjectNode snapshot = objectMapper.createObjectNode();
        UserAccount user = copy.getRecipientUser();
        if (user != null) {
            snapshot.put("source", "INTERNAL");
            snapshot.put("userId", user.getId() == null ? "" : user.getId().toString());
            snapshot.put("name", nullToEmpty(user.getFullName()));
            snapshot.put("email", nullToEmpty(user.getEmail()));
            snapshot.put("jobTitle", nullToEmpty(user.getPosition()));
            snapshot.put("department", nullToEmpty(user.getDepartment()));
            snapshot.put("businessUnit", nullToEmpty(user.getBusinessUnit()));
        } else {
            String email = firstNonBlank(copy.getExternalRecipients(), copy.getRecipientName());
            snapshot.put("source", "EXTERNAL");
            snapshot.put("name", email);
            snapshot.put("email", email);
            snapshot.put("jobTitle", "");
            snapshot.put("department", "");
            snapshot.put("businessUnit", "");
        }
        snapshot.put("capturedAt", Instant.now().toString());
        return snapshot;
    }

    /** Values keyed by their placeholder name; the context marker tells the renderer this is a controlled copy. */
    public Map<String, String> build(ControlledCopyRecord copy, JsonNode recipient, String shortCopyNumber) {
        String name = text(recipient, "name");
        Map<String, String> values = new LinkedHashMap<>();
        values.put(CONTEXT_KEY, CONTEXT_CONTROLLED_COPY);
        values.put("copyNo", nullToEmpty(shortCopyNumber));
        values.put("totalCopies", String.valueOf(Math.max(copy.getTotalCopies(), 1)));
        values.put("distributionList", name);
        values.put("recipientName", name);
        values.put("recipientEmail", text(recipient, "email"));
        values.put("recipientJobTitle", text(recipient, "jobTitle"));
        values.put("recipientDepartment", text(recipient, "department"));
        values.put("copyExpiryDate", copy.getValidUntil() == null ? "-" : DateTimeFormatUtils.formatDate(copy.getValidUntil()));
        values.put("distributedBy", copy.getDistributedBy() != null ? nullToEmpty(copy.getDistributedBy().getFullName())
                : copy.getRequestedBy() == null ? "" : nullToEmpty(copy.getRequestedBy().getFullName()));
        values.put("distributionDate", DateTimeFormatUtils.formatDate(java.time.LocalDate.now()));
        values.put("requestedBy", copy.getRequestedBy() == null ? "" : nullToEmpty(copy.getRequestedBy().getFullName()));
        values.put("requestPurpose", nullToEmpty(copy.getRequestReason()));
        values.put("copyLocation", nullToEmpty(copy.getLocation()));
        return values;
    }

    private static String text(JsonNode node, String field) {
        return node == null ? "" : node.path(field).asText("");
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return "";
    }
}
