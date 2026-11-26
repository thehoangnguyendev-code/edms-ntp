# Kế hoạch: bộ đếm việc cần làm trên menu sidebar

Ngày lập: 26/11/2026. Trạng thái: **chủ dự án đã chốt Q1–Q5 (26/11/2026); đã làm phần Training, Pending My Review/Approval và mẫu báo cáo chờ duyệt trên DEV, chưa commit.** Xem mục 8.

## 1. Mục tiêu

Mỗi người dùng thấy trên từng menu số việc **đang chờ chính họ** ở menu đó. Làm xong thì số tự giảm, về 0 thì ẩn.

Không làm trong đợt này: thông báo đẩy mới, nhắc hạn, đếm việc của người khác hay của cả phòng.

## 2. Hiện trạng (đọc từ mã nguồn)

| Menu | Đang đếm | Nguồn |
|---|---|---|
| Pending My Review, Pending My Approval | Có | `GET /revisions/pending-counts` |
| My Tasks, My Training | Có | `GET /training/me/counts` (đào tạo phải học + chữ ký được yêu cầu) |
| Các menu còn lại | Không | |

Giao diện đã có sẵn chỗ hiển thị (`NavCountBadge`, `navCounts[menuId]`), gồm cả sidebar thu gọn. My Tasks được đọc lại mỗi 60 giây và khi đổi trang; hai menu Revision chỉ đọc lại khi đổi trang.

**Hai điểm cần sửa trước, nếu không số sẽ sai** (phát hiện khi đọc mã, chưa tái hiện trên màn hình):

1. `MyTrainingQueryService` đếm chữ ký đóng đợt rà soát đào tạo (`REVIEW_CLOSE`) ngay từ lúc mở đợt, dù các mục còn chưa xong nên người đó chưa đóng được.
2. Cũng truy vấn đó không có nhánh cho `TRAINING_PERSONNEL_REVIEW`: dòng việc rơi vào nhãn "Training matrix" và không có mã.

## 3. Nguyên tắc

1. **Số được tính từ trạng thái hiện tại, không lưu bộ đếm.** Không có cộng trừ, nên không lệch. Làm xong, huỷ, đổi người hay thu quyền thì số tự đúng.
2. **Máy chủ tính theo người đang đăng nhập.** Giao diện không gửi mã người dùng.
3. **Cùng điều kiện quyền và phạm vi với danh sách.** Không đếm bản ghi mà người đó không mở được hoặc không được làm (kể cả phân tách trách nhiệm).
4. **Bấm vào menu phải thấy đúng những việc đã đếm.** Danh sách nào có bộ đếm phải có bộ lọc "Chờ tôi" cho ra đúng bằng số đó.
5. **Lỗi thì ẩn số, không hiện 0.**

## 4. Việc nào được đếm

Cột "Kiểu": **Đích danh** là việc giao cho một người cụ thể. **Hàng chờ chung** là việc ai có quyền cũng làm được.

### Đợt 1: Training Management (việc đích danh)

| Menu | Việc được đếm | Kiểu |
|---|---|---|
| My Tasks | Đào tạo phải đọc, học, thi; mọi chữ ký được yêu cầu (giữ như hiện nay) | Đích danh |
| Training Activities | Xem xét, phê duyệt nội dung hoặc hoàn thành; ngoại lệ giảng viên | Đích danh |
| Training Requirements | Xem xét, phê duyệt | Đích danh |
| Training Matrices | Xem xét, phê duyệt phiên bản | Đích danh |
| Job Assignments | Bước ký được giao; bản giao việc chờ tôi nhận | Đích danh |
| Training Reviews | Đợt rà soát đã đủ điều kiện, chờ tôi đóng | Đích danh |
| Specimen Signatures | Chữ ký được giao | Đích danh |
| Training Record Exports | Bản xuất chờ tôi duyệt | Đích danh |
| Legacy Training Evidence | Bằng chứng chờ tôi duyệt | Đích danh |

Phần lớn lấy từ `training_approval_assignments`, nhóm theo `object_type`.

### Đợt 2: Document Control, Reports, rà soát bảo mật

| Menu | Việc được đếm | Kiểu | Cần làm rõ |
|---|---|---|---|
| Pending My Review / Approval | Đã có | Đích danh | Kiểm lại với thứ tự ký tuần tự và uỷ quyền |
| Revisions Owned By Me | Bản bị trả lại hoặc chờ tôi làm bước tiếp | Đích danh | Trạng thái nào tính là việc của tác giả |
| Access Review (Security) | Mục chưa quyết định trong đợt tôi là người rà soát | Đích danh | |
| Periodic Review (Audit Trail) | Như trên | Đích danh | |
| Report Templates, Pending My Approval | Mẫu chờ duyệt mà tôi được duyệt | Hàng chờ chung | Loại người gửi |
| Controlled / Uncontrolled Copies, Ready for Distribution | Bản chờ phát hành | Hàng chờ chung | Có đếm không (Q2) |
| Document Impact Assessment | Chờ QA xác nhận | Hàng chờ chung | Có đếm không (Q2) |

Trước đợt 2 phải rà tiếp các module chưa khảo sát (Backup & Restore, SoD Violation Review, thu hồi bản sao, xem xét định kỳ tài liệu).

## 5. Thiết kế

### Máy chủ

- Một endpoint `GET /navigation/task-counts`, trả `{ "<menuId>": số }`.
- Mỗi module có một bộ đếm riêng cùng chung một giao diện (`menuIds()`, `count(user)`). Thêm menu mới là thêm một bộ đếm.
- Chỉ chạy bộ đếm cho menu mà người đó nhìn thấy.
- Một bộ đếm lỗi thì bỏ khoá đó, các menu khác vẫn có số.
- Chỉ đếm bằng truy vấn `count`, thêm chỉ mục khi đo thấy cần. Chưa dùng bộ nhớ đệm.

### Giao diện

- Một hook duy nhất thay cho hai lời gọi hiện nay.
- Đọc lại khi: đổi trang, quay lại tab, mỗi 60 giây, và khi nhận sự kiện `entity-changed` (gom lại, không gọi dồn).
- Menu cha đang đóng hiện tổng của các menu con; mở ra thì chỉ hiện ở con. Số trên 99 hiện "99+".
- Danh sách có bộ đếm được thêm bộ lọc "Chờ tôi"; bấm vào số mở danh sách đã lọc.

### Tránh đếm trùng

Một chữ ký đào tạo xuất hiện cả ở My Tasks và ở menu nghiệp vụ. Đề xuất: giữ cả hai, nhưng tổng của "Training Management" đếm **mỗi việc một lần**.

## 6. Quyết định cần chủ dự án

| Mã | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Việc giao đào tạo hiện ở cả My Tasks và menu nghiệp vụ, hay chỉ một nơi? | Cả hai |
| Q2 | Có đếm hàng chờ chung không? Nếu có, mọi người có quyền đều thấy cùng một số. | Chưa đếm ở đợt 1; đợt 2 đếm với màu khác |
| Q3 | Việc chưa tới lượt (ký tuần tự) có đếm không? | Không |
| Q4 | Việc quá hạn có cần đánh dấu đỏ không? | Để đợt sau |
| Q5 | Người được uỷ quyền ký thay có thấy số không? | Cần xác nhận cơ chế uỷ quyền trước khi trả lời |

## 7. Lộ trình và nghiệm thu

| Giai đoạn | Nội dung | Nghiệm thu |
|---|---|---|
| 0 | Chốt Q1 đến Q5; sửa hai điểm ở mục 2 | Số My Tasks khớp danh sách |
| 1 | Endpoint chung, hook giao diện, chuyển 4 menu đã có sang | Số không đổi so với trước |
| 2 | Đợt 1 Training, bộ lọc "Chờ tôi" | Mỗi menu: số bằng số dòng đã lọc |
| 3 | Đợt 2 | Như trên |

Kiểm thử cho mỗi bộ đếm:

- Hai người dùng thấy số khác nhau, đúng việc của mình.
- Làm xong, huỷ, đổi người được giao: số giảm.
- Mất quyền hoặc khác phạm vi phòng: không đếm.
- Người không được tự duyệt việc của mình: không đếm.
- Bộ đếm lỗi: ẩn số, menu vẫn dùng được.
- Đo thời gian endpoint với dữ liệu DEV hiện có; mục tiêu dưới 300 ms.

Trước khi sửa mã: chạy phân tích ảnh hưởng GitNexus cho `Sidebar`, `MyTrainingQueryService.counts`, `NavigationService`.

## 8. Kết quả thực hiện (26/11/2026)

Quyết định: Q1 cả hai; Q2 đợt 1 chưa đếm, đợt sau đếm bằng màu khác; Q3 không; Q4 không; Q5 có (hệ thống chưa có "ký thay", nên chỉ áp dụng cho trường hợp đổi người ký).

Đã làm: endpoint `GET /navigation/task-counts`; 8 menu Training; My Tasks; Pending My Review / Approval; mẫu báo cáo chờ duyệt; bộ lọc "Chờ tôi" trên các danh sách Training; sửa hai lỗi ở mục 2.

Khác với đề xuất: bấm menu không tự lọc; người dùng bật nút "Chờ tôi" ngay trên danh sách.

Đợt hai cùng ngày: thêm Access Review, Periodic Review (Audit Trail), và ba hàng chờ chung màu vàng (bản sao kiểm soát, không kiểm soát chờ phát hành, Document Impact Assessment). Số không còn ẩn khi rê chuột.

Đợt ba cùng ngày: Revisions Owned By Me đếm **bản nháp bị trả lại** (chủ dự án chốt). Số được lưu tạm 10 giây cho từng người trong bộ nhớ máy chủ và bị xoá ngay khi có thao tác thay đổi dữ liệu. Lần đếm đầu vẫn khoảng 620 ms với người quản trị; lưu tạm chỉ giúp các lần gọi lặp lại.
