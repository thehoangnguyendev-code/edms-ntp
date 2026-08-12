import type { UserRole } from './roles';

export type UserStatus = "Active" | "Inactive" | "Pending" | "Suspended" | "Terminated";
export type UserGender = "Male" | "Female" | "Other";
export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Intern";
export type ExternalProvisioningStatus = "NOT_INVITED" | "INVITED" | "REDEEMED" | "FAILED" | "DISABLED";

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
  /** Display-only summary of active Access Profiles returned by the server. */
  role: string;
  position: string;
  businessUnit: string;
  department: string;
  status: UserStatus;
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
}

/** Payload for creating a user. Access Profile IDs are the stable entitlement source. */
export type CreateUserPayload = Omit<User, "id" | "lastLogin" | "createdDate" | "lastUpdated" | "role"> & {
  primaryAccessProfileId: string;
  additionalAccessProfileIds?: string[];
  inviteExternal?: boolean;
};

/** Local form model. Authorization uses profile IDs, never a mutable profile name. */
export type NewUser = CreateUserPayload;

// --- Filter Types ---

export interface UserFilters {
  search: string;
  role: UserRole | "All";
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
