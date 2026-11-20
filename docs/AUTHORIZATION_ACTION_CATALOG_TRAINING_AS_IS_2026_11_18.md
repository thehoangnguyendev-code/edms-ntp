# Action Catalog As-Is: module Training (2026-11-18)

Giai đoạn A, bước 1 của `AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15.md`, cho Training (giai đoạn C). **Chỉ ghi hiện trạng đọc từ mã (As-Is)**. **Đã được chủ hệ thống duyệt như hiện trạng ngày 2026-11-18** (cả sáu câu ở mục 6: giữ nguyên). Adapter: xem Decision Log. Mỗi dòng truy ngược về hàm trong `com.eqms.service.training`. Cột "Cần quyết" là chỗ mã không tự trả lời được. Không đưa dòng nào vào động cơ Hybrid trước khi dòng đó được duyệt (quy tắc của `AUTHORIZATION_MODULE_INVENTORY.md`).

## 1. Cơ chế hiện tại (đọc từ mã)

- **Quyền:** `TrainingAccess.require(user, anyOf...)` (166 nơi gọi, 50 file): người dùng phải Active và giữ ít nhất một quyền trong danh sách. Từ chối trả `TRAINING_SCOPE_DENIED`, không nói gì về đối tượng.
- **Phạm vi phòng ban:** quyền chỉ áp cho phòng ban của chính người đó, trừ khi họ giữ `training.scope.all` (`inScope`, `requireScope`). Phòng ban của người dùng khớp theo tên.
- **Bước duyệt:** `TrainingApprovalService.STEPS` có 12 bước (xem mục 2). Mỗi bước cần một quyền, người trình **chỉ định** người duyệt (`designate`, quyền `training.approval.designate` cộng quyền thiết kế của đối tượng), máy chủ kiểm lại khi ký (`requireCanSign`): người ký còn Active, còn giữ quyền, trong phạm vi phòng ban, **không thuộc tập `keptApart`** (nếu thuộc: `TRAINING_SEGREGATION_OF_DUTIES`). Chế độ bước ở bảng `training_approval_modes`.
- **Đổi người duyệt:** `reassign` cần `training.approval.reassign`, phải có lý do, cả hai người được ghi.
- **Chữ ký điện tử:** mọi chuyển trạng thái đều ký (`TRAINING_*` meaning); thiếu token trả `TRAINING_SIGNATURE_REQUIRED`.
- **SoD trong DB (`sod_constraints`):** 6 cặp quyền (mục 4). Chỉ kiểm khi cấp quyền cho profile, không phải mỗi lần ra quyết định.
- **Không có** bảng `workflow_action_policies`, adapter hay quan hệ (relation) cho Training: quyết định nằm trong mã dịch vụ.

## 2. Bước duyệt (TrainingApprovalService.STEPS) và chế độ

| Bước | Quyền để xử lý | Ý nghĩa chữ ký | Chế độ | Người bị tách ra (`keptApart`) | Mã |
|---|---|---|---|---|---|
| CONTENT_REVIEW | `training.content.review` | TRAINING_CONTENT_REVIEWED | Chỉ định bắt buộc | (theo hoạt động) | `confirmContent`, `keptApart` |
| CONTENT_APPROVE | `training.content.approve` | TRAINING_CONTENT_APPROVED | Chỉ định bắt buộc | (theo hoạt động) | `confirmContent` |
| ACTIVITY_COMPLETE | `training.activity.close` | TRAINING_COMPLETED | **Bất kỳ người đủ điều kiện** | `keptApart(activity, "ACTIVITY_COMPLETE")` | `confirmCompletion` |
| MATRIX_APPROVE | `training.matrix.approve` | TRAINING_MATRIX_APPROVED | Chỉ định bắt buộc | người đã chuẩn bị (`keptApart(v, actor)`) | `TrainingMatrixService.approve` |
| JOB_ASSIGN_EXCEPTION | `training.job_assignment.exception.approve` | TRAINING_JOB_EXCEPTION_APPROVED | Chỉ định bắt buộc | người trình, người được giao | `TrainingJobAssignmentService` (dòng 486, 496) |
| SPECIMEN_CONFIRM | `training.signature.confirm` | TRAINING_SPECIMEN_APPROVED | Chỉ định bắt buộc | — | **Chỉ khai báo** trong `STEPS` và `TrainingNotifier`; `TrainingSpecimenService` không gọi `designate` hay `requireCanSign` cho bước này (xem mục 6, câu 4) |
| RECORD_EXPORT_APPROVE | `training.record.export` | TRAINING_RECORD_APPROVED | Chỉ định bắt buộc | người chuẩn bị | `TrainingRecordExportService`, `...BatchService` |
| REQUIREMENT_REVIEW | `training.requirement.review` | TRAINING_REQUIREMENT_REVIEWED | Chỉ định bắt buộc | người trình | `TrainingRequirementService.review` |
| REQUIREMENT_APPROVE | `training.requirement.approve` | TRAINING_REQUIREMENT_APPROVED | Chỉ định bắt buộc | người chuẩn bị và người review | `TrainingRequirementService` (dòng 297) |
| TRAINER_EXCEPTION | `training.trainer.exception.approve` | TRAINING_TRAINER_EXCEPTION_APPROVED | Chỉ định bắt buộc | người yêu cầu, người giảng | `TrainingTrainerService` |
| LEGACY_EVIDENCE_VERIFY | `training.activity.close` | TRAINING_LEGACY_VERIFIED | (đã gỡ 2026-11-01, giữ để mô tả bản ghi cũ) | — | `TrainingApprovalService.STEPS` |
| REVIEW_CLOSE | `training.job_assignment.manage` | TRAINING_REVIEW_CLOSED | Chỉ định bắt buộc | chính nhân viên được rà soát | `TrainingPersonnelReviewService` |
| (RECORD_VOID, JOB_ASSIGN_SIGN) | có trong `training_approval_modes` nhưng không có trong `STEPS` | — | Chỉ định bắt buộc | — | **Cần quyết: dòng mồ côi?** |

Ghi chú: `LEGACY_EVIDENCE_VERIFY` đã gỡ, `SPECIMEN_CONFIRM` chưa được dùng: hai bước còn trong danh sách nhưng không chạy.

## 3. Action Catalog theo vòng đời

Quy ước cột: **Từ** = trạng thái bắt đầu; **Quyền** = `anyOf`; **Phạm vi** = phòng ban của đối tượng (`requireScope`) trừ khi có `training.scope.all`; **Khác người** = điều kiện tách biệt nhiệm vụ trong mã.

### 3.1 Requirement (yêu cầu đào tạo, SOP)
Vòng đời: `DRAFT` → `PENDING_REVIEW` → `PENDING_APPROVAL` → `APPROVED` (và `CANCELLED`); dòng yêu cầu có trạng thái riêng (`PLANNED`, `POSTPONED`, `DONE`).

| Hành động | Từ | Quyền | Khác người | Chữ ký | Mã | Cần quyết |
|---|---|---|---|---|---|---|
| Xem danh sách, chi tiết | mọi | `training.requirement.view` hoặc `.prepare` (cộng `.review`, `.approve` cho `visible`) | phạm vi phòng ban | không | `list`, `visible` | — |
| Tạo / sửa / đề xuất dòng | DRAFT | `training.requirement.prepare` | — | không | `create`, `suggestions`, `requirePrepare` | — |
| Trình (gửi review) | DRAFT, có ≥1 dòng | `training.requirement.prepare` + `training.approval.designate` | người review ≠ người trình | có (PREPARED) | `submit` | Người trình có được là người duyệt ở bước sau? (mã cấm qua `keptApart`) |
| Review | PENDING_REVIEW | `training.requirement.review` (người được chỉ định) | ≠ người trình | có (REVIEWED) | `review`, `kept` | — |
| Duyệt | PENDING_APPROVAL | `training.requirement.approve` (người được chỉ định) | ≠ người chuẩn bị, ≠ người review | có (APPROVED) | `approve` | — |
| Từ chối | PENDING_* | như bước tương ứng | như bước tương ứng | có (REJECTED) + lý do | `reject` | — |
| Mở hoạt động từ dòng | APPROVED | `training.activity.organize` + `training.code.allocate` | — | không | `openActivity` | — |
| QA ký một dòng yêu cầu | APPROVED, dòng đã có hoạt động COMPLETED | `training.activity.close` + phạm vi phòng ban | dòng chưa được ký | có | `qaSign` (cấp dòng, không theo bước duyệt) | Ý nghĩa của QA ký dòng so với bước ACTIVITY_COMPLETE? |
| Nhắc hằng năm / định kỳ (job) | APPROVED | hệ thống, nhắm người có `training.requirement.prepare` | — | không | `TrainingReminderScheduler` | — |

### 3.2 Matrix (ma trận đào tạo theo vị trí)
Vòng đời phiên bản: `DRAFT` → `PENDING_APPROVAL` → `EFFECTIVE` → `OBSOLETED`.

| Hành động | Từ | Quyền | Khác người / điều kiện | Chữ ký | Mã | Cần quyết |
|---|---|---|---|---|---|---|
| Xem ma trận, phiên bản, độ phủ | mọi | `training.matrix.view` hoặc `.manage` | phạm vi | không | `matrices`, `version`, `coverage` | — |
| Tạo ma trận | — | `training.matrix.manage` | phòng ban bắt buộc | không | `createMatrix` | — |
| Sửa dòng / ô | DRAFT | `training.admin.manage` | hàng đánh dấu "senior QA" chỉ QA được đổi (`TRAINING_MATRIX_SENIOR_QA_ONLY`) | không | `save`, `applyLockedRows` | Định nghĩa "senior QA" nằm ở đâu (cờ trên dòng)? |
| Trình duyệt | DRAFT, có dòng, mọi dòng có vị trí | `training.matrix.manage` + chỉ định `training.approval.designate` | người duyệt ≠ người trình | có (PREPARED) | `submit` | — |
| Duyệt | PENDING_APPROVAL | `training.matrix.approve` (được chỉ định) | ≠ người chuẩn bị; SoD DB `matrix.manage` vs `matrix.approve` (BLOCK) | có (APPROVED) | `approve` | — |
| Từ chối | PENDING_APPROVAL | như Duyệt | như Duyệt | có + lý do | `reject` | — |
| Nâng cấp (phiên bản mới) | EFFECTIVE | `training.matrix.manage` | — | không | `upgrade` | — |
| Đánh giá tác động tài liệu | — | `training.matrix.manage` | — | không | `TrainingImpactService.assess` | — |

### 3.3 Activity (buổi đào tạo)
Vòng đời: `PLANNED` → `NOTIFIED` → `IN_PROGRESS` → `PENDING_QA_CONFIRMATION` → `COMPLETED`; hoặc `CANCELLED`. Buổi (session) có trạng thái riêng (`PLANNED`, hoãn, giữ). Người tham gia: `INVITED`, `ATTENDED`, `ONLINE`, `ABSENT`, `READ_CONFIRMED`...

| Hành động | Từ | Quyền | Khác người / điều kiện | Chữ ký | Mã | Cần quyết |
|---|---|---|---|---|---|---|
| Xem danh sách, chi tiết | mọi | `training.activity.view` (+ `.close` cho chi tiết QA) | phạm vi | không | `list`, `get`, `visible` | — |
| Tạo hoạt động | — | `training.activity.organize` + `training.code.allocate` | phạm vi phòng ban | không | `create` | — |
| Sửa, thêm buổi, thêm người | PLANNED | `training.activity.organize` | — | không | `update`, `addSession`, `addParticipants` | — |
| Chỉ định / đổi người duyệt nội dung | PLANNED | `training.approval.designate` / `.reassign` | người duyệt đủ điều kiện, ≠ người trình | không (ghi sự kiện) | `designate`, `reassign` | — |
| Xác nhận nội dung (review, duyệt) | PLANNED | `training.content.review` / `.approve` | SoD DB `content.review` vs `content.approve` (WARN, không chặn cứng) | có | `confirmContent` | Cảnh báo SoD nội dung là WARN: có nâng lên BLOCK? |
| Miễn tài liệu / đánh giá | PLANNED | `training.activity.organize` | cần lý do | không | `setContentExemptions` | — |
| Thông báo cho người học | PLANNED | `training.activity.conduct` hoặc `.organize` | nội dung đã duyệt | có | `notifyActivity` | — |
| Bắt đầu buổi / giữ buổi | NOTIFIED | `training.activity.conduct` | chưa bắt đầu (`notStarted`) | không | `startSession`, `holdSession` | — |
| Điểm danh (roll call), check-in | IN_PROGRESS | `training.activity.conduct`; check-in bởi `training.self.view` | người học tự check-in cho mình | không | `rollCall`, `checkIn` | — |
| Gửi danh sách điểm danh | IN_PROGRESS | `training.activity.conduct` hoặc `.organize` | — | có | `sendAttendanceList` | — |
| Ghi điểm / kết quả bài đánh giá | IN_PROGRESS | `training.assessment.record` | SoD DB `assessment.record` vs `assessment.approve` | không | `recordAssessment` | — |
| Nhập phiếu giấy (transcribe) / kiểm tra | IN_PROGRESS | `training.paper.transcribe` / `training.paper.verify` | SoD DB transcribe vs verify (BLOCK) | không | `TrainingTranscriptionService.enter`, `decideChecks` | — |
| Sửa điểm danh, tham gia | sau khi ghi | `training.activity.conduct` hoặc `.organize` | **không được sửa của chính mình** (`SEGREGATION`) | có + lý do | `correctAttendance`, `setParticipation` | — |
| Tự đọc: xác nhận đã đọc | PLANNED, INVITED | `training.self.view` (chính người đó) | — | không | `confirmRead` | — |
| Nhắc đọc, miễn đọc, xác minh tự đọc | — | `training.activity.conduct` hoặc `.organize` | **không tự miễn / xác minh cho mình** | có (excuse) | `remindToRead`, `excuseReader`, `verifySelfReading` | D-SRM-6 trong `DECISION_LOG` |
| Kết thúc đào tạo (gửi QA) | IN_PROGRESS | người gửi (`lockedForSender`: `conduct` hoặc `organize`) | đã gửi điểm danh, đủ kết quả, đủ bản quét | có (RESULTS_FINISHED) | `finishTraining` | — |
| Xác nhận hoàn thành | PENDING_QA_CONFIRMATION | `training.activity.close` (ACTIVITY_COMPLETE, bất kỳ người đủ điều kiện) | `keptApart(activity,...)`; SoD DB `assignment.manage` vs `activity.close` (WARN) | có (COMPLETED) | `confirmCompletion` | Bước này cho "bất kỳ người đủ điều kiện": có muốn chỉ định bắt buộc? |
| Hủy | PLANNED..PENDING_QA | `training.activity.organize` | cần lý do; không hủy nếu đã có người đạt | có | `cancel` | — |
| Bổ sung (supplementary) | COMPLETED | `training.activity.organize` | chỉ cho người vắng hoặc trượt | có | `supplementary` | — |
| Mở lại nội dung / trả lại sửa | các trạng thái | `training.activity.organize` / `.close` | — | có | `reopenContent`, `returnForCorrection` | — |
| Hủy bản ghi đào tạo (void) | COMPLETED | `training.record.void` | người void ≠ người xác nhận hoàn thành | có + lý do | `TrainingRecordService.voidRecord` | Ý nghĩa bước RECORD_VOID trong bảng chế độ? |
| Ngoại lệ người giảng | PLANNED | `training.activity.organize` | người duyệt ≠ người yêu cầu ≠ người giảng | có | `TrainingTrainerService` | — |

### 3.4 Assessment (thư viện bài đánh giá)
Vòng đời: `DRAFT` → `PENDING_APPROVAL` → `EFFECTIVE` → `OBSOLETED` (revision).

| Hành động | Từ | Quyền | Khác người | Chữ ký | Mã | Cần quyết |
|---|---|---|---|---|---|---|
| Xem | mọi | `training.assessment.design` hoặc `.approve` | — | không | `page`, `get`, `preview` | — |
| Tạo, sửa, xóa | DRAFT | `training.assessment.design` | — | không | `create`, `update`, `delete` | — |
| Trình duyệt | DRAFT | `training.assessment.design` | — | có | `submit` | — |
| Duyệt | PENDING_APPROVAL | `training.assessment.approve` | **≠ người tạo, người sửa cuối, người trình**; SoD DB `record` vs `approve` | có (APPROVED) | `approve` (dòng 546) | Chưa dùng bước chỉ định như các vòng đời khác: có cần đồng nhất? |
| Trả về Draft | PENDING_APPROVAL | `training.assessment.approve` hoặc `.design` | — | có + lý do | `returnToDraft` | — |
| Nâng cấp revision | EFFECTIVE | `training.assessment.design` | — | không | `upgradeRevision` | — |

### 3.5 Job assignment (giao Work Position)
Vòng đời: `DRAFT` → `PENDING_RECEIVER` → `EFFECTIVE` → `OBSOLETED`; ngoại lệ có bước riêng.

| Hành động | Quyền | Khác người | Chữ ký | Mã | Cần quyết |
|---|---|---|---|---|---|
| Xem | `training.job_assignment.view` / `.manage`; người nhận thấy của mình (`training.self.view`) | — | không | `list`, `visible` | — |
| Tạo / giao | `training.job_assignment.manage` | người nhận phải Active và đủ điều kiện (đã đào tạo theo ma trận) | có | `create`, `eligibility` | — |
| Chấp nhận (người nhận) | `training.self.view` | **chính người nhận** | có | `accept` | — |
| Xin ngoại lệ | `training.job_assignment.manage` + chỉ định | người duyệt ≠ người trình ≠ người được giao | có (EXCEPTION_APPROVED) | dòng 486, 496 | — |
| Ký bổ nhiệm | (xem RECORD / `JOB_ASSIGN_SIGN` mồ côi) | `requireManage` | **người ký ≠ chính người được giao** (dòng 520) | có | `TrainingJobAssignmentService` | Bước `JOB_ASSIGN_SIGN` có thuộc `STEPS`? |
| Tạm đình chỉ / tiếp tục | `training.job_assignment.manage` | — | có | `TrainingSuspensionService.raise`, `resume` | — |

### 3.6 Personnel review (rà soát nhân sự: vào làm, chuyển phòng, nghỉ về)
Vòng đời: `OPEN` → (đóng) / `CANCELLED`; mục có `PENDING`, `APPROVED`.

| Hành động | Quyền | Khác người | Chữ ký | Mã | Cần quyết |
|---|---|---|---|---|---|
| Xem, gợi ý, khoảng trống ma trận | `training.job_assignment.view` | — | không | `list`, `matrixGaps` | — |
| Tạo, lập kế hoạch, sửa mục, tạo hoạt động | `training.job_assignment.manage` | — | không | `create`, `plan`, `updateItem`, `createActivity` | — |
| Chỉ định người đóng | `training.job_assignment.manage` + `designate` | **≠ chính nhân viên được rà soát**; Trưởng phòng bắt buộc có (`TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING`) | không | `plan`, `eligibleClosers` | — |
| Đóng rà soát | người được chỉ định (REVIEW_CLOSE) | ≠ nhân viên được rà soát | có (REVIEW_CLOSED) | `close` | — |
| Đổi người đóng | `training.approval.reassign` | — | có + lý do | `changeCloser` | — |
| Hủy | `training.job_assignment.manage` | — | có + lý do | `cancel` | — |

### 3.7 Specimen (mẫu chữ ký) và các nhóm còn lại

| Hành động | Quyền | Khác người | Chữ ký | Mã | Cần quyết |
|---|---|---|---|---|---|
| Xem mẫu chữ ký | `training.signature.view` / `.confirm` / `.manage`; tự xem của mình (`training.self.view`) | — | không (ghi audit khi xem bản gốc) | `list`, `image` | — |
| Tải mẫu lên | `training.signature.manage` hoặc chính người đó (`training.self.view`) | — | không | `upload` | — |
| Tải mẫu: hai ảnh chữ ký (FRM.0007) | như trên | bắt buộc đủ ảnh thứ nhất và thứ hai (`TRAINING_SPECIMEN_SECOND_REQUIRED` là về ảnh, không phải người thứ hai) | không | `upload` | — |
| Xác nhận mẫu bởi người khác | `training.signature.confirm` | **mã chưa làm** (bước SPECIMEN_CONFIRM chỉ khai báo); `capabilities` chỉ cho quyền xem | — | `TrainingSpecimenService` | Có cần người xác nhận khác người tải lên, hay bỏ bước? |
| Xuất hồ sơ cá nhân / hàng loạt | `training.record.export` | người duyệt ≠ người chuẩn bị | có | `TrainingRecordExportService`, `...BatchService` | — |
| Biểu mẫu (annex): xem, tải lên, bật, tắt | `training.annex.view` / `.manage` / `.enable` | — | không | `TrainingAnnexService`, `TrainingFormTemplateService` | — |
| Cài đặt, quy tắc mã, bộ đếm số | `training.settings.view` / `.manage` | — | không | `TrainingSettingsService`, `TrainingCodeService` | — |
| Work Position, thuộc tính | `training.admin.manage` | — | không | `TrainingJobRoleService.save` | — |
| Nhà cung cấp bên ngoài: tạo, sửa, bật, tắt | `training.admin.manage` | — | không | `TrainingVendorService` | — |
| Nhà cung cấp: duyệt (DRAFT → ACTIVE) | `training.admin.manage` | **người duyệt ≠ người tạo**; ngày hiệu lực chưa quá hạn | có (PROVIDER_APPROVED) | `TrainingVendorService.approve` | Dùng cùng quyền `admin.manage` cho tạo và duyệt: có cần quyền duyệt riêng? |
| Tuân thủ, lưu giữ, tập tin hoạt động | `training.compliance.view`, `training.activity.view`, `training.activity.organize` | — | không | `TrainingComplianceService`, `TrainingRetentionService`, `TrainingFileService` | — |
| Hồ sơ của mình (tự phục vụ) | `training.self.view` | chỉ của chính mình | không | `MyTrainingQueryService`, `TrainingRecordService.my*` | — |

## 4. SoD cấu hình trong DB (chỉ kiểm khi cấp quyền cho profile)

| Quy tắc | Cặp quyền | Mức |
|---|---|---|
| Transcribe vs Verify Paper Training Record | `training.paper.transcribe` / `training.paper.verify` | BLOCK |
| Record vs Approve Training Assessment | `training.assessment.record` / `training.assessment.approve` | BLOCK |
| Manage vs Approve Training Matrix | `training.matrix.manage` / `training.matrix.approve` | BLOCK |
| Prepare vs Approve Training Requirement | `training.requirement.prepare` / `training.requirement.approve` | BLOCK |
| Assign vs Close Training Activity | `training.assignment.manage` / `training.activity.close` | WARN |
| Review vs Approve Training Content | `training.content.review` / `training.content.approve` | WARN |

Hai lớp tách biệt cùng tồn tại: SoD theo cặp quyền (khi cấp quyền) và `keptApart` theo quan hệ với bản ghi (lúc ký). Động cơ chỉ cần giữ lớp thứ hai bằng `forbiddenRelationCodes` (đã có từ 2026-11-18); lớp thứ nhất giữ ở `SodConstraintService`.

## 5. Mapping sang động cơ Hybrid (đề xuất, chưa làm)

| Khái niệm hiện tại | Trong động cơ |
|---|---|
| `access.require(anyOf)` | `required_permission_code` của chính sách (một quyền) hoặc quan hệ `PERMISSION_*` (hỗ trợ nhiều quyền "bất kỳ") |
| Phạm vi phòng ban / `training.scope.all` | `isWithinObjectScope` của adapter (quy tắc đối tượng theo phòng ban) |
| Người được chỉ định, người trình, người chuẩn bị | quan hệ `ASSIGNED_APPROVER`, `PREPARER`, `SUBMITTER`, `REVIEWER` (resolver WORKFLOW_PARTICIPANT từ `training_approval_assignments`) |
| `keptApart` | `forbiddenRelationCodes` (đã có) |
| Chính nhân viên (self) | quan hệ `SELF` (`SELF_RESOLVER`) |
| Trạng thái vòng đời | `resolveState` của từng adapter: `TRAINING_REQUIREMENT`, `TRAINING_MATRIX`, `TRAINING_ACTIVITY`, `TRAINING_ASSESSMENT`, `TRAINING_JOB_ASSIGNMENT`, `TRAINING_PERSONNEL_REVIEW`, `TRAINING_SPECIMEN` |

Rủi ro (GitNexus `impact`, ngày 2026-11-15): `TrainingAccess.require` CRITICAL, 551 symbol, 166 nơi gọi. Vì vậy **không sửa `require` tại chỗ**: mỗi dịch vụ chuyển từng hàm một, shadow trước, bật cờ theo từng loại tài nguyên, sau đó mới xóa mã cũ.

## 6. Việc cần chủ hệ thống / QA duyệt

Với mỗi bảng ở mục 3: **duyệt như hiện trạng** hoặc **sửa** (ghi hành vi đích). Các câu hỏi đã gom ở cột "Cần quyết". Nên trả lời trước:

1. **ACTIVITY_COMPLETE (xác nhận hoàn thành) là "bất kỳ người đủ điều kiện", các bước khác là "chỉ định bắt buộc".** Giữ vậy hay chuyển sang chỉ định?
2. **SoD nội dung (review vs approve) và Assign vs Close mức WARN.** Giữ WARN hay nâng BLOCK?
3. **Duyệt Assessment không dùng cơ chế chỉ định**, chỉ chặn tạo/sửa/trình. Giữ hay đồng nhất?
4. **Ba bước không chạy:** `RECORD_VOID` và `JOB_ASSIGN_SIGN` có trong `training_approval_modes` nhưng không có trong `STEPS`; `SPECIMEN_CONFIRM` có trong `STEPS` nhưng dịch vụ Specimen không dùng. Xóa, hay là bước chưa làm?
5. **Phạm vi phòng ban theo tên phòng ban của người dùng** (`departmentOf`). Chuyển sang id (an toàn hơn) khi vào động cơ?
6. **Người void bản ghi ≠ người xác nhận hoàn thành** hiện chỉ so với một người; có cần cấm cả người tạo hoạt động?

## 7. Giới hạn

Trích từ chữ ký và thân của các hàm công khai trong 33 dịch vụ Training bằng đọc mã; điều kiện lồng sâu hoặc nằm ở controller có thể còn sót. Các điều kiện trạng thái (ví dụ "đã gửi điểm danh", "đủ kết quả") được ghi là điều kiện tiên quyết, chưa chia thành chính sách. Cần đối chiếu lại từng dòng khi viết test ma trận trước khi chuyển sang động cơ.
