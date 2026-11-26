# DESIGN

Quyết định thiết kế đã chốt cho giao diện EQMS (`eqms/`). Ghi lại để lượt sau không "sửa cho đúng luật" ngược lại.

## Phong cách chung
- Flat, màu nhấn emerald. Thẻ là `FormSection` (`rounded-xl border border-slate-200`), không bóng.
- Nhịp trang `space-y-4 md:space-y-6`; thẻ `p-4 md:p-5`; lưới form `gap-4`.
- Component dùng lại: `PageHeader`, `FormSection`, `Button`, `Select`, `Badge`, `WarningBanner`, `TablePagination`, `SectionLoading`, `TableEmptyState`. Không viết lại.
- Chữ nhỏ dùng `text-2xs`; nhãn ô nhập `text-xs sm:text-sm font-medium text-slate-700`.

## Màn Security & Authorization thiết kế lại (2026-11-18)
Mỗi màn có 4 wireframe, người dùng chọn một.

| Màn | Phương án | Ý chính |
|---|---|---|
| SoD Violation Review | B (vòng 2, dựng bằng component thật) | Cột trái "Violated rules" (chấm đỏ BLOCK, vàng WARN, số profile và số người, chip lọc), bên phải chi tiết quy tắc đang chọn (cố định từ `xl`), Scan History bên dưới. Trên màn hẹp chọn quy tắc thì tự cuộn tới phần chi tiết. Cặp quyền hiển thị dạng A / B xếp dọc. |
| New / Edit SoD Constraint | E (vòng 2, dựng bằng component thật) | Một cột, tác động trước: 1 chọn hai quyền (cảnh báo trùng lặp), 2 "Who this touches today" (hai ô số: Access Profiles và Users + danh sách), 3 chọn Warn/Block bằng hai thẻ nói rõ hệ quả kèm số người, 4 tên và Regulation Reference, Cancel/Save cuối trang. Badge tên Access Profile dùng màu blue (soft), không dùng viền đen. |
| Engine Diagnostics, Policy Resolver | E (vòng 2, dựng bằng component thật) | Một thẻ "Policy lookup" + thẻ "Recent lookups" (5 lần gần nhất, chỉ trong phiên) bên trái, "Resolution" cố định bên phải. Các ô phụ thuộc nhau: Module → Workflow → Resource type → Action → From status → Document type; ô sau khóa tới khi chọn ô trước, danh sách chỉ lấy theo module đã chọn. Nút Resolve khóa tới khi đủ ô bắt buộc. |
| Engine Diagnostics, Simulator | A (vòng 2, dựng bằng component thật) | Thẻ "Simulate a decision" ba mục đánh số (Who / Which record / What) bên trái, thẻ "Decision" cố định bên phải. Loại tài nguyên gom nhóm theo module, tên action dễ đọc (giá trị vẫn là mã), kết quả viết bằng lời, nút Evaluate luôn kèm lý do khi chưa bấm được. |
| Engine Diagnostics, Relation Definitions | A (vòng 2, dựng bằng component thật) | Bảng 8 cột tách riêng: No., Relation (mô tả), Code, Applies to (badge), Resolver, Resolver Config, Status, Updated; ở 1280 kéo ngang để xem hết. Chữ hiển thị chuyển từ mã chỉ để đọc, mã gốc giữ nguyên. Độ rộng ô nội dung bị giới hạn vì DataTable là `min-w-max`; cột Relation không sắp được (backend chưa hỗ trợ). |
| (Đã gỡ 2026-11-20) New / Edit Object Access Rule | E (vòng 2, dựng bằng component thật) | Một thẻ gọn: câu quy tắc trong khung xanh nhạt, Profile + Name, Resource Type + Resource Name, Actions, Effect (ALLOW/DENY) + Active, mục thu gọn "+ Description and precedence", Cancel/Save trong thẻ. Cancel + Save cũng ở header. Chưa làm: thẻ "rules already in force". |
| Shared permission picker (`PermissionSplitExplorer`) | D (vòng 2) | Dùng chung cho 6 màn (Permission Set, Access Profile, Role wizard, Workflow policy...). Ô tìm kiếm phía server, hàng chip module cuộn ngang kèm số đã chọn, quyền là thẻ bấm để chọn (lưới 1/2/3 cột), thanh đếm "N selected" + "Clear editable" ở dưới; quyền bị khóa hiện ổ khóa. |
| Access Review Campaign Detail (card đầu trang) | Làm lại | `FormSection`: tên campaign ở tiêu đề kèm trạng thái, mã `ARC-…`, mô tả, ba ô số Total / Reviewed / Pending + thanh tiến độ (Reviewed = Total − Pending), lưới Reviewer / Review Period / Signed / Created / Last Updated. |
| Segregation of Duties, Separation Rules (mỗi module một tab) | Theo tab Document Revision Integrity (chủ dự án yêu cầu giống hệt) | Tab theo tên module (lấy từ server); tiêu đề "<Module> Separation Rules" + một đoạn giải thích, rồi mỗi luật một ô tích với một câu ("The creator of the campaign cannot complete") và một dòng nghĩa; nhóm nhỏ theo workflow. Edit / Cancel / Reset / Save ở header, một lý do và một chữ ký cho mọi ô đã đổi. |
| Workflow Authorization, Transition Policy Details | Tách khỏi Edit (chủ dự án yêu cầu) | Màn chỉ đọc riêng, route `:id`: ba thẻ Policy / Actors / Relations, badge Active và System; nút ở header: Back, Edit Policy, Create Override, Duplicate, Activate/Deactivate, Reset Default (theo quyền). Edit là màn riêng `:id/edit` ("Edit Transition Policy"). Breadcrumb … > Transition Policies > Transition Policy Details. |
| (Đã gỡ 2026-11-20) New / Edit Object Access Rule, nhiều module | E mở rộng | Thêm ô Module ở đầu (Document Control mặc định); module khác có thêm Object Type, Applies to (Every record / Records in a status / Department) và Value; các ô phụ thuộc nhau và bị xoá khi đổi ô trước; Actions lấy từ object type. Danh sách có cột và bộ lọc Module. |
| Record visibility trên Access Profile (3 bộ chọn: Document Control, Training Management, Reports) | Thẻ radio | FormSection "<Module>: record visibility" + RadioGroup variant card (mỗi mức một thẻ, tiêu đề + một câu mô tả); mức đến từ Shared Permission Set bị khóa kèm câu giải thích; nằm đầu tab Permissions và bước Permissions của Wizard. Component: `DocumentControlVisibilityPicker`, `ModuleVisibilityPicker`. |

## New Job Assignment, ba bước (2026-11-26)
Chọn phương án A trong 4 wireframe. Stepper, rồi lưới: nội dung bên trái, cột phải 22rem cố định từ `xl` (dưới `xl` xếp xuống dưới). Bước 1: thẻ Employee, thẻ Work Positions (tìm, lọc bộ phận, danh sách tick nhóm theo bộ phận), thẻ "This Work Position" khi người đó đang giữ vị trí. Bước 2: một danh sách tick (Training Topic gõ vào ô tìm, SOP hiệu lực phân trang phía máy chủ). Bước 3: các thẻ xem lại, mỗi thẻ có nút Edit. Cột phải: Summary và Training check (bước 3 chỉ Training check). Cạnh nút Next/Create ghi vì sao đang khóa. Job Assignment Details (tab Matrix Check) dùng cùng danh sách tick (`RequiredTrainingsField`), thêm hàng chip các mục đã chọn ở trên; khi không sửa được chỉ còn hàng chip.

## Quy tắc rút ra
- Vùng nội dung ở 1280px chỉ khoảng 900px (có thanh bên): hàng 5 ô và lưới 2 cột trong thẻ hẹp chỉ dùng từ `2xl`; dưới đó xếp một cột.
- Danh sách chọn record (Simulator) rộng hết khung, không nằm trong cột hẹp.
- Thẻ tóm tắt cố định (`xl:sticky xl:top-4`) luôn có Cancel và Save; trên màn hẹp nó nằm dưới form.
- Tóm tắt bằng câu đọc được (không dùng mã) trước, chi tiết sau.
- Form: bấm Save khi thiếu thì hiện chữ đỏ dưới từng ô chưa đạt (không dùng toast), tự biến mất khi ô hợp lệ, cuộn tới ô lỗi đầu tiên. Save ở header cạnh Cancel; nút cuối trang canh trái.
- Chữ trong câu luật không viết hoa giữa câu (trừ viết tắt QA, GMP...); mã trạng thái thô (IN_PROGRESS) hiển thị thành chữ đọc được, chỉ để xem, không gửi lại server.
- Nhiều thay đổi cùng một lần lưu dùng MỘT chữ ký (token chỉ dùng được một lần): màn lưu hàng loạt gọi endpoint nhận cả danh sách thay đổi.

## Chưa làm
- Object Access Rule: thẻ "rules already in force" (cần truy vấn theo profile và resource). (Màn đã gỡ 2026-11-20.)
- Violation Review: bảng lịch sử không còn tùy chỉnh cột (thay bằng danh sách bấm được).
