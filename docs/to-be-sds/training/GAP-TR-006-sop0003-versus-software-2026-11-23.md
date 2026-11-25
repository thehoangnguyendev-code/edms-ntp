# GAP-TR-006 – SOP.0003.02 so với phần mềm Training Management: chỗ lệch, chỗ thiếu, chỗ phần mềm đi trước

**Viết cho:** chủ dự án và QA (để chọn việc cần sửa, cần quyết định, và cần đưa vào lần sửa SOP). **Lập:** 2026-11-23 trên DEV. **Đây không phải phê duyệt GMP.** Mỗi nhận định ghi rõ nguồn là SOP, mã nguồn hay quyết định của chủ dự án.

## 1. Đã đọc gì, kiểm tra gì

| Đã đọc | Ghi chú |
|---|---|
| Toàn bộ `SOP.0003.02 Training_261014.md` (mục 1 đến 7, gồm mục 3 trách nhiệm, mục 4 định nghĩa, lịch sử sửa đổi 2.0.0) | Đọc từng dòng, không chỉ tìm từ khoá |
| Lưu đồ mục 5.2 (`SOP.0003.02 Flowchart (muc 5.2).png`) | Bản markdown của SOP chỉ có ảnh bị cắt, nên phải đọc tệp ảnh riêng |
| Bảng đối chiếu cũ `TRAINING_SOP0003_TRACEABILITY_AND_QA_SIGNOFF.md` (2026-10-28) | Dùng làm điểm xuất phát, **không tin hoàn toàn**: nó chưa có hai người duyệt, Pending Approval, khoá Notified, Start Training |
| Mã nguồn: `TrainingActivityService`, `TrainingRequirementService`, `TrainingMatrixService`, `TrainingPersonnelReviewService`, `TrainingPreparationService`, `TrainingDocumentIntegrationService`, `TrainingNumberService`, `TrainingJobAssignmentService`, nhãn lý do ở frontend | Đọc mã, chưa chạy lại từng kịch bản |

**Chưa kiểm tra:** từng biểu mẫu APD/FRM mở bằng Word thật; hành vi trên trình duyệt; các kịch bản e2e cũ; các điều khoản đã có bằng chứng trong bảng cũ mà mình không có lý do nghi ngờ (ví dụ 5.3.9 chữ ký mẫu, 5.3.10 hồ sơ cá nhân, ngưỡng 70%).

## 2. Kết luận ngắn

Phần mềm bám SOP khá sát ở các bước chính (mã, danh sách, nội dung, buổi, đánh giá, bù, hồ sơ). Lệch và thiếu tập trung ở **năm nguyên nhân** (mục 6): chức danh trong SOP không được mô hình hoá, các module chưa nối với nhau, phần mềm không có dữ liệu nhân sự, định nghĩa "buổi đào tạo" mới (SOP 2.0.0) chưa có quy trình riêng, và SOP tự mâu thuẫn ở vài chỗ. Phần mềm cũng **đi trước SOP** ở nhiều chỗ (mục 4) mà SOP chưa mô tả.

## 3. SOP nêu mà phần mềm chưa có hoặc chỉ làm một phần

| # | Điều khoản SOP | SOP yêu cầu | Phần mềm hiện làm | Bằng chứng | Nguyên nhân gốc | Mức đề xuất |
|---|---|---|---|---|---|---|
| A1 | 5.3.1; mục 3 (Trưởng phòng QA) | Ma trận "trình **các cấp** phê duyệt"; trưởng phòng QA duyệt ma trận cả nhà máy | **Một** người duyệt do người gửi chỉ định, chỉ cần quyền `training.matrix.approve`; không có chuỗi cấp, không buộc là trưởng phòng QA khi ma trận là của cả nhà máy | `TrainingMatrixService` (MATRIX_APPROVE một bước, dòng 504, 528) | Mô hình duyệt theo quyền, một bước; chức danh SOP không được mô hình | Trung bình |
| A2 | 5.3.2 | Yêu cầu đào tạo SOP định kỳ lập **sau khi rà soát tài liệu xong**, duyệt chậm nhất cuối tháng đó | Người dùng **gõ tay** ngày rà soát xong; Document Control có bộ nhắc kỳ rà soát nhưng **không báo** cho Training khi một đợt rà soát hoàn tất | `TrainingRequirementService` (dòng 223 đến 227); `DocumentPeriodicReviewScheduler` chỉ gửi nhắc | Hai module làm riêng, thiếu sự kiện bàn giao giữa Document Control và Training | **Cao** (đúng ý bạn: Training gắn chặt Document Control) |
| A3 | 5.1.1 (dòng 124); 5.3.11; lưu đồ (Điều chuyển) | Đào tạo lại khi vắng trên 6 tháng; chuyển bộ phận hay cơ sở kéo theo đào tạo | Phần mềm **không phát hiện** gì; người dùng tự mở Personnel Review rồi làm theo danh sách việc | `TrainingPersonnelReviewService` (ghi rõ: "holds no leave or staffing data and detects nothing") | Hệ thống không có dữ liệu nghỉ phép hay biến động nhân sự | Trung bình |
| A4 | 5.1.1 (dòng 112 đến 126) | Đào tạo đột xuất do: chức trách hoặc khu vực mới, đánh giá nội bộ hoặc bên ngoài, SOP mới hoặc sửa, **CAPA, kiểm soát thay đổi**, khách, đào tạo lại, cập nhật kiến thức | Lý do chỉ là một nhãn (New hire, Transfer, New SOP, SOP version, CAPA, Audit finding, Visitor, Absence return, Other). **Thiếu** "Change Control", "nhà thầu tạm thời", "cập nhật hoặc nâng cao kiến thức"; không có liên kết tới hồ sơ CAPA, Change Control hay đánh giá | `KIND_REASON_LABEL` ở frontend; `CreateRequest` chỉ có `kindReason` | Lý do thiết kế như danh mục nhãn, không như tham chiếu tới bản ghi nguồn | Thấp đến trung bình |
| A5 | 5.3.6 (dòng 329 đến 335) | Ban hành lần đầu: phòng soạn thảo đào tạo các phòng liên quan. **Nâng phiên bản hoặc định kỳ: trưởng từng đơn vị đào tạo đơn vị mình** | Document Control mở **một** hoạt động theo tài liệu, không có buổi riêng cho từng đơn vị với trưởng đơn vị làm giảng viên; người tổ chức tự tạo từng buổi | `TrainingDocumentIntegrationService` (tạo hoạt động không có session) | Tích hợp mới giải bài toán "một tài liệu một hoạt động", chưa mô hình "mỗi đơn vị một buổi" | **Cao** (liên quan Document Control) |
| A6 | 5.3.6 (dòng 308 đến 314) | **Thông báo HCNS** chuẩn bị địa điểm, phương tiện; thông báo các bộ phận chuẩn bị thiết bị (thực hành) | Danh sách 4 việc chuẩn bị theo buổi, gán cho **một người** được thông báo; không tự thông báo HCNS hay bộ phận liên quan. Bảng cũ ghi "Có" cho điều này, hơi quá | `TrainingPreparationService.update` | Chuẩn bị mô hình như checklist cá nhân, không gắn bộ phận nhận | Trung bình |
| A7 | Mục 4.2 (SOP 2.0.0) | Buổi đào tạo = một hoặc nhiều chủ đề, cùng giảng viên, cùng nhóm | Server nhận nhiều chủ đề, nhưng **giao diện chỉ nhập một**; không có cách thêm, sao chép, chia nhóm nhanh; session 1 không có tiêu đề | `SessionPanel` (một ô Training Topic); xem PLAN-TR-005 | SOP 2.0.0 thêm định nghĩa sau khi mô hình đã có; chưa thiết kế quy trình theo định nghĩa mới | **Cao** (đang lập kế hoạch) |
| A8 | 5.3.10 | Gửi file mềm hồ sơ cá nhân cho đơn vị quản lý | Tạo tệp, **không tự gửi** | Bảng cũ | Việc thủ công | Thấp |
| A9 | 5.3.10 | Hồ sơ giữ ít nhất 10 năm sau khi nghỉ | Chỉ đánh dấu hết hạn, không có quy trình huỷ (D-17) | Bảng cũ | Quy trình huỷ chưa xây | Thấp |
| A10 | 5.3.11 | Chuyển cơ sở: bàn giao bản sao, đào tạo như nhân viên mới | Có review loại này nhưng **không mô hình nhiều cơ sở** (D-18) | Bảng cũ | Hệ thống một cơ sở | Thấp |

## 4. Phần mềm làm trước hoặc khác SOP (SOP chưa mô tả)

Các điểm này không sai SOP, nhưng **SOP cần sửa theo** (hoặc QA ghi nhận là yêu cầu của phần mềm) để hồ sơ không mâu thuẫn.

| # | Phần mềm | SOP nói gì | Ghi chú |
|---|---|---|---|
| B1 | Chữ ký điện tử cho từng bước chuyển trạng thái (xác nhận danh sách, gửi duyệt, duyệt, thông báo, bắt đầu, gửi danh sách, hoàn tất) | SOP chỉ nêu ký trên biểu mẫu (APD, FRM) | Theo EU-GMP Annex 11 |
| B2 | **Pending Approval**, hai người duyệt tuần tự, từ chối trả về Planned giữ nguyên người duyệt (DEC-TRAINING-2026-11-23-10) | 5.3.5: "trưởng đơn vị liên quan và trưởng QA xem xét và phê duyệt", không nói thứ tự hay đường từ chối | Mới làm hôm nay |
| B3 | Người duyệt chọn **theo quyền**, không buộc là trưởng đơn vị hay trưởng QA (DEC-TRAINING-2026-11-23-11) | 5.3.5 nêu chức danh; lưu đồ nêu "Departments, QM" | Chủ dự án đã chấp nhận lệch, QA cần ký xác nhận |
| B4 | **Notified khoá sửa**, Prepare Training, Start Training có chữ ký, ghi nhận lần in bài kiểm tra | SOP 5.3.6 không có các bước này | Đang làm (Đợt 2) |
| B5 | Giảng viên không đủ điều kiện thì **bị chặn** (có ngoại lệ có duyệt) | 5.1 nêu yêu cầu, không nói chặn | D-10 chủ dự án chấp nhận |
| B6 | Hậu tố chữ cái dùng cho **cả người trượt**, không chỉ người vắng | 5.1.4 dòng 160: chỉ người vắng; người trượt SOP chỉ nói "đào tạo lại" | Mở rộng của hệ thống |
| B7 | Vắng dự kiến (Planned Absence) | Không có | Tính năng hệ thống |
| B8 | Bài kiểm tra điện tử, check-in, điểm danh hàng loạt, QR trên bản giấy, kiểm tra bản scan | SOP chỉ nêu bài kiểm tra giấy và ký | |
| B9 | Tạm ngừng việc là **cờ** trên hồ sơ, không chặn (D-12) | 5.3.7: "tạm ngừng việc" | Lệch về mức độ |
| B10 | Hạn 7 ngày làm việc cấu hình được; quá hạn thì cảnh báo, không chặn | 5.3.7: "trong vòng 7 ngày làm việc" | |
| B11 | Training Compliance (Gap List, Matrix Completion), Job Roles, Document Impact, cảnh báo nhà cung cấp, xuất hồ sơ có mã băm, đánh dấu hạn lưu giữ | SOP không mô tả | Hỗ trợ SOP |
| B12 | Tự đọc: **từng người ký điện tử**, trưởng phòng ký xác nhận cả danh sách (quyết định 2026-10-31) | 5.1.2: trưởng phòng xác nhận (lời nói); 5.3.7: nhân viên ký APD.0108 | SOP tự khác nhau, xem C3 |

## 5. Chỗ SOP tự mâu thuẫn hoặc để mở (cần chủ dự án hoặc QA quyết định)

| # | Mâu thuẫn | Hiện phần mềm theo | Cần quyết định |
|---|---|---|---|
| C1 | **Ai duyệt nội dung đào tạo:** 5.3.5 viết "trưởng đơn vị liên quan và trưởng phòng QA"; lưu đồ viết "Departments, QM"; mục 3 giao cho QM duyệt yêu cầu đào tạo, trưởng phòng QA duyệt ma trận | Hai người bất kỳ có quyền duyệt (DEC-11) | Có sửa SOP cho khớp, hay buộc đúng chức danh |
| C2 | **Ai tổ chức đào tạo ban đầu:** 5.3.3 nói QA cấp mã và tổ chức; mục 3 nói trưởng đơn vị liên quan "thực hiện đào tạo ban đầu của đơn vị mình"; 5.1.1 chia ba phần cho HCNS, QA, đơn vị liên quan | Quyền cấp mã `training.code.allocate`, **không buộc phòng tổ chức là QA** | Một mã QA ba buổi, hay mỗi phần một hoạt động |
| C3 | **Xác nhận tự đọc:** 5.1.2 trưởng phòng xác nhận bằng lời; 5.3.7 nhân viên ký APD.0108 | Cả hai (nhân viên ký, trưởng phòng ký danh sách) | Chọn một cách để SOP khớp |
| C4 | **Mã cho đào tạo lại khi trượt:** SOP chỉ quy định hậu tố cho người vắng | Dùng chung hậu tố | Có chấp nhận mở rộng này không |
| C5 | **Vắng trên 6 tháng:** 5.1.1 xếp vào đào tạo đột xuất; 5.3.7 chỉ nói bù cho người vắng ở một buổi | Personnel Review thủ công; bù chỉ khi tài khoản Active | Hai trường hợp khác nhau, cần làm rõ |
| C6 | **Vai trò DCO** ở bước đánh giá (lưu đồ: "Trainer, DCO") không có trong phần chữ | Quyền ghi kết quả (`training.assessment.record`), không riêng DCO | DCO làm gì ở bước này |

## 6. Nguyên nhân gốc của các chỗ lệch

1. **Chức danh trong SOP không được mô hình hoá.** SOP dùng Trưởng ĐVLQ, QA Manager, QM, PM, DCO; hệ thống dùng quyền, phạm vi phòng ban và người được chỉ định. Đây là nguyên tắc thiết kế (không dựa vào chức danh) nên A1, B3, C1, C2, C6 đều từ đây.
2. **Module làm riêng, thiếu sự kiện bàn giao.** Document Control (rà soát định kỳ) và Training (yêu cầu đào tạo SOP định kỳ) không nói chuyện (A2); lý do CAPA, Change Control, đánh giá chỉ là nhãn (A4).
3. **Không có dữ liệu nhân sự.** Không có nghỉ phép, điều chuyển, tuyển dụng, nên không tự phát hiện (A3).
4. **SOP 2.0.0 thêm định nghĩa sau khi mô hình đã dựng.** "Buổi đào tạo" và "Mã đào tạo" (mục 4.2) được thêm vào bản 2.0.0, nhưng chưa có quy trình thêm và quản lý session theo định nghĩa đó (A5, A7).
5. **SOP tự mâu thuẫn hoặc để mở** (mục 5), nên phần mềm phải chọn một cách; các lựa chọn chưa được QA ký.
6. Ngoài ra, **phần mềm đi trước SOP** vì yêu cầu EU-GMP (chữ ký điện tử, khoá sau duyệt) và quyết định của chủ dự án (mục 4). SOP chưa được sửa theo.

## 7. Tài liệu cũ cần cập nhật

| Tài liệu | Cần sửa |
|---|---|
| `TRAINING_SOP0003_TRACEABILITY_AND_QA_SIGNOFF.md` | Dòng 5.3.5 (hai bước theo quyền D-32/34 đã thay bằng hai người duyệt tuần tự, DEC-10 và DEC-11); dòng 5.3.6 (thêm khoá Notified, Prepare, Start Training); dòng chuẩn bị (A6 ghi "Có" quá mức); phiên bản và số test |
| `PLAN-TR-005-sessions-of-a-training-activity.md` | Dòng F: tách người vắng (có hậu tố theo 5.1.4) và người trượt (SOP chỉ nói đào tạo lại; B6) |

## 8. Việc đề xuất

1. Quyết định C1 đến C6 (ghi vào Decision Log); đây là gốc của nhiều chỗ lệch.
2. Làm A2 và A5 trước: chúng nằm ở chỗ Training gắn với Document Control.
3. Làm A7 (đã có PLAN-TR-005).
4. Đưa danh sách mục 4 cho QA để sửa SOP, hoặc QA ghi nhận đó là yêu cầu của phần mềm.
5. Cập nhật bảng đối chiếu cũ sau khi Đợt 2 xong.

## 9. Quyết định của chủ dự án ngày 2026-11-23 (DEC-TRAINING-2026-11-23-12)

| # | Quyết định | Việc phần mềm cần làm |
|---|---|---|
| C1 | Người dùng tự chọn hai người duyệt, nhưng **có thông báo** rằng SOP mong muốn trưởng đơn vị liên quan và Quản lý chất lượng (QM). Không chặn | Thêm thông báo vào màn Select Approver và ghi vào Audit Trail. **Còn thiếu:** cách phần mềm nhận ra QM (trên DEV không có vai trò hay chức danh QM) |
| C3 | Nhân viên ký trước; trưởng phòng ký sau cùng khi cả phòng đã ký hoặc được ghi là không đọc được | Đã đúng như vậy trong mã, không làm thêm |
| C4 | Người trượt dùng chung hậu tố với người vắng | Giữ; đề nghị QA sửa SOP |
| C5 | Vắng trên 6 tháng là đào tạo đột xuất, khác với bù cho người vắng | Giữ Personnel Review và lý do "Return after absence" |
| C1 (bổ sung) | QM nhận ra bằng **quyền riêng** `training.quality_manager` (V846) | Đã làm: nhãn Quản lý chất lượng, thông báo không chặn, Audit Trail |
| C2 | **Một hoạt động, ba buổi** (HCNS, QA, đơn vị liên quan), một mã cho nhân viên mới | Làm cùng thiết kế session (PLAN-TR-005) |
| C6 | **Trainer nhập kết quả**, không cần vai trò DCO riêng | Không đổi |
