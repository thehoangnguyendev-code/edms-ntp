# System monitoring cards: realtime over the existing event stream (2026-10-07)

Owner request: no Refresh button; the cards update by themselves, using the SSE stream the system already has.

- **Server**: `SystemMonitoringRealtimeService` sends the event `system-monitoring-changed` every 10 s over `/notifications/stream`, only
  to connected users who hold `dashboard.admin.view` (checked per user, cached for one minute, nothing sent on any doubt or error) and
  only while such a user is connected. Like `entity-changed` it carries no data.
- **Screen**: `SystemMonitoringSection` reads the figures through the existing authorised call `GET /dashboard/system-monitoring` when
  the event arrives, when the stream (re)connects, and when the tab becomes visible again; nothing is read while the tab is hidden.
  The Refresh button and the browser timer are gone. "Checked at" still shows the age of the figures.
- **Not changed**: the endpoint, its permission, and its figures. A failed read still shows dashes, never zero or an old number.
- **Tests**: `SystemMonitoringRealtimeServiceTest` (4: only admins, no data, no work when nobody is connected, permission cache and
  withdrawal, failures), `AdminDashboardView.test.tsx` (event-driven reads, reconnect, other events ignored, hidden tab, unsubscribe).
- **Not done**: not watched in a browser over a long session; the figures are still read by a request after each event (no figures are
  pushed), so one admin tab costs one snapshot per 10 s.
