# Kế hoạch đưa phân quyền Hybrid ra toàn hệ thống (2026-11-15)

Trạng thái: **đề xuất, chờ chủ hệ thống duyệt; chưa có thay đổi mã nào.** Bằng chứng lấy từ đồ thị GitNexus (chỉ mục `edms-ntp`, commit `7c9a026`, phân tích lúc 10:40 ngày 15/11/2026) và đọc mã nguồn các file được nêu.
Nền tảng đã có và vẫn là chuẩn: `SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md` (§2 quyết định bất biến, §3 mô hình quyết định, §7 quy tắc cutover), `MULTI_MODULE_ACCESS_CONTROL_PATTERN.md` (3 lớp), `PERMISSION_MODEL_PLAYBOOK.md` (công thức Permission AND Trạng thái AND Actor), `AUTHORIZATION_MODULE_INVENTORY.md` (điều kiện vào của một module).

## 1. Nguyên tắc (nhắc lại, không đổi)
1. Hệ thống **không chia theo vai trò**. Người dùng giữ một hoặc nhiều Access Profile; quyền hiệu lực là hợp các bộ quyền của các profile. Nhãn workflow role chỉ để mô tả.
2. Mỗi quyết định là **Lớp 1 (quyền theo profile) AND Lớp 2 (quan hệ với đúng bản ghi: tác giả, người được chỉ định, người giảng...) AND Lớp 3 (phạm vi đối tượng)**, cộng trạng thái và chữ ký/lý do.
3. Không dùng tên role/profile trong logic. Điều kiện nghiệp vụ nằm trong chính sách ở DB, không nằm trong `if/else`.
4. Quyền cấp theo chức năng; ghép thành profile do quản trị viên làm.

## 2. Bản đồ hiện trạng (127 controller, 969 route)

| Cơ chế mà controller chạm tới (độ sâu 4) | Số route |
|---|---|
| Quyền phẳng (`PermissionEvaluationService`, `EffectivePermissionService`) | 270 |
| Dịch vụ phân quyền theo miền (`TrainingAccess`, `DocumentAuthorizationService`...) | 224 |
| Miền + phẳng | 161 |
| **Chạm động cơ Hybrid** (79 + 51 + 41; luôn kèm quyền phẳng hoặc miền) | 171 (18% route) |
| Quyền phẳng + chính sách vòng đời / phạm vi đối tượng | 43 |
| Không thấy bộ kiểm tra (đã kiểm tay: xem mục 3) | 100 |

Theo vùng (tiền tố đường dẫn):

| Vùng | Route | Cơ chế hiện tại |
|---|---|---|
| training | 237 | `TrainingAccess` (393 cạnh gọi, 50 file), **không có động cơ** |
| settings | 140 | phẳng 89, động cơ 51 (phần người dùng) |
| documents | 105 | phẳng 28, miền 43, động cơ 34 |
| security | 82 | phẳng 45, chính sách 30 |
| reports | 65 | dịch vụ Report với hàm `require` cục bộ, **không có động cơ** |
| internal | 52 | API nội bộ của agent backup, xác thực bằng token riêng |
| controlled-copies | 49 | động cơ 41 |
| backup-restore | 46 | phẳng |
| revisions | 40 | động cơ 39 |
| auth | 26 | xác thực |
| notifications, audit-trail, uncontrolled-copies, dashboard, khác | 80 | phẳng hoặc miền |

Theo cạnh gọi vào bộ kiểm tra (mã chạy thật, không tính test): training 393 phẳng / 0 động cơ; controlled-copy 203 / 13; document-control 174 / 14; security 88 / 34; report 22 (các dịch vụ Report dùng `require` cục bộ nên đếm thấp) / 0; uncontrolled-copy 18 / 0; knowledge 12 / 0.

Phía giao diện: 116 cạnh gọi tới `usePermissions` (settings 45, security 26, training 13, report 12, documents 8); hook capability chỉ có ở documents (7) và report (2). Training chưa có hợp đồng capability.

Không có `@PreAuthorize` hay so sánh tên role trong mã; chỉ có bài kiểm tra chống hardcode `Sprint10AuthorizationHardcodeRegressionTest` đã có sẵn.

## 3. Phần "không thấy bộ kiểm tra" (đã kiểm tay)
- Các controller Report (`ReportAppearance`, `ReportNameFormat`, `ReportType`, `ReportLayout`), `TrainingNumber`, `Maintenance`, `Announcement`: **có** kiểm tra trong dịch vụ phía dưới; bộ dò theo tên hàm đã bỏ sót.
- `Internal*` (agent backup), `OnlyOffice` (gọi lại bằng token), `PublicBranding`, `UserUiPreference`, `UserTablePreference`, `SharedSignature`, `Metadata`, `PromptSpecification`: mô hình tin cậy khác (token nội bộ, dữ liệu của chính người dùng, hoặc công khai). Cần bài kiểm tra riêng để chốt danh sách ngoại lệ.

## 4. Mức rủi ro khi sửa (GitNexus `impact`, upstream, độ sâu 3)
| Biểu tượng | Mức | Số symbol bị ảnh hưởng | Số nơi gọi trực tiếp |
|---|---|---|---|
| `PermissionEvaluationService.hasPermission` | **CRITICAL** | 1030 | 163 (22 luồng, 10 module) |
| `TrainingAccess.require` | **CRITICAL** | 551 | 166 |
| `AuthorizationEngineService.authorize` | HIGH | 70 | 6 |

Hệ quả: **không đổi ngữ nghĩa tại chỗ** của các bộ kiểm tra phẳng. Chuyển từng điểm gọi sang động cơ (strangler), mỗi điểm qua chạy song song (shadow).

## 5. Ràng buộc quản trị đang có
`AUTHORIZATION_MODULE_INVENTORY.md` ghi Training và Report là **Deferred** và cấm thêm quyền, chính sách hay participant cho module chưa Live và chưa có dòng Action Catalog đã duyệt. Cả hai đã chạy thật nên bảng phân loại này **lỗi thời**: bước đầu tiên là phân loại lại và duyệt Action Catalog (điều kiện vào 1-4 của tài liệu đó).
Quyết định đã ghi trước đây: Settings, Audit, Notification và 6 tài nguyên quản trị phân quyền giữ quyền phẳng (không adapter).

## 6. Phân loại tài nguyên và cơ chế đích
| Loại | Ví dụ | Cơ chế đích |
|---|---|---|
| Có vòng đời hoặc quan hệ theo bản ghi | Revision, Controlled Copy, User (đã xong); Document còn lại, Uncontrolled Copy, Knowledge (Head/Delegate), Executed Record, Publishing; Report (template/revision/schedule); Training (7 vòng đời); chiến dịch Access Review / Audit Review; yêu cầu Restore | Động cơ Hybrid: adapter + chính sách DB + quan hệ |
| Cấu hình đơn lẻ, không vòng đời | Dictionaries, notification policy, system configuration, branding, appearance, types, properties | RBAC + audit + chữ ký (hợp quy khi qua bài kiểm tra phù hợp, xem 7.A) |
| Token / nội bộ / tự phục vụ | `internal/*`, OnlyOffice callback, preferences, auth | Danh sách ngoại lệ có kiểm tra |

## 7. Lộ trình
**A. Nền tảng và quản trị (không đổi hành vi).**
1. Phân loại lại Training và Report thành Live; duyệt Action Catalog (bảng hành động × trạng thái × quyền × quan hệ × phạm vi × chữ ký/lý do, mỗi dòng truy ngược về mã).
2. Mở rộng động cơ: (a) chiều biến thể của chính sách (thay cho chỉ document type) để mô hình GMP / không GMP và loại báo cáo; (b) kiểm tra tách biệt nhiệm vụ lúc chạy ("khác người") theo quan hệ, thay cho `requireIndependentReviewer` đang nằm trong mã Report; (c) adapter dựa trên bảng chính sách dùng chung.
3. Bài kiểm tra kiến trúc toàn hệ thống: mọi route phải chạm bộ kiểm tra hoặc nằm trong danh sách ngoại lệ; báo cáo quyền mồ côi; không có tên role trong logic.
4. Hợp đồng capability dùng chung ở FE (hook tổng quát), thay cho gọi quyền trực tiếp.

**B. Report (thí điểm, nhỏ nhất):** adapter template, chính sách GMP/không GMP, shadow → cờ → xoá mã cũ.

**C. Training theo từng vòng đời:** Requirement, Matrix, Activity, Assessment, Job assignment, Personnel review, Specimen. Phạm vi phòng ban chuyển sang quy tắc đối tượng; quan hệ: người được chỉ định (soạn, review, duyệt), người giảng đủ điều kiện, chính nhân viên, Department/Unit Head. Giữ chữ ký `TrainingAccess.require` ở chế độ tương thích cho đến khi hết điểm gọi.

**D. Phần còn lại của Documents** (71/105 route chưa qua động cơ), Uncontrolled Copy, Knowledge (quan hệ Head/Delegate), Executed Record, Publishing.

**E. Chiến dịch và yêu cầu:** Access Review, Audit Review, Restore request.

**F. Cấu hình và dọn dẹp:** bài kiểm tra hợp quy cho vùng quyền phẳng, hợp nhất danh mục quyền (alias, không đổi mã trong lúc chuyển), bộ quyền theo chức năng, xoá mã cũ sau cửa sổ quan sát.

Điều kiện ra mỗi giai đoạn (theo `SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md` §7-8): shadow 0 lệch hoặc mọi lệch có quyết định; test ma trận API × trạng thái × quyền × quan hệ × phạm vi; test API trực tiếp trả cùng quyết định với capability; `detect_changes` và `impact` GitNexus; kiểm tra migration trên PostgreSQL thật.

## 8. Quyết định cần chủ hệ thống
1. Phân loại lại Training và Report là Live và duyệt quy trình Action Catalog.
2. Vùng cấu hình đơn lẻ và quản trị: giữ RBAC (hợp quy qua bài kiểm tra), đúng quyết định cũ.
3. Thứ tự: A, rồi B (Report), rồi C (Training), rồi D-F.
4. Mã quyền: giữ nguyên trong lúc chuyển, dùng alias.

## 9. Giới hạn của phân tích
- Đồ thị gọi tĩnh, độ sâu 4; không bắt được lời gọi qua phản xạ hay bean theo tên.
- Chỉ mục ở commit `7c9a026`, không chứa các thay đổi chưa commit trong ngày 15/11.
- Số cạnh gọi khác số chỗ kiểm tra theo chuỗi mã quyền (ví dụ Report: 22 cạnh so với khoảng 150 chuỗi) vì Report dùng hàm cục bộ.
- Phía giao diện đếm cạnh gọi, không phải số quyền khác nhau.
- Chưa đọc từng dịch vụ Training (hơn 20); danh mục chi tiết là việc của giai đoạn A.
