/**
 * Mock data for Usage Report (aligned with MOCK_MATERIALS ids in ../../mockData.ts).
 * Use URL: /training-management/materials/usage-report/:id  e.g. usage-report/1
 */

export type UsageReportCourseStatus = "Active" | "Completed" | "In Progress" | "Cancelled";
export type UsageReportMaterialType = "Video" | "PDF" | "Image" | "Document";

export interface UsageCourseRecord {
  courseId: string;
  courseName: string;
  department: string;
  materialVersion: string;
  startDate: string;
  endDate?: string;
  learnersEnrolled: number;
  learnersCompleted: number;
  courseStatus: UsageReportCourseStatus;
  isCurrentVersion: boolean;
  instructor: string;
}

export interface UsageReportMaterialInfo {
  id: string;
  materialNumber: string;
  title: string;
  type: UsageReportMaterialType;
  currentVersion: string;
  department: string;
  uploadedBy: string;
  uploadedAt: string;
  allVersions: string[];
}

export const MOCK_USAGE_REPORT_MATERIAL_INFO: Record<string, UsageReportMaterialInfo> = {
  "1": {
    id: "1",
    materialNumber: "TM-VID-001",
    title: "GMP Introduction Video",
    type: "Video",
    currentVersion: "2.1",
    department: "Quality Assurance",
    uploadedBy: "John Doe",
    uploadedAt: "2026-02-15",
    allVersions: ["1.0", "1.1", "2.0", "2.1"],
  },
  "2": {
    id: "2",
    materialNumber: "TM-PDF-002",
    title: "Cleanroom Operations Manual",
    type: "PDF",
    currentVersion: "3.0",
    department: "Production",
    uploadedBy: "Jane Smith",
    uploadedAt: "2026-02-10",
    allVersions: ["1.0", "1.1", "2.0", "2.1", "3.0"],
  },
  "3": {
    id: "3",
    materialNumber: "TM-PDF-003",
    title: "Equipment Handling Guide",
    type: "PDF",
    currentVersion: "1.5",
    department: "Engineering",
    uploadedBy: "Mike Johnson",
    uploadedAt: "2026-02-08",
    allVersions: ["1.0", "1.1", "1.2", "1.5"],
  },
  "4": {
    id: "4",
    materialNumber: "TM-IMG-004",
    title: "Safety Protocol Infographic",
    type: "Image",
    currentVersion: "1.0",
    department: "HSE",
    uploadedBy: "Sarah Williams",
    uploadedAt: "2026-02-20",
    allVersions: ["1.0"],
  },
  "5": {
    id: "5",
    materialNumber: "TM-VID-005",
    title: "ISO 9001 Training Video",
    type: "Video",
    currentVersion: "4.2",
    department: "Quality Assurance",
    uploadedBy: "Robert Brown",
    uploadedAt: "2026-02-12",
    allVersions: ["1.0", "2.0", "3.0", "4.0", "4.1", "4.2"],
  },
  "6": {
    id: "6",
    materialNumber: "TM-DOC-006",
    title: "SOP Template Pack",
    type: "Document",
    currentVersion: "2.0",
    department: "Quality Control",
    uploadedBy: "Emily Davis",
    uploadedAt: "2026-02-01",
    allVersions: ["1.0", "1.5", "2.0"],
  },
  "7": {
    id: "7",
    materialNumber: "TM-PDF-007",
    title: "Chemical Handling Procedures",
    type: "PDF",
    currentVersion: "1.2",
    department: "HSE",
    uploadedBy: "David Miller",
    uploadedAt: "2026-01-28",
    allVersions: ["1.0", "1.1", "1.2"],
  },
  "8": {
    id: "8",
    materialNumber: "TM-DOC-008",
    title: "HPLC Training Slides",
    type: "Document",
    currentVersion: "2.3",
    department: "Quality Control",
    uploadedBy: "Lisa Anderson",
    uploadedAt: "2026-01-28",
    allVersions: ["1.0", "2.0", "2.1", "2.2", "2.3"],
  },
  "9": {
    id: "9",
    materialNumber: "TM-VID-009",
    title: "Deviation Investigation Training",
    type: "Video",
    currentVersion: "1.0",
    department: "Quality Assurance",
    uploadedBy: "Michael Chen",
    uploadedAt: "2026-02-10",
    allVersions: ["1.0"],
  },
  "10": {
    id: "10",
    materialNumber: "TM-PDF-010",
    title: "Personal Protective Equipment Guide",
    type: "PDF",
    currentVersion: "3.1",
    department: "HSE",
    uploadedBy: "Patricia Wilson",
    uploadedAt: "2026-02-15",
    allVersions: ["1.0", "2.0", "3.0", "3.1"],
  },
  "11": {
    id: "11",
    materialNumber: "TM-DOC-011",
    title: "Batch Record Review Checklist",
    type: "Document",
    currentVersion: "1.8",
    department: "Quality Assurance",
    uploadedBy: "James Taylor",
    uploadedAt: "2026-02-20",
    allVersions: ["1.0", "1.2", "1.5", "1.8"],
  },
  "12": {
    id: "12",
    materialNumber: "TM-PDF-012",
    title: "Water System Qualification",
    type: "PDF",
    currentVersion: "2.0",
    department: "Engineering",
    uploadedBy: "Jennifer Lee",
    uploadedAt: "2026-02-25",
    allVersions: ["1.0", "1.5", "2.0"],
  },
};

export const MOCK_USAGE_REPORT_COURSES: Record<string, UsageCourseRecord[]> = {
  "1": [
    { courseId: "TRN-2026-001", courseName: "New Employee GMP Onboarding", department: "Quality Assurance", materialVersion: "2.1", startDate: "2026-01-10", learnersEnrolled: 24, learnersCompleted: 22, courseStatus: "Completed", isCurrentVersion: true, instructor: "Jane Smith" },
    { courseId: "TRN-2026-004", courseName: "Annual GMP Refresher Q1", department: "Production", materialVersion: "2.1", startDate: "2026-02-01", learnersEnrolled: 38, learnersCompleted: 30, courseStatus: "In Progress", isCurrentVersion: true, instructor: "Robert Brown" },
    { courseId: "TRN-2026-008", courseName: "QA Team Competency Training", department: "Quality Assurance", materialVersion: "2.0", startDate: "2025-11-15", endDate: "2025-12-05", learnersEnrolled: 12, learnersCompleted: 12, courseStatus: "Completed", isCurrentVersion: false, instructor: "Emily Davis" },
    { courseId: "TRN-2025-019", courseName: "GMP Fundamentals - Batch 4", department: "Production", materialVersion: "1.1", startDate: "2025-07-20", endDate: "2025-08-10", learnersEnrolled: 20, learnersCompleted: 19, courseStatus: "Completed", isCurrentVersion: false, instructor: "Jane Smith" },
    { courseId: "TRN-2025-010", courseName: "GMP Fundamentals - Batch 3", department: "Engineering", materialVersion: "1.0", startDate: "2025-04-01", endDate: "2025-04-30", learnersEnrolled: 15, learnersCompleted: 14, courseStatus: "Completed", isCurrentVersion: false, instructor: "Mike Johnson" },
  ],
  "2": [
    { courseId: "TRN-2026-002", courseName: "Cleanroom Certification - Level 1", department: "Production", materialVersion: "3.0", startDate: "2026-01-15", learnersEnrolled: 18, learnersCompleted: 12, courseStatus: "In Progress", isCurrentVersion: true, instructor: "Mike Johnson" },
    { courseId: "TRN-2026-005", courseName: "Sterile Manufacturing Basics", department: "Production", materialVersion: "3.0", startDate: "2026-02-05", learnersEnrolled: 25, learnersCompleted: 0, courseStatus: "Active", isCurrentVersion: true, instructor: "Sarah Williams" },
    { courseId: "TRN-2025-022", courseName: "Cleanroom Ops - Annual Refresh", department: "Production", materialVersion: "2.1", startDate: "2025-09-10", endDate: "2025-10-01", learnersEnrolled: 32, learnersCompleted: 31, courseStatus: "Completed", isCurrentVersion: false, instructor: "Jane Smith" },
    { courseId: "TRN-2025-011", courseName: "Production Floor Induction", department: "Production", materialVersion: "2.0", startDate: "2025-05-01", endDate: "2025-05-25", learnersEnrolled: 10, learnersCompleted: 10, courseStatus: "Completed", isCurrentVersion: false, instructor: "Robert Brown" },
  ],
  "3": [
    { courseId: "TRN-2026-003", courseName: "Engineering Equipment Safety", department: "Engineering", materialVersion: "1.5", startDate: "2026-01-20", learnersEnrolled: 22, learnersCompleted: 18, courseStatus: "In Progress", isCurrentVersion: true, instructor: "David Miller" },
    { courseId: "TRN-2025-030", courseName: "Equipment Handling Basics", department: "Engineering", materialVersion: "1.2", startDate: "2025-10-05", endDate: "2025-10-28", learnersEnrolled: 14, learnersCompleted: 14, courseStatus: "Completed", isCurrentVersion: false, instructor: "Mike Johnson" },
    { courseId: "TRN-2025-015", courseName: "Maintenance Team Induction", department: "Engineering", materialVersion: "1.1", startDate: "2025-06-12", endDate: "2025-07-03", learnersEnrolled: 8, learnersCompleted: 7, courseStatus: "Completed", isCurrentVersion: false, instructor: "David Miller" },
  ],
  "4": [
    { courseId: "TRN-2026-001", courseName: "New Employee GMP Onboarding", department: "HSE", materialVersion: "1.0", startDate: "2026-01-10", learnersEnrolled: 24, learnersCompleted: 22, courseStatus: "Completed", isCurrentVersion: true, instructor: "Jane Smith" },
    { courseId: "TRN-2026-005", courseName: "Sterile Manufacturing Basics", department: "HSE", materialVersion: "1.0", startDate: "2026-02-05", learnersEnrolled: 25, learnersCompleted: 0, courseStatus: "Active", isCurrentVersion: true, instructor: "Sarah Williams" },
    { courseId: "TRN-2026-007", courseName: "Site-wide Safety Awareness 2026", department: "HSE", materialVersion: "1.0", startDate: "2026-01-05", endDate: "2026-01-31", learnersEnrolled: 120, learnersCompleted: 118, courseStatus: "Completed", isCurrentVersion: true, instructor: "Patricia Wilson" },
    { courseId: "TRN-2026-009", courseName: "Emergency Response Procedures", department: "HSE", materialVersion: "1.0", startDate: "2026-02-10", learnersEnrolled: 45, learnersCompleted: 40, courseStatus: "In Progress", isCurrentVersion: true, instructor: "David Miller" },
    { courseId: "TRN-2026-012", courseName: "Chemical Safety Training 2026", department: "HSE", materialVersion: "1.0", startDate: "2026-02-18", learnersEnrolled: 30, learnersCompleted: 0, courseStatus: "Active", isCurrentVersion: true, instructor: "Sarah Williams" },
  ],
  "5": [
    { courseId: "TRN-2026-006", courseName: "ISO 9001 Internal Auditor Training", department: "Quality Assurance", materialVersion: "4.2", startDate: "2026-02-12", learnersEnrolled: 16, learnersCompleted: 0, courseStatus: "Active", isCurrentVersion: true, instructor: "Emily Davis" },
    { courseId: "TRN-2025-041", courseName: "ISO 9001 Awareness Session", department: "Quality Assurance", materialVersion: "4.1", startDate: "2025-11-03", endDate: "2025-11-24", learnersEnrolled: 28, learnersCompleted: 27, courseStatus: "Completed", isCurrentVersion: false, instructor: "Robert Brown" },
    { courseId: "TRN-2025-028", courseName: "QA Certification Prep 2025", department: "Quality Assurance", materialVersion: "4.0", startDate: "2025-08-15", endDate: "2025-09-10", learnersEnrolled: 12, learnersCompleted: 11, courseStatus: "Completed", isCurrentVersion: false, instructor: "Emily Davis" },
  ],
  "6": [
    { courseId: "TRN-2026-014", courseName: "QC SOP Authoring Workshop", department: "Quality Control", materialVersion: "2.0", startDate: "2026-02-01", learnersEnrolled: 14, learnersCompleted: 10, courseStatus: "In Progress", isCurrentVersion: true, instructor: "Emily Davis" },
    { courseId: "TRN-2025-033", courseName: "Template Standards Refresher", department: "Quality Control", materialVersion: "1.5", startDate: "2025-09-01", endDate: "2025-09-20", learnersEnrolled: 20, learnersCompleted: 20, courseStatus: "Completed", isCurrentVersion: false, instructor: "John Doe" },
  ],
  "7": [
    { courseId: "TRN-2026-005", courseName: "Sterile Manufacturing Basics", department: "HSE", materialVersion: "1.2", startDate: "2026-02-05", learnersEnrolled: 25, learnersCompleted: 0, courseStatus: "Active", isCurrentVersion: true, instructor: "Sarah Williams" },
    { courseId: "TRN-2026-011", courseName: "Chemical Safety for Lab Teams", department: "HSE", materialVersion: "1.2", startDate: "2026-02-14", learnersEnrolled: 18, learnersCompleted: 5, courseStatus: "In Progress", isCurrentVersion: true, instructor: "David Miller" },
    { courseId: "TRN-2026-013", courseName: "Hazardous Materials Handling", department: "HSE", materialVersion: "1.1", startDate: "2025-12-01", endDate: "2025-12-22", learnersEnrolled: 20, learnersCompleted: 20, courseStatus: "Completed", isCurrentVersion: false, instructor: "Patricia Wilson" },
  ],
  "8": [
    { courseId: "TRN-2026-015", courseName: "Analytical Lab Induction", department: "Quality Control", materialVersion: "2.3", startDate: "2026-01-20", learnersEnrolled: 22, learnersCompleted: 18, courseStatus: "In Progress", isCurrentVersion: true, instructor: "Lisa Anderson" },
    { courseId: "TRN-2025-040", courseName: "HPLC Basics for Analysts", department: "Quality Control", materialVersion: "2.0", startDate: "2025-10-10", endDate: "2025-11-02", learnersEnrolled: 16, learnersCompleted: 16, courseStatus: "Completed", isCurrentVersion: false, instructor: "Lisa Anderson" },
  ],
  "9": [
    { courseId: "TRN-2026-002", courseName: "Cleanroom Certification - Level 1", department: "Quality Assurance", materialVersion: "1.0", startDate: "2026-01-15", learnersEnrolled: 18, learnersCompleted: 12, courseStatus: "In Progress", isCurrentVersion: true, instructor: "Mike Johnson" },
    { courseId: "TRN-2026-006", courseName: "ISO 9001 Internal Auditor Training", department: "Quality Assurance", materialVersion: "1.0", startDate: "2026-02-12", learnersEnrolled: 16, learnersCompleted: 0, courseStatus: "Active", isCurrentVersion: true, instructor: "Emily Davis" },
  ],
  "10": [
    { courseId: "TRN-2026-001", courseName: "New Employee GMP Onboarding", department: "HSE", materialVersion: "3.1", startDate: "2026-01-10", learnersEnrolled: 24, learnersCompleted: 22, courseStatus: "Completed", isCurrentVersion: true, instructor: "Jane Smith" },
    { courseId: "TRN-2026-007", courseName: "Site-wide Safety Awareness 2026", department: "HSE", materialVersion: "3.1", startDate: "2026-01-05", endDate: "2026-01-31", learnersEnrolled: 120, learnersCompleted: 118, courseStatus: "Completed", isCurrentVersion: true, instructor: "Patricia Wilson" },
    { courseId: "TRN-2026-009", courseName: "Emergency Response Procedures", department: "HSE", materialVersion: "3.0", startDate: "2026-02-10", learnersEnrolled: 45, learnersCompleted: 40, courseStatus: "In Progress", isCurrentVersion: false, instructor: "David Miller" },
  ],
  "11": [
    { courseId: "TRN-2026-016", courseName: "Batch Release Review Training", department: "Quality Assurance", materialVersion: "1.8", startDate: "2026-02-05", learnersEnrolled: 30, learnersCompleted: 12, courseStatus: "In Progress", isCurrentVersion: true, instructor: "James Taylor" },
  ],
  "12": [
    { courseId: "TRN-2026-017", courseName: "Purified Water System Overview", department: "Engineering", materialVersion: "2.0", startDate: "2026-01-25", learnersEnrolled: 12, learnersCompleted: 8, courseStatus: "In Progress", isCurrentVersion: true, instructor: "Jennifer Lee" },
  ],
};

export function getFallbackUsageReportCourses(id: string): UsageCourseRecord[] {
  return [
    {
      courseId: `TRN-2026-00${id}`,
      courseName: "General Training Course",
      department: "Quality Assurance",
      materialVersion: "1.0",
      startDate: "2026-01-01",
      learnersEnrolled: 10,
      learnersCompleted: 8,
      courseStatus: "Completed",
      isCurrentVersion: true,
      instructor: "John Doe",
    },
  ];
}
