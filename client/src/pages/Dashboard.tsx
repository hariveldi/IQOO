import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { TrendingUp, Target, Clock, CheckCircle, AlertCircle } from 'lucide-react'

export default function ProductivityDashboard() {
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => apiClient.getTasks(),
  })

  const tasks = tasksData?.data?.tasks || []

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t: any) => t.status === 'COMPLETED').length,
    inProgress: tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
    overdue: tasks.filter(
      (t: any) =>
        t.deadline && new Date(t.deadline) < new Date() && t.status !== 'COMPLETED'
    ).length,
    totalTimeLogged: tasks.reduce(
      (sum: number, t: any) => sum + (t.actualMinutes || 0),
      0
    ),
  }

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  const avgTimePerTask =
    stats.completed > 0 ? Math.round(stats.totalTimeLogged / stats.completed) : 0

  const priorityStats = {
    critical: tasks.filter((t: any) => t.priority === 'CRITICAL').length,
    high: tasks.filter((t: any) => t.priority === 'HIGH').length,
    medium: tasks.filter((t: any) => t.priority === 'MEDIUM').length,
    low: tasks.filter((t: any) => t.priority === 'LOW').length,
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 pb-24 md:pb-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Productivity Dashboard</h1>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Completion Rate */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Completion Rate</h2>
            <CheckCircle size={24} className="text-green-600" />
          </div>
          <div className="text-5xl font-bold text-green-600 mb-2">{completionRate}%</div>
          <p className="text-sm text-gray-600">
            {stats.completed} of {stats.total} tasks completed
          </p>
          <div className="w-full bg-green-200 rounded-full h-2 mt-4">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Time Logged */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Time Tracked</h2>
            <Clock size={24} className="text-blue-600" />
          </div>
          <div className="text-5xl font-bold text-blue-600 mb-2">
            {Math.floor(stats.totalTimeLogged / 60)}h {stats.totalTimeLogged % 60}m
          </div>
          <p className="text-sm text-gray-600">
            {avgTimePerTask} min average per task
          </p>
        </div>

        {/* Active Tasks */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">In Progress</h2>
            <TrendingUp size={24} className="text-purple-600" />
          </div>
          <div className="text-5xl font-bold text-purple-600 mb-2">{stats.inProgress}</div>
          <p className="text-sm text-gray-600">Tasks currently being worked on</p>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Overdue</h2>
            <AlertCircle size={24} className="text-red-600" />
          </div>
          <div className="text-5xl font-bold text-red-600 mb-2">{stats.overdue}</div>
          <p className="text-sm text-gray-600">
            {stats.overdue > 0 ? 'Need immediate attention' : 'All on track!'}
          </p>
        </div>
      </div>

      {/* Priority Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Priority Distribution</h2>
        <div className="space-y-4">
          {[
            { label: 'CRITICAL', value: priorityStats.critical, color: 'bg-red-500' },
            { label: 'HIGH', value: priorityStats.high, color: 'bg-orange-500' },
            { label: 'MEDIUM', value: priorityStats.medium, color: 'bg-yellow-500' },
            { label: 'LOW', value: priorityStats.low, color: 'bg-green-500' },
          ].map((item) => {
            const percentage = stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  <span className="text-sm text-gray-600">
                    {item.value} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Task Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 mb-1">{stats.total}</div>
            <p className="text-sm text-gray-600">Total Tasks</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-1">{stats.completed}</div>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-1">{stats.inProgress}</div>
            <p className="text-sm text-gray-600">In Progress</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600 mb-1">
              {stats.total - stats.completed - stats.inProgress}
            </div>
            <p className="text-sm text-gray-600">To Do</p>
          </div>
        </div>
      </div>
    </div>
  )
}
