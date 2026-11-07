# Hướng dẫn demo Document Control

Mật khẩu chung: `Test@12345`. Mỗi lần ký điện tử nhập lại mật khẩu này kèm lý do.

| Tài khoản | Vai trò |
|---|---|
| `dco.test1` | DCO: tạo Document, Publish, Upgrade, Cancel, Obsolete, toàn bộ Controlled Copy |
| `author.test1` | Author: upload source, Edit Online, Submit for Review |
| `coauthor.test1`, `coauthor.test2` | Co-author: Edit Online (cùng sửa đồng thời) |
| `reviewer.test1`, `reviewer.test2` | Reviewer: Review, Reject Review |
| `approver.test1` | Approver: Approve, Reject Approval |

Dùng 3 tài liệu: **Doc A** (luồng chính, Controlled Copy, Upgrade, Obsolete), **Doc B** (Cancel Document), **Doc C** (Cancel Revision).
Người nhận Controlled Copy chọn `dco.test1` (chỉ tài khoản này có quyền xem Controlled Copy).
Controlled Copies Policy phải bật *Allow Report Lost/Damaged*.

---

## 1. Tạo Document (Doc A)

1. `dco.test1`: Document Control → Documents → All Documents → New Document.
2. General Information: nhập Document Name, Type, Business Unit, Department (bắt buộc). Author = `author.test1`, Co-Author(s) = `coauthor.test1`, `coauthor.test2`.
3. Training Information: tắt "Requires Training" và nhập lý do bỏ qua training.
4. Reviewers: chọn `reviewer.test1`, `reviewer.test2`. Approvers: chọn `approver.test1`.
5. Bấm Save ở trang cha (các hộp thoại chọn người chỉ cập nhật form, phải Save mới ghi). Sau khi thành công, Document ở trạng thái **Draft**.

## 2. Tạo Revision và soạn thảo

1. `dco.test1`: mở Document → tab Document Revisions → Upload Revision. Sau khi thành công, Revision ở trạng thái **Draft**.
2. `author.test1`: mở Revision → Upload Revision (chọn file `.docx`) → Upload to Office Online → Edit File Online để sửa nội dung.
3. Cùng sửa đồng thời: mở Revision bằng `coauthor.test1` và `coauthor.test2` ở hai cửa sổ, cùng bấm Edit File Online và gõ. Co-author chỉ sửa, không có nút chuyển trạng thái.
4. Author sửa xong thì không còn bước Complete Authoring: chuyển thẳng sang mục 3 để Submit for Review.

## 3. Review → Approval → Publish

1. `author.test1`: mở Revision → Submit for Review → nhập lý do → ký. Nguồn được khoá khi Submit. Sau khi thành công, Revision chuyển sang **Pending Review**. (Nút Submit chỉ hiện khi Revision đã có file nguồn. Nếu sau này muốn DCO submit thay Author thì tick lại quyền trong Workflow Authorization.)
2. Reject Review (nhánh từ chối):
   - `reviewer.test1`: Revisions → Pending Review → mở Revision → Reject → nhập Activity Summary (bắt buộc) → ký.
   - Sau khi thành công, Revision về **Draft**, nguồn được mở khoá. Hành động của **cả Reviewer lẫn Approver bị reset**, tất cả phải duyệt lại từ đầu dù chỉ một người từ chối. Snapshot PDF cũ bị xoá. Comment của lần duyệt trước vẫn được giữ.
   - `author.test1` sửa rồi Submit for Review lại.
3. Complete Review:
   - `reviewer.test1`: Revisions → Pending Review → mở Revision → Complete Review → ký. Revision vẫn là **Pending Review**.
   - `reviewer.test2`: làm tương tự. Khi **tất cả** Reviewer hoàn tất, Revision chuyển sang **Pending Approval**.
4. Reject Approval (nhánh từ chối, có thể demo trước khi Approve):
   - `approver.test1`: Revisions → Pending Approval → mở Revision → Reject → nhập Activity Summary → ký.
   - Kết quả giống Reject Review: Revision về **Draft**, nguồn mở khoá, mọi lượt duyệt bị reset.
5. Complete Approval: `approver.test1`: Revisions → Pending Approval → mở Revision → Complete Approval → ký. Sau khi thành công, Revision chuyển sang **Ready for Publishing** (hoặc **Pending Training** nếu bật Training; nếu có nhiều Approver thì vẫn **Pending Approval** cho tới khi tất cả xong).
6. Publish: `dco.test1`: mở Revision → Open Publishing Workspace → chọn template, xem trước → Publish → ký. PDF cuối được tạo nền, đợi vài giây. Sau khi thành công:
   - Revision chuyển sang **Effective**, Document chuyển sang **Active**.
   - Tab Document hiện PDF đã publish; tab Signatures và Audit Trail ghi đủ các lần ký.

## 4. Cancel Document (Doc B)

1. `dco.test1` tạo Document mới, Save, **không tạo Revision**. Chỉ `dco.test1` có quyền Cancel Document (Author và các vai trò khác không có nút này).
2. Mở Document Detail → Cancel → nhập Activity Summary (bắt buộc) → xác nhận.
3. Sau khi thành công, Document chuyển sang **Closed – Cancelled**. Hệ thống ghi lại người huỷ, thời điểm huỷ, trạng thái trước khi đóng (Draft) và một dòng CANCEL trong Audit Trail.
4. Lưu ý: nếu Document đã có Revision (dù ở trạng thái nào), hệ thống từ chối Cancel và yêu cầu dùng Obsolete.
5. Mở lại: Admin có quyền `documents.document.reopen` mở Document Detail → Reopen → nhập lý do → ký. Document về **Draft**. (`dco.test1` không có quyền Reopen.)

## 5. Cancel Revision (Doc C)

1. `dco.test1` tạo Document và Revision mới, giữ Revision ở **Draft**. Chỉ `dco.test1` có quyền Cancel Revision trong 7 tài khoản này.
2. Mở Revision Detail → Cancel Revision → nhập Activity Summary (bắt buộc) → ký.
3. Sau khi thành công, Revision chuyển sang **Closed – Cancelled**, Author nhận thông báo.
   - Vì đây là Revision đầu tiên (Document chưa từng Effective), Document **tự động chuyển Closed – Cancelled** do không còn Revision nào. Giao diện báo "The document was automatically closed because no revisions remain."
4. Lưu ý: chỉ huỷ được khi Revision đang **Draft**. Từ Pending Review trở đi không huỷ được.
5. Nếu huỷ một Draft upgrade (Document đang có Revision Effective, xem mục 10): Revision Draft → **Closed – Cancelled**, còn Document **giữ Active** và Revision Effective **giữ Effective**.

## 6. Controlled Copy: Request và Distribute (Doc A đang Effective)

Tạo 4 copy, mỗi copy một kết cục:

| Copy | Kết cục |
|---|---|
| #1 | Distribute rồi Recall |
| #2 | Distribute rồi Report Lost/Damaged rồi Reissue |
| #3 | Cancel Request khi còn Ready for Distribution |
| #4 | Distribute và để nguyên; tự Obsoleted khi Upgrade |

1. Request: `dco.test1`: mở Document A (Effective) → Request Controlled Copy. Điền Distribution Details, Usage Purpose, Distribution List, người nhận `dco.test1`, số lượng 1, địa điểm → ký.
   - Sau khi thành công, copy ở trạng thái **Ready for Distribution**. Một chữ ký cho cả batch. Chỉ Revision **Effective** mới Request được. Người không có quyền đặc biệt chỉ được yêu cầu 1 copy nội bộ cho chính mình.
   - Lặp lại để có đủ 4 copy.
2. Controlled Copies → Ready for Distribution để xem danh sách chờ phát.
3. Distribute copy #1, #2, #4: `dco.test1`: menu More actions trên dòng copy → Distribute → nhập comment (bắt buộc) → ký. Quá trình chạy nền, có cửa sổ tiến trình.
   - Sau khi thành công, copy chuyển sang **Distributed**. Mỗi copy có PDF riêng, có checksum, lưu bất biến. Hạn dùng tính từ lúc Distribute. Người nhận nhận thông báo.
4. Cancel Request copy #3: `dco.test1`: menu More actions → Cancel Request → nhập lý do → ký.
   - Sau khi thành công, copy chuyển sang **Closed – Cancelled**. Không có lý do Obsolete vì copy chưa từng có hiệu lực.
   - Lưu ý: chỉ huỷ được khi còn **Ready for Distribution**. Copy đã **Distributed** (như #1) không bao giờ Cancel được; phải dùng Recall. Cancel cả batch chỉ huỷ các copy chưa phát, bỏ qua copy đã Distributed.

## 7. Recall (copy #1)

1. `dco.test1`: Controlled Copies → Distributed → menu More actions của copy #1 → Recall.
2. Nhập Reason for Recall (bắt buộc) và Recall Date → ký. Có thể thu hồi theo batch, hoặc thu hồi hàng loạt bằng Recall by Scan (file PDF quét).
3. Sau khi thành công, copy chuyển sang **Obsoleted**, lý do **RECALLED**. Ghi lại người thu hồi và thời điểm.
4. Lưu ý: chỉ thu hồi được copy **Distributed**. **Bản bị thu hồi không Reissue được.**

## 8. Báo mất/hỏng và Reissue (copy #2)

1. Report Lost/Damaged: `dco.test1`: menu More actions của copy #2 → Report Lost/Damaged → chọn Lost hoặc Damaged.
2. Điền Destruction Date (không ở tương lai), người thực hiện, Witness, phương thức, lý do.
   - Người thực hiện và Witness phải là hai người khác nhau.
   - Damaged: bắt buộc đính kèm ít nhất 1 file bằng chứng. Lost: không bắt buộc.
3. Ký. Sau khi thành công, copy chuyển sang **Obsoleted**, lý do **LOST** hoặc **DAMAGED**. Chỉ làm được khi copy đang **Distributed** và Controlled Copies Policy cho phép.
4. Reissue: `dco.test1`: menu More actions của copy #2 → Reissue Copy → nhập lý do → ký.
   - Sau khi thành công, hệ thống tạo **copy mới** (số copy mới, batch mới) ở **Ready for Distribution**. Bản gốc **giữ nguyên Obsoleted**.
   - Bản mới giữ người nhận, địa điểm, mục đích và **hạn dùng của bản gốc**; có liên kết "Reissued From" / "Replaced By".
   - Lưu ý: chỉ Reissue được bản gốc Obsoleted vì Lost/Damaged (không dùng cho Recalled hoặc hết hạn), và mỗi bản gốc chỉ **một lần**. Bấm lần hai báo "already been replaced".
5. Distribute copy mới (comment bắt buộc, ký). Copy chuyển sang **Distributed**.

## 9. Hết hạn

Không có thao tác thủ công. Job tự động chạy lúc 02:00 hằng ngày: copy **Distributed** quá hạn chuyển sang **Obsoleted**, lý do **EXPIRED**. Hệ thống nhắc qua email trước 7 ngày, không đổi trạng thái.

## 10. Upgrade lên Revision mới (Doc A)

1. `dco.test1`: mở Document A (Active) → Edit Revision for Upgrade. Chỉnh Author/Co-author, Reviewers, Approvers, Related/Correlated Documents, Training cho bản kế tiếp, rồi lưu. Chỉ làm được khi Document Active, có Revision Effective và không có Revision nào đang dở.
2. Bấm Upload Revision để tạo Draft mới. Sau khi thành công, Revision mới ở **Draft** và **không kế thừa file nguồn**; Revision cũ giữ **Effective** cho tới khi bản mới được Publish. Nút đổi tên thành Adjust Upgrade Configuration.
3. `author.test1`: Revision mới chưa có file nguồn nên nút Submit for Review không hiện. Upload Revision bằng file `.docx` mới → Edit Online → Submit for Review → ký.
4. Lặp lại mục 3 (Author Submit, Review bởi cả hai Reviewer, Approval, Publish).
5. Sau khi Publish thành công:
   - Revision mới → **Effective**, Revision cũ → **Obsoleted** (ghi "Superseded by published revision").
   - Copy #4 (và mọi copy Ready/Distributed của Revision cũ) tự → **Obsoleted**, lý do **NEW_REVISION_PUBLISHED**.
   - Document Master chỉ trỏ tới PDF của Revision mới.

## 11. Obsolete Document

1. `dco.test1`: mở Document A (Active) → Obsolete Document → nhập lý do (bắt buộc) → ký.
2. Điều kiện: Document Active, có Revision Effective, và không còn Revision nào đang dở (Draft, Pending Review, Pending Approval, Pending Training, Ready for Publishing). Nếu còn thì hệ thống chặn.
3. Sau khi thành công:
   - Document → **Obsoleted**.
   - Mọi Revision chưa Obsoleted/Cancelled → **Obsoleted**.
   - Mọi Controlled Copy đang Ready for Distribution hoặc Distributed → **Obsoleted**, lý do **DOCUMENT_OBSOLETED**. Copy đã Closed – Cancelled giữ nguyên.
   - Người liên quan nhận thông báo.
4. Không có nút Obsolete Revision riêng: Revision chỉ chuyển Obsoleted khi bản kế tiếp được Publish (mục 10) hoặc khi Obsolete cả Document.
5. Mở lại: Admin có quyền `documents.document.reopen` mở Document Detail → Reopen → nhập lý do → ký. Document về **Active**. Revision và Controlled Copy đã Obsoleted **không** được khôi phục; muốn dùng lại phải tạo Revision mới đi qua duyệt và cấp Controlled Copy mới.

## 12. Kiểm chứng

Xem Audit Trail và Signatures của Document, Revision và từng Controlled Copy (REQUEST, DISTRIBUTE, RECALL, REPORT/DESTROY, REPLACE, OBSOLETE). Controlled Copies → All / Ready / Distributed để lọc theo trạng thái. Việc xem, in, tải copy chỉ dành cho Recipient, Owner hoặc DCO; in và tải có hạn mức, in không đổi trạng thái; copy Obsoleted hoặc Cancelled hiện thông báo lý do thay vì nội dung.
