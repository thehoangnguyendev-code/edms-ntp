# Chạy kiểm thử vòng đời Training Activity, 2026-11-24 (chỉ DEV)

Phạm vi: (1) Training Activity với một và nhiều buổi, người vắng, người trượt, đào tạo lại; (2) Training Activity xuất phát từ tài liệu mới có nhiều Related Document, và khi nâng revision một số tài liệu.
Hai hình thức được thử ở mọi trường hợp: **Tự đọc** (APD.0108, trưởng bộ phận xác nhận) và **Tập trung có Bài kiểm tra** (APD.0009, giảng viên chấm điểm).
Cách đọc: "Tự đọc có làm bài kiểm tra" được hiểu là hai hình thức riêng, vì SOP.0003 5.1.2 gắn Tự đọc với APD.0108 và chỉ Tập trung/Thực hành với APD.0009. Tổ hợp "Tự đọc + Bài kiểm tra" bị server từ chối từ nay (lỗi 1 bên dưới).

Mật khẩu lấy từ biến môi trường DEVPW, không ghi vào tệp. Dữ liệu tạo ra có tiêu đề "RUN24 ...", không xóa. Ảnh: `shots/`, các bảng ảnh: `sheets/`, kịch bản: `*.py`, kết quả: `results.json` và `*.log`.

| Kịch bản | Nội dung | Kết quả |
|---|---|---|
| T1-A (`t1a_single_self_reading.py`) | 1 buổi Tự đọc: 2 người đọc ký, 1 người không đọc được (vắng), trưởng bộ phận xác nhận, QA hoàn tất, bổ sung hậu tố a | 34/34 |
| T1-B (`t1b_single_classroom_test.py`) | 1 buổi Tập trung + Kiểm tra: 2 đạt, 1 trượt (đình chỉ làm việc), 1 vắng; bổ sung a, đào tạo lại b, gỡ đình chỉ | 44/44 |
| T1-C (`t1c_multi_session.py`, `t1c2_multi_session_makeup.py`) | 3 buổi một mã (Tập trung giấy + Kiểm tra, Tự đọc, Tập trung + Kiểm tra), cùng 3 người; bổ sung theo đúng buổi | 33/33 và 16/17 (mục còn lại là lỗi của kịch bản: so sánh chuỗi bị cắt; SQL xác nhận C có hai hồ sơ S1 và S2, B có hồ sơ S1) |
| T2-A (`t2a_new_sop_with_related.py`, `t2a_resume.py`) | SOP mới + 2 form cùng mã + 1 tài liệu không cần đào tạo + 1 tài liệu đang hiệu lực; Reserved → Planned → Tự đọc → Completed → Complete Training → Effective | 26/33 rồi 9/9 sau khi sửa lỗi 4 (7 mục lỗi lần đầu là lỗi 4 và ảnh) |
| T2-B (`t2b_upgrade_some_documents.py`, `t2b_resume*.py`) | Nâng revision SOP + FRM1 (không nâng FRM2); Tập trung + Kiểm tra; bổ sung/đào tạo lại; rồi chỉ nâng FRM2: activity riêng, Tự đọc | 14 + 21 + 12 mục đạt trong ba lần chạy nối tiếp (backend bị khởi động lại giữa chừng do dựng frontend; lần chạy bị cắt được chạy tiếp từ trạng thái đã lưu) |
| T2-C (`t2c_defaults_screens.py`) | Form tài liệu mới tick sẵn Required Training; hộp thoại Thêm buổi điền sẵn | 4/4 |
| T4 (`t4_open_items.py`, `t4_vi_dialog.py`, `t4_sr.py`) | Các điểm còn mở của ngày: huỷ buổi thừa (lý do + chữ ký), từ chối rõ sau Notified, dời lịch một trong nhiều buổi, người trượt hai buổi, người nghỉ việc giữa hai buổi, màn tiếng Việt, Tự đọc không còn bảng điểm | 34/34 và 3/3 (một ảnh tiếng Việt chụp lại do tên nút) |
| T4-D (`t4d_audit_and_notice.py`) | Audit Trail (thành phần, tên trường theo buổi, chữ ký) và thông báo của huỷ buổi / dời / đổi buổi; người nhận | 17/17 |
| T5 (`t5_postpone_and_trainer_notices.py`) | Thông báo qua e-mail (in-app chỉ là kết quả ngắn cho người điều phối): dời buổi chỉ báo người đã được thông báo; giảng viên được báo khi Notified; thay giảng viên báo người cũ và người mới, hai nội dung khác nhau | 30/30 |
| T6 (`t6_tables.py`) | Bảng kết quả bỏ dòng tiêu đề, tách cột Employee Code / Department; danh sách có cột Sessions | 5/5 |
| T7 (`t7_due_date_once.py`) | Due Date chỉ một lần ở trạng thái Reserved; lưới thông tin tự cân bằng hàng | 2/2 |
| T8 (`t8_materials_table.py`) | Tab Training Materials: tài liệu từ Document Control dạng bảng (No., Document, Revision, Role, Status, Action), nút Open mặc định | 2/2 |
| T9 (`t9_related_documents_not_grouped.py`) | Tài liệu liên quan chỉ là tham khảo, không gộp mã; một nút Complete Training; SOP publish cùng các form; form hiện "Covered by the training of SOP…" và TRAINING_COVERED; tài liệu liên quan tự tick có activity riêng | 40/40 |
| T10 (`t10_submit_conditions.py`) | Nút Submit for Approval chỉ hiện khi đủ điều kiện; danh sách điều kiện còn thiếu; server từ chối cùng danh sách; quyền organize; chữ ký | 17/17 |
| T11, T12 (`t11_materials_upload.py`, `t12_submit_department.py`) | Training from a document still accepts the trainer's own material (FormSection); Select Approver and Submit only for the people of the department | 6/6 và 3/3 |
| T13 (`t13_cancel_activity.py`) | Cancel Training Activity: quyền riêng, chỉ người của bộ phận, lý do + chữ ký, không cho đào tạo của revision tài liệu | 12/12 |
| T14-T17 (`t14_covered_note.py`, `t15_related_snapshot.py`, `t16_cancelled_stepper.py`, `t17_related_latest_revision.py`) | Giải thích gạch xám Pending Training; chốt danh sách tài liệu liên quan lúc Start, hồ sơ cá nhân từng form, bằng chứng sớm; thanh trạng thái khi huỷ; revision mới nhất của tài liệu liên quan | 1/1, 27/27, ảnh, 6/6 |
| T3 (`t3_action_screens.py`) | Các màn thao tác: Edit, Approve thứ nhất/thứ hai, Prepare, Conduct, Workspace, Confirm | 4/4 |

> Ghi chú: T2-A và T2-B mô tả luật gộp mã cũ (tài liệu liên quan cùng Training Number). Luật đó đã được thay bằng DEC-TRAINING-2026-11-24-8; T9 thay thế hai kịch bản này và hai kịch bản cũ không được chạy lại.

## Lỗi tìm thấy và đã sửa

1. **Server nhận tổ hợp hình thức và cách đánh giá vô lý** (Tự đọc + Bài kiểm tra; Tập trung + xác nhận tự đọc): buổi không thể tiến hành (điểm danh và chấm điểm bị từ chối), hoặc người đọc được "đạt" mà không có bài kiểm tra. Nay server trả `TRAINING_METHOD_ASSESSMENT_MISMATCH` (màn hình đã chỉ cho chọn đúng cặp theo SOP 5.1.2).
2. **Buổi Tự đọc hoàn tất mà không ghi hồ sơ đào tạo**: buổi không có ngày thực hiện nên hồ sơ không được ghi (lỗi phát sinh từ Start Training, vì buổi không còn được "hold" lúc bắt đầu). Nay ngày thực hiện được ghi khi trưởng bộ phận xác nhận.
3. **Trưởng bộ phận bị chặn xác nhận tự đọc bởi người còn "Invited" ở buổi khác** của cùng activity. Nay chỉ tính các buổi Tự đọc.
4. **Complete Training của revision trả 500**: thông báo e-mail dựng mẫu với một biến có giá trị null (`NotificationDispatcher.render` ném NullPointerException), làm hỏng cả thao tác nghiệp vụ. Nay biến null được thay bằng chuỗi rỗng.
5. **Buổi trên giấy bắt scan bài kiểm tra của cả người ở buổi điện tử/tự đọc** trong cùng activity. Nay chỉ tính người ở buổi trên giấy.
6. **Bổ sung/đào tạo lại chỉ chép buổi cuối** của activity nhiều buổi (người trượt buổi 1 bị đào tạo lại bằng chủ đề buổi 3, hồ sơ ghi sai chủ đề). Nay tạo một buổi cho mỗi buổi người đó bỏ lỡ hoặc trượt và đưa từng người vào đúng các buổi của họ.
7. **Due Date hiện hai lần** ở trạng thái Reserved (màn chi tiết). Nay chỉ một lần.

## Đã xử lý sau đó (cùng ngày, DEC-TRAINING-2026-11-24-4)

- **Huỷ buổi thừa** (`POST /training/sessions/{id}/cancel`, V848): lý do + chữ ký, chỉ khi activity còn Planned và buổi chưa có gì được làm; không huỷ buổi cuối (huỷ cả activity); buổi giữ lại ở trạng thái CANCELLED, người trong buổi được gỡ và nêu tên trong Audit Trail; danh sách đã xác nhận của các buổi còn lại không đổi. Quyết định của chủ hệ thống: "Huỷ buổi có lý do + chữ ký". Là quyết định hệ thống, SOP không nêu.
- **Khóa sau Notified** nay trả lý do `TRAINING_ACTIVITY_INVALID_STATE` (vẫn HTTP 403, chỉ đổi mã lý do và câu chữ trên màn hình).
- **Danh sách bổ sung**: mỗi dòng ghi buổi (Session 1/Session 2) khi activity có nhiều buổi. Mỗi dòng là một buổi người đó bỏ lỡ nên được giữ, không gộp.
- **Màn Participants của Tự đọc**: bảng "Results and scanned tests" không hiện khi mọi buổi là Tự đọc.
- **Đã thử thêm**: dời lịch một trong hai buổi (và đưa về), buổi đã bắt đầu không dời được, người nghỉ việc giữa hai buổi (Absent buổi 2, chặn bù tới khi tài khoản Active, bù đúng buổi bỏ lỡ), các màn thao tác tiếng Việt.

## Audit Trail và thông báo (DEC-TRAINING-2026-11-24-5)

- Mục Audit của các bước về buổi có dòng **Component** = `Training Session (Session N)`, mọi trường mang số buổi (`Session N Status`, `Session N Date`, `Session N Trainer`...), có lý do và chữ ký. Module = Training Management, Object Type = Training Activity, Object Code = Training Number.
- Thông báo huỷ buổi (`training.session_cancelled`): gửi giảng viên của buổi (nếu có tài khoản) và người mở activity; không gửi người thao tác, không gửi người trong buổi (danh sách chưa được thông báo). Đã kiểm tra thông báo trong app; e-mail chưa kiểm tra vì kênh e-mail đang tắt trên DEV.
- Thông báo dời buổi và đổi giảng viên: xem DEC-TRAINING-2026-11-24-7 (T5). Còn chưa có thông báo cho đổi ngày/nơi mà không đổi giảng viên.
- Sửa trong lúc làm: sự kiện `training.session_cancelled` ban đầu chỉ gửi trong app vì chưa nằm trong danh sách gửi e-mail mặc định; đã thêm, và hàng cấu hình trên DEV được tạo lại.

## Còn mở

- Không có tính năng đảo ngược chữ ký/kết quả đã ghi: chủ hệ thống chọn chỉ dùng các thao tác hiện có (chấm lại có lý do, đào tạo lại), theo ALCOA+ không sửa hay xoá chữ ký.
- Khóa Notified vẫn là HTTP 403 (mã lý do mới rõ hơn); đổi sang 409 cần sửa chung bộ xử lý lỗi của engine, chưa làm.
- Quyền hủy buổi dùng chính quyền của "đổi buổi" (UPDATE_SESSION); chưa có dòng chính sách riêng trong Workflow Authorization.
- Chưa có test đơn vị tự động cho huỷ buổi; bằng chứng là T4 (chạy trên DEV). Chưa chạy toàn bộ bộ test backend, bộ parity chính sách, và `detect_changes`.
- Người có quyền phê duyệt nội dung chỉ có 2 tài khoản test (trưởng bộ phận uat31.* không có quyền), nên hai người phê duyệt dùng approver.test1 và user.a.test.
