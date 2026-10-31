import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../client", () => ({ api: mocks, default: mocks }));
import { dictionaryApi } from "../dictionary";
import { documentNameFormatApi } from "../documentNameFormats";
import { educationApi } from "../education";
import { myTrainingApi } from "../myTraining";

beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue({ data: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } } }); });
it.each([
  dictionaryApi.getBusinessUnitsPage, dictionaryApi.getDepartmentsPage, dictionaryApi.getPositionsPage,
  dictionaryApi.getSubTypesPage, dictionaryApi.getDocumentTypesPage, dictionaryApi.getStorageLocationsPage,
  dictionaryApi.getRetentionPoliciesPage, documentNameFormatApi.getFormatsPage, documentNameFormatApi.getComponentsPage,
  educationApi.schools.page, educationApi.degreeLevels.page, myTrainingApi.tasks, myTrainingApi.approvals,
])("forwards cancellation separately from server query parameters", async (fetcher) => {
  const controller = new AbortController(); const params = { search: "GMP", page: 1, limit: 10 };
  await fetcher(params, controller.signal);
  expect(mocks.get).toHaveBeenCalledWith(expect.any(String), { params, signal: controller.signal });
  expect(params).toEqual({ search: "GMP", page: 1, limit: 10 });
});
