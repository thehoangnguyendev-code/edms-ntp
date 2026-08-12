import { ROUTES } from "@/app/routes.constants";
import { buildRevisionDetailSnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";

export type WorkspaceNavigationMode = "detail" | "create" | "edit";

export interface RevisionWorkspaceState {
  from?: string;
  returnTo?: string;
  workspaceReturnPath?: string;
  fromRevisionWorkspace?: boolean;
  revisionWorkspaceMode?: Exclude<WorkspaceNavigationMode, "detail">;
  parentDocumentId?: string | null;
  sourceRevisionId?: string | null;
  revisionId?: string | null;
  documentId?: string | null;
  revisionNumber?: string;
  revisionCreated?: string;
  revisionOpenedBy?: string;
  documentNumber?: string;
  documentName?: string;
  documentAuthor?: string;
  documentStatus?: string;
  documentCreated?: string;
  [key: string]: unknown;
}

export interface RevisionNavigationState {
  from?: string;
  returnTo?: string;
  workspaceReturnPath?: string;
  workspaceState?: RevisionWorkspaceState | null;
  documentId?: string;
  parentDocumentId?: string;
  revisionId?: string;
  sourceRevisionId?: string;
  revisionNumber?: string;
  revisionCreated?: string;
  revisionOpenedBy?: string;
  documentNumber?: string;
  documentName?: string;
  documentAuthor?: string;
  documentStatus?: string;
  documentCreated?: string;
}

export interface RevisionWorkspaceSourceDocument {
  id?: string | number | null;
  documentNumber?: string | null;
  documentName?: string | null;
  revisionNumber?: string | null;
  created?: string | null;
  openedBy?: string | null;
  author?: string | null;
  businessUnit?: string | null;
  department?: string | null;
  coAuthors?: unknown[];
  knowledgeBase?: string | null;
  subType?: string | null;
  periodicReviewCycle?: number | null;
  periodicReviewNotification?: number | null;
  language?: string | null;
  reviewDate?: string | null;
  description?: string | null;
  isTemplate?: boolean | null;
  titleLocalLanguage?: string | null;
  type?: string | null;
  status?: string | null;
}

export interface RevisionDetailNavigationState extends Partial<RevisionNavigationState> {
  detail?: { id?: string | null } | null;
}

export const buildRevisionWorkspaceSourceState = (
  source: RevisionWorkspaceSourceDocument,
  extras: Partial<RevisionWorkspaceState> = {},
): RevisionWorkspaceState => ({
  ...extras,
  sourceDocument: {
    id: source.id ?? null,
    documentNumber: source.documentNumber ?? null,
    documentName: source.documentName ?? null,
    revisionNumber: source.revisionNumber ?? null,
    created: source.created ?? null,
    openedBy: source.openedBy ?? null,
    author: source.author ?? null,
    businessUnit: source.businessUnit ?? null,
    department: source.department ?? null,
    coAuthors: source.coAuthors ?? [],
    knowledgeBase: source.knowledgeBase ?? null,
    subType: source.subType ?? null,
    periodicReviewCycle: source.periodicReviewCycle ?? null,
    periodicReviewNotification: source.periodicReviewNotification ?? null,
    language: source.language ?? null,
    reviewDate: source.reviewDate ?? null,
    description: source.description ?? null,
    isTemplate: source.isTemplate ?? null,
    titleLocalLanguage: source.titleLocalLanguage ?? null,
    type: source.type ?? null,
    status: source.status ?? null,
  },
});

export const buildRevisionWorkspaceNavigationState = (
  state: Partial<RevisionNavigationState> & Record<string, unknown> & {
    from: string;
    workspaceMode?: Exclude<WorkspaceNavigationMode, "detail">;
  },
): { workspaceState: RevisionWorkspaceState } => {
  const workspaceMode = state.workspaceMode ?? "create";
  const workspaceState: RevisionWorkspaceState = {
    ...(state.workspaceState ?? {}),
    from: state.from,
    returnTo: state.returnTo || state.workspaceReturnPath || state.from,
    workspaceReturnPath: state.workspaceReturnPath || state.returnTo || state.from,
    fromRevisionWorkspace: true,
    revisionWorkspaceMode: workspaceMode,
    parentDocumentId: state.parentDocumentId ?? null,
    sourceRevisionId: state.sourceRevisionId ?? null,
    revisionId: state.revisionId ?? null,
    documentId: state.documentId ?? null,
    revisionNumber: state.revisionNumber,
    revisionCreated: state.revisionCreated,
    revisionOpenedBy: state.revisionOpenedBy,
    documentNumber: state.documentNumber,
    documentName: state.documentName,
    documentAuthor: state.documentAuthor,
    documentStatus: state.documentStatus,
    documentCreated: state.documentCreated,
  };

  return {
    workspaceState,
  };
};

export const buildRevisionDetailNavigationState = (
  state: RevisionNavigationState & {
    detail?: { id?: string | null } | null;
    workspaceMode?: Exclude<WorkspaceNavigationMode, "detail">;
  },
): Record<string, unknown> => {
  const { workspaceState } = buildRevisionWorkspaceNavigationState(state as Partial<RevisionNavigationState> & Record<string, unknown> & {
    from: string;
    workspaceMode?: Exclude<WorkspaceNavigationMode, "detail">;
  });
  const snapshotState = state.detail ? buildRevisionDetailSnapshotState(state.detail) : {};
  return {
    workspaceState,
    ...snapshotState,
  };
};

const REVISION_EDIT_PREFIX = "/documents/revisions/edit/";

export const resolveRevisionRouteByMode = (
  revisionId: string,
  mode: WorkspaceNavigationMode,
) => {
  switch (mode) {
    case "detail":
      return ROUTES.DOCUMENTS.REVISIONS.DETAIL(revisionId);
    case "edit":
      return ROUTES.DOCUMENTS.REVISIONS.EDIT(revisionId);
    case "create":
    default:
      return ROUTES.DOCUMENTS.REVISIONS.CREATE;
  }
};

export const resolveDocumentWorkspaceModeFromRevisionPath = (
  pathname: string,
): Exclude<WorkspaceNavigationMode, "detail"> => {
  if (pathname.startsWith(REVISION_EDIT_PREFIX)) {
    return "edit";
  }

  return "create";
};
