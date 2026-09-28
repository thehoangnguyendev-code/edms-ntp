# Ma trận thiết kế Permission Dependency — bản để review

**Trạng thái:** Bản thiết kế/rà soát, chưa phải hành vi backend đang thực thi.  
**Snapshot catalog:** 25/08/2026, 121 permission runtime.  
**Mục đích giai đoạn hiện tại:** Dùng để duyệt từng nguyên tắc dependency của **Permission Catalog** trước khi code. Hàng có trạng thái **CẦN TRACE** chỉ là giả thuyết có kiểm soát, không được triển khai như fact. Việc áp dụng/enforcement lên Shared Permission Set và Access Profile được tách thành giai đoạn sau, khi mô hình Access Profile đã ổn định.

## 1. Điều đã xác nhận từ source hiện tại

| Nội dung | Kết luận |
|---|---|
| Runtime catalog | Lấy từ bảng **permissions** qua API Permission Catalog. |
| UI Access Profile | Tự thêm một số quyền **.view** cùng prefix, nhưng không model dependency tổng quát/module-level. |
| Shared Permission Set | UI chỉ gửi các code được tick; không tự xử lý dependency. |
| Backend | PermissionSetService.assignPermissions chỉ kiểm tra code tồn tại; chưa validate dependency. |
| Dependency model | Chưa có graph dependency được dùng để validate Permission Set/Access Profile. |

**Evidence:** AccessProfilePermissionsTab.tsx:89-132; PermissionSetFormView.tsx:65-92; PermissionSetService.java:342-371.

## 2. Quan hệ cần hỗ trợ

| Quan hệ | Ý nghĩa | Cách xử lý |
|---|---|---|
| **REQUIRES** | Quyền A cần quyền B để tạo đường truy cập hợp lệ. | Hiện tại chỉ được chốt trong catalog; enforcement theo effective permissions của Access Profile là giai đoạn sau. |
| **IMPLIES** | Cấp A đồng thời cấp capability B. | Backend/UI tính quyền hiệu lực và hiển thị nguồn suy ra. |
| **EXCLUSIVE** | Hai quyền không được cùng có do SoD. | Kiểm soát qua SoD constraint, không phải dependency. |
| **CONTEXTUAL** | Cần object scope, lifecycle, workflow participant hoặc e-signature. | Endpoint/service tiếp tục kiểm tra riêng; dependency không thay thế. |

> Effective permissions = direct grants + Shared Permission Set + quyền suy ra bởi IMPLIES. Đây là mô hình **dự kiến cho giai đoạn Access Profile**, chưa được dùng để chặn cấu hình ở giai đoạn hiện tại. Không được dùng việc FE ẩn menu để bảo vệ API.

## 3. Ma trận rule chi tiết để phê duyệt

| Rule | Áp dụng cho | REQUIRES đề xuất | IMPLIES đề xuất | Trạng thái/lý do |
|---|---|---|---|---|
| DOC-01 | documents.module.view | — | — | CẦN TRACE: entry point Document Control. |
| DOC-02 | documents.document.view | documents.module.view | — | ĐỀ XUẤT: xem record cần vào module. |
| DOC-03 | documents.document.view_all | documents.module.view | documents.document.view | ĐỀ XUẤT: quyền xem rộng bao hàm xem cơ bản. |
| DOC-04 | documents.document.create | documents.module.view | — | CẦN TRACE route tạo mới; không tự giả định cần document.view. |
| DOC-05 | Action Document/Template còn lại | documents.module.view và document.view khi thao tác record có sẵn | — | CẦN TRACE từng endpoint; tách Document Template khỏi Publishing Template. |
| DOC-06 | Cấu hình Revision kế tiếp | documents.module.view, documents.document.view | — | CẦN TRACE ownership/Author và policy riêng. |
| DOC-07 | Tệp/authoring/publish/upgrade/obsolete Revision | documents.module.view, documents.document.view | — | CẦN TRACE; lifecycle/workflow là CONTEXTUAL. |
| DOC-08 | revision.review và revision.reject_review | documents.module.view, documents.document.view | review → reject_review | ĐỀ XUẤT NGHIỆP VỤ — **CẦN DECISION LOG riêng trước khi chuyển APPROVED_BUSINESS_DECISION** (theo mẫu `08_ONE_CHANGE_RECORD_TEMPLATE.md`): IMPLIES ở đây là cấp quyền enforcement thật (Rule 8), không phải chỉ gợi ý UI — xác nhận 2026-08-25 rằng grant "review" sẽ khiến "reject_review" thực sự dùng được mà không cần tick riêng. Bằng chứng gap hiện tại: QUALITY, SUPERVISOR, DOCUMENT_CONTROLLER, REVIEWER_LEAD đang giữ review nhưng không có reject_review. |
| DOC-09 | revision.approve và revision.reject_approval | documents.module.view, documents.document.view | approve → reject_approval | ĐỀ XUẤT NGHIỆP VỤ — **CẦN DECISION LOG riêng trước khi chuyển APPROVED_BUSINESS_DECISION** (theo mẫu `08_ONE_CHANGE_RECORD_TEMPLATE.md`), cùng lý do với DOC-08: IMPLIES là cấp quyền enforcement thật, không phải chỉ gợi ý UI. |
| DOC-10 | revision.force_publish | revision.publish và prerequisite của publish | — | ĐỀ XUẤT: ngoại lệ GMP phải được cấp trực tiếp, không mặc định. |
| DOC-11 | Controlled Copy action/file | documents.module.view, controlled_copy.view | Chưa xác định | CẦN TRACE route Request/Distribute/Recall/Mất-Hỏng. |
| DOC-12 | controlled_copy.receive_as_dco | — | — | ĐỀ XUẤT: eligibility người nhận, không phải UI navigation. |
| DOC-13 | documents.admin.* | documents.admin.view; có thể cần documents.module.view | — | CẦN TRACE: DCO/Admin là actor-policy, không hard-code graph. |
| DOC-14 | documents.training.* | Chưa xác định; có thể training.module.view | — | CẦN TRACE liên mô-đun Document–Training. |
| SET-01/02 | Dictionary view/manage | manage → view | — | ĐỀ XUẤT. |
| SET-03/04 | Controlled Copy Policy view/manage | manage → view cùng resource | — | ĐỀ XUẤT: Application Settings, không mặc định phụ thuộc Document Control. |
| SET-05/06 | Publishing Template view/manage | manage → view cùng resource | — | ĐỀ XUẤT: Application Settings, tách documents.template.*. |
| SET-07/08 | Configuration view/edit | edit → view | — | ĐỀ XUẤT. |
| SET-09 | Notification Policy view/manage | manage → view | — | ĐỀ XUẤT. |
| SET-10 | settings.configuration.manage | settings.configuration.view | — | CẦN TRACE: hai permission cùng resource nhưng đang thuộc hai module catalog khác nhau. |
| SET-11 | settings.email_template.manage | Chưa xác định | — | CẦN TRACE: catalog chưa có email_template.view để làm prerequisite rõ ràng. |
| AUD-01..05 | Audit module/view/export/review | export → audit.view; manage → review.view | — | CẦN TRACE: audittrail.module.view và audit.view cùng tồn tại. |
| DSH-01/02 | Dashboard view/admin view | admin.view → dashboard.module.view | — | ĐỀ XUẤT. |
| NOT-01/02 | Notifications/QA recipient | module view: —; recipient: — | — | ĐỀ XUẤT: recipient eligibility không phải module navigation. |
| PRF-01/02 | Preferences view/edit | edit → view | — | ĐỀ XUẤT. |
| RPT-01..04 | Report/Reports | action → resource/module view tương ứng | — | CẦN TRACE: module key report và reports khác nhau. |
| SEC-01 | security.maintenance.bypass | — | — | ĐỀ XUẤT: ngoại lệ độc lập. |
| SEC-02..13 | Access Profile, Access Review, Object Rule, Permission Set, SoD, Workflow Authorization | manage/update/assign → quyền view cùng resource | — | ĐỀ XUẤT; cần route/API trace. |
| USR-01/02 | Microsoft Entra provisioning | action → users.view_external_provisioning | — | CẦN TRACE. |
| USR-03/04 | User Management | action → settings.user.view | — | ĐỀ XUẤT. |
| TRN-01/02 | Training | manage → training.module.view | — | ĐỀ XUẤT. |

## 4. Lộ trình triển khai theo giai đoạn

### Giai đoạn 1 — Permission Catalog (làm trước)

1. Chốt rule cho từng permission: **REQUIRES**, **IMPLIES**, **NO_DEPENDENCY_JUSTIFIED** hoặc **CẦN TRACE**.
2. Trace route/API/service để chuyển các rule từ đề xuất sang xác nhận source hoặc quyết định nghiệp vụ được phê duyệt.
3. Dependency graph không được có vòng lặp; migration/test catalog phải chặn chu trình.
4. Permission mới phải khai báo dependency hoặc marker **NO_DEPENDENCY_JUSTIFIED** kèm rationale.
5. IMPLIES làm tăng capability workflow phải được duyệt nghiệp vụ và có test audit/e-signature.

### Giai đoạn 2 — Permission Set và Access Profile (để sau)

1. Lưu **direct grants** để audit rõ Admin tick gì.
2. Tính **effective grants** bằng closure của IMPLIES; UI nêu rõ quyền trực tiếp và quyền suy ra.
3. Validate REQUIRES lúc tạo/sửa Access Profile và khi Shared Permission Set thay đổi.
4. Nếu Shared Permission Set thay đổi làm Access Profile đang dùng nó thiếu dependency: quyết định cơ chế xử lý ở Change Record riêng; chưa chốt enforcement tại thời điểm này.
5. Dry-run toàn bộ profile hiện hữu trước khi bật enforcement.

## 5. Coverage catalog hiện tại

Rule ID là điểm khởi đầu để trace, **không phải dependency đã được duyệt**.

| Module | Group | Permission code | Rule để trace |
|---|---|---|---|
| **app-settings** | **data_dictionaries** | **settings.dictionary.view** | SET-01 |
| **app-settings** | **data_dictionaries** | **settings.dictionary.manage** | SET-02 |
| **app-settings** | **document_control** | **settings.controlled_copy_policy.view** | SET-03 |
| **app-settings** | **document_control** | **settings.controlled_copy_policy.manage** | SET-04 |
| **app-settings** | **document_control** | **settings.publishing_template.view** | SET-05 |
| **app-settings** | **document_control** | **settings.publishing_template.manage** | SET-06 |
| **app-settings** | **system_configuration** | **settings.configuration.view** | SET-07 |
| **app-settings** | **system_configuration** | **settings.configuration.edit** | SET-08 |
| **audit-trail** | **audit_trail** | **audit.view** | AUD-02 |
| **audit-trail** | **audit_trail** | **audit.export** | AUD-03 |
| **audit-trail** | **audit_trail_access** | **audittrail.module.view** | AUD-01 |
| **audit-trail** | **review** | **audit.review.view** | AUD-04 |
| **audit-trail** | **review** | **audit.review.manage** | AUD-05 |
| **dashboard** | **dashboard_access** | **dashboard.module.view** | DSH-01 |
| **dashboard** | **dashboard_admin** | **dashboard.admin.view** | DSH-02 |
| **documents** | **controlled_copy** | **documents.controlled_copy.receive_as_dco** | DOC-12 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.view_file** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.download_file** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.print** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.view_evidence** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.download_evidence** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.request** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.view** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.distribute** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.recall** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.report_lost_damaged** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.replace_lost_damaged** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.upload_evidence** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.expire** | DOC-11 |
| **documents** | **controlled_copy_files** | **documents.controlled_copy.cancel_request** | DOC-11 |
| **documents** | **document_administration** | **documents.admin.view** | DOC-13 |
| **documents** | **document_administration** | **documents.admin.manage_workflow_roles** | DOC-13 |
| **documents** | **document_authoring** | **documents.document.configure_initial_workflow** | DOC-06 |
| **documents** | **document_control_access** | **documents.module.view** | DOC-01 |
| **documents** | **document_control_access** | **documents.document.view_all** | DOC-03 |
| **documents** | **document_control_access** | **documents.workspace.manage** | DOC-05 |
| **documents** | **document_control_access** | **documents.revision.update_draft_metadata** | DOC-07 |
| **documents** | **document_control_access** | **documents.template.use** | DOC-05 |
| **documents** | **document_control_access** | **documents.template.manage** | DOC-05 |
| **documents** | **document_files** | **documents.document.preview_published** | DOC-05 |
| **documents** | **document_master** | **documents.document.obsolete** | DOC-05 |
| **documents** | **document_master** | **documents.document.cancel** | DOC-05 |
| **documents** | **document_master** | **documents.document.reopen** | DOC-05 |
| **documents** | **document_master** | **documents.document.update_metadata** | DOC-05 |
| **documents** | **document_master** | **documents.document.view** | DOC-02 |
| **documents** | **document_master** | **documents.document.create** | DOC-04 |
| **documents** | **document_master** | **documents.document.edit_metadata** | DOC-05 |
| **documents** | **document_master** | **documents.document.view_audit** | DOC-05 |
| **documents** | **revision_configuration** | **documents.revision.configure_next_reviewers** | DOC-06 |
| **documents** | **revision_configuration** | **documents.document.configure_next_metadata** | DOC-06 |
| **documents** | **revision_configuration** | **documents.revision.configure_next_approvers** | DOC-06 |
| **documents** | **revision_configuration** | **documents.revision.configure_next_related_documents** | DOC-06 |
| **documents** | **revision_configuration** | **documents.revision.configure_next_correlated_documents** | DOC-06 |
| **documents** | **revision_files** | **documents.revision.preview** | DOC-07 |
| **documents** | **revision_files** | **documents.revision.upload_source** | DOC-07 |
| **documents** | **revision_files** | **documents.revision.edit_online** | DOC-07 |
| **documents** | **revision_files** | **documents.revision.upload_office_online** | DOC-07 |
| **documents** | **revision_publish** | **documents.revision.open_publishing_workspace** | DOC-07 |
| **documents** | **revision_workflow** | **documents.revision.complete_authoring** | DOC-07 |
| **documents** | **revision_workflow** | **documents.revision.submit_review** | DOC-07 |
| **documents** | **revision_workflow** | **documents.revision.review** | DOC-08 |
| **documents** | **revision_workflow** | **documents.revision.reject_review** | DOC-08 |
| **documents** | **revision_workflow** | **documents.revision.approve** | DOC-09 |
| **documents** | **revision_workflow** | **documents.revision.publish** | DOC-07 |
| **documents** | **revision_workflow** | **documents.revision.force_publish** | DOC-10 |
| **documents** | **revision_workflow** | **documents.revision.reject_approval** | DOC-09 |
| **documents** | **revision_workflow** | **documents.revision.cancel** | DOC-07 |
| **documents** | **revision_workflow** | **documents.revision.upgrade** | DOC-07 |
| **documents** | **revision_workflow** | **documents.revision.obsolete** | DOC-07 |
| **documents** | **training_publish** | **documents.training.manage** | DOC-14 |
| **documents** | **training_publish** | **documents.training.complete** | DOC-14 |
| **notifications** | **notifications_access** | **notifications.module.view** | NOT-01 |
| **notifications** | **recipient_audiences** | **notifications.recipient.qa_manager** | NOT-02 |
| **preferences** | **preferences_access** | **preferences.module.view** | PRF-01 |
| **preferences** | **preferences_access** | **preferences.module.edit** | PRF-02 |
| **report** | **report_platform** | **reports.catalog.view** | RPT-01 |
| **report** | **report_platform** | **reports.run.create** | RPT-02 |
| **report** | **report_platform** | **reports.run.view_own** | RPT-02 |
| **report** | **report_platform** | **reports.run.view_all** | RPT-02 |
| **report** | **report_platform** | **reports.artifact.download** | RPT-02 |
| **report** | **report_platform** | **reports.schedule.view** | RPT-01 |
| **report** | **report_platform** | **reports.schedule.manage** | RPT-02 |
| **reports** | **reports_access** | **report.module.view** | RPT-03 |
| **reports** | **reports_access** | **report.module.export** | RPT-04 |
| **security** | **system_access** | **security.maintenance.bypass** | SEC-01 |
| **security-authorization** | **access_profiles** | **security.access_profiles.view** | SEC-02 |
| **security-authorization** | **access_profiles** | **security.access_profiles.update** | SEC-03 |
| **security-authorization** | **access_profiles** | **security.access_profiles.assign** | SEC-03 |
| **security-authorization** | **access_review** | **security.access_review.view** | SEC-04 |
| **security-authorization** | **access_review** | **security.access_review.manage** | SEC-05 |
| **security-authorization** | **object_access** | **security.object_rules.view** | SEC-06 |
| **security-authorization** | **object_access** | **security.object_rules.manage** | SEC-07 |
| **security-authorization** | **permission_sets** | **security.permission_sets.view** | SEC-08 |
| **security-authorization** | **permission_sets** | **security.permission_sets.update** | SEC-09 |
| **security-authorization** | **segregation_of_duties** | **security.sod.view** | SEC-10 |
| **security-authorization** | **segregation_of_duties** | **security.sod.manage** | SEC-11 |
| **security-authorization** | **workflow_authorization** | **security.workflow_authorization.view** | SEC-12 |
| **security-authorization** | **workflow_authorization** | **security.workflow_authorization.manage** | SEC-13 |
| **settings** | **report_configuration** | **reports.definition.view** | RPT-01 |
| **settings** | **report_configuration** | **reports.definition.manage** | RPT-02 |
| **settings** | **report_configuration** | **reports.retention.manage** | RPT-02 |
| **settings** | **system_settings** | **settings.notification_policy.manage** | SET-09 |
| **settings** | **system_settings** | **settings.notification_policy.view** | SET-09 |
| **settings** | **system_settings** | **settings.configuration.manage** | SET-10 |
| **settings** | **system_settings** | **settings.email_template.manage** | SET-11 |
| **settings** | **user_management** | **users.invite_external** | USR-02 |
| **settings** | **user_management** | **users.resend_external_invitation** | USR-02 |
| **settings** | **user_management** | **users.retry_external_provisioning** | USR-02 |
| **settings** | **user_management** | **users.disable_microsoft_access** | USR-02 |
| **settings** | **user_management** | **users.view_external_provisioning** | USR-01 |
| **settings** | **user_management** | **users.remove_external_identity** | USR-02 |
| **system-admin** | **user_management** | **settings.user.view** | USR-03 |
| **system-admin** | **user_management** | **settings.user.create** | USR-04 |
| **system-admin** | **user_management** | **settings.user.edit** | USR-04 |
| **system-admin** | **user_management** | **settings.user.delete** | USR-04 |
| **system-admin** | **user_management** | **settings.user.reset_password** | USR-04 |
| **system-admin** | **user_management** | **settings.user.force_logout** | USR-04 |
| **training** | **training_access** | **training.module.view** | TRN-01 |
| **training** | **training_admin** | **training.material.manage** | TRN-02 |
| **training** | **training_admin** | **training.session.manage** | TRN-02 |
| **training** | **training_admin** | **training.assignment.manage** | TRN-02 |

## 6. Điều kiện chấp nhận trước khi code

- Toàn bộ 121 permission phải có trạng thái cuối: **CONFIRMED**, **APPROVED_BUSINESS_DECISION** hoặc **NO_DEPENDENCY_JUSTIFIED**.
- Không còn hàng **CẦN TRACE** trước migration enforcement.
- Mỗi REQUIRES có test API âm tính: thiếu prerequisite phải bị từ chối.
- Có test regression cho review → reject_review và approve → reject_approval nếu hai implication được duyệt.
- **DOC-08, DOC-09 không được chuyển sang APPROVED_BUSINESS_DECISION chỉ bằng cách sửa tài liệu này** — cần Decision Record hợp lệ ký duyệt rõ việc IMPLIES sẽ thay đổi enforcement thật ở giai đoạn Access Profile, kèm rủi ro/đánh giá đã nêu ở Section 3.
- Cơ chế xử lý khi Shared Permission Set thay đổi làm Access Profile thiếu dependency **chưa chốt**; phải quyết định ở giai đoạn 2 sau khi mô hình Access Profile ổn định.
