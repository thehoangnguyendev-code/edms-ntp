SDS-RP-001 · Mô tả hiện trạng từ mã nguồn · phiên bản 0.2 · 2026-10-15

# SDS Reports & Analytics và Report Administration

Đặc tả phần mềm cho menu **Reports & Analytics** (7 mục) và **Report Administration** (Report Definitions, Report Name Formats, Report Properties, Report Types và các mục còn lại) của hệ thống eQMS. Tài liệu mô tả
những gì mã nguồn đang làm, không phải những gì nên làm. Các chỗ cần thay đổi được ghi ở mục 17 và 18.

**Trạng thái:** MÔ TẢ HIỆN TRẠNG, chưa được chủ dự án và QA duyệt. **TẠM DỪNG từ 2026-10-15** theo yêu cầu của chủ dự án: không làm tiếp Report, Backup và Restore cho đến khi có yêu cầu mới (xem mục 20).
**Phạm vi:** màn hình (frontend), API (`/reports`, `/settings/report-configuration`, `/reports/properties`, `/reports/types`, `/reports/name-formats`), dịch vụ và worker (backend), bảng dữ liệu (migration V359–V593).
**Đọc bởi:** Chủ dự án, QA, IT, dev.

**Chú giải nhãn** (cùng cách dùng với SDS-BR-001):

- **ĐÃ KIỂM TRA**: thấy trong mã nguồn đã đọc, hoặc trong test/tài liệu xác nhận.
- **ĐỀ XUẤT**: thiết kế của người soạn, chưa có trong hệ thống.
- **QUYẾT ĐỊNH**: chủ nghiệp vụ hoặc QA phải chốt.
- **THIẾU**: chưa có trong hệ thống, hoặc có một phần nhưng không dùng được.

---

## 0 Kiểm soát tài liệu

| Mục | Nội dung |
|---|---|
| Mã tài liệu | SDS-RP-001 |
| Phiên bản | 0.2 (cập nhật 2026-10-15: giao diện công ty, Stamp, Report Types, nguồn Audit Trail; mục 5.6 đến 5.9 và mục 20) |
| Nguồn bằng chứng | Mã frontend `eqms/src/features/report`, `features/report-analytics`, `features/settings/report-configuration`, `services/api/report*.ts`; mã backend `ReportPlatformService`, `ReportTemplateService`, `ReportArtifactPublisher`, `ReportJobWorker`, `ReportScheduleAdministrationService`, các renderer trong `service/report`; controller `Report*Controller`; migration V359, V360, V361, V392, V435, V530–V536, V578–V593 |
| Tài liệu đã có | `eqms-backend/docs/validation/REPORT_*_CHANGE_RECORD.md`, `REPORT_TEMPLATE_API_AND_UAT.md`, `REPORT_GMP_DECISIONS_2026_10_14_CHANGE_RECORD.md`, thiết kế `REPORT_PLATFORM_2026_10_15_DESIGN.md`, Decision Log (các mục `REPORT-*`) |
| Chưa kiểm tra | Phần gốc (phiên bản 0.1) dựa trên đọc mã. Từ phiên bản 0.2, phần được ghi "ĐÃ KIỂM TRA TRÊN DEV" đã chạy thật bằng API (và một số màn bằng trình duyệt tự động); phần còn lại xem mục 19 và 20. |
| Cập nhật lần cuối | 2026-10-15. Mọi thay đổi từ 2026-10-14 đến 2026-10-15 nằm trên DEV, **chưa commit**, chưa có change record riêng (xem mục 20). |

---

## 1 Tóm tắt hiện trạng

Hai menu có hai mức hoàn thiện khác nhau. Phần lõi là **báo cáo theo mẫu (template)**: tạo, chạy, lưu kết quả, tải về, lên lịch. Phần
**phân tích** và các màn **quản trị ngoài Định nghĩa báo cáo** chỉ hiển thị dữ liệu mẫu.

| Màn hình | Menu | Trạng thái | Dữ liệu | Ghi chú |
|---|---|---|---|---|
| Reports Overview | Reports & Analytics | Thiết kế mẫu | `sampleData.ts` | Có banner "Design preview". Nút không gọi server. |
| Quality Analytics | Reports & Analytics | Thiết kế mẫu | `sampleData.ts` | Biểu đồ và KPI là số mẫu. |
| Report Library | Reports & Analytics | Thật | API mẫu báo cáo | Danh mục, lọc, xem trước, chạy báo cáo từ mẫu. |
| Report Run History | Reports & Analytics | Thật | API lần chạy | Lọc, tải file, thử lại, xem trạng thái. |
| Scheduled Reports | Reports & Analytics | Thật | API lịch | Tạo, sửa, tạm dừng, tiếp tục, xóa lịch. |
| Run detail (`/report/runs/preview`) | (không có trong menu) | Thiết kế mẫu | `SAMPLE_RUN_DETAIL` | Màn xem chi tiết một lần chạy chưa nối API. |
| Report Definitions | Report Administration | Thật | API cấu hình | Trang Report Library có chế độ quản trị: sửa mẫu, bố cục, trường, lịch sử. |
| Report Name Formats | Report Administration | Thật | API `/reports/name-formats` | Quy tắc đặt tên mẫu; giao diện như Document Name Formats (2026-10-14). |
| Report Properties | Report Administration | Thật | API `/reports/properties` | Số mẫu, giới hạn, **giao diện công ty (Report Appearance)**. Mục 5.4a và 5.6. |
| Report Types | Report Administration | Thật | API `/reports/types` | Các nguồn dữ liệu báo cáo; bật, tắt. Mục 5.7. |
| Report Access & Data Scope | Report Administration | Thiết kế mẫu | `SAMPLE_ACCESS` | Chỉ đọc. Phạm vi dữ liệu thật nằm ở từng mẫu. |
| Report Retention & Legal Hold | Report Administration | Thiết kế mẫu | `SAMPLE_HOLDS` | Nút Legal hold chỉ hiện thông báo. Legal hold thật chỉ qua API. |
| Scheduled Report Delivery | Report Administration | Thiết kế mẫu | `SAMPLE_DELIVERIES` | **Không có gửi thư.** Xem mục 10. |

Nhãn: **ĐÃ KIỂM TRA** cho cột trạng thái, theo `features/report-analytics/*.tsx` (import `sampleData`), `admin/ReportAdminScreens.tsx`
(`SAMPLE_*`, `ReportAdminPage` không gọi API) và `features/report/*` (import `services/api/report*`).

---

## 2 Phạm vi, menu và quyền

### 2.1 Menu và route

| Menu (id) | Đường dẫn | Quyền xem menu | Ghi chú |
|---|---|---|---|
| Reports Overview (`report-overview`) | `/report/overview` | `report.module.view` | Thiết kế mẫu |
| Quality Analytics (`report-analytics`) | `/report/analytics` | `report.module.view` | Thiết kế mẫu |
| Report Library (`report-templates`) | `/report/templates` | `report.module.view` | Thật |
| Report Run History (`report-history`) | `/report/history` | `report.module.view` | Thật |
| Scheduled Reports (`report-scheduled`) | `/report/scheduled` | `report.module.view` | Thật |
| Report Properties (`report-admin-properties`) | `/settings/report-properties` | `reports.properties.view` hoặc `reports.properties.manage` | Thật |
| Report Types (`report-admin-types`) | `/settings/report-types` | `reports.types.view` hoặc `reports.types.manage` | Thật |
| Report Definitions (`report-admin-definitions`) | `/settings/report-configuration` | `reports.definition.view` hoặc `settings.configuration.view` | Thật |
| Report Name Formats (`report-admin-name-formats`) | `/settings/report-name-formats` | `reports.definition.view`, `reports.name_format.manage` hoặc `settings.configuration.view` | Thật |
| Các mục Report Administration còn lại | `/settings/administration/report/{access,output,retention,delivery}` | `reports.definition.view` hoặc `settings.configuration.view` | Thiết kế mẫu |

**ĐÃ KIỂM TRA.** `app/navigation.ts` (mục `report`, `report-administration`), `app/routes.constants.ts` (`REPORT`, `REPORT_ADMINISTRATION`),
`app/routes/QualityRoutes.tsx` (`report/*`), `app/routes/SettingsRoutes.tsx`.

Route `/report/*` không khớp mục nào sẽ chuyển về `/report/templates`. Route `/report/compliance` không có màn hình.

### 2.2 Mã quyền và việc chúng cho phép

Quyền có hai thế hệ. Hàm kiểm tra của dịch vụ chấp nhận **quyền mới hoặc quyền cũ** (alias). Ví dụ `require(actor, "reports.run.create", "report.module.export")`
nghĩa là một trong hai là đủ.

| Mã quyền | Cho phép | Nơi kiểm tra |
|---|---|---|
| `report.module.view` | Mở menu và các trang của Reports & Analytics; danh mục (cũ) | Route, dịch vụ `catalog` |
| `reports.catalog.view` | Xem danh mục báo cáo | `catalog()` |
| `reports.run.create` (cũ: `report.module.export`) | Tạo lần chạy, tạo lịch, tạm dừng/tiếp tục/xóa lịch | `queueRun`, `createSchedule`, `pauseSchedule`... |
| `reports.run.view_own` | Xem lần chạy của chính mình | `runs()` |
| `reports.run.view_all` | Xem lần chạy của mọi người | `runs()` |
| `reports.artifact.download` | Tải file kết quả | `download()`, `hasArtifactDownloadPermission` |
| `reports.schedule.view` / `reports.schedule.manage` | Xem / quản lý lịch | `schedules()`, `scheduleUpdate`, `deleteSchedule` |
| `reports.definition.view` | Xem cấu hình mẫu, lịch sử mẫu | `ReportConfigurationController`, `templates.adminCatalog` |
| `reports.definition.manage` (cũ: `settings.configuration.manage`) | Sửa mẫu, trường, bố cục, xem trước bố cục | `save`, `updateConfiguration`, `ReportLayoutController` |
| `reports.retention.manage` (cũ: `reports.definition.manage`) | Đặt hoặc gỡ legal hold trên file | `setArtifactLegalHold` |
| `reports.definition.approve` | Duyệt hoặc trả về Draft một revision của mẫu (có chữ ký điện tử; người duyệt không là tác giả hay người gửi) | `approve`, `reject` |
| `reports.definition.upgrade` | Upgrade Report Template: tạo revision kế tiếp từ revision Effective | `upgrade` |
| `reports.definition.discard_revision` | Bỏ revision Draft đã tạo bằng Upgrade | `discardRevision` |
| `reports.definition.set_enabled` | Bật / tắt mẫu đang dùng (xác nhận và nhật ký, không chữ ký) | `setEnabled` |
| `reports.name_format.manage` | Quy tắc tên mẫu | `ReportNameFormatService` |
| `reports.properties.view` / `reports.properties.manage` | Xem / sửa Report Properties: quy tắc số mẫu, giới hạn, **giao diện công ty**; xem trước và tải thành phần Word của giao diện | `ReportPropertiesService`, `ReportLayoutController` |
| `reports.types.view` / `reports.types.manage` (V593) | Xem các Report Type / bật hoặc tắt một Report Type (cần lý do, ghi Audit Trail). Migration không gán cho ai; DEV: file `DEV_TEST_REPORT_TYPES_2026_10_15.sql` | `ReportTypeService` |
| `audit.view` **và** `audit.export` | Cùng lúc cần cả hai để dùng Report Type "Audit Trail" (mục 5.8) | `ReportTypeService.mayUse` |

**Quyền tạo mẫu.** Việc tạo và sửa mẫu do quyền `reports.definition.manage` (hoặc `settings.configuration.manage`) quyết định. Hai quyền này gán cho bất kỳ Access Profile nào qua Permission Set; mã không nhìn
tài khoản hay vai trò "admin". Quyền "chỉ tạo mẫu" tách riêng đã được cân nhắc và **không xây** (quyết định của trợ lý, 2026-10-15, chờ xác nhận).

**Việc gì được làm với một mẫu cụ thể do máy chủ quyết định**, theo ba điều kiện của Permission Model Playbook: quyền (tích trong Permission Set), trạng thái của mẫu, và người thực hiện (người duyệt khác tác giả).
`GET /authorization/resources/REPORT_TEMPLATE/{số mẫu}/capabilities` (hợp đồng chung `ResourceCapabilitiesResponse`) trả về từng hành động: `viewRevisions`, `edit`, `submitForApproval`, `approve`, `reject`,
`upgrade`, `discardRevision`, `disable`, `enable`, `delete`, `createReport`, mỗi hành động có `allowed`, `reasonCode` ổn định và `requiredPermissionCode`. Màn hình chỉ hiện nút theo kết quả này, không nêu tên tài khoản hay vai trò;
đây chỉ là gợi ý giao diện, từng dịch vụ kiểm tra lại quyền khi thực hiện. Ba quyền mới (V589) không được gán cho ai bởi migration; quản trị viên tích trong Security & Authorization > Permission Sets.

**ĐÃ KIỂM TRA.** Các mã trên đều có trong migration (V359, V435, V396 và các bản sửa quyền khác). Toàn bộ mã quyền mà frontend
dùng cho báo cáo đều có trong backend.

### 2.3 Phạm vi dữ liệu (data scope)

Mỗi mẫu có danh sách vai trò với một phạm vi, lưu ở `report_template_role_scopes`. Bốn phạm vi được chấp nhận:

| Phạm vi | Nghĩa khi chạy báo cáo | Trạng thái |
|---|---|---|
| `SYSTEM` | Mọi tài liệu | ĐÃ KIỂM TRA |
| `BUSINESS_UNIT` | Tài liệu thuộc đơn vị kinh doanh của người chạy | ĐÃ KIỂM TRA |
| `DEPARTMENT` | Tài liệu thuộc phòng ban của người chạy | ĐÃ KIỂM TRA |
| `PERSONAL` | Tài liệu người chạy là tác giả hoặc người tham gia luồng | ĐÃ KIỂM TRA |

Phạm vi được tính khi tạo lần chạy và được kiểm tra lại khi tạo file và khi tải về (xem mục 6.3). Nếu người chạy không còn quyền,
lần chạy thất bại với `REPORT_AUTHORIZATION_CHANGED`.

Mỗi Report Type quyết định những phạm vi nào được cấp cho một Access Profile (`allowedScopes`): Document Register nhận cả bốn phạm vi; **Audit Trail chỉ nhận `SYSTEM`** (mục 5.8). Phạm vi không được phép bị từ chối khi lưu mẫu (`REPORT_SCOPE_NOT_ALLOWED_FOR_TYPE`).

Màn **Report Access & Data Scope** là bản thiết kế mẫu. Ma trận vai trò thật là phạm vi trên từng mẫu, sửa ở Report Definitions.
Xem mục 12.

---

## 3 Kiến trúc

### 3.1 Thành phần

- **Frontend:** `features/report` (thư viện mẫu, lịch sử, lịch, trình soạn mẫu và bố cục, xem trước thời gian thực);
  `features/report-analytics` (Overview, Analytics, Run detail, admin khung mẫu); `features/settings/report-configuration`
  (chỉ là hai trang bọc `ReportTemplateCatalog` và `ReportTemplateEditor`).
- **API client:** `services/api/reports.ts` (lần chạy, lịch, tải file), `reportTemplates.ts` (mẫu, bố cục, xem trước),
  `report.ts` (danh mục và xem trước cũ).
- **Backend:**
  - `ReportPlatformController` (`/reports`): danh mục, chạy, lần chạy, file, lịch.
  - `ReportTemplateController` (`/reports/templates`): danh mục, mẫu, xem trước, xóa mềm.
  - `ReportLayoutController` (`/reports/templates/layout`): xem trước bố cục và thành phần Word.
  - `ReportConfigurationController` (`/settings/report-configuration`): cấu hình mẫu, lịch sử.
  - `ReportPropertiesController` (`/reports/properties`), `ReportNameFormatController` (`/reports/name-formats`), `ReportTypeController` (`/reports/types`).
- **Dịch vụ:** `ReportPlatformService` (hàng đợi, lịch, file, lease, retention, legal hold); `service/report/ReportTemplateService`
  (mẫu, ảnh chụp phạm vi, tái xác thực); `ReportArtifactPublisher` (ghi file đã xuất bản, có journal); `ReportScheduleAdministrationService`
  (chi tiết và sửa lịch); renderer `ReportPdfRenderer`, `ReportWordService`, `ReportPresentationRenderer`, `ReportCharts`.
- **Worker:** `ReportJobWorker` chạy theo chu kỳ 1500 ms (`app.reports.worker-delay-ms`), có khóa phân tán `report-platform-worker`
  (giữ 2 phút). Mỗi chu kỳ: thu hồi lease hết hạn, dọn file hết hạn, tối đa 4 lịch đến hạn, tối đa 4 lần chạy đang chờ.
- **Lưu file:** `FileStorageService.storeReportArtifact` (cấu hình ở cơ sở lưu trữ chung; khóa đường dẫn theo
  `StoragePathBuilder.reportArtifact`).

- **Dịch vụ thêm từ 2026-10-14:** `ReportPropertiesService` (thiết lập và giao diện công ty), `ReportTemplateRevisionService`, `ReportTemplateNumberService`, `ReportNameFormatService`, `ReportTypeService` (đăng ký Report Type, bật/tắt), `ReportFonts`, `ReportStampBox` (hộp Stamp), `ReportImage` (giải mã logo).
- **Giao diện thêm:** `features/report/properties` (Report Properties, nhúng `ReportLayoutDesigner`), `features/report/types` (Report Types), `features/report/templates/ReportChartsEditor`, `ReportStampEditor`, `ReportStampBox`, `ReportMarkCanvas` (thư viện `react-konva`, dùng chung kiểu với Controlled Copy).

**ĐÃ KIỂM TRA** toàn bộ mục 3.1 theo các file đã đọc.

### 3.2 Hàng đợi chạy báo cáo

Một lần chạy đi qua các trạng thái: `QUEUED` → `PROCESSING` → `COMPLETED`, hoặc `RETRY_SCHEDULED` → … → `FAILED`. Việc nhận công
việc dùng `FOR UPDATE SKIP LOCKED`, không có hai worker cùng nhận một lần chạy.

---

## 4 Mô hình dữ liệu

Các bảng dưới đây được tạo bởi V359 và sửa bởi các migration sau. **ĐÃ KIỂM TRA** cấu trúc cột trong migration.

| Bảng | Vai trò | Ghi chú |
|---|---|---|
| `report_definitions` | Mẫu báo cáo: mã, tên, mô tả, danh mục, phân loại, `active`, `definition_version`, `allowed_formats`, `limits`, `access_policy`, `delivery_policy`, `retention_policy_id`, `source_code`, `layout`, `deleted_at` | `access_policy` và `delivery_policy` được đọc và trả về màn hình, nhưng **không có logic nào thi hành** (xem mục 17). |
| `report_definition_fields` | Trường của mẫu: `allowed`, `default_selected`, `required`, thứ tự | Ràng buộc `UNIQUE(definition_code, field_code)` |
| `report_definition_versions` | Lịch sử mẫu: ảnh chụp JSON, lý do, người sửa | Ghi mỗi lần sửa cấu hình hoặc trường |
| `report_template_role_scopes` | Phạm vi dữ liệu theo vai trò của mẫu | Chỉ mục theo `(role_id, definition_code)` |
| `report_runs` | Lần chạy: mẫu, phiên bản, người yêu cầu, định dạng, tham số, trường, sắp xếp, **ảnh chụp quyền**, trạng thái, lease, số lần thử, `idempotency_key`, `report_title`, `as_of_at` | `UNIQUE(requester_user_id, idempotency_key)` |
| `report_run_events` | Nhật ký sự kiện của lần chạy: QUEUED, SCHEDULED, COMPLETED, RETRY_SCHEDULED, DEAD_LETTERED, ARTIFACT_PURGED, LEGAL_HOLD_APPLIED/RELEASED | Chỉ thêm, không sửa |
| `report_artifacts` | File kết quả: định dạng, tên, khóa lưu trữ, phiên bản đối tượng, MIME, kích thước, SHA-256, `expires_at`, `legal_hold`, `purged_at` | `UNIQUE(run_id, format)`; file không bị xóa khỏi bảng |
| `report_artifact_publication_journal` | Nhật ký ghi file trước khi xuất bản, theo lần thử | Dùng để phát hiện file mồ côi |
| `report_schedules` | Lịch: mẫu, người tạo, cron, tham số, trường, ảnh chụp quyền, `active`, `status`, `next_run_at`, `last_run_at`, `version` | Trạng thái lịch: `ACTIVE`, `PAUSED`, `SUSPENDED_AUTHORIZATION_CHANGED`, `SUSPENDED_INVALID_SCHEDULE` |
| `report_schedule_recipients` | Người nhận lịch | **Chỉ được ghi và đọc lại trên màn hình, không dùng để gửi.** Xem mục 10. |
| `report_delivery_attempts` | Lần thử gửi tới người nhận | Được tạo (V359); từ V580 mỗi lần thông báo được ghi (kênh, sự kiện, trạng thái). Xem mục 10. |
| `report_template_revisions` | Revision của mẫu: số, trạng thái, `snapshot` nội dung khi đang soạn (V584–V589) | Mục 5.5 |
| `report_name_formats` | Quy tắc đặt tên mẫu; một quy tắc đang hoạt động (chỉ mục duy nhất, V591) | Mục 5.4a |
| `report_properties` | **Một dòng**: tiền tố và số chữ số của số mẫu, bộ đếm, số dòng tối đa, người nhận tối đa, thử lại lịch, `appearance` (JSONB, giao diện công ty, V592), `version` | V590, V592; mục 5.4a và 5.6 |
| `report_types` | Trạng thái bật/tắt của mỗi Report Type (`code`, `enabled`, `version`); loại chưa có dòng coi là bật (V593) | Mục 5.7 |
| `retention_policies` (dùng chung) | Chính sách lưu giữ, gắn vào mẫu qua `retention_policy_id` | Số ngày lấy từ chính sách đang hoạt động khi tạo file |

**Chỉ mục** quan trọng: `idx_report_runs_claim (status, next_attempt_at, queued_at)`, `idx_report_runs_history (requester_user_id, definition_code, status, queued_at DESC)`,
`idx_report_schedules_claim (active, next_run_at)`, `idx_report_artifacts_expiry_purge`.

---

## 5 Mẫu báo cáo và trường

### 5.1 Nguồn dữ liệu

Từ 2026-10-15 có **hai** nguồn đăng ký (gọi là **Report Type**, mục 5.7): `DOCUMENT_STATUS` (lớp `DocumentReportMetadataProvider`, tên hiển thị "Document Register") và `AUDIT_TRAIL` (lớp `AuditTrailReportMetadataProvider`, mục 5.8).
Phần dưới mô tả nguồn Document Register.
Nguồn cung cấp các cột và bộ lọc sau, đều nằm trong danh sách cho phép:

- Cột: số tài liệu, tên, trạng thái, phòng ban, đơn vị kinh doanh, ngày hiệu lực, ngày tạo, loại tài liệu.
- Bộ lọc: tìm kiếm, trạng thái, phòng ban, đơn vị kinh doanh, loại tài liệu, khoảng ngày tạo, khoảng ngày hiệu lực.
- Trường bắt buộc: số tài liệu, tên tài liệu.

Bất kỳ bộ lọc hoặc trường nào ngoài danh sách đều bị từ chối (`REPORT_FILTER_NOT_ALLOWED`, `REPORT_FIELD_NOT_ALLOWED`).

**ĐÃ KIỂM TRA.** `DocumentReportMetadataProvider.java`. Hợp đồng `ReportMetadataProvider` gồm cột, nhãn, bộ lọc, truy vấn theo phạm vi, và (từ 2026-10-15) `category`, `description`, `usePermissions` (một trong), `requiredPermissions` (tất cả), `allowedScopes`, `validateRun`.

### 5.2 Mẫu được seed bằng migration

| Mã | Tên | Định dạng | Hoạt động | Nguồn |
|---|---|---|---|---|
| `DOCUMENT_STATUS` | Document Status Report | PDF, XLSX, CSV | Có | DOCUMENT_STATUS |
| `REVISION_LIFECYCLE` | Revision Lifecycle Report | CSV | Cờ bật, nhưng không có nguồn dữ liệu: không hiện trong danh mục và không chạy được (xem 17.11) | Không có |
| `AUDIT_TRAIL_EXTRACT` | Audit Trail Extract | CSV | Cờ bật, nhưng không có nguồn dữ liệu: không hiện trong danh mục và không chạy được (xem 17.11) | Không có |
| `TEST_DOCUMENT_REGISTER`, `TEST_DOCUMENT_LIFECYCLE`, `TEST_DEPARTMENT_REGISTER` | "TEST · …" | PDF, XLSX, CSV | Đã xóa mềm và tắt từ 2026-10-14 (V578, REPORT-TEST-TEMPLATES) | DOCUMENT_STATUS |

Mẫu không hoạt động (`active = false`) không chạy được. Ba mẫu `TEST_` được seed bởi V533 trong cùng đường migration như mẫu thật (xem mục 17).

### 5.3 Cấu hình mẫu

Người có `reports.definition.manage` sửa mẫu qua trình soạn (`ReportTemplateEditor`). Các phần chính:

1. **Chung:** số mẫu (Template Number, do hệ thống cấp, xem 5.5; không nhập tay, không đổi sau khi tạo), tên hiển thị (≤255 ký tự), mô tả (≤2000), trạng thái, định dạng được phép.
2. **Trường và mặc định:** cho phép, chọn sẵn, bắt buộc. Số tài liệu và tên tài liệu luôn bắt buộc.
3. **Phạm vi theo vai trò:** mỗi vai trò đang hoạt động một phạm vi (`PERSONAL`, `DEPARTMENT`, `BUSINESS_UNIT`, `SYSTEM`).
4. **Biểu đồ (Charts):** tối đa 6 biểu đồ, mỗi biểu đồ một trang PDF (loại, trường nhóm, đếm hoặc phần trăm, số nhóm tối đa hiển thị 5-20, phần dư gộp thành "Other (n groups)"); chỉ dùng trường đã chọn. **Từ 2026-10-15 mẫu chỉ còn giữ biểu đồ**; mọi thứ khác của bố cục là giao diện công ty (mục 5.6). Trình soạn mẫu có các tab General, Fields & Defaults, Charts, Access & Scope và History.
5. **Mô tả (Description):** bắt buộc (từ 2026-10-14); đồng thời là lý do thay đổi ghi vào lịch sử và nhật ký kiểm soát (thay cho ô "Change reason").

Từ 2026-10-14 mẫu được quản lý theo **Revision** (mục 5.5); bộ đếm `definition_version` chỉ còn là phiên bản kỹ thuật dùng để chống ghi đè. Xóa là xóa mềm (`deleted_at`, `deleted_by_user_id`), mẫu vẫn còn trong lịch sử.

**ĐÃ KIỂM TRA** trong `ReportTemplateService.save`, `ReportTemplateController`, `ReportPlatformService.updateConfiguration/updateFields`.

### 5.4 Thay đổi cấu hình qua `ReportConfigurationController`

`PATCH /settings/report-configuration/definitions/{code}` cho sửa tên, mô tả, danh mục, phân loại, trạng thái, chính sách lưu giữ.
Lý do là bắt buộc. Mỗi lần sửa:

- tăng `definition_version` (qua cập nhật bản ghi),
- ghi một dòng vào `report_definition_versions`,
- ghi nhật ký kiểm soát `REPORT_CONFIGURATION_UPDATED`.

`PATCH .../fields` ghi `REPORT_FIELDS_UPDATED` theo cùng cách. Không có chữ ký điện tử cho thay đổi mẫu (xem mục 14).

### 5.4a Report Properties (REPORT-PROPERTIES-2026-10-15)

Màn **Report Properties** (`/settings/report-properties`, API `GET/PUT /reports/properties`, bảng `report_properties`, quyền `reports.properties.view` / `reports.properties.manage`) gom các thiết lập của module,
bố cục như Document Properties. Mỗi lần lưu cần phiên bản đã đọc, kiểm tra giới hạn trên server và ghi Audit Trail (thực thể `REPORT_PROPERTIES`) kèm các giá trị đã đổi.

| Thiết lập | Giới hạn | Nơi áp dụng |
|---|---|---|
| Tiền tố số mẫu, số chữ số của số thứ tự | 2-10 ký tự chữ hoa/số; 3-8 chữ số | Cấp số mẫu (mục 5.5) |
| Số dòng tối đa của một file báo cáo | 1 000-100 000 (mặc định 10 000) | `render` khi xuất, `previewPdf`, worker chạy báo cáo |
| Số người nhận tối đa của một lịch | 1-500 (mặc định 200) | Tạo lịch |
| Chờ bao lâu để thử lại lịch sau lỗi tạm thời | 1-60 phút (mặc định 5) | Worker lịch |

**Report Name Format:** mẫu mới được đặt tên bằng **quy tắc đang hoạt động duy nhất** (V591); người tạo không chọn quy tắc. Bật một quy tắc sẽ tắt quy tắc đang bật. Mẫu cũ giữ tên đã có.
**Report Appearance:** giao diện công ty, lưu cùng các thiết lập trên (mục 5.6).

Giới hạn số dòng thấp đi sau này không làm file báo cáo cũ không tải được (kiểm tra tải dùng trần cố định 100 000). Màn **Report Output Controls** (bản thiết kế, không ghi gì) và màn **Report Template Numbering**
đã được thay bằng màn này (2026-10-15).

### 5.5 Số mẫu, Revision, Upgrade, Disable (REPORT-TEMPLATE-NUMBER và REPORT-TEMPLATE-REVISION, 2026-10-14)

**Số mẫu.** Hệ thống cấp, dạng `<tiền tố>.<số thứ tự>` (mặc định `RPT.0001`; tiền tố 2-10 ký tự chữ hoa/số, số thứ tự 3-8 chữ số). Quy tắc nằm trong
`report_properties` (một dòng, V590), chỉnh ở Report Administration > **Report Properties** (quyền `reports.properties.manage`, kiểm tra phiên bản, nhật ký
`REPORT_PROPERTIES_UPDATED` ghi rõ giá trị trước và sau). Số thứ tự chỉ tăng, được khóa dòng khi cấp, bỏ qua số đã có mẫu giữ (kể cả mẫu đã xóa). Đổi quy tắc chỉ ảnh hưởng số cấp sau. Tạo mẫu: `POST /reports/templates`.

**Revision.** Mỗi mẫu có các revision đánh số (Rev 1, Rev 2, ...) trong `report_template_revisions`: `DRAFT`, `PENDING_APPROVAL`, `EFFECTIVE`, `OBSOLETE`, `DISCARDED`.
Một revision đang soạn và một revision hiệu lực tại một thời điểm (chỉ mục duy nhất). Các dòng sống của mẫu (`report_definitions`, trường, phạm vi) luôn là revision **hiệu lực**, nên đường chạy báo cáo, lịch và thư viện không đổi.
Revision đang soạn nằm trong `snapshot` (đủ nội dung) cho đến khi được duyệt; mẫu chưa từng duyệt có Rev 1 với nội dung trong các dòng sống.

- **Upgrade Report Template** (`POST /reports/templates/{code}/upgrade`, cần lý do và phiên bản hiện tại): tạo Rev kế tiếp ở trạng thái Draft từ revision hiệu lực. Chỉ khi có revision hiệu lực và chưa có revision nào đang mở. Revision hiệu lực không sửa trực tiếp (lưu bị từ chối `REPORT_UPGRADE_REQUIRED`).
- **Luồng duyệt** như cũ: gửi duyệt, duyệt có chữ ký điện tử bởi người khác tác giả và người gửi, trả về Draft có chữ ký. Khi duyệt, nội dung ghi vào các dòng sống, revision thành `EFFECTIVE`, revision cũ thành `OBSOLETE` (vẫn xem được).
- **Discard Revision** (`POST .../discard-revision`): bỏ revision Draft có revision hiệu lực đứng trước, cần lý do; revision giữ lại với trạng thái `DISCARDED`.
- **Disable / Enable** (`POST .../disable`, `.../enable`): có hiệu lực ngay, chỉ cần xác nhận (lý do không bắt buộc) và nhật ký `REPORT_TEMPLATE_DISABLED/ENABLED`; không tạo revision. Không cần chữ ký (chủ sở hữu, 2026-10-14).
- **Xem và so sánh:** `GET .../revisions` (lọc, sắp xếp, phân trang phía server), `.../revisions/{n}` (nội dung đầy đủ), `.../revisions/{n}/compare?with=previous|effective|n` (phần khác biệt do server tính).
- **Lần chạy** ghi revision (suy ra từ phiên bản mà lần chạy đã ghi); token bố cục `template.version` in ra revision.

**ĐÃ KIỂM TRA** bằng `ReportTemplateRevisionTest`, `ReportTemplateRevisionActionsTest`, `ReportTemplateNumberTest` và chạy thật trên DEV ngày 2026-10-14. **CHƯA KIỂM TRA** trên trình duyệt.

### 5.6 Giao diện công ty (REPORT-COMPANY-APPEARANCE-2026-10-15)

**Chủ dự án (2026-10-15):** mọi báo cáo dùng chung một giao diện công ty.

- **Nơi đặt:** Report Properties > **Report Appearance** (cột `report_properties.appearance`, V592). Gồm: trang bìa, tiêu đề phụ, header, footer, số trang, **font toàn báo cáo**, **Stamp**, **Watermark**, **Logo**, hướng giấy, thành phần Word (bìa, header, footer).
- **Mẫu chỉ giữ biểu đồ.** `TemplateWrite` chỉ giữ `charts` của bố cục khi lưu (`ReportLayout.chartsOnly()`). Bố cục cũ đã lưu trong các mẫu không bị xóa nhưng **bị bỏ qua** khi chạy.
- **Khi chạy:** `ReportTemplateService.snapshot` ghép giao diện công ty hiện tại với biểu đồ của mẫu và **ghim vào ảnh chụp của lần chạy** (`definition.layout`). Lần chạy đã tạo giữ nguyên giao diện lúc tạo; thay đổi giao diện chỉ áp cho lần chạy sau khi lưu.
- **Lưu:** `PUT /reports/properties`, quyền `reports.properties.manage`, kiểm tra phiên bản; Audit Trail `REPORT_PROPERTIES_UPDATED` ghi **tên các phần đã đổi** ("font, stamp changed"), không ghi nội dung logo. Font không hợp lệ bị từ chối (`REPORT_FONT_INVALID`).
- **Font:** Noto Sans, Noto Serif, Roboto Mono, Oswald và **Times New Roman** (in bằng Tinos, font có cùng độ rộng chữ; giấy phép SIL OFL, `fonts/Tinos-OFL.txt`; font của Microsoft không được cấp phép nhúng). Tiếng Việt hiển thị đúng. Times New Roman cũng được thêm vào Stamp và Watermark của **Controlled Copy** (`ControlledCopyPdfMarkingService`, `ControlledCopyPolicyService`, 2026-10-15); chính sách đã lưu không đổi.
- **Logo:** chọn tối đa 10 MB; trình duyệt thu nhỏ trước khi đưa vào bố cục (cạnh dài ≤ 1600 px, ≤ 3 triệu điểm ảnh, dữ liệu ≤ 1,3 MB; PNG hoặc JPEG); máy chủ tự kiểm tra lại giới hạn (≤ 1 MB, ≤ 4 triệu điểm ảnh).
- **Watermark:** các trường Text, Color, Layer, Font, Opacity (5-50), Pages dùng cùng thành phần với tab PDF Markings của Controlled Copies Policy; vị trí, độ xoay và kích thước chỉnh bằng cách kéo trên xem trước (`ReportMarkCanvas`, Konva).
- **Xem trước:** `POST /reports/templates/layout/preview-page` trả JSON (ảnh PNG base64, kích thước trang, vị trí Stamp do máy chủ tính); quyền xem trước gồm `reports.properties.manage`.

**ĐÃ KIỂM TRA TRÊN DEV** (API và trình duyệt tự động, 2026-10-15): lưu giao diện, bị từ chối với font sai (400) và khi không đổi gì (409), Audit Trail ghi đúng; khung Stamp hiện, kéo và phóng to được. **CHƯA KIỂM TRA:** một lần chạy báo cáo thật cho thấy giao diện công ty trong file PDF; màn Report Properties trên trình duyệt sau khi lưu.

**Stamp** (viết riêng nhưng cùng logic Controlled Copy): hộp có khung, chữ giữa, cỡ chữ 13 pt, lề trong 0,6 cỡ chữ. Chưa kéo: góc trên phải, cách mép 4 mm, rộng tối đa 1/3 trang. Đã kéo: cạnh trái và cạnh trên là phần trăm của trang, độ rộng là phần trăm chiều rộng trang và phóng cả hộp; không cao quá 1/3 trang, không ra ngoài trang; luôn nằm trên nội dung. Trường: Text (≤ 40 ký tự), Color, Font, Opacity 30-100, Pages (mọi trang hoặc trang đầu); bỏ Font size, Rotation, Layer. Lớp `ReportStampBox`, record `ReportLayout.Stamp`; layout cũ có các trường thừa vẫn đọc được (bị bỏ qua). Test `ReportStampTest` (5).

### 5.7 Report Types (REPORT-PLATFORM-2026-10-15, giai đoạn 1)

Một **Report Type** là một nguồn dữ liệu báo cáo viết trong mã (một `ReportMetadataProvider`). Quản trị chỉ xem, **bật hoặc tắt**; không viết SQL.

- **Màn hình** `/settings/report-types`: bố cục như Report Name Formats (tìm kiếm, lọc trạng thái và nhóm, sắp xếp, phân trang đều do máy chủ làm; dòng mở rộng hiện cột và bộ lọc; menu 3 chấm View Detail, Enable/Disable) và trang chi tiết `/settings/report-types/{code}`.
- **API:** `GET /reports/types` (lọc `status`, `category`, `search`, `sortBy` ∈ name/code/category/columns/templates/status, phân trang), `GET /reports/types/{code}`, `POST /reports/types/{code}/enabled` `{version, enabled, reason}`. Bật/tắt cần quyền `reports.types.manage`, lý do, phiên bản đã đọc (409 `REPORT_TYPE_VERSION_CHANGED`), Audit Trail `REPORT_TYPE_ENABLED` / `REPORT_TYPE_DISABLED`.
- **Hiệu lực khi tắt:** không tạo, không sửa mẫu và không chạy với type đó (`REPORT_TYPE_DISABLED`); lịch của các mẫu đó bị tạm ngưng với lý do "template disabled". Báo cáo đã tạo và cấu hình mẫu vẫn đọc được. Danh sách nguồn khi tạo mẫu chỉ có type đang bật và người dùng có quyền dùng.
- **Quyền dùng type** được kiểm tra khi tạo hoặc sửa mẫu, khi bắt đầu chạy, khi dựng file và khi tải lại file.
- **Trình soạn mẫu:** trường "Metadata Source" đổi thành **Report Type**, kèm mô tả.

**ĐÃ KIỂM TRA TRÊN DEV** bằng API và trình duyệt tự động (xem danh sách, mở rộng dòng). Test `ReportTypeServiceTest` (5), `ReportTypesView.test.tsx` (4). **CHƯA KIỂM TRA** Enable/Disable bằng bấm trên giao diện.

### 5.8 Report Type "Audit Trail" (giai đoạn 2)

- **Nguồn:** bảng `audit_logs` (nối `app_users` để lấy tên người dùng khi bản ghi cũ thiếu). Mã `AUDIT_TRAIL`, nhóm "Audit".
- **Cột:** Timestamp, Module, Action, Record, From Status, To Status, Description, Reason, User, Employee Code, Department, IP Address, Electronic Signature. **Không có** giá trị cũ/mới, user agent, thiết bị, mã chữ ký. Bắt buộc: Timestamp, Module, Action.
- **Bộ lọc:** tìm kiếm, Module, Action, From date, To date. Giá trị luôn là tham số, không nối vào SQL.
- **Quyền:** cần **cả** `audit.view` **và** `audit.export`.
- **Phạm vi:** chỉ `SYSTEM` (màn Audit Trail không chia theo phòng ban); phạm vi khác bị từ chối khi lưu mẫu và khi truy vấn.
- **Khoảng thời gian bắt buộc:** From và To, đúng thứ tự, tối đa **92 ngày** (tính cả hai ngày); lỗi `REPORT_AUDIT_RANGE_REQUIRED`, `REPORT_AUDIT_RANGE_TOO_WIDE`, `REPORT_DATE_RANGE_INVALID`. Ngày "To" tính trọn ngày.
- **ĐÃ KIỂM TRA TRÊN DEV** (API): tạo, gửi duyệt và duyệt mẫu; chạy không có ngày, 200 ngày, filter lạ, cột lạ đều bị từ chối; chạy 1-15/10 module `REPORT_TYPE` ra đúng 2 dòng; PDF 32 KB. Test `AuditTrailReportSourceTest` (6). Hai mẫu thử RPT.0007 và RPT.0008 còn trên DEV.
- **QUYẾT ĐỊNH (chờ QA):** giới hạn 92 ngày; cần cả hai quyền; chỉ phạm vi SYSTEM; **xuất từ màn Audit Trail cần chữ ký điện tử và lý do, còn chạy báo cáo thì không** (chỉ có chữ ký duyệt mẫu và bản ghi của lần chạy). **THIẾU:** khoảng ngày tương đối ("30 ngày gần nhất") cho báo cáo theo lịch; lịch hiện giữ nguyên ngày đã đặt.

### 5.9 Quyết định của chủ dự án ngày 2026-10-15

| Câu hỏi | Trả lời | Ghi chú |
|---|---|---|
| Nguồn dữ liệu và thứ tự | Document Control, Audit Trail, Backup & Restore | Backup & Restore chưa làm (mục 20) |
| Ai được tạo mẫu | Người có quyền phù hợp trong Access Profile, không chỉ quản trị viên | Đã đúng với mô hình hiện tại |
| Mẫu không dùng cho GMP có cần chữ ký duyệt? | **Có** | Giữ như hiện nay |
| Người có `reports.definition.manage` xem và sửa mẫu của người khác? | **Có** | |
| Dữ liệu Backup & Restore nằm ở đâu? | **Chưa biết** | Cần tìm hiểu ở giai đoạn 3 |
| Báo cáo Audit Trail có khoảng thời gian bắt buộc và giới hạn? | **Có** | Con số 92 ngày là đề xuất của trợ lý |

---

## 6 Chạy báo cáo

### 6.1 Yêu cầu

`POST /reports/runs` nhận mẫu, định dạng, tham số, trường, sắp xếp và header tùy chọn `Idempotency-Key` (≤160 ký tự).

1. Kiểm tra quyền `reports.run.create`.
2. Kiểm tra mẫu tồn tại; lấy **ảnh chụp** (`templates.snapshot`) gồm phiên bản, trường, bộ lọc, sắp xếp, và phạm vi của người gọi.
3. Kiểm tra định dạng và trường với mẫu đang hoạt động.
4. Ghi một dòng `QUEUED`, kèm ảnh chụp quyền. Nếu cùng `Idempotency-Key` đã có và tham số khác nhau → `REPORT_IDEMPOTENCY_CONFLICT` (409).
5. Ghi sự kiện `QUEUED` và nhật ký kiểm soát `REPORT_RUN_QUEUED`.

Sắp xếp chỉ cho một cột (`REPORT_SORT_NOT_ALLOWED` nếu nhiều hơn). Mặc định là số tài liệu tăng dần.

**ĐÃ KIỂM TRA** trong `ReportPlatformService.queueRun`.

### 6.2 Xử lý

`processOneQueuedRun` nhận một lần chạy đến hạn bằng `FOR UPDATE SKIP LOCKED`, đặt `PROCESSING` với lease 10 phút. Sau đó:

1. Lấy dữ liệu theo giao thức `METADATA_V1` (ảnh chụp mới); lần chạy cũ dùng đường `renderRows` (chỉ `DOCUMENT_STATUS`).
2. Tối đa **số dòng đặt ở Report Properties** (mặc định 10 000; 1 000-100 000).
3. Nếu ảnh chụp có bố cục (từ 2026-10-15 luôn có: giao diện công ty cộng biểu đồ của mẫu) và định dạng không phải CSV: tính biểu đồ và dựng PDF/XLSX/Word bằng bố cục. Nếu không: dựng CSV/XLSX/PDF cơ bản.
4. Kiểm tra kích thước **≤ 50 MB** (`REPORT_ARTIFACT_LIMIT_EXCEEDED`).
5. Tính SHA-256; ghi journal `report_artifact_publication_journal`; lưu file; so khớp checksum với bản do nơi lưu trữ trả về.
6. Tái xác thực quyền của người yêu cầu và danh sách tài liệu nguồn (`templates.reauthorize`). Nếu quyền hoặc tập tài liệu đã đổi → `REPORT_AUTHORIZATION_CHANGED`.
7. Xuất bản (`ReportArtifactPublisher.publish`) trong một giao dịch: chỉ thành công nếu lần chạy vẫn `PROCESSING`, đúng số lần thử và lease còn hạn (`REPORT_WORKER_LEASE_LOST` nếu không).

Hạn lưu file lấy từ chính sách lưu giữ của mẫu tại thời điểm xuất bản.

**ĐÃ KIỂM TRA** trong `processOneQueuedRun`, `ReportArtifactPublisher.publish`.

### 6.3 Lỗi và thử lại

| Lỗi | Kết quả | Thử lại |
|---|---|---|
| `SecurityException` (mất quyền) | `FAILED`, `REPORT_AUTHORIZATION_CHANGED` | Không |
| `IllegalArgumentException`, `ResponseStatusException` (tham số không còn hợp lệ) | `FAILED`, `REPORT_INVALID_CRITERIA` | Không |
| Lỗi khác | `RETRY_SCHEDULED`, `REPORT_GENERATION_FAILED` | Tối đa 3 lần, trễ `min(300 s, 15 s × 2^(n−1))` |
| Lease hết hạn | Thu hồi thành `RETRY_SCHEDULED` (`recoverExpiredLeases`) | Có |

Người dùng có thể **thử lại** một lần chạy qua `POST /reports/runs/{id}/retry`. Mã lỗi và thông báo hiển thị cho người dùng đều là chuỗi cố định, không chứa chi tiết nội bộ.

### 6.4 Tải file

`POST /reports/runs/{runId}/artifacts/{artifactId}/download` (POST để không lộ đường dẫn trong lịch sử trình duyệt):

- yêu cầu `reports.artifact.download` (hoặc quyền cũ `report.module.export`);
- file đã hết hạn hoặc đã bị xóa → lỗi `REPORT_ARTIFACT_EXPIRED`;
- người không có `reports.run.view_all` chỉ tải được file của lần chạy do chính mình tạo (`REPORT_SCOPE_DENIED` nếu không);
- tái xác thực quyền và tài liệu nguồn trước khi trả file;
- đọc file từ nơi lưu trữ và so SHA-256 với giá trị đã ghi; không khớp thì không trả file (xem mục 17.9);
- ghi nhật ký `REPORT_ARTIFACT_DOWNLOADED` (mục 11).

**ĐÃ KIỂM TRA** trong `ReportPlatformController`, `ReportPlatformService.download`, `reportsApi.downloadArtifact`.

---

## 7 Lịch báo cáo (Scheduled Reports)

- **Tạo lịch:** tên (≤255), mẫu, biểu thức cron (Spring `CronExpression`), định dạng, tham số, trường, và danh sách người nhận (≤200).
  Người tạo cần `reports.schedule.manage` (hoặc quyền cũ `report.module.export`). Mỗi người nhận phải đang hoạt động và có quyền tải file, nếu không lịch bị từ chối.
  Khi lịch chạy, người tạo lại phải còn quyền chạy báo cáo (`reports.run.create` hoặc quyền cũ); nếu không, lịch bị tạm ngưng (xem bên dưới).
- **Chạy theo lịch:** worker chọn lịch có `next_run_at ≤ now()`, kiểm tra người tạo còn hoạt động và còn quyền. Nếu không: lịch chuyển sang
  `SUSPENDED_AUTHORIZATION_CHANGED`. Nếu biểu thức cron không tính được lần tiếp theo: `SUSPENDED_INVALID_SCHEDULE`. Lỗi hạ tầng (không phải quyền)
  thì giữ lịch hoạt động và thử lại sau 5 phút.
- **Tạo lần chạy** từ lịch dùng ảnh chụp quyền của người tạo tại thời điểm chạy, ghi sự kiện `SCHEDULED`.
- **Tạm dừng / tiếp tục / xóa** cần `reports.schedule.manage`. Xóa là xóa thật.

**ĐÃ KIỂM TRA** trong `ReportPlatformService.createSchedule`, `processOneDueSchedule`, `ReportScheduleAdministrationService`.

Ghi chú: lịch dùng **quyền của người tạo** tại thời điểm chạy. Nếu người tạo nghỉ việc hoặc mất quyền, lịch bị tạm ngưng và phải có người tiếp nhận.

---

## 8 Phân tích (Overview, Quality Analytics, Run detail)

Ba màn này là thiết kế mẫu, có banner "Design preview". Số liệu, danh sách và biểu đồ đến từ `sampleData.ts`.

- **Reports Overview:** mục "lần chạy gần đây", "lịch", "việc cần làm", "đã ghim" (`SAMPLE_RUNS`, `SAMPLE_SCHEDULES`, `SAMPLE_TODOS`, `SAMPLE_PINNED`).
- **Quality Analytics:** KPI và biểu đồ theo loại, theo tuần, theo giai đoạn revision (`SAMPLE_BY_TYPE`, `SAMPLE_DC_KPIS`, `SAMPLE_REVISIONS_BY_STAGE`, `SAMPLE_RUNS_PER_WEEK`).
- **Run detail:** chi tiết một lần chạy (`SAMPLE_RUN_DETAIL`), không gắn với `runId` thật.

Các màn này không có API. Không có số liệu phân tích thật nào được tạo ra từ dữ liệu hệ thống.

**ĐÃ KIỂM TRA** `ReportOverviewView.tsx`, `ReportAnalyticsView.tsx`, `ReportRunDetailView.tsx`, `ReportAnalyticsPage.tsx` (banner).
**THIẾU:** API và nguồn số liệu cho phân tích. Xem mục 17.

---

## 9 Lưu giữ, hết hạn và legal hold

- **Lưu giữ:** mỗi mẫu có một `retention_policy_id` (chính sách hoạt động). Khi file được xuất bản, `expires_at = now + retention_days`. Không có chính sách → file không bao giờ hết hạn.
- **Dọn file:** worker chọn tối đa 20 file có `expires_at ≤ now`, `legal_hold = false`, chưa dọn. Xóa đối tượng lưu trữ, đánh dấu `purged_at`,
  ghi sự kiện `ARTIFACT_PURGED`. Dòng trong `report_artifacts` và `report_runs` **không bị xóa** (làm bằng chứng).
- **Legal hold:** `POST /reports/runs/{runId}/artifacts/{artifactId}/legal-hold` với `legalHold` và `reason` bắt buộc. File đang giữ không bị dọn.
  Ghi sự kiện `LEGAL_HOLD_APPLIED` / `LEGAL_HOLD_RELEASED` và nhật ký kiểm soát `REPORT_LEGAL_HOLD_*`. Yêu cầu `reports.retention.manage`.

**ĐÃ KIỂM TRA** trong `ReportPlatformService.purgeExpiredArtifacts`, `setArtifactLegalHold`, và `ReportPlatformController`.

**THIẾU:**
- *Cập nhật 2026-10-14 (phase 2.1):* màn lịch sử lần chạy có nút đặt và gỡ legal hold; gỡ cần lý do, người khác với người đặt và chữ ký (REPORT-LEGAL-HOLD-2026-10-14).
- Màn **Report Retention & Legal Hold** là thiết kế mẫu. Nút "Legal hold" chỉ hiện thông báo.
- Chưa có quyết định về số ngày lưu giữ. Màn retention ghi "No period has been approved".

---

## 10 Phân phối (gửi báo cáo tới người nhận)

**ĐÃ TRIỂN KHAI TRÊN DEV (V580), chưa được chủ dự án duyệt.** Theo REPORT-DELIVERY-CHANNEL-2026-10-14 và REPORT-NOTIFICATION-CHANNEL-2026-10-14:

- **Khi báo cáo theo lịch hoàn thành**, mỗi người nhận nhận một thông báo trong ứng dụng và một email chỉ có liên kết tới `/report/history?run=<id>`. File không đính kèm. Liên kết đòi đăng nhập; người nhận không có quyền xem lần chạy (không phải người tạo và không có `reports.run.view_all`) bị ghi `SKIPPED_NOT_AUTHORIZED`.
- **Khi lịch bị tạm ngưng** (`SUSPENDED_AUTHORIZATION_CHANGED` hoặc `SUSPENDED_INVALID_SCHEDULE`), chủ lịch và người tạo đang hoạt động nhận thông báo. Thông báo chỉ nêu tên lịch và lý do; liên kết tới `/report/scheduled` vẫn do màn hình kiểm quyền.
- Mỗi lần gửi, kể cả bị bỏ qua hoặc lỗi, được ghi một dòng vào `report_delivery_attempts` (`channel`, `event_code`, `run_id`, `schedule_id`, `status`, `reason_code`). Lỗi gửi không làm hỏng lần chạy hay việc tạm ngưng.
- Email đi qua cấu hình SMTP hiện có (DEV: MailHog). Môi trường thật cần IT và bảo mật duyệt máy chủ mail trước khi bật.

**Chưa có:** (a) thông báo tới "người quản trị báo cáo" theo REPORT-SCHEDULE-OWNER-2026-10-14, vì chưa có quyết định ai là quản trị; (b) kiểm trên DEV thông báo "báo cáo đã sẵn sàng" với người tạo có quyền chạy báo cáo (xem change record mục 2.3/2.4); (c) màn **Scheduled Report Delivery** vẫn hiển thị bảng nhật ký mẫu (`SAMPLE_DELIVERIES`), chưa đọc `report_delivery_attempts`.

**Chủ lịch:** mỗi lịch có một chủ (`owner_user_id`, mặc định là người tạo, dữ liệu cũ được gán cho người tạo). Đổi chủ cần `reports.schedule.manage`, người tạo hoặc người quản lý tất cả lịch, lý do bắt buộc, và ghi nhật ký `REPORT_SCHEDULE_OWNER_CHANGED`. Chủ lịch không có thêm quyền nào trên lịch.

---

## 11 Sự kiện và nhật ký kiểm soát

| Sự kiện (nhật ký kiểm soát) | Khi nào | Nguồn |
|---|---|---|
| Sự kiện nhật ký (loại đối tượng) | Khi nào | Nguồn |
|---|---|---|
| `REPORT_RUN_QUEUED` (`REPORT_RUN`) | Tạo lần chạy | `queueRun` |
| `REPORT_RUN_RETRY_REQUESTED` (`REPORT_RUN`) | Yêu cầu thử lại | `retryRun` |
| `REPORT_ARTIFACT_DOWNLOADED` (`REPORT_ARTIFACT`) | Tải file thành công | `download` |
| `REPORT_LEGAL_HOLD_APPLIED` / `_RELEASED` (`REPORT_ARTIFACT`) | Đặt hoặc gỡ legal hold | `setArtifactLegalHold` |
| `REPORT_CONFIGURATION_UPDATED` (`REPORT_DEFINITION`) | Sửa cấu hình mẫu | `updateConfiguration` |
| `REPORT_FIELDS_UPDATED` (`REPORT_DEFINITION`) | Sửa trường | `updateFields` |
| `REPORT_SCHEDULE_CREATED` (`REPORT_SCHEDULE`) | Tạo lịch | `createSchedule` |
| `REPORT_SCHEDULE_PAUSED` / `_RESUMED` (`REPORT_SCHEDULE`) | Tạm dừng hoặc tiếp tục lịch | `updateScheduleStatus` |
| `REPORT_SCHEDULE_DELETED` (`REPORT_SCHEDULE`) | Xóa lịch | `deleteSchedule` |
| `REPORT_PROPERTIES_UPDATED` (`REPORT_PROPERTIES`) | Lưu Report Properties, kể cả giao diện công ty (ghi tên các phần đã đổi) | `ReportPropertiesService.update` |
| `REPORT_TYPE_ENABLED` / `REPORT_TYPE_DISABLED` (`REPORT_TYPE`) | Bật hoặc tắt Report Type, kèm lý do | `ReportTypeService.setEnabled` |
| `REPORT_NAME_FORMAT_CREATED` / `_UPDATED` / `_DISABLED` (`REPORT_NAME_FORMAT`) | Quy tắc đặt tên | `ReportNameFormatService` |
| `REPORT_TEMPLATE_DISABLED` / `_ENABLED` / `_DELETED` (`REPORT_DEFINITION`) | Bật, tắt, xóa mềm mẫu | `ReportTemplateService` |

Sự kiện trong `report_run_events` (không phải nhật ký kiểm soát): QUEUED, SCHEDULED, COMPLETED, RETRY_SCHEDULED, DEAD_LETTERED, ARTIFACT_PURGED, LEGAL_HOLD_APPLIED/RELEASED.
Việc tải file chỉ ghi nhật ký kiểm soát, không ghi sự kiện lần chạy.

**ĐÃ KIỂM TRA** danh sách trên bằng `grep` các lệnh `auditTrail.logAs` và mã sự kiện trong `ReportPlatformService`.
Việc tạo lịch lần chạy theo lịch (`SCHEDULED`) chỉ ghi `report_run_events`, không ghi nhật ký kiểm soát.

---

## 12 Report Administration

| Mục | Trạng thái | Cái gì đang thật | Cái gì còn là mẫu |
|---|---|---|---|
| Report Definitions | Thật | Danh sách, sửa, bố cục, trường, lịch sử, xóa mềm (`ReportTemplateCatalog`, `ReportTemplateEditor`) | — |
| Report Properties | Thật | Số mẫu, giới hạn, giao diện công ty | — |
| Report Types | Thật | Danh sách, chi tiết, bật/tắt | — |
| Report Name Formats | Thật | Danh sách, tạo, sửa, bật/tắt | — |
| Report Access & Data Scope | Mẫu, chỉ đọc | Phạm vi theo vai trò đã lưu trên từng mẫu | Ma trận hiển thị là dữ liệu mẫu (`SAMPLE_ACCESS`) |
| Report Retention & Legal Hold | Mẫu | Chính sách lưu giữ có thật trên mẫu | Sổ legal hold là dữ liệu mẫu; nút đặt hold chỉ hiện thông báo |
| Scheduled Report Delivery | Mẫu | Số người nhận tối đa (chỉ trên màn) | Không gửi thư; nhật ký gửi là dữ liệu mẫu |

**ĐÃ KIỂM TRA** trong `admin/ReportAdminScreens.tsx`. Nút Save trong `ReportAdminPage` chỉ mở hộp thoại lý do, rồi hiện thông báo "Design preview: nothing was sent to a server."

---

## 13 Ánh xạ giao diện và API

| Chức năng | Màn hình | Endpoint |
|---|---|---|
| Danh mục báo cáo | Report Library | `GET /reports/templates`, `GET /reports/templates/sources`, `GET /reports/templates/roles` |
| Tùy chọn cho bộ lọc | Report Library | `GET /reports/templates/{code}/options/{field}` |
| Xem trước dữ liệu | Report Library, trình soạn | `POST /reports/templates/{code}/preview` |
| Xem trước PDF | Trình soạn | `POST /reports/templates/{code}/preview-pdf` |
| Chạy báo cáo | Report Library | `POST /reports/runs` |
| Danh sách lần chạy | Run History | `GET /reports/runs` |
| Chi tiết lần chạy | Run History | `GET /reports/runs/{runId}` |
| Thử lại | Run History | `POST /reports/runs/{runId}/retry` |
| Tải file | Run History | `POST /reports/runs/{runId}/artifacts/{artifactId}/download` |
| Legal hold | (không có) | `POST /reports/runs/{runId}/artifacts/{artifactId}/legal-hold` — **không có màn hình** |
| Danh sách lịch | Scheduled | `GET /reports/schedules`, `GET /reports/schedules/search` |
| Người nhận | Scheduled | `GET /reports/schedules/recipients` |
| Tạo / sửa / xem lịch | Scheduled | `POST /reports/schedules`, `PUT /reports/schedules/{id}`, `GET /reports/schedules/{id}` |
| Tạm dừng / tiếp tục / xóa | Scheduled | `POST .../pause`, `POST .../resume`, `DELETE /reports/schedules/{id}` |
| Đổi chủ lịch | Scheduled | `PUT /reports/schedules/{id}/owner` với `{ownerUserId, reason}` |
| Cấu hình mẫu | Report Definitions | `GET/PATCH /settings/report-configuration/definitions/{code}`, `PATCH .../fields`, `GET .../history` |
| Lưu mẫu | Trình soạn | `POST /reports/templates/{code}`, `PUT /reports/templates/{code}`, `DELETE /reports/templates/{code}` |
| Bố cục và thành phần Word | Trình soạn bố cục | `POST /reports/templates/layout/preview`, `.../preview-page` (từ 2026-10-15 trả JSON gồm ảnh và vị trí Stamp), `POST .../components/{type}`; dùng ở Report Properties |
| Report Properties | Report Properties | `GET/PUT /reports/properties` |
| Report Types | Report Types | `GET /reports/types`, `GET /reports/types/{code}`, `POST /reports/types/{code}/enabled` |
| Report Name Formats | Report Name Formats | `GET/POST /reports/name-formats`, `GET/PUT /reports/name-formats/{id}`, `POST .../{id}/active` |
| Revision của mẫu | Chi tiết mẫu | `POST /reports/templates/{code}/upgrade`, `.../discard-revision`, `.../disable`, `.../enable`, `GET .../revisions`, `.../revisions/{n}`, `.../revisions/{n}/compare` |
| Tìm Access Profile | Access & Scope | `POST /reports/templates/roles/search` |
| Danh mục cũ | Các màn `report.ts` | `GET /reports/catalog` |

**ĐÃ KIỂM TRA** bằng so khớp đường dẫn trong `services/api/report.ts`, `reports.ts`, `reportTemplates.ts` với các controller.

---

## 14 Kiểm soát GMP và chữ ký điện tử

- Thay đổi mẫu, trường, phạm vi và chính sách lưu giữ đều **bắt buộc có lý do** và có nhật ký kiểm soát. Thay đổi làm đổi kết quả hoặc quyền truy cập **cần chữ ký điện tử** từ 2026-10-14 (REPORT-DEFINITION-SIGNATURE-2026-10-14, phase 2.2).
  **QUYẾT ĐỊNH:** thay đổi định nghĩa báo cáo có ảnh hưởng đến kết quả chính thức có cần chữ ký điện tử như Backup Policy hay không.
- Báo cáo có tiêu đề "Official" và cần xác nhận trước khi chạy: chưa có quy trình xác nhận riêng cho loại này; việc duyệt hiện nằm ở luồng Pending Approval của template (mục 5.5). Màn Report Change History & Validation đã được bỏ (2026-10-14); lịch sử xem ở Audit Trail và ở mục Revisions của từng template.
- File kết quả có SHA-256 và được ghi journal trước khi xuất bản. Đây là bằng chứng toàn vẹn ở mức file.
- Lần chạy được ghi trong `report_runs` và `report_run_events` và không bị xóa khi file hết hạn.

---

## 15 Mã lỗi (giá trị máy)

| Mã | Ý nghĩa |
|---|---|
| `REPORT_REQUEST_REQUIRED` | Thiếu yêu cầu chạy |
| `REPORT_SORT_NOT_ALLOWED` | Sắp xếp nhiều cột |
| `REPORT_IDEMPOTENCY_KEY_INVALID` | Khóa idempotency dài quá 160 ký tự |
| `REPORT_IDEMPOTENCY_CONFLICT` | Cùng khóa, khác tham số (409) |
| `REPORT_FIELD_NOT_ALLOWED` / `REPORT_REQUIRED_FIELD_MISSING` | Trường không được phép hoặc thiếu trường bắt buộc |
| `REPORT_FILTER_NOT_ALLOWED` | Bộ lọc ngoài danh sách |
| `REPORT_TEMPLATE_CODE_INVALID` / `REPORT_TEMPLATE_NAME_REQUIRED` | Mã hoặc tên mẫu không hợp lệ |
| `REPORT_CHANGE_REASON_REQUIRED` | Thiếu lý do thay đổi mẫu |
| `REPORT_FORMAT_NOT_ALLOWED` | Định dạng ngoài PDF, XLSX, CSV |
| `REPORT_SCOPE_INVALID` | Phạm vi vai trò không hợp lệ |
| `REPORT_CHART_FIELD_NOT_SELECTED` / `REPORT_LAYOUT_INVALID` | Bố cục hoặc biểu đồ không hợp lệ |
| `REPORT_ARTIFACT_LIMIT_EXCEEDED` | File vượt 50 MB |
| `REPORT_ARTIFACT_EXPIRED` | File đã hết hạn hoặc bị dọn |
| `REPORT_AUTHORIZATION_CHANGED` | Quyền hoặc tập tài liệu nguồn đã đổi |
| `REPORT_SNAPSHOT_INVALID` | Ảnh chụp quyền không đọc được |
| `REPORT_WORKER_LEASE_LOST` | Worker mất lease khi xuất bản |
| `REPORT_ARTIFACT_CHECKSUM_MISMATCH` | SHA-256 không khớp với nơi lưu trữ |
| `REPORT_GENERATION_FAILED` / `REPORT_INVALID_CRITERIA` | Lỗi chạy báo cáo, có thử lại hoặc không |
| `REPORT_SCHEDULE_INVALID` / `REPORT_RECIPIENT_INVALID` | Lịch hoặc người nhận không hợp lệ |
| `REPORT_TYPE_DISABLED` / `REPORT_SOURCE_UNKNOWN` | Report Type bị tắt hoặc không tồn tại |
| `REPORT_TYPE_VERSION_CHANGED` / `REPORT_TYPE_UNCHANGED` | Phiên bản cũ (409) / trạng thái không đổi (409) |
| `REPORT_SCOPE_NOT_ALLOWED_FOR_TYPE` | Phạm vi dữ liệu không dùng được với type này |
| `REPORT_AUDIT_RANGE_REQUIRED` / `REPORT_AUDIT_RANGE_TOO_WIDE` | Báo cáo Audit Trail thiếu khoảng ngày / quá 92 ngày |
| `REPORT_DATE_RANGE_INVALID` | Khoảng ngày sai thứ tự hoặc không đọc được |
| `REPORT_FONT_INVALID` / `REPORT_MARK_INVALID` | Font hoặc Stamp, Watermark không hợp lệ |
| `REPORT_PROPERTIES_VERSION_CHANGED` / `REPORT_PROPERTIES_UNCHANGED` | Report Properties (409) |

---

## 16 Kiểm thử và bằng chứng hiện có

**Backend** (`src/test/java/com/eqms/service/report/`): `ReportTemplateDatabaseTest` (24 test), `ReportMetadataProviderTest` (11),
`ReportWordServiceTest` (8), `ReportAnalyticsTest` (6), `ReportLayoutApiTest` (4), `ReportLayoutTest` (4), `ReportTemplateApiTest` (4),
`ReportPdfRendererTest` (2), `ReportTemplatePermissionBoundaryTest` (1). Chưa có test cho `ReportPlatformService` (hàng đợi, lease, lịch, legal hold, dọn file) hoặc cho `ReportJobWorker`.

**Thêm từ 2026-10-14 (đều chạy xanh trên DEV):** `ReportTemplateRevisionTest` (5), `ReportTemplateRevisionActionsTest` (13), `ReportPropertiesTest` (8, gồm giao diện công ty), `ReportTemplateNumberTest`, `ReportRoleSearchTest`, `ReportFontTest` (3), `ReportChartGroupsTest` (2), `ReportStampTest` (5), `ReportTypeServiceTest` (5), `AuditTrailReportSourceTest` (6), `ReportTemplateSignatureTest` (6). Frontend: `features/report/__tests__` (16 file, 68 test) gồm `ReportPropertiesView`, `ReportTypesView`, `ReportChartsEditor`.
Chưa chạy toàn bộ bộ test backend sau các thay đổi này (các test Spring dùng chung Postgres DEV; xem ghi chú dự án).

**Frontend:** `features/report/templates/__tests__/` (5 file) và `features/report-analytics/__tests__/ReportAnalytics.test.tsx`. Chưa có test cho Scheduled Reports, Run History, và các màn quản trị.

**Tài liệu xác nhận:** `REPORT_TEMPLATE_API_AND_UAT.md`, và các `REPORT_*_CHANGE_RECORD.md` (2026-10-03, 2026-10-04) trong `eqms-backend/docs/validation`.

**THIẾU:** kiểm thử trên môi trường DEV đã được ghi nhận cho luồng chạy → worker → file → tải về → dọn file → legal hold. Chưa có bằng chứng trong tài liệu hiện có.

---

## 17 Vấn đề đã thấy trong mã (cần xử lý trước khi viết SDS mục tiêu)

| # | Vấn đề | Bằng chứng | Mức |
|---|---|---|---|
| 17.1 | Lịch có người nhận nhưng không gửi báo cáo cho ai. Bảng nhật ký gửi không được ghi. | Mục 10 | Cao |
| 17.2 | Legal hold không có màn hình; màn quản trị legal hold là mẫu | Mục 9, `ReportRetentionView` | Cao **Đã xử lý một phần (2.1): nút đặt và gỡ hold trên lịch sử lần chạy; màn quản trị vẫn là mẫu.** |
| 17.3 | Hai mẫu `TEST_` được seed trong migration V533, cùng đường với mẫu thật. Chưa rõ có nên có trên môi trường sản xuất không. | `V533__report_test_templates.sql` | Cao (QUYẾT ĐỊNH) **Đã xử lý trên DB (V578): xóa mềm. Nạp lại trên DEV còn mở (PLAN 2.5).** |
| 17.4 | `access_policy` và `delivery_policy` được đọc và trả về màn hình, không được thi hành. | Mục 4 | Trung bình |
| 17.5 | Menu backend có mục `report-compliance` ("Compliance Reports", `/report/compliance`) nhưng frontend không có màn hình. | So khớp id menu | Trung bình **Đã xử lý: mục `report-compliance` bỏ khỏi menu backend.** |
| 17.6 | Toàn bộ menu báo cáo bị chặn bởi cờ `feat-system-reports` ở backend, frontend không có cờ tương ứng. | `NavigationService` dòng 150–151 | Thấp (cần xác nhận) |
| 17.7 | Thu thập quyền cũ (alias) `report.module.export` và `settings.configuration.manage` vẫn được chấp nhận. Cần danh mục quyền chốt để bỏ dần. | Mục 2.2 | Trung bình |
| 17.8 | Chưa có test cho hàng đợi, lease, lịch và legal hold. | Mục 16 | Cao |
| 17.9 | Mọi lỗi khi đọc file để tải về, kể cả SHA-256 không khớp, đều bị đổi thành `REPORT_ARTIFACT_EXPIRED`. Người dùng không biết file bị hỏng hay đã hết hạn. | `download()`: `catch (Exception missing) → REPORT_ARTIFACT_EXPIRED` | Trung bình |
| 17.10 | Ba màn phân tích và năm màn quản trị (ngoài Definitions) không dùng dữ liệu thật. Bốn màn hiển thị dữ liệu mẫu, màn Output Controls đã bỏ (2026-10-15). Người dùng có thể nhầm với dữ liệu thật. | Mục 1, 12 | Trung bình **Đã xử lý: ba màn phân tích ẩn bằng cờ `feat-report-analytics` (tắt).** |
| 17.12 | Toàn bộ thay đổi báo cáo từ 2026-10-14 đến 2026-10-15 chưa commit, chưa có change record riêng (cần `detect_changes` trước khi commit). | Mục 20 | Cao |
| 17.13 | Lần chạy báo cáo thật chưa được kiểm tra để thấy giao diện công ty trong PDF; mẫu cũ chuyển sang giao diện công ty mặc định từ lần chạy sau. | Mục 5.6 | Trung bình |
| 17.14 | Báo cáo Audit Trail không đòi chữ ký điện tử khi chạy, khác với xuất từ màn Audit Trail. Lịch giữ nguyên khoảng ngày. | Mục 5.8 | Trung bình (QUYẾT ĐỊNH) |
| 17.11 | Hai định nghĩa `REVISION_LIFECYCLE` và `AUDIT_TRAIL_EXTRACT` có cờ `active = true` nhưng không có nguồn dữ liệu. Chúng không hiện trong danh mục và không chạy được, nhưng vẫn là bản ghi "đang hoạt động" trong DB. | `report_definitions.source_code IS NULL`; `ReportTemplateService.provider` ném `REPORT_SOURCE_NOT_SUPPORTED` | Thấp (đề xuất: tắt cờ, cần QA xác nhận) |

---

## 18 Quyết định: đề xuất và người cần xác nhận

Mục này ghi **đề xuất** cho từng câu hỏi, không phải quyết định. Theo quy ước của Decision Log
(`eqms-backend/docs/governance/DECISION_LOG.md`), một điều chỉ được coi là đã quyết định khi chủ sở hữu nói rõ.
Cột "Ai xác nhận" nêu người cần làm việc đó. Căn cứ theo các điều của EU GMP Annex 11 (2011): cần đối chiếu với văn bản
chính thức trước khi phê duyệt.

| # | Câu hỏi | Đề xuất | Căn cứ và lý do | Ai xác nhận |
|---|---|---|---|---|
| 1 | Phân phối báo cáo theo lịch | **Không gửi file đính kèm qua email.** Thông báo cho người nhận qua **trong ứng dụng và email**; email chỉ chứa liên kết, không đính kèm file (xem REPORT-NOTIFICATION-CHANNEL-2026-10-14). Người mở liên kết phải đăng nhập và được kiểm tra quyền lại, như tải file hiện nay. Mỗi lần gửi ghi vào `report_delivery_attempts`. | File gửi qua email là bản sao ngoài hệ thống, không kiểm soát được truy cập và không thu hồi được. Annex 11 §12 (kiểm soát truy cập), §7.1 (sao lưu, bảo vệ dữ liệu). Mô hình tải lại có kiểm quyền đã có, nên giữ nguyên. Nếu nghiệp vụ cần file ngoài hệ thống, phải đi qua quy trình Controlled Copy. | QA Manager (phạm vi GMP); IT và bảo mật (kênh email) |
| 2 | Legal hold | **Đặt hold:** người có `reports.retention.manage`, bắt buộc có lý do. **Gỡ hold:** phải là người khác với người đặt, và cần chữ ký điện tử với ý nghĩa "Gỡ legal hold". Trạng thái hold hiện trên lịch sử lần chạy. Hold chặn dọn file (đã có). Cần thêm màn hình thật để thao tác. | Gỡ hold cho phép file bị xóa, và việc xóa không hoàn tác được. Annex 11 §14 (chữ ký điện tử) và §12 (kiểm soát truy cập). Nguyên tắc hai người với hành động không đảo ngược. | QA Manager (quy trình); người phụ trách pháp lý, nếu có |
| 3 | Chữ ký cho thay đổi định nghĩa báo cáo | **Cần chữ ký** cho thay đổi làm đổi kết quả hoặc quyền truy cập: thêm, bớt trường; bộ lọc; phạm vi vai trò; định dạng; chính sách lưu giữ; bật, tắt mẫu. **Không cần** cho tên hiển thị và mô tả. Ý nghĩa chữ ký: "Thay đổi định nghĩa báo cáo". | Annex 11 §10 (quản lý thay đổi) và §14. Phạm vi vai trò là thay đổi quyền truy cập dữ liệu, nên cùng mức với thay đổi Backup Policy đã có chữ ký. Không đòi chữ ký cho thay đổi không ảnh hưởng nội dung, để tránh chữ ký hình thức. | QA Manager |
| 4 | Báo cáo "Official" và xác nhận trước khi chạy | **Chưa triển khai ngay.** Bước đầu là xác định báo cáo nào dùng cho quyết định GMP. Với các báo cáo đó: mẫu có trạng thái "Đã xác nhận" gắn với một phiên bản; người xác nhận khác tác giả; chỉ chạy được phiên bản đã xác nhận; thay đổi định nghĩa làm mất xác nhận. Lần chạy đã ghi `definition_version` nên truy vết được. Tạm thời, mỗi file ghi rõ: "Chưa được xác nhận cho quyết định GMP". | Annex 11 §4 (xác nhận hệ thống trước khi dùng) và §10. Ghi chú trên file ngăn người dùng hiểu nhầm trong lúc chờ. | QA Manager (xác định phạm vi và người xác nhận) |
| 5 | Mẫu `TEST_` | **Gỡ khỏi môi trường sản xuất.** Viết migration mới (không sửa V533), đánh dấu xóa mềm (`deleted_at`) để giữ lịch sử. Mẫu thử chỉ nạp trên DEV, bằng cấu hình riêng, không nằm trong đường migration chung. | Dữ liệu thử trong danh mục thật có thể bị chạy và tạo ra file trông như chính thức. Annex 11 §4 (môi trường xác nhận tách khỏi sản xuất). Migration đã chạy không sửa được, nên phải dùng migration bổ sung. | QA Manager (xác nhận); IT (migration) |
| 6 | Thời gian lưu file | **Vĩnh viễn.** Không file báo cáo nào hết hạn theo tuổi; legal hold vẫn áp dụng trên đó (xem REPORT-FILE-RETENTION-PERMANENT-2026-10-14). Lưu lâu dài nên dùng PDF/A (cần kiểm tra renderer hiện có có tạo PDF/A không). CSV và XLSX không dùng để lưu trữ dài hạn. | Annex 11 §17 (lưu trữ, đọc được trong suốt thời gian lưu). Con số cụ thể là quyết định nghiệp vụ dựa trên yêu cầu quy định; hệ thống không tự suy ra được. | QA Manager (lịch lưu hồ sơ); chủ nghiệp vụ |
| 7 | Phân tích (Overview, Analytics) | **Không đưa số mẫu lên môi trường sản xuất.** Ẩn ba mục phân tích khỏi menu bằng cờ tính năng, mặc định tắt, đến khi có nguồn số liệu thật. Nguồn thật đề xuất: tổng hợp phía server từ cùng nguồn Document Register, và tái tạo được. | Số mẫu có thể bị hiểu là số thật. Annex 11 §6 (kiểm tra độ chính xác của dữ liệu). Xây dựng số liệu thật là ưu tiên nghiệp vụ, không phải việc cần chốt ngay. | Chủ dự án (ưu tiên); QA Manager (ẩn trên sản xuất) |
| 8 | Lịch dùng quyền của người tạo | **Giữ mô hình hiện tại:** quyền được kiểm tra tại thời điểm chạy, và lịch tự tạm ngưng khi người tạo mất quyền. **Bổ sung:** (a) mỗi lịch có người phụ trách được ghi nhận, chuyển giao phải có lý do và nhật ký; (b) khi lịch bị tạm ngưng, thông báo cho người phụ trách. Hiện chưa có thông báo nào. | Mô hình quyền của người tạo là phương án ít đặc quyền nhất và truy vết được; tự tạm ngưng là an toàn. Thiếu thông báo làm lịch có thể ngừng âm thầm. Annex 11 §9 (nhật ký) và §16 (liên tục hoạt động). | Chủ dự án (chấp nhận mô hình); QA Manager (thông báo) |

**Trạng thái:** cả tám đề xuất đã được người dùng xác nhận ngày 2026-10-14 và ghi vào Decision Log. Hai điểm được chốt thêm cùng ngày: thời gian lưu là vĩnh viễn, kênh thông báo là trong ứng dụng và email (xem `REPORT-FILE-RETENTION-PERMANENT` và `REPORT-NOTIFICATION-CHANNEL`). Các mục `REPORT-DELIVERY-CHANNEL`, `REPORT-LEGAL-HOLD`, `REPORT-DEFINITION-SIGNATURE`, `REPORT-OFFICIAL-VALIDATION`, `REPORT-TEST-TEMPLATES`, `REPORT-FILE-RETENTION`, `REPORT-ANALYTICS-PRODUCTION`, `REPORT-SCHEDULE-OWNER`. Các điểm còn mở của từng mục (phê duyệt máy chủ mail của IT và bảo mật, phạm vi báo cáo GMP, thời điểm xây dựng phân tích) ghi trong từng bản ghi. Các việc triển khai là backlog, chưa làm. Khi chủ sở hữu xác nhận từng mục, mục đó được ghi vào
Decision Log theo đúng định dạng của log, kèm phần "lựa chọn của trợ lý cần xác nhận" nếu có. SDS sẽ theo quyết định đã xác nhận, không theo đề xuất này.

---

## 19 Chưa kiểm tra

- Chạy thật trên DEV: tạo lần chạy, theo dõi worker, tải file, lịch chạy, dọn file, legal hold.
- Quyền thực tế của từng vai trò trong cơ sở dữ liệu DEV (chỉ kiểm tra mã quyền có tồn tại, không kiểm tra gán quyền cho vai trò).
- Hiệu năng với 10 000 dòng và file 50 MB.
- Kiểm tra mục 17.9 (nhật ký khi tải file) và mục 17.6 (cờ tính năng) trên môi trường chạy thật.
- Giao diện công ty trong file PDF của một lần chạy thật; Report Properties và Report Types (Enable/Disable) bằng thao tác trên trình duyệt; form tạo mẫu sau khi đổi sang Report Type.
- Bộ test backend đầy đủ sau các thay đổi 2026-10-14 và 2026-10-15; `ReportLists.test.tsx` đôi khi không ổn định.

---

## 20 Trạng thái tạm dừng và việc chưa làm (2026-10-15)

**Chủ dự án (2026-10-15):** tạm dừng chức năng Report, Backup và Restore để quay lại Document Control và chuẩn bị Training Management. Không làm tiếp phần này nếu chưa có yêu cầu mới.

**Đã làm xong trên DEV (chưa commit):**

- Cột Template Number, Revision; số mẫu do hệ thống cấp; Revision đầy đủ (Upgrade, Obsolete, Discard, Disable/Enable); quyền theo hành động và hợp đồng quyền chung `REPORT_TEMPLATE` (mục 2.2, 5.5).
- Report Name Formats (một quy tắc đang hoạt động), Report Properties, bỏ màn Report Change History & Validation (bản ghi bằng Audit Trail và Revisions).
- Giao diện công ty, Stamp viết lại, font Times New Roman, logo 10 MB, biểu đồ có "Other" (mục 5.6).
- Report Types và nguồn Audit Trail (mục 5.7, 5.8). Tài liệu thiết kế: `eqms-backend/docs/validation/REPORT_PLATFORM_2026_10_15_DESIGN.md`.

**Chưa làm (theo thiết kế, giai đoạn 3 và 4):**

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Nguồn **Backup & Restore** (giai đoạn 3) | CHƯA BẮT ĐẦU | Chủ dự án chưa biết dữ liệu nằm ở đâu: có thể nằm ở DB điều khiển `eqms_backup_control` ngoài DB chính. Quyền dự kiến `backup.module.view`; không bao giờ đưa khóa, địa chỉ kho hay đường dẫn đối tượng thành cột. Xem SDS-BR-001, mục "Nguồn báo cáo". |
| Chọn cột khi chạy, "My reports" (giai đoạn 4) | CHƯA BẮT ĐẦU | |
| Khoảng ngày tương đối cho báo cáo theo lịch | CHƯA LÀM | Lịch hiện giữ nguyên ngày |
| Nguồn Document Revisions, Controlled / Uncontrolled Copies | CHƯA LÀM | |
| Form tạo mẫu đơn giản hơn | LÀM MỘT PHẦN | Chỉ đổi tên Report Type và thêm mô tả; bốn tab hiện có đã đủ bốn bước |
| Change record, `detect_changes`, commit | CHƯA LÀM | Bắt buộc trước khi commit |
| Màn Reports Overview, Quality Analytics, Access, Retention, Delivery | VẪN LÀ DỮ LIỆU MẪU | Mục 1 và 12 |

**Các quyết định trợ lý đề xuất, chờ QA hoặc chủ dự án xác nhận:** giao diện công ty áp cho mẫu cũ; Stamp opacity 30-100; Report Types viết trong mã, chỉ bật/tắt; không thêm quyền tạo mẫu riêng; Audit Trail cần cả `audit.view` và `audit.export`, chỉ phạm vi SYSTEM, tối đa 92 ngày. Chi tiết ở Decision Log mục `REPORT-COMPANY-APPEARANCE-2026-10-15` và `REPORT-PLATFORM-2026-10-15`.

**Môi trường DEV để tiếp tục:** các tài khoản `admin` và `approver.test1`; bộ quyền `PS_REPORT_AUTHOR_DEV_TEST` có thêm `reports.types.*`, `audit.view`, `audit.export` (file `DEV_TEST_REPORT_TYPES_2026_10_15.sql`); sau khi gán quyền bằng SQL cần khởi động lại backend vì quyền được lưu đệm.
