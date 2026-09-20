import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'
import { Plus, FolderOpen, ArrowRight, X, AlertCircle } from 'lucide-react'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [submitting, setSubmitting] = useState(false)

  const { data: projectsData, isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  })

  const projects = projectsData?.data?.projects || []

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      await apiClient.createProject({ name, description, color })
      setShowCreateModal(false)
      setName('')
      setDescription('')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (err: any) {
      alert(`Failed to create project: ${err?.message || 'Error'}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Loading projects...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 text-center space-y-3">
        <AlertCircle size={32} className="mx-auto text-red-500" />
        <h2 className="text-base font-bold text-slate-900">Failed to load projects</h2>
        <p className="text-xs text-slate-500">{(error as any)?.message || 'Service unavailable'}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Project Control Center
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Track project health, dependency chains, and automated AI project assessments
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: any) => {
            const projectTasks = project.tasks || []
            const total = projectTasks.length
            const completed = projectTasks.filter((t: any) => t.status === 'COMPLETED').length
            const inProgress = projectTasks.filter((t: any) => t.status === 'IN_PROGRESS').length
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-xs"
                        style={{ backgroundColor: project.color || '#3B82F6' }}
                      />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Project
                      </span>
                    </div>
                    <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Details <ArrowRight size={13} />
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                </div>

                {/* Progress & Task Counts */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">
                      {completed}/{total} tasks finished
                    </span>
                    <span className="font-bold text-slate-900">{pct}%</span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                    <span>In Progress: <strong>{inProgress}</strong></span>
                    <span>•</span>
                    <span>To Do: <strong>{total - completed - inProgress}</strong></span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <FolderOpen size={36} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">No projects yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Group your tasks into dedicated projects to get milestone tracking and AI dependency reviews.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition"
          >
            Create First Project
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create New Project</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Website Redesign"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Goals, milestones, and scope..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        color === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-600 font-medium text-xs rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
