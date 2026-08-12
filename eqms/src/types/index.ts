/**
 * Shared TypeScript Types
 * Common types used across the application
 */

// ============ App Types ============
export * from './app';
export * from './roles';
import { UserRole } from './roles';

export * from './document';
import { User } from './user';

// ============ Task Types ============
export interface Task {
  id: string;
  taskNumber: string;
  title: string;
  description?: string;
  module: ModuleType;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  assignee: string;
  assigneeAvatar?: string;
  reporter: string;
  reporterAvatar?: string;
  progress: number;
  timeline: TimelineEvent[];
  createdAt?: string;
  updatedAt?: string;
}

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Pending' | 'In-Progress' | 'Reviewing' | 'Completed';
export type ModuleType = 'DMS' | 'Training' | 'Reports' | 'Audit Trail' | 'System';

export interface TaskFilter {
  module?: string;
  priority?: string;
  status?: string;
  assignee?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface TimelineEvent {
  date: string;
  action: string;
  user: string;
}

export * from './user';


export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  expiresIn: number;
}

// ============ Common Types ============
export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code: string;
  details?: any;
}

export interface SelectOption {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// ============ Audit Trail Types ============
export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  userName: string;
  timestamp: string;
  changes?: AuditChange[];
  ipAddress?: string;
}

export interface AuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}

// ============ Notification Types ============
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

// ============ Form Types ============
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'file';
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: SelectOption[];
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern';
  value?: any;
  message: string;
}

// ============ Settings Types ============
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: NotificationSettings;
  display: DisplaySettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  taskReminders: boolean;
  documentUpdates: boolean;
}

export interface DisplaySettings {
  itemsPerPage: number;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

// ============ Prompt Specification Types ============
export interface PromptSpecificationField {
  name: string;
  type: string;
  required?: boolean;
  length?: number;
  description?: string;
}

export interface PromptSpecificationEntity {
  name: string;
  tableName?: string;
  primaryKey?: string;
  fields: PromptSpecificationField[];
}

export interface PromptSpecificationRelationship {
  fromEntity: string;
  toEntity: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  foreignKey?: string;
}

export interface PromptSpecificationWorkflowState {
  name: string;
  order: number;
  isFinal?: boolean;
}

export interface PromptSpecificationSpec {
  entities: PromptSpecificationEntity[];
  relationships?: PromptSpecificationRelationship[];
  validationRules?: string[];
  workflowStates?: PromptSpecificationWorkflowState[];
  endpoints?: string[];
  uiScreens?: string[];
}
