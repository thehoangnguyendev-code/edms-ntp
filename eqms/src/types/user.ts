import type { UserRoleLabel } from './roles';

export type UserStatus = "Active" | "Inactive" | "Pending" | "Suspended" | "Terminated";
export type UserGender = "Male" | "Female" | "Other";
export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Intern";
export type ExternalProvisioningStatus = "NOT_INVITED" | "INVITED" | "REDEEMED" | "FAILED" | "DISABLED";
/** Where this user lands immediately after login. Set by Admin on create/edit. */
export type HomePage = "DASHBOARD" | "NOTIFICATIONS" | "KNOWLEDGE";

export interface Certification {
  id: string;
  name: string;
  issuingOrg: string;
  issueDate?: string;
  expiryDate?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileObjectUrl?: string;
}

export interface EducationItem {
  id: string;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: string;
  gpa: string;
}

export interface User {
  id: string;
  employeeCode: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  /** The legacy app_users.role_name free-text display label -- NOT derived from or synchronized
   *  with Access Profile assignment. See UserRoleLabel in types/roles.ts. */
  role: UserRoleLabel;
  /** Real Access Profile names actually granting this user's entitlement (user_access_profiles),
   *  ordered by assignment date. Empty means the user has zero Access Profiles and cannot use any
   *  permission-gated function until an admin assigns one. */
  accessProfileNames?: string[];
  position: string;
  businessUnit: string;
  department: string;
  status: UserStatus;
  /** True while the server has actually locked login out (failed-attempt lockout).
   * Independent of `status` -- there is no UserStatus.Locked, so an Active account can still
   * be login-locked and the UI must not report it as plain "Active" in that case. */
  accountLocked?: boolean;
  inSession?: boolean;
  online?: boolean;
  lastLogin: string;
  createdDate: string;
  lastUpdated: string;
  firstName?: string;
  lastName?: string;
  permissions?: string[];
  avatar?: string;
  requirePasswordChange?: boolean;
  passwordChangeReason?: 'FIRST_LOGIN' | 'ADMIN_RESET' | 'PASSWORD_EXPIRED' | 'SECURITY_INCIDENT' | 'LEGACY_REQUIRED' | null;
  mfaEnabled?: boolean;
  mfaEmailFallbackEnabled?: boolean;
  mfaRememberDeviceEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  notificationPreferences?: {
    channels?: {
      email?: boolean;
      inApp?: boolean;
      push?: boolean;
    };
    modules?: Record<string, boolean>;
  };
  mfaSetupRequired?: boolean;
  /** Admin-mandated per-user MFA requirement, independent of the user's own mfaEnabled
   *  self-service toggle and of the global "Enforce Two-Factor Authentication" security
   *  setting. Effective requirement = global setting OR this flag. Set by Admin on create/edit. */
  mfaRequiredByAdmin?: boolean;
  maintenanceMode?: boolean;
  // Extended profile fields
  dateOfBirth?: string;
  gender?: UserGender;
  nationality?: string;
  address?: string;
  employmentType?: EmploymentType;
  startDate?: string;
  managerName?: string;
  language?: string;
  idNumber?: string;
  // Education & Qualifications
  degree?: string;
  fieldOfStudy?: string;
  institution?: string;
  graduationYear?: string;
  gpa?: string;
  educationList?: EducationItem[];
  professionalLevel?: string;
  areaOfExpertise?: string;
  yearsOfExperience?: string;
  previousEmployer?: string;
  certifications?: Certification[];
  // Employment status tracking
  suspendReason?: string;
  suspendedUntil?: string;
  terminationReason?: string;
  terminationDate?: string;
  /** Server-backed Microsoft Entra guest provisioning state. */
  externalProvisioningStatus?: ExternalProvisioningStatus | string | null;
  externalProvisioningEmail?: string | null;
  externalProvisioningStatusLabel?: string | null;
  externalProvisioningStatusColor?: string | null;
  /** Where this user lands immediately after login. Defaults to DASHBOARD server-side. */
  homePage?: HomePage;
}

/** Payload for creating a user. Access Profile IDs are the stable entitlement source -- one flat
 *  list, no primary/additional split (user_access_profiles never persisted that distinction).
 *  Server-enforced with the same SoD combination check the FE runs live (never trust the FE check
 *  alone) -- see UserManagementService.createUser. */
export type CreateUserPayload = Omit<User, "id" | "lastLogin" | "createdDate" | "lastUpdated" | "role" | "accessProfileNames"> & {
  accessProfileIds: string[];
  inviteExternal?: boolean;
};

/** Local form model. Authorization uses profile IDs, never a mutable profile name. */
export type NewUser = CreateUserPayload;

// --- Filter Types ---

export interface UserFilters {
  search: string;
  role: UserRoleLabel | "All";
  status: UserStatus | "All";
  businessUnit: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  suspendFrom: string;
  suspendTo: string;
  terminateFrom: string;
  terminateTo: string;
}
