# Hướng dẫn demo Document Control
*Document Control demo guide*

Mật khẩu chung: `Test@12345`. Mỗi lần ký điện tử nhập lại mật khẩu này kèm lý do.
*Shared password: `Test@12345`. For every electronic signature, enter this password again together with a reason.*

| Tài khoản / *Account* | Vai trò / *Role* |
|---|---|
| `dco.test1` | DCO: tạo Document, Publish, Upgrade, Cancel, Obsolete, toàn bộ Controlled Copy.<br>*DCO: creates Documents, Publish, Upgrade, Cancel, Obsolete, and all Controlled Copy actions.* |
| `author.test1` | Author: upload source, Edit Online, Submit for Review.<br>*Author: uploads the source, edits online, submits for review.* |
| `coauthor.test1`, `coauthor.test2` | Co-author: Edit Online (cùng sửa đồng thời).<br>*Co-author: edits online (simultaneous co-editing).* |
| `reviewer.test1`, `reviewer.test2` | Reviewer: Review, Reject Review.<br>*Reviewer: reviews or rejects the review.* |
| `approver.test1` | Approver: Approve, Reject Approval.<br>*Approver: approves or rejects the approval.* |

Dùng 3 tài liệu: **Doc A** (luồng chính, Controlled Copy, Upgrade, Obsolete), **Doc B** (Cancel Document), **Doc C** (Cancel Revision).
*Use 3 documents: **Doc A** (main flow, Controlled Copy, Upgrade, Obsolete), **Doc B** (Cancel Document), **Doc C** (Cancel Revision).*

Người nhận Controlled Copy chọn `dco.test1` (chỉ tài khoản này có quyền xem Controlled Copy).
*Choose `dco.test1` as the Controlled Copy recipient (it is the only account with permission to view Controlled Copies).*

Controlled Copies Policy phải bật *Allow Report Lost/Damaged*.
*The Controlled Copies Policy must have *Allow Report Lost/Damaged* turned on.*

---

## 1. Tạo Document (Doc A)
*1. Create a Document (Doc A)*

1. `dco.test1`: Document Control → Documents → All Documents → New Document.
   *`dco.test1`: Document Control → Documents → All Documents → New Document.*
2. General Information: nhập Document Name, Type, Business Unit, Department (bắt buộc). Author = `author.test1`, Co-Author(s) = `coauthor.test1`, `coauthor.test2`.
   *General Information: enter Document Name, Type, Business Unit, and Department (required). Set Author = `author.test1` and Co-Author(s) = `coauthor.test1`, `coauthor.test2`.*
3. Training Information: tắt "Requires Training" và nhập lý do bỏ qua training.
   *Training Information: turn off "Requires Training" and enter the reason for skipping training.*
4. Reviewers: chọn `reviewer.test1`, `reviewer.test2`. Approvers: chọn `approver.test1`.
   *Reviewers: select `reviewer.test1` and `reviewer.test2`. Approvers: select `approver.test1`.*
5. Bấm Save ở trang cha (các hộp thoại chọn người chỉ cập nhật form, phải Save mới ghi). Sau khi thành công, Document ở trạng thái **Draft**.
   *Click Save on the parent page (the people-selection dialogs only update the form; Save is what persists). After success, the Document is in **Draft** status.*

## 2. Tạo Revision và soạn thảo
*2. Create a Revision and author it*

1. `dco.test1`: mở Document → tab Document Revisions → Upload Revision. Sau khi thành công, Revision ở trạng thái **Draft**.
   *`dco.test1`: open the Document → Document Revisions tab → Upload Revision. After success, the Revision is in **Draft** status.*
2. `author.test1`: mở Revision → Upload Revision (chọn file `.docx`) → Upload to Office Online → Edit File Online để sửa nội dung.
   *`author.test1`: open the Revision → Upload Revision (choose a `.docx` file) → Upload to Office Online → Edit File Online to change the content.*
3. Cùng sửa đồng thời: mở Revision bằng `coauthor.test1` và `coauthor.test2` ở hai cửa sổ, cùng bấm Edit File Online và gõ. Co-author chỉ sửa, không có nút chuyển trạng thái.
   *Co-editing: open the Revision as `coauthor.test1` and `coauthor.test2` in two windows, both click Edit File Online, and type. A Co-author can only edit and has no status-change buttons.*
4. Author sửa xong thì không còn bước Complete Authoring: chuyển thẳng sang mục 3 để Submit for Review.
   *There is no Complete Authoring step any more: when the Author has finished editing, go straight to section 3 and Submit for Review.*

## 3. Review → Approval → Publish
*3. Review → Approval → Publish*

1. `author.test1`: mở Revision → Submit for Review → nhập lý do → ký. Nguồn được khoá khi Submit. Sau khi thành công, Revision chuyển sang **Pending Review**. (Nút Submit chỉ hiện khi Revision đã có file nguồn. Nếu sau này muốn DCO submit thay Author thì tick lại quyền trong Workflow Authorization.)
   *`author.test1`: open the Revision → Submit for Review → enter a reason → sign. Submitting locks the source. After success, the Revision moves to **Pending Review**. (The Submit button only shows once the Revision has a source file. To let DCO submit instead of the Author later, tick the right again in Workflow Authorization.)*
2. Reject Review (nhánh từ chối):
   *Reject Review (rejection branch):*
   - `reviewer.test1`: Revisions → Pending Review → mở Revision → Reject → nhập Activity Summary (bắt buộc) → ký.
     *`reviewer.test1`: Revisions → Pending Review → open the Revision → Reject → enter an Activity Summary (required) → sign.*
   - Sau khi thành công, Revision về **Draft**, nguồn được mở khoá. Hành động của **cả Reviewer lẫn Approver bị reset**, tất cả phải duyệt lại từ đầu dù chỉ một người từ chối. Snapshot PDF cũ bị xoá. Comment của lần duyệt trước vẫn được giữ.
     *After success, the Revision returns to **Draft** and the source is unlocked. The actions of **both Reviewers and Approvers are reset**, so everyone must review again from the start even if only one person rejected. The old PDF snapshot is deleted. Comments from the previous round are kept.*
   - `author.test1` sửa rồi Submit for Review lại.
     *`author.test1` edits and submits for review again.*
3. Complete Review:
   *Complete Review:*
   - `reviewer.test1`: Revisions → Pending Review → mở Revision → Complete Review → ký. Revision vẫn là **Pending Review**.
     *`reviewer.test1`: Revisions → Pending Review → open the Revision → Complete Review → sign. The Revision stays in **Pending Review**.*
   - `reviewer.test2`: làm tương tự. Khi **tất cả** Reviewer hoàn tất, Revision chuyển sang **Pending Approval**.
     *`reviewer.test2`: do the same. When **all** Reviewers have completed, the Revision moves to **Pending Approval**.*
4. Reject Approval (nhánh từ chối, có thể demo trước khi Approve):
   *Reject Approval (rejection branch, can be demonstrated before Approve):*
   - `approver.test1`: Revisions → Pending Approval → mở Revision → Reject → nhập Activity Summary → ký.
     *`approver.test1`: Revisions → Pending Approval → open the Revision → Reject → enter an Activity Summary → sign.*
   - Kết quả giống Reject Review: Revision về **Draft**, nguồn mở khoá, mọi lượt duyệt bị reset.
     *The result is the same as Reject Review: the Revision returns to **Draft**, the source is unlocked, and all approval rounds are reset.*
5. Complete Approval: `approver.test1`: Revisions → Pending Approval → mở Revision → Complete Approval → ký. Sau khi thành công, Revision chuyển sang **Ready for Publishing** (hoặc **Pending Training** nếu bật Training; nếu có nhiều Approver thì vẫn **Pending Approval** cho tới khi tất cả xong).
   *Complete Approval: `approver.test1`: Revisions → Pending Approval → open the Revision → Complete Approval → sign. After success, the Revision moves to **Ready for Publishing** (or **Pending Training** if Training is on; with several Approvers it stays in **Pending Approval** until all have finished).*
6. Publish: `dco.test1`: mở Revision → Open Publishing Workspace → chọn template, xem trước → Publish → ký. PDF cuối được tạo nền, đợi vài giây. Sau khi thành công:
   *Publish: `dco.test1`: open the Revision → Open Publishing Workspace → choose a template and preview → Publish → sign. The final PDF is generated in the background, so wait a few seconds. After success:*
   - Revision chuyển sang **Effective**, Document chuyển sang **Active**.
     *The Revision moves to **Effective** and the Document moves to **Active**.*
   - Tab Document hiện PDF đã publish; tab Signatures và Audit Trail ghi đủ các lần ký.
     *The Document tab shows the published PDF; the Signatures and Audit Trail tabs record every signature.*

## 4. Cancel Document (Doc B)
*4. Cancel Document (Doc B)*

1. `dco.test1` tạo Document mới, Save, **không tạo Revision**. Chỉ `dco.test1` có quyền Cancel Document (Author và các vai trò khác không có nút này).
   *`dco.test1` creates a new Document, clicks Save, and **does not create a Revision**. Only `dco.test1` may Cancel a Document (the Author and other roles do not have this button).*
2. Mở Document Detail → Cancel → nhập Activity Summary (bắt buộc) → xác nhận.
   *Open Document Detail → Cancel → enter an Activity Summary (required) → confirm.*
3. Sau khi thành công, Document chuyển sang **Closed – Cancelled**. Hệ thống ghi lại người huỷ, thời điểm huỷ, trạng thái trước khi đóng (Draft) và một dòng CANCEL trong Audit Trail.
   *After success, the Document moves to **Closed – Cancelled**. The system records who cancelled it, when, the status before closing (Draft), and a CANCEL entry in the Audit Trail.*
4. Lưu ý: nếu Document đã có Revision (dù ở trạng thái nào), hệ thống từ chối Cancel và yêu cầu dùng Obsolete.
   *Note: if the Document already has a Revision (in any status), the system refuses Cancel and requires Obsolete instead.*
5. Mở lại: Admin có quyền `documents.document.reopen` mở Document Detail → Reopen → nhập lý do → ký. Document về **Draft**. (`dco.test1` không có quyền Reopen.)
   *Reopening: an Admin with the `documents.document.reopen` permission opens Document Detail → Reopen → enters a reason → signs. The Document returns to **Draft**. (`dco.test1` does not have the Reopen permission.)*

## 5. Cancel Revision (Doc C)
*5. Cancel Revision (Doc C)*

1. `dco.test1` tạo Document và Revision mới, giữ Revision ở **Draft**. Chỉ `dco.test1` có quyền Cancel Revision trong 7 tài khoản này.
   *`dco.test1` creates a new Document and Revision and keeps the Revision in **Draft**. Among these 7 accounts, only `dco.test1` may Cancel a Revision.*
2. Mở Revision Detail → Cancel Revision → nhập Activity Summary (bắt buộc) → ký.
   *Open Revision Detail → Cancel Revision → enter an Activity Summary (required) → sign.*
3. Sau khi thành công, Revision chuyển sang **Closed – Cancelled**, Author nhận thông báo.
   *After success, the Revision moves to **Closed – Cancelled** and the Author receives a notification.*
   - Vì đây là Revision đầu tiên (Document chưa từng Effective), Document **tự động chuyển Closed – Cancelled** do không còn Revision nào. Giao diện báo "The document was automatically closed because no revisions remain."
     *Because this is the first Revision (the Document was never Effective), the Document **automatically moves to Closed – Cancelled** since no Revisions remain. The UI shows "The document was automatically closed because no revisions remain."*
4. Lưu ý: chỉ huỷ được khi Revision đang **Draft**. Từ Pending Review trở đi không huỷ được.
   *Note: a Revision can be cancelled only while it is in **Draft**. From Pending Review onward it cannot be cancelled.*
5. Nếu huỷ một Draft upgrade (Document đang có Revision Effective, xem mục 10): Revision Draft → **Closed – Cancelled**, còn Document **giữ Active** và Revision Effective **giữ Effective**.
   *If you cancel an upgrade Draft (the Document already has an Effective Revision, see section 10): the Draft Revision → **Closed – Cancelled**, while the Document **stays Active** and the Effective Revision **stays Effective**.*

## 6. Controlled Copy: Request và Distribute (Doc A đang Effective)
*6. Controlled Copy: Request and Distribute (Doc A is Effective)*

Tạo 4 copy, mỗi copy một kết cục:
*Create 4 copies, each with a different outcome:*

| Copy | Kết cục / *Outcome* |
|---|---|
| #1 | Distribute rồi Recall<br>*Distribute, then Recall* |
| #2 | Distribute rồi Report Lost/Damaged rồi Reissue<br>*Distribute, then Report Lost/Damaged, then Reissue* |
| #3 | Cancel Request khi còn Ready for Distribution<br>*Cancel Request while still Ready for Distribution* |
| #4 | Distribute và để nguyên; tự Obsoleted khi Upgrade<br>*Distribute and leave as is; becomes Obsoleted automatically on Upgrade* |

1. Request: `dco.test1`: mở Document A (Effective) → Request Controlled Copy. Điền Distribution Details, Usage Purpose, Distribution List, người nhận `dco.test1`, số lượng 1, địa điểm → ký.
   *Request: `dco.test1`: open Document A (Effective) → Request Controlled Copy. Fill in Distribution Details, Usage Purpose, Distribution List, recipient `dco.test1`, quantity 1, and location → sign.*
   - Sau khi thành công, copy ở trạng thái **Ready for Distribution**. Một chữ ký cho cả batch. Chỉ Revision **Effective** mới Request được. Người không có quyền đặc biệt chỉ được yêu cầu 1 copy nội bộ cho chính mình.
     *After success, the copy is in **Ready for Distribution** status. One signature covers the whole batch. Only an **Effective** Revision can be requested. A user without special permission may request only 1 internal copy for themselves.*
   - Lặp lại để có đủ 4 copy.
     *Repeat to get all 4 copies.*
2. Controlled Copies → Ready for Distribution để xem danh sách chờ phát.
   *Controlled Copies → Ready for Distribution to see the list waiting to be distributed.*
3. Distribute copy #1, #2, #4: `dco.test1`: menu More actions trên dòng copy → Distribute → nhập comment (bắt buộc) → ký. Quá trình chạy nền, có cửa sổ tiến trình.
   *Distribute copies #1, #2, #4: `dco.test1`: More actions menu on the copy row → Distribute → enter a comment (required) → sign. The process runs in the background with a progress window.*
   - Sau khi thành công, copy chuyển sang **Distributed**. Mỗi copy có PDF riêng, có checksum, lưu bất biến. Hạn dùng tính từ lúc Distribute. Người nhận nhận thông báo.
     *After success, the copy moves to **Distributed**. Each copy has its own PDF with a checksum, stored immutably. The expiry is counted from the moment of Distribute. The recipient receives a notification.*
4. Cancel Request copy #3: `dco.test1`: menu More actions → Cancel Request → nhập lý do → ký.
   *Cancel Request on copy #3: `dco.test1`: More actions menu → Cancel Request → enter a reason → sign.*
   - Sau khi thành công, copy chuyển sang **Closed – Cancelled**. Không có lý do Obsolete vì copy chưa từng có hiệu lực.
     *After success, the copy moves to **Closed – Cancelled**. There is no Obsolete reason because the copy never took effect.*
   - Lưu ý: chỉ huỷ được khi còn **Ready for Distribution**. Copy đã **Distributed** (như #1) không bao giờ Cancel được; phải dùng Recall. Cancel cả batch chỉ huỷ các copy chưa phát, bỏ qua copy đã Distributed.
     *Note: cancellation is possible only while the copy is still **Ready for Distribution**. A copy that is already **Distributed** (like #1) can never be cancelled; use Recall. Cancelling a whole batch cancels only the copies not yet distributed and skips those already Distributed.*

## 7. Recall (copy #1)
*7. Recall (copy #1)*

1. `dco.test1`: Controlled Copies → Distributed → menu More actions của copy #1 → Recall.
   *`dco.test1`: Controlled Copies → Distributed → More actions menu of copy #1 → Recall.*
2. Nhập Reason for Recall (bắt buộc) và Recall Date → ký. Có thể thu hồi theo batch, hoặc thu hồi hàng loạt bằng Recall by Scan (file PDF quét).
   *Enter the Reason for Recall (required) and the Recall Date → sign. You can recall by batch, or recall in bulk with Recall by Scan (scanned PDF file).*
3. Sau khi thành công, copy chuyển sang **Obsoleted**, lý do **RECALLED**. Ghi lại người thu hồi và thời điểm.
   *After success, the copy moves to **Obsoleted** with reason **RECALLED**. The person who recalled it and the time are recorded.*
4. Lưu ý: chỉ thu hồi được copy **Distributed**. **Bản bị thu hồi không Reissue được.**
   *Note: only a **Distributed** copy can be recalled. **A recalled copy cannot be reissued.***

## 8. Báo mất/hỏng và Reissue (copy #2)
*8. Report Lost/Damaged and Reissue (copy #2)*

1. Report Lost/Damaged: `dco.test1`: menu More actions của copy #2 → Report Lost/Damaged → chọn Lost hoặc Damaged.
   *Report Lost/Damaged: `dco.test1`: More actions menu of copy #2 → Report Lost/Damaged → choose Lost or Damaged.*
2. Điền Destruction Date (không ở tương lai), người thực hiện, Witness, phương thức, lý do.
   *Fill in the Destruction Date (not in the future), the person performing, the Witness, the method, and the reason.*
   - Người thực hiện và Witness phải là hai người khác nhau.
     *The person performing and the Witness must be two different people.*
   - Damaged: bắt buộc đính kèm ít nhất 1 file bằng chứng. Lost: không bắt buộc.
     *Damaged: at least 1 evidence file must be attached. Lost: not required.*
3. Ký. Sau khi thành công, copy chuyển sang **Obsoleted**, lý do **LOST** hoặc **DAMAGED**. Chỉ làm được khi copy đang **Distributed** và Controlled Copies Policy cho phép.
   *Sign. After success, the copy moves to **Obsoleted** with reason **LOST** or **DAMAGED**. This is possible only while the copy is **Distributed** and the Controlled Copies Policy allows it.*
4. Reissue: `dco.test1`: menu More actions của copy #2 → Reissue Copy → nhập lý do → ký.
   *Reissue: `dco.test1`: More actions menu of copy #2 → Reissue Copy → enter a reason → sign.*
   - Sau khi thành công, hệ thống tạo **copy mới** (số copy mới, batch mới) ở **Ready for Distribution**. Bản gốc **giữ nguyên Obsoleted**.
     *After success, the system creates a **new copy** (new copy number, new batch) in **Ready for Distribution**. The original **stays Obsoleted**.*
   - Bản mới giữ người nhận, địa điểm, mục đích và **hạn dùng của bản gốc**; có liên kết "Reissued From" / "Replaced By".
     *The new copy keeps the recipient, location, purpose, and the **original's expiry**; it is linked through "Reissued From" / "Replaced By".*
   - Lưu ý: chỉ Reissue được bản gốc Obsoleted vì Lost/Damaged (không dùng cho Recalled hoặc hết hạn), và mỗi bản gốc chỉ **một lần**. Bấm lần hai báo "already been replaced".
     *Note: only an original that was Obsoleted because of Lost/Damaged can be reissued (not Recalled or expired), and each original only **once**. A second click shows "already been replaced".*
5. Distribute copy mới (comment bắt buộc, ký). Copy chuyển sang **Distributed**.
   *Distribute the new copy (comment required, sign). The copy moves to **Distributed**.*

## 9. Hết hạn
*9. Expiry*

Không có thao tác thủ công. Job tự động chạy lúc 02:00 hằng ngày: copy **Distributed** quá hạn chuyển sang **Obsoleted**, lý do **EXPIRED**. Hệ thống nhắc qua email trước 7 ngày, không đổi trạng thái.
*There is no manual action. An automatic job runs at 02:00 every day: a **Distributed** copy past its expiry moves to **Obsoleted** with reason **EXPIRED**. The system sends an email reminder 7 days before, without changing the status.*

## 10. Upgrade lên Revision mới (Doc A)
*10. Upgrade to a new Revision (Doc A)*

1. `dco.test1`: mở Document A (Active) → Edit Revision for Upgrade. Chỉnh Author/Co-author, Reviewers, Approvers, Related/Correlated Documents, Training cho bản kế tiếp, rồi lưu. Chỉ làm được khi Document Active, có Revision Effective và không có Revision nào đang dở.
   *`dco.test1`: open Document A (Active) → Edit Revision for Upgrade. Adjust the Author/Co-author, Reviewers, Approvers, Related/Correlated Documents, and Training for the next version, then save. This is possible only when the Document is Active, has an Effective Revision, and has no Revision in progress.*
2. Bấm Upload Revision để tạo Draft mới. Sau khi thành công, Revision mới ở **Draft** và **không kế thừa file nguồn**; Revision cũ giữ **Effective** cho tới khi bản mới được Publish. Nút đổi tên thành Adjust Upgrade Configuration.
   *Click Upload Revision to create the new Draft. After success, the new Revision is in **Draft** and **does not inherit the source file**; the old Revision stays **Effective** until the new one is Published. The button is renamed Adjust Upgrade Configuration.*
3. `author.test1`: Revision mới chưa có file nguồn nên nút Submit for Review không hiện. Upload Revision bằng file `.docx` mới → Edit Online → Submit for Review → ký.
   *`author.test1`: the new Revision has no source file yet, so the Submit for Review button does not show. Upload Revision with a new `.docx` file → Edit Online → Submit for Review → sign.*
4. Lặp lại mục 3 (Author Submit, Review bởi cả hai Reviewer, Approval, Publish).
   *Repeat section 3 (Author submits, Review by both Reviewers, Approval, Publish).*
5. Sau khi Publish thành công:
   *After a successful Publish:*
   - Revision mới → **Effective**, Revision cũ → **Obsoleted** (ghi "Superseded by published revision").
     *The new Revision → **Effective**, the old Revision → **Obsoleted** (recorded as "Superseded by published revision").*
   - Copy #4 (và mọi copy Ready/Distributed của Revision cũ) tự → **Obsoleted**, lý do **NEW_REVISION_PUBLISHED**.
     *Copy #4 (and every Ready/Distributed copy of the old Revision) automatically → **Obsoleted** with reason **NEW_REVISION_PUBLISHED**.*
   - Document Master chỉ trỏ tới PDF của Revision mới.
     *The Document Master points only to the new Revision's PDF.*

## 11. Obsolete Document
*11. Obsolete Document*

1. `dco.test1`: mở Document A (Active) → Obsolete Document → nhập lý do (bắt buộc) → ký.
   *`dco.test1`: open Document A (Active) → Obsolete Document → enter a reason (required) → sign.*
2. Điều kiện: Document Active, có Revision Effective, và không còn Revision nào đang dở (Draft, Pending Review, Pending Approval, Pending Training, Ready for Publishing). Nếu còn thì hệ thống chặn.
   *Conditions: the Document is Active, has an Effective Revision, and no Revision is still in progress (Draft, Pending Review, Pending Approval, Pending Training, Ready for Publishing). Otherwise the system blocks it.*
3. Sau khi thành công:
   *After success:*
   - Document → **Obsoleted**.
     *The Document → **Obsoleted**.*
   - Mọi Revision chưa Obsoleted/Cancelled → **Obsoleted**.
     *Every Revision that is not yet Obsoleted/Cancelled → **Obsoleted**.*
   - Mọi Controlled Copy đang Ready for Distribution hoặc Distributed → **Obsoleted**, lý do **DOCUMENT_OBSOLETED**. Copy đã Closed – Cancelled giữ nguyên.
     *Every Controlled Copy that is Ready for Distribution or Distributed → **Obsoleted** with reason **DOCUMENT_OBSOLETED**. Copies already Closed – Cancelled stay unchanged.*
   - Người liên quan nhận thông báo.
     *The people involved receive notifications.*
4. Không có nút Obsolete Revision riêng: Revision chỉ chuyển Obsoleted khi bản kế tiếp được Publish (mục 10) hoặc khi Obsolete cả Document.
   *There is no separate Obsolete Revision button: a Revision becomes Obsoleted only when its successor is Published (section 10) or when the whole Document is Obsoleted.*
5. Mở lại: Admin có quyền `documents.document.reopen` mở Document Detail → Reopen → nhập lý do → ký. Document về **Active**. Revision và Controlled Copy đã Obsoleted **không** được khôi phục; muốn dùng lại phải tạo Revision mới đi qua duyệt và cấp Controlled Copy mới.
   *Reopening: an Admin with the `documents.document.reopen` permission opens Document Detail → Reopen → enters a reason → signs. The Document returns to **Active**. Revisions and Controlled Copies that were Obsoleted are **not** restored; to use the document again, create a new Revision that goes through approval and issue new Controlled Copies.*

## 12. Kiểm chứng
*12. Verification*

Xem Audit Trail và Signatures của Document, Revision và từng Controlled Copy (REQUEST, DISTRIBUTE, RECALL, REPORT/DESTROY, REPLACE, OBSOLETE). Controlled Copies → All / Ready / Distributed để lọc theo trạng thái.
*Review the Audit Trail and Signatures of the Document, the Revision, and each Controlled Copy (REQUEST, DISTRIBUTE, RECALL, REPORT/DESTROY, REPLACE, OBSOLETE). Use Controlled Copies → All / Ready / Distributed to filter by status.*

Việc xem, in, tải copy chỉ dành cho Recipient, Owner hoặc DCO; in và tải có hạn mức, in không đổi trạng thái; copy Obsoleted hoặc Cancelled hiện thông báo lý do thay vì nội dung.
*Viewing, printing, and downloading a copy is limited to the Recipient, Owner, or DCO; printing and downloading have quotas, printing does not change the status; an Obsoleted or Cancelled copy shows a reason message instead of its content.*
