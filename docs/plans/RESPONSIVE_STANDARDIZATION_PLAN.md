# Kế hoạch chuẩn hoá Responsive & Design Token — EQMS Frontend

Ngày lập: 2026-11-08. Trạng thái: **ĐỀ XUẤT, chưa sửa mã.** Mở rộng `eqms/STYLE_REFACTOR_PLAN.md`, không thay thế.

**Quyết định của chủ dự án (2026-11-08), thay cho các mục tương ứng bên dưới:**
1. Input: gom về **một component chung**, **giữ nguyên style và kích cỡ hiện tại** (không nâng 36px lên 44px, không đổi cỡ chữ). Xem mục 2A.
2. Khoảng cách, vị trí, layout: quy về **một thang duy nhất**. Xem mục 2B.
3. Tab quá dài trên điện thoại: **cuộn ngang kèm mép mờ** (không dùng dropdown). Xem R4.

## 0. Căn cứ

- Quét chạy thật: 138 route × 5 khổ màn (điện thoại dọc/ngang, tablet dọc/ngang, desktop) bằng tài khoản admin trên DEV.
- Quét mã bằng 5 subagent (components dùng chung, documents, settings + security, training, các màn còn lại). Số liệu là kết quả grep, có thể đếm thiếu các className nhiều dòng.
- Luật tham chiếu: `eqms/CLAUDE.md`, `STYLE_REFACTOR_PLAN.md`, bộ luật `evondevKit` (skill `ui-ux`: `responsive.md`, `budgets.md`, `rules-type.md`, `rules-form.md`).
- **Nguyên tắc xung đột:** quy ước EQMS thắng evondev, trừ hai chỗ có lý do rõ: vùng chạm 44px ở màn hẹp và chữ ô nhập 16px ở màn hẹp (iOS tự phóng to nếu <16px).
- Chi tiết từng nhóm: `findings_components.md` không ghi được; số liệu nằm trong báo cáo của subagent, bản lưu của bốn nhóm còn lại ở thư mục scratchpad của phiên (`findings_documents/settings_security/training/other.md`).

## 1. Chẩn đoán gốc

1. **Primitive đã có nhưng feature bỏ qua.** `Card/CardTitle` có 0 lần import trong `features/documents`; `Input` chỉ 28 lần so với 301 `<input>` thô ở settings/security; `Select` 208 lần. Mỗi màn tự viết lại tiêu đề, padding, nút icon.
2. **Chính primitive không nhất quán.** Nút mặc định `h-10 md:h-11` (desktop cao hơn điện thoại), ô nhập và Select `h-9` (36px) không tăng ở điện thoại, nút `sm` luôn `h-9`. Nút và ô cùng hàng lệch chiều cao.
3. **Không có rào chắn.** Không có lint chặn `text-[Npx]`, `grid-cols-N` trần, `min-w-[NNNpx]`.
4. **Điện thoại là khổ bị bỏ quên.** Bảng chỉ cuộn ngang, không có dạng thẻ; thanh tab và stepper bị cắt; vùng chạm 20–36px.

## 2. Bảng token chuẩn (một nguồn)

| Hạng mục | Chuẩn | Hiện trạng đo được |
|---|---|---|
| Breakpoint chuyển bố cục | `md` (768) là điểm duy nhất cho 1→2 cột và bật bảng/sidebar; `lg` cho cặp biểu đồ | sm: 136, md: 188, lg: 47, xl: 19; form `sm:grid-cols-2` 79 vs `md` 67; JS dùng 768/640/1023; CSS 767/768/769/1024 |
| Chiều cao ô nhập, select | **GIỮ NGUYÊN** `h-9` (mặc định) và `h-10` (prop `size="lg"`, đúng 49 ô đang dùng `h-10`). Không đổi kích cỡ | `h-9` ×210, `h-10` ×49, còn lại không khai chiều cao 33 |
| Nút | **GIỮ NGUYÊN** kích cỡ hiện tại của `Button`. Chỉ thay 12–16 nút icon `h-7 w-7` viết tay bằng `IconButton` cùng kích cỡ 28px (không nâng vùng chạm) | default `h-10 md:h-11`, sm `h-9` |
| Chữ ô nhập | **GIỮ NGUYÊN** `text-sm`; `globals.css` đã ép 16px dưới 1024px để iOS không phóng to nên không cần đổi class | giữ cơ chế hiện có |
| Cỡ chữ | chỉ `text-2xs`(10), `xs`, `sm`, `base`, `lg`, `xl`; thêm `text-kpi` cho số KPI 28–30px. Cấm `text-[Npx]` | `[11px]` ~32, `[10px]` ~19, `[13px]` 8, rải rác `[7px]`,`[9px]`,`[15px]`,`[28px]` ở 18+ file |
| Tiêu đề trang | `PageHeader` duy nhất | 11 view thiếu PageHeader |
| Tiêu đề khối/card | `SectionTitle` mới: `text-sm font-semibold text-slate-900` (card lớn dùng `CardTitle`) | ≥ 8 biến thể; ~26 chỗ `text-sm font-semibold` chép tay |
| Font-weight | tiêu đề `semibold`, nhãn `medium`, `bold` chỉ cho `CardTitle` và số KPI; cấm `extrabold` | medium 197 / semibold 71 / bold 20; `font-extrabold` rải rác |
| Bo góc | control `rounded-lg`, container/modal/popup `rounded-xl`, pill `rounded-full`; bỏ `rounded-md`, `rounded-2xl`, `rounded` trần (checkbox được `rounded`) | lg 93–521, xl 46–197, `rounded` 19–20, md 10, 2xl 8 (Drawer, FilterDrawer, NavigationGuardModal, MultiSelect, MfaSetup, Documents) |
| Padding card | `p-4 md:p-5`; header `px-4 md:px-5 py-3`; không `p-3` cho card 2 dòng chữ trở lên | `p-4 md:p-5` chỉ 10–44 chỗ; `p-3` 23, `p-6/p-8` rải rác |
| Nhịp dọc trang | `space-y-4 md:space-y-6`; gap lưới `gap-4`, tối đa `md:gap-6` | `md:space-y-5` ×16, `gap-5/6/8` lẫn lộn |
| Icon | `h-4` (nhỏ), `h-5` (vừa), `h-9` (ô icon); bỏ `h-3`, `h-3.5`, `size={16/18}` | `h-3.5` ×18–30, `h-3` ×9–10, 6 cỡ ô icon |
| Focus ring | `ring-2` cho control; theo luật khoá #16 của evondev chỉ vẽ ring khi dự án đã vẽ (EQMS đã vẽ → giữ nhất quán) | ring-2 ×15 vs ring-1 ×24, stepper ring-4 |
| Vỏ modal/drawer | `px-4 md:px-6`, tiêu đề `text-base font-semibold`, footer `gap-2 md:gap-3`, nút đóng = Button icon-sm 40px | 3 kiểu padding, 3 cỡ tiêu đề, nút đóng `p-1.5` (28px) tự viết |
| Ô bảng | `px-4 py-3` + một biến thể `compact` đặt tên; `th` `text-2xs md:text-xs` | 97 key `TABLE_STYLES`, padding `px-2/2.5/3/4`, `py-1.5…3.5` |
| Vùng chạm | **Không đổi kích cỡ control** (quyết định mục 1). Chỉ mở rộng vùng bấm vô hình (`before:absolute before:-inset-2`) cho nút icon 28px, không đổi giao diện | 28–36px ở phân trang, nút đóng, toggle sidebar, switch 20×36, tab pill ~30 |

### 2A. Component Input chung (giữ nguyên style và kích cỡ)

Hiện có 552 thẻ `<input>` rải ở 201 file; khoảng 273 ô văn bản/số/textarea viết tay có viền, và cả 273 ô này gần như **cùng một kiểu**: viền `slate-200`, focus `emerald-500` + `ring-1`, `rounded-lg`, `text-sm`. Chỉ khác ở các chi tiết sau:

| Khác biệt | Số lượng | Xử lý |
|---|---|---|
| Chiều cao `h-9` / `h-10` / không khai | 210 / 49 / 33 | `size="md"` (h-9, mặc định) và `size="lg"` (h-10). Ô không khai chiều cao (textarea, ô có `py-*`) dùng `Textarea` hoặc `size="auto"` |
| Padding ngang `px-3` / `px-3.5` / `px-4` | 3 giá trị | gom về `px-3`. Lệch 2px, xem lại bằng ảnh trước/sau ở các màn dùng `px-3.5` (ReportPropertiesView, AccountInfoTab, LegacyTrainingEvidence) |
| Có/không có `focus:ring-1` | 27 ô thiếu ring | dùng ring-1 chuẩn của `Input` |
| Nền `bg-white` rõ ràng | 64 | mặc định `bg-white` |
| Cỡ chữ `text-xs` | 14 (ReportNameFormatsTab) | giữ qua prop `size="sm"` hoặc className có chủ đích, ghi chú lý do |
| Rounded `rounded-xl`, viền `slate-300`, `emerald-600` | 3 (SessionTimeoutModal) | đưa về chuẩn `Input` |

Cách làm: mở rộng `components/ui/form/ResponsiveForm.tsx` (`Input`, `Textarea` đã có và đã có 99/65 nơi dùng) thành nguồn duy nhất, thêm prop `size`, gộp `SearchInput`, `FilterSearchInput`, ô số, ô ngày vào cùng khung style (qua `inputBaseClass`). Các primitive `Select`, `MultiSelect`, `DateTimePicker`, `TimePicker`, `ColorPickerInput` dùng lại `inputBaseClass` để viền/focus/disabled/readonly/error giống hệt. Checkbox, radio, file, range, color giữ component riêng (`Checkbox`, `Radio`...).
Cách chuyển: script có điều kiện chặn, chạy từng thư mục (settings → security → documents → training → còn lại), mỗi lượt build + vitest + ảnh trước/sau. Lint mới cấm `<input className="...border...">` ngoài `components/ui/`. Giữ nguyên `value/onChange/ref` để không đổi hành vi.

### 2B. Khoảng cách, vị trí, layout (một thang duy nhất)

**Đo thật (138 route, desktop 1440 và điện thoại 390, admin):**

| Hạng mục | Kết quả |
|---|---|
| Lề trái nội dung | Đồng bộ: 135/135 trang có tiêu đề đều bắt đầu tại cùng lề (392px desktop với sidebar mở; 16px điện thoại) |
| Cỡ chữ tiêu đề trang | Đồng bộ: 24px/700 desktop, 16.8px/700 điện thoại ở 135/135 trang |
| Khoảng cách nhãn → ô nhập | Đồng bộ: 6px ở 697/697 cặp đo được trên desktop |
| Khoảng cách tiêu đề → khối đầu tiên | Điện thoại lệch 3 trang (24px thay vì 16px): `/security/authorization-diagnostics`, `/settings/report-types`, `/settings/users/logged-in`. Desktop lệch 4 trang (20px thay vì 24px): `/settings/administration/backup/disaster-recovery`, `/settings/administration/report/{access,delivery,retention}` |
| Khoảng cách giữa các khối | Lệch: `/backup-restore/alerts` (48px desktop, 40px điện thoại), `/backup-restore/restore-rules` (40px, 32px) so với chuẩn 24px/16px |
| Vị trí dọc của tiêu đề | Lệch 4px ở 32 trang (tiêu đề cao hơn 72px thay vì 76px), tập trung ở backup-restore, uncontrolled-copies, `/documents/records`, `/report/analytics`, `/settings/administration/*`, `/security/authorization-diagnostics`. `/documents/revisions/standalone` lệch 70px (146px) |
| Không có PageHeader | `/dashboard`, `/documents/knowledge/explorer`, `/documents/templates/new` (dashboard và explorer có thể là chủ đích) |
| Khoảng cách giữa các hàng field (điện thoại) | Lẫn lộn: 12px (79 chỗ), 16px (57), 20px (6) |
| Padding card (đo ở khung ngoài) | Phát hiện 12px (18 card: publishing-templates/new, electronic-signature, system-info), 16px, 20px (10 card, nhiều ở backup-restore và security) và vài card 32–48px (trạng thái rỗng). Phép đo này chỉ thấy card có padding ở khung ngoài, nên **chưa phản ánh `FormSection` (padding nằm ở lớp trong)** |
| Lưu ý độ tin cậy | Phép đo "khoảng cách giữa khối" ở desktop cho ra −36px ở 103 trang do thanh đầu trang dính (sticky) đè lên; **số desktop chỉ tin ở 28+4+2 trang đo được**. Phép đo tab bar bắt nhầm tablist của sidebar nên không dùng |

**Đếm trong mã (className, toàn `features` + `components`):**

| Loại | Giá trị đang dùng (số lần) | Hệ quả |
|---|---|---|
| Khoảng cách dọc (`space-y`) | 4 (231), 3 (153), 2 (96), 1 (60), `4 md:6` (49), 6 (37), 5 (26), `4 md:5` (20), 1.5, 0.5, 2.5, `3 lg:4`... | `space-y-5`, `md:space-y-5`, `space-y-6` không có bước md làm lệch nhịp giữa các trang |
| Khoảng cách ngang/lưới (`gap`) | 2 (889), 3 (360), 1.5 (320), 4 (293), 1 (119), `4 md:6` (73), 2.5 (67), 6 (30), `4 md:5` (21), 5 (18), `3 md:4` (18)... | `gap-5`, `md:gap-5`, `gap-6` không có bước md |
| Padding (`p-`) | `4 md:5` (200), 4 (159), 3 (117), 6 (20), 5 (11), `3 sm:4` (7), 3.5 (9)... | card không đồng nhất `p-3`/`p-4`/`p-6` |

**Thang chuẩn (token duy nhất):**

| Vai trò | Chuẩn | Ghi chú |
|---|---|---|
| Lề trang | `px-4 md:px-6 lg:px-8` (đã đúng, do `MainLayout`) | không view nào tự thêm `px/p` bao ngoài |
| Giữa các khối cấp trang (tiêu đề → khối → khối) | `space-y-4 md:space-y-6` (16/24) | do `MainLayout` cung cấp; view **không** thêm `mt-*`/`space-y-*` riêng ở gốc |
| Bên trong card, giữa các nhóm | `space-y-4` | |
| Bên trong nhóm, giữa field | `gap-4` (hàng), `md:gap-6` giữa cột qua `FormGrid` | thay cho 12/16/20 lẫn lộn |
| Nhãn → ô nhập | `mb-1.5` (6px) | đã chuẩn |
| Nhóm nhỏ (danh sách, chip) | `space-y-2`/`gap-2` (8px), tối thiểu 4px (`gap-1`) | |
| Trong control (nút, badge, chip) | `gap-1.5`/`gap-2`, `px-2…3` | nửa bậc cho phép |
| Card | header `px-4 md:px-5 py-3`; nội dung `p-4 md:p-5` | `p-3` chỉ chip/ô nhỏ |
| Hàng nút cuối form/modal | căn phải, `gap-2 md:gap-3`, nút chính ngoài cùng bên phải | giống nhau ở mọi form/modal |
| Vị trí tiêu đề | luôn là con đầu tiên của vùng nội dung, không `pt` thêm | sửa 32 trang lệch 4px |
| Bỏ khỏi thang | `space-y-5`, `md:space-y-5`, `gap-5`, `md:gap-5`, `space-y-6`/`gap-6`/`p-6` không có bước md, `p-3` cho card | thay bằng chuẩn trên |

**Cách đạt:** (a) thêm primitive `PageSection` (khối cấp trang) và dùng lại `FormSection`/`Card`; (b) `FormGrid` làm nguồn duy nhất cho lưới field (đã có `gap-4 md:gap-6`); (c) sửa danh sách 11 trang lệch ở bảng trên bằng tay; (d) quét 20 chỗ `md:space-y-5`, 18 `gap-5`, 26 `space-y-5` bằng script; (e) lint chặn các class đã bỏ khỏi thang, với `allowlist` có ghi lý do cho trường hợp thật sự cần.

## 3. Quy tắc responsive bắt buộc

1. **R1** Không trang nào cuộn ngang cả trang (đã đạt trên 129 route đo được).
2. **R2** Lưới luôn có cột mặc định `grid-cols-1`, rồi `md:grid-cols-N`. Số cột lẻ đi thẳng từ 1 lên N, không chèn bậc 2 cột.
3. **R3** Bảng quản lý ở dưới `md`: **dạng thẻ/danh sách dòng** (cột nhận diện + 2–3 trường chính + menu hành động). Bảng dữ liệu rộng (audit, ma trận) được cuộn ngang nhưng phải ghim cột đầu, có mép mờ báo "còn nữa" và cột ghim ≤ 40% khung.
4. **R4 (đã chốt)** Thanh tab và stepper khi dài hơn khung: **cuộn ngang kèm mép mờ**, không dùng dropdown.
   - Khung cuộn `overflow-x-auto`, mỗi tab `shrink-0`, không `flex-wrap`.
   - Mép mờ 32px bằng `mask-image`: mép trái mờ khi đã cuộn khỏi đầu, mép phải mờ khi còn mục phía sau; cờ tính từ `scrollLeft`/`scrollWidth`/`clientWidth` và cập nhật khi cuộn/đổi cỡ (ResizeObserver).
   - Khi mở màn hoặc đổi tab, tự cuộn tab đang chọn vào giữa khung (`scrollIntoView({inline:'center'})`).
   - Lề trái/phải đặt trên hàng bên trong, không đặt trên khung cuộn (padding của khung cuộn bị bỏ qua khi cuộn tới cuối).
   - Máy có chuột: thêm nút mũi tên tròn ở phía còn mục bị khuất (`any-pointer: fine`), cuộn ~80% bề rộng khung. Điện thoại không hiện nút.
   - Cài một lần trong `TabNav` (variant underline/pill, dùng ở 14 nơi) và `WorkflowStepper` (hàng bước điện thoại); sửa luôn lỗi `justify-start` + `mx-auto` đang cắt các bước đầu. Sửa thêm `ConfigurationView` (fieldset `overflow-hidden` đang cắt thanh tab).
5. **R5** Cụm nút ở header trang: không rớt hàng lẻ; không vừa thì gom vào menu "…".
6. **R6** Biểu đồ nằm trong khung `min-w-0 overflow-hidden`; ít nhãn trục hơn ở màn hẹp (`tickEvery`), ẩn nhãn giá trị.
7. **R7** Ô nhập giữ nguyên kích cỡ (đã chốt); `globals.css` tiếp tục ép chữ 16px dưới 1024px để iOS không phóng to.
8. **R8** Cấm `min-w-[NNNpx]` > 640px nếu không kèm khung cuộn có ghim cột hoặc dạng thẻ.
9. **R9** Cho phép phóng to (bỏ `user-scalable=no`) — cần chủ dự án chốt.

## 4. Lộ trình triển khai (theo đợt, mỗi đợt build + quét lại)

**Đợt 0 — Rào chắn và nền (nhỏ, không đổi giao diện)**
- Thêm lint/test chặn: `text-[Npx]`, `grid-cols-N` trần, `sm:grid-cols-2` trong form, `rounded-2xl|md`, `min-w-[>640px]`. Chạy ở CI và vitest.
- File hằng số breakpoint dùng chung cho JS và CSS; thống nhất 768.
- Xoá mã chết: `.touch-target*` (0 nơi dùng), prop `size` của Badge không có tác dụng, cấu hình trùng của TabNav, `Button.module.css` cũ nếu không còn dùng.
- Thêm token `text-kpi`; chuyển `text-[Npx]` còn lại sang `text-2xs`/`xs`/`sm`.

**Đợt 1 — Primitive (ảnh hưởng toàn app, làm trước)**
1. Component Input chung (mục 2A): mở rộng `Input`/`Textarea`, chia sẻ `inputBaseClass` cho `Select`, `MultiSelect`, `SearchInput`, `FilterSearchInput`, picker ngày giờ. **Không đổi kích cỡ.** Sau đó chuyển ~273 ô viết tay theo từng thư mục. Thêm `IconButton` cho các nút icon 28px (giữ kích cỡ).
2. Vỏ `FormModal`, `AlertModal`, `Drawer`, `FilterDrawer`: padding, tiêu đề, footer, nút đóng.
3. `TabNav`: cuộn ngang + mép mờ + tự cuộn tới tab đang chọn (R4); pill không `flex-wrap`; giữ chiều cao tab hiện tại.
4. `WorkflowStepper`: cuộn bước hiện tại vào khung; sửa `justify-start` + `mx-auto` cắt bước đầu; chữ nhãn ≥ `text-2xs`.
5. Mới: `SectionTitle`, `IconTile`, `IconButton` (thay 12–16 nút `h-7 w-7`), `SwitchRow`, `KpiTile`.
6. Bảng: gộp `TABLE_STYLES` còn ~8 key; thêm chế độ thẻ cho `DataTable` dưới `md` (cấu hình cột "chính/phụ"). Bảng 90 file chuyển key bằng script có kiểm tra.
7. `index.html`: viewport cho phép zoom (nếu được duyệt); bỏ ép 16px `!important` trong `globals.css` khi ô nhập đã đúng class.

**Đợt 2 — Màn hình có số liệu xấu nhất (theo quét chạy thật)**
- Controlled Copies (`ControlledCopiesView` 2246 dòng, `ExpandControlledCopiesRow`): vùng chạm 20/28px, ô tìm `h-9`, cột bị ẩn.
- Document Impact Assessment, Legacy Evidence, `ImpactPositionsTable` (training).
- Revision create/standalone, `NewDocumentView` (tab 641px, stepper bị cắt).
- `/settings/configuration` (tab 593px, ô nhập tràn mép phải; `overflow-hidden` của fieldset ở ConfigurationView:408), `/documents/templates`, training properties.
- `/report/analytics` (`LazyMount` + `ActivityBarChart`), `/dashboard` (`dashboardUi.tsx` chuyển về `CardTitle`/`ResponsiveCard`).
- `/audit-trail` (bảng 1760px → thẻ trên điện thoại), Notification Policy (900px), Notifications, Backup/Restore.

**Đợt 3 — Quét theo feature (cơ học, nhiều file, rủi ro thấp)**
- `sm:grid-cols-2` → `md:` (~20 + 79 chỗ trong form); 10 `grid-cols-N` trần (EffectiveAccessPanel, AccessReviewCampaignDetailView, DistributeBatchResultModal, các tab Dictionaries…).
- Bo góc lệch (~17 + 8 chỗ), icon 3/3.5, padding `p-3/p-6/p-8`, `space-y-5`.
- Tiêu đề khối → `SectionTitle`; 11 view thiếu `PageHeader`.
- Auth: chữ 11px, `rounded-md/2xl`; MfaSetup; SessionTimeoutModal (`text-md` không tồn tại); Calendar (`!important`, nút ngày 32px).

**Đợt 4 — Kiểm chứng**
- Chạy lại quét 138 route × 5 khổ bằng script đã có; tiêu chí nghiệm thu mục 5.
- Chụp ảnh trước/sau cho 10 màn đại diện ở 390px và 768px.
- Thử trên thiết bị cảm ứng thật (chưa làm được ở lần quét này) và điện thoại ngang (chiều cao 390px, header sticky).

## 5. Tiêu chí nghiệm thu

- 0 route có phần tử vượt mép màn ngoài khung cuộn có chủ đích.
- 0 `<input>`/`<textarea>` có viền viết tay ngoài `components/ui/`; mọi ô nhập đi qua `Input`/`Textarea`/`Select`; ảnh trước/sau không đổi kích cỡ.
- 0 `text-[Npx]`, 0 `rounded-2xl|md`, 0 `grid-cols-N` trần, 0 `space-y-5|gap-5` (lint xanh).
- Quét lại 138 route: tiêu đề cùng vị trí dọc; khoảng cách tiêu đề → khối và giữa các khối là 16/24 ở mọi trang (0 ngoại lệ ngoài allowlist).
- Mọi thanh tab/stepper dài hơn khung đều cuộn ngang, có mép mờ ở phía còn mục, tab đang chọn tự vào tầm nhìn.
- Mọi bảng quản lý có dạng thẻ dưới `md`.
- Build + vitest xanh; quét lại không phát sinh lỗi mới.

## 6. Quyết định cần chủ dự án chốt (Decision Log)

**Đã chốt (2026-11-08):** (1) Input gom về một component, giữ nguyên style và kích cỡ; (3) tab dài cuộn ngang kèm mép mờ; khoảng cách quy về một thang (mục 2B). Điều này loại bỏ mục "nâng ô nhập lên 44px" và "nút mặc định" khỏi danh sách quyết định.

**Còn cần chốt:**
1. **Cho phép phóng to hai ngón** (bỏ `user-scalable=no`)?
2. **Dashboard** có chuyển hẳn về `Card/CardTitle` (mất kiểu tiêu đề `font-medium` riêng) hay giữ như hệ thiết kế riêng nhưng dùng token chuẩn?
3. **Dạng thẻ trên điện thoại** cho bảng: áp cho mọi bảng quản lý, hay chỉ danh sách chính (Documents, Copies, Revisions, Users, Training)?
4. **`px-3.5` → `px-3`** ở khoảng 60 ô nhập khi gom về `Input` (lệch 2px mỗi bên): chấp nhận, hay thêm prop để giữ nguyên tuyệt đối?
5. **Vùng chạm 28px** của nút icon: vì giữ nguyên kích cỡ, chấp nhận chỉ mở vùng bấm vô hình, hay giữ hẳn như cũ?

## 7. Rủi ro và điều không làm

- Đây là việc UI thuần, không đụng quyền, lifecycle, chữ ký điện tử hay audit; không cần bản ghi thay đổi theo mẫu One Change Record, nhưng **GitNexus `impact` phải chạy trước khi sửa từng primitive** (Button, Input, Select, TabNav, DataTable… có thể có hàng trăm caller) và `detect_changes` trước khi commit.
- Gom ~273 ô nhập: rủi ro lệch pixel nhỏ (`px-3.5` → `px-3`) và mất ring/readonly state nếu bỏ sót; chia đợt theo thư mục, chụp trước/sau, vitest từng đợt.
- Chuẩn hoá khoảng cách động đến nhiều màn: sửa ở `MainLayout`/`FormGrid`/`FormSection` trước, rồi mới sửa ngoại lệ từng trang.
- Không dùng đổi tên hàng loạt bằng find-and-replace cho symbol; script sửa hàng loạt phải có điều kiện chặn (bài học `trainingActivities.ts`).
- Chưa sửa gì trong mã nguồn khi lập kế hoạch này.
