-- Per-user Home Page preference (Settings > Users > create/edit): where the user lands
-- immediately after login -- Dashboard (default, unchanged behavior), Notifications, or Knowledge.
ALTER TABLE app_users
    ADD COLUMN home_page VARCHAR(40) NOT NULL DEFAULT 'DASHBOARD';
