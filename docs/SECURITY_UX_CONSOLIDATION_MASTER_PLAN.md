# Kế hoạch tổng thể: Hợp nhất Quản lý Vai trò và Phân quyền

**Trạng thái:** Kế hoạch đã được review và điều chỉnh an toàn cho triển khai.  
**Phạm vi:** `eqms/src/features/security-authorization/`, API Security và các bảng phân quyền hiện hữu.  
**Mục tiêu:** đơn giản hóa trải nghiệm quản trị quyền mà không thay đổi security engine, không làm suy giảm audit trail, electronic signature, SoD hoặc kiểm soát truy cập runtime.

---

## 1. Vấn đề cần giải quyết

Kiến trúc runtime hiện hữu là đúng hướng: Access Profile -> Permission Set -> Permission, kết hợp với workflow/lifecycle policy, object access và participant. Tuy nhiên giao diện quản trị đang bị phân mảnh:

1. Tạo một role hoàn chỉnh phải qua nhiều màn hình và nhiều bước ký.
2. Cấu hình workflow nằm ở nhiều nơi nên admin khó biết quyền nào điều khiển nút nào.
3. Một số màn hình dùng `DualPanel` không phù hợp trên mobile; trải nghiệm chọn quyền chưa đồng nhất.
4. Chưa có công cụ chẩn đoán an toàn để trả lời vì sao user không thao tác được trên một record.
5. Một phần user vẫn còn dùng legacy fallback `role_name -> role_permissions`.

Nguyên tắc thiết kế:

```text
Role trả lời: người giữ role có năng lực gì?
Workflow Security trả lời: năng lực đó được dùng ở trạng thái nào?
Object Access trả lời: user được truy cập record nào?
SoD trả lời: user có bị xung đột trách nhiệm không?
```

Không viết lại permission engine. UI mới phải gọi các evaluator runtime hiện tại và backend vẫn là nơi ra quyết định cuối cùng.

---

## 2. Kiến trúc giữ nguyên

```text
UserAccount
  -> user_access_profiles
    -> roles (Access Profile)
      -> access_profile_permission_sets
        -> permission_sets
          -> permission_set_items
            -> permissions
      -> access_profile_workflow_roles
        -> workflow_roles
```

Các evaluator vẫn giữ nguyên trách nhiệm:

| Lớp | Nguồn dữ liệu | Mục đích |
|---|---|---|
| Effective permission | Access Profile, Permission Set, Permission | Kiểm tra user có Permission hay không |
| Workflow action policy | `workflow_action_policies` + actors | Kiểm tra action chuyển trạng thái |
| Lifecycle state policy | `lifecycle_state_policies` | Kiểm tra view/preview/download/capability theo status |
| Object access | `object_access_rules` | Lọc record theo Department, Business Unit, document type, ownership hoặc participant |
| SoD | `sod_constraints` và Document Workflow Rules | Ngăn xung đột trách nhiệm |

Quyết định runtime cuối cùng luôn là:

```text
Có Permission
AND đúng Workflow/Lifecycle Policy
AND đúng actor/participant trên record
AND được Object Access Rule cho phép
AND không vi phạm SoD
```

---

## 3. Thiết kế UX đích

### 3.1. Sidebar

Giữ nguyên route hiện tại để không phá bookmark, route guard hoặc link từ audit trail. Chỉ đổi nhãn và tổ chức menu:

```text
Security & Authorization
├─ User Management
├─ Roles & Permissions                 -> /security/access-profiles
├─ Workflow Security                   -> /security/lifecycle-policies
├─ Access Review                       -> /security/access-review
└─ Advanced
   ├─ Shared Permission Sets           -> /security/permission-sets
   ├─ Object Access Rules              -> /security/object-rules
   └─ SoD Constraints                  -> /security/sod
```

`E-Sign Config` giữ route và permission hiện tại; có thể để trong Advanced hoặc System Administration theo cấu trúc sidebar đang dùng, nhưng không ẩn khỏi user có `settings.configuration.view`.

### 3.2. Roles & Permissions

Đổi nhãn từ Access Profiles thành **Roles & Permissions**. Detail role có các tab:

```text
General | Permissions | Users | Workflow | Shared Sets (Advanced) | Object Access | Audit Trail
```

#### Tab Permissions

- Dùng `PermissionSplitExplorer` làm component duy nhất để chọn Permission.
- Hiển thị counter `selected/total` theo từng module.
- Quyền được cấp trực tiếp bởi role nằm trong auto-managed set `ROLE_<profileCode>`.
- Quyền đến từ Shared Permission Set hiển thị checked + locked, tooltip nêu rõ tên Shared Set.
- Không hiển thị trạng thái workflow ở tab này; tab chỉ trả lời năng lực của role.
- Profile system và `SYSTEM_SUPER_ADMIN` luôn read-only.
- Tab phải hiển thị nguồn của từng Permission: `Direct role permission` hoặc `Granted by <Shared Set>`.

#### Tab Shared Sets (Advanced)

- Chỉ dùng để gán/bỏ gán Permission Set dùng chung.
- Thay `DualPanel` bằng danh sách một cột: search, số lượng đã chọn, checkbox card, preview drawer và confirm khi remove.
- Auto-managed set không xuất hiện ở đây, nhưng vẫn phải hiển thị được trong tab Permissions và audit/export.

#### Tab Users, Workflow, Object Access, Audit Trail

- Giữ logic hiện có.
- Tab Users quản lý user được gán role.
- Tab Workflow quản lý Workflow Role như `DCO`, `DOCUMENT_REVIEWER`, `DOCUMENT_APPROVER`.
- Tab Object Access chỉ hiển thị rule ảnh hưởng role; chỉnh sửa rule vẫn thực hiện trong Advanced -> Object Access Rules.
- Audit Trail hiển thị mọi thay đổi role, permission trực tiếp, shared set, workflow role và user assignment.

### 3.3. New Role Wizard

Wizard là cửa tạo role chính:

```text
Basic Info -> Permissions -> Workflow Role -> Scope -> Users -> Review & Create
```

- Permissions cho chọn Shared Set hoặc Permission riêng.
- Users là tùy chọn; SoD BLOCK tại bất kỳ user nào phải rollback toàn bộ thao tác.
- Submit dùng đúng một request atomic và đúng một electronic signature.
- Sau create, điều hướng đến Detail Role để admin kiểm tra Permissions, Users, Workflow và Audit Trail.

Vẫn giữ route tạo role thông thường cho backward compatibility trong Phase 0; sau khi UAT pass mới chuyển nút chính sang Wizard và chuyển form cũ thành redirect/legacy route có thông báo.

### 3.4. Workflow Security

Gom các màn hình workflow thành một entry point, nhưng không trộn dữ liệu của object type khác nhau:

```text
Workflow Security
  Filter bắt buộc: Module -> Workflow -> Object Type -> Document Type (nếu áp dụng)
  Tabs: Actions | States | Workflow Roles | Document Rules
```

- **Actions:** ma trận Action x From Status, pivot từ `workflow_action_policies`.
- **States:** capability view/preview/download từ `lifecycle_state_policies`.
- **Workflow Roles:** catalog Workflow Role và role nào đang được gán.
- **Document Rules:** các Document Workflow Rules đang nằm trong SoD view.

Mỗi ô ma trận phải hiển thị policy thắng cuối cùng: required permission, actor list, document type override, priority, active/system. Không chỉ hiển thị dấu check.

Không hiển thị Revision và Controlled Copy trên cùng một ma trận. User phải chọn `objectType` trước; status list và action list được nạp theo object type đó.

---

## 4. API và Backend

### 4.1. Endpoint atomic create role đã có

`POST /security/access-profiles/full` tiếp tục là endpoint tạo role từ Wizard.

Request bao gồm:

```json
{
  "name": "QA Reviewer",
  "description": "Reviews assigned documents",
  "active": true,
  "businessUnitScope": "Quality",
  "departmentScope": "Quality Assurance",
  "permissionCodes": ["documents.revision.review"],
  "permissionSetIds": ["..."],
  "workflowRoles": ["DOCUMENT_REVIEWER"],
  "userIds": ["..."],
  "signatureToken": "...",
  "reason": "Create approved QA reviewer role"
}
```

Yêu cầu bắt buộc:

- Một `@Transactional` cho toàn bộ create role, auto-managed set, shared-set link, workflow-role link, user assignment, audit và e-sign.
- Thất bại ở bất cứ bước nào phải rollback sạch.
- SoD BLOCK, duplicate code/name, unknown permission và self-grant critical phải chặn trước commit.
- Ghi đúng một security signature và một audit event tổng hợp, có payload thay đổi chi tiết.

### 4.2. Endpoint aggregate cho sửa Role: bắt buộc bổ sung

Không dùng nhiều endpoint mutation khi admin bấm một nút **Save**. Thay vào đó, bổ sung:

```text
PUT /security/access-profiles/{id}/configuration
```

Request bao gồm version hiện tại và toàn bộ state role:

```json
{
  "version": 12,
  "general": {
    "name": "QA Reviewer",
    "description": "...",
    "active": true,
    "businessUnitScope": "Quality",
    "departmentScope": "Quality Assurance"
  },
  "managedPermissionCodes": ["documents.revision.review"],
  "sharedPermissionSetIds": ["..."],
  "workflowRoles": ["DOCUMENT_REVIEWER"],
  "userIds": ["..."],
  "signatureToken": "...",
  "reason": "Add document review capability"
}
```

Backend phải:

1. Yêu cầu quyền quản trị role và kiểm tra e-sign token.
2. Kiểm tra profile không phải system/super-admin.
3. Kiểm tra `version`; nếu khác version hiện tại, trả `409 ROLE_CONFIGURATION_CHANGED` và không thay đổi gì.
4. Tính diff server-side: general, direct permissions, shared sets, workflow roles, users.
5. Kiểm tra SoD cho toàn bộ user đích và ngăn self-grant quyền critical.
6. Cập nhật toàn bộ trong một transaction.
7. Ghi một security signature và một audit event tổng hợp; audit payload phải chứa before/after theo từng nhóm thay đổi.
8. Clear permission cache sau commit.

Endpoint `POST /managed-permissions` có thể giữ tạm cho compatibility/API cũ, nhưng Detail Role mới không được gọi endpoint này cùng với các mutation khác trong một Save.

### 4.3. Auto-managed Permission Set

- Code: `ROLE_<profileCode>`.
- Name: `"<Profile name> Permissions"`.
- Chỉ chứa direct permissions của role.
- Shared Permission Set là nguồn độc lập, không được copy permission vào auto-set.
- Auto-set ẩn khỏi danh sách Shared Permission Sets mặc định nhưng phải có mặt trong Detail Role, Audit Trail, export và endpoint `includeManaged=true`.
- Xóa role: chỉ xóa auto-set nếu không còn profile nào tham chiếu.
- Đổi tên role: giữ code auto-set ổn định. Backend phải đồng bộ `app_users.role_name` của user mà role này là System Role hiển thị chính, hoặc chuyển UI/DB sang lưu `primary_access_profile_id` trước khi cho phép rename. Không để dropdown/System Role hiển thị tên cũ.

### 4.4. Effective Access Diagnosis: endpoint mới, có kiểm soát

Không mở rộng endpoint profile-level hiện tại bằng cách nhận tùy ý `userId`. Tạo endpoint riêng:

```text
POST /security/effective-access/diagnose
```

Request:

```json
{
  "subjectUserId": "...",
  "resourceType": "DOCUMENT_REVISION",
  "resourceId": "...",
  "actionCode": "COMPLETE_APPROVAL"
}
```

Quy tắc bảo mật:

1. Caller phải có Permission mới `security.effective_access.diagnose`.
2. Caller phải có quyền xem subject user theo User Management policy.
3. Caller phải được Object Access evaluator cho phép xem resource; không được suy luận participant, status hoặc document name của tài liệu không có quyền xem.
4. Response chỉ trả các lớp cần thiết: Permission, State Policy, Actor/Participant, Object Access, SoD; không trả raw permission set hoặc danh sách participant ngoài phạm vi cần thiết.
5. Ghi audit event `EFFECTIVE_ACCESS_DIAGNOSED`: caller, subject, resource type/id, action, kết quả; không ghi password/token/nội dung file.
6. Nếu không được xem resource, trả `403` chung, không trả reason chi tiết để tránh disclosure.

Response hợp lệ:

```json
{
  "allowed": false,
  "decisions": [
    {"layer": "PERMISSION", "passed": true, "reasonCode": "GRANTED"},
    {"layer": "STATE_POLICY", "passed": true, "reasonCode": "POLICY_MATCHED"},
    {"layer": "ACTOR", "passed": false, "reasonCode": "NOT_ASSIGNED_APPROVER"}
  ]
}
```

### 4.5. Workflow matrix

Ưu tiên frontend pivot từ API policy hiện có, chỉ bổ sung endpoint nếu pagination/filter hiện tại không đủ.

Filter bắt buộc của query/matrix:

- `moduleKey`
- `workflowKey`
- `objectType`
- `documentTypeId` khi workflow hỗ trợ override theo Document Type

Nếu dữ liệu đầu vào thay đổi trong lúc mở drawer edit, Save phải dùng version/updatedAt của policy và trả `409` khi stale.

---

## 5. Kế hoạch frontend

### Phase 0: Role = một màn hình

1. Tạo `AccessProfilePermissionsTab.tsx`.
   - Load Permission Catalog, profile detail và managed/shared set với `includeManaged=true`.
   - Tách auto-set bằng `ROLE_<profile.code>`.
   - `lockedCodes` là union của shared sets.
   - `selectedCodes = lockedCodes ∪ directManagedCodes`.
   - Hiển thị tooltip nguồn quyền và counter theo module.
   - Chỉ sửa `directManagedCodes` trong UI.
2. Đăng ký tab **Permissions** ngay sau General trong `AccessProfileDetailView.tsx`.
3. Đổi tab Permission Sets hiện tại thành **Shared Sets (Advanced)** và thay `DualPanel` bằng danh sách responsive một cột.
4. Đưa General, Permissions, Shared Sets, Workflow và Users vào một `configuration draft` duy nhất.
5. Khi bấm Save, gọi duy nhất `PUT /configuration`; xử lý `409` bằng modal: “Cấu hình đã được người khác thay đổi. Tải lại để xem thay đổi mới.”
6. Đổi nhãn sidebar `Access Profiles` -> `Roles & Permissions`, `Permission Sets` -> `Shared Permission Sets`.
7. Giữ breadcrumb/route cũ; breadcrumb mới phản ánh nhãn mới.

`PermissionSetFormView.tsx` hiện đã dùng `PermissionSplitExplorer`; không thực hiện lại hạng mục chuyển đổi này. Chỉ kiểm tra contract và responsive regression.

### Phase 1: Workflow Security

1. Tạo `WorkflowSecurityView.tsx` tại `lifecycle-policies/views`.
2. Wrapper các view hiện có qua tab Actions, States, Workflow Roles, Document Rules; không copy business logic evaluator.
3. Route cũ redirect về tab tương ứng để giữ bookmark.
4. Thêm `EffectiveAccessDiagnosisPanel`, chỉ hiển thị khi caller có `security.effective_access.diagnose`.
5. Thêm `ActionStatusMatrix`, bắt buộc chọn object type trước khi render.
6. Chuyển `DocumentWorkflowRulesPanel` từ SoD sang tab Document Rules; SoD chỉ còn Constraint Rules.

### Quy tắc UI dùng chung

| Quy tắc | Áp dụng |
|---|---|
| Một component chọn Permission | `PermissionSplitExplorer` |
| Không dùng DualPanel trong màn hình mới | Search + badge + card list responsive |
| Một thao tác Save | Một request aggregate, một transaction, một e-signature |
| Mobile first | Không tràn ngang ở 375px; module picker chuyển cách chọn phù hợp dưới `md:` |
| Trạng thái hệ thống | System/Super Admin read-only, lý do rõ ràng |
| Nguồn quyền | Luôn hiển thị direct/shared để admin không hiểu sai |

---

## 6. Migration legacy fallback

Không tắt `app.security.legacy-role-fallback-enabled` chỉ vì UI đã ổn định. Thực hiện theo bốn bước có kiểm chứng.

### 6.1. Preflight report

Tạo báo cáo chỉ đọc, xuất được CSV, gồm:

| Nhóm | Điều kiện | Hành động |
|---|---|---|
| Mappable | `role_name` khớp chính xác một active Access Profile | Có thể backfill |
| Missing profile | Không có profile cùng tên | Tạo/sửa mapping thủ công |
| Inactive profile | Profile khớp nhưng inactive | Quyết định activate hoặc remap |
| Ambiguous | Nhiều profile/tên trùng theo legacy normalization | Xử lý thủ công |
| Existing assignments | User đã có Access Profile | So sánh effective permissions trước/sau |
| Super admin | User legacy super admin | Xử lý theo quy trình đặc biệt, không auto-map |

Preflight phải ghi snapshot effective permission trước migration để đối chiếu sau migration.

### 6.2. Migration idempotent

1. Viết Flyway data migration hoặc admin command có transaction theo batch nhỏ.
2. Chỉ insert `user_access_profiles` khi chưa tồn tại.
3. Không xóa `role_name` trong phase này.
4. Ghi audit event cho từng user và migration summary.
5. Những user exception không được tự ý map sang role gần đúng.

### 6.3. Postflight và go/no-go

Chỉ cho phép tắt fallback khi tất cả điều kiện đạt:

- `0` user legacy unresolved.
- `0` user có chênh lệch effective permission ngoài danh sách ngoại lệ đã phê duyệt.
- Test đăng nhập/menu/action cho sample đại diện mọi module đã enforce.
- Access Review phê duyệt danh sách assignment sau migration.
- Backup database và hướng dẫn rollback đã được xác nhận.

### 6.4. Cutover và rollback

1. Tắt fallback bằng feature flag theo môi trường trước, không hard-code.
2. Theo dõi 24-72 giờ với log `no access profile`, 403 rate, login failure, menu missing.
3. Nếu có incident, bật lại flag ngay; không rollback/xóa dữ liệu assignment mới.
4. Mở change record, phân tích user exception, chạy migration bổ sung rồi mới thực hiện cutover lại.

---

## 7. Liên kết với module khác

| Module | Chính sách |
|---|---|
| Documents | Module chuẩn tham chiếu; mọi Permission trong role editor phải có backend gate thực và UI trigger thực |
| Controlled Copies | Hiển thị trong Workflow Security với object type riêng, không trộn Revision |
| Training | Giữ evaluator hiện tại; chỉ hiển thị Permission trong catalog khi gate đã tồn tại |
| CAPA, Deviations, Change Control, Complaints, Equipment, Supplier, Risk, Regulatory, Product | Catalog có thể hiển thị động, nhưng không được coi “đã hoàn thành phân quyền” cho đến khi có backend enforcement và UI trigger |
| User Management | System Role phải luôn ánh xạ nhất quán tới Access Profile; rename role không được làm stale `role_name` |
| Audit Trail | Tất cả mutation và diagnosis query phải có audit event phù hợp |

---

## 8. Verification bắt buộc

### 8.1. Backend unit/integration test

- [ ] Wizard create role tạo role, auto-set, shared set, workflow role, user assignment trong một transaction.
- [ ] SoD BLOCK ở user thứ N rollback sạch; không có role/set/link/audit/signature dang dở.
- [ ] Một `PUT /configuration` tạo đúng một security signature và một audit event tổng hợp.
- [ ] `PUT /configuration` trả `409` khi version stale, không thay đổi dữ liệu.
- [ ] Self-grant permission critical bị chặn cả qua direct permission và shared set.
- [ ] System profile và super-admin profile không sửa được.
- [ ] Auto-set chỉ bị xóa khi không còn reference.
- [ ] Effective diagnosis từ chối caller không có permission, không xem được subject user hoặc resource.
- [ ] Effective diagnosis không tiết lộ participant/status của resource không được phép xem.
- [ ] Migration preflight phân loại đúng mọi user; migration idempotent; fallback-off chỉ pass khi không còn unresolved user.

### 8.2. Frontend test

- [ ] Tab Permissions hiển thị direct/shared source đúng.
- [ ] Permission từ Shared Set checked + locked; direct permission vẫn có thể toggle.
- [ ] Save role dùng một request aggregate.
- [ ] Conflict 409 hiển thị rõ và không làm mất draft âm thầm.
- [ ] Shared Sets, Users, Workflow responsive tại 375px và 768px, không tràn ngang.
- [ ] Breadcrumb/sidebar mới đúng nhãn nhưng route cũ vẫn hoạt động.
- [ ] Workflow matrix không render trước khi chọn object type.
- [ ] Diagnosis panel không hiển thị với user không có permission diagnose.

### 8.3. UAT thủ công

1. Tạo role bằng Wizard: direct permissions từ ba module, một Workflow Role, một user; một e-signature.
2. Mở Detail Role: counter đúng, nguồn Permission đúng, auto-set không xuất hiện trong Shared Sets.
3. Sửa đồng thời bằng hai admin: admin thứ hai Save trước; admin thứ nhất nhận 409 và không ghi đè.
4. Dùng diagnosis cho assigned approver và non-approver trên một revision `PENDING_APPROVAL`; reason đúng theo evaluator thật.
5. Dùng diagnosis với tài liệu không có quyền xem; nhận 403 chung, không lộ tên/participant.
6. Chạy migration dry-run, xử lý exception, chạy migration, đối chiếu quyền trước/sau, tắt fallback trên staging trước production.

---

## 9. Lộ trình triển khai

| Phase | Nội dung | Điều kiện hoàn tất |
|---|---|---|
| 0A | Hoàn thiện UI Role/Permissions và Shared Sets | Không thay đổi behavior runtime; responsive pass |
| 0B | Thêm endpoint aggregate + optimistic concurrency | Một Save = một transaction/signature/audit; tests pass |
| 0C | Hoàn thiện Wizard và audit provenance | Atomic create/UAT SoD pass |
| 1A | Workflow Security wrapper + object-type-safe matrix | Route cũ hoạt động; matrix policy thắng đúng |
| 1B | Effective diagnosis có authorization/audit | Không lộ dữ liệu trái quyền; UAT pass |
| 2 | Enforcement thực cho từng module ngoài Documents | Chỉ thêm catalog khi có backend gate và UI trigger |
| 3A | Preflight/backfill legacy | Không còn unresolved user |
| 3B | Tắt fallback theo feature flag | Staging soak pass, rollback runbook sẵn sàng |

**Không làm trước khi hoàn thành các phase trên:** viết lại authorization engine, thêm ACL field-level diện rộng, tắt legacy fallback không có reconciliation report, hoặc thay đổi workflow system policy hàng loạt.
