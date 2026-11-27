import { ROUTES } from '@/app/routes.constants';
import type { BreadcrumbItem } from '@/components/ui/breadcrumb/Breadcrumb';
import { dashboard } from '@/components/ui/breadcrumb/breadcrumbs/shared';
import { tr } from '@/i18n';
import type { WorkflowModule } from '@/services/api/workflowDiagrams';

const MODULES: Record<WorkflowModule, { label: string; path: string; permission: string }> = {
  DOCUMENT_CONTROL: { label: 'Document Control', path: ROUTES.DOCUMENTS.WORKFLOW, permission: 'documents.workflow_diagram' },
  TRAINING: { label: 'Training Management', path: ROUTES.TRAINING.WORKFLOW, permission: 'training.workflow_diagram' },
};

export const workflowPath = (module: WorkflowModule, diagramId?: string) =>
  diagramId ? `${MODULES[module].path}?diagram=${diagramId}` : MODULES[module].path;

export const workflowEditPath = (module: WorkflowModule, diagramId: string) => `${MODULES[module].path}/${diagramId}/edit`;

export const workflowPermissions = (module: WorkflowModule) => [`${MODULES[module].permission}.view`, `${MODULES[module].permission}.manage`];

export const workflowBreadcrumbs = (module: WorkflowModule, navigate: (path: string) => void, editing = false): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: tr(MODULES[module].label) },
  ...(editing
    ? [{ label: tr('Workflow'), onClick: () => navigate(MODULES[module].path) }, { label: tr('Edit Workflow'), isActive: true }]
    : [{ label: tr('Workflow'), isActive: true }]),
];

/** The text of a data address that draw.io returns for an export. */
export const textOfDataUri = (uri: string): string => {
  const comma = uri.indexOf(',');
  if (!uri.startsWith('data:') || comma < 0) return uri;
  const body = uri.slice(comma + 1);
  if (!uri.slice(0, comma).endsWith(';base64')) return decodeURIComponent(body);
  return new TextDecoder().decode(Uint8Array.from(atob(body), (c) => c.charCodeAt(0)));
};

const ERRORS: Record<string, string> = {
  WORKFLOW_DIAGRAM_CHANGED: 'Someone else saved this diagram after you opened it. Open it again and redo your change.',
  WORKFLOW_DIAGRAM_NAME_TAKEN: 'A diagram with this name already exists.',
  WORKFLOW_DIAGRAM_NAME_REQUIRED: 'Enter a name of up to 200 characters.',
  WORKFLOW_DIAGRAM_DESCRIPTION_TOO_LONG: 'The description is too long (1000 characters at most).',
  WORKFLOW_DIAGRAM_REASON_REQUIRED: 'Enter a reason of at least 3 characters.',
  WORKFLOW_DIAGRAM_CONTENT_INVALID: 'The diagram could not be saved: it is empty or too large.',
  WORKFLOW_DIAGRAM_NOT_FOUND: 'This diagram no longer exists.',
};

export const workflowError = (error: unknown): string => {
  // the server answers { error: { code, message } }; the reason of a refusal (WORKFLOW_DIAGRAM_...) is inside the message
  const data = (error as { response?: { data?: { message?: string; error?: { message?: string } | string } } })?.response?.data;
  const text = [data?.message, typeof data?.error === 'string' ? data.error : data?.error?.message].filter(Boolean).join(' ');
  const code = Object.keys(ERRORS).find((key) => text.includes(key));
  return tr(code ? ERRORS[code] : 'The action could not be completed. Please try again.');
};
