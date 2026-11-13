SDS-BR-002 · Bản nháp 0.1 · 2026-11-09

# SDS-BR-002 Phân loại dữ liệu và kiểu Backup & Restore (bản gọn)

**Trạng thái:** ĐỀ XUẤT theo chỉ đạo của chủ dự án ngày 2026-11-09: "làm đơn giản, phân loại chính xác". Chưa được QA duyệt. Chưa có thay đổi mã nguồn.

**Quan hệ với SDS-BR-001:** tài liệu này **thay thế mục 4 (D1-D11) và mục 4.1 (5 mức restore)** của SDS-BR-001 khi được duyệt. Các mục còn lại của SDS-BR-001 (đích lưu, bảo vệ, vai trò, phê duyệt, bảo trì, DR) chưa được xem lại ở đây.

**Nhãn:** ĐỀ XUẤT = thiết kế của người soạn. QUYẾT ĐỊNH = chủ nghiệp vụ / QA phải chốt.

## 1 Ba loại dữ liệu

| Loại | Gồm gì | Nơi chứa | Backup | Restore |
| --- | --- | --- | --- | --- |
| **Database** | Mọi dữ liệu có cấu trúc: tài liệu, revision, workflow, audit trail, chữ ký điện tử, người dùng, quyền, policy, cấu hình, đào tạo, và các bản ghi trỏ tới file | PostgreSQL `eqms` (kể cả large object) | Dump đầy đủ hằng ngày | Thay thế toàn bộ (dựng DB mới rồi hoán đổi, giữ DB cũ làm bản an toàn) |
| **File** | Tài liệu, revision, bản copy có kiểm soát, ảnh, bài kiểm tra, bản scan, báo cáo, template | MinIO: `eqms-gmp-records`, `eqms-templates`, `eqms-gmp-revisions` (cũ, chỉ đọc); và `local`/`nas` nếu còn bản ghi dùng provider đó | Chỉ sao chép version mới, kiểm SHA-256 | **Chỉ bổ sung** file thiếu hoặc hỏng, không ghi đè |
| **Cấu hình triển khai** | File compose, tên biến môi trường (không giá trị), tag/digest image, phiên bản ứng dụng, trạng thái Flyway | Repo, máy chủ | Gói nhỏ hằng ngày và trước mỗi lần nâng cấp | Dùng khi dựng lại hệ thống |

Ghi chú:
- Ảnh, bài kiểm tra, bản scan, báo cáo đều nằm trong bucket `eqms-gmp-records`, khác nhau theo tiền tố thư mục. Chúng thuộc loại **File**, không tách loại riêng.
- Policy và cấu hình nghiệp vụ nằm trong DB, thuộc loại **Database**. "Cấu hình triển khai" chỉ gồm thứ nằm ngoài DB.
- **Bí mật vận hành** (khóa JWT, khóa MinIO, mật khẩu DB, khóa mã hóa backup, khóa ký manifest) **không nằm trong backup**; cất riêng, hai người giữ (SDS-BR-001 mục 8.4).
- **Không backup:** Redis, phiên và cache OnlyOffice, chữ ký ClamAV, Mailhog, Adminer, prefix `temp`.
- DB điều khiển của hệ thống backup (`eqms_backup_control`) và nhật ký ứng dụng có quy trình riêng, giữ như SDS-BR-001 (D8, D10). Chưa xem lại ở đây.

## 2 Database và File là một cặp

Database ghi nhận file nào tồn tại. Vì vậy:
- Một lần backup đầy đủ chụp **Database trước, File sau**, và ghi vào một manifest chung (thời điểm DB `T_db`, thời điểm file `T_obj`).
- File không bị xóa và không bị sửa (mỗi thay đổi là một version mới), nên tập file chụp sau `T_db` luôn chứa mọi file mà DB tại `T_db` tham chiếu. File tạo sau `T_db` là "mồ côi" và được đánh dấu.
- Sau mọi restore có DB, phải kiểm: **mọi file mà DB tham chiếu đều có và khớp SHA-256**. Thiếu file thì restore không được coi là hoàn tất.

## 3 Bốn kiểu backup / restore người dùng thấy

| Kiểu | Backup | Restore | Dùng khi |
| --- | --- | --- | --- |
| **Đầy đủ** (Database + File) | Theo lịch, mặc định | Thay DB, bổ sung File | Thảm họa, quay về một thời điểm |
| **Chỉ Database** | Theo lịch hoặc chạy tay | Thay DB, rồi kiểm tham chiếu file | Sai dữ liệu, hỏng DB |
| **Chỉ File** | Theo lịch hoặc chạy tay | Chỉ bổ sung file thiếu/hỏng | Mất hoặc hỏng một số file |
| **Cấu hình** | Hằng ngày và trước nâng cấp | Dùng trong dựng lại | Nâng cấp, dựng lại máy chủ |

ĐỀ XUẤT: bỏ khỏi giao diện hai mức của SDS-BR-001 mục 4.1: **R-ONE** (một object) và **R-REC** (một bản ghi). Sửa một file hỏng dùng "Chỉ File". R-REC vốn đã không được phép vào production; muốn xem dữ liệu cũ thì dựng môi trường validation từ bản backup (SDS-BR-001 mục 11).

## 4 Chưa làm / chờ quyết định

- **QUYẾT ĐỊNH (QA):** chấp nhận bỏ R-ONE và R-REC; chưa ghi vào `DECISION_LOG.md`. Việc ghi sẽ làm khi QA xác nhận.
- Chưa đối chiếu lại các mục khác của SDS-BR-001 với tài liệu này; SDS-BR-001 vẫn nêu "chỉ giao diện mẫu, chưa có backend" trong khi mã nguồn đã có các controller Backup. Cần cập nhật hiện trạng.
- Chưa đối chiếu code hiện tại với 4 kiểu trên: chưa kiểm xem giao diện và API đang tạo/restore theo loại nào.
- Chưa quyết định ẩn hoặc gộp các màn hình ít dùng (DR Drills, Inspections, Exports, Verification Reports, Restore Rules, Alerts).
- Chưa có thay đổi mã nguồn, migration hay test.
