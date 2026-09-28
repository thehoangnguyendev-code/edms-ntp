# Hướng dẫn test đầy đủ vòng đời Document Master + Revision (Draft → Obsolete)

> Phạm vi: toàn bộ chức năng liên quan tới `eqms/src/features/documents/` — Author/Co-Author/Reviewer/Approver, Upload Revision, Upload to Office Online, Edit File Online, Complete Authoring, Submit, Reject, Publish Template, Training info, Publish, Cancel, Obsolete. Không liên quan `eqms/src/features/training/`.

---

## Phần A — Tạo quyền và user test

Cần **4 user test** để phủ hết mọi vai trò không trùng nhau:

| User | Vai trò |
|---|---|
| **A** | Document Creator / DCO (tạo Document Master, Submit, Publish, Cancel, Obsolete) |
| **X** | Author (được chỉ định làm Author của Revision — thao tác Upload/Complete Authoring) |
| **B** | Reviewer |
| **C** | Approver |

*(Co-Author test bằng cách thêm 1 user thứ 5 tuỳ chọn, hoặc dùng lại B/C làm Co-Author ở lượt test khác — không bắt buộc)*

### A.1. Tạo Permission Set

Sidebar → **Security & Authorization → Permission Sets → New Permission Set**. Với mỗi Permission Set: nhập Name → ở phần "Permissions" gõ đúng mã vào ô tìm kiếm → tick checkbox → **Save**.

| Permission Set | Mã quyền cần tick |
|---|---|
| **PS-Creator** | `documents.document.create`, `documents.revision.submit`, `documents.revision.publish`, `documents.document.cancel`, `documents.document.obsolete` |
| **PS-Author** | `documents.revision.edit_metadata`, `documents.office_online.upload`, `documents.office_online.edit` |
| **PS-Reviewer** | `documents.revision.review`, `documents.revision.reject_review` |
| **PS-Approver** | `documents.revision.approve`, `documents.revision.reject_approval` |

### A.2. Tạo Access Profile

Sidebar → **Access Profiles → New Access Profile** — với mỗi cái: tab General nhập Name → Save lần đầu → tab **Permission Sets** → gán đúng Permission Set tương ứng (kéo từ "Available" sang "Assigned" bằng icon mũi tên) → **Save**.

- **AP-Creator** ← PS-Creator
- **AP-Author** ← PS-Author
- **AP-Reviewer** ← PS-Reviewer
- **AP-Approver** ← PS-Approver

### A.3. Tạo 4 user

Sidebar → **User Management → Add User** — điền thông tin, mục "Account & Access Control" → **System Role** chọn đúng Access Profile tương ứng → **Create User**.

- User **A** ← AP-Creator
- User **X** ← AP-Author
- User **B** ← AP-Reviewer
- User **C** ← AP-Approver

---

## Phần B — Test đầy đủ vòng đời

### B.1. Tạo Document Master (đăng nhập User A)

1. Documents → **All Documents** → **New Document**.
2. Tab **General Information**:
   - **Author \*** (Select): chọn **X**.
   - **Co-Author(s)** (MultiSelect): chọn thêm 1 user khác nếu muốn test Co-Author (tuỳ chọn — Co-Author được phép Edit File Online cùng Author nhưng không được Complete Authoring/Upload lần đầu).
   - Điền Document Name, Type, Business Unit, Department...
3. Tab **Training Information**: bật toggle **"Requires Training?"**:
   - Nếu **bật**: điền **"Training Period (Days)"** (số ngày) → luồng sau Approve sẽ đi qua **Pending Training**.
   - Nếu **tắt**: có ô nhập **lý do bỏ qua training** → luồng sau Approve sẽ nhảy thẳng vào **Ready for Publishing** (rút ngắn test).
4. Tab **Reviewers**: chọn **B** (chỉ hiện user có quyền `documents.revision.review`).
5. Tab **Approvers**: chọn **C**.
6. Bấm **Save** (góc trên phải) → Document Master ở trạng thái **DRAFT**.

### B.2. Upload Revision + Office Online (đăng nhập lại bằng User X — Author)

1. Mở lại Document vừa tạo (All Documents → click vào Document Number) → mở Revision (tab Document Revisions, hoặc "Upload Revision" nếu chưa có revision nào).
2. Bấm **"Upload Revision"** → chọn file (Word/Excel...) → upload xong, revision ở **DRAFT**.
3. Bấm **"Upload to Office Online"** → hệ thống đẩy file lên Office Online (SharePoint), chuyển sang trạng thái có thể edit online.
4. Bấm **"Edit File Online"** → mở trình soạn thảo online, sửa nội dung → đóng lại (auto-sync về hệ thống).
   - *Test riêng*: nếu có chọn Co-Author ở bước B.1, đăng nhập bằng Co-Author và xác nhận **cũng bấm được "Edit File Online"** (được phép), nhưng **không bấm được "Complete Authoring"/"Upload Revision" lần đầu** (chỉ Author X mới thấy 2 nút này).
5. Đăng nhập lại bằng **X** (Author) → bấm **"Complete Authoring"** → modal ký điện tử → điền lý do → xác nhận. Trạng thái vẫn DRAFT nhưng khoá nội dung (editingStatus = COMPLETED).
6. Bấm **"Open Publishing Workspace"**.

### B.3. Tuỳ chỉnh Publish Template (vẫn trong Publishing Workspace, User X)

1. Trong màn hình **Publishing Workspace**: chọn **Template** ở dropdown (danh sách template đã cấu hình sẵn — nếu muốn tạo/sửa template trước, vào Sidebar → Document Control → **Publishing Templates** để quản lý riêng, ngoài phạm vi luồng này).
2. Tuỳ template, có thể chỉnh: **Layout** khả dụng, phạm vi trang Cover/Body/Header/Footer/Watermark (các ô nhập "from page"/"to page").
3. Xem trước bản xuất thử nếu màn hình có nút Preview.
4. Bấm **"Submit For Review"** (góc dưới/phải) → modal ký điện tử → xác nhận → Revision chuyển **PENDING_REVIEW**.

### B.4. Review (đăng nhập User B)

1. Document Revisions → All Revisions → tìm revision → mở, hoặc menu 3 chấm → **Review**.
2. **Test nhánh Reject trước** (để kiểm tra đủ tính năng): bấm **"Reject"** → điền lý do → xác nhận → revision quay lại **DRAFT**, Author X phải sửa lại và Submit lại từ B.3 bước cuối.
3. Submit lại → quay lại màn Review → lần này bấm **"Complete Review"** → ký điện tử → xác nhận → chuyển **PENDING_APPROVAL**.

### B.5. Approve (đăng nhập User C)

1. Mở revision đang PENDING_APPROVAL → menu 3 chấm → **Approve**.
2. **Test nhánh Reject**: bấm **"Reject"** → điền lý do → xác nhận → xem revision quay về trạng thái nào (tuỳ cấu hình, thường về DRAFT hoặc PENDING_REVIEW) → Author sửa lại, Submit lại, Review lại (lặp B.3-B.4) rồi quay lại đây.
3. Lần cuối: bấm **"Complete Approve"** → ký điện tử → xác nhận:
   - Nếu **Requires Training = bật** → chuyển **PENDING_TRAINING**.
   - Nếu **tắt** → chuyển thẳng **READY_FOR_PUBLISHING** (bỏ qua bước B.6).

### B.6. Training (chỉ nếu Requires Training = bật)

1. Đăng nhập bằng user có quyền `documents.training.complete` (có thể gán thêm cho A hoặc C).
2. Mở revision đang PENDING_TRAINING → bấm **"Complete Training"** → ký điện tử → xác nhận → chuyển **READY_FOR_PUBLISHING**.

### B.7. Publish (đăng nhập User A)

1. Mở revision đang READY_FOR_PUBLISHING → nút **"Publish"** trên header trang Detail.
2. Ký điện tử → xác nhận → Revision chuyển **EFFECTIVE**, Document Master tự chuyển **ACTIVE**.
3. Kiểm tra tab **"Document"** trên Detail Revision đã hiện file PDF chính thức đã publish (dùng đúng Publish Template đã chọn ở B.3).

### B.8. Test Cancel (nhánh riêng, làm trên 1 Document/Revision KHÁC)

Lặp lại B.1-B.2 tạo 1 Document Master + Revision mới khác, rồi:

1. **Cancel Document Master**: khi Document còn **DRAFT**, chưa có Effective revision → đăng nhập A → nút **"Cancel"** trên Document Detail → xác nhận → Document chuyển **CLOSED_CANCELLED**.
2. **Cancel Revision**: tạo 1 revision khác đang ở giữa chừng (DRAFT/PENDING_REVIEW/PENDING_APPROVAL/READY_FOR_PUBLISHING) → đăng nhập A hoặc X → nút **"Cancel"** trên Revision Detail → điền Activity Summary → xác nhận → Revision chuyển **CLOSED_CANCELLED**.

### B.9. Obsolete (dùng lại Document đã Effective ở B.7)

1. Đăng nhập **A** → mở Document Master đang **ACTIVE** (đã có revision Effective) → nút **"Obsolete"** trên header.
2. Ký điện tử → xác nhận → Document Master chuyển **OBSOLETED**, revision Effective trước đó chuyển **OBSOLETED**.

---

## Bảng tổng hợp trạng thái đã đi qua

| Đối tượng | Trạng thái đã test |
|---|---|
| Document Master | DRAFT → ACTIVE → OBSOLETED (+ nhánh riêng DRAFT → CLOSED_CANCELLED) |
| Document Revision | DRAFT → PENDING_REVIEW → (Reject→DRAFT) → PENDING_REVIEW → PENDING_APPROVAL → (Reject→...) → PENDING_APPROVAL → PENDING_TRAINING *(nếu bật)* → READY_FOR_PUBLISHING → EFFECTIVE → OBSOLETED (+ nhánh riêng CLOSED_CANCELLED) |

## Checklist tính năng đã phủ

- [x] Chọn Author / Co-Author / Reviewer / Approver
- [x] Upload Revision
- [x] Upload to Office Online
- [x] Edit File Online (Author + Co-Author)
- [x] Complete Authoring (chỉ Author)
- [x] Tuỳ chỉnh Publish Template (layout, page range)
- [x] Nhập Training Information (bật/tắt Requires Training, Training Period)
- [x] Submit For Review
- [x] Reject (ở cả Review và Approval)
- [x] Complete Review / Complete Approve
- [x] Complete Training (nếu bật)
- [x] Publish → Effective
- [x] Cancel (Document Master + Revision)
- [x] Obsolete (Document Master)
