# Rà soát thông báo Document Control: ai nhận, mấy thư

Ngày 2026-11-27. **Chờ duyệt, chưa sửa code.** Nguồn: đọc mã nguồn và chính sách đang lưu trên DEV. Chỉ mời rà soát, mời phê duyệt sau rà soát và Reject đã được thử thật; các dòng khác là theo mã nguồn.

Từ dùng: **DCO** = mọi người có quyền Document Control (`documents.workspace.manage`). **Bản mới** = nội dung trong Quản trị Thông báo (hai ngôn ngữ, chỉnh được). **Mẫu cũ** = mẫu e-mail cũ gửi thẳng.

Nguyên tắc đề xuất: mỗi người một thư và một thông báo trong ứng dụng; chỉ người phải làm hoặc trực tiếp liên quan; nội dung lấy từ Quản trị Thông báo.

## A. Cần sửa

| # | Khi nào | Đang gửi cho | Đang gửi | Đề xuất người nhận | Đề xuất gửi |
|---|---|---|---|---|---|
| A1 | Submit for Review | Reviewer (lần lượt: người kế; song song: tất cả) | 2 thư: mẫu cũ "Review Required" và bản mới | Giữ nguyên | 1 thư bản mới |
| A2 | Xong rà soát, chuyển phê duyệt | Approver | 2 thư: "Approval Required" và "Review completed" | Approver | 1 thư mời phê duyệt |
| A3 | Thay Reviewer | Reviewer mới | 2 thư | Giữ nguyên | 1 thư |
| A4 | Phê duyệt xong, cần đào tạo | Author, Co-Author, Reviewer, Approver, mọi DCO | 1 e-mail mẫu cũ và 1 thông báo trong ứng dụng | Author, DCO | Bản mới |
| A5 | Phê duyệt xong, sẵn sàng publish | DCO | E-mail mẫu cũ, thông báo "approved" | DCO | Bản mới "Ready for Publishing" |
| A6 | Publish (Effective) | Author, Co-Author, Reviewer, Approver, mọi DCO | 2 thư | Author, Co-Author, Reviewer, Approver | 1 thư. Người đăng ký Knowledge Base vẫn nhận thông báo riêng của họ |
| A7 | Tài liệu hết hiệu lực (Expired) | **Mọi người dùng đang hoạt động** (DEV: 714) và người giữ bản sao | E-mail và ứng dụng | Author, Owner, DCO, người giữ bản sao | Giữ hai kênh |
| A8 | Phát bản kiểm soát | Người nhận bản sao | Thông báo mới và thêm e-mail mẫu cũ có link và mật khẩu xem | Giữ nguyên | 1 e-mail (bản có link và mật khẩu), thông báo trong ứng dụng không chứa mật khẩu |
| A9 | Recall, Destroy, Cancel bản kiểm soát | Người giữ bản sao, và mọi người từng thao tác trên bản đó (yêu cầu, phát, duyệt, in, thu hồi...) | Mỗi người 1 thư | Người giữ bản sao, người yêu cầu | 1 thư |

## B. Đề xuất giữ nguyên

| Khi nào | Người nhận |
|---|---|
| Reviewer kế tiếp đến lượt; gửi thẳng phê duyệt khi không có Reviewer; thay Approver | Người đến lượt |
| Reject (đã sửa hôm nay) | Author, Co-Author |
| Cancel revision | Author, Co-Author |
| Chỉ định Author tài liệu mới; Upgrade đã cấu hình | Author |
| Draft có file lần đầu | Co-Author |
| Đào tạo xong, chờ publish | DCO |
| Nhắc việc quá hạn | Người đang giữ việc |
| Chuyển cấp khi quá hạn lâu; người được giao không còn hoạt động | DCO |
| Obsolete | Author, DCO, người giữ bản sao |
| Đến hạn rà soát định kỳ | Author, Owner |
| Góp ý rà soát (chỉ trong ứng dụng) | Owner |
| Đổi số tài liệu; Publishing lỗi | Người có quyền tương ứng |
| Đăng ký Knowledge Base | Người đăng ký |

## C. Chưa rà

- Các sự kiện khác của bản sao kiểm soát và không kiểm soát (yêu cầu, quá hạn thu hồi, mất hỏng...).
- Sự kiện "Document Opened for Online Editing" và "Document Ready for Submission": chưa thấy nơi gửi trong luồng hiện tại.
- Thông báo của Training Management.

## D. Cần quyết định thêm

1. A4: ai là người cần biết khi tài liệu chờ đào tạo?
2. A7: có cần giữ thông báo trong ứng dụng cho toàn bộ người dùng khi tài liệu hết hiệu lực không (không gửi e-mail)? Đây có thể là yêu cầu của QA để không ai dùng bản hết hạn.
