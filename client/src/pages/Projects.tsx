import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { Plus } from 'lucide-react'

export default function ProjectsPage() {
  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  })

  const projects = projectsData?.data?.projects || []

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 pb-24 md:pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
        <button className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project: any) => (
            <div key={project.id} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all">
              <div
                className="w-4 h-4 rounded-full mb-3"
                style={{ backgroundColor: project.color || '#3B82F6' }}
              />
              <h3 className="font-semibold text-lg text-gray-900 mb-2">{project.name}</h3>
              {project.description && (
                <p className="text-gray-600 text-sm mb-3">{project.description}</p>
              )}
              <div className="text-sm text-gray-500">
                {project.tasks.length} tasks
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-600">No projects yet. Create one to get started!</p>
        </div>
      )}
    </div>
  )
}
