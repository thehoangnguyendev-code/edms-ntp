# Danh mục Permission đang chạy

**Trạng thái bằng chứng:** Xác nhận tại runtime (runtime-confirmed snapshot)  
**Thời điểm chụp:** 27/08/2026 (Asia/Ho_Chi_Minh)  
**Nguồn:** Bảng PostgreSQL `permissions`, là nguồn backend dùng cho API `GET /api/security/permissions/catalog` và `GET /api/security/permissions/catalog/paged`.  
**Phạm vi:** 120 permission hiện đang cấu hình trong database EQMS.

> `Permission code`, `module` và `group` được giữ nguyên tiếng Anh vì đây là giá trị kỹ thuật ổn định. Phần ý nghĩa và mô tả được diễn giải bằng tiếng Việt. `Yêu cầu audit` phản ánh cờ `requires_audit` hiện lưu trong catalog runtime, không tự nó chứng minh toàn bộ action đã có Audit Trail/e-signature.

## Tổng hợp theo module

| Module (key) | Số permission |
|---|---:|
| `app-settings` | 7 |
| `audit-trail` | 5 |
| `dashboard` | 2 |
| `documents` | 56 |
| `notifications` | 2 |
| `preferences` | 2 |
| `report` | 7 |
| `reports` | 2 |
| `security` | 1 |
| `security-authorization` | 13 |
| `settings` | 13 |
| `system-admin` | 6 |
| `training` | 4 |

## Danh sách đầy đủ

| Module | Group | Permission code | Ý nghĩa | Mô tả | Yêu cầu audit |
|---|---|---|---|---|---|
| `app-settings` | `data_dictionaries` | `settings.dictionary.view` | Xem danh mục dữ liệu | Xem các giá trị danh mục được kiểm soát, như đơn vị kinh doanh, phòng ban, loại tài liệu và chính sách lưu giữ. | Không |
| `app-settings` | `data_dictionaries` | `settings.dictionary.manage` | Quản lý danh mục dữ liệu | Tạo, cập nhật và xóa các giá trị danh mục được kiểm soát dùng cho hồ sơ GxP. | Không |
| `app-settings` | `document_control` | `settings.controlled_copy_policy.view` | Xem chính sách Bản sao được kiểm soát | Xem chính sách phân phối, thời hạn, thu hồi và bảo mật của Bản sao được kiểm soát. | Không |
| `app-settings` | `document_control` | `settings.controlled_copy_policy.manage` | Quản lý chính sách Bản sao được kiểm soát | Cập nhật chính sách phân phối, thời hạn, thu hồi và bảo mật của Bản sao được kiểm soát. | Có |
| `app-settings` | `document_control` | `settings.publishing_template.view` | Xem mẫu phát hành | Xem các mẫu phát hành và bản xem trước của các thành phần được tạo từ mẫu. | Không |
| `app-settings` | `document_control` | `settings.publishing_template.manage` | Quản lý mẫu phát hành | Tạo, cập nhật, tạo phiên bản, kích hoạt và ngừng sử dụng mẫu phát hành. | Có |
| `app-settings` | `system_configuration` | `settings.configuration.view` | Xem cấu hình hệ thống | Xem cấu hình áp dụng trên toàn hệ thống. | Không |
| `audit-trail` | `audit_trail` | `audit.view` | Xem Audit Trail | Xem Audit Trail trên toàn hệ thống. | Không |
| `audit-trail` | `audit_trail` | `audit.export` | Xuất Audit Trail | Xuất dữ liệu Audit Trail trên toàn hệ thống. | Có |
| `audit-trail` | `audit_trail_access` | `audittrail.module.view` | Truy cập mô-đun Audit Trail | Mở và sử dụng mô-đun Audit Trail trên toàn hệ thống. | Không |
| `audit-trail` | `review` | `audit.review.view` | Xem đợt rà soát Audit Trail | Xem các đợt rà soát Audit Trail định kỳ và các phát hiện liên quan. | Không |
| `audit-trail` | `review` | `audit.review.manage` | Quản lý đợt rà soát Audit Trail | Tạo, đưa ra quyết định, hoàn tất và hủy các đợt rà soát Audit Trail. | Không |
| `dashboard` | `dashboard_access` | `dashboard.module.view` | Xem Dashboard | Truy cập Dashboard hệ thống và các widget KPI. | Không |
| `dashboard` | `dashboard_admin` | `dashboard.admin.view` | Xem Dashboard quản trị | Xem số liệu quản trị và các widget tổng quan phục vụ bảo mật. | Không |
| `documents` | `controlled_copy` | `documents.controlled_copy.receive_as_dco` | Nhận Bản sao được kiểm soát với vai trò DCO | Được chọn trong Chính sách Bản sao được kiểm soát làm người nhận DCO: nhận tệp/ZIP có thể in thay cho người yêu cầu gốc khi bật chuyển hướng giao nhận. | Có |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.view_file` | Xem tệp Bản sao được kiểm soát | Xem tệp PDF Bản sao được kiểm soát trên cổng thông tin. | Không |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.download_file` | Tải xuống tệp Bản sao được kiểm soát | Tải xuống tệp PDF Bản sao được kiểm soát. | Không |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.print` | In tệp Bản sao được kiểm soát | In tệp Bản sao được kiểm soát đã được cấp quyền. | Không |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.view_evidence` | Xem bằng chứng Bản sao được kiểm soát | Xem các tệp bằng chứng đính kèm Bản sao được kiểm soát. | Không |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.download_evidence` | Tải xuống bằng chứng Bản sao được kiểm soát | Tải xuống các tệp bằng chứng đính kèm Bản sao được kiểm soát. | Không |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.request` | Yêu cầu Bản sao được kiểm soát | Yêu cầu cấp một Bản sao được kiểm soát mới. | Có |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.view` | Xem nhật ký Bản sao được kiểm soát | Xem các bản ghi phân phối Bản sao được kiểm soát. | Không |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.distribute` | Phân phối Bản sao được kiểm soát | Ghi nhận một Bản sao được kiểm soát đã được phân phối cho người giữ bản sao. | Có |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.recall` | Thu hồi Bản sao được kiểm soát | Thu hồi một Bản sao được kiểm soát đã phân phối. | Có |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.report_lost_damaged` | Báo mất/hỏng Bản sao được kiểm soát | Ghi nhận một Bản sao được kiểm soát đã phân phối là bị mất hoặc hư hỏng. | Có |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.replace_lost_damaged` | Thay thế Bản sao được kiểm soát mất/hỏng | Cấp bản thay thế cho Bản sao được kiểm soát bị mất hoặc hư hỏng. | Có |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.upload_evidence` | Tải lên bằng chứng Bản sao được kiểm soát | Tải lên bằng chứng cho trường hợp Bản sao được kiểm soát bị mất hoặc hư hỏng. | Có |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.expire` | Cho Bản sao được kiểm soát hết hạn | Chuyển Bản sao được kiểm soát sang hết hạn theo chính sách hiệu lực. | Có |
| `documents` | `controlled_copy_files` | `documents.controlled_copy.cancel_request` | Hủy yêu cầu Bản sao được kiểm soát | Hủy một yêu cầu Bản sao được kiểm soát đang chờ xử lý. | Có |
| `documents` | `document_administration` | `documents.admin.view` | Truy cập quản trị Tài liệu | Xem khu vực Quản trị Tài liệu và các thiết lập chính sách workflow. | Không |
| `documents` | `document_administration` | `documents.admin.manage_workflow_roles` | Quản lý quy tắc workflow Tài liệu | Quản lý quy tắc phân tách nhiệm vụ cho workflow Document Revision, ví dụ: Reviewer không được Approval, yêu cầu hai Reviewer, Author không được Review Revision của chính mình. | Có |
| `documents` | `document_authoring` | `documents.document.configure_initial_workflow` | Cấu hình workflow ban đầu của Tài liệu | Cấu hình Reviewer, Approver và mối quan hệ tài liệu khi tạo Document Master ban đầu. | Có |
| `documents` | `document_control_access` | `documents.module.view` | Xem mô-đun Document Control | Truy cập mô-đun Document Control. | Không |
| `documents` | `document_control_access` | `documents.document.view_all` | Xem tất cả hồ sơ tài liệu | Xem mọi Document Master và Revision không phụ thuộc quyền sở hữu, tham gia workflow, đơn vị kinh doanh hoặc phòng ban; quyền này chỉ có tính chất đọc. | Không |
| `documents` | `document_control_access` | `documents.workspace.manage` | Quản lý không gian làm việc Document Control | Thực hiện các thao tác vận hành Document Control được lifecycle và chính sách workflow cho phép; không cho phép sửa source/nội dung Draft của Author khác. | Có |
| `documents` | `document_control_access` | `documents.revision.update_draft_metadata` | Cập nhật metadata Revision Draft | Cập nhật metadata của một Revision ở trạng thái Draft. | Có |
| `documents` | `document_control_access` | `documents.template.use` | Sử dụng mẫu tài liệu được kiểm soát | Chọn mẫu tài liệu được kiểm soát đã phê duyệt khi tạo Revision. | Có |
| `documents` | `document_control_access` | `documents.template.manage` | Quản lý mẫu tài liệu được kiểm soát | Tạo hoặc sửa tài liệu được đánh dấu là mẫu tài liệu được kiểm soát. | Có |
| `documents` | `document_files` | `documents.document.preview_published` | Xem trước tài liệu đã phát hành | Xem trước PDF đã phát hành của tài liệu Effective hoặc Obsoleted. | Không |
| `documents` | `document_master` | `documents.document.obsolete` | Ngừng hiệu lực Tài liệu | Ngừng hiệu lực một tài liệu Active và Revision Effective của tài liệu đó. | Có |
| `documents` | `document_master` | `documents.document.cancel` | Hủy Tài liệu | Hủy bản ghi Document Master trước hoặc sau khi kích hoạt. | Có |
| `documents` | `document_master` | `documents.document.reopen` | Mở lại Tài liệu đã hủy | Mở lại một Document Draft đã đóng/hủy, kèm tóm tắt hoạt động có thể audit. | Có |
| `documents` | `document_master` | `documents.document.update_metadata` | Cập nhật metadata Document Draft | Cập nhật metadata của Document Master ở trạng thái Draft. | Có |
| `documents` | `document_master` | `documents.document.view` | Xem Tài liệu | Xem bản ghi Document Master và metadata của nó. | Không |
| `documents` | `document_master` | `documents.document.create` | Tạo Document Shell | Tạo một Document Shell mới với metadata và cấu hình workflow. | Có |
| `documents` | `document_master` | `documents.document.edit_metadata` | Chỉnh sửa metadata Tài liệu | Chỉnh sửa metadata Document Master và quản lý chu kỳ review. | Có |
| `documents` | `document_master` | `documents.document.view_audit` | Xem Audit Trail của Tài liệu | Xem tab Audit Trail của Document hoặc Revision. Stakeholder trực tiếp (Author, Co-author, Reviewer/Approver, Admin/DCO) tự có quyền; quyền này chỉ cần cho người xem gián tiếp hoặc phạm vi rộng. | Không |
| `documents` | `revision_configuration` | `documents.revision.configure_next_reviewers` | Cấu hình Reviewer cho Revision kế tiếp | Thay đổi Reviewer được kế thừa cho Revision kế tiếp của tài liệu Active. | Có |
| `documents` | `revision_configuration` | `documents.document.configure_next_metadata` | Cấu hình metadata cho Revision kế tiếp | Thay đổi Author, Co-author, chu kỳ/thông báo Periodic Review, ngày review và mô tả được kế thừa cho Revision kế tiếp của tài liệu Active. | Có |
| `documents` | `revision_configuration` | `documents.revision.configure_next_approvers` | Cấu hình Approver cho Revision kế tiếp | Thay đổi Approver được kế thừa cho Revision kế tiếp của tài liệu Active. | Có |
| `documents` | `revision_configuration` | `documents.revision.configure_next_related_documents` | Cấu hình Related Documents cho Revision kế tiếp | Thay đổi Related Documents được kế thừa cho Revision kế tiếp của tài liệu Active. | Có |
| `documents` | `revision_configuration` | `documents.revision.configure_next_correlated_documents` | Cấu hình Correlated Documents cho Revision kế tiếp | Thay đổi Correlated Documents được kế thừa cho Revision kế tiếp của tài liệu Active. | Có |
| `documents` | `revision_files` | `documents.revision.preview` | Xem trước Revision | Xem trước PDF của Revision, gồm bản snapshot review hoặc bản đã phát hành. | Không |
| `documents` | `revision_files` | `documents.revision.upload_source` | Tải lên source Revision | Tải lên hoặc thay thế source file được kiểm soát cho Revision Draft đã được cấp quyền. | Không |
| `documents` | `revision_files` | `documents.revision.edit_online` | Chỉnh sửa Revision trực tuyến | Mở source file Revision bằng Office Online để chỉnh sửa. | Không |
| `documents` | `revision_files` | `documents.revision.upload_office_online` | Tải Revision lên Office Online | Tải lên hoặc đồng bộ bản làm việc Revision Draft đã được cấp quyền với Office Online. | Có |
| `documents` | `revision_publish` | `documents.revision.open_publishing_workspace` | Mở Publishing Workspace | Mở Publishing Workspace cho Revision Ready for Publishing đã được cấp quyền; quyền Publish là quyền riêng. | Có |
| `documents` | `revision_workflow` | `documents.revision.complete_authoring` | Hoàn tất soạn thảo Revision | Hoàn tất chỉnh sửa và khóa source Revision để chuẩn bị phát hành. | Có |
| `documents` | `revision_workflow` | `documents.revision.submit_review` | Trình Revision để Review | Trình Revision Draft đã hoàn tất vào workflow Review/Approval. | Có |
| `documents` | `revision_workflow` | `documents.revision.review` | Review Revision | Hoàn tất Review đối với Revision đang chờ Review. | Có |
| `documents` | `revision_workflow` | `documents.revision.reject_review` | Từ chối Review Revision | Từ chối Revision tại bước Review và trả Revision về Draft. | Có |
| `documents` | `revision_workflow` | `documents.revision.approve` | Phê duyệt Revision | Hoàn tất Approval đối với Revision đang chờ phê duyệt. | Có |
| `documents` | `revision_workflow` | `documents.revision.publish` | Ban hành Revision | Ban hành Revision để chuyển sang trạng thái Effective. | Có |
| `documents` | `revision_workflow` | `documents.revision.force_publish` | Ban hành cưỡng bức Revision | Cho phép ban hành Revision khi một hay nhiều Related Documents chưa Effective. Đây là ngoại lệ/deviation GMP và không được cấp mặc định. | Có |
| `documents` | `revision_workflow` | `documents.revision.reject_approval` | Từ chối phê duyệt Revision | Từ chối Revision tại bước Approval và trả Revision về Draft. | Có |
| `documents` | `revision_workflow` | `documents.revision.cancel` | Hủy Revision | Chỉ hủy Revision Draft đã được cấp quyền; bắt buộc có tóm tắt hoạt động và chữ ký điện tử. | Có |
| `documents` | `revision_workflow` | `documents.revision.upgrade` | Nâng cấp Revision | Tạo Revision Draft mới từ Revision Effective. | Có |
| `documents` | `revision_workflow` | `documents.revision.obsolete` | Ngừng hiệu lực Revision | Ngừng hiệu lực Revision Effective đã được cấp quyền; bắt buộc có tóm tắt hoạt động và chữ ký điện tử. | Có |
| `documents` | `training_publish` | `documents.training.manage` | Quản lý kế hoạch đào tạo | Quản lý kế hoạch đào tạo liên quan đến tài liệu và trạng thái sẵn sàng phân phối. | Có |
| `documents` | `training_publish` | `documents.training.complete` | Hoàn tất đào tạo | Hoàn tất các bước workflow đào tạo của Revision tài liệu. | Có |
| `notifications` | `notifications_access` | `notifications.module.view` | Xem thông báo | Truy cập thông báo trong ứng dụng. | Không |
| `notifications` | `recipient_audiences` | `notifications.recipient.qa_manager` | Nhận thông báo QA Manager | Nhận thông báo theo chính sách khi được cấu hình là đối tượng QA Manager. Phải cấp qua Access Profile/Permission Set, không tự suy ra từ tên vai trò. | Không |
| `preferences` | `preferences_access` | `preferences.module.view` | Xem Preferences | Mở mô-đun Preferences cá nhân. | Không |
| `preferences` | `preferences_access` | `preferences.module.edit` | Chỉnh sửa Preferences | Cập nhật Preferences cá nhân và các thiết lập tự phục vụ. | Không |
| `report` | `report_platform` | `reports.catalog.view` | Xem danh mục báo cáo | Xem các định nghĩa báo cáo thuộc phạm vi hiện tại. | Không |
| `report` | `report_platform` | `reports.run.create` | Tạo báo cáo | Đưa yêu cầu tạo báo cáo vào hàng đợi xử lý. | Có |
| `report` | `report_platform` | `reports.run.view_own` | Xem lịch sử báo cáo của bản thân | Xem các lần chạy báo cáo và artefact của chính người dùng. | Không |
| `report` | `report_platform` | `reports.run.view_all` | Xem lịch sử báo cáo của tất cả người dùng | Xem các lần chạy báo cáo của toàn bộ người dùng. | Không |
| `report` | `report_platform` | `reports.artifact.download` | Tải xuống artefact báo cáo | Tải xuống các artefact báo cáo bất biến đã được cấp quyền. | Có |
| `report` | `report_platform` | `reports.schedule.view` | Xem lịch báo cáo | Xem các lịch chạy báo cáo. | Không |
| `report` | `report_platform` | `reports.schedule.manage` | Quản lý lịch báo cáo | Tạo, thay đổi, tạm dừng và tiếp tục các lịch chạy báo cáo. | Có |
| `reports` | `reports_access` | `report.module.view` | Xem Reports | Truy cập Reports và không gian làm việc báo cáo. | Không |
| `reports` | `reports_access` | `report.module.export` | Xuất Reports | Xuất báo cáo và dữ liệu trích xuất phục vụ tuân thủ. | Có |
| `security` | `system_access` | `security.maintenance.bypass` | Bỏ qua chế độ bảo trì | Truy cập ứng dụng trong khi chế độ bảo trì theo lịch đang bật. | Có |
| `security-authorization` | `access_profiles` | `security.access_profiles.view` | Xem Access Profiles | Xem Access Profile, business role và tóm tắt phân công. | Không |
| `security-authorization` | `access_profiles` | `security.access_profiles.update` | Quản lý Access Profiles | Tạo, cập nhật, ngừng kích hoạt, sao chép và quản trị Access Profile. | Không |
| `security-authorization` | `access_profiles` | `security.access_profiles.assign` | Gán Access Profiles | Gán user, Permission Set, workflow role và object rule vào Access Profile. | Không |
| `security-authorization` | `access_review` | `security.access_review.view` | Xem đợt rà soát quyền truy cập | Xem các đợt rà soát quyền truy cập định kỳ và phát hiện liên quan. | Không |
| `security-authorization` | `access_review` | `security.access_review.manage` | Quản lý đợt rà soát quyền truy cập | Tạo, đưa ra quyết định, hoàn tất và hủy các đợt rà soát quyền truy cập. | Không |
| `security-authorization` | `object_access` | `security.object_rules.view` | Xem Object Access Rules | Xem Object Access Rule và chính sách phạm vi tổ chức. | Không |
| `security-authorization` | `object_access` | `security.object_rules.manage` | Quản lý Object Access Rules | Tạo, cập nhật, ngừng kích hoạt và xóa Object Access Rule. | Không |
| `security-authorization` | `permission_sets` | `security.permission_sets.view` | Xem Permission Sets | Xem Permission Set và các permission được gán. | Không |
| `security-authorization` | `permission_sets` | `security.permission_sets.update` | Quản lý Permission Sets | Tạo, cập nhật, sao chép, ngừng kích hoạt và gán Permission Set. | Không |
| `security-authorization` | `segregation_of_duties` | `security.sod.view` | Xem Segregation of Duties | Xem các ràng buộc SoD và kết quả quét vi phạm. | Không |
| `security-authorization` | `segregation_of_duties` | `security.sod.manage` | Quản lý Segregation of Duties | Tạo, cập nhật và ngừng kích hoạt các ràng buộc SoD. | Không |
| `security-authorization` | `workflow_authorization` | `security.workflow_authorization.view` | Xem Workflow Authorization | Xem chính sách phân quyền workflow và quy tắc actor. | Không |
| `security-authorization` | `workflow_authorization` | `security.workflow_authorization.manage` | Quản lý Workflow Authorization | Tạo và cập nhật chính sách phân quyền workflow và quy tắc actor. | Có |
| `settings` | `report_configuration` | `reports.definition.view` | Xem cấu hình báo cáo | Xem các định nghĩa báo cáo được kiểm soát. | Không |
| `settings` | `report_configuration` | `reports.definition.manage` | Quản lý cấu hình báo cáo | Thay đổi cấu hình báo cáo được kiểm soát. | Có |
| `settings` | `report_configuration` | `reports.retention.manage` | Quản lý thời hạn lưu báo cáo | Quản lý thời hạn lưu artefact báo cáo và legal hold. | Có |
| `settings` | `system_settings` | `settings.notification_policy.manage` | Quản lý chính sách thông báo | Chỉnh sửa quy tắc gửi thông báo, người nhận và mẫu nội dung. | Có |
| `settings` | `system_settings` | `settings.notification_policy.view` | Xem chính sách thông báo | Xem danh mục sự kiện thông báo, quy tắc gửi và nội dung. | Không |
| `settings` | `system_settings` | `settings.configuration.manage` | Quản lý cấu hình | Quản lý cấu hình chung của hệ thống. | Có |
| `settings` | `system_settings` | `settings.email_template.manage` | Quản lý Email Templates | Tạo và chỉnh sửa Email Template cho thông báo. | Có |
| `settings` | `user_management` | `users.invite_external` | Mời người dùng bên ngoài | Mời người dùng vào Microsoft Entra với tư cách khách. | Có |
| `settings` | `user_management` | `users.resend_external_invitation` | Gửi lại lời mời bên ngoài | Gửi lại lời mời Microsoft Entra cho người dùng khách. | Có |
| `settings` | `user_management` | `users.retry_external_provisioning` | Thử lại provisioning bên ngoài | Thử lại tác vụ provisioning Microsoft Entra đã thất bại. | Có |
| `settings` | `user_management` | `users.disable_microsoft_access` | Vô hiệu hóa quyền truy cập Microsoft | Vô hiệu hóa tài khoản khách Microsoft đã được provision mà không xóa tài khoản. | Có |
| `settings` | `user_management` | `users.view_external_provisioning` | Xem provisioning bên ngoài | Xem trạng thái lời mời và provisioning Microsoft Entra. | Không |
| `settings` | `user_management` | `users.remove_external_identity` | Xóa người dùng bên ngoài | Xóa vĩnh viễn tài khoản khách Microsoft Entra; thao tác không thể hoàn tác. | Có |
| `system-admin` | `user_management` | `settings.user.view` | Xem người dùng | Xem trang quản lý người dùng và hồ sơ người dùng. | Không |
| `system-admin` | `user_management` | `settings.user.create` | Tạo người dùng | Tạo tài khoản người dùng mới. | Có |
| `system-admin` | `user_management` | `settings.user.edit` | Chỉnh sửa người dùng | Chỉnh sửa thông tin tài khoản người dùng. | Có |
| `system-admin` | `user_management` | `settings.user.delete` | Xóa hoặc vô hiệu hóa người dùng | Xóa hoặc vô hiệu hóa tài khoản người dùng. | Có |
| `system-admin` | `user_management` | `settings.user.reset_password` | Đặt lại mật khẩu | Đặt lại mật khẩu của người dùng khác. | Có |
| `system-admin` | `user_management` | `settings.user.force_logout` | Buộc đăng xuất người dùng | Thu hồi ngay các session đang hoạt động của người dùng khác. | Có |
| `training` | `training_access` | `training.module.view` | Xem Training | Truy cập mô-đun Training và các nội dung đào tạo được giao. | Không |
| `training` | `training_admin` | `training.material.manage` | Quản lý tài liệu đào tạo | Tạo, cập nhật, review và phê duyệt tài liệu đào tạo. | Có |
| `training` | `training_admin` | `training.session.manage` | Quản lý buổi đào tạo | Lập lịch và quản lý buổi đào tạo cùng bản ghi điểm danh. | Có |
| `training` | `training_admin` | `training.assignment.manage` | Quản lý phân công đào tạo | Giao khóa học và yêu cầu đào tạo cho người dùng hoặc nhóm. | Có |
