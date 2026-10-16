# TRAINING-URS — Yêu cầu người dùng của module Training Management

Phiên bản: 0.1 (bản nháp WP-0, chờ QA xem xét và ký) · Ngày: 2026-10-16
Nguồn: SOP.0003.02 và 9 biểu mẫu (`docs/training_docs/`), lưu đồ mục 5.2, `PLAN-TR-001` (quy tắc TR-01 đến TR-31, quyết định D-01 đến D-37), `SDS-TR-001`.
Đây là **URS**; không phải phê duyệt GMP. Mức: **M** (bắt buộc), **S** (nên có), **C** (có thể làm sau).

## 1 Mục đích sử dụng và ranh giới hệ thống

**Mục đích:** hệ thống ghi lại, kiểm soát và truy xuất việc đào tạo nhân sự của nhà máy theo SOP.0003: lập ma trận đào tạo theo vị trí, yêu cầu đào tạo, cấp mã đào tạo, tổ chức đào tạo, ghi tham dự và đánh giá, lập hồ sơ đào tạo cá nhân và bản giao việc, và phối hợp với Document Control để đào tạo tài liệu mới hoặc nâng phiên bản.
**Người dùng:** nhân viên (học viên), giảng viên, trưởng đơn vị, nhân viên QA, DCO, người duyệt, quản trị (không gắn tên vai trò: mọi vai trò theo phân quyền).
**Trong phạm vi:** các hoạt động ở SOP.0003 mục 5 và lưu đồ; phối hợp với Document Control (tick Requires Training, cấp mã cho revision, hoàn thành đào tạo).
**Ngoài phạm vi:** học trực tuyến có video, bài kiểm tra làm trên máy, chứng chỉ, chặn công việc ở module khác, hủy hồ sơ sau thời hạn lưu, nhiều cơ sở.
**Hệ thống ngoài tương tác:** Document Control, Calendar (chưa dùng), thông báo và email, kho tệp, quét virus, chữ ký điện tử, Audit Trail, Access Profile.

## 2 Yêu cầu

Cột "Nguồn": SOP/mục, quy tắc TR, hoặc quyết định D. Cột "Kiểm" là nhóm kiểm thử trong `TRAINING_TEST_STRATEGY_2026_10.md`.

### 2.1 Mã đào tạo (TR-01 đến TR-05)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-TR-001 | Mỗi hoạt động đào tạo có **mã duy nhất** `TRN/<mã bộ phận>/<YY>-<XXX>`, do hệ thống cấp; người dùng không nhập mã | TR-01, 5.1.4 | M | NUM |
| URS-TR-002 | Số thứ tự tăng theo (bộ phận, năm), không dùng lại, kể cả khi hoạt động bị hủy | TR-01 | M | NUM, CON |
| URS-TR-003 | Đào tạo bổ sung hoặc đào tạo lại dùng **mã gốc + hậu tố** (a, b, c…, sau z là aa, ab); mỗi đợt một dòng trong sổ mã | TR-02, D-07 | M | NUM |
| URS-TR-004 | Một mã có thể có nhiều session và nhiều chủ đề của cùng đơn vị tổ chức | TR-03 | M | ACT |
| URS-TR-005 | Dời lịch giữ nguyên mã; lý do ghi ở ghi chú của sổ mã | TR-04, 5.3.3 | M | ACT |
| URS-TR-006 | Ai được cấp mã theo quyền: QA cho đào tạo ban đầu và định kỳ; bộ phận phát sinh nhu cầu cho đột xuất và bên ngoài | TR-05, D-08 | M | AUTH |
| URS-TR-007 | **Sổ cấp mã** theo bộ phận và năm (ngày, mã, mã SOP, chủ đề, số buổi, ghi chú), là báo cáo trên dữ liệu thật; mã hủy hiện trạng thái | FRM.0044 | M | RPT |

### 2.2 Ma trận đào tạo (TR-28, TR-29, TR-31)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-TR-010 | Lập ma trận **theo bộ phận**: dòng (chủ đề chung toàn nhà máy, chung bộ phận, hoặc SOP) × cột vị trí; cờ "Annual training required" | APD.0011, 5.3.1 | M | MTX |
| URS-TR-011 | Ma trận có **phiên bản**; một phiên bản hiệu lực; bản cũ giữ và xem được; phiên bản đã duyệt bất biến | 5.3.1, D-02 | M | MTX, DI |
| URS-TR-012 | Gửi duyệt và duyệt có chữ ký điện tử; **người duyệt do người được phân quyền, được chỉ định, khác người lập** | D-05, D-34 | M | MTX, AUTH |
| URS-TR-013 | Cập nhật ma trận khi đổi mô tả công việc, sau rà soát hằng năm, và khi ban hành mới tài liệu cấp 1 đến 3 | TR-28 | M | MTX, INT |
| URS-TR-014 | Cho phép không đào tạo với tài liệu cấp 4 hoặc thay đổi biên tập; **người dùng tự quyết bằng việc không tick** | TR-29, D-26 | M | INT |
| URS-TR-015 | So sánh hai phiên bản; xuất PDF theo mẫu APD.0011 có mã kiểm | 5.3.1 | S | MTX |
| URS-TR-016 | Mọi nhân viên phải có đào tạo cho vị trí trước khi làm việc độc lập; hệ thống chỉ ra mục còn thiếu | TR-31 | M | CMP |

### 2.3 Yêu cầu đào tạo (TR-06 đến TR-09)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-TR-020 | Phiếu yêu cầu đào tạo **chỉ** cho đào tạo định kỳ hằng năm và định kỳ tài liệu | TR-06 | M | REQ |
| URS-TR-021 | Ba chữ ký: lập, xem xét, duyệt; ba người khác nhau; theo phân quyền và chỉ định | APD.0118, D-34 | M | REQ, AUTH |
| URS-TR-022 | Yêu cầu năm sau phải được duyệt **trước 31/12**; nhắc việc | TR-07 | M | JOB |
| URS-TR-023 | Yêu cầu định kỳ tài liệu lập và duyệt chậm nhất ngày cuối tháng hoàn thành rà soát; gợi ý từ tài liệu vừa rà soát | TR-08 | M | REQ, JOB |
| URS-TR-024 | Chủ đề không xong trong tháng đăng ký phải **dời sang tháng ngay sau** với lý do | TR-09 | M | REQ, JOB |
| URS-TR-025 | QA ghi mã, ngày, chữ ký và nhận xét vào dòng sau khi đào tạo xong | APD.0118 | M | REQ |

### 2.4 Hoạt động, buổi đào tạo, danh sách (TR-10 đến TR-13, TR-27)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-TR-030 | Loại hoạt động: ban đầu, định kỳ, đột xuất, đào tạo lại, bên ngoài (chủ động, bị động) | SOP mục 4, 5.1 | M | ACT |
| URS-TR-031 | Vòng đời hoạt động có kiểm soát: Reserved, Planned, Notified, In Progress, Pending QA Confirmation, Completed, Cancelled; chuyển trạng thái ngoài bảng bị từ chối | SDS 3.2 | M | ACT |
| URS-TR-032 | Hình thức đào tạo: tự đọc, tập trung, kết hợp trực tuyến, thực hành; mỗi hình thức gắn cách đánh giá | bảng 5.1.2, D-06 | M | ACT |
| URS-TR-033 | **Danh sách tham gia** gồm mọi người trong phạm vi kể cả người vắng dài hạn; thông báo trước buổi | TR-11 | M | ACT, JOB |
| URS-TR-034 | Người chuẩn bị danh sách xác nhận trước đào tạo; giảng viên xác nhận tham dự đủ; QA xác nhận hoàn thành | APD.0117 mục 4 đến 6 | M | ACT, AUTH |
| URS-TR-035 | Đào tạo tài liệu mới hoặc nâng phiên bản: hạn **10 ngày** từ ngày duyệt (cảnh báo, không chặn); danh sách gửi QA **trong ngày** đào tạo | TR-10, TR-12, D-11 | M | JOB, INT |
| URS-TR-036 | Kết quả đánh giá gửi QA trong **7 ngày làm việc**; ngày làm việc theo bảng ngày nghỉ | TR-13, D-14 | M | JOB |
| URS-TR-037 | Đơn vị soạn tài liệu đào tạo ở lần ban hành đầu (v01); sau đó trưởng đơn vị liên quan | TR-27 | S | ACT |
| URS-TR-038 | Đào tạo người ngoài (khách, nhà thầu) không cần tài khoản, vẫn có mã đào tạo, ký tay có scan | D-21 | M | ACT |
| URS-TR-039 | Chủ đề đào tạo SOP chỉ chọn được tài liệu **đang hiệu lực** | TR-21 | M | ACT, INT |

### 2.5 Nội dung và giảng viên (TR-19 đến TR-22)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-TR-040 | Giảng viên phải đủ điều kiện (đào tạo GMP, đào tạo chuyên môn, hoặc là người soạn, kiểm tra, duyệt, trưởng bộ phận, giám sát đã được đào tạo); chặn khi thiếu, ngoại lệ có lý do và người duyệt được chỉ định | TR-19, D-10 | M | ACT, AUTH |
| URS-TR-041 | Người ký tài liệu được coi là đã đào tạo ban đầu về tài liệu đó | TR-20 | M | INT |
| URS-TR-042 | Nội dung đào tạo và bài kiểm tra có **xem xét và duyệt** (hai bước, người được chỉ định); bản đã duyệt bất biến | TR-22, D-32 | M | ACT, AUTH |
| URS-TR-043 | Nội dung từ kiểm soát thay đổi hoặc CAPA dùng bản đã phê duyệt; nội dung trích dẫn lưu cùng tài liệu đào tạo | TR-21, 5.3.5 | S | ACT |

### 2.6 Đánh giá và hồ sơ (TR-14 đến TR-18, TR-26)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-TR-050 | Đánh giá bằng câu hỏi hoặc checklist; **đạt khi ≥ 70%** (thiết lập có kiểm soát); kết quả do **máy chủ tính** | TR-14, APD.0009 | M | ASM |
| URS-TR-051 | Không đạt: tạm ngừng việc liên quan (cờ) và **đào tạo lại**, ghi nhận trên bài; lần đạt sau được ghi | TR-15, D-12 | M | ASM |
| URS-TR-052 | Tự đọc: nhân viên ký xác nhận, trưởng phòng xác nhận, QA ghi vào hồ sơ | TR-16 | M | ASM |
| URS-TR-053 | Học viên trực tuyến được ghi "trực tuyến"; người vắng ghi "vắng mặt" kèm lý do và được bố trí đào tạo lại (danh sách riêng, mã a, b, c) | TR-17, TR-18, D-09 | M | ASM, NUM |
| URS-TR-054 | Hồ sơ đào tạo cá nhân **tự sinh** từ hoạt động hoàn thành, **bất biến**, giữ bản cũ cùng bản mới; không có nhập tay | TR-26 | M | REC, DI |
| URS-TR-055 | Sửa sai bằng **vô hiệu có lý do và chữ ký**; không sửa dòng gốc | SDS 9.3 | M | REC, DI |
| URS-TR-056 | Xuất hồ sơ cá nhân (APD.0014) PDF có mã kiểm; xem và xuất hồ sơ người khác vào Audit Trail | 5.3.10 | M | REC, AUD |
| URS-TR-057 | Lưu hồ sơ ít nhất **10 năm sau khi nhân viên nghỉ**; không xóa tự động | TR-26, D-17 | M | RET |
| URS-TR-058 | Chữ ký học viên bằng điện tử **hoặc** ký tay có bản scan gốc và người nhận xác nhận | D-20 | M | SIG |

### 2.6b Bản giao việc, chữ ký mẫu, điều chuyển (TR-23 đến TR-25)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-TR-060 | Bản giao việc (bổ nhiệm lần đầu, thay đổi vị trí) chỉ lập khi đã hoàn thành ma trận vị trí; ngoại lệ có lý do và người duyệt được chỉ định | TR-23, D-15 | M | JOB-A |
| URS-TR-061 | Bản giao việc có chữ ký người giao và người nhận; số lần ban hành tăng; bản cũ giữ | TR-24 | M | JOB-A, AUTH |
| URS-TR-062 | Chữ ký mẫu theo nhân viên, nhiều phiên bản, **một bản hiệu lực**, trưởng đơn vị xác nhận | TR-25, D-16 | S | SPC |
| URS-TR-063 | Điều chuyển nội bộ: rà soát khoảng trống và sinh đào tạo ban đầu sau xác nhận; điều chuyển cơ sở: xuất bản sao hồ sơ có chữ ký | 5.3.11, lưu đồ, D-18, D-33 | M | JOB-A |
| URS-TR-064 | Đào tạo lại khi vắng trên 6 tháng hoặc khi cần | TR-30 | S | JOB |

### 2.7 Phối hợp Document Control (quyết định D-23 đến D-31)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-INT-001 | Tick **Requires Training?** khi lưu tài liệu cấp **Training Number cho revision**, chỉ đọc, hiện sau lần lưu thành công | D-23 | M | INT |
| URS-INT-002 | Bỏ tick khi revision đã có mã: hộp xác nhận, mã hủy khi lưu, mã không dùng lại; tick lại cấp mã mới | D-24 | M | INT |
| URS-INT-003 | Upgrade revision mang Requires Training và cấp mã mới ở lần lưu đầu | D-25 | M | INT |
| URS-INT-004 | Cấp mã tạo hoạt động đào tạo bên Training, trong **cùng giao dịch** với việc lưu tài liệu; lỗi thì lui cả hai | D-28 | M | INT, FAIL |
| URS-INT-005 | Khi revision được duyệt, hoạt động mở, hạn = ngày duyệt + số ngày đào tạo | TR-10 | M | INT |
| URS-INT-006 | Hoạt động hoàn thành ghi ba ngày vào revision (chỉ đọc ở Document Control); **Complete Training vẫn cần chữ ký điện tử** và chỉ bật khi hoạt động đã hoàn thành | D-29, D-31 | M | INT, SIG |
| URS-INT-007 | Ngày hiệu lực theo cấu hình Document Properties; Training chỉ cung cấp ngày hoàn thành (ngày xác nhận hoạt động gốc) | D-30, D-31 | M | INT |
| URS-INT-008 | Hai chế độ `INTEGRATED` và `MANUAL` ghi vào revision ở lần lưu đầu; đổi cờ không đổi revision đang mở; không có cả mã lẫn ngày nhập tay | D-28 | M | INT, FAIL |
| URS-INT-009 | Tài liệu nhập cũ: không cấp mã, `LEGACY_IMPORT`, danh sách Legacy evidence, "Training not evidenced" khi thiếu ngày | D-27 | M | INT |
| URS-INT-010 | Revision đã qua giai đoạn Pending Training khi bật tích hợp **không** bị cấp mã hồi tố | D-37 | M | INT |
| URS-INT-011 | Người không có quyền Training vẫn thấy mã chỉ đọc ở Document Control, không mở được màn Training | SDS 6 | M | AUTH, INT |

### 2.8 Phân quyền và phê duyệt (D-34)

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-AUT-001 | Mọi quyền gán qua Access Profile; **không** có tên vai trò hay tài khoản trong mã | quy tắc dự án | M | AUTH |
| URS-AUT-002 | Mọi bước xem xét, duyệt, xác nhận: người gửi **chỉ định** bất kỳ user đủ điều kiện; kiểm lại khi ký; đổi người xử lý có lý do | D-34 | M | AUTH |
| URS-AUT-003 | Phạm vi đối tượng: bản thân, bộ phận, tất cả; người học chỉ thấy phần của mình; mã người học không nhận từ máy khách | SDS 1.3 | M | AUTH, SEC |
| URS-AUT-004 | Tách nhiệm vụ theo bảng SDS 8.3 | SDS 8.3 | M | AUTH |
| URS-AUT-005 | Mọi lệnh kiểm tra lại quyền ở máy chủ; giao diện chỉ hiện nút theo khả năng (capabilities) | SDS 8.2 | M | AUTH, UI |

### 2.9 Toàn vẹn dữ liệu, Audit Trail, bảo mật

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-DI-001 | Mọi thay đổi ghi vào Audit Trail: người, thời điểm máy chủ, trước và sau, lý do, mã chữ ký, mã tương quan hai module | Annex 11 §9 | M | AUD |
| URS-DI-002 | Bảng bằng chứng **bất biến** (trigger chặn sửa, xóa, cắt bảng) | ALCOA+ | M | DI |
| URS-DI-003 | Ngày đào tạo không ở tương lai; nhập muộn lưu cả ngày thực tế và ngày ghi | ALCOA+ | M | DI |
| URS-DI-004 | Tệp tải lên và xuất có SHA-256; kiểm khi tải; quét virus; giới hạn loại và kích thước | ALCOA+, Annex 11 | M | SEC, DI |
| URS-DI-005 | Không có xóa vật lý bản ghi GMP; hủy hoặc thay thế kèm lý do | quy tắc dự án | M | DI |
| URS-SEC-001 | Chống IDOR, mass assignment, tiêm SQL, phát lại chữ ký, đua dữ liệu (SDS mục 13) | OWASP | M | SEC |
| URS-SEC-002 | Dữ liệu cá nhân tối thiểu; xem và xuất có ghi; không dữ liệu cá nhân trong nhật ký ứng dụng | bảo vệ dữ liệu | M | SEC |
| URS-SEC-003 | Không có đường "rơi về" thầm lặng khi lỗi (đóng khi lỗi) | SDS 1.3 | M | FAIL |

### 2.10 Báo cáo, giao diện, vận hành

| ID | Yêu cầu | Nguồn | Mức | Kiểm |
|---|---|---|---|---|
| URS-RPT-001 | Chín truy vấn tuân thủ ở PLAN-TR-001 mục 9, tính ở máy chủ, lọc, sắp xếp, phân trang phía máy chủ | PLAN 9 | M | CMP |
| URS-UI-001 | Giao diện giống màn tương đương đã có; đáp ứng màn nhỏ; trạng thái có chữ và biểu tượng; lỗi hiển thị lỗi | quy tắc dự án | M | UI |
| URS-UI-002 | Thay hết giao diện thử; xóa hẳn mã cũ | quy tắc dự án | M | CLN |
| URS-OPS-001 | Việc nền (outbox, nhắc việc, quá hạn) an toàn khi lặp, đọc lại trạng thái trước khi tác động, có màn theo dõi việc lỗi | SDS 11 | M | JOB, FAIL |
| URS-OPS-002 | Thiết lập có kiểm soát (ngưỡng đạt, hạn, thời gian lưu, chế độ tích hợp) có phiên bản, lý do, Audit Trail; không cho giá trị thấp hơn mức SOP | SDS 4.1 | M | SET |
| URS-OPS-003 | Sao lưu và khôi phục gồm bảng `training_*` và tệp | Annex 11 §7 | M | REC-BK |

## 3 Phụ thuộc và giả định

1. Dữ liệu nền theo `TRAINING_BASELINE_DATA_REPORT_2026_10.md` (bộ phận, vị trí, người dùng); việc sửa dữ liệu "Quality" và vị trí `HRMGR` do người quản trị dữ liệu làm.
2. Quyết định D-35 (bộ phận ngưng), D-36 (cần mã nhân viên), D-37 (revision lịch sử) là **đề xuất** từ báo cáo dữ liệu nền, chờ QA.
3. Lưu đồ SOP và SOP chưa thống nhất ở bước duyệt nội dung (D-32); hệ thống không phụ thuộc cách gọi tên.
4. Điều khoản EU-GMP và Annex 11 trong tài liệu là theo hiểu biết của người soạn; QA đối chiếu bản chính thức.

## 4 Phê duyệt

| Vai trò (theo phân quyền) | Họ tên | Ngày | Chữ ký |
|---|---|---|---|
| Người soạn (trợ lý) | — | 2026-10-16 | — |
| Chủ dự án | | | |
| QA xác nhận | | | |
