SDS-TR-001 · Thiết kế chi tiết module Training Management và phối hợp với Document Control · phiên bản 1.0 · 2026-10-16

# SDS Training Management (thiết kế chi tiết: giao diện, máy chủ, API, cơ sở dữ liệu)

**Trạng thái:** **ĐÃ ĐƯỢC CHỦ DỰ ÁN CHẤP NHẬN ĐỂ BẮT ĐẦU TRIỂN KHAI (2026-10-16); chờ QA xác nhận các quyết định** (PLAN-TR-001 mục 13.2). Chưa có mã nào được viết theo tài liệu này. Đây là thiết kế; không phải phê duyệt GMP, và mỗi gói công việc vẫn cần hồ sơ thay đổi riêng.
**Căn cứ:** SOP.0003.02 và chín biểu mẫu (`docs/training_docs/*.md`); kế hoạch nghiệp vụ `PLAN-TR-001-training-management.md` (bản 0.3) cùng các quyết định của chủ dự án ngày 2026-10-15 (D-23 đến D-26, D-29, D-30; D-27, D-28, D-31 đã được đồng ý); mã nguồn hiện có (KIỂM TRA MÃ).
**Đọc bởi:** Chủ dự án, QA, IT, dev.

**Chú giải nhãn:** **SOP** (có trong quy trình); **KIỂM TRA MÃ** (đã thấy trong mã hoặc migration); **ĐỀ XUẤT** (thiết kế của người soạn); **QUYẾT ĐỊNH** (đã chốt, ghi nguồn); **MỞ** (chưa chốt; hiện **không còn** mục nào ở trạng thái này, xem mục 16).

> **Cập nhật 2026-10-16.** Lưu đồ mục 5.2 đã có (ảnh `docs/training_docs/SOP.0003.02 Flowchart (muc 5.2).png`), đã đối chiếu ở PLAN-TR-001 mục 5.0. Đã chốt D-01, D-02 (ma trận là dữ liệu Training), D-05 (duyệt do người được phân quyền, không cấp cố định), D-20 (cả ký điện tử và ký tay). Thay đổi thiết kế từ đó: mục 3.4, 7.1, 8.1, 15, 16.
>
> **Cập nhật 0.3 (2026-10-16).** Chủ dự án ủy quyền đề xuất các câu còn mở và đặt nguyên tắc: **mọi bước xem xét, duyệt, xác nhận thiết kế theo phân quyền; người xử lý do người dùng chỉ định, bất kỳ user nào đủ điều kiện** (mục 8.5 mới). Các quyết định D-03 đến D-22, D-32, D-33 ở mục 16.2 là **đề xuất đã được chấp nhận qua ủy quyền; QA xác nhận**.
>
> **Giới hạn.** Điều khoản EU-GMP và Annex 11 nêu theo hiểu biết của người soạn: **QA phải đối chiếu số điều khoản với bản chính thức** trước khi đưa vào hồ sơ kiểm định.

## Mục lục

- 0 Kiểm soát tài liệu và cách đọc
- 1 Nguyên tắc thiết kế: tuân thủ EU-GMP, toàn vẹn dữ liệu, bảo mật
- 2 Kiến trúc và ranh giới với Document Control
- 3 Mô hình nghiệp vụ và máy trạng thái
- 4 Cơ sở dữ liệu
- 5 Cấp Training Number
- 6 Phối hợp Document Control (hợp đồng chi tiết)
- 7 API
- 8 Phân quyền, tách nhiệm vụ, chữ ký điện tử
- 9 Audit Trail và toàn vẹn dữ liệu
- 10 Giao diện (Training Management và thay đổi ở Document Control)
- 11 Công việc nền, nhắc việc và thông báo
- 12 Tuân thủ và báo cáo
- 13 Mô hình đe dọa và kiểm soát bảo mật
- 14 Kiểm định và kế hoạch kiểm thử
- 15 Kế hoạch triển khai theo gói công việc
- 16 Quyết định và giả định
- 17 Truy vết quy tắc đến thiết kế và kiểm thử
- 18 Cập nhật 2026-10-17: vận hành giấy và điện tử, đào tạo bên ngoài

---

## 0 Kiểm soát tài liệu và cách đọc

| Mục | Nội dung |
|---|---|
| Mã tài liệu | SDS-TR-001 |
| Phiên bản | 1.0 (chủ dự án chấp nhận 2026-10-16). Lịch sử: 0.1 (2026-10-15) bản đầu; 0.2 đối chiếu lưu đồ; 0.3 chỉ định người xử lý theo phân quyền; 1.0 hợp nhất, thêm 15.1 đến 15.2 |
| Quan hệ | `PLAN-TR-001` nói **cái gì** (nghiệp vụ, quy tắc TR-01 đến TR-31, câu hỏi D-xx); tài liệu này nói **làm thế nào** (kiến trúc, bảng, API, giao diện, kiểm thử, gói công việc). Khi hai tài liệu khác nhau, PLAN-TR-001 là căn cứ nghiệp vụ và tài liệu này phải sửa theo. |
| Hồ sơ thay đổi | Mỗi gói công việc (mục 15) là **một thay đổi có kiểm soát**: một hồ sơ theo `08_ONE_CHANGE_RECORD_TEMPLATE.md`, mục Decision Log, bằng chứng âm tính, đồng thời và lỗi. |
| Quy ước dự án áp dụng | Chỉ làm trên DEV; không ghi mật khẩu vào tệp; không dùng chữ hiển thị làm giá trị máy; tìm kiếm, lọc, sắp xếp, phân trang ở máy chủ; giao diện giống màn hình tương đương đã có; xóa hẳn mã bị thay thế; phân tích ảnh hưởng (GitNexus `impact`) trước khi sửa một ký hiệu, `detect_changes` trước khi commit; chỉ commit khi chủ dự án yêu cầu. |
| Mã thử cũ | `eqms/src/features/training/` và `eqms/src/features/settings/training-administration/` là giao diện thử của chủ dự án (dữ liệu mẫu). **Không dùng làm căn cứ; thay thế và xóa hẳn** theo mục 15 (WP-FE-CLEAN). |

---

## 1 Nguyên tắc thiết kế: tuân thủ EU-GMP, toàn vẹn dữ liệu, bảo mật

Ba thứ này **đứng trước** tiện lợi và tốc độ làm. Khi một thiết kế dễ làm hơn nhưng yếu hơn ở một trong ba thứ, chọn cái chặt hơn và ghi lại.

### 1.1 Căn cứ quy định (QA xác nhận số điều khoản)

| Nguồn | Điều liên quan đến Training (theo SOP.0003 mục 4.3) | Hệ quả thiết kế |
|---|---|---|
| EudraLex Vol. 4, Chương 2 (Nhân sự), mục 2.10 đến 2.14 | Đào tạo ban đầu và liên tục phù hợp nhiệm vụ; chương trình đào tạo được phê duyệt; hiệu quả đào tạo được đánh giá; lưu hồ sơ | Ma trận đào tạo có phê duyệt; chương trình (yêu cầu đào tạo) có phê duyệt; đánh giá có tiêu chí đạt; hồ sơ bất biến |
| EudraLex Vol. 4, Annex 11 (Hệ thống máy tính hóa) | Quản lý rủi ro, kiểm định, kiểm soát truy cập, audit trail, chữ ký điện tử, lưu trữ và truy xuất, quản lý thay đổi, đánh giá định kỳ, liên tục hoạt động | Các mục 1.2 đến 1.4 và 9, 13, 14 |
| WHO TRS 986, Annex 2, mục 10 | Đào tạo trong GMP | Như trên |
| ISO 9001:2015 và ISO 14001:2015, 7.1 đến 7.3 | Năng lực, đào tạo, nhận thức | Ma trận theo vị trí; bản giao việc; hồ sơ năng lực |
| Đánh giá rủi ro RA/QA/2023/009 | Tần suất đào tạo | Tần suất đào tạo định kỳ là **dữ liệu cấu hình có kiểm soát**, không viết cứng |

### 1.2 Toàn vẹn dữ liệu (ALCOA+) thành kiểm soát cụ thể

| Thuộc tính | Kiểm soát trong thiết kế |
|---|---|
| **Attributable** (truy được người làm) | Mọi lệnh ghi lấy người từ phiên đăng nhập, **không nhận người từ máy khách**; chữ ký điện tử gắn người, thời điểm, ý nghĩa; ảnh chụp họ tên, mã nhân viên, bộ phận, vị trí tại thời điểm ký |
| **Legible** | Hồ sơ lưu dạng dữ liệu có cấu trúc và xuất PDF có mã kiểm; không lưu chỉ ở dạng ảnh |
| **Contemporaneous** (ghi đúng lúc) | Thời gian do **máy chủ** đặt (UTC, hiển thị giờ Việt Nam); ngày đào tạo thực tế do giảng viên khai nhưng **không được ở tương lai**, và mọi lần nhập muộn ghi cả ngày thực tế và ngày ghi |
| **Original** | Bản gốc ký tay (nếu có) được quét và lưu làm **bản gốc điện tử** có SHA-256, không sửa; hồ sơ cá nhân sinh từ dữ liệu, bản xuất là bản sao có mã kiểm |
| **Accurate** | Kiểm tra ở máy chủ: trạng thái hợp lệ, quyền, tính nhất quán (ví dụ không đạt thì phải có đào tạo lại); không tin dữ liệu tính toán từ máy khách |
| **Complete** | Danh sách tham gia gồm cả người vắng; không xóa bản ghi GMP, chỉ hủy hoặc thay thế kèm lý do |
| **Consistent** | Một nguồn sự thật cho mỗi dữ kiện (ngày hoàn thành đào tạo do Training ghi; Document Control chỉ đọc) |
| **Enduring** | Lưu ít nhất **10 năm sau khi nhân viên nghỉ việc** (SOP 5.3.10); sao lưu theo module Backup & Restore |
| **Available** | Truy xuất theo người, theo hoạt động, theo tài liệu; xuất có kiểm soát |

### 1.3 Bảo mật: nguyên tắc

1. **Mọi quyết định quyền ở máy chủ**, kiểm tra lại ở từng lệnh ghi và từng truy vấn đọc; cờ quyền ở giao diện chỉ là gợi ý.
2. **Phạm vi đối tượng:** quyền không chỉ là "có quyền A" mà là "có quyền A **trên đối tượng này**" (bản thân, bộ phận mình, mọi bộ phận). Người học chỉ thấy và làm việc của chính mình, **mã người học không nhận từ máy khách**.
3. **Ít đặc quyền, tách nhiệm vụ** (mục 8.3): người chuẩn bị, xem xét, phê duyệt khác nhau; giảng viên không tự chấm cho mình.
4. **Đóng khi lỗi:** thiếu quyền, thiếu dữ liệu, lỗi cổng đều **từ chối**, không cho qua.
5. **Không có đường ghi tắt:** trạng thái chỉ đổi qua các lệnh có tên (mục 7), không có `PUT` ghi đè trạng thái; DTO ghi chỉ có trường cho phép (không nhận trường lạ).
6. **Chữ ký điện tử** dùng cơ chế sẵn có (xác thực lại mật khẩu, mã dùng một lần, chống phát lại), mỗi lần ký gắn đối tượng và ý nghĩa.
7. **Dữ liệu cá nhân tối thiểu:** danh sách, xuất và báo cáo chỉ gồm trường cần; xem và xuất hồ sơ cá nhân đều vào Audit Trail; không ghi dữ liệu cá nhân vào nhật ký ứng dụng.
8. **Tệp:** quét virus (ClamAV có sẵn trong hạ tầng), kiểm loại và kích thước, ghi SHA-256, tải về kiểm quyền lại.
9. **Chống ghi chồng:** khóa lạc quan theo phiên bản và khóa dòng ở nơi cấp số; trả `409` với mã lỗi ổn định.
10. **Không có xóa vật lý** các bản ghi GMP; bảng quan trọng khóa bằng trigger như `audit_logs` (V245).

### 1.4 Thứ tự ưu tiên khi mâu thuẫn

1. An toàn dữ liệu và kiểm soát GMP, 2. Bảo mật, 3. Đúng nghiệp vụ SOP, 4. Dễ dùng, 5. Tốc độ phát triển.

---

## 2 Kiến trúc và ranh giới với Document Control

### 2.1 Thành phần

```
Frontend (React/TS)                       Backend (Spring Boot, một ứng dụng)
 features/training/*      ── HTTP ──►   controller/training/*   (REST, không logic)
 features/documents/* (sửa tab đào tạo)    service/training/*      (lệnh, quy tắc, máy trạng thái)
                                           repository/entity/training/*  (JDBC hoặc JPA như quy ước module)
                                           DocumentTrainingPort  ◄── do Document Control định nghĩa
                                           TrainingDocumentIntegrationService  (Training thực hiện cổng)
                                           job/training/*       (nhắc việc, outbox, nhãn quá hạn)
 Dùng chung: AuditTrailService, ElectronicSignatureService / SecurityChangeSignatureService,
             EffectivePermissionService + ResourceCapabilityService, NotificationService, FileStorageService (MinIO), ClamAV,
             Calendar, realtime (EntityChanged), cờ tính năng (SystemConfigurationService.isFeatureEnabled)
```

- **Một ứng dụng, hai miền.** Training không gọi lớp của Document Control trực tiếp ngoài cổng; Document Control **không import** lớp của Training. Cổng là interface Java đặt ở gói của Document Control, Training thực hiện nó (mục 6).
- **Giao dịch:** các thao tác đồng bộ của cổng (cấp mã, cập nhật, trả mã) chạy **trong cùng giao dịch** với việc lưu tài liệu; lỗi ở bên nào cũng lui cả hai.
- **Bất đồng bộ:** thông báo, mở hoạt động sau khi duyệt, ghi ngày hoàn thành ngược về revision đi qua **bảng outbox của Training** + worker; xử lý lặp lại an toàn (idempotent) và đọc lại trạng thái trước khi tác động.
- **Thời gian thực:** dùng cơ chế `EntityChanged` sẵn có để làm tươi màn hình khi hoạt động đổi (như màn Revision).
- **Cờ tính năng:** `feat-training-integration` điều khiển chế độ phối hợp (mục 6.5); `feat-training` điều khiển menu, như các module khác (`NavigationService`).

### 2.2 Cấu trúc mã backend (ĐỀ XUẤT)

```
controller/training/   TrainingActivityController, TrainingMatrixController, TrainingRequirementController,
                       TrainingRecordController, TrainingJobAssignmentController, TrainingSignatureController,
                       TrainingComplianceController, TrainingAdministrationController, TrainingMyController
service/training/      TrainingNumberService, TrainingActivityService (+ Workflow), TrainingSessionService,
                       TrainingParticipantService, TrainingAssessmentService, TrainingRecordService,
                       TrainingMatrixService, TrainingRequirementService, TrainingJobAssignmentService,
                       TrainingSpecimenSignatureService, TrainingComplianceQueryService, TrainingSettingsService,
                       TrainingDocumentIntegrationService, TrainingAuthorizationService (mở rộng, giữ tên hiện có),
                       TrainingExportService, TrainingRetentionService
entity/training/, repository/training/, dto/training/
job/training/         TrainingOutboxWorker, TrainingReminderJob, TrainingOverdueJob, TrainingRetentionJob
```

Kiểu truy cập dữ liệu theo module Report: JDBC có tham số (mọi giá trị người dùng là tham số, sắp xếp theo danh sách cho phép) cho truy vấn danh sách và báo cáo; JPA hoặc JDBC cho lệnh ghi theo quy ước của lớp đó. **Không nối chuỗi từ dữ liệu người dùng vào SQL.**

### 2.3 Quy trình thực hiện một lệnh ghi (bắt buộc cho mọi lệnh)

1. Xác thực người dùng; đọc đối tượng **khóa dòng** (`FOR UPDATE`) hoặc kiểm tra phiên bản lạc quan.
2. Kiểm tra **quyền, phạm vi đối tượng, trạng thái hiện tại, tách nhiệm vụ**; nếu cần, kiểm tra chữ ký điện tử.
3. Kiểm tra bất biến nghiệp vụ (các quy tắc TR-xx liên quan) và dữ liệu đầu vào.
4. Ghi trạng thái, ghi **sự kiện nghiệp vụ** (`training_events`), ghi **Audit Trail**, ghi **outbox** nếu cần, trong **cùng một giao dịch**.
5. Trả về trạng thái mới do máy chủ tính, mã lý do ổn định, và các khả năng (capabilities) hiện hành.
6. Worker đọc lại trạng thái và phiên bản trước khi gửi thông báo, ghi ngược sang Document Control hoặc xuất tệp.

---

## 3 Mô hình nghiệp vụ và máy trạng thái

### 3.1 Đối tượng

| Đối tượng | Mô tả | Vòng đời |
|---|---|---|
| **Training Matrix** (ma trận) | Theo bộ phận; phiên bản; dòng (chủ đề hoặc SOP) × vị trí | Có phiên bản; Effective một bản tại một thời điểm |
| **Training Requirement** (yêu cầu đào tạo) | Phiếu APD.0118 theo năm hoặc theo đợt rà soát | Draft đến Approved, ba chữ ký |
| **Training Activity** (hoạt động) | Có **Training Number**; gồm Session, Participant; có thể gắn một revision tài liệu | Mục 3.2 |
| **Session** | Buổi đào tạo: hình thức, giảng viên, ngày, chủ đề | Planned, Held, Postponed, Cancelled |
| **Participant** | Người tham gia một session (hoặc người ngoài) | Mục 3.3 |
| **Assessment** | Một lần đánh giá của một người ở một session (nhiều lần = nhiều dòng) | Chỉ thêm |
| **Training Record** (hồ sơ) | Dòng hồ sơ cá nhân **bất biến** | Chỉ thêm; vô hiệu bằng bản ghi riêng |
| **Job Assignment** (bản giao việc) | Theo người và vị trí; hai chữ ký | Mục 3.4 |
| **Specimen Signature** (chữ ký mẫu) | Theo người; phiên bản | Pending, Approved, Superseded |
| **Legacy Evidence** | Bằng chứng đào tạo của tài liệu nhập từ dữ liệu cũ | Chỉ đọc sau khi xác nhận |

### 3.2 Máy trạng thái Training Activity

| Trạng thái | Nghĩa | Vào bằng | Ai và điều kiện |
|---|---|---|---|
| `RESERVED` | Đã cấp mã cho revision tài liệu, chờ revision được duyệt | Cổng `reserveTrainingNumber` | Người lưu tài liệu (qua Document Control); Training không cho thao tác người dùng ở trạng thái này, trừ đánh giá tác động |
| `PLANNED` | Đã có hạn; đang chuẩn bị (danh sách, nội dung, giảng viên) | Tạo trực tiếp (hoạt động không gắn tài liệu); hoặc `onRevisionApproved` | Người có quyền tổ chức (mục 8) |
| `NOTIFIED` | Danh sách đã xác nhận trước đào tạo, nội dung đã được xem xét và duyệt, đã thông báo | Lệnh `notify` | Người chuẩn bị danh sách **ký** (APD.0117 mục 4); nội dung **được hai bước xử lý: đơn vị liên quan xem xét, người có quyền `training.content.approve` duyệt** (SOP 5.3.5 và lưu đồ; D-32); giảng viên đủ điều kiện (TR-19) |
| `IN_PROGRESS` | Có ít nhất một session đã tổ chức | Lệnh `holdSession` | Giảng viên hoặc người tổ chức |
| `PENDING_QA_CONFIRMATION` | Mọi session đã tổ chức; mọi người tham gia có trạng thái cuối (tham dự, vắng) và kết quả; chờ QA | Lệnh `submitForConfirmation` | Người tổ chức; kiểm tra: không còn người ở `INVITED`; người tham dự đều có kết quả (hoặc xác nhận tự đọc) |
| `COMPLETED` | QA xác nhận hoàn thành (APD.0117 mục 6) | Lệnh `confirmCompletion` | **DCO-QA** (quyền riêng), **chữ ký điện tử**, khác người chuẩn bị danh sách; tạo hồ sơ cá nhân |
| `CANCELLED` | Hủy kèm lý do | Lệnh `cancel` | Trước `COMPLETED`; hoạt động có người đã đạt không hủy được (chỉ vô hiệu hồ sơ bằng đường riêng); mã không dùng lại |

Chuyển trạng thái khác ngoài bảng **bị từ chối** (`TRAINING_ACTIVITY_INVALID_TRANSITION`). Đào tạo lại và đào tạo bổ sung cho người vắng là **hoạt động mới** (mục 5.3), không phải đổi trạng thái của hoạt động cũ.

### 3.3 Trạng thái người tham gia (Participant)

`INVITED` → `ATTENDED` | `ONLINE` | `ABSENT`; với `ATTENDED` hoặc `ONLINE`: kết quả `PENDING` → `PASSED` | `FAILED`.
- `ABSENT` phải có lý do; tạo **danh sách bổ sung** theo yêu cầu (hoạt động con, mục 5.3).
- `FAILED` bắt buộc dẫn tới hoạt động `RETRAINING` (TR-14, TR-15); trong lúc chưa đạt, cờ **"công việc liên quan tạm ngừng"** hiện cho trưởng đơn vị (D-12: chỉ cờ, không chặn).
- Tự đọc: `INVITED` → `READ_CONFIRMED` (người học ký) → trưởng phòng xác nhận (TR-16).
- Không có đường nào để một người tự đổi trạng thái hoặc kết quả của chính mình.

### 3.4 Máy trạng thái còn lại

| Đối tượng | Trạng thái | Chữ ký (ý nghĩa) | Người thực hiện (SOP mục 3) |
|---|---|---|---|
| Matrix version | `DRAFT` → `PENDING_APPROVAL` → `EFFECTIVE` → `OBSOLETE`; từ chối quay `DRAFT` | gửi duyệt (Matrix Prepared), duyệt (Matrix Approved) | **Một bước duyệt** do **người được chỉ định có quyền `training.matrix.approve` trên bộ phận đó** thực hiện (mục 8.5), **khác người lập**; không gắn tên vai trò hay số cấp cố định (D-05, chủ dự án 2026-10-16); áp dụng cả cho ma trận QA |
| Requirement | `DRAFT` → `PENDING_REVIEW` → `PENDING_APPROVAL` → `APPROVED`; từ chối quay `DRAFT` | lập, xem xét, duyệt (Prepared, Reviewed, Approved) | Điều phối đào tạo QA; Trưởng phòng QA; QM |
| Job assignment | `DRAFT` → `PENDING_ASSIGNOR` → `PENDING_RECEIVER` → `EFFECTIVE` → `SUPERSEDED` | người giao, người nhận (Job Assigned, Job Accepted) | Trưởng đơn vị (hoặc chức danh khác, APD.0024); nhân viên |
| Specimen signature | `PENDING` → `APPROVED` → `SUPERSEDED` | trưởng đơn vị xác nhận (Specimen Signature Approved) | Trưởng đơn vị; **chỉ một bản APPROVED** mỗi người |

---

## 4 Cơ sở dữ liệu

Quy ước chung: khóa chính UUID; thời gian `TIMESTAMPTZ` UTC; cột người `..._user_id` tham chiếu `app_users(id)` với `ON DELETE RESTRICT`; cột `version INTEGER NOT NULL DEFAULT 1` cho đối tượng sửa được; `created_at`, `created_by`; ràng buộc `CHECK` cho trạng thái và giá trị liệt kê; **ảnh chụp** (snapshot) họ tên, mã nhân viên, bộ phận, vị trí tại thời điểm ghi cho mọi bản ghi bằng chứng; **không dùng `ON DELETE CASCADE` trên bảng GMP**. Migration tiếp theo số hiện tại (V593): từ **V594**, chỉ tiến tới, idempotent (`IF NOT EXISTS`). Tên bảng dùng tiền tố `training_`.

**Sửa lại dữ kiện của PLAN-TR-001:** bảng `positions` (V3) **có tồn tại** (`id`, `business_unit_id`, `department_id`, `code`, `name`, `is_active`) và `departments` có cột `code` duy nhất (≤ 40 ký tự) dùng được làm "DC" trong mã đào tạo. Điều còn thiếu là **liên kết người dùng đến vị trí**: `app_users.position` chỉ là chữ (KIỂM TRA MÃ, V3 và seed), nên cần bảng ánh xạ (4.2).

### 4.1 Bảng cấu hình

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `training_settings` (một dòng, `id=1`) | `pass_percent` (mặc định 70, 1-100), `document_training_days_default` (10), `results_due_working_days` (7), `annual_requirement_due_month` (12), `annual_requirement_due_day` (31), `absence_retrain_months` (6), `retention_years_after_leaving` (10, tối thiểu 10), `integration_enabled`, `version`, `updated_by`, `updated_at` | Mỗi lần lưu: phiên bản đã đọc, lý do, Audit Trail ghi giá trị trước và sau (như `report_properties`). Giá trị thấp hơn mức SOP (ví dụ lưu dưới 10 năm) bị từ chối |
| `training_non_working_days` | `day DATE PK`, `reason`, `created_by` | Ngày nghỉ để tính "ngày làm việc" (TR-13). Quyết định D-14: bảng riêng, chưa dùng Calendar |
| `training_topics` | `id`, `code` (duy nhất), `name`, `scope` (`FACTORY_GENERAL`, `DEPARTMENT_GENERAL`, `OTHER`), `department_id` (null nếu toàn nhà máy), `active`, `version` | Chủ đề đào tạo chuẩn không phải SOP. Chủ đề SOP **không** lưu ở đây: tham chiếu thẳng tài liệu |
| `training_person_positions` | `id`, `person_user_id`, `position_id` → `positions`, `department_id`, `valid_from`, `valid_to` (null = đang giữ), `source` (`MIGRATION`, `JOB_ASSIGNMENT`, `ADMIN`), `created_by` | Lịch sử vị trí của từng người; **một vị trí chính đang hiệu lực** tại một thời điểm (ràng buộc loại trừ khoảng ngày). Nạp ban đầu: khớp `app_users.position` với `positions.name`, **báo cáo các dòng không khớp** để người phụ trách sửa tay, không tự đoán |

### 4.2 Ma trận đào tạo

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `training_matrices` | `id`, `department_id` (duy nhất), `code` (ví dụ `TM-QA`), `current_version_id` | Một ma trận cho mỗi bộ phận |
| `training_matrix_versions` | `id`, `matrix_id`, `version_no`, `status`, `change_reason`, `prepared_by`, `submitted_at`, `approved_by`, `approved_at`, `effective_at`, `prepare_signature_id`, `approve_signature_id`, `content_sha256`, `version` | Duy nhất `(matrix_id, version_no)`; chỉ mục duy nhất một `EFFECTIVE` mỗi ma trận; phiên bản `EFFECTIVE` và `OBSOLETE` **bất biến** (trigger) |
| `training_matrix_rows` | `id`, `version_id`, `row_no`, `row_group` (`FACTORY_GENERAL`, `DEPARTMENT_GENERAL`, `SOP`), `topic_id` XOR `document_id`, `annual_required`, `note` | `CHECK` đúng một trong `topic_id`, `document_id`; `document_id` trỏ tài liệu (áp dụng revision hiệu lực hiện hành) |
| `training_matrix_cells` | `row_id`, `position_id`, `required` | Khóa chính `(row_id, position_id)`; chỉ lưu ô có yêu cầu |

### 4.3 Yêu cầu đào tạo

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `training_requirements` | `id`, `request_no` (duy nhất, theo năm), `year`, `kind` (`ANNUAL`, `SOP_PERIODIC`), `status`, `due_by` (31/12 hoặc cuối tháng rà soát), `prepared_by`, `reviewed_by`, `approved_by`, `*_signature_id`, `*_at`, `version` | Bản `APPROVED` bất biến; thay đổi là phiếu mới tham chiếu phiếu cũ |
| `training_requirement_lines` | `id`, `requirement_id`, `line_no`, `planned_month` (ngày đầu tháng), `topic_id` XOR `document_id`, `activity_id` (null khi chưa tổ chức), `line_status` (`PLANNED`, `DONE`, `POSTPONED`, `OVERDUE`), `postponed_from`, `postpone_reason`, `qa_comment`, `qa_signed_by`, `qa_signed_at` | Cột "Mã đào tạo, Ngày đào tạo, Sign by QA, Comment" của APD.0118 do QA ghi sau khi đào tạo xong (SOP chú thích dấu `*`) |

### 4.4 Hoạt động và buổi đào tạo

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `training_number_sequences` | `department_id`, `year`, `last_serial`, khóa chính `(department_id, year)` | Bộ đếm; cấp bằng một câu lệnh nguyên tử (mục 5) |
| `training_activities` | `id`, `training_number` (duy nhất), `base_number`, `suffix` (null hoặc `a`, `b`…), `parent_activity_id`, `organizer_department_id`, `year`, `serial`, `kind` (`INITIAL`, `PERIODIC`, `UNPLANNED`, `RETRAINING`, `EXTERNAL`), `kind_reason` (`NEW_HIRE`, `TRANSFER`, `NEW_SOP`, `SOP_VERSION`, `CAPA`, `AUDIT_FINDING`, `VISITOR`, `ABSENCE_RETURN`, `OTHER`, null), `matrix_row_id` (null; dòng chủ đề của ma trận nếu có), `external_type` (`ACTIVE`, `PASSIVE`), `status`, `revision_id` (null nếu không gắn tài liệu), `document_id`, `document_number`, `revision_number`, `document_checksum` (ảnh chụp), `requirement_line_id`, `due_date`, `planned_on`, `remarks`, `cancel_reason`, `impact_assessed_by`, `impact_assessed_at`, `confirmed_by`, `confirmed_at`, `confirm_signature_id`, `version`, `created_by`, `created_at` | Chỉ mục duy nhất `(revision_id)` **với** `status <> 'CANCELLED'` **và** `parent_activity_id IS NULL` (một hoạt động gốc còn hiệu lực cho mỗi revision); `CHECK` trạng thái; ràng buộc `suffix` ⇒ `parent_activity_id` |
| `training_activity_audiences` | `activity_id`, `position_id` hoặc `department_id` hoặc `person_user_id` (đúng một), `source` (`MATRIX`, `MANUAL`) | Đối tượng dự kiến (từ ma trận hoặc chọn tay); từ đây sinh `training_participants` khi bắt đầu chuẩn bị danh sách |
| `training_sessions` | `id`, `activity_id`, `session_no`, `method` (`SELF_READING`, `CLASSROOM`, `HYBRID`, `PRACTICAL`), `assessment_method` (`TEST`, `CHECKLIST`, `SELF_READING_CONFIRMATION`), `trainer_user_id` hoặc `external_trainer_name`, `scheduled_on`, `held_on`, `venue`, `status`, `postpone_reason`, `version` | Duy nhất `(activity_id, session_no)`; `held_on` **không được ở tương lai** |
| `training_session_topics` | `id`, `session_id`, `topic_id` XOR `document_id`, `document_revision_id`, ảnh chụp mã, tên, phiên bản tài liệu, `material_id` | Tài liệu nguồn **chỉ ở trạng thái hiệu lực** (TR-21), kiểm tra ở máy chủ |
| `training_materials` | `id`, `activity_id`, `title`, `object_key`, `sha256`, `size_bytes`, `mime_type`, `scan_status`, `status` (`DRAFT`, `REVIEWED`, `APPROVED`), `reviewed_by`, `reviewed_signature_id`, `approved_by`, `approved_signature_id` | Nội dung và bài kiểm tra do **Trưởng đơn vị liên quan và Trưởng phòng QA** xem xét, duyệt (TR-22); bản đã duyệt bất biến |
| `training_participants` | `id`, `activity_id`, `session_id`, `person_user_id` (null cho người ngoài), `external_name`, `external_org`, ảnh chụp `employee_code`, `full_name`, `department`, `position`, `state`, `result`, `absence_reason`, `sign_mode` (`ESIGN`, `PAPER_SCAN`, `ONLINE`, `NONE`), `attend_signature_id`, `paper_evidence_id`, `notified_at`, `version` | Duy nhất `(session_id, person_user_id)`; người vắng dài hạn vẫn được liệt kê (TR-11) |
| `training_assessments` | `id`, `participant_id`, `attempt_no`, `method`, `score_obtained`, `score_max`, `percent`, `pass_percent_snapshot`, `result`, `assessed_by`, `assessed_at`, `paper_evidence_id`, `trainee_signature_mode`, `trainee_signature_id`, `remarks` | **Chỉ thêm** (trigger); duy nhất `(participant_id, attempt_no)`; `result` do máy chủ **tính** từ điểm và ngưỡng, không nhận từ máy khách |
| `training_activity_confirmations` | `id`, `activity_id`, `session_id`, `kind` (`ATTENDEE_LIST_PREPARED`, `TRAINER_ATTENDANCE`, `HEAD_SELF_READING`, `CONTENT_REVIEWED`, `CONTENT_APPROVED`, `QA_COMPLETION`), `confirmed_by`, `confirmed_at`, `signature_id`, `remark` | Các xác nhận trên APD.0117 mục 4 đến 6 và APD.0108; **chỉ thêm** |
| `training_paper_evidence` | `id`, `object_key`, `sha256`, `size_bytes`, `mime_type`, `scan_status`, `uploaded_by`, `uploaded_at`, `received_by`, `received_at` | Bản scan của bài kiểm tra, danh sách đã ký tay (D-20); người nhận xác nhận đã đối chiếu bản giấy |
| `training_events` | `id`, `activity_id` (hoặc đối tượng khác), `object_type`, `object_id`, `event_type`, `payload` JSONB, `actor_user_id`, `occurred_at` | **Chỉ thêm**; gồm dời lịch, lý do, hủy, cấp mã. Là **nguồn của Sổ cấp mã** cùng `training_activities` |

**Sổ cấp mã (FRM.0044)** là **view** `training_number_log_v` (ngày, mã, mã SOP, chủ đề, số buổi, ghi chú) trên `training_activities`, `training_sessions` và `training_events`, theo bộ phận; **không có bảng nhập tay**.

### 4.5 Hồ sơ và bản giao việc

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `training_records` | `id`, `record_no`, `person_user_id`, `activity_id`, `session_id`, `participant_id`, `assessment_id`, `training_number`, `topic_text`, `document_number`, `document_revision`, `completed_on`, `method`, `result`, `source` (`ACTIVITY`, `LEGACY_IMPORT`), ảnh chụp người, `content_sha256`, `created_at` | **Bất biến** (trigger chặn `UPDATE`, `DELETE`, `TRUNCATE`); tạo **chỉ bởi máy chủ** khi `COMPLETED` và người tham dự đạt hoặc tự đọc được xác nhận; **không có API nhập tay** |
| `training_record_voids` | `id`, `record_id` (duy nhất), `reason`, `voided_by`, `voided_at`, `signature_id`, `replaced_by_record_id` | Cách **sửa** duy nhất: vô hiệu một dòng và (nếu cần) thêm dòng đúng, có lý do và chữ ký; dòng gốc **không bao giờ bị sửa** |
| `training_record_exports` | `id`, `person_user_id`, `generated_by`, `generated_at`, `reason`, `object_key`, `sha256`, `prepared_signature_id`, `approved_signature_id` | Mỗi lần xuất APD.0014 là một bản bất biến |
| `training_job_assignments` | `id`, `person_user_id`, `issue_no`, `case_type` (`INITIAL`, `CHANGE`), `department_id`, `position_id`, `direct_superior_title`, `subordinate_titles`, `substitute_title`, `previous_department_id`, `previous_position_id`, `change_reason`, `jurisdiction`, `matrix_version_id`, `matrix_completion_snapshot` JSONB, `exception_reason`, `exception_approved_by`, `status`, `assignor_user_id`, `assignor_title`, `assignor_signature_id`, `receiver_signature_id`, `version` | `issue_no` tăng theo người; `EFFECTIVE` bất biến; điều kiện lập: ma trận đã hoàn thành (TR-23) hoặc ngoại lệ có phê duyệt (D-15) |
| `training_job_assignment_duties` | `assignment_id`, `sort_order`, `responsibility`, `description` | Mục 4 của APD.0024 |
| `training_specimen_signatures` | `id`, `person_user_id`, `version_no`, `effective_date`, `object_key`, `sha256`, `status`, `confirmed_by`, `confirmed_signature_id`, `change_reason` | Chỉ mục duy nhất một `APPROVED` mỗi người; ảnh chữ ký mẫu **không** hiển thị trong danh sách, chỉ mở theo quyền và ghi Audit Trail |
| `training_person_retention` | `person_user_id` (khóa), `left_company_on`, `retain_until` | `retain_until = left_company_on + retention_years`; chặn mọi thao tác hủy trong hạn (mục 9.5) |
| `training_legacy_evidence` | `id`, `revision_id`, ảnh chụp tài liệu, `completion_date`, `imported_by`, `imported_at`, `verified_by`, `verified_at`, `attachment_evidence_id`, `not_evidenced` | D-27; chỉ đọc sau khi QA xác nhận |

### 4.6 Vận hành

| Bảng | Vai trò |
|---|---|
| `training_outbox` | `id`, `event_type`, `aggregate_id`, `payload` JSONB, `status` (`PENDING`, `PROCESSING`, `DONE`, `FAILED`), `attempts`, `next_attempt_at`, `locked_by`, `locked_until`, `created_at`; worker nhận bằng `FOR UPDATE SKIP LOCKED`; thất bại quá số lần thì `FAILED` và hiện ở màn quản trị, không âm thầm bỏ |
| `training_approval_assignments` | **Chỉ định người xử lý** cho từng bước xem xét, duyệt, xác nhận (mục 8.5): `id`, `object_type`, `object_id`, `step_code`, `assignee_user_id`, `assigned_by`, `assigned_at`, `status` (`PENDING`, `DONE`, `REASSIGNED`, `CANCELLED`), `completed_at`, `signature_id`, `reason`; chỉ mục duy nhất một dòng `PENDING` cho mỗi `(object_type, object_id, step_code, assignee)`; **chỉ thêm và đổi trạng thái qua lệnh**, mọi đổi người ghi dòng mới và Audit Trail |
| `training_default_approvers` | Người **mặc định** của một bước, để điền sẵn khi gửi: `step_code`, `department_id` (null = mọi bộ phận), `user_id`, `valid_from`, `valid_to`, `created_by`; chỉ gợi ý, người gửi đổi được trong số người đủ điều kiện |
| `training_notification_log` | Mỗi thông báo: loại, người nhận, đối tượng, kênh, trạng thái, mã lý do; chống gửi trùng |

### 4.7 Thay đổi bên Document Control (KIỂM TRA MÃ để so)

Bảng `document_revisions` đã có: `requires_training`, `training_period_days`, `reason_for_skipping_training`, `training_planned_date`, `training_period_end_date`, `training_completion_date`. Thêm:

| Cột | Ý nghĩa |
|---|---|
| `training_activity_id` UUID null | Khóa tới hoạt động gốc của revision; ràng buộc khóa ngoại thêm sau khi bảng của Training có |
| `training_number` VARCHAR(40) null | Chuỗi hiển thị (ảnh chụp); không dùng để truy vấn quan hệ |
| `training_mode` VARCHAR(12) null | `INTEGRATED` hoặc `MANUAL`; ghi một lần ở lần lưu đầu có Requires Training, **không đổi sau đó** (D-28) |
| `training_origin` VARCHAR(20) NOT NULL DEFAULT `NATIVE` | `NATIVE` hoặc `LEGACY_IMPORT` |
| `CHECK` | `INTEGRATED` ⇒ có `training_activity_id` hoặc đang chờ cấp trong cùng giao dịch; `MANUAL` ⇒ không có `training_activity_id`; `LEGACY_IMPORT` ⇒ không có mã |

Sửa vùng này cần **phân tích ảnh hưởng** (GitNexus) cho `DocumentRevisionRecord`, `DocumentService`, `RevisionService.completeTraining`, DTO `RevisionDetailResponse`, `DocumentDraftCreateRequest`, `LegacyBatchRevisionSectionRequest` trước khi sửa.

### 4.8 Chỉ mục và hiệu năng

`training_activities (organizer_department_id, year, serial)`, `(status, due_date)`, `(revision_id)` duy nhất có điều kiện; `training_participants (person_user_id, state, result)`, `(session_id)`; `training_records (person_user_id, completed_on DESC)`, `(document_number, document_revision)`; `training_matrix_cells (position_id)`; `training_outbox (status, next_attempt_at)`; chỉ mục cho các khóa sắp xếp cho phép. Tìm kiếm văn bản: `ILIKE` có thoát ký tự đặc biệt (như báo cáo), giới hạn độ dài.

### 4.9 Khóa bất biến (trigger)

Theo mẫu V245: hàm `training_prevent_mutation()` và trigger `BEFORE UPDATE OR DELETE` (từng dòng) và `TRUNCATE` (từng câu lệnh) cho: `training_records`, `training_record_voids`, `training_record_exports`, `training_assessments`, `training_activity_confirmations`, `training_events`, và cho các bảng phiên bản đã **chốt** (`training_matrix_versions` ở `EFFECTIVE` hoặc `OBSOLETE` và các dòng con; `training_requirements` ở `APPROVED`; `training_job_assignments` ở `EFFECTIVE`) bằng trigger có điều kiện trên trạng thái. Không có ngoại lệ "purge" cho Training (khác `audit_logs`), vì không có lý do xóa vật lý ở đây. Kiểm thử: mọi thử `UPDATE`, `DELETE`, `TRUNCATE` bằng tài khoản ứng dụng đều bị chặn.

### 4.10 Quyền, ý nghĩa chữ ký, mẫu thông báo (dữ liệu nạp)

- **Quyền** (mục 8.1): thêm vào `permissions` bằng migration, **không gán cho ai** (gán trong Permission Set).
- **Ý nghĩa chữ ký** (`electronic_signature_meanings`): thêm các mã ở mục 8.4; `TRAINING_CONFIRMED` đã có (V138) và giữ nguyên cho Complete Training của Document Control.
- **Mẫu thông báo**: mục 11.

---

## 5 Cấp Training Number

### 5.1 Định dạng (SOP 5.1.4, TR-01)

`TRN/<DC>/<YY>-<XXX>`: `DC` = `departments.code` của **bộ phận tổ chức** (chỉ ký tự `A-Z`, `0-9`, kiểm tra khi cấp, nếu không hợp lệ thì từ chối `TRAINING_DEPARTMENT_CODE_INVALID` và báo người quản trị sửa mã); `YY` = hai chữ số cuối của **năm theo giờ Việt Nam**; `XXX` = số thứ tự tăng dần của `(bộ phận, năm)`, đệm đến 3 chữ số (vượt 999 thì dài hơn, không cắt). Hậu tố đào tạo bổ sung: `TRN/QA/26-014a`, `…b`. Mã **duy nhất toàn hệ thống** (`UNIQUE`).

### 5.2 Thuật toán cấp mã gốc

Trong giao dịch của lệnh tạo hoạt động (hoặc cổng `reserveTrainingNumber`):

```sql
INSERT INTO training_number_sequences(department_id, year, last_serial)
VALUES (:dept, :year, 1)
ON CONFLICT (department_id, year) DO UPDATE SET last_serial = training_number_sequences.last_serial + 1
RETURNING last_serial;
```

Câu lệnh nguyên tử (khóa dòng bộ đếm); hai giao dịch đồng thời cho cùng `(bộ phận, năm)` được số khác nhau; **số bị hủy không bao giờ trả lại** (giao dịch lui thì bộ đếm cũng lui cùng giao dịch, nên không tạo khoảng trống do lỗi; khoảng trống chỉ xuất hiện từ mã **đã cấp rồi hủy**, mà sổ mã ghi rõ). Chuỗi mã được **dựng ở máy chủ**, máy khách không bao giờ gửi mã.

### 5.3 Đào tạo bổ sung và đào tạo lại (TR-02)

- Hoạt động con có `parent_activity_id` và `base_number` bằng mã gốc; `suffix` là chữ cái tiếp theo chưa dùng (`a`…`z`, rồi `aa`…) **tính trong giao dịch có khóa hoạt động gốc** (`FOR UPDATE`), nên hai người bổ sung cùng lúc không trùng hậu tố.
- Mỗi đợt là **một dòng riêng** trong sổ mã (đã thỏa vì mỗi đợt là một hoạt động).
- Hoạt động đào tạo lại do không đạt (`RETRAINING`) dùng cùng quy tắc hậu tố, tham chiếu hoạt động gốc.
- Chỉ người tham gia thuộc tập "vắng hoặc không đạt" của hoạt động cha mới được thêm vào hoạt động con.

### 5.4 Dời lịch và hủy (TR-04)

- Dời lịch: **giữ mã**; ghi `training_events` loại `POSTPONED` với lý do bắt buộc; hiện ở cột Ghi chú của sổ mã. Chủ đề trong yêu cầu đào tạo dời sang **tháng ngay sau** (TR-09), ghi `postponed_from`.
- Hủy: trạng thái `CANCELLED`, lý do bắt buộc; **mã không dùng lại**; dòng vẫn ở sổ mã.
- Với hoạt động gắn revision: hủy do bỏ tick xảy ra **khi người dùng lưu** (D-24), qua cổng `releaseTrainingNumber`.

---

## 6 Phối hợp Document Control (hợp đồng chi tiết)

Đã chốt: mã cấp **cho revision**; chỉ có mã sau lần lưu thành công; bỏ tick có xác nhận rồi hủy khi lưu; Upgrade mang Requires Training; không nhóm lý do; chữ ký như hiện nay; ngày hiệu lực theo Document Properties; nhập cũ không cấp mã; lỗi thì lui; hai chế độ `INTEGRATED`, `MANUAL`; ngày hoàn thành là ngày DCO-QA xác nhận hoạt động gốc.

### 6.1 Cổng (interface Java do Document Control định nghĩa)

```java
public interface DocumentTrainingPort {
    /** Cấp (hoặc trả lại) mã cho revision. Idempotent theo revision. Ném lỗi nếu bị tắt hoặc phòng ban không có mã hợp lệ. */
    TrainingReservation reserve(RevisionRef revision, UserRef actor, int trainingPeriodDays);
    /** Đổi hạn; chỉ khi hoạt động chưa COMPLETED. */
    void updatePeriod(RevisionRef revision, UserRef actor, int trainingPeriodDays);
    /** Hủy mã (khi bỏ tick đã xác nhận hoặc revision bị hủy). Lý do bắt buộc. */
    void release(RevisionRef revision, UserRef actor, String reason);
    /** Chỉ đọc: mã, trạng thái, tiến độ, ngày. Kiểm quyền xem revision trước khi trả. */
    Optional<TrainingStatus> status(RevisionRef revision, UserRef viewer);
    /** Đã bắt đầu giai đoạn đào tạo (revision sang PENDING_TRAINING): mở hoạt động, tính hạn = ngày duyệt + số ngày. */
    void onApproved(RevisionRef revision, LocalDate approvedOn, UserRef actor);
    /** Revision quay về Draft hoặc bị từ chối. */
    void onReturnedToDraft(RevisionRef revision, UserRef actor, String reason);
}
public interface TrainingCompletionSink {   // do Document Control thực hiện, Training gọi
    /** Training ghi ba ngày vào revision khi hoạt động COMPLETED. Idempotent theo (revision, activity). */
    void recordCompletion(UUID revisionId, UUID activityId, LocalDate plannedOn, LocalDate periodEndOn, LocalDate completedOn);
}
```

`RevisionRef` chỉ mang khóa và dữ kiện cần (id, số revision, mã và tên tài liệu, bộ phận, checksum file); không truyền thực thể. Cổng nằm trong gói của Document Control; Training thực hiện nó trong `TrainingDocumentIntegrationService`. Mọi thao tác kiểm tra: **quyền người gọi** (đã có quyền sửa tài liệu), **chế độ** của revision, **trạng thái** của hoạt động.

### 6.2 Điểm gọi (nơi sửa ở Document Control)

| Sự kiện | Nơi (KIỂM TRA MÃ) | Gọi | Đồng bộ |
|---|---|---|---|
| Lưu tài liệu, Requires Training = Có, chưa có mã | `DocumentService` (tạo bản nháp, cập nhật; nhánh `trainingChanged`) | `reserve` | Có, cùng giao dịch |
| Đổi Training Period | `DocumentService` | `updatePeriod` | Có |
| Lưu sau khi bỏ tick (đã xác nhận ở giao diện) | `DocumentService` | `release(reason = "Requires Training removed")` | Có |
| Upgrade revision | `RevisionService` (tạo revision mới) | `reserve` khi lưu lần đầu revision mới (mang giá trị Requires Training) | Có |
| Duyệt xong, sang `PENDING_TRAINING` | `RevisionService` (nhánh `PENDING_TRAINING`) | `onApproved` (phát outbox) | Không: outbox |
| Trả về Draft, từ chối, hủy | `RevisionService` | `onReturnedToDraft` hoặc `release` | Có |
| Complete Training | `RevisionService.completeTraining` | `status` (kiểm hoạt động `COMPLETED`); **không nhập tay** ở chế độ `INTEGRATED` | Có |
| Hoạt động `COMPLETED` | `TrainingActivityService.confirmCompletion` | `TrainingCompletionSink.recordCompletion` qua outbox | Không |

### 6.3 Quy tắc

1. **Chế độ.** `training_mode` ghi **một lần** ở lần lưu đầu có Requires Training: `INTEGRATED` nếu `feat-training-integration` bật, ngược lại `MANUAL`. Đổi cờ **không** đổi revision đang mở.
2. **Không bao giờ có cả hai:** revision `INTEGRATED` không nhập tay ngày; `MANUAL` không có mã. Hai nơi kiểm tra: máy chủ và `CHECK` ở DB.
3. **Lỗi thì lui:** nếu cổng ném lỗi, việc lưu tài liệu lui; người dùng thấy mã lỗi ổn định và lưu lại được. **Không** tự chuyển sang `MANUAL`.
4. **Idempotent:** `reserve` gọi lại cho cùng revision trả cùng mã; ràng buộc duy nhất ở DB chặn tạo hai hoạt động gốc còn hiệu lực cho một revision.
5. **Tài liệu mẫu** (template) không có đào tạo; **không có tab, không gọi cổng**.
6. **Nhập tài liệu cũ** (`LegacyImportView`): không gọi `reserve`; revision ghi `training_origin = LEGACY_IMPORT`, giữ ngày hoàn thành đã nhập; sinh dòng `training_legacy_evidence` (D-27). Thiếu ngày mà yêu cầu đào tạo ⇒ `not_evidenced = true`.
7. **Chữ ký:** `completeTraining` vẫn yêu cầu quyền (`documents.training.complete` hoặc `manage`) và chữ ký `TRAINING_CONFIRMED`; ở chế độ `INTEGRATED` thêm điều kiện hoạt động `COMPLETED`; máy chủ từ chối `TRAINING_ACTIVITY_NOT_COMPLETED` nếu chưa.
8. **Hạn:** `training_period_end_date = approved_on + training_period_days`. Mặc định 10 ngày (TR-10) lấy từ `training_settings.document_training_days_default`, người dùng đổi được khi tạo.

### 6.4 Ngày hiệu lực (D-30, D-31)

- Cấu hình ở Document Properties (hai nhóm có và không Requires Training) **không đổi**; Training chỉ cung cấp `training_completion_date`.
- **`training_completion_date` = ngày DCO-QA ký xác nhận hoạt động gốc** (D-31, đã đồng ý). Người vắng không chặn phát hành; **màn tuân thủ nêu rõ** ai chưa đào tạo tài liệu nào; đợt bổ sung (hậu tố a, b, c) **không đổi** ngày của revision.
- Ngày ghi vào revision là chỉ đọc với người dùng Document Control (không có đường ghi từ giao diện); mọi lần ghi có Audit Trail ở hai bên với mã tương quan.

### 6.5 Chuyển giao và tắt (D-28)

- Bật lần đầu: revision đang `PENDING_TRAINING` ở `MANUAL` **giữ nguyên đến khi hoàn thành**, không chuyển ngang.
- Tắt có chủ đích: thiết lập có kiểm soát, **bắt buộc lý do**, Audit Trail; revision `INTEGRATED` vẫn hoàn thành qua Training (phần hoàn thành của Training luôn chạy); revision mới thành `MANUAL`.
- Có kiểm thử: bật, tắt, bật lại với revision ở mọi giai đoạn.

---

## 7 API

Quy ước (theo module Report đã làm): tiền tố `/training`; JSON; danh sách trả `{data, pagination:{page,limit,total,totalPages}}`; `limit ≤ 100`; `sortBy` theo danh sách cho phép (sai ⇒ `400 TRAINING_SORT_NOT_ALLOWED`); bộ lọc theo kiểu đã khai báo; **lệnh** là `POST /training/<đối tượng>/{id}/<lệnh>` với `{version, reason?, signatureToken?}`; sai phiên bản ⇒ `409 …_VERSION_CHANGED`; chuyển trạng thái sai ⇒ `409 …_INVALID_TRANSITION`; thiếu quyền ⇒ `403 TRAINING_SCOPE_DENIED` (không tiết lộ đối tượng có tồn tại hay không); lệnh tạo có `Idempotency-Key`. Mọi lệnh đi qua quy trình ở 2.3. Mọi truy vấn người học buộc `person = người đăng nhập`.

### 7.1 Danh sách điểm cuối

| Nhóm | Điểm cuối | Quyền (mục 8) | Ghi chú |
|---|---|---|---|
| **Tự phục vụ** | `GET /training/me/tasks` | `training.self.view` | Việc của tôi: sắp đến, tự đọc chờ xác nhận, bài chờ làm |
| | `GET /training/me/records` | `training.self.view` | Hồ sơ của tôi; không nhận mã người |
| | `POST /training/me/participations/{id}/confirm-read` | `training.self.view` | Tự đọc, cần chữ ký điện tử |
| **Ma trận** | `GET/POST /training/matrices`, `GET /training/matrices/{id}`, `GET /training/matrices/{id}/versions` | `training.matrix.view` / `.manage` | |
| | `GET /training/matrix-versions/{id}`, `PUT` (chỉ khi `DRAFT`) | `.manage` | Nội dung dòng và ô; kiểm tra vị trí thuộc bộ phận |
| | `POST …/{id}/submit` `/approve` `/reject` `/obsolete` | `.manage` / `.approve` | Chữ ký; người duyệt ≠ người lập |
| | `POST /training/matrices/{id}/upgrade` | `.manage` | Tạo phiên bản `DRAFT` từ bản `EFFECTIVE` |
| | `GET /training/matrix-versions/{a}/compare/{b}` | `.view` | Khác biệt do máy chủ tính |
| | `GET /training/matrices/{id}/coverage?position=` | `.view` | Danh sách chủ đề cho một vị trí |
| **Yêu cầu đào tạo** | `GET/POST /training/requirements`, `GET/PUT {id}` (Draft) | `training.requirement.view` / `.prepare` | |
| | `POST …/{id}/submit` `/review` `/approve` `/reject` | `.prepare` / `.review` / `.approve` | Ba chữ ký, ba người khác nhau |
| | `GET /training/requirements/suggestions?year=` | `.prepare` | Gợi ý tài liệu vừa rà soát (đọc từ Document Control) |
| | `POST …/lines/{id}/postpone` | `.prepare` | Dời sang tháng ngay sau, lý do |
| **Hoạt động** | `GET /training/activities` (lọc: mã, loại, trạng thái, bộ phận, năm, tài liệu, hạn) | `training.activity.view` | Phạm vi theo bộ phận |
| | `POST /training/activities` | `training.activity.organize` | Hoạt động không gắn tài liệu; mã do máy chủ cấp |
| | `GET /training/activities/{id}` | `.view` | Kèm khả năng (capabilities) |
| | `PUT /training/activities/{id}` (khi `PLANNED`) | `.organize` | Chủ đề, hạn, ghi chú |
| | `POST …/{id}/notify` | `.organize` | Kiểm tra điều kiện `NOTIFIED` (3.2) |
| | `POST …/{id}/submit-for-confirmation` | `.organize` | |
| | `POST …/{id}/confirm-completion` | `training.activity.close` | DCO-QA, chữ ký |
| | `POST …/{id}/cancel`, `/postpone` | `.organize` | Lý do |
| | `POST …/{id}/supplementary` | `.organize` | Tạo hoạt động con (người vắng hoặc không đạt) |
| | `POST …/{id}/assess-impact` | `training.document_impact.manage` | Chọn vị trí đối tượng cho hoạt động gắn tài liệu |
| **Buổi và người** | `GET/POST /training/activities/{id}/sessions`, `PUT`, `POST …/hold` | `.organize` / `.conduct` | `held_on` không ở tương lai |
| | `GET/PUT /training/activities/{id}/participants` | `.organize` | Sinh từ đối tượng; thêm tay có lý do |
| | `POST /training/participants/{id}/attendance` | `.conduct` | `ATTENDED`, `ONLINE`, `ABSENT` (+ lý do) |
| | `POST /training/participants/{id}/assessments` | `training.assessment.record` | Điểm; kết quả do máy chủ tính; **người chấm ≠ người được chấm** |
| | `POST /training/activities/{id}/confirmations` | theo loại | Danh sách, giảng viên, nội dung (mục 8.4) |
| **Tệp** | `POST /training/activities/{id}/materials` (multipart), `GET …/materials/{id}/download` | `.organize` / `.view` | Quét virus, SHA-256, kiểm quyền khi tải |
| | `POST /training/evidence` (bản scan), `GET /training/evidence/{id}` | `.conduct` / `.view` | |
| **Hồ sơ** | `GET /training/records` (lọc người, tài liệu, mã, kỳ) | `training.record.view` | Phạm vi: bản thân, bộ phận, tất cả |
| | `GET /training/persons/{id}/dossier` | `.view` | Vào Audit Trail (xem hồ sơ người khác) |
| | `POST /training/persons/{id}/exports` | `training.record.export` | PDF APD.0014 có mã kiểm, chữ ký; lưu bản bất biến |
| | `GET /training/exports/{id}/download` | `.export` | |
| | `POST /training/records/{id}/void` | `training.record.void` | Lý do + chữ ký; không sửa dòng gốc |
| **Bản giao việc** | `GET/POST /training/job-assignments`, `GET/PUT {id}` (Draft) | `training.job_assignment.view` / `.manage` | |
| | `GET /training/job-assignments/eligibility?person=&position=` | `.manage` | Danh sách mục ma trận còn thiếu (cũng dùng làm khoảng trống khi điều chuyển) |
| | `POST …/{id}/sign-assignor` `/sign-receiver` | theo vai | Chữ ký |
| | `POST /training/persons/{id}/transfer-training` | `training.activity.organize` + `training.job_assignment.manage` | **Theo lưu đồ:** điều chuyển sinh đào tạo ban đầu. Nhận danh sách chủ đề đã xác nhận (từ khoảng trống ma trận), tạo hoạt động `INITIAL` lý do `TRANSFER` (D-33) |
| **Chữ ký mẫu** | `GET/POST /training/specimen-signatures`, `POST …/{id}/confirm`, `GET …/{id}/image` | `training.signature.view` / `.manage` / `.confirm` | Xem ảnh vào Audit Trail |
| **Tuân thủ** | `GET /training/compliance/coverage` `/overdue` `/untrained` `/due-soon` | `training.compliance.view` | Máy chủ tính; phạm vi theo bộ phận |
| | `GET /training/number-log?department=&year=` | `.view` | View `training_number_log_v` |
| | `GET /training/document-trainings` | `.view` | Hàng đợi hoạt động gắn tài liệu |
| | `GET /training/legacy-evidence` | `.view` | |
| **Quản trị** | `GET/PUT /training/settings` | `training.settings.view` / `.manage` | Phiên bản, lý do |
| | `GET/POST /training/topics`, `PUT`, `…/active` | `training.admin.manage` | |
| | `GET/POST /training/person-positions`, `GET /training/person-positions/unmatched` | `.admin.manage` | Ánh xạ vị trí và báo cáo không khớp |
| | `GET /training/outbox`, `POST …/{id}/retry` | `training.admin.manage` | Việc nền thất bại |
| **Liên quan Document Control** | `GET /documents/revisions/{id}/training` | quyền xem revision | Trạng thái đào tạo (mục 6) |
| | `GET /authorization/resources/TRAINING_ACTIVITY/{id}/capabilities` (và `TRAINING_MATRIX_VERSION`, `TRAINING_REQUIREMENT`, `TRAINING_JOB_ASSIGNMENT`) | quyền xem | Mở rộng `ResourceCapabilityService` |

### 7.2 Mã lỗi ổn định (giá trị máy, không dùng chữ hiển thị)

`TRAINING_SCOPE_DENIED`, `TRAINING_*_VERSION_CHANGED`, `TRAINING_*_INVALID_TRANSITION`, `TRAINING_ACTIVITY_NOT_COMPLETED`, `TRAINING_NUMBER_UNAVAILABLE`, `TRAINING_DEPARTMENT_CODE_INVALID`, `TRAINING_REASON_REQUIRED`, `TRAINING_SIGNATURE_REQUIRED`, `TRAINING_SIGNATURE_INVALID`, `TRAINING_SEGREGATION_OF_DUTIES`, `TRAINING_TRAINER_NOT_QUALIFIED`, `TRAINING_DOCUMENT_NOT_EFFECTIVE`, `TRAINING_DATE_IN_FUTURE`, `TRAINING_PARTICIPANT_NOT_ELIGIBLE`, `TRAINING_ASSESSMENT_SELF`, `TRAINING_MATRIX_INCOMPLETE`, `TRAINING_FILE_REJECTED`, `TRAINING_SORT_NOT_ALLOWED`, `TRAINING_INTEGRATION_DISABLED`, `TRAINING_MODE_CONFLICT`. Giao diện ánh xạ mã sang thông báo (như `reportError`); thông báo **không lộ chi tiết nội bộ**.

---

## 8 Phân quyền, tách nhiệm vụ, chữ ký điện tử

### 8.1 Danh mục quyền (mới; không gán cho ai khi migration)

| Quyền | Cho phép | Phạm vi đối tượng |
|---|---|---|
| `training.module.view` (đã có) | Mở menu Training | — |
| `training.self.view` | Việc và hồ sơ **của chính mình**, tự đọc | Bản thân (cố định) |
| `training.matrix.view` / `.manage` / `.approve` | Xem / lập, sửa, gửi, nâng phiên bản / duyệt, từ chối. **Quyền duyệt gán cho bất kỳ Access Profile nào phù hợp (D-05)**; hệ thống không giả định ai là người duyệt | Bộ phận mình hoặc tất cả |
| `training.requirement.view` / `.prepare` / `.review` / `.approve` | Phiếu APD.0118 | Tất cả |
| `training.code.allocate` | Cấp mã cho hoạt động ban đầu và định kỳ (QA) | Tất cả |
| `training.activity.view` | Xem hoạt động | Bộ phận mình hoặc tất cả |
| `training.activity.organize` | Tạo, sửa, thông báo, dời, hủy, thêm session và người tham gia | Hoạt động của bộ phận mình; đột xuất và bên ngoài do bộ phận phát sinh |
| `training.activity.conduct` | Điểm danh, giảng dạy, xác nhận của giảng viên | Hoạt động được giao làm giảng viên |
| `training.assessment.record` | Ghi kết quả đánh giá | Hoạt động được giao |
| `training.content.review` / `training.content.approve` | Xem xét / duyệt nội dung và bài kiểm tra (D-32); gán cho **bất kỳ user được chỉ định** | Theo bộ phận |
| `training.approval.designate` | Chỉ định hoặc đổi người xử lý một bước (mục 8.5); mặc định chỉ người gửi đối tượng, quyền này cho phép người khác (ví dụ QA) chỉ định thay | Theo bộ phận hoặc tất cả |
| `training.approval.reassign` | Đổi người xử lý khi người được chỉ định vắng hoặc mất quyền; lý do bắt buộc | Tất cả |
| `training.trainer.exception.approve` | Duyệt ngoại lệ giảng viên chưa đủ điều kiện (D-10) | Theo bộ phận |
| `training.job_assignment.exception.approve` | Duyệt ngoại lệ lập bản giao việc khi chưa đủ ma trận (D-15) | Theo bộ phận |
| `training.activity.close` | DCO-QA xác nhận hoàn thành | Tất cả |
| `training.document_impact.manage` | Đánh giá tác động đào tạo cho hoạt động gắn tài liệu | Bộ phận liên quan |
| `training.record.view` | Xem hồ sơ đào tạo cá nhân | Bản thân, bộ phận, tất cả |
| `training.record.export` | Xuất PDF hồ sơ | Tất cả (hoặc bộ phận) |
| `training.record.void` | Vô hiệu một dòng hồ sơ | Tất cả; quyền hiếm |
| `training.job_assignment.view` / `.manage` | Bản giao việc | Bộ phận mình |
| `training.signature.view` / `.manage` / `.confirm` | Chữ ký mẫu | Bộ phận mình hoặc tất cả |
| `training.compliance.view` | Màn tuân thủ và sổ mã | Bộ phận hoặc tất cả |
| `training.settings.view` / `.manage` | Thiết lập module | — |
| `training.admin.manage` | Chủ đề, ánh xạ vị trí, việc nền | — |
| `training.audit.view` | Xem Audit Trail của Training (nối với quyền `audit.view` hiện có; theo D-19 giữ tương thích) | Tất cả |

Quyền đã có (`training.material.manage`, `training.session.manage`, `training.assignment.manage`, `training.admin.*.view`) **không bị xóa** ở giai đoạn đầu; ánh xạ sang quyền mới và bỏ dần (D-19). Quyền ở bên Document Control (`documents.training.manage`, `documents.training.complete`) giữ nguyên.

**Không có quyền nào được viết cứng cho tài khoản hoặc tên vai trò** (cùng nguyên tắc với Report). Phạm vi bộ phận lấy từ bộ phận của người dùng và danh sách bộ phận được ủy quyền cấu hình trong Access Profile.

### 8.2 Khả năng theo đối tượng (capabilities)

`ResourceCapabilityService` trả cho mỗi đối tượng danh sách hành động `{allowed, reasonCode, requiredPermissionCode, signed}`; giao diện chỉ hiện nút theo kết quả này; **mỗi lệnh kiểm tra lại**. Ví dụ hành động của hoạt động: `edit`, `notify`, `hold`, `recordAttendance`, `recordAssessment`, `submitForConfirmation`, `confirmCompletion`, `cancel`, `postpone`, `addSupplementary`, `download`.

### 8.3 Tách nhiệm vụ (kiểm tra ở máy chủ, `TRAINING_SEGREGATION_OF_DUTIES`)

| Quy tắc | Căn cứ |
|---|---|
| Người duyệt ma trận ≠ người lập phiên bản đó | SOP 5.3.1 (lập và duyệt khác người) |
| Yêu cầu đào tạo: lập ≠ xem xét ≠ duyệt (ba người khác nhau) | APD.0118 |
| DCO-QA xác nhận hoàn thành ≠ người chuẩn bị danh sách của hoạt động đó | APD.0117 mục 4 và 6 |
| Giảng viên không ghi kết quả đánh giá cho **chính mình** (người tham gia ≠ người chấm) | TR-14; `TRAINING_ASSESSMENT_SELF` |
| Bản giao việc: người giao ≠ người nhận | SOP 5.3.8 |
| Chữ ký mẫu: trưởng đơn vị xác nhận ≠ chính nhân viên | SOP 5.3.9 |
| Người duyệt nội dung đào tạo ≠ người soạn nội dung | SOP 5.3.5 |
| Vô hiệu hồ sơ: người vô hiệu ≠ người đã tạo ra dòng đó (hoạt động do họ xác nhận) | ĐỀ XUẤT |
| Giảng viên đủ điều kiện (TR-19): đã đào tạo GMP, đã đào tạo SOP đó, hoặc là người soạn, kiểm tra, duyệt, trưởng bộ phận, giám sát đã được đào tạo | SOP 5.1; **chặn**, có ngoại lệ có lý do và duyệt (D-10, ĐỀ XUẤT) |

### 8.4 Ma trận chữ ký điện tử

Dùng cơ chế sẵn có (xác thực lại bằng mật khẩu, mã dùng một lần, chống phát lại, lưu `electronic_signatures` qua `ElectronicSignatureService.createEntitySignature`). Ý nghĩa mới thêm vào `electronic_signature_meanings` (mã máy, không dùng chữ hiển thị làm giá trị):

| Hành động | Mã ý nghĩa | Người ký |
|---|---|---|
| Gửi duyệt ma trận | `TRAINING_MATRIX_PREPARED` | Trưởng đơn vị |
| Duyệt ma trận | `TRAINING_MATRIX_APPROVED` | Người có quyền duyệt ma trận, khác người lập (D-05) |
| Lập, xem xét, duyệt yêu cầu | `TRAINING_REQUIREMENT_PREPARED` / `_REVIEWED` / `_APPROVED` | Điều phối đào tạo, Trưởng phòng QA, QM |
| Xác nhận danh sách trước đào tạo | `TRAINING_LIST_VERIFIED` | Người chuẩn bị |
| Xem xét và duyệt nội dung | `TRAINING_CONTENT_REVIEWED` / `_APPROVED` | Trưởng đơn vị; Trưởng phòng QA |
| Giảng viên xác nhận tham dự đủ | `TRAINING_ATTENDANCE_CONFIRMED` | Giảng viên |
| Ký tham dự điện tử | `TRAINING_ATTENDED` | Học viên (hoặc bản scan khi ký tay, D-20) |
| Ký bài đánh giá điện tử | `TRAINING_ASSESSMENT_SIGNED` | Học viên (hoặc scan) |
| Xác nhận tự đọc | `TRAINING_READ_CONFIRMED` / `TRAINING_READ_VERIFIED` | Học viên; trưởng phòng |
| Xác nhận hoàn thành hoạt động | `TRAINING_COMPLETED` | DCO-QA |
| Vô hiệu hồ sơ | `TRAINING_RECORD_VOIDED` | Người có quyền |
| Xuất hồ sơ cá nhân | `TRAINING_RECORD_PREPARED` / `_APPROVED` | Người chuẩn bị; Trưởng phòng QA |
| Bản giao việc | `TRAINING_JOB_ASSIGNED` / `TRAINING_JOB_ACCEPTED` | Trưởng đơn vị; nhân viên |
| Chữ ký mẫu | `TRAINING_SPECIMEN_APPROVED` | Trưởng đơn vị |
| Thay đổi thiết lập | `TRAINING_SETTINGS_CHANGED` | Người có quyền |
| Complete Training (Document Control) | `TRAINING_CONFIRMED` (đã có, V138) | Người có `documents.training.complete` |

Ký tay (ví dụ đào tạo thực hành ở khu sản xuất, D-20): lưu **bản scan** ở `training_paper_evidence` (quét virus, SHA-256), có **người nhận xác nhận** đã đối chiếu bản giấy; trạng thái người tham gia dùng `sign_mode = PAPER_SCAN`. Báo cáo tuân thủ nêu rõ tỷ lệ ký điện tử và ký tay.

---

### 8.5 Mô hình chỉ định người xử lý (xem xét, duyệt, xác nhận)

**Nguyên tắc (chủ dự án 2026-10-16):** các bước phê duyệt **thiết kế theo phân quyền**; người dùng có quyền **chỉ định bất kỳ user nào** đủ điều kiện. Không có bước nào gắn cứng một tên vai trò, một tài khoản hay số cấp. Mô hình giống cách chọn người xem xét, duyệt của revision tài liệu (có sẵn `ResourceCapabilityService.getEligibleParticipants`, nay mở rộng cho đối tượng Training).

**Quy tắc cho mọi bước:**
1. **Người đủ điều kiện** = đang `Active` + **giữ quyền của bước** trên bộ phận của đối tượng + **không vi phạm tách nhiệm vụ** (mục 8.3, ví dụ khác người lập).
2. **Chỉ định:** khi gửi (submit), người gửi chọn người xử lý trong **danh sách đủ điều kiện do máy chủ trả**: `GET /training/{loại}/{id}/eligible-approvers?step=`. Máy chủ **kiểm lại** khi lưu chỉ định; chọn người không đủ điều kiện bị từ chối `TRAINING_APPROVER_NOT_ELIGIBLE`. Nếu bộ phận có người mặc định (`training_default_approvers`), giao diện **điền sẵn**, người gửi đổi được.
3. **Chế độ của bước** (cấu hình ở Training Properties, mỗi thay đổi có lý do và Audit Trail): `DESIGNATED_REQUIRED` (**mặc định cho mọi bước duyệt và xem xét**): chỉ người được chỉ định ký được; hoặc `ANY_ELIGIBLE`: bất kỳ người đủ điều kiện nào ký được (dùng cho xác nhận mà SOP không gắn một người cụ thể, ví dụ xác nhận hoàn thành hoạt động).
4. **Kiểm tra lại khi ký:** người ký phải **vẫn giữ quyền**, vẫn `Active`, vẫn khác người lập, và (nếu `DESIGNATED_REQUIRED`) đúng là người được chỉ định. Mất quyền giữa chừng ⇒ bước **bị chặn** (`TRAINING_APPROVER_NOT_ELIGIBLE`), cần chỉ định lại.
5. **Đổi người xử lý** (vắng, nghỉ, mất quyền): lệnh `reassign` với **lý do bắt buộc**; dòng cũ thành `REASSIGNED`, dòng mới `PENDING`; Audit Trail ghi người đổi, người cũ, người mới, lý do; thông báo cho cả hai. Quyền `training.approval.reassign`.
6. **Không tự chỉ định mình để ký thay** khi vi phạm tách nhiệm vụ; không có "quyền admin bỏ qua" cho bước ký.
7. **Thông báo:** người được chỉ định nhận thông báo; việc chờ hiện ở "Việc chờ tôi xử lý" của My Training; nhắc theo hạn.
8. **Chữ ký điện tử** theo ma trận mục 8.4; chữ ký ghi người ký thật (không phải người được chỉ định nếu khác) và `assignment_id`.

**Các bước và cấu hình mặc định:**

| Bước (`step_code`) | Đối tượng | Quyền cần | Chế độ mặc định | Tách nhiệm vụ | Chữ ký |
|---|---|---|---|---|---|
| `MATRIX_APPROVE` | Phiên bản ma trận | `training.matrix.approve` | DESIGNATED_REQUIRED | ≠ người lập | `TRAINING_MATRIX_APPROVED` |
| `REQUIREMENT_REVIEW` | Yêu cầu đào tạo | `training.requirement.review` | DESIGNATED_REQUIRED | ≠ người lập | `TRAINING_REQUIREMENT_REVIEWED` |
| `REQUIREMENT_APPROVE` | Yêu cầu đào tạo | `training.requirement.approve` | DESIGNATED_REQUIRED | ≠ người lập, ≠ người xem xét | `TRAINING_REQUIREMENT_APPROVED` |
| `CONTENT_REVIEW` | Nội dung và bài kiểm tra | `training.content.review` | DESIGNATED_REQUIRED | ≠ người soạn | `TRAINING_CONTENT_REVIEWED` |
| `CONTENT_APPROVE` | Nội dung và bài kiểm tra | `training.content.approve` | DESIGNATED_REQUIRED | ≠ người soạn, ≠ người xem xét | `TRAINING_CONTENT_APPROVED` |
| `ACTIVITY_COMPLETE` | Hoạt động | `training.activity.close` | ANY_ELIGIBLE | ≠ người chuẩn bị danh sách | `TRAINING_COMPLETED` |
| `JOB_ASSIGN_SIGN` | Bản giao việc (người giao) | `training.job_assignment.manage` | DESIGNATED_REQUIRED | ≠ người nhận | `TRAINING_JOB_ASSIGNED` |
| `SPECIMEN_CONFIRM` | Chữ ký mẫu | `training.signature.confirm` | DESIGNATED_REQUIRED | ≠ chính nhân viên | `TRAINING_SPECIMEN_APPROVED` |
| `RECORD_EXPORT_APPROVE` | Bản xuất hồ sơ cá nhân | `training.record.export` | DESIGNATED_REQUIRED | ≠ người chuẩn bị | `TRAINING_RECORD_APPROVED` |
| `RECORD_VOID` | Vô hiệu hồ sơ | `training.record.void` | DESIGNATED_REQUIRED | ≠ người tạo dòng | `TRAINING_RECORD_VOIDED` |
| `TRAINER_EXCEPTION` | Ngoại lệ giảng viên (D-10) | `training.trainer.exception.approve` | DESIGNATED_REQUIRED | ≠ người đề nghị | `TRAINING_TRAINER_EXCEPTION_APPROVED` |
| `JOB_ASSIGN_EXCEPTION` | Ngoại lệ bản giao việc (D-15) | `training.job_assignment.exception.approve` | DESIGNATED_REQUIRED | ≠ người đề nghị | `TRAINING_JOB_EXCEPTION_APPROVED` |
| `SETTINGS_CHANGE` | Thay đổi thiết lập | `training.settings.manage` | ANY_ELIGIBLE | Có lý do, Audit Trail | `TRAINING_SETTINGS_CHANGED` |

Người nhận bản giao việc (nhân viên) và học viên ký tham dự **không** thuộc mô hình chỉ định: họ ký phần của chính mình.

**API:** `GET /training/{loại}/{id}/eligible-approvers?step=&search=&page=&limit=` (quyền: người gửi hoặc `training.approval.designate`); `PUT /training/{loại}/{id}/approvers` `{step, assigneeUserId, version}`; `POST /training/{loại}/{id}/approvers/{assignmentId}/reassign` `{assigneeUserId, reason}`; `GET /training/me/approvals` (việc chờ tôi xử lý, **luôn là chính người đăng nhập**); `GET/PUT /training/settings/approval-modes`; `GET/POST /training/default-approvers`. Lệnh duyệt như ở mục 7.1 chạy qua quy trình 2.3 và thêm bước kiểm tra chỉ định ở trên.

**Kiểm thử bắt buộc:** chỉ định người không đủ điều kiện bị từ chối; người không được chỉ định ký bị `403` (chế độ DESIGNATED_REQUIRED); người được chỉ định mất quyền giữa chừng bị chặn; tự duyệt việc của mình bị chặn; đổi người có lý do và Audit Trail; hai người ký cùng lúc chỉ một thành công; chỉ định trùng bị từ chối; danh sách đủ điều kiện **không lộ** người ngoài phạm vi bộ phận của người gửi.

---

## 9 Audit Trail và toàn vẹn dữ liệu

### 9.1 Mỗi lệnh ghi Audit Trail (`AuditTrailService.logAs`)

Loại đối tượng: `TRAINING_ACTIVITY`, `TRAINING_SESSION`, `TRAINING_PARTICIPANT`, `TRAINING_ASSESSMENT`, `TRAINING_MATRIX`, `TRAINING_REQUIREMENT`, `TRAINING_RECORD`, `TRAINING_JOB_ASSIGNMENT`, `TRAINING_SPECIMEN_SIGNATURE`, `TRAINING_SETTINGS`. Mã hành động ổn định (ví dụ `TRAINING_NUMBER_ASSIGNED`, `TRAINING_NUMBER_CANCELLED`, `TRAINING_ACTIVITY_NOTIFIED`, `TRAINING_ATTENDANCE_RECORDED`, `TRAINING_ASSESSMENT_RECORDED`, `TRAINING_ACTIVITY_COMPLETED`, `TRAINING_RECORD_CREATED`, `TRAINING_RECORD_VOIDED`, `TRAINING_RECORD_VIEWED`, `TRAINING_RECORD_EXPORTED`, `TRAINING_SIGNATURE_IMAGE_VIEWED`, `TRAINING_SETTINGS_UPDATED`). Mỗi dòng ghi: người, thời gian máy chủ, đối tượng, **giá trị trước và sau**, lý do, mã chữ ký, **mã tương quan** nối hai module (cấp mã bên Document Control và hoạt động bên Training chung một mã).
- **Đọc nhạy cảm cũng ghi:** xem hồ sơ người khác, xuất, xem ảnh chữ ký mẫu.
- `entity id` luôn khác rỗng (bài học từ Report: audit không ghi được nếu thiếu).

### 9.2 Bất biến

Mục 4.9. Thêm: mọi bảng bằng chứng không có `UPDATE` ở đường ứng dụng (không có phương thức cập nhật trong repository); thử `UPDATE` bằng SQL bị trigger chặn.

### 9.3 Sửa sai (không sửa bản gốc)

Bản ghi sai ⇒ **vô hiệu** (`training_record_voids`) kèm lý do và chữ ký, rồi (nếu cần) thêm dòng đúng; cả hai nằm trong hồ sơ; hồ sơ cá nhân hiển thị dòng hợp lệ nhưng **bản xuất có chú thích** các dòng bị vô hiệu. Hoạt động đã `COMPLETED` không mở lại; sai sót xử lý bằng vô hiệu và hoạt động bổ sung.

### 9.4 Toàn vẹn của bản xuất và tệp

SHA-256 cho tệp tải lên, bản scan, ảnh chữ ký mẫu và PDF xuất; lưu `sha256` và kiểm tra khi tải; sai ⇒ không trả tệp, ghi sự kiện (như Report). PDF xuất có: tiêu đề biểu mẫu, mã và phiên bản biểu mẫu tuân thủ ("Document template complies with requirement of APD.00xx (version …)"), số trang, người và thời điểm tạo, mã kiểm.

### 9.5 Lưu giữ

- Hồ sơ **không bị xóa**; `training_person_retention.retain_until` (nghỉ việc + 10 năm, không thấp hơn); hủy sau hạn **chỉ qua quy trình riêng có phê duyệt** (D-17), chưa xây ở giai đoạn đầu.
- Tệp ở bucket có kiểm soát; sao lưu theo module Backup & Restore (phạm vi sao lưu cần cập nhật để gồm bảng `training_*` và đối tượng tệp; **việc đối chiếu với phạm vi sao lưu hiện có là một mục kiểm tra ở WP-HARDEN**).
- Hồ sơ của tài liệu nhập cũ mang nhãn nguồn, không bị trộn với hồ sơ hoạt động.

### 9.6 Đồng bộ thời gian

Mọi thời điểm ghi là thời gian cơ sở dữ liệu hoặc máy chủ (UTC). Ngày nghiệp vụ (ngày đào tạo, ngày duyệt) là `DATE` theo giờ Việt Nam; `held_on` và ngày hoàn thành **không ở tương lai**; nhập muộn lưu cả ngày thực tế và ngày ghi.

---

## 10 Giao diện

### 10.1 Nguyên tắc

- Dựng **mới** toàn bộ giao diện Training (mã thử cũ bị thay, xóa hẳn: mục 15, WP-FE-CLEAN). Chỉ dùng thành phần dùng chung: `PageHeader`, `DataTable` + `useCustomColumnLayout`, `TablePagination`, `ConfiguredDesktopFilters`, `FilterDrawer`, `FormSection`, `Select`, `TabNav`, `WorkflowStepper`, `AlertModal`, `FormModal`, `ESignatureModal`, `Badge`, toast, loading và trạng thái rỗng và lỗi.
- **Mỗi màn hình mới giống hệt màn hình tương đương đã có** (danh sách như Report Name Formats hoặc Document list; chi tiết như chi tiết Document hoặc Revision; luồng tạo như `NewDocumentView` với stepper). Không tự nghĩ kiểu mới.
- **Chỉ hiển thị**; mọi xử lý, tìm kiếm, lọc, sắp xếp, phân trang, tính tuân thủ, kiểm tra quyền ở máy chủ. Không lấy giá trị máy từ chữ hiển thị. Trạng thái luôn có **chữ + biểu tượng + nhãn**, không chỉ màu.
- Đáp ứng màn nhỏ (bộ lọc dạng ngăn kéo, bảng chuyển thẻ); breadcrumb và tiêu đề trang đầy đủ; lỗi hiển thị, **không hiện 0 khi lỗi**.
- Thao tác rủi ro (hủy, vô hiệu, dời) qua hộp xác nhận có **lý do bắt buộc**; thao tác có chữ ký qua `ESignatureModal`.
- Cấu trúc thư mục: `eqms/src/features/training/{shared,my,activities,matrices,requirements,records,job-assignments,signatures,compliance,administration}`; kiểu và API ở `eqms/src/services/api/training*.ts` có kiểu chặt (không `any`); mỗi màn có test (vitest).

### 10.2 Menu và đường dẫn

| Menu (Training Management) | Đường dẫn | Quyền xem menu |
|---|---|---|
| My Training | `/training/my` | `training.self.view` |
| Training Activities | `/training/activities`, `/training/activities/new`, `/training/activities/:id` | `training.activity.view` |
| Document Trainings | `/training/document-trainings` | `training.activity.view` |
| Training Matrices | `/training/matrices`, `/training/matrices/:id`, `/training/matrix-versions/:id` | `training.matrix.view` |
| Training Requirements | `/training/requirements`, `/training/requirements/:id` | `training.requirement.view` |
| Training Number Log | `/training/number-log` | `training.compliance.view` |
| Training Records | `/training/records`, `/training/persons/:id` | `training.record.view` |
| Job Assignments | `/training/job-assignments`, `/training/job-assignments/:id` | `training.job_assignment.view` |
| Specimen Signatures | `/training/specimen-signatures` | `training.signature.view` |
| Compliance | `/training/compliance` | `training.compliance.view` |
| Legacy Evidence | `/training/legacy-evidence` | `training.compliance.view` |

| Menu (Training Administration, trong System Administration) | Đường dẫn | Quyền |
|---|---|---|
| Training Properties | `/settings/training-properties` | `training.settings.view` |
| Training Topics | `/settings/training-topics` | `training.admin.manage` |
| Position Mapping | `/settings/training-positions` | `training.admin.manage` |
| Background Jobs | `/settings/training-jobs` | `training.admin.manage` |

Mọi mục menu do `NavigationService` trả theo quyền; route bọc `ProtectedRoute` với danh sách quyền (như Report).

### 10.3 Đặc tả từng màn hình

| Màn hình | Người dùng | Nội dung chính | Hành động (theo capabilities) |
|---|---|---|---|
| **My Training** | Mọi nhân viên | Việc của tôi: buổi sắp tới, danh sách đã được thêm vào, tự đọc chờ xác nhận, đợt bổ sung cần dự; hồ sơ của tôi (bảng, lọc theo kỳ, tài liệu) | Xác nhận đã đọc (ký); xem hồ sơ |
| **Training Activities** (danh sách) | QA, trưởng đơn vị | Cột: No., Training Number, loại, tên chủ đề, bộ phận, tài liệu liên kết, hạn, trạng thái, số người (đạt trên tổng); lọc: loại, trạng thái, bộ phận, năm, có gắn tài liệu, quá hạn; tìm theo mã hoặc chủ đề; menu 3 chấm | View, Edit, Cancel, Add supplementary |
| **New Training Activity** (luồng tạo, stepper như `NewDocumentView`) | Người tổ chức | Bước 1 **General**: loại, bộ phận tổ chức, chủ đề (từ yêu cầu đào tạo hoặc tài liệu hiệu lực), hạn; **Training Number chỉ đọc, hiện sau khi lưu**. Bước 2 **Sessions**: hình thức, giảng viên (kiểm tra đủ điều kiện), ngày, địa điểm, cách đánh giá. Bước 3 **Participants**: đề xuất từ ma trận, thêm tay có lý do, người ngoài, đánh dấu vắng dài hạn. Bước 4 **Content**: tải nội dung và bài kiểm tra; xem xét và duyệt. Bước 5 **Review & Notify** | Save, Notify |
| **Training Activity Detail** | QA, người tổ chức, giảng viên | Tab: General · Sessions · Participants (điểm danh, kết quả, ký) · Content · Confirmations (danh sách, giảng viên, QA) · Evidence (bản scan) · Records · Audit Trail; thanh trạng thái (stepper); tài liệu liên kết (đi tới Document Control) | Hold session, Record attendance, Record assessment, Submit for confirmation, Confirm completion (ký), Postpone, Cancel, Add supplementary |
| **Document Trainings** | QA, bộ phận | Hàng đợi hoạt động gắn revision: tài liệu, revision, hạn, trạng thái, **đánh giá tác động chưa làm**; mở chi tiết | Assess impact (chọn vị trí đối tượng) |
| **Training Matrices** (danh sách + chi tiết) | Trưởng đơn vị, QA | Theo bộ phận; phiên bản; bảng ma trận (dòng chủ đề hoặc SOP × cột vị trí); nhóm dòng; cờ "Annual training required"; so sánh phiên bản; xuất PDF APD.0011 | Edit (Draft), Submit, Approve, Reject, Upgrade, Obsolete |
| **Training Requirements** | QA, QM | Phiếu theo năm hoặc đợt; dòng theo tháng; gợi ý tài liệu vừa rà soát; trạng thái dòng; liên kết hoạt động | Prepare, Submit, Review, Approve, Postpone line |
| **Training Number Log** | Bộ phận, QA | Sổ theo bộ phận và năm (ngày, mã, mã SOP, chủ đề, số buổi, ghi chú); mã đã hủy hiện trạng thái | Xuất |
| **Training Records / Person dossier** | QA, trưởng đơn vị | Lịch sử đào tạo (nội dung, ngày, mã đào tạo, mã SOP và phiên bản); dòng bị vô hiệu có chú thích; thông tin nhân sự; bản giao việc hiện hành; chữ ký mẫu hiện hành | Export (ký), Void |
| **Job Assignments** | Trưởng đơn vị, nhân viên | Hai biểu mẫu như APD.0024 (bổ nhiệm lần đầu, thay đổi); **kiểm tra đủ ma trận** hiện danh sách mục thiếu | Create, Sign (assignor, receiver) |
| **Specimen Signatures** | Trưởng đơn vị | Phiên bản chữ ký mẫu của từng người; tải ảnh | Upload, Confirm |
| **Compliance** | QA, quản lý | Bao phủ (người × chủ đề), quá hạn, sắp đến hạn, **chưa đào tạo theo tài liệu**, theo bộ phận; số liệu từ máy chủ | Xuất |
| **Legacy Evidence** | QA | Bằng chứng tài liệu nhập cũ; đánh dấu "Training not evidenced"; đính kèm bản scan | Verify, Attach |
| **Training Properties** | Quản trị | `pass_percent`, hạn 10 ngày mặc định, 7 ngày làm việc, mốc 31/12, 6 tháng vắng, thời gian lưu; bật tắt tích hợp (có lý do) | Save (xác nhận, ghi Audit Trail) |
| **Training Topics**, **Position Mapping**, **Background Jobs** | Quản trị | Danh mục chủ đề; ánh xạ người dùng đến vị trí và danh sách không khớp; việc nền thất bại | Create, Edit, Retry |

### 10.4 Thay đổi ở Document Control (tên tệp là KIỂM TRA MÃ)

| Tệp hoặc màn | Thay đổi |
|---|---|
| `features/documents/document-list/document-creation/new-tabs/TrainingTab.tsx` và `NewDocumentView.tsx` | Thêm ô **Training Number** chỉ đọc (trống đến khi lưu thành công), liên kết "Open in Training Management" (chỉ khi có quyền), trạng thái hoạt động; **Training Period mặc định theo `training_settings`**; **hộp xác nhận khi bỏ tick** revision đã có mã (nêu rõ mã sẽ bị hủy khi lưu); giữ ô lý do văn bản tự do; không tab với tài liệu mẫu; không hiện ô mã với tài liệu `LEGACY_IMPORT` hay `MANUAL` |
| `features/documents/document-revisions/workspace-tabs` (`TrainingInformationTab`) và `training-revision/RevisionTrainingView.tsx` | Ba ngày **chỉ đọc**; thêm mã đào tạo, trạng thái, tiến độ (đã đạt trên cần đào tạo); nút Complete Training **bật khi** hoạt động `COMPLETED` (chế độ `INTEGRATED`); chế độ `MANUAL` giữ hành vi cũ |
| `features/documents/document-list` (cột và bộ lọc) và `services/api/documents.ts`, `types.ts` | Cột **Training Number**, **Training Status**; lọc phía máy chủ |
| `features/documents/document-list/document-creation/LegacyImportView.tsx` | Ghi `training_origin`; không hiện ô mã; kiểm tra ngày đào tạo như hiện nay |
| `features/settings/document-administration/DocumentPropertiesView.tsx` | **Không đổi** logic ngày hiệu lực; thêm chú thích rằng "After Training completion" lấy ngày DCO-QA xác nhận hoạt động đào tạo |
| Lịch, email, placeholder xuất bản | Thêm `trainingNumber`; ngày vẫn đọc từ revision |

### 10.5 Chữ ký và giao diện

Mọi hành động có chữ ký mở `ESignatureModal` với **ý nghĩa nêu rõ** (nhãn từ danh mục ý nghĩa) và lý do khi bắt buộc; kết quả `signatureToken` gửi kèm lệnh; không lưu mã trong bộ nhớ trình duyệt ngoài vòng đời của lệnh. Khi máy chủ trả `TRAINING_SIGNATURE_INVALID`, hộp thoại yêu cầu ký lại.

### 10.6 Kiểm thử giao diện

Mỗi màn: tải, rỗng, lỗi, xung đột phiên bản, không có quyền (ẩn nút và từ chối ở máy chủ), responsive, truy cập bàn phím; test không dùng dữ liệu mẫu trộn dữ liệu thật; test hợp đồng kiểu (type) với API.

---

## 11 Công việc nền, nhắc việc và thông báo

| Việc | Khi nào | Nội dung | Ghi chú |
|---|---|---|---|
| `TrainingOutboxWorker` | Chu kỳ ngắn (như worker Report), khóa phân tán | Xử lý `onApproved`, `recordCompletion`, thông báo; `FOR UPDATE SKIP LOCKED`; thử lại có giãn cách; quá số lần ⇒ `FAILED` và hiện ở Background Jobs | Đọc lại trạng thái và phiên bản trước khi tác động |
| `TrainingReminderJob` | Hằng ngày | Trước 31/12 chưa có yêu cầu năm sau được duyệt (TR-07); cuối tháng rà soát tài liệu chưa có yêu cầu (TR-08); danh sách tham gia chưa gửi trước buổi (TR-11); hạn 10 ngày sắp tới; hạn nộp kết quả (trong ngày, 7 ngày làm việc: TR-12, TR-13) | Thông báo trong ứng dụng và email qua dịch vụ có sẵn; chống gửi trùng bằng `training_notification_log` |
| `TrainingOverdueJob` | Hằng ngày | Chủ đề quá tháng đăng ký ⇒ dòng `OVERDUE` và **bắt buộc dời** sang tháng sau có lý do (TR-09); hoạt động quá hạn đánh dấu; người vắng trên 6 tháng cần đào tạo lại (TR-30) khi có dữ liệu vắng | Không tự đổi dữ liệu nghiệp vụ ngoài nhãn quá hạn |
| `TrainingRetentionJob` | Hằng tuần | Tính `retain_until` khi người dùng nghỉ việc; **chỉ đánh dấu**, không xóa | |

**Mẫu thông báo** (nạp bằng bootstrap như các mẫu hiện có): Tham gia buổi đào tạo; Nhắc danh sách; Hoạt động mở (tài liệu được duyệt); Hạn sắp đến; Quá hạn; Cần đào tạo lại; Yêu cầu chờ xem xét và duyệt; Bản giao việc chờ ký. Nội dung thông báo **không chứa dữ liệu nhạy cảm** (không điểm, không chữ ký); chỉ liên kết sâu đòi đăng nhập và kiểm quyền lại.

**Ngày làm việc (D-14, đã chốt):** `WorkingCalendarService` dùng bảng `training_non_working_days` (hoặc Calendar sẵn có nếu có lịch nghỉ); mặc định thứ Hai đến thứ Sáu.

---

## 12 Tuân thủ và báo cáo

Mọi tính toán ở máy chủ, có chỉ mục, phân trang và lọc phía máy chủ. Chín câu hỏi nghiệp vụ của PLAN-TR-001 mục 9 là chín truy vấn có kiểm thử:

| # | Câu hỏi | Nguồn dữ liệu | Điểm cuối |
|---|---|---|---|
| 1 | Ai chưa đào tạo chủ đề hoặc SOP mà ma trận yêu cầu | Ma trận hiệu lực × vị trí hiện giữ × hồ sơ | `/compliance/coverage`, `/untrained` |
| 2 | Tài liệu mới nào quá hạn đào tạo | Hoạt động gắn revision, hạn | `/compliance/overdue` |
| 3 | Yêu cầu hằng năm: làm, chưa làm, dời | Dòng yêu cầu | `/requirements/{id}` |
| 4 | Ai không đạt và chờ đào tạo lại; việc nào tạm ngừng | Người tham gia, đánh giá | `/compliance/overdue?kind=failed` |
| 5 | Nhân viên đã hoàn thành ma trận vị trí chưa | Bản giao việc, ma trận | `/job-assignments/eligibility` |
| 6 | Ai vắng lâu cần đào tạo lại | Người tham gia, dữ liệu vắng | `/compliance/due-soon` |
| 7 | Hồ sơ của một người | Hồ sơ | `/persons/{id}/dossier` |
| 8 | Sổ mã của bộ phận | View sổ mã | `/number-log` |
| 9 | Hạn nộp kết quả cho QA | Hoạt động | `/compliance/overdue?kind=results` |

Bao phủ chỉ tính **một người đúng một lần cho mỗi (chủ đề, phiên bản tài liệu)**; "đã đào tạo" nghĩa là có dòng hồ sơ hợp lệ (không bị vô hiệu) cho **phiên bản tài liệu hiệu lực hiện hành** hoặc phiên bản mà ma trận chấp nhận (**MỞ**: một người đã đào tạo revision 1 có còn "đạt" khi revision 2 hiệu lực không; mặc định **không**, phải đào tạo lại, phù hợp D-25). Số liệu thật, lỗi hiển thị lỗi.

Có thể thêm Report Type "Training" cho module Report sau này (ngoài phạm vi, module Report đang tạm dừng).

---

## 13 Mô hình đe dọa và kiểm soát bảo mật

| Đe dọa | Ví dụ | Kiểm soát | Kiểm thử âm tính |
|---|---|---|---|
| Truy cập đối tượng không thuộc quyền (IDOR) | Gọi `GET /training/records` với mã người khác; đoán `activity id` | Phạm vi đối tượng ở máy chủ; `me/*` ép người đăng nhập; trả `403` đồng nhất | Người A lấy hồ sơ B ⇒ 403; trưởng bộ phận X xem bộ phận Y ⇒ 403 |
| Tự cấp quyền hoặc leo thang | Ghi `result = PASSED` trong yêu cầu | Kết quả **tính ở máy chủ**; DTO không nhận trường trạng thái; lệnh có tên | Gửi trường `result`, `status` trong body ⇒ bị bỏ qua hoặc 400 |
| Giả mạo hoàn thành | Gọi `confirm-completion` không có chữ ký, hoặc bởi người chuẩn bị danh sách | Chữ ký bắt buộc; tách nhiệm vụ; trạng thái hợp lệ | Thiếu, sai, hết hạn, dùng lại, sai chủ chữ ký ⇒ từ chối |
| Phát lại chữ ký | Dùng lại `signatureToken` | Mã dùng một lần có sẵn (`used_signature_tokens`) | Dùng lại ⇒ `TRAINING_SIGNATURE_INVALID` |
| Sửa hoặc xóa bằng chứng | SQL trực tiếp, lỗi mã | Trigger bất biến; không có phương thức cập nhật; sao lưu | `UPDATE`, `DELETE`, `TRUNCATE` ⇒ chặn |
| Đua dữ liệu | Hai người cấp mã, hai lệnh chuyển trạng thái | Câu lệnh cấp số nguyên tử; khóa dòng; khóa lạc quan | 200 luồng đồng thời không trùng; hai lệnh duyệt đồng thời chỉ một thành công |
| Tệp độc hại hoặc sai loại | Tải tệp có mã độc, tệp quá lớn | Quét ClamAV, danh sách loại cho phép, giới hạn kích thước, SHA-256, tải về kiểm quyền | EICAR, loại lạ, vượt kích thước ⇒ `TRAINING_FILE_REJECTED` |
| Lộ dữ liệu cá nhân | Xuất hàng loạt, danh sách có cột thừa | Cột tối thiểu; xuất có quyền riêng và Audit Trail; không dữ liệu cá nhân trong nhật ký | Kiểm tra phản hồi chỉ có trường cần |
| Tiêm SQL, sắp xếp tùy ý | `sortBy` là tên cột | Tham số hóa; danh sách cho phép; thoát ký tự `LIKE` | `sortBy=password`, chuỗi `' or 1=1` ⇒ 400, không ảnh hưởng |
| Lạm dụng tích hợp | Gọi cổng ngoài luồng Document Control; tạo mã hàng loạt | Cổng không lộ qua HTTP; chỉ gọi nội bộ; quyền sửa tài liệu bắt buộc; giới hạn tần suất | Gọi trực tiếp điểm cuối nội bộ ⇒ không tồn tại |
| Lệch ngày | Nhập ngày đào tạo tương lai hoặc sửa ngày lùi | Máy chủ từ chối; ngày thực tế và ngày ghi | `held_on` tương lai ⇒ `TRAINING_DATE_IN_FUTURE` |
| Ngoại lệ thầm lặng | Rơi về nhập tay khi lỗi | Không có đường rơi; lỗi lui giao dịch | Giả lập lỗi cổng ⇒ tài liệu không lưu, không dữ liệu nửa vời |
| Từ chối dịch vụ | Danh sách rất lớn, xuất nặng | Phân trang tối đa 100; xuất chạy nền có giới hạn; chỉ mục | Kiểm thử tải với dữ liệu ước tính |
| Rò rỉ khi người dùng bị vô hiệu hóa hoặc đổi bộ phận | Quyền còn sau khi nghỉ | Quyền đọc lại mỗi lệnh (không bộ nhớ đệm quyền cho Training, hoặc vô hiệu đệm khi đổi) | Đổi bộ phận ⇒ phạm vi đổi ngay |

Mọi lệnh có test **không có quyền**, **sai phạm vi**, **sai trạng thái**, **sai phiên bản**, **thiếu hoặc sai chữ ký** (nếu cần), **lặp lại**.

---

## 14 Kiểm định và kế hoạch kiểm thử

### 14.1 Hồ sơ kiểm định (theo quy ước dự án và hệ thống kiểm định đã dùng cho Backup và Report)

1. **URS** (từ PLAN-TR-001, TR-01 đến TR-31 và các quyết định).
2. **Đánh giá rủi ro và toàn vẹn dữ liệu** (mục 13 là bản đầu; mỗi rủi ro có mức, kiểm soát, kiểm thử).
3. **Đặc tả thiết kế và cấu hình** (tài liệu này, cấu hình ở mục 4.1 và 8).
4. **Ma trận truy vết:** URS ⇒ rủi ro ⇒ thiết kế ⇒ kiểm thử (mục 17).
5. **Giao thức và kết quả kiểm thử** theo từng gói, có sai lệch và hành động khắc phục.
6. **UAT với QA** theo kịch bản thật (mục 14.4).
7. **Phê duyệt phát hành** do người có thẩm quyền (**trợ lý không tự phê duyệt**).

### 14.2 Lớp kiểm thử

| Lớp | Nội dung |
|---|---|
| Đơn vị | Máy trạng thái; cấp mã (định dạng, hậu tố); tính hạn và ngày làm việc; ngưỡng 70% (làm tròn và biên); điều kiện giảng viên; tách nhiệm vụ; quy tắc phạm vi |
| Tích hợp (DB thật ở môi trường DEV, theo ghi chú dự án về DB dùng chung) | Trigger bất biến; ràng buộc duy nhất; chỉ mục duy nhất có điều kiện; giao dịch lui; outbox thử lại; migration idempotent |
| API | Mỗi điểm cuối × (đúng, không quyền, sai phạm vi, sai trạng thái, sai phiên bản, thiếu chữ ký, lặp lại) |
| Đồng thời | 200 lần cấp mã song song; hai lệnh duyệt; hai lần bổ sung cùng lúc (hậu tố) |
| Lỗi | Lỗi cổng khi lưu tài liệu; lỗi lưu tệp; lỗi gửi thông báo; mất kết nối khi `recordCompletion`; thử lại outbox |
| Bảo mật | IDOR, mass assignment, phát lại chữ ký, tệp độc hại, tiêm, quyền sau đổi bộ phận (mục 13) |
| Giao diện | Màn hình theo mục 10.6 |
| Đầu-cuối | Tài liệu tạo ⇒ tick ⇒ lưu ⇒ mã ⇒ duyệt ⇒ hoạt động mở ⇒ buổi ⇒ danh sách ⇒ đánh giá ⇒ DCO-QA ký ⇒ ngày vào revision ⇒ Complete Training ký ⇒ phát hành ⇒ ngày hiệu lực theo cấu hình ⇒ hồ sơ cá nhân |
| Hiệu năng | Danh sách và tuân thủ với dữ liệu ước tính của nhà máy (số người, số tài liệu, số năm) |
| Phục hồi | Sao lưu và khôi phục thử có `training_*` và tệp (cùng module Backup & Restore khi được làm tiếp) |

### 14.3 Các kiểm thử bắt buộc riêng cho phối hợp tài liệu

1. Tick, lưu ⇒ có mã, hoạt động `RESERVED`, dòng sổ mã.
2. Tick rồi bỏ **trước** khi lưu ⇒ không tạo gì.
3. Có mã, bỏ tick, **xác nhận** nhưng chưa lưu ⇒ máy chủ chưa đổi; tick lại ⇒ mã giữ; lưu sau khi bỏ ⇒ mã hủy, dòng Cancelled; tick lại và lưu ⇒ mã **mới**.
4. Upgrade revision ⇒ revision mới mang Requires Training; lần lưu đầu cấp mã **mới** (mã cũ không đổi).
5. Duyệt xong ⇒ `onApproved` mở hoạt động, hạn đúng, thông báo; lặp lại sự kiện không tạo bản thứ hai.
6. Hoàn thành ⇒ ba ngày vào revision, chỉ đọc; `Complete Training` bật; thiếu chữ ký bị từ chối; ngày hiệu lực đúng theo từng cấu hình (`After Training completion`, `After Approval +10`).
7. Chế độ: bật rồi tắt cờ với revision ở mọi giai đoạn; `MANUAL` không có mã; `INTEGRATED` không nhập tay.
8. Nhập cũ: không mã; có `training_legacy_evidence`; thiếu ngày ⇒ `not_evidenced`.
9. Lỗi cổng khi lưu ⇒ tài liệu không đổi; **không** rơi về nhập tay.
10. Người dùng không có quyền Training: thấy mã chỉ đọc, không mở được màn Training.
11. Người vắng: đợt bổ sung mã `…a` không đổi ngày hoàn thành của revision; màn tuân thủ nêu rõ.

### 14.4 Kịch bản UAT (mẫu)

UAT-01 Ma trận một bộ phận hai phiên bản; UAT-02 Yêu cầu đào tạo năm ba chữ ký; UAT-03 Tài liệu mới từ khi tạo đến hiệu lực; UAT-04 Đào tạo tập trung có người vắng và người không đạt; UAT-05 Tự đọc có xác nhận trưởng phòng; UAT-06 Bản giao việc bị chặn khi thiếu ma trận; UAT-07 Xuất hồ sơ cá nhân và vô hiệu một dòng; UAT-08 Tài liệu nhập cũ; UAT-09 Tắt tích hợp. Mỗi kịch bản có mã, bước, kết quả mong đợi, người thực hiện thật (QA, trưởng đơn vị), bằng chứng chụp.

### 14.5 Bằng chứng không được nói quá

Biên dịch và triển khai **không phải** bằng chứng chức năng; mỗi gói báo riêng: đã biên dịch, đã triển khai, đã kiểm thử tự động (số lượng), đã kiểm thử trên DEV bằng API, đã xem trên trình duyệt, **chưa** kiểm tra gì (ghi rõ). Theo quy tắc của dự án: không ghi "OK" chỉ từ biên dịch và triển khai.

---

## 15 Kế hoạch triển khai theo gói công việc

Quy ước: kích cỡ tương đối **S** (nhỏ), **M**, **L**, **XL**; **không hứa thời gian**. Mỗi gói: một hồ sơ thay đổi, mục Decision Log (lựa chọn của trợ lý ghi "cần xác nhận"), phân tích ảnh hưởng trước khi sửa ký hiệu đã có, `detect_changes` trước commit, kiểm thử âm tính, đồng thời và lỗi, cập nhật SDS (mục tồn đọng), **chỉ DEV**, **không commit khi chưa được yêu cầu**.

| Gói | Nội dung | Phụ thuộc | Cỡ | Kết quả cần có để "xong" |
|---|---|---|---|---|
| **WP-0** Nền và quyết định | Chốt các câu hỏi ở mục 16 (không còn câu nào chặn: các câu mở đã được chốt theo đề xuất ở mục 16.2; chỉ cần QA xác nhận); đối chiếu lưu đồ SOP; URS; đánh giá rủi ro; ánh xạ `app_users.position` sang `positions`; kiểm tra `departments.code` hợp lệ cho mọi bộ phận; kế hoạch kiểm thử | — | M | Quyết định ghi Decision Log; URS và rủi ro được QA ký; báo cáo vị trí không khớp |
| **WP-1** DB nền | Migration V594+: `training_settings`, `training_topics`, `training_person_positions`, `training_non_working_days`, `training_events`, `training_outbox`, trigger bất biến, quyền, ý nghĩa chữ ký, cờ tính năng; `TrainingSettingsService`; mở rộng `TrainingAuthorizationService`; màn Training Properties | WP-0 | M | Test migration idempotent; test trigger; test quyền; màn Properties lưu có Audit Trail |
| **WP-2** Cấp mã và sổ mã | `training_number_sequences`, `training_activities` (khung), `TrainingNumberService`, view `training_number_log_v`, API sổ mã; màn Number Log | WP-1 | M | 200 luồng đồng thời không trùng; hậu tố đúng; hủy không dùng lại |
| **WP-3** Ma trận | Bảng và API ma trận, phiên bản, so sánh; màn Matrices; chữ ký; xuất PDF APD.0011 | WP-1, WP-0 | L | Hai phiên bản, duyệt khác người; bất biến sau duyệt |
| **WP-4** Yêu cầu đào tạo | Bảng và API yêu cầu, dòng, gợi ý từ rà soát, dời tháng; màn; ba chữ ký; nhắc 31/12 | WP-1, WP-3 | L | Luồng lập, xem xét, duyệt; dời sang tháng sau |
| **WP-5** Hoạt động lõi và **cổng Document Control (T3a)** | `TrainingActivityService`, máy trạng thái, session, đối tượng, `DocumentTrainingPort` và `TrainingDocumentIntegrationService`; sửa Document Control (tab, hộp xác nhận, cột), `training_mode`, `training_origin`; hàng Document Trainings và đánh giá tác động | WP-2, WP-3 | XL | Mục 14.3 ý 1 đến 4, 7 đến 10 đạt; Audit Trail hai bên |
| **WP-6** Thực hiện, đánh giá, hồ sơ (T2) | Người tham gia, điểm danh, đánh giá (câu hỏi, checklist, ngưỡng), tự đọc, bản scan, đào tạo lại và bổ sung, xác nhận DCO-QA, `training_records`, vô hiệu, My Training; xuất APD.0117, APD.0108, APD.0009 | WP-5 | XL | Hoạt động có hai session, ba học viên (vắng, không đạt rồi đạt); hồ sơ đúng và bất biến |
| **WP-7** Hoàn thành tài liệu (T3b) | `onApproved`, `recordCompletion`, hạn 10 ngày, bật Complete Training, ngày hiệu lực, người ký tài liệu = đào tạo ban đầu, gợi ý định kỳ sau rà soát | WP-5, WP-6 | L | Mục 14.3 ý 5, 6, 11; đầu-cuối đạt |
| **WP-8** Bản giao việc, chữ ký mẫu, chuyển vị trí (T4) | Bảng, API, màn, kiểm tra đủ ma trận, ngoại lệ có duyệt, khoảng trống khi đổi vị trí, **lệnh tạo đào tạo ban đầu từ điều chuyển (lưu đồ, D-33)**, xuất bản sao hồ sơ | WP-3, WP-6 | L | Không lập được khi thiếu ma trận; chỉ một chữ ký mẫu hiệu lực |
| **WP-9** Tuân thủ, nhắc việc, hồ sơ cá nhân và lưu giữ (T5) | Truy vấn tuân thủ, màn Compliance, jobs, xuất APD.0014, `training_person_retention`, Background Jobs | WP-6, WP-8 | L | Chín truy vấn đúng trên dữ liệu thử; jobs không gửi trùng |
| **WP-10** Dữ liệu cũ (T6) | `training_legacy_evidence`, tích hợp nhập tài liệu cũ, nhập hồ sơ cá nhân và sổ mã lịch sử (Excel) vào bảng riêng có nhãn và đối chiếu | WP-5, WP-6 | L | Đối chiếu số lượng; có người xác nhận |
| **WP-FE-CLEAN** Dọn mã thử | Xóa `features/training/*` và `features/settings/training-administration/` cũ, `mockData`, tuyến và menu cũ, `TrainingRoutes` cũ, test cũ; không để mã chết | Khi từng màn mới thay xong | S đến M | Không còn import tới mã cũ; build sạch |
| **WP-HARDEN** Kiểm định và phát hành | Kiểm thử bảo mật đầy đủ (mục 13), hiệu năng, phục hồi (gồm `training_*` và tệp), đối chiếu phạm vi sao lưu, UAT, gói bằng chứng, cập nhật SOP.0003 và biểu mẫu (ngoài phần mềm nhưng bắt buộc về GMP) | Tất cả | L | Hồ sơ kiểm định đủ; người có thẩm quyền phê duyệt |

### 15.1 WP-0 chi tiết (gói đầu tiên: không có mã chức năng, không đổi cơ sở dữ liệu)

| # | Việc | Sản phẩm (tệp mới trong `eqms-backend/docs/validation/` trừ khi ghi khác) | Tiêu chí xong |
|---|---|---|---|
| 0.1 | QA xác nhận các quyết định | Mục Decision Log có **tên người xác nhận** cho từng nhóm quyết định | QA ký |
| 0.2 | **URS** | `TRAINING_URS_2026_10.md`: mục đích sử dụng, ranh giới hệ thống, yêu cầu có mã `URS-TR-nnn` (từ TR-01 đến TR-31, mục 1, mục 6, mục 8.5), nguồn SOP, ưu tiên | Mỗi quy tắc TR-xx có một hoặc nhiều URS; QA ký |
| 0.3 | **Đánh giá rủi ro và toàn vẹn dữ liệu** | `TRAINING_RISK_ASSESSMENT_2026_10.md`: từ mục 13 và 1.2; mỗi rủi ro có mức nghiêm trọng, khả năng, khả năng phát hiện, kiểm soát, kiểm thử | Mọi rủi ro cao có kiểm soát và kiểm thử |
| 0.4 | **Chiến lược kiểm thử và ma trận truy vết** | `TRAINING_TEST_STRATEGY_2026_10.md` + ma trận URS ⇒ rủi ro ⇒ thiết kế ⇒ kiểm thử (từ mục 17) | Không có URS mồ côi |
| 0.5 | **Báo cáo dữ liệu nền (chỉ đọc, DEV)** | `TRAINING_BASELINE_DATA_REPORT_2026_10.md`: (a) bộ phận có `code` không hợp lệ hoặc trùng cho mã đào tạo (chỉ `A-Z0-9`); (b) người dùng Active chưa có bộ phận; (c) `app_users.position` không khớp `positions` (chỉ mã nhân viên và số lượng, không dữ liệu thừa); (d) vị trí chưa có bộ phận; (e) tài liệu và revision có `requires_training = true`; (f) revision đang ở `PENDING_TRAINING` (sẽ thành `MANUAL`); (g) quyền `training.*` hiện có và ai đang giữ (cho D-19); (h) loại tài liệu chưa có mức cấp (cho D-03) | Mỗi mục có số lượng và danh sách việc cần làm; không ghi mật khẩu hay dữ liệu cá nhân thừa |
| 0.6 | **Kiểm tra hạ tầng** | `TRAINING_INFRASTRUCTURE_CHECK_2026_10.md`: quét virus (ClamAV) có dùng được; kho tệp và quy tắc đặt tên khóa đối tượng cho tệp Training; cơ chế cờ tính năng; mẫu worker và khóa phân tán; thông báo và email; cách cấp quyền bằng SQL trên DEV (phải khởi động lại backend vì quyền được lưu đệm); phạm vi bộ phận được ủy quyền trong Access Profile có sẵn hay phải thêm | Mỗi mục: dùng được hoặc việc cần thêm ở gói nào |
| 0.7 | **Kế hoạch dọn mã thử** | Danh sách tệp và nơi import của `features/training/*`, `features/settings/training-administration/`, tuyến và menu cũ, `services/api/training.ts`, test cũ (ghi vào `TRAINING_INFRASTRUCTURE_CHECK_2026_10.md`) | Danh sách đủ; **không xóa** ở WP-0 |
| 0.8 | **Phân tích ảnh hưởng (GitNexus)** cho ký hiệu Document Control sẽ sửa ở WP-5 (mục 15, cuối) | Bảng ký hiệu, người gọi trực tiếp, luồng bị ảnh hưởng, mức rủi ro; **báo mức HIGH hoặc CRITICAL cho chủ dự án** | Chủ dự án đã đọc |
| 0.9 | Hồ sơ thay đổi WP-0 và báo cáo trung thực | Hồ sơ theo `08_ONE_CHANGE_RECORD_TEMPLATE.md`; mục "việc chưa làm" ở cuối | Đã gửi QA |

**Điều kiện cho phép bắt đầu WP-1:** các sản phẩm 0.1 đến 0.9 được QA xem xét và chủ dự án nói bắt đầu.

### 15.2 Cách làm việc cho mọi gói (danh sách kiểm tra)

1. **Trước khi làm:** mục Decision Log của gói (lựa chọn của trợ lý ghi "cần xác nhận"); `impact` cho từng ký hiệu đã có sẽ sửa; kiểm tra số migration tiếp theo (hiện V593, tức gói đầu dùng V594 trở đi); xác nhận chỉ làm trên DEV; **không commit nếu chưa được yêu cầu**.
2. **Làm theo thứ tự:** cơ sở dữ liệu và migration ⇒ dịch vụ và quy tắc ⇒ API ⇒ giao diện ⇒ bỏ mã thay thế. Mỗi lệnh ghi theo quy trình mục 2.3; mỗi bước phê duyệt theo mục 8.5; không viết logic duyệt riêng.
3. **Kiểm thử trong gói:** đơn vị, tích hợp (DB thật trên DEV), API (đủ bảy trường hợp mục 13), đồng thời, lỗi, bảo mật; `tsc` và vitest; **xem trên trình duyệt** (tự động hóa như đã làm với Report) và ghi rõ nếu chưa xem.
4. **Hồ sơ:** hồ sơ thay đổi một gói; cập nhật ma trận truy vết (mục 17); cập nhật PLAN-TR-001 và SDS-TR-001 (trạng thái, việc chưa làm); `detect_changes` trước khi commit.
5. **Báo cáo trung thực:** tách "đã biên dịch, đã triển khai, đã kiểm thử tự động (bao nhiêu), đã kiểm thử trên DEV bằng API, đã xem trên trình duyệt, **chưa làm**".
6. **Một gói xong khi:** tiêu chí của gói ở bảng mục 15 đạt; Audit Trail đủ; không còn mã chết; QA nhận hồ sơ.

**Mô hình chỉ định người xử lý (mục 8.5) được dựng ở WP-1** và mọi gói sau dùng lại; không gói nào tự viết logic duyệt riêng.

**Thứ tự đề xuất:** WP-0, WP-1, WP-2, WP-3, WP-4, WP-5 (cổng Document Control, thấy kết quả tick sớm), WP-6, WP-7, WP-8, WP-9, WP-10, WP-HARDEN; WP-FE-CLEAN chạy song song, màn nào thay xong thì xóa mã cũ tương ứng.

**Bản dùng sớm nhất (MVP):** WP-0 đến WP-7 cho **bộ phận QA**, chạy song song với giấy cho đến khi QA tin kết quả; mở rộng sang bộ phận khác sau. Đề xuất, chờ chủ dự án.

**Ảnh hưởng đến mã Document Control hiện có (phải chạy `impact` trước):** `DocumentService` (tạo, cập nhật nhánh đào tạo), `RevisionService` (nhánh `PENDING_TRAINING`, `completeTraining`, Upgrade, hủy), `DocumentRevisionRecord`, `RevisionDetailResponse`, `DocumentDraftCreateRequest`, `LegacyBatchRevisionSectionRequest`, `NewDocumentView`, `TrainingTab`, `RevisionTrainingView`, `TrainingInformationTab`, `LegacyImportView`, danh sách tài liệu và `documents.ts`; `NavigationService`, `ResourceCapabilityService`, `TrainingAuthorizationService`. Báo mức rủi ro HIGH hoặc CRITICAL cho chủ dự án **trước khi sửa**.

---

## 16 Quyết định và giả định

### 16.1 Đã chốt (chủ dự án 2026-10-15 và 2026-10-16)

**Chốt 2026-10-16:** D-01 (lưu đồ là ảnh đính kèm; đã đối chiếu); D-02 (ma trận là **dữ liệu của Training**, vì nhiều cuộc đào tạo không xuất phát từ tài liệu); D-05 (duyệt do người được phân quyền phù hợp); D-20 (cả ký điện tử và ký tay).

**Chốt 2026-10-15:**

D-23 (mã cho revision, chỉ đọc, hiện sau lưu), D-24 (xác nhận, hủy khi lưu), D-25 (Upgrade vẫn đào tạo), D-26 (không tick là đủ), D-29 (vẫn ký như luồng hiện tại), D-30 (ngày hiệu lực theo Document Properties), **D-27, D-28, D-31 (đồng ý đề xuất)**: nhập cũ không cấp mã; lỗi thì lui và hai chế độ `INTEGRATED` hoặc `MANUAL` ghi vào revision; ngày hoàn thành là ngày DCO-QA xác nhận hoạt động gốc.

### 16.2 Đề xuất đã được chấp nhận qua ủy quyền (2026-10-16), QA xác nhận

Chủ dự án giao người soạn tự đề xuất; riêng các bước phê duyệt phải thiết kế theo phân quyền, chỉ định được bất kỳ user nào (mục 8.5). Nhãn: **ĐÃ CHỐT THEO ĐỀ XUẤT; QA xác nhận**. Còn **một** việc chờ chính QA: sửa SOP hoặc lưu đồ cho thống nhất ở D-32.

| Mã | Vấn đề | Quyết định | Gói |
|---|---|---|---|
| D-03 | Cấp tài liệu 1 đến 4 | Thêm thuộc tính tùy chọn **"Document Level (1-4)"** cho loại tài liệu (QA điền; trống = chưa biết, **không đoán**). Chỉ dùng làm **gợi ý** khi đánh giá tác động (cấp 4 gợi ý "thường không cần đào tạo", SOP 5.3.1); **không chặn**, người dùng vẫn tự quyết bằng việc tick Requires Training (D-26). Làm ở WP-5 như một thay đổi nhỏ của Document Administration | WP-5 |
| D-04 | Ánh xạ người dùng đến vị trí | Khớp `app_users.position` với `positions.name` (không phân biệt hoa thường, bỏ khoảng trắng thừa); **không tự đoán** dòng không khớp: đưa vào báo cáo "không khớp" và màn **Position Mapping** để người có `training.admin.manage` chọn tay; người chưa ánh xạ được **liệt kê là "unmapped"** và không được đưa vào đối tượng tự sinh từ ma trận. Là sản phẩm của WP-0, chỉ đọc | WP-0, WP-3 |
| D-06 | Đánh giá hình thức kết hợp trực tuyến | Như hình thức **tập trung**: bài kiểm tra theo APD.0009; người dự trực tuyến ghi trạng thái **ONLINE** (SOP 5.3.7) | WP-6 |
| D-07 | Hậu tố sau `z` | `aa`, `ab`, … (theo cách đặt tên cột bảng tính); duy nhất trong hoạt động gốc | WP-2 |
| D-08 | Ai tạo và cấp mã cho đột xuất và bên ngoài | Theo SOP 5.3.3 và lưu đồ: **bộ phận phát sinh nhu cầu**. Quyền `training.activity.organize` có phạm vi bộ phận và gán cho **bất kỳ ai được chỉ định**; QA giữ thêm `training.code.allocate` cho đào tạo ban đầu và định kỳ. Không viết cứng theo vai trò | WP-5 |
| D-09 | Người vắng có lý do | Giữ trạng thái **ABSENT** kèm **nhóm lý do** (`ANNUAL_LEAVE`, `MATERNITY`, `SICK`, `BUSINESS_TRIP`, `OTHER` + ghi chú); **không** coi là đã đào tạo; sinh danh sách bổ sung mã a, b, c. Không có trạng thái "được miễn" ở giai đoạn đầu (SOP không cho miễn) | WP-6 |
| D-10 | Giảng viên không đủ điều kiện | **Chặn** khi chọn giảng viên chưa đủ điều kiện (TR-19: có hồ sơ GMP chung **và** có hồ sơ chủ đề đó, hoặc là người soạn, kiểm tra, duyệt tài liệu, trưởng bộ phận, giám sát đã đào tạo). **Ngoại lệ** có lý do, do **người được chỉ định có quyền `training.trainer.exception.approve`** duyệt, ghi vào hoạt động | WP-5 |
| D-11 | Hạn 10 ngày | **Cảnh báo và đánh dấu quá hạn**, không chặn (SOP dùng "nên"). Việc chặn phát hành đã nằm sẵn ở bước Pending Training của Document Control | WP-7 |
| D-12 | "Tạm ngừng việc" khi không đạt | Hiện **cờ** trên hồ sơ và thông báo cho trưởng đơn vị; **không chặn** hệ thống khác ở giai đoạn đầu | WP-6 |
| D-13 | Làm bài trên máy, ngân hàng câu hỏi | **Không làm** ở giai đoạn đầu; chỉ lưu bài (tệp hoặc bản scan) và kết quả | — |
| D-14 | Ngày làm việc | Thứ Hai đến thứ Sáu trừ các ngày trong bảng `training_non_working_days` do người có `training.settings.manage` quản lý; chưa dùng Calendar vì Calendar chưa có khái niệm ngày nghỉ (cần kiểm tra khi làm WP-1) | WP-1, WP-9 |
| D-15 | Bản giao việc khi chưa xong ma trận | **Chặn**; **ngoại lệ** có lý do, do người được chỉ định có quyền `training.job_assignment.exception.approve` duyệt; ngoại lệ hiện trên bản giao việc và hồ sơ cá nhân | WP-8 |
| D-16 | Chữ ký mẫu tay | Giữ **ảnh scan** làm hồ sơ, có người xác nhận (được chỉ định); ưu tiên thấp, làm ở WP-8 | WP-8 |
| D-17 | Hủy hồ sơ sau 10 năm | **Không xóa tự động**; hệ thống chỉ **đánh dấu** hết hạn lưu giữ; việc hủy là quy trình riêng có người duyệt được chỉ định, **chưa xây** ở giai đoạn đầu | WP-9 |
| D-18 | Chuyển cơ sở | Chỉ **xuất bản sao hồ sơ** có chữ ký (SOP 5.3.11); chưa mô hình nhiều cơ sở | WP-8 |
| D-19 | Quyền `training.*` đã có | **Giữ tương thích**: bảng ánh xạ quyền cũ sang mới nằm trong migration WP-1; không xóa quyền cũ cho đến khi mọi chỗ dùng đã chuyển và QA xác nhận | WP-1 |
| D-21 | Khách tham quan, nhà thầu | Người ngoài **không tài khoản**: tên, đơn vị, ngày; ký tay có bản scan; hoạt động vẫn có mã; **không tạo hồ sơ cá nhân** (không có người) | WP-6 |
| D-22 | Ngôn ngữ giao diện | Nhãn giao diện **tiếng Anh** như các module khác; biểu mẫu in **song ngữ Việt và Anh** như biểu mẫu SOP | WP-5 |
| D-32 | Duyệt nội dung đào tạo | **Hai bước theo quyền**: xem xét (`training.content.review`) và duyệt (`training.content.approve`); người xử lý **do người gửi chỉ định** trong số người đủ điều kiện (mục 8.5). QA thống nhất lại SOP hoặc lưu đồ; thiết kế không phụ thuộc cách gọi tên | WP-5 |
| D-33 | Điều chuyển sinh đào tạo ban đầu | **Người được chỉ định có quyền `training.job_assignment.manage` xác nhận** danh sách chủ đề rồi lệnh tạo hoạt động `INITIAL` lý do `TRANSFER`; không tự gán | WP-8 |
| D-34 | Mô hình chỉ định người xử lý các bước phê duyệt | **Theo phân quyền, chỉ định bất kỳ user đủ điều kiện (chủ dự án 2026-10-16)**; mục 8.5; thêm bảng `training_approval_assignments`, `training_default_approvers` và các quyền `training.approval.*` | WP-1 (bảng, quyền), WP-3 đến WP-8 (áp dụng) |
| D-35 | Bộ phận ngưng và mã đào tạo | **ĐỀ XUẤT từ WP-0 (chờ QA):** cấp mã theo bộ phận của tài liệu kể cả khi ngưng; không cho chọn bộ phận ngưng làm đơn vị tổ chức mới | WP-5 |
| D-36 | Người đủ điều kiện được đào tạo | **ĐỀ XUẤT từ WP-0 (chờ QA):** chỉ người Active có mã nhân viên | WP-3, WP-6 |
| D-37 | Revision lịch sử khi bật tích hợp | **ĐỀ XUẤT từ WP-0 (chờ QA):** không cấp mã hồi tố; SOP.0017 ở lại MANUAL | WP-5 |

### 16.3 Giả định (xác nhận bằng dữ liệu thật ở WP-0)

1. Tài liệu nguồn của chủ đề SOP luôn là revision **hiệu lực**.
2. Một người có đúng một vị trí chính tại một thời điểm (có thể giữ thêm vị trí bổ sung qua bản giao việc dạng "bổ sung").
3. Bộ phận của tài liệu (`documents.department`) là bộ phận tổ chức đào tạo mặc định; đào tạo cho bộ phận liên quan dùng nhiều session.
4. Không có người dùng ngoài hệ thống cần đăng nhập để học (khách chỉ có tên).

### 16.4 Rủi ro chính

Ghi ở PLAN-TR-001 mục 14, thêm: (a) hồ sơ lịch sử giấy chưa số hóa nên T6 chiếm thời gian đối chiếu; (b) tách quyền theo bộ phận phụ thuộc dữ liệu bộ phận của người dùng đúng; (c) quy mô thay đổi ở Document Control (nhiều tệp) cần phân tích ảnh hưởng cẩn thận; (d) kiểm định cần người của QA tham gia thật.

---

## 17 Truy vết quy tắc đến thiết kế và kiểm thử

| Quy tắc (PLAN-TR-001 mục 6) | Thiết kế | Kiểm thử |
|---|---|---|
| TR-01 mã duy nhất `TRN/DC/YY-XXX` | 5.1, 5.2, 4.4 | Đơn vị định dạng; đồng thời 200 luồng |
| TR-02 hậu tố a, b, c, mỗi đợt một dòng | 5.3, 4.4 | Hai bổ sung cùng lúc; dòng sổ |
| TR-03 một mã nhiều chủ đề hoặc buổi | 4.4 (`training_sessions`, `training_session_topics`) | API session |
| TR-04 dời giữ mã, lý do ghi chú | 5.4, 4.4 (`training_events`) | Dời; ghi chú ở sổ |
| TR-05 ai cấp mã | 8.1 (`training.code.allocate`, `.organize`) | Ma trận quyền |
| TR-06 yêu cầu chỉ cho hằng năm và định kỳ tài liệu | 4.3 (`kind`) | Từ chối loại khác |
| TR-07 trước 31/12 | 11 (nhắc), 4.1 (mốc) | Job nhắc |
| TR-08 cuối tháng rà soát | 11, 7.1 (gợi ý) | Job nhắc |
| TR-09 dời sang tháng sau | 4.3, 5.4, 11 | Dời bắt buộc, lý do |
| TR-10 10 ngày | 6.3, 4.1, 6.4 | 14.3 ý 5, 6 |
| TR-11 danh sách thông báo trước, gồm người vắng | 3.2 (`NOTIFIED`), 4.4 | Không `notify` khi chưa xác nhận danh sách |
| TR-12 trong ngày với tài liệu mới | 11 | Job; báo quá hạn |
| TR-13 7 ngày làm việc | 11, 4.1 | Job; lịch ngày nghỉ |
| TR-14 đạt khi ≥ 70% | 4.4 (`training_assessments`), 4.1 | Biên 69,9; 70; 100 |
| TR-15 không đạt tạm ngừng, đào tạo lại | 3.3, 5.3 | Tạo hoạt động `RETRAINING`; cờ |
| TR-16 tự đọc ký APD.0108, trưởng phòng xác nhận, QA ghi hồ sơ | 3.3, 4.4, 8.4 | UAT-05 |
| TR-17 trực tuyến ghi "Trực tuyến" | 4.4 (`sign_mode = ONLINE`) | API điểm danh |
| TR-18 vắng ghi "Vắng mặt", bố trí lại | 3.3, 5.3 | Vắng ⇒ danh sách bổ sung |
| TR-19 giảng viên đủ điều kiện | 8.3 | Chặn giảng viên không đủ |
| TR-20 người ký tài liệu = đào tạo ban đầu | 6 (WP-7), 4.5 | Đầu-cuối |
| TR-21 chỉ dùng tài liệu đã duyệt | 4.4 (`training_session_topics`), `TRAINING_DOCUMENT_NOT_EFFECTIVE` | Tài liệu không hiệu lực bị từ chối |
| TR-22 nội dung được hai bên duyệt | 4.4 (`training_materials`), 8.4 | `notify` cần nội dung đã duyệt |
| TR-23 bản giao việc khi đủ ma trận | 4.5, 7.1 (eligibility) | Thiếu ⇒ `TRAINING_MATRIX_INCOMPLETE` |
| TR-24 hai chữ ký, cập nhật khi giao việc mới | 3.4, 8.4 | Chữ ký; số lần ban hành |
| TR-25 chữ ký mẫu duy nhất, duyệt trước khi dùng | 4.5 (chỉ mục duy nhất `APPROVED`) | Hai bản APPROVED ⇒ chặn |
| TR-26 lưu hồ sơ cũ cùng mới, ≥ 10 năm | 4.5, 9.5 | Trigger; `retain_until` |
| TR-27 đơn vị soạn đào tạo ở v01 | 6.2 (bộ phận tổ chức), 8.1 | Hoạt động gắn tài liệu v01 |
| TR-28 ma trận cập nhật khi tài liệu cấp 1 đến 3 mới | 3.2 (đánh giá tác động), 7.1 | Hàng Document Trainings |
| TR-29 tài liệu cấp 4 hoặc biên tập có thể không cần | 16 (D-03, D-26) | Không tick ⇒ không có đào tạo |
| TR-30 vắng trên 6 tháng, đào tạo lại | 11 (`absence_retrain_months`) | Job (khi có dữ liệu vắng) |
| TR-31 đào tạo trước khi làm | 4.5 (bản giao việc), 12 | Bản giao việc; cờ tuân thủ |

---

*Hết SDS-TR-001 phiên bản 1.0. Tài liệu này là thiết kế; nó không phải phê duyệt GMP và không tự cho phép bắt đầu viết mã: mỗi gói công việc cần quyết định của chủ dự án và hồ sơ thay đổi riêng.*

---

## 18 Cập nhật 2026-10-17: vận hành giấy và điện tử, đào tạo bên ngoài (thiết kế chi tiết)

**Trạng thái:** **ĐỀ XUẤT** (chủ dự án đã chốt nguyên tắc ở PLAN-TR-001 mục 17.1). Mục này thiết kế FE, BE, API, DB cho các hạng mục TR-32 đến TR-47 và D-38 đến D-51 của PLAN-TR-001 mục 17. Quy ước chung của mục 1, 2.3, 8, 9, 13 vẫn áp dụng; nếu mâu thuẫn thì mục 18 thắng cho phần nó nêu.

### 18.1 Nguyên tắc thiết kế

1. **Một nguồn sự thật cho mỗi dữ kiện.** Điểm danh và kết quả chỉ được ghi bằng hàm miền nghiệp vụ đã có (ghi điểm danh, ghi kết quả). Nhập hộ từ giấy **không** ghi tắt vào bảng người tham gia: nó giữ bản nhập làm bằng chứng và, khi được xác minh, gọi đúng các hàm đó trong **một giao dịch**.
2. **SOP là mặc định, ghi lại khi lệch** (PLAN 17.1.2). Mọi lựa chọn khác mặc định có `*_reason` hoặc sự kiện Audit Trail, không bị chặn.
3. **Giấy là đường hợp lệ, đủ ALCOA+.** Bản giấy gốc được giữ và có nơi lưu; bản scan có mã băm; người nhập và người xác minh khác nhau.
4. **Giới hạn và bất biến ở máy chủ.** Mọi lệnh hàng loạt có trần; mọi bảng bằng chứng bất biến sau khi chốt.

### 18.2 Cơ sở dữ liệu (Flyway, chỉ thêm, idempotent; số phiên bản gán khi làm, sau V614)

| Đối tượng | Thay đổi | Ghi chú |
|---|---|---|
| `training_sessions` | thêm `delivery_mode VARCHAR(10) NOT NULL DEFAULT 'ELECTRONIC'` CHECK `ELECTRONIC`, `PAPER`, `MIXED`; `assessment_method` thêm giá trị `OBSERVATION`; cho phép `NULL` cho `method` và `assessment_method` khi hoạt động là `EXTERNAL` | Bảng đã có `location_type` (V613) |
| `training_activities` | thêm `training_unit_name VARCHAR(255)`, `vendor_ref VARCHAR(120)` | Bắt buộc `training_unit_name` khi `kind = 'EXTERNAL'` (kiểm ở máy chủ khi Notify) |
| `training_participants` | `sign_mode` thêm `TRAINER_ATTESTED` | Điểm danh nhanh do giảng viên xác nhận |
| `training_paper_evidence` | `kind` thêm `CERTIFICATE` | Chứng chỉ của đào tạo bên ngoài |
| `training_records` | `result` thêm `ATTENDED`; `source` thêm `SIGNATORY_INITIAL` | D-43, D-45 |
| `training_paper_packs` (mới) | `id`, `activity_id`, `session_id` (null = cả hoạt động), `pack_code` (duy nhất), `kind` (`ATTENDANCE_LIST`, `SELF_READING_LIST`, `ASSESSMENT_FORMS`, `FULL`), `copy_no`, `page_count`, `sha256`, `provider`, `stored_path`, `printed_by`, `printed_at`, `reason` | **Bất biến** (trigger); `reason` bắt buộc khi `copy_no > 1`; chỉ mục `(activity_id, printed_at)` |
| `training_transcriptions` (mới) | `id`, `activity_id`, `session_id`, `evidence_id` (bắt buộc, trỏ `training_paper_evidence`), `kind` (`ATTENDANCE`, `RESULT`, `SELF_READING`), `status` (`ENTERED`, `VERIFIED`, `RETURNED`, `SUPERSEDED`), `performed_on`, `late_reason`, `entered_by`, `entered_at`, `verified_by`, `verified_at`, `verify_signature_id`, `return_reason`, `supersedes_id`, `idempotency_key` | Duy nhất `(entered_by, idempotency_key)`; chỉ mục `(session_id, status)`; sau `VERIFIED` hoặc `SUPERSEDED` không sửa (trigger) |
| `training_transcription_lines` (mới) | `transcription_id`, `participant_id`, `attendance` (`ATTENDED`, `ONLINE`, `ABSENT`), `score_obtained`, `score_max`, `remarks` | Duy nhất `(transcription_id, participant_id)`; bất biến cùng bản nhập |
| `training_prep_tasks` (mới) | `id`, `activity_id`, `session_id`, `kind` (`VENUE_EQUIPMENT`, `PRACTICAL_EQUIPMENT`, `INFORM_PARTICIPANTS`), `department_id`, `status` (`OPEN`, `DONE`, `NOT_NEEDED`), `due_on`, `done_by`, `done_at`, `remark` | Duy nhất `(session_id, kind, department_id)` |
| `training_copy_distributions` (mới) | `id`, `object_type`, `object_id`, `department_id`, `sent_by`, `sent_at`, `received_by`, `received_at`, `remark` | Chỉ thêm; việc nhận là một cập nhật có ghi người và giờ (trigger cho phép đúng một lần) |
| `training_export_batches` (mới) | `id`, `department_id`, `year`, `person_count`, `status` (`PREPARED`, `APPROVED`, `GENERATING`, `READY`, `FAILED`), `prepared_by`, `approved_by`, `sha256`, `provider`, `stored_path`, `created_at` | Dựa trên mô hình `training_record_exports` (hai chữ ký, bản bất biến) |
| `training_settings` | thêm `late_entry_working_days` (mặc định 1), `max_batch_people` (200), `pack_async_threshold_pages` (100) | Có lý do khi đổi, như các cài đặt hiện có |

**Khóa bất biến:** `training_paper_packs`, `training_transcriptions` (sau chốt), `training_transcription_lines`, `training_copy_distributions` dùng cùng hàm trigger bất biến như các bảng bằng chứng hiện có.

### 18.3 API (tiền tố `/training`; đều đi qua quy trình ghi lệnh mục 2.3)

| Nhóm | Điểm cuối | Quyền | Ghi chú |
|---|---|---|---|
| Chế độ buổi | `POST /sessions/{id}/delivery-mode` `{mode, reason}` | `.organize` | Lý do bắt buộc khi đổi sau Notify |
| Gói giấy | `GET /activities/{id}/paper-packs`; `POST /activities/{id}/paper-packs` `{sessionId?, kind, reason?}`; `GET /paper-packs/{id}/download` | `training.paper.print` | Tạo PDF; > ngưỡng trang thì chạy nền và trả `202` kèm `GET /jobs/{id}`; mỗi lần tải ghi Audit Trail |
| Điểm danh nhanh | `POST /sessions/{id}/roll-call` `{lines:[{participantId,state}]}` | `training.activity.conduct` | Tối đa 500 dòng; ghi `TRAINER_ATTESTED` |
| Nhập hộ | `POST /sessions/{id}/transcriptions` (`Idempotency-Key`); `GET /sessions/{id}/transcriptions`; `POST /transcriptions/{id}/return` `{reason}`; `POST /transcriptions/{id}/verify` `{signatureToken}` | `training.paper.transcribe`; `training.paper.verify` | `verify` áp dụng các dòng vào điểm danh và kết quả trong một giao dịch |
| Việc chuẩn bị | `GET/POST /activities/{id}/prep-tasks`; `POST /prep-tasks/{id}/done` | `.organize` (tạo), người thuộc đơn vị nhận (xong) | Thông báo cho đơn vị nhận |
| Phân phối bản sao | `POST /distributions`; `POST /distributions/{id}/receive` | `training.distribution.manage` | Người nhận thuộc đơn vị đích |
| Xuất theo lô | `POST /export-batches`; `POST /export-batches/{id}/approve`; `GET /export-batches/{id}/download` | `training.record.export` (và duyệt) | Trần `max_batch_people`; hai người khác nhau |
| Bên ngoài | các lệnh tạo và sửa hoạt động nhận `trainingUnitName`, `vendorRef` | `.organize` | |
| Chuyển vị trí | `GET /persons/{id}/transfer-review?toPositionId=` | `training.activity.organize` | So hồ sơ với ma trận vị trí mới |

**Mã lỗi ổn định mới:** `TRAINING_PACK_REASON_REQUIRED`, `TRAINING_PACK_TOO_LARGE`, `TRAINING_TRANSCRIPTION_EVIDENCE_REQUIRED`, `TRAINING_TRANSCRIPTION_LATE_REASON_REQUIRED`, `TRAINING_VERIFIER_SAME_AS_ENTERER`, `TRAINING_VERIFIER_IN_LINES`, `TRAINING_TRANSCRIPTION_INVALID_TRANSITION`, `TRAINING_BATCH_TOO_LARGE`, `TRAINING_DELIVERY_MODE_INVALID`, `TRAINING_UNIT_REQUIRED`, `TRAINING_ROLLCALL_TOO_LARGE`. Giao diện chỉ hiện câu đã dịch, không hiện mã.

### 18.4 Phân quyền, tách nhiệm vụ, chữ ký điện tử

| Quyền mới | Ý nghĩa | Gợi ý gán (không gán tự động khi migration) |
|---|---|---|
| `training.paper.print` | In gói hồ sơ giấy | Người tổ chức, thư ký đơn vị, HCNS |
| `training.paper.transcribe` | Nhập hộ kết quả từ giấy | Thư ký đơn vị, HCNS, giảng viên |
| `training.paper.verify` | Xác minh bản nhập | QA, trưởng đơn vị |
| `training.distribution.manage` | Gửi và nhận bản sao | QA, trưởng đơn vị |

- **Tách nhiệm vụ** (kiểm ở máy chủ): người xác minh khác người nhập; người xác minh không có tên trong các dòng của bản nhập; người chuẩn bị xuất theo lô khác người duyệt; giảng viên điểm danh nhanh không tự xác minh bản nhập của chính buổi đó.
- **Chữ ký điện tử mới:** `TRAINING_TRANSCRIPTION_VERIFIED` (xác minh bản nhập), `TRAINING_EXPORT_BATCH_PREPARED`, `TRAINING_EXPORT_BATCH_APPROVED`. Việc nhận bản sao và hoàn thành việc chuẩn bị dùng xác thực phiên và Audit Trail, không bắt chữ ký (không phải điểm dữ liệu GMP).
- **Không xung đột chức năng:** điểm danh và kết quả có hai đường vào (màn Conduct trực tiếp, nhập hộ đã xác minh) nhưng **cùng một hàm miền nghiệp vụ**; mọi cập nhật trực tiếp vào bảng người tham gia từ giao diện bị cấm. Một dòng đã có điểm danh không nhập hộ lần thứ hai; muốn sửa phải theo quy trình sửa sai ở mục 9.3 (bản mới thay thế, bản cũ giữ).

### 18.5 Audit Trail (thêm vào mục 9.1)

`TRAINING_PAPER_PACK_PRINTED` (kèm số bản và lý do in lại), `TRAINING_DELIVERY_MODE_CHANGED`, `TRAINING_ROLLCALL_RECORDED`, `TRAINING_TRANSCRIPTION_ENTERED`, `TRAINING_TRANSCRIPTION_RETURNED`, `TRAINING_TRANSCRIPTION_VERIFIED`, `TRAINING_PREP_TASK_DONE`, `TRAINING_COPY_SENT`, `TRAINING_COPY_RECEIVED`, `TRAINING_EXPORT_BATCH_PREPARED`, `TRAINING_EXPORT_BATCH_APPROVED`, `TRAINING_EXPORT_BATCH_DOWNLOADED`, `TRAINING_MATERIAL_PREVIEWED`, `TRAINING_PARTICIPANT_REMOVED`, `TRAINING_PLANNED_ABSENCE_SET`. Mỗi sự kiện ghi người thực hiện, thời điểm máy chủ, đối tượng, giá trị cũ và mới khi có, lý do khi có.

### 18.6 Giao diện

**Quy tắc chung** (PLAN 17.5): tái sử dụng `components/ui`; cùng khuôn danh sách (thẻ lọc + bảng, có `No.`); cùng class trường nhập với Document Control; mỗi việc một màn; tên chức năng làm tiêu đề và breadcrumb; **responsive**: dưới 1024px bảng thao tác chính chuyển sang thẻ, nút từ 36px trở lên, lưới nhập dùng được bằng cảm ứng; có kiểm tra ảnh chụp ở 375, 768 và 1280px.

| Màn hoặc khu vực | Nội dung |
|---|---|
| Tab **Paper & Entry** (màn Conduct; chỉ xem ở màn Details) | (1) Chế độ buổi: radio Electronic, Paper, Mixed (RadioGroup) với giải thích ngắn. (2) **In gói hồ sơ giấy**: chọn session và loại, danh sách các gói đã in (số bản, người in, giờ), nút in và nút in lại (hỏi lý do). (3) **Điểm danh nhanh**: thẻ lớn một người một dòng, chạm để đổi Có mặt, Trực tuyến, Vắng mặt. (4) **Nhập hộ từ giấy**: chọn hoặc tải bản scan (có thanh tiến độ), lưới nhập điểm danh và điểm, ngày thực hiện, lý do nhập muộn khi cần, nút Gửi xác minh. (5) **Hàng chờ xác minh** cho người có quyền: xem bản nhập cạnh bản scan, Verify (chữ ký điện tử) hoặc Return (lý do). |
| Màn Edit | Mục "Preparation" với danh sách việc chuẩn bị (đơn vị nhận, hạn, trạng thái); khối Training unit và Vendor khi Type = External; ẩn Method và Assessment khi External. |
| Tab Participants | Bảng đổi cột theo hình thức: APD.0117 hoặc APD.0108 (tự đọc); cột "Ký tên" in và hiện đúng chữ Vắng mặt, Trực tuyến theo SOP 5.3.7. |
| Màn Transfer review (mới) | So sánh hồ sơ hiện có của người với ma trận vị trí mới; chọn các chủ đề cần đào tạo; nút tạo hoạt động. |
| Màn Distribution log (mới, nhóm Records & Compliance) | Danh sách bản sao đã gửi và đã nhận theo đơn vị; thao tác nhận. |
| Màn Record Exports | Thêm tab hoặc lệnh "Batch export" theo bộ phận và năm. |
| Màn Non-working days (Settings > Training Administration) | CRUD ngày nghỉ có lý do; chỉ thêm và vô hiệu, không xóa vật lý. |

### 18.7 Bảo mật và hiệu năng (chịu tải, hạn chế lỗi, chống tấn công)

1. **Trần mọi lệnh hàng loạt:** điểm danh nhanh và nhập hộ tối đa 500 dòng; người ngoài tối đa 100 mỗi lệnh; một gói in tối đa 300 người; một lô xuất tối đa `max_batch_people`. Vượt trần thì từ chối bằng mã ổn định, không cắt âm thầm.
2. **Idempotency:** lệnh nhập hộ và tạo gói nhận `Idempotency-Key`; gửi lại cùng khóa trả cùng kết quả, không tạo bản nhập thứ hai (an toàn khi mạng chập chờn hoặc bấm đúp).
3. **Giao dịch ngắn, khóa theo thứ tự:** xác minh khóa các dòng người tham gia theo thứ tự `id` để tránh deadlock; kiểm tra `version` (khóa lạc quan); hai người cùng xác minh một bản chỉ một người thành công, người kia nhận `TRAINING_TRANSCRIPTION_INVALID_TRANSITION`.
4. **Tạo PDF nặng chạy nền:** quá ngưỡng trang thì tạo trong hàng đợi có giới hạn đồng thời; trả `202` và theo dõi bằng việc nền; giao diện hiện tiến độ; kết quả lưu bản bất biến có mã băm; không giữ tệp lớn trong bộ nhớ yêu cầu.
5. **Tệp tải lên:** như hiện có (giới hạn kích thước theo loại, kiểm tra nội dung đúng đuôi, quét virus, SHA-256, kiểm tra lại mã băm khi tải); không bao giờ trả đường dẫn lưu trữ.
6. **Truy cập đối tượng:** mọi điểm cuối kiểm quyền và phạm vi bộ phận ở máy chủ cho **từng** đối tượng được nêu theo id (chống IDOR); trả cùng một lỗi cho "không tồn tại" và "không có quyền" ở các điểm cuối bằng chứng; không liệt kê id.
7. **Tốc độ và lạm dụng:** các điểm cuối nặng (in gói, xuất lô, nhập hộ, tìm người) đi qua bộ giới hạn tốc độ sẵn có theo người dùng; tìm kiếm có trần kết quả và độ dài từ khóa; mọi tham số lọc dùng truy vấn tham số hóa.
8. **Hiệu năng truy vấn:** chỉ mục ở 18.2; danh sách phân trang ở máy chủ; không N+1 (khả năng theo dòng được tính theo lô như danh sách hoạt động); thống kê nặng tính theo yêu cầu có trần thời gian.
9. **Nhật ký không chứa dữ liệu cá nhân thừa** (không ghi mật khẩu, mã chữ ký, nội dung scan); lỗi trả cho người dùng là câu đã dịch, không là dấu vết ngăn xếp.
10. **Chữ ký:** mã chữ ký dùng một lần, gắn với hành động và đối tượng, hết hạn ngắn (như hiện có).

### 18.8 Kiểm thử (thêm vào mục 14)

| Lớp | Bắt buộc |
|---|---|
| Đơn vị và API | Cặp chế độ buổi; đủ điều kiện nhập hộ (có scan, lý do nhập muộn); người xác minh trùng người nhập hoặc có tên trong dòng; áp dụng dòng đúng một lần; sinh hồ sơ cá nhân đúng sau xác minh; trần mọi lệnh; idempotency; gói in có Training Number mỗi trang, số trang đúng, bộ đếm bản in, lý do in lại |
| Đồng thời | Hai người xác minh cùng lúc; hai lần bấm gửi cùng khóa; đang xác minh thì có người ghi điểm danh trực tiếp cho cùng người |
| Bảo mật | IDOR theo id bản nhập, gói, tệp; ngoài phạm vi bộ phận; thiếu quyền; tệp sai đuôi; quét virus; nội dung đáng ngờ trong tên tệp và lý do (XSS) |
| Dữ liệu | Migration chạy hai lần; trigger bất biến chặn sửa và xóa; mã băm khớp khi tải |
| Giao diện | Ảnh chụp 375, 768, 1280px cho Paper & Entry, Participants, Conduct; thao tác bằng cảm ứng; bàn phím và nhãn truy cập; tiêu đề và breadcrumb đúng tên chức năng |
| UAT | Kịch bản phòng sạch: in gói, tiến hành bằng giấy, scan, nhập hộ, xác minh, hồ sơ cá nhân sinh đúng; kịch bản phòng họp: điểm danh nhanh bằng một thiết bị |

### 18.9 Thứ tự làm và bằng chứng

Theo PLAN-TR-001 mục 17.8: WP-EXT, WP-OBS, WP-PAPER (in gói rồi nhập hộ), WP-PREP, WP-DIST, WP-XFER, WP-DAYS. Mỗi gói dùng một bản ghi thay đổi theo `08_ONE_CHANGE_RECORD_TEMPLATE.md`, phân tích tác động GitNexus trước khi sửa ký hiệu mã, và bằng chứng âm tính, đồng thời, lỗi theo mức rủi ro. Mục này không phải phê duyệt GMP và không thay quyết định của QA ở PLAN-TR-001 mục 17.7.

### 18.10 Bố cục bản in theo biểu mẫu gốc (từ PLAN-TR-001 mục 17.10)

Mọi bản in giấy lấy bố cục từ **file Word gốc**, không từ bản Markdown (Markdown có thể mất ô gộp): APD.0117 sáu phần và Page x/y; APD.0009 với chân trang mỗi trang gồm số đào tạo và ô ký học viên, hai mẫu TH1 và TH2; APD.0108 theo từng tài liệu kèm phần xác nhận của trưởng phòng; FRM.0007 với hai chữ ký mẫu; APD.0024 với hai trường hợp; APD.0014 không có vị trí, có trình độ chuyên môn và ngày vào công ty; APD.0011 và APD.0118 như bản in hiện có (APD.0118 đã đủ loại, ngày thực hiện, chữ ký QA và nhận xét). Hai thay đổi dữ liệu kèm theo: `training_specimen_signatures` thêm ảnh chữ ký thứ hai (`second_object_key`, `second_sha256`); nơi lưu `qualification` và `joined_on` của nhân viên (D-53).

### 18.11 Matrix: lưới mức hoàn thành theo vị trí (từ PLAN-TR-001 mục 17.11)

**Cơ sở dữ liệu:** không thêm bảng. Trạng thái ô được **tính** từ `training_matrix_rows`, `training_matrix_cells`, `training_person_positions`, `training_records` (bỏ bản ghi có `training_record_voids`), `training_participants` và `training_activities`, cộng phiên bản tài liệu hiệu lực từ Document Control. Chỉ mục cần kiểm: `training_records(person_user_id, document_id, topic_text)`, `training_person_positions(position_id)` với `valid_to is null`, `training_participants(person_user_id, activity_id)`.

**API**

| Điểm cuối | Quyền | Ghi chú |
|---|---|---|
| `GET /training/matrix-completion?departmentId=&positionId=&search=&status=&page=&limit=&columnPage=&columnLimit=` | `training.compliance.view` | Trả hàng (nhân viên, phân trang tối đa 100), cột (hàng ma trận của vị trí, tối đa 30 mỗi trang cột), ô `{rowId, personId, status, lastDoneOn, activityId?}`, và tóm tắt mỗi người `{done, required, eligibleForAssignment}` |
| `GET /training/matrix-completion/cell?personId=&rowId=` | như trên | Chi tiết một ô: lần đào tạo gần nhất, hạn, hoạt động đang mở, phiên bản tài liệu đã và cần đào tạo |
| `GET /training/persons/{id}/transfer-review?toPositionId=` | `training.activity.organize` | Cùng bộ tính trạng thái, cho một người và một vị trí đích (TR-45) |
| `GET /training/matrix-completion/print?...` | `training.record.export` | PDF có kiểm soát (mục 17.3): trạng thái bằng chữ, không chỉ màu; ghi Audit Trail |

Phạm vi bộ phận kiểm ở máy chủ như các màn hiện có. Tham số lọc dùng truy vấn tham số hóa; `limit` và `columnLimit` bị chặn ở trần.

**Quy tắc trạng thái (máy chủ)**, theo thứ tự ưu tiên: `NOT_REQUIRED` (ma trận không có ô cho vị trí hoặc tài liệu xác nhận không cần đào tạo) → `IN_PROGRESS` (có tên trong hoạt động mở cho chủ đề) → `QUALIFIED` (có hồ sơ hợp lệ cho phiên bản hiệu lực và chưa đến hạn hằng năm) → `UPDATE_NEEDED` (chỉ có hồ sơ cho phiên bản cũ) → `DUE` (cờ hằng năm hoặc định kỳ đã đến hạn) → `REQUIRED`. Sáu trạng thái có mã ổn định; nhãn hiển thị tách khỏi mã (D-58). Tính theo lô (tập hợp), không truy vấn từng ô, không N+1.

**Giao diện**
- Màn Training Compliance có hai tab: **Matrix completion** (lưới) và **Gap list** (danh sách hiện có). Lưới dùng `DataTable` có hai cột đầu cố định, cột chủ đề có tiêu đề ngắn (mã và tên rút gọn), chú giải ở dưới, dòng "x nhân viên, y chủ đề".
- Ô có biểu tượng và chữ; bấm mở ngăn kéo (`drawer`) với chi tiết và liên kết tới hoạt động. Không có sửa trực tiếp trên lưới.
- Bộ lọc: Department, **Position (bắt buộc để hiện lưới)**, Status, nút Gap analysis, Search; bố cục như các danh sách khác.
- Điện thoại: dạng thẻ theo nhân viên; máy tính bảng: lưới cuộn ngang có cột cố định.
- Màn **Matrix Version** (định nghĩa): thêm ba nhóm hàng, cột "Annual", nhóm vị trí "Management Personnel", cột cố định, tìm và lọc hàng.

**Kiểm thử bắt buộc:** từng trạng thái ô với dữ liệu mẫu; hồ sơ bị void không tính; nâng phiên bản chuyển `QUALIFIED` sang `UPDATE_NEEDED`; người ngoài phạm vi bộ phận không thấy; trần số hàng và cột; hiệu năng với khoảng 500 nhân viên; bản in có chữ cho mọi trạng thái; ảnh chụp 375, 768, 1280px.

---

## Trạng thái triển khai (cập nhật 2026-10-16)

Đã làm trên DEV (chưa commit): V594 đến V598; số Training Number theo revision và tích hợp Document Control (đăng ký số khi lưu, mở hạn khi revision được duyệt, Complete Training lấy ngày từ Training); vòng đời hoạt động đầy đủ (phiên, người tham gia, điểm danh, chấm bài do máy chủ tính, tự đọc, xác nhận QA, hồ sơ cá nhân bất biến, đào tạo bù với hậu tố); chỉ định người xử lý theo quyền (chung cho hoạt động, phiên bản ma trận, bản giao việc); ma trận có phiên bản và khóa bất biến; bản giao việc có ngoại lệ do người được chỉ định duyệt; màn tuân thủ; sổ cấp mã; thiết lập; chủ đề; vị trí người dùng. UI thử cũ đã xóa.

Đã làm thêm: bản giao việc (V598), chữ ký mẫu (V599), xuất PDF hồ sơ APD.0014 (V602), thông báo trong ứng dụng và e-mail cùng nhắc việc hằng ngày có khóa chống gửi trùng (V604). Đã làm thêm: phiếu yêu cầu đào tạo APD.0118 (V605, ba chữ ký, khóa sau duyệt, mở đào tạo từ dòng, dời tháng, QA ký dòng). Đã làm thêm: tải tài liệu đào tạo và bản scan giấy có quét virus, mã băm, người thứ hai đối chiếu (V606). Đã làm thêm: kiểm tra giảng viên đủ điều kiện TR-19 và ngoại lệ (V609), đề xuất người tham gia từ ma trận. Quy tắc giảng viên đang áp dụng là ĐỀ XUẤT chờ QA xác nhận (D-10): đã đào tạo GMP VÀ, với từng chủ đề, đã đào tạo chủ đề đó HOẶC tham gia tài liệu (người soạn, đồng soạn, kiểm tra, duyệt) HOẶC là trưởng bộ phận tổ chức; giảng viên bên ngoài không bị đánh giá ở đây. Đã làm thêm: bằng chứng đào tạo của tài liệu nhập cũ (V610). Chưa làm: màn ngày nghỉ; vô hiệu hồ sơ qua bước chỉ định; kiểm thử đơn vị (mới có kịch bản API). Mọi mục "Đề xuất" trong tài liệu này vẫn chờ QA xác nhận.

---

## Trạng thái triển khai (cập nhật 2026-10-17)

Đã làm thêm trên DEV (chưa commit) kể từ bản 2026-10-16: V611 (mục đích tệp: nội dung, đề, đáp án), V612 (liên kết làm tài liệu), V613 (địa điểm buổi: tại chỗ hoặc trực tuyến), V614 (đánh dấu vắng trước buổi). Giao diện: màn Training Activity tách theo việc (Details chỉ xem; Edit, Conduct, Review, Approve, Confirm, Participate) kèm menu Action theo trạng thái do máy chủ tính; trang tạo mới có tab; vùng làm việc Participants năm nguồn (ma trận, Business Unit, Department, Individual, người ngoài nhiều dòng), đánh dấu vắng, bỏ người trước khi xác nhận danh sách; tab Training Materials (tệp hoặc liên kết, MP4 đến 100 MB), tab Assessment (đề và đáp án chỉ PDF hoặc DOCX; đáp án chỉ người tổ chức và người được chỉ định xem), xem trước PDF bằng thư viện PDF và DOCX bằng viewer OnlyOffice (không tự chuyển đổi), thanh tiến độ tải lên; form Session có Instructor (nội bộ hoặc bên ngoài) và Location Type; cách đánh giá theo hình thức là mặc định, chọn khác được (D-41); in PDF ma trận (APD.0011) và phiếu yêu cầu (APD.0118); danh sách Matrices và Number Register theo khuôn danh sách chung, phân trang ở máy chủ; menu nhóm lại với tên chức năng; tên hiển thị hình thức và cách đánh giá theo chữ của SOP.

Lô làm thêm 2026-10-17 (V616, V617), DEV, chưa commit: (a) lưới mức hoàn thành ma trận theo vị trí: `TrainingMatrixCompletionService`, `GET /training/compliance/matrix-completion` và `/positions`; mỗi ô do máy chủ tính từ hồ sơ cá nhân không bị hủy, hoạt động đang mở và revision hiệu lực (Not required, Required, In progress, Qualified, Update needed, Annual training due); vượt 300 người hoặc 200 hàng thì trả `TRAINING_MATRIX_TOO_LARGE` thay vì cắt; tên nhãn trạng thái là đề xuất (D-58). (b) V616: `training_sessions.delivery_mode`, bảng bất biến `training_paper_packs`, quyền `training.paper.print`; `TrainingPaperService` in PDF bằng PDFBox, mỗi lần in được ghi (mã gói, số bản, số trang, SHA-256, người in) cùng Audit Trail. (c) V617: `training_transcriptions` và dòng, quyền `training.paper.transcribe` và `training.paper.verify`, ý nghĩa chữ ký `TRAINING_TRANSCRIPTION_VERIFIED`; người kiểm tra khác người nhập, dòng chỉ được áp dụng khi đã ký, và được áp dụng qua đúng luật điểm danh và chấm điểm của màn hình. Chưa kiểm chứng: chưa gọi API có đăng nhập (không có mật khẩu DEV trong phiên), chưa chạy GitNexus `detect_changes`, chưa có kiểm thử đơn vị cho ba dịch vụ mới; chưa cấp quyền mới cho vai trò nào.

Lô làm thêm 2026-10-17 (V618), DEV, chưa commit: điểm danh nhanh (`TrainingRollCallService`, `POST /training/sessions/{id}/roll-call`; người đào tạo ký một lần với ý nghĩa `TRAINING_ATTENDANCE_CONFIRMED`, mỗi dòng đi qua đúng luật điểm danh của màn hình rồi mang `sign_mode = TRAINER_ATTESTED`; chỉ người còn ở trạng thái INVITED); gói in giấy có sáu phần APD.0117; bản in danh sách mức hoàn thành theo vị trí (`GET /training/compliance/matrix-completion/print`, ghi Audit Trail); thẻ cho màn hình hẹp ở lưới hoàn thành; ngày nghỉ của nhà máy (`training_non_working_days`, `TrainingCalendarService`, thêm hoặc xóa cần quyền `training.settings.manage` và lý do, vào Audit Trail) dùng cho quy tắc nhập trễ. Chưa kiểm chứng: như lô trước, chưa có kiểm thử có đăng nhập, chưa có kiểm thử đơn vị, chưa chạy GitNexus.

Lô làm thêm 2026-10-17 (V619, V620), DEV, chưa commit: V619 đổi cột `training_activities.title` thành `training_title` (Training Title) và các trường API tương ứng thành `trainingTitle`. V620: `training_session_preparation` (việc chuẩn bị từng buổi, `TrainingPreparationService`, chỉ cảnh báo) và `training_copy_distributions` (nhật ký phân phối bản sao, `TrainingCopyService`, bản ghi gửi và nhận không sửa được; người nhận phải thuộc bộ phận nhận). Chưa kiểm chứng: như các lô trước, chưa có kiểm thử có đăng nhập và kiểm thử đơn vị.

Lô làm thêm 2026-10-18 (V621), DEV, chưa commit: `training_record_export_batches` và `TrainingRecordExportBatchService` (xuất hồ sơ cá nhân theo bộ phận và năm; hai chữ ký của hai người khác nhau; ZIP lưu bất biến kèm SHA-256; chạy trong lúc duyệt, giới hạn 150 người; các bản chờ ký hiện trong tab "Waiting for my signature"); màn Record Exports có hai tab "One person" và "Department and year". APD.0014 nay in thêm Qualification (học vấn cao nhất trong hồ sơ người dùng) và Joined the company (ngày bắt đầu làm việc) lấy từ dữ liệu hiện có, không thêm cột. Chưa kiểm chứng: như các lô trước.

Lô làm thêm 2026-10-18 (V622, V623) và kiểm thử có đăng nhập, DEV: (a) V622: chữ ký mẫu có hai ảnh, ảnh thứ hai bắt buộc với phiên bản mới (phiên bản cũ chỉ có ảnh thứ nhất); xem ảnh theo `?which=1|2`, mỗi lần mở ghi Audit Trail. (b) V623: khi revision tài liệu được duyệt, người đã ký (PREPARED, SUBMITTED_FOR_REVIEW, REVIEWED, APPROVED) được ghi hồ sơ nguồn `SIGNATORY_INITIAL`, mỗi người một lần cho mỗi hoạt động. (c) Sửa lỗi: câu lệnh thêm buổi đào tạo thiếu một dấu `?` sau khi thêm địa điểm (V613) nên không thêm được buổi; và bảng `training_non_working_days` đã có từ V594 với cột `reason`, dịch vụ nay dùng cột đó làm tên ngày nghỉ. **Đã chạy thử qua API bằng tài khoản `admin`, `approver.test1`, `user.a.test`, `dco.test1`** (mật khẩu không ghi vào tài liệu): tạo hoạt động, thêm buổi và người tham gia, chế độ giao Paper, danh sách chuẩn bị, xác nhận danh sách, duyệt nội dung bằng chữ ký, thông báo, in gói giấy (lần đầu và in lại có lý do; in lại không lý do bị từ chối), giữ buổi, điểm danh nhanh (ghi `TRAINER_ATTESTED`; điểm danh lại bị từ chối), tải bản quét, nhập từ giấy (lặp cùng khóa trả cùng bản ghi; bản thứ hai khi còn một bản chờ bị từ chối; người nhập tự xác minh bị từ chối; người khác ký thì điểm được áp dụng), chấm điểm, QA xác nhận hoàn thành và tạo hồ sơ, lưới hoàn thành và bản in theo vị trí, xuất theo lô (người chuẩn bị tự duyệt bị từ chối; người khác duyệt thì có ZIP gồm hai PDF), nhật ký bản sao (gửi, nhận đúng bộ phận, người bộ phận khác bị từ chối, nhận lần hai bị từ chối), ngày nghỉ (thêm, trùng bị từ chối, cuối tuần bị từ chối, xóa), chữ ký mẫu hai ảnh (một ảnh bị từ chối). **Chưa chạy thử:** hồ sơ người ký tài liệu (chỉ chạy thử câu lệnh SQL trong giao dịch rồi hủy), thao tác trên giao diện, kiểm thử đồng thời, kiểm thử đơn vị.

Lô làm thêm 2026-10-18 (V624, V625), DEV, theo ủy quyền của chủ dự án ("phần mềm chỉ hỗ trợ, phải kết hợp quy trình thủ công"): (a) TR-52, APD.0009: `TrainingExamPackService` in bộ đề cho từng học viên, mỗi người một trang bìa và các trang của đề đã duyệt dạng PDF có chân trang Training Number, tên và chỗ ký; file đã duyệt không bị sửa; đề DOCX bị từ chối với hướng dẫn in từ Word (không chuyển đổi); mỗi lần in có số bản, lần in lại cần lý do, ghi SHA-256 của đề và của bản in (V624, `pack_kind`). (b) TR-36, SOP.0003 5.3.6: `qaList` trong chi tiết hoạt động và nhắc việc theo ngày; không chặn. (c) TR-32, TR-34, TR-45: phiếu "Training Reviews" (V625, `TrainingPersonnelReviewService`): nhân viên mới (ba phần đào tạo ban đầu, chữ ký mẫu, bản giao việc), trở lại sau vắng trên 6 tháng, chuyển bộ phận, chuyển cơ sở; danh mục việc theo SOP, mỗi việc Done hoặc Not needed (kèm lý do), liên kết với hoạt động đào tạo đã tổ chức (người đó phải có tên trong danh sách), đóng bằng chữ ký của người không phải nhân viên; hệ thống không có dữ liệu nghỉ phép nên không tự phát hiện, người dùng mở phiếu. (d) SOP.0025: không có danh sách nhà cung cấp trong hệ thống nên chỉ có cảnh báo trên màn hình đào tạo bên ngoài khi trống ô Vendor reference. Chưa kiểm chứng: như các lô trước.

Bổ sung cùng ngày theo đề xuất được chủ dự án đồng ý: (e) nút "Create training" ở mỗi việc cần đào tạo trong phiếu Training Reviews: tạo hoạt động đào tạo đột xuất (lý do theo sự kiện của phiếu) cho bộ phận của người thao tác, đặt tên theo việc và nhân viên, và liên kết ngay vào việc; buổi và danh sách được làm ở màn hình hoạt động; mỗi việc chỉ liên kết một lần (409). (f) Training Compliance: ô "Open training reviews" ở tab Summary và nhãn "Review open" cạnh người có phiếu đang mở ở tab Matrix completion. (g) Gợi ý nhân viên mới: danh sách ở màn Training Reviews những người bắt đầu làm việc trong 60 ngày qua (`start_date` trong hồ sơ người dùng) chưa có phiếu nhân viên mới; chỉ là nhắc, không phải quy tắc.

**Chưa làm (xem PLAN-TR-001 mục 17.2, 17.8 và 17.11):** chân trang APD.0009 theo từng học viên, đào tạo bên ngoài (trường đơn vị đào tạo, nhãn Active và Passive, chứng chỉ), `OBSERVATION`, cột APD.0108, việc chuẩn bị (5.3.6), phân phối bản sao, xuất hồ sơ theo lô, Transfer review, hồ sơ đào tạo ban đầu của người ký, màn ngày nghỉ, màn nhật ký thông báo; kiểm thử đơn vị (hiện chỉ có kịch bản API và chạy tay); các quyết định D-38 đến D-51 chờ QA xác nhận; mô hình "Course" chưa được chủ dự án quyết định.

**Lô làm thêm 2026-10-17 (V615):** `OBSERVATION` cho đào tạo thực hành; hoạt động `EXTERNAL` có `training_unit_name` và `vendor_ref`, buổi không có method và assessment, giảng viên bên ngoài tùy chọn, không bước xem xét và duyệt nội dung, bằng chứng loại `CERTIFICATE`, người đã tham dự ghi nhận hoàn thành và hồ sơ cá nhân có kết quả `ATTENDED`; `training_participants.read_confirmed_at` cho cột "ngày đọc hiểu" của APD.0108 (bảng người tham gia đổi cột khi buổi là tự đọc); lưới ma trận định nghĩa (ba nhóm hàng, cột "Annual", hai cột đầu cố định, tìm kiếm). Bản in APD.0118 đã đủ loại, ngày thực hiện, chữ ký và nhận xét QA; bản xuất APD.0014 đã bỏ vị trí. Xem PLAN-TR-001 mục 17.8 cho phần còn lại.

Lô 2026-10-20 (V628), DEV: bài kiểm tra trực tuyến (APD.0009 dạng số). Người soạn viết câu hỏi cùng nội dung (một đáp án, nhiều đáp án, đúng/sai; tối đa 100 câu; giới hạn thời gian tùy chọn); người soát xét và phê duyệt thấy đáp án; sau khi nội dung được duyệt không sửa được. Học viên chỉ làm bài sau khi giảng viên điểm danh có mặt, không bao giờ nhận đáp án, ký điện tử khi nộp (meaning TRAINING_ASSESSMENT_SIGNED); máy chủ chấm điểm và ghi `training_assessments` (method TEST). Mỗi học viên một lần làm; giảng viên giải phóng thêm lần làm kèm lý do, ghi Audit Trail (`training_exam_resets`). Hết giờ có thêm 60 giây du di, bài quá hạn bị đánh dấu EXPIRED. Tài khoản test mới: trainee.test1, trainee.test2, trainer.test1. Chưa kiểm chứng: hết giờ trên trình duyệt, nút giải phóng trên trình duyệt, đồng thời nhiều người, đề DOCX.

Lô 2026-10-20 (V629), DEV: học viên tự điểm danh. Giảng viên mở điểm danh cho buổi đã mở; mã sáu số đổi mỗi năm phút (mã cũ còn hiệu lực 60 giây); học viên nhập mã hoặc quét QR, ký điện tử, dòng thành Attended với cách xác nhận SELF. Người không có thiết bị vẫn được giảng viên đánh dấu bằng điểm danh nhanh (TRAINER_ATTESTED), không cần ghi lý do theo quyết định của chủ dự án. Chỉ người còn ở trạng thái Invited, đúng ngày của buổi, mới điểm danh được. Chưa kiểm chứng: sai ngày, đổi mã sau năm phút, giới hạn số lần nhập sai.

Điều chỉnh 2026-10-20 (theo chỉ đạo của chủ dự án): tự điểm danh (V629) **không còn chữ ký điện tử thứ hai**. Học viên đã đăng nhập, nhập hoặc quét mã của buổi học rồi bấm Confirm; dòng điểm danh ghi cách xác nhận SELF, người và thời điểm nằm trong Audit Trail. Điểm danh nhanh của giảng viên vẫn có chữ ký. Hộp thoại Check in ở My Training có nút quét QR bằng camera (bộ nhận dạng của trình duyệt hoặc jsQR), sáu ô nhập mã, Clear và Confirm. Danh sách đã xác nhận không thêm người nữa: người đến mà không có tên được đào tạo bổ sung hoặc đào tạo đột xuất; sai sót điểm danh được sửa bằng lý do, không cần chữ ký, trước khi người đó có điểm. Các quyết định này chờ QA xác nhận trong Decision Log. Ý nghĩa chữ ký TRAINING_ATTENDANCE_SELF_CONFIRMED tạo ở V629 không còn dùng (migration chỉ tiến, giữ nguyên).

Lô 2026-10-20 (V630, V631), DEV: bằng chứng đánh giá kiểu hybrid (tệp scan hoặc tệp Word đã điền, ô ghi biểu mẫu và phiên bản dùng, tùy chọn); thư viện mẫu biểu mẫu đánh giá ở Training Properties (nạp tay tệp Word, ký điện tử để đặt làm bản đang dùng, giữ mọi phiên bản); người chuẩn bị đào tạo bắt đầu từ mẫu, sửa Exam Template và Answer Key trực tiếp trong OnlyOffice (Open to Edit, Open to Edit Answer), mỗi lần Save thành tệp mới của buổi đào tạo, tệp cũ giữ lại và đánh dấu đã thay; chỉ làm được trước khi nội dung được gửi soát xét. Bộ đề in từ tệp Word được chuyển sang PDF khi in và ghi cả ba SHA-256. Chưa kiểm chứng: hai người cùng sửa, đóng thẻ trình duyệt giữa chừng, hạn mức kết nối của OnlyOffice.

Điều chỉnh 2026-10-21 (V633, theo chỉ đạo của chủ dự án): bỏ lịch ngày nghỉ (D-14, WP-DAYS) và cài đặt "số ngày làm việc gửi kết quả cho QA". SOP.0003 chỉ nhắc ngày làm việc một lần (7 ngày làm việc, mục 5.3.8) và không định nghĩa; cài đặt này chưa từng được dùng để tính hạn nào. Bảng `training_non_working_days`, dịch vụ, các đường dẫn, tab Calendar và cột `results_due_working_days` đã xóa. Quy tắc duy nhất từng dùng lịch (nhập kết quả từ bản giấy muộn cần lý do) nay đếm theo ngày lịch: quá một ngày sau buổi học thì cần lý do, không chặn. Hạn 7 ngày làm việc do con người theo dõi như SOP quy định. Các đoạn trước nói về ngày nghỉ trong tài liệu này không còn hiệu lực.

Lô 2026-10-21: workspace cho từng buổi đào tạo (mở ở tab mới từ nút Open workspace) với năm bước: Prepare, Attendance, Training, Assessment, Results. Các bước chỉ hướng dẫn, không chặn thứ tự; máy chủ vẫn giữ các luật cứng. Bước đang xem lưu trong địa chỉ và trình duyệt; dữ liệu nằm ở máy chủ nên đóng tab rồi mở lại vẫn nguyên. Chỉ ghi ngày của buổi, không ghi giờ. Đã kiểm tra bằng trình duyệt: mở tab mới, năm bước, mở lại về đúng bước cuối, không tràn ngang ở 390 px.

Lô 2026-10-23 (V635, V636, V637), DEV: khóa theo trạng thái của hoạt động (mở lại nội dung đã duyệt, QA trả kết quả về In progress, đổi giảng viên hoặc địa điểm buổi trước khi đào tạo, ghi chú sửa được đến khi hoàn thành); hủy có chữ ký từ Notified trở đi; tên trạng thái "Pending ..." cho cả Training; cờ "tạm ngừng việc" (D-12), nhắc 31/12 và cuối tháng rà soát (TR-07, TR-08), đánh dấu hết hạn lưu giữ (D-17), màn Document Trainings và đánh giá tác động lên ma trận (TR-28). Chi tiết, các giả định chờ QA và phần chưa kiểm chứng: xem TRAINING_PAPER_BATCH_2026_10_18_CHANGE_RECORD.md.
