SDS-BR-004 · Bản nháp 0.1 · 2026-11-10

# SDS-BR-004 Phương án cải tiến Backup & Restore: hai loại, kiểm nội dung file

**Trạng thái:** ĐỀ XUẤT, chủ dự án đã đồng ý hướng đi ngày 2026-11-10. Phần §6 (nơi lưu backup) đã làm xong ngày 2026-11-10; các việc ở §3 chưa làm.
**Thay thế:** phần "ba phần của một backup" (cài đặt, database, file) trong `BACKUP-RESTORE-PARTS-2026-11-10` của `DECISION_LOG.md`.
**Nhãn:** ĐỀ XUẤT = thiết kế của người soạn. QUYẾT ĐỊNH = chủ dự án / QA phải chốt.

## 1 Vì sao cải tiến

1. Các hệ thống thông dụng chỉ có hai loại: backup nguyên cơ sở dữ liệu (metadata) và backup file. Restore dùng đúng hai loại đó. Phần "System settings" riêng làm phức tạp mà không thêm giá trị: bản backup database đã chứa sẵn cài đặt.
2. Phần "System settings" buộc phải phân loại 219 bảng, và restore riêng nó chưa làm được (cần quyền ghi theo bảng và cách đảm bảo nguyên tử).
3. Có một lỗ hổng toàn vẹn thật: restore file hiện chỉ hỏi "phiên bản này có tồn tại không". File có mặt nhưng nội dung khác hoặc hỏng thì không bị phát hiện.

## 2 Phương án

### 2.1 Hai loại, mặc định cả hai

| Loại | Gồm | Backup | Restore |
| --- | --- | --- | --- |
| **Database** | Mọi dữ liệu có cấu trúc, gồm cả cài đặt | `pg_dump` đầy đủ, ký, mã hoá | Dựng DB mới, kiểm tra, hoán đổi tên; giữ DB cũ để quay lui đến khi chốt |
| **Files** | Mọi file lưu ở MinIO | Chỉ sao chép phiên bản mới (tăng dần), kiểm SHA-256 | Bổ sung file thiếu; **kiểm nội dung file đã có** (2.3); không ghi đè |

- Mặc định chọn cả hai (backup "full"). Người dùng có thể chọn riêng một loại.
- Backup tăng dần cho database (WAL, khôi phục theo thời điểm) **chưa cần**: dump đầy đủ 160 MB mất khoảng 10 giây. Xem lại khi DB lên hàng chục GB hoặc cần mất tối đa vài phút dữ liệu.

### 2.2 Giữ nguyên phần toàn vẹn giữa các bản backup

- Manifest có ký, nối chuỗi băm với bản trước, tự kiểm tra (V1) ngay sau khi ghi.
- Database chụp trước, file chụp sau, ghi chung một manifest (thời điểm DB và thời điểm file).
- Restore chỉ cho phép từ bản backup đã qua kiểm tra; ký điện tử, khoá bảo trì, nhật ký chuỗi băm, hồ sơ restore chỉ-thêm.
- **Mới:** khi một backup có cả hai loại, sau khi ghi xong kiểm mọi tham chiếu file trong DB (các cột đã đăng ký) có trong chỉ mục file. Thiếu thì backup đánh dấu cảnh báo (vẫn restore được theo quyết định đã có), không im lặng.

### 2.3 Kiểm nội dung file (phần mới quan trọng nhất)

**Nguyên tắc:** mỗi phiên bản file là bất biến (ứng dụng luôn tạo phiên bản mới, không ghi đè). Vì vậy cùng mã phiên bản mà nội dung khác chỉ có thể là hỏng hoặc bị can thiệp, không phải cập nhật hợp lệ.

Ba lớp kiểm:
1. **Kích thước:** so kích thước kho với chỉ mục backup. Gần như không tốn gì; chạy mỗi lần restore file.
2. **SHA-256 đầy đủ:** đọc file và băm, so với chỉ mục backup. Chạy khi restore file và định kỳ (2.4).
3. **Tham chiếu độc lập trong DB:** với tài liệu đã hiệu lực, so với mã băm lưu lúc ký (`document_checksum_after_sign`, `source_file_checksum`). Bắt được trường hợp file hỏng ngay từ trước lần backup đầu, khi chỉ mục chỉ ghi lại chính nội dung hỏng.

**Khi phát hiện lệch:**
- Không ghi đè (kho không cho và không nên).
- Cảnh báo mức cao, liệt kê file lệch (kho, khoá, phiên bản, kích thước và băm mong đợi so với thực tế).
- Khi **restore có ký**, bản đúng từ backup được thêm như phiên bản mới, kèm dòng alias từ mã phiên bản cũ sang bản mới; mọi tham chiếu trong DB vẫn đúng. Mỗi file được sửa ghi vào nhật ký chuỗi băm và hồ sơ restore.
- Nếu backup cũng không có bản đúng (chỉ mục không khớp hoặc bản đã hỏng): báo "không sửa được", không im lặng, và restore đánh dấu cảnh báo.

### 2.4 Kiểm kho định kỳ (scrub)

- Mỗi tuần (QUYẾT ĐỊNH: tần suất) đọc kho thật và so với chỉ mục của backup mới nhất và mã băm trong DB. Chỉ báo cáo, không tự sửa.
- Kết quả là cảnh báo và một bản ghi (số file kiểm, số lệch, thời gian chạy), hiển thị ở Backup Status Overview.
- Đọc theo từng đợt, giới hạn tốc độ để không làm chậm ứng dụng.

### 2.5 Bỏ khỏi phần mềm

- Thành phần `CONFIGURATION` (System settings) của backup: mã, hai danh sách bảng, ô chọn trên giao diện, test, từ chối "chỉ cài đặt".
- Các backup đã tạo có thành phần này (hôm 2026-11-09) **vẫn hợp lệ và không bị xoá** (backup giữ vĩnh viễn, chuỗi băm). Khi restore, thành phần này được bỏ qua và nói rõ là phần cài đặt nằm trong database.

## 3 Việc cần làm

| # | Việc | Nơi |
| --- | --- | --- |
| 1 | Gỡ `CONFIGURATION`: backup, restore, API, giao diện, test, tài liệu | agent, backend, giao diện |
| 2 | Kiểm kích thước và SHA-256 file đã có khi restore; alias cho file lệch; hồ sơ từng file sửa | agent (`MissingFileRestorer`) |
| 3 | Kiểm tham chiếu DB so với chỉ mục khi backup đủ hai loại; cảnh báo | agent |
| 4 | Lượt kiểm kho định kỳ, bản ghi kết quả, cảnh báo, hiển thị ở Overview | agent, backend, giao diện |
| 5 | Mã băm lúc ký làm tham chiếu thứ ba | agent |
| 6 | Cập nhật Decision Log, SDS-BR-003, tên màn hình và hộp thoại | tài liệu, giao diện |
| 7 | Diễn tập trên DEV có bằng chứng, gồm một ca file lệch giả lập trên bucket thử `eqms-test-*` (không đụng bucket thật) | DEV |

Mỗi thay đổi có test âm tính: file lệch kích thước, file lệch nội dung cùng kích thước, file thiếu, chỉ mục thiếu bản đúng, backup đã hỏng.

## 4 Chờ quyết định

1. **Restore chỉ file:** cấp cho tài khoản restore quyền đọc và thêm alias trên DB đang chạy (đã mô tả trong `deploy/backup/restore-swap-role.sql`), hay chỉ cho phép restore file cùng với database? ĐỀ XUẤT: cấp quyền hẹp (đọc, và thêm vào một bảng), vì có file lệch mà không phải restore cả database là ca thường gặp.
2. **Tần suất kiểm kho:** hàng tuần là đề xuất; hàng đêm nếu kho nhỏ.
3. **Sửa file lệch:** chỉ trong restore có ký (đề xuất), hay có thêm thao tác "sửa file lệch" riêng không cần restore database.
4. **Giữ DB `_pre_` và `_post_` bao lâu** và ai được xoá; hiện phần mềm không xoá.
5. **Người restore có tự chốt không** (hiện cho phép).

## 5 Giới hạn còn lại (nói rõ)

- File hỏng ngay từ trước lần backup đầu chỉ bắt được khi có mã băm lúc ký trong DB (tài liệu đã hiệu lực). Với file loại khác không có mã băm độc lập, chỉ mục lần đầu là điểm tựa duy nhất.
- Kiểm SHA-256 đầy đủ đọc toàn bộ kho; thời gian tỷ lệ với dung lượng.
- Backup tăng dần database chưa có; mất tối đa khoảng thời gian giữa hai backup (hiện hằng ngày 19:00).

## 6 Quyết định ngày 2026-11-10 về nơi lưu và những thứ không làm

Chủ dự án quyết định, ghi trong `DECISION_LOG.md` (`BACKUP-RESTORE-TARGETS-2026-11-10`):

- **Giữ giải pháp cũ** (dump database hằng ngày, file tăng dần, ký, chuỗi băm). **Không làm** snapshot, **không làm** export / tải xuống / tải lên gói, **chưa làm** lưu WAL liên tục (PITR); mất dữ liệu tối đa bằng khoảng cách giữa hai backup vẫn là giới hạn đã ghi ở §5.
- **Mọi backup ghi ra T1 trước.** T2 chỉ nhận bản đã hoàn tất, đã mã hoá, đã ký, rồi đọc lại so SHA-256.
- **T2 là NAS dùng SMB, máy chủ Windows.** Docker gắn chia sẻ bằng volume CIFS (`docker-compose.backup-t2-smb.yml`); agent ghi vào một thư mục. **Chưa thử với NAS thật.**
- **Bỏ T3** (MinIO thứ hai có Object Lock): file compose, dịch vụ, volume, mật khẩu, công cụ tạo bucket. Bản chép thứ ba do chủ dự án làm thủ công.
- **Quy tắc 3 bản chấp nhận "bản chép thủ công" đã khai báo** trong chính sách (nơi cất, người làm, chu kỳ ngày). Phần mềm không thấy và không kiểm tra được nó: đó là lời khai của một người. **Chưa làm:** ghi lại lần chép thủ công gần nhất và cảnh báo khi quá hạn.
- **Chép bù khi NAS tắt:** mỗi 10 phút agent thử NAS; khi NAS trả lời lại, chép các backup đã bỏ lỡ (mới nhất trước, chỉ bản đã qua kiểm tra V1). Cảnh báo một lần khi NAS mất kết nối, không lặp lại. NAS treo thì bỏ sau 60 giây. Mỗi lần thử là một dòng trong bảng vị trí (migration V25), dòng thất bại được giữ làm bằng chứng.
- **Khoá giải mã và khoá ký không được đặt trên bất kỳ đích nào**; bản chép khoá cất ngoại tuyến do chủ dự án làm.

### Chưa kiểm chứng
- Gắn thật bằng SMB từ Docker trên Windows, quyền ghi, tốc độ, ngắt mạng giữa chừng: cần thử khi có NAS (bấm Test ở T2 trong Storage & Encryption trước).
- Cách agent xử lý khi chia sẻ bị ngắt giữa lúc đang chép một bản lớn: được kiểm bằng thư mục giả lập (ghi tạm `.partial` rồi đổi tên; lỗi thì thử lại ở lượt sau), chưa bằng NAS thật.

## 7 Tình trạng thực hiện ngày 2026-11-11

Đối chiếu với bảng ở mục 3. Chỉ ghi những gì đã chạy và được kiểm.

| # | Việc | Tình trạng | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Gỡ `CONFIGURATION` | **Xong.** Backup mới và restore mới từ chối phần này bằng mã riêng (`BACKUP_COMPONENT_REMOVED`, `RESTORE_SETTINGS_PART_REMOVED`); giao diện không còn ô chọn; backup cũ vẫn hợp lệ, restore bỏ qua phần đó và nói rõ. | `BackupComponentsTest`, `ProductionRestoreTest`, `BackupsView.test.tsx` |
| 2 | Kiểm kích thước và SHA-256 file đã có khi restore; alias cho file lệch; hồ sơ từng file | **Xong** (`MissingFileRestorer`). File lệch không bị ghi đè: nội dung đúng được thêm thành phiên bản mới kèm alias; file mà backup cũng không có bản đúng được liệt kê "không sửa được" (cảnh báo). Mỗi file nằm trong kết quả bước R8. | `MissingFileRestorerTest` (5 ca mới: đúng, lệch kích thước, lệch nội dung cùng kích thước, backup cũng lệch, bucket chỉ đọc) |
| 3 | Kiểm tham chiếu DB so với chỉ mục khi backup đủ hai loại | **Xong.** Cảnh báo `BACKUP_REFERENCE_MISSING`, backup vẫn hợp lệ. | `StoreScrubServiceTest` |
| 4 | Lượt kiểm kho định kỳ, bản ghi, cảnh báo, hiển thị ở Overview | **Xong.** Chủ nhật 03:30 và nút Check Now; bảng `store_scrub_run`; thẻ File store check ở Overview. Chạy thật trên DEV: 2651 file, 514 MB, 0 khác biệt. | `StoreScrubServiceTest` (12 ca), chạy thật trên DEV |
| 5 | Mã băm lúc ký làm tham chiếu thứ ba | **Xong ở mức** `document_revisions.source_file_checksum` (mã băm app lưu khi lưu file nguồn), so với nội dung backup giữ. **Chưa** dùng `electronic_signatures.document_checksum_after_sign`: chưa xác minh cột này được tính trên file nào và liên kết với phiên bản nào trong kho; cần đọc luồng ký trước khi đối chiếu. | `StoreScrubServiceTest` |
| 6 | Cập nhật Decision Log, SDS | Decision Log `BACKUP-FINISHING-2026-11-11`. SDS-BR-001 vẫn là bản gốc, nhiều chỗ còn nhắc T3 và Export: đọc kèm mục 6 này và Decision Log. | |
| 7 | Diễn tập trên DEV với ca file lệch giả lập trên bucket thử `eqms-test-*` | **Chưa.** Các ca file lệch được kiểm bằng kho giả lập trong test, chưa bằng bucket thử thật. | |

Các quyết định mở ở mục 4 vẫn chờ chủ dự án, trừ tần suất kiểm kho đã chạy theo đề xuất hàng tuần.

### Bổ sung ngày 2026-11-11 (sau khi chủ dự án đồng ý)

| # | Việc | Tình trạng | Bằng chứng |
| --- | --- | --- | --- |
| 8 | **Lịch backup riêng cho file** | **Xong.** Policy có thêm `schedule.files` (tùy chọn, hằng ngày, giờ riêng). Bật thì scheduler tạo hai lượt riêng: lượt database chỉ chứa DATABASE, lượt file chỉ chứa OBJECT_STORE; mỗi lần một job. Tắt hoặc không có thì file đi cùng lượt database như cũ. Lượt định kỳ cũ đã chứa phần đó vẫn được tính là đủ, nên bật lịch riêng không tạo thêm backup thừa. Cảnh báo `BACKUP_MISSED` kiểm theo từng phần. Màn Policy (đề xuất, danh sách, chi tiết) và Schedules hiển thị. Chạy thật trên DEV: policy v8 kích hoạt bằng chữ ký, scheduler tạo `BK-20261111-1645-0003` chỉ chứa OBJECT_STORE, hoàn tất và được tự động verify. | `SchedulerQueueAndTokenTest` (4 ca mới), `PolicyServiceTest` (2 ca mới), `BackupPolicy.test.tsx` (1 ca mới) |
| 9 | Hộp thoại Restore a Backup dạng bảng (5 dòng/trang, cột checkbox, phân trang server) | **Xong**, đã chụp màn hình trên DEV (`evidence-policy/42`). | `ProductionRestoreDialog.test.tsx` (5 ca) |
| 10 | Runbook rollback tay khi ứng dụng không chạy được | **Đã viết** (`RUNBOOK-BR-001-rollback-ngoai-he-thong.md`); chuỗi lệnh đổi tên database đã chạy thử trên database tạm. **Chưa** chạy trên database thật; cách gỡ khóa bảo trì khi ứng dụng chết chưa xác minh. | chạy thử trên `rbtest_live` |

**Chưa làm, và vì sao.**
- **Restore thật có phần Files, và Finalize:** trên DEV đã có hai lần Restore thật (09/11, đều hoán đổi rồi Rollback). Chưa có lần nào gồm phần Files hoặc kết thúc bằng Finalize. Một lần Restore thật cần khóa hệ thống bằng Super Administrator, mà mật khẩu tài khoản đó không có trong phiên làm việc này; cần chủ dự án khóa hoặc cung cấp.
- **NAS thật (T2) qua SMB**, **e-mail cảnh báo tới hộp thư thật**, **bộ test backend đầy đủ**, **`document_checksum_after_sign`**: như đã nêu ở các mục trên.
- **Chạy GitNexus `detect_changes` trước commit:** công cụ GitNexus không có trong phiên này; chưa chạy.

