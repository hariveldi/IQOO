import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { ArrowLeft, Edit2, Trash2, Plus } from 'lucide-react'
import { TaskCard } from '../components/TaskCard'
import { useState } from 'react'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiClient.getProject(id!),
  })

  const { data: progressData } = useQuery({
    queryKey: ['project-progress', id],
    queryFn: () => apiClient.getProjectProgress(id!),
  })

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', { projectId: id }],
    queryFn: () => apiClient.getTasks(id),
  })

  const project = projectData?.data
  const progress = progressData?.data
  const tasks = tasksData?.data || []

  const handleDelete = async () => {
    if (!project) return
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

  const getProjectColor = (color?: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-100 text-red-700'
      case 'blue':
        return 'bg-blue-100 text-blue-700'
      case 'green':
        return 'bg-green-100 text-green-700'
      case 'yellow':
        return 'bg-yellow-100 text-yellow-700'
      case 'purple':
        return 'bg-purple-100 text-purple-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (projectLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto p-4 pb-24 md:pb-4">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
          <ArrowLeft size={20} /> Back
        </button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="w-full max-w-3xl mx-auto p-4 pb-24 md:pb-4 text-center">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4">
          <ArrowLeft size={20} /> Back
        </button>
        <p className="text-gray-600">Project not found</p>
      </div>
    )
  }

  const completedTasks = tasks.filter((t: any) => t.status === 'COMPLETED').length
  const progressPercentage = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

  return (
    <div className="w-full max-w-3xl mx-auto p-4 pb-24 md:pb-4">
      {/* Header */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium"
      >
        <ArrowLeft size={20} /> Back to Projects
      </button>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Title */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-4 h-4 rounded-full ${getProjectColor(project.color)}`}></div>
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              </div>
              {project.description && (
                <p className="text-gray-600">{project.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/projects/${project.id}/edit`)}
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
        </div>

        {/* Progress */}
        <div className="p-6 border-b border-gray-200">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Progress</h2>
              <span className="text-2xl font-bold text-blue-600">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedTasks}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-1">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">
                {tasks.filter((t: any) => t.status === 'IN_PROGRESS').length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-1">Total</p>
              <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Tasks ({tasks.length})</h2>
            <button
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={16} /> New Task
            </button>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-3">
              {tasks.map((task: any) => (
                <button
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="w-full text-left"
                >
                  <TaskCard task={task} />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-2">No tasks in this project yet</p>
              <button
                onClick={() => navigate('/tasks')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Create a new task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
