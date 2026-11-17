# Danh sách để owner tick: số mới và chức năng thiết lập số (2026-11-17)

Trạng thái: **ĐỀ XUẤT, chưa viết code.** Tick `[x]` vào mục đồng ý, sửa chữ nếu muốn khác. Quyết định đã chốt nằm trong Decision Log, mục `AUDIT-OBJECT-REGISTRY`.

## A. Số mới owner đã yêu cầu (làm chắc chắn)

Mỗi số cần: cột DB (+ migration, đánh số bù cho dữ liệu cũ), BE, API, FE hiển thị và tìm kiếm, và một dòng thiết lập định dạng. Đề xuất mặc định (admin đổi được):

| Số | Bảng hiện có | Định dạng mặc định đề xuất | Tick |
|---|---|---|---|
| Scheduled Report Number | `report_schedules` | `SRP-{YYYY}-{00001}` | [ ] |
| Audit Trail Campaign Number | `audit_trail_review_campaigns` | `ATC-{YYYY}-{0001}` | [ ] |
| Access Review Campaign Number | `access_review_campaigns` | `ARC-{YYYY}-{0001}` | [ ] |
| Object Access Rule Number | `object_access_rules` | `OAR-{00001}` | [ ] |
| Backup Alert Number | bảng cảnh báo sao lưu | `BAL-{YYYY}-{00001}` | [ ] |
| Announcement Number | `system_announcements` | `ANN-{YYYY}-{0001}` | [ ] |
| Restore Number | yêu cầu khôi phục (cần kiểm tra bảng và số đang có) | `RST-{YYYY}-{0001}` | [ ] |

Mã đã có sẵn, không thêm số mới: Job Assignments, Training Reviews, Specimen Signatures (mã nhân viên); Legacy Training Evidence (Training Number + Document Number); Training Record Exports (mã nhân viên hoặc Department).

## B. Chức năng thiết lập số (chọn một)

- [ ] **B1 (khuyên dùng):** một màn "Object Numbering" trong System Administration, mỗi loại một dòng, gom theo module. Document Control, Training, Report giữ màn thiết lập cũ của họ và được liệt kê ở đây dưới dạng liên kết.
- [ ] **B2:** thêm thiết lập vào menu quản trị của từng module (giống Document Name Formats, Training Code Rules).

Quy tắc chung cho mọi số (tick để áp dụng):
- [ ] Phần tử định dạng: tiền tố, năm, độ dài số thứ tự, đơn vị/phòng ban, ký tự phân cách; có xem trước.
- [ ] Số đã cấp không đổi và không dùng lại; đổi định dạng chỉ áp cho bản ghi mới.
- [ ] Mỗi lần đổi định dạng có ghi audit và (nếu là bản ghi GMP) cần lý do.
- [ ] Bộ đếm cấp số an toàn khi nhiều người tạo cùng lúc (khóa hàng/sequence), có test đồng thời.
- [ ] Đánh số bù cho bản ghi cũ bằng một đợt có ghi audit (D6).

## C. Đề xuất thêm (tôi gợi ý, bạn quyết)

| # | Đề xuất | Lý do | Tick |
| --- | --- | --- | --- |
| C1 | Tên duy nhất cho đối tượng nhóm B (Access Profiles, Permission Sets, Report Types, Training Vendors, Work Positions, Publishing Templates, Knowledge Hierarchies...) | Object Code là tên; tên trùng thì khó tìm khi review | [ ] |
| C2 | Báo cáo Report Types, Backup Alert Rule, Training Settings, Knowledge Hierarchy có **tên hiển thị** đọc được, thay tên kỹ thuật (`DOCUMENT_STATUS`, `CAPACITY_HIGH`, `Bulk-…`) | Không được dùng tên kỹ thuật làm Object Code | [ ] |
| C3 | Trong Object Code của lô Controlled Copy, audit của từng bản copy trong lô cũng ghi và tìm được theo mã lô | Bạn đã dặn ghi audit các mã bên trong lô | [ ] (đã chốt, tick để xác nhận phạm vi) |
| C4 | Một "danh bạ đối tượng" trong code: mỗi loại khai báo Object Type, module, nhóm, hành động; loại chưa khai báo thì build lỗi | Ngăn loại mới ghi tự do như hiện nay | [ ] |
| C5 | Báo cáo Audit Trail thêm cột Object Code, Object Type theo tên menu | Đồng bộ với màn hình | [ ] |
| C6 | Số cho Knowledge Share Link / Delegate | Hiện tên = phạm vi chia sẻ, đủ nhận ra. **Không khuyên làm.** | [ ] |
| C7 | Số cho Backup Schedules | Hiện là cấu hình có tên (nhóm B). **Không khuyên làm** nếu tên đã duy nhất | \[ \] |

## D. Việc không cần quyết (ghi để bạn biết)

- Các loại D2 là **dữ liệu lịch sử của chức năng đã gỡ**: FORM_SETTINGS (biểu mẫu điện tử đã retire ở V529), TRAINING_CALENDAR (lịch làm việc đã gỡ ở V633), OFFLINE_MEDIA và TRAINING_PERSON_POSITION_SET (không còn chỗ ghi trong code hiện tại). Chúng chỉ còn xuất hiện trong audit cũ, nên gán menu gần nhất hoặc "Legacy" khi hiển thị. Đề xuất: Object Type ghi tên chức năng cũ, module theo nơi nó từng thuộc.
- Thứ tự làm: (1) danh bạ đối tượng và sửa nơi ghi sai; (2) chức năng thiết lập số + các số mới + đánh số bù; (3) tách SETTINGS thành từ điển theo menu (Application Settings); (4) sắp xếp lại báo cáo và màn Audit Trail.
