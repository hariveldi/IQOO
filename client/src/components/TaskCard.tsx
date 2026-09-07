import React from 'react'
import { CheckCircle, AlertCircle, Clock, Flag } from 'lucide-react'
import { Task } from '../types'

interface TaskCardProps {
  task: Task
  onClick?: () => void
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'BLOCKED':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-blue-500" />
      default:
        return <Flag className="w-5 h-5 text-gray-400" />
    }
  }

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'LOW':
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const isOverdue = task.deadline && new Date(task.deadline) < new Date()

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3 flex-1">
          {getStatusIcon()}
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor()}`}>
            {task.priority}
          </span>
          {isOverdue && (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded border border-red-300">
              Overdue
            </span>
          )}
        </div>
        {task.deadline && (
          <span className="text-xs text-gray-500">
            {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>

      {task.tags.length > 0 && (
        <div className="mt-3 flex gap-1 flex-wrap">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="px-2 py-1 text-xs text-gray-500">
              +{task.tags.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}
