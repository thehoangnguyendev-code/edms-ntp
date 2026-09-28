# Đề xuất mô hình quyền theo ngữ cảnh đối tượng

> **Catalog đích để phê duyệt** nằm ngay sau phần mở đầu của tài liệu này.

## A. Danh mục quyền đích đề xuất

Catalog này là đích để refactor, **chưa phải migration**. Code quyền ổn định theo cú pháp `<module>.<resource>.<action>`; đổi tên role/profile chỉ đổi nhãn hiển thị, không đổi code. State, quan hệ actor (Author, reviewer được gán...) và SoD luôn do server đánh giá bằng workflow policy/capability contract.

### A1. Quy ước đọc dữ liệu

1. `view` = xem Detail + tab thông thường + preview chuẩn + object audit.
2. Download, print, source DOCX, evidence nhạy cảm và export là action tách riêng.
3. `scope.all` chỉ mở rộng phạm vi dữ liệu; không thay thế quyền `view`. Scope còn lại đến từ quan hệ dữ liệu: owner, author, participant, requester, recipient, BU/department hoặc policy.
4. Không tạo quyền riêng cho View Detail, View tab Document hay View object audit. Chúng là capability kế thừa để không bùng nổ catalog.

### A2. Platform, dashboard, report và hỗ trợ

| Code | Mục đích |
|---|---|
| `dashboard.view` | Xem dashboard trong scope được cấp. |
| `dashboard.admin.view` | Xem dashboard toàn cục/quản trị. |
| `reports.view` | Xem báo cáo trong scope. |
| `reports.export` | Xuất báo cáo; server filter và audit. |
| `support.help.view` | Xem Help & Support. |
| `support.manual.view` | Xem User Manual. |
| `preferences.view` | Xem Preferences của chính mình. |
| `preferences.update` | Cập nhật Preferences của chính mình. |

### A3. Document Master

| Code | Mục đích | Điều kiện ngữ cảnh |
|---|---|---|
| `documents.module.view` | Vào Document Control | Không tự cấp xem mọi document. |
| `documents.document.create` | Tạo Document Master | User được profile gán quyền. |
| `documents.document.view` | Xem detail, tab chuẩn, published preview, object audit | Scope record hợp lệ. |
| `documents.document.scope.all` | Xem toàn bộ document trong scope tổ chức | Không tự cấp create/update/download. |
| `documents.document.update_draft` | Sửa metadata Document Master | Chỉ state policy cho phép. |
| `documents.document.configure_initial_workflow` | Chọn participant lúc tạo mới | Actor policy, không tên DCO. |
| `documents.document.configure_next_participants` | Đổi Reviewer/Approver cho revision kế tiếp | Không sửa revision đang pending. |
| `documents.document.configure_next_relationships` | Đổi Related/Correlated Document cho revision kế tiếp | Lưu qua Save tại Document Master. |
| `documents.document.cancel` | Cancel Document Master | Reason/e-signature nếu policy yêu cầu. |
| `documents.document.reopen` | Reopen Closed-Cancelled | Reason/audit bắt buộc. |
| `documents.document.obsolete` | Obsolete Active Document | Lifecycle policy + e-signature. |

### A4. Revision và Office Online

| Code | Mục đích | Điều kiện ngữ cảnh |
|---|---|---|
| `documents.revision.view` | Xem revision detail, preview, object audit | Kế thừa document scope hoặc assignment exception. |
| `documents.revision.update_draft` | Sửa metadata revision Draft | Actor + state. |
| `documents.revision.upload_source` | Upload/thay source DOCX | Actor revision + Draft. |
| `documents.revision.edit_online` | Soạn thảo Office Online | Author/Co-author hoặc actor policy. |
| `documents.revision.sync_office_online` | Đồng bộ Office Online về kho chính thức | Không tự cho edit online. |
| `documents.revision.generate_preview` | Tạo/regen preview | Có thể chạy system job sau action hợp lệ. |
| `documents.revision.complete_authoring` | Complete Editing | Author/Co-author/actor policy + e-signature. |
| `documents.revision.submit_review` | Draft → Pending Review | Coordinator được gán theo policy. |
| `documents.revision.complete_review` | Complete Review | Assigned reviewer + Pending Review. |
| `documents.revision.reject_review` | Reject Review | Assigned reviewer + reason/e-signature. |
| `documents.revision.complete_approval` | Complete Approval | Assigned approver + SoD + Pending Approval. |
| `documents.revision.reject_approval` | Reject Approval | Assigned approver + reason/e-signature. |
| `documents.revision.open_publishing_workspace` | Mở Publishing Workspace | Ready for Publishing + actor policy. |
| `documents.revision.publish` | Publish revision | Publishing actor + e-signature. |
| `documents.revision.cancel` | Cancel revision | State policy. |
| `documents.revision.upgrade` | Khởi tạo revision mới từ Effective | Không đồng nghĩa upload source. |
| `documents.revision.obsolete` | Obsolete revision Effective | Lifecycle policy. |
| `documents.revision.training.manage` | Cấu hình training revision | Tách khỏi approval/publish. |
| `documents.revision.training.complete` | Ghi nhận hoàn tất training | Assigned trainee/training actor. |

`Open File to Comment` không là permission riêng: server trả capability từ `documents.revision.view` + assignment reviewer/approver + state; loại Office link do server quyết định.

### A5. Controlled Copy — Batch và Record tách biệt

Batch là request phân phối chung. Record là từng controlled copy có mã/recipient riêng. Recipient chỉ được xem Record của mình, không mặc định xem Batch hoặc recipient khác.

| Code | Mục đích | Scope/điều kiện |
|---|---|---|
| `documents.controlled_copy.batch.request` | Tạo request batch hoặc record đơn | Document/Revision Effective + policy. |
| `documents.controlled_copy.batch.view` | Xem batch, child list, batch audit | Requester/coordinator/scope policy. |
| `documents.controlled_copy.batch.distribute` | Distribute toàn batch | Ready + e-signature; xử lý từng child. |
| `documents.controlled_copy.batch.recall` | Recall batch | Child-by-child, reconciliation. |
| `documents.controlled_copy.batch.cancel_request` | Cancel batch chưa distribute | Không tác động child đã distribute. |
| `documents.controlled_copy.record.view` | Xem record detail, preview, record audit | Recipient/requester/coordinator/scope policy. |
| `documents.controlled_copy.record.download` | Tải file record | Chỉ khi Controlled Copy Policy bật Download; server consume quota atomically. |
| `documents.controlled_copy.record.print` | In file record | Chỉ khi Controlled Copy Policy bật Print; server consume quota/audit trước khi in. |
| `documents.controlled_copy.record.recall` | Recall một record | Không cần quyền batch. |
| `documents.controlled_copy.record.report_lost_damaged` | Báo mất/hỏng | Policy + evidence/reason. |
| `documents.controlled_copy.record.replace_lost_damaged` | Replace sau sự cố | Coordinator/policy, không tự cho reporter. |
| `documents.controlled_copy.record.upload_evidence` | Upload evidence | MIME/virus/hash/retention validation. |
| `documents.controlled_copy.record.view_evidence` | Xem evidence | Tách khỏi `record.view`. |
| `documents.controlled_copy.record.download_evidence` | Tải evidence | Audit chặt, không gán mặc định. |
| `documents.controlled_copy.record.expire` | Đánh dấu hết hạn | **System-only**. |

External, BU/Department/Individual, số lượng và expiry không là permission mới: chúng là Controlled Copy Policy + recipient scope, được server kiểm tra kèm quyền batch/record.

**Quyết định phạm vi file:** Document và Revision chỉ có capability preview/xem nội dung; không có action Download hoặc Print cho preview nên không tồn tại permission đích tương ứng. Chỉ Controlled Copy Record có `download` và `print`; capability chỉ được trả khi đồng thời có permission, record còn hiệu lực và Controlled Copy Policy của Admin bật action đó (kèm quota một lần nếu được cấu hình).

### A6. Audit, Notification, User và Microsoft Entra

| Code | Mục đích |
|---|---|
| `audit.global.view` | Xem audit ngoài object scope; object audit kế thừa quyền xem object. |
| `audit.global.export` | Xuất audit toàn cục, có redaction server-side. |
| `audit.review.view` / `audit.review.manage` | Xem/xử lý audit-review. |
| `notifications.inbox.view` | Xem inbox của chính mình. |
| `notifications.policy.view` / `notifications.policy.manage` | Xem/quản lý notification policy. |
| `notifications.template.view` / `notifications.template.manage` | Xem/quản lý notification template có version/audit. |
| `notifications.audience.manage` | Quản lý audience/recipient rule, không hard-code QA Manager. |
| `notifications.failure.manage` | Retry/resolve notification failure an toàn. |
| `security.users.view` / `security.users.create` / `security.users.update` | Xem/tạo/sửa user eQMS. |
| `security.users.suspend` / `security.users.terminate` | Suspend/terminate không xóa historical user. |
| `security.users.reset_password` / `security.users.force_logout` | Reset password/buộc logout. |
| `security.users.external_identity.view` | Xem Entra provisioning/link status từ server. |
| `security.users.external_identity.invite` | Mời Entra guest. |
| `security.users.external_identity.retry` | Resend/retry, không tạo duplicate Guest. |
| `security.users.external_identity.disable` | Disable Microsoft access, không mặc định xóa Guest tenant. |
| `security.users.external_identity.unlink` | Gỡ eQMS–Entra link có reason/audit. |

### A7. Authorization administration, settings, integration, work và training

| Code | Mục đích |
|---|---|
| `security.access_profiles.view` / `security.access_profiles.manage` / `security.access_profiles.assign` | Xem/quản lý/gán Access Profile; chống self-escalation. |
| `security.permission_sets.view` / `security.permission_sets.manage` | Xem/quản lý permission set/catalog. |
| `security.object_access_rules.view` / `security.object_access_rules.manage` | Xem/quản lý object scope rule. |
| `security.workflow_policies.view` / `security.workflow_policies.manage` | Xem/quản lý actor/state/workflow policy. |
| `security.sod_rules.view` / `security.sod_rules.manage` | Xem/quản lý SoD/exception. |
| `security.access_reviews.view` / `security.access_reviews.manage` | Xem/thực hiện access review. |
| `security.break_glass.use` | Emergency access: TTL, justification, audit/hậu kiểm. |
| `settings.system.view` / `settings.system.manage` | Xem/quản lý system settings. |
| `settings.data_dictionary.view` / `settings.data_dictionary.manage` | Xem/quản lý data dictionary. |
| `settings.navigation_labels.view` / `settings.navigation_labels.manage` | Xem/quản lý sidebar, breadcrumb, page title. |
| `settings.email_templates.view` / `settings.email_templates.manage` | Xem/quản lý email template. |
| `settings.office_online.view` / `settings.office_online.manage` / `settings.office_online.test` | Xem/cấu hình/test Graph Office Online; secret masked. |
| `settings.storage.view` / `settings.storage.manage` / `settings.storage.test` | Xem/cấu hình/test storage; secret masked. |
| `settings.publishing_templates.view` / `settings.publishing_templates.manage` | Xem/quản lý publishing template. |
| `settings.controlled_copy_policy.view` / `settings.controlled_copy_policy.manage` | Xem/quản lý CC policy. |
| `work.projects.view`, `work.projects.create`, `work.projects.update`, `work.projects.manage_members`, `work.projects.scope.all` | Project theo member/owner hoặc scope all. |
| `work.issues.view`, `work.issues.create`, `work.issues.update` | Issue theo assignment/state policy. |
| `training.module.view` | Vào Training. |
| `training.material.view` / `training.material.manage` | Xem/quản lý material. |
| `training.assignment.view` / `training.assignment.manage` | Xem/quản lý assignment. |
| `training.session.view` / `training.session.manage` | Xem/quản lý session. |
| `training.completion.record` | Ghi nhận completion cho assignment hợp lệ. |

## B. Mapping bắt buộc từ catalog hiện tại

| Hiện tại | Đích | Quyết định |
|---|---|---|
| `documents.document.view_all` | `documents.document.scope.all` | Đổi code/scope. |
| `documents.document.preview_published`, `documents.revision.preview`, `documents.document.view_audit` | Capability kế thừa `*.view` | Không gán mới; alias tạm thời. Preview Document/Revision không có Download hoặc Print. |
| Bốn `configure_next_*` của revision | Hai `documents.document.configure_next_*` | Hợp nhất tại Document Master. |
| `documents.revision.review`, `documents.revision.approve` | `complete_review`, `complete_approval` | Rõ action. |
| `documents.workspace.manage` | Các action cụ thể | Loại siêu quyền bypass workflow. |
| `documents.controlled_copy.*` hiện tại | Nhóm `batch.*` + `record.*` | Tách batch/record; bổ sung print. |
| `audit.view`, `audittrail.module.view` | `audit.global.view` | Hợp nhất global audit. |
| `app-settings.*`, `settings.*`, `system-admin.*` | `settings.*` và `security.*` | Chuẩn hóa namespace. |
| `notifications.recipient.qa_manager` | `notifications.audience.manage` + data rule | Không nhét tên role vào code. |
| `security.maintenance.bypass` | `security.break_glass.use` | TTL + justification + audit. |

## C. Quy tắc runtime và trình tự refactor

| Tình huống | Server bắt buộc kiểm tra | Không được dựa vào |
|---|---|---|
| Submit for Review | Permission + coordinator assignment + Draft + SoD | Tên profile DCO. |
| Complete Editing | Permission + Author/Co-author/actor policy + Draft | Display role. |
| Complete Review | Permission + assigned reviewer + Pending Review | Department/profile name. |
| Complete Approval | Permission + assigned approver + Pending Approval + SoD | Display role. |
| Xem Controlled Copy | Permission/recipient grant + record hợp lệ | Quyền xem batch người khác. |
| Distribute batch | Permission + Ready + e-signature | Người đó có phải requester không. |
| Invite Entra guest | Permission + account target hợp lệ | `if (admin)`. |

Sau khi bạn phê duyệt: (1) chốt mapping, (2) migration versioned cho permission/policy actor stable identifier, (3) chuyển backend capability evaluator và mutation API trước, (4) FE chỉ đọc `resourceCapabilities`, (5) chạy authorization matrix allowed/denied theo state/actor rồi mới deprecate alias cũ.

**Trạng thái:** Đề xuất nghiệp vụ — chưa thay đổi code, API, database hoặc permission catalogue.  
**Căn cứ:** kiểm tra runtime catalogue ngày 05/08/2026, `DocumentAuthorizationService`, `SecureFileAccessService`, `AuditTrailService`, `ControlledCopyAuthorizationService` và các policy workflow active.

## 1. Vấn đề của mô hình hiện tại

### 1.1 Quyền xem đang bị tách không nhất quán

Hiện `DocumentAuthorizationService.canViewDocument` và `canViewRevision` chủ yếu dựa vào quan hệ Author/participant, hoặc `documents.document.view` khi bật strict visibility. Điều này dẫn đến các vấn đề:

- User là Author/Reviewer có thể xem Detail dù Access Profile không có một permission “view detail” rõ ràng.
- Preview file lại cần permission riêng (`documents.document.preview_published` hoặc `documents.revision.preview`). Vì vậy user xem được Detail nhưng không chắc xem được nội dung ở tab Document.
- Tab Audit Trail của Document/Revision hiện yêu cầu `audit.view` hoặc `audittrail.module.view`; `documents.document.view_audit` không phải nguồn quyết định backend cho tab này. Ngược lại, Controlled Copy đã dùng object-scoped audit access.

Kết quả là quyền nhìn thấy màn hình, xem nội dung và xem lịch sử của cùng một đối tượng không có quan hệ kế thừa dễ hiểu.

### 1.2 Batch Controlled Copy và record đơn lẻ có phạm vi dữ liệu khác nhau

Hệ thống đã có hai object type `CONTROLLED_COPY_BATCH` và `CONTROLLED_COPY`, nhưng policy batch hiện chỉ có Cancel/Distribute/Recall; các quyền đọc còn dùng chung hoặc suy ra từ Document/Revision.

Điều này chưa đủ an toàn:

- Người nhận một record không nên tự động nhìn thấy batch và email/tên của mọi người nhận khác.
- Người tạo request batch, người vận hành phân phối và người nhận record có trách nhiệm GMP khác nhau.
- Action cấp batch có “blast radius” lớn hơn action chỉ áp dụng một record; không nên mặc định dùng cùng một quyền nếu doanh nghiệp muốn tách nhiệm vụ.

## 2. Nguyên tắc thiết kế đề xuất

1. **Permission xác định loại hành động; scope xác định user làm trên đối tượng nào.** Ví dụ `documents.revision.submit_review` không tự cho phép Submit mọi revision; policy còn phải yêu cầu `AUTHOR`, `CO_AUTHOR` hoặc participant được chỉ định của revision đó.
2. **Quyền Detail là quyền đọc đối tượng cơ sở.** Khi đã có quyền đọc một Document/Revision/Controlled Copy record, user nên xem được các tab thông tin không nhạy cảm của chính đối tượng đó.
3. **Preview nội dung bình thường kế thừa từ quyền đọc đối tượng.** Download, print, sửa source, evidence nhạy cảm và export vẫn là quyền tách riêng.
4. **Object-scoped Audit Trail kế thừa từ quyền xem đối tượng.** `audit.view` chỉ dành cho trang Audit Trail toàn hệ thống, tìm kiếm xuyên entity và export audit; không bắt buộc để mở tab Audit Trail trong Detail.
5. **Batch không phải là “một record lớn”.** Batch chỉ hiển thị cho người có batch scope. Người nhận chỉ thấy record của mình; không được suy ra danh sách người nhận khác.
6. **Không dùng tên role hiển thị.** Actor selector dùng quan hệ bất biến như `AUTHOR`, `ASSIGNED_REVIEWER`, `RECIPIENT`, hoặc immutable permission code. Nếu cần một điều phối viên theo tài liệu, lưu participant tường minh như `SUBMISSION_COORDINATOR`, không dùng `DCO`.

## 3. Mô hình quyền đọc đề xuất

### 3.1 Document Master

| Capability | Đề xuất entitlement | Ai có scope | Nội dung được xem |
|---|---|---|---|
| Xem Detail Document | `documents.document.view` | Author, Co-author, workflow participant; hoặc user có `view_all`; với Effective có thể mở rộng theo strict visibility | General Information, Revision list, Related/Correlated data, Signatures, Audit Trail của Document. |
| Preview bản phát hành | Kế thừa `documents.document.view` | Cùng scope Detail; chỉ khi có published output hợp lệ | Tab Document/PDF published. |
| Audit toàn hệ thống / export | `audit.view` và `audit.export` | Theo quyền audit | Tìm kiếm/export xuyên entity; không phải điều kiện để xem Audit tab của Document Detail. |

`documents.document.preview_published` có thể được giữ tạm như compatibility alias trong giai đoạn migration, sau đó bỏ khỏi catalog nếu thực sự không cần tách Preview khỏi Detail.

### 3.2 Revision

| Capability | Đề xuất entitlement | Ai có scope | Nội dung được xem |
|---|---|---|---|
| Xem Detail Revision | Nên bổ sung `documents.revision.view` hoặc áp dụng rõ `documents.document.view` làm base entitlement | Author, Co-author, Reviewer/Approver được gán, user có `view_all`; Revision Effective theo strict visibility | Metadata, participant tabs, signatures và Audit Trail của revision. |
| Preview nội dung revision | Kế thừa quyền Detail Revision | Cùng scope Detail; chỉ file/snapshot phù hợp trạng thái | Draft: source preview cho Author/Co-author và participant hợp lệ; Pending Review/Approval: review snapshot; Effective: published PDF. |
| Edit Online / thay source | `documents.revision.edit_online`, `documents.revision.upload_source` | Không kế thừa | Chỉ Author/Co-author hoặc participant policy được chỉ định trong Draft. |

Nếu doanh nghiệp muốn user xem metadata Revision nhưng không xem nội dung tài liệu, phải tạo capability riêng `view_metadata` và `view_content`. Tuy nhiên đây là trường hợp đặc biệt; không nên là mặc định cho mọi Revision.

### 3.3 Controlled Copy record đơn lẻ

| Capability | Đề xuất entitlement | Scope cần có | Ghi chú |
|---|---|---|---|
| Xem Detail record | `documents.controlled_copy.view` | Recipient của record, requester, người phân phối/recall, hoặc user có quyền vận hành/record scope | Cho xem Document Information, Distribution Information, Signatures và Audit Trail của **record đó**. |
| Preview file | Kế thừa `documents.controlled_copy.view` | Cùng record scope + Portal View policy + chưa hết hạn | Không làm lộ record khác. |
| Download/Print | `documents.controlled_copy.download_file` / `documents.controlled_copy.print` | Cùng record scope + policy + chưa hết hạn | Tách riêng vì là kiểm soát phát hành. |
| View/Download Evidence | `documents.controlled_copy.view_evidence` / `download_evidence` | Scope Evidence được cấp riêng | Evidence có thể chứa ảnh nhạy cảm; không nhất thiết cấp cho mọi Recipient. |
| Report lost/damaged | `documents.controlled_copy.report_lost_damaged` | Record được phân phối và policy cho phép | Nên theo actor policy, không theo tên role. |

### 3.4 Controlled Copy Batch

| Capability | Đề xuất entitlement | Scope cần có | Ghi chú |
|---|---|---|---|
| Xem Detail batch | Nên bổ sung `documents.controlled_copy.batch.view` | Requester batch, người vận hành được chỉ định, hoặc workspace scope | Hiển thị aggregate: scope request, số lượng, trạng thái child; không tự cấp cho Recipient. |
| Xem Audit batch | Kế thừa batch view | Cùng batch scope | Chỉ audit của batch, không phải audit mọi child ngoài phạm vi. |
| Distribute batch | Nên tách `documents.controlled_copy.batch.distribute` nếu doanh nghiệp muốn phân tách khỏi record | Operator/participant được policy chỉ định | Có blast radius lớn; kết quả từng child phải được audit. |
| Recall/Cancel batch | Nên tách `documents.controlled_copy.batch.recall`, `documents.controlled_copy.batch.cancel_request` nếu yêu cầu SoD | Operator/participant được policy chỉ định | Không tự cho phép chỉ vì có quyền recall một record. |

## 4. Ma trận visibility bắt buộc

| Chủ thể | Document / Revision Detail | Document/Revision Audit tab | Batch Detail | Record đơn lẻ của mình | Record của người khác |
|---|---|---|---|---|---|
| Author / Co-author | Có, trong document scope | Có | Không mặc định | Chỉ khi là requester/recipient hoặc được cấp record scope | Không mặc định |
| Reviewer / Approver được gán | Có, trong assignment scope | Có | Không mặc định | Không mặc định | Không mặc định |
| User chỉ xem tài liệu Effective | Có theo strict visibility | Có, object-scoped | Không mặc định | Chỉ record mà họ là recipient/requester | Không |
| Recipient Controlled Copy | Có thể không cần vào Document Detail; tùy portal policy | Audit record của mình | Không | Có | Không |
| Requester batch | Theo document scope | Theo document scope | Có | Có với child do request tạo ra, nếu policy cho phép | Không tự động với batch khác |
| Người vận hành được policy chỉ định | Theo permission + scope | Có | Có | Có trong phạm vi được vận hành | Có trong phạm vi được vận hành |
| User có `documents.document.view_all` | Có | Có | Không tự động; vẫn cần batch scope | Không tự động | Không tự động |

Điểm cốt lõi: `documents.document.view_all` không nên đồng nghĩa “đọc mọi Controlled Copy”, vì Controlled Copy có dữ liệu phân phối/recipient riêng và có thể có evidence nhạy cảm.

## 5. Cách xử lý Submit for Review theo yêu cầu ví dụ

Không quy định “DCO Submit for Review”. Cấu hình nên có bốn lớp:

| Lớp | Giá trị ví dụ |
|---|---|
| Permission chung | `documents.revision.submit_review` |
| Actor workflow | `AUTHOR`, `CO_AUTHOR`, hoặc `SUBMISSION_COORDINATOR` |
| Assignment theo record | Author Revision / participant Co-author / participant Submission Coordinator của Revision |
| State + điều kiện | `DRAFT`, editing `COMPLETED`, source locked, reviewer configuration hợp lệ |

Nhờ đó một user bất kỳ có permission này chỉ Submit được Revision mà họ thực sự là Author/Co-author/Coordinator được gán. Đổi tên role hoặc thay Access Profile không làm đổi logic nghiệp vụ.

## 6. Lộ trình thay đổi an toàn nếu được phê duyệt

1. **Chốt ma trận ở mục 4:** quyết định Detail, Preview, Audit, Evidence và Batch visibility cho từng chủ thể.
2. **Tạo capability contract thống nhất:** `viewDetail`, `viewContent`, `viewAudit`, `download`, `print`, `viewEvidence`, các mutation. FE chỉ render theo contract này.
3. **Sửa backend trước:** tập trung `DocumentAuthorizationService`, `SecureFileAccessService`, `AuditTrailService`, `ControlledCopyAuthorizationService`; mutation API vẫn kiểm tra lại server-side.
4. **Migration permission catalog:** thêm code batch nếu được duyệt; giữ permission preview cũ thành alias trong một release, cập nhật Access Profile rồi mới loại bỏ alias.
5. **Migration workflow policy:** thay selector profile như `ACCESS_PROFILE:DCO` bằng actor relation/participant phù hợp. Bổ sung selector bắt buộc cho Review/Approval đang thiếu actor.
6. **Kiểm thử ma trận:** test API capability và mutation cho Author, Co-author, Reviewer #1/#2, Approver #1/#2, requester batch, recipient, external recipient, operator và user không liên quan; lặp lại ở từng trạng thái.
7. **Audit và rollback:** version policy, audit mọi thay đổi cấu hình quyền, có migration rollback và báo cáo Access Profile bị ảnh hưởng.

## 7. Các quyết định cần bạn chốt

1. Xem Document/Revision Detail có luôn bao gồm Preview nội dung hay có ngoại lệ nào?
2. Tab Audit Trail Detail có kế thừa quyền xem đối tượng hay muốn giữ quyền audit riêng cho một số loại tài liệu?
3. Evidence lost/damaged có cho Recipient xem hay chỉ DCO/Requester/QA được chỉ định?
4. Batch distribute/recall/cancel có cần tách permission riêng khỏi thao tác trên record đơn lẻ không?
5. User có `view_all` có được xem Controlled Copy của người khác hay chỉ xem Document/Revision?
6. Actor nào được phép Submit for Review: Author, Co-author, Coordinator được chỉ định, hay nhiều lựa chọn theo Document Type?

Chỉ sau khi các quyết định này được chốt mới nên thay đổi permission code, policy actor và API, để tránh một lần refactor lại tạo thêm ngoại lệ.

## 8. Mức độ chi tiết cần thiết: chi tiết ngữ cảnh, không nhân bản permission vô hạn

Phân quyền càng **rõ ngữ cảnh** thì càng dễ đúng và dễ kiểm toán. Tuy nhiên, không nên tạo một permission code cho mọi button, mọi tab và mọi trạng thái. Điều đó làm Access Profile khó quản lý, dễ gán thiếu/thừa quyền và khó review định kỳ.

Mỗi hành động nên được mô tả bằng sáu thành phần dưới đây:

| Thành phần | Ý nghĩa | Ví dụ |
|---|---|---|
| Resource | Đối tượng bị tác động | `DOCUMENT`, `REVISION`, `CONTROLLED_COPY`, `CONTROLLED_COPY_BATCH` |
| Capability | Loại hành động chuẩn | `VIEW_DETAIL`, `VIEW_CONTENT`, `VIEW_AUDIT`, `CREATE`, `UPDATE`, `TRANSITION`, `DOWNLOAD`, `PRINT`, `MANAGE_POLICY` |
| Permission | Entitlement bất biến được gán qua Access Profile | `documents.revision.submit_review` |
| Scope | User được tác động lên record nào | Author của revision, Reviewer được gán, recipient record, Department, Business Unit, tất cả record |
| State / condition | Trạng thái và điều kiện nghiệp vụ | `DRAFT`, source locked, chưa hết hạn, là participant kế tiếp |
| Accountability | Audit/e-signature/SoD có bắt buộc không | Ký điện tử khi Publish, reason khi Reject, không tự review tài liệu mình tạo nếu SoD bật |

Một permission mới chỉ nên được tạo khi ít nhất một yếu tố sau khác thật sự: người chịu trách nhiệm, mức độ rủi ro GMP, phạm vi dữ liệu, yêu cầu chữ ký/audit hoặc hậu quả của hành động.

## 9. Mô hình scope dùng chung cho toàn hệ thống

Không dùng display role làm scope. Các scope dưới đây có thể dùng chung giữa nhiều module:

| Scope code đề xuất | Cách xác định ở server | Ví dụ áp dụng |
|---|---|---|
| `SELF` | `currentUser.id == owner/creator/recipient` | User sửa Preferences của mình, Recipient xem Controlled Copy của mình. |
| `OWNER` | User là owner của Document/Project/record | Chủ sở hữu sửa Draft metadata nếu có permission. |
| `AUTHOR` / `CO_AUTHOR` | Quan hệ Author/Co-author trên Revision | Edit Online, Complete Authoring, Submit for Review. |
| `ASSIGNED_REVIEWER` / `ASSIGNED_APPROVER` | `workflow_participants`; chỉ participant đang `PENDING` và đứng đầu sequence | Complete/Reject Review hoặc Approval. |
| `ASSIGNED_COORDINATOR` | Participant tường minh theo document/revision/batch | Submit coordinator, publishing coordinator, distribution coordinator. |
| `REQUESTER` | User tạo request/batch | Xem request batch và cancel trước phân phối. |
| `RECIPIENT` | User/email là recipient của record Controlled Copy | Xem record đơn lẻ của chính mình. |
| `DEPARTMENT_SCOPE` | User được cấp scope Department qua object access rule | Xem/điều phối record trong Department được gán. |
| `BUSINESS_UNIT_SCOPE` | User được cấp scope Business Unit | Quản lý document/controlled copies của Unit được gán. |
| `DOCUMENT_TYPE_SCOPE` | User được cấp scope Document Type | Reviewer pool hoặc quản trị tài liệu một loại cụ thể. |
| `ALL_RECORDS` | Quyền toàn cục, có lý do và audit | System configuration, global audit, cross-unit administration. |

`ACCESS_PROFILE:<code>` vẫn có thể tồn tại để gán **entitlement**, nhưng không nên là scope workflow mặc định. Cách bền vững là Access Profile cấp `permission` và policy kiểm tra quan hệ bất biến ở trên.

## 10. Danh mục capability chuẩn nên dùng cho mọi module

| Nhóm capability | Ý nghĩa | UI/API xử lý |
|---|---|---|
| `VIEW_LIST` | Được thấy record trong danh sách | Backend filter SQL theo scope; không chỉ ẩn row ở FE. |
| `VIEW_DETAIL` | Mở Detail và các tab metadata chuẩn | API detail kiểm tra lại scope. |
| `VIEW_CONTENT` | Xem PDF/file/nội dung không được download | Thường kế thừa từ Detail, trừ content nhạy cảm. |
| `VIEW_AUDIT` | Xem Audit Trail gắn với một resource | Kế thừa Detail; global audit là capability khác. |
| `VIEW_EVIDENCE` | Xem ảnh/file evidence nhạy cảm | Tách riêng khi có ảnh sự cố, thông tin cá nhân hoặc commercial information. |
| `CREATE` | Tạo resource mới | Scope xác định loại/Unit được tạo. |
| `UPDATE_DRAFT` | Sửa metadata/file khi còn Draft | Không dùng cho record Effective/Distributed. |
| `CONFIGURE_PARTICIPANTS` | Đổi Reviewer/Approver/related documents | Phải theo state và ownership/coordinator scope. |
| `TRANSITION_*` | Chuyển trạng thái workflow | Luôn qua policy actor, status, SoD, e-signature/reason. |
| `DOWNLOAD` / `PRINT` | Sao chép nội dung ra ngoài kiểm soát portal | Permission và policy riêng; audit bắt buộc. |
| `MANAGE_POLICY` | Thay đổi rule/configuration | Chỉ người có scope quản trị; e-signature/audit khi GMP-impacting. |
| `EXPORT` | Xuất dữ liệu hoặc audit | Không kế thừa từ view; phải kiểm tra data scope trong file export. |
| `ADMINISTER` | Thao tác quản trị nguy cơ cao | Chỉ permission hẹp, có change reason/e-signature tùy cấu hình. |

## 11. Ma trận đề xuất theo toàn bộ module hiện có

### 11.1 Document Control: Document Master và Revision

| Chức năng | Capability / permission hiện có hoặc đề xuất | Scope nên có | Trạng thái / điều kiện | Kiểm soát GMP |
|---|---|---|---|---|
| Tạo Document | `documents.document.create` | Business Unit/Document Type được cấp | Chưa có revision | Audit tạo record. |
| Cấu hình workflow ban đầu | `documents.document.configure_initial_workflow` | Owner hoặc Coordinator được gán | New/Draft | Validate SoD trước lưu; audit old/new. |
| Xem Document Detail | `documents.document.view` | Document scope | Mọi trạng thái nhìn thấy | Không cần e-signature. |
| Sửa metadata Draft | `documents.document.update_metadata` | Owner/Coordinator theo policy | `DRAFT` | Audit old/new. |
| Sửa metadata Effective / Review Date / participant revision kế tiếp | Các `configure_next_*` và `edit_metadata` cần chuẩn hóa | Coordinator được gán / document scope | Document `ACTIVE`, Revision `EFFECTIVE` | Save rõ ràng, audit before/after; không tự áp dụng khi chưa Save. |
| Upload Revision | `documents.revision.upload_source` | Author của revision / Co-author khi policy cho phép | Revision `DRAFT` | File validation, versioning, audit. |
| Edit Online | `documents.revision.edit_online` | Author/Co-author | `DRAFT`, chưa source locked | Không cho Reviewer/Approver quyền sửa source. |
| Complete Authoring | `documents.revision.complete_authoring` | Author/Co-author hoặc Coordinator được chỉ định | `DRAFT`, source chưa lock | E-signature/reason nếu yêu cầu; sau đó khóa source. |
| Submit for Review | `documents.revision.submit_review` | `AUTHOR`, `CO_AUTHOR` hoặc `ASSIGNED_COORDINATOR` | `DRAFT`, editing completed, source locked | Validate Reviewer đã cấu hình và SoD. |
| Complete/Reject Review | `documents.revision.review`, `reject_review` | `ASSIGNED_REVIEWER` kế tiếp | `PENDING_REVIEW` | E-signature, comment/reason; không tự review nếu SoD cấm. |
| Complete/Reject Approval | `documents.revision.approve`, `reject_approval` | `ASSIGNED_APPROVER` kế tiếp | `PENDING_APPROVAL` | E-signature, reason khi reject, sequence. |
| Publish | `documents.revision.publish` | Publishing coordinator được gán | `READY_FOR_PUBLISHING` | E-signature, immutable published output, audit. |
| Obsolete / Upgrade | `documents.revision.obsolete`, `upgrade` | Coordinator/owner được policy chỉ định | `EFFECTIVE` | Không hủy dữ liệu; tạo audit và giữ version. |
| Reopen/Cancel Document | `documents.document.reopen`, `cancel` | Coordinator có scope | State đúng policy | Reason + audit; không xóa record. |

### 11.2 Controlled Copies

| Chức năng | Capability / permission | Scope nên có | State / điều kiện | Kiểm soát GMP |
|---|---|---|---|---|
| Request một bản cho mình | `documents.controlled_copy.request` | `DOCUMENT_VIEWER` / `SELF` | Document Active, Revision Effective | Chỉ recipient là requester; không tạo batch vô tình. |
| Request batch cho Unit/Department/Individual/External | Cùng permission hoặc permission batch tách riêng theo quyết định | `ASSIGNED_COORDINATOR` hoặc scope Unit/Department | Document Active, Revision Effective | Validate recipient, quantity, external approval/audit. |
| Xem batch | Đề xuất `documents.controlled_copy.batch.view` | Requester hoặc operator | Mọi state cho phép | Không cấp cho recipient đơn lẻ. |
| Phân phối batch | Đề xuất `documents.controlled_copy.batch.distribute` nếu cần tách | Distribution coordinator | Batch Ready for Distribution | Child-by-child result, retry có idempotency, e-signature nếu cấu hình. |
| Xem record | `documents.controlled_copy.view` | Recipient/requester/operator | Record Ready/Distributed theo policy | Không trả dữ liệu recipient khác. |
| Preview record | Kế thừa view record | Cùng record scope | Portal view bật, chưa expiry | Audit open/page/close. |
| Download / Print | `download_file` / `print` | Cùng record scope | Policy bật, chưa expiry | Audit và one-time allowance nếu policy bật. |
| Recall record / batch | `recall`, hoặc code batch tách | Coordinator/operation scope | State policy + manual recall enabled | Audit, thu hồi token/link/email. |
| Report Lost/Damaged | `report_lost_damaged` | Recipient hoặc coordinator, theo chính sách | `DISTRIBUTED` | Reason, evidence, e-signature nếu cần. |
| Replace Lost/Damaged | `replace_lost_damaged` | Coordinator | Record lost/damaged/obsolete | Tạo record mới, không sửa lịch sử record cũ. |
| Evidence | `view_evidence`, `download_evidence`, `upload_evidence` | Reporter/coordinator/QA tùy quyết định | Lost/Damaged context | Evidence hash, original/derived, audit view/download. |

### 11.3 User Management, Access Profile và Microsoft Entra

| Chức năng | Permission hiện có | Scope nên có | Kiểm soát |
|---|---|---|---|
| Xem user | `settings.user.view` | Có thể giới hạn Unit/Department nếu cần | Không trả secret, password hash, token. |
| Tạo/sửa/terminate user | `settings.user.create`, `edit`, `delete` | Organization hoặc Unit scope | Audit old/new; SoD: không tự duyệt thay đổi quyền của chính mình. |
| Reset password / force logout | `settings.user.reset_password`, `force_logout` | User admin scope | Audit bắt buộc; notification cho user. |
| Gán Access Profile | `security.access_profiles.assign` | Không gán profile vượt scope của người thao tác | SoD, access review, audit trước/sau. |
| Sửa Permission Set/Profile | `security.permission_sets.update`, `security.access_profiles.update` | Global security administration | Change reason/e-signature nếu GMP-impacting; version policy. |
| Mời Microsoft Entra guest | `users.invite_external` | User management scope | Server Graph API, no secret in FE, audit result/object ID. |
| Resend/Retry/Disable Microsoft access | Permission riêng hiện có | User management scope | Không auto-delete guest; audit toàn bộ trạng thái provisioning. |
| Cấu hình workflow authorization/SoD | `security.workflow_authorization.manage`, `security.sod.manage` | Global security governance | Chỉ policy config, không được trực tiếp cấp khả năng hành động nếu không có permission và scope. |

### 11.4 Configuration, Publishing và tích hợp

| Chức năng | Permission hiện có | Scope / điều kiện | Kiểm soát |
|---|---|---|---|
| Xem/sửa System Configuration | `settings.configuration.view/edit/manage` | Global configuration scope | Chia read/edit/manage rõ; audit old/new; không trả secret về FE trừ cơ chế xem có kiểm soát. |
| Data Dictionary | `settings.dictionary.view/manage` | Theo dictionary/module nếu cần | Audit, không sửa code bất biến lịch sử. |
| Publishing Template | `settings.publishing_template.view/manage` | Template scope | Version template, preview test, audit placeholder/style. |
| Controlled Copy Policy | `settings.controlled_copy_policy.view/manage` | Global policy scope | Chính sách ảnh hưởng preview/download/print/expiry/recall; require change reason và audit. |
| Email template / notification policy | `settings.email_template.manage`, `settings.notification_policy.*` | Global hoặc module scope | Preview, test delivery, audit publish; không lộ credential mail. |
| Office Online/Graph configuration | Nên là capability riêng trong System Configuration | Integration administrator scope | Test connection server-side; secret store; không đổi quyền Document Control. |

### 11.5 Audit Trail, Report, Notification, Dashboard, Preferences, Support

| Chức năng | Permission hiện có | Scope / điều kiện | Kiểm soát |
|---|---|---|---|
| Audit object-scoped | Kế thừa `VIEW_DETAIL` | Cùng resource scope | Không cần global `audit.view` để mở tab Detail. |
| Audit global search | `audit.view`, `audittrail.module.view` | Module/BU/Department scope tùy policy | SQL filter tại server; không lộ audit record ngoài scope. |
| Audit export | `audit.export` | Cùng global audit scope | Audit chính hành động export; watermark/file integrity khi cần. |
| Audit Review campaign | `audit.review.view/manage` | QA/Audit reviewer được gán | Signature khi complete, assignment sequence nếu có. |
| Notification inbox | `notifications.module.view` | `SELF` | User chỉ thấy notification của chính mình. |
| Notification recipient audience | `notifications.recipient.qa_manager` | Khi cấu hình event | Nên map qua audience rule, không hard-code tên role. |
| Dashboard | `dashboard.module.view`, `dashboard.admin.view` | Data scope giống module nguồn | Không để dashboard leak số liệu/record ngoài scope. |
| Report / export | `report.module.view/export` | Data scope giống truy vấn nguồn | Permission export không bypass record visibility. |
| Preferences | `preferences.module.view/edit` | `SELF` | Không được sửa system policy. |
| Help/User Manual | `help_support.module.view`, `user_manual.module.view` | Thông thường toàn bộ authenticated user | Không chứa tài liệu restricted nếu không kiểm tra scope. |

### 11.6 Work Management và Training (định hướng khi triển khai)

| Chức năng | Permission hiện có | Scope nên có | Ghi chú |
|---|---|---|---|
| Project view/create/member management | `work_management.project.*` | Project member/owner/assigned manager | Member management khác với quyền xem mọi Project. |
| Issue create/update | `work_management.issue.*` | Project/Issue scope | Người tạo không tự có quyền đóng/duyệt nếu workflow Issue được bổ sung. |
| Training view/manage material/session/assignment | `training.*`, `documents.training.*` | Trainee, trainer, coordinator, material owner | Cần matrix riêng khi bắt đầu module Training; không dùng profile DCO làm rule. |

## 12. Quy tắc kế thừa tab, file và dữ liệu nhạy cảm

| Thành phần Detail | Mặc định khi `VIEW_DETAIL` được phép | Ngoại lệ tách permission |
|---|---|---|
| General Information, participant, signature, distribution metadata | Có | Ẩn các trường secret/technical secret. |
| Document/Revision PDF preview | Có nếu output phù hợp trạng thái tồn tại | Source download, source edit, Office Online edit. |
| Audit Trail của chính đối tượng | Có | Global audit search/export, audit review campaign. |
| Evidence lost/damaged | Không mặc định | `VIEW_EVIDENCE` vì có thể là ảnh nhạy cảm. |
| Batch recipient list | Không mặc định cho recipient record | Chỉ batch requester/operator hoặc user có batch scope. |
| Microsoft Entra identity/provisioning details | Không mặc định cho mọi người xem User Detail | Chỉ user-management/security scope; không hiển thị secret/token. |

## 13. Quy tắc trạng thái và action tự động

### 13.1 Action thủ công của user

Mọi action thủ công phải có capability trả về từ server và mutation API kiểm tra lại cùng policy. Các action gồm: Submit, Review, Approve, Publish, Distribute, Recall, Report Lost/Damaged, Replace, Obsolete, Cancel, Reopen, Download, Print, Export và thay đổi configuration.

### 13.2 Action tự động của hệ thống

Ví dụ: expiry Controlled Copy, thu hồi link, gửi notification, retry delivery, đồng bộ Office Online, tạo preview, watermark evidence và reconcile batch-child.

Các action này **không mượn permission của user cuối cùng**. Chúng chạy bằng system job/service identity, nhưng phải lưu audit với:

- `actorType = SYSTEM` hoặc `SERVICE`;
- trigger source (policy, scheduled job, user action nào khởi phát);
- configuration/policy version;
- resource và trạng thái trước/sau;
- retry count, kết quả và lỗi an toàn để truy vết.

Không được dùng tài khoản “Admin” chung để chạy job, vì sẽ làm mất accountability.

## 14. Segregation of Duties (SoD) cần cấu hình được

| Rule | Mặc định GMP nên cân nhắc | Có thể cấu hình theo Document Type? |
|---|---|---|
| Author tự Review | Cấm mặc định | Có; chỉ cho phép nếu được phê duyệt exception. |
| Author tự Approve | Cấm | Có nhưng không khuyến nghị. |
| Reviewer tự Approve | Cấm hoặc yêu cầu exception | Có. |
| Người cấu hình workflow tự final approve | Cấm trong document kiểm soát cao | Có. |
| Người report damage tự thay thế | Có thể cấm, để coordinator/QA xử lý | Có. |
| Người distribute tự recall | Có thể cho phép theo policy, nhưng cần audit/e-signature | Có. |
| Người sửa Access Profile tự duyệt thay đổi quyền của mình | Cấm | Không nên override tùy tiện. |

SoD không phải permission code. Đó là policy đánh giá hai hay nhiều quan hệ/assignment ở thời điểm action được yêu cầu.

## 15. Ví dụ minh họa theo vòng đời Document Control

Các ví dụ dưới đây là **mẫu policy runtime**. Chúng không gán một hành động cho tên role như “DCO” hay “QA Manager”. Khi doanh nghiệp đổi tên hoặc thay Access Profile, chỉ cần đổi assignment/profile; mã action và kiểm tra nghiệp vụ giữ nguyên.

### 15.1 Công thức đánh giá chung cho mọi action

```text
ALLOW khi và chỉ khi:
  Module access
  ∧ Permission được cấp qua Access Profile
  ∧ Data scope hoặc quan hệ record hợp lệ
  ∧ Lifecycle state hợp lệ
  ∧ Workflow assignment/sequence hợp lệ (nếu có)
  ∧ Không vi phạm SoD
  ∧ Policy control hợp lệ (e-signature, reason, quota, expiry, file policy...)
  ∧ Không có explicit Deny có ưu tiên cao hơn
```

Ví dụ, `documents.revision.complete_review` không có nghĩa là “mọi Reviewer đều Complete Review mọi revision”. Permission chỉ là entitlement; actor phải là reviewer được gán, đúng lượt sequence và revision đang `PENDING_REVIEW`.

### 15.2 Document Master — vòng đời và action được cấp capability

| Trạng thái Document Master | Action thủ công có thể được policy cho phép | Điều kiện bắt buộc ngoài permission | Kết quả/audit |
|---|---|---|---|
| `DRAFT` | Cập nhật metadata, cấu hình workflow ban đầu, lưu Related/Correlated, Cancel | `documents.document.update_draft` hoặc action cấu hình; scope `OWNER`/`ASSIGNED_COORDINATOR`; record chưa có lifecycle khóa | Lưu before/after, actor, lý do nếu Cancel. |
| `ACTIVE` + revision mới nhất `EFFECTIVE` | Xem, cấu hình participant/relationship cho revision kế tiếp, nhập Review Date, khởi tạo upgrade/upload revision, Obsolete | Scope xem document; action cấu hình chỉ có hiệu lực sau Save; upgrade/upload phải qua policy revision riêng | Audit thay đổi cấu hình “next revision”; không sửa lịch sử Effective. |
| `OBSOLETED` | Xem detail, preview, audit; có thể Reopen chỉ nếu policy doanh nghiệp cho phép | `documents.document.view`; Reopen cần permission riêng + state + reason/e-signature | Không xóa record hoặc file lịch sử. |
| `CLOSED_CANCELLED` | Xem detail/audit lịch sử | Read scope hợp lệ; không có update workflow thông thường | Read-only; Reopen là exception policy rõ ràng. |

**Ví dụ A — User X là Author và có profile “Document Contributor”:**

- Profile cấp `documents.document.create` và `documents.document.update_draft`.
- X tạo Document Master `DRAFT`, nên quan hệ `OWNER` thỏa mãn và UI cho Save/Cancel.
- X không tự có quyền đổi Reviewer/Approver sau khi Document đã `ACTIVE`, trừ khi profile cấp `documents.document.configure_next_participants` **và** policy xác nhận X là `ASSIGNED_COORDINATOR` hoặc scope được cấp.
- Nếu hôm sau đổi tên profile thành “Quality Document Author”, mọi quyền vẫn đúng vì code kiểm tra permission và relationship, không kiểm tra tên profile.

### 15.3 Revision — vòng đời soạn thảo, review, approval và publish

| Revision state | Action | Permission đích | Actor relation / điều kiện workflow | Chặn quan trọng |
|---|---|---|---|---|
| `DRAFT` | Upload source DOCX | `documents.revision.upload_source` | `AUTHOR`, `CO_AUTHOR` hoặc actor được policy chỉ định | File hợp lệ; không thay source khi đã source-lock. |
| `DRAFT` | Edit Online / Sync | `edit_online` / `sync_office_online` | Author/Co-author hoặc actor policy; Office link do server cấp | Reviewer/Approver không được edit source chỉ vì có permission review/approval. |
| `DRAFT` | Complete Editing | `complete_authoring` | Author/Co-author/actor policy; source đã sync hợp lệ | E-signature/reason theo policy; sau đó lock source. |
| `DRAFT` đã complete editing | Submit for Review | `submit_review` | `AUTHOR`, `CO_AUTHOR` hoặc `ASSIGNED_COORDINATOR`; reviewer list hợp lệ | Không lấy tên “DCO” làm điều kiện; SoD và participant validation chạy trước transition. |
| `PENDING_REVIEW` | Complete/Reject Review | `complete_review` / `reject_review` | `ASSIGNED_REVIEWER`, đang `PENDING`, là lượt sequence kế tiếp | Không cho reviewer ở lượt sau ký trước; reject cần reason. |
| `PENDING_APPROVAL` | Complete/Reject Approval | `complete_approval` / `reject_approval` | `ASSIGNED_APPROVER`, đang `PENDING`, là lượt sequence kế tiếp | SoD cấm Author tự Approve nếu rule bật; reject cần reason. |
| `PENDING_TRAINING` | Manage/complete training | `training.manage` / `training.complete` | Training participant/coordinator | Tách khỏi approval/publishing; không cho publish sớm. |
| `READY_FOR_PUBLISHING` | Mở workspace, generate preview, Publish | `open_publishing_workspace` / `publish` | Publishing actor được policy chỉ định | Publish dùng e-signature, tạo immutable output/audit. |
| `EFFECTIVE` | Xem, khởi tạo upgrade, obsolete | `revision.view`, `revision.upgrade`, `revision.obsolete` | Read scope; upgrade/obsolete theo coordinator/owner policy | Upgrade tạo revision mới, không sửa revision Effective. |
| `OBSOLETED` / `CLOSED_CANCELLED` | Xem/audit | `revision.view` | Read scope hợp lệ | Không mở lại authoring thông thường. |

**Ví dụ B — cùng một user làm Author của Revision A và Reviewer của Revision B:**

- Trên Revision A, user có relation `AUTHOR`: có thể Edit Online/Complete Editing khi `DRAFT`, nhưng bị từ chối Complete Review vì không có `ASSIGNED_REVIEWER` cho A.
- Trên Revision B, user có relation `ASSIGNED_REVIEWER`: chỉ thấy Complete Review/Reject Review khi B `PENDING_REVIEW` và tới lượt sequence của họ.
- Nếu policy SoD cấm Author tự Review, khi user vừa là Author vừa được gán Reviewer của A, server trả `SOD_VIOLATION` dù user có cả hai permission. FE chỉ ẩn/disable theo capability trả về; gọi thẳng API vẫn bị chặn.

**Ví dụ C — user không mang tên/role DCO nhưng được giao Submit:**

- Admin gán profile có `documents.revision.submit_review` cho User Y.
- Trên Revision R, User Y được thêm vào `workflow_participants` với actor code ổn định `ASSIGNED_COORDINATOR` (hoặc assignment “Submission Coordinator”).
- Khi R là `DRAFT`, đã Complete Editing và reviewer hợp lệ, Y nhận capability Submit for Review. Trên revision khác không có assignment, Y không nhận capability này. Không cần tạo hay hard-code role DCO.

### 15.4 Controlled Copy — Batch và Record là hai resource khác nhau

| Resource / state | Action | Permission đích | Scope/relationship | Quy tắc riêng |
|---|---|---|---|---|
| Batch `READY_FOR_DISTRIBUTION` | Distribute batch | `documents.controlled_copy.batch.distribute` | `ASSIGNED_COORDINATOR` hoặc operation scope được gán | E-signature nếu policy yêu cầu; xử lý child atomically/idempotent; audit kết quả từng child. |
| Batch `READY_FOR_DISTRIBUTION` | Cancel request | `batch.cancel_request` | Requester hoặc coordinator được policy cho phép | Không hủy child đã Distributed. |
| Batch có child phù hợp | Recall batch | `batch.recall` | Coordinator/scope batch | Gọi transition từng record; batch là aggregate, không che mixed status. |
| Batch mọi trạng thái được phép xem | View batch + recipient list | `batch.view` | Requester/coordinator/department/BU/all scope | Recipient record không mặc định xem batch hay recipient khác. |
| Record `READY_FOR_DISTRIBUTION` | Distribute / Cancel / Recall record | `record.distribute` (nếu tách) / `record.recall` | Coordinator hoặc scope record | Không cần quyền batch nếu thao tác 1 record. |
| Record `DISTRIBUTED` còn hiệu lực | View/Preview | `record.view` | `RECIPIENT`, requester hoặc coordinator/scope | Preview chỉ khi portal policy bật và link chưa expiry/recalled. |
| Record `DISTRIBUTED` còn hiệu lực | Download/Print | `record.download` / `record.print` | Cùng scope view record | Chỉ trả capability khi policy bật; quota one-time được consume atomically và audit. |
| Record `DISTRIBUTED` | Report Lost/Damaged | `record.report_lost_damaged` | Policy có thể cho `RECIPIENT`, coordinator hoặc cả hai | Reason/evidence; evidence có quyền view/download riêng. |
| Record sự cố | Replace | `record.replace_lost_damaged` | Coordinator/policy | Tạo record mới, giữ record cũ và evidence để truy vết. |
| Record `EXPIRED`, `RECALLED`, `OBSOLETED`, `CLOSED_CANCELLED` | View history/audit | `record.view` theo scope lịch sử | Không download/print/preview link | Expiry/revoke chạy SYSTEM, không dùng quyền người nhận. |

**Ví dụ D — employee chỉ được nhận một Controlled Copy:**

- User Z có `documents.module.view` và relation `RECIPIENT` của record `CC-001`.
- Z được xem Detail/preview/audit của **record CC-001**, nhưng không được xem batch, email người nhận khác hoặc record `CC-002`.
- Nếu Admin bật “one-time download”, download endpoint atomically đổi quota từ 1 sang 0 và audit. Lần thứ hai server trả `DOWNLOAD_QUOTA_EXHAUSTED`; không chỉ ẩn nút ở FE.

**Ví dụ E — batch phân phối Department với ba record:**

- Batch hiển thị Distribution List = tên Department, có 3 child record.
- Coordinator có `batch.view`/`batch.distribute`; từng recipient chỉ có `record.view` của child thuộc về mình.
- Một child bị recall, hai child còn Distributed: batch phải thể hiện mixed status và action batch chỉ trả capability nếu policy cho phép transition an toàn cho các child phù hợp. Không được coi trạng thái batch là nguồn chân lý thay cho child.

### 15.5 Action tự động và action đặc quyền

| Tình huống | Actor | Cách authorize | Audit bắt buộc |
|---|---|---|---|
| Controlled Copy hết hạn | `SYSTEM` worker | Policy expiry + record chưa bị closed; không kiểm tra profile người tạo request | Job id, policy version, record trước/sau, revoke token/link result. |
| Đồng bộ Office Online | `SERVICE` worker, trigger từ action hợp lệ | Source/working-link ownership + retry/idempotency | Trigger user/service, file version/hash, retry count. |
| Gửi notification / retry delivery | `SYSTEM` worker | Notification policy + queue claim | Recipient resolution, template/policy version, delivery outcome. |
| Emergency access | User có `security.break_glass.use` | TTL + justification + explicit policy; không dùng bypass theo tên Admin | Reason, start/end, resources accessed, hậu kiểm. |

### 15.6 Quy tắc hiển thị FE tương ứng các ví dụ

1. FE tải Detail và capability cùng hoặc ngay sau Detail. Button/tab chỉ render khi server trả capability `allowed = true`.
2. Button không có quyền **ẩn**, không render disabled để tránh gợi ý action không được cấp; disabled chỉ dùng khi capability allowed nhưng form chưa đủ dữ liệu hoặc mutation đang chạy.
3. Khi state/assignment thay đổi bởi user khác, SSE/job-status event hoặc refetch capability nền cập nhật phần action; không cần F5 và không tự suy luận từ profile local.
4. API mutation luôn tái đánh giá policy; capability cũ không là giấy phép thực hiện action sau khi state đã đổi.

## 16. Yêu cầu API và FE để mô hình này không bị lệch

1. Mỗi Detail API trả `resourceCapabilities` từ server: `viewDetail`, `viewContent`, `viewAudit`, `viewEvidence`, `download`, `print` và mutation action tương ứng.
2. List API filter record trên DB theo `VIEW_LIST` scope; FE không nhận record mà user không có scope.
3. FE dùng capability để hiển thị tab/button, nhưng không tự suy luận từ role name hay local permission list.
4. Mọi mutation và file endpoint kiểm tra lại scope, state, policy, SoD và e-signature ở backend.
5. Capability response cần trả `reasonCode`, `requiredPermission`, `actorRequirement`, `state` khi denied để UI có thể giải thích đúng mà không lộ dữ liệu nhạy cảm.
6. Khi policy/profile thay đổi, invalidate cache capability; không đợi user F5 hoặc token hết hạn.
7. Export, preview, download, print và external link là endpoint riêng có audit và rate limit/idempotency phù hợp.

## 17. Checklist để phê duyệt từng permission mới

Trước khi thêm một code mới vào catalog, trả lời đủ tám câu:

1. Hành động tác động resource nào?
2. Hậu quả nếu gán nhầm quyền là gì?
3. Có thể dùng permission hiện có + scope/state thay vì tạo code mới không?
4. Ai là actor hợp lệ theo quan hệ record, không phải display role?
5. Trạng thái nào cho phép và điều kiện chặn là gì?
6. Có cần reason, e-signature, dual control hoặc SoD không?
7. Có tạo/export/tải xuống dữ liệu ra ngoài hay không?
8. Audit cần ghi actor, scope, policy version, before/after và kết quả gì?

Nếu chưa trả lời rõ các câu này thì chưa nên tạo/gán permission mới.
