# PLAN-TR-005 – Session của một hoạt động đào tạo: khi nào có, khi nào được thêm, và giao diện thêm session

**Viết cho:** chủ dự án và QA (để chốt quy tắc và giao diện trước khi dựng). **Trạng thái:** đã dựng ngày 2026-11-24 (V847, màn New và Edit Training Activity; quyết định DEC-TRAINING-2026-11-24-1). Chưa dựng: lặp theo ngày; xử lý thêm session sau khi danh sách đã xác nhận (giữ như cũ). Lập 2026-11-23 từ SOP.0003.02 (mục 4, 5.1.4, 5.3.3 đến 5.3.7) và mã hiện tại. Các điểm còn chờ quyết định ở mục 7.

## 1. SOP nói gì về session

| Điều khoản | Nội dung | Hệ quả cho thiết kế |
|---|---|---|
| Mục 4, định nghĩa | Buổi đào tạo là một buổi thuộc một hoạt động, xác định bởi **một hoặc nhiều chủ đề**, **cùng giảng viên**, **cùng một nhóm học viên** | Mỗi session có giảng viên và nhóm học viên của riêng nó; một session có thể gồm nhiều chủ đề |
| 5.1.4, dòng 163 | Một mã đào tạo có thể gồm **nhiều chủ đề, làm vào các ngày khác nhau**, miễn là **cùng một đơn vị tổ chức** | Các session của một hoạt động luôn thuộc một phòng tổ chức (đã đúng: phòng là của hoạt động) |
| 5.1.4, dòng 165 | Một mã đào tạo cấp cho **một chủ đề** và có thể gồm **một hoặc nhiều buổi** | Cùng một chủ đề chia nhiều buổi (nhiều nhóm, nhiều ca, nhiều ngày) |
| 5.3.3, dòng 263 | Buổi bị trễ hoặc dời lịch vẫn dùng mã cũ; lý do ghi lại | Dời lịch là **Hoãn** (Postpone) của session, không phải thêm session mới |
| 5.1.4, dòng 160 | Đào tạo bổ sung cho người vắng: giữ mã gốc, thêm hậu tố chữ cái, mỗi đợt một dòng trong sổ cấp mã | Là **hoạt động bổ sung** (Supplementary), không phải session thêm vào hoạt động đã xong |
| 5.3.4, dòng 277 | Danh sách phải gồm tất cả nhân viên trong phạm vi đào tạo, kể cả người đang nghỉ | Mỗi session có danh sách đủ người của nhóm đó |
| 5.1.2 | Mỗi hình thức đào tạo (tự đọc, tập trung, kết hợp trực tuyến, thực hành) có địa điểm và cách đánh giá riêng | Hình thức, địa điểm, đánh giá là thuộc tính của **session**, không của hoạt động |
| 5.1.1, dòng 98 đến 106 | **Đào tạo ban đầu gồm ba phần**, ba đơn vị đào tạo: HCNS (an toàn, nội quy), QA (nguyên tắc GMP), đơn vị liên quan (chuyên môn công việc) | Một mã (do QA cấp, 5.3.3) có **ba session, ba giảng viên thuộc ba phòng khác nhau** |
| 5.3.3, dòng 255 đến 261 | Đào tạo ban đầu và định kỳ: **QA** cấp mã và tổ chức. Đột xuất và bên ngoài: **phòng phát sinh nhu cầu** cấp mã và tổ chức | Phòng tổ chức quyết định mã; giảng viên có thể thuộc phòng khác |
| 5.3.6, dòng 329 đến 335 | Ban hành SOP lần đầu (v01): **phòng soạn thảo** đào tạo cho phòng mình và các phòng liên quan. Định kỳ hoặc nâng phiên bản: **trưởng từng đơn vị** đào tạo cho đơn vị mình | Một chủ đề, **mỗi đơn vị một session** (giảng viên là trưởng đơn vị đó) |
| 5.1.3, dòng 154 | Tài liệu mới hoặc nâng phiên bản: nên đào tạo xong trong **10 ngày** kể từ ngày duyệt tài liệu | Cảnh báo ngày của session so với hạn; không chặn |
| 5.3.6, dòng 341 | Không làm kịp trong tháng đã đăng ký theo yêu cầu đào tạo năm: chủ đề phải **dời sang tháng ngay sau** | Dời là Hoãn; hệ thống cần cảnh báo ngày session ra ngoài tháng đăng ký |
| 5.3.2 và 5.3.5 | Yêu cầu đào tạo (APD.0118) chỉ cho đào tạo định kỳ năm và SOP định kỳ; nội dung và bài kiểm tra do trưởng đơn vị liên quan và trưởng QA duyệt trước buổi đào tạo | Session mới thêm sau khi đã duyệt thì nội dung của nó chưa được duyệt, nên phải duyệt lại |

**SOP không nói:** cách tạo session trên giao diện, giới hạn số session, hay có được thêm session sau khi đã duyệt hoặc đã thông báo hay không. Khóa sau khi thông báo là quy định của hệ thống (quyết định của chủ dự án 2026-11-23), không phải yêu cầu của SOP.

## 2. Các trường hợp có session và cách hệ thống xử lý

| # | Trường hợp | Số session | Làm thế nào | Hiện nay |
|---|---|---|---|---|
| A | Một chủ đề, một buổi, một nhóm | 1 | Tạo hoạt động rồi điền session 1 | Có |
| B | **Một chủ đề, chia nhiều nhóm hoặc nhiều ca** (cùng nội dung, khác ngày, giờ, phòng, có thể khác giảng viên) | Nhiều | Thêm session; mỗi session **sao chép chủ đề, hình thức, đánh giá** từ session đã có, chỉ đổi ngày, nơi, giảng viên, nhóm | Phải nhập lại cả form, mỗi session một lần |
| C | **Nhiều chủ đề vào nhiều ngày**, cùng phòng tổ chức | Nhiều | Mỗi session một hoặc nhiều chủ đề riêng; nội dung và bài kiểm tra tách theo session | Có, nhưng form chỉ nhập **một** chủ đề dù server nhận nhiều |
| D | **Nhiều chủ đề trong một buổi** | 1 | Một session có danh sách chủ đề | Server nhận, form chưa cho nhập nhiều |
| E | Buổi dời lịch | Giữ nguyên | **Hoãn** session, ghi lý do, giữ mã | Có |
| F | **Người vắng** cần học bù (SOP 5.1.4: mã gốc cộng hậu tố chữ cái, danh sách riêng). **Người trượt** (5.3.7): SOP chỉ nói "đào tạo lại", không nói đặt mã | Hoạt động mới | **Supplementary Training** từ hoạt động đã Completed; hệ thống dùng chung hậu tố cho cả người trượt (mở rộng của hệ thống, GAP-TR-006 mục B6, C4) | Có |
| G | Tự đọc (mục 5.3.6) | 1 hoặc nhiều | Session hình thức tự đọc; danh sách APD.0108 theo phòng | Có |
| H | Đào tạo bên ngoài | 1 hoặc nhiều | Session không có hình thức, đánh giá hay giảng viên nội bộ | Có |
| I | Tài liệu mới hoặc nâng phiên bản (từ Document Control) | 1 hoặc nhiều | Chủ đề gắn sẵn với bản của tài liệu | Có, một chủ đề đầu tiên được điền sẵn |
| J | **Đào tạo ban đầu cho nhân viên mới** (ba phần: HCNS, QA, đơn vị liên quan) | 3 | Mã do QA cấp; ba session, mỗi session một chủ đề, giảng viên thuộc phòng đảm nhiệm phần đó, cùng một nhóm học viên mới | Làm được bằng tay; chưa có gợi ý ba phần |
| K | **Một SOP, mỗi đơn vị đào tạo cho nhân viên đơn vị mình** (định kỳ hoặc nâng phiên bản) | Một session mỗi đơn vị | Cùng chủ đề; giảng viên là trưởng đơn vị; nhóm học viên là nhân viên đơn vị đó | Làm được bằng tay, từng session một |
| L | **Yêu cầu đào tạo năm** (APD.0118) có nhiều chủ đề (GMP chung, toàn vẹn dữ liệu và kỹ thuật vô trùng, xu hướng lỗi) | Nhiều | Mỗi chủ đề một session hoặc nhóm chủ đề; ngày nằm trong tháng đã đăng ký | Làm tay; chưa liên kết với yêu cầu đào tạo |

## 3. Khi nào được thêm session (quy tắc đề xuất)

1. **Chỉ khi hoạt động còn Planned**, bởi người có quyền tổ chức trong phạm vi phòng của hoạt động (khớp với quyết định DEC-TRAINING-2026-11-23-10: từ Pending Approval trở đi không sửa kế hoạch).
2. Muốn thêm session sau khi đã gửi duyệt hoặc đã thông báo: bấm **Edit Content**, có lý do và chữ ký, quay về Planned, duyệt lại. Session mới có thể cần bài kiểm tra và tài liệu mới nên phải được duyệt.
3. **Không thêm session** vào hoạt động đã In Progress, Pending QA Confirmation, Completed hay Cancelled. Người cần học thêm sau đó dùng **Supplementary Training** (trường hợp F) hoặc một hoạt động mới.
4. Session mới phải đủ: ít nhất một chủ đề, hình thức và cách đánh giá (trừ đào tạo ngoài), giảng viên (trước khi thông báo), ngày, nơi. Giảng viên nội bộ phải đủ điều kiện (SOP 5.3.4) hoặc có ngoại lệ được duyệt.
5. Ngày của session có thể sau hạn (Due Date) hoặc ra ngoài tháng đã đăng ký: hệ thống **cảnh báo** như hiện nay, không chặn (SOP 5.1.3 và 5.3.6 dùng chữ "nên" và "dời", không cấm).
5a. **Giảng viên có thể thuộc phòng khác** phòng tổ chức (đào tạo ban đầu: HCNS, QA, đơn vị liên quan; mục 5.1.1). Danh sách chọn giảng viên không bị giới hạn theo phòng tổ chức, nhưng vẫn phải đủ điều kiện giảng viên (SOP 5.3.4).
6. **Khoảng hở hiện có cần sửa:** hiện server cho thêm session ngay cả khi danh sách người tham gia đã được xác nhận, nhưng sau đó lại **không cho thêm người** vào session mới (danh sách đã khóa). Đề xuất: thêm session vào hoạt động đã xác nhận danh sách thì **hủy xác nhận danh sách** (ghi Audit Trail, có chữ ký khi xác nhận lại), để người thêm vào session mới và xác nhận lại.
7. **Một người được học nhiều session của cùng hoạt động** (ví dụ đào tạo ban đầu: cùng nhóm nhân viên mới học cả ba buổi HCNS, QA, đơn vị). Server hiện đã cho phép; chỉ không cho thêm một người hai lần vào **cùng một** session. *(Bản trước của kế hoạch viết ngược lại là sai, đã sửa 2026-11-23.)*

## 4. Thiết kế giao diện

### 4.1. Vấn đề hiện tại
- Form thêm session dài, một chủ đề, không có cách sao chép.
- Muốn thêm session thứ hai phải cuộn xuống tìm nút "Add another session".
- Người tham gia thêm riêng từng session ở tab khác, nên người dùng không thấy tổng thể "ai học buổi nào".

### 4.2. Nguyên tắc
1. Danh sách session luôn thấy ngay, mỗi session một thẻ gọn: số thứ tự, chủ đề, ngày, giờ, nơi, giảng viên, số người, tình trạng chuẩn bị.
2. Nút **Thêm session** đặt cố định ở đầu danh sách (và ở hàng nút cuối trang, kèm bộ chọn session như đã chốt cho Đợt 3).
3. Thêm session mở **một khung bên cạnh (drawer)** chia ba bước ngắn: *Học gì* (chủ đề, hình thức, đánh giá), *Ai dạy, ai học* (giảng viên, người tham gia), *Khi nào, ở đâu* (ngày, giờ, địa điểm).
4. **Sao chép từ session** để nhanh trường hợp B: chọn một session đã có, hệ thống điền sẵn chủ đề, hình thức, đánh giá, giảng viên, nơi; người dùng chỉ đổi ngày và nhóm.
5. **Lặp theo ngày** cho trường hợp B: chọn nhiều ngày một lần, hệ thống tạo nhiều session cùng nội dung (xem lại trước khi lưu).
6. Nhiều chủ đề trong một session (trường hợp D) nhập bằng danh sách chủ đề, thêm bớt từng dòng; chủ đề từ tài liệu thì chọn bản tài liệu.
7. Phân người vào session ở ngay bước 2, hoặc bảng **Chia nhóm** với cột là session, cột là người: tick; một người có thể có ở nhiều session.
8. Trên điện thoại: drawer thành màn hình đầy, ba bước thành ba màn nối tiếp, nút Lưu cố định ở chân.
9. Mọi trạng thái đều có thiết kế: rỗng (chưa có session), một session, nhiều session, session đã hoãn hay hủy, khóa (không còn là Planned, hiện vì sao khóa và cách mở: Edit Content).

### 4.3. Ba hướng giao diện để chọn

**A. Danh sách thẻ + drawer ba bước (khuyên dùng).**
```
Sessions (3)                              [+ Thêm session ▾]
┌──────────────────────────────────────────────────────────┐
│ 1  SOP.0009 Thẩm định thiết bị      12/12  Phòng A  12 người │  [Sao chép] [Sửa]
│ 2  SOP.0009 Thẩm định thiết bị      13/12  Phòng B   9 người │  [Sao chép] [Sửa]
│ 3  SOP.0012 Vệ sinh khu A           15/12  Phòng A  12 người │  [Sao chép] [Sửa]
└──────────────────────────────────────────────────────────┘
Thêm session → drawer: ① Học gì → ② Ai dạy, ai học → ③ Khi nào, ở đâu
```
Hợp với số session ít đến vừa (1 đến 8), dễ dùng trên điện thoại, đủ cho cả B, C, D.

**B. Bảng một trang (như bảng tính).** Mỗi dòng là một session, sửa ngay trên dòng; thêm dòng bằng nút hoặc dán nhiều ngày. Nhanh cho người quen, nhưng trên điện thoại khó dùng và dễ nhập thiếu chủ đề, giảng viên.

**C. Trình dẫn từng bước cho toàn hoạt động.** Cả hoạt động đi qua các bước: chủ đề, các buổi, người tham gia. Rõ cho người mới, nhưng chậm với người đã quen và khó sửa một session riêng sau đó.

## 5. Phần việc (sau khi chốt mục 7)

| Bước | Việc | Kiểm chứng |
|---|---|---|
| 1 | Chốt quy tắc mục 3 trong Decision Log | Ghi quyết định có tên |
| 2 | Server: hủy xác nhận danh sách khi thêm session; không cho một người vào hai session; thêm nhiều session một lần (lặp theo ngày); sao chép từ session | Test âm tính: sai trạng thái, người trùng, hai người cùng lúc; Audit Trail |
| 3 | Giao diện: thẻ session, drawer ba bước, sao chép, lặp theo ngày, nhập nhiều chủ đề, chia nhóm, bản dịch Việt | Test giao diện; kiểm tra điện thoại; chụp màn hình |
| 4 | Cập nhật SDS, bảng truy vết SOP.0003 (mục 4, 5.1.4, 5.3.3) | QA ký |

## 6. Việc ngoài phạm vi
- Dời lịch (Hoãn) và đào tạo bổ sung đã có, không đổi ở đây.
- Cấp mã và hậu tố chữ cái của đào tạo bổ sung không đổi.

## 7. Điểm chờ quyết định
1. Hướng giao diện: A, B hay C (đề xuất A).
2. Thêm session vào hoạt động đã xác nhận danh sách: hủy xác nhận danh sách (đề xuất), hay chặn và bắt dùng Edit Content.
3. ~~Một người có được học hai session~~: đã trả lời, **được** (SOP mục 4.2: buổi đào tạo xác định bởi chủ đề, giảng viên và nhóm học viên; đào tạo ban đầu cùng một nhóm học ba buổi).
4. Có cần "lặp theo ngày" (tạo nhiều session một lần) hay chỉ cần "sao chép từ session" (đề xuất: làm cả hai, lặp theo ngày làm sau nếu thời gian eo hẹp).
