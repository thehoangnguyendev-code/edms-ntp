# Kế hoạch hoàn thiện Security & Authorization cho mọi module (2026-11-20)

Trạng thái: **ĐỀ XUẤT, chờ chủ hệ thống duyệt. Chưa có thay đổi mã nào từ bản kế hoạch này.**
Nhãn bằng chứng: [mã] = đọc trong mã; [DB] = đo trên DB DEV 2026-11-20; [ước tính] = đếm tự động, cần kiểm tay; [tài liệu] = lấy từ `docs/AUTHORIZATION_*`.
Bản này bổ sung, không thay: `AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15.md` (lộ trình A–F), `AUTHORIZATION_MODULE_INVENTORY.md` (phân loại), `AUTHORIZATION_PARTICIPANT_SOD_CATALOG.md`, `AUTHORIZATION_LEGACY_DEPENDENCY_REGISTER.md`, và kế hoạch 2026-11-19 (Object Rule và luật loại trừ nhiều module).

## 1. Mục tiêu
1. **Một mô hình cho mọi module**: quyền (profile) VÀ quan hệ với bản ghi VÀ phạm vi VÀ trạng thái VÀ (chữ ký/lý do). Quản trị viên chỉ cần học một cách nhìn, dùng cho Document, Training, Reports và các module sau.
2. **Không có chỗ nào trên giao diện hứa nhiều hơn mã làm** (ví dụ phạm vi trên Access Profile hiện chỉ Document tuân theo).
3. **Mọi thao tác ghi đều qua một cổng kiểm tra** hoặc nằm trong danh sách ngoại lệ có lý do, và có bài kiểm tra tự động giữ điều đó.
4. **Bớt thừa và bớt trùng** để người dùng không bị loạn (một nơi cho một ý).

## 2. Hiện trạng theo từng module

Đếm tự động trên controller và các service nó gọi [ước tính]:

| Module | Controller | Route ghi | Gọi kiểm tra quyền phẳng | Gọi engine | Chữ ký | Audit |
|---|---|---|---|---|---|---|
| Training Management | 31 | 126 | 29 | **87** | 141 | 74 |
| Document Control | 24 | 122 | **299** | 32 | 206 | 195 |
| Application Settings | 22 | 54 | 242 | 2 | 162 | 164 |
| Users & Auth | 4 | 54 | 53 | 1 | 46 | 98 |
| Reports | 10 | 41 | 41 | 32 | 79 | 61 |
| Security & Authorization | 16 | 40 | 161 | 20 | 239 | 66 |
| Backup & Restore | 10 | 21 | 126 | **0** | 101 | 56 |
| Audit Trail | 2 | 4 | 24 | 14 | 12 | 9 |

Mô hình chính sách trong DB [DB]: Training 86 policy (13 object type), Document Control 47 (5), Reports 17 (4), Security Review 6 (2). Backup, Application Settings, System Admin, Dashboard, Notifications, Preferences, Self-service: **0 policy** (17 + 23 + 7 + … permission của họ không policy nào dùng; phần lớn chỉ cần RBAC, xem 4.6).

Bảng theo chiều dọc: mỗi module đang dùng cơ chế nào cho từng việc.

| Việc | Document Control | Training | Reports | Backup & Restore | Settings / Users | Security Review |
|---|---|---|---|---|---|---|
| Ai được làm bước nào | Engine (Revision đã bỏ kiểm tra cũ); **Document, Controlled Copy, Copy Batch còn chạy bóng** [mã: ShadowGuard]; Uncontrolled Copy engine | Engine (20 loại trong `ENGINE_DECIDES`); **bước ký giữ kiểm tra cũ sau engine; Record export, Export batch, Trainer exception chỉ shadow/cờ** [tài liệu] | Engine cho schedule/run/artifact; **template review chưa nằm trong `ENGINE_DECIDES`** [mã] | Quyền phẳng; **quy tắc hai người do Backup Agent bên ngoài thi hành** [mã: BackupPolicyService] | Quyền phẳng + chữ ký | Engine |
| Người tham gia bản ghi | `revision_workflow_participants` (nguồn gốc) | `training_approval_assignments` (cơ chế riêng) | Người gửi/tác giả trong bản ghi template | — | — | Người tạo/Reviewer của campaign |
| Phạm vi | Phạm vi **Business Unit/Department trên Access Profile** + Object Rules | Phòng ban + `training.scope.all` + Object Rules (mới) | `report_template_role_scopes` (theo profile) + Object Rules (mới) | — | — | Object Rules (mới) |
| Tách trách nhiệm ("khác người") | 6 cờ cố định `DocumentWorkflowSetting` + quan hệ | `keptApart` trong mã + forbidden relation (đã nối công tắc) | Forbidden relation (Author, Submitter) | **Chỉ trong agent** | Chỉ 1 luật SoD `settings × report` | Forbidden relation (mới, tắt sẵn) |
| Giao diện nhận quyền từ backend (capability) | Có (26 file) | Một phần (11 file; chi tiết bản ghi) | Một phần (5 file) | Không | Gần như không (2 file) | Một phần |

## 3. Khoảng trống (xếp theo ảnh hưởng tới người dùng và tuân thủ)

| # | Khoảng trống | Bằng chứng | Hệ quả |
|---|---|---|---|
| G1 | **Phạm vi BU/Phòng ban của Access Profile chỉ Document tuân theo** | Chỉ `ObjectAccessEvaluationService` đọc `getBusinessUnitScope/DepartmentScope` [mã]; 11 profile đặt BU, 10 đặt phòng ban [DB] | Quản trị tưởng đã giới hạn Training/Reports nhưng không |
| G2 | **State Capabilities chỉ có Document** | 16/16 dòng là `documents` [DB] | Không có mô hình "xem/tải theo trạng thái" cho module khác |
| G3 | **3 loại Document chưa do engine quyết định** | `DOCUMENT`, `CONTROLLED_COPY`, `CONTROLLED_COPY_BATCH` ngoài `ENGINE_DECIDES`; Document Control 299 gọi phẳng / 32 engine [ước tính] | Hai nguồn sự thật (mã cũ và policy) cho phần lớn route của module chính |
| G4 | **Chưa có bằng chứng hai người thật** | Chỉ chạy một người trên DEV; bảng shadow chỉ ghi chênh lệch lý do và đã trống từ 2026-08-11 [tài liệu + DB] | Không đủ để cutover hay bỏ mã cũ |
| G5 | **Training: bước ký, Record export, Export batch, Trainer exception vẫn dùng kiểm tra cũ/cờ** | [tài liệu: inventory] | Training chưa hết mã cũ |
| G6 | **Reports: template review chưa do engine quyết định một mình**; phạm vi theo `report_template_role_scopes` là cơ chế riêng | [mã] | Một cơ chế phạm vi thứ ba |
| G7 | **Backup & Restore: luật hai người nằm ngoài hệ thống** | [mã] | Admin không thấy, không cấu hình, không kiểm toán được luật này trong Security |
| G8 | **Knowledge, Executed Record, Publishing chưa có adapter** | Không có trong danh sách adapter [mã]; kế hoạch D [tài liệu] | Phân quyền theo quan hệ (Head/Delegate…) viết cứng |
| G9 | **Ba cơ chế "người tham gia/duyệt" song song** | Participants của Revision; approval assignments của Training; submit/approve của Report | Cùng một ý, ba cách làm, ba nơi cấu hình |
| G10 | **Cấu hình/Settings/Users: chỉ RBAC + chữ ký, không có kiểm tra kiến trúc "mọi route đều có cổng"** | Không có bài test phủ route [tài liệu: hybrid plan 7.A.3]; 3 điểm quét tự động không thấy kiểm tra, đã kiểm tay: 2 là batch ủy quyền xuống `RevisionService` (đủ), 1 có `shadow.run` | Rủi ro âm thầm khi thêm route mới |
| G11 | **Danh mục quyền lộn xộn** | 15 khóa module cho 12 menu (report/reports, settings/app-settings, security/security-authorization) [DB]; 6 quyền không ai dùng (`settings.dictionary.*`, `documents.form.*` ×3, `training.audit.view`) [mã] | Nhóm quyền trên màn Access Profile gây rối |
| G12 | **Tài liệu phân loại lỗi thời** | Inventory còn dòng Work Management (không có mã tương ứng) và các module Deferred; chưa có dòng cho Knowledge/Publishing | Quy tắc "chưa Live thì không thêm quyền" không còn đáng tin |
| G13 | **Giao diện quản trị phân tán** | Một ý nằm ở nhiều màn (6 cờ Document + Separation Rules + forbidden trong form policy; `actors` + `relations`) | Người dùng loạn |
| G14 | **Chưa có màn "độ phủ"** | — | Không ai nhìn được module nào đã hoàn thiện đến đâu |

## 4. Thiết kế đích

### 4.1 Hợp đồng phân quyền của module (Module Authorization Contract)
Mỗi module khai báo **một nơi** (adapter + dòng catalog), và các màn quản trị đọc từ đó:

1. Đối tượng (object type) và **trạng thái**.
2. **Hành động** theo trạng thái (đã có: policy).
3. **Quan hệ** với bản ghi (tác giả, người được giao, người tạo…) và quan hệ nào **có thể bị cấm** ("khác người").
4. **Chiều phạm vi** (phòng ban, trạng thái, loại…) — dùng chung Object Rules.
5. **Ý nghĩa chữ ký** của từng hành động.
6. **Capability** cho giao diện (nút nào hiện/hợp lệ).

Đã có phần lớn nền (engine, policy, relation, Object Rules mới, Separation Rules mới). Việc còn lại là kéo từng module cho đủ 6 mục.

### 4.2 Một cơ chế phạm vi
Mục tiêu: **Object Access Rules là nguồn duy nhất** cho "ai thấy/làm trên bản ghi nào". Phạm vi trên Access Profile, phạm vi phòng ban của Training và `report_template_role_scopes` được chuyển dần thành Object Rule (có migration giữ nguyên hiệu lực) rồi bỏ cơ chế riêng. Trong lúc chuyển, giao diện nói rõ cơ chế nào áp dụng cho module nào.

### 4.3 Một cơ chế người tham gia
Dùng `workflow_participants` chung (đã có đường dual-write và reconcile cho Revision [tài liệu]) cho cả Training và Report thay cho cơ chế riêng; không đụng dữ liệu hiện có cho đến khi reconcile sạch.

### 4.4 Tách trách nhiệm
Mọi luật "khác người" là forbidden relation trên policy; công tắc ở tab Separation Rules của từng module. Sáu cờ Document chuyển thành forbidden relation trên policy của Revision (riêng "khác phòng ban" cần một quan hệ đặc biệt hoặc giữ như điều kiện).

### 4.5 Giao diện quản trị
- Bỏ `actors` khỏi form policy khi hết người đọc (xem WP3, WP2).
- Một màn **Module Coverage** (chỉ đọc): mỗi module một dòng, cho biết engine/phẳng/không áp dụng, số policy, luật tách trách nhiệm đang bật, Object Rules, độ phủ test, cờ cutover. Đây là cách người quản trị biết "module này đã hoàn thiện chưa".
- Mô tả cạnh mỗi cấu hình nói rõ phạm vi áp dụng (module nào).

### 4.6 Vùng không cần engine
Cấu hình đơn lẻ không vòng đời (Dictionaries, notification policy, branding, system configuration…), tự phục vụ (preferences, dashboard) và API nội bộ: **giữ RBAC + chữ ký + audit**, đúng quyết định cũ, nhưng phải qua **bài test phủ route** (WP0) để không có route trần.

## 5. Gói công việc

Mỗi gói là **một thay đổi có kiểm soát** (bản ghi theo mẫu `08_ONE_CHANGE_RECORD_TEMPLATE`, impact GitNexus, test phủ định, bằng chứng chạy thật). Thứ tự theo phụ thuộc.

| WP | Nội dung | Phụ thuộc | Cỡ | Rủi ro | Bằng chứng ra cổng |
|---|---|---|---|---|---|
| **WP0 Sự thật và công cụ** | (a) Test kiến trúc: mọi route ghi phải chạm cổng kiểm tra hoặc nằm trong danh sách ngoại lệ có lý do; (b) dọn danh mục quyền: gộp khóa module trùng (alias, không đổi mã), xoá hoặc gán 6 quyền không dùng; (c) cập nhật Inventory (Work Management, Knowledge/Publishing, phân loại hiện tại); (d) màn Module Coverage (chỉ đọc) | — | M | Thấp | Test xanh; danh sách ngoại lệ được duyệt |
| **WP1 Hết hứa suông** | (a) Access Profile: ghi rõ phạm vi BU/Phòng ban hiện chỉ áp dụng cho Document Control (cho đến WP7); (b) đổi tên/mô tả State Capabilities là của Document; (c) mô tả "áp dụng cho module…" trên mọi màn cấu hình | — | S | Rất thấp | Chụp màn hình, test FE |
| **WP2 Document Control cho trọn** | (a) Cutover `DOCUMENT`, `CONTROLLED_COPY`, `CONTROLLED_COPY_BATCH` sang engine (đưa vào `ENGINE_DECIDES`) **sau** WP10; (b) bỏ shadow (`ShadowGuard`, bảng shadow); (c) adapter cho Knowledge (Head/Delegate), Executed Record, Publishing; (d) 6 cờ → forbidden relation trên Revision; (e) bỏ 299 điểm gọi phẳng thừa theo từng cụm | WP0, WP10 | L | **Cao** (lõi quy trình có kiểm soát) | Ma trận API × trạng thái × quyền × quan hệ × phạm vi; hai người thật; canary |
| **WP3 Training cho trọn** | (a) Bước ký chuyển sang engine hoàn toàn; (b) Record export, Export batch, Trainer exception hết cờ; (c) bỏ `keptApart` viết cứng (đã nối công tắc); (d) mô hình trạng thái → capability cho danh sách; (e) người tham gia sang `workflow_participants` | WP0 | L | Trung bình | Như trên; chạy lại các ma trận V810–V816 |
| **WP4 Reports cho trọn** | (a) Template review vào `ENGINE_DECIDES`, bỏ cờ; (b) phạm vi theo template chuyển thành Object Rule; (c) capability cho danh sách/chi tiết | WP0, WP7 (b) | M | Trung bình | Ma trận V807; chạy hai người (tác giả ≠ người duyệt) |
| **WP5 Backup & Restore** | Hiển thị (chỉ đọc) quy tắc hai người của agent trong Security; chuẩn hoá `restore request` thành đối tượng có trạng thái và nhật ký trong hệ thống (hoặc ghi vào danh sách ngoại lệ có lý do); đưa SoD "đề xuất ≠ duyệt" vào Separation Rules nếu có state cục bộ | Quyết định D3 | M | Trung bình | Thử với agent thật |
| **WP6 Settings, Users, tự phục vụ** | Test phủ route (WP0) bắt buộc; luật tách trách nhiệm cho thay đổi cấu hình nhạy cảm (người đề xuất ≠ người duyệt) nếu chủ hệ thống muốn; ủy quyền có thời hạn (Delegate, D7) | WP0, quyết định D4 | M | Thấp–TB | Test + UAT |
| **WP7 Một cơ chế phạm vi** | Migration phạm vi Access Profile, phòng ban Training, role scope của Report → Object Rule với hiệu lực giữ nguyên; bỏ cơ chế cũ | WP2, WP3, WP4 | L | **Cao** | So sánh trước/sau trên dữ liệu thật |
| **WP8 Một cơ chế người tham gia** | `workflow_participants` cho Training và Report | WP3 | L | Trung bình–Cao | Reconcile sạch trong cửa sổ quan sát |
| **WP9 Dọn giao diện** | Bỏ `actors` khỏi form (khi hết người đọc), một mục "Ai được làm" cho mỗi policy; sáu cờ Document biến mất khỏi tab riêng (vào Separation Rules); mô tả ngắn gọn thống nhất | WP2, WP3 | M | Thấp | Chụp màn hình, UAT người dùng |
| **WP10 Kiểm chứng thật** | Persona UAT hai người cho mọi module Live; canary; bằng chứng khối lượng (ghi **mọi** quyết định so sánh trong cửa sổ quan sát chứ không chỉ chênh lệch lý do); ký duyệt QA/Compliance | song song với WP2–WP4 | M | — | Biên bản ký |

Thứ tự đề xuất: **WP0 → WP1 → (WP3 ∥ WP4 ∥ WP10 chuẩn bị) → WP2 → WP7 → WP8 → WP9**, WP5 và WP6 chen vào khi có quyết định.

## 6. Quyết định cần chủ hệ thống (mỗi mục kèm đề xuất mặc định)

1. **Nguồn phạm vi duy nhất là Object Rules** và dần bỏ phạm vi trên profile? *Đề xuất: có; trong lúc chờ, ghi nhãn (WP1).*
2. **Cutover Document/Controlled Copy/Copy Batch** khi nào, và cần bằng chứng gì? *Đề xuất: sau WP10, tối thiểu hai người thật + một cửa sổ quan sát với ghi mọi quyết định.*
3. **Backup & Restore**: đưa quy tắc hai người vào hệ thống (hiển thị + cấu hình + audit), hay giữ hoàn toàn ở agent? *Đề xuất: hiển thị chỉ đọc trước, chuẩn hoá sau.*
4. **Settings/cấu hình nhạy cảm**: có cần "đề xuất ≠ duyệt" cho thay đổi cấu hình bảo mật không (hiện chỉ có 1 luật SoD)? *Đề xuất: có cho cấu hình bảo mật và chữ ký; giữ đơn giản cho phần còn lại.*
5. **Ủy quyền có thời hạn (Delegate)**: duyệt hay không (đã chọn nguyên tắc 2026-11-18, D7).
6. **Người tham gia chung** cho Training và Report có làm không, hay chấp nhận ba cơ chế? *Đề xuất: làm sau WP3, vì giảm cấu hình và lỗi.*
7. **Module Coverage** có hiển thị cho mọi quản trị viên hay chỉ Security Admin?
8. **Module mới (CAPA, Change Control…)**: chốt rằng module mới phải nộp Module Authorization Contract (4.1) trước khi có màn hình, để không lặp lại tình trạng "Document làm trước, module sau chạy theo".

## 7. Rủi ro và cách giữ an toàn
- Mọi cutover giữ mã cũ chạy **sau** engine cho đến khi có bằng chứng; chỉ gỡ khi có chữ ký duyệt (Legacy Dependency Register).
- Mỗi gói có kịch bản hồi lại (cờ hoặc migration đảo).
- Không gộp thay đổi giao diện với thay đổi hành vi trong cùng một commit.
- Số "ảnh hưởng" của GitNexus bị thổi phồng bởi cạnh cấp class; quyết định dựa trên số nơi gọi trực tiếp, tìm tham chiếu trong mã/test và các test hồi quy.

## 8. Giới hạn của bản đánh giá này
- Số đếm theo controller là ước tính tự động, không thay cho Action Catalog đã duyệt.
- Chưa đọc hết mọi service của Knowledge, Executed Record, Publishing và Notifications; dòng của họ trong bảng 2 dựa vào danh sách adapter và kế hoạch D.
- Chưa chạy được hai người thật (chỉ một tài khoản test trên DEV tại thời điểm này).
