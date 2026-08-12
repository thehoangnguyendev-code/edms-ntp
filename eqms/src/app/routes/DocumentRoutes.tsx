import React, { Suspense, lazy } from 'react';
import { Route, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { NavigateFunction } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '../routes.constants';
import { LoadingFallback } from './LoadingFallback';
import { navigateBack, type BackNavigationLocationState } from '../navigation/backNavigation';
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// ==================== LAZY LOADED ====================
const DetailDocumentView = lazy(() => import('@/features/documents/document-detail/DetailDocumentView').then(m => ({ default: m.DetailDocumentView })));
const DocumentsView = lazy(() => import('@/features/documents/document-list').then(m => ({ default: m.DocumentsView })));
const NewDocumentView = lazy(() => import('@/features/documents/document-list/document-creation').then(m => ({ default: m.NewDocumentView })));
const KnowledgeView = lazy(() => import('@/features/documents/knowledge').then(m => ({ default: m.KnowledgeView })));
const DetailRevisionView = lazy(() => import('@/features/documents/document-revisions/detail-revision/DetailRevisionView').then(m => ({ default: m.DetailRevisionView })));
const RevisionListView = lazy(() => import('@/features/documents/document-revisions').then(m => ({ default: m.RevisionListView })));
const NewRevisionView = lazy(() => import('@/features/documents/document-revisions').then(m => ({ default: m.NewRevisionView })));
const RevisionsOwnedByMeView = lazy(() => import('@/features/documents/document-revisions').then(m => ({ default: m.RevisionsOwnedByMeView })));
const RevisionCreateView = lazy(() => import('@/features/documents/document-revisions').then(m => ({ default: m.RevisionCreateView })));
const PendingDocumentsView = lazy(() => import('@/features/documents/document-revisions').then(m => ({ default: m.PendingDocumentsView })));
const RevisionReviewView = lazy(() => import('@/features/documents/document-revisions').then(m => ({ default: m.RevisionReviewView })));
const RevisionApprovalView = lazy(() => import('@/features/documents/document-revisions').then(m => ({ default: m.RevisionApprovalView })));
const RevisionTrainingView = lazy(() => import('@/features/documents/document-revisions').then(m => ({ default: m.RevisionTrainingView })));
const PublishingWorkspaceView = lazy(() => import('@/features/documents/publishing/PublishingWorkspaceView').then(m => ({ default: m.PublishingWorkspaceView })));
const ControlledCopiesView = lazy(() => import('@/features/documents/controlled-copies').then(m => ({ default: m.ControlledCopiesView })));
const ControlledCopyBatchStatusDiscrepanciesView = lazy(() => import('@/features/documents/controlled-copies').then(m => ({ default: m.ControlledCopyBatchStatusDiscrepanciesView })));
const ControlledCopyDetailView = lazy(() => import('@/features/documents/controlled-copies').then(m => ({ default: m.ControlledCopyDetailView })));
const DestroyControlledCopyView = lazy(() => import('@/features/documents/controlled-copies').then(m => ({ default: m.DestroyControlledCopyView })));
const ControlledCopyPreviewView = lazy(() => import('@/features/documents/controlled-copies').then(m => ({ default: m.ControlledCopyPreviewView })));
const RequestControlledCopyView = lazy(() => import('@/features/documents/document-revisions/views/RequestControlledCopyView').then(m => ({ default: m.RequestControlledCopyView })));

// ==================== ROUTE WRAPPER ====================
interface RouteWrapperProps {
  render: (id: string, navigate: NavigateFunction) => React.ReactElement;
}

const RouteWrapper: React.FC<RouteWrapperProps> = ({ render }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  if (!id) return <Navigate to={ROUTES.DASHBOARD} replace />;
  return render(id, navigate);
};

// ==================== DETAIL WRAPPERS ====================
const DetailDocumentViewWrapper = () => {
  const location = useLocation();
  return (
    <RouteWrapper
      render={(id, navigate) => (
        <Suspense fallback={<LoadingFallback />}>
          <DetailDocumentView
            documentId={id}
            onBack={() => navigateBack(navigate, location.state as BackNavigationLocationState | null | undefined, ROUTES.DOCUMENTS.ALL)}
          />
        </Suspense>
      )}
    />
  );
};

const DetailRevisionViewWrapper = () => {
  const location = useLocation();
  return (
    <RouteWrapper
      render={(id, navigate) => (
        <Suspense fallback={<LoadingFallback />}>
          <DetailRevisionView
            revisionId={id}
            onBack={() => navigateBack(navigate, location.state as BackNavigationLocationState | null | undefined, ROUTES.DOCUMENTS.REVISIONS.ALL)}
          />
        </Suspense>
      )}
    />
  );
};

const RevisionReviewViewWrapper = () => {
  const { user } = useAuth();
  const location = useLocation();
  return (
    <RouteWrapper
      render={(id, navigate) => (
        <Suspense fallback={<LoadingFallback />}>
          <RevisionReviewView
            revisionId={id}
            onBack={() => navigateBack(navigate, location.state as BackNavigationLocationState | null | undefined, ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW)}
            currentUserId={user?.id || ''}
          />
        </Suspense>
      )}
    />
  );
};

const RevisionApprovalViewWrapper = () => {
  const { user } = useAuth();
  const location = useLocation();
  return (
    <RouteWrapper
      render={(id, navigate) => (
        <Suspense fallback={<LoadingFallback />}>
          <RevisionApprovalView
            revisionId={id}
            onBack={() => navigateBack(navigate, location.state as BackNavigationLocationState | null | undefined, ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL)}
            currentUserId={user?.id || ''}
          />
        </Suspense>
      )}
    />
  );
};

const RevisionTrainingViewWrapper = () => {
  const location = useLocation();
  return (
    <RouteWrapper
      render={(id, navigate) => (
        <Suspense fallback={<LoadingFallback />}>
          <RevisionTrainingView
            revisionId={id}
            onBack={() => navigateBack(navigate, location.state as BackNavigationLocationState | null | undefined, ROUTES.DOCUMENTS.REVISIONS.ALL)}
          />
        </Suspense>
      )}
    />
  );
};

const PublishingWorkspaceViewWrapper = () => {
  const location = useLocation();
  return (
    <RouteWrapper
      render={(id, navigate) => (
        <Suspense fallback={<LoadingFallback />}>
          <PublishingWorkspaceView
            revisionId={id}
            onBack={() => navigateBack(navigate, location.state as BackNavigationLocationState | null | undefined, ROUTES.DOCUMENTS.REVISIONS.DETAIL(id))}
          />
        </Suspense>
      )}
    />
  );
};

const ControlledCopyDetailViewWrapper = () => {
  const location = useLocation();
  return (
    <RouteWrapper
      render={(id, navigate) => (
        <Suspense fallback={<LoadingFallback />}>
          <ControlledCopyDetailView
            controlledCopyId={id}
            onBack={() => navigateBack(navigate, location.state as BackNavigationLocationState | null | undefined, ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL)}
          />
        </Suspense>
      )}
    />
  );
};

const ControlledCopyPreviewViewWrapper = () => (
  <Suspense fallback={<LoadingFallback />}>
    <ControlledCopyPreviewView />
  </Suspense>
);

// ==================== DOCUMENT ROUTES ====================
export function documentRoutes(navigate: NavigateFunction) {
  return (
    <Route
      path="documents"
      element={
        <ProtectedRoute requiredPermissions={["documents.module.view"]}>
          <Outlet />
        </ProtectedRoute>
      }
    >
      {/* Document Lists */}
      <Route path="owned" element={<Suspense fallback={<LoadingFallback />}><DocumentsView viewType="owned-by-me" /></Suspense>} />
      <Route path="all" element={<Suspense fallback={<LoadingFallback />}><DocumentsView viewType="all" /></Suspense>} />
      <Route path="all/new" element={<Suspense fallback={<LoadingFallback />}><NewDocumentView /></Suspense>} />
      <Route path="all/edit/:id" element={<Suspense fallback={<LoadingFallback />}><NewDocumentView /></Suspense>} />
      {/* Knowledge Base */}
      <Route path="knowledge" element={<Suspense fallback={<LoadingFallback />}><KnowledgeView /></Suspense>} />

      {/* Document Detail */}
      <Route path=":id" element={<DetailDocumentViewWrapper />} />

      {/* Document Revisions */}
      <Route path="revisions">
        <Route path="all" element={<Suspense fallback={<LoadingFallback />}><RevisionListView /></Suspense>} />
        <Route path="owned" element={<Suspense fallback={<LoadingFallback />}><RevisionsOwnedByMeView /></Suspense>} />
        <Route path=":id" element={<DetailRevisionViewWrapper />} />
        <Route path="pending-review" element={<Suspense fallback={<LoadingFallback />}><PendingDocumentsView viewType="review" /></Suspense>} />
        <Route path="pending-approval" element={<Suspense fallback={<LoadingFallback />}><PendingDocumentsView viewType="approval" /></Suspense>} />
        <Route path="new" element={<Suspense fallback={<LoadingFallback />}><NewRevisionView /></Suspense>} />
        <Route path="create" element={<Suspense fallback={<LoadingFallback />}><RevisionCreateView /></Suspense>} />
        <Route path="edit/:id" element={<Suspense fallback={<LoadingFallback />}><RevisionCreateView /></Suspense>} />
        <Route path=":id/publishing" element={<PublishingWorkspaceViewWrapper />} />
        <Route path="review/:id" element={<RevisionReviewViewWrapper />} />
        <Route path="approval/:id" element={<RevisionApprovalViewWrapper />} />
        <Route path="training/:id" element={<RevisionTrainingViewWrapper />} />
        <Route path="*" element={<Suspense fallback={<LoadingFallback />}><DocumentsView viewType="all" /></Suspense>} />
      </Route>

      {/* Controlled Copies */}
      <Route path="controlled-copies">
        <Route index element={<Navigate to={ROUTES.DOCUMENTS.CONTROLLED_COPIES.ALL} replace />} />
        <Route path="all" element={<Suspense fallback={<LoadingFallback />}><ControlledCopiesView viewType="all" /></Suspense>} />
        <Route path="ready" element={<Suspense fallback={<LoadingFallback />}><ControlledCopiesView viewType="ready" /></Suspense>} />
        <Route path="distributed" element={<Suspense fallback={<LoadingFallback />}><ControlledCopiesView viewType="distributed" /></Suspense>} />
        <Route path="preview/:id" element={<ControlledCopyPreviewViewWrapper />} />
        <Route path="discrepancies" element={<Suspense fallback={<LoadingFallback />}><ControlledCopyBatchStatusDiscrepanciesView /></Suspense>} />
        <Route path=":id" element={<ControlledCopyDetailViewWrapper />} />
        <Route path=":id/destroy" element={<Suspense fallback={<LoadingFallback />}><DestroyControlledCopyView /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<LoadingFallback />}><DocumentsView viewType="all" /></Suspense>} />
      </Route>
      <Route path="controlled-copy/request" element={<Suspense fallback={<LoadingFallback />}><RequestControlledCopyView /></Suspense>} />
    </Route>
  );
}
