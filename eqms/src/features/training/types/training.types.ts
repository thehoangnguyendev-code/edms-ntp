/**
 * Training Core Types
 *
 * Single source of truth for all training course / workflow / progress types.
 * Import from here instead of re-declaring in each view file.
 */

import { User } from '@/types';
import { CourseReviewer, CourseApprover } from '../course-inventory/shared/workflow.types';

// ─── Course / Training Status ────────────────────────────────────────────────
export type TrainingStatus =
  | "Draft"
  | "Pending Review"
  | "Pending Approval"
  | "Effective"
  | "Obsoleted"
  | "Closed - Cancelled";

export type TrainingType =
  | "GMP"
  | "Safety"
  | "Technical"
  | "Compliance"
  | "SOP"
  | "Software";

// Training Method: defines how employees complete the course
export type TrainingMethod =
  | "Read & Understood"           // Employee reads, then confirms + e-sign
  | "Quiz (Paper-based/Manual)"   // Paper or manual quiz graded offline
  | "Hands-on/OJT";               // On-the-job training requiring trainer sign-off

// ─── Course Workflow Status ───────────────────────────────────────────────────
export type CourseWorkflowStatus =
  | "Draft"
  | "Pending Review"
  | "Pending Approval"
  | "Effective"
  | "Rejected"
  | "Obsoleted"
  | "Closed - Cancelled";

// Alias kept for backward compatibility
export type CourseApprovalStatus = CourseWorkflowStatus;

// ─── Supporting Types ────────────────────────────────────────────────────────
export interface Recurrence {
  enabled: boolean;
  intervalMonths: number; // e.g. 12 = annual retraining
  warningPeriodDays: number; // e.g. 30 days before expiration
}

export type AttendanceStatus =
  | "Registered"
  | "Attended"
  | "Absent"
  | "Excused";

// Quiz/Test Types — used inside Theory Quiz method
export type QuestionType = "multiple_choice" | "essay";
export type TrainingTestType = "read_understand" | "test_certification";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  points: number;
  imageUrl?: string;
  options?: QuestionOption[];
}

export interface TrainingConfig {
  trainingType: TrainingTestType;
  passingScore: number;
  maxAttempts: number;
  trainingPeriodDays: number;
  distributionList: string[];
  questions: Question[];
}

export interface TrainingFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: "uploading" | "success" | "error";
}

// ─── Core Entities ───────────────────────────────────────────────────────────
export interface Attendee extends Pick<User, 'id' | 'fullName' | 'department' | 'position'> {
  userId: string; // Foreign key to User.id
  status: AttendanceStatus;
  score?: number;
  completedAt?: string;
  certificateIssued?: boolean;
  isModified?: boolean;
  changeHistory?: {
    oldValue: string | number | null;
    newValue: string | number | null;
    reason: string;
    timestamp: string;
    updatedBy: string;
  }[];
}

export interface TrainingRecord {
  id: string;
  trainingId: string;
  title: string;
  description: string;
  type: TrainingType;
  trainingMethod: TrainingMethod;
  status: TrainingStatus;
  instructor: string;
  scheduledDate: string;
  duration: number;
  location: string;
  capacity: number;
  enrolled: number;
  department: string;
  mandatory: boolean;
  passScore: number;
  version: string;
  changeJustification?: string;
  retrainingRequired?: boolean;
  recurrence?: Recurrence;
  linkedDocumentId?: string;
  linkedDocumentTitle?: string;
  config?: TrainingConfig;
  attendees?: Attendee[];
  materials?: any[]; // Array of MaterialVersionEntry or similar
  trainingFiles?: TrainingFile[];
  reviewers?: CourseReviewer[];
  approvers?: CourseApprover[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  periodicReviewCycle?: number;
  periodicReviewNotification?: number;
  effectiveDate?: string;
  validUntil?: string;
  reviewDate?: string;
}

export interface CourseApproval {
  id: string;
  courseId: string;
  trainingId: string;
  courseName: string;
  relatedDocument: string;
  relatedDocumentId: string;
  trainingMethod: TrainingMethod;
  trainingType?: TrainingType;
  recurrence?: Recurrence;
  linkedDocumentId?: string;
  linkedDocumentTitle?: string;
  submittedBy: string;
  submittedAt: string;
  department: string;
  approvalStatus: CourseWorkflowStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  passScore: number;
  version: string;
  changeJustification?: string;
  retrainingRequired?: boolean;
  questions: Question[];
  trainingFiles?: TrainingFile[];
  materials?: any[];
  description?: string;
  instructor?: string;
  instructorType?: "internal" | "external";
  duration?: number;
  location?: string;
  scheduledDate?: string;
  capacity?: number;
  enrolled?: number;
  distributionList?: string[];
  instruction?: string;
  examTemplate?: string;
  answerKey?: string;
  passingGradeType?: "pass_fail" | "score_10" | "percentage";
  maxAttempts?: number;
  reviewers?: CourseReviewer[];
  approvers?: CourseApprover[];
  periodicReviewCycle?: number;
  periodicReviewNotification?: number;
  effectiveDate?: string;
  validUntil?: string;
  reviewDate?: string;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────
export interface TrainingFilters {
  searchQuery: string;
  typeFilter: TrainingType | "All";
  statusFilter: TrainingStatus | "All";
  dateFrom: string;
  dateTo: string;
}

// ─── Course Progress Types ────────────────────────────────────────────────────
export type EnrollmentStatus = "Completed" | "In-Progress" | "Not Started" | "Overdue" | "Exempt";
export type ResultStatus = "Pass" | "Fail" | "Pending" | "N/A" | "Obsolete - Pending Retraining";

export interface EmployeeProgress extends Pick<User, 'id' | 'fullName' | 'email' | 'department' | 'position'> {
  userId: string; // Foreign key
  businessUnit: string;
  enrollmentStatus: EnrollmentStatus;
  resultStatus: ResultStatus;
  score: number | null;
  completedAt: string | null;
  examDate: string | null;
  attempts: number;
}

export interface CourseProgressInfo {
  id: string;
  trainingId: string;
  title: string;
  totalEnrolled: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  passRate: number;
  averageScore: number | null;
  passingScore: number;
  passingGradeType: "pass_fail" | "score_10" | "percentage";
  dueDate: string;
}

// ─── Compliance Status Tracking Types ────────────────────────────────────────
/** Represents one row in the Course Status compliance tracking view */
export interface CourseComplianceRecord {
  id: string;
  courseId: string;
  courseName: string;
  description: string;
  courseType: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  averageScore: number;
  department: string;
}

export interface CourseStatusFilters {
  searchQuery: string;
  departmentFilter: string;
  typeFilter: string;
}
