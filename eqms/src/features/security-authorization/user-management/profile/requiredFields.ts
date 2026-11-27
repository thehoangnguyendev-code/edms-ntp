import type { NewUser } from "../types";
import type { ProfileTabId } from "./components/ProfileTabLayout";

/** Which tab each field of the Add User form lives on, for the fields that can carry an error. */
const TAB_OF_FIELD: Partial<Record<string, ProfileTabId>> = {
  employeeCode: "personal",
  fullName: "personal",
  username: "personal",
  email: "personal",
  phone: "personal",
  dateOfBirth: "personal",
  businessUnit: "employment",
  department: "employment",
  position: "employment",
  startDate: "employment",
  employmentType: "employment",
  status: "account",
  accessProfileIds: "security",
};

/** The fields Create User will not go ahead without, per tab. Same set `validateForm` checks. */
export const REQUIRED_FIELDS: Record<Exclude<ProfileTabId, "audit">, ReadonlyArray<keyof NewUser>> = {
  personal: ["employeeCode", "fullName", "username", "email"],
  employment: ["businessUnit", "department", "position", "startDate", "employmentType"],
  qualifications: [],
  account: ["status"],
  security: ["accessProfileIds"],
};

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (Array.isArray(value) ? value.length === 0 : String(value).trim() === "");

export const TOTAL_REQUIRED = Object.values(REQUIRED_FIELDS).reduce((sum, fields) => sum + fields.length, 0);

/** How many required fields are still empty on each tab. */
export function countMissingRequired(user: Partial<NewUser>): Record<ProfileTabId, number> {
  const missing = {} as Record<ProfileTabId, number>;
  (Object.keys(REQUIRED_FIELDS) as ProfileTabId[]).forEach((tab) => {
    missing[tab] = REQUIRED_FIELDS[tab].filter((field) => isBlank(user[field])).length;
  });
  return missing;
}

/** The tabs that hold a field with an error message, in tab order. */
export function tabsWithErrors(errors: Record<string, string>): ProfileTabId[] {
  const found = new Set<ProfileTabId>();
  Object.entries(errors).forEach(([field, message]) => {
    const tab = TAB_OF_FIELD[field];
    if (message && tab) found.add(tab);
  });
  return (Object.keys(REQUIRED_FIELDS) as ProfileTabId[]).filter((tab) => found.has(tab));
}
