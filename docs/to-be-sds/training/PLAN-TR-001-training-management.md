PLAN-TR-001 · Kế hoạch phát triển module Training Management · phiên bản 1.0 · 2026-10-16

# Kế hoạch phát triển Training Management (căn cứ SOP.0003.02 "Đào tạo", lưu đồ mục 5.2 và 9 biểu mẫu kèm theo)

**Trạng thái:** **ĐÃ ĐƯỢC CHỦ DỰ ÁN CHẤP NHẬN ĐỂ BẮT ĐẦU TRIỂN KHAI (2026-10-16); chờ QA xác nhận các quyết định** (mục 13.2). Đây là tài liệu nghiệp vụ; không phải phê duyệt GMP.
**Nguồn:** các file Markdown trong `docs/training_docs/` (chuyển từ file Word bằng MarkItDown, 2026-10-15): SOP.0003.02, APD.0009.02, APD.0011.02, APD.0014.02, APD.0024.02, APD.0108.01, APD.0117.01, APD.0118.01, FRM.0007.02, FRM.0044.01; **lưu đồ mục 5.2** (`docs/training_docs/SOP.0003.02 Flowchart (muc 5.2).png`); mã nguồn hiện có (mục 2 và 8); `TRAINING_MODULE_MASTER_PLAN.md` (kế hoạch chung 2026-09-21: phần miền nghiệp vụ bị tài liệu này thay thế, phần kiến trúc và kiểm định vẫn dùng).
**Thiết kế chi tiết (giao diện, máy chủ, API, cơ sở dữ liệu, bảo mật, kiểm định, gói công việc):** `SDS-TR-001-training-management-design.md` (cùng thư mục).

**Lịch sử bản:**

| Bản | Ngày | Nội dung |
|---|---|---|
| 0.1 | 2026-10-15 | Bản đầu từ SOP và các biểu mẫu |
| 0.2 | 2026-10-15 | Giao diện hiện có là bản thử, không là căn cứ; viết lại mục 8 (phối hợp Document Control) |
| 0.3 | 2026-10-15 | Mã đào tạo cấp cho revision; bỏ nhóm lý do; ngày hiệu lực theo Document Properties |
| 0.4 | 2026-10-16 | Đọc ảnh lưu đồ (mục 5.0); D-01, D-02, D-05, D-20 chốt |
| 0.5 | 2026-10-16 | Chủ dự án ủy quyền đề xuất các câu còn mở; nguyên tắc **phê duyệt theo phân quyền, chỉ định bất kỳ user** |
| **1.0** | 2026-10-16 | Chủ dự án chấp nhận; hợp nhất; không còn câu hỏi chặn khởi động; thêm mục 13.2 (việc của QA) |

**Quy tắc xuyên suốt (chủ dự án):**
1. **EU-GMP, toàn vẹn dữ liệu, bảo mật đứng trước** mọi cân nhắc khác (SDS-TR-001 mục 1).
2. **Mọi bước xem xét, duyệt, xác nhận theo phân quyền**: người gửi chỉ định bất kỳ user đủ điều kiện; không gắn tên vai trò hay tài khoản (SDS-TR-001 mục 8.5).
3. Mã đào tạo cấp **cho revision**, chỉ đọc, chỉ hiện sau khi lưu thành công; ngày hiệu lực theo cấu hình Document Properties; ký điện tử như luồng hiện tại; ma trận là dữ liệu của Training.

**Đọc bởi:** Chủ dự án, QA, dev.

**Chú giải nhãn:**

- **SOP**: có trong văn bản quy trình hoặc biểu mẫu, kèm tham chiếu mục.
- **ĐỀ XUẤT**: thiết kế của người soạn, SOP không nói.
- **QUYẾT ĐỊNH**: SOP không đủ để quyết; chủ nghiệp vụ hoặc QA phải chốt (mục 13).
- **KIỂM TRA MÃ**: đã thấy trong mã nguồn.

> **Lưu đồ (cập nhật 2026-10-16).** Hình lưu đồ mục 5.2 mất khi chuyển sang Markdown; chủ dự án đã gửi ảnh. Mục 5.0 là bản đọc lại và đối chiếu. Bảng có ô gộp trong các file Markdown vẫn bị làm phẳng.

---

## 1 Tóm tắt

SOP.0003 không mô tả một hệ thống học trực tuyến (khóa học, bài giảng, chứng chỉ). Nó mô tả **một quy trình lập hồ sơ đào tạo có kiểm soát**, xoay quanh bốn thứ:

1. **Ma trận đào tạo** (APD.0011): vị trí công việc nào phải được đào tạo chủ đề / SOP nào.
2. **Mã đào tạo** (`TRN/DC/YY-XXX`, FRM.0044) cấp cho mỗi hoạt động đào tạo, gắn với một hoặc nhiều **buổi đào tạo** (session).
3. **Danh sách tham gia và đánh giá** (APD.0117, APD.0009, APD.0108): ai được đào tạo, ai dạy, kết quả đạt / không đạt, đào tạo lại, người vắng.
4. **Hồ sơ đào tạo cá nhân** (APD.0014) và **bản giao việc** (APD.0024): bằng chứng người đó đủ năng lực để làm việc độc lập.

Hệ quả cho thiết kế: đối tượng trung tâm là **Hoạt động đào tạo (Training Activity) có Mã đào tạo, gồm các Buổi đào tạo và Người tham gia**, không phải "Course". Phần "course inventory / materials / quiz" trong `TRAINING_MODULE_MASTER_PLAN.md` và các màn đã dựng chỉ khớp một phần (mục 11).

**Đề xuất triển khai, theo thứ tự (chi tiết mục 12):**

| Giai đoạn | Nội dung | Vì sao đặt ở đây |
|---|---|---|
| T0 | Chốt quyết định, đối chiếu lưu đồ, nạp danh mục (phòng ban, vị trí, người) | Nhiều quy tắc SOP chưa đủ để lập trình (mục 13) |
| T1 | Ma trận đào tạo + Yêu cầu đào tạo + Sổ mã đào tạo | Là đầu vào của mọi việc sau; có số thứ tự và phê duyệt |
| T3a | Nối Document Control (phần 1): tick "Requires Training?" khi tạo tài liệu sinh Training Number và tạo hoạt động đào tạo bên Training; màn đánh giá tác động | Cần số và sổ mã của T1; người dùng thấy ngay kết quả |
| T2 | Hoạt động đào tạo: buổi, danh sách, chữ ký, đánh giá, đào tạo lại, người vắng | Tạo ra hồ sơ đào tạo thật |
| T3b | Nối Document Control (phần 2): hoàn thành đào tạo cập nhật ngày vào revision, hạn 10 ngày, mở khóa bước Complete Training | Cần hoạt động và đánh giá của T2 |
| T4 | Hồ sơ cá nhân, bản giao việc, chữ ký mẫu, chuyển vị trí | Cần dữ liệu từ T1 đến T3 |
| T5 | Tuân thủ, nhắc việc, báo cáo, lưu trữ 10 năm | Tổng hợp trên dữ liệu thật |
| T6 | Nhập dữ liệu cũ, kiểm định, UAT, phát hành | |

---

## 2 Hiện trạng phần mềm (KIỂM TRA MÃ)

| Hạng mục | Hiện trạng | Nguồn |
|---|---|---|
| Giao diện Training | Có `eqms/src/features/training/` (`course-inventory`, `materials`, `my-training`, `compliance-tracking`, `records-archive`, `types`) và `eqms/src/features/settings/training-administration/`. **Do chủ dự án tự dựng thử, dữ liệu mẫu; không phải căn cứ và sẽ được thay (xác nhận 2026-10-15).** | Mã; chủ dự án |
| Backend Training | **Chưa có** miền Training đầy đủ (controller, entity, repository, service). Chỉ có `TrainingAuthorizationService`. | Master plan mục 2 |
| Quyền Training | Đã có trong DB: `training.module.view`, `training.material.manage`, `training.session.manage`, `training.assignment.manage`, `training.admin.view`, `training.admin.curriculums.view`, `training.admin.properties.view`, `training.admin.quiz.view`, `training.admin.requirement_templates.view`. | Migration (grep) |
| Document Revision | Đã có giai đoạn **Pending Training**; các cột `requires_training`, `training_period_days`, `reason_for_skipping_training`, `training_planned_date`, `training_period_end_date`, `training_completion_date`; quyền `documents.training.manage` / `documents.training.complete`. | `DocumentRevisionRecord` |
| Chu kỳ rà soát tài liệu | Có `periodic_review_cycle` (tháng) và `periodic_review_notification` trên tài liệu và revision; `valid_until`, `review_date`. | V13, V111 |
| Loại tài liệu | Có SOP, FORM, APD, POL, QM, GUI, INS, SMF… **Không thấy loại "Training (TRN)"** mà APD.0011 nói. | Migration `document_types` |
| Cấp tài liệu (cấp 1 đến 4) | **Không thấy** khái niệm "cấp tài liệu" trong migration; SOP.0003 mục 5.3.1 dùng nó để quyết định có đào tạo hay không. | Grep migration |
| Vị trí công việc | Có bảng `positions` (V3: `code`, `name`, `department_id`); người dùng chỉ có cột `position` dạng **chữ**, **chưa có liên kết** người dùng đến vị trí (đính chính 2026-10-15: bản 0.1 ghi nhầm là chưa có bảng danh mục). Cần bảng ánh xạ người đến vị trí (SDS-TR-001 mục 4.1). | V3, V179 |
| Phòng ban | Có bảng `departments` với cột `code` duy nhất (≤ 40 ký tự), dùng làm "DC" trong mã đào tạo. | V3 |
| Chữ ký điện tử, Audit Trail, lưu file, thông báo, quyền theo hành động (`resource capabilities`) | Có sẵn dùng chung, đã dùng ở Document, Controlled Copy, Report, Backup. | |

**Kết luận:** coi Training là **module làm mới cả máy chủ lẫn giao diện**. Giao diện thử hiện có không được dùng làm căn cứ thiết kế; chỉ tái dùng các thành phần giao diện dùng chung của dự án (bảng, bộ lọc, hộp thoại...). Khi bản mới thay thế, **xóa hết mã thử bị thay** (quy ước dự án). Mã `training.*` hiện có là quyền màn hình, chưa đủ cho quy trình này (mục 10).

---

## 3 Thuật ngữ và đối tượng nghiệp vụ (SOP mục 4)

| Thuật ngữ SOP | Đối tượng trong hệ thống | Ghi chú |
|---|---|---|
| Đào tạo ban đầu (Initial) | Loại hoạt động `INITIAL` | Mọi nhân viên mới; ba phần: HCNS (nội quy, an toàn), QA (GMP chung), đơn vị liên quan (chuyên môn) |
| Đào tạo định kỳ (Periodic) | `PERIODIC` | Theo Yêu cầu đào tạo (APD.0118); gồm định kỳ hàng năm và định kỳ tài liệu |
| Đào tạo đột xuất (Unplanned) | `UNPLANNED` | Khách, nhà thầu, CAPA, bổ sung, tài liệu mới, vị trí mới, kết quả đánh giá, vắng trên 6 tháng, cập nhật kiến thức |
| Đào tạo lại (Re-training) | `RETRAINING` | Khi lần trước không đạt; cũng đào tạo bổ sung cho người vắng |
| Đào tạo bên ngoài | `EXTERNAL` (chủ động / bị động) | Chọn đơn vị đào tạo theo SOP.0025; hồ sơ chỉ ghi tên đơn vị hoặc người đào tạo |
| Buổi đào tạo (Session) | Session | Một hoặc nhiều chủ đề, cùng giảng viên, cùng nhóm học viên |
| Mã đào tạo (Training number) | `TRN/DC/YY-XXX` | Duy nhất; một mã có thể có nhiều session |
| Chủ đề đào tạo (Topic) | Topic | Có thể gắn một SOP (mã + phiên bản) hoặc là chủ đề tự do |
| Ma trận đào tạo | Training Matrix | Theo bộ phận; dòng là chủ đề hoặc SOP, cột là vị trí công việc |
| Yêu cầu đào tạo | Training Requirement | Theo năm hoặc theo đợt rà soát tài liệu |
| Bản giao việc | Job Assignment | Theo nhân viên và vị trí |
| Hồ sơ đào tạo cá nhân | Personal Training Record | Tổng hợp, không nhập tay |
| Chữ ký mẫu | Specimen Signature | Theo nhân viên, có lịch sử thay đổi |

Hình thức đào tạo (SOP bảng 5.1.2 chưa đánh số): **Tự đọc**, **Tập trung**, **Tập trung kết hợp trực tuyến**, **Thực hành**; kèm cách đánh giá và chủ đề áp dụng (mục 5.2 dưới đây).

---

## 4 Vai trò và trách nhiệm (SOP mục 3)

| Vai trò trong SOP | Việc phải làm trên hệ thống (ĐỀ XUẤT) | Quyền dự kiến |
|---|---|---|
| Trưởng đơn vị liên quan (ĐVLQ) | Lập ma trận đào tạo của bộ phận; tổ chức đào tạo ban đầu và đột xuất của đơn vị; phân công đào tạo tài liệu; lập bản giao việc; xác nhận chữ ký mẫu của nhân viên; xác nhận tự đọc | `training.matrix.manage` (bộ phận mình), `training.activity.organize`, `training.assignment_letter.manage`, `training.signature.confirm` |
| Phòng HCNS | Đào tạo nội quy, an toàn lao động, PCCC; chuẩn bị địa điểm, phương tiện; tham gia tổ chức | `training.activity.organize` (loại và chủ đề của HCNS) |
| Nhân viên QA được phân công (điều phối đào tạo) | Chuẩn bị và rà soát ma trận QA; lập yêu cầu đào tạo; chuẩn bị danh sách tham gia; cấp mã; quản lý hồ sơ đào tạo; nhận danh sách sau đào tạo và cập nhật ngày hoàn thành | `training.requirement.prepare`, `training.code.allocate`, `training.record.manage` |
| Trưởng phòng QA | Tổ chức đào tạo hằng năm toàn nhà máy; phê duyệt (xem xét) ma trận toàn nhà máy; xem xét yêu cầu đào tạo; phê duyệt nội dung đào tạo | `training.matrix.approve`, `training.requirement.review`, `training.content.approve` |
| QM | Phê duyệt Yêu cầu đào tạo | `training.requirement.approve` |
| QM, PM | Tham gia đào tạo định kỳ và tài liệu mới | (học viên) |
| Giảng viên | Chuẩn bị nội dung và bài kiểm tra; dạy; chấm; gửi kết quả cho QA | `training.activity.conduct` |
| Học viên | Xem danh sách của mình; ký tham dự; làm bài; xác nhận tự đọc | quyền tự phục vụ |
| DCO-QA (xác nhận hoàn thành, APD.0117 mục 6) | Xác nhận hoàn thành khi bản đánh giá đã đủ | `training.activity.close` |

**Nguyên tắc chỉ định (chủ dự án, 2026-10-16):** mọi bước **xem xét, duyệt, xác nhận** (ma trận, yêu cầu đào tạo, nội dung, hoàn thành hoạt động, bản giao việc, chữ ký mẫu, xuất hồ sơ, vô hiệu hồ sơ, các ngoại lệ) là **quyền gán qua Access Profile**; người gửi **chỉ định** người xử lý trong số người đủ điều kiện; **bất kỳ user nào** được cấp quyền đều làm được. Tên vai trò trong SOP (QM, Trưởng phòng QA, DCO-QA, điều phối đào tạo) chỉ là **gợi ý ai thường được cấp quyền**, không phải điều kiện của phần mềm. Xem SDS-TR-001 mục 8.5.

**Không thể suy ra từ SOP:** ai thực sự là "người phụ trách đào tạo của QA", có tách quyền "chuẩn bị" và "duyệt" cho ma trận QA hay không (SOP nói QA chuẩn bị và QA Manager duyệt; QA Manager lại là người duyệt ma trận toàn nhà máy). Đã chốt ở D-05: tách theo quyền, người được chỉ định.

Ghi chú nguyên tắc dự án: quyền gán qua Access Profile và Permission Set, không viết cứng tài khoản hay tên vai trò (như đã làm với Report).

---

## 5 Quy trình trên hệ thống

### 5.0 Lưu đồ quy trình (SOP mục 5.2) đọc từ ảnh

Ảnh: `docs/training_docs/SOP.0003.02 Flowchart (muc 5.2).png`. Cột trái là đơn vị chịu trách nhiệm (D.I.C), cột phải là tài liệu liên quan.

| Bước trên lưu đồ | Đơn vị (D.I.C) | Tài liệu | Ghi chú đọc được |
|---|---|---|---|
| **Ma trận đào tạo** | Departments | APD.0011 | Là **gốc** của bốn nhánh |
| Bốn nhánh từ ma trận: **Đào tạo đột xuất và bên ngoài**; **Đào tạo định kỳ**; **Ban hành SOP mới**; **Đào tạo ban đầu** | Departments | | |
| **Yêu cầu đào tạo** | QA | APD.0118 | **Chỉ nhánh định kỳ** đi qua bước này; ba nhánh kia đi thẳng tới cấp mã |
| **Cấp mã đào tạo** | Departments | FRM.0044 | Cả bốn nhánh dồn về đây |
| **Lập danh sách tham gia đào tạo** | Departments | APD.0117 | |
| **Chuẩn bị nội dung đào tạo** | Trainer | (không có) | |
| **Duyệt nội dung đào tạo** (hình thoi, có quyết định) | **Departments, QM** | (không có) | **Khác phần chữ của SOP** (xem D-32) |
| **Thực hiện đào tạo** | Trainer | (không có) | Mũi tên đứt hai chiều với bước đánh giá: đào tạo lại |
| **Đánh giá đào tạo** | **Trainer, DCO** | APD.0009, APD.0117, APD.0108 | Có nhánh đứt sang **Điều chuyển** |
| **Điều chuyển (Transfer)** | | | Mũi tên đứt đi lên tới **Đào tạo ban đầu**: nhân viên điều chuyển được đào tạo như nhân viên mới ở chỗ mới (khớp SOP 5.3.11) |
| **Lập bản giao việc** | Departments | APD.0024 | |
| **Lưu hồ sơ đào tạo** | QA | (không có) | Bước cuối |

**Đối chiếu với kế hoạch (kết luận):**

1. **Khớp:** bốn loại đào tạo đều bắt nguồn từ ma trận; yêu cầu đào tạo chỉ cho nhánh định kỳ (TR-06); mọi nhánh qua cấp mã rồi danh sách tham gia; có vòng đào tạo lại sau đánh giá; bản giao việc sau đánh giá; hồ sơ do QA lưu.
2. **Hệ quả cho dữ liệu:** mọi hoạt động đào tạo, **kể cả đột xuất và bên ngoài**, có thể tham chiếu dòng chủ đề của ma trận (nếu có); "Ban hành SOP mới" là loại có tài liệu nguồn (khớp quyết định phối hợp Document Control); các loại còn lại **không phát sinh từ tài liệu** (xác nhận quyết định D-02).
3. **Điểm mới so với bản 0.3:** **điều chuyển sinh ra đào tạo ban đầu** (không chỉ là danh sách việc cần bổ sung): kế hoạch đã thêm lệnh "tạo đào tạo từ điều chuyển" (mục 5.12 và D-33).
4. **Điểm khác phần chữ của SOP:** (a) duyệt nội dung: lưu đồ ghi **Departments, QM**, mục 5.3.5 ghi **trưởng đơn vị liên quan và Trưởng phòng QA** (D-32); (b) bước **Lưu hồ sơ** nằm sau **Bản giao việc**, trong khi mục 5.3.7 nói QA ghi hồ sơ cá nhân ngay sau đánh giá. Thiết kế **giữ** việc tạo dòng hồ sơ ngay khi hoạt động hoàn thành (hồ sơ đào tạo cần có kể cả đào tạo định kỳ không có bản giao việc); bản giao việc là một hồ sơ riêng nối sau cho đào tạo ban đầu và điều chuyển.
5. **DCO** xuất hiện ở bước đánh giá: tương ứng với "DCO-QA xác nhận hoàn thành" của APD.0117 mục 6 (giữ trong thiết kế).

### 5.1 Ma trận đào tạo (SOP 5.3.1, APD.0011)

**SOP.**
- Trưởng đơn vị lập ma trận cho **từng vị trí** trong bộ phận, dựa vào bản mô tả công việc; trình các cấp phê duyệt. Với QM và Production Manager, ma trận do QA lập.
- Nội dung: chủ đề hoặc SOP (cột), vị trí công việc (các cột), **"Annual training required (Yes/No)"** cho từng dòng. Nhóm dòng theo: đào tạo chung cả nhà máy, đào tạo chung theo bộ phận, danh mục SOP cần đào tạo cho từng vị trí.
- Vị trí quản lý có thể ghi gộp là "các cấp quản lý".
- **Phải cập nhật** khi: đổi mô tả công việc; có yêu cầu thay đổi sau rà soát hằng năm và trước khi lập yêu cầu đào tạo hằng năm; **khi ban hành mới tài liệu cấp 1, 2, 3** (đánh giá tác động đào tạo, xác định vị trí, cập nhật ma trận trước khi lập yêu cầu đào tạo).
- **Có thể không cần đào tạo:** tài liệu cấp 4 (trừ khi có quy định khác hoặc đánh giá cho thấy cần); thay đổi chỉ về định dạng, bố cục, lỗi chính tả hoặc biên tập mà không đổi nội dung, yêu cầu, trách nhiệm, cách làm (kết luận từ đánh giá tác động ở quy trình Kiểm soát thay đổi).
- APD.0011 ghi: file này được tạo **trong hệ thống EDMS với loại tài liệu Training (viết tắt TRN), loại phụ Training matrix**; trách nhiệm chuẩn bị, kiểm tra, phê duyệt theo mục 3 của SOP.

**ĐỀ XUẤT.**
- Ma trận là **dữ liệu có cấu trúc** (bộ phận, vị trí, dòng, ô) với **vòng đời nhiều phiên bản**: Draft, Pending Approval, Effective, Obsolete; phiên bản mới có hiệu lực thì phiên bản cũ thành Obsolete và vẫn xem được (cùng mô hình revision của Report Template và Document).
- Hai khả năng cho việc "tạo file trong EDMS": (a) ma trận là tài liệu thật của Document Control (loại TRN, loại phụ Training matrix) và Training đọc nội dung từ đó; (b) ma trận là dữ liệu của Training và xuất ra tài liệu khi cần. **Đề xuất (b)** cho ma trận có cấu trúc, vì Document Control lưu file, không lưu ô dữ liệu để Training tính toán. Quyết định D-02.
- Bản in / xuất PDF theo mẫu APD.0011 để lưu và để kiểm tra viên xem.

### 5.2 Hình thức đào tạo và cách đánh giá (SOP bảng 5.1.2)

| Hình thức | Địa điểm | Cách đánh giá | Áp dụng cho (theo SOP) |
|---|---|---|---|
| Tự đọc | Không quy định | Trưởng phòng xác nhận **bằng lời** theo APD.0108 | Chính sách và quy định nội bộ, cập nhật hướng dẫn công việc, SOP đơn giản, cập nhật quy định mới, nâng phiên bản có thay đổi nhỏ, **đào tạo định kỳ tài liệu** |
| Tập trung | Phòng đào tạo, phòng họp, khu thực nghiệm, phòng ban | Bài kiểm tra tự luận hoặc trắc nghiệm theo APD.0009 | Nguyên tắc GMP cơ bản, CAPA / sai lệch, yêu cầu pháp lý, chủ đề hằng năm, **tài liệu ban hành mới và nâng phiên bản có ảnh hưởng luồng quy trình** |
| Tập trung kết hợp trực tuyến | Phòng đào tạo hoặc nền tảng (Teams, Meet, Zoom) | (SOP để trống cột này; mục 5.3.7 chỉ nói ghi "Trực tuyến" vào cột Ký tên) | (để trống) |
| Thực hành | Nơi làm việc | Checklist theo APD.0009; quan sát thao tác | Vận hành thiết bị, thao tác sản xuất, quy trình thực hành |

**ĐỀ XUẤT:** hệ thống gợi ý hình thức theo loại nội dung nhưng **không khóa** (SOP dùng "có thể áp dụng"); người tổ chức chọn và hệ thống bắt buộc cách đánh giá tương ứng (mục 5.8). Câu hỏi D-06: đánh giá của hình thức kết hợp trực tuyến.

### 5.3 Yêu cầu đào tạo (SOP 5.3.2, APD.0118)

**SOP.**
- QA lập theo APD.0118. **Chỉ áp dụng cho đào tạo định kỳ hằng năm và đào tạo tài liệu sau rà soát định kỳ.** Các loại khác không lập phiếu này.
- Nội dung định kỳ hằng năm gồm: GMP chung; toàn vẹn dữ liệu và kỹ thuật vô trùng; **xu hướng lỗi** từ đánh giá, khiếu nại khách hàng, điều tra OOS, CAPA, quan sát thực tế.
- Yêu cầu cho **năm sau phải lập và duyệt trước 31/12** mỗi năm.
- Yêu cầu định kỳ tài liệu: tần suất theo **thời hạn rà soát** của tài liệu; sau khi rà soát xong, QA lập yêu cầu dựa vào số lượng, nội dung tài liệu đã rà soát và kế hoạch nhà máy; **lập và duyệt chậm nhất vào ngày cuối của tháng hoàn thành rà soát**.
- Bản đã duyệt gửi các bộ phận liên quan làm căn cứ.
- Biểu mẫu: năm, số yêu cầu, loại (định kỳ SOP / hằng năm), các dòng: tháng dự kiến, chủ đề, **mã đào tạo, ngày đào tạo, ký và nhận xét của QA (QA ghi sau khi đào tạo xong)**; ba chữ ký: người lập (điều phối đào tạo), xem xét (Trưởng phòng QA), duyệt (QM).
- Dời lịch: chủ đề không hoàn thành trong tháng đã đăng ký **bắt buộc dời sang tháng ngay sau**.

**ĐỀ XUẤT.**
- Yêu cầu đào tạo là hồ sơ có vòng đời **Draft, Pending Review, Pending Approval, Approved**, ba chữ ký điện tử theo thứ tự lập, xem xét, duyệt.
- Mỗi dòng của yêu cầu liên kết với **một hoạt động đào tạo** (mã đào tạo) khi được tổ chức; trạng thái dòng: Planned, Done, Postponed, Overdue; khi quá tháng thì tự chuyển sang Overdue và **ép dời sang tháng sau** (ghi lý do), thay vì để dòng trôi.
- Hệ thống **gợi ý** danh sách tài liệu vừa rà soát xong trong tháng (đọc từ Document Control) để điều phối viên chọn đưa vào yêu cầu; không tự lập.
- Nhắc việc: trước 31/12 chưa có yêu cầu năm sau được duyệt; cuối tháng rà soát tài liệu mà chưa có yêu cầu.

### 5.4 Cấp mã đào tạo và Sổ mã (SOP 5.1.4, 5.3.3, FRM.0044)

**SOP.**
- Mã: **`TRN/DC/YY-XXX`**; DC là mã phòng ban chịu trách nhiệm tổ chức hoặc quản lý và cấp mã; YY hai số cuối của năm; XXX số thứ tự tăng dần.
- Cấp mã **trước mỗi hoạt động đào tạo**.
- Đào tạo bổ sung cho người vắng: **giữ mã gốc, thêm hậu tố chữ cái (a, b, c…)**; mỗi đợt bổ sung ghi thành **một dòng riêng** trong sổ mã.
- Một mã có thể gồm **nhiều chủ đề** ở các ngày khác nhau với điều kiện **cùng đơn vị tổ chức**; hoặc một mã cho **một chủ đề** gồm một hoặc nhiều session.
- Mỗi bộ phận theo dõi việc cấp mã trong **Sổ cấp mã** (FRM.0044): cột ngày, mã đào tạo, mã SOP, chủ đề, số buổi, ghi chú.
- Ai cấp mã: **đơn vị tổ chức**; với đào tạo ban đầu và định kỳ là **QA**; với đào tạo đột xuất và bên ngoài là **bộ phận phát sinh nhu cầu** (ví dụ SOP mới thì bộ phận ban hành SOP).
- Dời lịch: **vẫn dùng mã đã mở**; lý do ghi vào cột Ghi chú của sổ.

**ĐỀ XUẤT.**
- Mã do hệ thống cấp, **người dùng không nhập tay** (cùng nguyên tắc với Template Number và Document Number đã làm). Bộ đếm theo **(mã phòng ban, năm)**; chỉ tăng; khóa dòng khi cấp; không dùng lại số, kể cả khi hoạt động bị hủy.
- Hậu tố a, b, c… do hệ thống cấp cho đợt bổ sung, tham chiếu mã gốc; sau chữ `z` cần quy tắc (hiếm; D-07).
- **Sổ mã đào tạo là một báo cáo trên dữ liệu thật**, theo từng phòng ban, không phải bảng gõ tay: mỗi lần cấp mã tự thêm một dòng; hủy mã giữ lại dòng với trạng thái Cancelled và lý do.
- Quyền cấp mã: lấy từ SOP (QA cho ban đầu, định kỳ; bộ phận phát sinh cho đột xuất, bên ngoài); xem D-08 về việc bộ phận khác nhập danh mục chủ đề.
- **Cảnh báo:** APD.0009 yêu cầu có "Số đào tạo" trên mỗi trang bài kiểm tra (v2.0.0) để toàn vẹn và truy xuất: hệ thống in số đào tạo vào bản in của bài kiểm tra.

### 5.5 Danh sách tham gia đào tạo (SOP 5.3.4, APD.0117, APD.0108)

**SOP.**
- Lập và **thông báo cho người tham gia trước buổi đào tạo**. Đơn vị tổ chức phối hợp với đơn vị liên quan.
- Phải gồm **tất cả nhân viên thuộc phạm vi**, kể cả người đang vắng (thai sản, nghỉ phép, lý do khác).
- Tự đọc dùng **APD.0108**; các hình thức khác dùng **APD.0117**.
- APD.0117 gồm: mã đào tạo; thông tin chung (nội dung, bộ phận, loại đào tạo); **bảng chi tiết các session** (session, SOP/tài liệu, chủ đề, hình thức, người đào tạo, ngày); **danh sách người tham gia theo từng session** (STT, mã NV, tên, bộ phận, **ký tên**, **kết quả**, **kết quả đào tạo lại nếu có**); xác nhận của người chuẩn bị danh sách (trước đào tạo); xác nhận của người đào tạo (đã tham gia đủ, theo session); **xác nhận hoàn thành của DCO-QA sau khi bản đánh giá đào tạo hoàn thiện**.
- APD.0108: bộ phận, mã và tên tài liệu (phiên bản); các dòng nhân viên với **mã đào tạo, ngày đọc hiểu, chữ ký**; phần **trưởng phòng xác nhận** kèm nhận xét.
- Đối với đào tạo bên ngoài, hồ sơ chỉ ghi tên đơn vị hoặc cá nhân đào tạo.

**ĐỀ XUẤT.** Danh sách là **dữ liệu của hoạt động đào tạo** (mục 7): Hoạt động, Session, Người tham gia theo session, với trạng thái theo từng người: Invited, Attended, Absent, Online, Passed, Failed, Retrained, Excused (nếu D-09 chốt). Bản in APD.0117 / APD.0108 là **bản xuất ra từ dữ liệu**, có số đào tạo và số trang trên mỗi trang. Hệ thống đề xuất sẵn danh sách người từ **ma trận đào tạo** (vị trí có chủ đề đó) cộng người được chọn thêm; người vắng dài hạn vẫn nằm trong danh sách và được đánh dấu.

### 5.6 Nội dung đào tạo (SOP 5.3.5)

**SOP.** Giảng viên chuẩn bị tài liệu và nội dung trước buổi dạy; **chỉ dùng tài liệu đã duyệt** (SOP đúng bản có hiệu lực); nội dung từ kiểm soát thay đổi hoặc CAPA thì dùng nội dung **đã được phê duyệt**; nội dung trích từ hướng dẫn thì giảng viên làm tài liệu đào tạo và **lưu cùng tài liệu đào tạo**; chuẩn bị bài kiểm tra theo APD.0009; **Trưởng đơn vị liên quan và Trưởng phòng QA xem xét, phê duyệt**.

**Yêu cầu giảng viên (SOP 5.1):** được đào tạo GMP và chuyên môn liên quan; là người soạn, kiểm tra, duyệt tài liệu, hoặc trưởng bộ phận hoặc giám sát đã được đào tạo SOP đó; **người ký tên trên tài liệu được coi là lần đào tạo ban đầu về tài liệu đó**.

**ĐỀ XUẤT.**
- Mỗi chủ đề của session chọn **tài liệu nguồn từ Document Control (phiên bản có hiệu lực, lưu mã và số phiên bản)**; hệ thống từ chối tài liệu không ở trạng thái hiệu lực (thay cho "chỉ dùng nội dung đã duyệt").
- Tài liệu đào tạo phụ (slide, trích dẫn) tải lên và được **ghim theo hoạt động** (checksum, bản gốc không sửa), phải qua **bước xem xét và duyệt** bởi hai người được SOP nêu.
- **Hồ sơ giảng viên đủ điều kiện:** ghi nhận ai đủ điều kiện dạy chủ đề nào (đã đào tạo GMP; đã đào tạo SOP đó; là người soạn, kiểm tra, duyệt). Hệ thống **cảnh báo hoặc chặn** khi chọn giảng viên không đủ điều kiện (D-10: cảnh báo hay chặn).
- Người ký tài liệu (soạn, kiểm tra, duyệt) được **tự động coi là đã được đào tạo ban đầu** về tài liệu đó, lấy từ luồng chữ ký của Document Control (mục 8).

### 5.7 Thực hiện đào tạo (SOP 5.3.6)

**SOP.**
- Đơn vị tổ chức chuẩn bị: thông báo HCNS chuẩn bị địa điểm, phương tiện, tài liệu; thông báo các bộ phận chuẩn bị thiết bị (đào tạo thực hành); thông báo thời gian, địa điểm, nội dung cho học viên và giảng viên.
- Giảng viên chỉ dùng nội dung đã duyệt. **Đơn vị soạn tài liệu đào tạo tài liệu cho mình và các đơn vị liên quan ở lần ban hành đầu (version 01)**; với đào tạo định kỳ hoặc nâng phiên bản thì **trưởng đơn vị liên quan** đào tạo cho đơn vị mình.
- Sau đào tạo, đơn vị tổ chức gửi danh sách cho QA. **Tài liệu mới hoặc nâng phiên bản: gửi QA ngay trong ngày đào tạo** để cập nhật ngày hoàn thành trên phần mềm.
- Trễ lịch: dời sang tháng sau (mục 5.3).
- **Thời hạn:** tài liệu mới hoặc nâng phiên bản **nên hoàn thành đào tạo trong 10 ngày kể từ ngày phê duyệt** (5.1.3).

**ĐỀ XUẤT.** Trạng thái hoạt động: **Planned, Notified, In Progress, Assessment, Pending QA Confirmation, Completed, Cancelled**. Chuyển trạng thái do máy chủ kiểm tra; thông báo tự động tới HCNS, các bộ phận, học viên, giảng viên khi hoạt động ở Planned đến Notified (có địa điểm, thời gian, chủ đề). Với tài liệu mới: nhắc và cảnh báo quá hạn theo mốc 10 ngày; **"nên" trong SOP là khuyến nghị**, nên quá hạn là **cảnh báo, không chặn** (D-11).

### 5.8 Đánh giá đào tạo (SOP 5.3.7, APD.0009)

**SOP.**
- Hình thức đánh giá theo 5.2. Hybrid, học viên tham gia trực tuyến: giảng viên ghi **"Trực tuyến"** vào cột Ký tên.
- **Vắng:** người có tên trong danh sách nhưng không dự phải ghi rõ **"Vắng mặt"** ở cột Ký tên của danh sách gốc; phải **bố trí đào tạo lại phù hợp**; lập **danh sách riêng** cho buổi bổ sung với quy tắc mã ở 5.1.4.
- **Bài kiểm tra:** giảng viên đánh giá cuối đợt; học viên **ký tất cả các trang**; **đạt khi qua 70% tổng điểm** (APD.0009: "≥ 7 điểm, thang 10"); không đạt thì **đào tạo lại**. Lần đầu không đạt thì **tạm ngừng việc** (công việc liên quan), giảng viên sắp xếp đào tạo lại, **ghi lại trong bài kiểm tra**; kết quả tổng hợp theo APD.0009.
- **Tự đọc:** nhân viên ký APD.0108; **QA ghi vào hồ sơ đào tạo cá nhân dựa trên APD.0108**.
- Sau đánh giá, đơn vị tổ chức gửi kết quả cho QA **trong 7 ngày làm việc** để hoàn thiện hồ sơ và cập nhật hồ sơ cá nhân (APD.0014).
- APD.0009 gồm: chủ đề đào tạo, số đào tạo, thông tin người làm bài (tên, mã NV, đơn vị, ngày, thời gian làm), **loại đào tạo** (lần đầu, đào tạo lại, định kỳ, đột xuất), nhận xét, **kết quả** (đạt hoặc không đạt, đào tạo lại), người đánh giá; hai kiểu nội dung: **câu hỏi (tự luận hoặc nhiều đáp án)** hoặc **checklist Đúng/Không đúng**; chữ ký học viên và ngày; **chữ ký và ngày ở chân mỗi trang** (trừ trang cuối).

**ĐỀ XUẤT.**
- Đánh giá là **bản ghi theo từng học viên và session**: loại (Question / Checklist), điểm, tỉ lệ, kết quả (Passed / Failed), số lần, người đánh giá, chữ ký học viên. **Ngưỡng 70% đặt thành thiết lập có kiểm soát** (có phiên bản, lý do thay đổi, Audit Trail), mặc định 70.
- Không đạt: tự tạo **hoạt động đào tạo lại** (loại `RETRAINING`) tham chiếu mã gốc, đánh dấu học viên "Failed, retraining required"; **cờ "tạm ngừng việc liên quan"** hiển thị cho trưởng đơn vị và có thể chặn bản giao việc (D-12).
- Vắng: người dùng ghi **Absent**; hệ thống tạo danh sách bổ sung với **hậu tố mã a, b, c** và dòng mới trong sổ mã.
- Ngân hàng câu hỏi và làm bài trực tiếp trên máy **không có trong SOP** (SOP dùng giấy, học viên ký tay). Đề xuất **không làm ở giai đoạn đầu**; chỉ lưu bài kiểm tra (file hoặc scan) và kết quả. Nếu muốn làm bài trên máy, cần quyết định riêng (D-13).
- Hạn 7 ngày làm việc để nộp kết quả cho QA, và hạn trong ngày với tài liệu mới: nhắc và báo quá hạn. **Ngày làm việc** cần lịch làm việc của nhà máy (hệ thống có Calendar; D-14).

### 5.9 Bản giao việc (SOP 5.3.8, APD.0024)

**SOP.** Trưởng đơn vị lập bản giao việc **khi nhân viên đã hoàn thành tất cả nội dung trong ma trận cho vị trí tương ứng**; cập nhật khi giao việc mới. Nêu rõ **mô tả vị trí, quyền hạn, trách nhiệm và mô tả công việc**; nhân viên và trưởng đơn vị **ký** để chính thức giao việc. APD.0024 có hai trường hợp: **bổ nhiệm lần đầu** và **thay đổi hoặc bổ sung vị trí** (hai bảng riêng), ghi "đã hoàn thiện đào tạo theo ma trận (mã và phiên bản)", **số lần ban hành**, bộ phận, vị trí, cấp trên, cấp dưới, người thay thế khi vắng; chữ ký người giao (trưởng đơn vị, hoặc chức danh người giao khi người nhận là trưởng đơn vị, QM, QP) và người nhận.

**ĐỀ XUẤT.**
- Bản giao việc là hồ sơ có chữ ký điện tử của hai người; **điều kiện lập: hoàn thành đủ ma trận của vị trí**, do máy chủ kiểm tra từ hồ sơ đào tạo (mục 9). Khi chưa đủ, hiển thị danh sách mục còn thiếu; cho phép lập kèm ngoại lệ có lý do nếu D-15 chốt như vậy.
- **Số lần ban hành** tự tăng; bản cũ giữ lại.
- Sau khi giao việc, nhân viên mới được xem là có thể làm **độc lập** ở vị trí đó (SOP 5.1: trưởng đơn vị bảo đảm đào tạo phù hợp trước khi giao hoạt động độc lập). Hệ thống hiển thị trạng thái này, **không** chặn các module khác ở giai đoạn đầu (tích hợp chặn là mục 14, rủi ro).

### 5.10 Chữ ký mẫu của nhân viên (SOP 5.3.9, FRM.0007)

**SOP.** Khi có nhân viên mới hoặc nhân viên đổi chữ ký, đơn vị thu **chữ ký mẫu**. Yêu cầu: chữ ký **duy nhất tại mỗi thời điểm** và không giả mạo được; thay đổi phải **được phê duyệt trước khi áp dụng**; **không chỉ là viết tên**; trưởng đơn vị xác nhận chữ ký nhân sự của mình. Biểu mẫu: chữ ký ban đầu (ngày, chữ ký lần 1, lần 2, trưởng đơn vị) và các lần thay đổi đánh số.

**ĐỀ XUẤT.** Chức năng này **liên quan đến chữ ký điện tử của hệ thống**, đã có (xác thực lại bằng mật khẩu khi ký). Chữ ký mẫu vẫn là **chữ ký tay trên giấy/ảnh** dùng cho hồ sơ giấy. Đề xuất: lưu **ảnh quét chữ ký mẫu** làm tệp có kiểm soát, theo nhân viên, nhiều phiên bản, mỗi phiên bản có: ngày hiệu lực, người xác nhận (trưởng đơn vị), trạng thái Pending, Approved, Superseded; **chỉ một phiên bản Approved tại một thời điểm**. Đây là phần **ít rủi ro và có thể làm sau** (D-16: SOP cần giữ chữ ký mẫu tay hay đã thay bằng chữ ký điện tử?).

### 5.11 Hồ sơ đào tạo cá nhân (SOP 5.3.10, APD.0014)

**SOP.** QA quản lý hồ sơ từng nhân viên theo APD.0014, **cập nhật liên tục** và gửi bản mềm cho đơn vị quản lý; **in hằng năm hoặc khi có yêu cầu**; **hồ sơ cũ giữ cùng hồ sơ mới**; **lưu ít nhất 10 năm kể từ khi nhân viên không còn làm việc tại công ty**. Nơi lưu: bản gốc ở QA; bản sao cho đơn vị quản lý với FRM.0007, APD.0024, APD.0118; APD.0009, APD.0014, APD.0108, APD.0117 chỉ lưu bản gốc ở QA. Trưởng đơn vị xem được hồ sơ nhân viên của mình. APD.0014: thông tin nhân sự (họ tên, trình độ, ngày vào công ty); **lịch sử đào tạo** (nội dung, ngày, **mã đào tạo**); với SOP có thể chỉ ghi **mã SOP và số phiên bản**; ký bởi người chuẩn bị và trưởng phòng QA.

**ĐỀ XUẤT.**
- Hồ sơ cá nhân **không nhập tay**: là **kết quả tổng hợp** từ các hoạt động đã hoàn thành (một dòng cho mỗi chủ đề đã đạt, có mã đào tạo, ngày, hình thức, kết quả, mã và phiên bản SOP). Bản mới không ghi đè bản cũ.
- **Xuất PDF** theo mẫu APD.0014 theo yêu cầu và hằng năm, ký bởi người chuẩn bị và Trưởng phòng QA bằng chữ ký điện tử; mỗi lần xuất là một bản được lưu (không sửa) kèm checksum.
- **Phạm vi xem:** học viên xem hồ sơ của mình; trưởng đơn vị xem nhân viên đơn vị mình; QA xem tất cả; có Audit Trail cho việc xem và xuất (hồ sơ có dữ liệu cá nhân).
- **Lưu trữ 10 năm sau khi nghỉ việc:** hồ sơ không bị xóa; khi người dùng bị vô hiệu hóa hoặc nghỉ việc, ghi **ngày nghỉ** và tính ngày hết hạn lưu; **không có hành động xóa** trong phạm vi hạn; sau hạn chỉ hủy theo quy trình riêng có phê duyệt (D-17). Phù hợp quy ước của hệ thống: không xóa bản ghi GMP.

### 5.12 Chuyển vị trí làm việc (SOP 5.3.11)

**SOP.**
- **Chuyển bộ phận nội bộ:** trưởng bộ phận tiếp nhận và nhân viên được phân công rà soát hồ sơ đào tạo hiện có để xác định đào tạo bổ sung; nhân viên được phân công tổ chức **đào tạo chuyên môn** phù hợp nhiệm vụ mới.
- **Chuyển địa điểm hoặc cơ sở:** trưởng bộ phận cũ gửi **bản sao hồ sơ đào tạo** cho nơi mới; nhân viên được đào tạo theo quy trình dành cho nhân viên mới ở nơi mới.

**ĐỀ XUẤT.** Khi vị trí hoặc bộ phận của người dùng đổi (sự kiện từ quản lý người dùng): hệ thống **tính khoảng trống** giữa hồ sơ đào tạo hiện có và ma trận của vị trí mới, tạo **danh sách việc cần đào tạo bổ sung** (do con người xác nhận, không tự gán), và nhắc lập bản giao việc mới. Chuyển cơ sở: xuất **bản sao hồ sơ** có chữ ký và ghi vào Audit Trail.

**Theo lưu đồ (mục 5.0):** điều chuyển còn **sinh ra đào tạo ban đầu**: lệnh "tạo đào tạo từ điều chuyển" tạo một hoạt động loại `INITIAL` (lý do `TRANSFER`) cho người đó, với danh sách chủ đề là khoảng trống ma trận đã được người có quyền xác nhận; sau đó vào luồng thông thường (cấp mã, danh sách, nội dung, đánh giá) và bản giao việc mới (APD.0024, trường hợp thay đổi vị trí). Trong dữ liệu chưa thấy khái niệm nhiều cơ sở (cần xác nhận); chuyển cơ sở cần xác nhận có cần làm ngay không (D-18).

---

## 6 Danh mục quy tắc nghiệp vụ (kiểm thử được)

| Mã | Quy tắc | Nguồn |
|---|---|---|
| TR-01 | Mỗi hoạt động đào tạo có mã duy nhất `TRN/<mã phòng ban>/<YY>-<XXX>`; XXX tăng dần theo (phòng ban, năm); không dùng lại | 5.1.4 |
| TR-02 | Đào tạo bổ sung cho người vắng dùng **mã gốc + hậu tố chữ cái a, b, c**; mỗi đợt bổ sung là một dòng riêng trong sổ mã | 5.1.4, 5.3.7 |
| TR-03 | Một mã có thể có nhiều chủ đề (cùng đơn vị tổ chức) hoặc một chủ đề với nhiều session | 5.1.4 |
| TR-04 | Dời lịch buổi đào tạo giữ nguyên mã; lý do ghi vào ghi chú của sổ mã | 5.3.3 |
| TR-05 | Cấp mã: QA cho đào tạo ban đầu và định kỳ; bộ phận phát sinh nhu cầu cho đột xuất và bên ngoài | 5.3.3 |
| TR-06 | Yêu cầu đào tạo chỉ dành cho định kỳ hằng năm và định kỳ tài liệu sau rà soát | 5.3.2 |
| TR-07 | Yêu cầu năm sau phải được duyệt trước 31/12 | 5.3.2 |
| TR-08 | Yêu cầu định kỳ tài liệu phải được lập và duyệt chậm nhất vào ngày cuối của tháng hoàn thành rà soát | 5.3.2 |
| TR-09 | Chủ đề không xong trong tháng đăng ký phải dời sang tháng ngay sau | 5.3.6 |
| TR-10 | Tài liệu mới hoặc nâng phiên bản nên được đào tạo xong trong 10 ngày kể từ ngày phê duyệt | 5.1.3 |
| TR-11 | Danh sách người tham gia gửi cho người tham gia trước buổi đào tạo; gồm cả người đang vắng | 5.3.4 |
| TR-12 | Với tài liệu mới hoặc nâng phiên bản, danh sách tham gia gửi QA **trong ngày đào tạo** | 5.3.6 |
| TR-13 | Kết quả đánh giá gửi QA trong **7 ngày làm việc** | 5.3.7 |
| TR-14 | Bài kiểm tra đạt khi ≥ 70% tổng điểm; không đạt thì đào tạo lại | 5.3.7, APD.0009 |
| TR-15 | Học viên không đạt lần đầu: tạm ngừng việc liên quan; đào tạo lại được ghi trong bài kiểm tra | 5.3.7 |
| TR-16 | Tự đọc: nhân viên ký APD.0108; trưởng phòng xác nhận; QA ghi vào hồ sơ cá nhân | 5.1.2, 5.3.7 |
| TR-17 | Hybrid: học viên trực tuyến được ghi "Trực tuyến" ở cột Ký tên | 5.3.7 |
| TR-18 | Người vắng được ghi "Vắng mặt" ở danh sách gốc và phải được bố trí đào tạo lại | 5.3.7 |
| TR-19 | Giảng viên: đào tạo GMP, đào tạo chuyên môn liên quan; hoặc là người soạn, kiểm tra, duyệt, trưởng bộ phận, giám sát đã được đào tạo SOP | 5.1 |
| TR-20 | Người ký tài liệu được coi là đã đào tạo ban đầu về tài liệu đó | 5.1 |
| TR-21 | Chỉ dùng tài liệu đã duyệt; nội dung từ thay đổi hoặc CAPA dùng bản đã phê duyệt | 5.3.5 |
| TR-22 | Nội dung đào tạo và bài kiểm tra do Trưởng đơn vị liên quan và Trưởng phòng QA xem xét, phê duyệt | 5.3.5 |
| TR-23 | Bản giao việc chỉ lập khi đã hoàn thành mọi mục trong ma trận của vị trí | 5.3.8 |
| TR-24 | Bản giao việc được cập nhật khi có công việc mới; cần chữ ký của nhân viên và trưởng đơn vị | 5.3.8 |
| TR-25 | Chữ ký mẫu: duy nhất, không chỉ viết tên, thay đổi phải duyệt trước khi dùng | 5.3.9 |
| TR-26 | Hồ sơ đào tạo cũ giữ cùng hồ sơ mới; lưu ≥ 10 năm sau khi nhân viên nghỉ | 5.3.10 |
| TR-27 | Đơn vị soạn tài liệu đào tạo tài liệu ở lần ban hành đầu (v01); sau đó trưởng đơn vị liên quan đào tạo cho đơn vị mình | 5.3.6 |
| TR-28 | Ma trận phải cập nhật khi đổi mô tả công việc, sau rà soát hằng năm, hoặc khi ban hành mới tài liệu cấp 1, 2, 3 | 5.3.1 |
| TR-29 | Tài liệu cấp 4, và thay đổi chỉ biên tập được xác nhận trong kiểm soát thay đổi, có thể không cần đào tạo | 5.3.1 |
| TR-30 | Nhân viên vắng trên 6 tháng hoặc khi thấy cần: đào tạo lại | 5.1 |
| TR-31 | Mọi nhân viên phải được đào tạo về lĩnh vực của mình trước khi bắt đầu công việc | 5.1 |

---

## 7 Mô hình dữ liệu đề xuất

Tên bảng là đề xuất; số migration cấp sau khi kiểm tra đầu migration hiện tại (hiện V593). Mọi bảng: UUID, thời gian UTC, người thực hiện, phiên bản lạc quan khi sửa được; **không xóa bản ghi GMP** (hủy hoặc thay thế, giữ lịch sử).

| Nhóm | Bảng | Vai trò |
|---|---|---|
| Danh mục | `training_positions` | Danh mục vị trí công việc (bộ phận, tên, bật tắt); thay cho cột `position` dạng chữ |
| | `training_topics` | Chủ đề đào tạo chuẩn (chung toàn nhà máy, chung theo bộ phận) |
| | `training_settings` (một dòng) | Ngưỡng đạt (70), hạn 10 ngày, hạn 7 ngày làm việc, hạn năm sau 31/12, năm bắt đầu; có phiên bản và Audit |
| Ma trận | `training_matrices`, `training_matrix_versions` | Ma trận theo bộ phận; phiên bản Draft, Pending, Effective, Obsoleted; chữ ký |
| | `training_matrix_rows`, `training_matrix_cells` | Dòng (chủ đề hoặc SOP), ô (vị trí × dòng), cờ "Annual training required" |
| Yêu cầu | `training_requirements`, `training_requirement_lines` | Phiếu APD.0118 (năm, số, loại) và dòng (tháng, chủ đề, liên kết hoạt động) |
| Hoạt động | `training_activities` | Mã đào tạo, loại (Initial, Periodic, Unplanned, Retraining, External), đơn vị tổ chức, trạng thái (Reserved, Open, In Progress, Assessment, Completed, Cancelled), hạn; **liên kết tùy chọn tới revision của tài liệu** (khóa revision, số revision, checksum; duy nhất cho hoạt động chưa hủy của một revision) |
| | `training_activity_sequences` | Bộ đếm theo (phòng ban, năm) |
| | `training_number_log` (view hoặc bảng) | Sổ mã (FRM.0044): mỗi lần cấp mã một dòng |
| | `training_sessions` | Session: chủ đề, hình thức, giảng viên, ngày, địa điểm, trạng thái |
| | `training_session_topics` | Chủ đề / SOP (mã + phiên bản tài liệu nguồn) |
| | `training_participants` | Người tham gia theo session: danh sách, mặt, trực tuyến, vắng, kết quả |
| | `training_assessments` | Bài đánh giá: loại, điểm, tỉ lệ, kết quả, lần thứ, người đánh giá; tệp bài làm |
| | `training_materials` | Tài liệu đào tạo ghim theo hoạt động (checksum), trạng thái duyệt |
| | `training_self_reading` | Xác nhận tự đọc (APD.0108), người xác nhận |
| Hồ sơ | `training_records` | Dòng hồ sơ cá nhân **bất biến** tạo khi hoàn thành |
| | `training_record_exports` | Mỗi lần xuất PDF APD.0014 (checksum, chữ ký) |
| | `training_job_assignments` | Bản giao việc (lần ban hành, trường hợp, vị trí, chữ ký hai người) |
| | `training_specimen_signatures` | Chữ ký mẫu, phiên bản, xác nhận |
| Tài liệu | `training_document_impacts` | Đánh giá tác động đào tạo của một revision (cần đào tạo / không cần, lý do, người, vị trí liên quan) |
| Vận hành | `training_events` (append-only) | Sự kiện nghiệp vụ; Audit Trail dùng chung vẫn ghi mọi thay đổi |

**Điểm thiết kế quan trọng:**
- `training_records` do **máy chủ tạo** khi hoạt động hoàn thành và người tham gia đạt; **không có API nhập tay** ở giai đoạn đầu (nhập dữ liệu lịch sử qua đường riêng, mục 12 T6).
- Ma trận hiệu lực **tại thời điểm giao việc** được ghi lại (mã và phiên bản ma trận) để bản giao việc truy xuất được.
- Liên kết tài liệu bằng **khóa tài liệu + số revision + checksum** (không sao chép nội dung), phù hợp nguyên tắc trong `TRAINING_MODULE_MASTER_PLAN.md`.

---

## 8 Phối hợp Document Control và Training Management

Hai module **độc lập** (Training chạy được khi không có tài liệu: đào tạo ban đầu, hằng năm, khách tham quan, bên ngoài; Document Control chạy được khi Training tắt) nhưng **phối hợp qua một cổng hẹp** (mục 8.5). Nguyên tắc: Document Control sở hữu tài liệu và revision; Training sở hữu hoạt động đào tạo, mã đào tạo, người tham gia và hồ sơ. Mỗi bên chỉ lưu khóa tham chiếu và ảnh chụp bên kia, không sửa dữ liệu của nhau.

### 8.1 Hiện trạng của Document Control (KIỂM TRA MÃ)

| Phần | Hiện trạng | Nguồn |
|---|---|---|
| Tạo tài liệu | Có tab **Training Information** (`TrainingTab.tsx` trong `NewDocumentView.tsx`). Ô **"Requires Training?"**. Chọn Có: bắt buộc nhập **Training Period (Days)** (số ngày, không có mặc định). Chọn Không: bắt buộc **"Reason for skipping training"** (văn bản tự do). **Tài liệu mẫu (template) không có tab này.** | `TrainingTab.tsx`, `NewDocumentView.tsx` |
| Lưu dữ liệu | Ở cấp tài liệu và sao chép sang revision: `requires_training`, `training_period_days`, `reason_for_skipping_training`. Đổi các giá trị này được ghi vào Audit Trail ("Requires Training", "Training Period (Days)", "Reason for Skipping Training"). | `DocumentService`, `DocumentRevisionRecord` |
| Luồng revision | Sau khi duyệt, nếu `requires_training` thì sang **PENDING_TRAINING**, nếu không thì sang READY_FOR_PUBLISHING. | `RevisionService` |
| Hoàn thành đào tạo | Hành động `completeTraining`: cần quyền `documents.training.complete` hoặc `documents.training.manage` (hoặc `training.material.manage`), **chữ ký điện tử** (ý nghĩa `TRAINING_CONFIRMED`). Người dùng **nhập tay** ngày dự kiến đào tạo và ngày hoàn thành; hệ thống tính ngày kết thúc = ngày dự kiến + số ngày; rồi sang READY_FOR_PUBLISHING. | `RevisionService.completeTraining`, `TrainingAuthorizationService` |
| Tab đào tạo của revision | `TrainingInformationTab` / `RevisionTrainingView`: ngày dự kiến, ngày kết thúc, ngày hoàn thành, số ngày. | `RevisionTrainingView.tsx` |
| Nơi khác dùng ngày đào tạo | Lịch (Calendar) hiển thị ngày hoàn thành đào tạo; mẫu email và placeholder xuất bản có `trainingCompletionDate`. | `CalendarSourceRepository`, `EmailNotificationService` |
| Liên kết sang Training | **Không có.** Không có mã đào tạo, không có hoạt động đào tạo nào được tạo; "đào tạo xong" chỉ là người có quyền nhập ngày và ký. | |

### 8.2 Kịch bản đích

Theo ví dụ của chủ dự án: khi tạo tài liệu, người dùng tick **Requires Training?** ở tab Training Information thì **Training Number xuất hiện, sinh tự động**, đồng thời **thông tin đào tạo được tạo và cập nhật ở Training Management**.

| Bước | Người dùng làm gì | Document Control | Training Management |
|---|---|---|---|
| 1 | Tạo tài liệu; mở tab **Training Information**; tick **Requires Training?** | Hiện **Training Period (Days)** (mặc định 10, theo SOP 5.1.3; sửa được) và ô **Training Number** **chỉ đọc**, **để trống cho đến khi lưu thành công** | |
| 2 | Lưu tài liệu (lần lưu đầu có Requires Training = Có) | Gọi cổng `reserveTrainingNumber` **trong cùng giao dịch lưu**; nhận mã **của revision đang soạn**, ví dụ `TRN/QA/26-014`; mã hiện (chỉ đọc) ở tab, ở chi tiết revision; ghi Audit Trail "Training Number assigned" | Tạo **Hoạt động đào tạo** trạng thái *Reserved* (chờ tài liệu được duyệt), loại *Đào tạo đột xuất* (ban hành hoặc sửa tài liệu, SOP mục 4 và 5.1), **đơn vị tổ chức = bộ phận của tài liệu** (SOP 5.3.3), chủ đề = tài liệu (mã + revision); thêm một dòng vào **Sổ mã đào tạo** của bộ phận; tạo một việc trong hàng **Document Training Impact** |
| 3 | (Người của Training, song song) | | Trưởng đơn vị liên quan và các bộ phận liên quan **đánh giá tác động đào tạo**: chọn **vị trí công việc** cần đào tạo, **cập nhật ma trận** nếu cần (SOP 5.3.1), chọn hình thức đào tạo dự kiến, giảng viên |
| 4 | Trình xem xét và duyệt như hiện nay | Không đổi | Hoạt động vẫn *Reserved*; người tham gia dự kiến hiện ra từ ma trận |
| 5 | Phê duyệt xong; revision sang **PENDING_TRAINING** | Gọi cổng `onRevisionApproved(revision, ngày duyệt)` | Hoạt động chuyển *Open*; **hạn = ngày duyệt + Training Period**; thông báo cho đơn vị tổ chức, giảng viên, danh sách tham gia; hiện trong My Training của học viên |
| 6 | | Hiển thị **trạng thái hoạt động thật** (Open, In progress, Assessment, Completed) và tiến độ (đã đào tạo / cần đào tạo) bằng cách **đọc từ Training**; ngày chỉ đọc | Tổ chức buổi, danh sách tham gia, ký, đánh giá, đào tạo lại, người vắng và bổ sung (mục 5.4 đến 5.8) |
| 7 | DCO-QA xác nhận hoàn thành hoạt động (APD.0117 mục 6) | Gọi cổng `onTrainingCompleted`: ghi **ngày dự kiến, ngày kết thúc, ngày hoàn thành** vào revision (chỉ đọc với người dùng); nút **Complete Training** hiện **bật** | Hoạt động *Completed*; hồ sơ cá nhân của người đạt được tạo |
| 8 | Người có quyền bấm **Complete Training**, ký điện tử | Chuyển READY_FOR_PUBLISHING như hiện nay; **không còn nhập tay ngày** | |
| 9 | Phát hành tài liệu có hiệu lực | Không đổi | Hoạt động đã đóng; truy vết hai chiều giữ nguyên |

**Quyết định của chủ dự án (2026-10-15), đã áp dụng ở bảng trên và mục 8.3:**
- **D-23.** Training Number **hiển thị chỉ đọc, và chỉ có mã sau khi lưu thành công.** Mã cấp cho **revision**, không cho Document: mỗi lần Upgrade là một revision mới, có thể phải đào tạo lại, nên có mã mới.
- **D-24.** Bỏ tick khi revision đã có mã: hiện **hộp xác nhận**; sau khi xác nhận mã sẽ bị hủy, và người dùng **lưu lại một lần nữa** để áp dụng thay đổi.
- **D-25.** Upgrade: **vẫn đào tạo** (mang giá trị Requires Training sang revision mới). Hình thức đào tạo quy định trong module Training, không nhập ở Document Control.
- **D-26.** Không cần đào tạo: người dùng **không tick** Requires Training; việc dựa vào tài liệu thế nào do người dùng tự quyết định. Không làm nhóm lý do; ô lý do (văn bản tự do) giữ như hiện nay.
- **D-29.** Hoàn thành đào tạo **vẫn cần chữ ký điện tử** như luồng hiện tại.
- **D-30.** Ngày hiệu lực dùng cấu hình sẵn có ở **Document Properties** (mục 8.7).
- **"Cập nhật ở Training Management"** nghĩa là: tạo hoạt động ở bước 2 và cập nhật khi revision đổi (mục 8.3).

### 8.3 Các tình huống phải xử lý

| Tình huống | Kết quả (ĐỀ XUẤT) |
|---|---|
| Bỏ tick **trước khi lưu** (chưa có mã) | Không có gì được tạo |
| Bỏ tick **khi revision đã có mã** (còn Draft) | Hiện **hộp xác nhận** nêu mã sắp bị hủy. Sau khi xác nhận, giao diện bỏ tick và **chưa đổi gì ở máy chủ**; khi người dùng **lưu**, hoạt động chuyển *Cancelled*, **mã không dùng lại**, dòng sổ mã còn lại với trạng thái Cancelled, Audit Trail ghi hủy mã (D-24). Nếu người dùng **tick lại trước khi lưu** thì mã giữ nguyên, không đổi gì. Tick lại **sau khi đã lưu** thì lần lưu kế tiếp cấp mã **mới**. |
| Đổi **Training Period** khi tài liệu chưa duyệt | Cập nhật hạn dự kiến của hoạt động; ghi Audit Trail cả hai bên |
| Đổi **Training Period** sau khi đã duyệt | Chỉ người có quyền Training, có lý do và Audit Trail; hạn tính lại từ ngày duyệt |
| Tài liệu **trả về Draft** hoặc bị từ chối | Hoạt động trở lại *Reserved*; đồng hồ 10 ngày dừng |
| Tài liệu **hủy** hoặc revision bị hủy trước khi có hiệu lực | Hoạt động *Cancelled* kèm lý do; mã giữ trong sổ |
| Tài liệu bị **Obsolete** sau khi đã đào tạo | Hoạt động đã đóng không đổi; hồ sơ đào tạo giữ nguyên (mục 5.11) |
| **Upgrade revision** (tài liệu đã có hiệu lực) | Revision mới **mang giá trị Requires Training sang**; mã **mới** được cấp khi revision mới được lưu lần đầu; hình thức đào tạo do module Training quy định (D-25) |
| **Không cần đào tạo** | Người dùng **không tick**; ô "Reason for skipping training" (văn bản tự do) giữ như hiện nay; Training **không** tham gia và không ghi lại gì (D-26). Việc quyết định dựa vào tài liệu (cấp, mức thay đổi) là của người dùng. |
| **Tài liệu mẫu** (template) | Không có đào tạo, như hiện nay |
| **Nhập tài liệu cũ** (`LegacyImportView`, có ngày hoàn thành đào tạo) | Không cấp mã, không tạo hoạt động; xem đề xuất mục 8.8 (D-27) |
| Người dùng tài liệu **không có quyền Training** | Vẫn tick được và thấy mã, trạng thái chỉ đọc; không mở được màn hình Training. Chuyển sang Training chỉ khi có quyền. |
| **Training bị tắt** (cờ tính năng) hoặc lỗi cổng | Xem đề xuất mục 8.8 (D-28); không bao giờ lưu nửa vời: hoặc cả mã và hoạt động, hoặc không có gì |
| **Ngày hiệu lực** của tài liệu cần đào tạo | Theo cấu hình Document Properties (mục 8.7) |
| **Nhiều người lưu cùng lúc** cùng bộ phận | Bộ đếm theo (bộ phận, năm) khóa dòng; không trùng; có kiểm thử đồng thời |
| **Một tài liệu cần nhiều bộ phận đào tạo** (SOP 5.3.6: bộ phận soạn đào tạo cho mình và các bộ phận liên quan ở lần ban hành đầu) | **Một mã**, nhiều **session theo bộ phận** (SOP 5.1.4 cho phép một mã có nhiều session); bộ phận của tài liệu là đơn vị tổ chức |

### 8.4 Thay đổi cần làm bên Document Control

| Chỗ | Thay đổi |
|---|---|
| Tab **Training Information** khi tạo tài liệu (`TrainingTab.tsx`) | Thêm **Training Number** (chỉ đọc, để trống đến khi lưu thành công), liên kết "Open in Training Management" (nếu có quyền), trạng thái hoạt động; **Training Period mặc định 10**; **hộp xác nhận khi bỏ tick** một revision đã có mã; giữ ô lý do văn bản tự do như hiện nay |
| Tab đào tạo của revision (`TrainingInformationTab`, `RevisionTrainingView`) | Ngày dự kiến, ngày kết thúc, ngày hoàn thành **chỉ đọc** (do Training ghi); thêm mã đào tạo, trạng thái, tiến độ; nút **Complete Training** chỉ bật khi hoạt động *Completed* |
| Danh sách tài liệu | Cột và bộ lọc **Training Number** và **Training Status** (theo quy ước server-side) |
| `RevisionService.completeTraining` | Bỏ nhập tay ngày; kiểm tra hoạt động đã *Completed* qua cổng; vẫn yêu cầu chữ ký điện tử `TRAINING_CONFIRMED` |
| Dữ liệu | Thêm vào revision: tham chiếu hoạt động đào tạo (khóa) và mã đào tạo (chuỗi hiển thị); giữ các cột ngày hiện có |
| Quyền | `documents.training.manage` và `documents.training.complete` giữ nguyên; thêm kiểm tra quyền Training khi mở sang module Training |
| Lịch, email, placeholder | Tiếp tục đọc các ngày từ revision (nay do Training ghi); thêm `trainingNumber` vào placeholder |

### 8.5 Cổng giữa hai module (hợp đồng)

Trong một ứng dụng, cổng là **một giao diện (interface) Java** do Document Control định nghĩa và Training thực hiện (Document Control không import lớp của Training):

| Thao tác | Gọi khi | Đồng bộ? | Kết quả |
|---|---|---|---|
| `reserveTrainingNumber(revision, người, kỳ hạn ngày)` | Lưu tài liệu hoặc revision có Requires Training | **Đồng bộ, cùng giao dịch** | Mã đào tạo, mã hoạt động; **idempotent theo revision** (gọi lại trả cùng mã; ràng buộc duy nhất cho hoạt động chưa hủy của một revision) |
| `updateTrainingPlan(revision, kỳ hạn ngày)` | Đổi Training Period | Đồng bộ | Cập nhật hạn |
| `releaseTrainingNumber(revision, lý do)` | Bỏ tick, hủy tài liệu, trả về Draft theo quy tắc 8.3 | Đồng bộ | Hoạt động Cancelled hoặc Reserved |
| `onRevisionApproved(revision, ngày duyệt)` | Revision chuyển PENDING_TRAINING | Sự kiện (outbox, xử lý lặp an toàn) | Mở hoạt động, tính hạn, gửi thông báo |
| `getTrainingStatus(revision)` | Mở tab đào tạo, danh sách | Đồng bộ, chỉ đọc | Trạng thái, tiến độ, ngày |
| `onTrainingCompleted(hoạt động)` | DCO-QA xác nhận | Sự kiện sang Document Control | Ghi ngày vào revision; bật Complete Training |

Mỗi thao tác ghi Audit Trail **ở cả hai bên** với cùng mã tương quan. Mã và hoạt động **không bao giờ bị xóa vật lý**. Kiểm thử bắt buộc: cấp mã đồng thời, gọi lặp, hủy rồi tick lại, giao dịch lui khi Training lỗi, quyền, lặp sự kiện.

### 8.6 Việc khác của SOP gắn với Document Control

| SOP | Việc | Ghi chú |
|---|---|---|
| 5.1: người ký tài liệu = đào tạo ban đầu về tài liệu đó | Khi revision được duyệt, tạo bản ghi đào tạo ban đầu cho người soạn, kiểm tra, duyệt (không cần buổi đào tạo) | Đọc danh sách từ luồng chữ ký của Document Control |
| 5.3.2: đào tạo định kỳ theo thời hạn rà soát | Gợi ý đưa tài liệu vào yêu cầu định kỳ khi rà soát xong | `periodic_review_cycle`, `review_date` đã có; cần sự kiện "rà soát hoàn thành" |
| 5.3.1: cấp tài liệu 1 đến 4 | Dùng để gợi ý "cần đào tạo hay không" | Hệ thống chưa có khái niệm cấp (D-03) |
| Bảng 5.1.2: hình thức theo mức thay đổi | Gợi ý tự đọc (thay đổi nhỏ, định kỳ) hoặc tập trung (tài liệu mới, ảnh hưởng luồng) | Cần biết mức thay đổi của revision |
| APD.0011: ma trận là tài liệu loại Training (TRN) | Quyết định D-02 | Hệ thống không có loại TRN |
| 5.3.5: chỉ dùng tài liệu đã duyệt | Chọn tài liệu nguồn ở chủ đề của buổi đào tạo: chỉ tài liệu hiệu lực | Truy vấn có phân quyền |

---

### 8.7 Ngày hiệu lực và ngày hoàn thành đào tạo (D-30)

**Cấu hình sẵn có (KIỂM TRA MÃ)** ở Document Properties, mục "Numbering & Effective Date", hai nhóm riêng:

| Nhóm tài liệu | Ngày hiệu lực được tính từ | Cộng thêm |
|---|---|---|
| **Có Requires Training** | Một trong: **After Approval** (người duyệt cuối hoàn thành), **After Training completion**, **After DCO Publish** | 0 đến 365 ngày |
| **Không Requires Training** | **After Approval** hoặc **After DCO Publish** (không có "After Training") | 0 đến 365 ngày |

Ngày hiệu lực được **chốt khi DCO phát hành**, theo quy tắc đang có hiệu lực lúc đó, và quy tắc đã dùng ghi vào Audit Trail. Nếu thiếu ngày hoàn thành đào tạo hoặc ngày duyệt thì lùi về ngày duyệt rồi ngày phát hành (`RevisionService`). Ngày hiệu lực có thể **sớm hơn** ngày phát hành.

**Hệ quả cho thiết kế (ĐỀ XUẤT, áp dụng quyết định D-30):**

1. **Giữ nguyên luồng:** revision phải qua PENDING_TRAINING (có chữ ký Complete Training) rồi mới READY_FOR_PUBLISHING. Việc chọn ngày hiệu lực nằm hoàn toàn ở Document Properties; **module Training không có cấu hình ngày hiệu lực riêng** và không quyết định ngày hiệu lực.
2. **Training chỉ cung cấp một dữ kiện:** ngày hoàn thành đào tạo của revision (`trainingCompletionDate`), thay cho việc nhập tay. Ba ngày ghi vào revision: ngày dự kiến (ngày mở hoạt động), ngày kết thúc (hạn = ngày duyệt cộng Training Period), ngày hoàn thành.
3. **Cách đáp ứng mục tiêu SOP "đào tạo trong 10 ngày kể từ ngày duyệt"** mà không viết thêm mã: Training Period mặc định 10 ngày ở bước tạo tài liệu (hạn đào tạo); và, tùy chính sách công ty, đặt cho nhóm "Có Requires Training" một trong hai: **After Training completion + 0 ngày** (hiệu lực khi đã đào tạo xong) hoặc **After Approval + 10 ngày** (hiệu lực sau 10 ngày kể từ ngày duyệt, đúng câu chữ SOP). Lựa chọn nào do QA quyết; hệ thống hỗ trợ cả hai.
4. **Hiển thị:** tab đào tạo của revision hiện **ngày hiệu lực dự kiến** theo quy tắc đang áp dụng khi đã biết ngày dùng để tính (hỗ trợ nhưng không bắt buộc ở giai đoạn đầu).

**D-31 (đã chốt, chủ dự án đồng ý 2026-10-15): "ngày hoàn thành đào tạo" của revision là ngày nào, khi còn người vắng.** SOP 5.3.7: người vắng được bố trí đào tạo bổ sung với **mã gốc cộng hậu tố a, b, c**, mỗi đợt là một dòng sổ riêng. Đề xuất: ngày hoàn thành của revision là **ngày DCO-QA xác nhận hoàn thành hoạt động gốc** (APD.0117 mục 6), khi mọi người **tham dự** đã có kết quả; người vắng **không chặn** việc phát hành nhưng **không được coi là đã đào tạo**: màn tuân thủ của Training nêu rõ ai chưa đào tạo tài liệu nào, và đợt bổ sung (a, b, c) hoàn thành sau đó **không đổi** ngày của revision. Lý do: nếu chờ người vắng (nghỉ thai sản, nghỉ dài) thì tài liệu không bao giờ có hiệu lực. Cần QA xác nhận.

### 8.8 Đề xuất giải pháp cho D-27 và D-28

**D-27: nhập tài liệu cũ (`LegacyImportView`).** Màn nhập tài liệu cũ đã có Training Information (kể cả ngày hoàn thành đào tạo lịch sử), và ràng buộc thứ tự ngày (duyệt, đào tạo, hiệu lực).
- **Không cấp Training Number và không tạo hoạt động** cho tài liệu nhập từ dữ liệu cũ: mã mới giả vờ là hồ sơ lịch sử sẽ là bản ghi không đúng sự thật.
- Revision nhập cũ mang dấu **`training_origin = LEGACY_IMPORT`**, giữ ngày hoàn thành đào tạo như đã nhập; ô Training Number hiện "Legacy import (no training number)".
- Training Management có một danh sách **Legacy training evidence** (chỉ đọc): tài liệu, revision, ngày hoàn thành, **người nhập**, ngày nhập, người xác nhận. QA có thể **đính kèm bản scan danh sách đào tạo gốc** và ghi "đã đối chiếu". Không có danh sách học viên (không biết ai đã được đào tạo), nên **không tạo hồ sơ đào tạo cá nhân** từ dữ liệu này.
- Nếu tài liệu cũ yêu cầu đào tạo nhưng **không có ngày** hoàn thành: đánh dấu **"Training not evidenced"** ở màn tuân thủ để QA xử lý, không tự điền.
- Việc nhập hồ sơ đào tạo cá nhân cũ (Excel APD.0014, sổ mã) là chuyện riêng ở giai đoạn T6, có nhãn và đối chiếu.

**D-28: Training tắt hoặc lỗi.** Hai trường hợp khác nhau:
- *Lỗi khi lưu* (ví dụ cơ sở dữ liệu): giao dịch **lui hoàn toàn**; người dùng thấy lỗi và lưu lại. **Không bao giờ tự rơi về chế độ nhập tay**, vì việc đó âm thầm bỏ qua kiểm soát.
- *Tắt có chủ đích:* một thiết lập có kiểm soát (dùng cơ chế cờ tính năng sẵn có, ví dụ `feat-training-integration`), tắt cần lý do và ghi Audit Trail. **Chế độ được ghi vào từng revision tại lần lưu đầu tiên có Requires Training** (`training_mode`: `INTEGRATED` hoặc `MANUAL`), nên đổi cờ **không đổi** revision đang mở:
  - revision `INTEGRATED` luôn hoàn thành qua Training, kể cả khi cờ sau đó tắt (Training vẫn chạy phần hoàn thành);
  - revision `MANUAL` (tạo khi cờ tắt, hoặc tồn tại trước khi Training chạy) tiếp tục nhập tay ngày và ký như hiện nay.
- **Chuyển giao:** khi bật lần đầu, các revision đang ở PENDING_TRAINING (chế độ MANUAL) **được giữ nguyên đến khi hoàn thành**; không chuyển ngang sang Training để tránh mất chứng cứ hoặc mã không đúng sự thật.
- **Chặn xung đột:** một revision không bao giờ có cả mã đào tạo lẫn ngày nhập tay; giao diện và máy chủ cùng kiểm tra.

---

## 9 Tuân thủ và báo cáo

**Câu hỏi nghiệp vụ mà hệ thống phải trả lời** (suy ra từ SOP):

1. Ai chưa được đào tạo chủ đề / SOP X mà ma trận yêu cầu? (theo vị trí, bộ phận)
2. Tài liệu mới nào quá 10 ngày chưa đào tạo xong, bộ phận nào?
3. Yêu cầu đào tạo hằng năm: chủ đề nào đã làm, chưa làm, dời?
4. Ai không đạt và đang chờ đào tạo lại; công việc nào đang tạm ngừng?
5. Nhân viên A đã hoàn thành ma trận vị trí B chưa, đủ điều kiện nhận giao việc chưa?
6. Ai vắng lâu (trên 6 tháng) cần đào tạo lại khi quay lại?
7. Hồ sơ nhân viên A: toàn bộ lịch sử đào tạo.
8. Sổ mã của bộ phận C năm Y.
9. Hạn nộp kết quả cho QA (trong ngày, 7 ngày làm việc): hoạt động nào quá hạn?

**Màn hình tuân thủ:** ma trận bao phủ (người × chủ đề, trạng thái), quá hạn, sắp đến hạn, theo bộ phận. Tính toán **ở máy chủ**, lọc, sắp xếp, phân trang phía máy chủ (quy ước dự án). Số liệu thật; lỗi hiển thị lỗi, không hiển thị 0 (quy ước đã có).

**Nhắc việc và thông báo** (dùng hệ thống thông báo sẵn có): lập danh sách trước đào tạo; tới hạn 10 ngày; hạn nộp kết quả; yêu cầu năm sau trước 31/12; cuối tháng rà soát tài liệu; chủ đề quá tháng cần dời.

---

## 10 Quyền và chữ ký điện tử (ĐỀ XUẤT)

**Quyền** (mới, tách thành từng hành động; gán qua Permission Set; kèm "phạm vi đối tượng": bản thân, bộ phận mình, mọi bộ phận):

`training.module.view` (đã có), `training.matrix.view|manage|approve`, `training.requirement.view|prepare|review|approve`, `training.code.allocate`, `training.activity.view|organize|conduct|close|cancel`, `training.content.approve`, `training.assessment.record`, `training.record.view|manage|export`, `training.job_assignment.view|manage`, `training.signature.view|manage|confirm`, `training.document_impact.manage`, `training.compliance.view`, `training.settings.view|manage`, `training.audit.view`.

Các quyền `training.material.manage`, `training.session.manage`, `training.assignment.manage`, `training.admin.*.view` đã có trong DB: cần **quyết định giữ, đổi tên hay bỏ** (D-19), không tự xóa.

**Tách nhiệm vụ (theo SOP):** người lập yêu cầu đào tạo khác người xem xét khác người duyệt; người lập ma trận không là người duy nhất duyệt chính ma trận đó; người đánh giá là giảng viên (không tự chấm cho chính mình); trưởng đơn vị xác nhận chữ ký của nhân viên mình.

**Chữ ký điện tử** (ĐỀ XUẤT; SOP yêu cầu chữ ký trên biểu mẫu, hệ thống thay bằng chữ ký điện tử sẵn có với ý nghĩa cụ thể):

| Hành động | Người ký | Ý nghĩa gợi ý |
|---|---|---|
| Gửi duyệt ma trận | Trưởng đơn vị | Matrix Prepared |
| Duyệt ma trận | Người có quyền duyệt ma trận (D-05), khác người lập | Matrix Approved |
| Lập, xem xét, duyệt yêu cầu đào tạo | Điều phối đào tạo, Trưởng phòng QA, QM | Requirement Prepared, Reviewed, Approved |
| Xác nhận danh sách trước đào tạo | Người chuẩn bị danh sách | Attendance List Verified |
| Người đào tạo xác nhận | Giảng viên (theo session) | Attendance Confirmed |
| Ký tham dự và ký bài kiểm tra | Học viên | Attended / Assessment Taken |
| Xác nhận tự đọc | Trưởng phòng | Self-reading Confirmed |
| Xác nhận hoàn thành | DCO-QA | Training Completed |
| Lập bản giao việc | Trưởng đơn vị và nhân viên | Job Assigned / Job Accepted |
| Duyệt chữ ký mẫu | Trưởng đơn vị | Specimen Signature Approved |
| Xuất hồ sơ cá nhân | Người chuẩn bị, Trưởng phòng QA | Record Prepared / Approved |

**Đã chốt (D-20): cả hai cách.** học viên ký điện tử khi tham dự hay vẫn ký tay trên bản in và QA nhập kết quả. SOP hiện cho học viên **ký tay** (bài kiểm tra có chữ ký trên mọi trang); một số trường hợp **không thể** ký điện tử (đào tạo thực hành ở khu sản xuất, không có máy). Đề xuất: **hỗ trợ cả hai**; nếu ký tay thì giữ **ảnh quét của bản đã ký** làm bằng chứng gốc, và người có quyền xác nhận đã nhận.

---

## 11 Giao diện

**Menu hiện có:** Training Management và Training Administration. Đề xuất cấu trúc theo SOP (tên màn hình giữ tiếng Anh):

| Màn hình | Người dùng chính | Nội dung | Ghi chú với mã hiện có |
|---|---|---|---|
| **My Training** | Mọi nhân viên | Việc cần làm: buổi sắp tới, danh sách đã được thêm, tự đọc chờ xác nhận; hồ sơ của mình | Dựa theo `my-training` |
| **Training Activities** (danh sách, chi tiết, tạo) | QA, trưởng đơn vị | Hoạt động theo mã; session; danh sách; đánh giá; trạng thái | Thay `course-inventory` (xem bên dưới) |
| **Training Number Log** | Bộ phận | Sổ mã FRM.0044, lọc theo bộ phận, năm | Mới |
| **Training Matrices** | Trưởng đơn vị, QA | Ma trận theo bộ phận; phiên bản; so sánh | Mới |
| **Training Requirements** | QA, QM | Yêu cầu năm và định kỳ tài liệu; dòng và liên kết hoạt động | Mới |
| **Document Training Impact** | QA, đơn vị | Tài liệu mới, hạn 10 ngày; đánh giá tác động | Mới; tab liên kết trong chi tiết revision |
| **Job Assignments** | Trưởng đơn vị | Bản giao việc; điều kiện đủ ma trận | Mới |
| **Training Records** (hồ sơ cá nhân) | QA, trưởng đơn vị | Hồ sơ theo nhân viên, xuất PDF | Thay `records-archive` |
| **Compliance** | QA, quản lý | Bao phủ, quá hạn, theo bộ phận | Dựa theo `compliance-tracking` |
| **Specimen Signatures** | Trưởng đơn vị | Chữ ký mẫu | Mới, ưu tiên thấp |
| **Training Administration** | Quản trị | Vị trí, chủ đề, thiết lập (ngưỡng 70%, hạn), thông báo | Dựa theo các màn admin hiện có |

**Về mã đã dựng:** các thư mục giao diện thử (`features/training/*`, `features/settings/training-administration/`) là bản tự dựng của chủ dự án theo mô hình khóa học, **không khớp** SOP (SOP không có "khóa học" mà có "chủ đề" và "hoạt động có mã"). **Kế hoạch này không dựa vào chúng.** Giao diện mới được dựng theo bảng trên, chỉ dùng lại các thành phần dùng chung của dự án (`DataTable`, `FilterDrawer`, `FormSection`, hộp thoại, chữ ký điện tử...). Mã thử cũ **xóa hẳn** khi mỗi màn mới thay xong (không để mã chết). Việc này làm `TRAINING_MODULE_MASTER_PLAN.md` lạc hướng ở phần miền nghiệp vụ; cần **một quyết định (D-01 phần 2)**.

Quy ước giao diện đã có cho dự án: giống hệt màn hình tương đương; tìm kiếm, lọc, sắp xếp, phân trang ở máy chủ; đáp ứng màn nhỏ; thanh breadcrumb và tiêu đề trang; bỏ hết mã bị thay thế.

---

## 12 Lộ trình triển khai

Mỗi giai đoạn là một thay đổi có kiểm soát: Decision Log, một hồ sơ thay đổi, kiểm thử có phủ định / đồng thời / lỗi, phân tích ảnh hưởng và `detect_changes` trước commit. Không bắt đầu giai đoạn sau khi giai đoạn trước chưa có bằng chứng.

### T0 (gói WP-0) — Nền kiểm định và dữ liệu nền (không viết mã chức năng)
- QA xác nhận các quyết định ở mục 13 (ghi tên người xác nhận vào Decision Log).
- URS từ quy tắc TR-01 đến TR-31 và các yêu cầu bảo mật, toàn vẹn dữ liệu, phối hợp Document Control.
- Đánh giá rủi ro và toàn vẹn dữ liệu; chiến lược kiểm thử; ma trận truy vết ban đầu.
- **Báo cáo dữ liệu nền** (chỉ đọc, DEV): mã bộ phận hợp lệ cho mã đào tạo; người dùng chưa có bộ phận; `app_users.position` không khớp `positions`; tài liệu và revision đang có `requires_training`; revision đang ở Pending Training (sẽ ở chế độ MANUAL); quyền `training.*` đang được ai giữ.
- Kiểm tra hạ tầng: quét virus, kho tệp, cờ tính năng, worker, thông báo; kế hoạch dọn mã thử; phân tích ảnh hưởng (GitNexus) cho các ký hiệu Document Control sẽ sửa.
- Chi tiết từng việc, sản phẩm và tiêu chí xong: SDS-TR-001 mục 15.1.
- **Kết quả:** hồ sơ WP-0 được QA ký; chủ dự án cho phép bắt đầu WP-1.

### T1 — Ma trận, Yêu cầu đào tạo, Mã đào tạo
- Bảng: `training_positions`, `training_topics`, `training_settings`, ma trận và phiên bản, yêu cầu, bộ đếm mã.
- Màn: Training Matrices, Training Requirements, Training Number Log (xem), quản trị (vị trí, chủ đề, thiết lập).
- Mã đào tạo do hệ thống cấp (TR-01 đến TR-05), gồm hậu tố a, b, c.
- Chữ ký: ma trận và yêu cầu.
- Nhắc việc: 31/12 và cuối tháng rà soát.
- **Tiêu chí xong:** tạo ma trận cho một bộ phận có hai phiên bản; lập và duyệt yêu cầu đào tạo năm; cấp 200 mã đồng thời không trùng (kiểm thử đồng thời); sổ mã in được theo bộ phận.

### T2 — Hoạt động đào tạo và hồ sơ đào tạo
- Hoạt động, session, danh sách, chữ ký (hai chế độ ký, D-20), đánh giá (câu hỏi và checklist, ngưỡng 70%), tự đọc, người vắng, đào tạo lại, bài kiểm tra tải lên.
- Hồ sơ đào tạo cá nhân tự động cho mỗi người đạt; xuất PDF APD.0117, APD.0108, APD.0009.
- **Tiêu chí xong:** chạy trọn một hoạt động có hai session và ba học viên (một vắng, một không đạt rồi đạt khi đào tạo lại); hồ sơ cá nhân đúng; không thể sửa hồ sơ đã tạo; có Audit Trail đầy đủ.

### T3a — Nối Document Control, phần 1 (số đào tạo và hoạt động; làm ngay sau T1)
- Cổng giữa hai module (mục 8.5): `reserveTrainingNumber`, `updateTrainingPlan`, `releaseTrainingNumber`, `getTrainingStatus`.
- Document Control: sửa tab **Training Information** khi tạo tài liệu (Training Number chỉ đọc và chỉ hiện sau khi lưu, mặc định 10 ngày, hộp xác nhận khi bỏ tick), tab đào tạo của revision (chỉ đọc), cột và bộ lọc Training Number và Training Status ở danh sách tài liệu.
- Mã đào tạo cấp **cho revision**; `training_mode` ghi vào revision (mục 8.8); tài liệu nhập cũ mang `LEGACY_IMPORT`.
- Training: hoạt động *Reserved* và dòng trong sổ mã được tạo tự động; hàng **Document Training Impact** (đánh giá tác động, chọn vị trí, cập nhật ma trận).
- Các tình huống 8.3 liên quan đến lưu, bỏ tick, trả về Draft, hủy.
- Cờ tính năng: Training tắt thì Document Control chạy như hiện nay.
- **Tiêu chí xong:** tick Requires Training, lưu, nhận mã `TRN/DC/YY-XXX` đúng quy tắc TR-01, thấy hoạt động và dòng sổ mã bên Training; bỏ tick (có hộp xác nhận) rồi lưu thì mã bị hủy và dòng sổ mã là Cancelled; tick lại rồi lưu cấp mã mới; tick rồi bỏ trước khi lưu không tạo gì; Upgrade revision cấp mã mới; 200 lần lưu đồng thời không trùng mã; Audit Trail đủ hai bên; không có quyền thì không thấy hoặc mở được màn Training.

### T3b — Nối Document Control, phần 2 (hoàn thành đào tạo; sau T2)
- `onRevisionApproved` mở hoạt động và tính hạn 10 ngày; thông báo và nhắc việc.
- `onTrainingCompleted` ghi ba ngày vào revision; **Complete Training** chỉ bật khi hoạt động *Completed*; bỏ nhập tay ngày.
- Người ký tài liệu được coi là đã đào tạo ban đầu (TR-20).
- Gợi ý yêu cầu định kỳ sau rà soát (TR-08).
- Kiểm tra với cấu hình ngày hiệu lực của Document Properties (After Training completion; After Approval cộng 10 ngày): ngày hiệu lực đúng theo quy tắc, quy tắc ghi vào Audit Trail.
- **Tiêu chí xong:** từ revision được duyệt đến hoạt động đào tạo, hoàn thành, ngày hiện ở revision, ký Complete Training và phát hành; ba trường hợp không cần đào tạo (cấp 4, biên tập, quyết định có lý do) đều được ghi bên Training.

### T4 — Bản giao việc, chữ ký mẫu, chuyển vị trí
- Bản giao việc có kiểm tra đủ ma trận; chữ ký mẫu; tính khoảng trống khi đổi vị trí; xuất bản sao hồ sơ.
- **Tiêu chí xong:** không lập được bản giao việc khi thiếu mục ma trận (trừ ngoại lệ đã được duyệt nếu D-15 cho phép); đổi vị trí tạo danh sách bổ sung đúng.

### T5 — Tuân thủ, nhắc việc, báo cáo, lưu trữ
- Màn Compliance; nhắc việc và thông báo; báo cáo; chính sách lưu 10 năm sau nghỉ việc; Report Type "Training" cho module báo cáo (nếu được yêu cầu làm tiếp).
- **Tiêu chí xong:** 9 câu hỏi ở mục 9 trả lời đúng trên dữ liệu thử; hiệu năng với dữ liệu ước tính của nhà máy.

### T6 — Nhập dữ liệu cũ, kiểm định, phát hành
- Nhập hồ sơ đào tạo hiện có (Excel APD.0014, sổ mã) vào bảng riêng có **nhãn "nhập từ dữ liệu cũ"**, có đối chiếu và người xác nhận; không nhập qua API thông thường.
- IQ/OQ/PQ theo hệ thống kiểm định của dự án; UAT với QA; huấn luyện người dùng (chính SOP.0003 sẽ được cập nhật khi chạy trên phần mềm).
- Cập nhật SOP.0003 và các biểu mẫu để phản ánh việc dùng phần mềm (**ngoài phạm vi phần mềm**, nhưng bắt buộc về mặt GMP).

**Gợi ý "bản dùng được sớm nhất" (MVP):** T1 + T2 cho **một bộ phận** (QA), dùng song song với giấy trong một thời gian; mở rộng bộ phận khác sau. Đề xuất, chờ chủ dự án.

---

## 13 Quyết định (đã chốt) và việc của QA

### 13.1 Danh mục quyết định

| # | Vấn đề | Quyết định | Nguồn quyết định |
|---|---|---|---|
| D-01 | Lưu đồ mục 5.2 và kế hoạch chung | Lưu đồ là ảnh đính kèm, đã đối chiếu (mục 5.0). Phần miền nghiệp vụ của `TRAINING_MODULE_MASTER_PLAN.md` được thay bằng PLAN-TR-001 và SDS-TR-001; giữ phần kiến trúc và kiểm định | Chủ dự án 2026-10-16 |
| D-02 | Ma trận đào tạo thuộc Document Control hay Training | **Dữ liệu của Training** (nhiều cuộc đào tạo không xuất phát từ tài liệu; lưu đồ xác nhận) | Chủ dự án 2026-10-16 |
| D-03 | Cấp tài liệu 1 đến 4 | Thuộc tính tùy chọn "Document Level (1-4)" của loại tài liệu, chỉ để gợi ý, không chặn; trống = chưa biết | Ủy quyền; QA xác nhận |
| D-04 | Ánh xạ người dùng đến vị trí | Khớp theo tên, không đoán; dòng không khớp vào báo cáo và màn Position Mapping để sửa tay; người chưa ánh xạ là "unmapped" | Ủy quyền; QA xác nhận |
| D-05 | Chuỗi duyệt ma trận | Người được chỉ định có quyền duyệt; khác người lập; không cấp cố định; áp dụng cả ma trận QA | Chủ dự án 2026-10-16 |
| D-06 | Đánh giá hình thức kết hợp trực tuyến | Như tập trung (APD.0009); người dự trực tuyến ghi ONLINE | Ủy quyền; QA xác nhận |
| D-07 | Hậu tố sau `z` | `aa`, `ab`, … | Ủy quyền; QA xác nhận |
| D-08 | Ai tạo và cấp mã đột xuất, bên ngoài | Quyền `training.activity.organize` theo bộ phận, gán cho bất kỳ ai; QA giữ thêm `training.code.allocate` cho ban đầu và định kỳ | Ủy quyền; QA xác nhận |
| D-09 | Người vắng có lý do | ABSENT kèm nhóm lý do; không tính đã đào tạo; sinh danh sách bổ sung a, b, c; không có trạng thái "được miễn" | Ủy quyền; QA xác nhận |
| D-10 | Giảng viên chưa đủ điều kiện | Chặn; ngoại lệ có lý do do người được chỉ định (`training.trainer.exception.approve`) duyệt | Ủy quyền; QA xác nhận |
| D-11 | Hạn 10 ngày | Cảnh báo và đánh dấu quá hạn, không chặn (chặn phát hành đã có ở Pending Training) | Ủy quyền; QA xác nhận |
| D-12 | "Tạm ngừng việc" khi không đạt | Cờ và thông báo cho trưởng đơn vị; không chặn hệ thống khác | Ủy quyền; QA xác nhận |
| D-13 | Làm bài trên máy, ngân hàng câu hỏi | Không làm ở giai đoạn đầu | Ủy quyền; QA xác nhận |
| D-14 | Ngày làm việc | Thứ Hai đến thứ Sáu trừ ngày trong bảng `training_non_working_days` do người có `training.settings.manage` quản lý | Ủy quyền; QA xác nhận |
| D-15 | Bản giao việc khi chưa đủ ma trận | Chặn; ngoại lệ có lý do do người được chỉ định duyệt; hiện trên bản giao việc và hồ sơ | Ủy quyền; QA xác nhận |
| D-16 | Chữ ký mẫu tay | Giữ ảnh scan, có người xác nhận được chỉ định; ưu tiên thấp (WP-8) | Ủy quyền; QA xác nhận |
| D-17 | Hủy hồ sơ sau 10 năm | Không xóa tự động; chỉ đánh dấu hết hạn lưu giữ; quy trình hủy riêng chưa xây | Ủy quyền; QA xác nhận |
| D-18 | Chuyển cơ sở | Chỉ xuất bản sao hồ sơ có chữ ký; chưa mô hình nhiều cơ sở | Ủy quyền; QA xác nhận |
| D-19 | Quyền `training.*` hiện có | Giữ tương thích, ánh xạ sang quyền mới, chỉ bỏ khi mọi chỗ dùng đã chuyển và QA xác nhận | Ủy quyền; QA xác nhận |
| D-20 | Ký điện tử hay ký tay | **Cả hai**; ký tay kèm bản scan gốc và người nhận xác nhận | Chủ dự án 2026-10-16 |
| D-21 | Khách tham quan, nhà thầu | Người ngoài không tài khoản; có mã đào tạo; không có hồ sơ cá nhân | Ủy quyền; QA xác nhận |
| D-22 | Ngôn ngữ giao diện | Nhãn giao diện tiếng Anh; biểu mẫu in song ngữ Việt và Anh | Ủy quyền; QA xác nhận |
| D-23 | Training Number: lúc hiện, cấp cho gì | Chỉ đọc, chỉ có mã sau khi lưu thành công; cấp cho **revision**; mỗi Upgrade là mã mới | Chủ dự án 2026-10-15 |
| D-24 | Bỏ tick khi đã có mã | Hộp xác nhận; mã bị hủy khi người dùng lưu lại; mã không dùng lại | Chủ dự án 2026-10-15 |
| D-25 | Upgrade revision | Mang Requires Training; hình thức đào tạo quy định trong Training | Chủ dự án 2026-10-15 |
| D-26 | "Không cần đào tạo" | Không tick là đủ; người dùng tự quyết định; không nhóm lý do | Chủ dự án 2026-10-15 |
| D-27 | Nhập tài liệu cũ | Không cấp mã, không tạo hoạt động; `LEGACY_IMPORT`; danh sách Legacy evidence; "Training not evidenced" khi thiếu ngày (mục 8.8) | Chủ dự án 2026-10-15 |
| D-28 | Training tắt hoặc lỗi | Lỗi thì lui giao dịch, không tự nhập tay; tắt có chủ đích bằng cờ có kiểm soát; mỗi revision ghi INTEGRATED hoặc MANUAL ở lần lưu đầu (mục 8.8) | Chủ dự án 2026-10-15 |
| D-29 | Hoàn thành đào tạo | Không tự chuyển revision; vẫn cần chữ ký điện tử như luồng hiện tại | Chủ dự án 2026-10-15 |
| D-30 | Ngày hiệu lực | Theo Document Properties (hai nhóm có và không Requires Training); Training chỉ cung cấp ngày hoàn thành (mục 8.7) | Chủ dự án 2026-10-15 |
| D-31 | Ngày hoàn thành khi có người vắng | Ngày người có quyền xác nhận hoạt động gốc; người vắng không chặn phát hành nhưng được nêu là chưa đào tạo; đợt a, b, c không đổi ngày của revision | Chủ dự án 2026-10-15 |
| D-32 | Duyệt nội dung đào tạo | Hai bước theo quyền: xem xét (`training.content.review`), duyệt (`training.content.approve`); người xử lý được chỉ định; QA thống nhất SOP hoặc lưu đồ (lưu đồ ghi Departments và QM, SOP ghi trưởng đơn vị liên quan và Trưởng phòng QA) | Ủy quyền; QA xác nhận |
| D-33 | Điều chuyển sinh đào tạo ban đầu | Người được chỉ định có quyền xác nhận danh sách chủ đề rồi tạo hoạt động INITIAL lý do TRANSFER; không tự gán | Ủy quyền; QA xác nhận |
| D-34 | Chỉ định người xử lý các bước phê duyệt | Theo phân quyền; người gửi chỉ định bất kỳ user đủ điều kiện; chế độ DESIGNATED_REQUIRED hoặc ANY_ELIGIBLE; kiểm lại khi ký (SDS-TR-001 mục 8.5) | Chủ dự án 2026-10-16 |
| D-35 | Bộ phận không hoạt động và mã đào tạo | **ĐỀ XUẤT từ WP-0 (chờ QA):** cho cấp mã theo bộ phận của tài liệu kể cả khi bộ phận đã ngưng; không cho chọn bộ phận ngưng làm đơn vị tổ chức mới | WP-0 (báo cáo dữ liệu nền F-1) |
| D-36 | Ai đủ điều kiện được đào tạo | **ĐỀ XUẤT từ WP-0 (chờ QA):** chỉ người Active **có mã nhân viên** vào danh sách và hồ sơ | WP-0 (F-2) |
| D-37 | Revision đã qua Pending Training khi bật tích hợp | **ĐỀ XUẤT từ WP-0 (chờ QA):** không cấp mã hồi tố; SOP.0017 đang Pending Training ở lại MANUAL | WP-0 (F-6) |

**Nhãn:** "Chủ dự án" là câu trả lời trực tiếp; "Ủy quyền; QA xác nhận" là đề xuất của người soạn mà chủ dự án đã chấp nhận (2026-10-16) và QA phải xác nhận bằng tên người trong Decision Log.

### 13.2 Việc của QA trước khi phát hành (không chặn WP-0 đến WP-9)

1. Xác nhận bằng tên người các quyết định "Ủy quyền; QA xác nhận" ở 13.1.
2. **Thống nhất SOP.0003 và lưu đồ** ở bước duyệt nội dung (lưu đồ: Departments và QM; SOP 5.3.5: trưởng đơn vị liên quan và Trưởng phòng QA), và các điểm không nhất quán dưới đây.
3. Đối chiếu số điều khoản EU-GMP, Annex 11, WHO TRS 986 nêu trong SDS-TR-001 mục 1.1 với bản chính thức.
4. Ký URS, đánh giá rủi ro, chiến lược kiểm thử của WP-0.
5. Cập nhật SOP.0003 và các biểu mẫu để phản ánh việc dùng phần mềm (APD.0014 vẫn ghi lập bằng Excel và lưu trên máy tính phòng QA; ngoài phạm vi phần mềm nhưng bắt buộc về GMP).
6. Cung cấp người tham gia kiểm định và UAT (WP-HARDEN) và người có thẩm quyền phê duyệt phát hành.

**Điểm chưa nhất quán trong tài liệu nguồn (cần người phụ trách xem lại):**
- APD.0011 ghi viết tắt loại tài liệu là **TRN** ở tiếng Việt và **TRM** ở tiếng Anh.
- SOP mục 5.3.7 tham chiếu "mục 5.1.2" cho các hình thức đào tạo, nhưng bảng hình thức không có số mục.
- APD.0014 vẫn nói "tạo bằng Excel", "lưu trên máy tính của phòng QA", mâu thuẫn với việc dùng phần mềm.
- APD.0009 ghi "(≥ 7 điểm, thang 10)" còn SOP ghi "qua 70% tổng điểm": giống nhau chỉ khi thang là 10 điểm hoặc quy đổi.
- APD.0108 ghi phiên bản 1.0.0 trong khi các phụ lục khác ghi 2.0.0; hai biểu mẫu APD.0117 và APD.0118 lịch sử ghi "đổi mã vì EDMS không đổi tên khi nâng phiên bản".

---

## 14 Rủi ro

| Rủi ro | Hậu quả | Biện pháp |
|---|---|---|
| Làm theo giao diện thử hiện có (mô hình khóa học) rồi mới phát hiện không khớp SOP | Làm lại giao diện | Chốt D-01 và mô hình dữ liệu ở T0; không dùng giao diện thử làm căn cứ |
| Hai module phối hợp qua giao dịch: Training lỗi làm tài liệu không lưu được | Chặn việc tạo tài liệu | Cờ tính năng (D-28); cổng idempotent; kiểm thử lỗi và lui giao dịch |
| Mã đào tạo bị hủy nhiều (tick rồi bỏ) | Sổ mã nhiễu | Mã chỉ cấp sau lần lưu đầu (D-23); mỗi bản hủy có lý do |
| Người dùng thấy hai nơi để sửa ngày đào tạo | Dữ liệu lệch | Ngày chỉ do Training ghi; Document Control chỉ đọc (mục 8.4) |
| Hồ sơ giả hoặc sửa sau khi đã hoàn thành | Mất toàn vẹn dữ liệu | Hồ sơ bất biến; không có API nhập tay; Audit Trail; chữ ký điện tử |
| Chữ ký tay và chữ ký điện tử song song | Bằng chứng gốc nằm ngoài hệ thống | Lưu ảnh bản gốc, người xác nhận, quy tắc ai giữ bản giấy |
| Dữ liệu vị trí công việc chưa chuẩn | Ma trận sai, người bị bỏ sót | Nạp danh mục ở T0, kiểm tra tay với trưởng đơn vị |
| Tích hợp chặn công việc (người chưa đạt không được làm) | Dừng sản xuất ngoài ý muốn | Giai đoạn đầu chỉ hiển thị cờ, không chặn |
| Hạn "ngày làm việc" sai | Cảnh báo sai | Dùng lịch nhà máy; kiểm thử với ngày lễ |
| Hồ sơ nhân viên có dữ liệu cá nhân | Lộ thông tin | Quyền theo phạm vi; Audit Trail cho xem và xuất |
| Mã đào tạo trùng khi nhiều người cấp cùng lúc | Sai truy xuất | Khóa dòng bộ đếm; kiểm thử đồng thời |
| Nhập dữ liệu cũ sai | Hồ sơ lịch sử không tin cậy | Nhập vào bảng có nhãn, đối chiếu, người xác nhận; không trộn vào bản ghi thật |

---

## 15 Bảng truy vết: điều khoản SOP đến hạng mục kế hoạch

| SOP | Nội dung | Hạng mục |
|---|---|---|
| 3 | Trách nhiệm | Mục 4, 10 |
| 4.2 | Thuật ngữ | Mục 3 |
| 5.1 (nguyên tắc, giảng viên) | Đào tạo trước khi làm; yêu cầu giảng viên | 5.6, TR-19, TR-31 |
| 5.1 (loại đào tạo) | Ban đầu, định kỳ, đột xuất, bên ngoài | Mục 3, 5.4 |
| Bảng 5.1.2 | Hình thức và đánh giá | 5.2 |
| 5.1.3 | Hạn 10 ngày | 5.7, 8.2, 8.3, TR-10 |
| 5.1.4 | Cấp mã | 5.4, TR-01 đến TR-05 |
| 5.3.1 | Ma trận | 5.1, TR-28, TR-29 |
| 5.3.2 | Yêu cầu đào tạo | 5.3, TR-06 đến TR-09 |
| 5.3.3 | Cấp mã và tổ chức | 5.4 |
| 5.3.4 | Danh sách tham gia | 5.5, TR-11 |
| 5.3.5 | Nội dung | 5.6, TR-21, TR-22 |
| 5.3.6 | Thực hiện | 5.7, TR-12, TR-27 |
| 5.3.7 | Đánh giá | 5.8, TR-13 đến TR-18 |
| 5.3.8 | Bản giao việc | 5.9, TR-23, TR-24 |
| 5.3.9 | Chữ ký nhân viên | 5.10, TR-25 |
| 5.3.10 | Hồ sơ cá nhân | 5.11, TR-26 |
| 5.3.11 | Chuyển vị trí | 5.12 |
| 5.1, 5.3.1, 5.3.5, 5.3.6 (liên quan tài liệu) | Tài liệu mới, người ký, cấp tài liệu, hạn | Mục 8 |
| 6 | Biểu mẫu đính kèm | Mục 5 (mỗi mục một biểu mẫu) |
| 7 | Lịch sử sửa đổi | Ghi nhận phiên bản biểu mẫu và SOP trong dữ liệu xuất |

**Biểu mẫu đến đối tượng dữ liệu:**

| Biểu mẫu | Là gì trên hệ thống |
|---|---|
| APD.0011 Ma trận | `training_matrix_versions` (xuất PDF) |
| APD.0118 Yêu cầu đào tạo | `training_requirements` (xuất PDF, ba chữ ký) |
| FRM.0044 Sổ cấp mã | Báo cáo trên `training_activities` theo bộ phận |
| APD.0117 Danh sách tham gia | Xuất từ hoạt động, session, người tham gia |
| APD.0108 Tự đọc | Xuất từ `training_self_reading` |
| APD.0009 Đánh giá | `training_assessments` (xuất mẫu; tệp bài làm tải lên) |
| APD.0014 Hồ sơ cá nhân | Báo cáo trên `training_records` (xuất PDF, mỗi lần một bản bất biến) |
| APD.0024 Bản giao việc | `training_job_assignments` (hai chữ ký) |
| FRM.0007 Chữ ký mẫu | `training_specimen_signatures` |

---

## 16 Không nằm trong phạm vi kế hoạch này

Chứng chỉ, học trực tuyến có video, ngân hàng câu hỏi và làm bài trên máy, năng lực (competency) ngoài ma trận, gamification; các thay đổi SOP.0003 và biểu mẫu; chặn công việc ở các module khác (khác với việc Training cấp mã và ghi ngày cho Document Control ở mục 8, vốn **nằm trong** phạm vi); báo cáo Training trong module Report (có thể làm sau khi module Report được làm tiếp); nguồn Backup & Restore.


---

## 17 Cập nhật 2026-10-17: vận hành linh hoạt (giấy và điện tử), đào tạo bên ngoài, đối chiếu SOP lần hai

**Trạng thái:** **ĐỀ XUẤT**, trừ mục 17.1 là **QUYẾT ĐỊNH** của chủ dự án (2026-10-17). Mục này là kết quả đọc lại toàn bộ SOP.0003.02 và sáu phụ lục sau khi phần lớn module đã chạy trên DEV. Nó bổ sung chứ không thay mục 1 đến 16; chỗ nào mâu thuẫn thì mục 17 thắng, và các mục cũ sẽ được sửa ở lần soát tiếp theo.

### 17.1 Nguyên tắc vận hành (QUYẾT ĐỊNH, chủ dự án 2026-10-17)

1. **Phần mềm là công cụ hỗ trợ, không thay thế hoàn toàn quy trình.** Nhân viên ở xưởng và phòng sạch thường không có thiết bị điện tử; nhiều buổi đào tạo diễn ra bằng giấy hoặc tập trung ở một phòng họp. Mọi chức năng phải dùng được cả khi người học không chạm vào máy tính.
2. **SOP là mặc định, không là rào cản.** Hệ thống gợi ý giá trị theo SOP (ví dụ cách đánh giá theo hình thức đào tạo) nhưng cho người có thẩm quyền chọn khác; thay vì chặn thì **ghi lại** (ai, khi nào, giá trị nào, vì sao). Việc đã làm: Assessment chọn tự do, giá trị SOP là mặc định (D-41).
3. **Những điều không nới lỏng** (pháp lý và toàn vẹn dữ liệu, EU-GMP Annex 11, ALCOA+): chữ ký điện tử có ý nghĩa; Audit Trail đầy đủ; hồ sơ đã chốt không sửa, không xóa; tách nhiệm vụ (người nhập không tự xác minh); kiểm tra quyền và phạm vi ở máy chủ; ngưỡng đạt tính từ điểm ở máy chủ; bản scan gốc luôn được giữ khi hồ sơ lập từ giấy.
4. **Mỗi buổi đào tạo có một chế độ làm việc:** `ELECTRONIC` (người dự dùng máy), `PAPER` (giấy rồi nhập hoặc scan), `MIXED` (một phần). Chế độ là gợi ý ban đầu theo hình thức đào tạo và địa điểm; người tổ chức đổi được, hệ thống ghi lại.

### 17.2 Đối chiếu SOP lần hai: điều khoản, hiện trạng, việc cần làm

Cột "Hiện trạng" dựa trên mã đang chạy trên DEV ngày 2026-10-17 (**KIỂM TRA MÃ**). Cột "Việc" là hạng mục mới.

| Mã | SOP | Điều SOP yêu cầu | Hiện trạng | Việc cần làm |
|---|---|---|---|---|
| TR-32 | 5.1 (đào tạo ban đầu) | Gồm ba phần: nội quy, an toàn lao động (HCNS); nguyên tắc chung GMP (QA); chuyên môn công việc (đơn vị liên quan) | Có hoạt động INITIAL; chưa có "gói đào tạo ban đầu" ba phần | Cho mở **một lần ba hoạt động** (mã riêng của từng đơn vị tổ chức), cùng danh sách người mới; mỗi phần theo dõi riêng |
| TR-33 | 5.1 | Người ký tài liệu được coi đã đào tạo ban đầu về tài liệu đó | Chưa tự tạo hồ sơ | Khi revision được duyệt, tạo hồ sơ `SIGNATORY_INITIAL` cho người soạn, kiểm tra, duyệt (nguồn: Document Control); xem D-45 |
| TR-34 | 5.1 | Đào tạo lại khi cần hoặc nhân viên vắng trên 6 tháng | Có lý do `ABSENCE_RETURN` khi tạo tay; không có dữ liệu nghỉ phép để tự phát hiện | Không tự động; thêm thao tác "Retraining after long absence" cho trưởng đơn vị, mặc định đưa các chủ đề hết hạn vào danh sách |
| TR-35 | 5.3.6 | Trước buổi đào tạo: báo HCNS chuẩn bị địa điểm, phương tiện, tài liệu; báo các bộ phận chuẩn bị thiết bị (đào tạo thực hành); báo giờ, nơi, nội dung cho học viên và giảng viên | Chỉ thông báo học viên khi Notify | **Danh sách việc chuẩn bị** theo buổi (địa điểm, thiết bị, thông báo), mỗi việc có đơn vị nhận, trạng thái và thông báo (D-46) |
| TR-36 | 5.3.6 | Tài liệu mới hoặc nâng phiên bản: gửi danh sách tham dự cho QA ngay trong ngày | Có cột hạn; chưa kiểm chứng bộ đếm theo ngày | Hiện "Hạn nộp: hôm nay" trên màn Conduct; nhắc cuối ngày; quá hạn ghi dấu (không chặn) |
| TR-37 | 5.3.4, 5.3.7, APD.0009 | APD.0117, APD.0108, APD.0009 là biểu mẫu giấy; số đào tạo in trên mỗi trang bài kiểm tra | Chưa có bản in; có bản xuất APD.0014, APD.0011, APD.0118 | **Gói hồ sơ giấy** (mục 17.3): in biểu mẫu có Training Number, số trang, mã gói, bộ đếm bản in |
| TR-38 | 5.3.7, 5.3.10 | Kết quả đánh giá gửi QA trong 7 ngày làm việc; QA cập nhật hồ sơ cá nhân | Có tải bản scan và người nhận đối chiếu; chưa có nhập kết quả từ giấy theo lô | **Nhập hộ từ giấy** kèm xác minh lần hai (mục 17.3) |
| TR-39 | 5.3.7 | Hybrid, học viên trực tuyến: ghi "Trực tuyến" ở cột Ký tên | Có trạng thái `ONLINE` | In chữ "Trực tuyến / Online" ở cột Ký tên của bản in; nhập hộ có lựa chọn Online |
| TR-40 | 5.3.4, APD.0108 | Tự đọc: danh sách theo APD.0108 (mã đào tạo, ngày đọc hiểu, chữ ký, trưởng phòng xác nhận) | Bảng người tham gia dùng cột APD.0117 cho mọi hình thức | Với `SELF_READING`, bảng và bản in đổi sang cột APD.0108 |
| TR-41 | 5.1.2 (thực hành) | Đánh giá thực hành: bài kiểm tra dạng checklist **hoặc quan sát thao tác thực tế** | Chỉ có `CHECKLIST` | Thêm giá trị `OBSERVATION`; ghi bằng checklist APD.0009 mẫu TH2 do người quan sát điền (D-42) |
| TR-42 | 5.1.2 (bên ngoài), 5.3.3, APD.0117 | Hai loại: chủ động, bị động; chọn đơn vị theo SOP.0025; hồ sơ chỉ ghi tên đơn vị hoặc cá nhân đào tạo | Có Type External; nhãn chưa theo SOP; chưa có trường đơn vị đào tạo | Mục 17.4 (D-43) |
| TR-43 | 5.3.2, 5.3.10 | Bản sao APD.0118 gửi các bộ phận liên quan; bản sao FRM.0007, APD.0024 lưu ở đơn vị quản lý | Có thông báo; chưa ghi nhận đã gửi và đã nhận | **Nhật ký phân phối bản sao** (D-47) |
| TR-44 | 5.3.10 | QA in hồ sơ cá nhân định kỳ hằng năm hoặc khi có yêu cầu; gửi file mềm cho đơn vị quản lý | Có xuất từng người | **Xuất theo lô** theo bộ phận và năm, chạy nền, có duyệt (D-48) |
| TR-45 | 5.3.11 | Chuyển bộ phận: trưởng bộ phận tiếp nhận và người được phân công rà soát hồ sơ để xác định đào tạo bổ sung; chuyển cơ sở: bàn giao bản sao, đào tạo như người mới | Có D-33 (điều chuyển sinh đào tạo ban đầu) | Màn **Transfer review** cho người nhận: so hồ sơ hiện có với ma trận vị trí mới, chọn các chủ đề cần đào tạo |
| TR-46 | 5.3.7 | Hạn 7 ngày **làm việc** | Có cài đặt số ngày; chưa có màn quản lý ngày nghỉ | Màn **Non-working days** (D-14); đến khi có thì tính thứ Hai đến thứ Sáu |
| TR-47 | 5.3.6 | Chủ đề không xong trong tháng đăng ký thì phải dời sang tháng sau | Thiết kế SDS mục 11 có việc nền; chưa kiểm chứng trên DEV | Kiểm bằng UAT; nếu thiếu thì làm |

### 17.3 Thiết kế vận hành bằng giấy (chung cho mọi hình thức)

**Vòng đời một buổi bằng giấy (ví dụ lớp học tại phòng họp, hoặc thực hành ở xưởng):**

1. **Chuẩn bị (điện tử):** người tổ chức hoàn tất danh sách, nội dung, đề kiểm tra (đã duyệt) trên máy.
2. **In gói hồ sơ giấy** (một thao tác, quyền `training.paper.print`): PDF gồm (a) danh sách tham dự APD.0117 theo từng session, hoặc APD.0108 nếu tự đọc; (b) phiếu APD.0009 cho từng học viên (đã điền tên và mã, in sẵn **Training Number ở đầu mỗi trang**); (c) trang bìa ghi mã gói, số trang, người in, thời điểm. Mỗi trang có "Trang x/y" và mã gói để phát hiện thiếu trang. Mỗi lần in tăng **bộ đếm bản in**; in lại phải có lý do (nguyên tắc bản có kiểm soát). Bản in song ngữ Việt và Anh (D-22).
3. **Tiến hành tại chỗ (không cần thiết bị):** học viên ký tay vào danh sách; giảng viên ghi "Vắng mặt" hoặc "Trực tuyến" ở cột Ký tên đúng như SOP 5.3.7; học viên ký vào mọi trang bài kiểm tra; người chấm điền kết quả trên giấy.
4. **Đưa dữ liệu vào hệ thống, chọn một hoặc cả hai đường:**
   - **Tải bản scan:** đã có (bằng chứng giấy, người thứ hai đối chiếu với bản giấy rồi mới ghi chữ ký giấy của người đó).
   - **Nhập hộ từ giấy (mới):** người được giao (HCNS, thư ký đơn vị, giảng viên) nhập điểm danh và điểm theo **lưới nhập nhanh** (mỗi dòng một người; thao tác bàn phím và màn hình cảm ứng), **bắt buộc đính kèm bản scan** của tờ giấy gốc. Ghi rõ **"Nhập bởi X từ bản giấy Y, người thực hiện thực tế là Z, ngày thực hiện D"** (ALCOA: Attributable, Contemporaneous, Original). Nhập sau hơn một ngày làm việc kể từ ngày thực hiện phải có **lý do nhập muộn**.
   - **Xác minh lần hai:** người thứ hai (khác người nhập, và không là người có tên trong dòng được nhập) so bản nhập với bản scan rồi xác nhận bằng chữ ký điện tử. Chỉ sau bước này, dữ liệu mới thành điểm danh và kết quả chính thức (và sinh hồ sơ cá nhân). Sai khác thì trả lại có lý do; không sửa đè bản đã nhập, mà nhập bản mới (lịch sử giữ nguyên).
5. **Giữ bản giấy gốc:** hệ thống ghi nơi lưu bản giấy (QA, theo bảng lưu trữ SOP 5.3.10) và người nhận; bản scan là bản sao có mã băm.

**Phòng họp tập trung (một thiết bị của giảng viên):** màn Conduct có **chế độ điểm danh nhanh** (nút lớn, danh sách cuộn, chạm để đổi Có mặt, Trực tuyến, Vắng mặt). Người dùng đăng nhập là **giảng viên**; hệ thống ghi "điểm danh bởi giảng viên" (`sign_mode = TRAINER_ATTESTED`), không bắt học viên đăng nhập hay ký trên máy chung. Học viên vẫn ký giấy nếu SOP yêu cầu chữ ký.

**Tự đọc (APD.0108):** hai cách như nhau: học viên ký giấy rồi người được giao nhập, hoặc học viên tự bấm "Đã đọc hiểu" bằng chữ ký điện tử nếu có máy; trưởng phòng xác nhận bằng chữ ký điện tử.

**Không làm (giai đoạn này):** ứng dụng ngoại tuyến (PWA) và đồng bộ khi mất mạng. Giấy là đường dự phòng đã đủ cho xưởng và phòng sạch; ngoại tuyến thêm rủi ro dữ liệu trùng và xung đột đồng bộ (D-49).

### 17.4 Đào tạo bên ngoài và người ngoài (TR-42, D-21, D-43, D-44)

Theo SOP, "bên ngoài" nói về **ai tổ chức hoặc ai dạy**, còn học viên thường vẫn là nhân viên của mình:

| Trường hợp | Người ngoài là | Học viên | Hồ sơ |
|---|---|---|---|
| Khách tham quan, nhà thầu tạm thời (đào tạo đột xuất, lý do Visitor) | Học viên | Họ, nhập **nhiều dòng** (tên, đơn vị) | Có trong danh sách APD.0117; **không** có hồ sơ cá nhân APD.0014 (D-21) |
| Đào tạo bên ngoài **chủ động** (Active external training) | Đơn vị hoặc giảng viên | Nhân viên của mình | Hồ sơ cá nhân ghi **tên đơn vị đào tạo** (APD.0117) |
| Đào tạo bên ngoài **bị động** (Passive external training: cơ quan quản lý yêu cầu hoặc được mời) | Đơn vị tổ chức | Nhân viên của mình | Như trên |

Thiết kế (ĐỀ XUẤT, QA xác nhận): trường bắt buộc **Training unit / individual** ở hoạt động External; giảng viên chỉ chọn "External expert/consultant"; Method và Assessment **không áp dụng** (SOP 5.1.2 chỉ định cho đào tạo nội bộ); **bỏ** các bước xem xét và duyệt nội dung bài kiểm tra vì không có tài liệu hay đề của mình, **giữ** xác nhận hoàn thành của QA; tham chiếu nhà cung cấp theo SOP.0025 (trường tham chiếu, và cảnh báo nếu có danh mục nhà cung cấp mà đơn vị chưa được duyệt); **bằng chứng hoàn thành** (chứng chỉ, giấy chứng nhận) tải lên dạng bản scan loại `CERTIFICATE`; kết quả của hồ sơ là `ATTENDED` (đã tham dự) khi không có điểm. Nhãn: "Active external training", "Passive external training".

### 17.5 Quy tắc giao diện bổ sung (mọi màn của module)

1. **Tái sử dụng** `components/ui` (Table, Tabs, Select, Radio, Checkbox, DateTimePicker, Progress, Drawer, Dropdown, Esign-modal, Toast); không viết thẻ bảng thô; cùng class trường nhập với Document Control; có `No.` ở mọi bảng.
2. **Responsive từ đầu:** điện thoại và máy tính bảng là thiết bị của giảng viên và trưởng ca; bảng chuyển sang dạng thẻ dưới 1024px, nút tối thiểu 36px, lưới nhập nhanh dùng được bằng cảm ứng, lưới không cuộn ngang trên điện thoại ở các màn thao tác chính.
3. **Mỗi việc một màn** (Details chỉ xem; Edit, Conduct, Review, Approve, Confirm, Participate) với tên chức năng làm tiêu đề và breadcrumb (đã làm cho Activity; áp dụng cho Job Assignment, Requirement, Matrix, Specimen khi có chức năng mới).
4. **Gợi ý, không chặn** (17.1.2): cảnh báo vàng kèm lý do lưu lại.
5. **Server-side** tìm kiếm, lọc, phân trang cho mọi danh sách.

### 17.6 Tham khảo phần mềm quản lý chất lượng trên thị trường (ý tưởng, không phải yêu cầu)

Các hệ thống đào tạo trong QMS (như Veeva Vault Training, MasterControl Training, Qualio, ComplianceQuest) thường có: gán đào tạo theo vai trò và ma trận; bảng điểm danh in có mã vạch và quét lại; nhập điểm hàng loạt; quản lý buổi học do giảng viên điều hành (instructor-led) với roster; "đọc hiểu" bằng chữ ký điện tử; báo cáo thiếu đào tạo theo người và theo tài liệu; nhắc việc theo hạn; ngoại lệ và miễn có phê duyệt. Điểm lấy làm ý tưởng: bản in có mã gói và số trang (TR-37), nhập hàng loạt có xác minh (TR-38), roster do giảng viên điều hành (17.3). Điểm **không** theo: học trực tuyến video và ngân hàng câu hỏi (D-13), vì SOP.0003 mô tả quy trình lập hồ sơ đào tạo có kiểm soát, không phải hệ thống học tập. (Tên sản phẩm chỉ để chỉ nhóm tính năng; cần người dùng kiểm chứng trước khi dùng làm căn cứ.)

### 17.7 Quyết định mới (ĐỀ XUẤT; QA xác nhận trừ khi ghi khác)

| # | Vấn đề | Quyết định đề xuất |
|---|---|---|
| D-38 | Nguyên tắc linh hoạt | Mục 17.1 (đã chốt bởi chủ dự án) |
| D-39 | Chế độ làm việc của buổi | `ELECTRONIC`, `PAPER`, `MIXED`; mặc định theo hình thức và địa điểm; đổi được, có ghi lại |
| D-40 | Gói hồ sơ giấy | Có bộ đếm bản in, mã gói, số trang, Training Number mỗi trang; in lại có lý do |
| D-41 | Cách đánh giá theo hình thức | SOP là mặc định, chọn khác được và ghi lại (**đã làm**) |
| D-42 | Quan sát thao tác thực tế | Giá trị `OBSERVATION`; ghi bằng checklist APD.0009 TH2; điểm và ngưỡng 70% như bài kiểm tra |
| D-43 | Đào tạo bên ngoài | Mục 17.4; kết quả `ATTENDED` khi không có điểm; bằng chứng bản scan loại `CERTIFICATE` |
| D-44 | Người ngoài nhiều dòng | Một lần thêm được nhiều người; không hồ sơ cá nhân (mở rộng D-21) (**đã làm**) |
| D-45 | Hồ sơ đào tạo ban đầu của người ký tài liệu | Tự tạo khi revision được duyệt, loại nguồn `SIGNATORY_INITIAL`; người ký không phải học lại về chính tài liệu |
| D-46 | Danh sách việc chuẩn bị (5.3.6) | Việc theo buổi với đơn vị nhận (HCNS, đơn vị liên quan), trạng thái và thông báo; không chặn Notify, chỉ cảnh báo |
| D-47 | Phân phối bản sao | Nhật ký gửi và nhận bản sao (APD.0118, FRM.0007, APD.0024, hồ sơ cá nhân) đến đơn vị quản lý |
| D-48 | Xuất hồ sơ cá nhân theo lô | Chạy nền, mỗi lô có duyệt; giới hạn số người mỗi lô; ghi mã băm |
| D-49 | Ngoại tuyến | Không làm PWA ở giai đoạn này; giấy là đường dự phòng |
| D-50 | Bỏ người khỏi danh sách | Xóa dòng **chỉ** khi danh sách chưa xác nhận và người chưa có điểm danh; ghi Audit Trail (tên, lý do); sau đó chỉ đánh dấu vắng (**đã làm**) |
| D-51 | Nhập hộ từ giấy | Cho phép; phải có scan; người xác minh khác người nhập; nhập muộn quá một ngày làm việc phải có lý do |

### 17.8 Gói công việc mới và thứ tự

| Gói | Nội dung | Phụ thuộc | Ghi chú |
|---|---|---|---|
| WP-EXT | Đào tạo bên ngoài (TR-42, D-43) | không | **ĐÃ LÀM trên DEV 2026-10-17** (V615): nhãn Active và Passive theo SOP, trường Training unit và Vendor reference, buổi không có method và assessment, giảng viên bên ngoài tùy chọn, bỏ bước duyệt nội dung, chứng chỉ là bản scan loại `CERTIFICATE`, kết quả hồ sơ `ATTENDED`. Chưa làm: cảnh báo nhà cung cấp chưa được duyệt (SOP.0025) |
| WP-OBS | `OBSERVATION` (TR-41), cột APD.0108 (TR-40), "Trực tuyến" (TR-39) | không | **ĐÃ LÀM trên DEV 2026-10-17** (V615): giá trị Observation cho Practical; bảng người tham gia đổi sang cột APD.0108 (mã đào tạo, ngày đọc hiểu, chữ ký) khi buổi là tự đọc; nhãn "Online" cho học viên trực tuyến. Chưa làm: in biểu mẫu (thuộc WP-PAPER) |
| WP-PAPER | Gói hồ sơ giấy, nhập hộ, xác minh lần hai, điểm danh nhanh (TR-37, TR-38, D-39 đến D-40, D-51) | WP-OBS | **Một phần, ĐÃ LÀM trên DEV 2026-10-17 (V616, V617):** chế độ giao buổi (Electronic, Paper, Mixed; đổi sau khi đã in cần lý do), in gói hồ sơ giấy có mã gói, số bản, Training Number và Page x / y trên mọi trang (mỗi lần in được ghi, bản in lại cần lý do); nhập hộ từ giấy với bản quét bắt buộc, người thứ hai kiểm tra và ký (`TRAINING_TRANSCRIPTION_VERIFIED`), lý do nhập trễ sau một ngày làm việc, khóa chống gửi trùng, tối đa 500 dòng. **Làm thêm cùng ngày (V618):** điểm danh nhanh `TRAINER_ATTESTED` (người đào tạo đánh dấu cả buổi và ký một lần), gói in có đủ sáu phần APD.0117 (phần 4, 5, 6 là ô ký tay), và ngày nghỉ của nhà máy (WP-DAYS) trong Training Properties, dùng cho 'một ngày làm việc'. **Chưa làm:** chân trang APD.0009 theo từng học viên và đúng bố cục từng biểu mẫu (gói in chưa phải bản sao từng biểu mẫu); chưa kiểm thử có đăng nhập |
| WP-PREP | Việc chuẩn bị (TR-35), hạn nộp trong ngày (TR-36) | không | **Một phần, ĐÃ LÀM trên DEV 2026-10-17 (V620):** danh sách việc chuẩn bị cho từng buổi (địa điểm, thiết bị, tài liệu, thông báo), mỗi việc Pending, Done hoặc Not needed, có thể giao cho một người (người đó được thông báo và tự báo xong); chỉ cảnh báo, không chặn buổi (D-46). **Làm thêm 2026-10-18:** hạn nộp danh sách cho QA trong ngày (TR-36, SOP.0003 5.3.6): với đào tạo về tài liệu mới hoặc nâng phiên bản, màn hình nhắc ngày hạn là ngày buổi đào tạo được tổ chức, có nhắc buổi sáng hôm đó và nhắc hằng tuần khi trễ; gửi trễ vẫn được và được ghi vào Audit Trail (SOP là mặc định, không chặn) |
| WP-DIST | Phân phối bản sao (TR-43), xuất theo lô (TR-44) | WP-PAPER | **Một phần, ĐÃ LÀM trên DEV 2026-10-17 (V620):** nhật ký phân phối bản sao cho phiếu yêu cầu đã duyệt và bản giao việc đang hiệu lực (bộ phận nhận, người gửi, ngày gửi, người xác nhận đã nhận; mỗi dòng không sửa được), tab "Copies received" trong My Training (D-47). **Làm thêm cùng ngày (V621):** xuất hồ sơ cá nhân theo bộ phận và năm (TR-44, D-48): một người chuẩn bị và ký, một người khác được chỉ định duyệt và ký, rồi mới tạo ZIP gồm một PDF APD.0014 cho mỗi người (tối đa 150 người, tạo ngay lúc duyệt, không chạy nền). **Chưa làm:** bản sao chữ ký mẫu (FRM.0007) trong nhật ký bản sao. **Làm thêm 2026-10-18:** chữ ký mẫu có hai ảnh (lần 1 và lần 2, ảnh thứ hai bắt buộc với phiên bản mới, V622; chủ dự án quyết định ngày 2026-10-18) và hồ sơ đào tạo ban đầu cho người ký tài liệu (người soạn, kiểm tra, duyệt được ghi hồ sơ nguồn `SIGNATORY_INITIAL` khi revision được duyệt, V623; chủ dự án đồng ý ngày 2026-10-18) |
| WP-XFER | Transfer review (TR-45), gói đào tạo ban đầu (TR-32), hồ sơ người ký (TR-33), đào tạo lại sau vắng (TR-34) | không | Vừa |
| WP-DAYS | Ngày nghỉ (TR-46) | không | Nhỏ; **chưa làm**: bảng `training_non_working_days` hiện chưa được dùng ở đâu để tính hạn, nên màn quản lý chỉ có giá trị khi làm cùng bộ tính "7 ngày làm việc" (TR-13) |
| WP-MATRIX | Lưới mức hoàn thành ma trận theo vị trí, bản in, Update needed (TR-57 đến TR-61, mục 17.11) | WP-OBS | **Một phần:** điểm 1 (lưới ma trận định nghĩa: ba nhóm hàng, cột "Annual", hai cột đầu cố định, tìm kiếm, tùy chỉnh cột) và lưới mức hoàn thành theo vị trí (sáu trạng thái do máy chủ tính, tab "Matrix completion" trong Training Compliance, phân tích khoảng trống, ngăn chi tiết ô, giới hạn 300 người và 200 hàng) đã làm 2026-10-17; bản in lưới (danh sách người và việc còn mở) và thẻ cho màn hình hẹp đã làm cùng ngày; chưa làm: nhóm "Management Personnel" (D-54 chưa có quyết định về ý nghĩa) |

**Đã hoàn thành sau lần soát trước** (cập nhật ở SDS-TR-001 mục "Trạng thái triển khai"): màn thao tác tách khỏi màn xem (Edit, Conduct, Review, Approve, Confirm, Participate), vùng làm việc Participants năm nguồn (ma trận, Business Unit, Department, Individual, người ngoài) kèm đánh dấu vắng trước buổi, nội dung đào tạo dạng file hoặc liên kết, đề và đáp án có xem trước, thanh tiến độ tải lên, địa điểm buổi (tại chỗ hoặc trực tuyến), in PDF ma trận và phiếu yêu cầu.

### 17.9 Rủi ro mới

| Rủi ro | Hậu quả | Biện pháp |
|---|---|---|
| Nhập hộ từ giấy sai hoặc làm giả | Hồ sơ không đúng thực tế | Bắt buộc scan; xác minh lần hai khác người; lý do nhập muộn; Audit Trail ghi người nhập và người thực hiện |
| Gói in bị thiếu trang hoặc in lại tùy tiện | Mất bằng chứng | Mã gói, "Trang x/y", bộ đếm bản in, lý do in lại |
| Người dùng ở xưởng không dùng được giao diện | Bỏ dùng, quay lại giấy rời rạc | Chế độ điểm danh nhanh responsive; người nhập hộ làm việc ở văn phòng |
| Chức năng chồng chéo (cùng việc làm ở hai nơi) | Dữ liệu mâu thuẫn | Mỗi dữ kiện có một nguồn sự thật: điểm danh chỉ ghi qua màn Conduct hoặc nhập hộ đã xác minh; không sửa trực tiếp ở bảng người tham gia |
| Tải lớn khi xuất lô hoặc in gói cho lớp đông | Chậm, treo | Giới hạn số người mỗi lô, tạo PDF chạy nền và phân trang, hàng đợi có giới hạn đồng thời |

### 17.10 Kiểm tra lại từng biểu mẫu (2026-10-17, đọc đủ từng file APD và FRM)

Lần đối chiếu 17.2 ban đầu đọc SOP đầy đủ nhưng đọc các biểu mẫu chưa đủ chi tiết. Bảng dưới là kết quả đọc lại **từng** biểu mẫu và so với dữ liệu, màn hình, bản in hiện có. Lưu ý: bản Markdown chuyển từ Word có thể **mất ô gộp** (đã gặp ở bảng 5.1.2 của SOP: dòng Hybrid dùng chung ô đánh giá của dòng Classroom nên Markdown hiện ô trống). Khi một bảng quan trọng có ô trống, phải đối chiếu file `.docx`.

| Mã | Biểu mẫu | Điều biểu mẫu yêu cầu | Hiện trạng | Việc |
|---|---|---|---|---|
| TR-48 | FRM.0007 | Mỗi lần có chữ ký ban đầu hoặc thay đổi cần **hai chữ ký mẫu** (lần 1 và lần 2), ngày, và xác nhận của trưởng đơn vị; thay đổi đánh số lần 1, 2, 3 | Mỗi phiên bản chỉ có **một** ảnh chữ ký | Thêm ảnh thứ hai cho mỗi phiên bản (D-52); bản in FRM.0007 để ký tay rồi scan (biểu mẫu này vốn là giấy) |
| TR-49 | APD.0014 v2.0.0 | Họ tên, **trình độ chuyên môn**, **ngày vào công ty**; lịch sử (nội dung, ngày, mã đào tạo); bỏ thông tin vị trí; ký người chuẩn bị và Trưởng phòng QA; trưởng đơn vị xem hồ sơ nhân viên của mình | Bản xuất **đã bỏ vị trí** (sửa 2026-10-17); chưa có trình độ chuyên môn và ngày vào công ty vì chưa có nơi lưu dữ liệu đó | Quyết định nơi lưu hai trường (D-53); thêm vào bản xuất |
| TR-50 | APD.0118 | Đầu: Year, Request No, loại (định kỳ SOP hay hằng năm). Bảng: STT, Tháng, Chủ đề, **Mã đào tạo, Ngày đào tạo, Sign by QA, Comment from QA** (do người quản lý đào tạo QA ghi sau khi đào tạo xong). Ký: Training coordinator, QA manager, QM | Bản in **đã sửa 2026-10-17** (thêm loại, ngày thực hiện, QA ký, nhận xét; ba chữ ký theo vai) | Không còn việc |
| TR-51 | APD.0117 | Sáu phần: (1) thông tin chung (nội dung, bộ phận, loại đào tạo); (2) chi tiết session (Session, SOP, chủ đề, hình thức, người đào tạo, ngày); (3) danh sách theo từng session (STT, mã NV, tên, bộ phận, ký tên, kết quả, kết quả đào tạo lại); (4) **xác nhận người chuẩn bị** danh sách và chủ đề trước khi đào tạo; (5) **xác nhận người đào tạo cho từng session**; (6) **xác nhận hoàn thành của DCO-QA** sau khi đánh giá xong; đầu trang có mã đào tạo, Page x/y | Các xác nhận (4), (5), (6) đã có dưới dạng chữ ký điện tử | Bản in giấy (WP-PAPER) **phải theo đúng bố cục sáu phần**; bản in trước buổi mang sẵn phần (4) đã ký |
| TR-52 | APD.0009 v2.0.0 | **Chân trang của mọi trang bài kiểm tra: số đào tạo và chữ ký học viên**; danh sách chủ đề; tên, mã NV, đơn vị; ngày; thời gian làm bài; loại đào tạo (lần đầu, đào tạo lại, định kỳ, đột xuất); kết quả (đạt khi từ 7/10; không đạt thì đào tạo lại); người đánh giá; hai mẫu: TH1 câu hỏi tự luận hoặc nhiều đáp án, TH2 checklist Đúng hoặc Không đúng; số câu hỏi | Chưa có bản in | Gói giấy in phiếu cho từng học viên đúng các mục này, chân trang mỗi trang có số đào tạo và ô ký học viên |
| TR-53 | APD.0108 | **Một phiếu cho một tài liệu** (mã, tên, phiên bản) của một bộ phận; cột: STT, mã NV, tên, mã đào tạo, ngày đọc hiểu, chữ ký; phần xác nhận của trưởng phòng: họ tên, chức vụ, ngày, chữ ký, nhận xét | Bảng người tham gia chưa có cột này | Cột APD.0108 và bản in theo từng tài liệu (đã có ở TR-40) |
| TR-54 | APD.0011 | Cột vị trí; vị trí quản lý (QM, Production Manager) **có thể ghi chung "Management Personnel"** | Mỗi vị trí là một cột riêng | Cho phép một vị trí nhóm "Management Personnel" gán cho nhiều chức danh quản lý (D-54) |
| TR-55 | APD.0024 v2.00 | Hai trường hợp: bổ nhiệm lần đầu hoặc thay đổi/bổ sung vị trí, mỗi trường hợp có bảng riêng; ô "đã hoàn thiện đào tạo theo ma trận, mã và phiên bản"; quyền hạn; bảng trách nhiệm và mô tả công việc; ký **người giao việc** (ghi chức danh nếu người nhận là trưởng đơn vị, QM hoặc QP) và **người nhận** | Dữ liệu và chữ ký điện tử đã có (gồm ảnh chụp ma trận); chưa có bản in | Bản in APD.0024 để ký tay khi cần, rồi scan |
| TR-56 | FRM.0044 | Cột: ngày, mã đào tạo, mã SOP, chủ đề, số buổi, ghi chú; theo bộ phận | Đã có màn Training Number Register theo bộ phận và năm | Không còn việc |

**Quyết định bổ sung (ĐỀ XUẤT; QA xác nhận):** D-52 hai ảnh chữ ký mẫu cho mỗi phiên bản; D-53 nơi lưu trình độ chuyên môn và ngày vào công ty (đề xuất: hồ sơ nhân sự trong quản lý người dùng, chỉ đọc ở Training); D-54 vị trí nhóm "Management Personnel".

**Bản in là bản có kiểm soát:** mọi bản in giấy ở đây (gói APD.0117, APD.0009, APD.0108, FRM.0007, APD.0024, APD.0014, APD.0011, APD.0118) dùng chung quy tắc 17.3: mã gói, số trang, bộ đếm bản in, lý do in lại, và song ngữ Việt và Anh.

### 17.11 Matrix: thiết kế bám theo quy trình (hai cách nhìn)

**Lưu ý nguồn:** ý tưởng "lưới nhân viên × chủ đề có màu trạng thái" xuất phát từ một giao diện cũ do chủ dự án gợi ý. **SOP không mô tả lưới đó.** Mục này chỉ giữ phần có căn cứ trong SOP, và điều chỉnh phần còn lại cho đúng ngữ cảnh của quy trình.

**Căn cứ SOP và biểu mẫu**

| Điều | SOP và biểu mẫu nói gì | Hệ quả cho thiết kế |
|---|---|---|
| 5.3.1, APD.0011 | Ma trận lập **theo bộ phận**, dựa trên mô tả công việc từng **vị trí**. Hàng: chủ đề hoặc SOP; cột: các **vị trí công việc**; thêm cột "Annual training required (Yes/No)". Sắp theo ba nhóm: đào tạo chung của nhà máy, đào tạo chung của bộ phận, danh mục SOP cho từng vị trí. Vị trí quản lý (QM, Production Manager) có thể ghi chung "Management Personnel" | Ma trận định nghĩa **là lưới chủ đề × vị trí**, đã đúng dạng lưới. Cần giữ ba nhóm hàng và nhóm vị trí quản lý |
| 5.3.1 | Cập nhật ma trận khi đổi mô tả công việc, sau rà soát hằng năm, khi ban hành mới tài liệu cấp 1, 2, 3; tài liệu cấp 4 và thay đổi chỉ biên tập có thể không cần đào tạo | Cần thấy ngay tác động của một thay đổi: vị trí nào cần đào tạo tài liệu nào |
| 5.1 | Mọi nhân viên phải được đào tạo về lĩnh vực của mình **trước khi bắt đầu công việc**; trưởng đơn vị đảm bảo điều đó trước khi giao việc độc lập | Cần xem **từng người** đã đủ chủ đề của vị trí mình chưa |
| 5.3.8, APD.0024 | Bản giao việc chỉ lập khi nhân viên **hoàn thành tất cả mục trong ma trận** của vị trí; ghi mã và phiên bản ma trận | Cần cách nhìn "mức hoàn thành ma trận" của một người, đúng với điều kiện này |
| 5.3.11 | Chuyển bộ phận: trưởng bộ phận tiếp nhận và người được phân công rà soát hồ sơ hiện có để xác định đào tạo bổ sung | Cần so hồ sơ của người với ma trận của vị trí mới |
| 5.3.2 | Yêu cầu đào tạo hằng năm và đào tạo định kỳ tài liệu dựa trên ma trận và thời hạn rà soát tài liệu | Cần biết ai "đến hạn" đào tạo hằng năm hoặc định kỳ |
| 5.3.10 | Hồ sơ đào tạo cá nhân (APD.0014) là nơi ghi các lần đã đào tạo | Nguồn sự thật của "đã đào tạo" là hồ sơ cá nhân, không phải nhập tay trên lưới |

**Thiết kế (ĐỀ XUẤT; QA xác nhận):**

1. **Ma trận định nghĩa (APD.0011): lưới chủ đề × vị trí.** Giữ ba nhóm hàng, cột "Annual", nhóm vị trí "Management Personnel" (TR-54). Cải thiện giao diện: cột vị trí và hai cột đầu cố định khi cuộn, ô tích chọn có màu, tìm và lọc hàng, đếm số vị trí cần đào tạo mỗi hàng. Vẫn là bảng tích chọn vì cần sửa nhanh và duyệt từng phiên bản.
2. **Lưới mức hoàn thành ma trận, theo từng vị trí (mới).** Chọn **bộ phận và vị trí**; cột là **đúng các hàng ma trận của vị trí đó** (gồm hai nhóm chung); hàng là các nhân viên giữ vị trí đó. Lý do: mỗi vị trí cần một tập chủ đề khác nhau, nên lưới "mọi nhân viên × mọi chủ đề" toàn là ô trống và không trả lời được câu hỏi của SOP. Mỗi hàng có cột tóm tắt "đã hoàn thành x trên y mục" và biểu hiện đủ điều kiện nhận **bản giao việc** (5.3.8). Có chế độ "Gap analysis" chỉ giữ người và chủ đề còn thiếu.
3. **Cách nhìn theo người** (cho chuyển vị trí, 5.3.11): chọn một nhân viên và một vị trí đích, hiện từng mục ma trận của vị trí đó với trạng thái. Đây là màn Transfer review của TR-45 và dùng chung dữ liệu.
4. **Dữ liệu trạng thái một ô** (ĐỀ XUẤT, suy từ SOP; QA xác nhận tên và quy tắc):

| Trạng thái | Điều kiện | Căn cứ |
|---|---|---|
| Not required | Ma trận không yêu cầu chủ đề cho vị trí của người đó, hoặc tài liệu được xác nhận không cần đào tạo (cấp 4, thay đổi biên tập) | 5.3.1 |
| Required | Ma trận yêu cầu, chưa có hồ sơ hợp lệ | 5.1, 5.3.10 |
| In progress | Người đó có tên trong một hoạt động đang mở (Planned, Notified, In progress) cho chủ đề này | 5.3.3 đến 5.3.6 |
| Qualified | Có hồ sơ hợp lệ cho **phiên bản đang hiệu lực** của tài liệu (hoặc chủ đề không phải SOP) | 5.3.10 |
| Update needed | Có hồ sơ cho phiên bản cũ; phiên bản hiện hành cần đào tạo (nâng phiên bản) | 5.1.3, 5.3.1 |
| Due | Chủ đề có cờ hằng năm hoặc đến hạn đào tạo định kỳ theo thời hạn rà soát tài liệu | 5.3.2 |

   Hồ sơ bị vô hiệu (void) không được tính. Trạng thái luôn **tính ở máy chủ** từ hồ sơ cá nhân, ma trận hiệu lực và hoạt động; không có ô nhập tay.
5. **Vận hành giấy:** trưởng đơn vị in lưới theo bộ phận và vị trí (bản có kiểm soát, theo quy tắc 17.3) để rà soát trong phòng họp; bản in ghi trạng thái bằng chữ, không chỉ bằng màu. Không có thao tác sửa trạng thái trên lưới.
6. **Không chỉ dựa vào màu:** mỗi ô có biểu tượng và chữ (ALCOA: đọc được cả khi in đen trắng); bấm ô mở ngăn kéo gồm lần đào tạo gần nhất, hạn, hoạt động đang mở và liên kết.
7. **Responsive:** trên điện thoại lưới chuyển sang dạng thẻ theo nhân viên (mỗi thẻ có danh sách chủ đề và trạng thái, tóm tắt "x trên y").

**Việc mới:**
- TR-57: lưới mức hoàn thành ma trận theo bộ phận và vị trí (điểm 2).
- TR-58: tóm tắt đủ điều kiện nhận bản giao việc trên lưới (điểm 2; liên hệ D-15).
- TR-59: trạng thái "Update needed" khi nâng phiên bản tài liệu (điểm 4).
- TR-60: bản in lưới theo bộ phận và vị trí (điểm 5).
- TR-61: lưới ma trận định nghĩa có cột cố định, ba nhóm hàng, tìm và lọc (điểm 1).

**Quyết định bổ sung (ĐỀ XUẤT; QA xác nhận):** D-55 trạng thái ô tính hoàn toàn ở máy chủ từ hồ sơ cá nhân, không nhập tay; D-56 lưới theo từng vị trí, không có lưới "mọi người × mọi chủ đề" ở giai đoạn này (chỉ thêm nếu QA cần sau khi dùng thử); D-57 "Update needed" áp dụng khi phiên bản hiệu lực của tài liệu đổi và Document Control đã xác định cần đào tạo; D-58 tên nhãn trạng thái là gợi ý và có thể đổi theo cách gọi của QA.

**Thứ tự:** gói **WP-MATRIX** (TR-57 đến TR-61), làm sau WP-OBS và độc lập với WP-PAPER; điểm 1 và 4 làm trước vì nhỏ và không đổi dữ liệu.

Lô 2026-10-20 (V628), DEV: bài kiểm tra trực tuyến (APD.0009 dạng số). Người soạn viết câu hỏi cùng nội dung (một đáp án, nhiều đáp án, đúng/sai; tối đa 100 câu; giới hạn thời gian tùy chọn); người soát xét và phê duyệt thấy đáp án; sau khi nội dung được duyệt không sửa được. Học viên chỉ làm bài sau khi giảng viên điểm danh có mặt, không bao giờ nhận đáp án, ký điện tử khi nộp (meaning TRAINING_ASSESSMENT_SIGNED); máy chủ chấm điểm và ghi `training_assessments` (method TEST). Mỗi học viên một lần làm; giảng viên giải phóng thêm lần làm kèm lý do, ghi Audit Trail (`training_exam_resets`). Hết giờ có thêm 60 giây du di, bài quá hạn bị đánh dấu EXPIRED. Tài khoản test mới: trainee.test1, trainee.test2, trainer.test1. Chưa kiểm chứng: hết giờ trên trình duyệt, nút giải phóng trên trình duyệt, đồng thời nhiều người, đề DOCX.

Lô 2026-10-20 (V629), DEV: học viên tự điểm danh. Giảng viên mở điểm danh cho buổi đã mở; mã sáu số đổi mỗi năm phút (mã cũ còn hiệu lực 60 giây); học viên nhập mã hoặc quét QR, ký điện tử, dòng thành Attended với cách xác nhận SELF. Người không có thiết bị vẫn được giảng viên đánh dấu bằng điểm danh nhanh (TRAINER_ATTESTED), không cần ghi lý do theo quyết định của chủ dự án. Chỉ người còn ở trạng thái Invited, đúng ngày của buổi, mới điểm danh được. Chưa kiểm chứng: sai ngày, đổi mã sau năm phút, giới hạn số lần nhập sai.

Điều chỉnh 2026-10-20 (theo chỉ đạo của chủ dự án): tự điểm danh (V629) **không còn chữ ký điện tử thứ hai**. Học viên đã đăng nhập, nhập hoặc quét mã của buổi học rồi bấm Confirm; dòng điểm danh ghi cách xác nhận SELF, người và thời điểm nằm trong Audit Trail. Điểm danh nhanh của giảng viên vẫn có chữ ký. Hộp thoại Check in ở My Training có nút quét QR bằng camera (bộ nhận dạng của trình duyệt hoặc jsQR), sáu ô nhập mã, Clear và Confirm. Danh sách đã xác nhận không thêm người nữa: người đến mà không có tên được đào tạo bổ sung hoặc đào tạo đột xuất; sai sót điểm danh được sửa bằng lý do, không cần chữ ký, trước khi người đó có điểm. Các quyết định này chờ QA xác nhận trong Decision Log. Ý nghĩa chữ ký TRAINING_ATTENDANCE_SELF_CONFIRMED tạo ở V629 không còn dùng (migration chỉ tiến, giữ nguyên).

Lô 2026-10-20 (V630, V631), DEV: bằng chứng đánh giá kiểu hybrid (tệp scan hoặc tệp Word đã điền, ô ghi biểu mẫu và phiên bản dùng, tùy chọn); thư viện mẫu biểu mẫu đánh giá ở Training Properties (nạp tay tệp Word, ký điện tử để đặt làm bản đang dùng, giữ mọi phiên bản); người chuẩn bị đào tạo bắt đầu từ mẫu, sửa Exam Template và Answer Key trực tiếp trong OnlyOffice (Open to Edit, Open to Edit Answer), mỗi lần Save thành tệp mới của buổi đào tạo, tệp cũ giữ lại và đánh dấu đã thay; chỉ làm được trước khi nội dung được gửi soát xét. Bộ đề in từ tệp Word được chuyển sang PDF khi in và ghi cả ba SHA-256. Chưa kiểm chứng: hai người cùng sửa, đóng thẻ trình duyệt giữa chừng, hạn mức kết nối của OnlyOffice.

Điều chỉnh 2026-10-21 (V633, theo chỉ đạo của chủ dự án): bỏ lịch ngày nghỉ (D-14, WP-DAYS) và cài đặt "số ngày làm việc gửi kết quả cho QA". SOP.0003 chỉ nhắc ngày làm việc một lần (7 ngày làm việc, mục 5.3.8) và không định nghĩa; cài đặt này chưa từng được dùng để tính hạn nào. Bảng `training_non_working_days`, dịch vụ, các đường dẫn, tab Calendar và cột `results_due_working_days` đã xóa. Quy tắc duy nhất từng dùng lịch (nhập kết quả từ bản giấy muộn cần lý do) nay đếm theo ngày lịch: quá một ngày sau buổi học thì cần lý do, không chặn. Hạn 7 ngày làm việc do con người theo dõi như SOP quy định. Các đoạn trước nói về ngày nghỉ trong tài liệu này không còn hiệu lực.

Lô 2026-10-21: workspace cho từng buổi đào tạo (mở ở tab mới từ nút Open workspace) với năm bước: Prepare, Attendance, Training, Assessment, Results. Các bước chỉ hướng dẫn, không chặn thứ tự; máy chủ vẫn giữ các luật cứng. Bước đang xem lưu trong địa chỉ và trình duyệt; dữ liệu nằm ở máy chủ nên đóng tab rồi mở lại vẫn nguyên. Chỉ ghi ngày của buổi, không ghi giờ. Đã kiểm tra bằng trình duyệt: mở tab mới, năm bước, mở lại về đúng bước cuối, không tràn ngang ở 390 px.
