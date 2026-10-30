# Training Management: đối chiếu SOP.0003.02 và phiếu xác nhận của QA

**Viết cho:** QA (người xem xét và ký xác nhận). **Lập:** 2026-10-28, trên DEV, từ mã nguồn, change record và kết quả chạy test trong ngày. **Tài liệu này không phải phê duyệt GMP** và không tự chứng minh hệ thống tuân thủ. Nó cho QA thấy từng điều khoản của SOP được đáp ứng ở đâu, bằng chứng nào có, bằng chứng nào chưa có, và những quyết định đang chờ QA.

Nguồn đối chiếu: `docs/training_docs/SOP.0003.02 Training_261014.md` (SOP.0003, bản 02). Thiết kế: `docs/to-be-sds/training/` (PLAN-TR-001, SDS-TR-001). Hồ sơ thay đổi: `eqms-backend/docs/validation/TRAINING_PAPER_BATCH_2026_10_18_CHANGE_RECORD.md`. Nhật ký quyết định: `eqms-backend/docs/governance/DECISION_LOG.md`.

## 1. Cách đọc các mức bằng chứng

| Ký hiệu | Nghĩa | Độ tin cậy |
|---|---|---|
| **U** | Có test đơn vị ở backend, chạy lại ngày 2026-10-28, tất cả các test `Training*Test` đều qua | Kiểm quy tắc, không kiểm màn hình |
| **F** | Có test giao diện (Vitest), chạy ngày 2026-10-28, 213 test của Training và Configuration qua | Kiểm hành vi của thành phần, không phải trình duyệt thật |
| **E** | Có kịch bản e2e qua API trên DEV (`evidence/training_2026_10_18/eNN_*.py`). Kết quả đã ghi trong change record lúc chạy. **Không chạy lại hôm nay** (thiếu mật khẩu tài khoản DEV trong phiên làm việc) | Đã từng chạy trên hệ thống thật, chưa xác nhận lại |
| **B** | Đã xem trên trình duyệt thật | **Chưa có cho phần lớn các màn hình**, xem mục 5 |
| **P** | Việc thủ công ngoài hệ thống (quy trình, ký tay, giữ bản gốc) | Hệ thống chỉ hỗ trợ |

Cột "Mức đáp ứng": **Có** (đã làm theo điều khoản), **Một phần** (làm một phần, nói rõ phần còn lại), **Ngoài hệ thống** (điều khoản là việc thủ công), **Chưa xác nhận** (tôi không tìm được bằng chứng trong mã; QA cần đọc lại).

## 2. Đối chiếu từng điều khoản

### 5.1 Nguyên tắc chung

| SOP | Yêu cầu | Hệ thống đáp ứng thế nào | Mức | Bằng chứng | Lưu ý |
|---|---|---|---|---|---|
| 5.1 | Đào tạo trước khi bắt đầu công việc, theo vị trí | Ma trận đào tạo theo Work Position; Training Compliance (Gap List, Matrix Completion) cho thấy người chưa đạt; bản giao việc chỉ sau khi xong ma trận (D-15) | Có | U (TrainingMatrixCompletionSummaryTest, TrainingJobPositionsTest), E (e2e43, e2e46) | "Trưởng đơn vị đảm bảo" là việc của con người; hệ thống chỉ chỉ ra khoảng trống |
| 5.1 | Người ký tài liệu được coi đã đào tạo ban đầu về tài liệu đó | Khi revision được duyệt, hệ thống tự tạo hồ sơ nguồn `SIGNATORY_INITIAL` cho người soạn, kiểm tra, duyệt (TR-33, D-45) | Có (chưa có bằng chứng chạy) | Không có kịch bản nào kiểm bản ghi `SIGNATORY_INITIAL`; mã ở `TrainingDocumentIntegrationService` | Cần một lần kiểm: duyệt một revision rồi xem hồ sơ của người soạn, kiểm tra, duyệt. Quy tắc do thiết kế, SOP không nêu chi tiết |
| 5.1 | Yêu cầu đối với giảng viên: đào tạo GMP; đào tạo đủ chuyên môn; là người soạn, kiểm tra, duyệt SOP hoặc trưởng bộ phận, giám sát đã được đào tạo SOP | `TrainingTrainerService.qualification`: cần hồ sơ GMP **và** (đã đào tạo chủ đề **hoặc** tham gia tài liệu **hoặc** QA cấp quyền ngoại lệ). Chọn giảng viên chưa đủ điều kiện thì bị chặn, có quy trình ngoại lệ có duyệt. Từ 2026-10-28, bản ghi "Trainer" **không** được tính là chứng minh giảng viên đã được đào tạo | Có (đề xuất D-10 chờ QA) | U (TrainingTrainerServiceTest, gồm test mới) | Giảng viên bên ngoài không bị đánh giá ở đây |
| 5.1 | Đào tạo nội bộ: ban đầu, định kỳ, đột xuất; đào tạo bên ngoài: chủ động, bị động | Loại và lý do của hoạt động (Initial, Periodic, Unplanned, External với nhãn Active/Passive) | Có | E (e2e21), U | Khách tham quan và người ngoài không có tài khoản: có tên, đơn vị, không có hồ sơ cá nhân (D-21) |
| 5.1 | Ba phần của đào tạo ban đầu: an toàn và nội quy (HCNS), nguyên tắc GMP (QA), chuyên môn (bộ phận liên quan) | Tab Initial Training của Training Compliance, tên và đơn vị của từng phần cấu hình ở Training Administration; phần 3 lấy từ ma trận của Work Position (V674, V677) | Có | E (e2e44, e2e46) | Số ngày "nhân viên mới" chỉnh được ở Training Properties từ 2026-10-28 |
| 5.1 | Chọn đơn vị đào tạo bên ngoài theo SOP.0025 | Danh mục đơn vị đào tạo đã duyệt (Draft, Active, Inactive, duyệt bởi người khác); cảnh báo (không chặn) khi đơn vị chưa duyệt (V659) | Có | U (TrainingVendorAndPaperCopyRulesTest), E (e2e39) | Cảnh báo, không chặn |
| 5.1.2 | Hình thức đào tạo và cách đánh giá: tự đọc (APD.0108, trưởng phòng xác nhận), tập trung (bài test APD.0009), kết hợp trực tuyến, thực hành (checklist hoặc quan sát) | Mỗi buổi chọn hình thức; cách đánh giá mặc định theo SOP, chọn khác được và được ghi lại (D-41); `TEST`, `CHECKLIST`, `OBSERVATION`, `SELF_READING_CONFIRMATION` | Có | U (TrainingContentRulesTest), E (e2e21, e2e34) | |
| 5.1.3 | Tài liệu mới hoặc nâng phiên bản: nên đào tạo trong 10 ngày | Mặc định 10 ngày ở Training Properties; **cảnh báo và đánh dấu quá hạn, không chặn** (D-11) | Có (D-11) | U (TrainingSettingsServiceTest), E (e2e24) | SOP dùng chữ "nên"; việc chặn phát hành nằm ở bước Pending Training của Document Control |
| 5.1.4 | Mã đào tạo `TRN/DC/YY-XXX`; hậu tố chữ cái cho buổi bổ sung; một mã nhiều chủ đề hoặc nhiều buổi; sổ cấp mã | `TrainingCodeService`, hậu tố a, b, c ... sau `z` là aa, ab (D-07); số nhật ký FRM.0044 và màn Training Number Log | Có | U (TrainingCodeServiceTest), E (e2e29, e2e36, e2e49) | |

### 5.3 Mô tả quy trình

| SOP | Yêu cầu | Hệ thống đáp ứng thế nào | Mức | Bằng chứng | Lưu ý |
|---|---|---|---|---|---|
| 5.3.1 | Trưởng đơn vị lập ma trận theo APD.0011 và trình duyệt; vị trí quản lý cấp cao do QA lập | Ma trận theo bộ phận, phiên bản, duyệt có chữ ký; cột nhạy cảm chỉ QA sửa; xuất Word/PDF theo mẫu APD.0011 | Có | U (TrainingMatrixFormServiceTest), E (e2e35, e2e47) | Xuất khổ dọc A4 theo mẫu APD.0011.02 (quyết định 2026-10-28). Chưa thử trên tài khoản trưởng đơn vị thật |
| 5.3.1 | Cập nhật ma trận khi đổi mô tả công việc, sau rà soát hằng năm, khi ban hành tài liệu mới | Tạo phiên bản ma trận mới từ bản hiệu lực; đánh giá tác động đào tạo của tài liệu (Document Trainings, Assess impact) | Một phần | U (TrainingImpactServiceTest) | Việc "khi nào cập nhật" là quy trình; hệ thống không tự nhận biết đổi mô tả công việc |
| 5.3.1 | Tài liệu cấp 4 và các thay đổi chỉ về hình thức có thể không cần đào tạo | Thuộc tính tùy chọn Document Level; cờ miễn tài liệu và bài kiểm tra theo hoạt động, bắt buộc có lý do (V642) | Một phần | U (TrainingContentRulesTest) | Cấp tài liệu chỉ để gợi ý, không đoán (D-03) |
| 5.3.1 | Ba nhóm trong ma trận (cả nhà máy, bộ phận, theo vị trí); "Tất cả nhân viên" | Nhóm FACTORY_GENERAL, hàng khoá do QA giữ, QA áp cho mọi bộ phận (D-52, D-53) | Có | E (e2e44, e2e46, e2e50 chưa chạy phần ghi) | e2e50 chỉ có phần kiểm từ chối được chạy; phần thêm dữ liệu cần `APPLY=1` |
| 5.3.2 | QA lập yêu cầu đào tạo APD.0118 hằng năm và theo rà soát tài liệu; lập và duyệt trước 31/12 | `TrainingRequirementService`, hạn mặc định 31/12 (Training Properties), ba chữ ký, khoá sau duyệt, mở đào tạo từ dòng yêu cầu, dời tháng | Có | E (e2e36, e2e8) | |
| 5.3.2 | Gửi bản sao yêu cầu đã duyệt cho bộ phận liên quan | Nhật ký phân phối bản sao: gửi, nhận, mỗi dòng không sửa sau đó (D-47) | Có | U (TrainingVendorAndPaperCopyRulesTest), E (e2e8) | Hệ thống ghi sự việc, không giữ bản sao |
| 5.3.3 | Đơn vị tổ chức cấp mã theo FRM.0044; QA cấp cho đào tạo ban đầu và định kỳ; bộ phận phát sinh cấp cho đột xuất và bên ngoài | Quyền tổ chức có phạm vi bộ phận; QA cho ban đầu và định kỳ (D-08) | Có | U, E (e2e26) | |
| 5.3.3 | Dời lịch giữ nguyên mã, ghi lý do | Postpone: giữ số, ghi lý do và hai ngày vào Audit Trail | Có | E (e2e23) | |
| 5.3.4 | Lập danh sách APD.0117 và báo người tham gia trước buổi; gồm cả người đang vắng; danh sách tự đọc theo APD.0108 | Danh sách có dòng "vắng có lý do" vẫn nằm trong danh sách (D-09); gợi ý từ ma trận; khoá sau khi xác nhận; APD.0108 cho tự đọc | Có | U (TrainingProposedParticipantServiceTest, TrainingParticipationRoleTest), E (e2e18, e2e36) | Giảng viên của buổi không nằm trong danh sách người tham gia (tên ở nội dung đào tạo) |
| 5.3.5 | Giảng viên chuẩn bị nội dung đã duyệt; bài kiểm tra theo APD.0009; trưởng đơn vị và trưởng QA xem xét và duyệt | Hai bước theo quyền: xem xét và duyệt nội dung, người xử lý do người gửi chỉ định (D-32, D-34); thư viện bài kiểm tra APD.0009 có duyệt có chữ ký | Có | U (TrainingAssessmentLibraryRulesTest, TrainingAssessmentFormTest, TrainingApprovalEligibleUsersTest), E (e2e33, e2e34) | |
| 5.3.6 | Chuẩn bị: báo HCNS, các bộ phận, học viên và giảng viên | Danh sách việc chuẩn bị theo buổi với đơn vị nhận, trạng thái và thông báo; thông báo trong ứng dụng và e-mail; không chặn Notify | Có | E (e2e22) | |
| 5.3.6 | Thực hiện đào tạo bằng nội dung đã duyệt; đơn vị soạn đào tạo ở lần đầu ban hành | Hoạt động từ tài liệu mở tự động khi revision được duyệt; chỉ nội dung đã duyệt được dùng | Có | E (e2e17, e2e24) | |
| 5.3.6 | Gửi danh sách người tham gia cho QA; tài liệu mới hoặc nâng phiên bản: gửi **cùng ngày** | Giảng viên ký gửi danh sách; hạn trong ngày; quá hạn: cảnh báo, đánh dấu OVERDUE, ghi lý do trễ (quyết định 2026-10-28: giữ cảnh báo, không chặn) | Có | E (e2e31, e2e32) | Trạng thái quá hạn (OVERDUE) chưa có kịch bản kiểm |
| 5.3.6 | Trễ so với yêu cầu đào tạo (không xong trong tháng đã đăng ký thì chuyển chủ đề sang tháng ngay sau đó) | Dời buổi sang ngày sau hạn: hệ thống báo và hỏi, nếu đồng ý thì Due Date sang cuối tháng mới và dòng của yêu cầu sang tháng mới, giữ tháng đã duyệt (`postponed_from`) và lý do; Audit Trail; báo QA và trưởng bộ phận tổ chức; dời quá một tháng thì đánh dấu "Beyond SOP window" (không chặn); Compliance đếm số dòng này; xuất APD.0118 ghi "(approved MM/YYYY)". Hoạt động vẫn do người dùng mở bằng tay từ dòng | Có (2026-10-29, D-PD-1..3, D-RL-1..3) | U (TrainingActivityLockRulesTest) | Chưa chạy trên DB thật và chưa xem trên trình duyệt; việc chọn tháng cuối làm hạn là suy luận từ câu "tháng ngay sau đó" |
| 5.3.7 | Chọn hình thức đánh giá theo 5.1.2 | Xem 5.1.2 | Có | U, E | |
| 5.3.7 | Hybrid: người dự trực tuyến ghi "Trực tuyến" ở cột Ký tên | Trạng thái ONLINE, in là "Trực tuyến / Online" trên APD.0117 | Có | U, E (e2e27) | |
| 5.3.7 | Vắng mặt ghi rõ là Vắng mặt; bố trí đào tạo bổ sung với danh sách riêng và quy tắc mã 5.1.4 | ABSENT với lý do; Supplementary tạo hoạt động mới cùng mã gốc kèm hậu tố | Có | E (e2e18, e2e21) | |
| 5.3.7 | Bài test: học viên ký mọi trang; đạt khi từ 70% tổng điểm; không đạt thì đào tạo lại | Kết quả do máy chủ tính, ngưỡng 70% ở Training Properties; tạm ngừng việc (cờ, không chặn hệ thống khác, D-12); đào tạo lại tạo hoạt động mới; bài kiểm tra trên giấy và trên máy | Có | U (TrainingSuspensionServiceTest, TrainingAssessmentFormTest), E (e2e21, e2e22 cho thông báo tạm ngừng, e2e34) | Chưa kiểm phiếu in trong Word thật |
| 5.3.7 | Tự đọc: ký APD.0108; QA ghi hồ sơ theo APD.0108 | Người đọc xác nhận có ký, trưởng phòng xác nhận cho cả danh sách | Có | E (e2e21, e2e38) | |
| 5.3.7 | Gửi kết quả cho QA trong 7 ngày làm việc để hoàn thiện hồ sơ (APD.0014) | Số ngày và cách đếm (Thứ hai đến Thứ sáu, đến Thứ bảy, hoặc mọi ngày) là cài đặt; nhắc việc; quá hạn thì cảnh báo và ghi lý do | Có (không có lịch ngày lễ, quyết định 2026-10-28) | U (TrainingWorkingDaysTest, TrainingSettingsServiceTest), E (e2e47) | Ngày lễ tính là ngày làm việc nên hạn chỉ sớm hơn thực tế. Trạng thái quá hạn chưa có kịch bản kiểm |
| 5.3.8 | Lập bản giao việc (APD.0024) khi xong ma trận của vị trí | Chặn khi ma trận chưa xong, ngoại lệ có lý do và có duyệt (D-15); một lần giao nhiều Job Role | Có | U (TrainingJobPositionsTest, TrainingPersonPositionDetailsTest), E (e2e43) | |
| 5.3.9 | Chữ ký mẫu của nhân viên (FRM.0007) | Ba trạng thái: Pending Confirmation, Approved, Obsoleted; xem cạnh bản scan để đối chiếu | Có | E (e2e41, e2e42) | |
| 5.3.10 | QA quản lý hồ sơ cá nhân APD.0014; cập nhật liên tục; in hằng năm hoặc khi yêu cầu | Bản ghi do máy chủ ghi, không sửa, không xoá; huỷ bằng vô hiệu hoá có lý do; xuất từng người; xuất theo bộ phận và năm có duyệt, ghi mã băm (D-48) | Có | E (e2e6) | |
| 5.3.10 | Gửi file mềm hồ sơ cho đơn vị quản lý | Hệ thống tạo tệp và bộ xuất; **không tự gửi** cho đơn vị | Một phần | | Việc gửi do con người làm |
| 5.3.10 | Nơi lưu bản gốc và bản sao theo bảng; giữ hồ sơ cũ cùng hồ sơ mới | Mỗi hồ sơ có mã mẫu; bản gốc ở QA là hồ sơ trong hệ thống; bản giấy có số bản và trạng thái Issued, Returned, Lost, Voided (V656) | Có | E (e2e37) | Cảnh báo, không chặn, khi hoàn tất còn bản giấy Issued |
| 5.3.10 | Giữ hồ sơ ít nhất 10 năm sau khi nhân viên nghỉ | Thời hạn lưu không thể đặt dưới 10 năm; hệ thống chỉ **đánh dấu** hết hạn lưu giữ, không xoá tự động (D-17) | Có (D-17 chờ QA) | U (TrainingSettingsServiceTest, test thêm ngày 2026-10-28: dưới 10 năm bị từ chối, không ghi gì) | Việc huỷ hồ sơ là quy trình riêng, chưa xây |
| 5.3.11 | Chuyển bộ phận: trưởng bộ phận tiếp nhận rà soát hồ sơ, tổ chức đào tạo bổ sung | Personnel Review loại chuyển bộ phận: danh sách việc, liên kết các đào tạo đã tổ chức, đóng bằng chữ ký của người khác nhân viên | Có | E (e2e9) | |
| 5.3.11 | Chuyển địa điểm: bàn giao bản sao hồ sơ; đào tạo như nhân viên mới | Review loại chuyển địa điểm; xuất bản sao hồ sơ có chữ ký; chưa mô hình nhiều cơ sở (D-18) | Một phần | E (e2e9) | |
| 6 | Biểu mẫu đính kèm | APD.0009, 0011, 0014, 0024, 0108, 0117, 0118, FRM.0007, FRM.0044 đều được điền từ mẫu Word công ty đã kích hoạt ở Training Properties | Có | E (e2e27, e2e34, e2e35, e2e36) | Chưa mở các tệp bằng Microsoft Word thật |

## 3. Phiếu quyết định của QA

Các mục dưới đây là quy tắc do thiết kế hoặc chủ dự án đề xuất mà **SOP.0003 không nêu hoặc nêu mở**. Hệ thống đang chạy theo cột "Hiện hệ thống làm". QA đánh dấu một ô cho mỗi dòng.

| ID | Nội dung | Hiện hệ thống làm | QA quyết định |
|---|---|---|---|
| D-10 | Giảng viên chưa đủ điều kiện | Chặn; có ngoại lệ có duyệt; bản ghi "Trainer" không tính là chứng minh đã đào tạo | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| D-11 | Quá 10 ngày đào tạo tài liệu mới | Cảnh báo, đánh dấu quá hạn, không chặn | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| D-12 | Tạm ngừng việc khi không đạt | Cờ trên hồ sơ và thông báo trưởng đơn vị; không chặn hệ thống khác | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| 2026-10-28 | Gửi kết quả cho QA quá 7 ngày làm việc | Cảnh báo, đánh dấu OVERDUE, ghi lý do trễ | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| V633 | Ngày làm việc | Chọn cách đếm; ngày lễ tính là ngày làm việc; không có lịch ngày nghỉ | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| D-17 | Huỷ hồ sơ sau 10 năm | Chỉ đánh dấu, không xoá; chưa có quy trình huỷ | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| D-21 | Khách, nhà thầu (không tài khoản) | Chỉ tên, đơn vị, ngày; không có hồ sơ cá nhân | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| D-35 | Bộ phận ngưng và mã đào tạo | Cấp mã theo bộ phận của tài liệu kể cả khi ngưng; không chọn bộ phận ngưng làm đơn vị tổ chức mới | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| D-36 | Ai được đào tạo | Chỉ người Active có mã nhân viên (432 trong 465 tài khoản Active trên DEV không có mã, là tài khoản test) | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| D-37 | Revision cũ khi bật tích hợp | Không cấp mã hồi tố; SOP.0017 ở lại MANUAL | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| D-43 | Kết quả `ATTENDED` cho đào tạo bên ngoài | Ghi "đã tham dự" trên hồ sơ cá nhân khi không có điểm; bằng chứng là chứng chỉ scan | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| 2026-10-28 | **Hình thức tham gia** (SOP.0003 không có điều khoản miễn bài kiểm tra) | Người dự không làm bài và người chỉ ghi tên được tính là đã đào tạo, có lý do bắt buộc; giảng viên không nằm trong danh sách, được ghi hồ sơ "Trainer" khi QA xác nhận hoàn thành, và được tính đáp ứng ma trận | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần sửa SOP.0003 trước |
| 2026-10-27 | Training Properties lưu không cần lý do | Lưu sau xác nhận; Audit Trail ghi người, giờ, giá trị cũ và mới | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |
| 2026-10-28 | Tính điểm bài kiểm tra | Tổng điểm mặc định 10, chia đều; ngưỡng đạt chung ở Training Properties (70%) | ☐ Chấp nhận ☐ Đổi: ______ ☐ Cần thêm thông tin |

## 3b. Quyết định của chủ sở hữu ngày 2026-10-29 (chưa phải chữ ký QA độc lập)

Chủ sở hữu (người giữ vai QA của dự án, không có người QA phê duyệt thứ hai được nêu tên) đã **chấp nhận hiện trạng** cho các dòng ở mục 3 (D-10, D-11, D-12, D-17, D-21, D-35, D-36, D-37, D-43, V633, hình thức tham gia, tính điểm, cách lưu Training Properties). Đây là một quyết định chung cho nhiều quy tắc có mức rủi ro khác nhau, **không thay chữ ký từng dòng và không chứng minh tuân thủ GMP**. Các ô ở mục 3 vẫn để trống cho tới khi có người ký thật. Ghi tại Decision Log, mục TRAINING-OWNER-ACCEPT-2026-10-29.

Quyết định bổ sung cùng ngày: khoa không có Department Head thì người có quyền `training.activity.close` xác nhận APD.0108 thay và bản ghi nói rõ; trưởng phòng khoa khác có người trong đợt đào tạo thấy activity trong danh sách (TRAINING-SELFREAD-DEPT-2026-10-29, cập nhật).

## 4. Những việc thủ công ngoài hệ thống (ký hiệu P)

Giữ bản gốc có chữ ký tay của APD.0009 và APD.0117 ở QA; ký tay trên bản giấy và scan; gửi file mềm hồ sơ cá nhân cho đơn vị quản lý (5.3.10); giám sát việc thực hiện đào tạo của trưởng đơn vị trước khi giao việc độc lập (5.1); huỷ hồ sơ sau 10 năm.

## 5. Điều chưa được kiểm chứng

1. **Trình duyệt:** phần lớn màn hình mới (thư viện bài kiểm tra, tab Materials, hình thức tham gia, cấu hình Table/Tiles, trang chi tiết hoạt động) chưa được người nào xem trên trình duyệt thật.
2. **Microsoft Word:** các biểu mẫu Word/PDF (APD.0009, 0011, 0014, 0117 ...) mới được đọc bằng thư viện và máy chủ tài liệu, chưa mở bằng Word.
3. **e2e:** các kịch bản E không chạy lại hôm nay; e2e27 mục 3.1 và e2e1 (`IndexError`) còn lỗi chưa xử lý; e2e50 chưa chạy phần ghi dữ liệu.
4. **Tài khoản thật:** chưa có thử nghiệm UAT với người dùng QA, trưởng đơn vị, giảng viên thật theo từng bước SOP.
5. **GitNexus:** `impact` và `detect_changes` không dùng được, nên không có bằng chứng tự động về phạm vi ảnh hưởng của các thay đổi chưa commit.
6. **Commit:** toàn bộ thay đổi của Training còn trong working tree, chưa commit.
7. **Dữ liệu DEV:** có hàng nghìn tài liệu và hoạt động test; không dùng làm bằng chứng về dữ liệu thật.

## 6. Kết luận và chữ ký của QA

☐ Chấp nhận để tiếp tục UAT    ☐ Chấp nhận có điều kiện: ____________________    ☐ Chưa chấp nhận: ____________________

| | |
|---|---|
| Họ và tên QA | |
| Chức danh | |
| Ngày | |
| Chữ ký | |

*Nhận xét của QA:*
