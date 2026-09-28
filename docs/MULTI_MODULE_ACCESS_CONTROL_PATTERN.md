# Khuôn mẫu Phân quyền Đa Module (RBAC + ReBAC/DAC + ABAC)

> **Đây là tài liệu kiến trúc tham chiếu, không phải code chạy được.** Viết ra để khi có dự án xây dựng backend thật cho Training/CAPA/Deviation/Change Control (hiện các module này **chỉ có Frontend + mock data**, xác nhận qua khảo sát code ngày 2026-07-18 — không có entity/controller/migration nào), đội phát triển có sẵn khuôn mẫu đã được kiểm chứng bởi Document Control, thay vì tự nghĩ lại từ đầu (và tránh lặp lại lỗi "4 file participant-picker trùng lặp" mà Document Control từng mắc phải trước khi được dọn ở tài liệu này).

---

## 1. Bối cảnh — vì sao cần tài liệu này

EQMS quản lý nhiều module nghiệp vụ (Document Control, Training, CAPA, Change Control, Deviation...), mỗi module có:
- Nhiều màn hình thao tác khác nhau.
- Vòng đời/workflow với nhiều trạng thái.
- Nhiều "vai trò theo bản ghi" khác nhau (VD: Document Control có Author/Reviewer/Approver; Training sẽ có Course Owner/Trainer/Trainee; CAPA sẽ có Initiator/Investigator/QA Approver).

Vấn đề cốt lõi cần giải quyết nhất quán ở mọi module: **cùng 1 người dùng có thể giữ vai trò khác nhau trên từng bản ghi khác nhau, thậm chí khác nhau giữa các module** (VD: A là Reviewer của tài liệu này, Author của tài liệu khác; A là Trainer ở khóa học này, Trainee ở khóa khác). Cố nhét toàn bộ logic này vào 1 hệ thống "phân quyền tĩnh" (kiểu chỉ RBAC đơn thuần) là sai hướng — cần phối hợp đúng 3 lớp dưới đây.

Đối chiếu thực tế: mô hình 3 lớp này khớp với cách các eQMS hàng đầu làm — **Veeva Vault QMS** dùng Security Profile + Permission Set (RBAC) kết hợp Dynamic Access Control/DAC (record-level), **MasterControl** cho phép mỗi tài liệu có Reviewer/Approver/Author khác nhau tùy cấu hình workflow. Về học thuật, lớp "vai trò theo bản ghi" có tên chính thức là **ReBAC — Relationship-Based Access Control**.

---

## 2. Ba lớp phân quyền

```
Lớp 1 — Module Capability (RBAC, tĩnh, hiếm đổi)
   "User có được phép làm hành động X trong module Y không, nói chung?"
   Engine: Access Profile → Permission Set → Permission code
   Đã có sẵn, dùng chung cho MỌI module qua module_key trong Permission Catalog.

Lớp 2 — Participant Roster theo bản ghi (ReBAC/DAC, thay đổi liên tục)
   "Trên ĐÚNG bản ghi này, user đóng vai trò gì?"
   Engine: 1 bảng {module}_workflow_participants riêng cho từng module.
   Document Control ĐÃ có (RevisionWorkflowParticipant/DocumentWorkflowParticipant).
   Training/CAPA/... CHƯA có — cần xây theo đúng khuôn mẫu ở Mục 4.

Lớp 3 — Object Access Rule (ABAC, cross-cutting, cấu hình 1 lần)
   "Có bị chặn theo thuộc tính tài nguyên/phòng ban không, bất kể vai trò gì?"
   Engine: Object Access Rule + department/business-unit scope trên Access Profile.
   Đã dùng chung cho mọi module qua Resource Type — không cần sửa gì thêm.
```

Quyết định cho phép 1 hành động = Lớp 1 AND Lớp 2 AND Lớp 3 đều đạt (xem ví dụ truy vết đầy đủ ở Mục 6 dưới).

---

## 3. Lớp 1 — Module Capability: đã module-agnostic sẵn, không cần sửa

Hạ tầng hiện có (`roles`, `permission_sets`, `permission_set_items`, `access_profile_permission_sets`, `access_profile_workflow_roles`, `workflow_roles`) đã trung lập với module — phân biệt bằng `permissions.module_key` và `workflow_roles.module_key`. Khi module mới (Training/CAPA) có backend thật:
1. Thêm permission mới với `module_key` tương ứng (VD `training.course.create`, `training.course.review`, `capa.record.investigate`).
2. Thêm Workflow Role Catalog entries mới (`module_key='training'`: `COURSE_OWNER`, `TRAINER`, `TRAINEE`; `module_key='capa'`: `INITIATOR`, `INVESTIGATOR`, `QA_APPROVER`).
3. Tạo Permission Set + Access Profile như đã làm cho Document Control (xem `PS_UAT_DOCUMENT_CONTRIBUTOR`/`AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY` làm ví dụ mẫu — permission set rộng theo nhóm nghiệp vụ, trừ hành động độc quyền của người điều phối module đó).

Không cần sửa 1 dòng code nào ở Security & Authorization UI hay service — đã xác nhận qua khảo sát: `RoleSetupWizardView`, `AccessProfileDetailView`, `PermissionSetsView` hoàn toàn generic.

---

## 4. Lớp 2 — Participant Roster: khuôn mẫu DB + Backend

### 4.1 Khuôn mẫu bảng DB (lấy `revision_workflow_participants` làm chuẩn)

```sql
CREATE TABLE {module}_workflow_participants (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    {record}_id            UUID NOT NULL REFERENCES {module}_{records}(id),
    user_id                UUID NOT NULL REFERENCES app_users(id),
    participant_type       VARCHAR(40) NOT NULL,  -- vd 'TRAINER','TRAINEE' hoặc 'INITIATOR','INVESTIGATOR','QA_APPROVER'
    sequence_order         INTEGER,
    action_status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    action_comment         TEXT,
    acted_at               TIMESTAMPTZ,
    signature_session_id   UUID,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ví dụ cụ thể cho Training: `training_course_participants(course_id, user_id, participant_type IN ('TRAINER','TRAINEE'), ...)`.
Ví dụ cụ thể cho CAPA: `capa_record_participants(capa_record_id, user_id, participant_type IN ('INITIATOR','INVESTIGATOR','QA_APPROVER'), ...)`.

### 4.2 Khuôn mẫu Authorization Service (lấy `DocumentAuthorizationService`/`RevisionWorkflowAuthorizationService` làm chuẩn)

- Hàm `requirePendingParticipant(record, "TRAINER", currentUser)` — throw nếu currentUser không phải đúng participant loại đó trên đúng bản ghi này (xem `RevisionService.java` cách gọi `requirePendingParticipant` trước mỗi action Review/Approve).
- Hàm `canView{Record}(user, record)` — kết hợp: Object Access Rule (Lớp 3) → bypass nếu `canViewAllRecords` (tương đương DCO của module đó) → participant check (author/tham gia bản ghi) → fallback theo permission "view" nếu bản ghi ở trạng thái công khai (tương đương `EFFECTIVE`).

### 4.3 Engine workflow action đã module-agnostic — chỉ cần khai báo policy mới, không viết engine riêng

Đã xác nhận qua test `WorkflowActionPolicyMultiWorkflowTest` và `ActionStatusMatrix` (có Object Type selector nhiều loại: DOCUMENT/REVISION/CONTROLLED_COPY/CONTROLLED_COPY_BATCH): `WorkflowActionPolicyService`/`LifecycleStatePolicyEvaluator` đã được thiết kế đa workflow/đa object-type sẵn qua các cột `module_key`/`workflow_key`/`object_type` trên bảng `workflow_action_policies`/`lifecycle_state_policies`. Module mới chỉ cần **insert dữ liệu policy mới** (module_key='training', workflow_key='training_course', object_type='TRAINING_COURSE'...), không viết lại engine.

**Lưu ý quan trọng đã phát hiện khi triển khai Document Control:** `WorkflowActionPolicyService.resolvePolicy(...)` chỉ lấy **đúng 1 dòng policy** (ưu tiên theo document-type-specific trước, rồi global) cho mỗi tổ hợp (module, workflow, object_type, action_code, from_status) — **không** cộng dồn nhiều dòng. Nếu cần nhiều actor với permission code khác nhau cho cùng 1 action, phải xử lý ở tầng business logic (service), không thể tạo 2 dòng policy song song cho cùng key.

---

## 5. Lớp Frontend — dùng lại `ParticipantRosterTab`, không viết component participant mới

Component `eqms/src/features/documents/shared/components/ParticipantRosterTab.tsx` (được gộp lại từ 4 file trùng lặp của Document Control ngày 2026-07-18) đã tham số hóa đủ để tái sử dụng cho module khác:

```tsx
<ParticipantRosterTab
  roleLabel="Trainer"                              // hoặc "Investigator", "Approver"...
  permissionCode="training.course.train"           // permission code riêng của module
  participants={trainers}
  onParticipantsChange={setTrainers}
  multiSelect                                       // true = nhiều người (Reviewer/Trainer), false = 1 người (Approver)
  allowRemove
  allowReorder={false}
/>
```

Khi Training/CAPA có backend thật, chỉ cần: (a) thêm permission code mới vào catalog, (b) gọi lại đúng component này trong màn hình Course/CAPA detail, KHÔNG viết `TrainerTab.tsx`/`InvestigatorTab.tsx` riêng từ đầu.

---

## 6. Ví dụ truy vết đầy đủ 1 quyết định (áp dụng công thức cho module bất kỳ)

```
Hỏi: "Trần Thị B có bấm được nút Complete Investigation trên CAPA-0042 không?"

1. Lớp 1: B có permission capa.record.investigate không?
   → Tra Access Profile của B → CÓ (giả sử B có AP_CAPA_CONTRIBUTOR).

2. Lớp 3: Object Access Rule có chặn không?
   → CAPA-0042 thuộc phòng của B → KHÔNG bị chặn.

3. Lớp 2: B có phải Investigator được gán cho ĐÚNG CAPA-0042 này không?
   → Tra bảng capa_record_participants, tìm dòng (capa_record_id=CAPA-0042,
     user_id=B, participant_type='INVESTIGATOR') → CÓ.

=> Cả 3 điều kiện đạt → nút hiện ra và bấm được.
```

Công thức này giữ nguyên bất kể module — chỉ đổi tên bảng/permission code ở bước 1 và 3.

---

## 7. Việc KHÔNG làm trong tài liệu này

- Không tạo entity/controller/migration giả cho Training/CAPA — chưa có dự án backend thật cho các module này.
- Không ép phải xây Training/CAPA ngay — đây chỉ là bản thiết kế tham chiếu để dùng khi dự án đó thực sự bắt đầu.
