# Hướng dẫn sử dụng — Security & Authorization

Tài liệu hướng dẫn thao tác toàn bộ chức năng quản trị bảo mật & phân quyền của EQMS.
Áp dụng cho bản build sau đợt hợp nhất "Role = one screen" + "Workflow Security" (07/2026).

**Nguyên tắc chung trước khi bắt đầu:**
- Mọi thay đổi liên quan tới bảo mật đều yêu cầu **chữ ký điện tử** (e-signature): khi bấm Save/Create/Delete, hệ thống hiện modal yêu cầu nhập mật khẩu + lý do. Một lần Save = một chữ ký, bất kể bạn đổi bao nhiêu thứ trong màn hình đó.
- Mọi thay đổi đều được ghi **Audit Trail** — xem lại tại tab Audit Trail của từng đối tượng hoặc module Audit Trail chung.
- Quyết định cho phép/chặn một thao tác nghiệp vụ luôn là giao của các lớp:
  `CÓ QUYỀN (Role) ∧ ĐÚNG TRẠNG THÁI (Workflow Security) ∧ ĐÚNG VAI TRÊN HỒ SƠ (được gán Reviewer/Approver...) ∧ KHÔNG VI PHẠM SoD`
- Còn **ai nhìn thấy bản ghi nào** thì chọn trên Access Profile (mục 2.5): chỉ bản ghi có tên mình / bản ghi của phòng mình / tất cả. Phòng ban và Object Access Rule không còn là điều kiện của việc bấm nút (đã gỡ ngày 20/11/2026).

Menu: sidebar → nhóm **Security & Authorization** gồm: User Management · Roles & Permissions · Shared Permission Sets · Workflow Security · Segregation of Duties · Access Review · E-Sign Config.

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

Đây là màn hình chính để trả lời: **"vai trò này làm được gì?"**. Một Role (Access Profile) = bộ quyền + workflow role + mức nhìn thấy bản ghi + danh sách người giữ.

### 2.1 Danh sách role
- Bảng: tên, code, loại (System/Custom), trạng thái, số Permission Sets / Workflow Roles / Users.
- Search + lọc theo type/status/ngày tạo.
- **New ▾** (góc phải): 2 lựa chọn — **Role (Wizard)** (khuyên dùng, xem 2.2) hoặc **Access Profile** (form trống truyền thống).
- Click 1 dòng → trang chi tiết role.

### 2.2 Tạo role bằng Wizard (cách chuẩn)
Đường đi: Roles & Permissions → **New ▾ → Role (Wizard)**. Gồm 5 bước, có thanh tiến trình phía trên (click quay lại bước đã qua):

1. **Basic Info**: nhập tên role (báo đỏ ngay nếu trùng tên) + mô tả.
2. **Permissions**: phía trên có 3 bộ chọn **mức nhìn thấy bản ghi** (Document Control, Training Management, Reports; xem 2.5), rồi 2 chế độ (nút pill):
   - *Use existing Permission Sets*: search + tick các bộ quyền dùng chung có sẵn.
   - *Pick individual permissions*: bảng chọn quyền theo module — cột trái là danh sách module kèm bộ đếm `đã chọn/tổng`, giữa là quyền của module đang chọn (tick từng quyền hoặc tick "chọn cả module"), phải là panel các quyền đã chọn. Trên mobile cột module chuyển thành dropdown.
3. **Workflow Role** (tùy chọn): tick các vai trò workflow (DCO, Document Reviewer…) — quyết định user giữ role này có xuất hiện trong danh sách chọn Reviewer/Approver khi tạo tài liệu hay không. Role chỉ-xem thì bỏ qua.
4. **Users** (tùy chọn): search + tick những người giữ role ngay từ đầu.
5. **Review & Create**: xem lại toàn bộ → bấm **Create Role** → ký điện tử **một lần duy nhất**.

Toàn bộ được tạo trong **một giao dịch nguyên tử**: nếu bất kỳ bước nào lỗi (vd 1 user vi phạm SoD BLOCK) thì **không có gì được tạo** — không bao giờ có role dở dang.

### 2.3 Trang chi tiết role — thao tác chung
- Nút góc phải: **Back · Edit · Enable/Disable · Delete**.
- Muốn sửa bất kỳ tab nào: bấm **Edit** trước → sửa thoải mái trên nhiều tab → bấm **Save một lần** → ký một lần. Bấm **Cancel** để bỏ mọi thay đổi.
- **Nếu 2 admin cùng sửa 1 role**: người lưu sau sẽ gặp modal **"Configuration Changed"** — chọn *Reload* để tải bản mới nhất (thay đổi của bạn cần nhập lại) hoặc *Keep Editing* để xem lại. Hệ thống không bao giờ ghi đè âm thầm.
- Role hệ thống (badge **System**) và SYSTEM_SUPER_ADMIN: chỉ đọc, không sửa/xóa được.
- **Delete**: chỉ xóa được role không còn user nào giữ; bộ quyền riêng của role bị dọn theo.

### 2.4 Các tab trong role
| Tab | Nội dung & thao tác |
|---|---|
| **General** | Tên, mô tả, trạng thái — sửa ở chế độ Edit |
| **Permissions** | **Toàn bộ quyền role cấp, nhìn theo module.** Phía trên là 3 bộ chọn mức nhìn thấy bản ghi (mục 2.5). Cột trái: module + bộ đếm. Quyền role cấp trực tiếp: tick/bỏ tick tự do (Edit mode). Quyền đến từ Shared Set: hiện **checked + icon ổ khóa 🔒**, di chuột thấy "Granted by shared set: <tên>" — muốn đổi thì sang tab Shared Sets. 3 badge trên đầu: N direct / N from shared sets / N total |
| **Shared Sets (Advanced)** | Gán/bỏ gán bộ quyền dùng chung: ô search + danh sách checkbox 1 cột; click vào **tên set** để mở drawer xem trước nội dung; bỏ tick sẽ có hộp xác nhận (user giữ role sẽ mất các quyền trong set đó) |
| **Workflow Authorization** | Gán/bỏ Workflow Role (DCO, Reviewer…) |
| **Assigned Users** | Gán/bỏ user giữ role. Gán user vi phạm cặp quyền SoD mức BLOCK sẽ bị **chặn ngay khi Save** kèm tên constraint |
| **Audit Trail** | Toàn bộ lịch sử thay đổi của role |

### 2.5 Mức nhìn thấy bản ghi (Record visibility)
Nằm ở tab **Permissions** (và bước 2 của Wizard). Mỗi bộ chọn thực chất ghi/xóa các quyền tương ứng, nên không có nơi lưu thứ hai. Người có nhiều profile được **mức cao nhất** trong các profile đó.

| Module | Các mức | Quyền bên dưới |
|---|---|---|
| **Document Control** | *Chỉ bản ghi có tên người đó* (mặc định) · *Bản ghi của phòng người đó* · *Tất cả bản ghi* | không có · `documents.document.view_department` · ba quyền `view_all` (Document, Controlled Copy, Uncontrolled Copy) |
| **Training Management** | *Phòng của người đó* (mặc định) · *Tất cả phòng* | không có · `training.scope.all` |
| **Reports** | *Chỉ lần chạy của mình* · *Tất cả lần chạy* | `reports.run.view_own` · thêm `reports.run.view_all` |

**Document Control, chi tiết:**
- *Có tên* nghĩa là có tên trong flow (tác giả, chủ, Co-author, Reviewer, Approver) của tài liệu; với revision và bản sao thì tính theo **đúng revision đó**. Người đã bị gỡ khỏi flow của revision mới không thấy revision mới, vẫn thấy revision cũ của mình (ngoại lệ: cài đặt "Retain visibility for removed participants" ở Document Properties, mặc định tắt).
- *Phòng* là Department ghi trên tài liệu lúc tạo, so với Department của người dùng. Mức này **chỉ để xem**: không làm người đó thành người trong flow, không mở file của revision đang duyệt, không bỏ qua quyền xem preview và Audit Trail.
- **Bản sao** (Controlled/Uncontrolled): người có tên trong flow của revision của bản sao, và có quyền xem bản sao, thấy **bản ghi** (danh sách, chi tiết, chữ ký, Audit Trail), không thấy **nội dung** (PDF đã phát hành, file bằng chứng): phần đó vẫn chỉ của người nhận và người có `view_all`. Tải/in do **Controlled Copies Policy** quyết định.
- Một mức đến từ Shared Permission Set hiện khóa kèm tên set; muốn hạ thì gỡ set khỏi profile.
- Nhãn trên danh sách/chi tiết profile: *Named in flow*, *My department*, *View everything*, *Incomplete* (có một hoặc hai trong ba quyền `view_all`; bộ chọn báo và cho sửa).

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
- Nút góc phải: **Engine Diagnostics** (mở trang Engine Diagnostics: Policy Resolver, Simulator, Relation Definitions) · **Refresh** · **New Policy** (tạo policy mới — chọn workflow/action/status/quyền/actors/priority, ký khi lưu).
- Menu **⋮** ở mỗi dòng:
  - **View Details** — mở màn hình **Transition Policy Details** (chỉ đọc): toàn bộ thông tin policy, actors, quan hệ bắt buộc và quan hệ "phải là người khác". Người chỉ có quyền xem cũng vào được màn này.
  - **Edit Transition** — mở màn hình **Edit Transition Policy** (riêng, cần quyền manage): sửa quyền, actors, priority…; bấm **Preview Changes** để xem khác biệt, rồi ký.
  - **Create Override**, **Duplicate**, **Activate/Deactivate**, **Reset Default** — như cũ.
- Trên màn **Transition Policy Details**, các chức năng này nằm thành nút ở đầu trang (Back · Edit Policy · Create Override · Duplicate · Activate/Deactivate · Reset Default). Breadcrumb: Security & Authorization › Workflow Authorization › Transition Policies › Transition Policy Details.

### 4.2b Tab Workflow Roles — danh mục vai trò workflow
- Workflow Role là một "việc" người dùng được giao trên một bản ghi (Reviewer, Approver, DCO…). Access Profile liệt kê các role mà người giữ profile có; các policy ở tab khác dùng chúng để quyết định ai được làm gì.
- Tab này thay cho mục menu **Workflow Role Catalog** trước đây (đã bỏ khỏi Advanced; đường cũ vẫn mở được và tự chuyển tới tab).
- Nút **New Custom Role** ở góc phải trên (cần quyền manage): tạo role riêng; role hệ thống không xoá được.

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

## 5. Object Access Rules — đã gỡ (20/11/2026)

Màn **Advanced → Object Access Rules** và phạm vi Business Unit / Department trên Access Profile **không còn**. Lý do: hai thứ này trùng việc và gây rối. Việc "ai nhìn thấy bản ghi nào" giờ chọn ngay trên Access Profile (mục 2.5); việc "ai được bấm nút" do quyền chức năng + vai trò trên hồ sơ + trạng thái + tách trách nhiệm quyết định.

- Đường cũ `/security/object-rules` tự chuyển về danh sách Access Profiles.
- **Chia sẻ Knowledge Base không bị ảnh hưởng**: nó là mô hình riêng của các Trưởng phòng/đơn vị, xem tại Access Review → Knowledge Shares.
- Quyền `security.object_rules.manage` và `.share_knowledge_any_department` vẫn còn (mức Admin của Knowledge Base dùng); tên cũ chỉ là tên lịch sử.
- Hệ thống từ chối nâng cấp nếu phát hiện còn Object Access Rule do admin tạo (không âm thầm mất dữ liệu): cần xuất và dọn các rule đó trước.

---

## 6. Segregation of Duties (SoD) — phân tách trách nhiệm

**Đường dẫn:** Security & Authorization → Advanced → Segregation of Duties. Gồm các tab: **Permission Conflict Rules**, **Document Revision Integrity**, và **một tab cho mỗi module khác** (Access Review & Audit Trail Review, Reports, Training Management) — xem 6.3.

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

### 6.3 Separation Rules — luật "phải là người khác" của từng module
Mỗi module có một tab, giao diện giống hệt Document Revision Integrity. Mỗi dòng là **một câu luật**, ví dụ "The creator of the campaign cannot complete": **tích** = luật đang bật (một người không được làm hai việc trên cùng một bản ghi), **bỏ tích** = cho phép.
1. Chọn tab của module.
2. Bấm **Edit …Rules** (cần quyền manage Workflow Authorization) → tích/bỏ tích các luật.
3. **Save** → nhập lý do và ký điện tử **một lần cho tất cả** luật đã đổi → hệ thống ghi một chữ ký và một dòng Audit Trail cho mỗi bước bị đổi. **Reset** bỏ các thay đổi chưa lưu; **Cancel** thoát chế độ sửa.
- Luật đang bật áp dụng cho **mọi người, kể cả admin**. Admin có toàn quyền *cấu hình* (bật/tắt luật) nhưng việc nghiệp vụ (duyệt, phê duyệt, rà soát) nên làm bằng **tài khoản thường** của chính họ.
- Thay đổi có hiệu lực từ thao tác kế tiếp; việc đã làm không bị hoàn lại.
- Luật mới của **Access Review** (người xem xét không quyết định dòng về tài khoản của chính mình; người tạo campaign không tự hoàn tất) và **Audit Trail Review** (không duyệt mục nhật ký do chính mình thực hiện; người tạo campaign không tự hoàn tất) **tắt sẵn**; admin bật khi cần.
- Với Training, danh sách "người đủ điều kiện được chỉ định" (người duyệt/ký) cũng theo công tắc này: tắt luật thì người đó xuất hiện lại trong danh sách.
- Mỗi luật nằm trong một policy của Workflow Authorization (quan hệ "must be a different person"); tab này chỉ là công tắc dễ dùng cho cùng dữ liệu đó.

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

## 10. Module đã chuyển sang engine phân quyền (cập nhật 2026-11-18)

**Những gì đã đổi.** Với các loại bản ghi dưới đây, việc "ai được làm thao tác này, ở trạng thái nào" do **engine phân quyền** quyết định một mình; code cũ trong từng module không còn kiểm tra quyền, phạm vi hay "người phải khác" cho các thao tác đó. Policy nằm ở **Workflow Authorization** (Workflow Security) — sửa ở đây là có hiệu lực ngay.

| Module | Loại bản ghi do engine quyết định |
|---|---|
| Documents | Revision và Uncontrolled Copy (không còn kiểm tra cũ); Document, Controlled Copy, Controlled Copy Batch dùng engine theo cờ cutover (code kiểm tra cũ vẫn còn, rollback được bằng cờ) |
| Training | Requirement, Matrix version, Activity, Participant, Assessment, Job assignment, Personnel review, Record, Record export, Export batch, Trainer exception, Suspension, Vendor |
| Reports | Report template, Schedule, Run, File (legal hold) |
| Security Review | Access Review campaign, Audit Trail Review campaign |

**Còn ngoài engine:** Backup & Restore (vòng đời nằm ở agent bên ngoài, vẫn dùng quyền phẳng + SoD), các màn cấu hình/từ điển/thông báo, và những thao tác không đổi trạng thái của Training/Report chưa được bọc (ví dụ tạo mới, ghi điểm danh). Các bước **ký duyệt** của Training vẫn kiểm tra thêm người được giao (assignment) sau khi engine cho phép.

**Đọc mã từ chối.** Khi engine từ chối, API trả 403 với mã: `MISSING_PERMISSION` (thiếu quyền), `OUT_OF_SCOPE` (ngoài phạm vi/phòng ban), `ACTOR_NOT_ALLOWED` (không có quan hệ cần thiết với bản ghi, ví dụ không phải người được giao), `SEPARATION_OF_DUTIES` (người làm phải khác, ví dụ người duyệt ≠ người soạn), `POLICY_NOT_CONFIGURED` (bản ghi ở trạng thái không có policy cho thao tác này, hoặc policy đã bị tắt), `USER_NOT_ACTIVE`. Với Report template, các mã cũ (`REPORT_APPROVER_IS_AUTHOR`, `REPORT_GMP_APPROVER_REQUIRED`, `REPORT_SCOPE_DENIED`, `REPORT_TEMPLATE_NOT_PENDING`) vẫn được giữ.

**Cẩn thận khi sửa policy của các loại này** (màn Workflow Authorization hiện cảnh báo `ENGINE_DECIDES_ALONE`):
- Sửa policy cho **rộng hơn** (thêm actor, bỏ quyền yêu cầu) → mọi người đủ điều kiện làm được ngay; không còn "kiểm tra cũ" giữ lại.
- **Tắt** policy → không ai làm được thao tác đó từ trạng thái đó, kể cả người có đủ quyền.
- Policy không có quyền yêu cầu và không có relation → xem lại kỹ ý định.
- Muốn biết ai làm được gì: dùng tab **Simulator** (chọn loại bản ghi, dán ID, chọn người và thao tác) trước khi lưu.

**Simulator.** Simulator (trang Engine Diagnostics) tìm bản ghi theo số hiệu hoặc tên (không cần dán ID). Tab Engine Health đã được bỏ (quyết định 2026-11-19, xem Decision Log): bộ đếm và bảng "mismatch" không còn trên màn hình; bảng `authorization_shadow_evaluation_events` vẫn được backend ghi.

**Xuất danh sách ai giữ quyền nào.** Ở Access Explorer (danh sách hoặc chi tiết một quyền) bấm "Permission Holders Report": hệ thống mở trang chạy report của template loại Permission Holders (điền sẵn quyền đang xem). Cần có sẵn một template loại này trong Report Library; chưa có thì màn hình báo và mở Report Library. Lần chạy được phân quyền, ghi audit và lưu như mọi report.

**Nút trên màn hình.** Chi tiết Training, Uncontrolled Copy và Report template lấy nút từ engine nên khớp với những gì sẽ xảy ra khi bấm. Danh sách và một số màn (chiến dịch Access/Audit Review, Report schedule/run/file) vẫn ẩn/hiện theo quyền, khớp với policy mặc định; nếu bạn sửa policy khác mặc định, nút ở các màn đó có thể không khớp.

**Quay lại cách cũ** không còn là tắt một cờ: phải khôi phục code kiểm tra cũ từ git (xem Decision Log, mục "Old checks deleted").
