# Danh mục quyền hiện tại và kiểm kê phân quyền workflow

**Ngày chụp dữ liệu:** 05/08/2026  
**Mục đích:** ghi nhận hệ thống hiện đang được cấu hình cho phép những gì. Đây là tài liệu kiểm kê để ra quyết định nghiệp vụ, **không phải** đề xuất mô hình quyền tương lai.

## 1. Nguồn dữ liệu và cách hệ thống quyết định một hành động

Danh mục này được tổng hợp từ các bảng PostgreSQL runtime `permissions`, `workflow_action_policies`, `workflow_action_policy_actors`, rồi đối chiếu với các service phân quyền Java. Tên hiển thị của role không phải khóa phân quyền đáng tin cậy. Một user chỉ thực hiện được hành động khi vượt qua tất cả các lớp kiểm tra áp dụng dưới đây:

1. **Entitlement (quyền được cấp):** user nhận permission code bất biến cần thiết từ một hoặc nhiều Access Profile / permission set.
2. **Workflow actor selector (điều kiện chủ thể workflow):** policy đang hiệu lực cho phép user đó, ví dụ `AUTHOR`, `CO_AUTHOR`, `ASSIGNED_REVIEWER`, `ASSIGNED_APPROVER`, `ACCESS_PROFILE:<profile-code>` hoặc `PERMISSION:<permission-code>`.
3. **Quan hệ và phạm vi dữ liệu:** user phải là Author, Co-author, người được chỉ định trong workflow, người xem tài liệu, người nhận, người yêu cầu hoặc thuộc phạm vi mà actor selector yêu cầu.
4. **Trạng thái vòng đời và điều kiện nghiệp vụ:** record phải đúng trạng thái và thỏa điều kiện như “đã hoàn thành biên soạn”, “Reviewer tiếp theo trong sequence”, “Document Active”, “Revision Effective” hoặc “chưa hết hạn”.
5. **Policy / phân tách nhiệm vụ:** policy Controlled Copy, strict visibility, thứ tự sequence và SoD có thể từ chối hành động dù bốn lớp trên đã đạt.

FE chỉ nên hiển thị button dựa trên kết quả capability API. Mutation API phải thực hiện lại cùng quyết định đó ở backend. Vì vậy tên role như **DCO** không được là lý do trực tiếp để cấp quyền.

### Ví dụ quan trọng: Submit for Review

Policy runtime hiện tại của `SUBMIT_FOR_REVIEW`:

| Hạng mục | Giá trị hiện tại |
|---|---|
| Module / đối tượng | Document Control / Revision |
| Trạng thái thao tác | `DRAFT` |
| Entitlement bắt buộc | `documents.revision.submit_review` |
| Actor selector hiện tại | `ACCESS_PROFILE:DCO`, `ACCESS_PROFILE:DOCUMENT_CONTROLLER` |
| Điều kiện bổ sung | Trạng thái editing phải là `COMPLETED` **và** source file phải bị khóa. |

Vì vậy, chỉ cấp `documents.revision.submit_review` cho một Author **chưa đủ để user đó Submit**. User vẫn không qua điều kiện Access Profile hiện đang cấu hình. Nếu quy tắc nghiệp vụ là “Author được chỉ định có thể submit Draft revision khi họ có permission này”, policy actor phải có `AUTHOR` (có thể thêm `CO_AUTHOR`) thay vì một profile có tên cụ thể. Nếu quy tắc là “chỉ một người được chỉ định trên từng tài liệu có thể submit”, cần thêm participant cấp record, chẳng hạn `SUBMISSION_COORDINATOR`; không giải quyết bằng cách hard-code tên profile hoặc tên user.

## 2. Kiểm kê policy workflow hiện tại: Document Master

Đây là các dòng đang active trong `workflow_action_policies` cho đối tượng `DOCUMENT`. `DocumentMasterWorkflowAuthorizationService` còn đọc lifecycle policy. Trạng thái là điều kiện bắt buộc.

| Action / chức năng | Permission bắt buộc | Trạng thái hiện tại | Actor selector hiện tại | Chức năng / điều kiện bổ sung |
|---|---|---|---|---|
| `CANCEL` | `documents.document.cancel` | `DRAFT` | `PERMISSION:documents.workspace.manage` | Hủy Document Master chưa được phát hành. User cần cả permission trong cột trước và workspace-manage vì actor selector là một lần kiểm tra entitlement riêng. |
| `OBSOLETE` | `documents.workspace.manage` | `ACTIVE` | `PERMISSION:documents.workspace.manage` | Obsolete Document Master. Lifecycle-policy evaluator cũng là nguồn quyết định cho action này. |
| `REOPEN` | `documents.document.reopen` | `CLOSED_CANCELLED` | `PERMISSION:documents.document.reopen` | Mở lại document đã đóng/hủy. |
| `UPDATE_METADATA` | `documents.document.update_metadata` | `DRAFT` | `PERMISSION:documents.document.update_metadata` | Chỉ cập nhật metadata của Document Master đang Draft. |

## 3. Kiểm kê policy workflow hiện tại: Document Revision

Các dòng dưới đây đang active cho `DOCUMENT_REVISION / REVISION`. Dòng có **Chưa cấu hình actor** hiện bị `RevisionWorkflowAuthorizationService` từ chối với mã `WORKFLOW_POLICY_MISCONFIGURED`; chỉ có permission là không đủ.

| Action / chức năng | Permission bắt buộc | Trạng thái hiện tại | Actor selector hiện tại | Điều kiện nghiệp vụ / ghi chú hiện tại |
|---|---|---|---|---|
| `UPDATE_DRAFT_METADATA` | `documents.revision.update_draft_metadata` | `DRAFT` | **Chưa cấu hình actor** | Cập nhật metadata Revision khi Draft. Runtime hiện từ chối vì danh sách actor trống. |
| `UPLOAD_SOURCE` | `documents.revision.upload_source` | `DRAFT` | **Chưa cấu hình actor** | Upload/thay source Revision. Runtime hiện từ chối vì danh sách actor trống. File service còn áp dụng quy tắc source file. |
| `COMPLETE_AUTHORING` | `documents.revision.complete_authoring` | `DRAFT` | **Chưa cấu hình actor** | Hoàn thành biên soạn. Bị từ chối nếu đã completed hoặc source bị khóa. Policy hiện thiếu actor selector. |
| `GENERATE_REVIEW_SNAPSHOT` | `documents.revision.submit_review` | `DRAFT` | `PERMISSION:documents.workspace.manage` | Tạo snapshot trước review. DB dùng `submit_review` làm permission bắt buộc nên không khớp với mục đích tạo file. |
| `REGENERATE_SNAPSHOT` | `documents.revision.submit_review` | `DRAFT` trong DB | `PERMISSION:documents.workspace.manage` | Tạo lại PDF. Java invariant cho phép thêm `EFFECTIVE` và `OBSOLETED`, rộng hơn dòng policy đang active trong DB. |
| `SUBMIT_FOR_REVIEW` | `documents.revision.submit_review` | `DRAFT` | `ACCESS_PROFILE:DCO`, `ACCESS_PROFILE:DOCUMENT_CONTROLLER` | Yêu cầu editing hoàn thành và source bị khóa. Đây là sự ràng buộc profile đã nêu ở trên. |
| `COMPLETE_REVIEW` | `documents.revision.review` | `PENDING_REVIEW` | **Chưa cấu hình actor** | Hoàn thành review; thiết kế nghiệp vụ dự kiến là Reviewer được gán và đang đứng kế tiếp trong sequence, nhưng DB hiện không có selector nên bị từ chối. |
| `REJECT_REVIEW` | `documents.revision.reject_review` | `PENDING_REVIEW` | **Chưa cấu hình actor** | Reject review về Draft; thông thường phải là Reviewer được gán và đang kế tiếp. DB hiện thiếu actor selector. |
| `COMPLETE_APPROVAL` | `documents.revision.approve` | `PENDING_APPROVAL` | **Chưa cấu hình actor** | Hoàn thành approval; thiết kế nghiệp vụ dự kiến là Approver được gán và đang kế tiếp trong sequence. DB hiện thiếu actor selector. |
| `REJECT_APPROVAL` | `documents.revision.reject_approval` | `PENDING_APPROVAL` | **Chưa cấu hình actor** | Reject approval về Draft; thông thường phải là Approver được gán và đang kế tiếp. DB hiện thiếu actor selector. |
| `COMPLETE_TRAINING` | *(trống trong policy active)* | `PENDING_TRAINING` | `PERMISSION:documents.training.complete`, `PERMISSION:documents.training.manage`, `PERMISSION:training.material.manage` | Hoàn thành training. Trường required-permission trống nghĩa là actor selectors hiện mang luôn kiểm tra entitlement. |
| `OPEN_PUBLISHING_WORKSPACE` | `documents.revision.open_publishing_workspace` | `READY_FOR_PUBLISHING` | `ACCESS_PROFILE:DCO`, `ACCESS_PROFILE:DOCUMENT_CONTROLLER` | Mở publishing workspace. Vẫn đang phụ thuộc profile code. |
| `PUBLISH` | `documents.workspace.manage` | `READY_FOR_PUBLISHING` | `PERMISSION:documents.workspace.manage` | Phát hành revision sau khi hoàn tất các điều kiện workflow trước đó. |
| `CANCEL` | `documents.workspace.manage` | `DRAFT` | `PERMISSION:documents.workspace.manage` | Hủy Draft Revision. |
| `OBSOLETE` | `documents.revision.obsolete` | `EFFECTIVE` | `PERMISSION:documents.workspace.manage` | Obsolete Revision Effective. Hiện cần hai entitlement khác nhau. |
| `UPGRADE_REVISION` | `documents.revision.upgrade` | `EFFECTIVE` | `PERMISSION:documents.workspace.manage` | Khởi tạo Revision tiếp theo từ Revision Effective. Theo policy hiện tại cần cả upgrade và workspace-manage. |

### Quyền truy cập file Revision (không phải chuyển trạng thái workflow)

`SecureFileAccessService` map thao tác dưới đây với permission code, sau đó tiếp tục kiểm tra quan hệ đối tượng và trạng thái. Source file không được tự nhiên trở thành file có thể edit chung chỉ vì user có file permission.

| Permission code | Chức năng | Record / trạng thái áp dụng điển hình | Kiểm tra quan hệ hoặc policy quan trọng |
|---|---|---|---|
| `documents.revision.preview` | Xem trước file Revision / review snapshot | Revision đã có preview | Vẫn kiểm tra quyền đọc qua secure-file authorization. |
| `documents.revision.upload_source` | Upload hoặc thay source file | Draft Revision | Policy workflow active hiện chưa có actor selector cho `UPLOAD_SOURCE`; vẫn có ràng buộc ownership của source. |
| `documents.revision.download_source` | Download source file | Source Revision được phép | Bắt buộc secure-file authorization. |
| `documents.revision.edit_online` | Mở Word/Office Online editor | Draft Revision | Dành cho Author / Co-author được gán; user không liên quan không được source edit access. |
| `documents.revision.upload_office_online` | Đồng bộ source đến/từ Office Online | Draft / Office workspace | Có ràng buộc workspace và source-edit. |
| `documents.revision.generate_preview` | Tạo technical preview | Revision có source được phép | Khác với phát hành. Sai khác snapshot policy được nêu ở trên. |

## 4. Kiểm kê policy workflow hiện tại: Controlled Copies

Các policy này đang active cho `CONTROLLED_COPY`. Với distribution action, `ControlledCopyAuthorizationService` xem workspace-management là action vận hành toàn cục, sau đó kiểm tra entitlement và lifecycle. Các action khác kiểm tra actor selector cùng điều kiện policy.

| Action / chức năng | Permission bắt buộc | Trạng thái hiện tại | Actor selector hiện tại | Điều kiện nghiệp vụ / ghi chú hiện tại |
|---|---|---|---|---|
| `REQUEST_COPY` | `documents.controlled_copy.request` | Document cha `ACTIVE`, Revision `EFFECTIVE` | `PERMISSION:documents.workspace.manage` | Policy hiện giới hạn người request là workspace manager. Service đã có logic self-service requester/viewer, nhưng actor row runtime đang chặt hơn. |
| `VIEW_COPY` | `documents.controlled_copy.view` | `READY_FOR_DISTRIBUTION`, `DISTRIBUTED` | `PERMISSION:documents.workspace.manage` | Cần policy portal-view và bản chưa hết hạn. Actor policy hiện chỉ là manager. |
| `PREVIEW_FILE` | `documents.controlled_copy.view_file` | `READY_FOR_DISTRIBUTION`, `DISTRIBUTED` | `PERMISSION:documents.workspace.manage` | Cần bật portal view và chưa hết hạn. |
| `DOWNLOAD_FILE` | `documents.controlled_copy.download_file` | `DISTRIBUTED` | `PERMISSION:documents.workspace.manage` | Cần bật download và chưa hết hạn. Actor policy hiện không dùng chính download permission làm selector. |
| `PRINT_COPY` | `documents.controlled_copy.print` | `READY_FOR_DISTRIBUTION`, `DISTRIBUTED` | `PERMISSION:documents.controlled_copy.print` | Cần bật print và chưa hết hạn. **Code permission được policy và Java tham chiếu nhưng không tồn tại trong bảng `permissions` hiện tại**; cần sửa catalog/data trước khi có thể gán nhất quán. |
| `DISTRIBUTE_COPY` | `documents.controlled_copy.distribute` | `READY_FOR_DISTRIBUTION` | `PERMISSION:documents.workspace.manage` | Phân phối một Controlled Copy record. |
| `DISTRIBUTE_BATCH` | `documents.controlled_copy.distribute` | Batch `READY_FOR_DISTRIBUTION` | `PERMISSION:documents.workspace.manage` | Phân phối các child record đủ điều kiện của một batch. |
| `RECALL_COPY` | `documents.controlled_copy.recall` | `READY_FOR_DISTRIBUTION`, `DISTRIBUTED` | `PERMISSION:documents.workspace.manage` | Cần policy cho phép manual recall. Java message có nhắc Obsoleted, nhưng DB active không cho `OBSOLETED`. |
| `RECALL_BATCH` | `documents.controlled_copy.recall` | Batch `DISTRIBUTED` | `PERMISSION:documents.workspace.manage` | Recall ở cấp batch. |
| `REPORT_LOST_DAMAGED` | `documents.controlled_copy.report_lost_damaged` | `DISTRIBUTED` | `PERMISSION:documents.controlled_copy.report_lost_damaged` | Cần policy cho phép report lost hoặc report damaged. |
| `REPLACE_LOST_DAMAGED` | `documents.controlled_copy.replace_lost_damaged` | `OBSOLETED` | `PERMISSION:documents.workspace.manage` | Chỉ được thay thế khi record đã obsolete do xử lý lost/damaged. |
| `UPLOAD_EVIDENCE` | `documents.controlled_copy.upload_evidence` | `OBSOLETED` | `PERMISSION:documents.controlled_copy.upload_evidence` | Upload evidence bị giới hạn trong kết quả lost/damaged và còn qua validation evidence/secure-file. |
| `EXPIRE_COPY` | `documents.controlled_copy.expire` | `READY_FOR_DISTRIBUTION`, `DISTRIBUTED` | `PERMISSION:documents.workspace.manage` | Action hết hạn; hết hạn cũng ảnh hưởng truy cập portal/download/print. |
| `CANCEL_REQUEST` | `documents.controlled_copy.cancel_request` | `READY_FOR_DISTRIBUTION` | `PERMISSION:documents.workspace.manage` | Hủy request/batch chưa được phân phối. |

### Quyền file và evidence của Controlled Copy

| Permission code | Chức năng | Điều kiện trạng thái / policy |
|---|---|---|
| `documents.controlled_copy.view_file` | Xem trước an toàn qua portal | Portal view bật; bản được xem; chưa hết hạn. |
| `documents.controlled_copy.download_file` | Download file Controlled Copy đã phân phối | Download bật; bản được xem; chưa hết hạn; policy một-lần-download được server ghi nhận/tiêu thụ. |
| `documents.controlled_copy.view_evidence` | Xem evidence lost/damaged | Cần quyền evidence và visibility của record. |
| `documents.controlled_copy.download_evidence` | Download evidence | Cần evidence authorization. |
| `documents.controlled_copy.upload_evidence` | Upload evidence | Trạng thái xử lý lost/damaged và policy phù hợp. |

## 5. Quyền Document Control không phải là action chuyển trạng thái trực tiếp

| Permission code | Module / chức năng | Trạng thái | Cách dùng hiện tại |
|---|---|---|---|
| `documents.module.view` | Vào module Document Control | Không áp dụng | Hiển thị/truy cập module; vẫn qua route và data-scope. |
| `documents.workspace.manage` | Entitlement vận hành workspace | Tùy ngữ cảnh | Được dùng làm policy actor trong nhiều action document/revision/controlled-copy. Không chỉ là “xem workspace”; hiện mở nhiều hành động vận hành. |
| `documents.document.view` | Xem document được phép | Mọi trạng thái nhìn thấy | Visibility document thông thường. |
| `documents.document.view_all` | Xem mọi document | Mọi trạng thái | Entitlement visibility rộng, vượt qua ownership/workflow visibility thông thường. |
| `documents.document.create` | Tạo Document Master | New/Draft | Tạo Document Master. |
| `documents.document.edit_metadata` | Sửa metadata Document / dữ liệu review cycle | UI tùy ngữ cảnh | Mô tả catalog nói master metadata và review cycle. Cần phân biệt với `documents.document.update_metadata` hiện bị workflow giới hạn ở Draft. |
| `documents.document.view_audit` | Xem Audit Trail của document | Mọi document nhìn thấy | Entitlement xem audit; vẫn phải tôn trọng record visibility. |
| `documents.document.cancel` | Hủy Document Master | Draft | Được `CANCEL` policy dùng. |
| `documents.document.obsolete` | Obsolete Document Master | Active | Có trong catalog, nhưng action policy active hiện yêu cầu `documents.workspace.manage`. |
| `documents.document.reopen` | Mở lại document closed/cancelled | Closed-Cancelled | Được `REOPEN` policy dùng. |
| `documents.document.update_metadata` | Cập nhật metadata Document Master | Draft | Được `UPDATE_METADATA` policy dùng. |
| `documents.document.configure_initial_workflow` | Thiết lập participant workflow ban đầu | New/Draft | Cấu hình Review/Approval lúc tạo mới. |
| `documents.document.preview_published` | Preview published document | Effective / published output được nhìn thấy | Preview file phát hành an toàn; vẫn cần document visibility. |
| `documents.document.download_published` | Download published document | Effective / published output được nhìn thấy | Download file phát hành an toàn; vẫn qua document visibility và download policy. |
| `documents.admin.view` | Màn hình quản trị Document | Không áp dụng | Truy cập view quản trị. |
| `documents.admin.manage_workflow_roles` | Quản lý cấu hình workflow role của Document | Không áp dụng | Cấu hình; bản thân nó không biến user thành Reviewer/Approver. |
| `documents.revision.configure_next_reviewers` | Đổi Reviewers cho Revision tiếp theo | Context upgrade Document/Revision Effective | Lưu participant cho Revision tiếp theo. |
| `documents.revision.configure_next_approvers` | Đổi Approvers cho Revision tiếp theo | Context upgrade Document/Revision Effective | Lưu participant cho Revision tiếp theo. |
| `documents.revision.configure_next_related_documents` | Đổi Related Documents cho Revision tiếp theo | Context upgrade Document/Revision Effective | Lưu cấu hình trước khi Revision tiếp theo đi vào workflow. |
| `documents.revision.configure_next_correlated_documents` | Đổi Correlated Documents cho Revision tiếp theo | Context upgrade Document/Revision Effective | Lưu cấu hình trước khi Revision tiếp theo đi vào workflow. |
| `documents.revision.open_publishing_workspace` | Mở Publishing Workspace | Ready for Publishing | Được action policy dùng. |
| `documents.revision.publish` | Permission publish trong catalog | Ready for Publishing | Có trong catalog nhưng `PUBLISH` policy runtime dùng `documents.workspace.manage`. |
| `documents.revision.complete_authoring` | Complete Authoring | Draft | Được action policy dùng, nhưng actor selector active đang thiếu. |
| `documents.revision.submit_review` | Submit Revision for Review | Draft, editing đã complete/locked | Được action policy dùng và đang phụ thuộc profile selector. |
| `documents.revision.review` | Complete Review | Pending Review | Được action policy dùng; actor selector hiện thiếu. |
| `documents.revision.reject_review` | Reject Review | Pending Review | Được action policy dùng; actor selector hiện thiếu. |
| `documents.revision.approve` | Complete Approval | Pending Approval | Được action policy dùng; actor selector hiện thiếu. |
| `documents.revision.reject_approval` | Reject Approval | Pending Approval | Được action policy dùng; actor selector hiện thiếu. |
| `documents.revision.cancel` | Hủy Revision | Draft | Catalog có code này nhưng `CANCEL` policy runtime dùng workspace-manage. |
| `documents.revision.upgrade` | Khởi tạo Revision tiếp theo | Effective | Được action policy dùng kèm workspace-manage actor. |
| `documents.revision.obsolete` | Obsolete Revision Effective | Effective | Được action policy dùng kèm workspace-manage actor. |
| `documents.training.manage` | Quản lý training của Revision | Pending Training / cấu hình training | Được `COMPLETE_TRAINING` dùng làm actor entitlement. |
| `documents.training.complete` | Hoàn thành training | Pending Training | Được `COMPLETE_TRAINING` dùng làm actor entitlement. |

## 6. Các permission còn lại theo module

Các permission dưới đây không có trạng thái vòng đời Document/Revision/Controlled Copy. “Không áp dụng” nghĩa là chúng quản lý màn hình, cấu hình, API hoặc thao tác quản trị thay vì chuyển trạng thái workflow.

### Security, Authorization và quản lý user

| Permission code | Chức năng / đối tượng sử dụng | Trạng thái |
|---|---|---|
| `settings.user.view` | Xem user hệ thống | Không áp dụng |
| `settings.user.create` | Tạo user hệ thống | Không áp dụng |
| `settings.user.edit` | Sửa profile/tài khoản user | Không áp dụng |
| `settings.user.delete` | Xóa/terminate user | Không áp dụng |
| `settings.user.reset_password` | Reset mật khẩu user | Không áp dụng |
| `settings.user.force_logout` | Bắt buộc logout session user | Không áp dụng |
| `users.invite_external` | Mời user eQMS thành Microsoft Entra guest | Không áp dụng; cần Graph provisioning và audit ở server |
| `users.resend_external_invitation` | Gửi lại Microsoft invitation | Không áp dụng |
| `users.retry_external_provisioning` | Thử lại Microsoft external provisioning thất bại | Không áp dụng |
| `users.disable_microsoft_access` | Vô hiệu Microsoft access đã liên kết | Không áp dụng |
| `users.remove_external_identity` | Gỡ liên kết external identity đã lưu | Không áp dụng |
| `users.view_external_provisioning` | Xem trạng thái Microsoft provisioning | Không áp dụng |
| `security.access_profiles.view` / `security.access_profiles.update` / `security.access_profiles.assign` | Xem, sửa và gán Access Profile | Không áp dụng |
| `security.permission_sets.view` / `security.permission_sets.update` | Xem hoặc sửa permission set | Không áp dụng |
| `security.object_rules.view` / `security.object_rules.manage` | Xem hoặc quản lý object-level access rule | Không áp dụng |
| `security.workflow_authorization.view` / `security.workflow_authorization.manage` | Xem hoặc cấu hình workflow policy/actor | Không áp dụng |
| `security.sod.view` / `security.sod.manage` | Xem hoặc cấu hình segregation-of-duties rule | Không áp dụng |
| `security.access_review.view` / `security.access_review.manage` | Xem hoặc quản lý access review | Không áp dụng |
| `security.maintenance.bypass` | Bypass khi bảo trì hệ thống | Không áp dụng; break-glass permission rủi ro cao |

### System settings, application settings và Controlled Copy Policy

| Permission code | Chức năng | Trạng thái |
|---|---|---|
| `settings.configuration.view` / `settings.configuration.edit` / `settings.configuration.manage` | Xem, sửa hoặc quản lý system configuration | Không áp dụng |
| `settings.dictionary.view` / `settings.dictionary.manage` | Xem hoặc quản lý data dictionary | Không áp dụng |
| `settings.publishing_template.view` / `settings.publishing_template.manage` | Xem hoặc quản lý publishing template | Không áp dụng |
| `settings.controlled_copy_policy.view` / `settings.controlled_copy_policy.manage` | Xem hoặc quản lý Controlled Copy Policy (view/download/print/expiry/recall) | Không áp dụng |
| `settings.notification_policy.view` / `settings.notification_policy.manage` | Xem hoặc quản lý notification policy | Không áp dụng |
| `settings.email_template.manage` | Quản lý email template | Không áp dụng |

### Audit, notifications, preferences, dashboard, reports và support

| Permission code | Chức năng | Trạng thái |
|---|---|---|
| `audittrail.module.view`, `audit.view`, `audit.export` | Mở, xem và export Audit Trail | Không áp dụng; vẫn cần visibility của entity nguồn |
| `audit.review.view`, `audit.review.manage` | Xem/quản lý workflow audit review | Không áp dụng |
| `notifications.module.view`, `notifications.recipient.qa_manager` | Mở notifications / chọn notification audience QA Manager | Không áp dụng |
| `preferences.module.view`, `preferences.module.edit` | Xem/sửa preferences của chính user | Không áp dụng |
| `dashboard.module.view`, `dashboard.admin.view` | Xem dashboard thường/quản trị | Không áp dụng |
| `report.module.view`, `report.module.export` | Xem/export report | Không áp dụng |
| `help_support.module.view`, `user_manual.module.view` | Help & Support / user manual | Không áp dụng |

### Work Management và Training

| Permission code | Chức năng | Trạng thái |
|---|---|---|
| `work_management.project.view`, `work_management.project.create`, `work_management.project.manage_members` | Xem/tạo Project và quản lý thành viên | Trạng thái theo Project, không phải workflow Document Control |
| `work_management.issue.create`, `work_management.issue.update` | Tạo/cập nhật Issue | Trạng thái theo Issue |
| `training.module.view` | Xem module Training | Module Training |
| `training.assignment.manage`, `training.material.manage`, `training.session.manage` | Quản lý Training assignment/material/session | Workflow Training; ngoài phạm vi Document Control hiện tại |

## 7. Các quyết định cần có trước khi sửa permission

1. **Submit for Review:** quyết định actor đúng là Author, Co-author, Submission Coordinator được chỉ định, pool theo document, hay workspace controller. Permission bắt buộc và actor selector đều phải được cấu hình có chủ đích.
2. **Review và approval:** policy active hiện không có actor. Cần quyết định complete/reject chỉ do participant được gán và đứng kế tiếp (`ASSIGNED_REVIEWER` / `ASSIGNED_APPROVER`) thực hiện hay không — đây là lựa chọn GMP kiểm soát thông thường.
3. **Operational workspace permission:** `documents.workspace.manage` hiện được dùng cho cancel/obsolete Document, publish/cancel/upgrade Revision và phần lớn thao tác Controlled Copy. Cần quyết định giữ nó là entitlement bao trùm hay tách thành các immutable permission hẹp hơn.
4. **Controlled Copy requester/viewer:** quyết định mọi Document Viewer có thể tự request một bản cho mình, trong khi chỉ người vận hành được chỉ định mới request batch/phân phối external. Code hiện đã có phân biệt này, nhưng policy runtime đang giới hạn request cho workspace manager.
5. **Di trú profile selector:** `ACCESS_PROFILE:DCO` và `ACCESS_PROFILE:DOCUMENT_CONTROLLER` là cấu hình lưu trong DB, không phải label UI, nhưng vẫn làm workflow phụ thuộc profile code. Nơi nào rule nghiệp vụ không thật sự theo profile thì thay bằng object relationship/immutable capability selector.
6. **Sai khác catalog:** thêm hoặc loại `documents.controlled_copy.print`; policy và code đang tham chiếu nhưng permission catalogue chưa có. Cần xử lý khác biệt trạng thái DB-vs-Java của regenerate snapshot và các permission Document/Revision dư thừa hoặc chưa được policy sử dụng ở trên.

## 8. Cách khuyến nghị để ghi nhận từng quyết định

Trước khi implement mỗi action, ghi nhận các trường dưới đây:

| Trường quyết định | Ví dụ với Submit for Review |
|---|---|
| Immutable permission | `documents.revision.submit_review` |
| Actor selector hợp lệ | `AUTHOR`, có thể thêm `CO_AUTHOR`, hoặc participant `SUBMISSION_COORDINATOR` mới |
| Nguồn assignment | Revision Author / bảng Workflow Participant / assignment tường minh theo Document |
| Trạng thái cho phép | `DRAFT` |
| Điều kiện bắt buộc | Editing completed, source locked, đã cấu hình Reviewer bắt buộc |
| Trường hợp loại trừ | Revision terminal; không qua SoD; user ngoài document scope |
| Hành vi UI | Capability API trả allowed/denied; ẩn action không khả dụng, không dùng button disabled làm cơ chế bảo mật |
| Audit event | Snapshot actor, permission, policy ID/version, object/trạng thái trước-sau, reason/chữ ký khi cần |

Biểu mẫu này cho phép cấp một permission cho user tại một chức năng cụ thể mà không vô tình cấp nó cho mọi document hoặc mọi trạng thái vòng đời.
