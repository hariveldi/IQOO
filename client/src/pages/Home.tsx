import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { TaskCard } from '../components/TaskCard'
import { Brain, Calendar, AlertCircle } from 'lucide-react'

export default function HomePage() {
  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.getTasks(),
  })

  const tasks = tasksData?.data?.tasks || []
  
  // Get high-priority tasks and overdue tasks
  const urgentTasks = tasks
    .filter((t: any) => t.priority === 'CRITICAL' || t.priority === 'HIGH')
    .filter((t: any) => t.status !== 'COMPLETED')
    .slice(0, 3)

  const overdueTasks = tasks
    .filter((t: any) => t.deadline && new Date(t.deadline) < new Date())
    .filter((t: any) => t.status !== 'COMPLETED')

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">What should I do now?</h1>
        <p className="text-gray-600">Your AI-powered productivity assistant</p>
      </div>

      {/* AI Recommendation */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-white p-6 mb-6 shadow-md">
        <div className="flex items-start gap-4">
          <Brain className="w-6 h-6 flex-shrink-0 mt-1" />
          <div>
            <h2 className="font-semibold text-lg mb-2">AI Recommendation</h2>
            <p className="text-blue-100 mb-3">
              Focus on your high-priority tasks first. You have {overdueTasks.length} overdue items that need attention.
            </p>
            <button className="bg-white text-blue-600 px-4 py-2 rounded font-medium hover:bg-blue-50 transition-colors">
              View Plan
            </button>
          </div>
        </div>
      </div>

      {/* Urgent Tasks */}
      {overdueTasks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-lg text-gray-900">Overdue Tasks ({overdueTasks.length})</h2>
          </div>
          <div className="space-y-3">
            {overdueTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Today's Tasks */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-lg text-gray-900">Today's Priority</h2>
        </div>
        {urgentTasks.length > 0 ? (
          <div className="space-y-3">
            {urgentTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600">No urgent tasks. Great job! 🎉</p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <p className="text-2xl font-bold text-blue-600">{tasks.filter((t: any) => t.status === 'COMPLETED').length}</p>
          <p className="text-sm text-gray-600">Completed</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <p className="text-2xl font-bold text-yellow-600">{tasks.filter((t: any) => t.status === 'IN_PROGRESS').length}</p>
          <p className="text-sm text-gray-600">In Progress</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <p className="text-2xl font-bold text-red-600">{tasks.filter((t: any) => t.status === 'TODO').length}</p>
          <p className="text-sm text-gray-600">To Do</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <p className="text-2xl font-bold text-purple-600">{tasks.length}</p>
          <p className="text-sm text-gray-600">Total Tasks</p>
        </div>
      </div>
    </div>
  )
}
