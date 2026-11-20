# Thiết kế tầm nhìn theo Access Profile và gỡ Object Access Rules (2026-11-20)

Trạng thái: **S1, S2, S3 và S4 (Training, Reports) ĐÃ LÀM VÀ KIỂM CHỨNG TRÊN DEV (2026-11-20); S5 (tài liệu) đã cập nhật; còn thiết kế riêng cho các module còn lại.** Chi tiết kết quả và các quyết định phát sinh: Decision Log, mục VISIBILITY-TIERS-BUILT-2026-11-20.
Nhãn: [mã] = đọc trong mã; [DB] = đo trên DB DEV 2026-11-20; [chưa đọc sâu] = chưa kiểm chứng.
Thay thế các phần sau của `KE_HOACH_HOAN_THIEN_PHAN_QUYEN_TOAN_MODULE_2026_11_20.md`: mục 4.2, WP1(a), WP7. Tiếp nối quyết định `DC-VISIBILITY-TIERS-2026-11-07` (đã có nhãn "View everything / Named in flow" trên Access Profile).

## 1. Quyết định của chủ hệ thống (2026-11-20)
1. Bỏ **Object Access Rules do quản trị viên tạo** (mục Security & Authorization > Advanced > Object Access Rules), cho mọi module.
2. Bỏ **phạm vi Business Unit/Department trên Access Profile** khỏi Document Control.
3. Bỏ chế độ toàn hệ thống "ai có quyền xem thì thấy hết" (`ALL_WITH_VIEW_PERMISSION`, Document Properties).
4. **Tầm nhìn đặt trong Access Profile**, không tạo màn cấu hình riêng. Mỗi module có bản ghi theo flow hoặc theo phòng ban hiển thị một dòng chọn một trong ba: *chỉ record có tên tôi trong flow* / *record của phòng tôi* / *tất cả record*. Module không áp dụng thì ẩn dòng.
5. Module lấy theo tên menu ở sidebar (12 mục).
6. Document Control:
   - "Người trong flow" là flow của tài liệu cha; theo từng revision (người bị gỡ khỏi flow của revision mới không thấy revision mới, vẫn thấy revision cũ của mình).
   - Phòng của tài liệu là Department ghi trên tài liệu lúc tạo (so với `department_id` của người dùng).
   - Người nhận bản sao vẫn thấy bản của mình. Người trong flow của tài liệu cha cũng thấy bản sao (Controlled và Uncontrolled). Tải/in do Controlled Copies Policy quyết định, không thêm quyền riêng.
   - Revision theo cùng cơ chế với Document.
7. Cách làm phải giữ nguyên kiến trúc Hybrid: quyền chức năng + quan hệ với bản ghi + trạng thái + tách trách nhiệm.

## 2. Cách phân quyền hiện tại [mã]
- **Access Profile** = các Permission Set gắn vào profile (`access_profile_permission_sets`) + một set riêng tự quản `ROLE_<mã>` chứa quyền chọn trực tiếp. Quyền của người = hợp các quyền của mọi profile đang hoạt động. [`AccessProfileService`, `AccessProfilePermissionsTab.tsx`]
- **Tầm nhìn Document Control hôm nay** là quyền: `documents.document.view_all`, `documents.controlled_copy.view_all`, `documents.uncontrolled_copy.view_all`. Nhãn "View everything / Incomplete / Named in flow" của profile được **tính từ quyền, không lưu** (`DocumentControlVisibility`, `AccessProfileService#documentControlVisibility`). Bộ gói: Permission Set `PS_DOCUMENT_VIEW_ALL` ("Document Control - View Everything").
- **Document/Revision:** `DocumentAuthorizationService` quyết định xem (một hàm cho chi tiết) và có hai predicate SQL cho danh sách (`documentListVisibilityPredicate`, `revisionListVisibilityPredicate`). Chế độ mở (`isOpenVisibilityMode`) cộng thêm cho người có quyền xem cơ bản.
- **Bản sao:** Controlled Copy chỉ do người nhận và người có `controlled_copy.view_all` thấy; người trong flow **không** thấy chỉ vì flow (ghi rõ trong mã). Uncontrolled Copy: `uncontrolled_copy.view_all` hoặc chế độ mở, người nhận, hoặc người có quyền phân phối ở trạng thái chờ.
- **Preview và Audit Trail của tài liệu:** người trong flow (`isDirectStakeholder`) được bỏ qua yêu cầu quyền preview/audit riêng (quyết định HDR-AUTH-001); người xem gián tiếp vẫn cần quyền riêng.
- **Nơi lặp lại điều kiện xem** (phải đổi cùng nhau): `DocumentService` (danh sách), `RevisionService` (danh sách), `ControlledCopyService` (danh sách + từng bản), `UncontrolledCopyService`, `DocumentControlMenuAccess` (mục nào hiện ở menu), `SecureFileAccessService`, `DocumentReportVisibility` (SQL cho báo cáo), `AuditTrailService`, `ReportPlatformService`, các nơi Training gọi `canViewDocument/canViewRevision`.
- **Object Rule/phạm vi profile** (`ObjectAccessEvaluationService`) chỉ tác động hành động, danh sách người đủ điều kiện làm Reviewer/Approver và xem Controlled Copy; **không** lọc danh sách Document. Bảy nơi gọi: `DocumentAuthorizationService`, `DocumentResourceAdapter`, `RevisionResourceAdapter`, `ControlledCopyResourceAdapter`, `ControlledCopyAuthorizationService`, `DocumentParticipantEligibilityService`, `AccessEffectiveService`.
- **Dữ liệu DEV:** `object_access_rules` có 3 dòng, cả ba là chia sẻ Knowledge (có chủ sở hữu); không có luật quản trị viên nào; bảng `access_profile_object_rules` trống. 11 profile đặt phạm vi (`roles.business_unit_scope/department_scope`). Cấu hình `documentVisibilityMode` chưa đặt (mặc định `PARTICIPANTS_ONLY`).
- **Người và phòng:** `UserAccount.departmentId` (khóa ngoại, "cái authorization dùng"), `DocumentRecord.department` và `DocumentRevisionRecord.department` đều là khóa ngoại. Không cần so khớp theo tên.

## 3. Thiết kế đích

### 3.1 Tầm nhìn: quyền vẫn là nơi lưu, Access Profile có bộ chọn
Giữ nguyên nguyên tắc "tính từ quyền, không lưu" để không có hai nguồn sự thật. Thêm quyền mới cho mức giữa; màn Access Profile thêm bộ chọn dễ đọc, ghi/xóa quyền tương ứng trong set tự quản `ROLE_<mã>`.

| Mức | Document Control: Documents và Revisions | Controlled Copy | Uncontrolled Copy |
|---|---|---|---|
| Chỉ record có tên tôi (mặc định) | trong flow (tác giả, chủ, Co-author, Reviewer, Approver) | trong flow của tài liệu cha, người nhận | trong flow của tài liệu cha, người nhận |
| Record của phòng tôi | `documents.document.view_department` (mới) | không có mức này | không có mức này |
| Tất cả | `documents.document.view_all` | `documents.controlled_copy.view_all` | `documents.uncontrolled_copy.view_all` |

Bộ chọn "Document Control" có ba lựa chọn trọn gói: **Named in flow** (không quyền nào), **My department** (`view_department`), **All** (ba quyền `view_all`). Trộn khác các tổ hợp trên hiển thị là **Custom** kèm giải thích, như nhãn "Incomplete" hôm nay. Quyền nhận từ Permission Set dùng chung hiển thị khóa và nêu tên set (cách tab Permissions đã làm).
- Mức cao nhất thắng khi người có nhiều profile (hợp các quyền).
- `view_all` bao gồm `view_department`.
- "Phòng tôi" = `document.department_id` trùng `user.department_id`. Revision lấy phòng của **Document** (theo yêu cầu "revision ăn theo Document"). Người không có phòng chỉ ở mức flow.
- Mức phòng là **xem gián tiếp**: như chế độ mở hôm nay, **không** miễn quyền preview/audit riêng (HDR-AUTH-001 giữ nguyên, chỉ người trong flow được miễn).

### 3.2 Hành động
Giữ bốn lớp Hybrid. Phòng ban không còn là điều kiện của hành động Document Control (bỏ Object Rule và phạm vi profile): người trong flow làm đúng việc được giao bất kể phòng; ai đủ điều kiện làm Reviewer/Approver do quyền chức năng quyết định như hôm nay.

### 3.3 Từng module (theo sidebar)
| # | Module | Hôm nay [mã] | Đích |
|---|---|---|---|
| 1 | Notifications | Mỗi người chỉ thấy thông báo của mình | Không áp dụng, giữ nguyên |
| 2 | Self-Service (Dashboard, Knowledge Base) | Dashboard: dữ liệu của chính người xem. Knowledge Base: mô hình riêng (Head/Delegate, 4 chế độ, chia sẻ) | Giữ nguyên |
| 3 | Document Control (Documents, Revisions, Controlled Copies, Uncontrolled Copies, Records) | Như mục 2. Records [chưa đọc sâu] | Bộ chọn ba mức ở 3.1; bỏ chế độ mở, phạm vi profile, Object Rule |
| 4 | Training Management | Quyền áp dụng cho phòng mình, trừ khi có `training.scope.all` (`TrainingAccess`) | Bước S4; cần xác nhận [chưa đọc sâu từng màn] |
| 5 | Reports | Chạy báo cáo `reports.run.view_own` / `view_all`; template theo `report_template_role_scopes` (47 dòng [DB]) | Bước S4; giữ `report_template_role_scopes` |
| 6 | Audit Trail (All Records, Periodic Review) | Theo quyền xem màn hình | Giữ; Periodic Review xét ở S4 |
| 7 | Backup & Restore | Quyền phẳng | Không áp dụng |
| 8 | Security & Authorization | Quyền phẳng + chữ ký; Access Review có campaign | Gỡ mục Object Access Rules; Access Review xét ở S4 |
| 9 | Application Settings | RBAC + chữ ký + audit | Không áp dụng |
| 10 | System Administration | Như trên; Document Properties có lựa chọn chế độ hiển thị | Bỏ lựa chọn chế độ mở |
| 11 | Preferences | Của chính người dùng | Không áp dụng |
| 12 | System Information | Chỉ đọc | Không áp dụng |

### 3.4 Gỡ Object Access Rules
**Giữ:** bảng `object_access_rules` và đường đọc chia sẻ Knowledge (bản ghi có chủ sở hữu); `report_template_role_scopes`.
**Gỡ (sau khi phần thay thế chạy được, bước S3):** màn và API quản trị Object Access Rules, `ModuleObjectRuleService`, bước Object Rule trong `AuthorizationEngineService`, `objectRuleModuleKey/objectRuleFacts` trong `ResourceAuthorizationAdapter`, phần Object Rule của `ReportTemplateResourceAdapter`; bảng `access_profile_object_rules` nếu không còn người đọc; mục menu, route, breadcrumb, nhãn, hướng dẫn.
Gỡ `ObjectAccessEvaluationService` và phạm vi BU/Phòng ban của profile **khỏi Document Control** (bước S2); cột `roles.business_unit_scope/department_scope` giữ tới khi xác nhận không module nào khác đọc (tìm tham chiếu trước khi xóa).

## 4. Điều phải đúng sau thay đổi (bất biến kiểm thử)
1. Danh sách và chi tiết trả cùng kết quả cho mọi người dùng (cùng hàm hoặc có test đối chiếu).
2. Mức phòng không miễn quyền preview/audit; không mở thêm tải/in bản sao.
3. Reviewer/Approver/Co-author/Author/chủ luôn thấy bản ghi của mình, bất kể phòng.
4. Người đã bị gỡ khỏi flow của revision mới không mở được revision mới; vẫn thấy revision cũ của mình; cấu hình "giữ quyền xem" theo vai trò vẫn hoạt động như hôm nay.
5. Người không có phòng khớp được thì chỉ có mức flow.
6. Báo cáo Document dùng cùng điều kiện với danh sách.
7. Bỏ chế độ mở không làm bất kỳ ai vô tình **thấy nhiều hơn**; ai đang thấy nhờ chế độ mở (nếu có) phải được báo để gán `view_all`/`view_department` (DEV: chưa bật).
8. Bỏ phạm vi profile không đổi kết quả **chặn** nào ngoài dự kiến: đối chiếu trước/sau cho 11 profile.

## 5. Rủi ro và cách giữ an toàn
- **Điều kiện xem lặp lại ở nhiều nơi** (mục 2): đổi bằng một hàm dùng chung + test đối chiếu; GitNexus impact và tìm tham chiếu thủ công cho từng nơi.
- **Bản sao (vùng GMP nhạy cảm):** mở thêm người thấy bản ghi bản sao không được kéo theo tải/in/preview nội dung; kiểm tra từng đường nội dung (preview, tải, in, portal) trước khi đổi.
- **Quyền mới và phụ thuộc quyền:** phải thêm vào danh mục quyền và bảng phụ thuộc quyền; test tab Permissions và Access Explorer.
- **Thay đổi hành vi có chủ đích** (bản sao cho người trong flow) đảo ngược quyết định cũ → ghi Decision Log.
- Hồi lại: mỗi migration có cách đảo; mỗi bước một commit logic riêng, không gộp giao diện với hành vi.

## 6. Việc chưa chốt (hỏi chủ hệ thống khi gặp)
- Mức "phòng tôi" cho bản sao: đang **không có** (theo yêu cầu #6).
- Training Management, Reports, Periodic Review, Access Review: hình thức bộ chọn và quan hệ "trong flow" của từng loại bản ghi (S4).

## 7. Không thuộc phạm vi
Knowledge Base, `report_template_role_scopes`, luật tách trách nhiệm (Separation Rules), Backup & Restore, các cấu hình Settings/System Administration.

## 9. Kết quả (cập nhật 2026-11-20)
| Bước | Kết quả |
|---|---|
| S1 | Xong, kiểm chứng sống: 21/21 (Document/Revision), 36/36 (bản sao) |
| S2 | Xong: gỡ chế độ mở (V827), phạm vi profile (V828), đánh giá Object Rule của Document Control; kiểm chứng lại S1 + hành động revision |
| S3 | Xong: gỡ Object Access Rules do admin tạo (V829), giữ chia sẻ Knowledge; 13/13 |
| S4 | Training và Reports: bộ chọn hai mức (không đổi logic). Module còn lại: chờ thiết kế riêng theo yêu cầu của chủ hệ thống |
| S5 | Hướng dẫn, test guide, DESIGN.md, Decision Log đã cập nhật |

## 8. Các bước (mỗi bước một thay đổi có kiểm soát)
| Bước | Nội dung | Ra cổng khi |
|---|---|---|
| S1 | Document Control: quyền `view_department`, điều kiện ở mọi nơi lọc/kiểm tra xem, bản sao theo flow, bộ chọn trên Access Profile; chưa gỡ gì | Test phủ định, hai người thật, so sánh trước/sau, ảnh chụp |
| S2 | Gỡ chế độ mở và phạm vi profile/Object Rule khỏi Document Control; sửa Document Properties, Access Profile | Đối chiếu 11 profile; ảnh chụp |
| S3 | Gỡ Object Access Rules do quản trị viên tạo cho mọi module (mã, màn, API, menu, tài liệu) | Test Knowledge chia sẻ; tìm tham chiếu sót |
| S4 | Training Management, Reports, Periodic Review, Access Review theo xác nhận | Test phủ định, hai người thật |
| S5 | Cập nhật hướng dẫn, test guide, Decision Log, DESIGN.md | Tài liệu khớp mã |
