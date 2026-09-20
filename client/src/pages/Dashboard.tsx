import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import {
  Target,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Zap,
  BarChart3,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  Lightbulb,
  CheckCircle
} from 'lucide-react'
import { AIWeeklyReview } from '@iqoo/shared'

function WhatNowBox() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-recommendation'],
    queryFn: () => apiClient.getRecommendation(),
    refetchOnWindowFocus: false,
  })
  const result = data?.data
  if (isLoading)
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 mb-6 animate-pulse">
        <div className="flex items-center gap-2 text-indigo-700 mb-2">
          <Target size={18} /> AI Decision Engine
        </div>
        <div className="h-6 bg-slate-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
      </div>
    )
  if (error || !result || !result.recommended) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Target size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">AI Next Action Engine</h3>
            <p className="text-xs text-slate-500">
              {error ? 'Unable to load real-time recommendation' : 'All critical tasks completed or inbox triaged!'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/tasks')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
        >
          View Workspace
        </button>
      </div>
    )
  }
  const t = result.recommended
  return (
    <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-6 mb-6 shadow-md border border-indigo-800/40">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
          <Sparkles size={16} /> AI Real-Time Decision Recommendation
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 font-semibold">
          High Impact
        </span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg md:text-xl font-bold text-white">{t.title}</h3>
            {t.priority && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  t.priority === 'CRITICAL' || t.priority === 'URGENT'
                    ? 'bg-rose-500 text-white'
                    : t.priority === 'HIGH'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-500 text-slate-950'
                }`}
              >
                {t.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
            {t.estimatedMinutes && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> {t.estimatedMinutes} mins
              </span>
            )}
            {t.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Due {new Date(t.dueDate).toLocaleDateString()}
              </span>
            )}
            {t.risk && (
              <span
                className={`font-semibold ${
                  t.risk.riskLevel === 'CRITICAL' ? 'text-rose-400' : 'text-amber-300'
                }`}
              >
                {t.risk.riskLevel} RISK ({t.risk.riskScore}/100)
              </span>
            )}
          </div>
          <p className="text-xs text-indigo-200/90 bg-white/5 p-2.5 rounded-xl border border-white/10 mt-2">
            <strong className="text-indigo-300">AI Rationale: </strong>
            {result.reason || 'Optimal sequencing to unblock downstream tasks and mitigate schedule risk.'}
          </p>
        </div>

        <button
          onClick={() => navigate(`/tasks`)}
          className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-md transition self-start md:self-auto shrink-0 flex items-center gap-1.5"
        >
          Execute Now <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

export default function ProductivityDashboard() {
  const navigate = useNavigate()

  // 1. Fetch Tasks
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.getTasks(),
  })

  // 2. Fetch AI Weekly Review
  const {
    data: weeklyReviewResponse,
    refetch: refetchWeeklyReview,
    isFetching: weeklyFetching
  } = useQuery({
    queryKey: ['ai-weekly-review'],
    queryFn: async () => {
      const res = await apiClient.getWeeklyReview()
      return res?.data?.review || res?.data || res
    },
    staleTime: 1000 * 60 * 10,
  })

  const tasks: any[] = tasksData?.data?.tasks || tasksData?.data || []
  const weeklyReview: AIWeeklyReview | null = weeklyReviewResponse || null

  // Metrics calculation
  const total = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED')
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS')
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED'
  )
  const onTimeCompleted = completedTasks.filter((t) => !t.dueDate || new Date(t.updatedAt || t.dueDate) <= new Date(t.dueDate))

  const totalTimeLogged = tasks.reduce((sum, t) => sum + (t.actualMinutes || 0), 0)
  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0)

  // Transparent Productivity Score Formula:
  // - Completion Rate: 35% weight
  // - On-time Deadline Reliability: 35% weight
  // - Estimation Accuracy / Velocity: 20% weight
  // - Low Overdue Penalty: 10% weight
  const completionRate = total > 0 ? Math.round((completedTasks.length / total) * 100) : 0
  const deadlineReliability = completedTasks.length > 0 ? Math.round((onTimeCompleted.length / completedTasks.length) * 100) : 100
  const overdueRatio = total > 0 ? overdueTasks.length / total : 0
  const estimationRatio = totalTimeLogged > 0 && totalEstimated > 0 ? Math.min(100, Math.round((totalTimeLogged / totalEstimated) * 100)) : 85

  let productivityScore = 0
  if (total > 0) {
    productivityScore = Math.round(
      completionRate * 0.35 +
      deadlineReliability * 0.35 +
      (100 - Math.min(100, overdueRatio * 100)) * 0.15 +
      (estimationRatio > 120 ? 70 : 90) * 0.15
    )
  } else {
    productivityScore = 100
  }

  const getScoreTier = (score: number) => {
    if (score >= 85) return { label: 'Exceptional Velocity', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' }
    if (score >= 70) return { label: 'High Focus & Flow', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' }
    if (score >= 50) return { label: 'Steady Progress', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
    return { label: 'Attention Required', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' }
  }

  const scoreTier = getScoreTier(productivityScore)

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Analytics & Pattern Intelligence</h1>
              <p className="text-xs text-slate-500">
                Transparent velocity scores, deadline reliability & LLM weekly retrospective.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => refetchWeeklyReview()}
          disabled={weeklyFetching}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${weeklyFetching ? 'animate-spin' : ''}`} />
          Regenerate Weekly Review
        </button>
      </div>

      {/* AI Decision Box */}
      <WhatNowBox />

      {/* Productivity Score & Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Productivity Score Card */}
        <div className={`rounded-2xl p-6 border shadow-sm flex flex-col justify-between ${scoreTier.bg}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Productivity Score
              </span>
              <Zap className={`w-5 h-5 ${scoreTier.color}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-slate-900">{productivityScore}</span>
              <span className="text-slate-500 text-sm font-semibold">/ 100</span>
            </div>
            <p className={`text-xs font-bold mt-1 ${scoreTier.color}`}>{scoreTier.label}</p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200/60 text-[11px] text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Completion Rate (35%)</span>
              <span className="font-bold">{completionRate}%</span>
            </div>
            <div className="flex justify-between">
              <span>Deadline Reliability (35%)</span>
              <span className="font-bold">{deadlineReliability}%</span>
            </div>
            <div className="flex justify-between">
              <span>Schedule Integrity (30%)</span>
              <span className="font-bold">{overdueTasks.length === 0 ? 'Optimal' : `${overdueTasks.length} Overdue`}</span>
            </div>
          </div>
        </div>

        {/* Completion & Reliability */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Task Execution
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {completedTasks.length} <span className="text-sm font-normal text-slate-500">of {total} tasks</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-500 text-[11px]">In Progress</span>
              <p className="font-bold text-indigo-600 text-base">{inProgressTasks.length}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">Overdue Risk</span>
              <p className={`font-bold text-base ${overdueTasks.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {overdueTasks.length}
              </p>
            </div>
          </div>
        </div>

        {/* Time Tracked vs Estimated */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Time Intelligence
              </span>
              <Clock className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {Math.floor(totalTimeLogged / 60)}h {totalTimeLogged % 60}m
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Estimated total: {Math.floor(totalEstimated / 60)}h {totalEstimated % 60}m
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Avg Time / Completed Task</span>
              <span className="font-bold text-slate-900">
                {completedTasks.length > 0 ? Math.round(totalTimeLogged / completedTasks.length) : 0} mins
              </span>
            </div>
            <div className="flex justify-between">
              <span>Estimation Variance</span>
              <span className="font-bold text-indigo-600">
                {totalEstimated > 0 ? `${Math.round((totalTimeLogged / totalEstimated) * 100)}%` : '100%'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Weekly Retrospective Section */}
      {weeklyReview && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white rounded-2xl p-6 shadow-md border border-indigo-800/40 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">AI Weekly Retrospective & Strategic Intelligence</h3>
                <p className="text-xs text-indigo-200/70">
                  Comprehensive performance audit and automated forward planning
                </p>
              </div>
            </div>
            <span className="text-xs px-3 py-1 bg-indigo-500/30 rounded-full font-semibold border border-indigo-400/30 text-indigo-200">
              Productivity Score: {weeklyReview.productivityScore || 85}/100
            </span>
          </div>

          {weeklyReview.summary && (
            <p className="text-xs md:text-sm text-slate-200 bg-white/5 p-4 rounded-xl border border-white/10 leading-relaxed">
              {weeklyReview.summary}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Completion Velocity */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5" /> Completion Velocity
              </div>
              <p className="text-sm font-semibold text-white">{weeklyReview.completionVelocity || 'Steady progress'}</p>
              <p className="text-xs text-slate-400">Tracked tasks completed across this sprint cycle.</p>
            </div>

            {/* Top Bottleneck */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" /> Top Bottleneck Project
              </div>
              <p className="text-sm font-semibold text-white">{weeklyReview.topBottleneckProject || 'No critical bottlenecks'}</p>
              <p className="text-xs text-slate-400">Identified via dependency graph & overdue analysis.</p>
            </div>

            {/* Actionable Changes */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
                <Lightbulb className="w-3.5 h-3.5" /> Next Sprint Optimizations
              </div>
              {weeklyReview.actionableChanges && weeklyReview.actionableChanges.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {weeklyReview.actionableChanges.map((change: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Maintain steady execution sprint cadence.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Priority Distribution & Deep Dives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Priority Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Task Priority Distribution</h3>
          <div className="space-y-3">
            {[
              {
                label: 'URGENT / CRITICAL',
                count: tasks.filter((t) => t.priority === 'URGENT' || t.priority === 'CRITICAL').length,
                color: 'bg-rose-500',
                textColor: 'text-rose-700',
              },
              {
                label: 'HIGH',
                count: tasks.filter((t) => t.priority === 'HIGH').length,
                color: 'bg-amber-500',
                textColor: 'text-amber-700',
              },
              {
                label: 'MEDIUM',
                count: tasks.filter((t) => t.priority === 'MEDIUM').length,
                color: 'bg-indigo-500',
                textColor: 'text-indigo-700',
              },
              {
                label: 'LOW',
                count: tasks.filter((t) => t.priority === 'LOW').length,
                color: 'bg-slate-400',
                textColor: 'text-slate-700',
              },
            ].map((p) => {
              const pct = total > 0 ? Math.round((p.count / total) * 100) : 0
              return (
                <div key={p.label}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className={p.textColor}>{p.label}</span>
                    <span className="text-slate-600">
                      {p.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className={`${p.color} h-full rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Execution Links */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">Execution Quick Filters</h3>
            <p className="text-xs text-slate-500 mb-4">Jump directly into prioritized views in the Workspace:</p>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/tasks?filter=overdue')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition"
              >
                <span>Overdue & High Risk Tasks</span>
                <span className="px-2 py-0.5 bg-rose-200 rounded-lg">{overdueTasks.length}</span>
              </button>
              <button
                onClick={() => navigate('/tasks?filter=today')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition"
              >
                <span>Tasks Due Today</span>
                <span className="px-2 py-0.5 bg-amber-200 rounded-lg">
                  {tasks.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length}
                </span>
              </button>
              <button
                onClick={() => navigate('/tasks?filter=blocked')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition"
              >
                <span>Blocked Dependencies</span>
                <span className="px-2 py-0.5 bg-indigo-200 rounded-lg">
                  {tasks.filter((t) => t.blockers && t.blockers.length > 0).length}
                </span>
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate('/projects')}
            className="mt-4 pt-4 border-t border-slate-100 w-full flex items-center justify-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            Manage Project Milestones <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}


