# Kế hoạch xử lý lỗi — Luồng tạo mới Document (Master) & Revision

Đối chiếu báo cáo audit của Codex với code thật (BE Java), dữ liệu thật trong PostgreSQL local, và
migration history. Mỗi mục ghi rõ **mức độ xác minh**: đã đọc trực tiếp code/DB (✅ xác nhận đúng),
hay chỉ đối chiếu nhanh/suy luận theo pattern đã biết (⚠️ hợp lý, chưa verify sâu).

**Bản v3**: đã cập nhật theo review lần 2 của Codex trên bản v2 (4 điểm kỹ thuật — xem mục "Đã cập
nhật theo review của Codex" ở cuối file, cả v1→v2 và v2→v3). **Không có thay đổi code nào được thực
hiện trong phiên viết bản v3 — chỉ lên kế hoạch.**

## TRẠNG THÁI TRIỂN KHAI (cập nhật sau khi code, deploy, và Codex nghiệm thu vòng 1)

Đã triển khai #1, #2, #3, #4, #6, #8, #9, #10, #11, #12, #14, #15 theo đúng thứ tự ưu tiên đã chốt.
Codex nghiệm thu vòng 1 phát hiện 1 lỗi Critical còn sót (Approver vẫn có thể bị xoá hết qua
`approverUserIds: []`), test cũ chưa cập nhật theo fix `"RELATED"`, chưa có test regression cho các
control mới, `requirePoolMembership` mới chỉ "mirror" chứ chưa gộp về 1 chỗ, và
`requireRevisionSourceFile()` mới kiểm tra field chứ chưa xác nhận file thật đọc được. Toàn bộ 5
điểm đó đã được sửa tiếp và verify lại — chi tiết trong mục "Đã cập nhật sau nghiệm thu vòng 1" ở
cuối file.

**#5 (Flyway V359/V364 drift) vẫn CHƯA xử lý** — đúng như kế hoạch, đây là hạng mục cần change
control riêng (backup, phê duyệt, đối chiếu schema từng môi trường), không gộp vào đợt sửa lỗi
nghiệp vụ này. Không đánh dấu "done".

**Test suite**: `RevisionBusinessRulesTest` (21 test, bao gồm 7 test mới cho các control vừa sửa) và
`RevisionUpgradeSessionServiceTest` (3 test mới) đều pass. Chạy toàn bộ test suite backend (575
test) còn 22 lỗi (8 failures + 14 errors) — toàn bộ nằm trong các file **không thuộc phạm vi audit
này** (`DictionaryManagementServiceAuthorizationTest`, `ClamAvScanServiceIntegrationTest`,
`ControlledCopyBatchDiscrepancyScannerIntegrationTest`, `ControlledCopyListAuthorizationIntegrationTest`,
`UpgradeRevisionIntegrationTest`, `UserManagementServiceSelfEscalationGuardTest`,
`UserManagementServiceStatusTransitionTest`) — pre-existing từ khối thay đổi uncommitted khác trong
repo (đã xác nhận qua `git status`: các file production tương ứng đang ở trạng thái "modified" từ
trước, không phải do đợt sửa lỗi này), phần lớn do thiếu hạ tầng tích hợp thật (ClamAV daemon) hoặc
thiếu mock trong test. Không tự ý sửa các test này vì ngoài phạm vi được giao.

---

## PHẦN 1 — LỖI NGHIÊM TRỌNG (verify sâu, có bằng chứng cụ thể)

### 1. [Critical] ✅ API cập nhật Revision có thể xoá participant tuỳ theo field nào bị bỏ trống

**Vị trí**: `RevisionService.saveRevisionParticipantsFromRequest()` (dòng ~3245), được gọi
**vô điều kiện** từ `updateRevision()` (dòng 718, có `@Transactional`) mỗi lần `PUT /revisions/{id}`.

**Cơ chế lỗi** (đã soát lại chính xác theo từng điều kiện, không khái quát hoá quá rộng như bản v1):
```java
private void saveRevisionParticipantsFromRequest(...) {
    revisionWorkflowParticipantRepository.deleteAllByRevision_Id(revision.getId());  // luôn xoá hết trước
    ...
    validateReviewerIdsForRequirement(revision.getReviewRequirement(), reviewerUserIds.size());  // (A) chạy vô điều kiện

    if (request.coAuthorIds() != null) validateCoAuthorRules(...);                                // (B) chỉ chạy nếu field có mặt, KHÔNG có rule "phải >0"
    if (request.reviewerUserIds() != null) validateReviewerRules(...);                             // (C) chỉ chạy nếu field có mặt
    if (request.approverUserIds() != null && !approverUserIds.isEmpty()) validateApproverRules(...); // (D) chỉ chạy nếu field có mặt VÀ không rỗng
}
```
**Kết quả theo từng trường hợp cụ thể (đã trace chính xác, không phải mọi trường hợp đều mất dữ
liệu)**:
- Revision có `reviewRequirement = REQUIRED` và **bỏ trống `reviewerUserIds`** → check (A) ném
  `IllegalArgumentException` ("AT_LEAST_ONE_REVIEWER_REQUIRED") → toàn bộ transaction (kể cả lệnh
  xoá ở đầu) **rollback** → **dữ liệu không mất** trong trường hợp này.
- Revision có `reviewRequirement = NONE` và bỏ trống `reviewerUserIds` → check (A) không ném lỗi
  (0 reviewer thoả điều kiện NONE) → roster Reviewer **bị xoá thật** (nếu trước đó có sẵn reviewer
  do đổi review requirement từ trạng thái khác).
- Gửi `reviewerUserIds` hợp lệ nhưng **bỏ trống/omit `approverUserIds`** → check (D) bị skip do
  điều kiện `!isEmpty()` → **Approver bị xoá thật, không có bất kỳ validate nào chặn lại** — đây là
  bypass rõ ràng nhất, đã xác nhận.
- **Bỏ trống/omit `coAuthorIds`** → check (B) bị skip hoàn toàn (không có rule nào yêu cầu
  Co-Author phải non-empty) → Co-Author **bị xoá thật** không cảnh báo.
- Tổng kết: **API hiện có "contract" mơ hồ** — cùng 1 kiểu thao tác (bỏ trống 1 field) có lúc bị
  chặn bằng exception (an toàn), có lúc âm thầm xoá dữ liệu thật (không an toàn), tuỳ thuộc
  `reviewRequirement` hiện tại và field nào bị bỏ trống. Đây chính xác là vấn đề cần sửa — không
  phải "mọi field bỏ trống đều mất dữ liệu vĩnh viễn" như mô tả ở bản v1.

**Dữ liệu đáng ngờ trong DB local** (chỉ nêu như dấu hiệu, không khẳng định nguyên nhân):
```
revision_number | status_code           | approvers | reviewers | review_requirement
1.0.1            | READY_FOR_PUBLISHING  |     1     |     0     | REQUIRED
```
Vi phạm rõ ràng 1 invariant nghiệp vụ (REQUIRED nhưng 0 reviewer ở trạng thái đã qua Review) — cần
coi là 1 case remediation dữ liệu độc lập (mục 7), không giả định chắc chắn do bug này gây ra vì
chưa có audit trail chi tiết xác nhận.

**Biện pháp xử lý đề xuất**:
1. **Quyết định rõ contract API trước khi sửa code** (điểm Codex nhấn mạnh thêm ở lần review 2):
   hoặc (a) chuyển hẳn sang **partial update thật sự** (field không gửi = không đổi), hoặc (b) giữ
   nguyên PUT kiểu replace-toàn-bộ nhưng bắt buộc mọi caller luôn gửi đủ cả 3 danh sách participant
   mỗi lần gọi. Lưu ý: [RevisionCreateView.tsx](D:/edms-project/eqms/src/features/documents/document-revisions/views/RevisionCreateView.tsx)
   (FE hiện tại) build payload đầy đủ, luôn gửi cả `coAuthorIds`/`reviewerUserIds`/`approverUserIds`
   và các trường training mỗi lần lưu — nên lý do chọn hướng (a) **không** phải vì "FE hiện chỉ gửi
   field đã đổi". Lý do đúng: DTO/API hiện cho phép field nullable, còn các API consumer ngoài FE
   hiện tại (integration, script, hoặc các lần refactor FE sau này) có thể gửi payload không đầy đủ
   — cần chốt contract rõ ràng ngay từ tầng service để tránh hành vi xoá ngầm bất kể caller là ai,
   không phụ thuộc vào hành vi FE hiện tại. **Hướng (a) vẫn hợp lý hơn** với kiến trúc DTO hiện có —
   cần chốt với người phụ trách trước khi code, không tự quyết định.
2. Nếu theo hướng (a): chỉ xoá & ghi lại participant type nào **thực sự có mặt** trong request.
   Trước khi ghi, build **roster hiệu lực đầy đủ** — kết hợp participant mới gửi (nếu field có mặt)
   hoặc participant hiện có trong DB (nếu field không có mặt) cho cả 3 loại — rồi mới chạy toàn bộ
   rule (Reviewer bắt buộc theo `reviewRequirement`, tối thiểu 1 Approver, SoD, trùng người, quyền
   workflow — mục 4) trên roster kết hợp đó. Không validate từng field riêng lẻ như hiện tại.
3. Chỉ sau khi validate roster kết hợp thành công mới thực hiện xoá + ghi lại (transaction atomic).
4. Thêm audit trail entry riêng biệt mỗi khi participant bị thay đổi.
5. Test tích hợp bắt buộc cho từng bypass đã liệt kê ở trên: (i) update chỉ `description`, không
   gửi participant nào → tất cả participant giữ nguyên; (ii) gửi `reviewerUserIds` không gửi
   `approverUserIds` → Approver giữ nguyên, không bị xoá; (iii) tương tự cho `coAuthorIds`.

---

### 2. [Critical] ✅ Check "Related Document phải Effective trước khi Publish" luôn no-op do sai case

**Vị trí**: `RevisionService.java` dòng 1261 (trong luồng `publishRevision`), 1535, 1764.

**Cơ chế lỗi**:
```java
List<DocumentRelation> relatedRelations = documentRelationRepository
    .findAllBySourceDocument_IdAndRelationType(document.getId(), "Related");  // chữ hoa/thường sai
```
Mọi nơi ghi dữ liệu (`DocumentService.saveRelation`, dòng 2827) đều lưu `relation_type = "RELATED"`.

**Bằng chứng dữ liệu thật**:
```sql
select distinct relation_type, count(*) from document_relations group by relation_type;
 RELATED     | 19
 CORRELATED  | 13
```
100% dữ liệu thật lưu `"RELATED"`. So sánh `=` trong PostgreSQL là case-sensitive — truy vấn
`"Related"` luôn trả 0 dòng.

**Hậu quả**: check "Related Document phải Effective trước khi Publish" (dòng 1261-1308) không bao
giờ chạy được. Liên quan trực tiếp mục 6 (Force Publish) — nhánh override cũng chưa từng được kích
hoạt trong thực tế vì lý do tương tự.

**Biện pháp xử lý đề xuất**:
1. Chuẩn hoá 1 hằng số/enum duy nhất cho relation type dùng chung toàn bộ codebase.
2. Sửa cả 3 vị trí dùng `"Related"` (dòng 1261, 1535, 1764) thành `"RELATED"`.
3. 1 migration có kiểm soát: rà + chuẩn hoá dữ liệu (dù kiểm tra ban đầu đã 100% đúng case) + thêm
   CHECK constraint giới hạn giá trị hợp lệ (mục 15).
4. Test thủ công thật: Document A Related tới B (B chưa Effective) → Publish A phải bị chặn hoặc yêu
   cầu force-publish có governance đủ (mục 6).
5. Rà soát codebase tìm case-sensitivity tương tự ở các cột type/status dạng string tự do khác.

---

### 3. [High] ✅ Participant/Author có thể bị thay đổi sau "Complete Editing" qua ít nhất 2 đường khác nhau

**Đường 1 — đã xác nhận ở bản v2**: `RevisionService.completeEditing()` giữ nguyên
`revision.status = "DRAFT"` sau khi ký PREPARED (chỉ đổi `editingStatus`/`sourceLocked`), nên
`updateRevision()` (chỉ check `status == "DRAFT"`) vẫn cho phép sửa participant qua
`PUT /revisions/{id}`.

**Đường 2 — phát hiện thêm và đã xác nhận qua review lần 2 của Codex**: `PUT /revisions/{id}`
(`updateRevision`) **không** trực tiếp cho đổi Author — Author của Revision được snapshot từ
Document Master. Nhưng có 1 đường hoàn toàn khác:

```java
// RevisionService.java dòng 3051
public void syncDraftRevisionWithDocument(DocumentRecord document) {
    DocumentRevisionRecord draft = revisionRepository
        .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "DRAFT")  // chỉ lọc theo status, KHÔNG lọc editingStatus
        .orElse(null);
    if (draft == null) return;
    draft.setAuthor(document.getAuthor());
    ...
    copyWorkflowParticipantsFromDocument(document, draft);  // xoá + copy lại TOÀN BỘ Co-Author/Reviewer/Approver từ Document Master
}
```
Được gọi từ `DocumentService.updateActiveWorkflowConfiguration()` (dòng 1081) — nghĩa là: khi DCO
cấu hình lại workflow ở **Document Master** (không phải Revision), nếu đang có 1 Draft Revision tồn
tại — **kể cả khi Revision đó đã Complete Editing** (`status` vẫn `"DRAFT"`, chỉ `editingStatus`
đổi) — Author/Co-Author/Reviewer/Approver/training của Revision đó bị **ghi đè hoàn toàn** từ
Document Master, không hề kiểm tra `editingStatus`/`sourceLocked`.

**Hậu quả**: chỉ chặn `updateRevision()` (đường 1) là **không đủ** — đường 2 vẫn cho phép thay đổi
toàn bộ participant + Author của 1 Revision đã ký PREPARED, thông qua thao tác ở màn Document Master
mà người dùng có thể không nhận ra đang ảnh hưởng tới Revision đang soạn thảo.

**Biện pháp xử lý đề xuất**:
1. Thêm guard **ở cả 2 đường**: `updateRevision()` VÀ `syncDraftRevisionWithDocument()` — nếu
   `revision.editingStatus == "COMPLETED"`, chặn ghi đè participant/Author, hoặc yêu cầu luồng
   "Re-open for Editing" có ký điện tử xác nhận lại trước khi đồng bộ.
2. `syncDraftRevisionWithDocument()` nên bỏ qua (skip) Revision đã Complete Editing thay vì đồng bộ
   âm thầm — ghi rõ trong audit trail nếu có xung đột giữa Document Master mới và Revision đã khoá,
   để DCO biết cần xử lý thủ công (re-open hoặc tạo Revision mới).
3. **Quyết định hướng nào (chặn cứng hay có luồng re-open) vẫn là quyết định nghiệp vụ — cần hỏi lại
   product owner trước khi code**, áp dụng đồng nhất cho cả 2 đường.

---

### 4. [High] ✅ Gán Reviewer/Approver không kiểm tra người được gán có đúng quyền workflow

**Vị trí**: `saveRevisionParticipantsFromRequest()` dùng `resolveUser()` — không filter permission.

**Đã xác nhận**: `DocumentService.requirePoolMembership(String poolType, UserAccount user)` (dòng
2944) đã có sẵn đúng logic này cho Document Master (map `APPROVER` → `documents.revision.approve`,
còn lại → `documents.revision.review`, gọi `permissionEvaluationService.hasPermission`).
RevisionService chưa có logic tương đương.

**Biện pháp xử lý đề xuất**:
1. Trích xuất `requirePoolMembership` khỏi `DocumentService` thành 1 hàm/service dùng chung (ví dụ
   1 `WorkflowParticipantEligibilityService` nhỏ) để cả Document Master và Revision dùng **cùng 1
   rule duy nhất** — không tạo bản sao logic thứ 2.
2. Gọi hàm dùng chung tại vòng lặp gán participant trong `saveRevisionParticipantsFromRequest`.
3. Áp dụng tương tự cho Co-Author nếu có permission tương ứng cần kiểm tra.

---

### 5. [High] ✅ Flyway migration history lệch khỏi source code

**Bằng chứng**: DB `flyway_schema_history` có version 364 (`success=true`), thư mục migration
KHÔNG có file `V364__*.sql` nào.

**Biện pháp xử lý đề xuất** (xử lý **độc lập, không gộp** với các fix nghiệp vụ khác):
1. Khôi phục nội dung gốc V364 và đối chiếu lại V359 từ Git history.
2. Đối chiếu schema thực tế của **từng môi trường** — không giả định giống local.
3. Controlled recovery: backup trước, có phê duyệt change control, có biên bản — không tự ý chạy
   `flyway repair` hay tạo migration "vá" khi chưa rõ hiện trạng từng môi trường.
4. Chỉ bật lại `flyway validate-on-migrate` sau khi lịch sử đã đồng bộ và xác nhận khớp mọi nơi.
5. Rà soát toàn bộ dãy migration xem còn version nào khác bị lệch tương tự.

---

### 6. [High] ✅ Force Publish thiếu kiểm soát governance riêng

**Vị trí**: `RevisionService.publishRevision()` dòng 1287-1307 — `forcePublish=true` không cần
permission riêng, không bắt buộc lý do, chỉ ghi 1 dòng audit chung chung.

**Lưu ý**: do lỗi #2, nhánh này hiện chưa từng chạy thật — bắt buộc sửa cùng đợt với #2.

**Biện pháp xử lý đề xuất**:
1. Permission riêng (`documents.revision.force_publish`) — **cần chốt với nghiệp vụ trước khi thêm
   permission mới** (ai được phép override).
2. **Không phải bàn cãi, bắt buộc làm dù chọn hướng nào cho mục 1**: `reason`/`justification` không
   rỗng khi `forcePublish=true`, lưu chi tiết vào audit trail.
3. Cân nhắc chữ ký điện tử riêng cho hành động override.

---

## PHẦN 2 — RÀNG BUỘC DỮ LIỆU / SCHEMA

### 7. [High] ✅ DB không có ràng buộc bảo vệ tối thiểu Reviewer/Approver bắt buộc

**Bằng chứng**: không có CHECK constraint nào trên `document_revisions` liên quan participant; dữ
liệu thật có revision `READY_FOR_PUBLISHING` với 0 Reviewer dù `review_requirement=REQUIRED`.

**Biện pháp xử lý đề xuất** (DB trigger chỉ là lớp phòng thủ bổ sung, không phải giải pháp chính):
1. Ưu tiên chính: sửa #1 đúng cách (validate roster hiệu lực đầy đủ ở tầng service).
2. Test tích hợp phủ đầy đủ các luồng update revision.
3. Job/script rà soát định kỳ phát hiện revision thiếu participant bắt buộc.
4. Chỉ cân nhắc thêm deferred constraint trigger (thiết kế kỹ, không chặn giữa transaction
   xoá-rồi-tạo-lại) như bước sau cùng, không phải bước đầu.
5. Sau khi #1 được sửa, chạy script xử lý dữ liệu tồn đọng — liên hệ nghiệp vụ trước khi sửa dữ liệu
   thật.

---

## PHẦN 3 — LỖI NGHIỆP VỤ MỨC TRUNG BÌNH

### 8. [Medium] ✅ Tạo Revision không có source file vẫn Complete Editing được

**Đã sửa lại theo review lần 2 của Codex** — bản v2 đề xuất kiểm tra `storageItemId`, nhưng field
này **sai**: `storage_item_id`/`storage_drive_id`/`storage_web_url`/`storage_edit_url` (đã xác nhận
qua entity `DocumentRevisionRecord`) đều là field tham chiếu **Office Online/Microsoft Graph**, chỉ
có giá trị khi Revision từng mở bằng Edit Online. Field lưu **source file thật trong storage nội bộ
(MinIO)** là nhóm cột riêng: `source_storage_provider`/`source_storage_bucket`/
`source_storage_object_key` (+ `file_path`/`file_name` cho preview/metadata). 1 Revision có thể có
source DOCX hợp lệ đã upload trực tiếp (không qua Office Online) mà `storageItemId` vẫn `null` —
dùng `storageItemId` làm điều kiện bắt buộc sẽ **chặn nhầm** các Revision hợp lệ này.

**Biện pháp xử lý đề xuất**:
1. Tạo 1 helper dùng chung, ví dụ `requireRevisionSourceFile(revision)`, kiểm tra
   `source_storage_object_key` (hoặc field tương đương) thực sự tồn tại và có thể đọc được — không
   dùng riêng `storageItemId`.
2. Gọi helper này trong `completeEditing()` trước khi cho phép set `editingStatus = "COMPLETED"`.

### 9. [Medium] ✅ Upgrade Session thiếu kiểm tra quyền ở cả `createSession()` lẫn `getSession()`

**`getSession()`** (dòng 119-124): không gọi `currentUserService.requireCurrentUser()`, không kiểm
tra quyền xem Document — chỉ cần đúng cặp `sessionId` + `documentId`.

**`createSession()`** — mở rộng theo góp ý mới, đã xác nhận qua code (dòng 63-64): có gọi
`currentUserService.requireCurrentUser()`, nhưng **không có bước kiểm tra quyền workflow "Upgrade
Revision"** nào sau đó — chỉ xác nhận Document tồn tại và có thể upgrade rồi lấy Document detail.
Nghĩa là bất kỳ user nào có quyền xem Document (thậm chí chỉ cần đăng nhập, tuỳ mức độ hiện tại của
"xác nhận Document có thể upgrade") đều có thể tạo ra 1 Upgrade Session thật trong DB, dù chưa chắc
có quyền thực hiện Upgrade Revision cho Document đó.

**Nhánh nguy hiểm hơn — đã xác nhận qua code, dòng 67-71**:
```java
String sessionKey = buildSessionKey(documentId);
RevisionUpgradeSession existing = sessionRepository.findBySessionKey(sessionKey).orElse(null);
if (existing != null && StringUtils.hasText(existing.getPayloadJson())) {
    return readSession(existing);   // return SỚM — trước dòng 73 (getDocumentDetail) và
}                                     // không hề qua bất kỳ check quyền nào
```
`revisionService.validateUpgradeableDocument(documentId)` (dòng 65) chạy trước đoạn này nhưng chỉ
xác nhận Document ở trạng thái hợp lệ để upgrade (business rule), **không phải permission check**.
Nghĩa là: nếu 1 Upgrade Session cho `documentId` đó đã tồn tại (do ai đó khác tạo trước), **bất kỳ
user nào đã đăng nhập, chỉ cần biết đúng `documentId`**, gọi `createSession()` sẽ nhận lại toàn bộ
payload session hiện có — kể cả khi user đó **không có quyền xem Document**, chứ không chỉ dừng ở
mức "có quyền xem nhưng chưa chắc có quyền Upgrade Revision" như mô tả trước đó. Đây là lỗ hổng lộ
dữ liệu (session payload chứa chi tiết Document/Revision/Related/Correlated) qua chính endpoint tạo
session, không cần qua `getSession()`.

**Biện pháp xử lý đề xuất**:
1. `createSession()`: chuyển thứ tự — xác thực current user (đã có), sau đó **load Document và kiểm
   tra quyền xem Document + quyền workflow Upgrade Revision** (permission tương ứng, ví dụ dạng
   `documents.revision.upgrade` — cần đối chiếu đúng tên permission thật trong hệ thống permission
   hiện có, không tự đặt tên mới) **trước** đoạn lookup+return-sớm session hiện có ở dòng 67-71.
   Không được để nhánh trả session cũ chạy trước bất kỳ permission check nào.
2. `getSession()`: gọi đúng `documentAuthorizationService.requireCanViewDocument(currentUser,
   document)` (method đã tồn tại sẵn, dòng 169 `DocumentAuthorizationService.java`) trước khi trả dữ
   liệu session — không viết chung chung "kiểm tra quyền xem tài liệu".
3. Chốt rule truy cập session rõ ràng trước khi code (cần xác nhận với người phụ trách nghiệp vụ):
   khuyến nghị chỉ **người tạo session** (`createdBy`) và **user có quyền Upgrade Revision trên
   Document đó** mới được đọc/tiếp tục session — không cấp quyền đọc cho viewer thông thường chỉ vì
   họ xem được Document.
4. `continueSession()`: cần test quyền trên **cả Document chính lẫn từng Related Document** được
   chọn để upgrade cùng — rà lại code hiện tại của `continueSession()` khi triển khai để xác nhận
   quyền Upgrade Revision được áp đúng phạm vi này, vì bản audit này chưa trace sâu permission check
   ở bước hoàn tất cho từng Related Document.

**Ghi chú bổ sung — ai thực sự có quyền Upgrade, và mức độ đang được UI sử dụng thật hay chưa** (đã
verify trực tiếp qua DB và grep toàn bộ FE, không suy đoán):
- Theo `workflow_action_policies`/`workflow_action_policy_actors` hiện tại trong DB:
  `action_code=UPGRADE_REVISION`, `from_status=EFFECTIVE`,
  `required_permission_code=documents.revision.upgrade`, actor cho phép = `AUTHOR, PERMISSION`.
  Nhưng truy vấn tiếp `roles/role_permissions/permissions` cho thấy **chưa có role nào được gán
  permission `documents.revision.upgrade`** — permission tồn tại trong hệ thống nhưng chưa cấp cho
  Access Profile nào. Vậy **trên thực tế hiện tại, người duy nhất được phép Upgrade Revision là
  Author của chính Revision đó** (nhánh actor `PERMISSION` hiện không có ai thoả).
- Nút **"Edit Revision for Upgrade"** ở `DetailDocumentView.tsx` (dòng ~1747-1754) là 1 tính năng
  **khác**, không liên quan tới việc mở khoá quyền Upgrade: nó chỉ cho DCO/user có
  `documents.revision.configure_next_*` **cấu hình trước** Reviewer/Approver/Related/Correlated
  Documents/Review Cycle cho revision kế tiếp trong khi Document còn Effective — hoàn toàn tách biệt
  khỏi policy `UPGRADE_REVISION` ở server.
- Grep toàn bộ `eqms/src` cho thấy **chưa tìm thấy file `.tsx` nào gọi**
  `createRevisionUpgradeSession`/`getRevisionUpgradeSession`/`continueRevisionUpgradeSession` (chỉ
  có định nghĩa hàm trong `documents.ts`). Luồng tạo Revision thật sự hiện dùng
  `documentApi.createRevisionWithUpload` (`RevisionCreateView.tsx`), khác hẳn API Upgrade Session.
  → Chưa xác nhận được UI thật nào đang gọi các endpoint `/upgrade-sessions/*` này; cần xác nhận lại
  với đội FE trước khi xếp độ ưu tiên khắc phục #9, vì mức độ rủi ro thực tế phụ thuộc việc endpoint
  có đang được expose cho người dùng thật hay không, hay hiện chỉ là hạ tầng backend chưa nối UI.

### 10. [Medium] ✅ `continueSession()` chấp nhận `reasonForChange` rỗng xuyên suốt

Dòng 182-184: nếu request không gửi `reasonForChange`, giữ nguyên giá trị cũ của session (có thể
null/rỗng từ đầu) — không có điểm nào bắt buộc phải khác rỗng trước khi hoàn tất session.

**Biện pháp xử lý đề xuất**: bắt buộc `reasonForChange` không rỗng tại thời điểm session chuyển
`status = "COMPLETED"`, fail rõ ràng nếu thiếu.

### 11. [Medium] ✅ `revisionType` là field chết
Xác nhận: nhận từ `DocumentController` nhưng không dùng ở bất kỳ đâu khác. Quyết định xoá hẳn hoặc
implement logic thật đọc field này — **cần hỏi lại nghiệp vụ trước khi chọn hướng**.

### 12. [Medium] ✅ `applyRevisionSnapshot()` reset training schedule vô điều kiện mỗi lần Update Revision

**Đã nâng từ "cần verify sâu" (bản v2) lên xác nhận đầy đủ theo review lần 2 của Codex** — đọc trực
tiếp `applyRevisionSnapshot()` dòng 3030-3034:
```java
revision.setTrainingPlannedDate(null);
revision.setTrainingPeriodEndDate(null);
revision.setPublishedAt(null);
revision.setPublishedBy(null);
revision.setTrainingCompletionDate(null);
```
3 dòng này chạy **vô điều kiện** mỗi lần `applyRevisionSnapshot()` được gọi — tức mỗi lần
`updateRevision()` chạy, bất kể request có đụng tới training hay không. Ngay sau đó,
`applyTrainingSchedule()` (dòng 3130) cố "giữ giá trị cũ làm mặc định"
(`LocalDate plannedDate = revision.getTrainingPlannedDate();`) — nhưng lúc này giá trị đã bị
`applyRevisionSnapshot()` xoá về `null` từ trước trong CÙNG transaction, nên cơ chế "giữ giá trị cũ"
này thực chất **giữ lại giá trị null vừa bị xoá**, không phải giá trị thật trước đó. Đây là lỗi
**độc lập với #1** (participant), không phải cùng gốc rễ như đánh giá sai ở bản v1.

**Biện pháp xử lý đề xuất**:
1. Bỏ việc reset vô điều kiện 3 dòng trên khỏi `applyRevisionSnapshot()` — để `applyTrainingSchedule()`
   (chạy sau, đã có logic partial-update đúng) là nơi **duy nhất** quyết định giá trị training dates.
2. Rà lại lý do `publishedAt`/`publishedBy` cũng bị reset ở đây — nếu đúng là chủ ý (Draft chưa nên
   có publish info) thì giữ, nhưng tách riêng khỏi nhóm training để rõ ràng ý đồ từng dòng.
3. Test tích hợp bắt buộc: update revision chỉ đổi `description`/participant, không gửi lại training
   dates → training schedule (Planned/Period End/Completion Date) phải **giữ nguyên** giá trị trước
   đó, không bị xoá về null.

### 13. ⚠️ Không có idempotency cho create Document/Revision
Hợp lý về lý thuyết, chưa verify trực tiếp. Rủi ro thấp hơn nhóm Critical/High.

### 14. [Medium] ✅ Logic Related Documents cũ/không nhất quán
Xác nhận qua mục 2 — xử lý gộp chung (dùng hằng số duy nhất).

### 15. [Low] ⚠️ DB chưa chuẩn hoá `relation_type`
Bổ sung `CHECK (relation_type IN ('RELATED','CORRELATED'))` trong migration xử lý mục 2.

### 16. [Low] ⚠️ Lỗi upload/storage có thể để lại file mồ côi
Hợp lý về nguyên tắc, chưa verify bằng kịch bản lỗi thật. Rủi ro thấp.

---

## THỨ TỰ TRIỂN KHAI ĐỀ XUẤT

1. **#1** — quyết định contract API (partial update vs full-roster) trước, rồi sửa
   `saveRevisionParticipantsFromRequest` theo roster hiệu lực đầy đủ. Ưu tiên cao nhất.
2. **#12** — bỏ reset vô điều kiện training dates trong `applyRevisionSnapshot()`. Độc lập với #1
   nhưng cùng nằm trong `updateRevision()` nên nên sửa/test chung 1 đợt để tránh phải deploy 2 lần
   vào cùng 1 method.
3. **#2 + #14 + #15** — chuẩn hoá relation type, 1 migration chuẩn hoá dữ liệu + CHECK constraint.
4. **#3** — chặn ở **cả 2 đường** (`updateRevision()` và `syncDraftRevisionWithDocument()`); **#4**
   — trích xuất rule eligibility dùng chung Master/Revision.
5. **#6** — quyền force publish (cần chốt nghiệp vụ) + bắt buộc lý do override + audit chi tiết
   (phần lý do/audit không cần chờ chốt nghiệp vụ, làm ngay được). Cùng đợt với #2.
6. **#8, #9, #10** — helper `requireRevisionSourceFile()` đúng field; quyền xem Document ở
   `getSession()` qua `requireCanViewDocument`; bắt buộc `reasonForChange` khi hoàn tất session.
7. **Flyway (#5)** — xử lý riêng theo change control, không gộp đợt deploy nghiệp vụ.
8. **#7** — rà soát và khắc phục dữ liệu Revision hiện hữu vi phạm workflow, **sau khi** code đã
   chặn được lỗi mới.
9. **#11, #13, #16** — ưu tiên thấp hơn; #11 cần quyết định nghiệp vụ trước khi code.

---

## Đã cập nhật theo review của Codex

### v1 → v2 (7 điểm)
1. Không khẳng định chắc chắn nguyên nhân dữ liệu bất thường khi chưa có audit trail.
2. Cách sửa #1 phải validate theo roster hiệu lực đầy đủ, không phải từng field riêng lẻ.
3. #12 tách lại thành mục độc lập, không gộp chung với #1.
4. #8, #9, #10 nâng từ ⚠️ lên ✅ sau khi tự verify trực tiếp.
5. Sửa lại hướng xử lý Flyway — không dùng 1 migration mới để "giải quyết" drift.
6. #4 — trích xuất rule eligibility dùng chung thay vì rải permission check riêng trong RevisionService.
7. DB trigger cho #7 chỉ là lớp phòng thủ bổ sung, không phải giải pháp chính.

### v2 → v3 (4 điểm, đã tự verify lại toàn bộ bằng code trước khi áp dụng)
1. **#1**: mô tả hậu quả trước đây quá rộng ("field null/omit → mất dữ liệu vĩnh viễn" cho mọi
   trường hợp) — đã sửa lại chính xác theo từng điều kiện cụ thể (REQUIRED+thiếu reviewer → rollback,
   an toàn; NONE+thiếu reviewer, hoặc thiếu approver/coAuthor → mất dữ liệu thật). Bổ sung câu hỏi
   thiết kế contract API (partial update thật sự vs full-roster PUT) cần chốt trước khi code.
2. **#3**: bổ sung đường bypass thứ 2 đã xác nhận qua code
   (`DocumentService.updateActiveWorkflowConfiguration()` → `RevisionService.syncDraftRevisionWithDocument()`
   → `copyWorkflowParticipantsFromDocument()`) — chỉ chặn `updateRevision()` là không đủ.
3. **#8**: sửa lại field kiểm tra — `storageItemId` là field Office Online/Graph, không phải field
   xác nhận có source file trong storage nội bộ. Đổi sang kiểm tra
   `source_storage_object_key`/tương đương qua 1 helper `requireRevisionSourceFile()`.
4. **#12**: nâng từ "chưa verify sâu" lên xác nhận đầy đủ — đọc trực tiếp
   `applyRevisionSnapshot()` dòng 3030-3034, xác nhận training dates bị reset vô điều kiện mỗi lần
   Update Revision, độc lập với lỗi participant ở #1. Đổi tên mục cho đúng bản chất lỗi.
5. **#1**: sửa lại lý do chọn hướng partial update — không dựa vào việc FE hiện tại "chỉ gửi field
   đã đổi" (thực tế `RevisionCreateView.tsx` build payload đầy đủ mọi field mỗi lần lưu), mà dựa vào
   việc DTO/API cho phép field nullable và các caller khác ngoài FE hiện tại có thể gửi thiếu field.
6. **#9**: mở rộng từ chỉ `getSession()` sang cả `createSession()`, sau đó xác nhận thêm nhánh nguy
   hiểm hơn qua code (dòng 67-71): `createSession()` có early-return trả lại session **đã tồn tại**
   trước cả khi gọi `getDocumentDetail()`, không qua bất kỳ permission check nào — nghĩa là bất kỳ
   user đăng nhập nào biết `documentId` đều đọc được payload session hiện có kể cả khi không có
   quyền xem Document, không chỉ dừng ở mức "có quyền xem nhưng chưa chắc có quyền Upgrade Revision".
   Sửa lại biện pháp xử lý: yêu cầu permission check phải chạy **trước** đoạn lookup-và-trả-sớm này;
   thêm rule "chỉ người tạo session hoặc user có quyền Upgrade Revision trên Document mới đọc được
   session"; mở rộng lưu ý `continueSession()` phải kiểm tra quyền trên cả Document chính lẫn từng
   Related Document được chọn upgrade, không chỉ Document chính.

Ngoài ra đã áp dụng các góp ý nhỏ: #9 cite đúng tên method `requireCanViewDocument`; #6 tách rõ phần
"cần chốt nghiệp vụ" (permission mới) khỏi phần "bắt buộc làm ngay không cần bàn cãi" (lý do +
audit).

---

## Đã cập nhật sau nghiệm thu vòng 1 (post-implementation review của Codex trên code đã triển khai)

Sau khi code #1–#4, #6, #8–#12, #14, #15 và deploy, Codex nghiệm thu trực tiếp trên code thật (không
phải trên plan) và phát hiện 5 điểm cần sửa tiếp. Cả 5 đã được sửa, verify lại bằng compile + test,
và deploy lại:

1. **[Critical, sót lại] Approver vẫn có thể bị xoá hết qua `approverUserIds: []`**: bản triển khai
   đầu tiên của #1 chỉ xử lý đúng trường hợp field bị *omit* (null → giữ nguyên), nhưng chưa có
   invariant chặn trường hợp field được gửi **rõ ràng** là mảng rỗng. `validateApproverRules()` chỉ
   ép đúng-1-Approver khi `isRequireOneApprover()` bật; nếu setting đó tắt, danh sách Approver rỗng
   vẫn "hợp lệ" theo rule cũ → bypass Approval vẫn tồn tại, chỉ đổi hình thức. Đã sửa: thêm invariant
   `if (approverUserIds.isEmpty()) throw AT_LEAST_ONE_APPROVER_REQUIRED` ngay trước
   `validateSoD()` trong `saveRevisionParticipantsFromRequest()`, độc lập với
   `isRequireOneApprover()` — tối thiểu 1 Approver là sàn GMP, không phải tuỳ chọn cấu hình.
2. **Test cũ chưa cập nhật theo fix `"RELATED"`**: `RevisionBusinessRulesTest` vẫn mock/stub
   `"Related"` (3 chỗ) trong khi code đã sửa đúng thành `"RELATED"` → Mockito strict stubbing làm
   test fail (1 failure, sau khi thêm mock `PermissionEvaluationService` cho check Force Publish mới
   thì còn thêm 1 lỗi NPE nữa). Đã sửa toàn bộ (bao gồm cả `"Correlated"`→`"CORRELATED"`), thêm
   `@Mock PermissionEvaluationService` + stub `hasPermission(..., "documents.revision.force_publish")`
   cho test force-publish hiện có. 21/21 test pass.
3. **Chưa có test regression cho các control mới**: đã bổ sung 7 test trong
   `RevisionBusinessRulesTest` (partial-update giữ Approver khi omit; `approverUserIds: []` bị chặn;
   `updateRevision()` sau Complete Editing bị chặn; `syncDraftRevisionWithDocument()` bỏ qua Revision
   đã Complete Editing; `requireRevisionSourceFile()` throw khi không resolve được file; Force
   Publish thiếu permission bị chặn; Force Publish thiếu reason bị chặn) và 1 file test mới
   `RevisionUpgradeSessionServiceTest` (3 test: `createSession`/`getSession` thiếu quyền Upgrade bị
   chặn trước khi chạm session repository; `continueSession` thiếu `reasonForChange` bị chặn trước
   khi gọi `upgradeDocumentRevision`). Việc thêm test #8 (source-file check) làm lộ ra 1 test khác bị
   ảnh hưởng ngoài dự kiến — `NotificationHandoverTest` (3 test `completeEditing_*`) trước đó không
   set up source file cho revision, nên `requireRevisionSourceFile()` mới (item #5 dưới đây) làm test
   fail thật; đã sửa bằng cách set `filePath` + mock `fileStorageService.materializeStoredFile()` trả
   về 1 file tạm thật tồn tại trên đĩa trong `setUp()`, không nới lỏng lại check ở code production.
4. **`requirePoolMembership` mới chỉ "mirror" chứ chưa gộp về 1 chỗ**: bản đầu tiên tạo 1 private
   method trùng lặp y hệt trong `RevisionService`, đúng hành vi nhưng vẫn là 2 nguồn có thể lệch sau
   này. Đã tạo `WorkflowParticipantEligibilityService` (bean riêng, method
   `requirePoolMembership(String poolType, UserAccount user)`), inject vào cả `RevisionService` và
   `DocumentService`; `DocumentService.requirePoolMembership` giờ chỉ còn là 1 wrapper mỏng delegate
   sang service dùng chung (giữ nguyên chữ ký để không phải sửa lại toàn bộ call site hiện có);
   `RevisionService` gọi thẳng `workflowParticipantEligibilityService.requirePoolMembership(...)`.
   Giờ chỉ có đúng 1 nơi định nghĩa rule.
5. **`requireRevisionSourceFile()` chỉ kiểm tra field có giá trị, chưa xác nhận file tồn tại**: bản
   đầu tiên chỉ check `StringUtils.hasText(sourceStorageObjectKey/filePath)` — nếu object đã bị xoá
   khỏi storage, path lỗi, hoặc storage không đọc được, Complete Editing vẫn đi qua được. Đã sửa:
   dùng lại `resolveRevisionSourceFile(revision)` (helper có sẵn, cùng cơ chế
   `refreshPreviewFromUploadedFile()` đang dùng) — helper này gọi thật
   `fileStorageService.materializeStoredFile(...)` để tải/xác nhận object tồn tại trên đĩa
   (`Files.exists`), không chỉ đọc field trong DB.

**Test suite sau khi sửa cả 5 điểm**: `RevisionBusinessRulesTest` 21/21 pass,
`RevisionUpgradeSessionServiceTest` 3/3 pass, `NotificationHandoverTest` pass trở lại. Backend
compile sạch, deploy lại thành công, verify DB (permission `documents.revision.force_publish`,
constraint `document_relations_relation_type_check`, dữ liệu `relation_type` đã chuẩn hoá) — không
lặp lại các claim "OK" chỉ dựa trên compile/deploy như feedback đã ghi nhận trước đó trong phiên.

---

## GHI CHÚ VỀ PHƯƠNG PHÁP VERIFY

Các mục đánh dấu ✅ đã được xác nhận bằng cách đọc trực tiếp source code Java liên quan và/hoặc truy
vấn dữ liệu thật trong PostgreSQL local. Các mục đánh dấu ⚠️ là đánh giá hợp lý dựa trên đọc
lướt/pattern đã biết của codebase, chưa được trace từng dòng code hoặc verify bằng dữ liệu/API thật.
