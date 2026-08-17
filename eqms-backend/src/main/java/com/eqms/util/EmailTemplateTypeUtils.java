package com.eqms.util;

import java.util.Locale;
import java.util.Set;

public final class EmailTemplateTypeUtils {

    public static final String CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION = "controlled-copy-distribution-notification";
    // Sent to the original requester instead of CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION when the
    // Controlled Copies Policy redirects delivery to the DCO — no preview link/password.
    public static final String CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION_NO_ACCESS = "controlled-copy-distribution-no-access";
    // Sent once to the DCO after a distribution batch finishes, with a ZIP of every copy attached.
    public static final String CONTROLLED_COPY_BATCH_DISTRIBUTION_DCO_ZIP = "controlled-copy-batch-distribution-dco-zip";
    public static final String CONTROLLED_COPY_NOTIFICATION = "controlled-copy-notification";
    public static final String CONTROLLED_COPY_CANCELLATION_NOTIFICATION = "controlled-copy-cancellation-notification";
    public static final String CONTROLLED_COPY_RECALL_NOTIFICATION = "controlled-copy-recall-notification";
    public static final String DOCUMENT_EDIT_ONLINE_NOTIFICATION = "document-edit-online-notification";
    public static final String DOCUMENT_READY_FOR_PUBLISHING_NOTIFICATION = "document-ready-for-publishing";
    // T-P1-4 (F-08/Q1): Author completed editing — Document Control (DCO) is notified to
    // check the revision and submit it for review.
    public static final String DOCUMENT_READY_FOR_SUBMISSION_NOTIFICATION = "document-ready-for-submission";
    // T-P1-4 (F-08/Q1): DCO cancelled a revision (e.g. content issue found while checking it)
    // — the Author/Co-Author are notified why, since D-5 uses CANCEL as the only way back.
    public static final String DOCUMENT_REVISION_CANCELLED_NOTIFICATION = "document-revision-cancelled";

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "password-reset",
            "user-welcome",
            "account-activation",
            "document-review",
            "document-approval",
            "document-publish",
            DOCUMENT_READY_FOR_PUBLISHING_NOTIFICATION,
            DOCUMENT_READY_FOR_SUBMISSION_NOTIFICATION,
            DOCUMENT_REVISION_CANCELLED_NOTIFICATION,
            DOCUMENT_EDIT_ONLINE_NOTIFICATION,
            "training-notification",
            "audit-notification",
            "complaint-notification",
            "deviation-notification",
            "change-control-notification",
            CONTROLLED_COPY_NOTIFICATION,
            CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION,
            CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION_NO_ACCESS,
            CONTROLLED_COPY_BATCH_DISTRIBUTION_DCO_ZIP,
            "preference-notification",
            "supplier-notification",
            "equipment-maintenance",
            "report-generation",
            "system-maintenance",
            "custom"
    );

    private EmailTemplateTypeUtils() {
    }

    public static String normalize(String type) {
        if (type == null) {
            return null;
        }
        String normalized = type.trim().toLowerCase(Locale.ROOT).replace(' ', '-').replace('_', '-');
        if ("controlled-copy-distribution-notification".equals(normalized)) {
            return CONTROLLED_COPY_DISTRIBUTION_NOTIFICATION;
        }
        if ("controlled-copy-notification".equals(normalized)) {
            return CONTROLLED_COPY_NOTIFICATION;
        }
        if ("controlled-copy-cancellation-notification".equals(normalized)) {
            return CONTROLLED_COPY_CANCELLATION_NOTIFICATION;
        }
        if ("controlled-copy-recall-notification".equals(normalized)) {
            return CONTROLLED_COPY_RECALL_NOTIFICATION;
        }
        if ("document-edit-online-notification".equals(normalized)) {
            return DOCUMENT_EDIT_ONLINE_NOTIFICATION;
        }
        return normalized;
    }

    public static boolean isAllowed(String type) {
        String normalized = normalize(type);
        return normalized != null && ALLOWED_TYPES.contains(normalized);
    }
}
