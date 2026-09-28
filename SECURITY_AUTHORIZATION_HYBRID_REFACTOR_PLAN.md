# SECURITY & AUTHORIZATION — HYBRID REFACTOR CANONICAL PLAN

> **Mục đích:** tài liệu thực thi duy nhất để giao cho Claude Code refactor toàn bộ Security & Authorization.  
> **Trạng thái:** kế hoạch đích đã hợp nhất thiết kế, kiểm chứng code/DB và runbook cutover; chưa tự động đồng nghĩa với migration hay thay đổi runtime.  
> **Ngôn ngữ:** tiếng Việt. Tên permission, state, API và entity giữ tiếng Anh ổn định.

## 1. Nguồn tham chiếu và phạm vi

Các tài liệu sau là bằng chứng/nguồn lịch sử. Nếu mâu thuẫn với tài liệu này, tài liệu này là quyết định triển khai mới:

- `SECURITY_AUTHORIZATION_ANALYSIS_ROUND1.md`
- `SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md`
- `PERMISSION_CATALOG_REDESIGN_PROPOSAL.md`
- `PERMISSION_CATALOG_CONTEXTUAL_MODEL_PROPOSAL.md`
- `C:\Users\theho\.claude\plans\rippling-sleeping-octopus.md` (đã hợp nhất; không dùng làm runbook độc lập nữa)

Áp dụng engine authorization cho toàn bộ dự án: Document Control, Controlled Copies, User/Entra, Settings, Audit, Notification, Work Management và các module mới. Training chỉ đăng ký adapter/capability contract; chưa refactor domain hoặc UI Training trong kế hoạch này.

### 1.1 Hiện trạng đã kiểm chứng trước refactor

Các điểm sau là ràng buộc triển khai, không được bỏ qua khi code:

1. `DocumentStatusDefinition` và `RevisionStatusDefinition` hiện là dữ liệu DB. Chúng là lifecycle chuẩn do code/migration sở hữu: **không tạo CRUD API**, không cho Admin tự tạo/xóa state hoặc transition.
2. `roles.code` hiện chưa được DB bảo vệ đầy đủ. Migration Phase 0 phải thêm cơ chế DB chặn đổi `roles.code`; chỉ đổi `display_name` qua API có audit.
3. `ObjectAccessRule`/`EffectiveAccessDiagnosisService` hiện mới xử lý đầy đủ `DOCUMENT_REVISION`. Phase 0 phải tổng quát hóa cho resource type đã đăng ký, trước khi module khác cutover.
4. `WorkflowActorType` có nhiều selector chết/legacy. Thay bằng relation definition metadata-driven, được giải quyết bởi resolver chuẩn; migration phải chuyển toàn bộ policy actor trước khi bỏ selector cũ.
5. `AuthorizationShadowEvaluationService` và bảng shadow event đã tồn tại một phần. Mở rộng chúng cho mọi resource type, không xây cơ chế shadow song song khác.
6. `DocumentAuthorizationService`, `RevisionWorkflowAuthorizationService`, `ControlledCopyAuthorizationService` và `ObjectAccessEvaluationService` đang phụ thuộc chéo. Không được tách scope generalization khỏi cutover khối Document Master + Revision.
7. Permission đã deploy `documents.document.update_metadata` và `documents.revision.update_draft_metadata` là canonical trong giai đoạn refactor. Không rename chúng chỉ để khớp tên tài liệu.

## 2. Quyết định kiến trúc bất biến

1. Dùng **Contextual, policy-driven hybrid authorization**: RBAC + ABAC + ReBAC + workflow/state control + policy control.
2. Lifecycle state lõi của Document Master, Revision và Controlled Copy là cố định trong code/migration. Admin không tự tạo/xóa state hoặc transition; Admin chỉ cấu hình actor, permission, scope, SoD và điều kiện policy.
3. Không được dùng tên hiển thị role/profile trong business logic: không `if ("DCO")`, `if ("QA Manager")`, `if ("Document Admin")`.
4. Access Profile có `code` bất biến; `displayName` đổi được. Business logic chỉ dùng permission/action/relation/scope/state.
5. User chỉ nhận permission chức năng qua Access Profile. Không tạo direct feature permission cho một user.
6. Explicit Object Grant là ngoại lệ trên đúng resource; không thời hạn, phải audit. Explicit `DENY` ưu tiên mọi `ALLOW`.
7. Backend là nguồn quyết định duy nhất. FE không tự suy luận quyền từ role, profile, menu hay permission cache cục bộ.
8. `view` Document/Revision bao gồm Detail, tab metadata chuẩn, preview phù hợp state và object audit. Document/Revision không có download/print preview.
9. Controlled Copy Batch và Controlled Copy Record là resource khác nhau. Download/Print chỉ áp dụng Controlled Copy Record khi policy bật và server kiểm soát quota atomically.
10. Auto action chạy bằng `SYSTEM`/`SERVICE` identity, không mượn identity hay permission của Admin hoặc user cuối cùng.

## 3. Mô hình quyết định quyền trung tâm

Tạo một contract dùng chung cho capability API và toàn bộ mutation/file endpoint:

```text
authorize(actor, resource, action, context) -> AuthorizationDecision
```

`AuthorizationDecision` tối thiểu gồm:

```text
allowed
reasonCode
requiredPermission
resolvedScopes
matchedRelations
matchedPolicyVersion
resourceState
requiredControls (reason, eSignature, quota, expiry...)
```

Thứ tự đánh giá phải thống nhất:

1. User/session còn Active và không bị force logout/suspended/terminated.
2. User có module/route access.
3. Effective permission được cấp qua Access Profile.
4. Data scope hoặc explicit object Allow hợp lệ.
5. Explicit object Deny (nếu có) — luôn từ chối.
6. Relation với resource hợp lệ.
7. State, workflow assignment và sequence hợp lệ.
8. SoD, e-signature, reason, download/print quota, expiry và policy liên quan hợp lệ.
9. Trả Allow/Deny cùng reason an toàn, có thể dùng cho UI nhưng không lộ dữ liệu ngoài scope.

### 3.1 Relation và scope metadata-driven

Không dùng enum `AuthorizationRelation` cố định cho các code như `AUTHOR` hoặc `RECIPIENT`. Thay vào đó, database lưu **relation definition**; engine chỉ giữ các resolver nghiệp vụ chuẩn mà server hiểu và kiểm thử được.

| Resolver code do server sở hữu | Fact server dùng để tính | Admin có được tự tạo resolver? |
|---|---|---|
| `SELF_RESOLVER` | Actor chính là user/resource self. | Không. |
| `RESOURCE_OWNER` | Creator/owner của resource. | Không. |
| `WORKFLOW_PARTICIPANT` | Participant assignment, participant type, sequence và pending status. | Không; Admin chỉ cấu hình relation dùng resolver này. |
| `CONTROLLED_COPY_RECIPIENT` | Recipient nội bộ/external của Controlled Copy Record. | Không. |
| `ORGANIZATION_SCOPE` | Business Unit, Department, hierarchy và assignment scope. | Không. |
| `OBJECT_GRANT` | Explicit Allow/Deny trên đúng object. | Không. |

Admin cấu hình relation definition trong DB, ví dụ:

| Relation code cấu hình | Resolver | Cấu hình resolver | Ý nghĩa |
|---|---|---|---|
| `AUTHOR` | `WORKFLOW_PARTICIPANT` | `participantType=AUTHOR` | Author của revision. |
| `TECHNICAL_REVIEWER` | `WORKFLOW_PARTICIPANT` | `participantType=TECHNICAL_REVIEWER` | Reviewer kỹ thuật do tổ chức tự định nghĩa. |
| `DOCUMENT_STEWARD` | `WORKFLOW_PARTICIPANT` | `participantType=STEWARD` | Người điều phối tài liệu, không phụ thuộc tên profile. |
| `RECIPIENT` | `CONTROLLED_COPY_RECIPIENT` | `recipientKind=ANY` | Recipient của một Controlled Copy Record. |
| `QA_DEPARTMENT_SCOPE` | `ORGANIZATION_SCOPE` | `scopeType=DEPARTMENT` | Scope tổ chức của profile/rule, không phải role. |

Workflow policy chỉ tham chiếu `relation_code`, permission và state. Admin có thể tạo/đổi tên/thay policy cho relation nếu relation đó dùng resolver chuẩn; Admin **không** được nhập SQL, JavaScript, SpEL hoặc resolver tùy ý. Muốn có fact nghiệp vụ hoàn toàn mới thì developer thêm resolver, migration và test GMP; đây là ranh giới cần thiết giữa cấu hình linh hoạt và kiểm soát hệ thống.

`ALL_RECORDS` là scope grant qua profile/rule; Explicit Object Grant giữ `ALLOW`/`DENY`, trong đó `DENY` luôn ưu tiên. Các scope/relation được lưu version, active flag, reason và audit, không dựa vào tên hiển thị role/profile.

## 4. Catalog permission đích

Permission chỉ mô tả **loại hành động**. Scope/relation/state/policy quyết định actor làm được trên record nào.

### 4.1 Document Master

| Permission | Mục đích |
|---|---|
| `documents.module.view` | Vào Document Control; không đồng nghĩa xem mọi record. |
| `documents.document.create` | Tạo Document Master. |
| `documents.document.view` | Xem detail, tab chuẩn, preview và object audit. |
| `documents.document.scope.all` | Mở rộng visibility Document theo scope tổ chức/toàn cục. |
| `documents.document.update_metadata` | Sửa metadata Document Master khi Draft. |
| `documents.document.configure_initial_workflow` | Chọn workflow participant lúc tạo mới. |
| `documents.document.configure_next_participants` | Đổi Reviewer/Approver cho revision kế tiếp. |
| `documents.document.configure_next_relationships` | Đổi Related/Correlated Document cho revision kế tiếp. |
| `documents.document.cancel` | Cancel Document Master. |
| `documents.document.reopen` | Reopen Closed-Cancelled khi policy cho phép. |
| `documents.document.obsolete` | Obsolete Active Document. |

### 4.2 Revision

| Permission | Mục đích |
|---|---|
| `documents.revision.view` | Xem detail, preview và object audit. |
| `documents.revision.update_draft_metadata` | Sửa metadata Revision Draft. |
| `documents.revision.upload_source` | Upload/thay source DOCX. |
| `documents.revision.edit_online` | Soạn thảo Office Online. |
| `documents.revision.sync_office_online` | Sync Office Online về storage chính thức. |
| `documents.revision.generate_preview` | Generate/regenerate preview theo actor/system policy. |
| `documents.revision.complete_authoring` | Complete Editing. |
| `documents.revision.submit_review` | Draft sang Pending Review. |
| `documents.revision.complete_review` / `documents.revision.reject_review` | Hoàn tất/từ chối Review. |
| `documents.revision.complete_approval` / `documents.revision.reject_approval` | Hoàn tất/từ chối Approval. |
| `documents.revision.open_publishing_workspace` | Mở Publishing Workspace. |
| `documents.revision.publish` | Publish revision. |
| `documents.revision.cancel` | Cancel revision. |
| `documents.revision.upgrade` | Khởi tạo revision mới từ Revision Effective. |
| `documents.revision.obsolete` | Obsolete Revision Effective. |
| `documents.revision.training.manage` / `documents.revision.training.complete` | Contract cho Training adapter. |

### 4.3 Controlled Copy Batch và Record

| Permission | Mục đích |
|---|---|
| `documents.controlled_copy.batch.request` | Tạo request batch hoặc record đơn. |
| `documents.controlled_copy.batch.view` | Xem batch, child list và batch audit. |
| `documents.controlled_copy.batch.distribute` | Distribute batch. |
| `documents.controlled_copy.batch.recall` | Recall batch theo child. |
| `documents.controlled_copy.batch.cancel_request` | Cancel batch chưa distribute. |
| `documents.controlled_copy.record.view` | Xem record detail, preview và record audit. |
| `documents.controlled_copy.record.distribute` | Distribute một record đơn lẻ, độc lập với quyền batch. |
| `documents.controlled_copy.record.cancel_request` | Cancel một request record đơn lẻ chưa distribute. |
| `documents.controlled_copy.record.download` | Tải record khi policy/quota cho phép. |
| `documents.controlled_copy.record.print` | In record khi policy/quota cho phép. |
| `documents.controlled_copy.record.recall` | Recall một record. |
| `documents.controlled_copy.record.report_lost_damaged` | Report lost/damaged. |
| `documents.controlled_copy.record.replace_lost_damaged` | Replace sau incident. |
| `documents.controlled_copy.record.upload_evidence` | Upload evidence. |
| `documents.controlled_copy.record.view_evidence` | Xem evidence nhạy cảm. |
| `documents.controlled_copy.record.download_evidence` | Tải evidence, có audit riêng. |

`expire` là SYSTEM-only action, không phải permission cấp cho user.

### 4.4 Cross-module bắt buộc

- `audit.global.view`, `audit.global.export`.
- **[VERIFIED via psql 2026-08-09 — reconciled với thực tế đã deploy, thay cho tên aspirational cũ]**
- `settings.user.view/create/edit/delete/reset_password/force_logout` (không có `security.users.*` — chưa từng seed; `suspend`/`terminate`/`update` cũng không có code riêng, đều dùng chung `settings.user.edit`).
- `users.invite_external/resend_external_invitation/retry_external_provisioning/disable_microsoft_access/remove_external_identity/view_external_provisioning` (không có `security.users.external_identity.*` — chưa từng seed).
- `security.access_profiles.view/update/assign` (không phải `manage`).
- `security.permission_sets.view/update` (không phải `manage`).
- `security.object_rules.view/manage` (không phải `object_access_rules`).
- `security.workflow_authorization.view/manage` (không phải `workflow_policies`).
- `security.sod.view/manage` (không phải `sod_rules`).
- `security.access_review.view/manage` (số ít, không phải `access_reviews`).
- `security.maintenance.bypass` (đã deploy thật, chưa từng ghi trong tài liệu này).
- `security.break_glass.use` — **thuần lý thuyết, không có trong DB, không có entity/migration/code nào tham chiếu.** Nếu vẫn muốn tính năng này, coi là backlog mới, không phải rename.
- `settings.*.view/manage/test` theo từng resource configuration, không dùng `system-admin.*` chung.

### 4.5 Catalog đích chi tiết — nguồn cấu hình chuẩn

Phần này là catalog có tính **quy phạm** để Claude Code seed/migrate và hiển thị trong Authorization Console. Mỗi permission cấp quyền thực hiện **một loại action**; cột Scope, State và Control không được biến thành role name hoặc hard-code trong controller.

#### A. Navigation, dashboard, personal workspace và reporting

| Permission | Resource/action được cấp | Scope mặc định | Điều kiện/state bắt buộc | Server control/audit |
|---|---|---|---|---|
| `dashboard.module.view` | Thấy menu Dashboard và dashboard cá nhân | `SELF`/data scope nguồn | User active | Không trả KPI/record vượt data scope. |
| `dashboard.admin.view` | Dashboard quản trị/toàn cục | `ALL_RECORDS` hoặc BU/Department | User active | Audit truy vấn/export nhạy cảm. |
| `notifications.module.view` | Thấy menu Notifications | `SELF` | User active | Chỉ xem notification của actor. |
| `notifications.inbox.view` | Xem/đánh dấu đọc inbox | `SELF` | User active | Không xem inbox user khác. |
| `notifications.policy.view` / `notifications.policy.manage` | Xem/sửa rule gửi notification | Global config scope | Config version active | Manage có reason/audit old-new. |
| `notifications.template.view` / `notifications.template.manage` | Xem/sửa email/in-app template | Template scope | Version draft/published theo policy | Không lộ secret; audit version/publish. |
| `notifications.audience.manage` | Cấu hình audience/recipient rule | Global config scope | Audience hợp lệ | Không hard-code QA Manager/DCO. |
| `notifications.failure.manage` | Retry/resolve notification failure | Queue/admin scope | Failed delivery tồn tại | Idempotency, retry count, audit outcome. |
| `my_tasks.module.view` | Thấy My Tasks | `SELF` | User active | Chỉ task/assignment actor được xem. |
| `reports.module.view` | Thấy Reports | Data scope nguồn | User active | Filter/export phải tái dùng scope nguồn. |
| `reports.report.view` | Chạy report trong scope | BU/Department/ALL | Report type được cấp | Server-side filtering, audit query khi GMP-impacting. |
| `reports.report.export` | Export report | Cùng scope `report.view` | Export format hợp lệ | Audit export, watermark/redaction nếu policy yêu cầu. |
| `preferences.module.view` / `preferences.update` | Xem/sửa Preferences | `SELF` | User active | Không sửa system policy. |
| `help_support.module.view` / `user_manual.module.view` | Thấy Help/User Manual | Authenticated user hoặc document scope | User active | Manual restricted phải dùng document scope. |

#### B. Document Master — từng action độc lập

| Permission | Action chính xác | Scope/relation hợp lệ | State hợp lệ | Control bắt buộc |
|---|---|---|---|---|
| `documents.module.view` | Thấy menu Document Control | Module access | N/A | Không suy ra quyền xem record. |
| `documents.document.create` | Tạo document shell/master | BU/Document Type được profile cấp | N/A | Validate dictionary/BU/type; audit tạo. |
| `documents.document.view` | List/detail, metadata, standard tabs, published preview và object audit | Participant, Department, BU, `ALL_RECORDS`, explicit grant hoặc published scope | State được visibility policy cho phép | API list/detail/preview/audit dùng cùng visibility evaluator. |
| `documents.document.scope.all` | Mở rộng `document.view` cho toàn bộ document thuộc scope | `ALL_RECORDS`/BU/Department | Theo visibility policy | Không tự cấp create/edit/controlled-copy access. |
| `documents.document.update_metadata` | Sửa metadata master lúc Draft | `OWNER`/Coordinator scope | `DRAFT` | Validate old-new; audit. |
| `documents.document.configure_initial_workflow` | Chọn Author/Co-author/Reviewer/Approver khi tạo mới | Owner hoặc creation coordinator | Tạo mới/Draft | Validate eligibility/SoD trước Save. |
| `documents.document.configure_next_participants` | Đổi Reviewer/Approver cho revision kế tiếp | Assigned Coordinator hoặc document scope | `ACTIVE` + latest revision `EFFECTIVE` | Không đổi participant lịch sử/pending; Save + audit old-new. |
| `documents.document.configure_next_relationships` | Đổi Related/Correlated Documents cho revision kế tiếp | Assigned Coordinator hoặc document scope | `ACTIVE` + latest revision `EFFECTIVE` | Validate visibility/reference; Save + audit. |
| `documents.document.manage_review_date` | Nhập/xóa Review Date thủ công cho vòng kế tiếp | Assigned Coordinator hoặc document scope | `ACTIVE` + latest revision `EFFECTIVE` | Date-only; không auto-fill; Save/audit. |
| `documents.document.cancel` | Cancel master | Coordinator policy | `DRAFT` hoặc state policy cụ thể | Reason, e-signature nếu policy yêu cầu; không xóa lịch sử. |
| `documents.document.obsolete` | Obsolete Document Active | Coordinator policy | `ACTIVE` + latest revision `EFFECTIVE` | E-signature/reason; obsolete revision liên quan theo lifecycle policy. |
| `documents.document.reopen` | Reopen Closed-Cancelled | Explicit high-risk policy | `CLOSED_CANCELLED` | Reason, e-signature, audit đặc biệt. |

#### C. Revision và Office Online — từng transition/file action

| Permission | Action chính xác | Scope/relation hợp lệ | State hợp lệ | Control bắt buộc |
|---|---|---|---|---|
| `documents.revision.view` | List/detail, metadata, participants, signatures, preview và object audit | Document visibility hoặc explicit revision assignment/grant | Visibility policy | Không tự cấp source DOCX/edit/download/print. |
| `documents.revision.create` | Tạo shell Revision Draft từ document phù hợp | Author/coordinator policy | Document `ACTIVE`, latest revision `EFFECTIVE` | Số revision/version tạo ở server, audit. |
| `documents.revision.update_draft_metadata` | Sửa metadata Revision Draft | Author/Co-author/Coordinator policy | `DRAFT` | Audit old-new; không sửa khi pending/effective. |
| `documents.revision.upload_source` | Upload/thay DOCX source | `AUTHOR`, `CO_AUTHOR` nếu policy cho phép, hoặc actor policy | `DRAFT`, source chưa lock | DOCX/MIME/virus/version/hash validation. |
| `documents.revision.edit_online` | Cấp Office Online editor link | Author/Co-author hoặc actor policy | `DRAFT`, source đã sync | Named-user link; Reviewer/Approver không edit source. |
| `documents.revision.sync_office_online` | Sync Office file về official storage | Author hoặc designated sync actor | `DRAFT` | Idempotency, version/hash, audit. |
| `documents.revision.generate_preview` | Generate/regenerate preview | Authoring/publishing actor hoặc SYSTEM | State policy | Không trả capability rỗng; async job audit. |
| `documents.revision.complete_authoring` | Complete Editing và source lock | Author/Co-author/actor policy | `DRAFT` | E-signature/reason theo policy; validate source sync. |
| `documents.revision.submit_review` | `DRAFT → PENDING_REVIEW` | Author, Co-author hoặc Assigned Submission Coordinator | `DRAFT`, authoring complete | Reviewer configuration, SoD, notification/audit. |
| `documents.revision.complete_review` | Hoàn tất review | Assigned Reviewer đúng sequence | `PENDING_REVIEW` | E-signature, signature meaning, comment policy. |
| `documents.revision.reject_review` | Reject về Draft | Assigned Reviewer đúng sequence | `PENDING_REVIEW` | Reason bắt buộc, e-signature, audit transition. |
| `documents.revision.complete_approval` | Hoàn tất approval | Assigned Approver đúng sequence | `PENDING_APPROVAL` | SoD, e-signature, signature meaning. |
| `documents.revision.reject_approval` | Reject về Draft | Assigned Approver đúng sequence | `PENDING_APPROVAL` | Reason bắt buộc, e-signature. |
| `documents.revision.training.manage` | Cấu hình/điều phối training requirement | Training coordinator policy | `PENDING_TRAINING` | Adapter only ở phase này. |
| `documents.revision.training.complete` | Ghi completion hợp lệ | Trainee/training actor policy | `PENDING_TRAINING` | Evidence/completion audit. |
| `documents.revision.open_publishing_workspace` | Mở Publishing Workspace | Publishing Coordinator | `READY_FOR_PUBLISHING` | Server validates source lock/output state. |
| `documents.revision.publish` | `READY_FOR_PUBLISHING → EFFECTIVE` | Publishing actor policy | `READY_FOR_PUBLISHING` | E-signature, immutable output, audit, notification. |
| `documents.revision.cancel` | Cancel in-progress revision | Coordinator/state policy | State policy (không Effective) | Reason + audit; retain history/files. |
| `documents.revision.upgrade` | Tạo revision tiếp theo từ Effective | Author/coordinator policy | `EFFECTIVE` | Tạo Draft mới, không mutate Effective. |
| `documents.revision.obsolete` | Obsolete Revision Effective | Coordinator policy | `EFFECTIVE` | E-signature/reason và audit. |

#### D. Controlled Copy — Batch tách biệt Record

| Permission | Action chính xác | Scope/relation hợp lệ | State hợp lệ | Control bắt buộc |
|---|---|---|---|---|
| `documents.controlled_copy.batch.request` | Request record đơn hoặc batch cho Individual/Department/BU/External | Requester hoặc coordinator scope | Document Active + Revision Effective | Validate recipient, policy, quantity, expiry, external rule. |
| `documents.controlled_copy.batch.view` | Xem batch, child list, recipient list và batch audit | Requester, Coordinator, BU/Department/All batch scope | Mọi state lịch sử được phép | Recipient record không mặc định có quyền này. |
| `documents.controlled_copy.batch.distribute` | Distribute toàn batch | Assigned Distribution Coordinator | `READY_FOR_DISTRIBUTION` | E-signature theo policy; child-by-child/idempotent. |
| `documents.controlled_copy.batch.cancel_request` | Cancel request batch chưa distribute | Requester hoặc coordinator policy | `READY_FOR_DISTRIBUTION` | Không mutate child đã Distributed. |
| `documents.controlled_copy.batch.recall` | Recall các child đủ điều kiện | Distribution Coordinator | Batch có child `DISTRIBUTED` | Batch summary không thay child state; audit kết quả từng child. |
| `documents.controlled_copy.record.view` | Xem record detail, preview và object audit | Recipient, requester, coordinator, BU/Department/All record scope | Record visibility policy | Không trả recipient khác hoặc batch detail khi không có batch.view. |
| `documents.controlled_copy.record.distribute` | Distribute đúng một record không thuộc batch, hoặc child được server tách để xử lý độc lập | Assigned Distribution Coordinator | `READY_FOR_DISTRIBUTION` | E-signature theo policy, idempotency; không cần và không suy ra `batch.distribute`. |
| `documents.controlled_copy.record.cancel_request` | Cancel đúng một request record đơn lẻ | Requester hoặc Coordinator policy | `READY_FOR_DISTRIBUTION` | Không dùng để huỷ record đã Distributed; reason/audit khi policy yêu cầu. |
| `documents.controlled_copy.record.download` | Download PDF record | Cùng scope `record.view` | `DISTRIBUTED` và chưa expiry/recall | Policy download + atomic quota + audit signed URL. |
| `documents.controlled_copy.record.print` | Print record | Cùng scope `record.view` | `DISTRIBUTED` và chưa expiry/recall | Policy print + atomic quota + audit. |
| `documents.controlled_copy.record.recall` | Recall một record | Coordinator/operation record scope | `DISTRIBUTED` | Revoke link/token, reason/e-signature theo policy. |
| `documents.controlled_copy.record.report_lost_damaged` | Report Lost/Damaged | Recipient và/hoặc Coordinator policy | `DISTRIBUTED` | Reason/evidence; không overwrite history. |
| `documents.controlled_copy.record.replace_lost_damaged` | Issue replacement record | Coordinator policy | Lost/Damaged/eligible incident state | Create new record and link superseded record. |
| `documents.controlled_copy.record.upload_evidence` | Upload incident evidence | Reporter/coordinator policy | Incident context | MIME/virus/hash/original-derived watermark/audit. |
| `documents.controlled_copy.record.view_evidence` | View incident evidence | Reporter/coordinator/audit scope | Evidence retained | Separate from `record.view`. |
| `documents.controlled_copy.record.download_evidence` | Download evidence | Narrow high-risk scope | Evidence retained | Reason/audit/download logging. |

#### E. Security & Authorization administration

**[Đã reconcile với DB thật qua `psql` ngày 2026-08-09 — cột "Permission" dưới đây là tên đã deploy thật, KHÔNG phải tên aspirational của bản plan gốc. Xem Mục 4.4 để đối chiếu tên cũ→tên thật.]**

| Permission (đã deploy thật) | Action chính xác | Scope/constraint | Control bắt buộc | Ghi chú lệch |
|---|---|---|---|---|
| `settings.user.view` | Xem User Management/Profile | Assigned org/BU/Department user scope | Không trả password, secret, token. | |
| `settings.user.create` | Tạo eQMS user | Org/BU/Department scope | Validate profile eligibility; audit. | |
| `settings.user.edit` | Sửa user profile/status **VÀ** suspend/terminate/reinstate — dùng chung 1 code | Org/BU/Department scope | **Gap thật**: không có check "không self-escalate", không có "protect last active admin" — chỉ check permission 1 lần ở controller, không có business rule trong service. | Plan gốc muốn 3 code riêng (`update`/`suspend`/`terminate`) — thực tế chỉ có 1. |
| `settings.user.reset_password` / `settings.user.force_logout` | Reset/force session invalidation | User admin scope | Audit + notify target. | |
| `users.view_external_provisioning` | Xem Entra link/provision status | User management scope | Server obtains/matches status; no token/secret to FE. | Không có tiền tố `security.users.external_identity.*`. |
| `users.invite_external` | Invite Entra Guest | User management scope | Graph server-side thật (`ExternalIdentityProvisioningService`), reason/audit/result/object id. | |
| `users.retry_external_provisioning` / `users.resend_external_invitation` | Resend invitation/retry provisioning | User management scope | Idempotent; prevent duplicate Guest. | |
| `users.disable_microsoft_access` | Disable Microsoft access | User management scope | Không mặc định delete tenant guest. | |
| `users.remove_external_identity` | Remove eQMS-Entra link | High-risk user management scope | Reason/audit; no automatic tenant delete. | |
| `security.access_profiles.view/update/assign` | View/update/assign profile | Security admin scope | Profile code immutable; prevent self-escalation/last-admin loss. | Không có `manage` — dùng `update`. |
| `security.permission_sets.view/update` | View/manage permission set | Security admin scope | Version/audit/catalog validation. | Không có `manage` — dùng `update`. |
| `security.object_rules.view/manage` | View/manage scope/object grants | Security admin scope | Explicit Deny priority, audit. | Không có `object_access_rules` — dùng `object_rules`. |
| `security.workflow_authorization.view/manage` | View/manage workflow action policy | Security admin scope | Cannot create arbitrary core state; version/audit. | Không có `workflow_policies` — dùng `workflow_authorization`. |
| `security.sod.view/manage` | View/manage SoD | Security admin scope | Validate conflicts, audit policy version. | Không có `sod_rules` — dùng `sod`. |
| `security.access_review.view/manage` | Run access review campaigns | Security governance scope | Assignment, evidence, sign-off/audit. | Số ít `access_review`, không phải `access_reviews`. |
| `security.maintenance.bypass` | Bypass maintenance-mode block (F-02) | SysAdmin/emergency scope | Đã deploy thật, chưa từng ghi trong tài liệu gốc. | Bổ sung mới vào catalog. |
| `security.break_glass.use` | Emergency time-bound access | Explicit restricted scope | TTL, justification, audit/hậu kiểm. | **Thuần lý thuyết — không tồn tại trong DB/code. Backlog mới nếu muốn làm, không phải rename.** |

#### F. Settings, integration, audit và work

| Permission | Action chính xác | Scope/condition | Control bắt buộc |
|---|---|---|---|
| `settings.system.view/manage` | View/manage general/security/document configuration | Global configuration scope | Manage requires reason/audit; secrets masked. |
| `settings.dictionary.view/manage` | View/manage dictionary master data | Dictionary scope | Immutable historical codes; audit. |
| `settings.navigation_labels.view/manage` | View/manage labels sidebar/breadcrumb/title | Global configuration scope | Server persists/applies; audit. |
| `settings.email_templates.view/manage` | View/manage email template | Template scope | Version/preview/audit. |
| `settings.office_online.view/manage/test` | View/configure/test Graph Office Online | Integration admin scope | Secret store; test server-side; audit. |
| `settings.storage.view/manage/test` | View/configure/test MinIO/storage | Integration admin scope | Mask secret; server test/audit. |
| `settings.publishing_templates.view/manage` | View/manage publishing template | Template scope | Version/preview/audit. |
| `settings.controlled_copy_policy.view/manage` | View/manage CC policy | Global policy scope | Download/print/expiry/recipient policy version/audit. |
| `audit.global.view` | Search global audit | Module/BU/Department/All audit scope | SQL scope/redaction. |
| `audit.global.export` | Export global audit | Same audit scope | Export audit + redaction/watermark policy. |
| `audit.review.view/manage` | View/manage audit review campaign | Governance scope | Assignment/sign-off/audit. |
| `work.projects.view/create/update/manage_members` | Project actions | Owner/member/project scope | Members do not imply global projects. |
| `work.projects.scope.all` | View all projects in granted org scope | BU/Department/All | Does not grant member management. |
| `work.issues.view/create/update` | Issue actions | Project/issue scope | Workflow/state policy if enabled. |
| `training.module.view` | Training menu | Module access | Adapter only in this phase. |
| `training.material.view/manage`, `training.assignment.view/manage`, `training.session.view/manage`, `training.completion.record` | Training target catalog | Training scope/assignment | Do not build Training domain in this refactor. |

#### G. Legacy permission mapping rules

| Legacy code/pattern | Target decision |
|---|---|
| `documents.workspace.manage` | Deprecated. Migrate to granular Document/Revision/Controlled Copy actions; never use as broad action bypass. |
| `documents.document.update_draft`, `documents.revision.update_draft` | Không seed mới. Alias đọc tạm thời sang canonical đã deploy `documents.document.update_metadata` và `documents.revision.update_draft_metadata`, rồi loại bỏ sau cutover. |
| `documents.revision.review` | Alias during migration to `documents.revision.complete_review`. |
| `documents.revision.approve` | Alias during migration to `documents.revision.complete_approval`. |
| `documents.document.preview_published`, `documents.revision.preview`, `documents.document.view_audit` | Become inherited capabilities of target `*.view`; no independent grants after cutover. |
| `documents.document.download_published`, `documents.revision.download_source` | Deactivate for ordinary preview path; no target Document/Revision download permission in approved model. |
| `documents.controlled_copy.approve_request`, `reject_request`, `prepare_distribution`, `generate` | Retire; distribution is modelled by request/distribute/cancel/recall batch or record actions. |
| `documents.controlled_copy.*` old flat actions | Map to either `batch.*` or `record.*`, never both by default. |
| `security.users.*`, `security.users.external_identity.*` (tên aspirational cũ của tài liệu này) | **Đã đảo ngược quyết định**: `settings.user.*` và `users.*` (không namespace) mới là canonical đã deploy thật — không rename chúng. Chỉ sửa tài liệu cho khớp thực tế, đúng nguyên tắc Mục 1.1.7. |
| `system-admin.*`, display-role selectors | Remove after migration; replace by `security.*`/`settings.*` and policy/scope evaluation. |

## 5. Data model, migration và API

### 5.1 Database

Tạo migration mới, không sửa migration lịch sử, cho:

- Permission catalog chuẩn và mapping alias legacy → target permission.
- Access Profile/Permission Set phiên bản hóa, profile-permission và profile-scope.
- `authorization_relation_definitions`: `code`, `display_name`, `resource_type`, `resolver_code`, `resolver_config_json`, `active`, `version`, audit fields. `resolver_code` chỉ được chọn từ catalog server-owned.
- `workflow_action_policy_relations`: mapping action policy ↔ relation definition, rule `ANY`/`ALL`, sequence requirement và priority; không lưu display role name.
- Object grant với `resource_type`, `resource_id`, `effect`, `principal`, `reason`, `created_by`, `created_at`, `audit_id`.
- Workflow action policy với stable `resourceType`, `actionCode`, `fromState`, relation requirement, sequence requirement, required permission và policy version.
- SoD constraint với resource/document type/action pairs, effect và version.
- Authorization decision/audit snapshot: actor, permission, scope, relation, policy version, state trước/sau, allow/deny/reason.

Giữ `roles.code` bất biến, không dùng `roles.name` làm selector. Backfill profile/perms/rules từ dữ liệu cũ trước cutover và có báo cáo orphan/duplicate/deprecated permission.

### 5.2 API

Tạo/chuẩn hóa các API:

```text
GET  /authorization/context
GET  /authorization/resources/{resourceType}/{resourceId}/capabilities
POST /authorization/evaluate                 (Admin simulator)
GET  /authorization/catalog
GET  /authorization/relation-definitions
CRUD /authorization/relation-definitions
CRUD /authorization/access-profiles
CRUD /authorization/permission-sets
CRUD /authorization/scope-rules
CRUD /authorization/object-grants
CRUD /authorization/workflow-policies
CRUD /authorization/sod-rules
GET  /authorization/audit
```

Tất cả list API phải áp dụng SQL filter theo authorization scope. Detail, preview, audit object, export, download, print và mọi mutation tái dùng cùng evaluator, không tin capability FE cũ.

### 5.3 Frontend — Authorization Console mới

Không tiếp tục mở rộng cấu trúc UI `security-authorization` cũ. Xây Authorization Console mới theo server contract; mọi list/detail/status đều do API trả về. Không dùng `window.confirm`/`window.prompt`; tái sử dụng `PageHeader`, `TabNav`, `TablePagination`, `Select`, `Checkbox`, `Badge`, `EmptyState`, `Modal`/confirmation dialog và `PortalDropdownMenu` trong `src/components/ui`.

#### A. Information architecture và route

| Màn hình/route | Người dùng | Mục tiêu UI | Quyền để vào |
|---|---|---|---|
| `/security/authorization/overview` | Security administrator | Health, thay đổi chờ review, shadow mismatch, profile/scope summary. | `security.access_profiles.view` hoặc governance permission. |
| `/security/authorization/access-profiles` | Security administrator | List/profile detail, assignment và permission/scope hiệu lực. | `security.access_profiles.view/manage/assign`. |
| `/security/authorization/permission-catalog` | Security/governance | Tra cứu permission chuẩn, alias, resource/action và deprecation. | `security.permission_sets.view`. |
| `/security/authorization/relations` | Security/workflow administrator | Cấu hình relation definition qua resolver chuẩn. | `security.workflow_policies.view/manage`. |
| `/security/authorization/scopes` | Security administrator | Scope rule, organizational scope, explicit object grant/Deny. | `security.object_access_rules.view/manage`. |
| `/security/authorization/workflow-policies` | Workflow administrator | Action × state × permission × relation × control. | `security.workflow_policies.view/manage`. |
| `/security/authorization/sod` | Quality/security governance | SoD constraint, exception policy và version. | `security.sod_rules.view/manage`. |
| `/security/authorization/access-reviews` | Governance | Campaign review, attestation, evidence và sign-off. | `security.access_reviews.view/manage`. |
| `/security/authorization/simulator` | Security/governance | Mô phỏng một decision an toàn, không thực thi mutation. | `GET/POST authorization evaluate` theo scope. |
| `/security/authorization/audit-health` | Security/governance | Audit authorization, migration health, shadow mismatch và feature flags. | `authorization.audit`/security governance scope. |

Nếu không có capability vào một route, Sidebar không hiển thị menu và route guard điều hướng về trang an toàn. Server vẫn trả `403` nếu user gọi URL/API trực tiếp.

#### B. Quy tắc bố cục và responsive

- Dùng cùng bố cục Configuration: `PageHeader` + title + breadcrumb; action chỉ ở footer action bar, không lặp ở header trừ Back.
- Desktop: sidebar authorization 240–280px, content có max width phù hợp; tablet/mobile: sidebar chuyển thành `Select`/drawer, phần filter thu gọn accordion.
- Bảng desktop có sorting/filter/pagination server-side; mobile chuyển từng row thành card có các field quan trọng và action menu portal không bị đóng khi scroll.
- Form có Save/Cancel cố định ở footer; chỉ hiện Save khi API trả capability `manage`; khi có dirty change phải cảnh báo bằng dialog UI chuẩn.
- Code, ID, resource type hiển thị monospace/read-only; display name và description editable theo capability. Không hiển thị secret/token/password.
- Mọi mutation hiển thị loading cục bộ, toast kết quả và server validation/error code; không reload toàn trang.

#### C. Chi tiết từng màn hình

**Overview**

- Card: số Profile active, permission deprecated còn được dùng, scope/object deny, policy version sắp hiệu lực, shadow mismatch, access review quá hạn.
- Bảng “Cần xử lý” với link sang profile/policy/mismatch cụ thể; không có nút “sửa tất cả”.
- Chart chỉ dùng dữ liệu aggregate từ server; click chart luôn mở danh sách đã scope-filter.

**Access Profiles**

- List: Code, Display Name, Status, Permission count, Scope count, Assigned users, Last changed by/on. Search và pagination do server xử lý.
- Detail chia tab: General; Permissions; Data Scope; Assignments; Change History; Effective Access Preview.
- `code` chỉ hiển thị read-only sau tạo; Display Name/Description được đổi. Permission picker nhóm theo module/resource, mỗi item có mô tả action/state/control từ catalog.
- Assignment user chỉ chọn profile, không gán một permission chức năng trực tiếp cho user. UI cảnh báo self-escalation/last-active-admin từ server trước Save.

**Permission Catalog**

- Catalog là read-only với permission seed bởi migration: Code, module, resource, action, description, lifecycle states, policy controls, aliases và trạng thái Active/Deprecated.
- Có drawer detail giải thích `view` inheritance, sự khác biệt Batch/Record, download/print quota và legacy mapping.
- Không có nút tạo arbitrary permission từ FE; permission mới yêu cầu migration/code review để server có endpoint/action tương ứng.

**Relation Definitions**

- List: Relation Code, Display Name, Resource Type, Resolver, Resolver Configuration, Active, Version, Changed By/On.
- Form bắt buộc chọn Resolver bằng `Select`; trường config được render từ schema resolver do server trả về, ví dụ `participantType`, `recipientKind`, `scopeType`.
- Ví dụ: Admin tạo `DOCUMENT_STEWARD` dùng `WORKFLOW_PARTICIPANT` + `participantType=STEWARD`, sau đó chọn relation này trong workflow action policy; không có text-area nhập expression/code.
- Không cho sửa `resolver_code` hoặc resource type khi relation đã được policy sử dụng; yêu cầu clone/version relation để bảo toàn audit lịch sử.

**Scope & Object Access**

- Hai tab: Organizational Scopes và Object Grants. Scope form chọn principal là Access Profile, scope type (All/BU/Department), target và effect.
- Object Grant form yêu cầu resource type, record được server search theo scope, principal, Allow/Deny, reason; Deny luôn hiển thị nhãn đỏ rõ ràng.
- Không cho user gán explicit permission trực tiếp; object grant chỉ là Allow/Deny ngoại lệ cho permission đã có qua Access Profile.
- Detail record hiển thị “Why allowed/denied” dạng read-only từ decision trace đã redaction.

**Workflow Policies**

- Bảng theo Resource → Action → From state → To state → Required permission → Accepted relations → Sequence → Required controls → Policy version.
- Policy editor dùng stepper: chọn resource/action; server trả lifecycle state/action hợp lệ; chọn permission catalog; chọn relation definitions; chọn `ANY`/`ALL`; cấu hình sequence, reason/e-signature/quota qua Checkbox/Select.
- Không có UI tạo state/transition mới. Conflict/SoD và missing relation phải server validate trước Save; UI chỉ trình bày lỗi theo field.

**SoD, Access Review, Simulator, Audit Health**

- SoD: rule builder theo resource/action/relation conflict, effect và version; có preview impacted assignment từ server, không tự áp exception im lặng.
- Access Review: campaign scope, reviewer, deadline, evidence, sign-off; history immutable.
- Simulator: chọn actor, resource type và record qua typeahead server-side; trả decision timeline gồm permission, scope, relation, state, SoD/policy và reason code. Không lộ object ngoài scope của người mô phỏng.
- Audit Health: shadow mismatch, deprecated alias usage, orphan assignment, failed migration, feature-flag trạng thái; export cần permission riêng và audit.

#### D. FE integration với nghiệp vụ toàn hệ thống

- Tạo `useResourceCapabilities(resourceType, resourceId)` dùng capability API. Các màn hình Document, Revision, Controlled Copy, User, Settings, Work chỉ render button/tab/action khi capability tương ứng `allowed=true`.
- `view` capability cho Document/Revision tự render Detail, tab chuẩn, preview và object audit; không tạo guard FE riêng cho từng tab. Controlled Copy Record `download`/`print` là capability riêng do server trả policy/quota hiện thời.
- Sau mutation thành công, invalidation/refetch chỉ cho resource, capability và list query liên quan. SSE event `authorization-policy-changed`, `resource-assignment-changed`, `resource-state-changed` yêu cầu refresh capability nền; không F5/polling toàn trang.
- FE không gửi relation/scope quyết định trong request mutation. Server tự resolve từ DB; FE chỉ gửi input nghiệp vụ hợp lệ như reason, e-signature hoặc field form.

## 6. Ma trận lifecycle và ví dụ bắt buộc

### 6.1 Document Master

| State | Action | Điều kiện ngoài permission |
|---|---|---|
| `DRAFT` | Update metadata, initial workflow, Save relationships, Cancel | `OWNER` hoặc `ASSIGNED_COORDINATOR`; audit old/new; reason nếu Cancel. |
| `ACTIVE` + latest Revision `EFFECTIVE` | Configure next participant/relationship, Review Date, initiate upgrade/upload, Obsolete | Save rõ ràng; không sửa lịch sử Revision Effective. |
| `OBSOLETED`, `CLOSED_CANCELLED` | View/audit, Reopen nếu policy cho phép | Read-only trừ action Reopen có reason/e-signature. |

#### Ví dụ 1 — Không hard-code DCO khi Submit for Review

| Thành phần | Giá trị |
|---|---|
| User | User Y |
| Access Profile | `QUALITY_DOCUMENT_COORDINATOR` |
| Permission | `documents.revision.submit_review` |
| Assignment trên Revision R-001 | `ASSIGNED_COORDINATOR` |
| Revision state | `DRAFT` |
| Điều kiện bổ sung | Author đã Complete Editing, source đã lock, có Reviewer hợp lệ |

```text
POST /revisions/R-001/submit-review
actor = User Y

permission submit_review              = allow
relation ASSIGNED_COORDINATOR         = allow
revision state DRAFT                  = allow
editing completed/source locked       = allow
reviewers configured                  = allow
SoD policy                            = allow
=> ALLOW
```

Kết quả: server transition `DRAFT → PENDING_REVIEW`, ghi audit, gửi notification theo audience policy. FE chỉ render Submit khi server trả capability Allow. Đổi display name Profile thành “Document Workflow Officer” không làm thay đổi hành vi.

### 6.2 Revision

| Revision state | Action | Permission | Relation/condition |
|---|---|---|---|
| `DRAFT` | Upload source/Edit Online/Sync/Complete Editing | upload/edit/sync/complete authoring | `AUTHOR`, `CO_AUTHOR` hoặc actor policy; source validation/lock. |
| `DRAFT` đã complete editing | Submit for Review | `submit_review` | Author/Co-author/Assigned Coordinator; reviewer hợp lệ. |
| `PENDING_REVIEW` | Complete/Reject Review | complete/reject review | Assigned Reviewer đang Pending, đúng sequence. |
| `PENDING_APPROVAL` | Complete/Reject Approval | complete/reject approval | Assigned Approver đang Pending, đúng sequence, SoD pass. |
| `PENDING_TRAINING` | Manage/Complete training | training permissions | Training assignment/policy. |
| `READY_FOR_PUBLISHING` | Workspace/Publish | workspace/publish | Publishing actor + e-signature. |
| `EFFECTIVE` | View/Upgrade/Obsolete | view/upgrade/obsolete | Scope/coordinator policy; upgrade không sửa version Effective. |

#### Ví dụ 2 — Author không tự Review tài liệu của mình

| Thành phần | Giá trị |
|---|---|
| User | User B |
| Revision | R-002 |
| Quan hệ | `AUTHOR` và được gán nhầm `ASSIGNED_REVIEWER` |
| Permission | `documents.revision.complete_review` |
| Revision state | `PENDING_REVIEW` |
| SoD policy | `AUTHOR_CANNOT_REVIEW_OWN_REVISION = true` |

```text
permission complete_review            = allow
relation ASSIGNED_REVIEWER            = allow
state PENDING_REVIEW                  = allow
reviewer sequence                     = allow
SoD: actor is Author of same revision = DENY
=> DENY / reasonCode = SOD_VIOLATION
```

Kết quả: không có Complete/Reject Review trong capability. Gọi mutation trực tiếp trả `403 SOD_VIOLATION`. Admin chỉ thay đổi SoD policy có audit, không sửa code.

#### Ví dụ 3 — Cùng user, hai quan hệ trên hai revision

| User | Revision | Relation | State | Capability đúng |
|---|---|---|---|---|
| User C | R-003 | `AUTHOR` | `DRAFT` | Edit Online, Upload Source, Complete Editing |
| User C | R-004 | `ASSIGNED_REVIEWER` | `PENDING_REVIEW` | Complete Review, Reject Review |
| User C | R-004 | `ASSIGNED_REVIEWER` | `DRAFT` | Không có Review action |
| User C | R-003 | `AUTHOR` | `PENDING_REVIEW` | Không Review nếu không được gán Reviewer và SoD cho phép |

### 6.3 Controlled Copy

| Resource/state | Action | Permission | Scope/condition |
|---|---|---|---|
| Batch `READY_FOR_DISTRIBUTION` | Distribute/Cancel Request | batch distribute/cancel | Coordinator hoặc requester policy; child-by-child result. |
| Batch | View/Recall | batch view/recall | Requester/coordinator/organization scope; recipient không mặc định có. |
| Record `DISTRIBUTED` và còn hiệu lực | View/Preview | record view | Recipient/requester/coordinator; portal policy. |
| Record `DISTRIBUTED` và còn hiệu lực | Download/Print | record download/print | Policy bật + quota server-side atomically. |
| Record `DISTRIBUTED` | Report Lost/Damaged | report lost/damaged | Recipient/coordinator policy + reason/evidence. |
| Incident record | Replace | replace lost/damaged | Coordinator policy; tạo record mới, không sửa lịch sử. |
| `EXPIRED`, `RECALLED`, `OBSOLETED`, `CLOSED_CANCELLED` | View history/audit | record view | Không preview/download/print. |

#### Ví dụ 4 — Recipient chỉ xem Controlled Copy của mình

| Thành phần | Giá trị |
|---|---|
| Batch | BATCH-001 |
| Record | CC-001 |
| Recipient | User Z |
| Permission | `documents.controlled_copy.record.view` |
| Relation | `RECIPIENT` của CC-001 |
| Batch permission | Không có |
| Record khác | CC-002, CC-003 |

Kết quả: User Z xem Detail, preview và audit của CC-001; không thấy batch, không thấy recipient khác. Truy cập trực tiếp batch endpoint trả `403 OUT_OF_SCOPE`.

#### Ví dụ 5 — Controlled Copy download một lần

| Thành phần | Giá trị |
|---|---|
| Record | CC-001 |
| State | `DISTRIBUTED` |
| `allowDownload` | `true` |
| `oneTimeDownload` | `true` |
| Actor | Recipient User Z |
| Remaining quota | `1` |

```text
Lần 1:
authorize(record.download) = ALLOW
atomic update remaining_downloads 1 -> 0
audit DOWNLOAD_GRANTED
return signed URL

Lần 2:
authorize(record.download) = DENY
reasonCode = DOWNLOAD_QUOTA_EXHAUSTED
return 403
```

#### Ví dụ 6 — Batch Department mixed status

| Child record | Recipient | State |
|---|---|---|
| CC-010 | User A | `DISTRIBUTED` |
| CC-011 | User B | `RECALLED` |
| CC-012 | User C | `DISTRIBUTED` |

Batch hiển thị `MIXED`; child record là nguồn trạng thái chính. User A/C chỉ thấy record của mình; User B chỉ xem lịch sử CC-011. Reconciliation SYSTEM job phát hiện summary lệch child state và ghi audit.

#### Ví dụ 7 — Expiry là action SYSTEM

| Thành phần | Giá trị |
|---|---|
| Record | CC-020 |
| Expiry | Đã qua |
| Worker | `SYSTEM:controlled-copy-expiry` |
| Trigger | Scheduled job |
| Policy version | CCP-12 |

Worker revoke signed URL/access token, transition `EXPIRED`, audit actor type SYSTEM, job id, policy version, before/after, retry count và kết quả revoke. Không dùng tài khoản Admin hay permission recipient.

## 7. Lộ trình triển khai an toàn

### Phase 0 — Nền tảng dùng chung, làm một lần

1. Freeze catalog mục 4.5, mapping legacy alias và báo cáo permission orphan/duplicate từ DB thật.
2. Tạo `AuthorizationEngineService` với contract `authorize(actor, resourceType, resourceId, action, context)` và `ResourceAuthorizationAdapter` cho mỗi resource type.
3. Tái sử dụng `PermissionEvaluationService`/`EffectivePermissionService`, `SodConstraintService`, `ElectronicSignatureService`, `AuditTrailService`; không tạo evaluator song song thứ ba.
4. Tổng quát `ObjectAccessRule`, `ObjectAccessEvaluationService`, `EffectiveAccessDiagnosisService` cho resource type đăng ký; Explicit Deny thắng Allow.
5. Migrate `WorkflowActorType` sang relation definition metadata-driven, cập nhật toàn bộ policy actor sang `relation_code` và regression test trước merge. Resolver catalog vẫn server-owned; đây là thay đổi schema chung nên không thể shadow từng enum.
6. Thêm trigger/constraint DB bảo vệ `roles.code`; thêm cảnh báo bất biến lifecycle ở entity/migration; không tạo status-definition CRUD.
7. Mở rộng `AuthorizationShadowEvaluationService` và `authorization_shadow_evaluation_events` để lưu legacy/new decision, resource type, action, context tối thiểu và lý do lệch.
8. Tạo capability/API mục 5.2 song song API cũ, có feature flag module/action và rollback flag.

### Quy tắc cutover bắt buộc cho từng module

1. Viết adapter engine mới và policy DB, **chưa đổi enforcement thật**.
2. Gọi engine mới song song tại điểm evaluator cũ đang enforce; ghi shadow decision nhưng legacy vẫn quyết định.
3. Phân tích mọi lệch. Chỉ bật flag khi lệch bằng 0 hoặc từng lệch có quyết định nghiệp vụ, patch và kiểm thử chứng minh.
4. Bật engine mới cho chính module/action qua feature flag; list/detail/file/mutation phải dùng cùng evaluator.
5. Sau cửa sổ quan sát ổn định, xóa evaluator/alias/hard-code cũ; grep toàn repo không còn caller trước khi đóng phase.

### Thứ tự triển khai thực tế

1. **Khối Document Master + Revision + scope generalization**: phải đi liền vì Object Access hiện phụ thuộc Document Authorization.
2. **Controlled Copy Batch + Record**: sau khối Document/Revision; chuyển child record thành nguồn state, áp dụng policy quota/evidence/expiry.
3. **Authorization Console FE**: xây mới theo blueprint mục 5.3 sau khi ba resource trên đã ổn định backend; không tiếp tục mở rộng UI `security-authorization` cũ.
4. **User/Entra**: access profile, user lifecycle, Entra provisioning và object/scope administration.
5. **Settings, Audit, Notification**.
6. **Work Management**.
7. **Training adapter**: chỉ đăng ký resource/capability, không xây domain Training mới.

### Rollback và dữ liệu lịch sử

- Rollback chỉ bằng feature flag về evaluator cũ của đúng module/action.
- Không rollback audit, e-signature, shadow event, decision snapshot hoặc history.
- Migration chỉ bổ sung/version hóa; không xóa permission cũ cho tới khi migration health không còn tham chiếu.

## 8. Test và Definition of Done

- Trước mỗi cutover: báo cáo shadow evaluation trên dữ liệu thật không còn lệch chưa được phê duyệt.
- Matrix: từng mutation API × state × permission × relation × scope × SoD.
- Direct API bypass trả quyết định giống capability/UI.
- Rename profile display name không đổi quyền; role/profile code bất biến.
- Explicit Deny luôn thắng Allow.
- Test reviewer/approver sequence, self-review/self-approval, self-escalation profile, last-active-admin.
- Test Document/Revision view inheritance cho preview/audit.
- Test Controlled Copy batch/record isolation, recipient privacy, mixed state, download/print quota, expiry, recall, incident/evidence.
- Test cache invalidation khi profile/scope/policy/participant đổi; FE cập nhật action không cần F5.
- Test relation definition: relation mới dùng resolver chuẩn được Admin cấu hình và dùng được trong policy mà không đổi FE/Java; relation dùng resolver chưa đăng ký phải bị server từ chối.
- Test relation đã có policy/history không thể đổi resolver/resource type; phải version/clone để bảo toàn quyết định lịch sử.
- Test audit chứa actor, relation, permission, scope, policy version, state before/after, reason/e-signature và denial reason.
- Không còn authorization dựa trên display role name, FE-only guard hoặc route/file endpoint bypass.
- Mỗi phase phải chạy backend test suite, TypeScript typecheck, kiểm tra migration bằng PostgreSQL/Docker thật và test trực tiếp các endpoint list/detail/file/mutation.
- Chỉ xóa legacy evaluator sau khi rà soát tham chiếu toàn repo và cửa sổ quan sát feature flag ổn định.

## 9. Tiến độ triển khai (cập nhật bởi Claude Code — không phải một phần thiết kế đích)

> Phần này chỉ ghi nhận trạng thái thực thi tại thời điểm cập nhật gần nhất (2026-08-08). Không sửa nội dung thiết kế ở Mục 1-8 khi cập nhật phần này.

### Phase 0 — Nền tảng dùng chung

- [x] 1. Freeze catalog, mapping legacy alias, báo cáo permission orphan/duplicate.
- [x] 2. `AuthorizationEngineService` + `ResourceAuthorizationAdapter` contract.
- [x] 3. Tái sử dụng `PermissionEvaluationService`/`EffectivePermissionService`/`SodConstraintService` (SoD runtime per-decision **chưa** implement — xem ghi chú trong `AuthorizationEngineService` javadoc, cần schema/service riêng).
- [x] 4. Tổng quát `ObjectAccessRule`/`ObjectAccessEvaluationService` cho resource type đăng ký.
- [x] 5. Migrate `WorkflowActorType` sang relation definition metadata-driven (V349, V353, V354), xoá actor type chết.
- [x] 6. Trigger DB bảo vệ `roles.code`; cảnh báo bất biến lifecycle ở entity.
- [x] 7. Mở rộng `AuthorizationShadowEvaluationService`/`authorization_shadow_evaluation_events` cho đa resource type.
- [x] 8. API `POST /authorization/evaluate`, `GET /authorization/relation-definitions` + feature flag `APP_AUTHORIZATION_HYBRID_ENGINE_ENABLED_RESOURCE_TYPES`.

### Thứ tự triển khai thực tế

1. **Document Master + Revision + scope generalization** — ✅ Hoàn tất backend. Adapter (`DocumentResourceAdapter`, `RevisionResourceAdapter`), shadow-evaluation nối vào điểm enforcement thật, feature flag đã bật (`REVISION,DOCUMENT`). Shadow-eval tổng hợp xác nhận 0 lệch trước khi bật flag; **chưa có traffic thật xác nhận lại** (xem mục cutover rule 5 dưới).
   - **[Cập nhật 2026-08-11] Cutover Rule 5 cho DOCUMENT — Hoàn tất.** `DocumentMasterWorkflowAuthorizationService` viết lại hoàn toàn: xoá `checkInternal`/`resolvePolicy`/`resolveCapability`/phụ thuộc `LifecycleStatePolicyEvaluator`/`LifecycleStatePolicyRepository`/`AuthorizationShadowEvaluationService`/`AuthorizationCutoverFlags` — không còn nhánh legacy, không còn so sánh shadow (không còn gì để so sánh). `check()` gọi thẳng `AuthorizationEngineService`, **fail-closed** khi engine throw exception (quyết định của người dùng: từ chối + lý do rõ ràng `AUTHORIZATION_ENGINE_ERROR`, không fallback legacy — thay thế hành vi fail-open trước đó). `@Lazy` giữ nguyên trên `AuthorizationEngineService` (vẫn có vòng phụ thuộc thật qua `documentAuthorizationService` → `documentMasterWorkflowAuthorizationService` → `authorizationEngineService` → ... → `documentAuthorizationService`, xác nhận qua lỗi Spring context thật khi thử bỏ `@Lazy`). Test viết lại toàn bộ (`DocumentMasterWorkflowAuthorizationServiceTest.java`, 5 case: allow/deny/fail-closed/incomplete-input/request-shape). Verify: build + `./mvnw test` (567 test, 0 fail, 8 lỗi hạ tầng không liên quan đã biết từ trước) + deploy Docker thật + curl thật xác nhận `cancel`/`obsolete` capability không đổi hành vi so với trước khi xoá.
   - **Cutover Rule 5 cho REVISION — chưa làm**, quy mô lớn hơn nhiều: `RevisionWorkflowAuthorizationService` (632 dòng) không tách biệt hoàn toàn khỏi engine mới như Document — `RevisionResourceAdapter` tái sử dụng trực tiếp `isRevisionAuthor`/`isRevisionCoAuthor`/`isPendingReviewer`/`isPendingApprover`/`checkStatePrecondition` (package-visible) nên không thể xoá cả file, chỉ xoá được `checkInternal`/`evaluatePolicy`/`decorateWithEffectiveResult`/`matchesActor`/`isRevisionOwner`/`hasRevisionPermission`/`describeSequenceBlock` (nhánh chỉ phục vụ quyết định cũ). Có 1274 dòng test đang test trực tiếp nhánh này (`RevisionWorkflowAuthorizationServiceTest.java` 656 dòng, `RevisionWorkflowAuthorizationPolicyRuntimeTest.java` 479 dòng, `RevisionWorkflowAuthorizationServiceCutoverTest.java` 139 dòng) cần viết lại có chọn lọc. Người dùng đã đồng ý cách tiếp cận: làm từng phần nhỏ, Document trước (xong), Revision ở lượt sau.
2. **Controlled Copy Batch + Record** — ✅ Hoàn tất backend. Adapter (`ControlledCopyResourceAdapter`, `ControlledCopyBatchResourceAdapter`), migration V354 seed relation (OWNER/RECIPIENT/PERMISSION_*), shadow-evaluation nối vào `evaluate()`, feature flag đã bật (`CONTROLLED_COPY,CONTROLLED_COPY_BATCH`). Loại trừ đã biết: `REQUEST_COPY` không đánh giá được qua adapter model hiện tại (xem comment trong `ControlledCopyResourceAdapter#resolvePolicy`) — không ảnh hưởng enforcement thật vì flow thật không có `copyId` tại thời điểm request.
   - **[Cập nhật 2026-08-11] Cutover Rule 5 cho CONTROLLED_COPY/CONTROLLED_COPY_BATCH — Hoàn tất, với 1 ngoại lệ giữ nguyên có chủ đích.** `ControlledCopyAuthorizationService.evaluate()` viết lại: mọi action **trừ `REQUEST_COPY`** giờ gọi thẳng `AuthorizationEngineService`, **fail-closed** (`AUTHORIZATION_ENGINE_ERROR`) khi engine throw — cùng chính sách với Document/Revision. Xoá nhánh `evaluateWithEngine`/so sánh shadow (không còn gì để so sánh), xoá field/tham số `AuthorizationCutoverFlags`/`AuthorizationShadowEvaluationService` khỏi constructor chính (2 constructor tương thích ngược cho test cũ vẫn giữ, chỉ giảm số tham số null theo). **`REQUEST_COPY` cố ý giữ nguyên trên `evaluateInternal` (toàn bộ nhánh legacy: `resolvePolicy`/`matchesAnyActor`/`validateRequestInvariants`/`hasDocumentScope`)** — không phải nợ kỹ thuật còn sót mà là quyết định rõ ràng của người dùng sau khi được hỏi: action này chưa từng đi qua engine dù đã bật flag từ trước (không có `resourceId` tại thời điểm request — bản sao chưa tồn tại), nên không có traffic thật/shadow-eval nào xác nhận 0 lệch cho riêng action này, khác hẳn các action còn lại. `validateInvariants`/`checkInvariantPrecondition` (logic bất biến trạng thái/policy dùng chung, KHÔNG phải chỉ cho REQUEST_COPY) giữ nguyên toàn bộ — cả 2 adapter vẫn gọi trực tiếp qua `checkPrecondition`. Test: `ControlledCopyAuthorizationServiceTest.java` (viết lại, giữ 4 case REQUEST_COPY + 1 case scope + 1 case capability-read-only, xoá ~15 case hành vi actor-matching của các action đã cutover — đã có `ControlledCopyResourceAdapterTest` phủ qua đường engine), `ControlledCopyAuthorizationServiceCutoverTest.java` (mới, 7 case allow/deny/fail-closed/incomplete-input/request-shape/batch-resource-type/REQUEST_COPY-never-calls-engine), `ControlledCopyInvariantPreconditionTest.java` (mới, 11 case bảo toàn coverage bất biến trạng thái/policy bị mất khi xoá case hành vi cũ). Verify: build + `./mvnw -q -o test` (529 test, 0 fail, 8 lỗi hạ tầng Flyway checksum-mismatch cục bộ không liên quan, đã biết từ trước) + deploy Docker thật (`docker compose up -d --no-deps --force-recreate backend`) + log khởi động sạch, không lỗi circular-dependency/bean creation (giữ nguyên `@Lazy` trên `AuthorizationEngineService` — vòng phụ thuộc thật qua `ControlledCopyResourceAdapter`/`ControlledCopyBatchResourceAdapter`).
3. **Authorization Console FE** — ⚠️ **Đã xây xong 10/10 màn rồi bị hoàn tác (rollback) theo quyết định người dùng — KHÔNG còn tồn tại dưới dạng console riêng.** Lịch sử thật:
   - Xây đủ 10 màn dưới `src/features/authorization-console/` đúng như mô tả ban đầu của mục này (route `/security/authorization/*` tách khỏi `security-authorization` cũ, theo đúng chỉ dẫn Mục 5.3 "không mở rộng UI cũ, xây Console mới").
   - Qua nhiều vòng phản hồi, người dùng phát hiện Console mới không tái sử dụng đúng pattern UI/UX của các màn cũ (thiếu sort cột, filter drawer, "No." column, và đặc biệt luồng "New Access Profile" bỏ mất wizard Guided/Advanced setup của `RoleSetupWizardView.tsx`).
   - Sau khi cân nhắc, người dùng quyết định **đảo ngược hướng đi của Mục 5.3**: xoá toàn bộ `src/features/authorization-console/` + `authorizationConsole.ts`, gộp mọi năng lực trở lại `security-authorization/` cũ, thay vì tiếp tục sửa Console mới cho khớp UI cũ.
   - **Đây là sai lệch có chủ đích so với văn bản Mục 5.3/§7 bước 3** ("không tiếp tục mở rộng cấu trúc UI cũ") — ghi nhận rõ ở đây để phiên sau không hiểu nhầm là Console FE vẫn còn tồn tại.

   **Trạng thái thật sau rollback** (route/vị trí hiện hành):
   - **Access Profiles, Scope & Object Access, SoD, Access Review**: không có gì mới ở tầng UI — 4 nhóm CRUD này dùng nguyên trang cũ (`/security/access-profiles`, `/security/object-rules`, `/security/sod`, `/security/access-review`), gọi `/security/*` như trước giờ. Xác nhận qua khảo sát: 4 nhóm này vốn đã gọi cùng service layer (`AccessProfileService`/`ObjectAccessRuleService`/`SodConstraintService`/`AccessReviewService`) mà `/authorization/*` controller Phase 4 cũng chỉ delegate vào — nên không mất năng lực nào khi rollback, chỉ mất lớp UI trùng lặp.
   - **Workflow Policies — Relations (năng lực thật duy nhất cần giữ lại)**: gộp vào UI cũ thay vì xoá. `LifecyclePolicyFormView.tsx` (form sửa policy) có thêm section "Relations (New Engine)" cạnh Actors, gọi `workflowActionPolicyApi.setPolicyRelations()` (hàm mới thêm, gọi `PUT /authorization/workflow-policies/{id}/relations` — endpoint Phase 4 giữ nguyên). `WorkflowAuthorizationView.tsx` (bảng danh sách) có thêm cột "Relations (New)" hiển thị badge read-only. Lý do bắt buộc phải giữ: engine mới (đã bật flag cho REVISION/DOCUMENT/CONTROLLED_COPY(_BATCH)) đọc bảng `workflow_action_policy_relations`, không đọc `workflow_action_policy_actors` mà UI cũ vốn chỉ sửa được — nếu xoá hẳn UI relations thì 3 resource type đã cutover sẽ không còn cách nào sửa quyền qua UI.
   - **Relation Definitions, Engine Health (đổi tên từ "Audit Health"), Simulator**: gộp thành 3 tab mới trong trang "Workflow Security" (`/security/lifecycle-policies`, file `LifecyclePoliciesView.tsx`), cạnh 3 tab cũ Matrix/Transitions/Capabilities. Nội dung/logic gọi API giữ nguyên như bản Console cũ (`GET /authorization/relation-definitions`, `GET /security/authorization-shadow-mismatches`, `POST /authorization/evaluate`), chỉ chuyển từ trang riêng thành tab con, bỏ `PageHeader` riêng.
   - **Permission Catalog**: gộp thành tab "Browse Catalog" trong trang Permission Sets cũ (`/security/permission-sets`, file `PermissionSetsView.tsx`), dùng `GET /security/permissions/catalog` như cũ.
   - **Overview (hub điều hướng)**: không giữ lại — xoá hẳn, không thay thế, đúng pattern cũ của route `security` (vốn không có trang index, sidebar trỏ thẳng vào từng trang con).
   - Sidebar: xoá cả 10 item `sec-authorization-*` khỏi **cả 2 nguồn** `navigation.ts` (FE) và `NavigationService.java` (BE) cùng lúc — đúng bài học duplicate-source-of-truth đã ghi nhận ở lần build Console trước.
   - Backend `/authorization/*` controllers Phase 4 (Access Profile/Scope/SoD/Access Review) — **[Cập nhật 2026-08-09] Đã xoá hẳn**, đảo ngược quyết định "giữ nguyên" trước đó. `AuthorizationAccessProfileController`/`AuthorizationScopeController`/`AuthorizationSodController`/`AuthorizationAccessReviewController` bị xoá hoàn toàn (0% được FE gọi, xác nhận qua grep); `AuthorizationWorkflowPolicyController` gọn lại chỉ còn `PUT /{id}/relations` (xoá `list`/`get`/`activate`/`deactivate` — các thao tác này FE đã dùng lại endpoint `/security/workflow-action-policies/*` cũ). `AuthorizationController` (relation-definitions, shadow-mismatches, evaluate) giữ nguyên — vẫn được 3 tab mới (Relation Definitions/Engine Health/Simulator) gọi thật. Verify: `./mvnw -q -o clean package` + `./mvnw -q -o test` đều exit 0 sau khi xoá.
   - **[Cập nhật 2026-08-09] Đồng bộ hoá full server-side cho 2 tab còn client-filter**: `EngineHealthTab.tsx` (trước đó fetch nguyên `limit` rồi filter/không phân trang ở client) và `RelationDefinitionsTab.tsx` nay đều search/filter/sort/pagination hoàn toàn ở server — thêm endpoint mới `GET /authorization/relation-definitions/paged`, `GET /security/authorization-shadow-mismatches/paged`, `GET /security/authorization-shadow-mismatches/summary` (card tổng hợp tách riêng khỏi bảng phân trang). `PermissionCatalogTab.tsx` (tab Browse Catalog trong Permission Sets) cũng đã có endpoint `GET /security/permissions/catalog/paged` tương tự.
4. **User/Entra** — ⚠️ **Một phần** (2026-08-09): đã vá 2 gap GMP + xây `UserResourceAdapter` (shadow-eval only, **chưa bật cutover flag `USER`**). 6 resource quản trị còn lại (Access Profile/Permission Set/Object Rules/Workflow Policy/SoD/Access Review) **giữ nguyên permission phẳng theo quyết định Phương án 2** — không engine hóa trong đợt này.
   - **2 gap GMP đã vá thẳng vào legacy** (không đợi cutover, vì đây là lỗi thật đang sống, không phải hành vi mới cần shadow-test): `UserManagementService.isSelfTargetingBlocked`/`checkLastActiveAdminGuard` (package-visible, tái sử dụng bởi cả legacy lẫn adapter) — chặn user tự suspend/terminate/xóa chính mình, chặn suspend/terminate/xóa admin Active cuối cùng còn giữ `settings.user.edit`. Wire vào đầu `suspendUser`/`terminateUser`/`deleteUser`, ném `IllegalArgumentException` khi vi phạm.
   - **`UserResourceAdapter.java`** (mới, package `com.eqms.service`) — adapter thứ 5, theo đúng mẫu `DocumentResourceAdapter`. `resourceType()` = `"USER"`; `resolveState` = `UserStatus` name; `resolvePolicy` synthesize theo action (không có bảng policy riêng, mirror đúng permission code đã deploy: `settings.user.edit/reset_password/force_logout/delete/view`); `isWithinObjectScope` chặn self-target (tái dùng `isSelfTargetingBlocked`); `checkPrecondition` chặn last-active-admin (tái dùng `checkLastActiveAdminGuard`). Shadow-eval wire vào `suspendUser`/`terminateUser`/`deleteUser` qua `AuthorizationEngineService.authorize()` + `AuthorizationShadowEvaluationService.recordMismatch()`, `@Lazy` inject đúng pattern `DocumentService`. **`USER` KHÔNG có trong `APP_AUTHORIZATION_HYBRID_ENGINE_ENABLED_RESOURCE_TYPES`** — engine chỉ chạy song song, không ảnh hưởng enforcement thật.
   - Test mới: `UserManagementServiceSelfEscalationGuardTest.java` (6 case: self-suspend/terminate/delete bị chặn, last-admin bị chặn, còn admin khác vẫn suspend được, target không phải admin thì không bị chặn last-admin). `UserManagementServiceStatusTransitionTest.java` (test cũ) cập nhật để actor khác target (đúng hành vi mới). Full regression `./mvnw -q -o test` — exit 0.
   - **Còn lại của Phase 4** (chưa làm): các resource quản trị khác vẫn permission phẳng — theo đúng quyết định Phương án 2, không phải việc bỏ sót.
   - **[Cập nhật 2026-08-11] Cutover Rule 5 cho USER (SUSPEND/TERMINATE/DELETE) — Hoàn tất.** Khác Document/Revision/Controlled Copy, USER không có 1 điểm `evaluate()` duy nhất trước đây — permission phẳng (`settings.user.edit`/`settings.user.delete`) nằm ở `SettingsUserController`, 2 guard GMP nằm ở `UserManagementService`, tách rời nhau. Đã hỏi người dùng cách xử lý; người dùng chọn gộp 3 điểm quyết định (permission + self-target guard + last-admin guard) thành 1 gate `UserManagementService#requireUserActionAllowed` gọi thẳng `AuthorizationEngineService.authorize()`, fail-closed khi lỗi (`AccessDeniedException`, "Unable to verify authorization for this action right now. Please try again.") — đúng chính sách Document/Revision/Controlled Copy. Việc gộp được là vì `UserResourceAdapter` đã wire sẵn `isSelfTargetingBlocked`/`checkLastActiveAdminGuard` vào `isWithinObjectScope`/`checkPrecondition`, và engine tự kiểm tra `requiredPermission` ở bước riêng (`AuthorizationEngineService#authorize` dòng ~89-93) — nên gọi engine một lần là đủ thay cho cả 3 check cũ. Xoá `requireUserEdit()`/`requireUserDelete()` khỏi 3 endpoint `suspend`/`terminate`/`DELETE /users/{id}` trong `SettingsUserController` (các endpoint khác như `reinstate`/`reset-password`/`deleteEducation` vẫn giữ permission phẳng, không đổi — đúng phạm vi Phương án 2). Xoá field/tham số `AuthorizationShadowEvaluationService` khỏi `UserManagementService` (không còn shadow-so-sánh, không còn gì để so sánh). **Không cần đổi `APP_AUTHORIZATION_HYBRID_ENGINE_ENABLED_RESOURCE_TYPES`** — code mới gọi engine vô điều kiện cho 3 action này, không đọc cutover flag (giống hệt trạng thái cuối của Document/Revision/Controlled Copy sau khi cutover xong). Các action USER khác (CREATE/VIEW/RESET_PASSWORD/FORCE_LOGOUT/UPDATE) và 6 resource quản trị còn lại vẫn permission phẳng, không đổi. Test: `UserManagementServiceSelfEscalationGuardTest.java` (viết lại, mock engine trả allow/deny theo từng reason-code, verify mapping message/exception-type: `OUT_OF_SCOPE`→"own account" `IllegalArgumentException`, `LAST_ACTIVE_ADMIN_PROTECTED`→"last active administrator" `IllegalArgumentException`, `MISSING_PERMISSION`→`AccessDeniedException`, throw→fail-closed `AccessDeniedException`), `UserManagementServiceGuardMethodsTest.java` (mới, package `com.eqms.service`, test trực tiếp 2 guard method package-visible vì không gọi được từ package `com.eqms` nữa), `UserManagementServiceStatusTransitionTest.java` (cập nhật: thêm stub engine allow ở `setUp()`, xoá mock `AuthorizationShadowEvaluationService` không dùng). Verify: build + `./mvnw -q -o test` (536 test, 0 fail, 8 lỗi hạ tầng Flyway checksum-mismatch cục bộ không liên quan, đã biết từ trước) + deploy Docker thật + log khởi động sạch, không lỗi circular-dependency/bean creation (giữ nguyên `@Lazy` trên `AuthorizationEngineService` trong `UserManagementService`).

   **Khảo sát 2026-08-09 — kết quả xác minh qua đọc code + `psql` trực tiếp (không tin theo văn bản gốc)**:
   - `UserManagementService.java` + `SettingsUserController.java` là toàn bộ logic user lifecycle. **Không có evaluator/adapter riêng** (khác Document/Revision) — chỉ gọi `PermissionEvaluationService.hasPermission()` phẳng, 1 lần duy nhất ở tầng controller. Các hàm `suspendUser`/`terminateUser`/`reinstateUser` **không có business rule bên trong** (không chặn self-suspend, không "protect last active admin" như Mục 4.5 kỳ vọng) — gap thật, chưa vá.
   - `ExternalIdentityProvisioningService.java` (520 dòng) — tích hợp Microsoft Graph **thật, đang chạy**, không phải khung sườn. Migration `V314`-`V318`.
   - **Đối chiếu permission code qua `psql` trực tiếp trên DB đang chạy** — phát hiện gần như toàn bộ Mục 4.4/4.5 Section E của chính tài liệu này dùng tên aspirational chưa từng deploy (`security.users.*`, `security.users.external_identity.*`, `security.access_profiles.manage`, `security.object_access_rules.*`, `security.workflow_policies.*`, `security.sod_rules.*`, `security.access_reviews.*`, `security.break_glass.use`). **Đã sửa lại Mục 4.4/4.5 cho khớp tên thật đã deploy** (`settings.user.*`, `users.*`, `security.access_profiles.update`, `security.object_rules.*`, `security.workflow_authorization.*`, `security.sod.*`, `security.access_review.*`, `security.maintenance.bypass`) — theo đúng nguyên tắc Mục 1.1.7 (giữ tên đã deploy, sửa tài liệu). `security.break_glass.use` xác nhận là backlog thuần lý thuyết, không tồn tại ở đâu trong code/DB.
   - **Cross-dependency = 0%** theo cả 2 chiều giữa `UserManagementService`/`ExternalIdentityProvisioningService` và `AuthorizationEngineService`/4 adapter đã xây (Document/Revision/ControlledCopy/ControlledCopyBatch) — nghĩa là làm Phase 4 không rủi ro phá vỡ 3 phase đã cutover.
   - **Phạm vi Phase 4 rộng hơn tên gọi**: Mục 4.4/4.5 gộp chung user lifecycle với việc quản trị chính Access Profile/Permission Set/Object Access Rule/Workflow Policy/SoD/Access Review — tức "ai được sửa hệ thống phân quyền", không chỉ user. Tài liệu **chưa quyết định** các hành động quản trị này có cần `ResourceAuthorizationAdapter` riêng đăng ký vào engine mới hay giữ nguyên check quyền phẳng — cần quyết định trước khi thiết kế adapter.
5. **Settings, Audit, Notification** — ⚠️ **Đã khảo sát (2026-08-12), quyết định giữ nguyên permission phẳng, không xây adapter.** Đọc code thật (không tin Mục 4 gốc) cho `AuditTrailService`/`AuditTrailReviewService` (permission `audit.view` + SUPERADMIN bypass, có scope logic riêng khi xem theo Document/Revision entity), `NotificationController`/`NotificationPolicyController` (`AuthorizationService.require()` — RBAC phẳng cũ), `DictionaryManagementService` (`requireView()`/`requireManage()` đầy đủ cho toàn bộ CRUD Business Unit/Department/Position/Document Type/Sub-Type/Storage Location/Retention Policy), `SystemConfigurationService` (`isSuperAdmin()` bắt buộc cho `/configurations/security`), `ReportPlatformService` (permission phẳng cho report definitions). **Không tìm thấy gap GMP thật nào** (khác Phase 4/User, nơi tìm ra 2 lỗ hổng thật self-escalation/last-admin). Đánh giá: toàn bộ nhóm này là admin/permission-catalog-style — không có lifecycle state (Draft→...→Effective) hay actor-relation thật (Author/Reviewer/Approver) xứng đáng xây `ResourceAuthorizationAdapter` — về bản chất giống 6 resource quản trị đã quyết định giữ flat permission ở Phase 4 (Access Profile/Permission Set/Object Rules/Workflow Policy/SoD/Access Review), không giống User. Ngoại lệ duy nhất đáng chú ý: Notification có scope `SELF` (user chỉ thấy notification của mình) nhưng xử lý ở tầng query (lọc `recipientId = currentUser`), không phải authorization decision — không đủ lý do để engine hóa. Người dùng đã xác nhận quyết định này qua `AskUserQuestion` và chọn **dừng lại, không làm tiếp Phase 6/7 trong đợt này**.
6. **Work Management** — ⬜ Chưa bắt đầu.
7. **Training adapter** — ⬜ Chưa bắt đầu.

### Cutover rule 5 (xóa evaluator cũ) — đang chờ

Chưa xoá `RevisionWorkflowAuthorizationService`, `DocumentMasterWorkflowAuthorizationService`, `ControlledCopyAuthorizationService`'s legacy logic. Lý do: dù shadow-eval tổng hợp (script test, ~15,700+ check) cho kết quả 0 lệch, **chưa có cửa sổ quan sát trên traffic thật qua UI** (yêu cầu ở §7 quy tắc 5) — phiên test thật gần nhất bị chặn bởi một gap permission không liên quan (`settings.dictionary.view` thiếu ở access profile test `AP_UAT_DCO_QUALITY`, đã vá). Việc xoá code cũ nên đợi xác nhận `authorization_shadow_evaluation_events` có dữ liệu từ nhiều transaction riêng biệt (traffic thật) với 0 lệch, xem qua trang Audit Health mới build ở mục 3.

**[Cập nhật 2026-08-09] Verify qua psql xác nhận: TOÀN BỘ ~200,000 dòng trong `authorization_shadow_evaluation_events` chỉ nằm ở đúng 15 timestamp riêng biệt, mỗi timestamp có chính xác 13,324 dòng** (`CONTROLLED_COPY` 43,650 + `CONTROLLED_COPY_BATCH` 6,975 + `DOCUMENT` 18,360 + `REVISION` 130,875 dòng, trải Aug 7-9 nhưng gộp cả vào 15 giây) — xác nhận 100% đây là kết quả chạy lại script test tổng hợp (`ShadowEvaluationRealDataGenerationTest`, mỗi lần chạy = 1 transaction = 1 timestamp), **không có bất kỳ dòng nào từ traffic UI thật**. Claude Code không có quyền truy cập trình duyệt để tự tạo traffic thật. Người dùng đã đồng ý sẽ tự thao tác qua UI thật một thời gian (tạo/sửa/nộp duyệt tài liệu, phân phối controlled copy...), sau đó quay lại yêu cầu verify — **đây là bước tiếp theo bắt buộc trước khi xoá evaluator cũ**, không được bỏ qua bằng cách coi bằng chứng script là đủ (người dùng đã cân nhắc và từ chối phương án đó).

**[Cập nhật 2026-08-09, phần 2] Traffic thật đã được tạo qua API thật (JWT thật, tài khoản `admin`/Nguyen The Hoang, không phải script batch)** — theo yêu cầu người dùng, dùng `curl` gọi trực tiếp các endpoint FE thật dùng (không phải endpoint test riêng):
- **2 bug production thật phát hiện trong lúc tạo traffic, đã vá + verify + deploy lại đúng cách**:
  1. **`docker restart` không nhận image mới khi container được tạo bởi `docker compose`** — mọi lần deploy trong phiên này trước đó (Priority 1/2/3 GMP fix, `deleteUser` signature) dùng `docker build` + `docker restart`, nhưng `restart` chỉ khởi động lại container hiện có, KHÔNG re-create từ image tag mới → các thay đổi backend hôm nay nhiều khả năng **chưa từng chạy thật** cho tới khi phát hiện qua `docker inspect eqms-backend --format '{{.Image}}'` lệch với `docker images eqms-backend:local`. Đã sửa bằng `docker compose up -d --no-deps --force-recreate backend`, verify lại bằng cách gọi API thật (suspend thiếu `signatureToken` → đúng 400 `VALIDATION_ERROR`), xác nhận toàn bộ fix GMP hôm nay giờ mới thực sự có hiệu lực. **Bài học cho các lần deploy backend sau này trong dự án này: PHẢI dùng `docker compose up -d --no-deps --force-recreate <service>`, KHÔNG dùng `docker restart`.**
  2. **`AuthorizationShadowEvaluationService.recordMismatch` ghi INSERT trong transaction read-only** — nhiều endpoint `capabilities` (`DocumentMasterActionCapabilityService.getCapabilities`, `RevisionActionCapabilityService`) chạy `@Transactional(readOnly = true)`; khi shadow-eval cố INSERT bên trong, Postgres từ chối ("cannot execute INSERT in a read-only transaction") và làm hỏng toàn bộ transaction ("current transaction is aborted") → **toàn bộ request `GET /authorization/resources/{type}/{id}/capabilities` trả về 500**, dù try/catch đã có sẵn quanh lời gọi shadow-eval (catch không cứu được vì transaction đã bị poison, câu lệnh tiếp theo trong cùng transaction luôn fail). Đây là bug production thật, độc lập với các thay đổi trong phiên này, ảnh hưởng đúng endpoint mà mọi trang chi tiết Document/Revision dùng để tính nút hành động. Đã vá bằng `@Transactional(propagation = Propagation.REQUIRES_NEW)` trên `recordMismatch` (tách khỏi transaction gọi nó), verify bằng curl thật: endpoint trả dữ liệu bình thường thay vì lỗi.
- **Traffic thật đã tạo** (sau khi vá 2 bug trên): 50 lượt `GET capabilities` cho `DOCUMENT_MASTER`, 14 lượt cho `DOCUMENT_REVISION` (toàn bộ tài liệu/revision thật trong DB) — 0 lỗi, 0 lệch quyết định allow/deny. 1 chu trình `suspend` + `reinstate` thật (kèm e-signature thật qua `POST /auth/verify-signature`) trên tài khoản UAT test `user.h.test` (không phải người thật) — 0 lệch (engine mới đồng ý hoàn toàn với legacy, không có dòng nào được ghi vì bảng chỉ ghi khi có lệch).
- **`CONTROLLED_COPY`/`CONTROLLED_COPY_BATCH` có lệch reason-code có hệ thống nhưng KHÔNG lệch quyết định**: engine mới trả `POLICY_NOT_CONFIGURED` (không có row `workflow_action_policies` khớp state hiện tại của bản sao, vd. `OBSOLETED`) trong khi legacy trả lý do cụ thể hơn (`INVALID_CONTROLLED_COPY_STATE`, `DOWNLOAD_NOT_ALLOWED_BY_POLICY`...) — đã verify bằng cách join `authorization_shadow_evaluation_events` với `controlled_copies` thật: mọi trường hợp lệch đều là bản sao ở state không có policy nào cấu hình (state cuối như `OBSOLETED`), cả 2 bên đều deny, chỉ khác nhãn lý do. Đây là khoảng trống chất lượng chẩn đoán (`ResourceAuthorizationAdapter.resolvePolicy` trả `Optional.empty()` → engine luôn dùng nhãn chung `POLICY_NOT_CONFIGURED`, không phân biệt được "chưa cấu hình" vs "action không hợp lệ ở state này"), không phải lỗi an toàn/GMP — **không chặn Cutover rule 5**, nhưng nên cải thiện nhãn lý do trước khi xây UI chẩn đoán dựa vào reason code.
- **Kết luận cutover-readiness theo decision-correctness (không tính lệch reason-code thuần cosmetic)**: `DOCUMENT`, `DOCUMENT_REVISION`, `USER`, `CONTROLLED_COPY`, `CONTROLLED_COPY_BATCH` — cả 5 resource type đã có traffic thật với **0 lệch quyết định allow/deny**. Vẫn cần thêm traffic thật đa dạng hơn (nhiều actor/permission khác nhau, không chỉ 1 tài khoản admin) trước khi coi cửa sổ quan sát là đủ dài theo đúng tinh thần §7 quy tắc 5.

**[Cập nhật 2026-08-09, phần 3] Traffic đa-actor thật đã tạo (không chỉ tài khoản admin)**, theo yêu cầu người dùng, để thoả đúng tinh thần "cửa sổ quan sát trên traffic thật" thay vì traffic đơn actor:
- **Cách làm**: dùng tài khoản admin (đã xác thực bằng e-signature thật) để reset mật khẩu tạm cho 4 tài khoản UAT test có vai trò/permission khác nhau — `user.h.test` (Approver, dùng ở phần 2), `user.g.test` (Reviewer), `user.i.test` (Viewer), `doc.controller1` (Document Controller), `user.j.test` (Controlled Copy Recipient) — đăng nhập thật bằng từng tài khoản (qua `POST /auth/login` + hoàn tất `POST /auth/me/change-password` bắt buộc do `mustChangePassword`), sau đó gọi các endpoint capabilities thật y hệt FE dùng cho trang chi tiết Document/Revision, bằng access token thật của từng actor.
- **Kết quả**: 5 actor phân biệt (admin + 4 vai trò UAT khác nhau) tạo **910 dòng traffic mới cho DOCUMENT (194) + REVISION (716)**, `count(distinct subject_user_id) = 4` (không tính admin, đã trừ trong cửa sổ đo) — **0 lệch quyết định allow/deny** trên toàn bộ traffic đa actor này.
- **Phát hiện phụ có giá trị**: `user.j.test` (vai trò Controlled Copy Recipient) bị từ chối 100% (403 `FORBIDDEN`/`Document access denied`) khi gọi capabilities cho mọi document — đúng hành vi mong đợi vì vai trò này không có quyền xem document, xác nhận object-access-rule hoạt động chính xác cho vai trò không có quyền, không chỉ cho vai trò có quyền như 3 actor còn lại.
- **Tác dụng phụ đã biết, chấp nhận được**: mật khẩu của 5 tài khoản UAT test trên đã bị đổi thành `TrafficTest@2027` trong quá trình test (không thể khôi phục mật khẩu gốc vì không được lưu lại trước khi đổi). Cả 5 đều là tài khoản dummy UAT (`@example.local`), không phải người dùng thật, nên rủi ro thấp — nhưng nếu QA cần dùng lại các tài khoản này để test thủ công sau này, cần biết mật khẩu mới.
- **Đánh giá cửa sổ quan sát cập nhật**: đã có traffic thật từ 5 actor riêng biệt (đa dạng permission/scope), 0 lệch quyết định trên toàn bộ ~2000+ dòng shadow-eval mới (phần 2 + phần 3 cộng lại) cho DOCUMENT/DOCUMENT_REVISION/USER; CONTROLLED_COPY(_BATCH) vẫn chỉ có lệch reason-code cosmetic đã biết (không lệch quyết định). Đây là bằng chứng mạnh hơn nhiều so với 1-actor traffic ở phần 2, nhưng vẫn là traffic do Claude Code tự tạo qua API trực tiếp (không phải qua UI thật, không có hành vi workflow phức tạp như nộp duyệt/approve nhiều bước, không có mutating action đa dạng ngoài 1 chu trình suspend/reinstate và 5 chu trình reset-password). Quyết định cuối cùng có coi đây là đủ để đóng Cutover rule 5 hay vẫn cần thêm một đợt dùng UI thật (nộp duyệt, review, approve, phân phối controlled copy...) là quyết định của người dùng, không tự ý kết luận thay.
