# Hướng Dẫn UAT Security & Authorization Cho Module Documents

> Phiên bản: 1.0
>
> Phạm vi: Security & Authorization, Document Master, Document Revision, Training và Controlled Copies.
>
> Mục tiêu: tạo bộ dữ liệu phân quyền độc lập, tạo user test và chạy được toàn bộ luồng tài liệu từ lúc tạo đến phát hành, phân phối Controlled Copy.

---

## 1. Nguyên tắc trước khi test

### 1.1. Bốn lớp cho phép một hành động

Một Permission đơn lẻ không đủ để user thao tác được. Với một nút workflow, hệ thống kiểm tra lần lượt:

```text
User đang Active
  -> Có Access Profile đang Active
    -> Access Profile có Permission phù hợp
      -> Lifecycle Policy cho phép action ở trạng thái hiện tại
        -> User đúng vai trò trên record (Author / Reviewer / Approver / DCO)
          -> User có quyền xem record theo Department / scope
            -> Không vi phạm SoD
              -> Yêu cầu chữ ký điện tử nếu action là action kiểm soát
```

Nếu một lớp không đạt, button có thể bị ẩn, disabled hoặc API trả lỗi `403`.

### 1.2. Quy ước bộ tài khoản UAT

Tạo các user riêng, không dùng chung một user cho hai vai trò xử lý của cùng một Revision.

| Ký hiệu | Username gợi ý | Vai trò nghiệp vụ | Mục đích test |
|---|---|---|---|
| UAT-DCO | `uat.dco` | DCO | Tạo Document Master, cấu hình participant, submit, training, publish, controlled copy |
| UAT-AUTHOR | `uat.author` | Author | Upload source, edit file online, Complete Authoring |
| UAT-COAUTHOR | `uat.coauthor` | Co-Author | Edit file online, xác nhận không upload/complete authoring |
| UAT-REVIEWER | `uat.reviewer` | Reviewer | Complete Review hoặc Reject Review khi được chỉ định |
| UAT-APPROVER | `uat.approver` | Approver | Complete Approval hoặc Reject Approval khi được chỉ định |
| UAT-READER | `uat.reader` | Reader | Xem/preview/download tài liệu hiệu lực của Department |

Trong hướng dẫn này, toàn bộ user dùng cùng:

- Business Unit: `Quality`
- Department: `Quality Assurance`

Việc dùng cùng Department giúp kiểm tra workflow trước. Test giới hạn Department thực hiện riêng ở Mục 12.

### 1.3. Trạng thái cần phân biệt

Không nhầm trạng thái của ba đối tượng sau:

| Đối tượng | Trạng thái chính dùng để test |
|---|---|
| Document Master | `Draft`, `Active`, `Obsoleted`, `Closed - Cancelled` |
| Revision | `Draft`, `Pending Review`, `Pending Approval`, `Pending Training`, `Ready for Publishing`, `Effective`, `Obsoleted`, `Closed - Cancelled` |
| Controlled Copy / Batch | `Ready for Distribution`, `Distributed`, `Obsoleted`, `Closed - Cancelled` |

---

## 2. Menu và màn hình cần dùng

Mở sidebar bên trái, chọn tab **Quality**.

| Mục sidebar | Màn hình | Route tham chiếu |
|---|---|---|
| Security & Authorization -> User Management | Tạo và kiểm tra user | `/settings/users` |
| Security & Authorization -> Access Profiles | Tạo/gán Role | `/security/access-profiles` |
| Security & Authorization -> Permission Sets | Tạo Permission Set dùng chung | `/security/permission-sets` |
| Security & Authorization -> Lifecycle Policies | Kiểm tra Transitions/Capabilities | `/security/lifecycle-policies` |
| Security & Authorization -> Segregation of Duties | Kiểm tra ràng buộc SoD | `/security/sod` |
| Document Control -> All Documents | Tạo và tìm Document Master | `/documents/all` |
| Document Control -> Documents Owned By Me | Tìm document/revision liên quan user đang đăng nhập | `/documents/owned` |
| Document Control -> Document Revisions -> All | Theo dõi Revision | `/documents/revisions/all` |
| Document Control -> Controlled Copies | Tạo, phê duyệt, phân phối controlled copy | `/documents/controlled-copies/all` |

---

## 3. Chuẩn bị dữ liệu nền

Thực hiện bằng System Administrator hoặc Security Administrator.

1. Mở **System Administration -> Dictionaries**.
2. Kiểm tra `Quality` trong Business Unit và `Quality Assurance` trong Department đang Active.
3. Kiểm tra có Position phù hợp: `DCO`, `QA Specialist`, `QA Manager`, `Document Controller`.
4. Mở **Security & Authorization -> Lifecycle Policies**.
5. Ở tab **Transitions**, kiểm tra các action của Revision đã có policy Active cho các trạng thái tương ứng:
   - `COMPLETE_AUTHORING` tại `Draft`.
   - `SUBMIT_REVIEW` tại `Draft` hoặc trạng thái mà quy trình cấu hình.
   - `COMPLETE_REVIEW` và `REJECT_REVIEW` tại `Pending Review`.
   - `COMPLETE_APPROVAL` và `REJECT_APPROVAL` tại `Pending Approval`.
   - `COMPLETE_TRAINING` tại `Pending Training`.
   - `PUBLISH` tại `Ready for Publishing`.
6. Nếu policy không có hoặc đang Inactive, không tạo policy ngẫu nhiên trong lúc UAT. Ghi nhận cấu hình hiện tại và sửa qua change control.

---

## 4. Tạo Permission Set dùng chung

### 4.1. Cách tạo một Permission Set

Lặp lại các bước này cho từng set ở Mục 4.2.

1. Vào **Security & Authorization -> Permission Sets**.
2. Bấm **New Permission Set** ở góc phải phía trên.
3. Nhập:
   - **Name**: tên dễ đọc, ví dụ `UAT Document Author`.
   - **Code**: ví dụ `PS_UAT_DOC_AUTHOR`.
   - **Description**: mô tả chức năng và chỉ dùng cho UAT.
   - **Active**: bật.
4. Trong Permission Explorer, dùng ô Search và tìm theo đúng **permission code**.
5. Tick từng permission cần thiết.
6. Kiểm tra số permission đã chọn trước khi lưu.
7. Bấm **Save**.
8. Trong modal Electronic Signature, nhập thông tin xác thực và lý do, ví dụ `Create UAT permission set`.
9. Bấm **Confirm/Sign**.
10. Khi có toast thành công, mở lại set vừa tạo và kiểm tra Name, Code, trạng thái Active và số permission.

> Không sửa Permission Set có badge **System**. Các set `ROLE_<code>` là managed set của Access Profile; chỉnh quyền trực tiếp của Role tại tab **Permissions**, không chỉnh set này từ màn hình Permission Sets.

### 4.2. Permission Set UAT đề xuất

| Permission Set | Code gợi ý | Permission cần chọn |
|---|---|---|
| DCO Documents | `PS_UAT_DOC_DCO` | `documents.module.view`, `documents.document.view`, `documents.document.create`, `documents.document.edit_metadata`, `documents.document.manage_relations`, `documents.document.view_audit`, `documents.document.cancel`, `documents.document.obsolete`, `documents.revision.edit_metadata`, `documents.revision.preview`, `documents.revision.open_publishing_workspace`, `documents.revision.generate_preview`, `documents.revision.submit_review`, `documents.revision.complete_training`, `documents.revision.publish`, `documents.revision.cancel`, `documents.revision.upgrade`, quyền controlled copy ở Mục 4.3 |
| Author Documents | `PS_UAT_DOC_AUTHOR` | `documents.module.view`, `documents.document.view`, `documents.revision.upload_source`, `documents.revision.edit_online`, `documents.revision.complete_authoring`, `documents.revision.preview`, `documents.revision.download_source` |
| Co-Author Documents | `PS_UAT_DOC_COAUTHOR` | `documents.module.view`, `documents.document.view`, `documents.revision.edit_online`, `documents.revision.preview` |
| Reviewer Documents | `PS_UAT_DOC_REVIEWER` | `documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.review`, `documents.revision.reject_review` |
| Approver Documents | `PS_UAT_DOC_APPROVER` | `documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.approve`, `documents.revision.reject_approval` |
| Reader Documents | `PS_UAT_DOC_READER` | `documents.module.view`, `documents.document.view`, `documents.revision.preview`, `documents.revision.download_source` nếu chính sách cho phép tải |

### 4.3. Permission Controlled Copy cho DCO

Thêm vào `PS_UAT_DOC_DCO` khi test Controlled Copy:

```text
documents.controlled_copy.request
documents.controlled_copy.view
documents.controlled_copy.preview_file
documents.controlled_copy.download_file
documents.controlled_copy.print
documents.controlled_copy.approve_request
documents.controlled_copy.reject_request
documents.controlled_copy.prepare_distribution
documents.controlled_copy.distribute
documents.controlled_copy.recall
documents.controlled_copy.report_lost_damaged
documents.controlled_copy.replace_lost_damaged
documents.controlled_copy.expire
documents.controlled_copy.destroy
documents.controlled_copy.confirm_destroy
documents.controlled_copy.cancel_request
```

---

## 5. Tạo Access Profile (Role)

### 5.1. Cách khuyến nghị: Guided Setup

1. Vào **Security & Authorization -> Access Profiles**.
2. Bấm **New** ở góc phải.
3. Chọn **Guided setup**.
4. Bước **Basic Info**:
   - Nhập Role Name, ví dụ `UAT Document Author`.
   - Nhập Description.
5. Bước **Permissions**:
   - Chọn **Use existing Permission Sets**.
   - Tìm và tick Permission Set tương ứng tại Mục 4.2.
6. Bước **Workflow Role**:
   - DCO: chọn `DCO`.
   - Reviewer: chọn `DOCUMENT_REVIEWER`.
   - Approver: chọn `DOCUMENT_APPROVER`.
   - Author, Co-Author, Reader: để trống nếu catalogue không yêu cầu role workflow.
7. Bước **Scope**:
   - Chọn Business Unit `Quality`.
   - Chọn Department `Quality Assurance`.
8. Bước **Users**: có thể để trống để tạo user sau, hoặc tick user đã tồn tại.
9. Bước **Review & Create**: kiểm tra toàn bộ thông tin.
10. Bấm **Create Role**.
11. Xác nhận Electronic Signature một lần. Toàn bộ role, set, workflow role, user assignment được tạo trong một giao dịch.

### 5.2. Sáu Access Profile UAT cần có

| Access Profile | Permission Set gán | Workflow Role gán |
|---|---|---|
| `UAT Document DCO` | `PS_UAT_DOC_DCO` | `DCO` |
| `UAT Document Author` | `PS_UAT_DOC_AUTHOR` | Không bắt buộc |
| `UAT Document Co-Author` | `PS_UAT_DOC_COAUTHOR` | Không bắt buộc |
| `UAT Document Reviewer` | `PS_UAT_DOC_REVIEWER` | `DOCUMENT_REVIEWER` |
| `UAT Document Approver` | `PS_UAT_DOC_APPROVER` | `DOCUMENT_APPROVER` |
| `UAT Document Reader` | `PS_UAT_DOC_READER` | Không bắt buộc |

### 5.3. Cách tạo thủ công khi cần cấu hình nâng cao

1. Ở **Access Profiles**, bấm **New -> Advanced setup**.
2. Tab **General**: nhập Name, Description, Active, Business Unit Scope và Department Scope.
3. Bấm **Save**, ký điện tử để tạo Role.
4. Bấm **Edit**.
5. Tab **Permissions**:
   - Chọn các quyền riêng chỉ dùng cho Role này.
   - Quyền có icon khóa là quyền từ Shared Permission Set; không bỏ tick tại đây.
6. Tab **Shared Sets (Advanced)**: gán các Permission Set đã tạo.
7. Tab **Workflow Authorization**: tick Workflow Role phù hợp.
8. Tab **Assigned Users**: gán user nếu đã tạo.
9. Bấm **Save** ở header và ký điện tử một lần.
10. Tab **Audit Trail**: xác nhận có event `ACCESS_PROFILE_CONFIGURATION_UPDATED`.

### 5.4. Kiểm tra quyền hiệu lực của Role

1. Tại Detail Access Profile, bấm **View Effective Access**.
2. Kiểm tra số Permission Set, Workflow Role và effective permission.
3. Nếu quyền cần test không xuất hiện, kiểm tra theo thứ tự:
   - Permission có nằm trong Permission Set không.
   - Permission Set có được gán vào Role không.
   - Role có đang Active không.
   - User có được gán Role không.

---

## 6. Tạo user và gán Access Profile

Lặp lại cho sáu tài khoản tại Mục 1.2.

1. Vào **Security & Authorization -> User Management**.
2. Bấm **Add User**.
3. Điền các trường bắt buộc: Employee ID, Full Name, Username, Email, Business Unit, Department, Position và Account Status = `Active`.
4. Tại **System Role/Access Profile**, chọn đúng Role UAT.
5. Bấm **Create User**.
6. Nếu Credentials modal hiện ra, ghi lại mật khẩu tạm theo quy trình UAT nội bộ.
7. Đăng xuất và đăng nhập lại bằng user vừa tạo.
8. Để kiểm tra user đã có đúng quyền, đăng nhập bằng Security Admin, mở user đó, vào tab **Security & Authorization**:
   - Xác nhận Access Profile đúng.
   - Xác nhận Workflow Role đúng nguồn Access Profile.
   - Xác nhận Permission Set đúng nguồn Access Profile.

### Gán thêm Role cho user đã tồn tại

1. Vào **Access Profiles**, mở Role cần gán.
2. Bấm **Edit**.
3. Mở tab **Assigned Users**.
4. Tìm theo username hoặc full name, tick user.
5. Bấm **Save** và ký điện tử.
6. Yêu cầu user logout/login lại trước khi UAT.

> Không gán `UAT Document Reviewer` và `UAT Document Approver` cho cùng một user trong bộ test chuẩn. Nếu SoD BLOCK được cấu hình, hệ thống phải chặn việc gán này.

---

## 7. Tạo Document Master và Revision đầu tiên

### 7.1. Đăng nhập UAT-DCO và tạo Document Master

1. Đăng nhập `uat.dco`.
2. Vào **Document Control -> All Documents**.
3. Bấm **New Document**.
4. Tab **General Information**:
   - **Author**: chọn `uat.author`.
   - **Co-Author(s)**: chọn `uat.coauthor` nếu test đồng tác giả.
   - Chọn Business Unit `Quality` và Department `Quality Assurance`.
   - Nhập Document Name, ví dụ `UAT SOP Document Lifecycle`.
   - Chọn Document Type và Sub-Type hợp lệ.
   - Nhập Periodic Review Cycle và Periodic Review Notification nếu trường được yêu cầu.
   - Chọn Language và nhập Description.
5. Tab **Training Information**:
   - Để **Requires Training** bật nếu muốn test nhánh `Pending Training`.
   - Nhập Training Period (Days), ví dụ `7`.
   - Nếu muốn test nhánh không đào tạo, tắt toggle và nhập lý do miễn training nếu UI yêu cầu.
6. Bấm **Next Step**.
7. Trong modal **Save & Proceed to Next Step?**, kiểm tra thông tin rồi bấm **Save & Next**.
8. Sau khi lưu thành công, màn hình hiển thị các button: **Select Related Document**, **Select Correlated Document**, **Reviewers**, **Approvers** và **Save**.
9. Bấm **Reviewers**:
   - Tìm `uat.reviewer`.
   - Kiểm tra dòng hiển thị Employee Code, Position và Department.
   - Tick user, bấm **Update Reviewers**.
10. Bấm **Approvers**:
    - Chọn `uat.approver`.
    - Bấm **Update Approvers**.
11. Tùy chọn: bấm **Select Related Document** hoặc **Select Correlated Document**, chọn một document khác. Document hiện tại không được xuất hiện trong danh sách.
12. Bấm **Save**. Các button cấu hình participant phải biến mất/readonly sau khi save thành công.
13. Kiểm tra Document Master chuyển sang `Active` khi Revision đầu tiên được upload theo quy trình.

### 7.2. Đăng nhập UAT-AUTHOR và upload Revision

1. Đăng xuất UAT-DCO, đăng nhập `uat.author`.
2. Vào **Document Control -> Documents Owned By Me** hoặc **All Documents**.
3. Tìm Document Master vừa tạo.
4. Mở menu **ba chấm** ở cột Action, chọn **Edit Document**.
5. Kiểm tra button **Upload Revision** xuất hiện cho Author.
6. Bấm **Upload Revision**.
7. Trong modal, chọn file nguồn hợp lệ, ví dụ `.docx` hoặc `.pdf` theo cấu hình hệ thống.
8. Bấm **OK/Upload**.
9. Mở subtab **Document Revisions**, kiểm tra Revision mới xuất hiện với trạng thái `Draft`.
10. Bấm Revision Number để vào màn hình Revision.

### 7.3. Kiểm tra Co-Author

1. Đăng nhập `uat.coauthor`.
2. Mở cùng Revision Draft.
3. Kiểm tra **Edit File Online** hiển thị nếu file/hệ thống Office Online hỗ trợ.
4. Kiểm tra **Upload Revision** và **Complete Authoring** không hiển thị hoặc bị disabled.
5. Nếu có thể edit file online, thực hiện thay đổi nhỏ, lưu và đóng file.

### 7.4. Author hoàn tất soạn thảo

1. Đăng nhập lại `uat.author`.
2. Mở Revision Draft.
3. Kiểm tra file đã upload và preview được.
4. Bấm **Complete Authoring**.
5. Nhập lý do nếu modal yêu cầu, xác nhận Electronic Signature.
6. Kiểm tra Revision vẫn chưa vào `Pending Review` nếu quy trình yêu cầu DCO submit.
7. Kiểm tra Author không có button **Submit For Review**.

---

## 8. Submit, Review và Approval

### 8.1. DCO submit Revision để review

1. Đăng nhập `uat.dco`.
2. Vào **Document Control -> Document Revisions -> All**.
3. Tìm Revision Draft đã Complete Authoring.
4. Mở Revision Detail hoặc **Publishing Workspace** nếu button hiển thị.
5. Kiểm tra reviewer và approver đã được cấu hình.
6. Bấm **Submit For Review**.
7. Xác nhận Electronic Signature.
8. Kết quả mong đợi: Revision chuyển `Pending Review`; Reviewer được chỉ định thấy revision trong danh sách review/pending review.

### 8.2. Reviewer hoàn tất review

1. Đăng nhập `uat.reviewer`.
2. Vào **Document Control -> Document Revisions -> Pending Review**.
3. Mở Revision cần review.
4. Kiểm tra Revision có trạng thái `Pending Review` và tên Reviewer hiện tại đúng.
5. Test pass:
   - Bấm **Complete Review**.
   - Nhập comment nếu cần.
   - Xác nhận Electronic Signature.
   - Kết quả: nếu là reviewer cuối cùng, Revision chuyển `Pending Approval`.
6. Test reject (thực hiện bằng revision UAT khác):
   - Bấm **Reject**.
   - Nhập lý do reject bắt buộc.
   - Ký điện tử.
   - Kiểm tra Revision quay lại trạng thái theo Lifecycle Policy, thường là `Draft`.

### 8.3. Approver hoàn tất approval

1. Đăng nhập `uat.approver`.
2. Vào **Document Control -> Document Revisions -> Pending Approval**.
3. Mở Revision.
4. Kiểm tra tên Approver đúng và button approval khả dụng.
5. Bấm **Complete Approval**.
6. Nhập comment/lý do nếu yêu cầu, xác nhận Electronic Signature.
7. Kết quả mong đợi:
   - Nếu Requires Training bật: Revision chuyển `Pending Training`.
   - Nếu Requires Training tắt: Revision chuyển `Ready for Publishing`.
8. Test reject bằng revision UAT khác: bấm **Reject**, nhập lý do, ký điện tử và xác nhận Revision quay về trạng thái policy quy định.

---

## 9. Training và Publish

### 9.1. Nhánh có đào tạo

1. Đăng nhập `uat.dco` khi Revision ở `Pending Training`.
2. Mở Revision Detail hoặc màn hình Training của Revision.
3. Kiểm tra Training Period và danh sách/điều kiện đào tạo.
4. Hoàn thành thao tác **Complete Training** theo UI.
5. Xác nhận Electronic Signature.
6. Kết quả: Revision chuyển `Ready for Publishing`.

### 9.2. DCO publish Revision

1. Đăng nhập `uat.dco`.
2. Mở Revision ở `Ready for Publishing`.
3. Nếu quy trình yêu cầu package preview, bấm **Open Publishing Workspace** hoặc **Regenerate Review Package** và chờ hoàn tất.
4. Bấm **Publish**.
5. Kiểm tra các trường ngày hiệu lực/valid until nếu form yêu cầu.
6. Xác nhận Electronic Signature.
7. Kết quả mong đợi:
   - Revision chuyển `Effective`.
   - Document Master là `Active`.
   - UAT Reader cùng Department xem/preview/download được theo Permission Set.

---

## 10. Test Controlled Copy

### 10.1. Tạo request

1. Đăng nhập `uat.dco` hoặc user có `documents.controlled_copy.request`.
2. Mở Revision `Effective` thuộc Document Master `Active`.
3. Bấm **Request Controlled Copy**.
4. Nhập recipient, location, quantity và các trường bắt buộc.
5. Bấm **Submit/Request**, xác nhận Electronic Signature.
6. Mở **Document Control -> Controlled Copies**.
7. Kiểm tra request/batch mới có trạng thái theo policy, thường là `Ready for Distribution` sau khi hoàn tất phê duyệt/chuẩn bị.

### 10.2. Phê duyệt và phân phối

1. Mở Controlled Copy hoặc Controlled Copy Batch.
2. Nếu có action **Approve Request**, dùng user có permission approve để bấm, nhập lý do và ký điện tử.
3. Khi ở `Ready for Distribution`, bấm **Distribute Copy** hoặc **Distribute Batch**.
4. Xác nhận Electronic Signature.
5. Kiểm tra trạng thái chuyển `Distributed`, có Distributed By và Distributed At.
6. Test preview/download/print bằng user được cấp quyền tương ứng.

### 10.3. Các test hậu phân phối

1. Trên copy `Distributed`, test **Recall** bằng user có quyền recall; ký điện tử và kiểm tra audit.
2. Test **Report Lost/Damaged**: nhập lý do, ký điện tử.
3. Test **Reissue Replacement Controlled Copy** khi policy cho phép.
4. Test **Destroy** và **Confirm Destruction** bằng các permission tương ứng.
5. Không dùng trạng thái Revision để đánh giá Controlled Copy: Controlled Copy chỉ dùng bốn trạng thái ở Mục 1.3.

---

## 11. Bộ test âm tính bắt buộc

| Case | Cách làm | Kết quả phải có |
|---|---|---|
| Co-Author upload source | Đăng nhập `uat.coauthor`, mở document | Không có/không bấm được Upload Revision |
| Co-Author Complete Authoring | Mở Revision Draft | Không có/không bấm được Complete Authoring |
| Author submit review | Đăng nhập `uat.author` sau Complete Authoring | Không có/không bấm được Submit For Review |
| Reviewer chưa được chỉ định | Tạo user có Role Reviewer nhưng không chọn trong modal Reviewers | Không thể Complete Review revision đó |
| Approver chưa được chỉ định | Tương tự Approvers | Không thể Complete Approval revision đó |
| Reviewer tự approve | Gán cùng user Reviewer và Approver hoặc thử approval trên revision đã review | Bị chặn bởi SoD hoặc actor policy |
| Reader ngoài Department | Tạo Reader ở Department khác | Không xem/tải document nếu rule Department đang áp dụng |
| Download bị tắt | Bỏ `documents.revision.download_source` khỏi Reader | Preview được nếu có quyền, Download bị chặn |
| Sai trạng thái | DCO thử Publish khi Revision `Draft` | Button disabled/ẩn hoặc API từ chối |
| Signature không hợp lệ | Nhập sai mật khẩu khi action workflow | Không đổi trạng thái, audit không ghi action thành công |

---

## 12. Test scope theo Department và quyền download

### 12.1. Department access

1. Tạo Department thứ hai, ví dụ `Production`.
2. Tạo `uat.reader.production`, gán Access Profile Reader có scope Production.
3. Đăng nhập user này, tìm Document thuộc Quality Assurance.
4. Kết quả phải theo Object Access Rule/policy đã cấu hình:
   - Nếu policy giới hạn Department: document không xuất hiện hoặc Detail trả `Access denied`.
   - Nếu policy không giới hạn: document có thể xem; ghi nhận đây là cấu hình cần điều chỉnh, không phải lỗi user.

### 12.2. Download là permission cấu hình riêng

Để test chính sách download:

1. Clone `PS_UAT_DOC_READER` thành `PS_UAT_DOC_READER_NO_DOWNLOAD`.
2. Bỏ `documents.revision.download_source`.
3. Tạo Access Profile Reader No Download, gán cho một user test.
4. User đó phải xem/preview được revision Effective nếu có `documents.revision.preview`, nhưng không tải source file.
5. Ghi lại kết quả vào UAT evidence.

---

## 13. Khi button không xuất hiện: quy trình chẩn đoán

1. Xác nhận user đang đăng nhập đúng tài khoản và đã logout/login sau khi được gán Role.
2. Mở **User Management -> User Detail -> Security & Authorization**:
   - Kiểm tra Access Profile đang Active.
   - Kiểm tra Permission Set và Workflow Role có đúng nguồn Access Profile.
3. Mở **Access Profile -> View Effective Access** để kiểm tra permission.
4. Mở **Lifecycle Policies -> Transitions** để kiểm tra action có policy Active ở status hiện tại.
5. Kiểm tra participant trên chính Document Master: Author, Reviewer, Approver.
6. Kiểm tra status của **Revision**, không chỉ status Document Master.
7. Kiểm tra Object Access Rule/Department scope.
8. Kiểm tra SoD constraint.
9. Nếu có quyền `security.effective_access.diagnose`, vào **Lifecycle Policies -> Transitions -> Diagnose Access**:
   - Chọn User.
   - Tìm và chọn Document Revision.
   - Chọn action cần kiểm tra.
   - Bấm **Diagnose**.
   - Đọc từng layer: State Policy, Permission, Actor.

---

## 14. Evidence cần lưu cho UAT/GMP

Với mỗi test pass/fail, lưu:

- Mã test case và ngày/giờ.
- Username thực hiện.
- Document Number và Revision Number.
- Trạng thái Document Master, Revision hoặc Controlled Copy trước/sau action.
- Screenshot button/action và kết quả.
- Audit Trail record và electronic signature record.
- Lý do nếu test fail hoặc có deviation.

Không xóa User/Role/Permission Set UAT trước khi evidence được phê duyệt. Sau UAT, deactivate thay vì delete nếu cần giữ traceability.
