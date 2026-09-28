# Hướng Dẫn Security & Authorization và UAT Module Documents

> **Đối tượng:** System Administrator, QA Manager, DCO và QA/UAT Tester.  
> **Phạm vi mã nguồn đã đối chiếu:** `eqms/src/features/security-authorization`, `eqms/src/features/documents`, `eqms-backend/src/main/java/com/eqms`, migration Flyway và test backend.  
> **Nguyên tắc:** Backend/API là điểm quyết định cuối cùng. Một nút có thể hiện ở UI nhưng server vẫn từ chối nếu thiếu permission, sai trạng thái, sai participant, sai object scope hoặc vi phạm SoD.

---

## 1. Mục đích và phạm vi

Tài liệu này hướng dẫn:

1. Quản trị Security & Authorization bằng giao diện hiện có.
2. Tạo role, permission set và user test tối thiểu cho Documents.
3. Kiểm tra toàn bộ luồng Document Master, Document Revision và Controlled Copies.
4. Ghi nhận các điều kiện GMP cần kiểm tra trước khi đưa vào UAT/production.

Ba lifecycle dưới đây **độc lập**; không dùng trạng thái của đối tượng này để suy ra trạng thái của đối tượng khác.

| Đối tượng | Trạng thái chính đã xác minh |
|---|---|
| Document Master | `Draft`, `Active`, `Obsoleted`, `Closed - Cancelled` |
| Document Revision | `Draft`, `Pending Review`, `Pending Approval`, `Pending Training`, `Ready for Publishing`, `Effective`, `Obsoleted`, `Closed - Cancelled` |
| Controlled Copy / Controlled Copy Batch | `Ready for Distribution`, `Distributed`, `Obsoleted`, `Closed - Cancelled` |

## 2. Bản đồ màn hình Security & Authorization

Chọn tab **Quality** trong sidebar, rồi mở **Security & Authorization**.

| Menu | Route | Mục đích | Người dùng phù hợp | Advanced |
|---|---|---|---|---|
| User Management | `/settings/users` | Tạo, kích hoạt, khoá và gán Access Profile cho user | System/Security Administrator | Không |
| Roles & Permissions | `/security/access-profiles` | Tạo và quản lý Access Profile (role) | Security Administrator | Không |
| Workflow Security | `/security/lifecycle-policies` | Quan sát/cấu hình action theo trạng thái | DCO, QA Manager, Security Administrator | Không |
| Access Review | `/security/access-review` | Tạo và xử lý chiến dịch review quyền | Security/Compliance Administrator | Không |
| Advanced > Shared Permission Sets | `/security/permission-sets` | Tạo bộ quyền tái sử dụng | Security Administrator | Có |
| Advanced > Workflow Role Catalog | `/security/advanced/workflow-roles` | Catalog vai trò workflow có thể gán cho Access Profile | Security Administrator | Có |
| Advanced > Object Access Rules | `/security/object-rules` | Điều kiện ABAC/scope cho object | Security Administrator | Có |
| Advanced > Segregation of Duties | `/security/sod` | Ràng buộc xung đột nhiệm vụ | QA Manager, Security Administrator | Có |

### 2.1 Liên kết giữa các màn hình

`Permission Set` chứa các permission. `Access Profile` gắn một hoặc nhiều Permission Set, có thể gắn Workflow Role, scope Business Unit/Department và user. `Lifecycle Policies` quy định action chỉ hợp lệ ở trạng thái nào và actor nào được thực hiện. `Object Access Rules` và SoD có thể tiếp tục chặn action dù user đã có role.

## 3. Khái niệm cần hiểu trước khi cấu hình

| Khái niệm | Ý nghĩa thực tế |
|---|---|
| Permission | Một quyền kỹ thuật, ví dụ `documents.revision.complete_authoring`. |
| Shared Permission Set | Bộ permission dùng lại cho nhiều Access Profile. |
| Access Profile / Role | Role quản trị được gán cho user; quyền hiệu lực là tổng permission từ các set/profile đang active. |
| Workflow Role | Catalog vai trò để dùng trong policy hoặc đủ điều kiện được chọn làm participant; không tự cấp permission. |
| Workflow Policy | Một action + trạng thái nguồn + required permission + actor được phép + priority. |
| Actor scope | Điều kiện actor như `AUTHOR`, `DCO`, `ASSIGNED_REVIEWER`, `ASSIGNED_APPROVER`, `OWNER`, `DOCUMENT_VIEWER`. |
| Object Access Rule | Hạn chế/cho phép theo resource, scope, department hoặc thuộc tính object. |
| SoD | Chặn kết hợp nhiệm vụ xung đột, ví dụ reviewer và approver của cùng hồ sơ. |
| Effective Access | Kết quả server tính từ role, permission, workflow role và policy; chỉ để kiểm tra, không phải nơi cấp quyền. |

**Quy tắc vận hành:**

```text
User active
AND Access Profile active có permission
AND action được policy cho phép tại trạng thái hiện tại
AND user đúng participant/actor scope
AND object access cho phép
AND không vi phạm SoD
AND hoàn tất e-signature khi endpoint yêu cầu
=> server cho phép thực hiện action.
```

## 4. Hướng dẫn sử dụng từng màn hình

### 4.1 User Management

**Truy cập:** `Security & Authorization > User Management`.

#### Tạo user

1. Đăng nhập bằng user có `settings.user.manage`.
2. Bấm **Add User** ở góc phải trang **User Management**.
3. Trên trang **Add User**, nhập các trường bắt buộc: **Employee ID** (4 chữ số theo validation UI), **Full Name**, **Username**, **Email**, **Business Unit**, **Department** và các trường bắt buộc khác UI hiển thị dấu `*`.
4. Chọn **Business Unit** trước. Dropdown **Department** và **Position** phụ thuộc Business Unit/Department đã chọn.
5. Không dùng Employee ID, Username hoặc Email đã tồn tại; UI kiểm tra trùng và backend cũng phải kiểm tra lại.
6. Chọn role/profile nếu form hiện trường này; sau khi tạo có thể vào profile user để gán thêm tại tab **Security & Authorization**.
7. Bấm **Save**. Hoàn tất modal e-signature nếu hệ thống yêu cầu.
8. Kết quả mong đợi: user xuất hiện trong danh sách với trạng thái active/pending theo cấu hình server.

#### Gán Access Profile cho user đã có

1. Trong bảng **User Management**, search theo Employee ID/Username/Email.
2. Mở profile user.
3. Chọn tab **Security & Authorization**.
4. Bấm control gán role/profile đang hiển thị trên tab; chọn đúng Access Profile và lưu.
5. Mở lại tab để xác nhận profile xuất hiện; sau đó kiểm tra role ở **Roles & Permissions > [Role] > Assigned Users**.

**Kết quả mong đợi:** hai màn hình phải phản ánh cùng một quan hệ user-role. Nếu một bên không cập nhật, dừng UAT và ghi nhận lỗi đồng bộ.

#### Vòng đời user

Trong trang profile có các action **Reset Password**, **Suspend**, **Terminate**, **Reinstate** và **Force Logout** khi trạng thái/quyền phù hợp. Mỗi action cần nhập lý do nếu modal yêu cầu. Không terminate tài khoản đang dùng cho UAT nếu chưa có tài khoản thay thế.

### 4.2 Roles & Permissions (Access Profiles)

**Truy cập:** `Security & Authorization > Roles & Permissions`.

#### 4.2.1 Chọn đúng luồng tạo role

Từ trang list, nút **New** mở hai cách tạo:

| Cách tạo | Khi nên dùng | Khi không nên dùng |
|---|---|---|
| **Role (Wizard)** | Tạo role mới chuẩn, cần gắn Permission Set, Workflow Role, scope và user theo một trình tự có review | Sửa nhanh một role đã có hoặc cần thiết lập policy chuyên sâu |
| **Access Profile** | Cần cấu hình từng tab chi tiết, cần kiểm tra từng thay đổi trước Save | Người mới chưa hiểu Permission/Workflow Role; ưu tiên Wizard |

Role là **Access Profile** trong dữ liệu backend. Tên menu “Roles & Permissions” là tên thân thiện; không tạo thêm một bản ghi Role độc lập ngoài Access Profile.

#### 4.2.2 Luồng A - Tạo role chuẩn bằng Wizard

**Mục tiêu ví dụ:** tạo `UAT Document Reviewer - QA`.

1. Truy cập **Security & Authorization > Roles & Permissions**.
2. Kiểm tra bằng Search rằng role cùng tên chưa tồn tại. Đây là bước tránh tạo hai role cùng chức năng khiến audit/effective access khó truy vết.
3. Bấm **New**, chọn **Role (Wizard)**. Màn hình tiêu đề **New Role** xuất hiện với 6 step.
4. Step **Basic Info**:
   - Nhập **Role Name**: `UAT Document Reviewer - QA`.
   - Nhập **Description**: `UAT only. May review or reject only revisions where the user is assigned as Reviewer.`
   - Giải thích: tên phải cho biết môi trường, nghiệp vụ và scope. Không đặt tên chung chung như `QA` hoặc `Test Role`.
   - Bấm **Next**. Nếu tên rỗng/trùng, UI không cho đi tiếp hoặc server từ chối lúc Create.
5. Step **Permissions**:
   - Chọn **Use existing Permission Sets** nếu Shared Permission Set đã được review; đây là lựa chọn khuyến nghị.
   - Search `PS_UAT_DOCUMENT_REVIEWER`, tick đúng set đó.
   - Giải thích: Permission Set quyết định user *có quyền kỹ thuật để gọi action*; nó chưa đủ để cho Review nếu user chưa được chỉ định trên revision.
   - Chỉ dùng **Pick individual permissions** khi role không thể dùng lại. Nếu chọn mode này, chọn module ở panel trái, tick action tại panel giữa, kiểm tra panel phải; Wizard sẽ tạo set `<Role Name> Permissions`.
6. Step **Workflow Role**:
   - Chọn catalog `Document Reviewer` nếu catalog có entry này.
   - Giải thích: Workflow Role làm holder đủ điều kiện xuất hiện khi DCO bấm **Reviewers** để chọn participant; nó không thay thế permission `documents.revision.review`.
   - Không chọn `Document Approver`, DCO hay role không liên quan.
7. Step **Scope**:
   - Chọn **Business Unit Scope** = `Quality` và **Department Scope** = `Quality Assurance` khi muốn test giới hạn QA.
   - Giải thích: scope giới hạn phạm vi role; không tự động thay thế Object Access Rule nhưng là đầu vào quan trọng cho kiểm soát quyền.
   - Không chọn All Business Units/All Departments cho role test department isolation.
8. Step **Users**:
   - Nếu user chưa tồn tại, không chọn user; bấm **Next**.
   - Nếu user đã tồn tại, search username, tick người cần gán, và chỉ tick user đã được QA phê duyệt role.
9. Step **Review & Create**:
   - So sánh 4 thông tin: Name, Permission Set, Workflow Role, Scope.
   - Xác nhận danh sách user trống hoặc đúng người được phê duyệt.
   - Bấm **Create Role**.
   - Khi modal electronic signature xuất hiện, nhập credential/reason đúng quy trình. Không để người khác ký thay.
10. Expected result: quay về role detail/list, role active, Permission Set count/Workflow Role count đúng. Mở tab **Audit Trail** để lưu evidence create.

Lặp cùng luồng cho DCO, Author, Approver, Viewer và Recipient nhưng thay Permission Set, Workflow Role và Scope theo bảng UAT tại Mục 6.

#### 4.2.3 Luồng B - Tạo Access Profile theo từng tab

Luồng này phù hợp khi Security Administrator cần kiểm soát từng thành phần. Khi tạo mới bằng **Access Profile**, hệ thống chỉ hiển thị tab **General** trước; các tab gán liên kết xuất hiện sau khi profile được lưu lần đầu vì cần Access Profile ID.

1. Trong **Roles & Permissions**, bấm **New** và chọn **Access Profile**.
2. Trang **New Role** mở ở tab **General**. Nhập Name/Description theo quy ước, kiểm tra trạng thái Active theo form.
3. Bấm **Save**. Hoàn tất e-signature nếu modal yêu cầu. Expected result: role được tạo nhưng chưa có Permission Set/user; không dùng role này cho UAT trước khi cấu hình tiếp.
4. Bấm **Edit** trên role vừa tạo. Khi ở chế độ Edit, các thay đổi từ nhiều tab được gom lại; Save cuối cùng yêu cầu một electronic signature cho cả đợt thay đổi.
5. Tab **Permissions**:
   - Chỉ dùng để cấp permission trực tiếp khi thật sự cần.
   - Mở Permission Explorer; chọn module, search action, tick quyền và kiểm tra vùng selected.
   - Giải thích: permission cấp trực tiếp khó tái sử dụng và khó đánh giá impact hơn Shared Permission Set. Không dùng đồng thời direct permission và set có cùng quyền nếu không có lý do/record change control.
6. Tab **Permission Sets**:
   - Bấm control add/link Permission Set.
   - Search code set, chọn set, xác nhận xuất hiện trong danh sách local changes.
   - Giải thích: đây là cách khuyến nghị cho role chuẩn vì có thể review set độc lập và tái dùng.
7. Tab **Workflow Authorization**:
   - Chọn Workflow Role catalog thích hợp, ví dụ `DCO`, `Document Reviewer`, `Document Approver`.
   - Chỉ gán role workflow khi business role thực sự tham gia action/pool. Viewer không cần Workflow Role.
   - Không được suy ra: “đã có Workflow Role thì có permission”. Permission vẫn phải đến từ tab Permissions/Permission Sets.
8. Tab **Object Access**:
   - Xem scope/rule liên quan role. Chỉ chỉnh rule khi có quyền và approved configuration change.
   - Giải thích: Object Access có thể chặn record cụ thể ngay cả khi role có permission module.
9. Tab **Assigned Users**:
   - Search theo user, chọn user đã tạo, add/remove theo control trên tab.
   - Đối chiếu lại User Management > user > **Security & Authorization** sau Save.
   - Không gán Reviewer và Approver cho cùng user khi mục tiêu UAT cần chứng minh SoD.
10. Bấm **Save** một lần sau khi hoàn tất thay đổi các tab. Modal signature sẽ xác nhận toàn bộ delta.
11. Nếu có cảnh báo concurrent edit/configuration changed, chọn **Reload** để lấy bản mới nhất. Không dùng Save để ghi đè thay đổi của admin khác mà chưa review.

#### 4.2.4 Luồng C - Kiểm tra quyền trước khi gán user

1. Mở role ở view mode, chọn tab **Effective Access**.
2. Dùng **Search actions**; chọn filter `All`, `Allowed` hoặc `Not allowed`.
3. Mở nhóm `Document Revision`, `Document Master`, `Controlled Copy` để xem từng action.
4. Với mỗi action, đọc 4 phần: Action name, status, Required Permission và kết quả Allowed/Not allowed.
5. Expected result cho các role quan trọng:
   - Author có `COMPLETE_AUTHORING`; không có `SUBMIT_FOR_REVIEW`.
   - DCO có `SUBMIT_FOR_REVIEW`, `PUBLISH`, Controlled Copy lifecycle.
   - Reviewer/Approver có permission tương ứng nhưng runtime vẫn cần Assigned Reviewer/Assigned Approver.
   - Approver không có Controlled Copy distribute/recall/destroy.
6. Nếu note trên panel nói Object Access Rule chưa được evaluate vì chưa chọn document type/object thực, coi kết quả là preliminary; phải test lại trên record Documents thật.

#### 4.2.5 Luồng D - Sửa, Disable/Enable, Duplicate, Delete

| Action | Cách thao tác | Giải thích và expected result |
|---|---|---|
| Edit | Mở role > **Edit** > sửa tab phù hợp > **Save** > ký | Chỉ thay đổi role sau approved change control; audit ghi delta |
| Disable | Mở role > **Disable** > xác nhận/ký nếu yêu cầu | Role không nên cấp quyền hiệu lực mới; test lại token/session theo UAT |
| Enable | Mở role disabled > **Enable** > xác nhận/ký | Chỉ enable sau review; kiểm tra Effective Access và user assignment |
| Duplicate | Từ action menu của list, chọn **Duplicate** nếu UI/capability cho phép | Dùng tạo biến thể theo department; đổi Name/Description/Scope ngay, không giữ tên mơ hồ |
| Delete | Mở role > **Delete** hoặc action menu > **Delete** > ký | Chỉ delete nếu không có user/association chặn; ưu tiên Disable khi cần giữ lịch sử GMP |

**Lưu ý GMP:** System role/badge System có thể read-only hoặc không được delete. Nếu nút bị disabled, không sửa database trực tiếp; ghi change request hoặc dùng role custom thay thế.

#### Các tab cần dùng

| Tab | Mục đích | Cách dùng khi UAT |
|---|---|---|
| General | Tên, mô tả, trạng thái | Kiểm tra role active và tên dễ truy vết |
| Permissions | Permission Explorer cấp trực tiếp | Chỉ dùng khi cần role đặc biệt, hạn chế cấp lẻ tràn lan |
| Permission Sets | Gắn Shared Permission Set | Cách khuyến nghị cho role chuẩn |
| Workflow Authorization | Gắn Workflow Role | Chỉ gắn nếu role tham gia workflow |
| Effective Access | Kết quả runtime đánh giá | Dùng xác minh trước khi đăng nhập test |
| Object Access | Scope/rule liên quan | Kiểm tra hạn chế department/object |
| Assigned Users | User đang giữ role | Gán và đối chiếu User Management |
| Audit Trail | Lịch sử thay đổi role | Dùng làm bằng chứng UAT |

### 4.3 Role Setup Wizard

**Truy cập:** `Roles & Permissions > New > Role (Wizard)` hoặc route `/security/access-profiles/wizard`.

Wizard có 6 bước; không có dữ liệu nào được persist trước bước cuối.

1. **Basic Info:** nhập **Role Name** và **Description**. Không dùng tên trùng.
2. **Permissions:** chọn một trong hai mode.
   - **Use existing Permission Sets:** search và tick set có sẵn.
   - **Pick individual permissions:** dùng Permission Split Explorer; chọn module bên trái, chọn action ở giữa, kiểm tra danh sách đã chọn bên phải. Wizard sẽ tạo Permission Set mới có tên `<Role Name> Permissions`.
3. **Workflow Role:** tick role catalog nếu holder cần đủ điều kiện là participant. Bỏ qua với viewer-only role.
4. **Scope:** chọn **Business Unit Scope** và/hoặc **Department Scope** nếu cần giới hạn.
5. **Users:** search và chọn user cần được gán ngay.
6. **Review & Create:** kiểm tra lại toàn bộ. Bấm **Create Role**, ký điện tử khi modal xuất hiện.

**Kết quả mong đợi:** tạo Access Profile, các Permission Set/Workflow Role/scope/user liên quan trong một giao dịch. Nếu SoD hoặc validation lỗi, không được tồn tại role dang dở.

### 4.4 Shared Permission Sets

**Truy cập:** `Security & Authorization > Advanced > Shared Permission Sets`.

1. Bấm **New Permission Set**.
2. Nhập Name, Code, Description theo trường UI yêu cầu.
3. Dùng Permission Explorer để tick action đúng module `Document Control`.
4. Bấm **Save** và ký điện tử nếu được yêu cầu.
5. Mở detail permission set để kiểm tra permission đã chọn, rồi gắn set vào Access Profile.

Không sửa Shared Permission Set đang được nhiều role sử dụng trong giờ UAT mà không đánh giá impact; thay đổi set sẽ ảnh hưởng các role gắn set đó.

### 4.5 Workflow Security

**Truy cập:** `Security & Authorization > Workflow Security`.

#### Tab Matrix

Matrix là **màn hình quan sát**, không phải ma trận quyền chung của user. Chọn **Object Type**, search action. Mỗi dấu tick nghĩa là có policy active cho action ở trạng thái cột đó. Bấm tick để xem:

- Required Permission.
- Allowed Actors.
- Priority.
- Global hoặc document-type override.
- Active/System status.

`+doc-type` nghĩa là có policy override theo Document Type. Kết quả thật có thể vẫn bị Object Access Rule, participant check hoặc SoD chặn.

#### Tab Transitions

1. Chọn tab **Transitions**.
2. Dùng Search, Workflow, Action, From Status, Document Type, Active và Type để tìm policy.
3. Bấm **New Policy** để thêm policy nếu có quyền quản trị và change control đã được phê duyệt.
4. Chọn workflow, action, From Status, required permission và actor. Chỉ chọn actor type mà backend cho phép cho action đó.
5. Lưu và hoàn tất e-signature nếu yêu cầu.

#### Tab Capabilities

Tab này hiển thị State Policies/capability, dùng cho các hành vi như view/preview/download theo trạng thái. Không dùng tab này để thay thế policy chuyển trạng thái Review/Approve/Publish.

### 4.6 Workflow Role Catalog

**Truy cập:** `Security & Authorization > Advanced > Workflow Role Catalog`.

Workflow Role là catalog. Không tự tạo permission và không tự gán trực tiếp user. Để user có Workflow Role, gắn role catalog này vào Access Profile, rồi gán Access Profile cho user.

1. Bấm **New Role** nếu cần catalog mới.
2. Nhập code/label theo form.
3. Lưu theo validation/e-signature của màn hình.
4. Mở Access Profile cần dùng, tab **Workflow Authorization**, và gắn Workflow Role.

### 4.7 Object Access Rules

**Truy cập:** `Security & Authorization > Advanced > Object Access Rules`.

1. Dùng Search, Resource Type, Effect và các filter trên màn hình để tìm rule hiện có.
2. Bấm **New Rule**.
3. Chọn resource, effect, role/scope/điều kiện theo field form.
4. Lưu, ký nếu yêu cầu và kiểm tra rule xuất hiện trong bảng.
5. Test lại bằng user cùng department và user khác department.

Không tạo rule Allow rộng hơn rule Deny hoặc scope nghiệp vụ mà không kiểm tra priority/effect ở backend.

### 4.8 Segregation of Duties

**Truy cập:** `Security & Authorization > Advanced > Segregation of Duties`.

1. Tab **Constraint Rules**: xem constraint hệ thống/custom, Severity và Permission A/B.
2. Bấm **New Constraint** chỉ khi có change control được phê duyệt.
3. Chọn hai permission xung đột và severity (`BLOCK` chặn thao tác; các mức khác tùy dữ liệu cấu hình).
4. Tab **Document Workflow Rules**: chỉ xem quy tắc workflow document đã được server enforce.
5. Bấm **Scan Now** để quét Access Profile hiện có khi cần.

### 4.9 Access Review

**Truy cập:** `Security & Authorization > Access Review`.

1. Bấm **New** để mở form campaign.
2. Điền tên, phạm vi, reviewer, due date theo field form.
3. Lưu campaign; mở detail campaign để review từng assignment và quyết định certify/revoke theo UI.
4. Xuất bằng chứng hoặc kiểm tra audit trail sau khi hoàn tất.

## 5. Quyền Documents chuẩn để UAT

### 5.1 Baseline workflow đã xác minh

| Action | Trạng thái Revision | Actor bắt buộc | Permission |
|---|---|---|---|
| Complete Authoring | Draft | Author được chỉ định | `documents.revision.complete_authoring` |
| Submit for Review | Draft | DCO hoặc Document Admin | `documents.revision.submit_review` |
| Complete/Reject Review | Pending Review | Assigned Reviewer | `documents.revision.review` / `documents.revision.reject_review` |
| Complete/Reject Approval | Pending Approval | Assigned Approver | `documents.revision.approve` / `documents.revision.reject_approval` |
| Complete Training | Pending Training | DCO/Document Admin/Training Coordinator theo policy | `documents.revision.complete_training` |
| Publish | Ready for Publishing | DCO hoặc Document Admin | `documents.revision.publish` |

Author không được cấp actor cho `Submit for Review` trong Workflow Policy editor. Co-Author không thay thế Author cho Complete Authoring.

### 5.2 Controlled Copies chuẩn

| Hành động | Điều kiện/trạng thái | Actor |
|---|---|---|
| Request Copy | Document Master Active và Revision Effective | DCO hoặc Document Admin |
| Approve/Reject/Prepare/Distribute | Ready for Distribution | DCO hoặc Document Admin |
| Recall | Ready for Distribution hoặc Distributed | DCO hoặc Document Admin |
| Report lost/damaged | Distributed, policy cho phép | Recipient/Owner, DCO hoặc Document Admin |
| Upload evidence | Obsoleted | Recipient/Owner, DCO hoặc Document Admin |
| Expire | Ready for Distribution hoặc Distributed | DCO hoặc Document Admin |
| Destroy/Confirm destroy | Obsoleted | DCO hoặc Document Admin |
| View/Preview/Download | policy file + trạng thái + scope cho phép | Recipient/Owner, Document Viewer scoped, DCO hoặc Document Admin |

Document Approver không được có permission Controlled Copy distribution/recall/destroy.

## 6. Bộ tài khoản UAT đề xuất

> **Cập nhật (2026-07-18):** đã tạo sẵn trong DB thật qua migration `V220`/`V231`/`V232`, không cần tạo tay theo tên giả định nữa. Bảng dưới đây là **danh sách tài khoản thật đang tồn tại**, password chung `Test@12345` (cùng quy ước với các user test khác trong dự án — xem `V179__seed_document_lifecycle_test_roles_and_users.sql`).

| Username | Access Profile thật | Department | Không được có | Mục tiêu |
|---|---|---|---|---|
| `admin` | `SYSTEM_SUPER_ADMIN` + `AP_UAT_DOCUMENT_SECURITY_ADMIN` | Quality Assurance | Không dùng để chạy workflow nghiệp vụ | Cấu hình và kiểm tra audit |
| `user.a.test` | `AP_UAT_DCO_QUALITY` | Quality | Reviewer/Approver trên cùng revision UAT | Điều phối/submit/publish/controlled copy |
| `user.b.test` | `AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY` | Quality | Submit review, publish, distribute | Author: upload + complete authoring |
| `user.c.test` | `AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY` | Quality | Submit review, publish, distribute | Reviewer: review revision được assign |
| `user.d.test` | `AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY` | Quality | Submit review, publish, distribute | Co-Author: đồng soạn thảo |
| `user.e.test` | `AP_UAT_READER_QUALITY` | Quality | Mọi hành động workflow | Viewer: view/download scope Quality |
| `user.f.test` | `AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY` | Quality | Submit review, publish, distribute | Approver: approve revision được assign |
| `user.g.test` | `AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY` | Quality | (giống user.c) | Reviewer 2 — KHÔNG được assign ở đâu, dùng cho negative test "not my task" |
| `user.h.test` | `AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY` | Quality | (giống user.f) | Approver 2 — KHÔNG được assign ở đâu, dùng cho negative test "not my task" |
| `user.i.test` | `AP_UAT_READER_PRODUCTION` | Production | Xem tài liệu phòng Quality | Negative department-scope test |
| `user.j.test` | `AP_UAT_CC_RECIPIENT_QUALITY` | Quality | Distribute/recall/destroy | Preview/download/report evidence bản copy được cấp |

**Quan trọng — mô hình "Document Contributor" (thay thế các Permission Set hẹp cũ cho 6 tài khoản trên):** thay vì 4 permission set tách rời (chỉ-Author/chỉ-Co-Author/chỉ-Reviewer/chỉ-Approver — vẫn còn tồn tại trong DB nhưng không còn ai gán vào), `user.b/c/d/f/g/h.test` giờ đều dùng chung **`AP_UAT_DOCUMENT_CONTRIBUTOR_QUALITY`** → `PS_UAT_DOCUMENT_CONTRIBUTOR` (đủ quyền Complete Authoring + Review + Approve). Lý do: quyền rộng này không làm mất kiểm soát, vì **ranh giới thật sự theo từng tài liệu** vẫn là participant assignment DCO gán (`RevisionWorkflowParticipant`) — một user có quyền Approve nói chung vẫn không Approve được revision mà họ không được gán làm Approver (xem `RevisionService.requirePendingParticipant`). Mô hình rộng này còn loại bỏ rủi ro "Admin quên tick 1 permission hẹp khiến user không bao giờ được chọn làm vai trò đó ở bất kỳ đâu". `PS_UAT_DOCUMENT_DCO` (dành riêng cho DCO) vẫn tách biệt, giữ các hành động chỉ DCO mới được làm (create/edit metadata/cancel/obsolete/submit/publish/toàn bộ Controlled Copy lifecycle).

## 7. Thứ tự cấu hình và tạo bộ UAT

### 7.1 Tạo Role trước hay tạo User trước?

**Thứ tự khuyến nghị là: Permission Set -> Access Profile/Role -> User -> gán Access Profile cho User.**

Lý do: role và permission phải được review trước khi cấp cho người dùng; user vừa tạo có đúng least privilege ngay từ đầu; Effective Access và SoD được kiểm tra trên role trước khi role ảnh hưởng UAT. Wizard có Step **Users**, nhưng bước đó chỉ tiện khi user đã tồn tại. Với bộ UAT mới, để trống Step này và gán user sau khi tạo.

Không tạo user rồi gán tạm quyền admin/role rộng để test nhanh. Việc này làm sai negative test và không phù hợp least privilege.

| Thứ tự | Việc cần hoàn tất | Màn hình | Tiêu chí qua bước |
|---:|---|---|---|
| 1 | Business Unit, Department, Position active | Master data/Dictionaries | QA và Production có dữ liệu hợp lệ |
| 2 | Xác minh Permission Catalog Documents | Shared Permission Sets > New | Có đúng mã permission cần dùng |
| 3 | Tạo Shared Permission Set | Advanced > Shared Permission Sets | Set active, audit evidence có đủ |
| 4 | Tạo Workflow Role nếu cần | Advanced > Workflow Role Catalog | Catalog DCO/Reviewer/Approver sẵn sàng |
| 5 | Tạo Access Profile | Roles & Permissions > New > Role (Wizard) | Set, scope, workflow role đúng |
| 6 | Kiểm tra Effective Access | Role detail > Effective Access | Allowed/Not allowed đúng baseline |
| 7 | Tạo User | User Management > Add User | User có định danh duy nhất |
| 8 | Gán Access Profile | User detail > Security & Authorization | User có đúng một role UAT |
| 9 | Đăng nhập kiểm chứng | Login + Documents | UI/API chặn hoặc cho phép đúng |

### Bước 1 - Chuẩn bị master data

1. Đăng nhập bằng System Administrator.
2. Xác nhận Business Unit `Quality` và Department `Quality Assurance`, `Production` đang Active.
3. Xác nhận Position cần dùng: DCO, QA Specialist, QA Manager, Document Controller, Production Operator.
4. Nếu thiếu master data, tạo theo quy trình master data hiện hữu và hoàn tất e-signature/audit theo màn hình đó trước khi tạo user.

### Bước 2 - Xác minh Permission Catalog và tạo Shared Permission Set

> Phần này viết cho người **chưa từng dùng màn hình Shared Permission Sets**. Làm đúng tuần tự, không bỏ bước nào. Với mỗi permission set bên dưới, bạn sẽ: (1) mở màn hình, (2) bấm nút tạo mới, (3) gõ đúng từng mã quyền vào ô search của Permission Explorer, (4) tick đúng ô checkbox xuất hiện, (5) lặp lại cho từng mã trong danh sách, (6) lưu lại. Không tick thêm quyền nào ngoài danh sách được liệt kê cho set đó — nếu tick dư, role sẽ có nhiều quyền hơn kịch bản test cần, làm sai kết quả negative test.

1. Mở **Security & Authorization > Advanced > Shared Permission Sets**.
2. Bấm **New Permission Set** để mở Permission Explorer, chưa bấm Save.
3. Trong Explorer, chọn module **Document Control** (hoặc module tương ứng "Documents" nếu tên hiển thị khác). Đây là danh mục **đầy đủ** các mã quyền `documents.*` đã xác nhận tồn tại trong hệ thống (dùng để đối chiếu, không phải tất cả đều được dùng cho UAT):

   `documents.module.view`, `documents.document.view`, `documents.document.create`, `documents.document.edit_metadata`, `documents.document.manage_relations`, `documents.document.obsolete`, `documents.document.cancel`, `documents.document.view_audit`, `documents.document.preview_published`, `documents.document.download_published`, `documents.revision.create`, `documents.revision.upload_source`, `documents.revision.complete_authoring`, `documents.revision.edit_metadata`, `documents.revision.submit_review` (hoặc `documents.revision.submit`), `documents.revision.review`, `documents.revision.reject_review`, `documents.revision.approve`, `documents.revision.reject_approval`, `documents.revision.complete_training`, `documents.revision.publish`, `documents.revision.preview`, `documents.revision.download_source`, `documents.revision.cancel`, `documents.revision.obsolete`, `documents.revision.upgrade`, `documents.revision.edit_online`, `documents.revision.sync_office`, `documents.revision.generate_preview`, `documents.revision.open_publishing_workspace`, `documents.controlled_copy.request`, `documents.controlled_copy.approve_request`, `documents.controlled_copy.reject_request`, `documents.controlled_copy.cancel_request`, `documents.controlled_copy.prepare_distribution`, `documents.controlled_copy.distribute`, `documents.controlled_copy.recall`, `documents.controlled_copy.expire`, `documents.controlled_copy.destroy`, `documents.controlled_copy.confirm_destroy`, `documents.controlled_copy.replace_lost_damaged`, `documents.controlled_copy.report_lost_damaged`, `documents.controlled_copy.upload_evidence`, `documents.controlled_copy.view`, `documents.controlled_copy.view_file`, `documents.controlled_copy.download_file`, `documents.controlled_copy.view_evidence`, `documents.controlled_copy.download_evidence`, `documents.controlled_copy.print`, `documents.controlled_copy.generate`, `documents.training.manage`, `documents.training.complete`, `documents.admin.view`, `documents.admin.manage_workflow_roles`, `documents.admin.manage_sod_constraints`, `documents.office_online.edit`, `documents.office_online.upload`.

4. Nếu gõ một mã ở danh sách trên vào ô search mà Explorer không hiện kết quả nào, dừng lại và ghi defect (không tick nhầm quyền có tên gần giống); mã quyền phải khớp chính xác.
5. Bấm **Cancel** để đóng form nháp này (chỉ dùng bước 3-4 để xác minh catalog), sau đó tạo lần lượt từng Permission Set dưới đây bằng cách bấm lại **New Permission Set** cho mỗi set.

**a) `PS_UAT_DOCUMENT_AUTHOR`** — tick đúng các mã sau, không tick gì khác:
`documents.module.view`, `documents.document.view`, `documents.revision.upload_source`, `documents.revision.complete_authoring`, `documents.revision.preview`, `documents.revision.download_source`.
Không tick `documents.revision.submit_review`, `documents.revision.approve`, `documents.revision.publish` hay bất kỳ mã `documents.controlled_copy.*` nào — đây chính là điều kiện để chứng minh Author không submit/approve/publish/phân phối được.

**b) `PS_UAT_DOCUMENT_COAUTHOR`** — tick:
`documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.download_source`.
Không tick `documents.revision.upload_source` hay `documents.revision.complete_authoring` — Co-Author không phải người upload/complete authoring ban đầu.

**c) `PS_UAT_DOCUMENT_DCO`** — tick:
`documents.module.view`, `documents.document.view`, `documents.document.create`, `documents.document.edit_metadata`, `documents.document.manage_relations`, `documents.document.obsolete`, `documents.document.cancel`, `documents.document.view_audit`, `documents.revision.submit_review` (hoặc `documents.revision.submit` nếu đây là mã hiển thị trong Explorer), `documents.revision.complete_training`, `documents.revision.publish`, `documents.revision.preview`, `documents.revision.download_source`, `documents.revision.cancel`, `documents.revision.obsolete`, `documents.controlled_copy.request`, `documents.controlled_copy.approve_request`, `documents.controlled_copy.reject_request`, `documents.controlled_copy.cancel_request`, `documents.controlled_copy.prepare_distribution`, `documents.controlled_copy.distribute`, `documents.controlled_copy.recall`, `documents.controlled_copy.expire`, `documents.controlled_copy.destroy`, `documents.controlled_copy.confirm_destroy`, `documents.controlled_copy.replace_lost_damaged`, `documents.controlled_copy.view`, `documents.controlled_copy.view_file`, `documents.controlled_copy.download_file`, `documents.controlled_copy.view_evidence`, `documents.controlled_copy.download_evidence`.
Không tick `documents.revision.review`, `documents.revision.approve`, `documents.revision.complete_authoring` — DCO điều phối, không tự Review/Approve/soạn thảo.

**d) `PS_UAT_DOCUMENT_REVIEWER`** — tick:
`documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.download_source`, `documents.revision.review`, `documents.revision.reject_review`.
Không tick `documents.revision.approve`, `documents.revision.publish`, bất kỳ mã `documents.controlled_copy.*` nào.

**e) `PS_UAT_DOCUMENT_APPROVER`** — tick:
`documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.download_source`, `documents.revision.approve`, `documents.revision.reject_approval`.
Không tick `documents.revision.review`, `documents.revision.publish`, và **tuyệt đối không tick** bất kỳ mã `documents.controlled_copy.*` nào — đây là điều kiện bắt buộc để chứng minh Approver không phân phối được Controlled Copy.

**f) `PS_UAT_DOCUMENT_VIEWER_QA`** (dùng chung cho cả `doc.viewer.dept.a` và `doc.viewer.dept.b`, phân biệt bằng Scope ở Bước 3, không phải bằng permission) — tick:
`documents.module.view`, `documents.document.view`, `documents.document.preview_published`, `documents.document.download_published`.
Không tick bất kỳ mã workflow action (`submit_review`, `review`, `approve`, `publish`) hay `documents.controlled_copy.*` nào.

**g) `PS_UAT_CONTROLLED_COPY_RECIPIENT`** — tick:
`documents.module.view`, `documents.controlled_copy.view`, `documents.controlled_copy.view_file`, `documents.controlled_copy.download_file`, `documents.controlled_copy.report_lost_damaged`, `documents.controlled_copy.upload_evidence`, `documents.controlled_copy.view_evidence`, `documents.controlled_copy.download_evidence`.
Không tick `documents.controlled_copy.request`, `.distribute`, `.recall`, `.destroy`, `.approve_request` — Recipient chỉ xem/nhận/báo mất-hỏng, không điều phối.

6. Với mỗi set (a–g), sau khi tick đúng danh sách: cuộn xuống, nhập **Name** (ví dụ `PS_UAT_DOCUMENT_AUTHOR`), **Code** (hệ thống có thể tự sinh từ Name, kiểm tra lại đúng như tên set ở trên), **Description** ghi rõ "UAT only — used by <role> test account", bấm **Save**, hoàn tất e-signature nếu modal yêu cầu.
7. Sau khi Save, mở lại detail của set vừa tạo, vào tab **Permissions**, đếm số quyền hiển thị và đối chiếu đúng số lượng/đúng mã đã liệt kê ở trên. Nếu thiếu hoặc dư, bấm **Edit** để sửa ngay, không để sai lệch sang Bước 3.

### Bước 3 - Tạo Access Profile bằng Wizard

Lặp lại cho DCO, Author, Co-Author, Reviewer, Approver, Viewer QA, Viewer Production và Controlled Copy Recipient.

1. Mở **Roles & Permissions > New > Role (Wizard)**.
2. Step **Basic Info**: nhập Role Name, ví dụ `UAT Document Author - QA`, và Description nêu rõ phạm vi.
3. Bấm **Next**.
4. Step **Permissions**: chọn **Use existing Permission Sets**; search theo code và tick đúng một Shared Permission Set tương ứng.
5. Step **Workflow Role**:
   - DCO chọn catalog `DCO` nếu có.
   - Reviewer chọn `Document Reviewer` nếu có.
   - Approver chọn `Document Approver` nếu có.
   - Author/Co-Author/Viewer/Recipient bỏ qua trừ khi catalog/runtime yêu cầu rõ ràng.
6. Step **Scope**: QA role chọn `Quality` và `Quality Assurance`; Viewer Production chọn `Production`. Không chọn All scope nếu mục tiêu là test department isolation.
7. Step **Users**: để trống, vì user chưa được tạo.
8. Step **Review & Create**: đối chiếu Name, Set, Workflow Role, Scope. Bấm **Create Role** và ký điện tử khi modal xuất hiện.

### Bước 4 - Xác minh role trước khi tạo user

1. Tại list **Roles & Permissions**, search từng role `UAT` và mở detail.
2. Tab **Permission Sets**: kiểm tra code set đúng.
3. Tab **Workflow Authorization**: chỉ DCO/Reviewer/Approver có workflow role tương ứng.
4. Tab **Effective Access**, search action và kiểm tra:
   - Author: `COMPLETE_AUTHORING` Allowed; `SUBMIT_FOR_REVIEW` Not allowed.
   - DCO: `SUBMIT_FOR_REVIEW` và `PUBLISH` Allowed.
   - Reviewer/Approver: action participant chỉ effective khi họ được gán trên revision.
   - Approver: Controlled Copy distribution Not allowed.
5. Nếu một kết quả sai, sửa Permission Set/Role trước khi tạo user. Không bù bằng role admin.

### Bước 5 - Tạo user rồi gán Access Profile

1. Mở **User Management > Add User**.
2. Nhập Employee ID theo bảng. Nếu UI báo trùng, dừng; dùng định danh UAT mới, không tái sử dụng account cũ không rõ role.
3. Nhập Full Name, kiểm tra Username tự sinh rồi chỉnh thành username trong bảng nếu cần.
4. Nhập Email UAT hợp lệ và duy nhất.
5. Chọn Business Unit trước, sau đó chọn Department, rồi chọn Position.
6. Bấm **Save**; hoàn tất e-signature nếu modal xuất hiện.
7. Mở user vừa tạo > tab **Security & Authorization** > control **Assign/Add Access Profile**; search và chọn đúng role UAT; lưu.
8. Không gán nhiều role cho một user trừ kịch bản có văn bản. Đặc biệt không gán Reviewer và Approver cho cùng user nếu test SoD BLOCK.
9. Mở lại role > tab **Assigned Users** để xác nhận assignment hai chiều.

### Bước 6 - Kiểm tra trước khi workflow

1. Mở **Advanced > Object Access Rules** để xác nhận scope department không cấp nhầm Viewer Production quyền xem document QA.
2. Mở **Advanced > Segregation of Duties** và bấm **Scan Now** nếu có quyền/được phép trong UAT.
3. Đăng xuất/đăng nhập từng user trước test UI, để token/permission cache được làm mới.
4. Lưu screenshot Effective Access, Assigned Users và kết quả scan SoD vào evidence UAT.

## 8. Checklist UAT Documents end-to-end

### 8.1 Document Master và Revision đầu tiên

1. **DCO:** vào `Document Control > All Documents`, bấm **New Document**.
2. **DCO:** tab **General Information**, chọn Business Unit/Department QA, Document Name, Document Type, Periodic Review Cycle, Notification Days, Language, Description và Author = `author.test`; thêm `coauthor.test` nếu test co-author.
3. **DCO:** tab **Training Information**, bật/tắt Requires Training theo case test. Nếu bật, nhập Training Period; nếu tắt, nhập reason nếu UI yêu cầu.
4. **DCO:** bấm **Next Step**, trong modal **Save & Proceed to Next Step?** bấm **Save & Next**.
5. **DCO:** sau khi record tồn tại, bấm **Select Related Document**, **Select Correlated Document** nếu test; chọn **Reviewers** và thêm reviewer1/reviewer2; chọn **Approvers** và thêm approver1/approver2; bấm **Save**.
6. **Author:** mở document được chỉ định qua **Documents Owned By Me** hoặc **All Documents**, action menu > **Edit Document**; bấm **Upload Revision**, chọn file/template và xác nhận.
7. **Author:** mở Revision Draft, thực hiện **Complete Authoring** và e-signature nếu modal xuất hiện.
8. **Negative:** Author thử **Submit for Review**. Expected result: button không available hoặc API bị server từ chối.
9. **DCO:** mở revision Draft, bấm **Submit for Review**, hoàn tất chữ ký nếu yêu cầu. Expected Revision status: `Pending Review`.
10. **Reviewer 1/2:** mở revision được gán, bấm **Complete Review** hoặc **Reject Review**, ký điện tử nếu yêu cầu. Khi reject, ghi reason trong field/modal yêu cầu.
11. **DCO:** nếu reject, xử lý theo action UI được server cho phép; sau khi return về Draft, Author cập nhật file và Complete Authoring lại, DCO submit lại.
12. **Approver 1/2:** tại `Pending Approval`, bấm **Complete Approval** hoặc **Reject Approval**; không dùng cùng account reviewer nếu SoD đang BLOCK.
13. **DCO:** nếu Requires Training, hoàn thành action training theo policy. Nếu không cần training, expected status đi thẳng `Ready for Publishing`.
14. **DCO:** bấm **Publish** tại `Ready for Publishing`. Expected Revision: `Effective`; Document Master: `Active`.

Sau mỗi action: kiểm tra status banner, tab **Signatures**, tab **Audit Trail**, actor/time/reason và record không bị mất General/Training Information sau khi reload.

### 8.2 Test view/download theo scope

1. Đăng nhập `doc.viewer.dept.a`, tìm document QA Effective. Expected: có thể xem theo role/rule hiện hành.
2. Test Preview/Download. Expected: chỉ cho phép nếu permission và policy download của record cho phép.
3. Đăng nhập `doc.viewer.dept.b`, thử mở cùng document. Expected: denied/không hiển thị nếu Object Access Rule và department scope đã cấu hình chặn.
4. Ghi nhận cả UI behavior và HTTP response/API error nếu browser dev tools/UAT evidence có thể thu thập.

### 8.3 Controlled Copies

1. **DCO:** mở Document Active có Revision Effective; đi đến Controlled Copies hoặc action Request Controlled Copy của document/revision theo UI.
2. **DCO:** tạo request/batch, chọn recipient `cc.recipient.test`, cấu hình preview/download policy nếu form có các field đó, lưu và ký.
3. Expected: Controlled Copy/Batch vào `Ready for Distribution`.
4. **DCO:** thực hiện **Approve Request**, **Prepare Distribution** (nếu button xuất hiện), rồi **Distribute Copy** hoặc **Distribute Batch**. Expected: `Distributed`.
5. **Recipient:** mở controlled copy được nhận. Test **View**, **Preview File**, **Download File**. Expected: phụ thuộc allow portal view/allow download, trạng thái Distributed và chưa expired.
6. **Recipient:** thực hiện **Report Lost/Damaged** nếu policy cho phép; upload evidence tại trạng thái UI cho phép.
7. **DCO:** test **Recall**, **Replace Lost/Damaged**, **Expire**, **Destroy** và **Confirm Destroy** theo trạng thái được UI/server cho phép.
8. **Approver:** đăng nhập `approver1.test`, thử distribute/recall/destroy. Expected: button không available hoặc server `403`; không có quyền Controlled Copy lifecycle.

## 9. Ma trận quyền UAT kỳ vọng

| Account | Create/Edit master | Upload revision | Complete authoring | Submit review | Review | Approve | Publish | View/download document | CC distribute/recall/destroy | CC report/evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| System Admin | Có, chỉ cấu hình | Không dùng UAT nghiệp vụ | Không dùng | Không dùng | Không dùng | Không dùng | Không dùng | Có | Không dùng | Không dùng |
| DCO | Có | Theo policy role | Không phải Author | Có | Không nếu không được gán | Không nếu không được gán | Có | Có | Có | Có |
| Author | Theo permission | Có, revision được chỉ định | Có | **Không** | Không | Không | Không | Có khi scope cho phép | Không | Không |
| Co-Author | Theo permission | Không phải upload ban đầu | Không | Không | Không | Không | Không | Có khi scope cho phép | Không | Không |
| Assigned Reviewer | Không | Không | Không | Không | Có, chỉ revision được gán | Không | Không | Có khi scope/participant cho phép | Không | Không |
| Assigned Approver | Không | Không | Không | Không | Không | Có, chỉ revision được gán | Không | Có khi scope/participant cho phép | **Không** | Không |
| Viewer QA | Không | Không | Không | Không | Không | Không | Không | Có theo department/policy | Không | Không |
| Viewer Production | Không | Không | Không | Không | Không | Không | Không | Không với document QA | Không | Không |
| CC Recipient | Không | Không | Không | Không | Không | Không | Không | Chỉ copy được cấp + policy | Không | Có điều kiện |

## 10. Checklist GMP/UAT bắt buộc

- [ ] User test active, có Employee ID/username/email duy nhất.
- [ ] Role UAT dùng least privilege, không dùng role admin để chạy workflow.
- [ ] Author không submit review.
- [ ] DCO/Document Admin submit review.
- [ ] Reviewer/Approver chỉ action khi được chỉ định cho revision.
- [ ] SoD test reviewer không approve cùng revision nếu constraint BLOCK.
- [ ] Mọi action có e-signature được kiểm tra bằng modal/record Signature thực tế.
- [ ] Audit Trail có actor, timestamp, action và reason/e-signature metadata khi implementation lưu.
- [ ] Document Master, Revision, Controlled Copy status được chụp bằng chứng riêng.
- [ ] Document Approver không distribute/recall/destroy Controlled Copy.
- [ ] Controlled Copy chỉ dùng 4 lifecycle status chính.
- [ ] User khác department bị chặn theo Object Access Rules/scope cấu hình.

## 11. Điểm cần xác nhận trong môi trường UAT

| Điểm | Bằng chứng code | Cách xác nhận | Rủi ro |
|---|---|---|---|
| E-signature áp dụng cho từng endpoint nào | UI gọi `useSecurityESign`; endpoint/service riêng kiểm soát runtime | Thực hiện từng action UAT và kiểm tra modal + Signature/Audit Trail | Cao |
| Download document phổ thông | Quyền và Object Access cùng tác động; Controlled Copy còn có policy download riêng | Test Viewer A/B, bật/tắt policy download và kiểm tra API | Cao |
| Rule ưu tiên giữa Object Access Rule custom | Cấu hình ở database/policy engine, phụ thuộc dữ liệu triển khai | Tạo case Allow/Deny có kiểm soát trong UAT sandbox | Cao |
| Workflow Role cần cho danh sách Reviewer/Approver cụ thể | Wizard mô tả role catalog làm user eligible; endpoint chọn participant phải kiểm tra thêm | Thử chọn từng user trong modal Reviewers/Approvers | Trung bình |
| Controlled Copy external/public portal | Có điều kiện token và policy riêng | Chỉ test bằng approved UAT protocol, không dùng dữ liệu production | Cao |

## 12. Nguồn đối chiếu chính

- Frontend routes/navigation: `eqms/src/app/routes/SecurityRoutes.tsx`, `eqms/src/app/navigation.ts`.
- Wizard: `eqms/src/features/security-authorization/access-profiles/views/RoleSetupWizardView.tsx`.
- Matrix: `eqms/src/features/security-authorization/lifecycle-policies/components/ActionStatusMatrix.tsx`.
- Workflow default: `eqms-backend/src/main/java/com/eqms/service/WorkflowActionDefaultPolicyRegistry.java`.
- Controlled Copy authorization: `eqms-backend/src/main/java/com/eqms/service/ControlledCopyAuthorizationService.java`.
- Workflow metadata: `eqms-backend/src/main/java/com/eqms/service/workflow/DocumentsWorkflowDefinitionProvider.java`.
- Controlled Copy authorization repair: `eqms-backend/src/main/resources/db/migration/V228__repair_controlled_copy_authorization_contract.sql`.
