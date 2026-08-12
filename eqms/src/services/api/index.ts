/**
 * API Services Index
 * ─────────────────────────────────────────────────────────────────────────────
 * Single entry-point for all EQMS API calls.
 *
 * Usage:
 *   import { documentApi, trainingApi } from '@/services/api';
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Core
export { api, uploadFile } from './client';
export { authApi } from './auth';
export { brandingApi } from './branding';
export { localizationApi } from './localization';

// Document Management
export { documentApi } from './documents';

export { trainingApi } from './training';
export { auditTrailApi } from './auditTrail';

// Platform
export { notificationApi } from './notifications';
export { reportApi } from './report';
export { dashboardApi } from './dashboard';
export { settingsApi } from './settings';
export { emailTemplateApi } from './emailTemplates';
export { dictionaryApi } from './dictionary';
export { sharedApi } from './shared';
export { searchApi, countApi } from './search';
export { metadataApi } from './metadata';
export { promptSpecApi } from './promptSpec';
export { navigationApi } from './navigation';
export type { FlatMenuItem } from './navigation';
export { controlledCopyPolicyApi } from './controlledCopyPolicy';
export type { ControlledCopyPolicy } from './controlledCopyPolicy';
export { workflowActionPolicyApi } from './workflowActionPolicy';

// Param/filter types for each API module
export type { GetUsersParams } from './settings';
export type { GetAuditTrailParams } from './auditTrail';
export type { Notification } from './notifications';
export type {
  CreatePromptGenerationRunPayload,
  CreatePromptSpecificationPayload,
  GeneratedArtifact,
  PromptGenerationRun,
  PromptGenerationRunStatus,
  PromptSpecification,
  PromptSpecificationStatus,
  PromptSpecificationSummary,
} from './promptSpec';

// Re-export shared types for convenience
export type * from '@/types';
