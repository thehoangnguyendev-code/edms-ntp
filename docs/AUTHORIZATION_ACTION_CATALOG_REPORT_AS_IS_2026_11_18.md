# Action Catalog As-Is: module Report (2026-11-18)

Giai đoạn A, bước 1 của `AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15.md` (chủ hệ thống duyệt A rồi B ngày 2026-11-18). **Trạng thái: các dòng đã được chủ hệ thống duyệt ngày 2026-11-18 (xem mục 8).** Tài liệu này **chỉ ghi hiện trạng đọc từ mã** (As-Is): mỗi dòng truy ngược về hàm trong mã. Nó chưa phải là hành vi đích (To-Be) và chưa được QA/BA duyệt. Cột "Cần quyết" là chỗ mã không tự trả lời được. Không chuyển một dòng nào sang động cơ Hybrid trước khi dòng đó được duyệt.

Nguồn: `ReportTemplateService`, `ReportTemplateRevisionService`, `ReportPlatformService`, `ReportScheduleAdministrationService`, `ReportTypeService`, `ReportNameFormatService`, `ReportPropertiesService`, `ReportAppearanceService` (tất cả trong `com.eqms.service` và `com.eqms.service.report`). Quyền đọc bằng `require(...)` cục bộ của từng dịch vụ (không qua động cơ). Chưa có bảng `workflow_action_policies` cho Report.

## 1. Vòng đời

**Template (định nghĩa báo cáo)**: `Draft` → `Pending Approval` → `Active` ↔ `Inactive` (tắt/bật là một thay đổi nên phải đi lại Draft và duyệt, `ReportTemplateService.lifecycleOf`). Revision của template: `DRAFT`, `PENDING_APPROVAL`, `EFFECTIVE`, `OBSOLETE`, `DISCARDED` (`ReportRevisionWorkflow`). Có hai biến thể quy trình theo cờ `gmp_use` của template: duyệt thường (`reports.definition.approve`) và duyệt GMP (`reports.definition.approve_gmp`) (`reviewPermissionFor`, `requireReviewPermission`).

**Run (lần chạy)**: `QUEUED` → `PROCESSING` → kết thúc (thành công / lỗi), có thể thử lại; file kết quả có **legal hold** và hạn lưu giữ (`ReportPlatformService.queueRun`, `retryRun`, `processOneQueuedRun`, `setArtifactLegalHold`, `purgeExpiredArtifacts`).

**Schedule (lịch chạy)**: `ACTIVE` / tạm dừng; có chủ sở hữu (owner) và người nhận.

## 2. Action Catalog: Template và Revision

| Hành động | Từ trạng thái | Quyền (hiện tại) | Quan hệ / điều kiện theo bản ghi | Chữ ký điện tử (ý nghĩa) | Biến thể | Mã truy ngược | Cần quyết |
|---|---|---|---|---|---|---|---|
| Xem danh sách, chi tiết, lịch sử revision | mọi | `reports.definition.view` | — | không | — | `adminDetail`, `revisionDetail`, `revisionListAll`, `ReportPlatformService.configuration*` | Phạm vi theo loại báo cáo / nguồn dữ liệu? |
| Tìm role cho phân quyền người dùng báo cáo | mọi | `reports.definition.view` hoặc `.manage` | — | không | — | `searchRoles` | — |
| Tạo template | — | `reports.definition.manage` | — | không | — | `create` | Ai được tạo template GMP ngay từ đầu? |
| Lưu nháp (thay đổi cấu hình, trường, từ/ngữ, chữ ký trên báo cáo) | `DRAFT` (hoặc `APPROVED` mở revision mới) | `reports.definition.manage` | người đang sửa được ghi là tác giả (`last_changed_by_user_id`) | có (`REPORT_DEFINITION_CHANGE`) | GMP / không GMP | `save`, `updateConfiguration`, `updateFields`, `configureWords`, `configureSignatures` | — |
| Gửi duyệt | `DRAFT` | `reports.definition.manage` | người gửi được ghi (`submitted_by_user_id`) | có | GMP / không GMP | `submitForApproval` | Cho phép người gửi ≠ tác giả hay không? |
| Duyệt | `PENDING_APPROVAL` | `reports.definition.approve` (thường) hoặc `reports.definition.approve_gmp` (template GMP) | **Khác người**: người duyệt không được là tác giả hay người gửi (`REPORT_APPROVER_IS_AUTHOR`); đúng phiên bản đang chờ | có (`REPORT_TEMPLATE_APPROVAL`) + lý do ≤ 1000 ký tự | **GMP / không GMP** (quyền duyệt khác nhau) | `approve`, `requireReviewPermission`, `requireIndependentReviewer` | Có cần người duyệt thứ hai cho GMP? Phạm vi (chỉ template của nguồn mà người duyệt nắm)? |
| Từ chối | `PENDING_APPROVAL` | như Duyệt | như Duyệt | có (`REPORT_TEMPLATE_REJECTION`) + lý do | GMP / không GMP | `reject` | — |
| Nâng cấp (tạo revision mới từ bản hiệu lực) | `EFFECTIVE` | `reports.definition.upgrade` | — | không | — | `upgrade` | Có cần lý do/chữ ký không? |
| Bật / tắt | `ACTIVE` / `INACTIVE` | `reports.definition.set_enabled` | tắt rồi bật phải đi lại Draft + duyệt | không (thay đổi qua duyệt) | — | `setEnabled` | — |
| Hủy bản nháp | `DRAFT` | `reports.definition.discard_revision` | — | không | — | `discardRevision` | — |
| Xóa template | `DRAFT` chưa từng duyệt | `reports.definition.manage` | **cấm** nếu template GMP (`REPORT_GMP_TEMPLATE_CANNOT_BE_DELETED`) | không | GMP chặn | `delete` | — |
| Xem trước, ảnh chụp mẫu | mọi | `report.module.export` hoặc `reports.run.create` | — | không | — | `snapshot`, `render` | — |

## 3. Action Catalog: Run, Artifact, Schedule, Giữ lại

| Hành động | Quyền (hiện tại) | Quan hệ / phạm vi | Chữ ký | Mã truy ngược | Cần quyết |
|---|---|---|---|---|---|
| Xem danh mục báo cáo | `report.module.view` hoặc `reports.catalog.view` | — | không | `catalog` | — |
| Xem lần chạy | `reports.run.view_own` / `reports.run.view_all` (+ `report.module.view`) | **của chính mình** hay **tất cả** | không | `runs`, `runDetail`, `canViewRunAudit` | Ai là "tất cả" khi có phạm vi phòng ban (D-DEPARTMENT_RULES)? |
| Chạy báo cáo | `reports.run.create` + `report.module.export` | chỉ template **đang hiệu lực** (`REPORT_NOT_APPROVED` nếu chưa) | có, khi báo cáo yêu cầu (`runNeedsSignature`) | `queueRun`, `render` | Template GMP: người chạy cần quyền riêng? |
| Thử lại lần chạy lỗi | `reports.run.create` + `report.module.export` + (`reports.run.view_all` nếu của người khác) | chủ lần chạy hoặc người có `view_all` | không | `retryRun` | — |
| Tải file kết quả | `reports.artifact.download` | theo phạm vi lần chạy | không | `scopes` | — |
| Đặt / gỡ legal hold trên file | `reports.retention.manage` hoặc `reports.definition.manage` | — | có (`REPORT_LEGAL_HOLD_RELEASE` khi gỡ) | `setArtifactLegalHold`, `legalHolds` | Hai người cho việc gỡ hold? |
| Xóa file hết hạn lưu | hệ thống (job) | bỏ qua file có hold | không (job) | `purgeExpiredArtifacts` | — |
| Tạo lịch chạy | `reports.schedule.manage` + `report.module.export` | chủ lịch = người tạo | có | `createSchedule` | — |
| Tạm dừng / tiếp tục / xóa lịch | `reports.schedule.manage` + `report.module.export` | chủ lịch hoặc quản lý | không | `resumeSchedule`, `deleteSchedule` | — |
| Đổi chủ lịch | `reports.schedule.manage` + `report.module.export` | — | không | `changeScheduleOwner` | Chủ mới phải được kiểm quyền chạy? |
| Xem / gửi nhận | `reports.schedule.manage` | người nhận do chủ lịch chọn | không | `recipientCandidates`, `recipientPeople`, `recipientGroups`, `deliveries` | Người nhận có phạm vi nhìn thấy dữ liệu? |
| Chạy theo lịch (job) | hệ thống, nhân danh chủ lịch | kiểm lại quyền của chủ lịch lúc chạy | có theo cấu hình | `processOneDueSchedule` | Chủ lịch mất quyền sau khi tạo: dừng lịch hay chạy tiếp? (kiểm tra chéo bắt buộc trong tài liệu `eqms-operational-records-assurance`) |

## 4. Cấu hình quanh Report (đơn lẻ, không vòng đời)

| Hành động | Quyền | Mã truy ngược | Hướng đích |
|---|---|---|---|
| Xem / bật tắt Report Type | `reports.types.view` / `.manage` | `ReportTypeService` | RBAC + audit + chữ ký (nhóm 7.A) |
| Tên mẫu số báo cáo (Name Format) | `reports.name_format.manage` (xem: `reports.definition.view`) | `ReportNameFormatService` | RBAC |
| Properties của module Report | `reports.properties.view` / `.manage` | `ReportPropertiesService` | RBAC |
| Appearance (khung, chữ, logo của file) | `reports.appearance.view` / `.manage` | `ReportAppearanceService` | RBAC |

## 5. Điểm tách biệt nhiệm vụ đang nằm trong mã (cần chuyển thành quan hệ)

1. Người duyệt ≠ tác giả ≠ người gửi (`requireIndependentReviewer`): **mã cứng trong dịch vụ Report**. Đây là chính "kiểm tra khác người lúc chạy" mà giai đoạn A.2(b) phải đưa vào động cơ.
2. Ràng buộc SoD cấu hình trong DB: "Manage vs Approve GMP Report Template" (`sod_constraints`). Hai lớp (mã + DB) cùng tồn tại; động cơ chỉ nên giữ một.
3. Quyền duyệt chọn theo cờ GMP (`reviewPermissionFor`): đây là chiều "biến thể" mà A.2(a) phải thêm vào chính sách (hiện động cơ chỉ phân biệt theo document type).

## 6. Việc cần chủ hệ thống / QA duyệt trước khi sửa mã

Với mỗi dòng ở mục 2 và 3: **Duyệt như hiện trạng** (To-Be = As-Is) hoặc **Sửa** (ghi hành vi đích). Các câu hỏi ở cột "Cần quyết" là điểm mã không tự trả lời được. Hiện chưa có quyết định nào được ghi cho Report trong `DECISION_LOG.md` ngoài `REPORT-TEMPLATE-APPROVAL` và các quyết định GMP đã có (2026-10-14, 2026-11-12, 2026-11-15).

Thứ tự công việc sau khi duyệt: (1) mở rộng động cơ: chiều biến thể (GMP / không GMP), kiểm tra khác người theo quan hệ, adapter dựa trên bảng chính sách dùng chung; (2) bài kiểm tra kiến trúc "mọi route chạm bộ kiểm tra hoặc nằm trong danh sách ngoại lệ"; (3) Report: adapter template, chính sách seed theo bảng này, chạy shadow, bật cờ, xóa mã cũ. Mỗi bước có `impact` và `detect_changes` của GitNexus trước khi sửa và trước khi commit.

## 7. Giới hạn

Trích từ hàm công khai của 8 dịch vụ bằng đọc mã; các hàm riêng và các điều kiện lồng trong từng nhánh có thể còn sót (ví dụ điều kiện theo nguồn dữ liệu của từng loại báo cáo trong 40 `*ReportMetadataProvider`). Mỗi dòng cần được đối chiếu lại khi viết test ma trận.

## 8. Quyết định của chủ hệ thống (2026-11-18)

| Câu hỏi | Quyết định | Hệ quả |
|---|---|---|
| Duyệt template GMP: một người `approve_gmp` hay thêm người thứ hai? | **Giữ nguyên**: một người, khác tác giả và người gửi, có chữ ký và lý do | To-Be = As-Is; không đổi vòng đời |
| Chủ lịch mất quyền sau khi tạo lịch | **Dừng lịch, báo cho quản lý lịch** | **Mã đã làm đúng như vậy**: `processOneDueSchedule` kiểm lại trạng thái và quyền chạy của người tạo, nếu thiếu thì `suspendSchedule(... SUSPENDED_AUTHORIZATION...)` và `notifyScheduleSuspended`. Chỉ cần bảo đảm giữ hành vi này khi chuyển sang động cơ, kèm test |
| Gỡ legal hold | **Giữ nguyên** một người có chữ ký (`REPORT_LEGAL_HOLD_RELEASE`) và lý do | To-Be = As-Is |
| Các dòng còn lại (mục 2, 3, 4) | **Duyệt như hiện trạng** | To-Be = As-Is; chuyển nguyên hành vi sang động cơ, không đổi gì |

Vì không có dòng nào đổi hành vi, bước chuyển Report sang động cơ phải cho **kết quả giống hệt** ở mọi ô của ma trận (hành động x trạng thái x quyền x quan hệ x biến thể GMP); shadow 0 lệch là điều kiện để bật cờ.
