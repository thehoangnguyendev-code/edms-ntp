# Kế hoạch điều chỉnh Training Management theo SOP.0003.02

**Viết cho:** chủ dự án (người giữ vai QA) để tick chọn phương án. **Lập:** 2026-11-27.
**Căn cứ:** toàn bộ phần chữ SOP.0003.02, các biểu mẫu FRM.0007 và FRM.0044, mã nguồn hiện tại, Decision Log, truy vấn chỉ đọc trên DEV. Chi tiết chỗ lệch: `docs/to-be-sds/training/GAP-TR-007-sop0003-versus-code-2026-11-27.md`.
**Chưa làm:** chưa sửa code; chưa chạy thử trên trình duyệt. Đây không phải phê duyệt GMP.

Cách đánh dấu: mỗi câu hỏi tick **một** ô (☑). ★ là phương án tôi khuyến nghị. Câu hỏi nào bỏ trống thì tôi không làm phần đó.

**Chốt 2026-11-27:** chủ dự án chọn **tất cả phương án ★** và yêu cầu làm liền một mạch (Decision Log DEC-TRAINING-2026-11-27-01). Nhóm G không làm. D4 không có ★ nên giữ như hiện nay. Chỉ dừng khi gặp rủi ro HIGH/CRITICAL hoặc cần một quyết định mới.

**Trạng thái thực hiện (2026-11-27, cuối ngày):** đã làm A1, A2, A3, B1–B8, C, D1, D2, D3, E1, F1–F4, F6, H (phần nhận diện và cảnh báo). **Chưa làm, có lý do:** H1-a (móc vào màn quản lý người dùng; thay bằng quét hồ sơ và Audit Trail mỗi 20 phút), H2.2 (ô "Loại khoá"), H2.1 (bắt buộc ngày vào công ty) vì cần sửa module Security; F5 hai bước duyệt ma trận (cần thêm trạng thái vòng đời); D2.3 chưa có màn hình sửa danh sách ba nội dung. Chi tiết và bằng chứng: `eqms-backend/docs/validation/TRAINING_SOP0003_ADJUSTMENT_2026_11_27_CHANGE_RECORD.md`.
**Cập nhật cuối ngày 2026-11-27:** đã làm thêm H1-a (móc User Management), H2.2 (loại khoá), H2.1 (ngày vào công ty bắt buộc), F5 (hai bước duyệt ma trận, V878), D2.3 (màn hình danh sách nội dung bắt buộc). Còn lại: chạy E1/A3 với một lần phê duyệt revision thật. Xem DEC-TRAINING-2026-11-27-04.

---

## 0a. Cách SOP vận hành (căn cứ để đọc các nhóm dưới)

SOP dùng hai thứ khác nhau:

| | Là gì | Căn cứ SOP | Tồn tại |
|---|---|---|---|
| **Ma trận đào tạo** | Danh sách **phải học gì**, theo vị trí. Gồm ba nhóm: chung nhà máy, chung bộ phận, SOP của vị trí | 5.3.1 | Lâu dài; chỉ sửa khi mô tả công việc đổi, rà soát hằng năm, hoặc có tài liệu mới |
| **Training Activity** | **Một lần tổ chức học** thật: mã TRN, buổi, giảng viên, danh sách chốt trước, chữ ký, điểm | 5.1.4, 5.3.3 đến 5.3.7 | Học xong thì hoàn tất và thành hồ sơ; không dùng lại cho đợt khác |

Bảng "ba phần" của 5.1.1 (HCNS, QA, đơn vị liên quan) là **nội dung phải học** của người mới, nên nằm trong ma trận, không phải một Training Activity tạo sẵn để tick người vào. Mỗi đợt người mới là **một** Training Activity loại Ban đầu, **ba buổi** (quyết định C2), có mã mới. Lý do không dùng một activity mở mãi: danh sách phải chốt trước buổi học (5.3.4), mỗi lần học có một mã riêng trong FRM.0044 (5.1.4), người học ký và được chấm theo buổi (5.3.7).

Ví dụ: 5 người vào ngày 01/12 thì QA tạo TRN/QA/26-120 với buổi HCNS, buổi QA, buổi bộ phận (nhiều bộ phận thì mỗi bộ phận một buổi). 10 người vào ngày 15/01 thì tạo activity mới TRN/QA/27-005, nội dung lấy từ cùng ma trận. Người vắng một buổi thì học bù ở TRN/QA/26-120a.

---

## 0. Những quyết định đã có, kế hoạch này giữ nguyên

| Quyết định | Nội dung | Ảnh hưởng tới kế hoạch |
|---|---|---|
| 2026-10-27 (V678) | Không có "gói đào tạo ban đầu"; người mới học gì thì lấy từ ma trận | Nhóm B lấy nội dung từ ma trận |
| DEC-TRAINING-2026-11-23-12, C2 | Đào tạo ban đầu: **một hoạt động, ba buổi** (HCNS, QA, đơn vị liên quan), một mã | Nhóm B dùng đúng cách này |
| DEC-11-23-12, C1, C3, C4, C5, C6 | Người duyệt chọn tự do có nhắc; tự đọc: nhân viên ký trước; người trượt dùng chung hậu tố; vắng >6 tháng là đột xuất; trainer nhập kết quả | Không đổi; QA sửa SOP theo |
| D-12, DEC-11-23-01 | Tạm ngừng việc là cờ, hết khi đạt đào tạo lại | Không đổi |
| D-FRM-1 | FRM.0044 giữ trên giấy, hệ thống chỉ cấp số | Lý do hoãn ghi tay trên giấy |
| D-FRM-2 và phương án A | FRM.0007 ký tay (có cột Trưởng đơn vị), hệ thống giữ bản scan, không xác nhận điện tử | Nhóm F chỉ bịt chỗ hở, không đổi cách làm |
| D-SRM-6 | Người nghỉ việc hoặc nghỉ dài ngày (tài khoản không Active) không được bù cho tới khi Active | Nhóm F giữ quy tắc này |

---

## Nhóm A. Lỗi phải sửa (làm trước, các nhóm sau dựa vào)

### A1. Tài liệu nâng phiên bản nhưng người học bản cũ vẫn được tính là đạt

**SOP:** 5.1.1 (sửa đổi tài liệu là lý do đào tạo), 5.3.8 (giao việc khi hoàn thành **tất cả** nội dung ma trận).
**Code:** `TrainingMatrixCompletionService.state` có xét phiên bản (Update Needed). Bốn nơi khác **không xét**: Gap List (`TrainingComplianceService`), điều kiện giao việc (`TrainingJobAssignmentService`), đề xuất người tham gia (`TrainingActivityService`), kiểm tra ở màn xem xét (dùng Gap List). DEV: 56 cặp người–tài liệu bị tính sai (dữ liệu test).

**A1.1 Cách sửa**
- ☑ ★ **A1-a.** Một quy tắc chung cho mọi nơi, đặt ở một chỗ duy nhất. Trạng thái của một người với một dòng ma trận: *Chưa học*, *Cần học bản mới*, *Đến hạn định kỳ*, *Không cần đào tạo* (phiên bản hiện hành đánh dấu không cần), *Đạt*, *Đang học* (có tên trong lớp đang mở).
- ☐ A1-b. Chỉ sửa Gap List và điều kiện giao việc, các nơi khác để sau.

**A1.2 Người chưa học bản mới có bị chặn lập bản giao việc mới không?**
- ☑ ★ Chặn như thiếu đào tạo (vẫn dùng được ngoại lệ có duyệt đang có). Đúng chữ "tất cả" của 5.3.8.
- ☐ Chỉ cảnh báo trong thời hạn đào tạo của tài liệu (mặc định 10 ngày), quá hạn mới chặn.

Bản giao việc **đã có hiệu lực** không bị thu hồi (SOP không yêu cầu); người đó hiện ở Gap List là *Cần học bản mới*.

### A2. Giảng viên "đã đào tạo GMP" nhận ra bằng chữ "gmp" trong tên chủ đề

**SOP:** 5.1, yêu cầu giảng viên được đào tạo về GMP. **Code:** `TrainingTrainerService.qualification` tìm `lower(topic_text) like '%gmp%'`.

- ☑ ★ **A2-a.** Thêm dấu **"Chủ đề GMP"** cho dòng ma trận, chỉ QA đặt được (như dòng khoá). Giảng viên đạt khi có hồ sơ đạt của một chủ đề mang dấu này. Khi chuyển đổi, hệ thống **liệt kê** các dòng có chữ "gmp" để QA xác nhận, không tự đánh dấu.
- ☐ A2-b. QA chọn danh sách chủ đề tính là GMP trong Training Properties.
- ☐ A2-c. Giữ như hiện nay.

### A3. Bộ phận liên quan không đánh giá được tác động của tài liệu lên ma trận của mình

**SOP:** 5.3.1, "bộ phận chịu trách nhiệm **và các bộ phận liên quan** phải đánh giá tác động… và cập nhật ma trận".
**Code:** `TrainingImpactService` chỉ cho **bộ phận sở hữu tài liệu** đánh giá, chỉ trên ma trận của bộ phận đó. Bộ phận khác không có dòng chờ đánh giá.

- ☑ ★ **A3-a.** Mỗi tài liệu mới hoặc nâng phiên bản có một dòng đánh giá **cho từng bộ phận liên quan**. Bộ phận sở hữu chọn các bộ phận liên quan; mỗi bộ phận tự đánh giá và cập nhật ma trận của mình. Chặn thông báo đào tạo cho tới khi mọi bộ phận đã chọn đánh giá xong, như hiện nay đang chặn với bộ phận sở hữu.
- ☐ A3-b. Như A3-a nhưng chỉ cảnh báo, không chặn thông báo.
- ☐ A3-c. Giữ như hiện nay.

---

## Nhóm B. Đào tạo ban đầu và Danh mục kiểm tra

### B1. Nội dung đào tạo của người mới

Theo quyết định 27/10: các dòng **Tất cả nhân viên** cộng cột **Job Role** của người đó trong ma trận. Không cần tick, chỉ cần chọn cách xử lý người **chưa có Job Role**:
- ☑ ★ Danh mục hiện các dòng Tất cả nhân viên, phần chuyên môn hiện "Chưa có Job Role" và **không đóng được xem xét** cho tới khi có Job Role (hoặc ghi Không cần kèm lý do).
- ☐ Cho đóng khi xong các dòng Tất cả nhân viên.

### B2. Ba phần của SOP hiện ra sao trên danh mục

SOP 5.1.1 chia theo **người dạy** (HCNS, QA, đơn vị liên quan). Ma trận 5.3.1 chia theo **phạm vi** (cả nhà máy, bộ phận, vị trí). Hai cách chia không trùng nhau: nhóm "cả nhà máy" gồm cả an toàn (HCNS) lẫn GMP (QA).

- ☑ ★ **B2-a.** Danh mục liệt kê theo ba nhóm của ma trận. Người dạy là giảng viên của buổi học. Không thêm dữ liệu.
- ☐ B2-b. Thêm thuộc tính **"Đơn vị đào tạo"** (HCNS, QA, Đơn vị liên quan) cho dòng ma trận để danh mục chia đúng ba phần SOP. Mẫu APD.0011 không có cột này nên chỉ hiện trên màn hình.

### B3. Tổ chức lớp cho người mới (5 người, rồi 10 người)

**Code hiện tại:** nút ở màn xem xét tạo một hoạt động **Đột xuất**, trống, **cho từng người, từng mục**, không cần quyền cấp mã của QA. Trái 5.3.3 và quyết định C2.

- ☑ ★ **B3-a.** Bỏ nút đó. Thay bằng:
  1. **"Thêm vào lớp ban đầu đang mở":** hiện các hoạt động loại Ban đầu còn Planned, danh sách chưa khoá, có chủ đề người đó còn thiếu. Chọn là người đó vào danh sách, đúng buổi có chủ đề.
  2. **"Tạo lớp ban đầu mới":** cần quyền cấp mã (QA), tạo một hoạt động loại Ban đầu có sẵn ba buổi trống (HCNS, QA, đơn vị liên quan) theo C2.

  5 người cùng đợt thì vào một lớp. 10 người sau: thêm vào lớp cũ nếu chưa khoá, không thì tạo lớp mới (mã mới).
- ☐ B3-b. Giữ nút tạo ở màn xem xét, chỉ đổi sang loại Ban đầu, mỗi người một hoạt động.

**B3.1 Tạo lớp mới nhanh từ lớp trước**
- ☑ ★ Nút **"Tạo lớp ban đầu từ lớp trước"**: chép ba buổi, chủ đề, giảng viên, tài liệu đào tạo và bài kiểm tra của lớp ban đầu gần nhất (hoặc lớp người dùng chọn). **Không chép** ngày, danh sách người, chữ ký, kết quả. Lớp mới có mã mới và vẫn phải xem xét, duyệt nội dung như 5.3.5. Tài liệu đào tạo được chép thành bản riêng của lớp mới, có mã băm như tệp tải lên; lớp cũ không bị đổi.
- ☐ Không làm; mỗi đợt tạo lại từ đầu.

### B4. Hoàn thành một mục phải có bằng chứng

**Code hiện tại:** mục đào tạo bấm Done được mà không gắn hoạt động; nếu gắn chỉ cần có tên trong danh sách; đóng xem xét không xét kết quả kiểm tra của hệ thống. Kiểm tra bản giao việc và bàn giao hồ sơ chấp nhận **bản cũ** (trước sự kiện), nên người chuyển bộ phận "đạt" nhờ bản giao việc của bộ phận cũ.

**B4.1 Mục đào tạo**
- ☑ ★ Mỗi chủ đề còn thiếu là một dòng, **tự chuyển Đạt** khi có hồ sơ đạt theo quy tắc A1. Không bấm Done bằng tay. Bỏ qua được bằng **Không cần** kèm lý do.
- ☐ Vẫn bấm tay, nhưng bắt buộc gắn hoạt động đã Hoàn tất và người đó Đạt.

**B4.2 Mục không phải đào tạo** (chữ ký mẫu, bản giao việc, bàn giao hồ sơ)
- ☑ ★ Chỉ Đạt khi hệ thống tìm thấy bản ghi **có sau ngày sự kiện** của xem xét (bản giao việc có hiệu lực, bản xuất hồ sơ đã duyệt). Chữ ký mẫu: bản đang dùng, không cần sau ngày sự kiện (trừ khi đổi chữ ký). Bỏ qua được bằng Không cần kèm lý do.
- ☐ Giữ bấm tay, kết quả kiểm tra chỉ để tham khảo.

**B4.3 Đóng xem xét**
- ☑ ★ Chặn đóng khi còn dòng chưa Đạt và chưa ghi Không cần.
- ☐ Giữ như hiện nay.

### B5. Đào tạo nội quy, an toàn của HCNS có bắt buộc hồ sơ trong hệ thống?
- ☑ ★ Có. Đây là một phần đào tạo ban đầu (5.1.1), dạy trong buổi HCNS của lớp ban đầu.
- ☐ Không. Đánh dấu tay, giữ bản giấy ngoài hệ thống.

### B6. Danh mục của một xem xét đã đóng
**Code hiện tại:** nhãn các mục đọc từ code đang chạy, kể cả xem xét đã đóng.
- ☑ ★ Lưu các dòng vào xem xét khi mở; cập nhật khi ma trận đổi trong lúc còn mở; **đóng thì giữ nguyên**, không đọc lại từ ma trận hay code.

### B7. Các loại xem xét khác

**B7.1 Chuyển cơ sở** (5.3.11: đào tạo "như nhân viên mới")
- ☑ ★ Dùng đúng các dòng của nhân viên mới, thêm mục Bàn giao hồ sơ.
- ☐ Giữ một mục gộp.

**B7.2 Chuyển bộ phận** (5.3.11: trưởng bộ phận tiếp nhận **và** nhân viên được phân công cùng rà soát)
- ☑ ★ Ghi tên người được phân công khi mở; người đó xác nhận mục Rà soát hồ sơ; trưởng bộ phận tiếp nhận ký đóng.
- ☐ Giữ một người.

**B7.3 Trở lại sau vắng trên 6 tháng** (SOP không nói học lại những gì)
- ☑ ★ Người rà soát chọn các chủ đề phải học lại từ ma trận của người đó; mỗi chủ đề thành một dòng như B4.1.
- ☐ Bắt học lại toàn bộ ma trận.

Vắng **ngắn hơn** 6 tháng nhưng cần đào tạo lại ("khi thấy cần thiết"): giữ như hiện nay, mở một hoạt động Đột xuất trực tiếp, không qua màn xem xét.

**B7.4 Đổi Job Role trong cùng bộ phận**
- ☑ ★ Không thêm loại xem xét. Bản giao việc mới đã bị chặn khi thiếu đào tạo của Job Role mới (5.3.8), như vậy là đủ kiểm soát.
- ☐ Thêm loại xem xét "Đổi Job Role".

### B8. Danh mục đang viết cứng trong code: thêm mục về sau thế nào

**Code:** mọi mục của bốn loại xem xét nằm trong `TrainingPersonnelReviewService.ITEMS`. Thêm, bớt hay sửa chữ một mục đều phải sửa code và phát hành lại; xem xét đã đóng đọc nhãn từ code mới.

Danh mục tách làm hai phần, xử lý khác nhau:

| Phần | Nguồn | Thêm về sau |
|---|---|---|
| **Dòng đào tạo** (an toàn, GMP, chuyên môn, học lại, đào tạo bổ sung) | Ma trận, theo B1, B4.1, B7.3 | Thêm dòng vào ma trận, không sửa code |
| **Việc không phải đào tạo** (chữ ký mẫu, bản giao việc, bàn giao hồ sơ, rà soát hồ sơ) | Mẫu danh mục theo loại xem xét | Theo câu hỏi dưới |

**B8.1 Việc không phải đào tạo**
- ☑ ★ **B8-a.** Mẫu danh mục cho từng loại xem xét, quản lý ở Training Administration, có phiên bản và Audit Trail. Mỗi mục có tên (Anh, Việt), hướng dẫn, và **cách kiểm tra** chọn từ danh sách cố định: *Chữ ký mẫu*, *Bản giao việc*, *Bản xuất hồ sơ*, *Người xác nhận tay*. Các mục SOP nêu tên bị **khoá**, không xoá được. Mục mới chỉ áp cho xem xét mở sau đó; xem xét đã mở giữ danh mục của nó (B6).
- ☐ B8-b. Giữ viết cứng trong code; thêm mục thì sửa code.

**B8.2 Loại xem xét** (Nhân viên mới, Trở lại sau vắng, Chuyển bộ phận, Chuyển cơ sở)
- ☑ ★ Giữ cố định trong code: mỗi loại có quy tắc riêng (số tháng vắng, bộ phận chuyển đến, ai ký đóng). Thêm loại mới phải sửa code.
- ☐ Cho cấu hình cả loại xem xét (chỉ được tên và danh mục, không có quy tắc riêng).

Giới hạn còn lại dù chọn B8-a: một **cách kiểm tra mới** (ví dụ kiểm tra chứng chỉ sức khoẻ) cần sửa code, vì hệ thống phải biết bản ghi đó ở đâu. Trong lúc chờ, mục đó dùng *Người xác nhận tay* kèm ghi chú.

---

## Nhóm C. Đào tạo chung của cả nhà máy

**SOP:** 5.3.1 (nhóm "theo yêu cầu cả nhà máy"); mục 3 (trưởng phòng QA duyệt ma trận toàn nhà máy).
**Code:** dòng chung được **chép vào ma trận từng bộ phận**, mỗi lần chép sinh bản nháp phải duyệt lại; bộ phận chưa có ma trận hiệu lực bị bỏ qua; người có tên bộ phận không khớp danh mục bộ phận thì không bị yêu cầu gì. DEV: 5 dòng nhóm cả nhà máy không đánh dấu Tất cả nhân viên.

- ☑ ★ **C-a.** Một **danh sách chung của nhà máy** do QA lập, trưởng phòng QA duyệt, áp cho **mọi người Active**, kể cả bộ phận chưa có ma trận. Ma trận bộ phận chỉ còn nhóm bộ phận và nhóm vị trí. Bản in APD.0011 của bộ phận vẫn in nhóm cả nhà máy, đọc từ danh sách chung. Thay đổi lớn: cần chuyển dữ liệu và sửa các nơi đang đọc ma trận.
- ☐ C-b. Giữ cách chép, nhưng: tự áp vào bộ phận khi có ma trận mới; báo QA bộ phận nào chưa có ma trận; Gap List hiện "Chưa có ma trận" thay vì không yêu cầu gì.

Cả hai cách đều sửa thêm: người có tên bộ phận không khớp được liệt kê để quản trị sửa, không bị bỏ qua lặng lẽ.

---

## Nhóm D. Đào tạo định kỳ và yêu cầu đào tạo

### D1. Tần suất đào tạo định kỳ tài liệu

**SOP:** 5.3.2, theo **thời hạn rà soát** của tài liệu. **Code:** cố định 1 năm cho mọi dòng "hằng năm". Tài liệu có chu kỳ rà soát (tháng) trong `documents.periodic_review_cycle`; DEV: 11.672 tài liệu không có chu kỳ.

- ☑ ★ **D1-a.** Dòng tài liệu: đến hạn theo chu kỳ rà soát của tài liệu; tài liệu không có chu kỳ thì 12 tháng. Dòng chủ đề (không phải tài liệu): 12 tháng.
- ☐ D1-b. Giữ 12 tháng cho tất cả; QA sửa SOP.

### D2. Yêu cầu đào tạo hằng năm

**SOP:** 5.3.2 và mục 3, **QA** lập **một** yêu cầu cho **toàn nhà máy**, QM duyệt. **Code:** lập theo từng bộ phận; người duyệt chọn theo quyền.

**D2.1**
- ☑ ★ **D2-a.** Loại hằng năm: một yêu cầu toàn nhà máy, mỗi dòng có các bộ phận áp dụng; gợi ý gom từ ma trận mọi bộ phận (và danh sách chung nếu chọn C-a). Loại theo rà soát tài liệu giữ như hiện nay.
- ☐ D2-b. Giữ theo bộ phận; QA sửa SOP.

**D2.2 Người duyệt không có quyền Quản lý chất lượng**
- ☑ ★ Nhắc, không chặn (giống C1 ngày 23/11).
- ☐ Chặn.

**D2.3 Ba nội dung bắt buộc của yêu cầu hằng năm** (GMP chung; toàn vẹn dữ liệu và vô trùng; xu hướng lỗi)
- ☑ ★ Khi gửi duyệt, nhắc nếu thiếu dòng nào được QA đánh dấu thuộc ba nội dung đó; không chặn.
- ☐ Không kiểm.

### D3. Nhắc rà soát ma trận hằng năm trước khi lập yêu cầu (5.3.1)
- ☑ ★ Thêm nhắc cho trưởng bộ phận, tháng nhắc cấu hình ở Training Properties.
- ☐ Không thêm.

### D4. Biết khi nào đợt rà soát tài liệu hoàn tất (5.3.2)
Document Control hiện **không lưu** kết quả "rà soát định kỳ hoàn tất" (chỉ có bộ nhắc), nên Training phải gõ tay ngày hoàn tất.
- ☐ Làm sau, cùng phần rà soát định kỳ của Document Control.
- ☐ Giữ gõ tay.

---

## Nhóm E. Đào tạo tài liệu mới và nâng phiên bản

### E1. Ai dạy (5.3.6)
**SOP:** ban hành lần đầu: phòng soạn thảo đào tạo các phòng liên quan. Nâng phiên bản hoặc định kỳ: **trưởng từng đơn vị đào tạo đơn vị mình**. **Code:** một hoạt động của phòng sở hữu tài liệu, không có buổi.
- ☑ ★ **E1-a.** Nâng phiên bản: hoạt động tạo sẵn **một buổi cho mỗi bộ phận** có Job Role cần học (theo A3), giảng viên đề xuất là trưởng bộ phận đó, sửa được. Ban hành lần đầu: giữ như hiện nay. Khi làm phải kiểm quyền: trưởng bộ phận khác có thực hiện được buổi của hoạt động thuộc phòng sở hữu không.
- ☐ E1-b. Giữ một hoạt động; người tổ chức tự thêm buổi.

### E2. Người ký tài liệu (5.1, SOP tự mâu thuẫn)
Tiếng Việt: người ký **được xem là đã được đào tạo**. Tiếng Anh: người ký **sẽ đào tạo**.
- ☑ ★ Giữ như code (ghi hồ sơ đào tạo cho người ký); QA sửa câu tiếng Anh.
- ☐ Theo tiếng Anh: bỏ hồ sơ tự động; người ký chỉ là giảng viên đủ điều kiện.

---

## Nhóm F. Các chỗ nhỏ

| # | Chỗ | ★ Khuyến nghị | Phương án khác |
|---|---|---|---|
| F1 | Chữ ký mẫu (5.3.9): nhân viên **tự tải được**, hệ thống không hỏi bản giấy đã có chữ ký trưởng đơn vị chưa | ☑ Chỉ người có quyền quản lý chữ ký (không phải chính nhân viên) tải lên, bắt buộc tick "Bản giấy đã có chữ ký Trưởng đơn vị" | ☐ Giữ |
| F2 | Danh sách (5.3.4) phải gồm cả người nghỉ; người nghỉ dài ngày bị khoá tài khoản thì không thêm được | ☑ Cho thêm tài khoản bị khoá ở trạng thái **Vắng**, lý do "Tài khoản tạm khoá", không gửi thông báo; bù khi Active (khớp D-SRM-6) | ☐ Giữ; QA sửa SOP |
| F3 | Màn danh sách số chỉ hiện số lần hoãn | ☑ Hiện thêm lý do hoãn, để chép sang FRM.0044 giấy | ☐ Giữ |
| F4 | Chuẩn bị (5.3.6): chỉ báo một người, không báo HCNS hay bộ phận chuẩn bị thiết bị | ☑ Việc chuẩn bị gán cho **bộ phận nhận**, báo những người có quyền nhận ở bộ phận đó | ☐ Giữ |
| F5 | Ma trận (5.3.1, mục 3): một người duyệt | ☑ Hai bước: xem xét rồi duyệt; nhắc nếu người duyệt không phải trưởng phòng QA | ☐ Giữ |
| F6 | Thư viện tài liệu đào tạo: slide nội quy, an toàn phải tải lại mỗi lớp | ☑ Thư viện tài liệu dùng lại: chọn vào hoạt động thì **chép** sang; nội dung của hoạt động vẫn phải xem xét và duyệt như hiện nay (5.3.5) | ☐ Không làm |

---

## Nhóm G. Chưa làm lần này (chỉ tick nếu muốn đưa vào)

| # | Việc | Lý do để sau |
|---|---|---|
| — | (G1 đã chuyển thành Nhóm H) | |
| ☐ G2 | Gắn lý do đột xuất với hồ sơ CAPA, Change Control, đánh giá | Các module đó chưa có |
| ☐ G3 | Gửi hồ sơ cá nhân cho đơn vị, nhắc in hằng năm | Việc thủ công, ít rủi ro |
| ☐ G4 | Nhiều cơ sở | Hệ thống một cơ sở |

---

## Nhóm H. Nhận diện trường hợp cần đào tạo và cảnh báo người phụ trách

**Yêu cầu của chủ dự án (2026-11-27):** hệ thống tự nhận ra người mới, người quay lại sau trên 6 tháng và các trường hợp SOP nêu, rồi cảnh báo kèm gợi ý để người phụ trách bắt đầu làm theo SOP.

### H0. Hệ thống đang có dữ liệu gì (đã kiểm trong code và DB DEV)

| Dữ liệu | Có không | Ghi chú |
|---|---|---|
| Ngày vào công ty (`app_users.start_date`) | Có, không bắt buộc | DEV: 43 trên 714 tài khoản Active có ngày này. Màn xem xét đã gợi ý người vào trong 60 ngày, nhưng chỉ hiện khi mở hộp thoại |
| Khoá và mở lại tài khoản | Có | `UserManagementService.suspendUser` ghi lý do, ngày hết khoá dự kiến và Audit Trail `USER_SUSPENDED`; `reinstateUser` ghi `USER_REINSTATED` và **xoá** lý do khoá. Không phân loại "nghỉ dài ngày": lý do là chữ tự do, dùng cả cho lý do bảo mật |
| Đổi bộ phận, đổi chức danh | Có, chỉ trong Audit Trail chung (`USER_UPDATED`) | Không có bảng lịch sử riêng; Training không được báo |
| Đổi Job Role | Có (`training_person_positions`, có ngày hiệu lực) | Chỉ ghi khi bản giao việc được nhận, tức là **sau** đào tạo |
| Cơ sở làm việc | **Không có** | Không nhận diện được chuyển cơ sở |
| Nghỉ mà tài khoản vẫn Active | **Không có** | Không nhận diện được; vẫn mở xem xét bằng tay |

### H1. Cách nhận diện

- ☑ ★ **H1-a.** Training lưu một **sổ sự kiện nhân sự** riêng (người, loại, ngày, nguồn). Màn quản lý người dùng phát sự kiện **sau khi lưu xong** (Training lỗi không làm hỏng việc quản lý người dùng) khi: tạo tài khoản hoặc đặt ngày vào công ty; khoá tài khoản; mở lại tài khoản; đổi bộ phận; đổi chức danh. Một tác vụ chạy hằng ngày đối chiếu lại để bắt sự kiện bị lỡ. Lần đầu bật thì đọc Audit Trail cũ để dựng sổ, có báo cáo các dòng không đọc được.
- ☐ H1-b. Không lưu sự kiện; mỗi ngày tác vụ đọc thẳng Audit Trail chung. Ít sửa code hơn nhưng phụ thuộc chữ trong Audit Trail, dễ sai khi Audit Trail đổi.

Màn quản lý người dùng thuộc phần Security và được dùng ở nhiều nơi: khi làm phải phân tích ảnh hưởng GitNexus và báo mức rủi ro trước khi sửa.

### H2. Các trường hợp nhận diện

| # | Trường hợp | Căn cứ SOP | Dấu hiệu | Gợi ý cho người phụ trách | Tick |
|---|---|---|---|---|---|
| H2.1 | Nhân viên mới | 5.1, 5.1.1, 5.3.8, 5.3.9 | Tài khoản mới có ngày vào công ty, hoặc ngày vào công ty được đặt (kể cả ngày sắp tới) | Mở xem xét Nhân viên mới; thêm vào lớp ban đầu đang mở hoặc tạo lớp từ lớp trước (B3, B3.1); thu chữ ký mẫu | ☑ ★ |
| H2.2 | Quay lại sau vắng trên N tháng (mặc định 6, Training Properties) | 5.1.1 | Tài khoản mở lại sau khi bị khoá từ N tháng trở lên | Mở xem xét Trở lại sau vắng, ngày vắng điền sẵn từ ngày khoá và ngày mở; chọn chủ đề học lại (B7.3) | ☑ ★ |
| H2.3 | Chuyển bộ phận | 5.3.11 | Bộ phận trong hồ sơ người dùng đổi | Mở xem xét Chuyển bộ phận, bộ phận cũ và mới điền sẵn; báo trưởng bộ phận tiếp nhận | ☑ ★ |
| H2.4 | Đổi chức danh trong cùng bộ phận | 5.1.1 (trách nhiệm hoặc công việc mới), 5.3.8 | Chức danh đổi, bộ phận giữ nguyên | Kiểm Job Role và lập bản giao việc mới (bản giao việc tự chặn nếu thiếu đào tạo, B7.4) | ☑ ★ |
| H2.5 | Thiếu ngày vào công ty | Điều kiện để H2.1 chạy | Tài khoản Active, có mã nhân viên, không có ngày vào công ty | Nhắc quản trị người dùng điền | ☑ ★ |
| H2.6 | Chuyển cơ sở | 5.3.11 | Không có dữ liệu | Mở bằng tay như hiện nay | — (cần G4) |

**H2.2, phân biệt khoá vì nghỉ dài ngày**
- ☑ ★ Thêm ô **"Loại khoá"** khi khoá tài khoản (*Nghỉ dài ngày*, *Lý do khác*). Chỉ *Nghỉ dài ngày* sinh cảnh báo khi mở lại. Lần khoá cũ không có loại thì vẫn cảnh báo nếu đủ N tháng, để người phụ trách bỏ qua có lý do.
- ☐ Mọi lần khoá từ N tháng trở lên đều sinh cảnh báo.

**H2.1, ngày vào công ty**
- ☑ ★ Bắt buộc nhập ngày vào công ty khi tạo tài khoản có mã nhân viên. Tài khoản không có mã nhân viên (thử, hệ thống) không bị bắt buộc, phù hợp D-36.
- ☐ Không bắt buộc; dùng H2.5 để nhắc.

### H3. Cảnh báo hiện ở đâu, ai nhận

- ☑ ★ **H3-a.** Danh sách **"Cần xem xét đào tạo"** trong Personnel Qualification, có số đếm trên menu (dùng bộ đếm đã có). Mỗi dòng: người, trường hợp, ngày sự kiện, nguồn dữ liệu, các nút gợi ý ở H2. Người nhận thông báo:
  - người có quyền quản lý bản giao việc **trong bộ phận của nhân viên** (trưởng bộ phận); với chuyển bộ phận là **bộ phận tiếp nhận**;
  - với nhân viên mới, thêm người có quyền cấp mã đào tạo (QA tổ chức đào tạo ban đầu theo 5.3.3).

  Thông báo trong ứng dụng và e-mail, theo cấu hình thông báo đã có (thêm sự kiện mới vào danh mục thông báo, có bản tiếng Việt).
- ☐ H3-b. Chỉ có danh sách, không gửi thông báo.

### H4. Một cảnh báo kết thúc thế nào

- ☑ ★ Cảnh báo **mở** cho tới khi: (a) có một xem xét đúng loại được mở cho người đó, cảnh báo nối với xem xét; hoặc (b) người phụ trách **bỏ qua kèm lý do** và chữ ký điện tử, ghi Audit Trail. Một sự kiện chỉ sinh một cảnh báo. Người đó nghỉ việc thì cảnh báo tự đóng, ghi rõ lý do. Cảnh báo mở quá N ngày (cấu hình) thì nhắc lại người nhận và báo QA.
- ☐ Như trên nhưng bỏ qua chỉ cần lý do, không cần chữ ký điện tử.

### H5. Cảnh báo ở các màn khác

- ☑ ★ Người có cảnh báo đang mở hoặc xem xét chưa đóng thì hiện nhãn **"Đang chờ xem xét đào tạo"** ở: chọn người cho bản giao việc, chọn giảng viên, hồ sơ đào tạo cá nhân. Chỉ nhắc, không chặn (bản giao việc đã tự chặn khi thiếu đào tạo).
- ☐ Không thêm.

### H6. Giới hạn phải chấp nhận

- Hệ thống chỉ biết những gì được nhập vào hồ sơ người dùng. Nghỉ mà tài khoản vẫn Active, chuyển cơ sở, hay ngày vào công ty nhập sai thì không nhận ra; xem xét vẫn mở bằng tay được như hiện nay.
- Cảnh báo là **gợi ý**, không thay quyết định của trưởng bộ phận và QA (5.1: trưởng đơn vị đảm bảo nhân viên được đào tạo trước khi giao việc độc lập).
- Chỉ lưu ngày và loại khoá; không lưu lý do nghỉ chi tiết (thai sản, bệnh) để không giữ dữ liệu nhạy cảm không cần thiết.

---

## Các chỗ có thể xung đột và cách đã xử lý

| Chỗ | Xử lý |
|---|---|
| B4.1 tự Đạt dựa vào quy tắc trạng thái | Phải làm A1 trước, nếu không B4 thừa hưởng lỗi phiên bản |
| C-a đổi nơi lưu dòng chung | Nếu chọn C-a, làm trước B và D2, vì A1, B1, D2 đều đọc ma trận |
| B3 lớp ban đầu | Theo đúng C2 (một hoạt động, ba buổi). Danh sách khoá sau xác nhận (5.3.4) nên người đến sau vào lớp mới, không mở lại danh sách |
| A1.2 chặn giao việc | Không thu hồi bản giao việc đã hiệu lực; vẫn có ngoại lệ có duyệt |
| E1-a buổi theo bộ phận | Dựa trên A3 để biết bộ phận nào cần học |
| F2 người bị khoá tài khoản | Không bù tới khi Active, đúng D-SRM-6 |
| F1 chữ ký mẫu | Vẫn là bản scan theo D-FRM-2, chỉ thêm điều kiện khi tải lên |
| D1-a tần suất | Tài liệu không có chu kỳ vẫn có hạn 12 tháng, không thành "không bao giờ đến hạn" |
| H gợi ý mở xem xét | Xem xét phải dùng danh mục mới của Nhóm B; làm B trước H, nếu không cảnh báo dẫn tới danh mục cũ |
| H2.2 dùng ngày khoá, mở tài khoản | Khớp D-SRM-6: khi tài khoản còn khoá, người đó vẫn không được bù hay thêm vào lớp; cảnh báo chỉ sinh khi mở lại |
| H1-a sửa màn quản lý người dùng | Training lỗi không được làm hỏng việc khoá hay mở tài khoản: sự kiện ghi sau khi lưu, tác vụ hằng ngày bắt lại |
| B3.1 chép tài liệu | Bản chép là tệp riêng; lớp cũ đã hoàn tất không bị đổi; nội dung lớp mới vẫn phải duyệt (5.3.5) |
| Dữ liệu DEV | Sau A1, 56 cặp người–tài liệu chuyển sang Cần học bản mới; các xem xét đang mở (7 trên DEV) phải chuyển sang danh mục mới |

## Thứ tự làm sau khi có lựa chọn

1. A1, A2 (lỗi).
2. C (nếu chọn C-a).
3. A3, rồi E1.
4. B1 đến B7.
5. D1 đến D3.
6. F.
7. H (sau B, vì cảnh báo dẫn tới danh mục mới).

Mỗi bước: phân tích ảnh hưởng GitNexus trước khi sửa, có test âm (người học bản cũ, mục không có bằng chứng, người không đủ quyền), xem trên trình duyệt trước khi báo xong, và một bản ghi thay đổi theo mẫu 08.

## SOP cần QA sửa (không phụ thuộc lựa chọn)

- Câu tiếng Anh về người ký tài liệu (E2), nếu chọn giữ.
- Các quyết định C1, C3, C4, C5 ngày 23/11; D-12; tạm ngừng việc là cờ.
- Hậu tố mã cho người trượt (5.1.4).
- Các điểm phần mềm làm thêm mà SOP chưa mô tả (chữ ký điện tử từng bước, Pending Approval, khoá sau thông báo, Start Training).
- Mọi câu hỏi trên mà bạn chọn "Giữ; QA sửa SOP".
