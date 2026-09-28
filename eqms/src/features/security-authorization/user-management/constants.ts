import { TableColumn, UserStatus } from "./types";

// What each account status means -- shown as a tooltip on the status badge so an Admin doesn't
// have to guess (e.g. mistake "Inactive" for "Suspended", or not realize "Terminated" is
// permanent while "Suspended" is reversible).
export const USER_STATUS_DESCRIPTIONS: Record<UserStatus, string> = {
  Active: "Account is active and can sign in normally.",
  Pending: "Account created but not yet activated by the user or an admin.",
  Inactive: "Account is not in use (e.g. never logged in). Distinct from Suspended: not a disciplinary/administrative lock.",
  Suspended: "Access temporarily revoked. All sessions are terminated. Reversible -- an admin can reactivate the account.",
  Terminated: "Employment/access permanently ended. Not reversible through the normal reactivation flow.",
};

// Routes
export const USER_MANAGEMENT_ROUTES = {
  LIST: "/settings/users",
  ADD: "/settings/users/add",
  EDIT: (userId: string) => `/settings/users/edit/${userId}`,
  PROFILE: (userId: string) => `/settings/users/profile/${userId}`,
} as const;

// Business Units and their Departments mapping
export const BUSINESS_UNIT_DEPARTMENTS: { [key: string]: string[] } = {
  "Corporate": ["IT Department", "Human Resources", "Finance", "Legal"],
  "Operations": ["Production", "Warehouse", "Logistics", "Maintenance"],
  "Quality": ["Quality Assurance", "Quality Control", "Regulatory Affairs"],
  "Research": ["R&D", "Laboratory", "Clinical Research"],
};

// Default table columns configuration
export const DEFAULT_COLUMNS: TableColumn[] = [
  { id: "no", label: "No.", visible: true, order: 0, locked: true },
  { id: "employeeCode", label: "Employee ID", visible: true, order: 1, locked: true },
  { id: "fullName", label: "Full Name", visible: true, order: 2, locked: true },
  { id: "username", label: "Username", visible: true, order: 3 },
  { id: "email", label: "Email", visible: true, order: 4 },
  { id: "externalProvisioning", label: "Microsoft Entra", visible: true, order: 5, locked: true },
  { id: "phone", label: "Phone Number", visible: true, order: 6 },
  // "role" is the query-param/column id kept for URL/API back-compat, but the data behind it is
  // now the user's real Access Profile assignment(s) (user_access_profiles), not the legacy
  // app_users.role_name label -- see UserManagementResponse.accessProfileNames.
  { id: "role", label: "Access Profile", visible: true, order: 7 },
  { id: "position", label: "Position", visible: true, order: 8 },
  { id: "businessUnit", label: "Business Unit", visible: true, order: 9 },
  { id: "department", label: "Department", visible: true, order: 10 },
  { id: "status", label: "Account Status", visible: true, order: 11, locked: true },
  { id: "suspendedUntil", label: "Suspended Until", visible: true, order: 13, locked: true },
  { id: "terminationDate", label: "Termination Date", visible: true, order: 14, locked: true },
  { id: "createdDate", label: "Created Date", visible: true, order: 16 },
  { id: "lastUpdated", label: "Last Updated", visible: true, order: 17 },
];

