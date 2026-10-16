# PLAN-RP-001 · Kế hoạch triển khai Reports & Analytics và cấu hình báo cáo

Ngày: 2026-10-14. Căn cứ: SDS-RP-001 (mục 17 và 18) và các bản ghi `REPORT-*-2026-10-14` trong
`eqms-backend/docs/governance/DECISION_LOG.md`. Mỗi việc dưới đây phải có bằng chứng (test hoặc kiểm tra thủ công) trước khi
đánh dấu xong. Trạng thái: **XONG** (đã làm và kiểm chứng), **ĐANG LÀM**, **CHƯA LÀM**.

Nguyên tắc: không đổi dữ liệu bằng cách sửa migration đã chạy. Mọi thay đổi dữ liệu đi qua migration mới, và mọi
thay đổi có chữ ký hoặc lý do đều được ghi nhật ký kiểm soát.

## Giai đoạn 1: an toàn dữ liệu và cấu hình (làm ngay)

| ID | Việc | Quyết định | Lớp | Rủi ro GMP | Tiêu chí chấp nhận | Trạng thái |
|---|---|---|---|---|---|---|
| 1.1 | Đánh dấu xóa mềm ba mẫu `TEST_` | REPORT-TEST-TEMPLATES | DB (V578) | Cao | Ba mẫu có `deleted_at`, không xuất hiện trong danh mục; lịch sử còn nguyên | XONG (xem bằng chứng) |
| 1.2 | Thời gian lưu file là vĩnh viễn | REPORT-FILE-RETENTION-PERMANENT | DB (V578), BE, FE | Cao | Không mẫu nào gắn chính sách lưu giữ; file mới không có `expires_at`; API từ chối gắn chính sách; màn hình ghi "Vĩnh viễn" | XONG (xem bằng chứng) |
| 1.3 | Ẩn màn phân tích khỏi sản xuất | REPORT-ANALYTICS-PRODUCTION | DB (V578), BE (menu) | Trung bình | Cờ `feat-report-analytics` có mặt, tắt; menu không hiện Overview và Quality Analytics khi cờ tắt | XONG (xem bằng chứng) |

**Còn lại trong giai đoạn 1 (ghi nhận, không làm trong đợt này):**
- Đường dẫn `/report/overview` và `/report/analytics` vẫn mở được bằng URL khi cờ tắt. Chúng vẫn hiện dữ liệu mẫu có banner
  "Design preview". Cần quyết định có chặn đường dẫn ở FE hay không. (Mở rộng ở mục 1.3.)
- DEV: cờ tắt sau migration, nên DEV cũng không thấy phân tích cho đến khi quản trị viên bật lại trong Cài đặt. Đây là hành vi
  đúng theo quyết định (sản xuất tắt; DEV dùng để xem).

## Giai đoạn 2: quyết định cần chữ ký, nhật ký và thông báo

| ID | Việc | Quyết định | Lớp | Rủi ro GMP | Tiêu chí chấp nhận | Trạng thái |
|---|---|---|---|---|---|---|
| 2.1 | Legal hold: đặt một người, gỡ phải là người khác, có chữ ký | REPORT-LEGAL-HOLD | BE, API, FE (lịch sử lần chạy) | Cao | Gỡ bởi người đã đặt bị từ chối (test); gỡ không có chữ ký bị từ chối (test); có màn hình thật; nhật ký có người đặt và người gỡ | XONG: `ReportLegalHoldTest` 7/7, màn lịch sử có nút, V579. Còn thiếu test FE cho hộp thoại và kiểm tra trên DEV. |
| 2.2 | Chữ ký khi đổi định nghĩa có ảnh hưởng | REPORT-DEFINITION-SIGNATURE | BE, API, FE (ESignatureModal) | Cao | Đổi trường, bộ lọc, phạm vi, định dạng, bật tắt mẫu cần chữ ký (test); đổi tên không cần; ý nghĩa chữ ký "Thay đổi định nghĩa báo cáo" | XONG: `ReportTemplateSignatureTest` 5/5, trình soạn mở hộp thoại ký, V579. Còn thiếu test FE và kiểm tra trên DEV. |
| 2.3 | Lịch: người phụ trách, chuyển giao, thông báo khi tạm ngưng | REPORT-SCHEDULE-OWNER | DB (cột `owner_user_id`), BE, API, FE | Trung bình | Lịch có người phụ trách; chuyển giao cần lý do và nhật ký; khi tạm ngưng có thông báo tới người phụ trách | XONG trên DEV (V580): cột chủ lịch, API `PUT /reports/schedules/{id}/owner` có lý do và nhật ký, thông báo khi tạm ngưng tới chủ và người tạo (đã kiểm trên MailHog). Chưa làm: người quản trị báo cáo nhận thông báo (chờ quyết định về ai là quản trị). Chi tiết: change record mục 2.3/2.4.
| 2.4 | Thông báo lịch: trong ứng dụng và email (chỉ liên kết) | REPORT-NOTIFICATION-CHANNEL, REPORT-DELIVERY-CHANNEL | DB (ghi `report_delivery_attempts`), BE, FE (thông báo) | Cao | Mỗi người nhận có thông báo trong ứng dụng; email chỉ chứa liên kết, không đính kèm; mỗi lần gửi (kể cả lỗi) có một dòng `report_delivery_attempts`; liên kết đòi đăng nhập và kiểm quyền | XONG trên DEV (V580, `ReportDeliveryService`): thông báo trong ứng dụng và email chỉ có liên kết, mỗi lần gửi được ghi vào `report_delivery_attempts` (kể cả bỏ qua, lỗi). Đã kiểm trên MailHog cho thông báo tạm ngưng. **Chưa kiểm trên DEV** thông báo "báo cáo đã sẵn sàng" (cần người tạo lịch có quyền chạy báo cáo, chờ quyết định cấp quyền trên DEV). **Chờ IT và bảo mật duyệt máy chủ mail trước khi bật email trên môi trường thật.** |
| 2.5 | Mẫu thử chỉ có trên DEV | REPORT-TEST-TEMPLATES | BE (cấu hình nạp theo môi trường) | Trung bình | Môi trường không phải DEV không có mẫu `TEST_` đang hoạt động; DEV có thể nạp lại | CHƯA LÀM |

## Giai đoạn 3: cần quyết định hoặc dữ liệu từ người khác trước khi làm

| ID | Việc | Ai cung cấp | Trạng thái |
|---|---|---|---|
| 3.1 | Xác định báo cáo nào dùng cho quyết định GMP (phạm vi "Official") | QA Manager | CHƯA CÓ. REPORT-OFFICIAL-VALIDATION chỉ chốt nguyên tắc; phạm vi chưa có. |
| 3.2 | Chỉ báo "Chưa được xác nhận cho quyết định GMP" trên file | QA Manager (nội dung), BE/FE (triển khai) | CHƯA LÀM. Làm được ngay khi có nội dung. |
| 3.3 | Trạng thái "Đã xác nhận" gắn với phiên bản mẫu; người xác nhận khác tác giả | QA Manager | CHƯA LÀM. Phụ thuộc 3.1. |
| 3.4 | Màn Access & Data Scope, Output Controls, Delivery, Validation: thay dữ liệu mẫu bằng dữ liệu thật | Chủ dự án (ưu tiên) | CHƯA LÀM. Các màn vẫn là thiết kế mẫu. |
| 3.5 | Phân tích: nguồn số liệu thật, tổng hợp phía server, tái tạo được | Chủ dự án (ưu tiên) | CHƯA LÀM. |
| 3.6 | Kiểm tra renderer có tạo PDF/A không (lưu lâu dài) | BE | CHƯA LÀM. Làm khi có yêu cầu lưu trữ dài hạn cụ thể. |
| 3.7 | Dung lượng lưu file vĩnh viễn và sao lưu | Chủ dự án, IT | CHƯA LÀM. |

## Ghi chú về kiểm soát thay đổi

- Các thay đổi giai đoạn 1 được ghi trong `eqms-backend/docs/validation/REPORT_GMP_DECISIONS_2026_10_14_CHANGE_RECORD.md`.
- Chưa dùng được GitNexus `impact` và `detect_changes` cho các symbol đã sửa: chỉ mục đã cũ (commit 75e436a) và lần làm mới
  trước bị lỗi FTS. Phạm vi gọi hàm được kiểm tra bằng tìm kiếm mã (xem bản ghi thay đổi). Cần làm mới chỉ mục trước khi
  bắt đầu giai đoạn 2.

## Bằng chứng giai đoạn 1

- 1.1 (TEST_): DB sau V578 cho thấy ba mẫu `TEST_` có `deleted = true`, `active = false`. Bằng chứng: bản ghi thay đổi, mục Verification.
- 1.2 (vĩnh viễn): DB sau V578 cho thấy 0 mẫu gắn chính sách lưu giữ và 0 file chưa xóa có ngày hết hạn. Test
  `ReportPlatformRetentionPermanentTest` 2/2 pass.
- 1.3 (phân tích): DB cho thấy cờ `feat-report-analytics` tắt. Test menu chưa tự động hóa; kiểm tra bằng cấu hình và mã.
- Chi tiết, danh sách file, và phần chưa làm: `eqms-backend/docs/validation/REPORT_GMP_DECISIONS_2026_10_14_CHANGE_RECORD.md`.

