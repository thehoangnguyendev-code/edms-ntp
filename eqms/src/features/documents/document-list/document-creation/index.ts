/**
 * Document Creation Module
 * 
 * Components and utilities for creating new documents.
 * Simple single-step document creation workflow.
 */

// Document views
export { NewDocumentView } from './NewDocumentView';
export { LegacyImportView } from './LegacyImportView';
// Workflow layout (re-export from shared)
export { DocumentWorkflowLayout, DEFAULT_WORKFLOW_TABS } from '@/features/documents/shared/layouts';

// Tabs
export * from './new-tabs';
