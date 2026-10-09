# Backup, Restore và Disaster Recovery — thiết kế đề xuất

Trạng thái: **ĐỀ XUẤT, chưa được duyệt, chưa có backend.** Không phải As-Is evidence và không phải GMP approval.
Ngày: 2026-10-08. Nhãn: **[ĐÃ KIỂM TRA]** thấy trong source/hệ thống dev; **[ĐỀ XUẤT]** của người soạn;
**[QUYẾT ĐỊNH]** cần chủ sở hữu nghiệp vụ / QA chốt; **[CHƯA KIỂM TRA]** chưa xác nhận được.

## 1. Dữ liệu nào sao lưu và phục hồi được

### 1.1 Nơi dữ liệu thực sự nằm [ĐÃ KIỂM TRA]

| Nơi | Chứa gì | Quy mô trên máy dev |
|---|---|---|
| PostgreSQL (`eqms-database`) | 134 bảng: tài liệu, revision, workflow, audit trail (`audit_logs`, `audit_log_changes`), chữ ký điện tử, người dùng và phân quyền, policy, retention, cấu hình, job, thông báo, lịch sử Flyway | 322 MB |
| MinIO, bucket `eqms-gmp-records` (bản ghi GMP mới từ 2026-10-08, khóa COMPLIANCE) và `eqms-templates` (mẫu, không khóa). Bucket cũ `eqms-gmp-revisions` vẫn chứa dữ liệu lịch sử và **phải được sao lưu** cùng hai bucket trên | File gốc, revision, snapshot, PDF phát hành, controlled copy, template, tài liệu đào tạo, audit export, report artifact (thư mục thực tế trên máy dev: `controlled-copies` 210 MB, `documents` 94 MB, `templates` 58 MB, `revisions`, `forms`, `reports`, `uncontrolled-copies`, `review-comment-attachments`, `personnel`, `user-certifications`; cấu hình còn dự phòng `training`, `audit`, `temp` nhưng chưa có dữ liệu) | 366 MB |
| Volume ứng dụng `/app/storage` | Chỗ lưu dự phòng khi provider là `local`/`nas` (`document_revisions.storage_provider` cho phép `local`, `nas`, `minio`) | gần như trống |
| Redis | Cache, giới hạn tốc độ, khóa idempotency | tạm thời |
| OnlyOffice `Data` | Cache và phiên soạn thảo của Document Server | tạm thời |
| ClamAV, Mailhog, Adminer | Chữ ký virus, mail thử, công cụ dev | không phải dữ liệu của bạn |

### 1.2 Phân loại [ĐỀ XUẤT]

**Bắt buộc sao lưu (bản ghi GMP):**
1. Toàn bộ cơ sở dữ liệu PostgreSQL, gồm audit trail, chữ ký điện tử, `used_signature_tokens`.
2. Toàn bộ bucket MinIO, **gồm mọi version của object**, không chỉ bản mới nhất.
3. Mọi nơi file khác đang được dùng (`local`/`nas`). Manifest phải liệt kê từng provider có trong DB.
4. Cấu hình không bí mật (nằm trong DB) và danh mục phiên bản: phiên bản ứng dụng, tag image Docker, trạng thái Flyway.

**Sao lưu riêng, cất tách khỏi backup dữ liệu:** bí mật vận hành (`APP_AUTH_JWT_SECRET`, khóa MinIO, `ONLYOFFICE_JWT_SECRET`, mật khẩu DB, khóa mã hóa backup). Không để chung với backup, nếu không backup lộ thì mọi thứ lộ. Mất khóa mã hóa backup thì **backup không đọc được nữa**. [CHƯA KIỂM TRA] có dữ liệu nào trong DB được mã hóa bằng secret của ứng dụng hay không. Nếu có, mất secret đó thì restore xong vẫn không đọc được dữ liệu đó.

**Không cần sao lưu (tạo lại được):** Redis, cache và phiên OnlyOffice, ClamAV, Mailhog, Adminer, prefix `temp`.

**Cần quyết định:** bảng `authorization_shadow_evaluation_events` (85 MB, dữ liệu đánh giá chẩn đoán, lớn nhất DB) có thuộc bản ghi GMP không. Mặc định là sao lưu, không loại trừ khi chưa có quyết định. Nhật ký vận hành (`eqms_backend_logs`) thì theo chính sách lưu nhật ký riêng.

### 1.3 Sao lưu hết file tài liệu có được không

**Được, và nên làm.** Dung lượng không phải rào cản kỹ thuật:
- Dùng bản sao tăng dần (incremental) và loại trùng (dedupe). Bucket có versioning và Object Lock nên **object bất biến**; sau lần đầy đủ đầu tiên, mỗi lần chỉ chép object mới. Lần đầy đủ đầu chạy lâu, các lần sau nhanh.
- PDF và DOCX nén được ít; dự trù dung lượng gần bằng dữ liệu gốc nhân số bản giữ.
- Quy mô hiện tại (~700 MB) rất nhỏ. Khi hệ thống chạy thật, cần dự báo tăng trưởng theo năm, ghi vào Decision Log.

## 2. Định dạng xuất và lưu trên máy chủ on-premises

### 2.1 Định dạng [ĐỀ XUẤT]

Mỗi lần backup là một **bộ sao lưu (backup set)** gồm thư mục có cấu trúc:

```
<backup-id>/
  manifest.json          mã backup, thời điểm DB và thời điểm object, phiên bản app + Flyway, danh sách file + SHA-256, provider
  manifest.sig           chữ ký của manifest (phát hiện sửa đổi)
  database/eqms.dump     pg_dump định dạng custom (-Fc) — đọc được bằng công cụ chuẩn của PostgreSQL
  objects/...            bản sao object MinIO kèm toàn bộ version, giữ nguyên key
  config/                cấu hình không bí mật
  SHA256SUMS
```

- Định dạng **mở và chuẩn**, để mười năm sau vẫn restore được kể cả khi phần mềm này không còn. Điều này gắn với yêu cầu lưu trữ dữ liệu đọc được trong suốt thời hạn lưu (Annex 11 về lưu trữ).
- Mã hóa AES-256 toàn bộ bộ sao lưu trước khi ghi ra ngoài máy chủ.
- Muốn khôi phục đến một thời điểm bất kỳ (point-in-time) thì cần thêm lưu WAL của PostgreSQL. Hiện chưa bật [ĐÃ KIỂM TRA: compose không có `archive_mode`]. Việc này gắn với RPO (mục 4).

### 2.2 Nơi lưu

Có thể ghi vào ổ đĩa của chính máy chủ, **nhưng đó không được coi là sao lưu đủ**. Hỏng máy, cháy, ransomware đều mất cả dữ liệu lẫn backup.

| Loại đích | Dùng được | Lưu ý |
|---|---|---|
| Thư mục trên máy chủ | Có | Chỉ hữu ích để lấy nhanh; cùng vùng hỏng với dữ liệu |
| Ổ mạng NAS (NFS/SMB) | Có | Nên là thiết bị khác |
| Kho tương thích S3 (một MinIO khác) | Có | Bật Object Lock để bất biến |
| Ổ cứng ngoài/băng từ | Có | Quy trình luân chuyển và cất giữ ngoài cơ sở là thủ tục, phải ghi hồ sơ |

Quy tắc đề xuất **3-2-1-1**: 3 bản sao, 2 loại phương tiện khác nhau, 1 bản ngoài cơ sở, 1 bản bất biến hoặc ngoại tuyến. Màn hình Storage & Encryption cảnh báo khi chỉ có một đích hoặc chỉ nằm trên máy chủ.

Tải bộ sao lưu về PC của người dùng qua trình duyệt **không nên** làm: dung lượng lớn, dữ liệu nhạy cảm rời khỏi hệ thống, khó kiểm soát. Chỉ cho tải `manifest.json`.

Kỹ thuật: image backend hiện **không có** `pg_dump` hay `mc` [ĐÃ KIỂM TRA]. Đề xuất chạy tác vụ sao lưu bằng một **container riêng với quyền tối thiểu**, backend chỉ ghi yêu cầu và đọc kết quả, không tự chạy dump trong tiến trình web.

## 3. Restore: dữ liệu cũ bị ghi đè hay trùng lặp

### 3.1 Cơ sở dữ liệu

Restore vào production là **thay thế toàn bộ**, không bao giờ trộn. Gộp hai tập dữ liệu sẽ phá khóa ngoại, trình tự audit và chữ ký điện tử. Quy trình:
1. Chế độ bảo trì, đăng xuất người dùng, dừng các job.
2. **Backup an toàn trạng thái hiện tại** (giữ làm bằng chứng cho khoảng dữ liệu bị thay).
3. Dựng lại DB từ backup.
4. Chạy kiểm tra sau restore, đối chiếu với manifest.

Dữ liệu tạo sau thời điểm backup **không còn trong hệ thống đang chạy**; chúng chỉ còn trong backup an toàn ở bước 2. Phải ghi vào hồ sơ sự kiện/sai lệch, kèm khoảng thời gian bị mất.

### 3.2 File trong MinIO [ĐÃ KIỂM TRA]

Bucket bật **Object Lock chế độ COMPLIANCE** (mặc định 5 năm) và versioning. Hệ quả:
- Không ai (kể cả quản trị MinIO) xóa hoặc ghi đè object trong thời hạn khóa. Vì vậy restore **không thể "ghi đè"**, chỉ **thêm** object hoặc version còn thiếu.
- Object mới hơn thời điểm backup vẫn nằm trong bucket nhưng DB đã restore không còn tham chiếu: đây là **object mồ côi**. Không xóa được. Cần báo cáo đối chiếu, gắn nhãn, giữ lại.
- Không tạo bản trùng, vì key và version bất biến.

### 3.3 Rủi ro trùng lặp thật sự

- **Job và email:** các job phân phối controlled copy/uncontrolled copy, job publishing, report run đang ở trạng thái "chưa xong" trong backup có thể chạy lại sau restore và gửi email hoặc tạo bản phát hành lần hai. Sau restore, mọi scheduler phải **tắt** cho đến khi đối chiếu xong; job dở dang chuyển sang "cần rà soát".
- **Phiên đăng nhập và token:** sau restore mọi phiên bị hủy, buộc đăng nhập lại.
- **`used_signature_tokens`** phải được khôi phục cùng DB để token chữ ký cũ không dùng lại được.

### 3.4 Khôi phục từng phần

Khôi phục **một tài liệu hay một bản ghi** vào production **không được hỗ trợ như restore**. Thay vào đó: restore vào **môi trường validation**, xem hoặc xuất dữ liệu cần, rồi xử lý như một hiệu chỉnh dữ liệu theo change control. Cách này tránh phá tính toàn vẹn audit trail và chữ ký.

### 3.5 Hệ quả cho diễn tập restore [ĐÃ KIỂM TRA]

Vì bucket production khóa COMPLIANCE 5 năm, nếu diễn tập restore ghi vào một bucket cũng bật khóa, dữ liệu diễn tập sẽ **không xóa được suốt 5 năm** và dung lượng tăng mãi. Môi trường validation phải dùng bucket **không bật Object Lock** (hoặc khóa rất ngắn), và quy định này phải ghi rõ.

## 4. Có cần phục hồi sau thảm họa (DR) không

**Có.** Annex 11 yêu cầu có phương án đảm bảo liên tục cho hệ thống hỗ trợ quy trình quan trọng, và thời gian để đưa phương án thay thế vào dùng phải dựa trên rủi ro. DR khác restore thông thường:

| | Restore thông thường | Disaster Recovery |
|---|---|---|
| Tình huống | Mất hay hỏng dữ liệu, máy chủ còn | Mất máy chủ hoặc cả cơ sở, ransomware, hỏng toàn bộ |
| Hạ tầng | Còn nguyên | Phải **dựng lại** từ đầu |
| Người ra quyết định | Người duyệt restore | Tuyên bố DR do người có thẩm quyền, kèm hồ sơ sự kiện |
| Bằng chứng | Yêu cầu restore | Hồ sơ sự kiện, toàn bộ nhật ký, đánh giá tác động GMP |

### Phải có

1. **Mục tiêu RPO/RTO** theo rủi ro [QUYẾT ĐỊNH]. RPO là mất tối đa bao lâu dữ liệu, RTO là bao lâu phải chạy lại. RPO nhỏ hơn 24 giờ cần lưu WAL.
2. **Bản sao ngoài cơ sở và bất biến** (mục 2.2). Chống ransomware dựa vào bản không thể xóa hoặc ngoại tuyến.
3. **Gói dựng lại**: compose, image đã ghim phiên bản và lưu ngoại tuyến (không dựa vào internet khi thảm họa), hướng dẫn cài từng bước, khóa mã hóa và secret cất tách biệt.
4. **Quy trình tuyên bố DR** và danh bạ người liên quan.
5. **Diễn tập DR định kỳ**, đo thời gian thật so với RTO. Khác diễn tập restore: dựng trên máy trống.
6. **Kiểm tra sau DR** như mục 5, và rà soát tác động GMP: dữ liệu mất trong khoảng RPO, bản phát hành hoặc phân phối có thể bị trùng.
7. Phương án nâng cao (tùy RTO): máy chủ dự phòng với replication PostgreSQL và MinIO. Chi phí và độ phức tạp cao hơn nhiều; chỉ khi RTO ngắn.

## 5. Toàn vẹn dữ liệu và EU-GMP

| Biện pháp | Mục đích |
|---|---|
| Manifest SHA-256 cho từng file + chữ ký manifest | Phát hiện hỏng hay sửa đổi |
| Xác minh ngay sau ghi và định kỳ trên đích | Phát hiện bit-rot |
| Thứ tự chụp: **DB trước, rồi object** (object bất biến nên tập object chụp sau luôn bao phủ tập DB đã chụp) | Không có bản ghi trỏ tới file không có |
| Mã hóa + quyền truy cập tối thiểu + tách khóa | Bảo mật |
| Bản bất biến/ngoại tuyến | Chống xóa, ransomware |
| Mọi thao tác backup, restore, legal hold, đổi policy ghi audit trail **và** ghi cả vào nhật ký ngoài DB | Audit trail trong DB sẽ bị thay khi restore, nên cần bản độc lập |
| Restore cần người thứ hai duyệt, ký điện tử, mã change control (production) | Phân tách nhiệm vụ |
| Kiểm tra sau restore: schema = Flyway, số dòng, **đối chiếu bản ghi ↔ file ↔ checksum**, trình tự audit liên tục, chữ ký điện tử còn hợp lệ, mở thử mẫu tài liệu | Chứng minh dữ liệu đúng |
| Diễn tập restore và DR định kỳ có hồ sơ | "Backup chưa từng restore thì chưa được chứng minh" |
| Quy trình đã **xác nhận (validated)** trước khi dùng cho dữ liệu GMP | Annex 11 §4/§7 |

Tham chiếu điều khoản cụ thể (Annex 11 các mục về lưu trữ dữ liệu, sao lưu, liên tục kinh doanh, lưu trữ lâu dài; EU GMP Chapter 4; hướng dẫn toàn vẹn dữ liệu PIC/S, MHRA) do QA xác nhận trước khi ghi vào hồ sơ validation.

## 6. Thay đổi đề xuất cho giao diện đang dựng

1. **Backup Policy:** thêm khối *Phạm vi sao lưu*: liệt kê DB, mọi provider file, cấu hình; mục loại trừ có lý do.
2. **Storage & Encryption:** thêm loại đích *Thư mục trên máy chủ* và *Ổ ngoài/băng từ*; cảnh báo 3-2-1-1; chỉ thị đích bất biến.
3. **Restore Requests:** thêm loại yêu cầu `Restore` và `Disaster Recovery`; wizard hiển thị hệ quả mục 3.1–3.3 (dữ liệu bị thay, object mồ côi, job bị tạm dừng).
4. **Mục mới trong Administration: Disaster Recovery Plan:** RPO/RTO, kịch bản, gói dựng lại, danh bạ, chu kỳ diễn tập DR.
5. **Mục mới trong Backup & Restore: Disaster Recovery Drills** (hoặc tab trong Restore Requests): lịch sử diễn tập, thời gian thực tế so với RTO.
6. **Overview:** hiển thị RPO thực tế (tuổi bản sao ngoài cơ sở gần nhất) so với mục tiêu.

## 7. Quyết định cần chốt

| ID | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| BR-1 | RPO và RTO cho từng kịch bản | RPO ≤ 24 giờ ban đầu; hạ xuống nếu rủi ro yêu cầu (cần WAL) |
| BR-2 | Thời hạn lưu backup (hiện là giá trị giữ chỗ) | Chưa có; không đặt |
| BR-3 | Có khôi phục từng phần vào production không | Không; qua môi trường validation + change control |
| BR-4 | Có bảng nào loại trừ khỏi backup không | Không loại trừ khi chưa quyết định |
| BR-5 | Có môi trường validation riêng, và bucket của nó không khóa Object Lock | Có, bắt buộc để diễn tập |
| BR-6 | Đích ngoài cơ sở (NAS thứ hai, đám mây riêng, băng từ) | Ít nhất một bản ngoài cơ sở + một bản bất biến |
| BR-7 | Ai có thẩm quyền tuyên bố DR | Người đứng đầu QA + IT, ghi trong DR Plan |
| BR-8 | Khóa mã hóa backup được giữ ở đâu và ai giữ | Hai người giữ, tách khỏi backup |
| BR-9 | Dự báo tăng trưởng dung lượng và kế hoạch mở rộng | Đánh giá hằng năm |

## 8. Chưa kiểm tra / giới hạn của tài liệu này

- Chưa xác nhận dữ liệu nào trong DB được mã hóa bằng secret của ứng dụng.
- Chưa kiểm tra cách `local`/`nas` thực sự được cấu hình ở môi trường triển khai.
- Chưa xác nhận OnlyOffice có phiên soạn thảo chưa lưu cần xử lý trước khi bảo trì.
- Số liệu dung lượng là của máy dev, không đại diện cho môi trường thật.
- Tài liệu này không thay thế hồ sơ validation (kế hoạch, URS/FS, IQ/OQ/PQ cho quy trình backup và restore).
