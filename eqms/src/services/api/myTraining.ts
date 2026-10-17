import apiClient from "./client";
import type { TrainingTask, TrainingMyApproval, TrainingPage, TrainingRecord } from "./trainingActivities";
import type { ServerQuery } from "@/features/settings/shared/hooks/useServerTable";

export const myTrainingApi = {
  tasks: async (params: ServerQuery) => (await apiClient.get<TrainingPage<TrainingTask>>("/training/me/tasks/table", { params })).data,
  approvals: async (params: ServerQuery) => (await apiClient.get<TrainingPage<TrainingMyApproval>>("/training/me/approvals/table", { params })).data,
  records: async (params: ServerQuery) => (await apiClient.get<TrainingPage<TrainingRecord>>("/training/me/records/table", { params })).data,
};
