# Kế hoạch chuẩn hoá Style & Responsive — EQMS Frontend

> Tổng hợp từ audit toàn bộ `eqms/src/components/ui/` và `eqms/src/features/` (font-size, font-weight, màu sắc, border-radius, icon size, khoảng cách/spacing, responsive). Dùng file này làm căn cứ để yêu cầu refactor theo từng giai đoạn, không phá vỡ kiến trúc UI hiện có.

---

## 0. Kết luận gốc rễ

Dự án **đã có** một tầng token:
- CSS variables trong `src/styles/globals.css:241-343` (`--color-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--z-*`)
- Tailwind config inline trong `index.html:112-147` (chỉ định nghĩa `colors.primary/secondary/muted/accent` + `fontFamily.sans`, load qua CDN script, **không có** file `tailwind.config.js/ts` thật)
- Các primitive dùng chung: `Card`/`CardTitle` (`components/ui/card/ResponsiveCard.tsx`), `FormSection`, `Badge` (quy ước `-50/-700`), `PageHeader`, `FormModal`/`AlertModal`, `ResponsiveTable`, `MainLayout` (container trang + `space-y-4 md:space-y-6`)

**Vấn đề không phải là thiếu token/primitive — mà là không có gì ép buộc dùng chúng.** Phần lớn `features/` tự viết lại class Tailwind rời rạc (`getColor()` riêng, heading tự chế, padding tự chọn) thay vì tái sử dụng, dẫn đến hàng chục pattern cạnh tranh cho cùng một vai trò UI. Vá từng file sẽ không đủ nếu không khoá lại ở tầng component + quy ước.

---

## 1. Bảng tổng hợp lỗi theo hạng mục

### 1.1 Border-radius
| Vai trò | Giá trị đang dùng lẫn lộn | Chuẩn đề xuất |
|---|---|---|
| Control (button, input, select trigger) | `rounded-lg` (chuẩn), `rounded-md` (chip nhỏ ở `documents/`) | `rounded-lg` |
| Container (card, modal, section) | `rounded-xl` (chuẩn), `rounded-2xl` (KnowledgeView, DocumentPdfViewer, ControlledCopyPreviewView) | `rounded-xl` |
| Pill/badge tròn | `rounded-full` (chuẩn), `rounded-xl` bị dùng sai cho pill nhỏ (`GeneralInformationTab.tsx:110`) | `rounded-full` |
| Checkbox | `rounded` (giá trị thứ 4, lẻ loi) | giữ nguyên nếu là quy ước riêng cho control rất nhỏ, hoặc đổi `rounded-sm` |

### 1.2 Typography — heading/section title
Ít nhất **8 tổ hợp size/weight** đang làm vai trò "tiêu đề section/card" mà không có 1 component chung:
- `text-lg font-bold`, `text-xl font-bold`, `text-lg sm:text-xl lg:text-2xl font-bold`, `text-lg font-semibold`, `text-base lg:text-lg font-semibold`, `text-sm sm:text-base md:text-lg font-bold`, `text-base font-semibold`, `text-2xl sm:text-3xl md:text-4xl font-bold` (hero)
- Riêng `settings/*` có pattern `<h3 className="text-sm font-semibold text-slate-900">` copy tay ở 8+ file (SystemInformationView, SecurityTab, IntegrationTab, GeneralTab, NotificationTab, FeaturesTab, DocumentTab, EmailTemplateEditView/CreateView)
- `security-authorization/` có 4 detail view cùng hiển thị "tên entity" nhưng 3 size khác nhau (`AccessReviewCampaignDetailView`, `PermissionSetDetailView`, `AccessProfileDetailView` dùng `text-base font-semibold`; `UserProfileView` dùng `text-lg font-semibold`)
- `auth/*` dùng scale riêng hoàn toàn (`AUTH_UI.pageTitle`: đổi cả font-weight theo breakpoint — không nơi nào khác trong app làm vậy); `MaintenanceModeView.tsx:32` còn lệch tiếp so với chính token đó
- `documents/knowledge/FolderDocumentsList.tsx:156` — heading 2-step (`text-base md:text-xl`) thiếu hẳn bước `lg:` so với chuẩn 3-step

**Chuẩn đề xuất**: `CardTitle` hiện có (`text-lg md:text-xl lg:text-2xl font-bold`) dùng cho tiêu đề cấp trang/section lớn; cần thêm 1 variant nhỏ hơn (`text-sm font-semibold`) chính thức hoá cho header card dạng settings, để 8 file kia trỏ về component thay vì copy tay.

### 1.3 Icon size
- Icon nhỏ trong control: `h-4 w-4` là chuẩn, nhưng `TabNav.tsx` tự nó dùng 3 kích cỡ khác nhau giữa các variant (`h-4 w-4 sm:h-[18px] sm:w-[18px]` underline, `h-3.5 w-3.5 sm:h-4 sm:w-4` pill) — trộn pixel cứng `18px` với thang Tailwind
- Icon-tile (icon trong khung tròn/vuông): ít nhất 3 size khác nhau (`h-7 w-7` ở `user-manual`, `w-10 h-10` và `h-9 w-9` ở `regulatory`/`risk-management`)
- `dashboard/DashboardView.tsx` tự nó mixed 3 kiểu: `size={18}` prop-based, `h-5 w-5`, `h-4 w-4` cho cùng vai trò icon hành động
- `ESignatureModal.tsx` — `h-4 w-4` cho pen icon cạnh `h-3.5 w-3.5` cho error icon trong cùng modal
- `ReportPreviewModal.tsx:219` — `h-4.5 w-4.5` (không phải bước chuẩn Tailwind, nghi là lỗi gõ của `h-4 w-4`)

**Chuẩn đề xuất**: icon nhỏ `h-4 w-4`, icon vừa `h-5 w-5`, icon-tile cố định 1 size (khuyến nghị `h-9 w-9` vì phổ biến nhất trong nhóm stat-card).

### 1.4 Màu sắc — status/badge
Badge/status color đang tồn tại **3 kiểu shade-pair trộn lẫn**, thay vì chỉ dùng quy ước `-50/-700` của `Badge.tsx`:
- `-50/-700` (đúng chuẩn)
- `-100/-700` (ví dụ: `notificationMeta.ts`, RPN pill `risk-management`, report group-count badge)
- `-100/-800` (ví dụ: `bg-red-100 text-red-800` ở `RiskManagementView.tsx:118` "Very High" — lệch ngay trong cùng hàm với các entry khác đang dùng `-50/-700`; `configuration/tabs/DocumentTab.tsx` dùng `text-emerald-800` trong khi chỗ khác toàn `-700`)

Nguyên nhân: mỗi module tự viết `getXColor()`/`getTypeColor()` riêng thay vì gọi `<Badge color=... />`. Đã đếm được **5+ hàm màu tự chế độc lập** (`regulatory` authority badge, `risk-management` risk-level + RPN, `notifications` type color, `my-tasks` module-color, `audit-trail` action badge) — có hàm còn tự mâu thuẫn nội bộ (`audit-trail/actionBadge.ts` 5 nhóm dùng `-50`, 1 nhóm dùng `-100`).

`StatusBadge` cũng bị override thủ công ở `NotificationsView.tsx:293` (`className="text-slate-700 bg-slate-100..."`) — phá vỡ mục đích tập trung hoá.

**Chuẩn đề xuất**: mọi màu status/badge bắt buộc đi qua `Badge`/`StatusBadge` với `-50/-700`; mở rộng `Badge` nhận `semantic` prop (success/warning/danger/info/neutral) để feature không cần tự viết hàm map màu nữa.

### 1.5 Hex cứng / inline style tĩnh
- `documents/knowledge/KnowledgeView.tsx:18-31` — bảng map 13 màu hex cứng + `style={{ color: COLOR_MAP[...] }}` (L345, L381)
- `settings/email-templates/*` — nồng độ hex nặng nhất: `EmailLivePreview.tsx:72` (`bg-[#f4f5f7]`), `LexicalEditor.css` (~20 hex trong file CSS thuần), `EmailTemplateEditView.tsx`/`CreateView.tsx` lặp `#059669` làm default color-picker
- `settings/publishing-templates/PublishingTemplateEditorView.tsx` — 4 lần hardcode `#000000`
- `auth/auth-ui.ts` — `#053f46`, `#fefcff` (gradient hex riêng cho theme teal)
- 48 chỗ dùng `style={{}}` trên 31 file — phần lớn hợp lý (progress bar động), một số là giá trị tĩnh lẽ ra nên là class Tailwind (tập trung ở `LexicalEditor.tsx`, `DocumentTab.tsx` (document-creation), `CellDetailDrawer.tsx`)

**Chuẩn đề xuất**: định nghĩa named constants cho các hex lặp lại (đặc biệt `#059669` = emerald-600 chính thức), cấm hex literal trực tiếp trong JSX ngoại trừ nơi thực sự cần giá trị động (color-picker preview).

### 1.6 Font-size tuỳ ý (arbitrary values) ngoài thang chuẩn
- `ESignatureModal.tsx` — **8+ giá trị** `text-[9px]` đến `text-[11px]` trong 1 file (modal ký điện tử, tần suất dùng cao, mức độ ảnh hưởng GMP cao)
- `text-[10px] md:text-[11px]` cho table header — lặp lại **~40+ lần** khắp `documents/` và `settings/` (không phải token, chỉ copy-paste thành thói quen)
- `TaskCard.tsx:119` — `text-[15px]` (không khớp bước Tailwind nào: 14px=sm, 16px=base)
- `settings/configuration/tabs/FeaturesTab.tsx:224`, `electronic-signature/ElectronicSignatureSettingsView.tsx:492` — `text-[13px]` một-lần-dùng, nên là `text-sm`
- `Badge.tsx:60-63` (`SIZE_STYLES`) tự nó dùng `text-[10px]`/`text-[11px]` vì thiếu token `text-2xs`

**Chuẩn đề xuất**: thêm token `text-2xs` (10px) vào Tailwind config để thay toàn bộ `text-[10px]`/`text-[11px]` rời rạc bằng 1 class có tên; cấm `text-[Npx]` khác ngoài whitelist.

### 1.7 Focus ring
Buttons dùng `ring-2`, mọi control khác (`Select`, `Checkbox`, `Switch`) dùng `ring-1` — không có lý do tài liệu hoá cho sự khác biệt.

### 1.8 File gần như trùng lặp 100% (nhân đôi rủi ro lệch style)
- `report/ReportTemplates.tsx` ↔ `ComplianceReports.tsx` (~800 dòng, ~95% giống nhau)
- `documents/.../RevisionApprovalView.tsx` ↔ `RevisionReviewView.tsx`
- `settings/email-templates/EmailTemplateEditView.tsx` ↔ `EmailTemplateCreateView.tsx`

→ Mọi lỗi style trong các cặp này đã bị nhân đôi và sẽ tiếp tục lệch nếu không tách phần dùng chung trước khi sửa style.

---

## 2. Khoảng cách / Spacing (padding, margin, gap)

MainLayout (`components/layout/MainLayout.tsx:300-302`) đã định nghĩa 1 pattern chuẩn áp cho **mọi trang route**: `px-4 pt-2 pb-6 md:px-6 md:pt-3 lg:px-8 lg:pt-4` + `space-y-4 md:space-y-6`. Modal (`FormModal`/`AlertModal`) cũng nhất quán. Vấn đề là `features/` tự viết lại thay vì kế thừa.

| Vai trò | Số pattern cạnh tranh | Ví dụ lệch điển hình | Chuẩn đề xuất |
|---|---|---|---|
| Container trang | 1 chuẩn (MainLayout) + 1 ngoại lệ | `ControlledCopyPreviewView.tsx:204` tự vẽ `px-4 py-6` cố định, đứng ngoài MainLayout | Dùng lại MainLayout; nếu buộc phải đứng ngoài, copy đúng bước responsive |
| Padding thân card | **9+ pattern** | `p-4 md:p-5` (30×, đúng chuẩn) lẫn `p-4` cố định (19×), `p-6` cố định không responsive (7×, tập trung ở 4 file `security-authorization/`) | `p-4 md:p-5` |
| Padding header card | **6+ pattern**, 3 kiểu bước responsive khác nhau | `px-4 sm:px-6` vs `px-2 sm:px-3` vs `px-1 sm:px-1.5` cho cùng vai trò | `px-4 md:px-5 py-3` (khớp `FormSection`) |
| Khoảng cách dọc giữa section trong trang | `space-y-6` áp đảo (76×) nhưng chỉ ~5% có bước responsive dù MainLayout đã mẫu sẵn | Hầu hết view "quên" bước `md:` | `space-y-4 md:space-y-6` |
| Gap dọc field trong form | 2 giá trị cạnh tranh không rõ quy tắc | `space-y-3` vs `space-y-4` | `space-y-4` (dành `space-y-3` cho nhóm radio/checkbox nén) |
| Gap grid form | **4 giá trị** (`gap-2/3/4/6`) cho cùng khối 2 cột; lệch cả breakpoint `sm:` vs `md:` | `grid-cols-1 md:grid-cols-2 gap-4` (37×) vs `sm:grid-cols-2 gap-4` (19×) vs `gap-6` (10×) | `grid-cols-1 md:grid-cols-2 gap-4`, thống nhất breakpoint `md:` |
| Gap toolbar/button group | 7 giá trị rời rạc + trộn `space-x-*` và `gap-*` cho cùng vai trò | `gap-1` đến `gap-5` | `gap-2` mặc định; modal footer giữ `gap-2 sm:gap-3` (đã chuẩn) |
| Padding ô bảng (`td`/`th`) | **10+ cặp giá trị**, từ `px-2 py-1` đến `px-5 py-4`, không có khái niệm compact/comfortable | | `px-4 py-3` (khớp `ResponsiveTable` mặc định); thêm biến thể "compact" `px-3 py-2` có đặt tên rõ ràng |
| Padding thân modal | **Nhất quán nhất** — đi qua `FormModal`/`AlertModal` | Không cần sửa | `px-4 sm:px-6 py-4 sm:py-5` (giữ nguyên) |
| Gap icon-text | 4 giá trị (`gap-1`, `1.5`, `2`, `2.5`) không rõ ranh giới | | `gap-1.5` |
| Margin heading→content | 5 giá trị cạnh tranh (`mb-1` đến `mb-4`) | | `mb-2` (subheading), `mb-3` (section heading) |

---

## 3. Danh sách màn hình/component lỗi nặng nhất (ưu tiên xử lý)

1. **`components/ui/esign-modal/ESignatureModal.tsx`** — 8+ font-size tuỳ ý, đây là màn hình ký điện tử GMP-critical, tần suất dùng cao
2. **`components/ui/tabs/TabNav.tsx`** — tự mâu thuẫn nội bộ giữa các variant (icon size, font-weight) — shared component nên lỗi nhân rộng khắp app
3. **`features/dashboard/DashboardView.tsx`** — trang chủ, traffic cao nhất: 3 kiểu icon-size, 2 thang tiêu đề không liên quan trong cùng file, hex cứng, inline style
4. **`features/auth/*`** (Login, ForgotPassword, ResetPassword, TwoFactor, MfaSetup, MaintenanceMode) — theme màu teal riêng biệt hoàn toàn với emerald chính thức của app; `MaintenanceModeView.tsx` lệch cả với chính token nội bộ của auth
5. **`features/documents/knowledge/KnowledgeView.tsx`** — hex map cứng, `rounded-2xl` lệch chuẩn, `rounded-md` chip lệch chuẩn, heading thiếu bước responsive
6. **`features/settings/publishing-templates/PublishingTemplateEditorView.tsx`** — file 2000+ dòng, 4 lần hex `#000000`, nhiều size tuỳ ý không nơi nào khác dùng
7. **`features/settings/email-templates/*`** — nồng độ hex nặng nhất toàn bộ audit (~20 hex trong 1 file CSS + nhiều hex lặp trong TSX)
8. **`features/report/ReportTemplates.tsx` + `ComplianceReports.tsx`** — cặp trùng lặp ~800 dòng, mọi lỗi style bị nhân đôi
9. **`features/my-tasks/components/TaskBoard.tsx`** — 5 bảng màu tự chế riêng biệt cho cột/thẻ, `text-[15px]` không khớp thang chuẩn
10. **`features/security-authorization/*`** — 4 detail view cùng vai trò "tên entity" nhưng 3 size heading khác nhau; 4 view module card (`AccessReviewView`, `ObjectAccessRulesView`, `PermissionSetsView`, `SegregationOfDutiesView`) dùng `p-6` cố định không responsive
11. **`features/training/materials/views/*`** — copy tay nhiều lần pattern "Not Found" heading và padding card thay vì dùng chung component
12. **`features/documents/controlled-copies/ControlledCopyPreviewView.tsx`** — đứng ngoài MainLayout, padding trang không responsive

---

## 4. Kế hoạch triển khai (5 giai đoạn)

### Giai đoạn 0 — Khoá nền tảng token (làm trước, không đụng code feature) ✅ DONE
- [x] ~~Chuyển Tailwind CDN config → `tailwind.config.ts` thật~~ — **điều chỉnh**: dự án dùng Tailwind CDN JIT runtime (không có PostCSS build step, xem `eqms/CLAUDE.md`), nên thay vào đó mở rộng trực tiếp object `tailwind.config` inline trong `index.html` để không đổi kiến trúc build
- [x] Thêm token `fontSize.2xs` (10px, `index.html`) để dần thay `text-[10px]`/`text-[11px]` rời rạc — token đã sẵn sàng, việc thay thế hàng loạt (~40+ chỗ) thực hiện ở Giai đoạn 4 theo từng module
- [x] Thêm `src/styles/tokens.ts` (`BRAND_PRIMARY_HEX`, `DEFAULT_BLACK_HEX`) và nối vào 3 file đang hardcode hex (`EmailTemplateCreateView.tsx`, `EmailTemplateEditView.tsx`, `PublishingTemplateEditorView.tsx`) — `LexicalEditor.css` (vendored editor skin) giữ nguyên, không đụng
- [x] Chốt bảng quy ước chính thức vào `eqms/CLAUDE.md` (mục "Style Conventions") — radius, icon size, badge color, spacing, micro text, hex constants

### Giai đoạn 1 — Bổ sung primitive còn thiếu trong `components/ui/`
- [ ] `SectionTitle` variant nhỏ (`text-sm font-semibold`) để thay 8+ file settings đang copy tay `<h3>`
- [ ] Mở rộng `Badge`/`StatusBadge` nhận `semantic` prop (success/warning/danger/info/neutral), bắt buộc feature dùng thay vì tự viết `getXColor()`
- [ ] `IconTile` chuẩn hoá icon-trong-khung (thay 3 size rời rạc)
- [ ] Thống nhất `Card`/`FormSection` là điểm vào duy nhất cho padding thân/header card
- [ ] Sửa `ESignatureModal.tsx` (font-size) và `TabNav.tsx` (icon-size + font-weight giữa variant) — 2 shared component lỗi nặng nhất

### Giai đoạn 2 — Dọn các "hot spot" cao rủi ro/traffic cao nhất
- [ ] `dashboard/DashboardView.tsx`
- [ ] `documents/knowledge/KnowledgeView.tsx`
- [ ] `settings/email-templates/*` + `settings/publishing-templates/PublishingTemplateEditorView.tsx`

### Giai đoạn 3 — Gộp các cặp file trùng lặp trước khi sửa style
- [ ] Tách phần chung của `ReportTemplates`/`ComplianceReports`
- [ ] Tách phần chung của `RevisionApprovalView`/`RevisionReviewView`
- [ ] Tách phần chung của `EmailTemplateEditView`/`CreateView`
> Làm bước này trước để tránh phải sửa style 2 lần và lệch lại ngay sau khi sửa.

### Giai đoạn 4 — Quét lại theo module, áp dụng primitive mới
Thứ tự ưu tiên theo lưu lượng + mức nhạy cảm GMP:
1. `documents/`
2. `security-authorization/`
3. `training/`
4. `settings/`
5. `report/`, `audit-trail/`
6. `my-tasks/`
7. `auth/` (quyết định trước: hợp nhất theme teal→emerald, hoặc ghi nhận là ngoại lệ có chủ đích)
8. Còn lại: `regulatory/`, `risk-management/`, `notifications/`, `preferences/`, `help-support/`, `user-manual/`, module placeholder (`deviations/`, `complaints/`, `capa/`, `equipment/`, `supplier/`, `product/`, `change-control/`)

Mỗi module khi quét lại:
- Thay `getColor()`/`getXColor()` tự chế bằng `Badge`/`StatusBadge`
- Thay heading tay bằng `SectionTitle`/`CardTitle`
- Thay `text-[10px] md:text-[11px]` bằng `text-2xs` token
- Thay `rounded-2xl`/`rounded-md` lệch chuẩn về đúng quy ước
- Thay padding/gap về bảng chuẩn ở mục 2
- Bổ sung bước responsive còn thiếu (đặc biệt: card body `p-4` → `p-4 md:p-5`, page `space-y-6` → `space-y-4 md:space-y-6`)

### Giai đoạn 5 — Chốt quy ước để không tái phát ✅ DONE
- [x] ~~ESLint rule tự động~~ — **điều chỉnh**: dự án hiện không có ESLint config/script nào (`package.json` không có `"lint"`, không có `eslint.config.*`). Cài mới cả bộ ESLint là thay đổi hạ tầng ngoài phạm vi "chỉ sửa style", nên bỏ qua; cơ chế phòng ngừa thực tế là bảng quy ước bắt buộc đã chốt trong `eqms/CLAUDE.md` (mục "Style Conventions", làm ở Giai đoạn 0) — mọi PR sau cần đối chiếu thủ công với bảng đó.
- [x] `eqms/CLAUDE.md` đã có bảng quy ước style/spacing đầy đủ (radius, icon size, badge color, `text-2xs`, hex constants, card/table/toolbar spacing).

---

## 6. Trạng thái triển khai thực tế (đã chạy xong toàn bộ Giai đoạn 0–5)

**Giai đoạn 0 (token nền tảng)**: xong — `text-2xs` token, `src/styles/tokens.ts`, bảng quy ước trong CLAUDE.md.

**Giai đoạn 1 (primitive UI kit)**: xong — `Badge` có `semantic` prop, `CardTitle` có `size="sm"`, `IconTile` mới, `ESignatureModal.tsx` và `TabNav.tsx` đã dọn xong font-size/icon-size tuỳ ý.

**Giai đoạn 2 (hot-spot)**: xong — `DashboardView.tsx`, `KnowledgeView.tsx`/`FolderDocumentsList.tsx`, `EmailLivePreview.tsx`/`EmailTemplateEditView.tsx`/`EmailTemplateCreateView.tsx`/`PublishingTemplateEditorView.tsx`.

**Giai đoạn 3 (gộp file trùng lặp)**: **hoãn có chủ đích** — đây là refactor cấu trúc component (không chỉ đổi className), rủi ro hành vi cao hơn hẳn phần còn lại, đặc biệt `RevisionApprovalView`/`RevisionReviewView` nằm trong luồng phê duyệt tài liệu GMP-critical. 3 cặp file (`ReportTemplates`/`ComplianceReports`, `RevisionApprovalView`/`RevisionReviewView`, `EmailTemplateEditView`/`CreateView`) **vẫn còn trùng lặp cấu trúc** — style bên trong từng file đã được đồng bộ ở Giai đoạn 4 nhưng cần sửa 2 lần nếu style đổi tiếp trong tương lai. Nếu muốn xử lý, cần một phiên làm việc riêng có review kỹ, không tự động hoá.

**Giai đoạn 4 (quét toàn bộ `features/`)**: xong toàn bộ 22 module — `security-authorization`, `training` (materials, compliance-tracking, records-archive, course-inventory, my-training), `settings` (dictionaries, e-signature, templates, user-profile, configuration), `report`, `audit-trail`, `my-tasks`, `auth` (hợp nhất theme teal→emerald), `documents` (toàn bộ trừ Giai đoạn 3), `regulatory`, `risk-management`, `notifications`, `preferences`, `help-support`, `user-manual`, 7 module placeholder.

**Giai đoạn 5 (chốt quy ước)**: xong theo hình thức điều chỉnh — dùng CLAUDE.md thay vì ESLint.

### Các mục tồn đọng có chủ đích (ghi lại để làm phiên sau, không phải bỏ sót)

1. **3 cặp file trùng lặp cấu trúc** (Giai đoạn 3 hoãn) — xem trên.
2. **`auth-ui.ts`**: input `h-11 sm:h-12` và `rounded-xl` vẫn khác control convention chung (`rounded-lg`, height nhỏ hơn ở `Select.tsx`). Đây là thay đổi kích thước/UX rủi ro hơn màu sắc, cố tình chưa đụng khi hợp nhất theme sang emerald.
3. **`RegulatoryView.tsx` `getAuthorityBadge()`**: vẫn là hàm màu tự chế (8 màu), không gọi `<Badge>` — nhưng shade đã đúng chuẩn `-50/-700` nên chỉ là khác biệt thẩm mỹ về cách viết code, không phải lỗi hiển thị.
4. **`UserManualView.tsx`** icon-tile sidebar vẫn `h-7 w-7` (chưa lên `h-9 w-9`) — cố tình giữ vì nằm trong hàng compact, sợ tràn layout.
5. Một số file còn `text-[11px] sm:text-xs`/`text-[9px]` rải rác ở vài nơi rất nhỏ lẻ (không phải table-header) chưa được quét — không ảnh hưởng đáng kể, có thể dọn tiếp khi chạm vào file đó.

---

## 5. Nguyên tắc khi thực thi (để không phá kiến trúc UI)

- Không đổi hành vi/logic, chỉ đổi className/style — mỗi PR nên tách riêng theo giai đoạn/module ở trên, không gộp nhiều module vào 1 PR lớn
- Ưu tiên sửa tại **primitive dùng chung** trước (Giai đoạn 0-1) rồi mới lan xuống feature (Giai đoạn 2-4) — tránh vừa sửa token vừa sửa feature cùng lúc gây khó review
- Giai đoạn 3 (gộp file trùng lặp) cần review kỹ vì đụng đến cấu trúc component, nên làm riêng, có thể trước hoặc song song Giai đoạn 2
- Sau mỗi module ở Giai đoạn 4, kiểm tra responsive thực tế trên trình duyệt ở 3 breakpoint (mobile/tablet/desktop) trước khi coi là xong — không chỉ dựa vào build/typecheck
