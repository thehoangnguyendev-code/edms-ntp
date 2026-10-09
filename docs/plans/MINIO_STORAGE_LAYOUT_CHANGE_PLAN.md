# Kế hoạch thay đổi cấu trúc lưu trữ MinIO

Trạng thái: **ĐỀ XUẤT ĐÃ ĐƯỢC CHẤP THUẬN Ở MỨC QUYẾT ĐỊNH (D1, D2, D4); CHƯA THỰC HIỆN.**
Chưa sửa code. Chưa có đánh giá tác động GitNexus (công cụ không có trong phiên làm việc). Chưa có số liệu kiểm thử.
Ngày: 2026-10-08.

## 1. Quyết định đã chốt

| ID | Quyết định | Ghi chú |
|---|---|---|
| D1 | Không di chuyển file cũ. Chỉ file mới ghi theo cấu trúc mới. | DB đã lưu URI đầy đủ có bucket và versionId, nên file cũ vẫn đọc được. [ĐÃ KIỂM TRA: `document_revisions.file_path`, `controlled_copies.controlled_copy_file_path`, `report_artifacts.object_key` đều có dạng `minio://<bucket>/<key>?versionId=...`] |
| D2 | Tách bucket theo chính sách lưu giữ. | Xem mục 2. |
| D3 | Chưa quyết (tài nguyên đào tạo có khóa hay không). | Không tạo bucket đào tạo cho đến khi quyết. |
| D4 | Chấp nhận đổi tên bucket. | Bucket cũ `eqms-gmp-revisions` giữ nguyên làm kho chỉ đọc cho dữ liệu cũ. |

## 2. Cấu trúc mới (ĐÃ THAY THẾ bởi mục 13)

| Bucket | Object Lock | Versioning | Nội dung |
|---|---|---|---|
| `eqms-gmp-records` | COMPLIANCE, 5 năm | Có | Bản ghi GMP mới (tài liệu, bản sao kiểm soát, biểu mẫu đã thực hiện, nhân sự, báo cáo) |
| `eqms-templates` | Không | Có | Mẫu xuất bản, thành phần mẫu, DOCX mẫu (cần sửa theo change control, không được xóa bản cũ đang được tham chiếu) |
| `eqms-quarantine` | Không | Không | File upload chờ quét virus và kiểm tra. Có vòng đời xóa sau N ngày. **Chỉ được tạo khi xác nhận có luồng quét trước khi chuyển sang bucket khác.** |
| `eqms-gmp-revisions` (cũ) | COMPLIANCE (giữ nguyên) | Có (giữ nguyên) | **Chỉ đọc.** Không ghi mới. Giữ vô thời hạn cho đến khi có quyết định khác. |

Cấu trúc thư mục trong `eqms-gmp-records`:

```
documents/<mã-tài-liệu>/revisions/<revision>/{source,published,snapshots}/
controlled-copies/<mã-bản-sao>/{copies,evidence,recall-scans}/
uncontrolled-copies/<mã-bản-sao>/
forms/executed-records/<mã-biểu-mẫu>/<mã-bản-ghi>/
personnel/<user-id>/
user-certifications/<user-id>/
reports/<yyyy>/<mm>/<run-id>/
review-attachments/<revision-id>/
```

## 3. Ánh xạ từ prefix cũ sang mới (cho file mới)

| Prefix hiện tại (theo code/bucket cũ) | Vị trí mới | Ghi chú |
|---|---|---|
| `documents/` | `eqms-gmp-records/documents/` | Giữ cấu trúc con |
| `revisions/` | `eqms-gmp-records/documents/…/revisions/` | **Cần xác nhận**: nội dung và cách ghi key của prefix này chưa kiểm tra |
| `controlled-copies/` (kể cả `evidence`, `recall-scans`) | `eqms-gmp-records/controlled-copies/` | Code: `FileStorageService` dòng ghi `controlled-copies/recall-scans/`, `controlled-copies/evidence` |
| `uncontrolled-copies/` | `eqms-gmp-records/uncontrolled-copies/` | |
| `forms/executed-records/` | `eqms-gmp-records/forms/executed-records/` | Code: `FileStorageService` dòng ghi `forms/executed-records/` |
| `reports/` | `eqms-gmp-records/reports/` | Code: `ReportPlatformService` ghi key `reports/<code>/<yyyy>/<mm>/<run>/...`. **Cần đổi để bỏ `<code>` thành cấp nhóm cuối** |
| `personnel/`, `user-certifications/` | `eqms-gmp-records/personnel/`, `…/user-certifications/` | |
| `review-comment-attachments/` | `eqms-gmp-records/review-attachments/` | |
| `templates/` | `eqms-templates/` | |
| `temp/` | `eqms-quarantine/` | Chỉ khi có luồng quét; nếu không thì giữ `temp` trong bucket records và **không** khóa |

## 4. File mã nguồn cần sửa (dự kiến)

Phải chạy đánh giá tác động trước khi sửa từng file (CLAUDE.md):
- `eqms-backend/src/main/java/com/eqms/service/FileStorageService.java`: các chuỗi key ghi cứng (`forms/executed-records/`, `controlled-copies/recall-scans/`, `controlled-copies/evidence`), và biến bucket mặc định.
- `eqms-backend/src/main/java/com/eqms/service/ReportPlatformService.java`: dòng tạo `artifactKey` cho báo cáo.
- `eqms-backend/src/main/java/com/eqms/service/MinioObjectStorageService.java`: đọc `app.minio.bucket` mặc định; thêm bảng ánh xạ bucket theo loại; ghi ở bucket mới, đọc theo URI đã lưu.
- Cấu hình: `application*.yml` và `docker-compose.yml` (`APP_MINIO_BUCKET`, các `APP_MINIO_*_PREFIX`).
- Tạo bucket mới khi khởi động: `ensureBucket` đã có sẵn logic bật Object Lock; cần gọi cho từng bucket.
- Sao lưu: thêm các bucket mới vào phạm vi sao lưu (xem `BACKUP_RESTORE_DISASTER_RECOVERY_DESIGN.md`, mục 1.2).

Không sửa: DB (không migration dữ liệu), file cũ trong bucket cũ.

## 5. Điều kiện để tuân thủ EU-GMP

1. **Bản ghi thay đổi** theo mẫu `08_ONE_CHANGE_RECORD_TEMPLATE.md`, gắn với yêu cầu thay đổi và người phê duyệt.
2. **Đánh giá tác động** cho: đọc file cũ, ghi file mới, sao lưu/phục hồi, báo cáo, bản sao kiểm soát, biểu mẫu thực hiện, lưu giữ và legal hold.
3. **Kiểm thử bắt buộc:**
   - Âm tính: file cũ vẫn tải được từ bucket cũ; bucket không tồn tại thì báo lỗi rõ ràng, không rơi về bucket khác.
   - Chức năng: tạo mới một file ở mỗi loại, tải lại, so checksum SHA-256.
   - Đồng thời: hai tiến trình ghi cùng lúc không tạo key trùng.
   - Lỗi: MinIO không phản hồi giữa lúc ghi và sau khi ghi DB (theo quy trình của `eqms-file-integration-assurance`: không xóa object làm bù trừ khi có WORM).
4. **Đối chiếu sau triển khai:** đếm object theo bucket và theo loại; mọi URI trong DB phải trỏ tới object tồn tại; không có object mồ côi mới ngoài dự kiến.
5. **Kiểm tra sao lưu:** bộ sao lưu phải bao phủ `eqms-gmp-records` và `eqms-gmp-revisions`; ghi nhận kết quả khôi phục thử.
6. **Phê duyệt QA** trước khi đưa vào sử dụng cho dữ liệu GMP thật.

Rollback: chuyển cấu hình về bucket cũ cho file mới. Không cần xóa gì, vì dữ liệu mới vẫn còn và bucket cũ không bị động vào.

## 6. Các câu hỏi cần xác nhận trước khi sửa code

1. Prefix `revisions/` (2,2 MB) chứa gì và được ghi từ đâu? Tôi chưa xác nhận được.
2. Có luồng quét virus trước khi file được chuyển sang bucket chính không? Nếu không có, `eqms-quarantine` chưa nên tạo.
3. Tên bucket có chấp nhận `eqms-gmp-records` và `eqms-templates` không?
4. Báo cáo: có muốn bỏ cấp `<code>` trong key không, hay giữ nguyên và chỉ đổi bucket?

Bước tiếp theo: khi bạn trả lời 4 câu trên và xác nhận, tôi sẽ đọc tài liệu `08_STORAGE_GRAPH_AND_FILE_ASSURANCE_AS_IS.md` (hiện chưa có trong repo, nên cần xác định nơi lưu), chạy phân tích tác động bằng grep thay thế, lập bản ghi thay đổi, rồi mới sửa code.

## 7. Kết quả xác nhận (2026-10-08)

### 7.1 Câu 1 — prefix `revisions/` ở cấp gốc
- Bucket `eqms-gmp-revisions` có 5 thư mục con `<revisionId>/<tên file có tiền tố UUID>` (ví dụ `SOP hiệu chuẩn_0.0.1.docx`, `preview.pdf`). 5 bản ghi `document_revisions.file_path` đang trỏ tới đó.
- Định dạng tên `UUID_tên-file` giống với nhánh ghi local/NAS trong `FileStorageService` (`storedFileName`), và hàm `resolveLocalTargetDirectory` tạo thư mục theo `revisionId`. Đây là dấu vết của một nhánh ghi cũ khi provider lưu qua đường dẫn kiểu NAS. Bằng grep, **không còn nhánh ghi hiện tại nào** tạo key bắt đầu bằng `revisions/` cho MinIO.
- Kết luận: prefix này là dữ liệu cũ, chỉ đọc. Không chuyển, không ghi tiếp. Giữ trong bucket cũ theo D1.
- Mức chắc chắn: cao về việc không có đường ghi hiện tại; trung bình về nguồn gốc lịch sử (chưa kiểm tra nhật ký ứng dụng cũ).

### 7.2 Câu 4 — mã báo cáo trong key
Giữ nguyên `reports/<mã báo cáo>/<yyyy>/<mm>/<run-id>/`. Đã chốt.

### 7.3 Câu 3 — tên bucket
`eqms-gmp-records` và `eqms-templates` đã chốt.

### 7.4 Câu 2 — tích hợp luồng quét (chưa thực hiện)
Hiện trạng quét virus:
- Có: `RevisionUploadFileValidator` (file revision), `ControlledCopyService` (bằng chứng bản sao), `ControlledCopyRecallBatchService` (scan thu hồi), `PublishingTemplateService`, `UserManagementService`.
- **Chưa xác nhận**: `ExecutedRecordService.storeExecutedRecordFile` (biểu mẫu giấy đã thực hiện) — không thấy lệnh quét ngay tại điểm ghi. Cần kiểm tra controller trước khi kết luận.
- Hiện không có vùng cách ly: file được quét **đồng bộ trong bộ nhớ** rồi mới ghi thẳng vào bucket đích.

Thiết kế đề xuất cho luồng cách ly:
1. Mọi upload ghi vào `eqms-quarantine/<yyyy>/<mm>/<uuid>` (không khóa, có vòng đời xóa sau N ngày).
2. ClamAV quét object cách ly. Nếu bị nhiễm hoặc không quét được (fail-closed, đúng hành vi hiện tại): xóa object cách ly, ghi audit, từ chối.
3. Nếu sạch: sao chép sang bucket đích (`eqms-gmp-records` hoặc `eqms-templates`) theo key chuẩn, ghi DB, rồi mới xóa object cách ly. Xóa được vì bucket cách ly không khóa, và đây là bản sao tạm chứ không phải bản ghi.
4. Trạng thái trung gian (đã ghi cách ly, chưa quét xong, sao chép xong nhưng chưa ghi DB) phải có bản ghi và tác vụ đối soát, theo `eqms-file-integration-assurance`: không giả định transaction phân tán.
5. Không dùng xóa object để bù trừ ở bucket khóa.

Phạm vi ảnh hưởng (cần xác định trước khi sửa): các điểm gọi `storeRevision*`, `storeControlledCopy*`, `storeExecutedRecordFile`, `storeTemplate*`, `storeRecall*` trong `FileStorageService`, và các service gọi chúng (mục 7.4 ở trên).

Chưa làm vì: khối lượng lớn (nhiều điểm ghi, cần kiểm thử với ClamAV thật và mô phỏng lỗi giữa chừng), và công cụ đánh giá tác động GitNexus vẫn không có sẵn.

## 8. Phát hiện bổ sung (2026-10-08, trước khi sửa code)

### 8.1 Cấu hình trong DB ghi đè biến môi trường
- `system_configurations.integrations_config.storage` đang có `minioBucket = eqms-gmp-revisions` và `provider = minio`.
- `MinioObjectStorageService.resolveConfig` ưu tiên giá trị trong DB; `APP_MINIO_BUCKET` trong compose chỉ là giá trị dự phòng.
- **Hệ quả:** đổi bucket trong compose là **không đủ**. Phải đổi cấu hình tích hợp (qua màn Integrations có lý do và chữ ký điện tử, theo change control). Không sửa thẳng DB.
- Ghi chú về prefix `revisions/`: trong cấu hình có khóa `minioBasePath = revisions`. Code hiện tại **không đọc** khóa này (đã tìm bằng grep), nên đây là dấu vết của phiên bản cũ đã dùng nó làm tiền tố. Điều này củng cố kết luận 7.1: dữ liệu cũ, chỉ đọc.

### 8.2 Lỗ hổng quét virus đã xác nhận
- `ExecutedRecordService.store` (biểu mẫu giấy đã thực hiện) ghi file qua `fileStorageService.storeExecutedRecordFile` **không có lệnh quét** tại điểm ghi.
- `ControlledCopyRecallBatchService` và `ControlledCopyService` quét trước khi ghi. `RevisionUploadFileValidator` quét cho upload revision.
- Cờ `APP_SECURITY_VIRUS_SCAN_ENABLED` mặc định `true` trong compose.

### 8.3 Điểm ghi file cần đưa vào luồng cách ly (12 điểm gọi `fileStorageService.store*`)
ControlledCopyRecallBatchService (2), ControlledCopyService (2), ExecutedRecordService (1), PublishingTemplatePreviewService (1), PublishingTemplateService (1), PublishingWorkspaceService (2), RevisionPublishingSnapshotAsyncService (1), RevisionService (3), RevisionSnapshotAsyncService (1), UncontrolledCopyService (1), UserManagementService (1).

Cách tiếp cận đề xuất: đặt bước cách ly ở **một điểm chung** trong `FileStorageService` (đường `storeInMinio` và các đường local/NAS), thay vì sửa từng service. Như vậy mọi điểm ghi, kể cả điểm mới sau này, đều đi qua cách ly.

### 8.4 Việc còn lại trước khi sửa code
1. Đánh giá tác động cho `FileStorageService.storeInMinio`, `MinioObjectStorageService.store`, `StoragePathBuilder` (bằng grep, vì GitNexus không có sẵn).
2. Quyết định cách chuyển cấu hình bucket (xem câu hỏi cuối bản trả lời).
3. Tạo bucket `eqms-gmp-records`, `eqms-templates`, `eqms-quarantine` và đặt vòng đời cho quarantine trước khi bật ghi mới.
4. Cập nhật phạm vi sao lưu (bổ sung hai bucket mới).
5. Viết kiểm thử: âm tính, đồng thời, lỗi giữa chừng, đối chiếu DB ↔ MinIO.

## 9. Đã thực hiện (2026-10-08, chỉ môi trường dev)

Lựa chọn B được chấp thuận cho dev (migration thay vì màn Integrations có chữ ký).

### 9.1 Thay đổi
- `MinioObjectStorageService`:
  - Mọi file trước khi ghi đều được **quét ClamAV trên staging** (fail-closed). Nhiễm hoặc không quét được thì không ghi lên bucket nào.
  - Ghi vào `eqms-gmp-records` (khóa COMPLIANCE) hoặc `eqms-templates` (không khóa, có versioning) theo prefix `templates/` (hàm `bucketFor`).
  - Bucket chỉ bật Object Lock khi tạo mới, nên cờ `locked` được quyết định theo từng bucket.
- `V558__point_storage_to_records_and_templates_buckets.sql`: **chỉ cho dev**. Ghi chú trong file cấm đưa lên production như hiện tại.
- `docker-compose.yml`: `APP_MINIO_BUCKET` mặc định `eqms-gmp-records`; thêm `APP_MINIO_TEMPLATES_BUCKET`.
- Test `MinioBucketRoutingTest`: 4/4 đạt.

### 9.2 Sai lệch so với kế hoạch (mục 8.4)
- **Không dùng bucket `eqms-quarantine`.** Lý do: quét trên file staging cục bộ *trước khi ghi* cho cùng đảm bảo (không có byte chưa quét nào được lưu bền vững), đơn giản hơn và không tạo object mồ côi trong bucket khóa. Bucket quarantine vì vậy chưa được tạo. Nếu sau này cần cách ly bền vững qua restart thì bổ sung.
- **Chỉ áp dụng cho provider MinIO.** Đường ghi local/NAS không đi qua bước quét này. Đây là đường không dùng trong production.
- Không thay đổi `StoragePathBuilder`: tên thư mục bên trong bucket giữ nguyên (đã đủ trực quan), chỉ đổi bucket. Điều này làm thay đổi code nhỏ hơn dự kiến.

### 9.3 Đã xác minh (2026-10-08) — `MinioVirusScanLiveTest`
- File sạch vào `eqms-gmp-records` với versionId; mẫu vào `eqms-templates`.
- File EICAR bị từ chối, và không có object nào được tạo.
- `testConnection` (kiểm tra của chính ứng dụng) xác nhận versioning và Object Lock COMPLIANCE cho bucket records.
- MinIO từ chối xóa bản ghi sạch (WORM được thực thi, không chỉ cấu hình).
- Bucket `eqms-gmp-records` hiện có một bản ghi kiểm thử dưới `verification/`. Không xóa được vì bucket khóa; đây là dữ liệu dev, cần ghi nhận.
- Đã thêm `eqms-gmp-records`, `eqms-templates` và bucket cũ `eqms-gmp-revisions` vào mô tả phạm vi sao lưu (tài liệu thiết kế và màn hình Backup Scope).

### 9.3b Chưa làm
- Chưa thực hiện một lần ghi thật để xác nhận file mới rơi vào `eqms-gmp-records` và file nhiễm bị từ chối không để lại object. Cần kiểm thử này trước khi coi là hoàn tất.
- Chưa cập nhật phạm vi sao lưu cho hai bucket mới.
- Bucket được tạo khi ghi đầu tiên (`initialize-on-startup` mặc định `false`).

### 9.4 Việc còn lại
1. Kiểm thử ghi thật: tải lên một PDF sạch (kỳ vọng vào `eqms-gmp-records`) và một file EICAR (kỳ vọng bị từ chối, không có object mới).
2. Thêm hai bucket mới vào phạm vi sao lưu.
3. Trước khi triển khai production: xóa hoặc chuyển đổi V558, và đổi bucket qua màn Integrations có lý do và chữ ký điện tử.
4. Ghi nhận rằng `ExecutedRecordService` giờ đã được quét qua `MinioObjectStorageService` (chưa có kiểm thử riêng cho luồng này; kiểm thử ở mục 9.3 bao phủ điểm ghi chung).

## 10. Cách ly V558 khỏi production (2026-10-08)

- V558 đã chuyển sang `eqms-backend/src/main/resources/db/migration-dev/`. Nội dung giữ nguyên từng byte (checksum Flyway `-1773530497` khớp với bản đã áp dụng ở DB dev).
- `docker-compose.yml` (dev) đặt `SPRING_FLYWAY_LOCATIONS=classpath:db/migration,classpath:db/migration-dev`.
- `docker-compose.gmp.yml` đặt lại `SPRING_FLYWAY_LOCATIONS=classpath:db/migration`. Lý do: overlay được **ghép lên** file dev, nên nếu không ghi đè thì production sẽ nạp migration dev.
- Sai lầm đã sửa: lần đầu tôi sửa chú thích trong V558 nên checksum đổi và backend không khởi động. Đã khôi phục nguyên văn; ghi chú mới đặt trong `migration-dev/README.md`.

### 10.1 Lỗi có sẵn trong overlay GMP (chưa sửa)
`docker compose -f docker-compose.yml -f docker-compose.gmp.yml config` **thất bại** với lỗi `services.minio: can't set distinct values on 'mem_limit' and 'deploy.resources.limits.memory'`. Lỗi này tồn tại trước thay đổi này (đã kiểm tra với bản HEAD của overlay). Nghĩa là không thể xác minh cấu hình production bằng `docker compose config` cho đến khi sửa. Cần xử lý trước khi triển khai GMP.

### 10.2 Đã sửa lỗi overlay GMP (2026-10-08)
- Nguyên nhân: file dev gắn `mem_limit` cho mọi service qua anchor `x-default-resources`, và Compose v5 không chấp nhận `deploy.resources.limits` đi cùng `mem_limit` trong overlay.
- Cách sửa trong `docker-compose.gmp.yml`: giới hạn bộ nhớ dùng `mem_limit` (cùng khóa với base, ghi đè được); giới hạn CPU chuyển từ `deploy.resources.limits.cpus` sang khóa `cpus` cấp service. Không còn khối `deploy` nào trong overlay.
- Kết quả kiểm tra: `docker compose -f docker-compose.yml -f docker-compose.gmp.yml config` thành công. Ví dụ backend: 2 CPU, 2 GiB; Flyway chỉ nạp `classpath:db/migration`.
- File dev `docker-compose.yml` vẫn validate.

## 11. Cấu trúc thư mục thực tế sau sắp xếp (ĐÃ THAY THẾ bởi mục 13)

Đối chiếu với code ghi thật (grep các điểm ghi). Đây là cấu trúc **chuẩn** từ nay; file cũ không di chuyển (D1).

### 11.1 eqms-gmp-records (khóa COMPLIANCE) — ghi mới
| Thư mục | Ghi bởi | Ghi chú |
|---|---|---|
| `documents/<số tài liệu>/revisions/<revision-id>/{source,review,publishing,published}/` | `StoragePathBuilder` (V2) | Khớp kế hoạch |
| `controlled-copies/<lô>/copies/<số bản sao>_<id>/{issued.pdf,evidence/}` | `StoragePathBuilder` (V2) | Khớp kế hoạch |
| `controlled-copies/recall-scans/<lô>/<item>/` | `FileStorageService` | Khớp kế hoạch |
| `uncontrolled-copies/<số>/` | `FileStorageService` | Khớp kế hoạch |
| `forms/executed-records/<biểu mẫu>/<bản ghi>/` | `FileStorageService` | Khớp kế hoạch |
| `personnel/certifications/<user-id>/<cert-id>/` | `FileStorageService` | **Thay thế** `user-certifications/` trong kế hoạch: đây là đường ghi thực tế |
| `reports/<mã báo cáo>/<yyyy>/<mm>/<run-id>/` | `ReportPlatformService` | Giữ mã báo cáo (câu trả lời 4) |

### 11.2 eqms-templates (không khóa)
| Thư mục | Ghi bởi |
|---|---|
| `templates/publishing/...` | `StoragePathBuilder` (định tuyến tự động sang bucket templates) |
| `templates/document-content/...` | `StoragePathBuilder` |

### 11.3 Legacy — chỉ đọc, không có đường ghi trong code
| Bucket | Thư mục | Ghi chú |
|---|---|---|
| eqms-gmp-revisions | `revisions/<id>/` | Đã xác định ở mục 7.1 |
| eqms-gmp-revisions | `user-certifications/` | Không còn writer; thay bằng `personnel/certifications/` |
| eqms-gmp-revisions | `review-comment-attachments/` | Không còn writer |
| eqms-gmp-revisions | `forms/eform-sessions/` | Không còn writer |
| eqms-gmp-revisions | `documents/`, `controlled-copies/`, `forms/executed-records/`, `personnel/`, `reports/`, `uncontrolled-copies/`, `templates/` | Dữ liệu cũ; có tham chiếu DB |

### 11.4 Việc còn lại trong phạm vi sắp xếp MinIO
- Không đổi thêm prefix nào cho file mới: cấu trúc đã thống nhất và ổn định.
- Quyết định D3 (tài nguyên đào tạo) vẫn mở. Khi quyết, thêm `training/` vào bucket phù hợp với chính sách khóa của quyết định đó.
- Dọn khóa `minioBasePath` trong cấu hình (không ảnh hưởng dữ liệu).
- Sao lưu: nằm ngoài phạm vi lần này theo yêu cầu.

## 12. Đề xuất chuẩn (ĐÃ THAY THẾ bởi mục 13)

Mục 2 và mục 11 là các bản trước; **mục 12 thay thế cho cả hai** khi được phê duyệt.

### 12.1 Nguyên tắc
1. **Nhóm cấp đầu = loại dữ liệu nghiệp vụ**, mỗi nhóm có một chính sách backup/restore riêng. Không tổ chức theo loại file (pdf, docx).
2. **Thư mục entity dùng ID bất biến** (UUID) làm tên thư mục cuối. Số tài liệu, số bản sao chỉ là đoạn đọc được phía trước, không dùng để định danh.
3. **Một entity = một thư mục gốc.** Mọi file thuộc entity nằm dưới thư mục đó, để restore một entity không phải lục nhiều nơi.
4. **Dữ liệu cũ không di chuyển** (D1). Quy tắc này chỉ áp dụng cho file mới.
5. Đường dẫn trong DB là nguồn sự thật (URI đầy đủ), nên cấu trúc có thể thay đổi mà không làm hỏng tham chiếu cũ.

### 12.2 eqms-gmp-records (khóa COMPLIANCE — bản ghi GMP)
```
documents/{số-tài-liệu}/{revisionId}/
    source/        file gốc
    review/        bản review snapshot
    publishing/    bản xem trước xuất bản
    published/     bản chính thức đã phát hành
controlled-copies/{số-lô}/{copyId}/
    issued.pdf     bản đã cấp
    evidence/      bằng chứng (ảnh, scan)
controlled-copies/recall-scans/{batchId}/{itemId}/
uncontrolled-copies/{số-bản-sao}/{copyId}/
forms/{formDocumentId}/executed-records/{recordId}/
personnel/{userId}/certifications/{certificationId}/
reports/{mã-báo-cáo}/{yyyy}/{mm}/{runId}/
training/materials/{materialId}/{versionId}/     (chờ D3)
training/evidence/{courseId}/{assessmentId}/      (chờ D3)
```

### 12.3 eqms-templates (không khóa — có thể sửa theo change control)
```
publishing/{loại-tài-liệu}/{cover|header|body|footer|logo|component}/...
publishing/templates/{templateId}/v{version}/...
document-content/{loại}/{số-mẫu}/revisions/{revisionId}/source/
```

### 12.4 Quy ước đặt tên
- Tên thư mục cuối luôn là UUID. Số hiển thị (số tài liệu, số bản sao, mã báo cáo) nằm ở thư mục cha để người đọc dễ tìm.
- Không dùng tên file gốc người dùng làm định danh; file gốc được đặt tên theo quy tắc trên, tên gốc giữ trong DB.

### 12.5 Ý nghĩa cho backup và restore
- **Backup**: sao lưu theo bucket (chính sách khóa khác nhau), nhưng nhóm cấp đầu cho phép lập lịch và kiểm tra phạm vi riêng cho từng nhóm.
- **Restore một entity**: khôi phục đúng một thư mục UUID và đối chiếu với DB theo ID, không cần tìm theo tên.
- **Đối soát**: mỗi nhóm đối soát được độc lập: DB có tham chiếu mà file không có, hoặc file mà không entity nào trỏ tới.

### 12.6 Thay đổi code khi được phê duyệt
- `StoragePathBuilder`: đổi cấu trúc khóa cho các hàm tạo đường dẫn file mới.
- `FileStorageService`: các khóa ghi cứng (`forms/executed-records/`, `personnel/certifications/`, `controlled-copies/recall-scans/`).
- `ReportPlatformService`: khóa báo cáo (giữ mã báo cáo).
- Kiểm thử: định tuyến và cấu trúc khóa mới; đối chiếu sau khi triển khai.

### 12.7 Hạn chế đã biết
- Cấu trúc theo **số tài liệu** phía trước là có chủ ý để con người đọc được. Nếu số tài liệu đổi (hiếm), thư mục cha không đổi vì revision ID đã bất biến và DB giữ đường dẫn đầy đủ.
- `documents/{số-tài-liệu}/{revisionId}` chưa có document ID trong đường dẫn vì các hàm ghi hiện chỉ nhận số tài liệu. Thêm document ID đòi hỏi đổi chữ ký nhiều hàm; đề xuất để sau.
- Thư mục `verification/` từ kiểm thử nằm ngoài cấu trúc trên. Không thể xóa vì khóa COMPLIANCE, cần ghi nhận là ngoại lệ.

## 13. CẤU TRÚC CHUẨN ĐÃ ÁP DỤNG (2026-10-08) — thay thế các mục 2, 11, 12

### 13.1 Quyết định và lý do
Giữ nguyên hình dạng khóa đang dùng, vì nó **đã** theo nhóm dữ liệu và đã chứa ID bất biến; đổi hình thức chỉ để giống bản vẽ sẽ thêm rủi ro mà không có lợi ích. Phần được làm chặt:
1. **Mọi khóa được tạo ở một nơi** (`StoragePathBuilder`); không còn chuỗi ghi cứng rải rác.
2. **Bộ đăng ký nhóm dữ liệu** (`StorageDomain`): một khóa phải thuộc đúng một nhóm đã đăng ký, nếu không bị từ chối **trước khi** được lưu hay quét. Lý do: một thư mục lạ trong bucket khóa sẽ không bao giờ xóa được.
3. **`temp/` không phải nhóm hợp lệ**: file tạm không bao giờ được ghi vào bucket không xóa được.
4. **Bucket chọn theo nhóm**, và mỗi object được gắn nhãn `domain` (cùng `sha256` đã có) để đối soát hoặc khôi phục theo nhóm.
5. **Prefix là cố định trong code, không còn cấu hình được** (cập nhật 2026-10-08). Giá trị prefix còn sót trong cấu hình cũ bị bỏ qua ở backend, và phần "Storage Prefix Configuration" trong màn Integrations đã thay bằng "Storage Layout" chỉ đọc. Lý do: quản trị viên đổi nhầm prefix sẽ đưa file mới ra ngoài cấu trúc mà backup/restore dựa vào, trong bucket không xóa được.

### 13.2 Cấu trúc
```
eqms-gmp-records/  (Object Lock COMPLIANCE, retention vĩnh viễn)      ← nhóm sao lưu/khôi phục
  documents/{số-tài-liệu}/revisions/{revisionId}/{source|review|publishing|published}/
  controlled-copies/{số-lô}/copies/{số-bản-sao}_{copyId}/{issued.pdf | evidence/}
  controlled-copies/recall-scans/{batchId}/{itemId}/
  uncontrolled-copies/{số-bản-sao}/{copyId}/
  forms/executed-records/{formDocumentId}/{recordId}/
  personnel/certifications/{userId}/{certificationId}/
  reports/{mã-báo-cáo}/{yyyy}/{mm}/{runId}/{artifactId}.{ext}
  training/…  audit/…   (đã đăng ký, chưa ghi; chờ quyết định D3)
eqms-templates/    (không khóa, versioning)
  templates/publishing/…   templates/document-content/…
eqms-gmp-revisions/ (cũ, chỉ đọc)   documents/ controlled-copies/ forms/ personnel/ reports/ revisions/ …
```
Quy tắc tên: thư mục cuối của mỗi entity là UUID bất biến; số hiển thị (số tài liệu, số bản sao, mã báo cáo) chỉ nằm ở thư mục cha để người đọc dễ tìm.

### 13.3 Retention vĩnh viễn
- "Permanent" = **100 năm**, mức tối đa Object Lock chấp nhận (không có chế độ vô hạn thật). Là mặc định mới (backend, compose, cấu hình dev, màn Integrations).
- Chỉ áp dụng cho object ghi **sau** thay đổi. Object cũ giữ thời hạn đã ghi (5 năm).
- **Hệ quả không đảo ngược:** trong chế độ COMPLIANCE không ai, kể cả quản trị viên MinIO, rút ngắn hoặc xóa được trước hạn. Mọi file ghi vào `eqms-gmp-records`, kể cả file nhập nhầm hay dữ liệu thử, tồn tại đến hết hạn và chiếm dung lượng tương ứng. Cần quy trình kiểm tra trước khi tải lên, và dung lượng phải được dự báo.
- Quy định bảo vệ dữ liệu cá nhân (quyền xóa) có thể xung đột với lưu giữ vĩnh viễn; nên có ý kiến pháp lý/QA trước khi dùng cho dữ liệu thật.
- Nhân viên không thể sửa retention của bản ghi đã ghi; chỉ có thể **kéo dài** từng object bằng thao tác riêng (chưa làm).

### 13.4 Kiểm thử
`StorageLayoutTest` (8 test: khóa thuộc nhóm đã đăng ký, hình dạng khóa ổn định, chống thoát thư mục, từ chối khóa lạ, prefix cấu hình, định tuyến bucket, giới hạn retention) và `MinioStorageLiveTest` (chạy trên MinIO + ClamAV thật; không ghi gì vào bucket khóa).

### 13.5 Chưa làm / ghi nhận
- Chưa kéo dài retention cho object đã ghi trong hai bucket.
- Màn hình Integrations: bản build frontend chưa được tạo lại.
- Thư mục `verification/` của lần kiểm thử trước nằm ngoài cấu trúc và không xóa được (ngoại lệ đã ghi nhận).
- Document ID chưa nằm trong đường dẫn tài liệu (các hàm ghi chỉ nhận số tài liệu).
