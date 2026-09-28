> ⚠️ **File này là HỒ SƠ BẰNG CHỨNG, không phải tài liệu để code.**
> Kế hoạch thi hành đã được tách ra: **[SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md](SECURITY_AUTHORIZATION_IMPLEMENTATION_PLAN.md)** — build-ready, mọi quyết định đã chốt.
> Giữ file này để tra cứu: bằng chứng từng finding, các nhánh đã cân nhắc rồi huỷ, và lý do huỷ (cần cho hồ sơ CSV/thanh tra).

# SECURITY & AUTHORIZATION — BÁO CÁO PHÂN TÍCH & KẾ HOẠCH TRIỂN KHAI

**Phạm vi:** `eqms/` (frontend), `eqms-backend/` (Spring Boot), 342 Flyway migrations, 44 test classes.
**Nguyên tắc:** không sửa code cho tới khi kế hoạch được phê duyệt. Mọi kết luận đều dẫn file/method/table.

| Vòng | Nội dung | Trạng thái |
|---|---|---|
| **Vòng 1** | Quét toàn bộ FE/BE/API/DB, lập findings, hard-code inventory, ma trận FE-BE, rename safety, roadmap khung | ✅ Hoàn thành |
| **Vòng 2** | Đóng 3 điểm treo (F-04, F-08, F-17), tiếp nhận 8 quyết định nghiệp vụ, lập kế hoạch triển khai chi tiết | ✅ Hoàn thành |
| **Vòng 2b** | Chốt mô hình visibility (Q9, Q10) — **huỷ Q3**, hạ F-09, rút F-19, thu gọn P3 | ✅ Hoàn thành |
| **Vòng 2c** | Chốt tách Complete Editing / Submit for Review (Q11, D-1, D-2, D-5) — **không** thêm status mới, **không** `RETURN_TO_AUTHOR`, **không** mở preview cho Draft. Chỉ đổi actor sang DCO + notification. Thiết kế ở **Mục Q**. Phát hiện mới: **F-23**, **F-24** | ✅ Hoàn thành — tài liệu này |
| **Vòng 3** | Triển khai P0 | ⏸️ Chờ phê duyệt |

> **Lưu ý về tài liệu nền:** thư mục `security-discovery-report/` và `security-retrofit/` (29 sprint report) mô tả các đợt retrofit trước. Báo cáo này **không** dựa vào chúng — mọi phát hiện dưới đây được xác minh lại trực tiếp từ code hiện tại.

## Thay đổi ở vòng 2 (so với bản vòng 1)

| Finding | Vòng 1 | Vòng 2 | Lý do |
|---|---|---|---|
| **F-04** `effective-access` không gate | MEDIUM, *"chưa xác minh đầy đủ"* | **HIGH — xác nhận** | Comment trong code nói có gate, nhưng method **không hề gọi** hàm gate đó |
| **F-17** Dictionary controller | MEDIUM, *"chưa xác minh"* | **HIGH — xác nhận** | 21 endpoint mutate master data GMP, 0 check ở **cả** controller lẫn service |
| **F-08** Submit for Review | MED-HIGH, nghi thiếu bước bàn giao | **MEDIUM — thu hẹp phạm vi** | Luồng Author→DCO **đã tồn tại ~85%**; chỉ actor quá rộng + thiếu notification |
| **F-19** `view_all` vượt scope | (nằm trong F-09) | ~~Tách riêng, HIGH~~ → **RÚT LẠI ở vòng 2b** | Quyết định **Q10** xác nhận DCO/Admin **được phép** xem tất cả ⇒ hành vi hiện tại là đúng chủ đích, không phải lỗi |

## Thay đổi ở vòng 2b — mô hình visibility

Sau khi chốt Q9/Q10, ba mục sau thay đổi. **Đây là các đính chính đối với chính đánh giá của tôi ở vòng 1**, không phải thay đổi code.

| Mục | Vòng 1 | Vòng 2b | Lý do |
|---|---|---|---|
| **F-09** Object Access fail-open | MEDIUM — *"user thấy toàn bộ tài liệu"* | **LOW / INFORMATIONAL** | **Đánh giá vòng 1 sai.** Nhánh fail-open nằm ở `ObjectAccessEvaluationService` — **không phải** đường dẫn quyết định việc xem tài liệu. Việc xem đi qua `canViewDocument`/`canViewRevision`, vốn **đã deny-by-default**. |
| **F-19** `view_all` vượt scope | HIGH | **RÚT LẠI** | Q10: hành vi đúng chủ đích. Không tạo `view_all_global`, không migration rủi ro cao. |
| **P3-1 + P3-2** | 1–2 sprint, rủi ro hồi quy CAO | **~1 ngày, rủi ro thấp** | Mô hình mong muốn **đã được implement sẵn**; chỉ còn dọn nhánh chết và khoá cấu hình. |

**Phát hiện mới của vòng 2b:** **F-20** (nhánh `strictVisibility` vừa chết vừa có bug) và **F-21** (Object Access Rules trở thành cấu hình chết như F-05).

---

## A. Executive Summary

### Đánh giá tổng thể

Nền tảng authorization của Document Control **đã đạt mức trưởng thành cao và đúng hướng kiến trúc mục tiêu**. Đây không phải hệ thống `if (role == "DCO")` — nó thực sự là:

```
Access Profile (code) → Permission Set → Permission → workflow_action_policies (DB) → Actor → Capability API
```

Cụ thể, các điểm **đã làm đúng** (khác biệt rõ rệt so với đa số eQMS ở giai đoạn này):

- `app_users.role_name` **không còn là nguồn entitlement** — `EffectivePermissionService` chỉ resolve qua Access Profile ([EffectivePermissionService.java:88-114](eqms-backend/src/main/java/com/eqms/service/EffectivePermissionService.java#L88-L114)).
- Workflow authorization **được cấu hình trong DB**, không hard-code: `workflow_action_policies` + `workflow_action_policy_actors`, fail-closed khi thiếu policy ([RevisionWorkflowAuthorizationService.java:152-157](eqms-backend/src/main/java/com/eqms/service/RevisionWorkflowAuthorizationService.java#L152-L157)).
- SYSTEM_SUPER_ADMIN **không có wildcard bypass** cho nghiệp vụ GxP ([PermissionEvaluationService.java:72-94](eqms-backend/src/main/java/com/eqms/service/PermissionEvaluationService.java#L72-L94)).
- Frontend **không tự tính quyền workflow** — render theo Capability API ([revisionActionCapabilities.ts](eqms/src/features/documents/document-revisions/shared/revisionActionCapabilities.ts)), không có `user.role === ...` ở bất kỳ đâu.
- Đổi **display name** Role/Access Profile **an toàn** — identity là `roles.code`, và `updateProfile` không cho sửa `code`.

### Mức độ rủi ro

| Miền | Trạng thái | Rủi ro | Findings |
|---|---|---|---|
| Document Control — Revision workflow | Trưởng thành, policy-driven | **Thấp–Trung bình** | F-06, F-07, F-08 |
| Document Control — Controlled Copy | Trưởng thành (`ControlledCopyAuthorizationService`, 1086 dòng) | **Thấp–Trung bình** | — |
| Security Administration (Profile/Permission Set/SoD/Object Rules) | Enforcement ở service layer + e-signature, **nhưng có 1 endpoint hở** | **Trung bình–Cao** | F-04, F-05, F-11 |
| **Session / User lifecycle** | **Lỗ hổng khai thác được** — Pending/Suspended/Inactive vẫn dùng hệ thống bình thường | **CRITICAL** | F-01, F-02 |
| **Master data (Dictionary)** | **Không có phân quyền ở bất kỳ tầng nào** — 21 endpoint mutate mở cho mọi user đăng nhập | **CRITICAL** | F-17 |
| **Training Management** | **Chỉ tồn tại ở frontend. Không có backend.** | **CRITICAL (đối với GMP)** | F-03 |
| Visibility model (ai xem được tài liệu nào) | **Đã đúng và deny-by-default** trên cả 3 tầng | **Thấp** | F-22 ✅ |
| Object Access Rules / BU-Dept Scope | Có engine, nhưng **không còn tác dụng** dưới mô hình đã chốt | **Trung bình** (cấu hình chết) | F-09↓, F-20, F-21 |
| SoD | Chỉ advisory (scan), không enforce runtime | **Trung bình–Cao** | F-10 |
| Permission catalog | Có orphan, duplicate, và 2 catalog FE song song | **Trung bình** | F-15, F-16 |

**4 lỗ hổng có thể khai thác ngay (P0):** F-01, F-02, F-04, F-17.
Trong đó **F-17 là phát hiện nghiêm trọng nhất của vòng 2** — Document Type là khoá của `workflow_action_policies.document_type_id`, còn Business Unit/Department là đầu vào của scope evaluation. Sửa được master data nghĩa là **sửa được chính mô hình phân quyền**, mà hiện tại việc đó không cần quyền gì ngoài đăng nhập.

### Kết luận: tiếp tục phát triển hay refactor nền tảng?

**Tiếp tục phát triển — KHÔNG cần refactor nền tảng.** Kiến trúc lõi đúng. Việc cần làm là:
1. Vá 4 lỗ hổng an ninh cụ thể (P0);
2. Xoá bỏ các mảnh cấu hình "chết" (workflow roles, orphan permissions, seed test data);
3. Xây backend cho Training Management — đây là công việc **xây mới**, không phải refactor;
4. Nâng SoD và Object Access từ "khai báo được" lên "enforce được".

---

## B. Current Architecture (phản ánh code thực tế, không phải mong muốn)

```
                        HTTP Request
                             │
                    ┌────────▼────────┐
                    │ SecurityConfig  │  .anyRequest().authenticated()
                    │                 │  permitAll: /auth/**, /branding, /localization,
                    │                 │             /health, /controlled-copies/*/preview|download
                    └────────┬────────┘
                             │
                    ┌────────▼──────────────────────────────────┐
                    │ AuthTokenFilter                            │
                    │  • parse JWT (Bearer hoặc cookie accessToken)│
                    │  • AuthSession: revoked / expired / LOCKED  │
                    │  • idle timeout → LOCKED                    │
                    │  • password expired → 401                   │
                    │  • maintenance mode → role name "SUPERADMIN"│ ◄── HARD-CODE (F-02)
                    │  • ✗ KHÔNG kiểm tra UserStatus              │ ◄── LỖ HỔNG (F-01)
                    │  • nạp permissions vào AuthenticatedUser    │
                    └────────┬───────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Controller     │  ✗ hầu hết KHÔNG check quyền (by design)
                    └────────┬────────┘
                             │
     ┌───────────────────────┼────────────────────────────┐
     │                       │                            │
┌────▼─────────────┐  ┌──────▼──────────────────┐  ┌──────▼────────────────┐
│ AuthorizationSvc │  │ RevisionWorkflowAuthzSvc│  │ AccessProfileService  │
│ (permission-only)│  │ (workflow, policy-driven)│  │ (require{View,Manage, │
│ + PermissionEval │  │                          │  │  Assign} + e-sign)    │
└──────────────────┘  └──────┬──────────────────┘  └───────────────────────┘
                             │
        ┌────────────────────┼────────────────────────────────────┐
        │ 1. user null / Inactive?                                │
        │ 2. validateWorkflowState()  ← HARD-CODE, không bypass    │
        │ 3. ObjectAccessEvaluationService.canAccessRevision()     │
        │ 4. resolvePolicy(action, fromStatus, documentTypeId)     │
        │      → workflow_action_policies (DB)                     │
        │      → không có policy = DENY (fail-closed)              │
        │ 5. hasPermission(policy.requiredPermissionCode)          │
        │ 6. matchesActor(policy.actors)                           │
        │      AUTHOR / CO_AUTHOR / OWNER                          │
        │      ASSIGNED_REVIEWER / ASSIGNED_APPROVER (PENDING)     │
        │      ACCESS_PROFILE (theo code) / PERMISSION             │
        │      DCO, WORKFLOW_ROLE, DOCUMENT_WORKFLOW_POOL → false  │
        │ 7. deny → AuditTrail "WORKFLOW_ACCESS_DENIED"            │
        └─────────────────────────────────────────────────────────┘
                             │
                     ┌───────▼────────┐
                     │ RevisionService│  + requireValidSignatureToken()
                     │                │  + requirePendingParticipant() ← SEQUENCE ở đây
                     └────────────────┘
```

**Chuỗi thực tế so với kiến trúc mục tiêu (mục 6 của đề bài):**

| Tầng mục tiêu | Hiện trạng |
|---|---|
| User → Access Profile | ✅ `user_access_profiles` |
| Access Profile → Permission Set | ✅ `access_profile_permission_sets` |
| Permission Set → Permission | ✅ `permission_set_items` |
| Object Access / Data Scope | ⚠️ Có engine, **mặc định fail-open** |
| Workflow Assignment | ✅ `workflow_participants` + `revision_workflow_participants` |
| Workflow State | ✅ Nhưng hard-code trong Java, không cấu hình được |
| Business Preconditions | ⚠️ Rải rác trong `RevisionService`, **không có trong Capability API** |
| SoD | ❌ Chỉ advisory scan + 1 rule hard-code riêng (`reviewerNoApprove`) |
| E-Signature | ✅ `requireValidSignatureToken` + `SecurityChangeSignatureService` |
| Backend Capability Decision | ✅ `/resource-capabilities`, `/revisions/{id}/action-capabilities` |
| Frontend renders actions | ✅ |

---

## C. Current Data Model

### Lõi entitlement

| Bảng | Identity | Ghi chú |
|---|---|---|
| `app_users` | `id` | `role_name` (String) — **display/audit metadata**, không phải entitlement |
| `roles` (= Access Profile) | `id` + `code` UNIQUE | `name` = display. `type` SYSTEM/CUSTOM, `is_system`, `active`, `business_unit_scope`, `department_scope` |
| `user_access_profiles` | PK(user_id, access_profile_id) | V153 |
| `permission_sets` | `id` + `code` UNIQUE | `active`, `system` |
| `permission_set_items` | PK(set_id, permission_id) | V150 |
| `access_profile_permission_sets` | PK(profile_id, set_id) | V153 |
| `permissions` | `code` | `module_key`, `resource`, `action`, `risk_level`, `requires_esign`, `active` |

### Workflow

| Bảng | Ghi chú |
|---|---|
| `workflow_action_policies` | `module_key`,`workflow_key`,`object_type`,`action_code`,`from_status`,`document_type_id`(nullable = global),`required_permission_code`,`priority`,`active`,`system` — V158 |
| `workflow_action_policy_actors` | `actor_type` (enum `WorkflowActorType`), `actor_code` |
| `workflow_participants` | Generic `(object_type, object_id, participant_type, user_id, action_status)` — V173, đồng bộ từ bảng revision-specific bằng trigger V235 |
| `revision_workflow_participants` | Write model, có `sequence_order` |
| `document_workflow_participants` | Pool ở cấp Document Master |

### Cấu hình bổ trợ

| Bảng | Có runtime effect? |
|---|---|
| `object_access_rules` + `access_profile_object_rules` | ✅ `ObjectAccessEvaluationService` |
| `sod_constraints` | ⚠️ Chỉ scan/advisory |
| **`access_profile_workflow_roles`** | ❌ **KHÔNG — dead configuration (F-05)** |
| `audit_logs` + `audit_log_changes` | ✅ |

---

## D. Current Authorization Flow (trace end-to-end: **Complete Review**)

```
FE  RevisionReviewView.tsx
      └─ useRevisionActionCapabilities(revisionId)
           └─ GET /api/revisions/{id}/action-capabilities
                └─ RevisionActionCapabilityService.getCapabilities()
                     ├─ currentUserService.requireCurrentUser()
                     ├─ documentAuthorizationService.requireCanViewRevision()
                     └─ actions["completeReview"] =
                          revisionWorkflowAuthorizationService.check(COMPLETE_REVIEW)
      └─ render nút "Complete Review" nếu actions.completeReview.allowed === true

FE  POST /api/revisions/{id}/review/complete  { signatureToken, comment }

BE  SecurityConfig            → anyRequest().authenticated()
    AuthTokenFilter           → JWT + session + idle + password expiry
                                (✗ KHÔNG check UserStatus)
    RevisionController.completeReview
    RevisionService.completeReview()
      1. currentUserService.requireCurrentUser()
      2. revisionWorkflowAuthorizationService.require(user, revision, COMPLETE_REVIEW, ctx)
           a. user != null, status != Inactive
           b. validateWorkflowState → phải là PENDING_REVIEW
           c. objectAccessEvaluationService.canAccessRevision(user, revision, "VIEW")
           d. resolvePolicy(COMPLETE_REVIEW, "PENDING_REVIEW", documentTypeId)
           e. hasPermission("documents.revision.review")
           f. matchesActor → ASSIGNED_REVIEWER → workflow_participants có
              (DOCUMENT_REVISION, revId, REVIEWER, userId) với action_status = PENDING
           ✗ deny → AuditTrail WORKFLOW_ACCESS_DENIED + 403
      3. requireRevisionStatus(revision, "PENDING_REVIEW")   (kiểm tra lần 2)
      4. requireValidSignatureToken(request, user, "review") ← E-SIGNATURE
      5. requirePendingParticipant(revision, "REVIEWER", user)
           ✗ nếu không phải reviewer kế tiếp theo sequence_order → IllegalStateException
             ◄── BƯỚC NÀY KHÔNG CÓ TRONG CAPABILITY API (F-06)
      6. markParticipantAction + recordElectronicSignature + updateRevisionStatus
      7. AuditTrailService.logAs(...)
```

**Đánh giá:** đây là một chuỗi kiểm soát đầy đủ và đúng chuẩn GMP. Điểm đứt gãy duy nhất là bước 5 không được phản ánh vào capability (F-06).

---

## E. Findings

### F-01 — User bị Suspended vẫn giữ nguyên toàn bộ quyền truy cập

```
ID:        F-01
Severity:  CRITICAL
Category:  Authentication / User lifecycle
Location:  eqms-backend/src/main/java/com/eqms/service/UserManagementService.java:329-356
           eqms-backend/src/main/java/com/eqms/auth/AuthTokenFilter.java:82-168
           eqms-backend/src/main/java/com/eqms/service/AuthorizationService.java:50-53
           eqms-backend/src/main/java/com/eqms/entity/UserStatus.java
```

**Current behavior:**
`UserStatus` có 5 giá trị: `Active, Inactive, Pending, Suspended, Terminated`.

- `terminateUser()` gọi `revokeAllSessions(user.getId())` (line 366).
- `suspendUser()` **không** gọi `revokeAllSessions` — chỉ set status + audit.
- `AuthTokenFilter` **không hề đọc `user.getStatus()`** ở bất kỳ điểm nào trong `doFilterInternal`.
- `AuthorizationService.check()` chỉ chặn `UserStatus.Inactive` — không chặn `Suspended`, `Terminated`, `Pending`.
- `PermissionEvaluationService.hasPermission()` — đường dẫn được **đa số** controller/service dùng — **không kiểm tra status gì cả**.

**Risk:** Một user bị đình chỉ (ví dụ đang bị điều tra deviation, hoặc bị thu hồi qualification) tiếp tục review, approve, publish tài liệu GMP cho tới khi access token/session hết hạn tự nhiên. Vi phạm trực tiếp EU GMP Annex 11 §12.1 và 21 CFR Part 11 §11.10(d) (giới hạn truy cập hệ thống cho người được uỷ quyền).

**Evidence:** `grep -n "getStatus" AuthTokenFilter.java` → không có kết quả nào liên quan `UserAccount.status`. `suspendUser` (line 329-356) không có `revokeAllSessions`.

**Recommended correction:**
1. Thêm kiểm tra status vào `AuthTokenFilter` ngay sau `userRepository.findById` (line 134): chỉ `Active` mới được nạp `SecurityContext`; các trạng thái khác trả 401 với reason code riêng.
2. Gọi `revokeAllSessions` trong `suspendUser`.
3. Nâng `AuthorizationService` và `PermissionEvaluationService.getPermissionCodes` thành: status != Active ⇒ `Set.of()`.

---

### F-02 — Maintenance-mode bypass dựa trên **tên role** (hard-code), nhánh permission-based là dead code

```
ID:        F-02
Severity:  HIGH
Category:  Hard-coded role / Role rename safety
Location:  eqms-backend/src/main/java/com/eqms/auth/AuthTokenFilter.java:148, 227-235, 242-257, 267-269
```

**Current behavior:**
```java
// line 267-269
private boolean isMaintenanceExemptRole(String role) {
    return "SUPERADMIN".equalsIgnoreCase(role) || "ADMIN".equalsIgnoreCase(role);
}
```
`isMaintenanceBlocked(requestUri, principal)` (2 tham số, line 227) gọi hàm trên và **được dùng thật** tại line 148.

Tồn tại một overload 3 tham số (line 242-257) làm đúng — dựa trên permission `security.maintenance.bypass` + `isSuperAdmin()` — kèm javadoc *"Maintenance exemption is permission-based; display role names are intentionally ignored"*. **Overload này không được gọi ở đâu cả.** Javadoc mô tả hành vi trái ngược với hành vi thực thi.

**Risk:**
- Đổi `app_users.role_name` từ `"ADMIN"` → `"System Administrator"` ⇒ admin **mất** quyền vào hệ thống khi maintenance mode bật (lockout).
- Ngược lại, bất kỳ user nào có `role_name = "ADMIN"` (một cột String tự do, không FK) đều bypass maintenance mode bất kể Access Profile thực tế.
- Permission `security.maintenance.bypass` được seed và hiển thị trong UI nhưng **không có hiệu lực**.

**Recommended correction:** đổi line 148 sang overload 3 tham số; xoá `isMaintenanceExemptRole` và overload 2 tham số.

---

### F-03 — Training Management: module GMP không có backend, authorization chỉ tồn tại ở frontend

```
ID:        F-03
Severity:  CRITICAL (đối với GMP compliance) / HIGH (an ninh kỹ thuật)
Category:  Frontend-only authorization / Missing enforcement
Location:  eqms/src/services/api/training.ts (322 dòng)
           eqms/src/features/training/useTrainingPermissions.ts
           eqms/src/app/routes/TrainingRoutes.tsx
           eqms-backend/src/main/java/com/eqms/service/TrainingAuthorizationService.java (80 dòng)
```

**Current behavior:**
- Frontend có module Training đầy đủ: `course-inventory`, `materials`, `my-training`, `compliance-tracking`, `records-archive`.
- `services/api/training.ts` gọi `/api/training/courses`, `/api/training/assignments`, `/api/training/materials`, `/api/training/sessions`…
- **Backend không có `TrainingController`, không có entity Training, không có repository Training.** (`grep -rln "training" controller/` chỉ trả về `RevisionController` — tức là training gắn với revision workflow, không phải module Training.)
- `TrainingAuthorizationService` (80 dòng) chỉ phục vụ bước `COMPLETE_TRAINING` của **revision workflow**, không phải module Training.
- `useTrainingPermissions.ts` map **12 business action khác nhau** (create/edit/submit/review/approve/obsolete cho cả Materials và Courses) về **cùng một permission** `training.material.manage`.
- Permission `training.assignment.manage`, `training.session.manage` được seed trong DB nhưng không được tham chiếu ở bất kỳ đâu trong Java.

**Risk:**
- Không thể lập ma trận authorization cho Training như yêu cầu ở mục 13 của đề bài — vì **không có logic nào để đánh giá**.
- Không có khái niệm Trainer assignment / Trainee assignment / Training coordinator / department scope / due-overdue state / completion prerequisite / SoD ở bất kỳ tầng nào.
- Với GMP: hồ sơ đào tạo là bằng chứng qualification của nhân sự (EU GMP Ch.2). Một module đào tạo không có backend, không có audit trail, không có e-signature là **không thể validate**.
- Về mặt kỹ thuật thuần tuý, rủi ro bypass hiện **bằng 0** vì endpoint không tồn tại — nhưng đây chính là rủi ro: ngày endpoint được viết, nếu theo mẫu FE hiện tại thì sẽ chỉ có 1 permission thô cho 12 action.

**Evidence:** Không có `TrainingController.java`. `RevisionActionCapabilityService` không có action Training nào ngoài `completeTraining`.

**Recommended correction:** thiết kế Training như một `workflow_key` mới trong `workflow_action_policies` (registry đã hỗ trợ multi-workflow — xem `WorkflowActionPolicyService.resolvePolicy(moduleKey, workflowKey, ...)` và `WorkflowRegistryService`), tái sử dụng `workflow_participants` cho TRAINER/TRAINEE. **Không** viết một engine authorization thứ hai.

---

### F-04 — Endpoint `effective-access` không có permission gate

```
ID:        F-04
Severity:  HIGH        ◄── nâng từ MEDIUM ở vòng 1, đã XÁC NHẬN
Category:  Endpoint không được bảo vệ / Information disclosure
Location:  eqms-backend/src/main/java/com/eqms/controller/SecurityAccessProfileController.java:32-37
           eqms-backend/src/main/java/com/eqms/service/AccessEffectiveService.java:117-160
```

**Current behavior:** Toàn bộ `SecurityAccessProfileController` uỷ quyền check cho service layer (`requireView/requireManage/requireAssign` trong `AccessProfileService` — 24 call site, đúng chuẩn). **Ngoại lệ:** `GET /security/access-profiles/{id}/effective-access` gọi thẳng `AccessEffectiveService.getEffectiveAccess()`.

**Xác minh vòng 2 — đây là lỗi thật.** Comment tại `AccessEffectiveService.java:119-121` viết:
```java
// getWorkflowRoles() already enforces the view permission gate + 404s if the profile
// does not exist (requireView()/requireRole() inside AccessProfileService) — reused
// as-is instead of duplicating that gating here.
RoleDefinition profile = roleDefinitionRepository.findById(accessProfileId)
        .orElseThrow(() -> new EntityNotFoundException("Access profile not found"));
```
Method **không hề gọi** `accessProfileService.getWorkflowRoles()` — nó đi thẳng vào `roleDefinitionRepository.findById`. Toàn bộ class `AccessEffectiveService` không có một lần gọi `hasPermission` hay `requireCurrentUser` nào (`grep` xác nhận). **Comment mô tả một cơ chế bảo vệ không tồn tại.**

**Risk:** Bất kỳ user đã đăng nhập nào cũng liệt kê được ma trận quyền hiệu lực đầy đủ của **mọi** Access Profile — bao gồm SYSTEM_SUPER_ADMIN — trên mọi cặp (action × status × document type). Đây là bản đồ hoàn chỉnh cho privilege escalation: kẻ tấn công biết chính xác profile nào làm được gì và cần nhắm vào đâu.

**Recommended correction:** thêm gate ở đầu `getEffectiveAccess` (chi tiết ở **Task P0-3**).

---

### F-05 — `access_profile_workflow_roles`: cấu hình chết (viết được, audit được, không có hiệu lực)

```
ID:        F-05
Severity:  HIGH (GMP: cấu hình gây hiểu nhầm)
Category:  Configuration without enforcement
Location:  DB: access_profile_workflow_roles (V153)
           BE: AccessProfileService.java:291-306, 472-475, 818-839, 910-990
           BE: RevisionWorkflowAuthorizationService.java:270
           BE: ControlledCopyAuthorizationService.java:844
           FE: features/security-authorization/access-profiles/views/tabs/AccessProfileWorkflowTab.tsx
           FE: features/security-authorization/lifecycle-policies/views/WorkflowRolesView.tsx
           FE: app/routes/SecurityRoutes.tsx — route /security/advanced/workflow-roles
```

**Current behavior:** Admin có UI đầy đủ để gán "Workflow Roles" (DOCUMENT_AUTHOR, DOCUMENT_REVIEWER, DOCUMENT_APPROVER, DCO, QUALITY_ADMIN…) cho một Access Profile. Backend lưu, audit (`ACCESS_PROFILE_WORKFLOW_ROLES_REPLACED`), yêu cầu e-signature, clone khi duplicate profile.

Nhưng ở runtime:
```java
// RevisionWorkflowAuthorizationService.java:270
case WORKFLOW_ROLE, DOCUMENT_WORKFLOW_POOL -> false;
```
Tương tự `case DCO, DOCUMENT_ADMIN, TRAINING_COORDINATOR -> false;` (line 263).

**Risk:** Admin cấu hình "Profile QA Manager có workflow role DOCUMENT_APPROVER", ký điện tử xác nhận, thấy audit trail ghi nhận — và **không có gì xảy ra**. Đây là loại lỗi tồi tệ nhất trong GMP: cấu hình an ninh có bằng chứng nhưng không có hiệu lực. Trong một cuộc thanh tra, sự khác biệt giữa audit trail và hành vi thực tế là một critical finding.

**Recommended correction:** hoặc (a) gỡ hoàn toàn tab/route/API/bảng khỏi hệ thống, hoặc (b) nếu cần giữ làm metadata thì phải hiển thị nhãn rõ ràng *"Descriptive metadata — không ảnh hưởng quyền truy cập"* trên UI và trong audit comment. **Khuyến nghị (a).**

---

### F-06 — Capability API không mô hình hoá reviewer/approver sequence

```
ID:        F-06
Severity:  MEDIUM
Category:  FE-BE inconsistency
Location:  eqms-backend/.../RevisionService.java:1715-1729 (requirePendingParticipant)
           eqms-backend/.../RevisionWorkflowAuthorizationService.java:411-436
           eqms-backend/.../RevisionActionCapabilityService.java:78-81
```

**Current behavior:** `RevisionService.requirePendingParticipant` enforce sequence:
```java
if ("REVIEWER".equalsIgnoreCase(participantType) || "APPROVER".equalsIgnoreCase(participantType)) {
    RevisionWorkflowParticipant nextPending = nextPendingParticipant(revision, participantType).orElse(null);
    if (nextPending != null && !Objects.equals(nextPending.getId(), participant.getId())) {
        throw new IllegalStateException("... must be completed according to the configured sequence");
    }
}
```
Nhưng `RevisionWorkflowAuthorizationService.isPendingReviewer` chỉ kiểm tra `action_status == "PENDING"` — **không** kiểm tra có phải người kế tiếp trong sequence không. Capability API dùng chính hàm này.

**Risk:** Reviewer #2 trong chuỗi tuần tự thấy nút "Complete Review" bật, bấm vào và nhận lỗi 500/`IllegalStateException` với thông điệp không thân thiện. Không phải lỗ hổng an ninh (backend chặn đúng), nhưng vi phạm nguyên tắc "capability là quyết định cuối cùng" và tạo UX sai lệch trong quy trình GMP.

**Recommended correction:** đưa kiểm tra sequence vào `isPendingReviewer`/`isPendingApprover`, trả `reasonCode = "NOT_NEXT_IN_SEQUENCE"`.

---

### F-07 — Bảng ánh xạ permission trong Capability Service bị hard-code, tách rời DB policy

```
ID:        F-07
Severity:  MEDIUM
Category:  Hard-coded permission / Dual source of truth
Location:  eqms-backend/.../RevisionActionCapabilityService.java:378-400
```

**Current behavior:**
```java
private String resolveRequiredPermissionCode(RevisionWorkflowAction action) {
    return switch (action) {
        case SUBMIT_FOR_REVIEW -> "documents.workspace.manage";
        case COMPLETE_REVIEW   -> "documents.revision.review";
        ...
    };
}
```
Trong khi enforcement dùng `policy.getRequiredPermissionCode()` đọc từ `workflow_action_policies`.

**Evidence về sự trôi dạt (drift) đã từng xảy ra:**
- `V159__seed_workflow_action_policies.sql:90` seed SUBMIT_FOR_REVIEW với `documents.revision.submit_review`.
- `V290__align_workspace_managed_revision_actions.sql` phải chạy một `UPDATE` thủ công để đổi thành `documents.workspace.manage` cho khớp với hằng số Java.

Admin **có quyền sửa `required_permission_code` tại runtime** qua UI Workflow Authorization (`WorkflowActionPolicyService.update`). Ngay khi họ làm vậy, hằng số Java sai — và không có gì phát hiện.

**Risk:** Capability response báo sai `requiredPermissionCode` ⇒ FE hiển thị thông điệp "Bạn cần quyền X" trong khi thực tế cần quyền Y. Gây nhầm lẫn khi troubleshoot phân quyền và làm mất giá trị của tính năng "cấu hình được".

**Recommended correction:** `resolveRequiredPermissionCode` phải gọi `workflowActionPolicyService.resolvePolicy(...).map(WorkflowActionPolicy::getRequiredPermissionCode)`. Xoá bảng switch.

---

### F-08 — Actor của `SUBMIT_FOR_REVIEW` quá rộng, và thiếu notification bàn giao Author → DCO

```
ID:        F-08
Severity:  MEDIUM        ◄── thu hẹp từ MEDIUM–HIGH, sau xác minh vòng 2
Category:  Actor quá rộng / Missing notification
Location:  V290__align_workspace_managed_revision_actions.sql:28-33
           eqms-backend/.../RevisionService.java:726-744 (submitForReview)
           eqms-backend/.../RevisionController.java:175 (@PostMapping "/{id}/complete-editing")
```

**Đính chính vòng 1.** Ở vòng 1 tôi kết luận action này "không cần assignment" và ngụ ý thiếu bước bàn giao. **Kết luận đó không chính xác.** Xác minh lại cho thấy luồng hai bước Author → DCO **đã tồn tại và đang hoạt động**:

| Bước | Endpoint | Enum | Actor | Trạng thái sau |
|---|---|---|---|---|
| 1. Author hoàn tất soạn thảo | `POST /revisions/{id}/complete-editing` | `COMPLETE_AUTHORING` | `AUTHOR` | DRAFT + `editingStatus=COMPLETED` + `sourceLocked=true` + chữ ký `PREPARED` |
| 2. DCO kiểm tra & đẩy tiếp | `POST /revisions/{id}/submit-review` | `SUBMIT_FOR_REVIEW` | `PERMISSION documents.workspace.manage` | PENDING_REVIEW |

`submitForReview` có precondition cứng bắt buộc bước 1 phải xong:
```java
// RevisionService.java:740-743
if (!electronicSignatureService.hasRevisionSignatureMeaning(revision, "PREPARED")) {
    throw new IllegalStateException("Revision editing must be completed before submitting for review");
}
```
Và comment tại `RevisionService.java:729` ghi rõ ý đồ thiết kế: *"documents.workspace.manage specifically (DCO)"*.

**Vậy gap thực tế chỉ còn hai điểm:**

1. **Actor quá rộng.** Policy dùng `actor_type = 'PERMISSION'` với `actor_code = 'documents.workspace.manage'` thay vì `actor_type = 'ACCESS_PROFILE'` với `actor_code = 'DCO'`. Bất kỳ ai được cấp permission này — kể cả ngoài đội Document Control — đều submit được. Theo quyết định **Q1**, actor mặc định phải là DCO/Document Controller/Publishing Coordinator.
2. **Thiếu notification.** `grep -n "notificationService\." RevisionService.java` trong vùng `completeEditing` → **không có kết quả**. DCO không được thông báo khi có revision chờ kiểm tra ⇒ bước bàn giao trong thực tế phải dựa vào trao đổi ngoài hệ thống, phá vỡ chuỗi kiểm soát.

**Thuận lợi:** Access Profile với code `DCO` (97 tham chiếu trong migrations) và `DOCUMENT_CONTROLLER` **đã tồn tại trong DB**. Do đó việc gán actor là **thay đổi dữ liệu (migration)**, không phải code Java — thoả mãn đúng yêu cầu *"không hard-code Role DCO trong Java"* của Q1.

**Recommended correction:** xem **Task P1-3** và **P1-4**.

---

### F-09 — Object Access mặc định fail-open (đã hạ mức ở vòng 2b)

```
ID:        F-09
Severity:  LOW / INFORMATIONAL     ◄── hạ từ MEDIUM. Đánh giá vòng 1 đã SAI.
Category:  Defensive default
Location:  eqms-backend/.../ObjectAccessEvaluationService.java:83-95, 120-132
```

> **Đính chính.** Vòng 1 tôi viết: *"Nếu Access Profile không có rule và không set scope, user **thấy toàn bộ tài liệu**"*. **Kết luận đó không đúng.**
>
> `ObjectAccessEvaluationService` **không phải** đường dẫn quyết định việc xem tài liệu. Việc xem đi qua:
> - `DocumentAuthorizationService.canViewDocument` / `canViewRevision` (deny-by-default — xem F-22)
> - tầng list query: `RevisionService:2271`, `DocumentService:1555` (cũng deny-by-default)
>
> `ObjectAccessEvaluationService` chỉ là lớp scope **thứ cấp** bên trong `RevisionWorkflowAuthorizationService.check()` (line 131-138), nơi user **đã buộc** phải qua state + permission + actor. Một nhánh mặc định `true` ở tầng thứ cấp đó không mở thêm quyền nào mà tầng chính chưa cho.
>
> **Rủi ro thực tế: thấp.** Vẫn nên đưa về `DENY` để nhất quán nguyên tắc "deny by default", nhưng đây là dọn dẹp, không phải vá lỗ hổng.

**Current behavior:**
```java
RuleDecision ruleDecision = evaluateRules(profiles, action, document, null);
if (ruleDecision == RuleDecision.DENY) return false;
if (ruleDecision == RuleDecision.ALLOW) return true;
if (hasRelevantAllowRules(profiles, action)) return false;
ScopeDecision scopeDecision = evaluateProfileScope(profiles, document.getBusinessUnit(), document.getDepartment());
return scopeDecision != ScopeDecision.DENY;   // ← không có rule, không có scope ⇒ ALLOW
```

Nếu Access Profile không có `object_access_rules` nào và không set `business_unit_scope`/`department_scope`, user **thấy toàn bộ tài liệu** mà họ có `documents.module.view`.

**Risk:** Trong môi trường multi-site/multi-BU, cấu hình mặc định để lộ toàn bộ tài liệu giữa các đơn vị. Đây là "deny by default" bị đảo ngược.

**Quyết định Q2 (giữ nguyên, nhưng phạm vi thu hẹp):** mặc định `DENY`. Sau khi làm rõ ở vòng 2b, đây là dọn dẹp nhất quán chứ không còn là hạng mục rủi ro cao. Xem **Task P3-1**.

---

### ~~F-19 — `documents.document.view_all` vượt qua Object Access~~ — RÚT LẠI

```
ID:        F-19
Severity:  ĐÃ RÚT LẠI ở vòng 2b (trước đó: HIGH)
Location:  ObjectAccessEvaluationService.java:77, 104
```

**Quyết định Q10 (đã chốt):** DCO và Admin **được phép** xem tất cả document. Hành vi short-circuit hiện tại tại `ObjectAccessEvaluationService.java:77,104` là **đúng chủ đích thiết kế**, không phải lỗi.

**Hệ quả:**
- **Huỷ Q3.** Không tạo `documents.document.view_all_global`.
- **Huỷ Task P3-2** (migration rủi ro cao nhất roadmap).
- Giữ nguyên code hiện tại.

Giữ mục này trong tài liệu để lưu vết quyết định — một finding bị rút lại vẫn là thông tin có giá trị khi thanh tra hỏi vì sao hành vi này được chấp nhận.

---

### F-22 — Mô hình visibility hiện tại (KHÔNG phải finding — ghi nhận là hành vi đúng)

```
ID:        F-22
Severity:  ĐÚNG THEO THIẾT KẾ — ghi nhận để tham chiếu
Location:  DocumentAuthorizationService.java:121-142 (canViewDocument)
           DocumentAuthorizationService.java:174-207 (canViewRevision)
           RevisionService.java:2271 / DocumentService.java:1555 (list query)
```

Xác minh vòng 2b cho thấy mô hình mà Q9/Q10 mô tả **đã được implement đầy đủ và nhất quán trên cả 3 tầng**:

```
canViewRevision(user, revision):
  1. canViewAllDocuments(user)              → TRUE    ← DCO/Admin (documents.document.view_all)
  2. [nhánh strictVisibility — xem F-20]
  3. user là Author của revision            → TRUE
  4. user là CO_AUTHOR / REVIEWER / APPROVER → TRUE   ← được chỉ định vai trò
  5. còn lại                                 → FALSE  ← DENY BY DEFAULT ✅
```

| Tầng | Vị trí | Quy tắc | Khớp Q9/Q10? |
|---|---|---|---|
| List / Search — Revision | `RevisionService.java:2271` | `if (!canViewAll)` → chỉ author + participant | ✅ |
| List / Search — Document | `DocumentService.java:1555` | `if (!canViewAll)` → chỉ author + participant | ✅ |
| Detail — Revision | `canViewRevision` | như trên | ✅ |
| Detail — Document | `canViewDocument` | như trên | ✅ |
| Capability API | `RevisionActionCapabilityService:59` → `requireCanViewRevision` | như trên | ✅ |

**Không cần thay đổi gì cho mô hình này.** Việc còn lại chỉ là dọn nhánh chết (F-20) và khoá cấu hình để không ai vô tình nới lỏng (Task P3-1).

---

### F-20 — Nhánh `strictVisibility`: vừa là dead code, vừa có bug thứ tự

```
ID:        F-20        ◄── phát hiện mới ở vòng 2b
Severity:  MEDIUM (dormant — bom hẹn giờ, chưa nổ)
Category:  Dead code / Latent bug
Location:  DocumentAuthorizationService.java:24-25, 128-131, 171, 182-186
```

**Current behavior:**
```java
@Value("${app.security.participant-visibility-strict:false}")
private boolean strictVisibility;                          // mặc định FALSE
```
Không file cấu hình nào set giá trị này (`grep` toàn bộ `application*.properties` → không có kết quả) ⇒ **luôn `false`** ⇒ nhánh không bao giờ chạy.

**Bug tiềm ẩn — nếu ai đó bật cờ lên:**
```java
// canViewRevision, line 182-186
if (strictVisibility && permissionEvaluationService.hasPermission(user, "documents.document.view")) {
    String status = ...;
    return "EFFECTIVE".equalsIgnoreCase(status)
        || "OBSOLETED".equalsIgnoreCase(status)
        || "CLOSED_CANCELLED".equalsIgnoreCase(status);
}
// ↓ các kiểm tra Author / Co-Author / Reviewer / Approver nằm SAU đây
```
Nhánh này `return` **sớm**, đặt **trước** kiểm tra Author và participant. Hệ quả: một **Author** có permission `documents.document.view` sẽ **mất quyền xem chính bản Draft của mình** — vì Draft không nằm trong danh sách EFFECTIVE/OBSOLETED/CLOSED_CANCELLED.

Điều tương tự với Reviewer đang phải review một revision ở `PENDING_REVIEW`.

**Risk:** Bật một cờ cấu hình tưởng là "nới lỏng để nhân viên đọc SOP" sẽ **khoá luôn Author và Reviewer khỏi công việc của họ**. Đây là loại lỗi rất khó chẩn đoán vì nguyên nhân (một dòng properties) cách xa triệu chứng.

**Tên cờ cũng gây hiểu nhầm:** `participant-visibility-strict` — đặt `true` thực chất **nới lỏng** visibility (cho thêm người xem), không phải siết chặt.

**Quyết định Q9 = phương án A** ⇒ nhánh này **vĩnh viễn không dùng đến**.

**Recommended correction:** xoá hẳn field + 3 nhánh sử dụng (line 128-131, 171, 182-186). Dead code có bug là thứ tệ nhất trong hệ thống validated — nó sẽ được "phát hiện lại" bởi một lập trình viên tương lai và bật lên. Xem **Task P3-1**.

---

### F-21 — Object Access Rules và BU/Department Scope trở thành cấu hình chết

```
ID:        F-21        ◄── phát hiện mới ở vòng 2b — HỆ QUẢ của quyết định Q9/Q10
Severity:  MEDIUM (rủi ro lặp lại đúng mô-típ F-05)
Category:  Configuration without enforcement
Location:  object_access_rules + access_profile_object_rules (V151, V153)
           roles.business_unit_scope, roles.department_scope (V153)
           FE: features/security-authorization/object-rules/ (2 view)
           FE: AccessProfileObjectAccessTab.tsx
```

**Phân tích:** Với mô hình đã chốt (DCO/Admin thấy tất cả; người khác chỉ thấy theo assignment), luồng quyết định visibility **không bao giờ chạm tới** Object Access Rules hay BU/Department Scope:

- Người có `view_all` → thoát ở bước 1, không đọc rule.
- Người được assignment → thoát ở bước 3/4, không đọc rule.
- Người còn lại → `false` ở bước 5, không đọc rule.

`ObjectAccessEvaluationService` chỉ còn được gọi ở lớp scope thứ cấp trong workflow guard — nơi user đã phải là actor hợp lệ, tức đã có assignment, tức đã được phép.

**Risk — đây chính xác là mô-típ F-05 lặp lại:** Admin có UI đầy đủ để tạo Object Access Rule, gán vào Access Profile, đặt Business Unit/Department Scope, ký điện tử, audit ghi nhận — và **kết quả không thay đổi hành vi hệ thống**. Trong thanh tra GMP, khoảng cách giữa audit trail và hành vi thực tế là critical finding.

**Recommended correction — cần bạn quyết định**, ba lựa chọn:

| | Phương án | Đánh giá |
|---|---|---|
| **1** | **Gỡ** như đã làm với Workflow Roles (F-05): xoá bảng, UI, route | Sạch nhất, nhưng mất khả năng phân vùng dữ liệu về sau |
| **2** | **Giữ nhưng nhãn rõ** *"Reserved for future use — không ảnh hưởng quyền hiện tại"* trên UI và trong audit comment | An toàn, chi phí thấp, giữ đường mở |
| **3** | **Kích hoạt có giới hạn**: áp Object Access cho DCO/Admin để phân vùng multi-site (tức là quay lại một phần Q3) | Chỉ có ý nghĩa nếu tương lai triển khai multi-site |

Khuyến nghị của tôi: **phương án 2** ở giai đoạn này. Nó tránh được cả rủi ro "cấu hình chết gây hiểu nhầm" lẫn việc xoá đi một năng lực có thể cần khi mở rộng multi-site. Xem **Task P3-1 Bước 4**.

---

### F-10 — SoD chỉ là advisory; tồn tại hai cơ chế SoD song song

```
ID:        F-10
Severity:  MEDIUM–HIGH
Category:  Missing SoD enforcement / Duplicate mechanism
Location:  eqms-backend/.../SodConstraintService.java:114 (scanViolations), :149 (checkPermissions)
           eqms-backend/.../RevisionService.java:922-932 (setting.isReviewerNoApprove)
           eqms-backend/.../AccessProfileService.java:1132-1165 (validateProfileAssignment)
```

**Current behavior:** Ba cơ chế riêng biệt, không liên thông:

1. **`sod_constraints` + `SodConstraintService`** — API public chỉ có `listPaged`, `getById`, `scanViolations()`, `checkPermissions()`, `create/update/delete`. `grep` cho thấy **không service nghiệp vụ nào** gọi `SodConstraintService` để chặn một action. Đây là công cụ báo cáo.
2. **`AccessProfileService.validateProfileAssignment`** (line 1165) — chặn ở thời điểm **gán profile**.
3. **`DocumentWorkflowSetting.isReviewerNoApprove()`** — một boolean hard-code riêng trong `RevisionService.completeApproval` (line 922-932), thực hiện đúng một rule SoD (reviewer ≠ approver) hoàn toàn ngoài `sod_constraints`.

**Risk:** Admin tạo một SoD constraint trong UI (ví dụ "Author không được là Approver"), nó xuất hiện trong scan report, nhưng **không chặn** hành động thực. Trong khi đó rule reviewer≠approver duy nhất đang hoạt động lại nằm ở một cờ cấu hình khác mà UI SoD không hiển thị.

**Recommended correction:** thêm bước SoD vào `RevisionWorkflowAuthorizationService.check()` (giữa bước actor và allow), đọc `sod_constraints`; migrate `reviewerNoApprove` thành một `sod_constraint` seed để có một nguồn sự thật duy nhất.

---

### F-11 — Không có bảo vệ "last active administrator"

```
ID:        F-11
Severity:  MEDIUM
Category:  Security administration invariants
Location:  eqms-backend/.../UserManagementService.java:329-386
           eqms-backend/.../AccessProfileService.java:1000-1074
```

**Current behavior:** `grep -rn "lastAdmin\|last active\|LAST_ADMIN"` trên toàn bộ `service/` → **không có kết quả**.

Các bảo vệ **đã có**:
- ✅ Không xoá Access Profile đang gán cho user (`deletingWouldRemoveAssignedAccess`, line 172-185).
- ✅ Không deactivate SYSTEM profile (line 379-381) và SYSTEM_SUPER_ADMIN (line 500).
- ✅ Không self-grant critical permission (`preventSelfGrantOfCriticalPermissionSets`, 6 call site).
- ✅ Không unassign user khỏi SYSTEM_SUPER_ADMIN (line 1041).
- ✅ E-signature bắt buộc cho mọi thay đổi security (`SecurityChangeSignatureService.requireValidToken`).

Các bảo vệ **thiếu**:
- ❌ Suspend/terminate user cuối cùng còn giữ SYSTEM_SUPER_ADMIN.
- ❌ Xoá Permission Set cuối cùng cấp `security.access_profiles.update`.

**Risk:** Lockout vĩnh viễn khỏi quản trị an ninh, phải can thiệp trực tiếp DB — hành động không được audit và vi phạm data integrity.

**Recommended correction:** thêm invariant check trong `suspendUser`/`terminateUser`/`removeUser`: đếm số user Active còn giữ profile SYSTEM_SUPER_ADMIN; nếu = 1 thì chặn.

---

### F-12 — Dữ liệu test được seed vào migration production

```
ID:        F-12
Severity:  MEDIUM (GMP data integrity)
Category:  Seed data
Location:  V60-V63, V67, V81-V85, V88, V90, V92 (seed test documents/copies)
           V179__seed_document_lifecycle_test_roles_and_users.sql
           V231__seed_remaining_uat_test_accounts.sql
```

**Current behavior:** Migration production tạo user thật: `user.a.test` … `user.h.test`, `dco.lead1`, `dco.lead2`, `workflow.dco1` (`SettingsSeedBootstrap.java:374-382`), profile `DCO_TEST`, `AP_UAT_DCO_QUALITY`, `AP_UAT_APPROVER_QUALITY`, cùng hàng loạt document/controlled copy giả.

**Risk:** Tài khoản test có quyền thật trong hệ thống validated. Vi phạm ALCOA+ (Attributable/Accurate) — dữ liệu không phản ánh hoạt động thật. Đây là finding chắc chắn bị nêu khi thanh tra.

**Recommended correction:** tách seed test/UAT sang Flyway location riêng (`db/testdata`) kích hoạt theo profile `dev`/`uat`; thêm migration deactivate các tài khoản này cho môi trường production.

---

### F-13 — Permission cache trong bộ nhớ, không TTL, không phân tán

```
ID:        F-13
Severity:  MEDIUM
Category:  Permission cache stale
Location:  eqms-backend/.../PermissionEvaluationService.java:40, 58-70
```

**Current behavior:** `ConcurrentHashMap<UUID, Set<String>> permissionCache` — không TTL, không giới hạn kích thước. Eviction thủ công qua 22 call site trong `AccessProfileService`, `PermissionSetService`, `UserManagementService`.

**Risk:**
- Chạy nhiều instance backend (HA/scale-out): thu hồi quyền trên instance A **không** evict cache trên instance B ⇒ user giữ quyền đã bị thu hồi vô thời hạn.
- Bất kỳ đường dẫn thay đổi entitlement nào quên gọi `clearCache()` đều để lại quyền cũ.
- Memory leak nhẹ (cache theo userId, không bao giờ hết hạn).

**Recommended correction:** chuyển sang Caffeine với `expireAfterWrite(30-60s)` (`CacheConfig.java` đã tồn tại) — TTL ngắn tự giới hạn thiệt hại kể cả khi eviction bị bỏ sót hoặc chạy multi-instance.

---

### F-14 — `hasPermission` của frontend không resolve alias (bất nhất với `hasAnyPermission`)

```
ID:        F-14
Severity:  LOW
Category:  FE-BE inconsistency
Location:  eqms/src/hooks/usePermissions.ts:28-42
```

**Current behavior:**
```ts
const hasPermission = (code) => normalized.has(code.trim().toUpperCase());        // KHÔNG alias
const hasPermissionAlias = (code) => resolvePermissionAliasCodes(code).some(...); // CÓ alias
const hasAnyPermission = (codes) => codes.some(c => hasPermissionAlias(c));       // CÓ alias
```
Backend `PermissionEvaluationService.hasPermission` **luôn** resolve alias (`PERMISSION_ALIASES`, line 24-37).

**Risk:** Với các code có alias (`documents.revision.review` → `COMPLETE_REVIEW`/`REVIEW_DOCUMENTS`…), FE `hasPermission('documents.revision.review')` trả `false` trong khi BE trả `true` ⇒ nút bị ẩn oan. Vì workflow đã dùng capability API nên tác động giới hạn ở các màn hình non-workflow.

**Recommended correction:** làm `hasPermission` = `hasPermissionAlias`; hoặc tốt hơn: hoàn tất migration alias trong DB và xoá cả hai bảng alias (FE `permissionCatalog.ts` và BE `PERMISSION_ALIASES`).

---

### F-15 — Hai catalog permission song song ở frontend

```
ID:        F-15
Severity:  LOW
Category:  Duplicate permission catalog
Location:  eqms/src/features/settings/permissionCatalog.ts (1228 dòng, LEGACY_PERMISSION_CATALOG)
           eqms/src/features/security-authorization/shared/usePermissionCatalog.ts (API-driven)
```

**Current behavior:** Module security-authorization dùng catalog từ API (`settingsApi` → `SecurityPermissionCatalogController` → DB) — **đúng**. Nhưng `features/settings/permissionCatalog.ts` giữ 158 permission hard-code trong FE cho label + alias resolution.

**Đối chiếu FE ↔ DB seeds:**
- 7 code chỉ có ở FE, không có trong DB: `audit.view`, `audit.export`, `users.invite_external`, `users.resend_external_invitation`, `users.retry_external_provisioning`, `users.view_external_provisioning`, `users.disable_microsoft_access` — lưu ý các code này dùng quy ước **2 đoạn** (`audit.view`) thay vì 3 đoạn (`audittrail.module.export`), tức là thuộc một thế hệ đặt tên cũ.
- ~40 code có trong DB nhưng không có trong FE catalog.

**Recommended correction:** FE catalog chỉ giữ alias map (hoặc chuyển alias sang API); label lấy từ API.

---

### F-16 — Permission được seed nhưng không được enforce (orphan)

```
ID:        F-16
Severity:  MEDIUM
Category:  Orphan permission
Location:  db/migration/*.sql vs src/main/java
```

**Current behavior:** So khớp code permission trong seed SQL với chuỗi ký tự trong Java. Các code sau **không xuất hiện ở Java**; một phần có thể được tham chiếu qua `workflow_action_policies.required_permission_code` (đường dẫn hợp lệ, không phải orphan), phần còn lại là orphan thật:

| Permission | Ghi chú |
|---|---|
| `security.users.view` / `.create` / `.update` / `.delete` / `.reset_password` | **Trùng nghĩa** với `settings.user.*` đang được enforce thật (`SettingsUserController.java:521-535`). Orphan + duplicate. |
| `settings.role.view` / `.manage` / `.assign_permissions` | Chỉ tồn tại như alias→`MANAGE_ROLES`. Trùng nghĩa với `security.access_profiles.*`. |
| `settings.user.manage` | Trùng nghĩa với `settings.user.edit`. |
| `training.assignment.manage`, `training.session.manage` | Không có module backend (xem F-03). |
| `ai.copilot.use` / `.manage` | Không enforce. |
| `dashboard.admin.view` | Không enforce. |
| `security.effective_access.diagnose` | Xem F-04 — endpoint tương ứng không gate. |
| `notifications.recipient.qa_manager` | Không phải permission — đây là **audience selector** cho notification policy được cài đặt sai tầng. |
| `settings.dictionary.view` | Không enforce (`SettingsDictionaryController` có 36 endpoint, 0 check). |
| `documents.revision.create` / `.submit` / `.edit_metadata` / `.obsolete` / `.sync_office` | Cần đối chiếu từng dòng với `workflow_action_policies` trước khi kết luận orphan. |
| `documents.controlled_copy.generate` / `.approve_request` / `.reject_request` / `.prepare_distribution` / `.print` / `.destroy` / `.confirm_destroy` / `.preview_file` | Phần lớn **được** dùng qua policy (V320, V342…) — không phải orphan. |

**Risk:** Admin cấp `security.users.delete` cho một profile, ký điện tử, và permission đó không làm gì cả — trong khi `settings.user.delete` mới là cái thật. Đây là F-05 lặp lại ở tầng permission.

**Recommended correction:** chạy kiểm kê chính thức (script so khớp `permissions` ⨯ `workflow_action_policies.required_permission_code` ⨯ chuỗi trong Java), rồi `active = false` các permission orphan kèm migration + audit.

---

### F-17 — Master data GMP (Dictionary) không có phân quyền ở bất kỳ tầng nào

```
ID:        F-17
Severity:  HIGH        ◄── nâng từ MEDIUM ở vòng 1, đã XÁC NHẬN
Category:  Endpoint chỉ kiểm tra authentication
Location:  eqms-backend/.../controller/SettingsDictionaryController.java (36 mapping)
           eqms-backend/.../service/DictionaryManagementService.java (37 public method)
```

**Current behavior — xác nhận vòng 2:** Codebase có mẫu hình chuẩn là gate ở service layer (controller mỏng). Với Dictionary, **cả hai tầng đều trống**:

```
SettingsDictionaryController : 36 @*Mapping — 0 tham chiếu hasPermission/require/@PreAuthorize
DictionaryManagementService  : 37 public method — 0 tham chiếu hasPermission/requireCurrentUser/AccessDenied
```

Trong đó có **21 endpoint mutate** trên master data GMP:

| Tài nguyên | POST | PUT | DELETE |
|---|:--:|:--:|:--:|
| `/business-units` | ✅ | ✅ | ✅ |
| `/departments` | ✅ | ✅ | ✅ |
| `/positions` | ✅ | ✅ | ✅ |
| `/document-types` | ✅ | ✅ | ✅ |
| `/sub-types` | ✅ | ✅ | ✅ |
| `/storage-locations` | ✅ | ✅ | ✅ |
| `/retention-policies` | ✅ | ✅ | ✅ |

**Risk:** Bất kỳ user đã đăng nhập nào — kể cả Read-Only Viewer — cũng có thể xoá một Document Type, đổi Retention Policy, hoặc trỏ lại Storage Location. Hệ quả trực tiếp:

- **Document Type** là khoá của `workflow_action_policies.document_type_id` ⇒ xoá/sửa document type **thay đổi chính sách phân quyền workflow** đang áp dụng.
- **Business Unit / Department** là đầu vào của `ObjectAccessEvaluationService.evaluateProfileScope` ⇒ sửa được chúng nghĩa là **sửa được phạm vi truy cập dữ liệu**.
- **Retention Policy** ảnh hưởng thời hạn lưu trữ hồ sơ GMP (EU GMP Ch.4).

Đây không phải "cấu hình phụ" — đây là **master data điều khiển chính mô hình phân quyền**. Về mức độ, finding này ngang với F-01.

**Recommended correction:** xem **Task P0-4**.

---

### F-23 — Action `GENERATE_REVIEW_SNAPSHOT` là capability rỗng: không có endpoint, không có service method

```
ID:        F-23        ◄── phát hiện mới ở vòng 2c
Severity:  LOW (bề mặt chết, chưa gây hại)
Category:  Phantom capability / Dead surface
Location:  enums/RevisionWorkflowAction.java:8
           service/RevisionActionCapabilityService.java:75, 384
           service/WorkflowActionDefaultPolicyRegistry.java:80
           service/workflow/DocumentsWorkflowDefinitionProvider.java:57
           service/RevisionWorkflowAuthorizationService.java:329
           eqms/src/.../revisionActionCapabilities.ts:12, 54
```

**Current behavior:** `GENERATE_REVIEW_SNAPSHOT` tồn tại đầy đủ ở mọi tầng **trừ tầng thực thi**:

| Tầng | Có? |
|---|---|
| Enum `RevisionWorkflowAction` | ✅ |
| Default policy registry (`from_status = DRAFT`) | ✅ |
| State validation (`validateWorkflowState:329`) | ✅ |
| Actor mặc định (`workspaceManagers`) | ✅ |
| Ánh xạ permission (`documents.revision.generate_preview`) | ✅ |
| **Capability API trả về `actions.generateReviewSnapshot`** | ✅ |
| Khai báo type ở FE | ✅ |
| **Controller endpoint** | ❌ **KHÔNG CÓ** |
| **Service method** | ❌ **KHÔNG CÓ** |

`RevisionController` chỉ có `/{id}/regenerate-snapshot` → `regenerateSnapshot()` (thuộc action `REGENERATE_SNAPSHOT`, khác hoàn toàn).

**Risk:** Thấp trên thực tế — FE mới chỉ khai báo key trong danh sách type, chưa view nào render nút. Nhưng capability API đang **quảng cáo một hành động không tồn tại**: một client gọi theo hợp đồng capability sẽ thấy `allowed: true` rồi không tìm được endpoint nào để gọi. Đây là cùng mô-típ F-05/F-21 (cấu hình/hợp đồng không có hiệu lực), ở tầng capability contract.

Ngoài ra nó từng làm tôi cân nhắc nhầm một phương án ở Q.3-bis ("để DCO bấm generate thủ công") — phương án đó **chưa bao giờ khả thi**.

**Recommended correction:** Với **D-2 (chốt cuối) = DCO không kiểm tra PDF** và quy tắc "Draft chưa được preview", action này không còn lý do tồn tại — snapshot chỉ sinh tại `submitForReview`. **Gỡ** khỏi enum, policy registry, `validateWorkflowState`, capability response và FE type list. Gộp vào **Task Q.4 Bước 7**.

---

### F-24 — Capability báo `preview` khả dụng ở Draft, nhưng endpoint luôn thất bại

```
ID:        F-24        ◄── phát hiện mới ở vòng 2c
Severity:  MEDIUM
Category:  FE-BE inconsistency / Broken capability contract
Location:  service/RevisionActionCapabilityService.java:64, 252-281, 311-326
           service/RevisionService.java:2392-2412 (resolvePreviewType)
           service/RevisionService.java:3184-3204 (previewRevisionFile)
```

**Current behavior — hai nguồn sự thật nói ngược nhau về cùng một hành động:**

| | Capability API | Endpoint thật |
|---|---|---|
| Đường đi | `resolvePreviewObjectType` → DRAFT = `SOURCE_DOCX` | `resolvePreviewType` → DRAFT = `"NONE"` |
| | `hasPreviewSource(SOURCE_DOCX)` → có `filePath` ⇒ `true` | |
| | `SecureFileAccessService.check(VIEW_PREVIEW, SOURCE_DOCX)` — không có rule nào chặn ⇒ allow | |
| **Kết quả** | `actions.preview.allowed = true` | ném `IllegalArgumentException("PDF preview is not available for this revision status")` |

Frontend render theo capability ⇒ hiển thị nút Preview cho revision ở Draft ⇒ người dùng bấm ⇒ lỗi.

**Risk:** Đây chính xác là loại lỗi mà **hợp đồng capability sinh ra để ngăn chặn**. Nó cũng làm xói mòn niềm tin vào toàn bộ mô hình capability-driven: nếu `allowed = true` không bảo đảm gọi được, FE sẽ có xu hướng quay lại tự đoán quyền — đúng thứ mục 7.3/7.4 của đề bài yêu cầu loại bỏ.

Nguyên nhân gốc giống F-07: **hai bảng ánh xạ trạng thái→loại preview được viết độc lập** (`resolvePreviewObjectType` trong capability service và `resolvePreviewType` trong `RevisionService`) rồi phân kỳ.

**Recommended correction:**
1. Hợp nhất hai hàm thành **một** nguồn sự thật; capability và endpoint cùng gọi nó.
2. Ở DRAFT, capability phải trả `preview.allowed = false` với `reasonCode = "PREVIEW_NOT_AVAILABLE_IN_DRAFT"` — khớp quy tắc "Draft chưa được preview".
3. Thêm test parity: với mọi trạng thái revision, `capability.preview.allowed == true` ⟺ endpoint `/preview` trả 200.

Gộp vào **Task Q.4 Bước 7**.

---

### F-18 — CLAUDE.md mô tả sai cấu hình bảo mật hiện tại

```
ID:        F-18
Severity:  INFORMATIONAL (nhưng nguy hiểm cho GMP documentation)
Location:  CLAUDE.md
```

**Current behavior:** `CLAUDE.md` ghi *"config/ → Spring Security (all routes .permitAll(), auth enforced at service layer)"*. Thực tế `SecurityConfig.java:75` là `.anyRequest().authenticated()` với allowlist hẹp. Tương tự, `CLAUDE.md` ghi *"Current highest version: V119"* trong khi thực tế là **V342** (342 file migration).

**Risk:** Tài liệu hệ thống sai lệch so với cấu hình thực. Trong môi trường validated, tài liệu là một phần của hồ sơ CSV.

**Recommended correction:** cập nhật `CLAUDE.md`; đồng thời sửa javadoc sai ở `RevisionWorkflowAuthorizationService.java:30-38` ("SYSTEM_SUPER_ADMIN bypass (after state check)" — code không hề bypass) và `AuthTokenFilter.java:237-241`.

---

## F. Hard-code Inventory

| # | Loại | Vị trí | Hợp lệ? | Phân loại |
|---|---|---|---|---|
| 1 | `"SUPERADMIN"`/`"ADMIN"` role name | `AuthTokenFilter.java:268` | ❌ **KHÔNG** | **Bypass nguy hiểm** (F-02) |
| 2 | `SYSTEM_SUPER_ADMIN` code | `EffectivePermissionService.java:31`, `AccessProfileService` (9 chỗ) | ✅ Có | Infrastructure invariant — dùng **code** bất biến, không phải display name |
| 3 | `"ROLE_" + permission` authority | `TokenService.java:182` | ✅ Có | Spring Security convention; không dùng cho business authz |
| 4 | `PERMISSION_ALIASES` map | `PermissionEvaluationService.java:24-37` | ⚠️ | **Temporary migration alias** — cần lộ trình gỡ |
| 5 | `MANAGED_SET_PREFIX = "ROLE_"` | `PermissionSetService.java:43` | ✅ Có | Naming convention cho managed set `ROLE_<profile.code>` |
| 6 | `TERMINAL_STATUSES` | `RevisionWorkflowAuthorizationService.java:45-46` | ✅ Có | GMP state invariant |
| 7 | **State matrix `validateWorkflowState`** | `RevisionWorkflowAuthorizationService.java:283-378` | ⚠️ Có chủ đích | Hard-code **cố ý** (comment: "non-configurable state invariants"). Đúng cho GMP nhưng **không cấu hình được** ⇒ thêm document type có vòng đời khác phải sửa code |
| 8 | **`resolveRequiredPermissionCode` switch** | `RevisionActionCapabilityService.java:378-413` | ❌ **KHÔNG** | **Dual source of truth** (F-07) |
| 9 | `WorkflowPoolTypes.DCO = "DCO"`, `WorkflowPoolMapping:19` | `config/` | ⚠️ | **Legacy fallback** — pool membership là metadata; runtime trả `false` |
| 10 | `CRITICAL_ACTIONS` set | `WorkflowActionPolicyService.java:43-48` | ✅ Có | Deactivation safety guard |
| 11 | `"DCO"` placeholder trong e-signature/publishing | `ElectronicSignatureService.java:618`, `PublishingWorkspaceService.java:849` | ✅ Có | Chỉ là tên placeholder trong template rendering, không phải authz |
| 12 | `SeedRoleSpec("DCO", ...)` + user seeds | `SettingsSeedBootstrap.java:276, 329, 374-382` | ⚠️ | Seed data — xem F-12 |
| 13 | `GLOBAL_SCOPE_VALUES = {"ALL","*","GLOBAL"}` | `ObjectAccessEvaluationService.java:34` | ✅ Có | Sentinel value |
| 14 | `OFFICE_EDITABLE_EXTENSIONS` | `RevisionActionCapabilityService.java:357` | ✅ Có | Technical constraint |
| 15 | FE: `normalized.has('SYSTEM_SUPER_ADMIN')` | `usePermissions.ts:22` | ✅ Có | UI badge only; comment nêu rõ không dùng làm bypass |
| 16 | FE: `isAdministrator` = OR của 9 permission | `usePermissions.ts:47-57` | ⚠️ | Menu visibility; không phải authz. Nên chuyển sang capability API |
| 17 | FE: `LEGACY_PERMISSION_CATALOG` 158 code | `permissionCatalog.ts` | ⚠️ | Duplicate catalog (F-15) |
| 18 | FE: 12 training action → 1 permission | `useTrainingPermissions.ts:34-51` | ❌ **KHÔNG** | Frontend-only authorization (F-03) |

**Kết luận về hard-coded role:** **Không tìm thấy** bất kỳ `if (roleName.equals("DCO")) allowPublish()` hay `if (user.role === "QA_MANAGER") showApproveButton()` nào. Đây là điểm mạnh thực sự của codebase. Vi phạm duy nhất còn lại là #1 (maintenance mode).

---

## G. FE-BE Inconsistency Matrix

| Action | FE rule | BE rule | API guard | Consistent? | Risk |
|---|---|---|---|---|---|
| Revision: Complete Review | `capabilities.completeReview.allowed` | policy + ASSIGNED_REVIEWER + PENDING + **sequence** | ✅ `RevisionService` | ⚠️ **Không** — FE thiếu sequence | MEDIUM (F-06) |
| Revision: Complete Approval | capability | policy + ASSIGNED_APPROVER + **sequence** + `reviewerNoApprove` | ✅ | ⚠️ **Không** — FE thiếu sequence + SoD | MEDIUM (F-06, F-10) |
| Revision: Publish | capability | policy + state READY_FOR_PUBLISHING + e-sign | ✅ | ✅ Có | Thấp |
| Revision: Submit for Review | capability | policy + PERMISSION-only actor | ✅ | ✅ Nhất quán (nhưng cả hai **cùng lỏng**) | MEDIUM (F-08) |
| Revision: Edit Online | capability (`secureFileAccessService`) | `requireCanEditRevisionFileOnline` | ✅ | ✅ Có | Thấp |
| Revision: `requiredPermissionCode` hiển thị | từ capability response | từ `workflow_action_policies` | — | ❌ **Không** — capability trả hằng số Java | MEDIUM (F-07) |
| Controlled Copy: mọi action | `useControlledCopyActionCapabilities` | `ControlledCopyAuthorizationService` | ✅ | ✅ Có | Thấp |
| Document Master lifecycle | `DocumentMasterActionCapabilityService` | `DocumentMasterWorkflowAuthorizationService` | ✅ | ✅ Có | Thấp |
| **Training: mọi action** | `hasPermissionAlias('training.material.manage')` | **không tồn tại** | ❌ **không có endpoint** | ❌ **Không có BE** | **CRITICAL** (F-03) |
| Access Profile: edit/assign/delete | `AccessProfileCapabilitiesResponse` (BE-driven) | `requireManage`/`requireAssign` + e-sign | ✅ | ✅ Có | Thấp |
| Access Profile: effective-access | route guard `security.access_profiles.view` | **không có** | ❌ | ❌ **Không** | MEDIUM (F-04) |
| Workflow Roles tab | route + `assignWorkflowRoles` capability | ghi DB, **runtime → false** | ✅ (ghi) | ❌ **Không có hiệu lực** | HIGH (F-05) |
| Dictionary (36 endpoint) | không rõ | chưa xác minh | ❓ | ❓ Chưa xác minh | MEDIUM (F-17) |
| Permission alias resolution | `hasPermission` không alias | `hasPermission` luôn alias | — | ❌ **Không** | LOW (F-14) |
| Session: user Suspended | FE không biết | BE **không chặn** | ❌ | ❌ **Không** | **CRITICAL** (F-01) |

---

## H. Permission Usage Matrix (trích yếu — nhóm đại diện)

| Permission | Trong DB | Seeded | Dùng ở FE | Enforce ở BE | Module dùng | Orphan/Duplicate |
|---|:--:|:--:|:--:|:--:|---|---|
| `documents.module.view` | ✅ | ✅ | ✅ route guard | ✅ `CapabilityService`, `NavigationService` | Documents | — |
| `documents.document.create` | ✅ | ✅ | ✅ | ✅ `DocumentAuthorizationService` | Documents | — |
| `documents.document.view_all` | ✅ | ✅ | ✅ | ✅ `canViewAllDocuments` | Documents | — |
| `documents.workspace.manage` | ✅ | ✅ (V278) | ✅ | ✅ policy V290 + `canManageDocumentWorkspace` | Documents | — |
| `documents.revision.review` | ✅ | ✅ (V156) | ✅ capability | ✅ policy | Documents | alias `COMPLETE_REVIEW`, `REVIEW_DOCUMENTS` |
| `documents.revision.approve` | ✅ | ✅ | ✅ capability | ✅ policy | Documents | alias `APPROVE_REVISION`, `APPROVE_DOCUMENTS` |
| `documents.revision.publish` | ✅ | ✅ | ✅ capability | ✅ policy | Documents | alias `PUBLISH_REVISION`, `PUBLISH_DOCUMENTS` |
| `documents.revision.submit_review` | ✅ | ✅ (V156) | ✅ `CapabilityService` | ⚠️ policy đã đổi sang `workspace.manage` (V290) | Documents | **Có thể orphan sau V290** |
| `documents.revision.create` | ✅ | ✅ | ❓ | ❌ không thấy ở Java | Documents | Cần đối chiếu policy |
| `security.access_profiles.view/update/assign` | ✅ | ✅ | ✅ route + capability | ✅ `AccessProfileService` | Security | — |
| `security.permission_sets.*` | ✅ | ✅ | ✅ | ✅ `PermissionSetService` | Security | — |
| `security.workflow_authorization.*` | ✅ | ✅ | ✅ | ✅ `WorkflowActionPolicyController` | Security | — |
| `security.object_rules.*` | ✅ | ✅ | ✅ | ✅ `ObjectAccessRuleService` | Security | — |
| `security.sod.*` | ✅ | ✅ | ✅ | ⚠️ chỉ gate CRUD, không enforce SoD | Security | Xem F-10 |
| `security.access_review.*` | ✅ | ✅ | ✅ | ✅ `AccessReviewService` | Security | — |
| `security.maintenance.bypass` | ✅ | ✅ | ❓ | ❌ **code gọi nhánh role-name** | Security | **Orphan de-facto** (F-02) |
| `settings.user.view/edit/delete/reset_password` | ✅ | ✅ | ✅ | ✅ `SettingsUserController:521-535` | Settings | — |
| `security.users.view/create/update/delete/reset_password` | ✅ | ✅ | ❌ | ❌ | — | **ORPHAN + DUPLICATE** của `settings.user.*` |
| `settings.role.view/manage/assign_permissions` | ✅ | ✅ | ❓ | ⚠️ chỉ là alias→`MANAGE_ROLES` | — | **DUPLICATE** của `security.access_profiles.*` |
| `settings.user.manage` | ✅ | ✅ | ❓ | ❌ | — | **ORPHAN + DUPLICATE** |
| `settings.dictionary.manage` | ✅ | ✅ | ❓ | ⚠️ trong `CapabilityService`, chưa rõ ở controller | Settings | Xem F-17 |
| `settings.dictionary.view` | ✅ | ✅ | ❓ | ❌ | — | **ORPHAN** |
| `training.module.view` | ✅ | ✅ | ✅ route guard | ✅ `TrainingAuthorizationService` (chỉ module gate) | Training | — |
| `training.material.manage` | ✅ | ✅ | ✅ **12 action** | ⚠️ chỉ dùng cho revision training | Training | **Quá thô** (F-03) |
| `training.assignment.manage` | ✅ | ✅ | ❌ | ❌ | — | **ORPHAN** (F-03) |
| `training.session.manage` | ✅ | ✅ | ❌ | ❌ | — | **ORPHAN** (F-03) |
| `dashboard.admin.view` | ✅ | ✅ | ❓ | ❌ | — | **ORPHAN** |
| `ai.copilot.use` / `.manage` | ✅ | ✅ | ❓ | ❌ | — | **ORPHAN** |
| `notifications.recipient.qa_manager` | ✅ | ✅ | ❓ | ❌ | — | **Sai tầng** — là audience selector, không phải permission |
| `audit.view`, `audit.export` | ❌ | ❌ | ✅ FE catalog | ❌ | — | **Chỉ có ở FE catalog** (F-15) |
| `users.invite_external` (+4 code `users.*`) | ❌ | ❌ | ✅ FE catalog | ❌ | — | **Chỉ có ở FE catalog**, quy ước 2 đoạn |

---

## I. Document Control Authorization Matrix

**Nguồn:** `workflow_action_policies` (DB) + `RevisionWorkflowAuthorizationService.validateWorkflowState` + `RevisionService`.

### Document Master

| Action | Permission | Participant | Allowed states | Object access | Business precond. | SoD | E-sign | Audit | Implementation | Gap |
|---|---|---|---|---|---|---|---|---|---|---|
| View | `documents.module.view` | — | any | ✅ `canViewDocument` | — | — | — | ✅ | `DocumentAuthorizationService` | — |
| Create | `documents.document.create` | — | — | — | — | — | ❓ | ✅ | `DocumentService` | E-sign chưa xác minh |
| Edit metadata | `documents.document.edit_metadata` | — | policy | ✅ | — | — | ❓ | ✅ | `DocumentMasterWorkflowAuthorizationService` | — |
| Upload Revision | `documents.revision.upload_source` | AUTHOR | DRAFT | ✅ | `canUploadRevisionSource` | — | — | ✅ | `requireCanUploadRevision` | — |
| Cancel Master | policy | policy | policy (V273) | ✅ | — | — | ✅ | ✅ | `DocumentMasterWorkflowAuthorizationService` | — |
| Obsolete Master | policy | policy | EFFECTIVE | ✅ | — | — | ✅ | ✅ | idem | — |
| View Audit | `documents.document.view_audit` | — | any | ✅ | — | — | — | ✅ | `AuditTrailController` | alias `VIEW_AUDIT_TRAIL` |
| View Revisions | `documents.module.view` | — | any | ✅ | — | — | — | ✅ | `requireCanViewDocumentRevisions` | — |
| View Controlled Copies | `documents.controlled_copy.*` | — | any | ✅ | — | — | — | ✅ | `ControlledCopyAuthorizationService` | — |

### Revision

| Action | Permission (DB policy) | Required participant | Allowed states | Object access | Business preconditions | SoD | E-sign | Audit | Gap |
|---|---|---|---|---|---|---|---|---|---|
| View | `documents.module.view` | — | any | ✅ | — | — | — | ✅ | — |
| Open Authoring Workspace | `documents.workspace.manage` | — | DRAFT | ✅ | — | — | — | ✅ | ⚠️ không cần assignment |
| Upload / Replace Source | `documents.revision.upload_source` | AUTHOR | DRAFT | ✅ | `canUploadRevisionSource` | — | — | ✅ | — |
| Upload to Office Online | `documents.revision.upload_office_online` | AUTHOR | DRAFT | ✅ | `.doc/.docx`, chưa có workspace | — | — | ✅ | — |
| Edit Online | `documents.revision.edit_online` | AUTHOR/CO_AUTHOR | DRAFT | ✅ | có Office workspace | — | — | ✅ | — |
| Preview | `documents.revision.preview` | — | any | ✅ | file tồn tại theo stage | — | — | ✅ | — |
| Complete Authoring | `documents.revision.complete_authoring` | AUTHOR | DRAFT | ✅ | `editingStatus != COMPLETED`, `!sourceLocked` | — | ✅ PREPARED | ✅ | — |
| **Submit for Review** | `documents.workspace.manage` | **PERMISSION only** | DRAFT | ✅ | `editingStatus == COMPLETED && sourceLocked` | — | ✅ | ✅ | ❌ **F-08 — không cần AUTHOR** |
| Complete Review | `documents.revision.review` | ASSIGNED_REVIEWER (PENDING) | PENDING_REVIEW | ✅ | **sequence** | — | ✅ | ✅ | ⚠️ **F-06 sequence không có ở capability** |
| Reject Review | `documents.revision.reject_review` | ASSIGNED_REVIEWER | PENDING_REVIEW | ✅ | sequence | — | ✅ | ✅ | ⚠️ F-06 |
| Approve | `documents.revision.approve` | ASSIGNED_APPROVER (PENDING) | PENDING_APPROVAL | ✅ | sequence + `reviewerNoApprove` | ⚠️ 1 rule hard-code | ✅ | ✅ | ⚠️ **F-06, F-10** |
| Reject Approval | `documents.revision.reject_approval` | ASSIGNED_APPROVER | PENDING_APPROVAL | ✅ | sequence; reset toàn bộ participant | — | ✅ | ✅ | ⚠️ F-06 |
| Complete Training | `documents.revision.complete_training` | policy | PENDING_TRAINING | ✅ | `requiresTraining`, `trainingPlannedDate` | — | ✅ | ✅ | ⚠️ không có Trainer assignment |
| Open Publishing Workspace | `documents.workspace.manage` | PERMISSION only | READY_FOR_PUBLISHING | ✅ | — | — | — | ✅ | ⚠️ F-08 |
| Publish | `documents.revision.publish` | policy | READY_FOR_PUBLISHING | ✅ | — | — | ✅ | ✅ | — |
| Cancel | `documents.revision.cancel` | policy (V273) | DRAFT | ✅ | — | — | ✅ | ✅ | — |
| Upgrade | `documents.revision.upgrade` | AUTHOR (V308) | EFFECTIVE | ✅ | — | — | ✅ | ✅ | — |
| Request Controlled Copy | `documents.controlled_copy.request` | policy | EFFECTIVE | ✅ | — | — | ✅ | ✅ | — |
| Generate/Regenerate Snapshot | `documents.revision.generate_preview` | policy | DRAFT / EFFECTIVE / OBSOLETED | ✅ | — | — | — | ✅ | — |
| Save Workspace / Working Notes | — | AUTHOR/CO_AUTHOR (save), pending participant (notes) | — | ✅ | — | — | — | ✅ | ⚠️ **không có policy DB** — bypass mô hình cấu hình |

### Làm rõ theo yêu cầu mục 12

- **Author vs Co-Author:** `AUTHOR` = `revision.author` (1-1, FK trực tiếp). `CO_AUTHOR` = `workflow_participants(DOCUMENT_REVISION, revId, CO_AUTHOR)` (n). Trong policy là hai `actor_type` riêng ⇒ cấu hình được độc lập. Hiện Co-Author được Edit Online + Save Workspace nhưng **không** được Upload/Replace Source (`canUploadRevisionSource` chỉ Author) và **không** được Complete Authoring.
- **Reviewer chỉ review record được assignment:** ✅ Enforce đúng — `isPendingReviewer` truy vấn `workflow_participants` theo đúng `(objectType, objectId, REVIEWER, userId)` và bắt buộc `action_status = PENDING`.
- **Approver chỉ approve record được assignment:** ✅ Idem.
- **Sequence có được enforce:** ✅ **Tại mutation** (`RevisionService:1722-1727`). ❌ **Không tại capability/authorization service** — F-06.
- **DCO được phép toàn bộ hay chỉ trong scope:** DCO không còn là khái niệm authorization. Quyền "toàn bộ" đến từ permission `documents.document.view_all` ⇒ `canViewAllDocuments()` ⇒ **bypass toàn bộ object access** (`ObjectAccessEvaluationService:77, 104`). Tức là: **có scope, nhưng ai giữ `view_all` thì vượt scope**.
- **Admin có bypass nghiệp vụ không:** ❌ **Không.** `PermissionEvaluationService.hasPermission` không có wildcard cho SYSTEM_SUPER_ADMIN; `evaluatePolicy` bắt buộc permission + actor kể cả với super admin. Đây là điểm tuân thủ GMP rất tốt. **Ngoại lệ duy nhất:** maintenance mode (F-02).
- **Đổi tên Access Profile có ảnh hưởng workflow actor không:** ❌ **Không.** `actor_type = ACCESS_PROFILE` lưu `actor_code`, match qua `userAccessProfileRepository.existsByUserIdAndProfileCode` — dùng **code**, không dùng name.

---

## J. Training Management Authorization Matrix

| Action | Permission nền | Trainer assignment | Trainee assignment | State | Object access | SoD | E-sign | Audit | Backend |
|---|---|---|---|---|---|---|---|---|---|
| View Training | `training.module.view` | — | — | — | ❌ | ❌ | ❌ | ❌ | ⚠️ chỉ `TrainingAuthorizationService.canViewTrainingModule` |
| Create Training Plan | `training.material.manage` (FE) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| Assign Trainee | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| Assign Trainer | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| Start Training | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| Record Attendance | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| Complete Training (module) | `training.material.manage` (FE) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| **Complete Training (revision)** | `documents.training.complete` / `documents.training.manage` / `training.material.manage` | ❌ | ❌ | ✅ PENDING_TRAINING | ✅ `canViewRevision` | ❌ | ✅ | ✅ | ✅ **CÓ** — `RevisionService.completeTraining` |
| Verify Training | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| Waive Training | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| Reassign / Cancel | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |
| View Evidence / Export Report / View Audit | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **không tồn tại** |

**Kết luận:** chỉ **1/14** action có backend, và đó là action thuộc Document Control chứ không phải module Training. Không tồn tại các khái niệm: Trainer assignment, Trainee assignment, Training coordinator, department scope, due/overdue state, completion prerequisite, training SoD.

---

## K. Role Rename Safety Assessment

### Nếu đổi **display name** (`roles.name`) — ví dụ "QA Manager" → "Quality Assurance Manager"

| Thành phần | Dùng gì làm identity | Bị ảnh hưởng? |
|---|---|---|
| `user_access_profiles` | `access_profile_id` (UUID FK) | ✅ An toàn |
| `access_profile_permission_sets` | UUID FK | ✅ An toàn |
| `access_profile_object_rules` | UUID FK | ✅ An toàn |
| `workflow_action_policy_actors` (ACCESS_PROFILE) | `actor_code` = `roles.code` | ✅ An toàn |
| `EffectivePermissionService` | `profile.getCode()` | ✅ An toàn |
| `matchesAccessProfile()` | `existsByUserIdAndProfileCode` | ✅ An toàn |
| Managed permission set | `ROLE_<roles.code>` | ✅ An toàn (code bất biến) |
| `app_users.role_name` (String) | — | ⚠️ **Không tự đồng bộ** — sẽ lệch với `roles.name` |
| `AuthTokenFilter.isMaintenanceExemptRole` | **`app_users.role_name`** | ❌ **BỊ ẢNH HƯỞNG** (F-02) |
| JWT claim `rol` | `app_users.role_name` | ⚠️ Hiển thị/audit; đã cấp phát thì không đổi cho tới khi refresh |
| Audit trail lịch sử | Lưu snapshot `role_name` tại thời điểm | ✅ Đúng chuẩn GMP (giữ giá trị lịch sử) |
| Email template `{userRole}` | `app_users.role_name` | ⚠️ Hiển thị lệch |

**Kết luận:** Đổi display name **an toàn cho toàn bộ authorization**, trừ một ngoại lệ: maintenance-mode bypass (F-02). Nhưng `app_users.role_name` là một cột String tự do không có FK tới `roles` ⇒ có thể lệch vĩnh viễn.

### Nếu đổi **code** (`roles.code`)

❌ **Sẽ phá vỡ:** `workflow_action_policy_actors.actor_code`, managed permission set `ROLE_<code>`, mọi so sánh `SYSTEM_SUPER_ADMIN_CODE`.
✅ **Được bảo vệ:** `AccessProfileService.updateProfile` (line 383-388) **không** cho phép sửa `code` — chỉ `createProfile`/`duplicateProfile` mới set. Đây là thiết kế đúng.

### Có cần migration không?

**Có, ở mức làm sạch (không phải sửa lỗi cấp bách):**
1. Chuyển `app_users.role_name` thành **derived/read-only** từ Access Profile chính, hoặc bỏ hẳn khỏi mọi đường dẫn quyết định (sau khi vá F-02).
2. Bổ sung `UNIQUE` + rule bất biến cho `roles.code` ở tầng DB.
3. Xoá dữ liệu `access_profile_workflow_roles` (F-05).

---

## L. Target Architecture

**Nguyên tắc: giữ nguyên lõi. Không viết lại.** Kiến trúc mục tiêu = kiến trúc hiện tại + 5 thay đổi.

```
User (status: chỉ Active mới được cấp SecurityContext)          ◄── THÊM (F-01)
  ↓  user_access_profiles
Access Profile (identity = code, bất biến)                       ◄── GIỮ NGUYÊN
  ↓  access_profile_permission_sets
Permission Set                                                    ◄── GIỮ NGUYÊN
  ↓  permission_set_items
Permission (một catalog duy nhất, đã dọn orphan/duplicate)        ◄── DỌN (F-15, F-16)
  ↓
Object Access / Data Scope (defaultDecision cấu hình được)        ◄── SỬA (F-09)
  ↓  object_access_rules
Workflow Assignment (workflow_participants, generic)              ◄── GIỮ NGUYÊN
  ↓
Workflow State (workflow_action_policies.from_status)             ◄── GIỮ NGUYÊN
  ↓
Business Preconditions — bao gồm **sequence**                     ◄── DI CHUYỂN vào authz service (F-06)
  ↓
SoD (sod_constraints, enforce trong workflow guard)               ◄── THÊM (F-10)
  ↓
E-Signature / Re-authentication                                   ◄── GIỮ NGUYÊN (đã tốt)
  ↓
Backend Capability Decision                                       ◄── GIỮ NGUYÊN
    (requiredPermissionCode đọc từ DB, không hard-code)           ◄── SỬA (F-07)
  ↓
Frontend renders actions                                          ◄── GIỮ NGUYÊN
```

**Thành phần cần xây mới (không phải refactor):**

- **Training Management backend** — đăng ký `workflow_key = 'TRAINING_ASSIGNMENT'` vào `WorkflowRegistryService`, dùng lại `workflow_action_policies` + `workflow_participants` với `participant_type ∈ {TRAINER, TRAINEE, COORDINATOR}`, `object_type = 'TRAINING_ASSIGNMENT'`. `WorkflowActionPolicyService.resolvePolicy(moduleKey, workflowKey, objectType, ...)` đã generic sẵn — không cần engine thứ hai.

**Thành phần cần loại bỏ:**

- `access_profile_workflow_roles` + tab UI + route `/security/advanced/workflow-roles` + `WorkflowActorType.{WORKFLOW_ROLE, DOCUMENT_WORKFLOW_POOL, DCO, DOCUMENT_ADMIN, TRAINING_COORDINATOR}` (sau khi migrate dữ liệu lịch sử).
- `PERMISSION_ALIASES` (BE) + `LEGACY_PERMISSION_CATALOG` alias (FE), sau migration hợp nhất code.
- Permission orphan/duplicate (`security.users.*`, `settings.role.*`, `settings.user.manage`…).
- Seed test data khỏi migration production.

---

## M. Gap Analysis

| # | Finding | Current | Target | Required change | Quyết định | Priority |
|---|---|---|---|---|---|---|
| 1 | F-01 | Pending/Suspended/Inactive/Terminated giữ nguyên quyền | Chỉ `Active` được cấp SecurityContext | `AuthTokenFilter` + revoke session ở mọi transition rời Active | **Q7** | **P0** |
| 2 | F-02 | Maintenance bypass theo role name | Theo permission | Đổi call site `AuthTokenFilter:148` | — | **P0** |
| 3 | F-04 | `effective-access` không gate (đã xác nhận) | Có gate | Thêm gate + sửa comment sai | — | **P0** |
| 4 | F-17 | Dictionary: 21 endpoint mutate, 0 check (đã xác nhận) | Gate ở service layer | Thêm view/manage gate cho 37 method | — | **P0** |
| 5 | F-07 | Capability hard-code permission map | Đọc từ DB policy | `resolveRequiredPermissionCode` → `resolvePolicy` | — | **P1** |
| 6 | F-06 | Sequence chỉ ở mutation | Cũng ở capability | Thêm sequence vào `isPendingReviewer/Approver` | — | **P1** |
| 7 | F-08 | Actor SUBMIT_FOR_REVIEW quá rộng; thiếu notification bàn giao | Actor = `ACCESS_PROFILE 'DCO'` (data, không sửa Java) + notification 2 chiều. **Không** thêm status (D-1), **không** `RETURN_TO_AUTHOR` (D-5), **không** đụng preview/snapshot (D-2) | Xem **Mục Q** — ~3.5 ngày | **Q1, Q11, D-1/2/5** | **P1** |
| 7b | **F-24** | Capability báo preview khả dụng ở Draft, endpoint luôn lỗi | Hợp nhất 2 hàm resolve preview + parity test | — | **P1** |
| 7c | **F-23** | `GENERATE_REVIEW_SNAPSHOT` là action rỗng (không endpoint, không service) | Gỡ khỏi enum/registry/capability/FE | — | **P1** |
| 8 | F-14 | FE `hasPermission` không alias | Đồng bộ với BE | 1 dòng `usePermissions.ts` | — | **P1** |
| 9 | F-05 | `access_profile_workflow_roles` chết | Đã gỡ | Migration + gỡ UI/API/enum | **Q5** | **P2** |
| 10 | F-16 | Permission orphan/duplicate | Catalog sạch | Kiểm kê + deactivate + hợp nhất | — | **P2** |
| 11 | F-15 | Hai catalog FE | Một catalog từ API | Dọn `permissionCatalog.ts` | — | **P2** |
| 12 | F-12 | Test data trong migration prod | Tách theo environment | Migration deactivate + Flyway location theo profile | **Q6** | **P2** |
| 13 | F-09 | Object access fail-open | ~~Mặc định DENY~~ → giữ nguyên + ghi rõ chủ đích | Chỉ bổ sung comment (hạ xuống INFORMATIONAL) | Q2 | **P3** |
| 14 | ~~F-19~~ | ~~`view_all` vượt scope~~ | — | **ĐÃ HUỶ** | **Q10** | ~~P3~~ |
| 14b | **F-20** | Nhánh `strictVisibility` dead code + bug thứ tự | Xoá hẳn | Xoá field + 3 nhánh sử dụng | **Q9** | **P3** |
| 14c | **F-21** | Object Access Rules thành cấu hình chết | Nhãn "Reserved for future use" | Nhãn UI + audit comment | **Q9/Q10** | **P3** |
| 14d | **F-22** | Mô hình visibility | **Đã đúng** — chỉ cần khoá bằng test | `DocumentVisibilityModelTest` + parity test | **Q9/Q10** | **P3** |
| 15 | F-10 | SoD advisory | Enforce runtime | SoD vào workflow guard + migrate `reviewerNoApprove` | — | **P3** |
| 16 | F-11 | Không có last-admin guard | Có invariant | Guard trong suspend/terminate/remove | **Q7** | **P3** |
| 17 | F-13 | Permission cache không TTL | Caffeine TTL + sẵn sàng distributed | Dùng `CacheConfig` sẵn có | **Q8** | **P3** |
| 18 | F-03 | Training không có backend | Workflow đầy đủ | Xây mới trên registry sẵn có | **Q4** | **P4** |
| 19 | F-18 | `CLAUDE.md` + javadoc sai | Đúng thực tế | Cập nhật tài liệu | — | **P5** |
| 20 | — | State matrix hard-code | Cấu hình được | (tuỳ chọn) `lifecycle_state_policies` | — | **P5** |

---

## N. Implementation Roadmap — KẾ HOẠCH TRIỂN KHAI CHI TIẾT

### Quy ước chung áp dụng cho mọi task

| Chủ đề | Quy tắc bắt buộc |
|---|---|
| **Migration** | Không bao giờ sửa file Flyway đã chạy (Q6). Mọi thay đổi = file `V{N+1}__...sql` mới. Version hiện tại cao nhất: **V342** ⇒ file mới bắt đầu từ **V343**. |
| **Không hard-code** | Không tên Role, không tên Access Profile trong Java. Actor/permission luôn là dữ liệu (migration) hoặc hằng số **code** bất biến. |
| **Nguồn quyết định** | Backend là single source of truth. FE chỉ render theo capability. |
| **Audit** | Mọi thay đổi phân quyền phải sinh `AuditLog` + `AuditLogChange` (actor, timestamp, target, old, new, reason, outcome). |
| **E-signature** | Mọi mutation security admin đi qua `SecurityChangeSignatureService.requireValidToken`. |
| **Thứ tự làm việc** | Với mỗi task: viết test **đỏ** trước → sửa code → test **xanh** → chạy regression suite → cập nhật tài liệu. |
| **Rollback** | Mỗi migration phải có script hoàn tác được ghi trong phần comment đầu file. |

---

## P0 — Security defects

**Mục tiêu:** đóng 4 lỗ hổng có thể khai thác ngay. **Thời lượng:** ~5 ngày. **Không có thay đổi kiến trúc, không có migration schema.**

### Task P0-1 — Chặn truy cập cho user không ở trạng thái Active (F-01, quyết định Q7)

**Files:**
```
eqms-backend/src/main/java/com/eqms/auth/AuthTokenFilter.java
eqms-backend/src/main/java/com/eqms/service/UserManagementService.java
eqms-backend/src/main/java/com/eqms/service/AuthorizationService.java
eqms-backend/src/main/java/com/eqms/service/PermissionEvaluationService.java
```

**Bước 1 — Cổng chặn ở filter.** Trong `AuthTokenFilter.doFilterInternal`, ngay sau `UserAccount user = userRepository.findById(...)` (line 134):

```
NẾU user == null HOẶC user.getStatus() != UserStatus.Active THÌ
    - KHÔNG nạp SecurityContext
    - trả 401 kèm reason code riêng theo từng trạng thái:
        Pending    → ACCOUNT_PENDING_ACTIVATION
        Suspended  → ACCOUNT_SUSPENDED
        Inactive   → ACCOUNT_INACTIVE
        Terminated → ACCOUNT_TERMINATED
    - ghi audit "ACCESS_DENIED_INACTIVE_ACCOUNT" (dùng logSafely, không chặn request)
    - return
```
Đặt kiểm tra này **trước** `isPasswordExpired` và **trước** `isMaintenanceBlocked` — trạng thái tài khoản là điều kiện tiên quyết cao nhất.

**Bước 2 — Thu hồi session ở mọi transition rời Active.** Hiện chỉ `terminateUser` gọi `revokeAllSessions`. Thêm vào:
- `suspendUser` (line ~329)
- mọi đường dẫn set `UserStatus.Inactive`
- xác minh `deleteUser` (line ~325) cũng revoke trước khi xoá

Cách làm sạch nhất: tạo một helper `changeUserStatus(user, newStatus, reason)` tập trung — set status + `revokeAllSessions` nếu rời Active + `evictUserPermissionCache` + audit. Rồi cho suspend/terminate/deactivate gọi chung.

**Bước 3 — Phòng thủ theo chiều sâu ở tầng service.**
- `AuthorizationService.check` (line 50-53): đổi `status == Inactive` thành `status != Active`, reason code `USER_NOT_ACTIVE`.
- `PermissionEvaluationService.getPermissionCodes`: trả `Set.of()` nếu `user.getStatus() != Active`. **Lưu ý:** phải đặt kiểm tra này **trước** `permissionCache.computeIfAbsent`, nếu không sẽ cache nhầm tập rỗng cho user đang Active.

**Bước 4 — FE.** `client.ts` interceptor 401 hiện xoá token và redirect `/login`. Bổ sung hiển thị thông điệp theo reason code để user hiểu vì sao bị đăng xuất (tài khoản bị đình chỉ ≠ hết phiên).

**Tests:**
```
SuspendedUserAccessTest       — user Active có session hợp lệ → suspend → request tiếp theo 401 ACCOUNT_SUSPENDED
PendingUserAccessTest         — user Pending không tạo được SecurityContext
TerminatedUserAccessTest      — terminate → 401 ngay, không chờ token hết hạn
InactiveUserPermissionTest    — getPermissionCodes trả rỗng, cache không bị nhiễm
UserStatusTransitionAuditTest — mọi transition rời Active sinh audit + revoke session
```

**Rủi ro:** user hợp lệ bị khoá nhầm nếu dữ liệu `status` bẩn. **Giảm thiểu:** trước khi deploy chạy `SELECT status, COUNT(*) FROM app_users GROUP BY status` để biết chính xác bao nhiêu tài khoản bị ảnh hưởng; xử lý các tài khoản `Pending` tồn đọng trước.

---

### Task P0-2 — Maintenance bypass theo permission, không theo tên role (F-02)

**File:** `eqms-backend/src/main/java/com/eqms/auth/AuthTokenFilter.java`

**Bước 1.** Tại line 148, đổi:
```java
if (isMaintenanceBlocked(request.getRequestURI(), claims.principal())) {
```
thành overload 3 tham số **đã tồn tại và đã đúng** (line 242-257):
```java
if (isMaintenanceBlocked(request.getRequestURI(), claims.principal(), user)) {
```
Biến `user` đã có sẵn trong scope (được nạp ở line 134).

**Bước 2.** Xoá `isMaintenanceExemptRole` (line 267-269) và overload 2 tham số (line 227-235).

**Bước 3.** Kiểm tra prefix URI. Overload 3 tham số dùng `requestUri.startsWith("/api/auth/")`. Với `server.servlet.context-path=/api`, giá trị `request.getRequestURI()` **đã bao gồm** context path ⇒ prefix `/api/auth/` là đúng. Viết test khẳng định điều này để tránh hồi quy nếu context path đổi.

**Bước 4.** Xác minh permission `security.maintenance.bypass` đã được gán cho ít nhất một Access Profile đang hoạt động — **nếu chưa, sẽ khoá toàn bộ admin khi bật maintenance mode.** Nếu thiếu, tạo migration `V343__grant_maintenance_bypass_to_system_admin.sql` gán vào permission set của SYSTEM_SUPER_ADMIN.

**Tests:**
```
MaintenanceBypassPermissionTest:
  - user có security.maintenance.bypass          → vào được
  - user là SYSTEM_SUPER_ADMIN                    → vào được
  - user có role_name = "ADMIN" nhưng không có
    permission                                     → BỊ CHẶN   ◄── chính là hồi quy cần chặn
  - user thường                                    → 503
  - đổi roles.name không ảnh hưởng kết quả nào ở trên
```

**Rủi ro:** lockout admin khi bật maintenance. **Giảm thiểu:** Bước 4 là bắt buộc, làm trước Bước 1.

---

### Task P0-3 — Gate cho `effective-access` (F-04)

**File:** `eqms-backend/src/main/java/com/eqms/service/AccessEffectiveService.java`

**Bước 1.** Thêm `CurrentUserService` + `PermissionEvaluationService` (đã có sẵn field `permissionEvaluationService` — line 114) và gate ở đầu `getEffectiveAccess`:
```
actor = currentUserService.requireCurrentUser()
NẾU KHÔNG hasAnyPermission(actor,
        "security.access_profiles.view",
        "security.access_profiles.update",
        "security.access_profiles.assign")
   THÌ throw AccessDeniedException("Access profile view permission required")
```
Dùng `AccessDeniedException` (403) chứ **không** `UnauthorizedException` (401) — lý do đã ghi rõ tại `AccessProfileService.java:1083-1086`: 401 khiến interceptor FE tưởng hết phiên và đá user về `/login`.

**Bước 2.** Xoá comment sai tại line 119-121, thay bằng mô tả đúng cơ chế gate.

**Bước 3.** Quét lại toàn bộ controller tìm các trường hợp tương tự — service được gọi thẳng mà không qua service có gate. Ứng viên cần kiểm tra: `EffectiveAccessDiagnosisController`, `UserAuthorizationSummaryController`, `ResourceCapabilityController`, `SecurityEligibleUsersController`.

**Tests:**
```
EffectiveAccessGateTest — user thường → 403; user có view → 200; user có update → 200
```

---

### Task P0-4 — Phân quyền cho Dictionary master data (F-17)

**Files:**
```
eqms-backend/src/main/java/com/eqms/service/DictionaryManagementService.java
eqms-backend/src/main/resources/db/migration/V344__activate_dictionary_permissions.sql
```

**Bước 1 — Thêm guard theo đúng mẫu hình `AccessProfileService`:**
```java
private static final String VIEW_PERMISSION   = "settings.dictionary.view";
private static final String MANAGE_PERMISSION = "settings.dictionary.manage";

private void requireView()   { ... hasAnyPermission(VIEW, MANAGE) ... }
private UserAccount requireManage() { ... hasPermission(MANAGE) ... }
```
Áp dụng cho toàn bộ 37 method public: đọc → `requireView()`, ghi → `requireManage()`.

**Bước 2 — Audit cho mutation.** Kiểm tra 21 endpoint mutate hiện có ghi `AuditTrailService` không. Nếu chưa: bổ sung, vì đây là master data GMP (yêu cầu 7.9 của đề bài — "Endpoint mutate nhưng không audit").

**Bước 3 — Kích hoạt permission.** `settings.dictionary.view` hiện là **orphan** (F-16), `settings.dictionary.manage` đã được tham chiếu trong `CapabilityService:47`. Migration cần:
- đảm bảo cả hai permission `active = true` trong bảng `permissions`;
- gán vào permission set phù hợp để admin hiện tại **không mất quyền**.

> ⚠️ **Cần bạn xác nhận:** gán `settings.dictionary.manage` vào permission set nào? Ứng viên: `QUALITY_ADMIN` (đã có sẵn, V150). Nếu không xác nhận, tôi sẽ gán vào `QUALITY_ADMIN` + permission set được quản lý của SYSTEM_SUPER_ADMIN và ghi rõ trong migration comment.

**Bước 4 — FE.** Kiểm tra màn hình Dictionary trong `features/settings/` có ẩn nút theo `settings.dictionary.manage` chưa; nếu chưa thì bổ sung để FE-BE nhất quán.

**Tests:**
```
DictionaryAuthorizationTest — ma trận đầy đủ:
  - 7 tài nguyên × {GET, POST, PUT, DELETE}
  - user không permission → 403 cho mọi mutate
  - user chỉ có view      → 200 GET, 403 mutate
  - user có manage        → 200 tất cả
DictionaryAuditTest — mỗi mutate sinh đúng 1 AuditLog
```

**Rủi ro:** admin hiện tại mất quyền sửa dictionary sau deploy. **Giảm thiểu:** Bước 3 phải chạy **cùng** deploy, không tách rời.

---

### Định nghĩa "hoàn thành" cho P0

- [ ] 4 task xanh, không giảm coverage
- [ ] Toàn bộ 44 test class hiện có vẫn xanh (regression)
- [ ] Chạy tay: đăng nhập → suspend từ tài khoản khác → xác nhận bị đá ngay
- [ ] Chạy tay: bật maintenance mode → admin vào được, user thường 503
- [ ] `SELECT status, COUNT(*) FROM app_users GROUP BY status` — không có tài khoản hợp lệ nào bị khoá nhầm
- [ ] Không có file Flyway cũ nào bị sửa

---

## P1 — Authorization consistency

**Mục tiêu:** loại bỏ mọi điểm FE và BE dùng hai logic khác nhau. **Thời lượng:** ~1 sprint.

### Task P1-1 — Capability đọc permission từ DB policy (F-07)

**File:** `eqms-backend/.../RevisionActionCapabilityService.java:378-400`

Thay bảng `switch` hard-code bằng truy vấn policy:
```
resolveRequiredPermissionCode(action, revision):
    documentTypeId = revision.document.documentType?.id
    fromStatus     = revision.status.code
    return workflowActionPolicyService
             .resolvePolicy(action, fromStatus, documentTypeId)
             .map(WorkflowActionPolicy::getRequiredPermissionCode)
             .orElse(null)
```
Chữ ký hàm phải nhận thêm `revision` (hiện chỉ nhận `action`) vì policy resolution phụ thuộc status + document type.

**Cân nhắc hiệu năng:** `getCapabilities` gọi 14 workflow action ⇒ 14 lần `resolvePolicy`. `RevisionWorkflowAuthorizationService.check()` **cũng đã** resolve policy cho từng action. Nên **tái sử dụng** policy đã resolve trong `evaluateWorkflowAction` thay vì gọi lại — trả policy kèm decision, hoặc cache theo request.

**Test:** `CapabilityPermissionCodeMatchesPolicyTest` — đổi `required_permission_code` trong DB, gọi capability API, xác nhận response phản ánh giá trị mới (không phải hằng số Java).

### Task P1-2 — Sequence vào tầng authorization (F-06)

**File:** `eqms-backend/.../RevisionWorkflowAuthorizationService.java:411-436`

Nâng `isPendingReviewer`/`isPendingApprover`: ngoài `action_status = PENDING`, phải là **participant kế tiếp** theo `sequence_order` — dùng lại logic `nextPendingParticipant` của `RevisionService:1731`. Tách logic này ra một service/helper dùng chung để hai nơi không phân kỳ lần nữa.

Thêm reason code `NOT_NEXT_IN_SEQUENCE` với thông điệp nêu rõ đang chờ ai.

**Lưu ý:** `RevisionWorkflowAuthorizationService` dùng `workflowParticipantRepository` (bảng generic), còn sequence nằm ở `revision_workflow_participants`. Cần xác minh bảng generic có cột `sequence_order` được đồng bộ qua trigger V235 không; nếu không, phải bổ sung.

**Tests:** reviewer #2 → capability `completeReview.allowed = false`, reason `NOT_NEXT_IN_SEQUENCE`; sau khi #1 xong → `true`.

### Task P1-3 + P1-4 — Tách Complete Editing / Submit for Review (F-08, quyết định Q1 + Q11)

**Đây là hạng mục lớn nhất của P1** — không chỉ đổi actor mà còn thêm một trạng thái vòng đời mới.
**Thiết kế đầy đủ ở [Mục Q](#q-thiết-kế--tách-complete-editing-và-submit-for-review-q1--q11).**

Tóm tắt phạm vi:

| Phần | Nội dung | Trạng thái | Rủi ro |
|---|---|---|---|
| ~~Q-A~~ | ~~Status mới `READY_FOR_REVIEW_SUBMISSION`~~ | ❌ **Huỷ (D-1)** — giữ `DRAFT` + cờ | — |
| Q-B | Actor `SUBMIT_FOR_REVIEW` = DCO (migration dữ liệu, **không sửa Java**) | ✅ Thực hiện | Thấp |
| ~~Q-C~~ | ~~`RETURN_TO_AUTHOR`~~ | ❌ **Huỷ (D-5)** — dùng CANCEL | — |
| Q-D | Notification 2 chiều (Complete Editing → DCO; Cancel → Author) | ✅ Thực hiện | Thấp |
| ~~Q.3-bis~~ | ~~PDF Snapshot cho DCO~~ | ❌ **Huỷ (D-2)** — Draft không preview; Reviewer đọc PDF đầu tiên | — |
| F-24 | Hợp nhất 2 hàm resolve preview; capability khớp endpoint | ✅ Thực hiện | Thấp |
| F-23 | Gỡ action rỗng `GENERATE_REVIEW_SNAPSHOT` | ✅ Thực hiện | Thấp |

**Ước lượng: ~3.5 ngày** (giảm từ ~8 nhờ D-1, D-2, D-5). **Không còn quyết định nào chờ chốt.**

### Task P1-5 — FE `hasPermission` resolve alias (F-14)

`eqms/src/hooks/usePermissions.ts:28-31` → dùng `resolvePermissionAliasCodes` giống `hasPermissionAlias`. Rà soát các call site để chắc không có chỗ nào **cố ý** cần so khớp chính xác.

### Task P1-6 — Đưa saveWorkspace/workingNotes vào mô hình policy

4 action `saveWorkspace`, `batchSaveSubmit`, `addWorkingNote`, `deleteWorkingNote` hiện nằm ngoài `workflow_action_policies` (comment tự thừa nhận tại `RevisionActionCapabilityService.java:87-91`). Tạo policy DB cho chúng để không còn ngoại lệ ngoài mô hình cấu hình. Đồng thời bổ sung 4 key này vào `REVISION_ACTION_CAPABILITY_KEYS` của FE (hiện thiếu).

---

## P2 — Role/Profile & Permission cleanup

**Mục tiêu:** xoá mọi cấu hình không có hiệu lực và mọi permission trùng/mồ côi. **Thời lượng:** 1–2 sprint.

### Task P2-1 — Gỡ Workflow Roles (F-05, quyết định Q5)

**Ranh giới bắt buộc (theo Q5) — chỉ gỡ đúng phần không có runtime effect:**

| Gỡ | Giữ nguyên tuyệt đối |
|---|---|
| `access_profile_workflow_roles` (Access Profile ↔ Workflow Role) | `workflow_participants` |
| `AccessProfileWorkflowRole` entity + repository | `revision_workflow_participants` |
| `AccessProfileWorkflowTab.tsx`, `WorkflowRolesView.tsx` | `document_workflow_participants` |
| Route `/security/advanced/workflow-roles` | Participant type AUTHOR, CO_AUTHOR, ASSIGNED_REVIEWER, ASSIGNED_APPROVER |
| `WorkflowActorType.{WORKFLOW_ROLE, DOCUMENT_WORKFLOW_POOL, DCO, DOCUMENT_ADMIN, TRAINING_COORDINATOR}` | `WorkflowActorType.{AUTHOR, CO_AUTHOR, OWNER, ASSIGNED_REVIEWER, ASSIGNED_APPROVER, ACCESS_PROFILE, PERMISSION}` |

**Trình tự (4 bước, không đảo thứ tự):**
1. **Impact analysis** — `SELECT` toàn bộ `access_profile_workflow_roles`; xuất báo cáo profile nào đang gán role nào; đối chiếu xem có policy nào còn dùng actor type sắp gỡ không.
2. **Bảo tồn lịch sử** — migration ghi toàn bộ nội dung bảng vào `AuditLog` dạng snapshot trước khi xoá (Q5: "bảo đảm dữ liệu lịch sử không bị mất"). Audit trail lịch sử **không** được sửa.
3. **Gỡ FE** trước (UI biến mất), **gỡ API** sau, **drop bảng** cuối cùng — mỗi bước một deploy để có thể dừng lại.
4. **Chuyển actor type sang deprecated** — không xoá khỏi enum ngay nếu còn hàng lịch sử trong `workflow_action_policy_actors`; migration phải dọn hàng đó trước.

### Task P2-2 — Kiểm kê và dọn permission (F-16)

**Bước 1 — Script kiểm kê chính thức.** Xuất ma trận 4 nguồn:
```
permissions.code
  ⨯ có trong permission_set_items?
  ⨯ có trong workflow_action_policies.required_permission_code / workflow_action_policy_actors.actor_code?
  ⨯ có chuỗi tương ứng trong src/main/java?
  ⨯ có trong FE (route guard / usePermissions / catalog)?
```
Kết quả phân loại: `ENFORCED` / `POLICY_ONLY` / `ORPHAN` / `DUPLICATE`.

**Bước 2 — Hợp nhất duplicate:**

| Loại bỏ | Giữ lại | Cách làm |
|---|---|---|
| `security.users.view/create/update/delete/reset_password` | `settings.user.*` | Migration: chuyển mọi permission_set_item sang code giữ lại, rồi deactivate |
| `settings.role.view/manage/assign_permissions` | `security.access_profiles.*` | Idem; đồng thời gỡ khỏi `PERMISSION_ALIASES` |
| `settings.user.manage` | `settings.user.edit` | Idem |

**Bước 3 — Deactivate orphan** (`active = false`, không `DELETE` — giữ FK lịch sử): `ai.copilot.*`, `dashboard.admin.view`, `notifications.recipient.qa_manager` (sai tầng — nên chuyển thành audience selector của notification policy).

**Bước 4 — Kiểm tra không mất quyền.** Trước/sau migration, so sánh `getEffectivePermissionCodes` cho **mọi** user. Chênh lệch phải bằng 0 (ngoài các code duplicate đã ánh xạ).

### Task P2-3 — Dọn catalog FE (F-15)

`permissionCatalog.ts` chỉ giữ alias map; label lấy từ API. Xoá 7 code chỉ có ở FE (`audit.view`, `audit.export`, `users.*`) hoặc bổ sung chúng vào DB nếu thực sự cần.

### Task P2-4 — Tách test data (F-12, quyết định Q6)

Theo Q6: **không sửa migration đã chạy**.
1. Migration mới `V346__deactivate_test_accounts.sql`: set `status = 'Inactive'`, gỡ khỏi `user_access_profiles`, đánh dấu rõ ràng (ví dụ prefix tên `[TEST]`) cho `user.a.test`…`user.h.test`, `dco.lead*`, `workflow.dco1`, và profile `*_TEST`, `AP_UAT_*`.
2. Cấu hình Flyway location theo profile: `db/migration` (mọi env) + `db/testdata` (chỉ dev/uat). Seed test **mới** chỉ đặt ở `db/testdata`.
3. `SettingsSeedBootstrap` (line 276, 329, 374-382) chỉ chạy khi profile != prod.
4. Việc cleanup vĩnh viễn dữ liệu cũ đi qua Change Control, không làm trong sprint này.

### Task P2-5 — Ràng buộc bất biến cho `roles.code`

Migration thêm trigger/constraint chặn `UPDATE roles SET code = ...`. Hiện `AccessProfileService.updateProfile` đã không cho sửa (line 383-388) nhưng chưa có bảo vệ ở tầng DB.

---

## P3 — Object Access, SoD, invariants

**Mục tiêu:** khoá chặt mô hình visibility đã chốt, dọn dead code, enforce SoD. **Thời lượng:** ~1 sprint.

> **Thu gọn ở vòng 2b.** Kế hoạch cũ có 2 task rủi ro hồi quy CAO (P3-1 + P3-2, 1–2 sprint). Sau khi Q9/Q10 xác nhận mô hình hiện tại là **đúng ý đồ**, và xác minh cho thấy nó **đã được implement đầy đủ** (F-22), toàn bộ phần đó co lại còn **một task ~1 ngày, rủi ro thấp**. Task P3-2 cũ **đã huỷ**.

### Task P3-1 — Khoá mô hình visibility + dọn dead code (F-20, F-21, F-09, quyết định Q9/Q10)

**Bước 1 — Xoá nhánh `strictVisibility` (F-20).**
```
Xoá khỏi DocumentAuthorizationService.java:
  - field strictVisibility (line 24-25)
  - nhánh trong canViewDocument       (line 128-131)
  - helper dòng 171
  - nhánh trong canViewRevision       (line 182-186)
```
Đây là dead code **có bug thứ tự** (return sớm trước kiểm tra Author). Q9=A ⇒ không bao giờ dùng. Để lại là bom hẹn giờ.

**Bước 2 — Chốt mô hình bằng test, không bằng comment.** Viết `DocumentVisibilityModelTest` **khoá cứng** hành vi đã chốt, để mọi thay đổi tương lai làm lệch mô hình đều gãy test ngay:
```
DCO/Admin (có documents.document.view_all)  → thấy MỌI document/revision ở MỌI trạng thái
Author của revision X                        → thấy X, KHÔNG thấy Y
Co-Author / Reviewer / Approver của X        → thấy X, KHÔNG thấy Y
User có documents.module.view, không assign  → KHÔNG thấy gì
User có permission set READ_ONLY             → KHÔNG thấy gì   ◄── xác nhận Bước 3
Nhất quán 3 tầng: list query == detail == capability API
```
Tầng list và tầng detail hiện là **hai đoạn code độc lập** (`RevisionService:2271` và `canViewRevision`) cùng cài một quy tắc. Test parity giữa chúng là bắt buộc — nếu không, chúng sẽ phân kỳ đúng như F-06/F-07.

**Bước 3 — Xử lý permission set `READ_ONLY` (V150).** Set này mô tả *"View-only access across all modules"* nhưng dưới mô hình A nó **không cho xem tài liệu nào**. Hoặc đổi mô tả cho đúng, hoặc deactivate. Gộp vào kiểm kê P2-2.

**Bước 4 — Xử lý Object Access Rules (F-21).** Theo phương án đã chọn ở F-21 (khuyến nghị: phương án 2):
- Thêm nhãn trên UI `ObjectAccessRulesView` + `AccessProfileObjectAccessTab`: *"Reserved for future use — không ảnh hưởng quyền truy cập hiện tại"*
- Thêm cùng ghi chú vào audit comment khi tạo/sửa rule
- **Không** xoá bảng — giữ đường mở cho multi-site

**Bước 5 — Nhánh mặc định của `ObjectAccessEvaluationService` → DENY (F-09, Q2).** Đổi nhánh cuối của `canAccessDocument`/`canAccessRevision` từ `true` sang `false`.

⚠️ **Lưu ý quan trọng về Bước 5:** service này được gọi trong `RevisionWorkflowAuthorizationService.check()` line 131-138 — nếu trả `false`, **mọi workflow action sẽ bị chặn** với reason `OUT_OF_SCOPE`. Vì hiện không có Object Access Rule nào được cấu hình, đổi thẳng sang `DENY` sẽ **khoá toàn bộ workflow**.

Do đó Bước 5 phải là: **DENY chỉ khi có rule/scope được cấu hình nhưng không khớp; ALLOW khi hoàn toàn không có cấu hình nào** — tức giữ nguyên hành vi hiện tại và ghi rõ đó là chủ đích. Hoặc đơn giản hơn và an toàn hơn: **giữ nguyên Bước 5, chỉ bổ sung comment giải thích**. Tôi khuyến nghị phương án sau — F-09 giờ là INFORMATIONAL, không đáng đánh đổi rủi ro khoá workflow.

**Bước 6 — Kiểm chứng đường đọc SOP qua Controlled Copy (hệ quả của Q9=A).** Xác minh vòng 2b cho thấy có 2 đường:

| Đường | Cơ chế | Trạng thái |
|---|---|---|
| Link email (token) | `requireTokenPreviewAccess` — token + password, **không cần login** (`ControlledCopyAuthorizationService:413-425`) | ✅ Hoạt động — đây là đường chính cho vận hành |
| Trong ứng dụng | `matchesRequesterOrRecipient` — khớp `recipientUserId` (line 869-878) | ✅ Hoạt động cho người nhận nội bộ |

⚠️ **Nhưng:** actor type `DOCUMENT_VIEWER` (line 847) uỷ quyền cho `documentAuthorizationService.canViewDocument` — dưới mô hình A, hàm này trả `false` cho đúng nhóm người cần xem. Actor `DOCUMENT_VIEWER` do đó **không dùng được**, là một dạng F-21 thu nhỏ. Cần rà soát policy nào đang dùng actor này và thay bằng `REQUESTER_OR_RECIPIENT`.

**Tests:**
```
DocumentVisibilityModelTest          — ma trận ở Bước 2
VisibilityListDetailParityTest       — list và detail cho cùng kết quả trên mọi user × document
ControlledCopyRecipientAccessTest    — người nhận nội bộ xem được copy của mình; người khác 403
StrictVisibilityRemovalTest          — xác nhận Author luôn xem được draft của mình (hồi quy F-20)
```

**Rủi ro:** Thấp. Bước 1 xoá code không chạy; Bước 2–4 là test + nhãn UI; Bước 5 khuyến nghị không đổi hành vi.

### ~~Task P3-2 — `view_all` phải chịu scope~~ — ĐÃ HUỶ

Huỷ theo quyết định **Q10**. Xem F-19 (rút lại). Không tạo `documents.document.view_all_global`, không migration.

### Task P3-3 — SoD enforce runtime (F-10)

**Bước 1 — Hợp nhất hai cơ chế.** Migrate `DocumentWorkflowSetting.isReviewerNoApprove()` (hard-code tại `RevisionService:922-932`) thành một hàng `sod_constraints` chuẩn. Một nguồn sự thật.

**Bước 2 — Thêm bước SoD vào workflow guard.** Trong `RevisionWorkflowAuthorizationService.check()`, chèn giữa bước actor (6) và allow:
```
7. sodEvaluationService.check(user, revision, action)
   → deny reason code SOD_VIOLATION kèm tên constraint bị vi phạm
```
SoD phải áp dụng **cả** ở capability lẫn mutation (dùng chung đường dẫn nên tự động nhất quán).

**Bước 3 — Bổ sung SoD cấp record.** `sod_constraints` hiện thiên về xung đột permission. Cần hỗ trợ ràng buộc theo participant trên cùng một record (Author ≠ Approver của **cùng** revision) — đây mới là SoD mà GMP quan tâm.

**Bước 4.** Đảm bảo `SegregationOfDutiesView` hiển thị đúng rằng constraint **đang được enforce**, không còn là advisory.

### Task P3-4 — Last-active-administrator guard (F-11)

Thêm invariant vào `changeUserStatus` (helper tạo ở P0-1) và `AccessProfileService.removeUser`:
```
NẾU thao tác làm user rời khỏi SYSTEM_SUPER_ADMIN (suspend/terminate/deactivate/unassign)
  VÀ số user Active còn giữ SYSTEM_SUPER_ADMIN sau thao tác == 0
THÌ chặn: "Cannot remove the last active system administrator"
```
Tương tự cho permission set cuối cùng cấp `security.access_profiles.update`.

### Task P3-5 — Permission cache TTL (F-13, quyết định Q8)

Theo Q8: không thiết kế theo giả định single-instance.
1. `ConcurrentHashMap` → Caffeine qua `CacheConfig.java` đã có, `expireAfterWrite(60s)` + `maximumSize`.
2. Giữ nguyên toàn bộ 22 call site eviction — TTL là lưới an toàn, không phải thay thế.
3. Trừu tượng hoá sau interface để sau này thay bằng Redis không đụng call site.
4. Ghi rõ trong tài liệu: **cửa sổ tối đa quyền cũ còn hiệu lực = TTL**.

---

## P4 — Training Management (quyết định Q4)

**Thời lượng:** 4–6 sprint. **Nguyên tắc tuyệt đối (Q4): KHÔNG xây Authorization Engine thứ hai.**

### Sprint 4.1 — Domain model + migration
`training_courses`, `training_materials`, `training_assignments`, `training_sessions`, `training_records`, `training_evidence`. Mọi bảng có audit fields + soft delete + status định nghĩa trong bảng lookup (không enum cứng).

### Sprint 4.2 — Đăng ký vào engine hiện có

| Thành phần dùng lại | Cách dùng |
|---|---|
| `WorkflowRegistryService` | Đăng ký `workflow_key = 'TRAINING_ASSIGNMENT'`, `object_type = 'TRAINING_ASSIGNMENT'` |
| `workflow_action_policies` | Policy cho từng action × từng status — `resolvePolicy(moduleKey, workflowKey, objectType, ...)` **đã generic sẵn** |
| `workflow_participants` | `participant_type ∈ {TRAINER, TRAINEE, COORDINATOR}` — **không** tạo bảng participant riêng |
| `ObjectAccessEvaluationService` | Mở rộng cho object type mới (department scope cho training) |
| `sod_constraints` | Trainer ≠ Trainee của cùng session |
| `SecurityChangeSignatureService` / `ElectronicSignatureService` | E-signature cho Complete/Verify |
| `AuditTrailService` | Toàn bộ mutation |
| `ResourceCapabilityService` | Thêm `case "TRAINING_ASSIGNMENT"` |

### Sprint 4.3 — Permission catalog đúng hạt
Thay **1** permission cho 12 action bằng catalog theo từng business action:
```
training.course.view / create / edit / publish / archive
training.material.view / upload / delete
training.assignment.view / create / assign_trainee / assign_trainer / reassign / cancel
training.session.create / record_attendance
training.record.complete / verify / waive
training.report.export
training.audit.view
```

### Sprint 4.4 — Controller + Capability API
`TrainingController` mỏng, gate ở service layer (đúng mẫu hình codebase). Capability API cho mọi action.

### Sprint 4.5 — Frontend
Xoá toàn bộ authorization FE-only trong `useTrainingPermissions.ts`; chuyển sang capability-driven như `RevisionReviewView`.

### Sprint 4.6 — Document-related Training
Nối `documents.training.complete` (đã có) với module Training: revision ở `PENDING_TRAINING` sinh training assignment thật, có trainee, có bằng chứng, có audit.

**Ngoài phạm vi (giai đoạn sau theo Q4):** Qualification Matrix, Competency Management.

---

## P5 — Legacy cleanup & Validation

- Gỡ `PERMISSION_ALIASES` (BE) sau khi P2-2 hoàn tất và không còn code cũ nào trong DB
- Cập nhật `CLAUDE.md` (F-18): `.anyRequest().authenticated()` chứ không phải `permitAll`; migration cao nhất **V342** chứ không phải V119
- Sửa javadoc sai: `RevisionWorkflowAuthorizationService.java:30-38`, `AuthTokenFilter.java:237-241`, `AccessEffectiveService.java:119-121`
- (Tuỳ chọn) chuyển `validateWorkflowState` sang `lifecycle_state_policies` để state matrix cấu hình được
- Bộ test authorization đầy đủ theo mục P
- Hồ sơ CSV: URS/FS/DS cho authorization model, IQ/OQ/PQ, traceability matrix requirement ↔ test

---

## Tổng hợp thứ tự thực hiện

```
P0 ──► P1 ──► P2 ──┬──► P3 ──► P5
                   └──► P4 (song song được sau P2)
```

| Phase | Thời lượng | Rủi ro hồi quy | Cần quyết định thêm |
|---|---|---|---|
| **P0** | ~5 ngày | Thấp | Permission set cho `settings.dictionary.manage` |
| **P1** | ~1.5 sprint | Thấp | Access Profile code chuẩn cho DCO |
| **P2** | 1–2 sprint | Trung bình | — |
| **P3** | ~1 sprint (giảm từ 1–2) | **Thấp** (giảm từ CAO) | F-21: chọn 1 trong 3 phương án cho Object Access Rules |
| **P4** | 4–6 sprint | Thấp (module mới) | — |
| **P5** | 1 sprint | Thấp | — |

**Phụ thuộc bắt buộc:**
- P3-4 (last-admin) cần helper `changeUserStatus` từ **P0-1**
- P1-4 (notification) cần actor policy từ **P1-3**
- P2-2 (dọn permission) phải xong trước **P5** (gỡ alias)
- ~~P3-1 và P3-2 phải làm cùng nhau~~ — **không còn áp dụng**, P3-2 đã huỷ theo Q10
- P3-1 Bước 6 (Controlled Copy) là **điều kiện tiên quyết** cho P4: dưới mô hình Q9=A, Trainee cần một đường đọc tài liệu và Controlled Copy là ứng viên chính

---

## O. Business Decisions Record (đã chốt — vòng 2)

Các quyết định dưới đây là **nguồn tham chiếu bắt buộc** cho toàn bộ thiết kế và triển khai.

| # | Câu hỏi | Quyết định | Ảnh hưởng |
|---|---|---|---|
| **Q1** | Ai được Submit for Review? | **Author** hoàn tất `Complete Editing`; **DCO / Document Controller / Publishing Coordinator** thực hiện `Submit for Review`. Hai action có policy độc lập, cấu hình riêng được. Actor DCO là **dữ liệu**, không hard-code Java. | F-08 → P1-3, P1-4 |
| **Q2** | Object Access mặc định? | **DENY.** "Không cấu hình" ≠ "xem toàn bộ". Bắt buộc impact analysis + migration an toàn, không đổi đột ngột. | F-09 → P3-1 |
| ~~**Q3**~~ | `view_all` có vượt Object Access? | ~~Không~~ — **ĐÃ HUỶ ở vòng 2b, thay bằng Q10** | ~~F-19 → P3-2~~ **đã huỷ** |
| **Q4** | Phạm vi Training Management? | **Đầy đủ**: Course Catalog, Material, Assignment, Trainer/Trainee Assignment, Session, Completion, Due/Overdue, Evidence, Record, Document-related Training, Audit Trail, E-signature. Qualification Matrix + Competency **giai đoạn sau**. **Tái sử dụng hoàn toàn** engine hiện có. | F-03 → P4 |
| **Q5** | Workflow Roles: gỡ hay giữ? | **Gỡ** phần Access Profile Workflow Roles (không có runtime effect). **Giữ nguyên** participant thật: AUTHOR, CO_AUTHOR, ASSIGNED_REVIEWER, ASSIGNED_APPROVER. Workflow participation xác định theo **record-level assignment**. Trước khi xoá: impact analysis + migration + bảo toàn lịch sử. | F-05 → P2-1 |
| **Q6** | Test/UAT data? | **Không sửa migration đã chạy.** Test data mới tách theo environment (dev/uat/prod). Data test cũ: **không xoá trực tiếp** — tạo migration mới để deactivate / đánh dấu, hoặc cleanup theo Change Control. | F-12 → P2-4 |
| **Q7** | `UserStatus.Pending` nghĩa là gì? | Tài khoản đã tạo nhưng **chưa hoàn tất kích hoạt/provisioning** → không đăng nhập, không tạo SecurityContext. **Chỉ `Active` được truy cập.** Pending / Suspended / Inactive / Terminated đều bị từ chối. Rời `Active` ⇒ **thu hồi toàn bộ session ngay**. | F-01 → P0-1 |
| **Q8** | Kiến trúc triển khai? | Hiện: Backend trên Windows Server, Frontend trên cPanel, **một instance**. Nhưng **không thiết kế theo giả định single-instance**. Permission cache cần TTL hợp lý + invalidation + dễ mở rộng multi-instance. | F-13 → P3-5 |
| **Q9** | Ai đọc được SOP đã hiệu lực? | **Phương án A.** Chỉ DCO/Admin và người **được chỉ định vai trò** trong tài liệu đó. Nhân viên khác đọc SOP qua **Controlled Copy** phát hành riêng. Không bật `strictVisibility`. | **F-20, F-21, F-22** → P3-1 |
| **Q10** | DCO/Admin có được xem tất cả? | **Có.** DCO và Admin xem được **tất cả** document. Các user còn lại chỉ xem tài liệu mà họ được chỉ định vai trò. ⇒ **Huỷ Q3**, giữ nguyên short-circuit `view_all`. | **F-19 rút lại**, P3-2 huỷ |
| **Q11** | Tách Complete Editing / Submit for Review | **Complete Editing = Author** (chịu trách nhiệm nội dung). **Submit for Review = DCO** (chịu trách nhiệm kiểm soát tài liệu). DCO kiểm tra metadata, reviewer/approver, related/correlated docs, Office Online, source file, PDF snapshot. Actor lấy từ Workflow Action Policy, **không hard-code DCO trong Java** — phải đổi được sang Document/QA Coordinator không cần sửa code. | **F-08** → **Mục Q** |
| **D-1** | Có thêm trạng thái `Ready for Review Submission`? | **KHÔNG.** Giữ nguyên `status = DRAFT` + `editingStatus = 'COMPLETED'` + `sourceLocked = true`. | **Q-A huỷ** |
| **D-5** | Có action `RETURN_TO_AUTHOR`? | **KHÔNG.** DCO tự sửa metadata/reviewer/approver; lỗi nội dung hoặc file nguồn thì **CANCEL** revision, Author mở revision mới. | **Q-C huỷ** |

### Mô hình visibility đã chốt (Q9 + Q10)

```
        ┌──────────────────────────────────────────┐
        │  documents.document.view_all  (DCO/Admin)│ ──► xem TẤT CẢ, mọi trạng thái
        └──────────────────────────────────────────┘
        ┌──────────────────────────────────────────┐
        │  Được chỉ định vai trò trong tài liệu:    │
        │  AUTHOR / CO_AUTHOR / REVIEWER / APPROVER │ ──► xem ĐÚNG tài liệu đó
        └──────────────────────────────────────────┘
        ┌──────────────────────────────────────────┐
        │  Mọi user còn lại                         │ ──► KHÔNG xem được gì trong DMS
        │                                           │     đọc SOP qua Controlled Copy
        └──────────────────────────────────────────┘
```

**Hệ quả cần theo dõi:**

| Hệ quả | Ảnh hưởng | Xử lý |
|---|---|---|
| Object Access Rules + BU/Dept Scope không còn tác dụng | Cấu hình chết (mô-típ F-05) | **F-21** — cần bạn chọn 1 trong 3 phương án |
| Permission set `READ_ONLY` (V150) không cho xem gì | Mô tả sai lệch | P3-1 Bước 3 |
| Nhánh `strictVisibility` vĩnh viễn không dùng | Dead code có bug | **F-20** — xoá ở P3-1 Bước 1 |
| Actor `DOCUMENT_VIEWER` uỷ quyền cho `canViewDocument` | Không dùng được cho đúng nhóm cần | P3-1 Bước 6 |
| **Trainee (Q4) không phải participant của revision** | Không đọc được tài liệu được đào tạo | **Phải giải quyết trong P4** — xem ghi chú dưới |
| Controlled Copy gánh toàn bộ phân phối tài liệu vận hành | Phụ thuộc đơn điểm | P3-1 Bước 6 xác minh 2 đường đã hoạt động |

> ⚠️ **Ghi chú cho P4 (Training):** Q9=A nghĩa là Trainee **không** đọc được tài liệu mình phải học qua DMS, vì trainee không phải AUTHOR/CO_AUTHOR/REVIEWER/APPROVER. Khi xây Training Management phải thiết kế một đường đọc riêng — hoặc coi `TRAINEE` là một participant type được cấp quyền xem tài liệu liên quan, hoặc phát Controlled Copy tự động cho trainee. **Không được** để trainee không có cách đọc tài liệu được đào tạo.

### Nguyên tắc xuyên suốt (ghi nhận từ phản hồi vòng 2)

1. Không hard-code Role Name trong business authorization.
2. Không hard-code Access Profile Name.
3. Authorization dựa trên: Permission → Workflow Policy → Workflow Assignment → Object Access → Business Preconditions → SoD → Capability.
4. Frontend **không** tự quyết định quyền.
5. Backend là **Single Source of Truth**.
6. Mọi thay đổi phân quyền phải có Audit Trail, tuân thủ **EU GMP Annex 11**, **FDA 21 CFR Part 11**, **GAMP 5**.

---

## O-bis. Quyết định còn cần xác nhận trước khi code

Ba điểm nhỏ, **không chặn** việc bắt đầu P0 (đều có phương án mặc định an toàn):

| # | Thuộc task | Câu hỏi | Mặc định nếu không có phản hồi |
|---|---|---|---|
| **A** | P0-4 | Gán `settings.dictionary.manage` vào permission set nào? | `QUALITY_ADMIN` (đã có sẵn từ V150) + permission set quản lý của SYSTEM_SUPER_ADMIN |
| **B** | P1-3 | Access Profile code chuẩn cho DCO? DB đang có `DCO` (97), `DOCUMENT_CONTROLLER` (1), `DCOSTAFF`, `DCOFFICER`, `DCO_TEST` | Dùng `DCO` + `DOCUMENT_CONTROLLER`; các biến thể còn lại xử lý trong P2-2 |
| ~~**C**~~ | ~~P3-2~~ | ~~Profile nào được `view_all_global`?~~ | **Không còn cần** — Q10 đã huỷ P3-2 |
| **D** | P3-1 Bước 4 | **F-21:** Object Access Rules + BU/Dept Scope xử lý thế nào? (1) Gỡ hẳn / (2) Giữ + nhãn "Reserved" / (3) Kích hoạt cho multi-site | **Phương án 2** — tránh cấu hình chết gây hiểu nhầm, đồng thời không xoá mất năng lực có thể cần khi mở rộng multi-site |

Điểm **D** là điểm duy nhất còn mở ở P3, và nó **không chặn P0/P1/P2**.

---

## P. Test Strategy

### Unit test
- `EffectivePermissionServiceTest` — mở rộng: profile inactive, permission set inactive, user không có profile, nhiều profile chồng lấn
- `PermissionEvaluationServiceTest` — **thiếu hiện tại**: alias resolution, cache eviction, SYSTEM_SUPER_ADMIN không có wildcard
- `RevisionWorkflowAuthorizationServiceTest` — ✅ đã có; bổ sung: sequence, SoD, mọi `WorkflowActorType`

### Integration test — API authorization
- **Bảng ma trận endpoint × permission**: mỗi endpoint mutate phải có 1 test "user không có permission → 403". Ưu tiên `SettingsDictionaryController` (36), `ControlledCopyController` (38), `PublishingTemplateController` (17), `AccessReviewController` (10)
- Test `effective-access` trả 403 cho user thường (F-04)

### Workflow state test
- Với mỗi `RevisionWorkflowAction` × mỗi status: chỉ status trong `validateWorkflowState` cho phép
- Xoá/deactivate policy → `POLICY_NOT_CONFIGURED` (fail-closed)

### Assignment test
- Reviewer của revision X **không** review được revision Y
- Reviewer #2 không hành động trước reviewer #1 (**cả mutation lẫn capability** — F-06)
- Participant đã `COMPLETED` không hành động lại

### Role rename test — **thiếu hoàn toàn hiện tại**
- Đổi `roles.name`, verify: permission không đổi, workflow actor vẫn match, managed set không orphan, user vẫn hành động được
- Verify `roles.code` không sửa được qua API

### Privilege escalation test
- Self-grant critical permission → chặn (đã có `AccessProfileServiceSecurityTest`, mở rộng mọi đường dẫn)
- User có `security.access_profiles.assign` nhưng không có `.update` không sửa được permission set
- Gọi thẳng API bỏ qua FE với JWT của user quyền thấp

### Last-admin test — **thiếu hoàn toàn**
- Suspend/terminate SYSTEM_SUPER_ADMIN cuối cùng → chặn
- Xoá permission set cuối cùng cấp `security.access_profiles.update` → chặn

### Session / user lifecycle test — **thiếu hoàn toàn, ưu tiên cao nhất**
- Suspend user đang có session hoạt động → request tiếp theo 401 (F-01)
- Terminate → 401 ngay lập tức
- Maintenance mode: user có `security.maintenance.bypass` vào được; user có `role_name = "ADMIN"` nhưng không có permission **không** vào được (F-02)

### Direct API bypass test
- Với mỗi action FE ẩn nút, gọi thẳng endpoint → phải 403
- Endpoint public (`/controlled-copies/*/preview|download`) chỉ chấp nhận token/password hợp lệ

### Frontend capability test
- Capability `allowed=false` → nút disabled/ẩn cho **mọi** key trong `REVISION_ACTION_CAPABILITY_KEYS`
- FE type list thiếu `saveWorkspace`, `batchSaveSubmit`, `addWorkingNote`, `deleteWorkingNote` mà BE có trả → bổ sung + test parity contract

### Cross-module test
- User có `documents.revision.review` nhưng không có `training.module.view` → không vào được Training
- Đổi permission set → mọi module thấy thay đổi ngay (cache eviction — F-13)

### Audit test
- Mỗi mutation security (Role/Permission Set/SoD/Object Rule/user status) sinh đúng 1 `AuditLog` + `AuditLogChange` với actor, timestamp, target, old, new, reason
- Mọi deny workflow sinh `WORKFLOW_ACCESS_DENIED` (✅ đã có ở `logDeniedAudit`)
- **Thiếu:** audit cho unauthorized attempt ở tầng permission (`AuthorizationService.require` ném exception nhưng **không** ghi audit — chỉ workflow layer mới ghi)

---

## Điều kiện hoàn thành vòng phân tích

| Yêu cầu (mục 18) | Trạng thái |
|---|---|
| Đã quét FE, BE, API và DB | ✅ |
| Đã truy vết ít nhất một action end-to-end | ✅ Complete Review (mục D) |
| Đã lập inventory role/profile/permission | ✅ Mục F, H |
| Đã kiểm tra rename safety | ✅ Mục K |
| Đã kiểm tra Document Control assignment | ✅ Mục I |
| Đã kiểm tra Training assignment | ✅ Mục J (kết quả: không tồn tại) |
| Đã kiểm tra FE-BE consistency | ✅ Mục G |
| Đã liệt kê hard-code | ✅ Mục F |
| Đã đưa ra roadmap | ✅ Mục N |
| Chưa sửa code khi chưa được phê duyệt | ✅ **Không có file source nào bị thay đổi** |

**Các điểm treo của vòng 1 — trạng thái sau vòng 2:**

| Điểm treo | Trạng thái |
|---|---|
| `AccessEffectiveService.getEffectiveAccess` — F-04 | ✅ **Đã đóng.** Xác nhận không có gate; comment mô tả cơ chế không tồn tại. Nâng lên HIGH. |
| `SettingsDictionaryController` / service — F-17 | ✅ **Đã đóng.** Xác nhận 0 check ở cả 2 tầng, 21 endpoint mutate master data. Nâng lên HIGH. |
| Luồng Complete Editing → Submit for Review — F-08 | ✅ **Đã đóng.** Luồng đã tồn tại ~85%; gap thu hẹp còn actor + notification. Hạ xuống MEDIUM. |
| Đối chiếu từng dòng `permissions` ⨯ policy — F-16 | ⏸️ **Chuyển thành Task P2-2 Bước 1** (script kiểm kê chính thức) |
| `ControlledCopyAuthorizationService` (1086 dòng) | ⏸️ Mới xác minh ở mức kiến trúc; soi từng action khi chạm vào P3 |
| `WorkflowActionPolicyService` dòng 200-929 (preview/diff/validation) | ⏸️ Chưa đọc hết; không chặn P0/P1 |

---

## Q. Thiết kế — Tách Complete Editing và Submit for Review (Q1 + Q11)

### Q.0 — Nguyên tắc nghiệp vụ (đã chốt)

| Action | Actor mặc định | Trách nhiệm |
|---|---|---|
| **Complete Editing** | **Author** | Chịu trách nhiệm **nội dung** |
| **Submit for Review** | **DCO** (cấu hình được) | Chịu trách nhiệm **kiểm soát tài liệu** |

Author **không** được tự đưa tài liệu vào Review khi metadata/workflow chưa hoàn chỉnh. DCO kiểm tra: Metadata, Reviewer/Approver, Related Documents, Correlated Documents, Office Online, Source File, PDF Snapshot, điều kiện nghiệp vụ.

**Ràng buộc kỹ thuật:** Actor lấy từ `workflow_action_policies`. **Không hard-code DCO trong Java.** Doanh nghiệp phải đổi được sang Document Coordinator / QA Coordinator mà không sửa code.

### Q.1 — Hiện trạng: đã có 80%, thiếu 20% quan trọng

| Yêu cầu | Hiện trạng | Gap |
|---|---|---|
| Hai action tách rời | ✅ `COMPLETE_AUTHORING` và `SUBMIT_FOR_REVIEW` là 2 enum, 2 endpoint, 2 policy row | — |
| Complete Editing = Author | ✅ Actor `AUTHOR`, Co-Author cũng không được (`RevisionService.java:672-678`) | — |
| Submit chỉ sau khi Complete | ✅ Precondition cứng: `hasRevisionSignatureMeaning(revision, "PREPARED")` | — |
| **Trạng thái hiển thị được** | ❌ Vẫn là `DRAFT` + 2 cờ ẩn `editingStatus='COMPLETED'` + `sourceLocked=true` | **Q-A** |
| **Submit = DCO** | ❌ Actor là `PERMISSION documents.workspace.manage` — ai có permission đều làm được | **Q-B** |
| **DCO trả lại Author** | ❌ **Không tồn tại action nào** | **Q-C** |
| **Notification cho DCO** | ❌ `grep notificationService` trong `completeEditing` → không có | **Q-D** |

---

### ~~Q-A — Trạng thái `READY_FOR_REVIEW_SUBMISSION`~~ — **ĐÃ HUỶ (quyết định D-1)**

> **Quyết định D-1: KHÔNG thêm trạng thái mới.** Giữ nguyên cơ chế hiện tại: `status = DRAFT` + `editingStatus = 'COMPLETED'` + `sourceLocked = true`.
>
> **Hệ quả — khối lượng giảm mạnh:**
>
> | | Nếu thêm status | Quyết định D-1 |
> |---|---|---|
> | Migration status + `from_status` policy | Có | **Không** |
> | Migration dữ liệu hồ sơ đang chạy | Có | **Không** |
> | Rà 78 chỗ hard-code `"DRAFT"` (Java) | Có | **Không** |
> | Rà 23 chỗ FE + status chip/filter | Có | **Không** |
> | **Tổng** | ~8 ngày | **~3 ngày** |
>
> **Điểm cần chấp nhận cùng quyết định này:**
> - Trạng thái "chờ DCO submit" **không hiển thị** trên status chip — người dùng và thanh tra viên nhìn thấy `Draft`.
> - Worklist của DCO phải lọc bằng điều kiện ghép `status=DRAFT AND editingStatus='COMPLETED' AND sourceLocked=true`. `pending-counts` hiện **không** có bộ đếm này ⇒ vẫn cần bổ sung (xem Q.4 Bước 4).
> - FE tiếp tục phải đọc `editingStatus`/`sourceLocked` để biết đang ở bước nào (10 chỗ hiện có).
>
> Phần phân tích dưới đây **giữ lại để lưu vết quyết định**, không thực hiện.

<details>
<summary>Phân tích Q-A (đã huỷ — giữ để tham chiếu)</summary>

#### Vì sao đã từng đề xuất trạng thái tường minh

Hiện `DRAFT + editingStatus=COMPLETED + sourceLocked=true` **về mặt hành vi đã tương đương** trạng thái mới. Nhưng với GMP có 4 lý do phải làm tường minh:

1. **Minh bạch (ALCOA+ — Legible).** Trạng thái vòng đời phải đọc được trực tiếp, không suy ra từ hai cờ nội bộ. Thanh tra viên nhìn `DRAFT` sẽ hiểu là đang soạn thảo, trong khi thực tế đang chờ DCO.
2. **Worklist của DCO.** DCO cần bộ lọc "hồ sơ chờ tôi submit". Hiện phải lọc `status=DRAFT AND editingStatus=COMPLETED AND sourceLocked=true` — một điều kiện ghép ẩn, không có trong `pending-counts`.
3. **Giảm nguy cơ phân kỳ.** `validateWorkflowState` hiện kiểm tra state (DRAFT) ở một chỗ và `editingStatus`/`sourceLocked` ở chỗ khác qua `context`. Gộp thành một status làm cho policy `from_status` trở thành nguồn sự thật duy nhất.
4. **Cấu hình được.** `workflow_action_policies` khoá theo `from_status`. Có status riêng thì admin cấu hình được "ai làm gì ở bước chờ submit" mà không đụng code.

#### Tiền lệ: V282 + V283 đã thêm `READY_FOR_PUBLISHING`

Đây là khuôn mẫu chính xác cần lặp lại:
```sql
-- V282: thêm status
INSERT INTO revision_statuses (code, label, sort_order, is_terminal, ...)
VALUES ('READY_FOR_PUBLISHING', 'Ready for Publishing', 45, false, ...)
ON CONFLICT (code) DO UPDATE SET ...;

-- V283: chuyển from_status của policy
UPDATE workflow_action_policies
SET from_status = 'READY_FOR_PUBLISHING', ...
WHERE action_code = 'OPEN_PUBLISHING_WORKSPACE' AND from_status = 'DRAFT';
```

#### Thay đổi cần thực hiện

**1. DB — status mới**

`revision_statuses` hiện dùng `sort_order` 1–8 (V9), riêng V282 chèn `READY_FOR_PUBLISHING` với 45. Đề xuất:
```sql
INSERT INTO revision_statuses (code, label, sort_order, is_terminal, ...)
VALUES ('READY_FOR_REVIEW_SUBMISSION', 'Ready for Review Submission', 15, false, ...)
```
`sort_order = 15` nằm giữa `DRAFT` (1) và `PENDING_REVIEW` (2) theo thang mở rộng.

> ⚠️ **Cần xác nhận — tên mã status.** Đề xuất `READY_FOR_REVIEW_SUBMISSION` (bám sát chữ bạn dùng và convention `READY_FOR_PUBLISHING`). Phương án khác: `PENDING_SUBMISSION`, `READY_FOR_SUBMISSION`. **Đây là giá trị bất biến, đổi về sau rất tốn** — cần chốt trước khi viết migration.

**2. DB — chuyển `from_status` của các policy**

| Action | `from_status` hiện tại | Sau thay đổi | Ghi chú |
|---|---|---|---|
| `COMPLETE_AUTHORING` | DRAFT | **DRAFT** (giữ) | Author làm ở Draft |
| `SUBMIT_FOR_REVIEW` | DRAFT | **READY_FOR_REVIEW_SUBMISSION** | Cốt lõi |
| `UPDATE_DRAFT_METADATA` | DRAFT | DRAFT **+ thêm row** cho status mới | Xem quyết định D-3 |
| `UPLOAD_SOURCE` | DRAFT | **DRAFT** (giữ) | Author không sửa file sau khi complete |
| `GENERATE_REVIEW_SNAPSHOT` | DRAFT | DRAFT **+ thêm row** | DCO cần tạo lại snapshot để kiểm tra |
| `REGENERATE_SNAPSHOT` | DRAFT/EFFECTIVE/OBSOLETED | **+ status mới** | Idem |
| `CANCEL` | DRAFT | DRAFT **+ thêm row** | Xem quyết định D-4 |
| **`RETURN_TO_AUTHOR`** | — | **READY_FOR_REVIEW_SUBMISSION** | Action mới — xem Q-C |

**3. Java — state matrix**

`RevisionWorkflowAuthorizationService.validateWorkflowState` (line 283-378) hard-code state cho từng action. Đây chính là **hard-code #7** trong Inventory (mục F) — "cố ý nhưng không cấu hình được". Cần sửa:
```java
case SUBMIT_FOR_REVIEW -> {
    if (!isReadyForReviewSubmission) yield stateError(..., "READY_FOR_REVIEW_SUBMISSION");
    // Bỏ kiểm tra editingStatus/sourceLocked — status mới ĐÃ hàm ý cả hai
    yield null;
}
```

**4. Java — chuyển trạng thái**

| File | Thay đổi |
|---|---|
| `RevisionService.completeEditing` (line ~694) | Ngoài `editingStatus`/`sourceLocked`, gọi `updateRevisionStatus(..., "READY_FOR_REVIEW_SUBMISSION", ...)`. Chữ ký `PREPARED` ghi `DRAFT → READY_FOR_REVIEW_SUBMISSION` |
| `RevisionService.submitForReview` (line 739) | `requireRevisionStatus(revision, "DRAFT")` → status mới |
| `rejectReview` / `rejectApproval` | Giữ nguyên đích `DRAFT` — trả về Author là đúng |

**5. Java — rà soát 78 chỗ hard-code `"DRAFT"`**

Phân bố: `RevisionService` 24, `WorkflowActionDefaultPolicyRegistry` 10, `RevisionWorkflowAuthorizationService` 6, `DocumentAuthorizationService` 5, còn lại rải rác. Mỗi chỗ phải phân loại:

| Loại | Xử lý |
|---|---|
| "đang do Author soạn thảo" | Giữ `DRAFT` |
| "chưa vào review" (bao gồm cả bước chờ submit) | Đổi thành `DRAFT` **hoặc** status mới |
| Preview/file access | Xem quyết định D-2 |

Đặc biệt cần soi: `DocumentAuthorizationService.canEditDraftRevision`, `SecureFileAccessService` (3 chỗ), `RevisionActionCapabilityService.isDraft` (quyết định loại preview).

**6. FE — 23 chỗ dùng `DRAFT` + 10 chỗ dùng `editingStatus`/`sourceLocked`**

- Status chip: nhãn + màu cho trạng thái mới
- Bộ lọc, tab, dashboard, `pending-counts` (thêm đếm "chờ submit" cho DCO)
- Sau khi có status tường minh, **gỡ** các nhánh FE đang tự suy ra trạng thái từ `editingStatus`/`sourceLocked` — đây là dạng "FE tự tính state" mà mục 7.3 đề bài yêu cầu loại bỏ

**7. Migration dữ liệu cho hồ sơ đang chạy**
```sql
UPDATE document_revisions SET status_id = (SELECT id FROM revision_statuses WHERE code='READY_FOR_REVIEW_SUBMISSION')
WHERE status_id = (SELECT id FROM revision_statuses WHERE code='DRAFT')
  AND editing_status = 'COMPLETED' AND source_locked = true;
```
Chạy `SELECT COUNT(*)` trước để biết số hồ sơ bị ảnh hưởng. Ghi audit cho từng bản ghi bị chuyển (GMP: mọi thay đổi trạng thái phải có vết).

</details>

---

### Q-B — Actor `SUBMIT_FOR_REVIEW` = DCO ✅ **THỰC HIỆN**

**Chỉ là migration dữ liệu — không sửa Java.** Đúng yêu cầu "không hard-code DCO trong Java":

```sql
DELETE FROM workflow_action_policy_actors a USING workflow_action_policies p
WHERE a.policy_id = p.id AND p.action_code = 'SUBMIT_FOR_REVIEW' AND ...;

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type, actor_code, created_at)
SELECT gen_random_uuid(), p.id, 'ACCESS_PROFILE', code, now()
FROM workflow_action_policies p, (VALUES ('DCO'), ('DOCUMENT_CONTROLLER')) AS t(code)
WHERE p.action_code = 'SUBMIT_FOR_REVIEW' AND ...;
```

Runtime đã hỗ trợ sẵn: `matchesActor` → `case ACCESS_PROFILE -> matchesAccessProfile(user, actor.getActorCode())` → `userAccessProfileRepository.existsByUserIdAndProfileCode` — khớp bằng **code bất biến**, nên đổi display name không ảnh hưởng (đã kiểm chứng ở mục K).

**Khả năng đổi sang Document Coordinator / QA Coordinator trong tương lai:** Admin vào UI Workflow Authorization → sửa actor của policy → xong. Không deploy, không sửa code. Đây chính là năng lực mà kiến trúc hiện tại đã có.

`required_permission_code` giữ `documents.workspace.manage` — permission (làm được loại việc này) và actor (được làm trên hồ sơ này) là hai tầng độc lập.

> ⚠️ **Cần xác nhận — code chuẩn.** DB có `DCO` (97 tham chiếu), `DOCUMENT_CONTROLLER` (1), `DCOSTAFF`, `DCOFFICER`, `DCO_TEST`. Đề xuất dùng `DCO` + `DOCUMENT_CONTROLLER`, các biến thể còn lại hợp nhất trong P2-2.

---

### ~~Q-C — Action `RETURN_TO_AUTHOR`~~ — **ĐÃ HUỶ (quyết định D-5)**

> **Quyết định D-5: KHÔNG làm `RETURN_TO_AUTHOR`.**
> **Cách xử lý khi DCO phát hiện sai sót (đã chốt):**
>
> ```
> DCO kiểm tra
>  ├─ Metadata / Reviewer / Approver sai  ──► DCO TỰ SỬA        (D-3 = Có)
>  ├─ Nội dung hoặc file nguồn sai        ──► CANCEL revision
>  │                                          Author mở revision mới
>  └─ Hợp lệ                              ──► Submit for Review
> ```
>
> **Xác minh đường CANCEL có hoạt động không:** ✅ **Có.**
> - Policy `CANCEL` từ V273: `from_status = 'DRAFT'`, permission `documents.revision.cancel`.
> - V273 seed actor `AUTHOR, CO_AUTHOR, DCO, DOCUMENT_ADMIN` — trong đó `DCO`/`DOCUMENT_ADMIN` là actor type **trả `false` ở runtime** (`RevisionWorkflowAuthorizationService.java:263`).
> - **Nhưng V288 (chạy sau) đã sửa:** thay các actor chết bằng `PERMISSION documents.workspace.manage` rồi `DELETE` các dòng chết.
> - ⇒ Actor hiệu lực của CANCEL hiện là `AUTHOR`, `CO_AUTHOR`, `PERMISSION documents.workspace.manage`. **DCO cancel được.**
>
> **Ba điểm cần lưu ý khi triển khai:**
>
> 1. **Mất lịch sử soạn thảo.** CANCEL đưa revision sang `CLOSED_CANCELLED` (terminal). Toàn bộ working notes, snapshot, vết chỉnh sửa của revision bị huỷ nằm lại ở bản ghi đã đóng; Author bắt đầu lại từ revision mới. Đây là đánh đổi đã được chấp nhận cùng D-5.
> 2. **Lý do CANCEL phải bắt buộc.** Vì đây là đường thoát duy nhất cho lỗi nội dung, `activity summary` khi cancel cần là trường **bắt buộc** và phải nêu rõ lý do trả lại — đó là bằng chứng GMP duy nhất còn lại giải thích vì sao hồ sơ bị huỷ. Cần xác minh `cancelRevision` hiện có bắt buộc trường này chưa.
> 3. **Cần notification cho Author khi DCO cancel.** Nếu không, Author không biết hồ sơ của mình đã bị huỷ và vì sao. Bổ sung vào Q-D.
>
> Phần phân tích dưới đây **giữ lại để lưu vết quyết định**, không thực hiện.

<details>
<summary>Phân tích Q-C (đã huỷ — giữ để tham chiếu)</summary>

**Luồng mô tả kết thúc bằng "Submit for Review → Pending Review". Nhưng nếu DCO kiểm tra và phát hiện sai thì sao?**

Đây là nhánh bắt buộc phải có — chính vì lý do bạn nêu: *"Không để Author tự ý đưa tài liệu vào Review khi metadata hoặc workflow chưa hoàn chỉnh."* DCO kiểm tra để **bắt lỗi**; bắt được lỗi thì phải có chỗ để trả lại.

```
DCO kiểm tra
   ├─ Hợp lệ    ──► Submit for Review ──► Pending Review
   └─ Có vấn đề ──► ??? ← HIỆN KHÔNG CÓ
```

Hiện tại DCO chỉ có 3 lựa chọn, đều sai:
1. Submit dù biết sai — phá vỡ chính mục đích của bước kiểm soát
2. `CANCEL` revision — quá nặng, huỷ cả hồ sơ
3. Liên hệ Author ngoài hệ thống — mất vết audit, vi phạm Annex 11

**Đề xuất: action mới `RETURN_TO_AUTHOR`**

| Thuộc tính | Giá trị |
|---|---|
| Enum | `RevisionWorkflowAction.RETURN_TO_AUTHOR` |
| `from_status` | `READY_FOR_REVIEW_SUBMISSION` |
| Trạng thái đích | `DRAFT` |
| Actor mặc định | `ACCESS_PROFILE DCO` (cùng nhóm với SUBMIT_FOR_REVIEW) |
| Permission | `documents.revision.return_to_author` (mới) |
| Tác dụng phụ | `editingStatus = 'IN_PROGRESS'`, `sourceLocked = false`, mở lại Office Online — **tái dùng đúng logic `rejectReview` đã có** (`RevisionService.java:895-907`) |
| E-signature | Có (nhất quán với reject review/approval) |
| Lý do | **Bắt buộc** — nhập text, ghi vào audit |
| Notification | Gửi Author |
| Audit | `REVISION_RETURNED_TO_AUTHOR` + old/new status + reason |

Về mặt kỹ thuật đây là bản sao của `rejectReview` với `from_status` khác — chi phí thấp, tái dụng nhiều.

</details>

---

### Q-D — Notification ✅ **THỰC HIỆN**

Sau `completeEditing` thành công, gửi notification tới nhóm actor được cấu hình cho `SUBMIT_FOR_REVIEW`. **Không hard-code danh sách người nhận** — truy vấn ngược từ policy:

```
policy     = resolvePolicy(SUBMIT_FOR_REVIEW, "DRAFT", documentTypeId)
recipients = tất cả user thuộc các ACCESS_PROFILE trong policy.actors
```

Cách này tự động đúng khi doanh nghiệp đổi actor sang Document Coordinator / QA Coordinator — notification đi theo cấu hình, **không cần sửa code**.

**Hai notification cần thêm:**

| Sự kiện | Người nhận | Nội dung |
|---|---|---|
| Author `Complete Editing` | Nhóm actor của `SUBMIT_FOR_REVIEW` (DCO) | "Có revision chờ kiểm tra và submit" + link |
| DCO `CANCEL` revision | Author + Co-Author | "Revision đã bị huỷ" + **lý do** (bắt buộc, xem Q-C điểm 3) |

Mỗi loại cần: email template mới trong `email_templates` + in-app notification.

---

### Q.2 — Luồng sau thay đổi (theo D-1 + D-5)

```
                    ┌─────────┐
                    │  DRAFT  │
                    │ editing │  Author:
                    │ = IN_   │  • Edit Online
                    │ PROGRESS│  • Upload/Replace Source
                    └────┬────┘  • Update Metadata
                         │
                         │ COMPLETE_AUTHORING
                         │ [Actor: AUTHOR]  [E-sign: PREPARED]
                         ▼
                    ┌─────────────────────────┐
                    │  status = DRAFT          │  ◄── KHÔNG đổi status (D-1)
                    │  editingStatus=COMPLETED │
                    │  sourceLocked  = true    │
                    └────┬────────────────────┘
                         │  ── Notification ──► DCO        (Q-D)
                         │
       DCO kiểm tra:     │
       • Metadata        ├──► sai metadata/reviewer ──► DCO TỰ SỬA (D-3)
       • Reviewer/Approver│                              rồi quay lại kiểm tra
       • Related/Correlated│
       • Office Online   ├──► sai nội dung/file ──► CANCEL revision (D-5)
       • Source File     │                          ├─ lý do BẮT BUỘC
       • PDF Snapshot    │                          ├─ Notification ► Author
       • Điều kiện NV    │                          └─ CLOSED_CANCELLED (terminal)
                         │                             Author mở revision mới
                         │
                         │ SUBMIT_FOR_REVIEW
                         │ [Actor: ACCESS_PROFILE 'DCO' — cấu hình được]  (Q-B)
                         │ [Permission: documents.workspace.manage]
                         │ [E-sign]
                         ▼
                    ┌────────────────┐
                    │ PENDING_REVIEW │
                    └────────────────┘
```

---

### Q.3 — Bảng quyết định (đã chốt)

| # | Quyết định | Kết quả | Ảnh hưởng |
|---|---|---|---|
| **D-1** | Thêm status `Ready for Review Submission`? | ❌ **KHÔNG** — giữ `DRAFT` + `editingStatus`/`sourceLocked` | **Q-A huỷ.** Giảm ~5 ngày |
| **D-2** | DCO có kiểm tra PDF Snapshot không? | ❌ **KHÔNG.** Snapshot giữ nguyên sinh tại `submitForReview`; **Reviewer** là người đầu tiên đọc bản PDF. Quy tắc "Draft chưa được preview" giữ nguyên vẹn. | **Q.3-bis huỷ.** Vẫn phải sửa **F-24**, gỡ **F-23** |
| **D-3** | DCO sửa được metadata? | ✅ **CÓ** (suy ra từ D-5) | Cần xác minh policy `UPDATE_DRAFT_METADATA` cho phép actor DCO |
| **D-4** | Ai được CANCEL? | ✅ `AUTHOR`, `CO_AUTHOR`, `PERMISSION documents.workspace.manage` — **đã đúng sẵn** sau V288 | Không cần đổi |
| **D-5** | Làm `RETURN_TO_AUTHOR`? | ❌ **KHÔNG** — lỗi nội dung/file thì CANCEL | **Q-C huỷ.** Giảm ~1.5 ngày |
| **D-6** | Author còn upload file sau Complete Editing? | ❌ **KHÔNG** — `sourceLocked=true` đã khoá | Không cần đổi |

### ~~Q.3-bis — PDF Snapshot cho DCO kiểm tra~~ — **ĐÃ HUỶ (quyết định D-2 sửa đổi)**

> **Quyết định D-2 (chốt cuối): BỎ việc DCO kiểm tra PDF Snapshot.**
>
> DCO kiểm tra: Metadata, Reviewer/Approver, Related Documents, Correlated Documents, Office Online, Source File, điều kiện nghiệp vụ — **không** kiểm tra PDF Snapshot. Snapshot vẫn sinh tại `submitForReview` như hiện tại. **Reviewer là người đầu tiên đọc bản PDF.**
>
> #### Vì sao đảo quyết định
>
> Quyết định trước đó (sinh snapshot tại `completeEditing`) mâu thuẫn với quy tắc **"Draft chưa được preview"**. Vì D-1 giữ nguyên `status = DRAFT` ở bước chờ DCO, muốn DCO xem được PDF thì phải mở ngoại lệ preview cho DRAFT — phá vỡ một quy tắc vòng đời đang nhất quán ở **ba chỗ độc lập**:
>
> | # | Vị trí | Cơ chế chặn |
> |---|---|---|
> | 1 | `RevisionService.resolvePreviewType:2395` | `case "DRAFT" -> "NONE"` ⇒ endpoint ném `"PDF preview is not available for this revision status"` |
> | 2 | `SecureFileAccessService.evaluateReviewSnapshotRules:325-334` | `REVIEW_SNAPSHOT` bị từ chối ở DRAFT, trừ khi `hasRejectedReviewSnapshot = true` |
> | 3 | `RevisionActionCapabilityService.resolvePreviewObjectType` | DRAFT → `SOURCE_DOCX`, không phải PDF |
>
> **Hệ quả: không sửa gì liên quan preview/snapshot.** Ước lượng Mục Q giảm còn **~3.5 ngày**.
>
> #### Hai việc vẫn phải làm (độc lập với D-2)
>
> - **F-24** — capability báo `preview.allowed = true` ở Draft nhưng endpoint luôn lỗi. Đây là hợp đồng capability bị vỡ, phải sửa bất kể D-2.
> - **F-23** — `GENERATE_REVIEW_SNAPSHOT` là action rỗng. Với D-2 bỏ và Draft không preview, action này càng vô nghĩa ⇒ gỡ.
>
> Phần phân tích dưới đây **giữ lại để lưu vết quyết định**, không thực hiện.

<details>
<summary>Phân tích Q.3-bis (đã huỷ — giữ để tham chiếu)</summary>

#### Hiện trạng

1. **Snapshot sinh AT submit, không phải trước đó.** `refreshPreviewFromUploadedFile(revision)` được gọi ở **đúng một chỗ** — bên trong `submitForReview` (`RevisionService.java:749`), ngay trước audit `REVIEW_PACKAGE_GENERATED`. Khi DCO đang kiểm tra, PDF **chưa tồn tại**.
2. **Preview ở DRAFT luôn mở file nguồn.** `RevisionActionCapabilityService.resolvePreviewObjectType` map `isDraft(status)` → `SOURCE_DOCX`.
3. **Phương án "DCO bấm generate thủ công" vốn không khả thi** — xem **F-23**: action `GENERATE_REVIEW_SNAPSHOT` **không có endpoint và không có service method**.

#### Thiết kế theo D-2

**Bước 1 — Sinh snapshot tại `completeEditing`.**
Thêm `refreshPreviewFromUploadedFile(revision)` vào `completeEditing`, đặt **sau** `syncEditedFileFromOfficeOnlineToMinio` và `lockOfficeOnlineEditing`, **trước** `recordElectronicSignature` — snapshot phải phản ánh đúng file nguồn đã bị khoá.

**Bước 2 — Quyết định xử lý lỗi render.** ⚠️ Hàm hiện tại **nuốt exception**:
```java
} catch (Exception ex) {
    log.warn("Failed to generate PDF preview for revision {} during submit", revision.getId(), ex);
}
```
Ở vị trí cũ (submit) điều này tạm chấp nhận được. Ở vị trí mới nó **không** ổn: nếu render lỗi, Complete Editing vẫn báo thành công, chữ ký `PREPARED` vẫn ghi, nhưng DCO không có PDF để kiểm tra — quay lại đúng vấn đề ban đầu, chỉ khác là im lặng.

| | Phương án | Đánh giá |
|---|---|---|
| **a** | Render lỗi ⇒ **Complete Editing thất bại** (fail-closed) | Đúng GMP: không có bản PDF thì hồ sơ chưa sẵn sàng bàn giao. Nhưng Author bị chặn khi dịch vụ render trục trặc |
| **b** | Render lỗi ⇒ vẫn hoàn tất, nhưng **ghi audit rõ ràng** + hiển thị cảnh báo cho DCO ("PDF snapshot chưa sẵn sàng") + cho phép DCO tạo lại | Không chặn Author; DCO thấy rõ tình trạng và có đường xử lý |

**Khuyến nghị: (b)**, kèm điều kiện — nếu `previewFilePath` rỗng thì `SUBMIT_FOR_REVIEW` **bị chặn** với reason code `PREVIEW_NOT_AVAILABLE`. Như vậy Author không bị chặn oan, nhưng hồ sơ vẫn không thể vào Review khi thiếu PDF. **Cần bạn xác nhận (a) hay (b).**

**Bước 3 — Giữ luôn việc sinh lại tại `submitForReview`.** Không xoá lời gọi ở line 749. Lý do: D-3 cho phép **DCO sửa metadata** sau khi snapshot đã sinh. Nếu metadata được render vào PDF (header/footer qua publishing template) thì snapshot sinh ở bước Complete Editing sẽ **lạc hậu**. Sinh lại tại submit đảm bảo gói review phản ánh metadata cuối cùng. Hàm này idempotent nên gọi hai lần an toàn.

⇒ Mô hình: **sinh ở Complete Editing để DCO kiểm tra; sinh lại ở Submit để chốt gói review.**

**Bước 4 — Sửa `resolvePreviewObjectType`.**
```
Ở DRAFT:
  nếu sourceLocked == true VÀ previewFilePath có giá trị  → REVIEW_SNAPSHOT
  ngược lại                                                → SOURCE_DOCX
```
Điều kiện `sourceLocked` đảm bảo Author trong lúc đang soạn thảo vẫn xem file Word. Cơ chế này tự nhất quán khi bị reject: `clearDraftReviewSnapshot` (line 1779-1785) set `previewFilePath = null` và `sourceLocked = false` ⇒ preview tự quay về `SOURCE_DOCX`.

**Bước 5 — Xác minh quyền truy cập file.** `SecureFileAccessService` có 3 chỗ kiểm tra `"DRAFT"`. Cần xác minh nó cho phép `VIEW_PREVIEW` trên `REVIEW_SNAPSHOT` khi revision còn ở DRAFT.

> **Kết quả xác minh (vòng 2c):** ❌ **Không cho phép.** `evaluateReviewSnapshotRules:325-334` chỉ chấp nhận `PENDING_REVIEW`, `PENDING_APPROVAL`, `PENDING_TRAINING`, `READY_FOR_PUBLISHING`, hoặc DRAFT **kèm** `hasRejectedReviewSnapshot = true`. Đây chính là một trong ba rào cản dẫn tới việc huỷ D-2.

</details>

---

### Q.4 — Kế hoạch thực hiện (Q-B + Q-D)

| Bước | Nội dung | Ước lượng |
|---|---|---|
| 1 | Chốt code Access Profile chuẩn cho DCO (`DCO` / `DOCUMENT_CONTROLLER`) | — |
| 2 | Migration: actor `SUBMIT_FOR_REVIEW` → `ACCESS_PROFILE 'DCO'` + `'DOCUMENT_CONTROLLER'`; tương tự `OPEN_PUBLISHING_WORKSPACE` | 0.5 ngày |
| 3 | Xác minh + siết policy `UPDATE_DRAFT_METADATA` cho phép DCO (D-3) | 0.25 ngày |
| 4 | Notification 2 chiều (Complete Editing → DCO; Cancel → Author) + 2 email template; recipient truy vấn ngược từ policy actor | 1 ngày |
| 5 | `pending-counts`: thêm bộ đếm "chờ submit" cho DCO (lọc `DRAFT + COMPLETED + locked`) + FE hiển thị | 0.5 ngày |
| 6 | Xác minh `cancelRevision` bắt buộc trường lý do; bổ sung nếu thiếu | 0.25 ngày |
| 7 | **F-24:** hợp nhất `resolvePreviewType` và `resolvePreviewObjectType` thành một nguồn sự thật; capability trả `preview.allowed = false` ở Draft kèm reason code. **F-23:** gỡ `GENERATE_REVIEW_SNAPSHOT` khỏi enum/registry/capability/FE | 0.75 ngày |
| 8 | Test | 1 ngày |
| | **Tổng** | **~3.5 ngày** |

> **Không** đụng tới việc sinh snapshot (giữ nguyên ở `submitForReview`), **không** mở preview cho Draft, **không** thêm status, **không** thêm `RETURN_TO_AUTHOR`.

**Tests:**
```
SubmitForReviewActorTest        — Author (không thuộc DCO) → ACTOR_NOT_ALLOWED
                                  DCO → allow
                                  đổi roles.name của DCO → kết quả KHÔNG đổi
SubmitForReviewPreconditionTest — submit khi chưa Complete Editing → từ chối
                                  (chữ ký PREPARED chưa tồn tại)
ActorReconfigurationTest        — đổi actor policy sang Access Profile khác
                                  → quyền submit chuyển theo, KHÔNG sửa code   ◄── chứng minh yêu cầu Q11
DcoMetadataEditTest             — DCO sửa được metadata ở bước chờ submit (D-3)
DcoCancelTest                   — DCO cancel được; lý do bắt buộc; Author nhận notification
NotificationRoutingTest         — recipient lấy từ policy actor, không hard-code
PreviewCapabilityParityTest     — với MỌI trạng thái revision:
                                  capability.preview.allowed == true  ⟺  GET /preview trả 200
                                  ở DRAFT: allowed == false,
                                  reason = PREVIEW_NOT_AVAILABLE_IN_DRAFT        ◄── F-24
GenerateSnapshotActionRemovedTest — capability KHÔNG còn key generateReviewSnapshot  ◄── F-23
```

---

## Trạng thái phê duyệt

| Hạng mục | Trạng thái |
|---|---|
| Phân tích vòng 1 | ✅ Hoàn thành |
| Quyết định nghiệp vụ Q1–Q8 | ✅ Đã chốt |
| Kế hoạch triển khai chi tiết P0–P5 | ✅ Hoàn thành — tài liệu này |
| **Phê duyệt bắt đầu P0** | ⏸️ **Đang chờ** |
| Thay đổi code | ❌ **Chưa có file source nào bị sửa** |
