SDS-BR-001 · Bản nháp 1.53 · 2026-10-15

# SDS Backup & Restore và Backup & Restore Administration

Đặc tả thiết kế phần mềm cho sao lưu, phục hồi và phục hồi sau thảm họa của hệ thống eQMS, triển khai on-premises, theo EU-GMP.

**Trạng thái:** ĐỀ XUẤT, chưa được duyệt. **TẠM DỪNG từ 2026-10-15** theo yêu cầu của chủ dự án (xem 23.9 và 24.3).

**Phạm vi:** Module Backup & Restore, Administration, agent, API, DB

**Hiện trạng code:** Chỉ giao diện mẫu, chưa có backend

**Đọc bởi:** Chủ dự án, QA, IT, dev

**ĐÃ KIỂM TRA** thấy trong code hoặc hệ thống dev

**ĐỀ XUẤT** thiết kế của người soạn

**QUYẾT ĐỊNH** chủ nghiệp vụ / QA phải chốt

**THIẾU** chưa có trong hệ thống

## Mục lục

- 0 Kiểm soát tài liệu
- 1 Trả lời nhanh 14 câu hỏi
- 2 Hiện trạng
- 3 Kiến trúc
- 4 Dữ liệu cần backup và dữ liệu restore được (Q1, Q2)
- 5 Chế độ backup (Q3)
- 6 Nơi lưu trữ (Q4)
- 7 Định dạng và xem bản backup bằng công cụ chuyên dụng (Q5)
- 8 Bảo vệ bản backup khỏi can thiệp, ghi đè, chỉnh sửa (Q14)
- 9 Vai trò, phê duyệt, phân tách nhiệm vụ (Q10)
- 10 Đánh giá tác động trước khi backup và restore (Q7)
- 11 Ngữ nghĩa và quy trình restore (Q8)
- 12 Mất dữ liệu: xử lý thế nào (Q9)
- 13 Phục hồi sau thảm họa (Q11)
- 14 Kiểm tra tính toàn vẹn và tuân thủ EU-GMP (Q12)
- 15 Lên lịch backup (Q13)
- 16 Thanh tra và rà soát (Q6)
- 17 Mô hình dữ liệu (DB điều khiển eqms_backup_control )
- 18 Đặc tả API
- 19 Đặc tả giao diện
- 20 Backup Agent
- 21 Giám sát và cảnh báo
- 22 Validation và kiểm thử
- 23 Kế hoạch triển khai và cách xác minh
- 24 Quyết định, rủi ro, giới hạn

SDS-BR-001 · Bản nháp 1.52 · 2026-10-10

# SDS Backup & Restore và Backup & Restore Administration

Đặc tả thiết kế phần mềm cho sao lưu, phục hồi và phục hồi sau thảm họa của hệ thống eQMS, triển khai on-premises, theo EU-GMP.

**Trạng thái:** ĐỀ XUẤT, chưa được duyệt

**Phạm vi:** Module Backup & Restore, Administration, agent, API, DB

**Hiện trạng code:** Chỉ giao diện mẫu, chưa có backend

**Đọc bởi:** Chủ dự án, QA, IT, dev

**ĐÃ KIỂM TRA** thấy trong code hoặc hệ thống dev

**ĐỀ XUẤT** thiết kế của người soạn

**QUYẾT ĐỊNH** chủ nghiệp vụ / QA phải chốt

**THIẾU** chưa có trong hệ thống

## 0 Kiểm soát tài liệu

Tài liệu này không phải bằng chứng As-Is và không phải phê duyệt GMP. Các điều khoản Annex 11, PIC/S PI 041 được nêu theo hiểu biết của người soạn và **QA phải xác nhận số điều khoản** trước khi đưa vào hồ sơ validation. Mọi giá trị có nhãn QUYẾT ĐỊNH (RPO, RTO, thời hạn lưu, lịch) là giá trị khởi điểm để thảo luận, chưa được phê duyệt.

| Mục | Nội dung |
| --- | --- |
| Tài liệu liên quan | `docs/plans/BACKUP_RESTORE_DISASTER_RECOVERY_DESIGN.md` (thiết kế khái niệm), `docs/plans/MINIO_STORAGE_LAYOUT_CHANGE_PLAN.md` mục 13 (cấu trúc MinIO), `eqms-backend/docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md` (mẫu hồ sơ thay đổi) |
| Nguyên tắc | Mỗi giai đoạn triển khai (mục 23) là một thay đổi có hồ sơ riêng, có bằng chứng âm tính, đồng thời và lỗi. Không dùng văn bản hiển thị để làm giá trị máy (trạng thái, quyền, mã chính sách). |
| Ngôn ngữ | Tiếng Việt; tên màn hình, mã quyền, mã trạng thái giữ tiếng Anh như trong giao diện. |

## 1 Trả lời nhanh 14 câu hỏi

| # | Câu hỏi | Trả lời ngắn | Mục |
| --- | --- | --- | --- |
| 1 | Dữ liệu nào cần và có thể backup | PostgreSQL toàn bộ; mọi bucket MinIO kèm **mọi version**; file ở `local/nas` nếu có; cấu hình không bí mật; ledger của chính hệ thống backup. Bí mật vận hành lưu riêng. Redis, OnlyOffice, ClamAV, Mailhog, Adminer không backup. | 4 |
| 2 | Dữ liệu nào restore được | Toàn hệ thống (DB thay thế, object bổ sung); chỉ object (sửa file hỏng/mất, bổ sung theo version); mọi thứ vào môi trường validation. **Không** restore từng bản ghi vào production. | 4, 11 |
| 3 | Tăng dần hay toàn bộ | DB: full hằng đêm cộng lưu WAL liên tục (khôi phục tới thời điểm). Object: tăng dần theo version (vì bất biến), kèm manifest đầy đủ. Cấu hình: full. | 5 |
| 4 | Lưu ở đâu | Quy tắc 3-2-1-1 với bốn loại đích: thư mục máy chủ, NAS, MinIO thứ hai khóa COMPLIANCE ở nơi khác, phương tiện ngoại tuyến. Tối thiểu một bản ngoài cơ sở và một bản bất biến mới được kích hoạt policy. Mang bản backup đi nơi khác bằng Export Backup Set (gói tự chứa, mã hóa, có biên nhận). | 6, 6.5 |
| 5 | Mở bản backup bằng công cụ chuyên dụng | Được. Định dạng mở: `pg_dump -Fc`, file gốc, JSON, SHA-256, OpenPGP. Có chế độ Backup Inspection chỉ đọc trong môi trường validation. | 7 |
| 6 | Thanh tra review | Được. Tài khoản thanh tra giới hạn thời gian, quyền chỉ đọc; Backup History, Restore History & Evidence, Evidence Pack có ký số; xem chuỗi băm của ledger. | 16 |
| 7 | Đánh giá tác động trước khi làm | Pre-Backup Check tự động; Restore Impact Report tính từ DB hiện tại (cửa sổ mất dữ liệu, bản ghi sau thời điểm backup, job đang chạy) cộng bảng đánh giá GMP do người dùng điền. | 10 |
| 8 | Ghi đè hay trùng lặp | DB: **thay thế toàn bộ** qua DB mới rồi hoán đổi, DB cũ giữ làm bản an toàn. Object: **chỉ bổ sung**, không ghi đè. Trùng lặp được chặn bằng tắt scheduler và job dở dang chuyển trạng thái rà soát. | 11 |
| 9 | Mất dữ liệu thì làm gì | Cây quyết định theo loại sự cố, mỗi nhánh ánh xạ tới một chức năng cụ thể. | 12 |
| 10 | Cần người review, approve không | Có. Admin không tự làm 100%. Restore production: người yêu cầu, người duyệt (QA, khác người), người thực thi, người ký xác nhận sau restore. Máy chủ chặn trùng người. | 9 |
| 11 | Phục hồi sau thảm họa | Gói dựng lại ngoại tuyến, runbook D0-D10, tuyên bố DR do hai người có thẩm quyền, diễn tập hằng quý đo thời gian thật so với RTO. | 13 |
| 12 | Toàn vẹn và EU-GMP | Bốn tầng kiểm tra V1-V4, danh mục kiểm tra sau restore có tiêu chí đạt, ánh xạ điều khoản, kế hoạch validation IQ/OQ/PQ. | 14, 22 |
| 13 | Lên lịch | Bảng lịch mặc định, quy tắc trùng lịch, bỏ lỡ lịch, múi giờ và DST, cửa sổ bảo trì. | 15 |
| 14 | Bảo vệ khỏi can thiệp | Thông tin xác thực chỉ ghi, không xóa; khóa COMPLIANCE; bản ngoại tuyến; manifest ký và chuỗi băm; ledger tách khỏi DB bị restore; mã hóa, khóa giải mã chỉ dùng trên máy thực thi cho restore đã duyệt; cô lập mạng. | 8 |

## 2 Hiện trạng

| Hạng mục | Trạng thái | Chi tiết |
| --- | --- | --- |
| Giao diện Backup & Restore | ĐÃ KIỂM TRA | Đã nối API thật: Backup Status Overview, Backup History, Backup Details, Backup Verification Results, Backup Schedules, Restore Requests (danh sách; chi tiết; ký điện tử khi duyệt và từ chối; menu thao tác), New Restore Request (form theo bước, danh sách backup phân trang ở server). Vẫn là dữ liệu mẫu: Restore History & Evidence, Restore Verification Reports, Disaster Recovery Drills. Đã gỡ: Restore Approval Queue (gộp vào Restore Requests). |
| Giao diện Administration | ĐÃ KIỂM TRA | 7 màn mẫu (`features/settings/backup-restore-administration/`): Backup Policy, Backup Retention & Legal Hold, Backup Storage & Encryption, Backup Verification & Restore Drills, Restore Approval & Execution Rules, Backup Alerts & Recipients, Disaster Recovery Plan. |
| Backend | CÓ MỘT PHẦN | API sao lưu (danh sách, chi tiết, tạo, kiểm tra), chính sách, đích, xuất, phương tiện, yêu cầu restore R0–R3 (có báo cáo tác động), kiểm tra restore thử và điều kiện restore 30 ngày. Backup Agent có DB điều khiển, sổ cái nối băm, sao lưu DB đã mã hóa và ký, kiểm tra V1, cổng bảo trì, Super Administrator, và tiến trình restore thử riêng. **Chưa có**: thực thi restore (R4–R12). |
| Quyền | ĐÃ KIỂM TRA | V485: `backup.module.view`. V556: `backup.admin.view` và 7 quyền `backup.admin.*.view`. V562–V566: quyền chính sách, xuất, kiểm thử đích và phương tiện, `backup.restore.test`, `backup.restore.request`, `backup.restore.approve`. V567: `backup.restore.execute` (chưa có tác dụng vì chưa có thực thi). |
| Hạ tầng | ĐÃ KIỂM TRA | Compose chạy: `postgres:17-alpine`, MinIO `RELEASE.2025-04-22`, Redis 7, ClamAV, OnlyOffice 8.2, Mailhog, Adminer, backend, frontend. Image backend **không có** `pg_dump` hay `mc`. Postgres chưa bật `archive_mode`. |
| Dữ liệu (máy dev) | ĐÃ KIỂM TRA | DB 134 bảng, ~322 MB (lớn nhất: `authorization_shadow_evaluation_events` 85 MB). MinIO ~366 MB. Bucket `eqms-gmp-records` khóa COMPLIANCE, retention 100 năm; `eqms-templates` không khóa; `eqms-gmp-revisions` cũ, chỉ đọc. Số liệu dev, không đại diện production. |
| Liên kết với Report | ĐỀ XUẤT, chưa làm | Báo cáo (Reports & Analytics) sẽ có thể dùng Backup & Restore làm một Report Type (mục 24.3). Hiện chưa có. |
| Điều hướng | ĐÃ KIỂM TRA | Menu lồng hai nhóm Backup và Restore (frontend `navigation.ts` và `NavigationService.java`). |

## 3 Kiến trúc

### 3.1 Nguyên tắc

1. **Mặt phẳng điều khiển tách khỏi dữ liệu.** Lịch sử backup, yêu cầu restore, phê duyệt phải **không** nằm trong DB eqms. Khi restore thay DB eqms, chúng sẽ bị thay theo và mất bằng chứng. Vì vậy dùng một cơ sở dữ liệu điều khiển riêng `eqms_backup_control` trên container riêng.
2. **Backend không thực thi backup.** Backend chỉ ghi yêu cầu và đọc kết quả. Việc chạy `pg_dump`, đọc MinIO, ghi đích do **Backup Agent** làm, với thông tin xác thực tối thiểu. Lý do: tiến trình web bị xâm nhập không được chạm vào bản backup; image backend không có công cụ cần thiết.
3. **Định dạng mở, chuẩn.** Để restore được cả khi phần mềm này không còn.
4. **Mọi thao tác ghi sổ cái nối băm** (hash chain), sao chép ra ngoài DB, để audit trail trong DB bị thay cũng không làm mất bằng chứng.

### 3.2 Thành phần

```
flowchart LR
  UI["Frontend: Backup and Restore"] --> API["eqms-backend: API, phân quyền, e-sign"]
  API -->|"ghi yêu cầu, đọc kết quả"| CDB[("eqms_backup_control: DB điều khiển, container riêng")]
  AG["eqms-backup-agent: chạy job"] -->|"nhận việc, ghi kết quả"| CDB
  AG -->|"pg_dump, WAL: tài khoản chỉ đọc"| PG[("PostgreSQL eqms")]
  AG -->|"GET theo versionId: chỉ đọc"| MN[("MinIO chính")]
  AG -->|"chỉ ghi, không xóa"| T1["Đích 1: thư mục máy chủ"]
  AG --> T2["Đích 2: NAS"]
  AG --> T3[("Đích 3: MinIO thứ hai, COMPLIANCE, nơi khác")]
  AG --> T4["Đích 4: phương tiện ngoại tuyến"]
  AG -->|"sổ cái nối băm"| LG["Ledger ngoài DB"]
  RS["Restore Worker: chỉ chạy trong cửa sổ được duyệt"] --> PG
  RS --> MN
  RS -->|"đọc"| T3
```

### 3.3 Container mới

| Container | Image / công nghệ | Vai trò | Mạng và quyền |
| --- | --- | --- | --- |
| `eqms-backup-control` | `postgres:17-alpine` | DB điều khiển: policy, run, set, approval, ledger. Volume riêng. | Chỉ nhận kết nối từ backend (vai trò `ctl_api`: đọc, ghi yêu cầu) và agent (`ctl_agent`). Không cho eqms DB kết nối. |
| `eqms-backup-agent` | Spring Boot (Java 21) + `postgresql-client-17` + MinIO Java SDK + `gnupg` | Backup, verify, purge theo hết khóa, ghi ledger. Hàng đợi việc dựa trên bảng `backup_job`. | Hệ tệp gốc chỉ đọc, user không phải root, mạng `backup-net` riêng. Vai trò PG `eqms_backup_ro` (`pg_read_all_data`, `REPLICATION`). Service account MinIO chỉ `GetObject, GetObjectVersion, ListBucket, ListBucketVersions`. Đích: chỉ `PutObject`, không `DeleteObject`. |
| `eqms-restore-worker` | cùng image agent, profile `restore` | Thực thi restore đã duyệt. | **Mặc định tắt.** Chỉ được bật cho một yêu cầu đã duyệt; thông tin xác thực ghi (`eqms_restore_rw`) được cấp theo yêu cầu, hết hạn sau cửa sổ bảo trì. |
| `eqms-backup-minio` (đích 3) | MinIO, **máy khác / địa điểm khác** | Bucket `eqms-backup-sets`, Object Lock COMPLIANCE, versioning. | Thông tin xác thực chỉ ghi cho agent; tài khoản đọc cho restore worker và thanh tra. |

Dev có thể chạy đích 3 trên cùng máy để thử luồng, nhưng giao diện phải đánh dấu "cùng máy chủ, không tính là ngoài cơ sở".

## 4 Dữ liệu cần backup và dữ liệu restore được (Q1, Q2)

| Mã | Dữ liệu | Nơi chứa | Backup | Restore |
| --- | --- | --- | --- | --- |
| D1 | PostgreSQL `eqms` (kể cả **large object**: 999 đối tượng trên DEV, nằm trong dump và được đếm trong manifest): tài liệu, revision, workflow, audit trail (`audit_logs`, `audit_log_changes`), chữ ký điện tử, `used_signature_tokens`, người dùng, quyền, policy, cấu hình, job, lịch sử Flyway | container postgres | **Bắt buộc.** Full + WAL | Thay thế toàn bộ. Từng phần chỉ vào validation |
| D2 | Bucket `eqms-gmp-records`: documents, controlled-copies, uncontrolled-copies, forms, personnel, reports (training, audit đã đăng ký, chờ dùng) | MinIO chính | **Bắt buộc.** Mọi version; tăng dần | Chỉ bổ sung object thiếu hoặc hỏng; không ghi đè |
| D3 | Bucket `eqms-templates` | MinIO chính | Bắt buộc, mọi version | Bổ sung theo version |
| D4 | Bucket `eqms-gmp-revisions` (cũ, chỉ đọc) | MinIO chính | Bắt buộc, mọi version | Bổ sung theo version |
| D5 | File ở `/app/storage` khi `document_revisions.storage_provider` là `local` hoặc `nas` | volume ứng dụng, NAS | Bắt buộc nếu có dòng dùng provider này. Agent chạy truy vấn `select distinct storage_provider` mỗi lần và ghi vào manifest; provider mới xuất hiện mà chưa cấu hình thì backup **thất bại có chủ đích** | Bổ sung |
| D6 | Cấu hình không bí mật: file compose, danh sách tên biến môi trường (không giá trị), tag và digest image, phiên bản ứng dụng, trạng thái Flyway | repo và máy chủ | Bắt buộc (config bundle) | Dùng trong dựng lại |
| D7 | Bí mật vận hành: `APP_AUTH_JWT_SECRET`, khóa MinIO, `ONLYOFFICE_JWT_SECRET`, mật khẩu DB, khóa mã hóa backup, khóa ký manifest | máy chủ / kho bí mật | **Không nằm trong bộ backup.** Cất riêng, hai người giữ (mục 8.4) | Thủ công theo runbook DR |
| D8 | DB điều khiển `eqms_backup_control` và ledger | container riêng | Bắt buộc, quy trình riêng: dump hằng ngày ra đích 3, ledger ghi ra ngoài theo thời gian thực | Chỉ trong DR, thủ công |
| D9 | Redis, phiên và cache OnlyOffice, chữ ký ClamAV, Mailhog, Adminer, prefix `temp` | - | Loại trừ (dựng lại được) | - |
| D10 | Nhật ký ứng dụng `eqms_backend_logs` | volume log | Theo chính sách lưu nhật ký riêng QĐ BR-4 | Không |
| D11 | `authorization_shadow_evaluation_events` (85 MB trên dev) | D1 | Mặc định **có** cho đến khi có quyết định loại trừ QĐ BR-4 | Cùng D1 |

### 4.1 Mức độ chi tiết của restore

| Mức | Vào production | Vào validation | Điều kiện |
| --- | --- | --- | --- |
| R-FULL: DB + object + config | Có, thay thế DB | Có | Mục 11 |
| R-DB: chỉ DB, tới thời điểm T | Có (PITR khi có WAL) | Có | Phải kiểm tra tham chiếu object sau restore |
| R-OBJ: bổ sung object theo bucket/prefix/version | Có, chỉ thêm | Có | Mỗi object phải khớp SHA-256 trong manifest |
| R-ONE: một object / một version | Có, chỉ thêm (sửa file mất hoặc hỏng) | Có | So với bản ghi DB tham chiếu |
| R-REC: một bản ghi / một tài liệu | **Không** | Có | Xem dữ liệu ở validation, rồi xử lý như hiệu chỉnh dữ liệu theo change control (mục 12) |

**Thứ tự chụp.** DB trước, rồi object. Object bất biến và không bị xóa, nên tập object liệt kê sau thời điểm `T_db` luôn chứa mọi object mà DB tại `T_db` tham chiếu. Manifest ghi cả `T_db` và `T_obj` để restore biết object nào là "mồ côi" (tạo sau `T_db`).

## 5 Chế độ backup (Q3)

| Thành phần | Phương pháp | Tần suất khởi điểm | Lý do |
| --- | --- | --- | --- |
| DB: full logic | `pg_dump -Fc --no-owner` trên snapshot nhất quán | Hằng ngày 02:00 | Định dạng chuẩn, restore chọn lọc được, mở bằng `pg_restore` trên bất kỳ phiên bản tương thích |
| DB: lưu WAL liên tục + base backup | `archive_mode=on`, `archive_command` gửi tới agent; `pg_basebackup` hằng tuần | WAL: tối đa 5 phút (`archive_timeout=300`); base: Chủ nhật 03:00 | Khôi phục tới đúng một thời điểm (PITR), RPO tính bằng phút. Annex 11 yêu cầu backup đều đặn; RPO 24 giờ cho chữ ký điện tử thường khó biện minh QĐ BR-1 |
| Object: tăng dần theo version | Agent `ListObjectVersions`, so với tập `(bucket,key,versionId)` đã có trong chuỗi, chỉ sao chép version mới và kiểm SHA-256 | Mỗi 4 giờ | Object bất biến nên tăng dần chính xác và rẻ: không có "thay đổi", chỉ có "mới" |
| Cấu hình | Full | Hằng ngày 01:30 và trước mỗi thay đổi (pre-change) | Nhỏ, cần bản đúng tại thời điểm thay đổi |
| Manifest "full view" | Manifest liệt kê **toàn bộ** object tồn tại, tham chiếu bộ nào giữ bản vật lý | Mỗi lần backup | Restore chỉ cần một manifest, không phải tự ghép chuỗi |
| Synthetic full | Mỗi tuần agent kiểm tra chuỗi và ghi manifest tổng | Hằng tuần | Phát hiện chuỗi gãy sớm |
| Pre-change | Chạy tay hoặc do change control kích hoạt trước nâng cấp, migration, bảo trì | Theo sự kiện | Điểm quay lui được đặt tên |

**Quy tắc chuỗi.** Bộ backup đang được manifest khác tham chiếu thì **không** được purge, kể cả khi hết hạn. Với BR-2 (không thời hạn) hệ thống **không bao giờ purge** bản backup production.

## 6 Nơi lưu trữ (Q4)

| Đích | Loại | Vai trò | Bất biến | Ngoài cơ sở |
| --- | --- | --- | --- | --- |
| T1 | `SERVER_FOLDER`, ví dụ `/backup/eqms` trên đĩa khác | Restore nhanh | Không | Không |
| T2 | `NETWORK_SHARE` (NAS riêng, NFS/SMB) | Bản thứ hai, thiết bị khác | Tùy snapshot của NAS | Không |
| T3 | `OBJECT_STORAGE`: MinIO thứ hai, bucket `eqms-backup-sets`, COMPLIANCE | Bản bất biến chính | **Có** | Có, nếu đặt ở địa điểm khác |
| T4 | `REMOVABLE_MEDIA`: ổ ngoài hoặc băng từ, luân chuyển | Bản ngoại tuyến | Có (ngoại tuyến) | Có |

### 6.1 Quy tắc kích hoạt policy

- Nút Activate ở Backup Policy bị chặn cho đến khi: ≥ 3 bản sao dữ liệu (nguồn + 2 đích), ≥ 2 loại phương tiện, ≥ 1 đích **ngoài cơ sở**, ≥ 1 đích **bất biến** (3-2-1-1). Giao diện hiện từng điều kiện đạt hay không và vì sao.
- Mỗi đích có kiểm tra thử: ghi một object thử, đọc lại, xác nhận SHA-256, thử xóa và **phải bị từ chối**. Kết quả ghi vào ledger.
- Không hỗ trợ tải bộ backup về PC qua trình duyệt (dung lượng, rò rỉ dữ liệu nhạy cảm). Chỉ cho tải `manifest.json`, Export Receipt và Evidence Pack. Muốn mang bản backup đi nơi khác dùng **Export Backup Set** (mục 6.5).

### 6.2 Bố cục trên đích

```
eqms-backup-sets/
  {môi-trường}/{yyyy}/{mm}/{backupId}/          backupId = BK-yyyyMMdd-HHmm-{seq}
    manifest.json   manifest.sig   SHA256SUMS
    database/eqms.dump.gpg          (full logic)
    database/wal/{timeline}/{segment}.gpg
    objects/{bucket}/{key}/@{versionId}.gpg   hoặc dạng không mã hóa nếu policy cho phép (mục 7)
    config/config-bundle.tar.gpg
  _ledger/{yyyy}/{mm}/{yyyyMMdd}.jsonl         sổ cái nối băm, ghi thêm
  _control-db/{yyyyMMdd}/eqms_backup_control.dump.gpg
```

### 6.3 Dự báo dung lượng

`Dung lượng ≈ DB_full × số_bản_giữ + Σ object_mới_mỗi_ngày × số_ngày_giữ + WAL_ngày × số_ngày_WAL_giữ`. Màn Storage hiển thị mức dùng, tốc độ tăng theo 30 ngày và ngày dự kiến đầy; cảnh báo khi còn ít hơn 60 ngày. Đích 3 dùng COMPLIANCE nên dung lượng chỉ giảm khi hết hạn khóa: phải dự báo trước khi bật.

### 6.4 Thời hạn lưu ĐÃ CHỐT BR-2: không thời hạn

Bản backup của production được giữ **vĩnh viễn**: không có chức năng xóa theo tuổi, không có job purge. Cơ chế:

- Đích có Object Lock (T3) đặt retention **100 năm**, mức tối đa MinIO chấp nhận, giống bucket `eqms-gmp-records`. Không có chế độ "vô hạn" thật.
- Đích không khóa (T1, T2, T4) không có tự xóa; việc hủy phương tiện vật lý chỉ qua biên bản hủy (mục 6.5.3) và chỉ khi QA cho phép.
- Màn **Backup Retention & Legal Hold** hiển thị "Vĩnh viễn" cho mọi loại, chỉ đọc. Legal hold vẫn có để chặn việc hủy phương tiện và đánh dấu bản liên quan đến điều tra.

**Hệ quả cần chấp nhận.** (1) Dung lượng chỉ tăng, không bao giờ giảm: phải dự báo và mở rộng đích định kỳ (mục 6.3). (2) Bản backup **ghi nhầm hoặc là dữ liệu thử cũng tồn tại 100 năm** trên đích khóa: vì vậy dev và validation phải dùng đích riêng, retention ngắn, và tuyệt đối không trỏ vào đích production. (3) Dữ liệu cá nhân trong backup vĩnh viễn có thể xung đột với quyền xóa của chủ thể dữ liệu, cần ý kiến pháp lý/QA (rủi ro đã ghi ở 24.2). (4) Chuỗi tham chiếu (mục 5) không bao giờ được giải phóng, nên chuỗi càng dài thì manifest "full view" càng lớn: cần định kỳ ghi một bản đầy đủ mới để rút ngắn đường restore.

### 6.5 Export Backup Set: mang bản backup đi lưu ở nơi khác

Một bản backup là một thư mục nhiều phần, và backup object chạy tăng dần nên bản mới chỉ chứa object mới. Chỉ copy bản mới nhất thì **không đủ để restore độc lập**. Vì vậy hệ thống có chức năng **Export Backup Set**: đóng gói một bản **tự chứa** (theo manifest "full view") ra phương tiện đã đăng ký, có kiểm tra, có dấu vết.

#### 6.5.1 Gói xuất gồm gì

```
EXPORT-{backupId}-{yyyyMMdd}/
  README-RESTORE.txt            hướng dẫn dùng độc lập, không cần phần mềm eQMS
  manifest.json  manifest.sig  SHA256SUMS
  database/eqms.dump.gpg
  objects/{bucket}/{key}/@{versionId}.gpg     mọi object mà manifest tham chiếu, kể cả từ các bản trước
  config/config-bundle.tar.gpg
  tools/verify-chain.sh, verify-chain.ps1     xác minh SHA-256, chữ ký, chuỗi băm
  public-keys/                                khóa công khai ký manifest
  EXPORT-RECEIPT.json  EXPORT-RECEIPT.sig     biên nhận xuất (ghi cuối cùng)
```

- Gói **luôn được mã hóa**, kể cả khi policy cho phép lưu object không mã hóa trên đích thường. Khóa giải mã **không đi cùng gói**.
- Kích thước = tổng kích thước mọi object được manifest tham chiếu + DB + config. Giao diện hiển thị trước khi xuất.
- Agent đọc từ đích T1/T3 (không đọc từ production đang chạy), nên xuất không làm chậm hệ thống.

#### 6.5.2 Điều kiện và quy trình

| Bước | Ai | Việc | Cổng |
| --- | --- | --- | --- |
| E0 | Operator | Chọn bản backup trong Backup History → Export Backup Set; chọn phương tiện đã đăng ký; nhập lý do | Bản backup **VERIFIED** (V1 đạt); phương tiện ở trạng thái AVAILABLE |
| E1 | Hệ thống | Kiểm tra: đường dẫn nằm trong danh sách cho phép của phương tiện, **không cùng đĩa vật lý với T1**, dung lượng trống ≥ 1,1 × kích thước gói, không có restore đang chạy | Mọi kiểm tra đạt |
| E2 | Backup Administrator | Duyệt yêu cầu (người khác Operator) | Hai người QĐ BR-14 |
| E3 | Agent | Dựng gói, ghi ra phương tiện, **đọc lại và đối chiếu SHA-256 từng file**, ghi biên nhận cuối cùng | 100% khớp; thiếu biên nhận = gói không hợp lệ |
| E4 | Hệ thống | Ghi ledger `BACKUP_EXPORTED` (ai, bản nào, phương tiện nào, thời gian, SHA-256 biên nhận); đổi trạng thái phương tiện sang `IN_TRANSIT` | - |
| E5 | Người giao và người nhận | Bàn giao vật lý; ghi người giữ và nơi cất (Offline Media Register); xác nhận bàn giao trong hệ thống | Hai người xác nhận; trạng thái sang `STORED_OFFSITE` |

Gói ghi dở hoặc kiểm tra lỗi được đánh dấu `INVALID`, không được liệt kê là bản hợp lệ ở bất kỳ màn nào, và phương tiện phải xóa an toàn trước khi dùng lại.

#### 6.5.3 Sổ đăng ký phương tiện ngoại tuyến (Offline Media Register)

Nằm trong màn **Backup Storage & Encryption**. Mỗi phương tiện là một dòng, không dùng phương tiện chưa đăng ký.

| Trường | Ý nghĩa |
| --- | --- |
| Mã nhãn, số serial, loại (ổ cứng, băng từ), dung lượng | Nhận dạng vật lý; nhãn dán trên phương tiện trùng mã hệ thống |
| Trạng thái (`AVAILABLE, IN_TRANSIT, STORED_OFFSITE, IN_READ_TEST, QUARANTINED, RETIRED`) | Vòng đời; chỉ `AVAILABLE` mới xuất được |
| Người giữ, nơi cất, ngày bàn giao | Chuỗi trách nhiệm |
| Các gói đang chứa (mã, ngày, SHA-256 biên nhận) | Biết phương tiện nào giữ bản nào |
| Lần kiểm tra đọc cuối cùng, kết quả | Phát hiện hỏng phương tiện trước khi cần dùng |
| Ngày hết hạn sử dụng, biên bản hủy | Khi `RETIRED` phải có bằng chứng hủy an toàn (dữ liệu cá nhân) |

#### 6.5.4 Luân chuyển và kiểm tra phương tiện QĐ BR-13

- Tối thiểu **hai phương tiện luân phiên**: một đang cất ngoài cơ sở, một đang chờ xuất; không bao giờ để duy nhất một bản ngoại tuyến.
- Tần suất xuất khởi điểm: hằng tuần một bản full-view; giữ theo thời hạn BR-2. Gợi ý ông-cha-con (tuần, tháng, năm) để thảo luận, chưa phê duyệt.
- **Kiểm tra đọc hằng quý** cho từng phương tiện: mang về, giải mã trên máy kiểm tra theo biên bản, chạy `verify-chain`, ghi kết quả. Phương tiện lỗi chuyển `QUARANTINED` và gói đó được xuất lại ngay.
- Thay phương tiện theo tuổi thọ nhà sản xuất hoặc khi có lỗi đọc.
- Quá hạn kiểm tra đọc hoặc chỉ còn một phương tiện hợp lệ: cảnh báo (mục 21).

#### 6.5.5 Nhập lại để restore: Register Imported Set

Khi cần dùng bản trên phương tiện (DR hoặc đích khác hỏng), người có quyền gắn phương tiện và chọn **Register Imported Set**. Hệ thống chỉ chấp nhận khi: chữ ký manifest đúng với khóa công khai đã ghi; `previousManifestSha256` và SHA-256 biên nhận khớp ledger (hoặc, nếu ledger mất, khớp bản in trong Rebuild Kit); mọi file khớp SHA256SUMS. Sau đó gói dùng như một đích thường cho restore (mục 11). Mọi lần gắn và đọc ghi ledger.

#### 6.5.6 Những điều không cho phép

- Xuất ra đường dẫn chưa đăng ký, hoặc bản backup chưa VERIFIED.
- Xuất trong lúc đang restore.
- Tải gói qua trình duyệt, hoặc gửi gói qua email/mạng chưa được duyệt.
- Sao chép tay ngoài ứng dụng được coi là ngoài kiểm soát: không có biên nhận, không vào sổ cái, không dùng để Register Imported Set.

**Legal hold.** Xuất bản đang bị legal hold là **được phép** (copy không làm mất khóa), nhưng bản copy không mang hiệu lực khóa. Phương tiện chứa nó phải được ghi trong sổ đăng ký là "chứa dữ liệu đang giữ pháp lý" và không được hủy cho đến khi gỡ hold.

**Dữ liệu cá nhân.** Mỗi phương tiện là thêm một bản chứa dữ liệu cá nhân; quy trình hủy và quyền xóa của chủ thể dữ liệu cần ý kiến pháp lý/QA (đã nêu ở rủi ro mục 24.2).

## 7 Định dạng và xem bản backup bằng công cụ chuyên dụng (Q5)

Có. Mọi thành phần dùng định dạng mở nên không phụ thuộc phần mềm eQMS.

| Thành phần | Định dạng | Mở bằng |
| --- | --- | --- |
| Database | PostgreSQL custom `pg_dump -Fc` | `pg_restore --list` (xem mục lục), `pg_restore -f out.sql` (xem SQL), hoặc restore vào DB tạm rồi xem bằng `psql`, DBeaver, Adminer |
| Object | File gốc (PDF, DOCX, ...) giữ nguyên key | Trình đọc thông thường sau khi giải mã |
| Manifest | JSON | `jq`, trình soạn thảo bất kỳ |
| Băm | `SHA256SUMS` | `sha256sum -c SHA256SUMS` |
| Chữ ký manifest | Ed25519 | `openssl pkeyutl -verify` hoặc `minisign -V` với khóa công khai (khóa công khai in trong gói dựng lại) |
| Mã hóa | OpenPGP, AES-256 | `gpg --decrypt` với khóa do hai người giữ |
| Ledger | JSON Lines | `jq`, script xác minh chuỗi băm (kèm trong gói dựng lại) |

### 7.1 Ví dụ `manifest.json`

```
{
  "schema": "eqms-backup-manifest/1",
  "backupId": "BK-20261008-0200-0001",
  "type": "FULL", "trigger": "SCHEDULED", "environment": "prod",
  "startedAt": "2026-10-08T02:00:03Z", "dbSnapshotAt": "2026-10-08T02:00:05Z", "objectListedAt": "2026-10-08T02:03:41Z",
  "app": { "version": "x.y.z", "imageDigest": "sha256:...", "flywayLatest": "V561", "postgres": "17.x" },
  "providers": ["minio"],
  "components": [
    { "key": "DATABASE", "file": "database/eqms.dump.gpg", "sizeBytes": 123456789, "sha256": "...", "rowCounts": { "audit_logs": 1203441, "document_revisions": 8342 } },
    { "key": "OBJECT_STORE", "objects": 52341, "bytes": 912345678, "newInThisSet": 188, "refs": [ { "bucket": "eqms-gmp-records", "key": "documents/...", "versionId": "...", "sha256": "...", "heldBy": "BK-20261001-0200-0001" } ] },
    { "key": "CONFIGURATION", "file": "config/config-bundle.tar.gpg", "sha256": "..." }
  ],
  "previousManifestSha256": "...",
  "signature": { "alg": "Ed25519", "keyId": "bk-sign-2026-1", "file": "manifest.sig" }
}
```

### 7.2 Chế độ Backup Inspection

Người được cấp quyền (mục 16) chọn một bộ backup và bấm "Inspect read-only". Hệ thống: (1) giải mã trong vùng tạm của **môi trường validation**, (2) restore DB vào một database tạm `inspect_{id}`, (3) trỏ một bản ứng dụng chỉ đọc vào đó, (4) tự hủy sau thời gian giới hạn. Không bao giờ chạm production. Mọi lần inspect ghi ledger với người, lý do, thời gian.

Mở một bản backup production là truy cập toàn bộ dữ liệu GMP và dữ liệu cá nhân. Vì vậy cần lý do, người duyệt đã chỉ định, và giới hạn thời gian.

## 8 Bảo vệ bản backup khỏi can thiệp, ghi đè, chỉnh sửa (Q14)

### 8.1 Mô hình mối đe dọa

| Mối đe dọa | Biện pháp |
| --- | --- |
| Quản trị viên ứng dụng xóa hoặc sửa bản backup | Ứng dụng **không có** thông tin xác thực xóa trên đích. Agent chỉ có `PutObject`. Xóa là việc của hết hạn khóa, không phải của người. |
| Ransomware mã hóa máy chủ | T3 COMPLIANCE ở địa điểm khác và T4 ngoại tuyến không bị mã hóa được; thông tin xác thực của T3/T4 không nằm trên máy chủ chính. |
| Xâm nhập backend | Backend không chạm đích, không giữ khóa mã hóa, không chạy `pg_dump`. Kẻ tấn công chỉ ghi được "yêu cầu", và yêu cầu restore còn phải qua duyệt. |
| Sửa nội dung rồi giả mạo manifest | Manifest ký Ed25519; khóa ký chỉ ở agent; mỗi manifest băm manifest trước (hash chain); ledger đối chiếu hằng ngày. |
| Sửa lịch sử ("chưa từng có lần backup lỗi") | Ledger ngoài DB eqms, thêm-vào-cuối, nối băm, bản sao ra đích bất biến; DB điều khiển `REVOKE UPDATE, DELETE` trên bảng sự kiện và có trigger chặn. |
| Đổi policy để giảm bảo vệ (rút ngắn lưu, tắt đích) | Hai người, lý do, e-sign; đổi policy không xóa gì đã có; cảnh báo cho QA. |
| Đánh cắp bản backup | Mã hóa AES-256; khóa tách khỏi bản backup; hai người giữ; truy cập đích có log. |
| Sai lệch đồng hồ làm hỏng chứng cứ thời gian | NTP bắt buộc; agent từ chối chạy nếu lệch hơn ngưỡng; thời gian lưu UTC. |
| Phụ thuộc một lỗi duy nhất | DB điều khiển, agent, đích 3, khóa: miền hỏng riêng. |
| Image/agent bị thay | Image ghim digest, hệ tệp gốc chỉ đọc, build có chữ ký; digest in trong manifest. |

### 8.2 Quyền tối thiểu của từng định danh

| Định danh | PostgreSQL eqms | MinIO chính | Đích backup | Khóa |
| --- | --- | --- | --- | --- |
| Agent | `eqms_backup_ro` | chỉ đọc theo version | chỉ ghi | khóa công khai mã hóa, khóa ký |
| Restore worker | `eqms_restore_rw`, cấp theo yêu cầu | ghi bổ sung, không xóa | chỉ đọc | khóa giải mã, chỉ trong cửa sổ |
| Backend | quyền ứng dụng thường | quyền ứng dụng thường | **không có** | **không có** |
| Thanh tra | - | - | đọc manifest, ledger | - |

### 8.3 Sổ cái nối băm

```
{"seq":1842,"at":"2026-10-08T02:04:11Z","actor":"agent","event":"BACKUP_COMPLETED","ref":"BK-20261008-0200-0001",
 "data":{"manifestSha256":"..."},"prevHash":"9a1c...","hash":"sha256(prevHash || canonical-json(this without hash))"}
```

Hằng ngày job `ledger-verify` duyệt lại chuỗi, so với bản sao ở đích 3, và ghi kết quả. Chuỗi gãy là cảnh báo mức cao nhất. Mỗi 24 giờ `hash` mới nhất được ghi vào audit trail của eqms và gửi email cho QA, để có mốc đối chiếu ngoài hệ thống backup.

### 8.4 Quản lý khóa

- Khóa mã hóa backup sinh một lần trong lễ cài đặt, có biên bản. Khóa công khai nằm ở agent để mã hóa, nên backup không cần khóa bí mật.
- Khóa giải mã (khóa bí mật) không nằm trên agent và không nằm trên máy chủ ứng dụng. Nó được đặt lên **máy thực thi restore** (restore worker) chỉ khi có một yêu cầu restore đã được duyệt đang chạy, và được gỡ khi xong. Việc đặt và gỡ khóa được ghi vào ledger.
- Một bản sao khóa giải mã được cất niêm phong ở nơi khác, theo biên bản, để dựng lại khi mất máy. Ai cất bản sao và cách lấy ra do Disaster Recovery Plan quy định.
- Khóa ký manifest: sinh ở agent, khóa công khai in trong gói dựng lại và ghi vào ledger.
- Xoay khóa hằng năm; bản cũ giữ để đọc backup cũ. **Mất khóa giải mã nghĩa là mất toàn bộ backup đã mã hóa**: diễn tập định kỳ phải bao gồm giải mã từ bản sao đã cất.

## 9 Vai trò, phê duyệt, phân tách nhiệm vụ (Q10)

Trả lời: **Admin không tự làm 100%.** Hành động rủi ro cần người thứ hai, và máy chủ chặn việc cùng một người giữ hai vai.

### 9.1 Vai trò đề xuất

| Vai trò | Quyền (mã đề xuất) |
| --- | --- |
| Backup Operator | `backup.backup.run`, `backup.backup.verify`, `backup.backup.export`, `backup.module.view` |
| Media Custodian | `backup.media.manage`: đăng ký phương tiện, xác nhận bàn giao, kiểm tra đọc, ghi hủy |
| Backup Administrator | các quyền `backup.admin.*.view` hiện có và `backup.admin.*.manage` (mới): đề xuất đổi policy |
| Restore Requester | `backup.restore.request` |
| Restore Approver (được chỉ định nội bộ) | `backup.restore.approve` |
| Restore Executor (Admin, chỉ sau khi đã duyệt) | `backup.restore.execute` |
| Restore Verifier (QA) | `backup.restore.verify_signoff` |
| Legal Hold Manager (QA) | `backup.hold.manage` |
| DR Authority | `backup.dr.declare` (cần hai người) |
| Inspector | `backup.audit.view` (chỉ đọc), tài khoản giới hạn thời gian |
| Super Administrator | Tài khoản khẩn cấp độc lập, mọi quyền, kiểm soát bổ sung ở mục 11.6 |

### 9.1 a Mô hình quyền

- Mỗi quyền restore là một quyền trong hệ thống: `backup.restore.request` (yêu cầu), `backup.restore.approve` (duyệt hoặc từ chối, có chữ ký điện tử), `backup.restore.execute` (thực thi restore đã duyệt).
- Các quyền được gom vào một hoặc nhiều Access Profile. Một người dùng có thể có nhiều profile. Ai được gán profile nào do quy trình nội bộ quyết định; hệ thống chỉ thi hành việc gán đó.
- Luồng: người có quyền yêu cầu tạo yêu cầu restore; người được chỉ định xem báo cáo tác động và duyệt hoặc từ chối; chỉ khi đã duyệt, người có quyền thực thi mới chạy restore trong cửa sổ bảo trì.
- Người duyệt không được là người yêu cầu; người thực thi không được là người duyệt yêu cầu đó. Máy chủ kiểm tra cả hai điều kiện.
- **Màn hình yêu cầu** (Restore Requests): cột Thao tác có View Detail, Approve Request và Reject Request (hai mục sau chỉ bật với yêu cầu đang chờ của người khác và khi có quyền duyệt). Màn Restore Approval Queue đã được gỡ: chỉ còn một màn hình Restore Requests. Màn chi tiết `/backup-restore/restores/{id}` có thanh bước Requested, Pending Approval, Approved, Rejected; thông tin bản backup; và phần "những gì restore sẽ đưa trở lại": thành phần, dung lượng, số tài liệu, số dòng, số dòng audit sẽ mất.
- **Chữ ký điện tử cho cả hai quyết định**: duyệt (nghĩa `BACKUP_RESTORE_APPROVAL`) và từ chối (nghĩa `BACKUP_RESTORE_REJECTION`, V568). Từ chối nhập lý do trước, rồi ký.
- **Thông báo khi được duyệt**: mọi người đang có quyền `backup.restore.execute` nhận thông báo trong ứng dụng (kèm mã yêu cầu và bản backup) sau khi việc duyệt đã được ghi. Thông báo qua email chưa làm.
- **Trạng thái của yêu cầu**: Requested, rồi Pending Approval, rồi một trong hai kết thúc: Approved (đã duyệt) hoặc Rejected (đã từ chối). **Không có trạng thái hay chức năng hủy**: admin chỉ tạo yêu cầu và đợi người được phân công duyệt hoặc từ chối; yêu cầu không ai quyết định vẫn ở Pending Approval. Một yêu cầu đã duyệt hoặc đã từ chối không đổi trạng thái nữa.

### 9.2 Ma trận hành động

| Hành động | Ai làm | Ai duyệt | E-sign | Chặn máy chủ |
| --- | --- | --- | --- | --- |
| Backup theo lịch | Tự động | Không (đã nằm trong policy được duyệt) | Không | - |
| Backup thủ công / pre-change | Operator, nhập lý do | Không với thủ công; pre-change gắn mã change control | Không | - |
| Kiểm tra (verify) | Tự động hoặc Operator | Không | Không | - |
| Đổi policy, đích, retention, lịch | Backup Administrator | Approver được chỉ định (người khác) | Có QĐ BR-10 | người đề xuất ≠ người duyệt |
| Export Backup Set ra phương tiện ngoại tuyến | Operator, nhập lý do | Backup Administrator (người khác) QĐ BR-14 | Không, ghi lý do | ≠; chỉ bản VERIFIED; chỉ phương tiện đã đăng ký |
| Bàn giao / nhận phương tiện | Media Custodian (người giao) | Media Custodian khác (người nhận) | Không | ≠ |
| Register Imported Set | Restore Executor | Approver được chỉ định | Không, ghi lý do | xác minh chữ ký và chuỗi băm bắt buộc |
| Chọn hoặc đổi đích ngoài cơ sở / bất biến (BR-6), DR Authority (BR-7) | Backup Administrator | Approver được chỉ định (người khác) | **Có, bắt buộc** (đã chốt) | ≠; lý do bắt buộc; hiệu lực sau khi duyệt; audit ba nơi và thông báo QA; không đổi được khi đang có restore chạy |
| Áp legal hold | Legal Hold Manager | Không, ghi lý do | Không | - |
| Gỡ legal hold | Legal Hold Manager | Người thứ hai | Có | ≠ người áp |
| Restore vào validation | Requester | Backup Administrator (khác người) | Không, ghi lý do | ≠ |
| Restore vào production | Requester → Executor | Approver được chỉ định; xác nhận sau restore bởi Restore Verifier | Có, hai lần (duyệt, xác nhận) | Requester, Approver, Verifier khác nhau; Executor ≠ Approver |
| R-OBJ / R-ONE vào production | Requester | Approver được chỉ định | Có | như trên |
| Tuyên bố DR | DR Authority (2 người) | Cả hai cùng xác nhận | Có, cả hai | hai định danh khác nhau |
| Backup Inspection | Inspector hoặc QA | Approver được chỉ định | Không, ghi lý do | giải mã cần lý do và được duyệt |

**Về chữ ký điện tử.** Hệ thống đã có hạ tầng e-sign và `used_signature_tokens`. Đề xuất dùng cho các hành động trên vì chúng ảnh hưởng toàn bộ dữ liệu GMP. Nếu chủ dự án quyết định bỏ yêu cầu chữ ký ở một số bước, vẫn phải giữ: lý do bắt buộc, người thứ hai khác người, và ghi ledger QĐ BR-10.

## 10 Đánh giá tác động trước khi backup và restore (Q7)

### 10.1 Pre-Backup Check (tự động, chặn nếu lỗi)

| Kiểm tra | Mức | Tiêu chí |
| --- | --- | --- |
| Đích ghi được và còn chỗ | Chặn | Ghi/đọc/xác nhận SHA-256 một object thử; dung lượng trống ≥ 1,5 × kích thước dự kiến |
| Đích bất biến vẫn bất biến | Chặn | Thử xóa bị từ chối; mode COMPLIANCE đúng |
| Không có restore đang chạy | Chặn | Khóa tư vấn trong DB điều khiển |
| Không có backup trùng | Chặn | Cùng thành phần đang chạy |
| Đồng hồ khớp NTP | Chặn | Lệch ≤ 2 giây |
| Provider file mới | Chặn | Provider trong `document_revisions` phải nằm trong policy |
| Dung lượng DB tăng đột biến | Cảnh báo | Lệch > 30% so với trung vị 7 ngày |
| Khóa mã hóa công khai hợp lệ | Chặn | Chưa hết hạn, khớp dấu vân tay trong policy |

### 10.2 Restore Impact Report

Sinh tự động khi tạo yêu cầu restore, **tính từ DB hiện tại** và manifest của bản backup đã chọn, rồi đóng băng vào yêu cầu (không đổi sau khi gửi duyệt).

| Mục | Cách tính | Mức |
| --- | --- | --- |
| Cửa sổ mất dữ liệu | `now() − dbSnapshotAt` | Hiện số giờ, tô đỏ khi vượt RPO |
| Số bản ghi sẽ mất | Với mỗi bảng trong danh sách thăm dò (`backup_impact_probe`: tài liệu, revision, chữ ký, `audit_logs`, controlled copy đã phát hành, phân phối, bản ghi form): đếm dòng có `created_at > dbSnapshotAt` | Thông tin; con số > 0 bắt buộc điền đánh giá GMP |
| Chữ ký điện tử sẽ mất | Đếm chữ ký sau `dbSnapshotAt` | Chặn nếu > 0 mà chưa có kế hoạch ký lại |
| Bản phát hành / bản sao kiểm soát sau thời điểm backup | Đếm và liệt kê mã | Phải có hành động thu hồi hoặc xác nhận lại |
| Object mồ côi dự kiến | Object có `lastModified > dbSnapshotAt` trong bucket khóa | Thông tin; sẽ được gắn nhãn, không xóa |
| Job đang chạy / hàng đợi | Đếm job chưa xong (phân phối, publishing, report) | Sẽ chuyển trạng thái "cần rà soát" sau restore |
| Người dùng đang hoạt động | Phiên hiện hành | Sẽ bị đăng xuất |
| Tương thích phiên bản | Flyway của backup so với mã đang chạy | Chặn nếu backup mới hơn mã; cảnh báo nếu cũ hơn (cần migrate) |
| Khóa giải mã có sẵn | Khóa giải mã đã có trên máy thực thi | Chặn |
| Chỗ cho bản an toàn | Dung lượng DB hiện tại × 1,2 | Chặn |
| Thời gian ước tính so với cửa sổ bảo trì | Từ các lần restore/diễn tập trước | Cảnh báo |
| Môi trường đích | Production phải có mã change control; validation không bắt buộc | Chặn |

### 10.3 Đánh giá tác động GMP (người dùng điền, bắt buộc với production)

- Tài liệu hiệu lực nào có thể quay về trạng thái cũ; có tài liệu nào đã phát hành sau thời điểm backup không.
- Bản sao kiểm soát đã phát hành sau thời điểm backup: thu hồi hay xác nhận lại.
- Đào tạo, chữ ký, phê duyệt phải làm lại.
- Sản phẩm, lô hoặc quyết định chất lượng nào có thể bị ảnh hưởng; cần mở sự kiện/sai lệch không.
- Kế hoạch thông báo người dùng và khoảng thời gian dữ liệu bị mất.

## 11 Ngữ nghĩa và quy trình restore (Q8)

### 11.1 Ghi đè hay trùng lặp

| Dữ liệu | Hành vi | Lý do |
| --- | --- | --- |
| DB | **Thay thế toàn bộ.** Không trộn. | Trộn phá khóa ngoại, trình tự audit và chữ ký. |
| Object trong bucket khóa | **Chỉ bổ sung.** Không ghi đè. | COMPLIANCE không cho ghi đè hay xóa. Key và version bất biến nên không tạo bản trùng. |
| Object sau thời điểm backup | Giữ nguyên, trở thành **mồ côi** | Không xóa được; báo cáo đối chiếu và gắn nhãn `orphan=restore-{id}` |
| Job dở dang, email, phân phối | Scheduler tắt cho tới khi đối chiếu xong; job chưa xong chuyển "cần rà soát" | Tránh gửi lại email, phát hành hai lần |
| Phiên, token | Hủy toàn bộ; `used_signature_tokens` khôi phục cùng DB | Token cũ không dùng lại được |
| Cache Redis, OnlyOffice | Xóa và dựng lại | Tránh dữ liệu cũ |

### 11.2 Cách thay DB: dựng DB mới rồi hoán đổi

Không restore đè lên DB đang chạy. Worker restore vào database mới `eqms_restore_{id}`, kiểm tra xong mới đổi tên: `eqms` → `eqms_pre_{id}`, `eqms_restore_{id}` → `eqms`. DB cũ giữ nguyên làm bản an toàn và bằng chứng; quay lui chỉ là đổi tên ngược. Nếu kiểm tra thất bại, production chưa bị đụng.

### 11.3 Quy trình restore production

```
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> PENDING_APPROVAL: gửi (Impact Report đóng băng)
  PENDING_APPROVAL --> APPROVED: QA duyệt và ký
  PENDING_APPROVAL --> REJECTED: QA từ chối kèm lý do
  APPROVED --> SCHEDULED: đặt cửa sổ bảo trì
  SCHEDULED --> RUNNING: Executor bắt đầu, worker được cấp quyền
  RUNNING --> VERIFYING: restore xong vào DB mới
  VERIFYING --> AWAITING_SIGNOFF: mọi kiểm tra bắt buộc đạt
  VERIFYING --> FAILED: kiểm tra bắt buộc thất bại, production chưa bị đổi
  AWAITING_SIGNOFF --> COMPLETED: QA ký xác nhận, hoán đổi DB
  AWAITING_SIGNOFF --> ROLLED_BACK: QA không xác nhận
  RUNNING --> FAILED
  COMPLETED --> [*]
  FAILED --> [*]
  ROLLED_BACK --> [*]
  REJECTED --> [*]
```

| Bước | Ai | Hệ thống làm | Cổng | Bằng chứng |
| --- | --- | --- | --- | --- |
| R0 | Requester | Chọn bản backup, loại (R-FULL, R-DB, R-OBJ, R-ONE), đích, lý do, mã change control | Có đủ trường | Yêu cầu |
| R1 | Hệ thống | Sinh Restore Impact Report (mục 10.2), kiểm tra tương thích | Không có mục chặn | Báo cáo đóng băng, SHA-256 |
| R2 | Requester | Điền đánh giá GMP (mục 10.3), gửi duyệt | Bắt buộc nếu có mất dữ liệu | Bản đánh giá |
| R3 | Approver được chỉ định | Đọc báo cáo, duyệt hoặc từ chối | Người ≠ Requester; e-sign | Chữ ký, lý do |
| R4 | Executor, Admin | Đặt lịch và số phút thông báo n; hệ thống phát thông báo, đếm ngược, tự đăng xuất toàn bộ khi hết n, báo Admin; Admin xác nhận không còn người dùng (mục 11.5, M0-M5) | Phiên còn lại = 0; chỉ người vận hành còn đăng nhập | Lịch, số phiên đã đăng xuất, xác nhận của Admin |
| R5 | Hệ thống | Giữ chế độ khóa (mục 11.5.3), dừng scheduler và job, **backup an toàn** trạng thái hiện tại (loại `PRE_RESTORE`, kiểm tra xong mới đi tiếp) | Bản an toàn đã verify | BK pre-restore |
| R6 | Worker | Giải mã bằng khóa trên máy thực thi, kiểm tra chữ ký manifest và SHA-256 | Đạt | Nhật ký |
| R7 | Worker | Restore DB vào `eqms_restore_{id}` | Không lỗi | Nhật ký |
| R8 | Worker | Bổ sung object thiếu theo manifest (additive), kiểm SHA-256 từng object; nếu nguồn không mang `versionId` thì ghi bí danh phiên bản vào DB mới, **không sửa bản ghi nào** (mục 11.4) | 100% khớp SHA-256; mọi object ghi lại có đúng một bí danh | Danh sách bổ sung, danh sách bí danh |
| R9 | Hệ thống | Chạy danh mục kiểm tra sau restore (mục 14.3) trên DB mới | Mọi mục bắt buộc đạt | Restore Verification Report |
| R10 | QA Verifier | Xem báo cáo, ký xác nhận hoặc không | Người ≠ Requester, ≠ Approver; e-sign | Chữ ký |
| R11 | Hệ thống | Hoán đổi tên DB, gắn nhãn object mồ côi, chuyển job dở dang sang "cần rà soát", dọn cache, thu hồi mọi phiên và tăng session epoch; **vẫn khóa hệ thống và giữ scheduler tắt** cho đến bước R12 | - | Ledger |
| R12 | Executor, QA | Rà soát job, bật scheduler từng nhóm, ghi sự kiện/sai lệch cho khoảng dữ liệu bị mất, **mở lại hệ thống** (M8), đóng yêu cầu | Danh sách rà soát hoàn tất | Hồ sơ đóng |

Hai thao tác R5 và R11 chỉ chạy qua worker; backend không tự đổi tên database.

### 11.4 Tham chiếu file khi MinIO được dựng lại (`versionId`) ĐÃ KIỂM CHỨNG Ở P0

**Vướng mắc.** Khi ghi một object vào MinIO, S3 tự sinh `versionId` mới và **không cho đặt lại** ĐÃ ĐO: header `x-amz-version-id` bị bỏ qua, sao chép server tạo versionId mới. Nếu MinIO bị mất rồi dựng lại từ bản sao dạng file, mọi object quay về với `versionId` khác. Trong DB, `versionId` nằm ở **14 cột của 12 bảng** (tài liệu, bản sao kiểm soát, bản ghi form, snapshot, publishing, và cả `electronic_signatures`) ĐÃ ĐO: truy vấn schema. Nếu chỉ object hỏng hoặc mất một vài cái trong bucket còn nguyên thì ít bị ảnh hưởng.

#### 11.4.1 Vì sao không sửa tham chiếu trong DB (cách B đã bị loại)

- `electronic_signatures` có trigger `prevent_electronic_signature_mutation` (V394) chặn UPDATE, DELETE và TRUNCATE. Lối thoát duy nhất là biến phiên `app.allow_audit_purge`, dành cho purge có kiểm soát. Dùng nó để sửa `versionId` nghĩa là vô hiệu hóa kiểm soát toàn vẹn của chữ ký.
- Chữ ký lưu `versionId` của file đã ký làm **bằng chứng**. Đổi nó khiến bằng chứng "đã ký đúng phiên bản X" trỏ vào chỗ không còn tồn tại.
- Phải liệt kê đủ 14 cột và tự động hóa phát hiện cột mới; sót một cột là một tham chiếu hỏng âm thầm.

#### 11.4.2 Cơ chế dùng: bảng bí danh phiên bản (`object_version_alias`)

Bản ghi nào cũng **giữ nguyên** `versionId` gốc. Thay vào đó hệ thống ghi thêm một bảng bí danh và đường đọc file biết tra bảng này.

1. **Khi restore ghi lại object (bước R8):** với mỗi object được ghi, nhận `versionId` mới, tính SHA-256 trên nội dung vừa ghi, đối chiếu SHA-256 trong manifest, rồi thêm dòng `(bucket, object_key, original_version_id, current_version_id, sha256, restore_request_id, created_at)` vào `object_version_alias` trong **DB mới** (`eqms_restore_{id}`), trước khi hoán đổi.
2. **Khi đọc file:** `MinioObjectStorageService` thử `versionId` trong tham chiếu trước. Chỉ khi MinIO trả "không có phiên bản này" mới tra `object_version_alias` theo (bucket, key, original_version_id). Nếu có, đọc `current_version_id`, **tính lại SHA-256 và so với giá trị đã lưu trong bản ghi bí danh**; khác nhau thì từ chối với lỗi toàn vẹn, không trả file.
3. **Không có bí danh và không có phiên bản:** lỗi "file không tìm thấy" như hiện nay; không đoán.
4. **Bảng bí danh chỉ thêm, không sửa:** khóa duy nhất theo (bucket, key, original_version_id); trigger chặn UPDATE/DELETE giống mẫu của bảng audit; chỉ Restore Worker được ghi. Bảng nằm trong DB eqms nên được backup như mọi dữ liệu khác; bản chép nằm trong DB điều khiển làm bằng chứng.
5. Không bảng nào trong 12 bảng bị sửa; chữ ký điện tử giữ nguyên `versionId` gốc làm bằng chứng, và SHA-256 chứng minh nội dung là cùng một file.

| Ưu điểm | Đánh đổi |
| --- | --- |
| Không sửa bản ghi bất biến; không cần liệt kê hết các cột chứa tham chiếu; chạy với mọi nguồn khôi phục (thư mục, NAS, ổ ngoại tuyến, MinIO) | Thêm một bước tra cứu ở đường đọc file (chỉ khi gặp phiên bản không tồn tại); bảng bí danh thành dữ liệu cần backup; sửa một đường đọc dùng chung (cần phân tích tác động) |

#### 11.4.3 Audit của việc tạo bí danh

Có, ở ba nơi, vì DB eqms sẽ bị thay nên không thể chỉ ghi trong chính nó:

- **Sổ cái ngoài DB:** sự kiện `OBJECT_ALIASES_CREATED` (mã yêu cầu, số object, số bí danh, số ngoại lệ, SHA-256 của tệp danh sách bí danh). Tệp danh sách đầy đủ được lưu cạnh hồ sơ restore ở đích T3 và nằm trong Evidence Pack.
- **DB điều khiển:** bản chép của danh sách bí danh và `restore_event`, bất biến.
- **Audit trail của DB eqms (DB mới):** một dòng tóm tắt cho mỗi lần restore ghi bí danh (hành động `RESTORE_OBJECT_ALIASES`: người, mã yêu cầu, số lượng, SHA-256 danh sách), và mỗi lần **đọc qua bí danh** được đếm trong chỉ số vận hành. Không sửa hay xóa dòng audit cũ.

#### 11.4.4 Nhân bản MinIO: chỉ là tối ưu hóa tùy chọn ĐÃ ĐO MỘT PHẦN

- Nhân bản site của MinIO **giữ nguyên `versionId`**, cấu hình khóa và hạn `COMPLIANCE`; đích từ chối xóa phiên bản bị khóa ĐÃ ĐO. Nếu dùng được cho đích T3 thì không cần bí danh với nguồn đó.
- Nhưng: nhân bản site sao chép **toàn bộ bucket và IAM** (bucket backup cũng bị nhân bản ngược về site chính), đòi kết nối hai chiều giữa hai máy (trái nguyên tắc "đích chỉ ghi"), và **đường dựng lại site chính đã mất chưa kiểm chứng được**: gỡ site đã mất trả lỗi 500, cần thao tác gỡ cưỡng bức, mà công cụ `mc` không còn được phân phối công khai và SDK Python không có thao tác này CHƯA KIỂM CHỨNG.
- Vì vậy bảng bí danh là cơ chế **bắt buộc**; nhân bản chỉ được xét lại sau khi kiểm chứng đường dựng lại site và nhân bản theo từng bucket. Mọi runbook phải dùng SDK hoặc API quản trị trực tiếp, không dựa vào `mc`.

### 11.5 Chế độ bảo trì khi restore: thông báo, đăng xuất, khóa hệ thống

Quy tắc do chủ dự án quyết định: **khi restore (kể cả vào môi trường validation), chỉ Admin được đăng nhập, để theo dõi tiến trình, và Admin cũng không được dùng chức năng nào khác.** Trước đó hệ thống thông báo cho toàn bộ người dùng, cho họ **n phút** (cấu hình được) để lưu việc và đăng xuất; hết n phút hệ thống tự đăng xuất tất cả và báo cho Admin; Admin xác nhận không còn ai rồi mới bấm thực thi.

| Trường hợp | Áp dụng khóa | Lý do |
| --- | --- | --- |
| Mọi restore ghi vào production: R-FULL, R-DB, R-OBJ, R-ONE, DR | **Có** | Theo quyết định; dữ liệu nhập trong lúc restore sẽ mất hoặc không nằm trong bản an toàn |
| Restore vào môi trường validation | **Có** ĐÃ CHỐT BR-18 | Chủ dự án quyết định áp dụng cho cả validation. Khóa và đăng xuất áp dụng cho **chính ứng dụng của môi trường được restore**, không ảnh hưởng người dùng production |
| Backup | Không | Backup không chặn người ghi (mục 5). Nếu muốn, có thể gửi thông báo tham khảo qua System Announcements nhưng không đăng xuất ai |

#### 11.5.1 Các trạng thái

```
stateDiagram-v2
  [*] --> NORMAL
  NORMAL --> NOTICE: Executor đặt lịch, bắt đầu thông báo (n phút)
  NOTICE --> NOTICE: Admin gia hạn
  NOTICE --> NORMAL: Admin hủy
  NOTICE --> DRAINED: hết n phút, tự đăng xuất toàn bộ, báo Admin
  DRAINED --> NORMAL: Admin hủy trước khi chạy
  DRAINED --> LOCKED_RESTORING: Admin xác nhận không còn người dùng và bấm Thực thi
  LOCKED_RESTORING --> LOCKED_VERIFYING: restore xong
  LOCKED_VERIFYING --> LOCKED_SIGNOFF: kiểm tra đạt
  LOCKED_SIGNOFF --> LOCKED_REVIEW: QA ký, hoán đổi DB, hủy mọi phiên
  LOCKED_REVIEW --> NORMAL: rà soát job xong, mở lại
  LOCKED_VERIFYING --> LOCKED_REVIEW: thất bại, production giữ DB cũ
```

#### 11.5.2 Luồng từng bước

| Bước | Ai | Hệ thống làm | Cổng / hiển thị |
| --- | --- | --- | --- |
| M0 | Executor | Đặt lịch restore; chọn số phút thông báo **n** (mặc định lấy từ cấu hình, trong khoảng cho phép) và danh sách người vận hành được vào khi khóa | Yêu cầu đã APPROVED; n nằm trong min-max |
| M1 | Hệ thống | Chuyển `NOTICE`. Tạo một **System Announcement** mức Critical qua dịch vụ announcements hiện có (ghi audit, người xem được nội dung khi đăng nhập). Bật **hộp thoại đếm ngược** cho mọi người dùng đang online; khi người dùng bấm Close, đếm ngược chuyển lên **thanh Header** (mục 11.5.4) | Nội dung: giờ khóa, "hãy lưu công việc và đăng xuất", mã yêu cầu |
| M2 | Hệ thống | Nhắc lại theo cấu hình (mặc định n/2, 5 phút, 1 phút còn lại; với n = 10 là các mốc 5, 1 phút). Người đăng nhập trong lúc đếm ngược vẫn thấy thông báo ngay khi vào | Có nút "Đăng xuất ngay" |
| M3 | Hệ thống | Hết n phút: chuyển `DRAINED`. Thu hồi **mọi phiên** trừ người vận hành; chặn đăng nhập của người không thuộc danh sách; trang đăng nhập hiện thông báo bảo trì; thông báo announcement đổi sang "Đang bảo trì". **Báo cho Admin** bằng thông báo trong ứng dụng và email: số phiên đã đăng xuất, số còn lại | Admin nhận cảnh báo ngay cả khi đang ở màn khác |
| M4 | Admin | Mở **Restore Execution Console**. Thấy: số phiên còn lại (người dùng, IP, hoạt động cuối), request đang xử lý, job đang chạy, phiên soạn thảo OnlyOffice còn mở, trạng thái scheduler, Impact Report được **tính lại ngay lúc này** | Hành động: Gia hạn, Buộc đăng xuất, Hủy, Thực thi |
| M5 | Admin | Tích ô "Tôi xác nhận không còn người dùng nào đang làm việc" (ghi lại người, thời gian) và bấm **Thực thi restore** | Nút chỉ bật khi: phiên còn lại = 0 (không tính người vận hành), request đang xử lý = 0, mọi job đã dừng, Impact Report đã tính lại, khóa giải mã đã có trên máy thực thi. Nếu còn phiên: Admin phải Buộc đăng xuất rồi chờ |
| M6 | Worker | Chạy R5-R10 (mục 11.3). Console hiện tiến trình từng bước, nhật ký trực tiếp, nút Dừng (chỉ trước R11) | Console lấy dữ liệu từ DB điều khiển và worker, **không từ DB eqms**, nên vẫn chạy khi DB được hoán đổi |
| M7 | Worker | Sau khi QA ký (R10) và hoán đổi (R11): **thu hồi mọi phiên trong DB mới** và tăng *session epoch* để token cũ (kể cả token còn hạn trước thời điểm backup) không dùng lại được. Hệ thống **vẫn khóa** | Chặn người dùng thường cho đến M8 |
| M8 | Admin, QA | Rà soát job dở dang, bật scheduler từng nhóm (R12), bấm **Mở lại hệ thống**. Hệ thống tạo announcement mức Info "Hệ thống đã hoạt động trở lại", trả trạng thái `NORMAL` | Danh sách rà soát hoàn tất |

#### 11.5.3 Cơ chế khóa (Maintenance Gate)

- **Bộ lọc đặt trước bộ lọc xác thực** (trước `AuthTokenFilter`). Ở trạng thái khóa, mọi yêu cầu trả `503 MAINTENANCE_MODE` kèm `Retry-After`, **trừ** danh sách trắng: đăng nhập (chỉ người vận hành), đăng xuất, `/system/maintenance-status`, `/backup-restore/restores/{id}/console/**`, health check. Vì vậy Admin cũng không dùng được chức năng nào khác, ngay cả bằng gọi API trực tiếp.
- **Trạng thái khóa không nằm trong DB eqms.** Nguồn sự thật là DB điều khiển; worker còn ghi một **tệp khóa** `maintenance.lock` trên volume dùng chung. Bộ lọc kiểm tra tệp này (rẻ, không phụ thuộc DB nào) nên khóa vẫn hiệu lực khi DB eqms đang được thay hoặc Redis bị xóa. Mất kết nối DB điều khiển khi đang khóa: **giữ nguyên khóa**, không tự mở.
- **Maintenance Pass.** Khi đăng nhập trong lúc khóa, người vận hành nhận một token riêng (ký bằng khóa khác, phạm vi `RESTORE:{requestId}`, hết hạn khi yêu cầu kết thúc). Token này không phụ thuộc bảng người dùng và bảng phiên trong DB eqms, nên console vẫn dùng được qua lần hoán đổi DB (người vận hành có thể không còn tồn tại hoặc không còn quyền trong bản DB đã restore).
- **Người vận hành** = Super Administrator (luôn được vào) cộng những người được chỉ định trong yêu cầu, kể cả Restore Verifier (cần vào ký ở R10). Giới hạn ở màn Console; Verifier chỉ thấy trang ký xác nhận. Phân tách vai (mục 9) áp dụng theo BR-19.
- Nếu người vận hành mất token sau hoán đổi (đóng trình duyệt): đăng nhập lại bằng **tài khoản Super Administrator** (mục 11.6), lưu trong DB điều khiển nên không phụ thuộc DB eqms.

#### 11.5.4 Thông báo cho người đang online

System Announcements hiện chỉ hiện **sau khi đăng nhập** và làm mới **mỗi 5 phút** ĐÃ KIỂM TRA: AnnouncementHost; người dùng còn đóng được thông báo. Nên **không đủ** cho đếm ngược với người đang làm việc.

- Thêm `GET /system/maintenance-status` (không cần đăng nhập để trang đăng nhập cũng dùng được), trả `state`, `noticeEndsAt`, `serverNow` (để tính đếm ngược đúng, không phụ thuộc đồng hồ máy người dùng).
- Thành phần frontend `MaintenanceNoticeHost` gọi trạng thái mỗi 15 giây, mỗi 5 giây trong phút cuối. Khi `NOTICE` hiển thị **hộp thoại đếm ngược** (có nút "Đăng xuất ngay" và Close). Khi `DRAINED` hoặc nhận 401/503 `MAINTENANCE_MODE`: tự đăng xuất và về trang bảo trì.
- **Bấm Close chỉ đóng hộp thoại, không dừng đếm ngược.** Đồng hồ đếm ngược chuyển sang **thanh Header** (`components/layout/header/Header.tsx`), đặt trong cụm bên phải ngay trước `NotificationsDropdown`, bằng thành phần mới `MaintenanceCountdownChip`. Chip hiển thị `mm:ss` còn lại, nền **đỏ nhẹ** (cặp màu `red-50`/`red-700` theo quy ước Badge của dự án, không dùng mã hex) và **nhấp nháy liên tục** cho đến khi bị đăng xuất. Bấm vào chip mở lại hộp thoại.
- **Nhấp nháy và khả năng truy cập:** nhịp nhấp nháy chậm (khoảng 1 lần mỗi giây, thấp hơn ngưỡng 3 lần mỗi giây của hướng dẫn WCAG về chớp sáng). Với người dùng bật `prefers-reduced-motion: reduce`, chip chuyển sang **đỏ cố định, không nhấp nháy**, vẫn đếm ngược và có `aria-live="polite"` (đọc mốc 5 phút, 1 phút, không đọc từng giây). Màu không phải dấu hiệu duy nhất: chip luôn có biểu tượng đồng hồ và chữ "Bảo trì".
- Hộp thoại **mở lại** ở mốc nhắc cuối (1 phút) để chắc chắn người dùng thấy, kể cả khi đã bấm Close trước đó ĐỀ XUẤT, chưa được xác nhận.
- Announcement vẫn được tạo để có bản ghi audit và để người đăng nhập trong lúc `NOTICE` thấy ngay.
- Người đang soạn thảo OnlyOffice: khi bắt đầu `NOTICE` hiển thị cảnh báo "Hãy lưu tài liệu"; khi `DRAINED` hệ thống yêu cầu Document Server lưu và đóng các phiên (cách làm cần xác nhận với Document Server 8.2 CHƯA KIỂM TRA).

#### 11.5.5 Cấu hình (màn Restore Approval & Execution Rules)

| Trường | Giá trị khởi điểm | Quy tắc |
| --- | --- | --- |
| Số phút thông báo n (mặc định) | 10 ĐÃ CHỐT BR-16 | Giới hạn 5-240. Khi đặt lịch có thể chọn n khác trong khoảng này; giảm xuống dưới giá trị mặc định cần ghi lý do |
| n cho DR do DR Authority tuyên bố | 0-5 | Cho phép rút ngắn vì hệ thống đã sự cố; vẫn đăng xuất và khóa |
| Mốc nhắc lại | n/2, 1 phút (với n = 10: 5 phút, 1 phút) | Danh sách tùy chỉnh |
| Người vận hành được vào khi khóa | Super Administrator + người được chỉ định cho từng yêu cầu | Tài khoản Super Administrator lưu ngoài DB eqms (mục 11.6) |
| Tự đăng xuất khi hết n phút | Bật, không tắt được | - |
| Bắt buộc Admin xác nhận không còn người dùng trước khi Thực thi | Bật, không tắt được | - |

Thay đổi các trường này cần hai người và lý do như các cấu hình khác (mục 9).

#### 11.5.6 Dữ liệu và API

- Bảng `super_admin_account` (id, username, password_hash, totp_secret_ref, status, failed_attempts, locked_until, password_rotated_at, allowed_ip_ranges) và `super_admin_custodian` (tên người giữ khóa được phép khai báo khi đăng nhập). Endpoint: `POST /auth/super-admin/login`, `/logout`, `/rotate-password`; `GET /system/super-admin/usage-report` (QA). Mã lỗi: `SUPER_ADMIN_LOCKED`, `SUPER_ADMIN_CUSTODIAN_REQUIRED`.
- Bảng DB điều khiển: `maintenance_window` (request_id, state, notice_minutes, notice_started_at, notice_ends_at, drained_at, no_users_confirmed_by/at, unlocked_at, announcement_id, extended_count, sessions_at_start, sessions_logged_out, sessions_remaining), `session_epoch` (value, bumped_at, request_id).
- Endpoint: `POST /backup-restore/restores/{id}/maintenance/start-notice`, `/extend`, `/cancel`, `/terminate-sessions`, `/confirm-no-users`, `/unlock`; `GET /backup-restore/restores/{id}/console` (phiên, request, job, OnlyOffice, tiến trình); `GET /system/maintenance-status`.
- Mã lỗi: `MAINTENANCE_MODE`, `MAINTENANCE_LOGIN_NOT_ALLOWED`, `RESTORE_USERS_STILL_ACTIVE`, `NOTICE_PERIOD_NOT_ELAPSED`.
- Mọi chuyển trạng thái, gia hạn, hủy, buộc đăng xuất, xác nhận "không còn người dùng" ghi ledger, `restore_event` và audit trail của eqms (trước khi hoán đổi).

### 11.6 Tài khoản Super Administrator (độc lập với tài khoản người dùng)

Theo yêu cầu của chủ dự án: cung cấp **một tài khoản Admin tối cao**, làm được mọi thao tác trên hệ thống, **độc lập với tài khoản của người dùng**. Tài khoản này thay thế "tài khoản bảo trì" đã đề xuất trước đó (BR-17) và là tài khoản luôn được vào khi hệ thống bị khóa.

#### 11.6.1 Thiết kế

- **Lưu ngoài DB eqms:** trong DB điều khiển (bảng `super_admin_account`), nên không bị mất hay bị thay khi restore, và đăng nhập được kể cả khi bảng người dùng đang trống hoặc hỏng.
- **Đăng nhập riêng:** endpoint riêng `POST /auth/super-admin/login`, trang đăng nhập riêng (đường dẫn không công bố trong giao diện thường), không dùng bảng `users` và `AuthSession`. Token ký bằng khóa riêng, phạm vi `SUPER_ADMIN`.
- **Quyền:** bộ đánh giá quyền (`PermissionEvaluationService`) nhận ra chủ thể `SUPER_ADMIN` và cho qua mọi kiểm tra quyền; ngoài khóa bảo trì, tài khoản này dùng được toàn bộ chức năng của ứng dụng. Trong lúc khóa vẫn chỉ vào được Restore Execution Console cho đến khi mở lại (mục 11.5.3).
- **Xác thực mạnh:** mật khẩu dài kèm TOTP bắt buộc (khuyến nghị thêm khóa phần cứng); khóa tạm sau số lần sai; phiên ngắn (mặc định 30 phút không hoạt động); có thể giới hạn theo dải IP của mạng nội bộ.
- **Khởi tạo và cất giữ:** sinh trong lễ cài đặt có biên bản; mật khẩu và mã khôi phục TOTP cất niêm phong, giao cho người được chỉ định cất giữ, niêm phong (mục 8.4); đổi mật khẩu theo chu kỳ và mỗi khi người giữ thay đổi.

#### 11.6.2 Kiểm soát bắt buộc (vì tài khoản này nằm ngoài mọi ràng buộc thông thường)

**Rủi ro GMP cần chủ dự án biết.** Một tài khoản dùng chung có quyền tuyệt đối mâu thuẫn với hai nguyên tắc của tài liệu này: (1) **không ai tự làm 100%** (mục 9), và (2) dữ liệu phải **gán được cho một người cụ thể** (ALCOA+: Attributable; Annex 11 yêu cầu audit trail ghi người thực hiện, và tài khoản dùng chung thường bị thanh tra phê bình). Vì vậy tài khoản được thiết kế như **tài khoản khẩn cấp (break-glass)** với các kiểm soát dưới đây, chứ không phải tài khoản dùng hằng ngày.

- **Khai báo người dùng thật.** Mỗi lần đăng nhập, người dùng phải chọn tên mình từ danh sách người giữ khóa đã đăng ký và nhập lý do. Tên và lý do ghi vào mọi bản ghi audit của phiên đó (`actor = SUPER_ADMIN (người thực tế)`).
- **Báo ngay cho QA** (email và thông báo trong ứng dụng, gửi từ agent chứ không từ ứng dụng) mỗi lần đăng nhập, đăng nhập thất bại, và mỗi hành động nhạy cảm.
- **Ghi ba nơi:** ledger ngoài DB, DB điều khiển, và audit trail eqms (trước khi hoán đổi DB). Audit hiển thị rõ chủ thể là Super Administrator để phân biệt với người dùng thường.
- **Không thay thế danh tính khi ký.** Super Administrator **không** được ký điện tử thay cho người khác và không có "chữ ký của hệ thống" giả danh một người dùng; chữ ký điện tử luôn là danh tính cá nhân đã đăng ký.
- **Báo cáo sử dụng.** Báo cáo định kỳ cho QA liệt kê mọi phiên của tài khoản này; Evidence Pack (mục 16) bao gồm nó.
- **Chống trộm tài khoản.** Đăng nhập thất bại nhiều lần khóa tài khoản và cảnh báo mức nghiêm trọng; chỉ mở khóa bằng quy trình của người giữ khóa.

#### 11.6.3 Phân tách vai ĐÃ CHỐT BR-19: phương án A

| Phương án | Hành vi | Hệ quả |
| --- | --- | --- |
| **A. Quyền tuyệt đối nhưng giữ quy tắc hai người** (**ĐÃ CHỌN** bởi chủ dự án) | Super Administrator làm được mọi thao tác, kể cả các bước của restore; tuy nhiên các bước đã quy định cần **hai người khác nhau** (duyệt restore, xác nhận sau restore, gỡ legal hold, đổi policy) vẫn cần một người thứ hai. Tài khoản này chỉ được tính là **một** người, không bao giờ thay cho hai | Giữ tách nhiệm vụ; một người nắm tài khoản vẫn không tự hoàn tất restore production một mình |
| B. Quyền tuyệt đối, bỏ qua mọi quy tắc hai người (**không chọn**) | Một người có tài khoản này tự yêu cầu, duyệt, thực thi và xác nhận restore | Đúng nghĩa "Admin tối cao làm tất cả", nhưng một người có thể tự thay toàn bộ dữ liệu GMP mà không ai kiểm tra. Khó biện minh với thanh tra; chỉ nên chọn nếu có kiểm soát bù đắp mạnh (người giữ khóa là hai người cùng có mặt) |

#### 11.6.4 Điều cần kiểm tra khi làm

- Bản ghi audit hiện có (`audit_logs`) có khóa ngoại tới người dùng hay không; nếu có, cần cột nhãn chủ thể (text) thay vì tạo hàng người dùng giả trong DB eqms, vì hàng đó sẽ mất khi restore CHƯA KIỂM TRA.
- Thay đổi bộ đánh giá quyền là sửa lõi phân quyền. Phải chạy phân tích tác động GitNexus (upstream) cho `PermissionEvaluationService` và `AuthTokenFilter` trước khi sửa và dùng kỹ năng `eqms-authorization-assurance`; thêm test âm tính (người thường không thể mạo nhận phạm vi `SUPER_ADMIN`).

## 12 Mất dữ liệu: xử lý thế nào (Q9)

| Sự cố | Dấu hiệu | Chức năng dùng | Quy trình |
| --- | --- | --- | --- |
| Người dùng xóa / sửa nhầm một bản ghi | Báo cáo từ người dùng, audit trail | R-REC vào validation | 1) Backup Inspection hoặc restore vào validation tới thời điểm trước sự cố. 2) Xuất dữ liệu cần. 3) Sửa ở production qua **hiệu chỉnh dữ liệu có change control**, không qua restore. 4) Audit trail ghi nguyên nhân. |
| Một cập nhật hàng loạt làm hỏng nhiều bản ghi | Số lượng thay đổi bất thường | R-DB tới thời điểm T (cần WAL), hoặc R-REC | Đánh giá tác động; nếu phạm vi lớn, restore production với cửa sổ mất dữ liệu có chủ đích. |
| Hỏng cơ sở dữ liệu | Lỗi PG, kiểm tra checksum thất bại | R-FULL hoặc R-DB | Mục 11.3; dùng WAL để tối thiểu dữ liệu mất. |
| File tài liệu mất hoặc không khớp SHA-256 | Job đối chiếu object ↔ bản ghi báo lỗi | R-ONE | Agent lấy đúng `versionId` từ backup, kiểm SHA-256, bổ sung; mở sự cố; đối chiếu lại. |
| Ransomware / xâm nhập | Mã hóa, bản ghi bị thay | Khai báo DR | Mục 13; xác định thời điểm sạch từ ledger và audit trail ngoài. |
| Hỏng ổ / mất máy chủ | Phần cứng | DR | Mục 13. |
| Mất khóa giải mã | Không giải mã được | Không có chức năng nào cứu được | Phòng ngừa: hai người giữ, diễn tập giải mã; ghi vào rủi ro mức cao. |
| Nghi bản backup bị sửa | Chữ ký hoặc chuỗi băm sai | Verify nâng cao, đối chiếu đích 3, T4 | Dùng bản gần nhất còn hợp lệ; mở điều tra; báo QA. |

Mọi sự cố mất dữ liệu phải có bản ghi sự kiện/sai lệch ở hệ thống chất lượng, ghi khoảng thời gian dữ liệu bị ảnh hưởng.

## 13 Phục hồi sau thảm họa (Q11)

### 13.1 Kịch bản

| Mã | Kịch bản | Hạ tầng | Nguồn khôi phục |
| --- | --- | --- | --- |
| S1 | Hỏng ổ đĩa DB hoặc MinIO, máy còn | Thay ổ | T1 hoặc T3 |
| S2 | Mất toàn bộ máy chủ (phần cứng) | Máy mới | T3, T2 |
| S3 | Cháy, ngập, mất cả cơ sở | Cơ sở dự phòng | T3 ngoài cơ sở, T4 |
| S4 | Ransomware | Dựng lại sạch; không tin máy cũ | T3, T4; thời điểm sạch từ ledger |
| S5 | Bản backup chính hỏng hoặc bị sửa | - | Bản trước hợp lệ, T4 |
| S6 | Mất cả DB điều khiển | - | Dump DB điều khiển ở T3 và ledger |

### 13.2 Mục tiêu QĐ BR-1

| Kịch bản | RPO khởi điểm | RTO khởi điểm |
| --- | --- | --- |
| S1, S5 | ≤ 15 phút (khi có WAL) | chưa đặt |
| S2, S3, S4 | ≤ 15 phút (khi có WAL ngoài cơ sở) | chưa đặt |

RPO ≤ 15 phút chỉ đạt khi WAL được gửi ra **đích ngoài cơ sở** liên tục; nếu chỉ có bản logic hằng ngày thì RPO thực tế là 24 giờ. RTO chỉ biết sau lần diễn tập đầu tiên đo thật; giao diện hiển thị RTO đo được cạnh mục tiêu.

### 13.3 Gói dựng lại (Rebuild Kit)

Lưu ngoại tuyến (T4) và đồng bộ sau mỗi thay đổi hạ tầng:

- File compose và tệp cấu hình; **image đã ghim digest và lưu thành tar** (`docker save`) để không phụ thuộc internet.
- Hướng dẫn cài từng bước (runbook D0-D10), danh sách phần cứng tối thiểu, sơ đồ mạng.
- Khóa công khai ký manifest, dấu vân tay khóa mã hóa, hướng dẫn lấy khóa từ người giữ.
- Script xác minh chuỗi băm và manifest độc lập với ứng dụng.
- Danh bạ: DR Authority, người cất bản sao khóa theo biên bản, nhà cung cấp phần cứng, QA.
- Biên nhận của gói Export Backup Set gần nhất (mục 6.5) được in kèm để đối chiếu khi ledger không còn.

### 13.4 Runbook

| Bước | Việc | Ai | Chứng cứ |
| --- | --- | --- | --- |
| D0 | Phát hiện, ghi nhận sự cố, thông báo QA và IT | Bất kỳ | Hồ sơ sự kiện |
| D1 | Tuyên bố DR: hai DR Authority ký | DR Authority ×2 | Ledger (nếu hệ thống còn), biểu mẫu giấy nếu không |
| D2 | Cô lập: ngắt mạng máy bị ảnh hưởng, giữ nguyên làm bằng chứng (S4) | IT | Biên bản |
| D3 | Chuẩn bị hạ tầng sạch theo Rebuild Kit | IT | Danh mục kiểm tra |
| D4 | Lấy bản sao khóa giải mã từ nơi cất | Người cất bản sao (theo biên bản) | Biên bản |
| D5 | Dựng DB điều khiển từ bản dump và ledger; **xác minh chuỗi băm** để biết bản backup nào đáng tin | IT | Báo cáo chuỗi băm |
| D6 | Chọn bản backup hợp lệ gần nhất (S4: trước thời điểm bị xâm nhập) | IT, QA | Quyết định ghi lại |
| D7 | Restore DB (và WAL tới thời điểm mong muốn), MinIO (additive vào bucket mới hoặc đã khóa; nhân bản ngược từ T3 để giữ `versionId`, hoặc ghi lại từ file và tạo bí danh phiên bản theo mục 11.4), cấu hình | IT | Nhật ký |
| D8 | Nhập bí mật vận hành từ kho cất; khởi động ứng dụng ở chế độ bảo trì | IT | Biên bản |
| D9 | Chạy toàn bộ kiểm tra sau restore (14.3) và đối chiếu 100% object | Hệ thống, QA | Báo cáo |
| D10 | QA ký cho phép dùng lại; rà soát tác động GMP; mở lại cho người dùng; scheduler bật từng nhóm | QA | Hồ sơ DR đóng, báo cáo sau sự cố trong thời hạn đã định QĐ |

### 13.5 Diễn tập

- **Diễn tập restore** hằng tháng, vào validation (V3).
- **Diễn tập DR** hằng quý QĐ: dựng trên máy trống theo Rebuild Kit, đo thời gian mỗi bước, so với RTO, ghi phát hiện. Màn Disaster Recovery Drills lưu kết quả, thời gian thực, việc cần làm tiếp.
- Bucket validation **không bật Object Lock** (hoặc khóa rất ngắn), nếu không dữ liệu diễn tập không xóa được suốt thời hạn khóa. Quy định này ghi trong DR Plan QĐ BR-5.

## 14 Kiểm tra tính toàn vẹn và tuân thủ EU-GMP (Q12)

### 14.1 Bốn tầng kiểm tra

| Tầng | Khi nào | Nội dung | Kết quả |
| --- | --- | --- | --- |
| V1 | Ngay sau mỗi backup | SHA-256 từng file khớp manifest; chữ ký manifest; `SHA256SUMS` khớp; chuỗi tới bản trước; đúng khóa mã hóa (đọc gói OpenPGP, **không giải mã** vì agent không có khóa riêng); sổ cái ghi đúng manifest. Giải mã và `pg_restore` thuộc V2/V3 | Lưu vào `backup_verification` (VERIFIED / FAILED) |
| V2 | Hằng tuần, trên bản mới nhất | Restore vào DB tạm, đếm dòng so với manifest, kiểm khóa ngoại, phiên bản Flyway, liên tục của chuỗi audit | Báo cáo |
| V3 | Hằng tháng | Restore đầy đủ vào validation, khởi động ứng dụng, đối chiếu bản ghi ↔ object ↔ SHA-256, mở mẫu tài liệu, kiểm chữ ký điện tử | Hồ sơ diễn tập |
| V4 | Hằng quý | Diễn tập DR từ máy trống (mục 13.5) | Hồ sơ DR drill |

Bản backup chưa qua V1 hiển thị "Not verified" và không được chọn cho restore production. Bản chưa qua V2/V3 trong thời hạn quy định bị cảnh báo ở Backup Status Overview.

### 14.2 Điều kiện đạt toàn vẹn của một bản backup

- Mọi file có SHA-256 trùng manifest.
- Chữ ký manifest hợp lệ; `previousManifestSha256` khớp ledger.
- Bản ghi ledger của backup có mặt ở cả DB điều khiển và đích 3.
- Bộ không bị tham chiếu thiếu: mọi `heldBy` tồn tại và vẫn đạt V1.

### 14.3 Danh mục kiểm tra sau restore

| # | Kiểm tra | Tiêu chí đạt | Bắt buộc |
| --- | --- | --- | --- |
| C1 | Phiên bản schema | `flyway_schema_history` mới nhất = giá trị trong manifest | Có |
| C2 | Số dòng mỗi bảng và số large object | Bằng `rowCounts` và `largeObjectCount` trong manifest | Có |
| C3 | Khóa ngoại | Không dòng mồ côi | Có |
| C4 | Chuỗi audit trail | Dãy `audit_logs` liên tục, không khoảng trống | Có |
| C5 | Chữ ký điện tử | Kiểm lại băm chữ ký trên mẫu 100% tài liệu hiệu lực | Có |
| C6 | Bản ghi ↔ file | Mọi tham chiếu object phân giải được; SHA-256 khớp (100% tài liệu hiệu lực, mẫu thống kê phần còn lại) | Có |
| C7 | Object mồ côi | Có báo cáo danh sách và nhãn | Có |
| C8 | Người dùng và quyền | Số lượng khớp manifest; quản trị viên đăng nhập được | Có |
| C9 | Scheduler | Mọi scheduler ở trạng thái tắt | Có |
| C10 | Job dở dang | Đã chuyển "cần rà soát", không có job chạy | Có |
| C11 | Sức khỏe ứng dụng | Health check tốt, mở được một tài liệu mẫu và một controlled copy | Có |
| C12 | Phụ thuộc ngoài | MinIO, OnlyOffice, ClamAV, SMTP truy cập được | Cảnh báo |
| C13 | Bí danh phiên bản | Mọi tham chiếu trong 14 cột `*version_id` hoặc phân giải trực tiếp, hoặc phân giải qua đúng một bí danh; đọc qua bí danh cho SHA-256 khớp bản ghi; không bản ghi nào bị sửa (so sánh băm dữ liệu 12 bảng trước/sau bước R8); số bí danh bằng số object đã ghi lại | Có, khi nguồn không mang `versionId` |

Một kiểm tra bắt buộc thất bại làm yêu cầu chuyển FAILED; production vẫn là DB cũ vì chưa hoán đổi (mục 11.2).

### 14.4 Ánh xạ EU-GMP / Annex 11 QA xác nhận số điều khoản

| Yêu cầu (diễn giải) | Điều khoản tham chiếu | Đáp ứng bởi |
| --- | --- | --- |
| Dữ liệu được kiểm tra khả năng truy cập, đọc được, chính xác suốt thời hạn lưu | Annex 11 §7.1 | V1-V3, định dạng mở, đối chiếu object ↔ bản ghi |
| Backup đều đặn; kiểm tra tính toàn vẹn của backup và khả năng restore khi validation và định kỳ | Annex 11 §7.2 | Lịch, SHA-256, chữ ký, V2-V4, validation IQ/OQ/PQ |
| Audit trail đầy đủ, không sửa được | Annex 11 §9 | Ledger nối băm ngoài DB; ghi mọi thao tác backup/restore |
| Kiểm soát thay đổi | Annex 11 §10 | Policy có lý do, hai người; pre-change backup; restore gắn change control |
| An ninh, quyền truy cập | Annex 11 §12 | Quyền tối thiểu, mã hóa, tách khóa, cô lập mạng |
| Chữ ký điện tử | Annex 11 §14 | Duyệt và xác nhận restore, đổi policy |
| Liên tục hoạt động khi hệ thống hỏng | Annex 11 §16 | DR Plan, Rebuild Kit, diễn tập |
| Lưu trữ dài hạn | Annex 11 §17 | Khóa đích, định dạng mở, kiểm tra đọc được định kỳ |
| Validation hệ thống | Annex 11 §4 | Mục 22 |
| Hồ sơ | EU GMP Chương 4 | Hồ sơ đóng cho từng restore, drill, DR |
| Toàn vẹn dữ liệu (ALCOA+) | PIC/S PI 041 | Gán người, có thời điểm, gốc (manifest), bất biến, đầy đủ |

## 15 Lên lịch backup (Q13)

### 15.1 Lịch khởi điểm QĐ BR-1

| Việc | Giờ (múi giờ cơ sở) | Tần suất |
| --- | --- | --- |
| Cấu hình (full) | 01:30 | Hằng ngày |
| DB full logic | 02:00 | Hằng ngày |
| Object tăng dần | Sau DB, rồi mỗi 4 giờ | 6 lần/ngày |
| WAL | liên tục, `archive_timeout=300` | Tối đa 5 phút |
| Base backup PG | Chủ nhật 03:00 | Hằng tuần |
| Dump DB điều khiển | 04:00 | Hằng ngày |
| V1 | ngay sau mỗi backup | - |
| V2 | Thứ Hai 05:00 | Hằng tuần |
| Kiểm tra ledger | 06:00 | Hằng ngày |
| V3 (restore vào validation) | Thứ Bảy đầu tháng | Hằng tháng |
| V4 (DR) | Theo kế hoạch | Hằng quý |

### 15.2 Quy tắc

- **Không cần dừng hệ thống** khi backup: `pg_dump` dùng snapshot nhất quán; object bất biến.
- **Chống chạy chồng:** mỗi (thành phần, môi trường) chỉ một job; lần đến hạn sau khi lần trước chưa xong bị bỏ qua và ghi sự kiện "SKIPPED_OVERLAP".
- **Bỏ lỡ lịch** (agent tắt, đích lỗi): khi sống lại, chạy bù đúng một lần; sự kiện "MISSED" tạo cảnh báo. Không chạy bù nhiều lần.
- **Giờ và múi giờ:** lưu UTC; hiển thị theo múi giờ người dùng; đặt lịch theo múi giờ cơ sở, xử lý DST bằng thời điểm UTC tính lại mỗi ngày.
- **Cửa sổ loại trừ:** không chạy backup nặng trong cửa sổ bảo trì đã khai báo và trong thời gian restore.
- **Ưu tiên:** pre-change và pre-restore vượt hàng đợi.
- Đổi lịch phải qua hai người và có hiệu lực từ lần sau; không dừng việc đang chạy.

## 16 Thanh tra và rà soát (Q6)

Có thể, và nên thiết kế sẵn vì đây là câu hỏi thường gặp khi thanh tra.

### 16.1 Cách cấp quyền

- Dùng tính năng **Time-Limited User** đã có: tạo tài khoản thanh tra với thời hạn, vai trò Inspector (`backup.audit.view`, chỉ đọc). Không có quyền chạy, duyệt, tải bản backup.
- Mọi thao tác của thanh tra ghi audit trail như người dùng khác.

### 16.2 Thanh tra xem được gì và ở đâu

| Câu hỏi của thanh tra | Trả lời ở |
| --- | --- |
| Bao lâu backup một lần? Có lần nào thất bại không? | Backup History, Backup Schedules |
| Làm sao biết bản backup còn đọc được? | Backup Verification Results (V1-V3) |
| Đã từng restore thử chưa? Kết quả? | Restore History & Evidence, Disaster Recovery Drills |
| Ai được phép restore? Có tách nhiệm vụ không? | Restore Approval & Execution Rules; hồ sơ từng yêu cầu |
| Lần restore X: ai yêu cầu, ai duyệt, dữ liệu mất gì, kiểm tra gì? | Trang hồ sơ yêu cầu: Impact Report, chữ ký, Verification Report, timeline |
| Có chứng minh bản backup không bị sửa không? | Chuỗi băm ledger, chữ ký manifest, báo cáo xác minh chuỗi |
| Có kế hoạch DR không? Đã diễn tập chưa? | Disaster Recovery Plan, Disaster Recovery Drills |
| Cho xem nội dung một bản backup | Backup Inspection (mục 7.2), có QA đi cùng |
| Chứng minh một restore thật sự chạy | Trình diễn restore vào validation trước mặt thanh tra |

### 16.3 Evidence Pack

Nút "Export Evidence Pack" tạo một gói ký số cho một khoảng thời gian hoặc một sự kiện: danh sách backup, kết quả verify, restore, drill; trích đoạn ledger kèm chứng minh chuỗi băm; policy hiệu lực tại từng thời điểm. Định dạng PDF cho người đọc và CSV/JSON cho máy; gói có SHA-256 và chữ ký, và việc xuất cũng ghi ledger. Gói này **không chứa** dữ liệu GMP bên trong backup.

## 17 Mô hình dữ liệu (DB điều khiển `eqms_backup_control`)

Quy ước: UUID khóa chính, thời gian `timestamptz` UTC, giá trị máy là mã (không dùng nhãn hiển thị), mọi bảng sự kiện thêm-vào-cuối.

| Bảng | Cột chính | Ràng buộc |
| --- | --- | --- |
| `backup_policy` | id, version, status (`DRAFT, PENDING_APPROVAL, ACTIVE, SUPERSEDED`), scope_json, schedule_json, retention_json, targets_json, encryption_key_fingerprint, proposed_by, approved_by, reason, approval_signature_ref, created_at | Một dòng `ACTIVE`; `proposed_by <> approved_by`; không sửa dòng đã duyệt (version mới) |
| `backup_target` | id, name, kind (`SERVER_FOLDER, NETWORK_SHARE, OBJECT_STORAGE, REMOVABLE_MEDIA`), role (`PRIMARY, SECONDARY`), location, encrypted, off_site, immutable, last_test_at, last_test_ok | Sửa qua policy version |
| `backup_run` | id, backup_id (BK-...), type (`FULL, INCREMENTAL, PRE_CHANGE, PRE_RESTORE`), trigger (`SCHEDULED, MANUAL, PRE_CHANGE`), status (`QUEUED, RUNNING, COMPLETED, FAILED, SKIPPED`), policy_version, started_at, finished_at, db_snapshot_at, object_listed_at, size_bytes, error_code, requested_by, reason, change_control_ref | Chỉ chuyển trạng thái theo đồ thị hợp lệ |
| `backup_component_result` | run_id, component (`DATABASE, OBJECT_STORE, FILE_STORAGE, CONFIGURATION`), status, size_bytes, object_count, sha256, row_counts_json | - |
| `backup_set_location` | run_id, target_id, path, written_at, readback_sha256, ok | Một dòng cho mỗi đích |
| `backup_manifest` | run_id, manifest_json, manifest_sha256, signature, signing_key_id, previous_manifest_sha256 | Bất biến |
| `backup_verification` | id, run_id, tier (`V1, V2, V3, V4`), result (`VERIFIED, FAILED`), detail_json, verified_at, verified_by | Bất biến |
| `backup_export` | id, run_id, media_id, destination_path, status (`REQUESTED, APPROVED, RUNNING, COMPLETED, INVALID, REJECTED`), size_bytes, file_count, receipt_sha256, requested_by, approved_by, reason, started_at, finished_at | `requested_by <> approved_by`; chỉ `run_id` đã VERIFIED |
| `offline_media` | id, label, serial, kind, capacity_bytes, status (`AVAILABLE, IN_TRANSIT, STORED_OFFSITE, IN_READ_TEST, QUARANTINED, RETIRED`), custodian, location, allowed_path, holds_legal_hold_data, last_read_test_at, last_read_test_ok, expires_at, retired_at, destruction_ref | Mã nhãn duy nhất |
| `media_event` | id, media_id, at, actor, action (`REGISTERED, EXPORTED, HANDED_OVER, RECEIVED, READ_TEST, IMPORTED, QUARANTINED, RETIRED`), note | Thêm-vào-cuối |
| `legal_hold` | id, run_id, applied_by, applied_at, reason, released_by, released_at, release_reason | Gỡ cần người khác |
| `restore_request` | id (RS-...), kind (`RESTORE, DISASTER_RECOVERY`), mode (`R_FULL, R_DB, R_OBJ, R_ONE`), run_id, components_json, target (`VALIDATION_ENV, PRODUCTION, REBUILT_ENVIRONMENT`), status (đồ thị 11.3), reason, change_control_ref, point_in_time, impact_report_json, impact_report_sha256, gmp_assessment_json, requested_by, requested_at, decided_by, executed_by, verified_by, completed_at | CHECK: người yêu cầu, duyệt, ký xác nhận khác nhau; executor ≠ approver |
| `restore_event` | id, request_id, at, actor, action, note, signature_ref | Thêm-vào-cuối |
| `restore_check_result` | request_id, code (C1-C13), result (`PASS, FAIL, WARNING`), detail, required | Bất biến |
| `dr_scenario`, `dr_event`, `dr_drill` | Kịch bản, tuyên bố DR (hai người), diễn tập (scenario, ngày, rto_actual_min, rpo_actual_min, result, findings_json) | - |
| `backup_job` | id, type, payload_json, status, lease_until, attempts, created_at | Hàng đợi cho agent |
| `ledger_event` | seq, at, actor, event, ref, data_json, prev_hash, hash | Thêm-vào-cuối; `REVOKE UPDATE, DELETE`; trigger chặn; `hash` unique |
| `object_version_alias` (trong DB **eqms**, vì đường đọc file cần nó; bản chép trong DB điều khiển) | bucket, object_key, original_version_id, current_version_id, sha256, restore_request_id, created_at | Chỉ thêm; duy nhất theo (bucket, object_key, original_version_id); trigger chặn UPDATE/DELETE; chỉ Restore Worker ghi (mục 11.4) |
| `backup_impact_probe` | table_name, time_column, label, blocking | Danh sách bảng thăm dò |

**Trong DB eqms** chỉ thêm: các mã quyền mới (migration), và một vị trí tham chiếu chỉ đọc nếu cần hiển thị trạng thái. Không có bảng backup trong DB eqms, vì chúng sẽ bị thay khi restore.

## 18 Đặc tả API

Tiền tố `/backup-restore` (module) và `/settings/backup-restore` (administration). Tất cả cần xác thực; quyền kiểm ở máy chủ. Lệnh thay đổi nhận khóa `Idempotency-Key`. Backend chỉ ghi yêu cầu vào `backup_job` / `restore_request`; agent thực thi bất đồng bộ.

| Method và đường dẫn | Quyền | Mục đích |
| --- | --- | --- |
| `GET /backup-restore/overview` | `backup.module.view` | RPO thực tế, backup gần nhất, bản chưa verify, cảnh báo, restore đang chạy |
| `GET /backup-restore/backups` (+ tìm, lọc, sắp xếp, phân trang phía server) | `backup.module.view` | Backup History |
| `GET /backup-restore/backups/{id}` | nt | Chi tiết, thành phần, vị trí, manifest tóm tắt |
| `POST /backup-restore/backups` | `backup.backup.run` | Backup thủ công / pre-change (lý do bắt buộc) |
| `POST /backup-restore/backups/{id}/verify` | `backup.backup.verify` | Chạy V1 lại hoặc V2 |
| `POST /backup-restore/backups/{id}/hold`, `/release-hold` | `backup.hold.manage` | Legal hold |
| `POST /backup-restore/backups/{id}/exports`, `GET /backup-restore/exports`, `/{id}` | `backup.backup.export` | Yêu cầu và xem Export Backup Set (có kích thước ước tính) |
| `POST /backup-restore/exports/{id}/approve`, `/reject` | `backup.admin.storage.manage` | Duyệt xuất (người khác người yêu cầu) |
| `GET/POST /settings/backup-restore/media`, `POST /{id}/handover`, `/receive`, `/read-test`, `/retire` | `backup.media.manage` | Offline Media Register |
| `POST /backup-restore/imports` | `backup.restore.execute` | Register Imported Set từ phương tiện |
| `GET /backup-restore/backups/verifications` | view | Backup Verification Results |
| `GET /backup-restore/schedules` | view | Backup Schedules (đọc từ policy ACTIVE) |
| `POST /backup-restore/restores/impact-preview` | `backup.restore.request` | Tính Impact Report trước khi tạo yêu cầu (không lưu) |
| `POST /backup-restore/restores` | `backup.restore.request` | Tạo yêu cầu (đóng băng Impact Report) |
| `GET /backup-restore/restores`, `/{id}` | view | Restore Requests, chi tiết, timeline |
| `POST /backup-restore/restores/{id}/submit` | requester | Gửi duyệt |
| `POST /backup-restore/restores/{id}/approve`, `/reject` | `backup.restore.approve` | Duyệt (e-sign) hoặc từ chối (lý do và e-sign) |
| `POST /backup-restore/restores/{id}/schedule`, `/start`, `/abort` | `backup.restore.execute` | Đặt cửa sổ, bắt đầu, dừng khi an toàn |
| `POST /backup-restore/restores/{id}/signoff` | `backup.restore.verify_signoff` | Ký xác nhận hoặc không xác nhận |
| `GET /backup-restore/restores/approvals`, `/verification-reports`, `/history` | view | Ba màn danh sách |
| `POST /backup-restore/inspections`, `GET /{id}`, `DELETE /{id}` | QA / inspector | Backup Inspection (tạo, xem, hủy) |
| `GET /backup-restore/dr/drills`, `POST` | view / `backup.dr.declare` | Diễn tập DR |
| `POST /backup-restore/dr/declarations`, `/{id}/confirm` | `backup.dr.declare` | Tuyên bố DR cần người thứ hai xác nhận |
| `POST /backup-restore/evidence-packs` | `backup.audit.view` | Xuất Evidence Pack |
| `GET /settings/backup-restore/policy`, `PUT` (tạo version DRAFT), `POST /{id}/submit`, `/approve` | `backup.admin.policy.view` / `.manage` | Policy theo version |
| `GET/PUT /settings/backup-restore/targets`, `POST /{id}/test` | `backup.admin.storage.*` | Đích và kiểm tra thử |
| `GET/PUT /settings/backup-restore/{retention\|verification\|restore-controls\|alerts\|dr-plan}` | tương ứng | Các màn Administration còn lại; mọi PUT là một đề xuất cần duyệt |
| `GET /settings/backup-restore/ledger/verify` | `backup.audit.view` | Chạy xác minh chuỗi băm theo yêu cầu |

### 18.1 Mã lỗi (giá trị máy)

| Mã | Khi nào |
| --- | --- |
| `BACKUP_TARGET_UNAVAILABLE` | Đích không ghi được |
| `BACKUP_POLICY_NOT_COMPLIANT` | Thiếu 3-2-1-1 khi kích hoạt |
| `BACKUP_NOT_VERIFIED` | Chọn bản chưa qua V1 để restore |
| `RESTORE_SAME_PERSON` | Cùng một người giữ hai vai bị cấm |
| `RESTORE_IMPACT_BLOCKING` | Impact Report có mục chặn |
| `RESTORE_VERSION_INCOMPATIBLE` | Backup mới hơn mã đang chạy |
| `RESTORE_IN_PROGRESS` | Đã có restore đang chạy |
| `LEDGER_CHAIN_BROKEN` | Chuỗi băm không khớp |
| `LEGAL_HOLD_ACTIVE` | Không được tác động tới bộ đang bị giữ |
| `EXPORT_BACKUP_NOT_VERIFIED` | Xuất bản chưa VERIFIED |
| `EXPORT_MEDIA_NOT_AVAILABLE` | Phương tiện chưa đăng ký hoặc không ở trạng thái AVAILABLE |
| `EXPORT_SAME_DISK` | Đường dẫn xuất cùng đĩa vật lý với T1 |
| `IMPORT_CHAIN_MISMATCH` | Chữ ký hoặc chuỗi băm của gói nhập không khớp |

## 19 Đặc tả giao diện

Mọi màn dùng các thành phần chung của dự án (`PageHeader`, `DataTable`, `ConfiguredDesktopFilters`, `FilterDrawer`, `FormSection`, `useCustomColumnLayout`) và quy tắc: tìm, lọc, sắp xếp, phân trang **phía server**; tiêu đề trang trùng tên menu; breadcrumb có nhóm.

### 19.1 Module Backup & Restore

| Màn (menu) | Nội dung và hành động | Khác với bản mẫu hiện tại |
| --- | --- | --- |
| Backup Status Overview | RPO thực tế so với mục tiêu; thời gian từ backup thành công gần nhất; bản chưa verify; cảnh báo ledger; dung lượng đích; restore đang chạy; diễn tập quá hạn | Thêm thẻ RPO thực tế và trạng thái ledger |
| Backup > Backup History | Bảng backup, bộ lọc trạng thái/loại/trigger/thời gian, ngăn chi tiết (thành phần, vị trí từng đích, manifest), hành động Create Backup, Verify, **Export Backup Set**, Apply/Release Legal Hold, Restore From This Backup | Chuyển sang lọc phía server; thêm vị trí từng đích, độ tươi của verify và nút Export (hộp thoại: phương tiện, kích thước gói, lý do) |
| Backup > Backup Verification Results | V1-V3 theo bản, kết quả, người/thời gian; nút Re-verify | Thêm cột tầng V |
| Backup > Backup Schedules | Lịch đang hiệu lực từ policy ACTIVE, lần chạy kế tiếp, lần chạy gần nhất, lần bỏ lỡ | Thêm lần chạy kế/lần bỏ lỡ |
| Restore > Restore Requests | Danh sách; New Restore Request (wizard) | Thêm chế độ R-OBJ/R-ONE; bước Impact Report; bước đánh giá GMP |
| Restore > New Restore Request | Chọn backup → loại và chế độ → đích → thành phần → lý do + change control → **Restore Impact Report** → đánh giá GMP → xem lại → gửi | Thêm bước Impact Report (đang chỉ là đoạn mô tả) |
| Restore > Restore Execution Console (mở từ chi tiết yêu cầu; là màn **duy nhất** truy cập được khi khóa) | Bộ đếm ngược thông báo (Extend, Cancel); số phiên còn lại và danh sách; request, job, phiên OnlyOffice; nút Buộc đăng xuất; ô xác nhận "không còn người dùng"; nút Thực thi restore; tiến trình R5-R12 theo thời gian thực; nhật ký; nút Dừng; Mở lại hệ thống. Giao diện toàn màn hình, không có menu bên | Màn mới |
| Restore > Restore Approval Queue | Yêu cầu chờ người dùng hiện tại duyệt; mở ngăn chi tiết, đọc Impact Report, Approve and Sign hoặc Reject | Lọc "chờ tôi"; chặn nút khi là người yêu cầu |
| Restore > Restore Verification Reports | Báo cáo C1-C13 theo yêu cầu; Sign-off tại đây | Thêm nút ký xác nhận |
| Restore > Restore History & Evidence | Hồ sơ đã đóng; trang chi tiết có tab: Tổng quan, Impact Report, Phê duyệt, Tiến trình, Verification, Bằng chứng; Export Evidence Pack | Thêm tab và Evidence Pack |
| Restore > Disaster Recovery Drills | Diễn tập: kịch bản, ngày, RTO/RPO đo được so với mục tiêu, kết quả, phát hiện | Thêm so sánh với mục tiêu |

Wizard và trang chi tiết cần thêm hai thành phần: **Impact Preview** (mục 10.2, hiển thị các hàng chặn/cảnh báo/thông tin) và **Execution Progress** (R5-R12 với trạng thái từng bước, nút Abort chỉ khả dụng trước R11).

### 19.2 Backup & Restore Administration

| Màn | Trường cấu hình | Quy tắc kiểm tra |
| --- | --- | --- |
| Backup Policy | Phạm vi (DB, từng bucket, provider file, cấu hình; mục loại trừ kèm lý do); lịch từng thành phần; chế độ (full/incremental); bật WAL; trạng thái Draft/Active; nút Submit for Approval | Kích hoạt chỉ khi đạt 3-2-1-1; không loại trừ D1, D2, D3, D4; mọi lưu hỏi lý do |
| Backup Retention & Legal Hold | Thời hạn hiển thị "Vĩnh viễn" cho mọi loại (chỉ đọc, BR-2); sổ đăng ký legal hold | Không có trường nhập thời hạn cho production; đích dev/validation có thời hạn ngắn riêng và bị chặn nếu trỏ vào đích production |
| Backup Storage & Encryption | Danh sách đích (loại, vai trò, vị trí, off-site, immutable); kiểm tra thử; dấu vân tay khóa mã hóa; dung lượng và dự báo; **chọn đích ngoài cơ sở / bất biến (BR-6): thay đổi cần e-sign và audit**; **Offline Media Register** (mục 6.5.3: danh sách phương tiện, trạng thái, người giữ, kiểm tra đọc cuối, hành động Register Media, Hand Over, Receive, Record Read Test, Retire) | Không lưu mật khẩu đích trong giao diện; kiểm thử "xóa bị từ chối" cho đích bất biến |
| Backup Verification & Restore Drills | Chu kỳ V2, V3; mục kiểm tra sau restore (C1-C13) và cờ bắt buộc; chu kỳ diễn tập | C1-C11 luôn bắt buộc, không tắt được |
| Restore Approval & Execution Rules | Đích được phép; ai được duyệt (nhóm/quyền); phân tách vai; yêu cầu change control; yêu cầu e-sign; cửa sổ bảo trì; **số phút thông báo n, mốc nhắc, tài khoản vận hành** (mục 11.5.5) | Phân tách vai không thể tắt cho production |
| Backup Alerts & Recipients | Người nhận, sự kiện, ngưỡng (xem mục 21) | Cảnh báo chuỗi băm gãy và backup thất bại luôn bật |
| Disaster Recovery Plan | Kịch bản, RPO/RTO, Rebuild Kit (danh mục, phiên bản, lần cập nhật cuối), danh bạ, **DR Authority (BR-7: người dùng chọn, tối thiểu hai; thay đổi cần e-sign và audit)**, chu kỳ diễn tập | Cảnh báo khi Rebuild Kit cũ hơn thay đổi hạ tầng gần nhất |

### 19.3 Quyền và migration

- Migration kế tiếp: kiểm tra `flyway_schema_history` và `ls db/migration` trước khi đặt số; **không sửa migration đã áp dụng**. Số kế tiếp hiện là V561 nếu chưa có thay đổi khác ĐÃ KIỂM TRA: V560 là announcements.
- Thêm quyền: `backup.backup.export`, `backup.media.manage`, `backup.backup.run`, `backup.backup.verify`, `backup.hold.manage`, `backup.restore.request`, `backup.restore.approve`, `backup.restore.execute`, `backup.restore.verify_signoff`, `backup.dr.declare`, `backup.audit.view`, và `backup.admin.*.manage` cho bảy màn; mỗi quyền hành động có `permission_dependencies` (cần `rule_id`) tới `backup.module.view`.
- Menu đã sẵn; thêm điều kiện hiển thị theo quyền cho từng mục (hiện cùng dùng `backup.module.view`).

## 20 Backup Agent

### 20.1 Vòng đời một backup

```
sequenceDiagram
  participant S as Scheduler (agent)
  participant C as DB điều khiển
  participant P as PostgreSQL
  participant M as MinIO chính
  participant T as Các đích
  S->>C: tạo backup_run (RUNNING), ledger BACKUP_STARTED
  S->>S: Pre-Backup Check
  S->>P: pg_dump -Fc (snapshot), ghi db_snapshot_at
  S->>M: ListObjectVersions, ghi object_listed_at
  S->>M: GET các version mới
  S->>S: mã hóa, tính SHA-256, dựng manifest
  S->>T: ghi từng đích, đọc lại, so SHA-256
  S->>S: ký manifest, nối băm
  S->>C: backup_manifest, ledger BACKUP_COMPLETED
  S->>T: ledger ra đích 3
  S->>S: V1
  S->>C: backup_verification
```

### 20.2 Thuật toán sao chép object tăng dần

```
known  = tập (bucket,key,versionId) đã nằm trong chuỗi manifest gần nhất
listed = ListObjectVersions(bucket, prefix="") cho từng bucket trong scope
new    = listed - known
for v in new:                        # song song có giới hạn
    stream = GetObject(bucket,key,versionId)
    sha    = sha256(stream)          # tính khi đọc
    write  = encrypt(stream) -> mỗi đích: Put
    verify = GetObject trên đích -> sha256 == sha  (đọc lại)
    nếu delete-marker: ghi vào manifest, không có nội dung
manifest.refs = known ∪ new          # full view
nếu trong 'known' có version không còn trong 'listed': ghi cảnh báo OBJECT_MISSING_IN_SOURCE
                                      (bất thường, vì bucket khóa không cho xóa)
```

### 20.3 Lệnh DB

```
pg_dump -h eqms-postgres -U eqms_backup_ro -d eqms -Fc --no-owner --no-privileges -f eqms.dump
pg_restore --list eqms.dump          # V1: mục lục đọc được
# restore (worker):
createdb eqms_restore_<id>
pg_restore -d eqms_restore_<id> --no-owner --exit-on-error eqms.dump
```

WAL: cấu hình `wal_level=replica`, `archive_mode=on`, `archive_command` gọi tiện ích của agent để ghi và nối băm từng segment, `archive_timeout=300`. Cần sửa cấu hình container postgres và khởi động lại một lần trong cửa sổ bảo trì.

### 20.4 Xử lý lỗi

- Thử lại có giới hạn (3 lần, tăng dần) cho lỗi mạng; không thử lại lỗi toàn vẹn.
- Một đích lỗi: backup vẫn **COMPLETED** nếu còn đủ đích theo policy, ngược lại **FAILED**; luôn cảnh báo.
- Hết dung lượng: dừng, không xóa bản cũ để lấy chỗ.
- Agent chết giữa chừng: lease hết hạn, job sang lại; phần ghi dở đánh dấu không dùng được và không bao giờ được liệt kê trong manifest.
- Mọi lỗi ghi mã máy (`BACKUP_TARGET_UNAVAILABLE`, ...), không chỉ thông điệp.

### 20.5 Đoạn compose tham khảo

```
eqms-backup-agent:
  image: eqms-backup-agent:local        # ghim digest ở production
  read_only: true
  user: "10001:10001"
  networks: [backup-net]
  depends_on: [eqms-backup-control]
  environment:
    CONTROL_DB_URL: jdbc:postgresql://eqms-backup-control:5432/eqms_backup_control
    SOURCE_DB_URL: jdbc:postgresql://eqms-postgres:5432/eqms
    # bí mật qua Docker secrets, không để trong biến môi trường
  secrets: [backup_ro_pw, minio_ro_key, target_write_key, gpg_public_key, signing_key]
  mem_limit: 1g
  cpus: 1.0
  healthcheck: { test: ["CMD", "agent-health"], interval: 30s }
```

## 21 Giám sát và cảnh báo

| Sự kiện | Ngưỡng khởi điểm | Mức |
| --- | --- | --- |
| Backup thất bại | Mọi lần | Cao |
| Quá thời gian không có backup thành công | > 26 giờ (full), > 6 giờ (object) | Cao |
| Bỏ lỡ lịch | Mọi lần | Trung bình |
| Verify thất bại | Mọi lần | Cao |
| Bản chưa verify quá lâu | > 24 giờ | Trung bình |
| V2/V3 quá hạn | Quá chu kỳ | Trung bình |
| Chuỗi băm ledger gãy | Mọi lần | Nghiêm trọng |
| Đích đầy | Còn < 60 ngày hoặc < 15% | Cao |
| Đích bất biến mất bảo vệ | Thử xóa không bị từ chối | Nghiêm trọng |
| Đồng hồ lệch | > 2 giây | Cao |
| Khóa mã hóa hoặc chứng thư ký sắp hết hạn | 30 ngày | Trung bình |
| Chỉ còn một phương tiện ngoại tuyến hợp lệ, hoặc kiểm tra đọc phương tiện quá hạn | Quá 1 quý | Cao |
| Lần Export Backup Set gần nhất quá cũ | Quá chu kỳ BR-13 | Trung bình |
| Diễn tập quá hạn / Rebuild Kit cũ | Quá chu kỳ | Trung bình |
| Đổi policy, yêu cầu restore, tuyên bố DR | Mọi lần | Thông báo cho QA |
| Kích thước DB hoặc số object tăng/giảm bất thường | > 30% so với trung vị | Trung bình |

Cảnh báo gửi email và trong ứng dụng; kênh ngoài ứng dụng (email tới QA/IT) vẫn hoạt động khi ứng dụng chết vì agent gửi trực tiếp.

## 22 Validation và kiểm thử

### 22.1 Đánh giá rủi ro (rút gọn)

| Rủi ro | Hậu quả | Kiểm soát | Kiểm thử |
| --- | --- | --- | --- |
| Backup không dùng được vì chưa từng restore | Mất dữ liệu GMP | V2-V4 | OQ-05, PQ-02 |
| Restore sai bản / sai đích | Mất dữ liệu hiện tại | Impact Report, duyệt, bản an toàn, hoán đổi tên | OQ-08, OQ-09 |
| Một người tự làm tất cả | Gian lận, sai sót | Phân tách vai ở máy chủ | OQ-10 |
| Bản backup bị sửa | Phục hồi dữ liệu giả | Ký, chuỗi băm, bất biến | OQ-12, OQ-13 |
| Mất khóa | Mất toàn bộ backup | Hai người giữ, diễn tập | PQ-03 |
| Trùng lặp sau restore | Gửi email, phát hành hai lần | Tắt scheduler, job rà soát | OQ-11 |
| Đồng thời: hai restore hoặc restore lúc backup | Hỏng dữ liệu | Khóa tư vấn, hàng đợi | OQ-14 |

### 22.2 Kế hoạch kiểm thử

| Mã | Loại | Nội dung và tiêu chí đạt |
| --- | --- | --- |
| IQ-01 | Cài đặt | Container, mạng, quyền tối thiểu đúng: agent không xóa được ở đích; backend không đọc được đích |
| IQ-02 | Cài đặt | NTP, volume, image ghim digest, hệ tệp gốc chỉ đọc |
| OQ-01 | Backup | Backup full tạo đủ tệp, manifest ký, SHA-256 đúng |
| OQ-02 | Backup | Backup tăng dần chỉ sao chép version mới; manifest "full view" đủ |
| OQ-03 | Âm tính | Đích đầy: backup dừng, không xóa bản cũ, cảnh báo phát |
| OQ-04 | Âm tính | Đích 3 từ chối xóa/ghi đè (kiểm bằng cách thử) |
| OQ-05 | Restore | Restore validation: mọi C1-C13 đạt; so sánh với nguồn |
| OQ-06 | Âm tính | Sửa 1 byte trong tệp backup: V1 FAILED, không cho chọn restore |
| OQ-07 | Âm tính | Sửa manifest: chữ ký sai |
| OQ-08 | Restore | Restore production thành công, hoán đổi tên DB, DB cũ còn nguyên |
| OQ-09 | Lỗi | Kiểm tra bắt buộc thất bại: production vẫn là DB cũ |
| OQ-10 | Phân quyền | Requester tự duyệt bị `RESTORE_SAME_PERSON`; Executor ≠ Approver; thiếu quyền → 403 |
| OQ-11 | Trùng lặp | Job dở dang không chạy lại sau restore; email không gửi lại |
| OQ-12 | Âm tính | Sửa ledger: `ledger-verify` báo gãy chuỗi |
| OQ-13 | Âm tính | UPDATE/DELETE trực tiếp bảng sự kiện bị từ chối |
| OQ-14 | Đồng thời | Hai yêu cầu restore cùng lúc: chỉ một chạy; backup trong lúc restore bị hoãn |
| OQ-15 | Lỗi | Agent chết giữa chừng: job tiếp tục, phần dở không vào manifest |
| OQ-16 | R-ONE | Xóa file thử ở dev (không phải bucket khóa), khôi phục đúng versionId, SHA-256 khớp |
| OQ-17 | PITR | Khôi phục tới thời điểm T giữa hai backup; bản ghi sau T không có |
| OQ-18 | Thanh tra | Tài khoản Inspector chỉ đọc; Evidence Pack xác minh được |
| OQ-23 | Restore MinIO | Mất toàn bộ bucket thử, dựng lại từ T1 (file): mọi object có bí danh, C6 và C13 đạt, mở được tài liệu mẫu, **chữ ký điện tử còn nguyên `versionId` gốc** |
| OQ-24 | Âm tính | Bí danh có SHA-256 khác nội dung thật (đã bị sửa trên đích): đọc bị từ chối với lỗi toàn vẹn; không có bí danh: lỗi "không tìm thấy", không đoán; UPDATE/DELETE trực tiếp trên bảng bí danh bị từ chối |
| OQ-25 | Audit | Mỗi lần restore ghi bí danh có đúng một dòng audit tóm tắt, sự kiện sổ cái `OBJECT_ALIASES_CREATED` và bản chép trong DB điều khiển; dòng audit cũ không đổi; hệ thống không sửa dòng nào của 12 bảng chứa tham chiếu |
| OQ-26 | Nhân bản | Dựng lại từ T3 bằng nhân bản ngược: `versionId` giữ nguyên, không cần ánh xạ (nếu thử nghiệm 11.4.3 xác nhận) |
| OQ-27 | Khóa | Khi khóa: người dùng thường không đăng nhập được; gọi API trực tiếp (token cũ còn hạn) nhận 503 `MAINTENANCE_MODE` |
| OQ-28 | Khóa | Admin vận hành chỉ gọi được endpoint trong danh sách trắng; mọi chức năng khác 503 |
| OQ-29 | Đếm ngược | Hết n phút: mọi phiên thường bị thu hồi, Admin nhận thông báo kèm số phiên; người dùng online thấy hộp thoại đếm ngược và tự đăng xuất; đếm ngược đúng theo giờ máy chủ dù đồng hồ máy khách lệch |
| OQ-30 | Cổng | Nút Thực thi bị chặn khi còn phiên, còn job chạy hoặc chưa tích xác nhận; Buộc đăng xuất rồi mới bật |
| OQ-31 | Hoán đổi | Sau hoán đổi, token và phiên tạo **trước thời điểm backup** (còn hạn trong DB đã restore) bị từ chối nhờ session epoch |
| OQ-32 | Hoán đổi | Maintenance Pass vẫn dùng được qua lần hoán đổi, kể cả khi người vận hành không tồn tại trong DB đã restore; đăng nhập lại bằng tài khoản bảo trì |
| OQ-33 | Hủy/gia hạn | Hủy trong `NOTICE` trả về NORMAL, người dùng không bị đăng xuất; gia hạn cập nhật đếm ngược cho mọi người |
| OQ-34 | Lỗi | DB điều khiển mất kết nối khi đang khóa: hệ thống giữ khóa (tệp `maintenance.lock`); Redis bị xóa: khóa vẫn hiệu lực |
| OQ-35 | Giao diện | Bấm Close đóng hộp thoại nhưng đếm ngược vẫn chạy; chip đỏ nhạt trong Header nhấp nháy; bấm chip mở lại hộp thoại; với `prefers-reduced-motion` chip đứng yên; hết giờ tự đăng xuất |
| OQ-36 | Super Administrator | Đăng nhập được khi bảng người dùng trống và khi hệ thống khóa; không dùng bảng `users` hay `AuthSession` |
| OQ-37 | Super Administrator | Mọi lần đăng nhập, thất bại, hành động nhạy cảm: có ledger, audit kèm tên người khai báo và lý do, email cho QA |
| OQ-38 | Âm tính | Người dùng thường không thể giả phạm vi `SUPER_ADMIN` (token giả, sửa vai trò); Super Administrator không ký điện tử thay người khác |
| OQ-39 | Phân tách | Theo BR-19 phương án A: Super Administrator một mình không hoàn tất được restore production (cần người thứ hai ở các bước hai người) |
| OQ-40 | Khóa tài khoản | Đăng nhập sai nhiều lần khóa tài khoản và phát cảnh báo nghiêm trọng; mở khóa chỉ qua quy trình người giữ khóa |
| OQ-19 | Export | Gói xuất giải mã được và restore trên máy sạch **không có** thư mục backup gốc: tự chứa đủ |
| OQ-20 | Âm tính | Sửa 1 byte trong gói trên phương tiện: `verify-chain` và Register Imported Set từ chối (`IMPORT_CHAIN_MISMATCH`) |
| OQ-21 | Âm tính | Xuất bản chưa VERIFIED, ra đường dẫn chưa đăng ký, cùng đĩa với T1, hoặc cùng người duyệt: đều bị từ chối |
| OQ-22 | Lỗi | Rút phương tiện giữa chừng khi xuất: gói INVALID, không có biên nhận, không vào danh sách hợp lệ |
| PQ-01 | Vận hành | 14 ngày lịch thật: không bỏ lỡ, RPO thực tế đạt mục tiêu |
| PQ-02 | Diễn tập | Một V3 hoàn chỉnh bởi người vận hành không phải dev |
| PQ-03 | DR | Diễn tập DR trên máy trống theo Rebuild Kit, gồm giải mã từ bản sao khóa đã cất; đo RTO |

Mỗi giai đoạn triển khai (mục 23) có hồ sơ thay đổi riêng theo mẫu `08_ONE_CHANGE_RECORD_TEMPLATE.md`, nêu bằng chứng âm tính, đồng thời và lỗi tương ứng. Trước khi sửa bất kỳ symbol nguồn nào phải chạy phân tích tác động GitNexus (upstream) và giữ kết quả `detect_changes` trước khi commit.

## 23 Kế hoạch triển khai và cách xác minh

Mục này trả lời hai câu hỏi: **làm theo thứ tự nào, ở đâu trong code**, và **làm sao chứng minh từng phần chạy đúng**. Mỗi giai đoạn kết thúc bằng một cổng nghiệm thu; chưa qua cổng thì không sang giai đoạn sau.

### 23.1 Cách làm việc

- **Mỗi giai đoạn là một thay đổi có hồ sơ riêng** theo mẫu `eqms-backend/docs/validation/08_ONE_CHANGE_RECORD_TEMPLATE.md`, đặt tên `BACKUP_P{n}_{yyyy_MM_dd}_CHANGE_RECORD.md`. Hồ sơ nêu phạm vi, rủi ro, bằng chứng test, bằng chứng âm tính, đồng thời, lỗi.
- **Trước khi sửa mã nguồn có sẵn** (ví dụ `PermissionEvaluationService`, `AuthTokenFilter`, `NavigationService`, `AuditTrailService`): chạy phân tích tác động GitNexus (upstream) và báo cho bạn số nơi gọi và mức rủi ro; trước khi commit chạy `detect_changes` và lưu kết quả vào hồ sơ. Nếu công cụ GitNexus không dùng được trong phiên, mình ghi rõ trong hồ sơ và thay bằng phân tích gọi hàm thủ công (tìm tham chiếu); không bỏ qua bước này.
- **Viết test trước hoặc cùng lúc** với mã: mỗi mã lỗi và mỗi quy tắc "chặn" trong SDS có ít nhất một test âm tính.
- **Không sửa migration đã áp dụng.** Trước khi thêm migration: đọc `flyway_schema_history` và `ls db/migration`; migration của eqms chỉ chứa quyền và cột nhãn chủ thể audit; schema điều khiển nằm trong module agent.
- **Báo cáo trung thực:** mỗi giai đoạn mình báo rõ điều đã chạy thật, điều chỉ test bằng giả lập, điều bỏ qua và vì sao. Compile và deploy thành công **không** được ghi là "đã kiểm chứng chức năng".
- **Không dùng dữ liệu GMP thật trước go-live.** Bucket `eqms-gmp-records` khóa vĩnh viễn; mọi test dùng bucket/DB riêng (mục 23.4).

### 23.2 Thử nghiệm ngắn trước khi viết mã (Spike, giai đoạn P0)

Bốn việc nhỏ, mỗi việc cho ra một kết luận ghi vào `docs/plans/BACKUP_SPIKES.md`. Kết quả quyết định thiết kế các giai đoạn sau.

| Mã | Câu hỏi | Cách làm | Kết quả cần có |
| --- | --- | --- | --- |
| S1 | Chữ ký điện tử và băm bản ghi có chứa chuỗi URI file (có `versionId`) không? | Đọc code tạo và kiểm chữ ký, băm bản ghi; dựng test nhỏ: đổi `versionId` trong một bản ghi mẫu rồi kiểm chữ ký | **XONG.** 14 cột / 12 bảng chứa versionId; chữ ký bất biến bằng trigger; cách sửa tham chiếu bị loại, dùng bảng bí danh |
| S2 | MinIO `RELEASE.2025-04-22` sinh `versionId` thế nào khi ghi lại? Nhân bản bucket có giữ `versionId` và retention không? | Hai container MinIO tạm, bucket `eqms-spike-*` không khóa rồi một bucket khóa 1 ngày; ghi, sao chép, nhân bản, ghi lại các `versionId` | **XONG.** Không chọn được versionId; nhân bản site giữ versionId nhưng đường dựng lại site chưa kiểm chứng; chốt BR-15 = bí danh |
| S3 | Bật WAL archiving trên PostgreSQL 17 trong compose được không, ảnh hưởng gì? | Container Postgres tạm **không phải DB dev**, bật `archive_mode`, tạo dữ liệu, khôi phục tới một thời điểm | **XONG.** PITR đúng mốc (3.000 dòng, 0 dòng sau T); cần nén WAL; dung lượng/ngày chưa đo trên tải thật |
| S4 | Thời gian và kích thước thật của `pg_dump -Fc` và `pg_restore` trên DB dev (322 MB)? | Dump DB dev (chỉ đọc) ra tệp, restore vào DB tạm `eqms_spike_*`, so số dòng từng bảng | **XONG.** Dump 6 giây (85 MB), restore 8 giây, 134 bảng và 594.929 dòng khớp |

**P0 đã hoàn thành (2026-10-08).** Bốn thử nghiệm đã chạy thật trên container tạm; báo cáo ở `docs/plans/BACKUP_SPIKES.md`, mã chạy lại ở `scripts/spikes/backup/`. Kết quả đổi thiết kế: bảng bí danh thay cho sửa tham chiếu (mục 11.4). Phát hiện thêm: công cụ `mc` không còn được phân phối công khai, nên runbook chỉ dùng SDK hoặc API quản trị trực tiếp.

**P1 đã xong trên DEV (2026-10-08).** Agent, DB điều khiển, sổ cái nối băm, backup DB mã hóa và ký, V1, API và bốn màn hình (Backup Status Overview, Backup History, Backup Verification Results, Backup Schedules) chạy thật. Kiểm chứng đầu-cuối trên stack thật: 24/24 (`scripts/backup/p1-e2e.sh`); test: agent 39, backend 35, frontend 99. Hồ sơ: `eqms-backend/docs/validation/BACKUP_P1_2026_10_08_CHANGE_RECORD.md`.

**Khác với SDS ban đầu (đã áp dụng):** (1) backend gọi **API nội bộ của agent** bằng bí mật dùng chung, không ghi trực tiếp vào DB điều khiển (không giữ thông tin xác thực DB đó, bề mặt nhỏ hơn); (2) V1 không giải mã; (3) **large object** được đếm và đối chiếu; (4) vai trò chỉ-đọc của agent cần `lo_compat_privileges` vì `pg_read_all_data` không bao phủ large object; (5) khóa mã hóa nhận tin là **subkey** của khóa chính, và gpg mới ghi gói AEAD; (6) mẫu hồ sơ thay đổi `08_ONE_CHANGE_RECORD_TEMPLATE.md` không có trong repo, hồ sơ viết theo dạng các hồ sơ hiện có.

**Chưa có:** export, restore, chế độ bảo trì, Super Administrator, WAL, DR. Backup tạo ra bây giờ **không phải bản ghi GMP**.

**Trạng thái P3 (2026-10-09).** Đã xong: kiểm tra restore thử (18/18); Super Administrator; máy trạng thái bảo trì, cổng khóa, chip đếm ngược, hộp thoại, tự đăng xuất (22/22, 9/9, 11/11, 10/10); cảnh báo Admin trong ứng dụng và email (kiểm trên Mailhog); yêu cầu restore R0-R3 kèm báo cáo tác động và duyệt bằng chữ ký (18/18); màn hình yêu cầu, hàng đợi duyệt và form tạo yêu cầu đã nối API thật (lát 7). **Chưa có: R4-R12 (thực thi restore), Restore Execution Console.** Chi tiết ở [23.9](#s23).

### 23.3 Các giai đoạn

Kích cỡ: S nhỏ, M vừa, L lớn (tương đối, không phải ước lượng thời gian).

| Giai đoạn | Việc (work package) và vị trí trong code | Test và cổng nghiệm thu | Bạn xem được gì (demo) |
| --- | --- | --- | --- |
| **P0** Chuẩn bị (S) | Spike S1-S4. Cập nhật Decision Log: BR-1 đến BR-19. Cấp môi trường: MinIO thứ hai cho đích T3 (dev: container riêng), bucket test, DB test. | Báo cáo spike; Decision Log được ghi; **cổng:** S1 và S2 có kết luận. | Tài liệu kết quả từng spike kèm lệnh chạy lại được. |
| **P1** Nền tảng (L) | **WP1.1** Module mới `eqms-backup-agent/` (Spring Boot 21, cùng cách build như backend). Schema điều khiển bằng Flyway riêng `db/control/V1...`: `backup_policy, backup_run, backup_component_result, backup_manifest, backup_verification, backup_job, ledger_event`, quyền `REVOKE UPDATE, DELETE` và trigger chặn trên bảng sự kiện. <br> **WP1.2** `LedgerService`: nối băm, xác minh chuỗi, ghi ra tệp JSON Lines. <br> **WP1.3** `DatabaseBackupJob`: `pg_dump -Fc` vào T1, SHA-256, manifest, ký Ed25519, mã hóa OpenPGP. <br> **WP1.4** `VerificationService` V1. <br> **WP1.5** Compose: `eqms-backup-control`, `eqms-backup-agent`, mạng `backup-net`, vai trò PG `eqms_backup_ro`. <br> **WP1.6** Backend: `com.eqms.backup` (đọc kết quả từ DB điều khiển, `POST /backups` ghi `backup_job`), migration eqms thêm quyền `backup.backup.run`, `backup.backup.verify` (kèm `permission_dependencies`). <br> **WP1.7** Frontend: nối **Backup History**, **Backup Verification Results**, **Backup Schedules**, **Backup Status Overview** vào API; bỏ banner "Design preview" ở màn đã nối. | OQ-01, OQ-06, OQ-07, OQ-12, OQ-13. Unit: ledger, manifest, ký. Integration: backup thật DB dev vào T1, restore vào DB tạm, so số dòng. **Cổng:** toàn bộ test trên qua; một bản backup tự tạo bằng lịch. | Bấm **Create Backup** → thấy tệp ở T1, trạng thái VERIFIED. Sửa 1 byte trong tệp → bấm Verify → FAILED. Sửa tay một dòng ledger → job kiểm tra báo chuỗi gãy. |
| **P2** Object, đích, export (L) | **WP2.1** `ObjectBackupJob`: liệt kê version, chỉ sao chép version mới, kiểm SHA-256, manifest "full view" (thuật toán 20.2). <br> **WP2.2** Đích T2/T3: giao diện `BackupTarget` với các hiện thực `FolderTarget`, `ObjectStoreTarget`, `MediaTarget`; kiểm thử đích (ghi, đọc, thử xóa). <br> **WP2.3** Cổng 3-2-1-1 ở Activate Policy; policy theo version với **e-sign + audit** (đã chốt BR-6/7/8, dùng esign-modal có sẵn). <br> **WP2.4** Export Backup Set và Offline Media Register (`backup_export, offline_media, media_event`). <br> **WP2.5** Frontend: Backup Policy, Storage & Encryption, Retention (hiển thị vĩnh viễn), nút Export. | OQ-02, 03, 04, 19, 20, 21, 22; IQ-01, IQ-02. Âm tính: đích đầy, đích từ chối xóa, gói bị sửa. **Điều kiện bắt đầu:** S2 xong. **Cổng:** test qua; gói Export restore được trên máy sạch. | Tạo backup có object mới → chỉ object mới được chép. Xuất gói ra ổ thử, sửa 1 byte, chạy `verify-chain` → báo lỗi. Thử Activate Policy chỉ với 1 đích → bị chặn kèm lý do. |
| **P3** Restore vào validation, khóa, Super Administrator (L) | **WP3.1** `RestoreWorker`: giải mã, xác minh, restore DB vào DB mới, bổ sung object, bảng ánh xạ (mục 11.4), C1-C13. <br> **WP3.2** V2/V3, Backup Inspection (DB tạm `inspect_{id}`). <br> **WP3.3** `MaintenanceGateFilter` trước `AuthTokenFilter`; `GET /system/maintenance-status`; tệp khóa; session epoch. <br> **WP3.4** `MaintenanceNoticeHost` và `MaintenanceCountdownChip` trong `Header.tsx`; tích hợp tạo System Announcement. <br> **WP3.5** `SuperAdminAuthService`, endpoint đăng nhập riêng, mở rộng `PermissionEvaluationService` nhận chủ thể `SUPER_ADMIN` (phân tích tác động bắt buộc), cột nhãn chủ thể audit. <br> **WP3.6** Restore Execution Console; Restore Requests, Restore Verification Reports nối API. | OQ-05, 15, 16, 23-26, 27-40 (phần validation), PQ-02. Âm tính: đóng trình duyệt giữa chừng, DB điều khiển mất kết nối, token cũ sau hoán đổi. **Cổng:** một lần restore đầy đủ vào validation do người không phải dev thực hiện theo hướng dẫn. | Tạo yêu cầu restore vào validation → thấy hộp thoại đếm ngược, bấm Close → chip đỏ nhấp nháy trên Header → hết giờ bị đăng xuất → Admin thấy thông báo → Console → Thực thi → C1-C13 hiện đạt. Người thường đăng nhập bị chặn. |
| **P4** Restore production có phê duyệt (L) | **WP4.1** Impact Report (`backup_impact_probe`, tính lại sát lúc chạy), đánh giá GMP. <br> **WP4.2** Luồng duyệt: Requester → Approver → Executor → Verifier; `CHECK` phân tách vai ở DB điều khiển và ở service; e-sign. <br> **WP4.3** Hoán đổi tên DB, bản an toàn `PRE_RESTORE`, quay lui. <br> **WP4.4** Restore Approval Queue, Restore History & Evidence, Evidence Pack. | OQ-08, 09, 10, 11, 14, 39. Đồng thời: hai restore cùng lúc, backup trong lúc restore. **Cổng:** hoán đổi và quay lui thử trên môi trường **nhân bản của production** (không phải production thật); DB cũ còn nguyên sau hoán đổi. | Một yêu cầu đi hết vòng: người yêu cầu không tự duyệt được; Impact Report hiện số bản ghi sẽ mất; ký xác nhận; hoán đổi; quay lui về DB cũ. |
| **P5** WAL và PITR (M) | Cấu hình Postgres (`archive_mode`, `archive_timeout`) theo S3; `WalArchiver`; base backup hằng tuần; restore tới thời điểm T. | OQ-17. Âm tính: WAL thiếu một đoạn → restore dừng, báo rõ. **Cổng:** khôi phục đúng tới giây chỉ định. | Ghi dữ liệu, ghi lại giờ, ghi tiếp, restore tới giờ đã ghi → dữ liệu sau giờ đó không có. |
| **P6** Thảm họa (M) | Rebuild Kit (compose, image đã lưu thành tar, script xác minh), DR Plan, tuyên bố DR hai người, diễn tập. | PQ-03. **Cổng:** dựng lại trên máy trống theo Rebuild Kit, đo RTO thật. | Máy mới → làm theo runbook → hệ thống chạy lại, kiểm tra sau restore đạt, RTO đo được ghi vào màn Drills. |
| **P7** Thanh tra và go-live (M) | Inspector (Time-Limited User), cảnh báo đầy đủ, báo cáo sử dụng Super Administrator, vận hành thử, báo cáo validation. | OQ-18, OQ-35 đến OQ-40, PQ-01. **Cổng:** QA phê duyệt báo cáo validation. | Tài khoản Inspector chỉ đọc; xuất Evidence Pack xác minh được; 14 ngày chạy lịch thật không bỏ lỡ. |

### 23.4 Môi trường và an toàn khi thử

**Ba môi trường DEV, TEST, PROD.** Dự án đã tách thành ba môi trường độc lập (`docs/plans/ENVIRONMENT_STRATEGY_SDLC.md`). Trong SDS này, "môi trường validation" chính là **TEST**, "bản thử" là DEV, và toàn bộ nội dung "production" chỉ áp dụng cho **PROD**. Mỗi môi trường có Backup Agent, DB điều khiển, đích backup, khóa và Super Administrator **riêng**; restore luôn diễn ra trong chính môi trường đích. Bucket đích backup mang tên môi trường (`eqms-backup-dev-...`, `eqms-backup-test-...`, `eqms-backup-prod-...`), và quy tắc BR-2 (không thời hạn) chỉ áp dụng cho PROD; DEV và TEST dùng retention ngắn.

| Rủi ro khi thử | Biện pháp |
| --- | --- |
| Test ghi vào bucket khóa vĩnh viễn `eqms-gmp-records` hay `eqms-templates` | Mọi test dùng bucket `eqms-test-{random}` **không khóa, có versioning**. Test cần kiểm khóa dùng **MinIO thử riêng** (container tạm, volume xóa được) với retention 1 ngày. Agent từ chối chạy nếu cấu hình test trỏ vào bucket production (kiểm tra tên bucket). |
| Test restore đè lên DB dev `eqms` | Test restore luôn vào DB `eqms_test_{random}`; code từ chối restore vào tên `eqms` nếu thiếu cờ `ALLOW_PRODUCTION_SWAP`, cờ này chỉ bật trong kịch bản diễn tập có chủ đích. |
| Backend test dùng chung Postgres dev và migrate nó ĐÃ KIỂM TRA: ghi chú từ các lần chạy trước | Test của agent dùng DB điều khiển riêng của test; test backend chỉ thêm test không phụ thuộc DB (unit), hoặc dùng schema tạm. Test song song tránh dùng cùng DB. |
| Test làm hỏng backup thật | Test tamper luôn làm việc trên **bản sao** trong thư mục tạm, không bao giờ trên T1/T3 thật. |
| Test gửi email thật | Dùng Mailhog trong compose; không cấu hình SMTP ngoài khi chạy test. |
| Backup chạy lúc test làm đầy đĩa | Thư mục test có giới hạn dung lượng; dọn tự động sau test. |

### 23.5 Các lớp kiểm thử

| Lớp | Kiểm tra gì | Công cụ / lệnh | Ví dụ |
| --- | --- | --- | --- |
| L1 Unit | Logic thuần, không cần dịch vụ ngoài | JUnit 5, Mockito; `./mvnw -q -o test -Dtest=...` | Nối băm ledger; dựng và ký manifest; đồ thị trạng thái restore; quy tắc phân tách vai; thuật toán tra bí danh; tính lịch bỏ lỡ; danh sách trắng của Maintenance Gate |
| L2 Tích hợp thật | Chạy với Postgres và MinIO thật trong compose, tài nguyên test riêng | JUnit + tài nguyên tạm; tập lệnh dựng/dọn | Backup DB dev ra T1, restore vào DB tạm, so số dòng từng bảng; sao chép object tăng dần giữa hai MinIO; đích từ chối xóa |
| L3 Âm tính / phá hoại | Chứng minh hệ thống phát hiện can thiệp và lỗi | Kịch bản tự động trên bản sao | Sửa 1 byte tệp; sửa manifest; sửa ledger; rút phương tiện giữa chừng; đầy đĩa; mất kết nối DB điều khiển |
| L4 Phân quyền / bảo mật | Ma trận quyền × endpoint, phân tách vai, mạo danh | Test API (MockMvc) cho từng endpoint ở mục 18 | Thiếu quyền → 403; Requester tự duyệt → `RESTORE_SAME_PERSON`; token `SUPER_ADMIN` giả bị từ chối; khi khóa mọi endpoint ngoài danh sách trắng → 503 |
| L5 Đồng thời / lỗi | Hai restore cùng lúc; backup trong restore; agent chết giữa chừng | Test có luồng song song và bơm lỗi | OQ-14, OQ-15 |
| L6 Giao diện | Màn hình đúng dữ liệu, đúng trạng thái, đúng quyền, đúng phản hồi lỗi | Vitest + Testing Library; `npx vitest run src/features/backup-restore` | Nút Thực thi bị vô hiệu khi còn phiên; chip đếm ngược xuất hiện sau khi Close; `prefers-reduced-motion` |
| L7 Diễn tập đầu-cuối | Chuỗi thật: backup → phá hủy môi trường thử → restore → kiểm tra | Tập lệnh `scripts/backup-drill.ps1` sinh báo cáo | Báo cáo ghi thời gian từng bước và C1-C13 |
| L8 Kiểm thử chấp nhận (UAT) | Người không phải dev thực hiện theo kịch bản | Bộ kịch bản từng bước, QA ký | PQ-01 đến PQ-03 |

### 23.6 Bằng chứng bạn nhận sau mỗi giai đoạn

1. **Hồ sơ thay đổi** (mục 23.1) với kết quả GitNexus hoặc ghi chú phân tích thủ công.
2. **Báo cáo test:** số test chạy / đạt / bỏ qua, lệnh để bạn tự chạy lại, kèm danh sách OQ/IQ/PQ đã đạt.
3. **Ma trận truy vết:** bảng yêu cầu của SDS → mã test → kết quả (mục 23.7), cập nhật từng giai đoạn.
4. **Kịch bản demo** (cột cuối bảng 23.3) viết thành các bước bạn tự làm trên màn hình.
5. **Danh sách việc chưa làm và sai khác** so với SDS, trung thực, kể cả điều chỉ được kiểm bằng giả lập.
6. **Hướng dẫn quay lui** của chính thay đổi đó (tắt flag, gỡ container, migration bổ sung).

### 23.7 Truy vết: câu hỏi → mục SDS → test

| # | Câu hỏi | Mục | Test chứng minh |
| --- | --- | --- | --- |
| 1-2 | Dữ liệu backup / restore | 4 | OQ-01, 02, 05, 16, 23 |
| 3 | Tăng dần / toàn bộ | 5 | OQ-01, 02, 17 |
| 4 | Nơi lưu | 6 | OQ-03, 04, IQ-01 |
| 5 | Mở bằng công cụ chuyên dụng | 7 | OQ-19 (giải mã và đọc bằng công cụ chuẩn), OQ-20 |
| 6, 12 | Thanh tra, toàn vẹn | 14, 16 | OQ-12, 13, 18, 37; PQ-01 |
| 7 | Đánh giá tác động | 10 | OQ-08 (Impact Report), OQ-09 |
| 8 | Ghi đè / trùng lặp | 11 | OQ-08, 11, 23, 24, 25 |
| 9 | Xử lý mất dữ liệu | 12 | OQ-16 (R-ONE), OQ-17 (PITR), kịch bản UAT |
| 10 | Review / approve | 9 | OQ-10, 39 |
| 11 | Phục hồi thảm họa | 13 | PQ-03 |
| 13 | Lên lịch | 15 | OQ-15; PQ-01 |
| 14 | Chống can thiệp | 8 | OQ-04, 06, 07, 12, 13, 20 |
| - | Khóa và đăng xuất khi restore | 11.5 | OQ-27 đến OQ-35 |
| - | Super Administrator | 11.6 | OQ-36 đến OQ-40 |

### 23.8 Định nghĩa "xong" cho một giai đoạn

- Mọi test của giai đoạn đạt, gồm test âm tính, đồng thời và lỗi tương ứng.
- Hồ sơ thay đổi hoàn chỉnh và được bạn xem.
- Đã làm thử đúng kịch bản demo trên hệ thống thật (không chỉ chạy test).
- Màn hình liên quan không còn banner "Design preview" nếu đã nối API; màn chưa nối vẫn giữ banner.
- Không có migration nào bị sửa sau khi áp dụng; không có test ghi vào bucket production.
- Tài liệu SDS được cập nhật nếu thực tế khác thiết kế.

**Không dùng dữ liệu GMP thật trước P7.** Từ P1 đến P6 chỉ dùng dữ liệu thử; bucket `eqms-gmp-records` khóa vĩnh viễn nên mọi thứ đưa vào đó không xóa được, và theo BR-2 backup production cũng giữ vĩnh viễn.

### 23.9 Tình trạng triển khai và việc chưa thực hiện

Mục này được cập nhật **sau mỗi lần hoàn thành một phần việc**: ghi rõ cái gì đã chạy thật, cái gì chưa làm được và vì sao. Cập nhật lần cuối: 2026-10-15 (chỉ ghi trạng thái tạm dừng và nguồn báo cáo, xem hai dòng đầu bảng; **nội dung các dòng còn lại được đối chiếu với mã lần cuối ngày 2026-10-10**, và các thay đổi trong commit ngày 2026-10-13 chưa được đối chiếu lại); trước đó 2026-10-10 (lát 4 của WP3.1: phần đọc qua bí danh đã xong; R8, bảng bí danh trong DB tạm, C7, C13 còn lại), sau P2 (đích T2/T3, backup object, policy theo version, Export Backup Set, Offline Media Register, màn Storage & Encryption và Retention).

| Hạng mục | Trạng thái | Bằng chứng | Chưa thực hiện được / giới hạn |
| --- | --- | --- | --- |
| **TẠM DỪNG Backup & Restore (2026-10-15)** | TẠM DỪNG THEO YÊU CẦU CỦA CHỦ DỰ ÁN | Chủ dự án (2026-10-15): dừng Report, Backup và Restore để quay lại Document Control và chuẩn bị Training Management. | Không làm tiếp Backup & Restore nếu chưa có yêu cầu mới. Mọi việc còn lại ghi ở các dòng bên dưới và ở mục 24; không có việc nào được bắt đầu dở trong phiên 2026-10-15. Phần chưa đối chiếu: commit 2026-10-13 (`5131bbb`, `31ac7f3`) chưa được so lại với SDS này. |
| Backup & Restore làm nguồn dữ liệu cho Report (REPORT-PLATFORM-2026-10-15, giai đoạn 3) | CHƯA BẮT ĐẦU; ĐÃ GHI THIẾT KẾ | `eqms-backend/docs/validation/REPORT_PLATFORM_2026_10_15_DESIGN.md`; mục 24.3; SDS-RP-001 mục 5.7, 5.8, 20. | Chủ dự án trả lời "chưa biết" khi được hỏi dữ liệu nằm ở đâu và cột nào được hiện. Chưa có `ReportMetadataProvider` cho backup. Chưa chọn bảng, cột, quyền và phạm vi. |
| P0 Spike | XONG | `docs/plans/BACKUP_SPIKES.md` | S3 (WAL) chỉ đo chức năng, chưa đo dung lượng trên tải thật. |
| P1 Nền tảng (DB điều khiển, sổ cái, backup DB, V1, API, 4 màn hình) | XONG trên DEV | Hồ sơ P1; e2e 24/24 | Cảnh báo chưa có thao tác xác nhận đã xử lý (3 cảnh báo backup lỗi cũ vẫn mở). Backup chưa phải bản ghi GMP. |
| **P3** (một phần) Restore thử vào DB tạm, tiến trình tách riêng | XONG trên DEV (phần kiểm tra, chưa phải restore production) | Agent: `RestoreRehearsalService`, worker riêng (`AGENT_ROLE=RESTORE_WORKER`, `docker-compose.backup-restore.yml`) là tiến trình duy nhất có khóa riêng và vai trò `eqms_restore` (chỉ tạo DB, không sở hữu DB eQMS). API không thấy thư mục khóa (đã kiểm). Chạy thật: `scripts/backup/p3-rehearsal-e2e.sh` 18/18; rehearsal `RH-20261009-0002`: giải mã DB và restore 134 bảng, 999 large object, 250 khóa ngoại, 1.310 tài liệu giải mã khớp SHA-256; DB tạm bị xóa; DB production không đổi (10.279 tài liệu trước và sau). Kiểm tra đã làm: C1, C2, C3, C4 (phần có thể chứng minh), C6, C6_INDEX, chữ ký manifest, khóa giải mã. Test: agent 124 (10 mới: thành công, thất bại có mã, khóa thiếu, sai số dòng, sai phiên bản schema, tài liệu bị sửa, hàng đợi tách theo tiến trình); backend 5 mới; frontend 59 backup-restore đạt (nút Test Restore và mục Restore Tests trên Backup Details). | Chỉ là **kiểm tra có thể restore**, chưa restore vào validation hay production. Chưa có: **C5** (kiểm lại chữ ký điện tử), **C7** (object mồ côi), **C8** (người dùng và quyền), **C9** (scheduler), **C10**, **C11** (ứng dụng khởi động, mở tài liệu mẫu), **C12**, **C13** (bí danh phiên bản); tất cả C-check cần ứng dụng hoặc MinIO khôi phục cạnh DB. **C4** chỉ kiểm được "không có dòng mới hơn bản backup và trigger bất biến còn đó", không chứng minh được liên tục chuỗi, vì bảng audit không có số thứ tự hay băm nối. Chưa có lịch hằng tuần (V2) và hằng tháng (V3); chưa có Restore Verification Report để ký (R10); màn **Restore Verification Reports** vẫn là dữ liệu mẫu. Chưa có luồng **R0–R12**: yêu cầu restore, Impact Report, duyệt QA, bảo trì, hoán đổi DB, rà soát. Chưa có **Register Imported Set**. Khóa riêng DEV nằm trên cùng PC (TEST và PROD phải do người được chỉ định mount tạm, theo mục 8.4). Khóa giải mã chưa được nối vào luồng restore; cơ chế hai người giữ khóa đã bỏ (BR-8, mục 8.4). Quyền `backup.restore.test` chỉ có trong quyền System Administration; các tài khoản test DCO/Author/Reviewer/Approver hiện không có quyền backup nào (đã kiểm trong DB). |
| **P3** — trạng thái sau lát 19 của P3, lát 1 và lát 2 của WP3.1 | ĐANG LÀM | Lát 2 đến lát 19 (bảng dưới), lát 1 và lát 2 của WP3.1 (dòng riêng bên dưới). Test: agent 146/146; backend `MaintenanceGateTest` 7/7 và `BackupRestoreRequestControllerTest` 10/10; frontend `backup-restore` 74/74 (lát 1, không đổi ở lát 2). DEV (build24): V10 và V11 đã áp dụng; ba dịch vụ agent, worker và backend healthy. Chưa kiểm trực tiếp trên DEV việc vào cửa sổ (không khóa hệ thống thật trên DEV). | **Việc còn lại theo SDS:** (1) WP3.1 lát 2 còn lại: endpoint backend và nút vào cửa sổ (chờ quyết định quyền và Maintenance Pass); kiểm trực tiếp trên DEV trong khung giờ thử; (2) WP3.1 lát 2 phần R5: chạy restore khi đã vào cửa sổ, và mở lại hệ thống sau khi chạy; lát 3: restore DB vào `eqms_test_{id}` và C1–C4; lát 4: bổ sung object qua bảng bí danh và C5–C13; (3) WP3.2 V2/V3 và Backup Inspection; (4) nối API cho Restore History & Evidence và Restore Verification Reports; (5) **cổng P3**: một lần restore đầy đủ vào validation do người không phải dev thực hiện theo hướng dẫn (L8). **Chưa làm, cần người phụ trách:** R2 (đánh giá GMP) và R10 (QA Verifier); R-ONE và Disaster recovery chưa có trong form; email thông báo duyệt; chữ ký đầy đủ chưa hiện trên màn chi tiết. **Quyết định còn mở:** người khai báo tên Super Administrator và mở khóa (11.6); sáu yêu cầu ghi CANCELLED trước khi gỡ bước hủy; BR-12 (hạn nộp báo cáo sau sự cố DR, chưa đặt); cơ chế xác nhận khi vào cửa sổ restore (Maintenance Pass hay chữ ký điện tử). **Đã quyết định (2026-10-09):** người vào cửa sổ restore là `admin` (có `backup.restore.execute`); `approver.test1` chỉ duyệt yêu cầu, không vào cửa sổ. |
| P3 / WP3.1 lát 1: Lập lịch cửa sổ bảo trì và kiểm tra trước khi chạy (R4) | XONG trên DEV (không đổi dữ liệu) | Agent: `V10__restore_execution_schedule.sql` (`restore_execution`: một lịch đang mở cho mỗi yêu cầu; `restore_execution_event` append-only); `RestoreExecutionService`: kiểm tra trước khi chạy (REQUEST_APPROVED, APPROVAL_SIGNED, TWO_PEOPLE, BACKUP_COMPLETED, BACKUP_VERIFIED, NO_OPEN_SCHEDULE) và lập lịch (người lập lịch không được là người duyệt; cửa sổ phải sau hiện tại; không lập trùng cho cùng yêu cầu). Backend: `GET /backup-restore/restores/{id}/execution` (quyền xem), `POST /backup-restore/restores/{id}/schedule` (quyền `backup.restore.execute`; ghi nhật ký). Frontend: màn `/backup-restore/restores/{id}/execution` (Restore Execution Console): kiểm tra, khối "chưa kiểm được", lập lịch, nút Execute tắt. Test: agent 145/145 (người duyệt không lập lịch được, cửa sổ quá khứ bị chặn, lịch thứ hai bị chặn); backend 10/10; frontend 74/74. Kiểm trên DEV: V10 đã áp dụng; `RS-20261009-0037` và `RS-20261009-0041` trả về đủ kiểm tra đạt, chưa có lịch. Chưa tạo lịch thật trên DEV vì bảng lịch và nhật ký là append-only. | **Chưa kiểm:** khóa giải mã trên máy thực thi; cửa sổ bảo trì (NOTICE/DRAINED/LOCKED) khi lập lịch; đo lại báo cáo tác động lúc chạy (M4); không có nút chạy. Lập lịch không thay đổi dữ liệu nào. |
| P3 / WP3.1 lát 2: Trạng thái cửa sổ restore (DRAINED → LOCKED_RESTORING) | XONG trong agent, backend và màn hình (test); CHƯA kiểm trực tiếp khi hệ thống đang khóa | Agent: trạng thái khóa đổi tên từ `LOCKED` thành `LOCKED_RESTORING` theo sơ đồ 11.5.1 (V11: đổi ràng buộc và dòng trạng thái; nhật ký `maintenance_event` append-only giữ chữ cũ là đúng vì ghi lại tại thời điểm đó). `RestoreExecutionService.enterWindow`: chỉ cho vào khi (a) yêu cầu đã có lịch đang mở, (b) đã đến giờ cửa sổ, (c) hệ thống đang DRAINED và thông báo là của chính yêu cầu này, (d) người vào cửa sổ xác nhận không còn người dùng. Ghi sự kiện `WINDOW_LOCKED` và nhật ký `MAINTENANCE_LOCKED`. Endpoint nội bộ `POST /internal/restores/{id}/enter-window`. Backend: cổng bảo trì coi mọi trạng thái bắt đầu bằng LOCKED là khóa (trạng thái công khai vẫn là "LOCKED"). Test: agent 146/146 gồm `theRestoreWindowLocksTheSystemOnlyWhenTheWindowHasComeAndTheNoticeIsForThisRequest` (không có lịch, chưa đến giờ, thông báo của yêu cầu khác, thiếu xác nhận không đổi gì, khóa thành công, gọi lại bị chặn, chuỗi nhật ký còn hợp lệ); `MaintenanceGateTest` 7/7; `BackupRestoreRequestControllerTest` 10/10. | **Đã làm thêm (2026-10-09):** endpoint backend `POST /backup-restore/restores/{id}/enter-window` (quyền `backup.restore.execute`, ghi nhật ký `RESTORE_WINDOW_LOCKED` khi thành công) và khối "Enter Restore Window" trên Restore Execution Console (chỉ bật khi đã có lịch, đã đến giờ và đã xác nhận không còn người dùng). Test: `BackupRestoreRequestControllerTest` 12/12; frontend `backup-restore` 76/76. DEV (build26): đã triển khai; gọi thử trên yêu cầu chưa có lịch trả về 409 và không đổi gì. **Chưa làm:** chạy R5 trở đi (hệ thống giữ khóa đến khi mở lại bằng thao tác mở khóa của quản trị); kiểm trực tiếp trên DEV: chưa khóa hệ thống thật trên DEV, và lệnh thăm dò endpoint trên agent bị từ chối bởi quyền truy cập nên không thực hiện. Ràng buộc còn lại: trạng thái lúc lập lịch không được kiểm (xem dòng lát 1). |
| P3 / WP3.1 lát 2 (tiếp): Đăng xuất khi vào cửa sổ và vai trò người duyệt | XONG trong backend (test); chờ triển khai: bước vào cửa sổ và chạy qua Maintenance Pass của Super Administrator | Đăng xuất: khi DRAINED và khi mọi trạng thái LOCKED, bộ đăng xuất (`MaintenanceSessionRevoker`) đánh dấu mọi phiên là đã thu hồi, và cổng bảo trì chặn đăng nhập. Sửa lỗi: bộ đăng xuất so sánh với chuỗi `LOCKED` nên sẽ bỏ qua `LOCKED_RESTORING`; đã đổi thành kiểm tra tiền tố LOCKED. Test: `MaintenanceSessionRevokerTest` 5/5, `MaintenanceGateTest` 7/7. Vai trò (quyết định 2026-10-09): `approver.test1` duyệt yêu cầu, và bị đăng xuất như mọi người khi hệ thống DRAINED; từ đó không đăng nhập được cho đến khi mở lại. Mọi bước sau duyệt (lập lịch, vào cửa sổ, chạy) do `admin` thực hiện. | **Quyết định 2026-10-09 (phương án b):** Super Administrator (tài khoản bí mật, không hiển thị trong hệ thống, có toàn quyền) thực thi các bước trong cửa sổ bằng Maintenance Pass (phạm vi RESTORE:{requestId}). **Còn lại phải làm:** endpoint bước vào cửa sổ và các bước chạy phải nhận Maintenance Pass thay cho phiên eQMS (hiện các endpoint restore chỉ nhận phiên eQMS). Khoảng trống cũ: đặc tả 11.5 yêu cầu người vận hành đăng nhập trong lúc khóa để nhận Maintenance Pass (phạm vi RESTORE:{requestId}). Code hiện chỉ cấp pass cho Super Administrator (tài khoản ngoài bảng người dùng, BR-17). Vì cổng bảo trì chặn cả quản trị viên eQMS, `admin` chưa thể thao tác màn hình restore trong lúc khóa. Cần chọn: (a) `admin` đăng nhập qua luồng bảo trì và nhận pass cho đúng yêu cầu đó; hoặc (b) Super Administrator thực hiện các bước trong cửa sổ. Chưa làm: cả hai phương án đều chưa được code. |
| P3 / Ngoại lệ bảo trì: người có quyền bypass (admin) làm việc trong lúc DRAINED/LOCKED (SDS 11.5.3; quyết định của người phụ trách 2026-10-09, phương án "đầy đủ") | XONG trong code và test; CHƯA kiểm trực tiếp trên DEV | Cổng khóa của backup agent (`MaintenanceGateFilter`) cho qua yêu cầu có JWT hợp lệ mang quyền `security.maintenance.bypass` (đọc từ token, không cần DB); cho qua `/auth/login`. `AuthService.login` từ chối mọi người không có quyền bypass khi hệ thống khóa, trước khi tạo phiên (lỗi `MAINTENANCE_MODE`). `MaintenanceSessionRevoker` không thu hồi phiên của người có quyền bypass. Giao diện: `MaintenanceNoticeHost` không tự đăng xuất người có quyền bypass. Test: `MaintenanceGateTest` 8/8 (gồm người có bypass vs người khác, token không xác thực, đăng nhập); `MaintenanceSessionRevokerTest` 6/6 (gồm quản trị viên giữ phiên); `AuthSignatureCredentialsTest` 11/11; `MaintenanceAndSuperAdminTest`; `BackupRestoreRequestControllerTest` 10/10; frontend `features/maintenance` 17/17; `tsc` chỉ còn 2 lỗi có sẵn ở `ReportLists.test.tsx`. DEV (build25): backend healthy; đăng nhập admin trong trạng thái bình thường vẫn được. | **Ràng buộc và rủi ro:** (1) quyền đọc từ JWT: nếu quyền bypass bị thu hồi, người đó vẫn qua cổng cho đến khi token hết hạn; (2) mọi người có quyền `security.maintenance.bypass` (hiện gồm nhóm quản trị) đều được vào, không riêng `admin`; (3) chưa có test cho `MaintenanceNoticeHost` trên giao diện; (4) **chưa kiểm trực tiếp** trên DEV bằng một cửa sổ khóa thật (sẽ khóa mọi người dùng; cần làm trong khung giờ thử đã thông báo). **Lỗi có sẵn, không do thay đổi này:** 34 lớp test tích hợp (Spring) không khởi động được vì Flyway báo DEV đã áp dụng V558 và V559 nhưng hai file này không có trong mã nguồn; đây là lệch môi trường DEV, cần rà soát riêng. |
| **Danh sách việc chưa thực hiện được (cập nhật 2026-10-09)** | CHƯA XONG | Ghi nhận các việc đã được yêu cầu nhưng chưa thực hiện được, và lý do. | **1. Thử khóa trên DEV (ngoại lệ bảo trì, mục 11.5.3):** chưa thực hiện. Lý do: bật thông báo và khóa đòi Maintenance Pass từ tài khoản Super Admin, người phụ trách không đồng ý để trợ lý giữ mật khẩu này; khung giờ thử (18:00 hay 06:00 sáng mai) chưa xác nhận. Kiểm tra cần chạy: `admin` đăng nhập và gọi được API backup; `dco.test1` và `approver.test1` bị chặn với MAINTENANCE_MODE và bị đăng xuất; hệ thống được mở lại sau kiểm tra. Script chỉ đọc: `scratchpad/check-window.sh`. <br> **2. Kiểm tra giao diện cho thông báo đăng xuất (MaintenanceNoticeHost):** chưa có test tự động. <br> **3. Quyền bypass dựa trên tất cả người có `security.maintenance.bypass`:** cần rà soát danh sách trên DEV; quyền bị thu hồi vẫn có hiệu lực đến khi token hết hạn. <br> **4. Bộ test backend tích hợp (34 lớp):** không khởi động được vì DEV đã áp dụng V558 và V559 nhưng hai file không có trong mã nguồn. Cần rà soát riêng, không thuộc P3. <br> **5. Bước chạy R5 trở đi và mở lại hệ thống sau khi chạy:** chưa làm. <br> **6. Cơ chế xác nhận khi vào cửa sổ (chữ ký điện tử hay không):** chưa quyết định; bước vào cửa sổ hiện chỉ cần quyền `backup.restore.execute`. <br> **7. Các việc P3 đã nêu trước đó:** R2 (đánh giá GMP) và R10 (QA Verifier); R-ONE và Disaster recovery trong form; email thông báo duyệt; chữ ký đầy đủ trên màn chi tiết; người khai báo Super Administrator và mở khóa (11.6); sáu yêu cầu CANCELLED cũ; BR-12. |
| P3 / WP3.1 lát 3: Khôi phục thử vào `eqms_test_{id}` trong cửa sổ (SDS 14.1, 11.3) | XONG trong agent, backend và màn hình (test); CHƯA kiểm trực tiếp trong cửa sổ khóa thật | Agent: `RestoreExecutionService.startTestRestore` chỉ chạy khi có lịch đang mở, hệ thống đang LOCKED_RESTORING đúng cho yêu cầu này, và chưa có khôi phục thử nào trong cửa sổ này. Việc khôi phục đi qua hàng đợi diễn tập có sẵn: tiến trình restore worker (có khóa giải mã) khôi phục backup vào DB tạm và chạy các kiểm tra của diễn tập (MANIFEST_SIGNATURE, DECRYPTION_KEY, RESTORE_DATABASE, C1–C4, C6, C6_INDEX). Production không bị đụng tới. Endpoint nội bộ `POST /internal/restores/{id}/test-restore`; backend `POST /backup-restore/restores/{id}/test-restore` (quyền `backup.restore.execute`, ghi nhật ký `RESTORE_TEST_STARTED`); màn Restore Execution Console có nút "Start Test Restore". Test: agent 147/147 (gồm: chưa khóa bị từ chối, xếp hàng một lần, lần hai bị từ chối, diễn tập được gọi đúng backup); backend `BackupRestoreRequestControllerTest` 13/13; frontend `backup-restore` 77/77; tsc không có lỗi mới. DEV (build27): các dịch vụ healthy; gọi thử trên yêu cầu chưa có lịch trả về 409, không đổi gì. | **Chưa làm:** chạy thử trực tiếp trong một cửa sổ khóa thật (cần bước Super Admin trên trình duyệt; xem danh sách việc chưa làm); kết quả khôi phục thử chỉ xem được ở bản ghi diễn tập, chưa hiển thị trên màn Execution Console; hai yêu cầu cùng lúc có thể cùng xếp hàng (chưa khóa theo hàng); lát 4 (bổ sung object qua bảng bí danh và C5–C13) chưa làm. **Ghi chú:** việc "khóa giải mã trên máy thực thi" trước đây là chưa kiểm, nay được kiểm bởi kiểm tra DECRYPTION_KEY của diễn tập. |
| P3 / Màn Restore Execution Console hiển thị kết quả khôi phục thử | XONG trên DEV (test); chưa xem trong cửa sổ khóa thật | Trả về trong trạng thái kiểm tra của yêu cầu: `systemState` (trạng thái hệ thống), `systemRequestId` (chỉ có khi hệ thống đang LOCKED_RESTORING cho yêu cầu đó), `testRestore` (khôi phục thử mới nhất trong cửa sổ, lấy từ bản ghi diễn tập: trạng thái, người yêu cầu, lỗi, và từng kiểm tra). Màn hình đọc các trạng thái này từ máy chủ, nên đúng sau khi tải lại trang: khối "Enter the window" và nút "Start Test Restore" lấy từ server; khối "Test restore" hiển thị trạng thái (QUEUED/RUNNING/PASSED/FAILED), từng kiểm tra Pass/Fail, và tự làm mới mỗi 10 giây khi đang xếp hàng hoặc đang chạy. Test: agent 147/147 (RestoreRequestTest 12/12 gồm kết quả khôi phục thử trong kiểm tra); frontend `backup-restore` 78/78 (gồm hiển thị kết quả PASSED và từng kiểm tra C1); tsc không có lỗi mới. DEV (build28–29): agent và worker healthy; trạng thái trả về NORMAL với systemRequestId null. | **Chưa làm:** kiểm tra trực tiếp hiển thị khi hệ thống đang khóa thật (cần bước Super Admin trên trình duyệt); xem các mục chưa làm ở danh sách 1.30. |
| P3 / WP3.1 lát 4: Bổ sung object qua bảng bí danh; kiểm tra C7 và C13 (mục 11.4.2, 14.3) | XONG trong agent, backend và DEV (RH-20261009-0007: PASSED) | **Đã làm:** (1) Bảng bí danh `object_version_alias`: V569 và V570 (thêm `current_bucket`; bản sao có thể nằm ở bucket khác). (2) Đường đọc backend: chỉ khi MinIO báo `NoSuchVersion` mới tra bảng bí danh; bytes băm SHA-256 trước khi trả về; test 3/3. (3) R8 trong agent: mỗi phiên bản trong backup được giải mã, kiểm SHA-256 với bản ghi, ghi vào bucket `eqms-test-{rehearsal}` (có versioning) và ghi một dòng bí danh vào DB tạm; bucket được xóa sau diễn tập. Tài khoản MinIO riêng của worker (`eqms-test-worker`) chỉ có quyền trên `eqms-test-*`; secret nằm trong `.env` (đã gitignore). (4) C13: quét mọi cột văn bản để tìm tham chiếu `minio://`; tham chiếu có phiên bản phải có đúng một bí danh; tham chiếu không có phiên bản chỉ đạt khi backup có đúng một phiên bản của khóa đó; đọc qua bí danh và so SHA-256; số bí danh bằng số object đã ghi. (5) C7: báo cáo object không có bản ghi nào tham chiếu (khóa xuất hiện nguyên văn trong cột văn bản hoặc có URI), có nhãn ORPHAN. <br> **Kết quả trên DEV (2026-10-09, lượt chạy RH-20261009-0007):** 1.310 phiên bản khôi phục và băm đúng; C13 đạt (569 tham chiếu, 1.310 bí danh cho 1.310 object); C7 báo 530 orphan trên 1.310 object (báo cáo, không phải cổng đạt/không đạt; nguyên nhân chưa phân tích: các object này không có bản ghi nào trong bản dump của backup). <br> **Test:** agent đầy đủ đạt; `RestoreObjectRestoreTest` 9/9; `RestoreRehearsalTest` 10/10; backend `MinioObjectAliasVerificationTest` 3/3 và `BackupRestoreRequestControllerTest` 13/13. <br> **Chuyển sang lát 5:** C5 (kiểm lại chữ ký điện tử), C8 (người dùng và quyền), C9 (scheduler tắt), C10 (job dở dang), C11 (sức khỏe ứng dụng trên DB tạm), C12 (dịch vụ ngoài). Các mục này cần logic ứng dụng hoặc chạy ứng dụng trên DB tạm; chưa làm. | **Phân tích orphan (2026-10-10, chỉ đọc):** phần lớn orphan nằm dưới `templates/publishing` (505 blob của backup) và `controlled-copies/…/evidence`. CSDL production chỉ có khoảng 27 tham chiếu tới đường dẫn template xuất bản (cover, header, footer); các đầu ra xuất bản khác không được ghi lại trong bản ghi nào. Kết luận sơ bộ: đầu ra không được ghi nhận, chưa phải lỗi tham chiếu. **Cần người phụ trách quyết định:** cách xử lý các đầu ra này (giữ, gắn nhãn, hay dọn) theo SDS 14.3 (C7 chỉ yêu cầu báo cáo). |
| **Rà soát việc tồn đọng (2026-10-10)** | ĐÃ XỬ LÝ MỘT PHẦN; CÒN CHẶN | **1. Test MinIO thật (`MinioStorageLiveTest`):** đã xử lý. Test không còn chạy trên DEV. Lý do: kiểm tra cấu hình bucket records (versioning, COMPLIANCE) và ghi vào bucket templates là vi phạm quy tắc SDS 14.x (test không được ghi vào bucket khóa hoặc templates). Test chỉ chạy khi có MinIO tạm qua `-Deqms.tmpMinio.endpoint`; trên DEV hiện bị bỏ qua (Skipped 1/1). Cần dựng MinIO tạm (việc còn lại). Sửa lại ghi chú trước đó: test không ghi vào `eqms-gmp-records` mà ghi vào templates và thử xóa một object khóa. <br> **2. Test giao diện cho thông báo đăng xuất:** đã xử lý. `MaintenanceNoticeHost` đăng xuất người không có quyền bypass khi khóa, và giữ người có quyền bypass. Frontend maintenance 19/19. <br> **3. Ai đang có quyền `security.maintenance.bypass` trên DEV (chỉ đọc):** `admin` và `sys.admin2` (cùng nhóm System Administration). `approver.test1` và `dco.test1` không có. Cần người phụ trách xác nhận `sys.admin2` có được phép hay không. <br> **4. Lát 4, R8, C7, C13:** CHẶN. Restore worker không có cấu hình MinIO, không có thông tin đăng nhập, và không ghi được vào bucket test. Để R8 ghi được, cần một tài khoản MinIO riêng cho worker, chỉ có quyền trên `eqms-test-*`. Tạo tài khoản và chính sách MinIO là thay đổi quyền truy cập trên hạ tầng, cần duyệt trước khi làm. <br> **5. Các bộ test tích hợp 34 lớp lỗi (V558, V559):** chưa xử lý. Lỗi nằm ở lịch sử migration của DEV (hai bản ghi đã áp dụng không có file trong mã nguồn). Sửa lịch sử Flyway trên DEV cần người phụ trách cơ sở dữ liệu quyết định. <br> **6. Kiểm tra bố cục điện thoại của các thay đổi UI gần đây:** chưa làm; cần trình duyệt có chế độ màn hình hẹp. <br> **7. Lần khóa thử trực tiếp trên DEV (kiểm tra admin, dco.test1, approver.test1, đăng xuất, mở lại):** chưa làm; cần bước Super Admin trên trình duyệt và khung giờ. <br> **8. Các mục quyết định cũ (Super Administrator, sáu yêu cầu CANCELLED, R2, R10, BR-12, RestoreDetailDrawer):** vẫn chờ người phụ trách. |
| P3 / WP3.1 lát 5: Kiểm tra C5, C8–C12 trên bản khôi phục (SDS 14.3) | XONG TRONG CODE VÀ DEV; C5 KHÔNG ĐẠT DO DỮ LIỆU; C11 CHƯA LÀM | **Đã làm:** <br> C5 (`RestoreObjectRestore.signatures`): mọi revision hiệu lực phải có chữ ký; tài liệu của revision đọc qua bí danh phải khớp checksum đã ký và `source_file_checksum`. <br> C8 (`RestoreStateChecks.users`): có tài khoản đang hoạt động và có gán hồ sơ quyền. Giới hạn: không kiểm được việc quản trị viên đăng nhập (cần ứng dụng đang chạy). <br> C9 (`RestoreStateChecks.schedulers`): tắt mọi lịch báo cáo đang bật *trên bản khôi phục tạm* rồi kiểm tra không còn lịch nào bật (không đụng production). <br> C10 (`RestoreStateChecks.jobs`): không còn job chưa kết thúc trong 4 bảng job đã biết; nếu còn thì báo "cần rà soát" và không đạt (không tự chuyển trạng thái). <br> C12 (`RestoreStateChecks.dependencies`): cảnh báo, không bắt buộc: kiểm kết nối TCP tới minio:9000, clamav:3310, mailhog:1025, onlyoffice:80. <br> **Kết quả trên DEV, diễn tập RH-20261009-0008: FAILED** (đúng quy tắc: một kiểm tra bắt buộc không đạt thì diễn tập không đạt): <br> - C5 KHÔNG ĐẠT: 173 revision hiệu lực trong bản khôi phục; 165 không có chữ ký, và 8 không có phiên bản lưu trữ (theo CSDL production hiện tại: 164 không có chữ ký, 8 không có phiên bản, 16 chữ ký có checksum khác `source_file_checksum`). Đây là dữ liệu thật, không phải lỗi kiểm tra. <br> - C8 đạt (442 tài khoản hoạt động, 46 gán hồ sơ quyền); C9 đạt (0 lịch bật); C10 đạt (không có job đang chạy); C13 và C7 như trước. <br> - C12 cảnh báo: onlyoffice:80 không truy cập được từ worker (không làm diễn tập thất bại). <br> **Test:** agent đầy đủ đạt, gồm `RestoreStateChecksTest` 4/4 và C5 trong `RestoreObjectRestoreTest` (chưa ký, ký đúng, ký sai). <br> **Chưa làm:** C11 (sức khỏe ứng dụng trên bản khôi phục): cần chạy ứng dụng trỏ vào DB tạm, worker không làm được; đây là giai đoạn riêng. | **Kiểm tra giả thuyết dữ liệu kiểm thử (2026-10-10, chỉ đọc):** trong 164 revision hiệu lực không có chữ ký, 76 có tên giống dữ liệu kiểm thử tự động (ví dụ "Already Has Revision Test", "Legacy Batch Full Flow SOP", "…N=1…"); 88 còn lại chưa xác định (ví dụ "Operating the production balance", "rev3.docx", "only.docx"). Chỉ 9 revision hiệu lực có chữ ký. Chưa xác nhận được là dữ liệu kiểm thử; không sửa hay xóa dữ liệu nào. **Cần người phụ trách quyết định:** xác nhận từng nhóm là dữ liệu thật hay kiểm thử; nếu là kiểm thử thì cách đánh dấu để C5 chỉ áp dụng cho dữ liệu thật; xử lý 164–165 revision hiệu lực không có chữ ký và 8 revision không có phiên bản lưu trữ (nhập liệu lịch sử, hay lỗi quy trình ký); xác nhận 16 chữ ký có checksum khác; cách chạy C11 (môi trường ứng dụng dành riêng cho bản khôi phục). |
| P3 / WP3.6: Restore Verification Reports và Restore History & Evidence nối API thật (thay dữ liệu mẫu) | XONG trên DEV (test 78/78); phần Evidence Pack còn lại | **Verification Reports:** đọc danh sách diễn tập (`/backup-restore/rehearsals`, 50 bản gần nhất) với kết quả, số kiểm tra và số lỗi; chọn một dòng để xem từng kiểm tra (Pass, Fail, Warning) và chi tiết lỗi (`/rehearsals/{id}`). **Restore History:** đọc các yêu cầu restore đã kết thúc (`/backup-restore/restores?status=REJECTED`) với người yêu cầu, quyết định và lý do; bấm để mở chi tiết yêu cầu. Kiểm tra trên DEV: cả hai API trả về dữ liệu thật. Test: frontend `backup-restore` 78/78; `tsc` không có lỗi mới. | **Còn lại:** (1) Restore History chỉ có yêu cầu bị từ chối, vì chưa có bước chạy restore; yêu cầu đã hoàn thành sẽ xuất hiện khi bước chạy được xây; (2) Evidence Pack có ký số và chuỗi băm ledger (mục 16) chưa làm; (3) Verification Reports chỉ hiện 50 bản gần nhất, chưa phân trang từ server; (4) WP3.2 (V2/V3, Backup Inspection) chưa bắt đầu. |
| **KẾ HOẠCH THỰC HIỆN TOÀN BỘ SDS (cập nhật 2026-10-10)** | ĐANG THỰC HIỆN THEO LÁT | Phạm vi còn lại rất lớn (WAL và base backup, lịch V2/V3/V4 đầy đủ, Backup Inspection, DR từ máy trống, cổng P3, P4–P7). Thực hiện theo lát, mỗi lát có test và cập nhật SDS: <br> **Lát A (XONG trên DEV, 2026-10-10):** V2 hằng tuần (mục 14.1 bảng lịch): worker diễn tập bản backup hợp lệ mới nhất mỗi thứ Hai 05:00 (Asia/Ho_Chi_Minh); kết quả ghi vào `backup_verification` với tầng V2 (VERIFIED/FAILED); nếu lần trước còn chờ hoặc đang chạy thì bỏ qua và ghi `SKIPPED_OVERLAP`. <br> **Lát B:** bù lịch bị lỡ (MISSED, một lần, cảnh báo); cảnh báo "chưa đủ V2/V3 trong thời hạn" trên Backup Status Overview. <br> **Lát C:** V3 hằng tháng: khởi động ứng dụng trên bản khôi phục (cần môi trường ứng dụng riêng, xem câu hỏi bên dưới). <br> **Lát D:** Backup Inspection (chỉ đọc, DB `inspect_{id}`, tự hủy). <br> **Lát E:** WAL và base backup PostgreSQL (cần cấu hình archive trên Postgres DEV). <br> **Lát F:** DR từ máy trống và Disaster Recovery Drills; Evidence Pack có ký số và chuỗi băm ledger. <br> **Cổng P3:** lần khôi phục đầy đủ vào validation do người không phải dev thực hiện (cần người đó). <br> **Quyết định tạm thời (người phụ trách ủy quyền 2026-10-10, cần xác nhận lại):** (1) V3 và Backup Inspection dùng container ứng dụng riêng, chỉ đọc, trỏ vào DB tạm và bucket test; (2) WAL và base backup: bật archive trên Postgres DEV, chấp nhận khởi động lại CSDL DEV; (3) DR từ máy trống dùng container trống trên DEV; (4) người thực hiện cổng P3: CHƯA CHỈ ĐỊNH, cần người phụ trách ghi tên (không phải dev). **Câu hỏi cũ (trước khi ủy quyền):** (1) V3 và Backup Inspection cần một bản ứng dụng chỉ đọc trỏ vào DB tạm: dùng container riêng với DB tạm và bucket test, đúng không? (2) WAL/base backup cần đổi cấu hình PostgreSQL DEV (archive_mode) và khởi động lại Postgres: có được phép không? (3) DR "máy trống": trên DEV dùng container trống có được chấp nhận không? (4) Người thực hiện cổng P3 là ai? | Trạng thái: lát A xong (lịch thật vào 05:00 thứ Hai 12/10/2026; đã chạy tay một lần: RH-20261009-0010 PASSED, ghi V2 VERIFIED). Chờ trả lời (1)–(4) cho các lát C–F. Lát B đang làm tiếp. |
| P3 / WP3.2 lát B: bù lịch bị lỡ và cảnh báo quá hạn (14.1) | XONG trên DEV (test 12/12) | Worker, mỗi ngày 06:00 (Asia/Ho_Chi_Minh): nếu không có kiểm tra V2 nào được yêu cầu trong 7 ngày gần nhất thì ghi sự kiện `MISSED`, tạo cảnh báo `BACKUP_V2_MISSED` và chạy bù đúng một lần. Nếu không có kết quả V2 VERIFIED trong 8 ngày thì tạo cảnh báo `BACKUP_V2_OVERDUE`. Test: bù lịch chạy một lần, không lặp lại mỗi ngày. | Cảnh báo hiện trong bảng `backup_alert`; chưa hiện trên màn trang tổng quan sao lưu (cần nối giao diện). |
| **DEVIATION DEV-2026-10-10-01: truy vết chữ ký trong audit** | MỞ; CHỜ ĐIỀU TRA | **Mô tả:** trong luồng revision, audit ghi mã token chữ ký đã dùng (`used_signature_tokens.token_id`), không ghi khóa bản ghi `electronic_signatures`; không có liên kết trực tiếp giữa audit và bản ghi chữ ký. Khoảng 145–167 mã chữ ký trong audit (20/6–17/8/2026) không khớp token hay bản ghi nào. Nhóm revision hiệu lực không có bản ghi chữ ký (164 cái) được tạo phần lớn bằng luồng nhập hàng loạt, một phần là dữ liệu kiểm thử. <br> **Đã kiểm tra:** không có đoạn mã nào xóa chữ ký; 2.840 mã khớp token đã dùng và 1.081 mã khớp bản ghi chữ ký. Không sửa dữ liệu nào. <br> **Tác động GMP:** truy vết từ bản ghi audit đến chữ ký không luôn khả thi cho giai đoạn trước 21/8/2026 (bảng token chưa có dữ liệu). <br> **Hành động đề xuất:** (a) người phụ trách QA xác nhận nhóm dữ liệu kiểm thử; (b) tìm nguồn bằng chứng khác cho khoảng 20/6–17/8; (c) cân nhắc thiết kế để audit ghi cả khóa bản ghi chữ ký; (d) đóng deviation khi có kết luận. |
| **TRẠNG THÁI CHỨC NĂNG CÒN LẠI (cập nhật 2026-10-10; thay thế bảng trạng thái cũ bên dưới)** | CHƯA HOÀN THIỆN | **1. Restore chạy thật (R5–R7, R9–R12):** khóa hệ thống, khôi phục vào DB tạm có tên khác, bổ sung object, hoán đổi có sao lưu trước, mở lại với scheduler tắt. Chưa làm. <br> **2. V3 hằng tháng:** chạy ứng dụng trên bản khôi phục ở container riêng, đối chiếu bản ghi với object. Chưa làm. <br> **2a. **Cập nhật 11/10/2026:** sys.admin2 không còn được sử dụng, đã bị đình chỉ (Suspended, hoàn tác được); `admin` là tài khoản quản trị hệ thống duy nhất đang hoạt động, và là người giữ quyền bỏ qua bảo trì duy nhất. Thu quyền bypass của sys.admin2 (làm 10/10/2026, có chữ ký điện tử từng bước):** tạo hồ sơ `ADMIN_NO_BYPASS` chỉ có bộ quyền Baseline; gán `sys.admin2` vào hồ sơ đó; gỡ khỏi hồ sơ System Administration. Kiểm tra: chỉ `admin` còn `security.maintenance.bypass`. **Khôi phục quyền quản trị không có bypass (cùng ngày, theo yêu cầu người phụ trách):** tạo bộ quyền `ADMIN_NO_BYPASS_SET` gồm 125 quyền của System Administration trừ `security.maintenance.bypass`; gán vào hồ sơ `ADMIN_NO_BYPASS` (cùng Baseline). Kiểm tra: `sys.admin2` có 126 quyền hiệu lực, không có bypass; chỉ `admin` còn bypass. <br> **2b. Cửa sổ bảo trì do admin thường thực hiện (10/10/2026):** endpoint notice, cancel, lock, unlock nhận Maintenance Pass hoặc phiên admin có bypass kèm chữ ký điện tử (header `X-Signature-Token`). Lỗi phát hiện khi chạy thử: cổng bảo trì đọc quyền bypass từ JWT, nhưng token không mang danh sách quyền, nên ngoại lệ admin chưa bao giờ có hiệu lực (bài kiểm tra trước đó không bắt được vì tự dựng principal). Đã sửa: cổng tra quyền bypass trong CSDL theo từng yêu cầu, và từ chối khi không tra được. Đã kiểm chứng: admin đăng nhập được khi đang DRAINED, `cancel` trả 200, hệ thống về NORMAL; approver.test1 và dco.test1 đăng nhập lại được. **Đã chạy đủ vòng đời cửa sổ bằng admin (10/10/2026, 03:53–04:01 UTC):** thông báo 5 phút (NOTICE) → DRAINED lúc 03:59 → admin truy cập được (200), tài khoản thường bị chặn (503) → vào cửa sổ (LOCKED_RESTORING) → khôi phục thử RH-20261010-0011 PASSED (C5 là cảnh báo DEV) → mở lại (NORMAL, file khóa đã gỡ) → tài khoản thường đăng nhập được (200). <br> **3. Backup Inspection (7.2):** chế độ chỉ đọc `inspect_{id}`, tự hủy, ghi ledger. Chưa làm. <br> **4. C11 và C8 đầy đủ:** ứng dụng trả lời đúng trên dữ liệu khôi phục; quản trị viên đăng nhập được. Chưa làm. <br> **5. Evidence Pack có ký số (mục 16): ĐÃ LÀM (10/10/2026)** — gói gồm yêu cầu và quyết định, kiểm tra, kết quả diễn tập, sự kiện sổ cái liên quan và kết quả kiểm tra toàn bộ chuỗi băm; ký bằng khóa manifest của agent. Endpoint `GET /backup-restore/restores/{id}/evidence`. Test: `RestoreRequestTest` 13/13 (chữ ký hợp lệ; sửa một chữ thì không hợp lệ). Trên DEV: RS-20261009-0037 trả về gói có chữ ký, chuỗi băm ok. **Đã làm (13/10/2026):** nút tải gói trên màn hình Lịch sử (file JSON đã ký, kèm SHA-256). <br> **Chưa làm:** lịch sử restore hoàn thành (chờ bước chạy restore đầy đủ). <br> **5a. Backup Inspection (mục 7.2), quyết định đã chốt (10/10/2026):** thời gian mở 5 phút; người duyệt là `approver.test1` (khác người yêu cầu, có chữ ký điện tử); giai đoạn đầu chỉ kiểm tra qua truy vấn trên DB `inspect_{id}` chỉ đọc, chưa có ứng dụng chỉ đọc. **Đã làm (agent, DEV, 10/10/2026):** migration V12 (bảng `backup_inspection`, sự kiện và kiểm tra append-only, ràng buộc người duyệt khác người yêu cầu, một lượt mở tại một thời điểm); `InspectionService` (yêu cầu, duyệt có chữ ký, từ chối, mở, đóng, tự hủy sau 5 phút); API nội bộ `/internal/inspections`; job `INSPECTION` chạy trên restore worker; kiểm tra: chữ ký manifest, khóa giải mã, C1–C4 bằng truy vấn, và kiểm tra ghi (phải bị từ chối). Bản sao được đặt chỉ đọc theo ba lớp: `default_transaction_read_only = on`, vai trò dùng chung `eqms_inspect_reader` chỉ có SELECT (chuyển vào bằng `SET ROLE`), và người dùng restore không có CREATEROLE nên không tự tạo được vai trò. Vai trò được cấp phát một lần bằng `scripts/backup/inspection-reader-role.sql`. Kiểm thử: agent 174/174 đạt (gồm 7 test Inspection). Trên DEV: bản sao IS-20261010-0002 của BK-20261009-1900-0001 đã mở với 10.279 tài liệu, ghi bị từ chối, và đã tự hủy đúng hạn: đóng lúc 05:06:36 UTC, lý do EXPIRED, người đóng `system:inspection-expiry`, sự kiện sổ cái INSPECTION_CLOSED (seq 341), DB đã biến mất. Lần thử đầu IS-20261010-0001 thất bại vì người dùng restore không có CREATEROLE; đã sửa bằng vai trò dùng chung và ghi nhận trong SDS. <br> **Đã làm thêm (10/10/2026, lát 35):** API backend `/backup-restore/inspections` (xem, yêu cầu, duyệt và từ chối có chữ ký điện tử ghi cùng giao dịch, đóng) với ý nghĩa chữ ký `BACKUP_INSPECTION_APPROVAL` / `BACKUP_INSPECTION_REJECTION` (V571); kiểm thử 7/7 và 13/13; đã triển khai DEV. <br> **Đã làm thêm (lát 36):** màn hình `Backup Inspections` (menu Restore) gồm danh sách phân trang có tìm kiếm phía server, yêu cầu từ một mã backup, duyệt và từ chối bằng modal chữ ký điện tử có sẵn (`BACKUP_INSPECTION_APPROVAL` / `BACKUP_INSPECTION_REJECTION`), đóng bản sao. Kiểm thử UI 5/5; cả nhóm restore và maintenance 102/102; đã triển khai DEV. <br> **Đã chạy trên DEV (lát 37, 10/10/2026):** yêu cầu bởi admin, duyệt bởi approver.test1 qua backend với chữ ký điện tử thật (`ESIG-2026-003912`); bản sao IS-20261010-0004 mở lúc 06:33:38 UTC với 10.279 tài liệu và tự đóng lúc 06:38:39 UTC, lý do EXPIRED. Lần thử trước (IS-20261010-0003) thất bại do quyền thành viên của vai trò chỉ đọc bị mất vì test dùng chung máy chủ DEV; đã sửa cả trên DEV lẫn trong test. <br> **Đã làm thêm (lát 38–39, 10/10/2026):** bản sao lỗi khi dọn được restore worker thử lại mỗi 15 giây; agent chính cảnh báo `INSPECTION_OVERDUE` khi bản sao quá hạn mà worker không chạy (một lần mỗi 30 phút); agent 176/176, inspection 9/9. Lỗi 33 lớp test do Flyway (V558/V559 nằm trong `db/migration-dev`) đã sửa trong cấu hình test của `pom.xml`; các lớp từng lỗi đều đạt. `sys.admin2` đã đình chỉ (có chữ ký của admin, hoàn tác được bằng reinstate). <br> **Quyết định của chủ sở hữu (10/10/2026):** quyền duyệt inspection dùng chung với quyền duyệt restore (không tách); đóng bản sao không cần chữ ký điện tử; test tiếp tục chạy trên DB DEV dùng chung (không dựng máy chủ test riêng). <br> **Chưa làm (còn lại của 7.2):** (a) chưa thao tác bằng trình duyệt (dùng cùng endpoint của màn hình); (c) ứng dụng chỉ đọc chạy trên bản sao (giai đoạn sau, cần container không mount docker socket); (d) bộ quét tự hủy chỉ chạy trên restore worker, nếu worker dừng thì bản sao quá 5 phút chưa được hủy và chưa có cảnh báo riêng; (e) vai trò quản trị DB (superuser `eqms` trên DEV) vẫn vượt được chế độ chỉ đọc, nên TEST/PROD phải dùng tài khoản không phải superuser; (f) API đóng là POST `/close`, thiết kế ghi DELETE, cần thống nhất. <br> **6. DR từ máy trống và Disaster Recovery Drills (V4):** chưa làm. <br> **7. Restore Impact Report đầy đủ:** chưa làm. <br> **8. Bảo trì sao lưu:** cảnh báo khi base backup thất bại hoặc ổ D sắp đầy (chưa làm); sao chép ra ổ D tự động đã kiểm chứng một lần; lịch chủ nhật 03:00 chạy lần đầu 11/10/2026. <br> **9. Cổng P3 (L8):** người không phải dev thực hiện một lần khôi phục đầy đủ vào validation. **Chưa chỉ định người.** <br> **10. Quyết định cần người phụ trách:** quyền bypass của `sys.admin2`; xử lý lệch migration V558/V559 trên DEV; sai lệch liên kết chữ ký trong audit (cần mở deviation, khoảng 150 mã chưa đối chiếu); nhóm dữ liệu revision hiệu lực không có chữ ký (C5 đang là cảnh báo trên DEV); Super Administrator và người giữ khóa (11.6); sáu yêu cầu CANCELLED cũ; R2 và R10; BR-12; RestoreDetailDrawer. <br> **11. Kiểm thử chưa làm:** bố cục điện thoại của các màn UI gần đây; lần khóa thử trực tiếp trên DEV (cần thông tin Super Admin). <br> **Đã hoàn thành và kiểm chứng trên DEV (tham khảo):** sao lưu CSDL và object; xác minh V1; yêu cầu restore R0–R3 có chữ ký; lập lịch và cửa sổ bảo trì; đăng xuất và ngoại lệ admin; khôi phục thử C1–C4, C6, C7, C8–C10, C12, C13; R8 vào bucket test; V2 hằng tuần và bù lịch; PITR trên bản sao; WAL archive; base backup định kỳ (test); sao chép ra ổ D. |
| **BẢNG TRẠNG THÁI HOÀN THIỆN BACKUP & RESTORE (cập nhật 2026-10-10; đã thay thế)** | CHƯA HOÀN THIỆN; THEO LÁT | **Đã có và kiểm chứng trên DEV:** sao lưu CSDL và object (T1, chuỗi băm ledger); xác minh V1; yêu cầu restore R0–R3 với e-signature; lập lịch, cửa sổ bảo trì, đăng xuất và ngoại lệ admin; khôi phục thử (diễn tập) gồm C1–C4, C5 (cảnh báo trên DEV), C6, C7, C8–C10, C12, C13; R8 vào bucket test; V2 hằng tuần và bù lịch; màn Verification Reports và Restore History nối API. <br> **Chưa có (theo SDS, tiêu chí nghiệm thu):** <br> (a) V3 hằng tháng: khởi động ứng dụng trên bản khôi phục ở container riêng; đối chiếu bản ghi ↔ object; mở mẫu tài liệu; kiểm chữ ký. Nghiệm thu: một bản backup thật qua V3 trên DEV. <br> (b) Backup Inspection (7.2): inspect_{id} chỉ đọc, tự hủy, ghi ledger, cần lý do và người duyệt. Nghiệm thu: mở một bản, không ghi được vào DB, tự hủy sau thời gian giới hạn. <br> (c) R5–R7 và R9–R12 (chạy restore thật): khóa, restore, bổ sung object, hoán đổi, mở lại có scheduler tắt. Nghiệm thu: restore thật vào DB tạm có tên khác, rồi hoán đổi trên DEV có sao lưu trước. <br> (d) WAL và base backup PostgreSQL (lát E): archive, lịch base backup, PITR. Nghiệm thu: khôi phục đến một thời điểm trên DEV. <br> (e) DR từ máy trống và Disaster Recovery Drills (V4, mục 13.5). Nghiệm thu: dựng lại từ không trên container trống. <br> (f) Evidence Pack có ký số, chuỗi băm ledger, Restore Impact Report đầy đủ. <br> (g) Cổng P3 (L8): người không phải dev thực hiện một lần khôi phục đầy đủ vào validation. Người thực hiện: CHƯA CHỈ ĐỊNH. <br> **Nguyên tắc thực hiện:** mỗi lát có tiêu chí nghiệm thu đo được; không gọi là xong khi chưa chạy thật trên DEV; mọi thay đổi ghi vào SDS và biên bản; không xóa dữ liệu audit/ledger (append-only), chỉ xóa dữ liệu thử nghiệm có ghi rõ. | Thứ tự đề xuất: (a) → (c) → (b) → (f) → (d) → (e) → (g). Người phụ trách cần chỉ định người cho (g). |
| P3 / Lát E: WAL archive, base backup định kỳ và dọn WAL trên Postgres DEV (mục 15.1) | XONG trên DEV (archive, base backup, dọn WAL, khôi phục từ base + WAL trên bản sao); CHƯA PITR đến mốc thời gian | Trước khi thay đổi: `pg_dumpall` (295 MB) và base backup vật lý. Bật `archive_mode=on`, `archive_timeout=300`; archive WAL nằm trong volume riêng `eqms_pg_archive` (sau khi phát hiện archive ban đầu nằm trong lớp ghi của container và có thể mất khi tạo lại container; các segment đã được chuyển sang volume mới). <br> Thêm quy tắc `pg_hba` `host replication eqms 172.19.0.0/16 scram-sha-256` (chỉ user eqms, subnet compose, mã hóa mật khẩu). <br> Container `pg-maintenance` (file `docker-compose.pg-maintenance.yml`, script `scripts/backup/pg-maintenance.sh`) chạy base backup chủ nhật 03:00 (giờ Việt Nam), giữ 14 ngày nhưng luôn giữ bản mới nhất, và dọn WAL cũ hơn điểm bắt đầu của base backup cũ nhất còn giữ. Kiểm tra: base backup 10/10/2026 08:49 ok (file `backup_label` có điểm bắt đầu WAL); dọn WAL đã xóa các segment cũ hơn điểm bắt đầu; khôi phục base backup trên bản sao khởi động được và đọc được 10.279 tài liệu, khớp số liệu trước đó. <br> **Đã làm thêm (10/10/2026):** PITR kiểm chứng trên bản sao: base backup + WAL archive, `recovery_target_time = 01:56:40 UTC`, `recovery_target_action = promote`. Bảng thử có dòng trước mốc (commit 01:56:37) và dòng sau mốc (commit 01:56:44 và 01:58:14); kết quả chỉ có dòng trước mốc. Bản sao đã được dừng và xóa; bảng thử đã được xóa khỏi CSDL DEV. <br> **Chạy thật (10/10/2026 09:01):** base backup mới `base-20261010-090101`; sao chép ra ổ D (`D:\eqms-dev-backups`): base (752 MB, 2 bản), WAL archive (113 MB), `pg_dumpall` (296 MB); file `SHA256SUMS.txt` (4.499 file) đã kiểm tra khớp. Ổ D là ổ khác với ổ hệ thống C:; nơi Docker lưu volume chưa kiểm chứng. <br> **Thay đổi lịch (10/10/2026, theo yêu cầu người phụ trách):** lịch chủ nhật 03:00 được thay bằng chu kỳ 10 phút để kiểm thử (biến `PG_MAINTENANCE_EVERY_MINUTES=10`). Lần chạy đầu: `base-20261010-090510` ok, dọn WAL ok. Khi xong kiểm thử, bỏ biến này để quay lại lịch chủ nhật 03:00. <br> **Sao chép ra ổ D tự động (10/10/2026):** container bảo trì gắn `D:\eqms-dev-backups` làm `/offsite`. Sau mỗi base backup, script sao chép bản base mới và WAL còn thiếu, tính SHA-256 (`SHA256SUMS-base-wal.txt`), và áp dụng cùng chính sách giữ 14 ngày. Đã kiểm chứng: bản `base-20261010-091026` được sao ra ổ D và checksum khớp. <br> **Quay lại lịch chủ nhật 03:00:** chu kỳ 10 phút đã được gỡ. Lý do: mỗi base backup khoảng 370 MB; chu kỳ 10 phút sẽ làm đầy ổ D (còn khoảng 13 GB) trong vài giờ. Muốn kiểm thử dày hơn cần ổ lớn hơn hoặc giảm thời gian giữ. <br> **Cảnh báo bảo trì sao lưu (10/10/2026):** cảnh báo ghi vào log container và vào `D:\eqms-dev-backups\ALERTS.log` khi dung lượng trống của thư mục backup hoặc ổ D dưới 5.120 MB (biến `MIN_FREE_MB`), và khi base backup thất bại. Đã kiểm chứng cảnh báo dung lượng (ngưỡng tạm đặt rất cao: hai cảnh báo được ghi). Cảnh báo thất bại base backup chưa kiểm chứng được vì cần làm hỏng một lần chạy. <br> **Chưa làm:** đưa cảnh báo vào giao diện (trang tổng quan sao lưu). | **Ghi chú:** lần thử đầu tiên bị lỗi `pg_hba`, và archive ban đầu nằm trong lớp ghi của container; cả hai đã được sửa như mô tả ở trên. |
| P3 / WP3.2 lát A: V2 hằng tuần (14.1) | XONG trên DEV (test 11/11; chạy thật RH-20261009-0010 PASSED) | Worker: `WeeklyV2Verification` lập lịch thứ Hai 05:00 (Asia/Ho_Chi_Minh), chọn bản backup mới nhất có kết quả kiểm tra gần nhất là VERIFIED, xếp diễn tập với người yêu cầu `system:V2`; khi xong, kết quả được ghi vào `backup_verification` với tầng V2 (VERIFIED/FAILED, kèm mã diễn tập và mã lỗi). Nếu lần trước còn chờ hoặc đang chạy: bỏ qua và ghi `SKIPPED_OVERLAP`. Có endpoint nội bộ `POST /internal/verification/v2` để chạy tay. Kiểm tra trên DEV: V2 VERIFIED, người thực hiện `system:V2`. | Chưa làm: bù lịch bị lỡ (lát B); lịch thật chưa được quan sát đến hết (chạy lần đầu vào 12/10). |
| **Điều tra sai lệch chữ ký trong audit (2026-10-10, chỉ đọc): đính chính** | ĐÃ ĐIỀU TRA; CÒN ~150 THAM CHIẾU CHƯA ĐỐI CHIẾU ĐƯỢC | **Đính chính:** con số "8.144 thiếu bản ghi" trước đó là sai: đã so mã trong audit với khóa bản ghi chữ ký, trong khi hai luồng dùng hai định danh khác nhau. <br> **Luồng revision** (Review, Approve, Publish, ...) ghi trong audit mã phiên của token chữ ký đã dùng (`used_signature_tokens.token_id`); bản ghi `electronic_signatures` có khóa riêng và mã `SIG-…`, không được liên kết với audit. **Luồng thực thể** ghi trực tiếp khóa bản ghi chữ ký. <br> **Đối chiếu (4.066 mã chữ ký riêng biệt trong audit):** 2.840 khớp token đã dùng (sau 21/8/2026); 914 khớp bản ghi chữ ký (sau 21/8); 167 khớp bản ghi chữ ký (trước 21/8); còn khoảng 145–167 mã từ 20/6 đến 17/8/2026 không khớp token cũng không khớp bản ghi nào. Phần lớn thuộc các bước làm việc (Submit, Review, Approve, Publish) và nhập lịch sử. Chỉ 4 trong số đó liên kết được với revision hiệu lực không có chữ ký. <br> **Kết luận:** không có bằng chứng xóa chữ ký (không có đoạn mã nào xóa, và phần lớn mã đã đối chiếu được). Không thể xác định các mã còn lại vì bảng token chưa có dữ liệu trước 21/8. Đây là thiếu khả năng truy vết giữa audit và chữ ký (thiết kế), cộng với một nhóm chưa đối chiếu được. | **Cần người phụ trách quyết định:** (a) mở deviation về việc audit không liên kết được với bản ghi chữ ký trong luồng revision; (b) kiểm tra nguồn khác (bản sao CSDL hoặc nhật ký ứng dụng) cho ~150 mã từ 20/6 đến 17/8; (c) có thay đổi thiết kế để audit ghi cả khóa bản ghi chữ ký hay không. |
| **Ngoại lệ DEV: C5 là cảnh báo trên DEV (2026-10-10)** | NGOẠI LỆ CÓ NHÃN; CHỈ DEV | Để DEV làm được khôi phục thử, C5 được đặt là cảnh báo (không bắt buộc) khi cờ `AGENT_RESTORE_SIGNATURECHECKADVISORY=true` và môi trường là DEV; ở TEST và PROD cờ bị bỏ qua và C5 luôn bắt buộc. C5 vẫn được tính và ghi kết quả đầy đủ. Lý do: dữ liệu DEV có 164 revision hiệu lực không có chữ ký, chủ yếu là dữ liệu kiểm thử (xem mục trên). Không xóa hay sửa dữ liệu. Diễn tập RH-20261009-0009 trên DEV: PASSED; C5 hiển thị "DEV warning only". Test: `onDevAnUnsignedRevisionIsAWarningAndDoesNotFailTheRehearsal`; agent đầy đủ đạt. | Người phụ trách cần xác nhận ngoại lệ này và xử lý sai lệch chữ ký trong audit (8.144 tham chiếu) như một deviation riêng. |
| **Kiểm tra dữ liệu C5 (2026-10-10, chỉ đọc): dữ liệu kiểm thử hay dữ liệu thật?** | ĐÃ KIỂM TRA; CẦN QUYẾT ĐỊNH VÀ ĐIỀU TRA | **Kết quả:** <br> (1) Trong 164 revision hiệu lực không có bản ghi chữ ký: 154 được tạo bằng luồng "Legacy Batch Import" đưa thẳng lên hiệu lực, qua API (11 từ `curl`, 144 không có user agent, đều từ 127.0.0.1); tên file trùng tên trong `LegacyBatchImportFullFlowTest`; thời điểm trùng các đợt chạy kiểm thử (22/9–7/10). **Kết luận: phần lớn là dữ liệu kiểm thử tự động trên DEV.** <br> (2) 10 revision còn lại đi qua luồng làm việc thật bằng trình duyệt (gồm "Hoàng test tối 20_06", là test thủ công trên DEV). Dữ liệu này không phải do test tự động, nhưng vẫn không có bản ghi chữ ký. <br> (3) **Phát hiện nghiêm trọng, không phụ thuộc vào (1)–(2):** nhật ký audit ghi cờ "chữ ký đã áp dụng" và mã chữ ký; trong toàn CSDL DEV có 9.910 bản ghi audit tham chiếu một mã chữ ký, trong đó 8.144 mã (82%) không có bản ghi tương ứng trong `electronic_signatures` (3.512 bản ghi). Chưa xác định nguyên nhân: không tìm thấy đoạn mã nào xóa chữ ký; có thể là giao dịch bị hủy trong khi nhật ký đã ghi, hoặc CSDL DEV đã được khôi phục/ghi đè một phần. <br> **Không sửa, không xóa dữ liệu nào.** Không nới điều kiện C5. | **Cần người phụ trách quyết định:** (a) xác nhận nhóm kiểm thử và cách đánh dấu để loại khỏi phạm vi C5 (các tên và nguồn gọi cho thấy đây là dữ liệu kiểm thử); (b) điều tra riêng về 8.144 tham chiếu chữ ký thiếu trong audit như một sai lệch cần ghi nhận (deviation) theo quy trình chất lượng, không gộp vào P3; (c) quyết định về việc C5 chỉ áp dụng cho dữ liệu thật. |
| P3 / lát 5: Cảnh báo Admin khi cửa sổ mở (11.5.2 M3) | XONG trên DEV (email đã kiểm trên Mailhog) | Thông báo trong ứng dụng gửi tới mọi tài khoản có quyền `security.maintenance.bypass` (2 tài khoản trong DEV, đã kiểm trong mỗi lần chạy). Email gửi tới địa chỉ Admin của cấu hình chung. DEV đã trỏ SMTP tới Mailhog (mailhog:1025) từ trước; bốn thư cảnh báo đã nằm trong Mailhog đúng người nhận và tiêu đề, từ các lần thử cửa sổ bảo trì. Test: 5 đơn vị và 11/11 kịch bản thông báo. | Chưa có cảnh báo trong ứng dụng cho các thao tác khác của cửa sổ bảo trì. Gửi tới hộp thư bên ngoài chưa kiểm (DEV chỉ có Mailhog). |
| P3 / lát 6: Yêu cầu restore, báo cáo tác động, duyệt (11.3 R0-R3) | MỘT PHẦN (R0-R3) | Agent: `V7__restore_requests.sql`, `RestoreRequestService`; báo cáo tác động đo từ manifest và từ DB sống qua tài khoản chỉ đọc (số dòng audit ghi sau thời điểm backup, hoặc "không đo được" kèm lý do); yêu cầu production cần một lần test restore đạt trong 30 ngày; khi duyệt báo cáo được đo lại (M4) và lưu băm mới; người duyệt phải khác người yêu cầu (có ràng buộc trong cơ sở dữ liệu). Backend: `V566` (quyền `backup.restore.request`, `backup.restore.approve`, nghĩa chữ ký `BACKUP_RESTORE_APPROVAL`), `BackupRestoreRequestController`: chữ ký điện tử bắt buộc khi duyệt, ghi trong cùng giao dịch với việc duyệt. Test: agent 142 (9 mới), backend 8 mới. Chạy thật `scripts/backup/p3-restore-request-e2e.py` 18/18 với hai tài khoản thật: admin yêu cầu, admin không tự duyệt được, approver.test1 duyệt bằng chữ ký của chính mình, duyệt lần hai bị từ chối, một yêu cầu thứ hai bị từ chối khi đang có yêu cầu mở, từ chối cần lý do, người duyệt không hủy được yêu cầu của người khác, người yêu cầu hủy được. | **Chưa làm:** R4-R12 (lập lịch, thực thi, giải mã bằng khóa trên máy thực thi, restore vào `eqms_restore_{id}`, hoán đổi DB, bảng bí danh phiên bản, các kiểm tra C5 và C7-C13, đối soát job, mở lại); Restore Execution Console; bước R2 (đánh giá GMP) và R10 (QA Verifier); cảnh báo đầy đủ về thời gian hiệu lực của báo cáo tác động (chưa có ngưỡng); quyền thực thi restore chưa được cấp vì chưa có thực thi. Yêu cầu đã duyệt chỉ là hồ sơ, không thể thực thi. |
| P3 / lát 7: Màn hình yêu cầu restore, hàng đợi duyệt, form tạo yêu cầu (nối API thật) | XONG trên DEV | Ba màn hình đọc và ghi qua API, không còn dữ liệu mẫu. **Restore Requests**: danh sách phía server, lọc theo trạng thái và đích, chi tiết có báo cáo tác động và lịch sử; không có hủy yêu cầu. **Restore Approval Queue**: chỉ hiện yêu cầu đang chờ; duyệt phải qua hộp thoại chữ ký điện tử với nghĩa `BACKUP_RESTORE_APPROVAL`; từ chối cần lý do; không có nút duyệt cho yêu cầu của chính mình. **New Restore Request**: chỉ liệt kê bản sao lưu đã hoàn tất và đã xác minh (lọc phía server); nhận `?backup=`; loại R-FULL, R-DB, R-OBJ; đích kiểm thử hoặc production; production cần mã thay đổi và một lần test restore đạt trong 30 ngày (kiểm tra trước và backend kiểm tra lại). Kiểm thử: 178 test vitest đạt ở các khu vực liên quan; `tsc` sạch, trừ 2 lỗi có sẵn trong `ReportLists.test.tsx`; trình duyệt trên DEV: 10/10 kiểm tra các màn hình (không gửi yêu cầu nào). | **Chưa làm:** chạy restore đã duyệt (R4-R12), nên yêu cầu đã duyệt chỉ là hồ sơ; **R-ONE** không có trong form vì yêu cầu chưa có cách chọn bản ghi; **Disaster recovery** không có trong form vì chưa có bước thực thi và khai báo sự cố; |
| P3 / lát 8: Duyệt và từ chối restore trên trình duyệt bằng chữ ký thật | XONG trên DEV | `scripts/backup/p3-restore-browser-e2e.js`, 17/17: admin tạo yêu cầu bằng form; người yêu cầu thấy "Your request" và không có nút duyệt; approver.test1 duyệt qua hộp thoại chữ ký bằng mật khẩu của chính mình, máy chủ ghi APPROVED và người duyệt; từ chối không bật nút khi chưa có lý do, sau đó máy chủ ghi REJECTED kèm lý do; (bước hủy đã gỡ ngày 2026-10-09; xem lát 14). Trạng thái được đối chiếu qua API. | DEV còn lại 3 yêu cầu làm bằng chứng (1 đã duyệt, 1 đã từ chối, và các yêu cầu hủy ghi trước khi gỡ bước hủy). Chưa có cách kiểm trên màn hình khi hàng đợi có nhiều yêu cầu, và chưa kiểm chữ ký sai mật khẩu trên giao diện. |
| P3 / lát 9: Thông báo bảo trì trên trang đăng nhập (11.5.4) | XONG trên DEV | Trang đăng nhập hiện khung thông báo "System maintenance starts in m:ss" khi cửa sổ ở NOTICE; đếm ngược theo đồng hồ máy chủ, không theo đồng hồ trình duyệt; không hiện ở các trạng thái khác; lỗi đọc trạng thái giữ nguyên trang. Test: 2 test đơn vị; `scripts/backup/p3-login-notice-e2e.js` 9/9 (kèm kiểm giới hạn đăng nhập), có ảnh chụp trang đăng nhập đang có thông báo. | Chưa có cho các trang khác ngoài đăng nhập (không cần, người dùng đang ở trong hệ thống đã thấy chip). Test cho nhánh lỗi đọc trạng thái chưa tự động hóa: thử nghiệm mô phỏng gây lỗi cho Vitest không ổn định, nên nhánh này chỉ kiểm bằng đọc mã. |
| P3 / lát 10: Giới hạn đăng nhập Super Administrator (11.6, mục còn mở) | XONG trên DEV (giá trị DEV) | Sau 5 lần đăng nhập sai trong 15 phút, tên đó bị khóa 15 phút: lần thử bị từ chối không kiểm mật khẩu (kể cả mật khẩu đúng) và ghi `LOGIN_THROTTLED`. Khi khóa, máy chủ trả HTTP 429 mã `SUPER_ADMIN_LOCKED`, còn trang bảo trì báo rõ đang khóa, không báo "sai mật khẩu". Agent: migration `V8__super_admin_login_throttle.sql`, `SuperAdminService`. Test: agent 144/144 (2 mới: khóa cả khi đúng mật khẩu; khóa hết hạn và lần đúng đặt lại bộ đếm). Trực tiếp qua API với tên thử: 401 năm lần, lần thứ sáu 429. | **Chưa làm:** ngưỡng 5 lần và 15 phút là giá trị DEV, cần QA và chủ dự án chốt; người tấn công có thể khóa tạm Super Administrator bằng cách gõ sai (rủi ro sẵn sàng; cần quy trình khẩn cấp, chưa có); chưa giới hạn theo địa chỉ IP; phần backend ánh xạ 429 chưa có test tự động (đã kiểm qua API). |
| P3 / lát 11: Bỏ cơ chế người giữ khóa; quyền theo Access Profile | XONG trên DEV | Quyết định 2026-10-09: không có cơ chế chia khóa hai người. Quyền `backup.restore.execute` được thêm (V567), gán cho bộ quyền quản trị; yêu cầu, duyệt và thực thi là ba quyền riêng, gom vào Access Profile và gán theo quy trình nội bộ (mục 9.1a). Giao diện hàng đợi duyệt chỉ hiện nút Duyệt, Từ chối khi người dùng có `backup.restore.approve`; người không có quyền thấy "Read only" (kiểm bằng test). | **Chưa làm:** chính việc thực thi restore (R4-R12); chưa có màn gán Access Profile cho người duyệt trong DEV (làm bằng màn quản trị hiện có, có e-sign). Mục 11.6 vẫn ghi người giữ tên Super Administrator (`super_admin_custodian`) và mở khóa qua người giữ: đây là việc khác (ai khai báo đăng nhập), chưa đổi, chờ quyết định. |
| P3 / lát 12: Màn chi tiết yêu cầu restore, cột thao tác, chữ ký khi từ chối, thông báo khi được duyệt | XONG trên DEV | Màn `/backup-restore/restores/{id}`: thanh bước Requested, Pending Approval, Approved, Rejected; thông tin bản backup và thành phần sẽ được khôi phục; báo cáo tác động; lịch sử. Người có quyền duyệt bấm Approve and Sign hoặc Reject (lý do, rồi chữ ký điện tử); không có hủy yêu cầu: chỉ người được phân công duyệt hoặc từ chối. Màn Restore Requests có cột Thao tác (View Detail, Approve Request). Backend: từ chối cần chữ ký điện tử (V568, nghĩa `BACKUP_RESTORE_REJECTION`); sau khi duyệt được ghi, `RestoreApprovalNotifier` gửi thông báo trong ứng dụng cho người có `backup.restore.execute`. Test: controller 8/8; frontend các khu vực liên quan đạt; trình duyệt DEV: luồng duyệt và từ chối bằng chữ ký thật (kết quả ở biên bản change record). | **Chưa làm:** thực thi restore (R4-R12), nên thông báo chỉ báo rằng yêu cầu đã được duyệt; thông báo email; màn chi tiết chưa có lịch sử từng bước chữ ký (chỉ có người và thời điểm); khi hàng đợi có nhiều người, chưa kiểm vai trò người được chỉ định thực tế bằng nhiều tài khoản. |
| P3 / lát 13: Một màn hình Restore Requests; màn chi tiết theo mẫu Backup Details; menu thao tác đúng mẫu | XONG trên DEV | Restore Approval Queue đã gỡ (route, menu điều hướng, test). Restore Requests có cột No. đầu bảng, cột Actions với menu portal (View Detail, Approve Request, Reject Request) đúng mẫu danh sách Backup History; duyệt và từ chối dùng chung một thành phần (chữ ký điện tử; từ chối nhập lý do trước). Màn chi tiết `/backup-restore/restores/{id}` dựng lại theo Backup Details: thanh bước, thông tin yêu cầu, bản backup và thành phần, phần "What This Restore Puts Back", lịch sử; nút Back, Approve, Reject ở đầu trang (không có nút hủy). Kiểm trên DEV: phiên bản desktop và điện thoại (390 px) không cuộn ngang; luồng duyệt và từ chối bằng chữ ký thật qua menu. | **Chưa làm:** thực thi restore (R4-R12); email thông báo; màn chi tiết chưa hiển thị bản ghi chữ ký đầy đủ. |
| P3 / lát 14: Bỏ trạng thái và chức năng Hủy yêu cầu restore | XONG trên DEV | Theo yêu cầu của chủ dự án (2026-10-09): không có hủy yêu cầu restore. Đã gỡ: endpoint `POST /restores/{id}/cancel` (backend và agent), `RestoreRequestService.cancel`, nút Cancel Request, hàm gọi API, các nhãn và màu của trạng thái CANCELLED, và kiểm tra hủy trong các script. Agent: `V9__restore_request_no_cancel.sql` thay ràng buộc trạng thái bằng bản `NOT VALID`: từ nay không ghi được trạng thái CANCELLED; các bản ghi đã ghi trước đó giữ nguyên làm bằng chứng. Luồng hiện tại: admin yêu cầu, người được phân công duyệt (ký điện tử) hoặc từ chối (lý do và ký điện tử), rồi mới đến thực thi. Kiểm thử: agent 143/143; backend `BackupRestoreRequestControllerTest` 8/8; frontend backup-restore 70/70; `tsc` sạch trừ hai lỗi có sẵn. | **Chưa làm / cần quyết định:** sáu yêu cầu ghi trạng thái CANCELLED trước đây (ghi bởi các script kiểm thử trên DEV) vẫn còn trong cơ sở dữ liệu DEV làm lịch sử; màn hình vẫn hiển thị chúng với nhãn "Cancelled" cho đến khi chủ dự án quyết định cách xử lý (giữ làm lịch sử với ghi chú, hoặc đánh dấu là dữ liệu thử). Không xóa vì bảng sự kiện là append-only. |
| P3 / lát 15: Bước chọn bản backup của New Restore Request dùng bảng dùng chung | XONG trên DEV | Bước "Select a backup" dùng `DataTable` dùng chung (cùng kiểu với các bảng khác): cột chọn kiểu radio (một bản backup), cột No., Backup ID, Started, Type, Size, Schema, Status, Integrity, Verified; dòng được chọn được tô màu; Custom Column có khóa `backup-restore.new-request.backups`. Chỉ liệt kê bản đã hoàn tất và đã xác minh (lọc phía server, như trước). Test: `backup-restore` 70/70. | Chưa làm: bảng này tải một lần (tối đa 100 bản), không phân trang phía server; sẽ chuyển sang `ServerListPanel` nếu số bản backup vượt quá giới hạn đó. |
| P3 / lát 16: Chọn bản backup bằng checkbox; dòng được chọn tô emerald; icon cho các mục trong luồng yêu cầu | XONG trên DEV | Bước "Select a backup" dùng checkbox dùng chung (một bản tại một thời điểm: chọn bản mới bỏ bản cũ), không còn tiêu đề "Select" ở cột chọn; cột No. không cố định nên cả dòng được tô emerald khi chọn; Backup ID mở chi tiết bản backup (không kích hoạt việc chọn dòng). Các mục FormSection của luồng yêu cầu có icon. Test: `backup-restore` 70/70. | Chưa làm: chưa kiểm trên màn hình điện thoại cho bảng này. |
| P3 / lát 17: Danh sách backup của New Restore Request xử lý ở server; checkbox; nút kích thước sm; giữ dữ liệu khi Back/Next | XONG trên DEV | Bước "Select a backup" dùng `ServerListPanel` (cùng bộ với các màn Backup & Restore): tìm kiếm có debounce 400 ms (server), lọc theo loại (Full, Incremental), sắp xếp ở tiêu đề (Backup ID, Started, Type, Size), phân trang server-side tối đa 10 dòng. Chỉ liệt kê bản đã hoàn tất và đã xác minh. Chọn bằng checkbox (một bản; chọn bản mới bỏ bản cũ); bấm vào vùng khác của dòng cũng chọn. Lỗi đã sửa: bấm trực tiếp vào checkbox không hoạt động vì sự kiện click của dòng chọn lại bản đó; nay sự kiện của ô chọn được chặn lan lên dòng. Bản đã chọn lưu thành bản ghi đầy đủ nên không phụ thuộc vào trang đang xem. Nút Back, Next, Submit đổi sang kích thước sm. Dữ liệu được giữ khi Back/Next (bản đã chọn, loại, đích, lý do, mã thay đổi). Kiểm trên DEV: 8/8 kiểm tra bảng (chọn, bỏ chọn, chọn theo dòng, tìm kiếm, sắp xếp, trang 2); kiểm tra giữ dữ liệu đạt. Test `backup-restore` 70/70. | Chưa làm: màn điện thoại của bảng chưa kiểm lại; Mặc định 10 dòng mỗi trang; người dùng chọn được 10, 20 hoặc 50 bằng bộ tùy chọn của phân trang dùng chung. |
| P3 / lát 18: Kiểm tra test restore 30 ngày của yêu cầu production xử lý ở server | XONG (agent, backend, frontend) | Trước đây màn New Restore Request tự lọc theo ngày trên trình duyệt. Nay agent có `RestoreRequestService.readiness(backupId)` (cùng điều kiện 30 ngày với lúc tạo yêu cầu: bài test restore đạt gần nhất, hoàn thành trong 30 ngày), endpoint nội bộ `GET /internal/backups/{id}/restore-readiness`, backend `GET /backup-restore/backups/{id}/restore-readiness` (quyền xem Backup & Restore), và API `restoreReadiness`. Màn form chỉ hiển thị kết quả của server; đang kiểm tra thì mục này bị chặn. Test: agent (có kiểm tra bài test quá 30 ngày không còn được tính), backend `BackupRestoreRequestControllerTest` 8/8, frontend `backup-restore` 70/70. | Chưa làm: tên mục kiểm tra vẫn hiển thị theo số ngày từ server (30). |
| P3 / lát 19: Form tạo yêu cầu restore: mỗi bước một FormSection; kiểu trình bày như Document Properties | XONG trên DEV | Mỗi bước của New Restore Request (Type & Target, Pre-checks, Review & Submit) là một FormSection có icon, bên trong gồm các khối nhóm cùng kiểu với Numbering & Effective Date (khung bo tròn, tiêu đề nhóm chữ hoa, nhãn và ô nhập cỡ chữ và màu như trang Document Properties). Bỏ banner Design preview vì form đọc dữ liệu thật. Nhãn của lý do và mã thay đổi được gắn với ô nhập. Test backup-restore 70/70. | Chưa làm: màn điện thoại của các bước này chưa được chụp lại. |
| P3 / lát 2-4: Super Administrator (11.6, BR-17), chế độ bảo trì (11.5), cổng khóa, thông báo, đăng xuất phiên | XONG trên DEV (trừ email, cảnh báo Admin, OnlyOffice) | Tài khoản `super.admin` ngoài bảng người dùng; máy trạng thái NORMAL/NOTICE/DRAINED/LOCKED ở agent; cổng khóa ở backend chạy trước mọi bộ lọc. Lát 3: chip đếm ngược đỏ nhạt nhấp nháy trên Header (tắt khi người dùng bật giảm chuyển động), hộp thoại tự mở, nút "Sign out now" và "Close", tự đăng xuất trình duyệt khi hết giờ. Lát 4: khi bắt đầu thông báo, một thông báo CRITICAL tới mọi người dùng qua System Announcements (tắt khi cửa sổ đóng; thông báo "hệ thống đã mở lại" khi mở khóa); khi DRAINED, mọi phiên đang mở bị thu hồi trong cơ sở dữ liệu và số phiên ghi vào sổ cái. Test: agent 133, backend 5 (thu hồi phiên) + 7 (cổng khóa), frontend 11 (bảo trì) và 170 trong các bộ liên quan; trình duyệt thật 9/9; kịch bản đầu-cuối thông báo và đăng xuất 11/11 (652 phiên về 0). Thông báo 1 phút chỉ dùng cho DEV (BR-16 giữ 5-240 phút ở TEST và PROD). Trang bảo trì chỉ hiện khi công tắc Chung bật hoặc cửa sổ đã DRAINED/LOCKED; tự chuyển về đăng nhập khi cửa sổ đóng và công tắc tắt (10/10 kịch bản công tắc). | **Chưa làm:** OnlyOffice lưu và đóng phiên soạn thảo khi cửa sổ mở; các bước restore R0-R12 và Restore Execution Console; việc thu hồi phiên và thông báo không vào audit trail của eQMS (không có người đăng nhập để ghi tên) mà nằm trong sổ cái của agent, là bằng chứng chính cho các bước này; mật khẩu Super Admin dùng để test đã gửi qua chat (đổi trước khi dùng ngoài DEV; quy trình đổi chính thức là câu hỏi mở). |
| P2 / WP2.2 Giao diện đích: thư mục, S3; kiểm thử đích; chép sang đích khác có đọc lại; T2 | XONG trên DEV (mô phỏng) | Hồ sơ P2 (`BACKUP_P2_2026_10_08_CHANGE_RECORD.md`). T1, T2, T3 cùng nhận một bản backup thật (`BK-20261008-1525-0016`), đọc lại khớp. T3 là MinIO thứ hai có Object Lock, thử "từ chối xóa" đạt thật. Cấu hình đích theo mã (`AGENT_TARGETS_EXTRA_T2_*`) nên bật từng đích riêng được. Màn Storage & Encryption có nút Test cho từng đích (quyền riêng `backup.admin.storage.test`, có audit). | **T2 chỉ là một thư mục trên PC này** (`backups/dev/t2-nas`) giả làm NAS: chứng minh cơ chế, chưa phải thiết bị thứ hai; chưa thử NFS/SMB thật, chưa thử mất kết nối giữa chừng. **T3 cùng máy PC**, GOVERNANCE 1 ngày, chưa phải vị trí độc lập, chưa có COMPLIANCE thật. Chưa có `MediaTarget` (ghi thẳng vào phương tiện): ghi ra phương tiện hiện làm qua Export. Mỗi lần kiểm thử đích bất biến để lại một object `_probe/` nhỏ. Kết quả kiểm thử đích chỉ hiện trong phiên làm việc và nằm trong sổ cái; chưa có bảng "lần kiểm thử gần nhất" lưu bền và cảnh báo khi quá hạn kiểm thử. |
| P2 / WP2.1 Backup object (tài liệu trong MinIO) tăng dần theo version, chỉ mục "full view" mã hóa, V1 kiểm `OBJECTS_PRESENT` | XONG trên DEV | Chạy thật: 1310 version, 369 MB trong 1 lần; lần 2 tăng dần 18 giây không chép lại gì; giải mã thử 6/6 object ngẫu nhiên đúng SHA-256; 14 test mới (agent hiện 70 test) | **Dùng tài khoản root của MinIO** ở DEV; chưa có tài khoản dịch vụ chỉ-đọc (mục 5) và chưa thử ở IQ-01. **Sao chép tuần tự**, chưa song song có giới hạn. Tập "đã biết" nạp hết vào bộ nhớ mỗi lần chạy (đủ cho nghìn version, cần truy vấn theo trang khi lên trăm nghìn). V1 chỉ băm đầy đủ phần mới; tài liệu cũ chỉ kiểm sự tồn tại và kích thước (cần kiểm băm đầy đủ định kỳ ở V2/V3). **Chỉ mục object nằm cạnh backup nhưng chưa có công cụ restore đọc nó** (thuộc P3). Danh sách bucket cấu hình bằng tay, chưa lấy từ policy. Chưa thử bucket khóa vĩnh viễn `eqms-gmp-records` với dữ liệu lớn. Chưa có nhãn `FILE_STORAGE` (thư mục `backend_storage`) và `CONFIGURATION`. |
| P2 / WP2.3 Policy theo version, cổng 3-2-1-1, hai người, e-sign + audit | XONG trên DEV (một phần chưa kiểm bằng người dùng thật) | Agent: `PolicyService`, API `/internal/policies`, migration điều khiển V3; backup đọc phạm vi và đích từ policy đang chạy. Backend: `BackupPolicyController/Service`, migration `V562` (quyền `backup.admin.policy.propose`, `.approve`, ý nghĩa chữ ký `BACKUP_POLICY_CHANGE`). Test: agent 92 (policy 18), backend 13 mới. Chạy thật: bản nháp chỉ có T1 bị từ chối với đủ lý do; người đề xuất tự duyệt bị từ chối; sổ cái nối băm vẫn đúng. | **Chưa chạy luồng e-sign thật từ giao diện** (tôi không có tài khoản người dùng; chỉ kiểm bằng test có giả lập): cần bạn thử bằng hai tài khoản. **Policy v3 trong DEV được kích hoạt qua API agent** bằng hai tên giả `dev.proposer` / `dev.approver` và tham chiếu `DEV-AGENT-API-NO-ESIGN`: không phải thay đổi có ký, chỉ để backup DEV tiếp tục chạy; nên làm lại bằng giao diện. **DEV nới điều kiện OFFSITE** (mọi thứ trên một PC); TEST và PROD áp dụng đủ. "Ngoài cơ sở" là khai báo của người dùng, hệ thống không đo được. Tách hai người dựa trên tên đăng nhập; chưa có quy tắc Super Administrator chỉ tính một người (BR-19). Nếu agent kích hoạt xong mà eQMS không ghi được chữ ký thì policy đã chạy mà thiếu chữ ký (rất hiếm, chưa có đối soát). Cổng chỉ kiểm lúc kích hoạt: bỏ cấu hình một đích sau đó chỉ gây cảnh báo khi backup. Policy mới chỉ có: DATABASE và OBJECT_STORE, lịch hằng ngày giờ cố định, backup đầy; chưa có FILE_STORAGE, CONFIGURATION, tần suất khác, backup tăng dần, backup trước thay đổi tự động, số lần thử lại. Danh sách bucket vẫn lấy từ cấu hình agent, chưa từ policy. |
| P2 / WP2.4 Export Backup Set và Offline Media Register (`backup_export, offline_media, media_event`) | XONG trên DEV | Agent: migration điều khiển V4, `MediaService`, `ExportService`, `/internal/media`, `/internal/exports`; gói gồm DB, chỉ mục và mọi version tài liệu cần thiết (đã mã hóa), `manifest`, `PACKAGE-SHA256SUMS`, biên nhận ký Ed25519 ghi sau cùng, công cụ `verify-chain.sh/.ps1`, khóa công khai, README. Backend: `BackupExportController`, migration V563 (`backup.backup.export`, `.export.approve`, `backup.media.manage`) và V564. Test: agent 114 (22 mới cho export/phương tiện, có chạy thật `verify-chain.sh` với openssl), backend 11 + 3 mới. Chạy thật `scripts/backup/p2-export-e2e.sh`: **16/16**, gói 439 MB, `verify-chain.sh` đạt, giải mã DB bằng khóa riêng ra đúng bản dump, giải mã một tài liệu khớp SHA-256, sửa một byte hoặc sửa biên nhận đều bị phát hiện, người yêu cầu không tự duyệt được, người giao không tự xác nhận nhận được. | **Gói nằm trên cùng ổ đĩa với T1 trong DEV** (cho phép và ghi vào hồ sơ yêu cầu; TEST và PROD từ chối). Chưa thử ghi ra USB/ổ cắm thật, tape. **Chưa có Register Imported Set** (nhập gói trở lại để restore, 6.5.5) và chưa có quy trình đọc gói trên máy sạch bằng công cụ của eQMS: hiện chỉ kiểm bằng `verify-chain.sh` và giải mã tay bằng gpg. Cổng nghiệm thu "gói Export restore được trên máy sạch" **chưa thực hiện** (cần P3). Chưa có **legal hold**: cột `holds_legal_hold` có và chặn hủy/tái sử dụng nhưng không có chức năng nào đặt nó. Chưa cảnh báo khi chỉ còn một phương tiện hợp lệ, quá hạn kiểm tra đọc hằng quý hoặc phương tiện sắp hết hạn (cần engine cảnh báo, mục 21). Chưa có thao tác hủy yêu cầu đã duyệt đang chạy, hay xuất lại tự động khi phương tiện bị cách ly. Biên nhận ký bằng cùng khóa ký manifest; chưa có khóa ký riêng. Xuất tuần tự trong một job, chưa có tiến độ phần trăm. Chưa chạy luồng này từ trình duyệt bằng hai tài khoản thật. |
| P2 / WP2.5 Màn hình Backup Policy, Storage & Encryption, Retention, nút Export | XONG (chưa xem bằng trình duyệt thật) | **Backup Policy**: nối thật (danh sách version, màn chi tiết, màn đề xuất). **Storage & Encryption**: nối thật, gồm Backup Targets (Test), Encryption (chỉ đọc), Offline Media Register (tìm kiếm/lọc/sắp xếp/phân trang phía server, Custom Column, đăng ký phương tiện), Export Requests (duyệt/từ chối, tự làm mới khi gói đang dựng) và màn **Offline Medium** riêng (thông tin, gói đang chứa, lịch sử; bàn giao, xác nhận nhận, kiểm tra đọc, xóa an toàn và dùng lại, ngừng dùng). Nút **Export Backup Set** ở Backup Details. **Retention**: nói rõ "Vĩnh viễn" (BR-2), chỉ đọc. Test frontend 156 đạt, tsc sạch trừ 2 lỗi cũ ở `ReportLists.test.tsx`. | Màn Encryption chỉ hiện định danh khóa và trạng thái khóa; cơ chế người giữ khóa đã bỏ (mục 8.4). Công tắc "mã hóa mọi backup" và "xoay khóa" của bản mẫu đã bỏ vì không có chức năng thật (mã hóa không tắt được; chưa có xoay khóa). Màn **Retention không có legal hold** và có thông báo nói rõ. **Chưa có biểu đồ dung lượng/dự báo đầy** (6.3) và chưa có "lần kiểm thử gần nhất" bền. Chưa có Export Requests nằm ở danh sách riêng ngoài màn Storage. Chưa kiểm bằng trình duyệt thật. |
| Nối UI cho dữ liệu đích và object | MỘT PHẦN | Màn Backup Details hiện thành phần `OBJECT_STORE` và vị trí T1/T2/T3; màn Storage nối API đích và Test (quyền `backup.admin.storage.test`). | Màn Backup Details chưa hiện số version và dung lượng mới của phần tài liệu, chưa hiện các lần Export của bản backup đó. |
| Kiểm thử đầu-cuối tự động cho P2 | MỘT PHẦN | `scripts/backup/p2-export-e2e.sh` (export và phương tiện, 16 bước, chạy thật) | Chưa có script cho backup tài liệu + đích T3 + policy (hiện làm tay, lệnh ghi ở hồ sơ). Chưa có test khởi động Spring context của agent: lỗi D-1 (hai constructor) chỉ lộ khi chạy container. |
| Việc phát sinh từ P2, chuyển sang giai đoạn sau | CHƯA LÀM | — | **Register Imported Set** và đọc gói trên máy sạch (P3/P6). **Legal hold** (đặt/gỡ, người thứ hai, quyền `backup.hold.manage`). **Xoay khóa**. **Cảnh báo** thiếu phương tiện, quá hạn đọc, đích đầy/dự báo, kiểm thử đích quá hạn, xác nhận cảnh báo đã xử lý. **Tài khoản MinIO chỉ-đọc** cho agent. **Tần suất lịch khác daily**, backup tăng dần, backup trước thay đổi tự động, số lần thử lại trong policy. **FILE_STORAGE và CONFIGURATION** trong phạm vi policy. **Kiểm tra băm đầy đủ định kỳ** (V2) cho tài liệu cũ. **Sao chép song song** và truy vấn "đã biết" theo trang khi dữ liệu lớn. |
| P3 trở đi (restore vào validation, khóa hệ thống, Super Administrator, restore production, WAL, DR, thanh tra) | CHƯA BẮT ĐẦU | — | Toàn bộ màn hình restore còn là dữ liệu mẫu. |

**Điều cần nhớ khi đọc bảng:** backup hiện có **chỉ chứng minh được toàn vẹn và giải mã được** (V1 + giải mã thử bằng khóa riêng ở DEV). Chưa có lần restore nào từ backup object, nên **chưa được coi là khôi phục được** cho đến khi P3 hoàn tất và OQ liên quan đạt.

## 24 Quyết định, rủi ro, giới hạn

### 24.1 Quyết định cần chốt

| ID | Câu hỏi | Đề xuất mặc định |
| --- | --- | --- |
| BR-1 <br> ĐÃ CHỐT: RPO ≤ 15 phút; RTO đo sau diễn tập đầu tiên | RPO và RTO từng kịch bản; có bật WAL không | Bật WAL; RPO ≤ 15 phút; RTO chốt sau diễn tập đầu tiên |
| BR-2 <br> ĐÃ CHỐT: KHÔNG THỜI HẠN | Thời hạn lưu từng loại backup | **Không thời hạn (vĩnh viễn)**, cho mọi loại backup trên môi trường production. Xem hệ quả ở mục 6.4 |
| BR-3 <br> ĐÃ CHỐT (mặc định) | Restore từng bản ghi vào production | Không; qua validation + change control |
| BR-4 <br> ĐÃ CHỐT (mặc định) | Bảng/nhật ký loại khỏi backup | Không loại gì; nhật ký theo chính sách riêng |
| BR-5 <br> ĐÃ CHỐT (mặc định) | Môi trường validation, bucket không khóa | Có, bắt buộc |
| BR-6 <br> ĐÃ CHỐT: người dùng chọn trong Administration | Đích ngoài cơ sở và bất biến | Do người dùng khai báo ở Backup Storage & Encryption; mỗi thay đổi có **e-sign + audit**. Hệ thống kiểm tra thật (ghi/đọc/thử xóa) trước khi chấp nhận cờ ngoài cơ sở và bất biến |
| BR-7 <br> ĐÃ CHỐT: người dùng chọn trong Administration | Ai là DR Authority | Do người dùng chọn ở Disaster Recovery Plan (tối thiểu hai người); mỗi thay đổi có **e-sign + audit** |
| BR-8 <br> ĐÃ BỎ (2026-10-09) | Người giữ khóa mã hóa | Không có cơ chế người giữ khóa và không có bước hai người cùng giải mã. Quyền restore nằm trong Access Profile: yêu cầu, duyệt, thực thi (mục 9.1). |
| BR-9 <br> ĐÃ CHỐT (mặc định) | Dự báo tăng trưởng, kế hoạch mở rộng | Đánh giá hằng năm |
| BR-10 <br> ĐÃ CHỐT (mặc định) | Bước nào cần e-sign | Đổi policy, duyệt và xác nhận restore, tuyên bố DR, gỡ legal hold |
| BR-11 <br> ĐÃ CHỐT (mặc định) | Chu kỳ V2, V3, V4 | Tuần, tháng, quý |
| BR-12 <br> ĐÃ CHỐT (mặc định) | Hạn nộp báo cáo sau sự cố DR | Chưa đặt |
| BR-13 <br> ĐÃ CHỐT (mặc định) | Số phương tiện ngoại tuyến, chu kỳ xuất, thời hạn giữ, chu kỳ kiểm tra đọc | ≥ 2 phương tiện luân phiên; xuất hằng tuần; kiểm tra đọc hằng quý; thời hạn giữ theo BR-2 |
| BR-14 <br> ĐÃ CHỐT (mặc định) | Export ra phương tiện có cần người thứ hai duyệt không | Có |
| BR-16 | Số phút thông báo mặc định và giới hạn; n cho DR | **Đã chốt: 10 phút** (chủ dự án); giới hạn 5-240; DR 0-5 |
| BR-17 | Tài khoản độc lập với bảng người dùng | **Đã chốt:** một tài khoản Super Administrator, lưu ngoài DB eqms (mục 11.6); thay thế tài khoản bảo trì |
| BR-19 | Super Administrator có bỏ qua quy tắc hai người không | **Đã chốt: phương án A.** Super Administrator làm được mọi thao tác nhưng chỉ tính là một người ở các bước cần hai người |
| BR-18 | Restore vào validation có áp dụng khóa và đăng xuất không | **Đã chốt: Có** (chủ dự án). Cổng khóa và Maintenance Gate chạy trong từng môi trường; số phút thông báo n có thể cấu hình riêng cho validation |
| BR-15 <br> ĐÃ CHỐT sau P0: bảng bí danh | Cơ chế giữ tham chiếu object khi dựng lại MinIO | **Bảng bí danh phiên bản** là cơ chế bắt buộc (không sửa bản ghi nào; xem 11.4 và `docs/plans/BACKUP_SPIKES.md`). Nhân bản MinIO chỉ là tối ưu hóa tùy chọn, xét lại sau khi kiểm chứng đường dựng lại site |

### 24.2 Rủi ro tồn đọng

- **Backup vĩnh viễn (BR-2):** dung lượng chỉ tăng; cần ngân sách mở rộng đích và quy trình dự báo hằng năm.
- **Khóa vĩnh viễn:** dữ liệu thử đưa nhầm vào `eqms-gmp-records` tồn tại 100 năm. Cần quy trình kiểm tra trước khi tải lên và dự báo dung lượng.
- **Quy định bảo vệ dữ liệu cá nhân (quyền xóa)** có thể xung đột với lưu giữ cố định trong backup bất biến; cần ý kiến pháp lý/QA.
- **Mất khóa** là rủi ro không có cách cứu; phụ thuộc kỷ luật quản lý khóa.
- **Độ phức tạp vận hành** tăng (thêm 3-4 container); cần người chịu trách nhiệm vận hành và đào tạo.
- Thư mục `verification/` đã tồn tại trong `eqms-gmp-records` (ngoại lệ ghi nhận) không xóa được; Backup phải bao gồm nó như mọi object khác.

### 24.3 Chưa kiểm tra

- Dữ liệu nào trong DB được mã hóa bằng bí mật của ứng dụng (nếu có, mất bí mật đó thì restore xong vẫn không đọc được).
- Cách `local`/`nas` thực sự được cấu hình ở môi trường triển khai.
- OnlyOffice có phiên soạn thảo chưa lưu cần xử lý trước bảo trì.
- Tên bảng cụ thể cho `backup_impact_probe` (cần đối chiếu schema thực tế khi làm P4).
- Khả năng của MinIO phiên bản hiện dùng với tài khoản dịch vụ chỉ-đọc-theo-version trên mọi bucket (cần thử ở IQ-01).
- Số liệu dung lượng là của máy dev.
- Số điều khoản Annex 11 và PI 041 trong mục 14.4 chưa được QA xác nhận.
- Cấu trúc bảng `audit_logs` (khóa ngoại tới người dùng) và cách ghi chủ thể Super Administrator mà không phụ thuộc hàng trong DB eqms (mục 11.6.4).
- Cách đặt chip đếm ngược trong `Header.tsx` ở các độ rộng màn hình nhỏ (cụm bên phải đã chật ở mobile).
- Đường dựng lại site MinIO chính từ site phụ qua nhân bản (cần thao tác gỡ cưỡng bức qua API quản trị; `mc` không còn được phân phối).
- Dung lượng WAL mỗi ngày trên tải thật (S3 chỉ đo chức năng).
- Cách yêu cầu OnlyOffice Document Server lưu và đóng các phiên soạn thảo khi bắt đầu khóa (mục 11.5.4).
- Cơ chế phiên hiện tại lưu trong bảng `AuthSession` của DB eqms (có `revokedAt`) ĐÃ KIỂM TRA: AuthTokenFilter; cần xác nhận cách thêm *session epoch* mà không đổi hành vi đăng nhập hiện có.

### 24.3 Backup & Restore làm nguồn báo cáo (REPORT-PLATFORM-2026-10-15, ĐỀ XUẤT, chưa làm)

**Bối cảnh.** Chủ dự án (2026-10-15) chọn ba nguồn cho báo cáo theo thứ tự: Document Control, Audit Trail, Backup & Restore. Hai nguồn đầu đã làm trên DEV (SDS-RP-001, mục 5.7 và 5.8); nguồn thứ ba chưa bắt đầu và tạm dừng cùng module Report.

**Cách Report dùng một nguồn.** Mỗi nguồn là một Report Type viết trong mã (một `ReportMetadataProvider`) với: cột, bộ lọc, truy vấn đã được kiểm duyệt, quyền cần có (`requiredPermissions` cần tất cả, `usePermissions` cần một trong), phạm vi dữ liệu được phép (`allowedScopes`) và kiểm tra khi chạy (`validateRun`, ví dụ khoảng ngày bắt buộc). Người quản trị chỉ bật hoặc tắt type ở màn Report Types.

**Đề xuất cho nguồn Backup & Restore (cần quyết định trước khi làm):**

| Mục | Đề xuất | Ghi chú |
| --- | --- | --- |
| Quyền | `backup.module.view`; cần xem thêm quyền xuất (`backup.backup.export`) khi chạy báo cáo vì kết quả là một file | **QUYẾT ĐỊNH** (chưa chốt) |
| Phạm vi | Chỉ `SYSTEM` | Backup không chia theo phòng ban |
| Nội dung | Lần backup (mã, loại, trạng thái, thời điểm, kích thước, kết quả kiểm tra V1/V2), yêu cầu restore (mã, loại, trạng thái, người yêu cầu, người duyệt, thời điểm), kết quả diễn tập, cảnh báo | Chỉ cột đã hiển thị trên màn hình tương ứng |
| **Không bao giờ là cột** | Khóa mã hóa và tài liệu khóa, thông tin xác thực của đích lưu trữ, địa chỉ kho, đường dẫn hoặc khóa đối tượng, mã băm nội bộ của sổ cái | Cùng nguyên tắc với Audit Trail: không đưa giá trị nhạy cảm vào báo cáo |
| Khoảng thời gian | Bắt buộc, có giới hạn như báo cáo Audit Trail (hiện đề xuất 92 ngày, chờ xác nhận) | |
| Nơi đọc dữ liệu | **CHƯA BIẾT.** Dữ liệu điều khiển nằm ở DB `eqms_backup_control` (mục 17) do agent giữ, ngoài DB `eqms` mà backend báo cáo đang đọc; backend hiện đọc qua `BackupAgentClient`. Cần chọn: (a) agent cung cấp một API đọc có phân trang cho báo cáo, hay (b) bản đọc chỉ-đọc của DB điều khiển. Chưa chọn. | **QUYẾT ĐỊNH** (chủ dự án trả lời "chưa biết") |
| Chữ ký | Chạy báo cáo không có chữ ký điện tử; chỉ có chữ ký duyệt mẫu và bản ghi lần chạy. Cần QA xác nhận (cùng câu hỏi như báo cáo Audit Trail) | **QUYẾT ĐỊNH** |

**Điều chưa làm:** toàn bộ bảng trên. Khi chủ dự án yêu cầu làm tiếp, bắt đầu bằng việc xác định nơi đọc dữ liệu (dòng "Nơi đọc dữ liệu"), rồi mới viết provider, test âm tính (không có quyền, cột nhạy cảm, khoảng ngày) và bản ghi thay đổi (`08_ONE_CHANGE_RECORD_TEMPLATE.md`).
