# GAP-TR-007 – Đối chiếu SOP.0003.02 với mã nguồn Training Management

**Lập:** 2026-11-27. **Cơ sở:** đọc toàn bộ phần chữ của `SOP.0003.02 Training_261014.md` (không đọc lại ảnh lưu đồ 5.2), đọc mã nguồn hiện tại và một truy vấn chỉ đọc trên DB DEV. Chưa chạy kịch bản hay xem trình duyệt cho các dòng dưới. Đây không phải phê duyệt GMP.

Thay cho GAP-TR-006 ở những điểm hai tài liệu khác nhau.

## 1. Lỗi phần mềm (sai cả với SOP lẫn với chính phần mềm)

| # | SOP | Phần mềm làm | Bằng chứng | Nên sửa |
|---|---|---|---|---|
| L1 | 5.1.1, 5.3.1: sửa đổi tài liệu thì phải đào tạo lại | **Matrix Completion** báo *Update Needed* khi người học bản cũ. **Gap List, điều kiện giao việc, gợi ý người tham gia** chỉ so số tài liệu, không so phiên bản, nên coi là đã đạt. Trên DEV có 56 cặp người–tài liệu (19 tài liệu) mà lần học gần nhất là bản đã bị thay | `TrainingMatrixCompletionService.state` so với `TrainingComplianceService` (BASE), `TrainingJobAssignmentService`, `TrainingActivityService` (truy vấn người đề xuất) | Dùng chung một quy tắc trạng thái cho cả bốn chỗ |
| L2 | 5.1: giảng viên đã được đào tạo GMP | Nhận ra "đã đào tạo GMP" bằng việc tên chủ đề **có chữ "gmp"**. Chủ đề đặt tên "Thực hành tốt sản xuất" không được tính; chủ đề bất kỳ có chữ "gmp" lại được tính | `TrainingTrainerService.qualification` | Đánh dấu chủ đề GMP trong ma trận, không đoán theo chữ |

## 2. Trái hoặc khác điều SOP quy định

| # | SOP | SOP yêu cầu | Phần mềm làm | Ghi chú |
|---|---|---|---|---|
| T1 | 5.3.9 | Trưởng đơn vị xác nhận chữ ký; thay đổi phải được duyệt trước khi áp dụng | **Sửa 2026-11-27: không phải lệch.** FRM.0007 bản giấy có cột *Trưởng đơn vị* ký; xác nhận làm trên giấy, hệ thống giữ bản scan (D-FRM-2). Còn hở: nhân viên **tự tải được**, hệ thống không hỏi giấy đã có chữ ký trưởng đơn vị chưa | `TrainingSpecimenService.upload` |
| T2 | 5.3.2 | Tần suất đào tạo định kỳ tài liệu **theo thời hạn rà soát tài liệu** | Cố định **1 năm** cho mọi dòng đánh dấu hằng năm | `TrainingComplianceService`, `TrainingMatrixCompletionService` |
| T3 | 5.3.2; mục 3 | **QA** lập **một** yêu cầu đào tạo hằng năm cho **toàn nhà máy**; QM duyệt | Yêu cầu đào tạo lập **theo từng bộ phận**, lấy gợi ý từ ma trận bộ phận đó; người duyệt chọn theo quyền | `TrainingRequirementService.create`, `suggestions` |
| T4 | 5.1.1 | Đào tạo ban đầu gồm ba phần; nội dung theo ma trận | Màn Xem xét đào tạo nhân sự viết cứng ba phần; nút tạo đào tạo sinh hoạt động **Đột xuất**, trống, riêng từng người, không cần quyền cấp mã của QA | `TrainingPersonnelReviewService`; trái cả quyết định 2026-10-27 và 5.3.3 |
| T5 | 5.3.1 | Đào tạo chung **của cả nhà máy** | Không có danh sách chung của nhà máy: dòng chung được **chép vào ma trận từng bộ phận**, sinh bản nháp phải duyệt lại; bộ phận chưa có ma trận bị bỏ qua. Người chưa có bộ phận khớp thì không bị yêu cầu gì | `TrainingMatrixService` (apply locked rows) |
| T6 | 5.3.4 | Danh sách gồm **cả người đang vắng** (thai sản, nghỉ phép...) | Chỉ thêm được tài khoản **Active**. Người nghỉ dài ngày bị để Suspended thì không vào được danh sách | Người nghỉ vẫn Active thì không bị ảnh hưởng |
| T7 | 5.3.3 | Lý do hoãn ghi ở cột Ghi chú của Nhật ký cấp mã | **Sửa 2026-11-27: không phải lệch.** FRM.0044 giữ trên giấy (D-FRM-1), lý do ghi tay. Màn danh sách số chỉ hiện số lần hoãn; thêm lý do là hỗ trợ, không bắt buộc | `TrainingRecordService` |
| T8 | 5.3.6 | Ban hành lần đầu: phòng soạn thảo đào tạo; nâng phiên bản hoặc định kỳ: **trưởng từng đơn vị đào tạo đơn vị mình** | Mở một hoạt động cho phòng sở hữu tài liệu, không phân buổi theo đơn vị | `TrainingDocumentIntegrationService.createForDocument` |
| T9 | 5.3.6 | Báo HCNS chuẩn bị địa điểm; báo bộ phận chuẩn bị thiết bị | Chỉ báo người được gán việc chuẩn bị | `TrainingPreparationService` |
| T10 | 5.3.7 | Không đạt: **tạm ngừng việc** | Gắn cờ và thông báo, không chặn | D-12, chủ dự án đã chấp nhận |
| T11 | 5.3.1 | Ma trận trình **các cấp**; trưởng phòng QA duyệt toàn nhà máy | Một người duyệt bất kỳ có quyền | |
| T12 | 5.3.5 | Trưởng đơn vị liên quan **và** trưởng phòng QA duyệt nội dung | Hai trưởng bộ phận có quyền; chỉ nhắc, không buộc đúng hai chức danh | Quyết định 2026-11-23 |

## 3. SOP nêu, phần mềm chưa có (làm tay)

| # | SOP | Việc chưa có |
|---|---|---|
| M1 | 5.1.1; 5.3.11 | Không tự phát hiện vắng trên 6 tháng, chuyển bộ phận, đổi công việc |
| M2 | 5.3.1 | Không nhắc rà soát ma trận hằng năm trước khi lập yêu cầu (không thấy bộ nhắc này) |
| M3 | 5.3.2 | Không biết đợt rà soát tài liệu **đã xong**: ngày do người dùng gõ; bộ nhắc dựa trên ngày đến hạn rà soát |
| M4 | 5.1.1 | CAPA, kiểm soát thay đổi, đánh giá chỉ là nhãn lý do, không liên kết hồ sơ nguồn |
| M5 | 5.3.10 | Không gửi hồ sơ cá nhân cho đơn vị; không nhắc in hằng năm; hết hạn lưu chỉ đánh dấu |
| M6 | 5.3.11 | Không mô hình nhiều cơ sở |

## 4. SOP tự mâu thuẫn (cần QA sửa SOP)

| # | Chỗ | Mâu thuẫn |
|---|---|---|
| S1 | 5.1, người ký tài liệu | Tiếng Việt: người ký **được xem là đã được đào tạo** ban đầu. Tiếng Anh: người ký **sẽ đào tạo** ban đầu. Phần mềm theo tiếng Việt (ghi hồ sơ cho người ký) |
| S2 | 5.1.2 và 5.3.7, tự đọc | Một nơi: trưởng phòng xác nhận bằng lời. Nơi kia: nhân viên ký APD.0108 |
| S3 | 5.1.4 và 5.3.7, mã bù | Hậu tố chỉ nêu cho người vắng; người trượt không nói mã |
| S4 | 5.3.3 và mục 3, đào tạo ban đầu | QA tổ chức, hay trưởng đơn vị thực hiện |
| S5 | 5.3.5 và mục 3 | Người duyệt nội dung và yêu cầu: trưởng phòng QA hay QM |

S2 đến S5 đã có quyết định của chủ dự án ngày 2026-11-23; SOP chưa được sửa theo.

## 5. Tài liệu cũ không còn đúng

- `TRAINING_SOP0003_TRACEABILITY_AND_QA_SIGNOFF.md`: ghi có tab *Initial Training* cấu hình ba phần (đã bỏ từ V678); ghi 5.3.9 là *Có* (xem T1).
- GAP-TR-006: chưa nêu L1, L2, T2, T3, T5, T7.

## 6. Thứ tự đề xuất

1. **L1**: làm hồ sơ tuân thủ báo sai.
2. **T4 và T5**: nhân viên mới học gì, lấy từ đâu.
3. **T2, T3, M3**: đào tạo định kỳ.
4. **L2, T1, T7**: sửa gọn.
5. Còn lại: cần chủ dự án hoặc QA quyết định giữa sửa phần mềm và sửa SOP.

## 7. Danh mục kiểm tra (Xem xét đào tạo nhân sự)

SOP không có biểu mẫu danh mục kiểm tra. Các mục do phần mềm suy ra từ 5.1.1, 5.3.8, 5.3.9 và 5.3.11, viết cứng trong `TrainingPersonnelReviewService.ITEMS`.

| Loại | Mục trong phần mềm | Đối chiếu SOP |
|---|---|---|
| Nhân viên mới | Nội quy và an toàn; GMP chung; chuyên môn công việc | Đúng ba phần của 5.1.1, nhưng không lấy chủ đề từ ma trận; mục "Nội quy và an toàn" không gắn được hoạt động đào tạo |
| Nhân viên mới | Chữ ký mẫu; Bản giao việc | Đúng 5.3.9 và 5.3.8; xem T1 |
| Vắng lâu ngày | Rà soát hồ sơ; Đào tạo lại | SOP chỉ có một câu (5.1.1). Không mở được khi vắng chưa quá 6 tháng, dù SOP cho đào tạo lại "khi thấy cần thiết" |
| Chuyển bộ phận | Rà soát hồ sơ; Đào tạo bổ sung; Bản giao việc | 5.3.11: trưởng bộ phận tiếp nhận **và** nhân viên được phân công cùng rà soát; phần mềm chỉ một người ký đóng |
| Chuyển cơ sở | Bàn giao hồ sơ; Đào tạo tại cơ sở mới; Bản giao việc | 5.3.11: đào tạo **như nhân viên mới**; phần mềm gộp thành một mục, không có ba phần |
| (không có) | Đổi công việc trong cùng bộ phận | 5.3.8 yêu cầu cập nhật bản giao việc; 5.1.1 xếp vào đào tạo đột xuất; không có loại xem xét tương ứng |

Cách hoàn thành mục (cả SOP lẫn ý định kiểm soát đều cần xem lại):

- Mục đào tạo đánh dấu **Done** được mà không cần liên kết hoạt động nào.
- Nếu liên kết, chỉ kiểm tra người đó **có tên trong danh sách**; không cần hoạt động hoàn tất hay người đó đạt.
- Đóng xem xét chỉ yêu cầu không còn mục Pending và chữ ký. Kết quả kiểm tra của hệ thống (chữ ký mẫu, bản giao việc, bàn giao) chỉ để hiển thị.
- Kiểm tra "ma trận đã xong" ở mục Bản giao việc dùng cùng quy tắc bị lỗi L1.
