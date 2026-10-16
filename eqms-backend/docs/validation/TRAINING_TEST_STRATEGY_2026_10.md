# TRAINING-TEST — Chiến lược kiểm thử và ma trận truy vết

Phiên bản 0.1 (bản nháp WP-0, chờ QA xem xét và ký) · 2026-10-16
Căn cứ: `TRAINING_URS_2026_10.md`, `TRAINING_RISK_ASSESSMENT_2026_10.md`, SDS-TR-001 mục 14 và 17. Quy ước báo cáo bằng chứng: theo kỹ năng `eqms-test-evidence` và quy tắc dự án (biên dịch và triển khai không phải bằng chứng chức năng).

## 1 Nguyên tắc

1. Mỗi URS mức **M** có **ít nhất một** kiểm thử; mỗi rủi ro **Cao** có ít nhất một kiểm thử **âm tính** (thử làm điều bị cấm và thấy bị chặn).
2. Mỗi lệnh có bảy trường hợp: đúng; **không quyền**; **sai phạm vi**; **sai trạng thái**; **sai phiên bản**; **thiếu hoặc sai chữ ký** (nếu cần); **lặp lại** (idempotent).
3. Kiểm thử trên **DEV** bằng dữ liệu thử; không dùng dữ liệu thật; không ghi mật khẩu vào tệp (truyền qua biến môi trường trong lệnh).
4. Kiểm thử DB dùng Postgres DEV dùng chung (theo ghi chú dự án: test Spring migrate DB DEV; test treo cần chạy từng lớp, không chạy bộ song song nặng).
5. Mỗi gói báo **trung thực**: đã biên dịch / đã triển khai / số kiểm thử tự động đạt / đã kiểm thử bằng API trên DEV / đã xem trình duyệt / **chưa làm**.
6. Kiểm thử bảo mật và đồng thời là **kiểm thử bắt buộc**, không phải "nếu còn thời gian".

## 2 Lớp kiểm thử và công cụ

| Lớp | Công cụ | Ghi chú |
|---|---|---|
| Đơn vị (UT) | JUnit 5, Mockito, AssertJ (backend); vitest và Testing Library (frontend) | Lưu ý mẫu đã gặp: Mockito với `JdbcTemplate` (đối số biến đổi), khởi tạo người dùng trước khi dựng dịch vụ |
| Tích hợp (IT) | Spring Boot test trên DB DEV; hoặc script `psql` cho trigger và ràng buộc | Chạy từng lớp test |
| API | Script Node (`fetch`) trong thư mục tạm; đăng nhập bằng tài khoản thử, mật khẩu qua biến môi trường | Mẫu đã dùng cho Report |
| Đồng thời (CON) | Script Node song song hoặc JUnit `ExecutorService` | 200 luồng cấp mã |
| Lỗi (FAIL) | Giả lập lỗi bằng test double, ngắt cổng, ép lỗi DB | Kiểm tra lui giao dịch |
| Bảo mật (SEC) | Script API; EICAR; payload tiêm | Mục 13 của SDS |
| Giao diện (UI) | vitest; trình duyệt tự động (Chrome headless qua `puppeteer-core`) | Mẫu đã dùng cho Report |
| Hồi quy (REG) | Bộ test hiện có của Document, Revision, Controlled Copy, Publishing | Chạy **trước** và **sau** mỗi lát sửa Document Control |
| Đầu-cuối (E2E) | Script API và trình duyệt tự động | Kịch bản mục 4 |

## 3 Danh mục kiểm thử (mã dùng ở ma trận)

**NUM — cấp mã:** NUM-01 định dạng `TRN/<DC>/<YY>-<XXX>`; NUM-02 số tăng theo (bộ phận, năm) và đổi năm; NUM-03 hậu tố a…z, aa, ab, độc lập theo hoạt động gốc; NUM-04 hủy không trả số; NUM-05 mã dựng ở máy chủ (gửi mã từ máy khách bị bỏ qua); NUM-06 bộ phận ngưng: cấp theo bộ phận tài liệu được, chọn làm đơn vị tổ chức mới thì bị từ chối (D-35); NUM-07 mã bộ phận không hợp lệ bị từ chối.
**CON — đồng thời:** CON-01 200 lần cấp mã song song cùng bộ phận không trùng; CON-02 cấp song song hai bộ phận; CON-03 hai đợt bổ sung cùng lúc cho một hoạt động gốc ra hai hậu tố khác nhau; CON-04 hai lệnh duyệt đồng thời, một thành công; CON-05 hai lệnh xác nhận hoàn thành đồng thời, một thành công.
**DI — toàn vẹn:** DI-01 `UPDATE` bảng hồ sơ bị trigger chặn; DI-02 `DELETE` bị chặn; DI-03 `TRUNCATE` bị chặn; DI-04 phiên bản đã duyệt bất biến; DI-05 ngày tương lai bị từ chối; DI-06 `result` do máy chủ tính, không chấp nhận từ máy khách.
**AUD — Audit Trail:** AUD-01 mỗi lệnh ghi đúng một mục với trước và sau; AUD-02 mã tương quan nối hai module; AUD-03 chữ ký ghi vào mục; AUD-04 đối tượng id khác rỗng; AUD-05 xem và xuất hồ sơ người khác được ghi.
**AUTH — quyền và chỉ định:** AUTH-01 mọi điểm cuối không quyền ⇒ 403; AUTH-02 sai phạm vi bộ phận ⇒ 403; AUTH-03 chỉ định người không đủ điều kiện bị từ chối; AUTH-04 người không được chỉ định ký ⇒ 403 (DESIGNATED_REQUIRED); AUTH-05 người được chỉ định mất quyền giữa chừng bị chặn; AUTH-06 tự duyệt việc của mình bị chặn; AUTH-07 đổi người xử lý có lý do, Audit và thông báo; AUTH-08 tách nhiệm vụ theo từng dòng bảng SDS 8.3; AUTH-09 danh sách đủ điều kiện không lộ người ngoài phạm vi; AUTH-10 quyền cấp SQL cần khởi động lại (ghi chú thao tác).
**SIG — chữ ký:** SIG-01 thiếu chữ ký ⇒ từ chối; SIG-02 mã sai; SIG-03 mã hết hạn; SIG-04 mã dùng lại; SIG-05 mã của người khác; SIG-06 ký tay: bắt buộc bản scan và người nhận; SIG-07 báo cáo tỷ lệ ký điện tử và ký tay.
**MTX — ma trận:** MTX-01 hai phiên bản, một hiệu lực; MTX-02 người duyệt ≠ người lập; MTX-03 phiên bản hiệu lực bất biến; MTX-04 so sánh phiên bản đúng; MTX-05 người "unmapped" không tự vào đối tượng; MTX-06 xuất PDF có mã kiểm.
**REQ — yêu cầu đào tạo:** REQ-01 ba chữ ký ba người khác nhau; REQ-02 chỉ cho hằng năm và định kỳ tài liệu; REQ-03 dời sang tháng sau có lý do; REQ-04 QA ghi mã, ngày, nhận xét; REQ-05 gợi ý từ rà soát chỉ đọc.
**ACT — hoạt động:** ACT-01 chỉ chuyển trạng thái theo bảng; ACT-02 không `notify` khi chưa xác nhận danh sách và duyệt nội dung; ACT-03 giảng viên không đủ điều kiện bị chặn, ngoại lệ có người duyệt; ACT-04 danh sách gồm cả người vắng dài hạn; ACT-05 người ngoài không tài khoản; ACT-06 tài liệu không hiệu lực bị từ chối làm chủ đề; ACT-07 dời lịch giữ mã và ghi lý do; ACT-08 `held_on` tương lai bị từ chối.
**ASM — đánh giá:** ASM-01 ngưỡng 70% biên 69,9 và 70 và 100; ASM-02 checklist tính đúng; ASM-03 không đạt sinh hoạt động đào tạo lại và cờ; ASM-04 người chấm ≠ người được chấm; ASM-05 tự đọc: ký, trưởng phòng xác nhận; ASM-06 trực tuyến và vắng ghi đúng.
**REC — hồ sơ:** REC-01 hồ sơ chỉ tạo bởi máy chủ khi hoàn thành, không có API nhập tay; REC-02 vô hiệu có lý do và chữ ký, dòng gốc nguyên vẹn; REC-03 xuất PDF có mã kiểm và lưu bản bất biến; REC-04 phạm vi xem (bản thân, bộ phận, tất cả).
**INT — phối hợp Document Control:** INT-01 tick và lưu ⇒ mã, hoạt động RESERVED, dòng sổ mã; INT-02 tick rồi bỏ trước khi lưu ⇒ không tạo gì; INT-03 bỏ tick có mã, xác nhận, chưa lưu ⇒ máy chủ chưa đổi; tick lại ⇒ mã giữ; INT-04 lưu sau khi bỏ ⇒ mã hủy, lưu và tick lại ⇒ mã mới; INT-05 Upgrade ⇒ mã mới; INT-06 duyệt xong ⇒ hoạt động mở, hạn đúng, thông báo; lặp sự kiện không tạo bản hai; INT-07 hoàn thành ⇒ ba ngày vào revision, chỉ đọc, Complete Training bật; INT-08 thiếu chữ ký bị từ chối; INT-09 ngày hiệu lực theo "After Training completion"; INT-10 ngày hiệu lực theo "After Approval + 10 ngày"; INT-11 người vắng không đổi ngày; INT-12 chế độ: bật rồi tắt cờ ở mọi giai đoạn; INT-13 revision Pending Training hiện có giữ MANUAL; INT-14 nhập cũ không mã, có Legacy evidence, thiếu ngày ⇒ "not evidenced"; INT-15 revision đã qua Pending Training không bị cấp mã; INT-16 người không quyền Training thấy mã chỉ đọc; INT-17 tài liệu mẫu không có đào tạo.
**FAIL — lỗi:** FAIL-01 lỗi cổng khi lưu ⇒ tài liệu không đổi; FAIL-02 không rơi về MANUAL; FAIL-03 lỗi lưu tệp; FAIL-04 mất kết nối khi ghi ngày hoàn thành ⇒ outbox thử lại; FAIL-05 lỗi gửi thông báo không làm hỏng lệnh.
**JOB — việc nền và hạn:** JOB-01 outbox idempotent; JOB-02 thử lại có giãn cách; JOB-03 quá số lần ⇒ FAILED hiện ở màn theo dõi; JOB-04 đọc lại trạng thái trước khi tác động; JOB-05 chống thông báo trùng; JOB-06 ngày làm việc và ngày nghỉ; JOB-07 nhắc trước 31/12; JOB-08 nhắc cuối tháng rà soát; JOB-09 dời bắt buộc khi quá tháng.
**JOB-A — bản giao việc:** JOB-A-01 bị chặn khi thiếu ma trận; JOB-A-02 ngoại lệ có người duyệt; JOB-A-03 số lần ban hành; JOB-A-04 điều chuyển sinh hoạt động INITIAL sau xác nhận.
**SPC — chữ ký mẫu:** SPC-01 chỉ một bản hiệu lực; SPC-02 xem ảnh được ghi Audit.
**CMP — tuân thủ:** CMP-01 đến CMP-09 chín truy vấn của PLAN mục 9 đúng trên dữ liệu thử; CMP-10 phân trang, lọc, sắp xếp ở máy chủ; CMP-11 lỗi hiển thị lỗi (không hiện 0).
**RET — lưu giữ:** RET-01 `retain_until` tính đúng; RET-02 không có đường xóa trong hạn.
**SET — thiết lập:** SET-01 phiên bản đã đọc; SET-02 giá trị dưới mức SOP bị từ chối (lưu dưới 10 năm); SET-03 Audit ghi giá trị trước và sau; SET-04 đổi chế độ tích hợp cần lý do.
**SEC — bảo mật:** SEC-01 IDOR hồ sơ; SEC-02 IDOR hoạt động; SEC-03 mass assignment (gửi `status`, `result`, `personId`); SEC-04 phát lại chữ ký (nối SIG-04); SEC-05 tạo hồ sơ giả bằng API; SEC-06 `sortBy` lạ ⇒ 400; SEC-07 tiêm `LIKE` và `'`; SEC-08 tệp EICAR bị từ chối; SEC-09 loại và kích thước tệp; SEC-10 cột thừa trong danh sách và xuất; SEC-11 quyền đọc lại sau đổi bộ phận.
**UI — giao diện:** UI-01 mỗi màn: tải, rỗng, lỗi, xung đột phiên bản, không quyền; UI-02 responsive; UI-03 bàn phím; UI-04 hộp xác nhận khi bỏ tick; UI-05 ô Training Number chỉ đọc và trống đến khi lưu; UI-06 nút theo capabilities.
**DATA — dữ liệu nền:** DATA-01 báo cáo không khớp bộ phận, vị trí; DATA-02 người không mã nhân viên không vào danh sách.
**REG — hồi quy Document Control:** REG-01 tạo, sửa, import tài liệu không có đào tạo hành xử y như trước; REG-02 Upgrade, xuất bản, Controlled Copy, Publishing không đổi; REG-03 luồng `MANUAL` giống hệt trước; REG-04 danh sách tài liệu, lọc, sắp xếp không đổi.
**CLN — dọn mã thử:** CLN-01 không còn import tới mã cũ; `tsc` và test sạch.
**REC-BK — sao lưu:** REC-BK-01 sao lưu và khôi phục gồm `training_*` và tệp.

## 4 Kịch bản đầu-cuối (E2E)

| ID | Kịch bản | Gói |
|---|---|---|
| E2E-01 | Tạo tài liệu, tick Requires Training, lưu, thấy mã, duyệt, hoạt động mở, đào tạo, đánh giá, xác nhận, ngày vào revision, Complete Training có chữ ký, phát hành, ngày hiệu lực theo cấu hình, hồ sơ cá nhân | WP-7 |
| E2E-02 | Hoạt động hai session, ba học viên (một vắng, một không đạt rồi đạt), đợt bổ sung a và b | WP-6 |
| E2E-03 | Ma trận một bộ phận hai phiên bản, duyệt khác người lập, chỉ định và đổi người xử lý | WP-3 |
| E2E-04 | Yêu cầu đào tạo năm ba chữ ký, dời tháng | WP-4 |
| E2E-05 | Điều chuyển ⇒ đào tạo ban đầu ⇒ bản giao việc mới | WP-8 |
| E2E-06 | Tài liệu nhập cũ ⇒ Legacy evidence | WP-10 |
| E2E-07 | Tắt và bật tích hợp với revision ở mọi giai đoạn | WP-5 |

## 5 Ma trận truy vết URS ⇒ rủi ro ⇒ thiết kế ⇒ kiểm thử

| URS | Rủi ro | Thiết kế (SDS-TR-001) | Kiểm thử |
|---|---|---|---|
| URS-TR-001, 002 | R-07 | 5.1, 5.2, 4.4 | NUM-01..05, CON-01, CON-02 |
| URS-TR-003 | R-07 | 5.3 | NUM-03, CON-03 |
| URS-TR-004, 005 | — | 4.4, 5.4 | ACT-07 |
| URS-TR-006 | R-05 | 8.1 | AUTH-01, AUTH-02 |
| URS-TR-007 | — | 4.4 (view) | CMP-08 |
| URS-TR-010 .. 016 | R-01, R-16 | 3.4, 4.2, 8.5 | MTX-01..06, AUTH-03..08 |
| URS-TR-020 .. 025 | R-05 | 3.4, 4.3, 8.5 | REQ-01..05, JOB-07..09 |
| URS-TR-030 .. 039 | R-08, R-16 | 3.2, 4.4, 6 | ACT-01..08, JOB-06 |
| URS-TR-040 .. 043 | R-05 | 8.3, 8.5 | ACT-03, AUTH-03..08 |
| URS-TR-050 .. 058 | R-02, R-04, R-24 | 3.3, 4.4, 4.5, 8.4, 9.3 | ASM-01..06, REC-01..04, SIG-01..07, DI-06 |
| URS-TR-057 | R-25 | 4.5, 9.5 | RET-01, RET-02, REC-BK-01 |
| URS-TR-060 .. 064 | R-05 | 3.4, 4.5, 7.1 | JOB-A-01..04, SPC-01, SPC-02 |
| URS-INT-001 .. 011 | R-08, R-09, R-10, R-11 | 6 | INT-01..17, FAIL-01..04, REG-01..04, E2E-01, E2E-07 |
| URS-AUT-001 .. 005 | R-05, R-06 | 8 | AUTH-01..10, UI-06 |
| URS-DI-001 .. 005 | R-01, R-02, R-28 | 4.9, 9 | DI-01..06, AUD-01..05 |
| URS-SEC-001 .. 003 | R-06, R-12, R-13, R-14, R-15 | 13 | SEC-01..11, FAIL-02 |
| URS-RPT-001 | R-16 | 12 | CMP-01..11 |
| URS-UI-001, 002 | R-26 | 10 | UI-01..06, CLN-01 |
| URS-OPS-001 .. 003 | R-21, R-25 | 4.6, 11 | JOB-01..05, SET-01..04, REC-BK-01 |

**Không có URS mồ côi:** mọi URS mức M có ít nhất một nhóm kiểm thử. Rủi ro Cao R-01..R-08, R-10, R-15, R-16, R-20 đều có kiểm thử âm tính trong bảng trên.

## 6 Tiêu chí chấp nhận của một gói

Tất cả kiểm thử gắn với gói đạt; hồi quy REG đạt; kiểm thử âm tính của rủi ro Cao liên quan đạt; không có kiểm thử bị bỏ qua mà không ghi lý do; QA nhận hồ sơ; **ghi rõ phần chưa làm**.

## 7 Phê duyệt

| Vai trò | Họ tên | Ngày | Chữ ký |
|---|---|---|---|
| Người soạn (trợ lý) | — | 2026-10-16 | — |
| QA xác nhận | | | |
