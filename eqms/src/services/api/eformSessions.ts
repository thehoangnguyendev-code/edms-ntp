import { api } from './client';

export type EformSessionKind = 'DESIGN' | 'FILL';
export type EformSessionStatus = 'ACTIVE' | 'SAVED' | 'SUBMITTED' | 'ABANDONED';

export interface EformEditSession {
  id: string;
  kind: EformSessionKind;
  status: EformSessionStatus;
}

export interface EformSignerAssignment {
  roleName: string;
  assignedUserId: string;
  assignedUserName: string;
  sequence: number;
}

/** Matches EformEditSessionService.STALE_TEMPLATE_PREFIX -- the backend prefixes its error message
 *  with this when a Design session would silently resume a field layout that predates a later
 *  content edit, so the UI can show a confirm-to-overwrite dialog instead of a plain error toast. */
export const CONTENT_CHANGED_SINCE_DESIGN_PREFIX = 'CONTENT_CHANGED_SINCE_DESIGN:';

export interface FillStepResult {
  /** false = this was one step of a multi-role signing chain; the next role must now fill theirs.
   *  true = this was the last (or only) step -- executedRecord holds the resulting submission. */
  completed: boolean;
  executedRecord: Record<string, unknown> | null;
}

export const eformSessionApi = {
  /** POST /forms/:formDocumentId/eform-sessions -- DESIGN only, independent of any one
   *  distribution. acknowledgeStaleContent confirms overwriting a field layout that predates a
   *  later content edit -- see CONTENT_CHANGED_SINCE_DESIGN_PREFIX. */
  startDesignSession: async (formDocumentId: string, acknowledgeStaleContent = false): Promise<EformEditSession> => {
    const response = await api.post<EformEditSession>(`/forms/${formDocumentId}/eform-sessions`, { kind: 'DESIGN', acknowledgeStaleContent });
    return response.data;
  },

  /** POST /controlled-copies/:controlledCopyId/eform-sessions -- FILL/sign, scoped to one
   *  electronic Controlled Copy distribution. roleName blank starts the initial data-entry phase
   *  (gated to the copy's own recipient); a role starts that signer's step. */
  startFillSession: async (controlledCopyId: string, roleName?: string): Promise<EformEditSession> => {
    const response = await api.post<EformEditSession>(`/controlled-copies/${controlledCopyId}/eform-sessions`, { kind: 'FILL', roleName });
    return response.data;
  },

  /** GET /controlled-copies/:controlledCopyId/eform-signer-roles/scan -- OnlyOffice Role names
   *  found on the Form's committed fillable template. */
  scanSignerRoles: async (controlledCopyId: string): Promise<string[]> => {
    const response = await api.get<string[]>(`/controlled-copies/${controlledCopyId}/eform-signer-roles/scan`);
    return response.data;
  },

  /** GET /controlled-copies/:controlledCopyId/eform-signer-assignments */
  listSignerAssignments: async (controlledCopyId: string): Promise<EformSignerAssignment[]> => {
    const response = await api.get<EformSignerAssignment[]>(`/controlled-copies/${controlledCopyId}/eform-signer-assignments`);
    return response.data;
  },

  /** PUT /controlled-copies/:controlledCopyId/eform-signer-assignments -- replaces this one
   *  copy's entire signer-assignment set (no e-signature; the Distribute action itself is still
   *  signed as before). */
  updateSignerAssignments: async (
    controlledCopyId: string,
    assignments: { roleName: string; assignedUserId: string; sequence: number }[]
  ): Promise<EformSignerAssignment[]> => {
    const response = await api.put<EformSignerAssignment[]>(`/controlled-copies/${controlledCopyId}/eform-signer-assignments`, {
      assignments,
    });
    return response.data;
  },

  /** GET /eform-sessions/:id/edit-config -- the signed OnlyOffice DocsAPI config, as-is. */
  getEditConfig: async (sessionId: string): Promise<Record<string, unknown>> => {
    const response = await api.get<Record<string, unknown>>(`/eform-sessions/${sessionId}/edit-config`);
    return response.data;
  },

  /** POST /eform-sessions/:id/commit-design (e-signature required) */
  commitDesign: async (sessionId: string, reason: string, signatureToken: string) => {
    const response = await api.post(`/eform-sessions/${sessionId}/commit-design`, { reason, signatureToken });
    return response.data;
  },

  /** POST /eform-sessions/:id/force-save -- asks the Document Server to flush unsaved edits now. */
  forceSave: async (sessionId: string): Promise<void> => {
    await api.post(`/eform-sessions/${sessionId}/force-save`);
  },

  /** POST /eform-sessions/:id/abandon -- best-effort, e.g. when the user closes the frame without saving. */
  abandonSession: async (sessionId: string): Promise<void> => {
    await api.post(`/eform-sessions/${sessionId}/abandon`);
  },

  /** POST /eform-sessions/:id/complete-fill-step (e-signature required) -- signs off the current
   *  user's Fill step. For a Form with no roles configured this submits immediately; for a
   *  sequential multi-role Form it either advances to the next role or, if this was the last one,
   *  submits the Executed Record. See FillStepResult. */
  completeFillStep: async (sessionId: string, reason: string, signatureToken: string): Promise<FillStepResult> => {
    const response = await api.post<FillStepResult>(`/eform-sessions/${sessionId}/complete-fill-step`, { reason, signatureToken });
    return response.data;
  },
};
