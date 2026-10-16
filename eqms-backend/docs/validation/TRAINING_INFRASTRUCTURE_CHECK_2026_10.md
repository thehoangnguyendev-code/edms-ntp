# TRAINING-WP0 — Kiểm tra hạ tầng, kế hoạch dọn mã thử, phân tích ảnh hưởng

Ngày: 2026-10-16. Chỉ đọc mã và hệ thống DEV; **không sửa mã, không xóa gì, không đổi cơ sở dữ liệu**. Liên quan SDS-TR-001 mục 15.1 (việc 0.6, 0.7, 0.8).

## 1 Hạ tầng dùng lại (việc 0.6)

| Hạng mục | Kết quả kiểm tra | Dùng được? | Việc thêm (gói) |
|---|---|---|---|
| Quét virus | Có container `eqms-clamav` (healthy) và `ClamAvScanService` trong backend | Có | Gọi dịch vụ này cho tệp Training; test EICAR (WP-6) |
| Kho tệp | `eqms-minio` healthy; `StoragePathBuilder` có hàm riêng cho từng loại (ví dụ `reportArtifact`) | Có | Thêm hàm đặt khóa cho tệp Training (`training/<loại>/<năm>/<id>`), **chỉ ký tự an toàn**; quyết định bucket (không tạo bucket PROD ở máy này, theo quy tắc môi trường) (WP-6) |
| Cờ tính năng | Lưu ở `system_configurations.features_config` (mảng JSON `{id, ...}`); đã có `feat-tms`, `feat-tms-my`, `feat-tms-materials`, `feat-tms-courses`, `feat-tms-compliance`, `feat-tms-records` (của menu thử) | Có | Thêm `feat-training-integration` (mặc định theo D-28); quyết định số phận các cờ `feat-tms-*` khi thay menu (WP-1, WP-FE-CLEAN) |
| Worker nền và khóa | Mẫu đã có ở Report (`ReportJobWorker`, khóa phân tán, `FOR UPDATE SKIP LOCKED`) | Có | Viết `TrainingOutboxWorker` theo mẫu (WP-5) |
| Thông báo và email | Có `NotificationService`, mẫu email bootstrap, MailHog trên DEV | Có | Thêm mẫu thông báo Training (WP-5, WP-9) |
| Chữ ký điện tử | `electronic_signatures` (có `signature_id` duy nhất, ý nghĩa, mã dùng một lần), `ElectronicSignatureService.createEntitySignature`, `SecurityChangeSignatureService` | Có | Thêm ý nghĩa chữ ký `TRAINING_*` bằng migration (WP-1) |
| Audit Trail | `AuditTrailService.logAs` (cần id đối tượng khác rỗng); `audit_logs` khóa bằng trigger V245 | Có | Dùng cho mọi lệnh ghi (mọi gói) |
| Quyền, khả năng theo đối tượng | `EffectivePermissionService` (không đệm), `PermissionEvaluationService` (**có đệm**: quyền gán bằng SQL cần khởi động lại backend), `ResourceCapabilityService`, `getEligibleParticipants` chỉ cho `DOCUMENT_REVISION` | Có, cần mở rộng | Thêm các loại `TRAINING_*` cho capabilities và người đủ điều kiện (WP-1) |
| Phạm vi bộ phận được ủy quyền trong Access Profile | Có `object_access_rules` (V151) và `access_profile_object_rules`; **chưa kiểm tra chi tiết** mô hình phạm vi bộ phận ủy quyền | **Chưa rõ** | WP-1 phải đọc `ObjectAccessRule` và quyết định: dùng lại hay thêm bảng ủy quyền phạm vi bộ phận cho Training |
| Lịch ngày nghỉ | Chỉ có `calendar_events` (sự kiện cá nhân); **không có khái niệm ngày nghỉ** | Không | Bảng `training_non_working_days` riêng (D-14) (WP-1) |
| Bộ đếm tuần tự | Mẫu `report_properties` (cấp số mẫu, khóa dòng) và `training_number_sequences` thiết kế | Có | `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` (WP-2) |
| Trigger bất biến | Mẫu V245 (`prevent_audit_log_mutation`) | Có | Hàm và trigger cho `training_*` (WP-1) |
| Quyền thử trên DEV | Cấp bằng file SQL (mẫu `DEV_TEST_REPORT_TYPES_2026_10_15.sql`); mật khẩu **không** ghi vào tệp | Có | File SQL tương tự cho Training (WP-1) |
| Sao lưu | Module Backup & Restore (tạm dừng); chưa kiểm tra phạm vi sao lưu có gồm bảng `training_*` | Chưa rõ | Đối chiếu ở WP-HARDEN |

**Tên gọi và dữ liệu liên quan phát hiện thêm:** `app_users.employee_code` có (cần cho hồ sơ); không có bảng người-vị trí; tài khoản thử và tải chiếm đa số tài khoản Active (xem báo cáo dữ liệu nền F-2).

## 2 Kế hoạch dọn mã thử (việc 0.7; **không xóa ở WP-0**)

Giao diện thử do chủ dự án tự dựng, dữ liệu mẫu, không là căn cứ (xác nhận 2026-10-15). Sẽ thay và **xóa hẳn** theo từng màn khi màn mới xong (WP-FE-CLEAN).

| Nhóm | Vị trí | Số tệp | Ghi chú |
|---|---|---|---|
| Giao diện Training thử | `eqms/src/features/training/` (`compliance-tracking`, `course-inventory`, `materials`, `my-training`, `records-archive`, `types`, `useTrainingPermissions.ts`, `index.ts`) | 90 (cùng nhóm dưới) | Mô hình khóa học, vật liệu, ma trận tuân thủ mẫu; nhiều `mockData.ts` |
| Quản trị Training thử | `eqms/src/features/settings/training-administration/` | 4 | Properties, Requirement Templates, Create Quiz, Curriculums (chỗ giữ chỗ "coming soon") |
| Tuyến | `eqms/src/app/routes/TrainingRoutes.tsx`; `AppRoutes.tsx`; `SettingsRoutes.tsx` (nhóm `settings/administration/training`) | 3 | Thay bằng tuyến mới (SDS mục 10.2) |
| Menu | `eqms/src/app/navigation.ts`: `training-management` (`my-training`, `training-materials`, `training-pending-review`, `training-pending-approval`, `training-matrix`, `employee-training-files`) và `training-administration` (4 mục); backend `NavigationService` | — | Thay |
| API client | `eqms/src/services/api/training.ts` (hợp đồng lỏng `any`) | 1 | Thay bằng `training*.ts` kiểu chặt |
| Test | `components/ui/drawer/__tests__/DrawerConsumers.test.tsx` có tham chiếu; test trong các thư mục trên | — | Cập nhật hoặc xóa theo |
| Cờ tính năng | `feat-tms`, `feat-tms-my`, `feat-tms-materials`, `feat-tms-courses`, `feat-tms-compliance`, `feat-tms-records` | 6 cờ | Quyết định giữ, đổi hoặc bỏ khi thay menu (không xóa dữ liệu cấu hình mà không có lý do) |

**Nơi import từ ngoài vào mã thử:** `app/AppRoutes.tsx`, `app/routes/TrainingRoutes.tsx`, `components/ui/drawer/__tests__/DrawerConsumers.test.tsx`. Các quyền `training.*` hiện có (báo cáo dữ liệu nền mục (g)) được giữ tương thích (D-19) cho đến khi chuyển hết.

**Thứ tự an toàn:** dựng màn mới ⇒ chuyển tuyến và menu ⇒ chạy test ⇒ xóa mã cũ tương ứng ⇒ `tsc` và test sạch ⇒ không còn import tới mã cũ.

## 3 Phân tích ảnh hưởng (GitNexus, việc 0.8)

Chạy `impact --direction upstream` trên hai chỉ mục (`eqms-backend`, `edms-ntp`). **Chưa sửa gì.**

| Ký hiệu | Chỉ mục | Số bị ảnh hưởng (trực tiếp) | Mức | Ghi chú |
|---|---|---|---|---|
| `DocumentRevisionRecord` (entity) | backend | **107 (51)**, 8 quy trình, 3 module | **CRITICAL** | Thêm cột `training_activity_id`, `training_number`, `training_mode`, `training_origin` là **thay đổi cộng thêm**; rủi ro nằm ở ánh xạ, xuất bản (publishing), bản sao kiểm soát, snapshot, nhập sau cùng; cần chạy lại bộ test liên quan và xem các quy trình `requestControlledCopy`, `generatePreview`, `openWorkspace`, `onRevisionSnapshotRequested` |
| `RevisionService` | backend | 13 | MEDIUM | Sửa `completeTraining`, nhánh `PENDING_TRAINING`, Upgrade, hủy |
| `RevisionService.completeTraining` | backend | 1 | LOW | Nhánh `INTEGRATED` thêm điều kiện hoạt động đã `COMPLETED` |
| `DocumentService` | backend | 4 | LOW | Nhánh lưu có `trainingChanged` |
| `TrainingAuthorizationService` | backend | 1 | LOW | Mở rộng; giữ nguyên chữ ký phương thức hiện có |
| `ResourceCapabilityService` | backend | 2 | LOW | Thêm các loại `TRAINING_*` |
| `NavigationService` | backend | 2 | LOW | Thêm menu |
| `NewDocumentView` | giao diện | **425** | **CRITICAL** | Nhiều quy trình tạo, upgrade, import dùng chung |
| `TrainingTab` | giao diện | **138** | **CRITICAL** | Dùng ở tạo tài liệu và import cũ |
| `RevisionTrainingView` | giao diện | **141** | **CRITICAL** | Màn Pending Training |
| `TrainingInformationTab`, `LegacyImportView` | giao diện | 0 (chỉ mục chưa thấy người gọi) | UNKNOWN | Cần kiểm tra tay; chỉ mục có thể thiếu quan hệ cho hai tệp này |

**Cảnh báo cho chủ dự án (theo quy tắc dự án: báo mức HIGH hoặc CRITICAL trước khi sửa):** ba thành phần giao diện và một entity ở mức **CRITICAL**. Điều này **không ngăn** làm WP-5 nhưng đòi hỏi:
1. Thay đổi **chỉ cộng thêm và có điều kiện** (cờ, chế độ), không đổi hành vi mặc định khi `training_mode` trống hoặc `MANUAL`.
2. Bộ test hiện có của Document Control và giao diện (tạo, upgrade, import, controlled copy, publishing) **chạy lại đầy đủ** trước và sau.
3. WP-5 chia nhỏ thành các lát nhỏ có thể kiểm chứng (cột DB ⇒ cổng ⇒ tab tạo ⇒ tab revision ⇒ danh sách), mỗi lát một kiểm tra hồi quy.
4. `detect_changes` trước mỗi commit; so với nhánh chính.

## 4 Điều kiện và rủi ro rút ra

| # | Điều rút ra | Hướng xử lý | Gói |
|---|---|---|---|
| I-1 | Phạm vi bộ phận ủy quyền trong Access Profile chưa kiểm tra | Đọc `ObjectAccessRule` và quyết định mô hình phạm vi cho quyền `training.*` | WP-1 |
| I-2 | Quyền được **đệm**; quyền cấp bằng SQL không hiện cho đến khi khởi động lại | Ghi trong hướng dẫn DEV và trong test (khởi động lại hoặc dùng đường API cấp quyền) | WP-1 |
| I-3 | Không có ngày nghỉ | Bảng riêng (D-14) | WP-1 |
| I-4 | Chỉ mục GitNexus thiếu quan hệ cho hai tệp giao diện | Kiểm tra bằng `grep` tay các nơi dùng trước khi sửa | WP-5 |
| I-5 | Phạm vi sao lưu chưa gồm `training_*` | Đối chiếu khi module Backup & Restore tiếp tục | WP-HARDEN |
| I-6 | Cờ `feat-tms-*` đang điều khiển menu thử | Quyết định khi thay menu | WP-FE-CLEAN |
