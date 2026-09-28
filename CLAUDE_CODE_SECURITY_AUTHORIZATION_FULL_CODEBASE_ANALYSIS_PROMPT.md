# SECURITY & AUTHORIZATION — FULL CODEBASE ANALYSIS PROMPT

## 1. Vai trò của bạn

Bạn đang đóng vai trò đồng thời là:

- Senior Business/System Analyst;
- Software Architect;
- Senior Full-Stack Engineer;
- Security & Authorization Architect;
- Computerized System Validation Specialist;
- Chuyên gia phát triển phần mềm cho môi trường EU-GMP với hơn 20 năm kinh nghiệm.

Bạn có kinh nghiệm chuyên sâu về:

- React / TypeScript;
- Spring Boot;
- REST API;
- PostgreSQL;
- RBAC, ABAC và policy-based authorization;
- Workflow authorization;
- Object-level access;
- Segregation of Duties;
- Electronic signature;
- Audit trail;
- EU GMP Annex 11;
- GAMP 5;
- FDA 21 CFR Part 11;
- ALCOA+;
- Hệ thống eDMS/eQMS.

---

# 2. Mục tiêu công việc

Hãy phân tích và đánh giá toàn bộ chức năng **Security & Authorization** của hệ thống eQMS.

Phạm vi bắt đầu từ frontend:

```text
@eqms/src/features/security-authorization/
```

Nhưng không được giới hạn ở thư mục này.

Phải truy vết toàn bộ code liên quan ở:

- Frontend;
- Backend;
- REST API;
- Database schema;
- Flyway/Liquibase migrations;
- Entity;
- Repository;
- Service;
- Controller;
- DTO;
- Mapper;
- Security configuration;
- Authentication filter;
- Permission evaluation;
- Workflow authorization;
- Object access;
- Assignment;
- Audit trail;
- Electronic signature;
- Tests;
- Seed data;
- Permission constants;
- Role/profile constants;
- Menu configuration;
- Route guards;
- Button/action visibility;
- Capability API;
- Các module nghiệp vụ đang sử dụng authorization.

Mục tiêu cuối cùng là xác định:

1. Kiến trúc phân quyền hiện tại đang hoạt động như thế nào.
2. Phần nào đúng.
3. Phần nào sai hoặc chưa đồng nhất.
4. Phần nào đang hard-code.
5. Phần nào chỉ kiểm tra ở frontend nhưng backend không bảo vệ.
6. Phần nào backend và frontend đang dùng hai logic khác nhau.
7. Việc đổi tên Role/Access Profile có làm thay đổi hoặc phá vỡ quyền hay không.
8. Các quyền đã thực sự liên kết với module nghiệp vụ hay mới chỉ tồn tại trên màn hình cấu hình.
9. Workflow assignment và quyền toàn hệ thống có đang bị nhầm lẫn hay không.
10. Hệ thống hiện có đủ linh hoạt để Admin tạo Role/Profile mới mà không sửa code hay chưa.
11. Các action theo trạng thái workflow có thực sự được backend kiểm soát hay không.
12. Kiến trúc hiện tại có phù hợp với phần mềm eQMS trong môi trường GMP hay không.

---

# 3. Yêu cầu quan trọng: chưa sửa code ngay

Ở vòng đầu tiên, tuyệt đối không sửa code.

Trước tiên phải:

1. Quét và đọc code.
2. Mô hình hóa kiến trúc hiện tại.
3. Lập danh sách phát hiện.
4. Chỉ ra các vấn đề.
5. Đưa ra đề xuất thiết kế mục tiêu.
6. Lập kế hoạch triển khai.
7. Nêu câu hỏi cần xác nhận.

Chỉ bắt đầu sửa code sau khi tôi phê duyệt kế hoạch.

Không được tự động refactor toàn bộ hệ thống trong lần phân tích đầu tiên.

---

# 4. Bối cảnh nghiệp vụ

Đây là phần mềm quản lý chất lượng điện tử cho môi trường GMP.

Hệ thống hiện tập trung vào hai module chính:

```text
Document Control
Training Management
```

Mỗi module có thể có:

- Nhiều menu con;
- Nhiều màn hình;
- Nhiều action;
- Nhiều button;
- Nhiều trạng thái vòng đời;
- Nhiều workflow task;
- Nhiều participant;
- Nhiều điều kiện nghiệp vụ;
- Nhiều loại dữ liệu;
- Nhiều phạm vi truy cập.

Do đó, authorization không thể chỉ dựa trên một Role cố định.

---

# 5. Yêu cầu đặc biệt của Document Control

Document Control có đặc thù:

Một user có thể giữ vai trò khác nhau trên từng Revision.

Ví dụ:

```text
Revision X:
User A = AUTHOR
User B = REVIEWER
User C = APPROVER
```

Nhưng với Revision Y:

```text
User A = REVIEWER
User B = AUTHOR
User C = APPROVER
```

Do đó phải phân biệt rõ:

## 5.1. System Role / Access Profile

Đây là vai trò tổng quát được Admin gán cho user.

Ví dụ:

```text
Document Controller
QA Manager
Training Coordinator
System Administrator
Read-only User
```

Role/Profile chỉ nên là tập hợp các Permission hoặc Permission Set.

Role name không được là nguồn quyết định cuối cùng.

Không được có logic kiểu:

```java
if (roleName.equals("DCO")) {
    allowPublish();
}
```

hoặc:

```tsx
if (user.role === "QA_MANAGER") {
    showApproveButton();
}
```

## 5.2. Permission

Permission là khả năng thực hiện một loại action.

Ví dụ:

```text
documents.revision.view
documents.revision.edit_online
documents.revision.submit_review
documents.revision.review
documents.revision.approve
documents.revision.publish
training.assignment.create
training.assignment.complete
security.users.manage
```

Permission phải được xác định bằng code ổn định.

Đổi tên Role/Profile không được làm mất hoặc thay đổi permission.

## 5.3. Workflow Assignment

Workflow assignment là việc user được chỉ định vào một hồ sơ cụ thể.

Ví dụ:

```text
AUTHOR
CO_AUTHOR
REVIEWER
APPROVER
TRAINER
TRAINEE
```

Assignment phải gắn với:

- Document;
- Revision;
- Training assignment;
- Workflow instance;
- Task;
- Review round;

tùy domain model hiện tại.

User có permission `documents.revision.review` nhưng không được assignment làm Reviewer của Revision đó thì không được Review.

## 5.4. Workflow State

Permission và assignment vẫn chưa đủ.

Action phải được kiểm tra theo trạng thái.

Ví dụ:

```text
Edit Online
→ chỉ được khi Revision ở Draft/Rework

Complete Review
→ chỉ được khi Pending Review

Approve
→ chỉ được khi Pending Approval

Publish
→ chỉ được khi Ready for Publishing
```

## 5.5. Business Preconditions

Ngoài permission, assignment và state, action còn có thể cần:

- Đúng reviewer sequence;
- Reviewer trước đã hoàn thành;
- Source file tồn tại;
- PDF snapshot đã sẵn sàng;
- Approval đã hoàn tất;
- Training đã hoàn tất nếu bắt buộc;
- Không có revision in-progress khác;
- Không vi phạm SoD;
- E-signature đã xác thực;
- Record chưa locked;
- Object access cho phép.

## 5.6. Capability

Quyết định cuối cùng phải là capability do backend trả về.

Ví dụ:

```json
{
  "allowedActions": {
    "view": true,
    "editOnline": false,
    "completeAuthoring": false,
    "completeReview": true,
    "approve": false,
    "publish": false
  },
  "denialReasons": {
    "approve": "USER_NOT_ASSIGNED_APPROVER",
    "publish": "INVALID_WORKFLOW_STATE"
  }
}
```

Frontend chỉ render theo capability.

Frontend không được tự tính action dựa trên role name hoặc state đơn lẻ.

---

# 6. Kiến trúc mục tiêu cần dùng để đối chiếu

Hãy đánh giá code hiện tại so với mô hình mục tiêu:

```text
User
  ↓
Access Profile / Role
  ↓
Permission Set
  ↓
Permission
  ↓
Object Access / Data Scope
  ↓
Workflow Assignment
  ↓
Workflow State
  ↓
Business Preconditions
  ↓
SoD
  ↓
E-Signature / Re-authentication
  ↓
Backend Capability Decision
  ↓
Frontend renders actions
```

Không được kết luận chỉ dựa trên tên class.

Phải kiểm tra code runtime thực tế.

---

# 7. Các vấn đề cần đặc biệt tìm kiếm

## 7.1. Hard-coded role

Tìm toàn bộ trường hợp như:

```java
roleName.equals(...)
hasRole(...)
hasAnyRole(...)
ROLE_ADMIN
ROLE_DCO
ROLE_QA
ROLE_REVIEWER
ROLE_APPROVER
isAdmin()
isDco()
```

Và frontend:

```tsx
user.role === ...
roles.includes(...)
profileName === ...
isAdmin
isDco
isReviewer
```

Phải phân loại:

- Hard-code hợp lệ cho authentication/infrastructure;
- Hard-code không hợp lệ trong business authorization;
- Legacy fallback;
- Temporary migration alias;
- Bypass nguy hiểm.

## 7.2. Hard-coded permission

Tìm:

- Permission code đặt trực tiếp rải rác;
- Permission code trùng nghĩa nhưng khác tên;
- Singular/plural variants;
- Frontend tự định nghĩa permission catalog;
- Backend và DB dùng code khác nhau;
- Permission không có seed;
- Permission seed không được sử dụng;
- Permission bị orphan;
- Permission gán vào role nhưng không được enforcement.

## 7.3. Frontend-only authorization

Tìm trường hợp:

- Button bị ẩn ở FE nhưng API không kiểm tra;
- Route guard ở FE nhưng backend endpoint public;
- FE tự check state;
- FE tự check assignment;
- FE tự check role;
- Direct API có thể bypass.

## 7.4. Backend-only nhưng frontend không đồng bộ

Tìm trường hợp:

- Backend từ chối action nhưng frontend vẫn hiển thị button;
- FE dùng rule khác backend;
- Message/reason không rõ;
- Frontend đoán quyền từ current user;
- Không có capability API.

## 7.5. Role/Profile name dependency

Kiểm tra:

- Đổi display name Role/Profile có phá logic không;
- Code có tìm role bằng name không;
- DB foreign key có dùng role name không;
- Workflow actor có map bằng string name không;
- Permission assignment có phụ thuộc tên không;
- API có gửi role name làm key hay không.

Mục tiêu:

```text
Role/Profile ID hoặc immutable code là identity.
Display name chỉ là label.
Đổi tên display name không ảnh hưởng quyền.
```

## 7.6. Admin/Super Admin bypass

Kiểm tra:

- Super Admin bypass những gì;
- Có bypass workflow state không;
- Có bypass assignment không;
- Có bypass SoD không;
- Có bypass e-signature không;
- Có bypass object access không;
- Bypass có audit không;
- Legacy aliases có còn tồn tại không.

Không giả định Super Admin được làm mọi nghiệp vụ GxP.

## 7.7. Object access

Kiểm tra user được xem dữ liệu theo:

- Site;
- Business unit;
- Department;
- Document type;
- Ownership;
- Assignment;
- Training scope;

hay chưa.

Phải phân biệt:

```text
Có permission view
```

và:

```text
Được xem record cụ thể nào
```

## 7.8. Workflow authorization

Kiểm tra từng action:

- Required permission;
- Allowed state;
- Required participant;
- Sequence;
- Assignment;
- Business rule;
- E-signature;
- Audit;
- Notification.

Tìm xem policy được cấu hình trong DB hay hard-code trong service.

## 7.9. Audit trail

Kiểm tra các thay đổi sau có audit hay không:

- Tạo/sửa/xóa Role;
- Đổi tên Role;
- Tạo/sửa Permission Set;
- Thêm/xóa Permission;
- Gán/bỏ Access Profile;
- Gán/bỏ Permission Set;
- Activate/deactivate user;
- Reset password;
- Thay đổi workflow policy;
- Thay đổi object access;
- Thay đổi SoD;
- Unauthorized attempt;
- Privilege escalation;
- Self-grant;
- Last-admin removal.

Audit phải lưu:

- Actor;
- Timestamp;
- Target;
- Old value;
- New value;
- Reason nếu cần;
- Outcome;
- Correlation ID.

## 7.10. Security administration invariants

Kiểm tra có bảo vệ:

- Không vô hiệu hóa last active administrator;
- Không xóa last system admin;
- Không tự cấp quyền critical cho chính mình;
- Không tự nâng quyền mà không approval/re-auth;
- Không xóa permission đang được sử dụng;
- Không tạo vòng lặp hierarchy;
- Không gán role inactive;
- Không gán permission deprecated;
- Không xóa Access Profile đang gán cho user mà không impact preview.

---

# 8. Phân tích frontend

Tại:

```text
@eqms/src/features/security-authorization/
```

Hãy phân tích:

- Menu;
- Routes;
- Pages;
- Components;
- Hooks;
- Stores;
- API clients;
- Forms;
- Tables;
- Permission tree;
- Role/access profile editor;
- Permission set editor;
- Workflow authorization;
- Object access;
- SoD;
- Capability preview;
- Audit UI.

Trả lời:

1. UI hiện dùng khái niệm gì: Role, Access Profile, Permission Set hay Permission?
2. Các khái niệm có bị trộn lẫn không?
3. Admin có phải cấu hình raw permission code không?
4. Có duplicate page hoặc legacy page không?
5. Có nhiều route cho cùng chức năng không?
6. FE có lưu permission catalog riêng không?
7. FE có hard-code module/menu/action không?
8. FE có tự quyết định authorization không?
9. UI có hiển thị effective access dễ hiểu không?
10. Admin có thể biết user thực sự được làm gì không?
11. Có impact preview khi sửa quyền không?
12. Có chế độ simple/advanced không?
13. Có test permission configuration không?
14. Có thể tạo Role/Profile mới không cần sửa FE không?

---

# 9. Phân tích backend

Hãy tìm và đánh giá các thành phần tương đương:

```text
SecurityConfig
AuthTokenFilter
PermissionEvaluationService
EffectivePermissionService
AuthorizationService
WorkflowAuthorizationService
ObjectAccessService
CapabilityService
AuditTrailService
ElectronicSignatureService
UserService
RoleService
AccessProfileService
PermissionSetService
```

Tên thực tế có thể khác.

Phải kiểm tra:

- Source of truth của permission;
- Cách tính effective permission;
- Cache;
- Invalidation;
- Transaction;
- Race condition;
- Privilege escalation;
- Endpoint protection;
- Method-level security;
- Resource-level security;
- Workflow-level security;
- Test coverage.

---

# 10. Phân tích API

Lập danh sách các API liên quan:

- User Management;
- Roles/Access Profiles;
- Permission Sets;
- Permission Catalog;
- Workflow Authorization;
- Object Access;
- SoD;
- Capability;
- Audit Trail;
- E-signature;
- Assignment;
- Document Control;
- Training Management.

Với mỗi API, đánh giá:

```text
Endpoint
HTTP method
Permission bắt buộc
Object access
Workflow condition
Assignment condition
Audit event
Potential bypass
Frontend consumer
Test coverage
```

Phải phát hiện:

- Endpoint không được bảo vệ;
- Endpoint chỉ kiểm tra authentication;
- Endpoint dùng role string;
- Endpoint trust dữ liệu FE;
- Endpoint trả quá nhiều dữ liệu;
- Endpoint mutate nhưng không audit;
- Endpoint có duplicate route;
- Endpoint legacy chưa loại bỏ.

---

# 11. Phân tích database

Tìm và mô hình hóa các bảng liên quan, ví dụ:

```text
users
roles
permissions
role_permissions
permission_sets
permission_set_permissions
access_profiles
access_profile_permission_sets
user_access_profiles
workflow_assignments
workflow_policies
object_access_rules
sod_rules
audit_trail
```

Tên thực tế có thể khác.

Đánh giá:

- Primary key;
- Immutable code;
- Display name;
- Unique constraints;
- Foreign keys;
- Cascade behavior;
- Soft delete;
- Active/inactive;
- Audit fields;
- Effective dates;
- History;
- Versioning;
- Migration compatibility;
- Orphan records;
- Duplicate permission codes;
- Legacy role tables.

Đặc biệt kiểm tra role/profile có đang được dùng bằng:

- ID;
- Code;
- Name;
- Enum;
- String.

Display name không được dùng làm identity.

---

# 12. Kiểm tra liên kết với Document Control

Hãy lập action matrix tối thiểu cho:

## Document Master

- View;
- Create;
- Edit metadata;
- Upload Revision;
- Cancel Master;
- Obsolete Master;
- View Audit;
- View Revisions;
- View Controlled Copies.

## Revision

- View;
- Open Authoring Workspace;
- Upload Source;
- Replace Source;
- Upload to Office Online;
- Edit Online;
- Preview;
- Complete Authoring;
- Submit for Review;
- Complete Review;
- Reject Review;
- Approve;
- Reject Approval;
- Complete Training;
- Open Publishing Workspace;
- Publish;
- Cancel;
- Upgrade;
- Request Controlled Copy.

Với mỗi action, xác định:

```text
Permission
Required participant
Allowed states
Object access
Business preconditions
SoD
E-signature
Audit
Current implementation
Gap
```

Phải làm rõ:

- Author và Co-Author khác nhau thế nào;
- Reviewer chỉ được review record được assignment;
- Approver chỉ được approve record được assignment;
- Sequence có được enforce;
- DCO có được phép toàn bộ hay chỉ trong scope;
- Admin có bypass nghiệp vụ hay không;
- Việc đổi tên Access Profile có ảnh hưởng workflow actor không.

---

# 13. Kiểm tra liên kết với Training Management

Lập action matrix tối thiểu cho:

- View Training;
- Create Training Plan;
- Assign Trainee;
- Assign Trainer;
- Start Training;
- Record Attendance;
- Complete Training;
- Verify Training;
- Waive Training;
- Reassign;
- Cancel;
- View Evidence;
- Export Report;
- View Audit.

Phải phân biệt:

- Permission nền;
- Trainer assignment;
- Trainee assignment;
- Training coordinator;
- Department scope;
- Document-related training;
- Due/overdue state;
- Completion prerequisite;
- SoD nếu có.

---

# 14. Đánh giá UX quản trị phân quyền

Không chỉ đánh giá đúng/sai về kỹ thuật.

Hãy đánh giá Admin có dễ sử dụng không.

Trả lời:

1. Admin có hiểu Role/Profile đang được cấp quyền gì không?
2. Có phải xem hàng trăm raw permission code không?
3. Có Permission Set/Bundle không?
4. Có nhóm theo module/màn hình/action không?
5. Có effective access preview không?
6. Có test-as-user/capability preview không?
7. Có impact analysis trước khi thay đổi không?
8. Có cảnh báo privilege escalation không?
9. Có thể clone Role/Profile không?
10. Có thể tạo Role/Profile mới không cần sửa code không?
11. Có thể đổi tên mà không ảnh hưởng runtime không?
12. Có thể cấu hình theo module nhưng vẫn dùng assignment theo từng record không?
13. Có chế độ Simple Mode và Advanced Mode không?

Đề xuất UI đơn giản nhưng backend vẫn chặt chẽ.

---

# 15. Các anti-pattern cần phát hiện

Tìm và báo cáo rõ nếu có:

```text
if role == ...
if profileName == ...
if user.isAdmin()
frontend-only permission
backend-only capability không đồng bộ FE
raw permission code rải rác
duplicate permission code
role và workflow actor bị trộn
role và access profile bị trộn
permission và capability bị trộn
button permission thay vì business action
state transition hard-code rải rác
controller tự kiểm tra authorization
service khác lại dùng logic khác
Super Admin bypass toàn bộ
missing object access
missing SoD
missing audit
permission cache stale
rename Role làm hỏng quyền
```

---

# 16. Output bắt buộc

Hãy trả về một báo cáo Markdown gồm các phần sau.

## A. Executive Summary

- Đánh giá tổng thể.
- Mức độ hoàn thiện.
- Mức độ rủi ro.
- Có thể tiếp tục phát triển hay cần refactor nền tảng.

## B. Current Architecture

Mô tả bằng sơ đồ text:

```text
User
→ Role/Profile
→ Permission Set
→ Permission
→ Assignment
→ Workflow
→ Capability
```

Nhưng phải phản ánh đúng code hiện tại, không phải kiến trúc mong muốn.

## C. Current Data Model

Liệt kê các bảng/entity và quan hệ.

## D. Current Authorization Flow

Mô tả một request được kiểm tra thế nào từ:

```text
Frontend
→ API
→ Authentication
→ Permission
→ Assignment
→ State
→ Business Rule
→ Audit
```

## E. Findings

Mỗi finding phải có:

```text
ID
Severity
Category
Location
Current behavior
Risk
Evidence
Recommended correction
```

Severity:

```text
Critical
High
Medium
Low
Informational
```

## F. Hard-code Inventory

Liệt kê tất cả hard-code role/profile/permission/state quan trọng.

## G. FE-BE Inconsistency Matrix

| Action | FE rule | BE rule | API guard | Consistent? | Risk |
|---|---|---|---|---|---|

## H. Permission Usage Matrix

| Permission | Defined in DB | Seeded | Used in FE | Enforced in BE | Used by module | Orphan/Duplicate |
|---|---:|---:|---:|---:|---|---|

## I. Document Control Authorization Matrix

Theo yêu cầu ở phần 12.

## J. Training Management Authorization Matrix

Theo yêu cầu ở phần 13.

## K. Role Rename Safety Assessment

Trả lời rõ:

```text
Nếu đổi tên Role/Profile thì phần nào bị ảnh hưởng?
Phần nào dùng ID?
Phần nào dùng code?
Phần nào dùng name?
Có cần migration không?
```

## L. Target Architecture

Đề xuất kiến trúc mục tiêu, nhưng phải tận dụng code tốt hiện có và tránh viết lại không cần thiết.

## M. Gap Analysis

```text
Current
Target
Gap
Required change
Priority
```

## N. Implementation Roadmap

Chia thành sprint/phase:

```text
P0 — Security defects
P1 — Authorization consistency
P2 — Role/Profile and Permission Set cleanup
P3 — Workflow assignment and capability
P4 — Object access and SoD
P5 — Security admin UX
P6 — Legacy cleanup
P7 — Final validation
```

Đây chỉ là ví dụ. Hãy điều chỉnh theo code thực tế.

## O. Clarification Questions

Chỉ hỏi những vấn đề không thể kết luận từ code.

## P. Test Strategy

Bao gồm:

- Unit test;
- Integration test;
- API authorization test;
- Workflow state test;
- Assignment test;
- Role rename test;
- Privilege escalation test;
- Last-admin test;
- Direct API bypass test;
- Frontend capability test;
- Cross-module test;
- Audit test.

---

# 17. Yêu cầu về bằng chứng

Mọi kết luận phải dẫn file/class/method/table cụ thể.

Ví dụ:

```text
File:
src/main/java/.../AuthorizationService.java

Method:
canPublishRevision(...)

Finding:
Method still checks role name "DCO".
```

Không được đưa ra nhận định chung mà không có bằng chứng từ code.

Nếu chưa tìm thấy bằng chứng, ghi:

```text
Not confirmed from current codebase.
```

Không tự suy diễn.

---

# 18. Điều kiện hoàn thành vòng phân tích

Vòng phân tích chỉ được coi là hoàn thành khi:

- Đã quét FE, BE, API và DB.
- Đã truy vết ít nhất một action end-to-end.
- Đã lập inventory role/profile/permission.
- Đã kiểm tra rename safety.
- Đã kiểm tra Document Control assignment.
- Đã kiểm tra Training assignment.
- Đã kiểm tra FE-BE consistency.
- Đã liệt kê hard-code.
- Đã đưa ra roadmap.
- Chưa sửa code khi chưa được phê duyệt.
