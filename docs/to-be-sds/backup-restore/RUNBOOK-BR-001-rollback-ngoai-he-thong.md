# RUNBOOK-BR-001: Rollback tay khi ứng dụng không chạy được sau một lần Restore

Ngày viết: 2026-11-11. Phạm vi: **database** của một lần Restore production đã hoán đổi (swap). Phần **Files** của Restore chỉ thêm file còn thiếu, không ghi đè, nên không có gì để rollback ở phần này (file đã thêm vẫn nằm trong store, vô hại).

## Khi nào dùng

Chỉ dùng khi **không thể** bấm Rollback trong ứng dụng (ví dụ ứng dụng không khởi động sau khi hoán đổi). Nếu ứng dụng vẫn mở được, dùng màn Restore Backup > chi tiết lần restore > Rollback (có chữ ký điện tử).

## Cơ chế (đối chiếu `DatabaseSwap.java`)

- Restore dựng database mới từ backup, rồi **đổi tên**: database đang chạy `<live>` thành `<live>_pre_<tag>` (giữ nguyên, không xóa), database vừa dựng thành `<live>`.
- Rollback là đổi tên ngược lại: `<live>` hiện tại thành `<live>_post_<tag>`, `<live>_pre_<tag>` trở lại thành `<live>`.
- `<live>` trên DEV là `eqms-database`; `<tag>` có trong bản ghi lần restore (cột `tag`, ví dụ `7d3a07901df0`) và trong tên các database: `psql -l`.
- Chỉ khả thi **trước khi lần restore được Finalize**. Sau Finalize, database `_pre_` không còn là đường lui được bảo đảm.

## Các bước (DEV, Docker)

Các lệnh dưới là đúng chuỗi lệnh `DatabaseSwap` chạy. **Chúng đã được chạy thử trên database tạm `rbtest_live` ngày 2026-11-11 (kết quả: database sau rollback chứa dữ liệu trước restore, tên `_post_` còn lại).** Chưa chạy trên database thật.

1. **Dừng ứng dụng**, để không còn kết nối vào database:
   `docker stop eqms-backend`
2. **Xem tên database**, xác nhận `eqms-database` và `eqms-database_pre_<tag>` cùng tồn tại:
   `docker exec eqms-postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "\l"'`
3. **Hoán đổi ngược** (kết nối vào database `postgres`, không phải database eQMS):
   ```sql
   alter database "eqms-database" allow_connections false;
   alter database "eqms-database_pre_<tag>" allow_connections false;
   select pg_terminate_backend(pid) from pg_stat_activity
     where datname in ('eqms-database','eqms-database_pre_<tag>') and pid <> pg_backend_pid();
   alter database "eqms-database" rename to "eqms-database_post_<tag>";
   alter database "eqms-database_pre_<tag>" rename to "eqms-database";
   alter database "eqms-database" allow_connections true;
   alter database "eqms-database_post_<tag>" allow_connections true;
   ```
   Nếu lệnh `rename` thứ hai lỗi, đổi tên lại `eqms-database_post_<tag>` thành `eqms-database` rồi dừng, báo người phụ trách; không xóa gì.
4. **Khởi động lại ứng dụng**: `docker start eqms-backend`, chờ healthy.
5. **Kiểm tra**: đăng nhập, mở một tài liệu, mở Backup & Restore. Dữ liệu phải là dữ liệu trước lần restore.
6. **Ghi nhận**: database `eqms-database_post_<tag>` (kết quả restore bị bỏ) **giữ nguyên**, không xóa, làm bằng chứng cho đến khi QA quyết định. Ghi sự kiện vào Decision Log và báo QA, vì lần rollback này diễn ra ngoài ứng dụng nên **không có chữ ký điện tử và không có dòng Audit Trail**.

## Chưa kiểm chứng (cần người phụ trách xác nhận)

- **Khóa bảo trì** (`backups/dev/maintenance/maintenance.lock`): chưa xác minh cách gỡ khi ứng dụng không chạy. Trước mắt giữ nguyên khóa cho đến khi ứng dụng chạy lại và Super Administrator gỡ trong ứng dụng.
- **Bản ghi lần restore** trong control DB sẽ vẫn ở trạng thái chờ Finalize sau rollback tay; cần được đóng trong ứng dụng khi ứng dụng chạy lại.
- **TEST và PROD** (Windows server, NAS): tên database, tên container và cách dừng ứng dụng khác DEV; runbook này cần được viết lại theo môi trường thật trước khi dùng ở đó.
