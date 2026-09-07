import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { ArrowLeft, Edit2, Trash2, Calendar, Clock, CheckCircle, Play } from 'lucide-react'
import { useState } from 'react'
import { TaskForm } from '../components/TaskForm'
import { FocusSessionModal } from '../components/FocusSessionModal'

export default function TaskDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showEditForm, setShowEditForm] = useState(false)
  const [showFocusSession, setShowFocusSession] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { data: taskData, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => apiClient.getTask(id!),
  })

  const task = taskData?.data

  const handleComplete = async () => {
    if (!task) return
    try {
      await apiClient.completeTask(task.id)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task', id] })
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    setDeleting(true)
    try {
      await apiClient.deleteTask(task.id)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      navigate('/tasks')
    } catch (error) {
      console.error('Failed to delete task:', error)
      setDeleting(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-700 border-red-300'
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border-orange-300'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'LOW':
        return 'bg-green-100 text-green-700 border-green-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600'
      case 'IN_PROGRESS':
        return 'text-blue-600'
      case 'BLOCKED':
        return 'text-red-600'
      case 'CANCELLED':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto p-4 pb-24 md:pb-4">
        <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
          <ArrowLeft size={20} /> Back
        </button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="w-full max-w-3xl mx-auto p-4 pb-24 md:pb-4 text-center">
        <button onClick={() => navigate('/tasks')} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
          <ArrowLeft size={20} /> Back
        </button>
        <p className="text-gray-600">Task not found</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 pb-24 md:pb-4">
      {/* Header */}
      <button
        onClick={() => navigate('/tasks')}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium"
      >
        <ArrowLeft size={20} /> Back to Tasks
      </button>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Title and Status */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className={`text-3xl font-bold mb-2 ${getStatusColor(task.status)}`}>
                {task.title}
              </h1>
              <p className="text-gray-600">{task.status.replace('_', ' ')}</p>
            </div>
            <div className="flex gap-2">
              {task.status !== 'COMPLETED' && (
                <button
                  onClick={() => setShowFocusSession(true)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                  title="Start focus session"
                >
                  <Play size={20} />
                </button>
              )}
              <button
                onClick={() => setShowEditForm(true)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit2 size={20} />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            {task.status !== 'COMPLETED' && (
              <button
                onClick={handleComplete}
                className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-300 hover:bg-green-50"
              >
                ✓ Mark Complete
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-gray-700 leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Details Grid */}
        <div className="p-6 border-b border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Deadline */}
          <div>
            <div className="flex items-center gap-2 text-gray-600 text-sm font-medium mb-1">
              <Calendar size={16} /> Deadline
            </div>
            <p className="text-gray-900 font-semibold">
              {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
            </p>
          </div>

          {/* Estimated Time */}
          <div>
            <div className="flex items-center gap-2 text-gray-600 text-sm font-medium mb-1">
              <Clock size={16} /> Est. Time
            </div>
            <p className="text-gray-900 font-semibold">{task.estimatedMinutes || 0} min</p>
          </div>

          {/* Actual Time */}
          <div>
            <div className="flex items-center gap-2 text-gray-600 text-sm font-medium mb-1">
              <CheckCircle size={16} /> Actual Time
            </div>
            <p className="text-gray-900 font-semibold">{task.actualMinutes || 0} min</p>
          </div>

          {/* Project */}
          <div>
            <div className="text-gray-600 text-sm font-medium mb-1">Project</div>
            <p className="text-gray-900 font-semibold">{task.projectId ? 'Project' : 'None'}</p>
          </div>
        </div>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag: string, idx: number) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Dependencies</h2>
            <div className="space-y-2">
              {task.dependencies.map((dep: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => navigate(`/tasks/${dep.id}`)}
                  className="block w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <p className="font-medium text-gray-900">{dep.title}</p>
                  <p className="text-sm text-gray-600">{dep.status.replace('_', ' ')}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <TaskForm
          initialData={task}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => {
            setShowEditForm(false)
            queryClient.invalidateQueries({ queryKey: ['task', id] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
          }}
        />
      )}

      {/* Focus Session Modal */}
      {showFocusSession && (
        <FocusSessionModal
          taskId={task.id}
          taskTitle={task.title}
          onClose={() => {
            setShowFocusSession(false)
            queryClient.invalidateQueries({ queryKey: ['task', id] })
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
          }}
        />
      )}
    </div>
  )
}
