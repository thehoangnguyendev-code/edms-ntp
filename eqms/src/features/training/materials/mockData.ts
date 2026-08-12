import { TrainingMaterial, TrainingMaterialWorkflow, MaterialVersionEntry } from "./types";

// ─── Version History Mock Data ───────────────────────────────────────────────
const V_HISTORY_TM001: MaterialVersionEntry[] = [
  {
    version: "1.0",
    status: "Obsoleted",
    uploadedBy: "Alice Carter",
    uploadedAt: "10/05/2024",
    reviewedBy: "Jane Smith",
    reviewedAt: "14/05/2024",
    reviewComment: "Content is accurate. Video quality is acceptable for initial rollout.",
    approvedBy: "Dr. A. Smith",
    approvedAt: "17/05/2024",
    approvalComment: "Approved for distribution across all QA departments.",
    revisionNotes: "Initial version. Covers GMP fundamentals for new hires.",
    fileSize: "98 MB",
    fileUrl: "https://example.com/materials/TM-VID-001-v1.0.mp4",
  },
  {
    version: "2.0",
    status: "Obsoleted",
    uploadedBy: "John Doe",
    uploadedAt: "03/09/2025",
    reviewedBy: "Jane Smith",
    reviewedAt: "08/09/2025",
    reviewComment: "Updated content references are correct. Approved for management review.",
    approvedBy: "Dr. A. Smith",
    approvedAt: "12/09/2025",
    approvalComment: "Reflects updated GMP guidelines from 2025 regulatory update.",
    revisionNotes: "Updated to align with 2025 WHO GMP guidelines. Added section on documentation best practices.",
    fileSize: "115 MB",
    fileUrl: "https://example.com/materials/TM-VID-001-v2.0.mp4",
  },
  {
    version: "3.0",
    status: "Effective",
    uploadedBy: "John Doe",
    uploadedAt: "15/02/2026",
    reviewedBy: "Jane Smith",
    reviewedAt: "18/02/2026",
    reviewComment: "Major revision reviewed. All chapters updated with 2026 regulatory requirements.",
    approvedBy: "Dr. A. Smith",
    approvedAt: "20/02/2026",
    approvalComment: "Major revision approved. Ready for deployment.",
    revisionNotes: "Full update aligned with 2026 GMP Annex 1 revision. Added interactive quiz segments and updated branding.",
    fileSize: "125 MB",
    fileUrl: "https://example.com/materials/TM-VID-001-v3.0.mp4",
  },
];

const V_HISTORY_TM002: MaterialVersionEntry[] = [
  {
    version: "1.0",
    status: "Obsoleted",
    uploadedBy: "Jane Smith",
    uploadedAt: "05/06/2024",
    reviewedBy: "Mike Johnson",
    reviewedAt: "09/06/2024",
    reviewComment: "Procedures match current cleanroom SOP. Approved for review.",
    approvedBy: "Dr. B. Lee",
    approvedAt: "13/06/2024",
    approvalComment: "Approved. Consistent with ISO 14644 requirements.",
    revisionNotes: "First release of the Cleanroom Operations Manual.",
    fileSize: "3.1 MB",
  },
  {
    version: "2.0",
    status: "Obsoleted",
    uploadedBy: "Jane Smith",
    uploadedAt: "20/11/2025",
    reviewedBy: "Mike Johnson",
    reviewedAt: "25/11/2025",
    reviewComment: "Added disinfectant rotation schedule. Content verified.",
    approvedBy: "Dr. B. Lee",
    approvedAt: "30/11/2025",
    approvalComment: "Approved. Incorporates post-audit corrective actions.",
    revisionNotes: "Added disinfectant rotation protocol. Revised gowning sequence per updated SOP-CR-005.",
    fileSize: "4.0 MB",
  },
  {
    version: "3.0",
    status: "Effective",
    uploadedBy: "Jane Smith",
    uploadedAt: "10/02/2026",
    reviewedBy: "Mike Johnson",
    reviewedAt: "14/02/2026",
    reviewComment: "Full revision reviewed and content confirmed accurate.",
    approvedBy: "Dr. B. Lee",
    approvedAt: "17/02/2026",
    approvalComment: "Major revision approved following facility expansion.",
    revisionNotes: "Full overhaul for new cleanroom zone B. Replaced all images with high-resolution diagrams. Added zone-specific entry/exit procedures.",
    fileSize: "4.5 MB",
  },
];

const V_HISTORY_TM004: MaterialVersionEntry[] = [
  {
    version: "1.0",
    status: "Effective",
    uploadedBy: "Sarah Williams",
    uploadedAt: "20/02/2026",
    reviewedBy: "David Miller",
    reviewedAt: "22/02/2026",
    reviewComment: "Infographic is clear and accurate. References latest HSE protocols.",
    approvedBy: "Dr. A. Smith",
    approvedAt: "24/02/2026",
    approvalComment: "Approved for company-wide display and training inclusion.",
    revisionNotes: "Initial release. Covers the 5 core safety protocols with visual icons.",
    fileSize: "2.1 MB",
    fileUrl: "https://example.com/materials/TM-IMG-004-v1.0.png",
  },
];

const V_HISTORY_COMPLEX: MaterialVersionEntry[] = [
  {
    version: "1.0",
    status: "Obsoleted",
    uploadedBy: "Admin One",
    uploadedAt: "01/01/2023",
    revisionNotes: "Initial setup of the historical data and base procedures.",
    fileSize: "1.2 MB",
  },
  {
    version: "2.0",
    status: "Obsoleted",
    uploadedBy: "John Doe",
    uploadedAt: "10/06/2024",
    reviewedBy: "Jane Smith",
    reviewedAt: "15/06/2024",
    reviewComment: "Major overhaul confirmed consistent with the latest SOP update.",
    approvedBy: "Dr. A. Smith",
    approvedAt: "20/06/2024",
    approvalComment: "Approved. Ready for the next audit cycle.",
    revisionNotes: "Major revision update for regulatory compliance adjustments. Added 3 new procedural steps.",
    fileSize: "2.5 MB",
    fileUrl: "https://example.com/materials/COMPLEX-v2.0.pdf",
  },
  {
    version: "3.0",
    status: "Effective",
    uploadedBy: "Michael Chen",
    uploadedAt: "12/02/2026",
    reviewedBy: "Jane Smith",
    reviewedAt: "18/02/2026",
    reviewComment: "Comprehensive review complete. All department feedback incorporated.",
    approvedBy: "Dr. A. Smith",
    approvedAt: "22/02/2026",
    approvalComment: "Major release approved. The notes section is much improved.",
    revisionNotes: "Complete redesign and content refresh. Added comprehensive troubleshooting guide and expanded maintenance section. This is the new gold standard for the facility.",
    fileSize: "5.0 MB",
    fileUrl: "https://example.com/materials/COMPLEX-v3.0.pdf",
  },
];

// ─── Linked Courses Metadata for Impact Assessment ───────────────────────────
export const MOCK_LINKED_COURSES: Record<string, { courseId: string; courseName: string; employeeCount: number }[]> = {
  "1": [
    { courseId: "TRN-2026-001", courseName: "GMP Fundamentals for New Employees", employeeCount: 18 },
    { courseId: "TRN-2026-004", courseName: "Annual GMP Refresher Training", employeeCount: 12 },
    { courseId: "TRN-2026-008", courseName: "Quality Culture & Continuous Improvement", employeeCount: 15 },
  ],
  "2": [
    { courseId: "TRN-2026-002", courseName: "Cleanroom Entry & Operations", employeeCount: 24 },
    { courseId: "TRN-2026-005", courseName: "Environmental Monitoring Procedures", employeeCount: 10 },
  ],
  "4": [
    { courseId: "TRN-2026-001", courseName: "GMP Fundamentals for New Employees", employeeCount: 18 },
    { courseId: "TRN-2026-005", courseName: "Environmental Monitoring Procedures", employeeCount: 10 },
    { courseId: "TRN-2026-007", courseName: "HSE Awareness & Emergency Response", employeeCount: 20 },
    { courseId: "TRN-2026-009", courseName: "Personal Protective Equipment Training", employeeCount: 14 },
    { courseId: "TRN-2026-012", courseName: "Chemical Safety & Hazard Communication", employeeCount: 9 },
  ],
  "6": [
    { courseId: "TRN-2026-010", courseName: "SOP Authoring & Document Control", employeeCount: 8 },
  ],
  "8": [
    { courseId: "TRN-2026-014", courseName: "HPLC Method Development & Operation", employeeCount: 6 },
  ],
  "9": [
    { courseId: "TRN-2026-002", courseName: "Cleanroom Entry & Operations", employeeCount: 24 },
    { courseId: "TRN-2026-006", courseName: "Deviation & CAPA Management", employeeCount: 11 },
  ],
  "10": [
    { courseId: "TRN-2026-001", courseName: "GMP Fundamentals for New Employees", employeeCount: 18 },
    { courseId: "TRN-2026-007", courseName: "HSE Awareness & Emergency Response", employeeCount: 20 },
    { courseId: "TRN-2026-009", courseName: "Personal Protective Equipment Training", employeeCount: 14 },
  ],
  "13": [
    { courseId: "TRN-2026-001", courseName: "GMP Fundamentals for New Employees", employeeCount: 18 },
    { courseId: "TRN-2026-008", courseName: "Quality Culture & Continuous Improvement", employeeCount: 15 },
    { courseId: "TRN-2026-020", courseName: "Internal Audit & Inspection Readiness", employeeCount: 12 },
  ],
  "14": [
    { courseId: "SOP-014", courseName: "Equipment Calibration Fundamentals", employeeCount: 12 },
  ],
};

// Mock Data — expanded for dashboard
export const MOCK_MATERIALS: TrainingMaterial[] = [
  {
    id: "1", materialNumber: "TM-VID-001", title: "GMP Introduction Video", description: "Comprehensive overview of Good Manufacturing Practices",
    type: "Video", version: "3.0", department: "Quality Assurance", status: "Effective", uploadedAt: "15/02/2026", uploadedBy: "John Doe",
    fileSize: "125 MB", fileSizeBytes: 131072000, usageCount: 15,
    linkedCourses: ["TRN-2026-001", "TRN-2026-004", "TRN-2026-008"],
    versionHistory: V_HISTORY_TM001,
  },
  {
    id: "2", materialNumber: "TM-PDF-002", title: "Cleanroom Operations Manual", description: "Step-by-step guide for cleanroom operations and procedures",
    type: "PDF", version: "3.0", department: "Production", status: "Effective", uploadedAt: "10/02/2026", uploadedBy: "Jane Smith",
    fileSize: "4.5 MB", fileSizeBytes: 4718592, usageCount: 22,
    linkedCourses: ["TRN-2026-002", "TRN-2026-005"],
    versionHistory: V_HISTORY_TM002,
  },
  {
    id: "3", materialNumber: "TM-PDF-003", title: "Equipment Handling Guide", description: "Visual guide for proper equipment handling and maintenance",
    type: "PDF", version: "1.0", department: "Engineering", status: "Pending Review", uploadedAt: "08/02/2026", uploadedBy: "Mike Johnson",
    fileSize: "8.2 MB", fileSizeBytes: 8597504, usageCount: 18,
    linkedCourses: ["TRN-2026-003"],
  },
  {
    id: "4", materialNumber: "TM-IMG-004", title: "Safety Protocol Infographic", description: "Key safety protocols illustrated for quick reference",
    type: "Image", version: "1.0", department: "HSE", status: "Effective", uploadedAt: "20/02/2026", uploadedBy: "Sarah Williams",
    fileSize: "2.1 MB", fileSizeBytes: 2202009, usageCount: 30,
    linkedCourses: ["TRN-2026-001", "TRN-2026-005", "TRN-2026-007", "TRN-2026-009", "TRN-2026-012"],
    versionHistory: V_HISTORY_TM004,
  },
  {
    id: "5", materialNumber: "TM-VID-005", title: "ISO 9001 Training Video", description: "Understanding ISO 9001:2015 requirements and implementation",
    type: "Video", version: "2.0", department: "Quality Assurance", status: "Draft", uploadedAt: "12/02/2026", uploadedBy: "Robert Brown",
    fileSize: "210 MB", fileSizeBytes: 220200960, usageCount: 12,
    linkedCourses: ["TRN-2026-006"],
  },
  {
    id: "6", materialNumber: "TM-DOC-006", title: "SOP Template Pack", description: "Standard Operating Procedure templates for documentation",
    type: "Document", version: "2.0", department: "Quality Control", status: "Effective", uploadedAt: "01/02/2026", uploadedBy: "Emily Davis",
    fileSize: "1.0 MB", fileSizeBytes: 1048576, usageCount: 8,
    linkedCourses: ["TRN-2026-010"],
  },
  {
    id: "7", materialNumber: "TM-PDF-007", title: "Chemical Handling Procedures", description: "Safe practices for chemical storage, handling, and disposal",
    type: "PDF", version: "2.0", department: "HSE", status: "Obsoleted", uploadedAt: "28/01/2026", uploadedBy: "David Miller",
    fileSize: "3.0 MB", fileSizeBytes: 3145728, usageCount: 25,
    linkedCourses: ["TRN-2026-005", "TRN-2026-011", "TRN-2026-013"],
  },
  {
    id: "8", materialNumber: "TM-DOC-008", title: "HPLC Training Slides", description: "HPLC instrumentation, calibration, and operational procedures",
    type: "Document", version: "3.0", department: "Quality Control", status: "Effective", uploadedAt: "28/01/2026", uploadedBy: "Lisa Anderson",
    fileSize: "15 MB", fileSizeBytes: 15728640, usageCount: 6,
    linkedCourses: ["TRN-2026-014"],
  },
  {
    id: "9", materialNumber: "TM-VID-009", title: "Deviation Investigation Training", description: "How to investigate and document process deviations",
    type: "Video", version: "1.0", department: "Quality Assurance", status: "Effective", uploadedAt: "10/02/2026", uploadedBy: "Michael Chen",
    fileSize: "180 MB", fileSizeBytes: 188743680, usageCount: 10,
    linkedCourses: ["TRN-2026-002", "TRN-2026-006"],
  },
  {
    id: "10", materialNumber: "TM-PDF-010", title: "Personal Protective Equipment Guide", description: "Selection, usage, and maintenance of PPE",
    type: "PDF", version: "2.0", department: "HSE", status: "Effective", uploadedAt: "15/02/2026", uploadedBy: "Patricia Wilson",
    fileSize: "5.8 MB", fileSizeBytes: 6082355, usageCount: 20,
    linkedCourses: ["TRN-2026-001", "TRN-2026-007", "TRN-2026-009"],
  },
  {
    id: "11", materialNumber: "TM-DOC-011", title: "Batch Record Review Checklist", description: "Comprehensive checklist for batch record review process",
    type: "Document", version: "1.0", department: "Quality Assurance", status: "Pending Approval", uploadedAt: "20/02/2026", uploadedBy: "James Taylor",
    fileSize: "0.8 MB", fileSizeBytes: 838860, usageCount: 14,
    linkedCourses: ["TRN-2026-004", "TRN-2026-008"],
  },
  {
    id: "12", materialNumber: "TM-PDF-012", title: "Water System Qualification", description: "Procedures for water system IQ, OQ, and PQ",
    type: "PDF", version: "1.0", department: "Engineering", status: "Draft", uploadedAt: "25/02/2026", uploadedBy: "Jennifer Lee",
    fileSize: "12 MB", fileSizeBytes: 12582912, usageCount: 4,
    linkedCourses: ["TRN-2026-015"],
  },
  {
    id: "13", materialNumber: "TM-PDF-013", title: "Comprehensive Quality Audit Framework", description: "Details on annual audit procedures and compliance metrics",
    type: "PDF", version: "3.0", department: "Quality Assurance", status: "Effective", uploadedAt: "22/02/2026", uploadedBy: "Michael Chen",
    fileSize: "5.0 MB", fileSizeBytes: 5242880, usageCount: 45,
    linkedCourses: ["TRN-2026-001", "TRN-2026-008", "TRN-2026-020"],
    versionHistory: V_HISTORY_COMPLEX,
  },
  {
    id: "14", materialNumber: "TM-DOC-014", title: "Equipment Calibration SOP", description: "Standard procedures for equipment calibration and verification",
    type: "Document", version: "3.0", department: "Technical", status: "Effective", uploadedAt: "01/07/2025", uploadedBy: "Lisa Anderson",
    fileSize: "2.5 MB", fileSizeBytes: 2621440, usageCount: 12,
    linkedCourses: ["SOP-014"],
  },
  {
    id: "15", materialNumber: "TM-PDF-015", title: "Batch Record Review Training", description: "Training module for batch record review and approval process",
    type: "PDF", version: "2.0", department: "Quality Assurance", status: "Effective", uploadedAt: "20/05/2025", uploadedBy: "James Taylor",
    fileSize: "3.2 MB", fileSizeBytes: 3355443, usageCount: 18,
    linkedCourses: ["SOP-015"],
  },
];

// ─── Workflow View Mock Data ──────────────────────────────────────────────────
// Used by MaterialReviewView, MaterialDetailView, MaterialApprovalView
// TODO: Replace with API calls: GET /api/training/materials/:id

export const MOCK_MATERIAL_REVIEW: TrainingMaterialWorkflow = {
  id: "3",
  materialNumber: "TM-PDF-003",
  title: "Equipment Handling Guide",
  description:
    "Visual guide for proper equipment handling and maintenance procedures. This document covers safety protocols, step-by-step handling instructions, common troubleshooting procedures, and emergency response guidelines for all major equipment in the production facility.",
  type: "PDF",
  version: "1.0",
  department: "Engineering",
  businessUnit: "BU-Technical",
  status: "Pending Review",
  uploadedAt: "2026-02-08",
  uploadedBy: "Mike Johnson",
  fileSize: "8.2 MB",
  reviewer: "Jane Smith",
  approver: "Dr. A. Smith",
};


export const MOCK_MATERIAL_APPROVAL: TrainingMaterialWorkflow = {
  id: "11",
  materialNumber: "TM-DOC-011",
  title: "Batch Record Review Checklist",
  description:
    "Comprehensive checklist for batch record review process. This document outlines the required steps and checkpoints for reviewing batch records to ensure compliance with GMP requirements and regulatory standards.",
  type: "Document",
  version: "1.0",
  department: "Quality Assurance",
  businessUnit: "BU-Compliance",
  status: "Pending Approval",
  uploadedAt: "2026-02-20",
  uploadedBy: "James Taylor",
  fileSize: "0.8 MB",
  reviewer: "Jane Smith",
  approver: "Dr. A. Smith",
  reviewedAt: "2026-02-22",
  reviewComment:
    "Material reviewed. Content is accurate and complete. Passed for final approval step.",
};

// ─── Version History Drawer Mock Material ────────────────────────────────────
export const MOCK_DRAWER_MATERIAL: TrainingMaterial = {
  id: "mock-1",
  materialNumber: "TM-VID-001",
  title: "GMP Introduction Video",
  description: "Comprehensive overview of Good Manufacturing Practices",
  type: "Video",
  version: "3.0",
  department: "Quality Assurance",
  status: "Effective",
  uploadedAt: "15/02/2026",
  uploadedBy: "John Doe",
  fileSize: "125 MB",
  fileSizeBytes: 131072000,
  usageCount: 15,
  linkedCourses: ["TRN-2026-001", "TRN-2026-004", "TRN-2026-008"],
  versionHistory: V_HISTORY_TM001,
};
