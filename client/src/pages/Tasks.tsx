import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { TaskCard } from '../components/TaskCard'
import { TaskPriorityChart } from '../components/TaskPriorityChart'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function TasksPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<string>('')
  const [search, setSearch] = useState<string>('')

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => apiClient.getTasks(undefined, filter || undefined),
  })

  const tasks = tasksData?.data?.tasks || []
  const filteredTasks = tasks.filter((task: any) =>
    task.title.toLowerCase().includes(search.toLowerCase()) ||
    task.description?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 pb-24 md:pb-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
        <button 
          onClick={() => navigate('/tasks')}
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {['', 'TODO', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {status || 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Task List */}
          {filteredTasks.length > 0 ? (
            <div className="space-y-3">
              {filteredTasks.map((task: any) => (
                <button
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="w-full text-left hover:opacity-75 transition-opacity"
                >
                  <TaskCard task={task} />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600">No tasks found</p>
            </div>
          )}
        </div>

        {/* Sidebar - Priority Chart */}
        <div className="md:col-span-1">
          <TaskPriorityChart tasks={tasks} />
        </div>
      </div>
    </div>
  )
}
