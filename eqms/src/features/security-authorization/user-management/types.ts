// User Management Type Definitions - Re-exporting from global types
import {
  User,
  UserRoleLabel,
  UserStatus,
  UserGender, 
  EmploymentType, 
  Certification, 
  EducationItem, 
  CreateUserPayload, 
  NewUser, 
  UserFilters 
} from '@/types';

export type {
  User,
  UserRoleLabel,
  UserStatus,
  UserGender, 
  EmploymentType, 
  Certification, 
  EducationItem, 
  CreateUserPayload, 
  NewUser, 
  UserFilters 
};

export interface TableColumn {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  locked?: boolean;
}

// --- API Payload Types ---

export interface SuspendUserPayload {
  reason: string;
  suspendedUntil?: string;
  signatureToken: string;
}

export interface TerminateUserPayload {
  reason: string;
  terminationDate: string;
  signatureToken: string;
}

export interface ResetPasswordPayload {
  newPassword?: string;
  sendEmail?: boolean;
  signatureToken: string;
  reason?: string;
}

export interface ForceLogoutPayload {
  reason: string;
}

/** One row on the "Logged in Users" admin screen -- a live session, joined with its user. */
export interface LoggedInSession {
  sessionId: string;
  userId: string;
  employeeCode: string | null;
  fullName: string;
  username: string;
  email: string;
  department: string | null;
  position: string | null;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  currentSession: boolean;
  /** Active session AND activity within the last 5 minutes -- same "Online" definition the User
   *  Management list's Online filter already uses. */
  online: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

/** One row on the "Time-Limited User" admin screen -- one grant, one user. Several users
 *  selected in a single Create submission always come back as separate rows, never merged. */
export interface TimeLimitedUserGrant {
  id: string;
  userId: string;
  employeeCode: string | null;
  fullName: string;
  username: string;
  email: string;
  /** ISO instant -- carries a time-of-day, not just a date. */
  startAt: string;
  endAt: string;
  notifyEmailOnExpiry: boolean;
  notifiedAt: string | null;
  reason: string | null;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  windowState: 'PENDING' | 'IN_WINDOW' | 'EXPIRED' | 'CANCELLED';
  createdByName: string | null;
  createdAt: string;
  cancelledByName: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface CreateTimeLimitedUserGrantPayload {
  userIds: string[];
  /** ISO instant -- carries a time-of-day, not just a date. */
  startAt: string;
  endAt: string;
  notifyEmailOnExpiry: boolean;
  reason?: string;
  signatureToken: string;
}

export interface CancelTimeLimitedUserGrantPayload {
  reason: string;
  signatureToken: string;
}

/** Changes to an active grant are signed and audited server-side. */
export interface UpdateTimeLimitedUserGrantPayload {
  startAt: string;
  endAt: string;
  notifyEmailOnExpiry: boolean;
  reason?: string;
  signatureToken: string;
}
