# PLAN-TR-002: Khi nào cần Training Materials và Assessment (theo trường hợp và hình thức đào tạo)

Trạng thái: **ĐÃ LÀM trên DEV ngày 2026-10-23** (V642) theo các quyết định của chủ dự án ở mục 7 (D-52 đến D-55). D-56 và D-57 chưa được trả lời nên áp dụng đề xuất mặc định. Mọi quyết định vẫn chờ QA xác nhận.
Ngày: 2026-10-23. Căn cứ: SOP.0003 (mục 5.1.2, 5.3.5, 5.3.6, 5.3.7), SOP.0025 (nhà cung cấp đào tạo bên ngoài), mã nguồn Training Management hiện tại.

## 1. Vấn đề

Hiện nay tab **Training Materials** và **Assessment** luôn hiện và luôn cho tải file, nhưng **không có quy tắc nào** về lúc nào phải có:

- Không bước chuyển trạng thái nào đòi có file (kể cả soát nội dung, Notify, giữ buổi, gửi QA). "Nội dung đã duyệt" chỉ là hai chữ ký của người soát và người duyệt.
- Việc tải file không phụ thuộc Training method hay Assessment của buổi: buổi tự đọc vẫn thấy ô tải đề thi, buổi có bài kiểm tra vẫn đi tiếp được khi chưa có đề.
- Đào tạo gắn với một SOP đang hiệu lực vẫn bắt người dùng tải lại chính SOP đó nếu muốn có "tài liệu".

SOP không đòi một bộ file cố định cho mọi buổi; nó đổi theo loại nội dung và hình thức. Kế hoạch này gom các trường hợp để thiết kế quy tắc **có điều kiện**.

## 2. Hai khái niệm cần tách

| Khái niệm | Là gì | Ví dụ |
|---|---|---|
| **Nguồn nội dung** (content source) | Cái mà học viên học | SOP đang hiệu lực trong Document Control; nội dung CAPA/thay đổi đã duyệt; tài liệu do giảng viên soạn; khoá học bên ngoài |
| **Hình thức đánh giá** (assessment) | Cách chứng minh học viên đạt | Bài kiểm tra APD.0009; checklist APD.0009; quan sát thao tác; xác nhận đã đọc APD.0108 |

Tab Training Materials chứa nguồn nội dung (và tài liệu bổ sung). Tab Assessment chứa **mẫu** dùng để đánh giá (đề, đáp án, biểu mẫu checklist) và **bằng chứng** của buổi đã tổ chức (scan, file điền).

## 3. Các biến đã có trong hệ thống

| Biến | Giá trị |
|---|---|
| Loại hoạt động (kind) | Initial, Periodic, Unplanned, Retraining (bổ sung), External |
| Lý do (kind_reason) | New hire, Transfer, New SOP, New version of an SOP, CAPA, Audit finding, Visitor, Absence return, Absent make-up, Failed assessment, Other |
| Nguồn nội dung gắn kèm | Hoạt động gắn tài liệu (document_id, từ Document Control); chủ đề gắn tài liệu; chủ đề chuẩn từ ma trận; chủ đề nhập tay |
| Training method của buổi | Self-reading, Classroom, Hybrid, Practical |
| Assessment của buổi | Test (mặc định cho Classroom, Hybrid), Checklist hoặc Observation (Practical), Self-reading confirmation (Self-reading) |
| Đào tạo bên ngoài | Active hoặc Passive, có đơn vị đào tạo và mã tham chiếu nhà cung cấp |

Method và Assessment là thuộc tính **của từng buổi**, nên quy tắc phải tính theo buổi rồi gộp cho hoạt động.

## 4. Quy tắc đề xuất theo hình thức đào tạo (trục chính)

| Method + Assessment của buổi | Training Materials | Assessment (mẫu) | Bằng chứng khi tổ chức |
|---|---|---|---|
| **Self-reading** + Self-reading confirmation | **Bắt buộc có thứ để đọc**: tài liệu gắn kèm (SOP) hoặc ≥1 file/link | **Không có**. Ẩn ô đề thi và đáp án | Xác nhận đã đọc, ký APD.0108 (đã có) |
| **Classroom** hoặc **Hybrid** + Test | Bắt buộc có nội dung dạy: tài liệu gắn kèm hoặc ≥1 file/link. Slide bài giảng: tuỳ chọn | **Đề thi bắt buộc** (APD.0009). Đáp án: tuỳ chọn, nên có | Bài làm có chữ ký học viên, điểm; scan nếu làm trên giấy |
| **Practical** + Checklist | Tài liệu hoặc hướng dẫn công việc gắn kèm (bắt buộc ≥1) | **Biểu mẫu checklist bắt buộc** (APD.0009 bản checklist). Không cần đáp án | Checklist đã điền (scan hoặc file) |
| **Practical** + Observation | Như trên | **Không có file mẫu**; kết quả quan sát ghi vào kết quả từng người | Ghi nhận quan sát; scan nếu có |
| Hình thức đánh giá **khác mặc định của SOP** (được phép, đã ghi lại lý do) | Như theo method | Theo hình thức thực chọn (dòng tương ứng ở trên) | Như dòng tương ứng |

Quy tắc chung: **tải thêm tài liệu bổ sung luôn được phép** (slide, ví dụ) trong lúc chưa soát nội dung; nó không thay thế nguồn nội dung bắt buộc.

## 5. Quy tắc đề xuất theo trường hợp (trục phụ: nguồn nội dung và loại đào tạo)

| # | Trường hợp | Nguồn nội dung | Materials | Assessment | Ghi chú |
|---|---|---|---|---|---|
| 1 | SOP mới hoặc nâng phiên bản có đổi luồng quy trình (New SOP, SOP version), lớp học | SOP đã duyệt, **lấy từ Document Control** | **Tự có**: SOP là tài liệu. Slide: tuỳ chọn | Test (đề bắt buộc) | SOP.0003 5.1.2: lớp học cho SOP mới, hoặc nâng phiên bản có đổi luồng |
| 2 | SOP đổi nhỏ, đào tạo định kỳ SOP, chính sách, quy định nội bộ, cập nhật hướng dẫn công việc | SOP hoặc tài liệu đã duyệt | **Tự có** | Self-reading confirmation, **không đề** | SOP.0003 5.1.2: tự đọc, APD.0108 |
| 3 | Chủ đề chuẩn từ ma trận (nguyên tắc GMP cơ bản, CAPA/Deviation, yêu cầu pháp lý, chủ đề hằng năm), không gắn tài liệu | Giảng viên chuẩn bị (5.3.5: trích từ tài liệu hướng dẫn) | **≥1 file hoặc link bắt buộc** | Test: đề bắt buộc | Không có tài liệu kiểm soát để lấy làm nguồn |
| 4 | Nội dung từ thay đổi hoặc CAPA hoặc kết quả đánh giá (CAPA, Audit finding) | Nội dung đã duyệt của thay đổi hoặc CAPA | **≥1 file hoặc link bắt buộc** (hệ thống chưa liên kết trực tiếp CAPA và Change Control) | Theo method của buổi | SOP.0003 5.3.5 dòng 2. Về sau có thể liên kết thẳng |
| 5 | Nhân viên mới (Initial, New hire): ba phần An toàn lao động và chính sách (HR), GMP chung (QA), chuyên môn (bộ phận) | Mỗi phần một nội dung | Theo **từng buổi**; mỗi buổi tính như hình thức ở mục 4 | Theo từng buổi (HR thường tự đọc hoặc lớp học; GMP là Test; chuyên môn tuỳ) | Hoạt động nhiều buổi: yêu cầu tính cho từng buổi |
| 6 | Chuyển bộ phận, Quay lại sau vắng mặt trên 6 tháng (Transfer, Absence return) | Theo nội dung ma trận vị trí | Như trường hợp 1, 2 hoặc 3 tuỳ nội dung | Theo method của buổi | |
| 7 | **Đào tạo bổ sung** (Absent make-up, Failed assessment) | **Kế thừa hoạt động gốc** | **Không yêu cầu nhập lại**; dùng cùng nội dung của hoạt động gốc | **Dùng cùng đề của hoạt động gốc** (lần thi lại ghi vào kết quả, SOP 5.3.7) | Hiện hoạt động con tạo ra trống: cần tham chiếu về hoạt động gốc |
| 8 | **Khách tham quan** (Visitor) | Hướng dẫn trực tiếp của bộ phận (thay đồ bảo hộ, hành vi phòng sạch) | **Tuỳ chọn** (tờ hướng dẫn) | **Không yêu cầu** | SOP.0003 5.1.1: bộ phận hướng dẫn và giám sát |
| 9 | **Đào tạo bên ngoài** (Active, Passive) | Đơn vị đào tạo bên ngoài | **Tuỳ chọn** (tài liệu khoá học) | **Không theo APD.0009**; bằng chứng là chứng chỉ hoặc tài liệu của đơn vị đào tạo | Đã có đơn vị đào tạo và mã tham chiếu nhà cung cấp; đã bỏ bước duyệt nội dung |

## 6. Thiết kế đề xuất (để hình dung, chưa làm)

### 6.1 Quy tắc "đủ điều kiện" tính ở máy chủ
Một hàm duy nhất tính cho từng hoạt động (từ các buổi, nguồn nội dung và loại):
- `materials`: bắt buộc hay không, đã đủ chưa (có tài liệu gắn kèm, hoặc ≥1 file hoặc link loại CONTENT).
- `exam`: cần đề thi (có buổi dùng Test), `checklist` (có buổi dùng Checklist), đã có chưa.
- `reasons`: danh sách còn thiếu, hiện cho người dùng bằng tiếng Anh dễ hiểu.
Kết quả trả về trong `capabilities` của hoạt động để màn hình và các chặn dùng chung một nguồn.

### 6.2 Chặn ở đâu
- **Bước ký soát nội dung** (người soát ký cái mà họ đã thấy): nếu còn thiếu thì không cho ký, kèm danh sách thiếu.
- **Danh sách "cần làm trước khi Notify"** liệt kê cùng lý do.
- Sau khi soát: khoá như hiện nay (mở lại bằng "Reopen content").
- Hoạt động đang chạy và đã xong: không áp dụng ngược.

### 6.3 Màn hình
- **Training Materials:** dòng đầu là **"Approved document: SOP.xxxx Rev n"** (xem được, không sửa được) khi hoạt động gắn tài liệu; bên dưới là tài liệu bổ sung (tải thêm vẫn được).
- **Assessment:**
  - Buổi Test: ô "Test (APD.0009)" bắt buộc, "Answer key" tuỳ chọn.
  - Buổi Checklist: nhãn đổi thành "Checklist (APD.0009)".
  - Buổi Self-reading hoặc Observation: **ẩn** ô đề và đáp án, kèm câu giải thích "Không cần đề cho hình thức này".
  - Mỗi buổi có biểu thị riêng; hoạt động nhiều buổi gom theo buổi.
- Đào tạo bổ sung: hiện nguồn nội dung và đề **của hoạt động gốc** (chỉ xem), không có ô tải trống.
- Visitor và External: không hiện cảnh báo thiếu.

### 6.4 Dữ liệu
- Không cần cột mới cho mục đích file: giữ ba loại CONTENT, EXAM, ANSWER_KEY (ô EXAM dùng cho cả đề thi và biểu mẫu checklist, nhãn theo hình thức).
- Hoạt động bổ sung đã có `parent_activity_id`: dùng để tham chiếu về gốc.
- Không thay đổi hồ sơ cũ.

### 6.5 Thử nghiệm
Một bảng test theo mục 4 và 5 (mỗi dòng một ca): bảng ca và kết quả mong đợi (`materials`, `exam`, `checklist`, `reasons`), cộng thử chặn ở soát nội dung và Notify, thử đào tạo bổ sung kế thừa, thử màn hình ẩn hoặc hiện theo hình thức.

## 7. Quyết định (D-52 đến D-57)

Chủ dự án đã trả lời ngày 2026-10-23: **D-52** thiếu thì chặn việc chuyển bước; **D-53** đào tạo xuất phát từ tài liệu (tạo ở bước tạo tài liệu) thì lấy tài liệu làm nội dung, vẫn tải thêm được; **D-54** đào tạo bổ sung kế thừa (đã đối chiếu SOP.0003 5.3.7: "việc đào tạo lại được ghi lại trong bài kiểm tra của nhân viên"); **D-55** Visitor và External không bắt buộc, kèm **tuỳ chọn miễn** hoặc không (đã làm thành lựa chọn có lý do cho mọi hoạt động chưa soát nội dung).

Đã làm: quy tắc ở máy chủ (`TrainingContentRules`, 11 test theo bảng mục 4 và 5); chặn ở bước ký soát nội dung và ở Notify; lựa chọn miễn có lý do (audit); màn hình Training Materials và Assessment nói rõ cần gì, ẩn ô đề và đáp án khi không cần. Chưa làm: bảng kế thừa hiển thị nội dung và đề của hoạt động gốc cho hoạt động bổ sung (hiện chỉ ghi nhận "không yêu cầu", không hiện lại file của gốc).

| # | Câu hỏi | Đề xuất |
|---|---|---|

| # | Câu hỏi | Đề xuất |
|---|---|---|
| D-52 | Thiếu Materials hoặc Assessment thì **chặn** (ở bước ký soát nội dung) hay **chỉ cảnh báo**? | Chặn ở bước ký soát nội dung (SOP 5.3.5: nội dung và đề phải được soát và duyệt) |
| D-53 | Đào tạo gắn SOP: SOP có tự là tài liệu đào tạo không, và có cần file thêm không? | Có, SOP tự là tài liệu. File thêm (slide) tuỳ chọn |
| D-54 | Đào tạo bổ sung kế thừa nội dung và đề của hoạt động gốc (tham chiếu, không sao chép)? | Có |
| D-55 | Visitor và External không bắt buộc Materials và Assessment? | Có. Ghi lại bằng chứng ở danh sách tham dự hoặc chứng chỉ |
| D-56 | Observation có cần biểu mẫu ghi nhận không (SOP.0003 chỉ nói "quan sát thao tác thực tế")? | Chưa bắt buộc. Ghi nhận trong kết quả từng người; hỏi QA có muốn biểu mẫu |
| D-57 | CAPA và Change Control: hiện bắt tải file nội dung đã duyệt; về sau có liên kết trực tiếp với module CAPA hoặc Change Control không? | Làm bước này trước; liên kết thẳng để sau, khi có module |

## 8. Phần chưa làm, rủi ro

- Chưa làm gì ở mã nguồn.
- Rủi ro: hoạt động nhiều buổi có nội dung hỗn hợp (ví dụ nhân viên mới) làm quy tắc phức tạp; kiểm tra theo từng buổi giảm được rủi ro này nhưng phải thử kỹ.
- Cần QA xác nhận đúng cách hiểu SOP.0003 5.1.2 (bảng hình thức đào tạo) trước khi chặn người dùng.
