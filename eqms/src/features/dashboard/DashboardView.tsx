import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabNav } from '@/components/ui/tabs/TabNav';
import { AdminOverviewTab } from './AdminOverviewTab';
import {
  FileText,
  AlertTriangle,
  CheckSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  Bell,
  Activity,
  PieChart,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { IconTile } from '@/components/ui/icon-tile';
import { Badge } from '@/components/ui/badge/Badge';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentPermissions } from '@/features/documents/shared/useDocumentPermissions';
import { usePermissions } from '@/hooks/usePermissions';
import { Select } from '@/components/ui/select/Select';
import {
  dashboardApi,
  type DashboardSummary,
  type DashboardActivityPoint,
  type DashboardPendingWorkflowAction,
  type DashboardRecentActivity,
} from '@/services/api/dashboard';

const QUICK_ACTIONS = [
  { label: 'New Document', icon: FileText, tile: 'emerald' as const, border: 'border-emerald-100' },
  { label: 'Report Incident', icon: AlertTriangle, tile: 'amber' as const, border: 'border-amber-100' },
  { label: 'Schedule Audit', icon: CheckSquare, tile: 'blue' as const, border: 'border-blue-100' },
  { label: 'System Alert', icon: Bell, tile: 'purple' as const, border: 'border-purple-100' },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: 'Pending Review',
  PENDING_APPROVAL: 'Pending Approval',
  PENDING_TRAINING: 'Pending Training',
  EFFECTIVE: 'Effective',
  DRAFT: 'Draft',
};

const ENTITY_TYPE_LABEL: Record<string, string> = {
  DOCUMENT: 'Document',
  DOCUMENT_REVISION: 'Revision',
  CONTROLLED_COPY: 'Controlled Copy',
};

const Counter = ({ value, suffix = '' }: { value: number; suffix?: string }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) =>
    Number.isInteger(value) ? Math.round(latest) + suffix : latest.toFixed(1) + suffix
  );

  useEffect(() => {
    // defer number animation until after first paint to avoid competing with entry animations
    const raf = requestAnimationFrame(() => {
      const controls = animate(count, value, { duration: 1.0, ease: 'easeOut' });
      return controls.stop;
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <motion.span>{rounded}</motion.span>;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } },
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg border border-slate-200">
        <p className="text-sm font-semibold text-slate-900">{payload[0].payload.label}</p>
        <p className="text-xs text-slate-600">{payload[0].value.toLocaleString()} documents</p>
      </div>
    );
  }
  return null;
};

const formatTimeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const DashboardView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canCreateDocumentShell } = useDocumentPermissions();
  const { hasAnyPermission } = usePermissions();
  const [chartPeriod, setChartPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [activeTab, setActiveTab] = useState('my-dashboard');
  const canViewSystemOverview = hasAnyPermission([
    'dashboard.admin.view',
    'settings.user.view',
    'security.access_profiles.view',
    'security.permission_sets.view',
    'audittrail.module.view',
    'settings.user.view',
    'security.access_profiles.view',
  ]);

  const [adminTabMounted, setAdminTabMounted] = useState(false);
  const [animReady, setAnimReady] = useState(false);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activityData, setActivityData] = useState<DashboardActivityPoint[]>([]);
  const [pendingWorkflowActions, setPendingWorkflowActions] = useState<DashboardPendingWorkflowAction[]>([]);
  const [recentActivity, setRecentActivity] = useState<DashboardRecentActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const canCreateDocument = canCreateDocumentShell;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getUserFullName = () => {
    if (!user) return 'User';
    return `${user.firstName} ${user.lastName}`.trim() || user.username;
  };

  const formatYAxis = (value: number) => (value >= 1000 ? `${value / 1000}k` : String(value));

  useEffect(() => {
    // defer animations to after first paint — avoids competing with JS parse on cold load
    const raf = requestAnimationFrame(() => setAnimReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    void dashboardApi.getSummary().then(setSummary).catch(() => {});
    void dashboardApi.getPendingWorkflowActions().then(setPendingWorkflowActions).catch(() => {});
    void dashboardApi.getRecentActivity().then(setRecentActivity).catch(() => {});
  }, []);

  const loadActivity = useCallback(async (period: 'month' | 'quarter' | 'year') => {
    setLoadingActivity(true);
    try {
      const data = await dashboardApi.getDocumentActivity(period);
      setActivityData(data);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    void loadActivity(chartPeriod);
  }, [chartPeriod, loadActivity]);

  const stats = [
    {
      title: 'Effective Documents',
      value: summary?.totalEffectiveDocuments ?? 0,
      icon: FileText,
      tile: 'blue' as const,
    },
    {
      title: 'Pending Review',
      value: summary?.pendingReview ?? 0,
      icon: AlertCircle,
      tile: 'amber' as const,
    },
    {
      title: 'Pending Approval',
      value: summary?.pendingApproval ?? 0,
      icon: AlertTriangle,
      tile: 'red' as const,
    },
    {
      title: 'My Pending Actions',
      value: summary?.myPendingWorkflowActions ?? 0,
      icon: CheckCircle2,
      tile: 'emerald' as const,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {canViewSystemOverview && (
          <TabNav
            tabs={[
              { id: 'my-dashboard', label: 'Dashboard' },
              { id: 'system-overview', label: 'System Overview' },
            ]}
            activeTab={activeTab}
            onChange={(id) => { setActiveTab(id); if (id === 'system-overview') setAdminTabMounted(true); }}
            variant="pill"
            className="w-auto"
          />
        )}
      </div>

      {canViewSystemOverview && adminTabMounted && (
        <div className={activeTab !== 'system-overview' ? 'hidden' : undefined}>
          <AdminOverviewTab />
        </div>
      )}

      <motion.div
        className={cn('space-y-6 w-full flex-1 flex flex-col', activeTab === 'system-overview' && 'hidden')}
        variants={containerVariants}
        initial="hidden"
        animate={animReady ? 'visible' : 'hidden'}
      >
        {/* Welcome & Quick Actions */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 relative overflow-hidden rounded-xl bg-white border border-slate-100 p-4 md:p-5 group">
            <div className="absolute top-0 right-0 w-full h-full overflow-hidden z-0 pointer-events-none">
              <motion.div
                animate={animReady ? { scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.3, 0.5, 0.3] } : {}}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear', delay: 1.5 }}
                className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-50 rounded-full blur-3xl opacity-50"
              />
              <motion.div
                animate={animReady ? { x: [0, -50, 0], y: [0, 30, 0], opacity: [0.3, 0.6, 0.3] } : {}}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                className="absolute top-10 right-10 w-72 h-72 bg-teal-50 rounded-full blur-3xl opacity-60"
              />
            </div>

            <div className="relative z-10 flex flex-col items-start justify-center h-full">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-3">
                  {getGreeting()},{' '}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">
                    {getUserFullName()}
                  </span>
                  <motion.span
                    animate={{ rotate: [0, 14, -8, 14, -4, 10, 0, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                    className="inline-block ml-3 origin-bottom-right cursor-default"
                  >
                    👋
                  </motion.span>
                </h1>
                <p className="text-slate-500 text-base md:text-lg max-w-xl leading-relaxed mb-8">
                  Here is what's happening in your Quality Management System today.
                  {summary && summary.myPendingWorkflowActions > 0 && (
                    <>
                      {' '}You have{' '}
                      <Badge color="emerald" size="sm" className="mx-1">
                        {summary.myPendingWorkflowActions} pending action{summary.myPendingWorkflowActions !== 1 ? 's' : ''}
                      </Badge>
                      requiring attention.
                    </>
                  )}
                </p>
              </motion.div>

            </div>

            <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-4 opacity-100 pointer-events-none z-0">
              <motion.div
                animate={animReady ? { opacity: 1, x: 0, y: [0, -8, 0] } : { opacity: 0 }}
                transition={{ y: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.8 } }}
                className="p-3 bg-white/80 backdrop-blur-md rounded-xl border border-slate-100/50 flex items-center gap-3 w-48 transform translate-x-4"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="h-2.5 w-20 bg-slate-200 rounded-full mb-2" />
                  <div className="h-2 w-12 bg-slate-100 rounded-full" />
                </div>
              </motion.div>
              <motion.div
                animate={animReady ? { opacity: 1, x: 0, y: [0, 8, 0] } : { opacity: 0 }}
                transition={{ y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 } }}
                className="p-3 bg-white/80 backdrop-blur-md rounded-xl border border-slate-100/50 flex items-center gap-3 w-48 ml-12"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="h-2.5 w-24 bg-slate-200 rounded-full mb-2" />
                  <div className="h-2 w-16 bg-slate-100 rounded-full" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Quick Actions</h2>
              <p className="text-sm text-slate-500 mb-4">Common tasks and shortcuts</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.filter((a) => a.label !== 'New Document' || canCreateDocument).map((action, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-2 group',
                    'bg-white hover:border-emerald-200 border-slate-100',
                    action.border
                  )}
                >
                  <IconTile icon={<action.icon />} color={action.tile} size="md" />
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              className="group bg-white rounded-xl border border-slate-200 p-4 md:p-5 hover:border-emerald-100 transition-all cursor-default"
            >
              <div className="flex items-start justify-between mb-4">
                <IconTile icon={<stat.icon />} color={stat.tile} size="md" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  <Counter value={stat.value} />
                </h3>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Chart + Sidebar */}
        <motion.div variants={containerVariants} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Document Activity Chart */}
          <motion.div
            variants={itemVariants}
            className="xl:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
          >
            <div className="px-4 md:px-5 py-3 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <IconTile icon={<PieChart />} color="emerald" size="md" className="border border-emerald-100" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Document Activity</h3>
                  <p className="text-sm text-slate-500">Documents created over time</p>
                </div>
              </div>
              <div className="w-full md:w-36">
                <Select
                  value={chartPeriod}
                  onChange={(v) => setChartPeriod(v as 'month' | 'quarter' | 'year')}
                  options={[
                    { label: 'Monthly', value: 'month' },
                    { label: 'Quarterly', value: 'quarter' },
                    { label: 'Yearly', value: 'year' },
                  ]}
                  enableSearch={false}
                  triggerClassName="text-sm"
                />
              </div>
            </div>

            <div className="p-4 md:p-5 flex-1 min-h-[250px] md:min-h-[320px]">
              {loadingActivity || activityData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  {loadingActivity ? 'Loading...' : 'No data available'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatYAxis} dx={-10} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" fill="url(#barGradient)" radius={[8, 8, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Pending workflow actions */}
            <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 md:px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-slate-500" />
                  My Pending Actions
                </h3>
                {pendingWorkflowActions.length > 0 && (
                  <Badge color="amber" size="sm">{pendingWorkflowActions.length}</Badge>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {pendingWorkflowActions.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400 text-center">No pending actions</p>
                ) : (
                  pendingWorkflowActions.slice(0, 5).map((task) => (
                    <motion.div
                      key={task.revisionId}
                      whileHover={{ x: 4, backgroundColor: 'rgba(248,250,252,0.8)' }}
                      className="group p-4 transition-all cursor-pointer relative overflow-hidden"
                      onClick={() => navigate(`/documents/${task.documentId}/revisions/${task.revisionId}`)}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-teal-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center duration-300" />
                      <div className="relative z-10">
                        <p className="text-sm font-semibold text-slate-900 line-clamp-1">{task.documentName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{task.documentNumber}</span>
                          <Badge
                            color={task.taskType === 'REVIEW' ? 'amber' : 'blue'}
                            size="xs"
                            className="font-bold uppercase tracking-wide"
                          >
                            {task.taskType}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 md:px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-500" />
                  Recent Activity
                </h3>
              </div>
              <div className="p-4 md:p-5">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center">No recent activity</p>
                ) : (
                  <div className="relative">
                    <div className="absolute top-0 bottom-0 left-[7px] w-px bg-slate-200" />
                    <div className="space-y-5">
                      {recentActivity.slice(0, 6).map((a) => (
                        <div key={a.id} className="relative pl-8 group">
                          <div className={cn(
                            'absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ring-1 transition-all group-hover:scale-125',
                            a.actionType === 'STATUS_CHANGE' ? 'bg-emerald-500 ring-emerald-100' :
                            a.actionType === 'CREATE' ? 'bg-blue-500 ring-blue-100' :
                            'bg-slate-400 ring-slate-100'
                          )} />
                          <p className="text-sm text-slate-900 font-medium line-clamp-1 group-hover:text-emerald-700 transition-colors">
                            {a.entityName || a.entityCode || a.entityType}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {a.action} · {ENTITY_TYPE_LABEL[a.entityType] ?? a.entityType} · {formatTimeAgo(a.eventTime)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

    </>
  );
};
