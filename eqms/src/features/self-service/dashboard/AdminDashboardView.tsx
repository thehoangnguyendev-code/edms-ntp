import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ClipboardList, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge/Badge';
import { dashboardApi, type DashboardPendingWorkflowAction } from '@/services/api/dashboard';
import { AdminOverviewTab } from './AdminOverviewTab';

export function AdminDashboardView() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<DashboardPendingWorkflowAction[]>([]);
  useEffect(() => { void dashboardApi.getPendingWorkflowActions().then(setTasks).catch(() => setTasks([])); }, []);
  const reviews = tasks.filter((task) => task.taskType === 'REVIEW').length;
  const approvals = tasks.length - reviews;

  return <div className="space-y-6 w-full">
    <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-5 py-6 md:px-7 md:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-violet-700">QUALITY & SYSTEM GOVERNANCE</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Admin Dashboard</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Monitor document lifecycle, workflow bottlenecks, user health and audit activity. Your personal actions remain visible below.</p></div><div className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-800"><ShieldCheck className="h-4 w-4" /> Administrative view</div></div>
    </section>

    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5"><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="mt-3 text-2xl font-bold text-slate-900">{tasks.length}</p><p className="text-sm font-semibold text-slate-700">My workflow actions</p><p className="mt-1 text-xs text-slate-500">{reviews} review · {approvals} approval</p></div>
      <button onClick={() => navigate('/documents/revisions')} className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-200 hover:shadow-sm"><ClipboardList className="h-5 w-5 text-emerald-600" /><p className="mt-3 font-bold text-slate-900">Open workflow queue</p><p className="mt-1 text-sm text-slate-500">Review revisions requiring action.</p><span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">Go to revisions <ArrowRight className="h-4 w-4" /></span></button>
      <div className="rounded-xl border border-slate-200 bg-white p-5"><Badge color="purple" size="sm">ADMIN</Badge><p className="mt-3 font-bold text-slate-900">Governance overview</p><p className="mt-1 text-sm text-slate-500">System-wide data below is protected by <code>dashboard.admin.view</code>.</p></div>
    </section>

    <AdminOverviewTab />
  </div>;
}
