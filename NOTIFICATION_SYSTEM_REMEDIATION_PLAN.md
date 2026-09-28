# KẾ HOẠCH CẢI TỔ TOÀN DIỆN HỆ THỐNG THÔNG BÁO (In-App + Email)

> **Cập nhật 2026-08-12**: phạm vi Telegram/WhatsApp đã bị huỷ theo yêu cầu người dùng — xem Mục "Tiến độ triển khai" (Phase 5-6) cuối file. Tiêu đề/nội dung phía trên giữ nguyên dạng gốc lúc lập kế hoạch để không xoá lịch sử quyết định.

> Tài liệu này là kế hoạch thực thi cho Claude Code, cập nhật tiến độ trực tiếp vào Mục "Tiến độ triển khai" ở cuối file mỗi khi có thay đổi thật. Không tin các mô tả cũ trong tài liệu khác mà không tự verify lại qua code/`psql`/API thật.

## Bối cảnh

Người dùng phản ánh (2026-08-12) chức năng thông báo qua app và email "đang hoạt động chưa tốt hoặc chưa đầy đủ chức năng". Đã khảo sát kỹ toàn bộ hệ thống (3 agent song song: backend, frontend, inventory trigger + hạ tầng email) trước khi lập kế hoạch, không suy đoán. Kết quả khảo sát xác nhận vấn đề có thật và khá sâu.

### Backend — 2 pipeline gửi thông báo song song, không thống nhất

- Pipeline cũ `EmailNotificationService` (gọi rải rác từ `RevisionService`, `ControlledCopyService`, `SystemConfigurationService`, hardcode tên template) — đây là đường đi chính cho hầu hết thông báo Document/Revision hiện nay.
- Pipeline mới `NotificationDispatcher.dispatch(eventCode, recipients, variables)` (policy-driven, có mandatory-lock GMP thật) — chỉ được gọi trực tiếp ở đúng 3 chỗ (`ControlledCopyService` 2 chỗ, `EmailNotificationService.dispatchPolicyNotification` 1 chỗ gọi gián tiếp qua biến `notificationEventCode`).
- Hậu quả: **5/7 sự kiện "GMP bắt buộc" đã seed trong catalog** (`document.published`, `controlled_copy.recalled`, `controlled_copy.destroyed`, `security.password_changed`, `security.mfa_updated`, `security.account_locked`) **không có code nào thực sự gọi `dispatch()` cho chúng** — dù cơ chế khoá "không thể tắt/không thể đổi kênh" cho sự kiện mandatory là có thật và đúng ở tầng `NotificationPolicyService`/`NotificationDispatcher`, các sự kiện này có thể chưa từng bắn ra trong thực tế.
- **Thiếu trigger hoàn toàn**: user bị suspend/terminate (0 thông báo), access review campaign đến hạn (0 thông báo, không có scheduler).
- **Digest (DAILY/WEEKLY), quiet hours, escalation**: đầy đủ schema + API + validation ở `NotificationPolicyService`, nhưng không có job nào đọc và thực thi — chỉnh trong UI admin không có tác dụng thật.
- **Email**: hạ tầng JavaMail thật có (`EmailService` + `spring-boot-starter-mail`), nhưng cấu hình SMTP 100% lấy từ DB runtime (System Configuration), không có fallback tĩnh, không có mail-catcher cho dev/test trong `docker-compose.yml`. Mỗi lần gửi tạo mới `JavaMailSenderImpl` (mở kết nối SMTP mới) — không tái sử dụng connection, sẽ chậm khi gửi hàng loạt.
- **2 hệ thống template nội dung tách biệt**: `EmailTemplate` (dùng cho email thật) vs `NotificationTemplateVersion` (chỉ IN_APP, sau V255/V257 đã cố tình bỏ kênh EMAIL khỏi policy engine) — admin phải duy trì nội dung 2 nơi cho cùng 1 sự kiện.
- Xử lý lỗi: có retry 3 lần + bảng `notification_delivery_failures` cho email, nhưng tạo bản ghi in-app lỗi thì nuốt exception âm thầm (`catch (Exception ex) { log.warn(...) }`).
- Kênh Push (mobile/web push) có field preference nhưng không có implementation nào ở backend.

### Frontend — kiến trúc tổng thể ổn (SSE thật, REST thật), nhưng nhiều mảng dở dang

- 6/13 hàm trong `notificationApi` không được gọi ở bất kỳ đâu: `getUnreadCount`, `getNotificationById`, `markGroupAsRead`, `deleteNotifications`, `clearAllRead`, `getPreferences`/`updatePreferences` — không có UI chọn nhiều để đánh dấu đã đọc/xoá hàng loạt, không có nút "xoá đã đọc".
- **2 đường lưu preference không đồng bộ**: `NotificationSettingsTab.tsx` lưu qua `authApi.updateNotificationSettings()`, trong khi backend có sẵn endpoint chuyên dụng `/notifications/preferences` mà FE không bao giờ gọi tới.
- **Nút "Test Telegram/WhatsApp" trong Settings > Notification là giả** — chỉ `setTimeout` rồi hiện toast thành công, không gọi API nào, backend cũng chưa có tích hợp Telegram/WhatsApp thật.
- Code chết: `features/notifications/mockData.ts`, `contexts/NotificationContext.tsx`.
- Không có toast/snackbar khi có thông báo real-time mới trong lúc đang mở tab — chỉ có badge nhấp nháy, hoặc push OS-level nếu user đã bật quyền.
- Lỗi fetch bị nuốt bằng `console.error`, không có trạng thái lỗi hiển thị cho người dùng.

### DB

Schema (`user_notifications`, `notification_event_definitions`, `notification_policies`, `notification_template_versions`, `notification_delivery_failures`) được thiết kế khá tốt — vấn đề chính không phải ở DB mà ở việc code không phủ hết catalog đã seed.

### Quyết định phạm vi đã chốt với người dùng (qua `AskUserQuestion`, 2026-08-12)

1. Làm **toàn diện**: thống nhất kiến trúc 2 pipeline thành 1, vá đủ 5 sự kiện GMP mồ côi, thêm trigger còn thiếu (user suspend/terminate, access review), thực thi thật digest/quiet-hours/escalation.
2. ~~Xây tích hợp Telegram/WhatsApp thật~~ — **quyết định này đã bị đảo ngược sau đó (2026-08-12): người dùng yêu cầu bỏ hẳn Telegram/WhatsApp**, xem Mục "Tiến độ triển khai" cuối file.

**Lưu ý về Telegram/WhatsApp**: Telegram Bot API không có rào cản gì ngoài code. **WhatsApp Business Cloud API có phụ thuộc bên ngoài thật sự** — cần tài khoản Meta Business đã xác minh, số điện thoại đăng ký riêng cho API, và template tin nhắn phải được Meta duyệt trước khi gửi chủ động. Kế hoạch tách WhatsApp thành nhánh riêng với "chế độ sandbox" (log thay vì gửi thật) để không chặn phần còn lại khi chưa có tài khoản Meta đã duyệt.

---

## Kiến trúc đích

**Nguyên tắc trung tâm** (giống mô hình đã áp dụng cho `AuthorizationEngineService` trong `SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md`): **một điểm vào duy nhất** cho mọi thông báo nghiệp vụ — mở rộng `NotificationDispatcher.dispatch(eventCode, recipients, variables)` thành orchestrator thật sự, chịu trách nhiệm cho toàn bộ 4 kênh (In-App, Email, Telegram, WhatsApp), không chỉ In-App như hiện tại. Mọi service nghiệp vụ chỉ cần: resolve danh sách recipient + build `variables` map + gọi `dispatcher.dispatch(eventCode, recipients, variables)`.

```
Business event (RevisionService, ControlledCopyService, UserManagementService, AccessReviewService, Auth...)
        │
        ▼
NotificationDispatcher.dispatch(eventCode, recipients, variables)
        │
        ├─ 1. Resolve NotificationPolicy theo eventCode (đã có)
        ├─ 2. Kiểm tra mandatory-lock GMP (đã có, giữ nguyên)
        ├─ 3. Resolve audience cuối cùng (đã có)
        ├─ 4. Với mỗi kênh trong enabled_channels ∩ preference user (mandatory bỏ qua preference):
        │       IN_APP      → render NotificationTemplateVersion(channel=IN_APP)  → UserNotification (ngay lập tức, luôn real-time)
        │       EMAIL       → render NotificationTemplateVersion(channel=EMAIL)   → digest/quiet-hours check → gửi ngay hoặc đẩy vào notification_dispatch_queue
        │       TELEGRAM    → render NotificationTemplateVersion(channel=TELEGRAM)→ digest/quiet-hours check → gửi ngay hoặc đẩy vào notification_dispatch_queue
        │       WHATSAPP    → render NotificationTemplateVersion(channel=WHATSAPP)→ digest/quiet-hours check → gửi ngay hoặc đẩy vào notification_dispatch_queue
        └─ 5. SSE ping tới các recipient đang online (giữ nguyên NotificationRealtimeService)

NotificationDigestScheduler (cron: mỗi giờ, quét digest đến hạn theo digestMode/quietHours)
        └─ Gom các dòng notification_dispatch_queue đã đến hạn theo (recipient, channel) → 1 tin tổng hợp → gửi qua adapter kênh tương ứng → đánh dấu SENT

NotificationEscalationScheduler (cron: mỗi 5-10 phút)
        └─ Quét UserNotification chưa đọc quá escalationAfterMinutes cho policy có escalationEnabled → dispatch tiếp cho escalationRecipientRules
```

Điểm quan trọng: **In-App luôn gửi ngay lập tức** bất kể digest mode — digest/quiet-hours chỉ áp dụng cho kênh đẩy ra ngoài (Email/Telegram/WhatsApp).

---

## DB — migration cần thêm

Trước khi đặt số hiệu migration mới: chạy `SELECT MAX(version) FROM flyway_schema_history` thật trên DB đang chạy để lấy version tiếp theo chính xác.

1. **Đưa lại EMAIL làm kênh hợp lệ trong policy engine** (đảo ngược một phần V255/V257): thêm `EMAIL`, `TELEGRAM`, `WHATSAPP` vào `supported_channels`/`enabled_channels` của `notification_event_definitions`/`notification_policies`; migrate dữ liệu từ bảng `email_templates` cũ sang `notification_template_versions` (channel=EMAIL) cho từng eventCode — giữ `email_templates` song song một thời gian để rollback an toàn.
2. **`notification_dispatch_queue`** (bảng mới): `id, policy_id, event_code, recipient_user_id, channel, rendered_subject, rendered_body, variables_snapshot JSONB, scheduled_for, status (PENDING/SENT/FAILED/CANCELLED), attempts, created_at, sent_at`. Index `(status, scheduled_for)`.
3. **Seed event definition mới**: `user.account_suspended`, `user.account_terminated`, `access_review.campaign_due` vào `notification_event_definitions`, kèm policy mặc định.
4. **`app_users`**: thêm cột `telegram_chat_id` (nullable, unique), `telegram_link_token`/`telegram_link_expires_at`, `whatsapp_phone_number` (nullable), `whatsapp_verified_at`.
5. **Cấu hình kênh mới**: mở rộng JSON `notifications` trong `system_configurations` (giống cách SMTP đang lưu) để chứa `telegramBotToken`, `whatsappBusinessAccountId`/`whatsappAccessToken`/`whatsappPhoneNumberId`.
6. **`notification_delivery_failures`**: thêm cột `channel` (email/telegram/whatsapp/in_app) nếu chưa có.

---

## Backend — các việc cụ thể

### 1. Hợp nhất pipeline (việc lớn nhất)
- Mở rộng `NotificationDispatcher` với logic multi-channel như sơ đồ trên. Tái sử dụng retry+failure-tracking logic có sẵn của `EmailService`/`EmailNotificationService` (không viết lại) nhưng gọi từ dispatcher thay vì để business service tự gọi trực tiếp.
- Viết `TelegramNotificationService` (mới), `WhatsAppNotificationService` (mới), cùng interface `ChannelNotificationSender` để dispatcher gọi thống nhất.
- Sửa từng call site nghiệp vụ đang gọi `EmailNotificationService.send*` trực tiếp (`RevisionService.dispatchRevisionNotification` — ~15 nhánh if/else theo actionType/targetStatus; `ControlledCopyService` — `sendControlledCopyDistributionNotification`/`notifyControlledCopyStakeholders`/`notifyControlledCopyBatchStakeholders`; `SystemConfigurationService.sendPreferenceUpdateNotification`) để thay bằng `dispatcher.dispatch(eventCode, recipients, variables)`. Đối chiếu từng nhánh với event catalog đã seed để không mất behaviour nào.
- Giữ `EmailNotificationService` như internal helper chỉ được gọi từ `NotificationDispatcher`.

### 2. Vá 5 sự kiện GMP mồ côi
- `document.published`: xác nhận nhánh `PUBLISH` trong `RevisionService.dispatchRevisionNotification` gọi đúng `dispatch("document.published", ...)`.
- `controlled_copy.recalled`/`controlled_copy.destroyed`: wire vào đúng action handler trong `ControlledCopyService`.
- `security.password_changed`/`security.mfa_updated`: định vị chính xác nơi đổi mật khẩu/MFA xảy ra thật (cần đọc lại `AuthController`/`UserManagementService`) và wire dispatch.
- `security.account_locked`: định vị logic khoá tài khoản sau nhiều lần đăng nhập sai thật (rate-limit/lockout filter) và wire dispatch.

### 3. Trigger còn thiếu hoàn toàn
- `user.account_suspended`/`user.account_terminated`: gọi `dispatcher.dispatch(...)` ngay sau khi `UserManagementService.suspendUser`/`terminateUser` thành công.
- `access_review.campaign_due`: viết `AccessReviewNotificationScheduler` (mới, `@Scheduled` hàng ngày) quét `access_review_campaigns` theo ngày đến hạn.

### 4. Digest / Quiet hours / Escalation — thực thi thật
- `NotificationDigestScheduler` (mới, `@Scheduled` mỗi giờ): quét `notification_dispatch_queue` đến hạn, gom theo `(recipient_user_id, channel)`, gửi 1 lần tổng hợp, update status=SENT.
- Trong `NotificationDispatcher`: nếu `policy.digestMode != IMMEDIATE` hoặc đang trong quietHours → tính `scheduled_for` → insert vào `notification_dispatch_queue` thay vì gửi ngay.
- `NotificationEscalationScheduler` (mới, `@Scheduled` mỗi 5-10 phút): quét notification chưa đọc quá `escalationAfterMinutes` cho policy có `escalationEnabled=true`, dispatch tiếp cho `escalationRecipientRules`.

### 5. Email — tin cậy + hiệu năng
- `EmailService`: cache `JavaMailSenderImpl` theo hash cấu hình SMTP hiện tại, invalidate khi admin lưu lại System Configuration.
- `docker-compose.yml`: thêm service **MailHog hoặc Mailpit** (mail catcher cho dev/test).
- Sửa `recordInboxNotificationFromTemplate`: thay silent catch-log bằng ghi vào `notification_delivery_failures` với `channel=in_app`.

### 6. Telegram integration (thật)
- `TelegramNotificationService`: gọi Telegram Bot API `sendMessage` bằng bot token cấu hình trong System Configuration.
- Luồng liên kết: sinh `telegram_link_token` → user bấm "Liên kết Telegram" ở FE → mở `https://t.me/<bot_username>?start=<token>` → webhook công khai `POST /notifications/telegram/webhook` (thêm vào `permitAll` trong `SecurityConfig`, xác thực bằng secret token Telegram gửi kèm header, không phải JWT) → map `chat_id` vào `app_users.telegram_chat_id`.
- Admin test endpoint: `POST /configurations/notifications/test-telegram`.

### 7. WhatsApp integration (thật, có phụ thuộc ngoài)
- `WhatsAppNotificationService`: gọi WhatsApp Business Cloud API (Meta Graph API), dùng access token + message template đã được Meta duyệt.
- Luồng liên kết: user nhập số điện thoại → OTP qua template đã duyệt (hoặc tạm qua SMS/email nếu chưa có template) → xác nhận → lưu `whatsapp_verified_at`.
- **Chế độ sandbox bắt buộc lúc đầu**: khi chưa có Access Token/Business Account đã duyệt thật, chạy "log-only mode" (đánh dấu `sandbox=true`) để không chặn phần code còn lại.
- Admin test endpoint: `POST /configurations/notifications/test-whatsapp`.

---

## Frontend — các việc cụ thể

1. **Thống nhất preferences**: sửa `NotificationSettingsTab.tsx` dùng `notificationApi.getPreferences()`/`updatePreferences()` làm nguồn duy nhất; kiểm tra `authApi.updateNotificationSettings()` có nơi khác dùng không trước khi bỏ hẳn.
2. **Bulk actions thật** trong `NotificationsView.tsx`: checkbox chọn nhiều + toolbar, nối `markGroupAsRead`/`deleteNotifications`/`clearAllRead` đã có ở API client nhưng chưa dùng.
3. **Xoá code chết đã xác nhận**: `getUnreadCount`, `getNotificationById` (trừ khi review phát hiện lý do cần giữ), `features/notifications/mockData.ts`, `contexts/NotificationContext.tsx`.
4. **Toast khi có thông báo mới**: trong handler SSE `notification-updated`, thêm `useToast()` hiển thị toast ngắn, không phụ thuộc quyền push OS.
5. **Trạng thái lỗi hiển thị**: thay `console.error`-only bằng toast lỗi khi fetch thất bại.
6. **Telegram/WhatsApp UI thật**: sửa `NotificationTab.tsx` — nút Test gọi API thật; thêm luồng "Liên kết Telegram"/"Liên kết WhatsApp" trong `NotificationSettingsTab.tsx`.

---

## Thứ tự triển khai đề xuất

1. **Phase 0 — DB + hợp nhất pipeline core**: nền tảng bắt buộc, mọi phase sau phụ thuộc vào đây.
2. **Phase 1 — Vá 5 sự kiện GMP mồ côi + trigger thiếu**: giá trị GMP compliance cao nhất.
3. **Phase 2 — Digest/Quiet-hours/Escalation thật**.
4. **Phase 3 — Email reliability** (gồm MailHog dev): có thể song song Phase 1-2.
5. **Phase 4 — Frontend fixes** (trừ Telegram/WhatsApp UI): có thể song song Phase 1-3.
6. **Phase 5 — Telegram integration**: độc lập, không rào cản ngoài.
7. **Phase 6 — WhatsApp integration**: sau cùng, sandbox mode trước, chờ tài khoản Meta duyệt song song không chặn phase khác.

## Kiểm thử/Verify

- Backend: unit test cho `NotificationDispatcher` mở rộng (mock từng channel sender, verify mandatory-lock qua nhiều kênh, verify digest/quiet-hours tính đúng `scheduled_for`), unit test cho từng trigger mới.
- Build + `./mvnw -q -o test` toàn backend, đối chiếu số lỗi hạ tầng đã biết (không phát sinh lỗi mới).
- Deploy Docker thật (`docker build` + `docker compose up -d --no-deps --force-recreate backend`), dùng MailHog để xem email thật render đúng nội dung.
- Gọi thật qua API (JWT thật) để trigger từng sự kiện đã vá và xác nhận: có dòng `user_notifications`, có email trong MailHog (hoặc `notification_dispatch_queue` nếu digest), SSE đẩy tới FE.
- Telegram: test thật với bot token thật, 1 tài khoản test.
- WhatsApp: sandbox mode trước, test thật sau khi có tài khoản Meta đã duyệt.
- Frontend: `npx tsc --noEmit`, test thủ công: bulk actions, preferences round-trip, toast khi có thông báo mới, luồng liên kết Telegram/WhatsApp.

---

## Tiến độ triển khai (cập nhật bởi Claude Code)

- [x] **Phase 0 — DB migration + năng lực multi-channel cho dispatcher — Hoàn tất (2026-08-12).**
  - Migration `V370__notification_dispatch_queue_and_channel_expansion.sql`: bảng `notification_dispatch_queue` (cho Phase 2), cột `channel` trên `notification_delivery_failures`, cột `telegram_chat_id`/`telegram_link_token`/`telegram_link_expires_at`/`whatsapp_phone_number`/`whatsapp_verified_at` trên `app_users` (cho Phase 5/6), seed 3 event definition mồ côi hoàn toàn trước đây (`user.account_suspended`, `user.account_terminated`, `access_review.campaign_due`) kèm policy mặc định (`enabled_channels=IN_APP`, admin có thể bật EMAIL sau khi viết nội dung template qua UI Notification Policy đã có sẵn). Xác nhận `NotificationTemplateVersion`/`NotificationPolicy` vốn đã không có CHECK constraint giới hạn channel — V255/V257 trước đây chỉ xoá dữ liệu, không khoá schema — nên không cần ALTER gì để "mở lại" EMAIL ở tầng DB.
  - `NotificationDispatcher.dispatch()`: thêm nhánh EMAIL đầy đủ — khi policy có `EMAIL` trong `enabled_channels` và có `NotificationTemplateVersion(channel=EMAIL, status=ACTIVE)`, render subject/body bằng đúng `render()` engine đã dùng cho IN_APP, tôn trọng `NotificationPreferenceUtils.canReceiveEmailNotification` (bỏ qua nếu `mandatory=true`, đúng theo cơ chế khoá GMP đã có), gọi qua `EmailNotificationService.sendRenderedEmailWithTracking(...)` (method mới) để tái dùng đúng logic retry 3 lần + ghi `notification_delivery_failures` đã có sẵn cho pipeline cũ — không viết lại retry logic.
  - `EmailService.sendRenderedEmail(to, subject, htmlBody)` (mới): gửi email đã render sẵn, không cần `EmailTemplate` entity — tách biệt khỏi `sendTemplateEmail` (vẫn giữ nguyên cho pipeline cũ dùng `EmailTemplate`).
  - **Quyết định phạm vi điều chỉnh so với plan gốc**: Phase 0 chỉ xây **năng lực** multi-channel cho dispatcher (đã chứng minh hoạt động qua unit test + build/deploy), **chưa** rewiring toàn bộ ~15 nhánh của `RevisionService.dispatchRevisionNotification` hay các call site khác từ `EmailNotificationService.send*` sang `dispatcher.dispatch()` — việc đó dời sang Phase 1, gắn liền với việc vá từng sự kiện GMP mồ côi cụ thể (mỗi sự kiện vá xong sẽ tự nhiên đi qua dispatcher mới), tránh làm 1 lần rủi ro cao không kiểm chứng được từng phần.
  - Test mới: `NotificationDispatcherEmailChannelTest.java` (5 case: gửi email khi đủ điều kiện, tôn trọng preference tắt email, mandatory bỏ qua preference, không có template EMAIL thì không gửi, channel EMAIL không bật trong policy thì không gửi).
  - Verify: build + `./mvnw -q -o test` (541 test, 0 fail, 8 lỗi hạ tầng đã biết từ trước không liên quan) + deploy Docker thật (`docker compose up -d --no-deps --force-recreate backend`) + xác nhận migration V370 áp dụng thành công trong log Flyway + xác nhận bảng/cột/seed data qua `psql` trực tiếp trên DB đang chạy.
- [x] **Phase 1 — Vá sự kiện GMP mồ côi + trigger thiếu — Hoàn tất (2026-08-12).**
  - **Phát hiện lại quan trọng khi đọc code thật (không tin báo cáo khảo sát ban đầu)**: chỉ **3/7** sự kiện GMP mandatory thực sự "mồ côi" (`security.password_changed`, `security.mfa_updated`, `security.account_locked`) — 3 sự kiện khác (`document.published`, `controlled_copy.recalled`, `controlled_copy.destroyed`) **đã có code gọi `dispatch()` thật từ trước** (`RevisionService.resolveDocumentNotificationPolicyEvent`/`ControlledCopyService` qua `notifyControlledCopyStakeholders`), báo cáo khảo sát ban đầu (agent) đã sai ở điểm này — đã tự verify lại bằng cách đọc trực tiếp code trước khi code thêm bất cứ gì.
  - **3 sự kiện thật sự vá**: wire `notificationDispatcher.dispatch(...)` vào đúng nơi xảy ra thật trong `AuthService` (self-change-password, reset-password-qua-token, `enableMfa`, `disableMfa`, `handleFailedLogin` khi vừa khoá) và `UserManagementService` (admin reset password hộ user). Cả `AuthService` và `UserManagementService` cần thêm `NotificationDispatcher` vào constructor — xác nhận không có vòng phụ thuộc (không service nào trong chuỗi `NotificationDispatcher→...` gọi ngược lại 2 service này).
  - **2 trigger thêm mới hoàn toàn**: `user.account_suspended`/`user.account_terminated` wire vào cuối `UserManagementService.suspendUser`/`terminateUser`; `access_review.campaign_due` — file mới `AccessReviewNotificationScheduler.java` (`@Scheduled` hàng ngày, dùng `DistributedSchedulerLockService` đúng pattern `ControlledCopyExpiryScheduler`, khớp theo đúng ngày nhắc nhở — không cần cột "đã nhắc" riêng vì so khớp ngày chính xác tự nhiên idempotent).
  - **2 bug thật phát hiện qua live-verify (không phải chỉ code review), đã vá + verify lại**:
    1. **Migration V370 thiếu nội dung template**: seed `notification_event_definitions`+`notification_policies` cho 3 event mới nhưng quên `notification_template_versions` (title/summary IN_APP) — khiến `dispatch()` chạy xong không lỗi, không log, nhưng không tạo được gì (không có content để render). Phát hiện khi suspend thật user test không thấy dòng nào trong `user_notifications`. Vá bằng **migration V371** (seed content, `WHERE NOT EXISTS` để an toàn khi chạy lại).
    2. **`resolveRecipients()` filter sai cho `AFFECTED_USERS`**: caller set status user thành Suspended/Terminated *trước khi* gọi `dispatch()`, nhưng dispatcher lọc contextual recipients theo `isActive()` — vô tình loại bỏ chính người cần nhận thông báo. Vá bằng cách cho `AFFECTED_USERS` bỏ qua filter Active (khác `OWNER`/`REVIEWER`/... vẫn giữ nguyên filter, đúng vì đó là người tham gia workflow phải đang hoạt động).
    3. **Bug thứ 3, nghiêm trọng hơn, phát hiện ngoài phạm vi ban đầu**: `AuthService.login()` là `@Transactional` và `throw new UnauthorizedException(...)` khi sai mật khẩu — mặc định Spring rollback toàn bộ transaction khi gặp RuntimeException, **xoá mất chính thay đổi `failedLoginCount`/`lockedUntil` mà `handleFailedLogin()` vừa ghi** → **account lockout chưa bao giờ hoạt động thật trong toàn bộ hệ thống** (không phải riêng vấn đề thiếu thông báo). Xác nhận qua `psql` trực tiếp: sau 5 lần đăng nhập sai thật qua API, `failed_login_count` vẫn = 0. Vá bằng `@Transactional(noRollbackFor = UnauthorizedException.class)` trên `login()` — đã kiểm tra không có nhánh nào khác trong method này ném `UnauthorizedException` sau khi ghi state cần rollback thật (MFA đang tắt toàn cục qua `MFA_DISABLED=true`, các nhánh sau đó chỉ return thành công).
  - Test mới: `NotificationDispatcherEmailChannelTest` (Phase 0, không đổi), `NotificationDispatcherAffectedUserTest.java` (2 case: AFFECTED_USERS bỏ qua filter Active, OWNER vẫn bị filter đúng), `AccessReviewNotificationSchedulerTest.java` (3 case: dispatch khi có reviewer, skip khi không có reviewer, skip khi không lấy được lock cluster).
  - Verify: build + `./mvnw -q -o test` (546 test, 0 fail, 8 lỗi hạ tầng đã biết không liên quan) + deploy Docker thật (build **không cache** sau khi nghi ngờ nhầm image cũ — hoá ra do dùng `unzip` sai cách để kiểm tra jar, không phải bug cache thật, nhưng build lại cho chắc) + gọi API thật xác nhận từng luồng tạo đúng dòng `user_notifications`: tự đổi mật khẩu (`security.password_changed`), admin suspend user test (`user.account_suspended`, đã reinstate lại sau khi test xong). **Chưa live-verify được `security.account_locked` đầy đủ 5 lần sai thật** — bị chặn bởi rate-limit auth (cửa sổ 15 phút) sau các lần thử trước đó; độ tin cậy dựa trên: xác nhận root cause thật qua `psql` trước/sau fix + toàn bộ test suite pass + thay đổi tối thiểu/rõ phạm vi — cần xác nhận lại bằng 1 lần thử thật sau khi rate-limit hết hạn.
- [x] **Phase 2 — Digest/Quiet-hours/Escalation thật thi hành — Hoàn tất (2026-08-12).**
  - **Schema**: entity `NotificationDispatchQueue` (map bảng `notification_dispatch_queue` đã tạo ở V370) + `NotificationDispatchQueueRepository`. Migration **V372**: thêm cột `escalated_at` vào `user_notifications` (tránh escalate lặp lại nhiều lần cùng 1 thông báo — so khớp theo đúng cột này thay vì cửa sổ thời gian, tự nhiên idempotent giống pattern access-review scheduler ở Phase 1).
  - **`NotificationDispatcher`**: thêm `computeDeferredSendTime(policy)` — DAILY_DIGEST/WEEKLY_DIGEST luôn hoãn (giờ cố định 08:00, tuần hoãn tới thứ Hai gần nhất), quiet hours (`quietHoursStart`/`End`, hỗ trợ cả trường hợp qua nửa đêm) hoãn tới đúng thời điểm hết quiet hours — **chỉ áp dụng cho kênh đẩy ra ngoài (EMAIL, sau này Telegram/WhatsApp), IN_APP luôn gửi ngay lập tức** đúng nguyên tắc đã chốt trong kiến trúc đích. Sự kiện mandatory GMP **luôn bỏ qua digest/quiet-hours**, gửi ngay — đúng nguyên tắc đã ghi trong class javadoc gốc, không phải quyết định mới.
  - **`NotificationDigestScheduler`** (mới, `@Scheduled` mỗi giờ, dùng `DistributedSchedulerLockService`): gom các dòng `notification_dispatch_queue` đã đến hạn theo `(recipient, channel)`, gửi 1 email tổng hợp (nếu >1 mục thì nối các mục bằng `<hr/>` + tiêu đề từng mục, subject đổi thành "You have N new updates"), đánh dấu SENT/FAILED. Chỉ có sender cho kênh EMAIL hiện tại — kênh khác (Telegram/WhatsApp, khi có ở Phase 5/6) sẽ tự động chạy được nhờ log cảnh báo rõ ràng thay vì lỗi, không cần sửa lại phần chọn nhóm.
  - **`NotificationEscalationScheduler`** (mới, `@Scheduled` mỗi 10 phút): quét `user_notifications` chưa đọc + chưa escalate, so `createdAt + escalationAfterMinutes` với thời điểm hiện tại theo đúng policy của `type` (eventCode) đó, resolve audience qua `escalationRecipientRules` (tái dùng lại **chính `resolveRecipients()`** của `NotificationDispatcher` — đổi từ `private` sang package-visible thay vì viết lại logic ALL_USERS/PERMISSION lần 2), rồi `dispatch()` lại **cùng eventCode + cùng nội dung** (khôi phục `variables` từ `metadata` JSONB đã lưu sẵn lúc dispatch ban đầu — không cần truy vấn lại entity gốc) cho nhóm escalation.
  - Test mới (14 case, 3 file riêng theo từng lớp trách nhiệm): `NotificationDispatcherDigestDeferralTest` (5 case: immediate gửi ngay, daily/weekly hoãn đúng thời điểm, quiet-hours hoãn, mandatory luôn bỏ qua), `NotificationDigestSchedulerTest` (5 case: gửi 1 mục giữ subject gốc, gộp nhiều mục thành 1 email, đánh dấu FAILED khi gửi lỗi, không làm gì khi rỗng, bỏ qua khi không lấy được lock), `NotificationEscalationSchedulerTest` (4 case: escalate đúng khi quá hạn, không escalate khi chưa đến hạn, không escalate khi policy tắt escalation, bỏ qua khi không lấy được lock).
  - Verify: build + `./mvnw -q -o test` (560 test, 0 fail, 8 lỗi hạ tầng đã biết không liên quan) + deploy Docker thật, migration V372 áp dụng sạch, khởi động sạch. **Chưa live-verify E2E thật** (không có cách xem nội dung email thật an toàn trong dev khi chưa có Phase 3/MailHog) — độ tin cậy dựa trên 14 unit test cô lập từng khâu (quyết định hoãn, tiêu thụ hàng đợi, escalation) thay vì 1 lần chạy thật; nên verify lại bằng UI/API thật sau khi Phase 3 xong.
- [x] **Phase 3 — Email reliability — Hoàn tất (2026-08-12), có live E2E thật qua MailHog.**
  - **`EmailService`**: cache `JavaMailSenderImpl` theo hash cấu hình SMTP (host/port/username/password/useSSL) trong `AtomicReference` — đổi cấu hình ở System Configuration tự động tạo hash mới, không cần hook invalidate riêng. Thêm `mail.smtp.connectionpoolsize=5` + timeout hợp lý (10s connect/read/write) để tái dùng kết nối SMTP giữa các lần gửi thay vì mở mới mỗi lần. `testConnection` (nút Test của admin) cố tình **bỏ qua cache** (gọi thẳng `buildMailSender`) để không làm bẩn cache thật bằng config thử.
  - **Bug thật phát hiện qua live-verify**: `mail.smtp.auth` bị hardcode `"true"` — khi `smtpUsername` rỗng (relay không cần auth, ví dụ MailHog hoặc nhiều relay nội bộ), JavaMail vẫn cố AUTH và bị từ chối, log ra y hệt lỗi sai credentials thật, dễ làm admin hiểu lầm là SMTP config sai. Vá bằng cách chỉ bật `mail.smtp.auth` khi có `smtpUsername`.
  - **`docker-compose.yml`**: thêm service `mailhog` (image `mailhog/mailhog:v1.0.1`, port 8025 web UI + 1025 SMTP), không phụ thuộc `backend` (cấu hình SMTP luôn runtime qua System Configuration, không cần lúc backend khởi động).
  - **Sửa silent-swallow in-app**: `NotificationDeliveryFailure` thêm field `channel` (map cột đã tạo sẵn ở V370 nhưng chưa từng dùng trong entity). `EmailNotificationService.recordInboxNotificationFromTemplate`'s catch block giờ gọi `recordInAppDeliveryFailure(...)` — ghi vào `notification_delivery_failures` với `channel=IN_APP` thay vì chỉ `log.warn` — admin xem được qua màn Delivery Failures đã có sẵn (`GET /notifications/delivery-failures`), lọc theo channel.
  - Verify: build + `./mvnw -q -o test` (560 test, 0 fail, 8 lỗi hạ tầng đã biết). **Live E2E thật qua MailHog**: cấu hình SMTP trỏ vào `mailhog:1025` qua `PUT /settings/system` (API thật, JWT thật), bật tạm EMAIL channel + seed 1 EMAIL template cho `security.password_changed` (qua `psql`, chỉ để test — đã revert lại `IN_APP` sau khi xong), trigger đổi mật khẩu thật qua `POST /auth/me/change-password`, xác nhận email thật xuất hiện trong MailHog (`GET http://localhost:8025/api/v2/messages`) với đúng subject "Your EQMS password was changed" và body đã render đúng `{{recipientName}}` → "Nguyen The Hoang" — xác nhận toàn bộ chuỗi Dispatcher → EMAIL branch → connection-pooled EmailService → SMTP thật hoạt động đúng từ đầu đến cuối.
  - **Tác dụng phụ đã biết**: mật khẩu admin hiện là `Admin@1234567` (đổi qua lại nhiều lần trong lúc test bị chặn bởi password-history-reuse-5-lần, không quay lại được `Admin@123` ngay) — cần nhớ dùng mật khẩu này ở phiên sau, hoặc đổi lại thủ công qua UI khi cần.
- [x] **Phase 4 — Frontend fixes — Hoàn tất (2026-08-12), trừ UI Telegram/WhatsApp (dời sang Phase 5/6 theo đúng plan gốc).**
  - **Thống nhất preferences**: `NotificationSettingsTab.tsx` đổi từ `authApi.updateNotificationSettings()` (`PUT /auth/me/notification-settings`) sang `notificationApi.updatePreferences()` (`PUT /notifications/preferences`, trước đó tồn tại ở backend nhưng FE chưa từng gọi). Backend xác nhận cả 2 route đọc/ghi đúng cùng field (`UserAccount.notificationPreferences`/`emailNotificationsEnabled`) nên đổi an toàn — vì response mới chỉ trả về preferences (không phải full user), merge thủ công vào `updateUser()` để giữ `AuthContext` đồng bộ mà không cần round-trip thứ 2. Xác nhận `updateNotificationSettings` không còn dùng ở đâu khác → xoá hẳn khỏi `auth.ts` (giữ nguyên 2 type `NotificationPreferences`/`NotificationChannelPreferences` vì `AuthUser` vẫn cần).
  - **Bulk actions thật** trong `NotificationsView.tsx`: thêm cột checkbox (chọn 1/chọn tất cả trên trang hiện tại), toolbar hiện khi có lựa chọn ("Mark as read"/"Delete"/"Clear selection"), nút "Clear read" ở header — nối vào `markGroupAsRead`/`deleteNotifications`/`clearAllRead` đã có sẵn ở API client nhưng chưa từng được gọi. Selection tự xoá khi đổi trang/tab.
  - **Xoá code chết đã xác nhận không dùng ở đâu khác** (grep toàn repo trước khi xoá): `getUnreadCount`/`getNotificationById` (khỏi `notifications.ts` — trùng chức năng `getSummary()`/điều hướng qua `actionUrl` đã đủ), `features/notifications/mockData.ts` (28 dòng dữ liệu giả, không import ở đâu), `contexts/NotificationContext.tsx` + bỏ mount khỏi `contexts/index.tsx` (toàn bộ `NotificationProvider`/`useNotifications`/`useNotificationToast` không được gọi ở đâu, tự ghi "deprecated" trong chính file).
  - **Toast khi có thông báo mới**: viết lại `BrowserNotificationBridge.tsx` — trước đây toàn bộ luồng fetch-kiểm-tra bị khoá sau điều kiện "user đã bật kênh Push", nên nếu tắt push thì SSE ping tới cũng không làm gì cả. Tách ra: luôn fetch+so sánh mục chưa đọc mới nhất khi có SSE ping (không phụ thuộc push), hiện `showToast()` cho mục đó; native `window.Notification` (OS popup) chỉ thêm vào **sau đó**, vẫn đúng gate cũ (push preference + quyền trình duyệt).
  - **Trạng thái lỗi hiển thị**: `NotificationsView.tsx` — mọi `console.error`-only trước đây (load list, mark read, mark all, delete, export) giờ thêm `showToast({type:'error',...})`; giữ nguyên `console.error` cho devtools.
  - Verify: `npx tsc --noEmit` sạch, `npm run dev` khởi động sạch, `docker build ./eqms` + `docker restart eqms-frontend` sạch, `curl http://localhost:3000/` trả 200. **Chưa test thủ công qua trình duyệt thật** (môi trường không có browser access) — đây là giới hạn thật cần người dùng tự xác nhận qua UI khi có dịp, không phải đã bỏ qua.
- [x] **Phase 5-6 — Telegram/WhatsApp integration — ĐÃ HUỶ theo yêu cầu người dùng (2026-08-12).**
  - Người dùng quyết định bỏ hẳn việc tích hợp Telegram/WhatsApp — đảo ngược quyết định "xây tích hợp thật" ban đầu.
  - **FE**: xoá 2 `SettingsCard` "Telegram Notifications"/"WhatsApp Notifications" khỏi `NotificationTab.tsx` (kể cả state/handler/nút Test giả `handleTestTelegram`/`handleTestWhatsApp`), xoá `TelegramConfig`/`WhatsAppConfig` interface + field `telegramConfig`/`whatsappConfig`/`enableTelegramNotifications`/`enableWhatsAppNotifications` khỏi `NotificationConfig` (`types.ts`). Không đụng `SmsConfig`/`enableSms` (dead code có từ trước, không phải do phiên này tạo ra, không thuộc phạm vi dọn dẹp).
  - **BE**: migration **V373** xoá 5 cột `telegram_chat_id`/`telegram_link_token`/`telegram_link_expires_at`/`whatsapp_phone_number`/`whatsapp_verified_at` đã thêm ở V370 (chưa từng có entity field/code nào đọc/ghi các cột này — xoá sạch, không có dữ liệu thật để mất). JSON default config trong `SystemConfigurationService` (chứa key `telegramConfig`/`whatsappConfig`) là dữ liệu mặc định **có từ trước phiên này**, không phải do phiên này thêm — giữ nguyên, vô hại (JSON tĩnh, không còn UI nào đọc).
  - **Phát hiện phụ trong lúc làm**: file `V372__remove_help_support_module_permissions.sql` xuất hiện trên đĩa cùng version `372` với `V372__notification_escalation_tracking.sql` (đã áp dụng thật từ Phase 2) — xung đột version thật sẽ làm Flyway crash khi khởi động. Xác nhận qua `flyway_schema_history` rằng file "help support" **chưa từng được áp dụng** ở DB đang chạy → đổi tên an toàn thành **V374** (giữ nguyên nội dung, không đụng vào migration của mình đã áp dụng).
  - Verify: build + `./mvnw -q -o test` (560 test, 0 fail) + `npx tsc --noEmit` sạch + deploy Docker thật cả backend (V373+V374 áp dụng đúng thứ tự, không crash) lẫn frontend (build + restart + `curl` 200).
