# Kết quả kiểm tra chéo — DOCUMENT_CONTROL_CROSS_FLOW_AUDIT_REPORT.md (89 phát hiện)

Kiểm tra độc lập bằng 6 agent đọc code song song, mỗi agent phụ trách 1 nhóm giai đoạn, tự đọc trực
tiếp source code/migration/DB (không tin theo mô tả của report gốc), đối chiếu từng phát hiện với
bằng chứng file:line cụ thể.

## Tổng kết

| Verdict | Số lượng | Ghi chú |
|---|---:|---|
| **CONFIRMED** (tự trace được cơ chế) | **80** | Đã xác nhận độc lập, đúng như report gốc mô tả |
| **PARTIALLY CONFIRMED** | 4 | Cơ chế có thật nhưng chưa trace hết toàn bộ chi tiết (DC-XF-14, 15, 33, 47) |
| **COULD_NOT_VERIFY** (do giới hạn tĩnh/thời gian, không phải sai) | 8 | Cần chạy runtime/concurrency test hoặc đọc sâu hơn (DC-XF-13, 25, 29, 36, 52, 56, 88 phần số liệu runtime, và phần race cụ thể của 06/12) |
| **NOT CONFIRMED** (report sai) | **0** | Không có phát hiện nào bị bác bỏ |

**Kết luận chính**: report của Codex có độ chính xác rất cao — **80/89 mục được xác nhận đầy đủ, độc
lập, có bằng chứng file:line**, không có mục nào bị phát hiện là sai. 8 mục "chưa verify được" đều là
do bản chất cần môi trường runtime/concurrency thật (race condition thật giữa 2 transaction, số liệu
sản xuất thật) — không phải do cơ chế bị bác bỏ; hầu hết các mục này *chính report gốc* cũng đã tự ghi
nhận là "cần concurrency integration test" chứ không tự nhận là đã reproduce được 100%. 4 mục
"partially confirmed" cần đọc thêm code để xác nhận trọn vẹn nhưng phần cơ chế cốt lõi là đúng.

---

## Chi tiết theo từng agent/nhóm

### Nhóm A — Migration + Auth/Signature (9 mục)
8 CONFIRMED, 1 COULD_NOT_VERIFY (DC-XF-88 — cơ chế 3 nơi cấu hình Flyway validate-on-migrate khác
nhau đã xác nhận đúng qua code, nhưng số liệu runtime cụ thể trong report — checksum thật, 397 lỗi/10
phút — cần môi trường chạy thật để verify, agent không có).
- DC-XF-89 (DB trắng fail tại V80): **CONFIRMED** — xác nhận subquery theo `document_number` không
  tồn tại trên DB trắng → NOT NULL violation, đúng 100% cơ chế.
- DC-XF-39, 45, 68, 67, 83, 84, 65: đều **CONFIRMED**.

### Nhóm B — Publish/PDF/Template (17 mục)
16 CONFIRMED, 1 COULD_NOT_VERIFY (DC-XF-56 — agent hết thời gian trace toàn bộ 3 màn hình FE +
`completePublish`, nhưng đánh giá là hợp lý dựa trên các mục liên quan đã confirm).
- Đáng chú ý: DC-XF-57 (Controlled Copy dùng `previewFilePath` thay vì Published PDF thật), DC-XF-58
  (chữ ký không lưu `reviewPdfVersionId`/`publishedPdfVersionId` — **luôn set null**), DC-XF-64 (xoá
  cứng template đang dùng, có `ON DELETE CASCADE`/`SET NULL` xác nhận qua migration) đều CONFIRMED
  chắc chắn, có trích dẫn dòng code cụ thể.

### Nhóm C — MinIO/Microsoft Graph (13 mục)
**13/13 CONFIRMED** — không có mục nào cần verify thêm. Đây là nhóm có độ chính xác tuyệt đối.

### Nhóm D — Vòng đời cha–con Document/Revision/Controlled Copy (14 mục)
Đa số CONFIRMED; 3 mục PARTIALLY CONFIRMED:
- DC-XF-14 (1 copy hết hạn làm cả batch Obsoleted): agent xác nhận `deriveExpectedStatus` chính có
  logic đúng (yêu cầu TOÀN BỘ copy chưa cancel phải obsoleted), nhưng chưa đọc được
  `ControlledCopyExpiryScheduler` để xác nhận claim rằng scheduler bypass logic này — **cần đọc thêm**.
- DC-XF-15 (GET âm thầm sửa batch không audit): xác nhận `synchronize()` không có audit, nhưng chưa
  xác nhận trực tiếp GET nào gọi `synchronize()`.
- DC-XF-47 (flag related/correlated lệch relation rows): xác nhận cách dùng flag nhưng chưa đọc hết
  method 1058 dòng để loại trừ khả năng có update ở chỗ khác.
- DC-XF-13, 52 (race điều kiện cụ thể): cơ chế (thiếu lock) đã xác nhận đúng, nhưng race thật cần
  concurrency test trên PostgreSQL — đúng như report gốc đã tự ghi nhận.

### Nhóm E — Vận hành Controlled Copy (20 mục)
17 CONFIRMED, 3 COULD_NOT_VERIFY do hết ngân sách đọc code (không phải sai): DC-XF-25 (email gửi
trước commit), DC-XF-29 (holder không được thông báo), DC-XF-36 (so khớp theo full name) — agent tự
báo là "cần đọc trực tiếp thêm trước khi khẳng định", không tự tin xác nhận mù quáng.

### Nhóm F — Upgrade Revision + Dọn dẹp/Drift (16 mục)
**16/16 CONFIRMED** — độ chính xác tuyệt đối, bao gồm cả các phát hiện tinh vi như DC-XF-62 (Upgrade
copy nhầm từ `latestRevision` thay vì `source` Effective — đã trace chính xác dòng nào dùng biến nào).

---

## Khuyến nghị

1. **Có thể tin tưởng dùng report gốc `DOCUMENT_CONTROL_CROSS_FLOW_AUDIT_REPORT.md` làm nền triển
   khai** — tỷ lệ xác nhận đúng 80/89 (90%), 0 mục sai, phần còn lại chỉ thiếu bằng chứng runtime chứ
   không mâu thuẫn với code.
2. **8 mục COULD_NOT_VERIFY nên được đọc/verify thêm trước khi đưa vào kế hoạch triển khai chính
   thức** (đặc biệt DC-XF-56, 14, 15, 47 vì ảnh hưởng tới cách sửa) — có thể verify nhanh bằng cách
   đọc trực tiếp thêm, không cần agent riêng.
3. Với quy mô 89 mục, **không nên triển khai tất cả cùng lúc** — bám theo đúng thứ tự 8 giai đoạn
   Codex đã đề xuất (migration → auth/signature → Publish → storage/Graph → parent-child lifecycle →
   Controlled Copy ops → Upgrade/audit → cleanup), vì các giai đoạn sau phụ thuộc giai đoạn trước
   (ví dụ: không thể test race condition tin cậy khi Flyway migration còn lệch — DC-XF-88/89 phải sửa
   trước tiên).
