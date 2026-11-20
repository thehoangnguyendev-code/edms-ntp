# Kế hoạch: Object Access Rule và Luật loại trừ cho mọi module (2026-11-19)

Trạng thái: THIẾT KẾ, chưa có code nào được sửa. Cần chủ sản phẩm/QA chốt các quyết định ở mục 4 trước khi làm.
Nhãn bằng chứng: [nguồn] = đọc trong code; [chưa kiểm] = suy đoán, chưa chạy thử.

## 1. Hiện trạng (đã đọc code)

### 1.1 Object Access Rule chỉ dành cho Document [nguồn]
- `ObjectResourceType` chỉ có: DOCUMENT_CATEGORY, DOCUMENT_TYPE, DOCUMENT_STATUS, DEPARTMENT, BUSINESS_UNIT, DOCUMENT.
- `ObjectAccessAction` chỉ có: VIEW, CREATE, EDIT, SUBMIT, REVIEW, APPROVE, PUBLISH (vòng đời Document/Revision).
- `ObjectAccessRuleService.getOptions()` chỉ nạp giá trị từ: department, business unit, document sub-type, document type, document status.
- Chỗ thực thi: `ObjectAccessEvaluationService.canAccessDocument / canAccessRevision`, được gọi từ DocumentResourceAdapter, RevisionResourceAdapter, ControlledCopy*Adapter, DocumentParticipantEligibilityService. Không module nào khác gọi.
- Hệ quả: form New/Edit Object Access Rule (kể cả bản E mới dựng) chỉ có ý nghĩa với Document Control. Training, Reports, Access Review, Audit Trail Review có cách giới hạn phạm vi riêng (Training: phòng ban + `training.scope.all`).

### 1.2 Luật loại trừ ("người này không được là người kia") [nguồn]
- Document: 6 cờ cố định trong `DocumentWorkflowSetting`, tab "Document Revision Integrity". Kiểm tra lúc chọn người tham gia (`DocumentParticipantEligibilityService`) và lúc lưu/gửi (`DocumentService`).
- Engine chung đã có cơ chế `forbidden` trên từng policy (`workflow_action_policy_relations.forbidden`, V807), admin sửa được ở Workflow Authorization (có chữ ký). Đã seed cho Report template (V807), Training (V810-V812, V816), Report schedule/run (V813).
- Access Review và Audit Trail Review: policy V814 chỉ có quyền `manage`, không có quan hệ nào; adapter `campaign()` trả về tập quan hệ rỗng. Không có luật chặn người xem xét tự xem xét mình. Người tạo mặc định cũng là người xem xét và là người hoàn tất.
- Training còn `keptApart` viết cứng trong `TrainingApprovalService` (lúc chỉ định người ký), song song với forbidden relation trong policy (lúc hành động). Hai nơi có thể lệch nhau [chưa kiểm].
- Access Profile: chặn tự cấp quyền critical cho chính mình, viết cứng (`AccessProfileService`:729).

### 1.3 Hai phát hiện cần xác minh khi chạy thật
- F1. `updateDocumentAdministration` nhận `signatureToken` trong request nhưng không gọi kiểm tra chữ ký nào (khác deleteUser, suspend...). Giao diện có hộp ký, backend không xác thực hay ghi lại chữ ký [nguồn, chưa chạy thử].
- F2. Policy của Access Review/Audit Review không có quan hệ nên hiện không thể cấu hình luật loại trừ cho hai module này qua Workflow Authorization.

## 2. Thiết kế A: Object Access Rule cho mọi module

Nguyên tắc: không thêm ô chọn "Training" vào form nếu backend chưa thực thi. Một luật hiện trên màn hình mà không có tác dụng là rủi ro dữ liệu/GMP.

- Mô hình luật mới: (Access Profile, module, object type, chiều phạm vi, giá trị phạm vi, các action, ALLOW/DENY, độ ưu tiên).
  - Cột mới `module_key`, `object_type` trên `object_access_rules`. Dòng cũ backfill `DOCUMENT_CONTROL` nên ý nghĩa không đổi.
  - Chiều phạm vi chung cho mọi module: Department, Business Unit. Chiều riêng do module khai báo.
- Mỗi module khai báo một `ObjectScopeProvider` (cùng kiểu với `ResourceAuthorizationAdapter`): chiều phạm vi của nó, danh sách giá trị cho ô chọn, và cách đọc thuộc tính của một bản ghi.
  - Document Control: category, type, status, từng document (như hiện nay).
  - Training Management: loại hoạt động/yêu cầu, ma trận, phòng ban.
  - Reports: loại report, mức nhạy cảm, nhóm.
  - Security Reviews: loại campaign.
- Action lấy từ catalog action của Workflow Authorization (đã có `ActionOption(value, label, workflowKey, objectType)`), không dùng enum 7 action của Document nữa.
- Engine: bước "object scope" (`isWithinObjectScope`) của từng adapter gọi bộ đánh giá chung. `ObjectAccessEvaluationService` tổng quát thành `evaluate(user, ObjectRef, action)`; thứ tự ưu tiên giữ nguyên.
- Giao diện: dùng lại bản E đã chọn, với ô chọn phụ thuộc như Policy Resolver: Module, rồi Object type, rồi Chiều phạm vi, rồi Giá trị, rồi Action. Danh sách rule thêm cột Module.
- Triển khai từng module một: shadow (ghi chênh lệch) rồi engine quyết định, theo mẫu `ShadowGuard`. Module chưa bật thì ô Module không hiện trong form.

## 3. Thiết kế B: Luật loại trừ cho mọi module, admin cấu hình

- Tránh nhân bản 6 cờ + 1 màn hình cho mỗi module. Dùng một danh mục luật do server sở hữu (như `documentAdministrationRules`): mỗi luật = (module, object type, vai bị loại, vai được loại trừ, bắt buộc hay cấu hình được, bật/tắt).
- Nguồn sự thật duy nhất là policy: bật một luật tạo hoặc bỏ dòng `forbidden` trên policy tương ứng, nên engine, shadow, audit, version và chữ ký dùng lại nguyên. Màn hình mới chỉ là lớp công tắc dễ hiểu bên trên Workflow Authorization.
- Hai điểm thực thi phải đọc cùng một cấu hình: lúc chỉ định người (danh sách người đủ điều kiện) và lúc hành động (engine). Training `keptApart` phải đọc cùng nguồn.
- Giữ nguyên 6 cờ Document (đang chạy, có kiểm soát). Không di chuyển dữ liệu của Document trong đợt này.
- Luật đề xuất theo module (cần quyết định ở mục 4):
  - Access Review: người xem xét không được quyết định dòng của chính tài khoản mình; người ký hoàn tất khác người tạo campaign (tuỳ chọn).
  - Audit Trail Review: người xem xét không được duyệt mục nhật ký do chính mình thực hiện.
  - Report template: tác giả/người gửi không được phê duyệt (đã có, chuyển thành công tắc có nhãn rõ).
  - Training: người chuẩn bị/người được giao không được phê duyệt (gom `keptApart` về chung một nguồn).
  - Access Profile: không tự cấp quyền critical cho mình (hiện viết cứng; giữ bắt buộc).
  - Backup & Restore: không thêm; quy trình đã chốt là một admin.
- Cần thêm: định nghĩa quan hệ mới và facts cho adapter (ví dụ ITEM_SUBJECT, ENTRY_PERFORMER, CAMPAIGN_CREATOR).
- API cấu hình luật: GET/PUT có phiên bản lạc quan, lý do, chữ ký điện tử được kiểm tra phía server, và audit từng thay đổi.

## 4. Quyết định cần ghi vào Decision Log (code không tự quyết được)
1. Đợt đầu làm module nào cho Object Access Rule, theo thứ tự nào.
2. Module không có luật nào: mặc định mở (như hiện nay) hay đóng.
3. Quan hệ với phạm vi sẵn có: Training (`training.scope.all`), Reports (quyết định hiển thị Report còn mở).
4. Mỗi luật loại trừ: bật sẵn hay tắt sẵn cho dữ liệu hiện có; bắt buộc hay admin tắt được.
5. ĐÃ CHỐT (2026-11-19, "admin có toàn quyền"): admin tự bật/tắt mọi luật loại trừ (kèm lý do, chữ ký, audit), không luật nào bắt buộc cố định, tổ chức một admin không bị khoá. Hiểu là toàn quyền CẤU HÌNH, không phải bỏ qua luật khi luật đang bật. Nếu ý là bỏ qua lúc chạy thì cần một quyết định riêng.
6. Đổi luật khi hồ sơ đang chạy: chỉ áp dụng từ lần hành động tiếp theo (như Document), cần xác nhận.
6b. ĐÃ CHỐT (2026-11-19, bản cuối): "vượt" = admin toàn quyền BẬT/TẮT cấu hình. KHÔNG có vượt luật lúc thao tác. Admin cũng là nhân viên GMP và dùng một tài khoản thường riêng cho việc nghiệp vụ; luật áp dụng cho tài khoản đó như mọi người. (Bản ghi "vượt lúc thao tác" trước đó là hiểu sai, đã rút.) Chưa chốt: có cần Permission Conflict Rule ghép quyền admin với quyền duyệt/phê duyệt để cấm một tài khoản vừa là admin vừa duyệt hay không.
7. Sửa F1 (chữ ký bị bỏ qua khi lưu luật Document): coi là lỗi cần sửa ngay, hay chờ đợt này.

## 5. Bằng chứng cần có (mỗi thay đổi có kiểm soát)
- Gọi API trực tiếp bị từ chối với `SEPARATION_OF_DUTIES` / từ chối phạm vi; sai phạm vi đối tượng; quyền đổi giữa chừng.
- Đồng thời: bật/tắt luật trong lúc có người đang thao tác; tải lại policy đã cache.
- Chữ ký: sai chủ, hết hạn, dùng lại.
- Trước mỗi lần sửa symbol: GitNexus impact; trước commit: `detect_changes`.
