# ĐỀ XUẤT TÁI CẤU TRÚC PERMISSION CATALOG

**Trạng thái:** Đề xuất — chờ bạn quyết định, chưa code/migration gì.
**Nguồn dữ liệu:** đối chiếu trực tiếp với DB đang chạy (`permissions`, `workflow_action_policies`, `workflow_action_policy_actors`) ngày lập tài liệu, không phải suy đoán từ code Java (vì đã phát hiện code Java có thể lệch so với DB thật — xem Mục 0).

---

## 0. Phát hiện quan trọng — LỆCH DỮ LIỆU chưa xử lý (không tự ý sửa, chờ bạn quyết định ưu tiên)

Trong lúc đối chiếu để viết đề xuất này, phát hiện thêm 3 điểm mà DB thật đang **khác** với những gì snapshot mặc định trong Java (`WorkflowActionDefaultPolicyRegistry`) mô tả — cùng loại lỗi đã sửa ở T-P1-3 (SUBMIT_FOR_REVIEW) và vừa phát hiện ở COMPLETE_TRAINING:

| Action | required_permission_code hiện tại trên DB | Java registry nói là | Vấn đề |
|---|---|---|---|
| `GENERATE_REVIEW_SNAPSHOT` (DRAFT) | `documents.revision.submit_review` | `documents.revision.generate_preview` | Đang gộp nhầm vào quyền Submit for Review — nhưng action này đằng nào cũng là action "ma" (không có endpoint thật, T-P1-6 đề xuất gỡ hẳn) |
| `REGENERATE_SNAPSHOT` (DRAFT) | `documents.revision.submit_review` | `documents.revision.generate_preview` | Action **có thật** (`/regenerate-snapshot`), nhưng đang bị gán nhầm quyền Submit for Review thay vì quyền tạo preview riêng |
| `DOCUMENT_REVISION / CANCEL` (DRAFT) | `documents.workspace.manage` | `documents.revision.cancel` | Actor thực tế trên DB **chỉ có** `PERMISSION:documents.workspace.manage` — thiếu hẳn `AUTHOR`, `CO_AUTHOR` mà plan (quyết định D-4) khẳng định "đã đúng sẵn sau V288". Nếu đúng vậy, **Author hiện tại không tự huỷ được bản nháp của chính mình**, chỉ người có `documents.workspace.manage` mới huỷ được. |

Dòng cuối cùng (`CANCEL`) là điểm đáng lo nhất vì trái ngược trực tiếp với quyết định D-4 đã chốt trong kế hoạch. Tôi **chưa sửa gì** — cần bạn xác nhận đây có phải hành vi bạn muốn không trước khi động vào, vì đụng đúng luồng Author huỷ bản nháp.

---

## 1. Nguyên tắc đặt tên đề xuất

Giữ format hiện có `{module}.{resource}.{action}` nhưng áp chặt hơn 3 quy tắc:

1. **Một code = một hành vi nghiệp vụ duy nhất.** Không dùng một code để gác nhiều action không liên quan (bài học từ `documents.workspace.manage`).
2. **Tên action trong code phải khớp `action_code` trong `workflow_action_policies`** khi có thể, để nhìn code là đoán được action, không cần tra bảng.
3. **`documents.workspace.manage` giữ vai trò "quyền vượt cấp của Document Control"** — actor override cho các action đã có permission riêng, KHÔNG dùng làm required-permission chính cho action mới.

---

## 2. Module `documents` — chi tiết theo từng action

### 2.1 Document Master (bản gốc tài liệu, chưa có revision)

| Code hiện tại | Đề xuất | Ai được dùng (actor) | Khi nào (status) | Mô tả |
|---|---|---|---|---|
| `documents.document.view` | *giữ nguyên* | mọi user có `documents.module.view` + thoả điều kiện visibility | Mọi trạng thái | Xem thông tin tài liệu gốc |
| `documents.document.view_all` | *giữ nguyên* | DCO/Admin (`view_all`) | Mọi trạng thái | Xem toàn bộ tài liệu bất kể participant/BU/Dept — chỉ đọc |
| `documents.document.view_audit` | *giữ nguyên* | tuỳ cấu hình | — | Xem audit trail của tài liệu |
| `documents.document.create` | *giữ nguyên* | user có quyền tạo | — | Tạo tài liệu mới (document shell) |
| `documents.document.update_metadata` | *giữ nguyên (mới, V347)* | `PERMISSION` (đang là chính nó) | DRAFT | Sửa metadata tài liệu qua workflow action `UPDATE_METADATA` |
| `documents.document.edit_metadata` | ⚠️ **cân nhắc hợp nhất hoặc đổi tên rõ hơn** — hiện dùng cho việc sửa **review cycle / ngày review-hiệu lực** ở `DocumentService`, KHÔNG đi qua `workflow_action_policies` | permission-only, kiểm tra thẳng trong `DocumentAuthorizationService`/`DocumentService` | Khi đổi `reviewDateChanged` | **Đây là 1 code khác `update_metadata` ở trên**, dễ nhầm vì tên gần giống nhau. Đề xuất đổi thành `documents.document.manage_review_cycle` để tách bạch rõ với `update_metadata` |
| `documents.document.cancel` | *giữ nguyên* | `PERMISSION:documents.workspace.manage` (actor) | DRAFT | Huỷ tài liệu gốc |
| `documents.document.obsolete` | *giữ nguyên* | required = `documents.workspace.manage` (chưa tách, xem ghi chú actor-override Mục 3) | ACTIVE | Làm hết hiệu lực tài liệu |
| `documents.document.reopen` | *giữ nguyên* | `PERMISSION:documents.document.reopen` (đã granular) | CLOSED_CANCELLED | Mở lại tài liệu đã huỷ — hành động ngoại lệ, nên giữ tách riêng |

### 2.2 Document Revision — vòng đời bản sửa đổi

| Code hiện tại | Đề xuất | Ai (actor thật trên DB) | Khi nào | Mô tả |
|---|---|---|---|---|
| `documents.revision.upload_source` | *giữ nguyên* | `AUTHOR` | DRAFT | Author tải lên/thay file nguồn |
| `documents.revision.complete_authoring` | *giữ nguyên* | `AUTHOR` | DRAFT | Author xác nhận hoàn tất soạn thảo (Complete Editing) |
| `documents.revision.update_draft_metadata` | *giữ nguyên (mới, V347)* | `PERMISSION` chính nó | DRAFT | Sửa metadata bản nháp |
| `documents.revision.submit_review` | *giữ nguyên (mới, V347)* | `ACCESS_PROFILE: DCO, DOCUMENT_CONTROLLER` | DRAFT | DCO đẩy bản nháp sang Review — **⚠️ đang bị GENERATE_REVIEW_SNAPSHOT/REGENERATE_SNAPSHOT mượn nhầm, xem Mục 0** |
| `documents.revision.generate_preview` | **khôi phục dùng cho REGENERATE_SNAPSHOT** (hiện bị lệch sang submit_review — Mục 0) | đề xuất actor: `PERMISSION:documents.workspace.manage` (override) | DRAFT | Sinh lại bản xem trước PDF |
| `documents.revision.open_publishing_workspace` | *giữ nguyên (mới, V347)* | `ACCESS_PROFILE: DCO, DOCUMENT_CONTROLLER` | READY_FOR_PUBLISHING | Mở không gian chuẩn bị xuất bản |
| `documents.revision.review` | *giữ nguyên* | `ASSIGNED_REVIEWER` | PENDING_REVIEW | Hoàn tất review (đúng theo thứ tự sequence) |
| `documents.revision.reject_review` | *giữ nguyên* | `ASSIGNED_REVIEWER` | PENDING_REVIEW | Từ chối ở bước review |
| `documents.revision.approve` | *giữ nguyên* | `ASSIGNED_APPROVER` | PENDING_APPROVAL | Hoàn tất phê duyệt |
| `documents.revision.reject_approval` | *giữ nguyên* | `ASSIGNED_APPROVER` | PENDING_APPROVAL | Từ chối ở bước phê duyệt |
| — (COMPLETE_TRAINING không có required permission, chỉ actor OR) | đề xuất tạo `documents.revision.complete_training` **thật sự dùng** (thay vì OR 3 permission có sẵn) | 3 permission hiện tại: `documents.training.complete`, `documents.training.manage`, `training.material.manage` | PENDING_TRAINING | Xác nhận hoàn tất đào tạo cho revision — hiện không có permission riêng, ai có 1-trong-3 permission Training chung là làm được, không tách theo revision-context |
| `documents.revision.publish` | *giữ nguyên* | `PERMISSION:documents.workspace.manage` (chưa tách — xem Mục 3) | READY_FOR_PUBLISHING | Xuất bản chính thức |
| `documents.revision.cancel` | ⚠️ **required_permission_code hiện KHÔNG dùng code này** (DB đang dùng `documents.workspace.manage` — Mục 0) | đề xuất khôi phục dùng đúng code này + actor `AUTHOR, CO_AUTHOR, PERMISSION:documents.workspace.manage` | DRAFT | Huỷ bản nháp |
| `documents.revision.upgrade` | *giữ nguyên* | `AUTHOR, PERMISSION:documents.workspace.manage` | EFFECTIVE | Tạo bản nâng cấp mới từ bản hiệu lực |
| `documents.revision.obsolete` | *giữ nguyên* | `PERMISSION:documents.workspace.manage` (chưa tách) | EFFECTIVE | Làm hết hiệu lực 1 revision cụ thể |
| `documents.revision.preview` / `documents.revision.download_source` / `documents.revision.edit_online` / `documents.revision.upload_office_online` | *giữ nguyên* | theo permission trực tiếp | — | Nhóm thao tác file — chưa thấy dấu hiệu gộp quyền, tạm ổn |
| `documents.revision.configure_next_reviewers/approvers/related_documents/correlated_documents` | *giữ nguyên* | — | — | Cấu hình cho bản nâng cấp kế tiếp — đã tách theo từng loại, tốt |

### 2.3 Controlled Copy (bản sao kiểm soát)

Nhóm này **đã khá granular** (13 permission riêng theo action) — chỉ 1 vấn đề: `documents.workspace.manage` vẫn là actor OR cho gần như toàn bộ 13 action (bên cạnh permission riêng đã có), nghĩa là ai có `workspace.manage` coi như có quyền admin toàn bộ Controlled Copy. Đề xuất: **giữ nguyên** nếu bạn muốn DCO có quyền vượt cấp toàn diện; nếu muốn siết chặt hơn — bỏ `workspace.manage` khỏi actor list của từng action Controlled Copy, chỉ giữ permission riêng.

---

## 3. Về `documents.workspace.manage` — quyền "vượt cấp" còn lại

Sau V347, code này vẫn là **required_permission_code chính** (chưa tách) cho:
- `DOCUMENT / OBSOLETE`
- `DOCUMENT_REVISION / PUBLISH`
- `DOCUMENT_REVISION / OBSOLETE`
- (và lệch dữ liệu ở `CANCEL`, xem Mục 0)

Và là **actor override** (bên cạnh permission riêng) cho gần như toàn bộ Controlled Copy + `UPGRADE_REVISION`.

**3 lựa chọn cho bạn quyết định:**
1. **Giữ nguyên** — coi đây là quyền "Document Control toàn diện", có ý nghĩa như 1 vai trò tổng quát cho DCO. Đơn giản, ít việc phải làm, nhưng vẫn còn 3 action gộp trong 1 permission.
2. **Tách tiếp** thành `documents.document.obsolete_workflow` (đã có `documents.document.obsolete` riêng — có thể dùng lại), `documents.revision.publish_workflow`, `documents.revision.obsolete_workflow` — 3 permission độc lập, xoá `workspace.manage` khỏi required (giống cách đã làm ở V347).
3. **Đổi hướng thiết kế**: biến `documents.workspace.manage` thành **actor-only** (không bao giờ dùng làm required permission), mỗi action bắt buộc có permission riêng của chính nó làm required, `workspace.manage` chỉ đóng vai trò actor override toàn cục cho DCO.

---

## 4. Các module khác — bảng rút gọn (chưa đi sâu vì không phải trọng tâm hiện tại)

| Module | Vấn đề đã biết | Đề xuất |
|---|---|---|
| `audit-trail` | `audit.view` và `audittrail.module.view` trùng chức năng | Hợp nhất, deactivate 1 trong 2 (theo T-P2-2/2-3 của kế hoạch cũ) |
| `settings` (nhóm `users.*_external`) | 6 permission (`invite_external`, `resend_external_invitation`, `retry_external_provisioning`, `view_external_provisioning`, `disable_microsoft_access`, `remove_external_identity`) — chưa xác minh có đang được enforce ở đâu | Cần kiểm tra riêng — nghi ORPHAN (F-16) |
| `training` | `training.assignment.manage`, `training.session.manage` orphan (chưa gắn action nào vì module Training chưa có backend thật — Phase P4) | Giữ nguyên, chờ Phase P4 xây dựng thật rồi thiết kế lại theo catalog chi tiết đã có sẵn trong kế hoạch (`training.course.*`, `training.assignment.*`, v.v.) |
| `security-authorization`, `system-admin`, `app-settings` | Đã khá granular theo `{resource}.{view/manage}`, chưa thấy dấu hiệu gộp quá mức | Không đề xuất đổi |
| `work_management`, `dashboard`, `notifications`, `preferences`, `reports`, `help-support` | Module phụ, số lượng permission ít (2-5 mỗi module), đã đủ rõ ràng | Không đề xuất đổi |

---

## 5. Việc cần bạn quyết định

1. **Mục 0** — 3 điểm lệch dữ liệu: sửa ngay hay để sau? Riêng dòng `CANCEL` (Author không tự huỷ được bản nháp) nên ưu tiên cao vì trái quyết định D-4 đã chốt.
2. **`documents.document.edit_metadata` vs `update_metadata`** — đổi tên `edit_metadata` thành `manage_review_cycle` cho rõ nghĩa, hay giữ nguyên?
3. **`documents.workspace.manage`** — chọn 1 trong 3 hướng ở Mục 3, hay giữ nguyên như hiện tại?
4. Có muốn tôi làm tiếp phần **actor** (không chỉ permission) — ví dụ tách `ASSIGNED_REVIEWER`/`ASSIGNED_APPROVER` chi tiết hơn theo loại tài liệu, hay giữ nguyên mô hình hiện tại?

Tôi dừng ở đề xuất, không tự sửa code/migration cho tới khi bạn chốt.
