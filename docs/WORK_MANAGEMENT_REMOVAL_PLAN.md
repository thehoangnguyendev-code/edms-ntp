# Kế hoạch gỡ bỏ toàn bộ Work Management

## 1. Mục tiêu và ranh giới

Gỡ bỏ hoàn toàn module **Work Management** độc lập (project, issue, board, inbox, calendar và workspace `WORK`) khỏi EQMS, gồm FE, API, backend, navigation, permission, feature flag và schema dữ liệu riêng của module.

Không được đụng tới các khái niệm có chữ “work” nhưng thuộc nghiệp vụ khác, ví dụ:

- `Work Instruction` / `Working Instruction`: loại tài liệu Document Control.
- `working note`, publishing workspace, async worker/job: chức năng Document Control/hệ thống.
- thông tin **Work & Professional Profile** trong hồ sơ nhân sự: dữ liệu nhân sự, không phải Work Management.
- workflow, workflow role, workspace chỉnh sửa revision: không phải Work Management.

## 2. Phạm vi đã xác nhận

### FE và sidebar

| Khu vực | Thành phần cần gỡ |
|---|---|
| Routes | `ROUTES.WORK` trong `eqms/src/app/routes.constants.ts`; toàn bộ route `/work-management/**` và lazy import `WorkManagementView` trong `eqms/src/app/AppRoutes.tsx`. |
| Navigation | `WORK_NAV_CONFIG` và export/gộp `...WORK_NAV_CONFIG` trong `eqms/src/app/navigation.ts`; import tương ứng tại `eqms/src/app/constants.ts`. |
| Sidebar | Workspace switcher `QUALITY/WORK`, state `workspaceTab`, `lastWorkspaceRoute`, project menu động, drag/reorder project, modal tạo project, preference API và toàn bộ logic nhận diện `/work-management` trong `eqms/src/components/layout/sidebar/Sidebar.tsx`. |
| Feature FE | Xóa `eqms/src/features/work-management/` gồm `WorkManagementView`, `WorkInboxView`, `CreateWorkProjectModal`, `useWorkSidebarProjects`, `index.ts`. |
| API FE | Xóa `eqms/src/services/api/work-management.ts`. |
| Dashboard | Bỏ nút **View My Tasks** và link **View all pending actions** đang điều hướng `ROUTES.WORK.DASHBOARD` trong `eqms/src/features/dashboard/DashboardView.tsx`. Giữ “My Pending Actions” của Document workflow; các action này đã điều hướng trực tiếp vào revision. |
| Breadcrumb | Bỏ breadcrumb `Work Management` tại `eqms/src/components/ui/breadcrumb/breadcrumbs/core.ts`. |
| Permission catalog FE | Bỏ mục `work_management.*` trong `eqms/src/features/settings/permissionCatalog.ts`. |

### Backend/API

| Khu vực | Thành phần cần gỡ |
|---|---|
| Controller/API | `com.eqms.workmanagement.WorkManagementController`; toàn bộ `/work-management/**` endpoint. |
| Service | `WorkManagementService`, `WorkManagementAuthorizationService`, `WorkManagementCapabilityService`. |
| DTO | `com.eqms.dto.workmanagement.WorkManagementDtos`. |
| Capability registry | Xóa dependency/import và nhánh resource type `WORK_PROJECT` trong `ResourceCapabilityService`. |
| Cấu hình mặc định | Bỏ feature `feat-work-management` khỏi defaults ở `SystemConfigurationService`. |
| Permission seed lịch sử | Không sửa migration cũ `V236__seed_work_management_authorization_permissions.sql`; dùng migration mới để xóa dữ liệu permission và mapping hiện hữu. |

### Database

Schema Work Management hiện có:

1. `work_global_user_roles`
2. `work_projects`
3. `work_project_members`
4. `work_issues`
5. `work_issue_history`
6. Dữ liệu `WORK` trong `user_workspace_navigation_preferences`
7. Feature `feat-work-management` trong `system_configurations.features_config`
8. Permission `work_management.project.view`, `work_management.project.create`, `work_management.project.manage_members`, `work_management.issue.create`, `work_management.issue.update` và các mapping profile/set liên quan.

## 3. Quyết định dữ liệu bắt buộc trước khi drop schema

Drop các bảng Work là thao tác phá hủy dữ liệu. Không được thực hiện trực tiếp trên production trước khi có quyết định retention được phê duyệt.

Mặc định an toàn đề xuất:

1. Xuất snapshot có kiểm tra hash cho 5 bảng Work thành dữ liệu chỉ-đọc, kèm thời điểm export và checksum.
2. Xác định Work Management có tạo regulated record hay không. Nếu có, snapshot phải được lưu theo chính sách retention/audit của tổ chức trước khi drop.
3. Backup PostgreSQL có kiểm thử restore trước migration phá hủy.
4. Sau thời hạn rollback đã duyệt, migration mới mới được `DROP TABLE` các bảng Work.

Không được chuyển Work issue thành Document Audit Trail một cách tự động: hai loại record có ngữ nghĩa, retention và actor model khác nhau. Nếu cần giữ nghiệp vụ lịch sử trên UI, phải làm read-only archive riêng theo yêu cầu đã phê duyệt; nếu không, chỉ lưu snapshot ngoài module.

## 4. Thứ tự thực hiện

### Phase 0 — Khảo sát và khóa phát sinh dữ liệu

1. Kiểm tra số record và FK thực tế bằng PostgreSQL:
   - đếm 5 bảng Work;
   - kiểm tra profile/permission set đang gán `work_management.%`;
   - kiểm tra số preference có `workspace_code='WORK'`;
   - tìm URL/bookmark `/work-management` được lưu ngoài bảng preference, nếu có.
2. Tạm ẩn Work khỏi sidebar và từ chối mutation `/work-management/**` trong release chuyển tiếp nếu cần một cửa sổ export.
3. Export snapshot + checksum + kiểm tra restore theo Mục 3.
4. Chốt quyết định retention bằng change control trước Phase 4.

### Phase 1 — Gỡ FE và trải nghiệm người dùng

1. Xóa toàn bộ `ROUTES.WORK` và `WORK_NAV_CONFIG`.
2. Xóa toàn bộ `WorkManagementView` lazy import và các route `/work-management/**`.
3. Refactor `Sidebar.tsx` về một workspace duy nhất `QUALITY`:
   - bỏ `WORKSPACE_TABS` và `TabNav` workspace;
   - bỏ `workspaceTab`, `lastWorkspaceRoute`, `workProjects`, project drag/drop, callback create/reorder;
   - bỏ `CreateWorkProjectModal`, `useWorkSidebarProjects`, `workManagementApi` import;
   - bỏ logic `location.pathname.startsWith('/work-management')`;
   - không ghi `WORK` vào workspace preference nữa.
4. Xóa feature folder và API client Work Management.
5. Dashboard:
   - bỏ CTA “View My Tasks”; không thay bằng đường dẫn Work;
   - bỏ “View all … actions” trỏ sang Work; nếu cần xem thêm pending workflow action thì tạo danh sách Document workflow đúng scope ở Dashboard/Work queue của Document Control, là hạng mục riêng, không tái lập Work Management.
6. Bỏ breadcrumb và catalog quyền Work.
7. Đảm bảo mở URL cũ `/work-management/**` cho kết quả 404 của application, không redirect vào Dashboard để tránh che giấu bookmark lỗi.

### Phase 2 — Gỡ API/backend code

1. Xóa package `com.eqms.workmanagement` và package DTO Work Management.
2. Bỏ `WorkManagementCapabilityService` khỏi constructor/import và switch `WORK_PROJECT` của `ResourceCapabilityService`.
3. Bỏ feature `feat-work-management` khỏi default config `SystemConfigurationService`.
4. Rà soát Spring component scan, test, OpenAPI/API client và documentation để chắc chắn không còn endpoint/controller/service Work bị đăng ký.
5. Không chạm vào `WorkflowAction*`, `WORKSPACE_MODE`, `Work Instruction`, async worker hoặc user professional profile chỉ vì tên có “work”.

### Phase 3 — Migration chuyển trạng thái và permission

Tạo migration Flyway mới, không sửa V175/V236/V277 đã deploy:

1. Chuyển preference `WORK` về `QUALITY` với route an toàn `/dashboard` (không giữ route `/work-management`).
2. Đổi CHECK constraint của `user_workspace_navigation_preferences.workspace_code` từ `QUALITY|WORK` thành chỉ `QUALITY` sau khi đã chuyển hết record.
3. Xóa `feat-work-management` trong JSON `system_configurations.features_config`, giữ nguyên feature khác.
4. Xóa mapping permission Work qua FK/cascade hoặc xóa rõ ràng các mapping trước; cuối cùng xóa toàn bộ `permissions` có `code LIKE 'work_management.%'` hoặc `module_key='WORK_MANAGEMENT'`.
5. Kiểm tra không còn Permission Set/Profile tham chiếu code đã xóa. Access Profile phải vẫn hợp lệ khi mất các quyền này.

### Phase 4 — Migration xóa dữ liệu Work (chỉ sau phê duyệt retention)

1. Chạy một migration riêng, có comment về change-control/retention reference.
2. Drop theo thứ tự dependency hoặc dùng `DROP TABLE ...` theo schema đã xác nhận:
   - `work_issue_history`;
   - `work_issues`;
   - `work_project_members`;
   - `work_projects`;
   - `work_global_user_roles`.
3. Xác nhận index `idx_work_*` tự bị xóa cùng bảng.
4. Không drop bảng khác hoặc dữ liệu document chỉ vì có chuỗi “work”.

### Phase 5 — Clean-up, test và triển khai

1. `rg` toàn repo để xác nhận không còn `work-management`, `workManagementApi`, `WORK_NAV_CONFIG`, `ROUTES.WORK`, `WORK_PROJECT`, `work_management.` ngoài migration lịch sử và tài liệu removal.
2. Frontend: `npx tsc --noEmit`, build Docker, smoke test Sidebar, Dashboard, Access Profile/Permission Catalog và deep-link cũ.
3. Backend: `./mvnw test`, build image, khởi động app, kiểm tra không còn controller mapping `/work-management`.
4. Database: Flyway migrate trên bản sao production, kiểm tra constraint preference, feature JSON, permission mappings và table absence.
5. Regression đặc biệt:
   - Dashboard pending review/approval vẫn mở đúng revision;
   - Sidebar Quality navigation hoạt động sau khi bỏ tab switcher;
   - đăng nhập user có preference cũ `WORK` không lỗi;
   - Access Profile không lỗi khi hiển thị catalog permission;
   - Document type `Work Instruction` vẫn tạo/xem/lọc bình thường.

## 5. Rollout và rollback

| Mốc | Có thể rollback? | Cách rollback |
|---|---|---|
| Phase 1–2 code | Có | Deploy lại image trước đó. |
| Phase 3 data migration | Có giới hạn | Migration bù để trả feature/permission/preference nếu chưa xóa schema. Không tự khôi phục assignment nếu thiếu backup. |
| Phase 4 drop bảng | Chỉ qua backup/restore | Restore bản backup đã kiểm thử; không dùng rollback tự động. |

Khuyến nghị triển khai hai release:

1. Release A: gỡ UI/API, export/backup, migrate preference/feature/permission; giữ bảng Work read-only trong một cửa sổ rollback đã duyệt.
2. Release B: sau khi retention và rollback window được phê duyệt, drop schema Work.

## 6. Definition of Done

- Không còn menu/tab Work, project động hoặc Workspace switcher Work trong Sidebar.
- Không còn route, lazy import, API client, FE feature, controller, DTO, service hay capability Work Management.
- Không còn permission/module/feature/pref `WORK` còn sống trong database.
- Không có regressions cho Document Control, workflow, Work Instruction document type, Dashboard hoặc user profile.
- Dữ liệu Work đã có retention decision, snapshot/hash và restore evidence trước khi drop table.
