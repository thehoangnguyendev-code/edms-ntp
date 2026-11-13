SDS-BR-003 · Bản nháp 0.1 · 2026-11-09

# SDS-BR-003 Cơ chế Backup & Restore hoàn chỉnh (bản gọn, không phê duyệt trong phần mềm)

**Trạng thái:** ĐỀ XUẤT, chưa được duyệt, chưa có thay đổi mã nguồn. Đi cùng SDS-BR-002 (phân loại dữ liệu). Khi được duyệt, tài liệu này thay các mục 9, 10, 11.3 của SDS-BR-001 (vai trò, phê duyệt, quy trình R0-R12).

**Phạm vi:** chỉ phần mềm. Quy trình phê duyệt, ai được phép restore và khi nào do tổ chức quyết bằng văn bản giấy; phần mềm **không có bước phê duyệt**, nhưng ghi lại ai làm gì, khi nào, vì sao.

**Nhãn:** ĐỀ XUẤT = thiết kế của người soạn. QUYẾT ĐỊNH = chủ dự án / QA phải chốt. ĐÃ CÓ = đã có trong `eqms-backup-agent` (đọc code 2026-11-09, chưa chạy lại).

## 1 Nguyên tắc

1. **Một bản backup chỉ dùng được khi đã kiểm chứng.** Chưa kiểm chứng xong thì không được chọn để restore.
2. **Restore không bao giờ sửa trực tiếp production trước khi mọi kiểm tra đạt.** Làm ở chỗ khác, kiểm tra, rồi mới chuyển.
3. **Không ghi đè, không trộn.** Database: dựng bản mới rồi hoán đổi. File: chỉ bổ sung.
4. **Mọi thứ cần chứng minh đều có băm SHA-256**, và băm của manifest được nối chuỗi vào sổ cái. ĐÃ CÓ.
5. **Không có đường tắt:** không có thao tác "bỏ qua kiểm tra".

## 2 Backup

Một thao tác "Backup" với 4 phạm vi (SDS-BR-002 mục 3): Đầy đủ, Chỉ Database, Chỉ File, Cấu hình. Chạy theo lịch hoặc chạy tay. Quyền chạy tay: một quyền riêng.

Các bước (agent):
1. **Kiểm tra trước:** đích còn chỗ, kết nối được, khóa mã hóa có, môi trường khớp. Lỗi thì dừng, không tạo bản dở.
2. **Database:** `pg_dump` trên snapshot nhất quán, ghi thời điểm `T_db`. ĐÃ CÓ.
3. **File:** sau database, sao chép version mới của từng object, kiểm SHA-256, ghi thời điểm `T_obj`. ĐÃ CÓ.
4. **Kiểm tham chiếu (ĐỀ XUẤT, mới):** mọi file mà DB tại `T_db` tham chiếu (bản ghi revision, bản copy, đính kèm, scan, bài kiểm tra) phải có trong tập file của bản backup hoặc trong chuỗi trước. Thiếu file thì backup **vẫn lưu** nhưng đánh dấu `CÓ CẢNH BÁO` và ghi danh sách file thiếu. Lý do: file thiếu đã tồn tại từ trước; không được che.
5. **Ghi manifest** (danh sách artifact, băm, `T_db`, `T_obj`, phiên bản ứng dụng, phiên bản Flyway, môi trường), mã hóa, ký, nối chuỗi sổ cái. ĐÃ CÓ.
6. **Kiểm chứng (ĐỀ XUẤT: tự động, bắt buộc):** đọc lại từ đích, kiểm băm từng artifact, `pg_restore --list` trên dump, so số bản ghi. Chỉ khi đạt mới chuyển trạng thái `VERIFIED`. Bản `FAILED` hoặc chưa kiểm chứng không được restore.

Trạng thái một bản backup: `RUNNING` → `VERIFIED` (hoặc `VERIFIED_WITH_WARNING`) hoặc `FAILED`. Bản backup bất biến: ứng dụng không có thao tác sửa hay xóa. QUYẾT ĐỊNH BR-2 (không thời hạn) giữ nguyên.

## 3 Restore (một luồng, không phê duyệt)

Người có quyền restore vào **Restore**, chọn bản backup `VERIFIED` và kiểu restore:

| Kiểu | Làm gì |
| --- | --- |
| Đầy đủ | Thay Database, bổ sung File |
| Chỉ Database | Thay Database, rồi kiểm tham chiếu file |
| Chỉ File | Chỉ bổ sung file thiếu hoặc hỏng, DB không đổi |
| Cấu hình | Tải gói cấu hình về, áp dụng thủ công (phần mềm không tự đổi cấu hình triển khai) |

**Màn hình xem trước (bắt buộc, chỉ đọc).** Hệ thống tính và hiện:
- thời điểm bản backup, tuổi của nó;
- dữ liệu sẽ **mất khỏi hệ thống đang chạy** vì phát sinh sau `T_db`: số bản ghi theo loại (tài liệu, revision, chữ ký, audit, người dùng...) — đã có logic tương tự trong Restore Impact Report (SDS-BR-001 mục 10.2);
- file sẽ bổ sung, file mồ côi (tạo sau `T_db`, được giữ);
- kiểm tra tương thích: phiên bản Flyway của bản backup phải **≤** phiên bản hiện tại và đã được ứng dụng biết; môi trường khớp (bản PROD không restore vào DEV hoặc ngược lại).

**Xác nhận (QUYẾT ĐỊNH 2026-11-09):** người thực hiện **ký điện tử** (Part 11, có lý do nhập tay), kèm mã tham chiếu tùy chọn (ví dụ số phiếu giấy). Không cần người thứ hai. Ý nghĩa chữ ký (meaning) mới, ví dụ `BACKUP_RESTORE_EXECUTION`: chưa đặt tên chính thức.

**Thực thi** (tự động, tuần tự, mỗi bước ghi nhật ký; dừng ở bước lỗi):

| Bước | Việc | Nếu lỗi |
| --- | --- | --- |
| 1 | Bật chế độ bảo trì: báo người dùng, đếm ngược, đăng xuất. ĐÃ CÓ (SDS-BR-001 mục 11.5) | Dừng, chưa đổi gì |
| 2 | **Backup an toàn** trạng thái hiện tại (`PRE_RESTORE`), kiểm chứng xong mới đi tiếp | Dừng, chưa đổi gì |
| 3 | Giải mã, kiểm chữ ký manifest và băm từng artifact | Dừng |
| 4 | Restore Database vào DB mới `eqms_restore_{id}` | Xóa DB mới, production nguyên vẹn |
| 5 | Bổ sung file thiếu theo manifest, kiểm SHA-256 từng file | Dừng, file đã thêm giữ lại (chỉ bổ sung nên vô hại) |
| 6 | **Kiểm tra sau restore** (mục 4) trên DB mới | Xóa DB mới, production nguyên vẹn |
| 7 | **Tự động hoán đổi** khi bước 6 đạt hoàn toàn: `eqms` → `eqms_pre_{id}`, `eqms_restore_{id}` → `eqms`; thu hồi mọi phiên; job dở dang chuyển "cần rà soát"; xóa cache | Nếu hoán đổi lỗi giữa chừng: đổi ngược lại, báo lỗi |
| 8 | Mở lại hệ thống, sinh **Báo cáo restore** (kết quả từng kiểm tra, băm, thời gian) | - |

**Chốt kết quả và quay lui (QUYẾT ĐỊNH 2026-11-09).** Sau restore, hệ thống ở trạng thái `CHỜ CHỐT`. DB cũ giữ ở `eqms_pre_{id}`.
- **Quay lui:** đổi tên ngược (`eqms` → `eqms_post_{id}`, `eqms_pre_{id}` → `eqms`), qua cùng cổng bảo trì và kiểm tra. Cần **ký điện tử**. Màn hình nói rõ: dữ liệu phát sinh sau restore sẽ mất khỏi hệ thống đang chạy (còn trong `eqms_post_{id}`).
- **Chốt kết quả restore:** một người dùng có quyền riêng **chốt** (do Admin phân quyền) ký điện tử xác nhận kết quả. Sau khi chốt, **quay lui bị đóng**; DB cũ giữ theo quy trình giấy, phần mềm không tự xóa.
- Quay lui và chốt không bị ràng buộc "khác người" trong phần mềm (quy trình giấy quyết).

## 4 Kiểm tra sau restore (cổng trước khi hoán đổi)

Mọi mục phải đạt, không có "bỏ qua":

1. Phiên bản Flyway của DB mới bằng phiên bản bản backup, không có migration lỗi.
2. Số bản ghi các bảng chính khớp manifest.
3. **Tham chiếu file:** mọi file mà DB tham chiếu đều có trong kho và khớp SHA-256.
4. **Chuỗi audit trail liền mạch** (số thứ tự, không đứt) và, nếu có băm nối chuỗi, băm khớp.
5. Chữ ký điện tử: mỗi bản ghi chữ ký còn trỏ đúng bản ghi gốc; `used_signature_tokens` khớp.
6. Khóa ngoại và ràng buộc duy nhất toàn vẹn (không vi phạm).
7. Tài khoản quản trị hệ thống tồn tại và đăng nhập được ở DB mới (SDS-BR-001 mục 11.6).

Với "Chỉ File" chỉ chạy mục 3.

## 5 Giao diện (rút gọn)

| Màn hình | Nội dung |
| --- | --- |
| **Backups** | Danh sách bản backup (loại, thời điểm, kích thước, trạng thái, băm), nút "Backup now", mở rộng xem chi tiết và kiểm chứng; Tải gói (Export) ở menu hành động |
| **Restore** | Luồng từng bước: chọn bản, chọn kiểu, xem trước, xác nhận, theo dõi tiến trình, báo cáo |
| **History** | Nhật ký backup và restore, kèm tình trạng toàn vẹn sổ cái |
| **Settings** | Lịch, đích lưu, cảnh báo |

ĐỀ XUẤT bỏ khỏi menu: Restore Requests, Approvals, Restore Rules, Inspections, DR Drills (diễn tập chuyển thành thao tác "Test restore" trong Backups: restore thử vào DB tạm rồi xóa), Verification Reports (gộp vào chi tiết bản backup). Quyền rút còn 4: xem, chạy backup, restore (gồm quay lui), chốt kết quả restore.

## 6 Điều ĐÃ CÓ tận dụng, ĐỀ XUẤT mới, và việc bỏ

- **Đã có trong agent (đọc code 2026-11-09, chưa chạy lại):**
  - Backup: dump DB trên snapshot nhất quán, sao chép object theo version, mã hóa, manifest ký, sổ cái nối băm, ghi bản backup bằng thư mục tạm rồi chuyển nguyên tử, kiểm chứng V1 ngay sau backup, nhân bản sang đích khác chỉ khi V1 đạt.
  - Restore thử vào DB tạm và bucket tạm (`RestoreRehearsalService`), kèm các kiểm tra: C1 phiên bản schema, C2 số bản ghi và large object, C3 khóa ngoại, C4 audit trail, C5 chữ ký và băm tài liệu của revision đang hiệu lực, C7 object mồ côi, C13 mọi tham chiếu file qua đúng một alias và đọc lại đúng SHA-256, cùng kiểm tra trạng thái (tài khoản, scheduler, job).
  - `RestoreRunEngine`: khung R5-R12 (thứ tự, ghi từng bước, quay lui nếu lỗi sau hoán đổi). **Các hành động thật của từng bước chưa được viết:** engine hiện chỉ chạy được với hành động giả trong test.
  - Bảo trì và đăng xuất, Super Administrator, sổ cái, cảnh báo.
- **Còn thiếu so với thiết kế này:**
  - Thực thi restore thật vào production: restore DB sang DB mới, bổ sung object vào kho thật, hoán đổi tên DB, quay lui, chốt kết quả (worker restore, kết nối lại của backend sau hoán đổi).
  - Kiểm tra tham chiếu file **ở thời điểm backup** (hiện C13 chỉ chạy khi restore thử). Cần danh sách cột tham chiếu file theo bảng (tham chiếu lưu không đồng nhất: cột bucket/key/version riêng, hoặc chuỗi `minio://bucket/key`, hoặc chỉ `version_id`).
  - Luồng ký điện tử cho restore, quay lui và chốt; quyền mới; màn hình Restore dạng wizard.
  - Gỡ luồng yêu cầu/duyệt (R0-R3), `RestoreRules`, DR Drills, Inspections khỏi giao diện và quyền.
- **Bỏ:** luồng yêu cầu / duyệt / từ chối / ký xác nhận hai người; các quyền và migration liên quan (không xóa dữ liệu lịch sử đã có, chỉ ngừng dùng).

## 7 Các giai đoạn đề xuất

| Giai đoạn | Việc | Kiểm chứng |
| --- | --- | --- |
| 1 | Chốt tài liệu này; ghi Decision Log | QA đọc |
| 2 | Backup: trạng thái `VERIFIED`, kiểm tham chiếu file, kiểm chứng tự động | Test thất bại có chủ đích (làm hỏng 1 byte, xóa 1 file, cắt đích) |
| 3 | Engine restore (agent): bước 1-8, hoán đổi, quay lui | Test lỗi chèn vào từng bước, xác nhận production không đổi |
| 4 | Màn hình Restore wizard và Backups mới, nối API | Playwright trên DEV |
| 5 | Gỡ luồng phê duyệt, ẩn màn hình thừa, rút quyền | Kiểm quyền, hồi quy |
| 6 | Diễn tập restore đầy đủ trên DEV, ghi bằng chứng | Báo cáo restore, so dữ liệu trước/sau |

## 8 Chưa làm / chờ quyết định

- **ĐÃ CHỐT 2026-11-09** (ghi ở `DECISION_LOG.md`, mục `BACKUP-RESTORE-SIMPLIFIED-2026-11-09`): ký điện tử khi restore; cho restore bản có cảnh báo thiếu file; quay lui đến khi người có quyền chốt ký chốt.
- **Chưa chốt:** tên và mã quyền mới, tên meaning chữ ký (restore, quay lui, chốt), chính sách giữ và xóa DB `eqms_pre_{id}` / `eqms_post_{id}`, và việc phần mềm có chặn người chốt trùng người restore hay không (hiện: không chặn).
- Chưa đối chiếu `PostRestoreChecks`, `RestoreRehearsalService` với mục 4; chưa đo lỗ hổng thực tế.
- Chưa biết kích thước và thời gian restore thực tế trên dữ liệu thật; thời gian bảo trì phụ thuộc điều đó.
- Chưa có thay đổi mã nguồn, migration, quyền hay test.
- Chưa cập nhật mục 23.9 của SDS-BR-001 và chưa publish lại.
