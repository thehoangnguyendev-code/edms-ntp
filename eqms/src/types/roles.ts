/**
 * The legacy `app_users.role_name` display label -- a free-text field set at user creation,
 * shown/filtered in User Management. It is NOT an entitlement source: real authorization is
 * resolved through the user's Access Profile(s) (see `accessProfileIds` on
 * `CreateUserPayload`), never this string. Renamed from the historical `UserRole` name, which
 * incorrectly implied it was an RBAC role.
 *
 * The concrete values are whatever labels exist in the Access Profile catalog at the time (see
 * `settingsApi.getFilterOptions()` on the backend) -- not a fixed enum. Kept as `string` rather
 * than a union so the type doesn't silently drift out of sync with what the server actually
 * returns.
 */
export type UserRoleLabel = string;
