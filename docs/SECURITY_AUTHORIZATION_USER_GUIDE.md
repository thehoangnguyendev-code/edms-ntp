# Hướng dẫn sử dụng — Security & Authorization

Tài liệu hướng dẫn thao tác toàn bộ chức năng quản trị bảo mật & phân quyền của EQMS.
Áp dụng cho bản build sau đợt hợp nhất "Role = one screen" + "Workflow Security" (07/2026).

**Nguyên tắc chung trước khi bắt đầu:**
- Mọi thay đổi liên quan tới bảo mật đều yêu cầu **chữ ký điện tử** (e-signature): khi bấm Save/Create/Delete, hệ thống hiện modal yêu cầu nhập mật khẩu + lý do. Một lần Save = một chữ ký, bất kể bạn đổi bao nhiêu thứ trong màn hình đó.
- Mọi thay đổi đều được ghi **Audit Trail** — xem lại tại tab Audit Trail của từng đối tượng hoặc module Audit Trail chung.
- Quyết định cho phép/chặn một thao tác nghiệp vụ luôn là giao của các lớp:
  `CÓ QUYỀN (Role) ∧ ĐÚNG TRẠNG THÁI (Workflow Security) ∧ ĐÚNG VAI TRÊN HỒ SƠ (được gán Reviewer/Approver...) ∧ ĐƯỢC OBJECT RULE CHO PHÉP ∧ KHÔNG VI PHẠM SoD`

Menu: sidebar → nhóm **Security & Authorization** gồm: User Management · Roles & Permissions · Shared Permission Sets · Workflow Security · Object Access Rules · Segregation of Duties · Access Review · E-Sign Config.

---

## 1. User Management — quản lý người dùng

**Đường dẫn:** Security & Authorization → User Management

### 1.1 Danh sách user
- Bảng liệt kê toàn bộ tài khoản: tên, username, email, System Role, phòng ban, trạng thái (Active/Suspended/Inactive/Terminated/Pending).
- Ô **Search** phía trên lọc theo tên/username/email; các dropdown lọc theo role/trạng thái/phòng ban.
- Click vào 1 dòng → mở trang hồ sơ user.

### 1.2 Tạo user mới
1. Bấm nút **Add User** (góc phải trên).
2. Điền các trường bắt buộc: Employee ID, Username, Email, Full Name…
3. **System Role** (bắt buộc): chọn 1 vai trò — đây chính là Access Profile; user sẽ **tự động được gán profile này** và nhận toàn bộ quyền của nó ngay khi tạo. Role tạo bằng Wizard (mục 2.2) xuất hiện tự động trong dropdown này.
4. Bấm **Save** → ký điện tử → user được tạo kèm thông tin đăng nhập.

### 1.3 Hồ sơ user — các tab
- **Personal**: thông tin cá nhân, học vấn (thêm bằng cấp qua nút Add), chứng chỉ (Add Certification, có preview file).
- **Qualifications**: bằng cấp/chứng chỉ chi tiết.
- **Security & Authorization**: danh sách Access Profile user đang giữ. Gán thêm/bỏ profile tại đây hoặc từ phía Role (mục 2.4 tab Assigned Users) — hai nơi cùng một dữ liệu.
- **Activity**: lịch sử hoạt động.

### 1.4 Các hành động trên user (nút trên trang hồ sơ / menu hàng)
| Nút | Tác dụng | Lưu ý |
|---|---|---|
| **Reset Password** | Cấp mật khẩu mới | Yêu cầu chữ ký điện tử |
| **Suspend** | Tạm khóa (nhập lý do + ngày hết hạn tùy chọn) | User không đăng nhập được |
| **Terminate** | Chấm dứt (nhập lý do + ngày) | Không đảo ngược bằng Suspend |
| **Reinstate** | Kích hoạt lại user Suspended/Terminated | **Tự động gán lại Access Profile** theo System Role nếu user chưa có — quyền hồi phục ngay, có audit log |
| **Force Logout** | Hủy phiên đăng nhập hiện tại của user | Dùng khi cần thu hồi truy cập tức thì |

---

## 2. Roles & Permissions — trung tâm phân quyền

**Đường dẫn:** Security & Authorization → Roles & Permissions

Đây là màn hình chính để trả lời: **"vai trò này làm được gì?"**. Một Role (Access Profile) = bộ quyền + workflow role + phạm vi + danh sách người giữ.

### 2.1 Danh sách role
- Bảng: tên, code, loại (System/Custom), trạng thái, số Permission Sets / Workflow Roles / Users.
- Search + lọc theo type/status/ngày tạo.
- **New ▾** (góc phải): 2 lựa chọn — **Role (Wizard)** (khuyên dùng, xem 2.2) hoặc **Access Profile** (form trống truyền thống).
- Click 1 dòng → trang chi tiết role.

### 2.2 Tạo role bằng Wizard (cách chuẩn)
Đường đi: Roles & Permissions → **New ▾ → Role (Wizard)**. Gồm 6 bước, có thanh tiến trình phía trên (click quay lại bước đã qua):

1. **Basic Info**: nhập tên role (báo đỏ ngay nếu trùng tên) + mô tả.
2. **Permissions**: 2 chế độ (nút pill):
   - *Use existing Permission Sets*: search + tick các bộ quyền dùng chung có sẵn.
   - *Pick individual permissions*: bảng chọn quyền theo module — cột trái là danh sách module kèm bộ đếm `đã chọn/tổng`, giữa là quyền của module đang chọn (tick từng quyền hoặc tick "chọn cả module"), phải là panel các quyền đã chọn. Trên mobile cột module chuyển thành dropdown.
3. **Workflow Role** (tùy chọn): tick các vai trò workflow (DCO, Document Reviewer…) — quyết định user giữ role này có xuất hiện trong danh sách chọn Reviewer/Approver khi tạo tài liệu hay không. Role chỉ-xem thì bỏ qua.
4. **Scope** (tùy chọn): giới hạn Business Unit / Department.
5. **Users** (tùy chọn): search + tick những người giữ role ngay từ đầu.
6. **Review & Create**: xem lại toàn bộ → bấm **Create Role** → ký điện tử **một lần duy nhất**.

Toàn bộ được tạo trong **một giao dịch nguyên tử**: nếu bất kỳ bước nào lỗi (vd 1 user vi phạm SoD BLOCK) thì **không có gì được tạo** — không bao giờ có role dở dang.

### 2.3 Trang chi tiết role — thao tác chung
- Nút góc phải: **Back · View Effective Access · Edit · Enable/Disable · Delete**.
- **View Effective Access**: modal hiển thị quyền hiệu lực thực tế của role (server tính, dùng đúng engine runtime).
- Muốn sửa bất kỳ tab nào: bấm **Edit** trước → sửa thoải mái trên nhiều tab → bấm **Save một lần** → ký một lần. Bấm **Cancel** để bỏ mọi thay đổi.
- **Nếu 2 admin cùng sửa 1 role**: người lưu sau sẽ gặp modal **"Configuration Changed"** — chọn *Reload* để tải bản mới nhất (thay đổi của bạn cần nhập lại) hoặc *Keep Editing* để xem lại. Hệ thống không bao giờ ghi đè âm thầm.
- Role hệ thống (badge **System**) và SYSTEM_SUPER_ADMIN: chỉ đọc, không sửa/xóa được.
- **Delete**: chỉ xóa được role không còn user nào giữ; bộ quyền riêng của role bị dọn theo.

### 2.4 Các tab trong role
| Tab | Nội dung & thao tác |
|---|---|
| **General** | Tên, mô tả, trạng thái, scope — sửa ở chế độ Edit |
| **Permissions** | **Toàn bộ quyền role cấp, nhìn theo module.** Cột trái: module + bộ đếm. Quyền role cấp trực tiếp: tick/bỏ tick tự do (Edit mode). Quyền đến từ Shared Set: hiện **checked + icon ổ khóa 🔒**, di chuột thấy "Granted by shared set: <tên>" — muốn đổi thì sang tab Shared Sets. 3 badge trên đầu: N direct / N from shared sets / N total |
| **Shared Sets (Advanced)** | Gán/bỏ gán bộ quyền dùng chung: ô search + danh sách checkbox 1 cột; click vào **tên set** để mở drawer xem trước nội dung; bỏ tick sẽ có hộp xác nhận (user giữ role sẽ mất các quyền trong set đó) |
| **Workflow Authorization** | Gán/bỏ Workflow Role (DCO, Reviewer…) |
| **Object Access** | Xem các Object Access Rule đang ảnh hưởng tới role (chỉ đọc — sửa rule tại màn Object Access Rules) |
| **Assigned Users** | Gán/bỏ user giữ role. Gán user vi phạm cặp quyền SoD mức BLOCK sẽ bị **chặn ngay khi Save** kèm tên constraint |
| **Audit Trail** | Toàn bộ lịch sử thay đổi của role |

---

## 3. Shared Permission Sets — bộ quyền dùng chung (nâng cao)

**Đường dẫn:** Security & Authorization → Shared Permission Sets

Dùng khi nhiều role cần chung một cụm quyền (vd "Document Reader cơ bản"). Nếu chỉ 1 role dùng — không cần tạo set, tick thẳng trong tab Permissions của role.

- **Danh sách**: search + lọc theo module/category/status/type. Bộ quyền riêng của từng role (mã `ROLE_...`) **không hiển thị ở đây** — chúng được quản lý tự động từ trang role.
- **New Permission Set**: điền tên (code tự sinh), mô tả, trạng thái → tick quyền trong bảng chọn theo module (giống wizard) → **Save** → ký.
- **Sửa**: mở set → Edit → đổi quyền → Save. **Mọi role đang gán set này lập tức nhận thay đổi.**
- **Clone**: nút Clone trên chi tiết set để nhân bản làm điểm xuất phát.
- **Delete**: chỉ khi không còn role nào gán; nếu đang được dùng, hãy Deactivate thay vì xóa.
- Set có badge **System**: không sửa/xóa được.

---

## 4. Workflow Security — ai được bấm nút nào, khi nào

**Đường dẫn:** Security & Authorization → Workflow Security

Màn hình trả lời: **"hành động X được phép ở trạng thái nào, bởi ai?"**. Gồm 4 tab:

### 4.1 Tab Matrix — ma trận Action × Trạng thái (nên xem đầu tiên)
1. Chọn **Object Type** (Document Revision / Controlled Copy / Controlled Copy Batch) — mỗi loại có vòng đời riêng nên xem riêng.
2. Bảng hiện ra: **hàng = hành động, cột = trạng thái**; dấu ✓ xanh = có policy đang bật cho ô đó (xám = policy đang tắt; nhãn "+doc-type" = có override theo loại tài liệu).
3. **Click vào dấu ✓** → modal chi tiết: quyền yêu cầu (permission code), danh sách actor được phép (badge xanh), priority, trạng thái Active/System, và nút **Edit policy** nhảy thẳng tới form sửa.

### 4.2 Tab Transitions — danh sách policy chuyển trạng thái
- Bảng đầy đủ các policy (workflow, action, from-status, quyền, actors, priority).
- Nút góc phải: **Workflow Roles** (mở catalog vai trò workflow) · **Effective Lookup** (tra nhanh) · **Refresh** · **New Policy** (tạo policy mới — chọn workflow/action/status/quyền/actors/priority, ký khi lưu).
- Click 1 policy → sửa / duplicate / deactivate.

### 4.3 Tab Capabilities — quyền xem/tải theo trạng thái
- Cấu hình ai được View/Preview/Download tài liệu ở từng trạng thái vòng đời (state-based security).
- **New State Policy** (góc phải) → chọn capability + trạng thái + phạm vi actor (Any/Author/Participant) + quyền yêu cầu → Save + ký.

### 4.4 Tab Diagnosis — "vì sao user X không làm được?"
Tab chỉ hiện với admin có quyền `security.effective_access.diagnose` (người có quyền quản trị role mặc nhiên có).
1. Chọn **User** → chọn **Action** → gõ ≥2 ký tự vào ô search **Document Revision** (theo số/tên tài liệu) → chọn revision trong dropdown kết quả.
2. Bấm **Diagnose** → kết quả gồm verdict **ALLOWED/DENIED** + 3 dòng phân lớp:
   - **State Policy** — hành động có được cấu hình cho trạng thái hiện tại không;
   - **Permission** — user có giữ quyền yêu cầu không;
   - **Actor** — user có phải actor hợp lệ trên hồ sơ đó không (vd có được gán làm Approver không).
   Mỗi dòng ✓/✗/− kèm mã lý do. Lớp sau bị bỏ qua (−) nếu lớp trước đã fail.
3. Mọi lần tra cứu đều được ghi audit (`EFFECTIVE_ACCESS_DIAGNOSED`); bạn chỉ tra được user/tài liệu mà chính bạn có quyền xem.

**Cách dùng thực tế:** user phàn nàn "không bấm được nút Approve" → mở Diagnosis, chọn đúng user + revision + Complete Approval → nhìn dòng ✗ đầu tiên là biết ngay phải sửa ở đâu (thiếu quyền → sang Roles & Permissions; sai trạng thái → tài liệu chưa tới bước đó; không phải actor → gán user vào Approver pool của tài liệu).

---

## 5. Object Access Rules — giới hạn theo phạm vi dữ liệu

**Đường dẫn:** Security & Authorization → Object Access Rules

Thu hẹp quyền đã cấp xuống phạm vi cụ thể: phòng ban, đơn vị, loại tài liệu.

- **New Rule**: chọn Access Profile/Role áp dụng → chọn action → chọn phạm vi (Department / Business Unit / Document Type; để `ALL` = toàn cục) → Save + ký.
- Ví dụ: role "Production Reader" có quyền xem tài liệu, thêm rule scope Department = Production → chỉ xem được tài liệu phòng Production.
- Sửa/xóa: click rule trong danh sách.
- Rule của role nào sẽ hiện trong tab **Object Access** của role đó (chỉ đọc).

---

## 6. Segregation of Duties (SoD) — phân tách trách nhiệm

**Đường dẫn:** Security & Authorization → Segregation of Duties. Gồm 2 tab:

### 6.1 Constraint Rules — cặp quyền xung đột
- Mỗi rule = 2 permission code không được cùng nằm trên 1 người + mức độ:
  - **BLOCK**: hệ thống **chặn ngay** khi gán role khiến user có đủ cặp quyền (chặn ở màn gán user, ở wizard, ở Save role) — thông báo nêu tên rule.
  - **WARN**: chỉ cảnh báo khi quét, không chặn.
- **New Constraint**: chọn quyền A + quyền B + severity + tham chiếu quy định (vd "EU GMP Annex 11") → Save + ký.
- Nút **Scan Violations**: quét toàn bộ role hiện tại, liệt kê role nào đang vi phạm rule nào.

### 6.2 Document Workflow Rules — 8 quy tắc cố định
- Các switch bật/tắt: Author không được là Reviewer/Approver, yêu cầu tối thiểu 2 Reviewer, 1 Approver, Co-Author không được review, DCO không được review/approve, Reviewer và Approver khác phòng ban…
- Được enforce **ngay lúc lưu/submit hồ sơ tài liệu** (chọn participant vi phạm sẽ bị từ chối).
- Bấm Edit → gạt switch → Save + ký.

---

## 7. Access Review — rà soát quyền định kỳ (tuân thủ 21 CFR Part 11)

**Đường dẫn:** Security & Authorization → Access Review

1. **New Campaign**: đặt tên + mô tả + hạn chót → hệ thống **chụp snapshot toàn bộ user đang hoạt động** kèm role/quyền hiện tại thành danh sách item cần rà.
2. Mở campaign → duyệt từng item: với mỗi user, chọn **Approve** (quyền hợp lệ, giữ nguyên) hoặc **Revoke/Flag** (cần thu hồi — ghi chú lý do). Có thể lọc theo phòng ban/role để chia việc.
3. Khi mọi item đã có quyết định → bấm **Complete Campaign** → **ký điện tử** chốt phiên rà soát. Kết quả lưu vĩnh viễn làm bằng chứng audit.
4. Campaign đang mở có thể **Cancel** (kèm lý do).
> Khuyến nghị GMP: chạy 1 campaign mỗi quý hoặc sau mỗi đợt thay đổi tổ chức lớn.

---

## 8. E-Sign Config

**Đường dẫn:** Security & Authorization → E-Sign Config
Cấu hình các "meaning" chữ ký điện tử (ý nghĩa pháp lý của từng loại chữ ký) và chính sách áp dụng. Chỉ chỉnh khi có yêu cầu QA — mặc định đã phủ các thao tác bảo mật.

---

## 9. Xử lý tình huống thường gặp

| Tình huống | Làm gì, ở đâu |
|---|---|
| User kêu "không thấy menu X" | Roles & Permissions → mở role của user → tab Permissions → kiểm tra quyền `*.module.view` của module đó có được tick không |
| User kêu "không bấm được nút Y trên tài liệu Z" | Workflow Security → tab **Diagnosis** → tra đúng user + revision + action → sửa theo lớp bị ✗ |
| Cần vai trò mới cho phòng ban mới | Roles & Permissions → New ▾ → **Role (Wizard)** — 6 bước, 1 chữ ký |
| Nhân viên nghỉ việc | User Management → mở user → **Terminate** (+ Force Logout nếu cần tức thì) |
| Nhân viên quay lại làm việc | User Management → **Reinstate** — quyền tự hồi phục theo System Role |
| Nhiều role cần cùng 1 cụm quyền | Shared Permission Sets → tạo set → gán vào từng role ở tab Shared Sets |
| Đến kỳ audit nội bộ | Access Review → New Campaign → duyệt → Complete + ký |
| Save role báo "Configuration Changed" | Có admin khác vừa lưu — bấm Reload, nhập lại thay đổi của bạn |
| Gán role bị chặn "Segregation of Duties conflict" | Đúng thiết kế — user sẽ có cặp quyền xung đột; xem tên rule trong thông báo, cân nhắc đổi role hoặc xin ngoại lệ (sửa rule ở SoD) |
