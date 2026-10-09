# Kế hoạch thay đổi: Mục đích sử dụng (Purpose) của Bản sao kiểm soát (Controlled Copy)

| | |
|---|---|
| Phạm vi | Cách DCO-QA **thao tác trên phần mềm** để yêu cầu, phân phối và thu hồi bản cứng có kiểm soát, và cách phần mềm hiển thị mục đích sử dụng |
| Áp dụng cho | Tất cả tài liệu (không giới hạn loại tài liệu) |
| Tình trạng | Các quyết định đã chốt (mục 8). Chờ QA phê duyệt để triển khai. Chưa triển khai |
| Căn cứ | Quy trình hiện hành của công ty; SOP.0001 (Kiểm soát hệ thống hồ sơ - tài liệu); SOP.0015 (Quy trình hủy) |

Cách đọc tài liệu: mỗi luồng được viết theo thứ tự thao tác trên phần mềm. Mục nào là **mới** thì ghi **(MỚI)**. Việc làm ngoài phần mềm (cầm bản giấy, đóng dấu, ghi chép, hủy giấy) chỉ nhắc ngắn và ghi **[ngoài phần mềm]**.

---

## 1. Mục tiêu

Quy trình công ty chia bản cứng có kiểm soát thành **hai mục đích**, nhưng phần mềm hiện chỉ có một ô lý do gõ tự do nên không phân biệt được. Thay đổi này làm cho phần mềm đi đúng quy trình:

1. DCO-QA chọn mục đích **ngay khi tạo yêu cầu** trên phần mềm.
2. Mục đích quyết định **cách thu hồi trên phần mềm** (có scan hay không, có tạo Hồ sơ hay không).
3. Mục đích được **ghi vào nhật ký kiểm toán**, **hiển thị ở trang chi tiết**, và có **cột Purpose cùng bộ lọc** ở mọi danh sách bản sao kiểm soát.
4. Các màn hình **Records** không hiện bản scan của bản **"Đọc và tuân thủ"**, chỉ hiện hồ sơ ghi chép.
5. **Chỉ áp dụng từ nay về sau**: các bản đã phát hành trước đây giữ nguyên, không phân loại lại.

## 2. Vai trò

| Vai trò | Làm gì trên phần mềm |
|---|---|
| **DCO-QA** | Tạo yêu cầu, chọn mục đích, phân phối, thu hồi (từng bản hoặc bằng scan). Ký điện tử các thao tác này |
| **Người sử dụng / bộ phận** | Nhận email thông báo bản đã hết hiệu lực. Không thao tác thu hồi trên phần mềm; trả bản giấy cho DCO-QA |
| **QA** | Xem nhật ký kiểm toán và Hồ sơ; phê duyệt kế hoạch này |

## 3. Hai mục đích sử dụng

| | **Đọc và tuân thủ** | **Ghi chép làm hồ sơ** |
|---|---|---|
| Dùng cho | Hướng dẫn công việc, quy chuẩn, danh mục thiết bị, tiêu chuẩn tham chiếu | Nhật ký, mẫu kế hoạch, mẫu báo cáo, bảng ghi dữ liệu |
| Thu hồi trên phần mềm | **Thu hồi thường: không scan**, DCO-QA nhập ngày và lý do | **Thu hồi bằng scan**: scan bản đã ghi, lưu thành Hồ sơ |
| Hồ sơ trên phần mềm | **Không** tạo Hồ sơ, không hiện ở các màn hình Records | **Có** tạo Hồ sơ, hiện ở các màn hình Records |
| Sau khi thu hồi | DCO-QA đóng dấu OBSOLETED, giữ đến đợt hủy và hủy theo SOP.0015 **[ngoài phần mềm]** | DCO-QA đưa vào phòng lưu trữ hồ sơ **[ngoài phần mềm]** |

## 4. Luồng thao tác trên phần mềm

### 4.1. Tạo yêu cầu bản cứng và chọn mục đích (cả hai mục đích)

**Ai:** DCO-QA. **Màn hình:** danh sách tài liệu hoặc trang chi tiết tài liệu, rồi *Request Controlled Copy*.

1. DCO-QA vào **Documents**, chọn tài liệu đang **Active** và bản **Effective**, bấm **Request Controlled Copy**.
2. Màn hình yêu cầu hiện thông tin tài liệu, revision và hạn dùng. DCO-QA chọn **nơi nhận**, **số bản**, nhập **lý do** như hiện nay.
3. **(MỚI)** Màn hình có thêm khối **"Mục đích sử dụng (Purpose)"** với **hai ô chọn**:
   - *Đọc và tuân thủ*
   - *Ghi chép làm hồ sơ*

   DCO-QA chọn **đúng một**. Không có ô nào được chọn sẵn, và **chưa chọn thì nút gửi không bấm được**. Mỗi ô có một dòng mô tả ngắn để chọn đúng.
4. DCO-QA bấm gửi, **ký điện tử**. Hộp thoại ký hiển thị lại mục đích đã chọn để kiểm tra trước khi ký.
5. **Hệ thống làm:** tạo yêu cầu ở trạng thái *Ready for Distribution*, gắn mục đích cho **mọi bản** của yêu cầu, và **ghi mục đích vào nhật ký kiểm toán** của yêu cầu và của từng bản.

Một yêu cầu chỉ có **một** mục đích. Cần hai mục đích thì tạo hai yêu cầu. Bản thay thế khi báo mất hoặc hỏng giữ nguyên mục đích của bản gốc.

### 4.2. Phân phối bản cứng (cả hai mục đích)

**Ai:** DCO-QA. **Màn hình:** *Controlled Copies*. **Không thay đổi so với hiện nay.**

1. DCO-QA vào **Controlled Copies**, chọn yêu cầu, bấm **Distribute** (hoặc **Distribute Batch**), ký điện tử.
2. **Hệ thống làm:** cấp số bản sao, tạo PDF có dấu, watermark và mã QR theo cấu hình; chuyển trạng thái *Distributed*.
3. DCO-QA in PDF, đóng dấu CONTROLLED và giao bản cứng **[ngoài phần mềm]**.

Từ lúc phát hành, **mục đích không sửa được**, vì nó quyết định cách thu hồi.

### 4.3. Bản "Đọc và tuân thủ": thu hồi không scan

**Ai:** DCO-QA. **Màn hình:** *Controlled Copies*.

1. Khi phiên bản mới có hiệu lực, **hệ thống tự chuyển các bản cũ sang Obsoleted** và gửi email thông báo cho người nhận (như hiện nay).
2. Người dùng trả bản giấy cho DCO-QA **[ngoài phần mềm]**.
3. DCO-QA vào **Controlled Copies**, dùng bộ lọc **Purpose = Đọc và tuân thủ** **(MỚI)** để thấy các bản cần thu hồi, mở bản vừa nhận.
4. Bấm **Recall Immediately**, nhập **Recall Date** (ngày nhận lại bản giấy) và **lý do** (ví dụ "Ban hành version mới 3.0"), **ký điện tử**. Có thể thu hồi cả lô bằng **Recall Batch Immediately**.
5. **Hệ thống làm:** ghi ngày thu hồi, lý do và người thu hồi; **không tạo Hồ sơ**; ghi nhật ký kiểm toán có chữ ký.
6. DCO-QA đóng dấu OBSOLETED lên bản giấy, cất giữ và hủy theo SOP.0015 **[ngoài phần mềm]**.

### 4.4. Bản "Ghi chép làm hồ sơ": thu hồi bằng scan

**Ai:** DCO-QA. **Màn hình:** *Controlled Copies > Recall by Scan*. **Giữ nguyên cách làm hiện có.**

1. Người dùng ghi chép vào bản giấy rồi trả cho DCO-QA **[ngoài phần mềm]**.
2. DCO-QA scan các bản đã ghi (PDF), vào **Controlled Copies > Recall by Scan**, tải các file lên. Hệ thống đọc mã QR, nhận ra từng bản và hiện danh sách để kiểm tra.
3. DCO-QA kiểm tra từng dòng, nhập **ngày nhận giấy**, tick xác nhận đã đối chiếu bản giấy, **ký điện tử một lần cho cả lô**.
4. **Hệ thống làm:** thu hồi từng bản, lưu mỗi bản scan thành **Hồ sơ (Record)** có dấu Obsoleted, ghi nhật ký kiểm toán cho từng bản.
5. DCO-QA đưa bản giấy vào phòng lưu trữ hồ sơ **[ngoài phần mềm]**.

### 4.5. Hiển thị mục đích trên các màn hình **(MỚI)**

**Ai xem:** DCO-QA, QA, và người dùng có quyền xem bản sao kiểm soát.

| Màn hình | Thay đổi |
|---|---|
| **Controlled Copies** (danh sách chính) | Thêm **cột Purpose**, sắp xếp được, nằm trong **Custom Column**. Thêm **bộ lọc Purpose** (Tất cả / Đọc và tuân thủ / Ghi chép làm hồ sơ) ở giao diện máy tính, bộ lọc gọn và điện thoại |
| **Trang chi tiết bản sao và lô phân phối** | Thêm trường **Purpose** ở thẻ *Document Information* |
| **Tab Controlled Copies** trong **trang chi tiết tài liệu** (thẻ con Controlled Copies) | Thêm **cột Purpose** |
| **Tab Controlled Copies** trong màn hình **tạo tài liệu** (thẻ con Controlled Copies) | Thêm **cột Purpose** |
| **Audit Trail** | Ghi mục đích khi tạo yêu cầu |

Cách hiển thị: mỗi giá trị hiện bằng nhãn rõ ràng (ví dụ "Đọc và tuân thủ", "Ghi chép làm hồ sơ"). Bản đã phát hành trước thay đổi này **để trống (dấu gạch)** vì thay đổi chỉ áp dụng từ nay về sau (xem 4.8).

### 4.6. Records không hiện bản scan của mục đích "Đọc và tuân thủ" **(MỚI)**

**Ai xem:** DCO-QA, QA và người có quyền xem Hồ sơ.

1. Menu **Records** ở thanh bên và thẻ **Records** trong trang chi tiết bản sao **chỉ hiện các bản scan của bản có mục đích "Ghi chép làm hồ sơ"**; bản scan của bản "Đọc và tuân thủ" **không hiện**.
2. Bản "Đọc và tuân thủ" thu hồi không scan nên bình thường không có Hồ sơ nào của nhóm này. Nếu DCO-QA lỡ dùng Recall by Scan cho bản này, hệ thống **không tạo Hồ sơ** (xem 4.7).
3. Hồ sơ đã tạo **trước** thay đổi này giữ nguyên, vẫn hiện như hiện nay (xem 4.8).
4. Màn hình Records vẫn giữ nguyên cách lọc, sắp xếp, tìm kiếm trên máy chủ và Custom Column.

### 4.7. DCO-QA lỡ dùng Recall by Scan cho bản "Đọc và tuân thủ"

> **Khách hàng đã chốt phương án này.**

**Vẫn cho thu hồi, nhưng không tạo Hồ sơ, và báo rõ cho DCO-QA ngay khi kiểm tra.**

1. Trong danh sách kiểm tra của **Recall by Scan**, dòng của bản "Đọc và tuân thủ" hiện thông báo: *"Bản này dùng để đọc: sẽ được thu hồi, không tạo Hồ sơ."*
2. Khi DCO-QA ký, bản này được **thu hồi bình thường** (ngày nhận giấy, chữ ký), **nhưng file scan không lưu thành Hồ sơ** và không hiện ở Records.
3. Các bản "Ghi chép" cùng lô vẫn tạo Hồ sơ như bình thường. Một lô có thể trộn cả hai loại.

Lý do chọn cách này:
- **Không làm khó DCO-QA:** bản giấy đã nhận về, mã QR hợp lệ; chặn sẽ buộc phải tách lô và làm lại, dễ sinh sai sót.
- **Không làm bẩn hồ sơ:** bản chỉ để đọc không phải hồ sơ ghi chép nên không được lưu vào Records.
- **Rõ ràng, có dấu vết:** thông báo hiện trước khi ký và nhật ký kiểm toán ghi "thu hồi bản Đọc và tuân thủ, không tạo Hồ sơ".

Phương án chặn hẳn bản "Đọc" trong Recall by Scan đã được cân nhắc và **không chọn**.

### 4.8. Chọn nhầm mục đích và bản đã phát hành trước thay đổi này

**Chọn nhầm mục đích (quyết định của khách hàng):** mục đích không sửa được sau khi phát hành. Muốn đổi phải **thu hồi bản cũ rồi tạo yêu cầu mới**:

1. Nếu yêu cầu **chưa phân phối**: DCO-QA hủy yêu cầu (chức năng hủy yêu cầu hiện có) rồi tạo lại với mục đích đúng.
2. Nếu **đã phân phối**: DCO-QA **thu hồi** bản đó (4.3 hoặc 4.4 tùy mục đích đã chọn nhầm), rồi bấm **Request Controlled Copy** để tạo yêu cầu mới với mục đích đúng.
3. Mọi bước đều có chữ ký và nhật ký, nên vẫn thấy được yêu cầu đầu, lý do thu hồi và yêu cầu mới.

**Bản đã phát hành trước thay đổi này (quyết định của khách hàng):** **không áp dụng**, chỉ áp dụng từ nay về sau.

1. Không phân loại, không điền, không sửa gì ở các bản cũ.
2. Cột Purpose của bản cũ **để trống (dấu gạch)**. Bản cũ chỉ hiện khi bộ lọc là **Tất cả**.
3. Bản cũ **thu hồi như hiện nay**, và Hồ sơ scan đã có **vẫn hiện ở Records** như trước.

## 5. Đối chiếu trước và sau thay đổi

| Nội dung | Hiện nay trên phần mềm | Sau thay đổi |
|---|---|---|
| Mục đích Đọc hay Ghi chép | Gõ chữ tự do ở ô lý do; không lọc, không báo cáo được | Chọn bắt buộc một trong hai; có cột, bộ lọc, trường chi tiết, nhật ký |
| Thu hồi bản chỉ để đọc | Recall từng bản; nếu dùng scan thì tạo Hồ sơ dù không cần | Recall không scan, không tạo Hồ sơ |
| Thu hồi bản ghi chép | Recall by Scan, tạo Hồ sơ | Giữ nguyên |
| Records (menu và thẻ) | Hiện mọi bản scan | Không hiện bản scan của bản "Đọc và tuân thủ" (bản cũ giữ nguyên) |
| Tab Controlled Copies trong chi tiết và tạo tài liệu | Không có thông tin mục đích | Có cột Purpose |
| Bản đã phát hành trước đây | Không phân loại | Không áp dụng, giữ nguyên; cột Purpose để trống |
| Chọn nhầm mục đích | Không có khái niệm mục đích | Thu hồi bản cũ và tạo yêu cầu mới |

## 6. Sự phù hợp với EU-GMP

Phần này chỉ trình bày các nguyên tắc thiết kế hướng tới, **không phải kết luận pháp lý**. QA cần xác nhận.

| Nguyên tắc | Cách phần mềm đáp ứng |
|---|---|
| Kiểm soát cấp phát và thu hồi tài liệu (Chương 4) | Mỗi bản có số, người nhận, ngày phân phối, ngày thu hồi, mục đích sử dụng; bản hết hiệu lực được thu hồi |
| Hồ sơ lưu trữ và truy xuất được | Bản ghi chép scan thành Hồ sơ, giữ nguyên bản gốc cùng mã băm |
| ALCOA+ | Mọi thao tác ghi người làm, thời điểm, lý do; không xóa dữ liệu, chỉ thêm lịch sử |
| Không ghi nhận dữ liệu chưa kiểm chứng | Bản cũ không tự điền mục đích, để trống |

## 7. Việc vẫn làm ngoài phần mềm

Phần mềm không kiểm soát được: đóng dấu CONTROLLED và OBSOLETED, bút bi xanh, gạch chéo ô trống, sửa sai có ký, cấm photocopy, cất giữ bản giấy đã thu hồi và việc hủy giấy theo SOP.0015 (phần mềm **không** ghi nhận việc hủy).

## 8. Các quyết định đã chốt

1. Mục đích áp dụng cho **mọi tài liệu**; DCO-QA chọn đúng một trong hai khi request.
2. Có cột Purpose và bộ lọc ở danh sách, trường ở trang chi tiết, cột ở hai tab con Controlled Copies; Records không hiện bản scan của mục đích "Đọc và tuân thủ".
3. Bản "Đọc và tuân thủ" thu hồi không scan; nếu lỡ dùng Recall by Scan thì vẫn thu hồi, không tạo Hồ sơ, báo rõ trước khi ký (4.7).
4. Chọn nhầm mục đích: thu hồi bản cũ và tạo yêu cầu mới (4.8).
5. Bản đã phát hành trước đây: không áp dụng (4.8).
6. Việc hủy giấy theo SOP.0015 làm ngoài phần mềm; phần mềm không ghi nhận.

Chưa còn điểm nào chờ khách hàng xác nhận. Bước tiếp theo là QA phê duyệt kế hoạch này để bắt đầu triển khai.
