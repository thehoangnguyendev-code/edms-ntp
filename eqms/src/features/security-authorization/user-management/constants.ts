import { TableColumn } from "./types";

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
  { id: "role", label: "Access Profile", visible: true, order: 7 },
  { id: "position", label: "Position", visible: true, order: 8 },
  { id: "businessUnit", label: "Business Unit", visible: true, order: 9 },
  { id: "department", label: "Department", visible: true, order: 10 },
  { id: "status", label: "Account Status", visible: true, order: 11, locked: true },
  { id: "inSession", label: "Online", visible: true, order: 12 },
  { id: "suspendedUntil", label: "Suspended Until", visible: true, order: 13, locked: true },
  { id: "terminationDate", label: "Termination Date", visible: true, order: 14, locked: true },
  { id: "lastLogin", label: "Last Login", visible: true, order: 15 },
  { id: "createdDate", label: "Created Date", visible: true, order: 16 },
  { id: "lastUpdated", label: "Last Updated", visible: true, order: 17 },
];

