# Kế hoạch phân quyền Document Control: hai trường hợp xem (2026-11-07)

Trạng thái: **ĐÃ XÂY (2026-11-07), đã triển khai lên DEV, chưa thử bằng tài khoản thật.** Bản gốc là thiết kế; những gì đã làm chính xác nằm trong mục DC-VISIBILITY-TIERS-2026-11-07 của Decision Log. Các quyết định của chủ sở hữu ghi ở mục 1 và trong Decision Log.
Nội dung này dựa trên đọc code và dữ liệu DEV ngày 2026-11-07. Chưa chạy với tài khoản thật. Chưa chạy phân tích tác động GitNexus (công cụ không có trong phiên làm việc này);
trước khi sửa từng hàm sẽ chạy hoặc ghi rõ là không chạy được.

## 1. Quyết định của chủ sở hữu

| # | Quyết định |
|---|---|
| D1 | Knowledge Base là kênh đọc tài liệu đã hiệu lực. Document Control là nơi làm việc. Người chỉ cần đọc dùng Knowledge Base. |
| D2 | Tách Knowledge Base khỏi Document Control: route Explorer chỉ đòi `self_service.knowledge.view`, không đòi `documents.module.view`. |
| D3 | Yêu cầu Controlled/Uncontrolled Copy vẫn đi qua Document Control. |
| D4 | Bản nháp và bản đang duyệt (Revision DRAFT, PENDING_REVIEW, PENDING_APPROVAL, PENDING_TRAINING, READY_FOR_PUBLISHING) luôn kín: chỉ người trong luồng và người có quyền xem tất cả. Không có công tắc nào mở được. |
| D5 | **Hai trường hợp xem** (chốt lại 2026-11-07): (a) có tên trong flow thì thấy đúng phần đó, mặc định, không cần cấu hình; (b) một số user (lãnh đạo, QA, kiểm toán) được tick bộ **xem hết**, thấy cả bản nháp. Ai chỉ cần đọc tài liệu Effective dùng Knowledge Base hoặc bộ lọc trạng thái của Document Control. |
| D6 | **Quyền thao tác (vận hành) tách riêng, không phải mức xem và không gắn với DCO.** Ai được cấp các quyền vận hành thì làm được; tương lai có thể giao cho người khác. |
| D7 | **Records chỉ theo quyền.** Ai được cấp quyền Records thì xem và tương tác Records; không có quyền thì không. Record không có flow (chỉ là nơi lưu bản scan). |
| D8 | 5 profile đang có xem-tất-cả Uncontrolled Copy mà không có Document thì **thu quyền đó về**. |
| D9 | Gộp ba quyền xem-tất-cả thành **một bộ**, có ràng buộc phụ thuộc, và hiển thị **nhãn phân loại tự động** trên Access Profile. Dùng tên "Visibility" để không trùng với business_unit_scope/department_scope của profile. |
| D10 | Menu Document Control và danh sách dùng **cùng một nguồn quyết định**. |
| D11 | Không làm ở giai đoạn này: ma trận mở theo trạng thái (Effective cho cả công ty), truy cập tạm thời cho thanh tra, chia sẻ theo từng tài liệu. |

## 2. Hai trường hợp xem, và quyền thao tác riêng

| Trường hợp | Xem | Làm được gì |
|---|---|---|
| Có tên trong flow (mặc định) | Chỉ thứ mình có tên: tác giả, đồng tác giả, reviewer, approver, người nhận/người yêu cầu bản sao | Việc của vai trò mình |
| Được tick bộ xem hết | Mọi Document, Revision (kể cả bản nháp), Controlled Copy, Uncontrolled Copy | Chỉ làm việc ở nơi có tên trong flow |

Quyền xem hết cũng cho xem xem-trước file và Audit Trail của bản nháp (hành vi hiện có của `isDirectStakeholder`); chủ sở hữu đã xác nhận chấp nhận.

**Quyền thao tác** là lớp thứ hai, độc lập với việc xem: một profile có thể có hoặc không, không phụ thuộc có bộ xem hết hay không. Đây không phải một "mức xem" và không có nhãn riêng.
Các quyền thao tác là những quyền không buộc tên trong flow (xem danh sách bên dưới): phát hành, hủy/ngừng hiệu lực, phân phối/thu hồi bản sao, duyệt bản sao không kiểm soát...

**Quyền vận hành** là các quyền mà bảng `workflow_action_policies` đang đòi mà không buộc người tham gia (actor chỉ là PERMISSION):
`documents.workspace.manage`, `documents.revision.open_publishing_workspace`, `documents.revision.cancel`, `documents.revision.obsolete`, `documents.revision.update_draft_metadata`,
`documents.revision.upgrade`, `documents.document.cancel/reopen/update_metadata`, `documents.controlled_copy.cancel_request/distribute/recall/expire/replace_lost_damaged/report_lost_damaged/upload_evidence/print`,
`documents.uncontrolled_copy.approve_request/reject_request/distribute`. Danh sách trong code sẽ có một kiểm thử đối chiếu với các dòng chính sách (parity), để không lệch khi thêm chính sách mới.

## 3. Ma trận theo thực thể

| Thực thể | Có tên trong flow thấy | Được tick xem hết thấy | Ghi chú |
|---|---|---|---|
| Document | Tài liệu mình là tác giả hoặc tham gia ở mức Document/Revision | Tất cả | Không đổi so với hiện nay |
| Revision | Revision mình có tên | Tất cả | Không đổi |
| Controlled Copy | Bản mình là người nhận | Tất cả | Không đổi |
| Uncontrolled Copy | Bản mình là người nhận | Tất cả | Không đổi |
| Record | **Theo quyền Records (D7)** | **Theo quyền Records** | Thay đổi: bỏ ràng buộc "phải là người nhận bản sao gốc" |

Hành động của người trong luồng (đã đúng theo bảng chính sách): nộp duyệt và tải file nguồn chỉ **tác giả**; review chỉ **reviewer được gán**; phê duyệt chỉ **approver được gán**; xem/tải bản sao chỉ **người nhận** hoặc có quyền.

## 4. Quyền và Permission Set

1. Một Permission Set duy nhất **Document Control – View Everything** chứa: `documents.document.view_all`, `documents.controlled_copy.view_all`, `documents.uncontrolled_copy.view_all` cùng các quyền xem cơ bản. DEV đã có set tên "Document View All" dùng riêng cho một profile; sẽ xem xét dùng lại hoặc đổi tên thay vì tạo thêm.
2. Ba quyền xem-tất-cả đi cùng nhau. **Lưu ý:** bảng `permission_dependencies` chỉ là dữ liệu tham khảo (chỉ bộ kiểm tra vòng lặp `PermissionDependencyGraphService` dùng nó), nó **không** bắt buộc gì khi lưu. Vì vậy cách chính là gán bộ qua Permission Set (mục 1), nơi ba quyền luôn đi chung. Việc tick lẻ từng quyền chỉ được cảnh báo (mục 3), không bị chặn.
3. **Nhãn và cảnh báo tự động** trên Access Profile (không lưu, tính từ quyền): một nhãn duy nhất "Xem hết Document Control" khi có đủ ba quyền, và cảnh báo *Không nhất quán* khi chỉ có một hoặc hai trong ba. Không có trường nhập tay, nên không thể lệch với quyền thực. Đây là phần làm sau, không chặn các bước khác.
4. Quyền Records: `documents.form.view_executed_records` = xem toàn bộ Records. Tải file vẫn cần thêm `documents.form.download_executed_record`. Cập nhật mô tả trong `permissionCatalog.ts`.

## 5. Menu

- Nhóm Documents, Revisions: hiện khi user có `documents.module.view` và (có bộ xem-tất-cả, hoặc có tên trong ít nhất một Document/Revision, kể cả lịch sử khi bật "Retain Visibility").
- Nhóm Controlled Copies: hiện khi có quyền `controlled_copy.view` và (xem-tất-cả hoặc là người nhận ít nhất một bản).
- Nhóm Uncontrolled Copies: tương tự với `uncontrolled_copy.view` hoặc `.request`.
- Records: chỉ cần `documents.form.view_executed_records`.
- Cách làm: `NavigationService.getNavigation` nhận thêm user; một service nhỏ dùng truy vấn `exists` đúng với điều kiện của danh sách. Thanh bên đã tự tải lại menu mỗi 30 giây nên user vừa được gán sẽ thấy menu.
- Tìm kiếm menu (`searchNavigation`) và bản dự phòng ở `navigation.ts` đổi theo.

## 6. Dữ liệu DEV bị ảnh hưởng

**Thu quyền xem-tất-cả Uncontrolled Copy (D8).** 5 profile, mỗi profile có Permission Set riêng, không dùng chung với profile DCO:

| Profile | Permission Set | User |
|---|---|---|
| Approver Lead | Approver Lead managed permissions | approver.lead2, tuanda |
| Approver Test | Approver Test | approver.test1, user.c.test, user.d.test |
| Quality | Quality managed permissions | quality.lead1, quality.lead2 |
| UAT Approver - Quality | Document Approver; UAT Document Approver | user.f.test, user.h.test |
| UAT Document Contributor - Quality | UAT Document Contributor | (không có user) |

9 user mất khả năng xem mọi Uncontrolled Copy; họ vẫn thấy các bản mình là người nhận, và vẫn duyệt được yêu cầu theo quyền duyệt. Cần ghi chú: người duyệt yêu cầu bản không kiểm soát có thể cần thấy yêu cầu của người khác để duyệt; **cần kiểm tra lại màn Pending Approval sau khi thu quyền** (xem mục 9, câu hỏi 2).

**Mở rộng Records (D7).** Hiện Records chỉ thấy được khi là người nhận bản sao gốc (hoặc có xem-tất-cả Controlled Copy). Sau thay đổi, mọi người giữ `view_executed_records` thấy **tất cả** Records. Quyền này đang nằm ở 18 profile. Trong đó các profile không phải DCO/Admin sẽ vừa mở rộng quyền xem: Approver Lead (2 user), Approver Test (3), Quality (2), Reviewer Lead (3), Supervisor (2), Document Trainee (1), UAT Controlled Copy Recipient - Quality (1), UAT Document Security Admin (1), UAT Reader - Production (3), Viewer/Operator (2). Cần quyết định (mục 9, câu hỏi 1).

**Chế độ Record Visibility** trên DEV: không có khóa riêng trong cấu hình, nên đang theo mặc định PARTICIPANTS_ONLY (chặt).

## 7. Thay đổi code dự kiến

Backend
- Mới: một service phân loại (nhãn Visibility, kiểm tra không nhất quán, danh sách quyền vận hành) và truy vấn "có tên trong flow".
- `NavigationService` + `NavigationController`: menu theo user (mục 5).
- `ExecutedRecordService`: `canViewRecord`, `list`, `getDetail`, `previewFile`, `downloadFile` chỉ theo quyền (bỏ nhánh người nhận và xem-tất-cả Controlled Copy). Giữ quy tắc "Record của bản sao chỉ để đọc không hiện".
- Access Profile (API chi tiết/danh sách): trả nhãn và cảnh báo.
- Migration mới: tạo/đổi tên Permission Set bộ xem; ràng buộc phụ thuộc; thu `uncontrolled_copy.view_all` khỏi 5 set ở mục 6; (nếu quyết định) thu `view_executed_records` khỏi các set được chọn.
- Không đổi: `DocumentAuthorizationService` (xem Document/Revision), `canViewDocument` (Training, Report, Audit Trail, Calendar dùng).

Frontend
- `AppRoutes.tsx`: bỏ `documents.module.view` khỏi route Explorer (D2).
- `features/security-authorization` (thay đổi nhỏ, làm sau cùng): tối đa hai chỗ. (1) `AccessProfilePermissionsTab.tsx`: thêm một banner cảnh báo "thiếu quyền trong bộ xem hết" theo mẫu `modulesMissingViewPermission` đã có, và có thể tick ba quyền cùng nhau trong `handleToggle`. (2) `AccessProfileListView.tsx`: một cột hoặc nhãn "Xem hết" (cần backend trả cờ). Không đụng `lifecycle-policies`, `object-rules`, `sod`, `user-management`, `access-review`. Bước đầu (migration tạo Permission Set + thu quyền 5 profile) **không cần sửa gì** trong thư mục này vì màn hình Permission Sets và Permissions đã hiển thị quyền từ set dùng chung.
- `permissionCatalog.ts`: cập nhật mô tả bộ xem-tất-cả và quyền Records.

## 8. Kiểm thử

- Điều hướng: user không có tên và không có bộ xem: không thấy menu; được gán reviewer: thấy menu; có bộ xem: thấy menu; bỏ khỏi luồng: mất menu (trừ khi Retain Visibility).
- API trực tiếp: người trong luồng không đọc được Document/Revision/bản sao của người khác; Records: không quyền thì từ chối, có quyền thì thấy tất cả; Record của bản sao chỉ để đọc vẫn ẩn.
- Phân loại: tổ hợp quyền cho ra đúng nhãn; thiếu một quyền xem-tất-cả cho ra cảnh báo; danh sách quyền vận hành khớp với `workflow_action_policies`.
- Migration: chỉ đổi đúng 5 set; DCO/Administrator giữ nguyên quyền hiệu lực; chạy lại không đổi thêm.
- Route Explorer: user chỉ có `self_service.knowledge.view` vào được Knowledge Base.

## 9. Các câu hỏi đã được chủ sở hữu trả lời (2026-11-07)

1. **Records:** thu `documents.form.view_executed_records` khỏi các profile không phải DCO/Admin ở mục 6, cùng đợt triển khai. Danh sách profile cụ thể gửi chủ sở hữu duyệt trước khi chạy migration. Ai cần xem Records thì admin cấp lại.
2. **Người duyệt bản không kiểm soát:** sau khi thu quyền xem hết, người có quyền duyệt chỉ thấy các yêu cầu đang **chờ mình duyệt**, không thấy phần còn lại. Cần đọc code màn Pending Approval và `UncontrolledCopyService` trước khi làm, vì hiện danh sách chỉ có hai nhánh (xem hết hoặc người nhận).
3. **Xin bản sao cho người không có tên trong luồng tài liệu:** giữ chặt. Người vận hành (DCO hoặc người được cấp) yêu cầu hộ, như hiện nay. Không nới `requireCanViewDocument` ở hai luồng yêu cầu.
4. **Calendar:** giữ như hiện nay (gate theo `documents.module.view`; lịch vẫn chỉ hiện tài liệu người đó xem được qua `canViewDocument`/`canViewRevision`).

## 10. Việc chưa làm và giới hạn

- Chưa có bằng chứng chạy với tài khoản thật. Dữ liệu DEV ở mục 6 lấy trực tiếp từ cơ sở dữ liệu ngày 2026-11-07.
- Chưa xác minh khi Document/Revision bị OBSOLETED thì Controlled Copy được thu hồi thế nào (sẽ đọc trước khi làm).
- File `08_ONE_CHANGE_RECORD_TEMPLATE.md` nêu trong CLAUDE.md không có trong thư mục `eqms-backend/docs/validation`; bản ghi thay đổi sẽ theo kiểu các CHANGE_RECORD hiện có.
- Dòng chính sách vòng đời "VIEW cho Revision EFFECTIVE/OBSOLETED, bất kỳ ai có `documents.document.view`" tồn tại trong cơ sở dữ liệu nhưng phần code xem Document/Revision tôi đọc dùng điều kiện người tham gia, nên chưa rõ dòng này có tác dụng thực tế không. Cần xác minh trước khi coi bảng chính sách là nguồn duy nhất.
