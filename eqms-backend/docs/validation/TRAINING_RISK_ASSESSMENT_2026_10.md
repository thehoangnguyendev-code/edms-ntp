# TRAINING-RISK — Đánh giá rủi ro và toàn vẹn dữ liệu của Training Management

Phiên bản 0.1 (bản nháp WP-0, chờ QA xem xét và ký) · 2026-10-16
Căn cứ: SDS-TR-001 mục 1, 13; `TRAINING_URS_2026_10.md`; báo cáo dữ liệu nền; kiểm tra hạ tầng. Đây là **đánh giá của người soạn**; QA phải xem xét và điều chỉnh mức.

## 1 Phương pháp

Thang 1 đến 3 cho **S** (mức nghiêm trọng: ảnh hưởng đến toàn vẹn hồ sơ GMP, an toàn dữ liệu, tuân thủ), **P** (khả năng xảy ra nếu không có kiểm soát), **D** (khả năng phát hiện: 1 = dễ phát hiện, 3 = khó). **RPN = S × P × D** (1 đến 27). Mức: **Cao** ≥ 12 hoặc S = 3 và P ≥ 2; **Trung bình** 6 đến 11; **Thấp** ≤ 5. Mọi rủi ro **Cao** phải có kiểm soát **và** kiểm thử âm tính; kiểm soát phải được kiểm chứng bằng kiểm thử, không chỉ nêu trong thiết kế.

## 2 Bảng rủi ro

| ID | Rủi ro | S | P | D | RPN | Mức | Kiểm soát (thiết kế) | Kiểm thử |
|---|---|---|---|---|---|---|---|---|
| R-01 | Hồ sơ đào tạo bị sửa hoặc xóa sau khi hoàn thành | 3 | 2 | 3 | 18 | Cao | Trigger bất biến; không có phương thức cập nhật; vô hiệu thay cho sửa; sao lưu | DI-01..DI-04 |
| R-02 | Hồ sơ được tạo không qua hoạt động (nhập tay, API) | 3 | 2 | 3 | 18 | Cao | Không có API nhập tay; chỉ máy chủ tạo hồ sơ khi hoàn thành; nhập cũ tách bảng và nhãn | REC-01, SEC-05 |
| R-03 | Giả mạo chữ ký hoặc phát lại mã chữ ký | 3 | 2 | 2 | 12 | Cao | Mã dùng một lần có sẵn; ký gắn đối tượng và ý nghĩa; kiểm lại khi ký | SIG-01..SIG-05 |
| R-04 | Người học tự đổi kết quả hoặc đánh giá cho chính mình | 3 | 2 | 2 | 12 | Cao | Kết quả tính ở máy chủ; người chấm ≠ người được chấm; DTO không nhận trường kết quả | ASM-04, SEC-03 |
| R-05 | Người không được chỉ định hoặc mất quyền vẫn duyệt | 3 | 2 | 2 | 12 | Cao | Mô hình chỉ định (SDS 8.5); kiểm quyền lại khi ký | AUTH-03..AUTH-07 |
| R-06 | Truy cập hồ sơ người khác (IDOR) | 3 | 2 | 2 | 12 | Cao | Phạm vi đối tượng; `me/*` ép người đăng nhập; `403` đồng nhất | SEC-01, SEC-02 |
| R-07 | Mã đào tạo trùng khi nhiều người cấp cùng lúc | 3 | 2 | 2 | 12 | Cao | Cấp số nguyên tử; ràng buộc duy nhất | CON-01..CON-03 |
| R-08 | Lưu tài liệu thành công nhưng mã hoặc hoạt động không có (hoặc ngược lại) | 3 | 2 | 2 | 12 | Cao | Cùng giao dịch; chỉ mục duy nhất theo revision; kiểm thử lỗi và lui | FAIL-01..FAIL-04 |
| R-09 | Rơi thầm lặng về nhập tay khi Training lỗi | 3 | 1 | 3 | 9 | Trung bình | Không có đường rơi; chế độ ghi một lần; kiểm tra CHECK ở DB | FAIL-02, INT-12 |
| R-10 | Sửa Document Control gây hồi quy (entity CRITICAL 107, giao diện 138 đến 425) | 3 | 2 | 2 | 12 | Cao | Thay đổi chỉ cộng thêm, có điều kiện; chạy lại toàn bộ test Document Control trước và sau; lát nhỏ; `detect_changes` | REG-01..REG-04 |
| R-11 | Ngày hoàn thành ghi sai vào revision, ngày hiệu lực lệch | 3 | 1 | 3 | 9 | Trung bình | Ngày chỉ do Training ghi qua cổng, idempotent; Audit hai bên; kiểm thử đầu-cuối với từng cấu hình hiệu lực | INT-08..INT-10 |
| R-12 | Tệp độc hại hoặc sai loại | 3 | 1 | 2 | 6 | Trung bình | ClamAV; danh sách loại; giới hạn kích thước; SHA-256 | SEC-08, SEC-09 |
| R-13 | Lộ dữ liệu cá nhân (xuất, danh sách) | 2 | 2 | 2 | 8 | Trung bình | Cột tối thiểu; quyền xuất riêng; Audit khi xem và xuất | SEC-10, AUD-05 |
| R-14 | Tiêm SQL hoặc sắp xếp tùy ý | 3 | 1 | 1 | 3 | Thấp | Tham số hóa; danh sách cho phép; thoát `LIKE` | SEC-06, SEC-07 |
| R-15 | Mass assignment (gửi trường trạng thái) | 3 | 2 | 2 | 12 | Cao | DTO chỉ trường cho phép; lệnh có tên | SEC-03 |
| R-16 | Dữ liệu vị trí và bộ phận sai làm ma trận bỏ sót người | 2 | 3 | 2 | 12 | Cao | Báo cáo "không khớp"; Position Mapping; "unmapped" không tự vào đối tượng; chạy lại báo cáo nền trước WP-3 | DATA-01, MTX-05 |
| R-17 | Tài khoản thử và tải bị coi là nhân sự (432 tài khoản Active không mã nhân viên) | 2 | 3 | 1 | 6 | Trung bình | Chỉ người có mã nhân viên đủ điều kiện (D-36) | DATA-02 |
| R-18 | Bộ phận ngưng làm mã đào tạo không đúng ý | 1 | 2 | 1 | 2 | Thấp | D-35: cho cấp mã theo bộ phận tài liệu, không cho chọn bộ phận ngưng khi tạo mới | NUM-06 |
| R-19 | Revision Pending Training hiện có (SOP.0017) bị gián đoạn | 2 | 1 | 1 | 2 | Thấp | Giữ `MANUAL` (D-28) | INT-13 |
| R-20 | Đua dữ liệu khi hai người duyệt hoặc xác nhận cùng lúc | 3 | 2 | 2 | 12 | Cao | Khóa dòng; khóa lạc quan; chỉ một thành công | CON-04, CON-05 |
| R-21 | Việc nền lặp hoặc mất (thông báo, ghi ngày hoàn thành) | 2 | 2 | 2 | 8 | Trung bình | Outbox idempotent; đọc lại trước khi tác động; màn việc lỗi | JOB-01..JOB-05 |
| R-22 | Lịch ngày làm việc sai làm báo hạn sai | 1 | 2 | 2 | 4 | Thấp | Bảng ngày nghỉ có kiểm soát; kiểm thử ngày lễ | JOB-06 |
| R-23 | Quyền cấp bằng SQL không có hiệu lực do đệm | 1 | 3 | 1 | 3 | Thấp | Ghi trong hướng dẫn kiểm thử; khởi động lại | AUTH-10 |
| R-24 | Bản scan ký tay giả hoặc không khớp bản giấy | 3 | 1 | 3 | 9 | Trung bình | Người nhận xác nhận đã đối chiếu; SHA-256; Audit; báo cáo tỷ lệ ký tay | SIG-06, SIG-07 |
| R-25 | Hồ sơ mất do không sao lưu `training_*` và tệp | 3 | 1 | 3 | 9 | Trung bình | Đối chiếu phạm vi sao lưu; kiểm thử khôi phục (WP-HARDEN) | REC-BK-01 |
| R-26 | Mã thử cũ còn sót làm người dùng nhầm | 1 | 2 | 1 | 2 | Thấp | Dọn hẳn từng màn khi thay (WP-FE-CLEAN) | CLN-01 |
| R-27 | SOP và lưu đồ không thống nhất ở bước duyệt nội dung | 1 | 2 | 2 | 4 | Thấp | Thiết kế theo quyền không phụ thuộc tên; QA thống nhất tài liệu | — (việc của QA) |
| R-28 | Ngày hoàn thành đào tạo bị đặt trước khi đào tạo thật (nhập muộn, tương lai) | 2 | 2 | 2 | 8 | Trung bình | Ngày không ở tương lai; lưu cả ngày thực tế và ngày ghi; QA xác nhận | DI-05, ACT-08 |

## 3 Đánh giá toàn vẹn dữ liệu theo ALCOA+

| Thuộc tính | Nguy cơ chính | Kiểm soát | Rủi ro |
|---|---|---|---|
| Attributable | Người thực hiện không rõ, tài khoản chung | Người lấy từ phiên; chữ ký gắn người; ảnh chụp tên, mã, bộ phận, vị trí | R-03, R-06 |
| Legible | Chỉ lưu ảnh | Dữ liệu có cấu trúc; PDF có mã kiểm | R-02 |
| Contemporaneous | Nhập muộn, ngày tương lai | Thời gian máy chủ; ngày không ở tương lai; lưu hai ngày | R-28 |
| Original | Bản gốc ký tay mất | Bản scan gốc có SHA-256, người nhận xác nhận | R-24 |
| Accurate | Kết quả tính sai, nhập sai | Máy chủ tính; kiểm tra tính nhất quán | R-04, R-11 |
| Complete | Bỏ sót người vắng, hồ sơ cũ | Danh sách đủ; không xóa; vô hiệu | R-01, R-16 |
| Consistent | Hai nơi sửa ngày | Một nguồn (Training ghi, Document Control đọc) | R-11 |
| Enduring | Mất khi sao lưu | Lưu 10 năm; sao lưu | R-25 |
| Available | Không truy xuất được | Truy xuất theo người, hoạt động, tài liệu | R-02 |

## 4 Rủi ro còn lại và theo dõi

- Rủi ro **R-10** (hồi quy Document Control) là rủi ro lớn nhất về kỹ thuật. Kiểm soát chính là quy trình làm việc (lát nhỏ, chạy lại test) chứ không phải thiết kế; **kết quả phải được báo trung thực** sau mỗi lát.
- Rủi ro **R-16** phụ thuộc dữ liệu thật; không thể kết luận từ DEV.
- Mọi rủi ro Trung bình và Thấp được theo dõi qua hồ sơ từng gói.

## 5 Phê duyệt

| Vai trò | Họ tên | Ngày | Chữ ký |
|---|---|---|---|
| Người soạn (trợ lý) | — | 2026-10-16 | — |
| QA xác nhận | | | |
