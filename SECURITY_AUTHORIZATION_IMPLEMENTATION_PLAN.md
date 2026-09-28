# SECURITY & AUTHORIZATION — KẾ HOẠCH TRIỂN KHAI

**Trạng thái:** Build-ready. Mọi quyết định đã chốt. Không còn câu hỏi treo.
**Hồ sơ bằng chứng:** [SECURITY_AUTHORIZATION_ANALYSIS_ROUND1.md](SECURITY_AUTHORIZATION_ANALYSIS_ROUND1.md) — phân tích gốc, findings F-01…F-24, hard-code inventory, ma trận FE-BE, rename safety. File này chỉ chứa **việc phải làm**.

---

## 0. Cách dùng tài liệu

- Mỗi task có: **file + số dòng**, nội dung thay đổi, tiêu chí chấp nhận, test.
- Số dòng tham chiếu tại thời điểm lập kế hoạch — kiểm tra lại trước khi sửa.
- Làm theo thứ tự phase. Trong một phase, các task độc lập trừ khi ghi rõ phụ thuộc.
- Với mỗi task: **viết test đỏ trước → sửa code → test xanh → chạy regression → cập nhật tài liệu**.

---

## 1. Quyết định đã chốt

| # | Quyết định | Kết luận |
|---|---|---|
| Q1/Q11 | Complete Editing vs Submit for Review | **Complete Editing = Author** (trách nhiệm nội dung). **Submit for Review = DCO** (trách nhiệm kiểm soát tài liệu). Actor lấy từ `workflow_action_policies`, **không hard-code trong Java**. |
| Q2 | Object Access mặc định | DENY về nguyên tắc, nhưng **không đổi hành vi runtime** (xem T-P3-1 Bước 3 — lý do kỹ thuật). |
| ~~Q3~~ | `view_all` có chịu scope? | **HUỶ** — thay bằng Q10. |
| Q4 | Phạm vi Training | Đầy đủ (Course, Material, Assignment, Trainer/Trainee, Session, Completion, Due/Overdue, Evidence, Record, Document-related, Audit, E-sign). Qualification Matrix + Competency: giai đoạn sau. **Tái sử dụng engine hiện có, không xây engine thứ hai.** |
| Q5 | Workflow Roles | **Gỡ** `access_profile_workflow_roles`. **Giữ nguyên** participant thật: AUTHOR, CO_AUTHOR, ASSIGNED_REVIEWER, ASSIGNED_APPROVER. |
| Q6 | Test/UAT data | Không sửa migration đã chạy. Tách theo environment. Data cũ: deactivate bằng migration mới, không xoá. |
| Q7 | User status | **Chỉ `Active` được truy cập.** Pending / Suspended / Inactive / Terminated đều bị từ chối. Rời `Active` ⇒ thu hồi toàn bộ session ngay. |
| Q8 | Kiến trúc | Hiện 1 instance, nhưng **không thiết kế theo giả định single-instance**. Cache cần TTL + invalidation + sẵn sàng multi-instance. |
| Q9 | Ai đọc SOP hiệu lực | **Chỉ DCO/Admin và người được chỉ định vai trò.** Nhân viên khác đọc qua **Controlled Copy**. Không bật `strictVisibility`. |
| Q10 | DCO/Admin xem tất cả? | **Có.** `documents.document.view_all` được phép vượt Object Access. Giữ nguyên code hiện tại. |
| D-1 | Thêm status `Ready for Review Submission`? | **KHÔNG.** Giữ `status = DRAFT` + `editingStatus = 'COMPLETED'` + `sourceLocked = true`. |
| D-2 | DCO kiểm tra PDF Snapshot? | **KHÔNG.** Snapshot vẫn sinh tại `submitForReview`. **Draft không preview** — quy tắc giữ nguyên vẹn. Reviewer là người đầu tiên đọc PDF. |
| D-3 | DCO sửa được metadata? | **CÓ.** |
| D-4 | Ai được CANCEL? | `AUTHOR`, `CO_AUTHOR`, `PERMISSION documents.workspace.manage` — **đã đúng sẵn** sau V288, không đổi. |
| D-5 | Có `RETURN_TO_AUTHOR`? | **KHÔNG.** Lỗi metadata → DCO tự sửa. Lỗi nội dung/file → **CANCEL** revision, Author mở revision mới. |
| D-6 | Author upload file sau Complete Editing? | **KHÔNG.** `sourceLocked = true` đã khoá. |

### Ba điểm chốt bằng phương án mặc định (không hỏi lại)

| # | Điểm | Chốt |
|---|---|---|
| **A** | Permission set nhận `settings.dictionary.*` | `QUALITY_ADMIN` (V150) + permission set được quản lý của `SYSTEM_SUPER_ADMIN` |
| **B** | Access Profile code cho actor DCO | `DCO` + `DOCUMENT_CONTROLLER`. Biến thể `DCOSTAFF`, `DCOFFICER`, `DCO_TEST` xử lý ở T-P2-2 |
| **C** | Object Access Rules / BU-Dept Scope (F-21) | **Giữ + gắn nhãn** *"Reserved for future use — không ảnh hưởng quyền truy cập hiện tại"*. Không xoá bảng. |

---

## 2. Nguyên tắc bắt buộc

1. **Không hard-code Role Name / Access Profile Name** trong business authorization.
2. Authorization theo chuỗi: Permission → Workflow Policy → Workflow Assignment → Object Access → Business Preconditions → SoD → Capability.
3. **Frontend không tự quyết định quyền.** Backend là Single Source of Truth.
4. **Không sửa Flyway migration đã chạy.** Version cao nhất hiện tại: **V342**.
5. Mọi thay đổi phân quyền phải có **Audit Trail** (actor, timestamp, target, old, new, reason, outcome).
6. Mọi mutation security admin đi qua `SecurityChangeSignatureService.requireValidToken`.
7. Mỗi migration ghi **script hoàn tác** trong comment đầu file.
8. Tuân thủ EU GMP Annex 11, FDA 21 CFR Part 11, GAMP 5.

---

## 3. Phân bổ số migration

| Version | Nội dung | Task |
|---|---|---|
| V343 | Cấp `security.maintenance.bypass` cho SYSTEM_SUPER_ADMIN | T-P0-2 |
| V344 | Kích hoạt + cấp `settings.dictionary.view` / `.manage` | T-P0-4 |
| V345 | Actor `SUBMIT_FOR_REVIEW` + `OPEN_PUBLISHING_WORKSPACE` → `ACCESS_PROFILE DCO` | T-P1-3 |
| V346 | Email template: bàn giao Author→DCO, huỷ revision→Author | T-P1-4 |
| V347 | Workflow Roles: snapshot audit + xoá dữ liệu | T-P2-1 |
| V348 | Hợp nhất permission trùng nghĩa | T-P2-2 |
| V349 | Deactivate permission orphan | T-P2-2 |
| V350 | Deactivate tài khoản/profile test | T-P2-4 |
| V351 | Ràng buộc bất biến `roles.code` | T-P2-5 |
| V352 | Migrate `reviewerNoApprove` → `sod_constraints` | T-P3-3 |

Nếu cần thêm, tiếp tục từ V353.

---

# PHASE P0 — Security Defects

**Mục tiêu:** đóng 4 lỗ hổng khai thác được. **Thời lượng:** ~5 ngày. **Không migration schema, không đổi kiến trúc.**

---

## T-P0-1 — Chặn truy cập cho user không ở trạng thái Active

**Finding:** F-01 (CRITICAL) · **Quyết định:** Q7

### Files
```
eqms-backend/src/main/java/com/eqms/auth/AuthTokenFilter.java
eqms-backend/src/main/java/com/eqms/service/UserManagementService.java
eqms-backend/src/main/java/com/eqms/service/AuthorizationService.java
eqms-backend/src/main/java/com/eqms/service/PermissionEvaluationService.java
eqms/src/services/api/client.ts
```

### Vấn đề
`UserStatus` có 5 giá trị: `Active, Inactive, Pending, Suspended, Terminated`.
- `AuthTokenFilter` **không đọc `user.getStatus()`** ở bất kỳ đâu.
- `suspendUser` (`UserManagementService.java:329-356`) **không** gọi `revokeAllSessions` (chỉ `terminateUser` có, line 366).
- `AuthorizationService.check` (line 50-53) chỉ chặn `Inactive`.
- `PermissionEvaluationService.hasPermission` — đường dẫn đa số controller dùng — **không kiểm tra status**.

⇒ User bị đình chỉ vẫn review/approve/publish tài liệu GMP cho tới khi session hết hạn tự nhiên.

### Bước 1 — Cổng chặn ở filter
Trong `AuthTokenFilter.doFilterInternal`, ngay sau `UserAccount user = userRepository.findById(...)` (**line 134**), **trước** `isPasswordExpired` và **trước** `isMaintenanceBlocked`:

```
NẾU user == null HOẶC user.getStatus() != UserStatus.Active:
    - KHÔNG nạp SecurityContext
    - HTTP 401 + JSON { code, message } theo trạng thái:
        Pending    → ACCOUNT_PENDING_ACTIVATION
        Suspended  → ACCOUNT_SUSPENDED
        Inactive   → ACCOUNT_INACTIVE
        Terminated → ACCOUNT_TERMINATED
    - auditTrailService.logSafely("SESSION", ..., "ACCESS_DENIED_INACTIVE_ACCOUNT", ...)
    - return
```

### Bước 2 — Helper tập trung cho chuyển trạng thái
Tạo trong `UserManagementService`:
```
changeUserStatus(UserAccount user, UserStatus newStatus, String reason):
    oldStatus = user.getStatus()
    user.setStatus(newStatus)
    NẾU oldStatus == Active VÀ newStatus != Active:
        revokeAllSessions(user.getId())
    permissionEvaluationService.evictUserPermissionCache(user.getId())
    audit(oldStatus → newStatus, reason)
```
Chuyển `suspendUser`, `terminateUser`, mọi đường set `Inactive`, và `deleteUser` sang gọi helper này.

> Helper này là **phụ thuộc bắt buộc** của T-P3-4 (last-admin guard).

### Bước 3 — Phòng thủ chiều sâu ở service
- `AuthorizationService.check` line 50-53: `status == Inactive` → **`status != Active`**, reason code `USER_NOT_ACTIVE`.
- `PermissionEvaluationService.getPermissionCodes`: trả `Set.of()` nếu `status != Active`. **Đặt kiểm tra TRƯỚC `permissionCache.computeIfAbsent`** — nếu không sẽ cache nhầm tập rỗng cho user đang Active.

### Bước 4 — Frontend
`client.ts` interceptor 401 hiện xoá token và redirect `/login`. Bổ sung hiển thị thông điệp theo reason code — tài khoản bị đình chỉ ≠ hết phiên.

### Tiêu chí chấp nhận
- User Active có session hợp lệ → bị suspend → request kế tiếp trả 401 `ACCOUNT_SUSPENDED`.
- User Pending không tạo được SecurityContext.
- `getPermissionCodes` trả rỗng cho user không Active, cache không bị nhiễm.
- Mọi transition rời Active đều revoke session + sinh audit.

### Tests
```
SuspendedUserAccessTest
PendingUserAccessTest
TerminatedUserAccessTest
InactiveUserPermissionTest
UserStatusTransitionAuditTest
```

### Rủi ro & giảm thiểu
Khoá nhầm user hợp lệ nếu dữ liệu `status` bẩn.
**Trước deploy chạy:** `SELECT status, COUNT(*) FROM app_users GROUP BY status;` — xử lý các tài khoản `Pending` tồn đọng trước.

---

## T-P0-2 — Maintenance bypass theo permission, không theo tên role

**Finding:** F-02 (HIGH)

### File
```
eqms-backend/src/main/java/com/eqms/auth/AuthTokenFilter.java
eqms-backend/src/main/resources/db/migration/V343__grant_maintenance_bypass_to_system_admin.sql
```

### Vấn đề
```java
// line 267-269 — ĐANG ĐƯỢC DÙNG THẬT tại line 148
private boolean isMaintenanceExemptRole(String role) {
    return "SUPERADMIN".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role);
}
```
Tồn tại overload 3 tham số (**line 242-257**) làm đúng — dựa trên permission `security.maintenance.bypass` + `isSuperAdmin()` — kèm javadoc nói *"display role names are intentionally ignored"*. **Overload đó không được gọi ở đâu cả.**

⇒ Đổi `role_name` từ `"ADMIN"` → `"System Administrator"` khiến admin **mất quyền vào hệ thống** khi maintenance mode bật.

### ⚠️ Thứ tự bắt buộc: Bước 1 TRƯỚC Bước 2

**Bước 1 — V343.** Xác minh permission `security.maintenance.bypass` đã được cấp cho ít nhất một Access Profile **đang hoạt động**. Nếu chưa, cấp vào permission set được quản lý của `SYSTEM_SUPER_ADMIN`.
*Bỏ qua bước này sẽ khoá toàn bộ admin khi bật maintenance mode.*

**Bước 2 — Đổi call site.** Line 148:
```java
// CŨ
if (isMaintenanceBlocked(request.getRequestURI(), claims.principal())) {
// MỚI  — biến `user` đã có sẵn trong scope từ line 134
if (isMaintenanceBlocked(request.getRequestURI(), claims.principal(), user)) {
```

**Bước 3 — Xoá dead code.** Xoá `isMaintenanceExemptRole` (267-269) và overload 2 tham số (227-235).

**Bước 4 — Khoá prefix URI bằng test.** Overload 3 tham số dùng `requestUri.startsWith("/api/auth/")`. Với `server.servlet.context-path=/api`, `request.getRequestURI()` **đã bao gồm** context path ⇒ prefix đúng. Viết test khẳng định để tránh hồi quy nếu context path đổi.

### Tests
```
MaintenanceBypassPermissionTest:
  - có security.maintenance.bypass                    → vào được
  - là SYSTEM_SUPER_ADMIN                             → vào được
  - role_name = "ADMIN" nhưng KHÔNG có permission     → BỊ CHẶN   ◄ hồi quy cần chặn
  - user thường                                        → 503
  - đổi roles.name → không kết quả nào thay đổi
MaintenanceAuthEndpointPrefixTest
```

---

## T-P0-3 — Gate cho `effective-access`

**Finding:** F-04 (HIGH)

### File
```
eqms-backend/src/main/java/com/eqms/service/AccessEffectiveService.java
```

### Vấn đề
Comment tại **line 119-121** nói *"getWorkflowRoles() already enforces the view permission gate"*, nhưng method `getEffectiveAccess` (line 117-160) **không hề gọi** `getWorkflowRoles()` — nó đi thẳng `roleDefinitionRepository.findById`. Toàn class **không có** `hasPermission` hay `requireCurrentUser`.

⇒ Bất kỳ user đăng nhập nào cũng liệt kê được ma trận quyền hiệu lực của **mọi** Access Profile, kể cả SYSTEM_SUPER_ADMIN, trên mọi cặp (action × status × document type).

### Bước 1 — Thêm gate
Đầu `getEffectiveAccess` (line 118):
```
actor = currentUserService.requireCurrentUser()
NẾU KHÔNG hasAnyPermission(actor,
        "security.access_profiles.view",
        "security.access_profiles.update",
        "security.access_profiles.assign"):
    throw new AccessDeniedException("Access profile view permission required")
```
Dùng `AccessDeniedException` (403), **không** `UnauthorizedException` (401) — lý do ghi tại `AccessProfileService.java:1083-1086`: 401 khiến interceptor FE tưởng hết phiên và đá user về `/login`.

**Bước 2.** Xoá comment sai line 119-121, thay bằng mô tả đúng.

**Bước 3 — Quét tương tự.** Kiểm tra các controller gọi thẳng service không có gate:
`EffectiveAccessDiagnosisController`, `UserAuthorizationSummaryController`, `ResourceCapabilityController`, `SecurityEligibleUsersController`.

### Tests
```
EffectiveAccessGateTest — user thường 403; có view 200; có update 200
```

---

## T-P0-4 — Phân quyền cho Dictionary master data

**Finding:** F-17 (HIGH)

### Files
```
eqms-backend/src/main/java/com/eqms/service/DictionaryManagementService.java   (37 public method)
eqms-backend/src/main/java/com/eqms/controller/SettingsDictionaryController.java (36 mapping)
eqms-backend/src/main/resources/db/migration/V344__activate_dictionary_permissions.sql
eqms/src/features/settings/  (màn hình Dictionary)
```

### Vấn đề
**Cả hai tầng đều trống** — 0 tham chiếu `hasPermission` / `require` / `@PreAuthorize`. Trong đó **21 endpoint mutate**:

| Tài nguyên | POST | PUT | DELETE |
|---|:--:|:--:|:--:|
| `/business-units` `/departments` `/positions` `/document-types` `/sub-types` `/storage-locations` `/retention-policies` | ✅ | ✅ | ✅ |

Đây là master data **điều khiển chính mô hình phân quyền**:
- **Document Type** là khoá của `workflow_action_policies.document_type_id` ⇒ sửa nó = sửa chính sách phân quyền workflow.
- **Business Unit / Department** là đầu vào của `ObjectAccessEvaluationService.evaluateProfileScope`.
- **Retention Policy** ảnh hưởng thời hạn lưu trữ hồ sơ GMP (EU GMP Ch.4).

### Bước 1 — Guard theo mẫu hình `AccessProfileService`
```java
private static final String VIEW_PERMISSION   = "settings.dictionary.view";
private static final String MANAGE_PERMISSION = "settings.dictionary.manage";

private void requireView()          { ... hasAnyPermission(VIEW, MANAGE) ... }
private UserAccount requireManage() { ... hasPermission(MANAGE) ... }
```
Áp cho toàn bộ 37 method: đọc → `requireView()`, ghi → `requireManage()`.

### Bước 2 — Audit cho mutation
Kiểm tra 21 endpoint mutate có ghi `AuditTrailService` chưa. Nếu chưa, bổ sung — master data GMP bắt buộc có vết.

### Bước 3 — V344
- Đảm bảo `settings.dictionary.view` và `settings.dictionary.manage` có `active = true`.
- Cấp vào **`QUALITY_ADMIN`** (V150) + permission set được quản lý của **`SYSTEM_SUPER_ADMIN`** (chốt A).
- **Chạy cùng deploy với Bước 1**, không tách — nếu không admin hiện tại mất quyền sửa dictionary.

### Bước 4 — Frontend
Ẩn/disable nút theo `settings.dictionary.manage`.

### Tests
```
DictionaryAuthorizationTest — 7 tài nguyên × {GET, POST, PUT, DELETE}
  không permission → 403 mọi mutate
  chỉ view         → 200 GET, 403 mutate
  có manage        → 200 tất cả
DictionaryAuditTest — mỗi mutate sinh đúng 1 AuditLog
```

---

## Definition of Done — P0

- [ ] 4 task xanh, không giảm coverage
- [ ] Toàn bộ 44 test class hiện có vẫn xanh
- [ ] Thủ công: đăng nhập → suspend từ tài khoản khác → bị đá ngay
- [ ] Thủ công: bật maintenance → admin vào được, user thường 503
- [ ] `SELECT status, COUNT(*) FROM app_users GROUP BY status` — không có tài khoản hợp lệ bị khoá nhầm
- [ ] Không file Flyway cũ nào bị sửa

---

# PHASE P1 — Authorization Consistency

**Mục tiêu:** loại bỏ mọi điểm FE và BE dùng hai logic khác nhau. **Thời lượng:** ~1.5 sprint.

---

## T-P1-1 — Capability đọc permission từ DB policy

**Finding:** F-07 (MEDIUM)

### File
```
eqms-backend/src/main/java/com/eqms/service/RevisionActionCapabilityService.java:378-400
```

### Vấn đề
```java
private String resolveRequiredPermissionCode(RevisionWorkflowAction action) {
    return switch (action) {
        case SUBMIT_FOR_REVIEW -> "documents.workspace.manage";
        case COMPLETE_REVIEW   -> "documents.revision.review";
        ...
    };
}
```
Enforcement dùng `policy.getRequiredPermissionCode()` từ DB. Admin **sửa được** `required_permission_code` tại runtime qua UI Workflow Authorization ⇒ hằng số Java sai, không gì phát hiện.

**Bằng chứng đã từng phân kỳ:** V159 seed `SUBMIT_FOR_REVIEW` = `documents.revision.submit_review`; V290 phải chạy `UPDATE` thủ công đổi thành `documents.workspace.manage` cho khớp hằng số Java.

### Thay đổi
```
resolveRequiredPermissionCode(action, revision):
    documentTypeId = revision.document?.documentType?.id
    fromStatus     = revision.status.code
    return workflowActionPolicyService
             .resolvePolicy(action, fromStatus, documentTypeId)
             .map(WorkflowActionPolicy::getRequiredPermissionCode)
             .orElse(null)
```
Chữ ký nhận thêm `revision` (hiện chỉ nhận `action`).

**Hiệu năng:** `getCapabilities` gọi 14 workflow action ⇒ 14 lần `resolvePolicy`, mà `RevisionWorkflowAuthorizationService.check()` **cũng đã** resolve policy cho từng action. **Tái sử dụng** policy đã resolve trong `evaluateWorkflowAction` — trả policy kèm decision, hoặc cache theo request.

### Test
```
CapabilityPermissionCodeMatchesPolicyTest
  — đổi required_permission_code trong DB → capability response phản ánh giá trị mới
```

---

## T-P1-2 — Sequence vào tầng authorization

**Finding:** F-06 (MEDIUM)

### Files
```
eqms-backend/src/main/java/com/eqms/service/RevisionWorkflowAuthorizationService.java:411-436
eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1715-1740
```

### Vấn đề
`RevisionService.requirePendingParticipant` (line 1722-1727) enforce sequence:
```java
if ("REVIEWER".equals(type) || "APPROVER".equals(type)) {
    nextPending = nextPendingParticipant(revision, type)
    if (nextPending != null && !equals(nextPending.getId(), participant.getId()))
        throw new IllegalStateException("... must be completed according to the configured sequence");
}
```
Nhưng `isPendingReviewer` / `isPendingApprover` chỉ kiểm tra `action_status = "PENDING"`. Capability API dùng chính hàm này ⇒ Reviewer #2 thấy nút bật, bấm vào nhận lỗi.

### Thay đổi
1. Tách logic `nextPendingParticipant` thành helper/service dùng chung để hai nơi không phân kỳ lần nữa.
2. `isPendingReviewer` / `isPendingApprover`: thêm điều kiện "là participant kế tiếp theo `sequence_order`".
3. Reason code mới `NOT_NEXT_IN_SEQUENCE`, message nêu rõ đang chờ ai.

**Cần xác minh trước khi code:** `RevisionWorkflowAuthorizationService` dùng `workflowParticipantRepository` (bảng generic `workflow_participants`), còn `sequence_order` nằm ở `revision_workflow_participants`. Kiểm tra trigger V235 có đồng bộ cột này sang bảng generic không; nếu không, bổ sung.

### Test
```
ReviewerSequenceCapabilityTest
  — reviewer #2: capability completeReview.allowed = false, reason NOT_NEXT_IN_SEQUENCE
  — sau khi #1 xong → true
```

---

## T-P1-3 — Actor `SUBMIT_FOR_REVIEW` = DCO

**Finding:** F-08 · **Quyết định:** Q1/Q11, chốt B

### File
```
eqms-backend/src/main/resources/db/migration/V345__set_submit_for_review_actor_to_document_controller.sql
```

### Bối cảnh — luồng đã tồn tại 80%
| Bước | Endpoint | Enum | Actor hiện tại |
|---|---|---|---|
| 1. Author hoàn tất soạn thảo | `POST /revisions/{id}/complete-editing` | `COMPLETE_AUTHORING` | `AUTHOR` ✅ đúng |
| 2. DCO kiểm tra & đẩy tiếp | `POST /revisions/{id}/submit-review` | `SUBMIT_FOR_REVIEW` | `PERMISSION documents.workspace.manage` ❌ quá rộng |

Precondition cứng đã có (`RevisionService.java:740-743`): `hasRevisionSignatureMeaning(revision, "PREPARED")` — bắt buộc bước 1 xong trước.

### Thay đổi — **chỉ migration dữ liệu, không sửa Java**
```sql
-- Q1: Submit for Review thuộc Document Control, không phải Author.
-- Actor là DỮ LIỆU (Access Profile code bất biến), không hard-code trong Java.
-- Doanh nghiệp đổi sang Document/QA Coordinator qua UI, không cần deploy.

DELETE FROM workflow_action_policy_actors a USING workflow_action_policies p
WHERE a.policy_id = p.id
  AND p.module_key='DOCUMENT_CONTROL' AND p.workflow_key='DOCUMENT_REVISION'
  AND p.object_type='REVISION' AND p.action_code='SUBMIT_FOR_REVIEW' AND p.active;

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), p.id, 'ACCESS_PROFILE', t.code, now()
FROM workflow_action_policies p
CROSS JOIN (VALUES ('DCO'), ('DOCUMENT_CONTROLLER')) AS t(code)
WHERE p.module_key='DOCUMENT_CONTROL' AND p.workflow_key='DOCUMENT_REVISION'
  AND p.object_type='REVISION' AND p.action_code='SUBMIT_FOR_REVIEW' AND p.active;
```
Áp dụng tương tự cho `OPEN_PUBLISHING_WORKSPACE` (Publishing Coordinator).
`required_permission_code` **giữ** `documents.workspace.manage` — permission và actor là hai tầng độc lập.

**Runtime đã hỗ trợ sẵn:** `matchesActor` → `case ACCESS_PROFILE -> matchesAccessProfile(user, actor.getActorCode())` → `userAccessProfileRepository.existsByUserIdAndProfileCode` — khớp bằng **code bất biến**, đổi display name không ảnh hưởng.

### Tests
```
SubmitForReviewActorTest
  — Author (không thuộc DCO) → ACTOR_NOT_ALLOWED
  — DCO → allow
  — đổi roles.name của DCO → kết quả KHÔNG đổi
SubmitForReviewPreconditionTest
  — submit khi chưa Complete Editing → từ chối (chữ ký PREPARED chưa có)
ActorReconfigurationTest                                   ◄ CHỨNG MINH YÊU CẦU Q11
  — đổi actor policy sang Access Profile khác
  → quyền submit chuyển theo, KHÔNG sửa code, KHÔNG deploy
DcoMetadataEditTest — DCO sửa được metadata (D-3)
```

### Kiểm tra kèm theo
- Xác minh policy `UPDATE_DRAFT_METADATA` cho phép actor DCO (D-3).
- Xác minh `cancelRevision` **bắt buộc** trường lý do / activity summary. Vì D-5 bỏ `RETURN_TO_AUTHOR`, CANCEL là đường thoát duy nhất cho lỗi nội dung ⇒ lý do là bằng chứng GMP duy nhất giải thích vì sao hồ sơ bị huỷ. Bổ sung nếu thiếu.

---

## T-P1-4 — Notification bàn giao

**Finding:** F-08 · **Quyết định:** Q1

### File
```
eqms-backend/src/main/resources/db/migration/V346__seed_revision_handover_email_templates.sql
eqms-backend/src/main/java/com/eqms/service/RevisionService.java  (completeEditing, cancelRevision)
```

### Vấn đề
`grep -n "notificationService\." RevisionService.java` trong vùng `completeEditing` → **không có kết quả**. DCO không được thông báo khi có revision chờ kiểm tra ⇒ bàn giao phải dựa vào trao đổi ngoài hệ thống, phá vỡ chuỗi kiểm soát.

### Thay đổi — người nhận **truy vấn ngược từ policy**, không hard-code
```
policy     = resolvePolicy(SUBMIT_FOR_REVIEW, "DRAFT", documentTypeId)
recipients = tất cả user thuộc các ACCESS_PROFILE trong policy.actors
```
Cách này tự động đúng khi doanh nghiệp đổi actor sang Document/QA Coordinator.

| Sự kiện | Người nhận | Nội dung |
|---|---|---|
| Author `Complete Editing` | Nhóm actor của `SUBMIT_FOR_REVIEW` | "Có revision chờ kiểm tra và submit" + link |
| DCO `CANCEL` revision | Author + Co-Author | "Revision đã bị huỷ" + **lý do** (bắt buộc) |

Mỗi loại: email template trong `email_templates` + in-app notification.

### Test
```
NotificationRoutingTest — recipient lấy từ policy actor, không hard-code
  — đổi actor policy → recipient đổi theo
```

---

## T-P1-5 — Sửa hợp đồng capability cho `preview`

**Finding:** F-24 (MEDIUM)

### Files
```
eqms-backend/src/main/java/com/eqms/service/RevisionService.java:2392-2412  (resolvePreviewType)
eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3184-3204  (previewRevisionFile)
eqms-backend/src/main/java/com/eqms/service/RevisionActionCapabilityService.java:64, 252-281, 311-326
```

### Vấn đề — hai nguồn sự thật nói ngược nhau
| | Capability API | Endpoint thật |
|---|---|---|
| Đường đi | `resolvePreviewObjectType` → DRAFT = `SOURCE_DOCX`; `hasPreviewSource` = true; `SecureFileAccessService` không chặn | `resolvePreviewType` → DRAFT = `"NONE"` |
| Kết quả | `actions.preview.allowed = true` | ném `"PDF preview is not available for this revision status"` |

FE render theo capability ⇒ hiện nút Preview ở Draft ⇒ bấm vào lỗi. Cùng nguyên nhân gốc với F-07: hai bảng ánh xạ viết độc lập rồi phân kỳ.

### Thay đổi
1. Hợp nhất `resolvePreviewType` và `resolvePreviewObjectType` thành **một** nguồn sự thật; capability và endpoint cùng gọi.
2. Ở DRAFT: capability trả `preview.allowed = false`, `reasonCode = "PREVIEW_NOT_AVAILABLE_IN_DRAFT"` — khớp quy tắc **"Draft chưa được preview"** (D-2).
3. **Không** mở preview cho Draft, **không** đổi thời điểm sinh snapshot (giữ ở `submitForReview`).

### Test
```
PreviewCapabilityParityTest
  — với MỌI trạng thái: capability.preview.allowed == true ⟺ GET /preview trả 200
  — DRAFT: allowed == false, reason PREVIEW_NOT_AVAILABLE_IN_DRAFT
```

---

## T-P1-6 — Gỡ action rỗng `GENERATE_REVIEW_SNAPSHOT`

**Finding:** F-23 (LOW)

### Files
```
enums/RevisionWorkflowAction.java:8
service/RevisionActionCapabilityService.java:75, 384
service/WorkflowActionDefaultPolicyRegistry.java:80
service/workflow/DocumentsWorkflowDefinitionProvider.java:57
service/RevisionWorkflowAuthorizationService.java:329
service/AccessEffectiveService.java:237
eqms/src/features/documents/document-revisions/shared/revisionActionCapabilities.ts:12, 54
```

### Vấn đề
Action tồn tại ở **mọi tầng trừ tầng thực thi** — không có controller endpoint, không có service method. `RevisionController` chỉ có `/{id}/regenerate-snapshot` → `regenerateSnapshot()` (action `REGENERATE_SNAPSHOT`, khác hoàn toàn).

Capability API đang quảng cáo một hành động không tồn tại.

### Thay đổi
Gỡ khỏi enum, policy registry, `validateWorkflowState`, capability response, FE type list. Với D-2 (Draft không preview, DCO không kiểm tra PDF), action này không còn lý do tồn tại.

### Test
```
GenerateSnapshotActionRemovedTest — capability KHÔNG còn key generateReviewSnapshot
```

---

## T-P1-7 — FE `hasPermission` resolve alias

**Finding:** F-14 (LOW)

### File
```
eqms/src/hooks/usePermissions.ts:28-31
```

### Vấn đề
```ts
hasPermission     = (code) => normalized.has(code.toUpperCase());        // KHÔNG alias
hasPermissionAlias= (code) => resolvePermissionAliasCodes(code).some(...);// CÓ alias
hasAnyPermission  = (codes) => codes.some(c => hasPermissionAlias(c));   // CÓ alias
```
Backend `PermissionEvaluationService.hasPermission` **luôn** resolve alias (`PERMISSION_ALIASES`, line 24-37) ⇒ FE ẩn nút oan với các code có alias.

### Thay đổi
`hasPermission` dùng `resolvePermissionAliasCodes` giống `hasPermissionAlias`. Rà call site để chắc không chỗ nào **cố ý** cần so khớp chính xác.

---

## T-P1-8 — Đưa saveWorkspace / workingNotes vào mô hình policy

### Vấn đề
4 action `saveWorkspace`, `batchSaveSubmit`, `addWorkingNote`, `deleteWorkingNote` nằm **ngoài** `workflow_action_policies` — comment tự thừa nhận tại `RevisionActionCapabilityService.java:87-91`.

### Thay đổi
1. Tạo policy DB cho 4 action này.
2. Bổ sung 4 key vào `REVISION_ACTION_CAPABILITY_KEYS` của FE (hiện thiếu).

---

## Definition of Done — P1

- [ ] Không còn hằng số permission nào trong capability service
- [ ] Sequence phản ánh đúng ở capability
- [ ] Author không submit được; DCO submit được; đổi actor không cần deploy
- [ ] Notification 2 chiều hoạt động, recipient theo policy
- [ ] `capability.preview.allowed` khớp endpoint ở mọi trạng thái
- [ ] Không còn key `generateReviewSnapshot`

---

# PHASE P2 — Role / Profile / Permission Cleanup

**Thời lượng:** 1–2 sprint.

---

## T-P2-1 — Gỡ Workflow Roles

**Finding:** F-05 (HIGH) · **Quyết định:** Q5

### Ranh giới bắt buộc

| GỠ | GIỮ NGUYÊN TUYỆT ĐỐI |
|---|---|
| `access_profile_workflow_roles` | `workflow_participants` |
| `AccessProfileWorkflowRole` entity + repository | `revision_workflow_participants` |
| `AccessProfileWorkflowTab.tsx`, `WorkflowRolesView.tsx` | `document_workflow_participants` |
| Route `/security/advanced/workflow-roles` | Participant AUTHOR, CO_AUTHOR, ASSIGNED_REVIEWER, ASSIGNED_APPROVER |
| `WorkflowActorType.{WORKFLOW_ROLE, DOCUMENT_WORKFLOW_POOL, DCO, DOCUMENT_ADMIN, TRAINING_COORDINATOR}` | `WorkflowActorType.{AUTHOR, CO_AUTHOR, OWNER, ASSIGNED_REVIEWER, ASSIGNED_APPROVER, ACCESS_PROFILE, PERMISSION}` |

### Vấn đề
Admin cấu hình Workflow Roles đầy đủ qua UI, ký điện tử, audit ghi nhận — nhưng runtime:
```java
// RevisionWorkflowAuthorizationService.java:263, 270
case DCO, DOCUMENT_ADMIN, TRAINING_COORDINATOR -> false;
case WORKFLOW_ROLE, DOCUMENT_WORKFLOW_POOL     -> false;
```
Cấu hình có bằng chứng nhưng không có hiệu lực — critical finding khi thanh tra.

### Trình tự 4 bước — không đảo thứ tự
1. **Impact analysis** — `SELECT` toàn bộ `access_profile_workflow_roles`; báo cáo profile nào gán role nào; đối chiếu còn policy nào dùng actor type sắp gỡ.
2. **V347 — bảo tồn lịch sử.** Ghi toàn bộ nội dung bảng vào `AuditLog` dạng snapshot **trước khi** xoá (Q5). Audit trail lịch sử **không** được sửa.
3. **Gỡ theo lớp, mỗi lớp một deploy** để có thể dừng: FE trước → API sau → drop bảng cuối.
4. **Actor type → deprecated.** Không xoá khỏi enum nếu còn hàng lịch sử trong `workflow_action_policy_actors`; migration phải dọn hàng đó trước.

---

## T-P2-2 — Kiểm kê và dọn permission

**Finding:** F-16 (MEDIUM)

### Bước 1 — Script kiểm kê chính thức
Xuất ma trận 4 nguồn cho từng `permissions.code`:
```
có trong permission_set_items?
có trong workflow_action_policies.required_permission_code
        hoặc workflow_action_policy_actors.actor_code?
có chuỗi tương ứng trong src/main/java?
có trong FE (route guard / usePermissions / catalog)?
```
Phân loại: `ENFORCED` / `POLICY_ONLY` / `ORPHAN` / `DUPLICATE`.

### Bước 2 — V348: hợp nhất duplicate
| Loại bỏ | Giữ lại |
|---|---|
| `security.users.view/create/update/delete/reset_password` | `settings.user.*` |
| `settings.role.view/manage/assign_permissions` | `security.access_profiles.*` |
| `settings.user.manage` | `settings.user.edit` |

Cách làm: chuyển mọi `permission_set_item` sang code giữ lại, rồi `active = false` code cũ. Gỡ khỏi `PERMISSION_ALIASES`.

### Bước 3 — V349: deactivate orphan
`ai.copilot.use`, `ai.copilot.manage`, `dashboard.admin.view`, `notifications.recipient.qa_manager` (sai tầng — nên là audience selector của notification policy).
Dùng `active = false`, **không `DELETE`** — giữ FK lịch sử.

### Bước 4 — Xử lý biến thể DCO
Hợp nhất `DCOSTAFF`, `DCOFFICER`, `DCO_TEST` về `DCO` / `DOCUMENT_CONTROLLER` (chốt B).

### Bước 5 — Kiểm tra không mất quyền
Trước/sau migration, so sánh `getEffectivePermissionCodes` cho **mọi** user. Chênh lệch phải **bằng 0** ngoài các code duplicate đã ánh xạ.

---

## T-P2-3 — Dọn catalog FE

**Finding:** F-15 (LOW)

`eqms/src/features/settings/permissionCatalog.ts` (1228 dòng) chỉ giữ **alias map**; label lấy từ API. Xoá hoặc bổ sung vào DB 7 code chỉ có ở FE:
`audit.view`, `audit.export`, `users.invite_external`, `users.resend_external_invitation`, `users.retry_external_provisioning`, `users.view_external_provisioning`, `users.disable_microsoft_access`.

---

## T-P2-4 — Tách test data

**Finding:** F-12 (MEDIUM) · **Quyết định:** Q6

1. **V350** — set `status = 'Inactive'`, gỡ khỏi `user_access_profiles`, prefix tên `[TEST]` cho: `user.a.test`…`user.h.test`, `dco.lead1`, `dco.lead2`, `workflow.dco1`, và profile `*_TEST`, `AP_UAT_*`.
2. Cấu hình Flyway location theo profile: `db/migration` (mọi env) + `db/testdata` (chỉ dev/uat). Seed test **mới** chỉ đặt ở `db/testdata`.
3. `SettingsSeedBootstrap` (line 276, 329, 374-382) chỉ chạy khi profile != prod.
4. Cleanup vĩnh viễn dữ liệu cũ đi qua Change Control, **không** làm trong sprint này.

---

## T-P2-5 — Ràng buộc bất biến `roles.code`

**V351** — trigger/constraint chặn `UPDATE roles SET code = ...`.
`AccessProfileService.updateProfile` (line 383-388) đã không cho sửa, nhưng chưa có bảo vệ ở tầng DB.

---

# PHASE P3 — Visibility, SoD, Invariants

**Thời lượng:** ~1 sprint. **Rủi ro thấp** — mô hình visibility đã đúng, chỉ cần khoá lại và dọn dead code.

---

## T-P3-1 — Khoá mô hình visibility + dọn dead code

**Findings:** F-20, F-21, F-09, F-22 · **Quyết định:** Q9, Q10, chốt C

### Bối cảnh — mô hình đã đúng (F-22)
Xác minh cho thấy Q9/Q10 **đã được implement đầy đủ, deny-by-default**, nhất quán 3 tầng:
```
canViewRevision(user, revision):
  1. canViewAllDocuments(user)               → TRUE   ← DCO/Admin
  2. [nhánh strictVisibility — xoá ở Bước 1]
  3. là Author                                → TRUE
  4. là CO_AUTHOR / REVIEWER / APPROVER       → TRUE
  5. còn lại                                  → FALSE ← DENY BY DEFAULT
```
| Tầng | Vị trí |
|---|---|
| List — Revision | `RevisionService.java:2271` |
| List — Document | `DocumentService.java:1555` |
| Detail — Revision | `DocumentAuthorizationService.java:174-207` |
| Detail — Document | `DocumentAuthorizationService.java:121-142` |
| Capability | `RevisionActionCapabilityService.java:59` |

**Không cần thay đổi mô hình.**

### Bước 1 — Xoá nhánh `strictVisibility` (F-20)
```
DocumentAuthorizationService.java:
  - field strictVisibility            (line 24-25)
  - nhánh trong canViewDocument       (line 128-131)
  - helper                            (line 171)
  - nhánh trong canViewRevision       (line 182-186)
```
**Lý do:** `@Value("${app.security.participant-visibility-strict:false}")` — không file cấu hình nào set ⇒ luôn `false` ⇒ dead code. Và nó **có bug**: nhánh `return` sớm, đặt **trước** kiểm tra Author ⇒ nếu ai bật cờ lên, Author **mất quyền xem chính bản Draft của mình**. Dead code có bug trong hệ thống validated là bom hẹn giờ.

### Bước 2 — Khoá mô hình bằng test, không bằng comment
```
DocumentVisibilityModelTest:
  DCO/Admin (có documents.document.view_all) → thấy MỌI document/revision, MỌI trạng thái
  Author của X                                → thấy X, KHÔNG thấy Y
  Co-Author / Reviewer / Approver của X       → thấy X, KHÔNG thấy Y
  Có documents.module.view, không assign      → KHÔNG thấy gì
  Permission set READ_ONLY                    → KHÔNG thấy gì

VisibilityListDetailParityTest:
  list query == detail == capability, trên mọi user × document
```
> Tầng list và tầng detail là **hai đoạn code độc lập** cùng cài một quy tắc. Test parity là bắt buộc — nếu không chúng sẽ phân kỳ đúng như F-06/F-07/F-24 đã xảy ra.

### Bước 3 — Object Access mặc định (F-09, Q2)
`ObjectAccessEvaluationService.canAccessDocument/canAccessRevision` có nhánh cuối trả `true` khi không có rule/scope.

⚠️ **KHÔNG đổi thành `false`.** Service này được gọi trong `RevisionWorkflowAuthorizationService.check()` (line 131-138); trả `false` sẽ chặn **mọi** workflow action với reason `OUT_OF_SCOPE` vì hiện không có Object Access Rule nào được cấu hình.

**Việc phải làm:** chỉ **bổ sung comment** giải thích đây là chủ đích, kèm dẫn chiếu F-09 và F-22 (mô hình visibility thật nằm ở `canViewDocument`/`canViewRevision`, không phải ở đây). F-09 là INFORMATIONAL — không đáng đánh đổi rủi ro khoá workflow.

### Bước 4 — Nhãn cho Object Access Rules (F-21, chốt C)
Dưới mô hình Q9/Q10, luồng visibility **không bao giờ chạm tới** Object Access Rules hay BU/Department Scope ⇒ nguy cơ lặp lại mô-típ F-05.

- Nhãn trên UI `ObjectAccessRulesView`, `AccessProfileObjectAccessTab`: *"Reserved for future use — không ảnh hưởng quyền truy cập hiện tại"*
- Cùng ghi chú vào audit comment khi tạo/sửa rule
- **Không xoá bảng** — giữ đường mở cho multi-site

### Bước 5 — Permission set `READ_ONLY`
Set này (V150) mô tả *"View-only access across all modules"* nhưng dưới mô hình Q9 **không cho xem tài liệu nào**. Đổi mô tả cho đúng hoặc deactivate. Gộp vào T-P2-2.

### Bước 6 — Đường đọc SOP qua Controlled Copy
Q9 = A khiến Controlled Copy gánh toàn bộ phân phối tài liệu vận hành. Đã xác minh **2 đường hoạt động**:

| Đường | Cơ chế |
|---|---|
| Link email (token) | `requireTokenPreviewAccess` — token + password, **không cần login** (`ControlledCopyAuthorizationService.java:413-425`) |
| Trong ứng dụng | `matchesRequesterOrRecipient` — khớp `recipientUserId` (line 869-878) |

⚠️ Actor type `DOCUMENT_VIEWER` (line 847) uỷ quyền cho `documentAuthorizationService.canViewDocument` — dưới mô hình Q9 hàm này trả `false` cho đúng nhóm cần xem ⇒ actor này **không dùng được**. Rà policy nào đang dùng nó và thay bằng `REQUESTER_OR_RECIPIENT`.

### Tests
```
DocumentVisibilityModelTest
VisibilityListDetailParityTest
ControlledCopyRecipientAccessTest
StrictVisibilityRemovalTest — Author luôn xem được draft của mình (hồi quy F-20)
```

---

## T-P3-2 — SoD enforce runtime

**Finding:** F-10 (MEDIUM–HIGH)

### Vấn đề — ba cơ chế rời rạc
1. `sod_constraints` + `SodConstraintService` — chỉ `scanViolations()` / `checkPermissions()`. **Không service nghiệp vụ nào** gọi để chặn action. Là công cụ báo cáo.
2. `AccessProfileService.validateProfileAssignment` (line 1165) — chặn ở thời điểm **gán profile**.
3. `DocumentWorkflowSetting.isReviewerNoApprove()` — boolean hard-code trong `RevisionService.completeApproval` (line 922-932), thực hiện đúng 1 rule SoD hoàn toàn ngoài `sod_constraints`.

⇒ Admin tạo SoD constraint, thấy nó trong scan report, nhưng **không chặn** hành động thực.

### Thay đổi
1. **V352** — migrate `reviewerNoApprove` thành một hàng `sod_constraints` chuẩn. Một nguồn sự thật.
2. Thêm bước SoD vào `RevisionWorkflowAuthorizationService.check()`, chèn **giữa bước actor (6) và allow**:
   ```
   7. sodEvaluationService.check(user, revision, action)
      → deny reason SOD_VIOLATION kèm tên constraint bị vi phạm
   ```
   Dùng chung đường dẫn ⇒ capability và mutation tự động nhất quán.
3. Bổ sung **SoD cấp record**: `sod_constraints` hiện thiên về xung đột permission. Cần hỗ trợ ràng buộc theo participant trên cùng một record (Author ≠ Approver của **cùng** revision) — đây mới là SoD mà GMP quan tâm.
4. `SegregationOfDutiesView` hiển thị rõ constraint **đang được enforce**.

---

## T-P3-3 — Last-active-administrator guard

**Finding:** F-11 (MEDIUM) · **Phụ thuộc:** helper `changeUserStatus` từ T-P0-1

```
NẾU thao tác làm user rời khỏi SYSTEM_SUPER_ADMIN
    (suspend / terminate / deactivate / unassign)
  VÀ số user Active còn giữ SYSTEM_SUPER_ADMIN sau thao tác == 0
THÌ chặn: "Cannot remove the last active system administrator"
```
Áp cho `changeUserStatus` và `AccessProfileService.removeUser`.
Tương tự cho permission set cuối cùng cấp `security.access_profiles.update`.

**Đã có sẵn, giữ nguyên:** không xoá profile đang gán user (line 172-185); không deactivate SYSTEM profile (379-381) và SYSTEM_SUPER_ADMIN (500); `preventSelfGrantOfCriticalPermissionSets` (6 call site); không unassign khỏi SYSTEM_SUPER_ADMIN (1041).

---

## T-P3-4 — Permission cache TTL

**Finding:** F-13 (MEDIUM) · **Quyết định:** Q8

`PermissionEvaluationService.java:40` — `ConcurrentHashMap` không TTL, không giới hạn, eviction thủ công qua 22 call site.

1. Chuyển sang **Caffeine** qua `CacheConfig.java` (đã tồn tại): `expireAfterWrite(60s)` + `maximumSize`.
2. **Giữ nguyên** toàn bộ 22 call site eviction — TTL là lưới an toàn, không phải thay thế.
3. Trừu tượng hoá sau interface để sau này thay Redis không đụng call site.
4. Ghi rõ trong tài liệu validation: **cửa sổ tối đa quyền cũ còn hiệu lực = TTL**.

---

# PHASE P4 — Training Management

**Quyết định:** Q4 · **Thời lượng:** 4–6 sprint · **Nguyên tắc tuyệt đối: KHÔNG xây Authorization Engine thứ hai.**

### Bối cảnh
Module Training hiện **chỉ tồn tại ở frontend**. Không có `TrainingController`, không entity, không repository. `eqms/src/services/api/training.ts` gọi `/api/training/*` — các endpoint **không tồn tại**. `useTrainingPermissions.ts` map **12 business action** về **một** permission `training.material.manage`.

### Sprint 4.1 — Domain model
`training_courses`, `training_materials`, `training_assignments`, `training_sessions`, `training_records`, `training_evidence`.
Mọi bảng: audit fields + soft delete + status trong bảng lookup (không enum cứng).

### Sprint 4.2 — Đăng ký vào engine hiện có

| Thành phần dùng lại | Cách dùng |
|---|---|
| `WorkflowRegistryService` | Đăng ký `workflow_key = 'TRAINING_ASSIGNMENT'`, `object_type = 'TRAINING_ASSIGNMENT'` |
| `workflow_action_policies` | Policy cho từng action × status — `resolvePolicy(moduleKey, workflowKey, objectType, ...)` **đã generic sẵn** |
| `workflow_participants` | `participant_type ∈ {TRAINER, TRAINEE, COORDINATOR}` — **không** tạo bảng participant riêng |
| `ObjectAccessEvaluationService` | Mở rộng cho object type mới |
| `sod_constraints` | Trainer ≠ Trainee cùng session |
| `ElectronicSignatureService` | E-sign cho Complete / Verify |
| `AuditTrailService` | Toàn bộ mutation |
| `ResourceCapabilityService` | Thêm `case "TRAINING_ASSIGNMENT"` |

### Sprint 4.3 — Permission catalog đúng hạt
Thay 1 permission cho 12 action bằng:
```
training.course.view / create / edit / publish / archive
training.material.view / upload / delete
training.assignment.view / create / assign_trainee / assign_trainer / reassign / cancel
training.session.create / record_attendance
training.record.complete / verify / waive
training.report.export
training.audit.view
```
Kích hoạt `training.assignment.manage`, `training.session.manage` (hiện orphan) hoặc thay bằng catalog trên.

### Sprint 4.4 — Controller + Capability API
`TrainingController` mỏng, gate ở service layer (đúng mẫu hình codebase). Capability API cho mọi action.

### Sprint 4.5 — Frontend
Xoá toàn bộ authorization FE-only trong `useTrainingPermissions.ts`; chuyển sang capability-driven như `RevisionReviewView`.

### Sprint 4.6 — Document-related Training
Nối `documents.training.complete` (đã có) với module Training: revision ở `PENDING_TRAINING` sinh training assignment thật, có trainee, có bằng chứng, có audit.

### ⚠️ Ràng buộc bắt buộc từ Q9
Trainee **không phải** AUTHOR/CO_AUTHOR/REVIEWER/APPROVER ⇒ dưới mô hình visibility đã chốt, **trainee không đọc được tài liệu mình phải học**.
Phải thiết kế đường đọc riêng — **một trong hai**:
- coi `TRAINEE` là participant type được cấp quyền xem tài liệu liên quan, **hoặc**
- phát Controlled Copy tự động cho trainee.

**Không được để trainee không có cách đọc tài liệu được đào tạo.**

### Ngoài phạm vi (giai đoạn sau)
Qualification Matrix, Competency Management.

---

# PHASE P5 — Legacy Cleanup & Validation

- Gỡ `PERMISSION_ALIASES` (`PermissionEvaluationService.java:24-37`) sau khi T-P2-2 xong
- Cập nhật `CLAUDE.md` (F-18): `SecurityConfig` là `.anyRequest().authenticated()` **không phải** `permitAll`; migration cao nhất **V342** không phải V119
- Sửa javadoc sai:
  - `RevisionWorkflowAuthorizationService.java:30-38` — nói có SYSTEM_SUPER_ADMIN bypass, code **không** bypass
  - `AuthTokenFilter.java:237-241` — nói maintenance exemption là permission-based, thực tế dùng role name (sẽ đúng sau T-P0-2)
  - `AccessEffectiveService.java:119-121` — nói có gate, thực tế không (sẽ đúng sau T-P0-3)
- (Tuỳ chọn) chuyển `validateWorkflowState` (`RevisionWorkflowAuthorizationService.java:283-378`) sang `lifecycle_state_policies` để state matrix cấu hình được
- Hồ sơ CSV: URS/FS/DS cho authorization model, IQ/OQ/PQ, traceability matrix requirement ↔ test

---

# 4. Thứ tự và phụ thuộc

```
P0 ──► P1 ──► P2 ──┬──► P3 ──► P5
                   └──► P4 (song song được sau P2)
```

| Phase | Thời lượng | Rủi ro hồi quy |
|---|---|---|
| P0 | ~5 ngày | Thấp |
| P1 | ~1.5 sprint | Thấp |
| P2 | 1–2 sprint | Trung bình |
| P3 | ~1 sprint | Thấp |
| P4 | 4–6 sprint | Thấp (module mới) |
| P5 | ~1 sprint | Thấp |

### Phụ thuộc bắt buộc
- **T-P3-3** (last-admin) cần helper `changeUserStatus` từ **T-P0-1**
- **T-P1-4** (notification) cần actor policy từ **T-P1-3**
- **T-P2-2** (dọn permission) phải xong trước **P5** (gỡ alias)
- **T-P0-2 Bước 1** (V343) phải xong trước **Bước 2** — nếu không lockout admin
- **T-P0-4 Bước 3** (V344) phải deploy **cùng** Bước 1 — nếu không admin mất quyền dictionary
- **T-P3-1 Bước 6** (Controlled Copy) là tiền đề cho **P4** (đường đọc tài liệu của trainee)

---

# 5. Test Strategy tổng hợp

### Unit
- `EffectivePermissionServiceTest` — mở rộng: profile inactive, permission set inactive, không có profile, nhiều profile chồng lấn
- `PermissionEvaluationServiceTest` — **thiếu hiện tại**: alias resolution, cache eviction, SYSTEM_SUPER_ADMIN không wildcard
- `RevisionWorkflowAuthorizationServiceTest` — bổ sung sequence, SoD, mọi `WorkflowActorType`

### API authorization
Ma trận endpoint × permission: mỗi endpoint mutate có test "không permission → 403".
Ưu tiên: `SettingsDictionaryController` (36), `ControlledCopyController` (38), `PublishingTemplateController` (17), `AccessReviewController` (10).

### Workflow state
Mỗi `RevisionWorkflowAction` × mỗi status: chỉ status trong `validateWorkflowState` cho phép.
Xoá/deactivate policy → `POLICY_NOT_CONFIGURED` (fail-closed).

### Assignment
- Reviewer của revision X **không** review được revision Y
- Reviewer #2 không hành động trước #1 — **cả mutation lẫn capability**
- Participant đã `COMPLETED` không hành động lại

### Role rename — **thiếu hoàn toàn hiện tại**
- Đổi `roles.name` → permission không đổi, workflow actor vẫn match, managed set không orphan
- `roles.code` không sửa được qua API

### Privilege escalation
- Self-grant critical permission → chặn (mở rộng `AccessProfileServiceSecurityTest` cho mọi đường dẫn)
- Có `security.access_profiles.assign` nhưng không có `.update` → không sửa được permission set
- Gọi thẳng API bỏ qua FE với JWT quyền thấp

### Session / user lifecycle — **thiếu hoàn toàn, ưu tiên cao nhất**
- Suspend user đang có session → request kế tiếp 401
- Terminate → 401 ngay
- Maintenance: có `security.maintenance.bypass` vào được; `role_name = "ADMIN"` không có permission **không** vào được

### Last-admin — **thiếu hoàn toàn**
- Suspend/terminate SYSTEM_SUPER_ADMIN cuối cùng → chặn
- Xoá permission set cuối cùng cấp `security.access_profiles.update` → chặn

### Direct API bypass
- Mỗi action FE ẩn nút → gọi thẳng endpoint phải 403
- Endpoint public (`/controlled-copies/*/preview|download`) chỉ chấp nhận token/password hợp lệ

### Frontend capability
- `allowed = false` → nút disabled/ẩn cho **mọi** key trong `REVISION_ACTION_CAPABILITY_KEYS`
- Parity contract: FE type list khớp key BE trả về (hiện thiếu `saveWorkspace`, `batchSaveSubmit`, `addWorkingNote`, `deleteWorkingNote`)

### Cross-module
- Có `documents.revision.review` nhưng không có `training.module.view` → không vào Training
- Đổi permission set → mọi module thấy thay đổi ngay (cache eviction)

### Audit
- Mỗi mutation security sinh đúng 1 `AuditLog` + `AuditLogChange` với actor, timestamp, target, old, new, reason
- Mọi deny workflow sinh `WORKFLOW_ACCESS_DENIED` (đã có ở `logDeniedAudit`)
- **Thiếu:** audit cho unauthorized attempt ở tầng permission — `AuthorizationService.require` ném exception nhưng **không** ghi audit; chỉ workflow layer mới ghi

---

# 6. Điểm cần xác minh khi bắt tay code

Các mục dưới đây **chưa được đọc hết** ở vòng phân tích; xác minh trước khi sửa phần liên quan:

| Mục | Thuộc task |
|---|---|
| `sequence_order` có được trigger V235 đồng bộ sang `workflow_participants` không | T-P1-2 |
| `cancelRevision` có bắt buộc trường lý do / activity summary không | T-P1-3 |
| Policy `UPDATE_DRAFT_METADATA` có cho phép actor DCO không (D-3) | T-P1-3 |
| 21 endpoint mutate Dictionary có ghi audit chưa | T-P0-4 |
| `ControlledCopyAuthorizationService` (1086 dòng) — mới xác minh mức kiến trúc | T-P3-1 |
| `WorkflowActionPolicyService` dòng 200-929 (preview/diff/validation) | T-P2-2 |
| Policy nào đang dùng actor `DOCUMENT_VIEWER` | T-P3-1 |
