# Chiến lược ba môi trường DEV, TEST, PROD theo SDLC và EU-GMP

Trạng thái: **ĐỀ XUẤT đã được triển khai một phần (cấu hình, kiểm tra, nhãn môi trường), chưa được QA duyệt.** Không phải bằng chứng As-Is và không phải phê duyệt GMP.
Ngày: 2026-10-08. Nhãn: **[ĐÃ KIỂM TRA]** thấy trong code hoặc hệ thống; **[ĐỀ XUẤT]** của người soạn; **[QUYẾT ĐỊNH]** chủ dự án / QA phải chốt; **[CHƯA LÀM]**.

## 1. Kết luận

- Hệ thống chia thành ba môi trường **tách vật lý, không chỉ tách tên**: mỗi môi trường có container, volume, cơ sở dữ liệu, MinIO, Redis, bí mật và cổng riêng.
- Tên bucket mang tên môi trường (`eqms-test-...`, `eqms-prod-...`) và backend **từ chối khởi động hoặc từ chối ghi** nếu bucket không thuộc môi trường đang chạy. Đây là lớp bảo vệ thứ hai, vì bucket thực tế còn có thể bị đổi trong DB qua màn Integration Settings **[ĐÃ KIỂM TRA]**.
- Mọi thứ bạn đang làm bây giờ là **DEV**. DEV giữ nguyên, không đổi dữ liệu, không đổi tên container, không đổi bucket.
- **PROD chưa được dựng** và không nên dựng trên PC phát triển. Chỉ có mẫu cấu hình. Lý do: bucket PROD khóa 100 năm, ghi nhầm là không xóa được (xem mục 7).

## 2. Ba môi trường

| | DEV | TEST | PROD |
|---|---|---|---|
| Mục đích | Phát triển, thử nghiệm kỹ thuật | Thẩm định (IQ/OQ/PQ), UAT, diễn tập backup/restore | Vận hành chính thức |
| Dữ liệu | Bỏ đi được, có thể xóa sạch | **Chỉ dữ liệu giả**, dựng lại được | Bản ghi GMP thật |
| Mã chạy | Build từ nguồn (`:local`) | **Release candidate** đã build một lần ở DEV, ghim tag | **Đúng image đã qua TEST**, ghim digest, không build lại |
| Cấu hình | `docker-compose.yml` | `docker-compose.yml` + `docker-compose.gmp.yml` | như TEST |
| Công cụ dev (Adminer, Mailhog) | Bật | Tùy chọn (`COMPOSE_PROFILES=dev-tools`) | **Không có** |
| Bí mật | Mặc định công khai được chấp nhận | Sinh riêng cho TEST | Sinh riêng, kho bí mật được duyệt |
| Migration `migration-dev` | Có | **Không** | **Không** |
| Strict secrets | Tùy | **Bắt buộc** | **Bắt buộc** |
| Bucket | `eqms-gmp-records`, `eqms-templates` (tên cũ, giữ nguyên) | `eqms-test-gmp-records`, `eqms-test-templates` | `eqms-prod-gmp-records`, `eqms-prod-templates` |
| Khóa đối tượng (Object Lock) | 100 năm (đang dùng, đề nghị cân nhắc BR môi trường E-2) | 1 năm | 100 năm |
| Ai được truy cập | Lập trình viên | Lập trình viên (chạy test), QA (thẩm định) | Quản trị vận hành và người dùng; lập trình viên **không** có quyền ghi |
| Nhãn trên giao diện | Thẻ `DEV` (xanh) | Thẻ `TEST` (vàng) | Không thẻ |
| Máy chủ | PC phát triển | Máy riêng (khuyến nghị) hoặc PC này chạy khi cần | **Máy chủ riêng đã được thẩm định** |

## 3. Cách tách [ĐÃ LÀM]

| Lớp | Cách làm | Chống được điều gì |
|---|---|---|
| Tên project, container | `EQMS_PROJECT`, `EQMS_CONTAINER_PREFIX` trong từng env file; mặc định là giá trị DEV hiện tại | Hai môi trường chạy chung một máy mà không đè nhau |
| Volume | Mỗi project Docker có volume riêng (tên tự mang tên project) | Dữ liệu lẫn giữa môi trường |
| Cổng | Mỗi môi trường dải cổng riêng (DEV 3000/5000/5432, TEST +100, PROD +200) | Xung đột cổng, kết nối nhầm |
| CSDL | Tên DB riêng (`eqms_test`, `eqms_prod`); backend từ chối tên DB của DEV (`eqms-database`) ở TEST/PROD | Dùng nhầm DB |
| Object store | Container MinIO riêng cho từng môi trường **và** tên bucket mang tên môi trường | Ghi nhầm vào kho của môi trường khác |
| Image | `EQMS_BACKEND_IMAGE`, `EQMS_FRONTEND_IMAGE`: DEV `:local`, TEST tag RC, PROD digest | Build lại giữa TEST và PROD |
| Bí mật | Mỗi env file bí mật riêng; script kiểm tra không trùng và không dùng giá trị DEV | Rò rỉ chéo môi trường |
| Công cụ dev | Adminer, Mailhog nằm trong profile `dev-tools`, tắt mặc định ở lớp GMP | Mở giao diện DB ở PROD |
| Nhãn | `GET /system/environment` (công khai, chỉ trả tên môi trường), thẻ ở Header | Nhầm môi trường khi thao tác |

### 3.1 Các kiểm soát bằng code
- `EnvironmentConfigurationValidator` (khi khởi động): môi trường phải là DEV, TEST hoặc PROD (không có mặc định ngầm cho giá trị lạ); bucket phải thuộc môi trường; TEST/PROD bắt buộc strict secrets, cấm `migration-dev`, cấm tên DB của DEV.
- `MinioObjectStorageService`: **mỗi lần** giải cấu hình lưu trữ, bucket hiệu lực (kể cả lấy từ DB) được kiểm theo môi trường. DEV bị cấm dùng tên bucket của TEST/PROD.
- 15 test đơn vị ở `EnvironmentConfigurationValidatorTest`; test lưu trữ có sẵn (`StorageLayoutTest`, `MinioStorageLiveTest`) vẫn đạt.

### 3.2 Kiểm tra tự động: `scripts/verify-environments.ps1`
Dựng cấu hình Compose thật của từng môi trường rồi so sánh. Thất bại (mã thoát 1) nếu: trùng tên project, container, cổng, DB, bucket hoặc bí mật; sai tiền tố bucket; TEST/PROD thiếu strict secrets, nạp `migration-dev`, dùng tên DB của DEV, dùng image `:local`; PROD có Adminer/Mailhog hoặc cookie không an toàn. Đã chứng minh bằng 3 kịch bản sai cố ý (bucket DEV ở TEST và trùng cổng; công cụ dev ở PROD; TEST dùng chung project với PROD): cả ba đều bị báo FAIL.

## 4. SDLC và luồng phát hành [ĐỀ XUẤT]

```
DEV  --(code + test đạt, change record)-->  Build RC (một lần)  -->  TEST  --(IQ/OQ/PQ đạt, QA duyệt)-->  PROD
 ^                                                                     |                                       |
 +---------------- sai sót / thay đổi mới, quay lại DEV <---------------+---------------------------------------+
```

| Cổng | Điều kiện | Người duyệt |
|---|---|---|
| DEV → RC | Test đơn vị và tích hợp đạt; hồ sơ thay đổi (mẫu `08_ONE_CHANGE_RECORD_TEMPLATE.md`); phân tích tác động; không còn migration đã áp dụng bị sửa | Lập trình viên + người rà soát |
| RC → TEST | Image ghim tag RC; ghi digest vào hồ sơ; cài đặt bằng quy trình như PROD (IQ) | QA |
| TEST → PROD | OQ/PQ đạt trên **đúng digest** này; không còn sai lệch mở; kế hoạch triển khai và quay lui; backup PROD trước khi cập nhật | QA + chủ hệ thống |
| Sau PROD | Kiểm tra sau cài đặt; ghi nhận trong Decision Log và hồ sơ thay đổi | QA |

Nguyên tắc:
- **Build một lần, đưa lên nhiều nơi.** Image qua TEST là image chạy ở PROD. Chỉ khác cấu hình (env file).
- **Mã không đi ngược**, không sửa trực tiếp trên TEST hay PROD. Sửa lỗi ở DEV rồi đi lại luồng.
- **Migration** chỉ đi theo một chiều; migration đã áp dụng không sửa. `migration-dev` không bao giờ lên TEST/PROD.
- **Quay lui** PROD: cài lại digest trước đó; nếu migration đã chạy thì theo kế hoạch quay lui của hồ sơ thay đổi (cần có từ trước).

## 5. Quy tắc dữ liệu [ĐỀ XUẤT]

- **PROD không chép xuống DEV hoặc TEST.** Cần dữ liệu thật để tái hiện lỗi: chỉ bản **đã ẩn danh hóa** và có QA duyệt, ghi hồ sơ.
- **TEST dùng dữ liệu giả**, sinh bằng tập lệnh có thể chạy lại; có thể xóa và dựng lại bất cứ lúc nào.
- **DEV được xóa sạch**: dừng stack và xóa volume. Bucket bị khóa chỉ được bảo vệ qua API; xóa volume MinIO của DEV vẫn xóa được dữ liệu DEV.
- **Không chép cấu hình giữa môi trường.** Cấu hình tích hợp (endpoint MinIO, SMTP, Microsoft Graph, OnlyOffice) nằm trong DB (`system_configurations.integrations_config`). Một DB sao chép từ môi trường khác mang theo địa chỉ cũ. Mọi sao chép DB phải qua tập lệnh đặt lại cấu hình tích hợp **[CHƯA LÀM]**; guard bucket chỉ chặn ghi vào bucket sai tên, **không** kiểm tra endpoint.
- **Backup mỗi môi trường tách riêng** (đích, khóa, sổ cái). Môi trường validation trong SDS Backup & Restore chính là **TEST**.

## 6. Quyền truy cập [ĐỀ XUẤT]

| Vai trò | DEV | TEST | PROD |
|---|---|---|---|
| Lập trình viên | Toàn quyền | Chạy test, xem log; không sửa dữ liệu thẩm định | **Không** truy cập ghi |
| QA | - | Thẩm định, ký | Duyệt, xem |
| Quản trị vận hành | - | - | Vận hành theo quy trình |
| Super Administrator (SDS Backup & Restore) | Tài khoản riêng của DEV | Tài khoản riêng của TEST | Tài khoản riêng của PROD, niêm phong |

Mỗi môi trường có tài khoản quản trị và bí mật riêng; không dùng chung mật khẩu.

## 7. Hiện trạng và cách chuyển

- **DEV [ĐÃ KIỂM TRA]:** stack đang chạy dùng `.env` ở thư mục gốc, project `eqms`, bucket cũ. Compose đã parameterize với **giá trị mặc định đúng bằng cấu hình cũ**, nên `docker compose up` cho kết quả giống trước, chỉ thêm biến `APP_ENVIRONMENT=DEV`.
- **Bucket cũ:** ba bucket hiện có (`eqms-gmp-revisions`, `eqms-gmp-records`, `eqms-templates`) là của DEV, không đổi tên được (MinIO không có đổi tên bucket). `eqms-gmp-records` chứa object bị khóa và cả thư mục `verification/` thử nghiệm; **không dùng nó làm PROD**.
- **TEST:** chưa chạy. Cần ảnh RC và `deploy/env/test.env`. Chạy thử trên PC này tốn tài nguyên (OnlyOffice cần ~5 GB).
- **PROD:** chưa dựng. Cần máy chủ riêng, nginx/HTTPS, kho bí mật, quy trình cài đặt (IQ).

## 8. Cách dùng

```
# xem cấu hình sẽ chạy (không khởi động gì)
powershell -File scripts/eqms-env.ps1 -Environment test -Action config

# kiểm tra ba môi trường không chạm nhau
powershell -File scripts/verify-environments.ps1
powershell -File scripts/verify-environments.ps1 -Files .env,deploy/env/test.env,deploy/env/prod.env   # trên máy có file thật

# chạy
powershell -File scripts/eqms-env.ps1 -Environment dev  -Action up
powershell -File scripts/eqms-env.ps1 -Environment test -Action up          # cần deploy/env/test.env, không còn CHANGE_ME
powershell -File scripts/eqms-env.ps1 -Environment prod -Action up -ConfirmProd   # chỉ trên máy chủ PROD
```
`eqms-env.ps1` từ chối: thiếu env file; env file còn `CHANGE_ME`; env file khai báo môi trường khác với môi trường được yêu cầu; PROD không có `-ConfirmProd`; build ở TEST/PROD (dùng `--no-build`).

## 9. Ánh xạ EU-GMP / GAMP **[QA xác nhận số điều khoản]**

| Yêu cầu (diễn giải) | Tham chiếu | Đáp ứng bởi |
|---|---|---|
| Hệ thống được thẩm định theo vòng đời; thử nghiệm trong môi trường phù hợp | Annex 11 §4; GAMP 5 | TEST tách biệt, cùng cấu hình với PROD, chạy đúng image sẽ phát hành |
| Kiểm soát thay đổi | Annex 11 §10 | Luồng DEV → TEST → PROD có cổng, hồ sơ thay đổi, quay lui |
| An ninh, tách quyền truy cập | Annex 11 §12 | Dev không ghi PROD; bí mật riêng; công cụ dev không có ở PROD |
| Toàn vẹn dữ liệu | PIC/S PI 041; ALCOA+ | Dữ liệu giả ở TEST; không chép PROD xuống thấp nếu chưa ẩn danh; nhãn môi trường tránh nhầm |
| Nhận diện rõ hệ thống/môi trường | thực hành tốt | Thẻ DEV/TEST ở Header; `GET /system/environment` |

## 10. Quyết định cần chốt

| ID | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| E-1 | TEST và PROD chạy ở đâu | TEST: máy riêng hoặc PC này khi cần; PROD: máy chủ riêng đã thẩm định |
| E-2 | DEV có nên tắt khóa Object Lock cho dễ dọn dữ liệu không | Cho phép; hiện DEV đang 100 năm. Cần kiểm tra code có hỗ trợ tắt khóa theo bucket trước |
| E-3 | Chính sách làm mới dữ liệu TEST | Dựng lại từ dữ liệu giả trước mỗi đợt thẩm định |
| E-4 | Quy ước đặt tên release candidate | `rc-{yyyyMMdd}-{n}`, ghi digest vào hồ sơ |
| E-5 | Ai duyệt chuyển TEST → PROD | QA + chủ hệ thống, ký điện tử |
| E-6 | Tên miền / địa chỉ từng môi trường | Chưa có |
| E-7 | Có cho phép bản ẩn danh PROD xuống TEST không | Chỉ với quy trình ẩn danh đã thẩm định và QA duyệt |

## 11. Giới hạn và chưa làm

- Chưa dựng thử TEST/PROD thật; mới chứng minh bằng cấu hình render và test.
- Guard bucket không kiểm tra endpoint MinIO trong DB (xem mục 5).
- Chưa có tập lệnh đặt lại cấu hình tích hợp khi sao chép DB.
- Chưa có CI tự động chạy `verify-environments.ps1` khi đổi cấu hình.
- Màn Integration Settings vẫn cho nhập bucket; sai tên bị chặn ở lần ghi đầu tiên, chưa chặn ngay lúc lưu cấu hình.
- Tiêu đề tab trình duyệt chưa có tiền tố môi trường.
