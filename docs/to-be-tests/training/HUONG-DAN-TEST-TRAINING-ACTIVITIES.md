# Hướng dẫn test thủ công Training Activities (DEV)

Dành cho người test. Mô tả đúng hành vi hệ thống ngày 24/10/2026. Nhãn nút giữ nguyên tiếng Anh như trên màn hình. Đây là hướng dẫn test, không phải phê duyệt GMP.

## 0. Chuẩn bị

- Giao diện: http://localhost:3000. Email chặn lại ở MailHog: http://localhost:8025 (không gửi ra ngoài).
- Mật khẩu: mật khẩu dùng chung của các tài khoản test (đã cung cấp trong chat; không ghi vào tài liệu).
- Mỗi lần ký điện tử, hệ thống mở cửa sổ ký: nhập **Reason**, **Username** (chính tài khoản đang dùng) và **Password**, bấm **Sign & Confirm**.
- Mở sẵn 3 trình duyệt hoặc cửa sổ ẩn danh để đăng nhập song song các tài khoản khác nhau (A, B, C bên dưới).

| Ký hiệu | Tài khoản | Vai trò trong bài test |
|---|---|---|
| ORG | `admin` | Người tổ chức: tạo activity, lập kế hoạch, xác nhận danh sách, thông báo, bắt đầu buổi, gửi danh sách và kết quả |
| REV | `approver.test1` | Duyệt nội dung (Review); QA xác nhận hoàn thành |
| APP | `user.a.test` | Phê duyệt nội dung (Approve) |
| TRN | `trainer.test1` | Trainer: điểm danh, chấm điểm |
| ST1, ST2 | `trainee.test1`, `trainee.test2` | Học viên, tự check-in |
| NOP | `dco.test1` | Người không có quyền (kiểm tra bị từ chối) |

Quy tắc phân tách nhiệm vụ cần giữ: người xác nhận hoàn thành (REV) không được là người lập danh sách (ORG); REV và APP phải là hai người khác nhau; học viên không tự điểm danh cho mình.

Vai trò DCO (nhận danh sách điểm danh, Complete Training ở Document Control): chưa có tài khoản nào giữ quyền `training.attendance.receive`. Nhờ quản trị Security gán quyền này, và quyền hoàn thành đào tạo của Document Control, cho tài khoản DCO muốn dùng (tên chức danh DCO không dùng để phân quyền).

Bật mẫu danh sách APD.0117: Training Properties, tab form templates, phải có mẫu **APD.0117** ở trạng thái Enabled (DEV đã bật phiên bản 1.0.0).

---

## A. Đào tạo từ Training Activities thông thường (không gắn tài liệu)

### A1. Tạo activity (ORG)
1. Menu **Training Management > Training Programme > Training Activities**, bấm nút tạo mới.
2. Chọn **Type** (Initial, Periodic, Unplanned, External), **Reason** (với Unplanned), nhập **Training Title**, **Due date**. Với External nhập thêm đơn vị hoặc cá nhân đào tạo.
3. Lưu. **Kỳ vọng:** có Training Number dạng `TRN/QA/26-xxx`, trạng thái **Planned**. Initial và Periodic cần quyền cấp mã (ORG có).

### A2. Lập kế hoạch (ORG, màn Edit Training Activity)
1. Tab **Sessions**: thêm session. Chọn **Mode** (Classroom, Self-reading, Hybrid, Practical), **Assessment** (Test, Checklist, Observation, Self-reading confirmation), người đào tạo (Internal expert hoặc External expert: nhập đúng tên), ngày, địa điểm (tại chỗ hoặc online + link), chủ đề.
2. Tab **Participants**: thêm người tham gia cho từng session (ST1, ST2).
3. Tab **Training Materials**: thêm file hoặc link (bắt buộc với đào tạo thường). Nếu không cần: bấm **Training Materials are not required…**, nhập lý do. Bảng sẽ ghi "Training Materials are not required for this training. Reason: …".
4. Tab **Assessment**: với session Test hoặc Checklist, tải mẫu APD.0009 (nút **Start from APD.0009…**), hoặc upload file, hoặc **Write the test** (bài test viết ngay trong hệ thống). Nếu không cần: **An assessment form is not required…** kèm lý do. Nếu session chỉ Observation hay Self-reading confirmation thì bảng tự ghi "No test or checklist is required…".
5. Bấm **Confirm attendee list** (ký, meaning "Attendance List Verified"). Sau bước này danh sách người tham gia bị khoá.
6. Tab **Approvers**: chỉ định người Review (REV) và người Approve (APP).

**Kỳ vọng:** nếu thiếu tài liệu hay bài test mà chưa miễn, nút duyệt nội dung và **Notify participants** bị chặn và nêu lý do.

### A3. Duyệt nội dung (REV rồi APP)
1. REV đăng nhập, chuông thông báo có "your action is needed". Mở activity, bấm duyệt nội dung (Review), ký.
2. APP nhận thông báo "the content is ready for your approval", duyệt (Approve), ký.
3. ORG nhận thông báo "the content was approved".

### A4. Thông báo (ORG)
1. Bấm **Notify participants**, ký. **Kỳ vọng:** trạng thái **Notified**; ST1, ST2 nhận thông báo "you are invited" có ngày (dd/MM/yyyy), nơi học, hình thức, trainer; email có ở MailHog.

### A5. Bắt đầu buổi học (ORG, Session Workspace)
1. Màn **Conduct Training**, bấm **Open Workspace** của session. Workspace có 5 bước: Prepare, Attendance, Training, Assessment, Results.
2. Bước **Prepare**: tick đủ các dòng Training room, Equipment for practice, Training Materials, Notice to trainees and trainer (và dòng Assessment test, Assessment checklist nếu hiện). Dòng giấy (Attendance sheet, Test copies) chỉ là tuỳ chọn. Nút **Next: Attendance** tắt cho đến khi tick đủ.
3. Bấm **Next: Attendance**: hiện cửa sổ ký "Start the training". Ký. **Kỳ vọng:** activity **In progress**; session có ngày diễn ra (Conducted on); F5 vẫn ở bước Attendance; đăng nhập lại vẫn đúng trạng thái.
4. Thử bấm thẳng URL của bước sau khi chưa bắt đầu: hệ thống đưa về Prepare.

### A6. Điểm danh
Cách 1, học viên tự check-in:
1. ORG (hoặc TRN) bấm **Open the check-in**: hiện mã 6 số + QR, đếm ngược đổi mã.
2. ST1 đăng nhập, vào **My Training**, bấm **Check In**, gõ mã (hoặc quét QR), bấm **Confirm**, ký. **Kỳ vọng:** dòng ST1 là Attended; cột Signature ghi "Ký điện tử khi điểm danh" trong danh sách APD.0117.
3. Bấm **Close the check-in** khi xong.

Cách 2, điểm danh nhanh: **Quick roll-call**, chọn nhiều người một lần, ký một chữ ký.
Cách 3, từng người: ở bảng, dòng **Mark attendance**: Attended, Online, hay Absent (bắt buộc lý do).
Sửa nhầm: **Correct attendance** (có lý do, chỉ trước khi có điểm).
Kiểm tra thêm: người tự điểm danh cho mình bị từ chối; NOP không điểm danh được.

### A7. Xem danh sách APD.0117
Nút **Training Attendance List** (cạnh Back trong workspace, hoặc tab Participants): mở cửa sổ có PDF. **Refresh** để dựng lại, **Download Word** và **Download PDF** để tải. Kiểm tra: số session "01", SOP/Doc. No chỉ số tài liệu, tên trainer đúng như nhập, cột chữ ký ghi Có mặt, Trực tuyến, Vắng mặt.

### A8. Gửi danh sách điểm danh cho QA (TRAINER)
1. Chỉ **người đào tạo (trainer) của session** thấy và bấm được nút **Send attendance list to QA** (ở cạnh Training Attendance List, trên đầu Session Workspace). Session có trainer ngoài hệ thống thì người điều hành (conduct) bấm. Người tổ chức không phải trainer **không** bấm được (403).
2. Nút **tắt** (rê chuột thấy lý do) khi còn ai ở trạng thái Invited hoặc còn session chưa diễn ra; **bật** khi mọi người đã là có mặt, trực tuyến hoặc vắng (vắng phải có lý do). Không còn nút Confirm attendance.
3. Bấm, ký. **Kỳ vọng:** "Attendance list sent to QA", ghi người gửi và giờ; chữ ký này là xác nhận của trainer (mục 5 APD.0117); email có file PDF APD.0117 gửi cho người giữ quyền `training.attendance.receive` và người xác nhận hoàn thành. Bấm lần 2 bị từ chối.
4. Từ lúc này: ở Document Control, màn Training Revision có **Training Completion Date** tự điền (ngày buổi đào tạo, lấy từ ngày thực hiện session `held_on`, ngày lớn nhất nếu nhiều session) và nút **Complete Training** của DCO **bật**. Trước đó nút **tắt** (rê chuột thấy lý do).

### A9. Nhập kết quả ngay trên dòng (TRAINER)
1. Bước **Results**: nhập **Maximum score of the test** một lần ở trên bảng (để trống cho đến khi nhập; nếu đã lưu thì tự hiện số đã lưu). **Pass mark** hiển thị là giá trị trong **Training Properties > Assessment**, không phải số cố định; đổi ở đó rồi mở lại thì thấy số mới.
2. Nhập **Score** từng dòng: cột Result hiện ngay Pass hoặc Not passed (kèm %) và chữ "not saved". **Enter** lưu một dòng; **Save all** lưu mọi dòng đã nhập (không cần nhập đủ). Điểm vượt max thì báo đỏ và không lưu.
3. Thoát ra và vào lại: các dòng đã lưu giữ nguyên, dòng chưa nhập vẫn nhập tiếp được; người Failed nhập lại điểm được (lần thử mới).
4. Cột **Scan**: biểu tượng tải lên theo từng dòng; **View** mở các bản scan của người đó.
5. Khi **mọi người có mặt đều có kết quả**, nút **Finish Training** xuất hiện (chỉ với trainer, sau khi danh sách điểm danh đã gửi). Bấm, ký. **Kỳ vọng:** cột "Training result" của APD.0117 được điền (Đạt/Không đạt); sau đó không sửa được điểm nữa. Trước khi bấm, cột này để trống.
6. Self-reading: học viên bấm xác nhận đã đọc (ký), sau đó ORG bấm **Verify self-reading**.

### A10. Gửi kết quả và QA xác nhận
1. Sau Finish Training mới xuất hiện nút **Send results to QA** (trainer, ký). **Kỳ vọng:** **Pending QA Confirmation**; email "results are waiting for QA" kèm PDF APD.0117 đã có kết quả.
2. REV đăng nhập: **Confirm completion** (ký). **Kỳ vọng:** **Completed**; ORG nhận thông báo; người đạt nhận "recorded in your training record"; hồ sơ cá nhân được ghi (Training Records). ORG không xác nhận được chính activity do mình lập danh sách (phân tách nhiệm vụ).
3. Thử **Return for correction** (REV, bắt buộc lý do): trở về In progress, trainer sửa rồi gửi lại.

Thứ tự các nút ở đầu workspace (chỉ một nút chính hiện cùng lúc): Send attendance list to QA, rồi Finish Training, rồi Send results to QA.
### A11. Người vắng hoặc không đạt
Sau khi In progress hoặc đã gửi: bấm **Supplementary training**, chọn người vắng hoặc Failed, nhập lý do. **Kỳ vọng:** tạo activity mới cùng mã gốc thêm chữ cái (ví dụ TRN/QA/26-120A), dùng lại nội dung đã duyệt, không đòi tài liệu hay test mới. Kết quả đào tạo lại hiện ở cột "Kết quả đào tạo lại" của APD.0117.

### A12. Các trường hợp phụ cần thử
- **Hoãn**: **Postpone** (cần lý do + ngày mới, chỉ khi buổi chưa bắt đầu); học viên nhận thông báo ngày mới.
- **Huỷ**: **Cancel** có lý do và chữ ký; nếu đã thông báo thì học viên nhận thông báo huỷ. Không huỷ được khi đã có người Passed.
- **Mở lại nội dung** sau khi đã thông báo (**Reopen content**, ký): activity về Planned, phải duyệt lại.
- **External**: không cần tài liệu hay test; người có mặt tự động Passed.
- **Visitor** (Unplanned, lý do Visitor): không cần tài liệu hay test.
- Quyền: đăng nhập NOP hoặc ST1 thử các nút trên, phải bị từ chối hoặc không hiện.

---

## Phần D. Thư viện bài kiểm tra (Training Assessments) và form APD.0009

Form mẫu là file **APD.0009.02 Training assessment.docx** đã tải lên và bật ở Settings > Training Properties > **Assessment Forms** (mã APD.0009, bản "2.0.0 (APD.0009.02)"). Người soạn và người duyệt cần quyền `training.assessment.design` và `training.assessment.approve` (trên DEV hai quyền này nằm trong set "Report Author and Administrator (DEV test)": admin, approver.test1, user.a.test).

1. **Soạn.** Menu Training Programme > **Training Assessments** > **New Assessment**. **Title** chỉ để nhận biết trong thư viện, **không ghi vào form**. **Type**: "Essay or multiple-choice test (APD.0009) (SOP default)" hoặc "Checklist test (APD.0009)" (không đổi được sau khi tạo). **Test duration (minutes)** sẽ được ghi vào ô "Thời gian làm bài". Test: Total Score sửa được (chia lại điểm cho các câu); Checklist không có điểm. Kéo thả để đổi thứ tự câu và đáp án. **Preview** xem form đúng như activity sẽ nhận (PDF), có nút xem bản đáp án.
2. **Duyệt.** Người soạn bấm **Submit for Approval** (Pending Approval). Người khác bấm **Approve** và ký (hoặc **Return to Draft** kèm lý do): **Effective**. Bản Effective không sửa được; muốn đổi bấm **New Version**.
3. **Dùng trong activity (tuỳ chọn).** Activity > tab **Assessment** > **Choose Assessment** (chỉ bản Effective, đúng loại với session, trước khi review nội dung). Hệ thống điền vào form APD.0009 đang bật và tạo hai file Word trong tab Assessment: **exam file** (bài cho học viên) và **answer key**. Có thể mở file bằng OnlyOffice để sửa tiếp. Nếu không muốn dùng thư viện: mở file mẫu và tự soạn như trước. **Remove** bỏ hai file đó.
4. **Điền sẵn trong form (khi chọn):** Training topic (các chủ đề của session), Số đào tạo (Training number), Loại đào tạo (ô ☒: lần đầu / đào tạo lại / định kỳ / đột xuất), Thời gian làm bài; câu hỏi chia **Phần I** (trắc nghiệm) và **Phần II** (tự luận, có dòng kẻ) hoặc bảng checklist Đúng / Không đúng; "Bài làm gồm N câu hỏi". Header (logo, tên form, Page n/N) và footer (số đào tạo, học viên, Sign/Date) trên mọi trang.
5. **Tải bài cho từng học viên, trước khi vào In progress.** Sau **Notify**, session giao bằng giấy: tab Sessions hoặc Prepare trong workspace: **Download test copies** (ZIP, mỗi học viên một file PDF) hoặc **Download as Word** (ZIP file Word để sửa trước khi in). Mỗi file đã có **họ tên, mã nhân viên, bộ phận, ngày** của học viên đó và học viên ở footer. In lại phải có lý do.
6. **Chấm.** Trainer chấm trên giấy, ở Step 5 nhập điểm từng người. Ô Maximum score tự điền bằng tổng điểm của bài. Bài Test: đạt theo pass mark của Training Properties. **Checklist: chọn Pass / Not passed cho từng người; chỉ đạt khi đúng hết mọi dòng.**
7. **Giảng viên nội bộ:** theo SOP.0003 5.3.4 giảng viên phải có hồ sơ đào tạo GMP và được đào tạo SOP. Chưa có thì ở tab Sessions bấm **Request Exception** (chọn người duyệt), người duyệt ký **Complete Approve** rồi mới Notify được.
## B. Đào tạo từ SOP (Document Control)

### B1. Tạo tài liệu (ORG hoặc tác giả)
1. **Document Control**: tạo tài liệu mới, bật **Requires Training** và nhập số ngày đào tạo (Training period days). Có thể chọn **Related Document**.
2. Chọn Reviewer, Approver cho tài liệu. Lưu.
3. **Kỳ vọng:** vào Training Activities thấy ngay một activity với Training Number cấp sẵn, trạng thái **Pending Document Approval**. Tài liệu chọn Related Document dùng chung mã của tài liệu gốc (xem B5).

### B2. Soạn thảo và duyệt tài liệu
1. Tạo revision, tải file lên, **Complete Editing**, **Submit for Review**.
2. Reviewer review, Approver approve (đều ký).
3. **Kỳ vọng:** khi revision sang **Pending Training**, activity chuyển **Planned**, ngày hạn đào tạo tính từ ngày duyệt.

### B3. Đào tạo
Làm như phần A từ A2: tài liệu được tính là Training Materials (không phải thêm), session Test vẫn cần bài test. Tab **Training Revision** của tài liệu có mục Training Information: mã, trạng thái (chữ hoa đầu, ví dụ "Planned"), ngày.

### B4. Complete Training của revision (DCO hoặc người có quyền)
1. Sau khi trainer **Send attendance list to QA** (bước A8), vào activity thấy nút **Complete Training (Revision)**, hoặc vào thẳng **Document Control > Revisions > Training Revision**.
2. Bấm **Complete Training**, ký. **Kỳ vọng:** revision chuyển sang bước sau (Ready for Publishing); ngày hoàn thành đào tạo là ngày buổi học. Không cần chờ chấm điểm hay QA xác nhận.
3. Trước khi gửi danh sách: nút Complete Training **tắt** (rê chuột thấy lý do).
4. Kết quả đào tạo có sau (A9, A10) và không chặn revision.

### B5. SOP có tài liệu liên quan dùng chung một mã
1. Tạo tài liệu F1, F2 (có Requires Training) trước: mỗi tài liệu có mã riêng.
2. Tạo SOP và chọn F1, F2 ở **Related Document**. **Kỳ vọng:** mã của F1, F2 bị huỷ (lý do "Merged into TRN…"); SOP giữ một mã.
3. Tạo revision của SOP, F1, F2 (đều cùng mã của SOP). Activity chỉ sang Planned khi cả ba revision được duyệt; hạn tính từ ngày duyệt cuối.
4. Sau Send attendance list to QA: màn activity có một nút **Complete Training (SOP.xxxx)** cho từng revision; làm từng cái.
5. Gỡ F1 khỏi danh sách Related khi revision của F1 đã vào nhóm: bị từ chối.

---

## C. Thông báo cần kiểm tra
Chuông thông báo và MailHog đều phải có, nội dung đúng số mã, tên, ngày dd/MM/yyyy, đường dẫn mở đúng activity; người làm hành động không tự nhận thông báo của mình:
asked to review/approve; content ready; content approved; invited; work suspended after failed; attendance list received (người giữ quyền nhận); results waiting for QA; QA returned results (kèm lý do); completed; recorded in your training record; cancelled; postponed.

## D. Ghi nhận bằng chứng
Mỗi activity có tab **Audit Trail** (ghi mọi bước, lý do, người ký). Ký điện tử có ở danh sách chữ ký. Chụp màn hình các kỳ vọng ở trên cho mỗi trường hợp để lưu vào hồ sơ test.

## E. Điều chưa kiểm chứng bằng tay
Việc gỡ tài liệu liên quan, tài liệu liên quan đã thông báo đào tạo riêng, nhắc việc theo lịch 06:30, thông báo cho người giữ quyền `training.attendance.receive`: chưa chạy thật trên DEV.

## Phần F. Biểu mẫu của công ty (Word/PDF), chữ ký điện tử trong biểu mẫu và bản in giấy (bổ sung 2026-10-25)

**Điều kiện:** các mẫu APD.0009, APD.0011, APD.0014, APD.0024, APD.0108, APD.0117, APD.0118, FRM.0007 và FRM.0044 đã được nạp và kích hoạt ở Training Properties (có chữ ký). Thiếu mẫu thì màn hình báo "template is not enabled".

| # | Việc cần thử | Kết quả mong đợi |
|---|---|---|
| F1 | Mở một phiên bản ma trận đã Effective, bấm Download Word và Download PDF | File đúng mẫu APD.0011: tên bộ phận, mỗi vị trí một cột, dấu X, cột Annual Yes/No; không có ghi chú của mẫu và bảng lịch sử sửa đổi. Phiên bản nháp không tải được |
| F2 | Yêu cầu đào tạo đã duyệt: Download Word/PDF (danh sách hoặc trang chi tiết) | File đúng mẫu APD.0118, có logo, Year, Request No, ô loại đào tạo được đánh dấu, khối chữ ký điện tử của người chuẩn bị, rà soát, phê duyệt |
| F3 | Training Number Register: Download Word/PDF | File đúng mẫu FRM.0044 theo bộ phận và năm |
| F4 | Bản giao việc: Download Word/PDF | File đúng mẫu APD.0024, ô "Bổ nhiệm lần đầu" hoặc "Thay đổi vị trí" được đánh dấu, hai khối chữ ký |
| F5 | Chữ ký mẫu (hàng của người đã duyệt): Download Word (FRM.0007) | Hai ảnh chữ ký, ngày, người xác nhận kèm khối chữ ký điện tử |
| F6 | Hoạt động có buổi Tự đọc: Download Word/PDF của danh sách tự đọc | File đúng mẫu APD.0108 |
| F7 | Mọi biểu mẫu trên | Phần điền là Times New Roman 12; khối chữ ký điện tử cỡ 8,5 pt, bắt đầu từ đỉnh ô; cột hẹp ("Sign by QA" của APD.0118) chỉ có tên, thời gian, "(PL n)" và khối đầy đủ ở phụ lục cuối |
| F8 | Bản giao việc nháp: bấm "Print for signing" | File có dòng đầu "Controlled print: APD.0024/…/P1", dữ liệu đã điền, chưa có chữ ký. In lần 2 phải nhập lý do và ra bản P2 |
| F9 | Hoạt động có buổi Tự đọc (đã Notified): "Print self-reading list for signing" | Tương tự E8; mã bản …/L1; bản có trong bảng Printed packs |
| F10 | Tab Paper, bảng Printed packs: bấm Returned / Lost / Void trên một bản | Trạng thái và người ghi hiện ra; Lost và Void bắt buộc có lý do; bản đã đóng không đổi lại được |
| F11 | Tab Files: tải bản scan và chọn "Paper copy it is the scan of" | Bảng scan có cột Paper copy; bảng Printed packs có cột Scans; bản Returned chưa có scan hiện "None yet" |
| F12 | QA xác nhận hoàn tất một hoạt động còn bản Issued | Vẫn xác nhận được; bảng Printed packs đã cảnh báo; Audit Trail ghi số bản còn mở |

| F13 | Settings → Training Administration → Training Vendors: Approve Vendor (tên, mã tham chiếu, hiệu lực), ký điện tử | Đơn vị hiện trong danh sách trạng thái Active; trùng tên đang Active (kể cả khác hoa/thường) bị từ chối; hiệu lực trong quá khứ bị từ chối |
| F14 | Tạo hoạt động đào tạo ngoài (External) với đơn vị chưa có trong danh mục | Hoạt động vẫn tạo được; màn hình có thông báo vàng "not on the register of approved training providers (SOP.0025)" |
| F15 | Tạo đào tạo ngoài với đơn vị đã duyệt | Không có thông báo; sau khi Make Inactive (có lý do và chữ ký) thì thông báo quay lại |

**Chưa kiểm chứng (cần bạn nhìn):** file Word mở trong Microsoft Word (ô đánh dấu, dòng đầu bản in, chữ ký không bị tách trang), các nút mới trên trình duyệt.
