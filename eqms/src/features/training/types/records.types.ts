/**
 * Records & Archive Types
 *
 * Types for the Records Archive feature (Employee Training Files, Export Records).
 * Import from here instead of re-declaring in each view file.
 */

export interface OJTRecord {
  id: string;
  taskName: string;
  trainerName: string;
  dateCompleted: string;
  status: 'Completed' | 'Pending' | 'In-Progress';
  assessmentScore?: number;
  comments?: string;
  esignReason?: string;
}

// ─── Employee Training File ───────────────────────────────────────────────────
export interface EmployeeTrainingFile {
  id: string;
  employeeId: string;
  employeeName: string;
  jobPosition: string;
  department: string;
  businessUnit: string; // Added
  email: string; // Added
  totalCoursesRequired: number;
  coursesCompleted: number;
  coursesInProgress: number;
  coursesOverdue: number;
  coursesObsolete: number; // Added for versioning support
  lastTrainingDate: string;
  nextDeadline?: string; // Added to prioritise overdue/obsolete
  averageScore: number;
  ojtRecords?: OJTRecord[];
  isNewHire?: boolean; // For hero banner logic
  employeeType: 'Internal' | 'Contractor'; // Added for EU-GMP
  qualificationStatus?: 'Qualified' | 'In Training' | 'At Risk'; // Added for EU-GMP
  completedCourses?: CompletedCourseRecord[]; // Added for Certification logic
}

// ─── Pending Signature Record ─────────────────────────────────────────────────
export interface PendingSignatureRecord {
  id: string;
  courseCode: string;
  courseName: string;
  version: string;
  missingRoles: ('Trainee' | 'Trainer')[];
  completionDate: string;
  daysPending: number;
  /** ID of the trainer assigned to this course */
  trainerId?: string;
  /** Name of the trainer for tooltips */
  trainerName?: string;
  /** Whether the course version is now obsolete */
  isObsolete?: boolean;
}

// ─── Completed Course Record (for Certification) ─────────────────────────────
export interface CompletedCourseRecord {
  id: string;
  courseCode: string;
  courseName: string;
  version: string;
  completionDate: string;
  expiryDate?: string;
  score: number;
  passingScore: number;
  traineeName: string;
  traineeId: string;
  traineeEsignDate: string;
  trainerName: string;
  trainerId: string;
  trainerEsignDate: string;
  status: "Pass" | "Fail";
  pendingSignaturesCount: number;
}

// ─── Filter State ─────────────────────────────────────────────────────────────
export interface EmployeeFilters {
  searchQuery: string;
  departmentFilter: string;
  businessUnitFilter: string;
  positionFilter: string;
  employeeTypeFilter: string;
  complianceStatus: 'All' | 'Fully Compliant' | 'Has Gaps' | 'Has Obsolete Records';
}
