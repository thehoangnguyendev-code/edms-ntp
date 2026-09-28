# Kế hoạch xử lý lỗi — Luồng Cancel/Obsolete cho Document Master & Revision

Đối chiếu báo cáo audit của Codex (12 mục, P0→P3) với code thật (BE Java, FE TS), migration DB.
**Không nhận báo cáo theo mặc định** — mỗi mục dưới đây đã được đọc trực tiếp source code để xác
nhận (dùng 3 agent song song đọc code độc lập, có trích dẫn file:line cụ thể). Kết quả: **11/12 mục
CONFIRMED, 1/12 PARTIALLY CONFIRMED** — báo cáo lần này chính xác cao.

## TRẠNG THÁI TRIỂN KHAI (cập nhật sau khi code, test, deploy — bản v4/v5 đã chốt)

Đã triển khai theo đúng thứ tự đã chốt, các mục **không cần chờ quyết định nghiệp vụ**:

- **#2 (P0 — race Controlled Copy)**: đã sửa theo Cách B — enum kết quả riêng
  `ControlledCopyFinalizationOutcome` (`SUCCESS`/`SKIPPED_TERMINAL`/`FAILED`), guard trạng thái
  terminal ngay khi đọc record ở cả `finalizeDistributedCopy()` và
  `markDistributedCopyProcessingFailed()`, bắt `OptimisticLockingFailureException` ở tầng
  `ControlledCopyBatchDistributionAsyncService.finalizeWithRetry()` (sau khi transaction đã
  rollback) rồi đọc lại trạng thái bằng 1 transaction mới
  (`ControlledCopyService.isControlledCopyInTerminalState()`) để quyết định `SKIPPED_TERMINAL` thay
  vì retry/restore. Job item có thêm trạng thái `"SKIPPED"` (không có CHECK constraint trên cột này,
  an toàn thêm giá trị mới). Test: `ControlledCopyObsoleteRaceTest` (5 test, pass).
- **#4 (P1 — chặn Cancel Document đã có Revision)**: thêm guard
  `documentRevisionRepository.existsByDocument_Id(documentId)` đầu `DocumentService.cancelDocument()`.
  Test: `DocumentCancelObsoleteGuardTest` (pass).
- **#1 (P0 — audit trail Revision khi Obsolete Document)**: đã chốt Hướng B — thêm method public
  `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete(...)` làm trọn vẹn đổi status +
  `obsoletedBy`/`obsoletedAt` + `recordRevisionHistory` + audit trail trong 1 lời gọi, tham chiếu
  `signatureSessionId` của chữ ký Document (đúng theo quyết định "tham chiếu chữ ký Document là đủ",
  **chưa** thêm ký riêng từng Revision — câu hỏi đó vẫn đang chờ QA/Compliance, xem mục còn mở bên
  dưới). `DocumentService.obsoleteDocument()` gọi thẳng method này trong vòng lặp thay vì tự set field.
- **#5 (P1 — capability mismatch `NewDocumentView.tsx`)**: xác nhận đây là màn hình **đang dùng thật**
  (route `all/new`, `all/edit/:id` trong `DocumentRoutes.tsx`), không phải dead code như suy đoán ban
  đầu trong 1 phần thảo luận trước đó — đây là bug UX thật đang ảnh hưởng người dùng. Đã sửa: gọi
  `securityApi.getResourceCapabilities("DOCUMENT_MASTER", detail.id)` (cùng endpoint
  `DetailDocumentView.tsx` dùng) lấy đúng `actions.cancel/obsolete/editInitialDraft.allowed` thay vì
  đọc field ảo `detail.canCancel/canObsolete/canStartInitialAuthoring` (backend không bao giờ trả).
  Đã xoá 3 field thừa khỏi FE type `DocumentDetailResponse`. Xác nhận `DocumentsView.tsx` đọc
  `doc.canStartInitialAuthoring` là type khác (`DocumentListItem`, có field thật ở backend
  `DocumentListItemResponse`) — không liên quan, không sửa.
- **#6 (P1 — obsoleteDate bị âm thầm thay bằng now())**: sửa `parseDateOrNow()` — thử parse ISO
  Instant trước (đúng định dạng FE thật đang gửi `Date.prototype.toISOString()`), sau đó mới fallback
  các định dạng ngày cũ qua `parseDate()`; nếu **có** giá trị nhưng parse thất bại, throw
  `IllegalArgumentException` thay vì âm thầm dùng `Instant.now()`. Chỉ fallback `now()` khi field thực
  sự không được gửi. **Chưa** thêm validate range (backdate/future-date) — vẫn đang chờ chốt nghiệp
  vụ như đã ghi trong mục #6 gốc.
- **#10 (P2 — Dashboard status code cũ)**: sửa `DashboardService.java` dùng đúng
  `"OBSOLETED"`/`"CLOSED_CANCELLED"` thay vì `"OBSOLETE"`/`"CANCELLED"`. Xác nhận an toàn với FE (
  `utils/status.ts` đã hỗ trợ hiển thị cả 2 dạng code, không có nơi nào phụ thuộc cứng vào code cũ).

**Test & build**: backend compile sạch, thêm 2 file test mới (`ControlledCopyObsoleteRaceTest`,
`DocumentCancelObsoleteGuardTest`, tổng 6 test case, tất cả pass). Chạy full suite backend (581 test):
còn đúng 22 lỗi pre-existing giống hệt baseline trước khi bắt đầu đợt sửa này (8 failures + 14
errors, cùng tên test, không có test mới nào fail) — xác nhận không có regression. FE `tsc --noEmit`
sạch. Build Docker + deploy lại (`docker compose build backend frontend` + `up -d --no-deps
--force-recreate`) thành công, log khởi động sạch, không migration DB mới (đợt này không đụng schema).

**Các mục CHƯA triển khai, đang chờ quyết định nghiệp vụ/QA** (đúng như đã chốt trong "Thứ tự triển
khai đề xuất" — không tự ý quyết định thay):
- **#1, câu hỏi ký riêng từng Revision**: chờ QA/Compliance xác nhận 1 chữ ký Document tham chiếu
  xuống có đủ hay cần ký riêng. Hiện code theo hướng mặc định "tham chiếu là đủ".
- **#3**: có giữ tính năng Obsolete riêng cho 1 Revision hay không.
- **#7 + #8**: registry vs DB drift cho policy Obsolete — phụ thuộc quyết định ở #3.
- **#9**: `reopenDocument` — implement thật hay xoá code chết (FE `documents.ts`) — chưa xác nhận có
  màn hình nào gọi thật hay không.
- **#11**: dead code helper FE (`documentLifecycleActions.ts`) — dọn dẹp, ưu tiên thấp nhất.
- **#12**: Cancel Document có cần electronic signature hay không — chờ SOP/CSV.
- **Flyway V359/V364 drift**: không thuộc phạm vi audit này (không có trong 12 mục gốc), vẫn là hạng
  mục change-control riêng nếu cần xử lý sau này.

---

**Chỉ lập kế hoạch, chưa code** — theo đúng quy ước đã dùng cho audit trước
(`DOCUMENT_REVISION_CREATION_AUDIT_PLAN.md`), áp dụng cho các mục **chưa triển khai** liệt kê ở trên.

---

## PHẦN 1 — P0 (nghiêm trọng nhất)

### 1. [P0] ✅ Obsolete Document không tạo audit trail/history/signature riêng cho từng Revision

**Vị trí**: `DocumentService.obsoleteDocument()` (dòng 1618-1738).

**Cơ chế lỗi**: vòng lặp obsolete từng Revision (dòng 1679-1691) chỉ set field status/obsoletedBy/
obsoletedAt rồi `documentRevisionRepository.save(revision)` — **không** gọi
`RevisionService.recordRevisionHistory(...)`, **không** gọi `auditTrailService.logAs(...)` riêng cho
Revision, **không** ghi electronic signature riêng cho Revision. Trong khi đó:
- Hành động ở cấp Document được ký + audit đầy đủ (dòng 1666-1677 ký, dòng 1722-1735 audit).
- Vòng lặp Controlled Copy (dòng 1693-1719) **có** gọi `auditTrailService.logAs(...)` mỗi copy (dòng
  1708) — chứng tỏ pattern ghi audit-per-item đã biết và áp dụng có chủ đích cho Controlled Copy
  nhưng bị bỏ sót cho Revision.

**Hậu quả**: khi Document bị Obsolete, các Revision hợp lệ còn lại cần chuyển sang OBSOLETED — trên
thực tế, do `obsoleteDocument()` bắt buộc phải có ít nhất 1 Revision EFFECTIVE và chặn nếu còn Revision
đang xử lý (xem sửa lại chi tiết ở mục "Biện pháp xử lý" điểm 5 bên dưới), đối tượng chính bị ảnh
hưởng là (các) Revision `EFFECTIVE` — chuyển thẳng sang OBSOLETED. Lưu ý diễn đạt lại cho đúng: code
**vẫn có** ghi lại `revision.setObsoletedBy(currentUser)`/`revision.setObsoletedAt(obsoletedAt)` trên
từng Revision (không phải "không để lại dấu vết gì") — vấn đề thực sự là **thiếu event
history/audit trail bất biến** (`RevisionWorkflowHistory`/`AuditTrail`, vốn không thể sửa/xoá sau khi
ghi, khác với 2 field trên entity có thể bị ghi đè bởi thao tác sau) **và thiếu liên kết rõ ràng tới
electronic signature** của hành động Obsolete — nên truy vết GMP cho từng Revision **chưa đầy đủ**,
không phải hoàn toàn không có.

**Đã chốt (quyết định cuối, sẵn sàng code)**: bản v1 đề xuất gọi thẳng
`RevisionService.recordRevisionHistory(...)` từ trong `DocumentService.obsoleteDocument()` — **không
compile được**, vì đã xác nhận qua code (`RevisionService.java` dòng 4326-4354) toàn bộ 4 overload của
`recordRevisionHistory` đều là `private`. **Đã chốt dùng Hướng B** (public domain method trong
`RevisionService`) — Hướng A (tách service riêng) không dùng.

**Biện pháp xử lý — Hướng B đã chốt**:
1. Thêm 1 method public trong `RevisionService`, ví dụ
   `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete(DocumentRevisionRecord revision,
   UserAccount currentUser, RevisionStatusDefinition obsoletedRevisionStatus, Instant obsoletedAt,
   UUID documentSignatureId)` (tên/tham số gợi ý, tinh chỉnh khi code cho khớp field thật cần truyền).
   **Method này phải làm trọn vẹn toàn bộ phần việc của 1 Revision bị obsolete trong cùng 1
   transaction — không chỉ ghi history/audit**: đổi `revision.setStatus(obsoletedRevisionStatus)`,
   set `revision.setObsoletedBy(currentUser)`/`revision.setObsoletedAt(obsoletedAt)` (đúng như code
   hiện tại đang làm trong vòng lặp của `obsoleteDocument()`), lưu record, **rồi mới** gọi
   `recordRevisionHistory(...)` + `auditTrailService.logAs(...)`. Tất cả các bước này phải nằm chung
   trong transaction của `obsoleteDocument()` (method gọi vào, đã có `@Transactional` ở
   `DocumentService`) — không tách thành nhiều lời gọi rời rạc mà `DocumentService` phải tự ghép lại,
   để tránh trường hợp nửa vời (status đổi nhưng history/audit ghi thiếu, hoặc ngược lại) nếu có lỗi
   giữa chừng.
2. `DocumentService.obsoleteDocument()` gọi thẳng method public này trong vòng lặp thay cho việc tự
   set field + tự `documentRevisionRepository.save(revision)` như hiện tại (dòng 1679-1691) — toàn bộ
   logic cập nhật 1 Revision khi obsolete chuyển hẳn vào `RevisionService`, giữ đúng format
   history/audit hiện có của Revision (không viết lại logic ghi audit ở 1 chỗ mới).
3. **Lấy và lưu lại tham chiếu chữ ký Document**: kết quả trả về của
   `electronicSignatureService.createEntitySignature(...)` (dòng 1666-1677) hiện đang bị bỏ qua sau
   khi gọi — cần lưu `signatureId`/tương đương rồi truyền xuống làm tham số `documentSignatureId` cho
   method ở điểm 1, để audit trail của từng Revision ghi rõ tham chiếu tới đúng chữ ký gốc (ví dụ field
   "Obsoleted theo chữ ký Document #<signatureId>"), thay vì chỉ ghi chung chung "obsoleted via parent
   Document".
4. **Vẫn còn 1 câu hỏi nghiệp vụ chưa chốt, chờ QA/Compliance xác nhận trước khi code phần này**: 1
   chữ ký ở cấp Document (mục 3), được tham chiếu xuống từng Revision qua `documentSignatureId`, có
   đủ đáp ứng yêu cầu GMP hay không — hay bắt buộc phải có electronic signature **riêng** cho từng
   Revision bị obsolete. Cho tới khi có xác nhận, mặc định code theo hướng "tham chiếu chữ ký Document
   là đủ" (đã có sẵn ở điểm 1 và 3) — **không tự thêm bước ký riêng cho từng Revision** nếu chưa có
   xác nhận rõ ràng từ QA/Compliance, vì đó là thay đổi lớn hơn nhiều (UX, số lần xác thực người dùng
   phải thực hiện) so với chỉ ghi tham chiếu.
5. **Test tích hợp (đã sửa lại theo review — bản trước mô tả tình huống không thể xảy ra)**: đã xác
   nhận qua code `obsoleteDocument()` (dòng 1631-1645) rằng Obsolete Document **bắt buộc phải có ít
   nhất 1 Revision EFFECTIVE** và **chặn hoàn toàn** nếu tồn tại bất kỳ Revision đang ở trạng thái
   `DRAFT`/`PENDING_REVIEW`/`PENDING_APPROVAL`/`PENDING_TRAINING`/`READY_FOR_PUBLISHING` — nghĩa là 1
   lần gọi Obsolete Document **thành công không bao giờ có Revision Draft đi kèm**. Lưu ý: DB **không
   có constraint nào giới hạn chỉ đúng 1 Revision EFFECTIVE** cho mỗi Document — đã xác nhận qua
   `\d document_revisions`, chỉ có unique constraint `ux_document_revisions_one_in_progress` chặn
   nhiều Revision "đang xử lý" cùng lúc (DRAFT/PENDING_*/READY_FOR_PUBLISHING), không chặn nhiều
   EFFECTIVE — với dữ liệu lịch sử/migration cũ, về lý thuyết vẫn có thể có **nhiều hơn 1** Revision
   EFFECTIVE cho cùng 1 Document. Test đúng phải gồm 2 kịch bản:
   - Kịch bản chính: Document `ACTIVE`, có 1 Revision `EFFECTIVE`, có thể kèm thêm Revision đã
     `OBSOLETED`/`CLOSED_CANCELLED` từ trước (không bị chặn vì không phải trạng thái "đang xử lý"),
     không có Revision nào đang xử lý.
   - **Kịch bản phòng thủ (mới)**: Document `ACTIVE` có **từ 2 Revision `EFFECTIVE` trở lên** (mô
     phỏng dữ liệu lịch sử bất thường) → xác nhận sau khi Obsolete, **tất cả** Revision Effective bị
     obsolete đều có history/audit riêng (không chỉ Revision đầu tiên/cuối cùng trong vòng lặp).
   - Xác nhận chung cho cả 2 kịch bản: mỗi Revision Effective bị obsolete có 1 dòng
     `RevisionWorkflowHistory` + audit trail riêng, có tham chiếu đúng `signatureId` của Document;
     Revision đã `OBSOLETED`/`CLOSED_CANCELLED` từ trước **không** bị ghi thêm history/audit (không có
     status thay đổi thật cho các Revision này, tuỳ theo cách vòng lặp hiện tại xử lý — cần xác nhận
     lại khi code liệu vòng lặp hiện tại có set lại status cho các Revision đã terminal hay chỉ
     Revision Effective, để tránh ghi audit trùng/sai cho các Revision vốn đã đóng).

---

### 2. [P0] ✅ Job Controlled Copy bất đồng bộ có thể đổi ngược trạng thái Obsoleted

**Đã sửa lại theo review của Codex — 2 điểm quan trọng** (xem changelog cuối file): (a)
`ControlledCopyRecord` **đã có sẵn `@Version`** — mô tả "không có optimistic locking" ở bản trước là
sai, cần bỏ; (b) cách sửa "return false khi gặp trạng thái terminal" ban đầu đề xuất là **sai và có
thể làm bug nặng hơn** — đã sửa lại đúng hướng dưới đây.

**Vị trí**: `ControlledCopyService.finalizeDistributedCopy()` (dòng 1192-1217) và
`markDistributedCopyProcessingFailed()` (dòng 1260-1277), gọi từ
`ControlledCopyBatchDistributionAsyncService.finalizeWithRetry()`/`restoreFailedCopy()` (dòng
146-178).

**Cơ chế lỗi**: cả 2 method service fetch lại `ControlledCopyRecord` theo ID rồi **ghi đè thẳng**
`statusCode`/`currentStage` thành `DISTRIBUTED` hoặc `READY_FOR_DISTRIBUTION`, **không** kiểm tra lại
xem status hiện tại đã là `OBSOLETED`/`CLOSED_CANCELLED` hay chưa.

**Vì sao "return false khi gặp terminal status" là sai** (đã xác nhận qua code
`ControlledCopyBatchDistributionAsyncService.java` dòng 146-178): `finalizeWithRetry()` coi
**bất kỳ `false` nào** từ `finalizeDistributedCopy()` là "xử lý thất bại, cần retry" — thử lại tối đa
`MAX_PROCESSING_ATTEMPTS` lần, rồi nếu vẫn `false` thì gọi `restoreFailedCopy()` →
`markDistributedCopyProcessingFailed()` — **chính hàm này lại set status thành
`READY_FOR_DISTRIBUTION`**. Nghĩa là: nếu sửa theo hướng "return false khi thấy OBSOLETED", worker sẽ
hiểu nhầm thành lỗi xử lý file, retry vô ích vài lần, rồi tự tay đổi copy đã Obsoleted thành
**Ready for Distribution** — biến 1 bug "có thể bị ghi đè do race" thành 1 bug "chắc chắn bị ghi đè
mỗi lần Obsolete trùng lúc job chạy". Đây là lỗi nghiêm trọng hơn nếu áp dụng đúng bản sửa ban đầu.

**Hậu quả** (giữ nguyên như bản trước): nếu `DocumentService.obsoleteDocument()` (đoạn set copy status
= OBSOLETED, dòng 1693-1719) chạy đúng lúc job bất đồng bộ đang xử lý cùng Controlled Copy đó, job có
thể commit sau và âm thầm ghi đè Obsoleted → Distributed/Ready for Distribution.

**Biện pháp xử lý đề xuất (đã sửa lại đúng hướng, và làm rõ thêm theo review lần 2 của Codex)**:
1. `finalizeDistributedCopy()`/`markDistributedCopyProcessingFailed()`: kiểm tra trạng thái terminal
   (`OBSOLETED`/`CLOSED_CANCELLED`) **ngay khi đọc lại record** ở đầu method — giữ nguyên bắt buộc dù
   chọn cách xử lý conflict nào ở điểm 2.
2. **Về việc bắt optimistic-lock conflict — cần chọn 1 trong 2 cách, không tự quyết định**: Codex chỉ
   ra đúng 1 điểm quan trọng — lỗi `OptimisticLockingFailureException` do `@Version` thường phát sinh
   lúc transaction **commit** (ở boundary của proxy `@Transactional`), tức là **sau khi** method
   service đã return, nên `try/catch` đặt ngay trong thân `finalizeDistributedCopy()` có thể không bắt
   được đúng chỗ nếu save() không tự flush trước khi method kết thúc. 2 cách hợp lệ:
   - **Cách A — flush cưỡng bức trong transaction**: sau `controlledCopyRepository.save(copy)`, gọi
     thêm `controlledCopyRepository.flush()` (hoặc `entityManager.flush()`) ngay trong
     `finalizeDistributedCopy()`/`markDistributedCopyProcessingFailed()` để buộc conflict lộ ra ngay
     tại đó — nhờ vậy `try/catch OptimisticLockingFailureException` đặt trong chính 2 method này mới
     bắt được, đọc lại record, thấy `OBSOLETED`/`CLOSED_CANCELLED` thì trả `SKIPPED_TERMINAL` thay vì
     ném lỗi tiếp.
   - **Cách B — bắt lỗi ở tầng gọi (`ControlledCopyBatchDistributionAsyncService`)**: để 2 method
     service không tự bắt conflict (giữ `@Transactional` bình thường, không flush cưỡng bức); thay
     vào đó `finalizeWithRetry()`/nơi gọi bắt `OptimisticLockingFailureException` ném ra sau khi
     transaction rollback, rồi mở **1 transaction mới** đọc lại `ControlledCopyRecord` theo ID — nếu
     status lúc này đã là `OBSOLETED`/`CLOSED_CANCELLED`, chuyển job item sang `SKIPPED_TERMINAL`,
     không retry/không gọi `restoreFailedCopy()`.
   - Cách B ít thay đổi hành vi transaction hiện có của 2 method service hơn (không cần flush cưỡng
     bức, tránh ảnh hưởng hiệu năng/side-effect khác), nhưng cần thêm code đọc-lại-bằng-transaction-mới
     ở tầng async service — **cần chốt với người phụ trách trước khi code**, không tự chọn thay.
3. Dù chọn cách nào ở điểm 2: đổi kiểu trả về của 2 method từ `boolean` sang 1 enum kết quả riêng, ví
   dụ `ControlledCopyFinalizationOutcome { SUCCESS, SKIPPED_TERMINAL, FAILED }` (tên gợi ý) —
   `SKIPPED_TERMINAL` nghĩa là "đã có 1 lifecycle action khác (Obsolete/Cancel) xử lý xong copy này
   trước, coi job item này là hoàn tất có chủ đích, không phải lỗi".
4. Cập nhật `finalizeWithRetry()`/`retryFailedItems()`/`onBatchDistributed()` trong
   `ControlledCopyBatchDistributionAsyncService`: nhánh `SKIPPED_TERMINAL` phải đánh dấu job item
   trạng thái hoàn tất (ví dụ `"SKIPPED"` hoặc tái dùng `"SUCCESS"` kèm ghi chú lý do) — **tuyệt đối
   không** gọi `restoreFailedCopy()`/`markDistributedCopyProcessingFailed()` cho trường hợp này, và
   **không** retry thêm.
5. Test race điều kiện: giả lập Obsolete commit xen giữa các lần retry của job async → xác nhận copy
   giữ nguyên OBSOLETED sau khi job hoàn tất, job item được đánh dấu hoàn tất có chủ đích (không phải
   FAILED), và `markDistributedCopyProcessingFailed()` không hề được gọi trong kịch bản này. Thêm test
   riêng cho đúng cơ chế bắt conflict đã chọn (A hoặc B) — VD với cách B: giả lập
   `OptimisticLockingFailureException` ném ra giữa chừng, xác nhận transaction mới đọc lại đúng trạng
   thái terminal và không retry thêm.

---

## PHẦN 2 — P1

### 3. [P1] ✅ Không có API/UI để Obsolete riêng 1 Revision dù DB/authorization đã cấu hình

**Đã xác nhận**: `RevisionWorkflowAction.OBSOLETE` tồn tại (enum), `RevisionWorkflowAuthorizationService`
có nhánh `case OBSOLETE ->` (yêu cầu `isEffective`), migration `V273` seed đầy đủ policy DB
(`object_type=REVISION, action_code=OBSOLETE, from_status=EFFECTIVE`, permission
`documents.revision.obsolete`, actor DCO/DOCUMENT_ADMIN). Nhưng: `RevisionController.java` không có
endpoint nào liên quan "obsolete"; `RevisionService.java` không có method public
`obsoleteRevision(...)` (chỉ có "OBSOLETED" xuất hiện như tác dụng phụ của flow khác — auto-supersede
khi publish revision mới); `RevisionActionCapabilityService` không expose capability `obsolete` cho
Revision.

**Hậu quả**: đây là 1 tính năng cấu hình dở dang — DB/quyền đã sẵn sàng nhưng không ai gọi tới được,
dễ gây hiểu lầm cho Admin khi thấy policy `OBSOLETE` trong màn cấu hình Workflow Policy mà không rõ
nó dùng ở đâu.

**Biện pháp xử lý đề xuất**:
1. **Cần quyết định nghiệp vụ trước khi code**: có thực sự cần chức năng "Obsolete 1 Revision riêng lẻ"
   (khác với Obsolete cả Document, vốn đã obsolete tất cả Revision) hay không? Trường hợp dùng thực
   tế là gì (VD: obsolete 1 Effective Revision cũ khi đã có Revision mới hơn, mà không muốn đóng cả
   Document)?
2. Nếu có nhu cầu thật: thêm endpoint `POST /revisions/{id}/obsolete`, method
   `RevisionService.obsoleteRevision(...)` theo đúng policy đã seed sẵn, expose capability `obsolete`
   trong `RevisionActionCapabilityService`.
3. Nếu không có nhu cầu thật: cân nhắc xoá bỏ policy DB không dùng (`V273` phần REVISION/OBSOLETE) để
   tránh nhầm lẫn, hoặc ít nhất ghi chú rõ trong UI cấu hình rằng action này "chưa có endpoint thực
   thi, chỉ tồn tại làm nền tảng".

---

### 4. [P1] ✅ Backend cho Cancel Document Draft dù đã có Revision

**Vị trí**: `DocumentService.cancelDocument()` (dòng 1587-1616).

**Cơ chế lỗi**: chỉ gọi `documentAuthorizationService.requireDocumentMasterLifecycleAction(...)` rồi
set status thẳng sang `CLOSED_CANCELLED` — không có bất kỳ query nào tới
`documentRevisionRepository`/`DocumentRevisionRecord`. Đường authorization
(`DocumentMasterWorkflowAuthorizationService` → `DocumentResourceAdapter.resolvePolicy`) cũng chỉ xét
theo status/type của Document, không xét Revision. Trong khi đó `obsoleteDocument()` (cùng file) đã
có check tồn tại Revision Effective/in-progress (dòng 1631-1645) — nghĩa là pattern kiểm tra này đã
biết và áp dụng cho Obsolete nhưng bị bỏ sót ở Cancel.

**Hậu quả**: UI chỉ hiện nút Cancel khi chưa có Revision, nhưng gọi API trực tiếp (hoặc do race/stale
request) có thể đóng hẳn Document Master trong khi Revision Draft vẫn tồn tại và vẫn được thao tác
tiếp — Document "biến mất" khỏi luồng nhưng Revision con vẫn sống, gây trạng thái mồ côi.

**Biện pháp xử lý đề xuất**:
1. Thêm guard đầu `cancelDocument()`: nếu tồn tại bất kỳ Revision nào của Document (không chỉ
   Effective/in-progress như Obsolete — vì Cancel Document về bản chất chỉ nên áp dụng khi Document
   *chưa từng* có Revision thật), throw lỗi rõ ràng.
2. Test: tạo Document → tạo 1 Revision Draft → gọi API Cancel Document trực tiếp → phải bị chặn.

---

### 5. [P1] ✅ Màn tạo Document cũ đọc field capability không tồn tại ở backend response thật

**Đã xác nhận**: `DocumentDetailResponse` (backend, `com.eqms.dto.document`) **không có** field
`canCancel`/`canObsolete`/`canStartInitialAuthoring`. Nhưng FE có 1 type `DocumentDetailResponse`
**riêng** (`eqms/src/features/documents/document-list/types.ts:270-272`) khai báo các field này —
type FE này không được generate từ DTO backend, là 2 khái niệm trùng tên nhưng khác nội dung.
`NewDocumentView.tsx` (dòng 985-989, và dùng ở 1926/1957/2101/2151) đọc thẳng
`detail.canCancel`/`detail.canObsolete`/`detail.canStartInitialAuthoring` từ response thật của
backend — nhưng vì backend không bao giờ trả các field này, giá trị luôn `undefined` →
`Boolean(undefined) === false` → nút Cancel/Obsolete/authoring trên màn hình này **luôn bị ẩn/disable**
bất kể quyền thật của user.

**Hậu quả**: đây là bug UX (tính năng bị khoá sai trên 1 màn hình cụ thể — "màn tạo Document cũ"),
không phải lỗ hổng bảo mật (API vẫn kiểm tra quyền đúng ở tầng service khi gọi trực tiếp) — nhưng gây
trải nghiệm sai, user có quyền vẫn không thấy nút.

**Biện pháp xử lý đề xuất**:
1. Xác nhận "màn tạo Document cũ" (`NewDocumentView.tsx`) có còn là màn hình đang dùng thật hay đã bị
   thay thế bởi 1 view mới hơn (nếu đã thay thế, cân nhắc xoá code chết thay vì sửa).
2. Nếu còn dùng: sửa FE đọc đúng field capability thật mà backend trả (kiểm tra
   `DocumentDetailResponse` backend đang trả field nào tương đương — có thể qua
   `documentMasterCapabilities.actions.*` như các view mới hơn đang dùng, xem
   `DetailDocumentView.tsx` làm ví dụ tham chiếu) thay vì field ảo `canCancel`/`canObsolete`/
   `canStartInitialAuthoring`.
3. Xoá field thừa khỏi FE type `DocumentDetailResponse` sau khi sửa, tránh tái diễn nhầm lẫn.

---

### 6. [P1] ✅ Ngày Obsolete không được validate đúng, âm thầm bị thay bằng thời điểm hiện tại

**Vị trí**: `DocumentService.parseDate()` (dòng 3165-3181), `parseDateOrNow()` (dòng 3183-3189), dùng
tại `obsoleteDocument()` dòng 1651.

**Cơ chế lỗi**: `parseDate()` chỉ nhận đúng 2 dạng (`dd/MM/yyyy HH:mm:ss...` hoặc `dd/MM/yyyy`),
ngoài ra thử `LocalDate.parse` (ISO date-only). FE (`NewDocumentView.tsx:1694`) gửi
`new Date().toISOString()` — dạng `2026-08-19T10:00:00.000Z` — **không khớp bất kỳ dạng nào ở trên**
→ `LocalDate.parse` ném exception → bị bắt, trả về `null` → `parseDateOrNow` **âm thầm** dùng
`Instant.now()` thay thế, không báo lỗi, không cảnh báo. Ngày người dùng chọn trên UI bị bỏ qua hoàn
toàn trong đúng lời gọi thật này. Ngoài ra, nếu gửi đúng dạng `dd/MM/yyyy`/ISO date-only hợp lệ, hệ
thống **không có bất kỳ validate range nào** (không chặn ngày quá khứ xa, không chặn ngày tương lai).

**Hậu quả**: 2 vấn đề riêng biệt — (a) bug thật đang xảy ra: ngày Obsolete người dùng chọn trên UI
hiện tại bị bỏ qua âm thầm, luôn dùng thời điểm request thay vào (do sai định dạng gửi lên); (b) lỗ
hổng tiềm ẩn: nếu sửa định dạng gửi cho khớp, vẫn có thể backdate/future-date tự do vì không có
validate range.

**Biện pháp xử lý đề xuất**:
1. Sửa `parseDate()` nhận thêm ISO Instant/OffsetDateTime (dạng FE đang gửi thật) — dùng
   `DateTimeFormatter.ISO_INSTANT` hoặc `Instant.parse()` thử trước.
2. `parseDateOrNow` **không nên** âm thầm nuốt lỗi parse khi caller **có gửi** giá trị (chỉ fallback
   `now()` khi field thực sự không được gửi/null) — nếu gửi nhưng parse lỗi, phải throw
   `IllegalArgumentException` rõ ràng, không được lặng lẽ đổi ý người dùng.
3. Thêm validate range: **cần chốt nghiệp vụ** khoảng hợp lệ (VD: không được là ngày tương lai; có
   cho phép backdate hay không, và nếu cho phép thì cần lý do/duyệt riêng như 1 dạng "quá khứ có kiểm
   soát" — GMP thường không khuyến khích backdate tự do).
4. Test: gửi đúng ISO instant thật như FE đang gửi → xác nhận ngày được dùng đúng, không lặng lẽ
   thay bằng `now()`.

---

## PHẦN 3 — P2

### 7. [P2] ✅ Cấu hình quyền Obsolete Document bị lệch giữa registry mặc định và DB thật (có chủ đích, nhưng vẫn là rủi ro "Reset to Default")

**Đã xác nhận**: `WorkflowActionDefaultPolicyRegistry.java` (dòng 30-32) định nghĩa mặc định cho
Document/OBSOLETE là permission `documents.document.obsolete`. Nhưng bảng thật đang dùng để enforce
(`lifecycle_state_policies`, đọc bởi `DocumentResourceAdapter`/`DocumentMasterWorkflowAuthorizationService`)
được seed ở `V352__seed_lifecycle_state_policies_for_document_master.sql` (dòng 34-36) với permission
`documents.workspace.manage` — **có chủ đích**, đã ghi rõ trong comment đầu file V352 (dòng 1-21) là
để khớp với actor mapping cũ đã tồn tại trước đó (`PERMISSION:documents.workspace.manage`).

**Hậu quả**: dù là có chủ đích, registry code (nguồn "System Default" hiển thị cho Admin) vẫn không
khớp giá trị thật đang chạy. Nếu Admin bấm "Reset to System Default" cho policy này, hệ thống sẽ âm
thầm đổi permission yêu cầu từ `documents.workspace.manage` sang `documents.document.obsolete` —
đúng như Codex mô tả, có thể gây thay đổi quyền ngoài ý muốn.

**Biện pháp xử lý đề xuất**:
1. Đồng bộ lại giá trị mặc định trong `WorkflowActionDefaultPolicyRegistry.java` cho khớp với giá trị
   thật đang chạy trong `lifecycle_state_policies` (`documents.workspace.manage`) — **trừ khi** có lý
   do nghiệp vụ để 2 permission này khác nhau, thì cần ghi rõ trong code/UI rằng "Reset to Default"
   cho action này sẽ đổi permission, cảnh báo rõ trước khi Admin xác nhận.
2. Rà soát toàn bộ registry xem còn action nào khác bị lệch tương tự (không chỉ riêng OBSOLETE).

### 8. [P2] ✅ Policy OBSOLETE cho Revision có trong DB nhưng không có default trong registry

Xác nhận: `V273` seed policy REVISION/OBSOLETE thật trong DB, nhưng
`WorkflowActionDefaultPolicyRegistry.java` không có entry tương ứng trong `REVISION_DEFAULTS`. Nếu
Admin "Reset to System Default" cho policy này, hệ thống không có gì để khôi phục về — hành vi không
xác định/không nhất quán.

**Biện pháp xử lý đề xuất**: thêm entry `addRev(m, "OBSOLETE", "EFFECTIVE", ...)` vào registry khớp
với nội dung đã seed ở V273, để "Reset to Default" hoạt động đúng — làm cùng đợt với mục 3 (quyết
định có giữ tính năng Obsolete-Revision-riêng-lẻ hay không, vì 2 việc liên quan trực tiếp).

### 9. [P2] ✅ `reopenDocument` ở FE gọi API không tồn tại (404 chắc chắn)

Xác nhận: FE (`documents.ts:621-624`) có hàm `reopenDocument` gọi `POST /documents/{id}/reopen`.
Backend hoàn toàn không có mapping nào cho `reopen`; `DocumentResourceAdapter.java` (dòng 33-35,
79-81) ghi rõ trong comment: "REOPEN — no implementation exists anywhere in the codebase".

**Biện pháp xử lý đề xuất**: xác nhận có màn hình FE nào đang thực sự gọi `reopenDocument` không (nếu
có, đây là bug 404 thật cần khắc phục gấp — làm cùng nhóm ưu tiên P1); nếu không có nơi gọi (dead
code), quyết định giữa (a) implement endpoint thật nếu có nhu cầu nghiệp vụ Reopen Document, hay (b)
xoá hàm FE + policy DB thừa để tránh nhầm lẫn — **cần hỏi nghiệp vụ**.

### 10. [P2] ✅ Dashboard dùng status code cũ, luôn đếm ra 0

Xác nhận: `DashboardService.java` (dòng 89-92) đếm theo `"OBSOLETE"`/`"CANCELLED"`, trong khi status
thật trong hệ thống là `"OBSOLETED"`/`"CLOSED_CANCELLED"` (seed tại `V6`, và chính
`cancelDocument`/`obsoleteDocument` cũng set đúng 2 mã này). Đếm dashboard theo 2 mã cũ sẽ luôn ra 0.

**Biện pháp xử lý đề xuất**: sửa `DashboardService.java` dùng đúng status code hiện hành. Nên tham
chiếu 1 hằng số dùng chung (như đã đề xuất ở mục case-sensitivity `relation_type` trong audit trước)
thay vì hardcode string rải rác, để tránh tái diễn.

### 11. [P2] ⚠️ File helper FE định nghĩa trạng thái Cancel-được cho Revision sai so với backend — nhưng có vẻ là dead code

Xác nhận file `eqms/src/features/documents/shared/documentLifecycleActions.ts` (dòng 27-38) định
nghĩa `REVISION_CANCELABLE_STATUSES` gồm cả Pending Review/Approval/Training/Ready for Publishing,
trong khi backend (`RevisionService.java` dòng 1350-1353) chỉ cho Cancel khi `DRAFT`. Tuy nhiên grep
toàn bộ `eqms/src` không tìm thấy nơi nào khác import `REVISION_CANCELABLE_STATUSES`/
`canCancelRevisionStatus` — khả năng cao là code chết, chưa gây ảnh hưởng UI thật hiện tại.

**Biện pháp xử lý đề xuất**: xoá file/hàm này nếu xác nhận đúng là không dùng ở đâu (rà thêm 1 lần
nữa bằng cách build FE và kiểm tra warning "unused export" nếu có công cụ hỗ trợ, tránh bỏ sót
re-export gián tiếp). Nếu chưa dùng nhưng dự định dùng trong tương lai, sửa lại đúng theo backend
(chỉ DRAFT) trước khi có ai vô tình import và làm UI hiện sai hành động.

---

## PHẦN 4 — P3

### 12. [P3] ✅ Cancel Document không yêu cầu chữ ký điện tử

Xác nhận: `DocumentService.cancelDocument()` không gọi `requireValidSignatureToken` hay bất kỳ
`electronicSignatureService...` nào — chỉ update status + audit log thường. Trong khi
`obsoleteDocument()` (dòng 1624) và `RevisionService.cancelRevision()` (dòng 1345 + ghi signature dòng
1380) đều có bước ký điện tử.

**Biện pháp xử lý đề xuất**: **cần chốt với SOP/CSV**: Cancel Document Master có được coi là
"GMP-significant disposition" hay không? Nếu có (nhiều khả năng có, vì đây là hành động đóng hẳn 1
Document Master — tương đương mức độ với Obsolete và Cancel Revision, cả 2 đều đã yêu cầu ký) — thêm
bước `requireValidSignatureToken` + ghi signature record vào `cancelDocument()`, đồng nhất với 2 luồng
kia. Nếu nghiệp vụ xác nhận không cần (VD: Cancel chỉ áp dụng khi Document còn ở Draft, chưa có ý
nghĩa GMP thật sự cho tới khi có Revision đầu tiên) — giữ nguyên nhưng ghi rõ lý do bằng comment trong
code để tránh bị coi là "quên" trong lần audit sau.

---

## THỨ TỰ TRIỂN KHAI ĐỀ XUẤT

**Đã sắp lại theo đề nghị của Codex** — lý do đổi: race Controlled Copy (mục 2) là 1 bug độc lập
hoàn toàn với mọi quyết định nghiệp vụ, có thể code+test ngay, không có lý do gì để xếp sau nhóm P1 —
bản thứ tự trước xếp nó sau P1 là không tối ưu.

1. **Mục 2 (P0 — race Controlled Copy async)** — làm đầu tiên. Không phụ thuộc quyết định nghiệp vụ
   nào, rủi ro dữ liệu GMP cao (copy đã Obsoleted có thể tự động "sống lại" thành Distributed), và
   bản sửa đúng (SKIPPED_TERMINAL, không retry/không restore) đã được làm rõ ở mục 2 phía trên.
2. **Mục 4 (P1 — chặn Cancel Document nếu đã từng có Revision)** — sửa đơn giản, độc lập nghiệp vụ,
   rủi ro dữ liệu mồ côi rõ ràng.
3. **Mục 1 (P0 — ghi history/audit Revision khi obsolete Document)** — cần chọn Hướng A hay B (xem
   mục 1) trước khi code, nhưng bản thân việc chọn hướng không phải quyết định nghiệp vụ nặng, có thể
   quyết nhanh với người phụ trách kiến trúc rồi làm luôn; câu hỏi nghiệp vụ "có cần ký riêng từng
   Revision" (mục 1, điểm 4) có thể tách riêng, không chặn phần ghi history/audit (không cần chữ ký
   riêng vẫn ghi được history/audit + tham chiếu signature Document).
4. **Mục 5 (P1 — sửa hợp đồng capability FE/BE cho `NewDocumentView.tsx`)** — cần xác nhận màn hình
   còn dùng thật hay không trước, nhưng việc xác nhận này nhanh, nên làm sớm để không phải quay lại.
5. **Mục 6 (P1 — validate `obsoleteDate`)** — đang là bug thật (ngày UI chọn bị bỏ qua âm thầm ngay
   lúc này), phần sửa định dạng parse + không nuốt lỗi làm được ngay; phần validate range (backdate/
   future-date) cần chốt nghiệp vụ, có thể tách làm sau nếu cần.
6. **Chốt nghiệp vụ (làm 1 đợt, trả lời cả 3 câu hỏi cùng lúc cho đỡ phải hỏi lại nhiều lần)**:
   - Có/không giữ tính năng Obsolete riêng cho 1 Revision (mục 3) — nếu có, làm cùng mục 7+8 (P2
     drift policy liên quan).
   - Có/không implement Reopen Document thật (mục 9) — nếu không, xoá `reopenDocument` FE + policy DB
     thừa.
   - Cancel Document có cần electronic signature hay không (mục 12).
7. **Mục 7 + 8 (P2 — registry vs DB drift cho policy Obsolete)** — làm cùng lúc với quyết định ở mục
   6 vì phụ thuộc trực tiếp việc giữ/bỏ Obsolete-Revision-riêng.
8. **Mục 9 + 10 (P2 — `reopenDocument` 404 tiềm ẩn, Dashboard đếm sai status code)** — mức thấp,
   `reopenDocument` chờ quyết định ở mục 6, Dashboard (mục 10) có thể sửa độc lập ngay.
9. **Mục 11 (P2 — dead code helper FE sai trạng thái)** — dọn dẹp, ưu tiên thấp nhất.

---

## GHI CHÚ VỀ PHƯƠNG PHÁP VERIFY

Toàn bộ 12 mục đã được xác nhận bằng cách đọc trực tiếp source code (backend Java + frontend TS) và
migration SQL qua 3 tác vụ đọc-code độc lập chạy song song, mỗi mục đều có trích dẫn file:line cụ
thể — không có mục nào được chấp nhận chỉ dựa trên mô tả của báo cáo gốc. 11/12 mục **CONFIRMED đầy
đủ**; mục 11 (P2, helper FE) là **PARTIALLY CONFIRMED** vì nội dung mô tả đúng nhưng chưa xác nhận
được có đang thực sự ảnh hưởng UI hay là dead code — cần rà thêm trước khi quyết định hướng xử lý.

**Chưa có thay đổi code nào được thực hiện — tài liệu này chỉ để lên kế hoạch**, chờ xác nhận từ
người phụ trách trước khi triển khai, đặc biệt các điểm cần quyết định nghiệp vụ đã đánh dấu rõ ở
từng mục (ký điện tử cho Cancel Document, giữ/bỏ Obsolete-Revision-riêng, validate range cho ngày
Obsolete, reopen Document có cần implement hay không).

---

## Đã cập nhật theo review của Codex (v1 → v2)

Codex nhận xét bản v1 "nhìn chung đúng, có thể dùng làm nền để sửa" nhưng chỉ ra 3 điểm sẽ gây sai
hoặc không compile nếu giao thẳng cho code agent. Cả 3 đã tự verify lại qua code trước khi áp dụng:

1. **Mục 2 (race Controlled Copy)**: xác nhận sai claim "không có optimistic locking" —
   `ControlledCopyRecord.java` dòng 32 **đã có `@Version`**. Quan trọng hơn: bản sửa đề xuất ban đầu
   ("return false khi gặp trạng thái terminal") là **sai hướng**, đã xác nhận qua code
   `ControlledCopyBatchDistributionAsyncService.finalizeWithRetry()`/`restoreFailedCopy()` (dòng
   146-178) rằng `false` bị worker hiểu là lỗi xử lý file → retry → gọi
   `markDistributedCopyProcessingFailed()` → **chính hàm này set copy thành
   `READY_FOR_DISTRIBUTION`** — nếu áp dụng bản sửa cũ, mọi lần Obsolete trùng lúc job chạy sẽ *chắc
   chắn* bị ghi đè thay vì chỉ *có thể* bị ghi đè như hiện tại. Đã sửa lại thành: kết quả kiểu enum
   riêng (`SKIPPED_TERMINAL` thay vì `false`), không đi qua nhánh retry/restore.
2. **Mục 1 (audit trail Revision)**: xác nhận `RevisionService.recordRevisionHistory` là `private`
   (4 overload, dòng 4326-4354) — gọi thẳng từ `DocumentService` như bản v1 đề xuất **không compile
   được**. Đã sửa thành 2 hướng để chọn (tách service dùng chung, hoặc thêm public domain method
   trong `RevisionService`), kèm đề xuất lưu lại `signatureId` trả về từ `createEntitySignature(...)`
   (hiện đang bị bỏ qua) để Revision có thể tham chiếu ngược về đúng chữ ký Document.
3. **Thứ tự triển khai**: xếp lại race Controlled Copy (mục 2) lên đầu tiên — đây là bug độc lập hoàn
   toàn với mọi quyết định nghiệp vụ, không có lý do gì để chờ sau nhóm P1 như bản v1.

Các mục còn lại (3, 5, 6, 7-11) Codex xác nhận đúng, không cần sửa thêm — chỉ mục 1 và 2 được cập
nhật nội dung, các mục khác chỉ đổi số thứ tự trong phần "Thứ tự triển khai đề xuất".

## Đã cập nhật theo review của Codex (v2 → v3)

Codex xác nhận v2 "đã sửa đúng 3 vấn đề chính của v1, có thể dùng làm nền triển khai", nhưng chỉ ra 2
điểm kỹ thuật cần chỉnh thêm — cả 2 đã tự verify lại qua code trước khi áp dụng:

1. **Mục 1, test P0**: bản v2 vẫn còn câu "obsolete 1 Document có N Revision (Draft/Effective/
   Obsoleted có sẵn)" — Codex chỉ ra đây là tình huống **không thể xảy ra**. Đã xác nhận qua code
   `DocumentService.obsoleteDocument()` (dòng 1631-1645): method này bắt buộc phải tồn tại 1 Revision
   `EFFECTIVE`, và **ném lỗi chặn hoàn toàn** nếu còn bất kỳ Revision nào ở trạng thái
   `DRAFT`/`PENDING_REVIEW`/`PENDING_APPROVAL`/`PENDING_TRAINING`/`READY_FOR_PUBLISHING` — nghĩa là 1
   lần gọi thành công **không bao giờ** có Revision Draft đi kèm. Đã sửa lại mô tả "Hậu quả" và toàn
   bộ đề xuất test ở mục 1: Document `ACTIVE` + đúng 1 Revision `EFFECTIVE` (bắt buộc) + có thể kèm
   Revision đã `OBSOLETED`/`CLOSED_CANCELLED` từ trước + không có Revision đang xử lý.
2. **Mục 2, cách bắt optimistic-lock conflict**: bản v2 nói bắt `OptimisticLockingFailureException`
   ngay trong `finalizeDistributedCopy()` rồi đọc lại record — Codex chỉ ra lỗi này thường phát sinh
   lúc **transaction commit** (boundary của proxy `@Transactional`), tức là **sau khi** method đã
   return, nên `try/catch` đặt thẳng trong thân method có thể không bắt đúng chỗ nếu không có gì buộc
   flush trước đó. Đã sửa thành 2 cách hợp lệ để chọn: (A) flush cưỡng bức (`repository.flush()`)
   ngay trong 2 method service để buộc conflict lộ ra sớm, bắt được tại chỗ; hoặc (B) không tự bắt ở
   tầng service, để `ControlledCopyBatchDistributionAsyncService` bắt lỗi sau khi transaction rollback
   rồi mở 1 transaction mới đọc lại record để quyết định `SKIPPED_TERMINAL` hay không — nêu rõ đây là
   quyết định kiến trúc cần chốt trước khi code, không tự chọn thay. Giữ nguyên yêu cầu: dù chọn cách
   nào, cả `finalizeDistributedCopy()` và `markDistributedCopyProcessingFailed()` vẫn phải chặn
   terminal state ngay khi đọc record (không đợi tới lúc có conflict mới check).

Các mục còn lại giữ nguyên như v2, Codex xác nhận đúng hướng.

## Đã cập nhật theo review của Codex (v3 → v4)

Codex xác nhận v3 "đã xử lý đúng 2 điểm quan trọng của v2, có thể dùng để triển khai", chỉ còn 2 chỉnh
sửa câu chữ nhỏ — cả 2 đã verify lại qua code/DB trước khi áp dụng:

1. **"Có đúng 1 Revision EFFECTIVE" → "có ít nhất 1 Revision EFFECTIVE"**: đã xác nhận qua
   `\d document_revisions` (DB thật) rằng chỉ có unique constraint
   `ux_document_revisions_one_in_progress` chặn nhiều Revision **đang xử lý** cùng lúc
   (DRAFT/PENDING_*/READY_FOR_PUBLISHING) — **không có constraint nào** giới hạn chỉ đúng 1 Revision
   EFFECTIVE. Về lý thuyết, dữ liệu lịch sử/migration cũ vẫn có thể có nhiều hơn 1 Revision EFFECTIVE
   cùng lúc cho 1 Document. Đã sửa lại câu chữ ở mục 1 (Hậu quả + Biện pháp xử lý điểm 5) từ "đúng 1"
   thành "ít nhất 1", và thêm 1 kịch bản test phòng thủ riêng: Document có ≥2 Revision EFFECTIVE →
   xác nhận **tất cả** đều có history/audit riêng sau khi Obsolete, không chỉ 1 bản.
2. **"Không để lại dấu vết GMP nào" → diễn đạt lại chính xác hơn**: đã xác nhận qua code
   `obsoleteDocument()` (dòng 1653-1657 khu vực gần đó, tương tự cho Revision) rằng vòng lặp obsolete
   Revision **vẫn có** set `revision.setObsoletedBy(currentUser)`/`revision.setObsoletedAt(...)` trên
   entity — không phải hoàn toàn không ghi gì. Đã sửa lại mô tả "Hậu quả" ở mục 1: vấn đề thực sự là
   **thiếu event history/audit trail bất biến** (không thể sửa/xoá sau khi ghi, khác 2 field trên
   entity có thể bị ghi đè bởi thao tác khác sau này) **và thiếu liên kết rõ ràng tới electronic
   signature** của hành động Obsolete — nên truy vết GMP **chưa đầy đủ**, không phải "không có gì".

Chỉ mục 1 được chỉnh câu chữ; các mục khác (2-12) giữ nguyên như v3, không cần sửa thêm. Bản v4 sẵn
sàng để triển khai.

## Quyết định đã chốt trước khi code (v4 → v5)

1. **Mục 1 — hướng tổ chức code**: đã chốt dùng **Hướng B** (public domain method trong
   `RevisionService`, không tách service riêng). Đã bổ sung yêu cầu quan trọng: method mới
   (`obsoleteRevisionAsPartOfDocumentObsolete` hoặc tên tương đương) phải làm **trọn vẹn** việc đổi
   status + set `obsoletedBy`/`obsoletedAt` + ghi history + ghi audit trong **cùng 1 transaction**,
   không chỉ đảm nhận riêng phần history/audit rồi để `DocumentService` tự làm phần status ở chỗ khác
   — tránh cập nhật nửa vời nếu có lỗi giữa chừng.
2. **Mục 1 — câu hỏi ký riêng từng Revision**: **chưa chốt**, vẫn đang chờ QA/Compliance xác nhận.
   Cho tới khi có câu trả lời, code theo hướng mặc định "tham chiếu chữ ký Document là đủ" (đã có sẵn
   trong kế hoạch) — **không tự ý thêm bước ký điện tử riêng cho từng Revision**.

Với 2 điểm trên đã chốt, mục 1 sẵn sàng để triển khai theo đúng Hướng B mô tả ở trên. Các mục khác
trong kế hoạch (2-12) vẫn giữ nguyên trạng thái như v4 — vẫn cần chốt các câu hỏi nghiệp vụ riêng của
từng mục trước khi code phần đó (xem "Thứ tự triển khai đề xuất").
