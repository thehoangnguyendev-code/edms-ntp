# ĐẶC TẢ API EQMS

Cập nhật từ mã nguồn front-end hiện tại vào ngày 30/05/2026.

Tài liệu này được suy luận từ:
- route hiện có trong dự án
- view / tab / drawer / modal / workflow screen
- pattern tìm kiếm, select, upload, download, export
- pattern chuyển trạng thái và phê duyệt
- cấu trúc type trong `src/features/*` và `src/types/*`

Mục tiêu của tài liệu:
- làm khung triển khai back-end
- liệt kê đầy đủ các API cần có
- chỉ ra payload, filter, trạng thái, file flow, workflow action
- giúp đội back-end biết nên ưu tiên build phần nào trước

Lưu ý:
- đây không phải file OpenAPI chính thức
- nhiều endpoint là “đề xuất chuẩn hóa” để tránh back-end bị phân mảnh
- một số module ngoài `documents`, `training`, `settings` hiện front-end còn là mock/list screen, nhưng vẫn nên chuẩn bị API CRUD + workflow + export để tránh phải đổi contract sau này

---

## 1. Phạm vi hệ thống

Các module đã xuất hiện trong front-end:

- Xác thực
- Dashboard
- My Tasks
- Notifications
- Documents
- Training
- Deviations
- CAPA
- Change Control
- Complaints
- Equipment
- Supplier
- Product
- Regulatory
- Risk Management
- Audit Trail
- Reports
- Settings
- Preferences
- Help / User Manual

---

## 2. Quy ước API chung

### 2.1 Base URL

- `GET /api/...`
- `POST /api/...`
- `PUT /api/...`
- `PATCH /api/...`
- `DELETE /api/...`

Khuyến nghị versioning:

- `GET /api/v1/...`

### 2.2 Chuẩn xác thực

Khuyến nghị hỗ trợ:

- `Bearer access token`
- refresh token
- session timeout
- MFA / 2FA

Các API mutation nên yêu cầu:

- user đang đăng nhập
- quyền thao tác theo role / permission
- ghi audit trail

Các thao tác GMP/GxP cần e-signature:

- submit
- review
- approve
- reject
- publish / effective
- obsolete / archive / destroy
- reset password quản trị
- terminate / suspend user

### 2.3 Chuẩn phân trang / sort / filter

Query tối thiểu cho list API:

- `page`
- `limit`
- `sortBy`
- `sortOrder=asc|desc`
- `search`

Query mở rộng:

- `status`
- `type`
- `priority`
- `departmentId`
- `businessUnitId`
- `ownerId`
- `reviewerId`
- `approverId`
- `fromDate`
- `toDate`
- `scope`
- `tab`

Response chuẩn:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  },
  "filters": {
    "applied": {}
  }
}
```

### 2.4 Chuẩn detail response

```json
{
  "data": {}
}
```

### 2.5 Chuẩn mutation response

```json
{
  "message": "Thành công",
  "data": {},
  "auditId": "AUD-2026-000123"
}
```

### 2.6 Chuẩn options / select response

```json
{
  "data": [
    {
      "value": "uuid-or-code",
      "label": "Tên hiển thị",
      "code": "QA",
      "meta": {}
    }
  ]
}
```

### 2.7 Chuẩn lỗi

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": [
      {
        "field": "documentNumber",
        "message": "Số tài liệu đã tồn tại"
      }
    ]
  }
}
```

### 2.8 Chuẩn upload / download

Upload:

- dùng `multipart/form-data`
- hỗ trợ `single`, `multiple`, `temporary upload`
- hỗ trợ metadata file
- hỗ trợ chunk upload nếu file lớn

Download:

- download trực tiếp cho file nhỏ
- với export lớn nên trả `jobId`, sau đó polling

### 2.9 Chuẩn workflow / chuyển trạng thái

Không khuyến nghị:

- `PUT /:id { status: "Approved" }`

Nên dùng:

- `POST /:id/submit`
- `POST /:id/review`
- `POST /:id/approve`
- `POST /:id/reject`
- `POST /:id/publish`
- `POST /:id/obsolete`
- `POST /:id/archive`
- `POST /:id/restore`

Lý do:

- rõ intent nghiệp vụ
- dễ audit
- dễ kiểm soát state machine
- dễ gắn e-signature

---

## 3. API nền tảng dùng chung toàn hệ thống

## 3.1 Xác thực / phiên làm việc

### Bắt buộc

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/force-password-change`
- `POST /api/auth/mfa/setup`
- `POST /api/auth/mfa/verify`
- `POST /api/auth/mfa/disable`
- `POST /api/auth/2fa/verify`

### Payload gợi ý

`POST /api/auth/login`

```json
{
  "username": "qa.admin",
  "password": "******",
  "rememberMe": true
}
```

`GET /api/auth/me` nên trả:

- `id`
- `username`
- `fullName`
- `email`
- `role`
- `permissions`
- `department`
- `position`
- `avatarUrl`
- `mustChangePassword`
- `mfaEnabled`
- `sessionExpiresAt`

## 3.2 Tìm kiếm toàn cục

Header search và nhiều search box trong app cần:

- `GET /api/search`
- `GET /api/search/suggestions`
- `GET /api/search/recent`
- `DELETE /api/search/recent/:id`

Query:

- `q`
- `module`
- `limit`
- `scope`

Nhóm kết quả nên hỗ trợ:

- documents
- revisions
- controlled copies
- training courses
- training materials
- users
- deviations
- capa
- complaints
- change controls
- equipment
- suppliers
- products
- regulatory
- risks
- reports

Response gợi ý:

```json
{
  "data": [
    {
      "id": "doc-001",
      "module": "documents",
      "type": "document",
      "title": "SOP-QA-015",
      "subtitle": "Quality Assurance Procedures",
      "status": "Effective",
      "url": "/documents/doc-001"
    }
  ]
}
```

## 3.3 API select / lookup / autocomplete

Các màn hình trong dự án dùng rất nhiều select và lookup. Cần tách riêng khỏi list API.

### Nhóm options chung

- `GET /api/options/users`
- `GET /api/options/roles`
- `GET /api/options/departments`
- `GET /api/options/business-units`
- `GET /api/options/positions`
- `GET /api/options/document-types`
- `GET /api/options/document-subtypes`
- `GET /api/options/retention-policies`
- `GET /api/options/storage-locations`
- `GET /api/options/course-types`
- `GET /api/options/training-methods`
- `GET /api/options/courses`
- `GET /api/options/materials`
- `GET /api/options/documents`
- `GET /api/options/revisions`
- `GET /api/options/controlled-copies`
- `GET /api/options/products`
- `GET /api/options/suppliers`
- `GET /api/options/equipment`
- `GET /api/options/regulatory-authorities`
- `GET /api/options/report-types`
- `GET /api/options/email-template-types`

### Query nên hỗ trợ

- `search`
- `status`
- `activeOnly`
- `page`
- `limit`
- `departmentId`
- `businessUnitId`
- `documentType`
- `excludeIds`

### Autocomplete chuyên biệt

- `GET /api/lookup/users`
- `GET /api/lookup/documents`
- `GET /api/lookup/revisions`
- `GET /api/lookup/training-courses`
- `GET /api/lookup/training-materials`

## 3.4 File service dùng chung

### Upload

- `POST /api/files`
- `POST /api/files/batch`
- `POST /api/files/temp`
- `POST /api/files/chunk/init`
- `POST /api/files/chunk/:uploadId`
- `POST /api/files/chunk/:uploadId/complete`

### Metadata / preview / download

- `GET /api/files/:fileId`
- `GET /api/files/:fileId/preview`
- `GET /api/files/:fileId/download`
- `DELETE /api/files/:fileId`
- `DELETE /api/files/temp/:tempFileId`

Metadata tối thiểu:

- `fileId`
- `originalName`
- `storedName`
- `mimeType`
- `size`
- `checksum`
- `uploadedBy`
- `uploadedAt`
- `virusScanStatus`

## 3.5 Comments / activity / timeline

- `GET /api/:module/:id/comments`
- `POST /api/:module/:id/comments`
- `PUT /api/comments/:commentId`
- `DELETE /api/comments/:commentId`
- `POST /api/comments/:commentId/replies`
- `POST /api/comments/:commentId/mentions`

- `GET /api/:module/:id/timeline`
- `GET /api/:module/:id/activity`

## 3.6 Audit trail / chữ ký điện tử

- `GET /api/:module/:id/audit-trail`
- `GET /api/:module/:id/signatures`
- `POST /api/e-signatures/verify`
- `POST /api/e-signatures/challenge`

Payload verify gợi ý:

```json
{
  "username": "qa.manager",
  "password": "******",
  "meaning": "Phê duyệt phát hành tài liệu",
  "module": "document",
  "entityId": "doc-001"
}
```

## 3.7 Export job dùng chung

- `POST /api/exports`
- `GET /api/exports/:jobId`
- `GET /api/exports/:jobId/download`
- `DELETE /api/exports/:jobId`

Payload:

```json
{
  "module": "documents",
  "format": "excel",
  "filters": {},
  "columns": []
}
```

---

## 4. Dashboard

### Mục tiêu front-end

- tổng quan KPI
- cảnh báo
- biểu đồ tuân thủ / chất lượng
- việc cần làm

### API cần có

- `GET /api/dashboard/summary`
- `GET /api/dashboard/my-work`
- `GET /api/dashboard/alerts`
- `GET /api/dashboard/charts/compliance`
- `GET /api/dashboard/charts/quality-events`
- `GET /api/dashboard/charts/document-status`
- `GET /api/dashboard/charts/training-status`
- `GET /api/dashboard/recent-activity`

---

## 5. Notifications

Front-end có:

- dropdown ở header
- notification center
- filter `all`, `for-me`, `system`
- unread count
- mark all read

### API danh sách / chi tiết

- `GET /api/notifications`
- `GET /api/notifications/:id`
- `GET /api/notifications/unread-count`

### Query

- `tab=all|for-me|system`
- `status=unread|read`
- `type`
- `priority`
- `search`
- `fromDate`
- `toDate`
- `page`
- `limit`

### Mutation

- `POST /api/notifications/:id/read`
- `POST /api/notifications/:id/unread`
- `POST /api/notifications/read-all`
- `DELETE /api/notifications/:id`

### Cài đặt notifications

- `GET /api/notification-settings`
- `PUT /api/notification-settings`

Payload gợi ý:

```json
{
  "emailEnabled": true,
  "inAppEnabled": true,
  "digestEnabled": true,
  "eventRules": [
    {
      "event": "document_approval_pending",
      "channels": ["in_app", "email"]
    }
  ]
}
```

---

## 6. My Tasks

Front-end có:

- task list
- board
- drawer detail
- status / priority / module filter

### API

- `GET /api/tasks`
- `GET /api/tasks/:id`
- `GET /api/tasks/counts`
- `GET /api/tasks/board`

### Query

- `module`
- `priority`
- `status`
- `assigneeId`
- `reporterId`
- `dueFrom`
- `dueTo`
- `search`
- `page`
- `limit`

### Mutation

- `POST /api/tasks/:id/start`
- `POST /api/tasks/:id/complete`
- `POST /api/tasks/:id/reassign`
- `POST /api/tasks/:id/comment`
- `POST /api/tasks/:id/cancel`

### Response detail nên có

- thông tin task
- timeline
- link đến entity gốc
- available actions theo quyền

---

## 7. Documents

Module `documents` là module phức tạp nhất. Nên chia backend theo 3 nhóm:

- document gốc
- revision
- controlled copy

## 7.1 Documents list / detail

### API list

- `GET /api/documents`

### Query

- `scope=owned|all`
- `status`
- `documentType`
- `subType`
- `departmentId`
- `ownerId`
- `reviewerId`
- `approverId`
- `effectiveFrom`
- `effectiveTo`
- `search`
- `page`
- `limit`
- `sortBy`
- `sortOrder`

### API create / update / delete

- `POST /api/documents`
- `GET /api/documents/:id`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`

### Payload document tối thiểu

```json
{
  "documentNumber": "SOP-QA-015",
  "title": "Quality Assurance Procedures",
  "titleLocalLanguage": "",
  "documentType": "Standard Operating Procedure",
  "subType": "Operational",
  "language": "en",
  "departmentId": "dep-qa",
  "businessUnitId": "bu-hcm",
  "ownerId": "user-001",
  "description": "....",
  "periodicReviewCycle": 12,
  "periodicReviewNotification": 30,
  "effectiveDate": "2026-06-01",
  "validUntil": null,
  "trainingRequired": true,
  "relatedDocumentIds": [],
  "correlatedDocumentIds": [],
  "reviewers": [],
  "approvers": [],
  "attachments": [],
  "mainFileId": "file-001"
}
```

## 7.2 Tab detail document

Front-end đang tách nhiều tab. Nên hỗ trợ lazy-load.

- `GET /api/documents/:id/general`
- `GET /api/documents/:id/document-info`
- `GET /api/documents/:id/training-info`
- `GET /api/documents/:id/reviewers`
- `GET /api/documents/:id/approvers`
- `GET /api/documents/:id/related-documents`
- `GET /api/documents/:id/correlated-documents`
- `GET /api/documents/:id/revisions`
- `GET /api/documents/:id/controlled-copies`
- `GET /api/documents/:id/audit-trail`
- `GET /api/documents/:id/signatures`

## 7.3 Validate / helper cho form tài liệu

- `POST /api/documents/validate-number`
- `POST /api/documents/validate-links`
- `GET /api/documents/form-options`
- `POST /api/documents/preview-number`

## 7.4 Upload / file tài liệu

- `POST /api/documents/:id/upload-main-file`
- `POST /api/documents/:id/upload-attachments`
- `GET /api/documents/:id/files`
- `DELETE /api/documents/:id/files/:fileId`

## 7.5 Workflow document

- `POST /api/documents/:id/submit`
- `POST /api/documents/:id/review`
- `POST /api/documents/:id/approve`
- `POST /api/documents/:id/reject`
- `POST /api/documents/:id/publish`
- `POST /api/documents/:id/obsolete`
- `POST /api/documents/:id/archive`
- `POST /api/documents/:id/restore`
- `POST /api/documents/:id/cancel`

Payload review / approve / reject gợi ý:

```json
{
  "comment": "Đạt yêu cầu",
  "signatureToken": "esign-token",
  "decision": "approve"
}
```

## 7.6 Knowledge

- `GET /api/documents/knowledge`
- `GET /api/documents/knowledge/folders`
- `GET /api/documents/knowledge/tags`
- `GET /api/documents/knowledge/:folderId/documents`

## 7.7 Archived documents

- `GET /api/documents/archived`
- `GET /api/documents/archived/:id`
- `GET /api/documents/archived/export`

---

## 8. Document Revisions

Front-end đang có:

- revision list
- revisions owned by me
- pending review
- pending approval
- impact analysis
- create / upgrade
- review / approval / training workflow
- detail revision

## 8.1 List / detail

- `GET /api/revisions`
- `POST /api/revisions`
- `GET /api/revisions/:id`
- `PUT /api/revisions/:id`

### Query

- `scope=all|owned|pending-review|pending-approval`
- `status`
- `stage`
- `sourceDocumentId`
- `ownerId`
- `search`
- `page`
- `limit`

## 8.2 Impact analysis

Front-end đã có:

- source document
- impacted items
- decision per item
- mobile filter

### API cần có

- `GET /api/revisions/impact-analysis/source-document`
  - query: `sourceDocumentId`
- `POST /api/revisions/impact-analysis`
- `POST /api/revisions/batch-impact-analysis`

### Payload gợi ý

```json
{
  "sourceDocumentId": "doc-001",
  "mode": "standalone",
  "impactedDocuments": [
    {
      "documentId": "doc-002",
      "decision": "upgrade",
      "reason": "Affected by terminology change"
    }
  ]
}
```

## 8.3 Revision workspace / tab data

- `GET /api/revisions/:id/general`
- `GET /api/revisions/:id/document-info`
- `GET /api/revisions/:id/original-document`
- `GET /api/revisions/:id/training-info`
- `GET /api/revisions/:id/reviewers`
- `GET /api/revisions/:id/approvers`
- `GET /api/revisions/:id/working-notes`
- `GET /api/revisions/:id/signatures`
- `GET /api/revisions/:id/audit-trail`

## 8.4 Upload batch / multi-document

- `POST /api/revisions/upload-batch`
- `POST /api/revisions/import-related-documents`

## 8.5 Workflow revision

- `POST /api/revisions/:id/submit`
- `POST /api/revisions/:id/review`
- `POST /api/revisions/:id/approve`
- `POST /api/revisions/:id/reject`
- `POST /api/revisions/:id/request-change`
- `POST /api/revisions/:id/training-complete`
- `POST /api/revisions/:id/publish`
- `POST /api/revisions/:id/cancel`

## 8.6 Export

- `GET /api/revisions/export`

---

## 9. Controlled Copies

Front-end có:

- list all / ready / distributed
- detail
- request controlled copy
- destroy controlled copy

## 9.1 List / detail

- `GET /api/controlled-copies`
- `POST /api/controlled-copies`
- `GET /api/controlled-copies/:id`
- `PUT /api/controlled-copies/:id`

### Query

- `scope=all|ready|distributed`
- `status`
- `documentId`
- `locationId`
- `departmentId`
- `search`

## 9.2 Request controlled copy

- `POST /api/controlled-copies/request`

Payload gợi ý:

```json
{
  "selectedDocuments": ["doc-001", "doc-002"],
  "locationId": "loc-001",
  "quantity": 2,
  "reason": "Use at warehouse release area",
  "signature": "esign-token"
}
```

## 9.3 Detail tabs

- `GET /api/controlled-copies/:id/document-info`
- `GET /api/controlled-copies/:id/distribution-info`
- `GET /api/controlled-copies/:id/signatures`
- `GET /api/controlled-copies/:id/audit-trail`

## 9.4 Distribution / return / destroy

- `POST /api/controlled-copies/:id/distribute`
- `POST /api/controlled-copies/:id/acknowledge`
- `POST /api/controlled-copies/:id/return`
- `POST /api/controlled-copies/:id/destroy`
- `POST /api/controlled-copies/:id/upload-destruction-evidence`

Payload destroy gợi ý:

```json
{
  "destructionType": "shred",
  "reason": "Obsoleted revision",
  "destroyedAt": "2026-05-30T09:00:00Z",
  "destroyedBy": "user-001",
  "evidenceFileIds": ["file-123", "file-124"],
  "signatureToken": "esign-token"
}
```

## 9.5 Export

- `GET /api/controlled-copies/export`

---

## 10. Training

Module training được chia thành:

- Courses
- Materials
- Compliance Tracking
- Assignments
- Records & Archive
- My Training

## 10.1 Training courses

### CRUD

- `GET /api/training/courses`
- `POST /api/training/courses`
- `GET /api/training/courses/:id`
- `PUT /api/training/courses/:id`

### Query

- `search`
- `type`
- `status`
- `trainingMethod`
- `departmentId`
- `mandatory`
- `fromDate`
- `toDate`

### Payload course tối thiểu

Từ type front-end:

- `title`
- `description`
- `type`
- `trainingMethod`
- `status`
- `departmentId`
- `instructor`
- `scheduledDate`
- `duration`
- `location`
- `capacity`
- `mandatory`
- `passScore`
- `version`
- `linkedDocumentId`
- `recurrence`
- `reviewers`
- `approvers`
- `questions`
- `trainingFiles`
- `materials`

## 10.2 Tab detail / workflow course

- `GET /api/training/courses/:id/basic-info`
- `GET /api/training/courses/:id/document-links`
- `GET /api/training/courses/:id/config`
- `GET /api/training/courses/:id/reviewers`
- `GET /api/training/courses/:id/approvers`
- `GET /api/training/courses/:id/audit-trail`

## 10.3 Workflow course

- `POST /api/training/courses/:id/submit`
- `POST /api/training/courses/:id/review`
- `POST /api/training/courses/:id/approve`
- `POST /api/training/courses/:id/reject`
- `POST /api/training/courses/:id/obsolete-impact-assessment`
- `POST /api/training/courses/:id/obsolete`
- `POST /api/training/courses/:id/cancel`

## 10.4 Course progress / result entry / course status

Front-end có:

- course progress
- result entry
- course status

### API

- `GET /api/training/courses/:id/progress`
- `GET /api/training/courses/:id/result-entry`
- `POST /api/training/courses/:id/result-entry`
- `PUT /api/training/courses/:id/result-entry/:recordId`
- `GET /api/training/course-status`

### Result entry payload gợi ý

```json
{
  "entries": [
    {
      "employeeId": "emp-001",
      "score": 85,
      "resultStatus": "Pass",
      "completedAt": "2026-05-30T08:00:00Z",
      "attempts": 1,
      "comment": ""
    }
  ]
}
```

## 10.5 Training materials

### CRUD

- `GET /api/training/materials`
- `POST /api/training/materials`
- `GET /api/training/materials/:id`
- `PUT /api/training/materials/:id`

### Query

- `search`
- `type`
- `status`
- `departmentId`
- `uploadedBy`
- `fromDate`
- `toDate`

### Payload material tối thiểu

- `materialNumber`
- `title`
- `description`
- `type`
- `version`
- `departmentId`
- `businessUnitId`
- `reviewerId`
- `approverId`
- `externalUrl`
- `periodicReviewCycle`
- `periodicReviewNotification`
- `effectiveDate`
- `validUntil`
- `reviewDate`

## 10.6 Tab / workflow materials

- `GET /api/training/materials/:id/information`
- `GET /api/training/materials/:id/upload`
- `GET /api/training/materials/:id/reviewers`
- `GET /api/training/materials/:id/approvers`
- `GET /api/training/materials/:id/audit-trail`
- `GET /api/training/materials/:id/usage-report`
- `GET /api/training/materials/:id/version-history`

## 10.7 Upload / preview materials

- `POST /api/training/materials/:id/upload`
- `GET /api/training/materials/:id/files`
- `GET /api/training/materials/:id/files/:fileId/download`
- `GET /api/training/materials/:id/files/:fileId/preview`
- `DELETE /api/training/materials/:id/files/:fileId`

## 10.8 Workflow materials

- `POST /api/training/materials/:id/submit`
- `POST /api/training/materials/:id/review`
- `POST /api/training/materials/:id/approve`
- `POST /api/training/materials/:id/reject`
- `POST /api/training/materials/:id/new-revision`
- `POST /api/training/materials/:id/obsolete`

## 10.9 Assignments

### CRUD

- `GET /api/training/assignments`
- `POST /api/training/assignments`
- `GET /api/training/assignments/:id`
- `PUT /api/training/assignments/:id`
- `POST /api/training/assignments/:id/cancel`

### Payload assignment tối thiểu

Từ type front-end:

- `courseId`
- `targetScope`
- `targetIds`
- `deadline`
- `priority`
- `trainingBeforeAuthorized`
- `requiresESign`
- `isCrossTraining`
- `reminders`
- `trigger`
- `reasonForAssignment`
- `linkedDocumentId`
- `linkedCapaId`
- `linkedDeviationId`
- `notes`

## 10.10 Assignment progress

- `GET /api/training/assignments/:id/progress`
- `GET /api/training/assignments/:id/assignees`
- `POST /api/training/assignments/:id/reassign`
- `POST /api/training/assignments/:id/waive`
- `POST /api/training/assignments/:id/start`
- `POST /api/training/assignments/:id/complete`

## 10.11 Assignment rules / auto assignment

- `GET /api/training/assignment-rules`
- `POST /api/training/assignment-rules`
- `GET /api/training/assignment-rules/:id`
- `PUT /api/training/assignment-rules/:id`
- `DELETE /api/training/assignment-rules/:id`
- `POST /api/training/assignment-rules/:id/activate`
- `POST /api/training/assignment-rules/:id/deactivate`
- `POST /api/training/assignment-rules/:id/test-run`

## 10.12 My Training

- `GET /api/training/my-training`
- `GET /api/training/my-training/:assignmentId`
- `POST /api/training/my-training/:assignmentId/start`
- `POST /api/training/my-training/:assignmentId/complete`
- `POST /api/training/my-training/:assignmentId/submit-result`
- `GET /api/training/my-training/:assignmentId/files`

## 10.13 Compliance Tracking / Matrix

Front-end đang có:

- training matrix
- cell detail drawer
- header action drawer
- filter bar

### API

- `GET /api/training/matrix`
- `GET /api/training/matrix/employees`
- `GET /api/training/matrix/courses`
- `GET /api/training/matrix/cells`
- `GET /api/training/matrix/cell-detail`
  - query: `employeeId`, `courseId`

- `GET /api/training/course-status`
- `GET /api/training/matrix/auto-assignment-rules`

## 10.14 Records & Archive

- `GET /api/training/employee-files`
- `GET /api/training/employee-files/:employeeId`
- `GET /api/training/employee-files/:employeeId/overview`
- `GET /api/training/employee-files/:employeeId/sops`
- `GET /api/training/employee-files/:employeeId/ojt`
- `GET /api/training/employee-files/:employeeId/history`

## 10.15 Export training records

- `GET /api/training/export-records`
- `POST /api/training/export-records`
- `GET /api/training/export-records/:jobId`
- `GET /api/training/export-records/:jobId/download`

---

## 11. Deviations

Front-end hiện là module list/summary, nhưng backend nên dựng full workflow.

### CRUD

- `GET /api/deviations`
- `POST /api/deviations`
- `GET /api/deviations/:id`
- `PUT /api/deviations/:id`
- `DELETE /api/deviations/:id`

### Workflow

- `POST /api/deviations/:id/submit`
- `POST /api/deviations/:id/assign`
- `POST /api/deviations/:id/investigate`
- `POST /api/deviations/:id/review`
- `POST /api/deviations/:id/approve`
- `POST /api/deviations/:id/close`
- `POST /api/deviations/:id/cancel`

### Liên kết

- `GET /api/deviations/:id/files`
- `GET /api/deviations/:id/comments`
- `GET /api/deviations/:id/audit-trail`

### Export

- `GET /api/deviations/export`

---

## 12. CAPA

### CRUD

- `GET /api/capa`
- `POST /api/capa`
- `GET /api/capa/:id`
- `PUT /api/capa/:id`

### Workflow

- `POST /api/capa/:id/submit`
- `POST /api/capa/:id/assign`
- `POST /api/capa/:id/action-plan`
- `POST /api/capa/:id/implement`
- `POST /api/capa/:id/verify`
- `POST /api/capa/:id/effectiveness-check`
- `POST /api/capa/:id/close`
- `POST /api/capa/:id/cancel`

### Liên kết

- `GET /api/capa/:id/files`
- `GET /api/capa/:id/comments`
- `GET /api/capa/:id/audit-trail`

### Export

- `GET /api/capa/export`

---

## 13. Complaints

- `GET /api/complaints`
- `POST /api/complaints`
- `GET /api/complaints/:id`
- `PUT /api/complaints/:id`
- `POST /api/complaints/:id/submit`
- `POST /api/complaints/:id/assign`
- `POST /api/complaints/:id/investigate`
- `POST /api/complaints/:id/root-cause`
- `POST /api/complaints/:id/initiate-capa`
- `POST /api/complaints/:id/close`
- `POST /api/complaints/:id/reject`
- `GET /api/complaints/export`

---

## 14. Change Control

- `GET /api/change-controls`
- `POST /api/change-controls`
- `GET /api/change-controls/:id`
- `PUT /api/change-controls/:id`
- `POST /api/change-controls/:id/submit`
- `POST /api/change-controls/:id/impact-assessment`
- `POST /api/change-controls/:id/approve`
- `POST /api/change-controls/:id/implement`
- `POST /api/change-controls/:id/verify`
- `POST /api/change-controls/:id/close`
- `POST /api/change-controls/:id/reject`
- `GET /api/change-controls/export`

---

## 15. Equipment

- `GET /api/equipment`
- `POST /api/equipment`
- `GET /api/equipment/:id`
- `PUT /api/equipment/:id`
- `DELETE /api/equipment/:id`
- `GET /api/equipment/:id/maintenance`
- `POST /api/equipment/:id/maintenance`
- `GET /api/equipment/:id/calibration`
- `POST /api/equipment/:id/calibration`
- `GET /api/equipment/:id/qualification`
- `POST /api/equipment/:id/qualification`
- `GET /api/equipment/export`

---

## 16. Supplier

- `GET /api/suppliers`
- `POST /api/suppliers`
- `GET /api/suppliers/:id`
- `PUT /api/suppliers/:id`
- `GET /api/suppliers/:id/audits`
- `POST /api/suppliers/:id/audits`
- `GET /api/suppliers/:id/certificates`
- `POST /api/suppliers/:id/certificates`
- `POST /api/suppliers/:id/qualify`
- `POST /api/suppliers/:id/suspend`
- `POST /api/suppliers/:id/disqualify`
- `GET /api/suppliers/export`

---

## 17. Product

- `GET /api/products`
- `POST /api/products`
- `GET /api/products/:id`
- `PUT /api/products/:id`
- `GET /api/products/:id/batches`
- `POST /api/products/:id/batches`
- `GET /api/products/:id/specifications`
- `POST /api/products/:id/specifications`
- `GET /api/products/export`

---

## 18. Regulatory

- `GET /api/regulatory/submissions`
- `POST /api/regulatory/submissions`
- `GET /api/regulatory/submissions/:id`
- `PUT /api/regulatory/submissions/:id`
- `POST /api/regulatory/submissions/:id/submit`
- `POST /api/regulatory/submissions/:id/respond`
- `POST /api/regulatory/submissions/:id/approve`
- `POST /api/regulatory/submissions/:id/withdraw`
- `POST /api/regulatory/submissions/:id/upload-dossier`
- `GET /api/regulatory/submissions/:id/dossier-files`
- `GET /api/regulatory/export`

---

## 19. Risk Management

- `GET /api/risks`
- `POST /api/risks`
- `GET /api/risks/:id`
- `PUT /api/risks/:id`
- `POST /api/risks/:id/assess`
- `POST /api/risks/:id/mitigation-plan`
- `POST /api/risks/:id/mitigation-progress`
- `POST /api/risks/:id/accept`
- `POST /api/risks/:id/close`
- `GET /api/risks/export`

---

## 20. Audit Trail

Front-end đã có:

- audit trail list
- detail
- export

### API

- `GET /api/audit-trail`
- `GET /api/audit-trail/:id`
- `GET /api/audit-trail/export`
- `GET /api/audit-trail/export/pdf`

### Query

- `module`
- `action`
- `userId`
- `severity`
- `search`
- `fromDate`
- `toDate`
- `page`
- `limit`

### Detail response nên có

- actor
- timestamp
- entity
- old/new values
- ip address
- device
- metadata

---

## 21. Reports

Front-end hiện có:

- templates
- compliance reports
- history
- scheduled reports
- preview modal
- create schedule modal

## 21.1 Templates

- `GET /api/reports/templates`
- `POST /api/reports/templates`
- `GET /api/reports/templates/:id`
- `PUT /api/reports/templates/:id`
- `DELETE /api/reports/templates/:id`

## 21.2 Generate / preview / history

- `POST /api/reports/generate`
- `POST /api/reports/preview`
- `GET /api/reports/history`
- `GET /api/reports/history/:id`
- `GET /api/reports/history/:id/download`

Payload generate gợi ý:

```json
{
  "templateId": "rpt-tpl-001",
  "type": "Compliance",
  "format": "Excel",
  "period": "Custom",
  "dateFrom": "2026-05-01",
  "dateTo": "2026-05-30",
  "filters": {},
  "fields": ["documentNumber", "status", "owner"]
}
```

## 21.3 Scheduled reports

- `GET /api/reports/scheduled`
- `POST /api/reports/scheduled`
- `GET /api/reports/scheduled/:id`
- `PUT /api/reports/scheduled/:id`
- `DELETE /api/reports/scheduled/:id`
- `POST /api/reports/scheduled/:id/pause`
- `POST /api/reports/scheduled/:id/resume`

## 21.4 Compliance report screen

- `GET /api/reports/compliance`

---

## 22. Settings

Module settings cần backend mạnh vì dùng rất nhiều form / table / select.

## 22.1 User management

### CRUD

- `GET /api/settings/users`
- `POST /api/settings/users`
- `GET /api/settings/users/:id`
- `PUT /api/settings/users/:id`
- `DELETE /api/settings/users/:id`

### Query

- `search`
- `status`
- `roleId`
- `departmentId`
- `positionId`
- `businessUnitId`

### Payload user tối thiểu

- `username`
- `fullName`
- `email`
- `phone`
- `gender`
- `dateOfBirth`
- `employeeCode`
- `departmentId`
- `businessUnitId`
- `positionId`
- `roleIds`
- `employmentType`
- `joinDate`
- `managerId`
- `avatarFileId`
- `certifications`
- `educationItems`

### Action API

- `POST /api/settings/users/:id/activate`
- `POST /api/settings/users/:id/deactivate`
- `POST /api/settings/users/:id/suspend`
- `POST /api/settings/users/:id/terminate`
- `POST /api/settings/users/:id/reset-password`
- `POST /api/settings/users/:id/unlock`
- `POST /api/settings/users/:id/avatar`

### Qualification / profile phụ trợ

- `GET /api/settings/users/:id/permissions`
- `PUT /api/settings/users/:id/permissions`
- `GET /api/settings/users/:id/qualifications`
- `POST /api/settings/users/:id/qualifications`
- `PUT /api/settings/users/:id/qualifications/:qualificationId`
- `DELETE /api/settings/users/:id/qualifications/:qualificationId`

## 22.2 Roles and permissions

- `GET /api/settings/roles`
- `POST /api/settings/roles`
- `GET /api/settings/roles/:id`
- `PUT /api/settings/roles/:id`
- `DELETE /api/settings/roles/:id`
- `GET /api/settings/roles/:id/permissions`
- `PUT /api/settings/roles/:id/permissions`

Role detail screen gợi ý response nên có:

- thông tin role
- users đang gán
- permission domains
- selected permissions count

## 22.3 Document administration

Front-end có flow quản trị quyền tài liệu theo role / module / area / permissions.

- `GET /api/settings/document-administration`
- `PUT /api/settings/document-administration`
- `GET /api/settings/document-administration/areas`
- `GET /api/settings/document-administration/modules`
- `GET /api/settings/document-administration/role-matrix`
- `PUT /api/settings/document-administration/role-matrix`

## 22.4 Dictionaries

### Business Units

- `GET /api/settings/dictionaries/business-units`
- `POST /api/settings/dictionaries/business-units`
- `GET /api/settings/dictionaries/business-units/:id`
- `PUT /api/settings/dictionaries/business-units/:id`
- `DELETE /api/settings/dictionaries/business-units/:id`

### Departments

- `GET /api/settings/dictionaries/departments`
- `POST /api/settings/dictionaries/departments`
- `GET /api/settings/dictionaries/departments/:id`
- `PUT /api/settings/dictionaries/departments/:id`
- `DELETE /api/settings/dictionaries/departments/:id`

### Document Types

- `GET /api/settings/dictionaries/document-types`
- `POST /api/settings/dictionaries/document-types`
- `GET /api/settings/dictionaries/document-types/:id`
- `PUT /api/settings/dictionaries/document-types/:id`
- `DELETE /api/settings/dictionaries/document-types/:id`

### Positions

- `GET /api/settings/dictionaries/positions`
- `POST /api/settings/dictionaries/positions`
- `GET /api/settings/dictionaries/positions/:id`
- `PUT /api/settings/dictionaries/positions/:id`
- `DELETE /api/settings/dictionaries/positions/:id`

### Retention Policies

- `GET /api/settings/dictionaries/retention-policies`
- `POST /api/settings/dictionaries/retention-policies`
- `GET /api/settings/dictionaries/retention-policies/:id`
- `PUT /api/settings/dictionaries/retention-policies/:id`
- `DELETE /api/settings/dictionaries/retention-policies/:id`

### Storage Locations

- `GET /api/settings/dictionaries/storage-locations`
- `POST /api/settings/dictionaries/storage-locations`
- `GET /api/settings/dictionaries/storage-locations/:id`
- `PUT /api/settings/dictionaries/storage-locations/:id`
- `DELETE /api/settings/dictionaries/storage-locations/:id`

## 22.5 Configuration

Theo front-end có các tab:

- general
- security
- notification
- integration
- document
- features

### API

- `GET /api/settings/configuration/general`
- `PUT /api/settings/configuration/general`
- `GET /api/settings/configuration/security`
- `PUT /api/settings/configuration/security`
- `GET /api/settings/configuration/notifications`
- `PUT /api/settings/configuration/notifications`
- `GET /api/settings/configuration/integrations`
- `PUT /api/settings/configuration/integrations`
- `GET /api/settings/configuration/documents`
- `PUT /api/settings/configuration/documents`
- `GET /api/settings/configuration/features`
- `PUT /api/settings/configuration/features`

## 22.6 Email templates

- `GET /api/settings/email-templates`
- `POST /api/settings/email-templates`
- `GET /api/settings/email-templates/:id`
- `PUT /api/settings/email-templates/:id`
- `DELETE /api/settings/email-templates/:id`
- `POST /api/settings/email-templates/:id/preview`
- `POST /api/settings/email-templates/:id/test-send`
- `POST /api/settings/email-templates/:id/duplicate`

Payload:

- `name`
- `type`
- `subject`
- `htmlBody`
- `plainTextBody`
- `variables`
- `isActive`

## 22.7 System information

- `GET /api/settings/system-info`
- `GET /api/settings/system-info/health`
- `GET /api/settings/system-info/version`
- `GET /api/settings/system-info/dependencies`
- `GET /api/settings/system-info/storage`
- `GET /api/settings/system-info/background-jobs`

## 22.8 User profile

- `GET /api/profile`
- `PUT /api/profile`
- `PUT /api/profile/password`
- `PUT /api/profile/preferences`

---

## 23. Preferences

- `GET /api/preferences`
- `PUT /api/preferences`
- `GET /api/preferences/appearance`
- `PUT /api/preferences/appearance`
- `GET /api/preferences/localization`
- `PUT /api/preferences/localization`
- `GET /api/preferences/notifications`
- `PUT /api/preferences/notifications`
- `GET /api/preferences/security`
- `PUT /api/preferences/security`

---

## 24. Help / User Manual

- `GET /api/help/articles`
- `GET /api/help/articles/:slug`
- `GET /api/help/manual`
- `GET /api/help/contact-options`
- `POST /api/help/contact`

---

## 25. Danh sách API download bắt buộc theo hành vi người dùng

- `GET /api/files/:fileId/download`
- `GET /api/documents/export`
- `GET /api/documents/archived/export`
- `GET /api/revisions/export`
- `GET /api/controlled-copies/export`
- `GET /api/training/export-records/:jobId/download`
- `GET /api/training/materials/:id/files/:fileId/download`
- `GET /api/audit-trail/export`
- `GET /api/reports/history/:id/download`
- `GET /api/settings/users/export`

---

## 26. Danh sách API upload bắt buộc theo hành vi người dùng

- `POST /api/files`
- `POST /api/files/batch`
- `POST /api/files/temp`
- `POST /api/documents/:id/upload-main-file`
- `POST /api/documents/:id/upload-attachments`
- `POST /api/revisions/upload-batch`
- `POST /api/controlled-copies/:id/upload-destruction-evidence`
- `POST /api/training/materials/:id/upload`
- `POST /api/regulatory/submissions/:id/upload-dossier`
- `POST /api/settings/users/:id/avatar`

---

## 27. Trạng thái và API chuyển trạng thái theo module

## 27.1 Documents

Luồng gợi ý:

- `Draft`
- `Pending Review`
- `Pending Approval`
- `Effective`
- `Obsoleted`
- `Archived`
- `Closed - Cancelled`

API:

- `submit`
- `review`
- `approve`
- `reject`
- `publish`
- `obsolete`
- `archive`
- `restore`
- `cancel`

## 27.2 Revisions

Luồng gợi ý:

- `Draft`
- `Pending Review`
- `Pending Approval`
- `Training`
- `Effective/Published`
- `Closed - Cancelled`

## 27.3 Training Courses

Theo type front-end:

- `Draft`
- `Pending Review`
- `Pending Approval`
- `Effective`
- `Obsoleted`
- `Closed - Cancelled`

## 27.4 Training Materials

Theo type front-end:

- `Draft`
- `Pending Review`
- `Pending Approval`
- `Effective`
- `Obsoleted`
- `Closed - Cancelled`

## 27.5 Controlled Copies

Theo type front-end:

- `Ready for Distribution`
- `Distributed`
- `Obsolete`
- `Closed - Cancelled`

## 27.6 Assignments

- `Draft`
- `Active`
- `Completed`
- `PartiallyCompleted`
- `Cancelled`
- `Expired`

## 27.7 Deviations / CAPA / Complaints / Change Control / Regulatory / Risk

Các module này đều nên có state machine riêng ở backend, nhưng vẫn expose bằng action endpoint chuyên biệt thay vì cập nhật status trực tiếp.

---

## 28. Gợi ý phân lớp backend

Nên tách theo route group:

- `/api/auth`
- `/api/search`
- `/api/options`
- `/api/files`
- `/api/dashboard`
- `/api/notifications`
- `/api/tasks`
- `/api/documents`
- `/api/revisions`
- `/api/controlled-copies`
- `/api/training/...`
- `/api/deviations`
- `/api/capa`
- `/api/complaints`
- `/api/change-controls`
- `/api/equipment`
- `/api/suppliers`
- `/api/products`
- `/api/regulatory`
- `/api/risks`
- `/api/audit-trail`
- `/api/reports`
- `/api/settings/...`
- `/api/profile`
- `/api/preferences`
- `/api/help`

---

## 29. Thứ tự ưu tiên triển khai backend

Nếu bắt đầu từ số 0, nên đi theo thứ tự:

1. Auth + current user + role/permission
2. Shared API: options, search, files, audit, e-signature
3. Notifications + tasks + dashboard summary
4. Settings: users, roles, dictionaries, configuration
5. Documents + revisions + controlled copies
6. Training: courses, materials, assignments, matrix, records
7. Deviations, CAPA, complaints, change control
8. Equipment, supplier, product, regulatory, risk
9. Reports, exports, scheduled jobs

---

## 30. Ghi chú triển khai quan trọng

- Front-end có rất nhiều màn list/filter drawer:
  - backend cần cả list API và option API
- Nhiều màn detail chia tab:
  - nên hỗ trợ lazy-load theo tab
- Nhiều workflow nhiều bước:
  - nên có endpoint `available-actions`
- Các thao tác export lớn:
  - nên dùng async job
- Các form nhiều bước:
  - nên hỗ trợ `draft save`
- Các module regulated:
  - nên audit đầy đủ
  - nên lưu reason/comment của mọi quyết định
  - nên gắn e-signature cho approve/reject/publish/obsolete/destroy

### API phụ trợ rất nên có thêm

- `GET /api/health`
- `GET /api/version`
- `GET /api/permissions/me`
- `GET /api/modules/me`
- `GET /api/reference-data/bootstrap`

### Nếu muốn chuẩn hóa tốt hơn nữa ở vòng sau

Nên có thêm:

- OpenAPI / Swagger
- JSON schema cho payload
- state machine document hóa riêng từng module
- event/outbox cho notification và audit
- webhook/event bus cho các trigger như:
  - document effective
  - revision published
  - training assignment created
  - deviation escalated
  - report generated
