# Danh mục tên quyền chính thức: Report và Training

Ngày: 2026-11-15. Trạng thái: **ĐỀ XUẤT, chờ chủ hệ thống duyệt**. Chưa có migration, chưa sửa mã.
Căn cứ: quyết định của chủ hệ thống ngày 2026-11-15 (không dùng alias, đặt tên đúng ngay; không chia quyền GMP / không GMP; mọi template đều qua duyệt, một quyền duyệt) và kế hoạch `docs/AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15.md`.
Số liệu "dùng hiện nay" lấy từ quét mã nguồn backend, giao diện và bảng `permission_set_items` trên DEV ngày 2026-11-15.

## 1. Quy ước đặt tên

1. Dạng `<module>.<tài nguyên>.<hành động>`, chữ thường, gạch dưới. Module Report là `reports`, Training là `training`.
2. Một quyền = một hành động trên một tài nguyên. Không còn quyền bao trùm ("manage mọi thứ", "export mọi thứ").
3. Tài nguyên viết số ít (`reports.type.view`, không phải `types`).
4. Hành động chuẩn: `view`, `create`, `update`, `delete`, `submit`, `approve`, `reject`, `manage` (chỉ cho cấu hình phẳng, mục 6), và hành động nghiệp vụ riêng (`upgrade`, `allocate`, `designate`...).
5. Không có alias. Khi đổi tên, migration đổi `permissions.code` tại chỗ (giữ nguyên `id`, nên bộ quyền và hồ sơ truy cập không mất liên kết), đồng thời sửa mọi chỗ dùng trong mã và cấu hình (bảng chính sách, quy tắc thông báo). Không còn mã cũ sau khi chạy.
6. Mã quyền là giá trị máy; tên hiển thị dịch được nằm ở cột tên, không dùng để quyết định gì.
7. Hệ thống không chia theo vai trò: quyền chỉ gom vào bộ quyền, bộ quyền gán qua Access Profile. Quyền theo từng bản ghi (người soạn, người tham gia đào tạo...) nằm ở lớp quan hệ của engine Hybrid, không tạo thêm mã quyền.

## 2. Tóm tắt

- Report hiện có 24 mã (kể cả `report.module.view` và `report.module.export`). Thay đổi: Bỏ: 1, Giữ: 11, Hợp nhất: 1, Hợp nhất + tách: 1, Tách 4: 1, Đổi tên: 8, Đổi tên + tách: 1.
- Training hiện có 53 mã. Thay đổi: Bỏ: 7, Chuyển module: 1, Giữ: 29, Hợp nhất: 1, Tách: 1, Đổi tên: 14.
- Mã mới (chưa có hôm nay): `reports.template.create`, `reports.template.update`, `reports.template.submit`, `reports.template.delete`, `reports.template.reject`, `reports.legal_hold.view`, `reports.delivery_log.view`, `reports.name_format.view`, `training.vendor.manage`, `training.job_role.manage`, `training.notification.manage`.

## 3. Report: bảng đổi tên

Cột "Dùng hiện nay": số chỗ trong backend / số chỗ trong giao diện (không tính test) / số bộ quyền đang chứa.

| Quyền hiện tại | Quyền chính thức | Thay đổi | Dùng hiện nay (backend / giao diện / bộ quyền) | Ghi chú |
|---|---|---|---|---|
| `report.module.view` | `reports.module.view` | Đổi tên | 19 / 12 / 15 | Cùng tiền tố `reports.` như mọi quyền Report. |
| `reports.appearance.manage` | `reports.appearance.manage` | Giữ | 6 / 6 / 1 | Sẽ là quyền duy nhất cho tải thành phần bố cục (hiện còn nhận `reports.definition.manage` và `settings.configuration.*`). |
| `reports.appearance.view` | `reports.appearance.view` | Giữ | 3 / 3 / 1 |  |
| `reports.artifact.download` | `reports.artifact.download` | Giữ | 6 / 0 / 4 |  |
| `reports.catalog.view` | `reports.library.view` | Đổi tên | 3 / 0 / 4 | Xem Report Library (khớp tên menu). |
| `reports.definition.approve` | `reports.template.approve`, `reports.template.reject` | Hợp nhất + tách | 5 / 1 / 1 | Một quyền duyệt cho mọi template (quyết định A); Approve và Reject là hai hành động riêng. |
| `reports.definition.approve_gmp` | `reports.template.approve` | Hợp nhất | 4 / 1 / 0 | Bỏ chia GMP / không GMP. |
| `reports.definition.discard_revision` | `reports.template.discard_revision` | Đổi tên | 2 / 0 / 1 |  |
| `reports.definition.manage` | `reports.template.create`, `reports.template.update`, `reports.template.submit`, `reports.template.delete` | Tách 4 | 17 / 2 / 1 | Hiện một quyền làm cả tạo, lưu, gửi duyệt, xoá; mỗi hành động độc lập như Document Control. |
| `reports.definition.set_enabled` | `reports.template.set_enabled` | Đổi tên | 3 / 0 / 1 |  |
| `reports.definition.upgrade` | `reports.template.upgrade` | Đổi tên | 2 / 0 / 1 |  |
| `reports.definition.view` | `reports.template.view` | Đổi tên + tách | 19 / 11 / 2 | Hiện còn gánh thêm: xem sổ giữ pháp lý, nhật ký gửi, định dạng tên. Tách thành `reports.legal_hold.view`, `reports.delivery_log.view`, `reports.name_format.view` (mới). |
| `reports.name_format.manage` | `reports.name_format.manage` | Giữ | 5 / 7 / 1 | Thêm `reports.name_format.view` (hiện xem bằng `reports.definition.view`). |
| `reports.properties.manage` | `reports.properties.manage` | Giữ | 3 / 3 / 1 |  |
| `reports.properties.view` | `reports.properties.view` | Giữ | 2 / 2 / 1 |  |
| `reports.retention.manage` | `reports.legal_hold.manage` | Đổi tên | 2 / 1 / 0 | Đặt và gỡ lệnh giữ pháp lý; tên cũ "retention" sai nghĩa vì báo cáo giữ vĩnh viễn. |
| `reports.run.create` | `reports.run.create` | Giữ | 10 / 0 / 4 | Tạo báo cáo. |
| `reports.run.view_all` | `reports.run.view_all` | Giữ | 7 / 0 / 1 |  |
| `reports.run.view_own` | `reports.run.view_own` | Giữ | 5 / 0 / 4 |  |
| `reports.schedule.manage` | `reports.schedule.manage` | Giữ | 18 / 2 / 2 | Tạo, sửa, tạm dừng, xoá lịch. |
| `reports.schedule.view` | `reports.schedule.view` | Giữ | 3 / 0 / 1 |  |
| `reports.types.manage` | `reports.type.manage` | Đổi tên | 4 / 4 / 1 |  |
| `reports.types.view` | `reports.type.view` | Đổi tên | 3 / 3 / 1 | Số ít như các tài nguyên khác. |
| `report.module.export` | (bỏ) → `reports.run.create`, `reports.artifact.download`, `reports.schedule.manage`, `reports.legal_hold.view` | Bỏ | 27 / 3 / 6 | Quyền bao trùm cũ: 27 chỗ trong mã nhận nó thay cho quyền cụ thể. Người đang giữ không mất quyền: xem mục 4. |

## 4. Report: điểm cần quyết định hoặc cẩn thận

**4.1. `report.module.export` là quyền bao trùm (27 chỗ dùng trong `ReportPlatformService`, `ReportTemplateService`, `ReportScheduleAdministrationService`, `BackupCopyStatusController`).** Nó đang đứng thay cho nhiều quyền cụ thể. Bỏ nó mà không bù thì người đang giữ mất quyền. Bộ quyền đang chứa: Reports Manager, DCO managed permissions, Supervisor managed permissions, Quality managed permissions, Administrator managed permissions (và một bộ DEV test). Đề xuất: migration cấp cho đúng các bộ quyền đó các quyền cụ thể mà mã hiện cho phép qua `report.module.export`, rồi mới xoá mã cũ. Bước đầu của việc viết migration là liệt kê từng chỗ trong 27 chỗ để biết nó đang thay quyền nào; danh sách bốn quyền trong bảng là giả thuyết từ tên file, **chưa kiểm từng chỗ**.

**4.2. Hợp nhất duyệt.** `reports.definition.approve_gmp` không nằm trong bộ quyền nào, nên hợp nhất vào `reports.template.approve` không làm ai mất quyền. Việc hợp nhất cũng sửa lỗi đã biết: người chỉ giữ `approve` thấy mục Pending My Approval luôn trống.

**4.3. Tách `reports.definition.manage` thành bốn.** Hôm nay bộ quyền nào giữ `manage` thì phải nhận cả bốn quyền mới để giữ nguyên khả năng. Sau đó chủ hệ thống có thể thu hẹp từng bộ quyền (ví dụ chỉ người soạn mới có `submit`).

**4.4. `reports.definition.view` gánh thêm ba màn không phải template** (sổ giữ pháp lý, nhật ký gửi, định dạng tên). Tách để người xem template không tự động thấy sổ giữ pháp lý.

**4.5. `settings.configuration.view/manage`.** Bộ quyền đang chứa: Administration without maintenance bypass, Administrator managed permissions, App Settings Manager, DCO managed permissions, Document Controller managed permissions, Document Security Administrator, Settings Manager, System Administration. Mã Report hiện còn chấp nhận hai quyền này cho thành phần bố cục. Đề xuất gỡ khỏi Report: chỉ `reports.appearance.manage` điều khiển bố cục; cấp `reports.appearance.manage` cho các bộ quyền trên để không ai mất quyền.

## 5. Training: bảng đổi tên

| Quyền hiện tại | Quyền chính thức | Thay đổi | Dùng hiện nay (backend / giao diện / bộ quyền) | Ghi chú |
|---|---|---|---|---|
| `training.activity.close` | `training.activity.close` | Giữ | 9 / 2 / 2 |  |
| `training.activity.conduct` | `training.activity.conduct` | Giữ | 25 / 0 / 3 |  |
| `training.activity.organize` | `training.activity.organize` | Giữ | 54 / 4 / 2 | 54 chỗ dùng, nhiều nhất hệ thống; cần rà xem có nên tách. |
| `training.activity.view` | `training.activity.view` | Giữ | 26 / 9 / 6 |  |
| `training.admin.manage` | `training.vendor.manage`, `training.job_role.manage`, `training.notification.manage` (+ 5 chỗ ở `TrainingMatrixService` cần xác minh) | Tách | 18 / 13 / 2 | Quyền quản trị bao trùm: 18 chỗ (nhà cung cấp 9, ma trận 5, thông báo 2, chức danh công việc 2). |
| `training.admin.properties.view` | `training.settings.view` | Hợp nhất | 1 / 6 / 9 |  |
| `training.annex.enable` | `training.annex.enable` | Giữ | 2 / 1 / 2 |  |
| `training.annex.manage` | `training.annex.manage` | Giữ | 3 / 3 / 2 |  |
| `training.annex.view` | `training.annex.view` | Giữ | 11 / 5 / 2 |  |
| `training.approval.designate` | `training.approver.designate` | Đổi tên | 2 / 0 / 2 |  |
| `training.approval.reassign` | `training.approver.reassign` | Đổi tên | 2 / 0 / 2 |  |
| `training.assessment.approve` | `training.assessment.approve` | Giữ | 10 / 3 / 1 |  |
| `training.assessment.design` | `training.assessment.design` | Giữ | 14 / 5 / 1 |  |
| `training.assessment.record` | `training.assessment.record` | Giữ | 3 / 0 / 3 |  |
| `training.attendance.receive` | `training.activity.receive_attendance` | Đổi tên | 1 / 0 / 0 | Hiện không nằm trong bộ quyền nào. |
| `training.code.allocate` | `training.number.allocate` | Đổi tên | 4 / 0 / 2 | Cấp Training Number. |
| `training.compliance.view` | `training.compliance.view` | Giữ | 14 / 6 / 3 |  |
| `training.content.approve` | `training.content.approve` | Giữ | 2 / 0 / 2 |  |
| `training.content.review` | `training.content.review` | Giữ | 2 / 0 / 2 |  |
| `training.document_impact.manage` | `training.document_impact.assess` | Đổi tên | 1 / 0 / 2 |  |
| `training.job_assignment.exception.approve` | `training.job_assignment.approve_exception` | Đổi tên | 1 / 0 / 2 | Dạng `<tài nguyên>.<hành động>`. |
| `training.job_assignment.manage` | `training.job_assignment.manage` | Giữ | 32 / 3 / 2 | 32 chỗ dùng, gồm cả đánh giá nhân sự và đình chỉ; cần rà xem có nên tách. |
| `training.job_assignment.view` | `training.job_assignment.view` | Giữ | 17 / 6 / 3 |  |
| `training.material.manage` | (chuyển) `documents.revision.training.manage` | Chuyển module | 5 / 1 / 8 | Thuộc bước đào tạo của tài liệu (`TrainingAuthorizationService`, bảng chính sách mặc định của Documents); không phải Training Management. |
| `training.matrix.approve` | `training.matrix.approve` | Giữ | 2 / 0 / 2 |  |
| `training.matrix.manage` | `training.matrix.manage` | Giữ | 20 / 1 / 2 |  |
| `training.matrix.view` | `training.matrix.view` | Giữ | 17 / 7 / 3 |  |
| `training.module.view` | `training.module.view` | Giữ | 3 / 8 / 11 |  |
| `training.paper.transcribe` | `training.paper_record.transcribe` | Đổi tên | 2 / 0 / 3 |  |
| `training.paper.verify` | `training.paper_record.verify` | Đổi tên | 4 / 0 / 2 |  |
| `training.record.export` | `training.record.export` | Giữ | 13 / 3 / 2 |  |
| `training.record.view` | `training.record.view` | Giữ | 4 / 4 / 4 |  |
| `training.record.void` | `training.record.void` | Giữ | 1 / 1 / 2 |  |
| `training.requirement.approve` | `training.requirement.approve` | Giữ | 2 / 0 / 2 |  |
| `training.requirement.prepare` | `training.requirement.prepare` | Giữ | 10 / 1 / 2 |  |
| `training.requirement.review` | `training.requirement.review` | Giữ | 2 / 0 / 2 |  |
| `training.requirement.view` | `training.requirement.view` | Giữ | 5 / 3 / 3 |  |
| `training.scope.all` | `training.scope.all` | Giữ | 2 / 2 / 2 | Phạm vi mọi phòng ban; `DocumentService` cũng đọc quyền này (dùng chéo module, cần rà). |
| `training.self.view` | `training.my_training.view` | Đổi tên | 14 / 10 / 4 | Xem việc đào tạo của chính mình. |
| `training.settings.manage` | `training.settings.manage` | Giữ | 7 / 2 / 2 |  |
| `training.settings.view` | `training.settings.view` | Giữ | 5 / 5 / 2 | Hợp nhất với `training.admin.properties.view` (cùng tên "View Training Properties"). |
| `training.signature.confirm` | `training.specimen_signature.confirm` | Đổi tên | 7 / 2 / 2 |  |
| `training.signature.manage` | `training.specimen_signature.manage` | Đổi tên | 8 / 4 / 2 |  |
| `training.signature.view` | `training.specimen_signature.view` | Đổi tên | 6 / 3 / 3 | Màn hình tên "Specimen Signatures". |
| `training.trainer.exception.approve` | `training.trainer.approve_exception` | Đổi tên | 1 / 0 / 2 |  |
| `training.trainer.qualified` | `training.trainer.qualify_any_topic` | Đổi tên | 1 / 0 / 1 | Là cờ năng lực, không phải hành động; tên nói rõ phạm vi. |
| `training.admin.curriculums.view` | (bỏ) | Bỏ | 0 / 1 / 9 | Như trên. |
| `training.admin.quiz.view` | (bỏ) | Bỏ | 0 / 1 / 9 | Như trên. |
| `training.admin.requirement_templates.view` | (bỏ) | Bỏ | 0 / 1 / 9 | Như trên. |
| `training.admin.view` | (bỏ) | Bỏ | 0 / 2 / 9 | Chỉ giao diện dùng (menu), backend không kiểm tra; thay bằng quyền xem của chính màn hình. |
| `training.assignment.manage` | (bỏ) | Bỏ | 0 / 1 / 2 | Backend không dùng, 1 chỗ ở giao diện; việc này đã có `training.job_assignment.manage`. |
| `training.audit.view` | (bỏ) | Bỏ | 0 / 0 / 2 | Không dùng ở đâu; nhật ký Training dùng quyền Audit chung. |
| `training.session.manage` | (bỏ) | Bỏ | 0 / 1 / 2 | Backend không dùng; buổi học do `training.activity.organize` quản lý. |

## 6. Training: điểm cần quyết định hoặc cẩn thận

**6.1. `training.admin.manage` (18 chỗ).** Tách theo màn hình: nhà cung cấp 9 chỗ, ma trận 5 chỗ, thông báo 2 chỗ, chức danh công việc 2 chỗ (cộng 1 chỗ ở `NavigationService`). Năm chỗ ở `TrainingMatrixService` có thể đã trùng `training.matrix.manage`; cần đọc từng chỗ trước khi chốt, chưa xác minh. Bộ quyền đang chứa: Training - Administration (và một bộ DEV test); các bộ này nhận đủ ba quyền mới để giữ nguyên.

**6.2. Quyền chỉ có ở giao diện.** `training.admin.view`, `.curriculums.view`, `.quiz.view`, `.requirement_templates.view` được dùng để ẩn/hiện menu và route nhưng backend không kiểm tra. Đề xuất bỏ, thay bằng quyền xem của chính tài nguyên mà màn hình hiển thị. Cần kiểm tra các endpoint của những màn này có đang được bảo vệ bằng quyền khác không; nếu không, đó là lỗ hổng cần vá song song, không phải chỉ dọn tên.

**6.3. `training.material.manage` không thuộc Training Management.** Nó phục vụ bước đào tạo của tài liệu (`TrainingAuthorizationService`, chính sách mặc định trong `WorkflowActionDefaultPolicyRegistry`) và nằm trong tám bộ quyền. Đề xuất chuyển sang không gian tên `documents.` (đề nghị `documents.revision.training.manage`), cần chủ Document Control xác nhận tên.

**6.4. `training.scope.all` được `DocumentService` đọc.** Là dùng chéo module, nên khi đổi cấu trúc Document Control phải rà lại.

**6.5. Hai quyền rất rộng** (`training.activity.organize` 54 chỗ, `training.job_assignment.manage` 32 chỗ). Chưa đề xuất tách ở đợt này vì chưa đọc hết từng chỗ; ghi nhận để rà ở giai đoạn Training của kế hoạch.

**6.6. `training.attendance.receive` không nằm trong bộ quyền nào.** Cần xác nhận hôm nay ai thực sự nhận điểm danh, hay quyền này đã chết.

## 7. Cặp tách nhiệm đề xuất (SoD)

Hiện chỉ có hai cặp, đều của Document. Đề xuất thêm (chặn một người nắm cả hai quyền trong cùng bộ quyền, và chặn ở thời điểm chạy khi cùng một bản ghi; phần "cùng bản ghi" cần engine bổ sung):

| Cặp | Lý do |
|---|---|
| `reports.template.submit` và `reports.template.approve` | Người gửi duyệt template không tự duyệt (hiện đã chặn bằng mã ở `ReportTemplateRevisionService`, chưa là ràng buộc dữ liệu) |
| `training.requirement.prepare` và `training.requirement.approve` | Soạn và duyệt yêu cầu đào tạo |
| `training.matrix.manage` và `training.matrix.approve` | Soạn và duyệt ma trận |
| `training.assessment.design` và `training.assessment.approve` | Thiết kế và duyệt bài đánh giá |
| `training.paper_record.transcribe` và `training.paper_record.verify` | Người chép hồ sơ giấy không tự kiểm |
| `training.activity.conduct` và `training.record.void` | Người giảng không tự huỷ bản ghi của buổi mình dạy |

Đây là đề xuất, mỗi cặp cần chủ hệ thống xác nhận có đúng nghiệp vụ không (có thể có đơn vị nhỏ phải kiêm nhiệm; nếu vậy cần ngoại lệ có ký và lý do).

## 8. Giữ phẳng (RBAC) cho cấu hình và quản trị

Theo quyết định: các màn cấu hình dùng `view` / `manage` là đủ, không cần quan hệ theo bản ghi: `reports.type.*`, `reports.properties.*`, `reports.appearance.*`, `reports.name_format.*`, `training.settings.*`, `training.annex.*`, `training.vendor.manage`, `training.job_role.manage`, `training.notification.manage`. Các bước có ý nghĩa pháp lý (duyệt template, duyệt yêu cầu/ma trận/bài đánh giá, huỷ bản ghi đào tạo) vẫn đi qua engine với ký điện tử.

## 9. Thứ tự thực hiện sau khi duyệt

1. Chủ hệ thống duyệt hoặc sửa bảng này (đặc biệt 4.1, 6.1, 6.2, 6.3, mục 7).
2. Đọc từng chỗ dùng của `report.module.export` và `training.admin.manage` để chốt chính xác quyền thay thế.
3. Viết migration đổi mã tại chỗ + cấp quyền mới cho đúng các bộ quyền hiện giữ quyền cũ + cập nhật bảng chính sách và quy tắc thông báo; sửa mã backend và giao diện trong cùng một thay đổi.
4. Kiểm thử: bộ quyền nào cũng có quyền hiệu lực **bằng** trước khi đổi (so sánh Effective Access trước/sau cho từng người dùng thử nghiệm), cộng test âm cho từng quyền bị tách.
5. Ghi hồ sơ thay đổi theo mẫu `08_ONE_CHANGE_RECORD_TEMPLATE.md` và quyết định vào Decision Log.

## 10. Chưa làm / chưa xác minh

- Chưa đọc từng chỗ trong 27 chỗ của `report.module.export` và 18 chỗ của `training.admin.manage`.
- Chưa kiểm endpoint backend của các màn Training chỉ bảo vệ bằng quyền giao diện (6.2).
- Số liệu "dùng hiện nay" là đếm chuỗi trong mã nguồn; chuỗi được ghép động hoặc đọc từ cấu hình có thể bị bỏ sót.
- Chưa chạy bất kỳ thay đổi nào lên DEV.
