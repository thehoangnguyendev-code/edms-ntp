# Kế hoạch: thông báo trong ứng dụng và e-mail theo ngôn ngữ người dùng

Ngày lập: 26/11/2026. Trạng thái: **đề xuất, chờ chủ dự án duyệt. Chưa sửa mã.**

## 1. Quyết định đã có (chủ dự án, 26/11/2026)

| Mã | Quyết định |
|---|---|
| N1 | Người chưa chọn ngôn ngữ nhận tiếng Anh |
| N2 | Thông báo cũ đổi theo khi người dùng đổi ngôn ngữ |
| N3 | Chủ dự án duyệt bản dịch tiếng Việt |
| N4 | E-mail gửi người ngoài công ty viết song ngữ |

## 2. Hiện trạng (đọc từ mã và cơ sở dữ liệu DEV, chỉ đọc)

- Ngôn ngữ người dùng chọn đã lưu ở `user_localization_preferences`. Mới có 3 người lưu.
- Mẫu thông báo (`notification_template_versions`) không có cột ngôn ngữ. Đang dùng 137 mẫu trong ứng dụng và 142 mẫu e-mail.
- **84/137 mẫu trong ứng dụng và 90/142 mẫu e-mail chỉ hiển thị lại câu do mã ghép sẵn** (`{{title}}`, `{{message}}`, `{{actionComment}}`). Riêng Training có 43 sự kiện như vậy, và 29 chỗ trong mã viết thẳng câu tiếng Anh. Dịch mẫu không dịch được các câu này.
- Thông báo cũ (`user_notifications`): 35.523 dòng, lưu sẵn tiêu đề và nội dung.
  - 22.877 dòng có mã sự kiện và đủ giá trị để dựng lại bằng tiếng khác.
  - 3.620 dòng có mã sự kiện nhưng nội dung là câu ghép sẵn.
  - Khoảng 9.000 dòng kiểu cũ, phần lớn không lưu giá trị.
- Chưa dòng nào ghi phiên bản mẫu đã dùng lúc gửi.

## 3. Giới hạn của N2

Chỉ dựng lại được thông báo còn lưu giá trị. Đề xuất:

| Nhóm | Hiển thị khi người dùng chọn tiếng Việt |
|---|---|
| Có đủ giá trị (22.877) | Tiếng Việt, dựng lại từ mẫu |
| Câu ghép sẵn và kiểu cũ (khoảng 12.600) | Giữ nguyên tiếng Anh; chỉ dịch tiêu đề khi trùng tiêu đề đã biết |
| Gửi sau khi làm xong | Tiếng Việt đầy đủ |

Bản gốc đã gửi (cột `title`, `message`) **không bị ghi đè**: đó là hồ sơ người nhận đã thấy lúc đó. Bản dịch chỉ là cách hiển thị.

## 4. Thiết kế

### 4.1 Mẫu có ngôn ngữ

- Thêm cột `language` (`en`, `vi`), khoá duy nhất thành (chính sách, kênh, ngôn ngữ, số phiên bản).
- Mẫu hiện có trở thành bản `en`. Bản `vi` mang cùng số phiên bản với bản `en` mà nó dịch.
- Sửa bản `en` thì bản `vi` bị đánh dấu "cần dịch lại" và tạm thời gửi bản `en`.
- Bản `vi` chỉ được dùng sau khi người duyệt xác nhận (ghi nhật ký kiểm toán).

### 4.2 Chọn ngôn ngữ khi gửi

Ngôn ngữ của người nhận; chưa chọn hoặc thiếu bản dịch đã duyệt thì `en`. Người nhận bên ngoài: e-mail song ngữ, tiếng Anh trước, tiếng Việt sau, trong cùng một thư.

### 4.3 Giá trị chèn vào mẫu

- Máy chủ gửi **mã và giá trị rời**, không gửi câu đã ghép. Ví dụ `actionCode=LOST`, `reason=...` thay cho cả câu.
- Mã (thao tác, trạng thái) được dịch bằng một từ điển ở máy chủ.
- Nội dung người dùng tự nhập (lý do, ghi chú, tên tài liệu) **giữ nguyên**.
- Ngày giờ giữ định dạng `dd/MM/yyyy HH:mm:ss`.

### 4.3a Phân loại placeholder (145 placeholder trong danh mục)

| Loại | Ví dụ | Cách xử lý ở bản tiếng Việt |
|---|---|---|
| Trung tính | recipientName, actorName, entityName, mã số, actionUrl, ngày giờ | Giữ nguyên |
| Từ của hệ thống | actionName, trạng thái, loại, tên module | Máy chủ gửi mã, dịch bằng từ điển |
| Người dùng nhập | actionComment khi là lý do, tên tài liệu, tên đợt rà soát | Giữ nguyên chữ đã nhập |
| Câu do mã ghép | title, message, actionComment khi là câu nhật ký | Không dịch được; phải đổi mã (giai đoạn 4) |

Mỗi placeholder được ghi loại trong danh mục. Mẫu còn dùng loại cuối **không được gửi song ngữ và không có bản vi**; chỉ gửi bản en cho tới khi đổi mã xong. Màn quản trị báo rõ lý do.

### 4.4 Trong ứng dụng: dựng lúc đọc

- Mỗi thông báo mới ghi thêm phiên bản mẫu đã dùng.
- Khi đọc: nếu có mã sự kiện, giá trị và bản dịch đã duyệt thì dựng theo ngôn ngữ người đọc; không thì trả bản gốc.
- Thông báo cũ chưa ghi phiên bản dùng mẫu đang hiệu lực, nên câu chữ tiếng Anh có thể khác bản đã nhận. Bản gốc vẫn xem được (nút "Xem bản gốc").
- Tìm kiếm trong hộp thông báo hiện tìm trên chữ tiếng Anh. Đợt đầu giữ vậy.

### 4.5 Quản trị mẫu

Hai tab ngôn ngữ, cột "Bản dịch" ở danh sách (đã duyệt, chờ duyệt, cần dịch lại, chưa có), bộ lọc theo cột đó, xem trước cả hai thứ tiếng.

## 5. Lộ trình

| Giai đoạn | Nội dung | Xong khi |
|---|---|---|
| 1 | Cột ngôn ngữ, chọn theo người nhận, lùi về `en`, quản trị và duyệt bản dịch | Gửi thử một sự kiện cho hai người khác ngôn ngữ ra hai bản |
| 2 | Dựng lúc đọc cho thông báo trong ứng dụng | Đổi ngôn ngữ thì hộp thông báo đổi theo |
| 3 | Dịch các mẫu chỉ có giá trị rời: Document Control, bản sao, bảo mật | Chủ dự án duyệt từng đợt |
| 4 | Đổi mã đang ghép câu sang gửi giá trị rời, Training trước | Không còn mẫu `{{message}}` trong module |
| 5 | E-mail song ngữ cho người ngoài; khung thư, nút bấm; loại thông điệp kiểu cũ | |

Giai đoạn 4 tốn công nhất.

Kiểm thử mỗi giai đoạn: thiếu bản dịch thì lùi về `en`; bản chưa duyệt không được gửi; người đọc chỉ thấy thông báo của mình; bản gốc không đổi; e-mail mật khẩu và mã xác thực vẫn gửi được.

Trước khi sửa mã: phân tích ảnh hưởng GitNexus cho `NotificationDispatcher`, `NotificationService`, `TrainingNotifier`.

## 6. Còn cần chốt

| Mã | Câu hỏi | Đề xuất |
|---|---|---|
| N5 | Đồng ý giữ tiếng Anh cho khoảng 12.600 thông báo cũ không dựng lại được? | Đồng ý |
| N6 | Có cho xem bản gốc của thông báo đã dịch? | Có |
| N7 | Duyệt bản dịch theo đợt module hay từng mẫu một? | Theo đợt module, ký một lần mỗi đợt |
| N8 | "Người ngoài" gồm những ai: người nhận bản sao không có tài khoản, người mở đường link chia sẻ kiến thức? | Mọi địa chỉ không gắn với tài khoản |

## 7. Đã làm (26/11/2026): tab Tiếng Việt trong màn sửa nội dung

- Khác §4.1: bản dịch nằm ở **bảng riêng** `notification_template_translations` (V863), không thêm cột ngôn ngữ vào bảng phiên bản tiếng Anh, để mọi chỗ đang đọc mẫu tiếng Anh không thể lấy nhầm bản Việt.
- Đếm trên bản sao dữ liệu DEV khi kiểm tra (trước khi khoá thêm `comment`, `recallReason`): 143 sự kiện; trong ứng dụng 45 dịch được, 92 giữ tiếng Anh, 6 chưa có nội dung; e-mail 39 dịch được, 103 giữ tiếng Anh, 1 chưa có nội dung.
- Chưa làm: mẫu "email messages", đường gửi e-mail theo chính sách trong EmailNotificationService, gửi thử bằng tiếng Việt, khung và chân e-mail, thông báo cũ trong hộp (N2), e-mail ngoài song ngữ (N4), bước duyệt riêng cho bản Việt (N3).

### 7.1 Chủ dự án chốt lại (26/11/2026)

Mọi mẫu đều dịch được, chỉ cần giữ nguyên placeholder. Bỏ việc khoá mẫu và bỏ việc gửi tiếng Anh theo từng lần; số liệu "giữ tiếng Anh" ở trên không còn áp dụng. Màn sửa ghi rõ placeholder nào máy chủ có thể điền chữ tiếng Anh. Muốn giá trị cũng bằng tiếng Việt thì máy chủ phải gửi mã thay vì câu (§4.3), chưa làm.

### 7.2 Giá trị cố định bằng tiếng Việt và nút chép (26/11/2026)

- Đã làm: `NotificationValueWords` (chỉ áp khi dùng bản Việt), xem trước theo cùng bảng, nút "Chép từ bản tiếng Anh".
- Còn lại: câu do mã ghép (`{{title}}`, `{{message}}`, `{{detail}}`) ở sao lưu, bảo trì, báo cáo, đào tạo, thu hồi quá hạn, dung lượng; lý do do hệ thống tự viết. Muốn có tiếng Việt thì từng nơi gửi phải dựng thêm câu tiếng Việt hoặc gửi mã.
