import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import {
  Brain,
  Calendar,
  AlertCircle,
  Sparkles,
  Clock,
  ShieldAlert,
  Play,
  CheckCircle2,
  Mic,
  Send,
  Lock,
  ChevronRight,
} from 'lucide-react'
import { FocusSessionModal } from '../components/FocusSessionModal'
import { AdvancedVoiceCapture } from '../components/AdvancedVoiceCapture'

export default function HomePage() {
  const navigate = useNavigate()
  const [quickInput, setQuickInput] = useState('')
  const [showVoice, setShowVoice] = useState(false)
  const [activeFocusTask, setActiveFocusTask] = useState<{ id: string; title: string } | null>(null)

  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.getTasks(),
  })

  const { data: recData, isLoading: recLoading } = useQuery({
    queryKey: ['ai-recommendation'],
    queryFn: () => apiClient.getRecommendation(),
    refetchOnWindowFocus: false,
  })

  const { data: briefingData } = useQuery({
    queryKey: ['daily-briefing'],
    queryFn: () => apiClient.getDailyBriefing(),
    refetchOnWindowFocus: false,
  })

  const tasks = tasksData?.data?.tasks || []
  const recommendation = recData?.data
  const briefing = briefingData?.data

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const dueTodayTasks = tasks.filter((t: any) => {
    if (!t.deadline) return false
    const d = typeof t.deadline === 'string' ? t.deadline : new Date(t.deadline).toISOString()
    return d.startsWith(todayStr) && t.status !== 'COMPLETED'
  })

  const overdueTasks = tasks.filter((t: any) => {
    if (!t.deadline) return false
    return new Date(t.deadline) < now && t.status !== 'COMPLETED'
  })

  const blockedTasks = tasks.filter((t: any) => {
    return t.isBlocked && t.status !== 'COMPLETED'
  })

  const totalEstMins = tasks
    .filter((t: any) => t.status !== 'COMPLETED')
    .reduce((sum: number, t: any) => sum + (t.estimatedMinutes || 30), 0)
  const totalWorkHours = (totalEstMins / 60).toFixed(1)

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickInput.trim()) return
    navigate('/ai', { state: { initialPrompt: quickInput } })
  }

  if (tasksLoading || recLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading your AI command center...</p>
        </div>
      </div>
    )
  }

  const topTask = recommendation?.recommended

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
      {/* 1. Header & Quick Natural Language Capture */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Personal Command Center
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              Autonomous daily intelligence & execution workspace
            </p>
          </div>
          <button
            onClick={() => navigate('/ai')}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 transition"
          >
            <Sparkles size={14} /> Open AI Copilot
          </button>
        </div>

        {/* Quick Natural Language Command Input */}
        <form
          onSubmit={handleQuickCapture}
          className="relative flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all p-1.5"
        >
          <button
            type="button"
            onClick={() => setShowVoice(true)}
            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
            title="Voice Capture"
          >
            <Mic size={18} />
          </button>
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Tell AI what to plan, schedule, or create (e.g. 'Plan my React project for this week')..."
            className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="p-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 rounded-xl transition flex items-center justify-center shadow-sm"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* 2. AI Daily Executive Briefing */}
      {briefing && (
        <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 md:p-6 shadow-sm border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Brain size={18} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  AI Daily Executive Briefing
                </span>
                <span className="text-[11px] text-slate-400">
                  {briefing.isFallback ? 'Deterministic Fallback' : 'OpenAI Reasoning'}
                </span>
              </div>
              <p className="text-sm md:text-base font-medium leading-relaxed text-slate-200">
                {briefing.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. AI Next Action Card */}
      <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-sky-50 border border-indigo-200/80 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
            <Sparkles size={15} /> AI Next Action
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
            Top Priority Recommendation
          </span>
        </div>

        {topTask ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg md:text-xl font-bold text-slate-900">
                {topTask.title}
              </h2>
              {topTask.priority && (
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  topTask.priority === 'CRITICAL' ? 'bg-red-500 text-white' :
                  topTask.priority === 'HIGH' ? 'bg-orange-500 text-white' :
                  topTask.priority === 'MEDIUM' ? 'bg-amber-400 text-slate-900' : 'bg-emerald-400 text-slate-900'
                }`}>
                  {topTask.priority}
                </span>
              )}
              {topTask.estimatedMinutes && (
                <span className="text-xs font-medium text-slate-500 bg-white/80 border border-slate-200 px-2 py-0.5 rounded">
                  ⏱ {topTask.estimatedMinutes}m
                </span>
              )}
            </div>

            <div className="p-3 bg-white/90 rounded-xl border border-indigo-100 text-xs space-y-1.5 text-slate-700">
              <p>
                <strong className="text-indigo-900">Why this task: </strong>
                {recommendation?.whyThisTask || recommendation?.reason}
              </p>
              {recommendation?.riskIfDelayed && (
                <p>
                  <strong className="text-amber-800">Consequence if delayed: </strong>
                  {recommendation.riskIfDelayed}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setActiveFocusTask({ id: topTask.id, title: topTask.title })}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <Play size={14} /> Start Focus Session
              </button>
              <button
                onClick={() => navigate(`/tasks/${topTask.id}`)}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Open Task Detail
              </button>
              <button
                onClick={() => navigate('/ai', { state: { initialPrompt: `Why is "${topTask.title}" recommended right now and how should I approach it?` } })}
                className="px-3.5 py-2 text-indigo-700 hover:bg-indigo-100/50 rounded-xl text-xs font-medium transition"
              >
                Ask AI Why?
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600">
            {recommendation?.reason || 'No actionable tasks right now. Capture your goals to get an AI action plan!'}
          </div>
        )}
      </div>

      {/* 4. Today at a Glance Radar */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Today at a Glance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Due Today */}
          <div
            onClick={() => navigate('/tasks?filter=today')}
            className="cursor-pointer bg-white hover:border-blue-300 border border-slate-200 rounded-2xl p-4 transition-all shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between text-blue-600 mb-1">
              <Calendar size={18} />
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{dueTodayTasks.length}</p>
            <p className="text-xs font-medium text-slate-500">Due Today</p>
          </div>

          {/* Overdue */}
          <div
            onClick={() => navigate('/tasks?filter=overdue')}
            className="cursor-pointer bg-white hover:border-red-300 border border-slate-200 rounded-2xl p-4 transition-all shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between text-red-600 mb-1">
              <AlertCircle size={18} />
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
            <p className="text-xs font-medium text-slate-500">Overdue Tasks</p>
          </div>

          {/* Blocked Tasks */}
          <div
            onClick={() => navigate('/tasks?filter=blocked')}
            className="cursor-pointer bg-white hover:border-amber-300 border border-slate-200 rounded-2xl p-4 transition-all shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between text-amber-600 mb-1">
              <Lock size={18} />
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-amber-600">{blockedTasks.length}</p>
            <p className="text-xs font-medium text-slate-500">Blocked Tasks</p>
          </div>

          {/* Workload Hours */}
          <div
            onClick={() => navigate('/dashboard')}
            className="cursor-pointer bg-white hover:border-indigo-300 border border-slate-200 rounded-2xl p-4 transition-all shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between text-indigo-600 mb-1">
              <Clock size={18} />
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-indigo-600">{totalWorkHours}h</p>
            <p className="text-xs font-medium text-slate-500">Est. Workload</p>
          </div>
        </div>
      </div>

      {/* 5. Focus Plan & Deadlines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Focus Plan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-600" /> AI Execution Sequence
            </h3>
            <button
              onClick={() => navigate('/ai', { state: { initialPrompt: 'Plan my afternoon with optimal time blocks' } })}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              Modify Plan
            </button>
          </div>

          {briefing?.suggestedSchedule && briefing.suggestedSchedule.length > 0 ? (
            <div className="space-y-2">
              {briefing.suggestedSchedule.map((block: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900">{block.taskTitle}</p>
                    <span className="text-slate-500 font-mono text-[11px]">{block.timeSlot}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-medium rounded text-[11px]">
                    {block.durationMinutes}m
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">
              No schedule blocks generated yet.
            </p>
          )}
        </div>

        {/* Approaching Deadlines Radar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-500" /> Deadline Radar
            </h3>
            <button
              onClick={() => navigate('/tasks')}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View All Tasks
            </button>
          </div>

          {overdueTasks.length > 0 || dueTodayTasks.length > 0 ? (
            <div className="space-y-2">
              {overdueTasks.slice(0, 2).map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  className="cursor-pointer flex items-center justify-between p-2.5 bg-red-50/70 border border-red-200 rounded-xl text-xs hover:bg-red-50 transition"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-red-950">{t.title}</p>
                    <p className="text-red-600 text-[11px]">Overdue • Due {new Date(t.deadline).toLocaleDateString()}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-red-600 text-white font-bold rounded text-[10px]">
                    CRITICAL
                  </span>
                </div>
              ))}
              {dueTodayTasks.slice(0, 2).map((t: any) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/tasks/${t.id}`)}
                  className="cursor-pointer flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs hover:bg-blue-50 transition"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-blue-950">{t.title}</p>
                    <p className="text-blue-600 text-[11px]">Due Today</p>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-medium rounded text-[10px]">
                    TODAY
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-emerald-600 font-medium flex flex-col items-center gap-1">
              <CheckCircle2 size={24} />
              <span>All deadlines are on track!</span>
            </div>
          )}
        </div>
      </div>

      {/* Focus Session Modal */}
      {activeFocusTask && (
        <FocusSessionModal
          taskId={activeFocusTask.id}
          taskTitle={activeFocusTask.title}
          onClose={() => {
            setActiveFocusTask(null)
            refetchTasks()
          }}
        />
      )}

      {/* Voice Modal */}
      {showVoice && (
        <AdvancedVoiceCapture
          onClose={() => setShowVoice(false)}
          onSuccess={(result) => {
            setShowVoice(false)
            if (result?.data?.rawContent) {
              navigate('/ai', { state: { initialPrompt: result.data.rawContent } })
            }
          }}
        />
      )}
    </div>
  )
}
