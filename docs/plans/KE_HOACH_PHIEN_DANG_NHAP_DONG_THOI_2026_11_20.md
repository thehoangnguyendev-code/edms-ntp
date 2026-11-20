# Phương án hoàn chỉnh: đăng nhập nhiều thiết bị, chia sẻ tài khoản và truy vết người ký (2026-11-20)

Trạng thái: THIẾT KẾ, chưa có code nào được sửa cho các phần ở mục 6 đến 9. Thay thế bản `KE_HOACH_PHIEN_DANG_NHAP_DONG_THOI_2026_11_19.md`.
Những việc đã làm xong và đã kiểm tra trước đó: tách bộ đếm sai mật khẩu lúc đăng nhập và lúc ký (V824), màn Logged in Users tự cập nhật theo thời gian thực. Chúng được ghi ở mục 4.1.
Cần QA/chủ sản phẩm chốt các quyết định ở mục 10 trước khi làm. Theo quy tắc dự án, các giá trị mặc định và hành vi khi vượt giới hạn là quyết định chính sách và phải có mục trong `DECISION_LOG.md`.
Nhãn bằng chứng: [nguồn] = đọc trong code; [web] = tài liệu công khai; [thứ cấp] = bài tổng hợp, chưa đối chiếu văn bản gốc; [chưa kiểm] = suy đoán, chưa xác minh.

## 1. Bài toán: bốn vấn đề khác nhau, không nên gộp

| Mã | Vấn đề | Ví dụ | Bản chất |
|---|---|---|---|
| A | Một người hợp lệ dùng nhiều thiết bị | Quản lý QA dùng máy bàn và laptop | Tiện lợi, chấp nhận được |
| B | Nhiều người cùng dùng một tài khoản | Hai nhân viên biết chung tên đăng nhập và mật khẩu | Vi phạm toàn vẹn dữ liệu, không chấp nhận |
| C | Hai yêu cầu đến cùng một khoảnh khắc | Hai máy cùng nhập sai mật khẩu, cùng đăng nhập | Lỗi đồng thời trong code, có thể vượt giới hạn |
| D | Không biết ai thật sự bấm ký | Chữ ký ghi IP và trình duyệt, không ghi phiên | Thiếu bằng chứng khi điều tra |

Hệ thống không thể phân biệt A với B chỉ bằng kỹ thuật: "một người ở hai máy" và "hai người thay phiên nhau" trông giống nhau. Vì vậy phương án không dựa vào một biện pháp duy nhất. Nó gồm nhiều lớp: ràng buộc danh tính vào yếu tố cá nhân, phát hiện bất thường, bằng chứng cho điều tra, và giới hạn như lớp phụ.

## 2. Nguyên tắc thiết kế
1. Server quyết định, FE chỉ hiển thị. Mọi quy tắc, ngưỡng và văn bản cảnh báo nằm ở BE và cấu hình, không viết cứng ở FE.
2. Không tuyên bố điều hệ thống không biết. Cảnh báo ghi "có dấu hiệu", không ghi "có người dùng chung".
3. Mặc định không làm hỏng công việc đang dở: không đá phiên đang làm việc, không khoá người dùng vì tín hiệu mơ hồ.
4. Mọi tác động lên phiên và mọi tín hiệu bất thường đều có audit, người điều tra truy ngược được.
5. Bật tắt từng lớp bằng cấu hình có chữ ký. Phát hành đầu tiên ở chế độ chỉ ghi nhận và cảnh báo, chưa chặn.
6. Không thu thập thêm dữ liệu cá nhân ngoài mức cần thiết (xem 6.3).
7. Không dùng nhãn hiển thị làm giá trị máy; mã trạng thái, mã tín hiệu và mã lỗi là hằng ổn định.

## 3. Căn cứ

### 3.1 Quy định (EU GMP, PIC/S, 21 CFR Part 11)
- Annex 11 hiện hành (2011): kiểm soát truy cập vật lý và logic tương xứng mức tới hạn; việc tạo, đổi, huỷ quyền phải được ghi lại [thứ cấp].
- Dự thảo Annex 11 (công bố 7/2025, đang lấy ý kiến), mục 11 [thứ cấp, cần đối chiếu bản chính thức]:
  - 11.1 tài khoản duy nhất và cá nhân; dùng chung có quyền ghi là vi phạm toàn vẹn dữ liệu.
  - 11.3 xác định người dùng với độ chắc chắn cao.
  - 11.6 MFA cho truy cập từ xa vào hệ thống tới hạn.
  - 11.7 khoá sau số lần sai định trước; chỉ quản trị viên mở khoá sau khi xác nhận không có truy cập trái phép.
  - 11.8 tự đăng xuất khi không hoạt động, người dùng không tắt được.
  - 11.9 nhật ký truy cập: tên đăng nhập, vai trò nếu có, giờ đăng nhập và đăng xuất, kể cả đăng xuất do không hoạt động; sắp xếp, tìm kiếm hoặc xuất được.
  - 11.11 rà soát quyền định kỳ có ghi nhận hành động.
  - Xác thực lại đầy đủ khi ký.
  - Không nguồn nào nhắc tới giới hạn đăng nhập đồng thời.
- PIC/S PI 041-1: nguyên tắc truy vết (attributable); các phát hiện thanh tra thường gặp là mật khẩu chung và tài khoản dùng chung [thứ cấp].
- 21 CFR 11.200: chữ ký có hai thành phần định danh; "phiên liên tục" do tổ chức tự định nghĩa [web]. 11.300(d): biện pháp chống dùng trái phép mã và mật khẩu, phát hiện và báo cáo nỗ lực dùng trái phép; chưa đọc được văn bản.

### 3.2 Thực hành của các sản phẩm khác
- Veeva Vault: thời gian không hoạt động do admin đặt, phiên tối đa 48 giờ; tài liệu không nói giới hạn số phiên [web].
- Axonius: giới hạn 1 đến 10, mặc định tắt, vượt thì chấm dứt phiên cũ nhất. UiPath: một người một phiên, đăng nhập mới chấm dứt phiên cũ [web].
- Khoá riêng cho chữ ký: GE Digital, Staedean, SAP, BoldSign; Ideagen dùng chung bộ đếm đăng nhập [web].
- Không tìm được tài liệu công khai của TrackWise, MasterControl, Qualio, ComplianceQuest: không kết luận về họ.

## 4. Hiện trạng và khoảng trống

### 4.1 Đã có [nguồn]
- Mỗi lần đăng nhập tạo một `AuthSession` riêng; không có giới hạn số phiên, không phiên nào bị chấm dứt khi phiên khác đăng nhập.
- `POST /auth/touch` là nhịp tim chỉ gọi khi người dùng tương tác thật; vì vậy `last_activity_at` phản ánh hoạt động thật chứ không phải lời gọi nền. Các yêu cầu nền không cập nhật nó.
- Khoá phiên khi không hoạt động, mở khoá bằng mật khẩu rồi mã xác minh nếu có.
- `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `DELETE /auth/sessions` (thu hồi phiên khác); màn hồ sơ có nút thu hồi phiên khác.
- Màn Logged in Users (admin), force logout theo người dùng, và từ 2026-11-19 tự cập nhật qua tín hiệu `USER_SESSION` chỉ gửi cho người có quyền `settings.user.view`.
- Khoá tài khoản; từ V824 bộ đếm sai khi ký (`failed_signature_count`) và giới hạn `maxSignatureAttempts` tách khỏi bộ đếm đăng nhập; công tắc "Enable Account Lockout" dùng chung.
- Thiết bị tin cậy MFA theo người dùng (`MfaTrustedDevice`: tên thiết bị, IP, trình duyệt, 8 giờ).
- Chữ ký điện tử lưu username, họ tên, IP, trình duyệt, múi giờ, phương thức xác thực (`ElectronicSignature`).
- Audit đăng nhập (`auth_audit_logs`: loại sự kiện, IP, trình duyệt, chi tiết) và audit trail `LOGIN`, `LOGOUT`, `ACCOUNT_LOCKED`, `SESSION_LOCKED_IDLE_TIMEOUT`.
- Sổ đăng ký sự kiện thông báo (`NotificationEventCatalogBootstrap`, `NotificationDefaultChannels`) đã có `security.account_locked`, `security.refresh_token_reuse`, `security.mfa_updated`.

### 4.2 Khoảng trống
| Mã | Khoảng trống | Vấn đề | Mức |
|---|---|---|---|
| G1 | Không giới hạn và không phát hiện đăng nhập song song | A, B | Trung bình |
| G2 | Không cảnh báo chủ tài khoản khi có thiết bị hoặc IP mới | B | Trung bình |
| G3 | Không khoá dòng người dùng khi cập nhật bộ đếm sai; `UserAccount` không có `@Version` hay khoá bi quan. Hai lần nhập sai cùng lúc có thể bị tính thiếu và kẻ tấn công thử được nhiều hơn giới hạn | C | Cao |
| G4 | Tạo phiên không tuần tự hoá theo người dùng; nếu sau này có giới hạn số phiên, hai đăng nhập đồng thời đều có thể lọt | C | Cao khi bật giới hạn |
| G5 | `signatureToken` chỉ chứa người dùng, vai trò, mã ngẫu nhiên, hạn dùng; không gắn với phiên hay thiết bị. Bản ghi chữ ký có IP và trình duyệt nhưng không có mã phiên | D | Trung bình |
| G6 | Chưa kiểm: nhật ký truy cập có đủ vai trò tại lúc đăng nhập, giờ đăng xuất, đăng xuất do không hoạt động và xuất được hay chưa (11.9) | Tuân thủ | Cần kiểm tra |
| G7 | "Khoá phiên" khi không hoạt động có thoả "đăng xuất khi không hoạt động" (11.8) không: cần QA xác nhận | Tuân thủ | Cần quyết định |
| G8 | Không có nơi tập trung xem các tín hiệu bất thường để QA điều tra và đóng | B | Trung bình |

## 5. Kiến trúc: sáu lớp bảo vệ

```
L1 Danh tính cá nhân  ->  L2 Kiểm soát phiên  ->  L3 Phát hiện bất thường
        |                        |                        |
        v                        v                        v
L4 Ràng buộc chữ ký  ->  L5 Chống đồng thời  ->  L6 Điều tra và minh bạch
```

- L1 làm cho việc chia sẻ khó (phải chia sẻ cả yếu tố cá nhân).
- L2 giới hạn tác hại và giảm phiên bị bỏ quên.
- L3 phát hiện dấu hiệu và báo đúng người.
- L4 để hành động quan trọng nhất (ký) truy được về một phiên và thiết bị.
- L5 sửa lỗi đồng thời trong code để các giới hạn có tác dụng thật.
- L6 cho QA và người dùng thấy, điều tra và đóng.

## 6. Thiết kế chi tiết

### 6.1 L1. Danh tính cá nhân
- Giữ MFA hiện có (ứng dụng hoặc e-mail cá nhân). Thêm cấu hình "bắt buộc MFA cho mọi tài khoản" (đã có `enable2FA` trong cấu hình bảo mật; kiểm tra nó đang được thực thi hay chỉ lưu) [chưa kiểm].
- Bảo đảm mật khẩu tạm của tài khoản mới bắt buộc đổi ở lần đầu (đã có `forcePasswordChangeOnFirstLogin`), để quản trị viên không biết mật khẩu cuối (dự thảo 11.4).
- Cam kết tài khoản cá nhân: ở lần đăng nhập đầu và mỗi kỳ rà soát quyền, người dùng xác nhận "tài khoản này là của riêng tôi, tôi không chia sẻ mật khẩu hay mã xác minh". Lưu thời điểm và phiên bản văn bản (D-SES-7).
- Không thêm cơ chế "đăng nhập bằng thiết bị tin cậy bỏ qua mật khẩu".

### 6.2 L2. Kiểm soát phiên
Cấu hình (trong System Configuration, đổi có chữ ký và audit như `sessionTimeoutMinutes`):

| Khoá | Ý nghĩa | Mặc định đề xuất |
|---|---|---|
| `maxConcurrentSessions` | Số phiên hiệu lực tối đa mỗi người; 0 = không giới hạn | 0 ở lần phát hành đầu |
| `concurrentSessionAction` | `REVOKE_OLDEST` hoặc `BLOCK_NEW` | `REVOKE_OLDEST` |
| `activeSessionGraceMinutes` | Phiên có tương tác trong khoảng này không bị thu hồi | 5 |

Tuỳ chọn riêng theo Access Profile: cột `max_concurrent_sessions` (null = theo hệ thống); người có nhiều profile lấy giá trị chặt nhất (D-SES-3).

Thuật toán khi tạo phiên (trong cùng giao dịch, xem L5):
1. Khoá dòng người dùng (`SELECT ... FOR UPDATE`).
2. Đếm phiên còn hiệu lực: chưa thu hồi, trạng thái ACTIVE hoặc LOCKED, chưa hết hạn.
3. Nếu giới hạn là 0 hoặc số phiên nhỏ hơn giới hạn: tạo phiên.
4. Ngược lại, chọn phiên để thu hồi theo thứ tự: phiên LOCKED lâu nhất; rồi phiên ACTIVE có tương tác cũ hơn `activeSessionGraceMinutes`, cũ nhất trước.
5. Nếu không có phiên nào thu hồi được (mọi phiên đang hoạt động) hoặc action là `BLOCK_NEW`: từ chối đăng nhập với mã `SESSION_LIMIT_REACHED`, ghi audit; không thu hồi phiên đang làm việc.
6. Phiên bị thu hồi: ghi audit `SESSION_REVOKED_CONCURRENT_LIMIT` (người dùng, phiên bị thu hồi, phiên mới, thiết bị, IP, giới hạn). Lần làm mới token kế tiếp của phiên đó nhận mã lỗi `SESSION_REVOKED_CONCURRENT_LIMIT`, FE hiện thông báo rõ thay vì lỗi chung.
7. Phiên chỉ được tính sau khi đăng nhập hoàn tất (sau MFA); một thử thách MFA đang chờ không chiếm chỗ.

Bảng tình huống:

| Tình huống | Kết quả |
|---|---|
| Giới hạn 2, đang có 2 phiên, một phiên đã khoá | Thu hồi phiên khoá, tạo phiên mới |
| Giới hạn 2, cả 2 phiên đang làm việc | Theo D-SES-2 (đã chốt hướng "đăng nhập mới thắng", xem 6.2a): thu hồi phiên cũ nhất, không chặn đăng nhập mới |
| Hai đăng nhập đồng thời khi còn một chỗ | Tuần tự hoá bởi khoá dòng người dùng: một vào, một xử lý theo bước 4 và 5 |
| Người dùng tự thu hồi một phiên | Giải phóng chỗ ngay, có audit |
| Force logout bởi admin | Thu hồi mọi phiên, như hiện nay |

### 6.2a Hướng đã chọn: đăng nhập mới thắng, máy cũ được báo và đăng xuất (chủ sản phẩm, 2026-11-20)
Thay cho quy tắc bước 4 và 5 ở trên (không còn "bảo vệ phiên đang làm việc 5 phút" và không còn chặn đăng nhập mới):

- Khi máy B đăng nhập **thành công** (sau mật khẩu, và sau MFA nếu tài khoản có MFA), hệ thống thu hồi các phiên cũ vượt giới hạn (muốn "một người một phiên" thì đặt `maxConcurrentSessions` = 1). Phiên nào bị thu hồi được ghi audit `SESSION_REVOKED_CONCURRENT_LIMIT`.
- Thử thách MFA chưa hoàn tất không thu hồi gì (bước 7 giữ nguyên): máy A chỉ bị đăng xuất khi B vào được hệ thống.
- Máy A đang ở trong hệ thống: hiện **modal** bằng tiếng Anh, rồi đăng xuất về trang đăng nhập khi người dùng bấm OK:
  - Tiêu đề: "Signed out"
  - Nội dung: "This session has ended because the account was signed in on another device."
  - Modal không đóng được bằng nền hoặc phím Esc, chỉ có nút OK; không cho thao tác tiếp phía sau.
- Máy A đã đăng xuất sẵn: không có gì xảy ra, không thông báo.
- Cách máy A biết (ba đường, đường nào đến trước thì dùng, modal chỉ hiện một lần):
  1. Đẩy ngay qua kênh SSE hiện có (sự kiện theo người dùng, như `UserSessionBroadcaster`), để modal hiện trong vài giây.
  2. Yêu cầu API kế tiếp bị từ chối với mã `SESSION_REVOKED_CONCURRENT_LIMIT` (bộ lọc token đã kiểm tra phiên thu hồi mỗi yêu cầu).
  3. Thăm dò nền ~30 giây hiện có làm lưới an toàn nếu SSE đứt.
- Mã lỗi riêng giúp FE phân biệt với "hết phiên" hay "bị admin force logout" (các trường hợp đó giữ thông báo riêng của chúng).
- Rủi ro cần nêu cho QA: nội dung đang nhập dở trên máy A có thể mất khi bị đăng xuất. Giảm nhẹ: FE lưu nháp biểu mẫu nếu đã có cơ chế (chưa kiểm tra); nếu chưa, ghi là giới hạn đã biết. Người ký điện tử đang dở trên A: chữ ký thất bại vì phiên đã thu hồi, không ghi chữ ký nào.
- Hệ quả vận hành: hai người dùng chung một tài khoản sẽ liên tục đá nhau ra khỏi hệ thống. Đây là tín hiệu có chủ đích, đồng thời vẫn ghi `SESSION_REVOKED_CONCURRENT_LIMIT` để QA thấy mẫu lặp (tín hiệu `LIMIT_HIT_REPEATEDLY` ở 6.3 đổi nghĩa thành "bị đá từ 3 lần trong một ngày").

### 6.3 L3. Phát hiện bất thường
Mỗi quy tắc sinh một `tín hiệu bảo mật` (bảng mới `security_signals`), không tự khoá tài khoản.

| Mã | Điều kiện | Mức |
|---|---|---|
| `NEW_DEVICE` | Đăng nhập từ cặp (họ trình duyệt, hệ điều hành) chưa thấy trong 90 ngày gần nhất của người đó | Thấp |
| `CONCURRENT_IP` | Hai phiên hiệu lực cùng lúc có địa chỉ IP công khai khác nhau và đều có tương tác trong vòng N phút (N mặc định 10) | Trung bình |
| `ALTERNATING_LOGIN` | Từ 3 lần trở lên trong 2 giờ, phiên mới đẩy phiên cũ ra (do giới hạn) hoặc hai thiết bị thay phiên nhau | Trung bình |
| `CONCURRENT_SIGNATURE` | Hai chữ ký của cùng một người từ hai thiết bị khác nhau trong vòng M giây (M mặc định 60) | Cao |
| `LIMIT_HIT_REPEATEDLY` | `SESSION_LIMIT_REACHED` từ 3 lần trong một ngày | Thấp |

Quy tắc dùng ngưỡng cấu hình được, tất cả đều theo cặp (thiết bị, IP) chứ không theo vân tay trình duyệt. Chỉ lưu họ trình duyệt, hệ điều hành và IP; không thu thập vân tay thiết bị nào khác (giảm rủi ro dữ liệu cá nhân, mục 2.6).

Xử lý tín hiệu:
- Thông báo cho chủ tài khoản (e-mail bắt buộc, không tắt được vì là sự kiện bảo mật) với nút "Đây không phải tôi" dẫn tới thu hồi mọi phiên và yêu cầu đổi mật khẩu.
- Mức Trung bình trở lên đưa vào hàng đợi QA (màn mới "Security Signals") để điều tra, ghi nhận kết luận (hợp lệ, nghi ngờ, đã xử lý), có người và thời điểm.
- Tín hiệu đi vào kết quả Access Review của người đó.
- Cảnh báo `CONCURRENT_IP` không chặn; chặn chỉ khi QA bật chế độ nghiêm ngặt (D-SES-8).
- Sự kiện thông báo mới đăng ký trong sổ thông báo: `security.new_device_login`, `security.concurrent_session_alert`, `security.session_revoked_concurrent`.

### 6.4 L4. Ràng buộc chữ ký
- Giữ ký bằng username và mật khẩu như hiện nay (đạt 11.200 và yêu cầu xác thực lại của dự thảo Annex 11).
- Gắn `signatureToken` với phiên: thêm claim mã phiên khi cấp, kiểm tra khi dùng; token của phiên này không dùng được ở phiên khác.
- Ghi mã phiên và tên thiết bị vào bản ghi chữ ký (`ElectronicSignature`): thêm cột `auth_session_id` và `device_name` (hiện chỉ có IP và trình duyệt). Dữ liệu cũ để trống, không điền ngược.
- Tuỳ chọn cho chữ ký quan trọng (phê duyệt, phát hành, huỷ): thêm mã MFA khi ký, bật theo mã ý nghĩa chữ ký (`meaningCode`) trong cấu hình, mặc định tắt (D-SES-5).
- Định nghĩa "phiên liên tục" cho chữ ký: mọi lần ký đều xác thực lại đầy đủ, không phụ thuộc phiên đang mở (đã đúng hiện trạng); ghi vào quy trình.
- Bộ đếm sai khi ký tách riêng (đã làm, V824).

### 6.5 L5. Chống lỗi đồng thời
Mục tiêu: các giới hạn phải có tác dụng ngay cả khi yêu cầu đến cùng lúc.
- Thêm `UserAccountRepository.lockById(id)` dùng khoá bi quan ghi (`PESSIMISTIC_WRITE`, hết thời gian chờ ngắn).
- Dùng khoá này ở ba nơi: (1) cập nhật bộ đếm sai khi đăng nhập, khi mở khoá phiên và khi ký; (2) tạo phiên (L2); (3) mở khoá tài khoản bởi quản trị.
- Cách khác nếu khoá gây nghẽn: tăng bộ đếm bằng một câu lệnh nguyên tử (`UPDATE app_users SET failed_login_count = failed_login_count + 1 WHERE id = ?` rồi đọc lại), không đọc rồi ghi.
- Tuần tự hoá chỉ theo từng người dùng, không ảnh hưởng người khác; thời gian giữ khoá chỉ là phần đếm và ghi, không gồm kiểm tra mật khẩu bcrypt (kiểm tra mật khẩu làm trước khi vào khoá).
- Giới hạn tốc độ hiện có (`RateLimitFilter`) giữ nguyên, là lớp bổ sung chứ không thay cho khoá dòng.

### 6.6 L6. Điều tra và minh bạch
- Người dùng: trang "Phiên của tôi" liệt kê từng phiên (thiết bị, IP, hoạt động cuối, phiên hiện tại) và thu hồi từng phiên (dùng lại `GET/DELETE /auth/sessions`).
- Quản trị: màn Logged in Users thêm cột "Số phiên" và cờ khi vượt giới hạn hoặc có tín hiệu mở; force logout theo từng phiên (hiện theo người).
- QA: màn "Security Signals" (danh sách, lọc theo mã, mức, người, trạng thái; chi tiết có hai phiên liên quan; đóng với kết luận có chữ ký).
- Nhật ký truy cập (11.9): bảo đảm có đủ trường (tên đăng nhập, vai trò tại lúc đăng nhập, giờ đăng nhập, giờ đăng xuất, đăng xuất do không hoạt động, phiên bị thu hồi và lý do), sắp xếp, tìm kiếm, xuất được. Thiếu trường nào thì bổ sung qua audit hiện có, không tạo kho riêng.
- Báo cáo: nguồn báo cáo mới (Reports) "Concurrent sessions and signals" cho QA rà soát định kỳ.

## 7. Dữ liệu và API tóm tắt
| Thành phần | Thay đổi |
|---|---|
| `system_configurations.security_config` | `maxConcurrentSessions`, `concurrentSessionAction`, `activeSessionGraceMinutes`, ngưỡng tín hiệu (`concurrentIpWindowMinutes`, `concurrentSignatureSeconds`, `newDeviceLookbackDays`), `mfaOnSignatureMeanings[]` |
| `roles` (Access Profile) | `max_concurrent_sessions` nullable |
| `electronic_signatures` | `auth_session_id`, `device_name` (nullable, không điền ngược) |
| Bảng mới `security_signals` | mã, mức, người dùng, các phiên liên quan, chi tiết JSON, trạng thái, người xử lý, kết luận, thời điểm |
| Bảng mới `account_pledges` (nếu D-SES-7 đồng ý) | người dùng, phiên bản văn bản, thời điểm xác nhận |
| API mới | `GET /security/signals`, `GET /security/signals/{id}`, `POST /security/signals/{id}/close` (có chữ ký) |
| API đã có, mở rộng | `GET /auth/sessions` thêm trường cảnh báo; `GET /settings/users/sessions` thêm số phiên và cờ |
| Mã lỗi mới | `SESSION_LIMIT_REACHED`, `SESSION_REVOKED_CONCURRENT_LIMIT` |
| Sự kiện audit mới | `SESSION_REVOKED_CONCURRENT_LIMIT`, `SESSION_LIMIT_REACHED`, `SECURITY_SIGNAL_RAISED`, `SECURITY_SIGNAL_CLOSED` |

## 8. Các giai đoạn
Quy ước: mỗi giai đoạn dùng một bản ghi thay đổi theo `08_ONE_CHANGE_RECORD_TEMPLATE.md`; trước khi sửa symbol chạy impact analysis; trước khi commit giữ bằng chứng `detect_changes`; chỉ thử trên DEV.

### Giai đoạn 0. Chốt quyết định và đo hiện trạng
- QA chốt D-SES-1 đến D-SES-10 (mục 10), ghi vào `DECISION_LOG.md`.
- Kiểm các điểm [chưa kiểm]: `enable2FA` có được thực thi; nhật ký truy cập có đủ trường 11.9; mức chữ ký xác thực lại ở mọi nơi; giới hạn của thời gian chờ phiên.
- Ra: bảng "đã có, thiếu" cập nhật vào tài liệu này.

### Giai đoạn 1. Sửa lỗi đồng thời (G3, G4 nền tảng). Làm trước, độc lập
- Thêm khoá dòng người dùng và dùng ở ba nơi (6.5).
- Test: bắn N yêu cầu sai mật khẩu song song vào một tài khoản, khẳng định tài khoản bị khoá đúng ở lần thứ giới hạn và bộ đếm không thấp hơn số lần thử; cùng cho đường ký; N yêu cầu đăng nhập song song không gây deadlock hay lỗi.
- Không đổi hành vi nhìn thấy được; không cần quyết định chính sách.

### Giai đoạn 2. Bằng chứng và minh bạch (G5, G6, G7 phần kỹ thuật)
- Gắn `signatureToken` với phiên; thêm `auth_session_id` và `device_name` vào bản ghi chữ ký.
- Hoàn thiện nhật ký truy cập theo 11.9; trang "Phiên của tôi".
- Test: token của phiên khác bị từ chối; bản ghi chữ ký mới có mã phiên; dữ liệu cũ không bị đổi.

### Giai đoạn 3. Phát hiện và cảnh báo (G2, G8)
- Bảng `security_signals`, năm quy tắc ở 6.3, sự kiện thông báo mới, màn "Security Signals".
- Chế độ chỉ cảnh báo, không chặn.
- Test: mỗi quy tắc có ca dương và ca âm (IP động của văn phòng, nhiều thiết bị hợp lệ cùng một IP không sinh `CONCURRENT_IP`); cảnh báo gửi đúng một lần; không lộ dữ liệu phiên của người khác.

### Giai đoạn 4. Giới hạn số phiên (G1)
- Cấu hình, thuật toán 6.2, mã lỗi và thông báo FE, giới hạn theo Access Profile nếu được duyệt.
- Mặc định 0 (tắt). Bật trên DEV để thử, TEST/PROD do QA quyết định.
- Test: thuật toán ở từng nhánh của bảng tình huống; song song N đăng nhập khi còn một chỗ chỉ một vào; không bao giờ vượt giới hạn; giới hạn 0 không đổi hành vi hiện tại.

### Giai đoạn 5. Chữ ký MFA tuỳ chọn và cam kết cá nhân (nếu duyệt)
- Cấu hình `mfaOnSignatureMeanings`; bước nhập mã khi ký; cam kết tài khoản cá nhân.

### Giai đoạn 6. Chứng cứ validation và phát hành
- Ma trận truy vết yêu cầu (11.1, 11.7, 11.8, 11.9, PI 041-1 truy vết, 21 CFR 11.200, 11.300(d)) đến test.
- Ghi giới hạn đã biết: test Spring tích hợp chưa chạy được trên máy này (thiếu khoá mã hoá outbox thông báo).
- Thử trên DEV với hai tài khoản và nhiều trình duyệt; chụp màn hình.
- Cập nhật phụ lục "việc chưa làm" của SDS sau mỗi giai đoạn.

Thứ tự theo lợi ích trên công sức: 1, rồi 2, rồi 3, rồi 4, rồi 5. Giai đoạn 1 và 2 không phụ thuộc quyết định chính sách và đã giải quyết C và D.

## 9. Kế hoạch kiểm thử và bằng chứng
| Rủi ro | Kiểm tra | Loại |
|---|---|---|
| Vượt giới hạn do đồng thời | N yêu cầu song song, khẳng định bất biến | Đồng thời |
| Đá nhầm phiên đang làm việc | Mọi phiên có tương tác trong thời gian ân hạn: chặn phiên mới, không thu hồi | Âm |
| Cảnh báo giả vì IP dùng chung | Nhiều thiết bị cùng IP văn phòng: không sinh `CONCURRENT_IP` | Âm |
| Người khác đọc được dữ liệu phiên | Tín hiệu và danh sách phiên chỉ cho chủ và người có quyền | Quyền |
| Token ký dùng lại ở phiên khác | Token gắn phiên bị từ chối ở phiên khác | Âm |
| Lỗi giữa chừng để lại phiên mồ côi | Thu hồi và tạo phiên trong một giao dịch; lỗi thì không đổi gì | Lỗi |
| Giá trị cấu hình sai | Kiểm tra khoảng, đổi cấu hình không chữ ký bị từ chối | Âm |

## 10. Quyết định cần QA và chủ sản phẩm chốt
| Mã | Quyết định | Đề xuất |
|---|---|---|
| D-SES-1 | Có giới hạn số phiên đồng thời không, và mặc định bao nhiêu | **Đã chốt, ghi trong `DECISION_LOG.md` và đã cài đặt:** có; mặc định 0 (tắt). Giá trị dùng ở production (gợi ý 3, hoặc 1 nếu một thiết bị) **chưa chọn**, QA quyết định sau |
| D-SES-2 | Khi vượt: thu hồi phiên cũ hay chặn phiên mới | **Đã chốt, ghi trong `DECISION_LOG.md` (SESSION-CONCURRENT-LIMIT-2026-11-20) và đã cài đặt:** đăng nhập mới thắng, thu hồi phiên cũ nhất kể cả đang hoạt động, máy cũ nhận modal tiếng Anh rồi đăng xuất (mục 6.2a) |
| D-SES-3 | Giới hạn chặt hơn cho nhóm quyền cao (cấu hình, ký duyệt QA) | Có, theo Access Profile |
| D-SES-4 | "Khoá phiên" có thoả 11.8 không, hay cần đăng xuất hẳn sau thời hạn dài hơn | QA xác nhận; nếu cần, đăng xuất hẳn sau thời hạn dài (ví dụ 8 giờ) |
| D-SES-5 | MFA khi ký cho chữ ký nào | Mặc định tắt; bật cho phê duyệt và phát hành khi QA yêu cầu |
| D-SES-6 | Định nghĩa "thiết bị mới" và kênh cảnh báo | Cặp (họ trình duyệt, hệ điều hành), 90 ngày; e-mail bắt buộc |
| D-SES-7 | Cam kết tài khoản cá nhân | Có, ở lần đăng nhập đầu và mỗi kỳ rà soát quyền |
| D-SES-8 | Ngưỡng và hành động cho tín hiệu bất thường: chỉ cảnh báo hay chặn | Chỉ cảnh báo; chặn là chế độ nghiêm ngặt tuỳ chọn |
| D-SES-9 | Ai nhận cảnh báo trong QA và thời hạn đóng tín hiệu | QA Manager và người được chỉ định; đóng trong 5 ngày làm việc |
| D-SES-10 | Thời gian lưu tín hiệu và thông tin thiết bị | Theo chính sách lưu audit hiện hành; không lưu vân tay thiết bị |

## 11. Rủi ro và cách giảm
- Người dùng thật cần nhiều máy: mặc định giới hạn 0, bật có chủ đích, nâng giới hạn theo nhóm.
- Cảnh báo giả: so thiết bị trước, IP sau; không tự khoá; QA đóng với lý do.
- Quyền riêng tư: chỉ lưu họ trình duyệt, hệ điều hành, IP; thông báo cho người dùng biết điều gì được ghi; tuân theo bản thông báo quyền riêng tư hiện có.
- Khoá dòng gây nghẽn: giữ khoá ngắn, kiểm tra mật khẩu trước khi vào khoá; theo dõi thời gian chờ khoá khi thử.
- Căn cứ pháp lý là dự thảo: kiểm tra văn bản chính thức khi Annex 11 ban hành; các điểm lệ thuộc dự thảo được đánh dấu trong ma trận truy vết.
- Thiếu bằng chứng cũ: dữ liệu chữ ký trước giai đoạn 2 không có mã phiên; ghi rõ trong tài liệu validation.

## 12. Không làm
- Cấm hẳn đăng nhập nhiều thiết bị cho mọi người dùng.
- Tự khoá tài khoản chỉ vì tín hiệu phát hiện song song.
- Thu thập vân tay trình duyệt, định vị chính xác, hay theo dõi hành vi người dùng.
- Đăng nhập bằng thiết bị tin cậy bỏ qua mật khẩu.
- Giới hạn ở lớp SSO bên ngoài (hệ thống hiện đăng nhập nội bộ).

## 13. Nguồn
- Veeva Vault API, Session Management: https://general.veevavault.dev/vault-api/explanation/session-management.md
- Dự thảo Annex 11 2025, tóm tắt mục 11 (ProPharma): https://www.propharmagroup.com/thought-leadership/annex-11-2011-version-vs.-annex-11-2025-draft-version
- Dự thảo Annex 11 2025, các mục 11.1 đến 11.11: https://investigationsquality.com/tag/passkey/
- EU GMP Annex 11 (2011), văn bản chính: https://health.ec.europa.eu/system/files/2016-11/annex11_01-2011_en_0.pdf
- Bản dự thảo Annex 11, Annex 22 và Chapter 4: https://gmp-compliance.org/gmp-news/drafts-of-eu-gmp-guideline-annex-11-annex-22-and-chapter-4-released-for-comment
- PIC/S PI 041-1: https://gmp-compliance.org/gmp-news/pic-s-publishes-final-document-on-data-integrity
- 21 CFR 11.200: https://www.law.cornell.edu/cfr/text/21/11.200
- 21 CFR 11.300: https://www.law.cornell.edu/cfr/text/21/11.300
- Giới hạn phiên của UiPath: https://docs.uipath.com/automation-cloud/docs/session-policy
- Giới hạn phiên của Axonius: https://docs.axonius.com/pl/docs/managing-timeout
- Khoá chữ ký của GE Digital: https://www.ge.com/digital/documentation/workflow/r_wf_failure_limits_on_electronic_signatures.html
