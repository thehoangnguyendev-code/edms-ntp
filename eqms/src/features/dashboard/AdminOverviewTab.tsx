import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  ShieldCheck,
  Activity,
  TrendingUp,
  UserCheck,
  UserX,
  Clock,
  GitBranch,
  BookOpen,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { cn } from "@/components/ui/utils";
import { Badge } from "@/components/ui/badge/Badge";
import { dashboardApi, type DashboardAdminStats } from "@/services/api/dashboard";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; badgeColor: "emerald" | "slate" | "red" | "amber" }> = {
  EFFECTIVE:  { label: "Effective",  color: "#10b981", badgeColor: "emerald" },
  DRAFT:      { label: "Draft",      color: "#94a3b8", badgeColor: "slate"   },
  OBSOLETE:   { label: "Obsolete",   color: "#f59e0b", badgeColor: "amber"   },
  CANCELLED:  { label: "Cancelled",  color: "#ef4444", badgeColor: "red"     },
};

const REV_STATUS_CONFIG: Record<string, { label: string; color: "amber" | "blue" | "purple" | "slate" }> = {
  PENDING_REVIEW:       { label: "Pending Review",    color: "amber"  },
  PENDING_APPROVAL:     { label: "Pending Approval",  color: "blue"   },
  PENDING_TRAINING:     { label: "Pending Training",  color: "purple" },
  READY_FOR_PUBLISHING: { label: "Ready to Publish",  color: "slate"  },
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  iconBg: string;
  iconColor: string;
  delay?: number;
}) => (
  <motion.div
    variants={itemVariants}
    transition={{ delay }}
    whileHover={{ y: -4, scale: 1.02 }}
    className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 hover:border-emerald-100 hover:shadow-sm transition-all"
  >
    <div className="flex items-start justify-between mb-3">
      <div className={cn("p-2.5 rounded-lg", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
    </div>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
    <p className="text-sm font-medium text-slate-500 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </motion.div>
);

const CustomBarTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
        <p className="text-xs font-semibold text-slate-700">{payload[0].payload.label}</p>
        <p className="text-xs text-slate-500">{payload[0].value} events</p>
      </div>
    );
  }
  return null;
};

const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
    <div className="h-10 w-10 rounded-lg bg-slate-100 mb-3" />
    <div className="h-7 w-16 bg-slate-100 rounded mb-2" />
    <div className="h-4 w-24 bg-slate-100 rounded" />
  </div>
);

export const AdminOverviewTab: React.FC = () => {
  const [stats, setStats] = useState<DashboardAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    dashboardApi
      .getAdminStats()
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
          <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        Failed to load admin stats. Please try again.
      </div>
    );
  }

  const docStatusData = Object.entries(stats.documentsByStatus).map(([key, value]) => ({
    label: DOC_STATUS_CONFIG[key]?.label ?? key,
    value,
    color: DOC_STATUS_CONFIG[key]?.color ?? "#94a3b8",
    key,
  }));

  const totalInFlight = Object.values(stats.revisionsByStatus).reduce((a, b) => a + b, 0);
  const activeRate = stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;

  return (
    <motion.div
      className="space-y-6 pt-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Users}      label="Total Users"         value={stats.totalUsers}               iconBg="bg-blue-50"   iconColor="text-blue-600"   sub={`${activeRate}% active`} />
        <StatCard icon={UserCheck}  label="Active Users"        value={stats.activeUsers}              iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard icon={UserX}      label="Inactive Users"      value={stats.inactiveUsers}            iconBg="bg-slate-50"  iconColor="text-slate-500"  />
        <StatCard icon={FileText}   label="Total Documents"     value={stats.totalDocuments}           iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatCard icon={GitBranch}  label="Revisions In-flight" value={totalInFlight}                  iconBg="bg-amber-50"  iconColor="text-amber-600"  sub="active workflow steps" />
      </div>

      {/* Audit activity chart + Document status breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Audit activity chart */}
        <motion.div
          variants={itemVariants}
          className="xl:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col"
        >
          <div className="p-4 md:p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-violet-50 border border-violet-100 rounded-lg">
              <Activity className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Audit Activity — Last 30 Days</h3>
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">{stats.auditEventsLast30Days.toLocaleString()}</span> total events
              </p>
            </div>
          </div>
          <div className="p-4 md:p-5 flex-1 min-h-[220px] md:min-h-[280px]">
            {stats.auditActivityByDay.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.auditActivityByDay} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <defs>
                    <linearGradient id="auditGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} dy={8} interval="preserveStartEnd" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} dx={-8} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(124,58,237,0.06)" }} />
                  <Bar dataKey="value" fill="url(#auditGrad)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Document status breakdown */}
        <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 md:p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Documents by Status</h3>
              <p className="text-sm text-slate-500">{stats.totalDocuments.toLocaleString()} total</p>
            </div>
          </div>
          <div className="p-4 md:p-5 flex-1 space-y-3">
            {docStatusData.map(({ key, label, value, color }) => {
              const pct = stats.totalDocuments > 0 ? Math.round((value / stats.totalDocuments) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-slate-700">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{value.toLocaleString()}</span>
                      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Revisions in-flight + System health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revisions by workflow status */}
        <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 md:p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Revisions In-flight</h3>
              <p className="text-sm text-slate-500">Active workflow steps</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {Object.entries(stats.revisionsByStatus).map(([key, count]) => {
              const cfg = REV_STATUS_CONFIG[key];
              if (!cfg) return null;
              return (
                <motion.div
                  key={key}
                  whileHover={{ x: 3, backgroundColor: "rgba(248,250,252,0.9)" }}
                  className="flex items-center justify-between px-4 md:px-5 py-3 transition-all"
                >
                  <span className="text-sm font-medium text-slate-700">{cfg.label}</span>
                  <Badge color={cfg.color} size="sm">{count}</Badge>
                </motion.div>
              );
            })}
            {totalInFlight === 0 && (
              <p className="px-5 py-4 text-sm text-slate-400">No revisions currently in workflow</p>
            )}
          </div>
        </motion.div>

        {/* System health snapshot */}
        <motion.div variants={itemVariants} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 md:p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">System Health</h3>
              <p className="text-sm text-slate-500">At a glance</p>
            </div>
          </div>
          <div className="p-4 md:p-5 space-y-4">
            {[
              {
                icon: Users,
                label: "User activation rate",
                value: `${activeRate}%`,
                sub: `${stats.activeUsers} of ${stats.totalUsers} users active`,
                color: activeRate >= 80 ? "text-emerald-600" : "text-amber-600",
                bg: activeRate >= 80 ? "bg-emerald-50" : "bg-amber-50",
              },
              {
                icon: Activity,
                label: "Audit events (30d)",
                value: stats.auditEventsLast30Days.toLocaleString(),
                sub: "System-wide tracked actions",
                color: "text-violet-600",
                bg: "bg-violet-50",
              },
              {
                icon: Clock,
                label: "Revisions awaiting action",
                value: totalInFlight,
                sub: "Across review, approval & training",
                color: totalInFlight > 0 ? "text-amber-600" : "text-emerald-600",
                bg: totalInFlight > 0 ? "bg-amber-50" : "bg-emerald-50",
              },
              {
                icon: FileText,
                label: "Effective documents",
                value: (stats.documentsByStatus["EFFECTIVE"] ?? 0).toLocaleString(),
                sub: `of ${stats.totalDocuments.toLocaleString()} total`,
                color: "text-blue-600",
                bg: "bg-blue-50",
              },
            ].map(({ icon: Icon, label, value, sub, color, bg }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg shrink-0", bg)}>
                  <Icon className={cn("h-4 w-4", color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700 truncate">{label}</p>
                    <p className={cn("text-sm font-bold shrink-0", color)}>{value}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
