import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import {
  ArrowLeft,
  Trash2,
  Plus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Layers,
  Wand2,
  RefreshCw,
  Calendar,
  X
} from 'lucide-react'
import { AIProjectReview } from '@iqoo/shared'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM')
  const [newTaskMinutes, setNewTaskMinutes] = useState(30)
  const [breakdownModalTask, setBreakdownModalTask] = useState<{ id: string; title: string } | null>(null)
  const [subtasks, setSubtasks] = useState<any[]>([])
  const [isBreakingDown, setIsBreakingDown] = useState(false)

  // 1. Fetch Project
  const { data: projectResponse, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiClient.getProject(id!),
    enabled: !!id,
  })

  // 2. Fetch Tasks for this Project
  const { data: tasksResponse } = useQuery({
    queryKey: ['tasks', { projectId: id }],
    queryFn: () => apiClient.getTasks(id),
    enabled: !!id,
  })

  const rawProject = projectResponse?.data?.project || projectResponse?.data || projectResponse
  const project = (rawProject && rawProject.id) ? rawProject : null
  const tasks: any[] = Array.isArray(tasksResponse?.data?.tasks)
    ? tasksResponse.data.tasks
    : Array.isArray(tasksResponse?.data)
      ? tasksResponse.data
      : []

  // 3. AI Project Review Query
  const {
    data: reviewResponse,
    refetch: refetchReview,
    isFetching: reviewFetching
  } = useQuery({
    queryKey: ['project-review', id],
    queryFn: async () => {
      const res = await apiClient.getProjectReview(id!, project?.name, tasks)
      return res?.data?.review || res?.data || res
    },
    enabled: !!id && !!project,
    staleTime: 1000 * 60 * 5, // 5 min cache
  })

  const aiReview: AIProjectReview | null = reviewResponse || null

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiClient.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['project-review', id] })
      setNewTaskTitle('')
      setIsAddingTask(false)
    }
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) => apiClient.updateTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['project-review', id] })
    }
  })

  const handleDelete = async () => {
    if (!project || !window.confirm('Are you sure you want to delete this project?')) return
    setDeleting(true)
    try {
      await apiClient.deleteProject(project.id)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/projects')
    } catch (error) {
      console.error('Failed to delete project:', error)
      setDeleting(false)
    }
  }

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    createTaskMutation.mutate({
      title: newTaskTitle.trim(),
      projectId: id,
      priority: newTaskPriority,
      estimatedMinutes: newTaskMinutes,
      status: 'TODO'
    })
  }

  const handleBreakdownTask = async (task: { id: string; title: string }) => {
    setBreakdownModalTask(task)
    setIsBreakingDown(true)
    try {
      const res = await apiClient.breakdownTask(task.title)
      const data = res?.data?.breakdown || res?.data || res
      setSubtasks(data?.subtasks || [])
    } catch (err) {
      console.error('Task breakdown error:', err)
    } finally {
      setIsBreakingDown(false)
    }
  }

  const handleApplySubtasks = async () => {
    if (!breakdownModalTask) return
    try {
      for (const st of subtasks) {
        await apiClient.createTask({
          title: st.title,
          projectId: id,
          estimatedMinutes: st.estimatedMinutes || 30,
          priority: 'MEDIUM',
          status: 'TODO'
        })
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['project-review', id] })
      setBreakdownModalTask(null)
      setSubtasks([])
    } catch (err) {
      console.error('Failed to create subtasks:', err)
    }
  }

  const getProjectColor = (color?: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-500'
      case 'blue':
        return 'bg-blue-500'
      case 'green':
        return 'bg-green-500'
      case 'yellow':
        return 'bg-amber-500'
      case 'purple':
        return 'bg-purple-500'
      default:
        return 'bg-indigo-500'
    }
  }

  const getHealthBadge = (health?: string) => {
    switch (health) {
      case 'ON_TRACK':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> ON TRACK</span>
      case 'AT_RISK':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300"><AlertTriangle className="w-3.5 h-3.5" /> AT RISK</span>
      case 'CRITICAL':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300"><ShieldAlert className="w-3.5 h-3.5" /> CRITICAL RISK</span>
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300"><TrendingUp className="w-3.5 h-3.5" /> ACTIVE</span>
    }
  }

  if (projectLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 animate-pulse space-y-6">
        <div className="h-6 bg-slate-200 rounded w-32"></div>
        <div className="h-32 bg-slate-200 rounded-xl"></div>
        <div className="grid grid-cols-4 gap-4">
          <div className="h-20 bg-slate-200 rounded-lg"></div>
          <div className="h-20 bg-slate-200 rounded-lg"></div>
          <div className="h-20 bg-slate-200 rounded-lg"></div>
          <div className="h-20 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6 pb-24 text-center">
        <button onClick={() => navigate('/projects')} className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6 font-medium">
          <ArrowLeft size={20} /> Back to Projects
        </button>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 max-w-lg mx-auto shadow-sm">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Project Not Found</h2>
          <p className="text-slate-500 text-sm mb-6">This project may have been deleted or the URL is invalid.</p>
          <button onClick={() => navigate('/projects')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition">
            View All Projects
          </button>
        </div>
      </div>
    )
  }

  const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED').length
  const inProgressTasks = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length
  const progressPercentage = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0
  const remainingMinutes = tasks.filter((t: any) => t.status !== 'COMPLETED').reduce((acc: number, t: any) => acc + (t.estimatedMinutes || 30), 0)

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium text-sm transition"
        >
          <ArrowLeft size={18} /> Back to Projects
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchReview()}
            disabled={reviewFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reviewFetching ? 'animate-spin' : ''}`} />
            Refresh Intelligence
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
            title="Delete Project"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Project Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`w-4 h-4 rounded-full ${getProjectColor(project.color)} ring-4 ring-slate-100`}></span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{project.name}</h1>
              {aiReview && getHealthBadge(aiReview.healthStatus)}
            </div>
            {project.description && (
              <p className="text-slate-600 text-sm max-w-2xl">{project.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddingTask(!isAddingTask)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-sm transition"
            >
              <Plus size={16} /> Add Task
            </button>
          </div>
        </div>

        {/* Progress Bar & Summary Stats */}
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-500 uppercase tracking-wider">Project Completion</span>
            <span className="text-indigo-600 text-sm font-bold">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-500 text-xs font-medium">Total Tasks</span>
              <p className="text-lg font-bold text-slate-900">{tasks.length}</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <span className="text-emerald-700 text-xs font-medium">Completed</span>
              <p className="text-lg font-bold text-emerald-800">{completedTasks}</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
              <span className="text-amber-700 text-xs font-medium">In Progress</span>
              <p className="text-lg font-bold text-amber-800">{inProgressTasks}</p>
            </div>
            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <span className="text-indigo-700 text-xs font-medium">Est. Remaining</span>
              <p className="text-lg font-bold text-indigo-900">
                {remainingMinutes > 60 ? `${(remainingMinutes / 60).toFixed(1)} hrs` : `${remainingMinutes} min`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Project Intelligence Card */}
      {aiReview && (
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-md space-y-5 border border-indigo-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">AI Project Intelligence</h3>
                <p className="text-xs text-indigo-200/70">Continuous risk tracking & execution forecast</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-indigo-300/80 font-medium">Project Health</span>
              <p className="text-xs font-bold text-emerald-300">{aiReview.healthStatus}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bottlenecks */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" /> Bottlenecks & Blockers
              </div>
              {aiReview.bottlenecks && aiReview.bottlenecks.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {aiReview.bottlenecks.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">No critical bottlenecks detected in the dependency graph.</p>
              )}
            </div>

            {/* Recommendations */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-2">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs uppercase tracking-wider">
                <Wand2 className="w-4 h-4" /> AI Recommendations
              </div>
              {aiReview.recommendations && aiReview.recommendations.length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {aiReview.recommendations.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Continue steady execution of next prioritized tasks.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Task Form */}
      {isAddingTask && (
        <form onSubmit={handleCreateTask} className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Add New Task to {project.name}</h3>
            <button type="button" onClick={() => setIsAddingTask(false)} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Task title (e.g. Implement user authentication)"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Priority:</span>
                <select
                  value={newTaskPriority}
                  onChange={(e: any) => setNewTaskPriority(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Estimated:</span>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={newTaskMinutes}
                  onChange={(e) => setNewTaskMinutes(Number(e.target.value))}
                  className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-500">mins</span>
              </div>

              <button
                type="submit"
                disabled={createTaskMutation.isPending || !newTaskTitle.trim()}
                className="ml-auto px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {createTaskMutation.isPending ? 'Saving...' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Task List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Project Tasks ({tasks.length})</h2>
          <span className="text-xs text-slate-500">
            {completedTasks} of {tasks.length} finished
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">No tasks in this project yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Start adding tasks to activate AI progress forecasts and bottleneck detection.
            </p>
            <button
              onClick={() => setIsAddingTask(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
            >
              <Plus size={14} /> Add First Task
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task: any) => {
              const isCompleted = task.status === 'COMPLETED'
              const isInProgress = task.status === 'IN_PROGRESS'
              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl border transition p-4 flex items-center justify-between gap-4 ${
                    isCompleted
                      ? 'border-slate-200 bg-slate-50/50 opacity-75'
                      : isInProgress
                      ? 'border-indigo-300 shadow-sm ring-1 ring-indigo-200'
                      : 'border-slate-200 hover:border-indigo-200 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <button
                      onClick={() =>
                        updateTaskMutation.mutate({
                          taskId: task.id,
                          data: { status: isCompleted ? 'TODO' : 'COMPLETED' },
                        })
                      }
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition border ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-600 text-white'
                          : 'border-slate-300 hover:border-indigo-500 text-transparent'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-semibold truncate ${
                            isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.priority === 'URGENT' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            URGENT
                          </span>
                        )}
                        {task.priority === 'HIGH' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            HIGH
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} />
                          {task.estimatedMinutes || 30}m
                        </span>
                        {task.dueDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {task.blockers && task.blockers.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                            <AlertTriangle size={12} /> Blocked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isCompleted && (
                      <button
                        onClick={() => handleBreakdownTask(task)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                        title="AI Breakdown into subtasks"
                      >
                        <Sparkles size={13} /> Breakdown
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/tasks`)}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* AI Breakdown Modal */}
      {breakdownModalTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">AI Task Decomposition</h3>
              </div>
              <button
                onClick={() => setBreakdownModalTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Breaking down: <strong className="text-slate-800">{breakdownModalTask.title}</strong>
            </div>

            {isBreakingDown ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-600">Generating actionable subtasks...</p>
              </div>
            ) : subtasks.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {subtasks.map((st, idx) => (
                    <div key={idx} className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
                      <div className="font-semibold text-indigo-950">{st.title}</div>
                      <div className="text-indigo-600 text-[11px] mt-0.5">Est. {st.estimatedMinutes || 30} mins</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setBreakdownModalTask(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplySubtasks}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                  >
                    Add {subtasks.length} Subtasks to Project
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                Could not automatically decompose this task. Try manually adding subtasks.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

