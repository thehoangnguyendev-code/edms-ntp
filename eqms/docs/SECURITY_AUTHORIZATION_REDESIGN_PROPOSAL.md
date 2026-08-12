# Đề Xuất Thiết Kế Lại Security & Authorization

**Phiên bản:** 1.0  
**Mục tiêu:** Đơn giản hóa trải nghiệm quản trị quyền cho người không chuyên kỹ thuật, trong khi vẫn giữ mô hình kiểm soát có thể kiểm toán cho eQMS.  
**Đối tượng phản biện:** Product Owner, QA, CSV/Validation, Security Admin, Gemini/AI reviewer.

---

## 1. Vấn đề cần giải quyết

Module hiện tại có nhiều menu riêng: Access Profiles, Permission Sets, Lifecycle Policies, Object Access Rules, Segregation of Duties và Access Review. Mô hình này linh hoạt nhưng tạo ra ba vấn đề UX:

1. **Admin phải hiểu cấu trúc kỹ thuật trước khi làm được việc nghiệp vụ.**
   - Muốn tạo một role như `QA Reviewer`, admin phải tự biết tạo Permission Set, tạo Access Profile, gắn Workflow Role, gán user, rồi kiểm tra Lifecycle Policy.
2. **Một thay đổi nghiệp vụ trải qua nhiều màn hình.**
   - Người dùng có thể tạo role nhưng quên gắn permission, quên workflow role hoặc quên scope dữ liệu.
3. **Khó giải thích nguyên nhân bị từ chối quyền.**
   - Một action có thể bị chặn bởi permission tĩnh, lifecycle state, participant assignment, department scope, SoD hoặc trạng thái account.

Mục tiêu không phải xóa các quy tắc này. Mục tiêu là **ẩn độ phức tạp kỹ thuật dưới một UI role-centric**, để phần lớn admin chỉ cần trả lời các câu hỏi nghiệp vụ.

```text
Ai cần làm việc gì?
Trên module nào?
Trong trạng thái nào?
Trên dữ liệu/phòng ban nào?
Có bị xung đột trách nhiệm không?
```

---

## 2. Nguyên tắc thiết kế

### 2.1. Role-first, không phải permission-first

Admin bắt đầu với một role nghiệp vụ, ví dụ `DCO`, `QA Reviewer`, `Maintenance Supervisor`. Hệ thống tự tạo/liên kết các thành phần kỹ thuật bên dưới.

### 2.2. Progressive disclosure

Màn hình mặc định chỉ hiển thị lựa chọn dễ hiểu. Các cấu hình phức tạp chỉ xuất hiện khi người dùng mở `Advanced Governance` hoặc khi hệ thống phát hiện ngoại lệ/rủi ro.

### 2.3. Safe by default

- Chỉ cấp quyền tối thiểu cần thiết.
- Action GMP nhạy cảm luôn bị backend kiểm soát và yêu cầu e-signature.
- Rule baseline không thể bị tắt từ UI thông thường.
- Thay đổi cấu hình phải hiển thị impact và yêu cầu lý do/ký điện tử.

### 2.4. Tách UX đơn giản và policy engine đầy đủ

UI có thể chỉ có hai menu, nhưng backend vẫn giữ các entity riêng để đảm bảo truy vết, versioning, khả năng mở rộng và đánh giá quyền chính xác.

### 2.5. Mọi quyết định phải giải thích được

Mỗi lần `Allow` hoặc `Deny`, backend có thể trả về các lý do theo thứ tự:

```text
Allowed because:
- Access Profile: QA Document Reviewer
- Permission Set: Document Reviewer
- Permission: documents.revision.review
- Workflow participant: assigned Reviewer
- Revision status: Pending Review
- Data scope: QA Department

Denied because:
- User is not assigned as an Approver for this revision.
```

---

## 3. Kiến trúc thông tin đề xuất

Sidebar dành cho người quản trị chỉ có hai mục chính:

```text
Security & Authorization
├── User Management
└── Role & Permission Matrix
```

### 3.1. User Management

Nơi admin tạo, kích hoạt/vô hiệu hóa user và gán role cho user.

### 3.2. Role & Permission Matrix

Nơi admin định nghĩa một role được làm gì, áp dụng ở đâu, trong workflow nào và bị kiểm soát bởi rủi ro nào.

### 3.3. Advanced Governance

Không phải menu sidebar cấp một. Đây là panel/drawer hoặc route con chỉ hiển thị cho `Security Administrator`.

```text
Role & Permission Matrix
├── Role Workspace
├── Templates
├── Role Simulator
└── Advanced Governance
    ├── Permission Set Library
    ├── Lifecycle Policy Library
    ├── Data Access Exceptions
    ├── SoD Constraints
    └── Access Reviews
```

Lý do giữ `Advanced Governance`: các cấu hình trên không nên bị xóa khỏi hệ thống vì cần audit, nhưng không nên làm phiền 90% thao tác hằng ngày.

---

## 4. Màn hình 1: User Management

## 4.1. Mục tiêu màn hình

Admin có thể trả lời nhanh: user này là ai, thuộc department nào, đang có role nào, role đó còn active không, và có rủi ro SoD nào không.

## 4.2. Cấu trúc màn hình danh sách user

### Header

```text
User Management                                      [Export] [New User]
```

### Bộ lọc

```text
[ Search name, employee ID, email ] [Department] [Status] [Role] [Risk] [Clear filters]
```

### Bảng chính

| User | Employee ID | Department | Account Status | Assigned Roles | Risk | Last Access Review | Action |
|---|---|---|---|---|---|---|---|
| Nguyen Van A | EMP-001 | QA | Active | QA Reviewer, SOP Reader | None | Confirmed Q3 2026 | ... |

### Quy tắc UX

- Role hiển thị dạng badge; tối đa ba badge và badge `+N` cho phần còn lại.
- Cột `Risk` có ba trạng thái: `None`, `Needs review`, `Blocked by SoD`.
- Click vào hàng mở User Profile; không mở modal quá sâu.
- Menu `...` chỉ chứa action có quyền thực hiện: View, Edit, Reset Password, Suspend, Terminate, Reinstate.

## 4.3. User Profile

User Profile có các tab:

```text
Profile | Roles & Access | Qualifications | Activity | Audit Trail
```

### Tab Roles & Access

Đây là thay đổi UX quan trọng: user không cần hiểu Permission Set trước.

```text
Assigned Roles                                      [+ Assign Role]

QA Document Reviewer                 Active
QA Department · Assigned 01 Jul 2026
Permissions: 12 actions · Workflow: Reviewer
[View access] [Remove]

SOP Reader                            Active
QA Department · Assigned 01 Jul 2026
Permissions: 4 actions · Workflow: None
[View access] [Remove]
```

### Luồng gán role cho user

1. Nhấn **Assign Role**.
2. Chọn một hoặc nhiều role active.
3. Hệ thống hiển thị preview:
   - Permission sẽ được thêm.
   - Workflow Role sẽ có hiệu lực.
   - Department/BU scope.
   - SoD conflict nếu có.
4. Nếu không có conflict, nhấn **Confirm Assignment**.
5. Nhập lý do thay đổi nếu yêu cầu và ký điện tử.
6. User nhận role; audit trail lưu old/new state, người thay đổi, thời gian, lý do và chữ ký.

### Hành vi khi có SoD conflict

```text
Cannot assign role "QA Approver"

Nguyen Van A already has role "Document Author".
This creates a prohibited conflict:
documents.revision.complete_editing ↔ documents.revision.approve

[View conflict details] [Cancel]
```

Không có nút “Ignore” ở thao tác thông thường. Nếu doanh nghiệp có quy trình exception, exception phải là luồng riêng với approver, thời hạn, lý do và audit trail.

---

## 5. Màn hình 2: Role & Permission Matrix

## 5.1. Bố cục tổng thể

```text
┌──────────────────────────────┬─────────────────────────────────────────────────┐
│ Roles                        │ QA Document Reviewer                             │
│ [Search roles...]            │ Custom role · Active · 8 users                   │
│                              │ [Duplicate] [Disable] [Simulate Access] [Save] │
│ • DCO                        ├─────────────────────────────────────────────────┤
│ • QA Document Reviewer       │ Overview | Functional | Workflow | Data Scope    │
│ • QA Approver                │ Controls & Risks | Audit                          │
│ • Production Operator        │                                                 │
│ • Maintenance Supervisor     │ Content of selected tab                           │
│                              │                                                 │
│ [+ New Role]                 │                                                 │
└──────────────────────────────┴─────────────────────────────────────────────────┘
```

### Cột trái: Role List

- Search theo name/code/description.
- Filter: `All`, `Active`, `Inactive`, `System Template`, `Custom`.
- Group role theo module hoặc department nếu số lượng lớn.
- Badge hiển thị số user được gán và cảnh báo rủi ro.
- Không hiển thị raw permission codes ở cột trái.

### Khu vực phải: Role Header

Hiển thị:

- Role Name, Description, Active/Inactive.
- Scope tóm tắt: `QA Department` hoặc `All Departments`.
- Số user được gán.
- Số permission, workflow capability và exception.
- `Unsaved changes` warning nếu admin đã thay đổi nhưng chưa lưu.

### Action header

- **Duplicate**: tạo role mới từ role hiện tại; an toàn hơn copy từng Permission Set.
- **Disable**: ngừng hiệu lực cho việc gán mới và đánh giá quyền, nhưng giữ audit history.
- **Simulate Access**: kiểm tra effective access thực tế.
- **Save**: chỉ enabled khi có thay đổi hợp lệ; một lần Save gom diff và một e-signature.

---

## 6. Tab Overview

## 6.1. Mục tiêu

Mô tả role theo ngôn ngữ nghiệp vụ, không buộc admin hiểu entity kỹ thuật.

## 6.2. Nội dung

| Field | Mô tả |
|---|---|
| Role Name | Bắt buộc, duy nhất trong tenant. |
| Role Code | Sinh tự động từ tên; chỉ Security Admin có thể sửa khi chưa được dùng. |
| Description | Trách nhiệm, giới hạn, owner nghiệp vụ. |
| Role Template | Template gốc nếu tạo từ mẫu. |
| Status | Active/Inactive. |
| Business Unit Scope | All hoặc danh sách BU. |
| Department Scope | All hoặc danh sách department. |
| Role Owner | Người/bộ phận chịu trách nhiệm review role. |
| Review Frequency | Chu kỳ review, ví dụ 12 tháng. |

## 6.3. Smart defaults

- Tên nhập `QA Document Reviewer` tạo code đề xuất `QA_DOCUMENT_REVIEWER`.
- Nếu chọn template `QA Reviewer`, hệ thống đề xuất permissions, workflow role, scope và SoD baseline.
- Nếu scope trống, UI hiển thị rõ `All Departments`, không để admin hiểu nhầm là “chưa cấu hình”.

---

## 7. Tab Functional Permissions

## 7.1. Mục tiêu

Thay Permission Set screen bằng trải nghiệm chọn quyền dễ hiểu, trong khi backend vẫn lưu Permission Set và permission code độc lập.

## 7.2. UI đề xuất

```text
Functional Permissions                                  [Apply Template] [Clear]

[Search feature, page, or action...]  [Module: All] [Show selected only]

Document Control
  Documents
    [x] View document list                 View
    [x] View document details              View
    [ ] Create document                    Create
    [ ] Edit document metadata             Edit
    [ ] Cancel document                    Lifecycle action

  Revisions
    [x] Preview revision                   View
    [x] Review assigned revision           Workflow action
    [ ] Approve revision                   Workflow action
    [ ] Download source file               Download
```

### Mỗi action hiển thị thêm

- Tên dễ hiểu: `Review assigned revision`.
- Label kỹ thuật nhỏ: `documents.revision.review`.
- Loại action: View, Create, Edit, Download, Workflow, Admin.
- Cảnh báo: `Requires workflow assignment`, `Requires electronic signature`, `Restricted by SoD baseline`.
- Tooltip giải thích khi checkbox disabled.

## 7.3. Hành vi lựa chọn

1. Tick action `Review assigned revision`.
2. UI tự hiển thị dependency: cần participant `Reviewer` và permission xem/preview revision tương ứng.
3. Nếu dependency chưa có, UI đề xuất thêm hoặc giải thích role sẽ không có hiệu lực đầy đủ.
4. Tick action `Approve revision` khi role đã có Author capability sẽ tạo cảnh báo/block SoD tùy baseline.
5. Admin không phải tự biết permission code, nhưng có thể mở `Technical details` khi cần validation/audit.

## 7.4. Backend mapping

```text
Role Workspace selection
        ↓
Access Profile
        ↓
One or more Permission Sets
        ↓
Permission Catalog codes
```

Không xóa Permission Set trong database. UI có thể:

- Liên kết Permission Set có sẵn.
- Tạo Permission Set managed nội bộ theo role.
- Gắn metadata `managedByRoleWorkspace=true` để admin biết không nên sửa tùy tiện ở Advanced Governance.

---

## 8. Tab Workflow Access

## 8.1. Vì sao không dùng ma trận checkbox đơn giản

Ma trận `Status × Button` là khởi đầu tốt, nhưng không đủ cho eQMS vì action còn phụ thuộc:

1. Object: Document Master, Revision, Controlled Copy, CAPA, Change Control, Training Material.
2. Trạng thái của từng object.
3. Participant assignment: user có thực sự là Author/Reviewer/Approver được chỉ định không.
4. Document Type hoặc subtype.
5. Permission cơ bản và scope dữ liệu.
6. SoD và baseline integrity rule.

Nếu chỉ dùng checkbox, UI có thể tạo cảm giác “đã cấp quyền” nhưng user vẫn bị backend từ chối do participant hoặc trạng thái.

## 8.2. UI đề xuất: Workflow Access Matrix có ngữ cảnh

```text
Workflow: [Document Revision v]  Object: [Revision v]  Document Type: [All types v]

┌──────────────────────┬────────────────────┬─────────────────────────────┬──────────────────────┬──────────────┐
│ From status          │ Action             │ Who can perform             │ Permission           │ Control      │
├──────────────────────┼────────────────────┼─────────────────────────────┼──────────────────────┼──────────────┤
│ Draft                │ Complete Editing   │ [x] Assigned Author         │ Complete Editing     │ E-sign       │
│ Draft                │ Submit for Review  │ [x] DCO                     │ Submit for Review    │ E-sign       │
│ Pending Review       │ Review             │ [x] Assigned Reviewer       │ Review Revision      │ E-sign       │
│ Pending Review       │ Reject             │ [x] Assigned Reviewer       │ Reject Revision      │ E-sign       │
│ Pending Approval     │ Approve            │ [ ] Assigned Approver       │ Approve Revision     │ E-sign + SoD │
│ Active               │ Obsolete           │ [ ] DCO                     │ Obsolete Document    │ E-sign       │
└──────────────────────┴────────────────────┴─────────────────────────────┴──────────────────────┴──────────────┘
```

### Cách thao tác

1. Chọn workflow và object.
2. UI tải các trạng thái/action hợp lệ từ policy catalog; admin không được tự nhập text tự do.
3. Tick dòng action để role có thể là actor của action đó.
4. Chọn actor scope phù hợp:
   - `Assigned Author`
   - `Assigned Reviewer`
   - `Assigned Approver`
   - `DCO`
   - `Any user with permission` chỉ dùng cho action thực sự không phụ thuộc participant.
5. UI hiển thị permission được liên kết hoặc tự đề xuất permission chuẩn.
6. Nếu action là GMP-critical, cột `Control` readonly hiển thị `Electronic signature required`.
7. Nếu action tạo xung đột, row có trạng thái blocked và link đến tab `Controls & Risks`.

## 8.3. Baseline workflow rules không thể tắt

| Rule | Lý do |
|---|---|
| Chỉ Assigned Author được Complete Editing revision | Bảo đảm trách nhiệm tác giả. |
| DCO thực hiện Submit for Review | Theo workflow đã xác định cho hệ thống. |
| Chỉ Assigned Reviewer có thể Review/Reject | Bảo đảm review theo phân công. |
| Chỉ Assigned Approver có thể Approve | Bảo đảm phê duyệt có trách nhiệm. |
| Approved/Active record không được edit trực tiếp | Bảo vệ data integrity; thay đổi phải theo revision/lifecycle. |
| Workflow action trọng yếu cần e-signature | Bảo đảm accountability và record linking. |

Admin có thể cấu hình role nào đủ điều kiện được chọn làm Reviewer/Approver/DCO, nhưng không thể bỏ yêu cầu assignment hoặc signature từ UI thông thường.

## 8.4. Backend mapping

```text
Role Workspace workflow selection
        ↓
Workflow Role assignment to Access Profile
        ↓
Lifecycle Transition Policy actor / required permission
        ↓
Runtime evaluation: permission + participant + state + scope + SoD
```

Lifecycle Policy Library vẫn tồn tại trong Advanced Governance để quản trị viên cao cấp xử lý global policy, override theo Document Type, priority và exception đã được change controlled.

---

## 9. Tab Data Scope

## 9.1. Mục tiêu

Biến Object Access Rules từ khái niệm kỹ thuật thành lựa chọn nghiệp vụ rõ ràng.

## 9.2. UI đề xuất

```text
Default data access

Department access
( ) Only records in the user's department
( ) Selected departments
( ) All departments
( ) Assigned records only

Business Unit access
( ) Only records in the user's business unit
( ) Selected business units
( ) All business units

Sensitive actions
[x] Preview files
[ ] Download source files
[ ] Export lists

Exceptions (0)                                             [+ Add exception]
```

## 9.3. Default profiles

| Role type | Department access | Typical intent |
|---|---|---|
| Operator | Own department | Thao tác trong khu vực phụ trách. |
| Supervisor | Own department hoặc selected departments | Giám sát/điều phối. |
| QA | All departments, controlled actions only | Independent quality oversight. |
| DCO | All departments | Document administration. |
| Auditor | Selected/all departments, read-only | Audit/review. |
| Administrator | All departments, configuration-specific | System administration. |

## 9.4. Ngoại lệ

Khi nhấn **Add exception**, chỉ hiển thị form đơn giản:

```text
Resource: [Documents v]
Action: [Download v]
Scope: [Regulatory Affairs Department v]
Effect: [Allow v]
Reason: [Required for external regulatory submission]
Expiry date: [31 Dec 2026]
```

Sau Save + e-sign, backend lưu Object Access Rule có metadata role, reason, expiry và audit information.

### Điều không nên hardcode

Không nên chỉ hardcode “user chỉ xem dữ liệu phòng ban của họ”. Điều này không đáp ứng được các tình huống hợp lệ như QA review cross-department, DCO, auditor, temporary project team hoặc regulatory submission. Department scope nên là default, không phải giới hạn duy nhất.

---

## 10. Tab Controls & Risks

## 10.1. Mục tiêu

Thay màn hình SoD khó hiểu bằng kết quả rủi ro đọc được, nhưng vẫn giữ rule engine đầy đủ phía sau.

## 10.2. Nội dung UI

```text
Controls & Risks

System baselines
[Locked] Author cannot approve their own revision
[Locked] Workflow approvals require electronic signature
[Locked] Active revisions cannot be edited directly

Role conflicts
No conflicts found

User assignment conflicts
2 users would conflict if this role is saved
• Nguyen Van A: Document Author + QA Approver
[View affected users]

Custom controls                                  [Manage advanced controls]
• Create Revision vs Approve Revision (Critical)
• Edit Training Material vs Approve Training Material (Major)
```

## 10.3. Quy tắc kiểm soát

### System baselines

Được định nghĩa bởi backend, luôn có hiệu lực, không có checkbox tắt.

### Configurable SoD constraints

Được quản lý trong `Advanced Governance → SoD Constraints`:

- Hai permission xung đột.
- Severity.
- Compliance reference.
- Status active/inactive.
- Effective date hoặc expiry date nếu hệ thống mở rộng sau này.
- Lý do và e-signature khi thay đổi.

### Impact analysis trước khi Save

Mỗi lần thay đổi role, backend tính:

```text
Impact summary
- 8 current users will gain 2 permissions.
- 3 users will become eligible as Document Reviewers.
- 1 user assignment conflicts with SoD.
- 0 active workflow policies will be invalidated.
```

Nếu có xung đột Critical, button **Save** disabled. Nếu chỉ có warning, admin phải mở warning, xác nhận đã hiểu và ký với lý do.

---

## 11. Tab Audit & Simulation

## 11.1. Audit Timeline

```text
15 Jul 2026 10:20  Nguyen The Ho  Updated Workflow Access
Reason: Added DCO submission responsibility
Signature: verified
Changed: DCO enabled for Submit for Review from Draft

01 Jul 2026 09:05  QA Manager  Created role
Signature: verified
```

Yêu cầu dữ liệu audit:

- Who: user ID, full name.
- When: server timestamp/time zone.
- What: create/update/activate/deactivate/assign/remove.
- Before/after values hoặc structured diff.
- Reason for change.
- Electronic signature information cho action yêu cầu ký.
- Record/version liên kết.

## 11.2. Role Simulator

### UI

```text
Simulate Effective Access

User:       [Nguyen Van A v]
Resource:   [Document Revision v]
Record:     [SOP.0019 - Revision 2 v]
Action:     [Approve Revision v]

[Run simulation]
```

### Kết quả Allow

```text
Allowed

✓ Access Profile: QA Approver
✓ Permission: documents.revision.approve
✓ Workflow role: DOCUMENT_APPROVER
✓ Assigned as Approver for Revision 2
✓ Revision status: Pending Approval
✓ Document department is within user scope
✓ No SoD conflict
✓ E-signature will be required before execution
```

### Kết quả Deny

```text
Denied

✓ User has permission: documents.revision.approve
✗ User is not assigned as an Approver for this revision
✗ Current revision status is Pending Review; Approve requires Pending Approval

Recommended next step:
Assign an eligible Approver, or complete review before approval.
```

Simulator chỉ đánh giá; không được thực hiện action hoặc bypass policy.

---

## 12. Role templates

## 12.1. Mục tiêu

Giảm nhập thủ công và tạo chuẩn nhất quán.

## 12.2. Template gợi ý

| Template | Functional permissions | Workflow role | Data scope |
|---|---|---|---|
| Production Operator | View/create theo module được giao | None hoặc Author | Own department |
| Production Supervisor | View/edit/assign trong phạm vi | Supervisor/Reviewer tùy workflow | Own/selected departments |
| QA Reviewer | View/preview/review | Reviewer | All departments hoặc selected |
| QA Approver | View/approve | Approver | All departments |
| DCO | Document administration | DCO | All departments |
| Maintenance | Equipment actions | Equipment participant | Maintenance department |
| Auditor | View/preview/audit export giới hạn | None | Selected/all read-only |
| System Administrator | Security/system config | No business participant by default | All, configuration only |

## 12.3. Cách dùng

1. Nhấn **New Role**.
2. Chọn **Start from template** hoặc **Blank role**.
3. Nếu chọn template, UI hiển thị những permission/workflow scope được đề xuất.
4. Admin điều chỉnh ngoại lệ.
5. Review impact và Save + e-sign.

Template là điểm khởi đầu, không phải quyền hardcode không thể kiểm tra. Mỗi role tạo từ template vẫn có audit trail và owner riêng.

---

## 13. Electronic signature policy

## 13.1. Không cho admin bật/tắt tùy ý từng button

Electronic signature phải được backend quyết định theo action classification, không dựa vào checkbox UI của role.

### Action luôn yêu cầu ký

| Nhóm action | Ví dụ |
|---|---|
| Workflow decision | Submit, Review, Reject, Approve, Publish, Obsolete, Cancel |
| Security configuration | Tạo/sửa/xóa/enable/disable Role, Permission Set, Lifecycle Policy, SoD, Object Access Rule |
| User access management | Gán/gỡ role, suspend/reinstate user, reset credential theo SOP |
| Governance completion | Complete Access Review |

### Nội dung signature record tối thiểu

```text
Signer name
Signer user ID
Date/time
Meaning of signature: Review / Approval / Responsibility / Authorization
Action and record reference
Reason for change when applicable
Cryptographic or protected link to affected record/version
```

## 13.2. Cơ sở kiểm soát

21 CFR Part 11 yêu cầu hệ thống đóng có authority check, audit trail time-stamped, kiểm soát trình tự thao tác và hạn chế truy cập cho người được ủy quyền. Chữ ký cần hiển thị tên, thời gian và ý nghĩa ký, đồng thời liên kết với record để không bị tách rời. Xem [21 CFR Part 11 §§11.10, 11.50, 11.70](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11).

---

## 14. Mô hình backend: RBAC + ABAC

## 14.1. Quyết định truy cập

```text
ALLOW khi đồng thời thỏa:

1. Account active
2. User có Access Profile active
3. Access Profile cấp Permission Set chứa permission yêu cầu       (RBAC)
4. User thỏa lifecycle policy cho action và trạng thái             (ABAC)
5. User là participant/actor hợp lệ nếu action yêu cầu             (ABAC)
6. Resource thuộc scope Department/BU hoặc có exception hợp lệ     (ABAC)
7. Không vi phạm SoD/baseline integrity rule                       (ABAC/control)
8. Nếu action cần ký, signature được xác thực trước khi commit     (control)
```

## 14.2. Pseudocode

```java
AuthorizationDecision evaluate(User user, Action action, Resource resource) {
    require(user.isActive());
    require(hasPermission(user, action.requiredPermission()));
    require(matchesLifecyclePolicy(user, action, resource.status(), resource.type()));
    require(matchesParticipantAssignment(user, action, resource));
    require(matchesDataScope(user, resource));
    require(!violatesSegregationOfDuties(user, action, resource));

    return allow(action.requiresElectronicSignature());
}
```

## 14.3. Entity mapping giữ nguyên

| UX concept | Entity/backend hiện hữu cần giữ |
|---|---|
| Role | Access Profile |
| Functional permissions | Permission Set + Permission Catalog |
| Workflow Access | Workflow Role + Workflow Action Policy |
| Data Scope | Access Profile scope + Object Access Rule |
| Controls & Risks | SoD Constraint + system baseline policy |
| Audit | Audit record + e-sign record |
| Periodic review | Access Review Campaign |

Điều này cho phép chuyển đổi UI mà không cần migration phá vỡ dữ liệu hoặc rewrite authorization engine ngay lập tức.

---

## 15. API contract đề xuất cho Role Workspace

Không bắt buộc xóa API cũ. Tạo facade API để frontend làm việc với một resource role-centric.

### 15.1. Đọc workspace

```http
GET /api/security/role-workspaces/{accessProfileId}
```

Response tối thiểu:

```json
{
  "role": {
    "id": "...",
    "name": "QA Document Reviewer",
    "code": "QA_DOCUMENT_REVIEWER",
    "description": "...",
    "active": true,
    "businessUnitScope": ["NT Pharma"],
    "departmentScope": ["QA"],
    "ownerUserId": "...",
    "reviewFrequencyMonths": 12
  },
  "functionalPermissions": ["documents.revision.view", "documents.revision.review"],
  "workflowEligibility": ["DOCUMENT_REVIEWER"],
  "workflowAccess": [],
  "dataScope": {},
  "controls": {
    "baselines": [],
    "conflicts": [],
    "affectedUserConflicts": []
  },
  "assignedUsers": []
}
```

### 15.2. Preview impact trước khi lưu

```http
POST /api/security/role-workspaces/preview
```

Request chứa draft role. Response trả về:

- Validation errors.
- SoD conflicts.
- User bị ảnh hưởng.
- Permission/action tăng hoặc giảm.
- Lifecycle policy invalid hoặc missing.
- Required e-sign action metadata.

### 15.3. Save atomically

```http
PUT /api/security/role-workspaces/{accessProfileId}
```

Yêu cầu:

- Request có e-signature token/verification payload.
- Transaction atomically cập nhật Access Profile, Permission Sets managed, workflow role links, scope, assignments và audit events.
- Nếu một validation thất bại, rollback toàn bộ.
- Response trả về workspace phiên bản mới và audit event ID.

### 15.4. Simulator

```http
POST /api/security/access-simulations
```

Request:

```json
{
  "userId": "...",
  "resourceType": "DOCUMENT_REVISION",
  "resourceId": "...",
  "action": "APPROVE"
}
```

Response có `decision`, `checks[]`, `missingRequirements[]`, `recommendedNextStep`. Không trả dữ liệu resource mà người gọi không có quyền xem.

---

## 16. Migration UX không phá vỡ hệ thống

## Giai đoạn 0: Chuẩn hóa catalog và policy engine

1. Khóa permission code canonical.
2. Có alias/backward compatibility cho code cũ trong thời gian migration.
3. Xác định System baseline rules.
4. Bổ sung explainable authorization decision trong backend.

## Giai đoạn 1: Role Workspace read-only

1. Xây UI Role & Permission Matrix đọc từ Access Profiles/Permission Sets hiện có.
2. Không cho save qua UI mới trong giai đoạn đầu.
3. So sánh kết quả Role Workspace với màn hình cũ và test authorization runtime.

## Giai đoạn 2: Save Role Workspace

1. Thêm preview impact API.
2. Thêm atomic save + e-signature.
3. Cho phép tạo/sửa role qua UI mới.
4. Giữ menu cũ dưới Advanced Governance cho Security Admin.

## Giai đoạn 3: User assignment và simulator

1. Thêm Assign Role trực tiếp từ User Profile.
2. Chặn SoD trước khi save.
3. Thêm Role Simulator.
4. E2E test theo từng module feature.

## Giai đoạn 4: Simplify navigation

1. Ẩn menu cũ khỏi sidebar thông thường.
2. Chỉ Security Admin thấy Advanced Governance.
3. Giữ route cũ để bookmark/API không hỏng; redirect mềm về UI mới khi hợp lý.

## Giai đoạn 5: Governance maturity

1. Role owner và review frequency.
2. Access review tự nhắc theo lịch.
3. Exception workflow có expiry.
4. Dashboard security posture và orphan-role report.

---

## 17. Acceptance criteria

### UX

1. Admin có thể tạo role hoàn chỉnh trong một workspace duy nhất, không phải mở Permission Set/Lifecycle/Object Rule screen.
2. Admin nhìn thấy tác động tới user trước khi Save.
3. Mọi error hiển thị bằng ngôn ngữ nghiệp vụ, kèm action khuyến nghị.
4. Người không chuyên kỹ thuật có thể gán role cho user mà không cần biết permission code.
5. Security Admin vẫn có Advanced Governance để xử lý ngoại lệ.

### Authorization correctness

1. UI không thể cấp một action mà backend không công nhận.
2. Backend luôn là nơi quyết định Allow/Deny, UI chỉ phản ánh kết quả.
3. Author không thể approve revision của chính mình nếu baseline áp dụng.
4. Reviewer/Approver chỉ thực hiện action khi được assignment và trạng thái cho phép.
5. Department/BU scope được kiểm tra server-side cho view, preview, download và action.
6. SoD conflict chặn assignment/save theo severity policy.

### Compliance/audit

1. Mọi create/update/delete/activate/deactivate/assignment có audit trail.
2. GMP-critical action yêu cầu e-signature và record signature link.
3. Audit trail giữ old/new value, thời gian server, actor, reason và signature meaning.
4. System baseline không thể bị disable qua UI/API thông thường.
5. Access Review campaign tạo snapshot quyền và chỉ complete khi hết item pending.

---

## 18. Các câu hỏi cần Gemini phản biện

1. Hai menu `User Management` và `Role & Permission Matrix` có đủ đơn giản cho admin vận hành không?
2. Sáu tab của Role Workspace có nên giảm còn năm tab, hay nên tách `Audit & Simulation` thành action/drawer?
3. Workflow Access Matrix có cách biểu diễn nào trực quan hơn nhưng vẫn thể hiện participant + state + action + scope?
4. Scope theo department/BU có cần thêm level `Site`, `Facility`, `Project`, `Document Type` ngay từ v1 không?
5. Những SoD baseline nào nên immutable đối với eQMS/Document Control?
6. Role Template nào phù hợp nhất với tổ chức pharma có Equipment, Documents, Training, CAPA và Change Control?
7. Đề xuất API facade `role-workspaces` có thiếu dữ liệu hoặc validation quan trọng nào không?
8. Có rủi ro nào khi giữ entity kỹ thuật cũ nhưng chỉ thay UI/navigation không?

---

## 19. Kết luận

Đề xuất này **đồng ý với hướng đơn giản hóa của Gemini ở tầng UI**, nhưng không đồng ý với việc xóa/hardcode hoàn toàn Lifecycle Policy, Object Access Rule và SoD.

Giải pháp cân bằng là:

```text
UI cho admin thông thường:
User Management + Role & Permission Matrix

Backend/control model:
Access Profile + Permission Set + Lifecycle Policy + Scope Rule + SoD + Audit + E-signature

Advanced Governance:
Chỉ Security Administrator truy cập khi cần ngoại lệ hoặc change control nâng cao
```

Mô hình này giảm đáng kể số màn hình phải học, nhưng vẫn bảo vệ được data integrity, separation of duties, traceability và khả năng chứng minh kiểm soát khi audit.
