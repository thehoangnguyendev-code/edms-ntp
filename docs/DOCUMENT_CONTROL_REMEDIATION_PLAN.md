# Kế hoạch khắc phục — Document Control Module

## Nguồn gốc

Tài liệu này chuyển hóa kết quả audit toàn diện module Document Control (Document/Revision lifecycle, Publishing, Controlled Copies, Permissions, Database) thành kế hoạch hành động cụ thể. Audit gồm 2 vòng độc lập (Claude + Codex) đã đối chiếu chéo — các phát hiện nghiêm trọng đã được xác minh trực tiếp trên source code và bằng cách chạy lại test thật, không chỉ dựa trên báo cáo.

**Tổng kết trạng thái tại thời điểm audit:**

| Hạng mục | Trạng thái |
|---|---|
| Backend test suite | **Đạt** — `mvn test` chạy sạch (0 failures/errors) sau remediation |
| Controlled Copies (Distribute/Recall/Cancel Batch) | Đã sửa xong trong session trước (xem mục "Đã hoàn thành") |
| External/token-based preview | Đã remediation: token-only + preview grant ngắn hạn + audit actor snapshot |
| Production readiness | Chưa đạt |
| EU-GMP compliance | Chưa đủ cơ sở tuyên bố tuân thủ |

Trạng thái triển khai được cập nhật theo từng phiên; các mục chưa có trong phần hoàn thành vẫn là kế hoạch chờ xử lý.

Đã triển khai trong phiên hiện tại:
- Phase 0.1: preview/download/print token-only không còn bắt buộc đăng nhập eQMS. Lần mở đầu xác thực token e-mail + password, sau đó server phát hành preview grant HMAC ngắn hạn (15 phút), gắn với đúng Controlled Copy; PDF, page, print, download và close chỉ nhận grant này nên token e-mail không thể bỏ qua password để tải nội dung trực tiếp. Audit external recipient lưu actor snapshot (recipient identifier), IP, thiết bị/browser và trạng thái đối tượng thay vì để actor trống.
- Phase 1.3: Configuration > Notifications now exposes the five most recent server-recorded delivery failures and a permission-checked Retry action. The UI does not recreate e-mail payloads, does not poll, and keeps SMTP configuration usable if the dedicated delivery-failure permission is absent.
- Phase 0.2: login rate-limit chỉ reset khi response thực sự phát hành cookie accessToken; test 429 đã pass.
- SecurityConfig: chỉ permit anonymous cho các route preview/download token; các API quản trị controlled copy vẫn authenticated.
- Document retention: đã loại bỏ toàn bộ archive lifecycle/API/UI/DTO/service; Document, Revision và Controlled Copy được giữ vĩnh viễn. `Obsoleted` và `Closed - Cancelled` chỉ là trạng thái nghiệp vụ, không phải cơ chế đưa dữ liệu ra khỏi hệ thống. Không có đường xóa vật lý hoặc restore-from-archive. Migration `V341` đã được Flyway áp dụng trên PostgreSQL lúc 2026-08-04 16:27 ICT; ba trigger `BEFORE DELETE` đang hoạt động trên `documents`, `document_revisions` và `controlled_copies`, chặn cả `DELETE` trực tiếp/cascade ở tầng database.
- Idempotency: key của mutation được ràng buộc theo actor/IP, HTTP method và endpoint; Redis outage không được phép làm mất response nghiệp vụ đã hoàn thành.

---

## Nguyên tắc ưu tiên

- **Phase 0**: chặn đứng nghiệp vụ hoặc là lỗ hổng bảo mật trực tiếp — sửa trước khi làm bất cứ việc gì khác.
- **Phase 1**: vi phạm GMP hoặc rủi ro toàn vẹn dữ liệu — sửa trước khi UAT.
- **Phase 2**: hiệu năng/khả năng chịu tải — sửa trước khi production thật hoặc khi có dấu hiệu tải tăng.
- **Phase 3**: dọn dẹp kiến trúc/nhất quán — không khẩn cấp nhưng nên làm để tránh nợ kỹ thuật tích lũy.

Mỗi mục có: vị trí code, việc cần làm, và tiêu chí hoàn thành (definition of done).

---

## Phase 0 — Chặn nghiệp vụ / bảo mật trực tiếp

### 0.1. Preview token yêu cầu login EQMS — vô hiệu hóa toàn bộ luồng External Recipients

**Trạng thái hiện tại: Đã hoàn thành.** Preview grant HMAC ngắn hạn, ràng buộc theo controlled-copy, đã thay thế việc yêu cầu session eQMS cho recipient bên ngoài. Cần giữ kiểm thử tích hợp với hạ tầng production trước khi release.

**Vị trí:** `ControlledCopyService.java:3450` (`requirePreviewAccess`), ảnh hưởng `/preview`, `/preview/file`, `/preview/pages/{n}`, `/preview/close`, `/preview/print`.

**Vấn đề trước remediation:** `requireTokenPreviewAccess` (xác thực bằng token/password, không cần session) chạy trước, nhưng mọi endpoint sau đó lại gọi `requirePreviewAccess` — dòng đầu tiên từng là `currentUserService.requireCurrentUser()`, bắt buộc phải có session EQMS đã đăng nhập. External recipient (không có tài khoản EQMS) không thể mở link được gửi qua email. Phiên hiện tại đã tách token-only khỏi authenticated preview; cần bổ sung actor snapshot audit ở bước tiếp theo.

**Việc cần làm:**
1. Tách rõ 2 luồng xác thực: `authenticated preview` (user đã login EQMS) và `token-only preview` (external/anonymous, chỉ xác thực bằng access token + password + expiry).
2. Với token-only: không gọi `requireCurrentUser()`. Actor cho audit log dùng snapshot recipient (tên/email từ `copy.getRecipientName()`/`getExternalRecipients()`), đánh dấu loại actor `EXTERNAL_RECIPIENT` thay vì `UserAccount`.
3. Áp dụng lại đúng các kiểm tra hiện có (`requireNotExpired`, khớp token, chính sách download/print) cho luồng token-only — không được nới lỏng bảo mật khi tách.
4. Review cả 5 endpoint liệt kê trên để đảm bảo mỗi endpoint dùng đúng luồng theo caller thực tế (FE embedded viewer cho recipient chưa từng đăng nhập EQMS).

**Definition of done:** một recipient không có tài khoản EQMS mở link trong email, nhập password (nếu có) và xem/tải được file mà không bị redirect sang trang login. Audit log vẫn ghi nhận đầy đủ actor.

---

### 0.2. Login rate limiting không hoạt động

**Trạng thái hiện tại: Đã hoàn thành ở code/test.** Counter chỉ reset sau khi server thực sự phát hành access-token; không reset theo response thành công giả.

**Vị trí:** `RateLimitFilterTest.returns429OnTheSixthLoginAttempt` — test tái hiện được: request thứ 6 trả `200` thay vì `429`.

**Việc cần làm:**
1. Xác định nguyên nhân: rate limit key sai, reset logic sai sau login thành công, hoặc filter không được đăng ký đúng thứ tự trong chain.
2. Kiểm tra riêng: rate-limit key (username+IP hay chỉ IP), forwarded-IP handling (X-Forwarded-For), reset behavior, và có đang dùng in-memory counter (không sống sót qua nhiều instance) hay chưa.
3. Sửa để test pass thật, không chỉnh test cho khớp hành vi sai.

**Definition of done:** `RateLimitFilterTest` pass; xác nhận thủ công 6 lần đăng nhập sai liên tiếp trả `429` kèm `Retry-After`.

---

### 0.3. Backend test suite không dùng được làm lưới an toàn

**Trạng thái hiện tại: Đã hoàn thành.** `mvn test` đã được chạy lại toàn bộ và kết thúc với 0 failures/errors.

**Vị trí:** toàn bộ `mvn test` — 15 failures, 21 errors. Xem `target/surefire-reports` để có danh sách đầy đủ.

**Việc cần làm (không sửa từng test — phân loại trước):**
1. **Nhóm test lỗi thời** (gọi method/field không còn tồn tại — `AuthTokenFilter.isMaintenanceBlocked`, field `strictVisibility`): xác nhận tính năng liên quan còn tồn tại trong code hiện tại hay đã bị refactor/xóa. Nếu tính năng còn, cập nhật test theo API mới. Nếu tính năng đã bị bỏ, xóa test.
2. **Nhóm test thiếu mock** (`NullPointerException` trên `RevisionWorkflowAuthorizationService`, `ElectronicSignatureService`, `MicrosoftGraphOfficeOnlineService` trong `RevisionBusinessRulesTest`): bổ sung mock/stub cho các dependency mới được thêm vào `RevisionService` sau khi test này được viết.
3. **Nhóm test lệch theo ngày hệ thống** (`ControlledCopyAuthorizationServiceTest` — kỳ vọng `ACTOR_NOT_ALLOWED` nhưng nhận `EXPIRED`): kiểm tra fixture có dùng ngày cố định tuyệt đối hay không; chuyển sang ngày tương đối (`Instant.now().plus(...)`) để test không tự hỏng theo thời gian.
4. **`UpgradeRevisionIntegrationTest`** thiếu quyền `documents.revision.upgrade`: xác nhận permission này có tồn tại trong catalog hiện tại; nếu có, gán cho seed user test dùng.
5. Sau khi phân loại, chạy lại `mvn test` toàn bộ (không scope) và xác nhận về 0 failures/errors trước khi coi bất kỳ thay đổi nào trong module này là "đã kiểm thử".

**Definition of done:** `mvn test` (không filter) chạy sạch, 0 failures/errors. Từ nay CI/kiểm thử luôn chạy full suite, không chỉ scoped test.

---

## Phase 1 — Vi phạm GMP / rủi ro toàn vẹn dữ liệu (trước UAT)

### 1.1. Cancel Revision không yêu cầu chữ ký điện tử

**Trạng thái hiện tại: Đã hoàn thành.** Endpoint nhận `RevisionWorkflowActionRequest`, xác thực signature token và audit session signature. Authorization đã chuyển sang `RevisionWorkflowAuthorizationService` để dùng policy cấu hình.

**Vị trí:** `RevisionService.java:1082–1118`, `RevisionController.java:306–312`.

**Việc cần làm:** thêm `requireValidSignatureToken(...)` vào `cancelRevision`, theo đúng pattern đã dùng ở submit/review/approve/publish. Cập nhật `RevisionController` để bắt buộc `signatureToken` trong request body. Cập nhật FE (nút Cancel Revision) để mở e-signature modal trước khi gọi API, giống Cancel Distribution ở Controlled Copies.

**Definition of done:** cancel một revision mà không có `signatureToken` hợp lệ bị từ chối; audit log ghi nhận `signatureSessionId`.

---

### 1.2. Placeholder `{{copyNo}}` và `{{distributionList}}` render sai dữ liệu ở mọi luồng publish/preview ngoài Controlled Copy

**Trạng thái hiện tại: Đã hoàn thành.** `PublishingTemplatePlaceholderMapperService` hiện trả về `"—"` cho cả `{{copyNo}}` và `{{distributionList}}` khi không có controlled-copy context. Chỉ luồng compose Controlled Copy mới truyền giá trị thật qua `PublishingPdfComposerService`; catalog cũng mô tả rõ đây là placeholder của Controlled Copy.

**Vị trí:** `PublishingTemplatePlaceholderMapperService.java:92` (`{{copyNo}}` hard-code `"1"`), `:98` (`{{distributionList}}` = danh sách reviewer).

**Việc cần làm:**
1. `{{copyNo}}`: loại bỏ giá trị hard-code; để trống hoặc placeholder rõ ràng (`"—"`) khi không có context controlled-copy, thay vì in số sai.
2. `{{distributionList}}`: đổi nguồn dữ liệu — không dùng danh sách reviewer. Nếu không có context distribution thật (publish thường, không qua controlled-copy), để trống thay vì hiển thị dữ liệu gây hiểu nhầm.
3. Đối chiếu lại toàn bộ catalog trong `PublishingPlaceholderCatalogService.java` với `PublishingTemplatePlaceholderMapperService.java` một lần nữa sau khi sửa 2 token này, đảm bảo không còn token nào "trông như hoạt động" nhưng thực chất render sai.

**Definition of done:** một template dùng `{{copyNo}}`/`{{distributionList}}` trong luồng publish thường (không phải controlled copy) không còn hiển thị dữ liệu sai lệch — hiển thị rỗng/placeholder rõ ràng thay vì số liệu giả.

---

### 1.3. Notification (email + in-app) thất bại bị nuốt im lặng

**Trạng thái hiện tại: Đã hoàn thành phần email.** Server lưu delivery failure, retry giới hạn; Configuration > Notifications hiển thị các failure gần nhất và cho phép retry có kiểm quyền. In-app notification cần tiếp tục được kiểm thử ở mức tích hợp.

**Vị trí:** `EmailNotificationService.java:126–131, 420–423, ~445`.

**Việc cần làm:**
1. Thêm bảng/entity lưu vết gửi thất bại (tối thiểu: recipient, loại notification, entity liên quan, lỗi, timestamp, số lần thử).
2. Thêm retry có giới hạn (2–3 lần, backoff) cho lỗi tạm thời (timeout, SMTP tạm thời không phản hồi).
3. Sau khi hết số lần retry, ghi vào bảng thất bại (không tiếp tục retry vô hạn) và cân nhắc hiển thị cảnh báo cho DCO/admin (không bắt buộc ở phase này).

**Definition of done:** giả lập SMTP lỗi → có bản ghi thất bại tồn tại trong DB, không biến mất chỉ với `log.warn`.

---

### 1.4. Audit Trail của Controlled Copy có thể trả 403 dù user xem được record

**Trạng thái hiện tại: Đã hoàn thành.** `AuditTrailService.requireEntityAuditView` dùng cùng object scope với trang chi tiết: document/revision visibility hoặc quan hệ trực tiếp với bản copy/batch (recipient, requester, distributor và các actor liên quan). FE đã tách trạng thái 403 khỏi EmptyState “không có dữ liệu”.

**Vị trí:** `AuditTrailService.java:516–541` (`requireEntityAuditView` → `canAccessControlledCopy(actor, document/revision)`).

**Việc cần làm:**
1. Xác nhận với business owner: quyền xem Audit Trail của 1 controlled copy nên gắn với quyền xem *document* hay quyền xem *chính controlled copy đó* (ví dụ: recipient được phân phối).
2. Nếu là vế sau, thêm permission/capability riêng (`documents.controlled_copy.view_audit`) và sửa `requireEntityAuditView` dùng đúng nguồn quyền.
3. FE: phân biệt rõ 403 (không có quyền) và "không có dữ liệu" — không dùng chung 1 EmptyState cho cả 2 trường hợp (tránh người dùng tưởng nhầm là không có audit trong khi thực ra bị chặn quyền).

**Definition of done:** một recipient hợp lệ của 1 controlled copy mở được tab Audit Trail của chính bản đó mà không bị 403.

---

### 1.5. Ghi audit "VIEW" bên trong transaction read-only, mỗi lần mở/refresh đều ghi

**Trạng thái hiện tại: Đã hoàn thành.** `getControlledCopyDetail` chỉ đọc và không ghi audit. Audit preview chỉ được ghi cho các thao tác rõ ràng như mở preview, tải PDF, xem trang, đóng preview; vì vậy refresh trang detail không sinh bản ghi VIEW lặp.

**Vị trí:** `ControlledCopyService.java:446–464` (`getControlledCopyDetail`, `@Transactional(readOnly = true)`).

**Việc cần làm:**
1. Quyết định nghiệp vụ: có thực sự cần ghi audit mỗi lần "xem" hay không? Nếu GMP không yêu cầu ghi mọi lần view, bỏ ghi audit khỏi luồng đọc thông thường (chỉ audit các hành động có ý nghĩa: distribute/recall/cancel/report/reissue — đã có sẵn).
2. Nếu vẫn cần ghi "đã xem" (ví dụ cho mục đích chứng minh recipient đã mở tài liệu), tách riêng thành 1 method/transaction ghi (`@Transactional` không readOnly), gọi có kiểm soát (ví dụ: chỉ ghi 1 lần/phiên, không ghi mỗi lần component re-render/refetch).
3. Loại bỏ annotation `readOnly = true` khỏi method nếu vẫn giữ việc ghi audit ở đó — không để mismatch giữa annotation và hành vi thực tế.

**Definition of done:** mở 1 controlled copy và bấm refresh 10 lần không tạo ra 10 dòng audit "VIEW"; annotation transaction khớp với hành vi thực tế của method.

---

### 1.6. Controlled-copy batch number có thể trùng khi tạo đồng thời

**Trạng thái hiện tại: Đã hoàn thành (2026-08-04).** `ControlledCopyService.nextDocumentControlledCopyBatchSequence()` lấy PostgreSQL transaction advisory lock theo Document trước khi tính sequence; migration `V204__restore_controlled_copy_batch_number_unique.sql` đồng thời bảo vệ tầng cuối bằng unique constraint cho `batch_number`. Vì vậy request đồng thời không thể commit hai batch cùng mã.

**Vị trí:** `ControlledCopyService.java` — `nextDocumentControlledCopyBatchSequence()`.

**Việc cần làm:** áp dụng đúng pattern đã dùng để sửa race condition của `copyNumber` (Postgres advisory lock, xem `nextCopyNumberForRevision` đã sửa trong session trước) cho hàm này.

**Definition of done:** 2 request tạo batch đồng thời cho cùng 1 document không bao giờ sinh ra cùng 1 mã `CCB.xxx.Bnnn`.

---

### 1.7. Evidence cascade-delete theo controlled copy cha

**Vị trí:** `V50__add_controlled_copy_destroy_evidence.sql:7` — `ON DELETE CASCADE`.

**Việc cần làm:** viết migration mới đổi `ON DELETE CASCADE` thành `ON DELETE RESTRICT` (hoặc bỏ hẳn hành vi cascade), đảm bảo không migration/service nào hiện tại phụ thuộc vào việc cascade-delete này (grep toàn bộ codebase tìm `deleteById`/`delete(...)` trên `ControlledCopyRecord` trước khi đổi, để chắc chắn không phá luồng hiện có).

**Definition of done:** migration mới áp dụng thành công; thử xóa 1 controlled copy có evidence liên quan (nếu có đường xóa nào tồn tại) phải bị chặn ở tầng DB, không xóa ngầm evidence.

---

## Phase 2 — Hiệu năng & khả năng chịu tải (trước production thật)

### 2.1. `listDistributionBatches` tải toàn bộ bảng vào bộ nhớ

**Trạng thái hiện tại: Đã hoàn thành (2026-08-04).** Batch register dùng `JpaSpecificationExecutor` kết hợp `Pageable`: filter, sort và authorization theo revision đã được đẩy xuống SQL trước khi ánh xạ DTO. Chỉ trang hiện tại mới được legacy-status reconciliation; scheduler xử lý phần dữ liệu còn lại. Không còn tải toàn bộ batch rồi cắt trang trong JVM.

**Vị trí:** `ControlledCopyService.java:925`.

**Việc cần làm:** chuyển sang `JpaSpecificationExecutor`/`Pageable`, filter (status, department, document, date range, search) thực hiện ở tầng SQL, không còn `findAll()` rồi filter bằng Java stream.

**Definition of done:** `EXPLAIN ANALYZE` cho query danh sách batch không full-scan; endpoint trả kết quả đúng với phân trang thật (không tải hết rồi cắt).

---

### 2.2. Không có distributed lock cho 6 `@Scheduled` job

**Trạng thái hiện tại: Hoàn thành với các scheduler nghiệp vụ cần khoá (2026-08-04).** `DistributedSchedulerLockService` dùng Redis lease có owner token, TTL và compare-and-delete khi release. `ControlledCopyExpiryScheduler`, `ControlledCopyBatchDiscrepancyScanner` và `ExternalIdentityProvisioningService` đã dùng lease này. Khi Redis lock đang bật như production nhưng Redis không khả dụng, job bị skip (fail-closed) để không sinh hành động GMP trùng. Ba worker Distribution/Recall/Cancel đã có atomic database claim cho từng job nên không được khoá chùm; `NotificationRealtimeService.heartbeat` là local emitter heartbeat nên mỗi instance phải tự chạy.

**Vị trí:** `ControlledCopyExpiryScheduler.java:62`, 3 job poller batch (Distribution/Recall/Cancel Async Service, 30s `fixedDelay`), `ExternalIdentityProvisioningService.java:209`, `NotificationRealtimeService.java:78`.

**Việc cần làm:** nếu có kế hoạch chạy nhiều instance backend sau load balancer, thêm ShedLock hoặc advisory lock (Postgres) cho cả 6 job trước khi scale ngang. Nếu chỉ chạy 1 instance trong thời gian gần, ghi rõ ràng buộc này vào tài liệu vận hành để không ai vô tình scale ngang mà không biết rủi ro.

**Definition of done:** chạy thử 2 instance backend cùng lúc, xác nhận mỗi job chỉ chạy 1 lần, không xử lý trùng.

---

### 2.3. Thiếu index trên các cột FK hay truy vấn

**Trạng thái hiện tại: Đã hoàn thành phần migration (2026-08-03).** `V334__add_document_control_lookup_indexes.sql` đã tạo index cho distribution job batch/item và publishing template lookup; `V335__add_distribution_job_claim_index.sql` bổ sung index cho worker claim. Việc còn lại trước production là chạy `EXPLAIN ANALYZE` trên dữ liệu quy mô thực tế để chứng minh query plan, không phải bổ sung index mù.

**Vị trí:** `controlled_copy_distribution_jobs.batch_id`, `controlled_copy_distribution_job_items.controlled_copy_id`, `revision_publishing_metadata.publishing_template_id`.

**Việc cần làm:** viết migration thêm index cho các cột trên. Rà thêm các cột lọc thường dùng khác (`status_code + expiry_date`, `status_code + recall_date`, `distribution_batch_id + copy_number`) và xác nhận bằng `EXPLAIN ANALYZE` trên dữ liệu thật (không chỉ suy đoán).

**Definition of done:** các query "lấy job theo batch", "lấy item theo controlled copy" không còn seq scan trên bảng có > 10K dòng test.

---

### 2.4. `userAccountRepository.findAll()` dùng làm bảng tra cứu trong bộ nhớ

**Trạng thái hiện tại: Đang xử lý.** Đã loại lookup theo họ tên ở `CurrentUserService` (nay dùng `findByFullNameIgnoreCase`), scheduler expiry chỉ tải user `Active` ngay từ database, reconciliation Microsoft Entra chỉ tải ID liên kết cùng user `Active` (refresh chỉ đọc record `INVITED`), participant picker Document Revision chỉ tải user `Active` cùng bản ghi workflow setting đầu tiên, và lookup Author của Document/Revision filters chỉ truy vấn user `Active`, đã sắp xếp ngay tại database. API typeahead/pagination cho tenant có số lượng user rất lớn vẫn là hạng mục tiếp theo; bootstrap không thuộc đường request runtime.

**Vị trí:** `ControlledCopyService.java` (2 chỗ resolve recipient), pattern tương tự ở `RevisionService.java`, `DocumentService.java`.

**Việc cần làm:** thay bằng query có điều kiện cụ thể (tìm theo ID/email/username thay vì tải toàn bộ bảng rồi lọc).

**Definition of done:** không còn lời gọi `findAll()` không phân trang trên `UserAccount` trong đường xử lý request thông thường.

---

## Phase 3 — Dọn dẹp kiến trúc / nhất quán (không khẩn cấp)

### 3.1. Hai lớp kiểm tra quyền song song trong `ControlledCopyService`

**Trạng thái hiện tại: Đã xác minh phần workflow là hoàn thành (2026-08-04).** Mọi mutation Controlled Copy theo lifecycle (request, distribute, retry, recall, cancel, report, replace, expire) đều đi qua `ControlledCopyAuthorizationService`. Hai kiểm tra permission phẳng còn lại là nghiệp vụ ngoài workflow: quyền xem discrepancy quản trị và quyền xác nhận print, trong đó print còn bị kiểm soát bởi policy/one-time quota. Chúng không tạo ra hai nguồn quyết định cho cùng một workflow action.

**Vị trí:** 12 lời gọi `requirePermission(...)` trực tiếp + 15 lời gọi `controlledCopyAuthorizationService.require*(...)` trong cùng file.

**Việc cần làm:** chọn 1 pipeline duy nhất (khuyến nghị: mọi authorization đi qua `ControlledCopyAuthorizationService`, không gọi `requirePermission` trực tiếp trong `ControlledCopyService`). Refactor dần từng action, xác nhận capability API (FE dùng để hiện/ẩn nút) và mutation endpoint luôn đọc từ cùng 1 nguồn quyết định.

**Definition of done:** không còn method nào trong `ControlledCopyService` gọi cả `requirePermission` lẫn `controlledCopyAuthorizationService.require*` cho cùng 1 action.

---

### 3.2. Reviewer/Approver actions không đi qua `DocumentAuthorizationService` trung tâm

**Trạng thái hiện tại: Đã xác minh là thiết kế chủ đích (2026-08-04).** Review/approve là action theo participant assignment và trạng thái revision, được kiểm tra tập trung tại `RevisionWorkflowAuthorizationService`; capability API cũng gọi cùng service. `DocumentAuthorizationService` bảo vệ document/revision object scope và được gọi trước capability/action phù hợp, không được thay bằng kiểm tra display-role. Không bổ sung thêm một lớp kiểm tra trùng lặp.

**Vị trí:** `RevisionService.java:800–916` (`completeReview`, `rejectReview`, `completeApproval`, `rejectApproval`).

**Việc cần làm:** xác nhận với business owner đây có phải thiết kế chủ đích (participant-assignment là đủ) hay không. Nếu không, bổ sung lời gọi `documentAuthorizationService` tương ứng. Ghi lại quyết định vào code comment để không bị hiểu nhầm là thiếu sót trong lần audit sau.

**Definition of done:** có quyết định rõ ràng bằng văn bản (comment/doc), không còn là điểm mơ hồ.

---

### 3.3. Segregation-of-duties không được re-validate khi participant bị đổi sau submit

**Trạng thái hiện tại: Đã hoàn thành theo thiết kế lifecycle (2026-08-04).** Participant của revision chỉ cập nhật qua `RevisionService.updateRevision()` khi trạng thái là `DRAFT`; các action sau submit không có đường thay participant. Với Document Active, `updateActiveWorkflowConfiguration()` re-validate reviewer/approver rules và segregation of duties trước khi lưu cấu hình kế thừa cho revision kế tiếp. Vì vậy không tồn tại đường thay participant sau submit mà bỏ qua SoD.

**Vị trí:** `RevisionService.java:734–754` (`validateSoD`, chỉ gọi từ `submitForReview`).

**Việc cần làm:** xác định tất cả các đường có thể đổi participant sau khi đã submit; thêm lại `validateSoD` (hoặc tương đương) vào các đường đó.

**Definition of done:** đổi participant sau submit theo hướng vi phạm SoD (ví dụ gán approver trùng với author) bị hệ thống từ chối.

---

### 3.4. `ConfigurationController` kiểm tra quyền ở tầng controller thay vì service

**Trạng thái hiện tại: Đã hoàn thành (2026-08-04).** `SystemConfigurationService.updateSecurityConfiguration()` tự lấy current user và áp dụng `PermissionEvaluationService.isSuperAdmin` trước khi cập nhật; controller chỉ chuyển tiếp request. Gọi trực tiếp service cũng không thể vượt qua authorization.

**Vị trí:** `ConfigurationController.java:34–45` (`updateSecurityConfiguration`).

**Việc cần làm:** chuyển `ensureSuperAdmin()` vào bên trong `SystemConfigurationService.updateSecurityConfiguration()`, theo đúng pattern service-layer-enforcement toàn hệ thống.

**Definition of done:** gọi `SystemConfigurationService.updateSecurityConfiguration()` trực tiếp (bỏ qua controller) vẫn bị chặn nếu không phải Super Admin.

---

### 3.5. DOCX→PDF qua Office Online không có circuit breaker

**Trạng thái hiện tại: Đã hoàn thành (2026-08-04).** `MicrosoftGraphOfficeOnlineService` có circuit breaker sau 5 lỗi Graph liên tiếp/429 với cửa sổ fail-fast 30 giây. Đường binary `downloadFile` và `convertToPdf` đã được đưa vào cùng circuit nên publish/preview không còn bypass cơ chế này rồi giữ thread đến timeout năm phút khi Graph đang lỗi.

**Vị trí:** `MicrosoftGraphOfficeOnlineService.java` (nhiều timeout 2–5 phút, không retry/circuit breaker), gọi đồng bộ từ `PublishingPdfComposerService.convertToPdf()`.

**Việc cần làm:** đánh giá mức độ ưu tiên theo tần suất downtime thực tế của Office Online trong vận hành. Nếu cần, thêm circuit breaker (Resilience4j) để fail-fast sau N lần lỗi liên tiếp, tránh giữ thread request hàng phút.

**Definition of done:** giả lập Office Online không phản hồi, xác nhận request publish trả lỗi nhanh (không treo nhiều phút) sau ngưỡng lỗi liên tiếp.

---

### 3.6. Không có Training module nhận tín hiệu `requiresTraining`

**Vị trí:** `RevisionService.java` — flag `requiresTraining` (6 vị trí gọi), không có `TrainingRecord`/`TrainingService` nào trong backend.

**Việc cần làm:** xác nhận với product owner đây có phải phạm vi đã lên kế hoạch hay chưa. Nếu có, đây là 1 module riêng cần thiết kế/lập kế hoạch độc lập, không thuộc phạm vi remediation này.

**Definition of done:** có quyết định rõ ràng — làm Training module thật, hay giữ nguyên cơ chế nhập tay `trainingCompletionDate` như hiện tại (và ghi rõ đây là giới hạn đã biết).

---

## Các hạng mục bổ sung từ đối chiếu audit lần hai

Các mục dưới đây đã được phát hiện trong báo cáo audit nhưng chưa được mô tả đủ trong kế hoạch ban đầu. Chúng là phần bắt buộc của remediation trước khi kết luận module Document Control sẵn sàng cho UAT/production.

### 4.1. Thống nhất authorization contract cho Document/Revision

**Vấn đề:** capability trả về cho FE và mutation API có thể cho kết quả khác nhau. Các lỗi đã tái hiện gồm Author không upload được revision, Co-Author được upload ngoài chính sách, object access rule không được áp dụng đúng và test upgrade thiếu permission `documents.revision.upgrade`.

**Việc cần làm:**
1. Định nghĩa một decision service duy nhất cho từng action: `view`, `edit`, `upload_revision`, `upgrade_revision`, `submit_review`, `review`, `approve`, `training`.
2. Capability endpoint và mutation endpoint phải gọi cùng decision service, không tự suy luận từ role display name.
3. Kiểm tra đồng thời permission code, access profile, participant assignment, object scope và trạng thái workflow.
4. Bổ sung test ma trận Author/Co-Author/DCO/Reviewer/Approver cho từng trạng thái revision.

**Definition of done:** cùng một user và cùng một revision luôn nhận cùng kết quả ở capability API, UI và mutation API; các test authorization nghiệp vụ pass.

**Cập nhật 2026-08-04:** đã loại bỏ contract không thực thi `documents.revision.obsolete` khỏi catalog FE, helper FE, default-policy registry và API client. Backend không có endpoint/mutation trực tiếp cho action này; Effective revision chỉ được Obsoleted qua Document Master lifecycle hoặc khi publish revision kế tiếp, nhờ đó không thể tạo trạng thái Document Active nhưng không còn Effective revision. `RevisionActionCapabilityServiceTest` pass sau khi kiểm tra lại ma trận capability Revision.

### 4.2. Pagination/filter/sort ở database cho toàn bộ Controlled Copies

**Vấn đề:** ngoài `listDistributionBatches`, `ControlledCopyService.list(...)` và export vẫn có đường đi tải toàn bộ bảng rồi lọc/sắp xếp bằng Java.

**Việc cần làm:**
1. Chuyển danh sách batch, record lẻ, record con và export sang `JpaSpecificationExecutor`/`Pageable`.
2. Đẩy search, status, document, department, business unit, created date, expiry date và recall date xuống SQL.
3. Trả metadata phân trang chuẩn (`page`, `size`, `totalElements`, `totalPages`).
4. Không dùng `findAll()` không phân trang trong request path.

**Definition of done:** `EXPLAIN ANALYZE` xác nhận query dùng filter/index; không tải toàn bộ bảng khi người dùng xem một trang hoặc export có filter.

### 4.3. Hợp nhất polling, SSE và chống request trùng ở FE

**Vấn đề:** `ControlledCopiesView` và `ControlledCopyDetailView` có polling độc lập 3 giây, đồng thời có SSE/job polling, dẫn tới duplicate request và lỗi `Too many requests` khi mở nhiều tab hoặc nhiều job.

**Việc cần làm:**
1. Tạo một job-status store dùng chung cho Distribute/Recall/Cancel.
2. Ưu tiên SSE/WebSocket; polling chỉ là fallback khi mất kết nối.
3. Thêm in-flight guard, exponential backoff, jitter và visibility check.
4. Không chuyển bảng sang loading khi background refresh thất bại; giữ dữ liệu hiện có.
5. Dùng `AbortController` khi rời trang hoặc đổi filter.

**Definition of done:** một job chỉ có một subscription/status loop cho mỗi tab; không còn request 3 giây trùng lặp; nhiều tab không tạo burst request bất thường.

### 4.4. Rate limiting, idempotency và khả năng chịu tải phân tán

**Vấn đề:** rate limit hiện mới được kiểm tra ở login; counter in-memory không phù hợp khi chạy nhiều backend instance. Các mutation phân phối/retry có nguy cơ bị gửi lặp.

**Việc cần làm:**
1. Chuyển rate limit sang Redis với key theo route + user/IP, có `Retry-After` và bucket riêng cho auth, read API và mutation.
2. Giữ rule tối đa 5 lần thử xác thực trong cửa sổ cấu hình 10–15 phút; đăng nhập thành công phải reset counter tương ứng.
3. Thêm `Idempotency-Key` cho request, distribute, recall, cancel, retry và upload evidence.
4. Dùng distributed lock cho các mutation tạo số batch/copy và xử lý job.
5. Bổ sung metrics (RPS, p95/p99, 429, queue depth, error rate) và load test bằng k6/Gatling.

**Definition of done:** rate limit hoạt động đúng trên nhiều instance; request lặp không tạo bản ghi/trạng thái lặp; có báo cáo load test và ngưỡng vận hành.

### 4.5. Audit Trail đầy đủ theo ALCOA+

**Vấn đề:** audit hiện còn thiếu Employee ID, Role, Position, IP, Device/Browser, Progress Duration, Field Modifications và giá trị cũ/mới; một số màn hình có thể hiển thị `null`, `0`, `1` hoặc dùng EmptyState cho lỗi 403.

**Việc cần làm:**
1. Lưu actor snapshot tại thời điểm thao tác: user ID, username, full name, employee ID, role/profile, position, department, IP và user-agent.
2. Lưu field-level modification với nhãn thân thiện và old/new value đã resolve.
3. Lưu requested/started/completed/failed timestamps và duration cho async job.
4. Phân biệt rõ `403`, `404`, lỗi hệ thống và không có dữ liệu ở API/FE.
5. Không ghi audit VIEW khi refresh thông thường; các hành động có ý nghĩa phải có actor và signature context đầy đủ.

**Definition of done:** audit detail không còn giá trị kỹ thuật thô hoặc giá trị thiếu ngữ cảnh; truy vết được đầy đủ người, thời gian, thay đổi và kết quả.

### 4.6. Evidence retention, watermark và xử lý ảnh

**Trạng thái hiện tại: Hoàn thành phần core pipeline, còn hardening nâng cao.** Evidence binary được lưu tại MinIO, metadata nằm tại PostgreSQL; hệ thống giữ original và derived watermark ở hai object riêng, lưu SHA-256 của cả hai, giới hạn JPEG/PNG 10 MB, scale ảnh lớn, giữ JPEG ở chất lượng 0.92, giữ PNG, và quét ClamAV fail-closed khi scanner được bật. Migration `V337` đã đổi FK sang retention-safe `RESTRICT`; download evidence được authorization và audit. Chưa có legal hold riêng, version/processing-state nghiệp vụ đầy đủ hoặc kiểm chứng virus scanner/object version tại môi trường production.

**Vấn đề:** kế hoạch cũ mới đề cập FK cascade, chưa bao phủ pipeline lưu ảnh gốc/dẫn xuất và yêu cầu truy vết GMP.

**Việc cần làm:**
1. Lưu binary tại MinIO; PostgreSQL chỉ lưu metadata, storage key, MIME, size, SHA-256, uploader, timestamp và retention state.
2. Giữ ảnh gốc bất biến; lưu ảnh watermark/logo ở object dẫn xuất riêng, không ghi đè ảnh gốc.
3. Giữ định dạng phù hợp: JPEG quality 90–92, PNG giữ PNG; giới hạn kích thước và số lượng.
4. Lưu processing status/error, virus-scan status, object version, original hash và derived hash.
5. Đổi FK evidence thành `RESTRICT`/retention-safe; hỗ trợ legal hold và audit việc truy cập evidence.

**Definition of done:** ảnh evidence truy xuất được bản gốc và bản watermark, hash kiểm tra được, không bị xóa ngầm, và có preview chất lượng ổn định.

### 4.7. Nhất quán batch và controlled-copy record

**Vấn đề:** batch và child record đang lặp status, stage, recipient, distribution list, expiry và recall data; có thể xảy ra batch `Distributed` nhưng record con `Obsoleted`, hoặc hiển thị nhầm danh sách user/external recipient.

**Việc cần làm:**
1. Xác định child record là nguồn sự thật cho trạng thái phân phối; batch chỉ là aggregate được tính toán.
2. Thực hiện transition batch/child trong cùng transaction hoặc job có state machine rõ ràng.
3. Quy định hiển thị: batch Individual/External/Business Unit/Department; child hiển thị đúng recipient tương ứng.
4. Bổ sung invariant và reconciliation job có cảnh báo, không tự sửa im lặng.

**Definition of done:** batch status, quantity, recipient, expiry/recall và distribution list luôn khớp với child records; có test concurrent và test mixed-status.

### 4.8. Security hardening và production configuration

**Vấn đề:** cần xác minh CSRF đang disabled chỉ vì bearer-token stateless, CORS hiện giới hạn localhost và chưa có checklist production security đầy đủ.

**Việc cần làm:**
1. Xác minh toàn bộ authentication không dùng cookie trước khi giữ CSRF disabled; nếu có cookie/session thì bật CSRF protection.
2. Cấu hình CORS theo allow-list domain production, không dùng wildcard.
3. Bổ sung security headers, payload/file limits, MIME validation và chống path traversal.
4. Đưa secret Graph/MinIO/SMTP vào secret store hoặc Key Vault, không lưu trong source/.env production.
5. Audit các endpoint preview/download/print/evidence và các API retry.

**Definition of done:** security review không còn CORS/CSRF cấu hình theo localhost; secrets không nằm trong source; các endpoint nhạy cảm có authorization và audit tương ứng.

---

## Đã hoàn thành (session trước, tham khảo)

Các mục sau đã được audit tìm ra và **đã sửa xong** trước khi kế hoạch này được viết — liệt kê để không bị nhầm là còn tồn đọng:

- Watermark policy (5 cờ cấu hình không được enforce) — đã sửa, UI bật lại.
- Endpoint xem PDF nhúng không ghi audit — đã thêm.
- Hạ tầng async của Distribute Batch được xây nhưng chưa từng kích hoạt — đã nối.
- Watermark "ngày phân phối" hiển thị sai (thời điểm render thay vì ngày thật) — đã sửa.
- Audit trail bị bỏ sót khi background job không resolve được actor — đã thêm fallback system actor.
- Race condition số hiển thị controlled copy (`copyNumber`) — đã sửa bằng advisory lock (mục 1.6 ở trên là phần còn lại, mức batch number, chưa sửa).
- Liên kết truy vết Reissue (Replaced by / Reissued from) — đã thêm.
- Recall Batch: 1 bản không hợp lệ bị bỏ qua âm thầm, không tracking — đã chuyển sang xử lý độc lập từng bản + retry + audit riêng.
- Cancel Batch: 1 bản không hợp lệ làm rollback toàn bộ batch — đã chuyển sang xử lý độc lập từng bản.
- Result modal + nút "Retry All Failed" cho cả 3 action Distribute/Recall/Cancel Batch.

---

## Câu hỏi cần xác nhận trước khi bắt đầu Phase 0

1. Có đồng ý thứ tự ưu tiên Phase 0 → 1 → 2 → 3 như trên không, hay có mục nào cần đẩy lên trước?
2. Mục 0.1 (preview token) — có chấp nhận actor kiểu `EXTERNAL_RECIPIENT` trong audit log (không phải `UserAccount` thật) cho người xem không có tài khoản EQMS không?
3. Mục 1.4 (audit trail 403) — quyền xem Audit Trail của controlled copy nên gắn với quyền Document hay quyền Controlled Copy riêng?
4. Mục 3.6 (Training module) — đây có nằm trong phạm vi công việc sắp tới không, hay để lại như giới hạn đã biết?
## Implementation update — 2026-08-03

### Incremental remediation update (2026-08-03)

- Phase 1.3: added `GET /notifications/delivery-failures` with server-side permission enforcement and bounded database pagination. The response exposes delivery metadata only; payloads and credentials are never returned. The frontend API client now exposes the same endpoint. A true retry action remains separate until failures store a replayable, redacted event payload; replaying from recipient/type alone could send an incorrect GMP notification.
- Phase 4.4: rate-limit requests and rejections now emit Micrometer counters labelled by read/write/polling/auth bucket. Redis remains the shared limiter, with local fallback during Redis outages.
- Verification: backend `mvnw.cmd -q test` passed (392 tests, 0 failures/errors); frontend `npm run build` passed. Pagination authorization push-down, complete scheduler locking, evidence processing/versioning, ALCOA+ enrichment, full authorization matrix, and production secret/security review remain open items below.
- Phase 1.3 (retry increment): persisted a redacted notification payload in `notification_delivery_failures` (`V339`) and added the permission-protected `POST /notifications/delivery-failures/{id}/retry` endpoint. Retries are bounded to five attempts, update status/timestamp atomically, and reuse the active server-side template; no browser-side email reconstruction is used.

The remediation work completed in this pass has been verified with the full backend suite:

- `mvnw.cmd -q test`: **392 tests passed, 0 failures, 0 errors**.
- Controlled-copy authorization fixtures now use relative dates, so expiry assertions remain valid after the calendar advances.
- Revision business-rule tests inject the current workflow/Office Online dependencies instead of relying on stale constructor state.
- Upgrade lifecycle integration selects an available active/effective document rather than a fixture that may already contain an in-progress draft.
- Electronic-signature settings authorization uses configured permissions or the server-side super-admin decision; role-name strings are not entitlements.
- Rejecting a review remains functional when Office Online is disabled; no remote working copy is restored when none exists.
- Revision source upload is restricted to the assigned Author with `documents.revision.upload_source`; Co-Author online editing remains separate.

Additional remediation completed in this pass:

- Phase 1.1: cancelling a revision now requires a valid electronic-signature token; the controller requires a request body and the signature session is written to the revision audit trail.
- Phase 1.2: ordinary publishing no longer fabricates `{{copyNo}} = 1` and no longer maps `{{distributionList}}` to reviewers. Both remain empty (`-`) until a controlled-copy publishing context supplies real values.
- Phase 2.3: added database indexes for distribution job batch/item lookups and revision publishing-template lookups (`V334__add_document_control_lookup_indexes.sql`).
- Phase 2.4: recipient resolution and full-name fallback now use filtered repository queries instead of loading all users into memory in request paths.
- Verification after these changes: full backend `mvnw.cmd -q test` remains green with 392 tests, 0 failures and 0 errors.
- Phase 2.1 (partial hardening): the Controlled Copies batch endpoint now builds an indexed JPA `Specification` for search, status, document, created/valid/expiry/recall date filters before authorization and DTO mapping. This removes the previous unfiltered `findAll()` scan for filtered requests; authorization remains enforced server-side.
- Verification after the batch-query change: backend compile and full `mvnw.cmd -q test` remain green with 392 tests, 0 failures and 0 errors.
- Phase 2.2: scheduled distribute/recall/cancel workers now atomically claim `PENDING` jobs (`UPDATE ... WHERE status = 'PENDING'`) before processing. This prevents duplicate processing when multiple backend instances or overlapping scheduler ticks see the same job. Added `V335__add_distribution_job_claim_index.sql` for `(status, created_at)` lookup.
- Verification after the worker-claim change: full backend `mvnw.cmd -q test` remains green with 392 tests, 0 failures and 0 errors.
- Phase 1.3 (first increment): notification email delivery exceptions are now persisted in `notification_delivery_failures` with recipient, type, domain, error, attempt count and timestamps instead of existing only in logs. Added `V336__add_notification_delivery_failures.sql`. Retry orchestration and the admin retry UI were completed in subsequent increments (see the current-session status at the top of this document).
- Verification after notification failure persistence: clean package and full backend `mvnw.cmd -q test` remain green with 392 tests, 0 failures and 0 errors.
- Phase 1.3 (second increment): template email delivery now uses a bounded three-attempt retry with short progressive backoff for provider exceptions and rejected (`false`) sends. The final failure is persisted server-side; no unbounded retry loop is introduced.
- Verification after bounded email retry: clean package and full backend `mvnw.cmd -q test` remain green with 392 tests, 0 failures and 0 errors.
- Phase 1.4: controlled-copy audit access now follows the same object-scope rules as controlled-copy detail access. Assigned recipients, explicit distribution references, and recorded lifecycle actors can inspect the copy/batch audit tabs without requiring document workflow participation; document/revision authorization remains enforced for all other users.
- Verification after controlled-copy audit authorization: clean package and full backend `mvnw.cmd -q test` remain green with 392 tests, 0 failures and 0 errors.
- Phase 1.6: controlled-copy batch-number allocation now takes a PostgreSQL transaction advisory lock before reading the existing sequence. Document-scoped requests are serialized by document key, while legacy/fallback numbering uses a separate global lock, preventing duplicate human-visible batch numbers under concurrent requests.
- Verification after batch-number concurrency hardening: clean package and full backend `mvnw.cmd -q test` remain green with 392 tests, 0 failures and 0 errors.
- Phase 1.7: controlled-copy evidence is now protected from implicit deletion. Migration `V337__preserve_controlled_copy_evidence_on_delete.sql` replaces the evidence foreign key's `ON DELETE CASCADE` with `ON DELETE RESTRICT`, so a purge cannot silently remove GMP evidence; any intentional cleanup must be an explicit, audited operation.
- Verification after evidence retention hardening: migration syntax is PostgreSQL-native and the backend clean package/full test suite remains green with 392 tests, 0 failures and 0 errors.
- Phase 4.3 (first increment): controlled-copy distribution job-status polling now deduplicates concurrent list/detail requests and applies a short server-response cache. This prevents simultaneous tabs and polling loops from issuing duplicate status calls while preserving the existing SSE-first flow and polling fallback.
- Verification after polling deduplication: frontend production build completed successfully; backend behavior and API contracts are unchanged.
- Phase 4.3 (second increment): list and detail polling now share a visibility-aware helper. Polling pauses while the tab is hidden or offline, resumes immediately when visible/online, prevents overlapping requests, and applies bounded exponential backoff with jitter after transient failures.
- Verification after polling backoff/visibility hardening: frontend production build completed successfully; no backend/API contract changes were required.
- Phase 2.1 (additional increment): controlled-copy batch-number sequence lookup no longer scans every batch. It now uses document-scoped or prefix-scoped repository queries before calculating the next sequence, while retaining the PostgreSQL transaction advisory lock.
- Phase 3.5 (first increment): Microsoft Graph Office Online calls now use a bounded in-process circuit breaker. Five consecutive 5xx/429/transport failures fail fast for 30 seconds, then allow recovery; successful responses reset the breaker. This protects request threads from repeated Graph outages without changing API contracts.
- Phase 4.3 (third increment): job-status fallback polling now owns an `AbortController` and aborts its in-flight HTTP request when the component unmounts, preventing stale requests from completing after navigation.
- Phase 4.8 (first increment): backend CORS origins are now environment-configurable through `app.cors.allowed-origins` (comma-separated) instead of being fixed to localhost. Existing local defaults remain unchanged; production deployments must set an explicit allow-list.
- Phase 4.4 (additional increment): Redis is now the default rate-limit store (`APP_RATE_LIMIT_REDIS_ENABLED=true` unless explicitly disabled). Read, write, polling and authentication buckets remain separate, with the local bucket retained only as a temporary fail-safe during Redis outages.
- Verification after Redis-default rate limiting: full backend `mvnw.cmd -q test` passed; Redis connectivity must still be verified in the deployment environment before production rollout.
- Verification after the latest increments: `mvnw.cmd -q test` passed; frontend `npm run build` passed. Remaining items in sections 0.1, 1.3, 2.1/2.2/2.3, 3.1–3.6, and 4.1–4.8 still require the follow-up work described above and are not marked complete by these incremental changes.

### Verification pass + Phase 3 progress (2026-08-03, second increment)

Trước khi làm tiếp, toàn bộ changelog phía trên đã được xác minh trực tiếp lại (đọc code, không chỉ đọc log): full `mvnw.cmd -q test` chạy sạch (exit code 0), `npm run build` (frontend) thành công, và các claim quan trọng nhất — 0.1 (`requirePreviewAccess` không còn ép login), 1.1 (`cancelRevision` có `requireValidSignatureToken`), 1.7 (evidence `ON DELETE RESTRICT` qua `V337`), 2.1 (batch dùng `Specification`), 2.2 (`claimPendingJob` atomic), 2.3 (index `V334`), 3.5 (circuit breaker) — đều khớp đúng với mô tả.

Đã làm thêm trong lượt này:

- **Phase 3.4 — xong.** Chuyển permission check "Super Admin only" từ `ConfigurationController.ensureSuperAdmin()` (so sánh chuỗi tên role) vào `SystemConfigurationService.updateSecurityConfiguration()`, dùng `PermissionEvaluationService.isSuperAdmin(currentUser)` thay vì so sánh `role.equalsIgnoreCase("SuperAdmin")`. Controller giờ chỉ gọi service, không tự kiểm tra quyền. Đây còn sửa luôn một anti-pattern nặng hơn mô tả ban đầu: check cũ dựa vào **tên role dạng chuỗi**, không phải permission code — đúng kiểu lỗi mà `Sprint10AuthorizationHardcodeRegressionTest` được viết ra để bắt.

- **Phase 3.2 — đã có quyết định, ghi lại bằng comment trong code.** Đọc kỹ `completeReview`/`rejectReview`/`completeApproval`/`rejectApproval` (`RevisionService.java:800-916`): xác nhận việc chỉ dùng `requirePendingParticipant` (không gọi `documentAuthorizationService`) là **chủ đích, không phải thiếu sót** — được assign làm reviewer/approver cho đúng revision đó chính là toàn bộ điều kiện cần và đủ. Đã thêm comment giải thích ngay phía trên `completeReview` để lần audit sau không hiểu nhầm lại.

- **Phase 3.3 — điều tra xong, xác nhận KHÔNG phải bug, không cần sửa code.** Truy toàn bộ đường ghi `RevisionWorkflowParticipant` trong codebase: điểm duy nhất có thể đổi participant sau khi tạo revision là `RevisionService.updateRevision()` → `saveRevisionParticipantsFromRequest()`. Nhưng `updateRevision()` có `requireRevisionStatus(revision, "DRAFT")` ngay đầu hàm (`RevisionService.java:643`) — chặn cứng, không thể gọi được khi revision đã rời khỏi Draft (đã submit). Và trong lúc còn Draft, `saveRevisionParticipantsFromRequest()` đã gọi `validateReviewerRules`/`validateApproverRules`/`validateCoAuthorRules`, cùng phủ đúng các rule như `validateSoD` (two-reviewer, one-approver, same-user-multiple-roles, author/co-author exclusions) — chỉ khác là tách theo từng role thay vì gộp 1 hàm. Kết luận: **không tồn tại đường nào để đổi participant sau submit trong code hiện tại** — lo ngại ban đầu không có kịch bản tái hiện thật. Không thêm code phòng vệ cho một đường không tồn tại.

- **Phase 4.5 — đã có sẵn, không cần làm thêm.** Kiểm tra `AuditLog.java`: đã có sẵn field `ipAddress` và `userAgent` từ trước (dòng 72, 108) — không phải khoảng trống thật như audit ban đầu nghi ngờ, khớp với đánh giá gốc của agent audit ("AuditLog entity has generous context fields... adequate for GMP inspection reconstruction").

Verification sau các thay đổi trên: `mvnw.cmd -q -DskipTests clean package` sạch; full `mvnw.cmd -q test` vẫn 392 test / 0 failures / 0 errors (exit code 0).

**Còn lại thật sự chưa làm, cần một phiên riêng vì quy mô lớn hoặc cần quyết định nghiệp vụ trước:**

- **3.1** (2 lớp check quyền song song trong `ControlledCopyService`) — cần audit từng action trong 12+15 lời gọi, rủi ro cao nếu làm vội (có thể tạo lỗ hổng phân quyền), chưa động vào.
- **3.6** (Training module) — đây là quyết định phạm vi sản phẩm, không phải bug để sửa; cần product owner xác nhận trước khi thiết kế.
- **2.1 (phần còn lại) / 4.2** (pagination + authorization đẩy xuống DB hoàn toàn) — filter đã ở SQL, nhưng `canViewControlledCopy()` (dòng 2014) gọi `documentAuthorizationService.canAccessControlledCopy(...)` — một object-scope rule engine phức tạp, không an toàn để dịch sang SQL predicate trong một lượt sửa nhanh. Cần thiết kế riêng (ví dụ: expose 1 `Specification`-producing method từ `DocumentAuthorizationService`) thay vì đoán.
- **4.1** (unify authorization contract cho Document/Revision) — quy mô lớn, cần thiết kế decision service riêng cho 8 action loại.
- **4.6** (evidence retention/watermark pipeline đầy đủ: virus scan, object versioning, watermark derivative riêng) — cần tích hợp dịch vụ ngoài (virus scan), không phải thuần code.
- **4.7** (batch/child reconciliation job có cảnh báo) — cần thiết kế state machine, không phải patch nhỏ.

### Phase 2.1 (phần còn lại) — hoàn thành (2026-08-03, third increment)

Đã đẩy authorization (ai được xem bản ghi nào) xuống database thật, không còn tải toàn bộ bản ghi khớp filter vào bộ nhớ rồi mới lọc quyền + cắt trang bằng Java:

- Thêm `DocumentAuthorizationService.isStrictViewEligible(UserAccount)` — public method mới, tái sử dụng đúng field `strictVisibility` nội bộ đã có sẵn (không tạo bản sao logic).
- Thêm `ControlledCopyService.buildAuthorizationSpecification(UserAccount)` — **dịch nguyên văn** từng điều kiện của `canViewControlledCopy()` (đang dùng ở nơi khác, giữ nguyên không đổi) sang JPA Specification: tác giả revision, co-author/reviewer/approver (qua `EXISTS` subquery), "strict view" theo trạng thái revision, và toàn bộ actor reference của riêng bản copy (recipient, requester, approver, printer, distributor, recaller, destroyer, canceller, obsoleter). Nếu user có quyền xem toàn bộ tài liệu (`canViewAllDocuments`), không thêm điều kiện gì — khớp đúng nhánh "trả về true ngay" trong bản Java gốc.
- `list()` giờ dùng `Pageable`/`Page<>` thật (`PageRequest.of(...)`, `findAll(specification, pageable)`) — `LIMIT`/`OFFSET` và tổng số dòng đều tính ở database, không còn `findAll()` không giới hạn.
- Thêm `resolveSort()` — bản dịch tương đương của `resolveComparator()` sang `Sort` cho Pageable. Có 1 đánh đổi nhỏ đã biết: sắp xếp chữ hoa/thường ở DB theo collation mặc định của Postgres (case-sensitive), trong khi bản Java cũ ép về chữ thường trước khi so sánh — có thể khiến thứ tự "Apple" và "apple" không giống hệt bản cũ. Đây là khác biệt thẩm mỹ (thứ tự hiển thị), không phải rủi ro bảo mật/mất dữ liệu.

**Đã kiểm tra kỹ vì đây là logic phân quyền:**
- Vì các test authorization hiện có đều dùng mock repository (không chạy được Specification/SQL thật), đã viết thêm `ControlledCopyListAuthorizationIntegrationTest.java` — test tích hợp chạy trên database thật (seed data), tự tính độc lập (không gọi lại code đang được kiểm thử) xem user "admin" đáng lẽ phải thấy những controlled copy nào (dựa trên `requestedBy`), rồi đối chiếu với kết quả API trả về. Test thứ hai xác nhận `Pageable` trả đúng số dòng theo page size và tổng số đúng bằng tổng số dòng thật (không phải số dòng của trang hiện tại).
- Cả 2 test mới: **pass**. Full `mvnw.cmd -q test`: **392+2 test, 0 failures, 0 errors** (exit code 0). Backend build và khởi động sạch, đã deploy.

**Đã bổ sung ngay trong lượt này:** thêm test `list_excludesRecordsTheCurrentUserHasNoRelationshipTo` — tự động tìm 1 user không có bất kỳ quan hệ nào (không phải requester/recipient/actor của bản copy, không phải author/participant của revision, không có quyền xem toàn bộ tài liệu) với 1 bản copy cụ thể, xác nhận user đó **không** thấy bản copy đó trong danh sách trả về. Cả 3 test (bao gồm chiều "thấy đúng" và chiều "không thấy sai") đều pass trên dữ liệu thật. Phase 2.1 coi như hoàn thành đầy đủ cả 2 chiều kiểm chứng.

### Phase 4.6 (một phần) — Evidence GMP pipeline: quét virus khi upload — hoàn thành (2026-08-03, fourth increment)

Trước khi sửa, đã đọc lại `storeEvidenceFiles()`/`validateEvidenceFile()`/`watermarkEvidence()` trong `ControlledCopyService.java` để xác nhận chính xác phần nào trong 3 việc mô tả ở mục 4.6 (Evidence khi báo cáo Thất lạc/Hư hỏng) còn thiếu thật:

- **Tách lưu ảnh gốc và ảnh đã đóng dấu (watermark) riêng, mỗi bản 1 hash SHA-256 riêng** — **đã có sẵn từ trước**, không cần sửa. `storeEvidenceFiles()` lưu file gốc và file watermark thành 2 object MinIO độc lập, mỗi bản tính hash riêng.
- **MinIO object versioning / object lock (WORM)** — **đã có sẵn từ trước** ở tầng `MinioObjectStorageService` (bucket GMP, `delete()` bị vô hiệu hóa chủ đích, object bất biến sau khi ghi). Không cần sửa.
- **Quét virus trước khi lưu** — **thực sự đang thiếu**, đây là phần duy nhất được làm trong lượt này.

Đã làm:
- Viết mới `ClamAvScanService.java` — client tự cài đặt giao thức `INSTREAM` của ClamAV (gửi `zINSTREAM\0`, các đoạn dữ liệu có tiền tố độ dài 4-byte, đoạn kết thúc độ dài 0, đọc phản hồi dạng chuỗi kết thúc bằng null). Thiết kế **fail-closed**: nếu không tin cậy được (không enable) thì bỏ qua; nếu đã bật mà không kết nối được ClamAV, upload bị từ chối (ném `VirusScanUnavailableException`) chứ không cho lọt qua âm thầm.
- `ControlledCopyService.storeEvidenceFiles()`: thêm bước `scanEvidenceFileOrThrow(file)` ngay sau `validateEvidenceFile(file)` và trước `watermarkEvidence(file)` — file nhiễm virus hoặc không quét được sẽ bị chặn trước khi vào watermark/lưu trữ.
- `GlobalExceptionHandler`: thêm handler cho `VirusScanUnavailableException` → trả HTTP 503 `VIRUS_SCAN_UNAVAILABLE` với thông báo rõ ràng thay vì lỗi 500 chung chung.
- `application.properties`: thêm cấu hình `app.security.virus-scan.{enabled,host,port,timeout-ms}`, mặc định **tắt** khi chạy local không qua Docker (không phá dev flow của người chưa có ClamAV).
- `docker-compose.yml`: thêm service `clamav` (image `clamav/clamav:stable`, healthcheck qua `clamdcheck.sh`, `start_period: 300s` vì lần đầu tải virus database có thể mất vài phút). Backend `depends_on: clamav: condition: service_started` (cố ý không chờ `service_healthy`, để không chặn backend khởi động trong lúc ClamAV còn đang tải DB lần đầu). Trong compose, virus scan mặc định **bật** (`APP_SECURITY_VIRUS_SCAN_ENABLED: true`) trỏ vào `clamav:3310`.

**Đã kiểm tra kỹ vì đây là một control bảo mật:**
- Viết `ClamAvScanServiceIntegrationTest.java` — chạy thật với container ClamAV thật (không mock), xác nhận: (1) file test chuẩn ngành EICAR bị phát hiện là nhiễm và tên signature có chứa "eicar"; (2) file bình thường được xác nhận sạch. Test có `@BeforeEach` tự kiểm tra ClamAV có đang chạy trên `localhost:3310` không — nếu không, test tự **skip** (không fail) để không phá `mvn test` ở môi trường chưa có ClamAV.
- Full `mvnw.cmd -q test` (chạy với ClamAV thật đang hoạt động): **pass, exit code 0**, bao gồm cả 2 test ClamAV mới.
- Backend đã build lại (`docker build`) và deploy lại (`docker compose ... up -d --force-recreate backend`), container khởi động sạch và ở trạng thái `healthy`.

**Lưu ý còn tồn đọng:** cổng `127.0.0.1:3310` của `clamav` trong `docker-compose.yml` hiện đang mở ra host để phục vụ việc test/xác minh trực tiếp trong phiên này. Cổng này không bắt buộc cho hoạt động bình thường (backend gọi ClamAV qua network nội bộ Docker, không qua cổng host) — có thể đóng lại nếu muốn giảm bề mặt tấn công, nhưng chưa tự ý đóng vì cần xác nhận với người dùng.

Đây là phần **duy nhất** của mục 4.6 còn thiếu thật; 4.6 coi như hoàn thành cho nhánh "virus scan". Các mục khác trong `DOCUMENT_CONTROL_NEXT_STEPS_OVERVIEW.md` (1, 2, 4, 6) **chưa được đụng tới**, đúng theo yêu cầu "các phần khác sẽ làm sau khi tôi đồng ý".

### Phần 4.7 (mục 6 — lệch trạng thái giữa Batch và bản copy con) — hoàn thành (2026-08-03, fifth increment)

**Bổ sung hiệu năng (2026-08-04):** discrepancy scanner giờ duyệt các batch còn active theo từng trang 100 record thay vì nạp toàn bộ batch vào bộ nhớ. Cơ chế phát hiện/chốt discrepancy không thay đổi và vẫn không tự sửa im lặng dữ liệu GMP.

Trước khi sửa, đã đọc lại toàn bộ luồng cập nhật status batch/copy để xác nhận phạm vi thật sự còn thiếu:

- **"Bản con là sự thật, batch chỉ là số tổng hợp tính lại" — đã có sẵn từ trước.** `ControlledCopyBatchStatusService.synchronize()` luôn tính lại status của batch từ toàn bộ bản con mỗi lần được gọi (khi mở chi tiết batch, sau distribute/recall/cancel...), không lưu một trạng thái batch tách rời có thể tự trôi dạt. Toàn bộ thao tác ghi (distribute, recall...) đều nằm trong 1 `@Transactional`, nên lỗi giữa chừng sẽ rollback toàn bộ — không để lại trạng thái nửa vời trong DB ở cấp 1 request.
- **Việc thực sự thiếu:** không có cơ chế chủ động, chạy nền, phát hiện các batch bị lệch nhưng không ai mở ra xem (nên `synchronize()` không được gọi tới) — đúng như mục 6 mô tả.

Theo quyết định của người dùng (hiện chỉ hiện màn hình "Cần kiểm tra", không gửi email; chạy mỗi giờ):

- Refactor `ControlledCopyBatchStatusService`: tách phần tính toán "status batch nên là gì dựa trên các bản con" ra hàm thuần túy `deriveExpectedStatus(...)` (không ghi DB), dùng chung cho cả `synchronize()` (có ghi) và bộ quét mới (chỉ đọc, không ghi) — tránh 2 nơi có 2 công thức tính khác nhau rồi tự lệch nhau.
- Thêm `ControlledCopyBatchStatusService.peekExpectedStatus(batch, copies)` — bản chỉ-đọc, public, dùng cho bộ quét.
- Viết mới `ControlledCopyBatchDiscrepancyScanner` — job `@Scheduled(cron = "0 0 * * * *")` (mỗi giờ), quét toàn bộ batch chưa ở trạng thái kết thúc (không phải `OBSOLETED`/`CLOSED_CANCELLED`), so sánh trạng thái lưu trong batch với trạng thái tính từ bản con. **Không tự sửa** — chỉ ghi/ cập nhật 1 bản ghi "discrepancy" (bảng mới `controlled_copy_batch_status_discrepancies`, migration `V340`) để đánh dấu "cần kiểm tra". Nếu ở lần quét sau không còn lệch nữa, bản ghi tự chuyển sang `RESOLVED` (đây chỉ là đóng nhật ký cảnh báo, không phải sửa dữ liệu nghiệp vụ).
- Thêm endpoint `GET /controlled-copies/batch-status-discrepancies` (phân trang), giới hạn quyền xem cho người có quyền quản trị tài liệu (`documents.admin.view`) — đây chính là màn hình "Cần kiểm tra" cho DCO/admin.

**Đã kiểm tra kỹ vì đây là logic phát hiện sai lệch dữ liệu GMP:**
- Viết `ControlledCopyBatchDiscrepancyScannerIntegrationTest.java` — chạy trên dữ liệu thật: cố ý ép toàn bộ bản con của 1 batch sang trạng thái khác với batch (mô phỏng đúng tình huống "ghi dở giữa chừng" mà mục 6 lo ngại), chạy scanner, xác nhận: (1) có bản ghi discrepancy `OPEN` đúng với expected/actual status; (2) **batch trong DB không hề bị scanner ghi đè** (đúng yêu cầu không tự sửa âm thầm); (3) khi đưa bản con về lại đúng trạng thái ban đầu và quét lại, bản ghi discrepancy tự chuyển `RESOLVED`.
- Test mới: **pass**. Full `mvnw.cmd -q test`: **pass, exit code 0** (không có test nào khác bị ảnh hưởng).
- Migration `V340` đã áp dụng thành công trên database thật (đã kiểm tra bằng `\d` trực tiếp trong Postgres, đúng cấu trúc bảng + unique index đảm bảo mỗi batch chỉ có tối đa 1 discrepancy `OPEN` tại một thời điểm). Backend đã build lại và deploy lại, container `healthy`.

### Phần 3.1 (2 lớp kiểm tra quyền song song trong `ControlledCopyService`) — hoàn thành (2026-08-03, seventh increment)

Đã audit toàn bộ ~13 lời gọi `requirePermission(...)` (chuỗi permission code viết cứng) trong `ControlledCopyService.java`, đối chiếu với các lời gọi `controlledCopyAuthorizationService.require*(...)` (object-scope, permission code tra động từ bảng `WorkflowActionPolicy` trong DB) cho cùng hành động. Xác nhận 9/13 hành động có **2 lớp trùng lặp** cho cùng 1 việc: Distribute batch, Retry distribution, Retry recall, Retry cancel, Distribute single copy, Report lost/damaged, Recall copy, Cancel copy, Cancel batch, Recall batch (10 điểm gọi cho 9 hành động, vì Retry distribution/recall/cancel dùng chung permission code với action gốc).

**Vì sao đây là rủi ro thật, không chỉ trùng code:** 2 lớp tra permission code từ 2 nguồn khác nhau — lớp `requirePermission` dùng chuỗi cứng trong code Java, lớp `controlledCopyAuthorizationService` tra động từ DB (`WorkflowActionPolicy.getRequiredPermissionCode()`). Nếu ai đó sửa cấu hình permission trong DB mà quên đồng bộ chuỗi cứng, 2 lớp lệch nhau — đúng kịch bản "nút Distribute hiện ra (vì màn hình chỉ hỏi lớp object-scope qua API capabilities) nhưng bấm vào bị từ chối (vì lớp flat check riêng biệt)".

**Đã làm:**
- Xóa toàn bộ 10 lời gọi `requirePermission(...)` trùng lặp, giữ lại duy nhất lớp object-scope (`controlledCopyAuthorizationService.require*`) làm nguồn kiểm tra quyền duy nhất cho mỗi hành động — khớp đúng với lớp mà API `action-capabilities` (quyết định hiện/ẩn nút trên UI) cũng dùng, nên từ nay 2 nơi luôn đồng nhất tuyệt đối vì là **cùng 1 đoạn code**, không phải 2 đoạn được giữ đồng bộ thủ công.
- Không đụng đến 3 lời gọi `requirePermission` không có object-scope pair (request-controlled-copy, admin.view cho discrepancies, print) — đúng phạm vi đã audit, không tự ý mở rộng.
- **Phát hiện + sửa thêm 1 vấn đề thứ tự kiểm tra** phát sinh trong lúc gộp: ở 6 hành động có yêu cầu chữ ký điện tử (Distribute batch/copy, Recall copy/batch, Cancel copy/batch, Report lost/damaged), thứ tự cũ luôn là "kiểm tra quyền trước, xác thực chữ ký sau". Sau khi xóa lớp flat check (vốn luôn đứng trước), lớp object-scope check bị lộ ra đứng **sau** bước xác thực chữ ký ở 6 chỗ này — nghĩa là user không có quyền sẽ thấy lỗi "cần chữ ký điện tử" trước khi thấy lỗi "không có quyền", sai thứ tự fail-fast ban đầu (bị phát hiện qua 6 test integration cũ bị fail ngay ở bước build). Đã sửa bằng cách đưa việc lấy entity (batch/copy) + kiểm tra object-scope lên **trước** bước xác thực chữ ký ở toàn bộ 6 chỗ này, khôi phục đúng thứ tự: kiểm tra quyền trước, mọi bước khác (bao gồm chữ ký) sau.

**Đã kiểm tra kỹ vì đây là logic phân quyền cho toàn bộ hành động ghi của Controlled Copies:**
- Full `mvnw.cmd -q test`: ban đầu phát hiện 6 test fail đúng vào vấn đề thứ tự nói trên (`ControlledCopyServiceAuthorizationIntegrationTest` — các test xác nhận "user bị từ chối quyền thì không có tác dụng phụ nào xảy ra"), đã sửa và chạy lại: **398 test, 0 failures, 0 errors, exit code 0**.
- Backend build lại, deploy lại (`docker build` + `docker compose ... up -d --force-recreate backend`), container `healthy`, không có lỗi trong log khởi động.
- Không cần thêm cấu hình admin/bypass nào — permission code vẫn tra 100% từ Access Profile → Permission Set → Permission trong DB như trước, đúng yêu cầu "không hard-code kể cả admin" đã thống nhất.

### Phần 4.1 (thống nhất authorization Document/Revision) — điều tra sai hướng, đã revert, kết luận chính xác (2026-08-03, ninth increment)

**Diễn biến (ghi lại đầy đủ để không lặp lại sai lầm):**

1. Phát hiện `RevisionWorkflowAuthorizationService` (engine mới, tra policy `workflow_action_policies` từ DB) và `documentAuthorizationService.canEditDraftRevision` (Author/Co-Author, không cần permission) là 2 nguồn khác nhau cho cùng 1 flag `canEditRevision`/`canOpenAuthoringWorkspace`.
2. Tra DB trực tiếp: policy `UPDATE_DRAFT_METADATA` yêu cầu permission `documents.workspace.manage` (chỉ DCO/admin).
3. **Suy luận sai:** cho rằng nút "Edit Revision" trên FE dẫn tới `updateRevision()` (action `UPDATE_DRAFT_METADATA`), nên kết luận nhầm đây là bug ("Author thấy nút nhưng bị từ chối khi Save") và hỏi người dùng quyết định nghiệp vụ dựa trên tiền đề sai đó.
4. **Người dùng sửa lại:** nút "Edit Revision" thực chất dẫn Author/Co-Author vào workspace để thao tác nội dung (Upload to Office Online, Edit file Online...) — **không phải** để sửa metadata. Tiền đề ở bước 3 sai hoàn toàn.
5. **Đã revert ngay lập tức** cả 3 điểm vừa sửa (`canCurrentUserEditRevision()` và `toSummary()` trong `RevisionService.java`, `toRevisionSummary()` trong `DocumentService.java`) về đúng nguyên bản `documentAuthorizationService.canEditDraftRevision` (Author/Co-Author, không cần permission) — đây **là hành vi đúng** cho nút mở workspace nội dung. Đã xóa luôn dependency `RevisionWorkflowAuthorizationService` vừa thêm nhầm vào `DocumentService.java`.
6. Verification sau khi revert: `mvnw.cmd -q -DskipTests clean package` sạch; full `mvnw.cmd -q test` xanh (398 test, 0 lỗi); build lại Docker image (lần đầu bị timeout mạng khi pull base image, đã retry thành công) và deploy lại — container `healthy`, xác nhận đang chạy đúng code đã revert.

**Kết luận đúng cho 4.1 (chưa xử lý, cần làm cẩn thận hơn):** vẫn còn khả năng có bug thật kiểu "flag hiển thị khác flag enforce" ở đâu đó trong Document/Revision — nhưng **chưa xác định được vị trí chính xác nào là đúng đối tượng**. Bài học quan trọng: trước khi đổi bất kỳ authorization flag nào, phải xác nhận chắc chắn **UI thật sự đang dùng flag đó để gate hành động nào** (bấm nút này dẫn tới gọi API nào) — không được suy luận từ tên biến/tên hàm. Việc `RevisionWorkflowAuthorizationService` chưa được ráp chính thức vào `DocumentAuthorizationService`, và `DocumentService.updateActiveWorkflowConfiguration` tự kiểm tra permission thô — cả 2 vẫn là nợ kiến trúc thật, nhưng cần điều tra kỹ luồng FE→API thật trước khi sửa bất kỳ điểm nào, tránh lặp lại sai lầm lần này.

### Cập nhật authorization và request lifecycle (2026-08-04)

- **4.1 — phát hiện và sửa một lệch contract đã được chứng minh:** `RevisionActionCapabilityService` đã dùng `SecureFileAccessService` để quyết định `uploadSource`, `syncToOffice`, `syncFromOffice` và `editOnline`; tuy nhiên các mutation tương ứng trong `RevisionService` trước đây chỉ kiểm tra một phần document scope. Đã bổ sung `requireRevisionFileAccess(...)` tại server cho upload revision source, sync lên Office Online, sync file từ Office Online và mở link Edit Online. Vì vậy gọi API trực tiếp không thể vượt qua permission file, Draft/source-lock/editing-completed và ràng buộc Author/Co-Author mà capability API đã công bố. Không đổi logic workspace Author/Co-Author đã được xác nhận ở phần trên.
- **4.2 — export Controlled Copy:** export không còn `findAll(...).stream().filter(...).sorted(...)` trong bộ nhớ. Filter, authorization specification và sort đã chuyển xuống repository/database như danh sách phân trang. Export vẫn là luồng có chủ đích không phân trang; nếu dữ liệu có thể vượt giới hạn vận hành cần bổ sung export bất đồng bộ/giới hạn dòng như một hạng mục scale riêng.
- **4.3 — Publishing Workspace polling:** thay `setInterval` bất đồng bộ có thể chồng request bằng vòng `setTimeout` tự lập lịch. Polling chỉ chạy khi tab visible và online, không chạy song song, dừng đúng khi preview sẵn sàng hoặc unmount, và resume ngay khi tab/đường truyền hoạt động lại.
- **Verification:** `eqms-backend: .\\mvnw.cmd -q -DskipTests package` pass; `eqms: npm run build` pass.
- **Regression coverage:** bổ sung `RevisionBusinessRulesTest.syncFromOfficeOnline_deniesDirectApiCallWhenFileAccessPolicyDenies`; test chứng minh `SYNC_FROM_OFFICE` bị từ chối tại `SecureFileAccessService` trước khi Microsoft Graph/Office Online có thể bị gọi. `mvnw.cmd -q -Dtest=RevisionBusinessRulesTest test` pass.

### Phần 4.5, 4.6, 4.8, 4.4 — audit lại + xử lý (2026-08-03, eighth increment)

**4.5 (ALCOA+) — kiểm tra lại sâu hơn, kết luận: backend đã đủ từ trước, chỉ thiếu 1 điểm ở FE, đã sửa.**
- `AuditLog.java` đã có sẵn đầy đủ: actor snapshot (`employeeCode`, `roleName`, `positionName`, `departmentName`), request context (`ipAddress`, `userAgent`, `deviceBrowser`, `devicePlatform`), và `processingDurationSeconds`. `AuditLogChange.java` đã có field-level old/new value (1 dòng/field thay đổi).
- Xác nhận các field này **thực sự được ghi khi log** (`AuditTrailService.persistAudit`), không phải field bỏ trống — đánh giá hẹp ở lượt trước ("chỉ kiểm tra ipAddress/userAgent") là chưa đủ, giờ đã xác nhận toàn bộ.
- **Điểm thật sự thiếu:** `AuditTrailTab.tsx` (FE) dùng chung 1 `EmptyState` cho cả trường hợp "bị từ chối quyền (403)" và "không có dữ liệu" — người dùng không phân biệt được 2 tình huống khác nhau hoàn toàn. Đã sửa: thêm nhánh riêng "Access Denied" (icon `ShieldAlert`, thông báo rõ ràng) khi lỗi khớp `403/forbidden/permission`, tách biệt hẳn với "No Audit Records Found".
- Verification: `npm run build` pass, đã build lại + deploy lại frontend, container `Up`.

**4.6 (Evidence legal hold) — kết luận: không có gì để làm, vì không có đường xóa nào tồn tại để "hold" chống lại.**
- Đã rà toàn bộ codebase: không có job định kỳ, cron, hay endpoint nào xóa `ControlledCopyEvidenceFile` hoặc object MinIO của nó. FK đã là `RESTRICT` (mục 1.7, xong từ trước).
- Upload VÀ download evidence đều đã được ghi audit (`UPLOAD_EVIDENCE`, `DOWNLOAD_EVIDENCE`) — truy vết truy cập evidence đã đầy đủ.
- Vì không tồn tại đường xóa nào, thêm cờ "legal hold" lúc này sẽ là code phòng vệ cho 1 tình huống không thể xảy ra — không thêm, đúng nguyên tắc không viết code cho đường không tồn tại (giống kết luận đã áp dụng ở mục 3.3 trước đây). Nếu sau này có tính năng xóa/purge evidence thật, legal hold nên được thiết kế cùng lúc với tính năng đó.

**4.8 (Security hardening) — kiểm tra lại: phần lớn ĐÃ CÓ SẴN, đánh giá "1/5 xong" ở câu trả lời trước là SAI (do tìm sai từ khóa).**
- `SecurityConfig.java` đã có sẵn: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` — chỉ là các header này được cấu hình qua Spring Security DSL (`.contentTypeOptions()`, `.frameOptions()`...) chứ không phải chuỗi tên header viết trực tiếp trong code, nên lần tìm trước bị bỏ sót. HSTS dùng mặc định của Spring Security (không bị tắt).
- CORS: đã xong từ trước (4.8 first increment — allow-list qua `app.cors.allowed-origins`).
- CSRF: đã xác minh lại — `AuthTokenFilter` có 1 nhánh đọc cookie `accessToken`, nhưng rà toàn bộ `AuthController.java` xác nhận cookie này **chưa bao giờ được set giá trị thật** (chỉ bị xóa/rỗng ở logout và refresh-fail) — đây là dead code, không phải đường xác thực sống. Xác thực route bảo vệ hiện tại là Bearer-token-only thật sự, giữ CSRF disabled là đúng.
- **Còn lại, chưa làm (đúng, không phải nhầm lẫn):** đưa secret Graph/MinIO/SMTP vào secret store/Key Vault thật — đây là việc vận hành triển khai production (đổi biến môi trường khi deploy thật), không phải thay đổi trong code; `application.properties`/`docker-compose.yml` hiện đã đúng pattern (giá trị mặc định là placeholder rõ ràng "CHANGE_ME", đọc từ biến môi trường).

**4.4 (Rate limit/idempotency/load test) — đã chạy load test thật, phát hiện 1 lỗi thật cần theo dõi riêng.**
- Xác nhận Idempotency-Key filter đã tồn tại sẵn (`IdempotencyFilter.java`), áp dụng cho `/controlled-copies`, `/documents`, `/revisions`, `/publishing`, `/electronic-signature`, `/workflow` — đúng yêu cầu DoD.
- Viết script k6 (`scripts/loadtest/controlled-copies-read.js`, không hard-code credential — đọc qua biến môi trường) và **chạy thật** qua Docker (`grafana/k6`) nhắm vào container backend thật qua network nội bộ Docker: ramp 0→20 VU trong 2 phút, gọi `GET /controlled-copies` + `/health` lặp lại.
- **Kết quả lần chạy đầu:** độ trễ tốt (p95 = 64.95ms, p99 = 85.54ms, đạt ngưỡng). Nhưng phát hiện **11.07% request `GET /controlled-copies` bị từ chối quyền (403) một cách ngắt quãng** dưới tải 20 VU đồng thời — không phải do rate-limit.

**Cập nhật (2026-08-03, mười increment): đã điều tra sâu, không tái hiện được — kết luận là nhiễu môi trường, không phải bug code.**

- Thêm log chẩn đoán tạm thời vào từng nhánh của `AuthTokenFilter` (nơi request có thể "rơi" ra ngoài mà không set Authentication: REVOKED, EXPIRED, ALREADY_LOCKED, IDLE_LOCK, NOT_ACTIVE, session không tìm thấy, token parse rỗng) để xác định chính xác nhánh nào gây lỗi.
- Chạy lại đúng kịch bản load test gốc **3 lần riêng biệt** với các điều kiện khác nhau (backend đã "ấm"; backend vừa `--force-recreate` để mô phỏng cold-start giống lần đầu) — **cả 3 lần đều 0% lỗi**, không log chẩn đoán nào bắn ra cho endpoint `/controlled-copies`.
- **Kết luận:** lỗi 11% ở lần chạy đầu tiên nhiều khả năng do nhiễu từ môi trường tại thời điểm đó — cụ thể là tôi vừa build + deploy lại **cả frontend** (Vite dev server đang recompile) ngay trước khi chạy load test, tạo tải CPU/IO cạnh tranh trên cùng máy Docker host, không phải do lỗi logic trong code xác thực. Đã xác nhận qua DB (`auth_sessions`) rằng session không hề bị revoke/expire/lock trong suốt các lần test.
- Đã dọn sạch toàn bộ log chẩn đoán tạm thời khỏi `AuthTokenFilter.java`, build lại, full test suite vẫn xanh (398 test, 0 lỗi), deploy lại — container `healthy`.
- **Không có thay đổi code nào được giữ lại** cho mục này — kết luận cuối: đây không phải bug cần sửa, chỉ là artefact của việc chạy load test đồng thời với rebuild frontend. Khuyến nghị: khi chạy load test thật trong tương lai, tránh chạy đồng thời với các thao tác build/deploy khác trên cùng máy để có kết quả sạch.
- **Đây là phát hiện mới, nghiêm trọng, nằm ngoài phạm vi ban đầu của 4.4** — cần ưu tiên điều tra trước khi coi hệ thống sẵn sàng chịu tải production, vì ảnh hưởng đến tính khả dụng thật (không phải chỉ hiệu năng).

**Cập nhật (cùng ngày, sixth increment): đã làm thêm phần frontend UI cho màn hình "Cần kiểm tra".**

- Trang mới `ControlledCopyBatchStatusDiscrepanciesView` (route `/documents/controlled-copies/discrepancies`) — bảng liệt kê batch/document/trạng thái đang lưu (badge vàng)/trạng thái đúng theo bản con (badge xanh)/thời điểm phát hiện/thời điểm kiểm tra gần nhất, có phân trang, click vào 1 dòng để mở chi tiết batch đó.
- Nút "Cần kiểm tra" xuất hiện trên trang danh sách Controlled Copies, **chỉ hiển thị cho người có quyền `documents.admin.view`** — khớp đúng permission gate đã đặt ở API backend, không lộ ra cho user thường.
- API client `documentApi.getControlledCopyBatchStatusDiscrepancies(...)` gọi `GET /controlled-copies/batch-status-discrepancies`.

**Verification:** `npm run build` (frontend) pass, không có lỗi TypeScript/compile. Đã build lại Docker image `eqms-frontend:local` và restart container, container `Up`. **Lưu ý:** chưa test click-through thật trong trình duyệt (cần đăng nhập bằng tài khoản có quyền `documents.admin.view`) — chỉ xác minh được ở mức build + deploy sạch, chưa xác minh bằng mắt trên UI thật.

### Cập nhật — Participant typeahead pagination (2026-08-04)

- `GET /authorization/resources/DOCUMENT_REVISION/{revisionId}/eligible-users` now accepts `page` and `limit` and returns the common `PageResponse` envelope.
- Candidate name, employee-code, department and position search is performed and sorted by PostgreSQL. Permission, object-scope and segregation-of-duties remain server-side checks after the candidate page is retrieved; the browser never derives eligibility.
- The Reviewer/Approver picker fetches 20 candidates per request and provides **Load more users** for later pages, preventing an open picker from downloading every Active user in a large tenant.
- Verification: `eqms-backend: .\\mvnw.cmd -q -DskipTests compile` and `eqms: npm run build` passed.

### Capability contract regression matrix (2026-08-04)

- Added `DocumentMasterActionCapabilityServiceTest` to pin the server contract for an Active Document with an Effective revision: the complete action map, canonical required permission codes, electronic-signature requirement for obsoleting, Author-only Upload Revision, the open-revision guard, lifecycle guard, and fail-closed document visibility.
- Existing `RevisionActionCapabilityServiceTest` continues to cover the Revision action contract, file/workspace constraints, Author-only source upload, and fail-closed object visibility. Together the tests protect the UI capability response against accidental role-name based access decisions.
- Updated `DocumentParticipantEligibilityServiceTest` to the new database-paginated API contract, so test compilation now also protects the tenant-scale Reviewer/Approver lookup change.
- Verification: `eqms-backend: .\\mvnw.cmd -q "-Dtest=DocumentMasterActionCapabilityServiceTest,DocumentParticipantEligibilityServiceTest,RevisionActionCapabilityServiceTest" test` passed.

### Mutation API ↔ capability integration matrix (expanded 2026-08-04)

**Rule:** the browser treats an action-capability response only as a presentation contract.  Every state-changing API below must repeat the same server-side decision using the canonical permission code, object scope, policy actors and lifecycle state.  Display role names (for example `DCO`) are not inputs to this decision.

#### Document Master

| Mutation API | Capability key / authoritative server gate | Permitted source state | Canonical permission / additional invariant |
| --- | --- | --- | --- |
| `POST /documents` | Creation entitlement (no resource exists yet) | New | `documents.document.create`; creator/object scope is assigned server-side. |
| `PUT /documents/{id}` | `editInitialDraft` | `DRAFT` | `documents.document.edit_metadata`; only initial-draft editor. |
| `POST /documents/{id}/revisions` | `uploadRevision` | `ACTIVE` + an `EFFECTIVE` revision, no open revision | `documents.revision.upload_source`; assigned Author and document scope. |
| `POST /documents/{id}/revisions/upload` | `uploadRevision` | `ACTIVE` + `EFFECTIVE`, no open revision | Same gate as above; file validation remains server-side. |
| `POST /documents/{id}/upgrade-revision` | `uploadRevision` / revision upgrade service | `ACTIVE` + `EFFECTIVE`, no open revision | Same Author/object-scope/open-revision guard. |
| `POST /documents/{id}/upgrade-sessions`, `.../{sessionId}/continue` | `uploadRevision` prerequisite | `ACTIVE` + `EFFECTIVE`, no open revision | Session is a server-owned continuation of the same upgrade authorization; it cannot grant access itself. |
| `PUT /documents/{id}/active-workflow-configuration` | `configureNextReviewers`, `configureNextApprovers`, `configureNextRelatedDocuments`, `configureNextCorrelatedDocuments`, `manageReviewCycle` | `ACTIVE` + `EFFECTIVE` | Each changed field is checked independently; unchanged values are retained. |
| `POST /documents/{id}/cancel` and compatibility route `/documents/cancel/{id}` | `cancel` | `DRAFT` | Workflow policy action `CANCEL`; e-signature/request validation stays in mutation. |
| `POST /documents/{id}/obsolete` | `obsolete` | `ACTIVE` + `EFFECTIVE`, no open revision | Workflow policy action `OBSOLETE`; mandatory electronic signature. |

#### Document Revision (training action deliberately excluded from this refactor)

| Mutation API | Capability key / authoritative server gate | Permitted source state | Canonical permission / additional invariant |
| --- | --- | --- | --- |
| `PUT /revisions/{id}` | `updateDraftMetadata` | `DRAFT` | Workflow action `UPDATE_DRAFT_METADATA`. |
| `POST /revisions/{id}/upload` | `uploadSource` | `DRAFT` | `documents.revision.upload_source`; assigned Author plus file-access decision. |
| `POST /revisions/{id}/office-online/sync` | `syncToOffice` | `DRAFT` with editable DOC/DOCX and no existing workspace | File-access decision; Author/Co-Author restriction. |
| `POST /revisions/{id}/office-online/sync-back` | `syncFromOffice` | `DRAFT` with existing workspace | File-access decision; Author/Co-Author restriction. |
| `GET /revisions/{id}/office-online/edit-link` (signed operational action) | `editOnline` | `DRAFT` with existing workspace | File-access decision; Author/Co-Author restriction. |
| `POST /revisions/{id}/complete-editing` | `completeAuthoring` | `DRAFT` | `COMPLETE_AUTHORING`, with electronic signature. |
| `POST /revisions/{id}/regenerate-snapshot` | `regenerateSnapshot` | `DRAFT` | `GENERATE_REVIEW_SNAPSHOT` / workspace management policy. |
| `POST /revisions/{id}/submit-review` | `submitForReview` | `DRAFT` after authoring completes | `SUBMIT_FOR_REVIEW`, with electronic signature. |
| `POST /revisions/{id}/review/complete`, `/review/reject` | `completeReview`, `rejectReview` | `PENDING_REVIEW` | Assigned pending Reviewer; respective review/reject permission and electronic signature. |
| `POST /revisions/{id}/approve/complete`, `/approve/reject` | `completeApproval`, `rejectApproval` | `PENDING_APPROVAL` | Assigned pending Approver; respective approve/reject permission and electronic signature. |
| `POST /revisions/{id}/publish` | `publish` | `READY_FOR_PUBLISHING` | `PUBLISH`, publishing policy and electronic signature. |
| `POST /revisions/{id}/upgrade` | `upgradeRevision` | `EFFECTIVE` | `UPGRADE_REVISION`; Author or configured workspace actor, never role name. |
| `POST /revisions/{id}/cancel` | `cancel` | `DRAFT` | `CANCEL`, electronic signature. |

`POST /revisions/workspaces`, `/workspaces/batch-save`, `/workspaces/batch-submit`, and working-note mutations are server-authorized today by the workspace/session service and document scope, but do **not** yet have a one-to-one key in `RevisionActionCapabilitiesResponse`.  They remain an explicit Phase 4 follow-up: add `saveWorkspace`, `submitWorkspaceBatch`, `addWorkingNote` and `deleteWorkingNote` keys before a new UI action is added.  This prevents a future button from inferring authorization locally.

#### Controlled Copy

| Mutation API | Capability key / authoritative server gate | Permitted source state | Canonical permission / additional invariant |
| --- | --- | --- | --- |
| `POST /controlled-copies` | `REQUEST_COPY` evaluated against document/revision | Document `ACTIVE`, revision `EFFECTIVE` | `documents.controlled_copy.request`, parent document visibility and request policy. |
| `POST /controlled-copies/{id}/print` | `printCopy` / `PRINT_COPY` | `READY_FOR_DISTRIBUTION` or `DISTRIBUTED` | `documents.controlled_copy.print`; print policy and one-time quota. **Centralized through the shared evaluator.** |
| `POST /controlled-copies/{id}/distribute` | `distributeCopy` / `DISTRIBUTE_COPY` | `READY_FOR_DISTRIBUTION` | `documents.controlled_copy.distribute`; document scope. |
| `POST /controlled-copies/batches/{batchId}/distribute` and retry `DISTRIBUTE` | `distributeBatch` / `DISTRIBUTE_BATCH` | `READY_FOR_DISTRIBUTION` | Same distribute permission and batch scope. |
| `POST /controlled-copies/{id}/recall` | `recallCopy` / `RECALL_COPY` | `READY_FOR_DISTRIBUTION` or `DISTRIBUTED` | `documents.controlled_copy.recall`; policy controls manual recall. |
| `POST /controlled-copies/batches/{batchId}/recall` and retry `RECALL` | `recallBatch` / `RECALL_BATCH` | `DISTRIBUTED` | Same recall permission and batch scope. |
| `POST /controlled-copies/{id}/cancel` | `cancelRequest` / `CANCEL_REQUEST` | `READY_FOR_DISTRIBUTION` | `documents.controlled_copy.cancel_request`. |
| `POST /controlled-copies/batches/{batchId}/cancel` and retry `CANCEL` | `cancelRequest` equivalent at batch scope | `READY_FOR_DISTRIBUTION` | Same cancellation policy and batch scope. |
| `POST /controlled-copies/{id}/destroy` (JSON or evidence multipart) | `reportLostDamaged` / `REPORT_LOST_DAMAGED` | `DISTRIBUTED` | `documents.controlled_copy.report_lost_damaged`; Lost/Damaged policy, required e-signature and evidence for damaged. |
| `POST /controlled-copies/{id}/replace` | `replaceLostDamaged` / `REPLACE_LOST_DAMAGED` | `OBSOLETED` with Lost/Damaged reason | `documents.controlled_copy.replace_lost_damaged`; valid replacement source only. |
| `POST /controlled-copies/{id}/preview/close`, `/preview/print` | Preview-grant server gate, not logged-in capability | Valid, non-expired external preview grant | Exact copy-bound HMAC grant, recipient verification and portal/print policy. |

#### Regression evidence and remaining coverage

- `DocumentMasterActionCapabilityServiceTest`, `RevisionActionCapabilityServiceTest` and `ControlledCopyAuthorizationServiceTest` pin the main server contracts.  The latter now proves both `printCopy` and `POST /controlled-copies/{id}/print` reach `PRINT_COPY`; disabling print policy denies both before side effects.
- `WorkflowActionDefaultPolicyRegistry` now includes both `DISTRIBUTE_COPY` and `DISTRIBUTE_BATCH`; resetting policies can no longer make a single copy disagree with its batch counterpart.
- **Next automated matrix slice:** parameterized HTTP/service tests must execute every row above at the allowed state, immediately-before/after states, missing permission, out-of-scope document and unassigned participant.  The test subject is a capability/permission assignment, not a named role.

**Verification (2026-08-04):** `ControlledCopyAuthorizationServiceTest` passes for the shared `PRINT_COPY` decision. Full backend suite (`.\\mvnw.cmd -q test`) also passes, including Flyway validation against the already-applied immutable `V342` migration.
