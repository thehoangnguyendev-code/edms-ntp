package com.eqms.service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * The Vietnamese of the fixed words the server puts into placeholders (the name of an action, a status, a kind). It is used only to render a Vietnamese wording:
 * the values kept with the notification, its address and everything the server decides on stay as they were. Only a value that is exactly one of these words is
 * replaced; a sentence composed in code, a name, and text a person typed are never touched.
 */
public final class NotificationValueWords {

    private NotificationValueWords() {}

    /** Actions of the Audit Trail, by their code; the English words are {@code AuditNotificationBridge.titleOf(code)}. */
    static final Map<String, String> ACTIONS = Map.ofEntries(
            Map.entry("ACCESS_PROFILE_CREATED", "Đã tạo hồ sơ phân quyền"),
            Map.entry("ACCESS_PROFILE_DELETED", "Đã xoá hồ sơ phân quyền"),
            Map.entry("ACCESS_PROFILE_PERMISSIONS_REPLACED", "Đã thay quyền của hồ sơ phân quyền"),
            Map.entry("ACCESS_PROFILE_PERMISSION_SETS_REPLACED", "Đã thay bộ quyền của hồ sơ phân quyền"),
            Map.entry("ACCESS_PROFILE_USER_ASSIGNED", "Đã gán người dùng vào hồ sơ phân quyền"),
            Map.entry("ACCESS_PROFILE_USER_REMOVED", "Đã gỡ người dùng khỏi hồ sơ phân quyền"),
            Map.entry("ACCESS_PROFILE_WORKFLOW_ROLES_REPLACED", "Đã thay vai trò quy trình của hồ sơ phân quyền"),
            Map.entry("ACCESS_REVIEW_CAMPAIGN_CANCELLED", "Đã huỷ đợt rà soát quyền truy cập"),
            Map.entry("ACCESS_REVIEW_CAMPAIGN_COMPLETED", "Đã hoàn tất đợt rà soát quyền truy cập"),
            Map.entry("ACCESS_REVIEW_CAMPAIGN_CREATED", "Đã tạo đợt rà soát quyền truy cập"),
            Map.entry("APPROVE", "Đã phê duyệt"),
            Map.entry("AUDIT_TRAIL_REVIEW_CAMPAIGN_CANCELLED", "Đã huỷ đợt rà soát nhật ký kiểm toán"),
            Map.entry("AUDIT_TRAIL_REVIEW_CAMPAIGN_CREATED", "Đã tạo đợt rà soát nhật ký kiểm toán"),
            Map.entry("BACKUP_EXPORT_APPROVAL_REFUSED", "Phê duyệt xuất bản sao lưu bị từ chối"),
            Map.entry("BACKUP_EXPORT_APPROVED", "Đã phê duyệt xuất bản sao lưu"),
            Map.entry("BACKUP_EXPORT_REQUESTED", "Đã yêu cầu xuất bản sao lưu"),
            Map.entry("BACKUP_POLICY_ACTIVATED", "Đã kích hoạt chính sách sao lưu"),
            Map.entry("BACKUP_POLICY_ACTIVATION_REFUSED", "Kích hoạt chính sách sao lưu bị từ chối"),
            Map.entry("BACKUP_POLICY_PROPOSED", "Đã đề xuất chính sách sao lưu"),
            Map.entry("CANCEL", "Đã huỷ"),
            Map.entry("CREATED", "Đã tạo"),
            Map.entry("DELETED", "Đã xoá"),
            Map.entry("DELETE_BLOCKED_BY_RETENTION", "Không xoá được vì còn thời hạn lưu giữ"),
            Map.entry("DISTRIBUTE_PROCESSING_FAILED", "Xử lý phân phối thất bại"),
            Map.entry("DOCUMENT_NUMBER_CHANGED", "Đã đổi số tài liệu"),
            Map.entry("EDITING_LOCKED", "Đã khoá chỉnh sửa"),
            Map.entry("ELECTRONIC_SIGNATURE_SETTINGS_UPDATED", "Đã cập nhật cấu hình chữ ký điện tử"),
            Map.entry("EXPIRE", "Đã hết hạn"),
            Map.entry("EXPORT", "Đã xuất dữ liệu"),
            Map.entry("INSPECTION_APPROVED", "Đã phê duyệt kiểm tra"),
            Map.entry("INSPECTION_REQUESTED", "Đã yêu cầu kiểm tra"),
            Map.entry("LEGACY_IMPORT_EFFECTIVE", "Tài liệu nhập từ dữ liệu cũ đã có hiệu lực"),
            Map.entry("PRODUCTION_RESTORE_FINALIZED", "Đã chốt phục hồi hệ thống chính thức"),
            Map.entry("PRODUCTION_RESTORE_FINALIZED_REFUSED", "Chốt phục hồi hệ thống chính thức bị từ chối"),
            Map.entry("PRODUCTION_RESTORE_REFUSED", "Phục hồi hệ thống chính thức bị từ chối"),
            Map.entry("PRODUCTION_RESTORE_REQUESTED", "Đã yêu cầu phục hồi hệ thống chính thức"),
            Map.entry("PUBLISHING_PACKAGE_FAILED", "Đóng gói ban hành thất bại"),
            Map.entry("REFRESH_TOKEN_REUSE_DETECTED", "Phát hiện mã phiên bị dùng lại"),
            Map.entry("REISSUE_REQUESTED", "Đã yêu cầu cấp lại"),
            Map.entry("REPLACE_LOST_DAMAGED", "Đã cấp thay bản mất hoặc hỏng"),
            Map.entry("REPORT_APPEARANCE_UPDATED", "Đã cập nhật giao diện báo cáo"),
            Map.entry("REPORT_DAMAGED", "Đã báo hỏng"),
            Map.entry("REPORT_LOST", "Đã báo mất"),
            Map.entry("REPORT_PROPERTIES_UPDATED", "Đã cập nhật thuộc tính báo cáo"),
            Map.entry("REPORT_TEMPLATE_APPROVED", "Đã phê duyệt mẫu báo cáo"),
            Map.entry("REPORT_TEMPLATE_DISABLED", "Đã tắt mẫu báo cáo"),
            Map.entry("REPORT_TEMPLATE_ENABLED", "Đã bật mẫu báo cáo"),
            Map.entry("REPORT_TEMPLATE_REJECTED", "Đã từ chối mẫu báo cáo"),
            Map.entry("REPORT_TEMPLATE_SUBMITTED", "Đã trình mẫu báo cáo"),
            Map.entry("REPORT_TYPE_DISABLED", "Đã tắt loại báo cáo"),
            Map.entry("REPORT_TYPE_ENABLED", "Đã bật loại báo cáo"),
            Map.entry("REQUEST", "Đã gửi yêu cầu"),
            Map.entry("RESTORE_APPROVAL_REFUSED", "Phê duyệt phục hồi bị từ chối"),
            Map.entry("RESTORE_APPROVED", "Đã phê duyệt phục hồi"),
            Map.entry("RESTORE_CANCELLED", "Đã huỷ phục hồi"),
            Map.entry("RESTORE_REHEARSAL_REQUESTED", "Đã yêu cầu diễn tập phục hồi"),
            Map.entry("RESTORE_REJECTED", "Đã từ chối phục hồi"),
            Map.entry("RESTORE_REQUESTED", "Đã yêu cầu phục hồi"),
            Map.entry("RESTORE_SCHEDULED", "Đã lên lịch phục hồi"),
            Map.entry("RESTORE_WINDOW_LOCKED", "Đã khoá hệ thống để phục hồi"),
            Map.entry("REVIEW_COMMENT_ADDED", "Đã thêm góp ý rà soát"),
            Map.entry("REVIEW_COMMENT_REPLY_ADDED", "Đã trả lời góp ý rà soát"),
            Map.entry("REVIEW_COMMENT_RESOLVED", "Đã xử lý góp ý rà soát"),
            Map.entry("REVOKED", "Đã thu hồi"),
            Map.entry("SHAREPOINT_LINK_RECREATED", "Đã tạo lại liên kết SharePoint"),
            Map.entry("SHAREPOINT_LINK_RESTORED", "Đã khôi phục liên kết SharePoint"),
            Map.entry("SHAREPOINT_LINK_REVOKED", "Đã thu hồi liên kết SharePoint"),
            Map.entry("STORE_SCRUB_STARTED", "Đã bắt đầu kiểm tra toàn vẹn kho"),
            Map.entry("SYSTEM_CONFIGURATION_UPDATED", "Đã cập nhật cấu hình hệ thống"),
            Map.entry("TIME_LIMITED_USER_GRANT_CANCELLED", "Đã huỷ quyền truy cập có thời hạn"),
            Map.entry("TIME_LIMITED_USER_GRANT_CREATED", "Đã cấp quyền truy cập có thời hạn"),
            Map.entry("TIME_LIMITED_USER_GRANT_UPDATED", "Đã cập nhật quyền truy cập có thời hạn"),
            Map.entry("UPDATED", "Đã cập nhật"),
            Map.entry("UPLOAD_EVIDENCE", "Đã tải bằng chứng lên"),
            Map.entry("USER_CREATED", "Đã tạo người dùng"),
            Map.entry("USER_REINSTATED", "Đã khôi phục người dùng"),
            Map.entry("WORKFLOW_ACTION_POLICY_ACTIVATED", "Đã kích hoạt chính sách thao tác quy trình"),
            Map.entry("WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED", "Đã cập nhật liên kết của chính sách thao tác quy trình"));

    /** Statuses of documents, revisions and controlled copies, by their English label. */
    private static final Map<String, String> STATUSES = Map.of(
            "Draft", "Bản nháp", "Active", "Đang hoạt động", "Pending Review", "Chờ rà soát", "Pending Approval", "Chờ phê duyệt",
            "Pending Training", "Chờ đào tạo", "Ready for Publishing", "Sẵn sàng ban hành", "Effective", "Đang hiệu lực",
            "Obsoleted", "Hết hiệu lực", "Closed - Cancelled", "Đã đóng - Huỷ");
    private static final Map<String, String> COPY_STATUSES = Map.of(
            "Ready for Distribution", "Sẵn sàng phân phối", "Distributed", "Đã phân phối", "Obsoleted", "Hết hiệu lực", "Closed - Cancelled", "Đã đóng - Huỷ");

    /** What happened in a document or controlled-copy workflow: the words made in EmailNotificationService, and the codes some senders pass as they are. */
    private static final Map<String, String> WORKFLOW_ACTIONS = Map.ofEntries(
            Map.entry("Submitted for Review", "Đã trình rà soát"), Map.entry("Resubmitted for Review", "Đã trình lại để rà soát"),
            Map.entry("Review Completed", "Đã rà soát xong"), Map.entry("Review Rejected", "Từ chối khi rà soát"),
            Map.entry("Approval Completed", "Đã phê duyệt xong"), Map.entry("Approval Rejected", "Từ chối khi phê duyệt"),
            Map.entry("Training Completed", "Đã hoàn thành đào tạo"), Map.entry("Reviewer Replaced", "Đã thay người rà soát"),
            Map.entry("Approver Replaced", "Đã thay người phê duyệt"), Map.entry("Published", "Đã ban hành"), Map.entry("Revision File Uploaded", "Đã tải tệp revision lên"),
            Map.entry("Distributed", "Đã phân phối"), Map.entry("Printed", "Đã in"), Map.entry("Recalled", "Đã thu hồi"), Map.entry("Cancelled", "Đã huỷ"),
            Map.entry("Replacement Issued", "Đã cấp thay"), Map.entry("Reported Lost", "Đã báo mất"), Map.entry("Reported Damaged", "Đã báo hỏng"),
            Map.entry("Destroyed", "Đã tiêu huỷ"), Map.entry("Obsoleted", "Hết hiệu lực"), Map.entry("Save Changes", "Lưu thay đổi"),
            Map.entry("DISTRIBUTE", "Phân phối"), Map.entry("CANCEL", "Huỷ"));

    private static final Map<String, String> SESSION_DAYS = Map.of(
            "the day is not announced yet", "chưa thông báo ngày", "the day was not announced", "chưa thông báo ngày");

    /** Placeholder name to the words its value may be. */
    private static final Map<String, Map<String, String>> BY_PLACEHOLDER = placeholders();

    private static Map<String, Map<String, String>> placeholders() {
        Map<String, String> actions = new LinkedHashMap<>();
        ACTIONS.forEach((code, words) -> actions.put(AuditNotificationBridge.titleOf(code, code), words));
        Map<String, String> statuses = new LinkedHashMap<>(STATUSES);
        COPY_STATUSES.forEach(statuses::putIfAbsent);
        Map<String, Map<String, String>> map = new LinkedHashMap<>();
        // the title of a notice of the Audit Trail is the action in words; any other title is a sentence and does not match
        map.put("title", actions);
        map.put("actionName", actions);
        map.put("documentStatus", statuses);
        map.put("revisionStatus", statuses);
        map.put("controlledCopyStatus", COPY_STATUSES);
        map.put("workflowStage", statuses);
        map.put("workflowAction", WORKFLOW_ACTIONS);
        map.put("workflowScope", Map.of("Batch", "Cả lô", "Individual Copy", "Từng bản sao"));
        map.put("participantType", Map.of("reviewer", "người rà soát", "approver", "người phê duyệt"));
        map.put("reviewStatus", Map.of("is overdue for periodic review since", "đã quá hạn rà soát định kỳ từ ngày", "is due for periodic review on", "đến hạn rà soát định kỳ vào ngày"));
        map.put("distributionScope", Map.of("individual", "Cá nhân", "Individual", "Cá nhân", "department", "Bộ phận", "external", "Bên ngoài"));
        map.put("destructionType", Map.of("Lost", "Mất", "Damaged", "Hỏng", "DAMAGED", "Hỏng", "LOST", "Mất"));
        map.put("changeType", Map.of("assigned", "được gán", "removed", "được gỡ"));
        map.put("preferenceName", Map.of("Security settings updated", "Đã cập nhật cấu hình bảo mật"));
        map.put("preferenceSection", Map.of("Security settings updated", "Đã cập nhật cấu hình bảo mật"));
        map.put("actorName", Map.of("The system", "Hệ thống"));
        map.put("sessionDate", SESSION_DAYS);
        map.put("oldDate", SESSION_DAYS);
        return map;
    }

    /** The values of a notification with the fixed words in Vietnamese; the map given is left as it is. */
    public static Map<String, String> vietnamese(Map<String, String> values) {
        Map<String, String> result = new LinkedHashMap<>(values == null ? Map.of() : values);
        result.replaceAll((name, value) -> {
            Map<String, String> words = BY_PLACEHOLDER.get(name);
            return words == null || value == null ? value : words.getOrDefault(value, words.getOrDefault(value.toLowerCase(Locale.ROOT), value));
        });
        return result;
    }
}
