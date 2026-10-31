import apiClient from "./client";
import type { TrainingTask, TrainingMyApproval, TrainingMyParticipation, TrainingPage, TrainingRecord } from "./trainingActivities";
import type { ServerQuery } from "@/features/settings/shared/hooks/useServerTable";

export const myTrainingApi = {
  /** What waits for the person (for the badge of the menu): trainings to do and signatures asked. */
  counts: async () => (await apiClient.get<{ tasks: number; signatures: number; total: number }>("/training/me/counts")).data,
  participation: async (participantId: string) => (await apiClient.get<TrainingMyParticipation>(`/training/me/participations/${participantId}`)).data,
  tasks: async (params: ServerQuery, signal?: AbortSignal) => (await apiClient.get<TrainingPage<TrainingTask>>("/training/me/tasks/table", { params, signal })).data,
  approvals: async (params: ServerQuery, signal?: AbortSignal) => (await apiClient.get<TrainingPage<TrainingMyApproval>>("/training/me/approvals/table", { params, signal })).data,
  records: async (params: ServerQuery) => (await apiClient.get<TrainingPage<TrainingRecord>>("/training/me/records/table", { params })).data,
};
