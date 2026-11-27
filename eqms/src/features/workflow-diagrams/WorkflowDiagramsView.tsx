import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { IconHistory, IconPencilMinus, IconSitemap, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button/Button';
import { FormSection } from '@/components/ui/form/FormSection';
import { FormModal } from '@/components/ui/modal/FormModal';
import { PageHeader } from '@/components/ui/page/PageHeader';
import { SectionLoading } from '@/components/ui/loading/Loading';
import { useToast } from '@/components/ui/toast/Toast';
import { cn } from '@/components/ui/utils';
import { SEARCH_DEBOUNCE_MS } from '@/constants/search';
import { useDebounce } from '@/hooks/useDebounce';
import { tr, trFormat } from '@/i18n';
import { workflowDiagramApi, type WorkflowDiagram, type WorkflowDiagramSummary, type WorkflowDiagramVersion, type WorkflowModule } from '@/services/api/workflowDiagrams';
import { DrawioViewer } from './DrawioViewer';
import { useFillHeight } from './useFillHeight';
import { workflowBreadcrumbs, workflowEditPath, workflowError } from './workflowDiagramModel';

const INPUT = 'w-full h-9 rounded-lg border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
const AREA = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
const LABEL = 'mb-1.5 block text-xs sm:text-sm font-medium text-slate-700';

type Dialog = 'create' | 'rename' | 'delete' | 'history' | null;

/** The workflow diagrams of one module: the list at the left, the picture of the chosen one beside it. Changing needs the manage permission. */
export function WorkflowDiagramsView({ module }: { module: WorkflowModule }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();
  const selected = params.get('diagram');

  const [search, setSearch] = useState('');
  const words = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);
  const [list, setList] = useState<WorkflowDiagramSummary[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [diagram, setDiagram] = useState<WorkflowDiagram | null>(null);
  const [failed, setFailed] = useState(false);
  const box = useFillHeight();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<WorkflowDiagramVersion[] | null>(null);
  const [old, setOld] = useState<{ version: number; xml: string } | null>(null);

  const select = useCallback((id: string | null) => {
    setParams(id ? { diagram: id } : {}, { replace: true });
  }, [setParams]);
  // a diagram that is gone leaves the list at once, so that it is not chosen again from the old list
  const forget = useCallback((id: string) => setList((known) => known?.filter((item) => item.id !== id) ?? known), []);

  const loadList = useCallback(async () => {
    try {
      const answer = await workflowDiagramApi.list(module, words);
      setList(answer.data);
      setCanManage(answer.canManage);
      setFailed(false);
    } catch {
      setFailed(true);
      setList([]);
    }
  }, [module, words]);

  useEffect(() => { void loadList(); }, [loadList]);

  // the first diagram opens by itself
  useEffect(() => {
    if (!selected && list && list.length > 0) select(list[0].id);
  }, [list, selected, select]);

  useEffect(() => {
    setDiagram(null);
    if (!selected) return undefined;
    let cancelled = false;
    workflowDiagramApi.get(selected)
      .then((found) => {
        if (cancelled) return;
        // a diagram of another module is never shown here, whatever the address says
        if (found.module !== module) {
          select(null);
          return;
        }
        setDiagram(found);
      })
      .catch((error) => {
        if (cancelled) return;
        showToast({ type: 'error', message: workflowError(error) });
        forget(selected);
        select(null);
      });
    return () => { cancelled = true; };
  }, [selected, module, select, forget, showToast]);

  const open = (next: Dialog) => {
    setDialog(next);
    setReason('');
    setName(next === 'rename' ? diagram?.name ?? '' : '');
    setDescription(next === 'rename' ? diagram?.description ?? '' : '');
    setOld(null);
    if (next === 'history' && diagram) {
      setVersions(null);
      workflowDiagramApi.versions(diagram.id).then(setVersions).catch((error) => {
        setVersions([]);
        showToast({ type: 'error', message: workflowError(error) });
      });
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setDialog(null);
    } catch (error) {
      showToast({ type: 'error', message: workflowError(error) });
    } finally {
      setBusy(false);
    }
  };

  const create = () => run(async () => {
    const made = await workflowDiagramApi.create(module, name.trim(), description.trim());
    // a new diagram has no drawing yet: go on to draw it
    navigate(workflowEditPath(module, made.id));
  });
  const rename = () => run(async () => {
    const changed = await workflowDiagramApi.rename(diagram!.id, { name: name.trim(), description: description.trim(), reason: reason.trim() });
    setDiagram(changed);
    await loadList();
    showToast({ type: 'success', message: tr('The changes were saved.') });
  });
  const remove = () => run(async () => {
    const gone = diagram!.id;
    await workflowDiagramApi.remove(gone, reason.trim());
    forget(gone);
    select(null);
    await loadList();
    showToast({ type: 'success', message: tr('The diagram was deleted.') });
  });

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title={tr('Workflow')}
        breadcrumbItems={workflowBreadcrumbs(module, navigate)}
        actions={canManage ? (
          <Button size="sm" variant="default" className="gap-1.5 whitespace-nowrap" onClick={() => open('create')}>
            <Plus className="h-4 w-4" />{tr('New Diagram')}
          </Button>
        ) : undefined}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input aria-label={tr('Search')} placeholder={tr('Search')} value={search} onChange={(e) => setSearch(e.target.value)} className={cn(INPUT, 'pl-9')} />
          </div>
          <div className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto">
            {list === null && <SectionLoading text={tr('Loading...')} />}
            {failed && <p className="px-2 py-3 text-xs text-red-600">{tr('The diagrams could not be loaded.')}</p>}
            {list !== null && !failed && list.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">{words ? tr('No diagram matches.') : tr('There is no diagram yet.')}</p>}
            {list?.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={item.id === selected}
                onClick={() => select(item.id)}
                className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', item.id === selected ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50')}
              >
                <IconSitemap className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  {item.description && <span className="block truncate text-xs text-slate-500">{item.description}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>

        {diagram ? (
          <FormSection
            title={diagram.name}
            icon={<IconSitemap className="h-4 w-4" />}
            headerRight={(
              <div className="flex flex-wrap items-center gap-1.5">
                {diagram.version > 0 && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => open('history')}><IconHistory className="h-4 w-4" />{tr('History')}</Button>
                )}
                {diagram.canManage && (
                  <>
                    <Button size="sm" variant="outline-emerald" className="gap-1.5" onClick={() => navigate(workflowEditPath(module, diagram.id))}><IconPencilMinus className="h-4 w-4" />{tr('Edit')}</Button>
                    <Button size="sm" variant="outline" onClick={() => open('rename')}>{tr('Rename')}</Button>
                    <Button size="icon-sm" variant="outline" aria-label={tr('Delete')} onClick={() => open('delete')}><IconTrash className="h-4 w-4 text-red-600" /></Button>
                  </>
                )}
              </div>
            )}
          >
            {diagram.xml ? (
              <div ref={box.ref} style={{ height: box.height === undefined ? undefined : box.height - 40 }} className="min-h-[380px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                <DrawioViewer key={diagram.id} xml={diagram.xml} title={diagram.name} />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">{tr('This diagram has not been drawn yet.')}</p>
            )}
            <p className="mt-1.5 text-xs text-slate-500">
              {diagram.version > 0
                ? trFormat('Version {version}, saved by {name} on {time}.', { version: diagram.version, name: diagram.updatedByName, time: diagram.updatedAt })
                : trFormat('Created by {name} on {time}.', { name: diagram.updatedByName, time: diagram.updatedAt })}
            </p>
          </FormSection>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500">
            {selected ? <SectionLoading text={tr('Loading...')} /> : tr('Choose a diagram to see it.')}
          </div>
        )}
      </div>

      <FormModal
        isOpen={dialog === 'create' || dialog === 'rename'}
        onClose={() => setDialog(null)}
        onConfirm={() => void (dialog === 'create' ? create() : rename())}
        title={dialog === 'create' ? tr('New Diagram') : tr('Rename')}
        confirmText={dialog === 'create' ? tr('Create') : tr('Save')}
        isLoading={busy}
        confirmDisabled={!name.trim() || (dialog === 'rename' && reason.trim().length < 3)}
        dirty={Boolean(reason) || name !== (dialog === 'rename' ? diagram?.name ?? '' : '')}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="workflow-name" className={LABEL}>{tr('Name')} <span className="text-red-500">*</span></label>
            <input id="workflow-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="workflow-description" className={LABEL}>{tr('Description')}</label>
            <textarea id="workflow-description" rows={2} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} className={AREA} />
          </div>
          {dialog === 'rename' && (
            <div>
              <label htmlFor="workflow-rename-reason" className={LABEL}>{tr('Reason for change')} <span className="text-red-500">*</span></label>
              <textarea id="workflow-rename-reason" rows={2} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} className={AREA} />
            </div>
          )}
        </div>
      </FormModal>

      <FormModal
        isOpen={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onConfirm={() => void remove()}
        title={tr('Delete Diagram')}
        description={trFormat('"{name}" will no longer be shown. Its saved versions and the audit trail are kept.', { name: diagram?.name ?? '' })}
        confirmText={tr('Delete')}
        confirmVariant="destructive"
        isLoading={busy}
        confirmDisabled={reason.trim().length < 3}
      >
        <label htmlFor="workflow-delete-reason" className={LABEL}>{tr('Reason')} <span className="text-red-500">*</span></label>
        <textarea id="workflow-delete-reason" rows={3} value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} className={AREA} />
      </FormModal>

      <FormModal isOpen={dialog === 'history'} onClose={() => setDialog(null)} title={tr('Version History')} size="xl" showFooter={false}>
        {versions === null ? <SectionLoading text={tr('Loading...')} /> : (
          <div className="space-y-3">
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {versions.map((item) => (
                <li key={item.version} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{trFormat('Version {number}', { number: item.version })}</p>
                    <p className="text-xs text-slate-500">{item.savedByName} · {item.savedAt}</p>
                    <p className="text-xs text-slate-700 break-words">{item.reason}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void workflowDiagramApi.versionImage(diagram!.id, item.version).then(setOld).catch((error) => showToast({ type: 'error', message: workflowError(error) }))}>
                    {tr('View')}
                  </Button>
                </li>
              ))}
            </ul>
            {old && (
              <div className="h-[45vh] overflow-hidden rounded-lg border border-slate-200 bg-white">
                <DrawioViewer key={old.version} xml={old.xml} title={trFormat('Version {number}', { number: old.version })} />
              </div>
            )}
          </div>
        )}
      </FormModal>
    </div>
  );
}
