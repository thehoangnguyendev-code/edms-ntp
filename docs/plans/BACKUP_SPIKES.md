# Backup & Restore: kết quả thử nghiệm P0 (Spike S1 đến S4)

Ngày: 2026-10-08. Môi trường: **DEV** (PC phát triển). Chỉ dùng container và volume tạm, cơ sở dữ liệu tạm; không đụng bucket `eqms-gmp-records` hay `eqms-templates`.
Nhãn: **[ĐÃ ĐO]** chạy thật và có số liệu; **[ĐỌC CODE]** đọc mã nguồn; **[CHƯA KIỂM CHỨNG]** chưa làm được.
Mã chạy lại: `scripts/spikes/backup/` (kèm `s2_partAB.json`).

## Tóm tắt các kết luận và thay đổi thiết kế

| Spike | Kết luận | Tác động lên SDS |
|---|---|---|
| S1 | Tham chiếu phiên bản file nằm ở **14 cột của 12 bảng**, trong đó 3 cột nằm trong `electronic_signatures`, bảng này bị **trigger cấm UPDATE/DELETE/TRUNCATE** | Cơ chế "sửa tham chiếu trong DB" (cách B) **bị loại**. Thay bằng **bảng bí danh phiên bản** (alias), không sửa bản ghi nào |
| S2 | Không thể chọn `versionId` khi ghi. Nhân bản site của MinIO **giữ nguyên** `versionId`, cấu hình khóa và hạn COMPLIANCE; đích từ chối xóa. Chiều ngược (dựng lại site chính từ site phụ) **chưa kiểm chứng được** | Bảng bí danh là cơ chế **bắt buộc**; nhân bản chỉ là tối ưu hóa tùy chọn, không phụ thuộc vào nó |
| S3 | WAL archiving và khôi phục tới một thời điểm trên PostgreSQL 17 chạy đúng | P5 khả thi; phải nén WAL |
| S4 | `pg_dump -Fc` 6 giây, restore 8 giây, 134 bảng và 594.929 dòng trùng khớp | Mốc tham chiếu cho RTO của DB; P1 khả thi |

## S1: chữ ký điện tử và tham chiếu file có dựa vào `versionId` không **[ĐỌC CODE] [ĐÃ ĐO]**

**Truy vấn schema thật** cho thấy các cột chứa `versionId` của MinIO:

| Bảng | Cột |
|---|---|
| `controlled_copies` | `controlled_copy_storage_version_id` |
| `controlled_copy_recall_items` | `storage_version_id` |
| `document_revision_template_lineage` | `source_storage_version_id` |
| `document_revisions` | `fillable_template_storage_version_id`, `source_storage_version_id` |
| **`electronic_signatures`** | `published_pdf_version_id`, `review_pdf_version_id`, `source_file_version_id` |
| `executed_records` | `storage_version_id` |
| `publishing_template_placeholder_styles` | `template_version_id` |
| `revision_publishing_metadata` | `published_pdf_version_id`, `publishing_preview_version_id` |
| `revision_snapshot_history` | `version_id` |
| `uncontrolled_copies` | `uncontrolled_copy_storage_version_id` |

Phát hiện:
1. `electronic_signatures` có trigger `prevent_electronic_signature_mutation` (V394) chặn **UPDATE, DELETE, TRUNCATE** ở cả mức câu lệnh và mức dòng. Lối thoát duy nhất là biến phiên `app.allow_audit_purge = 'true'`, dành cho việc purge có kiểm soát. Dùng nó để sửa `versionId` là **vô hiệu hóa kiểm soát toàn vẹn của chữ ký**, không chấp nhận được.
2. Chữ ký lưu `documentChecksumBeforeSign` và `documentChecksumAfterSign` (SHA-256 nội dung) cùng các `versionId`. Bản ghi chữ ký **không có** cột băm toàn bản ghi, nên đổi `versionId` không làm hỏng một giá trị băm nào, nhưng nó **làm bằng chứng "đã ký đúng phiên bản X" trỏ vào chỗ không còn tồn tại**.
3. Vì vậy sửa tham chiếu không dùng được ít nhất cho chữ ký. Ngay cả với bảng khác, số cột (14) và việc phải quét đủ mọi nơi làm cách này dễ sót.

**Thiết kế thay thế (cách C): bảng bí danh phiên bản.** Sau khi dựng lại MinIO từ file, mỗi object được ghi lại và nhận `versionId` mới. Hệ thống ghi một dòng vào bảng mới `object_version_alias (bucket, object_key, original_version_id, current_version_id, sha256, restore_request_id, created_at)`; **không sửa bản ghi nào** trong 12 bảng trên. Đường đọc file của `MinioObjectStorageService` khi gặp `versionId` không còn tồn tại sẽ tra bảng bí danh, lấy `current_version_id`, **đọc xong phải kiểm lại SHA-256** với giá trị đã lưu trong bản ghi. Chữ ký giữ nguyên `versionId` gốc làm bằng chứng; SHA-256 chứng minh nội dung là cùng một file.
Đánh đổi: thêm một bước tra cứu ở đường đọc, và bảng bí danh trở thành dữ liệu cần backup. Đổi lại: không sửa bản ghi bất biến, không phải liệt kê hết cột chứa tham chiếu.

## S2: MinIO `RELEASE.2025-04-22` và `versionId` **[ĐÃ ĐO]**

Hai MinIO tạm (`spike-s1`, `spike-s2`) trong mạng tạm; bucket `spike-*`; tài khoản tạm. Đã xóa sau thử nghiệm.

| Phép thử | Kết quả |
|---|---|
| Ghi cùng một khóa hai lần | Hai `versionId` khác nhau |
| Sao chép trên server sang bucket khác | `versionId` mới, khác nguồn |
| Gọi ghi kèm `versionId` do người gọi chọn (header `x-amz-version-id`) | **Bị bỏ qua**, MinIO tự sinh |
| Nhân bản site (site replication), object có sẵn | **Cùng `versionId`** ở site phụ (3/3 phiên bản) |
| Bucket có khóa tạo sau khi đã nhân bản | Xuất hiện ở site phụ, **cùng `versionId`**, giữ chế độ `COMPLIANCE` và hạn retention |
| Xóa phiên bản bị khóa ở site phụ | **Bị từ chối** (`InvalidRequest`) |
| Dựng lại site chính từ site phụ (xóa site chính, tạo site mới rỗng, nối lại) | **Chưa kiểm chứng.** Gỡ site đã mất khỏi nhóm trả lỗi 500 vì peer cũ không còn; cần thao tác "gỡ cưỡng bức" của MinIO |

Hạn chế quan trọng:
- Công cụ dòng lệnh `mc` **không còn được phân phối công khai** (bản tải về trả `410 Gone`; ảnh `minio/mc` không còn trên Docker Hub; `quay.io` yêu cầu xác thực). Mọi thao tác quản trị phải dùng SDK hoặc API quản trị trực tiếp, nên không thể dựa vào `mc` trong runbook. SDK Python có `MinioAdmin` nhưng **không có** gỡ cưỡng bức site.
- Nhân bản site sao chép **toàn bộ bucket và IAM**. Nếu dùng làm đích T3, bucket backup cũng bị nhân bản ngược về site chính (không mong muốn). Nhân bản theo từng bucket cần API quản trị `set-remote-target` mà chưa thử được.
- Nhân bản site tạo ràng buộc kết nối hai chiều giữa hai máy, trái với nguyên tắc "đích chỉ ghi".

**Kết luận BR-15:** dùng **bảng bí danh (cách C)** làm cơ chế bắt buộc, vì nó chạy với mọi nguồn (thư mục, NAS, ổ ngoại tuyến, MinIO). Nhân bản là tối ưu hóa tùy chọn, chỉ xét lại sau khi kiểm chứng đường dựng lại site và nhân bản theo bucket.

## S3: WAL archiving và PITR **[ĐÃ ĐO]**

PostgreSQL 17 trong container tạm (không phải `eqms-postgres`), `wal_level=replica`, `archive_mode=on`, `archive_command` sao chép sang volume, `archive_timeout=30`. Quy trình: tạo bảng và 1.000 dòng; `pg_basebackup`; thêm 2.000 dòng; ghi mốc thời gian T (3.000 dòng); thêm 3.000 dòng; chuyển WAL; dừng; dựng container mới từ base backup với `recovery_target_time = T`.
Kết quả: **3.000 dòng, 0 dòng sau T**. Khôi phục đúng mốc.
Lưu ý: mỗi đoạn WAL là 16 MB và `archive_timeout` ép chuyển đoạn khi có hoạt động; cần **nén WAL** trước khi gửi đi, và dung lượng/ngày chỉ biết khi đo trên tải thật. Compose hiện **chưa** bật `archive_mode`; bật cần khởi động lại Postgres một lần.

## S4: `pg_dump` / `pg_restore` trên DB DEV **[ĐÃ ĐO]**

| Chỉ số | Giá trị |
|---|---|
| Kích thước DB nguồn | 323 MB |
| `pg_dump -Fc` | 6 giây, tệp 85 MB (≈ 26%) |
| Mục lục dump đọc được không cần restore (`pg_restore --list`) | 1.028 mục |
| `pg_restore` vào DB tạm | 8 giây |
| Số bảng | 134 trong nguồn, 134 trong bản restore |
| Tổng số dòng | 594.929, **khớp từng bảng** |
| Phiên bản Flyway | 560 ở cả hai |

Ghi chú vận hành: để tính thời gian, script cài thêm tiện ích `bc` vào container `eqms-postgres` (lớp ghi tạm của container, không ảnh hưởng dữ liệu; mất khi container tạo lại). Nguồn chỉ được đọc; DB tạm đã xóa.
Số liệu này chỉ đúng cho DEV (322 MB); không ngoại suy cho PROD.

## Việc kéo theo

1. Cập nhật SDS: mục 11.4 (thay cách B bằng bảng bí danh), kiểm tra C13, bảng dữ liệu, test OQ-23 đến OQ-26, BR-15, danh sách "chưa kiểm tra".
2. Thay đổi code ở P3: đường đọc của `MinioObjectStorageService` (tra bí danh, kiểm SHA-256). Bắt buộc phân tích tác động trước khi sửa, vì đây là đường đọc mọi file.
3. P1 và P2 có thể bắt đầu; điều kiện "hoàn thành S1, S2" đã đạt.
4. Việc còn mở: kiểm chứng đường dựng lại site chính (nếu muốn dùng nhân bản), đo dung lượng WAL/ngày trên tải thật.
