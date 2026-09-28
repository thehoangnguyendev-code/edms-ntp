# Hướng dẫn Security & Authorization và test Documents end-to-end

> Phiên bản: 1.0  
> Phạm vi: `eqms/src/features/security-authorization/` và `eqms/src/features/documents/`  
> Mục đích: hướng dẫn người quản trị tạo người dùng, Permission Set, Access Profile (Role), Workflow Role, Lifecycle Policy và test toàn bộ luồng Document Master - Revision - Controlled Copy.  
> Nguyên tắc: mọi thay đổi cấu hình phân quyền và mọi hành động workflow quan trọng phải được xác nhận bằng chữ ký điện tử khi màn hình yêu cầu.

---

## 1. Cách đọc hướng dẫn

### 1.1. Thuật ngữ trong hệ thống

| Thuật ngữ | Ý nghĩa | Ví dụ |
|---|---|---|
| Permission | Một khả năng nguyên tử, được backend kiểm tra. | `documents.revision.review` |
| Permission Set | Nhóm Permission có thể tái sử dụng. | `PS-DOC-REVIEWER` |
| Access Profile | Vai trò gán cho user; có thể gồm Permission Set, Workflow Role và scope. | `ROLE-DOC-REVIEWER` |
| Workflow Role | Nhãn xác định user đủ điều kiện được chọn là participant trong workflow. | `DCO`, `DOCUMENT_REVIEWER` |
| Lifecycle Policy | Quy tắc: ở trạng thái nào, ai được thực hiện action nào. | `PENDING_REVIEW` + `COMPLETE_REVIEW` |
| Object Access Rule | Quy tắc lọc record theo Business Unit, Department, ownership hoặc participant. | User Quality chỉ xem tài liệu Quality |
| SoD | Segregation of Duties; quy tắc ngăn xung đột trách nhiệm. | Reviewer không đồng thời là Approver |
| Document Master | Hồ sơ tài liệu cha: metadata, participant, quan hệ tài liệu. | SOP.0019 |
| Revision | Phiên bản nội dung của Document Master, có workflow riêng. | SOP.0019 rev. 1.0 |
| Controlled Copy | Bản sao phát hành có kiểm soát, có trạng thái riêng. | CC-SOP.0019-001 |

### 1.2. Ba lớp kiểm soát

Không phải chỉ tick Permission là user sẽ bấm được nút. Hệ thống đánh giá theo chuỗi sau:

```text
User đăng nhập
  -> Access Profile đang Active
    -> Permission Set chứa Permission cần thiết
      -> Lifecycle Policy cho phép action ở trạng thái hiện tại
        -> User đúng actor scope (Author / Assigned Reviewer / DCO / ...)
          -> Object Access Rule cho phép truy cập record
            -> Nút hiển thị và backend chấp nhận action
```

Nếu một lớp không đạt, nút có thể bị ẩn, disabled hoặc API từ chối. Khi test lỗi, không thêm quyền ngẫu nhiên; hãy đối chiếu lần lượt từng lớp tại Mục 13.

### 1.3. Menu và route chính

Trong sidebar **Quality -> Security & Authorization** có các màn hình sau:

| Màn hình | Route | Dùng để làm gì |
|---|---|---|
| User Management | `/settings/users` | Tạo, sửa, khóa user; kiểm tra quyền đang có |
| Access Profiles | `/security/access-profiles` | Tạo role; gán Permission Set, Workflow Role, User và scope |
| Permission Sets | `/security/permission-sets` | Tạo các gói Permission tái sử dụng |
| Lifecycle Policies | `/security/lifecycle-policies` | Cấu hình transition và capability theo trạng thái |
| Object Access Rules | `/security/object-rules` | Cấu hình record user được xem, preview, download |
| Segregation of Duties | `/security/sod` | Tạo quy tắc ngăn xung đột vai trò/quyền |
| Access Review | `/security/access-review` | Rà soát định kỳ quyền đã cấp |
| E-Sign Config | `/settings/electronic-signature` | Kiểm tra cấu hình chữ ký điện tử |

---

## 2. Chuẩn bị dữ liệu trước khi cấu hình

Thực hiện bằng System Admin hoặc user có đủ quyền Security.

1. Vào **System Administration -> Dictionaries**.
2. Kiểm tra Business Unit cần test, ví dụ `Quality`, đang Active.
3. Kiểm tra Department cần test, ví dụ `Quality Assurance`, đang Active.
4. Kiểm tra Position phù hợp, ví dụ `DCO`, `QA Specialist`, `QA Manager`.
5. Vào **Security & Authorization -> E-Sign Config**, kiểm tra e-sign đang hoạt động trước khi test action workflow.
6. Dùng cùng Department `Quality Assurance` cho toàn bộ test cơ bản để loại trừ biến số Department. Test chéo Department thực hiện riêng ở Mục 12.3.

### 2.1. Bộ tài khoản UAT khuyến nghị

Tạo năm user riêng. Không dùng một user cho hai vai trò xử lý của cùng một revision.

| User | Username gợi ý | Access Profile | Mục đích |
|---|---|---|---|
| A | `uat.dco` | `ROLE-DOC-DCO` | Tạo/cấu hình Document Master, mở Publishing Workspace, submit, publish, training, cancel, obsolete |
| B | `uat.author` | `ROLE-DOC-AUTHOR` | Upload source lần đầu, edit online, Complete Authoring |
| C | `uat.coauthor` | `ROLE-DOC-COAUTHOR` | Edit online cùng Author; xác nhận bị chặn upload/complete authoring |
| D | `uat.reviewer` | `ROLE-DOC-REVIEWER` | Review hoặc Reject revision được chỉ định |
| E | `uat.approver` | `ROLE-DOC-APPROVER` | Approve hoặc Reject revision được chỉ định |

Database có thể đã có các user seed `user.a.test`, `user.b.test`, `user.c.test`, `user.d.test`. Có thể dùng chúng để kiểm tra nhanh, nhưng bộ năm user trên phù hợp hơn cho UAT vì tách Author, Co-Author, Reviewer và Approver rõ ràng.

---

## 3. Permission Catalog cho Documents

Trong **Permission Sets**, Permission Explorer nhóm quyền theo module. Hãy tìm bằng mã Permission, không chỉ dựa vào tên hiển thị.

### 3.1. Document Master

| Mã Permission | Khi nào cần | Màn hình/nút được test |
|---|---|---|
| `documents.module.view` | Bắt buộc để vào Documents | Sidebar Document Control, route `/documents/*` |
| `documents.document.view` | Xem Document Master | All Documents, Documents Owned By Me, Detail Document |
| `documents.document.create` | DCO tạo Document Master | **All Documents -> New Document** |
| `documents.document.edit_metadata` | Sửa metadata cho phép sửa | **Edit Document**, General/Training Information |
| `documents.document.manage_relations` | Thêm/xóa Related và Correlated Document | Hai nút Select Related/Correlated Document |
| `documents.document.view_audit` | Xem audit Document Master | Tab **Audit Trail** |
| `documents.document.cancel` | Cancel Document Master | Nút **Cancel** trên Document Detail |
| `documents.document.obsolete` | Obsolete Document Master Active | Nút **Obsolete** trên Document Detail |

### 3.2. Revision và file

| Mã Permission | Khi nào cần | Màn hình/nút được test |
|---|---|---|
| `documents.revision.upload_source` | Author upload source lần đầu | **Upload Revision** |
| `documents.revision.edit_metadata` | DCO sửa metadata revision | Revision Draft |
| `documents.revision.edit_online` | Author/Co-Author sửa file online | **Edit File Online** |
| `documents.revision.sync_office` | Đồng bộ Office Online | Nút sync Office nếu hiển thị |
| `documents.revision.download_source` | Tải source file | Download source |
| `documents.revision.preview` | Preview revision | Detail Revision, PDF preview |
| `documents.revision.complete_authoring` | Chỉ Author complete authoring | **Complete Authoring** tại Draft |
| `documents.revision.open_publishing_workspace` | DCO mở Publishing Workspace | **Open Publishing Workspace** |
| `documents.revision.generate_preview` | DCO tạo review package | **Regenerate Review Package** |
| `documents.revision.submit_review` | DCO submit revision | **Submit For Review** |
| `documents.revision.review` | Assigned Reviewer complete review | **Complete Review** |
| `documents.revision.reject_review` | Assigned Reviewer reject | **Reject** tại Review |
| `documents.revision.approve` | Assigned Approver approve | **Complete Approve** |
| `documents.revision.reject_approval` | Assigned Approver reject | **Reject** tại Approval |
| `documents.revision.complete_training` | DCO/Document Admin hoàn tất training | **Complete Training** |
| `documents.revision.publish` | DCO publish revision | **Publish** |
| `documents.revision.cancel` | Cancel revision đang xử lý | **Cancel** trên Detail Revision |
| `documents.revision.upgrade` | Tạo revision mới từ revision Effective | **Create/Upgrade Revision** |
| `documents.revision.obsolete` | Obsolete revision nếu policy cho phép | Action obsolete revision |

### 3.3. Controlled Copy

| Mã Permission | Khi nào cần |
|---|---|
| `documents.controlled_copy.request` | Request controlled copy từ revision Effective |
| `documents.controlled_copy.view` | Xem log/chi tiết controlled copy |
| `documents.controlled_copy.preview_file` | Preview file controlled copy |
| `documents.controlled_copy.download_file` | Tải controlled copy đã Distributed |
| `documents.controlled_copy.print` | In controlled copy |
| `documents.controlled_copy.approve_request` / `reject_request` | Approve hoặc Reject request |
| `documents.controlled_copy.prepare_distribution` | Chuẩn bị distribution |
| `documents.controlled_copy.distribute` | Distribute Copy/Batch |
| `documents.controlled_copy.recall` | Recall Copy/Batch |
| `documents.controlled_copy.report_lost_damaged` | Báo cáo lost/damaged |
| `documents.controlled_copy.replace_lost_damaged` | Cấp lại copy lost/damaged |
| `documents.controlled_copy.expire` | Expire copy |
| `documents.controlled_copy.destroy` / `confirm_destroy` | Destroy và xác nhận destruction |
| `documents.controlled_copy.cancel_request` | Cancel request/distribution trước khi phát hành |

---

## 4. Cách 1: tạo cấu hình bằng từng màn hình

Dùng cách này khi cần tạo Permission Set dùng chung hoặc cần kiểm soát rất cụ thể từng thành phần.

### 4.1. Tạo Permission Set

Lặp lại các bước sau cho từng Permission Set tại Mục 4.2.

1. Mở **Security & Authorization -> Permission Sets**.
2. Bấm **New Permission Set** ở góc phải phía trên.
3. Trong **Basic Information**:
   - Nhập **Name**.
   - Nhập **Code** theo quy ước nếu cần; để trống nếu hệ thống cho phép tự sinh.
   - Nhập **Description**, nên nêu trách nhiệm, phạm vi và mục đích UAT.
   - Tick **Active**.
4. Trong **Permissions**:
   - Dùng ô Search trong Permission Explorer, nhập đúng mã Permission ở Mục 3.
   - Tick checkbox tại từng dòng Permission.
   - Kiểm tra badge số Permission đã chọn. Hệ thống không cho Save nếu chưa chọn Permission nào.
5. Bấm **Save**.
6. Modal **Electronic Signature** hiện ra: xác thực chữ ký, điền lý do thay đổi, rồi xác nhận.
7. Khi toast thành công hiện ra, mở chi tiết Permission Set và kiểm tra số Permission.

Không sửa Permission Set có badge **System**; định nghĩa system record được khóa để bảo vệ cấu hình nền.

### 4.2. Năm Permission Set UAT cần tạo

| Tên | Code gợi ý | Permission cần tick |
|---|---|---|
| DCO Documents UAT | `PS-DOC-DCO` | `documents.module.view`, `documents.document.view`, `documents.document.create`, `documents.document.edit_metadata`, `documents.document.manage_relations`, `documents.document.view_audit`, `documents.revision.edit_metadata`, `documents.revision.open_publishing_workspace`, `documents.revision.generate_preview`, `documents.revision.submit_review`, `documents.revision.preview`, `documents.revision.complete_training`, `documents.revision.publish`, `documents.revision.cancel`, `documents.revision.upgrade`, `documents.document.cancel`, `documents.document.obsolete` |
| Author Documents UAT | `PS-DOC-AUTHOR` | `documents.module.view`, `documents.document.view`, `documents.revision.upload_source`, `documents.revision.edit_online`, `documents.revision.complete_authoring`, `documents.revision.preview`, `documents.revision.download_source` |
| Co-Author Documents UAT | `PS-DOC-COAUTHOR` | `documents.module.view`, `documents.document.view`, `documents.revision.edit_online`, `documents.revision.preview` |
| Reviewer Documents UAT | `PS-DOC-REVIEWER` | `documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.review`, `documents.revision.reject_review` |
| Approver Documents UAT | `PS-DOC-APPROVER` | `documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.approve`, `documents.revision.reject_approval` |

Kết quả mong đợi:

- Author không có `submit_review`; Author chỉ được **Complete Authoring**.
- Co-Author không có `upload_source` và `complete_authoring`; chỉ edit online/preview.
- Reviewer/Approver có Permission nhưng vẫn không thể xử lý revision bất kỳ nếu chưa được chỉ định trên chính Document Master.
- DCO không có `upload_source` và `complete_authoring`; DCO tạo/cấu hình document, đóng gói, submit và publish.

### 4.3. Tạo Access Profile (Role)

Lặp lại cho năm role tại Mục 4.4.

1. Mở **Security & Authorization -> Access Profiles**.
2. Bấm **New Access Profile**.
3. Tab **General**:
   - Nhập **Name** và **Description**.
   - Để role **Active**.
   - Chọn Business Unit Scope/Department Scope nếu role chỉ phục vụ một phạm vi. Scope mô tả phạm vi role; Object Access Rule mới là lớp lọc record chi tiết.
4. Bấm **Save** để tạo role trước, ký điện tử khi được yêu cầu.
5. Bấm **Edit**.
6. Tab **Permission Sets**: bấm nút gán Permission Set, chọn đúng set ở Mục 4.2, kiểm tra set xuất hiện trong Assigned.
7. Tab **Workflow Authorization**: chỉ gán Workflow Role theo Mục 4.4.
8. Bấm **Save** ở header, ký điện tử và kiểm tra toast thành công.
9. Tab **Audit Trail**: kiểm tra event create/assignment đã được lưu.

### 4.4. Năm Access Profile UAT cần tạo

| Access Profile | Permission Set cần gán | Workflow Role cần gán | Scope gợi ý |
|---|---|---|---|
| `ROLE-DOC-DCO` | `PS-DOC-DCO` | `DCO` | Quality / Quality Assurance |
| `ROLE-DOC-AUTHOR` | `PS-DOC-AUTHOR` | Không bắt buộc | Quality / Quality Assurance |
| `ROLE-DOC-COAUTHOR` | `PS-DOC-COAUTHOR` | Không bắt buộc | Quality / Quality Assurance |
| `ROLE-DOC-REVIEWER` | `PS-DOC-REVIEWER` | `DOCUMENT_REVIEWER` | Quality / Quality Assurance |
| `ROLE-DOC-APPROVER` | `PS-DOC-APPROVER` | `DOCUMENT_APPROVER` | Quality / Quality Assurance |

Nếu user có `documents.revision.review` nhưng không có Workflow Role phù hợp, user có thể không xuất hiện trong modal **Setup Reviewers**. Đây là lỗi cấu hình, không phải lỗi UI.

### 4.5. Tạo user và gán Access Profile

1. Mở **Security & Authorization -> User Management**.
2. Bấm **Add User**.
3. Điền các trường bắt buộc:
   - **Employee ID**, ví dụ `UAT-DC-001`.
   - **Full Name**.
   - **Username**, ví dụ `uat.dco`.
   - **Email** hợp lệ.
   - **Business Unit**: `Quality`.
   - **Department**: `Quality Assurance`.
   - **Position** phù hợp.
   - **Account Status**: `Active`.
   - **System Role**: chọn Access Profile tương ứng.
4. Bấm **Create User**. Credentials modal sẽ hiển thị username/password tạm thời; ghi nhận theo quy trình UAT của đơn vị.
5. Lặp lại cho năm user ở Mục 2.1.
6. Để gán thêm role cho user đã tồn tại: tìm user, mở **View/Edit Profile**, vào tab **Security & Authorization**, thêm Access Profile, sau đó **Save** và ký điện tử nếu được yêu cầu.
7. Yêu cầu user đăng xuất/đăng nhập lại trước khi test vì phiên đăng nhập cũ có thể chưa có tập quyền mới.

### 4.6. Gán user từ Access Profile

1. Mở **Access Profiles**, bấm role cần sửa.
2. Bấm **Edit**.
3. Mở tab **Assigned Users**.
4. Tìm username hoặc full name, chọn user để gán/bỏ gán.
5. Bấm **Save** ở header, ký điện tử.
6. Không gán Reviewer và Approver cho cùng một user trong bộ UAT chuẩn.

### 4.7. Thao tác trên các màn hình danh sách Security

#### Permission Sets

1. Mở **Permission Sets**, tìm bằng Search hoặc filter Status/Type.
2. Bấm row để xem Detail: kiểm tra Name, Code, Status, số Permission.
3. Bấm **Edit** để sửa Permission Set custom; bấm **Save** và ký điện tử.
4. Nếu cần bộ quyền gần giống, dùng menu **3 chấm -> Clone** nếu màn hình hiển thị; đổi Name/Code trước khi Save.
5. Không deactivate/delete set đang dùng trong role production nếu chưa có change control và đánh giá tác động.

#### Access Profiles

1. Mở **Access Profiles**, Search theo Name/Code.
2. Bấm row để mở Detail.
3. Kiểm tra lần lượt các tab: **General**, **Permission Sets**, **Workflow Authorization**, **Object Access**, **Assigned Users**, **Audit Trail**.
4. Muốn thay đổi: bấm **Edit**, chỉnh các tab, rồi bấm **Save** ở header. Các thay đổi assignment được lưu cùng một chữ ký điện tử.

#### User Management

1. Mở **User Management**, tìm theo Employee ID, Full Name, Username, Email hoặc filter Department/Status.
2. Dùng menu **3 chấm**:
   - **View Profile** để xem profile và Security & Authorization.
   - **Edit** để sửa profile/department/position/role theo quyền được cấp.
   - **Reset Password** khi user quên password.
   - **Suspend** để tạm khóa truy cập, nhập lý do/thời hạn nếu form yêu cầu.
   - **Terminate** khi nhân viên nghỉ việc, nhập lý do và ngày kết thúc.
3. Không xóa user đã có electronic signature; với GMP, suspend/terminate thường phù hợp hơn xóa lịch sử.

### 4.8. E-Sign Config

1. Mở **Security & Authorization -> E-Sign Config**.
2. Kiểm tra e-sign bắt buộc cho: Complete Authoring, Submit For Review, Complete Review, Reject, Complete Approve, Complete Training, Publish, Cancel, Obsolete và controlled-copy action quan trọng.
3. Kiểm tra meaning phù hợp, ví dụ `Prepared`, `Reviewed`, `Approved`.
4. Nếu sửa cấu hình, ghi change-control reference trong lý do/description, bấm Save và ký điện tử.
5. Thực hiện một action UAT để xác nhận đóng modal signature thì action không được hoàn tất.

---

## 5. Cách 2: tạo role bằng New Role (Wizard)

Dùng Wizard khi muốn tạo role, permission, workflow role, scope và user assignment trong một quy trình. Wizard tạo theo transaction; nếu bước cuối thất bại, không có role nửa chừng được lưu.

### 5.1. Cách vào Wizard

1. Mở **Security & Authorization -> Access Profiles**.
2. Bấm **New Role (Wizard)**.
3. Wizard có sáu bước: **Basic Info -> Permissions -> Workflow Role -> Scope -> Users -> Review & Create**.
4. Chỉ đi tiếp khi dữ liệu bắt buộc hợp lệ; có thể quay lại bước đã hoàn thành để sửa.

### 5.2. Ví dụ: tạo `ROLE-DOC-REVIEWER` bằng Wizard

1. **Basic Info**:
   - Name: `ROLE-DOC-REVIEWER-WIZARD`.
   - Description: `UAT role for assigned document revision review.`
   - Bấm **Next**.
2. **Permissions**:
   - Chọn **Pick individual permissions**.
   - Trong Permission Split Explorer, tìm và tick: `documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.review`, `documents.revision.reject_review`.
   - Kiểm tra thông báo Wizard sẽ tạo Permission Set managed gắn với role này.
   - Bấm **Next**.
3. **Workflow Role**: tick `DOCUMENT_REVIEWER`, bấm **Next**.
4. **Scope**: chọn Business Unit `Quality`, Department `Quality Assurance`, bấm **Next**.
5. **Users**: tìm `uat.reviewer`, tick user, bấm **Next**.
6. **Review & Create**: đối chiếu toàn bộ thông tin, bấm **Create Role**, điền e-sign reason `Create UAT reviewer role` và xác nhận.
7. Khi thành công, hệ thống chuyển tới Detail Access Profile. Kiểm tra tab **Permission Sets**, **Workflow Authorization**, **Assigned Users** để xác nhận ba liên kết đã được tạo.

### 5.3. Khi nào dùng Permission Set có sẵn trong Wizard

Tại bước **Permissions**, chọn **Use existing Permission Sets** khi Permission Set đã được QA phê duyệt và dùng chung cho nhiều role. Chọn **Pick individual permissions** khi bộ quyền chỉ phục vụ một role mới, để Wizard tạo Permission Set riêng và tránh tác động role hiện hữu.

### 5.4. Giới hạn của Wizard

Wizard không tự tạo Lifecycle Policy, Object Access Rule hoặc SoD constraint. Sau khi tạo role, vẫn phải kiểm tra ba lớp này trước khi đưa role vào sử dụng.

---

## 6. Lifecycle Policies: cấu hình luồng Documents

Mở **Security & Authorization -> Lifecycle Policies**. Có hai tab: **Transitions** và **Capabilities**.

### 6.1. Tab Transitions

Tab này quyết định action nào có thể đổi trạng thái. Dùng filter **Search**, **Workflow**, **Action**, **From Status**, **Document Type**, **Active**, **Type** để tìm policy.

| From status | Action UI | Required Permission | Actor scope |
|---|---|---|---|
| `DRAFT` | Complete Authoring | `documents.revision.complete_authoring` | `AUTHOR` |
| `DRAFT` | Open Publishing Workspace | `documents.revision.open_publishing_workspace` | `DCO` hoặc `DOCUMENT_ADMIN` |
| `DRAFT` | Submit For Review | `documents.revision.submit_review` | `DCO` hoặc `DOCUMENT_ADMIN` |
| `PENDING_REVIEW` | Complete Review | `documents.revision.review` | `ASSIGNED_REVIEWER` |
| `PENDING_REVIEW` | Reject | `documents.revision.reject_review` | `ASSIGNED_REVIEWER` |
| `PENDING_APPROVAL` | Complete Approve | `documents.revision.approve` | `ASSIGNED_APPROVER` |
| `PENDING_APPROVAL` | Reject | `documents.revision.reject_approval` | `ASSIGNED_APPROVER` |
| `PENDING_TRAINING` | Complete Training | `documents.revision.complete_training` | `DCO` hoặc `DOCUMENT_ADMIN` |
| `READY_FOR_PUBLISHING` | Publish | `documents.revision.publish` | `DCO` hoặc `DOCUMENT_ADMIN` |

Để kiểm tra policy:

1. Chọn tab **Transitions**.
2. Tìm action, ví dụ `Submit For Review`.
3. Kiểm tra cột **From Status**, **Permission**, **Actors**, **Active**.
4. Dùng menu **3 chấm -> Edit** chỉ với policy custom và user có quyền manage.
5. Không thay Required Permission bằng mã không tồn tại trong Permission Catalog.
6. Save, ký điện tử, sau đó dùng **Effective Lookup**.

### 6.2. Effective Lookup

1. Bấm **Effective Lookup** trên header tab Transitions.
2. Chọn workflow/object type, trạng thái hiện tại, Document Type nếu form có.
3. Chọn action cần kiểm tra, ví dụ `COMPLETE_REVIEW`.
4. Kiểm tra policy active có priority cao nhất, Required Permission và Actor Scope.
5. Nếu system policy và custom policy cùng match, policy priority cao hơn quyết định. Không tạo nhiều policy trùng nhau nếu không có mục tiêu rõ ràng.

### 6.3. Tab Capabilities

Capabilities kiểm soát view, preview, download tại mỗi trạng thái; chúng khác Transition vì không nhất thiết đổi trạng thái.

| Revision status | Capability | Actor scope gợi ý | Required Permission |
|---|---|---|---|
| `DRAFT` | Preview | Author, Co-Author, DCO, participant | `documents.revision.preview` |
| `PENDING_REVIEW` | Preview | Author, DCO, assigned reviewer | `documents.revision.preview` |
| `PENDING_APPROVAL` | Preview | Author, DCO, assigned approver | `documents.revision.preview` |
| `EFFECTIVE` | View/Preview/Download | User cùng Department theo Object Rule | Permission tương ứng |

Tạo capability custom:

1. Chọn tab **Capabilities**.
2. Bấm **New State Policy**.
3. Chọn Capability, Status, Document Type, Actor Scope, Required Permission, Priority, Active.
4. Nhập Description giải thích lý do GMP.
5. Bấm **Save**, ký điện tử.
6. Test với một user được phép và một user không được phép.

### 6.4. Workflow Roles

1. Bấm **Workflow Roles** ở header Lifecycle Policies.
2. Kiểm tra `DCO`, `DOCUMENT_REVIEWER`, `DOCUMENT_APPROVER` đang Active.
3. Khi tạo Workflow Role mới, đặt code ổn định và mô tả nghiệp vụ rõ ràng.
4. Không đổi code role đang được policy tham chiếu; hãy tạo role mới và thực hiện migration cấu hình theo change control.

---

## 7. Object Access Rules, SoD và Access Review

### 7.1. Object Access Rules: giới hạn theo Department

Mục tiêu UAT: user Quality Assurance xem/tải tài liệu Quality Assurance; user Department khác không xem/tải khi không được cấp quyền.

1. Mở **Security & Authorization -> Object Access Rules**.
2. Bấm **New Object Access Rule**.
3. Chọn module/object là Documents/Document Master hoặc Revision tùy form hiển thị.
4. Chọn Access Profile/actor áp dụng.
5. Chọn attribute điều kiện `department`, giá trị `Quality Assurance`.
6. Chọn effect `VIEW`, `PREVIEW`, `DOWNLOAD` theo chính sách.
7. Đặt Priority, Active, Description.
8. Bấm **Save**, ký điện tử.
9. Test bằng user cùng Department và user Department khác.

Scope của Access Profile mô tả phạm vi role; Object Access Rule là nơi thực thi lọc đối tượng chi tiết.

### 7.2. Segregation of Duties

Tối thiểu tạo/kiểm tra các rule sau:

| Rule | Vai trò/quyền A | Vai trò/quyền B | Kết quả mong đợi |
|---|---|---|---|
| Reviewer không là Approver | `documents.revision.review` | `documents.revision.approve` | Không gán cùng user hoặc backend chặn action xung đột |
| Author không là Approver | Author participant | Assigned Approver | Author không approve revision của chính mình |
| DCO không là Reviewer/Approver nếu SOP yêu cầu | `DCO` | Reviewer/Approver | Hệ thống chặn assignment conflict |

1. Mở **Segregation of Duties** -> **New Constraint**.
2. Nhập name, ví dụ `SOD-DOC-REVIEWER-APPROVER`.
3. Chọn hai Permission hoặc role xung đột theo form.
4. Chọn Active và enforcement level nếu có.
5. Save, ký điện tử.
6. Thử gán role xung đột cho cùng user hoặc chọn cùng user tại Reviewer/Approver modal. Kết quả đúng: hệ thống báo conflict và không lưu.

### 7.3. Access Review

1. Mở **Security & Authorization -> Access Review**.
2. Bấm **New Access Review**.
3. Nhập Name, Description, review period start/end, bấm **Create**.
4. Mở campaign vừa tạo, xem từng item: user, Access Profile, scope, reviewer.
5. Với từng item, chọn decision retain/revoke và nhập note khi cần.
6. Khi tất cả item có decision, bấm **Complete**, ký điện tử.
7. Kiểm tra Audit Trail của campaign và quyền user sau revoke.

---

## 8. Tạo Document Master: đăng nhập User A (DCO)

Đăng xuất tài khoản quản trị. Đăng nhập `uat.dco` rồi thực hiện.

### 8.1. General Information

1. Sidebar **Quality -> Document Control -> All Documents**.
2. Bấm **New Document**.
3. Tab **General Information**:
   - **Document Number** và **Created Time** read-only; hệ thống tự sinh sau khi lưu thành công.
   - **Opened by** phải hiển thị User A (DCO).
   - **Author***: chọn `uat.author`.
   - **Co-Author(s)**: chọn `uat.coauthor` để test đồng tác giả; không chọn Author trùng trong Co-Author.
   - **Business Unit***: `Quality`.
   - **Department**: `Quality Assurance`.
   - **Document Name***: ví dụ `UAT SOP - Document Lifecycle`.
   - **Title in Local Language**: tùy chọn.
   - **Is Template?**: không tick cho document UAT thường.
   - **Document Type***: chọn type active, ví dụ SOP.
   - **Sub-Type**: chọn nếu Document Type yêu cầu.
   - **Periodic Review Cycle (Months)***: ví dụ `12`.
   - **Periodic Review Notification (Days)***: ví dụ `30`.
   - **Language**, **Description***: điền giá trị hợp lệ.

### 8.2. Training Information

1. Bấm tab **Training Information**.
2. Để test nhanh không training: tắt **Requires Training?**, điền lý do bỏ qua nếu UI yêu cầu. Sau approval, revision đi thẳng `READY_FOR_PUBLISHING`.
3. Để test đủ training: bật **Requires Training?**, nhập **Training Period (Days)**, ví dụ `30`. Sau approval, revision đi `PENDING_TRAINING`.
4. Khuyến nghị tạo hai document riêng cho hai nhánh này.

### 8.3. Save & Proceed to Next Step

1. Bấm **Next Step** ở header.
2. Modal **Save & Proceed to Next Step?** hiện ra.
3. Kiểm tra lại dữ liệu, bấm **Save & Next**.
4. Kết quả đúng:
   - Document Master được lưu và không rỗng khi thoát vào lại.
   - General/Training Information chuyển read-only.
   - Nút **Select Related Document**, **Select Correlated Document**, **Reviewers**, **Approvers** xuất hiện.
   - Subtab **Document Revisions**, **Reviewers**, **Approvers**, **Controlled Copies**, **Related Documents**, **Correlated Documents** xuất hiện.

### 8.4. Related/Correlated Document

1. Bấm **Select Related Document**.
2. Tìm/tick document liên quan; document hiện tại không được xuất hiện để tránh self-reference.
3. Bấm nút xác nhận trong modal.
4. Lặp lại với **Select Correlated Document** nếu cần.
5. Mở subtab tương ứng, kiểm tra row đã hiển thị.

### 8.5. Reviewer và Approver

1. Bấm **Reviewers**.
2. Modal **Setup Reviewers** hiện ra; tìm `uat.reviewer` bằng tên, Employee ID, Position hoặc Department.
3. Tick user, kiểm tra card hiển thị đúng **Employee ID**, **Position**, **Department**.
4. Bấm **Update Reviewers (n)**.
5. Bấm **Approvers**, tìm/tick `uat.approver`, bấm **Update Approvers (n)**.
6. Kiểm tra subtab Reviewers và Approvers có đúng user, đúng thứ tự nếu có sequence.
7. Bấm **Save** ở header khi nút enable. Ký điện tử nếu modal hiện ra.

Không chọn DCO, Author hoặc Co-Author làm Reviewer/Approver trong bộ test chuẩn.

### 8.6. Kiểm tra persistence

1. Đăng xuất/đăng nhập lại User A.
2. Vào **Document Control -> All Documents**, tìm document vừa tạo.
3. Bấm Document Number hoặc menu **3 chấm -> Detail/Edit**.
4. Kiểm tra toàn bộ field General, Training, Reviewer, Approver và relationship vẫn còn dữ liệu.
5. Nếu field rỗng, không Save lại record; thực hiện Mục 13.4.

---

## 9. Tạo và hoàn tất Revision

### 9.1. User B (Author) upload source lần đầu

1. Đăng nhập `uat.author`.
2. Vào **Document Control -> All Documents** hoặc **Documents Owned By Me**.
3. Mở document mà User B được chỉ định làm Author.
4. Bấm **Upload Revision**. Nếu revision đã có, mở tab **Document Revisions** và vào revision Draft.
5. Trong modal **Upload Revision**, chọn file source hợp lệ, ví dụ `.docx`, sau đó bấm **OK**/Upload.
6. Kết quả: một Revision mới xuất hiện trong Document Revisions, trạng thái `DRAFT`.
7. Bấm Revision Number để vào màn hình tạo/sửa Revision.

### 9.2. Edit online: Author và Co-Author

1. Với User B, bấm **Upload to Office Online** nếu nút hiển thị và Office Online đã cấu hình.
2. Sau khi đồng bộ, bấm **Edit File Online**, sửa một dòng, lưu/đóng editor.
3. Quay lại EQMS, sync nếu nút sync hiển thị.
4. Đăng xuất; đăng nhập `uat.coauthor`, mở cùng revision.
5. Kiểm tra Co-Author bấm được **Edit File Online**.
6. Kiểm tra Co-Author không có **Upload Revision** và không có **Complete Authoring**.

### 9.3. Complete Authoring: chỉ User B

1. Đăng nhập lại `uat.author`.
2. Mở revision Draft đã có source file.
3. Bấm **Complete Authoring**.
4. Modal e-sign hiện ra với meaning `Prepared`.
5. Điền reason, ví dụ `Source content completed for review`, rồi xác nhận.
6. Kết quả: toast `Editing completed`; source được khóa để chuẩn bị publishing; workflow status vẫn `DRAFT` nhưng editing status đã completed.

### 9.4. Publishing Workspace và Submit: User A (DCO)

1. Đăng nhập `uat.dco`, mở Revision Draft đã Complete Authoring.
2. Bấm **Open Publishing Workspace**.
3. Chọn **Publishing Template** và **Publishing Layout** nếu có.
4. Kiểm tra page range Cover/Body/Header/Footer/Watermark nếu UI cho phép.
5. Bấm **Regenerate Review Package** khi cần, chờ preview ready. Không submit khi job báo `Queued`, `Processing` hoặc preview lỗi.
6. Bấm **Submit For Review**.
7. Điền e-sign reason và xác nhận.
8. Kết quả: Revision `DRAFT -> PENDING_REVIEW`; Reviewer được chỉ định nhận notification/task nếu notification đã cấu hình.

---

## 10. Review, Approve, Training và Publish

### 10.1. Review: User D

1. Đăng nhập `uat.reviewer`.
2. Vào **Document Control -> Document Revisions -> Pending My Review**, hoặc vào All Revisions, menu **3 chấm -> Review**.
3. Mở **Review Revision**, kiểm tra preview, Author, Reviewer và Audit Trail.
4. Test Reject trước:
   - Bấm **Reject**, điền reason/comment, ký điện tử.
   - Kết quả: Revision quay về `DRAFT`; Author/DCO sửa và submit lại.
5. Sau khi resubmit, mở lại revision Pending Review.
6. Bấm **Complete Review**, điền comment nếu cần, ký điện tử.
7. Kết quả: `PENDING_REVIEW -> PENDING_APPROVAL`.

Negative test: user có `documents.revision.review` nhưng không phải assigned reviewer không được complete/reject. Author/Co-Author không được review revision của chính mình.

### 10.2. Approve: User E

1. Đăng nhập `uat.approver`.
2. Vào **Document Control -> Document Revisions -> Pending My Approval**, hoặc menu **3 chấm -> Approve** từ All Revisions.
3. Mở **Approve Revision**.
4. Test Reject nếu cần: bấm **Reject**, điền reason, ký điện tử; kiểm tra trạng thái trả về theo policy active.
5. Sau khi Author/DCO sửa, submit và Reviewer review lại, mở lại revision Pending Approval.
6. Bấm **Complete Approve**, ký điện tử.
7. Kết quả:
   - Requires Training On: `PENDING_APPROVAL -> PENDING_TRAINING`.
   - Requires Training Off: `PENDING_APPROVAL -> READY_FOR_PUBLISHING`.

### 10.3. Complete Training: User A

Chỉ áp dụng với document có Requires Training On.

1. Đăng nhập `uat.dco`, tìm revision `PENDING_TRAINING`.
2. Mở Detail Revision/Training Revision.
3. Bấm **Complete Training**, ký điện tử.
4. Kết quả: `PENDING_TRAINING -> READY_FOR_PUBLISHING`.

Nếu nút không hiển thị, kiểm tra Permission `documents.revision.complete_training` và actor scope `DCO`/`DOCUMENT_ADMIN` trong Lifecycle Policy.

### 10.4. Publish: User A

1. Đăng nhập `uat.dco`, mở revision `READY_FOR_PUBLISHING`.
2. Bấm **Publish** trên header Detail Revision.
3. Kiểm tra preview PDF/package trước khi ký.
4. Ký điện tử, điền reason, xác nhận.
5. Kết quả:
   - Revision `READY_FOR_PUBLISHING -> EFFECTIVE`.
   - Document Master chuyển `ACTIVE` theo workflow.
   - File PDF chính thức có thể preview theo Capability/Object Access Rule.
   - Tab **Signatures** và **Audit Trail** có record tương ứng.

---

## 11. Controlled Copy, Cancel, Obsolete và Upgrade

### 11.1. Controlled Copy

Controlled Copy chỉ có bốn trạng thái riêng:

```text
READY_FOR_DISTRIBUTION -> DISTRIBUTED -> OBSOLETED -> CLOSED_CANCELLED
```

Không dùng trạng thái Document Master hoặc Revision để suy ra trạng thái Controlled Copy.

1. Đăng nhập user có `documents.controlled_copy.request`.
2. Mở revision `EFFECTIVE` -> bấm **Request Controlled Copy**.
3. Điền holder/location/số lượng theo form, gửi request.
4. User có `approve_request` mở **Document Control -> Controlled Copies**, mở record/batch, approve request.
5. User có `prepare_distribution` chuẩn bị phát hành.
6. User có `distribute` mở batch detail, bấm **Distribute Batch**, ký điện tử.
7. Kết quả: `READY_FOR_DISTRIBUTION -> DISTRIBUTED`.
8. Kiểm tra view/preview/download theo Permission, Capability và Object Rule.
9. Test recall bằng **Recall Batch Immediately**/`Recall Immediately`.
10. Test cancel trước phát hành bằng **Cancel Batch Distribution** hoặc **Cancel Distribution**; kết quả `CLOSED_CANCELLED`.

### 11.2. Cancel Document Master và Revision

Tạo document/revision riêng để test cancel, không dùng record sẽ publish.

1. Đăng nhập `uat.dco`, mở Document Master Draft hoặc record được policy cho phép.
2. Bấm **Cancel**, điền activity summary/reason, ký điện tử.
3. Kết quả: Document Master -> `CLOSED_CANCELLED`.
4. Mở revision Draft/Pending Review/Pending Approval, bấm **Cancel**, ký điện tử.
5. Kết quả: Revision -> `CLOSED_CANCELLED` hoặc label tương đương.

### 11.3. Obsolete Document Master

1. Dùng Document Master Active có revision Effective.
2. Đăng nhập `uat.dco`, mở Detail Document Master.
3. Bấm **Obsolete**, ký điện tử.
4. Kết quả: Document Master -> `OBSOLETED`; revision Effective liên quan -> `OBSOLETED` theo policy.

### 11.4. Upgrade Revision

1. Mở Document Master Active có revision Effective.
2. User có `documents.revision.upgrade` bấm **Create Revision** hoặc action Upgrade.
3. Hệ thống tạo revision Draft mới; không sửa trực tiếp revision Effective.
4. Lặp lại Mục 9 và 10 cho revision mới.

---

## 12. Bảng test case UAT

### 12.1. Positive test chính

| ID | Tài khoản | Thao tác | Kết quả mong đợi |
|---|---|---|---|
| DOC-01 | DCO | Tạo Document Master và Save & Next | Record lưu đầy đủ, General/Training read-only, setup participant được |
| DOC-02 | DCO | Chọn Author, Co-Author, Reviewer, Approver | Chỉ user hợp lệ hiện trong modal; Employee ID/Position/Department đúng |
| DOC-03 | Author | Upload Revision | Revision Draft được tạo |
| DOC-04 | Author | Edit File Online + Complete Authoring | Thành công, e-sign, editing bị khóa |
| DOC-05 | Co-Author | Edit File Online | Thành công; không upload/complete authoring |
| DOC-06 | DCO | Publishing Workspace + Submit | E-sign, revision -> Pending Review |
| DOC-07 | Assigned Reviewer | Complete Review | E-sign, revision -> Pending Approval |
| DOC-08 | Assigned Approver | Approve, không training | Revision -> Ready for Publishing |
| DOC-09 | DCO | Publish | Revision -> Effective, Master -> Active |
| DOC-10 | Assigned Approver | Approve, có training | Revision -> Pending Training |
| DOC-11 | DCO | Complete Training | Revision -> Ready for Publishing |
| DOC-12 | DCO | Obsolete Active Document Master | Master/revision Effective -> Obsoleted |
| DOC-13 | Controlled Copy officer | Distribute batch | Batch -> Distributed, có e-sign audit |

### 12.2. Negative/security test bắt buộc

| ID | Tài khoản | Thao tác bị cấm | Kết quả mong đợi |
|---|---|---|---|
| SEC-01 | Co-Author | Upload Revision lần đầu | Nút ẩn/disabled hoặc API từ chối |
| SEC-02 | Co-Author | Complete Authoring | Nút ẩn/disabled hoặc API từ chối |
| SEC-03 | Author | Submit For Review | Bị chặn; chỉ DCO submit |
| SEC-04 | Reviewer không được chỉ định | Review revision | Không complete/reject được |
| SEC-05 | Approver không được chỉ định | Approve revision | Không complete/reject được |
| SEC-06 | Author | Approve revision của chính mình | Bị chặn bởi SoD/participant policy |
| SEC-07 | User khác Department | Xem/tải document Quality Assurance | Bị lọc hoặc backend từ chối |
| SEC-08 | User không có `download_file` | Download controlled copy | Nút/API bị từ chối |
| SEC-09 | Bất kỳ user | Mở URL trực tiếp cho action không có quyền | Backend trả 403/denied |
| SEC-10 | DCO | Chọn document hiện tại làm Related/Correlated | Document hiện tại không xuất hiện trong modal |

### 12.3. Test Department scope

1. Tạo `uat.otherdept` ở Department khác, ví dụ `Production`.
2. Gán role Viewer Documents có `documents.module.view`, `documents.document.view`, `documents.revision.preview`, nhưng không có Object Access Rule cho Quality Assurance.
3. Đăng nhập user này, vào **All Documents**, tìm document UAT Quality Assurance.
4. Kết quả mong đợi: document không hiển thị hoặc mở/tải bị backend từ chối, theo chính sách đã cấu hình.
5. Gán Object Access Rule đã được phê duyệt, đăng nhập lại và kiểm tra kết quả thay đổi đúng ý định.

---

## 13. Xử lý sự cố khi test

### 13.1. User không thấy menu Documents

Kiểm tra lần lượt:

1. User có Access Profile Active.
2. Access Profile có Permission Set Active.
3. Permission Set có `documents.module.view`.
4. User đã đăng xuất/đăng nhập lại.
5. Backend có trả 403 tại `/documents/*` hay không.

### 13.2. Reviewer/Approver không xuất hiện trong modal

1. User target Active.
2. User target có Access Profile Active.
3. Permission Set có `documents.revision.review` hoặc `documents.revision.approve`.
4. Access Profile có `DOCUMENT_REVIEWER` hoặc `DOCUMENT_APPROVER`.
5. User target không phải Author/Co-Author của document.
6. User target không bị SoD conflict.
7. Scope/Object Rule không loại user khỏi lookup.

### 13.3. Nút workflow không hiển thị

Kiểm tra đồng thời:

1. Revision đúng **From Status** của policy.
2. User có Required Permission.
3. User đúng Actor Scope: Author, DCO, Assigned Reviewer hoặc Assigned Approver.
4. Lifecycle Policy Active và priority phù hợp.
5. Điều kiện nghiệp vụ đã đạt: có source file trước Complete Authoring; preview package ready trước Submit.

### 13.4. Mở lại Document Master mà field bị rỗng

Đây là lỗi nghiêm trọng về data integrity.

1. Ghi lại Document Number, Document ID trên URL, username, thời điểm và field đã nhập.
2. Mở **Audit Trail**, kiểm tra event create/save.
3. Kiểm tra response GET detail document trên Network: `author`, `businessUnit`, `department`, `documentName`, `type`, `reviewers`, `approvers`.
4. Nếu response API đã rỗng: lỗi backend/persistence.
5. Nếu API đủ dữ liệu nhưng form rỗng: lỗi frontend hydration/mapping.
6. Không Save lại record rỗng vì có thể ghi đè dữ liệu đúng. Tạo ticket kèm request/response đã che dữ liệu nhạy cảm.

### 13.5. Chữ ký điện tử thất bại

1. Kiểm tra username/password người thực hiện.
2. Kiểm tra reason và action title.
3. Kiểm tra user có Permission action; e-sign không thay thế Permission.
4. Kiểm tra trạng thái user Active/not locked và thời gian server.
5. Kiểm tra Audit Trail không ghi action thành công khi modal bị hủy hoặc API lỗi.

---

## 14. Checklist bàn giao UAT

### 14.1. Cấu hình

- [ ] Business Unit, Department, Position đã Active.
- [ ] Năm Permission Set UAT đã tạo và Active.
- [ ] Năm Access Profile đã tạo và Active.
- [ ] DCO/Reviewer/Approver có Workflow Role đúng.
- [ ] Năm user Active, đúng Department, đúng Access Profile.
- [ ] Lifecycle Policy cho Complete Authoring, Submit, Review, Approve, Training, Publish Active.
- [ ] Object Access Rules đã test với user cùng/khác Department.
- [ ] SoD đã test ít nhất Reviewer vs Approver và Author vs Approver.
- [ ] E-signature đã test thành công và có audit record.

### 14.2. Documents

- [ ] Document Master lưu đầy đủ sau Save & Next và sau khi đăng xuất/đăng nhập lại.
- [ ] Related/Correlated modal không hiện document hiện tại.
- [ ] Reviewer/Approver modal hiện Employee ID, Position, Department.
- [ ] Chỉ Author upload source lần đầu và Complete Authoring.
- [ ] Co-Author chỉ edit online/preview theo quyền.
- [ ] Chỉ DCO mở Publishing Workspace và Submit For Review.
- [ ] Chỉ assigned Reviewer review/reject.
- [ ] Chỉ assigned Approver approve/reject.
- [ ] Đã test Training On và Off.
- [ ] Publish tạo Revision Effective và Document Master Active.
- [ ] Đã test Cancel, Obsolete, Upgrade trên record riêng.
- [ ] Đã test Controlled Copy với bốn trạng thái riêng.

---

## 15. Thứ tự vận hành khuyến nghị sau UAT

1. Không đưa ngay Permission Set UAT vào production. Clone/tạo Permission Set production, bổ sung description, owner, change-control reference và ngày review.
2. Dùng Access Profile theo trách nhiệm nghiệp vụ, không tạo role theo tên từng cá nhân.
3. Chỉ gán Workflow Role cho role thực sự cần được chọn làm participant.
4. Thiết lập Object Access Rule theo Department trước khi cấp download.
5. Đặt Access Review định kỳ, rà soát role inactive và nhân viên chuyển Department.
6. Mọi thay đổi Permission Set, Access Profile, Lifecycle Policy, SoD hoặc Object Access Rule phải có change control, e-signature và bằng chứng test tương ứng.
