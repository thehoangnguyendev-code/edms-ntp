# Rà soát tên trường, cột và nhãn trong module Report

Ngày: 2026-11-15. Trạng thái: **ĐỀ XUẤT, chờ chủ hệ thống duyệt**. Chưa đổi tên nào trong mã hay DB.

## 1. Cách rà soát và phạm vi

- Nguồn dữ liệu: 697 dòng trong `report_definition_fields` trên DEV (243 tên khác nhau, 17 nguồn dữ liệu thật + các template thử), tên cột và nhãn trong màn hình Report (`features/report`, `features/report-analytics`), và các lớp `*ReportMetadataProvider` ở backend (nơi tên cột được định nghĩa bằng `column("mã", "Tên hiển thị", sql)`).
- Tôi đọc tên và đối chiếu với tên các cột đứng cạnh trong cùng nguồn. Với một số tên, tôi mở code kiểm tra ý nghĩa thật (đánh dấu **[đã kiểm code]**). Các dòng còn lại là **suy luận từ tên**, cần người hiểu nghiệp vụ xác nhận (đánh dấu **[cần xác nhận]**).
- Không đụng vào mã máy (`field_code`, `status`, ...). Chỉ đổi tên hiển thị.

## 2. Quy ước đặt tên đề xuất

| # | Quy ước | Ví dụ sai hôm nay | Sau khi sửa |
|---|---|---|---|
| R1 | Tên cột phải nói rõ **cái gì**: đối tượng + thuộc tính. Không dùng một từ trơ như `Status`, `Record`, `Kind`, `Reason`, `Group`, `State`. | `Status` (33 template) | `Document Status`, `Revision Status`, `Activity Status`... |
| R2 | Một ý, một tên, mọi nguồn. Một tên không được mang hai nghĩa trong cùng báo cáo. | `Created` và `Created At` cùng tồn tại | chỉ `Created At` |
| R3 | Thời điểm có giờ dùng `... At`; chỉ có ngày dùng `... Date`; tránh `... On`, và tránh danh từ trơ (`Obsoleted`, `Cancelled`) làm tên ngày. | `Obsoleted`, `Completed On`, `Completed At` | `Obsoleted At`, `Completed At` |
| R4 | Số đếm bắt đầu bằng `Number of`. | `Sessions`, `Participants`, `Passed` | `Number of Sessions`... |
| R5 | Cột Yes/No đặt tên như một câu hỏi trả lời được bằng Yes/No. | `Locked`, `Annual`, `Scheduled` | `Is Locked`, `Annual Retraining Required`, `Made By Schedule` |
| R6 | Người dùng gọi là `Full Name` (và `Username`), trừ cột audit gọi `Performed By`. Không luân phiên `User`, `Name`, `Person`, `Employee`, `Participant`, `Signer`, `Actor`. | 7 cách gọi | xem mục 3 |
| R7 | Chính tả Mỹ (`Organization`), Title Case ở đầu cột, nhất quán trên màn hình và trong file xuất. | `Organisation (External)`, `Run type` | `Organization (External)`, `Run Type` |

## 3. Tên trường trong template (theo nguồn dữ liệu)

Cột "Mã" là mã máy, giữ nguyên.

### 3.1 Tên dùng chung nhiều nguồn

| Tên hiện tại | Nguồn | Vì sao khó hiểu | Đề xuất |
|---|---|---|---|
| `Status` (33 template) | hầu hết | Không biết trạng thái của cái gì; trong nguồn có nhiều trạng thái (Training Participants có `State`, `Result`, `Activity Status`) | Gắn đối tượng: `Document Status`, `Revision Status`, `Copy Status`, `Activity Status`, `Assignment Status`, `Job Role Status`, `Share Link Status`, `Announcement Status`... **[cần xác nhận đối tượng từng nguồn]** |
| `Department` (36) | hầu hết | Trong nguồn tài liệu là phòng ban của tài liệu; trong Audit Trail/Auth là phòng ban của người dùng | `Document Department` ở nguồn tài liệu; `User Department` ở Audit, Auth, Signatures **[cần xác nhận]** |
| `Created` (12) và `Created At` (6) | Document, Copies, User Access | Hai tên cho một ý; `Created` không nói là ngày | `Created At` |
| `Last Updated` (11) và `Updated At` (1) | Document, Revisions, Announcements, User Access | Hai tên cho một ý | `Updated At` (và `Updated By`) |
| `Valid Until` (9) | Document, Revisions, Copies | Trong Controlled Copies đứng cạnh `Expiry` | xem 3.3 |
| `Reason` (5) | Audit, Backup, Uncontrolled Copies... | Lý do của việc gì | `Reason for Action` (Audit), `Reason for Backup/Restore`, `Reason for Copy Request` **[cần xác nhận]** |
| `Revision` (7) / `Current Revision` / `Document Revision` | Document, Copies, Training | Ba tên cho ý gần giống | `Revision` (của bản ghi), `Current Revision` (revision hiện hành của tài liệu); bỏ `Document Revision` (Training Records) thành `Revision` |

### 3.2 Document Status, Revisions, Copies

| Mã | Tên hiện tại | Đề xuất | Ghi chú |
|---|---|---|---|
| `isTemplate` | `Template Document` | `Document Template` | Dễ nhầm với "Report Template" của chính module này |
| `obsoletedAt`, `cancelledAt` | `Obsoleted`, `Cancelled` | `Obsoleted At`, `Cancelled At` | Đứng cạnh `Obsoleted By` nhưng không nói là ngày |
| `legacyImport` | `Legacy Import` | `Imported From Legacy System` (Yes/No) | Nhầm với cột kế bên |
| `legacyImportedAt` | `Legacy Imported` | `Legacy Import Date` | |
| `reviewDate` | `Next Periodic Review` | `Next Periodic Review Date` | |
| `reviewCycle` | `Periodic Review Cycle (Months)` | giữ | Tốt: có đơn vị |
| `daysToReview` | `Days To Review` | `Days Until Next Review` | |
| `requiresTraining` | `Training Required` | giữ cho Document (Yes/No) | Xem trùng tên ở 3.4 |
| `skipTrainingReason` | `Reason for Skipping Training` | giữ | |
| `titleLocal` | `Local-Language Title` | `Title (Local Language)` | |
| `copyNumber` (Controlled/Uncontrolled) | `Controlled Copy Number`, `Uncontrolled Copy Number` | giữ | |
| `validUntil`, `expiryDate` | `Valid Until`, `Expiry` | `Revision Valid Until` và `Copy Expires On` **[cần xác nhận]** | Hai ngày gần nghĩa trong cùng báo cáo. Code `validUntil` = `cc.valid_until`, `expiryDate` = `cc.expiry_date` **[đã kiểm code]**; ý nghĩa nghiệp vụ của từng ngày cần chủ nghiệp vụ xác nhận |
| `distributionMode` | `Distribution` | `Distribution Method` | |
| `downloadCount`, `printCount` | `Downloads`, `Prints` | `Number of Downloads`, `Number of Prints` | R4 |
| `status` (Revisions) | `Status` | `Revision Status` | R1 |
| `updatedAt` (Lifecycle) | `Updated At` | giữ | |

### 3.3 Training

| Mã | Tên hiện tại | Đề xuất | Ghi chú |
|---|---|---|---|
| `requirement` (Compliance, Matrix) | `Training Required` | `Required Training` | **Lỗi gây hiểu nhầm:** ở Compliance giá trị là tên yêu cầu (`x.title`) **[đã kiểm code]**, nhưng tên giống hệt cột Yes/No `Training Required` của Document |
| `annual` | `Annual` | `Annual Retraining Required` | Yes/No **[đã kiểm code]** |
| `position` (Compliance) | `Job Role` | giữ `Job Role`, nhưng mã đổi thành `jobRole` | Mã `position` đang chứa `position_name` nhưng nhãn là Job Role; xác nhận đúng dữ liệu **[cần xác nhận]** |
| `fullName` | `Employee` / `Participant` / `Person` | `Full Name` | R6 |
| `kind` | `Kind` | `Activity Kind` | |
| `kindReason` | `Reason for the Training` | `Reason for Training` | |
| `sessions`, `participants` | `Sessions`, `Participants` | `Number of Sessions`, `Number of Participants` | R4 |
| `attended`, `absent`, `passed`, `failed` | `Attended or Read`, `Absent`, `Passed`, `Failed` | `Number Attended or Read`, `Number Absent`, `Number Passed`, `Number Failed` | R4 |
| `participationRole` | `Participation` | `Participation Role` | |
| `state` | `State` | `Participant Status` | Cạnh `Result` và `Activity Status` |
| `organisation` | `Organisation (External)` | `Organization (External)` | R7 |
| `organizer` / `department` | `Organizing Department` | giữ | |
| `recordStatus` | `Record` | `Record Status` | Tên hiện tại không nói gì cả |
| `method`, `source` | `Method`, `Source` | `Completion Method`, `Record Source` | |
| `caseType` | `Case` | `Assignment Type` | Màn hình gọi là "Type" (Initial/Change) |
| `person` | `Person` | `Full Name` | R6 |
| `issueNo` | `Issue Number` | giữ | |
| `seniorManagement` | `Senior Management` | `Senior Management Role` | Yes/No |
| `holders` | `People Holding the Role` | `Current Holders` | |
| `matrix` | `Matrix` | `Matrix Name` | |
| `versionNo`, `versionStatus`, `currentVersion` | `Version`, `Version Status`, `Current Version` | `Matrix Version`, `Matrix Version Status`, `Current Matrix Version` | |
| `rowNo`, `rowGroup` | `Row`, `Group` | `Row Number`, `Matrix Row Group` | |
| `appliesTo` | `Applies To` | `Applies To Positions` **[cần xác nhận]** | |
| `locked` | `Locked` | `Is Locked` | R5 |
| `positionCount` | `Number of Positions` | giữ | |

### 3.4 Người dùng, truy cập, xác thực

| Mã | Tên hiện tại | Đề xuất | Ghi chú |
|---|---|---|---|
| `fullName` (User Access, Access Review) | `Name`, `User` | `Full Name` | R6 |
| `profileState` | `Access Profile` | `Access Profile Status` | Tên hiện tại trùng cách gọi `Access Profiles` (danh sách) |
| `mfa` | `Second Factor` | `Multi-Factor Authentication` | Thuật ngữ chuẩn |
| `mfaRequiredByAdmin` | `Second Factor Required by Admin` | `MFA Required by Administrator` | |
| `accountLockedAt`, `lockedUntil`, `accountLockReason` | `Account Locked At`, `Locked Until`, `Account Lock Reason` | giữ | |
| `suspendReason`, `suspendedUntil` | `Suspend Reason`, `Suspended Until` | `Suspension Reason`, `Suspended Until` | Khóa và tạm ngưng cần phân biệt rõ nghĩa **[cần xác nhận]** |
| `startDate` | `Start Date` | `Employment Start Date` | |
| `idNumber` | `Identity Number` | `National ID Number` | Trường nhạy cảm đã đánh dấu |
| `permissionCount` | `Permissions` | `Number of Permissions` | R4 |
| `superAdmin` | `Super Administrator` | `Is Super Administrator` | R5 |
| `failedLogins` | `Failed Sign-ins` | giữ | |

### 3.5 Audit, Backup, Report Runs, khác

| Mã | Tên hiện tại | Đề xuất | Ghi chú |
|---|---|---|---|
| `record` (Audit, Backup Activity) | `Record` | `Record Number` hoặc `Affected Record` **[cần xác nhận giá trị]** | Một từ trơ |
| `actor` (Audit Extract) | `Actor` | `Performed By` | R6, khớp Backup Runs |
| `entity` (Audit Extract) | `Entity` | `Affected Record` | |
| `fromStatus`, `toStatus` | `From Status`, `To Status` | `Status Before`, `Status After` | |
| `eSignature` | `Electronic Signature` | `Signed Electronically` | Yes/No |
| `reference` (Backup Runs) | `Reference` | `Run Reference` | |
| `kind` (Backup Runs) | `Kind` | `Run Kind` | |
| `status` (Backup Runs) | `Result` | giữ nghĩa, đổi `Run Result` | Mã là `status` nhưng nhãn là Result |
| `trigger` | `Triggered` | `Triggered By` | |
| `runType` | `Backup Type` | giữ | |
| `changeControl` | `Change Control` | `Change Control Number` | |
| `reportTitle` (Report Runs) | `Report` | `Report Name` | |
| `scheduled` | `Scheduled` | `Made By Schedule` | R5 |
| `fullRun` | `Full Run (No Filter)` | `Full Report (No Filter)` | Màn Create Report đã dùng "Full report (no filter)" |
| `reasonCode` | `Reason Code` | `Failure Reason Code` | |
| `requestType` | `Request Type` | giữ | |
| `method` (Signatures) | `Authentication` | `Authentication Method` | |
| `meaning` | `Meaning` | `Signature Meaning` | |
| `label` (Share Links) | `Link` | `Link Label` | |
| `state` (Share Links) | `State` | `Link Status` | |
| `scope` (Share Links) | `Shares` | `Shared Scope` | |
| `event` (Notification Delivery) | `Event` | `Notification Event` | |
| `domain` | `Module` | giữ | |
| `objectVersions` (Storage) | `Stored Object Versions` | `Stored File Versions` | |
| `enabled`, `version` (Announcements) | `Enabled`, `Version` | `Is Enabled`, `Announcement Version` | |

## 4. Nhãn và tiêu đề cột trên màn hình

| Màn / chỗ | Hiện tại | Vì sao | Đề xuất |
|---|---|---|---|
| Run History, Delivery Log, Legal Hold | `Run type`, `Report name`, `Hold placed by`, `Hold placed`, `Requested by` | Chữ hoa chữ thường khác phần còn lại của hệ thống (Title Case) | Title Case: `Run Type`, `Report Name`, `Hold Placed By`, `Hold Placed At`... (R7) |
| Run History | `Queued`, `Completed` | Không nói là thời điểm | `Queued At`, `Completed At` |
| Run History | `Reason` | Lý do của việc gì | `Failure Reason` (trang chi tiết đã dùng tên này) |
| Run History | `Template` cạnh `Template revision` | Dễ lẫn | `Template Name`, `Template Revision` |
| Report Library | `Category` | **Sửa lại nhận định ban đầu (sai):** `Category` không phải Report Type. Cột `Data Source` mới là Report Type (hiển thị nhãn của `sourceCode`); `Category` là phân loại nội bộ (`METADATA`/`DOCUMENT`) | Xem `REPORT_SCREEN_LABELS_RENAME_PLAN_2026_11_15.md` |
| Report Library | `Data Source` | Thuật ngữ kỹ thuật | `Report Source` hoặc giữ nếu người dùng hiểu **[cần xác nhận]** |
| Danh sách template | `GMP` (cột) và `Used for GMP decisions` (nhãn) | Hai cách gọi một ý | `Used for GMP Decisions` ở cả hai |
| Nhiều màn | `Modified Date`, `Last Updated`, `Last changed`, `Last Changed`, `Last Changed By` | Năm cách gọi một ý | `Last Updated`, `Last Updated By` (cùng R2) |
| Nhiều màn | `Output Formats`, `Output format`, `Output Format`, `Format Requested`, `Format` | Năm cách gọi | `Output Format` (và `Requested Output Format` cho báo cáo đã yêu cầu) |
| Nhiều màn | `Effective From`, `Effective Date`, `In Force Since`, `Effective` | Bốn cách gọi | `Effective From` |
| Nhiều màn | `Template Number`, `Template Name`, `Report Template`, `Report Templates`, `Template` | Gọi lẫn | `Template Number` (mã RPT.xxxx), `Template Name` |
| Cài đặt | `Most rows in a report file`, `Most rows in a report file run with Full`, `Most recipients of a schedule`, `Most groups shown` | Không rõ giới hạn của cái gì, đơn vị gì | `Maximum Rows per Report File`, `Maximum Rows per Full Report File`, `Maximum Recipients per Schedule`, `Maximum Groups Shown in a Chart` |
| Lịch | `Every`, `At minute`, `Day Of The Month` | Ngắn nhưng không có ngữ cảnh | giữ trong khung "Frequency" nếu đã có nhóm; cần xem lại khi làm màn lịch **[cần xác nhận]** |
| Lịch | `Cron Expression` | Người dùng quality không biết cron | ẩn dưới "Advanced" hoặc `Custom Schedule (Cron)` **[cần xác nhận]** |

## 5. Số liệu tóm tắt

- Số dòng đề xuất trong mục 3: 84 dòng (một dòng có thể gom nhiều template dùng cùng tên, nên số tên hiển thị bị ảnh hưởng nhiều hơn). Chưa đếm chính xác số trường trong 697 dòng sẽ đổi. Các nhóm: trùng một ý nhiều tên (R2), thiếu đối tượng (R1), Yes/No/đếm (R4, R5), người dùng (R6), chính tả và hoa thường (R7).
- Lỗi nghiêm trọng nhất (giá trị không khớp tên): `Training Required` ở Compliance/Matrix chứa tên yêu cầu nhưng trùng tên với cột Yes/No của Document **[đã kiểm code]**; `Record` ở Training Records là trạng thái; `Access Profile` là trạng thái chứ không phải profile.

## 6. Cách triển khai và rủi ro

1. Tên hiển thị trường được định nghĩa ở `*ReportMetadataProvider` (backend) và **sao chép vào `report_definition_fields.display_name`** khi tạo template. Đổi code thôi chưa đủ: cần một migration cập nhật `display_name` theo `(source, field_code)`. Migration chỉ đụng cột hiển thị, không đụng `field_code`.
2. **Báo cáo đã tạo** (file PDF/XLSX/CSV đã sinh) giữ nguyên tên cột cũ: chúng là bản ghi đã tạo và không được sửa ngầm. Hệ thống cần ghi rõ trong Decision Log rằng tên cột có thể khác giữa báo cáo cũ và mới.
3. **Template đã duyệt** ở trạng thái Effective: đổi tên hiển thị trong DB không qua revision mới. Cần quyết định: coi đây là thay đổi cấu hình không ảnh hưởng nội dung (chỉ nhãn), hay phải đi qua Upgrade + duyệt. **Đây là quyết định của bạn/QA, tôi không tự chọn.**
4. Bộ lọc dùng tên hiển thị để người dùng chọn cột nhưng lưu mã (`field_code`), nên lịch báo cáo và cấu hình đã lưu không bị vỡ. Kiểm tra lại trước khi đổi **[chưa kiểm cho từng nguồn]**.
5. Màn hình: sửa chuỗi trong `features/report*`, kèm cập nhật test tham chiếu tên cột.
6. Kiểm thử: test so sánh `field_code` trước/sau để bảo đảm chỉ nhãn đổi; test hiển thị cho từng nguồn; đối chiếu một báo cáo mẫu mỗi nguồn.

## 7. Cần bạn quyết định

1. Duyệt bảy quy ước R1–R7 (đặc biệt R3 về `At`/`Date`, và R1 về việc gắn đối tượng vào `Status`/`Department`).
2. Quyết định mục 6.3: đổi tên hiển thị của template đang Effective có cần revision mới không.
3. Với các dòng đánh dấu **[cần xác nhận]**: người hiểu nghiệp vụ xác nhận ý nghĩa trước khi đổi tên (đặc biệt `Valid Until`/`Expiry`, `Record`, `Department`, `Applies To`, khóa tài khoản và tạm ngưng).
