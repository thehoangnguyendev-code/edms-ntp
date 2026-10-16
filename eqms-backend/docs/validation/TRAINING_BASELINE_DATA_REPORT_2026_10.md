# TRAINING-WP0 — Báo cáo dữ liệu nền (chỉ đọc, DEV)

Ngày chạy: 2026-10-16. Môi trường: **DEV** (PostgreSQL `eqms-database`). Chỉ có câu lệnh `SELECT`; không ghi, không đổi dữ liệu. Báo cáo **không chứa tên, email hay mật khẩu** của người dùng; chỉ có số lượng, mã bộ phận, tên vị trí và số tài liệu. Các số dưới đây là số của **DEV**, không phải của môi trường thật; môi trường thật phải chạy lại cùng các câu hỏi trước khi làm WP-3 và WP-5.

Liên quan: SDS-TR-001 mục 15.1 (việc 0.5), PLAN-TR-001 (D-03, D-04, D-14, D-19).

## 1 Kết quả theo câu hỏi

### (a) Bộ phận và mã dùng cho mã đào tạo (`TRN/<mã>/<YY>-<XXX>`)

- 18 bộ phận, **18 mã đều hợp lệ** (chỉ `A-Z0-9`), **không trùng** (kể cả không phân biệt hoa thường). Mã dài nhất là `ITDEPT` (6 ký tự).
- 11 bộ phận đang hoạt động; **7 bộ phận không hoạt động**: `CLIN`, `EXEC`, `LAB`, `MAIN`, `QM`, `RND`, `WHSE`.
- **Phát hiện F-1:** có tài liệu thuộc bộ phận không hoạt động: `EXEC` 4, `LAB` 2, `MAIN` 4, `QM` 4 (tổng 14 tài liệu); trong đó tài liệu yêu cầu đào tạo thuộc `MAIN` (2) và `QM` (1). Khi cấp mã cho revision của các tài liệu này, "DC" sẽ là mã bộ phận không hoạt động. **Đề xuất (D-35):** cho phép cấp mã theo bộ phận của tài liệu kể cả khi bộ phận đã ngưng (mã vẫn đúng để truy xuất); chỉ **không cho chọn** bộ phận ngưng làm đơn vị tổ chức khi tạo hoạt động mới.

### (b) Người dùng

| Trạng thái | Số lượng |
|---|---|
| Suspended | 4 988 |
| **Active** | **465** |
| Terminated | 2 |
| Inactive | 2 |
| Pending | 1 |

- Trong 465 người Active: **432 không có bộ phận, 436 không có vị trí, 432 không có mã nhân viên.** 297 tài khoản có tên bắt đầu `legacy.batch…` và 135 tên `baseline.nop…` không có mã nhân viên; đây là **tài khoản thử và tải**, không phải nhân sự.
- **Phát hiện F-2:** tài khoản **không có mã nhân viên** nên bị loại khỏi tập người có thể đào tạo (hồ sơ đào tạo cần mã nhân viên, APD.0014). **Đề xuất (D-36):** chỉ người Active **có mã nhân viên** mới đưa được vào danh sách tham gia và hồ sơ; còn lại hiển thị là "không đủ điều kiện (thiếu mã nhân viên)".
- Còn lại **33 người Active có mã nhân viên**, trong đó **29 có cả bộ phận và vị trí**.
- Phân bố người Active có mã nhân viên và khớp được bộ phận: `QA` 14, `EXEC` 3, `ME` 3, `DCTRL` 1, `QC` 1, `RA` 1.

### (c) Khớp vị trí (D-04)

- Bảng `positions` có 11 vị trí, **tất cả hoạt động**; 1 vị trí (`HRMGR`, HR Manager) **chưa gắn bộ phận**.
- Trong số người Active có vị trí (29 người), **8 tên vị trí khác nhau và cả 8 đều khớp** `positions.name` (khớp theo tên, bỏ khoảng trắng, không phân biệt hoa thường). **Không có vị trí nào không khớp** ở DEV.
- **Phát hiện F-3:** **10 người Active** (vị trí "QA Specialist") có cột bộ phận là chữ **"Quality"**, **không khớp bất kỳ `departments.name` nào** (bộ phận gần nhất là "Quality Assurance", mã `QA`). Theo quy tắc **không đoán**, 10 người này được liệt kê là **chưa ánh xạ bộ phận**; người có quyền sửa qua màn Position Mapping hoặc quản lý người dùng. Chưa có người dùng nào có bộ phận không hoạt động ngoài `EXEC` (3 người).
- **Phát hiện F-4:** liên kết người dùng đến bộ phận hiện cũng là **chữ** (`app_users.department`), không phải khóa; cần cùng cách xử lý như vị trí (khớp theo tên + báo cáo + sửa tay).

### (d) Vị trí chưa có bộ phận

`HRMGR` (HR Manager). Cần gắn bộ phận (HRAD) trước khi dùng trong ma trận của bộ phận (việc của người quản trị dữ liệu).

### (e) Tài liệu và revision có yêu cầu đào tạo

- Tài liệu có `requires_training = true`: **26** (trên 10 435). Không tài liệu nào thiếu `training_period_days`; không tài liệu nào thiếu bộ phận.
- Theo bộ phận: `QA` 13, `QC` 5, `LOG` 2, `MAIN` 2, `DCTRL` 1, `HRAD` 1, `ME` 1, `QM` 1.
- Revision có yêu cầu đào tạo theo trạng thái: `EFFECTIVE` 7, `OBSOLETED` 6, `DRAFT` 5, `CLOSED_CANCELLED` 4, `PENDING_APPROVAL` 1, `PENDING_REVIEW` 1, `PENDING_TRAINING` 1. Cả 7 revision `EFFECTIVE` có yêu cầu đào tạo **đều có ngày hoàn thành đào tạo**; tổng cộng 45 revision có ngày hoàn thành đào tạo.
- **Hệ quả:** khi tích hợp bật, các revision `EFFECTIVE`, `OBSOLETED` và `CLOSED_CANCELLED` **không** được cấp mã hồi tố (chúng mang `training_origin = NATIVE` nhưng `training_mode` trống / coi là lịch sử). **Đề xuất (D-37):** revision đã qua giai đoạn Pending Training **không** được cấp mã; đánh dấu `training_origin = LEGACY_IMPORT` **không** đúng cho chúng (chúng không nhập từ ngoài). Dùng giá trị `training_mode = NULL` + hiển thị "Trước khi có Training Management" và **không** đưa vào Legacy evidence. Revision `DRAFT`, `PENDING_REVIEW`, `PENDING_APPROVAL` có yêu cầu đào tạo (7) sẽ nhận mã ở **lần lưu tiếp theo** (chế độ `INTEGRATED` nếu cờ bật).

### (f) Revision đang ở `PENDING_TRAINING`

- **1 revision:** `SOP.0017`, `training_period_days = 7`, **chưa có ngày dự kiến**. Theo D-28 nó **ở lại chế độ `MANUAL`** đến khi hoàn thành bằng cách nhập tay như hiện nay.

### (g) Quyền `training.*` hiện có và ai giữ (D-19)

- Có 11 quyền: `training.module.view`, `training.material.manage`, `training.session.manage`, `training.assignment.manage`, `training.admin.view`, `training.admin.properties.view`, `training.admin.requirement_templates.view`, `training.admin.quiz.view`, `training.admin.curriculums.view` và hai quyền Document Control `documents.training.manage`, `documents.training.complete`.
- Được gán qua các bộ quyền: `ROLE_ADMINISTRATOR`, `SYSTEM_ADMINISTRATION`, `ROLE_DCO`, `ROLE_DOCUMENT_CONTROLLER`, `ROLE_VIEWER_OPERATOR`, `ADMIN_NO_BYPASS_SET`, `PS_DOCUMENT_SECURITY_ADMIN`, `PS_DCO_TEST`, `PS_DOCUMENT_DCO`, `PS_UAT_DOCUMENT_DCO`, `PS_MODULE_DOCUMENTS_MANAGER`, `PS_MODULE_TRAINING_MANAGER`.
- Người Active giữ quyền qua Access Profile: `ADMINISTRATOR` 1, `DCO` 3, `DCO_TEST` 2, `DOCUMENT_CONTROLLER` 1, `AP_UAT_DOCUMENT_SECURITY_ADMIN` 1, `AP_UAT_DCO_QUALITY` 1; `VIEWER_OPERATOR` và `ADMIN_NO_BYPASS` có quyền xem nhưng **0 người Active**. Hai bộ quyền `PS_MODULE_TRAINING_MANAGER` và `PS_MODULE_DOCUMENTS_MANAGER` **chưa gán cho Access Profile nào**.
- **Phát hiện F-5:** `training.material.manage` được dùng như điều kiện cho `completeTraining` (cùng `documents.training.complete`, `documents.training.manage`) trong `TrainingAuthorizationService`. Khi chuyển sang quyền mới (WP-1), **phải giữ** các quyền này cho nhánh `MANUAL` của Document Control.

### (h) Loại tài liệu và "cấp tài liệu" (D-03)

- 20 loại tài liệu (`document_types`); **không có cột cấp** (level). Xác nhận cần thêm thuộc tính tùy chọn "Document Level (1-4)" (D-03); dữ liệu hiện **trống hoàn toàn**.
- Không có loại tài liệu nào là Training (TRN); không cần, vì ma trận là dữ liệu Training (D-02).

## 2 Việc cần làm trước các gói sau (từ báo cáo)

| # | Việc | Gói | Người |
|---|---|---|---|
| 1 | Quyết định D-35 (bộ phận ngưng) và D-36 (cần mã nhân viên), D-37 (revision lịch sử không cấp mã): **đề xuất ở trên, chờ QA xác nhận** | WP-1, WP-5 | QA |
| 2 | Sửa dữ liệu bộ phận "Quality" của 10 người (F-3) | WP-3 | Quản trị dữ liệu |
| 3 | Gắn bộ phận cho vị trí `HRMGR` | WP-3 | Quản trị dữ liệu |
| 4 | Chạy lại báo cáo này trên môi trường thật trước WP-3 và WP-5 | WP-3, WP-5 | IT, QA |
| 5 | Bàn giao danh sách người cần đào tạo thật (33 người có mã nhân viên ở DEV chỉ là dữ liệu thử) | WP-6 | QA |

## 3 Câu lệnh đã chạy (mô tả; chỉ đọc)

Đếm bộ phận, vị trí, người dùng theo trạng thái; kiểm tra mã bộ phận bằng biểu thức `^[A-Z0-9]+$` và trùng không phân biệt hoa thường; khớp `app_users.department` và `app_users.position` với `departments.name` và `positions.name`; đếm tài liệu và revision theo `requires_training`, bộ phận, trạng thái; đọc quyền `training.%` và `documents.training.%` cùng bộ quyền và Access Profile; đọc `information_schema` cho các bảng liên quan. Không có câu lệnh ghi.
