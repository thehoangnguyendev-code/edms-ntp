# Training Management & Training Administration — Đề xuất thiết kế

Trạng thái: **ĐỀ XUẤT, chưa được duyệt.** Không phải As-Is evidence và không phải GMP approval.
Ngày: 2026-10-07. Phạm vi đọc: xem mục 1.

Nhãn độ chắc chắn dùng trong tài liệu:

- **[UI]** suy ra từ UI / type / mock data của frontend. Chỉ chứng minh ý định, không chứng minh hành vi.
- **[BE]** có trong source backend.
- **[ĐỀ XUẤT]** đề xuất của người soạn.
- **[QUYẾT ĐỊNH]** code không trả lời được; cần chủ sở hữu nghiệp vụ / QA chốt (xem mục 7).

## 1. Phạm vi đã đọc (và chưa đọc)

Đã đọc kỹ: `types/*.ts`, `compliance-tracking/types.ts` + `repository.ts`, `navigation.ts` (phần Training),
`TrainingRoutes.tsx`, `routes.constants.ts`, `permissionCatalog.ts` (phần training), 4 view
Training Administration, `ConfigTab`, đầu `MyTrainingView`, `ResultEntryView`, `ObsoleteImpactAssessmentView`,
`TrainingAuthorizationService`, migration V42/V45/V46, `RevisionService.completeTraining`.

Chưa đọc đầy đủ (~24k dòng): `MaterialsView`, `MaterialEditorView`, `CourseListView`, `CourseEditorView`,
wizard `AssignTrainingView` (4 bước), `TrainingMatrixView`, `CourseStatusView`, `CourseProgressView`,
`EmployeeTrainingFilesView`, `ExportTrainingRecordsView`. Cần đọc trước khi chốt wireframe chi tiết.

Không dùng GitNexus/graphify: công cụ MCP tương ứng không có trong phiên này; dùng grep/đọc trực tiếp.

## 2. Hiện trạng

### 2.1 Backend [BE]

Không có controller, entity, bảng hay service nghiệp vụ nào cho Training (khóa học, giao đào tạo, bản ghi hoàn thành,
năng lực). Chỉ có:

- `TrainingAuthorizationService` và các quyền `training.*` (xem 2.3).
- **Training gắn vào vòng đời Document Revision**: `requires_training`, `training_period_days`,
  `reason_for_skipping_training`, `training_planned_date`, `training_period_end_date`, `training_completion_date`;
  trạng thái `PENDING_TRAINING`; hành động `COMPLETE_TRAINING` yêu cầu signature token
  (`RevisionService.completeTraining`, quyền `documents.training.complete|manage`).
- Quan trọng: `COMPLETE_TRAINING` hiện là **một người hoàn tất một bước workflow**. Nó không kiểm tra danh sách
  người được đào tạo, không biết ai đã học, điểm, hay chữ ký của từng người.
- Decision Log chỉ ghi "Training is out of scope".

### 2.2 Frontend [UI]

| Khu vực | Nội dung | Dữ liệu |
|---|---|---|
| My Training | danh sách việc cần học, 3 tab | mock (`MOCK_TODO_TASKS`) |
| Training Materials | vòng đời Draft→Review→Approval→Effective→Obsoleted, version, periodic review, usage report | mock |
| Course Inventory | course có workflow giống material (thêm Rejected), phương pháp, recurrence, impact assessment khi obsolete | mock |
| Compliance Tracking | Auto-Assignment Rules, Training Matrix, Course Status, Course Progress, Result Entry, wizard giao đào tạo | `repository.ts` → mock |
| Records & Archive | hồ sơ đào tạo nhân viên, chữ ký chờ, export | mock |
| **Training Administration** | Properties, Requirement Templates, Create a Quiz, Curriculums | **4 trang ComingSoon** |

### 2.3 Quyền [BE/UI]

Chỉ 4 quyền vận hành: `training.module.view`, `training.material.manage`, `training.session.manage`,
`training.assignment.manage`, cộng `training.admin.*.view` cho 4 trang admin. Hệ quả:

- `training.material.manage` được dùng cho **cả** tạo material, tạo course, review course và approve course
  (`TrainingRoutes.tsx`). Không có tách vai tác giả / người review / người duyệt.
- Route Training Matrix, Course Status, Employee Training Files, Export chỉ cần `training.module.view`. Phạm vi dữ liệu
  (phòng ban, BU, chỉ của mình) chưa được định nghĩa.

## 3. Mô hình khái niệm suy ra từ UI [UI]

```
Material ──< MaterialVersion          Course ──< CourseVersion (method, pass rule, recurrence, linkedDocument)
                                            │
Assignment (trigger, reason, deadline, flags) ──< AssignmentItem (1 người/1 course version)
                                            │
                                  Completion record: score, attempts, traineeESign, trainerESign, evidence, waiver
AutoAssignmentRule (QA phải duyệt) ──tạo──> Assignment
EmployeeTrainingFile = view tổng hợp theo nhân viên; Matrix = view Employee × Course/SOP
```

Ba phương pháp hoàn thành: *Read & Understood* (người học ký xác nhận), *Quiz (paper/manual)* (chấm ngoài hệ thống,
admin nhập kết quả kèm ảnh bằng chứng), *Hands-on/OJT* (người học **không** tự hoàn thành; cần trainer ký).

## 4. Mâu thuẫn / lỗ hổng phát hiện trong UI

1. **Nhiều từ vựng trạng thái cho cùng một khái niệm**: `EnrollmentStatus` (Completed/In-Progress/Not Started/Overdue/
   Exempt), `AssigneeStatus` (Assigned/InProgress/Completed/Failed/Overdue/Waived), `CellStatus`
   (NotRequired/Required/InProgress/Qualified), trạng thái My Training (Assigned/Pending/Expiring Soon).
   Cần một máy trạng thái chuẩn; phần còn lại là view dẫn xuất.
2. **Hai kiểu "course"**: `TrainingRecord` và `CourseApproval` trùng nhiều trường. Thực chất thiếu thực thể
   `CourseVersion` được ghim vào assignment.
3. **Phương pháp thi không khớp**: type có 3 phương pháp; My Training dùng "Quiz Offline / Hands-on / Written Test".
   Và Admin có "Create a Quiz" trong khi phương pháp quiz hiện là giấy/thủ công → chưa rõ có quiz điện tử không.
4. **Requirement Templates (Admin) trùng vai trò Auto-Assignment Rules (Compliance Tracking)**: cả hai là
   "ai phải học gì, khi nào".
5. **Hai đường nối với tài liệu**: `Course.linkedDocumentId` và `document_revisions.requires_training`. Hai đường này
   chưa nối với nhau (xem mục 6.3).
6. **Quy tắc cứng trong FE**: hạn mặc định theo priority (`PRIORITY_DEADLINE_DAYS`: 7/14/30/60 ngày) nằm trong code
   FE, đáng ra là cấu hình ở Training Properties.
7. **Result Entry**: ghi `console.log("[AUDIT TRAIL]…")`. Hiện chưa có audit thật; cần ghi nhận là chưa có bằng chứng.
8. **Cách ghi kết quả thay người khác**: admin nhập điểm hộ nhiều người; chưa rõ ai là chữ ký của người học.

## 5. Kiến trúc mục tiêu [ĐỀ XUẤT]

### 5.1 Nguyên tắc

- Tách **ba lớp**: *Requirement* (chính sách: ai cần học gì) → *Assignment* (thể hiện cụ thể, có hạn) →
  *Completion* (bằng chứng bất biến). Matrix, hồ sơ nhân viên, Course Status chỉ là **read model**.
- **Course version được ghim** vào Assignment; hoàn thành là của đúng version đó.
- **Bản ghi hoàn thành bất biến**; sửa sai = bản ghi thay thế kèm lý do + chữ ký, không ghi đè.
- **Overdue và Qualified là dẫn xuất** từ hạn/ngày hoàn thành/hết hạn, không lưu thành trạng thái do UI đặt.
- Giá trị máy (code) tách khỏi nhãn hiển thị; không dùng nhãn dịch làm giá trị trạng thái/quyền/chính sách.

### 5.2 Phân vai hai khu vực

**Training Management** (vận hành, theo người dùng): giao đào tạo, theo dõi, nhập kết quả, hồ sơ.
**Training Administration** (cấu hình, ít thay đổi, có kiểm soát thay đổi): định nghĩa và chính sách.

### 5.3 Menu đề xuất

```
Training Management
├─ My Training
├─ Catalog               Courses + Materials (gộp theo cùng trục "nội dung đào tạo")
├─ Approvals             Pending Review / Pending Approval của material + course
├─ Assignments           danh sách + New Assignment   (hiện route có nhưng KHÔNG có menu)
├─ Compliance            Training Matrix · Course Status · Overdue/Expiring
└─ Records               Employee Training Files · Export

Training Administration (Settings)
├─ Training Properties       loại, phương pháp, cách chấm, mặc định hạn/nhắc, chính sách chung
├─ Requirement Templates     quy tắc "ai cần học gì" + trigger (thay Auto-Assignment Rules)
├─ Curriculums               nhóm course theo vai trò / vị trí / phòng ban
└─ Quizzes                   chỉ khi QUYẾT ĐỊNH T-D3 chọn quiz điện tử
```

Thay đổi so với hiện tại: thêm **Assignments**; chuyển **Auto-Assignment Rules** vào Requirement Templates
(Compliance Tracking chỉ còn giám sát); gộp Materials + Courses vào Catalog.

### 5.4 Nội dung từng trang Administration

| Trang | Chứa | Ghi chú |
|---|---|---|
| Training Properties | training types, methods, grade types, điểm đạt/số lần thi mặc định, hạn theo priority, ngày nhắc, cửa sổ cảnh báo hết hạn, chính sách "đào tạo trước khi được phân công" | theo mẫu Document Properties đã có |
| Requirement Templates | điều kiện (phòng ban, vị trí, role profile, BU) × trigger × course/curriculum × hạn × lặp lại | phiên bản hóa, lý do thay đổi, cần QA duyệt (UI hiện đã nói "QA must approve before rule goes active") |
| Curriculums | tập course cho một vai trò, thứ tự, bắt buộc/tùy chọn | dùng bởi Requirement Template |
| Quizzes | ngân hàng câu hỏi, version, đáp án | chỉ khi có quiz điện tử |

### 5.5 Máy trạng thái chuẩn của AssignmentItem

```
ASSIGNED → IN_PROGRESS → COMPLETED
                      ↘ FAILED → (còn lượt) IN_PROGRESS | (hết lượt) ESCALATED
ASSIGNED/IN_PROGRESS → WAIVED (lý do + người duyệt)
ASSIGNED/IN_PROGRESS → CANCELLED (nguồn bị obsolete/hủy; ghi nguyên nhân)
OVERDUE = dẫn xuất (deadline < now và chưa ở trạng thái kết thúc)
```

### 5.6 Khả năng mở rộng cho module khác

- **Training là consumer của sự kiện**: một hợp đồng `TrainingTrigger` duy nhất (nguồn, đối tượng, lý do, người
  bị ảnh hưởng). Document revision, CAPA, Deviation, Audit Finding, Change Control, nhân viên mới/đổi vai trò đều đăng ký
  qua cùng hợp đồng; thêm module mới không sửa lõi Training. Danh sách 10 trigger trong `AssignmentTrigger` [UI] là điểm xuất phát.
- **Training là provider của Report**: ma trận, quá hạn, hồ sơ nhân viên đăng ký provider với Report Platform
  (xem thiết kế Report), không viết báo cáo riêng.
- Thông báo/nhắc việc dùng hạ tầng notification chung; không tự dựng bộ nhắc riêng trong Training.

## 6. Luồng chính [ĐỀ XUẤT, phụ thuộc mục 7]

### 6.1 Tạo nội dung → hiệu lực
Material/Course: Draft → Pending Review → Pending Approval → Effective → Obsoleted (Rejected quay về Draft).
Tách quyền: tác giả ≠ reviewer ≠ approver (SoD, dùng bảng `sod_constraints` đã có). Obsolete một course đang có
assignment mở phải qua **Impact Assessment** (UI đã có) và xử lý từng assignment.

### 6.2 Giao đào tạo và hoàn thành
1. Trigger (thủ công hoặc Requirement Template) → Assignment kèm **lý do bắt buộc**, hạn, version course.
2. Người học thấy trong My Training → học liệu → hoàn thành theo phương pháp:
   - Read & Understood: người học ký (e-sign, ý nghĩa nêu rõ).
   - Quiz giấy: người chấm nhập điểm + bằng chứng, **người học vẫn ký xác nhận** kết quả.
   - OJT: trainer ký; người học không tự hoàn thành.
3. Hoàn thành tạo Completion bất biến + audit; Matrix và hồ sơ nhân viên cập nhật (dẫn xuất).

### 6.3 Nối với Document Revision
Hiện `PENDING_TRAINING` được đóng bởi **một** hành động. Hướng đề xuất: revision cần training → hệ thống tạo
Assignment từ các course gắn với tài liệu → `COMPLETE_TRAINING` chỉ hợp lệ khi điều kiện hoàn thành (mục T-D1) đã
đạt, kèm bằng chứng liên kết từ revision đến assignment. Đây là thay đổi vùng đã có (Document Control) nên cần
impact analysis và bản ghi thay đổi riêng, không làm lẫn trong module Training.

## 7. Quyết định cần chốt [QUYẾT ĐỊNH]

Mỗi dòng có mặc định đề xuất; nếu không có quyết định thì ghi `PENDING_DECISION`, không tự dựng.

| ID | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| T-D1 | "Revision training hoàn tất" nghĩa là gì: mọi người trong danh sách đạt, hay đủ tỷ lệ, hay người phụ trách xác nhận kế hoạch xong? | Mọi người bắt buộc đạt hoặc có waiver được duyệt trước ngày hiệu lực |
| T-D2 | Tài liệu được dùng trong thời gian training (`training_period_days`) hay chặn đến khi từng người học xong? | Giữ khái niệm "training period" hiện có; người chưa học bị gắn cờ, không được thực hiện công việc theo tài liệu đó (cờ `trainingBeforeAuthorized`) |
| T-D3 | Có quiz điện tử không, hay chỉ giấy/thủ công? | Giai đoạn đầu: chỉ giấy + nhập kết quả; ẩn trang Quizzes |
| T-D4 | Ý nghĩa chữ ký: người học ký "đã đọc và hiểu" khác "đã đạt"? trainer ký "đã chứng kiến"? | Mỗi chữ ký có `meaning` cố định theo phương pháp, không cho nhập tự do |
| T-D5 | Ai được giao đào tạo, ai được waive, ai được nhập kết quả thay người học? Có tách quyền không? | Tách 3 quyền riêng; người học không nhập kết quả của chính mình |
| T-D6 | Phạm vi dữ liệu: quản lý phòng ban chỉ thấy phòng ban mình? Matrix/hồ sơ nhân viên ai được xem? | Scope theo role/profile giống mô hình Report (cá nhân/phòng ban/BU/toàn hệ thống) |
| T-D7 | Hết hạn và đào tạo lại: chu kỳ lấy từ course hay template? Khi course đổi version có bắt học lại không? | Course version đặt cờ "retraining required" (UI đã có `retrainingRequired`) |
| T-D8 | Thời hạn lưu hồ sơ đào tạo và nhân viên nghỉ việc | Chưa có quyết định; không đặt thời hạn mới |
| T-D9 | Đánh giá hiệu quả đào tạo và trainer qualification có trong phạm vi không? | Ngoài giai đoạn 1; ghi nhận là khoảng trống |
| T-D10 | Material có phải tài liệu kiểm soát (dùng chung Document Control) hay thực thể riêng? | Thực thể riêng với workflow riêng như UI hiện tại |
| T-D11 | Nhân viên ngoài / contractor có hồ sơ không (type có `Internal \| Contractor`)? | Có, qua cùng mô hình, đánh dấu loại |
| T-D12 | Dữ liệu cũ (nếu có) di chuyển thế nào? | Chưa có dữ liệu thật ngoài revision training; không migrate |

## 8. Đối chiếu EU-GMP (tham chiếu chung, cần QA xác nhận điều khoản cụ thể)

| Yêu cầu | Đáp ứng bằng |
|---|---|
| Đào tạo ban đầu/liên tục, hồ sơ đào tạo (Chapter 2) | Assignment + Completion bất biến, hồ sơ nhân viên dẫn xuất |
| Đào tạo trước khi thực hiện công việc | Cờ `trainingBeforeAuthorized` + T-D2 |
| Chữ ký điện tử (Annex 11 §14) | Signature token đã có ở Document flow; `meaning` cố định (T-D4) |
| Audit trail (Annex 11 §9) | Audit server-side cho giao, hoàn thành, sửa, waive; bỏ `console.log` giả lập |
| Kiểm soát thay đổi cấu hình (Annex 11 §10) | Admin versioned + lý do + duyệt (Requirement Templates) |
| Lưu giữ (Chapter 4) | T-D8, hiện chưa quyết định |

## 9. Lộ trình [ĐỀ XUẤT]

- **P0** Chốt T-D1…T-D12 (tối thiểu T-D1, T-D4, T-D5, T-D6). Thống nhất từ vựng trạng thái.
- **P1** Backend lõi: CourseVersion, Assignment/AssignmentItem, Completion + audit + e-sign; thay mock của My Training
  và Result Entry. Chưa động Document revision.
- **P2** Read model thật cho Matrix, Course Status, Employee Training File, Export (và provider cho Report).
- **P3** Administration: Training Properties → Curriculums → Requirement Templates (+ chuyển Auto-Assignment Rules).
- **P4** Trigger engine + nối Document Revision (bản ghi thay đổi riêng, impact analysis, kiểm tra đồng thời).
- **P5** Quiz điện tử nếu T-D3 yêu cầu.

Mỗi giai đoạn dùng một bản ghi thay đổi theo `08_ONE_CHANGE_RECORD_TEMPLATE.md`, với bằng chứng âm tính /
đồng thời / lỗi phù hợp rủi ro (ví dụ: hai người cùng nhập kết quả, assignment bị cancel lúc đang làm, quyền bị thu hồi
sau khi giao).
