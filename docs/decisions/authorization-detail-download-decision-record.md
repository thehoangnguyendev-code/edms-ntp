# Decision Record — Phân quyền xem Detail (Preview/Audit Trail) và Download File

Trạng thái: **CẢ 3 MỤC (HDR-AUTH-001/002/003) ĐÃ QUYẾT ĐỊNH VÀ ĐÃ TRIỂN KHAI (2026-08-24)**. Tài liệu này
tổng hợp toàn bộ trao đổi phân tích ban đầu và cập nhật kết quả quyết định/triển khai thực tế.

Bối cảnh xuất phát: khi rà soát permission catalog của module Document Revision (Phase R1.2 QF comparison),
phát hiện các quyền `documents.revision.preview`, `documents.document.preview_published`,
`documents.document.view_audit`, `documents.revision.download_source`,
`documents.document.download_published` đang được cấp/tách rời thủ công theo từng permission code, thay vì
tự động suy ra từ việc đã xem được record. Cuộc trao đổi này đi sâu vào việc mô hình phân quyền hiện tại là
gì, và nên xử lý các quyền trên như thế nào cho đúng với đặc thù GMP.

---

## 1. Xác nhận mô hình phân quyền hiện tại: Hybrid, không phải RBAC thuần

**Tài liệu QF gốc (FRS/SDS) mô tả RBAC thuần túy**: SDS §4 "Module Authorizations" là một ma trận
Role × Rights cố định (Admin, DCO, Author, Co-Author, Reviewer, Approver, Receiver/View Only) — quyền gắn
với vai trò, không gắn với record cụ thể.

**Hệ thống AS-IS hiện tại là hybrid 4 lớp**, đã được xác nhận qua các phase reconstruction trước:

| Lớp | Cơ chế | Ví dụ |
|---|---|---|
| 1. RBAC | Permission code gắn qua Access Profile/role | `documents.revision.publish` → DCO/DOCUMENT_ADMIN |
| 2. ABAC (state/document-type-driven) | `workflow_action_policies` (DB-driven, thay đổi theo trạng thái + loại tài liệu) | Permission yêu cầu cho `SUBMIT_FOR_REVIEW` đã đổi qua V159→V208→V290 |
| 3. Relationship/Instance-based | `isPendingReviewer`/`isPendingApprover`, `canViewDocument` | Phải là đúng người được assign, đúng thứ tự sequence, trên đúng record |
| 4. Dynamic SoD constraints | `reviewerNoApprove`, `authorCannotBeReviewerOrApprover`... | Chặn xung đột vai trò trên cùng 1 record, tính động theo ngữ cảnh |

**Lý do cần hybrid**: RBAC thuần không biểu diễn được yêu cầu đặc thù GMP — không biết "ai được assign
cho record này" (Part 11 sequence enforcement), không biết SoD động trên từng record cụ thể. Đây là gốc rễ
giải thích vì sao các quyền Preview/Audit Trail hiện đang bị "xé lẻ" một cách không nhất quán giữa các lớp.

---

## 2. Preview file & Audit Trail (tab trong màn hình Detail) — Đề xuất: gộp vào "View Detail"

### Phát hiện

- Việc mở được Detail của 1 record (`canViewDocument`/`canViewRevision`, Layer 3: Author/Co-author/
  Participant/Admin) hiện **không tự động** kéo theo quyền xem tab **Document** (chứa file preview) và tab
  **Audit Trail** bên trong cùng màn hình đó — 2 tab này vẫn yêu cầu permission riêng
  (`documents.revision.preview`, `documents.document.preview_published`, `documents.document.view_audit`).
- Đối chiếu lại chính bảng gốc QF (SDS §4): 3 dòng quyền "View document" / "View Metadata" /
  "View Audit Trail" di chuyển **hoàn toàn đồng bộ** theo từng role — không role nào xem được
  Document/Metadata mà lại không xem được Audit Trail. Điều kiện "(only Published)" áp dụng đồng thời cho
  cả 3, là một **bộ lọc theo trạng thái record**, không phải một trục permission độc lập.
  → Hệ thống hiện tại đang tách nhỏ hơn cả chính thiết kế gốc của QF — đây là một **deviation thực sự**,
  không phải lựa chọn thiết kế có chủ đích.
- Hệ quả thực tế đã xảy ra: các migration "vá" nhiều lần
  (`V267__grant_publishing_operators_revision_preview.sql`,
  `V271__grant_published_preview_to_document_viewers.sql`) — cho thấy đội phát triển đã nhiều lần phát
  hiện có nhóm user xem được record nhưng thiếu quyền preview, rồi cấp bù bằng migration riêng lẻ, thay vì
  xử lý bằng một rule cấu trúc.

### Đề xuất

**Bundling theo "Stakeholder trực tiếp"**: giữ nguyên permission code trong catalog (không xóa, tránh phá
vỡ audit trail/lịch sử), nhưng thêm điều kiện suy ra tự động tại tầng capability:

```
canPreviewFile(user, record)     = isDirectStakeholder(user, record) OR hasPermission(preview_code)
canViewAuditTrail(user, record)  = isDirectStakeholder(user, record) OR hasPermission(audit_view_code)
```

Trong đó `isDirectStakeholder` tái sử dụng đúng logic Layer 3 hiện có (Author/Co-author/participant/Admin
trong `DocumentAuthorizationService.canViewDocument`).

- Nhóm **stakeholder trực tiếp** (Author, Co-author, Reviewer, Approver được assign, Admin/DCO quản trị
  record đó): tự động thấy Preview + Audit Trail của record đó, không cần Admin tick riêng.
- Nhóm **Viewer rộng/gián tiếp** (chỉ có `documents.document.view_all`, không có quan hệ trực tiếp — ví dụ
  role View Only): vẫn cần permission riêng như hiện tại, mặc định chỉ cho Preview với tài liệu đã Published
  — giữ đúng tinh thần QF.

**Loại trừ rõ ràng**: `audit.view`/`audit.export` (module Audit Trail **toàn hệ thống**, xem log nhiều
record cùng lúc ở màn hình riêng — khác bản chất với tab Audit Trail **trong Detail của 1 record**) — vẫn
giữ tách biệt như hiện tại, không nằm trong phạm vi đề xuất gộp này.

### Quyết định (2026-08-24) — ĐÃ CHỐT (Phương án A) và ĐÃ TRIỂN KHAI

Người quyết định chọn **Phương án A — Bundling theo Stakeholder trực tiếp** (không chọn giữ nguyên hiện
trạng, không chọn gộp hoàn toàn cho mọi nhóm kể cả Viewer rộng).

**Phát hiện quan trọng khi rà soát code để triển khai** (thu hẹp đúng phạm vi cần sửa):
- **Document Detail's Audit Trail tab vốn đã được gộp sẵn từ trước** — `DocumentService
  .getDocumentAuditTrail` đã gọi `ensureCurrentUserCanViewDocument` (= View Detail) rồi gọi thẳng
  `auditTrailService.getByEntityForAuthorizedDocument(...)` (không tự kiểm tra permission gì thêm).
  Không cần sửa đường này.
- **Revision Detail's Audit Trail tab CHƯA được gộp, và còn khắt khe hơn dự đoán ban đầu**:
  `DetailRevisionView.tsx` (và các màn hình review/approval/training liên quan) gọi
  `auditTrailApi.getByEntity("Revision", ...)` → `AuditTrailService.requireEntityAuditView`, nơi module
  `"REVISION"` **luôn luôn** yêu cầu quyền `audit.view` **toàn hệ thống** (không có đường tắt nào cho
  stakeholder) — đây là lỗ hổng "nửa vời" thực sự đã sửa.
- **Preview file (cả Document lẫn Revision) chưa được gộp** — đã sửa cả hai.

**Triển khai cụ thể**:
- `DocumentAuthorizationService`: trích xuất `isDirectStakeholder(user, DocumentRecord)` và
  `isDirectStakeholder(user, DocumentRevisionRecord)` (Admin/DCO qua `canViewAllDocuments` + Author +
  participant — loại trừ nhánh strict-visibility broad-viewer); `canViewDocument`/`canViewRevision`
  refactor để gọi lại 2 method này (hành vi giữ nguyên 100%, có test khóa lại).
- `AuditTrailService.requireEntityAuditView`: thêm bypass — nếu là direct stakeholder của
  Document/Revision thì bỏ qua yêu cầu `documents.document.view_audit`/`audit.view`, vẫn giữ nguyên
  `requireScopedEntityView` (object-scope check). Non-stakeholder vẫn yêu cầu permission như cũ.
- `FileAccessContext`: thêm overload `ofRevision(revision, isDirectStakeholder)` (overload cũ giữ nguyên,
  mặc định `false` — không phá vỡ ~10 call site khác).
- `SecureFileAccessService.check()`: bypass permission cho `VIEW_PREVIEW`/`VIEW_ONLINE` khi context đánh
  dấu stakeholder — **không áp dụng cho DOWNLOAD** (giữ đúng quyết định Mục 3 bên dưới).
- Cập nhật 2 caller tính & truyền cờ: `DocumentService.previewDocumentFile`,
  `RevisionActionCapabilityService.evaluatePreview`.
- **Chưa xử lý** (phạm vi theo dõi tiếp): `RevisionService.requireRevisionFileAccess` — helper dùng
  chung cho nhiều action, chưa xác nhận caller đã tự gate View Detail trước hay chưa; để nguyên hành vi
  cũ (an toàn), cần rà soát riêng nếu muốn mở rộng bundling sang đường này.
- Test: mở rộng `DocumentAuthorizationServiceTest`, `SecureFileAccessServiceTest`; tạo mới
  `AuditTrailServiceTest` (trước đó chưa có test nào cho `requireEntityAuditView`/`getByEntity`). Tổng
  233 test liên quan Document/Revision/Audit Trail pass sau thay đổi.

---

## 3. Download file — Đề xuất: KHÔNG gộp, giữ tách biệt hoàn toàn, và cần siết lại 1 quyền

### Nguyên tắc GMP (do người quyết định nêu, đã xác nhận qua rà soát code)

Theo GMP, không được phép download file trực tiếp từ Document Master/Revision — mọi phân phối tài liệu
phải đi qua cơ chế **Controlled Copy** (có watermark, có Copy Number, có Distribution List, có giới hạn
số lần tải/in), và ngay cả Controlled Copy cũng phải được cấu hình/authorize theo policy riêng.

### Kết quả rà soát code (FACT, đã xác nhận bằng bằng chứng cụ thể)

**a) `documents.document.download_published` — XÁC NHẬN LÀ LỖ HỔNG BYPASS CONTROLLED COPY**

- Endpoint sống: `GET /documents/{id}/download` (`DocumentController.java:305-312` →
  `DocumentService.downloadDocumentFile`).
- Trả về **nguyên bản file master** đọc thẳng từ storage cho tài liệu `EFFECTIVE`/`OBSOLETED`.
- **Không watermark** — trong khi hàm preview cùng file (`previewDocumentFile`) có gọi
  `applyPreviewWatermark(bytes)` khi bật cấu hình, thì `downloadDocumentFile` không hề gọi hàm này (bất
  đối xứng rõ trong chính code).
- Không có Copy Number, không có Distribution List/recipient, không giới hạn số lần tải. Chỉ có: kiểm tra
  checksum toàn vẹn + 1 dòng audit log.
- **Đây là chủ đích thiết kế, không phải sơ suất**: migration `V189__add_published_pdf_permissions_to_test_roles.sql`
  ghi rõ lý do cấp rộng: *"Anyone who can view a document should be able to read its published content."*
  — cấp cho cả Author/Co-Author/Reviewer/Approver, không chỉ DCO/Admin.
- **Mâu thuẫn trực tiếp với nguyên tắc GMP đã nêu**: một tài liệu Effective có thể rời khỏi hệ thống dưới
  dạng file gốc, không watermark, không tracking, không cần tạo Controlled Copy nào — chỉ cần có quyền này
  (đang được cấp khá rộng).

**b) `documents.revision.download_source` — KHÔNG phải rủi ro đang tồn tại (hiện "chết", chưa nối dây)**

- Không có endpoint backend nào trong `RevisionController.java` thực sự phục vụ file qua quyền này.
- Không có UI/frontend nào gọi tới nó — chỉ tồn tại như 1 cờ capability (`downloadSource`) không nút bấm
  nào tiêu thụ.
- Về lý thuyết không khai thác được ngay bây giờ, nhưng vẫn nằm sẵn trong catalog chờ nối dây sau này.

### Quyết định (2026-08-24) — ĐÃ CHỐT và ĐÃ TRIỂN KHAI

Người quyết định chọn phương án **loại bỏ hoàn toàn** cho cả 2 quyền: *"Bỏ quyền download đi, chỉ cho phép
download thông qua việc cấu hình controlled copy policy. Còn không thì không được bất kỳ quyền gì liên
quan đến download."*

| Quyền | Kết luận | Quyết định | Trạng thái triển khai |
|---|---|---|---|
| `documents.document.download_published` | Lỗ hổng xác nhận — bypass Controlled Copy | **(C) Loại bỏ hẳn** endpoint, buộc mọi phân phối phải qua Controlled Copy | ✅ Đã triển khai |
| `documents.revision.download_source` | Không phải rủi ro hiện tại (chưa nối dây) | **(B) Gỡ bỏ khỏi catalog** theo cùng nguyên tắc — không giữ quyền download nào ngoài Controlled Copy | ✅ Đã triển khai |

**Tóm tắt triển khai** (chi tiết xem plan đã duyệt, không lặp lại ở đây):
- Migration `V395__remove_direct_download_permissions.sql` — xóa 2 permission code khỏi `permissions`,
  `role_permissions`, `permission_set_items`.
- `SecureFileAccessService.evaluateBusinessRules` — thêm deny tường minh `DOWNLOAD_NOT_SUPPORTED` cho
  action DOWNLOAD trên `REVISION`/`SOURCE_DOCX`/`PUBLISHED_PDF`/`DOCUMENT`, áp dụng **vô điều kiện** (không
  phụ thuộc permission có tồn tại hay không) — tránh rủi ro fail-open nếu sau này có ai vô tình cấp lại
  permission tương tự.
- Xóa endpoint `GET /documents/{id}/download` (`DocumentController`/`DocumentService`), xóa capability key
  `downloadSource` (`RevisionActionCapabilityService` + frontend), xóa 2 entry trong permission catalog UI.
- Test mới trong `SecureFileAccessServiceTest` xác nhận deny **kể cả khi không cấp permission nào** (chứng
  minh không còn fail-open). Toàn bộ 188 test liên quan Document/Revision pass sau thay đổi.
- `documents.controlled_copy.download_file`/`download_evidence` và toàn bộ `ControlledCopyService`/
  `ControlledCopyAuthorizationService` **không bị đụng tới** — vẫn là con đường duy nhất còn lại.

**Không đổi**: Download vẫn không gộp chung với "View Detail" như Preview/Audit Trail ở Mục 2 — đúng như
nguyên tắc GMP đã nêu, đây là ranh giới rủi ro khác hẳn (đưa nội dung ra khỏi hệ thống kiểm soát).

---

## 4. Human Decision Register

| ID | Chủ đề | Hiện trạng | Đề xuất | Cần quyết định? | Các lựa chọn (chưa chọn thay) |
|---|---|---|---|---|---|
| HDR-AUTH-001 | Gộp Preview + Audit Trail (tab trong Detail) vào cổng "View Detail" | Đang tách permission riêng, không đồng bộ với chính thiết kế gốc QF | Bundling theo `isDirectStakeholder`, giữ permission riêng cho nhóm Viewer rộng | **✅ ĐÃ QUYẾT ĐỊNH (A) — đã triển khai 2026-08-24** | **A. Bundling theo Stakeholder trực tiếp — ĐÃ CHỌN.** ~~B. Giữ nguyên hiện trạng.~~ ~~C. Gộp hoàn toàn cho mọi nhóm.~~ |
| HDR-AUTH-002 | Xử lý `documents.document.download_published` | Xác nhận bypass Controlled Copy, cấp rộng cho Author/Co-Author/Reviewer/Approver | Cần siết lại | **✅ ĐÃ QUYẾT ĐỊNH (C) — đã triển khai 2026-08-24** | ~~A. Thu hẹp DCO/Admin.~~ ~~B. Watermark bắt buộc.~~ **C. Loại bỏ hẳn endpoint — ĐÃ CHỌN.** ~~D. Giữ nguyên hiện trạng.~~ |
| HDR-AUTH-003 | Xử lý `documents.revision.download_source` (permission chưa nối dây) | Tồn tại trong catalog, không có endpoint/UI dùng | Không cấp bách | **✅ ĐÃ QUYẾT ĐỊNH (B) — đã triển khai 2026-08-24** | ~~A. Giữ nguyên, chờ nối dây.~~ **B. Gỡ bỏ khỏi catalog — ĐÃ CHỌN**, theo cùng nguyên tắc với HDR-AUTH-002 |

---

## 5. Việc cần làm tiếp theo

**Cả 3 mục (HDR-AUTH-001/002/003) đã hoàn tất triển khai (2026-08-24)**, xem tóm tắt ở Mục 2 và Mục 3.
Việc còn lại:
1. Xác nhận migration `V395` chạy sạch trên các môi trường khác (staging/production) theo đúng quy trình
   release.
2. Cân nhắc lập One Change Record chính thức
   (`eqms-backend/docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md`) cho lần release tới, gộp cả 2 thay
   đổi (Preview/Audit Trail bundling + loại bỏ download trực tiếp) vì đây là hệ thống GMP đã qua
   validation.
3. Theo dõi riêng: `RevisionService.requireRevisionFileAccess` chưa được đưa vào phạm vi bundling
   (xem Mục 2, "Chưa xử lý") — cần một lượt rà soát riêng nếu muốn mở rộng.

---

## 6. Rà soát toàn bộ Permission Catalog (2026-08-24) — bổ sung, ĐÃ TRIỂN KHAI

Sau khi hoàn tất Mục 2/3, người quyết định yêu cầu rà soát toàn bộ permission catalog xem có cần điều
chỉnh gì thêm (đặt tên, nhất quán, permission chết/orphan...). Kết quả rà soát và các mục đã xử lý:

### Phát hiện & xử lý

| # | Vấn đề | Mức độ | Xử lý |
|---|---|---|---|
| 1 | `sod_constraints` (seed V170) tham chiếu `documents.revision.submit` — code này **chưa từng tồn tại** trong catalog (đúng ra là `documents.revision.submit_review`) → ràng buộc SoD vô nghĩa, không bao giờ khớp | Cao | ✅ Migration `V396` sửa lại đúng code. **Lưu ý**: trên DB dev hiện tại, row này thực ra không tồn tại (khác với dự đoán ban đầu từ đọc tĩnh file migration) — UPDATE là no-op an toàn trên môi trường này, nhưng vẫn cần thiết cho môi trường nào khác mà row này thực sự được tạo ra (fresh install...). |
| 2 | `report_definitions` (seed V359, report `REVISION_LIFECYCLE`) có `access_policy` trỏ `documents.revision.view` — code không tồn tại (đúng ra là `documents.revision.preview`) | Cao — **và đã xác nhận report này hiện đang `active=true` trên DB dev**, không còn là "chưa kích hoạt" như đánh giá ban đầu | ✅ Migration `V396` sửa `access_policy` thành `documents.revision.preview`. Đã verify trực tiếp trong DB. |
| 3 | Không có ràng buộc referential integrity nào giữa `permissions.code` và các cột free-text tham chiếu tới nó (`sod_constraints`, `workflow_action_policies`, `lifecycle_state_policies`, `report_definitions.access_policy`) — đây chính là nguyên nhân gốc của lỗi #1/#2 và của sự cố `documents.controlled_copy.print` từng xảy ra thật (bị xóa khỏi catalog trong khi `workflow_action_policies` vẫn yêu cầu nó, khiến toàn bộ chức năng Print Controlled Copy bị chặn tới khi `V386` khôi phục) | Cao (rủi ro tái diễn) | ✅ Thêm test mới `PermissionReferentialIntegrityTest` (3 test: `sod_constraints`, `workflow_action_policies`, `lifecycle_state_policies` — mỗi bảng đối chiếu toàn bộ code tham chiếu với catalog thật). **Không** thêm test cho `report_definitions.access_policy` vì bảng này chưa có JPA entity ánh xạ (out of scope hợp lý cho lần này). |
| 4 | `documents.document.view_all` bị seed **2 lần độc lập** bởi `V248` và `V278` (khác `name`/`group_key`/`description`/`display_order`) — do dùng `WHERE NOT EXISTS` nên bản V278 (chủ đích sau, thuộc nhóm `document_control_access` mới) chưa từng thực sự áp dụng | Thấp | ✅ Migration `V396` chuẩn hóa về đúng giá trị dự định của V278. Đã verify trong DB. |
| 5 | Description của `documents.document.view_audit` (cả backend seed lẫn FE hardcode) vẫn mô tả như thể đây là quyền chính/bắt buộc để xem Audit Trail — không còn đúng sau thay đổi HDR-AUTH-001 (giờ chỉ là fallback cho Viewer gián tiếp) | Trung bình | ✅ Cập nhật description ở cả backend (`V396`) và FE (`permissionCatalog.ts`). Đã verify trong DB. |
| 6 | `eqms/src/features/settings/permissionCatalog.ts` (FE) là **mảng hardcode hoàn toàn độc lập** với backend — không fetch từ API. Phát hiện **10 permission code đang tồn tại thật ở backend nhưng thiếu hẳn trong FE** (`documents.controlled_copy.print`, `.receive_as_dco`, `documents.template.use/manage`, `documents.revision.force_publish`, `documents.document.reopen/configure_next_metadata/update_metadata`, `documents.revision.update_draft_metadata`, `documents.document.manage_relations`) | Cao (thiếu label/description ở màn hình Admin) | ✅ Đã thêm đầy đủ 10 entry vào FE catalog, dùng đúng name/description/group từ backend seed (không tự bịa taxonomy mới). |
| 7 | Naming inconsistency tổng thể (verb "view"/"preview"/"read", "edit"/"update"/"manage" không nhất quán giữa các domain; nhiều group_key/category bị lệch qua các đợt migration) | Thấp | ⏸️ **Chủ động KHÔNG xử lý trong lần này** — đổi tên permission code đang sống (được tham chiếu trong hàng chục migration, `workflow_action_policies`, test, FE) là thay đổi rủi ro cao cho lợi ích thuần cosmetic, không tương xứng trong 1 lần review. Ghi nhận là backlog riêng nếu muốn chuẩn hóa toàn diện sau này. |

### Xác minh

- Migration `V396__fix_permission_catalog_drift.sql` áp dụng thành công trên DB dev; đã kiểm tra trực tiếp
  bằng `psql` xác nhận cả 4 giá trị (`view_all`, `view_audit`, `sod_constraints`, `report_definitions`)
  đúng như mong đợi.
- `PermissionReferentialIntegrityTest` (mới) + 4 test suite liên quan trước đó (`DocumentAuthorizationServiceTest`,
  `SecureFileAccessServiceTest`, `AuditTrailServiceTest`, `RevisionActionCapabilityServiceTest`,
  `RevisionBusinessRulesTest`, `DocumentCancelObsoleteGuardTest`) — tổng **124 test pass**.
- FE: `npx tsc --noEmit` toàn project — biên dịch sạch, không lỗi.
- **Lưu ý quan trọng**: khi chạy `mvnw test` cho TOÀN BỘ 690 test trong repo, có 17 test thất bại
  (`DictionaryManagementServiceAuthorizationTest`, `ControlledCopyListAuthorizationIntegrationTest`,
  `UserManagementServiceSelfEscalationGuardTest`, `UserManagementServiceStatusTransitionTest`,
  `VersionNormalizationTest`) — đã xác minh bằng `git diff --stat` rằng **các file liên quan tới những
  test này đã bị sửa sẵn từ trước (dirty tree pre-existing), hoàn toàn không thuộc phạm vi làm việc của
  phiên này**. Đây là vấn đề tồn đọng cũ (đã từng được báo cáo ở giai đoạn git-checkpoint Document
  Lifecycle trước đó trong dự án) — không phải do các thay đổi permission catalog vừa thực hiện.

### Việc chưa xử lý / cần theo dõi

1. Đồng bộ hoá triệt để FE/backend catalog (đổi FE sang fetch trực tiếp từ API thay vì hardcode) — chưa
   làm, vẫn giữ 2 nguồn dữ liệu song song, chỉ đã vá đúng phần lệch đã phát hiện.
2. Chuẩn hóa toàn diện naming convention (#7) — chủ động để lại cho một đợt riêng.
3. Dirty-tree pre-existing (17 test thất bại ở trên) — vẫn là vấn đề tồn đọng từ trước, chưa được xử lý,
   nằm ngoài phạm vi mọi công việc trong tài liệu này.

---

STOP. Đây là tài liệu tổng hợp quyết định. Các mục HDR-AUTH-001/002/003 và Mục 6 (permission catalog
forensic fixes) đều đã được triển khai thực tế (code/migration/test như mô tả ở trên); không có phạm vi
TO-BE/thiết kế mới nào được đề xuất trong tài liệu này.
