# Lộ trình triển khai — Document Control Cross-Flow Remediation

Dựa trên `DOCUMENT_CONTROL_CROSS_FLOW_AUDIT_REPORT.md` (89 phát hiện, đề xuất bởi Codex) và
`DOCUMENT_CONTROL_CROSS_VERIFICATION_RESULT.md` (kiểm tra chéo độc lập: 80 CONFIRMED, 4 PARTIALLY
CONFIRMED, 8 COULD_NOT_VERIFY tĩnh, 0 bị bác bỏ; riêng DC-XF-88/89 đã tái hiện lỗi thật bằng cách
chạy Flyway validation thật + đọc log container thật).

**Nguyên tắc xuyên suốt cả lộ trình** (đã thống nhất từ các đợt sửa trước trong phiên này):
- Mỗi đợt: viết regression test tái hiện lỗi **trước** khi sửa.
- Không tạo 89 PR riêng lẻ — gộp theo đợt như dưới đây.
- Sửa DB constraint/migration trước nếu invariant thuộc về DB.
- Không đánh dấu "done" chỉ vì compile/build PASS — phải có test/verify thật.
- Điểm nào cần quyết định nghiệp vụ/GMP thì hỏi trước, không tự quyết định thay.
- Sau mỗi đợt: chạy lại toàn bộ regression test hiện có (không riêng phần mới sửa) để bắt regression.

---

## Đợt 0 — Baseline Migration (bắt buộc, chặn mọi đợt sau) — ✅ HOÀN TẤT (20/08/2026)

**Đã triển khai xong cả 2 mục, verify bằng chạy thật (không chỉ đọc code):**

- **DC-XF-88**: V359 hoá ra không thiếu nội dung — có người đã **sửa trực tiếp file migration đã áp
  dụng** (thêm cột `requested_format` vào `report_runs` ngay trong V359, thay vì viết migration mới),
  đúng nguyên nhân gây lệch checksum. Đã revert V359 về đúng nội dung đã áp dụng, thêm migration mới
  `V392__add_requested_format_to_report_runs.sql` làm đúng cách (theo đúng pattern `V360` đã làm cho
  `report_schedules`). V364 (`clear legacy template training configuration`) không có file nguồn và
  không có trong git history (repo chỉ có 1 commit) — dựa theo mô tả + bối cảnh xung quanh (V363),
  xác định đây là 1 migration **dữ liệu** (dọn training config cũ trên Document đánh dấu Template),
  không phải DDL, đã chạy xong 1 lần, không migration nào sau đó phụ thuộc DDL từ nó. Đã dùng
  `flyway repair` để đánh dấu DELETED — đúng tiền lệ đã có sẵn trong chính DB này cho V198-200 (AI
  Copilot module bị gỡ trước đó). Bật `validate-on-migrate=true` thật ở `docker-compose.yml` (xoá
  override `false`). **Verify**: bật validate thật → `Successfully validated 380 migrations`; theo dõi
  log 3 phút → 0 lỗi `requested_format does not exist` (trước đó 595 lỗi/15 phút); cột `requested_format`
  đã tồn tại đúng kèm CHECK constraint.
- **DC-XF-89**: viết lại `V80__seed_document_relations_for_expanded_row.sql` dùng CTE — chỉ insert
  quan hệ khi **cả 2** document thực sự tồn tại (trước đây dùng scalar subquery trả NULL âm thầm rồi
  insert thẳng vào cột NOT NULL). Vì V80 cũng đã áp dụng trên DB dev, sửa nội dung nó cũng gây lệch
  checksum y hệt V359 — đã xử lý bằng `flyway repair` tương tự. **Verify bằng DB hoàn toàn trắng
  thật** (spin up container Postgres mới tinh, chạy toàn bộ chain migration qua network riêng): trước
  khi sửa → crash đúng tại V80 với lỗi `null value in column "source_document_id"`; sau khi sửa →
  `Successfully applied 297 migrations to schema "public", now at version v392`, backend khởi động
  hoàn tất (`Started EqmsBackendApplication`).
- **Kết quả cuối**: 3 integration test trước đây phải bypass Flyway validation mới chạy được
  (`ControlledCopyBatchDiscrepancyScannerIntegrationTest`, `ControlledCopyListAuthorizationIntegrationTest`,
  `UpgradeRevisionIntegrationTest`) cùng `ClamAvScanServiceIntegrationTest` giờ **pass thật, không cần
  workaround**. Tổng lỗi test suite giảm từ 22 (8 failures + 14 errors) xuống 15 (8 failures + 7
  errors) — 7 lỗi còn lại hoàn toàn không liên quan Flyway/Document Control (`DictionaryManagementService`,
  `UserManagementService`, pre-existing từ trước, ngoài phạm vi audit này). Backend đã redeploy thật,
  log sạch.
- **Lưu ý vận hành cho UAT/GMP**: vì DC-XF-89 (và cả DC-XF-88) buộc phải sửa nội dung migration **đã
  áp dụng** (V80, V359), mọi môi trường khác (UAT, GMP) khi deploy bản có 2 fix này **sẽ cần chạy 1
  lần `flyway repair`** để reconcile checksum trước khi bật `validate-on-migrate=true` — không thể
  tránh khỏi vì root cause nằm trong chính nội dung migration đã chạy, không phải ở migration mới.
  Đây là thao tác 1 lần, đã kiểm chứng an toàn (chỉ cập nhật bảng `flyway_schema_history`, không đổi
  schema/dữ liệu).



**Không được bắt đầu Đợt 1 trở đi trước khi Đợt 0 hoàn tất.** Lý do: mọi race-condition test ở các
đợt sau cần chạy trên schema đã validate đúng; nếu không, kết quả test không đáng tin (đúng như log
`ContoolledCopy*IntegrationTest`/`UpgradeRevisionIntegrationTest` đang phải bypass validation mới
chạy được, ghi nhận trong report gốc).

| # | Việc | Bằng chứng đã xác nhận |
|---|---|---|
| DC-XF-88 | Khôi phục nội dung gốc V359 khớp checksum đã ghi trong `flyway_schema_history`, hoặc nếu nội dung hiện tại đúng thì cần `flyway repair` có kiểm soát (ghi rõ lý do, có phê duyệt) — **không tự ý dùng flyway repair để hợp thức hoá mà không xác minh trước**. Khôi phục/migration bù cho V364 (`clear legacy template training configuration`, checksum 395950413) — tạo lại đúng nội dung gốc từ Git history nếu có, hoặc migration forward mới nếu nội dung gốc không khôi phục được. Bật `SPRING_FLYWAY_VALIDATE_ON_MIGRATE=true` ở **mọi** môi trường (đã xác nhận `docker-compose.yml` local đang set `false`, sai lệch với `docker-compose.gmp.yml`/`application.properties`). | Đã tái hiện lỗi thật: bật validate → Flyway báo đúng "checksum mismatch v359" + "364 not resolved locally". Log container xác nhận 595 lỗi SQL `requested_format does not exist`/15 phút; bảng `report_runs` thật không có cột `format`. |
| DC-XF-89 | Sửa `V80__seed_document_relations_for_expanded_row.sql` theo hướng: chỉ INSERT khi **cả 2** document tồn tại (thêm điều kiện `WHERE ... IS NOT NULL` cho từng subquery, hoặc bọc trong khối kiểm tra tồn tại trước). Cân nhắc chuyển hẳn seed demo này ra khỏi migration production (đưa vào seed script riêng chỉ chạy cho môi trường demo/dev). | Đã xác nhận qua code: không migration nào khác từng insert `SOP.0001`/`SPEC.0001`/... — các document này chỉ tồn tại trong dữ liệu thật hiện tại, không phải do migration tạo ra. |

**Điều kiện hoàn thành Đợt 0** (giữ nguyên theo đề xuất gốc, đã xác nhận là đúng tiêu chí cần thiết):
- [ ] Fresh/empty database migrate được tới version mới nhất, không lỗi.
- [ ] Clone của DB hiện tại upgrade thành công qua migration mới.
- [ ] `spring.flyway.validate-on-migrate=true` PASS ở local, CI, UAT, GMP — không còn override `false`
      ở bất kỳ compose file nào.
- [ ] Không dùng `flyway repair` để "hợp thức hoá" migration đã bị sửa mà không xác minh nội dung gốc.
- [ ] `ReportJobWorker`/scheduled worker hết lỗi SQL trong log (verify bằng cách theo dõi log 15 phút
      sau deploy, giống cách đã tái hiện lỗi ở bước kiểm tra).

---

## Đợt 1 — Authorization & Electronic Signature Foundation

Lý do đứng ngay sau migration: đây là lớp nền tảng (ai được làm gì, chữ ký có tin được không) mà mọi
đợt nghiệp vụ sau đều dựa vào — sửa sau sẽ phải làm lại nhiều chỗ.

| # | Mức | Việc chính | Cross-verify |
|---|---|---|---|
| DC-XF-39 | P0 | Gom toàn bộ kiểm tra quyền truy cập file Revision vào 1 authorization service duy nhất (đã có `SecureFileAccessService`, hiện `previewDocumentFile`/`downloadDocumentFile` không gọi vào nó); bỏ fallback ngầm từ Published sang Draft khi không có bản Effective. | CONFIRMED, có trích dẫn method/dòng cụ thể |
| DC-XF-83 | P0 | Signature JWT: bind token với action code + entity ID + version/checksum + reason; thêm cơ chế consume-once (không cho dùng lại trong TTL 5 phút). | CONFIRMED — TTL 5 phút xác nhận qua `application.properties`, không có replay-guard |
| DC-XF-45 | P1 | Thêm object-level authorization cho GET Workspace Snapshot (hiện không gọi `currentUserService`/`documentAuthorizationService` gì cả). | CONFIRMED |
| DC-XF-68 | P1 | Knowledge Base: áp scope theo Department ID ổn định của current user ở cả 3 endpoint, không lấy `{departmentId}` client gửi làm căn cứ lọc. | CONFIRMED |
| DC-XF-67 | P1 | CSV export (Document/Revision/Controlled Copy): thêm neutralize cho giá trị bắt đầu `=`/`+`/`-`/`@`/tab/CR — đã có sẵn pattern đúng ở `ReportPlatformService.csv`, áp dụng lại cho 3 chỗ còn thiếu. | CONFIRMED — xác nhận `ReportPlatformService` đã làm đúng, chỉ 3 service kia thiếu |
| DC-XF-84 | P1 | Async Publish: lưu "signed intent" bền vững (đã ký + hash) ngay lúc nhận lệnh, không giữ raw JWT trong queue chờ worker xử lý. | CONFIRMED |
| DC-XF-65 | P1 | Thêm DB trigger append-only cho `electronic_signatures` (theo đúng pattern `prevent_audit_log_mutation` đã áp dụng cho `audit_logs`). | CONFIRMED — đã xác nhận trigger pattern có sẵn, chỉ chưa áp cho bảng signature |

**Test bắt buộc trước khi đóng đợt**: thử tải file Draft qua endpoint preview không có quyền → phải
bị chặn; thử replay 1 signature token cho 2 action khác nhau trong 5 phút → phải bị chặn ở action thứ
2; thử UPDATE trực tiếp 1 row `electronic_signatures` bằng SQL → phải bị DB từ chối.

## ✅ ĐỢT 1 HOÀN TẤT (20/08/2026)

- **DC-XF-39**: `previewDocumentFile()`/`downloadDocumentFile()` giờ gọi
  `secureFileAccessService.require(..., FileObjectType.PUBLISHED_PDF, ...)` ngay sau khi resolve
  revision — business rule sẵn có (`evaluatePublishedPdfRules`) chỉ cho EFFECTIVE/OBSOLETED, nên
  fallback về Draft (khi chưa có bản Effective) bị chặn đúng thay vì âm thầm phục vụ source chưa
  duyệt. Test: `DocumentCancelObsoleteGuardTest.previewDocumentFile_fallsBackToOnlyDraftRevision_...`.
- **DC-XF-83**: tạo `SignatureTokenConsumptionService` dùng chung — parse + xác nhận chủ sở hữu +
  **consume-once** (insert `used_signature_tokens.token_id`, unique constraint chặn dùng lại). Xử lý
  đúng 1 vấn đề phát sinh: nhiều action gọi `requireValidSignatureToken` RỒI gọi lại
  `electronicSignatureService.createEntitySignature` với **cùng token** trong cùng action — đã làm
  consume-once **idempotent trong cùng 1 transaction** (qua `TransactionSynchronizationManager`) để
  không tự chặn chính nó, nhưng vẫn chặn replay thật từ transaction/request khác. Áp dụng cho cả 4 nơi
  từng có bản sao logic riêng (`DocumentService`, `RevisionService`, `ControlledCopyService`,
  `ElectronicSignatureService`). Test: `SignatureTokenConsumptionServiceTest` (3 test, bao gồm reject
  khi replay ở transaction khác).
- **DC-XF-45**: `RevisionWorkspaceSnapshotService.getSnapshot()` giờ gọi
  `documentAuthorizationService.requireCanViewRevision(...)` trước khi trả snapshot.
- **DC-XF-68**: `getKnowledgeBase()` giờ scope theo Department ID ổn định của user hiện tại (resolve
  qua `departmentRepository.findByCodeIgnoreCase(user.getDepartment())`, đúng convention đã có sẵn
  trong codebase), bypass cho DCO/Document Admin (`canViewAllDocuments`) — khớp pattern
  cross-department đã dùng ở mọi nơi khác. `getKnowledgeBaseDepartments()`/`getKnowledgeBaseDepartment()`
  tự động kế thừa scope vì derive từ `getKnowledgeBase()`.
- **DC-XF-67**: tạo `com.eqms.util.CsvSafety.escapeCell()` dùng chung, áp dụng cho `DocumentService`,
  `RevisionService`, `ControlledCopyService` (trước đó chỉ `ReportPlatformService` làm đúng).
- **DC-XF-84**: **đã thu hẹp phạm vi có chủ đích** — thêm
  `signatureTokenConsumptionService.requireValidWithoutConsuming(...)` gọi ngay tại
  `PublishingWorkspaceController.publish()` (accept-time), để token đã hỏng/hết hạn/bị replay bị từ
  chối ngay lập tức thay vì chỉ phát hiện ra sau nhiều phút khi worker mới chạy tới. **Chưa** implement
  phần "lưu signed intent bền vững tách khỏi JWT" đầy đủ theo đúng tinh thần gốc của phát hiện — việc
  đó cần thiết kế lại hợp đồng `RevisionWorkflowActionRequest`/`publishRevision` (nhiều nơi dùng chung),
  rủi ro cao hơn nếu làm vội trong đợt này. Ghi nhận là nợ kỹ thuật còn lại, cần 1 đợt riêng.
- **DC-XF-65**: migration `V394` thêm trigger `prevent_electronic_signature_mutation` (đúng pattern
  `prevent_audit_log_mutation` đã dùng cho `audit_logs`) — xác nhận qua code chỉ có 2 chỗ
  `signatureRepository.save(...)`, cả 2 đều insert bản ghi mới, không có update, nên khoá UPDATE/DELETE/
  TRUNCATE an toàn. **Đã test trực tiếp trên DB thật**: `UPDATE`/`DELETE` 1 row `electronic_signatures`
  → cả 2 đều bị Postgres từ chối với đúng thông báo lỗi.

**Test & build**: 3 test bắt buộc đã thực hiện — (1) preview Draft fallback không quyền → chặn (unit
test); (2) replay signature token 2 lần → chặn lần 2 (unit test); (3) UPDATE/DELETE trực tiếp
`electronic_signatures` bằng SQL → **DB thật từ chối cả 2** (không phải giả lập). Full test suite: 585
test, 15 lỗi pre-existing giống hệt baseline trước Đợt 1 (8 failures + 7 errors, cùng tên test) — không
regression. Backend đã build + deploy lại (`docker compose build backend` + `up -d --no-deps
--force-recreate`), log khởi động sạch: `Successfully validated 382 migrations`, schema tại v394.

---

## Đợt 2 — Unified Publish Command & Official Artefact

Đây là nhóm **quan trọng nhất về nghiệp vụ** vì ảnh hưởng trực tiếp tài liệu Effective thật và
Controlled Copy phân phối cho người dùng cuối — dữ liệu thật đã xác nhận hậu quả: **10/16 Revision
Effective thiếu published metadata/PDF**, **0/134 chữ ký có `review_pdf_version_id`/
`published_pdf_version_id`**.

**Hướng sửa chung** (đã thống nhất trong report gốc, cross-verify xác nhận hợp lý): chỉ có **một**
Publish command duy nhất; khoá source/template/checksum tại thời điểm publish; tạo official PDF
thành công mới coi là publish xong; lưu version/checksum của đúng PDF đó; chữ ký phải tham chiếu đúng
tới PDF đã ký; chỉ sau đó mới chuyển Revision sang Effective.

| # | Mức | Việc chính | Cross-verify |
|---|---|---|---|
| DC-XF-56 | P0 | Loại bỏ đường publish trực tiếp không qua Publishing Workspace pipeline; bắt buộc pipeline tạo PDF chính thức thành công trước khi set Effective. | COULD_NOT_VERIFY hết — cần đọc lại kỹ 3 màn hình FE gọi publish trực tiếp trước khi sửa, xem mục "Cần làm rõ thêm" bên dưới |
| DC-XF-57 | P0 | Đổi nguồn Controlled Copy từ `Revision.previewFilePath` sang published PDF path/version chính thức. | CONFIRMED |
| DC-XF-58 | P0 | Thêm `review_pdf_version_id`/`published_pdf_version_id` vào bảng `electronic_signatures`, set đúng giá trị khi ký thay vì luôn `null`. | CONFIRMED |
| DC-XF-80 | P0 | Truyền expected checksum vào storage service khi preview/download/distribute (checksum đã lưu sẵn, chỉ thiếu bước verify lúc đọc). | CONFIRMED |
| DC-XF-49 | P0 | Kiểm tra quyền Publish object-level **trước** khi Workspace được phép mutate template Active dùng chung. | CONFIRMED |
| DC-XF-37 | P0 | Revision phải khoá đúng version template (không chỉ số int) khi publish — lưu tham chiếu `PublishingTemplateVersion`, không phải live FK. | CONFIRMED |
| DC-XF-64 | P0 | Chặn hard-delete Template/Component đã dùng bởi Revision Effective; đổi `ON DELETE SET NULL`/`CASCADE` sang chặn xoá hoặc soft-delete. | CONFIRMED — có trích dẫn migration cụ thể |
| DC-XF-31 | P0 | Lỗi render placeholder không được nuốt âm thầm — phải chặn việc đánh dấu Controlled Copy Distributed nếu render lỗi. | CONFIRMED |
| DC-XF-50 | P1 | Chặn chọn template Inactive; sửa lại đúng hợp đồng "No Template". | CONFIRMED |
| DC-XF-82 | P1 | Bỏ dòng `setChecksum(null)` cố ý, lưu đúng checksum storage đã tính. | CONFIRMED |
| DC-XF-54 | P1 | Thêm bắt buộc e-signature + audit đầy đủ khi sửa cấu hình placeholder. | CONFIRMED |
| DC-XF-72 | P1 | Tăng cường validate DOCX: kiểm required parts, giới hạn kích thước/entry count, chặn macro/ActiveX nguy hiểm — không chỉ ZIP magic. | CONFIRMED |
| DC-XF-73 | P1 | Không fail-open khi lỗi image/style — phải fail rõ ràng hoặc đánh dấu artefact degraded. | CONFIRMED |
| DC-XF-41 | P1 | Snapshot tạo lại thất bại phải phản ánh đúng trong API response/audit, không báo thành công giả. | CONFIRMED |
| DC-XF-43 | P1 | Đổi truy vấn Related Document sang dùng Revision Effective hiện hành, không phải latest-created. | CONFIRMED |
| DC-XF-74 | P1 | Thêm domain-level idempotency (unique active job + CAS) cho Publish, không chỉ dựa vào HTTP idempotency key chung. | CONFIRMED (cơ chế thiếu unique constraint), race thật cần concurrency test |
| DC-XF-51 | P1 | Publishing Job chỉ ghi audit lifecycle transition khi trạng thái thật đã đổi, không hardcode. | CONFIRMED |

**Cần làm rõ thêm trước khi sửa DC-XF-56**: đọc trực tiếp toàn bộ 3 màn hình FE đang gọi API publish
trực tiếp (chưa xác định tên cụ thể trong lần verify vừa rồi) để liệt kê chính xác entry point nào
cần loại bỏ/redirect vào Publishing Workspace pipeline.

**Test bắt buộc trước khi đóng đợt**: publish 1 Revision đầy đủ → xác nhận có published PDF + checksum
+ signature tham chiếu đúng version; thử publish khi template bị xoá/inactive → phải bị chặn; thử 2
request publish đồng thời cho cùng Revision → chỉ 1 job chạy thật.

---

## Đợt 3 — Transaction Consistency: MinIO & Microsoft Graph

Tất cả 13 mục nhóm này đã **CONFIRMED 100%** (không mục nào cần verify thêm) — độ tin cậy cao nhất để
bắt đầu ngay sau Đợt 2.

| # | Mức | Việc chính |
|---|---|---|
| DC-XF-42 | P0 | Rollback cleanup phải phân biệt file có từ trước transaction vs file mới tạo trong chính transaction đang rollback — chỉ xoá file mới tạo. |
| DC-XF-76 | P0 | Không xoá file cũ (local/NAS) trước khi transaction DB chắc chắn commit — chuyển sang xoá sau commit hoặc dùng compensating action. |
| DC-XF-71 | P0 | Graph upload: đối chiếu checksum/eTag trước khi reuse file cùng tên, không chỉ dựa filename; cần cơ chế compensation nếu DB rollback sau khi Graph đã upload thành công. |
| DC-XF-77 | P0 | Replace source khi có Graph working copy đang mở: chặn hoặc reset đúng metadata, tránh split-brain giữa 2 phiên bản. |
| DC-XF-78 | P0 | Đảo thứ tự Complete Editing: revoke quyền Graph **trước**, tải bytes **sau** (hoặc dùng conditional GET/lock để đảm bảo không có save xen giữa). |
| DC-XF-79 | P0 | Đổi mặc định cấu hình edit link từ `organization` sang giới hạn đúng participant. |
| DC-XF-35 | P1 | File Controlled Copy phải nằm trong transaction DB, hoặc dùng object key có UUID/version duy nhất để tránh ghi đè cùng path. |
| DC-XF-69 | P1 | Dọn temp file chủ động (try-finally/cleanup sau khi dùng xong) thay vì chỉ dựa `deleteOnExit`. |
| DC-XF-70 | P1 | Bỏ `synchronized` chặn toàn bộ upload; chuyển sang lock theo bucket/key cụ thể hoặc cache trạng thái đã ensure-bucket. |
| DC-XF-81 | P1 | Thêm retry có `Retry-After`, resume theo range, và reconciliation cho Graph chunk upload khi gặp 429/5xx/gián đoạn session. |
| DC-XF-32 | P0 | Đảm bảo mọi transition (workflow step/Cancel/Obsolete) đều revoke Graph access thật trước khi ghi audit "đã revoke" — không ghi audit giả khi revoke thất bại. |
| DC-XF-17 | P1 | Preview/download/print grant phải bị revoke ngay khi Recall/Cancel/Obsolete, không chờ hết TTL 15 phút. |
| DC-XF-75 | P2 | Xoá field chết `office_online_ever_synced` khỏi FE hoặc set/map đúng ở BE — chọn 1 trong 2 hướng, không để nửa vời. |

**Test bắt buộc**: giả lập DB rollback ngay sau khi Graph/MinIO upload thành công → xác nhận không có
orphan file/permission; giả lập Recall ngay sau khi cấp preview grant → link phải chết ngay, không
chờ 15 phút.

---

## Đợt 4 — Parent–Child Lifecycle Invariants (Document–Revision–Controlled Copy)

14 mục, cross-verify: đa số CONFIRMED, 3 mục PARTIALLY CONFIRMED (DC-XF-14, 15, 47) cần đọc thêm code
trước khi chốt cách sửa cụ thể — nêu rõ dưới bảng.

| # | Mức | Việc chính | Cross-verify |
|---|---|---|---|
| DC-XF-01 | P0 | `distributeBatch` chỉ được chuyển copy đang Ready; terminal copy giữ nguyên + đánh dấu `SKIPPED_TERMINAL`. | CONFIRMED |
| DC-XF-02 | P0 | Auto-obsolete khi Document/Revision Obsolete phải xử lý cả copy Ready, không chỉ Distributed. | CONFIRMED |
| DC-XF-12 | P0 | Thêm lock/CAS + kiểm tra terminal tại thời điểm commit cho Cancel Batch, đóng cửa sổ race với worker distribute đang chạy. | CONFIRMED (cơ chế), race thật cần concurrency test |
| DC-XF-18 | P0 | Chặn tạo Revision trên Document terminal; thiết kế luồng Reopen có kiểm soát riêng thay vì để Publish âm thầm "mở lại" Document. | CONFIRMED |
| DC-XF-04 | P1 | Batch Cancel không được ghi đè copy đã Obsoleted — thêm guard terminal-state (theo đúng pattern đã áp dụng ở race Controlled Copy sửa trước đó trong phiên này). | CONFIRMED |
| DC-XF-05 | P1 | Tương tự cho Batch Recall — không ghi đè reason/audit của copy đã Obsolete. | CONFIRMED |
| DC-XF-06 | P1 | Thêm `@Version` cho `ControlledCopyDistributionBatch` (hiện chưa có, khác `DocumentRecord`/`ControlledCopyRecord` đã có). | CONFIRMED |
| DC-XF-13 | P1 | Thêm lock khi tạo Request/Replacement để không tạo Ready copy ngay sau khi parent vừa Obsolete. | Cơ chế xác nhận (thiếu lock), race thật cần concurrency test |
| DC-XF-19 | P1 | Không chuyển Document Draft→Active cho tới khi Revision đầu tiên có file thật (đúng mốc nghiệp vụ đã chốt trước đó — xem `createRevisionFromDocument`). | CONFIRMED |
| DC-XF-44 | P1 | Tách rõ GET detail (không mutate) khỏi hành động "mark opened" (nếu vẫn cần, phải là action riêng có ý nghĩa, không phải side-effect của GET). | CONFIRMED |
| DC-XF-52 | P1 | Đổi cấp số Revision/Controlled Copy sang dùng DB sequence hoặc unique constraint + retry, không read-before-write. | Cơ chế xác nhận, race thật cần concurrency test |
| DC-XF-14 | P1 | **Cần đọc thêm `ControlledCopyExpiryScheduler` trước khi sửa** — cross-verify xác nhận `deriveExpectedStatus` chính có logic đúng, nhưng chưa xác nhận được claim rằng scheduler bypass logic này bằng đường riêng. | PARTIALLY CONFIRMED |
| DC-XF-15 | P1 | **Cần xác nhận cụ thể GET nào gọi `synchronize()`** trước khi sửa (đã xác nhận `synchronize()` tự nó thiếu audit, nhưng chưa xác nhận trực tiếp đường gọi từ 1 GET request). | PARTIALLY CONFIRMED |
| DC-XF-47 | P1 | **Đọc hết method `updateActiveWorkflowConfiguration` (1058 dòng)** để xác nhận có chỗ nào khác đồng bộ lại flag hay không, trước khi quyết định thêm đồng bộ ở đâu. | PARTIALLY CONFIRMED |

**Test bắt buộc**: replicate đúng 6 tình huống cross-lifecycle đã liệt kê trong prompt gốc gửi Codex
(Controlled Copy Ready + parent Obsolete, batch đang xử lý + parent đổi trạng thái, v.v.) như integration
test thật, không chỉ unit test có mock.

---

## Đợt 5 — Vận hành Controlled Copy hằng ngày

20 mục, 17 CONFIRMED, 3 cần đọc thêm (DC-XF-25, 29, 36) trước khi chốt cách sửa.

| # | Mức | Việc chính |
|---|---|---|
| DC-XF-24 | P0 | Sửa để `previewPasswordHash` thực sự được tạo/lưu khi phát hành link — hiện method set nó tồn tại nhưng không nơi nào gọi. |
| DC-XF-03 | P1 | `markAsPrinted` phải đồng bộ `currentStage` với `statusCode` thật, không set cứng về "Ready for Distribution". |
| DC-XF-20 | P1 | Sửa lại authorization cho 3 nút Retry để không tự chặn chính hành động khôi phục lỗi. |
| DC-XF-21 | P1 | Thêm lease timeout + cơ chế reclaim job/item bị treo ở PROCESSING sau khi backend restart. |
| DC-XF-22 | P1 | Thêm unique constraint hoặc idempotency key để 1 copy Lost/Damaged không tạo nhiều replacement song song. |
| DC-XF-23 | P1 | Scheduler xử lý đầy đủ cả copy Ready hết hạn; request không được chấp nhận expiry date đã ở quá khứ. |
| DC-XF-26 | P1 | Batch phải phản ánh đúng trạng thái child thật (nếu có child bị reset về Ready do lỗi, batch không được báo Distributed). |
| DC-XF-33 | P1 | Timestamp hành động GMP không được để client tự quyết; nếu parse lỗi phải throw, không âm thầm thay bằng `now()` (theo đúng pattern đã sửa cho `obsoleteDate` ở đợt Cancel/Obsolete trước đó trong phiên này). |
| DC-XF-34 | P1 | Cần quyết định: implement đầy đủ luồng Upload Evidence/Destroy/Confirm Destroy, hoặc bỏ policy field không có API thực thi tương ứng — **quyết định nghiệp vụ, hỏi trước khi code**. |
| DC-XF-36 | P1 | **Đọc thêm `canViewControlledCopy`** trước khi sửa — đổi so khớp recipient sang dùng user ID ổn định thay vì full name. |
| DC-XF-40 | P1 | Gọi đúng permission Evidence view/download đã khai báo vào endpoint thực tế. |
| DC-XF-46 | P1 | Thống nhất hợp đồng FE/BE cho mảng file: hoặc FE giữ nguyên index (kể cả null), hoặc BE ghép theo ID thay vì vị trí. |
| DC-XF-48 | P1 | Report Lost/Damaged: bắt buộc executor/witness có stable ID, không cho thiếu/gán sai theo GMP-D08. |
| DC-XF-55 | P1 | Thêm durable catch-up + alert khi Redis lock không lấy được, không bỏ qua toàn bộ lần xử lý expiry. |
| DC-XF-25 | P1 | **Đọc thêm thứ tự transaction thật** trước khi sửa — đổi gửi email sang sau khi commit + artefact finalize xong. |
| DC-XF-29 | P1 | **Đọc thêm luồng notify holder/external holder** trước khi sửa — đảm bảo notify khi parent invalidate copy. |
| DC-XF-85 | P1 | Thêm `@Version` cho `ControlledCopyPolicySetting`/`ControlledCopyExpiryLimit`. |
| DC-XF-86 | P1 | Thêm DB unique constraint (bao gồm case `NULL, NULL`) cho scope của Expiry Rule — đã có reproduction thật 2 transaction cùng commit. |
| DC-XF-87 | P1 | Không consume Print Once/ghi audit "Printed" cho tới khi có xác nhận in thành công thật từ client (hoặc chấp nhận trade-off và ghi rõ lý do nếu kỹ thuật không cho phép biết chắc). |
| DC-XF-28 | P2 | Tách riêng thống kê `SKIPPED_TERMINAL` khỏi `succeeded`, không gộp chung. |

---

## Đợt 6 — Upgrade Revision & Causal Audit

**16/16 CONFIRMED tuyệt đối** — độ tin cậy cao nhất, có thể triển khai ngay không cần đọc thêm.

| # | Mức | Việc chính |
|---|---|---|
| DC-XF-62 | P1 | Sửa `upgradeRevision` dùng đúng `source` (Effective) làm snapshot, không phải `latestRevision` (có thể đã Cancelled) — đã xác nhận chính xác dòng code dùng nhầm biến. |
| DC-XF-59 | P1 | Cho phép mỗi Document tạo nhiều Upgrade Session theo từng chu kỳ (đổi khoá unique khỏi chỉ theo `documentId`). |
| DC-XF-60 | P1 | Truyền `reasonForChange` thật vào Revision history/audit/signature, không hardcode chuỗi cố định. |
| DC-XF-61 | P1 | Gộp 2 endpoint upgrade trực tiếp vào chung 1 contract với session flow (impact assessment, chọn related/correlated, reason) — không để 2 luồng có rule khác nhau cho cùng hành động. |
| DC-XF-07 | P1 | Auto-obsolete từ Publish phải liên kết audit của Revision/Controlled Copy con với đúng `signatureSessionId` của hành động Publish gốc. |
| DC-XF-27 | P1 | Tương tự cho auto-close Document sau Cancel Revision — liên kết đúng chữ ký nguyên nhân. |

---

## Đợt 7 — Dọn Drift, Code chết, Constraint DB

Làm sau cùng, sau khi các luồng chính đã ổn định — trừ DC-XF-16 có thể đưa sớm hơn nếu migration
constraint không phụ thuộc logic đang sửa ở đợt khác.

| # | Mức | Việc chính |
|---|---|---|
| DC-XF-16 | P2 | Thêm constraint/trigger đảm bảo Copy/Batch/Revision/Document cùng 1 aggregate — có thể làm sớm cùng Đợt 4 nếu thuận tiện. |
| DC-XF-08 | P2 | Đồng bộ lại policy default/DB và runtime invariant cho Recall (Ready/Obsoleted) — chọn 1 nguồn sự thật. |
| DC-XF-09 | P2 | Xoá `reopenDocument` khỏi FE, hoặc thiết kế Reopen chính thức có policy/audit — **quyết định nghiệp vụ**. |
| DC-XF-10 | P2 | Xoá dead code Cancel Revision cũ ở FE. |
| DC-XF-11 | P2 | Sửa Dashboard đếm đúng status Document Master thật đang dùng. |
| DC-XF-30 | P2 | Đồng bộ lại: hoặc code đọc đúng các policy field đang bị bỏ qua, hoặc xoá field khỏi DB/UI. |
| DC-XF-38 | P2 | Xoá hẳn pipeline Async Review Snapshot chết, hoặc implement producer nếu vẫn cần tính năng này — **quyết định nghiệp vụ**. |
| DC-XF-53 | P2 | Thêm server-side cap cho page size API list Controlled Copy. |
| DC-XF-63 | P2 | Xoá wrapper FE `preview-opened` chết hoặc implement endpoint tương ứng. |
| DC-XF-66 | P2 | Xoá hợp đồng Review Comment chết khỏi FE (BE/DB đã loại bỏ từ trước). |
| DC-XF-75 | P2 | (Nhắc lại từ Đợt 3 nếu chưa xử lý) `office_online_ever_synced`. |

---

## Bảng theo dõi tiến độ tổng quan

| Đợt | Số mục | P0 | Trạng thái verify | Điều kiện bắt đầu |
|---|---:|---:|---|---|
| 0 — Migration | 2 | 2 | Đã tái hiện lỗi thật, độ tin cậy tối đa | Không có, bắt đầu ngay |
| 1 — Auth/Signature | 7 | 2 | Toàn bộ CONFIRMED | Sau Đợt 0 |
| 2 — Publish/Artefact | 17 | 8 | 16 CONFIRMED, 1 cần đọc thêm (DC-XF-56) | Sau Đợt 1 |
| 3 — MinIO/Graph | 13 | 6 | 13/13 CONFIRMED tuyệt đối | Sau Đợt 2 |
| 4 — Parent-child lifecycle | 14 | 4 | 11 CONFIRMED, 3 cần đọc thêm | Sau Đợt 0 (độc lập Đợt 1-3, có thể làm song song nếu đủ nhân lực) |
| 5 — Controlled Copy ops | 20 | 1 | 17 CONFIRMED, 3 cần đọc thêm | Sau Đợt 4 (phụ thuộc invariant cha-con) |
| 6 — Upgrade & causal audit | 6 | 0 | 6/6 CONFIRMED tuyệt đối | Độc lập, có thể chen vào bất kỳ lúc nào sau Đợt 0 |
| 7 — Dọn dẹp | 11 | 0 | Đa số CONFIRMED | Sau cùng |

**Gợi ý song song hoá nếu có nhiều người/agent làm cùng lúc**: sau khi xong Đợt 0+1, Đợt 2 (Publish)
và Đợt 3 (MinIO/Graph) có thể chạy song song vì phần lớn không đụng chung file; Đợt 6 (Upgrade) có thể
chen vào song song bất kỳ lúc nào vì độc lập hoàn toàn và đã CONFIRMED 100%. Đợt 4 và 5 nên làm tuần tự
vì Đợt 5 phụ thuộc trực tiếp vào invariant cha-con đã sửa ở Đợt 4.

---

## Việc cần làm rõ trước khi bắt đầu code (không tự quyết định thay)

1. **DC-XF-56**: cần liệt kê chính xác 3 màn hình FE gọi publish trực tiếp trước khi thiết kế cách hợp
   nhất vào 1 command.
2. **DC-XF-14, 15, 47**: cần đọc thêm code cụ thể (đã nêu trong bảng Đợt 4) trước khi chốt cách sửa.
3. **DC-XF-25, 29, 36**: cần đọc thêm code cụ thể (đã nêu trong bảng Đợt 5) trước khi chốt cách sửa.
4. **DC-XF-34**: quyết định nghiệp vụ — implement đầy đủ Evidence/Destroy flow hay bỏ policy field.
5. **DC-XF-9**: quyết định nghiệp vụ — có cần Reopen Document chính thức hay không.
6. **DC-XF-38**: quyết định nghiệp vụ — có cần Async Review Snapshot hay xoá hẳn.

Đề xuất: xử lý 6 điểm này (đọc code/hỏi quyết định) **trước khi bắt đầu Đợt 2, 4, 5** tương ứng, để
không phải dừng giữa chừng một đợt đang code.
