# Hướng Dẫn Sử Dụng Security & Authorization

> Tài liệu dành cho System Administrator, QA Manager, DCO và người quản trị quyền. Tên menu, tab, button trong tài liệu giữ nguyên theo giao diện tiếng Anh của hệ thống.

## 1. Mục đích và nguyên tắc

`Security & Authorization` là nơi cấu hình **ai được làm gì, trên dữ liệu nào, ở trạng thái nào**. Hệ thống tách các cấu hình thành các lớp để dễ kiểm soát và đáp ứng yêu cầu truy vết của EU-GMP:

| Thành phần | Trả lời câu hỏi | Ví dụ |
|---|---|---|
| Permission Set | Người dùng được phép thực hiện chức năng nào? | `documents.revision.review` |
| Access Profile | Nhóm quyền nào được cấp cho một nhóm người dùng? | QA Reviewer |
| Workflow Role | Người giữ Access Profile có thể được chọn làm vai trò nào trong workflow? | Reviewer, Approver, DCO |
| Lifecycle Policy | Trong trạng thái nào, ai được thực hiện action hoặc truy cập revision? | Reviewer được Review khi revision Pending Review |
| Object Access Rule | Phạm vi dữ liệu nào được cho phép hoặc từ chối? | Chỉ xem SOP thuộc QA |
| SoD Constraint | Hai quyền nào không được cùng cấp cho một user? | Không vừa Create vừa Approve cùng một workflow |
| Access Review | Ai xác nhận, sửa hoặc thu hồi quyền định kỳ? | Q3 Access Review |

### Nguyên tắc bắt buộc

1. Không cấp quyền trực tiếp bằng cách sửa database hoặc gọi API thủ công.
2. Dùng **Access Profile** để cấp quyền cho user; chỉ tạo Permission Set khi chưa có nhóm quyền phù hợp.
3. Chỉ dùng **Workflow Role** cho vai trò workflow thực tế. Quyền chỉ xem hoặc báo cáo không cần Workflow Role.
4. Kiểm tra **SoD** trước khi gán user vào Access Profile.
5. Cấu hình thay đổi quyền quan trọng yêu cầu **electronic signature**. Người ký phải nhập thông tin xác nhận trong modal trước khi thao tác được lưu.
6. Không sửa hoặc xóa bản ghi có nhãn `System` trừ khi UI cho phép. Ưu tiên tạo bản ghi `Custom` hoặc `Override` để giữ baseline hệ thống và audit trail rõ ràng.

## 2. Điều kiện trước khi thao tác

### 2.1. Quyền truy cập cần có

Người quản trị chỉ thấy và sử dụng được menu/button phù hợp với Permission Set đang được cấp. Các quyền chính gồm:

- `security.access_profiles.view/manage`: xem và quản lý Access Profiles.
- `security.permission_sets.view/manage`: xem và quản lý Permission Sets.
- `security.workflow_authorization.view/manage`: xem và quản lý Lifecycle Policies, Workflow Roles.
- `security.object_rules.view/manage`: xem và quản lý Object Access Rules.
- `security.sod.view/manage`: xem và quản lý Segregation of Duties.
- `security.access_review.view/manage`: xem và thực hiện Access Review.

Nếu button bị ẩn hoặc disabled, không dùng user khác để “lách” thao tác. Hãy yêu cầu quản trị viên cấp đúng quyền quản trị hoặc thực hiện thay đổi theo quy trình đã phê duyệt.

### 2.2. Chuẩn bị thông tin

Trước khi tạo một role/quyền mới, chuẩn bị:

1. Tên role dễ hiểu, ví dụ `QA Document Reviewer`.
2. Mục đích nghiệp vụ và bộ phận/Business Unit áp dụng.
3. Danh sách hành động thật sự cần thiết, theo nguyên tắc least privilege.
4. User cần được cấp role, nếu có.
5. Vai trò workflow cần dùng, nếu role phải được chọn làm Reviewer, Approver, DCO hoặc workflow participant khác.
6. Xung đột SoD cần tránh.

## 3. Cách vào module và nhận biết màn hình

1. Đăng nhập bằng user có quyền quản trị bảo mật.
2. Trên sidebar, mở **Security & Authorization**.
3. Các menu chính gồm:
   - **Access Profiles**: tạo và quản lý role để cấp cho user.
   - **Permission Sets**: quản lý danh mục quyền chi tiết.
   - **Lifecycle Policies**: quản lý Transitions, Capabilities và Workflow Roles.
   - **Object Access Rules**: giới hạn truy cập theo đối tượng/phạm vi.
   - **Segregation of Duties**: thiết lập các cặp quyền không tương thích và Document Workflow Rules.
   - **Access Review**: tạo và hoàn tất đợt rà soát quyền định kỳ.
4. Dùng breadcrumb ở đầu trang hoặc button **Back/Cancel** để quay lại. Không dùng nút Back của trình duyệt khi đang có thay đổi chưa lưu.

## 4. Luồng khuyến nghị: Tạo role bằng Wizard

### 4.1. Khi nào dùng Wizard

Dùng Wizard cho trường hợp thông thường: cần tạo một role hoàn chỉnh và có thể gán user ngay. Wizard liên kết sẵn Access Profile, Permission Set, Workflow Role, scope và user nên hạn chế sót bước.

Không dùng Wizard khi chỉ cần:

- bổ sung một quyền vào Permission Set đang tồn tại;
- sửa phạm vi truy cập cho Access Profile đang dùng;
- tạo policy đặc biệt theo trạng thái workflow;
- tạo quy tắc SoD hoặc Object Access Rule.

### 4.2. Mở Wizard

1. Vào **Security & Authorization → Access Profiles**.
2. Ở góc phải màn hình, nhấn button **New**.
3. Trong menu vừa mở, chọn **Role (Wizard)**.
4. Màn hình **New Role** mở ra với thanh bước: `Basic Info → Permissions → Workflow Role → Scope → Users → Review & Create`.
5. Button **Cancel** quay về danh sách Access Profiles. Khi chưa bấm **Create Role**, Wizard chưa lưu bất kỳ dữ liệu nào.

### 4.3. Bước 1: Basic Info

1. Trong trường **Role Name \***, nhập tên role. Tên phải khác các Access Profile đang tồn tại.
2. Trong **Description**, mô tả trách nhiệm nghiệp vụ. Nên ghi rõ module, phạm vi, điều không được phép làm.
3. Nhấn **Next**.
4. Nếu tên trống hoặc đã tồn tại, Wizard không cho sang bước tiếp theo. Đổi sang tên duy nhất rồi tiếp tục.

Ví dụ:

- Role Name: `QA Document Reviewer`
- Description: `Reviews assigned QA document revisions. Cannot approve or publish documents.`

### 4.4. Bước 2: Permissions

Mục tiêu của bước này là xác định role có thể thao tác chức năng nào.

#### Cách A: Chọn Permission Set có sẵn

1. Giữ lựa chọn **Existing permission sets**.
2. Nhập từ khóa vào ô **Search permission sets...** để tìm theo tên/mô tả.
3. Tick checkbox bên trái mỗi Permission Set cần dùng.
4. Quan sát badge số lượng đã chọn.
5. Phải chọn ít nhất một Permission Set mới được nhấn **Next**.

Chọn cách này khi quyền cần dùng đã được chuẩn hóa, ví dụ `Document Reviewer` hoặc `DCO`.

#### Cách B: Chọn từng permission

1. Nhấn **Custom permissions**.
2. Permission Explorer hiển thị quyền theo module và nhóm chức năng.
3. Mở module cần thiết, sau đó tick từng action thật sự cần thiết.
4. Kiểm tra số quyền đã chọn; phải có ít nhất một quyền để đi tiếp.
5. Nhấn **Next**.

Chọn cách này chỉ khi không có Permission Set phù hợp. Sau khi role được tạo, Wizard sẽ tạo/lưu Permission Set tương ứng để role có thể tái sử dụng và kiểm soát được.

### 4.5. Bước 3: Workflow Role

1. Đọc câu hỏi **Can this role be assigned as a workflow participant?**
2. Tick một hoặc nhiều Workflow Role khi người giữ role này phải được chọn trong workflow, ví dụ `DOCUMENT_REVIEWER`, `DOCUMENT_APPROVER`, `DCO`.
3. Không tick gì nếu role chỉ dùng để xem dữ liệu, báo cáo hoặc quản trị cấu hình không liên quan participant workflow.
4. Nhấn **Next**.

Lưu ý: Workflow Role không tự cấp quyền. User vẫn cần Permission Set phù hợp và phải thỏa các Lifecycle Policy khi action thực tế diễn ra.

### 4.6. Bước 4: Scope

1. Trong **Business Unit Scope**, chọn một hoặc nhiều Business Unit nếu role chỉ áp dụng cho các đơn vị đó.
2. Trong **Department Scope**, chọn một hoặc nhiều Department nếu role chỉ áp dụng cho các phòng ban đó.
3. Để trống cả hai trường nếu role dùng toàn hệ thống.
4. Nhấn **Next**.

Scope tại đây mô tả phạm vi tổ chức của role. Quy tắc allow/deny dữ liệu chi tiết vẫn phải cấu hình tại **Object Access Rules**.

### 4.7. Bước 5: Users

1. Dùng ô **Search users...** để tìm user theo tên, email hoặc thông tin hiển thị.
2. Tick user sẽ nhận role ngay sau khi tạo.
3. Bước này là tùy chọn; có thể bỏ qua và gán user sau tại tab **Assigned Users** của Access Profile.
4. Nhấn **Next**.

Khi có user được chọn, hệ thống kiểm tra SoD cho từng user. Nếu một user có xung đột quyền, Wizard chặn toàn bộ batch. Hãy bỏ user xung đột, hoặc xử lý SoD theo quy trình được phê duyệt trước khi tạo lại.

### 4.8. Bước 6: Review & Create

1. Đọc lại các phần **Role**, **Permissions**, **Workflow Roles**, **Scope** và **Initial Users**.
2. Nếu cần sửa, nhấn tên của một bước trước đó trên stepper hoặc button **Back**.
3. Nhấn **Create Role**.
4. Modal electronic signature xuất hiện. Kiểm tra action và lý do, nhập thông tin xác nhận theo yêu cầu, rồi xác nhận ký.
5. Hệ thống tạo toàn bộ cấu hình trong một batch. Nếu bất kỳ bước nào thất bại, hệ thống không tạo dữ liệu dở dang.
6. Khi thành công, hệ thống chuyển đến **Access Profile Detail** vừa tạo.

## 5. Luồng tạo thủ công

Luồng thủ công phù hợp với quản trị viên cần kiểm soát từng thành phần riêng, hoặc điều chỉnh cấu hình đang hoạt động. Thứ tự an toàn là:

1. Tạo/kiểm tra Permission Set.
2. Tạo Access Profile và gắn Permission Set.
3. Gắn Workflow Role nếu cần.
4. Gán user.
5. Tạo Object Access Rule, Lifecycle Policy hoặc SoD nếu yêu cầu nghiệp vụ cần thêm điều kiện.
6. Kiểm tra Effective Access và thực hiện Access Review theo lịch.

## 6. Permission Sets

### 6.1. Mục đích

Permission Set là tập các permission code có thể tái sử dụng. Không nên tạo một Permission Set cho mỗi user. Hãy tạo theo trách nhiệm ổn định, ví dụ `Document Author`, `QA Reviewer`, `Training Coordinator`.

### 6.2. Tạo Permission Set

1. Vào **Security & Authorization → Permission Sets**.
2. Nhấn **New Permission Set**.
3. Tại phần **Basic Information**:
   - Nhập **Name \***.
   - Nhập **Code** khi tạo mới, nếu UI cho phép. Mã nên ổn định, viết hoa, dùng `_`, ví dụ `QA_DOCUMENT_REVIEWER`.
   - Nhập **Description**.
   - Bật **Active** nếu Permission Set được phép cấp ngay.
4. Tại phần **Permissions**, dùng Permission Explorer:
   - Chọn module ở panel/module list.
   - Mở resource hoặc màn hình cần cấp.
   - Tick action cần cho phép.
   - Không tick quyền quản trị, delete, approve hoặc export nếu không có yêu cầu nghiệp vụ rõ ràng.
5. Nhấn **Save**.
6. Ký điện tử trong modal **Permission Set Change**.
7. Sau khi lưu thành công, hệ thống mở trang **Detail Permission Set**.

### 6.3. Kiểm tra và bảo trì Permission Set

1. Từ danh sách, click vào hàng Permission Set hoặc menu ba chấm để chọn **View**.
2. Trong trang chi tiết, xem các tab:
   - **Overview**: thông tin cơ bản và danh sách permission.
   - **Assigned Access Profiles**: các Access Profile đang sử dụng Permission Set.
   - **Audit Trail**: lịch sử thay đổi.
3. Nhấn **Edit** để sửa. Với record System bị khóa, tạo bản sao hoặc dùng cơ chế override được UI cho phép thay vì sửa trực tiếp.
4. Menu ba chấm có thể cung cấp **Clone**, **Enable/Disable**, **Delete** tùy quyền và trạng thái bản ghi.
5. Mọi thao tác thay đổi trạng thái, clone, sửa hoặc xóa đều cần ký điện tử.

## 7. Access Profiles

### 7.1. Tạo Access Profile thủ công

1. Vào **Security & Authorization → Access Profiles**.
2. Nhấn **New** ở góc phải.
3. Chọn **Access Profile**.
4. Màn hình chi tiết profile mới mở ở trạng thái chỉnh sửa.
5. Tab **General**:
   - Nhập **Name \***.
   - Nhập **Description**.
   - Chọn **Business Unit Scope** và **Department Scope** nếu áp dụng; để trống nghĩa là toàn hệ thống.
   - Chọn trạng thái Active nếu cần.
6. Tab **Permission Sets**:
   - Chọn Permission Set từ danh sách **Available Permission Sets**.
   - Chuyển sang **Assigned Permission Sets** bằng action add/assign trên UI.
   - Click một Permission Set để xem preview; không cần rời màn hình để kiểm tra quyền bên trong.
7. Tab **Workflow Authorization**:
   - Chọn Workflow Role từ danh sách available.
   - Gán role workflow cần thiết vào profile.
8. Tab **Object Access**:
   - Kiểm tra scope tổ chức của profile.
   - Nhấn liên kết **Object Access Rules** nếu cần tạo hoặc kiểm tra rule allow/deny liên quan.
9. Tab **Assigned Users**:
   - Chọn user từ danh sách available.
   - Gán vào danh sách assigned.
10. Nhấn **Save** ở đầu trang.
11. Ký điện tử trong modal **Access Profile Change**.

Lưu ý: Thay đổi ở các tab được gom lại và chỉ được áp dụng sau khi nhấn **Save**. Nếu thấy cảnh báo unsaved assignment changes, không rời trang; hãy Save hoặc Cancel để tránh hiểu nhầm trạng thái.

### 7.2. Sửa, kiểm tra hoặc gỡ Access Profile

1. Trong danh sách Access Profiles, dùng **Search**, **Type**, **Status**, date range và **Clear Filters** để tìm profile.
2. Click vào hàng để mở chi tiết.
3. Dùng **Effective Access** để kiểm tra quyền hiệu lực tổng hợp của profile trước khi cấp user.
4. Nhấn **Edit**, sửa các tab cần thiết, sau đó **Save** và ký điện tử.
5. Dùng action **Disable** khi muốn dừng cấp quyền mà vẫn giữ lịch sử. Chỉ dùng **Delete** khi profile không còn được sử dụng và quy trình cho phép xóa.
6. Kiểm tra tab **Audit Trail** trước và sau mỗi thay đổi quan trọng.

## 8. Lifecycle Policies

Vào **Security & Authorization → Lifecycle Policies**. Màn hình có hai tab:

- **Transitions**: quy định ai được thực hiện action chuyển trạng thái workflow.
- **Capabilities**: quy định ai được view, preview hoặc download revision tại trạng thái cụ thể.

### 8.1. Tab Transitions

#### Tạo Transition Policy

1. Chọn tab **Transitions**.
2. Nhấn **New Policy**.
3. Trong **Policy Definition**, chọn theo thứ tự:
   - **Module \***.
   - **Workflow \***.
   - **Object Type** nếu workflow yêu cầu.
   - **Action \***, ví dụ Submit, Review, Approve, Cancel.
   - **From Status \***. Nếu action chỉ có một trạng thái nguồn, hệ thống tự chọn.
   - **Document Type** nếu rule chỉ áp dụng cho một loại tài liệu; để global nếu rule áp dụng mọi type.
4. Chọn **Required Permission \***. Đây là permission mà user phải có trước khi policy được xét.
5. Thiết lập **Priority**, trạng thái **Active**, **Description**. Khi edit, nhập **Change Reason** nếu UI yêu cầu/quy trình yêu cầu.
6. Trong phần **Actors**, thêm ít nhất một actor. Actor có thể là loại participant/role phù hợp với action, ví dụ Author, Reviewer, Approver, DCO hoặc workflow role được hệ thống cho phép.
7. Nhấn **Save**.
8. Với policy sửa/override, hệ thống có thể mở **Preview Changes**. Kiểm tra thay đổi, nhấn xác nhận, rồi ký điện tử.

#### Override và duplicate

1. Tại bảng Transitions, mở menu ba chấm của policy.
2. Chọn **Create Override** khi cần một rule riêng cho Document Type mà không làm thay đổi rule Global/System.
3. Chọn **Duplicate** khi cần tạo policy gần giống một rule hiện có.
4. Chọn **View / Edit** để xem hoặc chỉnh rule; các field định danh của System/override có thể readonly để tránh phá logic lifecycle.
5. Dùng **Activate/Deactivate** thay vì delete nếu muốn tạm ngưng policy có audit history.

#### Các button hỗ trợ

- **Workflow Roles**: mở danh mục workflow role có thể dùng khi khai báo actor.
- **Effective Lookup**: tra policy thực tế áp dụng cho workflow/action/trạng thái/type cụ thể. Dùng trước khi báo lỗi “user không thấy button” hoặc “user không thực hiện được action”.
- **Refresh**: tải lại bảng sau thay đổi.

### 8.2. Tab Capabilities

Capability policy kiểm soát **truy cập revision**, tách biệt với quyền chuyển trạng thái.

#### Tạo State Policy

1. Chọn tab **Capabilities**.
2. Nhấn **New State Policy**.
3. Tại **Policy Definition**, chọn:
   - **Capability \***: hành động truy cập revision, ví dụ view, preview hoặc download theo danh mục có sẵn.
   - **Revision Status**: trạng thái revision; chọn `Any status` nếu áp dụng mọi trạng thái.
   - **Document Type**: chọn loại tài liệu nếu rule chỉ dành cho type đó; để `All types` nếu global.
   - **Actor Scope \***: nhóm người dùng được xét, ví dụ `ANY` hoặc participant/author theo danh mục UI.
   - **Required Permission**: permission bổ sung phải có, nếu cần.
   - **Priority**, **Active**, **Description** và **Change Reason** khi chỉnh sửa.
4. Nhấn **Save**.
5. Ký điện tử cho thay đổi Lifecycle State Policy.

Quy tắc capability có tính cộng dồn: quyền được cho phép khi có ít nhất một policy active khớp với user, trạng thái và đối tượng. Vì vậy cần tránh tạo rule `ANY` quá rộng cho các trạng thái nhạy cảm.

### 8.3. Workflow Roles

1. Từ tab **Transitions**, nhấn **Workflow Roles**.
2. Kiểm tra các role code và mô tả có sẵn.
3. Chỉ thêm role mới khi đã xác định rõ role này sẽ được dùng trong participant selector hoặc policy actor.
4. Sau khi role tồn tại, gắn role đó vào Access Profile qua tab **Workflow Authorization** hoặc ở bước 3 của Wizard.

## 9. Object Access Rules

Object Access Rule dùng để tạo điều kiện allow/deny dựa trên resource, hành động và scope. Đây là lớp lọc dữ liệu bên cạnh Permission Set.

### 9.1. Tạo rule

1. Vào **Security & Authorization → Object Access Rules**.
2. Nhấn **New Rule**.
3. Trong **Rule Definition**:
   - Nhập **Name \***, ví dụ `Allow QA Department SOP View`.
   - Nhập **Description** giải thích mục đích.
   - Chọn **Resource Type**.
   - Chọn **Resource Name** nếu UI yêu cầu/cho phép khoanh vùng resource cụ thể.
   - Tick các **Actions** rule này tác động, ví dụ View, Download, Edit.
   - Chọn **Effect**: `Allow` hoặc `Deny`.
   - Nhập priority theo thứ tự áp dụng nếu có nhiều rule cùng khớp.
   - Bật **Active** khi rule sẵn sàng áp dụng.
4. Nhấn **Save** và ký điện tử với loại thay đổi `Security Configuration Change`.

### 9.2. Nguyên tắc cấu hình

1. Dùng `Allow` để cấp phạm vi nghiệp vụ rõ ràng.
2. Dùng `Deny` thận trọng cho ngoại lệ bắt buộc; ghi mô tả đủ rõ để audit.
3. Không tạo hai rule mâu thuẫn cùng priority cho cùng resource/action/scope.
4. Sau khi tạo, quay về Access Profile → **Object Access** để đối chiếu scope tổ chức và rule liên quan.

## 10. Segregation of Duties (SoD)

### 10.1. Constraint Rules

SoD ngăn một user được cấp đồng thời hai quyền xung đột. Điều này hỗ trợ nguyên tắc phân tách nhiệm vụ trong môi trường GMP.

#### Tạo SoD Constraint

1. Vào **Security & Authorization → Segregation of Duties**.
2. Mặc định mở tab **Constraint Rules**.
3. Nhấn **New Constraint**.
4. Nhập **Name \*** và mô tả lý do xung đột.
5. Chọn **Permission A \*** và **Permission B \*** từ danh mục, ví dụ create revision và approve revision.
6. Chọn **Severity** theo mức độ rủi ro hệ thống cung cấp.
7. Nhập **Compliance Reference** khi cần, ví dụ tham chiếu EU-GMP/21 CFR hoặc SOP nội bộ.
8. Nhấn **Save** và ký điện tử với `SoD Rule Change`.

Khi gán Access Profile cho user qua Wizard hoặc Assigned Users, hệ thống kiểm tra SoD. Nếu bị chặn, không tự bỏ qua; hãy rà lại hai permission hoặc dùng quy trình quản lý ngoại lệ đã được phê duyệt.

### 10.2. Document Workflow Rules

1. Trong **Segregation of Duties**, chọn tab **Document Workflow Rules**.
2. Nhấn **Edit** ở đầu trang.
3. Chỉnh các quy tắc document workflow được hiển thị.
4. Dùng **Reset** để bỏ các thay đổi chưa lưu và trả về giá trị đã lưu.
5. Nhấn **Save** khi đã kiểm tra. Modal ký điện tử xuất hiện với danh sách thay đổi.
6. Chỉ nhấn **Cancel** khi muốn thoát chế độ edit và không lưu.

## 11. Access Review

Access Review tạo snapshot quyền hiện hữu để người có thẩm quyền rà soát định kỳ. Không dùng màn hình này để thay thế quy trình cấp quyền ban đầu.

### 11.1. Tạo campaign

1. Vào **Security & Authorization → Access Review**.
2. Nhấn **New Access Review Campaign**.
3. Trong **Campaign Details**:
   - Nhập **Campaign Name \***, ví dụ `Q3 2026 Periodic Access Review`.
   - Chọn **Review Period Start**.
   - Chọn **Review Period End**.
4. Nhấn **Create**.
5. Hệ thống tạo campaign và snapshot quyền cần review.

### 11.2. Review từng user

1. Trong danh sách campaign, click vào campaign đang `IN_PROGRESS`.
2. Bảng hiển thị user, Access Profiles, permissions, flags và decision.
3. Click action của một user để mở quyết định.
4. Chọn một trong các quyết định:
   - **Confirm**: quyền hiện tại vẫn phù hợp.
   - **Modify**: cần điều chỉnh quyền; ghi ghi chú rõ thay đổi cần làm.
   - **Revoke**: quyền không còn phù hợp; ghi lý do.
5. Xác nhận quyết định trong modal.
6. Lặp lại đến khi `Pending` bằng 0.

### 11.3. Hoàn tất hoặc hủy campaign

1. Chỉ khi không còn item pending, button **Complete & Sign** mới khả dụng.
2. Nhấn **Complete & Sign**, kiểm tra tên campaign, rồi ký điện tử.
3. Campaign chuyển sang `COMPLETED` và giữ lịch sử review.
4. Chỉ dùng **Cancel Campaign** khi campaign được tạo sai hoặc không thể tiếp tục. Hủy là thao tác không thể hoàn tác và không thay thế quyết định review từng user.

## 12. User Management và gán quyền cho user

User Management nằm trong cùng feature và là nơi kiểm tra user đã được gán profile nào.

### 12.1. Tạo user

1. Vào **Security & Authorization → User Management**.
2. Nhấn **Add New User**.
3. Lần lượt hoàn thiện các phần:
   - **Personal Information**: thông tin định danh cơ bản.
   - **Education & Professional Background**: thông tin chuyên môn khi áp dụng.
   - **Work & Professional Profile**: vị trí, department, Business Unit.
   - **Account & Access Control**: thông tin account và Access Profile theo UI cho phép.
4. Nhấn **Create User** và thực hiện các xác nhận được yêu cầu.

### 12.2. Gán hoặc kiểm tra Access Profile của user

1. Tìm user trong **User Management**.
2. Mở hồ sơ user.
3. Chọn tab **Security & Authorization**.
4. Kiểm tra các phần:
   - **Access Profiles**: role được gán.
   - **Permission Sets**: quyền được kế thừa.
   - **Workflow Roles**: khả năng được chọn trong workflow.
   - **Object Access**: phạm vi dữ liệu liên quan.
   - **Security Status**: trạng thái bảo mật/tài khoản.
5. Để gán hoặc tháo profile có kiểm soát tốt nhất, mở Access Profile tương ứng → tab **Assigned Users**, thay đổi danh sách rồi **Save** và ký điện tử.

## 13. Checklist kiểm tra trước khi cấp quyền

1. Role có tên, mô tả và owner nghiệp vụ rõ ràng.
2. Permission Set chỉ chứa quyền cần thiết, không cấp quyền admin/approve mặc định.
3. Workflow Role chỉ được gán khi user thực sự có thể là participant.
4. Department/Business Unit scope phù hợp với user và chức trách.
5. Object Access Rule đã kiểm tra allow/deny và priority.
6. Không có SoD conflict giữa quyền mới và quyền user đang có.
7. Lifecycle Transition Policy có đúng action, From Status, required permission và actor.
8. Lifecycle Capability Policy không mở view/download quá rộng ở trạng thái nhạy cảm.
9. Đã ký điện tử và kiểm tra Audit Trail sau khi lưu.
10. Với thay đổi diện rộng, tạo Access Review campaign hoặc kiểm tra Effective Access trước khi áp dụng production.

## 14. Xử lý tình huống thường gặp

| Tình huống | Cách kiểm tra/xử lý |
|---|---|
| User không thấy menu hoặc button | Kiểm tra Access Profile → Permission Sets → permission code tương ứng; sau đó kiểm tra trạng thái user/profile. |
| User có permission nhưng không Review/Approve được | Kiểm tra user có được chỉ định participant không, Workflow Role, Transition Policy, From Status và SoD. |
| User không xem/download được revision | Kiểm tra Capability Policy theo revision status, Actor Scope, Object Access Rules và scope Department/Business Unit. |
| Wizard không tạo được role | Kiểm tra Role Name có trùng không, đã chọn ít nhất một permission/set chưa, và user được chọn có SoD conflict không. |
| Không sửa được policy/system record | Kiểm tra record có nhãn System; tạo Override hoặc Duplicate/Custom policy thay vì sửa trực tiếp. |
| Không hoàn tất Access Review | Mở campaign, xử lý toàn bộ item còn Pending trước, sau đó dùng Complete & Sign. |
| Không thấy button quản trị | User hiện tại thiếu permission `security.*.manage`; yêu cầu quản trị viên cấp role phù hợp. |

## 15. Luồng mẫu an toàn: QA Document Reviewer

1. Kiểm tra Permission Set `Document Reviewer` đã có quyền xem revision và review action cần thiết.
2. Nếu chưa có, tạo Permission Set mới theo mục 6.
3. Dùng **Access Profiles → New → Role (Wizard)**.
4. Basic Info: nhập `QA Document Reviewer`.
5. Permissions: chọn Permission Set `Document Reviewer`.
6. Workflow Role: chọn role reviewer tương ứng.
7. Scope: chọn QA Department nếu role chỉ dùng cho QA.
8. Users: chọn các QA staff được phê duyệt.
9. Review & Create: kiểm tra, nhấn Create Role, ký điện tử.
10. Vào **Lifecycle Policies → Transitions** để xác nhận policy Review yêu cầu đúng permission và actor reviewer.
11. Vào **Lifecycle Policies → Capabilities** để xác nhận reviewer được preview/view revision ở Pending Review theo chính sách.
12. Vào **Segregation of Duties** để bảo đảm reviewer không nhận permission approve bị cấm.
13. Mở một user thử nghiệm, kiểm tra tab Security & Authorization và test theo workflow document được phê duyệt.

---

## Phụ lục: Quy tắc đặt tên khuyến nghị

- Access Profile: `<Department> <Business Responsibility>`, ví dụ `QA Document Reviewer`.
- Permission Set code: `<MODULE>_<RESPONSIBILITY>`, ví dụ `DOCUMENT_REVIEWER`.
- Object Access Rule: `<Effect> <Scope> <Resource> <Action>`, ví dụ `Allow QA SOP View`.
- SoD Constraint: `<Permission A> vs <Permission B>`, ví dụ `Create Revision vs Approve Revision`.
- Access Review: `<Quarter/Period> <Year> Periodic Access Review`, ví dụ `Q3 2026 Periodic Access Review`.

Tài liệu này mô tả UI và logic hiện có của module. Mọi thay đổi chính sách quyền phải tuân theo SOP quản lý user access, change control và electronic signature của tổ chức.
