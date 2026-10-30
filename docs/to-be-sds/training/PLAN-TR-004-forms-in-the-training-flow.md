# PLAN-TR-004 – Các biểu mẫu APD và FRM trong dòng chảy đào tạo: dùng lúc nào, điền theo thứ tự nào, ai ký theo thứ tự nào

**Viết cho:** QA và chủ dự án (để chốt cách hệ thống dùng từng biểu mẫu). **Trạng thái:** tài liệu làm rõ, chưa có mã. Lập 2026-10-28 từ SOP.0003.02 (lưu đồ mục 5.2, mục 5.3, mục 6), nội dung từng APD/FRM trong `docs/training_docs/`, mã nguồn của module Training và PLAN-TR-003. Không phải phê duyệt GMP.

## 1. Hiểu đúng cách quản lý

| | APD (phụ lục) | FRM (biểu mẫu) |
|---|---|---|
| Là gì | Phụ lục của SOP.0003, SOP gọi là "Mẫu" | Biểu mẫu và sổ in ra điền tay |
| Nằm ở đâu | Danh sách quản lý ở **Training Properties** (người quản trị tải bản Word lên, bật bằng chữ ký điện tử) | Document Control, xin **controlled copy** như mọi biểu mẫu |
| Khi dùng | Hệ thống tự lấy **bản đang bật**, điền chính xác dữ liệu | Người dùng xin controlled copy, in, điền tay, giữ làm hồ sơ |
| Ký | **Chữ ký điện tử** trong hệ thống (có đường dự phòng in, ký tay, tải scan) | Ký tay trên bản giấy |
| Thuộc SOP.0003 | APD.0009, 0011, 0014, 0024, 0108, 0117, 0118 | FRM.0007, FRM.0044 |

**Hệ quả với phần đã làm trước đó (V697, nối Document Control):** hướng "tự lấy mẫu APD từ Document Control khi revision Effective" **không khớp** với cách quản lý trên. Nếu APD được tải lên ở Training Properties thì Document Control chỉ giữ bản tham chiếu. Phần nối đó nên **tắt** và để cơ chế tải lên và bật có chữ ký như ban đầu. Phần ghim phiên bản mẫu vào từng bản xuất vẫn dùng được.

## 2. Dòng chảy: biểu mẫu nào dùng lúc nào (theo lưu đồ 5.2 và mục 5.3)

| Bước | Ai | Biểu mẫu | Khi nào dùng | Hệ thống |
|---|---|---|---|---|
| **A. Ma trận đào tạo** | Trưởng đơn vị (vị trí quản lý cấp cao: QA lập) | **APD.0011** | Lập mới; cập nhật khi đổi mô tả công việc, sau rà soát năm, khi ban hành tài liệu mới | Ma trận theo bộ phận, theo phiên bản |
| **B. Yêu cầu đào tạo** | QA | **APD.0118** | Chỉ cho đào tạo **định kỳ hằng năm** và **SOP định kỳ**; lập và duyệt trước 31/12 | Phiếu yêu cầu |
| **C. Cấp mã đào tạo** | Bộ phận tổ chức | **FRM.0044** | Trước mỗi hoạt động đào tạo (cả 4 nhánh: đột xuất, định kỳ, ban hành SOP mới, ban đầu) | Hệ thống tự cấp số (cần quyết định, mục 6) |
| **D. Danh sách tham gia** | Bộ phận tổ chức | **APD.0117** (tự đọc: **APD.0108**) | Lập và báo người tham gia **trước** buổi đào tạo | Hoạt động đào tạo |
| **E. Chuẩn bị và duyệt nội dung** | Giảng viên; trưởng đơn vị và trưởng QA duyệt | (APD.0009 là mẫu của bài kiểm tra) | Trước buổi đào tạo | Thư viện bài kiểm tra |
| **F. Thực hiện đào tạo** | Giảng viên | APD.0117 (điểm danh, ký) | Trong buổi | Điểm danh, check-in có chữ ký |
| **G. Đánh giá** | Giảng viên, DCO | **APD.0009**, APD.0117 (cột kết quả), APD.0108 | Cuối buổi | Chấm điểm, kết quả đạt hoặc đào tạo lại |
| **H. Gửi kết quả cho QA** | Bộ phận tổ chức | APD.0117 (mục 6) | Danh sách: cùng ngày với tài liệu mới; kết quả: trong 7 ngày làm việc | Gửi QA, QA xác nhận hoàn thành |
| **I. Hồ sơ cá nhân** | QA | **APD.0014** | Cập nhật liên tục; in hằng năm hoặc khi yêu cầu | Hồ sơ do máy chủ ghi |
| **K. Bản giao việc** | Trưởng đơn vị giao, nhân viên nhận | **APD.0024** | Sau khi **xong ma trận** của vị trí | Bản giao việc |
| **L. Chữ ký mẫu** | Nhân viên, trưởng đơn vị, QA | **FRM.0007** | Khi vào làm; mỗi lần đổi chữ ký | Scan và ba trạng thái |
| **M. Điều chuyển** | Trưởng đơn vị tiếp nhận | APD.0024 (mới), quay lại D | Khi chuyển bộ phận hoặc địa điểm | Personnel Review |

## 3. Thứ tự điền và thứ tự ký của từng biểu mẫu

### APD.0117, danh sách tham gia: **một tờ, điền qua ba mốc**
1. **Trước buổi (mốc 1):** mã đào tạo (đầu trang); **mục 1** nội dung, bộ phận, loại đào tạo; **mục 2** bảng chủ đề (session, số SOP, chủ đề, hình thức, giảng viên, ngày thực hiện); **mục 3** từng buổi một (STT, mã NV, tên, bộ phận). **Ký:** người chuẩn bị danh sách (mục 4).
2. **Trong buổi (mốc 2):** cột **Ký tên** của mục 3 do từng người ký (hoặc ghi "Trực tuyến", "Vắng mặt"). Hệ thống: điểm danh có chữ ký, roll-call, check-in.
3. **Sau buổi:** **Ký:** giảng viên xác nhận học viên tham gia đầy đủ (mục 5, mỗi buổi một dòng). Danh sách gửi QA.
4. **Sau đánh giá (mốc 3):** điền cột **Kết quả** và **Kết quả đào tạo lại**. **Ký:** QA xác nhận hoàn thành (mục 6).
- **Thứ tự ký:** người chuẩn bị → từng học viên khi tham dự → giảng viên → QA.
- **Các trường hợp:** đào tạo bên ngoài chỉ ghi tên đơn vị hoặc cá nhân đào tạo; nhiều buổi thì có nhiều bảng (SS01, SS02 …); hình thức trực tuyến, vắng mặt; cột đào tạo lại chỉ điền khi có người không đạt; tự đọc dùng APD.0108 thay APD.0117.

### APD.0009, bài kiểm tra: **mỗi học viên một tờ**
- **Điền sẵn từ hệ thống (trước buổi):** danh sách chủ đề, loại đào tạo (4 ô: lần đầu, đào tạo lại, định kỳ, đột xuất), nội dung câu hỏi, số câu hỏi, số đào tạo và ô ký ở chân trang (từ phiên bản 2.0).
- **Điền theo từng học viên:** tên, mã nhân viên, đơn vị, ngày, thời gian làm bài.
- **Điền sau khi làm bài:** kết quả (đạt khi từ 7/10 điểm, ngược lại không đạt và đào tạo lại), nhận xét, người đánh giá.
- **Thứ tự ký:** học viên ký **mọi trang** khi hoàn thành và ghi ngày kiểm tra → giảng viên (người đánh giá).
- **Các trường hợp:** TH1 (câu hỏi tự luận hoặc nhiều lựa chọn) hay TH2 (checklist Đúng/Không đúng, dùng cho thực hành); loại đào tạo; chân trang không áp dụng cho trang cuối; đạt hay không đạt.

### APD.0108, tự đọc hiểu SOP
- **Điền sẵn:** bộ phận, mã và tên tài liệu kèm phiên bản, từng nhân viên (mã NV, tên, mã đào tạo).
- **Điền khi đọc:** ngày đọc hiểu, chữ ký của từng nhân viên.
- **Thứ tự ký:** từng nhân viên → **trưởng phòng xác nhận** (họ tên, chức vụ, ngày, ký, nhận xét). QA ghi hồ sơ cá nhân dựa trên APD.0108.

### APD.0118, yêu cầu đào tạo
- **Điền khi lập:** năm, số phiếu, loại (định kỳ SOP hoặc hằng năm), từng dòng (tháng, chủ đề).
- **Điền sau khi đào tạo xong:** các cột đánh dấu "*": **mã đào tạo, ngày đào tạo, chữ ký QA, nhận xét**, do nhân viên quản lý đào tạo của QA ghi.
- **Thứ tự ký (đầu phiếu):** **người lập** (training coordinator) → **người xem xét** (QA manager) → **người duyệt** (QM). Sau đó gửi bản sao cho các bộ phận.
- Từng dòng sau đó có chữ ký QA khi đào tạo xong.

### APD.0011, ma trận đào tạo
- **Điền:** bộ phận; bảng (STT, số SOP, tên chủ đề, các cột vị trí công việc, đào tạo hằng năm Có hoặc Không). Số cột vị trí thay đổi theo bộ phận; vị trí quản lý có thể ghi chung là "cấp quản lý".
- **Thứ tự ký:** trưởng đơn vị lập → các cấp có thẩm quyền duyệt (vị trí quản lý cấp cao: QA lập). Hệ thống: người lập ký, người được chỉ định duyệt ký.

### APD.0024, bản giao việc
- **Điền sẵn:** thông tin nhân viên (tên, mã, lần ban hành); trường hợp **bổ nhiệm lần đầu** hay **thay đổi hoặc bổ sung vị trí**; mã và phiên bản ma trận đã hoàn thành đào tạo.
- **Điền theo trường hợp:** bổ nhiệm lần đầu: bộ phận, vị trí, cấp trên, cấp dưới, người thay thế. Thay đổi hoặc bổ sung: vị trí hiện tại, lý do, vị trí mới, cấp trên, cấp dưới, người thay thế. Rồi **quyền hạn** và bảng **trách nhiệm, mô tả công việc**.
- **Thứ tự ký:** **người giao** (trưởng đơn vị; nếu người nhận là trưởng đơn vị, QM hoặc QP thì ghi rõ chức danh người giao) → **người nhận** (nhân viên).

### APD.0014, hồ sơ cá nhân
- **Điền:** họ tên, trình độ, ngày vào công ty; bảng lịch sử (nội dung hoặc mã SOP kèm phiên bản, ngày đào tạo, mã đào tạo). Cập nhật liên tục, in hằng năm hoặc khi có yêu cầu.
- **Thứ tự ký:** người chuẩn bị → trưởng phòng QA (mỗi lần xuất để in).

### FRM.0007, chữ ký mẫu (giấy, controlled copy)
- **Điền tay:** tên, mã NV, ngày vào công ty; **chữ ký ban đầu** (ngày, chữ ký lần 1, lần 2, trưởng đơn vị); mỗi lần đổi chữ ký có một khối riêng ("Thay đổi chữ ký lần …").
- **Thứ tự ký:** nhân viên ký lần 1 và lần 2 → trưởng đơn vị xác nhận → QA lưu.

### FRM.0044, sổ cấp mã (giấy, controlled copy)
- Mỗi bộ phận một sổ; mỗi dòng: ngày, mã đào tạo, mã SOP, chủ đề, số buổi, ghi chú. Không có chữ ký trong mẫu.

## 4. Điều hệ thống đang làm khác với "một tờ qua nhiều mốc"
- Hệ thống **không lưu bản biểu mẫu** tại mỗi mốc, mà tạo lại theo yêu cầu từ dữ liệu. Bản thật sự có giá trị hồ sơ là **dữ liệu trong cơ sở dữ liệu cộng chữ ký điện tử cộng Audit Trail**. Trừ bản xuất theo lô, bản PDF kèm e-mail khi gửi kết quả cho QA không được lưu.
- Một mẫu APD **dài nhiều mốc** (APD.0117, APD.0118) nên có **ảnh chụp bất biến tại các mốc quan trọng** (ví dụ khi gửi danh sách cho QA, khi QA xác nhận hoàn thành) để có "tờ đã ký" cố định.

## 5. Điểm cần chốt (QA)

| # | Câu hỏi | Gợi ý |
|---|---|---|
| 1 | Giữ tải lên ở Training Properties và **tắt nối Document Control** (V697)? | Có |
| 2 | **FRM.0044:** sổ điện tử của hệ thống có thay FRM.0044 không (sửa SOP.0003), hay giữ sổ giấy song song? | Sổ điện tử thay, sửa SOP |
| 3 | **FRM.0007:** giữ scan bản ký tay làm hồ sơ; bản hệ thống tự ghép chỉ để tham khảo, ghi rõ trên tờ? | Có; thêm ô số controlled copy và revision |
| 4 | Lưu **ảnh chụp bất biến** của APD.0117 và APD.0118 tại các mốc (gửi QA, hoàn thành)? | Có, kèm SHA-256 |
| 5 | Chữ ký học viên trong APD.0117 (cột Ký tên) và APD.0009 (ký mọi trang): chữ ký điện tử khi check-in và nộp bài, hay ký tay trên bản in rồi tải scan? | Hệ thống hỗ trợ cả hai; chọn cái nào là bản chính |
| 6 | Bản in APD cần ghi **số tài liệu và revision** (vì không phải controlled copy)? | Có |


---

# Phần 2 – Hợp đồng của từng APD và đặc tả màn hình quản lý (đã chốt hướng ngày 2026-10-28)

**Các điểm đã chốt:** (1) trường, trường hợp, thứ tự ký và mốc điền do **hệ thống cố định** cho từng mã APD; người dùng chỉ đặt token vào file Word, chọn kiểu hiển thị chữ ký và bật mẫu. (2) Quản lý APD ở **một menu riêng trong sidebar Training Administration**, giao diện hoàn chỉnh (không để ở tab của Training Properties). FRM xin controlled copy như thường lệ, không quản lý ở đây.

## 7. Cú pháp và nguyên tắc chung
- **Token:** `{{TÊN}}`, cùng cú pháp với Publishing Template. Một ô ký là một token riêng (ví dụ `{{LIST_PREPARED_SIGNATURE}}`). Một **dòng lặp** là một hàng của bảng chứa token lặp; một **khối theo trường hợp** là vùng được bao bằng `{{#CASE:TÊN}} … {{/CASE}}`.
- **Bắt buộc hoặc tuỳ chọn:** mỗi token có cờ. Thiếu token bắt buộc thì **không cho bật mẫu**.
- **Mốc điền (stage):** token nằm ở mốc nào thì chỉ điền khi đối tượng đã tới mốc đó; chưa tới thì để trống (ô ký ghi "chờ …" trong bản xem trước).
- **Chữ ký:** hệ thống chèn khối chữ ký (tên, ngày giờ, ý nghĩa, mã chữ ký ngắn) từ bản ghi chữ ký điện tử; kiểu hiển thị chọn trong ba kiểu của Publishing Template (gọn, chuẩn, chi tiết).
- **Token chung:** `{{FORM_CODE}}`, `{{FORM_REVISION}}` (nhãn phiên bản của mẫu đang dùng), `{{GENERATED_AT}}`; số trang dùng trường trang của Word.

## 8. Hợp đồng từng APD (token, trường hợp, ô ký, mốc)

### 8.1 APD.0117, danh sách tham gia (đối tượng: hoạt động đào tạo)
| Mốc | Nội dung | Token |
|---|---|---|
| M1 danh sách được lập | Đầu trang, mục 1, mục 2, mục 3 (cột tên) | `{{TRAINING_NUMBER}}` (bắt buộc); `{{ACTIVITY_CONTENT}}`, `{{DEPARTMENT}}`, `{{TRAINING_TYPE}}` (bắt buộc); **dòng lặp theo chủ đề của buổi:** `{{SESSION_NO}}`, `{{DOCUMENT_NUMBER}}`, `{{TOPIC}}`, `{{MODE}}`, `{{TRAINER}}`, `{{EXECUTION_DATE}}`; **khối lặp theo buổi (SSxx), dòng lặp theo người:** `{{ROW_NO}}`, `{{EMPLOYEE_CODE}}`, `{{PARTICIPANT_NAME}}`, `{{PARTICIPANT_DEPARTMENT}}` |
| M1 ô ký | Mục 4 | `{{LIST_PREPARER_NAME}}`, `{{LIST_PREPARED_SIGNATURE}}` ← `TRAINING_LIST_VERIFIED` |
| M2 buổi diễn ra | Cột Ký tên | `{{ATTENDANCE_SIGNATURE}}` ← `TRAINING_ATTENDED` (check-in), `TRAINING_ATTENDANCE_CONFIRMED` (roll-call), hoặc "Trực tuyến", "Vắng mặt" |
| M2b gửi danh sách | Mục 5 (mỗi buổi một dòng) | `{{TRAINER_NAME}}`, `{{TRAINER_SIGNATURE}}` ← `TRAINING_ATTENDANCE_SENT` |
| M3 kết thúc đánh giá | Cột kết quả | `{{RESULT}}`, `{{RETRAINING_RESULT}}` (chỉ điền khi `TRAINING_RESULTS_FINISHED` đã có) |
| M4 QA hoàn thành | Mục 6 | `{{QA_CONFIRMER_NAME}}`, `{{QA_COMPLETION_SIGNATURE}}` ← `TRAINING_COMPLETED` |
- **Trường hợp:** `EXTERNAL` (đào tạo ngoài: chỉ tên đơn vị hoặc cá nhân đào tạo, không có cột kết quả); nhiều buổi (khối lặp); có người đào tạo lại (hiện cột đào tạo lại). Tự đọc không dùng mẫu này (dùng APD.0108).
- **Thứ tự ký:** người chuẩn bị → từng học viên → giảng viên → QA.

### 8.2 APD.0009, bài kiểm tra (đối tượng: bài của một học viên)
- **Token đầu bài (M1):** `{{TRAINING_TOPICS}}`, `{{TYPE_INITIAL}}`, `{{TYPE_RETRAINING}}`, `{{TYPE_PERIODIC}}`, `{{TYPE_UNPLANNED}}` (ô chọn), `{{QUESTION_COUNT}}`, `{{TEST_CONTENT}}` (khối nội dung bài), `{{TRAINING_NUMBER}}` (chân trang mỗi trang trừ trang cuối).
- **Theo học viên (M1b):** `{{TRAINEE_NAME}}`, `{{EMPLOYEE_CODE}}`, `{{DEPARTMENT}}`, `{{TEST_DATE}}`, `{{TEST_DURATION}}`.
- **Sau bài (M2):** `{{RESULT_PASS}}`, `{{RESULT_FAIL}}`, `{{RESULT_SCORE}}`, `{{REMARKS}}`, `{{ASSESSOR_NAME}}`, `{{ASSESSOR_SIGNATURE}}`, `{{TRAINEE_SIGNATURE}}` (mọi trang), `{{ASSESSMENT_DATE}}` ← `TRAINING_ASSESSMENT_SIGNED`.
- **Trường hợp:** `QUESTIONS` (TH1) hay `CHECKLIST` (TH2); ngưỡng đạt do Training Properties (hiện 70%).
- **Thứ tự ký:** học viên → giảng viên. Việc dựng nội dung câu hỏi vẫn do bộ dựng bài kiểm tra hiện có; hợp đồng chỉ chuẩn hoá phần thông tin quanh bài.

### 8.3 APD.0108, tự đọc hiểu SOP (đối tượng: buổi tự đọc)
- **M1:** `{{DEPARTMENT}}`, `{{DOCUMENT_NAME_VERSION}}`; dòng lặp theo người: `{{ROW_NO}}`, `{{EMPLOYEE_CODE}}`, `{{EMPLOYEE_NAME}}`, `{{TRAINING_NUMBER}}`.
- **M2 khi đọc:** `{{READING_DATE}}`, `{{EMPLOYEE_SIGNATURE}}` ← `TRAINING_READ_CONFIRMED`.
- **M3 trưởng phòng:** `{{HEAD_NAME}}`, `{{HEAD_POSITION}}`, `{{HEAD_DATE}}`, `{{HEAD_SIGNATURE}}` ← `TRAINING_READ_VERIFIED`, `{{HEAD_REMARKS}}`.
- **Thứ tự ký:** từng nhân viên → trưởng phòng xác nhận.

### 8.4 APD.0118, yêu cầu đào tạo (đối tượng: phiếu yêu cầu)
- **M1:** `{{YEAR}}`, `{{REQUEST_NO}}`, `{{KIND_PERIODIC_SOP}}`, `{{KIND_ANNUAL}}`; dòng lặp: `{{ROW_NO}}`, `{{PLANNED_MONTH}}`, `{{TOPIC}}`.
- **M2 sau khi đào tạo xong từng dòng:** `{{TRAINING_CODE}}`, `{{EXECUTION_DATE}}`, `{{QA_LINE_SIGNATURE}}`, `{{QA_LINE_COMMENT}}` (các cột đánh dấu "*").
- **Ô ký đầu phiếu:** `{{PREPARED_SIGNATURE}}` ← `TRAINING_REQUIREMENT_PREPARED`, `{{REVIEWED_SIGNATURE}}` ← `TRAINING_REQUIREMENT_REVIEWED`, `{{APPROVED_SIGNATURE}}` ← `TRAINING_REQUIREMENT_APPROVED`.
- **Trường hợp:** SOP định kỳ hay hằng năm. **Thứ tự ký:** người lập → QA manager → QM, rồi chữ ký QA từng dòng.

### 8.5 APD.0011, ma trận đào tạo (đối tượng: phiên bản ma trận)
- **M1:** `{{DEPARTMENT}}`, `{{MATRIX_VERSION}}`; **cột lặp theo vị trí công việc:** `{{POSITION_NAME}}`; dòng lặp: `{{ROW_NO}}`, `{{SOP_NUMBER}}`, `{{TOPIC_TITLE}}`, `{{POSITION_MARK}}` (X), `{{ANNUAL_REQUIRED}}`.
- **Ô ký:** `{{MATRIX_SIGNATURES}}` (tất cả người ký theo thứ tự) ← `TRAINING_MATRIX_PREPARED`, rồi `TRAINING_MATRIX_APPROVED`.
- **Trường hợp:** nhãn "Management Personnel" cho vị trí quản lý; hàng khoá do QA giữ cho "tất cả nhân viên". **Thứ tự ký:** người lập → người duyệt được chỉ định.

### 8.6 APD.0024, bản giao việc (đối tượng: bản giao việc)
- **M1:** `{{EMPLOYEE_CODE}}`, `{{EMPLOYEE_NAME}}`, `{{ISSUANCE_NO}}`, `{{CASE_INITIAL}}`, `{{CASE_CHANGE}}`, `{{MATRIX_CODE_VERSION}}`, `{{JURISDICTION}}`; dòng lặp: `{{RESPONSIBILITY}}`, `{{JOB_DESCRIPTION}}`.
- **Khối theo trường hợp:** `INITIAL` (bộ phận, vị trí, cấp trên, cấp dưới, người thay thế); `CHANGE` (vị trí hiện tại, lý do, vị trí mới, cấp trên, cấp dưới, người thay thế). Hệ thống chỉ giữ một khối.
- **Ô ký:** `{{ASSIGNOR_TITLE}}`, `{{ASSIGNOR_SIGNATURE}}` ← `TRAINING_JOB_ASSIGNED`; `{{RECEIVER_SIGNATURE}}` ← `TRAINING_JOB_ACCEPTED`. **Thứ tự ký:** người giao → người nhận. Nếu người nhận là trưởng đơn vị, QM hoặc QP thì ghi chức danh người giao.

### 8.7 APD.0014, hồ sơ đào tạo cá nhân (đối tượng: một người; danh sách sống)
- `{{EMPLOYEE_CODE}}`, `{{EMPLOYEE_NAME}}`, `{{QUALIFICATION}}`, `{{JOIN_DATE}}`; dòng lặp: `{{CONTENT}}` (chủ đề hoặc mã SOP kèm phiên bản), `{{TRAINING_DATE}}`, `{{TRAINING_NUMBER}}`.
- **Ô ký:** `{{PREPARED_DATE}}`, `{{PREPARED_SIGNATURE}}` ← `TRAINING_RECORD_PREPARED`; `{{APPROVED_DATE}}`, `{{APPROVED_SIGNATURE}}` ← `TRAINING_RECORD_APPROVED` (trưởng phòng QA). **Thứ tự ký:** người chuẩn bị → trưởng phòng QA, mỗi lần xuất để in.

## 9. Màn hình quản lý APD (UI đầy đủ)
**Vị trí:** mục mới **"Training Forms"** trong sidebar **Training Administration** (đặt sau Training Properties). Chuyển cơ chế quản lý mẫu ra khỏi tab của Training Properties. Tên trang theo tên chức năng, trang chi tiết là "Training Form Details".

### 9.1 Trang danh sách "Training Forms"
- Bảng chuẩn của dự án (cột No. ghim, menu ba chấm ở cột cuối, phân trang và tìm kiếm phía máy chủ): **Mã, Tên biểu mẫu, Mẫu đang dùng (phiên bản, người bật, ngày bật), Tình trạng** (Sẵn sàng, Chưa có mẫu, Mẫu không đạt kiểm tra), **Kết quả kiểm tra gần nhất, Số phiên bản**.
- Menu ba chấm: Mở, Tải phiên bản mới, Xem trước với dữ liệu mẫu, Tắt.
- Trạng thái: đang tải, trống ("Chưa có mẫu nào"), lỗi tải kèm nút thử lại.

### 9.2 Trang chi tiết "Training Form Details" (các tab như Document Details)
| Tab | Nội dung |
|---|---|
| **General Information** | Mã, tên, đối tượng nghiệp vụ, mô tả mục đích, thanh các mốc (M1 đến M4) |
| **Template Versions** | Danh sách phiên bản (nhãn, SHA-256, người tải, trạng thái Enabled hay Disabled); nút Upload; bật có **chữ ký điện tử và lý do**; tắt có lý do; tải xuống |
| **Fields** | Danh mục token **chỉ đọc** của APD này: tên, ý nghĩa, nguồn dữ liệu, bắt buộc hay không, mốc |
| **Template Check** | Kết quả kiểm tra phiên bản đã chọn: **tìm thấy, thiếu (bắt buộc), thừa, trùng**; nút "Kiểm tra lại"; thiếu bắt buộc thì khoá nút Bật |
| **Cases and Stages** | Bảng chỉ đọc: khối theo trường hợp và điều kiện giữ, mốc điền của từng nhóm token |
| **Signatures** | Các ô ký (chỉ đọc: thứ tự, ai ký, mã ý nghĩa, điều kiện cần trước) kèm chọn **kiểu hiển thị** và kiểu chữ của từng ô |
| **Preview** | Xem trước bằng **dữ liệu mẫu** hoặc chọn **một đối tượng thật**; chọn mốc để xem; watermark "Preview, không phải hồ sơ"; chỉ xem, không tải, không in |
| **Audit Trail** | Mọi lần tải, bật, tắt, đổi kiểu hiển thị |

### 9.3 Hộp thoại
- **Upload version:** chọn file `.docx`, nhãn phiên bản (không trùng), ghi chú; kiểm tra ngay và hiện kết quả; phiên bản lên ở trạng thái **Disabled**.
- **Enable:** lý do và chữ ký điện tử (mã ý nghĩa đã có, `TRAINING_FORM_TEMPLATE_ENABLED`).
- **Disable:** lý do.

### 9.4 Bên phía người dùng đào tạo
Trên hoạt động và các đối tượng khác có **ngăn "Forms"**: mỗi biểu mẫu một dòng với mốc hiện tại, phần đã điền, ô ký đang chờ ai, và nút **Preview** (xem điều đã điền tại thời điểm đó, có watermark), **Print for signing** (khi cần ký tay), **Upload scan**, và **tải bản chụp cố định** của các mốc đã qua.

### 9.5 Quyền
Xem: `training.admin.properties.view`; quản lý (tải, bật, tắt, chọn kiểu ký): `training.admin.manage`. Ngăn Forms trên hoạt động theo quyền xem hoạt động. Không tạo quyền mới (cần chủ dự án xác nhận).

## 10. Ảnh hưởng đến phần đã làm và các việc phải xử lý
- **Tab "Assessment Forms" trong Training Properties** chuyển sang menu mới; dữ liệu mẫu hiện có (`training_form_templates`) giữ nguyên.
- **Nối Document Control (V697)** không còn đúng hướng: tắt và gỡ giao diện "Forms taken from Document Control". Việc ghim phiên bản mẫu cho từng bản xuất giữ.
- **Chuyển đổi:** các mẫu hiện tại chưa có token. Trong thời gian chuyển, cho phép mẫu cũ chạy bằng cách tìm chữ in như hiện nay nhưng gắn cảnh báo "mẫu cũ, chưa kiểm token"; bật mẫu có token thì dùng bộ điền token.
- **Cần làm một lần:** gắn token vào 7 file APD thật (một phiên bản mới cho mỗi APD).
- **Các giai đoạn đề xuất:** (1) danh mục token, quét kiểm tra và hợp đồng cho từng APD; (2) bộ điền token và xem trước, thí điểm trên APD.0117; (3) các APD còn lại; (4) bản chụp cố định tại mốc; (5) giao diện quản lý và ngăn Forms. Mỗi giai đoạn qua hồ sơ thay đổi riêng và bằng chứng kiểm thử.

## 11. Điều cần chốt thêm
1. Tên menu "Training Forms" có phù hợp không?
2. Quyền xem và quản lý dùng quyền sẵn có (mục 9.5)?
3. Cho phép mẫu cũ chạy bằng cách tìm chữ in trong giai đoạn chuyển, kèm cảnh báo?
4. Bắt đầu thí điểm bằng APD.0117?

## 12. Chốt ngày 2026-10-28 và hiện trạng triển khai

**Chủ sở hữu (QA) đã chốt:** menu **"Training Annex"** (mục riêng trong Training Administration, UI đầy đủ, không nằm trong Training Properties); **quyền riêng** `training.annex.view|manage|enable`; template cũ không có token vẫn chạy bằng bộ điền cũ kèm cảnh báo "Legacy template: tokens are not checked"; làm cho **cả 7 APD**, tạo sẵn file docx có token từ các APD thật. Ghi nhận trong Decision Log `TRAINING-ANNEX-2026-10-28`. Việc liên kết với Document Control (V697) đã gỡ; FRM không quản lý ở đây.

**Cú pháp thực tế của bộ máy** (khác ví dụ ở mục 7, lấy cái này làm chuẩn): `{{TÊN}}`; `{{NHÓM.TRƯỜNG}}` trong một hàng bảng thì hàng lặp theo từng phần tử; `{{#EACH:NHÓM}} … {{/EACH:NHÓM}}` lặp cả khối đoạn/bảng; `{{#CASE:TÊN}} … {{/CASE:TÊN}}`; `{{#OMIT}} … {{/OMIT}}` (ghi chú, lịch sử sửa đổi); `{{CHECK:TÊN}}` ra ☒/☐; `{{SIGNATURE:Ô}}` hoặc `{{SIGNATURE:NHÓM.Ô}}`; `{{BLOCK:TÊN}}` (APD.0011 vẽ bảng ma trận); `{{FORM_CODE}}`, `{{FORM_REVISION}}`, `{{GENERATED_AT}}`. Hợp đồng đầy đủ từng APD nằm trong `TrainingAnnexContract.java` (tab "Fields" và "Signatures" của màn hình đọc từ đó).

**Đã làm (kiểm chứng bằng test đơn vị):** bộ máy điền + đọc lại đối chiếu; file docx có token cho APD.0011, 0014, 0024, 0108, 0117, 0118 (`docs/training_docs/annex-tokenized/`, sinh bằng `tools/annex-templates/build_annex_templates.py`); bộ điền của 6 APD đi qua bộ máy khi template có token; kiểu hiển thị chữ ký theo từng ô; màn hình danh sách + chi tiết (8 tab); xem trước bằng dữ liệu mẫu.
**Chưa làm / chưa kiểm chứng:** xem trước bằng bản ghi thật, nút "Forms" trên màn hoạt động (in để ký, tải bản scan), bản PDF bất biến ở từng mốc, chạy thử trên giao diện thật, mở file bằng Word thật. APD.0009 vẫn dùng bộ dựng bài kiểm tra (quản lý và bật ở Training Annex nhưng không kiểm token).
