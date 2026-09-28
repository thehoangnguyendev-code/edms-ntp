// User Management Module Exports -- two sub-features: the permanent-user "profile" flow and the
// separate "time-limited" user flow. This is the real public barrel now; features/settings/index.ts
// imports through it instead of reaching into views/* directly.

// Profile flow
export { UserManagementView } from "./profile/views/UserManagementView";
export { AddUserView } from "./profile/views/AddUserView";
export { UserProfileView } from "./profile/views/UserProfileView";
export { CredentialsModal } from "./profile/components/CredentialsModal";
export { ResetPasswordModal } from "./profile/components/ResetPasswordModal";

export { useUserList } from "./profile/hooks/useUserList";
export { useUserProfile } from "./profile/hooks/useUserProfile";

// Time-limited user flow
export { LoggedInUsersView } from "./time-limited/views/LoggedInUsersView";
export { TimeLimitedUserListView } from "./time-limited/views/TimeLimitedUserListView";
export { TimeLimitedUserCreateView } from "./time-limited/views/TimeLimitedUserCreateView";
export { TimeLimitedUserDetailView } from "./time-limited/views/TimeLimitedUserDetailView";
export { TimeLimitedUserEditView } from "./time-limited/views/TimeLimitedUserEditView";

// Shared primitives
export * from "./types";
export * from "./constants";
export * from "./profile/utils";
