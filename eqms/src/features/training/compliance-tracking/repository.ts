import {
  MOCK_AUTO_RULES,
  MOCK_CELLS,
  MOCK_COURSE_STATUS,
  MOCK_EMPLOYEES,
  MOCK_EMPLOYEE_PROGRESS,
  MOCK_PROGRESS_INFO,
  MOCK_SOPS,
  getCell,
} from "./mockData";

// Repository layer currently backed by mock data.
// This preserves existing test behavior while isolating views from data source details.
export const complianceTrackingRepository = {
  getCourseStatusData: () => MOCK_COURSE_STATUS,
  getCourseProgressInfo: () => MOCK_PROGRESS_INFO,
  getEmployeeProgressData: () => MOCK_EMPLOYEE_PROGRESS,
  getMatrixEmployees: () => MOCK_EMPLOYEES,
  getSops: () => MOCK_SOPS,
  getCells: () => MOCK_CELLS,
  getCell,
  getAutoAssignmentRules: () => MOCK_AUTO_RULES,
};
