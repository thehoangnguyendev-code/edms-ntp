# Báo cáo rà soát liên luồng — Document Control

**Phạm vi:** Document Master, Document Revision, Controlled Copy (bao gồm Controlled Copy
Distribution Batch); backend Spring Boot, frontend React/TS, API REST, migration PostgreSQL,
MinIO/WORM, Microsoft Graph/Office Online và các pipeline PDFBox/Apache POI/OpenXML/Publishing.

**Thời điểm rà soát:** 19/08/2026  
**Phương pháp:** trace từ endpoint → service → authorization/policy → repository/entity/migration,
sau đó đối chiếu ngược với FE API và màn hình gọi action. Báo cáo này chỉ ghi “đã xác nhận” khi
đường chạy tồn tại trực tiếp trong source hiện tại.

## Tóm tắt ưu tiên

| Mức | Số lượng | Kết luận hành động |
|---|---:|---|
| **P0 – Critical** | 24 | Không triển khai/cho phép vận hành Document Control production trước khi khắc phục và test race. |
| **P1 – High** | 53 | Sửa trong đợt hardening kế tiếp, trước UAT GMP chính thức. |
| **P2 – Medium** | 12 | Dọn policy/API/schema chết và hợp nhất nguồn sự thật để tránh drift. |
| **Cần quyết định GMP** | 0 | GMP-D01 đến GMP-D09 đã được Product Owner chốt ngày 19/08/2026. |

**Phân loại bằng chứng:** DC-XF-01 đến DC-XF-12 và DC-XF-14 đến DC-XF-89 là lỗi/độ lệch đã
được xác nhận trực tiếp từ đường chạy source hiện tại. DC-XF-13 xác nhận có cửa sổ race theo transaction
và locking hiện tại; DC-XF-74 xác nhận lớp idempotency HTTP tổng quát không thay thế domain idempotency/
unique-active-job và vẫn có cửa sổ hai worker cùng chạy, nhưng kết quả interleaving cụ thể vẫn cần
concurrency integration test trên PostgreSQL/MinIO. DC-XF-85/DC-XF-86 xác nhận thiếu khóa/constraint;
interleaving và SQL update cụ thể cần concurrency integration test trên PostgreSQL.
GMP-D01 đến GMP-D09 đã được Product Owner chốt và trở thành baseline nghiệp vụ cho kế hoạch khắc phục.

## Kết quả kiểm tra kỹ thuật

- `eqms-backend`: `mvnw.cmd -q compile` **PASS**.
- `eqms`: `npm run build` **PASS**. Vite chỉ cảnh báo thư viện `pdfjs-dist` dùng `eval` và các bundle lớn; không phải lỗi luồng Document Control.
- Nhóm 11 unit test trực tiếp cho Controlled Copy authorization/preview grant/batch status/obsolete race,
  Document cancel-obsolete guard, Revision business rules/upload validator/workflow precondition và
  signature change: **PASS**. JDK/Mockito có warning về dynamic agent, không làm test fail.
- Ba test Spring/PostgreSQL có `@Transactional` cho discrepancy scanner, Controlled Copy list authorization và
  Upgrade Revision **PASS khi tạm override riêng test** `spring.flyway.validate-on-migrate=false`; transaction test
  được rollback. Kết quả này xác nhận ba đường cụ thể chạy được trên schema hiện tại, nhưng không phải bằng chứng
  release hợp lệ vì đã bypass chính blocker DC-XF-88 và scheduled worker vẫn phát SQL exception trong test context.
- Trên clone riêng của DB hiện tại, toàn bộ nhóm test có tên Document/Revision/ControlledCopy/Publishing/Signature
  chạy **205/205 PASS** (29 test suite, 0 failure/error/skip) khi tắt riêng Flyway validation để vượt DC-XF-88.
  ClamAV integration clean-file/EICAR chạy **2/2 PASS** trên cùng clone.
- Thử dựng một PostgreSQL database hoàn toàn trắng từ migration source **FAIL tại V80**, trước khi Spring context
  khởi tạo: migration chèn relation với hai document subquery trả `NULL`, vi phạm cột `NOT NULL`. Đây là release
  blocker độc lập DC-XF-89; source hiện không tái dựng được hệ thống mới từ đầu.
- Toàn bộ backend test suite chạy 581 test nhưng **FAIL** với 8 failure và 14 error. Các integration test
  `ControlledCopyBatchDiscrepancyScannerIntegrationTest`, `ControlledCopyListAuthorizationIntegrationTest`,
  `UpgradeRevisionIntegrationTest` và `ClamAvScanServiceIntegrationTest` không khởi tạo được Spring context do
  Flyway phát hiện checksum V359 bị đổi và migration V364 đã apply trong DB nhưng không còn trong source
  (DC-XF-88). Những failure còn lại ngoài phạm vi Document Control được giữ riêng, không dùng để suy diễn finding.
- Build pass **không loại trừ** các lỗi nghiệp vụ/race bên dưới vì chúng cần dữ liệu và thao tác đồng thời mới xuất hiện.
- Đối chiếu read-only với PostgreSQL đang chạy trong Docker ngày 19/08/2026 xác nhận cấu hình Office Online
  hiện hành là `shareLinkScope=organization`; có 2 Revision terminal còn `storage_item_id`, trong đó 1 Revision
  `CLOSED_CANCELLED` vẫn có `storage_sync_status=synced`. Không xuất ID/nội dung record nhạy cảm vào báo cáo.
- Cùng snapshot DB có 30 Controlled Copy; không có stored Controlled Copy/publishing preview/published PDF nào
  thiếu checksum khi đã có path. Vì vậy DC-XF-80 không phải lỗi “không tạo checksum”, mà là checksum đã lưu
  nhưng các đường read/serve không truyền nó vào hàm verify.
- Snapshot DB cũng có 3 Publishing Template Component đã lưu `object_key`; cả 3 đều có `checksum=NULL`,
  khớp trực tiếp với nhánh `setChecksum(null)` trong source (DC-XF-82).
- Read-only schema/data check cho `controlled_copy_expiry_limits` xác nhận bảng chỉ có primary key và hai
  foreign key, không có unique constraint theo active scope. Snapshot hiện chưa có duplicate active scope và
  đang có đúng một active Global Default; vì vậy DC-XF-86 là race/invariant gap đã xác nhận, chưa phải dữ liệu
  production hiện tại đã trùng.
- Read-only cross-lifecycle check trên DB hiện tại không thấy Document/Revision terminal còn Controlled Copy/
  Batch non-terminal, không thấy `document_id` lệch giữa Copy–Revision–Batch và không có job Controlled Copy/
  Publishing ở `QUEUED`/`PROCESSING` quá 15 phút. Đây chỉ là snapshot dữ liệu hiện tại, không phủ định các cửa
  sổ race đã trace trong source.
- Đối chiếu trực tiếp DB với MinIO bằng exact object version xác nhận 33/33 Revision source object, 12/12
  Controlled Copy artefact và 13/13 Published PDF version đang được metadata tham chiếu đều tồn tại. Một Revision
  source legacy có object/checksum nhưng không lưu `versionId`; không tìm thấy dangling object reference trong
  tập record hiện tại.
- Trong 16 Revision `EFFECTIVE`, có **10 Revision không có `revision_publishing_metadata`/`published_pdf_path`**.
  Dữ liệu runtime này xác nhận hậu quả DC-XF-56/DC-XF-57: status Effective hiện không bảo đảm official Published
  PDF đã được tạo. 13 Published PDF path đang tồn tại đều có checksum và exact MinIO version hợp lệ.
- Trong 134 Electronic Signature thuộc phạm vi Document/Revision/Controlled Copy, 127 có source checksum/version
  nhưng **0 có `review_pdf_version_id` và 0 có `published_pdf_version_id`**. Snapshot runtime này khớp DC-XF-58:
  chữ ký hiện không chứng minh đúng Review/Published PDF mà người dùng đã xem hoặc phát hành.
- Health endpoint local vẫn trả `UP`, nhưng log container ghi 397 SQL exception `requested_format does not exist`
  chỉ trong 10 phút kiểm tra. Health hiện chỉ chứng minh HTTP process còn sống, không phản ánh scheduled worker/
  schema readiness (DC-XF-88).
- MinIO isolated probe tạo bucket có object-lock, ghi đè cùng key hai lần và xác nhận có hai Version ID; stat exact
  version hoạt động, sau đó bucket tạm được xóa sạch. Hạ tầng MinIO local hỗ trợ versioning/WORM cơ bản; kết quả
  này không phủ định lỗi orchestration/transaction ở DC-XF-35/DC-XF-42/DC-XF-76.
- Hai transaction riêng trên DB clone cùng insert active Global Expiry Rule `(documentType=NULL,
  department=NULL)` đều commit thành công; số rule active cùng scope tăng từ 1 lên 3. Đây là reproduction động
  trực tiếp của invariant gap DC-XF-86, không chỉ là kết luận từ việc thiếu constraint.

### Phần chưa thể xác minh động an toàn trên môi trường hiện tại

- Frontend không có test script và không cài Vitest/Playwright/Cypress; vì vậy FE mới chỉ được xác nhận bằng
  TypeScript/Vite production build và trace call contract, chưa có browser E2E tự động cho các interleaving.
- Không thực hiện failure injection thật lên Microsoft Graph tenant, MinIO object nghiệp vụ hoặc action có chữ
  ký vì sẽ mutate quyền/file/hồ sơ đang dùng. Các case Graph 429/5xx, save đồng thời, revoke failure và DB rollback
  sau external side effect phải chạy trên tenant/bucket/DB cô lập hoặc mock server có kiểm soát.
- Đã reproduction bằng hai transaction thật đối với duplicate Global Expiry Rule (DC-XF-86) trên DB clone cô lập.
  Các interleaving còn lại cần worker/Graph/MinIO mock hoặc môi trường integration tái lập được; hiện cả DB nâng cấp
  và DB trắng đều bị chặn lần lượt bởi DC-XF-88/DC-XF-89 nên chưa thể coi concurrency suite là release evidence.

---

## Phát hiện đã xác nhận

### DC-XF-01 — P0: Batch Distribute có thể “hồi sinh” Controlled Copy đã Closed/Obsoleted

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1106-1179`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1590-1609`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchStatusService.java:108-123`

**Cơ chế đã trace**

1. Một copy trong batch có thể bị Cancel riêng tại `cancel(...)`, chuyển thành `CLOSED_CANCELLED`.
2. `ControlledCopyBatchStatusService.deriveExpectedStatus(...)` vẫn trả `READY_FOR_DISTRIBUTION`
   khi batch còn ít nhất một copy Ready (và không phải toàn bộ copy đều Cancelled/Obsoleted).
3. `distributeBatch(...)` chỉ kiểm tra policy/trạng thái của **batch**. Sau đó vòng lặp tại
   `ControlledCopyService.java:1129-1161` đặt **mọi** copy trong batch thành `DISTRIBUTED`, không
   loại trừ `CLOSED_CANCELLED` hay `OBSOLETED`, cũng không kiểm tra từng copy là Ready.

**Hậu quả thực tế**

Một Controlled Copy đã được hủy hoặc đã Obsolete (ví dụ Lost/Damaged) có thể trở lại `DISTRIBUTED`,
được cấp access token và gửi thông báo phân phối. Đây là vi phạm trạng thái terminal và có rủi ro GMP
cao: hồ sơ cho thấy copy đã bị thu hồi/hủy nhưng lại được phát hành tiếp.

**Khuyến nghị**

- `distributeBatch` chỉ được chuyển các copy đang `READY_FOR_DISTRIBUTION`; terminal copy phải giữ
  nguyên và được đánh dấu `SKIPPED_TERMINAL` trong job/batch result.
- Nếu batch có trạng thái hỗn hợp, chỉ xử lý các copy Ready và bắt buộc trả về danh sách terminal copy
  bị `SKIPPED_TERMINAL`; không được âm thầm chuyển terminal copy.
- Thêm integration test: `[Ready, Closed-Cancelled]` và `[Ready, Obsoleted]` → batch distribute;
  xác nhận terminal copy không đổi, không có token/notification/audit DISTRIBUTE mới.

---

### DC-XF-02 — P0: Ready Controlled Copy của Revision/Document đã Obsolete vẫn có thể được phân phối

**Trạng thái:** **Source mitigation đã triển khai trong working tree; runtime evidence còn thiếu.** `validateDistributeInvariants(...)` nay yêu cầu `Document=ACTIVE` và `Revision=EFFECTIVE` cho cả copy/batch; context batch đã được bổ sung parent status và test invariant xác nhận direct distribution bị từ chối khi parent terminal. Document Obsolete, Revision Obsolete và Publish supersede hiện đều chuyển Ready/Distributed child sang `OBSOLETED`, đồng thời giữ copy terminal sẵn có. Cần integration/race evidence trước khi đóng finding GMP.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:1692-1727`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:2055-2092`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:698-709`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1106-1179, 1346-1392`

**Cơ chế đã trace**

- Trước mitigation, khi Document Obsolete hoặc một Revision Effective bị supersede/obsolete, code chỉ auto-obsolete
  Controlled Copy đang `DISTRIBUTED`. Copy `READY_FOR_DISTRIBUTION` bị bỏ qua. Working tree hiện xử lý Ready ở cả Document Obsolete, Revision Obsolete và Publish supersede.
- Trước mitigation, rule `validateDistributeInvariants(...)` chỉ kiểm tra copy/batch có đang Ready, **không** kiểm tra
  Document còn `ACTIVE` và Revision nguồn còn `EFFECTIVE`.
- Cả `distribute(...)` và `distributeBatch(...)` đều dùng rule trên rồi phát hành copy. Working tree hiện chặn hai action này khi parent không hợp lệ.

**Hậu quả thực tế**

Người dùng có quyền distribute có thể phân phối một bản Controlled Copy thuộc Revision đã bị
supersede/obsoleted hoặc thuộc Document đã Obsolete. Đây là trường hợp phát hành tài liệu không còn
hiệu lực.

**Khuyến nghị**

- Tại một nguồn sự thật dùng chung (authorization precondition hoặc service invariant), yêu cầu khi
  distribute: `copy.revision.status == EFFECTIVE` **và** `copy.document.status == ACTIVE`.
- Khi Revision/Document bị obsolete, xử lý rõ Copy Ready: chuyển terminal `OBSOLETED` (khuyến nghị
  nhất quán) hoặc giữ để audit nhưng phải cấm distribute tuyệt đối. Quyết định này cần phản ánh đồng
  thời ở action capability, endpoint, async job và batch status.
- Thêm test cho distribute single, distribute batch và retry async sau khi parent vừa Obsolete.

---

### DC-XF-03 — P1: Print thay đổi `currentStage` thành Ready dù copy vẫn Distributed

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1327-1344`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:1096-1100`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:2788-2886`

**Cơ chế đã trace**

- Policy cho phép `PRINT_COPY` khi copy `READY_FOR_DISTRIBUTION` **hoặc** `DISTRIBUTED`.
- Sau khi in, `markAsPrinted(...)` luôn gọi `copy.setCurrentStage("Ready for Distribution")` nhưng
  không đổi `statusCode` của copy.
- API response hiển thị `copy.getCurrentStage()` tại dòng 2885; trong khi authorization chủ yếu đọc
  `statusCode`.

**Hậu quả thực tế**

Một copy Distributed có thể hiển thị “Ready for Distribution” sau lần in. Hai representation trạng
thái mâu thuẫn nhau, làm UI/table/audit từ-status sai và tạo tiền đề cho rule dùng nhầm stage ở code
mới.

**Khuyến nghị**

- In không phải lifecycle transition: không thay `statusCode` hoặc `currentStage`.
- Quy định rõ `statusCode` là nguồn sự thật; nếu vẫn cần stage UI thì derive từ status thay vì lưu bản
  sao có thể drift.
- Backfill dữ liệu có `status_code='DISTRIBUTED'` nhưng `current_stage='Ready for Distribution'`.

---

### DC-XF-04 — P1: Batch Cancel có thể ghi đè Obsoleted copy thành Closed-Cancelled

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1613-1648`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1664-1691`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchCancelAsyncService.java:50-159`

**Cơ chế đã trace**

`cancelBatch(...)` chọn tất cả copy **không** Distributed làm eligible. Điều này bao gồm copy đã
`OBSOLETED`. Async worker gọi `finalizeCancelledCopy(...)`, method này chỉ chặn Distributed rồi ghi
thẳng `CLOSED_CANCELLED` cho copy Obsoleted.

**Hậu quả thực tế**

Terminal reason (Document Obsoleted, superseded, Lost/Damaged, Recall...) bị thay bằng Cancel. Audit
có thể ghi hai terminal action mâu thuẫn; dữ liệu không còn phản ánh lý do cuối cùng thực sự.

**Khuyến nghị**

- Eligibility Cancel phải là **chỉ** `READY_FOR_DISTRIBUTION`.
- Đổi return boolean của async Cancel thành outcome rõ ràng (`SUCCESS`, `SKIPPED_TERMINAL`, `FAILED`),
  tương tự sửa Distribution; không retry terminal item.
- Thêm terminal guard ở đầu `finalizeCancelledCopy` trước bất kỳ mutation nào.

---

### DC-XF-05 — P1: Batch Recall cho phép ghi đè reason/audit của copy đã Obsolete

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1695-1735`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1752-1783`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchRecallAsyncService.java:50-162`

**Cơ chế đã trace**

`recallBatch(...)` đưa cả copy `DISTRIBUTED` **và** `OBSOLETED` vào job. `finalizeRecalledCopy(...)`
luôn ghi `obsoleteReason=RECALLED`, `recalledBy/recalledAt`, `obsoletedBy/obsoletedAt` cho item đã
Obsoleted.

**Hậu quả thực tế**

Một copy Obsoleted do Document Obsolete, superseded Revision hoặc Lost/Damaged có thể bị ghi đè lý do
thành Recall, dù trạng thái vẫn là Obsoleted. Điều này làm sai căn nguyên của trạng thái terminal và
gây audit trail khó giải thích.

**Khuyến nghị**

- Chỉ recall copy `DISTRIBUTED`; đã `OBSOLETED` là terminal/skip.
- Nếu nghiệp vụ thật sự cần “ghi nhận recall bổ sung” cho copy Obsoleted, phải tạo action event mới
  không sửa `obsoleteReason`, đồng thời được QA phê duyệt.

---

### DC-XF-06 — P1: Các thao tác batch vẫn có cửa sổ last-write-wins ở cấp Batch

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/entity/ControlledCopyDistributionBatch.java:19-...`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1106-1179, 1613-1648, 1695-1735`
- `eqms-backend/src/main/java/com/eqms/entity/ControlledCopyRecord.java:32-34`

**Cơ chế đã trace**

`DocumentRecord`, `DocumentRevisionRecord` và `ControlledCopyRecord` có `@Version`, nhưng
`ControlledCopyDistributionBatch` không có `@Version`. Distribute, Cancel Batch, Recall Batch và
`ControlledCopyBatchStatusService.synchronize(...)` đều đọc–ghi batch status độc lập. Hai request
song song có thể cùng đọc batch cũ rồi commit sau cùng ghi đè status/metadata (`distributionComment`,
`recallReason`, dates) của request trước.

**Hậu quả thực tế**

Batch summary có thể báo Distribute trong khi child record đã được Recall/Cancel, hoặc ngược lại.
Child copy được @Version bảo vệ phần nào, nhưng batch header/audit/ngữ cảnh job không được bảo vệ.

**Khuyến nghị**

- Thêm `lock_version` + `@Version` cho `controlled_copy_distribution_batches` bằng migration
  tương thích dữ liệu hiện hữu.
- Khi OptimisticLock xảy ra trong async, dùng outcome/reread mới thay vì swallow exception rồi retry
  mù quáng.
- Viết concurrent integration test: Distribute vs Recall, Cancel vs synchronize, Document Obsolete
  vs batch worker.

---

### DC-XF-07 — P1: Auto-obsolete từ Publish chưa liên kết audit của Revision/Controlled Copy với chữ ký Publish — **đã có source mitigation, cần integration evidence**

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1671-1780`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:2055-2092`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:4400-4414`

**Cơ chế đã trace**

Publish có e-signature cho Revision mới. Trước mitigation, khi Publish tự obsolete Revision Effective
cũ và Controlled Copy liên quan, history/audit của đối tượng cũ được ghi bằng overload không có
`signatureSessionId`; audit Controlled Copy cũng không nhận signature reference.

Working tree hiện truyền cùng `signatureSessionId` của Publish vào Revision superseded và helper
auto-obsolete Controlled Copy. Nhánh Document Obsolete cũng truyền causal signature của Document
vào audit Controlled Copy. Không tạo thêm e-signature độc lập cho từng child, đúng quyết định GMP-D02.

**Hậu quả thực tế**

Mitigation khôi phục được liên kết causal trong source. Vẫn cần chứng minh bằng integration/API test
rằng ID lưu tại bảng audit/history thực sự truy xuất được signature đã consume và transaction rollback
không để lại audit child mồ côi.

**Khuyến nghị**

- Giữ test đơn vị cho helper và bổ sung integration test Publish/Document Obsolete kiểm tra trực tiếp
  `signature_session_id` của Revision history/audit child.
- Với SOP hiện hành đã chốt theo GMP-D02, tham chiếu chữ ký action gốc là đủ; không thêm chữ ký riêng
  cho từng record bị tác động nếu không có change control phê duyệt khác.

---

### DC-XF-08 — P2: Policy Default/DB khai báo Recall Ready nhưng runtime invariant cấm; runtime lại mô tả Obsoleted là recallable nhưng không có policy

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java:170-173`
- `eqms-backend/src/main/resources/db/migration/V160__seed_controlled_copy_workflow_policies.sql:21-22`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:789-805, 1102-1104`

**Cơ chế đã trace**

- DB seed và registry có `RECALL_COPY` từ `READY_FOR_DISTRIBUTION` và `DISTRIBUTED`.
- `validateRecallInvariants(...)` chỉ cho phép `DISTRIBUTED` hoặc `OBSOLETED`, nên Ready bị deny
  trước khi policy được áp dụng.
- Invariant cho phép `OBSOLETED`, nhưng registry/seed không có policy `RECALL_COPY/OBSOLETED`, nên
  authorization engine lại deny ở bước policy.

**Hậu quả thực tế**

Policy Admin nhìn thấy rule nhưng endpoint/capability không thực thi theo rule. Reset policy có thể
khôi phục cấu hình vẫn không dùng được, gây false expectation và support ticket.

**Khuyến nghị**

Chọn một semantic duy nhất rồi đồng bộ enum/registry/DB/invariant/UI. Theo lifecycle thông thường,
Recall chỉ nên áp dụng `DISTRIBUTED`; Ready nên Cancel, Obsoleted là terminal. Nếu chọn khác, cần
viết rationale GMP rõ ràng.

---

### DC-XF-09 — P2: API `reopenDocument` tồn tại ở FE nhưng backend cố ý không có endpoint

**Trạng thái remediation (20/08/2026): Đã khắc phục ở hợp đồng FE.**

Wrapper FE không có caller đã được xóa, nên UI/client không còn endpoint giả dẫn tới 404. Default policy
`REOPEN` ở backend được giữ nguyên như một định nghĩa dự phòng; nó không phải endpoint hay quyền đã
được expose. Nếu sau này SOP yêu cầu Reopen, phải triển khai riêng đầy đủ state transition, e-signature,
reason, audit và policy thay vì chỉ khôi phục wrapper này.

**Vị trí chính**

- `eqms/src/services/api/documents.ts:621-624`
- `eqms-backend/src/main/java/com/eqms/service/DocumentResourceAdapter.java:33-35, 78-81`
- `eqms-backend/src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java:27-29`
- `eqms-backend/src/main/java/com/eqms/controller/DocumentController.java` (không có mapping `/reopen`)

**Cơ chế/hậu quả đã trace**

FE giữ method gọi `POST /documents/{id}/reopen`, nhưng backend không triển khai và adapter còn ghi rõ
REOPEN là chưa có implementation. Bất cứ chỗ nào gọi helper này sẽ nhận 404; policy/default cho REOPEN
trở thành cấu hình chết.

**Khuyến nghị**

Hoặc triển khai đầy đủ Reopen (state, audit, e-signature, audit rationale, policy), hoặc xóa FE API
và policy/default/permission REOPEN để không tạo chức năng “ảo”. Với GMP, không nên expose Reopen
nếu SOP chưa định nghĩa việc tái mở Document đã Cancel.

---

### DC-XF-10 — P2: Logic FE cũ về Cancel Revision đã lệch backend và đang là dead code

**Trạng thái remediation (20/08/2026): Đã khắc phục ở FE.**

`REVISION_CANCELABLE_STATUSES` và `canCancelRevisionStatus` không có caller đã được xóa. Các screen
workflow phải tiếp tục dựa vào server-side action capability/policy thay vì thêm danh sách status client
song song với backend.

**Vị trí chính**

- `eqms/src/features/documents/shared/documentLifecycleActions.ts:27-38`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1336-1388`

**Cơ chế/hậu quả đã trace**

FE helper `canCancelRevisionStatus(...)` coi Draft, Pending Review, Pending Approval, Pending Training
và Ready for Publishing đều cancelable. Backend hiện cho Cancel Revision **chỉ Draft**. `rg` không
tìm thấy nơi FE sử dụng helper này, nên hiện chưa mở sai UI, nhưng đây là rule chết/dễ được tái sử dụng
gây drift.

**Khuyến nghị**

Xóa helper/status list chết hoặc thay bằng capability server-side. Không duy trì thêm một danh sách
frontend cho state permission.

---

### DC-XF-11 — P2: Dashboard đếm “Effective Documents” bằng một status không được Document Master dùng

**Trạng thái remediation (20/08/2026): Đã khắc phục trong source.**

KPI vẫn mang nhãn người dùng “Effective Documents”, nhưng backend đếm `documents.status=ACTIVE` — trạng
thái Master đại diện cho tài liệu có Revision Effective. Breakdown admin và cấu hình frontend đã được
đồng bộ với các code Master thực `ACTIVE`, `DRAFT`, `OBSOLETED`, `CLOSED_CANCELLED`.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/DashboardService.java:47-56`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:682-685, 1702-1708`

**Cơ chế/hậu quả đã trace**

Dashboard gọi `documentRepo.countByStatus_Code("EFFECTIVE")`. Nhưng Document Master được đặt
`ACTIVE` khi tạo Revision đầu tiên và cũng được đặt `ACTIVE` khi một Revision Publish; `EFFECTIVE`
là trạng thái của **Revision**, không phải Document Master trong các luồng này. Vì vậy KPI
`totalEffective` sẽ luôn bằng 0 hoặc chỉ đếm dữ liệu cũ/malformed có status không còn được flow hiện
tại tạo ra.

**Khuyến nghị**

Đổi KPI thành `countByStatus_Code("ACTIVE")` nếu label muốn nói “Effective Documents”, hoặc đổi sang
query đếm Document có ít nhất một Revision `EFFECTIVE`. Tên KPI và định nghĩa nghiệp vụ phải được
thống nhất để tránh báo cáo GMP/management sai số.

---

### DC-XF-12 — P0: Cancel Batch có cửa sổ cho phép phát hành copy sau khi batch đã Closed-Cancelled

**Trạng thái kết luận:** **Chắc chắn đúng — đã trace đường chạy và thứ tự commit/async.**

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1613-1652`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1664-1691`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1346-1392`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:571-577`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchCancelAsyncService.java:50-76`

**Cơ chế đã trace**

1. `cancelBatch(...)` đổi và commit batch sang `CLOSED_CANCELLED`, nhưng không đổi child trong cùng
   transaction; nó phát event `AFTER_COMMIT` để worker xử lý từng child sau đó.
2. Trong khoảng thời gian worker chưa xử lý một child Ready, endpoint `distribute(id, ...)` vẫn cho
   phép phát hành child đó. Authorization của action single chỉ đánh giá copy và không kiểm tra batch
   cha đã `CLOSED_CANCELLED`.
3. Khi worker Cancel tới child vừa được phát hành, `finalizeCancelledCopy(...)` thấy
   `DISTRIBUTED` và chủ động trả `false`, không đóng lại child.

**Hậu quả thực tế**

Trạng thái bền vững có thể là **batch `CLOSED_CANCELLED` nhưng child `DISTRIBUTED`**, có access token,
notification và audit phát hành hợp lệ ở cấp child. Đây không chỉ là UI drift: một controlled copy
thuộc yêu cầu đã hủy thực sự được cấp phát sau thời điểm hủy.

**Khuyến nghị**

- Với Cancel, chuyển tất cả child Ready sang terminal trong **cùng transaction** với batch; phần
  async chỉ xử lý tác vụ chậm không quyết định lifecycle.
- Mọi action single phải kiểm tra invariant của batch cha; không cho Distribute khi batch không Ready.
- Nếu vẫn giữ async status mutation, thêm trạng thái trung gian có khóa (`CANCELLING`) và chặn toàn bộ
  action cạnh tranh, nhưng phương án này phức tạp hơn và cần policy/migration tương ứng.
- Test bắt buộc dùng latch: pause worker sau commit batch, gọi Distribute child, rồi resume worker.

---

### DC-XF-13 — P1: Request/Replacement có thể tạo Ready copy sau khi parent vừa bị Obsolete

**Trạng thái kết luận:** **Chắc chắn có race về mặt transaction — cần concurrency test để tái hiện
trên PostgreSQL; không phải suy đoán từ tên hàm.**

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:681-883`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1473-1538`
- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:1628-1727`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1671-1780, 2055-2092`
- `eqms-backend/src/main/java/com/eqms/repository/DocumentRevisionRepository.java:19`
- `eqms-backend/src/main/java/com/eqms/entity/DocumentRecord.java:34`
- `eqms-backend/src/main/java/com/eqms/entity/DocumentRevisionRecord.java:28`

**Cơ chế đã trace**

- Request kiểm tra Document/Revision đang Active/Effective, đọc PDF rồi **insert** batch/copy Ready.
- Replacement cũng kiểm tra/lấy PDF từ Revision rồi insert batch/copy Ready.
- Parent Obsolete/Publish đọc danh sách copy hiện có rồi update parent và những child nó vừa đọc.
- Các query parent/effective revision ở đây không dùng pessimistic lock. `@Version` trên Document và
  Revision không bảo vệ transaction Request/Replacement vì transaction đó không update parent; insert
  child không tạo version conflict với update parent.
- Vì vậy hai transaction có thể cùng vượt precondition: parent transaction query child trước khi child
  mới được insert, còn child transaction đã đọc parent trước khi parent commit. Cả hai đều có thể commit.

**Hậu quả thực tế**

Sau khi Document/Revision đã Obsolete vẫn có thể xuất hiện batch/copy mới ở
`READY_FOR_DISTRIBUTION`. Kết hợp DC-XF-02, copy đó còn có thể được phát hành.

**Khuyến nghị**

- Serialize action đóng parent và action tạo/reissue child bằng lock ở hàng Revision/Document dùng
  chung cho cả hai đường chạy (`PESSIMISTIC_WRITE` hoặc chiến lược atomic/version phù hợp).
- Dù có lock, vẫn phải giữ precondition parent tại lúc Distribute; đây là defense-in-depth chứ không
  thay thế DC-XF-02.
- Test đồng thời: Request vs Document Obsolete, Request vs Publish successor, Replacement vs cả hai.

---

### DC-XF-14 — P1: Một copy hết hạn làm cả batch Obsoleted dù các sibling vẫn Distributed

**Trạng thái kết luận:** **Chắc chắn đúng — đã trace scheduler và thuật toán derive độc lập.**

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyExpiryScheduler.java:143-188`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyExpiryScheduler.java:231-256`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchStatusService.java:108-124`

**Cơ chế đã trace**

Scheduler tìm từng copy Distributed đã hết hạn. Sau khi obsolete một copy, `updateRelatedBatch(...)`
đặt **toàn bộ batch** thành `OBSOLETED` ngay lập tức mà không đọc trạng thái các sibling. Trong khi
nguồn derive dùng ở nơi khác quy định batch phải còn `DISTRIBUTED` nếu có bất kỳ child Distributed.

**Hậu quả thực tế**

Với batch có copy khác ngày hết hạn, copy A hết hạn làm batch Obsoleted trong khi copy B vẫn đang
Distributed. Lần reconcile sau có thể đổi batch trở lại Distributed, tạo lịch sử trạng thái dao động;
audit scheduler lại khẳng định batch đã Obsolete dù điều đó không phản ánh toàn bộ child.

**Khuyến nghị**

- Scheduler chỉ obsolete child, sau đó gọi đúng một nguồn derive `ControlledCopyBatchStatusService`.
- Batch chỉ Obsoleted khi toàn bộ child không-Cancelled đã Obsoleted, đúng với rule hiện tại hoặc rule
  mới đã được QA phê duyệt.
- Audit phải dùng actual `fromStatus`, không hardcode `Distributed` như dòng 250.

---

### DC-XF-15 — P1: API đọc danh sách và action child âm thầm sửa batch status, không có audit

**Trạng thái kết luận:** **Chắc chắn đúng — mutation được gọi trực tiếp trong luồng list/action.**

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:886-925`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1456-1463, 1595-1609`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchStatusService.java:66-96`

**Cơ chế đã trace**

- `listDistributionBatches(...)` gọi `synchronizeBatches(...)` trên page đang đọc.
- `synchronize(...)` thay `statusCode/status` rồi `save(batch)` nhưng service này không ghi audit,
  không e-signature và không lưu nguyên nhân sửa.
- Các action single Destroy/Cancel cũng gọi cùng synchronize, nên có thể đổi trạng thái batch như một
  side effect ngoài audit action cấp child.

**Hậu quả thực tế**

Chỉ mở màn hình danh sách cũng có thể thay dữ liệu lifecycle đã lưu. Người review audit không thấy ai,
khi nào, vì sao batch chuyển trạng thái; đồng thời GET không còn read-only/idempotent về mặt dữ liệu.

**Khuyến nghị**

- Luồng list chỉ đọc/so sánh; không sửa. Dùng discrepancy scanner để phát hiện và một command repair
  có audit/actor/reason rõ ràng.
- Nếu batch status được định nghĩa là projection thuần, không lưu nó; derive khi query. Nếu vẫn là
  lifecycle field được lưu, mọi mutation phải có optimistic lock và audit.

---

### DC-XF-16 — P2: DB cho phép Document–Revision–Batch–Copy trỏ chéo không nhất quán

**Trạng thái kết luận:** **Chắc chắn đúng ở tầng schema; flow service hiện tại tạo đúng liên kết.**

**Vị trí chính**

- `eqms-backend/src/main/resources/db/migration/V47__create_controlled_copies.sql:1-45`
- `eqms-backend/src/main/resources/db/migration/V87__add_controlled_copy_distribution_batches.sql:1-43`

**Cơ chế đã trace**

Schema chỉ có các foreign key độc lập: `document_id`, `revision_id`, `distribution_batch_id`. Không có
constraint đảm bảo Revision thuộc Document đó, hoặc batch/copy cùng trỏ một Document/Revision. Vì vậy
SQL migration/import/integration khác có thể tạo copy thuộc Document A nhưng Revision B, hoặc child
thuộc batch có parent khác. JPA service chính hiện gán đúng object nên lỗi không xuất hiện trong happy
path, nhưng DB không bảo vệ invariant cốt lõi.

**Hậu quả thực tế**

Authorization theo Document có thể khác nội dung/PDF lấy theo Revision; Obsolete theo parent có thể bỏ
sót record; báo cáo và audit hiển thị Document/Revision không cùng nguồn.

**Khuyến nghị**

- Thêm unique/composite key phù hợp và composite FK để ép `(revision_id, document_id)` hợp lệ; tương tự
  cho quan hệ batch–copy.
- Trước migration, chạy query phát hiện dữ liệu chéo và lập remediation có audit; không tự động sửa
  parent dựa trên suy đoán nếu đã có dữ liệu production.

---

### DC-XF-17 — P1: Preview grant còn dùng được tối đa 15 phút sau Recall/Obsolete/Cancel

**Trạng thái kết luận:** **Chắc chắn đúng về kỹ thuật và trái quyết định GMP-D05: quyền phải bị
thu hồi ngay lập tức.**

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:543-620`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:3758-3777`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:487-510`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:1039-1051`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyPreviewGrantService.java:16-45`

**Cơ chế đã trace**

Handshake `openPreview(...)` kiểm tra trạng thái copy và đổi token/password thành grant HMAC có TTL
hardcode 15 phút. Nhưng các request tiếp theo để lấy file/page/print gọi
`ControlledCopyService.requirePreviewAccess(...)`; method này chỉ kiểm tra expiry nghiệp vụ và chữ ký/
TTL của grant, **không kiểm tra lại** copy đã `OBSOLETED` hoặc `CLOSED_CANCELLED`. Grant stateless cũng
không có version/revocation marker để action Recall/Obsolete vô hiệu hóa ngay.

**Hậu quả thực tế**

Người nhận đã mở preview trước thời điểm Recall/Document Obsolete/Revision supersede có thể tiếp tục
xem/tải/in bằng grant hiện hữu tới 15 phút sau action thu hồi, tùy policy download/print. Audit vẫn ghi
access sau thời điểm lifecycle đã đóng.

**Khuyến nghị**

- Mọi endpoint dùng preview grant phải kiểm tra lại terminal status và parent invariant ở mỗi request.
- Hoặc ký thêm `lockVersion/accessTokenIssuedAt` vào grant và tăng version/revoke marker khi lifecycle
  đóng; vẫn nên giữ status guard server-side.
- TTL cần cấu hình qua property, nhưng giảm TTL không thay thế khả năng revoke tức thời nếu SOP yêu cầu.

### DC-XF-18 — P0: API cho phép tạo Revision trên Document terminal và Publish “mở lại” Document không qua Reopen

**Trạng thái remediation (20/08/2026): Đã khắc phục ở service mutations và có regression test.**

`createRevisionFromDocument`/`createRevisionAndUploadFile` hiện chỉ cho phép Revision đầu tiên khi Document
`DRAFT`, và Revision tiếp theo khi Document `ACTIVE`. `uploadRevisionFile` cũng từ chối terminal parent.
`publishRevision` recheck Document `ACTIVE` trước khi consume signature; không còn đường Publish đổi
`OBSOLETED` hoặc `CLOSED_CANCELLED` sang `ACTIVE` ngầm.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/DocumentController.java:202-221`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:641-695, 3483-3562`
- `eqms-backend/src/main/java/com/eqms/service/DocumentAuthorizationService.java:256-285`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1251-1266, 1700-1708`
- `eqms-backend/src/main/java/com/eqms/service/DocumentMasterActionCapabilityService.java:109-125`

**Cơ chế đã trace**

- FE capability đúng hướng: `uploadRevision(...)` chỉ cho nút khi Document `ACTIVE` và có Revision
  `EFFECTIVE`.
- Trước remediation, hai mutation endpoint không kiểm tra `document.status`, và Publish cũng không
  recheck parent Document trước khi `publishRevisionRecord(...)` đặt trạng thái `ACTIVE`.

**Hậu quả thực tế**

Trước remediation, Author có permission có thể dùng API trực tiếp/stale request để tạo Draft Revision trên
Document terminal và sau đó Publish khiến Document thành `ACTIVE`. Các guard hiện được thực thi ở server;
UI không còn là security boundary duy nhất.

**Khuyến nghị**

Giữ regression test cho direct/stale API calls. Nếu sản phẩm cần Reopen, đó phải là action riêng với
workflow policy và e-signature; không dùng create/upload/publish như đường Reopen thay thế.

---

### DC-XF-19 — P1: Tạo Revision không có file vẫn chuyển Document Draft thành Active, trái mốc nghiệp vụ đã chốt

**Trạng thái remediation (20/08/2026): Đã khắc phục và có regression test.**

Tạo Revision metadata không còn đổi Document. Việc kích hoạt chỉ xảy ra sau khi `storeRevisionFile` thành công
trong `uploadRevisionFile`, hoặc sau khi upload/clone và `saveAndFlush` thành công trong
`createRevisionAndUploadFile`. Test xác nhận Revision đầu tiên không có file giữ Document `DRAFT`.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/DocumentController.java:202-208`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:641-685`
- `eqms-backend/src/main/java/com/eqms/service/RevisionWorkspaceBatchService.java:59-67, 303-357`
- `eqms/src/services/api/documents.ts:729-735`

**Cơ chế đã trace**

Trước remediation, `POST /documents/{id}/revisions` tạo Revision Draft không có source file nhưng vẫn đổi
Document `DRAFT → ACTIVE`. API này được `RevisionWorkspaceBatchService` dùng, nên Save workspace có file rỗng
cũng có thể kích hoạt Master quá sớm.

**Hậu quả thực tế**

Document không còn thành Active chỉ vì lưu metadata. Master chỉ Active khi artifact source đầu tiên được lưu.

**Khuyến nghị**

Giữ test Save workspace không file, upload lỗi/virus, upload thành công và retry upload khi bổ sung
integration test end-to-end storage.

---

### DC-XF-20 — P1: Cả ba nút Retry Failed Batch bị chính authorization state chặn lại

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/ControlledCopyController.java:342-354`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1256-1284`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:698-708, 788-805, 878-888`
- `eqms-backend/src/main/resources/db/migration/V160__seed_controlled_copy_workflow_policies.sql:18-35`
- `eqms/src/features/documents/controlled-copies/ControlledCopiesView.tsx:587-604, 670-687, 781-800`
- `eqms/src/features/documents/controlled-copies/detail/ControlledCopyDetailView.tsx:367-384, 447-464, 544-563`

**Cơ chế đã trace**

- Distribution retry gọi lại `requireDistributeControlledCopy(...)`, nhưng batch đã được đổi thành
  `DISTRIBUTED`; invariant Distribute chỉ chấp nhận `READY_FOR_DISTRIBUTION`.
- Cancel retry gọi `requireCancelControlledCopy(...)`, nhưng batch đã `CLOSED_CANCELLED`; invariant
  Cancel chỉ chấp nhận Ready.
- Recall retry gọi authorization trên batch đã `OBSOLETED`; runtime invariant có mô tả Obsoleted là
  recallable, nhưng registry/DB chỉ có policy `RECALL_BATCH` từ `DISTRIBUTED`, nên vẫn không resolve
  được policy hợp lệ.
- FE thật có handler và button gọi đủ cả ba nhánh, vì vậy đây không phải API dự phòng/dead code.

**Hậu quả thực tế**

Đúng lúc async job trả `COMPLETED_WITH_ERRORS`, người dùng bấm Retry sẽ nhận 4xx trước khi
`retryFailedItems(...)` chạy. Item lỗi không có đường phục hồi qua UI dù hệ thống quảng bá tính năng.

**Khuyến nghị**

Tạo authorization riêng cho `RETRY_FAILED_*`: kiểm tra permission của action gốc, job gần nhất phải
`COMPLETED_WITH_ERRORS`, item phải `FAILED`, parent không terminal theo action xung đột và parent
Document/Revision vẫn hợp lệ. Không tái sử dụng invariant lifecycle “lần đầu” cho retry kỹ thuật.

---

### DC-XF-21 — P1: Backend restart khi job đang PROCESSING để lại job/item treo vĩnh viễn

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchDistributionAsyncService.java:49-81, 209-223`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchRecallAsyncService.java:50-77, 169-188`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchCancelAsyncService.java:50-76, 169-188`
- `eqms-backend/src/main/java/com/eqms/repository/ControlledCopyDistributionJobRepository.java:13`

**Cơ chế đã trace**

Mỗi worker đổi job/item từ `PENDING` sang `PROCESSING` trước khi xử lý. Scheduled recovery sau restart
chỉ query `findTop10ByStatusOrderByCreatedAtAsc("PENDING")`; không có timeout/lease, query stale
`PROCESSING`, heartbeat hoặc reset item dang dở.

**Hậu quả thực tế**

Nếu process/container dừng giữa vòng lặp, job và item hiện tại giữ `PROCESSING` vô hạn; các item còn
lại có thể chưa được xử lý, progress modal/polling không bao giờ có terminal result. Trạng thái batch
đã được đổi đồng bộ trước worker nên có thể báo Distributed/Obsoleted/Cancelled dù artefact từng child
chưa hoàn tất.

**Khuyến nghị**

- Thêm lease (`processing_started_at`, heartbeat/owner) và scheduled reclaim stale job/item.
- Resume phải reread từng child và trả outcome idempotent; terminal child là Skip, không restore.
- Test kill/restart sau item 1/N cho cả Distribution, Recall và Cancel.

---

### DC-XF-22 — P1: Một Lost/Damaged copy có thể được tạo nhiều replacement song song hoặc lặp lại

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:826-849`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1473-1557, 2839-2842`
- `eqms-backend/src/main/java/com/eqms/repository/ControlledCopyRepository.java:39`
- `eqms-backend/src/main/resources/db/migration/V328__add_controlled_copy_replaced_link.sql:1-5`
- `eqms-backend/src/main/java/com/eqms/controller/ControlledCopyController.java:468-473`

**Cơ chế đã trace**

Replacement authorization chỉ kiểm tra policy, source `OBSOLETED` và reason `LOST`/`DAMAGED`; không
kiểm tra source đã có replacement hay chưa. DB chỉ tạo index thường trên
`replaced_controlled_copy_id`, không có unique constraint. Response mapping sau đó chỉ lấy
`findTopBy...OrderByRequestedAtDesc`, che khuất các replacement cũ hơn.

**Hậu quả thực tế**

Double click, retry HTTP hoặc hai DCO thao tác đồng thời có thể phát sinh nhiều Controlled Copy Ready
thay thế cùng một bản Lost/Damaged. UI chỉ hiện bản mới nhất trong quan hệ replacement, nhưng các bản
còn lại vẫn tồn tại và có thể được distribute.

**Khuyến nghị**

- Unique partial/normal constraint phù hợp nghiệp vụ để mỗi source chỉ có một replacement hợp lệ.
- Lock source hoặc dùng atomic insert; API phải idempotent và trả replacement đã tồn tại khi retry.
- Data check tìm source có `count(replacement) > 1` trước migration.

---

### DC-XF-23 — P1: Ready copy hết hạn không được scheduler đóng và request chấp nhận expiry đã qua

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:724-735, 851-858, 2669-2675`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1479-1500, 1529-1536`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyExpiryScheduler.java:143-188`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:865-875`
- `eqms-backend/src/main/java/com/eqms/dto/document/ControlledCopyRequestContextResponse.java:3-19`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:433-494`
- `eqms/src/features/documents/document-revisions/views/RequestControlledCopyView.tsx:157-174, 1211-1217`

**Cơ chế đã trace**

- Request chỉ chặn expiry vượt maximum; không chặn expiry `<= now`. Replacement sao chép nguyên
  expiry của source, kể cả ngày đã qua.
- Backend tính maximum từ `Instant.now()` ngay lúc **Request**. UI lại nói thời hạn được tính “from
  the date it is distributed”. Khoảng chờ Ready vì vậy đã ăn vào thời hạn trước khi phát hành.
- FE đọc field `expiryDurationDays`, nhưng DTO `ControlledCopyRequestContextResponse` không có field
  này và service không trả nó; FE luôn rơi vào nhánh hiển thị “This Controlled Copy will never
  expire”, trong khi backend thực tế luôn gán expiry từ Global Default/policy.
- Scheduler chỉ query copy `DISTRIBUTED` đã hết hạn. Copy `READY_FOR_DISTRIBUTION` không được chuyển
  `OBSOLETED`, dù authorization registry có action `EXPIRE_COPY` cho Ready nhưng không có endpoint
  thực thi tương ứng.
- Khi DCO cố Distribute, `ensureControlledCopyNotExpired(...)` chặn lại. Record vì vậy mắc kẹt Ready.

**Hậu quả thực tế**

Có thể tạo ngay một request/replacement không bao giờ phát hành được; hoặc một request hợp lệ chờ lâu
đến khi hết hạn rồi nằm Ready vô hạn. Đồng thời UI thông báo “không hết hạn” dù DB có expiry, nên DCO/
recipient không được cung cấp đúng điều kiện sử dụng. Batch summary, KPI và danh sách pending không
phản ánh terminal outcome thực sự.

**Khuyến nghị**

- Không chốt `expiresAt` tại Request/Ready. Khi từng copy chuyển sang `DISTRIBUTED`, resolve **Expiry
  Duration Policy** đang áp dụng, lưu policy/version/duration đã dùng để audit, rồi tính:
  `expiresAt = min(distributedAt + configuredDuration, endOfBusinessDay(revision.validUntil))` theo
  GMP-D06/D07. Nếu `Revision.validUntil` đã qua hoặc kết quả không còn ở tương lai thì từ chối
  Distribution và chuyển record sang outcome terminal phù hợp, không để mắc kẹt ở Ready.
- Replacement phải được tính thời hạn mới tại lần Distribution của replacement; không sao chép
  `expiresAt` tuyệt đối của source. Bổ sung policy/duration/giới hạn `Revision.validUntil` thật vào
  response để FE chỉ trình bày dữ liệu từ BE, không hardcode hoặc tự suy diễn.
- Scheduler xử lý cả Ready và Distributed theo outcome/audit rõ ràng, rồi synchronize batch theo toàn
  bộ child thay vì đóng batch chỉ vì một child.

---

### DC-XF-24 — P0: Preview password không bao giờ được tạo/lưu, mọi link Controlled Copy mới bị từ chối

**Trạng thái remediation (20/08/2026): Đã khắc phục và có regression test.**

Mỗi lần Distribution hiện phát sinh credential ngẫu nhiên 144-bit, lưu duy nhất BCrypt hash vào
`preview_password_hash`, và truyền plaintext chỉ trong map template của email Distribution đang gửi. Password
không có trong entity response/audit/log; một credential mới thay hash cũ. Test xác nhận hash không phải
plaintext, BCrypt xác thực được credential đúng, credential cũ không còn hợp lệ sau rotation, và email template
nhận đúng biến `previewPassword`.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/entity/ControlledCopyRecord.java:186-187, 372-373`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:481-505, 522-534`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:824-858, 1132-1166, 1346-1391`
- `eqms-backend/src/main/java/com/eqms/service/EmailNotificationService.java:275-308`
- `eqms-backend/src/main/resources/db/migration/V249__add_controlled_copy_preview_password.sql:5-12`
- `eqms-backend/src/main/resources/db/migration/V272__harden_controlled_copy_preview_credentials.sql:1-8`

**Cơ chế đã trace**

Trước remediation, backend bắt buộc `previewPasswordHash` nhưng không có lời gọi setter/runtime flow phát sinh
credential. Service có inject `BCryptPasswordEncoder` nhưng không dùng; email chỉ có URL/token, không có
`previewPassword`.

**Hậu quả thực tế**

Recipient nhận email phân phối với password hợp lệ và portal kiểm đối chiếu BCrypt hash. Plaintext không được
lưu lâu dài sau outbound payload.

**Khuyến nghị**

Giữ integration test từ create → distribute → captured email → open preview; bổ sung explicit rotate/resend
action có audit nếu sản phẩm yêu cầu gửi lại email mà không tái phân phối.

---

### DC-XF-25 — P1: Email workflow/phân phối được gửi trước commit và trước khi artefact finalization thành công

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1105-1183, 3959-4009`
- `eqms-backend/src/main/java/com/eqms/service/NotificationDispatcher.java:99-167`
- `eqms-backend/src/main/java/com/eqms/service/EmailNotificationService.java:78-135, 430-500`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchDistributionAsyncService.java:49-89`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:728-781, 836-864, 1007-1241`

**Cơ chế đã trace**

Trong transaction `distributeBatch`, từng email/link được gửi đồng bộ tại dòng 1166. Sau đó code mới
save batch, tạo job và commit; PDF composed của từng child còn được làm sau commit bởi async worker.
`NotificationDispatcher`/`EmailNotificationService` gọi email provider trực tiếp, không dùng
`AFTER_COMMIT`/outbox cho nhánh này. Nếu một copy sau đó lỗi, job creation lỗi hoặc transaction rollback,
email đã rời hệ thống và không thể rollback.

Cùng cơ chế này xuất hiện ở Revision: `completeEditing()` và các workflow transition gọi
`EmailNotificationService` ngay bên trong transaction. `sendToRecipients()` gọi SMTP trực tiếp; nếu
flush/commit sau đó thất bại vì optimistic lock, constraint hoặc storage/audit error, người nhận vẫn
nhận thông báo cho một trạng thái chưa từng commit.

**Hậu quả thực tế**

Recipient có thể nhận link cho action DB chưa commit, hoặc nhận/xem bản PDF chưa có đủ placeholder
Controlled Copy. Khi async finalization thất bại, child bị reset Ready nhưng email đã gửi; Ready vẫn là
status được token-preview gate chấp nhận (sau khi credential ở DC-XF-24 được sửa).

**Khuyến nghị**

- Ghi notification outbox trong cùng transaction cho cả Revision và Controlled Copy; chỉ dispatch
  sau commit và, với Distribution, sau khi item finalization thành công.
- Với batch, gửi per-recipient/DCO ZIP từ outcome `SUCCESS`, không gửi từ transition tạm thời.
- Khi `FAILED`, revoke/rotate token/password và ghi delivery-state/audit rõ ràng.

---

### DC-XF-26 — P1: Distribution async thất bại làm child Ready nhưng batch vẫn Distributed

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchDistributionAsyncService.java:49-81, 91-140, 186-195`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1286-1313`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1105-1183`

**Cơ chế đã trace**

Batch và mọi child được set `DISTRIBUTED` đồng bộ. Nếu finalization hết retry, worker gọi
`markDistributedCopyProcessingFailed(...)`, đổi riêng child về `READY_FOR_DISTRIBUTION`; batch không
được synchronize/revert và vẫn `DISTRIBUTED`. Job báo lỗi nhưng lifecycle header và child không còn
cùng trạng thái.

**Hậu quả thực tế**

Danh sách batch có thể báo Distributed trong khi một số child Ready và chưa có artefact hoàn chỉnh.
Retry hiện lại bị chặn bởi DC-XF-20, nên trạng thái lệch không có đường sửa chính thức qua UI.

**Khuyến nghị**

Không coi `DISTRIBUTED` là committed business state trước khi artefact hoàn tất. Dùng trạng thái kỹ
thuật `PROCESSING` hoặc giữ Ready đến khi từng item thành công; derive batch từ child outcomes và audit
transition business chỉ một lần khi thành công.

---

### DC-XF-27 — P1: Auto-close Document sau Cancel Revision không liên kết chữ ký nguyên nhân — **đã có source mitigation, cần integration evidence**

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1336-1383`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1605-1667`

**Cơ chế đã trace**

Cancel Revision validate/lưu chữ ký và history với `signatureSessionId`. Trước mitigation, khi đây là
Revision cuối, `syncDocumentStatusAfterRevisionCancellation(...)` tự đổi Document thành
`CLOSED_CANCELLED` nhưng method không nhận ID này; audit Document gọi overload không có signature
reference.

Working tree hiện truyền `signatureSessionId` đã consume của Revision Cancel vào helper và audit
Document auto-close. Không tạo một chữ ký thứ hai cho Document; đây là hậu quả causal của cùng action.

**Hậu quả thực tế**

Source đã khôi phục liên kết causal theo GMP-D02. Cần integration test xác nhận bảng audit/history lưu
đúng ID signature và rollback không để Document audit mồ côi khi Cancel fail sau đó.

**Khuyến nghị**

Giữ test đơn vị và bổ sung integration test truy vấn audit/signature sau Cancel Revision cuối; không
yêu cầu ký lần hai.

---

### DC-XF-28 — P2: Job coi `SKIPPED_TERMINAL` là succeeded và báo số liệu sai — **đã có source mitigation, cần integration evidence**

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyBatchDistributionAsyncService.java:60-81, 123-140`

**Cơ chế đã trace**

Worker có outcome `SKIPPED_TERMINAL` và lưu item status `SKIPPED`. Trước mitigation, cuối job đặt
`succeededItems = total - failed`; do `skipped` không tăng `failed`, toàn bộ item terminal bị tính vào
Succeeded.

Working tree hiện chỉ ghi `SUCCESS` vào `succeededItems`; trạng thái job trở thành
`COMPLETED_WITH_ERRORS` nếu có Failed hoặc Skipped. Endpoint job-status tính lại từ item durable,
trả riêng `succeeded`, `failed`, `skipped`; list/detail modal hiển thị Skip riêng và không đưa vào
Retry Failed. SSE progress vẫn không mang count Skip tạm thời, nhưng kết quả cuối được lấy lại qua API.

**Hậu quả thực tế**

Source không còn quy đổi terminal skip thành phân phối thành công. Cần integration/API test xác nhận
result sau retry/restart/cùng lúc với parent obsolete có `total = success + failed + skipped` và UI/API
không tạo ZIP/email cho copy Skip.

**Khuyến nghị**

Giữ test unit outcome và thêm integration test hàng đợi/restart; nếu về sau cần báo cáo lịch sử theo
aggregate mà không đọc item, thêm cột `skipped_items` qua migration đã được kiểm chứng Flyway.

---

### DC-XF-29 — P1: Holder không được thông báo khi copy bị vô hiệu hóa bởi parent; external holder cũng không nhận Recall

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:1703-1729`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:2055-2092`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1561-1584, 4196-4269`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:4350-4365`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyExpiryScheduler.java:79-140`

**Cơ chế đã trace**

- Document Obsolete và Publish successor tự chuyển Controlled Copy thành Obsoleted nhưng chỉ save +
  audit; không gọi bất kỳ notification dispatcher/email nào cho holder.
- Recall trực tiếp có gọi `notifyControlledCopyStakeholders(...)`, nhưng recipient list chỉ gom các
  `UserAccount` actor (requested/distributed/recalled/...), còn external recipient được lưu dạng email
  ở `recipientName`/`externalRecipients` không được thêm vào. Policy event `controlled_copy.recalled`
  cũng chỉ dispatch khi `recipientUser != null`.
- Expiry reminder scheduler cũng chỉ gom `recipientUser` + DCO; external holder không có account bị
  bỏ khỏi reminder dù email đã được snapshot trên copy.

**Hậu quả thực tế**

Người đang giữ Controlled Copy có thể không biết tài liệu vừa bị thay thế/Obsolete và tiếp tục sử dụng
bản không còn hiệu lực. External recipient chắc chắn không nhận Recall qua đường hiện tại; parent
auto-obsolete không thông báo cả internal lẫn external holder.

**Khuyến nghị**

- Tạo một luồng notification “copy invalidated” dùng chung cho Recall, Document Obsolete, Revision
  supersede và expiry; resolve cả `recipientUser` lẫn external email đã snapshot.
- Gửi qua outbox sau commit, theo dõi delivery failure/retry và ghi causal reason/signature reference.
- Test holder nội bộ, external email, DCO redirect và notification failure cho từng parent action.

---

### DC-XF-30 — P2: DB còn nhiều Controlled Copy policy “có vẻ hoạt động” nhưng code/API hoàn toàn bỏ qua

**Vị trí chính**

- `eqms-backend/src/main/resources/db/migration/V148__create_controlled_copy_policy_settings.sql:1-38`
- `eqms-backend/src/main/java/com/eqms/entity/ControlledCopyPolicySetting.java:15-137`
- `eqms-backend/src/main/java/com/eqms/dto/controlledcopypolicy/ControlledCopyPolicyRecallSection.java:3-7`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyPolicyService.java:86-102, 110-135`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:2055-2092`

**Cơ chế đã trace**

Schema vẫn chứa các cột như `require_approval`, `default_expiry_policy`, `requester_may_override`,
`expiry_required`, `auto_recall_when_new_revision_effective` và
`auto_recall_when_revision_obsoleted`. Entity, request/response DTO, policy summary và applyRequest
không map/đọc các cột này. Publish successor hiện auto-obsolete copy theo code cứng, không đọc hai cờ
auto-recall trong DB; expiry dùng bảng limit/service khác.

**Hậu quả thực tế**

DB/config audit có thể cho thấy một policy đã tắt nhưng runtime vẫn thực hiện action, hoặc ngược lại.
Người vận hành đọc schema/migration dễ tin đây là cấu hình đang có hiệu lực; change control trên các
cột này không thay đổi hành vi hệ thống.

**Khuyến nghị**

Chốt từng field là active hay retired. Field active phải được map, expose, validate, audit và dùng tại
đúng một policy service; field retired phải migration drop/rename rõ ràng, không để “công tắc giả” trong
DB. Riêng auto-recall/auto-obsolete phải thống nhất với GMP-D01/D03 trước khi cho phép cấu hình.

---

### DC-XF-31 — P0: Lỗi render placeholder bị nuốt nhưng Controlled Copy vẫn được ghi nhận Distributed thành công

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1196-1223, 1345-1392`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:2714-2785`
- `eqms/src/features/documents/controlled-copies/detail/ControlledCopyDetailView.tsx:689-733, 1235-1255`

**Cơ chế đã trace**

FE yêu cầu DCO nhập các giá trị bổ sung rồi gửi `customPlaceholderValues` khi Distribute. Cả nhánh
single và batch đều gọi `applyComposedControlledCopyPlaceholders(...)`. Tuy nhiên helper này bắt mọi
exception, chỉ ghi WARN và giữ nguyên PDF đã lưu từ lúc Request — tức bản chưa có các placeholder chỉ
biết ở thời điểm phân phối. Caller không nhận failure: single vẫn save `DISTRIBUTED`, còn worker batch
luôn trả `SUCCESS` và ghi audit “processing completed”. Ngay cả composition trả bytes rỗng cũng bị coi
như thành công.

**Hậu quả thực tế**

Một Controlled Copy chính thức có thể thiếu `copyNo`, `distributionList` hoặc trường do Admin cấu hình,
nhưng DB/job/email/audit đều tuyên bố đã phân phối thành công. Đây là sai lệch giữa regulated artefact
và lifecycle record; retry hiện không biết cần chạy lại vì item không mang trạng thái Failed.

**Khuyến nghị**

- Composition có template phải là bước bắt buộc: bytes rỗng, placeholder bắt buộc chưa resolve hoặc
  exception phải trả outcome `FAILED`, không phát email và không commit `DISTRIBUTED`.
- Lưu checksum/version artefact cuối cùng cùng item outcome; worker chỉ trả `SUCCESS` sau khi đọc lại
  được object vừa ghi và xác minh checksum.
- Chỉ cho phép fallback sang PDF gốc khi Revision thực sự không cấu hình template/placeholder Controlled
  Copy, và phải ghi rõ nhánh đó trong audit.

---

### DC-XF-32 — P0: Quyền Office Online có thể còn hiệu lực sau khi workflow đã chuyển bước/terminal, trong khi audit ghi đã revoke

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1007-1172, 1244-1388, 1671-1754`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3854-3898, 4098-4198`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:4326-4359`
- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:1627-1701`
- `eqms-backend/src/main/java/com/eqms/service/MicrosoftGraphOfficeOnlineService.java:641-683, 727-738`

**Cơ chế đã trace**

- Reviewer/Approver được cấp direct item permission khi mở Word Online. `completeReview()`,
  `completeApproval()`, Publish, Cancel Revision (`cancelRevision()` đổi trạng thái tại dòng 1360-1383 nhưng
  không gọi `lockOfficeOnlineEditing()`) và Document Obsolete không gọi revoke tại transition;
  link ngoài EQMS có thể tiếp tục dùng sau khi actor hết nhiệm vụ hoặc Revision đã terminal.
- `lockOfficeOnlineEditing()` có cố liệt kê/xóa permission, nhưng mọi lỗi list/revoke đều bị bắt và chỉ
  log WARN. Sau đó code vẫn set `storageSyncStatus="access-revoked"` và ghi audit
  `SHAREPOINT_LINK_REVOKED`/`EDITING_LOCKED` như thể việc xóa từ Microsoft Graph đã thành công.
- Snapshot PostgreSQL đang chạy xác nhận đây không chỉ là nhánh lý thuyết: có một Revision
  `CLOSED_CANCELLED` còn `storage_item_id` với `storage_sync_status=synced`; ngoài ra còn các Revision
  `EFFECTIVE` có status `synced/locked`, cần reconciliation permission thực tế trên Graph.

**Hậu quả thực tế**

Người đã review/approve có thể tiếp tục comment hoặc sửa file ngoài kiểm soát của trạng thái EQMS.
Nghiêm trọng hơn, audit có thể chứng nhận access đã bị thu hồi trong khi permission thực tế vẫn còn,
làm mất tính tin cậy của bằng chứng kiểm soát truy cập.

**Khuyến nghị**

- Tạo access ledger theo revision/user/permission ID; revoke tại mọi transition rời Draft/Review/
  Approval và mọi terminal action.
- Revoke failure phải là trạng thái có thể quan sát/retry/escalate; không ghi “revoked” khi Graph chưa
  xác nhận thành công. Với transition terminal, dùng outbox/reconciliation job và khóa mọi API nội bộ
  ngay lập tức trong lúc chờ remote cleanup.
- Integration test bằng Graph stub: grant Reviewer A → A complete → A permission biến mất; simulate
  revoke 5xx → audit không được tuyên bố thành công và retry phải còn pending.

---

### DC-XF-33 — P1: Timestamp hành động GMP do client quyết định, cho phép backdate/future-date hoặc dữ liệu sai bị thay bằng “now”

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/dto/document/DocumentObsoleteRequest.java:5-10`
- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:1660, 3195-3217`
- `eqms-backend/src/main/java/com/eqms/dto/document/ControlledCopyDistributeRequest.java:5-12`
- `eqms-backend/src/main/java/com/eqms/dto/document/ControlledCopyPrintRequest.java:3-7`
- `eqms-backend/src/main/java/com/eqms/dto/document/ControlledCopyRecallRequest.java:3-9`
- `eqms-backend/src/main/java/com/eqms/dto/document/ControlledCopyDestroyRequest.java:3-12`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1115, 1337, 1355, 1448, 1572, 2639-2667`

**Cơ chế đã trace**

Document Obsolete và các action Print/Distribute/Recall/Destroy nhận timestamp tự do từ request body
và lưu trực tiếp làm thời điểm nghiệp vụ. Không có giới hạn future, giới hạn backdate, reason hoặc
quyền riêng cho late entry. Riêng `parseInstant(...)` của Controlled Copy còn trả fallback `now` khi
chuỗi không parse được, nên input sai không bị từ chối. Audit time được tạo ở thời điểm server khác với
business timestamp nhưng không lưu lý do/chứng cứ giải thích chênh lệch.

**Hậu quả thực tế**

Người gọi API có thể làm record “được phân phối” trong tương lai hoặc Obsolete lùi sâu về quá khứ;
khi GMP-D06 được triển khai, `distributedAt` giả còn trực tiếp làm sai expiry. Dữ liệu lọc, reminder,
KPI và chuỗi thời gian audit không còn đáng tin.

**Khuyến nghị**

Server luôn sở hữu `recordedAt`. Nếu SOP cho phép ghi nhận sự kiện giấy xảy ra trước đó, tách
`occurredAt`, giới hạn không ở tương lai/không trước mốc lifecycle trước, bắt buộc late-entry reason và
audit cả hai giá trị. Input timestamp không hợp lệ phải trả 400, không silent fallback.

---

### DC-XF-34 — P1: Policy có Upload Evidence/Destroy/Confirm Destroy cho Obsoleted nhưng API runtime không có đường thực thi

**Vị trí chính**

- `eqms-backend/src/main/resources/db/migration/V160__seed_controlled_copy_workflow_policies.sql:23-29, 73-86`
- `eqms-backend/src/main/resources/db/migration/V228__repair_controlled_copy_authorization_contract.sql:11-17, 65-76, 176-194`
- `eqms-backend/src/main/java/com/eqms/enums/ControlledCopyWorkflowAction.java:1-30`
- `eqms-backend/src/main/java/com/eqms/controller/ControlledCopyController.java:407-458`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:599-609, 852-875, 1138-1152`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1395-1463`

**Cơ chế đã trace**

DB/catalog định nghĩa `UPLOAD_EVIDENCE`, `DESTROY_COPY` và `CONFIRM_DESTROY` cho copy `OBSOLETED`.
Runtime enum không có hai action Destroy/Confirm; controller chỉ cho list/download evidence. Endpoint
multipart `/destroy` thực chất là “Report Lost/Damaged”, bắt buộc copy đang `DISTRIBUTED`, rồi lập tức
đưa nó sang `OBSOLETED`. Không có endpoint để bổ sung evidence hoặc ghi nhận tiêu hủy vật lý sau Recall,
Expiry, parent Obsolete hay sau khi copy Lost/Damaged đã terminal.

**Hậu quả thực tế**

Quyết định GMP-D03 yêu cầu terminal state/reason bất biến nhưng cho phép ghi event/evidence bổ sung.
Source hiện không thể thực hiện nửa sau: người vận hành hoặc phải bỏ evidence ngoài hệ thống, hoặc tìm
cách gọi lại action không hợp lệ. Policy UI/DB tạo cảm giác chức năng tồn tại nhưng không có API thật.

**Khuyến nghị**

Giữ `OBSOLETED` bất biến và triển khai append-only endpoint/event riêng cho evidence, physical
destruction và witness confirmation. Không tái sử dụng transition Lost/Damaged. Theo GMP-D08, mỗi
event phải lưu DCO ký/nhập ở `recordedBy`, Executor/Witness bằng UUID riêng, occurred/recorded time,
reason, checksum artefact và signature session của DCO; UI/audit không được mô tả Executor/Witness là
người đã ký.

---

### DC-XF-35 — P1: File Controlled Copy nằm ngoài transaction DB và local/NAS ghi đè cùng đường dẫn, trái cam kết WORM

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:799-873, 1472-1544`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:2697-2711, 2751-2785`
- `eqms-backend/src/main/java/com/eqms/service/FileStorageService.java:326-370`

**Cơ chế đã trace**

Trong transaction Request/Replacement, PDF được ghi ra object storage trước khi record và toàn bộ batch
commit. DB rollback không xóa object đã ghi. Khi Distribute recompose, cùng helper lại ghi PDF: MinIO
dùng cùng object key và dựa vào versioning bên ngoài, còn local/NAS dùng
`Files.copy(..., REPLACE_EXISTING)` trên `controlled-copy.pdf`. Comment service nói “new WORM object,
never overwrites”, nhưng hai provider này thực tế thay nội dung tại chỗ; record cũng chỉ giữ metadata
của version cuối.

**Hậu quả thực tế**

Có thể sinh object mồ côi khi transaction fail, hoặc mất artefact pre-distribution khi chạy local/NAS.
Không thể chứng minh file nào đã tồn tại tại từng lifecycle event và checksum DB có thể trỏ tới nội
dung đã bị thay thế ngoài transaction.

**Khuyến nghị**

Dùng object key bất biến theo artefact/version UUID cho mọi provider; lưu artefact row append-only và
promote reference bằng transaction/outbox. Có janitor cho staged orphan dựa trên manifest, tuyệt đối
không overwrite regulated file path.

---

### DC-XF-36 — P1: So khớp recipient bằng full name có thể cấp quyền xem record của người trùng tên

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:2158-2191`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:2459-2507`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:3758-3793`

**Cơ chế đã trace**

`canViewControlledCopy()` kiểm tra `recipientUser.id` đúng trước, nhưng nếu không khớp nó không deny mà
tiếp tục chấp nhận `recipientName == currentUser.fullName/username/email`. SQL list specification cũng
OR `recipientUser.id` với các chuỗi này. Vì `recipientName` thường là display name, hai tài khoản trùng
họ tên có thể cùng match một copy, kể cả record đã có `recipientUser` rõ ràng. Preview session binding
lặp lại fallback tên khi `recipientUser` null.

**Hậu quả thực tế**

User không phải recipient có thể nhìn thấy metadata Controlled Copy của người khác trong list/detail;
với legacy record không có recipient UUID, việc ràng buộc preview cũng phụ thuộc định danh không duy
nhất. Đây là lỗi scope/confidentiality, không chỉ lỗi hiển thị.

**Khuyến nghị**

Nếu `recipientUser` tồn tại, UUID là nguồn duy nhất và mismatch phải deny ngay. Chỉ dùng email đã
normalize/verify cho legacy/external; không bao giờ dùng full name làm security identifier. Backfill
recipient UUID và test hai user cùng full name.

---

### DC-XF-37 — P0: Controlled Copy render bằng Publishing Template “live”, không phải version đã khóa khi Revision được phát hành

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/entity/RevisionPublishingMetadata.java:25-36`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:252-266, 313-352`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:2751-2778`
- `eqms-backend/src/main/java/com/eqms/service/PublishingPdfComposerService.java:70-107, 185-212`
- `eqms-backend/src/main/java/com/eqms/service/PublishingTemplateService.java:155-177, 252-267, 288-329, 425-467`

**Cơ chế đã trace**

Revision metadata lưu quan hệ tới `PublishingTemplate` live và chỉ snapshot một số nguyên
`publishingTemplateVersion`; không liên kết tới `PublishingTemplateVersion` row. Khi Controlled Copy
được Distribute, code truyền `metadata.getPublishingTemplate()` vào composer. Composer đọc path,
component và placeholder style hiện tại theo template ID. Trong khi đó Admin có thể Save Changes trên
template đang Active hoặc upload component mới mà không tạo/publish version mới. Bảng
`publishing_template_versions` có snapshot nhưng đường render Controlled Copy không đọc nó.

**Hậu quả thực tế**

Cùng một Revision Effective có thể phát hành Controlled Copy tháng trước và tháng sau với cover/header/
footer/style khác nhau sau một lần chỉnh template. Metadata vẫn báo version cũ, nên artefact thực tế
không khớp approved version và audit lineage sai.

**Khuyến nghị**

Revision phải FK tới immutable `publishing_template_version_id` (và component/style version tương ứng).
Mọi render sau Publish, kể cả Controlled Copy, chỉ đọc snapshot đó. Không cho mutation in-place của
asset/version Active; thay đổi luôn tạo draft version mới rồi publish qua change control.

---

### DC-XF-38 — P2: Async Review Snapshot pipeline là code/schema chết, không có producer khởi tạo request

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionSnapshotEvent.java:1-18`
- `eqms-backend/src/main/java/com/eqms/service/RevisionSnapshotAsyncService.java:37-121`
- `eqms-backend/src/main/java/com/eqms/entity/DocumentRevisionRecord.java:188-195, 712-733`
- `eqms-backend/src/main/resources/db/migration/V149__add_revision_editing_lifecycle_and_snapshot_status.sql:6-17`
- `eqms-backend/src/main/resources/db/migration/V300__bind_review_snapshot_to_completed_source.sql:1-18`

**Cơ chế đã trace**

Toàn bộ codebase chỉ có consumer `@TransactionalEventListener` của `RevisionSnapshotEvent`; không có
nơi tạo event, set `snapshotRequestId` hoặc set `snapshotStatus=GENERATING`. Luồng Submit hiện tạo
preview đồng bộ bằng đường khác. Vì vậy các guard stale-request/checksum và history async không thể chạy
trong source hiện tại.

**Hậu quả thực tế**

Maintainer có thể tin review snapshot đang được tạo after-commit/retry-safe trong khi runtime không hề
dùng pipeline này. Schema/status có thể tồn tại ở trạng thái legacy khó giải thích và hai cơ chế snapshot
tiếp tục drift.

**Khuyến nghị**

Chọn một pipeline duy nhất. Nếu async là thiết kế chuẩn, producer phải atomically set request ID/status/
checksum rồi publish AFTER_COMMIT, có recovery cho stuck `GENERATING`; nếu sync là chuẩn, xóa consumer,
field/migration semantics chết sau khi backfill và cập nhật tài liệu.

---

### DC-XF-39 — ĐÃ KHẮC PHỤC (cần bổ sung integration test): Các endpoint phục vụ file bỏ qua permission chuyên biệt và có thể lộ source Draft

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:3400-3423, 3499-3578`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3577-3621`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:372-385`
- `eqms-backend/src/main/java/com/eqms/service/SecureFileAccessService.java:156-208`

**Cơ chế đã trace**

Phát hiện ban đầu là chính xác tại thời điểm audit. Nguồn hiện tại đã chặn `previewDocumentFile` và
`downloadDocumentFile` qua `SecureFileAccessService` với `PUBLISHED_PDF`; evaluator chỉ cho
`EFFECTIVE`/`OBSOLETED`. Vì vậy fallback của `resolveActiveRevision` sang Draft không còn có thể trả
file Draft. Controlled Copy preview/download cũng đi qua evaluator chuyên biệt và policy tương ứng.

**Hậu quả thực tế**

Đường bypass đã nêu không còn hiện hữu trong source hiện tại. Rủi ro còn lại là thiếu bằng chứng
integration/API cho từng permission và trạng thái, không phải lỗi đã xác nhận đang exploitable.

**Khuyến nghị**

Giữ nguyên kiến trúc hiện tại; bổ sung integration test deny riêng cho Preview/Download Published PDF,
Revision source, Controlled Copy và mỗi trạng thái terminal để tránh regression.

---

### DC-XF-40 — P1: Permission xem/tải Controlled Copy Evidence được khai báo nhưng endpoint không dùng

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:642-678`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java:562-569`
- `eqms-backend/src/main/java/com/eqms/service/SecureFileAccessService.java:184-193`

**Cơ chế đã trace**

`listEvidence` và `downloadEvidence` chỉ gọi quyền xem Controlled Copy. Trong khi đó service đã có
`requireEvidenceReadAccess` và permission `documents.controlled_copy.view_evidence`/
`download_evidence`, nhưng helper này không được hai endpoint gọi.

**Hậu quả thực tế**

User chỉ được xem metadata copy có thể liệt kê/tải evidence Lost/Damaged nhạy cảm dù Access Profile
không cấp quyền evidence.

**Khuyến nghị**

Gọi evaluator evidence theo đúng action tại cả list và download; thêm negative authorization tests.

---

### DC-XF-41 — P1: Tạo lại Review/Publishing Snapshot có thể thất bại âm thầm nhưng API và audit báo thành công

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:921-1000, 4571-4680`
- `eqms/src/features/documents/document-revisions/detail-revision/DetailRevisionView.tsx:1163-1172`

**Cơ chế đã trace**

`refreshPreviewFromUploadedFile` bắt mọi exception và chỉ WARN; Submit vẫn ghi
`REVIEW_PACKAGE_GENERATED`. `regeneratePublishingSnapshotIfConfigured` cũng return im lặng khi thiếu
metadata/template/layout, PDF rỗng hoặc gặp exception; endpoint manual vẫn trả thành công. Preview cũ
nếu còn path có thể tiếp tục thỏa guard readiness. FE còn gọi action này là “Refresh Published PDF”,
trong khi backend chỉ cho Draft và chỉ tạo publishing preview, không thay `publishedPdfPath`.

**Hậu quả thực tế**

Reviewer/Approver có thể xem và duyệt snapshot cũ hoặc thiếu; audit nói package đã tạo dù artefact thực
tế không đổi. UI khiến DCO hiểu nhầm đã cập nhật bản phát hành.

**Khuyến nghị**

Không nuốt lỗi; lưu trạng thái/checksum request và trả lỗi nếu snapshot bắt buộc không tạo được. Audit
chỉ ghi thành công sau khi byte/checksum mới đã persist; đổi nhãn FE đúng semantics.

---

### DC-XF-42 — P0: Rollback batch Revision Workspace có thể xóa artefact hợp lệ của Draft đã tồn tại

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionWorkspaceBatchService.java:69-125, 321-369, 472-486`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:4459-4497`

**Cơ chế đã trace**

Batch cho phép cập nhật Draft đã có. Sau upload, code đưa cả source/preview path hiện tại của target vào
`cleanupPaths`. Nếu item sau lỗi, catch xóa toàn bộ path trong danh sách, còn transaction DB rollback.
Ngoài ra `storeRevisionFile` xóa source/preview cũ ngay trước khi transaction commit.

**Hậu quả thực tế**

DB quay lại checksum/path cũ nhưng object/file đã bị xóa; Draft hợp lệ trở thành record trỏ tới file mất.
Local/NAS chắc chắn không có transaction; object storage cũng không đồng bộ rollback DB theo code này.

**Khuyến nghị**

Staging object mới bằng key bất biến; chỉ finalize và xóa version cũ sau commit. Cleanup chỉ được xóa
artefact mới do request hiện tại tạo, tuyệt đối không đưa path của Draft có trước vào rollback cleanup.

---

### DC-XF-43 — P1: Publish kiểm tra Related Document bằng Revision tạo gần nhất thay vì Revision Effective hiện hành

**Trạng thái remediation (20/08/2026): Đã khắc phục và có regression test.**

Publish hiện truy vấn Revision `EFFECTIVE` hiện hành của từng Related Document. Một Draft upgrade mới hơn không
còn làm Related Document bị coi sai là không Effective; test xác nhận code không gọi truy vấn latest-created.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1265-1298`

**Cơ chế đã trace**

Trước remediation, Publish gọi `findFirstByDocument_IdOrderByCreatedAtDesc` rồi yêu cầu record đó
`EFFECTIVE`, trong khi hệ thống cho phép Revision Effective tồn tại đồng thời với Draft/Review/Approval mới.

**Hậu quả thực tế**

Related Document đang Effective không còn bị một upgrade in-progress chặn Publish hoặc bắt dùng deviation
permission/reason sai.

**Khuyến nghị**

Giữ truy vấn Revision Effective hiện hành hoặc revision snapshot được chọn rõ trong relation; không dùng
“latest created” thay cho “currently effective”.

---

### DC-XF-44 — P1: GET detail ghi vào entity có `@Version`, tạo xung đột với action lifecycle đồng thời

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:448-467`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:480-506`
- `eqms-backend/src/main/java/com/eqms/entity/DocumentRecord.java:34`
- `eqms-backend/src/main/java/com/eqms/entity/DocumentRevisionRecord.java:28`

**Cơ chế đã trace**

Đọc detail/F5 cập nhật `openedBy`, save Document/Revision và ghi audit. Cả hai aggregate lifecycle đều
có optimistic `@Version`; một request đọc vì thế có thể tăng version trong lúc transaction Submit,
Publish, Cancel hoặc Obsolete đang giữ bản cũ.

**Hậu quả thực tế**

Thao tác GMP hợp lệ có thể fail optimistic-lock chỉ vì người khác vừa mở màn hình; retry không được định
nghĩa nhất quán. GET cũng không còn là read-only/idempotent về dữ liệu.

**Khuyến nghị**

Ghi view event vào bảng/projection không version hóa aggregate; không save lifecycle entity trong GET.

---

### DC-XF-45 — P1: GET Revision Workspace Snapshot không kiểm tra object-level authorization

**Trạng thái remediation (20/08/2026): Đã khắc phục trong source, cần kiểm chứng API tích hợp.**

`getSnapshot` hiện resolve `currentUser`, resolve Revision nguồn và gọi
`DocumentAuthorizationService.requireCanViewRevision(...)` trước khi query snapshot. Unit test
`RevisionWorkspaceSnapshotServiceTest` đã xác nhận contract response; cần bổ sung bài API/integration
với một user ngoài object scope để chứng minh HTTP trả về 403 trong môi trường có policy/DB thật.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/RevisionController.java:251-263`
- `eqms-backend/src/main/java/com/eqms/service/RevisionWorkspaceSnapshotService.java:43-60`

**Cơ chế đã trace**

`saveSnapshot` lấy current user và gọi `requireCanEditDraftRevision`, nhưng `getSnapshot` chỉ query theo
`sourceRevisionId + workspaceMode` rồi trả toàn bộ `payloadJson`; không resolve current user hay kiểm tra
quyền trên Revision.

**Hậu quả thực tế**

Authenticated user biết/đoán UUID có thể đọc cấu hình workspace của Revision không thuộc phạm vi mình.

**Khuyến nghị**

Áp dụng object-level view/edit policy phù hợp trước query/response; test chéo Author/Co-Author khác.

---

### DC-XF-46 — P1: FE nén mảng file null nhưng BE ghép file với batch item theo index

**Trạng thái remediation (20/08/2026): Đã khắc phục trong source.**

FE hiện gửi `fileItemIndexes` song song với các multipart file không rỗng. BE validate số lượng,
phạm vi và uniqueness của chỉ mục, sau đó map file theo chỉ mục item đã khai báo. Client legacy chỉ được
phép positional mapping khi gửi đủ số file bằng số item; multipart sparse không có chỉ mục bị từ chối để
không thể gắn nhầm file âm thầm. `RevisionWorkspaceBatchServiceTest` xác nhận file sparse của item 1
không thể bị bind vào item 0. Cần thêm test API multipart end-to-end vào bộ integration test khi có
fixture workspace batch ổn định.

**Vị trí chính**

- `eqms/src/services/api/documents.ts:1206-1317`
- `eqms-backend/src/main/java/com/eqms/service/RevisionWorkspaceBatchService.java:69-125, 190-205`

**Cơ chế đã trace**

FE chỉ append các file không null vào multipart; BE dùng `files.get(index)` cho item cùng index. Với
batch Save, item 0 không có file và item 1 có file sẽ tạo mảng file dài một phần tử, khiến file của item
1 được gán cho item 0. Submit thường yêu cầu đủ file nên dễ fail sớm hơn, nhưng Save cho phép case này.

**Hậu quả thực tế**

Có thể overwrite nhầm Draft/Document, gắn checksum và tên file của tài liệu khác. API hiện chưa thấy UI
gọi ngoài wrapper này, nhưng endpoint vẫn được expose cho client/integration trực tiếp.

**Khuyến nghị**

Ghép bằng stable item ID/part name, không bằng index của mảng đã compact; thêm test `[null, fileB]`.

---

### DC-XF-47 — P1: Cờ related/correlated trên Document và relation rows có thể lệch nhau

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:884-1058, 2678-2682, 2922-2930`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3062-3063`

**Cơ chế đã trace**

Update workflow của Active Document thay toàn bộ relation rows nhưng không cập nhật
`hasRelatedDocuments`/`hasCorrelatedDocuments`. Khi tạo Draft, cờ lại được set từ raw request trước khi
`saveRelation` âm thầm bỏ self-link. Revision sau đó copy các cờ này từ Document.

**Hậu quả thực tế**

Filter/UI/export và Revision snapshot có thể nói có/không có quan hệ ngược với relation rows thực mà
Publish/impact analysis sử dụng.

**Khuyến nghị**

Chỉ derive cờ từ relation rows đã validate/persist hoặc bỏ cột dẫn xuất; cập nhật atomically ở mọi path.

---

### DC-XF-48 — P1: API Report Lost/Damaged cho phép thiếu hoặc gán sai Executor/Witness so với GMP-D08

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:1414-1463, 3360-3391`
- `eqms/src/features/documents/controlled-copies/DestroyControlledCopyView.tsx:262-331`

**Cơ chế đã trace**

FE bắt chọn hai người khác nhau, nhưng BE cho witness null; executor thiếu/không resolve được thì tự đổi
thành DCO hiện tại. Helper bắt cả `IllegalArgumentException`, nên UUID hợp lệ nhưng user không tồn tại có
thể biến thành null/fallback. Witness chỉ được lưu full name, không phải stable user UUID; method/reason
cũng không được service bắt buộc đầy đủ.

**Hậu quả thực tế**

Gọi API trực tiếp có thể tạo hồ sơ `OBSOLETED` với executor/witness sai hoặc thiếu, trong khi chữ ký DCO
chỉ nên là người ghi nhận thay theo GMP-D08, không phải thay thế hai người thực hiện/chứng kiến.

**Khuyến nghị**

BE bắt buộc hai UUID user tồn tại, khác nhau, lưu stable IDs + snapshot tên, bắt buộc method/reason/type;
DCO là `recordedBy` và signature actor riêng.

---

### DC-XF-49 — P0: Publishing Workspace sửa template Active dùng chung trước khi xác thực object-level Publish

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:252-303, 611-680`
- `eqms-backend/src/main/java/com/eqms/service/PublishingTemplateService.java:155-177, 288-421`

**Cơ chế đã trace**

`applyWorkspacePageRanges` ghi page ranges, header/footer/watermark từ request Revision vào chính
`PublishingTemplate` live và save global template. `completePublish` gọi mutation này trước khi
`revisionService.publishRevision` thực hiện object-level authorization. Template Active cũng được sửa
in-place bởi settings service. Complete Publish chỉ so layout, không so template version/ranges/checksum
của preview, rồi compose lại từ template live.

**Hậu quả thực tế**

Một DCO thao tác Revision A có thể đổi template của Revision B; user cuối cùng bị deny Publish vẫn có
thể làm thay đổi cấu hình global trước khi exception xảy ra. PDF đã preview/approve có thể khác PDF
được phát hành. Đây cũng là nguyên nhân gốc bổ sung cho DC-XF-37.

**Khuyến nghị**

Workspace chỉ lưu override/snapshot theo Revision, không mutate template. Authorize toàn bộ action trước
bất kỳ write nào; Published phải consume đúng immutable template version và checksum đã preview.

---

### DC-XF-50 — P1: Workspace cho chọn template Inactive và lựa chọn “No Template” không đúng hợp đồng

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:397-457`
- `eqms/src/features/documents/publishing/PublishingWorkspaceView.tsx:726-734, 983-993`

**Cơ chế đã trace**

Response dùng `publishingTemplateRepository.findAll`, FE hiển thị tất cả mà không lọc status. Khi client
gửi template ID, backend load theo ID không bắt `ACTIVE`. Ngược lại UI “No Template (body only)” gửi
null, nhưng backend `resolveTemplate(null)` tự chọn template Active đầu tiên.

**Hậu quả thực tế**

Revision có thể phát hành bằng Draft/Inactive template; hoặc người dùng chọn không template nhưng output
lại dùng template bất kỳ theo thứ tự tên.

**Khuyến nghị**

Chỉ expose/accept immutable Active version; biểu diễn “no template” bằng lựa chọn explicit và backend
phải giữ đúng lựa chọn, không fallback âm thầm.

---

### DC-XF-51 — P1: Publishing Workspace Job ghi audit lifecycle status giả

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceJobService.java:62-87`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceJobProcessorService.java:62-117`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:387-394`
- `eqms-backend/src/main/java/com/eqms/config/AsyncConfig.java:40-49`

**Cơ chế đã trace**

Open Workspace chỉ hợp lệ khi Revision `READY_FOR_PUBLISHING`, nhưng audit create/failure hardcode
`DRAFT → DRAFT`. Publish failure hardcode `READY_FOR_PUBLISHING → READY_FOR_PUBLISHING` dù Revision có
thể đã Cancelled/Obsoleted trước khi worker chạy. Ngoài ra không tìm thấy recovery scheduler cho job
Publishing `QUEUED/PROCESSING`; đây là cùng lớp rủi ro restart với DC-XF-21.
Executor có tối đa 4 thread và queue 50. Controller tạo job trước rồi mới dispatch `@Async`; khi executor
reject sau lúc create đã commit, không có catch/mark-failed/recovery nên job cũng có thể nằm `QUEUED` vô hạn.

**Hậu quả thực tế**

Audit trail mô tả sai trạng thái thực của Revision; job có thể treo vĩnh viễn sau restart và UI tiếp tục
poll một trạng thái không kết thúc.

**Khuyến nghị**

Lấy before/after status thực tại thời điểm event; có lease/heartbeat/recovery idempotent cho job treo.

---

### DC-XF-52 — P1: Cấp số Revision/Controlled Copy vẫn là read-before-write race

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:641-673, 1397-1484, 5063-5069`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:765-820, 2284-2309`
- `eqms-backend/src/main/resources/db/migration/V47__create_controlled_copies.sql`
- `eqms-backend/src/main/resources/db/migration/V73__enforce_single_in_progress_revision.sql`

**Cơ chế đã trace**

Revision kiểm tra “không có in-progress” rồi tính số/save mà không khóa Document. DB unique bảo vệ kết
quả cuối nhưng request thua nhận constraint error sau khi có thể đã ghi storage. Controlled Copy lấy
document sequence bằng `max + 1` trước khi lock Revision; hai request có thể cùng lấy một số và một
request fail unique sau khi artefact đã tạo.

**Hậu quả thực tế**

Không tạo được hai record trùng nhờ DB, nhưng user gặp 500/constraint leak và storage mồ côi dưới tải
đồng thời; retry không idempotent.

**Khuyến nghị**

Serialize theo Document bằng pessimistic/advisory lock hoặc sequence DB; map conflict thành 409 có thể
retry, kết hợp staging/finalize-after-commit.

---

### DC-XF-53 — P2: API list Controlled Copy không giới hạn page size phía server

**Trạng thái remediation (20/08/2026): Đã khắc phục trong source.**

Hai query list (`list` và `listDistributionBatches`) hiện clamp `limit` về `1..50`, đồng nhất với
Document/Revision. `ControlledCopyListAuthorizationIntegrationTest` gọi `limit=1000` và xác nhận
pagination response trả limit thực tế là `50`. Cần bổ sung test endpoint batch list khi mở rộng bộ test
controller, nhưng guard nằm ở service dùng chung của endpoint.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:286-329, 886-925`

**Cơ chế đã trace**

`list` và `listDistributionBatches` chỉ dùng `Math.max(..., 1)`, không có upper bound; trong cùng service,
child list đã cap 100 và Document/Revision list cap 50.

**Hậu quả thực tế**

Client có thể yêu cầu page cực lớn, tăng tải query/heap/serialization và làm giảm khả năng phục vụ user
đồng thời.

**Khuyến nghị**

Áp server cap nhất quán, trả 400 hoặc clamp và ghi metric khi vượt ngưỡng.

---

### DC-XF-54 — P1: Cấu hình placeholder của Controlled Copy thay đổi output GMP mà không có e-signature/audit

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyPlaceholderFieldService.java:27-96`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyPolicyService.java:59-82`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyExpiryLimitService.java:55-160`

**Cơ chế đã trace**

Create/delete placeholder field chỉ kiểm tra permission rồi save/delete; không gọi security change
signature và không ghi audit. Các field này cho DCO override placeholder được đưa vào PDF Controlled
Copy. Trong khi policy/expiry config bên cạnh bắt buộc signature và ghi security config change.

**Hậu quả thực tế**

Admin có thể thay đổi tập dữ liệu được in lên bản kiểm soát mà không có bằng chứng ai ký/chấp thuận,
không nhất quán với change control cấu hình cùng module.

**Khuyến nghị**

Áp cùng signature/audit/versioning như Controlled Copy Policy; không hard-delete cấu hình đã từng dùng,
phải giữ version tham chiếu từ artefact.

---

### DC-XF-55 — P1: Redis gián đoạn làm toàn bộ expiry lifecycle scheduler bị bỏ qua

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/DistributedSchedulerLockService.java:29-56`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyExpiryScheduler.java:66-76, 143-188`

**Cơ chế đã trace**

Scheduler lock mặc định bật Redis. Khi Redis bean/connection không khả dụng, `tryAcquire` trả lease
không acquired; job 02:00 chỉ WARN rồi return, không có DB lease/fallback/retry trong ngày. Cả reminder
và chuyển `DISTRIBUTED → OBSOLETED` đều không chạy.

**Hậu quả thực tế**

File access có kiểm tra timestamp nên một số request bị chặn động, nhưng lifecycle DB, batch status,
audit, obsolescence reason và notification vẫn sai/chậm ít nhất tới lần scheduler thành công tiếp theo.
Nếu Redis outage kéo dài, tồn tại vô hạn record hiển thị Distributed dù đã hết hạn.

**Khuyến nghị**

Dùng durable DB lease hoặc cơ chế retry/catch-up có health alert; lần chạy sau phải quét toàn bộ overdue,
không chỉ cửa sổ ngày hiện tại. Tách reminder failure khỏi terminal expiry processing.

---

### DC-XF-56 — P0: Các nút Publish thực tế gọi API trực tiếp và có thể chuyển Effective mà không tạo official Published PDF

**Vị trí chính**

- `eqms/src/features/documents/document-revisions/views/RevisionListView.tsx:292`
- `eqms/src/features/documents/document-revisions/detail-revision/DetailRevisionView.tsx:674`
- `eqms/src/features/documents/document-detail/DetailDocumentView.tsx:1214`
- `eqms-backend/src/main/java/com/eqms/controller/RevisionController.java:238-243`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1245-1332, 1585-1603, 1671-1776`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:278-339`

**Cơ chế đã trace**

Ba màn hình FE gọi `documentApi.publishRevision`, đi thẳng vào `RevisionService.publishRevision`.
Service chỉ kiểm tra status/training rồi đổi Revision `EFFECTIVE`, đổi Document `ACTIVE`, obsolete bản cũ
và ký. Việc compose/store `published.pdf` và set `publishedPdfPath/checksum/versionId` chỉ tồn tại trong
`PublishingWorkspaceService.completePublish`, không nằm trong endpoint trực tiếp.

**Hậu quả thực tế**

Revision có thể Effective mà không hề có official Published PDF. Controlled Copy, preview/download và
audit tiếp tục chạy trên artefact review/preview hoặc path cũ; trạng thái nghiệp vụ khẳng định “đã phát
hành” trong khi bản phát hành không tồn tại.

**Khuyến nghị**

Chỉ có một command Publish duy nhất, atomically xác thực preview checksum/template version, tạo và verify
official PDF trước khi chuyển Effective. Mọi FE/caller phải đi qua command đó; khóa/xóa endpoint tắt.

---

### DC-XF-57 — P0: Controlled Copy lấy `Revision.previewFilePath` làm “published PDF”, bỏ qua metadata Published

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:759-860, 1479-1538, 2678-2711`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:205-217, 319-335`
- `eqms-backend/src/main/java/com/eqms/entity/RevisionPublishingMetadata.java:40-56`

**Cơ chế đã trace**

`requirePublishedPdfBytes` đặt tên biến published nhưng đọc thẳng `revision.getPreviewFilePath()`.
Publishing Workspace lưu preview vào field này, còn official PDF được lưu ở
`RevisionPublishingMetadata.publishedPdfPath` và `revision.storagePdfUrl`; publish không thay
`previewFilePath` thành official path. Request/Replacement Controlled Copy đều gọi helper sai này.

**Hậu quả thực tế**

Ngay cả khi Workspace Publish đã tạo official PDF đúng, bản Controlled Copy ban đầu vẫn clone review/
publishing preview. Nếu compose placeholder khi Distribute fail và bị nuốt theo DC-XF-31, chính preview
đó trở thành file Distributed. Checksum Controlled Copy vì thế không chứng minh nguồn official.

**Khuyến nghị**

Resolve duy nhất từ immutable `publishedPdfPath + publishedPdfChecksum + versionId`; verify checksum
trước clone/render và lưu source lineage vào Controlled Copy. Không fallback preview cho Effective.

---

### DC-XF-58 — P0: Electronic Signature không liên kết Review PDF/Published PDF thực sự được ký

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1018-1038, 1112-1124, 1671-1776, 1917-1936`
- `eqms-backend/src/main/java/com/eqms/service/ElectronicSignatureService.java:119-166`
- `eqms-backend/src/main/java/com/eqms/entity/ElectronicSignature.java:170-178`

**Cơ chế đã trace**

Mọi Review/Approval/Training/Publish signature truyền `sourceFileChecksum` cho cả before/after. Trong
`createRevisionSignature`, `reviewPdfVersionId` và `publishedPdfVersionId` luôn được set `null`; grep toàn
backend không có nơi khác set hai field. Publish signature còn được tạo trước khi
`PublishingWorkspaceService` compose/store official PDF nên tại thời điểm ký chưa có published checksum.

**Hậu quả thực tế**

Hệ thống không chứng minh được PDF reviewer/approver đã xem hoặc PDF DCO phát hành chính là nội dung gắn
với chữ ký. Source DOCX giống nhau vẫn có thể tạo PDF khác do template/range/placeholder thay đổi, đặc
biệt khi kết hợp DC-XF-37/DC-XF-49.

**Khuyến nghị**

Review/Approval signature phải bind immutable review PDF checksum/version; Publish phải tạo/verify
official PDF trước rồi ký đúng published checksum/version trong cùng command. Signature manifestation
phải hiển thị các định danh artefact này.

---

### DC-XF-59 — P1: Mỗi Document chỉ tạo được một Upgrade Session suốt đời

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionUpgradeSessionService.java:83-138, 525-527`
- `eqms-backend/src/main/java/com/eqms/entity/RevisionUpgradeSession.java:20-31`

**Cơ chế đã trace**

`sessionKey` là cố định `<documentId>:upgrade` và unique. `createSession` trả session cũ ngay khi tồn tại,
không kiểm tra status hoặc current Effective revision. `continueSession` đổi session thành COMPLETED,
nhưng không có reset/new-key/archive path.

**Hậu quả thực tế**

Sau một lần upgrade hoàn tất, lần upgrade kế tiếp nhận lại payload/source revision cũ và status
COMPLETED; không thể Continue. Nếu Effective revision đã đổi, impact list và new revision number trong
payload cũng stale.

**Khuyến nghị**

Key phải chứa source Effective revision ID hoặc cycle UUID; chỉ reuse Draft session đúng source hiện
hành. Completed session immutable và không chặn cycle mới.

---

### DC-XF-60 — P1: Reason For Change của Upgrade Session không đi vào Revision history/audit/e-signature

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionUpgradeSessionService.java:151-224`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1392-1498`

**Cơ chế đã trace**

Continue bắt buộc `reasonForChange`, nhưng chỉ ghi chuỗi này vào `payloadJson` của session. Khi tạo các
Revision, service chỉ truyền session ID qua field `impactAnalysisId`; Revision reason/history/audit đều
hardcode “Upgraded from revision ...”. Continue Session cũng không ghi audit/e-signature riêng.

**Hậu quả thực tế**

Reason mà UI/API bắt người dùng khai báo không xuất hiện trong hồ sơ lifecycle của Revision và không gắn
với actor/signature; muốn điều tra phải đọc JSON phụ có thể stale, không phải audit trail chính.

**Khuyến nghị**

Persist immutable change reason/impact decision vào từng Revision và audit causal event của session;
nếu SOP yêu cầu ký change initiation, bind cùng signature session.

---

### DC-XF-61 — P1: Hai endpoint Upgrade trực tiếp bỏ qua toàn bộ session/impact/reason contract

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/DocumentController.java:133-165`
- `eqms-backend/src/main/java/com/eqms/controller/RevisionController.java:246-248`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1392-1498`
- `eqms/src/services/api/documents.ts:584-590, 1168-1185`

**Cơ chế đã trace**

Ngoài Upgrade Session có reason/impact selection, backend vẫn expose `POST /documents/{id}/upgrade-revision`
và `POST /revisions/{id}/upgrade` không nhận body. Hai đường này tạo Draft ngay với reason hardcode,
`impactAnalysisId=null`, không có lựa chọn related documents và không có e-signature.

**Hậu quả thực tế**

Cùng hành động Upgrade có hai hợp đồng nghiệp vụ khác nhau; client/integration gọi đường ngắn có thể bỏ
qua toàn bộ dữ liệu thay đổi mà đường session coi là bắt buộc.

**Khuyến nghị**

Chọn một command contract. Nếu impact/reason là bắt buộc thì direct endpoints phải bị loại bỏ hoặc gọi
chung command với request đầy đủ; policy/capability không được quảng bá đường tắt.

---

### DC-XF-62 — P1: Upgrade theo Revision phải luôn snapshot từ Revision Effective nguồn

**Trạng thái remediation (20/08/2026): Đã khắc phục và có regression test.**

`RevisionService.upgradeRevision` không còn truy vấn Revision tạo gần nhất. Draft mới truyền chính
Revision Effective đã qua authorization vào `applyRevisionSnapshot`; test xác nhận không còn gọi truy vấn
latest revision. Vì `applyRevisionSnapshot` hiện chỉ dùng snapshot Document Master, lỗi cũ chưa làm copy
metadata Revision Cancelled trong implementation hiện tại, nhưng việc loại bỏ truy vấn dư thừa khóa đúng
invariant và ngăn tái phát nếu snapshot sau này bổ sung field Revision-level.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1448-1498`

**Cơ chế đã trace**

Trước remediation, endpoint nhận một Revision Effective làm `source` và parent, nhưng lại truy vấn
`latestRevision = findFirst...OrderByCreatedAtDesc` trước khi gọi `applyRevisionSnapshot`. Kịch bản
R1 Effective → tạo R2 Draft → Cancel R2 → Upgrade R1 có thể khiến code chọn R2 Closed-Cancelled làm
đối số snapshot. Sau remediation, đối số này luôn là `source` (R1).

**Hậu quả thực tế**

Không còn nhánh nào chọn Revision Cancelled làm snapshot source. Invariant nguồn upgrade và parent lineage
được giữ cùng một Revision Effective đã được authorize.

**Khuyến nghị**

Giữ regression test khi thay đổi `applyRevisionSnapshot`; nếu sau này có Recover/Clone Cancelled Draft,
đó phải là action riêng, hiển thị rõ nguồn và audit reason.

---

### DC-XF-63 — P2: FE khai báo API Knowledge Base `preview-opened` nhưng backend không có endpoint và không có caller

**Trạng thái remediation (20/08/2026): Đã khắc phục ở FE; phát hiện ban đầu về caller đã được cập nhật.**

Wrapper thực tế có một caller ở `KnowledgeDocumentPreviewPage`, nhưng request luôn 404 và bị nuốt.
Wrapper/call đã được xóa. Audit chuẩn vẫn được ghi bởi `DocumentService.previewDocumentFile` sau object-level
authorization và file-access policy thành công (`PREVIEW` audit event), nên không mất traceability khi bỏ
request giả này.

**Vị trí chính**

- `eqms/src/services/api/documents.ts:567-570`
- `eqms-backend/src/main/java/com/eqms/controller/DocumentController.java:95-120`

**Cơ chế đã trace**

FE wrapper POST `/documents/knowledge-base/{id}/preview-opened` tồn tại, nhưng không có controller mapping
tương ứng và hiện cũng không có component gọi wrapper. GET Knowledge Base vì vậy không ghi telemetry
theo đường được mô tả trong API client.

**Hậu quả thực tế**

Đây là contract chết: maintainer nối UI vào wrapper sẽ nhận 404; đồng thời code gợi ý có tracking
preview trong khi runtime không có. Không phải lỗi đang chạy vì wrapper chưa được gọi.

**Khuyến nghị**

Xóa wrapper/comment nếu không cần tracking; nếu cần, triển khai endpoint qua view-event store không
mutation Document aggregate để tránh lặp DC-XF-44.

---

### DC-XF-64 — P0: Có thể hard-delete Publishing Template/component đã dùng, phá immutable lineage của Revision Effective

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/PublishingTemplateController.java:103-173`
- `eqms-backend/src/main/java/com/eqms/service/PublishingTemplateService.java:230-249, 395-421`
- `eqms-backend/src/main/resources/db/migration/V129__create_publishing_templates_and_workspace.sql:24, 43-58`

**Cơ chế đã trace**

`deleteTemplate` gọi repository hard-delete, không chặn status Active/đang được Revision dùng, không
e-signature/audit. FK metadata dùng `ON DELETE SET NULL`, còn `publishing_template_versions` dùng
`ON DELETE CASCADE`, nên xóa template làm mất cả version history và cắt lineage khỏi Revision. Xóa
component còn gọi `fileStorageService.deleteStoredFile` trên object path; không kiểm tra path đó có được
version snapshot/Revision Effective tham chiếu hay không.

**Hậu quả thực tế**

Revision Effective còn PDF nhưng không còn chứng minh template/version/component đã tạo nó. Controlled
Copy sinh sau đó không thể compose cùng template; asset lịch sử có thể bị xóa vật lý dù version row từng
giữ path. Đây là phá vỡ nguyên tắc immutable record/change control.

**Khuyến nghị**

Không hard-delete template/version/component từng được publish hoặc tham chiếu. Chỉ retire/inactivate có
e-signature/audit; asset version dùng immutable object key và FK `RESTRICT`. Cleanup chỉ áp dụng Draft
chưa từng dùng, sau impact check đầy đủ.

---

### DC-XF-65 — P1: DB không bảo vệ tính bất biến của bản ghi Electronic Signature

**Vị trí chính**

- `eqms-backend/src/main/resources/db/migration/V138__electronic_signature_records_and_settings.sql:40-72`
- `eqms-backend/src/main/resources/db/migration/V245__lock_audit_logs_immutability.sql:13-46`
- `eqms-backend/src/main/resources/db/migration/V341__prevent_regulated_record_deletion.sql:17-34`
- `eqms-backend/src/main/java/com/eqms/service/ElectronicSignatureService.java:119-166, 202-275`

**Cơ chế đã trace**

Service hiện chỉ tạo Electronic Signature và các FK dùng `ON DELETE RESTRICT`, nhưng bảng
`electronic_signatures` không có trigger chặn `UPDATE`, `DELETE` hoặc `TRUNCATE`. Trong cùng schema,
`audit_logs`/`audit_log_changes` đã được bảo vệ bất biến bằng trigger và Document/Revision/Controlled
Copy đã có trigger cấm xóa vật lý. Không có migration tương đương cho chữ ký điện tử. Vì vậy application
path hiện tại không cung cấp API sửa/xóa, nhưng thao tác SQL trực tiếp, tài khoản DB đặc quyền hoặc một
repository path được thêm sau này vẫn có thể thay đổi actor, meaning, timestamp, checksum, status hoặc
xóa bản ghi mà DB không từ chối.

**Hậu quả thực tế**

Audit log có thể vẫn tồn tại trong khi bằng chứng chữ ký mà log tham chiếu đã bị thay đổi hoặc biến mất.
Đây là khoảng trống data-integrity ở lớp DB đối với hồ sơ GMP; `status=REVOKED` trong schema cũng chưa có
mô hình append-only riêng để phân biệt thu hồi hợp lệ với sửa lịch sử.

**Khuyến nghị**

Bảo vệ chữ ký đã ghi bằng trigger bất biến tương tự audit trail. Nếu cần revoke, không UPDATE bản ghi gốc;
ghi một revocation event/signature record mới liên kết chữ ký nguồn, gồm actor, reason, timestamp và audit.
Thiết kế exception migration/retention phải tường minh, transaction-scoped và được kiểm thử trực tiếp ở DB.

---

### DC-XF-66 — P2: FE còn hợp đồng Review Comment đã bị backend và DB loại bỏ

**Vị trí chính**

- `eqms/src/services/api/documents.ts:1370-1433`
- `eqms/src/features/documents/document-revisions/views/RevisionCreateView.tsx:667-714, 831, 2020-2027`
- `eqms/src/features/documents/document-revisions/review-revision/RevisionReviewView.tsx:276-338`
- `eqms/src/features/documents/document-revisions/approval-revision/RevisionApprovalView.tsx:248-310`
- `eqms/src/features/documents/document-revisions/detail-revision/DetailRevisionView.tsx:388-392`
- `eqms-backend/src/main/resources/db/migration/V282__remove_pdf_comments_and_add_ready_for_publishing.sql:1-15`

**Cơ chế đã trace**

Migration V282 đã DROP cả ba bảng comment/reply/attachment và xóa permission liên quan; backend hiện
không có controller/service/repository cho `/revisions/{id}/review-comments`. Tuy nhiên FE API client vẫn
khai báo toàn bộ CRUD/reply/attachment endpoints. Các màn hình Create/Review/Approval còn giữ state và
handler gọi các endpoint này, trong khi `loadReviewComments` chỉ reset mảng về rỗng. Ở Create view,
`isRejectedRework` và banner “retains ... all Reviewer/Approver comments” vì thế không bao giờ phản ánh
dữ liệu thực.

**Hậu quả thực tế**

Code hiện tại tạo cảm giác feedback PDF vẫn được hỗ trợ nhưng UI luôn coi comment là rỗng; nếu một handler
được nối lại vào component thì request sẽ 404. Nhánh rework dựa trên `reviewComments.length` là nhánh chết,
dễ khiến maintainer hoặc tester hiểu sai dữ liệu feedback nào được bảo toàn sau Reject.

**Khuyến nghị**

Chốt một nguồn feedback đang được hỗ trợ (workflow history/rejection reason hoặc một comment subsystem
mới). Nếu V282 là quyết định cuối cùng, xóa types/API wrappers/state/handlers/banner chết và dùng dữ liệu
workflow thật cho rework. Nếu cần PDF comments, khôi phục trọn BE/API/DB/permission/audit/retention thay vì
chỉ nối lại FE.

---

### DC-XF-67 — P1: CSV Export của cả ba đối tượng cho phép spreadsheet formula injection

**Trạng thái remediation (20/08/2026): Đã khắc phục trong source.**

Document, Revision và Controlled Copy hiện đều delegate sang `CsvSafety.escapeCell`, neutralize các tiền tố
`=`, `+`, `-`, `@`, tab và carriage return trước khi RFC-4180 escape. Cần duy trì test đơn vị cho utility
này và rà soát riêng các export ngoài Document Control (ví dụ Audit Trail/Report Platform), vốn không nằm
trong phạm vi phát hiện này.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:373-435, 3254-3263`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:415-475, 2421-2427`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:350-405, 2581-2583`

**Cơ chế đã trace**

Các export đưa trực tiếp document/revision name, actor, department, recipient, location, distribution
comment và các field nghiệp vụ khác vào CSV. Ba helper `csv(...)` chỉ quote/escape dấu `"`, dấu phẩy và
newline; không neutralize giá trị bắt đầu bằng `=`, `+`, `-`, `@`, tab hoặc carriage return. Vì vậy một
giá trị người dùng nhập như `=HYPERLINK(...)` vẫn được Excel/LibreOffice hiểu là công thức khi mở file.
Logic này còn bị nhân bản ở ba service với cách quote khác nhau, nên một lần sửa riêng lẻ dễ tiếp tục drift.

**Hậu quả thực tế**

Người có quyền nhập metadata/comment nhưng không có quyền trên máy của DCO/Admin có thể đưa payload vào
file export; khi người nhận mở bằng spreadsheet client, payload có thể tạo link lừa đảo, gọi external
resource hoặc thực hiện hành vi tùy theo khả năng/cấu hình của client. CSV vẫn đúng cú pháp nên build và
test thông thường không phát hiện.

**Khuyến nghị**

Dùng một CSV writer/sanitizer dùng chung cho toàn hệ thống. Sau khi chuẩn hóa line break và escape CSV,
neutralize mọi cell có ký tự nguy hiểm đầu tiên (kể cả sau whitespace/control character) theo một policy
được test; không chỉ thêm quote vì quote không vô hiệu hóa formula. Thêm test payload cho mọi cột text ở
cả ba export và ghi rõ định dạng export là dữ liệu, không phải công thức.

---

### DC-XF-68 — P1: Knowledge Base làm lộ tài liệu Effective và folder của Department khác

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/DocumentController.java:100-120`
- `eqms-backend/src/main/java/com/eqms/service/DocumentService.java:1816-1948`
- `eqms-backend/src/main/java/com/eqms/entity/UserAccount.java:45-46, 233-238`
- `eqms-backend/src/main/java/com/eqms/service/UserManagementService.java:1938-1947, 2531-2542`
- `eqms/src/app/navigation.ts:129-146`

**Cơ chế đã trace**

Theo GMP-D09, user trong Document Control chỉ được xem toàn bộ tài liệu Effective thuộc Department của
chính mình. Runtime hiện tại không lấy current user trong bất kỳ Knowledge Base method nào:
`getKnowledgeBase()` query toàn bộ Document `ACTIVE`, ghép mọi Revision `EFFECTIVE` rồi tạo folder cho
mọi Department; `getKnowledgeBaseDepartments()` còn trả toàn bộ Department active; endpoint
`/departments/{departmentId}` chỉ lọc folder bằng path parameter do client cung cấp, không đối chiếu
Department của user. Sidebar chỉ gate menu cha bằng `documents.module.view`, không có department scope.

User hiện lưu Department dưới dạng tên text trong `app_users.department`, trong khi Document dùng FK
`departments.id`. User Management có validate dictionary lúc ghi nhưng chỉ lưu `department.getName()`;
do đó việc sửa cần resolve stable Department ID hoặc ít nhất có migration/backfill rõ ràng, không dựa lâu
dài vào so khớp tên có thể bị rename/drift.

**Hậu quả thực tế**

Một nhân viên có quyền vào module có thể enumerate tên/mã/count folder của mọi Department và nhận metadata
của toàn bộ Document Effective ở các Department khác. Đây là lỗi object-scope theo baseline đã chốt, kể
cả khi endpoint download/detail khác có thể chặn bước sau.

**Khuyến nghị**

Gắn `department_id` ổn định cho user (FK hoặc quan hệ membership nếu sau này một user thuộc nhiều
Department). Cả ba query Knowledge Base phải bắt buộc scope bằng Department ID ở DB, không tải toàn bộ rồi
lọc Java. Path `{departmentId}` khác phạm vi phải trả 403/404 nhất quán; không trả folder rỗng để che việc
authorization chưa được kiểm tra. Thêm index/query và integration test chống IDOR.

---

### DC-XF-69 — P1: Pipeline MinIO/Publishing rò file tạm cho tới khi JVM dừng, có thể làm đầy ổ đĩa dưới tải

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/MinioObjectStorageService.java:122-157, 183-194`
- `eqms-backend/src/main/java/com/eqms/service/PublishingPdfComposerService.java:70-107, 158-167, 183-220`
- `eqms-backend/src/main/java/com/eqms/service/PublishingOpenXmlTemplateRenderService.java:176-205, 250-255`
- `eqms-backend/src/main/java/com/eqms/service/PublishingTemplateService.java:892-934`

**Cơ chế đã trace**

Mỗi `store()` tạo một thư mục/file staging và mỗi `materialize()` tạo một thư mục/file download mới.
File chỉ được đăng ký `deleteOnExit`; thư mục cha không được dọn. Các đường compose preview/published PDF
materialize source/cover/header/footer và render DOCX nhiều lần nhưng không có ownership contract/`finally`
để xóa các path này. `detectPlaceholdersForFile()` cũng materialize rồi không cleanup. Với JVM backend sống
dài, `deleteOnExit` không phải cleanup theo request và còn giữ danh sách path trong bộ nhớ tới khi process thoát.

**Hậu quả thực tế**

Preview, publish và phân phối hàng loạt có thể tích lũy nhiều bản DOCX/PDF kích thước lớn trong temp disk;
khi ổ tạm đầy, mọi upload/compose có thể fail đồng loạt. Restart mới cố dọn file đã đăng ký, còn các thư mục
cha vẫn tồn tại và crash cứng có thể không chạy delete-on-exit.

**Khuyến nghị**

Định nghĩa rõ ownership cho materialized/staging resource bằng `AutoCloseable`/scoped temp directory và xóa
recursive trong `finally`. `StoredObject` không nên trả staging path sống lâu nếu caller chỉ cần object metadata.
Thêm metric dung lượng/temp-file count và stress test nhiều preview/publish liên tiếp.

---

### DC-XF-70 — P1: Mọi upload MinIO bị serialize qua network bucket check và cấu hình compliance lặp lại

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/MinioObjectStorageService.java:122-126, 235-248, 342-357`

**Cơ chế đã trace**

`store()` luôn gọi `ensureBucket()`. Helper này là `synchronized` toàn instance, gọi `bucketExists` và sau đó
tiếp tục bật/kiểm tra versioning + object lock qua mạng cho mỗi object. Do đó các upload Revision, template,
preview, published PDF và Controlled Copy trên cùng backend phải tuần tự đi qua một critical section network,
dù bucket đã được khởi tạo lúc startup.

**Hậu quả thực tế**

Một MinIO round-trip chậm chặn mọi uploader khác; throughput upload/compose bị giới hạn bởi chuỗi kiểm tra
bucket thay vì pool xử lý file. Với nhiều job đồng thời, queue file-processing dễ dồn và timeout dây chuyền.

**Khuyến nghị**

Khởi tạo/validate compliance một lần có trạng thái rõ ràng lúc startup hoặc cache theo immutable config với
revalidation có kiểm soát; không đặt network I/O per-object dưới global monitor. Load test 500-user phải đo
latency/lệnh MinIO và chứng minh không hạ mức WORM/versioning.

---

### DC-XF-71 — P0: Graph upload nằm ngoài transaction DB và tái sử dụng file cùng tên mà không đối chiếu checksum

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/MicrosoftGraphOfficeOnlineService.java:133-189`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3702-3800`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:4201-4278`

**Cơ chế đã trace**

`syncRevisionToOfficeOnline()` mở transaction DB nhưng upload file và tạo sharing links trên Microsoft Graph
trước khi save Revision/history/notification. Nếu DB/audit/notification rollback sau Graph success, remote item
và quyền đã cấp không có compensation. Khi retry, `uploadOfficeFile()` tìm item cùng folder + filename; nếu có,
nó trả item hiện hữu ngay, không upload byte mới và không so checksum/eTag. Chiều ngược lại, sync từ Graph ghi
một version MinIO immutable trước khi commit DB; rollback để lại object không được DB tham chiếu.

**Hậu quả thực tế**

DB có thể nói chưa từng mở Office Online trong khi file/link edit vẫn tồn tại; retry có thể gắn Revision vào
orphan cũ chứa nội dung khác với source MinIO hiện hành. Hoặc MinIO tích lũy version hợp lệ về kỹ thuật nhưng
không có lineage DB. Đây là sai lệch nội dung/permission ngoài transaction ở ranh giới hệ thống GMP.

**Khuyến nghị**

Dùng operation ID + expected source checksum/eTag, outbox/saga và reconciliation ledger. Retry chỉ được reuse
remote item khi metadata checksum và operation identity khớp; nếu không phải replace/upload version mới có
lineage. Mọi grant phải được ghi pending rồi confirm; rollback/failure phải tạo cleanup/revoke task có retry và
alert, không phụ thuộc transaction DB có thể rollback external side effect.

---

### DC-XF-72 — P1: Upload Publishing Template chỉ kiểm ZIP magic, cho phép DOCX corrupt/ZIP bomb đi vào kho

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/PublishingTemplateController.java:155-163`
- `eqms-backend/src/main/java/com/eqms/service/PublishingTemplateService.java:288-388, 804-819, 892-934`
- `eqms-backend/src/main/java/com/eqms/service/RevisionUploadFileValidator.java:51-317`

**Cơ chế đã trace**

Revision source có validator đầy đủ về size, số entry, tổng uncompressed bytes, required OOXML parts, XML an
toàn, macro/ActiveX/embedding và malware. Publishing Template không dùng validator tương đương: extension
**hoặc** MIME từ client được chấp nhận, toàn file được nạp vào `byte[]`, rồi chỉ kiểm bốn byte ZIP magic.
Không có max-size/entry/uncompressed limit, không xác nhận `[Content_Types].xml`/`word/document.xml`, không
chặn macro/ActiveX/embedding. Sau khi store, lỗi preview bị log rồi bỏ qua; lỗi POI khi detect placeholder trả
`[]`, nên API vẫn có thể trả success cho component corrupt.

**Hậu quả thực tế**

User có quyền quản trị template có thể vô tình hoặc cố ý lưu arbitrary ZIP/corrupt OOXML; ZIP bomb/OOXML lớn
có thể làm cạn heap/CPU khi POI/renderer xử lý. Lỗi chỉ xuất hiện muộn lúc preview/publish và chặn phát hành
Revision, trong khi template đã được coi là hợp lệ/Active.

**Khuyến nghị**

Tách validator OOXML dùng chung với giới hạn cấu hình; validate và inspect hoàn toàn trước khi store/activate.
Không swallow lỗi preview/placeholder inspection ở upload; component chỉ Active sau khi render smoke test pass.

---

### DC-XF-73 — P1: Publishing fail-open khi copy image/style lỗi, có thể phát hành PDF khác template đã cấu hình

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/PublishingOpenXmlTemplateRenderService.java:1400-1450`
- `eqms-backend/src/main/java/com/eqms/service/PublishingPdfComposerService.java:183-220`
- `eqms-backend/src/main/java/com/eqms/service/PublishingTemplateService.java:329-340, 892-934`

**Cơ chế đã trace**

Khi copy header/footer, lỗi parse XML sau thay relationship bị bỏ qua; lỗi copy **bất kỳ** picture nào cũng bị
nuốt với giả định đó là “decorative image”. Khi resolve placeholder style, composer bắt mọi exception và dùng
map rỗng. Upload template cũng nuốt lỗi warm preview và lỗi inspect placeholder. Các nhánh này không đánh dấu
artefact degraded và không làm publish fail.

**Hậu quả thực tế**

Logo/hình kiểm soát, relationship hoặc style placeholder có thể bị thiếu/thay đổi trong official PDF nhưng job
vẫn báo thành công. Audit không cho biết output đã dùng fallback, nên reviewer không thể chứng minh artefact
phát hành đúng template đã duyệt.

**Khuyến nghị**

Official publish phải fail-closed với component/style/image được cấu hình. Chỉ cho phép fallback đối với field
được policy đánh dấu optional, đồng thời lưu warning có cấu trúc và checksum output để người có thẩm quyền xác
nhận lại. Thêm golden-file test cho logo, header/footer relationship, font/style và placeholder.

---

### DC-XF-74 — P1: Không có domain idempotency/unique active job cho Publishing; hai worker có thể publish cùng Revision

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/PublishingWorkspaceController.java:88-97`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceJobService.java:33-59, 90-123`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceJobProcessorService.java:47-90`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:278-339`
- `eqms-backend/src/main/java/com/eqms/entity/PublishingWorkspaceJob.java:17-75`
- `eqms-backend/src/main/resources/db/migration/V137__create_publishing_workspace_jobs.sql:1-16`
- `eqms-backend/src/main/java/com/eqms/auth/IdempotencyFilter.java:23-113`
- `eqms/src/services/api/client.ts:254-280`

**Cơ chế đã trace**

Mỗi POST `/publish` insert một job `QUEUED` mới rồi dispatch async; repository/schema không có business
idempotency key, partial unique index cho active job hoặc lock theo Revision. Hệ thống **có** lớp bảo vệ HTTP
tổng quát: FE chống trùng promise đang in-flight và tự gắn UUID `Idempotency-Key`; `IdempotencyFilter` dùng Redis
để replay đúng actor + method + URI + key. Tuy nhiên FE sinh UUID mới cho mỗi lần invocation mới, direct client
có thể gửi hai key khác nhau, và Redis outage làm filter fail-open. Vì vậy hai command khác key vẫn tạo hai job,
cùng pass `requireReadyRevision` và cùng thực hiện chữ ký/status/external compose/store. `@Version` ở Revision có
thể làm một transaction thua khi flush, nhưng không rollback được PDF đã ghi MinIO. Job entity cũng không có
`@Version`. Ngoài ra executor file chỉ nhận 4 worker + queue 50; nếu dispatch bị reject sau khi job đã commit,
không có nhánh đổi job khỏi `QUEUED` và recovery scheduler hiện không tồn tại (mở rộng DC-XF-51). Filter còn
cache ngay response HTTP `202 Accepted` trong 15 phút, không theo dõi outcome async phía sau; replay 202 không
đồng nghĩa job đã hoàn tất và không thể thay thế recovery/idempotency ở cấp command.

**Hậu quả thực tế**

Một click kép/retry mạng có thể tạo hai signature/audit/job cạnh tranh và nhiều immutable published artefact;
job thua có thể báo Failed dù artefact ngoài DB đã tồn tại. Khi queue đầy/restart, job có thể treo vô hạn.

**Khuyến nghị**

Command Publish cần idempotency key bền vững ở cấp nghiệp vụ và DB-enforced một active job/Revision; worker claim bằng lease/version,
revalidate lifecycle + expected version/checksum ngay trước từng external side effect và finalize bằng CAS. Có
outbox/recovery cho queue rejection/restart và cleanup/reconciliation orphan MinIO.

---

### DC-XF-75 — P2: `office_online_ever_synced` là hợp đồng chết giữa DB và FE

**Trạng thái remediation (20/08/2026): Đã loại bỏ contract chết ở FE; cột migration lịch sử giữ nguyên.**

`officeOnlineEverSynced` đã được xóa khỏi DTO type và guard UI. Điều này không làm thay đổi quyền Upload
Source hiện hành vì API chưa từng trả `true`; capability backend và trạng thái working copy vẫn là nguồn
quyết định. Không xóa migration/cột trên production database để tránh destructive schema change không cần thiết.

**Vị trí chính**

- `eqms-backend/src/main/resources/db/migration/V264__add_office_online_ever_synced.sql:1-7`
- `eqms/src/features/documents/document-revisions/detail-revision/types.ts:184`
- `eqms/src/features/documents/document-revisions/views/RevisionCreateView.tsx:829`

**Cơ chế đã trace**

Migration tạo cột `office_online_ever_synced`, FE từng khai báo/đọc `officeOnlineEverSynced`, nhưng không có
mapping field này trong entity/DTO/service backend và không có code nào set cột. API vì vậy không thể trả
`true`; điều kiện FE từng dựa một phần vào giá trị luôn `undefined`.

**Hậu quả thực tế**

Trước remediation, guard UI không phản ánh lịch sử sync thật và có thể drift khi các điều kiện phụ thay đổi.
Sau remediation, UI không còn giả định cột không được runtime duy trì là một invariant.

**Khuyến nghị**

Nếu có yêu cầu nghiệp vụ mới về lịch sử Office Online, implement nguồn sự thật end-to-end và backfill theo
event/metadata đáng tin cậy. Không suy ra quyền nghiệp vụ từ field API tùy chọn.

---

### DC-XF-76 — P0: Replace/upload Revision source có thể xóa file cũ trước khi transaction DB commit

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3443-3479, 4459-4496, 5540-5563`
- `eqms-backend/src/main/java/com/eqms/service/FileStorageService.java:444-489`
- `eqms-backend/src/main/java/com/eqms/service/MinioObjectStorageService.java:197-210`

**Cơ chế đã trace**

`uploadRevisionFile()` là một DB transaction. `storeRevisionFile()` ghi object mới, thay path/checksum trên
entity rồi **ngay lập tức** gọi `deleteReplacedStoredFile(previousFilePath, ...)` trước khi save history/audit và
trước commit. Với local/NAS, file cũ bị xóa vật lý. Nếu save/history/audit/flush sau đó fail, DB rollback về path
cũ nhưng file cũ đã mất. Với MinIO, code chủ động không xóa bản cũ do WORM, nhưng object mới đã ghi không thể
rollback và trở thành orphan nếu transaction thua. `deleteInvalidStoredFile()` cũng chỉ log WARN khi MinIO từ
chối delete, nên object bị reject vẫn tồn tại không có reconciliation record.

**Hậu quả thực tế**

Replace source có thể biến một rollback DB bình thường thành mất file/record trỏ tới file không tồn tại trên
local/NAS; trên MinIO tạo version mồ côi không có lineage. Đây là biến thể tổng quát ở endpoint upload đơn, độc
lập với rollback batch workspace đã ghi tại DC-XF-42.

**Khuyến nghị**

Không delete/promote file trong transaction DB. Ghi staging object với operation ID/checksum, commit metadata,
sau commit mới finalize và schedule cleanup bản cũ; mọi failure phải có durable reconciliation. Với WORM,
“orphan” phải là record có trạng thái/evidence và retention, không phải object không ai biết tới.

---

### DC-XF-77 — P0: Replace source khi Office Online đang mở tạo split-brain và có thể ghi đè mất source mới

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/SecureFileAccessService.java:236-295`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3443-3479, 4459-4496`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3702-3720, 4201-4278`

**Cơ chế đã trace**

Author được upload/replace khi Revision còn Draft, chưa locked/completed. Upload cập nhật source MinIO nhưng
không revoke/reset `storageItemId`, `storageDriveId`, edit/view URLs hoặc permission của working copy Graph.
Lần gọi Sync to Office tiếp theo thấy `storageItemId` có sẵn và return ngay, không đẩy source mới lên Graph.
Khi Complete Editing/Sync From Office chạy, hệ thống download working copy cũ từ Graph và ghi thành một source
MinIO version mới, rồi cập nhật Revision trỏ sang nó. Không có base checksum/version comparison giữa hai nhánh.

**Hậu quả thực tế**

MinIO và Word Online cùng đại diện “source hiện hành” nhưng chứa hai nội dung khác nhau. File mới vừa upload có
thể bị âm thầm ghi đè về nội dung cũ từ Graph; hoặc user tiếp tục sửa một working copy không bắt đầu từ source
mới. Audit từng thao tác đều hợp lệ riêng lẻ nhưng không thể hiện lost update.

**Khuyến nghị**

Chỉ có một source authority tại một thời điểm. Replace phải bị chặn khi Graph session/working item còn active,
hoặc thực hiện command đóng/revoke + upload version mới với expected base checksum/eTag. Sync-back phải CAS
trên source version mà Office session đã mở; mismatch bắt buộc conflict/reconcile, không last-write-wins.

---

### DC-XF-78 — P0: Complete Editing tải Graph trước rồi mới revoke, nên save muộn có thể bị loại khỏi bản ký

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:727-755`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:4098-4160, 4201-4251`
- `eqms-backend/src/main/java/com/eqms/service/MicrosoftGraphOfficeOnlineService.java:1034-1055`

**Cơ chế đã trace**

`completeEditing()` gọi `syncEditedFileFromOfficeOnlineToMinio()` trước, rồi mới gọi
`lockOfficeOnlineEditing()`. Download Graph chỉ GET bytes; không checkout/lock item, không đọc/lưu eTag và
không dùng conditional request. Trong khoảng từ lúc GET hoàn tất đến lúc permission được revoke, một Author/
Co-Author đang mở Word Online vẫn có thể save phiên bản mới. Revision sau đó bị `sourceLocked=true`,
`editingStatus=COMPLETED` và ghi chữ ký PREPARED cho bytes đã tải trước lần save cuối đó.

**Hậu quả thực tế**

Người dùng có thể thấy Word Online báo save thành công nhưng thay đổi cuối không thuộc source MinIO/review PDF
đã khóa và ký. Ngược lại, file Graph chứa nội dung mới hơn hồ sơ EQMS mà audit không phát hiện.

**Khuyến nghị**

Thiết kế close protocol: ngăn edit mới/đặt item lock trước, chờ/coalesce save, đọc content + eTag, revoke mọi
grant, đọc/xác nhận lại eTag rồi mới commit checksum và signature. Nếu eTag đổi trong cửa sổ, retry hoặc báo
conflict; không ký khi chưa chứng minh snapshot ổn định.

---

### DC-XF-79 — P0: Cấu hình đang chạy tạo edit link phạm vi toàn organization, bypass participant authorization

**Vị trí chính**

- `eqms-backend/src/main/resources/application.properties:158`
- `eqms-backend/src/main/java/com/eqms/service/OfficeOnlineConfigurationService.java:167-180, 204-209`
- `eqms-backend/src/main/java/com/eqms/service/MicrosoftGraphOfficeOnlineService.java:320-370, 540-557`
- `eqms/src/features/settings/configuration/tabs/DocumentTab.tsx:722-738`

**Cơ chế đã trace**

Environment default là `organization`; backend chấp nhận cả `users` và `organization`. Mỗi upload tạo cả
`edit` và `view` link bằng scope này. FE vừa tuyên bố “access is granted to named users only” nhưng ngay bên
dưới vẫn cho chọn “People in the organization”. Read-only query DB đang chạy xác nhận effective scope hiện
tại là `organization`, không chỉ là default chưa dùng.

**Hậu quả thực tế**

Bất kỳ người trong Microsoft 365 organization có link edit đều có thể mở/sửa working copy dù không phải Author,
Co-Author, Reviewer hay Approver và không có permission EQMS. EQMS không thấy actor qua controller/policy của
mình; link bị forward/chat/log leak sẽ mở rộng quyền ngoài object authorization.

**Khuyến nghị**

Đối với controlled revision, cấm `organization`/anonymous ở backend, migration cấu hình về `users`, grant direct
permission theo immutable participant assignment và maintain access ledger. Quét/revoke các organization links
đã tạo; UI không được hiển thị cam kết named-only trong khi vẫn cho lưu lựa chọn trái cam kết.

---

### DC-XF-80 — P0: Checksum PDF đã lưu nhưng không được verify khi preview/download/distribute

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/FileStorageService.java:448-456`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:372-383, 490-500`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3587-3618`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:560-602, 2678-2694, 3835-3902, 4107-4113`

**Cơ chế đã trace**

`FileStorageService.readFile(path, expectedSha256)` có verify checksum, nhưng các đường Publishing preview,
Revision review/published preview, nguồn tạo Controlled Copy, Controlled Copy preview/download/page render và
batch ZIP đều gọi overload chỉ có `path`. `publishing_preview_checksum`, `published_pdf_checksum` và
`controlled_copy_checksum` đã được lưu; snapshot DB hiện tại cũng xác nhận không thiếu checksum ở record có
path, nhưng runtime không truyền chúng vào verify. Nếu Controlled Copy thiếu `controlledCopyFilePath`, helper
còn fallback sang `revision.previewFilePath` rồi `revision.filePath`, có thể phục vụ sai artefact hoặc cả DOCX
dưới tên/content-type PDF thay vì fail-closed.

**Hậu quả thực tế**

File local/NAS bị sửa, object/reference sai hoặc corruption có thể được xem, tải, zip và tiếp tục phân phối mà
không tạo integrity incident. Checksum trong audit/DB trở thành dữ liệu trang trí; fallback che mất việc artefact
Controlled Copy riêng không tồn tại.

**Khuyến nghị**

Mọi read regulated artefact phải resolve đúng immutable path + expected checksum/version rồi verify trước khi
trả bytes. Controlled Copy Distributed thiếu file/checksum phải chuyển sang integrity-failure/quarantine và alert,
không fallback parent. Ghi audit lỗi checksum với object version, không trả nội dung lỗi cho client.

---

### DC-XF-81 — P1: Graph chunk upload không retry/resume khi 429/5xx/session gián đoạn

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/MicrosoftGraphOfficeOnlineService.java:400-488`
- `eqms-backend/src/main/java/com/eqms/service/RevisionService.java:3702-3800`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceJobProcessorService.java:47-90`

**Cơ chế đã trace**

Uploader gửi từng chunk nhưng mọi response khác 200/201/202 lập tức throw; không đọc `Retry-After`, không retry
429/5xx, không query `nextExpectedRanges` và không persist upload URL/progress để resume. Circuit breaker chỉ
đếm failure/mở 30 giây, không hoàn thành operation. Synchronous Office upload trả lỗi toàn request; publishing
worker chỉ mark job Failed. Partial upload session/remote bytes không có ledger/reaper của EQMS.

**Hậu quả thực tế**

Throttling hoặc gián đoạn ngắn giữa file lớn làm mất toàn bộ tiến độ và buộc người dùng/job chạy lại từ đầu;
dưới tải cao retry thủ công càng tăng Graph traffic. Partial session/item có thể tồn tại ngoài quan sát của DB.

**Khuyến nghị**

Retry bounded có jitter theo `Retry-After`, resume bằng `nextExpectedRanges`, persist operation/session state và
đặt deadline/idempotency rõ ràng. Hết hạn session phải tạo session mới từ expected source checksum; có metric,
reconciliation và cleanup cho partial conversion/upload item.

---

### DC-XF-82 — P1: Publishing Template Component cố ý bỏ checksum dù storage đã tính và DB có cột lưu

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/PublishingTemplateService.java:288-345, 775-819, 875-888`
- `eqms-backend/src/main/java/com/eqms/entity/PublishingTemplateComponent.java:42-43, 131-136`
- `eqms-backend/src/main/resources/db/migration/V134__add_publishing_template_component_layouts.sql:1-14`

**Cơ chế đã trace**

`storePublishingTemplateAsset()` trả `StorageWriteResult` có checksum, nhưng `updateTemplateComponent()` chỉ
truyền path/file name vào `upsertTemplateComponent()`. Helper này gọi rõ `component.setChecksum(null)` rồi
save. Response vẫn expose field checksum; clone component chỉ copy giá trị null. Read-only query DB đang chạy
xác nhận cả 3 component có object key hiện tại đều thiếu checksum.

**Hậu quả thực tế**

Không thể chứng minh cover/header/footer nào đúng byte đã inspect/approve, không phát hiện component bị thay
hoặc reference trỏ nhầm, và không thể bind official PDF/Controlled Copy về checksum template input. Component
version number chỉ là số DB, không thay thế content digest.

**Khuyến nghị**

Lưu `stored.checksum()` + provider/bucket/objectKey/versionId cho từng immutable component version; DB bắt
checksum NOT NULL khi có object. Mọi materialize/render phải verify checksum. Backfill chỉ từ bytes/version đang
được kiểm soát và ghi migration evidence; không tự gán checksum mới rồi coi là checksum lịch sử đã phê duyệt.

---

### DC-XF-83 — P0: Một signature JWT có thể replay để ký nhiều action/đối tượng độc lập trong 5 phút

**Trạng thái remediation (20/08/2026): Đã khắc phục replay giữa các request; còn hardening về binding
challenge theo action/entity là cải tiến kiến trúc.**

`SignatureTokenConsumptionService` hiện parse/kiểm tra ownership rồi ghi atomically nonce `sid` vào
`used_signature_tokens` (primary key). Dùng lại từ request/transaction khác nhận duplicate-key và bị từ chối;
test `SignatureTokenConsumptionServiceTest` đã xác nhận. Trong cùng transaction, cùng token chỉ được coi là
idempotent để một action đã ký có thể gọi `ElectronicSignatureService` mà không tự chặn chính nó.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/SignatureTokenConsumptionService.java:57-90`
- `eqms-backend/src/main/java/com/eqms/entity/UsedSignatureToken.java:18-48`
- `eqms-backend/src/main/resources/db/migration/V393__create_used_signature_tokens.sql:8-14`
- `eqms-backend/src/test/java/com/eqms/SignatureTokenConsumptionServiceTest.java:57-75`

**Cơ chế đã trace**

Trước remediation, mọi validator chỉ kiểm JWT, expiry và `userId`, không lưu challenge đã consume. Hiện
`requireAndConsume()` ghi nonce token vào bảng có primary key; duplicate nonce bị đổi thành
`UnauthorizedException`. Cơ chế dùng chung đã được gọi bởi Document, Revision, Controlled Copy và
`ElectronicSignatureService`.

**Hậu quả thực tế**

Replay sang request/hành động khác không còn thực hiện được. Token hiện chưa chứa action/entity/checksum/reason
hash; tuy nhiên single-use nonce bảo đảm nó chỉ có thể hoàn tất một business transaction đã xác thực.

**Khuyến nghị**

Giữ primary-key consume và cleanup/audit evidence. Nếu cần mức assurance cao hơn, thay JWT generic bằng signing
challenge một lần, server-side và atomic, bind `actorId + actionCode + entityType/entityId + expectedVersion +
artefact checksum/version + reason hash + expiresAt`. Causal child transitions theo GMP-D02 dùng cùng
`causalActionId`, không consume lại challenge và không biến thành các chữ ký người dùng độc lập.

---

### DC-XF-84 — P1: Async Publish trì hoãn kiểm chữ ký đến worker và mang raw token 5 phút trong memory queue

**Trạng thái remediation (20/08/2026): Đã khắc phục fail-fast ở thời điểm nhận lệnh; còn rủi ro queue-delay
và raw credential trong memory.**

`PublishingWorkspaceController.publish()` hiện gọi
`SignatureTokenConsumptionService.requireValidWithoutConsuming()` trước khi tạo job, nên JWT đã hết hạn,
sai owner hoặc đã consume bị trả lỗi trước `202 Accepted`. Worker vẫn là nơi consume một lần ngay trước publish;
vì vậy nếu queue đợi quá TTL thì job bị đánh FAILED thay vì publish không có chữ ký hợp lệ.

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/controller/PublishingWorkspaceController.java:88-97`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceJobService.java:33-59`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceJobProcessorService.java:47-90`
- `eqms-backend/src/main/java/com/eqms/service/PublishingWorkspaceService.java:272-303`
- `eqms-backend/src/main/java/com/eqms/config/AsyncConfig.java:40-48`
- `eqms-backend/src/main/java/com/eqms/entity/PublishingWorkspaceJob.java:17-67`
- `eqms-backend/src/main/resources/application.properties:72`

**Cơ chế đã trace**

Controller tạo/audit job `QUEUED`, chuyển toàn bộ `PublishingWorkspaceRequest` — gồm raw `signatureToken` — vào
`@Async`, rồi trả 202. Sau remediation, token được validate không-consume trước khi tạo job; worker vẫn consume
khi đi tới `revisionService.publishRevision(...)`. Executor có 2 core/4 max/queue 50; token hết hạn sau 5 phút.
Job DB không lưu immutable command/challenge, request, expected Revision version/checksum hoặc credential đã được
xác nhận. Vì vậy queue delay vẫn có thể làm token hợp lệ
lúc user bấm Publish trở thành expired trước khi worker chạy; process restart còn làm mất request/token trong
memory và để job treo như DC-XF-51.

**Hậu quả thực tế**

Publish có thể báo Accepted rồi Failed chỉ vì tải queue, dù user đã xác thực đúng; hành vi phụ thuộc latency chứ
không phụ thuộc nghiệp vụ. Ngược lại, kéo dài TTL để chữa triệu chứng sẽ làm cửa sổ replay DC-XF-83 lớn hơn. Job
không thể được recovery an toàn sau restart vì không có signed intent bền vững để chứng minh chính xác command
nào đã được người dùng phê chuẩn.

**Khuyến nghị**

Validate và consume one-time signing challenge ngay khi nhận command, trong transaction tạo durable job/outbox;
lưu signed intent bất biến gồm action/entity/expected version/checksum/reason/template/layout và causal ID, không
lưu raw password/JWT. Worker chỉ claim và thực thi intent đã ký, revalidate lifecycle/CAS trước side effect. Job
quá hạn/retry phải có policy riêng, không phụ thuộc TTL của bearer token trình duyệt.

---

### DC-XF-85 — P1: Controlled Copy Policy/Expiry Rule không có optimistic version nên signed update có thể bị mất

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/entity/ControlledCopyPolicySetting.java:13-90`
- `eqms-backend/src/main/java/com/eqms/entity/ControlledCopyExpiryLimit.java:23-74`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyPolicyService.java:58-83, 110-154`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyExpiryLimitService.java:80-91, 205-247`

**Cơ chế đã trace**

Hai entity cấu hình ảnh hưởng trực tiếp quyền download/print/watermark/recall/delivery và expiry đều không có
`@Version`. Save Policy đọc singleton, patch các section có trong request rồi save; Expiry update cũng read-modify-
write. Hai Admin có thể cùng đọc cùng baseline và cùng ký/lưu. Không có expected version/ETag trong API. Với
default JPA update và không có optimistic guard, commit sau có thể ghi đè giá trị commit trước; cả hai transaction
vẫn tạo electronic signature/audit “thành công”, nhưng final configuration không còn phản ánh một thay đổi đã ký.

**Hậu quả thực tế**

Ví dụ QA bật watermark trong khi DCO đổi delivery recipient: một save muộn có thể phục hồi watermark cũ hoặc
recipient cũ. Audit có hai thay đổi đã ký nhưng replay theo thứ tự không tái tạo được state cuối; Controlled Copy
sau đó được render/phân phối theo policy khác với điều Admin tin rằng đã được phê duyệt.

**Khuyến nghị**

Thêm version column/`@Version`, trả version trong DTO và bắt client gửi expected version; conflict trả 409 cùng
state mới để người dùng review/ký lại. Ưu tiên command theo section nhưng vẫn CAS trên aggregate version; signature
phải bind previous/new snapshot và expected version. Viết concurrency test hai update cùng baseline.

---

### DC-XF-86 — P1: Uniqueness của Expiry Duration Policy chỉ check trong Java, race tạo nhiều active rule cùng scope

**Vị trí chính**

- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyExpiryLimitService.java:146-184, 231-246`
- `eqms-backend/src/main/java/com/eqms/entity/ControlledCopyExpiryLimit.java:23-50`
- `eqms-backend/src/main/resources/db/migration/V196__add_controlled_copy_expiry_limits.sql:4-19`
- `eqms-backend/src/main/resources/db/migration/V197__merge_controlled_copy_expiry_policy.sql:6-10`
- `eqms-backend/src/main/java/com/eqms/repository/ControlledCopyExpiryLimitRepository.java:9-13`

**Cơ chế đã trace**

Create/update gọi `findAllByActiveTrue()` rồi scan trùng cặp `(documentTypeId, departmentId)` trong memory.
Schema chỉ có index riêng từng FK, không có unique/exclusion constraint cho scope active, kể cả Global Default
`(NULL,NULL)`. Hai transaction đồng thời có thể cùng không thấy row của nhau và cùng commit active rule trùng
scope. Resolver không báo cấu hình mơ hồ mà chọn rule có duration quy đổi xấp xỉ ngắn nhất; với `MONTHS` còn dùng
30 ngày để so thứ tự nhưng dùng calendar month khi tính ngày thật.

**Hậu quả thực tế**

Một scope có thể có nhiều policy “đang hiệu lực”; Controlled Copy âm thầm nhận duration ngắn nhất thay vì rule
Admin vừa phê duyệt. Global Default cũng không thật sự được DB bảo đảm là đúng một active system row. Sai lệch
chỉ xuất hiện khi request/distribute, khó đối chiếu với audit cấu hình và có thể làm bản copy hết hạn sớm ngoài ý
định.

**Khuyến nghị**

Chuẩn hóa nullable scope bằng generated/coalesced key hoặc partial expression unique index để DB bảo đảm đúng
một active rule mỗi `(documentType, department)` và đúng một Global Default system row. Lock/CAS khi activate;
resolver gặp duplicate phải fail/alert thay vì tự chọn minimum. So sánh duration bằng cùng calendar arithmetic
và mốc thời gian sẽ dùng để tính expiry, không dùng `MONTHS=30 days` xấp xỉ.

---

### DC-XF-87 — P1: `Print Once` bị consume và audit “Printed” trước khi biết người dùng có in thành công

**Vị trí chính**

- `eqms/src/features/documents/controlled-copies/ControlledCopyPreviewView.tsx:95-104`
- `eqms-backend/src/main/java/com/eqms/controller/ControlledCopyController.java:369-375`
- `eqms-backend/src/main/java/com/eqms/service/ControlledCopyService.java:617-629`
- `eqms-backend/src/main/java/com/eqms/repository/ControlledCopyRepository.java:22-24`

**Cơ chế đã trace**

FE gọi POST `/preview/print`; backend atomic tăng `printCount` (và với `printOnce=true` chặn mọi lần tiếp theo),
sau đó ghi audit `PRINT`/“Printed controlled copy preview” và trả 204. Chỉ sau khi nhận 204, FE mới gọi
`window.print()`. Browser print dialog không trả kết quả cho server; user có thể Cancel, popup có thể bị chặn hoặc
spooler/máy in có thể lỗi. Dù không có bản giấy nào được tạo, quota đã bị consume và audit khẳng định đã Printed.

**Hậu quả thực tế**

Recipient mất quyền in duy nhất do thao tác hủy/lỗi kỹ thuật và phải nhờ Admin can thiệp; hồ sơ GMP báo một bản
Controlled Copy đã được in dù thực tế chưa có. Ngược lại hệ thống không thể chứng minh số bản vật lý thực sự đã
ra máy in chỉ từ browser event hiện tại.

**Khuyến nghị**

Không gọi event hiện tại là “Printed”. Tách `PRINT_AUTHORIZED/PRINT_ATTEMPTED` khỏi xác nhận bản giấy. Với luồng
DCO, dùng server-generated print package/job và bước DCO xác nhận kết quả bằng e-signature/evidence; thất bại có
thể retry theo policy và không tăng số bản phát hành. Nếu vẫn dùng browser print, UI/SOP phải có bước confirm
sau dialog và cơ chế void/retry có audit, đồng thời thừa nhận không thể tự động chứng minh spool success.

---

### DC-XF-88 — P0: Flyway history lệch source nhưng local Docker tắt validation, tạo backend “healthy” giả và chặn GMP deploy/integration test

**Vị trí chính**

- `docker-compose.yml:170-173`
- `docker-compose.gmp.yml:46-50`
- `eqms-backend/src/main/resources/application.properties:52-56`
- `eqms-backend/src/main/resources/db/migration/V359__create_report_platform.sql:43-67`
- `eqms-backend/src/main/resources/db/migration/V360__complete_report_schedule_contract.sql:1-5`
- `eqms-backend/src/main/java/com/eqms/service/ReportPlatformService.java:275-287`
- `eqms-backend/src/main/java/com/eqms/service/ReportJobWorker.java:15-20`
- `eqms-backend/src/test/java/com/eqms/ControlledCopyBatchDiscrepancyScannerIntegrationTest.java:30`
- `eqms-backend/src/test/java/com/eqms/ControlledCopyListAuthorizationIntegrationTest.java:36`
- `eqms-backend/src/test/java/com/eqms/UpgradeRevisionIntegrationTest.java:28`

**Cơ chế đã trace và xác nhận runtime**

DB đang ghi Flyway V359 checksum `-192239513`, trong khi source hiện resolve thành `1456914028`; DB còn ghi V364
đã apply thành công nhưng repository hiện không có file V364. Local compose chủ động đặt
`SPRING_FLYWAY_VALIDATE_ON_MIGRATE=false`, còn GMP overlay bật lại `true`. Vì validation bị tắt ở local, container
khởi động và được Docker báo `healthy` dù schema thật không có `report_runs.requested_format`; worker
`ReportJobWorker` chạy khoảng mỗi 1,5 giây và liên tục fail tại SQL `RETURNING r.requested_format`.

Khi chạy toàn bộ test suite với validation chuẩn, Spring context của các integration test Controlled Copy và
Upgrade Revision không thể start vì đúng hai lỗi history/source này. V359 trong source hiện khai báo
`report_runs.requested_format`, nhưng V360 chỉ bổ sung cột đó cho `report_schedules`; do V359 đã bị sửa sau khi
apply, DB cũ không có cách nhận phần schema mới. Đây là bằng chứng migration bất biến đã bị phá, không phải lỗi
cache test. Trong phép đo 10 phút, log container phát 397 exception cùng nguyên nhân trong khi `/api/health` vẫn
trả `UP`.

**Hậu quả thực tế**

- `docker compose up` local có thể báo backend healthy trong khi scheduled worker đang phát exception liên tục.
- GMP deployment bật validation sẽ fail startup trước khi phục vụ Document Control.
- Integration regression suite cho Controlled Copy/Upgrade hiện bị chặn, nên không thể dùng suite đầy đủ để
  chứng minh các race/invariant đã được sửa.
- Một database mới dựng từ source và database hiện tại có thể có schema khác nhau dù cùng số migration, làm hành
  vi FE–BE/API phụ thuộc môi trường và phá khả năng tái lập release GMP.

**Khuyến nghị**

Không chạy `flyway repair` để che checksum và không tiếp tục sửa migration đã apply. Khôi phục nguyên văn V359
và V364 từ release artifact/backup có thẩm quyền; tạo migration forward mới để thêm phần schema còn thiếu. Thử
toàn bộ quy trình trên clone của DB hiện tại, bật `validate-on-migrate=true` ở mọi profile CI/UAT/GMP và chỉ cho
health/readiness thành công sau khi Flyway + worker dependency check đạt. Sau đó chạy lại toàn bộ integration
suite Document Control trước khi chấp nhận release.

---

### DC-XF-89 — P0: Migration chain không dựng được database mới từ trắng vì V80 insert Document Relation với FK `NULL`

**Vị trí chính**

- `eqms-backend/src/main/resources/db/migration/V80__seed_document_relations_for_expanded_row.sql:17-29`
- `eqms-backend/src/main/resources/db/migration/V80__seed_document_relations_for_expanded_row.sql:31-199`
- `eqms-backend/src/main/resources/db/migration/V80__seed_document_relations_for_expanded_row.sql:202-228`
- `eqms-backend/src/test/java/com/eqms/ControlledCopyBatchDiscrepancyScannerIntegrationTest.java:30`
- `eqms-backend/src/test/java/com/eqms/ControlledCopyListAuthorizationIntegrationTest.java:36`
- `eqms-backend/src/test/java/com/eqms/UpgradeRevisionIntegrationTest.java:28`

**Cơ chế đã trace và reproduction động**

V80 dùng scalar subquery tìm document theo các số cố định như `SOP.0001` và `SPEC.0001`, rồi chỉ kiểm tra
`NOT EXISTS` relation. Trên database trắng, các document seed này chưa tồn tại ở thời điểm V80; scalar subquery
trả `NULL`, còn `NOT EXISTS` vẫn là true vì phép so sánh với `NULL` không match row nào. Statement vì vậy cố
insert `(source_document_id=NULL,target_document_id=NULL)` vào `document_relations` và PostgreSQL từ chối do
hai cột `NOT NULL`.

Reproduction được chạy trên database tạm riêng: Flyway apply thành công đến V79, sau đó V80 fail SQLSTATE
`23502` ngay statement dòng 19. Không chỉnh migration hoặc seed để tạo ra kết quả này. Database hiện tại không
bộc lộ lỗi vì lịch sử của nó đã đi qua một trạng thái/nguồn migration khác, tiếp tục chứng minh database hiện tại
và source repository không tái lập cùng một release.

**Hậu quả thực tế**

- Không thể bootstrap môi trường developer/UAT/GMP/DR mới từ repository hiện tại.
- Restore disaster recovery phụ thuộc một full DB backup cũ; migration source riêng lẻ không đủ tái dựng hệ thống.
- CI integration test dùng database trắng luôn dừng ở V80, nên các migration và invariant Document Control sau
  V80 chưa bao giờ được kiểm chứng theo đường fresh install.
- Seed dữ liệu demo được trộn vào migration schema production và phụ thuộc thứ tự/record tùy môi trường, tạo
  khác biệt khó kiểm soát giữa fresh install và upgrade install.

**Khuyến nghị**

Không sửa trực tiếp V80 trên environment đã apply nếu vẫn cần bảo toàn checksum. Khôi phục authoritative V80 theo
release history; với fresh-install baseline mới, chuyển seed demo sang profile/dev fixture riêng hoặc viết insert
theo `JOIN`/CTE chỉ tạo relation khi **cả hai** document tồn tại. Tạo CI bắt buộc chạy hai đường: migrate database
trắng đến latest và migrate clone của release N-1 đến latest; so sánh schema/invariant cuối cùng trước release.

---

## Quyết định nghiệp vụ/GMP

| Mã | Quyết định/trạng thái | Diễn giải |
|---|---|---|
| GMP-D01 | **ĐÃ CHỐT:** Khi Document/Revision Obsolete, Controlled Copy đang `READY_FOR_DISTRIBUTION` phải chuyển thành `OBSOLETED`. | Không chỉ ẩn nút hoặc cấm Distribute; phải thực hiện lifecycle transition, giữ audit và nguyên nhân parent tương ứng. |
| GMP-D02 | **ĐÃ CHỐT:** Chỉ ký action Publish/Document Obsolete một lần. Mọi Revision/Controlled Copy tự động bị Obsolete phải liên kết tới cùng `signatureSessionId`/causal action ID của action gốc; không yêu cầu người dùng ký lại từng record. | Bảo đảm truy vết đầy đủ nhưng không biến hậu quả tự động thành nhiều hành động ký độc lập. |
| GMP-D03 | **ĐÃ CHỐT:** `OBSOLETED` là terminal immutable. Không cho Recall lại và không được ghi đè `obsoleteReason`, actor hoặc timestamp của nguyên nhân terminal. | Nếu sau đó thu hồi/tìm thấy bản giấy, chỉ ghi event/evidence bổ sung, không thay lifecycle state hoặc nguyên nhân gốc. |
| GMP-D04 | **ĐÃ CHỐT:** Document bắt đầu `DRAFT`; ngay khi upload Revision đầu tiên thành công, Document chuyển `ACTIVE`. `ACTIVE` không đồng nghĩa Revision đã `EFFECTIVE`. | KPI “Effective Documents” không được hiểu là đếm `Document.status=ACTIVE`; phải định nghĩa/query dựa trên Revision Effective nếu KPI thực sự nói về hiệu lực. |
| GMP-D05 | **ĐÃ CHỐT:** Recall/Obsolete/Cancel phải ngắt quyền preview/download/print ngay lập tức. | Mọi request dùng grant cũ phải kiểm tra lại lifecycle; không chấp nhận cửa sổ 15 phút hiện tại. |
| GMP-D06 | **ĐÃ CHỐT:** Thời hạn Controlled Copy bắt đầu từ thời điểm `DISTRIBUTED`, không phải thời điểm Request; duration lấy từ cấu hình **Expiry Duration Policy** trong Controlled Copies Policy do Admin quản lý. | Request/Ready chưa bắt đầu tiêu hao thời hạn. Khi Distribute thành công mới resolve policy áp dụng, lưu version/duration đã dùng để audit và tính expiry. |
| GMP-D07 | **ĐÃ CHỐT:** Expiry Controlled Copy không được muộn hơn `Revision.validUntil`. | Expiry thực tế là giá trị sớm hơn giữa `distributedAt + configured duration` và cuối ngày nghiệp vụ của `revision.validUntil`; không Controlled Copy nào được tồn tại lâu hơn Revision nguồn. |
| GMP-D08 | **ĐÃ CHỐT:** DCO được phép chọn Executor và Witness rồi dùng chữ ký điện tử của chính DCO để ghi nhận thay việc tiêu hủy bản giấy. | Audit/signature phải xác định DCO là `recordedBy`/người chịu trách nhiệm ghi nhận; Executor và Witness là người tham gia được khai báo, không được trình bày như họ đã ký. Hai người phải khác nhau và lưu bằng định danh user ổn định. |
| GMP-D09 | **ĐÃ CHỐT:** Knowledge Base được xem theo Department của user. | User trong một Department được xem toàn bộ folder và Document Effective của chính Department đó, nhưng không được enumerate hoặc xem folder/tài liệu của Department khác. |

### Diễn giải các quyết định cần lưu ý khi triển khai

**GMP-D03 — Recall một copy đã Obsoleted:** ví dụ copy đang Distributed được báo Lost/Damaged nên đã
chuyển `OBSOLETED` với nguyên nhân `LOST_DAMAGED`. Sau đó người dùng bấm Recall Batch chứa copy đó.
Code hiện tại đổi nguyên nhân thành `RECALLED`, làm mất căn nguyên Lost/Damaged. Quy tắc đã chốt là
`OBSOLETED` bất biến: nếu sau này thu hồi/tìm thấy bản giấy, chỉ ghi event/evidence bổ sung và không đổi
status, `obsoleteReason`, terminal actor hoặc terminal timestamp.

**GMP-D02 — chữ ký của hậu quả tự động:** ví dụ DCO ký một lần để Publish Revision B. Hệ thống tự
động làm Revision A và các Controlled Copy của A thành Obsoleted. Quy tắc đã chốt là chỉ ký action
Publish một lần; mọi history/audit auto-obsolete của A và Controlled Copy phải lưu cùng
`signatureSessionId`/causal action ID để chứng minh chúng là hậu quả của chữ ký đó.

**GMP-D06/D07 — mốc và trần expiry:** việc Request hoặc chuyển sang Ready không khởi động đồng hồ
expiry. Với mỗi Controlled Copy được phân phối thành công, backend lấy duration từ Expiry Duration
Policy do Admin cấu hình, lưu lại policy/version/duration đã áp dụng và lấy mốc `distributedAt` làm
điểm bắt đầu. `expiresAt` phải là giá trị sớm hơn giữa `distributedAt + duration` và cuối ngày nghiệp
vụ của `Revision.validUntil`. FE không tự tính công thức này và Controlled Copy không được tồn tại
lâu hơn Revision nguồn.

### Quyết định bổ sung về người ghi nhận tiêu hủy

**GMP-D08 — DCO ký để ghi nhận thay Executor và Witness**

- FE bắt buộc chọn một Executor và một Supervisor/Witness khác nhau:
  `DestroyControlledCopyView.tsx:262-282, 324-331, 550-580`.
- Backend cho DCO đang đăng nhập chọn `destroyedByUserId` và `witnessedByUserId` là hai user bất kỳ,
  nhưng chỉ xác thực `signatureToken` của **DCO đang thao tác**. Record lưu Executor được chọn ở
  `destroyedBy`, witness chỉ là chuỗi tên; electronic signature và audit lại thuộc current user:
  `ControlledCopyService.java:1424, 1438-1460`.

Product Owner đã chốt mô hình thứ nhất: DCO được phép ghi nhận thay và chỉ cần signature session của
DCO. Khi triển khai cần lưu tách rõ `recordedBy` (DCO ký/nhập), `executedBy` và `witnessedBy`, cùng
`occurredAt`, `recordedAt`, evidence và lý do late entry nếu có. Executor/Witness phải là hai user khác
nhau, lưu bằng UUID thay vì chỉ giữ tên. UI, audit export và Signatures tab phải ghi rõ **Recorded by
DCO on behalf of**; tuyệt đối không gắn nhãn hoặc tạo cảm giác Executor/Witness đã ký điện tử.

## Các điểm đã kiểm tra và không thấy lỗi tương ứng trong source hiện tại

- Document Cancel hiện chặn nếu Document đã có bất kỳ Revision nào:
  `DocumentService.java:1596-1600`.
- Document Obsolete hiện yêu cầu Document Active, có ít nhất một Revision Effective và không có
  Revision đang xử lý: `DocumentService.java:1638-1653`.
- Document Obsolete hiện ghi history/audit có signature reference cho từng Revision bị ảnh hưởng qua
  `RevisionService.obsoleteRevisionAsPartOfDocumentObsolete(...)`:
  `DocumentService.java:1692-1700`, `RevisionService.java:4326-4414`.
- Distribution async đã có `SKIPPED_TERMINAL` để tránh restore copy terminal về Ready:
  `ControlledCopyService.java:1197-1320`,
  `ControlledCopyBatchDistributionAsyncService.java:66-81,153-181`.
- New Document screen không còn đọc các field ảo `canCancel/canObsolete/canStartInitialAuthoring`
  từ `DocumentDetailResponse`; nó gọi resource capability endpoint:
  `NewDocumentView.tsx:929-950`.
- Revision source upload/sync-back hiện có validation OOXML sâu: giới hạn size/entry/uncompressed bytes,
  required parts, XML an toàn, macro/ActiveX/embedding và malware:
  `RevisionUploadFileValidator.java:51-317`. Lỗi DC-XF-72 chỉ nằm ở Publishing Template upload không
  dùng cùng mức bảo vệ này.
- Publishing Template preview hiện render từ component/style hiện hành mỗi lần; không tìm thấy cache disk
  cũ được tái dùng trong `PublishingTemplatePreviewService.java:77-105`. Rủi ro stale đã xác nhận nằm ở
  immutable lineage/live template (DC-XF-37), snapshot fail-open (DC-XF-41) và Graph same-name reuse
  (DC-XF-71), không phải preview-cache riêng của service này.
- `ReportPlatformService` có dùng PDFBox để tạo artefact report và storage chung, nhưng không parse hay
  compose source/template Document Control; không tìm thấy thêm một dependency giao vòng đời
  Document/Revision/Controlled Copy riêng trong service này.

## Thứ tự khắc phục đề xuất

- **Release gate — DC-XF-88 và DC-XF-89:** khôi phục authoritative V359/V364, tạo forward migration cho schema
  thiếu, đồng thời sửa V80 để migration từ database trắng không tạo relation với FK `NULL`. Bật Flyway validation
  ở CI/UAT/local verification và bắt buộc test cả fresh-install lẫn upgrade-clone. Không chạy `repair` để hợp thức
  hóa checksum; chưa được build/deploy GMP hoặc tuyên bố integration suite đạt khi cả hai đường migration chưa
  tái lập được.

1. **DC-XF-56, DC-XF-57, DC-XF-58 và DC-XF-80:** hợp nhất command Publish; bắt buộc tạo official PDF trước
   Effective, phân phối đúng immutable published artefact, verify checksum ở mọi read và bind mọi chữ ký vào
   đúng PDF checksum/version.
2. **DC-XF-83 và DC-XF-84:** thay signature bearer token replayable bằng one-time challenge bind action/entity/
   version/checksum/reason; consume ở command acceptance và lưu durable signed intent cho worker async.
3. **DC-XF-39:** đóng đường đọc/download file còn bypass permission/object scope; endpoint Published
   tuyệt đối không fallback sang source Draft. **DC-XF-45** đã được đóng ở source và còn cần bằng chứng
   API/integration cho phân quyền object scope.
4. **DC-XF-42 và DC-XF-76:** tách DB transaction khỏi external storage bằng
   staging/finalize-after-commit; không cleanup artefact có trước khi batch/request bắt đầu.
5. **DC-XF-49, DC-XF-50, DC-XF-37, DC-XF-64 và DC-XF-82:** workspace không được mutate template global; chỉ
   chọn Active immutable version, giữ đúng lựa chọn No Template, khóa checksum/template version đã
   preview và cấm hard-delete mọi template/component từng được dùng.
6. **DC-XF-31 và DC-XF-37:** không được đánh dấu Distributed khi render thất bại; khóa đúng immutable
   Publishing Template Version của Revision trước khi tạo bất kỳ artefact Controlled Copy nào.
7. **DC-XF-01, DC-XF-02 và DC-XF-12:** chặn phát hành/resurrection của Controlled Copy và cửa sổ
   Cancel Batch; viết integration tests trước khi refactor.
8. **DC-XF-32, DC-XF-17, DC-XF-77 đến DC-XF-79 và DC-XF-81:** chỉ một source authority, close Graph
   bằng eTag/CAS trước khi ký, cấm organization edit link, thu hồi quyền Office Online và preview/download/
   print grant ngay khi workflow chuyển bước hoặc parent/copy terminal; lỗi revoke/upload phải retry và không
   được audit giả thành công.
9. **DC-XF-18 và DC-XF-19:** chặn Reopen ngầm; hợp nhất invariant Create/Upload/Publish và chỉ
   Activate Document sau source upload đầu tiên thành công.
10. **DC-XF-24, DC-XF-36 và DC-XF-40:** khôi phục credential preview đúng chuẩn, bỏ authorization theo
   full name và tách đúng quyền file/evidence,
   rồi test end-to-end email → portal bằng UUID người nhận.
11. **DC-XF-13, DC-XF-35 và DC-XF-52:** serialize parent lifecycle/cấp số với Request/Replacement;
   đưa việc publish file
   ra mô hình staging/finalize-after-commit có cleanup, object key bất biến và checksum/version rõ ràng.
12. **DC-XF-20, DC-XF-21, DC-XF-25, DC-XF-26, DC-XF-28, DC-XF-29 và DC-XF-51:** thiết kế lại
   lifecycle/job/outbox của
   batch để Retry hoạt động, worker restart-safe, notification chỉ gửi sau thành công và số liệu
   Success/Failed/Skipped chính xác; mọi holder nhận đúng sự kiện invalidation.
13. **DC-XF-41 và DC-XF-43:** snapshot phải fail-closed/checksum-bound; Related Document phải resolve
   Effective hiện hành thay vì latest-created.
14. **DC-XF-04, DC-XF-05, DC-XF-06:** chuẩn hóa terminal guard và outcome cho Cancel/Recall async;
   thêm optimistic lock cho Batch.
15. **DC-XF-22, DC-XF-23 và DC-XF-33:** idempotency/unique replacement, server-owned timestamps và
   chuẩn hóa expiry theo GMP-D06/D07 đã chốt.
16. **DC-XF-34, DC-XF-48 và DC-XF-54:** hoàn thiện append-only evidence/destruction/witness theo
   GMP-D08; BE bắt stable actor IDs và mọi cấu hình ảnh hưởng output phải có signature/audit.
17. **DC-XF-85 và DC-XF-86:** thêm optimistic version/CAS cho policy đã ký và DB uniqueness cho từng active
    expiry scope; conflict bắt review/ký lại, resolver không được âm thầm chọn một duplicate rule.
18. **DC-XF-87:** tách print authorization/attempt khỏi xác nhận bản giấy; `Print Once` không được mất quota và
    ghi audit “Printed” chỉ vì browser chuẩn bị mở dialog.
19. **DC-XF-55:** bảo đảm expiry catch-up không phụ thuộc một lần lấy Redis lock; alert khi overdue chưa
    được transition/audit/notify.
20. **DC-XF-59 đến DC-XF-62:** hợp nhất Upgrade command/session, cycle key theo Effective source, lưu
    reason/impact có audit và luôn snapshot đúng Revision nguồn.
21. **DC-XF-44:** bỏ write vào aggregate lifecycle từ GET detail; tách view telemetry khỏi `@Version`.
22. **DC-XF-46 và DC-XF-47:** sửa contract batch multipart và hợp nhất relation rows/cờ dẫn xuất.
23. **DC-XF-14, DC-XF-15:** hợp nhất batch derive và loại bỏ silent write khỏi API đọc.
24. **DC-XF-03:** bỏ mutation `currentStage` trong Print và làm migration/backfill dữ liệu lệch.
25. **DC-XF-07 và DC-XF-27:** bổ sung liên kết e-signature/causal action nhất quán theo GMP-D02.
26. **DC-XF-65:** khóa bất biến Electronic Signature ở DB và mô hình hóa revoke bằng append-only event,
    không UPDATE/DELETE chữ ký gốc.
27. **DC-XF-67:** hợp nhất sanitizer CSV dùng chung và neutralize spreadsheet formula ở mọi text cell.
28. **DC-XF-68:** áp department scope bằng stable Department ID ở cả ba Knowledge Base endpoint và chặn
    IDOR qua `{departmentId}`.
29. **DC-XF-71, DC-XF-77 và DC-XF-78:** tách Graph side effect khỏi transaction bằng
    saga/outbox/reconciliation; bind remote item/session với operation ID + source checksum/eTag, không reuse
    theo filename, không cho MinIO/Graph split-brain và revoke orphan permission có retry.
30. **DC-XF-72 và DC-XF-73:** dùng validator OOXML sâu cho Publishing Template và fail-closed khi
    image/style/component đã cấu hình không render đúng; official PDF không được silently degraded.
31. **DC-XF-74 và DC-XF-51:** domain idempotency + unique active job/Revision, worker lease/version và recovery
    cho queue rejection/restart; external artefact chỉ finalize sau CAS thành công.
32. **DC-XF-69 và DC-XF-70:** quản lý vòng đời temp resource theo scope và bỏ network bucket setup khỏi
    critical section của từng upload; load-test disk/heap/MinIO latency.
33. **DC-XF-75:** bỏ hoặc implement đầy đủ `office_online_ever_synced`; capability backend là nguồn thật.
34. **DC-XF-08 đến DC-XF-11, DC-XF-16, DC-XF-30, DC-XF-38, DC-XF-53, DC-XF-63 và DC-XF-66:** dọn
    policy/API/helper/schema
    chết, giới hạn query hoặc chọn và hoàn thiện một pipeline duy nhất thay vì duy trì code drift.

## Test tối thiểu bắt buộc sau khi sửa

1. Single and batch distribute sau khi parent Revision/Document chuyển `OBSOLETED` → phải bị chặn.
2. Batch gồm Ready + Closed-Cancelled/Obsoleted → distribute/cancel/recall không được thay trạng thái
   terminal hoặc lý do terminal.
3. Race: distribute async, recall async, cancel async và Document Obsolete chạy xen kẽ → child state,
   batch state, job item và audit cuối cùng phải nhất quán.
4. Print copy Distributed → cả `statusCode` lẫn response stage vẫn Distributed.
5. Publish successor → Revision superseded + Controlled Copy auto-obsoleted có audit reference liên
   kết đúng cùng action/signature Publish theo GMP-D02; không yêu cầu chữ ký riêng từng child.
6. Mỗi endpoint preview/download Document, Revision, Published PDF, Controlled Copy và Evidence → deny
   khi chỉ có object-view nhưng thiếu đúng file-action permission; Document download không bao giờ trả Draft source.
7. Revision Workspace batch `[itemA không file, itemB=fileB]` → fileB chỉ gắn itemB; rollback item sau
   không xóa source/preview có trước của itemA/itemB.
8. Publishing Workspace bằng template Active A → chỉnh ranges ở Revision X không thay entity/template
   global; user bị deny object-level Publish không tạo bất kỳ write nào.
9. Chọn template Inactive phải bị deny; chọn “No Template” phải thật sự không dùng template fallback.
10. Snapshot generation fail/empty/stale → Submit/Regenerate fail-closed, không ghi audit success và
    không cho Review/Approve artefact cũ.
11. Related Document có Effective R1 + Draft R2 → Publish relation vẫn xác định R1 là Effective.
12. F5 detail đồng thời Publish/Cancel/Obsolete → GET không tăng aggregate version và không làm action fail.
13. Hai request Create Revision/Controlled Copy đồng thời → cấp số duy nhất, không constraint 500 và
    không để lại object storage mồ côi.
14. Gọi trực tiếp API Lost/Damaged với executor/witness null, trùng nhau hoặc UUID không tồn tại → 4xx;
    record hợp lệ lưu hai stable IDs và DCO signature actor riêng.
15. Reset workflow policy → capability endpoint và mutation endpoint cho Recall có cùng kết quả ở mọi
   status được cấu hình.
16. Cancel Batch commit nhưng worker bị pause → Distribute single phải bị chặn; sau khi worker chạy,
   batch và mọi child phải cùng terminal.
17. Một batch có nhiều expiry date → hết hạn một child không được làm batch Obsoleted khi còn child
   Distributed.
18. Gọi API list batch không được phát sinh `UPDATE` hoặc audit-less lifecycle mutation.
19. Race Request/Replacement với Document Obsolete/Publish successor → không được commit child Ready
    thuộc parent đã đóng.
20. Mở preview, sau đó Recall/Obsolete/Cancel trong session khác → grant cũ phải bị từ chối theo SLA
    được chốt ở GMP-D05.
21. Gọi cả hai endpoint create Revision trên Document `OBSOLETED`/`CLOSED_CANCELLED`, sau đó thử
    Publish → không endpoint nào được tạo hoặc tái Active parent.
22. Save workspace/POST create Revision không file → Document vẫn Draft; upload thành công → Active;
    upload fail/virus → cả status DB và file storage không có artefact mồ côi.
23. Tạo failure cho Distribution/Recall/Cancel job → Retry phải chạy đúng failed item; restart backend
    khi item đang Processing → stale job được reclaim và kết thúc idempotent.
24. Hai request replacement song song cho cùng source Lost/Damaged → chỉ một replacement commit.
25. Request để Ready qua expiry và replacement source đã expired → child/batch phải về terminal đúng,
    không nằm Ready vô hạn; UI phải hiển thị cùng expiry policy backend áp dụng.
26. Phân phối copy mới → email có password một lần, DB chỉ có BCrypt hash, open preview thành công;
    sai password/Recall/expiry bị chặn.
27. Force lỗi ở copy N hoặc lúc create job sau khi chuẩn bị email → không email/link nào được gửi trước
    commit/finalization; outbox chỉ dispatch item Success.
28. Cancel Revision cuối → audit Document auto-close phải tham chiếu đúng cùng signature session.
29. Publish successor/Obsolete Document/Recall → holder nội bộ và external recipient đều nhận đúng
    notification sau commit; delivery lỗi được lưu để retry, không làm sai lifecycle transaction.
30. Cố ý làm placeholder composer/ghi file thất bại ở single và batch distribute → copy vẫn Ready,
    item/job Failed, không có email/link và không có audit “Distributed” giả.
31. Publish Revision bằng Publishing Template version 1; sau đó sửa template/component live thành version
    2 rồi distribute copy của Revision cũ → artefact phải vẫn dùng đúng version 1 và checksum đã phê duyệt.
32. Reviewer/Approver mở Office Online; Complete/Reject/Publish/Cancel/Document Obsolete xen kẽ với lỗi
    Microsoft Graph → quyền cũ không còn dùng được; lỗi revoke tạo trạng thái/retry rõ ràng, không audit
    `access-revoked` khi Graph chưa revoke.
33. Gửi timestamp invalid, tương lai và lùi trước lifecycle predecessor cho Distribute/Print/Recall/
    Destroy/Document Obsolete → API trả 400 hoặc yêu cầu late-entry reason theo SOP; không silent dùng `now`.
34. Controlled Copy đã Obsoleted → append destruction/evidence/witness confirmation nhiều lần → status,
    terminal reason/actor/time không đổi; event mới có DCO `recordedBy`, Executor/Witness UUID khác nhau,
    occurredAt, recordedAt, checksum và chỉ signature của DCO; UI không hiển thị hai người kia là signer.
35. Ép DB rollback sau khi Request/Replacement/Distribute đã ghi object → không để artefact mồ côi;
    distribute lại trên local/NAS không được ghi đè object version cũ.
36. Tạo hai user khác UUID nhưng cùng `fullName`, gán copy cho user A → user B không được list/view/download.
37. Chọn dứt khoát snapshot sync hoặc async: pipeline được chọn phải có test producer/consumer/restart;
    pipeline bị bỏ phải xóa field, event, consumer và migration semantics sau backfill.
38. Từ cả Revision List, Revision Detail và Document Detail bấm Publish → chỉ một backend command chạy;
    Revision không thể Effective nếu `publishedPdfPath/checksum/versionId` chưa tồn tại và verify đúng.
39. Tạo Controlled Copy từ Revision đã publish có preview khác official PDF → source checksum/version của
    copy phải trùng official Published PDF, tuyệt đối không trùng review preview.
40. Review/Approve/Publish → mỗi Electronic Signature lưu đúng review/published PDF checksum và version
    mà signer đã xem; thay template/range sau ký phải làm checksum mismatch và chặn transition.
41. Redis unavailable đúng thời điểm scheduler → durable fallback/catch-up vẫn obsolete toàn bộ overdue,
    ghi audit/notification một lần và phát health alert.
42. Hoàn thành Upgrade Session cycle 1, publish Revision mới rồi tạo cycle 2 → session ID/source payload
    mới; session Completed cũ immutable và không được reuse.
43. Continue Upgrade với reason và related selection → từng Revision/history/audit causal event lưu đúng
    reason, impact decision và actor/signature.
44. Gọi mọi direct/session Upgrade endpoint với cùng dữ liệu → hoặc cùng command/outcome, hoặc endpoint
    cũ trả Gone/Not Found; không có đường bỏ qua reason/impact.
45. R1 Effective → R2 Draft → Cancel R2 → Upgrade R1 → Draft mới phải snapshot từ R1, không mang field/
    participant/config đã bị hủy ở R2.
46. Publish Revision bằng template/component version 1 → thử delete template/component → API phải deny;
    retire vẫn giữ nguyên FK, version history, object bytes và khả năng tái tạo artefact lịch sử.
47. Sau khi tạo Electronic Signature, thử `UPDATE`, `DELETE` và `TRUNCATE` trực tiếp ở PostgreSQL → DB
    phải từ chối; revoke hợp lệ phải tạo append-only event mới và giữ nguyên checksum/actor/time bản gốc.
48. Sau khi quyết định bỏ PDF Review Comment, build/lint không còn wrapper/handler/state/banner chết; nếu
    quyết định khôi phục, toàn bộ CRUD/reply/attachment phải có contract test FE-BE và audit/retention đầy đủ.
49. Export Document/Revision/Controlled Copy với mọi text field lần lượt bắt đầu bằng `=`, `+`, `-`, `@`,
    tab, CR và whitespace trước ký tự đó → spreadsheet phải hiển thị literal text, không evaluate formula.
50. User Department A gọi cả ba Knowledge Base endpoint → chỉ thấy folder/tài liệu Effective của A; truyền
    trực tiếp `{departmentId}` của B phải 403/404 và không trả metadata/count. Rename Department không làm
    mất hoặc mở rộng phạm vi nhờ authorization dùng stable ID.
51. Chạy hàng nghìn vòng materialize/render/preview/publish với file lớn → temp directory/file count và heap
    không tăng tuyến tính sau mỗi request; crash/restart không để rác không có TTL/reaper.
52. Cho MinIO `bucketExists`/versioning/object-lock có latency cao rồi upload đồng thời → upload không bị
    serialize toàn instance; compliance vẫn được xác nhận và alert đúng khi cấu hình thay đổi.
53. Graph upload thành công rồi ép DB rollback → orphan item/grant được reconcile/revoke; sửa source MinIO
    giữ cùng filename rồi retry → remote checksum phải khớp source mới, không reuse bytes cũ.
54. Upload arbitrary ZIP, DOCX thiếu required parts, macro/ActiveX/embedding, ZIP bomb, XML bomb và file vượt
    size làm Publishing Template → fail 4xx trước storage/activation, không tăng heap/CPU ngoài giới hạn.
55. Làm copy image/XML relationship/style lookup lỗi trong cover/header/footer → Publish fail rõ ràng hoặc
    chỉ dùng fallback optional đã được policy cho phép và audit; không tạo official PDF success bị thiếu logo/style.
56. Gửi hai POST Publish đồng thời và retry cùng idempotency key; đồng thời làm queue executor đầy/restart →
    chỉ một active job và một official artefact commit, job được recover, không signature/audit trùng.
57. Contract test DTO/schema/FE cho Office Online history → field đã chọn luôn có giá trị thật; không còn
    nhánh UI dựa `undefined` và không có cột DB không bao giờ được runtime cập nhật.
58. Replace Revision source trên local/NAS rồi ép history/audit/flush fail → DB rollback vẫn đọc được file cũ;
    MinIO không có object mới vô chủ mà không có reconciliation record.
59. Mở Office Online từ source A, upload source B cùng Revision rồi Sync/Complete Editing → phải conflict hoặc
    Graph chuyển đúng sang B; tuyệt đối không được sync A ngược lại và ghi đè B.
60. Co-Author giữ Word Online đang mở và save đúng lúc Author Complete Editing → eTag/checksum cuối đã ký phải
    chứa lần save đó hoặc action trả conflict; không có Graph version mới hơn source locked trong EQMS.
61. Với live config/migration, backend từ chối `organization` cho controlled revision; forward link cho một
    user Microsoft 365 không được assign → Graph deny. Quét link cũ phải revoke được và có reconciliation result.
62. Sửa byte trên local/NAS của review PDF, published PDF và Controlled Copy sau khi DB đã lưu checksum → mọi
    preview/download/ZIP/distribute trả integrity error + audit/alert; không fallback sang parent path.
63. Graph stub trả 429 + `Retry-After`, 5xx giữa chunk và session expired → uploader retry/resume bounded đúng
    range; không duplicate item, không mất toàn bộ tiến độ và job có trạng thái/recovery quan sát được.
64. Upload/replace/clone từng Publishing Template Component → object version và checksum bắt buộc được lưu;
    sửa bytes/reference sau đó phải fail render theo integrity check, không silently tạo official PDF mới.
65. Lấy một signature token rồi lần lượt gọi hai action/đối tượng khác nhau và replay cùng action → chỉ đúng
    challenge đã bind mới được consume một lần; các lần còn lại phải 409/401 và có security audit, trong khi
    các child transition tự động cùng causal action vẫn hoàn tất mà không yêu cầu ký lại.
66. Xếp Publish sau nhiều file-processing job để worker bắt đầu sau 5 phút, rồi restart giữa QUEUED/PROCESSING →
    command đã được ký vẫn recovery đúng từ durable intent, không giữ raw JWT, không fail vì browser-token TTL
    và không tạo thêm signature/artefact khi retry.
67. Hai Admin cùng đọc một version Controlled Copy Policy/Expiry Rule rồi ký và save khác section/value → chỉ
    một CAS commit; request thua nhận 409, reload diff và phải review/ký lại. Audit cuối tái tạo được state thật.
68. Hai transaction đồng thời create/activate Expiry Rule cùng scope, kể cả `(NULL,NULL)` → DB chỉ cho một
    active rule; resolver gặp dữ liệu legacy trùng phải fail + alert, không tự chọn duration ngắn nhất.
69. Bật `printOnce`, lần lượt Cancel print dialog, giả lập popup/spooler lỗi rồi thử lại → hệ thống không được
    audit “Printed” hoặc mất quyền in nếu chưa có bước xác nhận; print package/DCO confirmation hợp lệ mới tăng
    số bản vật lý đã ghi nhận.
70. Dựng DB mới từ migration source và nâng cấp clone DB hiện tại → Flyway validation đều phải PASS, schema
    checksum/column/constraint phải giống nhau; chạy lại toàn bộ integration test Controlled Copy/Upgrade và
    xác nhận không scheduled worker nào phát SQL/schema exception sau startup.
71. Chạy riêng V80 trên database trắng không có các document seed được tham chiếu → migration phải bỏ qua an toàn
    hoặc fail bằng precondition có thông báo rõ trước câu `INSERT`; tuyệt đối không insert relation có
    `source_document_id`/`target_document_id=NULL`. Sau đó chạy toàn bộ migration đến latest và xác nhận rerun/
    upgrade từ V79 đều idempotent, không tạo duplicate relation.

---

## Phụ lục A — Ma trận trạng thái cha–con đã trace

Phụ lục này trả lời trực tiếp câu hỏi: **“Controlled Copy đang Ready for Distribution thì khi
Revision hoặc Document bị Obsoleted sẽ xảy ra gì?”**  Đây là hành vi **hiện tại trong code**, chưa
phải hành vi được khuyến nghị.

### A.1. Khi Document Master bị Obsolete

Nguồn: `DocumentService.obsoleteDocument(...)`,
`eqms-backend/src/main/java/com/eqms/service/DocumentService.java:1628-1738`.

| Controlled Copy trước action | Hành vi hiện tại | Đánh giá |
|---|---|---|
| `READY_FOR_DISTRIBUTION` | **Không bị đổi gì.** Vòng lặp chỉ xử lý copy có `statusCode/currentStage = DISTRIBUTED`. | Không an toàn: action Distribute hiện không kiểm tra parent Document/Revision còn hiệu lực; do đó copy này vẫn có thể được distribute (DC-XF-02). |
| `DISTRIBUTED` | Đổi thành `OBSOLETED`, reason `DOCUMENT_OBSOLETED`, có audit per-copy. | Đúng hướng. Cần bổ sung xử lý race với job Recall/Cancel và thống nhất signature reference. |
| `OBSOLETED` | Không đổi. | Đúng: giữ terminal evidence/reason hiện có. |
| `CLOSED_CANCELLED` | Không đổi. | Đúng: không ghi đè terminal state. |

**Kết luận nghiệp vụ đã chốt:** Ready là một yêu cầu/chờ phát hành, chưa phải bản đã phát hành. Khi
parent bị Obsolete, copy phải chuyển `OBSOLETED`, có reason phân biệt parent Document/Revision và audit
đầy đủ. Distribute đồng thời phải bị chặn ở server bằng parent invariant.

### A.2. Khi Revision Effective bị Obsolete do Publish Revision mới

Nguồn: `RevisionService.publishRevisionRecord(...)`,
`eqms-backend/src/main/java/com/eqms/service/RevisionService.java:1671-1780`; helper
`obsoleteDistributedControlledCopies(...)`, dòng `2055-2092`.

| Controlled Copy thuộc Revision cũ | Hành vi hiện tại | Đánh giá |
|---|---|---|
| `READY_FOR_DISTRIBUTION` | Không đổi. | Cùng lỗi DC-XF-02: request của Revision cũ có thể phát hành sau khi Revision mới đã Effective. |
| `DISTRIBUTED` | Đổi `OBSOLETED`, reason `NEW_REVISION_PUBLISHED`, audit per-copy. | Đúng hướng, nhưng audit chưa link signature Publish (DC-XF-07). |
| `OBSOLETED`/`CLOSED_CANCELLED` | Không đổi. | Đúng: bảo toàn terminal record. |

### A.3. Khi Revision bị Cancel hoặc Upgrade

| Parent action | Điều kiện hiện tại | Hệ quả Controlled Copy đã trace |
|---|---|---|
| Cancel Revision | Backend chỉ cho Revision `DRAFT`: `RevisionService.java:1336-1388`. | Theo luồng chuẩn không thể có Controlled Copy vì request chỉ cho Revision `EFFECTIVE`. Không cần propagation. Nếu DB lịch sử có copy gắn Draft thì đó là dữ liệu bất thường cần data check, không phải flow chuẩn. |
| Upgrade Revision | Source phải `EFFECTIVE`; action tạo **Revision Draft mới**: `RevisionService.java:1392-1510`. | Copy của Revision Effective nguồn không đổi; copy chưa được tạo cho Draft mới. Đây là hành vi đúng. |
| Publish Draft Upgrade | Revision mới thành Effective; Revision Effective cũ bị Obsolete. | Áp dụng đúng ma trận A.2. |

### A.4. Khi Document bị Cancel

`DocumentService.cancelDocument(...)` hiện chặn Document đã có bất cứ Revision nào
(`DocumentService.java:1587-1601`). Vì Controlled Copy phải được tạo từ Revision Effective, flow hợp
lệ **không thể** có Controlled Copy khi Document được Cancel. Không có propagation là hợp lý.

### A.5. Các action ở Controlled Copy sau khi parent đã thay đổi

| Action Controlled Copy | Hành vi hiện tại | Rủi ro/liên kết với parent |
|---|---|---|
| Distribute single/batch | Chỉ check copy/batch Ready; không check Document Active + Revision Effective. | Đây là đường phát hành sai ở A.1/A.2. |
| Cancel single | Chỉ Ready mới được Cancel. | Hợp lý, nhưng batch Cancel lại không giữ cùng rule (DC-XF-04). |
| Recall single/batch | Code coi Distributed/Obsoleted là recallable. | Trái GMP-D03 đã chốt: chỉ Distributed được Recall; Obsoleted phải giữ terminal state/reason bất biến. |
| Report Lost/Damaged | Chỉ Distributed. | Hợp lý khi source còn được phát hành; cần terminal guard để action song song không ghi đè parent Obsolete. |
| Replace Lost/Damaged | Chỉ Obsoleted có reason Lost/Damaged và lại yêu cầu Revision gốc còn Effective để lấy published PDF. | Sau khi parent Revision/Document Obsolete, replacement sẽ bị chặn bởi `requirePublishedPdfBytes`; đây là hành vi an toàn. |
| Print | Có thể ở Ready/Distributed nhưng code làm lệch `currentStage` khi in Distributed. | DC-XF-03; cần sửa để không làm giả trạng thái Ready. |

### A.6. Case race cần bao phủ bắt buộc

1. **Document Obsolete thắng trước Distribute:** copy Ready không được phát hành.
2. **Distribute commit trước Document Obsolete:** copy có thể được phát hành trong transaction đầu;
   transaction Obsolete sau đó phải Obsolete nó và tạo audit rõ trình tự. Đây là race chấp nhận được
   chỉ khi final state là Obsoleted và việc phát hành có audit đầy đủ.
3. **Publish Revision mới xen giữa batch Distribute:** mọi copy thuộc Revision cũ phải không bao giờ
   kết thúc ở Distributed.
4. **Document Obsolete xen giữa Recall/Cancel async:** worker không được thay reason/state terminal
   mà parent action vừa ghi.
5. **Expiry scheduler xen giữa parent Obsolete:** `EXPIRED` không được ghi đè
   `DOCUMENT_OBSOLETED`/`NEW_REVISION_PUBLISHED`, và ngược lại phải có quy tắc precedence rõ ràng.

### A.7. Quy tắc thiết kế nên được chuẩn hóa

Để không phải viết cùng rule ở nhiều service, backend cần một policy/invariant dùng chung:

```
Một Controlled Copy chỉ có thể chuyển Ready → Distributed khi:
  copy.statusCode == READY_FOR_DISTRIBUTION
  AND copy.document.status.code == ACTIVE
  AND copy.revision.status.code == EFFECTIVE
  AND copy chưa hết hạn
```

Khi parent lifecycle đóng:

```
Ready copy       → Obsoleted (đã chốt tại GMP-D01)
Distributed copy → Obsoleted/Recall-required theo SOP
Terminal copy    → immutable: không đổi state/reason; chỉ có thể có event bổ sung không mutation
```

Rule này phải được áp dụng tại capability endpoint, mutation endpoint, batch loop, async retry,
scheduler và migration/backfill dữ liệu — không chỉ ẩn button ở frontend.

### A.8. Các chuỗi liên đối tượng bổ sung đã trace

| Chuỗi thao tác | Hành vi source hiện tại | Kết luận |
|---|---|---|
| Document `OBSOLETED` → gọi API create/upload Revision → đi workflow → Publish | Create không check parent; Publish luôn set parent `ACTIVE`. | Reopen ngầm, DC-XF-18. |
| Document Draft → Save revision workspace không file | Tạo Revision Draft và lập tức set Document Active. | Sai mốc GMP-D04, DC-XF-19. |
| Batch action có item Failed → bấm Retry | Authorization kiểm tra trạng thái “action lần đầu”, chặn batch terminal trước khi worker retry. | Retry không dùng được, DC-XF-20. |
| Worker đang Processing → container restart | Recovery chỉ lấy job Pending. | Job/item treo, DC-XF-21. |
| Hai DCO cùng Replace một Lost copy | Không precheck, lock hay unique constraint theo source. | Có thể sinh hai replacement, DC-XF-22. |
| Request Ready chờ qua expiry | Scheduler bỏ qua Ready; Distribute từ chối vì expired. | Record mắc kẹt Ready, DC-XF-23. |
| FE mở màn Request | Response không có `expiryDurationDays`; FE hiển thị “never expire”, backend vẫn gán expiry từ policy. | Contract FE-BE sai, DC-XF-23. |
| Recipient mở link của copy mới | DB không có `previewPasswordHash`; backend bắt buộc hash. | Preview luôn bị từ chối, DC-XF-24. |
| Batch distribute → email gửi → finalization/transaction lỗi | Email đã ra ngoài trước commit/Success; child có thể bị trả về Ready, batch vẫn Distributed. | DC-XF-25/DC-XF-26. |
| Cancel Revision cuối | Working tree truyền `signatureSessionId` của Revision Cancel vào audit Document auto-close. | Source mitigation DC-XF-27; cần integration/rollback evidence. |
| Distribution item bị parent action làm terminal | Working tree ghi `SKIPPED` riêng, không cộng vào success và API/UI hiện count riêng. | Source mitigation DC-XF-28; cần queue/restart integration evidence. |
| Publish successor/Document Obsolete đối với copy đã phát hành | Copy đổi Obsoleted nhưng không dispatch notification cho holder. | Holder tiếp tục dùng bản cũ, DC-XF-29. |
| DB tắt `auto_recall_when_new_revision_effective` | Runtime không map/đọc field và vẫn auto-obsolete theo code. | Công tắc DB không có tác dụng, DC-XF-30. |
| Placeholder composer hoặc ghi PDF lỗi khi Distribute | Exception bị nuốt; copy/item vẫn được đánh dấu Distributed/Success. | Artefact phát hành không hợp lệ, DC-XF-31. |
| Reviewer/Approver Complete hoặc parent bị Publish/Cancel/Obsolete | Không phải mọi transition gọi revoke; helper còn nuốt lỗi Graph rồi ghi `access-revoked`. | Quyền edit tồn tại sau workflow/terminal, DC-XF-32. |
| Client gửi timestamp tương lai/invalid/backdate | Một số endpoint chấp nhận trực tiếp; Controlled Copy parse lỗi thì thay bằng `now`. | Timeline GMP/expiry sai, DC-XF-33. |
| Copy đã Obsoleted cần bổ sung destruction/evidence | DB policy có action nhưng enum/controller/service không có append-only path thực. | Không hoàn tất hồ sơ giấy theo GMP-D03, DC-XF-34. |
| Ghi PDF thành công rồi DB transaction rollback; hoặc distribute lại trên local/NAS | Object không cleanup; local/NAS dùng cùng path với `REPLACE_EXISTING`. | Artefact mồ côi hoặc lịch sử bị ghi đè, DC-XF-35. |
| Hai user khác nhau có cùng full name | Authorization/query chấp nhận cả UUID hoặc tên người nhận. | User không được gán có thể xem record, DC-XF-36. |
| Revision publish với template v1 → template live bị sửa → distribute copy cũ | Metadata chỉ giữ live FK + số version; composer đọc entity/component/path hiện tại. | Cùng Revision sinh artefact khác nhau, DC-XF-37. |
| Submit Revision trong source hiện tại | Dùng snapshot sync; không có nơi tạo `RevisionSnapshotEvent` hay status `GENERATING`. | Async snapshot là pipeline chết, DC-XF-38. |
| User có object-view nhưng thiếu file-action permission → gọi endpoint file trực tiếp | Document/Revision/Publishing Preview endpoint không đi qua evaluator chuyên biệt; Document download còn fallback latest Draft. | Bypass permission và có thể lộ source Draft, DC-XF-39. |
| User chỉ được view Controlled Copy → list/download Lost/Damaged evidence | Endpoint chỉ gọi quyền view copy dù dedicated evidence permissions/helper đã tồn tại. | Evidence scope bị bypass, DC-XF-40. |
| Submit/Regenerate Snapshot gặp converter/template error | Exception bị nuốt hoặc return im lặng; audit/API vẫn thể hiện thành công, path cũ có thể còn. | Review/Approve snapshot cũ, DC-XF-41. |
| Batch workspace cập nhật Draft A rồi item B fail | Cleanup xóa path của Draft có trước; DB rollback về path/checksum cũ. | Record trỏ file mất, DC-XF-42. |
| Related Document có Effective R1 và Draft upgrade R2 | Publish kiểm tra R2 vì mới tạo nhất, không kiểm tra R1 Effective. | False block/deviation, DC-XF-43. |
| User F5 detail đồng thời DCO Publish/Cancel/Obsolete | GET save `openedBy` trên entity `@Version`. | Read gây optimistic-lock failure cho action GMP, DC-XF-44. |
| User biết UUID Revision ngoài scope → GET workspace snapshot | Đã thêm `requireCanViewRevision` trước query; còn cần API/integration test user ngoài scope trả 403. | DC-XF-45 — source remediation complete. |
| Batch Save có item A không file, item B có file | FE compact file list; BE ghép theo index. | File B gắn nhầm A, DC-XF-46. |
| Active Document thêm/xóa relation hoặc request self-link | Relation rows thay đổi/bị bỏ nhưng boolean flags không derive lại; Revision copy flag cũ. | UI/filter/impact analysis lệch, DC-XF-47. |
| Gọi thẳng API Lost/Damaged với actor thiếu/sai | BE fallback executor về DCO, cho witness null và chỉ lưu tên. | Hồ sơ không đáp ứng GMP-D08, DC-XF-48. |
| DCO chỉnh page ranges trong workspace rồi bị deny Publish | Shared Active template đã bị save trước object-level authorization. | Mutation global trái phép; preview/published PDF có thể khác, DC-XF-49. |
| Chọn Inactive template hoặc “No Template” | Backend nhận Inactive ID; null lại tự chọn Active đầu tiên. | Output không đúng lựa chọn/approval template, DC-XF-50. |
| Publishing job fail/restart | Audit hardcode trạng thái không đúng; không có recovery job stuck. | Audit sai và job treo, DC-XF-51. |
| Hai request cùng cấp số Revision/Controlled Copy | Cùng read max/check invariant trước write; DB unique chỉ loại request thua sau cùng. | Constraint 500 và artefact mồ côi, DC-XF-52. |
| Client truyền page size cực lớn vào list copy/batch | Không có server upper bound. | Rủi ro query/heap/latency dưới tải, DC-XF-53. |
| Admin create/delete placeholder field | Output Controlled Copy thay đổi nhưng service không signature/audit/version. | Thiếu change-control evidence, DC-XF-54. |
| Redis lock unavailable lúc 02:00 | Expiry scheduler WARN rồi bỏ toàn bộ reminder/auto-obsolete, không retry trong ngày. | DB/audit/notification expiry bị stale, DC-XF-55. |
| Bấm Publish từ Revision List/Detail hoặc Document Detail | FE gọi thẳng Revision API; status Effective nhưng đường compose/store official PDF không chạy. | Effective không có Published PDF, DC-XF-56. |
| Request/Replacement Controlled Copy từ Revision đã publish | Helper đọc `revision.previewFilePath`, không đọc metadata `publishedPdfPath`. | Copy clone nhầm review preview, DC-XF-57. |
| Reviewer/Approver/DCO ký workflow | Signature chỉ giữ source checksum; review/published PDF version luôn null. | Không chứng minh artefact đã xem/ký/phát hành, DC-XF-58. |
| Hoàn thành Upgrade Session rồi bắt đầu lần upgrade tiếp theo | Unique key chỉ là `<documentId>:upgrade`; create trả session Completed cũ. | Upgrade Session chỉ dùng được một cycle, DC-XF-59. |
| Continue Upgrade nhập Reason For Change | Reason chỉ nằm trong session payload JSON; Revision/history/audit vẫn dùng comment hardcode. | Change rationale không thuộc hồ sơ Revision, DC-XF-60. |
| Client gọi direct Upgrade thay vì Upgrade Session | Endpoint không body nên bỏ reason/impact/related selection/signature. | Hai hợp đồng Upgrade xung đột, DC-XF-61. |
| R1 Effective → R2 Draft → Cancel R2 → Upgrade R1 | Parent là R1 nhưng snapshot lấy latest-created R2 Cancelled. | Nội dung/config bị hủy được tái đưa vào Draft, DC-XF-62. |
| Maintainer gọi FE wrapper Knowledge Base preview-opened | Backend không có mapping và wrapper hiện không có caller. | Contract chết/404 nếu được nối UI, DC-XF-63. |
| Admin xóa template/component đã dùng bởi Revision Effective | Service hard-delete; DB SET NULL metadata, CASCADE version history; component object bị xóa. | Mất lineage/asset lịch sử, DC-XF-64. |
| DBA/repository path sửa hoặc xóa Electronic Signature đã ghi | DB không có immutable trigger cho `electronic_signatures`. | Bằng chứng ký có thể lệch audit hoặc biến mất, DC-XF-65. |
| FE tái nối Review Comment/reply/attachment | API wrapper còn tồn tại nhưng backend mapping và bảng DB đã bị xóa; load hiện luôn trả mảng rỗng. | 404/nhánh rework chết và hiểu sai feedback được bảo toàn, DC-XF-66. |
| User nhập metadata/comment bắt đầu bằng ký tự công thức rồi DCO export CSV | Ba helper chỉ quote CSV, không neutralize spreadsheet formula. | Formula injection khi mở Excel/LibreOffice, DC-XF-67. |
| User Department A gọi Knowledge Base hoặc truyền thẳng ID Department B | Service tải mọi Active+Effective document/folder và không đọc current user. | Lộ metadata/tài liệu Effective ngoài Department, DC-XF-68. |
| Preview/Publish/Template inspection lặp lại | MinIO materialize và OpenXML render tạo temp file chỉ `deleteOnExit`; caller không cleanup scope. | Temp disk/registry tăng tới khi JVM dừng, DC-XF-69. |
| Nhiều upload Revision/Copy/Template đồng thời | Mỗi store vào global synchronized bucket/versioning/object-lock network check. | Upload bị serialize và một MinIO chậm chặn mọi job, DC-XF-70. |
| Graph upload success nhưng DB rollback; sau đó retry cùng filename | Remote item/grant không compensation; retry reuse item theo tên không checksum/eTag. | DB–Graph lệch và có thể dùng bytes/quyền orphan cũ, DC-XF-71. |
| Admin upload ZIP giả/corrupt/ZIP bomb dưới tên DOCX template | Chỉ kiểm extension/MIME và 4-byte ZIP magic; lỗi preview/POI bị nuốt. | Template invalid vẫn Active, DoS hoặc Publish fail muộn, DC-XF-72. |
| Header/footer image, XML relationship hoặc style lookup lỗi | Renderer/composer catch-all rồi tiếp tục với image/style thiếu. | Official PDF khác template nhưng job vẫn success, DC-XF-73. |
| Double-click/retry POST Publish hoặc executor queue đầy | Không idempotency/unique active job; dispatch reject sau create không recovery. | Hai worker/artefact cạnh tranh hoặc job treo `QUEUED`, DC-XF-74. |
| FE kiểm `officeOnlineEverSynced` | DB có cột, FE có field nhưng backend không map/set/trả. | Guard dựa giá trị luôn undefined; hợp đồng/schema chết, DC-XF-75. |
| Replace source rồi DB transaction fail | File local/NAS cũ đã bị xóa trước commit; MinIO object mới không rollback được. | DB trỏ file mất hoặc object orphan, DC-XF-76. |
| Office working copy A còn tồn tại → upload source B | Graph IDs/links không reset; sync-to-office return sớm, sync-back có thể ghi A đè B. | Split-brain/lost update giữa hai source authority, DC-XF-77. |
| User save Word Online trong lúc Complete Editing | Hệ thống GET bytes trước rồi mới revoke, không eTag/item lock. | Save cuối không thuộc source đã khóa/ký, DC-XF-78. |
| Forward Office edit link cho người trong tenant không được assign | Live DB đang dùng scope `organization`; Graph link bypass policy participant EQMS. | Sửa controlled source ngoài object authorization, DC-XF-79. |
| File PDF bị thay/corrupt sau khi lưu checksum | Các read path gọi overload không expected checksum; copy thiếu path fallback parent. | Preview/download/distribute sai artefact mà không integrity alert, DC-XF-80. |
| Graph trả 429/5xx hoặc upload session gián đoạn giữa chunk | Không Retry-After/resume/progress ledger; circuit chỉ fail/open. | Mất tiến độ, partial remote state và retry storm, DC-XF-81. |
| Upload/clone Publishing Template Component | Storage trả checksum nhưng service set DB checksum null; live DB 3/3 component bị ảnh hưởng. | Không có content identity/verify/lineage cho template input, DC-XF-82. |
| Replay cùng signature JWT trong 5 phút qua hai action/record | Validator chỉ check token expiry + user; không bind action/entity/version/reason và không consume `sid`. | Một lần re-auth có thể tạo nhiều chữ ký GMP độc lập, DC-XF-83. |
| Publish được accept nhưng chờ lâu trong file-processing queue | Raw signature token chỉ được validate ở worker; job không lưu signed intent/request và token hết hạn sau 5 phút. | Job fail theo queue latency hoặc không recovery được sau restart, DC-XF-84. |
| Hai Admin cùng sửa Controlled Copy Policy/Expiry Rule | Entity không `@Version`, API không expected version; cả hai save/signature có thể success. | Last-write-wins làm mất một thay đổi đã ký và audit không tái tạo state, DC-XF-85. |
| Hai Admin đồng thời tạo active Expiry Rule cùng scope | Java scan không thấy uncommitted row; DB không có unique scope/global-default constraint. | Nhiều policy hiệu lực, resolver âm thầm chọn duration ngắn nhất, DC-XF-86. |
| User bấm Print rồi Cancel dialog hoặc spooler lỗi | Backend đã tăng `printCount` và audit “Printed” trước khi FE gọi `window.print()`. | Mất quota Print Once và tạo bằng chứng in sai thực tế, DC-XF-87. |
| Khởi động local/GMP hoặc chạy integration test trên DB hiện tại | V359 checksum lệch, V364 thiếu trong source; local tắt Flyway validation nên vẫn healthy trong khi worker query cột không tồn tại. | Local healthy giả, GMP startup/test bị chặn và schema không tái lập, DC-XF-88. |
| Dựng database mới hoàn toàn từ migration source | V80 dùng scalar subquery tìm document seed cố định; trên DB trắng subquery trả `NULL` nhưng `WHERE NOT EXISTS` vẫn cho phép `INSERT`. | Flyway dừng ở V80 do FK `NOT NULL`; fresh install/CI/UAT không thể khởi tạo, DC-XF-89. |
