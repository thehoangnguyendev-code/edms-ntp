/**
 * Document List Module
 * 
 * Contains views and components for document listing, creation, review, and approval.
 */

// Main document list view
export { DocumentsView } from './DocumentsView';

// Single document creation
export { NewDocumentView } from './document-creation/NewDocumentView';

// Local list view types
export type {
  Document,
  RelatedDocument,
  CorrelatedDocument,
  DocumentViewType,
  DocumentListItem,
  DocumentListQuery,
  DocumentFiltersLookup,
  LookupItem,
} from './types';
