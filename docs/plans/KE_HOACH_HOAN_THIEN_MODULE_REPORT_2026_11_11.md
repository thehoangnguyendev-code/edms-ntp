# Kế hoạch hoàn thiện module Report & Analytics (2026-11-11)

Trạng thái: **KẾ HOẠCH, chưa code.** Căn cứ: đọc source, đếm bảng trên DEV, gọi thử API đọc trên DEV. Chưa mở từng màn hình, chưa chạy lại test. Không phải phê duyệt GMP.
Mỗi phase là một thay đổi có kiểm soát: một bản ghi theo `eqms-backend/docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md`, impact GitNexus trước khi sửa symbol, `detect_changes` trước khi commit. Chỉ làm trên DEV. Không commit nếu chủ hệ thống chưa yêu cầu.

## 1. Quyết định của chủ hệ thống (2026-11-11)

| # | Quyết định |
|---|---|
| D1 | Màn hình Reports Overview và Quality Analytics sẽ nối dữ liệu thật, **làm sau cùng**. |
| D2 | Hai nhóm nguồn dữ liệu đầu tiên: **Document Control** và **Training**. |
| D3 | Giới hạn dòng: **bắt buộc có bộ lọc; "Full" là một lựa chọn khi chạy.** Full vẫn chạy nền và ghi Audit Trail. Không cần quyền riêng. |

Quyết định này **chưa** nói đến: Backup & Restore (chờ chủ hệ thống cho biết dữ liệu nằm ở đâu và trường nào được hiện), việc ẩn hay giữ các mục menu Overview/Analytics trong lúc chờ (kế hoạch giữ nguyên, vẫn có biểu ngữ "Design preview").

## 2. Hiện trạng cần sửa (tóm tắt)

- Overview, Analytics, Run Detail Preview dùng `sampleData.ts` (số bịa), không nối server.
- Chỉ có 2 nguồn: Document Register (8 cột) và Audit Trail.
- Giới hạn mặc định 10.000 dòng; DEV có 10.796 tài liệu và đã có 1 lần chạy lỗi `REPORT_ROW_LIMIT_EXCEEDED`.
- Quyền `report.module.export` chỉ thấy dùng ở màn hình lịch chạy.

## 3. Các phase

### R1. Chính sách số dòng: bắt buộc lọc, có Full
- Mỗi Report Type khai báo bộ lọc nào đếm là "đã lọc" (ví dụ Document Register: trạng thái, bộ phận, đơn vị, loại, khoảng ngày). Chạy mà không có bộ lọc nào và không chọn Full thì bị từ chối bằng thông báo rõ.
- Màn hình chạy có lựa chọn **Full**. Full: chạy nền, tính trước số dòng, ghi Audit Trail (ai chạy, loại report, có Full).
- Có lọc nhưng kết quả vượt giới hạn mặc định thì báo rõ và gợi ý thu hẹp bộ lọc hoặc chọn Full.
- **Đề xuất của trợ lý, cần xác nhận:** trần an toàn cho Full cấu hình được trong Report Properties (đề xuất 200.000 dòng); PDF của lần chạy Full bị giới hạn số dòng thấp hơn (rất nặng), vượt thì chỉ cho CSV/XLSX; XLSX không quá 1.048.576 dòng.
- Bằng chứng: test âm tính (không lọc → từ chối; Full ghi audit; vượt trần Full → từ chối), hai lần chạy Full đồng thời không làm hỏng nhau.

### R2. Nguồn Document Control
- Document Register: thêm cột Revision hiện hành, tác giả, chủ sở hữu, ngày hết hạn, ngày review kế tiếp, chu kỳ review, yêu cầu đào tạo, ngôn ngữ, loại phụ. Tên người luôn là tên, không bao giờ là id.
- Loại mới: **Revisions** (số, trạng thái, giai đoạn, thời gian chờ ở giai đoạn hiện tại, người nộp, ngày nộp, ngày publish).
- Loại mới: **Controlled Copies** và **Uncontrolled Copies** (số, mục đích, trạng thái, người nhận, ngày phân phối, hạn, thu hồi, số lần tải/in).
- Mỗi loại tuân theo phạm vi quyền (Personal / Department / Business Unit / System) như Document Register hiện có; không mở rộng quyền xem.

### R3. Nguồn Training
- **Training Records** (hồ sơ đào tạo: người, tài liệu, revision, ngày hoàn thành, kết quả, phương thức).
- **Training Activities** (đợt đào tạo: trạng thái, hạn, ngày hoàn tất, người tổ chức).
- **Participants / Absences** (vắng mặt, chưa học bù).
- Tái dùng cách tính của `TrainingComplianceController` (summary, coverage, matrix-completion) làm định nghĩa chỉ số, không viết lại công thức khác.
- Phạm vi quyền theo từng người, bộ phận, đơn vị, hệ thống như Training đang áp dụng.

### R4. Các nguồn khác (sau R2, R3; làm khi chủ hệ thống bảo)
Authentication Events, Electronic Signatures, Access Review và SoD, Knowledge Base, Storage. Mỗi loại chỉ làm sau khi có danh sách cột cho phép hiện và quyền nguồn. **Backup & Restore** chờ trả lời Q3 trong `REPORT_PLATFORM_2026_10_15_DESIGN.md`.

### R5. Chất lượng (chạy xuyên suốt, chốt trước R6)
- Test âm tính cho Audit Trail: không có `audit.view` thì không thấy loại và API trả 403; xuất mà thiếu `audit.export` thì bị từ chối; khoảng ngày; không có cột bí mật; hai lần chạy đồng thời.
- Quét UUID trong file PDF/XLSX/CSV xuất ra.
- Kiểm tra các danh sách report không bị lặp loading khi URL có tham số.
- Làm rõ `report.module.export` dùng cho việc gì.
- Viết bản ghi thay đổi cho P1 và P2 đã build từ trước (chưa có) và cho R1–R4.

### R6. Làm sau cùng: nối dữ liệu thật cho Overview và Analytics
- **Reports Overview:** "Needs your attention" từ `/reports/runs` và `/reports/schedules` (lỗi, file sắp hết hạn, lịch bị tạm ngưng); Recent runs và Upcoming schedules từ API sẵn có; "Pinned reports" cần API mới lưu theo người dùng.
- **Quality Analytics:** chỉ số Document Control và Training lấy từ nguồn R2/R3 và `DashboardService`. Chỉ vẽ số thật; khi lỗi hiện "—", không hiện 0; chuỗi không có dữ liệu thì bỏ khoảng trống.
- Xóa `sampleData.ts`, biểu ngữ "Design preview" và màn hình Run Detail Preview (`/report/runs/preview`) vì đã có `ReportRunDetailPage` thật. **Đề xuất của trợ lý, cần xác nhận.**

## 4. Thứ tự và phụ thuộc

R1 → R2 → R3 → (R4 khi được bảo) → R5 → R6. R5 chạy song song nhưng phải xong trước R6.

## 5. Việc không làm trong kế hoạch này
Viết SQL tự do, công thức do người dùng tự nhập, nối nhiều bảng do người dùng chọn, thay đổi chính Audit Trail, thay đổi chính sách giữ file, dashboard ngoài module Report.
