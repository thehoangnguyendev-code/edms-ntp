# Playbook Phân Quyền — Áp Dụng Cho Mọi Module

> Mục đích: mỗi khi thêm 1 màn hình/button/module mới, dùng tài liệu này để xác định cách phân quyền mà không cần nghĩ lại kiến trúc từ đầu. Không phải đặc tả kỹ thuật — là công cụ tư duy (checklist) cho người thiết kế nghiệp vụ.

---

## 1. Nguyên lý gốc: tách 2 câu hỏi khác nhau

Mọi nhầm lẫn về phân quyền trong hệ thống này đều bắt nguồn từ việc gộp chung 2 câu hỏi vốn khác nhau:

| Câu hỏi | Ý nghĩa | Trả lời bằng |
|---|---|---|
| **(A) Năng lực** | "User này có được PHÉP mang vai trò X ở đâu đó trong hệ thống không?" | Access Profile + Permission Set + Workflow Role (`security-authorization/`) |
| **(B) Gán việc** | "User này ĐANG là X của CHÍNH bản ghi này (tài liệu này/CAPA này/Change Control này)?" | Bảng participant riêng của module đó, gắn theo từng bản ghi |

**Ví dụ thật đã xác nhận trong code**: 1 user có thể đồng thời:
- Có Access Profile mang Workflow Role "Document Reviewer" (câu A: được phép làm Reviewer)
- Là `REVIEWER` trong bảng `RevisionWorkflowParticipant` của tài liệu A (câu B: đang được gán Reviewer cho tài liệu A)
- Là `AUTHOR` của tài liệu B (câu B áp dụng độc lập cho tài liệu B — không liên quan gì tới vai trò ở tài liệu A)

→ Câu A và câu B là 2 bảng dữ liệu độc lập. Không xung đột, không cần "chọn 1 vai trò cố định cho mỗi user".

---

## 2. Công thức 3 câu hỏi cho MỌI button/action

Khi thiết kế 1 button hành động mới (ở bất kỳ module nào), luôn trả lời đúng 3 câu hỏi sau — đã verify đúng với engine thật (`RevisionWorkflowAuthorizationService.check()`):

```
Button hiện + bấm được  ⇔  (1) Permission  AND  (2) Trạng thái  AND  (3) Actor
```

### (1) Permission nào?
Một permission code cụ thể, tick trong Permission Set. Đây là "vé vào cửa" — có vé không có nghĩa là được làm ngay, chỉ là điều kiện cần.

### (2) Trạng thái nào?
Bản ghi (Revision/CAPA record/Change Control record...) phải đang ở đúng status thì action mới hợp lệ. Đây là bất biến cứng — **không ai bypass được, kể cả SysAdmin** (đã verify: `validateWorkflowState()` chạy trước cả bước check SysAdmin bypass).

### (3) Actor là ai?
Đây là chỗ hay nhầm nhất — Actor có **2 loại**, phải chọn đúng loại khi thiết kế:

| Loại Actor | Trả lời câu hỏi (A) hay (B)? | Ví dụ thật |
|---|---|---|
| **Actor cố định hệ thống** | Câu (A) — tra trong Access Profile/Workflow Role | `DCO`, `DOCUMENT_ADMIN` — ai có Workflow Role này đều làm được, không phân biệt bản ghi nào |
| **Actor gắn theo bản ghi** | Câu (B) — tra trong bảng participant của module | `ASSIGNED_REVIEWER`, `ASSIGNED_APPROVER`, `AUTHOR`, `OWNER` — chỉ đúng user được gán cho CHÍNH bản ghi này mới làm được |

**Cách chọn**: tự hỏi — "hành động này ai làm cũng được miễn có quyền" (→ Actor cố định) hay "chỉ người được gán riêng cho bản ghi này mới được làm" (→ Actor gắn theo bản ghi)?

---

## 3. Bảng tra cứu thật — Document Control (đã verify từng dòng với code)

| Action | Permission | Trạng thái | Actor |
|---|---|---|---|
| Complete Authoring | `documents.revision.complete_authoring` | DRAFT, editing chưa completed | AUTHOR (gắn theo bản ghi) |
| Open Publishing Workspace | `documents.revision.open_publishing_workspace` | DRAFT + editing completed + locked | DCO/DOCUMENT_ADMIN (cố định) |
| Complete Review | `documents.revision.review` | PENDING_REVIEW | ASSIGNED_REVIEWER đang pending đầu tiên (gắn theo bản ghi) |
| Complete Approval | `documents.revision.approve` | PENDING_APPROVAL | ASSIGNED_APPROVER đang pending đầu tiên (gắn theo bản ghi) |
| Publish | `documents.revision.publish` | READY_FOR_PUBLISHING | DCO/DOCUMENT_ADMIN (cố định) |
| Upgrade Revision | `documents.revision.upgrade` | EFFECTIVE | DCO/DOCUMENT_ADMIN (cố định) — **không** có Author, đã verify DB thật |

Nguồn dữ liệu bảng trên nằm ở bảng `workflow_action_policies` + `workflow_action_policy_actors` trong DB — admin xem/sửa được qua **Security & Authorization → Lifecycle Policies → Transitions**, không phải hardcode trong code Java (trừ phần fallback mặc định khi chưa cấu hình).

---

## 4. Vì sao mở rộng được cho module mới (CAPA, Change Control...) mà không xây lại

Bảng `workflow_action_policies` có cột `workflow_key` để phân biệt module — hiện có `DOCUMENT_REVISION`, `CONTROLLED_COPY`. Actor loại "gắn theo bản ghi" (`ASSIGNED_REVIEWER`, `ASSIGNED_APPROVER`...) vốn đọc từ 1 kiểu bảng participant chung, cùng pattern.

**Khi thêm module CAPA**, việc cần làm chỉ là:
1. Thêm 1 bảng participant riêng cho CAPA (giống `RevisionWorkflowParticipant`) — ai là Investigator/Approver của CAPA record nào.
2. Thêm dòng policy mới với `workflow_key = 'CAPA'`, dùng lại đúng actor type `ASSIGNED_REVIEWER`-kiểu (đổi tên nghiệp vụ thành `ASSIGNED_INVESTIGATOR` nếu cần) — **không phải viết lại engine chấm điểm cho phép/từ chối**, engine đã tổng quát.
3. Điền vào bảng 3-câu-hỏi (mục 2) cho từng action của CAPA — dùng đúng playbook này, không cần thiết kế lại từ đầu.

---

## 5. Đề xuất UX đi kèm (đã thống nhất, chưa triển khai)

Để admin không phải tự lắp Permission Set + Access Profile + Workflow Role từ 3 màn hình rời:

1. **Access Profile mẫu dựng sẵn** theo từng module (VD Document Reviewer/Approver/Coordinator/Viewer) — sửa được, chỉ không xoá/tắt được để tránh mất quyền hàng loạt do lỡ tay.
2. **Wizard "Tạo vai trò mới"** — 1 màn hình duy nhất, gộp cả 3 bước (chọn gói quyền gợi ý → chọn Workflow Role → chọn phạm vi BU/Department) → tạo ra đúng 3 bản ghi phía sau, không bắt admin hiểu khái niệm kỹ thuật.
3. **Chú thích nối 2 lớp (A) và (B)** ngay tại nơi chọn Reviewer/Approver trong New Document — để admin tự hiểu vì sao user này xuất hiện trong danh sách chọn.

---

## 6. Checklist nhanh khi thêm 1 action mới ở module bất kỳ

- [ ] Permission code là gì? Đã tồn tại trong Permission Sets chưa, hay cần seed mới?
- [ ] Action này hợp lệ ở (những) trạng thái nào của bản ghi?
- [ ] Actor là "cố định hệ thống" (tra Access Profile/Workflow Role) hay "gắn theo bản ghi" (tra bảng participant riêng của module)?
- [ ] Nếu actor gắn theo bản ghi — bảng participant đó đã tồn tại chưa, hay cần tạo bảng mới giống `RevisionWorkflowParticipant`?
- [ ] Có cần e-signature không? (đối chiếu với các action tương tự đã có trong hệ thống)
