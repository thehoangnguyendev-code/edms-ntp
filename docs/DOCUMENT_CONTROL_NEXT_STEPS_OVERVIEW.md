# Các hạng mục còn lại — giải thích dễ hiểu & kế hoạch triển khai

## Đây là gì?

Tài liệu này giải thích 6 việc **còn lại chưa làm** trong kế hoạch khắc phục Document Control (`DOCUMENT_CONTROL_REMEDIATION_PLAN.md`), viết theo cách không cần biết code để hiểu — dành cho người ra quyết định (business owner, quản lý dự án), không phải cho lập trình viên.

Mỗi mục có 4 phần: **Đang thiếu gì** (nói bằng ngôn ngữ nghiệp vụ) → **Vì sao quan trọng** → **Kế hoạch làm** → **Cần bạn quyết định gì / ước lượng thời gian**.

---

## 1. Hai nơi cùng kiểm tra quyền cho Controlled Copies (rủi ro: nút hiện nhưng bấm bị từ chối)

**Đang thiếu gì:** Trong phần Controlled Copies, hệ thống có 2 "trạm gác" kiểm tra quyền khác nhau cho cùng 1 hành động (ví dụ: Distribute, Recall, Cancel...). Bình thường cả 2 trạm gác phải luôn đồng ý hoặc luôn từ chối giống nhau — nhưng vì chúng là 2 đoạn code tách biệt, không đảm bảo 100% chúng luôn khớp nhau.

**Vì sao quan trọng:** Hậu quả cụ thể mà người dùng có thể gặp: màn hình hiện nút "Distribute" (vì trạm gác A cho phép), nhưng bấm vào thì bị báo lỗi "không có quyền" (vì trạm gác B từ chối). Đây là trải nghiệm khó hiểu và gây mất niềm tin vào hệ thống, dù không phải lỗ hổng bảo mật (hệ thống vẫn chặn đúng, chỉ là chặn không nhất quán).

**Kế hoạch làm:**
1. Liệt kê toàn bộ hành động của Controlled Copies (Request, Distribute, Recall, Cancel, Report Lost/Damaged, Retry, In, Batch Recall, Batch Cancel...).
2. Với mỗi hành động, xác nhận cả 2 trạm gác đang kiểm tra đúng 1 quy tắc, không lệch nhau.
3. Gộp lại còn 1 trạm gác duy nhất cho mỗi hành động — làm từng hành động một, kiểm thử kỹ sau mỗi lần gộp (không gộp hết 1 lần vì dễ gây lỗi phân quyền mới).

**Ước lượng:** Trung bình — cần rà từng hành động một cách cẩn thận, không thể làm nhanh trong 1-2 giờ. Khuyến nghị làm theo từng đợt nhỏ (2-3 hành động/đợt) và kiểm thử kỹ giữa các đợt.

**Cần quyết định:** Không cần quyết định nghiệp vụ, chỉ cần chấp thuận cho làm theo từng đợt nhỏ (không dồn 1 lần).

---

## 2. Chưa có mô-đun Đào tạo (Training) thật sự

**Đang thiếu gì:** Hiện tại, khi 1 tài liệu được đánh dấu "cần đào tạo trước khi hiệu lực", hệ thống chỉ có 1 ô để **nhập tay** ngày hoàn thành đào tạo. Không có danh sách nhân viên cần đào tạo, không có nhắc nhở, không có bằng chứng ai đã đào tạo, ai chưa.

**Vì sao quan trọng:** Đây là yêu cầu thường gặp trong GMP — khi 1 quy trình/tài liệu thay đổi, phải chứng minh được những người liên quan đã được đào tạo lại trước khi tài liệu có hiệu lực. Hiện tại hệ thống không tự động hóa việc này, tất cả phụ thuộc vào việc DCO nhớ nhập tay đúng ngày.

**Kế hoạch làm:** Đây **không phải một lỗi cần sửa** — đây là một tính năng lớn cần thiết kế mới từ đầu (giống như module Controlled Copies), gồm:
1. Xác định nhân viên nào cần đào tạo cho tài liệu nào (theo phòng ban? theo vai trò công việc? theo danh sách chỉ định tay?).
2. Theo dõi trạng thái đào tạo từng người (Chưa bắt đầu / Đang học / Đã hoàn thành / Đã kiểm tra đạt).
3. Tài liệu không được chuyển sang "Có hiệu lực" cho đến khi đủ điều kiện đào tạo.
4. Nhắc nhở tự động cho người chưa hoàn thành.

**Ước lượng:** Lớn — đây là một dự án con riêng, không phải một bản vá. Cần thời gian thiết kế + xây dựng + kiểm thử tương đương với 1 tính năng lớn của hệ thống.

**Cần quyết định (bắt buộc trước khi bắt đầu):**
- Có cần làm module này trong giai đoạn tới không, hay tạm chấp nhận cách nhập tay hiện tại?
- Nếu làm: nhân viên cần đào tạo được xác định như thế nào (phòng ban, vai trò, hay chỉ định tay từng người)?
- Có cần bài kiểm tra (quiz) sau đào tạo để xác nhận "đã hiểu", hay chỉ cần xác nhận "đã đọc"?

---

## 3. Trang danh sách Controlled Copies chưa phân trang thật ở tầng dữ liệu

**Đang thiếu gì:** Khi mở trang danh sách Controlled Copies, hệ thống hiện đang lấy **toàn bộ bản ghi phù hợp bộ lọc** về rồi mới cắt ra từng trang 10-20 dòng để hiển thị. Việc lọc (theo trạng thái, ngày, phòng ban...) đã tối ưu tốt rồi, nhưng bước "ai được xem bản ghi nào" và "cắt trang" vẫn làm ở phía sau, chưa đẩy hết xuống database.

**Vì sao quan trọng:** Hiện tại không ảnh hưởng vì số lượng dữ liệu còn ít. Nhưng khi công ty có hàng chục nghìn controlled copy tích lũy theo thời gian, mỗi lần mở trang danh sách sẽ chậm dần, tốn tài nguyên máy chủ hơn mức cần thiết.

**Kế hoạch làm:** Đây là phần **khó nhất về mặt kỹ thuật** trong danh sách này, vì lý do sau: việc "ai được xem bản ghi nào" hiện đang được tính bằng một đoạn logic khá phức tạp (kiểm tra nhiều điều kiện: có phải người nhận, có phải người yêu cầu, có quyền xem theo phòng ban tài liệu hay không...). Để đẩy toàn bộ logic này xuống thành 1 câu truy vấn database, cần thiết kế lại cẩn thận — làm ẩu ở bước này có rủi ro **vô tình cho xem nhầm bản ghi mà lẽ ra không được xem**, nên nhóm kỹ thuật ưu tiên an toàn hơn tốc độ ở bước này.
1. Thiết kế lại quy tắc "ai xem được gì" thành dạng có thể viết thành câu lệnh database (không đổi quy tắc, chỉ đổi cách tính).
2. Viết lại, kiểm thử kỹ với nhiều vai trò người dùng khác nhau để đảm bảo không ai bị lộ hoặc bị chặn nhầm.
3. Đo tốc độ trước/sau với dữ liệu giả lập lớn (thử với 50,000-100,000 bản ghi) để xác nhận cải thiện thật.

**Ước lượng:** Trung bình-lớn, chủ yếu do bước kiểm thử phân quyền phải rất kỹ.

**Cần quyết định:** Không cần quyết định nghiệp vụ. Có thể hoãn lại đến khi thực tế thấy trang danh sách bắt đầu chậm (không cần làm ngay).

---

## 4. Chưa có "1 nơi duy nhất" quyết định ai được làm gì với Document/Revision

**Đang thiếu gì:** Tương tự mục 1 nhưng ở quy mô lớn hơn — cho toàn bộ tài liệu/revision (không chỉ Controlled Copies). Hiện có nhiều đoạn code khác nhau tự quyết định "user này có được Upload, có được Nâng cấp revision, có được Duyệt hay không" — mỗi đoạn code tự kiểm tra theo cách riêng, không dùng chung 1 bộ quy tắc.

**Vì sao quan trọng:** Giống mục 1 nhưng ảnh hưởng rộng hơn — có thể gây ra tình huống 2 màn hình khác nhau cho cùng 1 user 2 câu trả lời khác nhau về việc họ có quyền gì. Đây cũng chính là nguyên nhân của một số lỗi kiểm thử tự động bị fail trước đây (Author/Co-Author upload revision).

**Kế hoạch làm:**
1. Liệt kê đầy đủ các hành động cần kiểm tra quyền: xem, sửa, upload file, nâng cấp revision, gửi duyệt, duyệt, đào tạo...
2. Xây 1 "bộ não" duy nhất trả lời "user X có được làm hành động Y trên revision Z hay không" — mọi nơi trong hệ thống (nút bấm hiển thị, API xử lý) đều hỏi cùng 1 bộ não này.
3. Viết bộ kiểm thử đầy đủ: thử với Author, Co-Author, Reviewer, Approver, DCO ở từng trạng thái tài liệu, đảm bảo kết quả đúng và nhất quán.

**Ước lượng:** Lớn — đây là việc tái cấu trúc một phần lõi hệ thống, cần làm cẩn thận theo từng giai đoạn, không thể làm gấp.

**Cần quyết định:** Không cần quyết định nghiệp vụ mới (chỉ là làm đúng theo quy tắc đã có), nhưng cần chấp thuận đây là việc lớn, nên lên lịch riêng thay vì làm xen kẽ việc khác.

---

## 5. Bằng chứng thất lạc/hư hỏng (Evidence) chưa có quy trình lưu trữ đầy đủ chuẩn GMP

**Đang thiếu gì:** Khi 1 bản Controlled Copy bị báo cáo Thất lạc/Hư hỏng, người dùng có thể tải ảnh/file bằng chứng lên. Hiện tại việc lưu trữ các file này còn thiếu một số bước mà GMP thường yêu cầu:
- Không tự động quét virus file được tải lên.
- Ảnh gốc và ảnh có đóng dấu (watermark) có thể không được tách lưu rõ ràng.
- Chưa có cơ chế "khóa không cho sửa/xóa version cũ" ở tầng lưu trữ file (object versioning).

**Vì sao quan trọng:** Bằng chứng thất lạc/hư hỏng là tài liệu có giá trị pháp lý/audit trong GMP — cần đảm bảo file gốc không thể bị thay thế âm thầm, và không có nguy cơ tải lên file độc hại.

**Kế hoạch làm:** Đây là việc cần **thêm dịch vụ bên ngoài**, không chỉ sửa code:
1. Tích hợp 1 dịch vụ quét virus (ví dụ ClamAV hoặc dịch vụ cloud tương đương) vào bước tải file lên.
2. Bật tính năng "object versioning" ở kho lưu trữ file (MinIO) cho riêng khu vực evidence — đảm bảo version cũ không mất khi có version mới.
3. Tách rõ nơi lưu ảnh gốc và ảnh đã đóng dấu thành 2 vị trí riêng biệt, không ghi đè lên nhau.

**Ước lượng:** Trung bình, nhưng phụ thuộc vào việc chọn và cấp phép dịch vụ quét virus (có thể mất thời gian mua/duyệt license nếu dùng dịch vụ trả phí).

**Cần quyết định:**
- Dùng dịch vụ quét virus miễn phí (ClamAV, tự vận hành) hay dịch vụ trả phí (nhanh hơn, ít bảo trì hơn)?
- Có ngân sách/thời gian duyệt mua dịch vụ ngoài không?

---

## 6. Dữ liệu giữa "lô phân phối" (Batch) và "từng bản copy con" có thể lệch nhau

**Đang thiếu gì:** Khi phân phối nhiều bản Controlled Copy cùng lúc (1 lô/batch), hệ thống lưu trạng thái ở 2 cấp: cấp lô và cấp từng bản con. Về lý thuyết 2 cấp này phải luôn khớp nhau (lô "Đã phân phối" thì mọi bản con cũng phải "Đã phân phối"), nhưng hiện chưa có cơ chế tự động phát hiện khi chúng lệch nhau.

**Vì sao quan trọng:** Nếu có lỗi hệ thống hoặc lỗi mạng giữa chừng khi xử lý 1 lô lớn, có khả năng (dù hiếm) lô hiển thị "Đã phân phối" nhưng 1-2 bản con bên trong thực ra chưa xử lý xong — người xem màn hình tổng quan (lô) sẽ không biết có bản con bị lệch.

**Kế hoạch làm:**
1. Xác định rõ: bản con là "sự thật", lô chỉ là con số tổng hợp tính lại từ các bản con (không lưu trạng thái lô riêng biệt có thể lệch).
2. Viết 1 công việc chạy định kỳ, tự so sánh lô và bản con — nếu phát hiện lệch, **báo cho quản trị viên biết, không tự động sửa âm thầm** (vì tự sửa âm thầm có thể che giấu lỗi thật sự cần điều tra).
3. Viết kiểm thử riêng cho tình huống "xử lý đồng thời" (nhiều người cùng thao tác 1 lô lúc) và tình huống "trạng thái hỗn hợp" (1 phần bản con đã xong, 1 phần chưa).

**Ước lượng:** Trung bình — cần thiết kế lại 1 phần logic tính trạng thái, nhưng không đụng đến giao diện người dùng.

**Cần quyết định:** Khi phát hiện lệch, có muốn hệ thống tự gửi cảnh báo email cho DCO/admin ngay lập tức, hay chỉ hiện trong 1 màn hình "cần kiểm tra" để xem theo định kỳ?

---

## Tổng kết — nên làm theo thứ tự nào?

| # | Việc | Mức độ khẩn cấp | Cần quyết định trước không? |
|---|---|---|---|
| 1 | 2 nơi kiểm tra quyền song song | Trung bình (ảnh hưởng trải nghiệm, không phải bảo mật) | Không |
| 2 | Module Đào tạo | Thấp về mặt kỹ thuật, **cao về mặt tuân thủ GMP** nếu đang cần | **Có — cần bạn xác nhận phạm vi trước** |
| 3 | Phân trang Controlled Copies xuống DB | Thấp hiện tại, sẽ tăng dần theo thời gian | Không, có thể hoãn |
| 4 | Thống nhất bộ não phân quyền Document/Revision | Trung bình, ảnh hưởng rộng | Không, nhưng cần lên lịch riêng |
| 5 | Evidence pipeline chuẩn GMP | Trung bình, liên quan tuân thủ | **Có — cần chọn dịch vụ quét virus** |
| 6 | Đồng bộ Batch/Bản con | Thấp-trung bình, rủi ro hiếm gặp | Nhẹ — cần chọn cách cảnh báo |

**Đề xuất:** Bắt đầu với mục 1 và 6 trước (rủi ro thấp, phạm vi rõ, không cần chờ quyết định từ bạn), song song xin quyết định cho mục 2 và 5 (cần bạn trả lời trước khi bắt đầu thiết kế), để mục 4 làm sau cùng (quy mô lớn nhất, nên làm khi các phần nhỏ hơn đã ổn định). Mục 3 có thể hoãn đến khi thực sự cần.
