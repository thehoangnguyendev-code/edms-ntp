# Phương án đổi tên cột và nhãn trên các màn hình Report (theo mẫu Document Control)

Ngày: 2026-11-15. Trạng thái: **ĐỀ XUẤT, chờ chủ hệ thống duyệt**. Chưa đổi tên nào của đợt này (chỉ 4 điểm đã duyệt đã được làm, xem Decision Log `REPORT-FIELD-NAMES-2026-11-15`).

## 1. Quy ước của Document Control (căn cứ: các cột của danh sách trong `features/documents`)

| Quy ước | Ví dụ thật trong Document Control |
|---|---|
| Tên cột mang **tên đối tượng** khi cột đứng cùng bảng với nhiều đối tượng | `Document Number`, `Document Name`, `Document Type`, `Document Revision`, `Controlled Copy Number`, `Controlled Copy Name`, `Related Document`, `Correlated Document` |
| Người: động từ + `By` | `Opened By`, `Requested By`, `Distributed By` |
| Ngày: sự kiện + `Date` | `Effective Date`, `Expiry Date`, `Requested Date`, `Distributed Date`, `Recall Date` |
| Yes/No có dấu hỏi | `Required Training?` |
| Tên trơ (`Name`, `Code`, `Status`) chỉ dùng khi **tên trang đã nói rõ đối tượng** | trang cài đặt như Document Types: `Name`, `Code` |

Document Control cũng có chỗ chưa thống nhất (`Created`, `Last Updated`, `Document Revision` ở Copies nhưng `Revision` ở nơi khác). Phương án dưới đây mượn **quy ước**, không sao chép các chỗ lệch.

## 2. Nguyên tắc cho module Report

- **P1** Cột nói về một đối tượng khác với đối tượng chính của trang phải mang tên đối tượng: `Report Template Number`, không phải `Template Number`.
- **P2** Đối tượng chính của trang thì tên trơ chỉ được dùng ở trang cài đặt có tiêu đề rõ (`Report Appearance` → cột `Appearance Name`; vẫn nên nói rõ, vì cột `Name` bị chỉ ra là khó hiểu).
- **P3** Một khái niệm, một tên trên mọi màn: trang danh sách, trang chi tiết, bộ lọc, form, tooltip, thông báo, tệp xuất, token trang bìa.
- **P4** Tên hiển thị khác mã máy: mã (`sourceCode`, `templateCode`) giữ nguyên.

## 3. Danh sách đề xuất theo ảnh bạn gửi

### 3.1 Report Library và Report Templates (ảnh 1 và 4)

| Hiện tại | Giá trị trong cột | Vấn đề | Đề xuất |
|---|---|---|---|
| `Template Number` | `RPT.0008` | Template của cái gì | `Report Template Number` |
| `Template Name` | `EQMS - Audit e2e` | Như trên | `Report Template Name` |
| `Revision` | `1.0.0`; ở Report Templates có thêm `Revision in progress` | Revision của template hay của cái gì; ở Report Templates có hai cột revision không nói cái nào là cái đang có hiệu lực | Report Library: `Report Template Revision`. Report Templates: `Effective Revision` và `Revision In Progress` |
| `Data Source` | `Audit Trail`, `Document Register` | Đây thực chất là **Report Type** (đã kiểm code: cột hiển thị nhãn của `sourceCode`, trùng tên các Report Type ở màn Report Types) | `Report Type` (bộ lọc cùng tên) |
| `Category` | `Metadata`, `Document` | **Không phải** Report Type. Là phân loại nội bộ của template (43 template `METADATA`, 1 `DOCUMENT`); người dùng không có cách hiểu giá trị này | **Cần quyết định:** ẩn cột (khuyến nghị, vì người dùng không dùng được) hoặc đổi tên `Template Category` |
| `GMP` | `GMP`/`Not GMP` | Thiếu đối tượng; chỗ khác gọi `Used for GMP decisions` | `Used for GMP Decisions` (cột và bộ lọc) |
| `Orientation` | `Landscape` | Hướng của cái gì | `Page Orientation` (bộ lọc đã gọi vậy) |
| `Output Formats` | `PDF · XLSX · CSV` | Ổn, nhưng nên một tên ở mọi nơi | `Output Formats` (số nhiều, vì là danh sách) |

### 3.2 Report Run History (ảnh 2)

| Hiện tại | Vấn đề | Đề xuất |
|---|---|---|
| `Report Name` | Tên báo cáo người dùng đặt khi tạo; ổn nhưng đứng cạnh hai cột `Template` | Giữ `Report Name` **[cần quyết định: bạn cũng đánh dấu cột này; nếu bạn thấy khó hiểu, có thể dùng `Generated Report Name`]** |
| `Template` | Giá trị là mã `RPT.0039`, không phải tên | `Report Template Number` |
| `Template Revision` | Ổn nhưng không cùng cách gọi với Library | `Report Template Revision` |
| `Queued`, `Completed` | Không nói là thời điểm | `Queued At`, `Completed At` (theo quy ước R3 đã duyệt cho trường báo cáo) |
| `Run Type` | Giá trị `Filtered`/`Full`; đúng nhưng sai hoa thường | `Run Type` giữ; đổi giá trị hiển thị nếu cần: `Filtered`, `Full report` |
| `Size`, `Format`, `Status` | `Size` của cái gì; `Status` của cái gì | `File Size`, `Output Format`, `Run Status` |
| `Progress` | Tiến độ gì | `Run Progress` |
| `Reason` | Lý do của việc gì (hiện là lý do thất bại) | `Failure Reason` |

### 3.3 Scheduled Reports (ảnh 3)

| Hiện tại | Vấn đề | Đề xuất |
|---|---|---|
| `Template` | Giá trị là mã (`DOCUMENT_STATUS`, `RPT.0004`): hai kiểu mã lẫn lộn trong một cột | `Report Template Number` |
| `Owner` | Chủ của cái gì | `Schedule Owner` |
| `Schedule` | Giá trị `0 0 6 * * *` (cron), không ai đọc được | `Frequency` và hiển thị câu dễ đọc ("Every day at 06:00"); giữ cron trong chi tiết. **[cần xác nhận: chỉ đổi cách hiển thị, không đổi dữ liệu]** |
| `Status` | Như trên | `Schedule Status` |
| `Next Run` | Ổn | `Next Run At` |

### 3.4 Report Appearance (ảnh 5) và Report Types (ảnh 6)

| Màn | Hiện tại | Đề xuất |
|---|---|---|
| Report Appearance | `Name` | `Appearance Name`; `Status` → `Appearance Status`; `Last Changed`, `Changed By`, `Activated` → `Last Updated`, `Last Updated By`, `Activated Date` |
| Report Types | `Name`, `Code`, `Category`, `Description`, `Columns`, `Templates`, `Status` | `Report Type Name`, `Report Type Code`, `Report Type Category`, `Number of Columns`, `Number of Templates`, `Report Type Status` |

Với Report Appearance và Report Types, tên trơ gần như đủ rõ vì tiêu đề trang đã nói. Tôi vẫn đề xuất đổi `Name` vì bạn đã chỉ ra nó khó hiểu. Nếu bạn thấy tên trơ chấp nhận được ở trang cài đặt, bỏ nhóm này.

## 4. Các màn liên quan phải đổi theo

Một khái niệm đổi tên thì phải đổi ở mọi nơi dưới đây, nếu không hai màn sẽ gọi một thứ bằng hai tên. Cột "Kiểm" là việc phải làm; số file dựa trên tìm chuỗi trong mã nguồn (chưa chắc đã đủ, vì có chuỗi ghép động).

| Khái niệm | Nơi xuất hiện (đã tìm thấy) | Kiểm |
|---|---|---|
| `Template Number/Name/Revision` | `ReportTemplateCatalog`, `ReportTemplateDetailPage`, `ReportTemplateEditor`, `ReportTemplateRevisionPage`, `ReportTemplateRevisionsView`, `ReportRunDetailPage`, `ReportPropertiesView` (7 file FE); `ReportRunReportMetadataProvider` (BE: nguồn Report Runs có `Template Number`, `Template Name`) kèm DB `report_definition_fields` của các template dùng nguồn này | Sửa nhãn, tiêu đề trang chi tiết, breadcrumb, nhãn form, tooltip, lỗi hiển thị |
| `Template` (cột) | `ReportHistoryView`, `ReportRunDetailPage`, `ScheduledReportsView`, `ReportOverviewView` | Cột, nhãn bộ lọc `Template` của Run History, nhãn trong form lịch (`ScheduleEditorPage`) |
| `Report Name` | `ReportHistoryView`, `ReportRunDetailPage`, `ReportTemplateRun`, `reportTokens.ts` (token trang bìa "Report name") | Create Report, trang chi tiết, token |
| Token trang bìa/trang báo cáo | `reportTokens.ts`: `Template number`, `Template revision`, `Template name`, `Template approved by` | Đổi cả tên token nhìn thấy trong Report Appearance. **Không đổi mã token** (`report.code`, `template.version`...) vì báo cáo đã cấu hình dùng mã |
| Tệp xuất và báo cáo sinh ra | Tên cột trong PDF/XLSX/CSV lấy từ tên trường (đã xử lý ở migration V791 cho 5 tên; các tên khác cần migration tương tự) | Báo cáo đã sinh giữ tên cũ |
| Thông báo (in-app, e-mail) | Văn bản thông báo về template (đã có `report.template_rejected`...) | Rà từng mẫu có chữ "Template" |
| Audit Trail | Tên đối tượng và trường ghi vào nhật ký khi sửa template (ví dụ `Template Revision` ở `RevisionService` thuộc Document Control, không đổi) | Chỉ rà phần Report |
| Tài liệu (SDS, As-Is) | `docs/` | Cập nhật cùng thay đổi |
| Test | Các test FE dùng `getByText("Template Number")`... và test BE kiểm tên trường | Sửa theo |

## 5. Cách làm và rủi ro

1. **Một danh mục tên duy nhất** (hằng số FE `reportLabels.ts` mở rộng) để mọi màn dùng chung; tránh gõ lại chuỗi ở từng file. Nên làm trước khi đổi để lần sau đổi tên chỉ sửa một chỗ.
2. Đổi FE (nhãn cột, bộ lọc, form, breadcrumb, tiêu đề), rồi BE (nguồn Report Runs), rồi DB (`report_definition_fields`) bằng migration kế tiếp, như V791.
3. Bộ lọc dùng mã (`sourceCode`, `status`...) nên đổi nhãn không phá lịch đã lưu **[chưa kiểm cho từng bộ lọc]**.
4. Kiểm thử: test hiển thị từng màn, test đối chiếu `field_code` trước/sau, ảnh chụp từng màn (tôi chưa chụp được vì không có mật khẩu DEV).

## 6. Cần bạn quyết định

1. Duyệt P1–P4.
2. Cột `Category` của Report Library / Report Templates: ẩn hay đổi tên `Template Category`.
3. `Data Source` đổi thành `Report Type`.
4. `Report Name` ở Run History: giữ hay `Generated Report Name`.
5. Với Report Appearance và Report Types: đổi `Name` thành tên có đối tượng hay giữ (tiêu đề trang đã rõ).
6. Cột `Schedule` hiển thị cron: đổi sang câu dễ đọc (chỉ hiển thị).
