import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  Plus,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge/Badge';
import { IconTile } from '@/components/ui/icon-tile';
import { Select } from '@/components/ui/select/Select';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentPermissions } from '@/features/documents/shared/useDocumentPermissions';
import { usePermissions } from '@/hooks/usePermissions';
import {
  dashboardApi,
  type DashboardActivityPoint,
  type DashboardPendingWorkflowAction,
  type DashboardSummary,
} from '@/services/api/dashboard';
import { AdminDashboardView } from './AdminDashboardView';

const taskColor = (type: DashboardPendingWorkflowAction['taskType']) => type === 'REVIEW' ? 'amber' : 'blue';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function PersonalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canCreateDocumentShell } = useDocumentPermissions();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tasks, setTasks] = useState<DashboardPendingWorkflowAction[]>([]);
  const [activity, setActivity] = useState<DashboardActivityPoint[]>([]);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    void dashboardApi.getSummary().then(setSummary).catch(() => setSummary(null));
    void dashboardApi.getPendingWorkflowActions().then(setTasks).catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    void dashboardApi.getDocumentActivity(period).then(setActivity).catch(() => setActivity([]));
  }, [period]);

  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.username || 'User';
  const reviewTasks = tasks.filter((task) => task.taskType === 'REVIEW').length;
  const approvalTasks = tasks.filter((task) => task.taskType === 'APPROVAL').length;
  const cards = [
    { label: 'My pending actions', value: summary?.myPendingWorkflowActions ?? 0, icon: ClipboardList, color: 'emerald' as const, detail: `${reviewTasks} review · ${approvalTasks} approval` },
    { label: 'Pending review', value: summary?.pendingReview ?? 0, icon: AlertCircle, color: 'amber' as const, detail: 'Workflow queue' },
    { label: 'Pending approval', value: summary?.pendingApproval ?? 0, icon: Clock3, color: 'red' as const, detail: 'Workflow queue' },
    { label: 'Pending training', value: summary?.pendingTraining ?? 0, icon: GraduationCap, color: 'purple' as const, detail: 'Training follow-up' },
    { label: 'Effective documents', value: summary?.totalEffectiveDocuments ?? 0, icon: FileText, color: 'blue' as const, detail: 'Available in workspace' },
    { label: 'Document workspace', value: summary?.totalDocuments ?? 0, icon: BarChart3, color: 'slate' as const, detail: 'All document records' },
  ];

  return (
    <div className="space-y-6 w-full">
      <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-5 py-6 md:px-7 md:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">PERSONAL WORKSPACE</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{greeting()}, {fullName}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Focus on the quality actions, documents and training items that need your attention.</p>
          </div>
          {canCreateDocumentShell && (
            <button onClick={() => navigate('/documents/all/new')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
              <Plus className="h-4 w-4" /> New document
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ label, value, icon, color, detail }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <IconTile icon={(() => { const Icon = icon; return <Icon />; })()} color={color} size="sm" />
            <p className="mt-4 text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
            <p className="mt-1 text-xs text-slate-400">{detail}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-bold text-slate-900">Document activity</h2><p className="text-sm text-slate-500">Documents created over time</p></div>
            <div className="w-full sm:w-36"><Select value={period} onChange={(value) => setPeriod(value as typeof period)} enableSearch={false} options={[{ label: 'Monthly', value: 'month' }, { label: 'Quarterly', value: 'quarter' }, { label: 'Yearly', value: 'year' }]} /></div>
          </div>
          <div className="h-72 p-4">
            {activity.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-slate-400">No activity data available</div> : (
              <ResponsiveContainer width="100%" height="100%"><BarChart data={activity}><CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">My action queue</h2><p className="text-sm text-slate-500">Review and approval work assigned to you</p></div><Badge color="amber" size="sm">{tasks.length}</Badge></div>
          <div className="divide-y divide-slate-100">
            {tasks.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">No pending actions</p> : tasks.slice(0, 6).map((task) => (
              <button key={task.revisionId} onClick={() => navigate(`/documents/${task.documentId}/revisions/${task.revisionId}`)} className="block w-full px-5 py-3 text-left transition hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2"><p className="line-clamp-1 text-sm font-semibold text-slate-800">{task.documentName}</p><Badge color={taskColor(task.taskType)} size="xs">{task.taskType}</Badge></div>
                <p className="mt-1 text-xs text-slate-500">{task.documentNumber} · Revision {task.revisionNumber}</p>
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/documents/revisions')} className="flex w-full items-center justify-center gap-1 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Open document revisions <ArrowRight className="h-4 w-4" /></button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5"><AlertCircle className="h-5 w-5 text-amber-600" /><h2 className="mt-3 font-bold text-slate-900">Review attention</h2><p className="mt-1 text-sm text-slate-600">{summary?.pendingReview ?? 0} revisions are currently in review.</p></div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5"><CheckCircle2 className="h-5 w-5 text-blue-600" /><h2 className="mt-3 font-bold text-slate-900">Approval attention</h2><p className="mt-1 text-sm text-slate-600">{summary?.pendingApproval ?? 0} revisions are waiting for approval.</p></div>
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-5"><GraduationCap className="h-5 w-5 text-violet-600" /><h2 className="mt-3 font-bold text-slate-900">Training follow-up</h2><p className="mt-1 text-sm text-slate-600">{summary?.pendingTraining ?? 0} revision training activities are pending.</p></div>
      </section>
    </div>
  );
}

export function DashboardView() {
  const { hasPermission } = usePermissions();
  return hasPermission('dashboard.admin.view') ? <AdminDashboardView /> : <PersonalDashboard />;
}
