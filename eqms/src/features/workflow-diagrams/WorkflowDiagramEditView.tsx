import { navigateBack } from "@/app/navigation/backNavigation";
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button/Button';
import { SectionLoading } from '@/components/ui/loading/Loading';
import { FormModal } from '@/components/ui/modal/FormModal';
import { PageHeader } from '@/components/ui/page/PageHeader';
import { useToast } from '@/components/ui/toast/Toast';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { tr, trFormat } from '@/i18n';
import { workflowDiagramApi, type WorkflowDiagram, type WorkflowModule } from '@/services/api/workflowDiagrams';
import { DrawioFrame, type DrawioFrameHandle } from './DrawioFrame';
import { useFillHeight } from './useFillHeight';
import { workflowBreadcrumbs, workflowError, workflowPath } from './workflowDiagramModel';

/** Drawing one diagram. Save in draw.io asks for the reason; the diagram is then in force at once. */
export function WorkflowDiagramEditView({ module }: { module: WorkflowModule }) {
  const { diagramId = '' } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [diagram, setDiagram] = useState<WorkflowDiagram | null>(null);
  const [dirty, setDirty] = useState(false);
  const [drawing, setDrawing] = useState<{ xml: string; svg: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const editor = useRef<DrawioFrameHandle>(null);
  // the editor takes all the room left on the page, whatever the screen
  const box = useFillHeight();
  const { go, modal } = useLeaveGuard(dirty, tr('Edit Workflow'), 'Workflow');
  const back = workflowPath(module, diagramId);

  useEffect(() => {
    let cancelled = false;
    // The route can move from one module or diagram to another while this screen stays mounted:
    // drop the previous drawing first, then mount the editor again for the one that is loaded.
    setDiagram(null);
    setDrawing(null);
    setDirty(false);
    setReason('');
    setReady(false);
    workflowDiagramApi.get(diagramId)
      .then((found) => {
        if (cancelled) return;
        // a person who may not change it only gets the picture
        if (!found.canManage || found.module !== module) navigate(back, { replace: true });
        else setDiagram(found);
      })
      .catch((error) => {
        if (cancelled) return;
        showToast({ type: 'error', message: workflowError(error) });
        navigate(workflowPath(module), { replace: true });
      });
    return () => { cancelled = true; };
  }, [diagramId, module, back, navigate, showToast]);

  const save = async () => {
    if (!diagram || !drawing) return;
    setBusy(true);
    try {
      await workflowDiagramApi.saveDrawing(diagram.id, { version: diagram.version, ...drawing, reason: reason.trim() });
      showToast({ type: 'success', message: tr('The diagram was saved and is now in force.') });
      setDirty(false);
      navigate(back);
    } catch (error) {
      // the editor stays open with the drawing, so nothing is lost
      showToast({ type: 'error', message: workflowError(error) });
    } finally {
      setBusy(false);
    }
  };

  // Save does what Save inside draw.io does
  const actions = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline-emerald" onClick={() => navigateBack(go, null, back)}>{tr('Back')}</Button>
      <Button size="sm" variant="outline-emerald" disabled={!ready || busy} onClick={() => editor.current?.save()}>{tr('Save')}</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={tr('Edit Workflow')}
        breadcrumbItems={workflowBreadcrumbs(module, go, true)}
        actions={actions}
      />
      {diagram ? (
        <div ref={box.ref} style={{ height: box.height }} className="min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white">
          <DrawioFrame
            key={diagram.id}
            ref={editor}
            onReady={() => setReady(true)}
            xml={diagram.xml ?? ''}
            onChange={() => setDirty(true)}
            onSave={(next) => { setDrawing(next); setDirty(true); setReason(''); }}
            onExit={() => go(back)}
          />
        </div>
      ) : <SectionLoading text={tr('Loading...')} />}

      <FormModal
        isOpen={drawing !== null}
        onClose={() => setDrawing(null)}
        onConfirm={() => void save()}
        title={tr('Save Diagram')}
        description={tr('The saved diagram replaces the one in force for everyone who views it. The earlier version is kept.')}
        confirmText={tr('Save')}
        isLoading={busy}
        confirmDisabled={reason.trim().length < 3}
      >
        <label htmlFor="workflow-save-reason" className="mb-1.5 block text-xs sm:text-sm font-medium text-slate-700">{tr('Reason for change')} <span className="text-red-500">*</span></label>
        <textarea
          id="workflow-save-reason"
          rows={3}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </FormModal>
      {modal}
    </div>
  );
}
