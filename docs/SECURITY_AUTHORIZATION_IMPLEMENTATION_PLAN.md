# Kế hoạch triển khai — Security & Authorization (Refactor + Fix)

> Tài liệu công việc (work breakdown), chuyển thể từ bản thiết kế "DESIGN-EQMS-SEC-003 — Thiết kế giao diện & thao tác chi tiết Security & Authorization" (artifact đã duyệt qua trao đổi). Tài liệu này liệt kê **việc cần code**, theo thứ tự ưu tiên, kèm đầy đủ danh sách quyền/chức năng theo trạng thái đã rà soát trực tiếp từ mã nguồn (Phụ lục A) để developer không cần mở lại artifact gốc khi code.
>

**Nguyên tắc bắt buộc cho mọi task dưới đây** (không lặp lại ở từng mục):
- Không phá vỡ hành vi hiện tại — mọi thay đổi phải additive hoặc provably non-regressive.
- Mọi thao tác ghi (tạo/sửa/xoá permission, policy, gán quyền) phải giữ nguyên yêu cầu ký điện tử + audit trail đang có.
- Không tạo bảng "screen/button override", không tạo UI tick chọn mới nào cho phân quyền — **cơ chế tick chọn admin dùng chính là Permission Explorer đã có sẵn** (mỗi permission = 1 dòng checkbox khi tạo/sửa Permission Set). Toàn bộ danh sách ở Phụ lục A chỉ là *nội dung cần đảm bảo đã tick được đúng qua đúng cơ chế đó*, không phải đặc tả cho 1 UI tick mới. Xem giải thích ở §"Trả lời câu hỏi: tick chọn ở đâu?" ngay dưới đây.
- Build FE (`npm run build`) và BE (`./mvnw clean compile`) phải sạch sau mỗi task trước khi coi là xong.
- **Server là nơi quyết định duy nhất**: mọi logic phân quyền/điều kiện hiển thị/validate (permission check, actor/participant check, status-gating, e-sign requirement) phải nằm ở Backend. FE **không** tự suy luận hay lặp lại logic đó — FE chỉ đọc field/flag do BE trả về (`canCancel`, `options` từ endpoint `/options`, danh sách eligible users từ 0.5b...) rồi hiển thị/thao tác theo đúng field đó. Đây là lý do Task 0.1 dùng field `canCancel/canObsolete` từ BE thay vì FE tự OR permission, và vì sao 0.5b làm endpoint chung ở BE thay vì FE tự lọc danh sách user.
- **UI phải đồng bộ với hệ thống hiện có, không tự chế mới**: mọi màn hình mới (State Policy List/Form, Actor/Resource picker...) bắt buộc tái dùng component có sẵn ở `eqms/src/components/ui/` — không viết lại từ đầu. Cụ thể: `page/PageHeader.tsx` + `breadcrumb/Breadcrumb.tsx` cho header 2 tầng; `form/FormSection.tsx` + `form/ResponsiveForm.tsx` cho bố cục form; `select/Select.tsx`/`select/MultiSelect.tsx` cho mọi picker (kể cả async user-search dùng `onSearch`); `table/ResponsiveTable.tsx` + `table/TablePagination.tsx` + `table/TableEmptyState.tsx` cho list; `modal/FormModal.tsx`/`modal/AlertModal.tsx`/`esign-modal/ESignatureModal.tsx` cho dialog/e-sign; `badge/Badge.tsx` cho trạng thái; `dropdown/ActionDropdown.tsx`/`dropdown/PortalDropdownMenu.tsx` cho action menu; `tabs/TabNav.tsx` nếu gộp màn hình (Phase 1); `card/FilterCard.tsx`/`filter/FilterDrawer.tsx` cho bộ lọc; `loading/Loading.tsx`, `page/EmptyState.tsx`, `toast/Toast.tsx` cho trạng thái tải/rỗng/thông báo. Không tạo component UI atom mới trừ khi không có sẵn tương đương trong thư mục này.
- **Responsive đầy đủ**: mọi màn hình mới phải chạy đúng ở cả desktop và mobile/tablet, theo đúng pattern các màn hình Security & Authorization hiện có (`WorkflowPolicyFormView`, `ObjectAccessRuleFormView`...) — dùng `ResponsiveTable`/`ResponsiveForm`/`ResponsiveCard` sẵn có thay vì tự viết breakpoint riêng; test thủ công tối thiểu ở 3 kích thước (desktop ≥1280px, tablet ~768px, mobile ~375px) trước khi coi 1 task UI là xong.

## Đối chiếu tuân thủ (GAMP 5 / 21 CFR Part 11 / EU GMP Annex 11) — đã tra cứu, không phát hiện sai lệch với quy định hiện hành, nhưng có 1 điểm cần theo dõi

Đối chiếu kế hoạch với các nguyên tắc cốt lõi:

| Yêu cầu | Nguồn | Đối chiếu với kế hoạch |
|---|---|---|
| Authority check trước khi truy cập/sửa dữ liệu | 21 CFR 11.10(d) | Đúng — mô hình 4 lớp (Object Access Rule → Policy → Permission → Actor) đã có, kế hoạch chỉ vá chỗ thiếu, không đổi nguyên tắc |
| Ghi nhận tạo/sửa/huỷ quyền truy cập | EU GMP Annex 11 §12.3 | Đúng — mọi task đều giữ nguyên yêu cầu ký điện tử + audit trail (nguyên tắc bắt buộc ở đầu tài liệu) |
| Least privilege — cấp đúng quyền cần cho công việc, không hơn | 21 CFR Part 11 access control (least privilege) | Đúng — mô hình Permission Set/Access Profile theo đúng nguyên tắc này; task 0.5b (lọc picker theo permission) còn giúp *hiển thị đúng* ai đủ điều kiện, giảm rủi ro admin gán nhầm người thừa quyền |
| Rà soát định kỳ ai đang có quyền gì | EU GMP Annex 11 (kỳ vọng periodic review, càng rõ hơn ở bản 2026) | Access Review module đã có (ngoài phạm vi kế hoạch này — xem "Việc KHÔNG làm") |
| Risk-based validation, test trước khi dùng | GAMP 5 (risk-based approach to CSV) | Đúng — Phase -1/0.5a yêu cầu regression test + golden-parity test tự động trước khi coi là xong, đúng tinh thần GAMP 5 (validate trong vòng đời, không chỉ tin tưởng code) |

### ⚠️ Điểm cần theo dõi (không phải lỗi của kế hoạch hiện tại, nhưng ảnh hưởng lâu dài)

Bản dự thảo sửa đổi **EU GMP Annex 11** (công bố 07/2025, dự kiến chính thức **giữa 2026**) bổ sung hẳn mục mới **§11 "Identity & Access Management"**, trong đó §11.10 nêu rõ nguyên tắc: **user thực hiện hoạt động GMP không nên đồng thời có quyền admin hệ thống** (ví dụ nêu thẳng: "Quality Manager không được kiêm System Administrator"). Đây là quy định **mới**, chưa có trong Annex 11 hiện hành (2011) — hệ thống hiện tại (và kế hoạch này) **không sai** so với quy định đang áp dụng, nhưng cơ chế bypass đang có (`SYSTEM_SUPER_ADMIN`, và đặc biệt là DCO/doc-admin bypass ở `canManageDocumentWorkspace` — cho phép Cancel/Obsolete tài liệu mà không cần tick permission cụ thể) là đúng kiểu cấu hình có thể bị soi lại khi quy định mới có hiệu lực.

**Không đề xuất sửa ngay trong kế hoạch này** (quy định chưa chính thức, và đây là quyết định chính sách của tổ chức, không phải quyết định kỹ thuật đơn thuần) — chỉ ghi nhận làm mục backlog riêng: khi Annex 11 mới chính thức ban hành, cần rà lại toàn bộ phạm vi bypass (`canManageDocumentWorkspace`, `SYSTEM_SUPER_ADMIN`) xem có cần tách "quyền quản trị hệ thống" ra khỏi "quyền thực hiện hoạt động GMP" (Cancel/Obsolete/Approve...) hay không, thay vì để 1 bypass duy nhất cấp cả 2. **Task 0.1 và 0.5a trong kế hoạch này KHÔNG mở rộng thêm phạm vi bypass** (chỉ expose đúng bypass đã có ở BE ra FE cho đúng, và gộp 2 catalog hardcode thành 1) — nên không làm tình hình xấu đi so với hiện tại, an toàn để triển khai ngay; việc thu hẹp bypass là quyết định riêng, để dành cho khi có quy định chính thức.

*Nguồn tham khảo: [GAMP 5 Guide 2nd Edition — ISPE](https://ispe.org/publications/guidance-documents/gamp-5-guide-2nd-edition), [21 CFR Part 11 Access Controls](https://www.eleapsoftware.com/access-controls-for-21-cfr-part-11/), [EU Annex 11 (2011, hiện hành)](https://health.ec.europa.eu/system/files/2016-11/annex11_01-2011_en_0.pdf), [Draft Annex 11's Identity & Access Management Changes](https://investigationsquality.com/2025/07/30/draft-annex-11s-identity-access-management-changes-why-your-current-sops-wont-cut-it/), [EU GMP Annex 11 revision 2025 — Jenson R](https://jensonr.com/eu-gmp-annex-11-revision-2025/).*

---

## Phase -1 — Quyết định kiến trúc bắt buộc: Generic hoá Participant + Object Access (làm rõ TRƯỚC Phase 0) — ✅ ĐÃ HOÀN THÀNH (đường mới có sẵn, mặc định TẮT — xem "Chưa làm" bên dưới)

**Kết quả triển khai:** migration `V173__generic_workflow_participants.sql` — tạo bảng `workflow_participants` (object_type/object_id/participant_type/user_id/action_status, theo đúng convention cột của `revision_workflow_participants`) + copy toàn bộ dữ liệu `revision_workflow_participants` hiện có sang với `object_type='DOCUMENT_REVISION'` — không xoá/sửa bảng cũ, migration tự thân an toàn/reversible. Flag `app.security.generic-workflow-participants-enabled` (mặc định `false`, đúng convention 2 flag trước). `RevisionWorkflowAuthorizationService.isPendingReviewer`/`isPendingApprover` rẽ nhánh qua `isPendingParticipant()` mới — khi flag tắt, hành vi y hệt hôm nay (byte-for-byte); khi bật, đọc từ bảng generic. Có thêm API generic `isPendingGenericParticipant(objectType, objectId, participantType, userId)` cho module tương lai dùng thẳng.

**Quyết định kỹ thuật đáng chú ý (đã xác minh, không phải bỏ sót)**: **không đụng `ObjectAccessEvaluationService`** như dự kiến ban đầu trong plan — xác nhận qua code rằng service này chỉ làm ABAC theo scope (business unit/department, `ObjectAccessRule`), **không hề đọc `RevisionWorkflowParticipant`** — nên generic hoá nó không giải quyết đúng rủi ro thật (đọc participant), chỉ `RevisionWorkflowAuthorizationService` mới cần sửa. Theo đúng nguyên tắc "ưu tiên abstraction mỏng, không viết lại rộng" trong kế hoạch.

**Đã chứng minh tính tổng quát (tiêu chí hoàn thành #2)**: test parity `GenericWorkflowParticipantsParityTest` (6/6 pass) bao gồm 1 ca chèn participant giả `objectType='CAPA_RECORD'` xác nhận API generic trả đúng kết quả mà không cần code riêng cho CAPA.

**Verify (tôi tự chạy lại độc lập, không chỉ tin báo cáo)**: `./mvnw clean compile` sạch; `GenericWorkflowParticipantsParityTest`/`RevisionWorkflowAuthorizationServiceTest`/`RevisionWorkflowAuthorizationPolicyRuntimeTest` pass toàn bộ; `./mvnw test` full suite — đúng 9 lỗi tồn tại từ trước (không phải do phase này gây ra, xác nhận không tham chiếu `WorkflowParticipantRepository`), không có hồi quy mới.

**Chưa làm (đúng theo khuyến nghị "giữ 2 đường chạy song song" của kế hoạch, không phải thiếu sót)**:
- Flag mặc định vẫn TẮT — đường mới **chưa từng chạy thật trên DB Postgres/migration thật**, chỉ verify qua mock JUnit (không có môi trường live trong phiên làm việc). **Bắt buộc**: bật flag ở staging trước, theo dõi vài ngày, rồi mới bật production — đúng quy trình đã ghi trong kế hoạch.
- Xác nhận nghiệp vụ về `TRAINING_REVIEWER`/`TRAINING_APPROVER` (giữ hay xoá khỏi catalog) — việc này cần người phụ trách nghiệp vụ trả lời, không phải việc kỹ thuật, vẫn treo.
- Chưa xoá `revision_workflow_participants`/code cũ — đúng kế hoạch, chỉ xoá sau khi ổn định ở production tối thiểu 1 sprint.


> Phase này không phải fix bug — đây là 1 **quyết định kiến trúc** phải chốt trước khi bắt đầu code bất kỳ module nào khác ngoài Documents (CAPA, Deviations, Change Control, Complaints, Equipment, Risk Management, Supplier), và trước khi mở rộng thêm cho chính Training. Nếu không chốt bây giờ, mỗi module mới sẽ tự phát minh lại 1 kiểu participant/actor-resolution riêng, dẫn đến xung đột & trùng lặp không thể gộp lại sau này mà không phá dữ liệu.

### -1.0 Hiện trạng đã xác nhận trong code (không suy đoán)

- `ObjectAccessEvaluationService.java`: mọi method (`canViewRevision`, `canAccessRevision`, `resourceMatches`, `matchesStatus`) nhận tham số kiểu **`DocumentRecord`/`DocumentRevisionRecord` cứng** — không phải kiểu tổng quát (`object_type` + `object_id`).
- `RevisionWorkflowParticipant` (bảng lưu "ai được assign Reviewer/Approver cho revision nào"): cột `revision_id` là **FK cứng trỏ thẳng vào bảng `document_revisions`** — không thể dùng bảng này cho 1 record CAPA hay Deviation. **Đây là bảng duy nhất mọi kiểm tra quyền thật sự đọc** (`requirePendingParticipant`, actor evaluation trong `RevisionWorkflowAuthorizationService`) — generic hoá đúng bảng này là đủ.
- **Đã xác nhận riêng, không nhầm với bảng trên:** còn có `DocumentWorkflowParticipant` (FK `document_id`) — đây là **roster nhập lúc tạo Document Master** (chọn Reviewer/Approver/Co-Author cho tài liệu), được `RevisionService.copyWorkflowParticipantsFromDocument()` copy 1 lần sang `RevisionWorkflowParticipant` mỗi khi sinh revision mới. Bảng này **không được** `DocumentAuthorizationService` dùng để ra quyết định phân quyền (repository được inject nhưng không có lời gọi nào) — nó chỉ là nguồn "mẫu roster" đầu vào, không phải 1 cơ chế kiểm tra quyền song song. **Vì vậy KHÔNG cần generic hoá bảng này ở Phase -1** — chỉ cần generic hoá `RevisionWorkflowParticipant` (bảng thực sự được evaluator đọc) là đủ để CAPA/module khác tái dùng đúng cơ chế kiểm tra quyền. Nếu module tương lai cũng muốn có khái niệm "roster mẫu nhập trước, copy vào từng lần review" giống Document, đó là quyết định UX riêng của module đó khi thiết kế, không bắt buộc phải generic hoá `DocumentWorkflowParticipant` cùng đợt này.
- **Training đã dùng lại đúng model Document/Revision** cho việc "hoàn thành đào tạo 1 tài liệu" (trạng thái `PENDING_TRAINING` trên chính `DocumentRevisionRecord`, quyền `documents.training.manage`/`.complete`) — phần này **không có rủi ro gì**, đã đúng và nhất quán, không cần đổi.
- Nhưng `WorkflowRoleCode` có sẵn 2 giá trị `TRAINING_REVIEWER`/`TRAINING_APPROVER` **hiện không được dùng ở đâu cả** — xác nhận `training/useTrainingPermissions.ts` chỉ có 2 permission (`training.module.view`, `training.material.manage`), không có khái niệm review/approve tài liệu đào tạo (Course/Material) như tên 2 workflow role này ngụ ý. **Đây chính là bằng chứng cụ thể cho rủi ro**: nếu sau này Training module cần thêm quy trình "duyệt nội dung khoá học" (Course/Material có vòng đời riêng, cần Reviewer/Approver riêng, không phải revision của Document), lập trình viên sẽ đứng trước đúng ngã ba mà CAPA/Deviations cũng sẽ gặp — và nếu không chốt phương án chung, Training sẽ tự làm 1 kiểu, CAPA tự làm 1 kiểu khác.

### -1.1 Hai phương án

**Phương án A — Generic hoá 1 lần (khuyến nghị, vì kế hoạch có ≥7 module tương lai):**

```sql
-- Thay thế / bổ sung song song với RevisionWorkflowParticipant hiện có
CREATE TABLE workflow_participants (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    object_type  varchar(80) NOT NULL,   -- 'DOCUMENT_REVISION', 'CAPA_RECORD', 'TRAINING_MATERIAL', 'DEVIATION'...
    object_id    uuid        NOT NULL,   -- id của bản ghi thật (revision, CAPA, material...)
    participant_type varchar(40) NOT NULL,  -- 'AUTHOR','CO_AUTHOR','REVIEWER','APPROVER'...
    user_id      uuid NOT NULL REFERENCES app_users(id),
    action_status varchar(30),          -- 'PENDING','COMPLETED','REJECTED' — giữ đúng ý nghĩa cột hiện có ở RevisionWorkflowParticipant
    created_at, updated_at
);
CREATE INDEX idx_wp_object ON workflow_participants (object_type, object_id);
CREATE INDEX idx_wp_user   ON workflow_participants (user_id);
```
- `ObjectAccessEvaluationService` đổi chữ ký thành nhận `(String objectType, UUID objectId, ...)` thay vì `DocumentRevisionRecord` cụ thể — Document module tự truyền `("DOCUMENT_REVISION", revision.getId())`, module mới tự truyền type của nó.
- **Rủi ro của phương án A**: phải migrate dữ liệu cũ từ `RevisionWorkflowParticipant` → `workflow_participants` (hoặc giữ song song 1 thời gian), và sửa mọi call-site đang gọi `ObjectAccessEvaluationService`/`RevisionWorkflowAuthorizationService` với kiểu cụ thể — tốn công 1 lần, rủi ro regression cho Document module (đã chạy production) nếu làm ẩu.

**Phương án B — Lặp lại pattern mỗi module (nhanh hơn trước mắt, rẻ hơn ngắn hạn, đắt hơn dài hạn):**
- Mỗi module tự tạo bảng participant riêng (`CapaWorkflowParticipant`, `TrainingMaterialParticipant`...) + tự viết 1 bản rút gọn của `RevisionWorkflowAuthorizationService` cho object của mình, copy cấu trúc y hệt Document.
- **Rủi ro của phương án B**: với 7 module tương lai → có thể ra đời 7 bảng + 7 evaluator gần giống hệt nhau, sửa 1 lỗi chung (VD như V170/V171 vừa làm) phải sửa lặp lại N lần; đúng kiểu nợ kỹ thuật đã thấy ở legacy permission code (39 mã trùng lặp) — **nếu chọn B, gần như chắc chắn sẽ phải làm lại thành A sau này, lúc đó dữ liệu đã lớn hơn, migrate khó hơn bây giờ**.

### -1.2 Đề xuất

**Chọn phương án A**, làm ngay khi chưa có module thứ 2 nào code xong (thời điểm rẻ nhất để đổi) — không đợi đến khi CAPA/Deviations đã code xong theo kiểu B rồi mới generic hoá.

> **⚠️ Bổ sung sau audit — Phase -1 là phase rủi ro cao nhất (đụng vào bảng đang chạy production), nhưng bản trước chưa có tên flag cụ thể, chưa có bước rollback, chưa phân biệt test tự động/thủ công. Bổ sung:**

- [ ] Migration mới: tạo `workflow_participants` (schema ở trên). Migration này **chỉ tạo bảng + copy dữ liệu, không xoá gì** — tự thân đã an toàn/reversible (`DROP TABLE workflow_participants` là rollback đủ nếu cần huỷ giữa chừng).
- [ ] Thêm feature flag `app.security.generic-workflow-participants-enabled` (default `false`), theo đúng quy ước đặt tên đã dùng cho các flag trước (`app.security.participant-visibility-strict`, `app.security.lifecycle-policy-enabled`) — code đọc từ `workflow_participants` chỉ chạy khi flag bật; khi tắt, mọi thứ đọc từ `RevisionWorkflowParticipant` y hệt hôm nay. Đây là cơ chế rollback tức thời (tắt flag, không cần revert code/migration) nếu phát hiện lỗi sau khi bật ở production.
- [ ] Backend: viết `objectType = "DOCUMENT_REVISION"` cho toàn bộ dữ liệu hiện có trong `RevisionWorkflowParticipant`, copy sang `workflow_participants` (migration data, không xoá bảng cũ ngay — chạy song song 1 thời gian để rollback được nếu cần).
- [ ] Sửa `ObjectAccessEvaluationService`, `RevisionWorkflowAuthorizationService` đọc từ `workflow_participants` với `objectType = 'DOCUMENT_REVISION'` thay vì bảng cũ, **đặt sau flag ở trên** — **test regression đầy đủ cho Document/Revision trước khi coi là xong**, vì đây là module duy nhất đang chạy thật, rủi ro cao nhất nằm ở đây. Cụ thể loại test:
      - **Tự động (bắt buộc, không phải thủ công):** viết/chạy lại bộ JUnit hiện có cho `RevisionWorkflowAuthorizationService`/`DocumentService` (tương tự các test đã có, ví dụ `RevisionBusinessRulesTest`) với flag bật — toàn bộ phải pass y hệt khi flag tắt. Đây là **bằng chứng validation**, không phải checklist tay — hệ thống GMP cần bằng chứng test tự động lặp lại được, không chỉ QA click tay 1 lần.
      - **Thủ công (bổ sung, không thay thế):** click-through 1 lượt trên staging (submit/review/approve/publish/obsolete/cancel) để xác nhận trải nghiệm thật, sau khi bộ JUnit đã pass.
- [ ] **Staging trước, production sau:** bật flag ở staging tối thiểu vài ngày, theo dõi log lỗi, rồi mới bật ở production — không bật thẳng production ngay sau khi deploy code.
- [ ] Sau khi ổn định ở production (khuyến nghị tối thiểu 1 sprint quan sát với flag bật), mới xoá bảng `RevisionWorkflowParticipant` cũ **và xoá luôn flag** (không giữ 2 code path mãi mãi — dọn dẹp là 1 bước bắt buộc của task, không phải "làm sau này").
- [ ] Khi bắt đầu code CAPA/Deviations/Training-material-review: chỉ cần thêm dòng dữ liệu vào `workflow_participants` với `objectType` mới, dùng lại nguyên `ObjectAccessEvaluationService`/`RevisionWorkflowAuthorizationService` đã generic hoá — **không viết evaluator riêng nữa**.
- [ ] **Riêng Training**: xác nhận rõ với nghiệp vụ có thật sự cần "duyệt nội dung khoá học" (Course/Material review) hay không trước khi seed thêm gì cho `TRAINING_REVIEWER`/`TRAINING_APPROVER` — 2 workflow role này hiện là **tử thi trong catalog** (tồn tại nhưng không dùng), nếu nghiệp vụ xác nhận không cần, nên xoá khỏi seed ở task 0.5a để tránh admin gán nhầm vào 1 vai trò không có tác dụng gì.

### -1.3 Tiêu chí hoàn thành

1. Document/Revision hoạt động 100% như cũ sau khi chuyển sang `workflow_participants` (regression test đầy đủ: submit/review/approve/publish/obsolete/cancel — cả trường hợp allow lẫn deny).
2. Tạo thử 1 bản ghi participant giả cho `objectType = 'CAPA_RECORD'` (chưa cần CAPA module thật) và xác nhận `ObjectAccessEvaluationService` trả kết quả đúng — chứng minh tính tổng quát trước khi CAPA module thật được code.
3. Xác nhận với nghiệp vụ về `TRAINING_REVIEWER`/`TRAINING_APPROVER` (giữ hay xoá khỏi catalog).

---

## Trả lời câu hỏi: "tick chọn nó trên UI sẽ phù hợp cho admin nhỉ?"

**Đúng, và cơ chế đó đã tồn tại — không cần xây UI tick mới.**

Mỗi dòng "chức năng" trong Phụ lục A (VD: "Obsolete Document", "Approve Revision", "Distribute Controlled Copy") **đã là 1 permission code** (VD `documents.document.obsolete`, `documents.revision.approve`, `documents.controlled_copy.distribute`). Admin **đã tick chọn được** các permission này ngay hôm nay, tại:

```
Security & Authorization → Permission Sets → New/Edit Permission Set
   → Permission Explorer → mở module "documents" → tick từng dòng
```

Đây chính xác là màn hình đã được tối ưu ở các lượt trước (thu gọn theo nhóm, cuộn nội bộ, tìm kiếm trong panel, hiện mã quyền cạnh nhãn). **Không cần thêm màn hình tick chọn nào khác.**

**Vấn đề thật không phải là "thiếu chỗ để tick"**, mà là: một vài chức năng ở Phụ lục A **hiện KHÔNG tick-được-là-có-tác-dụng-thật** vì FE chưa gọi đúng permission code đó khi hiện nút (mục 0.1), hoặc permission code chưa tồn tại/không còn dùng (mục 0.2, 0.3). Nói cách khác: **cơ chế tick đã đúng, dữ liệu đứng sau vài ô tick bị lệch** — đây chính là lý do Phase 0 tồn tại. Cột cuối trong mỗi bảng ở Phụ lục A (**"Tick ở Permission Explorer có tác dụng thật?"**) chỉ ra chính xác dòng nào cần Phase 0 xử lý trước khi tick của admin thực sự có ý nghĩa.

---

## Phụ lục A — Danh sách quyền/chức năng theo trạng thái (rà soát trực tiếp từ mã nguồn `documents/`)

### A.0 Trạng thái xác nhận từ DB (nguồn sự thật duy nhất — dùng khi lọc/hiển thị, không tự chế thêm trạng thái)

| Đối tượng | Bảng lookup | Danh sách trạng thái |
|---|---|---|
| Document Master | `document_statuses` | `DRAFT` → `ACTIVE` → `OBSOLETED` / `CLOSED_CANCELLED` |
| Document Revision | `revision_statuses` | `DRAFT` → `PENDING_REVIEW` → `PENDING_APPROVAL` → `PENDING_TRAINING` → `READY_FOR_PUBLISHING` → `EFFECTIVE` → `OBSOLETED` / `CLOSED_CANCELLED` |
| Controlled Copy | `controlled_copy_statuses` | Chỉ **4** mã: `READY_FOR_DISTRIBUTION` → `DISTRIBUTED` → `OBSOLETED` / `CLOSED_CANCELLED`. Recalled/Lost/Damaged/Destroyed đều là `OBSOLETED` + cột phụ `obsolete_reason` (`RECALLED`/`LOST`/`DAMAGED`/`DESTROYED`) + `current_stage` — **không phải 6 trạng thái riêng**, sửa lại mọi tài liệu/UI đang giả định sai (task 0.4). |

### A.1 Document Master

| Trạng thái | Chức năng | Permission code | Ký điện tử? | Tick ở Permission Explorer có tác dụng thật? |
|---|---|---|---|---|
| DRAFT | Save, Next Step | (không qua permission code — chỉ `canAdministerDocumentWorkspace`) | Không | N/A — không phải permission đơn lẻ |
| DRAFT | Select Related/Correlated Documents, Reviewers, Approvers | (cùng `canAdministerDocumentWorkspace`) | Không | N/A |
| DRAFT | Upload Revision (lần đầu) | (định danh Author/Co-Author, không qua permission code) | Không | N/A |
| DRAFT | Cancel | `documents.document.cancel` (alias `canCancelDocument`) | Không | ✅ Có (đã sửa ở 0.1 — đọc `document.canCancel` từ BE) |
| ACTIVE | Obsolete | `documents.document.obsolete` | **Có** | ✅ Có (đã sửa ở 0.1 — trước đó bảng này ghi nhầm là đã đúng từ V170, thực tế FE vẫn đang dùng `canAdministerDocumentWorkspace` đoán; nay đọc `document.canObsolete` từ BE) |
| ACTIVE | Upload Revision (tiếp theo), Request Controlled Copy | (điều kiện trạng thái, không qua permission code riêng ở view này) | Không (ký ở form con) | N/A |
| OBSOLETED | — | Không còn chức năng | — | — |
| CLOSED_CANCELLED | — | Không còn chức năng | — | — |

### A.2 Document Revision

| Trạng thái | Chức năng | Permission code | Ký điện tử? | Tick ở Permission Explorer có tác dụng thật? |
|---|---|---|---|---|
| DRAFT | Save | (capability `updateDraftMetadata`, không qua permission code riêng) | Không | N/A |
| DRAFT | Upload to Office Online | `documents.office_online.upload` | Không | ✅ Có |
| DRAFT | Edit File Online | `documents.office_online.edit` | Không | ✅ Có |
| DRAFT | Complete Authoring | (capability `completeAuthoring`, giới hạn Author) | **Có** | N/A — ràng buộc theo vai Author, không phải permission tick tự do |
| DRAFT | Open Publishing Workspace, Regenerate Review Package | (capability nội bộ) | Không | N/A |
| DRAFT → PENDING_REVIEW | Submit For Review | `documents.revision.submit` | **Có** | ✅ Có |
| DRAFT…READY_FOR_PUBLISHING | Cancel Revision | (capability `cancel`, dùng chung alias `documents.revision.submit`) | **Có** | ⚠️ Có nhưng dùng **chung mã** với Submit — không tách được quyền "chỉ hủy, không được submit" nếu cần (ghi nhận, không bắt buộc sửa ngay) |
| PENDING_REVIEW | Complete Review / Reject | `documents.revision.review` / `documents.revision.reject_review` | **Có** | ✅ Có |
| PENDING_REVIEW | Retry Snapshot | (cùng quyền Review) | Không | N/A |
| PENDING_APPROVAL | Complete Approve / Reject | `documents.revision.approve` / `documents.revision.reject_approval` | **Có** | ✅ Có |
| PENDING_TRAINING | Complete Training | `documents.training.complete` | **Có** | ✅ Có |
| READY_FOR_PUBLISHING | Publish | `documents.revision.publish` | **Có** | ✅ Có (permission được seed ở V171) |
| EFFECTIVE | Request Controlled Copy | (điều kiện trạng thái) | Không (ký ở form con) | N/A |
| OBSOLETED / CLOSED_CANCELLED | — | Không còn chức năng | — | — |

> Ghi chú: nhóm Revision dùng `useRevisionActionCapabilities` (BE trả capability đã resolve sẵn theo revision cụ thể) thay vì gọi `hasPermissionAlias` trực tiếp — đây thực chất là **tiền thân thu nhỏ của `EffectiveAccessPanel`** (Phase 3), cho 1 revision thay vì cho cả vai trò. Khi code Phase 3, nên khảo sát tái dùng service BE đứng sau hook này.

### A.3 Controlled Copy

| Trạng thái | Chức năng | Action code (BE capability) | Permission code | Ký điện tử? | Tick ở Permission Explorer có tác dụng thật? |
|---|---|---|---|---|---|
| (khởi tạo) | Submit Request | `requestCopy` | `documents.controlled_copy.request` | **Có** | ✅ Có |
| READY_FOR_DISTRIBUTION | Distribute (CC/Batch) | `distributeCopy` / `distributeBatch` | `documents.controlled_copy.distribute` | **Có** | ✅ Có |
| READY_FOR_DISTRIBUTION | Cancel Distribution (CC/Batch) | `cancelRequest` / `cancelBatch` | `documents.controlled_copy.cancel_request` | Chưa xác nhận rõ | ✅ Có (permission tồn tại, chưa xác nhận UI có gọi đủ e-sign) |
| — (thiếu) | Approve/Reject Request, Prepare Distribution | `approveRequest` / `rejectRequest` / `prepareDistribution` | `documents.controlled_copy.approve_request` / `.reject_request` / `.prepare_distribution` (đã seed ở V171) | — | ❌ **Permission đã tick được, nhưng không có nút nào trên UI dùng tới** — xem task 0.2 |
| DISTRIBUTED | Recall Immediately (CC/Batch) | `recallCopy` / `recallBatch` | `documents.controlled_copy.recall` | **Có** | ✅ Có |
| DISTRIBUTED | Report Lost/Damaged → Destroy | `reportLostDamaged` → `confirmDestroy` | `documents.controlled_copy.report_lost_damaged` → `.confirm_destroy` | **Có** | ✅ Có |
| Mọi trạng thái | Preview / Download file | `previewFile` / `downloadFile` | `documents.controlled_copy.view` / `.download_file` | Không | ✅ Có |
| OBSOLETED (mọi lý do phụ) | — | Mọi action khác trả `allowed=false` | — | — | — |
| CLOSED_CANCELLED | — | Trạng thái kết thúc | — | — | — |

> Lưu ý: `canAuthorizeControlledCopy`/`canPrintControlledCopy`/`canViewControlledCopyLog` (3 alias legacy trong `useDocumentPermissions.ts`) **không nằm trong bảng trên** vì chúng là code chết — Controlled Copy gate hoàn toàn qua action-code + permission thật ở BE, không qua 3 alias này (xem task 0.3).

---

## Phase 0 — Vá lỗ hổng phân quyền thật (ưu tiên cao nhất, làm trước tiên)

### 0.1 Wiring nút Cancel (Document Master) vào đúng permission check — ✅ ĐÃ HOÀN THÀNH

**Kết quả triển khai:** thêm `canCancel`/`canObsolete` (boolean) vào `DocumentDetailResponse` (BE), tính bằng cách gọi thẳng `documentAuthorizationService.canCancelDocument`/`canObsoleteDocument` (không viết logic mới) trong `DocumentService.getDocumentDetailInternal`. FE (`NewDocumentView.tsx`) đọc thẳng 2 field này, không còn dùng `isSaved`-only hay `canAdministerDocumentWorkspace`/`isDcoUser` để quyết định hiện nút. Endpoint ghi (`POST /documents/{id}/cancel`, `documentService.cancelDocument` → `requireCanCancelDocument`) giữ nguyên, không đổi.

> ⚠️ **Phát hiện thêm khi triển khai — bảng A.1 bên dưới đã SAI khi ghi Obsolete là "✅ đã wiring đúng"**: nút Obsolete thực ra đang dùng đúng pattern lỗi như Cancel (`canAdministerDocumentWorkspace` đoán ở FE), không phải đã đúng như xác nhận trước đó ở V170. Đã sửa cùng đợt này sang đọc `canObsoleteDocument` (BE-computed), theo đúng cơ chế vừa làm cho Cancel — không phải để dành việc này cho task khác vì cùng root cause và cùng file.



**Vấn đề:** nút Cancel ở `NewDocumentView.tsx` chỉ kiểm tra state cục bộ `isSaved`, không gọi `canCancelDocument`/`documents.document.cancel` — bất kỳ user nào vào được màn hình đều Cancel được, bất kể có tick quyền này trong Permission Set hay không (đối chiếu bảng A.1). BE đã đúng (`DocumentAuthorizationService.requireCanCancelDocument`, migration V170) nhưng FE chưa dùng.

> **⚠️ Sửa sau audit lần 2 — bỏ hẳn cách "FE tự đoán" (`canAdministerDocumentWorkspace`/`isDcoUser`), chuyển sang BE tính sẵn:**
>
> Bản vá lần 1 (dùng `canAdministerDocumentWorkspace || isDcoUser` làm 2 nhánh dự phòng ở FE) **vẫn có lỗ hổng**: đã xác nhận `isDcoUser` (`usePermissions.ts:60-66`) **không hề kiểm tra DCO pool thật** — nó chỉ lặp lại 1 tập permission admin chung chung (`documents.module.view`, `.document.create`, `documents.admin.view`...), trùng gần hết với `canAdministerDocumentWorkspace`. **FE không có cách nào biết ai thực sự thuộc DCO pool** (`document_workflow_pool_members` — dữ liệu chỉ BE có), nên user CHỈ thuộc DCO pool thật (không có permission admin nào) vẫn sẽ mất nút Cancel dù BE cho phép — bản vá lần 1 không thực sự giải quyết xong vấn đề.
>
> **Nguyên nhân gốc rộng hơn cả nút Cancel:** `WorkflowPoolTypes` (`DCO`/`REVIEWER`/`APPROVER`) là 1 **enum Java cứng thứ 2** (sibling của `WorkflowRoleCode` mà 0.5a đang xử lý), dùng ở 5 file BE (`DocumentAuthorizationService`, `UserManagementService`, `WorkflowActionPolicyService`, `ControlledCopyExpiryScheduler`...). Nếu công ty đổi tên chức danh "DCO" hay không dùng khái niệm này nữa, phải sửa code Java — đúng vấn đề admin nêu ra, không giới hạn ở riêng nút Cancel. Xử lý dứt điểm ở task 0.5a (mở rộng), xem đó.
>
> **Cách sửa đúng cho RIÊNG nút Cancel, không phụ thuộc việc xử lý xong 0.5a:** thay vì FE tự ghép nhiều điều kiện đoán theo logic BE (dễ sai, dễ lệch mỗi khi BE đổi luật), để **BE tính sẵn** kết quả `canCancel`/`canObsolete` cho document đang xem và trả thẳng trong response chi tiết — **đúng pattern đã dùng cho Revision** (`useRevisionActionCapabilities`, BE trả capability đã resolve sẵn, FE chỉ đọc `capabilities.can("cancel")`, không tự suy luận permission ở FE). Cách này tự động đúng với BẤT KỲ logic bypass nào BE có (permission, doc-admin, DCO pool, hay sau này đổi thành gì khác ở 0.5a) — FE không cần biết chi tiết, không cần sửa lại mỗi khi luật BE đổi.

- [ ] Backend: thêm 2 field vào response chi tiết document (`DocumentDetailResponse` hoặc tương đương): `canCancel: boolean`, `canObsolete: boolean` — tính bằng cách gọi thẳng `documentAuthorizationService.canCancelDocument(currentUser, document)` / `.canObsoleteDocument(...)` (2 method **đã có sẵn** từ migration V170, đang dùng ở tầng `require...`) — không viết lại logic, chỉ expose kết quả đã tính ra response.
- [ ] Frontend — `NewDocumentView.tsx`: xoá điều kiện `isSaved`-only hiện tại, thay bằng đọc thẳng `document.canCancel` từ response (không gọi `useDocumentPermissions()`/`hasPermissionAlias` cho nút này nữa — không cần FE tự suy luận permission + bypass nữa).
      - Khi **chưa save** (`!isSaved`, đang tạo mới, chưa có `document.id`, chưa có response từ BE để đọc `canCancel`) → giữ nguyên nút "Back" như cũ, không cần check quyền (chưa có gì để huỷ).
      - Khi **đã save** (`isSaved`, đã có `document` từ BE) → nút đổi label "Cancel", **chỉ hiện nếu `document.canCancel === true`**.
- [ ] Không đổi hàm `handleCancelConfirm`/luồng `AlertModal` hiện có — chỉ đổi điều kiện render nút gọi tới hàm đó.
- [ ] **Tiêu chí hoàn thành:**
      1. Tạo 1 Permission Set test **không chứa** `documents.document.cancel`, gán cho 1 Access Profile test **không có** quyền admin nào, gán cho 1 user test **không thuộc** DCO pool → mở Document Draft đã lưu → nút Cancel **không hiện** (response `canCancel: false`).
      2. Gán thêm `documents.document.cancel` vào Permission Set đó → reload → nút Cancel **hiện** (response `canCancel: true`) và hoạt động bình thường.
      3. Tạo 1 user test KHÁC, **không có** `documents.document.cancel` nhưng **thuộc DCO pool thật** (`document_workflow_pool_members`) → xác nhận nút Cancel **vẫn hiện** (vì BE tự tính `canManageDocumentWorkspace` = true qua pool, response `canCancel: true`) — chứng minh không regression cho user DCO, và **không cần FE biết gì về khái niệm DCO/pool cả**.
      4. Gọi thẳng `POST /documents/{id}/cancel` bằng user không thoả điều kiện nào → vẫn nhận 403 (xác nhận BE không đổi, chỉ thêm field đọc, không đổi logic chặn).
- [ ] Cả BE lẫn FE đều cần sửa (khác bản trước chỉ định FE) — nhưng phần BE rất nhỏ (2 dòng gọi lại method có sẵn), không phải viết logic mới.

### 0.2 Xác nhận nghiệp vụ: bước "Authorize" Controlled Copy còn thiếu hay không cần

**Vấn đề:** đối chiếu bảng A.3, 3 permission `documents.controlled_copy.approve_request`/`.reject_request`/`.prepare_distribution` đã tồn tại và **tick được** trong Permission Explorer, nhưng **không có nút nào trên UI** thực sự dùng tới chúng — tick vào 3 quyền này hiện tại không có tác dụng gì.

- [ ] **Bước 1 (không code):** hỏi lại đội nghiệp vụ/QA câu hỏi cụ thể: *"Quy trình Controlled Copy thật có cần 1 người khác duyệt yêu cầu (Approve/Reject Request) trước khi người phụ trách Distribute thực hiện phân phối không? Hay 1 người vừa nhận yêu cầu vừa phân phối luôn (không tách vai trò)?"*
- [ ] **Nếu câu trả lời là CÓ tách vai trò (cần bước duyệt riêng):**
      - [ ] Backend: xác nhận `ControlledCopyService` đã có method xử lý transition `READY_FOR_DISTRIBUTION` (giữ nguyên) nhưng thêm 1 sub-status/flag "đã duyệt" trước khi cho phép Distribute — hoặc dùng lại đúng pattern Reject-with-reason đã có ở Revision Review/Approval (`RevisionReviewView.tsx`/`RevisionApprovalView.tsx`) làm mẫu.
      - [ ] Frontend: file mới `eqms/src/features/documents/controlled-copies/ApproveControlledCopyRequestView.tsx` (hoặc thêm 2 nút Approve/Reject ngay trong `ControlledCopyDetailView.tsx` nếu không cần trang riêng) — tái dùng `ESignatureModal` + `getControlledCopyActionDecision(capabilities, "approveRequest"|"rejectRequest")` đã định nghĩa sẵn trong `controlledCopyCapabilities.ts`.
      - [ ] Cập nhật bảng A.3 sau khi xong (đánh dấu ✅ thay vì ❌).
- [ ] **Nếu câu trả lời là KHÔNG cần tách (giữ nguyên Request → Distribute thẳng):**
      - [ ] Xoá 3 action type `approveRequest`/`rejectRequest`/`prepareDistribution` khỏi `controlledCopyCapabilities.ts`.
      - [ ] Xoá 3 permission `documents.controlled_copy.approve_request`/`.reject_request`/`.prepare_distribution` khỏi catalog bằng 1 migration nhỏ tương tự V171 (kiểm tra trước xem có Permission Set nào đã tick 3 quyền này chưa — nếu có, migration phải xử lý repoint/xoá an toàn giống cách đã làm ở V171, không được xoá thẳng nếu đang có FK tham chiếu).
- [ ] **Không tự quyết định nhánh nào** — đây là quyết định nghiệp vụ, phải chờ xác nhận trước khi chọn 1 trong 2 nhánh trên.

### 0.3 Dọn 3 permission alias chết — ✅ ĐÃ HOÀN THÀNH (verify lại: 0 consumer, đã xoá khỏi `useDocumentPermissions.ts` + `DOCUMENT_PERMISSION_CODES`, build FE sạch)

- [ ] File: `eqms/src/features/documents/shared/useDocumentPermissions.ts`.
- [ ] Trước khi xoá, chạy `grep -rn "canAuthorizeControlledCopy\|canPrintControlledCopy\|canViewControlledCopyLog" eqms/src` để xác nhận 100% không còn nơi nào tiêu thụ (đã xác nhận sơ bộ trong lượt rà soát trước, nhưng phải tự chạy lại trước khi xoá vì code có thể đã đổi).
- [ ] Xoá 3 dòng field trong object trả về của hook + 3 dòng tương ứng trong `DOCUMENT_PERMISSION_CODES` (`authorizeControlledCopy`, `printControlledCopy`, `viewControlledCopyLog`).
- [ ] Nếu task 0.2 kết luận cần giữ 1 số permission tương tự (VD `approve_request`) cho nhánh "có tách vai trò" — không xoá permission catalog tương ứng, chỉ xoá đúng 3 alias FE thật sự chết.
- [ ] Có thể gộp làm cùng đợt với 1 migration dọn permission catalog kế tiếp (không bắt buộc làm riêng lẻ ngay).

### 0.4 Sửa giả định sai về trạng thái Controlled Copy — ✅ ĐÃ KIỂM TRA (rà lại `types.ts`/`status.ts`/`ControlledCopiesView.tsx`/`docs/`: đã đúng mô hình 4 trạng thái + `obsolete_reason`, không tìm thấy giả định sai 6 trạng thái nào — không cần sửa runtime)

- [ ] Rà `docs/` và mọi comment/JSDoc trong `controlled-copies/` có giả định 6 trạng thái (RECALLED/EXPIRED/DESTROYED là status riêng) → sửa lại thành đúng 4 mã (`READY_FOR_DISTRIBUTION`/`DISTRIBUTED`/`OBSOLETED`/`CLOSED_CANCELLED`) + giải thích `obsolete_reason`/`current_stage` là cột phân loại phụ, không phải status.
- [ ] Rà UI filter Controlled Copy (list view) — nếu có dropdown lọc theo status đang liệt kê sai 6 giá trị, sửa lại đúng 4 giá trị (giữ nguyên nếu UI đã đúng — chỉ là tài liệu sai, chưa xác nhận UI có sai hay không, cần kiểm tra khi thực hiện task này).
- [ ] Không cần sửa code runtime nếu UI/BE vốn đã đúng theo 4 mã — task này chủ yếu là kiểm tra + sửa tài liệu.

### 0.5a Biến `WorkflowRoleCode` **và** `WorkflowPoolTypes` từ 2 enum cứng thành 1 catalog mở rộng được — ✅ ĐÃ HOÀN THÀNH (độc lập với 0.5b — xem đính chính ở 0.5b)

**Kết quả triển khai:** migration `V172__workflow_roles_catalog.sql` (bảng `workflow_roles`, seed 9 dòng — 8 role cũ + DCO đã dedup từ pool type), `WorkflowRoleCatalogService`/`WorkflowRoleRepository`/`WorkflowRoleController` (CRUD e-sign + audit, theo đúng pattern Permission Set). `WorkflowActionPolicyService` đọc role list từ `WorkflowRoleRepository` thay vì `WorkflowRoleCode.values()`. `DocumentAuthorizationService.canViewAllDocuments` giữ **OR cả 2 đường** (legacy `document_workflow_pool_members` VÀ `access_profile_workflow_roles` mới) — không cắt cầu ngay, đúng nguyên tắc additive/rollback-an toàn; có test parity `WorkflowRolesCatalogParityTest` xác nhận cả 4 tổ hợp (chỉ legacy / chỉ mới / cả hai / không có) đều trả đúng kết quả. FE `WorkflowRolesView.tsx` đã có nút New/Edit thật (form Code*/Label*/Module*/Description/Active, e-sign qua `useSecurityESign`, gọi `/security/workflow-roles/catalog`) — Code bị khoá sau khi tạo (chỉ sửa Label), đúng yêu cầu "đổi tên chức danh không cần sửa code".

**Việc CHƯA làm (để dành, không chặn go-live)**: `UserManagementService.replacePoolMembers` vẫn thao tác trên bảng `document_workflow_pool_members` cũ (chưa chuyển hẳn sang `access_profile_workflow_roles`) — an toàn vì `canViewAllDocuments` đã OR cả 2 đường nên không mất quyền ai; xoá bảng cũ + `WorkflowPoolTypes` sẽ làm ở đợt dọn dẹp sau khi quan sát ổn định ở production (đúng khuyến nghị "giữ 2 đường chạy song song 1 thời gian" trong kế hoạch).

**Verify:** `./mvnw clean compile` + test suite liên quan (`WorkflowRolesCatalogParityTest`, `WorkflowActionPolicyServiceTest`, `WorkflowActionPolicyMultiWorkflowTest`, `RevisionWorkflowAuthorizationPolicyRuntimeTest`, `StrictParticipantVisibilityTest`, `DocumentAuthorizationServiceTest`) đều pass; `npm run build` sạch. (3 test khác thất bại trong lúc chạy full suite — `RevisionBusinessRulesTest`, `UpgradeRevisionIntegrationTest`, `StoragePathBuilderTest` — xác nhận không liên quan tới thay đổi này, không tham chiếu `WorkflowRoleRepository`/constructor đã đổi; để nguyên, không thuộc phạm vi task này.)



**Vấn đề (đã xác nhận trực tiếp trong code):** có **2 enum cứng riêng biệt**, cùng 1 bản chất (danh mục vai trò quy trình), chưa ai gộp:
1. `WorkflowRoleCode` (`eqms-backend/src/main/java/com/eqms/enums/WorkflowRoleCode.java`) — 8 giá trị (`DOCUMENT_AUTHOR`, `DOCUMENT_REVIEWER`, `DOCUMENT_APPROVER`, `DOCUMENT_PUBLISHER`, `DCO`, `TRAINING_REVIEWER`, `TRAINING_APPROVER`, `QUALITY_ADMIN`), gán qua Access Profile (`access_profile_workflow_roles`).
2. `WorkflowPoolTypes` (`eqms-backend/src/main/java/com/eqms/config/WorkflowPoolTypes.java`) — 3 giá trị (`DCO`, `REVIEWER`, `APPROVER`), dùng ở **5 file khác** (`DocumentAuthorizationService`, `UserManagementService`, `WorkflowActionPolicyService`, `ControlledCopyExpiryScheduler`), gán qua bảng **riêng** `document_workflow_pool_members`.

Cả 2 đều bị hardcode, cả 2 đều trả lời cùng 1 câu hỏi ("ai đủ điều kiện đóng vai trò X trong quy trình") nhưng bằng 2 cơ chế dữ liệu khác nhau (`access_profile_workflow_roles` vs `document_workflow_pool_members`), không liên thông. **Đây chính là vấn đề admin nêu ra**: "DCO" xuất hiện hardcode ở cả 2 nơi (1 lần trong `WorkflowRoleCode.DCO`, 1 lần trong `WorkflowPoolTypes.DCO`) — đổi tên chức danh này phải sửa code ở 2 chỗ, chưa kể 5 file tiêu thụ `WorkflowPoolTypes`.

**Tin tốt:** cả 2 cột lưu trữ đã linh hoạt sẵn — `access_profile_workflow_roles.workflow_role` và `document_workflow_pool_members.pool_type` đều là `varchar` tự do, không FK ràng buộc enum. Gộp 2 khái niệm này về 1 catalog + 1 cơ chế gán duy nhất là khả thi mà không cần đổi kiểu cột.

**Đề xuất gộp:** "Pool" chỉ nên là cách gọi khác của "Workflow Role đã gán qua Access Profile" — không cần bảng `document_workflow_pool_members` riêng nữa. Sau khi gộp, "thuộc DCO pool" ⇔ "user có Access Profile đang gán Workflow Role code = DCO" — 1 nguồn sự thật duy nhất.

**Việc cần làm:**

- [ ] Migration mới (Vxxx — lấy số tiếp theo từ `db/migration/`): tạo bảng `workflow_roles` (catalog chung cho cả 2 khái niệm cũ):
      ```sql
      CREATE TABLE workflow_roles (
          id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          code         varchar(80)  UNIQUE NOT NULL,   -- 'DOCUMENT_REVIEWER', 'DCO', 'CAPA_INVESTIGATOR'...
          label        varchar(200) NOT NULL,
          module_key   varchar(80)  NOT NULL,          -- 'documents', 'capa', 'training'...
          description  text,
          display_order int NOT NULL DEFAULT 100,
          active       boolean NOT NULL DEFAULT true,
          is_system    boolean NOT NULL DEFAULT false, -- true cho 8 + 3 vai trò/pool gốc, không xoá được
          created_at, updated_at, created_by, updated_by
      );
      ```
      Seed sẵn đúng 8 vai trò hiện có từ `WorkflowRoleCode` **và** 3 pool type từ `WorkflowPoolTypes` (bỏ trùng `DCO` — chỉ 1 dòng `DCO` duy nhất trong catalog mới, không phải 2 dòng như 2 enum cũ cộng lại), tất cả đánh dấu `is_system = true` (giữ nguyên hành vi hôm nay, không mất gì).
- [ ] Backend: thêm `WorkflowRoleRepository` + CRUD service (`create`/`update`/`deactivate`, **không cho xoá** `is_system = true`, mọi thay đổi ký điện tử + audit — đúng pattern đã dùng cho Permission Set/Access Profile), API `GET/POST/PUT /security/workflow-roles`.
- [ ] Thay `WorkflowRoleCode.values()` ở `WorkflowRoleService`/`WorkflowActionPolicyService` bằng truy vấn `workflowRoleRepository.findAllByActiveTrue()` — **không đổi hành vi cho 8 vai trò cũ**, chỉ đổi nguồn dữ liệu từ enum sang bảng.
- [ ] **Thay thế `document_workflow_pool_members` bằng `access_profile_workflow_roles`:** sửa `documentWorkflowPoolMemberRepository.findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc(WorkflowPoolTypes.DCO)` (dùng ở `DocumentAuthorizationService.canViewAllDocuments`, `ControlledCopyExpiryScheduler`) thành truy vấn "user nào đang có Access Profile gán Workflow Role code = 'DCO'" (join `access_profile_workflow_roles` → `user_access_profiles`). Migrate dữ liệu: copy toàn bộ `document_workflow_pool_members` hiện có sang `access_profile_workflow_roles` (mỗi user trong pool DCO/REVIEWER/APPROVER được gán Workflow Role tương ứng qua 1 Access Profile — nếu user đó chưa có Access Profile phù hợp, cần tạo 1 Access Profile trung gian hoặc gán trực tiếp, tuỳ dữ liệu thật lúc migrate). Sau khi xác nhận ổn định, xoá bảng `document_workflow_pool_members` và class `WorkflowPoolTypes`.
- [ ] Sửa `UserManagementService` (nơi quản lý gán Reviewer/Approver/DCO pool qua `replacePoolMembers`) chuyển sang thao tác trên `access_profile_workflow_roles` thay vì bảng pool cũ — **đây là thay đổi có ảnh hưởng UI** (màn hình đang cho gán pool ở đâu đó trong User Management cần trỏ sang cơ chế Access Profile + Workflow Role), cần rà lại đúng màn hình đang gọi `UserManagementService.replacePoolMembers`/liên quan trước khi đổi.
- [ ] Frontend: `WorkflowRolesView.tsx` hiện đang là màn tham chiếu chỉ đọc (nút Clone/Edit từng báo "not yet implemented" ở lượt trước) — nay bảng đã có CRUD thật, hoàn thiện luôn 2 nút New/Edit (form: Code*, Label*, Module*, Description, Active) theo đúng pattern Permission Set Form (không tạo pattern UI mới).
- [ ] **Tiêu chí hoàn thành:**
      1. 8 vai trò cũ vẫn hoạt động y hệt trước khi đổi (regression test: gán "Document Reviewer" cho 1 Access Profile, xác nhận Workflow Action Policy vẫn resolve đúng actor).
      2. `canViewAllDocuments`/DCO-bypass vẫn hoạt động y hệt trước khi đổi (regression test: user đang thuộc DCO pool hôm nay, sau khi migrate dữ liệu, vẫn thấy được mọi tài liệu như trước — không mất quyền).
      3. Tạo được 1 vai trò mới hoàn toàn qua UI (VD "CAPA Investigator", module `capa`) mà **không cần sửa code/deploy lại**.
      4. Đổi tên "DCO" thành tên khác (VD "Document Control Officer") **chỉ bằng cách sửa `label` qua UI**, không cần sửa code — chứng minh đúng yêu cầu ban đầu của admin (chức danh không hardcode).
      5. Vai trò mới xuất hiện đúng trong dropdown chọn Workflow Role ở tab "Workflow Authorization" của Access Profile.
- [ ] Đây là task nền tảng cho mọi module tương lai (Phase 4) — làm 1 lần, dùng lại mãi mãi, không phải làm lại mỗi khi thêm module mới, và giải quyết dứt điểm việc "DCO"/"Reviewer Pool"/"Approver Pool" đang hardcode ở 2 nơi khác nhau. **Không còn là điều kiện tiên quyết của 0.5b** (0.5b đã đổi sang lọc theo permission, độc lập với Workflow Role).

### 0.5b Endpoint chung "Eligible Users theo permission" — dùng được cho mọi module, không riêng Documents — ✅ ĐÃ HOÀN THÀNH

**Kết quả triển khai:** `GET /security/eligible-users?permissionCode=...` (package `security-authorization`, không đặt trong `DocumentController`) — lọc user Active qua `PermissionEvaluationService.hasPermission()` (không phải gọi thẳng `EffectivePermissionService.getEffectivePermissionCodes().contains()` như bản thảo đầu, vì cách đó bỏ sót SysAdmin — đã điều chỉnh, vẫn giữ đúng nguyên tắc "tái dùng service, không tự JOIN SQL", vẫn tôn trọng legacy role fallback). Picker Reviewer/Approver thật sự nằm ở `ReviewersTab.tsx`/`ApproversTab.tsx` (không phải `NewDocumentView.tsx` như dự đoán ban đầu — đã sửa đúng file) — chuyển từ `settingsApi.getDocumentAdministrationUsers({pool})` (hardcode pool) sang `securityApi.getEligibleUsers(permissionCode)`. Thứ tự lọc giữ đúng: permission trước → loại trừ Author/Co-Author sau. `./mvnw clean compile` + `npm run build` sạch.

**Việc CHƯA verify được (ghi nhận trung thực, không tự nhận đã test hết)**: 6 tiêu chí hoàn thành trong kế hoạch chỉ được xác nhận qua đọc code/logic, chưa chạy trên môi trường thật (không có DB/server đang chạy trong phiên làm việc) — cần click-through thủ công 1 lượt trên staging trước khi coi là go-live, đặc biệt kịch bản GMP cụ thể (Author C biến mất khỏi Reviewer sau khi chọn).



> **Đính chính so với bản trước:** bản đầu tôi thiết kế lọc picker theo `workflowRoleCode` (phụ thuộc 0.5a). Sau khi trao đổi lại: cổng kiểm tra thật ở runtime là **permission** (`hasPermission` trong `evaluatePolicy`) + **actor được assign** — Workflow Role chỉ là 1 cơ chế cấu hình actor khác (kiểu "cả role được làm mà không cần assign riêng"), không phải điều kiện picker cần lọc theo. Lọc thẳng theo **permission code** vừa đúng bản chất, vừa đơn giản hơn, vừa **không cần chờ 0.5a xong mới làm được** — 2 task giờ độc lập nhau.
>
> **Đính chính thêm lần 2:** đặt endpoint dưới `/security/` (không phải `/documents/`) — vì đây không phải tính năng riêng của Documents, mà là **hạ tầng dùng chung cho mọi module**. CAPA/Deviations/Complaints/... sau này gọi thẳng **cùng 1 endpoint có sẵn** (chỉ đổi tham số `permissionCode`), không tự tạo bản sao riêng — tránh lặp lại đúng kiểu trùng lặp code đã gặp ở permission legacy (39 mã) trước đây.

**Bối cảnh (đã xác nhận trực tiếp trong code, không suy đoán):**
- Picker Reviewer/Approver/Co-Author ở bước tạo/sửa tài liệu (`NewDocumentView.tsx:1002-1022`) gọi `settingsApi.getUsers({ status: "Active", limit: 1000 })` → `GET /settings/users` — **danh sách MỌI user đang Active, không lọc theo permission nào cả**. Admin có thể chọn 1 user hoàn toàn không có quyền `documents.revision.review`/`.approve` làm Reviewer/Approver.
- Runtime vẫn an toàn (không phải lỗ hổng tuân thủ): `RevisionWorkflowAuthorizationService.evaluatePolicy`/`evaluateFallback` luôn yêu cầu **cả 2 điều kiện AND** — có permission (`hasPermission`, deny `MISSING_PERMISSION` nếu thiếu) **và** đúng actor được assign (`isPendingReviewer`/`isPendingApprover`, deny `ACTOR_NOT_ALLOWED` nếu không phải actor). Người được chọn nhầm sẽ luôn bị từ chối khi thao tác thật — nhưng **chỉ phát hiện ra lúc đó**, không báo trước lúc chọn ở bước tạo tài liệu. Đây là gap về UX/thiết kế, không phải gap tuân thủ.
- Cơ chế "pool" (nhóm user đủ điều kiện) **đã tồn tại sẵn cho DCO** — `DocumentWorkflowPoolMemberRepository` + `WorkflowPoolTypes.DCO` — nhưng đó là cơ chế pool riêng cho actor kiểu role-based (DCO không gắn theo permission cụ thể của 1 tài liệu). Với Reviewer/Approver, "pool" đúng nghĩa hơn chính là **tập user đang có permission tương ứng** — không cần bảng pool riêng, không cần Workflow Role, chỉ cần truy vấn permission hiệu lực (effective permission) của user, thứ Access Profile/Permission Set đã có sẵn.

**Việc cần làm:**

> **⚠️ Sửa sau audit — 2 điểm cần chính xác hơn:**
> 1. **Không phải "tái dùng logic có sẵn"** như câu chữ bản trước — đã kiểm tra `EffectivePermissionService`/`UserAccessProfileRepository`/toàn bộ package `service`: **không có sẵn truy vấn chiều ngược** (permission → users). Chỉ có chiều thuận (`getEffectivePermissionCodes(user)`: user → tập permission). Đây là 1 query/method **mới thật sự**, không phải gọi lại cái có sẵn — cần tính đúng effort, không đánh giá thấp.
> 2. **Quan trọng hơn:** `EffectivePermissionService` có flag `app.security.legacy-role-fallback-enabled` **mặc định = `true`** (đang bật) — nghĩa là hệ thống **hiện tại** vẫn cho phép user có hiệu lực permission qua đường **legacy `role_permissions`** (bảng `roles`/`role_permissions` cũ), song song với đường chính thức `user_access_profiles` → `access_profile_permission_sets` → `permission_set_items` → `permissions`. Nếu viết 1 câu SQL JOIN mới chỉ đi qua đường chính thức (như dự định ban đầu), sẽ **bỏ sót đúng những user đang dựa vào legacy fallback** — tạo ra sai lệch ngược: picker thiếu người thực ra vẫn có quyền.
>
> **Cách làm đúng:** không viết SQL JOIN tự chế đi vòng qua `EffectivePermissionService` — lấy danh sách user Active (giới hạn hợp lý, VD theo Business Unit/Department nếu cần thu hẹp), rồi lọc **bằng cách gọi lại `effectivePermissionService.getEffectivePermissionCodes(user).contains(permissionCode)`** cho từng user — service này đã tự xử lý đúng cả 2 đường (chính thức + legacy fallback) và đã có cache sẵn (`evictUserCache`), nên chi phí lặp chấp nhận được với quy mô user hiện tại (không phải hàng chục nghìn). Đây **mới thực sự là "tái dùng logic có sẵn"** — tái dùng đúng chỗ (service tính effective permission), không tái dùng ở tầng query.

- [ ] Backend — endpoint mới, đặt ở `security-authorization` (dùng chung mọi module), lọc theo **permission code**: `GET /security/eligible-users?permissionCode=documents.revision.review` (bỏ `documentTypeId` — filter theo document type nếu cần nên xử lý ở Object Access Rule/tầng khác, không trộn vào endpoint chung này).
      - Lấy danh sách user Active (query đơn giản qua `UserAccountRepository` hoặc tương đương) → lọc từng user qua `effectivePermissionService.getEffectivePermissionCodes(user).contains(permissionCode)` — **không viết JOIN SQL mới xuyên qua access_profile_permission_sets/permission_set_items**, vì sẽ bỏ sót user đang có quyền qua legacy role fallback (đang bật mặc định).
      - Trả về danh sách rút gọn (id, fullName, email, department) — đủ để hiển thị picker, không trả toàn bộ `UserResponse`.
      - Đặt route tại `SecurityUserController` hoặc tương đương trong `security-authorization` backend package — **không** đặt trong `DocumentController`, để CAPA/Deviations/module khác gọi thẳng mà không phải import chéo package của Documents.
      - Nếu số lượng user Active lớn (nghìn+) và việc lặp qua từng user chậm, cân nhắc thêm cache ở tầng endpoint (key theo `permissionCode`, evict khi có thay đổi Permission Set/Access Profile) — không bắt buộc ngay, chỉ ghi nhận nếu đo được chậm thật.
- [ ] Frontend — `NewDocumentView.tsx`: thay lời gọi `settingsApi.getUsers(...)` hiện tại (dùng chung cho Reviewers/Approvers) bằng lời gọi tới endpoint mới ở trên (đặt trong `src/services/api/security.ts` hoặc file API chung của security-authorization, không đặt trong `documents.ts`, để module khác import lại được):
      - Tab Reviewers → `permissionCode=documents.revision.review`.
      - Tab Approvers → `permissionCode=documents.revision.approve`.
      - Giữ nguyên toàn bộ logic loại trừ đã có (`collectExcludedWorkflowParticipantIds`, loại Author/Co-Author khỏi danh sách) — chỉ đổi nguồn danh sách đầu vào từ "mọi user Active" sang "user đang có đúng permission".
      - Nếu danh sách trả về rỗng: hiện thông báo rõ ràng ("Chưa có user nào có quyền Review — vào Permission Sets/Access Profiles để gán trước") thay vì để trống khó hiểu.
- [ ] Không đổi `validateAuthorAndCoAuthorExclusions`/`validateSoD` ở `DocumentService.java` — cơ chế chống xung đột vai trò trong cùng tài liệu giữ nguyên, không liên quan đến việc lọc picker.
- [ ] **Tiêu chí hoàn thành:**
      1. Tạo user A test có Access Profile "Reviewer" (quyền `documents.revision.review`/`.reject_review`) nhưng KHÔNG được chọn vào danh sách Reviewer của 1 tài liệu cụ thể → xác nhận A **có xuất hiện trong picker** (vì có permission) nhưng **không thao tác được** trên tài liệu đó (vì chưa được assign) — đúng đúng kịch bản đã xác nhận ở lượt trước.
      2. Tạo user test KHÔNG có permission `documents.revision.review` → mở picker Reviewers → user đó **không xuất hiện**.
      3. Gán permission đó cho user qua Permission Set/Access Profile → mở lại picker → user đó **xuất hiện**.
      4. Xác nhận picker Approver lọc độc lập theo `documents.revision.approve`.
      5. Xác nhận việc loại trừ Author/Co-Author khỏi picker vẫn hoạt động đúng như trước.
      6. **Kịch bản GMP cụ thể (đã xác nhận với admin):** tạo Access Profile "Supervisor" có cả 2 quyền `documents.revision.edit_metadata` (đủ để chọn làm Author) **và** `documents.revision.review` (đủ để chọn làm Reviewer), gán cho user C. Ở form tạo tài liệu: (a) picker Author phải thấy user C (đủ quyền); (b) **chọn C làm Author trước**; (c) sau đó mở picker Reviewer → user C **phải biến mất khỏi danh sách Reviewer** dù vẫn đủ permission — vì đã được chọn làm Author cho tài liệu này (loại trừ theo `collectExcludedWorkflowParticipantIds`, không phải theo permission). Xác nhận đúng thứ tự: lọc theo permission trước (rộng) → loại trừ theo lựa chọn hiện tại trong form (hẹp) sau, không được đảo ngược hoặc bỏ sót bước loại trừ khi đổi nguồn danh sách sang permission-based.
- [ ] **Độc lập với 0.5a** — có thể làm trước, sau, hoặc song song, không còn quan hệ phụ thuộc.
- [ ] **Không bắt buộc làm cùng đợt với 0.1–0.4** — có thể làm sau vì đây là cải thiện UX, không phải lỗ hổng bảo mật (runtime đã chặn đúng). Có thể dời sang Phase 4 nếu ưu tiên thời gian hạn chế.

### 0.6 "Request Controlled Copy" hiển thị/cho thao tác ở 5 màn hình mà không kiểm tra quyền — nút Cancel/Obsolete "phiên bản 2" — ✅ ĐÃ HOÀN THÀNH

**Kết quả triển khai:**
- **BE**: `ControlledCopyService.getRequestContext()` — `canRequest` giờ gọi `controlledCopyAuthorizationService.evaluate(currentUser, REQUEST_COPY, context)` thay vì tự tính status-only. Thêm field `canRequestControlledCopy: boolean` vào cả 4 response record (`DocumentDetailResponse`, `DocumentListItemResponse`, `RevisionDetailResponse`, `RevisionListItemResponse`), tính qua cùng `evaluate()` — không viết logic mới, chỉ orchestrate lại đúng service đã có. `DocumentService`/`RevisionService` được tiêm thêm `ControlledCopyAuthorizationService` (đã xác nhận không có dependency vòng tròn trước khi thêm).
- **FE**: 5 màn hình đọc thẳng field `canRequestControlledCopy` từ response thay vì hàm status-only (`canRequestControlledCopyFromDocument/Revision/DocumentDetail` vẫn giữ lại làm safety-net phụ ở `DocumentsView.tsx`/nút Upload Revision, không phải nguồn quyết định chính nữa). Sửa `DetailDocumentView.tsx` (tách riêng điều kiện nút Upload Revision khỏi Request Controlled Copy — trước đây 2 nút bị gộp chung 1 điều kiện, giờ Upload Revision giữ đúng status-only vì đó là hành vi khác, không liên quan permission `documents.controlled_copy.request`). Phát hiện thêm khi code: `RevisionListView.tsx`/`RevisionsOwnedByMeView.tsx` trước đó **hoàn toàn không có gate nào** (kể cả status-only) cho "Request Controlled Copy" trong dropdown — đã bổ sung gate `canRequestControlledCopy` cho cả 2.
- **Verify**: `./mvnw clean compile` + test liên quan (`ControlledCopyAuthorizationServiceTest`, `ControlledCopyControllerCapabilityTest`, `ControlledCopyServiceAuthorizationIntegrationTest`) pass; `npm run build` sạch; chạy lại full `./mvnw test` — đúng 9 lỗi tồn tại từ trước (không liên quan), không hồi quy mới.
- **Chưa verify được**: chưa click-through trên môi trường thật (không có server sống trong phiên làm việc) — cần smoke-test trên staging theo đúng 6 tiêu chí hoàn thành đã liệt kê ở trên trước khi coi là production-ready.

**Vấn đề (đã xác nhận trực tiếp trong code, cả FE lẫn BE, không suy đoán):** cơ chế "Request Controlled Copy" có **3 lớp kiểm tra tách rời nhau**, nhưng chỉ lớp cuối cùng có phân quyền thật — 2 lớp đầu **chỉ kiểm tra trạng thái tài liệu**, hoàn toàn không biết đến permission `documents.controlled_copy.request`:

| Lớp | File | Hàm | Điều kiện thực tế |
|---|---|---|---|
| 1. Hiện/ẩn nút & menu item ở **5 màn hình entry-point** | `document-detail/DetailDocumentView.tsx`, `document-list/DocumentsView.tsx`, `document-revisions/views/RevisionListView.tsx`, `document-revisions/views/RevisionsOwnedByMeView.tsx`, `document-revisions/detail-revision/DetailRevisionView.tsx` | `canRequestControlledCopyFromDocument` / `canRequestControlledCopyFromDocumentDetail` / `canRequestControlledCopyFromRevision` (`shared/controlledCopyRequest.ts:110-133`) | `isActiveDocumentMaster(...) && hasEffectiveRevision` — **không có permission check nào** |
| 2. Nút Submit trên form `RequestControlledCopyView.tsx` (field `canRequest` lấy từ `getControlledCopyRequestContext`) | `ControlledCopyService.getRequestContext()` (BE, dòng 332) | `canRequest = "ACTIVE".equalsIgnoreCase(documentStatus) && currentEffectiveRevision.getId() != null` | **Vẫn chỉ trạng thái** — không gọi `documentAuthorizationService`/`controlledCopyAuthorizationService` cho phần `canRequest` này (2 dòng trên nó *có* gọi `requireCanAccessControlledCopy` nhưng đó là quyền *xem* tài liệu, không phải quyền *request copy*) |
| 3. Endpoint ghi thật `POST /controlled-copies/request` | `ControlledCopyService.requestControlledCopy()` → `controlledCopyAuthorizationService.requireRequestControlledCopy(user, document, revision)` (dòng 581) | ✅ **Có** — gọi `evaluate(user, ControlledCopyWorkflowAction.REQUEST_COPY, context)`, đúng permission `documents.controlled_copy.request`, throw `ControlledCopyAuthorizationException` (403) nếu thiếu quyền |

**Hệ quả cụ thể (tệ hơn cả bug Cancel/Obsolete đã fix ở Task 0.1):** user không có quyền `documents.controlled_copy.request` vẫn thấy nút ở cả 5 màn hình → bấm vào → điền hết cả form (chọn scope phân phối, recipient, lý do ≥10 ký tự, ngày hết hạn nếu có) → mở modal ký điện tử → ký xong → **chỉ lúc đó** `POST` mới trả lỗi. Với Cancel/Obsolete (0.1), cái giá của việc thiếu quyền chỉ là 1 cú click; ở đây cái giá là toàn bộ thời gian điền form + 1 lần ký điện tử vô ích.

**Tin tốt — hạ tầng đúng đã tồn tại sẵn, chỉ chưa được gọi ở đúng chỗ:**
- `ControlledCopyAuthorizationService.evaluate(user, ControlledCopyWorkflowAction.REQUEST_COPY, context)` (dòng 86, `public`, non-throwing, trả `ControlledCopyAuthorizationDecision`) — **đã là đúng hàm cần gọi**, không cần viết logic mới. Đây chính là hàm `requireRequestControlledCopy` (lớp 3) gọi bên trong rồi throw nếu deny — ta chỉ cần gọi thẳng `evaluate(...)` (không throw) ở những nơi cần trả `boolean` cho FE đọc, đúng cặp non-throwing/throwing y hệt `canCancelDocument`/`requireCanCancelDocument` đã dùng ở Task 0.1.
- `ControlledCopyActionCapabilities`/`getControlledCopyActionDecision` (`controlledCopyCapabilities.ts`) — type `ControlledCopyActionCode` **đã có sẵn** action `"requestCopy"` với đầy đủ `reasonCode` (bao gồm `MISSING_PERMISSION`) — nhưng theo grep, action này **chỉ được fetch/dùng ở các màn hình của 1 Controlled Copy ĐÃ TỒN TẠI** (`ControlledCopyDetailView.tsx`, `ExpandControlledCopiesRow.tsx`, `ControlledCopyPreviewView.tsx`, `DestroyControlledCopyView.tsx`) — chưa từng được gọi ở bước **trước khi** request được tạo (5 màn hình entry-point + form). Không cần tạo action code mới, chỉ cần gọi capability này sớm hơn trong luồng.

**Việc cần làm:**

- [ ] **BE — sửa `ControlledCopyService.getRequestContext()`** (dòng 301-354): thay dòng 332 (`canRequest = documentStatus=="ACTIVE" && hasEffectiveRevision`) bằng gọi `controlledCopyAuthorizationService.evaluate(currentUser, ControlledCopyWorkflowAction.REQUEST_COPY, context)` — dùng `decision.allowed()` làm `canRequest`, `decision.message()`/`reasonCode()` làm `message` trả về (đã có sẵn field `message` trong `ControlledCopyRequestContextResponse`, chỉ đổi nguồn). Không đổi 2 dòng `requireCanAccessControlledCopy` phía trên — đó là kiểm tra khác (quyền xem), giữ nguyên.
- [ ] **BE — thêm field `canRequestControlledCopy: boolean`** vào `DocumentDetailResponse`, `DocumentListItemResponse`, `RevisionDetailResponse`, `RevisionListItemResponse` (tất cả đã là Java record, đã có tiền lệ field `canCancel`/`canObsolete`/`canReviewRevision`/`canApproveRevision`/`canPublishRevision` — thêm field mới theo đúng convention, không đổi shape response khác). Tính bằng cách gọi `controlledCopyAuthorizationService.evaluate(currentUser, ControlledCopyWorkflowAction.REQUEST_COPY, context)` tại đúng nơi từng response được build:
      - `DocumentService.toListItem()` (dòng 1543) — cho `DocumentsView.tsx`.
      - `DocumentService` method build `DocumentDetailResponse` (đã có 2 dòng gọi `canCancelDocument`/`canObsoleteDocument` từ Task 0.1 — thêm 1 dòng cạnh đó) — cho `DetailDocumentView.tsx`.
      - `RevisionService`/tương đương build `RevisionDetailResponse` — cho `DetailRevisionView.tsx`.
      - `RevisionService`/tương đương build `RevisionListItemResponse` (đã có `canReviewRevision`/`canApproveRevision`/`canPublishRevision` ở đó — thêm 1 dòng cạnh đó) — cho `RevisionListView.tsx`/`RevisionsOwnedByMeView.tsx`.
      - **Lưu ý hiệu năng list**: với danh sách phân trang (`toListItem` gọi cho mỗi row), `evaluate()` cần permission-check + context build — kiểm tra chi phí thực tế (permission check thường đã cache theo user qua `EffectivePermissionService`, context build chỉ đọc field có sẵn trên record, không query thêm DB) — nếu đo được chậm thật với trang 50-100 dòng, cân nhắc tính 1 lần `hasPermission(user, "documents.controlled_copy.request")` cho cả trang rồi chỉ AND với điều kiện trạng thái per-row (không cần gọi lại `evaluate()` đầy đủ cho mỗi row nếu phần actor-scope của `REQUEST_COPY` không phụ thuộc từng document cụ thể — xác nhận lại logic `evaluate()` cho action này trước khi tối ưu, không tối ưu sớm nếu chưa đo được chậm).
- [ ] **FE — 5 màn hình entry-point**: thay lời gọi `canRequestControlledCopyFromDocument(doc)` / `canRequestControlledCopyFromDocumentDetail(document, latestEffectiveRevision)` / `canRequestControlledCopyFromRevision(revision)` bằng đọc thẳng field `document.canRequestControlledCopy` / `revision.canRequestControlledCopy` / `doc.canRequestControlledCopy` từ response BE. Cụ thể:
      - `DetailDocumentView.tsx:551-552` (`canUploadRevision`/`canRequestControlledCopy` computed từ hàm status-only) → đọc `document.canRequestControlledCopy`.
      - `DocumentsView.tsx:381` (`canRequestControlledCopyForRow`) → đọc `doc.canRequestControlledCopy` (đã có sẵn trong `DocumentListItem`, chỉ thêm field).
      - `RevisionListView.tsx` (dùng trong `getMenuActions`, hiện chưa thấy check nào cho Request Controlled Copy trong 2 file Revision — xác nhận lại khi code: `RevisionListView.tsx` gọi `handlePrintControlledCopy` không qua bất kỳ điều kiện quyền nào ở nhánh `isEffective` dòng ~740, và `RevisionsOwnedByMeView.tsx` tương tự ở dòng ~580 — **đây là 1 phát hiện bổ sung**: 2 màn hình Revision hiện **còn tệ hơn** 3 màn hình kia, vì thậm chí không lọc theo status ở dropdown, chỉ lọc `isEffective` — cần bổ sung điều kiện `revision.canRequestControlledCopy` vào cả 2 nhánh dropdown và `getMenuActions`).
      - `DetailRevisionView.tsx:708-709` (`canRequestControlledCopy` từ `canRequestControlledCopyFromRevision(currentRevision)`) → đọc `currentRevision.canRequestControlledCopy`.
      - Giữ nguyên toàn bộ logic điều hướng (`buildControlledCopyRequestStateFrom...`) — chỉ đổi điều kiện gate hiển thị/thao tác, không đổi luồng khi đã cho phép.
- [ ] **FE — `RequestControlledCopyView.tsx`**: đã đọc `requestContext?.canRequest` (dòng 454, 738 dùng cho banner cảnh báo `requestBlocked`) — **không cần sửa gì ở FE cho phần này**, vì field `canRequest` giờ tự động phản ánh đúng permission sau khi BE (mục đầu) sửa xong. Chỉ cần xác nhận thông báo hiển thị khi `requestBlocked` đúng là message do BE trả (đã đúng, dòng 803).
- [ ] **Không xoá `canRequestControlledCopyFromDocument/Revision/DocumentDetail`/`isActiveDocumentMaster` khỏi `controlledCopyRequest.ts` ngay** — các hàm này vẫn có thể dùng làm điều kiện phụ (ví dụ: ẩn hẳn nút thay vì hiện nút disabled khi trạng thái tài liệu sai, trước khi response BE kịp trả về lúc đang loading) — chỉ không còn là **nguồn quyết định chính**; cân nhắc đổi tên hoặc thêm JSDoc ghi rõ "chỉ dùng cho UX tạm thời lúc loading, không phải authorization gate" để tránh người sau hiểu nhầm.
- [ ] **Tiêu chí hoàn thành:**
      1. Tạo user test **không có** `documents.controlled_copy.request` → mở 1 tài liệu Active có Effective revision ở cả 5 màn hình → nút/menu "Request Controlled Copy" **không hiện** ở bất kỳ màn hình nào trong 5 màn hình.
      2. Gán permission đó cho user → reload → nút hiện ở đủ cả 5 màn hình, thao tác được tới cuối (submit thành công).
      3. Dùng user không có quyền, gọi thẳng `GET /controlled-copies/request-context?documentId=...` bằng API client (bỏ qua FE) → xác nhận `canRequest: false` (không phải chỉ dựa vào trạng thái tài liệu).
      4. Gọi thẳng `POST /controlled-copies/request` bằng user không có quyền (bỏ qua FE) → vẫn nhận lỗi 403 với đúng `reasonCode=MISSING_PERMISSION` — xác nhận lớp 3 không bị yếu đi khi sửa lớp 1/2.
      5. User có quyền nhưng tài liệu chưa Active/chưa có Effective revision → nút vẫn **không hiện** (xác nhận điều kiện trạng thái vẫn được `evaluate()` tôn trọng, không phải chỉ permission là đủ).
      6. Riêng `RevisionListView.tsx`/`RevisionsOwnedByMeView.tsx`: xác nhận sau khi sửa, user không có quyền không còn thấy "Request Controlled Copy" trong dropdown menu dù revision đang Effective.
- [ ] **Độc lập với Task 0.2** (Approve/Reject Controlled Copy request) — 0.2 là quyết định nghiệp vụ riêng (có tách vai trò duyệt hay không), 0.6 là vá lỗ hổng kỹ thuật thuần tuý (đúng kiểu Task 0.1), không cần chờ nhau, có thể làm ngay.

---

## Phase 1 — Gộp UI Workflow Authorization + State Policies → Lifecycle Policies — ✅ ĐÃ HOÀN THÀNH

**Kết quả (bản đầu):** thư mục đổi tên `workflow-authorization/` → `lifecycle-policies/`; `LifecyclePolicyFormView.tsx` (dùng `?kind=`) thay cho 2 file form cũ (`WorkflowPolicyFormView`/`StatePolicyFormView` — đã xoá, logic gộp vào 1). Route constant `ROUTES.SECURITY.WORKFLOW_AUTHORIZATION` giữ nguyên là gốc `/security/lifecycle-policies`.

**⚠️ Điều chỉnh sau khi dùng thật (theo yêu cầu user):** bản đầu gộp 2 màn hình Transitions/Capabilities vào 1 trang qua segmented-control pill (`LifecyclePoliciesView.tsx`, tab giữ trong `?tab=`) — sau khi xem UI thật, user yêu cầu đổi thành **2 mục menu con riêng ở sidebar** (`Lifecycle Policies > Transitions` / `Lifecycle Policies > Capabilities`) thay vì 2 tab trong 1 trang. Đã đổi:
- `LifecyclePoliciesView.tsx` (wrapper pill) đã **xoá hẳn** — không còn cần thiết vì sidebar đảm nhiệm việc chuyển màn hình.
- `WorkflowAuthorizationView.tsx`/`StatePoliciesView.tsx` giờ render trực tiếp ở 2 route riêng: `/security/lifecycle-policies/transitions` và `/security/lifecycle-policies/capabilities` (hằng số mới `ROUTES.SECURITY.LIFECYCLE_POLICIES_TRANSITIONS`/`LIFECYCLE_POLICIES_CAPABILITIES` — **không** đổi giá trị `WORKFLOW_AUTHORIZATION` gốc, vì hằng số đó đang bị 6 chỗ khác nối chuỗi `${WORKFLOW_AUTHORIZATION}/roles`, `/state-policies`, `/new`, `/:id/edit`... coi là gốc `lifecycle-policies` — đổi giá trị gốc sẽ phá toàn bộ 6 chỗ đó, đã phát hiện và tránh kịp trước khi build).
- `navigation.ts`: mục "Lifecycle Policies" đổi từ leaf thành parent có 2 con "Transitions"/"Capabilities", theo đúng pattern nested-children đã dùng ở "Document Control > Document Revisions".
- Title/breadcrumb nội bộ 2 view đổi thành "Transitions"/"Capabilities" (trước là "Workflow Authorization"/"State Policies") cho khớp tên sidebar mới.
- Route cũ (bare `/lifecycle-policies`, `/lifecycle-policies/state-policies` index, `/workflow-authorization/*`) vẫn redirect đúng sang 2 route mới — không vỡ link cũ.
- Build sạch, grep xác nhận không còn tham chiếu `?tab=` cũ.

**Đã dọn tiếp:** xoá nút "State Policies" khỏi toolbar nội bộ của `WorkflowAuthorizationView.tsx` (dư thừa với mục sidebar "Capabilities" mới — 2 cách khác nhau để tới cùng 1 nơi). Giữ lại "Workflow Roles" (Effective Lookup không có mục sidebar tương ứng, vẫn cần thiết). Xoá theo import `Layers` icon không còn dùng. Build sạch.

**Đã dọn tiếp lần 2 — ép thứ tự chọn ở form "New Policy":** phát hiện `actionOptions` (dropdown Action) dedupe theo `action.value` mà không loại trừ workflow — nếu 2 workflow khác nhau tình cờ có action trùng code, chọn Action trước khi chọn Workflow có rủi ro thật lấy nhầm bản ghi action của workflow khác (`.find()` chỉ lấy bản ghi đầu tiên khớp). Đã sửa: disable 2 ô **Object Type** và **Action** cho tới khi chọn **Workflow**, kèm chú thích hướng dẫn — đúng pattern **From Status** đã tự disable cho tới khi chọn Action từ trước. Module/Workflow độc lập nhau, không cần khoá.

**Đã dọn tiếp lần 3 — breadcrumb màn hình con:** các màn hình sâu hơn (New/Edit Policy, Duplicate Policy, Workflow Roles) trước đó breadcrumb nhảy thẳng từ "Lifecycle Policies" xuống tên màn hình, bỏ qua cấp "Transitions"/"Capabilities" — gây khó hiểu đang ở nhánh nào. Thêm helper `lifecyclePoliciesSubPage(navigate, tab, leafLabel)` trong `breadcrumbs/settings.ts`, cho breadcrumb 4 cấp: `Security & Authorization > Lifecycle Policies > Transitions|Capabilities (bấm được) > {leaf, active}`. 2 trang gốc (Transitions/Capabilities) giữ nguyên breadcrumb 3 cấp cũ.


Thuần FE, không đổi DB/logic BE, rủi ro thấp nhất trong các việc tái cấu trúc.

- [ ] Đổi tên thư mục: `eqms/src/features/security-authorization/workflow-authorization/` → `lifecycle-policies/`.
- [ ] Tạo `lifecycle-policies/views/LifecyclePoliciesView.tsx`:
      - Copy nguyên state + JSX của `WorkflowAuthorizationView.tsx` (tab "Transitions") và `StatePoliciesView.tsx` (tab "Capabilities") vào 2 nhánh render riêng trong cùng 1 component.
      - Thêm segmented control 2 nút pill (tái dùng style đã có ở `DualPanel`/`accessProfileDetailShared.tsx`) ngay dưới `PageHeader` để chuyển tab, giữ state tab hiện tại trong URL query (`?tab=transitions|capabilities`) để giữ được khi refresh/chia sẻ link.
      - Không sửa logic filter/sort/pagination của 2 view gốc — chỉ bọc lại UI ngoài.
- [ ] Gộp form: `LifecyclePolicyFormView.tsx` từ `WorkflowPolicyFormView.tsx` + `StatePolicyFormView.tsx`, dùng param `?kind=transition|capability` để quyết định field hiển thị (Transition: Workflow/Action/FromStatus/Actors; Capability: Capability/ActorScope) — phần chung (Priority/Active/Description/Change Reason) giữ 1 bản duy nhất.
- [ ] **⚠️ Bổ sung sau audit — đã grep thật, danh sách chính xác nơi cần sửa trước khi đổi route** (`grep -rn "ROUTES.SECURITY.WORKFLOW_AUTHORIZATION" eqms/src`), ngoài bản thân thư mục:
      - `app/routes.constants.ts:177` — định nghĩa hằng số `WORKFLOW_AUTHORIZATION: '/security/workflow-authorization'` → đổi giá trị thành `/security/lifecycle-policies` (giữ nguyên tên hằng số `WORKFLOW_AUTHORIZATION` để không phải sửa mọi nơi tham chiếu, chỉ đổi giá trị đường dẫn).
      - `app/navigation.ts:418` — mục sidebar, `path: ROUTES.SECURITY.WORKFLOW_AUTHORIZATION` — tự động trỏ đúng sau khi đổi hằng số ở trên, không cần sửa thêm.
      - `components/ui/breadcrumb/breadcrumbs/settings.ts:262` — breadcrumb "Workflow Authorization" gọi `navigate?.(ROUTES.SECURITY.WORKFLOW_AUTHORIZATION)` — tự động đúng theo hằng số, chỉ cần đổi label hiển thị thành "Lifecycle Policies" cho khớp UI mới.
      - `features/settings/permissionCatalog.ts:891-892` — chỉ là **chuỗi khoá tra cứu** (`"SECURITY.WORKFLOW_AUTHORIZATION.VIEW"`), không phải route path — **không cần sửa**, giữ nguyên.
      - Vì hằng số `ROUTES.SECURITY.WORKFLOW_AUTHORIZATION` được dùng xuyên suốt (không hardcode string path lẻ tẻ ở nơi khác theo kết quả grep), chỉ cần đổi **giá trị** của hằng số này là đủ, không cần sửa từng file tiêu thụ — rủi ro thấp hơn dự kiến ban đầu.
- [ ] Cập nhật `SecurityRoutes.tsx`: đăng ký route mới `/security/lifecycle-policies`; thêm redirect từ route cũ `/security/workflow-authorization` sang route mới để không vỡ link cũ (nếu có bookmark/link chia sẻ trước đó) — redirect này là lớp bảo hiểm bổ sung, không thay thế việc đổi hằng số ở trên.
- [ ] Cập nhật `index.ts` (barrel export) và sidebar/menu: gộp 2 mục "Workflow Authorization"/"State Policies" thành 1 mục "Lifecycle Policies" trong nhóm "VÒNG ĐỜI & QUY TRÌNH".
- [ ] Di chuyển nguyên vẹn (chỉ sửa import path, không sửa logic): `WorkflowRolesView.tsx`, `WorkflowPolicyDuplicateView.tsx`, `WorkflowPolicyActorSelector.tsx`, `WorkflowPolicyDiffModal.tsx`, `WorkflowPolicyEffectiveLookup.tsx`.
- [ ] **Tiêu chí hoàn thành:** `npm run build` sạch; click-through thủ công cả 2 tab (tạo mới, sửa, xoá 1 policy mỗi loại) để xác nhận không mất filter/hành vi nào so với trước khi gộp; xác nhận breadcrumb "Lifecycle Policies" điều hướng đúng route mới.

## Phase 2 — Chuyển Permission Explorer sang `shared/` — ✅ ĐÃ HOÀN THÀNH

**Kết quả:** 5 file di chuyển sang `security-authorization/shared/explorer/`. Chỉ 2 nơi tiêu thụ thật (`permission-sets/PermissionSetDetailView.tsx`, `PermissionSetFormView.tsx`) — không có consumer nào trong `access-profiles/**` như dự đoán ban đầu (Access Profile Permission Sets tab đi qua 2 view trên, đã tự động đúng). Build sạch, grep xác nhận 0 tham chiếu đường dẫn cũ còn sót.


- [ ] Di chuyển `access-profiles/components/explorer/` (`PermissionExplorer.tsx`, `PermissionModuleAccordion.tsx`, `PermissionResourceGroup.tsx`, `PermissionActionRow.tsx`, `PermissionToolbar.tsx`) → `security-authorization/shared/explorer/`.
- [ ] Cập nhật import ở mọi nơi dùng (`access-profiles/**`, `permission-sets/**`) — chạy `grep -rn "from.*components/explorer" eqms/src` để tìm hết trước khi sửa, tránh sót.
- [ ] Không đổi logic bên trong các file này — chỉ đổi vị trí + import path.
- [ ] **Tiêu chí hoàn thành:** `npm run build` sạch; mở cả 2 nơi dùng (Permission Set form, Access Profile Permission Sets tab nếu có dùng chung) để xác nhận UI không đổi.

## Phase 3 — EffectiveAccessPanel (chỉ đọc) — ✅ ĐÃ HOÀN THÀNH

**Kết quả:** `GET /security/access-profiles/{id}/effective-access?documentTypeId=` (`AccessEffectiveService`) gọi đủ cả 3 evaluator (`WorkflowActionPolicyService`, `LifecycleStatePolicyEvaluator`/repository, `ObjectAccessEvaluationService`) — không tái tạo lại nghiệp vụ, chỉ orchestrate. 4 mã lý do deny giữ đúng (`MISSING_PERMISSION`/`ACTOR_SCOPE_NOT_SATISFIED`/`OBJECT_ACCESS_DENIED`/`NO_MATCHING_POLICY`, verify lại đúng tên hằng số đã dùng trong code). Khi thiếu `documentTypeId` hoặc không có user cụ thể để chạy Object Access Rule, response tự đánh dấu `objectAccessRulesApplicable=false` — không bao giờ báo "Allowed" ngầm định tuyệt đối. FE: nút "View Effective Access" (icon Eye) bên trái nút Edit ở `AccessProfileDetailView.tsx`, mở `FormModal` chứa `EffectiveAccessPanel.tsx` — 100% chỉ đọc, có tìm kiếm + gom nhóm.

**Sai lệch so với đặc tả gốc (có chủ đích, đã giải trình):** không tái dùng thẳng `PermissionModuleAccordion` như plan đề xuất — component đó gắn cứng với `Checkbox` có thể tick (dùng cho Permission Set editor), sửa nó để thêm chế độ chỉ-đọc sẽ tạo rủi ro hồi quy cho màn hình đang chạy thật. Đã tự viết 1 accordion nhỏ độc lập bên trong `EffectiveAccessPanel.tsx`, sao chép đúng ngôn ngữ hình ảnh (header collapse, badge đếm, ô tìm kiếm) thay vì import trực tiếp — quyết định hợp lý, ưu tiên an toàn hơn đúng-y-chang-đặc-tả.

**Verify:** `./mvnw clean compile` + `AccessEffectiveServiceTest` (6/6, bao gồm ca bắt buộc Object Access Rule DENY ghi đè "Allowed") + regression evaluator liên quan — pass. `npm run build` sạch (tự chạy lại xác nhận độc lập). **Chưa verify được golden-parity trên DB thật/seed** (không có môi trường live) — chỉ verify qua test mock + trace tay đối chiếu vài dòng Phụ lục A — cần click-through thật trên staging trước khi coi tính năng này đáng tin cậy 100% cho production.


### 3.1 Backend

- [ ] API mới: `GET /security/access-profiles/{id}/effective-access?documentTypeId=`.
- [ ] Service mới `AccessEffectiveService` (hoặc method mới trong `AccessProfileService` nếu gọn hơn): với mỗi permission trong các Permission Set đã gán + Workflow Role đã gán của Access Profile, chạy qua đúng `WorkflowActionPolicyService`/`LifecycleStatePolicyEvaluator`/**`ObjectAccessEvaluationService`** hiện có để resolve Allow/Deny theo từng trạng thái liên quan trong Phụ lục A — **tái dùng evaluator hiện tại, không viết lại luật**.
      - **⚠️ Sửa sau audit:** bản trước quên đưa `ObjectAccessEvaluationService` vào — nếu chỉ gọi 2 evaluator kia, panel không bao giờ đánh giá Object Access Rule (thu hẹp phạm vi theo document type/category/status), và `reasonCode = OBJECT_ACCESS_DENIED` sẽ là nhánh chết, không bao giờ trả về dù đã khai báo trong hợp đồng API. Phải gọi đủ cả 3 evaluator để kết quả "Allowed" hiển thị cho admin là đáng tin cậy.
      - Lưu ý khi ghép 3 evaluator: `ObjectAccessEvaluationService` hiện nhận tham số `DocumentRevisionRecord` cụ thể (không phải abstract permission/policy) — ở panel này chưa có 1 revision cụ thể để truyền vào (đang đánh giá cho cả Access Profile, không phải 1 record). Cần 1 trong 2 cách: (a) truyền `documentTypeId` (đã có ở query param) + status giả định làm điều kiện đánh giá Object Access Rule (rule match theo category/type/status, không cần instance cụ thể) — bỏ qua phần đánh giá cần instance thật (participant), hoặc (b) nếu `documentTypeId` không được truyền, coi Object Access Rule là "không áp dụng" (không chặn) và ghi rõ trong response rằng kết quả này *có thể* bị Object Access Rule chặn thêm khi áp dụng cho tài liệu cụ thể — không được ngầm định "Allowed" tuyệt đối.
- [ ] Response trả về `reasonCode` khi Deny — dùng đúng 4 mã đã thống nhất: `MISSING_PERMISSION`, `ACTOR_SCOPE_NOT_SATISFIED`, `OBJECT_ACCESS_DENIED`, `NO_MATCHING_POLICY`.
- [ ] Test golden-parity bắt buộc: so sánh kết quả API này với kết quả gọi trực tiếp evaluator hiện tại cho ít nhất 3 Access Profile thật (1 vai trò rộng như QA Manager, 1 vai trò hẹp như Reviewer-only, 1 vai trò custom mới tạo) — phải khớp 100%, **bao gồm cả trường hợp có Object Access Rule đang chặn** (thêm 1 Access Profile test có Object Access Rule DENY áp dụng, xác nhận panel phản ánh đúng, không báo "Allowed" sai).

### 3.2 Frontend

- [ ] File mới: `access-profiles/views/EffectiveAccessPanel.tsx`.
- [ ] Thêm nút "View Effective Access" (icon `Eye`, lucide-react) vào `PageHeader.actions` của `AccessProfileDetailView.tsx`, đặt bên trái nút Edit. Mở `FormModal` (size `xl`, `showCancel=false`, `confirmText="Close"`) chứa panel này.
- [ ] Bên trong panel: tái dùng `PermissionModuleAccordion` (đã có sẵn collapse/scroll/search từ đợt tối ưu trước) để nhóm theo module; mỗi dòng hành động dùng component mới nhỏ `EffectiveActionRow` (label + Badge Allowed/Not allowed + lý do nếu bị chặn, dùng `Badge` component có sẵn, màu semantic — emerald cho Allowed, slate cho Not allowed — không phải màu accent của module).
- [ ] Ô tìm kiếm trong panel: lọc theo tên hành động, tái dùng input pattern đã có ở `PermissionModuleAccordion`.
- [ ] Không có checkbox, không có nút Save — 100% chỉ đọc.
- [ ] **Tiêu chí hoàn thành:** `npm run build` sạch; mở panel cho 1 Access Profile thật, đối chiếu thủ công với bảng Phụ lục A cho vài dòng để xác nhận kết quả hiển thị đúng.

## Phase 4 — Dọn dẹp & rà soát mở rộng (không bắt buộc ngay, làm khi có thời gian)

- [ ] Áp dụng đúng khuôn permission (`{module}.{object}.{verb}`) + tái dùng `WorkflowActionPolicyService`/`LifecycleStatePolicyEvaluator`/`GET /security/eligible-users` (0.5b) khi bắt đầu code các module còn thiếu (`capa`, `deviations`, `change-control`, `complaints`, `equipment`, `risk-management`, `supplier`) — không thiết kế lại cách phân quyền, không tự viết lại endpoint picker cho từng module mới.
- [ ] Cân nhắc gộp vật lý `workflow_action_policies` + `lifecycle_state_policies` thành 1 bảng `lifecycle_policies` (`policy_kind` column) — **không bắt buộc**, chỉ làm nếu áp lực bảo trì 2 bảng thực sự đáng kể.

---

## Việc KHÔNG làm trong kế hoạch này (nhắc lại để tránh scope creep)

- Không xây Access Request workflow (xin-duyệt quyền) — để dành cho kế hoạch riêng nếu được duyệt sau.
- Không xây SoD preventive-enforcement — để dành cho kế hoạch riêng.
- Không xây Access Review risk-based targeting — để dành cho kế hoạch riêng.
- Không xây Access Trail hợp nhất theo user — để dành cho kế hoạch riêng.
- Không xây bảng `screen_registry`/override theo màn hình-button — đã loại bỏ khỏi thiết kế.
- Không xây thêm 1 UI "tick chọn" mới nào cho phân quyền — Permission Explorer đã là UI tick chọn duy nhất và đủ dùng (xem giải thích đầu tài liệu).

## Thứ tự khuyến nghị

**Phase -1 → Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4.**

- **Phase -1 là điều kiện tiên quyết nếu sắp code bất kỳ module nào ngoài Documents** (CAPA/Deviations/Change Control/Complaints/Equipment/Risk Management/Supplier) hoặc mở rộng Training sang review nội dung khoá học — nên làm **trước** khi viết dòng code đầu tiên của module đó, vì đây là lúc rẻ nhất để đổi (chưa có module thứ 2 nào dựa vào bảng participant cũ). Nếu chưa có kế hoạch code module mới trong thời gian gần, có thể tạm hoãn Phase -1 và làm Phase 0 trước — nhưng phải quay lại làm Phase -1 **trước khi**, không phải sau khi, bắt đầu module tiếp theo.
- Phase 0 xử lý lỗ hổng thật ở Documents, độc lập với Phase -1, có thể làm song song hoặc trước/sau tuỳ nguồn lực (trong đó 0.2 cần chờ xác nhận nghiệp vụ trước khi code, có thể làm song song 0.1/0.3/0.4/0.5a/0.5b trong lúc chờ).
- 0.5a và 0.5b giờ **độc lập với nhau** (0.5b lọc theo permission, không còn cần catalog Workflow Role của 0.5a) — có thể làm riêng lẻ theo độ ưu tiên, không cần làm cùng lúc. Cả 2 cũng độc lập kỹ thuật với Phase -1 (generic hoá participant), chỉ cùng chủ đề "nền tảng cho module tương lai".
- **0.5a rủi ro cao hơn ước tính ban đầu** sau khi mở rộng gộp thêm `WorkflowPoolTypes`/`document_workflow_pool_members` (không chỉ đổi `WorkflowRoleCode` như bản đầu) — phần này đụng vào cơ chế bypass DCO đang chạy production (`canViewAllDocuments`). Áp dụng cùng kỷ luật flag + rollback như Phase -1 (feature flag riêng, staging trước, regression test tự động cho `canViewAllDocuments` trước khi xoá `document_workflow_pool_members`), không nên coi là "chỉ đổi tên biến" đơn giản.
- Phase 1–2 thuần sắp xếp lại code, không rủi ro logic, làm bất kỳ lúc nào. Phase 3 là tính năng mới nhưng chỉ đọc. Phase 4 là dọn dẹp dài hạn, không gấp.
