# Kế hoạch loại bỏ PDF Comment/Compare và chuyển Publishing Workspace sang Ready for Publishing

## Tóm tắt quyết định

- Loại bỏ hoàn toàn chức năng comment, reply, resolve, edit/delete comment, PDF pin overlay, right sliding panel và Edit History khỏi Document tab.
- Xóa toàn bộ dữ liệu comment/reply/attachment và audit event liên quan theo yêu cầu; đây là migration phá hủy dữ liệu, chỉ được chạy trên môi trường được phê duyệt cho việc xóa lịch sử.
- Không còn so sánh hai PDF khi revision re-submit. Document tab chỉ hiển thị một PDF snapshot thuộc đúng revision và đúng vòng review hiện tại.
- Sau `Complete Editing/Authoring`, hệ thống tự sinh review PDF snapshot; Author không cần mở Publishing Workspace để chuẩn bị review.
- Publishing Workspace chỉ được mở khi revision đã ở `READY_FOR_PUBLISHING`; tại đây DCO cấu hình cover/header/footer/page range, tạo preview, sau đó `Publish` bằng e-signature để chuyển `EFFECTIVE`.

## 1. Luồng workflow sau điều chỉnh

### Luồng revision mới hoặc revision upgrade

```text
Draft
  └─ Complete Editing/Authoring
      ├─ khóa source file
      ├─ tự tạo immutable review PDF snapshot
      └─ vẫn ở Draft, trạng thái snapshot PROCESSING/READY

Draft + review snapshot READY
  └─ Submit for Review + e-signature
      └─ Pending Review

Pending Review
  ├─ Complete Review → Pending Approval
  └─ Reject → Draft

Pending Approval
  ├─ Complete Approve → Pending Training (nếu Requires Training)
  ├─ Complete Approve → Ready for Publishing (nếu không Requires Training)
  └─ Reject → Draft

Pending Training
  └─ Hoàn tất training → Ready for Publishing

Ready for Publishing
  └─ Open Publishing Workspace
      ├─ chọn template/layout/page range
      ├─ áp dụng cover/header/footer
      ├─ Generate Preview
      └─ Publish + e-signature → Effective
```

### Quy tắc sau Reject

- Reject trả revision về `DRAFT`; không có comment panel, reply, history panel hoặc PDF comparison.
- Author/Co-author chỉnh sửa source file theo cơ chế hiện có.
- Khi Complete Editing lần tiếp theo:
  - source được khóa lại;
  - review PDF snapshot mới được tạo tự động;
  - snapshot cũ vẫn giữ ở backend/storage cho audit kỹ thuật và truy vết artifact, nhưng không hiển thị trên UI.
- Khi re-submit, Pending Review chỉ xem snapshot mới nhất của vòng hiện tại.

## 2. Loại bỏ hoàn toàn PDF comment/reply và history UI

### Frontend

Loại bỏ khỏi [`DocumentTab.tsx`](D:/edms-project/eqms/src/features/documents/document-revisions/detail-revision/tabs/DocumentTab.tsx):

- Toàn bộ props, state và callback liên quan:
  - `reviewComments`
  - `currentReviewRound`
  - `comparisonSnapshotRound`
  - `comparisonCommentRound`
  - `showPreviousReviewSnapshot`
  - `canAddComment`
  - `onAddComment`, `onReplyComment`, `onResolveComment`
  - `onEditComment`, `onDeleteComment`
  - `onEditReply`, `onDeleteReply`
  - `commentHistoryOpen`
  - `onCommentHistoryOpenChange`
- Toàn bộ logic tải previous review snapshot và hiển thị hai PDF.
- Toàn bộ `RightSlidingPanel`, `ReviewCommentListPanel`, `ReviewCommentPageOverlay`, `SnapshotHistoryPanel`, `TabNav` của panel phụ.
- Toàn bộ heading “Current review snapshot”, “Previous reviewed snapshot”, “Reviewed snapshot”.

Giữ Document tab ở dạng đơn giản:

- Có PDF → hiển thị một `DocumentPdfViewer`.
- Snapshot đang tạo → “Preparing review PDF preview…”.
- Chưa upload source file → “No source file has been uploaded for this revision.”
- Source đã upload nhưng chưa Complete Editing → “Complete editing to create the review PDF preview.”
- Snapshot lỗi → “The review PDF could not be generated.” và hiển thị retry action nếu user có quyền.
- Effective/Obsoleted → hiển thị published PDF của đúng revision.
- Không còn giao diện nào khiến người dùng tưởng file đang loading khi backend xác định không có PDF.

Loại bỏ các button `Comment & Edit History` ở header/footer của:

- Revision Create
- Review Revision
- Approval Revision
- Revision Detail
- Publishing Workspace nếu đang có

Rà toàn bộ imports/routes để xóa các component chỉ còn phục vụ feature này:

- `RightSlidingPanel.tsx`
- `ReviewCommentPageOverlay.tsx`
- `ReviewCommentListPanel.tsx`
- `SnapshotHistoryPanel.tsx`
- `reviewCommentPaging.ts`
- `reviewCommentAttachments.ts`
- các hook/type chỉ dùng cho review comments

Chỉ xóa file khi `rg` xác nhận không còn consumer khác.

### Backend/API

Xóa hoàn toàn API comment/reply/attachment:

```text
GET    /revisions/{id}/review-comments
POST   /revisions/{id}/review-comments
PATCH  /revisions/{id}/review-comments/{commentId}
DELETE /revisions/{id}/review-comments/{commentId}
POST   /revisions/{id}/review-comments/{commentId}/reply
PATCH  /revisions/{id}/review-comments/{commentId}/reply/{replyId}
DELETE /revisions/{id}/review-comments/{commentId}/reply/{replyId}
POST   /revisions/{id}/review-comments/{commentId}/resolve
...attachment endpoints...
...withdraw endpoints...
```

Xóa khỏi backend:

- `RevisionReviewComment`, `RevisionReviewCommentReply`, `RevisionReviewCommentAttachment`.
- Repository, DTO, mapper, controller mapping, service method và notification handler liên quan.
- Permission/capability/action policy liên quan đến tạo/sửa/xóa/resolve/reply PDF comment.
- Event catalog, notification template và audit mapping dành riêng cho comment/reply.
- Tất cả code cố dùng review comment để tìm `snapshotVersionToken` hoặc quyết định PDF preview fallback.

### Database và audit destructive migration

Tạo migration theo thứ tự an toàn:

1. Xóa FK/index của attachments → replies → comments.
2. Xóa bảng attachment.
3. Xóa bảng reply.
4. Xóa bảng comment.
5. Xóa sequence/constraint/index còn dư.
6. Xóa các audit record chỉ thuộc nhóm hành động PDF comment/reply/resolve/delete/withdraw.
7. Xóa notification records/event configuration/template chỉ được sinh bởi PDF comment.
8. Xóa object attachment comment trên MinIO theo prefix đã xác định, có báo cáo object đã xóa.
9. Không xóa `review_round` hoặc snapshot metadata nếu chúng vẫn được sử dụng để quản trị review snapshot nội bộ.

Migration phải fail-fast nếu phát hiện dữ liệu/bảng không đúng schema mong đợi; không dùng migration im lặng bỏ qua lỗi.

## 3. Bỏ compare hai PDF sau re-submit

### Backend

- Giữ immutable review snapshot cho mỗi round để phục vụ integrity, checksum và điều tra kỹ thuật.
- Không trả previous snapshot qua Revision Detail API hoặc Document tab API.
- Loại bỏ endpoint preview round cũ nếu endpoint đó chỉ phục vụ compare/comment.
- Detail response chỉ trả một preview descriptor theo quy tắc:
  - Draft trước Complete Editing: không có review PDF.
  - Draft sau Complete Editing: current review PDF snapshot.
  - Pending Review/Pending Approval/Pending Training/Ready for Publishing: current review PDF snapshot.
  - Effective/Obsoleted: published PDF của revision hiện tại.
  - Closed-Cancelled: chỉ hiển thị snapshot nếu revision đã từng tạo snapshot; nếu chưa có thì trạng thái “No review PDF was created before cancellation.”

### Frontend

- Revision Detail, Review Revision và Approval Revision chỉ load PDF hiện hành từ backend.
- Không gọi `previewRevisionReviewRoundSnapshot`.
- Không tạo object URL cho previous snapshot.
- Không còn hai viewer, panel chọn round hoặc điều hướng comment sang preview cũ.
- Khi mở Revision 1.0.0 cũ, luôn preview file của 1.0.0; không fallback sang revision Effective mới nhất.

## 4. Chuyển Publishing Workspace sang Ready for Publishing

### Complete Editing/Authoring

Điều chỉnh [`RevisionService.completeEditing`](D:/edms-project/eqms-backend/src/main/java/com/eqms/service/RevisionService.java):

1. Xác thực Author/Co-author/DCO theo capability hiện có.
2. Kiểm tra source file hợp lệ.
3. Đồng bộ file Office Online về storage nếu có.
4. Khóa source editing và revoke quyền Office edit nếu có.
5. Ghi prepared e-signature như hiện tại.
6. Đặt:
   - `editingStatus = COMPLETED`
   - `sourceLocked = true`
   - `snapshotStatus = PROCESSING`
7. Enqueue job tạo review PDF snapshot tự động từ source file đã khóa.
8. Revision vẫn giữ trạng thái `DRAFT`.
9. Khi job thành công:
   - lưu path/checksum/version ID snapshot;
   - đặt `snapshotStatus = READY`.
10. Khi job thất bại:
    - đặt `snapshotStatus = ERROR`;
    - lưu message kỹ thuật an toàn;
    - giữ revision `DRAFT`;
    - cho phép Author/DCO bấm `Retry Review Preview`.

Không dùng Publishing Workspace để tạo review package nữa.

### Submit for Review

Điều chỉnh `submitForReview`:

- Bỏ điều kiện “Publishing Workspace preview đã được generate”.
- Chỉ yêu cầu:
  - source locked;
  - `editingStatus = COMPLETED`;
  - `snapshotStatus = READY`;
  - review PDF snapshot tồn tại, readable, checksum hợp lệ.
- Nếu snapshot `PROCESSING`, trả lỗi nghiệp vụ: “Review PDF is still being prepared.”
- Nếu `ERROR`, trả lỗi nghiệp vụ: “Review PDF preparation failed. Retry before submission.”
- Submit vẫn cần e-signature và mới chuyển Pending Review.

### Mở Publishing Workspace

Điều chỉnh quyền và endpoint `openPublishingWorkspace`:

- Chỉ cho phép status `READY_FOR_PUBLISHING`.
- Chỉ DCO/capability `canOpenPublishingWorkspace` được mở.
- Không còn gọi từ Revision Create ngay sau Complete Editing.
- Nếu revision Required Training mà chưa hoàn tất: API trả 409 với thông điệp nghiệp vụ rõ ràng.
- Nếu revision chưa đến Ready for Publishing: API trả 409, không tạo metadata/package.

Điều chỉnh [`RevisionCreateView.tsx`](D:/edms-project/eqms/src/features/documents/document-revisions/views/RevisionCreateView.tsx):

- Bỏ button Open Publishing Workspace khi Draft/Pending Review/Pending Approval.
- Button chỉ xuất hiện nếu backend capability trả `canOpenPublishingWorkspace = true` và status là `READY_FOR_PUBLISHING`.

### Publishing Workspace

Điều chỉnh [`PublishingWorkspaceView.tsx`](D:/edms-project/eqms/src/features/documents/publishing/PublishingWorkspaceView.tsx):

- Xóa toàn bộ wording/action “Submit For Review”, “Regenerate Review Package” và e-signature modal chuyển `Draft → Pending Review`.
- Giữ các phần:
  - chọn Publishing Template;
  - chọn layout;
  - cấu hình Cover/Header/Footer;
  - Page Range Custom;
  - component preview;
  - full publishing PDF preview;
  - placeholder validation;
  - publishing job polling.
- Đổi action chính thành `Publish`.
- Publish chỉ enable khi:
  - revision đang `READY_FOR_PUBLISHING`;
  - template/layout hợp lệ;
  - cover/header/footer/page range đã validate;
  - preview hiện hành được generate sau thay đổi config cuối cùng;
  - không có publishing job đang chạy.
- E-signature modal:
  - title: `Publish Revision`;
  - change: `Ready for Publishing → Effective`;
  - hiển thị template, layout, page range, preview checksum.
- `POST /publishing-workspace/publish` là action duy nhất chuyển revision `READY_FOR_PUBLISHING → EFFECTIVE`.
- Nếu Publish lỗi sau khi tạo PDF nhưng trước khi transition thành công: không ghi Effective PDF là official; job phải cleanup hoặc đánh dấu artifact orphan để reconciliation.

## 5. API/type/capability cần điều chỉnh

### Revision detail response

Thay thế dữ liệu comment/comparison bằng preview contract rõ ràng:

```ts
previewStatus: "NONE" | "PROCESSING" | "READY" | "ERROR"
previewType: "REVIEW_SNAPSHOT" | "PUBLISHED_PDF" | null
previewMessage: string | null
previewGeneratedAt: string | null
previewChecksum: string | null
canRetryReviewPreview: boolean
canOpenPublishingWorkspace: boolean
```

Không trả:

```ts
reviewComments
comparisonSnapshotRound
previousSnapshotUrl
commentHistory
```

### API mới hoặc chuẩn hóa

```http
POST /revisions/{id}/review-preview/retry
GET  /revisions/{id}/preview
POST /revisions/{id}/publishing-workspace/open
POST /revisions/{id}/publishing-workspace/preview
POST /revisions/{id}/publishing-workspace/publish
```

`retry` chỉ hợp lệ ở Draft, source đã locked, snapshot đang ERROR hoặc NONE; phải ghi audit.

## 6. Audit trail sau điều chỉnh

Giữ/chuẩn hóa audit artifact:

```text
COMPLETE_EDITING
REVIEW_SNAPSHOT_QUEUED
REVIEW_SNAPSHOT_CREATED
REVIEW_SNAPSHOT_FAILED
REVIEW_SNAPSHOT_RETRIED
SUBMIT_FOR_REVIEW
COMPLETE_REVIEW
REJECT_REVIEW
COMPLETE_APPROVAL
REJECT_APPROVAL
TRAINING_COMPLETED
OPEN_PUBLISHING_WORKSPACE
GENERATE_PUBLISHING_PREVIEW
PUBLISH_TO_EFFECTIVE
```

Xóa toàn bộ audit event comment/reply/resolve/delete/attachment/withdraw theo quyết định đã chốt.

Mỗi snapshot/publish event phải ghi revision ID, snapshot type, checksum, storage version, actor, thời gian và trạng thái thành công/thất bại.

## 7. Kiểm thử và tiêu chí nghiệm thu

### Test tự động

- Complete Editing tạo snapshot job, Draft không bị chuyển trạng thái sớm.
- Snapshot READY mới Submit for Review được.
- Snapshot ERROR không submit được, retry thành công thì submit được.
- Re-submit tạo snapshot mới, UI chỉ xem snapshot mới.
- Không còn endpoint/API/client reference nào đến review comments/replies/attachments.
- Không còn component Right Panel/comment overlay/snapshot comparison được render.
- Publishing Workspace từ Draft/Pending Review/Pending Approval/Pending Training bị backend chặn.
- Ready for Publishing mở workspace được với DCO hợp lệ.
- Publish bị chặn nếu preview stale sau đổi template/layout/page range.
- Publish thành công tạo Published PDF và chuyển Effective.
- Detail Revision revision cũ preview đúng file revision cũ.
- Detail Revision revision mới preview đúng file revision mới.

### UAT thủ công

1. Tạo revision mới, upload file, Complete Editing.
2. Xác nhận Draft hiển thị “Preparing review PDF preview” trong khi job chạy.
3. Khi job READY, Submit Review; Reviewer chỉ xem một PDF, không thấy comment/history/compare.
4. Reviewer Reject; Author sửa file, Complete Editing, chờ snapshot mới, re-submit.
5. Xác nhận Pending Review chỉ có PDF của lần re-submit.
6. Complete Review, Complete Approval, hoàn thành Required Training nếu có.
7. Xác nhận Open Publishing Workspace chỉ xuất hiện ở Ready for Publishing.
8. Thay đổi cover/header/footer/page range, Generate Preview, sau đó Publish.
9. Xác nhận Effective PDF có đúng template đã chọn.
10. Mở revision cũ và revision mới; xác nhận từng revision hiển thị PDF thuộc chính revision đó.
11. Kiểm tra database, API docs, menu/action capability và audit không còn chức năng comment/reply.

## Giả định đã chốt

- Dữ liệu comment/reply/attachment và audit event comment cũ được xóa hoàn toàn theo yêu cầu; việc này chỉ phù hợp dữ liệu development/UAT hoặc đã có phê duyệt hủy dữ liệu.
- Review PDF snapshot vẫn được giữ nội bộ theo round để bảo toàn artifact và hỗ trợ điều tra kỹ thuật, nhưng không còn UI compare/history.
- PDF review được tạo tự động sau Complete Editing/Authoring; Publishing Template chỉ được áp dụng tại Ready for Publishing.
- Publish là action duy nhất trong Publishing Workspace và luôn yêu cầu DCO có capability hợp lệ cùng e-signature.
