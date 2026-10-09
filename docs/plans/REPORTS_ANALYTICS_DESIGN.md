# Reports & Analytics — mô tả chức năng và thiết kế UI

Trạng thái: **ĐỀ XUẤT, chưa được duyệt.** Không phải As-Is evidence và không phải GMP approval.
Ngày: 2026-10-08. Nhãn: **[THỊ TRƯỜNG]** tham khảo bên thứ ba; **[HIỆN TRẠNG]** đã kiểm tra trong hệ thống;
**[ĐỀ XUẤT]** của người soạn; **[QUYẾT ĐỊNH]** cần chủ sở hữu nghiệp vụ / QA chốt.

## 1. Tham khảo các phần mềm QMS [THỊ TRƯỜNG]

Nguồn là trang của nhà cung cấp, trang đánh giá và bên bán lại, không phải tài liệu kỹ thuật chính thức; cần xác nhận với nhà cung cấp trước khi dựa vào chi tiết.

| Sản phẩm | Điểm đáng học | Nguồn |
|---|---|---|
| **Veeva Vault QMS** | Báo cáo dựng từ *loại báo cáo định sẵn*, chia sẻ cho nhóm hoặc cá nhân; báo cáo chạy theo lịch ("Flash Report") gửi hằng ngày/tuần/tháng; dashboard (biểu đồ tròn, đường, đồng hồ) lấy dữ liệu từ chính các báo cáo; dashboard dựng sẵn cho deviation, CAPA, audit; liên kết tự động giữa các bản ghi để thấy xu hướng. Đánh giá: cấu hình quản trị không nhỏ | [SoftwareOne](https://platform.softwareone.com/product/veeva-vault-qms/PCP-2375-3288), [Veeva brief](https://www.veeva.com/resources/veeva-vault-qms-product-brief/), [ERP Research](https://erpresearch.com/erp-add-ons/healthcare/veeva-vault-qms) |
| **TrackWise Digital (Sparta/Honeywell)** | Dashboard theo yêu cầu; công cụ **QMR** (xem xét của lãnh đạo) và **PQR** (rà soát chất lượng sản phẩm); QualityView cho người dùng không chuyên tự dựng báo cáo, phát hiện xu hướng, **cảnh báo qua email khi vượt ngưỡng**. Đánh giá: cần kỹ năng cấu hình, đào tạo nhiều | [Sparta](https://www.spartasystems.com/trackwise-quality-suite/), [QualityView](https://go.spartasystems.com/Datasheet-TrackWise-QualityView.html), [rfp.wiki](https://www.rfp.wiki/specialty-industries/manufacturing/quality-management-system-software/trackwise-digital) |
| **ETQ Reliance** | Báo cáo kéo-thả; biểu đồ pareto/gauge/pie/radar; **ghim biểu đồ yêu thích lên trang chủ**; khoan sâu (drill-down) tới từng bản ghi; xuất Excel một chạm; lịch gửi email cho nhóm phân phối | [ETQ](https://www.etq.com/press-releases/etq-adds-new-features-reliance-quality-management-system/), [Pharmaceutical Online](https://www.pharmaceuticalonline.com/doc/etq-reliance-the-leading-electronic-quality-management-system-eqms-0001) |
| **MasterControl** | Dashboard thời gian thực, KPI, báo cáo tùy biến; audit trail, chữ ký điện tử và validation là lõi để đạt Part 11/Annex 11. Chưa xác nhận được chức năng báo cáo theo lịch từ nguồn công khai | [ZoftwareHub](https://zoftwarehub.com/products/mastercontrol-quality-excellence/overview), [Capterra](https://www.capterra.co.uk/reviews/148577/mastercontrol) |

### Mẫu chung rút ra
1. Người dùng **chọn từ thư viện** báo cáo đã được kiểm soát, ít khi tự viết; người quản trị mới sửa định nghĩa.
2. **Trang chủ cá nhân**: việc của tôi, báo cáo gần đây, mục ghim.
3. **Chạy theo lịch** và gửi cho nhóm; **cảnh báo theo ngưỡng**.
4. **Dashboard** tách khỏi báo cáo: dashboard là cái nhìn tổng quan, báo cáo là bản ghi có thể in và lưu.
5. **Khoan sâu** từ con số xuống bản ghi nguồn.
6. **Xuất** PDF/Excel/CSV, có đầu trang/chân trang kiểm soát.
7. Báo cáo cấp quản lý có dạng riêng: **QMR** và **PQR**.

## 2. Hiện trạng [HIỆN TRẠNG]

### Có và hoạt động (backend)
- Catalog định nghĩa báo cáo có **phiên bản**, quyền theo vai trò (phạm vi cá nhân/phòng ban/BU/toàn hệ thống), bộ lọc, trường chọn được.
- Chạy theo yêu cầu, **bất đồng bộ**, chạy lại, **snapshot bất bin** của tham số, quyền và định nghĩa; idempotency key.
- File kết quả có **SHA-256**, hạn lưu theo chính sách retention, **legal hold** (có API), kiểm tra lại quyền và checksum khi tải; audit cho tạo, thử lại, tải.
- Lịch chạy: tạm dừng khi quyền người tạo thay đổi.
- Layout trình bày (logo, đầu/chân trang, mẫu DOCX), biểu đồ phía server, xem trước **không** tạo bản ghi.
- Lịch sử phiên bản định nghĩa kèm lý do.

### Thiếu hoặc chưa đúng
| # | Vấn đề | Mức |
|---|---|---|
| 1 | Chỉ **một nguồn dữ liệu** (Document Register); 6 định nghĩa, trong đó 3 cái là `TEST ·` | Giới hạn |
| 2 | Menu có 3 mục phẳng; "Templates" là khái niệm của admin nhưng người dùng phải vào đó để chạy báo cáo | UI |
| 3 | Màn Settings > Report Configuration chỉ là vỏ 5 dòng bọc lại màn Catalog của người dùng với cờ `admin` | UI |
| 4 | **Không có UI** cho legal hold, retention theo báo cáo, nhật ký gửi (`report_delivery_attempts`), lịch sử phiên bản | Chức năng |
| 5 | **Không phân biệt báo cáo chính thức và thông tin** | GMP |
| 6 | Không có trang chủ/dashboard; không có phân tích xu hướng, khoan sâu, báo cáo QMR/PQR | Chức năng |
| 7 | Tải file lỗi checksum bị trả về như "hết hạn" và không được audit; xóa lịch là xóa cứng | Toàn vẹn |
| 8 | Hết hạn hay lỗi gửi lịch: người tạo có được báo không chưa xác nhận | Vận hành |

## 3. Chức năng mục tiêu

### 3.1 Cho người dùng (Reports & Analytics)
| Màn | Chức năng |
|---|---|
| **Overview** | Việc của tôi: đang chạy, lỗi cần xử lý, sẵn sàng tải, file sắp hết hạn, lịch chạy kế tiếp; báo cáo gần đây; mục ghim |
| **Report Library** | Duyệt theo module nguồn rồi nhóm; tìm kiếm; lọc theo module, nhóm, phân loại (Chính thức/Thông tin), định dạng; thẻ báo cáo gồm mô tả, phiên bản, định dạng cho phép, lần chạy gần nhất; ghim; nút Run |
| **Run (wizard)** | Tiêu chí → Xem thử (không phải bản ghi chính thức) → Đầu ra và mục đích; tạo một bản ghi chạy |
| **Report Runs** | Lịch sử của tôi, hoặc của mọi người nếu có quyền; lọc theo trạng thái, báo cáo, thời gian; **trang chi tiết** là hồ sơ bằng chứng (xem 3.3) |
| **Schedules** | Danh sách, tạo, tạm dừng, tiếp tục, người nhận, lần chạy kế tiếp và lần chạy gần nhất; hiển thị lý do khi lịch bị dừng |
| **Analytics** | Dashboard chất lượng: Document Control (tài liệu hiệu lực theo loại, revision theo giai đoạn, rà soát định kỳ sắp đến hạn, bản sao kiểm soát chưa thu hồi), sức khỏe nền tảng báo cáo; khoan sâu tới bản ghi |

### 3.2 Cho quản trị (Report Administration, trong System Administration)
| Màn | Chức năng |
|---|---|
| **Report Definitions** | Danh sách và sửa định nghĩa: tên, nhóm, phân loại, trường, bộ lọc, định dạng cho phép, giới hạn dòng; mỗi lần lưu là **một phiên bản mới có lý do** |
| **Access & Scope** | Ma trận vai trò × báo cáo × phạm vi dữ liệu |
| **Output Controls** | Quy định chung của mọi file: chân trang bắt buộc (mã chạy, phiên bản, thời điểm dữ liệu, người chạy, số trang), watermark cho bản xem thử và bản thông tin, giới hạn kích thước |
| **Retention & Legal Hold** | Chính sách lưu theo báo cáo; sổ đăng ký legal hold (áp, gỡ có lý do); báo cáo file sắp hết hạn |
| **Delivery** | Quy tắc người nhận, nhật ký gửi và lỗi gửi, giới hạn số người nhận, mẫu email |
| **Change History & Validation** | Lịch sử phiên bản của từng định nghĩa (ai, khi nào, lý do, khác gì); trạng thái xác nhận (validation) của từng báo cáo |

### 3.3 Trang chi tiết của một lần chạy (bản ghi bằng chứng)
Danh tính (mã chạy, báo cáo, phiên bản định nghĩa, phiên bản layout), người chạy, **thời điểm dữ liệu**, tham số và trường đã chọn (chỉ đọc), dòng thời gian sự kiện, danh sách file (SHA-256, kích thước, hạn lưu, legal hold, đã xóa), hành động: tải, thử lại, **chạy lại với cùng tham số** (tạo bản ghi mới, không bao giờ ghi đè).

## 4. Ánh xạ EU-GMP

| Yêu cầu | Đáp ứng |
|---|---|
| **Annex 11 §8** — bản in rõ ràng; phải biết dữ liệu có bị thay đổi kể từ khi nhập | Chân trang cố định: mã chạy, phiên bản, thời điểm dữ liệu, người chạy; tải lại có thể kiểm checksum |
| **Annex 11 §9** — audit trail, rà soát định kỳ | Audit mọi thao tác: chạy, thử lại, tải, đổi định nghĩa, legal hold; báo cáo Audit Trail Extract trong thư viện |
| **Annex 11 §7** — lưu giữ, đọc được suốt thời hạn | Retention theo báo cáo; file bất biến kèm SHA-256; bản ghi còn sau khi file hết hạn |
| **Annex 11 §10** — kiểm soát thay đổi | Định nghĩa có phiên bản, lý do; (QUYẾT ĐỊNH RA-2) có duyệt hai người không |
| **Annex 11 §12** — an ninh | Phạm vi theo vai trò; kiểm tra lại quyền khi tải; báo cáo không cấp quyền xem tài liệu gốc |
| **Annex 11 §4** — xác nhận | Báo cáo dùng cho quyết định GMP phải được xác nhận; màn Validation theo dõi trạng thái |
| **EU GMP Ch.4** — hồ sơ | Bản chạy bất biến; sửa sai = chạy mới; không ghi đè |
| **PIC/S PI 041 / ALCOA+** | Gán cho người; có thời điểm; gốc/chính xác (snapshot); đầy đủ |
| **Ch.1 (PQR) / ICH Q10 (xem xét lãnh đạo)** | Nhóm báo cáo PQR và QMR trong thư viện; dùng khi các module nguồn có dữ liệu |

Annex 11 không quy định chu kỳ rà soát audit trail; cách diễn giải là của người soạn, QA cần xác nhận. Điều khoản cụ thể cần QA xác nhận trước khi ghi vào hồ sơ validation. Nguồn tham khảo: [GMP Compliance](https://gmp-compliance.org/gmp-news/audit-trail-review-required-before-each-batch-release), [SimplerQMS](https://simplerqms.com/eu-annex-11/), [Scilife checklist](https://www.scilife.io/hubfs/Scilife_EU%20Annex%2011_Mapping%20Checklist.pdf).

## 5. Phân loại báo cáo [QUYẾT ĐỊNH RA-1]
Mỗi định nghĩa có cờ **Official** hoặc **Informational**:
- **Official:** dùng cho quyết định hoặc hồ sơ GMP; chân trang đầy đủ; phải ở trạng thái đã xác nhận mới chạy được.
- **Informational:** theo dõi hằng ngày; có watermark "Informational — not a GMP record"; không cần xác nhận.
Decision Log hiện chỉ nói báo cáo **không có luồng ký hay duyệt** và phần trình bày không thay thế chữ ký; cờ này chỉ đổi cách hiển thị và điều kiện chạy, không thêm chữ ký.

## 6. Thông tin kiến trúc (menu)

```
Reports & Analytics                       (report.module.view)
├─ Overview
├─ Report Library
├─ Report Runs
├─ Schedules
└─ Analytics
System Administration > Report Administration   (mỗi màn có quyền riêng)
├─ Report Definitions     ├─ Access & Scope      ├─ Output Controls
├─ Retention & Legal Hold ├─ Delivery            └─ Change History & Validation
```

## 7. Quyết định cần chốt

| ID | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| RA-1 | Có cờ Official / Informational không? | Có, mặc định Informational cho định nghĩa mới |
| RA-2 | Sửa định nghĩa Official có cần người thứ hai duyệt? | Có |
| RA-3 | Người có `view_all` có được chạy lại / tải báo cáo của người khác không? | Chỉ xem và tải; chạy lại tạo bản ghi do chính họ |
| RA-4 | Lịch bị dừng do đổi quyền: báo ai? | Người tạo và quản trị báo cáo |
| RA-5 | Thời hạn lưu mặc định cho báo cáo Official | Chưa có trong Decision Log; không tự đặt |
| RA-6 | Dashboard Analytics ban đầu gồm những chỉ số nào | Document Control trước; Training/CAPA khi module có dữ liệu |
| RA-7 | Có cho người dùng tự dựng báo cáo không (kéo-thả)? | Không ở giai đoạn đầu; chỉ chọn trường trong định nghĩa đã duyệt |

## 8. Phạm vi dựng UI lần này
- **Dùng dữ liệu thật** (API đã có): Overview, Report Library, Report Runs và trang chi tiết, Schedules, Report Definitions, Change History (phiên bản).
- **Dữ liệu mẫu, có banner "Design preview":** Analytics, Access & Scope, Output Controls, Retention & Legal Hold (sổ đăng ký), Delivery, Validation.
- Chưa làm backend mới. Các quyết định ở mục 7 chưa được chốt nên các chức năng tương ứng chỉ hiển thị chứ chưa thực thi.
