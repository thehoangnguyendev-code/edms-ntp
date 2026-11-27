# Kế hoạch: soạn tiếp từ bản Effective và so sánh với bản Effective trước

Ngày 2026-11-27. Trạng thái: **đã làm xong ngày 2026-11-27, chưa commit** (hồ sơ: `eqms-backend/docs/validation/DOC_NEXT_REVISION_FROM_EFFECTIVE_AND_COMPARE_2026_11_27_CHANGE_RECORD.md`; cảnh báo đặt trên màn hình thay vì trong modal ký). Quyết định: `DEC-DOC-2026-11-27-01` trong
`eqms-backend/docs/governance/DECISION_LOG.md`. Đây không phải phê duyệt GMP.

## 1. Quyết định của chủ hệ thống

| Mã | Nội dung |
|---|---|
| D1 | Có hai tuỳ chọn khi tạo file cho revision mới: dùng file của bản Effective, hoặc upload file mới. |
| D2 | **Không chặn** khi còn tracked changes hoặc comment; chỉ cảnh báo (thay quyết định trước, `DEC-DOC-2026-11-27-02`). |
| D3 | Bản so sánh chỉ để xem, không lưu làm hồ sơ. |
| D4 | Ai đang được xem bản Draft đó thì được so sánh; không tải về. |

## 2. Hiện trạng (đã đọc mã nguồn)

- DOCX nguồn và PDF phát hành đã là hai file riêng. PDF được ghép header/footer trên bản sao tạm. **Không phải đổi bước Publish.**
- Có hai đường tạo bản Draft nâng cấp, cả hai đều chưa có file:
  1. DCO "Edit Revision for Upgrade", sau đó Author upload: `RevisionService.createRevisionAndUploadFile`.
  2. Upgrade session: `RevisionService.upgradeDocumentRevision` tạo Draft, file được upload sau: `RevisionService.uploadRevisionFile`.
- `cloneRevisionFile` (dùng cho template) thay chuỗi `{{...}}` trong file, nên **không dùng nguyên** cho việc nâng cấp.
- `applyOnlyOfficeEditedContent` xoá file cũ bị thay thế. Vì vậy bản Draft **bắt buộc** có đối tượng lưu trữ riêng, không được trỏ
  chung vào file của bản Effective.
- Chưa thấy bước nào kiểm tra tracked changes hoặc comment trước khi Submit, Review, Approve.

## 3. Phần A: dùng file của bản Effective (D1)

**Giao diện** (`UploadRevisionModal`, dùng ở `NewDocumentView`, `DetailDocumentView`, `RevisionCreateView`):
- Chọn nguồn file: "Dùng file của bản Effective (Rev. x)" hoặc "Upload file mới". Tuỳ chọn template hiện có giữ nguyên.
- Tuỳ chọn thứ nhất bị tắt, có ghi lý do, khi tài liệu chưa có bản Effective hoặc bản Effective không có DOCX (tài liệu legacy chỉ có PDF).
- Server trả cờ cho biết có dùng được không; giao diện không tự suy ra từ chữ hiển thị.

**Server:**
- Đường 1: thêm cờ `useEffectiveSource` vào `RevisionCreationRequest`. Không nhận cùng lúc với file hoặc template.
- Đường 2: thêm endpoint `POST /api/revisions/{id}/source-from-effective`.
- Cùng một bộ kiểm tra như upload: quyền `documents.revision.upload_source`, trạng thái Draft, source chưa khoá, không có revision khác đang mở.
- Nguồn là revision **có trạng thái EFFECTIVE**, tìm theo trạng thái. Không dùng "revision tạo gần nhất", vì đó có thể là bản đã huỷ.
- Sao chép **nguyên byte**, quét virus và kiểm tra DOCX như upload; checksum bản sao phải bằng checksum bản nguồn.
- Tên file theo quy tắc hiện tại `<Tên tài liệu>_<Revision>.docx`.
- Audit Trail: sự kiện riêng, ghi số revision nguồn và checksum.

## 4. Phần B: cảnh báo tracked changes và comment (D2)

- Bộ đọc DOCX mới, chỉ đọc: đếm tracked changes (thân, header, footer, footnote, endnote) và comment chưa Resolve.
- Hiện số lượng trong modal xác nhận của Submit for Review, Complete Review, Complete Approval. **Không bước nào bị chặn.**
- Số đếm đọc từ file đã lưu trên server, có thể chậm hơn phiên editor đang mở; vì chỉ là cảnh báo nên không đợi force save.
- **Chưa kiểm chứng:** PDF phát hành hiển thị tracked changes và comment còn sót như thế nào. Thử ở bước C0.
- Tracked changes còn sót sẽ theo file sang revision sau khi chọn "dùng file của bản Effective", và hiện lẫn trong bản so sánh.

## 5. Phần C: so sánh với bản Effective (D3, D4)

**Bước C0, thử nghiệm trước (chưa viết tính năng):** trên DEV, so sánh hai bản của một SOP thật bằng OnlyOffice 9.4.0.1.
Đạt khi: (1) server tạo được file kết quả không cần người thao tác; (2) giấy phép bản đang dùng cho phép; (3) chữ, bảng, hình, đánh số
đọc được. Cùng lúc, publish thử một file còn tracked changes và comment rồi xem PDF. Không đạt (1) hoặc (2) thì chuyển sang phương án dự phòng (phiên editor trên bản sao tạm, không lưu về) hoặc báo lại để chọn công cụ khác.

**Thiết kế (nếu C0 đạt):**
- Nút "So sánh với bản Effective" trên tab Document, ở Draft, Pending Review, Pending Approval. Tắt khi không có DOCX để so.
- Kết quả thể hiện bản hiện tại đã thay đổi gì so với bản Effective.
- Mở chỉ đọc, không tải, không in, có watermark người xem như viewer hiện tại.
- Quyền: giống quyền xem revision đó.
- File kết quả là bộ nhớ đệm theo cặp checksum, tạo lại khi một trong hai file đổi, được phép xoá; **không phải hồ sơ**.
- Audit Trail: ghi lượt xem bản so sánh, kèm hai số revision.
- Có dòng chú thích: bản so sánh chỉ hỗ trợ đọc, người review và approve chịu trách nhiệm trên toàn bộ tài liệu.
- Chữ giao diện có cả tiếng Anh và tiếng Việt.

## 6. Phạm vi ảnh hưởng (GitNexus, upstream)

`createRevisionAndUploadFile`, `uploadRevisionFile`, `submitForReview`, `completeReview`, `completeApproval`, `getOnlyOfficeViewConfig`,
`applyOnlyOfficeEditedContent`: đều **LOW** (tối đa 5 symbol). Chạy lại ngay trước khi sửa. Không dự kiến migration; nếu phát sinh sẽ báo.

## 7. Kiểm thử tối thiểu

| Nhóm | Trường hợp |
|---|---|
| A | Tạo bằng cả hai đường; sửa và autosave bản Draft xong, file và checksum bản Effective không đổi. |
| A | Từ chối: không quyền; không phải Draft; không có bản Effective; chỉ có PDF; gửi cả file và cờ. |
| A | Có revision đã huỷ mới hơn bản Effective: vẫn lấy đúng bản Effective. |
| A | Hai người tạo cùng lúc: chỉ một revision được tạo. |
| B | Cảnh báo hiện đúng số lượng ở cả ba bước; file sạch không cảnh báo; có tracked changes vẫn đi tiếp được; đọc file lỗi không làm hỏng thao tác. |
| C | Người không xem được revision bị từ chối; không tải được; đổi file thì bản so sánh được tạo lại; dịch vụ so sánh lỗi thì hiện lỗi, không hiện "không có thay đổi". |

Hồ sơ thay đổi và bằng chứng lưu tại `eqms-backend/docs/validation/`.

## 8. Thứ tự làm

1. C0 (thử compare). 2. Phần A. 3. Phần B. 4. Phần C.

## 9. Ngoài phạm vi

Không đổi bước Publish; không chuyển PDF legacy thành DOCX; không lưu bản so sánh làm hồ sơ; không so sánh giữa hai bản cũ bất kỳ.

## 10. Bổ sung ngày 2026-11-27 (`DEC-DOC-2026-11-27-04`, đã làm)

File chép sang revision mới và mọi PDF ban hành không còn tracked changes (được chấp nhận toàn bộ) hay comment. Hai thứ này chỉ dùng khi soạn thảo, rà soát, phê duyệt; viewer ở ba giai đoạn đó hiện markup. Mục này thay câu ở phần 4 về việc tracked changes theo file sang revision sau.
