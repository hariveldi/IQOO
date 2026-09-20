import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import {
  Plus,
  Search,
  CheckCircle,
  Clock,
  Flag,
  Lock,
  Sparkles,
  Play,
  Scissors,
  HelpCircle,
  Calendar,
} from 'lucide-react'
import { TaskForm } from '../components/TaskForm'
import { FocusSessionModal } from '../components/FocusSessionModal'

export default function TasksPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const initialFilter = searchParams.get('filter') || 'ALL'
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter.toUpperCase())
  const [search, setSearch] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('AI_RECOMMENDED')

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [activeFocusTask, setActiveFocusTask] = useState<{ id: string; title: string } | null>(null)
  const [breakdownModal, setBreakdownModal] = useState<any | null>(null)
  const [breakdownLoading, setBreakdownLoading] = useState<string | null>(null)

  useEffect(() => {
    const qFilter = searchParams.get('filter')
    if (qFilter) {
      setActiveFilter(qFilter.toUpperCase())
    }
  }, [searchParams])

  const { data: tasksData, isLoading, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.getTasks(),
  })

  const tasks = tasksData?.data?.tasks || []
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Filter logic
  const filteredTasks = useMemo(() => {
    let result = tasks.filter((task: any) => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.description?.toLowerCase().includes(search.toLowerCase()) ||
        task.project?.name?.toLowerCase().includes(search.toLowerCase())
      if (!matchesSearch) return false

      const isCompleted = task.status === 'COMPLETED'
      const isOverdue = task.deadline && new Date(task.deadline) < now && !isCompleted
      const isDueToday = task.deadline && new Date(task.deadline).toISOString().startsWith(todayStr) && !isCompleted
      const isBlocked = task.isBlocked && !isCompleted
      const hasNoDeadline = !task.deadline && !isCompleted

      switch (activeFilter) {
        case 'DUE_TODAY':
        case 'TODAY':
          return isDueToday
        case 'OVERDUE':
          return isOverdue
        case 'UPCOMING':
          return task.deadline && new Date(task.deadline) > now && !isCompleted
        case 'BLOCKED':
          return isBlocked
        case 'HIGH_RISK':
          return !isCompleted && (task.priority === 'CRITICAL' || isOverdue || isBlocked)
        case 'NO_DEADLINE':
          return hasNoDeadline
        case 'TODO':
          return task.status === 'TODO'
        case 'IN_PROGRESS':
          return task.status === 'IN_PROGRESS'
        case 'COMPLETED':
          return isCompleted
        case 'ALL':
        default:
          return true
      }
    })

    // Sort logic
    return result.sort((a: any, b: any) => {
      if (sortBy === 'AI_RECOMMENDED') {
        // Priority weight + deadline urgency - blocker penalty
        const getScore = (t: any) => {
          if (t.status === 'COMPLETED') return -100
          let score = t.priority === 'CRITICAL' ? 80 : t.priority === 'HIGH' ? 60 : t.priority === 'MEDIUM' ? 40 : 20
          if (t.isBlocked) score -= 30
          if (t.deadline) {
            const diffHours = (new Date(t.deadline).getTime() - now.getTime()) / (1000 * 60 * 60)
            if (diffHours < 0) score += 50 // overdue
            else if (diffHours < 24) score += 30 // due today
            else if (diffHours < 72) score += 15
          }
          return score
        }
        return getScore(b) - getScore(a)
      } else if (sortBy === 'DEADLINE') {
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      } else if (sortBy === 'PRIORITY') {
        const order: any = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
        return (order[b.priority] || 0) - (order[a.priority] || 0)
      } else if (sortBy === 'ESTIMATE') {
        return (a.estimatedMinutes || 30) - (b.estimatedMinutes || 30)
      }
      return 0
    })
  }, [tasks, search, activeFilter, sortBy, now, todayStr])

  const handleComplete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await apiClient.completeTask(taskId)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['ai-recommendation'] })
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  const handleBreakdown = async (task: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setBreakdownLoading(task.id)
    try {
      const res = await apiClient.breakdownTask(task.title, task.description)
      setBreakdownModal({ task, breakdown: res.data })
    } catch (err: any) {
      alert(`AI Breakdown failed: ${err?.message || 'Error'}`)
    } finally {
      setBreakdownLoading(null)
    }
  }

  const handleEstimate = async (task: any, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await apiClient.estimateDuration(task.title, task.description)
      if (res?.data?.estimatedMinutes) {
        await apiClient.updateTask(task.id, { estimatedMinutes: res.data.estimatedMinutes })
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      }
    } catch (err) {
      console.error('Failed to estimate task:', err)
    }
  }

  const handleAcceptBreakdown = async () => {
    if (!breakdownModal?.breakdown?.actions) return
    try {
      await apiClient.executeAIActions(breakdownModal.breakdown.actions)
      setBreakdownModal(null)
      refetch()
    } catch (err: any) {
      alert(`Failed to save subtasks: ${err?.message || 'Error'}`)
    }
  }

  const filterTabs = [
    { id: 'ALL', label: 'All' },
    { id: 'TODAY', label: 'Due Today' },
    { id: 'OVERDUE', label: 'Overdue' },
    { id: 'BLOCKED', label: 'Blocked' },
    { id: 'HIGH_RISK', label: 'High Risk' },
    { id: 'UPCOMING', label: 'Upcoming' },
    { id: 'NO_DEADLINE', label: 'No Deadline' },
    { id: 'TODO', label: 'To Do' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
    { id: 'COMPLETED', label: 'Completed' },
  ]

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Execution Workspace
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Intelligent task prioritization, risk monitoring, and AI subtask breakdown
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null)
            setShowTaskForm(true)
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Search & Sort Row */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, description, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-medium text-slate-500 shrink-0">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="AI_RECOMMENDED">⚡ AI Recommended</option>
            <option value="DEADLINE">📅 Deadline (Urgent first)</option>
            <option value="PRIORITY">🚩 Priority (Critical first)</option>
            <option value="ESTIMATE">⏱ Duration (Shortest first)</option>
          </select>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveFilter(tab.id)
              setSearchParams({ filter: tab.id.toLowerCase() })
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeFilter === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-xs">Loading tasks...</div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task: any) => {
            const isCompleted = task.status === 'COMPLETED'
            const isOverdue = task.deadline && new Date(task.deadline) < now && !isCompleted
            const isBlocked = task.isBlocked && !isCompleted

            return (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isOverdue
                    ? 'border-red-200 bg-red-50/20'
                    : isBlocked
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Left: Checkbox + Title + Metadata */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    onClick={(e) => handleComplete(task.id, e)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 hover:border-blue-500 bg-white'
                    }`}
                  >
                    {isCompleted && <CheckCircle size={14} />}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-bold text-slate-900 line-clamp-1 ${
                          isCompleted ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.priority && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            task.priority === 'CRITICAL'
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : task.priority === 'HIGH'
                              ? 'bg-orange-100 text-orange-700 border border-orange-200'
                              : task.priority === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {task.priority}
                        </span>
                      )}
                      {task.project?.name && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                          📁 {task.project.name}
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-1">{task.description}</p>
                    )}

                    {/* Dependencies / Blockers info */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 flex-wrap">
                      {isBlocked && (
                        <span className="text-amber-700 font-semibold flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded">
                          <Lock size={11} /> Blocked by prerequisites
                        </span>
                      )}
                      {task.unblocks && task.unblocks.length > 0 && !isCompleted && (
                        <span className="text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded">
                          🔓 Unblocks {task.unblocks.length} task(s)
                        </span>
                      )}
                      {task.deadline && (
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            isOverdue ? 'text-red-600 font-bold' : 'text-slate-600'
                          }`}
                        >
                          <Calendar size={12} />
                          {isOverdue ? 'Overdue: ' : 'Due: '}
                          {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-slate-500 font-mono">
                        <Clock size={12} /> {task.estimatedMinutes || 30}m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                  {!isCompleted && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveFocusTask({ id: task.id, title: task.title })
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                        title="Start Focus Timer"
                      >
                        <Play size={15} />
                      </button>
                      <button
                        onClick={(e) => handleBreakdown(task, e)}
                        disabled={breakdownLoading === task.id}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-xl transition"
                        title="Break Down with AI"
                      >
                        <Scissors size={15} />
                      </button>
                      <button
                        onClick={(e) => handleEstimate(task, e)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition"
                        title="Estimate Time with AI"
                      >
                        <Sparkles size={15} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate('/ai', {
                        state: {
                          initialPrompt: `How should I execute "${task.title}"? Context: ${task.description || 'none'}, priority ${task.priority}, estimated ${task.estimatedMinutes}m.`,
                        },
                      })
                    }}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                    title="Ask AI about this task"
                  >
                    <HelpCircle size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <Flag size={32} className="mx-auto text-slate-300" />
          <h3 className="text-sm font-bold text-slate-800">No tasks in this view</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All clear for now or no tasks match this filter. Create a new task or capture your goals with AI.
          </p>
          <button
            onClick={() => {
              setEditingTask(null)
              setShowTaskForm(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
          >
            Create Task
          </button>
        </div>
      )}

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          initialData={editingTask}
          onClose={() => setShowTaskForm(false)}
          onSuccess={() => {
            setShowTaskForm(false)
            refetch()
          }}
        />
      )}

      {/* Focus Timer Modal */}
      {activeFocusTask && (
        <FocusSessionModal
          taskId={activeFocusTask.id}
          taskTitle={activeFocusTask.title}
          onClose={() => {
            setActiveFocusTask(null)
            refetch()
          }}
        />
      )}

      {/* AI Breakdown Review Modal */}
      {breakdownModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scissors size={18} className="text-purple-600" /> AI Subtask Breakdown
              </h3>
              <span className="text-xs text-slate-400">
                {breakdownModal.breakdown.isFallback ? 'Deterministic Fallback' : 'OpenAI Reasoning'}
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Decomposed <strong>"{breakdownModal.task.title}"</strong> into actionable execution steps:
            </p>

            <div className="space-y-2">
              {breakdownModal.breakdown.subtasks?.map((st: any, idx: number) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>{idx + 1}. {st.title}</span>
                    <span className="font-mono text-indigo-600">{st.estimatedMinutes}m</span>
                  </div>
                  {st.description && <p className="text-slate-500">{st.description}</p>}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleAcceptBreakdown}
                className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl transition shadow-sm"
              >
                Accept & Create Subtasks in Database
              </button>
              <button
                onClick={() => setBreakdownModal(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-medium text-xs rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

