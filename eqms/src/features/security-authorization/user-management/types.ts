// User Management Type Definitions - Re-exporting from global types
import { 
  User, 
  UserRole, 
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
  UserRole, 
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
  signatureToken: string;
}
